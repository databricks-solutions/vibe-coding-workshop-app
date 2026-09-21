# Genie Accelerator Track — App Adoption Plan (handoff to `vibe-coding-workshop-app`)

**Status:** Ready to execute · **Author:** template-repo agent · **Date:** 2026-09-14
**Target repo:** `vibe-coding-workshop-app` (the deployable Databricks App)
**Companion artifact:** [`seed-blocks.sql`](./seed-blocks.sql) — the exact 27 seed rows, ready to append.

---

## 0. Read this first (context for the executing agent)

You are adopting a new **Genie Accelerator** workshop track into the app. The prompt
content (27 rows) is already authored and is delivered to you in
[`seed-blocks.sql`](./seed-blocks.sql). Your job is to (1) load those rows into the
seed, (2) register the 17 user-facing steps in the UI navigation, (3) scope them to the
existing `genie-accelerator` workshop level, (4) update the architecture diagram + level
metadata, (5) optionally render the in-prompt Mermaid diagrams, and (6) reseed + deploy.

**Golden rules**
- The **only** binding between a UI step and its prompt row is the **`sectionTag`**
  string. Step `number` (in `ALL_STEPS`) and seed `input_id` are **independent
  namespaces** — do not try to make them equal. (They numerically overlap in the 60–73
  range; that is expected and harmless.)
- Do **not** edit, reorder, or reformat any existing seed rows. Append only.
- Do **not** run `databricks bundle init`. Reseed through the app's own scripts.
- Every new seed row is `bypass_llm = true` → the `input_template` is returned
  **verbatim** at runtime with `{token}` substitution; **no FM-API call** is made. So
  "does the prompt read well" is fully determined by the text you are appending.

**Grounding facts already verified against the app repo (2026-09-14):**

| Fact | Value |
|---|---|
| Deployable seed | `db/lakebase/dml_seed/02_seed_section_input_prompts.sql` (16,465 lines; **none** of these tags present yet) |
| Table | `${catalog}.${schema}.section_input_prompts` (`${catalog}`/`${schema}` substituted at deploy) |
| UI nav config | `src/constants/workflowSections.ts` (957 lines) |
| Step-number ceiling today | **56** → new steps use **57–73** |
| Level already exists | `genie-accelerator` in `CHAPTER_VISIBILITY` + `ARCH_VISIBILITY` (both `ch3`+`ch4`) |
| Legacy genie mapping | `getVisibleSections` currently filters `data-intelligence` to steps `[15,17,24,25]` for `isGenie` — you will replace this |
| Forks | Resolved at runtime from seed `coding_assistant='genie-code'`; `src/constants/codingAssistantForks.ts` is machinery only → **no TS edit for forks** |
| Renderer | `src/components/MarkdownContent.tsx` uses `react-markdown` + `remark-gfm` → **GFM tables + `##`/`###` headings already render**; the `code` component (≈line 44) renders every fence as plain code → **Mermaid does not render** without a handler |
| Arch diagram | `src/components/ArchitectureDiagram.tsx` (1,890 lines); per-chapter objective-bullet sets; specialized sets for reverse + agents-accelerator; `isGenie` hook already present (≈lines 739, 864) |
| Runtime tokens used | `{use_case_title}`, `{user_schema_prefix}`, `{lakehouse_default_catalog}`, `{chapter_3_lakehouse_catalog}`, `{chapter_3_lakehouse_schema}`, `{dp_bundle_root}` — **all already resolve** in the app (used by existing rows). `{id}`, `{o}`, `{host}` appear only inside illustrative sample-output blocks and are meant to render literally. |

---

## 1. The 27 rows you are adding (inventory)

`seed-blocks.sql` contains these, in file order. **Flow #** is the learner-facing order;
**Step #** is the `ALL_STEPS` key you will assign in Phase 2.

