# Phase 3 · Task 5 — Completion keying: reconcile → project STATUS → switch to tags (drop legacy number store)

**Status:** PLAN ONLY — awaiting human gate. No implementer dispatched.
**Base:** `feature/genie-code-mcp-integration` @ `2b40dfd` (T4b merged, local == origin).
**Shape:** a stack of PRs, in dependency order. polly writes no code and never merges; the human reviews + merges each PR, and personally runs any Lakebase migration / reseed / deploy.
**Reviewer:** claude_code implements → cursor reviews (codex down on the host-side `HOME`/`isaac` provider-auth). Each PR cross-reviewed by the opposite vendor.

---

## GUARDRAILS (verbatim from the T5 charter — propagate to every sub-agent)

1. **No return of client-side ordering; engine order stays authoritative.**
2. **Keep the frozen-golden parity tests green** (`tests/workshop/test_outline_parity.py` vs `fixtures/golden_outline_matrix.json`; the golden is non-regenerable post-T4b).
3. **Leave the T4a preview endpoint's session-less behavior untouched** (`POST /api/track/{track}/outline/preview`, `routes.py:5941-5971` — loads/writes nothing).
4. **Nothing staged under `.cursor/`.**
5. **Repo reality:** no `uvicorn` / `npm run dev`; targeted `pytest` offline (fail-fast auth: `DATABRICKS_AUTH_TYPE=pat` + unset `LAKEBASE_HOST`) + `npm run build`/`lint` from **repo root**; results pasted in every PR; in-repo context only.

### HARD STOPS — human-only; the plan stops **at** them, never crosses them
- Any **data migration, backfill, or drop** against Lakebase or the session store (this includes dropping/altering `completed_steps` / `current_step` columns).
- Any **reseed**.
- Any **deploy**.

The plan **must** (charter): list every persisted field that changes meaning, how existing sessions get migrated or read compatibly, and how to roll back — defaulting to a **read-compatible dual-read period before any drop**. See §5–§7.

---

## 1. THE PROBLEM (verified, with anchors)

Two independent progress stores coexist:

- **Number store** — `completed_steps` (int list, `03_sessions.sql:26` `TEXT`) + `current_step` (int, `03_sessions.sql:24`). Written by **both** the SPA/REST path and the MCP path.
- **Tag store** — `completed_gates` (sectionTag list, `12_mcp_engine_state.sql:14` `JSONB`). Written **only** by the MCP path; the SPA/REST save models have **no `completed_gates` field** (`routes.py:5415-5440`, `:6019-6042`), so the web UI cannot write it.

**The collision:** the same `completed_steps` column carries **two different numberings**:
- **App-origin** = **global `ALL_STEPS` numbers** (`App.tsx:105` state; persisted at `:741`, `:951`). The App never writes `completed_gates` (only reads it: `:436`, `:593`).
- **MCP-origin** = **dense track positions** (`_legacy_progress`, `mcp_server.py:1251-1257`), and MCP *also* writes authoritative `completed_gates` (`:969`, `:1370`, `:1665`).

`build_session_state` (`state.py:25-46`) reads gates first (`:26`) then **unions** tags synthesized from `completed_steps` **as a dense track index** (`:30-34`, `steps[step_number - 1].sectionTag`; `track_steps` is the dense track order, `manifest.py:127-128`, `:148-149`). The engine keys completion purely by `sectionTag ∈ completed_gates` (`engine.py:118-123`, `:157`).

**Consequence:**
- **MCP sessions** are correct — gates are authoritative, and the dense-index synthesis of their (dense) `completed_steps` is consistent, so the union is harmless.
- **App sessions** (gates empty) are **systematically misread** — their *global* numbers are interpreted as *dense track indices*.

**Worst-case (verified against `manifest.json`):**
- `end-to-end`, App-completed global `{1,2,3,4,5}` → gates `{project_setup, prd_generation, cursor_copilot_ui_design, deploy_databricks_app, setup_lakebase}`: a clean **off-by-one over-completion** (`usecase_selection` never marked; `setup_lakebase` falsely done → `engine.outline` advances `current` past a step the learner never started).
- `genie-accelerator` (DEFAULT_TRACK): low globals `{1,2,3}` mis-map into the wrong Lakehouse section (`genie_silver_metadata` falsely done); the learner's *real* progress lives at globals **57+**, which fail the `1 ≤ n ≤ len(steps)` guard (only 31 track steps) and are **silently dropped**.

