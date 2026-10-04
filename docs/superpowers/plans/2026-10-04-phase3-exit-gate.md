# phase3-exit-gate

## Source (D9 §7 row 3 plus the Phase 3 charter EXIT GATE)
The exit gate requires: (a) parity stable; (b) no number-key consumers; (c) the MCP outline == the SPA outline for one session_id (tests + live). Existing coverage: tests/workshop/test_outline_parity.py pins engine.outline against the FROZEN golden matrix for all 14 tracks and every legal flag/axis cell. That is (a) for the engine. What is NOT pinned is the two READ PATHS agreeing for the SAME session: MCP `vibe_start_track(...).outline` (mcp_server `_outline_items` ~:578) versus the SPA's `GET /api/track/{track}/outline?session_id=` (routes.py:6005, the T3c read-path authority).

## Change (tests + docs; no product code)
1. tests/workshop/test_phase3_exit_gate.py:
   - X1 (same-session parity): for each of the 14 tracks at their default cell, plus genie-accelerator with includeLakehouse on and off, plus one reverse and one climb variant from the golden matrix (tests/workshop/fixtures/golden_outline_matrix.json), create ONE session state. Compute the MCP outline (via the same function vibe_start_track and vibe_next_step use) and the HTTP outline (call the route through the app TestClient with that session_id against the fake sessions store; reuse tests/api/_fake_sessions_db.py or the existing outline-endpoint test fixtures). Assert identical ordered sectionTag lists AND identical per-step status after completing a couple of steps through MCP.
   - X2 (status agreement after mixed-surface progress): complete step A via MCP vibe_complete_step and step B via an App POST /api/session/update-metadata (with base_completed_gates, the #90 path), then assert both read paths report the same statuses.
   - X3 (no number-key consumers): a static check over src/ (ts/tsx) that every remaining read of the numeric completed-step sets (`completedSteps.has(`, `skippedSteps.has(`, or the equivalent in WorkflowDiagram/App) goes through the gate-derived helpers (deriveCompletedStepNumbers / mergeStatus / stepNumbersToGates) or is on an allowlist with a one-line justification each. The test fails when a new direct numeric consumer appears that is not on the allowlist. Build the allowlist from the current code and justify each entry in `## Findings`.
2. docs/superpowers/plans/2026-10-04-phase3-exit-report.md: the Phase 3 exit report. Each exit criterion with evidence (test names; probe reports in the PR body by name; merge SHAs for #80–#95: #80 c280933, #81 3b893e7, #82 45d89dc, #83 2cecfe4, #84 f97f813, #85 4d93628, #86 ad64c10, #87 f0d4d59, #88 7479b29, #89 e6af06f, #90 957157f, #91 64f0772, #92 49aa634, #93 44f4fd7, #94 17e8767, and #95 if merged by then). Include the open ledger (the remaining B items: usecase-beat-post-check, gatebase-write-seq, workflowstep-stream-generation-token, start-track-unknown-pins, off-outline-output-leak, complete-project-setup-latency, visibility-400-fresh-session, llm-service-extract) and an explicit PASS/FAIL per criterion.
3. docs/superpowers/decision-log.md: D-19 (2026-10-04) · "Phase 3 exit gate: the MCP and SPA read paths are pinned identical per session (test_phase3_exit_gate.py); remaining numeric step-set reads are allowlisted with reasons. · Reverse: n/a (tests and docs)." One line, public register, at the end.

Fence: tests/workshop/test_phase3_exit_gate.py, docs/superpowers/plans/2026-10-04-phase3-exit-report.md, docs/superpowers/decision-log.md, and the plan file. If X1 or X2 find a REAL mismatch, do NOT fix it: pin it as xfail(strict=True) with a reason, record it in Findings, mark that criterion FAIL in the report, and report it clearly.

## Acceptance contract
- Backend suite (DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= <APP>/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q): floor 627 (at 17e8767; 640 if #95 merged) plus the new tests, 0 failed (strict xfails allowed only for reported mismatches). Lint ABSOLUTE (0 errors), build green, tools/list = 7.
- Tampers (FORGE/state/specs/phase3-exit-gate/tampers.md; they mutate PRODUCT code temporarily and are then restored byte-identically): T1 reverse the HTTP outline list in routes.py's outline handler → X1 red; T2 reverse the MCP _outline_items list → X1 red; T3 add `completedSteps.has(999)` to a scanned tsx file → X3 red; T4 skip the completed-gates write in update-metadata → X2 red. Confirm `git status` is clean after each restore (product code byte-identical).
- Open a PR into feature/genie-code-mcp-integration titled "phase3-exit-gate: pin MCP == SPA outline per session; numeric-consumer allowlist; Phase 3 exit report".

## Findings

**F1. X1 and X2 found no mismatch.** For every pinned cell, the MCP and SPA read paths return the same ordered sectionTags and the same per-step status for one persisted row. Those paths are `vibe_start_track(track, session_id=…).outline`, `_outline_items` over `_load_session_for_request`, and `GET /api/track/{track}/outline?session_id=`. The cells are the 14 defaults, genie-accelerator with includeLakehouse on and off, `end-to-end:direction:reverse` and `lakehouse:climb:app`. Both lists also equal the frozen golden `ts` order, so the comparison can't pass vacuously. No xfail was needed.

**F2. MCP write tools always complete against DEFAULT_TRACK.** `vibe_complete_step` calls `engine.complete_step(DEFAULT_TRACK, …)`, so on every track X1 completes `project_setup` and `prd_generation`, the two steps genie-accelerator shares with the other tracks. The gates go to the shared `completed_gates` row, so both read paths see them on any track that shows those tags. skills-accelerator shows only `project_setup`, and the test asserts the steps that each track shows. This is current behavior and isn't changed here.

**F3. `vibe_start_track` on resume does not persist.** With a `session_id` and no industry/use_case, it only `setdefault`s `coding_assistant` in memory. That doesn't change the outline, which X1 confirms.

**F4. X3 allowlist (direct reads of the numeric `completedSteps` / `skippedSteps` sets; regex `\b(completedSteps|skippedSteps)\??\.(has|size|forEach|values|keys|entries)\b`; exact count per file, measured at 17e8767):**

| File | Count | Justification |
|---|---|---|
| src/App.tsx | 1 | `:1641` header progress count (`completedSteps.size`); display only. |
| src/components/WorkflowDiagram.tsx | 133 | Renders the number-addressed step components. Its `completedSteps` prop is App's `projectedCompletedSteps`, the `mergeStatus` projection of the endpoint outline over the gate-derived local set (App.tsx:194, :1659). `skippedSteps` is hydrated by `deriveSkippedStepNumbers`. The count includes one comment line (`:485`). |
| src/components/SectionedWorkflowSidebar.tsx | 4 | Sidebar ticks. It receives WorkflowDiagram's projected `completedSteps` prop as-is (WorkflowDiagram.tsx:3641). |
| src/components/SectionDetailPanel.tsx | 2 | Section-detail ticks, from the same projected prop (WorkflowDiagram.tsx:3661). |
| src/constants/scoring.ts | 2 | Pure points calculator over the sets its caller passes in (WorkflowDiagram, projected). |
| src/constants/workflowSections.ts | 2 | Infers the climb chain from APP_LAKEBASE_STEPS (`deriveInitialChainContext`, `getActiveChain`) over a gate-derived set (App.tsx:649 passes `loadedCompleted`, the result of `deriveCompletedStepNumbers`). |

`test_x3_numeric_sets_are_gate_derived` also checks where the sets come from:
- Both App hydration paths derive the sets from `response.completed_gates` and `response.skipped_gates`.
- Every `setCompletedSteps` / `setSkippedSteps` argument is one of: a derived set, `new Set()`, or a toggle handler's next set.
- WorkflowDiagram renders from the `mergeStatus` projection.
- Writes go back through `stepNumbersToGates`.
- No frontend file reads `completed_steps`.

The reads are still keyed by step number, but every set they read is derived from gates.

**F5. The App header count reads the local set, not the projection (observation; not fixed, since this task changes no product code).** `src/App.tsx:1641` passes `completedSteps.size` (the local set hydrated at load) to the header. WorkflowDiagram renders from `projectedCompletedSteps` instead. A step completed through MCP after the page loads shows as done in the diagram once the outline refetch lands, but the header count doesn't include it until the session is re-hydrated. This is display-only and doesn't affect gates or the outline. It's a candidate ledger item (`header-count-projection`).

**F6. Tamper note.** routes.py has two `app_completed_gates=request_body.completed_gates` call sites: `/session/save` at :5846 and `/session/update-metadata` at :6239. T4 applies to :6239. Mutating :5846 instead leaves X2 green, which is correct because X2 drives update-metadata only.

**F7. Live half of criterion (c).** This PR carries the offline pins. It does not run the L1 live probe (`state/specs/phase3-exit-gate/live_checks.md`), which needs a deployed app and belongs to the release role. The exit report marks the live evidence pending.
