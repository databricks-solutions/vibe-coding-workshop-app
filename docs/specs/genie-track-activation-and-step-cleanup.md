# Genie Accelerator — Activation Reuse, AI/BI Dashboard, Step Cleanup (handoff spec)

**Status:** Ready to execute · **Author:** pairing session (investigation → spec) · **Date:** 2026-09-14
**Target repo:** `vibe-coding-workshop-app`
**Depends on:** the Genie Accelerator track already shipped per [`PLAN.md`](./PLAN.md) and the
diagram/optional-Lakehouse refinements in
[`genie-accelerator-diagram-and-optional-lakehouse.md`](./genie-accelerator-diagram-and-optional-lakehouse.md).

---

## 0. Why this spec exists

Four review comments on the Genie Accelerator track's **Activate & Productionize** and
**Semantic Layer** sections:

1. **Reuse activation.** The genie "Synced Tables → Lakebase → App" step (72) collapses the
   entire reverse-ETL activation into a single LLM prompt, duplicating the mature reverse-ETL
   steps (32–37). Reuse those instead. A dedicated genie step should only be a **thin prep
   wrapper**; the real Synced-Tables → Design → Build → Wire → Deploy steps must show up here.
2. **AI/BI Dashboard.** "Dashboard on the Metric View" (71) should be renamed **AI/BI
   Dashboard** and broadened from a Metric-View-only dashboard to one covering the
   PRD-relevant tables/data — output that can feed the activation (synced tables) step.
3. **Remove "Show Your Agent"** (70) — not needed.
4. **Gold Tables editor** currently renders on every Semantic-Layer step. Reduce it to the
   step where the target is actually set.

### Confirmed decisions (do not re-litigate)
- **Comment 1:** keep a thin **"Plan Activation"** wrapper (step 72), then surface the **full
  32–37** (Synced Tables → Design → Build → Wire → Deploy).
- **Comment 4:** Gold Tables editor on **Locate only** (`semlayer_locate`).

### Golden rules (carried from PLAN.md)
- The only binding between a UI step and its prompt row is the **`sectionTag`** string.
  Step numbers (57–73) are incidental and independent of seed `input_id`.
- Do **not** run `databricks bundle init`. Reseed only through the app's own scripts.
- **STOP and ask** before deploying to any real workspace; note that prompt-content changes
  require a **reseed + redeploy** (unlike the UI-only diagram spec).
- Keep lockfile policy and the existing lint baseline intact (no new lint errors).

---

## 1. Current state (as investigated)

### 1.1 Step / section map
- `ALL_STEPS` genie rows (`src/constants/workflowSections.ts:453–456`):
  - `70 gagent_share` — "Show Your Agent"
  - `71 gaccel_dashboard` — "Dashboard on the Metric View"
  - `72 gaccel_activation` — "Synced Tables → Lakebase → App"
  - `73 gaccel_productionize` — "Productionize as a Bundle"
- `genie-activate` section = steps `[70, 71, 72, 73]` (`workflowSections.ts:568`).
- Reverse-ETL activation steps `32–37` (`workflowSections.ts:407–412`), section `activation`
  = `[32, 33, 34, 35, 36, 37]` (`:580`), gated to `direction === 'reverse'` at the **section**
  level in `getFilteredSections` (`:729`).

### 1.2 Rendering
- All genie steps render via `renderGenieStep` (`WorkflowDiagram.tsx:1040`), driven by
  `GENIE_STEP_META` (`:996–1014`); switch routes 57–73 → `renderGenieStep`
  (`WorkflowDiagram.tsx:3323–3327`).
- Reverse-ETL steps 32–37 have **bespoke** `WorkflowStep` renderers in the switch
  (`WorkflowDiagram.tsx:3139–3320`). The switch keys on **step number**, so these render
  wherever the step number appears in a visible section.
- Gold Tables editor (`goldTargetHeader`, `WorkflowDiagram.tsx:1018–1031`) attaches to **all**
  semantic-layer steps: `customHeaderContent={isSemlayer ? goldTargetHeader : undefined}`
  (`:1175`), plus inline in `semlayer_locate` (`:1117`) and `semlayer_metric_view` (`:1163`).

