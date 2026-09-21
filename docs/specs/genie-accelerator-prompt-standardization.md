# Genie Accelerator — Prompt Standardization ("Tier G")

## Problem

The Genie Accelerator track prompts (Generated Prompt tab) each wrap the real
instruction in a fenced ```` ``` ```` "Copy and paste this prompt to Genie Code:"
block. But the whole `input_template` is already what **Copy to Clipboard** copies
(`WorkflowStep.tsx` `onCopy` copies `promptText` verbatim), and every Genie
Accelerator row is `bypass_llm: true` (the body ships verbatim to the agent). So
the fenced block is redundant framing that also injects literal backticks into the
agent chat.

We want every Genie Accelerator prompt to:

1. Be **clean, readable Markdown** with **no inner copy/paste block**.
2. Be **mixed-use** — reads as training for the learner *and* works as an
   instruction to Genie Code.
3. Follow a **consistent format** with the vibe-coding best practices baked in:
   read the PRD / Genie brief, and **record the gate to `.vibecoding-state.md`**.

## Source of truth (important)

Prompts are authored in the **template repo**, not the app repo:

```
vibe-coding-workshop-template/apps_lakebase/prompts/
  sections/NN-<tag>.md            # default (teaching) rows
  sections/99-<tag>.genie-code.md # genie-code forks
  sync_markdown_to_seed.py        # sections/*.md -> 02_seed_section_input_prompts.sql
  lint_section_prompts.py         # structure + fork skeleton + contract guard
  _templates/{style_guide,section_template,fork_template}.md
  scripts/genie_gate.py           # fork intent-parity gates
