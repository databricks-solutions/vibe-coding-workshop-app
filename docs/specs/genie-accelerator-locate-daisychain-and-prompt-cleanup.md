# Genie Accelerator — Locate Daisy-Chain, Per-Mode Prompts & Prompt Copy Cleanup (handoff spec)

**Status:** Ready to execute · **Author:** pairing session (Ask-mode review → spec) · **Date:** 2026-09-14
**Target repo:** `vibe-coding-workshop-app`
**Depends on:** the Genie Accelerator track shipped per [`PLAN.md`](./PLAN.md), the optional-Lakehouse toggle in [`genie-accelerator-diagram-and-optional-lakehouse.md`](./genie-accelerator-diagram-and-optional-lakehouse.md) (Part B), and the activation/Gold-Tables cleanup in [`genie-track-activation-and-step-cleanup.md`](./genie-track-activation-and-step-cleanup.md).

---

## 0. Why this spec exists

Four review comments on the Genie Accelerator track, focused on the **Semantic Layer** entry
point and prompt readability:

1. **Daisy-chain the Locate step with the Lakehouse toggle.** The Lakehouse block (Bronze → Gold)
   is now optional and OFF by default. When a learner turns it ON and builds Gold, the first
   Semantic-Layer step ("Locate Data & Bring Context", step 57) should chain off that work: point
   at the Gold tables they just built instead of re-asking them to locate, upload, or synthesize
   data. When Lakehouse is OFF, the three data modes stand as they are today.
2. **Per-mode prompts.** Step 57 shows three tabs (Extract from existing / Upload / Generate
   synthetic), but the copy-paste prompt describes all three methods at once. Each tab should
   surface a prompt scoped to that one method.
3. **Copy-paste ready.** The prompts carry too much lead-in before the fenced block. The fenced
   block is the hero; the framing belongs in the How-to-Apply / Deliverables fields the UI
   already renders as separate tabs.
4. **Readability pass.** Run every Genie Accelerator prompt through the `humanizer` and
   `economist-style` bars, on the **human-facing prose only** (not the machine instructions
   inside the fenced blocks).

### Confirmed decisions (do not re-litigate)

- **Comment 2:** implement as **separate per-mode prompt rows in the seed** (mode-suffixed
  `section_tag`), reusing the existing `bronze_table_metadata_upload` precedent — not client-side
  templating.
- **Comment 4:** rewrite **only the human-facing prose** around the fenced blocks. Do **not**
  edit the agent instructions inside the ``` ``` fences (rewording an instruction can change
  agent behavior). Keep state-machine, PRD-read, gate, and Mermaid mechanics intact.

### Golden rules (carried from PLAN.md)

- The only binding between a UI step and its prompt row is the **`section_tag`** string. Step
  numbers (57–73) are incidental and independent of seed `input_id`.
- Prompts are `bypass_llm = true`: the `input_template` is returned **verbatim** with `{token}`
  substitution, so readability is fully determined by the text you write.
- Do **not** edit, reorder, or reformat existing unrelated seed rows. Append new rows; edit only
  the Genie Accelerator rows named here.
- Do **not** run `databricks bundle init`. Reseed only through the app's own scripts.
- Prompt-content changes require a **reseed + redeploy**. **STOP and ask** before deploying to
  any real workspace.
- Keep the lockfile policy and the existing lint baseline intact (no new lint errors).

---

## 1. Current state (as investigated 2026-09-14)

### 1.1 Prompt resolution (backend)

- `src/backend/api/routes.py:171-187` caches rows keyed by **`(section_tag, coding_assistant)`**:
  `SELECT DISTINCT ON (section_tag, coding_assistant) … ORDER BY … version DESC`.
- Fork resolution (`routes.py:321-341`): a `(section_tag, coding_assistant)` fork row is used
  when present; otherwise the `__default__` row for that `section_tag`. There is **no data-mode
  dimension** in the schema — mode is expressed today by **suffixing the `section_tag`**.
