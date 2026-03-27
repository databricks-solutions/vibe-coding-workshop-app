#!/bin/bash
# =============================================================================
# Vibe Coding Workshop - Databricks SQL (DBSQL) Delta Table Setup
# =============================================================================
#
# Creates or recreates Delta tables in a Databricks SQL warehouse.
# Reads DDL from db/dbsql/ddl/*.sql and seed data from db/dbsql/dml_seed/*.sql
#
# USAGE:
#   ./scripts/setup-dbsql.sh                    # Create tables if not exist + seed if empty
#   ./scripts/setup-dbsql.sh --recreate       # Drop and recreate tables + seed
#   ./scripts/setup-dbsql.sh --drop           # Drop tables only
#   ./scripts/setup-dbsql.sh --status         # Check table status
#   ./scripts/setup-dbsql.sh --full-setup     # Create warehouse + tables + seed
#   ./scripts/setup-dbsql.sh --create-warehouse  # Create serverless SQL warehouse only
#
# CONFIGURATION (environment variables):
#   DBSQL_CATALOG or LAKEHOUSE_CATALOG   - Unity Catalog name
#   DBSQL_SCHEMA or LAKEHOUSE_SCHEMA     - Schema name
#   DATABRICKS_HOST or WORKSPACE_URL     - Workspace URL (optional; profile config)
#   SQL_WAREHOUSE_ID                     - Warehouse ID
#   SQL_WAREHOUSE_HTTP_PATH              - HTTP path (optional; used to derive warehouse ID)
#   DBSQL_WAREHOUSE_NAME                 - Name for --create-warehouse (default below)
#
# REQUIREMENTS:
#   - databricks CLI (authenticated)
#   - python3
#
# =============================================================================

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

DDL_DIR="${PROJECT_ROOT}/db/dbsql/ddl"
DML_SEED_DIR="${PROJECT_ROOT}/db/dbsql/dml_seed"

DBSQL_WAREHOUSE_NAME="${DBSQL_WAREHOUSE_NAME:-vibe-coding-dbsql-warehouse}"

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

ACTION="create"
AUTO_APPROVE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --recreate)
            ACTION="recreate"
            shift
            ;;
        --drop)
            ACTION="drop"
            shift
            ;;
        --status)
            ACTION="status"
            shift
            ;;
        --full-setup)
            ACTION="full-setup"
            shift
            ;;
        --create-warehouse)
            ACTION="create-warehouse"
            shift
            ;;
        --yes|--auto-approve)
            AUTO_APPROVE=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${GREEN}📊 Databricks SQL (DBSQL) Setup${NC}"
echo ""
echo -e "Action: ${CYAN}${ACTION}${NC}"
echo ""

get_yaml_value() {
    local key=$1
    if [[ ! -f "${PROJECT_ROOT}/app.yaml" ]]; then
        echo ""
        return 0
    fi
    grep -A1 "name: $key" "${PROJECT_ROOT}/app.yaml" | grep "value:" | sed 's/.*value: *"\([^"]*\)".*/\1/' | head -1
}

DBSQL_CATALOG="${DBSQL_CATALOG:-${LAKEHOUSE_CATALOG:-}}"
DBSQL_SCHEMA="${DBSQL_SCHEMA:-${LAKEHOUSE_SCHEMA:-}}"

if [[ -z "$DBSQL_CATALOG" ]]; then
    DBSQL_CATALOG="$(get_yaml_value "LAKEHOUSE_DEFAULT_CATALOG")"
    [[ -z "$DBSQL_CATALOG" ]] && DBSQL_CATALOG="$(get_yaml_value "LAKEBASE_UC_CATALOG_NAME")"
fi
if [[ -z "$DBSQL_SCHEMA" ]]; then
    DBSQL_SCHEMA="$(get_yaml_value "LAKEHOUSE_SCHEMA")"
    [[ -z "$DBSQL_SCHEMA" ]] && DBSQL_SCHEMA="$(get_yaml_value "LAKEBASE_SCHEMA")"
fi

if [[ -z "${DATABRICKS_HOST:-}" && -n "${WORKSPACE_URL:-}" ]]; then
    export DATABRICKS_HOST="${WORKSPACE_URL}"
fi

PROFILE_ARGS=()
if [[ -n "${DATABRICKS_CONFIG_PROFILE:-}" ]]; then
    PROFILE_ARGS=( -p "${DATABRICKS_CONFIG_PROFILE}" )
fi

PROFILE_FLAG="${PROFILE_ARGS[*]+${PROFILE_ARGS[*]}}"

