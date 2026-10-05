# Plan: llm-service-extract (Phase 2A prerequisite)

- Repo: app (databricks-solutions/vibe-coding-workshop-app), base origin/feature/genie-code-mcp-integration @ 3d5b700
- Commit this plan at: docs/superpowers/plans/2026-10-04-llm-service-extract.md
- Source: RUN.md §B ("the services/llm.py extract (D4 §1.2)"); D4 mcp-workshop-architecture.md §1.2 rule 1 "Extract, don't cross layers ... No behavior change: it is a move + import rewire"; D4 file table (:298) "extract of call_databricks_serving_endpoint (routes.py:1400) + SERVING_ENDPOINT_NAME (:440); imported by both routes.py and mcp_server.py". Line numbers drifted: today the endpoint block is routes.py:448–573 and the function is :1408–1886.

## Goal
Move the FMAPI seam out of the web-API layer into `src/backend/services/llm.py` with ZERO behavior change, so the Phase 2A coaching handler in mcp_server.py can import the service rather than routes.py. This PR adds no coaching code, no DDL, and no mcp_server.py change.

## Charter exception (trunk file)
- File: `src/backend/api/routes.py` (trunk).
- Reason: the function and its endpoint-resolution helpers live there; D4 §1.2 mandates the extract.
- Reversal: `git revert` of the merge commit. Because routes.py re-exports every moved name, reverting restores the exact prior layout, and no caller outside the touched files changes.

## Exact move (verbatim bodies; only the imports needed to make them self-contained)
New module `src/backend/services/llm.py` gets, moved byte-for-byte except for imports:
1. `SERVING_ENDPOINT_NAME` (routes.py:448) with its comment block (:440–447)
2. `FALLBACK_ENDPOINTS` (:453–460)
3. `_workspace_client`, `_available_endpoints_cache` (:464–465) module state
4. `get_workspace_client` (:467–482)
5. `get_available_serving_endpoints` (:485–509)
6. `get_best_available_endpoint` (:512–550)
7. `_extract_text` (:553–573)
8. `call_databricks_serving_endpoint` (:1408–1886)

Module-level imports llm.py needs (the closure computed by AST over these 8 names): `asyncio, json, os, time, logging`, `typing (Any, Dict, List, Optional)`, `fastapi.HTTPException` (the function raises it today; keep it, which is a known web-type coupling, out of scope to change), plus the same guarded `DATABRICKS_SDK_AVAILABLE` / `WorkspaceClient` import routes uses (copy the routes try/except verbatim). The function-local imports (identity, traceback, json as json_lib, time) stay where they are. `logger = logging.getLogger(__name__)`. Every log MESSAGE stays identical; only the logger name changes, from `src.backend.api.routes` to `src.backend.services.llm` (D-20).

llm.py MUST NOT import `src.backend.api` (no cycle; that is the point of the extract).

In routes.py: delete those definitions and replace them with ONE re-export import:
`from src.backend.services.llm import (SERVING_ENDPOINT_NAME, FALLBACK_ENDPOINTS, get_workspace_client, get_available_serving_endpoints, get_best_available_endpoint, _extract_text, call_databricks_serving_endpoint)`
so every `routes.<name>` attribute and every in-routes caller (:1329, :1929, :2123–2124, :2207, :2635, :2753, :2813, :2838, :2850, :2877) keeps working unchanged. Single workspace-client singleton: it now lives in llm.py; routes holds no `_workspace_client` of its own (grep proves no other reader).

`src/backend/api/hackathon.py:33`: change the import to `from src.backend.services.llm import call_databricks_serving_endpoint` (same object; keep the try/except fallback as is).

## Test patch targets (the only test edits allowed)
Because a moved function resolves its helpers from llm.py's globals, tests that patch the helper and then call the MOVED function must patch the owner module. Retarget the patch target only: no assertion, input or expectation changes:
- tests/workshop/test_offload_fallback_paths.py:116–117 (`get_workspace_client`, `get_best_available_endpoint`) → `llm`
- tests/workshop/test_step_prompt_budget.py:331–332, :559–560 → `llm`
- tests/api/test_serving_payload.py:74–75 (`SERVING_ENDPOINT_NAME`, `get_available_serving_endpoints` patched around `get_best_available_endpoint()`) → `llm`
Calls through `routes.call_databricks_serving_endpoint` / `routes._extract_text` / `routes.get_best_available_endpoint` stay as they are (the re-export proves back-compat).
If any OTHER test fails, stop and report: that is a behavior change, not a patch target.