- **Precedent:** `CsvUploadPanel` defaults to `sectionTag = 'bronze_table_metadata_upload'`
  (`src/components/CsvUploadPanel.tsx:100`) and fetches its own prompt via
  `apiClient.generatePrompt(industry, useCase, sectionTag, …)` (`:151`). So a `<tag>_upload`
  row is the established way to give a mode its own prompt.

### 1.2 Step 57 rendering (frontend)

- `includeLakehouse` reaches `WorkflowDiagram` as a prop (`WorkflowDiagram.tsx:130`, default
  `false` `:214`, passed from the parent `:3458`) but is **never referenced** in
  `renderGenieStep` or the `semlayer_locate` branch.
- Data-mode state defaults to `existing` and is UI-only
  (`WorkflowDiagram.tsx:252`): `useState<'existing' | 'upload' | 'synthetic'>('existing')`.
- The `semlayer_locate` branch (`WorkflowDiagram.tsx:1072-1122`):
  - `existing` → `WorkflowStep` + `LakehouseParamsEditor` in the header; fetches prompt for
    `sectionTag = 'semlayer_locate'`.
  - `upload` → `CsvUploadPanel` with `sectionTag={tag}` (i.e. **`semlayer_locate`**, *not*
    `semlayer_locate_upload`) → same prompt as existing.
  - `synthetic` → `WorkflowStep`, same `semlayer_locate` prompt.
  - So all three tabs render the **same** prompt, which enumerates all three methods.
- `GENIE_STEP_META.semlayer_locate` (`WorkflowDiagram.tsx:997`) description also lists all three
  modes.

### 1.3 Seed rows (`db/lakebase/dml_seed/02_seed_section_input_prompts.sql`)

- `semlayer_locate`: default row `input_id 60` (`:16481`) and genie-code fork `932` (`:16976`).
  Both hardcode the source as `{chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema}` and
  the synthetic target as `{lakehouse_default_catalog}.{user_schema_prefix}_gold`, and both
  describe existing + upload + synthetic in one body.
- The 27 Genie Accelerator rows (17 default + 10 genie-code forks) span `section_tag`s
  `semlayer_*`, `gagent_*`, `ontology_*`, `gaccel_*` (`input_id`s 60-76 and 932-942). See
  [`PLAN.md`](./PLAN.md) §1 for the full inventory.

### 1.4 Data-mode ↔ Lakehouse relationship

- When Lakehouse is ON, the Genie Lakehouse steps `[22, 11, 14, 23]` build Gold before the
  Semantic Layer (see optional-Lakehouse spec §B.1). The Locate step's `existing` mode already
  points at a catalog/schema via `LakehouseParamsEditor` + the `{chapter_3_lakehouse_*}` tokens,
  so "use the tables you just built" is a **copy + default-selection** change, not new plumbing —
  **provided the token the Locate step reads matches where the Genie Lakehouse block writes Gold**
  (verify during implementation; see §5 open question).

---

## 2. Changes

### Part 1 — Daisy-chain Locate with the Lakehouse toggle (comment 1)

**2.1 Thread `includeLakehouse` into the Locate branch.** In `WorkflowDiagram.tsx`, the prop is
already in scope; consume it in the `semlayer_locate` branch (`:1072`).

**2.2 Default + constrain the mode when Lakehouse is ON.**
- When `includeLakehouse === true`: default `semlayerLocateMode` to `existing` and **hide the
  Upload / Generate (synthetic) tabs** (the learner already has Gold). Keep the `LakehouseParamsEditor`
  so they can confirm/adjust the source, pre-filled to the built Gold location.
- When `includeLakehouse === false` (default): keep all three tabs exactly as today.
- Initialise the default correctly: derive the initial `semlayerLocateMode` from
  `includeLakehouse` rather than the hardcoded `'existing'` literal at `:252`, and re-derive if
  the toggle changes mid-session (guard against a hidden tab staying selected).

**2.3 Prebuilt-aware copy.** When `includeLakehouse === true`, the Locate step fetches a
**prebuilt** prompt variant that says "use the Gold tables you built in the Lakehouse block" and
drops the locate/upload/synthesize framing (see §3, `semlayer_locate` existing/prebuilt row).

### Part 2 — Per-mode prompt rows (comment 2)

