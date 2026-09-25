# Phase 2B — Use-Case Selection Step + Cross-Surface Step-Sync Bridge

**Plan owner:** polly (orchestrator; writes no code, never merges) · **Date:** 2026-09-23
**Base branch:** `feature/genie-code-mcp-integration` @ `dc61259` (Phase 0–2 shipped, deployed
`fevm-serverless`, smoke green, 6 tools) · **Design source of truth:** `docs/specs/mcp_design/`
D11 (`mcp-workshop-usecase-selection.md`) — §3 design, §6 tests, §8 tasks; D9 §1/§4 phasing +
preflight. **Repo reality wins over any doc.**

Scope: the two decoupled, additive fast-follows' **first** phase. Add an in-band use-case
discovery/selection stage before PRD (fixes the live PRD-jump defect), and bridge MCP↔SPA step
progress. **Genie Accelerator (`DEFAULT_TRACK`) only** — the all-tracks hoist is Phase 4.
**Do NOT touch Phase 2A** (adaptive coaching) until 2B is green + human-approved.

---

## GUARDRAILS (verbatim — propagate to EVERY sub-agent)

1. **TOOL BUDGET:** 2B adds **ZERO tools** (listings are RESOURCES; mutation reuses existing
   tools). The count stays at **6** (≤7). Never add a 7th here (the 7th, `vibe_coach`, is Phase 2A).
2. **ONE REPOSITORY / ONE ENGINE / ONE ASSEMBLER / ONE FMAPI SEAM** — reuse
   `get_industries()` / `get_use_cases_map()` / `get_section_input_content` /
   `call_databricks_serving_endpoint`; never fork a second one.
3. **ADDITIVE DATA ONLY; migrations idempotent (IF NOT EXISTS).** (2B needs NO new DDL — all
   required columns already exist; see anchor pack.)
4. **RECOMMEND-AND-PROCEED (D5 §3):** certified use case is the recommended default; never block
   except the existing gates (PRD-needs-locked-UC; Step-9 benchmark).
5. **CUSTOM USE CASE STAYS SESSION-LOCAL** — no write to `saved_usecase_descriptions`.
6. **IN-BAND ONLY (D1 §2, §10):** no server→client protocol calls. All interactivity is in-band.
7. **PROBE FLOOR still holds:** `/mcp` returns 200 not 307; mount before SPA catch-all; lifespan
   composed; `stateless_http`; app name starts with `mcp-`.
8. **REPO REALITY:** NO local server (no `uvicorn`/`npm run dev`). Pin any dep EXACT in
   `requirements.txt`. NO CI → run `pytest tests/workshop` locally and PASTE results in every PR.
   (The ambient `uv`/`./scripts/test.sh`/`asyncio_mode` CLAUDE.md is a DIFFERENT repo's — ignore it.
   This repo tests with pytest under `tests/workshop`; isolate the home-dir `pyproject.toml` with
   `-c /dev/null --rootdir=.` and neutralize ambient Databricks/Lakebase env for the offline
   fallback, exactly as Phase 2 did.)

---

## VERIFIED ANCHOR PACK (live @ `dc61259`, three parallel explores + one generator deep-dive)

### mcp_server.py (6 tools; codex)
- `36-38` `DEFAULT_TRACK="genie-accelerator"`, `DEFAULT_INDUSTRY="Technology"`,
  `DEFAULT_USE_CASE="Genie Accelerator"`.
- `435-467` `_step_payload(track, state, step, session_id)` — reads `industry`/`use_case` from
  `state.session_parameters` (falling back to defaults), calls
  `assembler.get_section_input_content(...)`, and already sets
  `interaction=_interaction_payload(step.sectionTag)`.
- `486` `vibe_start_track` — already seeds `save_session(current_step=1, completed_steps=[])` on a
  new Lakebase session.
- `603` `vibe_complete_step` — blocking-gate check `613-625` (looks for
  `decision_capture_key(sectionTag, block.id)` in `captured_outputs`); `save_session` `642-646`
  writes **only** `captured_outputs` + `completed_gates` — **NOT** `current_step`/`completed_steps`
  (the sync-bridge gap, task 5).
- `675` `vibe_submit_answer` — writes `decision_capture_key =
  "interaction_decision:{section_tag}:{interaction_id}"` into `captured_outputs`; for
  `type:"decision"` **any** answer confirms; for `type:"confirm"` non-skipped, answer must equal
  `recommended`. Confirms only if the interaction is on the current step.
- `748` `vibe_set_parameters(session_id, params: dict)` — merges arbitrary keys into
  `session_parameters`, persists via `save_session(session_parameters=...)`.
- Imports: `from .workshop import assembler, engine, manifest`; `from .services.lakebase import
  (append_session_interaction, is_lakebase_configured, load_session, save_session)`.