**The load-bearing constraint for the fix:** the backend has **no global number↔tag map** — `Step.order` (`manifest.py:17`) *is* the dense track index (today's buggy basis). The authoritative global map lives **only in the frontend**: `ALL_STEPS` (`workflowSections.ts:390-499`) and its reverse `SECTION_TAG_TO_STEP_NUMBER` (`:507`) / `completedGatesToStepNumbers` (`:511`). So the prerequisite PR must **introduce a backend mirror of that global number↔tag map** and rewrite the `state.py` backfill to use it (dropping the `steps[n-1]` track-index lookup for App-origin numbers).

---

## 2. THE PR STACK (dependency order)

### PR 1 — Reconcile `completed_steps` ↔ gates (prerequisite) + provenance-comment refresh

**Why first:** Work B (endpoint STATUS projection) cannot *converge* until the endpoint's gate-derived status is correct for App sessions (an optimistic overlay masks flicker but never converges — see PR 2). This PR is the correctness foundation.

**Scope (pure read-side; no Lakebase change):**
- Add a backend mirror of the **global `ALL_STEPS` number↔tag map** (a generated/checked-in data module beside `manifest.py`, sourced from the same authority as the frontend `ALL_STEPS` so it cannot drift — decision **D-2** on generation vs. hand-mirror-with-parity-test).
- Rewrite `build_session_state` (`state.py:30-34`) to resolve App-origin `completed_steps` **global numbers → sectionTag via the new map**, with a **disambiguation rule** (decision **D-1**): when `completed_gates` is non-empty (MCP-origin, gates authoritative) trust gates and do not re-synthesize from numbers; when `completed_gates` is empty (App-origin) map the numbers as **global** `ALL_STEPS` numbers. Out-of-range / unmapped numbers are dropped explicitly (documented), never silently mis-indexed.
- **Refresh the stale provenance comments** in `scripts/generate_manifest.py`: `:50` (retired `dump_outline_matrix.mjs` + the false "imports REAL TS transforms and byte-verifies" claim — T4b flipped parity to engine-vs-frozen-golden), `:114` (deleted TS `REVERSE_SECTION_ORDER`), and `:71-72` (deleted `getFilteredSections`) — same rot, fold all three in.

**Failing test (fail-before / pass-after — the reconciliation proof):**
- Python endpoint/engine-level: construct a session as the **App** does (persist **global** `completed_steps`, empty `completed_gates`) for `end-to-end` and `genie-accelerator`; assert `engine.outline`/`build_session_state` marks the **correct** sectionTags `done` and does **not** falsely complete `setup_lakebase` / `genie_silver_metadata`, and does **not** drop genie globals 57+. Extend `tests/api/test_track_outline.py` (already covers backfill, `:183-203`, `:271-277`). This test **fails today** (dense-index misread) and **passes after** the map fix.
- A regression asserting MCP-origin sessions (gates present) are unchanged.

**Exit gate:** the fail-before/pass-after test green; full `tests/workshop`+`tests/api` green; frozen-golden parity untouched/green; `git diff --stat` shows no `App.tsx`/route-handler-body change beyond the reconciliation, no DDL, no Lakebase write-path change (unless D-1 folds SPA gate dual-write here — see decisions). Fully `git revert`-able (pure read-side; stored rows byte-unchanged).

### PR 2 — Work B: project STATUS from the endpoint (no flicker)

**Depends on PR 1** (so the endpoint's gate-derived status is correct for App sessions → the projection can converge).

**Scope:**
- Consume the endpoint's per-step `status` (`done/current/locked/skipped`, `engine.py:112-140`, `client.ts:352-356`) — today **discarded** at the single hinge line `App.tsx:167` (`setOutlineTags(resp.outline.map(item => item.sectionTag))` keeps ORDER only).
- Project `status` onto the sidebar + step surfaces (`SectionedWorkflowSidebar.tsx:207-242`, currently `completedSteps.has(n)` membership).
- **Keep an optimistic overlay** (guardrail #4 of the Phase-3 charter): union the just-completed local step with the endpoint projection so a completed step **never flickers back to not-done** in the persist→refetch window. Endpoint truth reconciles on the next fetch (refetch-after-persist already fires on all 8 write sites; polling + skeleton already exist — `App.tsx:151-175`, `:745-748`, `:1052-1099`, `WorkflowReadSkeleton`).
- Re-key the remaining `Set<number>` **status** reads to `sectionTag` where they drive done/current/locked; the `Set<number>` compat shim stays for the numeric-threshold consumers until PR 3 (see §2 note).

**Required no-flicker test (charter):**
- **Convergence contract (Python, PR-1-enabled):** persist a completion as the App does → refetch → assert endpoint `status` is `done` for that step's tag. Reproduces the "just-completed step not-done" defect against today's mismatch; passes after PR 1 + this projection.
- **Overlay guard:** a step the user just completed renders `done` **before** the refetch resolves (the pre-refetch window). No JS unit runner exists → decision **D-5**: extract a pure `mergeStatus(optimistic, endpoint)` helper tested via `node --experimental-strip-types` (mirrors the retired parity-oracle pattern), and/or a Playwright test that delays `update-metadata`/`/outline` and asserts the checkmark persists. **Do not** assume/stand up vitest.

**Exit gate:** both tests green; ORDER unchanged (no client-side ordering reintroduced — guardrail #1); frozen-golden parity green; T4a preview untouched; build/lint clean. `git revert`-able (code-only).

### PR 3 — Switch completion keying from numbers → tags; retire the legacy number store

**Depends on PR 1 + PR 2.** **Larger — likely sub-splits** (decision **D-4**). The actual **column DROP is a Lakebase migration = HARD STOP, human-run, OUTSIDE this code stack.**

Proposed sub-stack (each independently shippable + revertible):
- **PR 3a — SPA dual-write gates. [SHIPPED #64]** Add `completed_gates` to `SessionSaveRequest` / `SessionUpdateMetadataRequest` (`routes.py:5415`, `:6019`); `save_session` already accepts it (`lakebase.py:611`). The SPA computes tags from its `outlineTags` + the tag↔number bridge and writes **both** `completed_steps` (legacy) and `completed_gates` (new) on every completion/save (`App.tsx:730-741`, `:942-951`). ⚠️ **Rollback caveat (§7):** this persists a *new populated shape* (web sessions gain non-empty `completed_gates`); a code revert restores number-writing but cannot unwrite already-persisted gates — safe only because both readers *prefer* gates and tolerate both.
- **PR 3b — CANCELLED (verified vacuous, 2026-09-30).** The consumer re-key was unnecessary: PR 1's gate-first `deriveCompletedStepNumbers` (`App.tsx:38`) already made the 4 number-thresholding consumers (direction-lock `≥4`, started-guard `≥2`, `APP_LAKEBASE_STEPS` chain inference, session-card `.size`) read the gate-derived `completedSteps` set, so a tag-only-hydrated session yields identical results to the number-populated equivalent on current code — no fail-before test is constructible. Independently verified (proof re-run on genie-accelerator + end-to-end). No cosmetic re-key shipped.
- **PR 3b′ — skipped hydration gate-first (replaces 3b; closes R2).** Mirror PR 1 for skips: gate-first `deriveSkippedStepNumbers` (`skipped_gates` → numbers via the bridge) read in BOTH load paths (`App.tsx:476`, `:633`) in place of raw `response.skipped_steps`; surface `skipped_gates` in the load response if absent. `skipped_gates` was dual-written by 3a but never read back — this makes the skipped read symmetric with completed. Fail-before/pass-after: a skipped-only-via-gates session renders the same skipped set as the number equivalent. Read/UI-only.
- **PR 3c — re-key scoring / leaderboard / analytics. [LANDED]** Re-keyed the backend leaderboard/analytics completion aggregations (`get_leaderboard`, `get_analytics` `step_completion_counts` + the avg-score/user-activity score arrays) and the `LeaderboardPage` step-count display from raw `completed_steps` numbers to gate-derived GLOBAL numbers via PR 1's `step_number_to_tag` disambiguation. A single shared helper — `src/backend/workshop/completion_keying.py` (`resolve_completion_globals` / `canonical_global_numbers`, reusing PR 1's map, building its inverse once; NO second numbering authority) — resolves each row: **gates present ⇒ trust gates** (map each tag → its GLOBAL number, dense `completed_steps` ignored); **gates empty ⇒ App-origin** globals verbatim. `get_leaderboard`'s `WHERE` now ALSO admits gate-only rows (`completed_gates` non-empty when `completed_steps` empty/`[]`); analytics' `step_completion_counts` moved off the raw `json_array_elements_text(completed_steps)` unnest to a Python aggregation over the disambiguated per-row sets. Skipped moves in D-3 lockstep (origin decided once by `completed_gates`; `skipped_gates` from `session_parameters`). Gate-only (genie-accelerator globals 57+) and mixed App/MCP cohorts now score/count correctly, and number-populated App-origin scores/counts are preserved EXACTLY. FE: `LeaderboardPage.tsx` reads a new backend-provided `completed_step_count`; `AnalyticsDashboard` needs no change (its `step_completion_counts` render already keys on GLOBAL numbers against `CHAPTERS`, so re-keying the backend fixes the data). Killer number-independence test (`tests/workshop/test_completion_keying_aggregations.py`) proves tag-only == number-populated for both scores and `step_completion_counts`, with old-path-vs-new-path fail-before/pass-after evidence. `STEP_SCORES`/`CHAPTERS`, `engine.py`/`state.py`/`manifest.py`/`manifest.json`, the write models, and all DDL are untouched (read-side only).
- **(Human migration, not a polly PR) — DROP `completed_steps` / `current_step`.** Only after a soak with tag-only reads everywhere. `ALTER…DROP COLUMN` = Lakebase migration = **hard stop**; not `git revert`-able (data gone). polly produces the runbook; the human runs it.

> **DROP prerequisites (the `completed_steps`/`current_step` column drop is human-run, LAST, after the tag-only-read soak):**
> - **R1 (gating dependency) — gates-backfill for legacy number-only sessions** never dual-written; without it `deriveCompletedStepNumbers`'s number fallback loses their progress on the drop. **Human hard stop (backfill/migration): polly produces the RUNBOOK only** (backfill query + dual-read bake plan + backup/rollback), does not run it.
> - **R3 — `current_step` display re-point** (`SessionListDialog.tsx:192` “Step {current_step} of 20”): re-derive the position from gates/outline instead of the raw `current_step` scalar; code-only + fail-before test. Folded into the PR that precedes the `current_step` column drop.
> **Sequence:** PR 3b′ ✅ → PR 3c ✅ → **remaining tail:** R3 (`current_step` display re-point, folded into the `current_step` pre-drop PR) → R1 legacy gates-backfill RUNBOOK (human hard stop) → human-run `completed_steps`/`current_step` column DROP (last, after the tag-only-read soak).

**Note (`stepPreviousOutputs.ts`):** number-keyed but driven by the separate `step_prompts` store, consumed only by `TestScenarioConfig.tsx` — **orthogonal to completion keying**, out of PR 3 scope.

---

## 3. VERIFIED ANCHOR PACK

| Area | Anchor |
|---|---|
| App completion state (global numbers) | `src/App.tsx:105`; persist `:741`, `:942`, `:951`; read `deriveCompletedStepNumbers` `:36-44`, called `:435`, `:592` |
| FE global map | `src/constants/workflowSections.ts:390-499` (`ALL_STEPS`), `:507` (`SECTION_TAG_TO_STEP_NUMBER`), `:511` (`completedGatesToStepNumbers`) |
| Engine gate-keying | `src/backend/workshop/engine.py:118-123`, `:157`; status `:112-140` |
| **The mis-index (crux)** | `src/backend/workshop/state.py:25-46`, esp. `:29-34` (`steps[step_number-1]`) |
| Dense track order | `src/backend/workshop/manifest.py:17` (`Step.order`), `:127-128`, `:148-149` |
| MCP dense-position + gate dual-write | `src/backend/mcp_server.py:1251-1257` (`_legacy_progress`), gates `:969/:1370/:1665` |
| Endpoint status (discarded) | wire `src/api/client.ts:352-356`; **discard** `src/App.tsx:167`; engine `engine.py:112-140`; route `routes.py:5854-5904` |
| T3c levers | refetch `App.tsx:151-175`, `:745-748`; poll `:1052-1099`; skeleton `WorkflowReadSkeleton` + `WorkflowDiagram.tsx:3629-3635` |
| Persistence | `lakebase.py:592-612` (save), `:729/:731/:734` (COALESCE), `:828-939` (load) |
| DDL | `db/lakebase/ddl/03_sessions.sql:24-28`; `12_mcp_engine_state.sql:11,14` |
| Number-store consumers | thresholds `App.tsx:294-296`,`:657`; scoring `scoring.ts`, `lakebase.py:1401-1451`; leaderboard `:1520/:1575-1582`; analytics `:1747/:1888-1914`, `AnalyticsDashboard.tsx` |
| Provenance rot | `scripts/generate_manifest.py:50`, `:71-72`, `:114` |
| T4a preview (untouch) | `routes.py:5941-5971`; `client.ts:1281-1302` |

---

## 4. PERSISTED FIELDS THAT CHANGE MEANING (charter-mandated)

| Field (store) | Meaning today | Meaning after T5 | Migration / read-compat |
|---|---|---|---|
| `completed_steps` (`03:26` TEXT) | **Authoritative** completion, ambiguous numbering (App=global, MCP=dense) | **Demoted** to legacy/derived mirror; not the source | Read-compat: dual-read already prefers gates; PR 1 fixes the App-origin misread. Column stays until the human-run drop. |
| `completed_gates` (`12:14` JSONB) | MCP-only ledger | **The** completion ledger for all surfaces | SPA begins writing it (PR 3a). Existing MCP rows already correct; App rows read-corrected by PR 1. |
| `current_step` (`03:24` INTEGER) | Derived scalar (max of completed) | Same — a projection (of gate count/position) | No meaning change; keep deriving; dropped only with the human migration. |
| `captured_outputs` (`12:11` JSONB) | Artifact/decision keyed | Unchanged | None. |
| `workshop_level` (`03:25`) | Track id (legacy `'300'`/`None` tolerated) | Unchanged | None (orthogonal). |
| `session_parameters` (`03:28` JSONB) | direction/flags/chainContext + `skipped_gates`/`skippedSteps` | direction/flags/chainContext unchanged | ⚠️ `skipped` has the **same** number/tag split (`skipped_steps` TEXT `03:27` vs `session_parameters.skipped_gates`) — decision **D-3**: move in lockstep or defer. |

---

## 5. READ-COMPATIBILITY & DUAL-READ (charter-mandated)

- **Dual-read already exists** in both mirrored readers: `build_session_state` (`state.py:25-46`, gates-preferred-else-synthesize) and `deriveCompletedStepNumbers` (`App.tsx:36-44`). PR 1 only *corrects* the synthesize branch for App-origin numbers.
- **Dual-write window (PR 3a):** SPA/REST save paths must write **both** `completed_steps` (legacy) and `completed_gates` (new). MCP already dual-writes. `save_session` is already gate-capable (`lakebase.py:611`).
- **Tag-only reads (PR 3b/3c):** once every consumer reads tags, numbers are dead — the precondition for the human-run drop.
- **Ordering (charter default):** dual-read (present) → SPA dual-write (3a) → soak → tag-only reads (3b/3c) → **human-run column drop** (separate migration).

## 6. HARD STOPS (plan up to, never cross)

- Dropping/altering `completed_steps`/`current_step` = Lakebase migration → **human runs it**; polly produces the runbook only. No in-repo migration runner beyond raw DDL + `_ensure_schema`.
- Any retroactive **row rewrite** (retro-populate gates for legacy App sessions, renumber stored `completed_steps`) = data mutation → **human decision**, not designed here (the read-compat fix does not need it).
- Any **reseed** or **deploy** → human.

## 7. ROLLBACK

- **Code-only, `git revert`-able:** PR 1 (read-side reconciliation + comments), PR 2 (status projection + overlay), PR 3b/3c (consumer re-keying).
- **Persists new shape (revert caveat):** PR 3a (SPA writes gates) — code revert restores number-writing but cannot unwrite persisted gates; safe because both readers prefer + tolerate gates, but note the divergence.
- **NOT reversible by code:** the column DROP (data gone) — human-gated migration, last.

---

## 8. DECISIONS TO SURFACE TO THE HUMAN (before dispatching PR 1)

- **D-1 — PR 1 reconciliation shape:** read-side backend global number↔tag map + disambiguation rule (gates-present ⇒ trust gates; gates-empty ⇒ App-origin globals) — **recommended, fixes all existing rows on read, no migration**. Alternative: also add SPA gate dual-write in PR 1 (pulls PR 3a forward). Recommend keeping PR 1 read-only and deferring dual-write to PR 3a.
- **D-2 — the backend number↔tag map source:** generate it from the same authority as the frontend `ALL_STEPS` (preferred, drift-proof) vs. hand-mirror with a parity test (like the retired oracle pattern). Recommend generated + a parity test asserting BE map == FE `ALL_STEPS`.
- **D-3 — `skipped`:** move `skipped_steps`↔`skipped_gates` in lockstep with `completed` in T5, or defer to a follow-up? (Same number/tag split.) Recommend lockstep to avoid a second rot.
- **D-4 — PR 3 decomposition:** accept the 3a/3b/3c sub-split, and confirm the **column DROP is a separate human-run migration outside the polly PR stack** (hard stop).
- **D-5 — Work B no-flicker test harness:** pure `mergeStatus` helper via `node --experimental-strip-types` + Python convergence contract (recommended, no new infra) vs. adding Playwright coverage vs. net-new vitest (advise against).

---

**polly stops here at the human gate. No implementer dispatched until the plan (and D-1..D-5) are approved.**