**2.4 Mode-suffixed `section_tag`s.** Split the Locate prompt into one row per data mode, following
the `bronze_table_metadata_upload` precedent. The step's identity stays `semlayer_locate`
(`ALL_STEPS[57]`); only the **prompt fetch** varies by mode.

| Mode | Fetch `section_tag` | Notes |
|---|---|---|
| Extract from existing (Lakehouse OFF) | `semlayer_locate` | Existing-only copy |
| Extract from existing (Lakehouse ON) | `semlayer_locate` (prebuilt copy) | Same tag; copy references the built Gold. See §5 Q2 for whether this needs a distinct tag vs. a token-driven line |
| Upload a data dictionary | `semlayer_locate_upload` | New row(s) |
| Generate (synthetic) | `semlayer_locate_synthetic` | New row(s) |

**2.5 UI fetch wiring.** In `WorkflowDiagram.tsx` `semlayer_locate` branch, pass the mode-suffixed
tag to the prompt fetch:
- `upload` → `CsvUploadPanel sectionTag="semlayer_locate_upload"` (replace the current
  `sectionTag={tag}` at `:1090`).
- `synthetic` → render `WorkflowStep` with a `sectionTag`/fetch override of
  `semlayer_locate_synthetic` (the base props currently pass `sectionTag: tag` at `:1058`; add a
  per-mode override so metadata + stream fetch use the suffixed tag).
- `existing` → keep `semlayer_locate` (or the prebuilt variant per §2.3).
- **Completion/gate tracking stays on the step number and the base `semlayer_locate` identity** —
  only the prompt lookup changes. Confirm `onStepPromptGenerated` / `stepPrompts[n]` still key by
  step number, not by the fetched tag.

**2.6 Scope note.** The `semlayer_metric_view` step (60) has the same shape (Path A `/importBI`
vs. Path B author-from-inventory, `WorkflowDiagram.tsx:1125-1168`). This spec covers **Locate
only**; apply the identical per-mode pattern to `semlayer_metric_view` in a follow-up if desired
(recorded in §6).

### Part 3 — Copy-paste-ready prompts (comment 3)

**2.7 Fenced block first.** For every Genie Accelerator row, reduce the text **above** the fenced
copy-paste block to a single lead-in line ("Paste this into a Genie Code Agent chat:"). Move the
multi-paragraph framing into the fields the UI already renders as separate tabs:
- `how_to_apply` → the "How to Apply" tab (steps to run, tab/panel guidance).
- `expected_output` → the "Verify Results" tab (deliverables, gate, sample output).
- `input_template` → the hero prompt: one lead-in line + the fenced block + the minimal
  state/gate/next-step lines that must travel with the paste text.

**2.8 Keep the fence self-contained.** The text inside ``` ``` must remain runnable on its own
(all `{tokens}` intact) so "Copy to Clipboard" yields a complete instruction with no surrounding
prose required.

### Part 4 — Humanizer + Economist pass (comment 4)

**2.9 Scope.** All 27 Genie Accelerator rows (`input_id`s 60-76, 932-942). Rewrite the
**human-facing prose only**: the `input_template` lead-in/framing, `how_to_apply`, and
`expected_output`. **Do not** alter the text inside the fenced agent-instruction blocks beyond
mechanical fixes (straight quotes, stray tokens).

**2.10 Tells to remove** (from the `humanizer` skill), applied to the prose:
- **Em dashes / en dashes** (`—`, `–`) → periods, commas, colons, or parentheses. This is the
  loudest tell and appears throughout; treat it as a hard constraint on the prose.
- Rule-of-three padding, bold inline-header lists, "This will involve the following steps",
  significance/tailing fragments, sycophantic or signposting openers.
- Emoji-numbered headers (`1️⃣`, `2️⃣`, …) → plain sentence-case headings (`economist-style`).
- Curly quotes → straight quotes; trim filler and hedging.

**2.11 Guardrails (keep, do not "humanize" into vagueness).**
- **State-machine lines** (`.vibecoding-state.md`, Per-Step Log, gate results), **PRD-read lines**
  (`Read docs/design_prd.md …`), gate definitions, and **Mermaid** blocks stay. Tidy phrasing and
  em dashes around them, but keep them precise and literal. The goal is clean and readable, not
  cryptic.