### 1.3 Seeds (`db/lakebase/dml_seed/02_seed_section_input_prompts.sql`)
- Genie activation family: default rows `73 gagent_share`, `74 gaccel_dashboard`,
  `75 gaccel_activation`, `76 gaccel_productionize`; genie-code forks `940/941/942`.
- Reverse-ETL activation: default rows `141 activation_table_design`, `143 activation_app_design`
  (and siblings); genie-code forks `924/926/…`. The forks use
  `require_prior_gate: {prompt_id: "gold_layer_pipeline", gate: "Gold layer live"}`.

### 1.4 Chaining
- `src/utils/stepPreviousOutputs.ts` mirrors inline `previousOutputs`. `gold_table_target` is
  fed only to steps 26–30 (skills), **not** to genie steps. Genie prompts consume the target
  via placeholders (`lakehouse_default_catalog` + `user_schema_prefix`), so the editor just
  needs to be **set once**.

---

## 2. Changes

### Part 1 — Reuse reverse-ETL activation (comment 1)

**2.1 Section list.** In `workflowSections.ts:568`, change `genie-activate` steps from
`[70, 71, 72, 73]` to:

```
[71, 72, 32, 33, 34, 35, 36, 37, 73]
```

- `71` = AI/BI Dashboard (see Part 2), `72` = thin **Plan Activation** wrapper,
  `32–37` = the reused reverse-ETL steps, `73` = Productionize.
- `70` is dropped (see Part 3).

**2.2 Step 72 becomes a prep wrapper.** Repurpose `gaccel_activation`:
- Retitle to **"Plan Activation"** in `ALL_STEPS[72]` (`:455`) and
  `GENIE_STEP_META.gaccel_activation` (`WorkflowDiagram.tsx:1012`): a short planning beat that
  decides *which* Gold dimension/fact tables to sync (keys, grain, modes) — explicitly noting a
  Metric View is a view and cannot be synced — and hands off into step 32.
- Rewrite seed rows `75` (default) and `941` (genie-code fork) to be planning-only (no
  build/deploy); its `captured` output should list the sync candidates for step 32.

**2.3 Route steps 32–37 for genie.** The switch already renders 32–37; confirm they appear when
the `genie-activate` section lists them. The `activation` **section** guard
(`direction !== 'reverse'`) does not apply here (different section id), so no UI change is needed
beyond the section list.
- **Gate reconciliation (seed work — the main risk):** the genie-code forks 924/926/… require
  the `gold_layer_pipeline` "Gold layer live" gate. In the default Genie path Lakehouse is OFF,
  so re-point step 32's `require_prior_gate` to the Genie upstream gate (the Metric View /
  optimize-loop gate, e.g. `semlayer_metric_view` or `gagent_optimize`), or to the new
  `gaccel_activation` (Plan Activation) gate. Steps 33–37 keep their intra-activation chain
  (`activation_table_design → … → activation_deploy_validate`).
- **Duration:** the `genie-activate` segment now covers 32–37; update
  `pathDurations.ts` `genie-accelerator` segments if the estimate should reflect the fuller
  activation (currently `genie-activate: 30`).

**2.4 Ordering / display numbers.** Steps render in section-list order, so 71 → 72 → 32 → … →
37 → 73 is fine even though the numbers aren't monotonic (numbers are incidental). Verify the
sidebar/`getNextIncompleteStep` ordering uses section order (it does — `flatMap` over sections).

### Part 2 — AI/BI Dashboard (comment 2)

**2.5 Rename** `gaccel_dashboard` (71):
- `ALL_STEPS[71].title` (`:454`) and `GENIE_STEP_META.gaccel_dashboard.title`
  (`WorkflowDiagram.tsx:1011`) → **"AI/BI Dashboard"**.
- Sweep any copy referencing "Dashboard on the Metric View" (`chapterLearning.ts`,
  `pathDescriptions.ts`). The diagram already labels this "AI/BI Dashboard".

**2.6 Broaden scope.** Rewrite seed rows `74` (default) + `940` (genie-code fork): build an
AI/BI dashboard over the **PRD-relevant tables/data** (not just the Metric View), and emit a
**table/data inventory** (`captured`) that the activation step consumes.

