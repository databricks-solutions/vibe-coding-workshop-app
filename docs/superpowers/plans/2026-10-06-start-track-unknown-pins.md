# start-track-unknown-pins (tests only) — round 2 (r1 BLOCK folded in)

Base: origin/feature/genie-code-mcp-integration @ 5e0ed6e8b00525fb4f2fa314a033508088da123f.
PR plan path: docs/superpowers/plans/2026-10-06-start-track-unknown-pins.md

## Problem (#92 review, 22e4a82, nonblocking)
tests/workshop/test_start_track_unknown_usecase.py U1-U6 pin vibe_start_track's handling of an uncatalogued (industry, use_case) pair (D-13/D-15), but:
- no test drives lakebase._has_defined_intent (lakebase.py:1798, delegating to state.has_defined_intent, D-34) or lakebase._row_completion_globals (:1805-1824, step-1 union guarded by `if _has_defined_intent(row):` at :1821) on the row an unknown pair produces. An "industry-only" credit change would keep U2 green while handing App step-1 credit and analytics completion to an invented pair.
- no test passes session_id (the resume path).
## Correction from critic r1 (the #92 review's "skips the gate on resume" wording was wrong)
Shipped code decides (Rule 1): the curated-pair classification at mcp_server.py:1253-1265 runs for EVERY vibe_start_track call, resume included, BEFORE the `if not session_id` new-session block (:1266). On resume an unknown pair therefore sets use_case=None (and drops an uncatalogued industry) exactly as on a new session; the later `if industry and use_case and not engine.use_case_resolved(state)` (:1306) cannot resolve the gate; and an already-resolved session is never re-resolved. U8 pins THAT behavior.

## Change (tests only; no src/ change)
U7 (reusing the `env` fixture): start with use_case="bar", industry="travel" (unknown pair, catalogued industry); take the stored row; assert
  (a) lakebase._has_defined_intent(row) is False AND state.has_defined_intent(row) is False;
  (b) lakebase._row_completion_globals(row, inverse_map) does NOT contain global step 1 (build the inverse map the way the existing analytics tests do; cite the helper);
  (c) positive control: a known-pair row (U1's) gives True and contains step 1.
U8a (resume, gate not yet resolved): create a session with NO pair (the intent beat pending); then vibe_start_track(TRACK, session_id=<sid>, use_case="bar", industry="travel"); assert: result.session_id == sid; USE_CASE_GATE not in completed_gates; USE_CASE_BRIEF not in captured_outputs; "use_case" not in session_parameters; no new-session seed save for any other id; vibe_next_step(sid) is the intent beat.
U8b (resume, gate already resolved by a known pair): create with U1's known pair; snapshot the stored row; resume with use_case="bar", industry="travel"; assert completed_gates, captured_outputs[use_case_brief], the use_case column and session_parameters["use_case"] are unchanged (an unknown pair neither overwrites nor removes a confirmed pick).
Tampers (each restored byte-identically, sha256):
  X1 state.has_defined_intent → bool(row.get("industry")) → U7(a)/(b) red.
  X2 lakebase._row_completion_globals: drop the `if _has_defined_intent(row):` guard at :1821 (union step 1 unconditionally) → U7(b) red, U7(c) still green.
  X3 mcp_server.py:1253: add `not session_id and` to the classification condition (skip it on resume) → U8a red (the unknown use case lands in session_parameters and the gate resolves).
Fence: tests/workshop/test_start_track_unknown_usecase.py, the plan file. Suite floor 924; expected 927 (+U7, U8a, U8b).

## Live check
None (tests only). The prober confirms only that the merge touches no src/ file and tools/list = 7.