- Preserve every `{token}` and file path exactly.

**2.12 Bar (illustrative — Locate, Lakehouse-ON / prebuilt path).** Lead-in shrinks to one line,
no em dashes, one method, pointed at the built Gold:

> Point Genie Code at the Gold tables you built and seed the Genie brief. No building here: it reads
> your data and definitions, then drafts a brief for you to correct.
>
> Paste this into a Genie Code Agent chat:
>
> ```
> Read docs/design_prd.md, docs/genie_brief.md, and .vibecoding-state.md first. Reuse the PRD's
> User Journeys and Data Entities; don't re-ask what they answer.
>
> Use the Gold tables I built in {lakehouse_default_catalog}.{user_schema_prefix}_gold as the
> source. Read them read-only. …
> ```

---

## 3. Seed row plan (`02_seed_section_input_prompts.sql`)

New / edited rows for the Locate step (Parts 1-3). Use the next free `input_id`s; bindings are by
`section_tag`, so the numbers are incidental.

| `section_tag` | `coding_assistant` | Action | Content |
|---|---|---|---|
| `semlayer_locate` | `__default__` (60) | **Edit** | Existing-mode only; prebuilt-aware line when Lakehouse ON; trimmed lead-in |
| `semlayer_locate` | `genie-code` (932) | **Edit** | Same, genie-code fork |
| `semlayer_locate_upload` | `__default__` | **Add** | Upload-only copy (drop existing/synthetic) |
| `semlayer_locate_upload` | `genie-code` | **Add** | Upload-only, genie-code fork |
| `semlayer_locate_synthetic` | `__default__` | **Add** | Synthetic-only copy (Faker into writable target) |
| `semlayer_locate_synthetic` | `genie-code` | **Add** | Synthetic-only, genie-code fork |

- All new rows: `bypass_llm = true`, `is_active = true`, `version = 1`. Match the two INSERT
  header shapes already in the file (default rows include `how_to_apply`/`expected_output`;
  genie-code forks use the shorter column list). Do **not** normalize the headers.
- Part 4 (readability) edits **in place** across all 27 rows; no new rows, no `section_tag`
  changes, no `input_id` changes.

---

## 4. Files touched

| File | Change |
|---|---|
| `src/components/WorkflowDiagram.tsx` | Consume `includeLakehouse` in the `semlayer_locate` branch; derive/constrain `semlayerLocateMode`; per-mode fetch tag (`semlayer_locate_upload` / `_synthetic`); prebuilt copy selection; `GENIE_STEP_META.semlayer_locate` description tidy |
| `db/lakebase/dml_seed/02_seed_section_input_prompts.sql` | Edit `semlayer_locate` (60/932); add `semlayer_locate_upload` + `semlayer_locate_synthetic` (default + genie-code); Part 4 prose rewrite across all 27 Genie rows |
| `src/constants/workflowSections.ts` | (If needed) `ALL_STEPS[57]` / section copy sweep for mode wording |

No backend change: mode-suffixed tags flow through the existing `(section_tag, coding_assistant)`
resolution unchanged.

---

## 5. Verification checklist (fill in the PR)

- [ ] `npm run build` + lint clean (no new errors vs. baseline); backend tests pass.
- [ ] **Lakehouse OFF (default):** Locate shows all three tabs; each tab's copy-paste prompt
      describes **only** that method.
- [ ] **Lakehouse ON:** Locate defaults to the existing/prebuilt path, hides Upload/Synthetic,
      and the prompt references the Gold tables just built (correct catalog/schema token).
- [ ] Upload tab fetches `semlayer_locate_upload`; Synthetic tab fetches
      `semlayer_locate_synthetic`; Existing fetches `semlayer_locate`.
- [ ] Step completion, skip, and gate tracking still key on the step (57) regardless of mode/tag.
- [ ] Every Genie prompt: fenced block is copy-paste-complete with one lead-in line; framing lives
      in How-to-Apply / Verify Results.
