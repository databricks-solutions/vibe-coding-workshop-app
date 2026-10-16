# Phase 3 · Task 3b-2b — SPA reads the engine (read-path repoint)

Stacks on `39aeb2a` (#56 merged). One PR (decompose only if the worker judges
the scope too large for one sound PR — then STOP and report, do not ship half).

## GUARDRAILS (verbatim — propagate to the implementer)
1. **Parity is the safety net.** The engine and `getFilteredSections` are FROZEN.
   The T2/T3a parity harness (`tests/workshop/test_outline_parity.py`) must stay
   green — do NOT edit the engine, manifest, generator, oracle, golden matrix, or
   `getFilteredSections` behavior. The human re-runs + re-tampers the harness.
2. **`getFilteredSections` is NOT deleted here** — that is T4, behind this being
   green. This task makes the read path stop DEPENDING on it for ORDER; the
   function stays.
3. **No number↔tag flip / legacy-store drop** — that is T5. Retain a derived
   `Set<number>` compat shim for the numeric-identity consumers (below).
4. **In-band only / 7 tools / probe floor unchanged.** No new MCP tools. No
   server→client protocol calls. `/mcp` still 200-not-307, mount before SPA
   catch-all, lifespan composed, stateless. §4.4 browser-compat floor stays green.
5. **Additive data only; migrations idempotent.** (No DDL expected in this task.)
6. **Repo reality:** NO local server (no `uvicorn`/`npm run dev`). NO CI — run
   `pytest tests/workshop` + `tests/api` and the frontend `npm run build` +
   `npm run lint`, and PASTE results in the PR. Isolate pytest with
   `-c /dev/null --rootdir=.` and neutralize Databricks SDK auth (empty
   `DATABRICKS_CONFIG_FILE`) so the offline suite doesn't hang on `~/.databrickscfg`.
   `mcp` version via `importlib.metadata.version('mcp')` (no `__version__` attr).
7. **Hard stops (human-only):** no `scripts/deploy.sh`, no reseed, no number↔tag
   flip. Open the PR and STOP.

## SCOPE (charter T3b-2b)
1. `getTrackOutline(track, sessionId?)` client → `GET /api/track/{track}/outline?session_id`.
2. Overlay the endpoint's per-`sectionTag` **status + ORDER** onto the sidebar/step
   surfaces. Re-key sidebar progress `Set<number>` → `sectionTag`, RETAINING a
   `Set<number>` compat shim (full number-store removal is T5).
3. Collapse `ALL_STEPS` to a presentation-only (icon/color[/title]) `sectionTag`-keyed
   map — no ordering logic.
4. Populate the #56 persistence keys (`chain_context` + complete `flags`) from live
   UI state on save/update, so `GET /outline` composes the same climb/reverse/AI/
   medallion outline the UI shows.
5. Loading/error states on the async fetch (never blank/crash the sidebar). Polling
   → deferred to T3c.

## VERIFIED ANCHOR PACK (@ 39aeb2a — 3 read-only explores)

### Read path / order (order source to repoint)
- `getFilteredSections` def — `src/constants/workflowSections.ts:750` (STAYS).
- Order call sites (both switch to endpoint order): `WorkflowDiagram.tsx:362`
  (→ `visibleSections`, refined `:368-384` for the genie step-22 splice) and
  `App.tsx:478` (inside `getNextIncompleteStep`, `stepOrder` at `:484`).
- Grouping stays frontend: `WORKFLOW_SECTIONS` (`workflowSections.ts:515-717`,
  static `steps[]` arrays) + `getSectionForStep` (`:719`). Endpoint is FLAT.
- Sidebar is fully controlled (props only): `SectionedWorkflowSidebar.tsx:9-16`
  (`completedSteps:Set<number>`, `skippedSteps:Set<number>`, `expandedStep:number`,
  `onStepClick:(n)=>void`); consumes `visibleSections` from WorkflowDiagram
  (`:3609/3618`).

### Endpoint + client + write path
- `getVisibility` (`src/api/client.ts:1234-1246`) is the GET-to-mirror; `fetch<T>`
  wrapper `:685-696`; base `/api` `:6`; singleton `:1892`. No outline client yet.
- Response: `{track, session_id, outline:[{sectionTag,title,status,execution}]}`
  (`routes.py` `TrackOutlineResponse` `:5837-5851`; `get_track_outline` `:5854-5904`).
  `status ∈ {done,current,locked,skipped}`.
- #56 landed the backend write mapping: request `chain_context`→JSONB `chainContext`
  (camelCase), request `flags`→JSONB `flags` (nested, replaced wholesale). Save path
  `routes.py:5731-5744`; update-metadata `:6040-6051`. Client types ALREADY carry
  `chain_context?`/`flags?` (`client.ts:286-307`, `:368-388`) — the SPA just never
  SENDS them yet.
- Live UI axis state (all in `App.tsx`): `direction` (`:126`, persisted), `chainContext`
  (`:125`, set `:594-595`, restore `:539-540`, NOT persisted), `includeLakehouse`
  (`:165`, persisted snake_case only), `includeGenieOntology` (`:169`, same),
  `aiAgentsModules` (`:148-150`, client-only), `medallionLayers` (`:155-161`,
  client-only). UI→engine flag keys: `ai.genie/agent/dashboard`,
  `medallion.bronze/silver/gold`, `includeLakehouse`, `includeGenieOntology`.
