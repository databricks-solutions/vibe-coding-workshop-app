#!/usr/bin/env python3
"""
post_deploy.py -- finishes a one-shot install that started with `databricks bundle deploy`.

Runs after the bundle has provisioned declarative resources (postgres_projects,
postgres_branches, database_catalogs, app shell). Handles every step that
needs the post-create service-principal client_id or has to talk to Lakebase
directly:

  1. Look up the app's service-principal client_id (with retry).
  2. Grant ALL_PRIVILEGES on the UC catalog to the SP.
  3. Create Lakebase postgres roles for the SP and the 'users' group, both
     granted DATABRICKS_SUPERUSER. Idempotent.
  4. Resolve the autoscaling endpoint host via the SDK.
  5. Apply DDL + seed SQL via psycopg, gated on a `<schema>._migrations` table
     so re-runs only apply new files.
  6. For git-source apps, push code with `databricks apps deploy --json
     '{"git_source": {"branch": "<branch>"}}'`.
  7. Wait for the app to reach RUNNING.

Every step is idempotent: re-running after a partial failure is the supported
recovery path.

Invocation:
  python scripts/post_deploy.py \
    --app-name <app> --project <pr> --branch main \
    --catalog <uc-catalog> --schema <schema> \
    [--profile <profile>] [--git-branch main] [--no-code-push] [--no-wait]
"""

from __future__ import annotations

import argparse
import glob
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Optional

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [post_deploy] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("post_deploy")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DDL_DIR = PROJECT_ROOT / "db" / "lakebase" / "ddl"
DML_SEED_DIR = PROJECT_ROOT / "db" / "lakebase" / "dml_seed"

# DDL filenames that target Unity Catalog only, not Lakebase Postgres.
DDL_EXCLUDE = {"apply_tags"}


# ---------------------------------------------------------------------------
# CLI helpers
# ---------------------------------------------------------------------------

def _databricks_cli() -> str:
    cli = shutil.which("databricks")
    if not cli:
        log.error("`databricks` CLI not found on PATH")
        sys.exit(1)
    return cli


def _run_databricks(args: list[str], profile: Optional[str], *, capture: bool = True,
                    check: bool = False) -> subprocess.CompletedProcess:
    cmd = [_databricks_cli(), *args]
    if profile:
        cmd += ["--profile", profile]
    log.debug("$ %s", " ".join(cmd))
    return subprocess.run(
        cmd,
        capture_output=capture,
        text=True,
        check=check,
    )


# ---------------------------------------------------------------------------
# Step 1 -- look up app SP client_id
# ---------------------------------------------------------------------------

def get_app_service_principal(app_name: str, profile: Optional[str],
                              max_wait_s: int = 60) -> dict:
    """Return ``databricks apps get`` JSON, retrying while the app shell is provisioning."""
    deadline = time.time() + max_wait_s
    last_err: Optional[str] = None
    while time.time() < deadline:
        proc = _run_databricks(["apps", "get", app_name], profile)
        if proc.returncode == 0:
            try:
                info = json.loads(proc.stdout)
            except json.JSONDecodeError as exc:
                last_err = f"non-JSON response: {exc}"
            else:
                if info.get("service_principal_client_id"):
                    return info
                last_err = "service_principal_client_id not yet set"
        else:
            last_err = (proc.stderr or proc.stdout).strip()
        log.info("Waiting for app %s to expose its SP... (%s)", app_name, last_err)
        time.sleep(5)
    raise RuntimeError(f"app {app_name} never exposed a service principal: {last_err}")


# ---------------------------------------------------------------------------
# Step 2 -- UC catalog ALL_PRIVILEGES for the app SP
# ---------------------------------------------------------------------------

