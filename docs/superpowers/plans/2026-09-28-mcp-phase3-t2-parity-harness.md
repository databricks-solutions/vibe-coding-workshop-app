# Phase 3 · Task 2 — Parity Harness (golden test; the safety net for T3/T4)

**Status:** authored 2026-09-28. One task, one PR. TEST-ONLY / additive. polly never merges; the human merges.
**Base:** `feature/genie-code-mcp-integration` @ `a957a99` (T1 merged; local == origin).
**Implementer → Reviewer:** claude_code (`system.ai.claude-opus-4-8[1m]`) → cursor (codex still down on provider-auth this session).

---

## GUARDRAILS (verbatim — propagate to the implementer)

- **G4 — parity is the safety net.** No UI/behavior change ships in this PR. Prove `engine.outline()` reproduces today's `getFilteredSections()` sectionTag sequence for the combos the engine can express, and for combos it cannot, LOG an explicit parity-gap finding — never force parity by bending the engine or the TS.
- **Non-hollow oracle.** Golden fixtures MUST be derived from the ACTUAL `getFilteredSections()` output (src/constants/workflowSections.ts:750) via the existing pure-function Node oracle — NOT hand-transcribed, and NOT built from `manifest.json`/`generate_manifest.py` (that hand-transcribed Python is the side the harness must catch drift in).
- **Cover every axis `getFilteredSections` branches on**, not just the 2 manifest flags: track/level, `direction` (forward/reverse), additive-chain climb (`overrides.sectionIds`/`APP_CHAIN`), `chapterVisibility`, AI-module sub-toggles (`LEVELS_WITH_AI_MODULES`), medallion sub-toggles (`LEVELS_WITH_MEDALLION_TOGGLES`), plus the genie `includeLakehouse`/`includeGenieOntology`.
- **Test-only, additive.** NO changes to `getFilteredSections`, `engine.outline`, `manifest.py`, `manifest.json`, `generate_manifest.py`, or ANY UI. Only: extend/add a Node oracle script, commit golden fixtures, add a pytest test, add a matrix/README.
- **G2 tool budget:** ZERO MCP tools touched (still 7). **G3 additive:** no DDL/reseed/UI/legacy-store/number↔tag change.
- **Probe floor / §4.4 browser-compat floor + MCP mount/contract must stay green** (they should be untouched by a test-only PR — confirm).
- **HARD STOPS — human only:** no `scripts/deploy.sh` (no deploy); NO number↔tag flip / legacy-store drop; no reseed. Open the PR and STOP — the human reviews the parity matrix + gap list and merges. Do NOT start T3.

---

## VERIFIED ANCHOR PACK (confirmed live against `a957a99` by 3 explores)

**The oracle (reuse, extend):** `scripts/dump_getfilteredsections.mjs` — reads `src/constants/workflowSections.ts` as text, stubs `lucide-react` (`const X = {}`), strips `import type`, writes a temp `.ts`, and `import()`s it under native Node type-stripping. Run: `node --experimental-strip-types scripts/dump_getfilteredsections.mjs`. Node v25.9.0 / npm 11.12.1 present; NO tsx/vitest/ts-node needed; `package.json` is `"type":"module"`. It already calls the REAL `getFilteredSections` + real toggle helpers and emits committed JSON. (Do NOT use `generate_manifest.py` — it re-implements filtering in Python and is the hollow side under test.)

**`getFilteredSections(level, disabledSectionTags=Set(), overrides?={sectionIds, chapterVisibility}, direction='forward')`** (workflowSections.ts:750). Axes that change the ordered sectionTag sequence:
- `level` → base `sectionIds` (`WORKSHOP_LEVELS` :298-386) intersected with `WORKFLOW_SECTIONS` order (:515-711).
- `direction='reverse'` → empties `activation` unless reverse; empties `databricks-app`/`lakebase` when reverse; drops lakehouse step 9; DI drops 19 (and 18 for reverse-lakebase), swaps 16↔17; **re-sorts sections by `REVERSE_SECTION_ORDER` (:951-958)**.
- `overrides.sectionIds` (additive climb, `APP_CHAIN=['app-only','app-database','lakehouse','lakehouse-di']` :947, via `getCumulativeOverrides` :1123-1155) → inserts earlier-chain sections.
- `overrides.chapterVisibility` (`ch1`-`ch4`) → toggles steps 9 (needs ch2) / 19 (needs ch1).
- `disabledSectionTags` → the union point through which **includeLakehouse, includeGenieOntology, AI-modules, medallion, and admin-visibility** all reach the function (App unions them first).
- genie/skills/reverse-lakebase special-cases baked in; empty-section drop; tail-pin (`iterate-enhance`, `cleanup` last).