- Save/update call sites: `handleDirectionChange` `:740-743`, lakehouse `:752-755`,
  ontology `:764-767`, `handleSaveSession` `:776-793`, level/progress/assistant
  updates. These must ALSO send `chain_context` + the COMPLETE `flags` set.
- Loading/error model to mirror: visibility `useEffect` (`App.tsx:857-885`) —
  cancelled-flag stale guard, keep prior state, log-not-blank.

### Progress re-key boundary (compat shim)
- `deriveCompletedStepNumbers` (`App.tsx:36-44`): gates→numbers via
  `completedGatesToStepNumbers` (`workflowSections.ts:508-512`) +
  `SECTION_TAG_TO_STEP_NUMBER` (`:504-506`). Gates ARE sectionTag strings.
- **Membership-only (category B) → move status to endpoint per-tag, map to number
  for existing renders:** sidebar `:36/40/44`, `SectionDetailPanel.tsx:20/24`, the
  `WorkflowDiagram` per-card `completedSteps.has(N)` block.
- **Numeric-identity dependent → KEEP `Set<number>` shim (until T5):**
  `>=4` direction-lock (`App.tsx:227`), `>=2` started-guard (`App.tsx:584`,
  `LevelSelector.tsx:318`), `Math.max` current_step (`App.tsx:786`),
  `APP_LAKEBASE_STEPS={4,5,6,7,8}` chain inference (`workflowSections.ts:965`,
  used `:1047-1048/1075-1076`), `STEP_SCORES`/`CHAPTERS` scoring (`scoring.ts`).
  (NOTE: charter's `>=9` example does NOT exist in code — only `>=4`/`>=2`.)

### Presentation map
- `ALL_STEPS` (`workflowSections.ts:390-496`, `Record<number,WorkflowStep>`):
  presentation = `icon`/`color`/`title`; identity/order = `number`/`sectionTag`.
- Re-key ALL_STEPS presentation to `sectionTag` for sidebar/divider (mirror the
  already-tag-keyed `GENIE_STEP_META`, `WorkflowDiagram.tsx:1014-1030`).
- **OUT OF SCOPE:** the `switch(step.number)` main-content cards
  (`WorkflowDiagram.tsx:1250+`) use inline icon/color/title PLUS behavior wiring —
  NOT a mechanical re-key; leave number-keyed (it does no reordering).
- `number` cannot be dropped (identity for `Set<number>`, tag↔number maps) — T5.

## DECISIONS (recommend-and-proceed; flag if the human would change)
- **D1 (ALL_STEPS collapse boundary):** collapse to presentation-only for the
  sidebar/divider role, re-keyed by `sectionTag`; KEEP `number` + tag↔number maps;
  do NOT re-key the main-content `switch(step.number)` cards (content wiring, not
  order — separate refactor, out of scope).
- **D2 (order source):** repoint `WorkflowDiagram.tsx:362` + `App.tsx:478` to derive
  order from the endpoint's ordered flat tag list, grouped via `WORKFLOW_SECTIONS`/
  `getSectionForStep`. `getFilteredSections` stays (T4 deletes) but the read path
  stops using it for ORDER. If the endpoint is unavailable/errors, fall back to the
  existing `getFilteredSections` order (never blank the sidebar).
- **D3 (compat shim):** derive `Set<number>` from the endpoint's per-tag status (via
  tag→number) for the numeric-identity consumers; those stay until T5.
- **D4 (write-path persistence):** populate `chain_context` + COMPLETE `flags`
  (camelCase `includeLakehouse`/`includeGenieOntology` + `ai.*` + `medallion.*` +
  `chainContext`) on the existing save/update call sites from live App state; keep
  snake_case `direction`/`include_*` for other consumers; send the complete flag set
  each save (backend replaces the nested object wholesale).
- **D5 (tests):** automated gate = pytest `tests/api` write→read round-trip (see
  failing tests) + `tests/workshop` no-regress (parity harness green) + frontend
  `npm run build` + `npm run lint`. Visible rendering = human live smoke
  (charter-owned). Polling → T3c.
- **D6 (one PR):** one worktree/implementer; `App.tsx` is the shared trunk so no
  parallel leaves. Commit incrementally. STOP-and-report if scope proves too large
  for one sound PR.

## FAILING TESTS (TDD — the required round-trip assertions)
- `tests/api` (new or extended): **app-climb round-trip** — POST `/session/save`
  (or `/session/update-metadata`) with `chain_context="app"` for a climb-capable
  track, then `GET /api/track/{track}/outline?session_id=...` returns the CLIMBED
  sections (concrete added-tag delta vs. the standalone outline). Non-hollow: assert
  a specific climbed `sectionTag` present that is absent without climb.
- `tests/api`: **sub-toggle round-trip** — persist `flags` with an AI or medallion
  toggle OFF (e.g. `ai.dashboard=false` / `medallion.gold=false`), reload, then
  `GET /outline` reflects the disabled step (the gated tag drops to absent/skipped
  per engine semantics). Assert the specific tag delta.
- Frontend: `npm run build` (tsc + vite) clean; `npm run lint` clean on changed
  files. (No JS unit runner exists — build/lint + the round-trip pytest + human
  smoke are the gate.)

## EXIT GATE
Sidebar/step surfaces render every track/axis state FROM the endpoint with NO TS
reordering left in the read path; write→read round-trip pytest green (climb +
sub-toggle); parity harness still green; build/lint clean; 7 tools unchanged;
§4.4 floor green. Human owns deploy + full smoke (genie-code resume gates-mapped,
a reverse track reverse-baked, a sub-toggle round-trip) before clearing T4.
