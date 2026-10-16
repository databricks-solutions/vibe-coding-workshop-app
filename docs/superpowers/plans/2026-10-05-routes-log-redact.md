# routes-log-redact (app) — plan, revision 2 (after critic BLOCK round 1)

Repo: app. Base: origin/feature/genie-code-mcp-integration @ 4b57581 (#103 merged).
Plan file in PR: docs/superpowers/plans/2026-10-05-routes-log-redact.md
Scope: B (security hygiene, the second half of D-27). Lane: T (trunk: src/backend/api/routes.py). Reseed: no.

## Revision note (all 5 round-1 findings addressed)
1. The grep-based diff check was brittle → replaced by an AST equivalence test (R8, below).
2. Missed sites → the full enumeration below is now the binding scope (the critic's list at 4b57581).
3. Class name alone is weak for code-less errors → D-28 now also logs safe CONTEXT (operation, endpoint name, attempt, status/error_code, message length).
4. The taint check missed body-derived text (llm.py:618 error_str) → R4 also taints response-body reads (`.decode()`, `.text`, `.json()`, `.content`, `.read()`). It checks ONLY logger calls (never HTTPException detail, so llm.py:629 stays unflagged and unchanged).
5. E6 handled one function only → E6_INTENTIONAL_EDITS becomes per-function.

## Why (evidence)
critic-llm-response-log-redact A3 (routes.py:1220); #103 reviewer nonblocking #1/#2; critic-routes-log-redact round 1; D7 security.md §6/§8. App log level is INFO (src/backend/services/lakebase.py:25 basicConfig, :31 setLevel), so DEBUG records are off in prod.

## Decision D-28 (error logging, revised)
For model-call paths: error/warning logs keep (a) the operation (a fixed string, e.g. "serving query", "stream", "workspace client init"), (b) the endpoint name where in scope, (c) the attempt number where in scope, (d) `type(e).__name__`, (e) `getattr(e, "status_code", None)` / the HTTP status, (f) `getattr(e, "error_code", None)`, and (g) `len(str(e))` (the message length, not the text). They drop the message text and any response-body text. The full traceback is logged only at DEBUG via `logger.debug("…", exc_info=True)`. Rule (3): reversible per line.

## Binding scope: every listed logger call (locations at 4b57581)
routes.py (trunk):
- generate_prompt_content_with_llm: :1220 (generated_prompt preview → DELETE; the length is already at :1218), :1241 (str(e) → D-28), :1244 (traceback.format_exc() → DEBUG exc_info).
- _stream_with_retry: :1555 (auth_err → D-28), :1563 (err_msg, the HTTP body → status + error_code only), :1628 (e → D-28), :1639 (e → D-28), :1643 (last_error_msg → D-28: keep class/status; drop text).
- collect_step_prompt_via_stream: :1797 (warning with exc_info=True → keep the warning text, which holds no content, but move exc_info to a DEBUG companion line).
- All other logger calls in those functions are confirmed safe by the critic (:1157-1162, :1175, :1176, :1179, :1218, :1219, :1225, :1242, :1245, :1568, :1679, :1822): do not touch them.
- Removing an import that becomes unused (e.g. `traceback` near :1243, if function-local) is allowed and must be listed.
llm.py (not trunk):
- get_workspace_client: :67 (e → D-28), :69 (traceback.format_exc() → DEBUG exc_info).
- get_available_serving_endpoints: :96 (e → D-28).
- call_databricks_serving_endpoint: :342, :384, :397, :428, :437, :446, :454, :616-620 (error_str from the response body → status + error_code + length only).
- llm.py:629 HTTPException(detail=…) is OUT of scope (a client response, not a log; "no HTTP-response changes").
Every edited line is listed in the PR body as old → new.

## Changes
1. routes.py and llm.py: exactly the binding scope above, applying D-28. No control-flow, return-value, exception-raised, or HTTP-response change.
2. tests/workshop/test_llm_service.py, E6 only: `E6_INTENTIONAL_EDITS` becomes `{function_name: [(old_line, new_line_or_None), …]}` covering get_workspace_client, get_available_serving_endpoints and call_databricks_serving_endpoint (#103's 5 pairs + this PR's). For each moved function: apply its edits (each exactly once), then assert byte identity with routes.py@3d5b700; functions with no edits are still compared raw. Keep `E6_EDITED_FUNCTION` removed or replaced by the dict. Comment: "llm-response-log-redact (D-27) + routes-log-redact (D-28)".
3. tests/workshop/test_llm_log_redaction.py:
   - R5: an exception whose str() holds marker "ZQX-ERR-PLANTED-4419", raised from the SDK fake in call_databricks_serving_endpoint and from the workspace-client factory → no record at INFO+ contains the marker; the DEBUG traceback may.
   - R6: routes _stream_with_retry with a mocked non-200 response whose body holds the marker → no INFO+ record contains it (also the auth-error and retry-exhausted branches).
   - R7: routes generate_prompt_content_with_llm with a generated prompt holding the marker → no INFO+ record contains it; and its exception branch with the marker in the exception → clean at INFO+.
   - R4 hardened (applies to llm.py's 3 functions and the 4 routes.py functions above): a logger-call arg is forbidden if it references (a) a content name (the #103 list), (b) an `except … as <name>` name, (c) any local assigned (transitively) from (a)/(b), from str()/repr()/slicing/f-string of them, or from a response-body read (`.decode()`, `.text`, `.json()`, `.content`, `.read()`), or (d) `traceback.format_exc()`. It's allowed only through type(x).__name__, len(...), getattr(x, "status_code"|"error_code", …) or .keys(). Only logger calls are checked. Self-checks: the alias case, `{openai_err}`, `error_str` at llm.py:618, and an HTTPException detail are NOT flagged.
   - R8 AST equivalence: for each edited function in routes.py and llm.py, parse the function at 4b57581 (`git show`) and at HEAD, remove every statement that is a logger call (`logger.<level>(...)` expression statements), remove a now-unused `import traceback`, then assert ast.dump equality. This proves no non-log change. Skip only if git is absent; fail if the base object is missing (D-21).
4. docs/superpowers/decision-log.md: append D-28 (revised text above) as one log line.

## Fence
src/backend/api/routes.py (trunk; the binding-scope lines only) · src/backend/services/llm.py · tests/workshop/test_llm_service.py (E6 only) · tests/workshop/test_llm_log_redaction.py · docs/superpowers/plans/2026-10-05-routes-log-redact.md (new) · docs/superpowers/decision-log.md.

## Acceptance
- R1–R8 green; E6 green with exactly the listed edits per function; all other tests unchanged and green.
- Backend suite ≥ 728 + new, 0 failed. 7 tools.

## Green gates
cd <worktree> && DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= $APP/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q → ≥ 728 + new, 0 failed.

## Live checks (for the critic to finalize)
After the code-only deploy: (L1) deployed routes.py and llm.py sha256 = git. (L2) Trigger a web step-prompt generation for an LLM section (e.g. prd_generation on a resolved session, through the same REST path the SPA uses) and one MCP vibe_get_step on an LLM step; a server-side `--search` (with the default tail and a 45 s alarm; `--tail-lines 0` hangs) for "Response preview:" and "Traceback" after the deploy → 0. (L3) Both return a prompt. (L4) 7 tools; 0 ERROR.