### manifest generation (cursor + generator deep-dive; codex)
- **manifest.json is GENERATED** by `scripts/generate_manifest.py` from
  `src/constants/workflowSections.ts`. A hand-edit is **overwritten** on regen (Phase-0 byte-parity
  discipline). Task 1 edits the TS source + generator, then regenerates.
- `define-usecase` (manifest.json `~1786`) currently = `project_setup` (order 1, `produces:null`) →
  `prd_generation` (order 2, `produces:"prd_document"`, `consumes:[]`,
  `requiresGate:"project_setup"`). Step JSON keys: `order, sectionTag, title, why, gate,
  requiresGate, consumes, produces, execution, surfaces, flag`.
- `ALL_STEPS` (workflowSections.ts `388-394`) is numeric-keyed; **key 70 is unused** (gap 69→71).
  Existing `usecase_selection` (step 1 "Define Your Intent") is a **different tag** and is NOT in
  `define-usecase`.
- **Per-track scoping precedent exists and is duplicated in BOTH layers:** `getFilteredSections`
  (TS `757-775`) has `if section.id==='define-usecase' && isSkillsAccelerator → strip step 3`, and
  `_filtered_sections` (generate_manifest.py `257-281`) mirrors it (`is_skills`, `is_genie`
  branches). There is **no generic per-track override map** — scoping is explicit hardcoded
  branches. Both layers MUST be edited in lock-step or the TS/manifest diverge.
