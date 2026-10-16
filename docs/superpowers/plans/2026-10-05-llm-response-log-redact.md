# llm-response-log-redact (app) — plan

Repo: app. Base: origin/feature/genie-code-mcp-integration @ 54e255e.
Plan file in PR: docs/superpowers/plans/2026-10-05-llm-response-log-redact.md
Scope: B (security hygiene for Phase 2A). Lane: L (src/backend/services/llm.py + tests/workshop/test_llm_service.py + a new test + docs; NOT trunk). Reseed: no.

## Why (evidence)
- Probe 54e255e (state/probes/54e255e…-coaching-scrub-tuning.md, finding 1): `src/backend/services/llm.py:407` logs `repr(query_response)[:500]` at INFO for every model call. That produced 10 lines of 604–608 chars in one probe, one of them the REJECTED coaching text, 1 ms before the scrub's reject line. `llm.py:575` also logs a 150-char `Preview:` of the content at INFO.
- D7 security.md §6 / §8 checklist: "No literals/PII in tool outputs, resources, or interaction logs". §6.1: coaching output is scrubbed "before it is returned … and before it is stored". Logging the raw model response before the scrub defeats that, because the log is a store. D-26 ("never log the text") holds for the reject line but is defeated app-wide by these two older lines (moved verbatim from routes.py in #98, D-20).

## Changes
1. src/backend/services/llm.py, inside `call_databricks_serving_endpoint` only:
   - :407 `logger.info(f"  Response repr: {repr(query_response)[:500]}")` → `logger.info(f"  Response received: type={type(query_response).__name__}")`. Keep the elapsed-time logic untouched.
   - :575 `logger.info(f"     Preview: {preview}{'...' if len(str(content)) > 150 else ''}")` → delete it, along with the `preview = …` assignment that feeds it if nothing else uses it. Keep the `Response length:` line at :572.
   - Audit the rest of llm.py for any other log call that interpolates model output, prompt text or system_prompt text (`grep -n "logger\." src/backend/services/llm.py`). List each one in the PR. Redact any that interpolate content to type/length only. Lines that log only types, keys, lengths, endpoint names or status are fine. NO other behavior change: the same return values and the same exceptions.
2. tests/workshop/test_llm_service.py, E6 (≈:176): today it asserts the moved bodies are byte-identical to routes.py@3d5b700. Keep that for every moved function EXCEPT call_databricks_serving_endpoint. For that one, assert byte identity after applying an explicit, ordered `E6_INTENTIONAL_EDITS` list of (old_line, new_line_or_None) pairs, exactly the redactions from change 1. Each pair must apply exactly once (the old line is found exactly once in the base body), and any OTHER difference stays red. Comment: "post-move intentional edits (llm-response-log-redact, D-27)".
3. NEW tests/workshop/test_llm_log_redaction.py:
   - R1: with the fake SDK client from test_llm_service.py (or an equivalent local fake) returning a response whose content holds a unique planted marker string (e.g. "ZQX-PLANTED-7731"), call `llm.call_databricks_serving_endpoint` and assert caplog (all levels, logger src.backend.services.llm) contains NO record including the marker, nor any 20-char substring of the content.
   - R2: same for the agent-format fallback path (the `make_request` branch, test_step_prompt_budget.py's _FakeClientAgentFallback pattern), if that path logs content.
   - R3: the returned dict is unchanged ("response" equals the planted content).
   - R4: a static scan of src/backend/services/llm.py (AST): no `logger.*` call has an f-string or `%` argument that references the names `query_response`, `response`, `content`, `preview`, `prompt`, `system_prompt` or `result` other than through `type(...)`, `len(...)` or `.keys()`. List the allowed forms explicitly in the test.
4. docs/superpowers/decision-log.md: append D-27 (below).

## Fence
src/backend/services/llm.py · tests/workshop/test_llm_service.py (E6 only) · tests/workshop/test_llm_log_redaction.py (new) · docs/superpowers/plans/2026-10-05-llm-response-log-redact.md (new) · docs/superpowers/decision-log.md. No other file. Not routes.py, mcp_server.py or coaching.py.

## Acceptance
- R1–R4 green; E6 green with exactly the listed intentional edits; every other test unchanged and green.
- Backend suite ≥ 721 + new, 0 failed. 7 tools.

## Green gates
cd <worktree> && DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= $APP/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q → ≥ 721 + new, 0 failed.

## Live checks (for the critic to finalize)
After the code-only deploy: (L1) deployed llm.py sha256 = git. (L2) On a fresh resolved session, one vibe_explain_step(focus="why") and one POST /api/llm/chat with a planted marker in the prompt ("Reply with exactly: ZQX-LIVE-<random>"); then the app logs (use `--search` for the marker, since the plain tail window can miss early lines, per probe 54e255e) contain 0 lines with the marker and 0 "Response repr:" or "Preview:" lines from after the deploy. (L3) Both calls still succeed (chat 200 with the marker in the body; coaching non-fallback or a logged rule). (L4) 7 tools; 0 Traceback/ERROR.

## Decision text (append to decision-log.md)
D-27 (2026-10-05) · The model-response content logging in llm.py (:407 repr[:500], :575 preview), moved verbatim from routes.py in #98, writes unscrubbed model output (including rejected coaching text) to the app log, defeating D7 §6.1's scrub-before-store · Rule (2): D7 §6/§8 forbids literals in logs · Choice: log type/length only; E6's byte-identity pin allows exactly these listed edits · Evidence: probe 54e255e finding 1; llm.py:407, :575 @54e255e · Reverse: restore the two log lines and drop E6_INTENTIONAL_EDITS.

## Critic amendments (2026-10-05)
- A1) llm.py:477 `value={val_preview}` (val_preview = str(val)[:100], which can hold up to 100 chars of the model's `choices`) is a third content leak; redact it to type/length only and add it to E6_INTENTIONAL_EDITS.
- A2) R4's static scan must also treat `val` and `val_preview` (and any other name that holds model output in that function; enumerate them by reading the code) as forbidden unless wrapped in type()/len()/.keys().
- A3) routes.py:1220 (generated_prompt[:200]) is OUT of scope (trunk) and the lead queues it; do NOT touch routes.py.
