#!/usr/bin/env python3
"""
vibe2value CLI - Installer and deployment tool for Vibe Coding Workshop App.

Commands:
    install     Interactive first-time setup and deploy
    configure   Regenerate config files from templates (no deploy)
    deploy      Deploy code changes (default: code-only)
    doctor      Validate prerequisites and configuration
    uninstall   Tear down all provisioned resources
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = PROJECT_ROOT / "user-config.yaml"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from brand_extractor import extract_brand_assets, hex_to_hsl

# ---------------------------------------------------------------------------
# Cross-platform subprocess helpers
# ---------------------------------------------------------------------------
# On Windows, `subprocess.run(["npm", ...], shell=False)` raises FileNotFoundError
# because `npm` is `npm.cmd` and CreateProcessW does not consult PATHEXT.
# Resolving the command via `shutil.which()` returns the full path including the
# real extension, which CreateProcessW accepts.
#
# Bash scripts cannot be executed natively by Windows; we explicitly invoke them
# through bash (Git Bash on Windows, /bin/bash on POSIX) so the shebang doesn't
# matter to the OS loader.

IS_WINDOWS = os.name == "nt"


def _resolve_exe(name: str):
    """Return the full path of `name` on PATH, honoring Windows PATHEXT."""
    return shutil.which(name)


def _find_bash():
    """Return the path to bash for invoking .sh scripts, or None.

    On POSIX we prefer /bin/bash to mirror the existing `#!/bin/bash` shebang
    behavior exactly, falling back to PATH lookup only if /bin/bash is absent
    (e.g. NixOS-style installs). On Windows we use shutil.which("bash") which
    finds Git Bash via PATH.
    """
    if not IS_WINDOWS:
        if Path("/bin/bash").exists():
            return "/bin/bash"
        return shutil.which("bash")
    return shutil.which("bash")


def _run_cmd(argv, **kwargs):
    """subprocess.run wrapper that resolves argv[0] to a full path.

    On POSIX this is functionally equivalent to subprocess.run(argv, ...) since
    execvp does its own PATH lookup. On Windows it makes .cmd / .bat shims like
    npm.cmd executable through CreateProcessW (which does not search PATHEXT).
    """
    resolved = _resolve_exe(argv[0]) or argv[0]
    return subprocess.run([resolved, *argv[1:]], **kwargs)


def _run_sh(script_path, script_args, **kwargs):
    """Run a .sh script via bash on any OS.

    Always invokes bash explicitly so the script runs on Windows where the
    OS loader cannot honor the shebang.
    """
    bash = _find_bash()
    if not bash:
        msg = (
            "bash not found. On Windows install Git for Windows "
            "(winget install Git.Git) and reopen your terminal."
            if IS_WINDOWS
            else "bash not found at /bin/bash or on PATH."
        )
        raise RuntimeError(msg)
    return subprocess.run([bash, str(script_path), *script_args], **kwargs)

# Tag all Databricks CLI calls with the workshop identity for centralized tracking
_version_file = PROJECT_ROOT / "VERSION"
os.environ.setdefault(
    "DATABRICKS_USER_AGENT_EXTRA",
    f"vibe-to-value-workshop/{_version_file.read_text().strip() if _version_file.is_file() else '0.0.0'}",
)
TEMPLATES = {
    "app.yaml": PROJECT_ROOT / "app.yaml.template",
    "databricks.yml": PROJECT_ROOT / "databricks.yml.template",
    "seed_sql": PROJECT_ROOT / "db" / "lakebase" / "dml_seed" / "03_seed_workshop_parameters.sql.template",
}

GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
RED = "\033[0;31m"
BLUE = "\033[0;34m"
CYAN = "\033[0;36m"
BOLD = "\033[1m"
NC = "\033[0m"


def info(msg):
    print(f"{CYAN}> {msg}{NC}")


def success(msg):
    print(f"{GREEN}  [ok] {msg}{NC}")


def warn(msg):
    print(f"{YELLOW}  [warn] {msg}{NC}")


def error(msg):
    print(f"{RED}  [error] {msg}{NC}")


def header(msg):
    print(f"\n{BOLD}{BLUE}{'=' * 60}{NC}")
    print(f"{BOLD}{BLUE}  {msg}{NC}")
    print(f"{BOLD}{BLUE}{'=' * 60}{NC}\n")


def step(current: int, total: int, msg: str):
    bar_width = 30
    filled = int(bar_width * current / total)
    bar = f"{'█' * filled}{'░' * (bar_width - filled)}"
    print(f"\n{BOLD}{CYAN}  [{current}/{total}] {bar} {msg}{NC}\n")


# ---------------------------------------------------------------------------
# YAML helpers (no pyyaml dependency -- simple key: value parsing)
# ---------------------------------------------------------------------------

def load_config() -> dict:
    """Load user-config.yaml into a nested dict."""
    if not CONFIG_PATH.exists():
        return {}
    config = {}
    current_section = None
    with open(CONFIG_PATH) as f:
        for line in f:
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            if stripped.endswith(":") and not stripped.startswith("-"):
                current_section = stripped[:-1].strip()
                config[current_section] = {}
            elif ":" in stripped and current_section is not None:
                key, _, value = stripped.partition(":")
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if value == "[]":
                    value = []
                config[current_section][key] = value
    return config


def save_config(config: dict):
    """Write config dict back to user-config.yaml."""
    lines = [
        "# =============================================================================",
        "# Vibe Coding Workshop - User Configuration",
        "# =============================================================================",
        "# Generated by vibe2value. Edit values here, then run:",
        "#   ./vibe2value configure    (regenerate config files)",
        "#   ./vibe2value deploy       (push code changes)",
        "#   ./vibe2value deploy --full (full infrastructure deploy)",
        "# =============================================================================",
        "",
    ]
    for section, values in config.items():
        lines.append(f"{section}:")
        if isinstance(values, dict):
            for k, v in values.items():
                if isinstance(v, list):
                    lines.append(f'  {k}: []')
                else:
                    lines.append(f'  {k}: "{v}"')
        lines.append("")
    with open(CONFIG_PATH, "w") as f:
        f.write("\n".join(lines) + "\n")


def get_placeholder_map(config: dict) -> dict:
    """Map __PLACEHOLDER__ tokens to config values."""
    ws = config.get("workspace", {})
    lb = config.get("lakebase", {})
    app = config.get("app", {})
    user = config.get("user", {})
    tags = config.get("tags", {})
    meta = config.get("_metadata", {})
    branding = config.get("branding", {})
    target = meta.get("target", "development")
    return {
        "__WORKSPACE_HOST__": ws.get("host", ""),
        "__WORKSPACE_URL__": ws.get("host", "").rstrip("/") + "/",
        "__WORKSPACE_ORG_ID__": ws.get("org_id", ""),
        "__LAKEBASE_INSTANCE_NAME__": lb.get("instance_name", ""),
        "__LAKEBASE_CATALOG__": lb.get("catalog", ""),
        "__LAKEBASE_SCHEMA__": lb.get("schema", ""),
        "__LAKEBASE_HOST__": "",  # discovered at deploy time
        "__LAKEBASE_USER__": user.get("email", ""),
        "__LAKEBASE_UC_CATALOG__": lb.get("uc_catalog", lb.get("catalog", "") + "_lakebase"),
        "__APP_NAME__": app.get("name", ""),
        "__SERVING_ENDPOINT__": app.get("serving_endpoint", "databricks-claude-sonnet-4-5"),
        "__DEFAULT_WAREHOUSE__": lb.get("warehouse", ""),
        "__ENDPOINT_NAME__": lb.get("endpoint_name", ""),
        "__LAKEBASE_MODE__": lb.get("mode", "autoscaling"),
        "__TAG_PROJECT__": tags.get("project", "vibe_coding_workshop"),
        "__TAG_ENVIRONMENT__": tags.get("environment", "") or target,
        "__TAG_MANAGED_BY__": tags.get("managed_by", "vibe2value"),
        "__TAG_CUSTOM__": tags.get("custom_tags", ""),
        "__DEPLOYER_EMAIL__": user.get("email", ""),
        "__INSTALLER_VERSION__": meta.get("installer_version", "1.0.0"),
        "__COMPANY_BRAND_URL__": branding.get("customer_url", ""),
    }


# ---------------------------------------------------------------------------
# Template rendering
# ---------------------------------------------------------------------------

def render_template(template_path: Path, output_path: Path, placeholders: dict,
                    flags: dict | None = None):
    """Replace __PLACEHOLDER__ tokens and process conditional blocks.

    Conditional blocks use the syntax:
        # __IF_FLAG_NAME__
        ... content ...
        # __ENDIF_FLAG_NAME__

    If flags["FLAG_NAME"] is truthy, the content (and markers) are kept.
    If falsy, the entire block including markers is removed.
    """
    content = template_path.read_text()
    if flags:
        import re as _re
        for flag_name, enabled in flags.items():
            pattern = (
                rf"^[^\S\n]*#\s*__IF_{flag_name}__\s*\n"
                rf"(.*?)"
                rf"^[^\S\n]*#\s*__ENDIF_{flag_name}__\s*\n"
            )
            if enabled:
                content = _re.sub(pattern, r"\1", content, flags=_re.MULTILINE | _re.DOTALL)
            else:
                content = _re.sub(pattern, "", content, flags=_re.MULTILINE | _re.DOTALL)
    for token, value in placeholders.items():
        content = content.replace(token, value)
    output_path.write_text(content)
    return output_path


# ---------------------------------------------------------------------------
# Prerequisites
# ---------------------------------------------------------------------------

MIN_DATABRICKS_CLI_VERSION = (0, 287, 0)


def _which_any(*names):
    """Return (canonical_name, full_path) for the first name found on PATH, else None."""
    for n in names:
        path = shutil.which(n)
        if path:
            return n, path
    return None


def check_prerequisites() -> bool:
    """Check that required tools are installed."""
    all_ok = True
    # On POSIX we keep the strict python3-only requirement (today's behavior).
    # On Windows the python.org / winget installer ships only `python.exe`, so
    # we accept either name there.
    python_names = ("python3", "python") if IS_WINDOWS else ("python3",)
    checks = [
        (python_names, "Python 3"),
        (("node",), "Node.js"),
        (("npm",), "npm"),
        (("databricks",), "Databricks CLI"),
    ]
    for names, label in checks:
        found = _which_any(*names)
        if not found:
            error(f"{label}: NOT FOUND")
            all_ok = False
            continue
        cmd_used, _ = found
        version = ""
        try:
            # _run_cmd resolves Windows .cmd shims (e.g. npm -> npm.cmd) so the
            # version probe doesn't silently fail on Windows.
            result = _run_cmd([cmd_used, "--version"], capture_output=True, text=True, timeout=10)
            version = result.stdout.strip().split("\n")[0] if result.stdout else ""
        except Exception:
            pass
        success(f"{label}: {version}")

        if cmd_used == "databricks" and version:
            import re as _re
            m = _re.search(r"v?(\d+)\.(\d+)\.(\d+)", version)
            if m:
                cli_ver = tuple(int(x) for x in m.groups())
                if cli_ver < MIN_DATABRICKS_CLI_VERSION:
                    min_str = ".".join(str(x) for x in MIN_DATABRICKS_CLI_VERSION)
                    error(
                        f"Databricks CLI {version} is too old. "
                        f"Lakebase Autoscaling requires v{min_str}+. "
                        f"Update with: brew upgrade databricks  (macOS) "
                        f"or  curl -fsSL https://raw.githubusercontent.com/databricks/setup-cli/main/install.sh | sh"
                    )
                    all_ok = False

    # Windows-only: the deploy pipeline shells out to bash scripts via _run_sh.
    # Surface a clear error early instead of a cryptic FileNotFoundError later.
    if IS_WINDOWS:
        if _find_bash():
            success("bash: found (Git Bash)")
        else:
            error(
                "bash: NOT FOUND. Install Git for Windows: "
                "winget install Git.Git  "
                "(or run: powershell -ExecutionPolicy Bypass -File scripts\\install-prerequisites.ps1)"
            )
            all_ok = False

    return all_ok


def check_auth(profile: str = "") -> dict:
    """Check Databricks CLI authentication, return user info."""
    cmd = ["databricks", "current-user", "me", "--output", "json"]
    if profile:
        cmd.extend(["--profile", profile])
    try:
        result = _run_cmd(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            user_info = json.loads(result.stdout)
            return user_info
    except Exception:
        pass
    return {}


def discover_profile(host: str) -> str:
    """Find the Databricks CLI profile that matches a workspace host URL.

    When multiple profiles point to the same host, prefer a named profile
    over the generic 'DEFAULT' profile.
    """
    try:
        result = _run_cmd(
            ["databricks", "auth", "profiles", "--output", "json"],
            capture_output=True, text=True, timeout=15,
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            profiles = data.get("profiles", data) if isinstance(data, dict) else data
            host_clean = host.rstrip("/").lower()
            matches = []
            for p in profiles:
                p_host = (p.get("host", "") or "").rstrip("/").lower()
                if p_host == host_clean:
                    matches.append(p.get("name", ""))
            if matches:
                named = [m for m in matches if m.upper() != "DEFAULT"]
                return named[0] if named else matches[0]
    except Exception:
        pass
    return ""



# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def _run_deploy(phase_flags: list, config: dict, label: str, step_num: int,
                total: int) -> int:
    """Run deploy.sh with the given flags. Returns exit code."""
    deploy_sh = PROJECT_ROOT / "scripts" / "deploy.sh"
    target = config.get("_metadata", {}).get("target", "user")
    profile = config.get("workspace", {}).get("profile", "")
    args = ["--target", target] + phase_flags
    if profile:
        args.extend(["--profile", profile])
    result = _run_sh(deploy_sh, args, cwd=PROJECT_ROOT)
    if result.returncode != 0:
        print()
        header("INSTALL FAILED")
        error(f"Failed at step {step_num}/{total}: {label}")
        print(f"  Your configuration is saved in {CYAN}user-config.yaml{NC}.")
        print(f"  Fix the issue above, then run {CYAN}./vibe2value deploy --full{NC} to retry.")
        print()
        sys.exit(result.returncode)
    return result.returncode


def cmd_install(args):
    """Interactive first-time setup and deploy."""
    TOTAL = 7
    header("VIBE2VALUE INSTALL")

    # ── Step 1: Prerequisites ─────────────────────────────────────────
    step(1, TOTAL, "Checking prerequisites")
    if not check_prerequisites():
        error("Missing prerequisites. Please install the tools above and retry.")
        sys.exit(1)

    # ── Step 2: Workspace URL ─────────────────────────────────────────
    step(2, TOTAL, "Workspace connection")
    existing_config = load_config()
    default_host = existing_config.get("workspace", {}).get("host", "")

    if default_host:
        host = input(f"  Databricks workspace URL [{default_host}]: ").strip() or default_host
    else:
        host = input("  Databricks workspace URL: ").strip()

    if not host:
        error("Workspace URL is required.")
        sys.exit(1)
    host = host.rstrip("/")
    if not host.startswith("https://"):
        host = "https://" + host

    # ── Step 3: Authenticate ──────────────────────────────────────────
    step(3, TOTAL, "Authenticating")
    profile = existing_config.get("workspace", {}).get("profile", "")
    user_info = check_auth(profile) if profile else {}
    if not user_info:
        info("Opening browser for authentication...")
        auth_cmd = ["databricks", "auth", "login", "--host", host]
        _run_cmd(auth_cmd)
        profile = discover_profile(host)
        user_info = check_auth(profile)

    if not user_info:
        error("Authentication failed. Run 'databricks auth login --host <URL>' manually.")
        sys.exit(1)

    email = user_info.get("userName", "")
    success(f"Authenticated as: {email}")
    if profile:
        success(f"Using CLI profile: {profile}")

    # ── Step 4: Configure resources ───────────────────────────────────
    step(4, TOTAL, "Configure resources")
    defaults = {
        "app_name": existing_config.get("app", {}).get("name", "vibe-coding-workshop-app"),
        "instance_name": existing_config.get("lakebase", {}).get("instance_name", "vibe-coding-workshop-lakebase"),
        "catalog": existing_config.get("lakebase", {}).get("catalog", "vibe_coding_workshop_catalog"),
        "schema": existing_config.get("lakebase", {}).get("schema", "vibe_coding_workshop"),
        "endpoint": existing_config.get("app", {}).get("serving_endpoint", "databricks-claude-sonnet-4-5"),
        "warehouse": existing_config.get("lakebase", {}).get("warehouse", ""),
        "lakebase_mode": existing_config.get("lakebase", {}).get("mode", "autoscaling"),
        "min_cu": existing_config.get("lakebase", {}).get("min_cu", "0.5"),
        "max_cu": existing_config.get("lakebase", {}).get("max_cu", "2"),
        "brand_url": existing_config.get("branding", {}).get("customer_url", ""),
    }

    while True:
        app_name = input(f"  App name [{defaults['app_name']}]: ").strip() or defaults["app_name"]
        if len(app_name) < 2 or len(app_name) > 30:
            print(f"  [error] App name must be 2-30 characters (got {len(app_name)}). Please try again.")
            continue
        if not all(c.isalnum() or c == '-' for c in app_name):
            print("  [error] App name can only contain letters, numbers, and hyphens. Please try again.")
            continue
        break

    # Lakebase mode selection
    default_mode = defaults["lakebase_mode"]
    mode_prompt = f"  Lakebase mode - (a)utoscaling or (p)rovisioned [{default_mode}]: "
    mode_input = input(mode_prompt).strip().lower()
    if mode_input in ("a", "autoscaling"):
        lakebase_mode = "autoscaling"
    elif mode_input in ("p", "provisioned"):
        lakebase_mode = "provisioned"
    else:
        lakebase_mode = default_mode

    instance_label = "Lakebase project" if lakebase_mode == "autoscaling" else "Lakebase instance"
    instance_name = input(f"  {instance_label} [{defaults['instance_name']}]: ").strip() or defaults["instance_name"]

    if lakebase_mode == "autoscaling":
        min_cu = input(f"  Min CU (minimum 0.5) [{defaults['min_cu']}]: ").strip() or defaults["min_cu"]
        max_cu = input(f"  Max CU [{defaults['max_cu']}]: ").strip() or defaults["max_cu"]
    else:
        min_cu = defaults["min_cu"]
        max_cu = defaults["max_cu"]

    catalog = input(f"  Catalog [{defaults['catalog']}]: ").strip() or defaults["catalog"]
    create_catalog = existing_config.get("lakebase", {}).get("create_catalog", "false").lower() == "true"
    endpoint = input(f"  Model endpoint [{defaults['endpoint']}]: ").strip() or defaults["endpoint"]

    # Optional: customer website URL for branding
    brand_url_input = (
        input(f"  Customer website URL for branding, e.g. www.databricks.com (optional) [{defaults['brand_url']}]: ").strip()
        or defaults["brand_url"]
    )
    brand_url = ""
    brand_extracted = {}
    if brand_url_input:
        url_candidate = brand_url_input if brand_url_input.startswith("http") else "https://" + brand_url_input
        info(f"Extracting brand assets from {url_candidate}...")
        try:
            brand_extracted = extract_brand_assets(url_candidate)
            if brand_extracted.get("company_name") or brand_extracted.get("logo_url") or brand_extracted.get("primary_color"):
                brand_url = url_candidate
                success(
                    f"Brand extracted: {brand_extracted.get('company_name', 'Unknown')} "
                    f"(logo: {'yes' if brand_extracted.get('logo_url') else 'no'}, "
                    f"colors: {'yes' if brand_extracted.get('primary_color') else 'no'})"
                )
            else:
                warn("Could not extract brand information from that URL. Skipping branding, using defaults.")
                brand_extracted = {}
        except Exception:
            warn("Could not reach or parse the website. Skipping branding, using defaults.")
            brand_extracted = {}

    # ── Step 5: Save configuration ────────────────────────────────────
    step(5, TOTAL, "Saving configuration & generating files")
    target = existing_config.get("_metadata", {}).get("target", "user")
    config = {
        "workspace": {
            "host": host,
            "profile": profile,
        },
        "lakebase": {
            "mode": lakebase_mode,
            "instance_name": instance_name,
            "catalog": catalog,
            "create_catalog": "true" if create_catalog else "false",
            "schema": defaults["schema"],
            "database": "databricks_postgres",
            "warehouse": defaults["warehouse"],
            "uc_catalog": catalog.replace("_catalog", "_lakebase") if "_catalog" in catalog else catalog + "_lakebase",
            "min_cu": min_cu,
            "max_cu": max_cu,
            "endpoint_name": "",
        },
        "app": {
            "name": app_name,
            "serving_endpoint": endpoint,
        },
        "user": {
            "email": email,
        },
        "tags": {
            "project": existing_config.get("tags", {}).get("project", "vibe_coding_workshop"),
            "environment": "",
            "managed_by": "vibe2value",
            "custom_tags": existing_config.get("tags", {}).get("custom_tags", ""),
        },
        "branding": {
            "customer_url": brand_url,
            "company_name": brand_extracted.get("company_name", ""),
            "logo_url": brand_extracted.get("logo_url", ""),
            "primary_color": brand_extracted.get("primary_color", ""),
            "secondary_color": brand_extracted.get("secondary_color", ""),
            "accent_color": brand_extracted.get("accent_color", ""),
        },
        "_metadata": {
            "installed_at": datetime.now(timezone.utc).isoformat(),
            "installer_version": "1.0.0",
            "target": target,
            "created_resources": [],
        },
    }

    save_config(config)
    success(f"Saved {CONFIG_PATH.name}")
    cmd_configure(args, config=config)

    # ── Step 6: Build frontend ────────────────────────────────────────
    step(6, TOTAL, "Building frontend")
    info("Running npm install...")
    npm_result = _run_cmd(["npm", "install"], cwd=PROJECT_ROOT, capture_output=True, text=True)
    if npm_result.returncode != 0:
        warn("npm install had issues, continuing...")
    info("Running npm build...")
    build_result = _run_cmd(["npm", "run", "build"], cwd=PROJECT_ROOT)
    if build_result.returncode != 0:
        error("Frontend build failed")
        sys.exit(1)
    success("Frontend built")

    # ── Step 7: Full deploy ─────────────────────────────────────────
    step(7, TOTAL, "Deploying to Databricks")
    info("Running full deployment (infrastructure, code, permissions, tables)...")
    info("This may take several minutes on first deploy...")
    _run_deploy([], config, "Full deploy", 7, TOTAL)
    success("Deployment complete")

    # ── Done ──────────────────────────────────────────────────────────
    print()
    header("INSTALL COMPLETE")
    step(TOTAL, TOTAL, "Done!")
    print(f"  {GREEN}All {TOTAL} steps completed successfully.{NC}")
    print()
    print(f"  {BOLD}Next time you make changes:{NC}")
    print(f"    {CYAN}./vibe2value deploy{NC}        Code-only deploy")
    print(f"    {CYAN}./vibe2value deploy --full{NC}  Full infrastructure deploy")
    print(f"    {CYAN}./vibe2value doctor{NC}         Validate your setup")
    print()


def cmd_configure(args, config=None):
    """Regenerate config files from templates."""
    if config is None:
        config = load_config()
    if not config:
        error("No user-config.yaml found. Run './vibe2value install' first.")
        sys.exit(1)

    info("Rendering config files from templates...")
    placeholders = get_placeholder_map(config)
    lb = config.get("lakebase", {})
    lakebase_mode = lb.get("mode", "autoscaling")
    flags = {
        "CREATE_CATALOG": lb.get("create_catalog", "true").lower() == "true",
        "LAKEBASE_PROVISIONED": lakebase_mode == "provisioned",
        "LAKEBASE_AUTOSCALING": lakebase_mode == "autoscaling",
    }

    rendered = []
    for name, tmpl_path in TEMPLATES.items():
        if not tmpl_path.exists():
            warn(f"Template not found: {tmpl_path.name}")
            continue
        if name == "seed_sql":
            out_path = tmpl_path.parent / tmpl_path.name.replace(".template", "")
        else:
            out_path = PROJECT_ROOT / name
        render_template(tmpl_path, out_path, placeholders, flags=flags)
        rendered.append(out_path.relative_to(PROJECT_ROOT))

    for r in rendered:
        success(f"Generated {r}")

    # Generate public/brand-config.json for frontend branding
    branding = config.get("branding", {})
    brand_config_path = PROJECT_ROOT / "public" / "brand-config.json"
    brand_config_path.parent.mkdir(parents=True, exist_ok=True)
    brand_json = {
        "company_name": branding.get("company_name", ""),
        "logo_url": branding.get("logo_url", ""),
        "primary_color": branding.get("primary_color", ""),
        "primary_color_hsl": hex_to_hsl(branding.get("primary_color", "")) if branding.get("primary_color") else "",
        "secondary_color": branding.get("secondary_color", ""),
        "secondary_color_hsl": hex_to_hsl(branding.get("secondary_color", "")) if branding.get("secondary_color") else "",
        "accent_color": branding.get("accent_color", ""),
        "accent_color_hsl": hex_to_hsl(branding.get("accent_color", "")) if branding.get("accent_color") else "",
    }
    brand_config_path.write_text(json.dumps(brand_json, indent=2) + "\n")
    success(f"Generated public/brand-config.json")
    print()


def cmd_deploy(args):
    """Deploy code changes. Default is code-only."""
    config = load_config()

    deploy_sh = PROJECT_ROOT / "scripts" / "deploy.sh"
    deploy_args = []

    # Determine target
    if config:
        ws = config.get("workspace", {})
        profile = ws.get("profile", "")

        meta = config.get("_metadata", {})
        target = getattr(args, "target", "") or meta.get("target", "") or "production"
        deploy_args.extend(["--target", target])
        if profile:
            deploy_args.extend(["--profile", profile])
    else:
        warn("No user-config.yaml found. Using deploy.sh defaults.")

    # Deploy mode
    if getattr(args, "full", False):
        pass  # Full deploy (no extra flags)
    elif getattr(args, "tables", False):
        deploy_args.append("--tables-only")
    elif getattr(args, "watch", False):
        deploy_args.append("--watch")
    else:
        deploy_args.append("--code-only")
        if getattr(args, "skip_build", False):
            deploy_args.append("--skip-build")

    info(f"Running: {deploy_sh} {' '.join(deploy_args)}")
    print()
    result = _run_sh(deploy_sh, deploy_args, cwd=PROJECT_ROOT)
    sys.exit(result.returncode)


def cmd_doctor(args):
    """Validate prerequisites and configuration."""
    header("VIBE2VALUE DOCTOR")
    all_ok = True

    # Prerequisites
    info("Checking prerequisites...")
    if not check_prerequisites():
        all_ok = False
    print()

    # Config file
    info("Checking configuration...")
    if CONFIG_PATH.exists():
        config = load_config()
        success(f"user-config.yaml exists")
        ws_host = config.get("workspace", {}).get("host", "")
        app_name = config.get("app", {}).get("name", "")
        if ws_host:
            success(f"Workspace: {ws_host}")
        else:
            warn("Workspace host not set")
            all_ok = False
        if app_name:
            success(f"App: {app_name}")
        else:
            warn("App name not set")
            all_ok = False
    else:
        warn("user-config.yaml not found (run './vibe2value install')")
        all_ok = False
    print()

    # Generated files
    info("Checking generated files...")
    for name in ["databricks.yml", "app.yaml"]:
        p = PROJECT_ROOT / name
        if p.exists():
            success(f"{name} exists")
        else:
            warn(f"{name} missing")
            all_ok = False
    print()

    # Databricks CLI auth
    info("Checking Databricks CLI authentication...")
    profile = ""
    if CONFIG_PATH.exists():
        config = load_config()
        profile = config.get("workspace", {}).get("profile", "")
    user_info = check_auth(profile)
    if user_info:
        success(f"Authenticated as: {user_info.get('userName', 'unknown')}")
    else:
        error("Not authenticated. Run 'databricks auth login --host <URL>'")
        all_ok = False
    print()

    if all_ok:
        print(f"{GREEN}{BOLD}All checks passed!{NC}")
    else:
        print(f"{YELLOW}{BOLD}Some checks failed. See warnings above.{NC}")

    return 0 if all_ok else 1


def cmd_uninstall(args):
    """Tear down all provisioned resources."""
    header("VIBE2VALUE UNINSTALL")

    config = load_config()
    if not config:
        error("No user-config.yaml found. Nothing to uninstall.")
        sys.exit(1)

    ws = config.get("workspace", {})
    app_cfg = config.get("app", {})
    lb = config.get("lakebase", {})
    meta = config.get("_metadata", {})

    print(f"  Workspace:  {ws.get('host', 'unknown')}")
    print(f"  App:        {app_cfg.get('name', 'unknown')}")
    print(f"  Instance:   {lb.get('instance_name', 'unknown')}")
    print(f"  Catalog:    {lb.get('catalog', 'unknown')}")
    print(f"  Schema:     {lb.get('schema', 'unknown')}")
    print()

    if getattr(args, "dry_run", False):
        info("DRY RUN: Would destroy the resources above. No changes made.")
        return

    if not getattr(args, "force", False):
        confirmation = input(f"  {RED}Type 'UNINSTALL' to confirm: {NC}")
        if confirmation != "UNINSTALL":
            print("  Aborted.")
            sys.exit(0)
    print()

    profile_flag = ["--profile", ws["profile"]] if ws.get("profile") else []

    # Step 1: Drop tables
    if not getattr(args, "keep_data", False):
        info("Step 1: Dropping Lakebase tables...")
        setup_lakebase_sh = PROJECT_ROOT / "scripts" / "setup-lakebase.sh"
        _run_sh(setup_lakebase_sh, ["--drop"], cwd=PROJECT_ROOT,
                env={**os.environ, "DATABRICKS_HOST": ws.get("host", "")})
    else:
        info("Step 1: Skipping table drop (--keep-data)")

    # Step 2: Delete app
    info("Step 2: Deleting Databricks App...")
    app_name = app_cfg.get("name", "")
    if app_name:
        del_cmd = ["databricks", "apps", "delete", app_name] + profile_flag
        _run_cmd(del_cmd, capture_output=True)
        success(f"Deleted app: {app_name}")

    # Step 3: Destroy bundle
    info("Step 3: Destroying DAB bundle...")
    target = meta.get("target", "production")
    destroy_cmd = ["databricks", "bundle", "destroy", "-t", target, "--auto-approve"] + profile_flag
    _run_cmd(destroy_cmd, cwd=PROJECT_ROOT, capture_output=True)
    success("Bundle destroyed")

    # Step 4: Clean local files and bundle state
    info("Step 4: Cleaning local generated files and bundle state...")
    bundle_state = PROJECT_ROOT / ".databricks"
    if bundle_state.exists():
        shutil.rmtree(bundle_state)
        success("Removed .databricks/ bundle state directory")

    generated_files = [
        CONFIG_PATH,
        PROJECT_ROOT / "databricks.yml",
        PROJECT_ROOT / "app.yaml",
        PROJECT_ROOT / "db" / "lakebase" / "dml_seed" / "03_seed_workshop_parameters.sql",
        PROJECT_ROOT / "public" / "brand-config.json",
    ]
    for f in generated_files:
        if f.exists():
            f.unlink()
            success(f"Removed {f.name}")

    print()
    header("UNINSTALL COMPLETE")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        prog="vibe2value",
        description="Installer and deployment tool for Vibe Coding Workshop App",
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # install
    p_install = subparsers.add_parser("install", help="Interactive first-time setup and deploy")
    p_install.add_argument("--target", "-t", default="", help="Deploy target")

    # configure
    subparsers.add_parser("configure", help="Regenerate config files from templates")

    # deploy
    p_deploy = subparsers.add_parser("deploy", help="Deploy code changes")
    p_deploy.add_argument("--full", action="store_true", help="Full infrastructure deploy")
    p_deploy.add_argument("--watch", "-w", action="store_true", help="Continuous sync mode")
    p_deploy.add_argument("--tables", action="store_true", help="Reseed database only")
    p_deploy.add_argument("--skip-build", action="store_true", help="Skip frontend build")
    p_deploy.add_argument("--target", "-t", default="", help="Deploy target")

    # doctor
    subparsers.add_parser("doctor", help="Validate prerequisites and configuration")

    # uninstall
    p_uninstall = subparsers.add_parser("uninstall", help="Tear down all provisioned resources")
    p_uninstall.add_argument("--force", action="store_true", help="Skip confirmation")
    p_uninstall.add_argument("--dry-run", action="store_true", help="Show what would be deleted")
    p_uninstall.add_argument("--keep-data", action="store_true", help="Preserve Lakebase tables")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    commands = {
        "install": cmd_install,
        "configure": cmd_configure,
        "deploy": cmd_deploy,
        "doctor": cmd_doctor,
        "uninstall": cmd_uninstall,
    }

    sys.exit(commands[args.command](args) or 0)


if __name__ == "__main__":
    main()
