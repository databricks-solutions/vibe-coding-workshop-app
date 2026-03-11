#!/bin/bash
# =============================================================================
# Vibe Coding Workshop - Full Deployment Script
# =============================================================================
#
# This script automates the complete end-to-end deployment of the Vibe Coding
# Workshop application to Databricks, including all infrastructure and permissions.
#
# DEPLOYMENT STEPS:
#   Step 0: Configure app.yaml with target-specific Lakebase settings
#   Step 1: Validate and deploy Databricks Asset Bundle (Lakebase + App)
#           + Update app.yaml with Lakebase host (discovered after instance creation)
#   Step 2: Setup all required permissions:
#           2a. Unity Catalog permissions (ALL_PRIVILEGES on catalog)
#           2b. Lakebase database roles (DATABRICKS_SUPERUSER for SP, user, account users)
#               + CAN_USE on Lakebase instance for account users
#           2c. App Resource link (CAN_CONNECT_AND_CREATE on Lakebase instance)
#           2d. App permissions (CAN_USE for all workspace users)
#   Step 3: Create and seed Lakebase tables (DDL + DML)
#   Step 4: Final app deploy (start → deploy code → verify RUNNING)
#           Only runs during full install; skipped for --code-only
#   Step 5: Verify & fix all permissions (app resource link, Lakebase roles,
#           instance CAN_USE, app CAN_USE, Unity Catalog) -- re-applies any missing
#
# PERMISSIONS EXPLAINED:
#   - Unity Catalog (2a): Allows app to access catalog schemas and tables
#   - Database Role (2b): PostgreSQL superuser for table operations
#   - App Resource (2c): Links Lakebase instance to app for automatic auth
#
# USAGE:
#   ./scripts/deploy.sh                        # Full deployment to development
#   ./scripts/deploy.sh --target production    # Deploy to production
#   ./scripts/deploy.sh --target development --profile my-profile
#   ./scripts/deploy.sh --skip-tables          # Skip table setup
#   ./scripts/deploy.sh --tables-only          # Only run table setup
#   ./scripts/deploy.sh --skip-permissions     # Skip permission setup
#   ./scripts/deploy.sh --code-only            # Quick deploy (builds frontend + syncs + deploys)
#   ./scripts/deploy.sh --watch                # Continuous sync on file changes
#
# REQUIREMENTS:
#   - Databricks CLI (authenticated via `databricks auth login`)
#   - Python 3 with psycopg2-binary
#   - Valid databricks.yml with target configuration
#
# ENVIRONMENT:
#   Configuration is read from databricks.yml based on the target.
#   Each target defines: app_name, lakebase_instance_name, lakebase_catalog, lakebase_schema
#
# =============================================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT_DIR="$PROJECT_ROOT/scripts"
cd "$PROJECT_ROOT"

# Default configuration
TARGET="development"
SKIP_TABLES=false
TABLES_ONLY=false
SKIP_PERMISSIONS=false
CODE_ONLY=false
WATCH_MODE=false
SKIP_BUILD=false
BUNDLE_ONLY=false
PERMISSIONS_ONLY=false
PROFILE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --target|-t)
            TARGET="$2"
            shift 2
            ;;
        --profile|-p)
            PROFILE="$2"
            shift 2
            ;;
        --skip-tables)
            SKIP_TABLES=true
            shift
            ;;
        --tables-only)
            TABLES_ONLY=true
            shift
            ;;
        --skip-permissions)
            SKIP_PERMISSIONS=true
            shift
            ;;
        --bundle-only)
            BUNDLE_ONLY=true
            shift
            ;;
        --permissions-only)
            PERMISSIONS_ONLY=true
            shift
            ;;
        --code-only|--sync)
            CODE_ONLY=true
            shift
            ;;
        --watch|-w)
            WATCH_MODE=true
            CODE_ONLY=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --target, -t <target>    Bundle target (default: development)"
            echo "  --profile, -p <profile>  Databricks CLI profile"
            echo "  --skip-tables            Skip Lakebase table setup"
            echo "  --tables-only            Only run Lakebase table setup"
            echo "  --skip-permissions       Skip catalog permissions setup"
            echo "  --bundle-only            Only deploy DAB bundle (infra)"
            echo "  --permissions-only       Only setup permissions"
            echo "  --code-only, --sync      Quick code sync only (auto-builds frontend first)"
            echo "  --skip-build             Skip frontend build (for backend-only changes)"
            echo "  --watch, -w              Continuous sync mode (auto-syncs on file changes)"
            echo "  --help, -h               Show this help"
            echo ""
            echo "Quick UI Update Examples:"
            echo "  $0 --code-only -t production         # Build frontend + sync + deploy"
            echo "  $0 --code-only --skip-build -t prod  # Backend-only changes (skip npm build)"
            echo "  $0 --watch -t development            # Watch mode for dev"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Build profile flag
PROFILE_FLAG=""
if [[ -n "$PROFILE" ]]; then
    PROFILE_FLAG="--profile $PROFILE"
fi

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    echo ""
    echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${BLUE}  $1${NC}"
    echo -e "${BOLD}${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_step() {
    echo -e "${CYAN}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Get values from databricks.yml based on target using Python for reliable YAML parsing
