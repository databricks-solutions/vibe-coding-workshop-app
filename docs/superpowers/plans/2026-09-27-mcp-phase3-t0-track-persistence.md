# Phase 3 · Task 0 — Track Persistence (kill the live 0/28 defect)

Plan doc for the UI-Repoint increment. **Task 0 ONLY.** Foundation for the outline
endpoint (T1); no other Phase 3 task begins until the human approves the T0 gate.

Status: authored 2026-09-27. Base branch: `feature/genie-code-mcp-integration`.

---

## GUARDRAILS (verbatim from the Phase 3 charter — propagate to the implementer AND reviewer)

1. ONE ENGINE / ONE ASSEMBLER: the new REST outline route is THIN transport over
   engine.outline(...) — the SAME function MCP already calls. NEVER fork a second
   outline builder. Adapters contain no workshop logic (D4 §1). *(T0 adds no route,
   but the no-fork rule stands.)*
2. TOOL BUDGET unchanged: 7 tools. Phase 3 adds ZERO MCP tools (it adds ONE REST
   route). Never an 8th tool. *(T0 adds neither a tool nor a route.)*
3. ADDITIVE DATA ONLY; migrations idempotent. Legacy number stores are dropped
   LAST, behind the consumer audit (D6 §9) and the human flip sign-off (D9 §5).
4. PARITY IS THE SAFETY NET: no UI behavior change ships until a golden test
   proves engine.outline() reproduces today's getFilteredSections() sectionTag
   sequence for ALL 14 tracks × flag combos. Snapshot TS first, then match it.
   *(That golden harness is T2; T0 must not regress the eventual parity — it only
   corrects which track a genie-code session RESTORES.)*
5. REPO REALITY: no uvicorn/npm run dev; pin deps EXACT in requirements.txt; NO CI
   → run `pytest tests/workshop` locally + paste results in every PR.
6. IN-REPO CONTEXT ONLY; /investigate every anchor before editing; /cross-review
   every diff with a different-vendor reviewer; ONE PR PER TASK.

Inherited probe-floor guardrails (still hold): /mcp returns 200 not 307; mount
before SPA catch-all; lifespan composed; stateless_http; app name starts with
`mcp-`. T0 touches none of these surfaces, but the §4.4 browser-compat floor must
stay green (mcp_server.py is edited).

---

## VERIFIED ANCHOR PACK (confirmed live 2026-09-27 via 3 read-only explores)

### Backend (mcp_server.py, lakebase.py, DDL, routes.py)
- **`DEFAULT_TRACK = "genie-accelerator"`** — mcp_server.py:**40** (anchor said 36 → DRIFTED).
  `DEFAULT_CODING_ASSISTANT = "genie-code"` at :46.
- **`coding_assistant` setdefault #1** — mcp_server.py:**868** CONFIRMED, inside `vibe_start_track`
  (fn @:848): `state.session_parameters.setdefault("coding_assistant", DEFAULT_CODING_ASSISTANT)`.
- **`coding_assistant` setdefault #2** — mcp_server.py:**1448** CONFIRMED, inside `vibe_set_parameters`
  (fn @:1403). Same setdefault into `state.session_parameters`.
- **The seed `save_session(...)` call** — mcp_server.py:**880-889**, inside `vibe_start_track`,
  fires ONLY for brand-new sessions (guard `not session_id and is_lakebase_configured()` @:875).
  Current kwargs: `session_id, industry, use_case, session_name, created_by, current_step,
  completed_steps, session_parameters`. **`workshop_level` is NOT passed today.**
- **`workshop_level` is a TOP-LEVEL DB COLUMN** — `db/lakebase/ddl/03_sessions.sql:25`
  (`workshop_level VARCHAR(20) DEFAULT '300'`). NOT a `session_parameters` JSONB key.
- **`save_session()` ALREADY accepts `workshop_level: str = None`** — lakebase.py:**605**; INSERT
  includes it (:705 cols, :747 values); UPSERT is none-preserving:
  `workshop_level = COALESCE(EXCLUDED.workshop_level, {table}.workshop_level)` (:730). **No new
  param, no DDL, no migration, no reseed.**
- **Load path surfaces it top-level** — `load_session` SELECT :848, return `"workshop_level"` :953;
  `get_user_default_session` SELECT :1159, return :1251; endpoints
  `GET /session/default` (routes.py:5622) and `GET /session/{id}` (routes.py:5778) emit
  `workshop_level` into `SessionLoadResponse` (model field routes.py:5426/5456).
- **`_legacy_progress`** — def mcp_server.py:**1147** (anchor 1256-1283 = its CALL SITE, at :1262
  inside `vibe_complete_step`). Writes `current_step`/`completed_steps` as 1-based manifest positions.
- engine.outline() and manifest.outline_order(flags) exist as anchored (T1/T2 concern — not edited in T0).