## New tests: tests/workshop/test_llm_service.py
- E1 identity: each of the 7 names is the SAME object on `routes` and `services.llm` (`routes.call_databricks_serving_endpoint is llm.call_databricks_serving_endpoint`, etc.).
- E2 no layer crossing: importing `src.backend.services.llm` in a fresh interpreter (subprocess, `-c`) leaves `src.backend.api.routes` absent from `sys.modules`; also an AST scan of llm.py has no `src.backend.api` import.
- E3 routes no longer DEFINES them: an AST scan of routes.py finds no `def`/`async def` named call_databricks_serving_endpoint, get_workspace_client, get_available_serving_endpoints, get_best_available_endpoint or _extract_text, and no top-level assignment to SERVING_ENDPOINT_NAME / FALLBACK_ENDPOINTS / _workspace_client / _available_endpoints_cache.
- E4 single singleton: with `llm._workspace_client` patched to a sentinel, `routes.get_workspace_client()` returns the sentinel.
- E5 seam for coaching: patching `llm.get_workspace_client` + `llm.get_best_available_endpoint` with a fake client makes `llm.call_databricks_serving_endpoint("hi", endpoint_name="ep")` return the fake's text, offline (reuse the _FakeClient shape from test_offload_fallback_paths.py).
- E6 body fidelity: the source of `llm.call_databricks_serving_endpoint` (inspect.getsource) equals the source of the function at `git show 3d5b700195464c3da9af16e2acb9ce4ff5ef7865:src/backend/api/routes.py` (extracted via AST), byte-identical. Same check for the other 4 functions. Skip with a reason only if git is unavailable.

## Decision to carry
Append D-20 to docs/superpowers/decision-log.md.

## Green gates
- `cd <worktree> && DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= $APP/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q`: floor 662 passed, 0 failed, plus the new E-tests.
- `python -c "import src.backend.app"` (or the app's import entry) succeeds with DATABRICKS_CONFIG_FILE=/dev/null.
- No frontend change → no build or lint needed.

## Out of scope
Coaching, `_COACH_SYSTEM`, the firewall, DDL 13, the kill switch, and any mcp_server.py edit (next task: coaching-explain-step).

## Findings

Measured on the worktree at base 3d5b700.

- **Line ranges @3d5b700.** The SDK guard is routes.py:427–434 (comment + try/except). The `SERVING_ENDPOINT_NAME` comment block starts at :441, not :440 (:440 is blank). It runs through `_extract_text` ending at :573. `call_databricks_serving_endpoint` is :1408–1886. The move cut :441–573 and :1408–1886 (plus the two trailing blank lines) by exact line range; the `# ==== Databricks Configuration` header and the OAuth note (:436–439) stay in routes.py above the re-export, and the `# ==== Databricks Serving Endpoint Functions` header stays above `enhance_prompt_with_llm` (llm.py carries a copy of that header).
- **AST closure of the 8 names.** The module-level free names are `os, asyncio, logger, Any, Dict, List, Optional, HTTPException, DATABRICKS_SDK_AVAILABLE` plus the moved names themselves (`make_request` is a nested def). `json` and `time` are not free at module level: the function imports both locally (`import time`, `import json as json_lib`, `import json`). So llm.py imports `asyncio, logging, os`, `typing (Any, Dict, List, Optional)`, and `fastapi.HTTPException`, plus the verbatim SDK try/except. It has no module-level `json`/`time` import, which would be unused.
- **routes.py keeps its own SDK guard.** `DATABRICKS_SDK_AVAILABLE` is still read in routes.py at :2227 and :2252 (the serving-status endpoint), so the guard is duplicated, not moved. Side effect: only when databricks-sdk is NOT installed, the "Databricks SDK not available" warning is logged twice (once per logger). The SDK is pinned (D-3), so a deployed app never hits this.
- **Singleton.** routes.py now has no `_workspace_client` or `_available_endpoints_cache` (verified by grep and E3). `lakebase.py` has its own unrelated `_workspace_client` and is untouched.
- **hackathon.py:33** imports from `src.backend.services.llm`. Checked: `hackathon.call_databricks_serving_endpoint is llm.call_databricks_serving_endpoint` → True, and `LLM_AVAILABLE` → True.
- **Not retargeted (outside the allowed list):** test_offload_fallback_paths.py:116, test_step_prompt_budget.py:331 and :559 still do `monkeypatch.setattr(routes, "DATABRICKS_SDK_AVAILABLE", True)`. The moved function now reads `llm.DATABRICKS_SDK_AVAILABLE`, so those three patches no longer reach it. The tests still pass because databricks-sdk is installed in the test venv (`llm.DATABRICKS_SDK_AVAILABLE` is already True). In an env without the SDK they would get the mock response. Possible follow-up: retarget those three lines to `llm` too. The TAMPER comments that cite `routes.py:~1605` in test_step_prompt_budget.py are also stale (the code is now in llm.py); they were left as is because only patch targets could change.
- **Gates.** Baseline before the change: 662 passed. After: 668 passed, 0 failed (662 + E1–E6). `import app` with `DATABRICKS_CONFIG_FILE=/dev/null` → FastAPI app object, no error.
- **Tampers (each run against test_llm_service.py, then restored byte-identical via cmp; none committed):**
  - T1 drop `call_databricks_serving_endpoint` from the routes re-export → E1 red.
  - T2 append `def get_workspace_client(): pass` to routes.py → E3 red (E1 and E4 red too).
  - T3 add `import src.backend.api.routes` to llm.py → E2 red.
  - T4 change `available!` to `available?` in a log string inside `call_databricks_serving_endpoint` → E6 red.
  - After restoring: 6/6 green.