**2.7 Chaining.** Feed `prd_document` (stepPrompts[3]) + Metric-View output into step 71, and
pass step 71's inventory forward into step 72 (Plan Activation) → 32. Update both the inline
`previousOutputs` in `WorkflowDiagram.tsx` (genie steps go through `renderGenieStep`, so add
targeted `previousOutputs` there) and mirror in `stepPreviousOutputs.ts`.

### Part 3 — Remove "Show Your Agent" (comment 3)

**2.8** Remove step `70 gagent_share`:
- Delete from `ALL_STEPS` (`:453`), from `genie-activate` section list (`:568`), from
  `GENIE_STEP_META` (`WorkflowDiagram.tsx:1010`), and from the switch case list (`:3326`).
- Sweep `chapterLearning.ts` / `pathDescriptions.ts` for references.
- Seed row `73 gagent_share` becomes orphaned (harmless — binding is by `sectionTag`); leave it
  in place and note it, or remove on the next seed pass.
- Step count for the full Genie path drops by one; no structural impact.

### Part 4 — Gold Tables on Locate only (comment 4)

**2.9** In `WorkflowDiagram.tsx`, stop attaching `goldTargetHeader` to every semantic-layer step:
- Change the generic branch (`:1175`) from `customHeaderContent={isSemlayer ? goldTargetHeader : undefined}`
  to `undefined` (or gate on `tag === 'semlayer_locate'`).
- Keep the editor in the `semlayer_locate` branch (`:1117`).
- **Remove** it from the `semlayer_metric_view` branch (`:1163`) per the "Locate only" decision.
- Shared `goldTableTarget` state persists across steps, so downstream steps still resolve the
  target via placeholders without showing the editor.

---

## 3. Files touched

| File | Change |
|---|---|
| `src/constants/workflowSections.ts` | `genie-activate` step list; drop step 70; rename 71/72; (optional) durations note |
| `src/components/WorkflowDiagram.tsx` | `GENIE_STEP_META` titles/desc for 71/72; remove 70; Gold Tables gating (Locate only); genie `previousOutputs` chaining |
| `src/utils/stepPreviousOutputs.ts` | mirror new 71→72→32 chaining |
| `src/constants/pathDurations.ts` | `genie-accelerator` segments if activation estimate changes |
| `src/constants/chapterLearning.ts`, `pathDescriptions.ts` | copy sweep (dashboard rename, remove "Show Your Agent") |
| `db/lakebase/dml_seed/02_seed_section_input_prompts.sql` | rewrite `gaccel_dashboard` (74/940) + `gaccel_activation`→Plan Activation (75/941); re-point `activation_table_design` genie-code fork `require_prior_gate` (924) |

---

## 4. Verification checklist
- [ ] Genie `genie-activate` section renders: AI/BI Dashboard → Plan Activation → Plan Synced
      Tables (32) → Create Synced Tables (33) → Design (34) → Build (35) → Wire (36) →
      Deploy (37) → Productionize (73).
- [ ] "Show Your Agent" no longer appears anywhere (UI, sidebar, learning copy).
- [ ] Step 71 titled "AI/BI Dashboard"; prompt covers PRD tables and emits a sync inventory.
- [ ] Gold Tables editor shows **only** on "Locate Data & Bring Context"; not on Profile /
      Measures / Draft Metric View / Synonyms.
- [ ] Steps 32–37 chain via their state-lock gates with the re-pointed upstream gate; no
      "complete previous steps first" dead-ends in the default (Lakehouse-off) path.
- [ ] `npm run build` + lint clean (no new errors); seeds reseeded; deployed after explicit OK.

---

## 5. Open questions / risks
- **Gate re-pointing** is the highest-risk item: the reverse-ETL forks assume a Gold pipeline
  gate. Confirm the exact Genie upstream gate to require before step 32 (recommend the
  `gaccel_activation` "Plan Activation" gate so the chain is self-contained).
- Do steps 32–37 need genie-specific copy tweaks (they mention "reverse ETL" framing), or is
  reusing the existing genie-code forks acceptable as-is?
- Should Productionize (73) `require_prior_gate` move from `gaccel_activation` to
  `activation_deploy_validate` (37) now that the real deploy step precedes it?