def grant_uc_catalog_all_privileges(catalog: str, sp_client_id: str,
                                    profile: Optional[str]) -> None:
    if not catalog:
        log.info("No UC catalog configured -- skipping ALL_PRIVILEGES grant")
        return
    payload = {
        "changes": [{"principal": sp_client_id, "add": ["ALL_PRIVILEGES"]}],
    }
    proc = _run_databricks(
        [
            "api", "patch",
            f"/api/2.1/unity-catalog/permissions/catalog/{catalog}",
            "--json", json.dumps(payload),
        ],
        profile,
    )
    out = (proc.stdout or "") + (proc.stderr or "")
    if proc.returncode == 0 and ("privilege_assignments" in out or "ALL_PRIVILEGES" in out):
        log.info("Granted ALL_PRIVILEGES on catalog %s to SP %s", catalog, sp_client_id)
    elif "already" in out.lower():
        log.info("ALL_PRIVILEGES on catalog %s already present for SP", catalog)
    else:
        log.warning("Could not grant ALL_PRIVILEGES on catalog %s: %s", catalog, out.strip())


# ---------------------------------------------------------------------------
# Step 3 -- Lakebase postgres roles for SP and users group
# ---------------------------------------------------------------------------

def list_existing_role_names(branch_resource: str, profile: Optional[str]) -> set[str]:
    """Return the set of postgres_role names currently defined on a branch."""
    proc = _run_databricks(["postgres", "list-roles", branch_resource], profile)
    if proc.returncode != 0:
        log.warning("Could not list roles on %s: %s", branch_resource, proc.stderr.strip())
        return set()
    try:
        data = json.loads(proc.stdout or "{}")
    except json.JSONDecodeError:
        return set()
    roles = data.get("roles") or data.get("items") or []
    names: set[str] = set()
    for role in roles:
        spec = role.get("spec") or {}
        if spec.get("postgres_role"):
            names.add(spec["postgres_role"])
    return names


def ensure_branch_role(branch_resource: str, postgres_role: str, identity_type: str,
                       profile: Optional[str], existing: set[str]) -> None:
    if postgres_role in existing:
        log.info("Role %s already exists on %s", postgres_role, branch_resource)
        return
    spec = {
        "spec": {
            "postgres_role": postgres_role,
            "identity_type": identity_type,
            "membership_roles": ["DATABRICKS_SUPERUSER"],
        }
    }
    proc = _run_databricks(
        [
            "postgres", "create-role", branch_resource,
            "--json", json.dumps(spec),
            "--no-wait",
        ],
        profile,
    )
    out = (proc.stdout or "") + (proc.stderr or "")
    if proc.returncode == 0 or identity_type in out or "name" in out:
        log.info("Created %s role %s on %s", identity_type, postgres_role, branch_resource)
    elif "already exists" in out.lower():
        log.info("Role %s already exists on %s", postgres_role, branch_resource)
    else:
        log.warning("Could not create role %s on %s: %s", postgres_role, branch_resource, out.strip())


def grant_lakebase_roles(project: str, branch: str, sp_client_id: str,
                         profile: Optional[str]) -> None:
    branch_resource = f"projects/{project}/branches/{branch}"
    existing = list_existing_role_names(branch_resource, profile)
    ensure_branch_role(branch_resource, sp_client_id, "SERVICE_PRINCIPAL", profile, existing)
    ensure_branch_role(branch_resource, "users", "GROUP", profile, existing)


# ---------------------------------------------------------------------------
# Step 4 -- resolve Lakebase host via SDK
# ---------------------------------------------------------------------------

def resolve_endpoint_host(project: str, branch: str, profile: Optional[str]) -> tuple[str, str]:
    """Return (endpoint_resource_name, host) for the primary endpoint on a branch."""
    endpoint_resource = f"projects/{project}/branches/{branch}/endpoints/primary"
    # Wait up to 5 min for the endpoint to be ready (autoscaling may still be provisioning).
    deadline = time.time() + 300
    last_err: Optional[str] = None
    while time.time() < deadline:
        proc = _run_databricks(["postgres", "get-endpoint", endpoint_resource], profile)
        if proc.returncode == 0:
            try:
                data = json.loads(proc.stdout)
            except json.JSONDecodeError as exc:
                last_err = f"non-JSON: {exc}"
            else:
                host = (
                    (data.get("status") or {})
                    .get("hosts", {})
                    .get("host")
                )
                if host:
                    return endpoint_resource, host
                last_err = f"no host yet (state={data.get('status', {}).get('current_state')})"
        else:
            last_err = (proc.stderr or proc.stdout).strip()
        log.info("Waiting for Lakebase endpoint %s... (%s)", endpoint_resource, last_err)
        time.sleep(5)
    raise RuntimeError(f"endpoint {endpoint_resource} never reported a host: {last_err}")


