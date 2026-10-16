# Plan: genie-default-error-path (app) — #148 reviewer gap + D-158 test

Commit at docs/superpowers/plans/2026-10-15-genie-default-error-path.md. Base 99b392c (rebase on docs-next if it merged first). Human ruling 2026-10-15: build now, HOLD the merge until the live checks on the human's 99b392c deploy pass.

## Why
- #148 reviewer: if `apiClient.getDefaultSession()` throws (`src/App.tsx:534-545`), the catch creates a local-only session id but never applies the new-session defaults, so the UI lands on `workshopLevel` 'end-to-end' (`App.tsx:117`) instead of genie-accelerator — the one path where R2/R3 don't hold.
- #148 reviewer (optional): the guard test (`tests/frontend/genieDefaultSession.node.test.ts:199-203`) evaluates the `shouldApplyAssistantDefault` expression but would not catch deleting the `if (shouldApplyAssistantDefault)` branch (`App.tsx:935`).
- D-158: no test covers ontology turned off mid-walk; the lead's offline walk showed all cases reach Done with `iterate_enhance` reachable.

## Change
- C1 `src/App.tsx` (trunk exception: this catch block only). In the `getOrCreateDefaultSession` catch, apply UI state from `FALLBACK_WORKSHOP_DEFAULTS` (`src/api/client.ts:451`) the same way `applyNewSessionDefaults` (`App.tsx:556`) computes it (`newSessionLevel`, ontology only on genie-accelerator, lakehouse off) but WITHOUT the `updateSessionMetadata` write (the backend is unreachable and the local id is unsaved by design; comment at `:536-538`). Prefer extracting the state-setting half of `applyNewSessionDefaults` into a helper both paths call, so they cannot drift. Do not change the success path or `createNewSession`.
- C2 guard test: add an assertion that the `if (shouldApplyAssistantDefault)` branch exists and guards the assistant-default `setWorkshopLevel` call (source-level, same harness style as the existing test). Tamper: delete the branch → red.
- C3 new node test for C1: with `getDefaultSession` rejecting, the resulting level is genie-accelerator and ontology equals `FALLBACK_WORKSHOP_DEFAULTS.includeGenieOntology`; no metadata write is attempted.
- C4 `tests/workshop/` engine test (pure engine + manifest, no DB): genie-accelerator ontology ON, walk in strict order, turn ontology OFF after step 14, 16 and 20 (both keys as the server mirror writes them), finish the walk: each reaches Done; `iterate_enhance` is reached; step counts 25/27/27 with iterate_enhance at 23/25/25 (lead's offline numbers; the test asserts reachability and Done, and pins the counts).

## Acceptance
- A1 files: App.tsx (catch block + optional extracted helper), the two frontend test files, one new tests/workshop file, plan, decision-log (D-158 already logged; append any new D-entries only).
- A2 backend 2049+/0; frontend node tests 77+ all pass; tsc -b, vite build pass; ESLint only the 16 known library errors.
- A3 web byte-identity (D12) unchanged; manifest unchanged; no backend file touched.

## Tampers
- X1 revert C1 (catch leaves end-to-end) → C3 red.
- X2 make C1 call `updateSessionMetadata` → C3 red.
- X3 delete `if (shouldApplyAssistantDefault)` → C2 red.
- X4 in C4, skip `iterate_enhance` (mark it skipped instead of completing) → C4 red.

## r1 — critic ACCEPT findings folded in (D-165)
- Persistence after recovery: progress saves piggyback `workshop_level: workshopLevel` only (`App.tsx:829`; `handleWorkshopLevelChange` `:808` writes level + flags only on an explicit change). So once the backend recovers, a fallback session persists level genie-accelerator but NO `include_genie_ontology`, which hydrates as OFF (D-143/R2 rule: absent = off). If the error path showed ontology ON, the UI (27 steps) and the stored session (24 on reload, and on MCP) would disagree.
- **Ruling D-165 (lead, most reversible):** in the error path only, apply level `newSessionLevel(FALLBACK_WORKSHOP_DEFAULTS)` (genie-accelerator) with ontology **OFF** and lakehouse off, so what the UI shows equals what a later progress save stores. The success path and createNewSession are unchanged (ontology from the facilitator switch). The learner can still tick ontology on the card, which writes all keys through `handleWorkshopLevelChange`. C3 asserts ontology false on this path; X2 unchanged; new X5: set ontology from FALLBACK (true) in the catch → C3 red.
- `newSessionLevel` (`App.tsx:553`) is synchronous; no `fetchOutline` on the error path (backend unreachable).
- C3 must be source-level (regex over App.tsx), like the existing guard test: App.tsx is too large to load in the node harness (`tests/frontend/genieDefaultSession.node.test.ts:13`).
- C4 counts confirmed against `engine._flags_for` (`engine.py:76-91`).

## Questions for plan_critic
1. Does anything later persist the local session's UI level (so the fallback should or should not reach the DB once the backend recovers)?
2. Is `newSessionLevel` callable without the outline fetch that `applyNewSessionDefaults` triggers?
