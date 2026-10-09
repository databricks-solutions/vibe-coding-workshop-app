# coaching-latency (app) — plan, revision 2 (after critic BLOCK round 1)

Repo: app. Base: origin/feature/genie-code-mcp-integration @ 429eb46.
Plan file in PR: docs/superpowers/plans/2026-10-05-coaching-latency.md
Scope: B. Lane: L (src/backend/services/coaching.py + tests/workshop/test_coaching.py + docs; NOT trunk). Reseed: no.

## Revision note (round-1 BLOCK accepted in full)
Round 1 shrank max_tokens (400 → 300) and the input caps, with an unfalsifiable live target. The critic showed that (1) replies are 80–200 tokens, so the token cap never binds, and the input trim barely moves time to first token; (2) 300 tokens violates the human-signed D9 §9 q4 "≈400", and the [1, 30] budget clamp is an unauthorized policy; (3) the Lakebase read `list_session_interactions` (coaching.py:448-449) and build_context (:452) run BEFORE the timed `_single_flight` window (:459, run_blocking :383), so their latency is unbudgeted and unmeasured; (4) test_coaching.py:193 pins max_tokens == 400.
Revision 2 is MEASURE FIRST, with NO default changed: every D9 §9 q4 knob keeps its signed value (max_tokens 400, budget 8.0 s, app-default endpoint), and the caps are unchanged (PROMPT_CAP 4000, OUTPUT_EXCERPT_CAP 600, PRIOR_ANSWERS_CAP 10). The PR adds (a) per-phase timing logs without content, and (b) operator env overrides whose defaults are the signed values. Whether to raise the budget is a HUMAN decision recorded as an open question in the Phase 2A gate report, not taken here.

## Why (evidence)
Probe 54e255e L4: prd_generation coaching fell back 4/4 at 8.10–8.14 s (the model finished 8.2–11.3 s after each call started); project_setup 6.4–8.0 s. Nobody knows how much of that is the Lakebase read, context assembly, time to first token, or generation. coaching.py:64-71 @429eb46.

## Decision D-29 (revised)
Rule (3): instrument, and expose the signed knobs as env overrides without changing any default. VIBE_COACH_BUDGET_S (default 8.0), VIBE_COACH_MAX_TOKENS (default 400), VIBE_COACH_PROMPT_CAP (default 4000), VIBE_COACH_EXCERPT_CAP (default 600), read per call. A value that is non-numeric or ≤ 0 → the default plus one WARNING naming the variable (not the value). No other clamp. An env override is an operator decision, outside this run. Reverse: remove the overrides and the timing line.

## Changes (coaching.py only)
1. `_knob(name, default, cast)` reads os.environ per call (non-numeric / ≤ 0 → the default + a WARNING with the variable name only). Use it for the four knobs; the module constants stay as the defaults, with their current values.
2. Timing: coach() measures, with time.monotonic(), the prior-interactions read (db_ms), build_context (build_ms), and the single-flight/model phase (model_ms, the wall time of the _single_flight call; for a cache hit it's ~0). Emit ONE INFO line per coach() outcome: `"coaching timings section=%s focus=%s db_ms=%d build_ms=%d model_ms=%d total_ms=%d outcome=%s cache=%s"`, where outcome ∈ {coached, fallback:<reason>} and cache ∈ {hit, miss, joined, negative}. No text, no prompt, no context. The disabled kill switch emits nothing (D-25a, no work done).
3. No change to COACH_SYSTEM, the scrub, the negative-cache or late-success semantics, telemetry rows, the cache key, the caps' values, or mcp_server.py.

## Tests (test_coaching.py, additions only; no existing assertion changed)
- C17 defaults unchanged: with no env set, max_tokens 400 reaches the model (consistent with the existing :193 pin), timeout_s 8.0 reaches run_blocking, and the caps are 4000/600.
- C18 env overrides: each VIBE_COACH_* override is honored per call (no reload); "abc", "0" and "-1" → the default plus a WARNING containing the variable name and NOT the value.
- C19 timing line: exactly one INFO `coaching timings` line per coach() outcome, with db_ms/build_ms/model_ms/total_ms integers ≥ 0, the correct outcome and cache labels (miss, hit, negative, joined each exercised), and no ≥ 20-char substring of the prompt, the context or the model text (caplog). None when disabled.

## Fence
src/backend/services/coaching.py · tests/workshop/test_coaching.py · docs/superpowers/plans/2026-10-05-coaching-latency.md (new) · docs/superpowers/decision-log.md (append D-29).

## Acceptance
- C17–C19 green; all existing tests unchanged and green (including :193). Backend suite ≥ 761 + new, 0 failed. 7 tools.
- `git diff -- src/backend/services/coaching.py` leaves COACH_MAX_TOKENS, COACH_BUDGET_S, PROMPT_CAP, OUTPUT_EXCERPT_CAP and PRIOR_ANSWERS_CAP values unchanged.

## Green gates
cd <worktree> && DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= $APP/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q → ≥ 761 + new, 0 failed.

## Live checks (for the critic to finalize)
After the code-only deploy (no env override set): (L1) deployed coaching.py sha256 = git. (L2) MEASUREMENT, falsifiable on the instrumentation: a fresh resolved session (travel/ai_driven_booking), 4 foci × {project_setup, prd_generation}, first calls, then one repeat per step. PASS iff every call yields exactly one `coaching timings` line whose phases sum to within ±10% (or ±100 ms) of total_ms, the repeat shows cache=hit, no line contains content (searched server-side), and the fallback count is ≤ the 54e255e baseline (prd 4/4, setup 0/4). Report the per-phase breakdown (median db_ms / build_ms / model_ms per step) as input for the human budget decision. (L3) 7 tools; 0 ERROR; 0 Traceback.

## Decision text (append to decision-log.md)
D-29 (2026-10-05) · Coaching latency after probe 54e255e (prd_generation 4/4 budget fallbacks): MEASURE FIRST, with no default changed. Per-phase timing logs (db/build/model/total, outcome, cache; no content) and operator env overrides VIBE_COACH_BUDGET_S / _MAX_TOKENS / _PROMPT_CAP / _EXCERPT_CAP whose defaults are the D9 §9 q4 signed values (8.0 s, 400) and today's caps (4000/600); invalid → default. Raising the budget is a human decision, recorded as an open question in the Phase 2A gate report · Rule (3); critic-coaching-latency round 1 (the token cap doesn't bind; the D9 knobs are human-signed; the Lakebase read sits outside the timed window) · Reverse: remove the overrides and the timing line.