**External toggle helpers (feed `disabledSectionTags`):**
- `getDisabledTagsForLakehouse` / `getDisabledTagsForGenieOntology` — genie-accelerator only (:213-274).
- `getDisabledTagsForAIModules` (:127) gated by `LEVELS_WITH_AI_MODULES` (:86-138) — modules `genie|agent|dashboard`.
- `getDisabledTagsForMedallionLayers` (:192) gated by `LEVELS_WITH_MEDALLION_TOGGLES` (:150) — `{B,S,G}`/`{B,S}`/`{B}`.
- admin `disabled_steps` from `/config/visibility` (App.tsx:874) — runtime admin override.

**Engine (what it can express):** `engine.outline(track_id, session)` (engine.py:91) → `manifest.outline_order` (manifest.py:113) = **strictly manifest declaration order (section order → step order) minus flag-filtered steps.** The ONLY expressible axis beyond track selection = 2 flags on **genie-accelerator only** (`includeLakehouse`, `includeGenieOntology`), read from `session.session_parameters` (top-level or nested `["flags"]`) via `_flags_for` (engine.py:59-74). NO direction/reverse, NO climb, NO chapterVisibility, NO AI-module, NO medallion, NO section-swap primitive. **14 manifest tracks == 14 TS `WORKSHOP_LEVELS` exactly.** reverse-* manifest tracks are FORWARD-ordered (reverse-lakehouse == lakehouse byte-identical) — they carry no reversed order.

**Fixture/test conventions (tests/workshop):** plain-pytest module functions with bare `assert` (no unittest). Bootstrap: `REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]; sys.path.insert(0, str(REPO_ROOT))`; `FIX = pathlib.Path(__file__).parent / "fixtures"`. Import: `from src.backend.workshop import engine, manifest`. Golden = committed JSON loaded via `json.loads(path.read_text())` (see `test_manifest_parity.py`, `test_engine.py`). Fresh session: `engine.SessionState(completed_gates=[], captured_outputs={}, session_parameters={"flags": {...}})`. Run: `.venv/bin/python -m pytest tests/workshop/...` (repo-root `.venv`, mcp==1.30.0), SDK-neutralized to avoid the `~/.databrickscfg` hang.

---

## DECISIONS (recommend-and-proceed; the gap-handling is the charter's explicit instruction)

**D-T2-1 — Assert parity where expressible; document gaps where not (never force parity).**
- **Engine-expressible cells (HARD ASSERT parity):** all 14 tracks at the DEFAULT combo (`direction=forward`, default `chapterVisibility`, NO climb overrides, all AI-modules on, full medallion, genie flags off); PLUS genie-accelerator's 4 flag combos (∅ / +lakehouse / +ontology / +both). These are the safety net — they MUST pass. If any diverges, that's a real manifest/engine drift finding to fix before T3.
- **Gap cells (DOCUMENT, do not force):** every combo exercising an axis the engine cannot express — `direction=reverse` (the 4 reverse-* tracks + any track offering reverse), additive-chain climb, non-default chapterVisibility, AI-module off-combos (`LEVELS_WITH_AI_MODULES`), medallion off-combos (`LEVELS_WITH_MEDALLION_TOGGLES`). For these, emit the TS sequence and the engine's (unavoidably unchanged) sequence and record the divergence as an explicit finding.

**D-T2-2 — Lock the WHOLE parity relationship via a committed expected-matrix (recommended), so drift in EITHER direction fails.**
The harness emits, for every track×legal-combo, `{ts: [tags], engine: [tags], status: "parity"|"gap"}` and asserts this matrix equals a committed `tests/workshop/fixtures/golden_outline_matrix.json` (derived from the real oracle at authoring time). Properties:
- An expressible "parity" cell that later diverges (a T3/T4 regression) → matrix changes → FAIL.
- A "gap" cell whose divergence changes, OR a gap cell that later becomes accidental parity → matrix changes → FAIL (forces conscious update).
- Also emit a human-readable `tests/workshop/fixtures/PARITY_MATRIX.md` (14 tracks × combos: pass/gap + the gap axis) — this IS the T3 reconciliation deliverable.
*Alternative for the implementer: `pytest.mark.xfail(strict=True, reason=...)` per gap combo + hard asserts for expressible combos. Acceptable if it still enumerates every gap explicitly and emits the matrix artifact. Either way: expressible combos hard-locked to parity; gaps explicitly enumerated & locked; nothing silently passed.*

**D-T2-3 — Combo legality from the TS source, not a hardcoded guess.**
The oracle enumerates the LEGAL combo matrix per track by reading the real TS constants (`LEVELS_WITH_AI_MODULES`, `LEVELS_WITH_MEDALLION_TOGGLES`, `APP_CHAIN`, reverse applicability, `CHAPTER_VISIBILITY`) — not a naive cartesian product and not my transcription. If a combo is illegal/never-offered for a track, don't emit it.

