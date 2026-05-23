"""
Runtime DDL/seed application for the vibe-coding-workshop app.

Called from the FastAPI lifespan handler (app.py). Reads the platform-injected
PG* environment variables, mints a Lakebase Autoscaling OAuth token via the
Databricks SDK, then applies every `db/lakebase/ddl/*.sql` and
`db/lakebase/dml_seed/*.sql` exactly once -- gated by a `<schema>._migrations`
ledger so subsequent cold starts are no-ops.

This is the runtime counterpart of the legacy ``scripts/post_deploy.py``. Both
share the same SQL files and the same ledger schema, so an install that
started with the legacy imperative flow can be re-deployed onto the new
declarative flow (or vice versa) without re-running migrations or losing
seeded data.

The function is designed to NEVER raise from the lifespan path: every failure
mode logs a clear warning and returns a structured "ready=False" result so
``/health`` stays green and the React shell can poll ``/health/lakebase`` for
data-tier readiness. The platform-level health check ("is the Apps container
up?") and the data-tier health check ("can we run queries?") are kept
intentionally separate, mirroring the way the previous Option-B install
exposed those two signals.
"""

from __future__ import annotations

import hashlib
import logging
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

logger = logging.getLogger("migrations")

# Project root layout -- src/backend/migrations.py -> .../vibe-coding-workshop-app
_BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = _BACKEND_DIR.parent.parent
DDL_DIR = PROJECT_ROOT / "db" / "lakebase" / "ddl"
DML_SEED_DIR = PROJECT_ROOT / "db" / "lakebase" / "dml_seed"

# DDL files that target Unity Catalog rather than Lakebase Postgres.
DDL_EXCLUDE = {"apply_tags"}

_SCHEMA_RE_CATALOG = re.compile(r"\$\{catalog\}\.\$\{schema\}\.")
_SCHEMA_RE = re.compile(r"\$\{schema\}")


# ---------------------------------------------------------------------------
# Public result type
# ---------------------------------------------------------------------------

@dataclass
class MigrationResult:
    """Outcome of a single ``apply_pending_migrations`` invocation.

    The lifespan handler stores this on ``app.state`` and the
    ``/health/lakebase`` endpoint surfaces it so attendees / operators can
    tell at a glance whether the data tier is ready, and if not, why.
    """

    ready: bool
    applied: list[str]
    skipped: list[str]
    failed: list[str]
    reason: str = ""


# ---------------------------------------------------------------------------
# Migration ledger primitives (intentionally inline -- avoids a hard import
# dependency on ``scripts/_migrations.py`` from the runtime path).
# ---------------------------------------------------------------------------

def _file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(64 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _ensure_migrations_table(cursor, schema: str) -> None:
    cursor.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema}"')
    cursor.execute(
        f'''
        CREATE TABLE IF NOT EXISTS "{schema}"._migrations (
            filename   TEXT PRIMARY KEY,
            sha256     TEXT NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            applied_by TEXT NOT NULL DEFAULT CURRENT_USER
        )
        '''
    )


def _already_applied(cursor, schema: str) -> set[str]:
    cursor.execute(f'SELECT filename FROM "{schema}"._migrations')
    return {row[0] for row in cursor.fetchall()}


def _record_applied(cursor, schema: str, filename: str, sha256: str) -> None:
    cursor.execute(
        f'''
        INSERT INTO "{schema}"._migrations (filename, sha256)
        VALUES (%s, %s)
        ON CONFLICT (filename) DO UPDATE
            SET sha256     = EXCLUDED.sha256,
                applied_at = CURRENT_TIMESTAMP,
                applied_by = CURRENT_USER
        ''',
        (filename, sha256),
    )


# ---------------------------------------------------------------------------
# SQL preprocessing -- mirrors scripts/post_deploy.py exactly so installs
# performed under either flow yield byte-identical Postgres state.
# ---------------------------------------------------------------------------

def _transform_for_postgres(sql: str, schema: str) -> str:
    sql = _SCHEMA_RE_CATALOG.sub(f"{schema}.", sql)
    sql = _SCHEMA_RE.sub(schema, sql)
    sql = sql.replace("current_timestamp()", "CURRENT_TIMESTAMP")
    sql = sql.replace("current_user()", "CURRENT_USER")
    return sql


def _split_statements(sql: str) -> list[str]:
    """Split on top-level semicolons; respect strings, parens, line comments."""
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
    return [
        f for f in sorted(directory.glob("*.sql"))
        if not any(p in f.name for p in exclude)
    ]


# ---------------------------------------------------------------------------
# Connection helpers
# ---------------------------------------------------------------------------

def _generate_autoscaling_password() -> Optional[str]:
    """Mint a fresh Lakebase Autoscaling token via the SDK.

    Returns None when ENDPOINT_NAME is unset (provisioned-mode install) or
    the SDK call fails. Callers should treat None as "use PGPASSWORD if set,
    otherwise abort."
    """
    endpoint_name = os.environ.get("ENDPOINT_NAME", "").strip()
    if not endpoint_name:
        return None
    try:
        from databricks.sdk import WorkspaceClient
        client = WorkspaceClient()
        cred = client.postgres.generate_database_credential(endpoint=endpoint_name)
        return cred.token
    except Exception as exc:
        logger.warning(
            "Could not mint Lakebase token via generate_database_credential(%s): %s",
            endpoint_name, exc,
        )
        return None