- **produces/consumes/requiresGate are assigned in Python** (`_metadata`, `produces_by_step`,
  `consumes_by_step`, requiresGate chained from the previous step's tag), NOT from the TS.
- `manifest.json` nests sections **inside each track** (per-track copies in the generated output),
  so a genie-accelerator-only define-usecase is representable in the output.

### routes.py resources backing (cursor)
- `1924` `GET /industries` → `get_industries()` (`795-838`): `List[{value,label}]`, leading
  placeholder, priority-ordered.
- `1938` `GET /use-cases/{industry}` → `get_use_cases_map()`; entry shape (`870-884`) includes
  `value, label, path_type, is_certified` (+ `category`, `category_order`, `display_order`).
  **Certified-first ordering is FRONTEND-only** (`UseCaseCardGrid.tsx`); the API returns raw
  Lakebase order — so the `vibe://usecases/{industry}` resource must sort by `is_certified` itself.
- `1241` `get_section_input_content` is a **re-export** of `assembler.py:18` — do NOT fork.

### interactions.json + gate (cursor)
- Shape `{ "<sectionTag>": { "<slot>": <block> } }`, slots `pre|decision|post`. Block keys:
  `id, type, question, options[]{id,label}, recommended, skippable, coaching`.
- `blocking_interactions()` (manifest.py `185-195`) returns ONLY blocks with `type=="confirm"` AND
  `skippable is False`. Live blocking example: `gagent_benchmarks.decision` (`type:"confirm"`,
  `skippable:false`). A plain `type:"decision"` + `skippable:true` does **NOT** trip `GATE_REQUIRED`.

### lakebase.py + DDL (claude_code)
- `save_session` (`592-613`) accepts & persists `current_step`, `completed_steps`,
  `captured_outputs`, `completed_gates`, `session_parameters` (COALESCE-preserving; `None` keeps
  existing). `load_session` (`828`) round-trips all of them.
- `get_user_default_session` (`1129`) returns `current_step` + `completed_steps` (`:1250,:1252`) —
  **exactly what the 2B sync-bridge proof needs.** (It does NOT return
  `captured_outputs`/`completed_gates`, but D11 §6 only requires `current_step`/`completed_steps`
  to be reflected — so **NO change to `get_user_default_session` is needed for 2B**; extending it is
  a Phase 3 concern.)
- `03_sessions.sql`: `industry`, `use_case`, `current_step INTEGER DEFAULT 1`,
  `completed_steps TEXT` (JSON string). `12_mcp_engine_state.sql`: `captured_outputs`,
  `completed_gates` (JSONB) — shipped. `01_usecase_descriptions.sql`: column is **`is_certified`**
  (NOT `certified`), plus `path_type`, `category`, `category_order`, `display_order`, and a partial
  index `idx_usecase_certified ON (industry, is_certified)`.
- Community-library write paths to **AVOID** (custom stays session-local):
  `save_usecase_builder_description` (`lakebase.py:2179` INSERT), `update_saved_usecase` (`2267`),
  `delete_saved_usecase` (`2292`). Read-only `get_all_saved_usecases` (`2196`) is safe.
- **No `13_mcp_coaching.sql`** (correct — that's Phase 2A).

---

## DECISIONS (recommend-and-proceed; flag any you'd change — all cheaply reversible early)

- **D-1 (the one material call): NO new seeded prompt body for `use_case_selection` in 2B.** The
  step's content is carried by its `title`/`why` + the interaction block; the assembler renders an
  empty/placeholder prompt for a tag with no seeded row, which is acceptable for the selection gate.
  This keeps 2B a **pure `--code-only` redeploy with NO reseed** (D9 §2/§4). Authoring a richer
  seeded prompt body lives in the SEPARATE template repo (not this app repo, D9 §0), requires a
  reseed (a hard stop), and is a follow-up. **If you want a real prompt body, say so** — it becomes
  a human-gated reseed task.
- **D-2: The interaction is `type:"confirm"` + `skippable:false`** (mirroring shipped
  `gagent_benchmarks`), question "Proceed with your selected use case?", `recommended` = the
  confirm option. The *use-case choice* (curated or custom override) happens via
  `vibe_set_parameters`; the interaction is the "you've picked one; proceed to PRD?" confirm that
  trips `GATE_REQUIRED`. This satisfies the §6 gate test, keeps override working, and adds **no new
  gate machinery** (D11 §3.4). (Rationale: the shipped `blocking_interactions` only blocks on
  `confirm`+`skippable:false`, and a `confirm` unblocks only when `answer==recommended` — so putting
  the *choice* in the answer would break override; putting it in `set_parameters` resolves it.)
- **D-3: NO `get_user_default_session` change** — it already returns `current_step`/`completed_steps`
  (the only fields the §6 sync-bridge test reads). Extending it to also surface
  `captured_outputs`/`completed_gates` is deferred to Phase 3.
- **D-4: Task 1 scopes to genie-accelerator via the existing hardcoded-branch precedent** — add
  `use_case_selection` to the shared `define-usecase` base and STRIP it for all non-genie tracks in
  BOTH `getFilteredSections` (TS) and `_filtered_sections` (generator). This mirrors the existing
  `isSkillsAccelerator` strip exactly. Verified in Phase 4 the strip is removed to generalize.
- **D-5: Custom "author your own"** — `vibe_set_parameters` accepts `description` (+ industry/
  use_case/label); the `use_case_brief` artifact records `source:"custom"`; NO
  `saved_usecase_descriptions` write. A test asserts zero rows there.
- **D-6: Worktrees under `.worktrees/`**, one per task, each its own PR. Routing per the human's
  new doctrine: **claude_code implements (model `system.ai.claude-opus-4-8[1m]`) → codex reviews**;
  cursor stays in rotation as an alternate reviewer/implementer.

---

## TASK GRAPH (trunk vs leaves; SERIALIZE shared-file edits)

Shared files that must serialize: the **manifest source** (`workflowSections.ts` +
`generate_manifest.py` + regenerated `manifest.json`) and **`mcp_server.py`**.

- **Wave 1 (parallel leaves — independent file sets):**
  - **T1 — manifest** (files: `workflowSections.ts`, `scripts/generate_manifest.py`,
    regenerated `manifest.json`, `tests/workshop/test_manifest_parity.py`). TRUNK for T3/T4/T5.
  - **T2 — resources** (file: `mcp_server.py` + `tests/workshop/test_usecase_resources.py`).
    Independent of the manifest change (backed by `get_industries`/`get_use_cases_map`).
- **Wave 2 (after T1 lands + T2 lands; serialize on `mcp_server.py`; stack on the reviewed bases):**
  - **T3 — interaction** (file: `interactions.json` + test). Needs T1 (use_case_selection step).
  - **T4 — lock + produce** (file: `mcp_server.py`; extends `vibe_set_parameters`, confirms
    `vibe_complete_step` writes `captured_outputs["use_case_brief"]`). Needs T1 + T3 (flow test uses
    the interaction). Stacks on T2's `mcp_server.py`.
  - **T5 — sync bridge** (file: `mcp_server.py`; `vibe_complete_step` also writes
    `current_step`/`completed_steps` derived from manifest section order). Stacks on T4.

Every diff is cross-reviewed by a DIFFERENT vendor than its implementer; blocking issues loop back
until clean. ONE PR PER TASK. polly never merges; the human merges.

---

## TASKS (TDD: failing test → run → minimal implement → run → commit → PR with pasted pytest)

### T1 — manifest: `use_case_selection` step (genie-accelerator only)
**Failing test first** (`tests/workshop/test_manifest_parity.py`, from D11 §6):
- Genie-accelerator `define-usecase` contains `use_case_selection` ordered **before**
  `prd_generation`, with `produces == "use_case_brief"`.
- `prd_generation.consumes` includes `"use_case_brief"` and
  `prd_generation.requiresGate == "use_case_selection"`.
- **Non-genie tracks are UNCHANGED**: their `define-usecase` still = `[project_setup,
  prd_generation]` with `use_case_selection` ABSENT (assert on ≥2 other tracks, e.g. `app-only`,
  `lakehouse`). This guards D-4.
- Regeneration is byte-identical (run `python scripts/generate_manifest.py`; `git diff` clean).
**Implement:** add `ALL_STEPS[70]` (`sectionTag:'use_case_selection'`), insert `70` into
`define-usecase` base steps before step 3 (`[2, 70, 3]`), add non-genie strip in BOTH
`getFilteredSections` and `_filtered_sections`, add `produces_by_step[70]="use_case_brief"` +
`consumes_by_step[3]=["use_case_brief"]` in the generator, verify `requiresGate` chains to
`use_case_selection` automatically; regenerate.
**Reviewer must independently confirm** the non-genie tracks are untouched (parity oracle derived
from the TS source, NOT from `manifest.json` — the Phase-0/Phase-2 self-reference trap).

### T2 — resources: `vibe://usecases/industries` + `vibe://usecases/{industry}`
**Failing test first** (`tests/workshop/test_usecase_resources.py`, D11 §6):
- `vibe://usecases/industries` returns industry options (`value`/`label`) off a mocked
  `get_industries()` seam (offline).
- `vibe://usecases/{industry}` returns use cases **certified-first** (`is_certified` true sorts
  ahead) off a mocked `get_use_cases_map()` seam, each with `value/label/category/is_certified`.
**Implement:** two `@mcp.resource` registrations (RESOURCES, not tools — budget-free) backed by the
existing seams; the `{industry}` resource sorts by `is_certified` (stable). Confirm tool count is
still **6** (assert `len(tools)==6`).

### T3 — interaction: `use_case_selection` decision block + existing gate
**Failing test first** (D11 §6): `vibe_complete_step("use_case_selection", …)` before the confirm
→ **`GATE_REQUIRED`**; after `vibe_submit_answer` (confirm==recommended) → the gate clears.
**Implement:** add a `use_case_selection` block to `interactions.json`, `type:"confirm"`,
`skippable:false`, `recommended` = the confirm option, certified-lead framing (D-2). No
`mcp_server.py` change (gate machinery is generic).

### T4 — lock + produce
**Failing test first** (D11 §6): after `vibe_set_parameters {industry, use_case[, label,
description]}` + the confirm, `vibe_complete_step("use_case_selection", captured_output=<brief>)`
writes `captured_outputs["use_case_brief"]`; then `prd_generation` UNLOCKS (no `STEP_LOCKED`) and
`vibe_get_step`/`_step_payload` renders against the chosen UC (assembler called with the locked
`industry`/`use_case`). **Custom path asserts NO `saved_usecase_descriptions` row** (D-5).
Also: `vibe_complete_step("prd_generation", …)` BEFORE selection → **`STEP_LOCKED`**.
**Implement:** formalize `vibe_set_parameters` handling of `industry`/`use_case`/`label`/
`description` (validate + persist into `session_parameters`); confirm the `use_case_brief` shape
(D11 §3.3) is written on completing `use_case_selection`. Stack on T2's `mcp_server.py`.

### T5 — sync bridge
**Failing test first** (D11 §6): after MCP `vibe_complete_step`, a legacy
`get_user_default_session(created_by)` read reflects MCP progress — `current_step` advanced and the
completed section's number in `completed_steps` — derived from the manifest section order.
**Implement:** in `vibe_complete_step`, additionally compute `current_step`/`completed_steps` from
the manifest's ordered steps for the track and pass them to `save_session` (which already accepts
both, COALESCE-safe). No `get_user_default_session` change (D-3). Stack on T4.

---

## EXIT GATE (D9 §1 row 2B / §4 preflight; D11 §6) — all objective, all verified by polly + cross-review
- D11 §6 tests green: manifest parity (T1), resources certified-first (T2), `GATE_REQUIRED` before
  decision (T3), PRD gated + locked-render + custom-is-session-local (T4), sync bridge via
  `get_user_default_session` (T5).
- Tool count **still 6 (≤7)** — zero tools added.
- `prd_generation` gated on `use_case_selection` and renders against the locked UC.
- `vibe_complete_step` updates `current_step`/`completed_steps`.
- No `saved_usecase_descriptions` write on the custom path; no new/edited DDL; probe floor intact
  (`mcp_server.py` changes don't regress 307/mount/lifespan or the §4.4 browser-compat floor —
  re-run the shipped compat/mount tests against any `mcp_server.py` diff).

## HARD STOPS — human-only; produce the artifact/PR/runbook and WAIT (D9 §5)
- **Deploy** to any workspace (`scripts/deploy.sh --code-only -t <target>`) — incl. the 2B redeploy.
- **Reseed** (`deploy.sh --tables-only`) — needed ONLY if a `use_case_selection` prompt body is
  added (D-1); if so, reseed BEFORE the code redeploy.
- **Live Genie Code smoke** (client side) — a human pastes the `/mcp` URL and drives the flow.