def generate_database_credential(endpoint_resource: str, profile: Optional[str]) -> str:
    proc = _run_databricks(
        ["postgres", "generate-database-credential", "--endpoint", endpoint_resource],
        profile,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"generate-database-credential failed: {proc.stderr.strip()}")
    data = json.loads(proc.stdout)
    token = data.get("token")
    if not token:
        raise RuntimeError(f"no token in generate-database-credential response: {proc.stdout!r}")
    return token


def get_current_user(profile: Optional[str]) -> str:
    proc = _run_databricks(["current-user", "me"], profile)
    if proc.returncode != 0:
        raise RuntimeError(f"current-user me failed: {proc.stderr.strip()}")
    return json.loads(proc.stdout).get("userName", "")


# ---------------------------------------------------------------------------
# Step 5 -- DDL + seed via psycopg, gated on _migrations
# ---------------------------------------------------------------------------

_SCHEMA_RE_CATALOG = re.compile(r"\$\{catalog\}\.\$\{schema\}\.")
_SCHEMA_RE = re.compile(r"\$\{schema\}")


def _transform_for_postgres(sql: str, schema: str) -> str:
    sql = _SCHEMA_RE_CATALOG.sub(f"{schema}.", sql)
    sql = _SCHEMA_RE.sub(schema, sql)
    sql = sql.replace("current_timestamp()", "CURRENT_TIMESTAMP")
    sql = sql.replace("current_user()", "CURRENT_USER")
    return sql


def _split_statements(sql: str) -> list[str]:
    """Split a SQL blob on top-level semicolons, respecting strings + parens.

    Mirrors the logic in scripts/setup-lakebase.sh so behavior is identical.
    """
    statements: list[str] = []
    i = 0
    n = len(sql)
    while i < n:
        if sql[i:i + 2] == "--":
            while i < n and sql[i] != "\n":
                i += 1
            i += 1
            continue
        if sql[i] in " \t\n\r":
            i += 1
            continue
        start = i
        in_string = False
        depth = 0
        while i < n:
            ch = sql[i]
            if ch == "'" and not in_string:
                in_string = True
            elif ch == "'" and in_string:
                if i + 1 < n and sql[i + 1] == "'":
                    i += 2
                    continue
                in_string = False
            elif not in_string:
                if ch == "-" and i + 1 < n and sql[i + 1] == "-":
                    while i < n and sql[i] != "\n":
                        i += 1
                    continue
                if ch == "(":
                    depth += 1
                elif ch == ")":
                    depth -= 1
                elif ch == ";" and depth <= 0:
                    stmt = sql[start:i + 1].strip()
                    if stmt and not stmt.startswith("--"):
                        statements.append(stmt)
                    i += 1
                    break
            i += 1
        else:
            stmt = sql[start:].strip()
            if stmt and not stmt.startswith("--"):
                statements.append(stmt)
            break
    return statements


def _list_sql_files(directory: Path, exclude: set[str] = frozenset()) -> list[Path]:
    if not directory.exists():
        return []
    out: list[Path] = []
    for f in sorted(directory.glob("*.sql")):
        if any(p in f.name for p in exclude):
            continue
        out.append(f)
    return out