### Frontend (App.tsx, codingAssistants.ts, sidebar)
- **`DEFAULT_LEVEL_BY_ASSISTANT`** — codingAssistants.ts:**112**:
  `{ 'genie-code': 'lakehouse-di' }`. Today genie-code → **`lakehouse-di`** (NOT genie-accelerator).
  Consumers: App.tsx:25 (import), :58 (`assistantDefaultLevel`, resume path), :720
  (`handleCodingAssistantChange`, live pick).
- **Resume level precedence (the bug)** — `loadSession` @App.tsx:515, block :550-560; and the
  duplicate in `getOrCreateDefaultSession` :380-383. Both resolve level as:
  `loadedLock ?? assistantDefaultLevel(session_parameters, lock) ?? normalizeLevel(workshop_level || 'end-to-end')`.
  The **assistant default (genie-code→lakehouse-di) SHADOWS the persisted `workshop_level`**.
- `assistantDefaultLevel` — App.tsx:51-61; returns undefined only when a use-case lock exists OR
  `session_parameters.level_explicitly_selected` is truthy.
- `deriveCompletedStepNumbers` — App.tsx:**35** CONFIRMED (gates→numbers via
  `completedGatesToStepNumbers`, else legacy `completed_steps`).
- `getNextIncompleteStep` — def App.tsx:**485** (anchor :581 is a call site). Uses `getFilteredSections(level, …)`.
- `workshopLevel` state — App.tsx:136 (`useState('end-to-end')`); resume-path setters at :383 and :560.
- Outline render: `workshopLevel` → `WorkflowDiagram` (App.tsx:1413) → `getFilteredSections(workshopLevel,…)`.
- `SectionedWorkflowSidebar` — Set<number> progress state CONFIRMED :8-16; counts
  `completed ∩ visibleSections` (:53-58); "X/Y done" render :96-98.
- "Step N of 20" — SessionListDialog.tsx:191-193: `session.current_step` + a **hardcoded `20`** literal.

### Root cause (both lenses agree)
MCP always walks `genie-accelerator` and persists `completed_gates` (→ global step numbers 57-73,
which live only in genie sections) but **never stamps `workshop_level`**. On SPA resume,
`coding_assistant=genie-code` forces `lakehouse-di`, whose outline STRIPS the genie sections
(workflowSections.ts:761-786) — so genie completions map to steps not present → progress collapses
to "0/28" while the session card shows MCP's dense "Step 8" against a hardcoded "of 20".

---

## THE FIX (two coupled parts — ONE task, ONE PR; individually non-shippable)

**Part A — Backend stamp (mcp_server.py).** In `vibe_start_track`'s seed `save_session(...)` call
(:880-889), add `workshop_level=DEFAULT_TRACK`. Write it as a **top-level kwarg** (the column),
NOT via `state.session_parameters.setdefault` (that lands in JSONB, invisible to the SPA read).
Do not touch the `vibe_complete_step` save (:1276-1283) — COALESCE at save_session:730 preserves
the seeded value on every later write.

**Part B — Frontend restore precedence (App.tsx + codingAssistants.ts).**
1. Reorder the resume-level `??` chain in BOTH `loadSession` (:550-560) AND
   `getOrCreateDefaultSession` (:380-383) so the **persisted `workshop_level`** (when it is a real
   track, i.e. not the legacy `'300'` default / empty) wins ABOVE the assistant-derived default.
2. Demote `DEFAULT_LEVEL_BY_ASSISTANT` to a **LEGACY FALLBACK only** — consulted only when the
   session carries no meaningful persisted `workshop_level` (covers pre-fix genie-code sessions
   still holding `'300'`).
3. Correct the genie-code fallback value from `'lakehouse-di'` → **`'genie-accelerator'`**
   (codingAssistants.ts:112) so both new (stamped) and existing (fallback) genie-code sessions
   restore the genie-accelerator outline.
4. Keep use-case lock (`loadedLock`) as the highest precedence — unchanged (guardrail: never block
   except existing gates/locks).
5. Extract the resume-level resolution into a single pure exported helper (e.g.
   `resolveRestoredLevel(response, lock)`) shared by both resume paths, so the logic lives in ONE
   place and is reviewable/testable. No behavior beyond the precedence fix.

Precedence AFTER the fix (both resume paths, identical): `use-case lock` → `persisted real
workshop_level` → `corrected assistant legacy fallback (genie-code→genie-accelerator)` →
`'end-to-end'`.

---

## FAILING TESTS (TDD — write first, run red, implement, run green; D6 §5 / D8 parity style)

