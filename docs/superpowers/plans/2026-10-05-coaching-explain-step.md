# coaching-explain-step (app) — plan

Repo: app (databricks-solutions/vibe-coding-workshop-app). Base: origin/feature/genie-code-mcp-integration @ c63d6c8.
Plan file in PR: docs/superpowers/plans/2026-10-05-coaching-explain-step.md
Scope: B (Phase 2A, the core task). Lane: T (trunk: src/backend/mcp_server.py). Reseed: YES (new additive DDL db/lakebase/ddl/13_mcp_coaching.sql).
Decisions this PR carries into docs/superpowers/decision-log.md: D-22, D-23, D-24, D-25 (text at the end).

## Goal
Adaptive, grounded coaching delivered as a consolidation into the shipped `vibe_explain_step` (RUN.md §B; D9 rollout.md:42). The tool count stays 7. Coaching is on demand, read-only and fail-open: any model, timeout, endpoint, scrub or telemetry failure returns today's static StepHelpResult with `is_fallback: true`, never an isError.

## Charter exception (trunk file)
- File: src/backend/mcp_server.py.
- Reason: vibe_explain_step (≈:1400-1465) and StepHelpResult (≈:206-217) live there; the tool's signature, description and return type must change in place to keep 7 tools.
- Scope of the edit: (1) StepHelpResult gains 4 OPTIONAL fields with defaults; (2) vibe_explain_step gains an optional `focus` arg and, only when focus is given, calls services.coaching.coach(...) after building the static help; (3) the tool description adds one sentence on focus. Nothing else in mcp_server.py changes. The step-prompt machinery at ≈:710-900 is NOT edited (D-24).
- Reversal: revert the PR. DDL 13 is additive (two nullable/defaulted columns) and stays harmless if the code is reverted.

