# Phase 3 exit report (2026-10-04)

Base: `feature/genie-code-mcp-integration` at 0f05bed (#95). The exit-gate tests were re-run on top of #95: the backend suite is 662 passed, 0 failed, 0 xfailed (the #95 floor of 640 plus the 22 exit-gate tests).

## Exit criteria

| # | Criterion | Evidence | Verdict |
|---|---|---|---|
| (a) | The outline matches the golden matrix and stays that way | `tests/workshop/test_outline_parity.py` checks `engine.outline` against the FROZEN golden matrix: all 14 tracks and every legal flag/axis cell (65 cells). `test_phase3_exit_gate.py::test_x1_*` also requires both read paths to equal the golden `ts` order for each pinned session. | **PASS** |
| (b) | No number-key consumers | `test_phase3_exit_gate.py::test_x3_every_numeric_step_set_read_is_allowlisted`: every direct read of the numeric `completedSteps`/`skippedSteps` sets has a reason on an exact-count allowlist, and any new read fails the test (findings F4). `test_x3_numeric_sets_are_gate_derived` shows that every set those reads see comes from the gates (`deriveCompletedStepNumbers` / `deriveSkippedStepNumbers` hydration, `mergeStatus` projection, `stepNumbersToGates` writes). Number-keyed reads remain (WorkflowDiagram's step components are number-addressed), but no remaining read is keyed by a number that didn't come from a gate, except the step-1 intent overlay (F4 correction below). `test_x3b_every_numeric_step_set_copy_is_allowlisted` and `test_x3c_every_numeric_step_literal_add_is_allowlisted` extend the scan to copy-based reads and numeric `.add(<n>)` writes. | **PASS** (allowlisted reads; see F4, F5) |
| (c) | MCP outline == SPA outline for one session_id (tests + live) | Tests: `test_x1_mcp_outline_equals_spa_outline_for_one_session` (14 defaults, `genie-accelerator:flags:includeLakehouse`, `end-to-end:direction:reverse`, `lakehouse:climb:app`), `test_x1_genie_accelerator_include_lakehouse_on_and_off`, and `test_x2_mcp_and_app_completions_read_back_identically` (step A via MCP `vibe_complete_step`, step B via `POST /api/session/update-metadata` with `base_completed_gates`, and `vibe_next_step` agreeing with the SPA's current step). No mismatch, no xfail. Live: the L1 probe (`state/specs/phase3-exit-gate/live_checks.md`) is reported in the PR body by name once the release role runs it. | **PASS** (tests). Live: pending the L1 probe report |

Tampers (all red, product code restored byte-identically, `git status` clean after each):
- T1 (reverse the HTTP outline) turns 20 X1 and X2 tests red.
- T2 (reverse `_outline_items`) turns 20 red.
- T3 (`completedSteps.has(999)` in App.tsx) turns X3 red.
- T4 (update-metadata skips the completed-gates write) turns X2 red.
- X3b tamper (`const copy = Array.from(completedSteps);` at App.tsx:315) turns X3b red; X3c tamper (`completedSteps.add(7);` at App.tsx:460) turns X3c red (x3-allowlist-widen).

## F4 correction (x3-allowlist-widen)

F4 (in `2026-10-04-phase3-exit-gate.md`) and the X3 allowlist comment said the App hydrates `completedSteps`/`skippedSteps` only from the gates. That overstates it. Both hydration paths derive the sets from `completed_gates`/`skipped_gates` (App.tsx:453 and :616), and both then add step 1 when the session has an industry and a use case (`restoredCompleted.add(1)` at App.tsx:459, `loadedCompleted.add(1)` at App.tsx:622). The overlay isn't display-only. It is written back: `handleSaveSession` sends `completed_gates: stepNumbersToGates(Array.from(completedSteps))` (App.tsx:994), and `handleCompletedStepsChange` sends `stepNumbersToGates(Array.from(newSteps))` (App.tsx:775), seeded from the projected set that includes it. `stepNumbersToGates` maps step 1 to `ALL_STEPS[1].sectionTag`, which is `usecase_selection` (workflowSections.ts:392, :523). That is the App's step-1 gate (manifest global 1). It is not the engine's `use_case_selection` gate, which has no global number (gate_merge.py:20). This matches the backend, which credits step 1 from the same rule at aggregation (lakebase.py:1746), and it matches D-15: a defined industry and use case is the intent that step 1 records. `test_x3b_every_numeric_step_set_copy_is_allowlisted` pins the copy-based reads (App.tsx 8, LevelSelector.tsx 1, WorkflowDiagram.tsx 8, scoring.ts 3). `test_x3c_every_numeric_step_literal_add_is_allowlisted` pins the three numeric adds (App.tsx 2, WorkflowDiagram.tsx:716 1) and checks that each one is step 1 and that step 1 is `usecase_selection`.

## Phase 3 merges (#80–#95)

| PR | Merge | Title |
|---|---|---|
| #80 | c280933 | fix(mcp): handle engine.Blocked at every secondary next_step consumer (T5) |
| #81 | 3b893e7 | chore(deps): pin databricks-sdk==0.139.0 (Phase 3 cleanup) |
| #82 | 45d89dc | test(mcp): pin untested offload + fallback paths from #77/#78/#79 |
| #83 | 2cecfe4 | chore(mcp): Phase 3 post-soak nits + drop dead skippedSteps alias |
| #84 | f97f813 | fix(session): close the _merge_app_gates read-modify-write race |
| #85 | 4d93628 | post-check-answerable: accept completed steps' post comprehension answers |
| #86 | ad64c10 | intent-beat-explain-complete: explain and complete agree with get/next on the use-case beat |
| #87 | f0d4d59 | frontend-lint-baseline: repo-wide lint to 0 errors |
| #88 | 7479b29 | mcp-gates-race: MCP writes persist their delta under a row lock |
| #89 | e6af06f | workflowstep-session-switch-restore: restore the target session's prompt on an in-page switch |
| #90 | 957157f | app-save-drops-unseen-mcp-gates: App gate writes merge against the gate set the SPA last saw |
| #91 | 64f0772 | usecase-beat-seed-prereq: the use-case beat has no project_setup prerequisite (seed text) |
| #92 | 49aa634 | start-track-unknown-usecase: ignore an uncatalogued use case at vibe_start_track |
| #93 | 44f4fd7 | resolve-step-fallback: define and pin the authored-manifest fallback for filtered steps |
| #94 | 17e8767 | next-ref-filtered-step: get_step's next for a filtered step points at the next outline step |
| #95 | 0f05bed | dedicated-thread-pool: a dedicated default executor sized for a live workshop (D-18); deployed, probe PASS 5/5. Backend only (app.py, src/backend/executor.py): no outline or parity impact, and no frontend change, so the F4 allowlist counts are unchanged |

## Open ledger (B items carried past the exit gate)

- usecase-beat-post-check
- gatebase-write-seq
- workflowstep-stream-generation-token
- start-track-unknown-pins
- off-outline-output-leak
- complete-project-setup-latency
- visibility-400-fresh-session
- llm-service-extract
- header-count-projection (new, from this gate's F5): the App header progress count reads the local `completedSteps.size`, not the `mergeStatus` projection. It's display-only and lags MCP completions until re-hydration.