- [ ] Readability: no `—`/`–` in the human-facing prose of any Genie row; no emoji-numbered
      headers; straight quotes; state-machine / PRD-read / gate / Mermaid content preserved.
- [ ] Reseeded via the app's scripts; deployed to `fevm-serverless` only after explicit OK.

---

## 6. Open questions / out of scope

1. **Gold token match (highest risk).** Confirm the exact catalog/schema token the Genie Lakehouse
   block (steps 22/11/14/23) writes Gold to, and that the Locate `existing` mode reads the same
   token. If they differ, the prebuilt path needs the correct token, not new plumbing.
2. **Prebuilt: distinct tag vs. token line.** Decide whether the Lakehouse-ON case needs a
   dedicated `section_tag` (e.g. `semlayer_locate_prebuilt`) or can be one conditional line in the
   `semlayer_locate` body driven by a token. Recommend a conditional line first (fewer rows) and
   only split if the copy diverges too much.
3. **`semlayer_metric_view` per-mode.** Apply the same per-mode split to Path A/Path B? Out of
   scope here; follow-up if the single prompt is confusing.
4. **Deploy.** After implementation: reseed + `./scripts/deploy.sh --update` to `fevm-serverless`
   (STOP-and-ask gate applies; prompt-content changes require the reseed).

## 7. Not in scope

- Backend/schema changes to add a first-class "data mode" column (the suffix pattern is sufficient).
- Re-touching the fenced agent instructions beyond mechanical fixes.
- Any non-Genie level's prompts or steps.

---

# Addendum (2026-09-14): Copy-clean prompts (Fix B) + Metric View split (Fix A)

**Status:** In progress · **Trigger:** post-implementation review of the sections above.

## 8. Why this addendum exists

Two problems survived the first pass:

1. **Preamble still ships inside the copy.** Every Genie row's `input_template` still opens with
   reader framing ("Two paths…", "Pick a path…", best-practice notes) *above* the fenced block.
   The "Copy to Clipboard" button copies the **entire** `input_template`
   (`WorkflowStep.tsx` `onCopy` → `promptText`), so that framing lands in the Genie Code chat and
   confuses the agent. The paste should be **only** what the agent runs.
2. **A step still shows two paths in one prompt.** `semlayer_metric_view` describes Path A (Import
   BI) *and* Path B (author from inventory) in a single body, even though the UI already separates
   them with the "Metric View source" tabs. The Locate step was split per-mode; Metric View was
   not.

### The copy pipeline (verified)

- `WorkflowStep.tsx` `onCopy` copies `promptText` verbatim on the Generated-Prompt tab
  (`how_to_apply` / `expected_output` copy only when their tab is active). `promptText` is the
  resolved `input_template`. **So whatever is in `input_template` is what gets pasted.**
- Backend merge (`routes.py` `get_section_input_template`): `input_template` / `system_prompt` /
  `bypass_llm` come from the **fork row** when present, else the Default row. `how_to_apply`,
  `expected_output`, `section_title`, `section_description` **always** come from the **Default
  row**. Implication: framing moved out of the paste must live in the **Default row's**
  `how_to_apply` / `expected_output`, even for a genie-code session.

## 9. Confirmed decisions (do not re-litigate)

- **Fix B — restructure the seed** (not a UI copy-extraction). Each row's `input_template` becomes
  paste-only; framing moves to the Default row's `how_to_apply` / `expected_output`.
- **Fix A — split `semlayer_metric_view`** into two section tags, mirroring the Locate per-mode
  split: `semlayer_metric_view` (Path B, author from inventory) and
  `semlayer_metric_view_importbi` (Path A, Import BI). Each gets a Default + genie-code fork.
- **Multi-paste steps → ONE combined paste.** Where a step ran two sequential pastes (Metric View
  4a review + 4b create; Ontology Pages draft + bulk-import), collapse them into a **single**
  fenced block. For Metric View, the combined block instructs the agent to **show the YAML and wait
  for approval before creating** so the review gate survives inside one paste.

## 10. The restructure contract (Fix B — applied per row)

For every Genie row (`section_tag` + each fork):