| Flow # | Step # | `input_id` | `section_tag` | Title | UI Section | genie-code fork |
|:--:|:--:|:--:|---|---|---|:--:|
| 1  | 57 | 60 | `semlayer_locate`       | Locate Data & Bring Context      | Semantic Layer | ✅ 932 |
| 2  | 58 | 61 | `semlayer_profile`      | Profile Your Schema              | Semantic Layer | — |
| 3  | 59 | 62 | `semlayer_measures`     | Measures Analysis (sign-off gate)| Semantic Layer | — |
| 4  | 60 | 63 | `semlayer_metric_view`  | Draft the Metric View            | Semantic Layer | ✅ 933 |
| 5  | 61 | 64 | `semlayer_synonyms`     | Review & Expand Synonyms         | Semantic Layer | — |
| 6  | 62 | 65 | `gagent_describe`       | Describe the Agent               | Genie Agent    | ✅ 934 |
| 7  | 63 | 66 | `gagent_instructions`   | Author Instructions              | Genie Agent    | — |
| 8  | 64 | 67 | `gagent_verified`       | Add Verified Queries             | Genie Agent    | — |
| 9  | 65 | 68 | `gagent_benchmarks`     | Load Benchmarks                  | Genie Agent    | — |
| 10 | 66 | 69 | `gagent_optimize`       | Optimize Loop                    | Genie Agent    | ✅ 935 |
| 11 | 67 | 70 | `ontology_domain`       | Model the Domain + Subdomains    | Genie Ontology | ✅ 936 |
| 12 | 68 | 71 | `ontology_pages`        | Author Pages                     | Genie Ontology | ✅ 937 |
| 13 | 69 | 72 | `ontology_routing`      | Write the Routing Page           | Genie Ontology | ✅ 938 |
| 14 | 70 | 73 | `gagent_share`          | Show Your Agent (proof beat)     | Activate       | — |
| 15 | 71 | 74 | `gaccel_dashboard`      | Dashboard on the Metric View     | Activate       | ✅ 940 |
| 16 | 72 | 75 | `gaccel_activation`     | Synced Tables → Lakebase → App   | Activate       | ✅ 941 |
| 17 | 73 | 76 | `gaccel_productionize`  | Productionize as a Bundle        | Activate       | ✅ 942 |

> **Note on `gagent_share`:** its authored comment tags it "Genie Agent", but its flow
> position is 14 (after Ontology). Display it as the **opening proof beat of the
> Activate section**. This is a deliberate, resolved decision.

Two INSERT header shapes appear in `seed-blocks.sql` — do not "normalize" them:
- **Default rows (60–76):** `(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)`
- **Fork rows (932–942):** `(input_id, section_tag, coding_assistant, input_template, system_prompt, bypass_llm, version, is_active, inserted_at, updated_at, created_by)`

---

## 2. Execution phases

### Phase 0 — Branch + preflight
1. Confirm the base branch with the human (recommended: `main`; the repo is currently on
   `fix/bundle-direct-deploy-engine`, an in-flight branch — do **not** assume it).
2. `git checkout -b feat/genie-accelerator-track <base>`
3. `npm ci` and confirm a clean `npm run build` on the untouched branch (baseline).
4. Capture a "before" screenshot of the **Genie Accelerator** path in the running app for
   later comparison (it currently shows Lakehouse + the legacy AI/BI steps 15/17/24/25).

### Phase 1 — Seed the 27 rows (content)
1. Open `db/lakebase/dml_seed/02_seed_section_input_prompts.sql`. Confirm it ends with the
   `-- END OF SEED FORK EXAMPLES` banner (it does today).
2. Append the **entire body** of [`seed-blocks.sql`](./seed-blocks.sql) (everything below
   its header comment) to the end of that file.
