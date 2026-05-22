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

# Canonical upstream that the committed databricks.yml binds the app's
# `git_repository.url` to. This is what Workspace Apps UI "paste GitHub URL ->
# Deploy" should match for the bundle to reconcile cleanly with the UI-created
# app. Forks that push to a different repo override this by setting
# `app.git_repo_url` in user-config.yaml.
CANONICAL_GIT_REPO_URL = "https://github.com/databricks-solutions/vibe-coding-workshop-app"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from brand_extractor import (
    extract_brand_assets,
    hex_to_hsl,
    looks_like_valid_url,
    _normalise_color,
    _redact_url,
    _try_brandcolorcode,
)

# Length caps applied at the prompt boundary (defense-in-depth: also enforced
# by _yaml_safe on save and by extract_brand_assets internally).
_BRAND_NAME_PROMPT_CAP = 200
_BRAND_HEX_PROMPT_CAP = 32


def _yaml_safe(v):
    """Make a value safe to store in our simple double-quoted YAML format.

    The custom YAML serializer in save_config writes values as
    ``  key: "value"``.  If *value* contains an unescaped double quote,
    embedded newline, or control character, parsing breaks (or worse: it
    could be used to inject an additional YAML key).  This helper neutralises
    those cases without losing meaningful information:

        * ``"`` is replaced with ``'`` (companies don't usually have double
          quotes in their names; apostrophes are preserved).
        * CR/LF are replaced with a single space.
        * Other ASCII control characters are stripped.
        * Length is capped at 500 characters.

    Non-string inputs are coerced to ``str``.  Returns ``""`` on any error.
    """
    try:
        if v is None:
            return ""
        s = str(v).replace('"', "'").replace("\r", "").replace("\n", " ")
        s = "".join(c for c in s if ord(c) >= 0x20 or c == "\t")
        return s[:500]
    except Exception:
        return ""

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
                    lines.append(f'  {k}: "{_yaml_safe(v)}"')
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
        "__APP_NAME__": app.get("name", "") or "vibe-coding-workshop-app",
        "__SERVING_ENDPOINT__": app.get("serving_endpoint", "databricks-claude-sonnet-4-5"),
        # Defaults to the canonical upstream when user-config doesn't specify
        # a value (None). Setting it to empty string explicitly forces
        # workspace-source mode -- see `git_source_enabled` flag computation.
        "__GIT_REPO_URL__": (
            app.get("git_repo_url")
            if app.get("git_repo_url") is not None
            else CANONICAL_GIT_REPO_URL
        ),
        "__GIT_REPO_BRANCH__": app.get("git_repo_branch", "main"),
        "__DEFAULT_WAREHOUSE__": lb.get("warehouse", ""),
        # ENDPOINT_NAME is fully derivable from the lakebase project + branch
        # (Lakebase auto-creates a "primary" endpoint per branch under
        # LKB-11750 stable naming). When the user hasn't pinned a specific
        # endpoint, default to the canonical path so app.yaml ships
        # autoscaling-mode-ready out of the box.
        "__ENDPOINT_NAME__": (
            lb.get("endpoint_name")
            or (
                f"projects/{lb.get('instance_name') or 'vibe-coding-workshop-lakebase'}/"
                f"branches/main/endpoints/primary"
                if lb.get("mode", "autoscaling") == "autoscaling"
                else ""
            )
        ),
        "__LAKEBASE_MODE__": lb.get("mode", "autoscaling"),
        "__TAG_PROJECT__": tags.get("project", "vibe_coding_workshop"),
        "__TAG_ENVIRONMENT__": tags.get("environment", "") or target,
        "__TAG_MANAGED_BY__": tags.get("managed_by", "vibe2value"),
        "__TAG_CUSTOM__": tags.get("custom_tags", ""),
        "__DEPLOYER_EMAIL__": user.get("email", ""),
        "__INSTALLER_VERSION__": meta.get("installer_version", "2.0.0"),
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