def _connect(host: str, port: int, database: str, user: str,
             password: str, sslmode: str):
    """Open an autocommit connection -- prefer psycopg3, fall back to psycopg2."""
    try:
        import psycopg
        return psycopg.connect(
            host=host, port=port, dbname=database,
            user=user, password=password, sslmode=sslmode or "require",
            autocommit=True,
        )
    except ImportError:
        import psycopg2
        conn = psycopg2.connect(
            host=host, port=port, database=database,
            user=user, password=password, sslmode=sslmode or "require",
        )
        conn.autocommit = True
        return conn


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def apply_pending_migrations() -> MigrationResult:
    """Apply unapplied DDL + seed SQL files; safe to call on every cold start.

    Reads connection details from the platform-injected PG* env vars
    (PGHOST/PGUSER/PGDATABASE/PGPORT/PGSSLMODE), mints a fresh OAuth token via
    the Databricks SDK using ENDPOINT_NAME, then applies every SQL file in
    ``db/lakebase/ddl/`` and ``db/lakebase/dml_seed/`` whose filename is not
    yet present in the ``<schema>._migrations`` ledger. Records each applied
    file with its SHA-256 fingerprint and CURRENT_USER stamp.

    Never raises -- all failures are returned in the ``failed`` list and
    annotated in ``reason``. Callers should attach the returned
    MigrationResult to ``app.state`` so the /health/lakebase endpoint can
    report it.
    """
    host = os.environ.get("PGHOST", "").strip() or os.environ.get("LAKEBASE_HOST", "").strip()
    user = os.environ.get("PGUSER", "").strip() or os.environ.get("DATABRICKS_CLIENT_ID", "").strip()
    database = os.environ.get("PGDATABASE", "").strip() or os.environ.get("LAKEBASE_DATABASE", "databricks_postgres").strip()
    port_str = os.environ.get("PGPORT", "").strip() or os.environ.get("LAKEBASE_PORT", "5432").strip()
    sslmode = os.environ.get("PGSSLMODE", "").strip() or "require"
    schema = os.environ.get("LAKEBASE_SCHEMA", "").strip()

    if not host:
        return MigrationResult(
            ready=False, applied=[], skipped=[], failed=[],
            reason="PGHOST not set -- Apps platform has not yet bound the postgres resource.",
        )
    if not schema:
        return MigrationResult(
            ready=False, applied=[], skipped=[], failed=[],
            reason="LAKEBASE_SCHEMA not set -- check app.yaml.",
        )
    if not user:
        return MigrationResult(
            ready=False, applied=[], skipped=[], failed=[],
            reason="PGUSER / DATABRICKS_CLIENT_ID not set -- service principal identity unavailable.",
        )

    try:
        port = int(port_str)
    except ValueError:
        port = 5432

    password = (
        os.environ.get("PGPASSWORD", "").strip()
        or _generate_autoscaling_password()
        or ""
    )
    if not password:
        return MigrationResult(
            ready=False, applied=[], skipped=[], failed=[],
            reason=("Could not obtain a Lakebase password "
                    "(PGPASSWORD unset, ENDPOINT_NAME absent or SDK call failed)."),
        )

    ddl_files = _list_sql_files(DDL_DIR, exclude=DDL_EXCLUDE)
    seed_files = _list_sql_files(DML_SEED_DIR)
    candidates = ddl_files + seed_files
    if not candidates:
        return MigrationResult(
            ready=True, applied=[], skipped=[], failed=[],
            reason="No DDL/seed files found on disk.",
        )

    logger.info(
        "Applying Lakebase migrations: host=%s db=%s user=%s schema=%s "
        "(%d candidate files)",
        host[:40], database, user[:20], schema, len(candidates),
    )

    applied: list[str] = []
    skipped: list[str] = []
    failed: list[str] = []

    try:
        conn = _connect(host, port, database, user, password, sslmode)
    except Exception as exc:
        logger.warning("Could not open Lakebase connection: %s", exc)
        return MigrationResult(
            ready=False, applied=[], skipped=[], failed=[],
            reason=f"Lakebase connection failed: {exc}",
        )

    try:
        cur = conn.cursor()
        _ensure_migrations_table(cur, schema)
        already = _already_applied(cur, schema)

        for sql_file in candidates:
            if sql_file.name in already:
                skipped.append(sql_file.name)
                continue
            content = _transform_for_postgres(sql_file.read_text(encoding="utf-8"), schema)
            statements = _split_statements(content)
            file_failed = False
            for stmt in statements:
                try:
                    cur.execute(stmt)
                except Exception as exc:
                    msg = str(exc).lower()
                    if "duplicate key" in msg or "already exists" in msg:
                        # Idempotent retry: row already seeded, table already exists.
                        continue
                    logger.warning(
                        "Statement in %s failed (continuing): %s",
                        sql_file.name, str(exc)[:200],
                    )
                    file_failed = True
            if file_failed:
                failed.append(sql_file.name)
            else:
                _record_applied(cur, schema, sql_file.name, _file_sha256(sql_file))
                applied.append(sql_file.name)
                logger.info("Applied %s (%d statements)", sql_file.name, len(statements))
    finally:
        try:
            conn.close()
        except Exception:
            pass

    summary = (
        f"applied={len(applied)} skipped={len(skipped)} failed={len(failed)}"
    )
    logger.info("Lakebase migrations complete: %s", summary)
    return MigrationResult(
        ready=not failed,
        applied=applied,
        skipped=skipped,
        failed=failed,
        reason="" if not failed else f"{len(failed)} file(s) failed; see logs.",
    )