3. Verify: the file now contains 27 new `VALUES (` openings for `input_id`s
   `60–76, 932–938, 940–942`, and no `input_id` is duplicated elsewhere:
   ```bash
   grep -nE "^\((60|61|62|63|64|65|66|67|68|69|70|71|72|73|74|75|76|93[2-8]|94[0-2]), '" \
     db/lakebase/dml_seed/02_seed_section_input_prompts.sql | wc -l   # expect 27
   ```
4. **Uniqueness contract:** `input_id` is a PK and `(section_tag, coding_assistant, version)`
   must be unique. If any of these `input_id`s already exist (fresh checkout: they won't),
   delete the prior rows first rather than duplicating.

### Phase 2 — Register the 17 steps in the UI nav (`src/constants/workflowSections.ts`)

**2a. Add the 17 `ALL_STEPS` entries.** Insert into the `ALL_STEPS` map (after step `56`).
Every icon below is already imported at the top of the file; verify before saving.

```ts
// --- Genie Accelerator track (steps 57-73). Bound to seed rows by sectionTag ONLY. ---
57: { number: 57, title: 'Locate Data & Bring Context', icon: Search,            color: 'text-cyan-400',    sectionTag: 'semlayer_locate' },
58: { number: 58, title: 'Profile Your Schema',         icon: Table2,            color: 'text-cyan-400',    sectionTag: 'semlayer_profile' },
59: { number: 59, title: 'Measures Analysis',           icon: BarChart3,         color: 'text-cyan-400',    sectionTag: 'semlayer_measures' },
60: { number: 60, title: 'Draft the Metric View',       icon: FileCode,          color: 'text-cyan-400',    sectionTag: 'semlayer_metric_view' },
61: { number: 61, title: 'Review & Expand Synonyms',    icon: Tag,               color: 'text-cyan-400',    sectionTag: 'semlayer_synonyms' },
62: { number: 62, title: 'Describe the Agent',          icon: MessageSquareText, color: 'text-sky-400',     sectionTag: 'gagent_describe' },
63: { number: 63, title: 'Author Instructions',         icon: FileText,          color: 'text-sky-400',     sectionTag: 'gagent_instructions' },
64: { number: 64, title: 'Add Verified Queries',        icon: ShieldCheck,       color: 'text-sky-400',     sectionTag: 'gagent_verified' },
65: { number: 65, title: 'Load Benchmarks',             icon: Target,            color: 'text-sky-400',     sectionTag: 'gagent_benchmarks' },
66: { number: 66, title: 'Optimize Loop',               icon: RefreshCw,         color: 'text-sky-400',     sectionTag: 'gagent_optimize' },
67: { number: 67, title: 'Model the Domain + Subdomains',icon: Globe,            color: 'text-teal-400',    sectionTag: 'ontology_domain' },
68: { number: 68, title: 'Author Pages',                icon: BookOpen,          color: 'text-teal-400',    sectionTag: 'ontology_pages' },
69: { number: 69, title: 'Write the Routing Page',      icon: GitBranch,         color: 'text-teal-400',    sectionTag: 'ontology_routing' },
70: { number: 70, title: 'Show Your Agent',             icon: Sparkles,          color: 'text-emerald-400', sectionTag: 'gagent_share' },
71: { number: 71, title: 'Dashboard on the Metric View',icon: LayoutDashboard,   color: 'text-emerald-400', sectionTag: 'gaccel_dashboard' },
72: { number: 72, title: 'Synced Tables → Lakebase → App',icon: Link2,           color: 'text-emerald-400', sectionTag: 'gaccel_activation' },
73: { number: 73, title: 'Productionize as a Bundle',   icon: Rocket,            color: 'text-emerald-400', sectionTag: 'gaccel_productionize' },
```

**2b. Add 4 `WorkflowSection`s** to the `WORKFLOW_SECTIONS` array, immediately **after** the
`data-intelligence` section object. Keep all four under `chapter: 'AI and Agents'` so they
inherit the existing `ch4` visibility for `genie-accelerator` (avoids touching the
chapter→ch mapping). Icons/colors below are already imported.

```ts
{
  id: 'semantic-layer',
  chapter: 'AI and Agents',
  title: 'Semantic Layer',
  focus: 'Locate data, analyze measures, and build a governed Metric View',
  description: 'Point Genie Code at your data (existing, uploaded, or synthetic), profile the schema, analyze the measures and reconcile definitional conflicts, then author a governed Metric View with synonyms.',
  icon: FileCode,
  color: 'text-cyan-400',
  bgColor: 'bg-cyan-500/15',
  borderColor: 'border-cyan-500/30',
  steps: [57, 58, 59, 60, 61].map(n => ALL_STEPS[n]),
},
{
  id: 'genie-agent',
  chapter: 'AI and Agents',
  title: 'Genie Agent',
  focus: 'Stand up a Genie Agent on the Metric View and tune it with benchmarks',
  description: 'Create a Genie space bound to the Metric View, add lean instructions and verified queries, load benchmarks with expected SQL, then run the GC-native optimize loop until it clears the target pass rate.',
  icon: MessageSquareText,
  color: 'text-sky-400',
  bgColor: 'bg-sky-500/15',
  borderColor: 'border-sky-500/30',
  steps: [62, 63, 64, 65, 66].map(n => ALL_STEPS[n]),
},
{
  id: 'genie-ontology',
  chapter: 'AI and Agents',
  title: 'Genie Ontology',
  focus: 'Model the Discover domain, pages, and routing (Genie One)',
  description: 'Model the domain and subdomains (UI-preferred), author Pages, and write the routing page so Genie One routes questions to the right space. Beta features — mostly UI-driven with Genie Code drafting content.',
  icon: Globe,
  color: 'text-teal-400',
  bgColor: 'bg-teal-500/15',
  borderColor: 'border-teal-500/30',
  steps: [67, 68, 69].map(n => ALL_STEPS[n]),
},
{
  id: 'genie-activate',
  chapter: 'AI and Agents',
  title: 'Activate & Productionize',
  focus: 'Prove the agent, add a dashboard, sync to Lakebase, and bundle it',
  description: 'Show the working agent, build an AI/BI dashboard on the Metric View, sync the Gold dimensions + facts into Lakebase to power an app, and optionally package the whole track as a Databricks Asset Bundle.',
  icon: Rocket,
  color: 'text-emerald-400',
  bgColor: 'bg-emerald-500/15',
  borderColor: 'border-emerald-500/30',
  steps: [70, 71, 72, 73].map(n => ALL_STEPS[n]),
},
```

**2c. Scope the new sections to the `genie-accelerator` level** inside the
`getVisibleSections` function (the `.map(section => { ... })` that already contains the
`if (section.id === 'data-intelligence' && isGenie)` block). Add this near the **top** of
that map callback, and **replace** the existing legacy-genie `data-intelligence` block:

```ts
const GENIE_TRACK_SECTION_IDS = new Set([
  'semantic-layer', 'genie-agent', 'genie-ontology', 'genie-activate',
]);

// The Genie Accelerator track only exists for the genie-accelerator level.
if (GENIE_TRACK_SECTION_IDS.has(section.id) && !isGenie) {
  return { ...section, steps: [] };
}

// For genie-accelerator, the new track REPLACES the legacy AI/BI beats.
if (section.id === 'data-intelligence' && isGenie) {
  return { ...section, steps: [] };   // was: filter to [15,17,24,25]
}
```

> Everything else in the map falls through to `return section`, so the four new sections
> render for `genie-accelerator` and are stripped (empty `steps` → dropped by the existing
> `filter(section => section.steps.length > 0)`) for every other level.

**2d. Ordering sanity.** The final `WORKFLOW_SECTIONS` order for genie-accelerator becomes:
`define-usecase → lakehouse → (data-intelligence: empty) → semantic-layer → genie-agent →
genie-ontology → genie-activate → iterate-enhance → cleanup`. The existing tail-sort keeps
`iterate-enhance`/`cleanup` last. Confirm no `REVERSE_SECTION_ORDER` entry is needed (this
track is forward-only).

### Phase 3 — Level metadata
1. `src/constants/pathDurations.ts` (≈line 147, `'genie-accelerator'`): add segments for
   the four new sections and recompute `totalMinutes`. Suggested minutes:
   `semantic-layer: 45, genie-agent: 45, genie-ontology: 25, genie-activate: 30`. Keep or
   drop the old `data-intelligence: 125` segment (it now renders empty — remove it to keep
   the total honest). Example:
   ```ts
   'genie-accelerator': { totalMinutes: 260, segments: {
     'define-usecase': 10, 'lakehouse': 90,
     'semantic-layer': 45, 'genie-agent': 45, 'genie-ontology': 25, 'genie-activate': 30,
     'iterate-enhance': 10, 'cleanup': 5 } },
   ```
2. `src/constants/pathDescriptions.ts` (≈line 92, `'genie-accelerator'`): rewrite the blurb
   to describe the new arc (data → Metric View → Genie Agent → Ontology → Dashboard →
   Lakebase → App).
3. `src/components/LevelSelector.tsx`: verify the genie-accelerator card copy/step-count
   still reads correctly with the new sections.

### Phase 4 — Architecture diagram (`src/components/ArchitectureDiagram.tsx`)
Mirror the existing **agents-accelerator** pattern (`AGENTS_RIGHT_OBJECTIVES` /
`AgentsAcceleratorPanel`) to give `genie-accelerator` a dedicated `ch4` objective set. The
`isGenie` boolean already exists (≈line 739) and there is already an `isGenie` branch
(≈line 864).
1. Add a `GENIE_RIGHT_OBJECTIVES` array (chapters `['ch4']`) with bullets:
   *Governed **Metric Views** → **Genie Agent** (instructions, verified queries,
   benchmarks, optimize loop) → **Discover Ontology** (domains, pages, routing) → **AI/BI
   Dashboard** → **Synced Tables → Lakebase** → **App**.*
2. Keep `ch3` as Bronze → Silver → Gold (the data foundation feeding the Metric View).
3. Wire the objective selection: when `isGenie`, use `GENIE_RIGHT_OBJECTIVES` for `ch4`
   (same conditional style already used for `AGENTS_RIGHT_OBJECTIVES`). Confirm the ch4
   module grid (Genie / Dashboard / Agent chips) still renders sensibly, or gate it off for
   genie like agents-accelerator does.

### Phase 5 — Interactive per-step panels (`src/components/WorkflowDiagram.tsx`)
These reuse components already imported in this file (`LakehouseParamsEditor`,
`CsvUploadPanel`, `GoldTableTargetEditor` — see imports ≈lines 66–69, usages ≈1370/1385/1790/2164).
1. **Step `semlayer_locate`** — add a **data-mode toggle** (Existing data / Upload / Synthetic):
   - *Existing* → show `LakehouseParamsEditor` (source = `chapter_3_lakehouse_*`).
   - *Upload* → show `CsvUploadPanel`.
   - *Synthetic* → no picker; the prompt drives Genie Code to generate data.
2. **Step `semlayer_metric_view`** — add an **Import BI tab** (Path B: author from inventory
   [default] · Path A: `/importBI` + promote-to-UC). Path A surface can be a simple upload +
   the verbatim prompt (the promote-to-UC procedure lives in the reference the prompt points
   to).
3. Bind `GoldTableTargetEditor` (write target = `lakehouse_default_catalog` +
   `user_schema_prefix`) to the Semantic Layer steps so learners set the governed-asset
   destination once.
4. Gate all of the above on the step's `sectionTag` (not `number`).

### Phase 6 — Render the in-prompt Mermaid diagrams (`src/components/MarkdownContent.tsx`) — recommended
The teaching blocks contain ` ```mermaid ` fences (the per-step "how it works" diagrams).
Today they render as plain code. To render them:
1. `npm install mermaid --save-exact` (respect the repo's exact-version policy).
2. In the `code` component (≈line 44), branch on `` className === 'language-mermaid' `` and
   render via a small `<Mermaid chart={String(children)} />` wrapper (lazy-init mermaid,
   render to SVG in a `useEffect`). Leave all other fences on the existing styled path.
3. GFM tables and `##`/`###` sub-section headings already render — no change needed.

> If you defer this, the diagrams degrade gracefully to readable Mermaid source; nothing
> breaks. Recommended to do it, since the human explicitly wants the diagrams rendered.

### Phase 7 — Reseed, deploy, verify
1. Reseed Lakebase via the app's own tooling (do **not** hand-run SQL against prod):
   `scripts/lakebase_manager.py` / `scripts/setup-lakebase.sh` (whichever your deploy path
   uses), then `scripts/deploy.sh`.
2. **Smoke test (genie-accelerator level):**
   - All 17 steps appear in flow order across the 4 new sections.
   - Each step's prompt body renders verbatim; `{tokens}` resolve to real values.
   - GFM tables + sub-section headings render; Mermaid renders (if Phase 6 done).
   - Under **Genie Code** assistant, the 10 forked steps show their genie-code variant;
     other assistants fall back to the default.
   - Architecture diagram shows the genie ch4 objective set.
3. **Regression test (every other level):** confirm the 4 new sections are **absent** and
   the legacy `data-intelligence` beats are unchanged (steps 15/16/17/24/25/18/19).
4. `npm run build` clean; `npm run lint` clean.

---

## 3. Verification checklist (paste into the PR description)

- [ ] `seed-blocks.sql` appended; 27 new `input_id`s present, none duplicated.
- [ ] 17 `ALL_STEPS` entries (57–73) added; all icons imported.
- [ ] 4 `WorkflowSection`s added; `getVisibleSections` scoping added; legacy genie
      `data-intelligence` mapping replaced with empty.
- [ ] `pathDurations` + `pathDescriptions` + `LevelSelector` updated for genie-accelerator.
- [ ] Architecture diagram ch4 objective set for genie-accelerator.
- [ ] Step 1 data-mode toggle + Step 4 Import BI tab + write-target editor wired by `sectionTag`.
- [ ] Mermaid renders (or explicitly deferred).
- [ ] Reseeded; genie-accelerator smoke test passes; all other levels unchanged.
- [ ] `npm run build` + `npm run lint` clean.

## 4. Rollback
All changes are additive. To revert: (a) delete the appended block from the seed
(`input_id` 60–76, 932–942), (b) revert `workflowSections.ts` / `pathDurations.ts` /
`pathDescriptions.ts` / `ArchitectureDiagram.tsx` / `WorkflowDiagram.tsx` /
`MarkdownContent.tsx`, (c) reseed. No existing rows are touched, so no data migration is
required.

## 5. Resolved decisions (do not re-litigate)
1. `gagent_share` opens the **Activate** section (flow position 14) — proof beat before the
   dashboard.
2. The Activate tail is **self-contained** (new `genie-activate` section under `AI and
   Agents`), not a reuse of the existing `activation` (Reverse-ETL) section — avoids
   cross-level filter churn.
3. New sections live under `chapter: 'AI and Agents'` (`ch4`) to inherit existing
   genie-accelerator visibility.
4. Step numbers 57–73 are independent of seed `input_id`; binding is `sectionTag`.

## 6. Open items for the human (confirm before merge)
- Base branch for `feat/genie-accelerator-track` (`main` vs `fix/bundle-direct-deploy-engine`).
- Whether to ship Phase 6 (Mermaid) in this PR or a follow-up.
- Final per-section duration minutes (Phase 3 numbers are estimates).