if ! databricks current-user me ${PROFILE_ARGS[@]+${PROFILE_ARGS[@]+"${PROFILE_ARGS[@]}"}} &>/dev/null; then
    print_error "Not authenticated to Databricks"
    echo "Run: databricks auth login --host <your-workspace-url>"
    exit 1
fi

if [[ "$ACTION" != "create-warehouse" ]]; then
    if [[ -z "$DBSQL_CATALOG" || -z "$DBSQL_SCHEMA" ]]; then
        print_error "DBSQL_CATALOG / LAKEHOUSE_CATALOG and DBSQL_SCHEMA / LAKEHOUSE_SCHEMA must be set (or present in app.yaml)."
        exit 1
    fi
fi

HAS_SQL_EXECUTE_CLI=0
if databricks sql execute --help &>/dev/null; then
    HAS_SQL_EXECUTE_CLI=1
fi

WAREHOUSE_ID="${SQL_WAREHOUSE_ID:-}"

resolve_warehouse_id_from_http_path() {
    local path="$1"
    if [[ "$path" =~ /warehouses/([^/[:space:]]+) ]]; then
        echo "${BASH_REMATCH[1]}"
        return 0
    fi
    return 1
}

if [[ -z "$WAREHOUSE_ID" && -n "${SQL_WAREHOUSE_HTTP_PATH:-}" ]]; then
    if wid="$(resolve_warehouse_id_from_http_path "${SQL_WAREHOUSE_HTTP_PATH}")"; then
        WAREHOUSE_ID="$wid"
    fi
fi

export WAREHOUSE_ID

execute_sql() {
    local sql="$1"
    local description="${2:-SQL statement}"
    local result

    if [[ "$HAS_SQL_EXECUTE_CLI" == "1" ]]; then
        result=$(databricks sql execute \
            --warehouse-id "$WAREHOUSE_ID" \
            --statement "$sql" \
            $PROFILE_FLAG \
            --output json 2>&1) || {
            print_error "Failed: $description"
            echo "  SQL: ${sql:0:200}$([ ${#sql} -gt 200 ] && echo '...')"
            echo "  Error: $result"
            return 1
        }
        return 0
    fi

    if ! _DBSQL_STMT="$sql" python3 <<'PY'
import json, os, subprocess, sys

sql = os.environ.get("_DBSQL_STMT", "")
warehouse_id = os.environ.get("WAREHOUSE_ID", "")
if not warehouse_id:
    print("WAREHOUSE_ID is not set", file=sys.stderr)
    sys.exit(1)

body = {
    "warehouse_id": warehouse_id,
    "statement": sql,
    "wait_timeout": "50s",
}
cmd = [
    "databricks", "api", "post", "/api/2.0/sql/statements",
    "--json", json.dumps(body),
]
prof = os.environ.get("DATABRICKS_CONFIG_PROFILE", "")
if prof:
    cmd.extend(["-p", prof])

r = subprocess.run(cmd, capture_output=True, text=True)
sys.stderr.write(r.stderr)
if r.returncode != 0:
    sys.exit(r.returncode)

try:
    resp = json.loads(r.stdout)
except json.JSONDecodeError:
    print(r.stdout, file=sys.stderr)
    sys.exit(1)

st = (resp.get("status") or {}).get("state", "")
if st != "SUCCEEDED":
    err = (resp.get("status") or {}).get("error") or {}
    print(err.get("message", json.dumps(resp)[:500]), file=sys.stderr)
    sys.exit(1)
sys.exit(0)
PY
    then
        print_error "Failed: $description"
        echo "  SQL: ${sql:0:200}$([ ${#sql} -gt 200 ] && echo '...')"
        return 1
    fi
    return 0
}

substitute_catalog_schema() {
    printf '%s' "$1" | sed -e "s/\${catalog}/${DBSQL_CATALOG}/g" -e "s/\${schema}/${DBSQL_SCHEMA}/g"
}