- **`input_template` = the paste.** One lead-in line ("Paste this into a Genie Code Agent chat:")
  then a **single** fenced block containing everything the agent needs: the task, data/token
  references, the **state-machine enter/exit + gate-recording directives** (folded *into* the
  fence), and any anti-pattern reminders. Nothing else above or below the fence except the lead-in.
- **Default row `how_to_apply` = reader framing.** What the step does and why, the best-practice
  table, the Mermaid picture, and how to drive the UI/tabs/panels.
- **Default row `expected_output` = deliverables + gate (for the reader) + the sample output.**
- Genie-code fork rows carry **only** the paste (`input_template`) — their shared fields are
  ignored by the backend, which always reads the Default row for framing.
- Preserve every `{token}`, file path, `bypass_llm = true`, `is_active`, and `version`. Do not
  reword the agent instructions inside the fence beyond mechanical fixes.

## 11. Phase 0 audit (2026-09-14)

Method: parse the Genie region (`02_seed_section_input_prompts.sql`, lines ≥ 16471) into INSERT
statements; count fenced **paste** blocks per row (cue phrases undercount — "copy verbatim" and
"Navigate: … then draft" intros were confirmed by manual inspection). 33 Genie rows total (17
default + 16 forks; includes the three Locate per-mode rows added earlier).

**Multi-paste steps (→ combine to one paste):**

| `section_tag` | Rows | Paste blocks today | Combined-paste target |
|---|---|---|---|
| `semlayer_metric_view` | default `63`, fork `933` | 4a review + 4b create | 1 block: review-then-create with an in-paste approval gate |
| `ontology_pages` | default `71`, fork `937` | draft + optional bulk-import | 1 block: draft primary + secondary; bulk-import framing → `how_to_apply` |

**Single-paste steps (Fix B only — fold directives, move framing):** all remaining `semlayer_*`,
`gagent_*`, `ontology_*`, `gaccel_*` rows. `gagent_share` (73), `ontology_domain` (70/936),
`ontology_routing` (72/938) are UI-navigation steps whose "paste" is a short agent instruction; fold
their state/gate lines into the single fence and move the navigation prose to `how_to_apply`.

**Path split note:** `semlayer_metric_view` mixes Path A (Import BI, no pasteable prompt — it is
`/importBI` + a UI "Export to a Unity Catalog metric view" promotion) with Path B (author from
inventory, two pastes). Fix A separates these so each tab fetches only its own prompt.

## 12. Metric View split (Fix A) — seed plan

Bindings are by `section_tag`; `input_id`s are incidental — use the next free ids for new rows.

| `section_tag` | `coding_assistant` | id | Action | Content |
|---|---|---|---|---|
| `semlayer_metric_view` | `__default__` | `63` | **Edit** | Path B only. `input_template` = one combined review-then-create paste. `how_to_apply` = Path B framing (best-practice table, Mermaid, YAML v1.1 reference). `expected_output` = Path B deliverables + MEASURE() sample. Title/description Path-B-specific |
| `semlayer_metric_view` | `genie-code` | `933` | **Edit** | Path B combined paste, Genie-Code flavour (`executeCode`, `WITH METRICS LANGUAGE YAML`). Paste-only |
| `semlayer_metric_view_importbi` | `__default__` | new | **Add** | Path A only. `input_template` = one `/importBI` + promote-to-UC paste. `how_to_apply` = attach-file / `/importBI` / UI-promote framing + `import-bi-to-metric-view.md` reference. `expected_output` = Path A deliverables. Title/description Path-A-specific |
| `semlayer_metric_view_importbi` | `genie-code` | new | **Add** | Path A paste, Genie-Code flavour. Paste-only |

**Combined Path B paste (shape).** One fence that: reads `docs/genie_brief.md` + state; uses only
approved measures; works out tables/joins/grain and **shows the YAML with slice-by dimensions,
explains each grain, flags non-additive, and does not save yet**; then, **after the user confirms**,
`CREATE OR REPLACE … WITH METRICS LANGUAGE YAML` in the writable target (checking state/schema to
replace rather than duplicate), uses business-friendly display names, runs `MEASURE()` to prove each
measure, and records the Metric View name + gate to `.vibecoding-state.md`.