### Objective automated gate — backend pytest (`tests/workshop/`)
Add `tests/workshop/test_track_persistence.py`:
- **T0-B1 (stamp):** `vibe_start_track` for a NEW genie-code session persists
  `workshop_level == "genie-accelerator"`. Assert against the save_session spy / in-memory Lakebase
  fallback (mirror the existing tests' pattern), NOT via `session_parameters`.
- **T0-B2 (column not JSONB):** the stamped value is the top-level `workshop_level`, and
  `session_parameters` does NOT gain a `workshop_level` key.
- **T0-B3 (preserve on later writes):** after a subsequent `vibe_complete_step` save (which omits
  `workshop_level`), the persisted `workshop_level` is still `"genie-accelerator"` (COALESCE proof).
- **T0-B4 (load surfaces it):** the session-load response path returns `workshop_level ==
  "genie-accelerator"` for that session (so App.tsx's `response.workshop_level` read sees it).
- **T0-B5 (resume-not-clobbered):** calling `vibe_start_track` with an existing `session_id` does
  NOT overwrite an already-set `workshop_level` (the seed save is guarded to new sessions only).
- Run isolated (SDK-neutralized, pinned `mcp==1.30.0`) to avoid the ambient `~/.databrickscfg`
  hang: unset LAKEBASE/PG env, neutralize Databricks SDK config, `-c /dev/null --rootdir=.`.

### Frontend precedence — pure-logic verification (no JS unit runner exists)
Repo has **no vitest/jest** — only Playwright e2e (`test:onramp`, `playwright.config.ts`). Do NOT
add a JS unit runner in T0 (that is a pinned-dep + test-infra decision — see Decision D-T0-1).
Instead:
- Make `resolveRestoredLevel(...)` a **pure exported function** so its precedence is verifiable by
  inspection and by `tsc -b` type-checking.
- Gate: `cd frontend`-equivalent build path → `npm run build` (`tsc -b && vite build`) clean +
  `npm run lint` clean **on the touched files** (repo has pre-existing lint debt in untouched files;
  scope the lint judgment to the diff).
- The visible "resumed genie-code session opens on the genie-accelerator outline with gates mapped;
  no 0/28" acceptance is inherently **browser-side** → verified by the human LIVE SMOKE (hard stop).
  The implementer documents the exact resume scenario for the smoke runbook.

---

## SCOPE / SERIALIZATION
- Trunk files touched: `src/backend/mcp_server.py`, `src/App.tsx`, `src/constants/codingAssistants.ts`.
  T0 is a SINGLE task with no parallel siblings this step → no intra-phase shared-file contention.
- No DDL, no `db/lakebase/ddl/*` change, no migration, no reseed. `workshop_level` column pre-exists.
- No new dependency. No requirements.txt change.
- Do NOT touch: the number↔tag stores (T4/T5), `getFilteredSections` deletion (T4), the outline
  endpoint (T1), the parity harness (T2), `_legacy_progress` (subsumed T3 / retired T5).

## EXIT GATE (T0)
- Backend pytest `tests/workshop` green (incl. T0-B1..B5), pasted in the PR.
- `tsc -b && vite build` + scoped eslint clean.
- §4.4 browser-compat floor still green against the edited mcp_server.py.
- Cross-reviewed clean by a DIFFERENT vendor than the implementer.
- HUMAN LIVE SMOKE (hard stop): a resumed genie-code session opens on the genie-accelerator outline
  with gates mapped; no 0/28. (polly produces the runbook; the human runs it.)

## DECISIONS TO SURFACE (recommend-and-proceed; flag for the human)
- **D-T0-1 (JS unit runner):** No vitest/jest in the repo. RECOMMENDATION: do NOT add one in T0 —
  keep the frontend change pure + rely on build/typecheck + the live smoke; revisit a JS unit
  harness if T3 (SPA repoint) warrants broader frontend coverage. (Reversible.)
- **D-T0-2 (legacy backfill for genie-code):** Existing genie-code sessions hold `workshop_level=
  '300'`; the corrected assistant fallback (genie-code→genie-accelerator) rescues them on read.
  RECOMMENDATION: rely on the corrected fallback (no DB backfill write) for T0; a broader
  number↔tag legacy backfill policy is explicitly a pre-T3 human decision per the charter.
- **D-T0-3 (`'300'` "real track" test):** define "meaningful persisted workshop_level" as
  "a value that normalizes to a known track and is not the bare `'300'`/empty default."
  RECOMMENDATION: treat `'300'` and empty/undefined as NOT-a-real-track so the corrected fallback
  fires; confirm the exact `normalizeLevel('300')` behavior during implementation.

## HARD STOPS (human-only — polly produces artifacts and WAITS)
- Deploying to any workspace (`scripts/deploy.sh --code-only -t fevm-serverless`).
- The number↔tag flip / dropping legacy number stores (T4/T5 — NOT in T0).
- Any reseed (`deploy.sh --tables-only`) — NOT triggered by T0 (no DDL/prompt-body change).
- The LIVE GENIE CODE SMOKE (client side) — the human pastes the /mcp URL and resumes the session.

## ROUTING
Implementer: **claude_code** (`system.ai.claude-opus-4-8[1m]`). Reviewer: **codex** (different
vendor) — CONTINGENT on codex provider-auth recovering (it failed twice this session with
"provider auth command `sh` produced an empty token"); if codex is still down at review time,
**cursor** is the different-vendor reviewer. ONE PR. polly never merges.