**Admin `disabled_steps`** (runtime `/config/visibility` override) is OUT OF SCOPE for the parity matrix — it is a per-deployment admin override, not a track-shape axis; note it in the README as intentionally excluded.

---

## TASK (single cohesive task → one worktree, one PR)

**Files:**
- `scripts/dump_getfilteredsections.mjs` (extend) OR `scripts/dump_outline_matrix.mjs` (new sibling, same read→lucide-stub→temp-`.ts`→`import()` scaffold) — loop all 14 `WORKSHOP_LEVELS`, enumerate each track's legal combos (D-T2-3), call the REAL `getFilteredSections(level, disabledTags, overrides, direction)` per combo with the real toggle helpers, flatten to sectionTag arrays. Emit `golden_outline_matrix.json`.
- `tests/workshop/fixtures/golden_outline_matrix.json` (new, committed) — `{ track: { comboKey: {ts:[tags], (optionally expected engine + status)} } }` (implementer picks the exact schema per D-T2-2).
- `tests/workshop/fixtures/PARITY_MATRIX.md` (new, committed) — human-readable matrix + explicit gap list.
- `tests/workshop/fixtures/README.md` (extend) — document the new oracle invocation.
- `tests/workshop/test_outline_parity.py` (new) — the parity test (plain pytest, conventions above).

**TDD failing tests (write first):**
- **T2-B1 (expressible parity, core safety net):** for each of the 14 tracks at the default forward combo, `[s.sectionTag for s in engine.outline(track, fresh_session)] == golden_ts[track]["default"]`. Must be a HARD assert. (This is the primary gate authorizing T3.)
- **T2-B2 (genie flag matrix):** genie-accelerator's 4 flag combos (∅/+lakehouse/+ontology/+both) — engine (with `session_parameters={"flags":{...}}`) == golden TS. Hard assert.
- **T2-B3 (gap enumeration, non-hollow):** for every gap combo (reverse, climb, chapter, AI-module, medallion), the matrix records `status:"gap"` with the concrete TS-vs-engine diff; the committed matrix locks it (D-T2-2). Assert the computed matrix == committed matrix. A gap combo that silently matched engine would be caught (and is itself a finding).
- **T2-B4 (oracle is real / regeneration):** a test (or documented `make`-style step) that re-running the Node oracle reproduces `golden_outline_matrix.json` byte-identically (mirrors `test_manifest_regeneration_is_byte_identical`) — proves the fixtures came from the real `getFilteredSections`, not hand-editing. If subprocess-in-pytest is undesirable offline, at minimum assert the committed fixtures parse and cover all 14 tracks, and document the exact regenerate command.
- **T2-B5 (matrix completeness):** assert the matrix covers all 14 tracks and every legal combo per D-T2-3 (no track silently omitted).

Run OFFLINE: `.venv/bin/python -m pytest tests/workshop/test_outline_parity.py -c /dev/null --rootdir=. -p no:cacheprovider -q`, SDK-neutralized (`env -u DATABRICKS_HOST -u DATABRICKS_TOKEN DATABRICKS_CONFIG_FILE=/dev/null`). Also run the full `tests/workshop` (+ `tests/api` §4.4 floor) to prove no regression. PASTE both in the PR.

---

## EXIT GATE (T2)
- `tests/workshop/test_outline_parity.py` green: expressible cells (14 forward defaults + genie 4 flag combos) HARD-ASSERT parity; gap cells enumerated & locked.
- Golden fixtures provably derived from the REAL `getFilteredSections` (non-hollow oracle; regeneration byte-identical).
- Full `tests/workshop` + §4.4 floor green — no regression; still 7 MCP tools; no DDL/UI/manifest/getFilteredSections/generate_manifest change.
- Deliverables present: the parity matrix (14 tracks × combos: pass/gap) + the explicit **T3 reconciliation gap list** (axes the engine can't yet express) — committed as `PARITY_MATRIX.md` and surfaced in the PR body.

## CROSS-REVIEW FOCUS (cursor)
- Fixtures genuinely come from the real `getFilteredSections` oracle (not hand-transcribed, not from manifest.json) — regeneration is byte-identical.
- Expressible cells are HARD-asserted (the safety net is real, not xfail'd away); gaps are explicitly enumerated and locked (no silent pass; parity not forced by bending engine/TS).
- Combo legality derived from TS constants (D-T2-3), matrix covers all 14 tracks.
- Test-only: no change to getFilteredSections/engine/manifest/generate_manifest/UI; §4.4 floor + MCP contract untouched.
- The gap list is complete and correct (reverse, climb, chapter, AI-module, medallion) — this is what authorizes/scopes T3.