```

The app repo's `db/lakebase/dml_seed/02_seed_section_input_prompts.sql` is a
**generated artifact**. Going forward, edit the `sections/*.md` in the template
repo, regenerate, then integrate into the app seed.

## Divergence to reconcile (Phase 0)

The two seeds have drifted:

- Master is **ahead** on `60-semlayer_locate` (extract/upload/**synthetic** modes
  merged into one prompt).
- Master is **behind** on this session's app-only edits: Plan Activation
  (planning-only `gaccel_activation`), broadened AI/BI Dashboard, "Next step"
  pointer fixes, and the removal of *Show Your Agent* / *Productionize* from the
  track (frontend `workflowSections.ts`).
- **App-only rows 943–948** (`semlayer_locate_upload/synthetic/prebuilt` +
  forks) exist **only in the app seed** and are **actively referenced by the
  frontend** (`WorkflowDiagram.tsx:1111-1115`).

Therefore a wholesale master→app seed copy is **unsafe** (it would drop 943–948
and import ~100 unrelated non-genie section diffs). Integration is a **surgical
splice by `input_id`**, and master gains section files for 943–948 so it becomes a
true superset for the genie family.

## The Tier G `## Input Template` format

Unified for default and fork (both are `bypass_llm: true`, delivered verbatim):

```markdown
**What you're doing.** 1–2 sentences: purpose + before/after state.

This will involve the following steps:
- **Verb** — plain-English action
- …

Read `docs/design_prd.md`, `docs/genie_brief.md`, and `.vibecoding-state.md`
first; reuse what they already answer instead of re-asking.   ← READ bookend

<the instruction as flowing Markdown prose + bullets — NOT fenced>

Record the gate result in `.vibecoding-state.md`.             ← RECORD bookend

**State-lock:** … (fork only)
**Gate:** `<gate string>` — …
**➡️ Next step.** …
```

Rules:
- **No fenced code block** in `## Input Template` for the genie family.
- **READ bookend**: always read `.vibecoding-state.md`; read `design_prd.md` /
  `docs/genie_brief.md` where they exist. (Step 1 Locate *creates* the brief, so
  it reads the PRD + state and writes the brief.)
- **RECORD bookend**: every prompt ends its instruction with
  "record the gate result in `.vibecoding-state.md`".
- UI-only chrome ("panel above", context "(+)" button, `{csv_content}`) moves to
  `## How to Apply` (not copied), keeping the copied prompt clean for the agent.
- Preserve every `{token}`, the `**Gate:**` string, and fork State-lock rituals
  (guarded by `genie_gate.py`). None of these files are in
  `contract_baseline.json`, so `--check-contract` does not byte-freeze them.

## Decisions (defaults chosen)

1. **No-fence rule is scoped** to `semlayer_* / gagent_* / ontology_* / gaccel_*`
   — the deploy/lakehouse forks keep their fenced runbooks.
2. **UI chrome → `## How to Apply`**.
3. **Retire** `gagent_share` (73), `gaccel_productionize` (76/942) via
   `is_active: false` (rows remain, dormant).
4. **Enforce** the new rules with a scoped check in `lint_section_prompts.py`.

## Scope — input_ids

| Group | Default | Fork |
|---|---|---|
| Semantic Layer | 60,61,62,63,64 | 932 (locate), 933 (metric_view), 951 (profile), 952 (measures), 953 (synonyms) |
| Locate variants | 943 (upload), 945 (synthetic), 947 (prebuilt) | 944, 946, 948 |
| Genie Agent | 65,66,67,68,69 | 934 (describe), 935 (optimize), 954 (instructions), 955 (verified), 956 (benchmarks) |
| Ontology | 70,71,72 | 936, 937, 938 |
| Activate | 74 (dashboard), 75 (activation) | 940, 941 |
| Retired | 73 (share), 76 (productionize) | 942 (productionize) |

## Execution

- **Phase 0** — import 943–948 into master; retire 73/76/942; port product
  decisions (74/75/pointers). (74/75 porting folds into the Phase 2 rewrite.)
- **Phase 1** — document Tier G in `_templates/*`; add scoped genie-family lint.
- **Phase 2** — rewrite all genie section files to Tier G (Batch A: semantic
  layer + variants; Batch B: agent/ontology/activate). Checkpoint sync+lint after
  Batch A.
- **Phase 3** — `sync_markdown_to_seed.py` → `lint --strict` → `genie_gate.py`;
  splice genie `input_id` blocks master→app; `reseed + redeploy` to
  `fevm-serverless`.

## Verify

```bash
cd apps_lakebase/prompts
python sync_markdown_to_seed.py && python sync_markdown_to_seed.py --dry-run  # No differences
python lint_section_prompts.py --check-contract --strict sections/
python ../../scripts/genie_gate.py --touched apps_lakebase
```

Then in the app repo: reseed (`deploy.sh --tables-only`) + redeploy
(`deploy.sh --code-only`) on `fevm-serverless`, and confirm the Locate
Upload/Synthetic/Prebuilt tabs and all track steps render fence-free.

---

# Addendum (2026-09-19): Recommend-and-proceed + implicit approval (Semantic Layer)

**Status:** Implemented · **Trigger:** review of a Genie Code Semantic-Layer run
where the track (a) never explicitly created the Metric View and (b) punted too
many decisions back to the user instead of recommending a way forward.

## 16. Why this addendum exists

Two behaviors surfaced in a live run:

1. **A contradictory build step.** The Metric View step (`semlayer_metric_view`,
   default `63` / fork `933`) told the agent both "Wait for me to approve the
   YAML" **and** "if you describe the Metric View without creating it, create it
   now". The agent stalled — it could not honor both — so the governed object was
   never created.
2. **Open-ended gates.** Every conflict, unowned measure, and data-supportability
   gap was returned to the user as an open question, with no default the run could
   proceed on. The track felt like an interrogation rather than a recommendation.

## 17. The behavior contract (three shared clauses)

Every Semantic-Layer step now encodes the same three clauses, in Tier G prose
(inside the paste for forks; portable prose for the default rows):

- **Implicit approval of the prior step.** Running a step commits whatever the
  previous step left pending in `.vibecoding-state.md` before doing its own work.
  Pasting the next prompt **is** the approval — the run never blocks forever on a
  gate. (`semlayer_measures` commits the profile's supportability verdicts;
  `semlayer_metric_view` commits the signed-off inventory; `semlayer_synonyms`
  commits a planned-but-uncreated Metric View; `gagent_describe` commits a
  shown-but-unapplied synonym diff.)
- **Review gate kept.** Build steps still **show** the YAML / synonym diff /
  inventory and pause. "Pause" now means *next-prompt = approval*, not
  *block-forever*. The `63`/`933` contradiction is removed: Step 4a plans and
  pauses; Step 4b creates on approval (explicit **or** the next paste) and never
  ends a turn with the YAML shown but the view uncreated.
- **Recommend, don't ask.** Every conflict/gap/unsupported item carries a concrete
  default marked `(recommended — building on this unless you correct me)`. Owners
  with no named person default to the responsible PRD role marked
  `(assumed owner — correct me)` — an unconfirmed owner never blocks the Metric
  View. Low data supportability triggers a proactive synthetic-augmentation or
  rescope recommendation instead of a stop.

## 18. New genie-code forks (parity)

The Semantic-Layer track is hard-locked to `genie-code` today (it may expand to
other assistants later), so the portable behavior lives in the **default** rows
(`61`/`62`/`64`) and the `genie-code`-specific rituals (`executeCode`,
State-lock, explicit Gate/Next-step scaffolding) live in dedicated forks. Three
forks were added so profile / measures / synonyms match the shape the other
Semantic-Layer steps already had:

| `section_tag` | `coding_assistant` | `input_id` |
|---|---|---|
| `semlayer_profile` | `genie-code` | 951 |
| `semlayer_measures` | `genie-code` | 952 |
| `semlayer_synonyms` | `genie-code` | 953 |

`input_id`s 951–953 were confirmed free in both seeds and hand-registered once
(the sync/splice scripts only *replace* existing blocks); thereafter
`sync_markdown_to_seed.py` and `splice_genie_to_app_seed.py` manage them like any
other genie block.

## 19. Files touched (this change)

Source of truth = the template repo `sections/*.md`:

- `sections/62-semlayer_measures.md`, `sections/64-semlayer_synonyms.md` — default
  rows rewritten to the recommend-and-proceed model (Input Template + aligned How
  to Apply / Expected Output / Mermaid).
- `sections/99-semlayer_metric_view.genie-code.md` (933) — the 4a/4b contradiction
  removed; plan-review gate + next-prompt-as-approval creation.
- `sections/99-gagent_describe.genie-code.md` (934) — implicit-approval clause so
  the Step 5 synonym diff commits when the user advances to Step 6.
- `sections/99-semlayer_profile.genie-code.md` (951),
  `sections/99-semlayer_measures.genie-code.md` (952),
  `sections/99-semlayer_synonyms.genie-code.md` (953) — new forks.

Then `sync_markdown_to_seed.py` (master seed) + `splice_genie_to_app_seed.py`
(app seed) regenerate `02_seed_section_input_prompts.sql` in both repos.

---

# Addendum (2026-09-19b): Genie-Agent section — contract fix, MV+detail, native optimize, recommend-and-proceed

**Status:** Implemented · **Trigger:** review of the Genie-Agent half of the
track (Steps 6–10: `gagent_describe` 65/934, `gagent_instructions` 66,
`gagent_verified` 67, `gagent_benchmarks` 68, `gagent_optimize` 69/935) in a live
Genie Code run.

## 20. Why this addendum exists

Four behaviors surfaced in the run:

1. **Contract mismatch (highest-value fix).** The describe step and its gate
   asserted the Metric View must sit under `data_sources.metric_views` "not as a
   bare table". The live workspace stored the attached MV under
   `data_sources.tables`, so a *correct* run would have failed the gate as
   written.
2. **MV-only data source.** The space attached only the governed Metric View, so
   row-level/detail questions (show / list / export individual records,
   descriptions, free text) had no source — the MV aggregates those columns away.
3. **Optimize bypassed the native loop.** The optimize fork ran `ask_genie`
   (Conversation API) instead of the page-locked native scorer, so it never used
   Genie Code's `runBenchmarks`/`getBenchmarkResults` + `benchmark-failure-analysis`
   skill and native fixers.
4. **Same open-ended gates** as the Semantic-Layer half (decisions punted back
   instead of a recommended default).

## 21. The behavior contract (Genie-Agent additions)

- **Contract-true, not slot-rigid.** The describe/instructions steps and their
  gates assert the governed MV is *attached and resolves* — validated with
  `_assert_sql_arrays`, sorted with `sort_genie_config`, and GET-confirmed
  (`?include_serialized_space=true`) — accepting the MV under **either**
  `data_sources.tables` **or** `data_sources.metric_views`. No hardcoded slot.
- **MV + one-grain-below detail + routing.** Step 6 attaches the governed MV
  (measures) **and** the base detail table(s) one grain below it (row detail),
  with `column_configs` (`enable_entity_matching` / `build_value_dictionary`) on
  the detail lookup columns — not the whole raw schema. Step 7's instruction
  block carries a **routing rule**: metrics/counts/breakdowns → MV via `MEASURE()`;
  row-level detail → the detail table; never re-derive a governed metric off the
  detail table. Step 9 benchmarks include ≥1 metric and ≥1 detail question so
  Step 10 proves the routing.
- **Native optimize loop.** Step 10 (fork 935) prefers the page-locked native
  tools (`runBenchmarks`/`getBenchmarkResults`, `readInstructions`,
  `readTableConfig`, `addInstructionsToSpace`, `addKnowledgeSnippetsToSpace`,
  `updateColumnSynonyms`, `configureEntityMatching`) and the
  `benchmark-failure-analysis` skill, with a Genie-Space-page precondition, a 6th
  fix mode (`configureEntityMatching` for value/entity resolution), a 2–3
  iteration loop, and `ask_genie` only as the fallback.
- **Recommend-and-proceed + implicit approval** (same three clauses as the
  Semantic Layer) on Steps 7/8/10 — **with a deliberate exception:** Step 9's
  benchmark-answer verification stays a genuine **hard stop** (a self-validated
  set is meaningless), softened only by an agent-side **confidence pre-check** so
  the human verifies the low-confidence answers, not all 15. The prior
  "15 vs 10–15" inconsistency is standardized on **15**, and the stray
  "≥1 real question answered correctly" deliverable was dropped.

## 22. New genie-code forks (parity)

The Genie-Agent track is hard-locked to `genie-code` today (may expand later), so
portable behavior lives on the **default** rows (`66`/`67`/`68`) and the
`genie-code` rituals (State-lock, explicit Gate/Next-step, native tool names) live
in dedicated forks. Three forks were added so instructions / verified / benchmarks
match the shape describe (934) / optimize (935) already had:

| `section_tag` | `coding_assistant` | `input_id` |
|---|---|---|
| `gagent_instructions` | `genie-code` | 954 |
| `gagent_verified` | `genie-code` | 955 |
| `gagent_benchmarks` | `genie-code` | 956 |

`input_id`s 954–956 were confirmed free in both seeds and hand-registered once via
the seed's own `build_insert_block` (so the blocks are byte-identical to generator
output); thereafter `sync_markdown_to_seed.py` and `splice_genie_to_app_seed.py`
manage them like any other genie block. App-only rows 949/950
(`semlayer_metric_view_importbi`) remain untouched by the splice.

## 23. Files touched (this change)

Source of truth = the template repo `sections/*.md`:

- `sections/65-gagent_describe.md` (65) — contract reconciliation (slot-agnostic,
  validate + GET-confirm) + MV-plus-one-grain-below-detail attachment + entity
  matching on lookup columns + prior-step implicit approval; sample `data_sources`
  JSON now shows both `metric_views` and `tables` with a slot-agnostic note.
- `sections/66-gagent_instructions.md` (66) — one consolidated `text_instructions`
  entry + `MEASURE()`-vs-detail routing rule + explicit scope boundary + implicit
  approval / next-prompt = approval / recommend-don't-ask.
- `sections/67-gagent_verified.md` (67) — implicit approval, recommend-don't-ask,
  real-entity substitution when the brief's example is absent, relative-time
  anchored to the latest data date, next-prompt = approval.
- `sections/68-gagent_benchmarks.md` (68) — **kept** hard stop + confidence
  pre-check; ≥1 metric and ≥1 detail question; standardized on 15; dropped the
  stray deliverable.
- `sections/69-gagent_optimize.md` (69) — native-first scorer loop, 6 fix modes
  (incl. entity matching), 2–3 iterations, append-only curation.
- `sections/99-gagent_describe.genie-code.md` (934) — same reconciliation +
  MV+detail inside the paste; keeps the `createAsset`/`PATCH` mechanics and the
  `data-rooms` anti-pattern warning.
- `sections/99-gagent_optimize.genie-code.md` (935) — native page tools + page
  precondition + `benchmark-failure-analysis` skill + `configureEntityMatching` as
  the 6th mode + 2–3 iterations + `ask_genie` fallback.
- `sections/99-gagent_instructions.genie-code.md` (954),
  `sections/99-gagent_verified.genie-code.md` (955),
  `sections/99-gagent_benchmarks.genie-code.md` (956) — new forks.

Then `sync_markdown_to_seed.py` (master seed) + `splice_genie_to_app_seed.py`
(app seed) regenerate `02_seed_section_input_prompts.sql` in both repos (both
re-run clean: "No differences" / "already in sync").
