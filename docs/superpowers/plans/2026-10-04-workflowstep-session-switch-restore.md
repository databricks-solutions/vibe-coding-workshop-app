# workflowstep-session-switch-restore

## Defect (live-probed at f0d4d59, L4; pre-existing at ad64c10, D-10)
After an in-page session switch (My Saved Sessions → another session), a mounted WorkflowStep clears its content and refetches section metadata, but never restores the target session's stored prompt. It stayed empty for 34 s, until a full page reload. Cause, in src/components/WorkflowStep.tsx at 7479b29:
- the during-render reset block at :257-267 (contentFor vs industry/useCase) queues `setStreamedPrompt('')` and `setGeneratedContent(null)`;
- in the SAME render, the restore block at :277-289 sees `initialPrompt !== restoredFrom` and records `setRestoredFrom(initialPrompt)`, but its guard `!streamedPrompt && !generatedContent?.prompt` reads this render's stale, non-empty previous-session values, so it skips;
- on the next render `restoredFrom === initialPrompt`, so the restore never runs again.
The pre-PR effect pair (ad64c10 :247-272) had the same stale-closure flaw.

Second, related gap: WorkflowStep is keyed by step tag only (WorkflowDiagram.tsx ~:1135 `key={effectiveTag}`), not by session. So a switch between two sessions with the SAME industry and use case never triggers the reset, and the restore guard keeps showing the previous session's prompt (initialPrompt changes, but the stale content is non-empty). The plan covers both.

## Change (WorkflowStep.tsx only; not a trunk file)
1. Make the reset key `{ industry, useCase, sessionId }`, and compute `const resetting = contentFor.industry !== industry || contentFor.useCase !== useCase || contentFor.sessionId !== sessionId;` once, before the reset block. Its body is unchanged (plus storing sessionId). Add sessionId to the companion refs-reset effect's deps.
2. Restore guard: `if (initialPrompt && (resetting || (!streamedPrompt && !generatedContent?.prompt)))`. When this render is resetting, the queued resets make the stale values irrelevant, so restore the target's prompt in the same render. This must be ordered after the reset block's setters, so the restore's setters win: React applies queued updates in order.
3. No change to: the metadata-fetch effect (it already depends on sessionId), the streaming-save effect, or WorkflowDiagram/App.tsx (trunk). No key change, which would remount and lose transient UI state such as tab and expanded.

Fence: src/components/WorkflowStep.tsx, a new tests/frontend/WorkflowStep.node.test.ts (reusing tests/frontend/loadComponent.ts from #87), and the plan file. Zero backend diff; no App.tsx, workflowSections.ts or WorkflowDiagram.tsx change; no package or eslint config change.

## Tests (node:test plus the loadComponent harness from #87)
- W1: mount with session A (industry X, useCase Y, initialPrompt PA). Rerender with session B (industry Z, useCase W, initialPrompt PB). The rendered prompt is PB with no further renders needed. This is the L4 regression; it is red at base.
- W2: same, but A and B share industry and useCase (only sessionId and initialPrompt differ). The rendered prompt is PB, not PA. Red at base.
- W3: switch to a session whose initialPrompt is undefined. The content is empty (the reset still happens).
- W4: no session change, initialPrompt unchanged, and the user has streamed a new prompt. Nothing is clobbered (the restore doesn't overwrite live content).
- W5: an initialPrompt update within the same session (e.g. after a save) restores only when the current content is empty, as today.

## Acceptance contract
- `npm run lint` ABSOLUTE: 0 errors, and warnings <= 26. `npm run build` green. Frontend tests (`node --experimental-strip-types --test tests/frontend/*.node.test.ts`): 24 plus the new ones, all green. Confirm W1 and W2 are RED at base 7479b29 before your change. Backend suite (DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= <APP>/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q): 581, 0 failed, unchanged. MCP tools/list = 7.
- Tampers (FORGE/state/specs/workflowstep-session-switch-restore/tampers.md), each verified and then restored byte-identically: T1 drop `resetting ||` from the restore guard → W1 red; T2 drop sessionId from the reset key → W2 red; T3 make the restore unconditional → W4 red.
- Open a PR into feature/genie-code-mcp-integration titled "workflowstep-session-switch-restore: restore the target session's prompt on an in-page switch".

## Implementation notes (post-implementation)
No file outside the Fence was touched. Two deviations from the letter of the plan, both inside the Fence:
- The restore's outer gate is `resetting || initialPrompt !== restoredFrom`, not only `initialPrompt !== restoredFrom`. Without it, switching to a session whose stored prompt is byte-identical to the current one leaves `restoredFrom === initialPrompt`: the reset clears the content and nothing restores it. A test (W6) covers this case.
- W4 as worded ("initialPrompt unchanged") cannot go red under T3: the outer gate already skips the restore when initialPrompt is unchanged. The harness has no DOM, so nothing can stream, and the shown content comes from the first restore. W4 therefore asserts two things. First, plain same-props rerenders leave the content in place. Second, a later same-session initialPrompt (the periodic streaming save echoing a partial buffer back) does not overwrite non-empty content. The second assertion is what T3 turns red.