def _detect_headless() -> tuple:
    """Best-effort detection of environments without a usable browser.

    Returns ``(is_headless, reason)``. The detector is intentionally biased
    toward declaring "headless": a false positive prints a help message and
    exits 1 (recoverable via ``VIBE2VALUE_FORCE_BROWSER=1``), whereas a
    false negative lets ``databricks auth login`` hang on its
    ``localhost:8020`` callback that cannot be reached from a browser on
    another device.

    Detection signals, in priority order:
      * Explicit overrides: ``VIBE2VALUE_FORCE_BROWSER`` (off),
        ``VIBE2VALUE_NO_BROWSER_AUTH`` (on).
      * Definitive: generic ``CI`` flag; well-known CI markers
        (``GITHUB_ACTIONS`` etc.); Databricks Apps container env vars.
      * Strong: ``DATABRICKS_RUNTIME_VERSION`` (set inside all Databricks
        compute); Linux session with no ``DISPLAY``/``WAYLAND_DISPLAY``;
        non-TTY stdin.

    Pure function: reads only ``os.environ``, ``sys.platform`` and
    ``sys.stdin.isatty()``. Safe to call from any context; all exceptions
    are caught and treated as "not headless".
    """
    truthy = ("1", "true", "yes")

    try:
        if os.environ.get("VIBE2VALUE_FORCE_BROWSER", "").lower() in truthy:
            return False, ""
        if os.environ.get("VIBE2VALUE_NO_BROWSER_AUTH", "").lower() in truthy:
            return True, "VIBE2VALUE_NO_BROWSER_AUTH is set"

        if os.environ.get("CI", "").lower() in truthy:
            return True, "CI=true (running in a CI system)"
        for v in ("GITHUB_ACTIONS", "GITLAB_CI", "CIRCLECI", "JENKINS_URL",
                  "BUILDKITE", "TF_BUILD", "TEAMCITY_VERSION"):
            if os.environ.get(v):
                return True, f"{v} is set (CI system detected)"
        if os.environ.get("DATABRICKS_APP_PORT") or os.environ.get("DATABRICKS_APP_NAME"):
            return True, "running inside a Databricks App container"

        if os.environ.get("DATABRICKS_RUNTIME_VERSION"):
            return True, ("DATABRICKS_RUNTIME_VERSION is set "
                          "(running inside Databricks compute)")
        if sys.platform.startswith("linux"):
            if not os.environ.get("DISPLAY") and not os.environ.get("WAYLAND_DISPLAY"):
                return True, ("no DISPLAY / WAYLAND_DISPLAY on Linux "
                              "(no graphical session)")
        if not sys.stdin.isatty():
            return True, "stdin is not a TTY (non-interactive invocation)"
    except Exception:
        return False, ""

    return False, ""


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

    # Ambient-credential fallback: if the pinned profile failed (stale, not
    # present on this machine, etc.) try resolving via env vars before
    # declaring the environment headless. This is what makes the installer
    # work transparently inside a Databricks App container, where the
    # platform injects DATABRICKS_HOST / DATABRICKS_TOKEN /
    # DATABRICKS_CLIENT_ID automatically. Also catches any other host that
    # exports DATABRICKS_* variables (CI runners with secrets, dev shells
    # with `databricks auth env`, etc.).
    if not user_info:
        ambient = check_auth("")  # no --profile: respects DATABRICKS_* env vars
        if ambient:
            if profile:
                info(f"Using ambient Databricks credentials from environment "
                     f"(saved profile '{profile}' is not usable on this machine).")
            else:
                info("Using ambient Databricks credentials from environment.")
            user_info = ambient
            profile = ""  # propagate to deploy.sh so it also uses env vars

    # Fail fast in headless environments (Databricks Web Terminal, notebook
    # %sh, SSH session, CI runner, Databricks Apps container, piped runs,
    # ...) before attempting browser OAuth. The CLI's `databricks auth login`
    # uses a `localhost:8020` redirect_uri that a browser on any other
    # device cannot reach, so the login would hang indefinitely. This
    # applies whether or not stdin is a TTY -- the localhost callback
    # can't reach this machine either way. Override with
    # VIBE2VALUE_FORCE_BROWSER=1 for the rare laptop case where detection
    # is wrong (e.g. stray DATABRICKS_RUNTIME_VERSION export).
    if not user_info:
        headless, headless_reason = _detect_headless()
        if headless:
            error(f"Not authenticated and the environment looks headless "
                  f"({headless_reason}).")
            print( "  Browser OAuth uses a localhost:8020 callback that cannot")
            print( "  be reached from a browser on another device. Configure")
            print( "  credentials and re-run with one of:")
            print(f"    1. export DATABRICKS_HOST={host}")
            print( "       export DATABRICKS_TOKEN=dapi…")
            print( "    2. databricks configure --token --profile <name>")
            print( "    3. ~/.databrickscfg block with client_id/client_secret "
                   "(service-principal M2M)")
            print( "  To force the browser flow anyway: VIBE2VALUE_FORCE_BROWSER=1")
            sys.exit(1)

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
    # ------------------------------------------------------------------
    # Branding pipeline (purely additive, fully fault-isolated):
    #   1. Read the URL the user typed (any non-empty value is preserved
    #      as customer_url even if extraction returns nothing).
    #   2. Attempt site-based extraction (UA-hardened, SSRF-guarded).
    #   3. Show what was found, then offer two optional override prompts:
    #        - Company display name (default = extracted or humanised domain)
    #        - Primary brand color hex (default = extracted, often empty)
    #      Both prompts accept blank to skip; both are wrapped in absolute
    #      exception guards so a broken stdin never aborts the install.
    # The customer URL stored in user-config.yaml -> seeded into
    # workshop_parameters.company_brand_url is ALWAYS the user-typed URL,
    # never a brandcolorcode.com URL.
    # ------------------------------------------------------------------
    brand_url_input = (
        input(f"  Customer website URL for branding, e.g. www.databricks.com (optional) [{defaults['brand_url']}]: ").strip()
        or defaults["brand_url"]
    )
    brand_url = ""
    brand_extracted = {}
    if brand_url_input:
        # Cap user-typed URL length to a sane bound before doing anything else
        brand_url_input = brand_url_input[:2048]
        url_candidate = brand_url_input if brand_url_input.startswith("http") else "https://" + brand_url_input

        # ------------------------------------------------------------------
        # Quick validation: the URL that lands in workshop_parameters MUST be
        # a real, safe URL.  ``looks_like_valid_url`` checks scheme +
        # hostname shape + SSRF / scheme-injection guards.  If it fails, we
        # warn, store nothing, and skip extraction + override prompts.  This
        # is the ONLY gate between user input and the workshop_parameters
        # row -- the value we assign to ``brand_url`` below is exactly what
        # the user typed (with ``https://`` prepended if they omitted it).
        # ------------------------------------------------------------------
        if not looks_like_valid_url(url_candidate):
            warn(
                f"{brand_url_input!r} does not look like a valid URL "
                "(expected something like 'www.databricks.com'). Skipping branding."
            )
            brand_url = ""
            brand_extracted = {}
        else:
            # Preserve the user-typed URL unconditionally so it lands in
            # branding.customer_url -> __COMPANY_BRAND_URL__ -> workshop_parameters
            # even when extraction is fully blocked.  This fixes the
            # "both pipelines populated empty" bug from the previous installer.
            brand_url = url_candidate
            info(f"Extracting brand assets from {_redact_url(url_candidate)}...")
            try:
                brand_extracted = extract_brand_assets(url_candidate) or {}
            except Exception:
                warn("Could not reach or parse the website; continuing with defaults.")
                brand_extracted = {}

            # Report what extraction found (user can override below)
            try:
                success(
                    f"Brand extracted: name={brand_extracted.get('company_name') or '(none)'!r}, "
                    f"logo={'yes' if brand_extracted.get('logo_url') else 'no'}, "
                    f"colors={'yes' if brand_extracted.get('primary_color') else 'no'}"
                )
            except Exception:
                pass

            # Optional override prompts.  Wrapped in absolute exception guards
            # so a broken stdin / unexpected error never aborts the install.
            try:
                extracted_name = brand_extracted.get("company_name", "") or ""
                name_default = extracted_name[:_BRAND_NAME_PROMPT_CAP]
                name_prompt = (
                    f"  Company display name, e.g. Databricks [{name_default}]: "
                    if name_default
                    else "  Company display name, e.g. Databricks (optional): "
                )
                company_input = input(name_prompt).strip()[:_BRAND_NAME_PROMPT_CAP]
                name_was_overridden = False
                if company_input:
                    if company_input != extracted_name:
                        name_was_overridden = True
                    brand_extracted["company_name"] = company_input
                elif name_default:
                    brand_extracted["company_name"] = name_default

                # If the user supplied a better/longer company name (e.g. typed
                # "American Airlines" instead of accepting "Aa"), AND we still
                # have no primary color, re-attempt the curated brandcolorcode
                # lookup with the corrected name.  This unlocks color extraction
                # for WAF-blocked sites whose 2-char humanised domain was too
                # short for the title-validation gate inside extract_brand_assets.
                try:
                    if (
                        name_was_overridden
                        and not brand_extracted.get("primary_color")
                        and brand_extracted.get("company_name")
                    ):
                        extra_colors = _try_brandcolorcode(brand_extracted["company_name"])
                        if extra_colors:
                            brand_extracted["primary_color"] = extra_colors[0]
                            if len(extra_colors) >= 2 and not brand_extracted.get("secondary_color"):
                                brand_extracted["secondary_color"] = extra_colors[1]
                            if len(extra_colors) >= 3 and not brand_extracted.get("accent_color"):
                                brand_extracted["accent_color"] = extra_colors[2]
                            info(f"Found curated brand colors for {brand_extracted['company_name']!r}.")
                except Exception:
                    pass

                color_default = brand_extracted.get("primary_color", "") or ""
                color_prompt = (
                    f"  Primary brand color hex, e.g. #C8102E (optional) [{color_default}]: "
                    if color_default else
                    "  Primary brand color hex, e.g. #C8102E (optional): "
                )
                color_input = input(color_prompt).strip()[:_BRAND_HEX_PROMPT_CAP]
                if color_input:
                    try:
                        normalized = _normalise_color(color_input)
                        if normalized:
                            brand_extracted["primary_color"] = normalized
                        else:
                            warn(f"Invalid hex color {color_input!r}; keeping previous value.")
                    except Exception:
                        warn("Could not parse color input; keeping previous value.")
            except (KeyboardInterrupt, EOFError):
                # User control -- must propagate so Ctrl+C still aborts the install
                raise
            except Exception:
                warn("Skipping branding prompts due to unexpected error; install continues.")

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
            # Empty by default -> bundle uses workspace-source. Set to a public
            # GitHub URL (and re-run `./vibe2value configure`) to switch the
            # bundle's apps: resource to a declarative git_repository binding.
            "git_repo_url": existing_config.get("app", {}).get("git_repo_url", ""),
            "git_repo_branch": existing_config.get("app", {}).get("git_repo_branch", "main"),
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
            "installer_version": "2.0.0",
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
    npm_result = _run_cmd(["npm", "install", "--include=dev"], cwd=PROJECT_ROOT, capture_output=True, text=True)
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
    app_cfg = config.get("app", {})
    ws_cfg = config.get("workspace", {})
    lakebase_mode = lb.get("mode", "autoscaling")
    # Git-source is the canonical default. The Apps UI "paste GitHub URL ->
    # Deploy" flow expects a `git_repository` block on the apps resource so
    # the bundle deploy reconciles with the UI-created app instead of fighting
    # it. Forks that need workspace-source mode set `app.git_repo_url: ""`
    # explicitly in user-config.yaml.
    git_repo_url = app_cfg.get("git_repo_url")
    if git_repo_url is None:
        git_repo_url = CANONICAL_GIT_REPO_URL
    git_source_enabled = bool(git_repo_url.strip())
    has_workspace_host = bool((ws_cfg.get("host") or "").strip())
    flags = {
        "CREATE_CATALOG": lb.get("create_catalog", "true").lower() == "true",
        "LAKEBASE_PROVISIONED": lakebase_mode == "provisioned",
        "LAKEBASE_AUTOSCALING": lakebase_mode == "autoscaling",
        # Git-source vs workspace-folder source for the apps: bundle resource.
        # Public repo + git_repo_url set -> declarative git_repository binding.
        "APP_GIT_SOURCE": git_source_enabled,
        "APP_WORKSPACE_SOURCE": not git_source_enabled,
        # Pin a workspace host into the bundle target only when the operator
        # explicitly set one in user-config.yaml. Otherwise the canonical bundle
        # omits the `workspace:` block entirely so the CLI profile drives auth.
        "HAS_WORKSPACE_HOST": has_workspace_host,
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
    # Default: code-only (fast inner loop). --full = bundle deploy + post_deploy.
    # --tables runs only the migrations slice of post_deploy via post_deploy.py.
    if getattr(args, "full", False):
        pass  # Full deploy (no extra flags) -> bundle validate/deploy + post_deploy
    elif getattr(args, "tables", False):
        # Re-run only the DDL/seed step (no SP grants, no code push, no wait).
        info("Re-running DDL/seed only via scripts/post_deploy.py")
        post_deploy_py = PROJECT_ROOT / "scripts" / "post_deploy.py"
        result = _run_cmd(
            ["python3", str(post_deploy_py), "--no-code-push", "--no-wait"]
            + (["--profile", profile] if profile else []),
            cwd=PROJECT_ROOT,
        )
        sys.exit(result.returncode)
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