run_dml_file() {
    local file_path="$1"
    print_step "DML: $(basename "$file_path")"
    export HAS_SQL_EXECUTE_CLI
    local _tmpf
    _tmpf=$(mktemp)
    substitute_catalog_schema "$(cat "$file_path")" > "$_tmpf"
    _DBSQL_DML_FILE="$_tmpf" python3 <<'PY'
import os, subprocess, sys, json

def parse_sql_statements(sql_content: str):
    statements = []
    i = 0
    content_len = len(sql_content)
    while i < content_len:
        if sql_content[i:i+2] == '--':
            while i < content_len and sql_content[i] != '\n':
                i += 1
            i += 1
            continue
        if sql_content[i] in ' \t\n\r':
            i += 1
            continue
        stmt_start = i
        in_string = False
        paren_depth = 0
        while i < content_len:
            char = sql_content[i]
            if char == "'" and not in_string:
                in_string = True
                i += 1
                continue
            elif char == "'" and in_string:
                if i + 1 < content_len and sql_content[i + 1] == "'":
                    i += 2
                    continue
                in_string = False
                i += 1
                continue
            if in_string:
                i += 1
                continue
            if char == '-' and i + 1 < content_len and sql_content[i + 1] == '-':
                while i < content_len and sql_content[i] != '\n':
                    i += 1
                i += 1
                continue
            if char == '(':
                paren_depth += 1
            elif char == ')':
                paren_depth -= 1
            if char == ';' and not in_string and paren_depth <= 0:
                stmt = sql_content[stmt_start:i+1].strip()
                if stmt and not stmt.startswith('--'):
                    statements.append(stmt)
                i += 1
                break
            i += 1
        else:
            stmt = sql_content[stmt_start:].strip()
            if stmt and not stmt.startswith('--'):
                if any(k in stmt.upper() for k in ('INSERT', 'DELETE', 'UPDATE', 'MERGE')):
                    statements.append(stmt)
            break
    return statements

_f = os.environ.get("_DBSQL_DML_FILE", "")
sql_content = open(_f).read() if _f else ""
warehouse_id = os.environ.get("WAREHOUSE_ID", "")
prof = os.environ.get("DATABRICKS_CONFIG_PROFILE", "")
has_cli = os.environ.get("HAS_SQL_EXECUTE_CLI") == "1"

def run_stmt_api(stmt: str, idx: int) -> None:
    body = {"warehouse_id": warehouse_id, "statement": stmt, "wait_timeout": "50s"}
    cmd = ["databricks", "api", "post", "/api/2.0/sql/statements", "--json", json.dumps(body)]
    if prof:
        cmd.extend(["-p", prof])
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr, file=sys.stderr)
        sys.exit(r.returncode)
    try:
        resp = json.loads(r.stdout)
    except json.JSONDecodeError:
        print(r.stdout, file=sys.stderr)
        sys.exit(1)
    st = (resp.get("status") or {}).get("state", "")
    if st != "SUCCEEDED":
        err = (resp.get("status") or {}).get("error") or {}
        msg = err.get("message", "")
        low = msg.lower()
        if "duplicate" in low:
            print(f"  (statement {idx}: skipped duplicate)", file=sys.stderr)
            return
        print(f"Statement failed: {msg}", file=sys.stderr)
        print(stmt[:400], file=sys.stderr)
        sys.exit(1)

def run_stmt_cli(stmt: str) -> None:
    cmd = ["databricks", "sql", "execute", "--warehouse-id", warehouse_id, "--statement", stmt, "--output", "json"]
    if prof:
        cmd.extend(["-p", prof])
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        low = (r.stdout + r.stderr).lower()
        if "duplicate" in low:
            return
        print(r.stdout + r.stderr, file=sys.stderr)
        sys.exit(r.returncode)

for i, stmt in enumerate(parse_sql_statements(sql_content), 1):
    if not stmt.strip():
        continue
    if has_cli:
        run_stmt_cli(stmt)
    else:
        run_stmt_api(stmt, i)
PY
    rm -f "$_tmpf"
    print_success "Done $(basename "$file_path")"
}