## 13. Metric View split (Fix A) — UI plan

Mirror the Locate `effectiveTag` pattern in the `semlayer_metric_view` branch
(`WorkflowDiagram.tsx:1194`):

- `const effectiveTag = metricViewImportMode === 'importbi' ? 'semlayer_metric_view_importbi' : 'semlayer_metric_view';`
- Path A (`importbi`) → `CsvUploadPanel` with `sectionTag={effectiveTag}` + `key={effectiveTag}`
  (Import BI attaches a `.twb/.pbit`-style file, same upload affordance).
- Path B (`inventory`) → `WorkflowStep` with `sectionTag={effectiveTag}` + `key={effectiveTag}`.
- Completion / skip / gate stay keyed on the step number (`n`); only the fetched tag varies.

## 14. Phasing

- **Phase 0 — Audit** (done, §11).
- **Phase 1 — Metric View split** (this change): seed §12 + UI §13, then build/lint + reseed.
- **Phase 2 — Fix B across remaining single-paste rows:** fold directives into the single fence;
  move framing to Default `how_to_apply` / `expected_output`. Default + fork per tag.
- **Phase 3 — Ontology Pages combined paste** (the second multi-paste step) + any other splits the
  audit surfaces.
- **Phase 4 — Verify:** `npm run build` + lint; grep every genie `input_template` for paste-only
  shape (lead-in + one fence); spot-check clipboard output; reseed `fevm-serverless` + smoke test
  (STOP-and-ask gate before deploy).

## 15. Verification (Metric View split)

- [ ] `npm run build` + lint clean (no new errors vs. baseline).
- [ ] Path B tab fetches `semlayer_metric_view`; Path A tab fetches `semlayer_metric_view_importbi`;
      switching tabs re-fetches (distinct `key`).
- [ ] `semlayer_metric_view` `input_template` (default + fork) = one lead-in line + **one** fenced
      block; no "Two paths" / "Pick a path" preamble; review-then-create with an in-paste approval
      gate.
- [ ] `semlayer_metric_view_importbi` Default carries the Path A `how_to_apply` / `expected_output`;
      fork carries the paste.
- [ ] Completion / skip / gate still key on the step number.
- [ ] Reseeded via the app's scripts; deployed to `fevm-serverless` only after explicit OK.

---

# Addendum (2026-09-19): the review gate is now next-prompt-as-approval

The "review-then-create with an in-paste approval gate" described in §9, §12, and
§15 was refined after a live run. The Metric View paste no longer both waits for
approval **and** self-creates (that contradiction stalled the agent and left the
governed object uncreated). The current contract, authored in the template repo's
`sections/*.md` and documented in
[`genie-accelerator-prompt-standardization.md`](./genie-accelerator-prompt-standardization.md)
§16–§19:

- Step 4a plans and **pauses** on the YAML (review gate kept).
- Step 4b creates on approval — an explicit "approved"/"create it" **or the user
  pasting the next step**, which is itself approval. Once approved, the turn never
  ends with the YAML shown but the view uncreated.
- Each Semantic-Layer step commits the prior step's pending state on entry
  (implicit approval), and resolves conflicts/gaps/unowned measures with concrete
  recommended defaults rather than open questions.

Gate mechanics (`.vibecoding-state.md`, Per-Step Log, gate strings, `{token}`s)
are unchanged; only the *meaning of "pause"* changed (next-prompt = approval,
not block-forever).

The same model was extended to the **Genie-Agent** section (Steps 6–10) — see
[`genie-accelerator-prompt-standardization.md`](./genie-accelerator-prompt-standardization.md)
§20–§23. Steps 7/8/10 carry the implicit-approval + next-prompt-as-approval +
recommend-don't-ask clauses. The **one deliberate exception** is Step 9
(`gagent_benchmarks`): its benchmark-answer verification stays a genuine
**hard stop** — advancing does *not* auto-validate the generated answers, because
a set validated against itself is meaningless. It is softened only by an
agent-side confidence pre-check so the human verifies the low-confidence answers,
not all 15.
