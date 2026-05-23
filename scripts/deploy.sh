#!/usr/bin/env bash
# =============================================================================
# Vibe Coding Workshop -- one-shot install / fast inner-loop dev wrapper
# =============================================================================
# This is the canonical install entrypoint. From a fresh `git clone`, running
#
#     ./scripts/deploy.sh -p <databricks-cli-profile>
#
# end-to-end provisions Lakebase Autoscaling + UC catalog, creates the app
# from this git repo, applies SP grants and DDL/seed migrations, and waits
# for the app to reach RUNNING. Zero local config required -- the canonical
# `databricks.yml` ships with safe defaults for everything (instance name,
# schema, catalog, app name); `post_deploy.py` reads those same defaults so
# user-config.yaml is purely optional (created only when you customise via
# `./vibe2value install`).
#
# Default (full deploy):
#   ./scripts/deploy.sh [-t <target>] [-p <profile>]
#     -> databricks bundle validate
#     -> databricks bundle deploy           (provisions Lakebase + UC + app)
#     -> databricks bundle run post_deploy  (SP grants + DDL/seed + RUNNING wait,
#                                            idempotent: safe to re-run)
#
# Inner-loop dev (requires user-config.yaml -- run `./vibe2value install` first):
#   ./scripts/deploy.sh --code-only [-t <target>] [-p <profile>] [--skip-build]
#   ./scripts/deploy.sh --watch     [-t <target>] [-p <profile>]
#     -> npm run build (unless --skip-build)
#     -> databricks sync . <workspace-path> [--watch]
#     -> databricks apps deploy <app> --source-code-path <workspace-path>
#
# Anything more involved (per-step toggles, ad-hoc reseed, instance recreate)
# now lives behind ./scripts/deploy-legacy.sh and is documented in the README.
# =============================================================================
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

TARGET="user"
PROFILE=""
CODE_ONLY=false
WATCH_MODE=false
SKIP_BUILD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--target)        TARGET="$2"; shift 2 ;;
        -p|--profile)       PROFILE="$2"; shift 2 ;;
        --code-only|--sync) CODE_ONLY=true; shift ;;
        -w|--watch)         CODE_ONLY=true; WATCH_MODE=true; shift ;;
        --skip-build)       SKIP_BUILD=true; shift ;;
        -h|--help)
            sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            echo "Run with --help for usage." >&2
            exit 1
            ;;
    esac
done

PROFILE_FLAG=()
if [[ -n "$PROFILE" ]]; then
    PROFILE_FLAG=(--profile "$PROFILE")
    export DATABRICKS_CONFIG_PROFILE="$PROFILE"
fi

color() { local c=$1; shift; printf "\033[%sm%s\033[0m\n" "$c" "$*"; }
log()   { color "0;36" "▶ $*"; }
ok()    { color "0;32" "✓ $*"; }
warn()  { color "0;33" "⚠ $*"; }
fail()  { color "0;31" "✗ $*" >&2; exit 1; }

# -----------------------------------------------------------------------------
# verify_dist_fresh -- guard the canonical commit
#
# Apps git-source mode serves the React shell from the committed `dist/`. If
# `dist/index.html` is missing the install will fail; if `dist/` is older than
# any frontend source file the user is likely about to push a stale build.
#
# This check is non-fatal in CODE_ONLY mode (that path rebuilds frontend
# explicitly) and in CI (CI=true) where pre-build steps have already run.
# -----------------------------------------------------------------------------
verify_dist_fresh() {
    [[ -f dist/index.html ]] || fail "dist/index.html missing -- run \`npm install && npm run build\` (or \`./vibe2value install\`) before deploying. Apps git-source mode requires the pre-built React shell to be committed."

    # If the dev hasn't materialized package.json (e.g., fresh git-source clone
    # that only has package.json.template), skip staleness check entirely --
    # there's no source-of-truth to compare against.
    [[ -f package.json ]] || { ok "dist/index.html present (no local package.json -- skipping staleness check)"; return 0; }

    local newest_src
    newest_src=$(find src public index.html vite.config.ts tsconfig*.json package.json -type f -newer dist/index.html 2>/dev/null | head -1 || true)
    if [[ -n "$newest_src" ]]; then
        warn "dist/index.html is older than $newest_src -- frontend changes won't ship until you rebuild."
        warn "    Run \`npm run build\` (or \`./vibe2value install\`) and commit dist/ before pushing."
    else
        ok "dist/ is up to date"
    fi
}

if [[ "$CODE_ONLY" == true ]]; then
    # ---------------------------------------------------------------------
    # Inner-loop dev path: rebuild frontend, sync workspace, push to app.
    # Temporarily uses workspace-source for the app even if it was installed
    # with git_repository -- the next full `./scripts/deploy.sh` re-binds it.
    # ---------------------------------------------------------------------
    [[ -f user-config.yaml ]] || fail "--code-only / --watch require user-config.yaml. Run \`./vibe2value install\` first to generate it (or use the default \`./scripts/deploy.sh\` for a full one-shot install)."
    APP_NAME=$(python3 -c "
import yaml
print(yaml.safe_load(open('user-config.yaml')).get('app', {}).get('name', ''))
")
    [[ -z "$APP_NAME" ]] && fail "Could not read app.name from user-config.yaml"

    WS_USER=$(databricks current-user me "${PROFILE_FLAG[@]}" --output json | python3 -c "import sys,json; print(json.load(sys.stdin)['userName'])")
    WS_PATH="/Workspace/Users/${WS_USER}/.bundle/vibe-coding-workshop-app/${TARGET}/files"

    if [[ "$SKIP_BUILD" != true ]]; then
        log "Building frontend (npm run build)"
        (cd frontend && npm run build) || fail "frontend build failed"
        ok "Frontend built"
    fi

    if [[ "$WATCH_MODE" == true ]]; then
        log "Continuous sync to ${WS_PATH} (Ctrl-C to stop)"
        exec databricks sync . "$WS_PATH" --watch "${PROFILE_FLAG[@]}"
    fi

    log "One-shot sync to ${WS_PATH}"
    databricks sync . "$WS_PATH" "${PROFILE_FLAG[@]}"
    ok "Workspace sync complete"

    log "Triggering apps deploy --source-code-path"
    databricks apps deploy "$APP_NAME" --source-code-path "$WS_PATH" "${PROFILE_FLAG[@]}"
    ok "Code deploy triggered for $APP_NAME"
    exit 0
fi

# ---------------------------------------------------------------------
# Default path: full bundle deploy + post_deploy.
# ---------------------------------------------------------------------
log "Verifying frontend build artifacts (dist/)"
verify_dist_fresh

log "Validating bundle (target=$TARGET)"
databricks bundle validate -t "$TARGET" "${PROFILE_FLAG[@]}" >/dev/null
ok "Bundle valid"

log "Deploying bundle (target=$TARGET)"
databricks bundle deploy -t "$TARGET" "${PROFILE_FLAG[@]}"
ok "Bundle deploy complete"

log "Running post_deploy (SP grants + DDL/seed + code push + RUNNING wait)"
databricks bundle run post_deploy -t "$TARGET" "${PROFILE_FLAG[@]}"
ok "post_deploy complete"

color "1;32" "🎉 Install complete -- app should now be RUNNING."