def _connect(host: str, database: str, port: int, user: str, password: str):
    """Open an autocommit connection using whichever psycopg is installed."""
    try:
        import psycopg
        return psycopg.connect(
            host=host, port=port, dbname=database,
            user=user, password=password, sslmode="require",
            autocommit=True,
        )
    except ImportError:
        import psycopg2
        conn = psycopg2.connect(
            host=host, port=port, database=database,
            user=user, password=password, sslmode="require",
        )
        conn.autocommit = True
        return conn


def apply_migrations(host: str, database: str, port: int, user: str, password: str,
                     schema: str) -> None:
    from _migrations import (
        already_applied, ensure_migrations_table, file_sha256, record_applied,
    )

    log.info("Connecting to %s/%s as %s ...", host, database, user[:30])
    conn = _connect(host, database, port, user, password)
    try:
        cur = conn.cursor()
        cur.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema}"')
        ensure_migrations_table(cur, schema)
        applied = already_applied(cur, schema)

        ddl_files = _list_sql_files(DDL_DIR, exclude=DDL_EXCLUDE)
        seed_files = _list_sql_files(DML_SEED_DIR)

        for sql_file in ddl_files + seed_files:
            if sql_file.name in applied:
                log.info("  skip %s (already applied)", sql_file.name)
                continue
            log.info("  apply %s ...", sql_file.name)
            content = _transform_for_postgres(sql_file.read_text(encoding="utf-8"), schema)
            statements = _split_statements(content)
            for stmt in statements:
                try:
                    cur.execute(stmt)
                except Exception as exc:
                    msg = str(exc).lower()
                    if "duplicate key" in msg or "already exists" in msg:
                        continue
                    log.warning("    statement failed (continuing): %s", str(exc)[:200])
            record_applied(cur, schema, sql_file.name, file_sha256(sql_file))
            log.info("    -> %s applied (%d statements)", sql_file.name, len(statements))
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Step 6 -- push code from git for git-source apps
# ---------------------------------------------------------------------------

def push_code_from_git(app_name: str, branch: str, profile: Optional[str]) -> None:
    payload = {"git_source": {"branch": branch}}
    proc = _run_databricks(
        ["apps", "deploy", app_name, "--json", json.dumps(payload)],
        profile,
    )
    out = (proc.stdout or "") + (proc.stderr or "")
    if proc.returncode == 0:
        log.info("Triggered git-source deploy for %s (branch=%s)", app_name, branch)
    else:
        log.error("git-source deploy failed: %s", out.strip())
        raise SystemExit(2)


# ---------------------------------------------------------------------------
# Step 7 -- wait for app RUNNING
# ---------------------------------------------------------------------------

def wait_for_running(app_name: str, profile: Optional[str], timeout_s: int = 600) -> None:
    deadline = time.time() + timeout_s
    last_state = ""
    while time.time() < deadline:
        proc = _run_databricks(["apps", "get", app_name], profile)
        if proc.returncode == 0:
            try:
                info = json.loads(proc.stdout)
            except json.JSONDecodeError:
                info = {}
            state = ((info.get("app_status") or {}).get("state")
                     or (info.get("compute_status") or {}).get("state"))
            if state and state != last_state:
                log.info("App %s state: %s", app_name, state)
                last_state = state
            if state == "RUNNING":
                log.info("App %s is RUNNING (%s)", app_name, info.get("url"))
                return
            if state and state.upper() in ("FAILED", "ERROR"):
                raise RuntimeError(f"app {app_name} entered terminal state {state}")
        time.sleep(5)
    raise RuntimeError(f"app {app_name} never reached RUNNING within {timeout_s}s")


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------

def _load_user_config() -> dict:
    """Read user-config.yaml from the project root, returning {} on any error."""
    cfg_path = PROJECT_ROOT / "user-config.yaml"
    if not cfg_path.exists():
        return {}
    try:
        import yaml  # type: ignore
    except ImportError:
        log.warning("PyYAML not installed; cannot default args from user-config.yaml")
        return {}
    try:
        return yaml.safe_load(cfg_path.read_text()) or {}
    except Exception as exc:
        log.warning("Could not parse user-config.yaml: %s", exc)
        return {}


