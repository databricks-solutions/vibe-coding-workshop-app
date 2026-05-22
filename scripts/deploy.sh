#!/usr/bin/env bash
# =============================================================================
# Vibe Coding Workshop -- one-shot install / fast inner-loop dev wrapper
# =============================================================================
# Default (full deploy):
#   ./scripts/deploy.sh [-t <target>] [-p <profile>]
#     -> databricks bundle validate
#     -> databricks bundle deploy
#     -> databricks bundle run post_deploy   (idempotent, applies SP grants,
#                                             DDL/seed, code push, RUNNING wait)
#
# Inner-loop dev (preserved from the legacy script):
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
fail()  { color "0;31" "✗ $*" >&2; exit 1; }

if [[ "$CODE_ONLY" == true ]]; then
    # ---------------------------------------------------------------------
    # Inner-loop dev path: rebuild frontend, sync workspace, push to app.
    # Temporarily uses workspace-source for the app even if it was installed
    # with git_repository -- the next full `./scripts/deploy.sh` re-binds it.
    # ---------------------------------------------------------------------
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