## Changes
1. NEW src/backend/services/coaching.py (all the coaching logic, so the trunk diff stays small):
   - `COACH_SYSTEM`: the D2 §12.2 text, with ONE change: it's track-neutral. "a hands-on Databricks \"Genie Accelerator\" workshop" becomes "a hands-on Databricks workshop (the track named in the CONTEXT)". All HARD RULES, FOCUS and STYLE lines are kept verbatim.
   - `FOCI = ("what_now", "why", "unblock", "review")`.
   - Knobs (D9 §9 q4), as module constants read once: `COACH_MAX_TOKENS = 400`, `COACH_BUDGET_S = 8.0`, `COACH_NEGATIVE_TTL_S = 300.0`, `COACH_TEMPERATURE = 0.3`; the endpoint is the app default (llm.SERVING_ENDPOINT_NAME via `call_databricks_serving_endpoint(endpoint_name=None)`), with no new endpoint or secret.
   - Kill switch: env `VIBE_COACHING_ENABLED`, default on; "0", "false", "off" or "no" (case-insensitive) disables it, and coach() returns the fallback immediately with no model call and reason "disabled". It's read per call, so flipping the env needs no code change.
   - `build_context(step, state, help, track, interactions) -> (user_message: str, grounded_on: list[str])`: the D2 §12.3 keys, from server-side sources only: focus, track, title, why, how_to_apply, expected_output, gate, execution, prompt (verbatim, labelled REFERENCE ONLY, capped at 4000 chars), captured_outputs (only the step's consumes/produces keys that are non-empty, each excerpt ≤ 600 chars after scrub_input), prior_answers (from interactions: interaction_id + answer, at most 10, newest first, kind != 'coaching'), and industry / use_case. `grounded_on` lists the non-empty keys, using `captured_outputs:<key>` for each output.
   - `scrub_input(text) -> str` and `scrub_output(text, *, forbidden_sources: list[str]) -> str | None` per D-25. scrub_output returns None to reject, and any exception inside it counts as a reject.
   - A single-flight / negative-cache helper (D-24) keyed by (session_id, sectionTag, focus): a success cache, an in-flight Future registry so joiners never start a second call, a negative entry written ONLY on a resolved true failure (exception, error/empty response, scrub reject), and none on budget abandonment, so a late success still caches. When the TTL expires, the next call retries. Off-loop: the model call runs through mcp_server's existing `_run_async_blocking(..., timeout_s=COACH_BUDGET_S)`, passed in by the caller as `run_blocking` to avoid a circular import.
   - `coach(*, session_id, step, state, help, focus, track, run_blocking) -> CoachOutcome(coaching: str | None, grounded_on: list[str], is_fallback: bool, reason: str)`. It never raises.
   - Telemetry: after the outcome, best-effort `lakebase.append_session_interaction(session_id, sectionTag, interaction_id=f"coach.{focus}", kind="coaching", answer=None, coaching_shown=<scrubbed text or None>, surface="mcp", is_fallback=..., focus=...)`. Exactly one row per coach() call that reaches the outcome, including cache hits and fallbacks. A False return or an exception is swallowed.
2. src/backend/services/lakebase.py (not trunk):
   - `append_session_interaction` gains keyword args `is_fallback: bool | None = None, focus: str | None = None`. When BOTH are None the INSERT is byte-identical to today's, so all existing callers are unchanged; otherwise the two columns are added to the INSERT.
   - NEW read-only `list_session_interactions(session_id, limit=10) -> list[dict]`, newest first, returning [] when Lakebase isn't configured or on any error (it never raises).
3. src/backend/mcp_server.py (trunk, see the exception above):
   - StepHelpResult adds `coaching: str | None = None`, `focus: Literal["what_now","why","unblock","review"] | None = None`, `grounded_on: list[str] = Field(default_factory=list)`, `is_fallback: bool = False`. extra="forbid" stays.
   - vibe_explain_step(session_id, sectionTag=None, focus=None, context=None). Unknown focus → `_error_result("INVALID_ARGUMENT", ...)` (check how the shipped code names invalid-arg errors and reuse that code). focus None → the exact current return (D-23). focus given → build the static help exactly as today, then call coaching.coach(...). The returned StepHelpResult carries the static fields unchanged, plus coaching / focus / grounded_on / is_fallback from the outcome. Track: `track_resolution.resolve_track(<session record>)` if the loaded record is available here; otherwise DEFAULT_TRACK. Say which in the PR. It's used only for the context's `track` key, and the walk logic is unchanged (P4.1 owns that).
   - Description: add "Pass `focus` (what_now | why | unblock | review) when the learner asks what to do now, why a step matters, is stuck, or wants a recap; you get grounded `coaching` text, which falls back to the static help with `is_fallback: true`."
4. NEW db/lakebase/ddl/13_mcp_coaching.sql: exactly D6 §7a (two `ALTER TABLE ${schema}.session_interactions ADD COLUMN IF NOT EXISTS …` lines, is_fallback BOOLEAN DEFAULT FALSE and focus VARCHAR(16)), with a header comment that it's additive, safe to re-run and depends on 12_. Applied by setup-lakebase.sh's sorted glob (scripts/setup-lakebase.sh:462). No DML, no index, no other DDL.
5. NEW tests/workshop/test_coaching.py (D8 §4a; offline, mocking `services.llm.call_databricks_serving_endpoint` and lakebase):
   - C1 grounding: an echo mock receives COACH_SYSTEM as system_prompt, max_tokens 400, and a user message holding only the §12.3 keys; grounded_on equals the non-empty keys.
   - C2 the system prompt carries the never-restate-the-prompt rule and no "Genie Accelerator" (track-neutral).
   - C3 fail-open: the mock raises → is_fallback true and the static fields equal the no-focus result, with no isError; the mock returns the "[Error] No serving endpoint…" dict → is_fallback true; a budget timeout (patched COACH_BUDGET_S plus a slow mock) → is_fallback true within budget + 1 s.
   - C4 kill switch: VIBE_COACHING_ENABLED=0 → no model call, is_fallback true.
   - C5 scrub: each D-25 pattern planted in the mock response → rejected (is_fallback true, coaching None, telemetry coaching_shown None); scrub_output raising → fallback; clean text passes through unchanged.
   - C6 read-only: before and after a focus call, completed_gates, captured_outputs, session_parameters and the next_step result are equal, and save_session / the gate writers are never called.
   - C7 provenance: exactly one append_session_interaction call with kind="coaching", interaction_id "coach.<focus>", focus, is_fallback; telemetry raising or returning False → the tool still returns normally.
   - C8 cache and single flight: two calls with the same (session, tag, focus) → 1 model call; a different focus → 2; N concurrent joiners → 1 model call.
   - C9 retry after failure: a failure writes a negative entry, and a call within the TTL returns the fallback with no model call; once the TTL passes (monkeypatched) the next call calls the model again and caches the success.
   - C10 late success: a budget abandonment writes NO negative entry, and the generation finishing afterwards populates the cache for the next call.
   - C11 no-focus parity: vibe_explain_step without focus returns exactly the pre-PR StepHelpResult fields (the model_dump minus the 4 new defaults equals the old shape), makes no model call and writes no telemetry.
   - C12 tool count stays 7, and vibe_explain_step's annotations are unchanged (readOnly, idempotent, openWorld true; destructive false).
   - C13 every track: coach() with a non-genie track name (e.g. "app-only") builds a context whose track is that name; no code path hard-codes genie-accelerator.
   - C14 lakebase: append_session_interaction with is_fallback / focus both None builds the same SQL text as today (snapshot the query string); with them set, it includes the 2 columns. list_session_interactions returns [] when not configured.
   - C15 DDL: 13_mcp_coaching.sql has only ADD COLUMN IF NOT EXISTS statements for those two columns on session_interactions (no DROP/ALTER TYPE/DELETE/UPDATE/TRUNCATE).
6. docs/superpowers/decision-log.md: append D-22..D-25.
7. docs/specs/mcp_design/mcp-workshop-architecture.md: in §3.5 (≈:242) only, a one-line note that coaching shipped as the vibe_explain_step `focus` extension (D-22), in services/coaching.py.

## Fence (only these files)
src/backend/services/coaching.py (new) · src/backend/services/lakebase.py · src/backend/mcp_server.py · db/lakebase/ddl/13_mcp_coaching.sql (new) · tests/workshop/test_coaching.py (new) · docs/superpowers/plans/2026-10-05-coaching-explain-step.md (new) · docs/superpowers/decision-log.md · docs/specs/mcp_design/mcp-workshop-architecture.md.
NOT allowed: any other src file, routes.py, engine.py, the seed SQL, manifest.json, generate_manifest.py, any frontend file, and any edit to an existing test file. If an existing test breaks, STOP and report; don't edit it.

## Acceptance
- C1–C15 green. All pre-existing tests unchanged and green: backend suite ≥ 673 + new (floor 673 at c63d6c8), 0 failed.
- `git diff origin/feature/genie-code-mcp-integration -- src/backend/mcp_server.py` touches only StepHelpResult, vibe_explain_step and its description, plus at most the imports.
- 7 tools.
- No new dependency (requirements unchanged).

## Green gates
cd <worktree> && DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= $APP/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q → ≥ 673 + |new tests| passed, 0 failed.
No frontend change (no npm build). Seed unchanged (no genie gate). DDL 13 → release runs with reseed=yes (tables-only, additive).

## Live checks (for the critic to finalize)
After deploy + reseed on fevm-serverless: (L1) the information_schema shows session_interactions.is_fallback and .focus; (L2) MCP vibe_explain_step without focus on a fresh session returns the static fields with is_fallback false and coaching null, in < 3 s; (L3) with focus="why" it returns non-empty coaching, is_fallback false, in ≤ 8 s + overhead, grounded_on including why/expected_output; a repeat call is a cache hit (< 1 s); (L4) exactly the expected session_interactions rows (kind='coaching', focus='why'); (L5) 7 tools; 0 Traceback/ERROR in the logs.

## Decision text (append to decision-log.md)
D-22 · coaching ships as an optional `focus` on vibe_explain_step (tool count 7), not the vibe_coach tool D2 §3.7 specced · Rule (2): D9 rollout.md:42 and RUN.md §B · Reverse: register vibe_coach over services/coaching.py.
D-23 · vibe_explain_step without focus returns today's static help unchanged (no model call) · Rule (3) · Reverse: default focus to what_now.
D-24 · coaching reuses _run_async_blocking and a single-flight / negative-cache helper in services/coaching.py; the step-prompt path is not migrated in this PR · Rule (3) · Reverse: delete the helper; step prompts are untouched.
D-25 · leakage scrub: reject (fail closed to the static fallback) on ≥ 8-word verbatim overlap with the prompt or captured outputs, secret-like tokens, emails, code fences or SQL statements; inputs are capped excerpts with data rows, secrets and emails dropped · Rule (3) · Reverse: loosen scrub_output / scrub_input.