def _load_bundle_variable_defaults() -> dict:
    """Extract the `variables.*.default` block from databricks.yml.

    Used as the fallback source of truth when user-config.yaml is absent --
    i.e. when an installer runs `./scripts/deploy.sh -p <profile>` from a
    fresh `git clone` and has never invoked `vibe2value install` to render
    a personalised user-config.yaml. The canonical databricks.yml ships with
    safe defaults for every required value (instance name, schema, catalog,
    app name), so a zero-config install is fully resolved from the bundle
    file alone.

    Returns ``{}`` if databricks.yml is missing or unparseable; the caller
    falls back further to argparse-level defaults / hard-coded constants.
    """
    bundle_path = PROJECT_ROOT / "databricks.yml"
    if not bundle_path.exists():
        return {}
    try:
        import yaml  # type: ignore
    except ImportError:
        return {}
    try:
        bundle = yaml.safe_load(bundle_path.read_text()) or {}
    except Exception as exc:
        log.warning("Could not parse databricks.yml: %s", exc)
        return {}
    out: dict = {}
    for var_name, var_spec in (bundle.get("variables") or {}).items():
        if isinstance(var_spec, dict) and "default" in var_spec:
            out[var_name] = var_spec["default"]
    return out


# Canonical hard-coded defaults that match the committed databricks.yml.
# These are a third-tier fallback used if both user-config.yaml AND
# databricks.yml are unreadable -- e.g. someone runs post_deploy.py manually
# from a stripped-down checkout. Keep these in sync with databricks.yml's
# `variables.*.default` block.
_CANONICAL_DEFAULTS = {
    "app_name": "vibe-coding-workshop-app",
    "lakebase_instance_name": "vibe-coding-workshop-lakebase",
    "lakebase_branch": "main",
    "lakebase_schema": "vibe_coding_workshop",
    "lakebase_catalog": "vibe_coding_workshop_catalog",
    "lakebase_database": "databricks_postgres",
}


def _resolved_default(user_cfg_section: dict, user_cfg_key: str,
                      bundle_var_defaults: dict, bundle_var_key: str,
                      canonical_key: str) -> str:
    """Pick the first non-empty value from user-config -> bundle defaults -> canonical."""
    for source in (
        user_cfg_section.get(user_cfg_key) if user_cfg_section else None,
        bundle_var_defaults.get(bundle_var_key),
        _CANONICAL_DEFAULTS.get(canonical_key),
    ):
        if source:
            return str(source)
    return ""


