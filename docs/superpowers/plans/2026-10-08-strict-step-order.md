# strict-step-order (D-78): the MCP walk can never skip an unfinished step

repo=app · base origin/feature/genie-code-mcp-integration (3725930) · plan path in PR: docs/superpowers/plans/2026-10-08-strict-step-order.md
Source: human-reported Genie Code kickoff (2026-10-08): after vibe_complete_step(project_setup) on genie-accelerator, `next` = semlayer_locate, skipping use_case_selection and prd_generation. Lead repro (offline, engine at 3725930): genie-accelerator after project_setup → engine.next_step = semlayer_locate while prd_generation is `locked`; the only track with an ungated step after the first is genie-accelerator (semlayer_locate, scripts/generate_manifest.py:139-141 `requiresGate: None`, unchanged since 0c8e1b0/8434cf0); the other 13 tracks return Blocked(prd_generation) (or skill_install_explore current on skills-accelerator) and are routed to the intent beat by vibe_next_step.

## Root cause (shipped code)
R1 engine.outline (engine.py:128-157) marks `current` the FIRST step that can_start, scanning PAST locked steps; next_step (:160-183) returns it. One ungated later step jumps the queue.
R2 engine.complete_step (engine.py:259-, :282) checks only can_start, so complete_step(semlayer_locate) succeeds on a fresh session.
R3 vibe_complete_step's `next` (mcp_server.py:1836, :1921 → _complete_next_payload :1926) uses engine.next_step directly and ignores _needs_use_case (:1075), unlike vibe_next_step (:1465-1469).

## Charter exception (trunk files): src/backend/workshop/engine.py, src/backend/mcp_server.py
Reason: the defect lives in the shared engine scan and the complete_step `next`; no leaf can fix it. Reversal: revert the PR (no data, no DDL, no seed, no manifest regeneration). Nothing else app-side is in flight.

## Changes
S1 engine.outline: STRICT ORDER. Walk the ordered steps; `done` / `skipped` as today; the FIRST step that is neither is `current` if can_start, else `locked`; every later not-done/not-skipped step is `locked`. next_step is unchanged in shape (current → Step; else first locked → Blocked; else Done); its docstring states the new invariant ("next is always the first unfinished, unskipped step, or Blocked on it"). /api/track/{track}/outline is a thin transport over engine.outline (routes.py:5375-5400), so MCP outline == SPA outline is preserved by construction.
S2 engine.complete_step: refuse STEP_LOCKED when the step's strict-outline status is `locked` (in addition to can_start). Already-done steps keep today's behaviour (idempotent, engine.py:274-279); skipped steps keep today's behaviour; off-outline steps that resolve_step still resolves (e.g. flag-filtered gold_layer_design) keep today's behaviour (no outline status; queue item off-outline-output-leak owns them). The intent-beat / use_case_selection paths in vibe_complete_step are unchanged.
S3 mcp_server: one helper used by vibe_next_step and by vibe_complete_step's `next` (both the normal path :1921 and the intent-beat idempotent path :1836): if _needs_use_case(state) → the intent-beat payload (exactly what vibe_next_step returns today), else _complete_next_payload(engine.next_step). Tool count stays 7; tool descriptions unchanged unless one now overclaims.
S4 NOT CHANGED (decision D-78, protocol (1)/(3)): semlayer_locate keeps `requiresGate: None` and empty consumes (shipped 8434cf0 aligned the manifest to the UI literals; S1 makes the missing gate harmless; a manifest change would also move the frozen-golden parity fixtures). Recorded as follow-up `semlayer-locate-gate` (gate on prd_generation + consumes prd_document), not done here. Also out of scope, recorded as follow-ups: showing the intent beat as an outline row (`intent-beat-in-outline`), refusing by-name vibe_get_step of numbered steps while the use case is unpicked.
S5 decision-log catch-up in docs/superpowers/decision-log.md: D-74 (human (ii)), D-76 (resolved by forge 3204841: per-line multiset gate, --reworded), D-78 (this task).

## Tests (new tests/workshop/test_strict_step_order.py; existing tests updated only where they pin the scan-ahead)
T1 genie-accelerator: complete project_setup → engine.next_step is Blocked(prd_generation) (not semlayer_locate); outline: prd_generation locked, semlayer_locate locked.
T2 invariant, every one of the 14 tracks (manifest `tracks`, default flags): for every prefix k of the ordered outline, completing steps[0:k] → next_step is steps[k] (Step if can_start else Blocked naming steps[k]) or Done when k == len; outline has at most one `current` and it is the first unfinished step.
T3 complete_step(semlayer_locate) on a fresh genie-accelerator session → STEP_LOCKED; after prefix through prd_generation → ok.
T4 MCP: vibe_complete_step(project_setup) on a session with no use case → `next` is the use_case_selection intent beat (same payload sectionTag/title as vibe_next_step); with the use case locked → `next` is prd_generation.
T5 MCP outline (the outline carried in the vibe_get_step / vibe_next_step payloads; there is no outline tool, the 7 tools are start_track, get_step, next_step, explain_step, complete_step, submit_answer, set_parameters) == GET /api/track/{track}/outline for one session_id after project_setup (statuses equal, semlayer_locate locked in both).
T6 skipped steps still pass: a session whose skipped_gates names an outline step → next_step skips it as today.
Suite floor 1666 (must be ≥ 1666 + new tests; report counts). List every pre-existing test changed and why (only scan-ahead pins may change).

## Green gates
pytest: `cd <worktree> && DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= $APP/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q` ≥ 1666 passed, 0 failed. No frontend change (if one is needed, npm run build + eslint on the files). No seed/DDL/manifest change → no genie gate and reseed=no. Fence: engine.py, mcp_server.py, the new test file, scan-ahead test fixes, the plan, decision-log.md.

## Tampers (critic writes the spec)
X1 restore the scan-ahead in outline (current = first can_start step) → T1/T2 red.
X2 drop the S2 locked check → T3 red.
X3 make complete_step's `next` call engine.next_step directly again → T4 red.
X4 allow two `current` rows → T2 red.

## Live checks (prober, read-only except through app endpoints)
L1 /health 200; 7 MCP tools.
L2 fresh genie-accelerator session via vibe_start_track (no use case): vibe_complete_step(project_setup) → `next` = use_case_selection intent beat; vibe_complete_step(semlayer_locate) → STEP_LOCKED.
L3 lock a curated use case → vibe_next_step = prd_generation; the MCP payload outline shows semlayer_locate locked; GET /api/track/genie-accelerator/outline for the same session_id has equal statuses.
L4 one non-genie track (app-only): start → complete project_setup → `next` = intent beat; after lock → prd_generation.
L5 logs: 0 Traceback/ERROR over the probe window.

## Release
MERGE repo=app reseed=no. RC #130's head moves → #130 gets a re-review + re-gate before the human merges it (D-78).

## Reverse
Revert the PR (code only).
