# Phase 3 · Task 3b — SPA reads the engine (repoint) + `_next_reference` fix

Base: `feature/genie-code-mcp-integration` @ `e6b1a90` (T3a merged as #53; harness 65/65). Local == origin.
Author: polly (orchestrator). Implementer: claude_code (`system.ai.claude-opus-4-8[1m]`). Reviewer: cursor (codex down on host-side auth). polly never merges.

## GUARDRAILS (verbatim from the T3b charter)
- Repoint the SPA read path to `GET /api/track/{track}/outline` — sidebar/step surfaces render the endpoint's outline; re-key progress `Set<number>` → `sectionTag` (`completed_gates`); collapse `ALL_STEPS` to a presentation-only (icon/color) `sectionTag`-keyed map. The engine now composes every axis, so the SPA does zero order post-processing.
- MUST-FIX (from T3a finding #2): thread `_inputs_for(state)` into MCP `_next_reference` — and any other direct `outline_order` call site that omits inputs — so "next step" agrees with the composed outline for climb / e2e-reverse sessions. `mcp_server.py` is in-scope now.
- Behavior awareness (finding #1): reverse-* default outlines now serve the reverse-baked order from the engine. The SPA must render that faithfully; the golden/harness is the reference for every track/axis state.
- Live-sync: polling for v1 (decided). T3b's core is load/mount hydrate from the endpoint; wire thin polling if it's clean, otherwise log it as a scoped T3c follow-up — don't let it bloat this PR.
- Parity is the safety net — do NOT change `getFilteredSections` behavior or the engine; the T2/T3a harness must stay green (human re-runs + re-tampers).
- `getFilteredSections` STAYS for now; its deletion is T4 (behind this being green).
- Sensible loading/error states on the async outline fetch (never blank/crash the sidebar).
- One PR (decompose if it gets large, each shippable); serialize trunk files; run `pytest tests/workshop` + `tests/api` and the frontend build/lint, paste results; cross-vendor review (codex down → claude_code ↔ cursor).
- HARD STOPS (human-only): no deploy, no number↔tag flip / legacy-store drop (T5), no reseed. Open the PR(s) and stop. Human deploys + runs the full smoke at T3b (genie-code resume + a reverse track + a sub-toggle state), then merge-gates T4.

## VERIFIED ANCHOR PACK (live @ e6b1a90; drift corrected)
- `ALL_STEPS` @ `workflowSections.ts:390` — 73 entries, `WorkflowStep = {number,title,icon,color,sectionTag}`. Presentation = icon/color(/title); order = number/record-key. Consumed to build `WORKFLOW_SECTIONS[].steps`, and by WorkflowDiagram/AnalyticsDashboard/TestScenarioConfig.
- `getFilteredSections` @ `workflowSections.ts:750` — TWO live call sites: `WorkflowDiagram.tsx:362` (outline render) and `App.tsx:478` (inside `getNextIncompleteStep`).
- `SectionedWorkflowSidebar.tsx:9-10` — `completedSteps/skippedSteps: Set<number>` are PROPS (pure presentational); owned by `App.tsx:105-106`, threaded via `WorkflowDiagram.tsx:3609-3611`.
- `App.tsx`: `deriveCompletedStepNumbers` @36-44 (collapses gates→numbers via `completedGatesToStepNumbers`), `getNextIncompleteStep` @465-493 (NOT ~581 — drifted), `loadSession` @495-577, `getOrCreateDefaultSession` @340-416.
- Endpoint: `GET /api/track/{track}/outline` @ `routes.py:5840`; `TrackOutlineResponse={track,session_id,outline:[{sectionTag,title,status:done|current|locked|skipped,execution}]}` (flat, no grouping). Thin over `engine.outline` (routes.py:5889).
- Frontend API client: `src/api/client.ts` (NOT lib/api.ts); `private fetch<T>` @673; `apiClient` @1883; analog `getVisibility` @1225. NO outline client — add `getTrackOutline`.
- Loading/error pattern to mirror: visibility fetch (`App.tsx:868-881`) — keep last-good state, log on error, `cancelled` stale-guard, never blank.
- Build: `npm run build` (`tsc -b && vite build`); Lint: `npm run lint` (`eslint .`). NO JS unit runner (Playwright onramp only). Backend gates: pytest `tests/workshop`+`tests/api`.
- BACKEND fix surface: `_next_reference` @ `mcp_server.py:468` is the ONLY call site omitting `inputs` (routes.py:5889, engine.py:105, mcp_server.py:464 all thread inputs). Fix = `ordered = engine._ordered_steps(track, state)` (drop-in `list[Step]`; threads flags+inputs; the exact fn `engine.outline` uses). `build_session_state` (`state.py:25`) already copies `session_parameters` verbatim — no change. Latent under DEFAULT_TRACK=genie-accelerator (no variants); load-bearing when MCP serves a variant track. No `.next`/`StepReference` test exists today.

## SPA↔ENGINE PARAMETER MISMATCH (T3b-critical, from the endpoint explore)
The endpoint reads composition inputs from the persisted `session_parameters`. Today the SPA:
- persists `direction` ✓ (App.tsx:740-743);
- persists genie flags SNAKE_case (`include_lakehouse`/`include_genie_ontology`) while engine reads camelCase (`includeLakehouse`/`includeGenieOntology`);
- derives `chainContext` client-side (App.tsx:535-540) but does NOT persist it;
- computes AI/medallion as client-only `effectiveDisabledTags`, never persisting `ai.*`/`medallion.*` flags.
→ T3b-2 MUST align persistence so the endpoint reflects climb/AI/medallion/genie states (required by the smoke: reverse track + sub-toggle state). `session_parameters` is a verbatim-copied JSONB blob, so writing the right keys is FRONTEND-ONLY (no routes.py/build_session_state change).

## DECISIONS (recommend-and-proceed; surfaced to human, none block)
- D-T3b-1: DECOMPOSE into T3b-1 (backend `_next_reference` fix + test) and T3b-2 (frontend repoint + param alignment). Disjoint files → PARALLEL leaves. Each independently shippable.
- D-T3b-2: Progress re-key is SCOPED — re-key the sidebar/outline READ PATH to consume the endpoint's per-`sectionTag` status; RETAIN a derived `Set<number>` (from `completed_gates` via the existing mapping) for the numeric-threshold consumers (LevelSelector `>=2`, WorkflowDiagram `>=9/10/11`, `directionLocked >=4`, scoring/save). A full re-key of those is OUT of scope (bounds blast radius; behavior-preserving). `getFilteredSections` stays until T4.
- D-T3b-3: Introduce the presentation-only `{sectionTag:{icon,color,title?}}` map and make the sidebar/outline rendering use it; the number-keyed `ALL_STEPS` REMAINS for threshold/other consumers until T4 (fully deleting it now would balloon the PR beyond the read path).
- D-T3b-4: Section grouping stays SPA presentation (endpoint is flat) — overlay endpoint `status`/order onto the existing `WORKFLOW_SECTIONS` chrome by `sectionTag`.
- D-T3b-5: Skipped — consume the endpoint's `status:"skipped"` as server truth for rendering; retain the local skipped set only for optimistic in-session skips (no `skipped_gates` API field exists).
- D-T3b-6: Polling — implement load/mount hydrate only; if thin polling is clean add it, else scoped T3c follow-up. Do not bloat.

## FAILING TESTS (drawn from D8 parity style + the charter deliverable)
T3b-1 (backend, pytest tests/workshop):
- test_next_reference_agrees_with_outline_climb: SessionState with `session_parameters={"chainContext":"app"}` on lakehouse → the `_next_reference`/`_step_payload.next` pointer equals the next tag in `engine.outline` for the same session. FAILS before the one-line fix (input-blind ordering picks the wrong next).
- test_next_reference_agrees_with_outline_reverse: `session_parameters={"direction":"reverse"}` on end-to-end → same agreement. FAILS before fix.
- (regression) genie-accelerator default `next` unchanged (no variants) — guards no behavior change on the live track.

T3b-2 (frontend — no JS unit runner; gate is `tsc -b && vite build` + `eslint .` clean + manual/Playwright + the human smoke):
- Build + lint clean with the repointed read path.
- Endpoint client `getTrackOutline` typed to `TrackOutlineResponse`.
- Loading/error: outline fetch failure keeps last-good sidebar (never blank) — mirror visibility pattern.
- Acceptance (human smoke): genie-code resume renders genie-accelerator outline from the endpoint (no 0/28); a reverse track renders reverse-baked order; a sub-toggle state (AI/medallion off) reflects in the endpoint outline via persisted flags.

## GUARDRAIL CHECKS (both PRs)
- Harness stays green: `tests/workshop/test_outline_parity.py` untouched and passing; `getFilteredSections` behavior + engine untouched.
- 7 MCP tools unchanged; no DDL; no legacy-store drop; no reseed; no deploy.
- T3b-1: only `mcp_server.py` + new test. T3b-2: frontend `src/` only (client.ts, App.tsx, WorkflowDiagram.tsx, SectionedWorkflowSidebar.tsx, workflowSections.ts presentation map, types) — NO backend, NO getFilteredSections logic change, NO engine change.
