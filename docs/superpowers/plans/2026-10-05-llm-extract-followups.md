# llm-extract-followups (app) — plan

Repo: app (databricks-solutions/vibe-coding-workshop-app). Base: origin/feature/genie-code-mcp-integration @ a175f3a (#98 llm-service-extract merged).
Plan file in PR: docs/superpowers/plans/2026-10-05-llm-extract-followups.md
Scope: B. Lane: L (tests + docs only; NO product code; no trunk file).

## Why
#98's reviewer (verdict 03d0153.reviewer.json) left 4 non-blocking findings, and each one makes an existing pin less reliable:
1. Three tests still call `monkeypatch.setattr(routes, "DATABRICKS_SDK_AVAILABLE", True)`: tests/workshop/test_offload_fallback_paths.py:116, tests/workshop/test_step_prompt_budget.py:331 and :559. The moved function now reads `llm.DATABRICKS_SDK_AVAILABLE` (src/backend/services/llm.py:208), so these patches are dead. On a machine without the SDK, those tests would take the mock branch at llm.py:208-215 instead of the fake client, and the off-loop pins would pass vacuously.
2. tests/workshop/test_step_prompt_budget.py:329-330: the TAMPER comment cites "the asyncio.to_thread wrapper at routes.py:~1605". It now lives at src/backend/services/llm.py:368 (the agent fallback is at :393).
3. tests/workshop/test_llm_service.py:151-160 (`_base_routes_source`): E6 calls pytest.skip when `git show 3d5b700:src/backend/api/routes.py` fails, not only when git is missing, so a clone without that object silently drops the body-fidelity pin. Decision D-21: fail in that case (the app has no CI; forge gates use full-history worktrees).
4. docs/specs/mcp_design/mcp-workshop-architecture.md still says the FMAPI call and the endpoint constant "live today in the API layer" at routes.py:1400 / :440 (lines 30, 87-88, 106, 298).

## Changes (exact)
A. Tests (patch targets only; no assertion changes):
   - test_offload_fallback_paths.py:116, test_step_prompt_budget.py:331 and :559: `routes` → `llm` for DATABRICKS_SDK_AVAILABLE. Each file already imports `from src.backend.services import llm`.
   - test_step_prompt_budget.py:329-330: the comment now cites `src/backend/services/llm.py:~368` (`asyncio.to_thread(` around the SDK `api_client.do()` call). Keep the tamper semantics.
B. test_llm_service.py:
   - `_base_routes_source`: keep `pytest.skip` only for `shutil.which("git") is None`. When returncode != 0, call `pytest.fail(f"base SHA {BASE_SHA} is not in this clone; fetch full history (git fetch --unshallow) — E6 must not skip: {stderr}")`.
   - NEW test E7 `test_e7_no_test_patches_a_moved_name_on_routes`: scan tests/**/*.py (excluding this file) with regex `monkeypatch\.setattr\(\s*routes\s*,\s*["'](NAME)["']` for every NAME in MOVED_FUNCTIONS + MOVED_STATE (+ DATABRICKS_SDK_AVAILABLE, which the moved code reads from llm). Assert zero hits, and list file:line on failure. Rationale: a patch on the routes re-export never reaches the moved code, as finding 1 showed.
     Note: if MOVED_STATE doesn't already include DATABRICKS_SDK_AVAILABLE, add it to E7's own name list, NOT to MOVED_STATE (it isn't one of the 8 moved names; it's an import-time flag that both modules hold).
C. Docs: mcp-workshop-architecture.md lines 30, 87-88, 106, 298. Point the locations at `src/backend/services/llm.py:166` (`call_databricks_serving_endpoint`) and `:36` (`SERVING_ENDPOINT_NAME`), and say routes.py re-exports them (D-20). The §1.2 intent stays. Line 298's row: change "extract" to "extracted (#98, D-20)" and keep the note that mcp_server.py's import is still Phase 2A. Don't touch any other row (27, 28, 283 are about other functions, still in routes.py).
D. docs/superpowers/decision-log.md: append D-21 verbatim from the lead's draft below.

D-21 (2026-10-05) · E6's base-object guard: skip or fail when git exists but 3d5b700 is missing? · Rule (1): the app repo has no CI (.github/ absent) and forge gates run in full-history worktrees; Rule (3): a fail with an actionable message is a one-line reversal · Choice: skip only when the git binary is absent; otherwise fail with "fetch full history" · Evidence: test_llm_service.py:151-160 @a175f3a; #98 reviewer nonblocking #3 · Reverse: restore pytest.skip on returncode != 0.

## Fence (only these files may change)
- docs/superpowers/plans/2026-10-05-llm-extract-followups.md (new)
- docs/superpowers/decision-log.md (append only)
- docs/specs/mcp_design/mcp-workshop-architecture.md
- tests/workshop/test_offload_fallback_paths.py
- tests/workshop/test_step_prompt_budget.py
- tests/workshop/test_llm_service.py

## Acceptance
- `git grep -n 'setattr(routes, "DATABRICKS_SDK_AVAILABLE"' -- tests` → 0 hits.
- E7 exists and is green. Re-adding a `monkeypatch.setattr(routes, "DATABRICKS_SDK_AVAILABLE", True)` line to any test file turns E7 red.
- E6 still passes in a full clone. With the base SHA replaced by a nonexistent 40-hex SHA (a tamper only, never committed), E6 FAILS rather than skips.
- mcp-workshop-architecture.md has no `routes.py:1400` or `routes.py:440` left (`git grep -n -E 'routes\.py:(1400|440)'` → 0).
- Backend suite: >= 665 passed (floor 664 + E7), 0 failed.

## Green gates
cd <worktree> && DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= $APP/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q  → >= 665 passed, 0 failed (floor 664).
No frontend, seed or genie-gate changes.

## Live check
None of its own (tests + docs, no backend diff). The prober may confirm that deployed src/backend equals git and that there are 7 MCP tools, as #97's L1 did.
Lead note (2026-10-05): floor is 668 at a175f3a (#98 merged), so the target is >= 669.