def main(argv: list[str]) -> int:
    # Layered defaults (first non-empty wins):
    #   1. user-config.yaml (set by `./vibe2value install` for customised forks)
    #   2. databricks.yml -> variables.*.default (canonical commit fallback)
    #   3. _CANONICAL_DEFAULTS hard-coded (last-resort fallback)
    # This makes `./scripts/deploy.sh -p <profile>` work end-to-end from a
    # fresh `git clone` with zero local config files.
    cfg = _load_user_config()
    cfg_app = cfg.get("app", {}) or {}
    cfg_lb = cfg.get("lakebase", {}) or {}
    cfg_ws = cfg.get("workspace", {}) or {}
    bundle_vars = _load_bundle_variable_defaults()

    default_app_name = (
        cfg_app.get("name")
        or os.environ.get("APP_NAME")
        or bundle_vars.get("app_name")
        or _CANONICAL_DEFAULTS["app_name"]
    )
    default_project = _resolved_default(
        cfg_lb, "instance_name", bundle_vars, "lakebase_instance_name", "lakebase_instance_name",
    )
    default_schema = _resolved_default(
        cfg_lb, "schema", bundle_vars, "lakebase_schema", "lakebase_schema",
    )
    default_catalog = _resolved_default(
        cfg_lb, "catalog", bundle_vars, "lakebase_catalog", "lakebase_catalog",
    )
    default_database = _resolved_default(
        cfg_lb, "database", bundle_vars, "lakebase_database", "lakebase_database",
    )

    p = argparse.ArgumentParser(description="Finalize a vibe-coding-workshop install after `databricks bundle deploy`.")
    p.add_argument("--app-name", default=default_app_name)
    p.add_argument("--project", default=default_project,
                   help="Lakebase project name (e.g. vibe-coding-workshop-lakebase)")
    p.add_argument("--branch", default="main", help="Lakebase branch (default: main)")
    p.add_argument("--catalog", default=default_catalog,
                   help="Unity Catalog name to grant SP ALL_PRIVILEGES on (omit to skip)")
    p.add_argument("--schema", default=default_schema,
                   help="Postgres schema to seed (e.g. vibe_coding_workshop)")
    p.add_argument("--database", default=default_database)
    p.add_argument("--port", type=int, default=5432)
    p.add_argument("--profile", default=cfg_ws.get("profile") or os.environ.get("DATABRICKS_CONFIG_PROFILE") or None,
                   help="Databricks CLI profile")
    p.add_argument("--git-branch", default=cfg_app.get("git_repo_branch", "main"),
                   help="Git branch to deploy from (git-source apps only)")
    p.add_argument("--no-code-push", action="store_true",
                   help="Skip the apps deploy --json git_source step (workspace-source apps)")
    p.add_argument("--no-wait", action="store_true",
                   help="Skip waiting for the app to reach RUNNING")
    p.add_argument("--no-migrate", action="store_true",
                   help="Skip DDL/seed application (use for permissions-only re-runs)")
    p.add_argument("--connect-as-user", action="store_true",
                   help="Open the psycopg connection as the deployer instead of the app SP "
                        "(useful when running locally with personal CLI auth)")
    args = p.parse_args(argv)

    missing = [name for name in ("app_name", "project", "schema") if not getattr(args, name)]
    if missing:
        log.error("Missing required value(s): %s. Pass via flags or set in user-config.yaml.",
                  ", ".join(f"--{m.replace('_', '-')}" for m in missing))
        return 2

    log.info("post_deploy starting (app=%s project=%s branch=%s schema=%s)",
             args.app_name, args.project, args.branch, args.schema)

    # Step 1
    info = get_app_service_principal(args.app_name, args.profile)
    sp_client_id = info["service_principal_client_id"]
    log.info("App SP client_id: %s", sp_client_id)

    # Step 2
    grant_uc_catalog_all_privileges(args.catalog, sp_client_id, args.profile)

    # Step 3
    grant_lakebase_roles(args.project, args.branch, sp_client_id, args.profile)

    # Step 4
    endpoint_resource, host = resolve_endpoint_host(args.project, args.branch, args.profile)
    log.info("Lakebase host: %s (endpoint=%s)", host, endpoint_resource)

    # Step 5
    if args.no_migrate:
        log.info("Skipping DDL/seed (--no-migrate)")
    else:
        if args.connect_as_user:
            user = get_current_user(args.profile)
        else:
            user = sp_client_id
        token = generate_database_credential(endpoint_resource, args.profile)
        apply_migrations(
            host=host,
            database=args.database,
            port=args.port,
            user=user,
            password=token,
            schema=args.schema,
        )

    # Step 6
    is_git_source = bool(info.get("active_deployment", {}).get("source_code_path") is None
                         and info.get("git_repository"))
    if args.no_code_push:
        log.info("Skipping git-source code push (--no-code-push)")
    elif is_git_source or info.get("git_repository"):
        push_code_from_git(args.app_name, args.git_branch, args.profile)
    else:
        log.info("App is workspace-source; not triggering git_source deploy")

    # Step 7
    if args.no_wait:
        log.info("Not waiting for RUNNING (--no-wait)")
    else:
        wait_for_running(args.app_name, args.profile)

    log.info("post_deploy finished successfully.")
    return 0


if __name__ == "__main__":
    # Make `_migrations` importable even when invoked from the project root.
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    sys.exit(main(sys.argv[1:]))
