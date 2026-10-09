# Phase 3 (inserted) — Retire the step-70 `use_case_selection` ghost

Base: `feature/genie-code-mcp-integration` @ `f83470e` (PR #57 merged). Lands
BEFORE Task 4 (getFilteredSections still exists as the parity source, so the TS
source + engine are edited together and the golden regenerated). ONE PR.

polly is supervisor: plan, delegate to coding sub-agents on their own worktrees,
cross-review every diff with a different vendor. polly WRITES NO CODE and NEVER
MERGES. The human reviews and merges. HARD STOPS (human-only): any
`scripts/deploy.sh` deploy; any reseed (`deploy.sh --tables-only`) if a prompt
BODY changes.

---

## NON-NEGOTIABLE GUARDRAILS (verbatim, inherited from Phase 3)

1. ONE ENGINE: the outline change lands in the engine (manifest/generate_manifest)
   AND the TS source (workflowSections) TOGETHER; never let the two diverge.
2. PARITY IS THE SAFETY NET: regenerate golden_outline_matrix.json and every
   use-case golden from the corrected source; prove the harness is NON-HOLLOW
   (tamper a ts sequence => test fails; regen => byte-restore) and paste results.
3. THE USE CASE IS STILL CAPTURED: a Genie Code learner who has NOT pre-picked
   MUST still be asked once, up front, before the first numbered step. Removing the
   numbered step must NOT remove the elicitation — only its position/duplication.
4. PRD STILL GETS ITS BRIEF: prd_generation must still consume use_case_brief with
   step 70 absent from the outline (generate_manifest.py override reworked, not
   deleted blindly — the producer is now pre-journey, not an outline node).
5. ADDITIVE/REVERSIBLE; no reseed unless a prompt BODY changes (seed edits to
   02_seed_section_input_prompts.sql for use_case_selection => flag the reseed to
   the human as a hard stop, do not run it).
6. REPO REALITY: no uvicorn/npm run dev; run `pytest tests/workshop` + `npm run
   build`/`lint` from repo root locally, paste results; IN-REPO context only;
   cross-review every diff (claude_code <-> cursor; codex may be down).

---

## VERIFIED ANCHOR PACK (3 explores against live `f83470e`; drift corrected)

### Critical terminology (do not conflate — this is the #1 footgun)
- **Step 1** — title "Define Your Intent", sectionTag **`usecase_selection`** (NO
  underscore). The App's PRE-JOURNEY intent act. SPA-only: appears 0 times in the
  engine manifest, in NO section's numbered `steps` array. `workflowSections.ts:392`.
- **Step 70** — title "Define Your Use Case", sectionTag **`use_case_selection`**
  (WITH underscore). The NUMBERED GHOST being retired. `workflowSections.ts:492`.
- Every edit below targets **`use_case_selection` / step 70**. NEVER touch step 1 /
  `usecase_selection`.

### TS source (`src/constants/workflowSections.ts`)
- `:492` `ALL_STEPS[70] = { number:70, title:'Define Your Use Case',
  icon:ClipboardList, color:'text-blue-300', sectionTag:'use_case_selection' }`.
- `:504-506` `SECTION_TAG_TO_STEP_NUMBER` — **auto-derived** from `ALL_STEPS`
  (NOT a hand-written `STEP_NUMBER_BY_TAG`; that identifier does not exist).
  Deleting `ALL_STEPS[70]` auto-removes the `use_case_selection -> 70` entry.
- `:550` `steps: [2, 70, 3].map(n => ALL_STEPS[n])` — **the ONLY hard break.**
  Must become `[2, 3]` in the same change, or `ALL_STEPS[70]` -> `undefined` in
  the array (the current ghost).
- `:800-809` non-genie strip `if (section.id === 'define-usecase' && !isGenie) {
  steps = section.steps.filter(step => step.number !== 70) ... }` — becomes a
  no-op once 70 is gone from the base array; remove for cleanliness (the
  `isSkillsAccelerator` PRD-drop of step 3 STAYS).

### Engine generator (`scripts/generate_manifest.py`)
- `:382-387` mirror strip `section_steps = [n for n in section_steps if n != 70]`
  in the `elif section_id == "define-usecase" and not is_genie` branch — remove
  the `!= 70` handling once 70 leaves the base (the `is_skills` PRD-drop STAYS).
- `:243-254` `GENIE_CHAINING_LITERAL_OVERRIDES`, entry `3: {"use_case_brief": 70}`
  at `:249` — **load-bearing dependency on the number 70.** Must be re-pointed /
  re-expressed so `prd_generation` still consumes `use_case_brief` from the
  retained (pre-journey) producer, NOT deleted blindly.
- Regen output: `src/backend/workshop/manifest.json`. genie-accelerator numbered
  step count **32 -> 31** (drops by exactly 1). `use_case_selection` occurs once
  across all 14 tracks (genie-accelerator only) => NO other track's count changes.
- `manifest.json:3255-3269` is the engine twin of the ghost (`order:2`,
  `produces:"use_case_brief"`, `requiresGate:"project_setup"`); `:3277`
  `prd_generation.requiresGate:"use_case_selection"`, `:3278-3281`
  `consumes:["use_case_brief"]`. The regen must drop `use_case_selection` from the
  numbered outline here too.

### MCP capture logic (`src/backend/mcp_server.py`) — STAYS, keyed on the STRING
- `:166-171` `ExplainabilityPayload.available_industries/available_use_cases` fields.
- `:782-792` inline population when `step.sectionTag == "use_case_selection"`.
- `:1552-1594` catalog helpers (`_available_industries`/`_available_use_cases`,
  certified-first); `:1597-1620` resource wrappers; `:1444-1456` set_parameters echo.
- `:1194-1231` blocking-interaction gate + custom-path unblock + GATE_REQUIRED msg.
- `:1256-1266` session auto-rename on lock.
- `vibe_set_parameters` lock is `:1372-1534`; `_SELECTION_REQUIRED`/`_CUSTOM_REQUIRED`
  `:1041-1042`; `_custom_usecase_locked` `:1075-1078`.
- `vibe_start_track(industry, use_case)` `:830-884` seeds session_parameters/DB
  columns ONLY — does NOT append `"use_case_selection"` to completed_gates nor
  write `use_case_brief`.

### Engine gate/walk model (`src/backend/workshop/engine.py`)
- Progress = `SessionState.completed_gates: list[str]` + `captured_outputs` +
  `session_parameters` (`:15-19`). NO pre-journey / precondition primitive exists.
- `outline` `:112-140` walks `_ordered_steps`; first incomplete `can_start` =>
  `"current"`. `can_start` `:154-157` = `requiresGate is None or requiresGate in
  completed_gates`. `complete_step` `:204-211` appends the **sectionTag** to
  completed_gates and writes `captured_outputs[produces]`.
- `resolve_previous_outputs` `:215-221` is **KEY-BASED, not outline-position-based**
  => `use_case_brief` resolves for PRD as long as it lives in captured_outputs,
  regardless of whether `use_case_selection` is an outline node.
- BUT `prd_generation` stays `STEP_LOCKED` unless `"use_case_selection"` (or its
  replacement gate) is in completed_gates (requiresGate). => removing the outline
  node WITHOUT a new writer for BOTH the gate string AND the brief locks PRD.

### App-master model to mirror (SPA)
- `App.tsx:409-414` and `:564-569`: on restore/load, `if industry && use_case:
  completedSteps.add(1)`. Step 1 is pre-journey — deterministically complete when
  intent is set, independent of numbered steps.
- `WorkflowDiagram.tsx:3540-3554` renders `<DefineIntentSection>` up front (Stage 3,
  comment `:448`). The per-step content `switch (step.number)` `:1273` has **NO
  case 70** => step 70 hits `default: return null` = the ghost.

### Tests + goldens (PR scope) — all key on the STRING `use_case_selection`, never "70"
- Oracles: `scripts/dump_getfilteredsections.mjs` (real getFilteredSections) ->
  `golden_define_usecase_by_track.json`, `golden_order_genie_{default,ontology_on,
  lakehouse_on}.json`; `scripts/dump_outline_matrix.mjs` -> `golden_outline_matrix.json`.
- `golden_chaining_genie.json` is **HAND-AUTHORED** (mirrors
  `GENIE_CHAINING_LITERAL_OVERRIDES[3]`; `fixtures/README.md:70-74`).
- Tests to update: `test_manifest_parity.py:146-184` (outline order, produces/consumes,
  requiresGate chain), `test_engine.py:94-98` (chaining parity vs golden),
  `test_lock_produce.py:242-332`, `test_usecase_gate.py:86-208`,
  `test_session_gates_passthrough.py:74-92`, `test_session_autosave.py:66-107`,
  `test_stateless_isolation.py:114-268`, `test_sync_bridge.py:132-206`,
  `test_write_tools.py:54-64`, `test_custom_usecase_draft.py:246-265`,
  `test_usecase_inline_payload.py:6-122`, `test_interactivity.py:195-209`.
- `test_outline_parity.py` has no direct string refs — moves only via the
  regenerated matrix.
- Regen reference: `tests/workshop/fixtures/README.md:10-20,42,70-74`.

---

## THE DESIGN FORK (human decides — surfaced, NOT decided autonomously)

Removing step 70 from the numbered outline forces a decision about how PRD stays
reachable + gets its brief, and where a fresh learner is elicited up front.

**Option A (RECOMMENDED) — `use_case_selection` survives as a PRE-JOURNEY gate key.**
- `use_case_selection` stays a valid gate STRING + `use_case_brief` PRODUCER, but is
  removed from the numbered `outline_order` (TS `[2,3]` + manifest regen).
- The MCP resolves it up front (before `project_setup`), mirroring App step 1:
  when the use case locks (confirm / custom-draft-ready, or `vibe_start_track` with
  industry+use_case), the engine writes `"use_case_selection"` to completed_gates
  AND `use_case_brief` to captured_outputs.
- `prd_generation.requiresGate` stays `"use_case_selection"`, `consumes` stays
  `["use_case_brief"]` — the PRD chain is preserved UNCHANGED; the chaining override
  (`generate_manifest.py:249`) re-points from step-70 to the pre-journey producer.
- Elicitation: a pre-journey beat surfaces the picker payload before the first
  numbered step whenever `use_case_selection` is not yet in completed_gates.
- PROS: minimal PRD-chain change; keeps use-case capture as a distinct, trackable
  gate (backfill/analytics can see it); most faithful mirror of App step 1.
- CONS: introduces a "pre-journey gate resolved up front" mechanism the engine
  lacks today (but this is exactly the task's intent).

**Option B — fold `use_case_selection` entirely into `project_setup`.**
- `prd_generation.requiresGate` reroutes to `"project_setup"`; the
  `use_case_selection` gate string is dropped from completed_gates.
- `use_case_brief` produced as part of/alongside `project_setup` completion.
- PROS: no separate pre-journey primitive; one fewer gate.
- CONS: loses the distinct use-case-captured signal (harder backfill/tracking);
  conflates project scaffolding with use-case intent; more invasive to the
  produce/consume contract (project_setup producing use_case_brief is semantically
  odd). The charter itself flags A as recommended ("recommended: yes, for tracking").

polly recommendation: **Option A.** Pause for the human's decision before dispatching
the implementer, because the fork "Affects backfill + the PRD chain" and the human
explicitly reserved it ("do not decide autonomously").

---

## WORK (ONE PR, once the human picks the fork)

- **A. OUTLINE** — drop step 70 as a numbered step on BOTH surfaces:
  `workflowSections.ts:550` `[2,70,3] -> [2,3]`; remove the `!= 70` strip at
  `:804`; `ALL_STEPS[70]` node + auto-derived reverse-map entry removed (verify no
  other consumer needs it — audit says none hardcode 70 outside the threading).
  `generate_manifest.py:385` `!= 70` handling removed; regen `manifest.json`.
  Confirm genie-accelerator 32 -> 31, NO other track drift.
- **B. MCP pre-journey Intent beat** — relocate use-case elicitation + lock to run
  BEFORE the first numbered step (per the chosen fork). Keep the catalog + confirm/
  lock/custom-draft logic; move the resolution up front. Write the completed_gates
  marker per the fork decision.
- **C. CHAINING** — rework `use_case_brief -> prd_generation` so consumes still
  resolves with the producer pre-journey. Re-point/re-express
  `GENIE_CHAINING_LITERAL_OVERRIDES[3]`; add/adjust the pinning test.
- **D. TESTS + GOLDENS** — update the test files listed above; regenerate all
  goldens from the corrected source via the documented oracles; add a regression
  test: genie-accelerator outline contains NO `use_case_selection` numbered step,
  AND a fresh genie-code walk still elicits+records the use case up front.

## VERIFY (paste into the PR)
- `pytest tests/workshop` targeted offline files (full suite hits live Lakebase),
  SDK-neutralized env; results pasted.
- Parity NON-HOLLOW proof: tamper a ts sequence => test fails; regen => byte-restore.
- `npm run build` + changed-files lint from repo root: 0 errors.
- Manifest diff: genie-accelerator 32 -> 31 + NO collateral track drift.

## Roster / review
claude_code implements (`system.ai.claude-opus-4-8[1m]`) -> cursor reviews (codex
down on host-side HOME/isaac provider-auth). ONE PR; polly never merges.
