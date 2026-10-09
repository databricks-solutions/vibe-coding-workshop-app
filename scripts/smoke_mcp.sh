#!/usr/bin/env bash
# MCP server-side smoke for the deployed Genie Accelerator workshop engine.
# Validates the §4.4 "won't save" gates + the full Phase 2 tool flow incl. writes.
set -uo pipefail

APP="${APP:-https://mcp-vibe-coding-workshop-app-7474656657532371.aws.databricksapps.com}"
PROFILE="${PROFILE:-fevm-serverless}"
WS_ORIGIN="${WS_ORIGIN:-https://fevm-serverless-stable-6t92c3.cloud.databricks.com}"
DUAL='application/json, text/event-stream'

TOKEN=$(databricks auth token -p "$PROFILE" 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
[ -z "$TOKEN" ] && { echo "FAILED to get token for profile $PROFILE"; exit 1; }
MCP="$APP/mcp"

pass(){ echo "  PASS: $1"; }
fail(){ echo "  FAIL: $1"; }

rpc(){ # $1=json body ; $2=accept (optional, default JSON-only to test gate c)
  local accept="${2:-application/json}"
  curl -s -X POST "$MCP" \
    -H "Authorization: Bearer $TOKEN" -H "Origin: $WS_ORIGIN" \
    -H "Content-Type: application/json" -H "Accept: $accept" \
    -d "$1"
}

echo "== §4.4a  CORS preflight (OPTIONS) =="
H=$(curl -s -o /dev/null -D - -X OPTIONS "$MCP" -H "Origin: $WS_ORIGIN" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: content-type,authorization,accept" )
echo "$H" | grep -qi "access-control-allow-origin: $WS_ORIGIN" && pass "ACAO echoes workspace origin (with scheme)" || fail "no matching Access-Control-Allow-Origin"

echo "== §4.4d  GET /mcp returns fast 405 (not a hanging SSE) =="
code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$MCP" -H "Authorization: Bearer $TOKEN" -H "Accept: text/event-stream")
[ "$code" = "405" ] && pass "GET -> 405" || fail "GET -> $code (expected 405)"

echo "== §4.4c  initialize with JSON-only Accept is NOT 406 =="
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$MCP" -H "Authorization: Bearer $TOKEN" \
  -H "Origin: $WS_ORIGIN" -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"smoke","version":"1"}}}')
[ "$code" = "200" ] && pass "initialize -> 200" || fail "initialize -> $code"

echo "== gate #5  tools/list carries NO outputSchema/annotations; 6 vibe tools =="
rpc '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | python3 -c "
import sys,json
d=json.load(sys.stdin); tools=d.get('result',{}).get('tools',[])
names=sorted(t['name'] for t in tools)
bad=[t['name'] for t in tools if t.get('outputSchema') is not None or t.get('annotations') is not None]
print('  tools:', names)
print('  PASS: no outputSchema/annotations' if not bad else f'  FAIL: fields present on {bad}')
want={'vibe_start_track','vibe_get_step','vibe_next_step','vibe_complete_step','vibe_submit_answer','vibe_set_parameters'}
print('  PASS: all 6 Phase-2 tools present' if want.issubset(set(names)) else f'  FAIL: missing {want-set(names)}')
"

echo "== flow  start_track -> get_step -> submit_answer (WRITE) -> set_parameters (WRITE) =="
SID=$(rpc '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"vibe_start_track","arguments":{"track":"genie-accelerator","use_case":"smoke test","industry":"tech"}}}' \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['result']['structuredContent']['session_id'])" 2>/dev/null)
[ -n "$SID" ] && pass "vibe_start_track -> session_id=$SID" || { fail "start_track returned no session_id"; exit 1; }

rpc "{\"jsonrpc\":\"2.0\",\"id\":4,\"method\":\"tools/call\",\"params\":{\"name\":\"vibe_get_step\",\"arguments\":{\"session_id\":\"$SID\"}}}" \
  | python3 -c "
import sys,json
d=json.load(sys.stdin); sc=d['result']['structuredContent']
tag=sc.get('sectionTag'); inter=(sc.get('interaction') or {}).get('id')
print(f'  PASS: step 1 sectionTag={tag}, interaction={inter}' if tag else '  FAIL: no step payload')
"

rpc "{\"jsonrpc\":\"2.0\",\"id\":5,\"method\":\"tools/call\",\"params\":{\"name\":\"vibe_submit_answer\",\"arguments\":{\"session_id\":\"$SID\",\"interaction_id\":\"project_setup.why\",\"answer\":\"governed_first\"}}}" \
  | python3 -c "
import sys,json
d=json.load(sys.stdin); sc=d['result']['structuredContent']
print(f'  PASS: submit_answer recorded={sc.get(\"recorded\")}, coaching={bool(sc.get(\"coaching\"))}' if sc.get('recorded') else f'  FAIL: not recorded -> {sc}')
"

rpc "{\"jsonrpc\":\"2.0\",\"id\":6,\"method\":\"tools/call\",\"params\":{\"name\":\"vibe_set_parameters\",\"arguments\":{\"session_id\":\"$SID\",\"params\":{\"catalog\":\"smoke_cat\",\"schema_prefix\":\"smoke\"}}}}" \
  | python3 -c "
import sys,json
d=json.load(sys.stdin); sc=d['result']['structuredContent']
rp=sc.get('resolved_params',{})
print(f'  PASS: set_parameters resolved catalog={rp.get(\"catalog\")}' if rp.get('catalog')=='smoke_cat' else f'  FAIL: {sc}')
"

echo ""
echo "Session id used: $SID  (its interaction row should now be in session_interactions)"
echo "Smoke complete."
