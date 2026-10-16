# app-save-drops-unseen-mcp-gates

## Defect (live-probed at 7479b29, #88's L2; D-11)
When an App write commits after an MCP vibe_complete_step and its payload doesn't list the step the MCP just completed, the step is silently un-completed. This happened in 12/12 App-after-MCP pairs. Cause:
- The SPA always sends a FULL snapshot of its gate sets: App.tsx:764-765 (handleCompletedStepsChange → updateSessionMetadata with completed_gates and skipped_gates), :790 (handleSkippedStepsChange, skipped_gates only), and :983-984 (handleSaveSession → saveSession).
- The server merge `gate_merge._merge_app_gates` (gate_merge.py:10) treats every App-representable gate as App-AUTHORITATIVE.
- Every step tag is representable. So the server can't tell "the learner un-completed this step in the App" from "the App never saw this step being completed (MCP did it)".

## Change: base-aware App merge (mirrors #88's delta approach on the App side)
1. **SPA (src/App.tsx, trunk; charter exception accepted by plan_critic):** keep a ref, `lastServerGatesRef = { completed: Set<string>, skipped: Set<string> }`, holding the gate sets the SPA last received from or successfully wrote to the server. It is set on session hydration (where response.completed_gates and skipped are read, ~:449 and ~:605) and updated after each successful gate write to the incoming sets. Every gate write (the 3 sites above) also sends `base_completed_gates` and/or `base_skipped_gates`: the ref's sets at send time, as sorted arrays. Put the bookkeeping in a pure helper, src/utils/gateBase.ts, so it is unit-testable. No UI behavior change.
2. **API (src/backend/api/routes.py, trunk; charter exception accepted):** add optional `base_completed_gates: Optional[List[str]] = None` and `base_skipped_gates` to SessionSaveRequest (~:5525) and SessionUpdateMetadataRequest (~:6163), and pass them through to the locked merge.
3. **Merge (src/backend/workshop/gate_merge.py; lakebase.save_session_merging_gates ~:818):** add an optional `base` parameter to the merge. When base is provided:
   - removals = (base ∩ representable) − incoming
   - merged = [g for g in stored if g not in removals] + [g for g in incoming if g not in stored], order kept.
   Only gates the App had SEEN and then dropped are removed; gates added elsewhere (MCP) since the App's base survive. When base is None, the merge is today's `_merge_app_gates`, byte-for-byte, so old clients and any other caller are unchanged. Same for skipped_gates. Everything runs inside #84's existing SELECT…FOR UPDATE transaction.
4. **Types:** src/api/client.ts SessionSaveRequest (~:286) and UpdateSessionMetadataRequest (~:391) gain the two optional fields; the Pydantic models gain them too.
5. **docs/superpowers/decision-log.md:** append three entries in the file's one-line public-register format:
   - D-10 (2026-10-04) · #87's live check failed only on an in-page session-switch prompt restore that was already broken before #87 (the same stale-closure restore guard in WorkflowStep at ad64c10). Kept #87 deployed (rollback would remove its rules-of-hooks fix and leave the bug), and fixed the restore separately in #89. · Reverse: roll back merge f0d4d59.
   - D-11 (2026-10-04) · #88's live race check lost updates only when an App save committed after the MCP write and dropped the MCP-completed step through the App-authoritative merge, a pre-existing App-path behavior; within #88's scope the race lost 0. Kept #88 and fixed the App path separately (this PR). · Reverse: roll back merge 7479b29.
   - D-12 (2026-10-04) · App gate writes carry the gate set the SPA last saw; the server removes only gates the App saw and dropped. Rule (2), the #88 probe's recommendation. No base keeps today's behavior. · Reverse: stop sending base_* from the SPA (the server falls back to App-authoritative).

Fence: src/App.tsx, src/backend/api/routes.py, src/backend/workshop/gate_merge.py, src/backend/services/lakebase.py, src/api/client.ts, a new src/utils/gateBase.ts, tests (backend: extend tests/api/test_gate_merge*.py and the #84/#88 race harness; frontend: a new tests/frontend/gateBase.node.test.ts — note the `.node.test.ts` suffix the runner globs, even though tampers.md says gateBase.test.ts), docs/superpowers/decision-log.md, and the plan file. src/constants/workflowSections.ts is trunk: don't touch it.

## Tests
- G1 (the live defect): stored = {use_case_selection, project_setup (MCP-added)}; App base = {use_case_selection}; App incoming = {activation_app_design} → project_setup survives.
- G2: the learner un-completes in the App. Base = {X, Y}, incoming = {X} → Y is removed.
- G3: no base → identical to today's _merge_app_gates (property or parametrized test over the existing cases).
- G4: non-representable stored gates (use_case_selection) survive with and without a base.
- G5: G1 and G2 for skipped_gates.
- G6 (race harness): an App write after an MCP delta, carrying a base without the MCP gate, keeps the gate (the #88 probe's variant A, offline).
- F1 (frontend helper): the ref updates on hydrate and on a successful write, and is NOT updated on a failed write.

## Acceptance contract
- Backend suite (DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= <APP>/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q): floor 581 plus the new tests, 0 failed; race tests green 3×. Frontend: `npm run lint` ABSOLUTE (0 errors, warnings <= 26), `npm run build` green, `node --experimental-strip-types --test tests/frontend/*.node.test.ts` 31 plus the new ones, all green. MCP tools/list = 7.
- Tampers (FORGE/state/specs/app-save-drops-unseen-mcp-gates/tampers.md; line numbers are indicative), each verified and then restored byte-identically: T1 ignore base → G1 and G6 red; T2 removals = representable − incoming → G2 red (and any G1-shaped test); T3 removals = base − incoming (no representable filter) → G4 red; T4 update the ref on a failed write → F1 red. Name the actual test IDs in the PR body.
- Open a PR into feature/genie-code-mcp-integration titled "app-save-drops-unseen-mcp-gates: App gate writes merge against the gate set the SPA last saw".