generate_dml_from_templates() {
    local f
    shopt -s nullglob
    local templates=( "${DML_SEED_DIR}"/*.sql.template )
    shopt -u nullglob
    if [[ ${#templates[@]} -eq 0 ]]; then
        return 0
    fi
    print_step "Generating DML from .template files"
    for f in "${templates[@]}"; do
        local out="${f%.template}"
        python3 <<PY
import os, re
src = "${f}"
dst = "${out}"
with open(src, "r", encoding="utf-8") as fh:
    t = fh.read()

def repl(m):
    k = m.group(1)
    return os.environ.get(k, "")

out_text = re.sub(r"__([A-Z0-9_]+)__", repl, t)
with open(dst, "w", encoding="utf-8") as fh:
    fh.write(out_text)
PY
        print_success "Generated $(basename "$out") from $(basename "$f")"
    done
}

run_ddl_files() {
    local f name content
    shopt -s nullglob
    local files=( "${DDL_DIR}"/*.sql )
    shopt -u nullglob
    for f in "${files[@]}"; do
        name=$(basename "$f")
        if [[ "$name" == *"apply_tags"* ]]; then
            print_warning "Skipping $name (tag definitions; use deploy / UC tagging flow)"
            continue
        fi
        print_step "DDL: $name"
        content=$(substitute_catalog_schema "$(cat "$f")")
        if [[ "$HAS_SQL_EXECUTE_CLI" == "1" ]]; then
            databricks sql execute \
                --warehouse-id "$WAREHOUSE_ID" \
                --statement "$content" \
                $PROFILE_FLAG \
                --output json &>/dev/null || {
                    print_error "DDL failed: $name"
                    exit 1
                }
        else
            _DBSQL_DDL_STMT="$content" python3 <<'PY'
import json, os, subprocess, sys
sql = os.environ.get("_DBSQL_DDL_STMT", "")
warehouse_id = os.environ.get("WAREHOUSE_ID", "")
body = {"warehouse_id": warehouse_id, "statement": sql, "wait_timeout": "50s"}
cmd = ["databricks", "api", "post", "/api/2.0/sql/statements", "--json", json.dumps(body)]
prof = os.environ.get("DATABRICKS_CONFIG_PROFILE", "")
if prof:
    cmd.extend(["-p", prof])
r = subprocess.run(cmd, capture_output=True, text=True)
sys.stderr.write(r.stderr)
if r.returncode != 0:
    sys.exit(r.returncode)
resp = json.loads(r.stdout)
if (resp.get("status") or {}).get("state") != "SUCCEEDED":
    err = (resp.get("status") or {}).get("error") or {}
    print(err.get("message", r.stdout[:500]), file=sys.stderr)
    sys.exit(1)
sys.exit(0)
PY
        fi
        print_success "Applied $name"
    done
}

TABLES_DBSQL=(
    sessions
    usecase_descriptions
    section_input_prompts
    workshop_parameters
    saved_usecase_descriptions
)

drop_all_tables() {
    local t fq
    print_step "Dropping tables in ${DBSQL_CATALOG}.${DBSQL_SCHEMA}"
    for t in "${TABLES_DBSQL[@]}"; do
        fq="${DBSQL_CATALOG}.${DBSQL_SCHEMA}.${t}"
        execute_sql "DROP TABLE IF EXISTS ${fq}" "DROP TABLE ${t}"
        print_success "Dropped ${t}"
    done
}

table_exists_and_count() {
    local t="$1"
    local fq="${DBSQL_CATALOG}.${DBSQL_SCHEMA}.${t}"
    DBSQL_FQ_TABLE="$fq" python3 <<'PY'
import json, os, subprocess, sys
fq = os.environ["DBSQL_FQ_TABLE"]
warehouse_id = os.environ.get("WAREHOUSE_ID", "")
sql = f"SELECT COUNT(*) AS c FROM {fq}"
body = {"warehouse_id": warehouse_id, "statement": sql, "wait_timeout": "50s"}
cmd = ["databricks", "api", "post", "/api/2.0/sql/statements", "--json", json.dumps(body)]
prof = os.environ.get("DATABRICKS_CONFIG_PROFILE", "")
if prof:
    cmd.extend(["-p", prof])
r = subprocess.run(cmd, capture_output=True, text=True)
if r.returncode != 0:
    print("__NO__")
    sys.exit(0)
try:
    resp = json.loads(r.stdout)
except json.JSONDecodeError:
    print("__NO__")
    sys.exit(0)
if (resp.get("status") or {}).get("state") != "SUCCEEDED":
    print("__NO__")
    sys.exit(0)
arr = (resp.get("result") or {}).get("data_array") or []
if not arr or not arr[0]:
    print("0")
else:
    print(arr[0][0])
PY
}

show_status() {
    local t c
    print_step "SHOW TABLES in ${DBSQL_CATALOG}.${DBSQL_SCHEMA}"
    if [[ "$HAS_SQL_EXECUTE_CLI" == "1" ]]; then
        databricks sql execute \
            --warehouse-id "$WAREHOUSE_ID" \
            --statement "SHOW TABLES IN ${DBSQL_CATALOG}.${DBSQL_SCHEMA}" \
            $PROFILE_FLAG \
            --output json 2>&1 | head -c 4000
        echo ""
    else
        DBSQL_SHOW_SCHEMA="${DBSQL_CATALOG}.${DBSQL_SCHEMA}" python3 <<'PY'
import json, os, subprocess, sys
wh = os.environ.get("WAREHOUSE_ID", "")
sch = os.environ["DBSQL_SHOW_SCHEMA"]
sql = f"SHOW TABLES IN {sch}"
body = {"warehouse_id": wh, "statement": sql, "wait_timeout": "50s"}
cmd = ["databricks", "api", "post", "/api/2.0/sql/statements", "--json", json.dumps(body)]
prof = os.environ.get("DATABRICKS_CONFIG_PROFILE", "")
if prof:
    cmd.extend(["-p", prof])
r = subprocess.run(cmd, capture_output=True, text=True)
if r.returncode != 0:
    print(r.stderr, file=sys.stderr)
    sys.exit(0)
try:
    resp = json.loads(r.stdout)
except json.JSONDecodeError:
    print(r.stdout[:2000])
    sys.exit(0)
rows = (resp.get("result") or {}).get("data_array") or []
for row in rows[:50]:
    print(" ", " | ".join(str(c) for c in row))
if len(rows) > 50:
    print(f"  ... ({len(rows)} tables total)")
PY
    fi
    echo ""
    for t in "${TABLES_DBSQL[@]}"; do
        c=$(table_exists_and_count "$t")
        if [[ "$c" == "__NO__" ]]; then
            print_warning "${t}: not found or not readable"
        else
            print_success "${t}: ${c} row(s)"
        fi
    done
}

wait_for_warehouse_running() {
    local wid="$1"
    local attempt
    local max=36
    for ((attempt=1; attempt<=max; attempt++)); do
        local state
        state=$(databricks warehouses get "$wid" --output json ${PROFILE_ARGS[@]+"${PROFILE_ARGS[@]}"} | python3 -c "import sys,json; print(json.load(sys.stdin).get('state',''))")
        if [[ "$state" == "RUNNING" ]]; then
            return 0
        fi
        if [[ "$state" == "STOPPED" ]]; then
            print_step "Starting warehouse $wid"
            databricks warehouses start "$wid" ${PROFILE_ARGS[@]+"${PROFILE_ARGS[@]}"} &>/dev/null || true
        fi
        print_warning "Warehouse state: ${state:-UNKNOWN} (attempt $attempt/$max)..."
        sleep 5
    done
    return 1
}

create_serverless_warehouse() {
    print_step "Creating SQL warehouse: ${DBSQL_WAREHOUSE_NAME}"
    local json_body
    json_body=$(DBSQL_WAREHOUSE_NAME="$DBSQL_WAREHOUSE_NAME" python3 <<'PY'
import json, os
print(json.dumps({
    "name": os.environ["DBSQL_WAREHOUSE_NAME"],
    "cluster_size": "2X-Small",
    "warehouse_type": "PRO",
    "enable_serverless_compute": True,
    "auto_stop_mins": 10,
    "min_num_clusters": 1,
    "max_num_clusters": 1,
}))
PY
)
    local resp
    resp=$(databricks api post /api/2.0/sql/warehouses --json "$json_body" ${PROFILE_ARGS[@]+"${PROFILE_ARGS[@]}"} -o json)
    local wid
    wid=$(printf '%s' "$resp" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))")
    if [[ -z "$wid" ]]; then
        print_error "Could not parse warehouse id from API response"
        echo "$resp"
        exit 1
    fi
    print_success "Warehouse created: $wid"
    print_step "Waiting for warehouse to reach RUNNING..."
    if ! wait_for_warehouse_running "$wid"; then
        print_error "Warehouse did not become RUNNING in time"
        exit 1
    fi
    local http_path
    http_path=$(databricks warehouses get "$wid" --output json ${PROFILE_ARGS[@]+"${PROFILE_ARGS[@]}"} | python3 -c "import sys,json; w=json.load(sys.stdin); od=w.get('odbc_params')or{}; print(od.get('path') or w.get('jdbc_url') or '')")
    echo ""
    print_success "SQL_WAREHOUSE_ID=$wid"
    print_success "SQL_WAREHOUSE_HTTP_PATH=$http_path"
    echo ""
    export WAREHOUSE_ID="$wid"
    SQL_WAREHOUSE_ID="$wid"
}

maybe_confirm_production_recreate() {
    if [[ "$AUTO_APPROVE" == true ]]; then
        return 0
    fi
    if [[ "$DBSQL_SCHEMA" == "vibe_coding_workshop" && "$ACTION" == "recreate" ]]; then
        echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
        echo -e "${RED}  You are about to RECREATE DBSQL tables (schema: $DBSQL_SCHEMA).${NC}"
        echo -e "${RED}═══════════════════════════════════════════════════════════════${NC}"
        read -r -p "Type 'YES-PRODUCTION' to confirm: " confirmation
        if [[ "$confirmation" != "YES-PRODUCTION" ]]; then
            print_error "Aborted."
            exit 1
        fi
    fi
}

ensure_warehouse_for_mutations() {
    if [[ -n "$WAREHOUSE_ID" ]]; then
        return 0
    fi
    print_step "No SQL_WAREHOUSE_ID set — creating a new serverless warehouse"
    create_serverless_warehouse
}

run_seed_if_needed_for_create() {
    local uc sp
    uc=$(table_exists_and_count "usecase_descriptions")
    sp=$(table_exists_and_count "section_input_prompts")
    if [[ "$uc" == "__NO__" || "$sp" == "__NO__" ]]; then
        generate_dml_from_templates
        run_all_dml
        return 0
    fi
    if [[ "$uc" =~ ^[0-9]+$ && "$sp" =~ ^[0-9]+$ ]]; then
        if [[ "$uc" -eq 0 || "$sp" -eq 0 ]]; then
            generate_dml_from_templates
            run_all_dml
            return 0
        fi
    else
        generate_dml_from_templates
        run_all_dml
        return 0
    fi
    print_success "Tables already seeded (usecase_descriptions: ${uc}, section_input_prompts: ${sp})"
}

run_all_dml() {
    local sqlf
    shopt -s nullglob
    local seeds=( "${DML_SEED_DIR}"/*.sql )
    shopt -u nullglob
    for sqlf in "${seeds[@]}"; do
        [[ "$(basename "$sqlf")" == *.sql.template ]] && continue
        run_dml_file "$sqlf"
    done
}

if [[ "$ACTION" == "create-warehouse" ]]; then
    create_serverless_warehouse
    exit 0
fi

echo -e "Configuration:"
echo -e "  Catalog:  ${BLUE}${DBSQL_CATALOG}${NC}"
echo -e "  Schema:   ${BLUE}${DBSQL_SCHEMA}${NC}"
echo -e "  Warehouse ID: ${BLUE}${WAREHOUSE_ID:-<not set>}${NC}"
echo ""

if [[ "$ACTION" == "full-setup" ]]; then
    ensure_warehouse_for_mutations
elif [[ "$ACTION" != "status" ]]; then
    ensure_warehouse_for_mutations
fi

if [[ "$ACTION" == "drop" ]]; then
    drop_all_tables
    print_success "Drop complete"
    exit 0
fi

if [[ "$ACTION" == "status" ]]; then
    if [[ -z "$WAREHOUSE_ID" ]]; then
        print_error "SQL_WAREHOUSE_ID or SQL_WAREHOUSE_HTTP_PATH is required for --status"
        exit 1
    fi
    show_status
    exit 0
fi

ensure_catalog_and_schema() {
    print_step "Ensuring catalog and schema exist"
    if ! execute_sql "CREATE CATALOG IF NOT EXISTS \`${DBSQL_CATALOG}\`" "Create catalog" 2>/dev/null; then
        if execute_sql "USE CATALOG \`${DBSQL_CATALOG}\`" "Verify catalog accessible" 2>/dev/null; then
            print_success "Catalog ${DBSQL_CATALOG} already exists (no CREATE privilege needed)"
        else
            print_error "Catalog ${DBSQL_CATALOG} is not accessible and could not be created"
            exit 1
        fi
    else
        print_success "Catalog ${DBSQL_CATALOG} ready"
    fi
    execute_sql "CREATE SCHEMA IF NOT EXISTS \`${DBSQL_CATALOG}\`.\`${DBSQL_SCHEMA}\`" "Create schema"
    print_success "Schema ${DBSQL_CATALOG}.${DBSQL_SCHEMA} ready"
}

if [[ "$ACTION" == "recreate" ]]; then
    maybe_confirm_production_recreate
    drop_all_tables
    ensure_catalog_and_schema
    run_ddl_files
    generate_dml_from_templates
    run_all_dml
    print_success "Recreate complete"
    exit 0
fi

if [[ "$ACTION" == "full-setup" ]]; then
    ensure_catalog_and_schema
    run_ddl_files
    generate_dml_from_templates
    run_all_dml
    print_success "Full setup complete"
    exit 0
fi

ensure_catalog_and_schema
run_ddl_files
run_seed_if_needed_for_create
print_success "DBSQL setup complete"

exit 0