get_target_var() {
    local var_name=$1
    python3 -c "
import re
import sys

var_name = '$var_name'
target = '$TARGET'

with open('databricks.yml', 'r') as f:
    content = f.read()

# Find the target section
pattern = r'^  ' + target + r':.*?(?=^  [a-z]|^[^ ]|\Z)'
target_match = re.search(pattern, content, re.MULTILINE | re.DOTALL)
if target_match:
    target_section = target_match.group(0)
    # Look for the variable in the target's variables section
    var_pattern = var_name + r':\s*[\"\']?([^\"\'\\n]+)[\"\']?'
    var_match = re.search(var_pattern, target_section)
    if var_match:
        print(var_match.group(1).strip().strip('\"').strip(\"'\"))
        sys.exit(0)

# Fall back to default in variables section
var_pattern = r'^  ' + var_name + r':.*?default:\s*[\"\']?([^\"\'\\n]+)[\"\']?'
var_match = re.search(var_pattern, content, re.MULTILINE | re.DOTALL)
if var_match:
    print(var_match.group(1).strip().strip('\"').strip(\"'\"))
"
}

# Get workspace host from databricks.yml for the current target
get_workspace_host() {
    python3 -c "
import re
target = '$TARGET'
with open('databricks.yml', 'r') as f:
    content = f.read()
pattern = r'^  ' + target + r':.*?(?=^  [a-z]|^[^ ]|\Z)'
target_match = re.search(pattern, content, re.MULTILINE | re.DOTALL)
if target_match:
    host_match = re.search(r'host:\s*(https?://\S+)', target_match.group(0))
    if host_match:
        print(host_match.group(1).strip())
"
}

# Poll until a deleted app is fully removed from the API
wait_for_app_deletion() {
    local app_name=$1
    local max_wait=60
    local elapsed=0
    local interval=5
    print_step "Waiting for app '$app_name' to be fully removed..."
    while [[ $elapsed -lt $max_wait ]]; do
        if ! databricks apps get "$app_name" $PROFILE_FLAG 2>/dev/null | grep -q '"name"'; then
            print_success "App '$app_name' confirmed deleted"
            return 0
        fi
        sleep $interval
        elapsed=$((elapsed + interval))
        echo -e "  Still waiting... (${elapsed}s/${max_wait}s)"
    done
    print_warning "App deletion not confirmed after ${max_wait}s, proceeding anyway"
    return 0
}

# Find and delete stale apps (CRASHED/UNAVAILABLE/ERROR) to free OAuth slots
cleanup_stale_apps() {
    local current_app=$1
    print_step "Scanning workspace for stale apps to free OAuth integration slots..."
    local stale_apps
    stale_apps=$(databricks apps list --output json $PROFILE_FLAG 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    apps = data if isinstance(data, list) else data.get('apps', [])
    current = sys.argv[1] if len(sys.argv) > 1 else ''
    for app in apps:
        name = app.get('name', '')
        status = app.get('status', {})
        state = status.get('state', '') if isinstance(status, dict) else ''
        if name != current and state in ('CRASHED', 'UNAVAILABLE', 'ERROR', 'DELETED'):
            print(name)
except Exception:
    pass
" "$current_app") || true

    if [[ -z "$stale_apps" ]]; then
        print_warning "No stale apps found in this workspace"
        return 1
    fi

    local count=0
    while IFS= read -r app; do
        [[ -z "$app" ]] && continue
        print_step "Deleting stale app: $app"
        databricks apps delete "$app" $PROFILE_FLAG 2>/dev/null || true
        count=$((count + 1))
    done <<< "$stale_apps"
    print_success "Deleted $count stale app(s). Waiting for cleanup to propagate..."
    sleep 15
    return 0
}

# Get workspace source code path from bundle summary
get_source_path() {
    local path
    path=$(databricks bundle summary -t "$TARGET" $PROFILE_FLAG --output json 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    ws = data.get('workspace',{}).get('file_path','') or data.get('workspace',{}).get('root_path','')
    if ws: print(ws + '/files' if '/files' not in ws else ws)
except: pass
")
    [[ -z "$path" ]] && path="/Workspace/Users/$CURRENT_USER/.bundle/vibe-coding-workshop-app/$TARGET/files"
    echo "$path"
}

# Get current app state as a single string
get_app_state() {
    databricks apps get "$APP_NAME" $PROFILE_FLAG --output json 2>/dev/null \
      | python3 -c "import sys,json; print(json.load(sys.stdin).get('app_status',{}).get('state','UNKNOWN'))" 2>/dev/null || echo "UNKNOWN"
}

# Start the app if not running and wait for RUNNING state (up to 120s)
ensure_app_running() {
    local state
    state=$(get_app_state)
    if [[ "$state" == "RUNNING" ]]; then
        print_success "App is already running"
        return 0
    fi
    print_step "Starting app (current state: $state)..."
    databricks apps start "$APP_NAME" $PROFILE_FLAG 2>/dev/null || true
    local elapsed=0
    while [[ $elapsed -lt 120 ]]; do
        sleep 10
        elapsed=$((elapsed + 10))
        state=$(get_app_state)
        if [[ "$state" == "RUNNING" ]]; then
            print_success "App is running"
            return 0
        fi
        echo -e "  App state: ${YELLOW}$state${NC} (${elapsed}s/120s)"
    done
    print_error "App did not reach RUNNING after 120s (state: $state)"
    return 1
}

# Deploy app code with retries and auto-recovery for "not running" errors
deploy_app_code() {
    local source_path=$1
    print_step "Deploying app code from: $source_path"
    for attempt in 1 2 3; do
        local result
        result=$(databricks apps deploy "$APP_NAME" $PROFILE_FLAG --source-code-path "$source_path" 2>&1) || true

        if echo "$result" | grep -q "SUCCEEDED\|started successfully"; then
            print_success "App code deployed"
            return 0
        elif echo "$result" | grep -q "not in RUNNING state\|start the app first"; then
            print_warning "App not running -- starting before retry..."
            ensure_app_running || return 1
        elif echo "$result" | grep -q "active deployment in progress"; then
            print_warning "Deployment in progress, waiting 15s ($attempt/3)..."
            sleep 15
        else
            echo "  $result"
            print_error "Deploy failed ($attempt/3)"
            [[ $attempt -lt 3 ]] && sleep 10
        fi
    done
    return 1
}

# =============================================================================
# Main Deployment Flow
# =============================================================================

print_header "VIBE CODING WORKSHOP - DEPLOYMENT"

echo -e "Target:       ${CYAN}$TARGET${NC}"
echo -e "Profile:      ${CYAN}${PROFILE:-default}${NC}"
echo -e "Project:      ${CYAN}$PROJECT_ROOT${NC}"
echo ""

# Get configuration from databricks.yml
APP_NAME=$(get_target_var "app_name")
LAKEBASE_INSTANCE=$(get_target_var "lakebase_instance_name")
LAKEBASE_CATALOG=$(get_target_var "lakebase_catalog")
LAKEBASE_SCHEMA=$(get_target_var "lakebase_schema")
WORKSPACE_URL=$(get_workspace_host)

# Validate target to prevent accidental production changes
# Skip confirmation for --code-only (safer operation, just code sync)
if [[ "$TARGET" == "production" && "$CODE_ONLY" != true ]]; then
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  ⚠️  WARNING: PRODUCTION TARGET SELECTED${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    read -p "Type 'DEPLOY-PRODUCTION' to confirm: " confirmation
    if [[ "$confirmation" != "DEPLOY-PRODUCTION" ]]; then
        echo -e "${RED}Aborted.${NC}"
        exit 1
    fi
elif [[ "$TARGET" == "production" && "$CODE_ONLY" == true ]]; then
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  ℹ️  PRODUCTION CODE-ONLY SYNC (no confirmation required)${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
fi

echo -e "App Name:     ${BLUE}$APP_NAME${NC}"
echo -e "Instance:     ${BLUE}$LAKEBASE_INSTANCE${NC}"
echo -e "Catalog:      ${BLUE}$LAKEBASE_CATALOG${NC}"
echo -e "Schema:       ${BLUE}$LAKEBASE_SCHEMA${NC}"
echo ""

# Check databricks CLI authentication
print_step "Checking Databricks CLI authentication..."
if ! databricks $PROFILE_FLAG current-user me &>/dev/null; then
    print_error "Not authenticated to Databricks"
    echo "Run: databricks auth login --host <workspace-url>"
    exit 1
fi
CURRENT_USER=$(databricks $PROFILE_FLAG current-user me --output json 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('userName',''))")
print_success "Authenticated as: $CURRENT_USER"

# =============================================================================
# FAST PATH: Code-Only Deployment (--code-only or --watch)
# =============================================================================
# This mode provides quick code updates with automatic frontend build:
#
# Steps (--code-only):
#   1. Build frontend (npm run build) - ensures dist/ is up to date
#   2. Sync files to workspace (databricks bundle sync)
#   3. Trigger rolling deployment (databricks apps deploy)
#
# Use cases:
#   - Quick frontend (React/dist) updates
#   - Backend Python code changes
#   - Configuration file updates
#
# Flags:
#   --skip-build    Skip npm build (for backend-only changes)
#
# Note: For changes requiring new dependencies or env vars,
#       use full deployment instead.
# =============================================================================

if [[ "$CODE_ONLY" == true ]]; then
    if [[ "$WATCH_MODE" == true ]]; then
        print_header "WATCH MODE - Continuous Code Sync"
        echo -e "${YELLOW}Watching for file changes...${NC}"
        echo -e "Press ${BOLD}Ctrl+C${NC} to stop"
        echo ""
        echo -e "Files synced based on databricks.yml sync configuration:"
        echo -e "  Include: src/**, dist/**, app.yaml, app.py, requirements.txt, scripts/**, db/**"
        echo -e "  Exclude: node_modules/**, __pycache__/**, *.pyc, .git/**, deploy.py"
        echo ""
        echo -e "${YELLOW}⚠️  IMPORTANT for UI changes:${NC}"
        echo -e "   Watch mode syncs files but does NOT run npm build or trigger deployment."
        echo -e "   For UI changes to take effect:"
        echo -e "   1. Run ${BOLD}npm run build${NC} in another terminal when you make React changes"
        echo -e "   2. After done, run ${BOLD}./scripts/deploy.sh --code-only -t $TARGET${NC} to deploy"
        echo ""
        echo -e "   Or use ${BOLD}--code-only${NC} instead for one-shot deploys with auto-build."
        echo ""
        
        # Run bundle sync in watch mode
        databricks bundle sync -t "$TARGET" $PROFILE_FLAG --watch
        exit 0
    else
        print_header "CODE-ONLY DEPLOYMENT - Quick UI Update"
        
        # Step 1: Build frontend (ensures dist/ is up to date)
        if [[ "$SKIP_BUILD" == true ]]; then
            print_step "Step 1/3: Skipping frontend build (--skip-build flag)"
            print_warning "Using existing dist/ files - ensure they are up to date!"
        else
            print_step "Step 1/3: Building frontend..."
            if [[ -f "package.json" ]]; then
                if npm run build 2>&1; then
                    print_success "Frontend built successfully"
                else
                    print_error "Frontend build failed"
                    exit 1
                fi
            else
                print_warning "No package.json found - skipping frontend build"
            fi
        fi
        echo ""
        
        # Step 2: Sync code changes
        print_step "Step 2/3: Syncing code changes to workspace..."
        echo -e "  Target: ${CYAN}$TARGET${NC}"
        echo ""
        
        if ! databricks bundle sync -t "$TARGET" $PROFILE_FLAG 2>&1; then
            print_error "Code sync failed"
            exit 1
        fi
        print_success "Code synced to workspace"
        echo ""
        
        # Step 3: Trigger rolling deployment (picks up new code without full restart)
        print_step "Step 3/3: Triggering app deployment (rolling update)..."

        SOURCE_PATH=$(get_source_path)
        echo -e "  Source path: ${CYAN}$SOURCE_PATH${NC}"

        if ! ensure_app_running; then
            print_error "App is not running -- cannot deploy code"
            echo -e "  Try: ${CYAN}databricks apps start $APP_NAME${NC}"
            exit 1
        fi

        if deploy_app_code "$SOURCE_PATH"; then
            echo ""
            echo -e "${GREEN}✓ Rolling deployment in progress - zero downtime${NC}"
            echo -e "${GREEN}✓ New code will be live in ~30-60 seconds${NC}"
        else
            print_error "App code deployment failed"
            echo -e "  Try: ${CYAN}databricks apps deploy $APP_NAME --source-code-path $SOURCE_PATH${NC}"
            exit 1
        fi
        
        echo ""
        
        # Get app URL for convenience
        APP_INFO=$(databricks apps get "$APP_NAME" $PROFILE_FLAG --output json 2>/dev/null) || true
        if [[ -n "$APP_INFO" ]]; then
            APP_URL=$(echo "$APP_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('url',''))" 2>/dev/null) || true
            APP_STATE=$(echo "$APP_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('app_status',{}).get('state',''))" 2>/dev/null) || true
            if [[ -n "$APP_URL" ]]; then
                echo -e "${BOLD}${GREEN}🚀 App URL: $APP_URL${NC}"
                echo -e "   Status:  ${CYAN}$APP_STATE${NC}"
            fi
        fi
        
        echo ""
        echo -e "${BOLD}Quick Commands:${NC}"
        echo -e "  Check status:  ${BLUE}databricks apps get $APP_NAME $PROFILE_FLAG${NC}"
        echo -e "  View logs:     ${BLUE}databricks apps logs $APP_NAME $PROFILE_FLAG${NC}"
        echo -e "  Watch mode:    ${BLUE}./scripts/deploy.sh --watch -t $TARGET${NC}"
        echo -e "  Full deploy:   ${BLUE}./scripts/deploy.sh -t $TARGET${NC}"
        exit 0
    fi
fi

# =============================================================================
# Step 0: Update app.yaml with target-specific Lakebase config
# =============================================================================

if [[ "$TABLES_ONLY" != true ]]; then
    print_header "STEP 0: Configure app.yaml for Target"
    
    # Get Lakebase instance host for this target
    print_step "Getting Lakebase instance details for target: $TARGET..."
    
    INSTANCE_DETAILS=$(databricks api get "/api/2.0/database/instances/$LAKEBASE_INSTANCE" $PROFILE_FLAG 2>/dev/null) || true
    
    if [[ -n "$INSTANCE_DETAILS" ]]; then
        TARGET_LAKEBASE_HOST=$(echo "$INSTANCE_DETAILS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('read_write_dns',''))")
        
        if [[ -n "$TARGET_LAKEBASE_HOST" ]]; then
            print_success "Instance: $LAKEBASE_INSTANCE"
            print_success "Host: $TARGET_LAKEBASE_HOST"
            print_success "Schema: $LAKEBASE_SCHEMA"
            
            # Update app.yaml with correct values (handles empty or populated values)
            print_step "Updating app.yaml with target-specific Lakebase config..."
            
            # Update LAKEBASE_HOST: find the name line, update value on next line
            sed -i.bak '/name: LAKEBASE_HOST/{n;s|value: ".*"|value: "'"$TARGET_LAKEBASE_HOST"'"|;}' app.yaml
            
            # Update LAKEBASE_SCHEMA: same approach
            sed -i.bak '/name: LAKEBASE_SCHEMA/{n;s|value: ".*"|value: "'"$LAKEBASE_SCHEMA"'"|;}' app.yaml
            
            rm -f app.yaml.bak
            
            print_success "app.yaml updated for $TARGET environment"
            echo ""
            echo -e "  LAKEBASE_HOST:   ${CYAN}$TARGET_LAKEBASE_HOST${NC}"
            echo -e "  LAKEBASE_SCHEMA: ${CYAN}$LAKEBASE_SCHEMA${NC}"
        else
            print_warning "Could not get instance host"
        fi
    else
        print_warning "Could not get instance details - app.yaml unchanged"
    fi
fi

# =============================================================================
# Step 1: Bundle Validate & Deploy
# =============================================================================

if [[ "$TABLES_ONLY" != true && "$PERMISSIONS_ONLY" != true ]]; then
    print_header "STEP 1: Bundle Validate & Deploy"
    
    print_step "Validating bundle configuration..."
    if ! databricks bundle validate -t "$TARGET" $PROFILE_FLAG 2>&1 | grep -v "^Warning:"; then
        print_error "Bundle validation failed"
        exit 1
    fi
    print_success "Bundle validated"
    
    print_step "Deploying bundle (Lakebase + App infrastructure)..."
    DEPLOY_TMPFILE=$(mktemp)
    databricks bundle deploy -t "$TARGET" $PROFILE_FLAG 2>&1 | tee "$DEPLOY_TMPFILE"
    DEPLOY_EXIT_CODE=${PIPESTATUS[0]}
    DEPLOY_OUTPUT=$(cat "$DEPLOY_TMPFILE")
    rm -f "$DEPLOY_TMPFILE"

    BUNDLE_DEPLOY_OK=false
    [[ $DEPLOY_EXIT_CODE -eq 0 ]] && BUNDLE_DEPLOY_OK=true

    if [[ "$BUNDLE_DEPLOY_OK" != true ]]; then

        if echo "$DEPLOY_OUTPUT" | grep -q "already exists"; then
            print_warning "Detected pre-existing resources from a previous attempt. Cleaning up..."

            if echo "$DEPLOY_OUTPUT" | grep -q "failed to create app\|databricks_app"; then
                print_step "Removing pre-existing app: $APP_NAME"
                databricks apps delete "$APP_NAME" $PROFILE_FLAG 2>/dev/null || true
                wait_for_app_deletion "$APP_NAME"
            fi

            if echo "$DEPLOY_OUTPUT" | grep -q "failed to create database\|databricks_database"; then
                print_step "Removing pre-existing Lakebase instance: $LAKEBASE_INSTANCE"
                databricks api delete "/api/2.0/database/instances/$LAKEBASE_INSTANCE" $PROFILE_FLAG 2>/dev/null || true
                sleep 10
                print_success "Removed stale instance"
            fi

            print_step "Retrying bundle deploy..."
            if ! databricks bundle deploy -t "$TARGET" $PROFILE_FLAG 2>&1; then
                print_error "Bundle deploy failed on retry"
                exit 1
            fi

        elif echo "$DEPLOY_OUTPUT" | grep -q "QUOTA_EXCEEDED\|OAuth custom application\|1000.*OAuth"; then
            print_warning "Hit the account-wide OAuth integration limit (max 1000)."
            print_step "Attempting to free slots by removing stale apps in this workspace..."

            if cleanup_stale_apps "$APP_NAME"; then
                print_step "Retrying bundle deploy after stale app cleanup..."
                if ! databricks bundle deploy -t "$TARGET" $PROFILE_FLAG 2>&1; then
                    print_error "Bundle deploy still failed after cleanup."
                    echo ""
                    echo -e "${YELLOW}The OAuth integration limit is account-wide across all workspaces.${NC}"
                    echo -e "${YELLOW}An account admin needs to clean up stale integrations:${NC}"
                    echo -e "  1. Go to ${CYAN}Account Console → Settings → App connections${NC}"
                    echo -e "  2. Delete integrations for apps that no longer exist"
                    echo -e "  3. Or use: ${CYAN}databricks account custom-app-integration list${NC}"
                    echo ""
                    exit 1
                fi
            else
                print_error "No stale apps to clean up in this workspace."
                echo ""
                echo -e "${YELLOW}The OAuth integration limit is account-wide across all workspaces.${NC}"
                echo -e "${YELLOW}An account admin needs to clean up stale integrations:${NC}"
                echo -e "  1. Go to ${CYAN}Account Console → Settings → App connections${NC}"
                echo -e "  2. Delete integrations for apps that no longer exist"
                echo -e "  3. Or use: ${CYAN}databricks account custom-app-integration list${NC}"
                echo ""
                exit 1
            fi
        else
            print_error "Bundle deploy failed"
            exit 1
        fi
    fi
    print_success "Bundle deployed"
    
    # Get bundle summary
    print_step "Getting deployment summary..."
    databricks bundle summary -t "$TARGET" $PROFILE_FLAG 2>&1 | grep -E "Name:|URL:|Host:|Path:"

    # Now that the Lakebase instance exists, update app.yaml with its host
    print_step "Updating app.yaml with Lakebase connection details..."
    INSTANCE_DETAILS=$(databricks api get "/api/2.0/database/instances/$LAKEBASE_INSTANCE" $PROFILE_FLAG 2>/dev/null) || true
    if [[ -n "$INSTANCE_DETAILS" ]]; then
        TARGET_LAKEBASE_HOST=$(echo "$INSTANCE_DETAILS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('read_write_dns',''))")
        if [[ -n "$TARGET_LAKEBASE_HOST" ]]; then
            # Update LAKEBASE_HOST: find line with "name: LAKEBASE_HOST", update next line's value
            sed -i.bak '/name: LAKEBASE_HOST/{n;s|value: ".*"|value: "'"$TARGET_LAKEBASE_HOST"'"|;}' app.yaml
            # Update LAKEBASE_SCHEMA similarly
            sed -i.bak '/name: LAKEBASE_SCHEMA/{n;s|value: ".*"|value: "'"$LAKEBASE_SCHEMA"'"|;}' app.yaml
            rm -f app.yaml.bak
            print_success "LAKEBASE_HOST: $TARGET_LAKEBASE_HOST"
            print_success "LAKEBASE_SCHEMA: $LAKEBASE_SCHEMA"

            # Re-sync the updated app.yaml to workspace
            print_step "Syncing updated app.yaml to workspace..."
            databricks bundle deploy -t "$TARGET" $PROFILE_FLAG 2>&1 | tail -3
        else
            print_warning "Could not get Lakebase host from instance details"
        fi
    else
        print_warning "Could not get Lakebase instance details -- app.yaml may need manual update"
    fi
fi

if [[ "$BUNDLE_ONLY" == true ]]; then
    print_header "BUNDLE DEPLOY COMPLETE"
    exit 0
fi

# =============================================================================
# Verify App Exists After Bundle Deploy
# =============================================================================
# Bundle deploy creates the app but does not start compute or push code.
# We just verify the app was created successfully before proceeding.
# Compute starts later in Step 4 after code is deployed and app is started.
# =============================================================================

if [[ "$TABLES_ONLY" != true && "$PERMISSIONS_ONLY" != true ]]; then
    print_step "Verifying app was created..."
    APP_CHECK=$(databricks apps get "$APP_NAME" $PROFILE_FLAG --output json 2>/dev/null) || true
    if [[ -n "$APP_CHECK" ]] && echo "$APP_CHECK" | grep -q '"name"'; then
        APP_STATE=$(echo "$APP_CHECK" | python3 -c "
import sys, json
data = json.load(sys.stdin)
state = data.get('app_status', {}).get('state', 'UNKNOWN')
print(state)" 2>/dev/null) || true
        print_success "App exists (state: ${APP_STATE:-UNKNOWN}). Compute will start after code deploy in Step 4."
    else
        print_error "App '$APP_NAME' not found after bundle deploy"
        exit 1
    fi
fi

# =============================================================================
# Step 2: Setup All Required Permissions
# =============================================================================
# This step configures three types of permissions required for the app:
#
# 2a. Unity Catalog Permissions
#     API: PATCH /api/2.1/unity-catalog/permissions/catalog/{catalog}
#     Grants ALL_PRIVILEGES on the catalog to the app's service principal
#     Required for: Schema/table access in Unity Catalog
#
# 2b. Lakebase Database Role
#     API: POST /api/2.0/database/instances/{instance}/roles
#     Adds app service principal as DATABRICKS_SUPERUSER
#     Required for: PostgreSQL operations (CREATE, INSERT, UPDATE, etc.)
#
# 2c. App Resource Link
#     API: PATCH /api/2.0/apps/{app}
#     Links Lakebase instance to app with CAN_CONNECT_AND_CREATE permission
#     Required for: Automatic PGPASSWORD injection at runtime
#     This appears in Databricks UI under App > Settings > App Resources
#
# =============================================================================

if [[ "$TABLES_ONLY" != true && "$SKIP_PERMISSIONS" != true ]]; then
    print_header "STEP 2: Setup Permissions"
    
    print_step "Getting app service principal..."
    APP_INFO=$(databricks apps get "$APP_NAME" $PROFILE_FLAG --output json 2>/dev/null) || true
    
    if [[ -n "$APP_INFO" ]]; then
        SERVICE_PRINCIPAL_ID=$(echo "$APP_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('service_principal_client_id',''))")
        SERVICE_PRINCIPAL_NAME=$(echo "$APP_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('service_principal_name',''))")
        APP_URL=$(echo "$APP_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('url',''))")
        APP_STATE=$(echo "$APP_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('app_status',{}).get('state',''))")
        
        print_success "App Name: $APP_NAME"
        print_success "Service Principal ID: $SERVICE_PRINCIPAL_ID"
        print_success "Service Principal Name: $SERVICE_PRINCIPAL_NAME"
        print_success "App URL: $APP_URL"
        print_success "App State: $APP_STATE"
        
        # =================================================================
        # 2a. Unity Catalog Permissions
        #     Grant ALL_PRIVILEGES on catalog to app service principal
        #     This enables the app to access schemas and tables
        # =================================================================
        if [[ -n "$SERVICE_PRINCIPAL_ID" && -n "$LAKEBASE_CATALOG" ]]; then
            print_step "2a. Adding Unity Catalog permissions..."
            
            PERM_RESULT=$(databricks api patch "/api/2.1/unity-catalog/permissions/catalog/$LAKEBASE_CATALOG" \
                $PROFILE_FLAG \
                --json "{\"changes\": [{\"principal\": \"$SERVICE_PRINCIPAL_ID\", \"add\": [\"ALL_PRIVILEGES\"]}]}" 2>&1) || true
            
            if echo "$PERM_RESULT" | grep -q "privilege_assignments\|ALL_PRIVILEGES"; then
                print_success "Catalog permissions granted: ALL_PRIVILEGES on $LAKEBASE_CATALOG"
            elif echo "$PERM_RESULT" | grep -q "already"; then
                print_warning "Catalog permissions already exist"
            else
                print_warning "Could not verify catalog permissions"
                echo "  Response: $PERM_RESULT"
            fi
        fi
        
        # =================================================================
        # 2b. Lakebase Database Role (PostgreSQL)
        #     Add service principal as DATABRICKS_SUPERUSER in PostgreSQL
        #     This enables CREATE TABLE, INSERT, UPDATE operations
        # =================================================================
        if [[ -n "$SERVICE_PRINCIPAL_ID" && -n "$LAKEBASE_INSTANCE" ]]; then
            print_step "2b. Adding Lakebase database roles..."
            
            EXISTING_ROLES=$(databricks api get "/api/2.0/database/instances/$LAKEBASE_INSTANCE/roles" $PROFILE_FLAG 2>/dev/null) || true
            
            # Add service principal as DATABRICKS_SUPERUSER
            if echo "$EXISTING_ROLES" | grep -q "$SERVICE_PRINCIPAL_ID"; then
                print_warning "Lakebase role already exists for service principal"
            else
                ROLE_RESULT=$(databricks api post "/api/2.0/database/instances/$LAKEBASE_INSTANCE/roles" \
                    $PROFILE_FLAG \
                    --json "{\"name\": \"$SERVICE_PRINCIPAL_ID\", \"identity_type\": \"SERVICE_PRINCIPAL\", \"membership_role\": \"DATABRICKS_SUPERUSER\"}" 2>&1) || true
                
                if echo "$ROLE_RESULT" | grep -q "DATABRICKS_SUPERUSER\|SERVICE_PRINCIPAL"; then
                    print_success "Lakebase role granted: DATABRICKS_SUPERUSER for app service principal"
                else
                    print_warning "Could not verify Lakebase role for service principal"
                    echo "  Response: $ROLE_RESULT"
                fi
            fi

            # Add current user as DATABRICKS_SUPERUSER (needed for table setup)
            if [[ -n "$CURRENT_USER" ]]; then
                if echo "$EXISTING_ROLES" | grep -q "$CURRENT_USER"; then
                    print_warning "Lakebase role already exists for $CURRENT_USER"
                else
                    USER_ROLE_RESULT=$(databricks api post "/api/2.0/database/instances/$LAKEBASE_INSTANCE/roles" \
                        $PROFILE_FLAG \
                        --json "{\"name\": \"$CURRENT_USER\", \"identity_type\": \"USER\", \"membership_role\": \"DATABRICKS_SUPERUSER\"}" 2>&1) || true
                    
                    if echo "$USER_ROLE_RESULT" | grep -q "DATABRICKS_SUPERUSER\|USER"; then
                        print_success "Lakebase role granted: DATABRICKS_SUPERUSER for $CURRENT_USER"
                    else
                        print_warning "Could not grant Lakebase role for $CURRENT_USER"
                        echo "  Response: $USER_ROLE_RESULT"
                    fi
                fi
            fi

            # Add account users group role (enables all workspace users to access the workshop DB)
            if echo "$EXISTING_ROLES" | grep -q "account users"; then
                print_warning "Lakebase role already exists for account users"
            else
                ACCT_ROLE_RESULT=$(databricks api post "/api/2.0/database/instances/$LAKEBASE_INSTANCE/roles" \
                    $PROFILE_FLAG \
                    --json '{"name": "account users", "identity_type": "GROUP", "membership_role": "DATABRICKS_SUPERUSER", "attributes": {"createdb": true, "createrole": true, "bypassrls": true}}' 2>&1) || true

                if echo "$ACCT_ROLE_RESULT" | grep -q "DATABRICKS_SUPERUSER\|GROUP"; then
                    print_success "Lakebase role granted: DATABRICKS_SUPERUSER for account users (all workspace users)"
                else
                    print_warning "Could not grant Lakebase role for account users"
                    echo "  Response: $ACCT_ROLE_RESULT"
                fi
            fi

            # Grant CAN_USE on Lakebase instance to account users
            print_step "Granting CAN_USE on Lakebase instance to account users..."
            INSTANCE_PERM_RESULT=$(databricks api patch "/api/2.0/permissions/database-instances/$LAKEBASE_INSTANCE" \
                $PROFILE_FLAG \
                --json '{"access_control_list": [{"group_name": "account users", "permission_level": "CAN_USE"}]}' 2>&1) || true

            if echo "$INSTANCE_PERM_RESULT" | grep -q "access_control_list\|CAN_USE"; then
                print_success "CAN_USE granted on Lakebase instance for account users"
            else
                print_warning "Could not grant CAN_USE on Lakebase instance"
                echo "  Response: $INSTANCE_PERM_RESULT"
            fi
        fi
        
        # =================================================================
        # 2c. App Resource Link (Critical for Runtime Auth)
        #     Link Lakebase instance to app with CAN_CONNECT_AND_CREATE
        #     This enables automatic PGPASSWORD injection at runtime
        #     Visible in: Databricks UI > Apps > Settings > App Resources
        #     
        #     Uses lakebase_manager.py to keep all permission logic centralized
        # =================================================================
        if [[ -n "$LAKEBASE_INSTANCE" ]]; then
            print_step "2c. Linking Lakebase as app resource (via lakebase_manager.py)..."
            
            python3 "$SCRIPT_DIR/lakebase_manager.py" \
                --action link-app-resource \
                --app-name "$APP_NAME" \
                --instance-name "$LAKEBASE_INSTANCE" \
                --host "$WORKSPACE_URL" \
                --project-root "$PROJECT_ROOT" || {
                print_warning "Could not link app resource - may need manual setup"
            }
        fi
        
        # =================================================================
        # 2d. App Permissions
        #     Grant CAN_USE on the app to all workspace users
        #     This allows anyone in the workspace to open and use the app
        # =================================================================
        print_step "2d. Granting CAN_USE on app to all workspace users..."
        APP_PERM_RESULT=$(databricks api patch "/api/2.0/permissions/apps/$APP_NAME" \
            $PROFILE_FLAG \
            --json '{"access_control_list": [{"group_name": "users", "permission_level": "CAN_USE"}]}' 2>&1) || true

        if echo "$APP_PERM_RESULT" | grep -q "access_control_list\|CAN_USE"; then
            print_success "CAN_USE granted on app for all workspace users"
        else
            print_warning "Could not grant CAN_USE on app"
            echo "  Response: $APP_PERM_RESULT"
        fi
    else
        print_warning "Could not get app info - permissions may need manual setup"
    fi
fi

if [[ "$PERMISSIONS_ONLY" == true ]]; then
    print_header "PERMISSIONS SETUP COMPLETE"
    exit 0
fi

# =============================================================================
# Step 3: Setup Lakebase Tables
# =============================================================================

if [[ "$SKIP_TABLES" != true ]]; then
    print_header "STEP 3: Setup Lakebase Tables"
    
    # Get Lakebase instance details to find the correct host
    print_step "Getting Lakebase instance connection details..."
    
    INSTANCE_INFO=$(databricks api get "/api/2.0/database/instances/$LAKEBASE_INSTANCE" $PROFILE_FLAG 2>/dev/null) || true
    
    if [[ -n "$INSTANCE_INFO" ]]; then
        LAKEBASE_HOST_FROM_INSTANCE=$(echo "$INSTANCE_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('read_write_dns',''))")
        INSTANCE_STATE=$(echo "$INSTANCE_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('state',''))")
        
        if [[ -n "$LAKEBASE_HOST_FROM_INSTANCE" ]]; then
            print_success "Instance: $LAKEBASE_INSTANCE"
            print_success "Host: $LAKEBASE_HOST_FROM_INSTANCE"
            print_success "State: $INSTANCE_STATE"
            print_success "Schema: $LAKEBASE_SCHEMA"
        else
            print_warning "Could not get instance host - using app.yaml fallback"
        fi
    else
        print_warning "Could not get instance info - using app.yaml fallback"
        LAKEBASE_HOST_FROM_INSTANCE=""
    fi
    
    echo ""
    print_step "Running Lakebase table setup..."
    echo -e "  Target Schema: ${CYAN}$LAKEBASE_SCHEMA${NC}"
    echo ""
    
    # CRITICAL: Export environment variable overrides to ensure correct target
    # These override any values from app.yaml in setup-lakebase.sh
    export DATABRICKS_HOST="$WORKSPACE_URL"
    export LAKEBASE_INSTANCE_NAME="$LAKEBASE_INSTANCE"
    export LAKEBASE_SCHEMA_OVERRIDE="$LAKEBASE_SCHEMA"
    export APP_NAME="$APP_NAME"
    
    if [[ -n "$LAKEBASE_HOST_FROM_INSTANCE" ]]; then
        export LAKEBASE_HOST_OVERRIDE="$LAKEBASE_HOST_FROM_INSTANCE"
    fi
    
    # Run table setup with explicit schema override
    if ./scripts/setup-lakebase.sh --recreate --yes; then
        print_success "Lakebase tables created and seeded in schema: $LAKEBASE_SCHEMA"
    else
        print_error "Table setup failed"
        exit 1
    fi
fi

# =============================================================================
# Step 4: Final App Deploy (ensures clean start with all infra ready)
# =============================================================================

if [[ "$TABLES_ONLY" != true && "$PERMISSIONS_ONLY" != true && "$CODE_ONLY" != true ]]; then
    print_header "STEP 4: Final App Deploy"

    # 4a. Update app.yaml with final Lakebase config
    print_step "Verifying app.yaml configuration..."
    INSTANCE_DETAILS=$(databricks api get "/api/2.0/database/instances/$LAKEBASE_INSTANCE" $PROFILE_FLAG 2>/dev/null) || true
    if [[ -n "$INSTANCE_DETAILS" ]]; then
        TARGET_LAKEBASE_HOST=$(echo "$INSTANCE_DETAILS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('read_write_dns',''))")
        if [[ -n "$TARGET_LAKEBASE_HOST" ]]; then
            sed -i.bak '/name: LAKEBASE_HOST/{n;s|value: ".*"|value: "'"$TARGET_LAKEBASE_HOST"'"|;}' app.yaml
            sed -i.bak '/name: LAKEBASE_SCHEMA/{n;s|value: ".*"|value: "'"$LAKEBASE_SCHEMA"'"|;}' app.yaml
            rm -f app.yaml.bak
            print_success "LAKEBASE_HOST: $TARGET_LAKEBASE_HOST"
            print_success "LAKEBASE_SCHEMA: $LAKEBASE_SCHEMA"
        fi
    fi

    # 4b. Sync config to workspace
    print_step "Syncing final configuration to workspace..."
    databricks bundle deploy -t "$TARGET" $PROFILE_FLAG 2>&1 | tail -3

    # 4c. Get source code path
    SOURCE_PATH=$(get_source_path)

    # 4d. Ensure app is running BEFORE deploying code
    if ! ensure_app_running; then
        print_error "Cannot deploy code -- app failed to start"
        echo -e "  Try: ${CYAN}databricks apps start $APP_NAME${NC}"
        exit 1
    fi

    # 4e. Deploy code to the running app
    if ! deploy_app_code "$SOURCE_PATH"; then
        print_error "App code deployment failed"
        echo -e "  Try: ${CYAN}databricks apps deploy $APP_NAME --source-code-path $SOURCE_PATH${NC}"
        exit 1
    fi

    # 4f. Wait for app to stabilize with new code
    print_step "Waiting for app to stabilize..."
    APP_RUNNING=false
    for CHECK in $(seq 1 8); do
        sleep 15
        FINAL_STATE=$(get_app_state)
        APP_URL=$(databricks apps get "$APP_NAME" $PROFILE_FLAG --output json 2>/dev/null \
          | python3 -c "import sys,json; print(json.load(sys.stdin).get('url',''))" 2>/dev/null) || true
        if [[ "$FINAL_STATE" == "RUNNING" ]]; then
            print_success "App is RUNNING!"
            APP_RUNNING=true
            break
        fi
        echo -e "  App state: ${YELLOW}$FINAL_STATE${NC} ($CHECK/8)"
    done

    if [[ "$APP_RUNNING" != true ]]; then
        print_error "App did not stabilize (state: $FINAL_STATE)"
        echo -e "  Check: ${CYAN}databricks apps get $APP_NAME${NC}"
        echo -e "  Logs:  ${CYAN}databricks apps logs $APP_NAME${NC}"
    fi
fi

# =============================================================================
# Step 5: Verify & Fix All Permissions
# =============================================================================
# After the final deploy/restart cycle, permissions and resource links set in
# Step 2 may have been reset. This step verifies each one and re-applies any
# that are missing, ensuring a clean deployment before declaring success.
# =============================================================================

if [[ "$TABLES_ONLY" != true && "$PERMISSIONS_ONLY" != true && "$CODE_ONLY" != true ]]; then
    print_header "STEP 5: Verify & Fix Permissions"
    VERIFY_ISSUES=0

    # Re-fetch app info for service principal ID (may have changed after restart)
    VERIFY_APP_INFO=$(databricks apps get "$APP_NAME" $PROFILE_FLAG --output json 2>/dev/null) || true
    if [[ -n "$VERIFY_APP_INFO" ]]; then
        SERVICE_PRINCIPAL_ID=$(echo "$VERIFY_APP_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('service_principal_client_id',''))" 2>/dev/null) || true
    fi

    # ── Check 1: App Resource Link (Lakebase → App) ─────────────────────
    print_step "Check 1/5: App resource link (Lakebase → App)..."
    HAS_RESOURCE=$(echo "$VERIFY_APP_INFO" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for r in data.get('resources', []):
        db = r.get('database', {})
        if db.get('instance_name') == '$LAKEBASE_INSTANCE':
            print('yes')
            sys.exit(0)
    print('no')
except: print('no')
" 2>/dev/null) || true

    if [[ "$HAS_RESOURCE" == "yes" ]]; then
        print_success "App resource link: Lakebase instance connected"
    else
        print_warning "App resource link MISSING -- re-applying..."
        VERIFY_ISSUES=$((VERIFY_ISSUES + 1))
        python3 "$SCRIPT_DIR/lakebase_manager.py" \
            --action link-app-resource \
            --app-name "$APP_NAME" \
            --instance-name "$LAKEBASE_INSTANCE" \
            --host "$WORKSPACE_URL" \
            --project-root "$PROJECT_ROOT" 2>/dev/null || {
            print_warning "Could not re-link app resource"
        }
    fi

    # ── Check 2: Lakebase Roles ──────────────────────────────────────────
    print_step "Check 2/5: Lakebase database roles..."
    VERIFY_ROLES=$(databricks api get "/api/2.0/database/instances/$LAKEBASE_INSTANCE/roles" $PROFILE_FLAG 2>/dev/null) || true

    # 2a. Service principal role
    if [[ -n "$SERVICE_PRINCIPAL_ID" ]]; then
        if echo "$VERIFY_ROLES" | grep -q "$SERVICE_PRINCIPAL_ID"; then
            print_success "Lakebase role: service principal OK"
        else
            print_warning "Lakebase role: service principal MISSING -- re-applying..."
            VERIFY_ISSUES=$((VERIFY_ISSUES + 1))
            databricks api post "/api/2.0/database/instances/$LAKEBASE_INSTANCE/roles" \
                $PROFILE_FLAG \
                --json "{\"name\": \"$SERVICE_PRINCIPAL_ID\", \"identity_type\": \"SERVICE_PRINCIPAL\", \"membership_role\": \"DATABRICKS_SUPERUSER\"}" 2>/dev/null || true
        fi
    fi

    # 2b. Current user role
    if [[ -n "$CURRENT_USER" ]]; then
        if echo "$VERIFY_ROLES" | grep -q "$CURRENT_USER"; then
            print_success "Lakebase role: $CURRENT_USER OK"
        else
            print_warning "Lakebase role: $CURRENT_USER MISSING -- re-applying..."
            VERIFY_ISSUES=$((VERIFY_ISSUES + 1))
            databricks api post "/api/2.0/database/instances/$LAKEBASE_INSTANCE/roles" \
                $PROFILE_FLAG \
                --json "{\"name\": \"$CURRENT_USER\", \"identity_type\": \"USER\", \"membership_role\": \"DATABRICKS_SUPERUSER\"}" 2>/dev/null || true
        fi
    fi

    # 2c. Account users group role
    if echo "$VERIFY_ROLES" | grep -q "account users"; then
        print_success "Lakebase role: account users OK"
    else
        print_warning "Lakebase role: account users MISSING -- re-applying..."
        VERIFY_ISSUES=$((VERIFY_ISSUES + 1))
        databricks api post "/api/2.0/database/instances/$LAKEBASE_INSTANCE/roles" \
            $PROFILE_FLAG \
            --json '{"name": "account users", "identity_type": "GROUP", "membership_role": "DATABRICKS_SUPERUSER", "attributes": {"createdb": true, "createrole": true, "bypassrls": true}}' 2>/dev/null || true
    fi

    # ── Check 3: Lakebase Instance CAN_USE ───────────────────────────────
    print_step "Check 3/5: Lakebase instance CAN_USE for account users..."
    VERIFY_INST_PERMS=$(databricks api get "/api/2.0/permissions/database-instances/$LAKEBASE_INSTANCE" $PROFILE_FLAG 2>/dev/null) || true

    if echo "$VERIFY_INST_PERMS" | grep -q "account users"; then
        print_success "Lakebase instance CAN_USE: account users OK"
    else
        print_warning "Lakebase instance CAN_USE: account users MISSING -- re-applying..."
        VERIFY_ISSUES=$((VERIFY_ISSUES + 1))
        databricks api patch "/api/2.0/permissions/database-instances/$LAKEBASE_INSTANCE" \
            $PROFILE_FLAG \
            --json '{"access_control_list": [{"group_name": "account users", "permission_level": "CAN_USE"}]}' 2>/dev/null || true
    fi

    # ── Check 4: App CAN_USE ─────────────────────────────────────────────
    print_step "Check 4/5: App CAN_USE for all workspace users..."
    VERIFY_APP_PERMS=$(databricks api get "/api/2.0/permissions/apps/$APP_NAME" $PROFILE_FLAG 2>/dev/null) || true

    if echo "$VERIFY_APP_PERMS" | grep -q '"group_name".*"users"'; then
        print_success "App CAN_USE: all workspace users OK"
    else
        print_warning "App CAN_USE: all workspace users MISSING -- re-applying..."
        VERIFY_ISSUES=$((VERIFY_ISSUES + 1))
        databricks api patch "/api/2.0/permissions/apps/$APP_NAME" \
            $PROFILE_FLAG \
            --json '{"access_control_list": [{"group_name": "users", "permission_level": "CAN_USE"}]}' 2>/dev/null || true
    fi

    # ── Check 5: Unity Catalog Permissions ───────────────────────────────
    print_step "Check 5/5: Unity Catalog permissions..."
    if [[ -n "$SERVICE_PRINCIPAL_ID" && -n "$LAKEBASE_CATALOG" ]]; then
        VERIFY_UC_PERMS=$(databricks api get "/api/2.1/unity-catalog/permissions/catalog/$LAKEBASE_CATALOG" $PROFILE_FLAG 2>/dev/null) || true

        if echo "$VERIFY_UC_PERMS" | grep -q "$SERVICE_PRINCIPAL_ID"; then
            print_success "Unity Catalog: service principal has privileges on $LAKEBASE_CATALOG"
        else
            print_warning "Unity Catalog: permissions MISSING -- re-applying..."
            VERIFY_ISSUES=$((VERIFY_ISSUES + 1))
            databricks api patch "/api/2.1/unity-catalog/permissions/catalog/$LAKEBASE_CATALOG" \
                $PROFILE_FLAG \
                --json "{\"changes\": [{\"principal\": \"$SERVICE_PRINCIPAL_ID\", \"add\": [\"ALL_PRIVILEGES\"]}]}" 2>/dev/null || true
        fi
    else
        print_warning "Unity Catalog: skipped (missing service principal or catalog name)"
    fi

    # ── Verification Summary ─────────────────────────────────────────────
    echo ""
    if [[ $VERIFY_ISSUES -gt 0 ]]; then
        print_warning "Fixed $VERIFY_ISSUES permission issue(s) -- re-applied during verification"
    else
        print_success "All permissions verified -- clean deployment"
    fi
fi

# =============================================================================
# Final Summary
# =============================================================================

if [[ "$APP_RUNNING" == true ]]; then
    print_header "DEPLOYMENT COMPLETE"
    echo -e "${GREEN}✓ All deployment steps completed successfully!${NC}"
    echo ""

    if [[ "$TABLES_ONLY" != true ]]; then
        echo -e "${BOLD}Resources:${NC}"
        echo -e "  App URL:           ${CYAN}$APP_URL${NC}"
        echo -e "  Lakebase Instance: ${CYAN}$LAKEBASE_INSTANCE${NC}"
        echo -e "  Catalog:           ${CYAN}$LAKEBASE_CATALOG${NC}"
        echo -e "  Schema:            ${CYAN}$LAKEBASE_SCHEMA${NC}"
        echo ""
    fi

    echo -e "${BOLD}Quick Commands:${NC}"
    echo -e "  Quick code sync:      ${BLUE}./scripts/deploy.sh --code-only -t $TARGET${NC}"
    echo -e "  Watch mode:           ${BLUE}./scripts/deploy.sh --watch -t $TARGET${NC}"
    echo -e "  Full redeploy:        ${BLUE}./scripts/deploy.sh -t $TARGET${NC}"
    echo ""
    echo -e "${BOLD}${GREEN}🚀 App is live at: $APP_URL${NC}"

elif [[ "$TABLES_ONLY" == true || "$CODE_ONLY" == true ]]; then
    print_header "DEPLOYMENT COMPLETE"
    echo -e "${GREEN}✓ Deployment steps completed.${NC}"
    echo ""

else
    print_header "DEPLOYMENT INCOMPLETE"
    echo -e "${RED}✗ App did not reach RUNNING state (final state: ${FINAL_STATE:-UNKNOWN})${NC}"
    echo ""
    echo -e "${BOLD}Resources deployed:${NC}"
    echo -e "  App URL:           ${CYAN}${APP_URL:-unknown}${NC}"
    echo -e "  Lakebase Instance: ${CYAN}$LAKEBASE_INSTANCE${NC}"
    echo -e "  Catalog:           ${CYAN}$LAKEBASE_CATALOG${NC}"
    echo -e "  Schema:            ${CYAN}$LAKEBASE_SCHEMA${NC}"
    echo ""
    echo -e "${BOLD}Troubleshooting:${NC}"
    echo -e "  Check app status:     ${BLUE}databricks apps get $APP_NAME${NC}"
    echo -e "  View app logs:        ${BLUE}databricks apps logs $APP_NAME${NC}"
    echo -e "  Retry full deploy:    ${BLUE}./vibe2value deploy --full${NC}"
    echo ""
    exit 1
fi

