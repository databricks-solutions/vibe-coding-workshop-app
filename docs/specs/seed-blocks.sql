-- =============================================================================
-- GENIE ACCELERATOR TRACK — SEED BLOCKS (27 rows: 17 defaults + 10 genie-code forks)
-- Source of truth: vibe-coding-workshop-template apps_lakebase/prompts/02_seed_section_input_prompts.sql (lines 16463-18482)
-- Generated: 2026-09-14 for handoff to vibe-coding-workshop-app
-- HOW TO USE: append the entire block below to the END of
--   db/lakebase/dml_seed/02_seed_section_input_prompts.sql in vibe-coding-workshop-app.
-- Idempotency: these input_ids (60-76, 932-938, 940-942) and (section_tag, coding_assistant, version)
--   tuples must be UNIQUE. If re-seeding, delete prior rows for these input_ids first.
-- =============================================================================

-- =============================================================================
-- END OF SEED FORK EXAMPLES
-- =============================================================================

-- =============================================================================
-- GENIE ACCELERATOR — Semantic Layer group (Batch 1, Steps 1-5) — order 60-64
-- Stub rows; authored bodies are synced from sections/6N-semlayer_*.md via
-- sync_markdown_to_seed.py (source of truth = the .md files).
-- =============================================================================

-- Step 1 (Genie Accelerator · Semantic Layer): Locate Data & Bring Context - bypass_llm=TRUE (Type C, verbatim template; Genie Code reasons on the real schema + dropped files)
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(60, 'semlayer_locate',
'Point Genie Code at your data and seed the **Genie brief** — the working document that drives the whole track. This step does **no** building: it confirms where your data lives (or generates synthetic data), reads any definitions you bring, and drafts a first-pass brief for you to correct.

**Pick your data mode above before you copy:**

- **Extract from existing tables** — set your **Source** catalog/schema (`{chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema}`) in the panel above.
- **Upload** — attach a CSV of your data dictionary.
- **Generate (synthetic)** — no usable data yet? Choose this and Genie Code will propose and Faker-generate realistic sample data for **{use_case_title}**.

**Bring context (optional):** if you have existing definitions — an Excel glossary, a CSV, a docs file, or a Tableau/Power BI export — **drop the file into Genie Code** (via the context button) before you run. If you have none, delete the two "dropped definitions" lines below and Genie Code will elicit instead.

Copy and paste this prompt to Genie Code:

```
Read docs/design_prd.md and .vibecoding-state.md first — reuse the PRD''s User Journeys and
High-Level Data Entities; don''t re-ask what they already answer.

My data for {use_case_title} is in {chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema}. (If I
have none, offer to generate realistic sample data for {use_case_title}, tell me the tradeoff, and
only generate it if I say yes.)

I''ve dropped my current definitions into the repo. Read them and pull out every measure name,
definition, and field alias you can — cite which file each came from.

Start docs/genie_brief.md from the PRD + those files: function, candidate measures, and the
questions my users actually ask. If anything the PRD and files don''t cover needs my input, collect
ALL of it into ONE numbered list of questions and ask me in a single batch — do not drip them one at
a time. Pre-fill your best assumption for each and mark it "(assumed — correct me)" so I can just fix
the ones that are wrong. Do NOT profile deeply or build anything yet — show me the seeded brief plus
that one question list, and record the gate result in .vibecoding-state.md.
```',
'',
'Locate Data & Bring Context (Genie Accelerator)',
'Point Genie Code at your data (or generate synthetic), drop in any existing definitions, and seed the Genie brief from the PRD — no building yet',
60,
'> **Artifact root (client-aware).** Resolve `<ARTIFACT_ROOT>` via `vibecoding-state.resolve_root` and write every artifact under it. On Cursor/Copilot that is your repo root; on Databricks Genie Code it is your user project root `/Workspace/Users/<email>/<repo>` (a git clone of the workshop repo) — never the page''s current working directory.

## 1️⃣ How To Apply

1. Choose your **data mode** above — *Extract from existing tables*, *Upload*, or *Generate (synthetic)*. For Extract, set the **Source** catalog/schema in the panel.
2. If you have existing definitions, **drop the file into Genie Code** via the context button. If not, delete the two "dropped definitions" lines from the prompt.
3. Copy the prompt, start a new Agent chat in Genie Code, paste, and press Enter.

**State:** if this is the first step of the track, Genie Code will bootstrap `.vibecoding-state.md`; otherwise it appends this step''s gate.

## 2️⃣ What Are We Building?

Nothing yet — on purpose. This step produces **`docs/genie_brief.md`**: the function, a first list of candidate measures, and the real questions your users ask, seeded from the PRD (and any file you dropped). Everything downstream (measures gate → Metric View → Genie Agent) builds on this brief — so a good brief here saves rework everywhere later.

```mermaid
flowchart LR
  prd["design_prd.md<br/>(journeys · data entities)"] --> brief["docs/genie_brief.md<br/>function · candidate measures · user questions"]
  files["dropped definitions<br/>(Excel · CSV · docs · BI export)"] --> brief
  mode["data mode<br/>extract · upload · synthetic"] --> brief
  brief --> qs["ONE batched question list<br/>(pre-assumed) → your corrections"]
  qs --> gate{{"Gate: brief ready"}}
```

The brief is the **context spine** — the single document Steps 2–14 read back from, so the interview happens once, here, not at every step.

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How it''s used here |
|----------|-------------------|
| **Reuse the PRD as the context spine** | The brief starts from `design_prd.md` User Journeys/Data Entities instead of re-interviewing you |
| **Bring-your-own definitions** | Existing glossaries/BI exports are read and cited, so business language survives into the semantic layer |
| **Synthetic fallback (Faker)** | No data is not a blocker — realistic sample data is generated on request, with the tradeoff stated first |
| **Batched interview** | One numbered, pre-assumed question list instead of a drip of one-at-a-time questions |
| **No premature building** | This step writes a brief only — no profiling, no assets — so the measures gate (Step 3) stays the decision point |

## 4️⃣ What Happens Behind the Scenes?

1. **Read the spine** — Genie Code reads `design_prd.md` + `.vibecoding-state.md` and lifts the User Journeys and Data Entities so it doesn''t re-ask them.
2. **Ingest your context** — it reads any file you dropped in and extracts each measure name, definition, and field alias, citing the source file.
3. **Resolve the data** — it confirms your Source catalog/schema, or (only on your yes) proposes and Faker-generates realistic sample data for `{use_case_title}`.
4. **Draft the brief** — it writes `docs/genie_brief.md` (function, candidate measures, user questions) with best-guess assumptions marked `(assumed — correct me)`.
5. **Batch the gaps** — anything the PRD/files don''t cover becomes ONE numbered question list, then it stops for your corrections.

### Reference: the context spine

`design_prd.md` → `docs/genie_brief.md` → `.vibecoding-state.md`. The PRD carries the *use case*; the brief carries the *semantic intent* (measures, questions, guardrails); the state file carries *progress + gates*. Every later step reads these three back rather than re-eliciting.',
'## Expected Deliverables

- `docs/genie_brief.md` seeded from the PRD (+ any dropped files): function, candidate measures, user questions
- Source `{chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema}` confirmed **or** the synthetic branch chosen (and, after your yes, sample data generated)
- One batched, pre-assumed clarifying-question list presented for your correction
- Gate recorded to `.vibecoding-state.md` — no measures invented beyond what the PRD/files/answers give

**Sample — the shape of a seeded brief (yours will differ):**

```markdown
# Genie Brief — {use_case_title}
Function: order & revenue reporting for the Revenue, Sales-Ops & Finance personas
Candidate measures:
  - Net Revenue        (assumed — correct me)  src: lineitem.l_extendedprice, l_discount
  - Average Order Value (assumed — correct me)  src: lineitem + orders
Questions users ask: "revenue by region last quarter", "top customers YTD", "return rate"
Open questions (batched):
  1. Is "revenue" gross or net of discount?  (assumed: net — correct me)
  2. Which date drives time filters — order date or ship date?  (assumed: order date)
```',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 2 (Genie Accelerator · Semantic Layer): Profile Your Schema - bypass_llm=TRUE (Type B, verbatim template; read-only discovery)
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(61, 'semlayer_profile',
'Have Genie Code **profile the source schema** so the measure inventory (next step) is grounded in what the data can actually support. This is read-only — no assets are created.

Copy and paste this prompt to Genie Code:

```
Read docs/design_prd.md, docs/genie_brief.md and .vibecoding-state.md first.

{chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema} holds the tables behind our
{use_case_title} reporting.

Review this schema and report back on:
- What each table contains and its grain
- How the tables join, and any primary or foreign key candidates
- Which columns carry business meaning that is not obvious from the column name
- Which of the candidate measures in the brief the schema can support today

Produce an ERD. Do not create anything yet. Report your findings so I can review them, note any
measure the schema cannot support yet, and record the gate result (ERD produced + per-measure
supportability) in .vibecoding-state.md.
```',
'',
'Profile Your Schema (Genie Accelerator)',
'Have Genie Code profile the source schema — grain, joins, PK/FK candidates, hidden business columns, and which candidate measures the data can support — and produce an ERD',
61,
'> **Artifact root (client-aware).** Resolve `<ARTIFACT_ROOT>` via `vibecoding-state.resolve_root` and write every artifact under it.

## 1️⃣ How To Apply

Copy the prompt, paste it into a Genie Code Agent chat, and press Enter. Profiling is read-only and runs from any workspace surface — no navigation needed. Leans on Genie Code''s native schema tools (`readTable` / `tableSearch`) and the `databricks-data-discovery` skill.

## 2️⃣ What Are We Building?

A **profile + ERD** of the source schema, plus a per-measure "can/can''t support today" verdict written into the brief. This is the reality check before you commit to a measure inventory — it grounds Step 3 in what the data can actually deliver.

```mermaid
flowchart LR
  src["source schema<br/>{chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema}"] --> prof["profile (read-only)<br/>grain · joins · PK/FK · hidden meaning"]
  prof --> erd["ERD"]
  prof --> supp["per-measure verdict<br/>can / can''t support today"]
  erd --> gate{{"review · no assets created"}}
  supp --> gate
```

Read-only by design: nothing is created, so you can review the shape of the data before any measure is defined.

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How it''s used here |
|----------|-------------------|
| **Profile before you model** | Grain, joins, and PK/FK candidates are established before any measure is defined |
| **Surface hidden meaning** | "Surprising column" callouts capture business meaning not obvious from names (e.g. a returns flag, a status code) |
| **Supportability gate** | Each candidate measure is marked supportable-or-not so the inventory doesn''t promise what the data can''t deliver |
| **Grain is everything** | Establishing fact vs dimension grain here prevents the double-count and averaging traps that break metrics later |

## 4️⃣ What Happens Behind the Scenes?

1. **Read-only inspection** — Genie Code inspects the tables (native `readTable`/`tableSearch`, the `databricks-data-discovery` skill); it never writes.
2. **Infer structure** — it derives each table''s grain, the join keys between them, and PK/FK candidates.
3. **Flag hidden meaning** — it calls out columns whose business meaning isn''t obvious from the name.
4. **Render the ERD** — it produces an entity-relationship diagram of the source star/snowflake.
5. **Verdict per measure** — it marks each candidate measure in the brief supportable-or-not and records the gate.

### Reference: what "grain" means here

Grain = *what one row represents* (e.g. one order line vs one order). Additive measures (`SUM`) are safe at their natural grain; non-additive ones (averages, ratios) must never be averaged across periods. Getting grain right here is what lets Step 4 flag non-additive measures correctly.',
'## Expected Deliverables

- Per-table grain, join and PK/FK candidates, and "surprising column" callouts
- An ERD of the source schema
- An explicit can/can''t-support verdict for each candidate measure in the brief
- Gate recorded to `.vibecoding-state.md` (ERD produced + per-measure supportability) — no assets created

**Sample — ERD shape a clean star returns:**

```mermaid
erDiagram
  ORDERS ||--o{ LINEITEM : "o_orderkey"
  CUSTOMER ||--o{ ORDERS : "c_custkey"
  NATION ||--o{ CUSTOMER : "n_nationkey"
  REGION ||--o{ NATION : "r_regionkey"
  LINEITEM { decimal l_extendedprice "money" decimal l_discount "0-1" string l_returnflag "R = returned" }
  ORDERS { date o_orderdate "primary time dim" decimal o_totalprice "tax-incl" }
```',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 3 (Genie Accelerator · Semantic Layer): Measures Analysis (the sign-off gate) - bypass_llm=TRUE (Type B/C; discover-don't-inject — template names no conflict)
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(62, 'semlayer_measures',
'The **gate the whole track hinges on**: Genie Code drafts a small, governed measure inventory and **discovers any definitional conflicts itself** — then stops and waits for your sign-off. No Metric View YAML is written until you approve.

Copy and paste this prompt to Genie Code:

```
Read docs/design_prd.md, docs/genie_brief.md (the Step 2 profile + candidates), any files I dropped
in, and .vibecoding-state.md first — the measures that matter follow the PRD''s User Journeys.

Draft my measure inventory as a table with exactly these columns:
  Measure | Current definition (one sentence) | Source of truth (table.column or file) | Grain | Owner (a named person) | Conflict

Rules:
- Stop at five measures. Depth beats coverage — two well-governed measures beat fifteen half-
  governed ones.
- Name the source of truth as the actual table/column (or the dropped file it came from).
- Inspect the real definitions and the data: wherever the same measure could be computed or
  interpreted more than one way (e.g. different filters, grains, or gross-vs-net style choices),
  write BOTH readings in the Conflict column. The conflict is a finding you surface, not something
  I will tell you — flag it even if I didn''t mention it.
- Mark any measure with no named owner as "unowned". No owner, no Metric View.

Pre-fill every cell you can from the brief and my dropped files; leave a clear "?" where you need me.
Then STOP, show me the table, and record the gate result in .vibecoding-state.md. Do NOT write any
Metric View YAML until I sign off on it.
```',
'',
'Measures Analysis — the Gate (Genie Accelerator)',
'Genie Code drafts a ≤5-row measure inventory (definition, source of truth, grain, owner, conflict) and self-discovers definitional conflicts — you sign off before ANY Metric View is authored',
62,
'> **Artifact root (client-aware).** Resolve `<ARTIFACT_ROOT>` via `vibecoding-state.resolve_root` and write every artifact under it.

## 1️⃣ How To Apply

Copy the prompt, paste it into a Genie Code Agent chat, and press Enter. Review the inventory table, correct any cell, fill the owners, and only then reply with your sign-off (e.g. *"Signed off — proceed to the Metric View for exactly these measures"*).

## 2️⃣ What Are We Building?

A **signed-off measure inventory** in `docs/genie_brief.md`: ≤5 measures, each with a one-sentence definition, a real source-of-truth (table.column or file), a grain, a named owner, and any conflict. This is the **contract** the Metric View is built against — and the gate the whole track hinges on.

```mermaid
flowchart LR
  prof["Step 2 profile<br/>+ dropped glossary"] --> inv["≤5-measure inventory<br/>def · source · grain · owner · conflict"]
  inv --> disc{"same measure,<br/>two readings?"}
  disc -->|"write BOTH<br/>(discovered, not injected)"| stop["STOP · your sign-off"]
  disc -->|"none"| stop
  stop -->|"approved"| mv["→ Metric View (Step 4)"]
  stop -.->|"no owner"| block["unowned = no Metric View"]
```

The headline behavior: Genie Code **discovers** definitional conflicts itself (gross-vs-net, grain traps) and writes both readings — it is never told the conflict.

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How it''s used here |
|----------|-------------------|
| **Discover, don''t inject** | The template names no specific measure or conflict — Genie Code surfaces conflicts from the real definitions/data on its own |
| **Depth over coverage** | Capping at five well-governed measures beats a sprawling, half-governed list |
| **Ownership as a gate** | "No owner, no Metric View" — unowned measures are flagged, not silently modeled |
| **Source-of-truth is concrete** | Each measure names a real `table.column` (or the file it came from), never a vague label |
| **Human sign-off before build** | No YAML is authored until you approve the inventory |

## 4️⃣ What Happens Behind the Scenes?

1. **Read the context** — Genie Code reads the Step 2 profile, the brief, any dropped glossary, and state.
2. **Fill the table** — it drafts ≤5 rows (Measure · Definition · Source · Grain · Owner · Conflict), pre-filling every cell it can and marking gaps with `?`.
3. **Self-discover conflicts** — wherever one measure could be computed two ways, it writes **both** readings in the Conflict column — this is a finding it surfaces, not one you named.
4. **Flag ownership** — measures with no named owner are marked `unowned` (and therefore blocked from a Metric View).
5. **Stop at the gate** — it records the inventory and waits; **no Metric View YAML is written** until you sign off.

### Reference: the sign-off gate

The conflict may surface here **or** already during Step 1 elicitation — either is a pass as long as it was self-discovered and recorded in the signed-off table. This gate is what prevents "two numbers, same name" from silently reaching production.',
'## Expected Deliverables

- A ≤5-row measure inventory table in `docs/genie_brief.md` (Measure | Definition | Source of truth | Grain | Owner | Conflict)
- At least one conflict **Genie Code surfaced on its own** (nothing about it was in the prompt)
- Unowned measures flagged; every kept measure has a named owner
- An explicit "waiting for your sign-off before authoring" stop — **no Metric View YAML in this transcript**
- Gate recorded to `.vibecoding-state.md`

**Sample — the shape of a signed-off inventory (yours will differ):**

| Measure | Current definition | Source of truth | Grain | Owner | Conflict |
|---|---|---|---|---|---|
| Net Revenue | `SUM(l_extendedprice * (1 - l_discount))` | `lineitem` | line | A. Chen | **Gross** `SUM(l_extendedprice)` also circulates — Finance vs Sales-Ops |
| Average Order Value | Net Revenue ÷ distinct orders | `lineitem`+`orders` | order | A. Chen | **non-additive** — never average across periods |
| Return Rate | returned lines ÷ all lines (24.69%) | `lineitem.l_returnflag` | line | ? unowned | order-level denominator gives 43.07% |',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 4 (Genie Accelerator · Semantic Layer): Draft the Metric View - bypass_llm=TRUE (Type B/C; Path B author-from-inventory default, Path A /importBI in the genie-code fork)
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(63, 'semlayer_metric_view',
'Turn the signed-off inventory into a **governed Metric View** in your writable target. Metric Views are FULLY native to Genie Code — it authors the `WITH METRICS LANGUAGE YAML` view directly. Two paths:

- **Tab A — author from the inventory (default, below):** build the Metric View from the measures you approved in Step 3.
- **Tab B — Import BI:** if you have a Tableau/Power BI file, use the **Import BI** tab (Genie Code `/importBI`). It creates a dashboard + *local* metric views that you must **promote to Unity Catalog** before a Genie Agent can use them. Full procedure lives in `semantic-layer/01-metric-views-patterns/references/import-bi-to-metric-view.md`.

**Step 4a — review the YAML first (copy verbatim):**

```
Read docs/genie_brief.md (the signed-off measure inventory) first. Use only the measures I approved.

{chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema} holds the tables behind our
{use_case_title} reporting.

Our business has agreed the measure definitions in the brief. Use those exact definitions — don''t
re-invent them.

Work out which tables, joins, and grain each measure needs. Show me what the Metric View YAML would
look like, including the dimensions people would want to slice by.

Do not save anything yet. Explain why you chose each grain, and flag any measure that is
non-additive.
```

**Step 4b — create it once the YAML matches the inventory (copy verbatim):**

```
Create this Metric View in {lakehouse_default_catalog}.{user_schema_prefix}_gold (my source data in
{chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema} may be read-only, so build it in the
writable target). You can suggest the Metric View name.

Use CREATE OR REPLACE, and first check .vibecoding-state.md and the target schema for an existing
Metric View of this name — if one exists, replace it rather than making a duplicate. Use
business-friendly display names, not column names, and run a MEASURE() query afterward to prove each
approved measure returns. Then save the Metric View name and gate result to .vibecoding-state.md.
```

If Genie Code describes a Metric View without creating it, reply: *"Create the Metric View now, do not just describe it."*',
'',
'Draft the Metric View (Genie Accelerator)',
'Author a governed Metric View from the signed-off inventory (Path B) or import a Tableau/Power BI model and promote it to Unity Catalog (Path A) — review the YAML before creating',
63,
'> **Artifact root (client-aware).** Resolve `<ARTIFACT_ROOT>` via `vibecoding-state.resolve_root` and write every artifact under it.

## 1️⃣ How To Apply

1. **Path B (default):** run Step 4a, review the YAML against your inventory, then run Step 4b to create it.
2. **Path A (Import BI):** switch to the **Import BI** tab, run `/importBI` in Genie Code with your `.twb`/`.twbx`/`.tds`/`.tdsx`/`.pbit`, then **promote** the inventory-matching local view to Unity Catalog (`{lakehouse_default_catalog}.{user_schema_prefix}_gold`) via "Export to a Unity Catalog metric view". Keep only what matches the brief. See `references/import-bi-to-metric-view.md`.

## 2️⃣ What Are We Building?

One **governed Metric View** in `{lakehouse_default_catalog}.{user_schema_prefix}_gold` covering exactly the approved measures, with business-friendly display names and non-additive measures flagged. A `MEASURE()` query proves each measure returns.

```mermaid
flowchart LR
  inv["signed-off inventory"] --> pb["Path B: author YAML<br/>(review 4a → create 4b)"]
  bi["Tableau / Power BI file"] --> pa["Path A: /importBI<br/>→ promote local view to UC"]
  pb --> mv["governed Metric View<br/>{lakehouse_default_catalog}.{user_schema_prefix}_gold"]
  pa --> mv
  mv --> proof["MEASURE() query<br/>proves each measure returns"]
  proof --> gate{{"Gate: MV live"}}
```

This is the **one definition** Genie, dashboards, and BI all share — the heart of the governed semantic layer.

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How it''s used here |
|----------|-------------------|
| **Governed semantic layer** | Measures live in a UC Metric View — one definition shared by Genie, dashboards, and BI |
| **Review before create** | The YAML is reviewed against the signed-off inventory before anything is saved |
| **Writable target ≠ source** | Assets are built in the writable target because the source schema may be read-only |
| **Idempotent** | `CREATE OR REPLACE` + a state/schema check avoids duplicate Metric Views |
| **Nested joins work; pre-joined recommended** | Multi-hop snowflake joins resolve on live Genie Code; a pre-joined subquery `source:` is the simpler recommended pattern (parity confirmed) |
| **Non-additive flagged in YAML** | Averages/ratios carry a note so they''re never summed or averaged across periods |

## 4️⃣ What Happens Behind the Scenes?

1. **Plan the shape (4a)** — Genie Code works out the tables, joins, and grain each approved measure needs and shows you the YAML, explaining each grain choice and flagging non-additive measures. Nothing is saved yet.
2. **Create in the writable target (4b)** — on your OK it runs `CREATE OR REPLACE VIEW … WITH METRICS LANGUAGE YAML` in `{lakehouse_default_catalog}.{user_schema_prefix}_gold` (source may be read-only), checking state/schema first to avoid a duplicate.
3. **Prove it** — it runs a `SELECT MEASURE(...) … GROUP BY ALL` so every approved measure returns a real number, then records the MV name to state.

### Reference: Metric View YAML v1.1

`synonyms:`, `display_name:`, and `format:` require **v1.1**. A minimal measure looks like:

```yaml
measures:
  - name: net_revenue
    expr: SUM(l_extendedprice * (1 - l_discount))
    display_name: "Net Revenue"
    synonyms: ["revenue", "net sales", "top line"]
    format: { type: currency }
```

`/importBI` (Path A) creates **local** metric views that must be promoted to UC before a Genie Agent can use them — full procedure in `semantic-layer/01-metric-views-patterns/references/import-bi-to-metric-view.md`.',
'## Expected Deliverables

- A live Metric View in `{lakehouse_default_catalog}.{user_schema_prefix}_gold` for exactly the approved measures
- YAML reviewed **before** creation; grain justified per measure; non-additive measures flagged
- A `SELECT MEASURE(...) ... GROUP BY ALL` returns a number for each measure
- Metric View name + gate recorded to `.vibecoding-state.md`

**Sample — the MEASURE() proof (validated on `samples.tpch`):**

```
SELECT MEASURE(net_revenue), MEASURE(gross_revenue), MEASURE(order_count)
FROM {lakehouse_default_catalog}.{user_schema_prefix}_gold.order_revenue_metrics;
-- net_revenue = 1,089,835,179,247 | gross = 1,147,191,013,439 | orders = 7,500,000
```',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 5 (Genie Accelerator · Semantic Layer): Review & Expand Synonyms - bypass_llm=TRUE (Type B; review-and-expand, not first-time add)
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(64, 'semlayer_synonyms',
'Make the Metric View **discoverable in natural language**. Genie Code usually adds some synonyms while creating the view (Step 4), so this is a *review-and-expand* pass. Synonyms live on the Metric View (`synonyms:`, YAML v1.1, up to 10 per measure/field) and are honored by Genie and BI for term discovery.

Copy and paste this prompt to Genie Code:

```
Read .vibecoding-state.md first.

Review the synonyms on the Metric View in {lakehouse_default_catalog}.{user_schema_prefix}_gold — you
likely added some while creating it. For every measure and each key dimension, make sure the
`synonyms:` list (YAML v1.1, up to 10 each) covers: any acronym, the informal phrasing people in
{use_case_title} actually use, and any legacy name from our old reporting.

Show me the diff of what you''re adding before you save, then record the gate result in
.vibecoding-state.md.

If I imported from a BI file, also pull the original field aliases from the imported workbook and
add them as synonyms.
```',
'',
'Review & Expand Synonyms (Genie Accelerator)',
'Review the synonyms Genie Code added while building the Metric View and expand them to cover acronyms, informal phrasing, and legacy names (and BI field aliases if you imported)',
64,
'> **Artifact root (client-aware).** Resolve `<ARTIFACT_ROOT>` via `vibecoding-state.resolve_root` and write every artifact under it.

## 1️⃣ How To Apply

Copy the prompt, paste it into a Genie Code Agent chat, and press Enter. Review the proposed synonym diff, then let Genie Code rebuild the Metric View (native SQL — no special page). If you used the Import BI path in Step 4, confirm at least one synonym traces back to an imported field alias.

## 2️⃣ What Are We Building?

An **expanded synonym set** on the Metric View — acronyms, informal phrasing, and legacy names for each measure and key dimension — so users'' natural-language questions resolve to the governed measures instead of falling through to raw-table guessing.

```mermaid
flowchart LR
  mv["Metric View<br/>(synonyms from Step 4)"] --> review["review current synonyms"]
  review --> expand["expand per field:<br/>acronym · informal · legacy"]
  bi["imported BI file?"] -.->|"field aliases"| expand
  expand --> diff["show diff (≤10 per field)"]
  diff -->|"approve"| rebuild["rebuild MV natively"]
  rebuild --> gate{{"Gate: synonyms reviewed"}}
```

Because synonyms live on the **Metric View** (not just the Genie space), Genie *and* BI share the same term discovery.

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How it''s used here |
|----------|-------------------|
| **Synonyms on the Metric View** | v1.1 `synonyms:` (≤10 each) live on the MV, so Genie **and** BI share term discovery — not only the Genie space |
| **Review, don''t re-add** | Builds on synonyms Genie Code already added in Step 4 rather than starting over |
| **Cover real language** | Acronyms + informal phrasing + legacy names map how people actually ask |
| **BI aliases survive** | If you imported from Tableau/Power BI, the original field aliases are folded in as synonyms |
| **Diff before save** | You review the additions before the MV is rebuilt |

## 4️⃣ What Happens Behind the Scenes?

1. **Read current synonyms** — Genie Code reads the `synonyms:` already on the Metric View from Step 4.
2. **Propose additions** — for every measure and key dimension it drafts acronym / informal / legacy phrasings (plus imported BI field aliases), capped at 10 per field.
3. **Show the diff** — it prints what it would add before touching the view.
4. **Rebuild on approval** — on your OK it rebuilds the Metric View natively (SQL — no special page) and records the gate.

### Reference: what makes a good synonym list

Cover the three ways people drift from the canonical name: the **acronym** ("AOV"), the **informal** phrasing ("spend per order"), and the **legacy** name from the old report ("avg basket"). Skip near-duplicates — 10 well-chosen synonyms beat 10 spelling variants.',
'## Expected Deliverables

- Reviewed + expanded `synonyms:` (≤10 per measure/key dimension) written to the Metric View YAML
- Coverage of acronyms, informal phrasing, and legacy names; BI field aliases folded in when the Import BI path was used
- A diff reviewed before save
- Gate recorded to `.vibecoding-state.md`

**Sample — the synonym diff you approve:**

```diff
  measures:
    - name: average_order_value
      display_name: "Average Order Value"
-     synonyms: ["aov"]
+     synonyms: ["aov", "avg order value", "spend per order", "revenue per order", "avg basket"]
```',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- semlayer_locate (genie-code fork) — data-mode navigation + synthetic branch + file-drop; bypass_LLM = TRUE
INSERT INTO ${catalog}.${schema}.section_input_prompts
(input_id, section_tag, coding_assistant, input_template, system_prompt,
 bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(932, 'semlayer_locate', 'genie-code',
'Point Genie Code at your data and seed the **Genie brief** — the working document that drives the whole track. This step does no building: it confirms where your data lives (or generates synthetic data), reads any definitions you bring, and drafts a first-pass brief for you to correct.

This will involve the following steps:

- **Choose a data mode** — extract from existing tables, upload a data dictionary, or generate synthetic data.
- **Bring context** — drop any glossary / docs / BI export into the Genie Code chat via the context (+) button.
- **Seed the brief** — run the prompt so Genie Code drafts `docs/genie_brief.md` plus one batched question list.

**Genie Code navigation:**

- **Extract from existing tables** — set the **Source** catalog/schema (`{chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema}`) in the panel above; Genie Code reads them read-only.
- **Generate (synthetic)** — if you have no usable data, Genie Code proposes a schema grounded in the PRD''s Data Entities and, after your yes, Faker-generates it into your writable target `{lakehouse_default_catalog}.{user_schema_prefix}_gold` via `executeCode`.
- **Bring context** — drop an Excel glossary, CSV, docs file, or Tableau/Power BI export using the **context (+) button** in the Genie Code chat (or reference a UC volume path). If you have none, delete the two "dropped definitions" lines below.

Paste this into a Genie Code Agent chat:

```
Read docs/design_prd.md and .vibecoding-state.md first — reuse the PRD''s User Journeys and
High-Level Data Entities; don''t re-ask what they already answer.

My data for {use_case_title} is in {chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema}. (If I
have none, offer to generate realistic sample data for {use_case_title} into
{lakehouse_default_catalog}.{user_schema_prefix}_gold, tell me the tradeoff, and only generate it if
I say yes.)

I''ve dropped my current definitions into the repo. Read them and pull out every measure name,
definition, and field alias you can — cite which file each came from.

Start docs/genie_brief.md from the PRD + those files: function, candidate measures, and the
questions my users actually ask. If anything the PRD and files don''t cover needs my input, collect
ALL of it into ONE numbered list of questions and ask me in a single batch — do not drip them one at
a time. Pre-fill your best assumption for each and mark it "(assumed — correct me)". Do NOT profile
deeply or build anything yet — show me the seeded brief plus that one question list, and record the
gate result in .vibecoding-state.md.
```

**State-lock:** if this is the first step of the track, Genie Code bootstraps `.vibecoding-state.md`; otherwise it appends this step''s Per-Step Log entry and gate result, then re-reads to confirm the write landed.

**Gate:** `Brief seeded` — `docs/genie_brief.md` exists with function + candidate measures + the questions users ask; the source `{chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema}` is confirmed OR the synthetic branch was chosen; one batched, pre-assumed question list was presented; the gate result is recorded in `.vibecoding-state.md`.

**➡️ Next step.** Profile the schema (Step 2) so the measure inventory is grounded in what the data can actually support.',
'',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- semlayer_metric_view (genie-code fork) — native author (Path B) + /importBI promote-to-UC (Path A, Genie-Code-only); bypass_LLM = TRUE
INSERT INTO ${catalog}.${schema}.section_input_prompts
(input_id, section_tag, coding_assistant, input_template, system_prompt,
 bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(933, 'semlayer_metric_view', 'genie-code',
'Turn the signed-off inventory into a **governed Metric View** in `{lakehouse_default_catalog}.{user_schema_prefix}_gold`. Metric Views are FULLY native on Genie Code — it authors the `WITH METRICS LANGUAGE YAML` view via `executeCode` and validates with a `MEASURE()` query.

This will involve the following steps:

- **Pick a path** — author from the signed-off inventory (Path B) or Import BI (`/importBI`, Path A).
- **Review the YAML** — see the proposed grain, joins, and dimensions before anything is saved.
- **Create it** — `CREATE OR REPLACE` in the writable target and prove each measure with `MEASURE()`.
- **Record state** — save the Metric View name and gate result to `.vibecoding-state.md`.

**Path A — Import BI (`/importBI`, Genie-Code-only).** Run `/importBI` in the Genie Code chat and attach your `.twb`/`.twbx`/`.tds`/`.tdsx`/`.pbit` (≤100 MB direct, or reference a UC volume path). It builds an AI/BI dashboard + **LOCAL (dashboard-scoped) metric views** + relationships — the local views are **not** usable by a Genie Agent, so **promote** the inventory-matching one to Unity Catalog via **"Export to a Unity Catalog metric view"** into `{lakehouse_default_catalog}.{user_schema_prefix}_gold`. Keep only what matches the brief. Requires partner-powered AI features. Full procedure + gotchas: `semantic-layer/01-metric-views-patterns/references/import-bi-to-metric-view.md`.

**Path B — author from the inventory.**

Step 4a — review the YAML first (paste to Genie Code):

```
Read docs/genie_brief.md (the signed-off measure inventory) first. Use only the measures I approved.

{chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema} holds the tables behind our
{use_case_title} reporting. Our business has agreed the measure definitions in the brief — use those
exact definitions, don''t re-invent them.

Work out which tables, joins, and grain each measure needs. Show me the Metric View YAML (including
slice-by dimensions). Do not save anything yet. Explain each grain and flag any non-additive measure.
Note: nested (snowflake) joins work natively; a pre-joined SQL subquery in the source: block is the
simpler recommended pattern.
```

Step 4b — create it once the YAML matches (paste to Genie Code):

```
Create this Metric View in {lakehouse_default_catalog}.{user_schema_prefix}_gold via executeCode
(source data in {chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema} may be read-only, so build
it in the writable target). You can suggest the name.

Use CREATE OR REPLACE VIEW … WITH METRICS LANGUAGE YAML, and first check .vibecoding-state.md and the
target schema for an existing Metric View of this name — replace it rather than duplicate. Use
business-friendly display names, then run a MEASURE() query to prove each approved measure returns.
Save the Metric View name and gate result to .vibecoding-state.md.
```

If Genie Code describes a Metric View without creating it, reply: *"Create the Metric View now, do not just describe it."* (Bundle extract-back later uses `readTable → metadata.view_query_text`.)

**State-lock:** after the gate passes, append this step''s Per-Step Log entry, gate result, and the captured Metric View name to `.vibecoding-state.md`, then re-read to confirm the write landed.

**Gate:** `Metric View live` — one governed Metric View exists in `{lakehouse_default_catalog}.{user_schema_prefix}_gold` for exactly the approved measures; the YAML was reviewed before creation; a `SELECT MEASURE(...) ... GROUP BY ALL` returns a number for each measure; non-additive measures are flagged; the Metric View name + gate are recorded in `.vibecoding-state.md`.

**➡️ Next step.** Review and expand the Metric View''s synonyms (Step 5) so users'' natural-language questions resolve to the governed measures.',
'',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- =============================================================================
-- GENIE ACCELERATOR — Genie Agent group (Batch 2, Steps 6-10, 14) — order 65-69, 73
-- Stub rows; authored bodies are synced from sections/6N/73-gagent_*.md via the
-- scoped per-id sync (source of truth = the .md files).
-- =============================================================================

-- Step 6 (Genie Accelerator · Genie Agent): Describe the Agent - bypass_llm=TRUE (Type B; native createAsset shell + PATCH serialized_space)
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(65, 'gagent_describe',
'Create the **Genie Agent** (Genie space) and point it at your governed Metric View. Its users and topics come straight from the PRD''s personas and User Journeys. Review the serialized config before it is created.

Copy and paste this prompt to Genie Code:

```
Read docs/design_prd.md, docs/genie_brief.md and .vibecoding-state.md first — the agent''s users and
the topics it covers come straight from the PRD''s personas and User Journeys.

Create a Genie space (Genie Agent) for {use_case_title}. This agent answers questions about what my
team reviews for {use_case_title}. Its users are the PRD personas, and they typically ask about the
top two or three topics in the brief.

Attach the governed Metric View in {lakehouse_default_catalog}.{user_schema_prefix}_gold (the one
recorded in .vibecoding-state.md) as the ONLY data source — it should always use our governed Metric
View rather than querying the raw {chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema} tables.

Show me the space''s serialized config before you create it. Then create it and save the space id to
.vibecoding-state.md.
```',
'',
'Describe the Genie Agent (Genie Accelerator)',
'Create a Genie space (Genie Agent) from the PRD personas, attach the governed Metric View as the only data source, and review the serialized config before creating',
65,
'> **Artifact root (client-aware).** Resolve `<ARTIFACT_ROOT>` via `vibecoding-state.resolve_root` and write every artifact under it.

## 1️⃣ How To Apply

Copy the prompt, paste it into a Genie Code Agent chat, and press Enter. Review the serialized config (especially that the Metric View is attached under `data_sources.metric_views`, not as a bare table), then let Genie Code create the space and capture its id.

## 2️⃣ What Are We Building?

A **Genie Agent** (space) scoped to `{use_case_title}`, with the governed Metric View as its only data source and a plain-language description of what it answers. Its space id is saved to `.vibecoding-state.md` for the next steps.

```mermaid
flowchart LR
  mv["governed Metric View<br/>(the only data source)"] --> space["Genie space (Agent)"]
  prd["PRD personas<br/>+ User Journeys"] --> space
  space --> cfg["review serialized config<br/>(MV under data_sources.metric_views)"]
  cfg -->|"create"| id["space id → .vibecoding-state.md"]
```

Attaching **only** the Metric View is the whole point: the agent answers from governed measures, never by re-deriving metrics off raw fact tables.

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How it''s used here |
|----------|-------------------|
| **Governed source only** | The Metric View is the single data source, so the agent never re-derives metrics from raw fact tables |
| **`data_sources.metric_views`** | The MV is attached in the correct slot (native `createAsset` miscategorizes it under `tables`) |
| **PRD-driven scope** | Users and topics come from PRD personas/journeys, not invented |
| **Review before create** | The serialized config is shown before the space is minted |

## 4️⃣ What Happens Behind the Scenes?

1. **Read the scope** — Genie Code reads `design_prd.md` + brief for the personas and top topics.
2. **Mint the shell** — it creates the space with `createAsset(assetType:"genie", …)`.
3. **Attach + describe** — it populates the config via `PATCH /api/2.0/genie/spaces/{id}`, putting the MV under `data_sources.metric_views` and writing a plain-language scope.
4. **Review, then create** — it shows the serialized config first; on your OK it finalizes and saves the space id to state.

### Reference: the PATCH gotcha

Populate the space with `PATCH /api/2.0/genie/spaces/{id}` — **never** `PATCH /api/2.0/data-rooms/{id}`, which wipes the config. This runs from a workspace/Genie surface, not a bundle-editor page.',
'## Expected Deliverables

- A live Genie space (Genie Agent) for `{use_case_title}` with a plain-language scope
- The governed Metric View attached under `data_sources.metric_views` (not a bare table)
- Serialized config reviewed before creation
- Space id saved to `.vibecoding-state.md`

**Sample — the config slot that must be right:**

```json
{
  "data_sources": {
    "metric_views": ["{lakehouse_default_catalog}.{user_schema_prefix}_gold.order_revenue_metrics"],
    "tables": []
  },
  "title": "{use_case_title} — Revenue Agent"
}
```',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 7 (Genie Accelerator · Genie Agent): Author Instructions - bypass_llm=TRUE (Type B; PATCH serialized_space, lean rules)
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(66, 'gagent_instructions',
'Give the agent **lean, rule-shaped general instructions**. They load on every turn, so every line must be a rule, not description. Always include a `MEASURE()` preferred-source rule and an explicit scope boundary.

Copy and paste this prompt to Genie Code:

```
Read docs/genie_brief.md and .vibecoding-state.md first.

Add general instructions to the Genie space. Keep them lean — they load on every turn, so every line
must be a rule, not description.

Turn every guardrail recorded in docs/genie_brief.md into one short, plain-English rule. Always
include these two:
- For any metric in scope, query the Metric View using MEASURE(); do not re-derive metrics from raw
  fact tables.
- Scope: what this agent covers. Do not answer questions about what it does not cover.

Show me the final instruction block and cut anything that isn''t load-bearing, then record the gate
result in .vibecoding-state.md.
```',
'',
'Author Agent Instructions (Genie Accelerator)',
'Turn the brief''s guardrails into lean, rule-shaped general instructions — including a MEASURE() preferred-source rule and an explicit scope boundary',
66,
'> **Artifact root (client-aware).** Resolve `<ARTIFACT_ROOT>` via `vibecoding-state.resolve_root` and write every artifact under it.

## 1️⃣ How To Apply

Copy the prompt, paste it into a Genie Code Agent chat, and press Enter. Review the instruction block, cut anything that isn''t a load-bearing rule, and let Genie Code PATCH the space.

## 2️⃣ What Are We Building?

A **short, rule-shaped general-instruction block** on the agent (≤~20 lines): each brief guardrail as one plain-English rule, plus a `MEASURE()` preferred-source rule and a clear scope boundary.

```mermaid
flowchart LR
  brief["brief guardrails"] --> rules["lean rules (≤~20 lines)"]
  measure["MEASURE() preferred-source rule"] --> rules
  scope["scope boundary<br/>(what it does NOT cover)"] --> rules
  rules --> cut["cut anything not load-bearing"]
  cut --> patch["PATCH serialized_space"]
```

Instructions load on **every** turn, so every line has to earn its place as a rule — descriptions and formula internals belong on the Metric View, not here.

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How it''s used here |
|----------|-------------------|
| **Rules, not prose** | Instructions load every turn — lean rules beat descriptive paragraphs |
| **Preferred source** | A `MEASURE()` rule keeps the agent on the governed Metric View |
| **Scope boundary** | An explicit "does not cover" line prevents out-of-scope guessing |
| **Cut non-load-bearing lines** | Formula internals / data facts already live on the Metric View, so they''re trimmed |
| **≤20 lines** | A tight block leaves the model''s attention for the question, not boilerplate |

## 4️⃣ What Happens Behind the Scenes?

1. **Collect guardrails** — Genie Code reads every guardrail in `docs/genie_brief.md`.
2. **Rewrite as rules** — it turns each into one short, plain-English rule, and always adds the `MEASURE()` preferred-source rule and the scope boundary.
3. **Trim** — it cuts anything that isn''t load-bearing (formula internals, data facts) so the block stays ≤~20 lines.
4. **Show, then PATCH** — it shows the final block; on your OK it rewrites `general_instructions` and PATCHes the space''s `serialized_space`, then records the gate.

### Reference: load-bearing vs not

*Load-bearing* (keep): "For any metric in scope, use `MEASURE()` on the Metric View." *Not load-bearing* (cut): "Net Revenue is extended price times one minus discount" — that formula already lives in the MV. Leans on `semantic-layer/03-genie-space-patterns` (General Instructions ≤20 lines).',
'## Expected Deliverables

- A lean general-instruction block (≤~20 lines) of plain-English rules
- A `MEASURE()` preferred-source rule and an explicit scope boundary present; no contradictions
- Non-load-bearing lines cut (formula internals / data facts left on the Metric View)
- Gate recorded to `.vibecoding-state.md`

**Sample — a lean instruction block:**

```
- For any metric in scope, query the Metric View with MEASURE(); never re-derive from raw tables.
- For relative time ("this month", "YTD"), anchor to the latest data date and state the date used.
- Scope: order & revenue reporting only. Decline margin/COGS and supply-cost questions cleanly.
- Never average a measure flagged non-additive (e.g. Average Order Value) across periods.
```',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 8 (Genie Accelerator · Genie Agent): Add Verified Queries - bypass_llm=TRUE (Type B; instructions.example_question_sqls on the space, not the MV)
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(67, 'gagent_verified',
'Add **verified example queries** (question → SQL) to the Genie space for the two or three questions your users ask most. These are answers Genie reuses instead of reasoning from scratch, so each must query the governed Metric View via `MEASURE()` and be proven to return. Verified queries live on the **space** (`instructions.example_question_sqls`), not the Metric View — so this runs after the space exists (Step 6).

Copy and paste this prompt to Genie Code:

```
Read docs/genie_brief.md and .vibecoding-state.md first.

For my Genie space, add verified example queries (question → SQL) for the two or three questions our
{use_case_title} users ask most often — pull them from the brief.

Each SQL must query the governed Metric View in {lakehouse_default_catalog}.{user_schema_prefix}_gold
via MEASURE() with the correct filters. These are answers Genie will reuse instead of reasoning from
scratch, so make them exact.

Show me each question/SQL pair, run each once to prove it returns, save them to the space, then
record the gate result in .vibecoding-state.md.
```',
'',
'Add Verified Queries (Genie Accelerator)',
'Add 2-3 verified example queries (question → MEASURE()-based SQL) to the Genie space for the questions users ask most, each run once to prove it returns',
67,
'> **Artifact root (client-aware).** Resolve `<ARTIFACT_ROOT>` via `vibecoding-state.resolve_root` and write every artifact under it.

## 1️⃣ How To Apply

Copy the prompt, paste it into a Genie Code Agent chat, and press Enter. Review each question/SQL pair, confirm each returns, then let Genie Code save them to the space.

## 2️⃣ What Are We Building?

**2–3 verified example queries** on the Genie space, each mapping a real user question to exact `MEASURE()`-based SQL over the governed Metric View — precomputed answers Genie reuses instead of reasoning from scratch.

```mermaid
flowchart LR
  q["top 2-3 questions<br/>(from the brief)"] --> sql["exact MEASURE() SQL<br/>+ correct filters"]
  sql --> run["run each once<br/>(proves it returns)"]
  run --> save["example_question_sqls<br/>on the SPACE"]
  save --> gate{{"Gate: verified queries saved"}}
```

These live on the **space** (`instructions.example_question_sqls`), not the Metric View — which is why this step comes *after* the space exists (Step 6).

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How it''s used here |
|----------|-------------------|
| **Verified queries on the space** | They live in `instructions.example_question_sqls`, not the Metric View |
| **MEASURE() over the MV** | Every example query goes through the governed Metric View, not raw tables |
| **Prove it returns** | Each SQL is run once so a broken example never ships |
| **Pull from the brief** | The questions are the ones users actually ask, per the brief |
| **Exact, not approximate** | Genie reuses these verbatim, so filters and grain must be right |

## 4️⃣ What Happens Behind the Scenes?

1. **Pick the questions** — Genie Code selects the top 2–3 questions users actually ask from the brief.
2. **Write exact SQL** — it authors `MEASURE()`-based SQL over the Metric View with the correct filters.
3. **Run once** — it executes each query once to confirm it returns (a broken example never ships).
4. **Save to the space** — on your review it PATCHes them into `instructions.example_question_sqls` and records the gate.

### Reference: verified queries vs benchmarks

Verified queries (this step) are *trusted answers Genie reuses*. Benchmarks (Step 9) are *tests Genie is scored against*. Both use `MEASURE()`, but verified queries ship into the space''s instructions while benchmarks drive the optimize loop.',
'## Expected Deliverables

- 2–3 `example_question_sqls` saved to the **space** (not the Metric View)
- Each SQL queries the governed Metric View via `MEASURE()` with correct filters
- Each executed once to prove it returns
- Gate recorded to `.vibecoding-state.md`

**Sample — a verified question → SQL pair:**

```
Q: "What was net revenue by region last year?"
SQL: SELECT region, MEASURE(net_revenue)
     FROM {lakehouse_default_catalog}.{user_schema_prefix}_gold.order_revenue_metrics
     WHERE order_year = 1997 GROUP BY region;   -- ✓ ran, returned 5 rows
```',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 9 (Genie Accelerator · Genie Agent): Load Benchmarks (expected answers required) - bypass_llm=TRUE (Type B; Rule 12 - expected SQL per benchmark enables the optimize loop)
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(68, 'gagent_benchmarks',
'Load **benchmarks** onto the space — and give **every one an expected answer** (expected SQL). A benchmark with a question but no expected answer can''t be scored, so the optimize loop (Step 10) would have nothing to work against. Genie generates the questions; **you** verify the answers.

Copy and paste this prompt to Genie Code:

```
Read docs/design_prd.md, docs/genie_brief.md and .vibecoding-state.md first — the questions to
benchmark are the PRD''s User Journeys.

Based on the Metric View attached to this space, suggest 15 benchmark questions a {use_case_title}
user would ask — from simple single-measure lookups to comparisons across time and dimensions.

Add them as benchmarks, and for EACH one include the expected SQL (correct filter + MEASURE()
wrapping) as the expected answer — a benchmark with a question but no expected answer cannot be
scored, so the optimizer has nothing to work against.

Then STOP: the generated QUESTIONS are a starting point, but the generated ANSWERS are a guess. I
will verify the expected answer on each before we treat any as validated. A benchmark set validated
against itself scores well and means nothing. Record the gate result in .vibecoding-state.md.
```',
'',
'Load Benchmarks with Expected Answers (Genie Accelerator)',
'Generate 15 benchmark questions with expected SQL (correct filter + MEASURE()) as the expected answers — then STOP so you can verify each answer before treating any as validated',
68,
'> **Artifact root (client-aware).** Resolve `<ARTIFACT_ROOT>` via `vibecoding-state.resolve_root` and write every artifact under it.

## 1️⃣ How To Apply

Copy the prompt, paste it into a Genie Code Agent chat, and press Enter. Genie Code proposes 15 questions **each with expected SQL** and stops. **Verify the expected answers yourself** before you treat any as validated — that verification is what makes the Step 10 optimize loop meaningful.

## 2️⃣ What Are We Building?

A **benchmark set** (10–15 questions) on the space, spanning single-measure lookups to time/dimension comparisons — **each with expected SQL** as its expected answer.

```mermaid
flowchart LR
  mv["Metric View<br/>+ PRD User Journeys"] --> gen["15 questions<br/>lookups → comparisons"]
  gen --> exp["expected SQL per question<br/>(MEASURE() + correct filter)"]
  exp --> stop["STOP · you verify the answers"]
  stop --> opt["→ optimize loop (Step 10)"]
```

The critical rule: **every** benchmark carries an expected answer. A question with no expected SQL can''t be scored, so the optimizer would have nothing to work against.

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How it''s used here |
|----------|-------------------|
| **Expected answer per benchmark** | Without expected SQL a benchmark can''t be scored — this is what enables Step 10 |
| **User verifies the answers** | Generated answers are a guess; you validate them so the set isn''t graded against itself |
| **Questions from the PRD** | Benchmark questions follow the PRD''s User Journeys |
| **Range of difficulty** | Lookups → comparisons, so the optimizer sees real spread |
| **Stop before scoring** | The run halts for your verification — a self-validated set scores well and means nothing |

## 4️⃣ What Happens Behind the Scenes?

1. **Generate questions** — from the attached Metric View and PRD journeys, Genie Code drafts ~15 questions spanning single-measure lookups to time/dimension comparisons.
2. **Attach expected SQL** — it writes the expected `MEASURE()` SQL (correct filter) for **each** question as its expected answer.
3. **Add as benchmarks** — it saves the question+expected pairs to the space.
4. **Stop for verification** — it halts so **you** confirm each expected answer before any is treated as validated, then records the gate.

### Reference: why you verify the answers

Genie generated both the questions *and* the guessed answers. If you skip verification, the optimize loop grades Genie against Genie — a meaningless 100%. Verifying even a handful of expected answers against the real numbers is what makes Step 10''s pass rate trustworthy (`03-genie-space-patterns` Rule 12).',
'## Expected Deliverables

- 10–15 benchmarks on the space, **each with expected SQL** (correct filter + `MEASURE()`)
- An explicit "verify these answers yourself" stop
- At least one real question answered correctly by the live space
- Gate recorded to `.vibecoding-state.md`

**Sample — a benchmark row with its expected answer:**

```
Q12: "Which region had the highest net revenue in 1997?"
Expected SQL: SELECT region, MEASURE(net_revenue)
              FROM {lakehouse_default_catalog}.{user_schema_prefix}_gold.order_revenue_metrics
              WHERE order_year = 1997 GROUP BY region ORDER BY 2 DESC LIMIT 1;
Expected answer: (you verify) → e.g. "ASIA, 231.4B"   ← confirm before validating
```',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 10 (Genie Accelerator · Genie Agent): Optimize loop (GC-native, distinct from optimize_genie) - bypass_llm=TRUE (Type B; append-only, 5-mode fix table)
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(69, 'gagent_optimize',
'Close the optimize loop **the way Genie Code can actually invoke it**: run the benchmarks via the Conversation API, map each miss to ONE curation fix, **append** the fix (never replace validated rules), then re-run and score. The automatic Workbench GSO job is Workbench-only; this is the GC-native equivalent. It comes **before** Domains/Pages because it only depends on the Metric View + instructions + verified queries.

Copy and paste this prompt to Genie Code:

```
Read docs/genie_brief.md and .vibecoding-state.md first.

Run all the benchmark questions against this Genie space using the Conversation API. For each one,
show: the question, the SQL Genie chose, the answer, and whether it matched the expected answer and
obeyed the brief''s guardrails. Report the overall pass rate.

For every miss, diagnose the root cause and map it to ONE curation fix using this table:
  Right measure not found       → add synonyms (on the Metric View)   (most common)
  Wrong source found            → tighten scope in the instructions
  Outdated pattern used         → mark the asset deprecated
  Critical filter missed        → add it to the instructions
  Tables joined wrongly         → add a join hint or a verified query

Show me the fixes before applying them. APPEND new rules to the existing instruction block — never
replace it (existing rules were already validated). Then re-run the benchmarks and show me the
before/after pass rates. Aim for ~85% on the questions I verified — don''t chase 100%. Record the
before/after pass rate in .vibecoding-state.md.
```',
'',
'Optimize: Run Benchmarks → Fix → Re-run (Genie Accelerator)',
'The GC-native optimize loop — run benchmarks via the Conversation API, triage each miss to ONE curation fix (5-mode table), append fixes, and re-run for an improved pass rate (~85% guidance)',
69,
'> **Artifact root (client-aware).** Resolve `<ARTIFACT_ROOT>` via `vibecoding-state.resolve_root` and write every artifact under it.

## 1️⃣ How To Apply

Copy the prompt, paste it into a Genie Code Agent chat, and press Enter. Review each proposed fix (from the 5-mode table) before it''s applied, confirm fixes are **appended** to the instruction block, and check the before/after pass rate. Aim for ~85% on the answers you verified — don''t chase 100%.

## 2️⃣ What Are We Building?

A **scored, curated agent**: a baseline pass rate, a miss→fix mapping per failure, append-only curation fixes applied, and a re-run showing an improved rate — all recorded to state.

```mermaid
flowchart LR
  run["run benchmarks<br/>(Conversation API)"] --> score["baseline pass rate"]
  score --> miss{"miss?"}
  miss -->|"map to ONE 5-mode fix"| append["APPEND fix<br/>(never replace validated rules)"]
  append --> rerun["re-run"]
  rerun --> score
  miss -->|"~85% reached"| done["record before/after → state"]
```

This is the GC-native equivalent of the Workbench auto-optimize job: the *product* optimize feature only triggers when a workshop-style loop calls for it, and that''s exactly what this step does.

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How it''s used here |
|----------|-------------------|
| **GC-native optimize loop** | Recovers the optimization outcome the Workbench GSO job gives, via the Conversation API |
| **Append-only** | New rules are appended — validated instructions are never replaced (`03-genie-space-patterns` Rule 17) |
| **5-mode fix table** | Every miss maps to exactly one curation fix (synonyms, scope, deprecate, filter, join hint) |
| **~85% guidance, not a gate** | Chase real correctness, not a vanity 100% |
| **Before Domains/Pages** | The loop depends only on MV + instructions + verified queries, so you get a working scored agent first |

## 4️⃣ What Happens Behind the Scenes?

1. **Run + score** — Genie Code runs every benchmark via `ask_genie` (Conversation API), showing the question, the SQL Genie chose, the answer, whether it matched the expected answer, and the overall pass rate.
2. **Triage misses** — for each miss it diagnoses the root cause and maps it to exactly **one** curation fix from the 5-mode table.
3. **Append fixes** — on your review it **appends** the fix (synonym / scope / deprecate / filter / join hint) — validated rules are never replaced.
4. **Re-run** — it re-runs the benchmarks and reports before/after pass rates, aiming for ~85% on the answers you verified, then records them to state.

### Reference: the 5-mode fix table

| Failure mode | Curation fix |
|---|---|
| Right measure not found | add **synonyms** (on the Metric View) — *most common* |
| Wrong source found | tighten **scope** in the instructions |
| Outdated pattern used | mark the asset **deprecated** |
| Critical filter missed | add the **filter** to the instructions |
| Tables joined wrongly | add a **join hint** or a **verified query** |

Every fix is *curation* (synonyms, scope, instructions, verified queries) — never a model change. You may re-run this loop after Domains/Pages (Steps 11–13) to capture domain-scoping gains.',
'## Expected Deliverables

- A baseline pass rate from a full Conversation-API benchmark run
- A failure→fix mapping per miss, each fix drawn from the 5-mode table
- **Append-only** fixes applied (validated rules untouched)
- A re-run with an improved pass rate; before/after recorded to `.vibecoding-state.md` (~85% guidance)

**Sample — the before/after the loop records:**

```
Baseline: 9/15 (60%)
  miss "top region YTD"     → right measure not found  → +synonyms ["ytd","this year"]
  miss "returns %"          → wrong source found       → +scope rule (use return_rate measure)
  miss "revenue by segment" → critical filter missed   → +filter rule (exclude cancelled orders)
Re-run:   13/15 (87%)  ✓ recorded to .vibecoding-state.md
```',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 14 (Genie Accelerator · Genie Agent): Show Your Agent (proof beat, no new asset) - bypass_llm=TRUE (Type B)
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(73, 'gagent_share',
'The **proof beat** — no new asset. Ask your agent **one real question you actually needed answered this quarter** (not one you know it can handle) and confirm it behaves. Note what it got right and the one thing you''d curate next (that feeds the next benchmark round).

Do this in the Genie space chat surface, then record your note:

```
Open the Genie space chat and ask one real question you genuinely needed answered this quarter —
not a softball you know it can handle.

Confirm the agent:
- uses MEASURE() on the governed Metric View (not the raw tables),
- discloses the reference date when the question uses a relative time expression ("this month", "YTD"),
- respects the scope boundary (declines cleanly if the question is out of scope).

Write down what it got right and the ONE thing you''d curate next, and save that note to
.vibecoding-state.md.
```',
'',
'Show Your Agent (Genie Accelerator)',
'The proof beat — ask the agent one real question you actually needed answered, and confirm it uses MEASURE() on the governed Metric View, discloses the time anchor, and respects scope',
73,
'> **Artifact root (client-aware).** Resolve `<ARTIFACT_ROOT>` via `vibecoding-state.resolve_root` and write every artifact under it.

## 1️⃣ How To Apply

Open the Genie space chat surface, ask your real question, and check the three behaviors above. Record what it got right and your next curation target in `.vibecoding-state.md`.

## 2️⃣ What Are We Building?

Nothing new — this is **evidence**: a live, real question answered correctly through the governed Metric View, with the time-anchor disclosure and scope behavior visible, plus a note of the next thing to curate.

```mermaid
flowchart LR
  q["one real question<br/>(you needed this quarter)"] --> agent["Genie Agent"]
  agent --> check["check 3 behaviors:<br/>MEASURE()? · time anchor? · scope?"]
  check --> note["note: what it got right<br/>+ ONE thing to curate next"]
  note --> next["→ seeds the next optimize round"]
```

The test of a governed agent isn''t a rehearsed demo — it''s a question you genuinely needed answered, handled correctly through the Metric View.

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How it''s used here |
|----------|-------------------|
| **A real question, not a softball** | Proves the agent on something you actually needed, not a rehearsed demo |
| **Governed behavior visible** | `MEASURE()` use, time-anchor disclosure, and scope decline are all checked |
| **Feed the next round** | The "one thing to curate next" seeds the next benchmark/optimize cycle |
| **Evidence over vibes** | You record what happened, so improvement is tracked, not felt |

## 4️⃣ What Happens Behind the Scenes?

1. **Ask for real** — you open the Genie space chat and ask one question you genuinely needed answered this quarter.
2. **Observe the three behaviors** — that it used `MEASURE()` on the Metric View (not raw tables), disclosed the reference date for any relative-time phrasing, and respected the scope boundary.
3. **Record the note** — you write down what it got right and the ONE thing you''d curate next, and save it to state — no API calls, just observation.

### Reference: the three governed behaviors

`MEASURE()` on the MV proves the numbers are governed; the **time-anchor disclosure** ("using latest data date 1998-08-02 as today") proves relative time is transparent; the **clean scope decline** proves it won''t guess outside its lane. All three come from the instructions authored in Step 7.',
'## Expected Deliverables

- A live, real question answered correctly through the governed Metric View
- Time-anchor disclosure shown for relative-time questions; scope boundary respected
- A recorded note (what it got right + the one thing to curate next) in `.vibecoding-state.md`

**Sample — the note you record:**

```markdown
## Show Your Agent
Q asked: "How did net revenue trend by quarter this year?"
Got right: used MEASURE(net_revenue); disclosed anchor (latest date = 1998-08-02); grouped by quarter.
Curate next: add synonym "top line" → net_revenue (I had to rephrase once).
```',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- gagent_describe (genie-code fork) — native createAsset(genie) shell + PATCH /api/2.0/genie/spaces/{id}; bypass_LLM = TRUE
INSERT INTO ${catalog}.${schema}.section_input_prompts
(input_id, section_tag, coding_assistant, input_template, system_prompt,
 bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(934, 'gagent_describe', 'genie-code',
'Create the **Genie Agent** (Genie space) and attach your governed Metric View as its only data source. Before this step there is no agent; after it, a live space exists with the Metric View attached and its id captured to state.

This will involve the following steps:

- **Read the context** — PRD personas + User Journeys and the brief drive the agent''s users and topics.
- **Draft the config** — a plain-language scope with the Metric View under `data_sources.metric_views`.
- **Review, then create** — show the serialized config first, then mint the space and capture its id.

**Genie Code navigation:** the space is minted with the native `createAsset(assetType:"genie", tableIdentifiers=[…])` shell, then populated with `PATCH /api/2.0/genie/spaces/{id}` using the full body. **Never `PATCH /api/2.0/data-rooms/{id}`** — it silently wipes the space. Run this from a **workspace / Genie surface**, not a bundle-editor page. Leans on `semantic-layer/04-genie-space-export-import-api` (the `serialized_space` contract + `_assert_sql_arrays` validator) and `03-genie-space-patterns`.

Paste this into a Genie Code Agent chat:

```
Read docs/design_prd.md, docs/genie_brief.md and .vibecoding-state.md first — the agent''s users and
the topics it covers come straight from the PRD''s personas and User Journeys.

Create a Genie space (Genie Agent) for {use_case_title}. This agent answers questions about what my
team reviews for {use_case_title}. Its users are the PRD personas, and they typically ask about the
top two or three topics in the brief.

Attach the governed Metric View in {lakehouse_default_catalog}.{user_schema_prefix}_gold (the one
recorded in .vibecoding-state.md) as the ONLY data source under data_sources.metric_views (NOT as a
bare table) — it should always use our governed Metric View rather than querying the raw
{chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema} tables.

Show me the space''s serialized config before you create it. Then create it and save the space id to
.vibecoding-state.md.
```

**State-lock:** after the space is created, append this step''s Per-Step Log entry, gate result, and the captured `genie_space_id` to `.vibecoding-state.md`, then re-read to confirm the write landed.

**Gate:** `Agent scaffolded` — a live Genie space exists for `{use_case_title}` with a plain-language scope; the governed Metric View is attached under `data_sources.metric_views` (not a bare table); the serialized config was reviewed before creation; the space id is recorded in `.vibecoding-state.md`.

**➡️ Next step.** Author lean general instructions (Step 7) — a `MEASURE()` preferred-source rule and a scope boundary.',
'',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- gagent_optimize (genie-code fork) — GC-native benchmark curation loop via ask_genie (Conversation API), append-only, 5-mode fix table; bypass_LLM = TRUE
INSERT INTO ${catalog}.${schema}.section_input_prompts
(input_id, section_tag, coding_assistant, input_template, system_prompt,
 bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(935, 'gagent_optimize', 'genie-code',
'Close the optimize loop the way Genie Code can invoke it: run the benchmarks via the Conversation API, map each miss to ONE curation fix, **append** it, then re-run and score. This recovers the outcome of the Workbench-only GSO job. It runs **before** Domains/Pages because it depends only on the Metric View + instructions + verified queries.

This will involve the following steps:

- **Run the benchmarks** — every benchmark question through the Conversation API; report the pass rate.
- **Triage each miss** — map the root cause to ONE fix using the 5-mode table.
- **Append fixes** — add new rules/synonyms/verified queries; never replace validated instructions.
- **Re-run and score** — show the before/after pass rate and record it to state.

**Genie Code navigation:** the run uses `ask_genie` (Conversation API) from any workspace surface; the fixes edit the existing space (`PATCH /api/2.0/genie/spaces/{id}`, never `data-rooms`). This is the GC-native equivalent of `optimize_genie` (the heavyweight Workbench GSO job) — not the MLflow/8-scorer orchestrator. Leans on `03-genie-space-patterns` Rule 17 (append-only) + the benchmark regression template.

Paste this into a Genie Code Agent chat:

```
Read docs/genie_brief.md and .vibecoding-state.md first.

Run all the benchmark questions against this Genie space using the Conversation API. For each one,
show: the question, the SQL Genie chose, the answer, and whether it matched the expected answer and
obeyed the brief''s guardrails. Report the overall pass rate.

For every miss, diagnose the root cause and map it to ONE curation fix using this table:
  Right measure not found       → add synonyms (on the Metric View)   (most common)
  Wrong source found            → tighten scope in the instructions
  Outdated pattern used         → mark the asset deprecated
  Critical filter missed        → add it to the instructions
  Tables joined wrongly         → add a join hint or a verified query

Show me the fixes before applying them. APPEND new rules to the existing instruction block — never
replace it (existing rules were already validated). Then re-run the benchmarks and show me the
before/after pass rates. Aim for ~85% on the questions I verified — don''t chase 100%. Record the
before/after pass rate in .vibecoding-state.md.
```

**State-lock:** after the re-run, append this step''s Per-Step Log entry, gate result, and the captured before/after pass rate to `.vibecoding-state.md`, then re-read to confirm the write landed.

**Gate:** `Agent optimized` — benchmarks ran via the Conversation API; each miss was triaged to ONE 5-mode fix; fixes were **appended** (validated rules untouched); a re-run shows an improved rate; the before/after pass rate is recorded in `.vibecoding-state.md` (~85% guidance, not a hard gate).

**➡️ Next step.** Model the Domain + subdomains (Step 11, Discover UI) to add domain-scoping as an extra retrieval lever — you can re-run this loop afterward to capture the gain.',
'',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- =============================================================================
-- GENIE ACCELERATOR — Genie Ontology group (Batch 3, Steps 11-13) — order 70-72
-- Stub rows; authored bodies are synced from sections/7N-ontology_*.md via the
-- scoped per-id sync (source of truth = the .md files). Discover UI-preferred; Beta.
-- =============================================================================

-- Step 11 (Genie Accelerator · Genie Ontology): Model the Domain + Subdomains - bypass_llm=TRUE (Type B; UI-preferred, pre-created fallback; Beta)
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(70, 'ontology_domain',
'Model the **Genie Ontology** in Databricks Discover — a **domain** with 3–5 **subdomains**. This is **easiest in the UI**, so that''s the preferred method. If the workshop pre-created a domain, use it.

**Preferred — create it in the Discover UI (a few clicks):**

1. Navigate to **Catalog → Discover → New domain**.
2. Name the domain for `{use_case_title}` and add 3–5 subdomains covering your reporting areas.
3. Note the **domain ID** and **subdomain IDs** (later steps need the IDs, not the names).

> **If a domain is pre-created for the workshop, use it** — skip creation, just open it in Discover and capture its domain + subdomain IDs.

**Optional — Genie Code assist (fallback only; prefer the UI above):**

```
Read docs/design_prd.md and .vibecoding-state.md first — the domain scope follows the PRD.

If a domain called <domain> already exists, use it — just show me its domain and subdomain IDs.
Otherwise create a domain called <domain> with these subdomains: <subdomain_1>, <subdomain_2>,
<subdomain_3>, covering one sentence describing scope for {use_case_title}.

Either way, show me the domain and subdomain IDs and save them to .vibecoding-state.md.
```',
'',
'Model the Domain + Subdomains (Genie Accelerator)',
'Create (or reuse a pre-created) Discover domain with 3-5 subdomains in the UI, capture the domain and subdomain IDs — UI-preferred, with an optional Genie Code assist',
70,
'> **Artifact root (client-aware).** Resolve `<ARTIFACT_ROOT>` via `vibecoding-state.resolve_root` and write every artifact under it.

> **Beta + permissions.** Discover ontology (domains/Pages) is **Beta**. You need **Manage Discovery** permission on the domain. Pages currently ground **Genie One** answers (as citations); Genie Agent / Genie Code integration is on the roadmap. Skill: `data_product_accelerator/skills/semantic-layer/06-genie-discover-ontology`.

## 1️⃣ How To Apply

1. **Preferred:** in the Discover UI, create the domain + 3–5 subdomains (or open the pre-created workshop domain).
2. Capture the **domain ID** and **subdomain IDs** into `.vibecoding-state.md` — later steps route by ID.
3. Only if the UI isn''t available, use the optional Genie Code assist prompt above.

## 2️⃣ What Are We Building?

A **Discover domain** with 3–5 **subdomains** for `{use_case_title}` — the taxonomy that later Pages (Step 12) and the Routing Page (Step 13) hang off. No Pages are authored yet.

```mermaid
flowchart LR
  prd["PRD scope"] --> dom["Discover domain<br/>(UI · or pre-created)"]
  dom --> sub["3-5 subdomains"]
  sub --> ids["capture domain ID<br/>+ subdomain IDs → state"]
  ids --> pages["→ Pages (Step 12)"]
  ids --> routing["→ Routing Page (Step 13)"]
```

The Genie **Ontology** is the taxonomy layer of Databricks Discover — think of the domain as the folder and subdomains as its sections; Pages later fill it with business definitions.

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How it''s used here |
|----------|-------------------|
| **UI-preferred** | Domains/subdomains are a few clicks and easiest to see in Discover |
| **Reuse pre-created** | If the workshop ships a domain, everyone shares one clean taxonomy |
| **Capture IDs, not names** | Later steps (Pages, bulk import) route by internal ID — the #1 gotcha is passing a name |
| **Scope from the PRD** | The domain scope follows the PRD, not an invented taxonomy |

## 4️⃣ What Happens Behind the Scenes?

1. **Create or open (UI)** — you create the domain in **Catalog → Discover → New domain** (or open the pre-created workshop domain).
2. **Add subdomains** — 3–5 subdomains covering your reporting areas, scoped from the PRD.
3. **Capture the IDs** — you record the domain ID and each subdomain ID to `.vibecoding-state.md`; Genie Code can look these up but a human owns the clicks.
4. **Unlock downstream** — those IDs are what Steps 12–13 route by.

### Reference: Beta limits + the #1 gotcha

Discover ontology is **Beta** with **no public create/update API** for domains — the UI is the authoring surface, and you need **Manage Discovery** permission. Later steps route by internal **ID**, not name; passing a domain *name* where an *ID* is expected is the most common failure. Pages currently ground **Genie One** citations; Genie Agent/Code integration is on the roadmap. Skill: `data_product_accelerator/skills/semantic-layer/06-genie-discover-ontology`.',
'## Expected Deliverables

- A Discover domain with 3–5 subdomains (newly created or reused from the workshop)
- Domain ID + subdomain IDs captured to `.vibecoding-state.md`
- No Pages authored yet

**Sample — the taxonomy + IDs you capture:**

```
Domain: "Revenue Analytics"  (id: dom_a1b2c3…)
  ├─ Orders     (id: sub_11…)
  ├─ Returns    (id: sub_22…)
  └─ Customers  (id: sub_33…)
```',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 12 (Genie Accelerator · Genie Ontology): Author Pages - bypass_llm=TRUE (Type B/C; Discover UI Page editor, no public API; Beta)
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(71, 'ontology_pages',
'Author **Pages** — the business definitions for your top measures — in the **Discover UI Page editor**. There is no public create/update API, so Genie Code **drafts the fields** and you **publish**. Write every rule sentence to name its table/measure inside the sentence (Pages are chunked before they''re read).

**Navigate:** Discover → your `<domain>` → the `<subdomain>` → **New Page**. Then use Genie Code to draft the fields:

```
Read docs/genie_brief.md and .vibecoding-state.md first.

Create a Page in the <subdomain_1> subdomain of <domain> for the measure "<measure>".

Use docs/genie_brief.md (and any file I dropped in) as the source. The Page needs:
- A definition in plain business language, one paragraph
- The exact formula, naming the governed Metric View in
  {lakehouse_default_catalog}.{user_schema_prefix}_gold and the measure
- Synonyms covering every way someone might ask — acronym, informal phrasing, legacy name
- At least one negative rule (a "never do this")
- The governed Metric View as a related asset

Write every rule sentence so it names the table or measure inside the sentence itself — the Page is
split into chunks before it is read, so a sentence that leans on the title arrives orphaned. Show me
the draft before publishing. Then repeat for my second most important measure, and save the published
Page IDs to .vibecoding-state.md.
```

**Bulk import (optional — if you have a glossary you dropped in):**

```
I have an existing glossary (the file I dropped in). Import these as Pages into the domain with ID
<domain_id from Step 11>. Map each term to a Page with a definition, synonyms, and related assets.

Show me the first three before creating all of them.
```',
'',
'Author Pages (Genie Accelerator)',
'Draft Discover Pages for your top measures in the Page editor — plain-language definition, exact formula naming the Metric View, synonyms, at least one negative rule, chunk-safe sentences',
71,
'> **Artifact root (client-aware).** Resolve `<ARTIFACT_ROOT>` via `vibecoding-state.resolve_root` and write every artifact under it.

> **Beta + permissions.** Pages are **Beta** with **no public create/update API** — authored in the Discover UI editor; Genie Code drafts, a human publishes. Needs **Manage Discovery**. Bulk-import failures usually mean the domain **name** was passed where the internal **ID** is required. Skill: `data_product_accelerator/skills/semantic-layer/06-genie-discover-ontology`.

## 1️⃣ How To Apply

1. In Discover, open your `<domain>` → `<subdomain>` → **New Page**.
2. Paste the draft prompt into Genie Code; review the drafted fields; **publish** in the UI.
3. Repeat for your second measure. Save the published Page IDs to `.vibecoding-state.md`.

## 2️⃣ What Are We Building?

**Two published Pages**, one per top measure — each with a business-language definition, the exact formula naming the Metric View, a full synonym list, ≥1 negative rule, and the Metric View as a related asset.

```mermaid
flowchart LR
  brief["brief measure"] --> draft["GC drafts Page fields<br/>definition · formula(MV) · synonyms · ≥1 negative rule · related asset"]
  draft --> review["you review the draft"]
  review -->|"publish in UI"| page["published Page<br/>(grounds Genie One citations)"]
  page --> repeat["repeat for 2nd measure → save IDs"]
```

A **Page** is the business definition of one measure — the human-authored ground truth Genie One cites when it answers.

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How it''s used here |
|----------|-------------------|
| **Chunk-safe sentences** | Every rule names its table/measure inline, so a chunked sentence doesn''t arrive orphaned |
| **Formula anchored to the MV** | The Page points at the governed Metric View, not raw tables |
| **Full synonyms** | Acronym + informal + legacy phrasing so questions resolve |
| **≥1 negative rule** | A "never do this" prevents a common wrong answer |
| **Draft, then human-publish** | No public API — Genie Code drafts, you publish |

## 4️⃣ What Happens Behind the Scenes?

1. **Open the editor** — you navigate Discover → `<domain>` → `<subdomain>` → **New Page**.
2. **Draft the fields** — Genie Code drafts the definition, the exact formula naming the Metric View, the synonym list, ≥1 negative rule, and the MV as a related asset — all from the brief.
3. **Review + publish** — you review the draft and publish in the UI (Genie Code cannot create Pages headlessly).
4. **Repeat + record** — repeat for your second measure and save the published Page IDs to state.

### Reference: the chunk-safe rule

Pages are split into chunks before they''re read, so a sentence that leans on the Page title arrives orphaned. Write every rule to name its table/measure **inside the sentence** ("Never average Average Order Value across periods" — not "Never average it"). The skill (`06-genie-discover-ontology`) codifies this plus the ID-vs-name gotcha and what a good Page contains. Bulk-import failures usually mean a domain **name** was passed where the internal **ID** is required.',
'## Expected Deliverables

- Two published Pages, each: plain-language definition, exact formula naming the Metric View, synonym list (acronym/informal/legacy), ≥1 negative rule, MV as related asset
- Chunk-safe sentences; drafts reviewed before publishing
- Published Page IDs recorded to `.vibecoding-state.md`

**Sample — a drafted Page (before you publish):**

```markdown
# Net Revenue
Definition: revenue net of line-item discount, across all order lines.
Formula: MEASURE(net_revenue) on {lakehouse_default_catalog}.{user_schema_prefix}_gold.order_revenue_metrics
Synonyms: net sales, top line, revenue (net)
Negative rule: Net Revenue never includes tax; do not use o_totalprice for Net Revenue.
Related asset: order_revenue_metrics (Metric View)
```',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 13 (Genie Accelerator · Genie Ontology): Write the Routing Page - bypass_llm=TRUE (Type B; Discover UI Page editor, no public API; deck's highest-return exercise)
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(72, 'ontology_routing',
'Author the **Question → Metric View Routing Page** — the deck''s highest-return exercise. It maps how people phrase questions to the governed Metric View + measure that should answer them, replacing Genie''s table-inference with a lookup a person already got right. One Page covering **every** measure in the signed-off inventory.

**Navigate:** Discover → your `<domain>` → **New Page**. Then draft with Genie Code:

```
Read docs/genie_brief.md and .vibecoding-state.md first (use the domain ID saved in state).

Create a Page in <domain> called "Question to Metric View Routing".

Its purpose is to map the ways people ask questions to the governed Metric View and measure that
should answer them. For each measure in my signed-off inventory (docs/genie_brief.md), list four or
five phrasings — the formal name, the acronym, the informal phrasing, and any legacy name from an old
system — and route each to the governed Metric View in
{lakehouse_default_catalog}.{user_schema_prefix}_gold and the exact measure.

Format the mappings as a table. Add a short introduction saying this Page routes questions to
governed sources and should be checked before querying raw tables. Link the Metric View as a related
asset, name an owner, show me the draft before publishing, then record the Page ID + owner in
.vibecoding-state.md.
```',
'',
'Write the Routing Page (Genie Accelerator)',
'Author one Question→Metric View Routing Page in Discover mapping every inventory measure''s phrasings (formal, acronym, informal, legacy) to the governed Metric View + measure',
72,
'> **Artifact root (client-aware).** Resolve `<ARTIFACT_ROOT>` via `vibecoding-state.resolve_root` and write every artifact under it.

> **Beta + permissions.** Pages are **Beta** with **no public create/update API** — authored in the Discover UI editor; Genie Code drafts, a human publishes. Needs **Manage Discovery**. Skill: `data_product_accelerator/skills/semantic-layer/06-genie-discover-ontology`.

## 1️⃣ How To Apply

1. In Discover, open your `<domain>` → **New Page**.
2. Paste the draft prompt into Genie Code; review the phrasing→(Metric View, measure) table; name an owner; **publish**.
3. Save the Page ID + owner to `.vibecoding-state.md`.

## 2️⃣ What Are We Building?

One **Routing Page** covering every inventory measure: a flat table mapping four or five phrasings per measure (formal, acronym, informal, legacy) to the governed Metric View + exact measure, with a named owner.

```mermaid
flowchart LR
  inv["signed-off inventory"] --> tbl["phrasing → (Metric View, measure)<br/>formal · acronym · informal · legacy"]
  tbl --> review["review draft + name owner"]
  review -->|"publish in UI"| rp["Routing Page<br/>lookup beats inference"]
```

This is the deck''s **highest-return** exercise: it replaces Genie''s guess-the-table inference with a lookup a person already got right.

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How it''s used here |
|----------|-------------------|
| **Lookup beats inference** | A human-authored phrasing→source map replaces Genie''s table-inference — the deck''s highest-return move |
| **Every measure covered** | The Page spans the whole signed-off inventory, not a subset |
| **All the sloppy phrasings** | Acronyms and legacy names are included, since that''s how people actually ask |
| **Named owner** | Someone owns keeping the routing current |

## 4️⃣ What Happens Behind the Scenes?

1. **Open the editor** — you navigate Discover → `<domain>` → **New Page** (using the domain ID from state).
2. **Draft the table** — Genie Code drafts, for each inventory measure, 4–5 phrasings (formal, acronym, informal, legacy) each routed to the governed Metric View + exact measure.
3. **Add intro + owner** — a short intro says "check this before querying raw tables"; the MV is linked as a related asset; you name an owner.
4. **Review + publish** — you review the draft and publish in the UI, then record the Page ID + owner to state.

### Reference: why routing is the highest-return beat

Most Genie misses are *right answer, wrong source* — it inferred a raw table instead of the governed measure. A Routing Page turns that inference into a lookup, so "top line", "net sales", and "revenue" all resolve to the same governed measure. Pages ground **Genie One** citations. Skill: `06-genie-discover-ontology`.',
'## Expected Deliverables

- One published Routing Page ("Question to Metric View Routing") covering every inventory measure
- A flat phrasing→(Metric View, measure) table including acronyms and legacy phrasings
- A short intro + the Metric View linked as a related asset + a named owner
- Draft reviewed before publish; Page ID + owner recorded to `.vibecoding-state.md`

**Sample — the routing table you publish:**

| Phrasing | Metric View | Measure |
|---|---|---|
| revenue, net sales, top line, "sales $" | `order_revenue_metrics` | `net_revenue` |
| AOV, avg order value, spend per order | `order_revenue_metrics` | `average_order_value` |
| return rate, returns %, "% returned" | `order_revenue_metrics` | `return_rate` |',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- ontology_domain (genie-code fork) — Discover UI preferred + pre-created fallback + optional GC assist; bypass_LLM = TRUE
INSERT INTO ${catalog}.${schema}.section_input_prompts
(input_id, section_tag, coding_assistant, input_template, system_prompt,
 bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(936, 'ontology_domain', 'genie-code',
'Model the Genie Ontology — a Discover **domain** with 3–5 **subdomains**. This is **UI-first**: domains are a few clicks and easiest to see in Discover. If the workshop pre-created a domain, reuse it. Genie Code assists but a human owns the clicks (Discover has no public create/update API for this).

This will involve the following steps:

- **Prefer the UI** — Catalog → Discover → New domain; name it for `{use_case_title}`; add 3–5 subdomains.
- **Reuse if pre-created** — if the workshop shipped a domain, open it instead of creating one.
- **Capture the IDs** — record the domain ID + subdomain IDs (later steps route by ID, not name).

**Genie Code navigation:** open **Catalog → Discover**. Genie Code can look up an existing domain and read its IDs, but domain/subdomain creation is done in the UI. Needs **Manage Discovery** permission. Skill: `data_product_accelerator/skills/semantic-layer/06-genie-discover-ontology`.

Optional Genie Code assist (fallback only — prefer the UI):

```
Read docs/design_prd.md and .vibecoding-state.md first — the domain scope follows the PRD.

If a domain called <domain> already exists, use it — just show me its domain and subdomain IDs.
Otherwise create a domain called <domain> with these subdomains: <subdomain_1>, <subdomain_2>,
<subdomain_3>, covering one sentence describing scope for {use_case_title}.

Either way, show me the domain and subdomain IDs and save them to .vibecoding-state.md.
```

**State-lock:** append this step''s Per-Step Log entry, gate result, and the captured domain + subdomain IDs to `.vibecoding-state.md`, then re-read to confirm the write landed.

**Gate:** `Domain modeled` — a Discover domain with 3–5 subdomains exists (created in the UI or reused from the workshop); its domain ID + subdomain IDs are recorded in `.vibecoding-state.md`; no Pages authored yet.

**➡️ Next step.** Author Pages (Step 12) for your top measures in the Discover Page editor.',
'',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- ontology_pages (genie-code fork) — Discover UI Page editor (no public API); GC drafts, human publishes; chunk-safe; bypass_LLM = TRUE
INSERT INTO ${catalog}.${schema}.section_input_prompts
(input_id, section_tag, coding_assistant, input_template, system_prompt,
 bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(937, 'ontology_pages', 'genie-code',
'Author **Pages** — the business definitions for your top measures — in the Discover **Page editor**. There is no public create/update API, so Genie Code **drafts the fields inside the editor** and you **publish**. Every rule sentence must name its table/measure inline (Pages are chunked before they''re read).

This will involve the following steps:

- **Open the editor** — Discover → your `<domain>` → the `<subdomain>` → New Page.
- **Draft with Genie Code** — definition, formula naming the Metric View, synonyms, ≥1 negative rule, MV as related asset.
- **Review + publish** — check the draft in the UI, then publish; repeat for the second measure.
- **Record IDs** — save the published Page IDs to state.

**Genie Code navigation:** Genie Code drafts Page field contents inside the Discover editor — it does **not** create Pages headlessly (Beta, no API). Needs **Manage Discovery**. Bulk-import misses usually mean the domain **name** was passed where the internal **ID** is required. Skill: `data_product_accelerator/skills/semantic-layer/06-genie-discover-ontology`.

Paste this into Genie Code (inside the Page editor context):

```
Read docs/genie_brief.md and .vibecoding-state.md first.

Create a Page in the <subdomain_1> subdomain of <domain> for the measure "<measure>".

Use docs/genie_brief.md (and any file I dropped in) as the source. The Page needs:
- A definition in plain business language, one paragraph
- The exact formula, naming the governed Metric View in
  {lakehouse_default_catalog}.{user_schema_prefix}_gold and the measure
- Synonyms covering every way someone might ask — acronym, informal phrasing, legacy name
- At least one negative rule (a "never do this")
- The governed Metric View as a related asset

Write every rule sentence so it names the table or measure inside the sentence itself — the Page is
split into chunks before it is read, so a sentence that leans on the title arrives orphaned. Show me
the draft before publishing. Then repeat for my second most important measure, and save the published
Page IDs to .vibecoding-state.md.
```

Bulk import (optional — if you dropped in a glossary):

```
I have an existing glossary (the file I dropped in). Import these as Pages into the domain with ID
<domain_id from Step 11>. Map each term to a Page with a definition, synonyms, and related assets.
Show me the first three before creating all of them.
```

**State-lock:** append this step''s Per-Step Log entry, gate result, and the captured Page IDs to `.vibecoding-state.md`, then re-read to confirm the write landed.

**Gate:** `Pages published` — two published Pages, each with a business-language definition, the exact formula naming the Metric View, a full synonym list (acronym/informal/legacy), ≥1 negative rule, and the Metric View as a related asset; every rule sentence is chunk-safe; drafts were reviewed before publish; Page IDs recorded in `.vibecoding-state.md`.

**➡️ Next step.** Write the Question→Metric View Routing Page (Step 13) covering every inventory measure.',
'',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- ontology_routing (genie-code fork) — Discover UI Page editor (no public API); Question->MV routing table; bypass_LLM = TRUE
INSERT INTO ${catalog}.${schema}.section_input_prompts
(input_id, section_tag, coding_assistant, input_template, system_prompt,
 bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(938, 'ontology_routing', 'genie-code',
'Author the **Question → Metric View Routing Page** — the deck''s highest-return exercise. One Page mapping how people phrase questions to the governed Metric View + measure that answers them, covering **every** measure in the signed-off inventory. It replaces Genie''s table-inference with a lookup a person already got right.

This will involve the following steps:

- **Open the editor** — Discover → your `<domain>` → New Page, titled "Question to Metric View Routing".
- **Draft the table** — for each inventory measure, 4–5 phrasings (formal, acronym, informal, legacy) → the Metric View + exact measure.
- **Own it + publish** — add an intro, link the Metric View, name an owner, review the draft, publish.
- **Record** — save the Page ID + owner to state.

**Genie Code navigation:** Genie Code drafts the routing table inside the Discover Page editor (Beta, no public API — a human publishes). Uses the domain ID saved in Step 11. Needs **Manage Discovery**. Skill: `data_product_accelerator/skills/semantic-layer/06-genie-discover-ontology`.

Paste this into Genie Code (inside the Page editor context):

```
Read docs/genie_brief.md and .vibecoding-state.md first (use the domain ID saved in state).

Create a Page in <domain> called "Question to Metric View Routing".

Its purpose is to map the ways people ask questions to the governed Metric View and measure that
should answer them. For each measure in my signed-off inventory (docs/genie_brief.md), list four or
five phrasings — the formal name, the acronym, the informal phrasing, and any legacy name from an old
system — and route each to the governed Metric View in
{lakehouse_default_catalog}.{user_schema_prefix}_gold and the exact measure.

Format the mappings as a table. Add a short introduction saying this Page routes questions to
governed sources and should be checked before querying raw tables. Link the Metric View as a related
asset, name an owner, show me the draft before publishing, then record the Page ID + owner in
.vibecoding-state.md.
```

**State-lock:** append this step''s Per-Step Log entry, gate result, and the captured Page ID + owner to `.vibecoding-state.md`, then re-read to confirm the write landed.

**Gate:** `Routing Page published` — one published Routing Page covering every inventory measure as a flat phrasing→(Metric View, measure) table (including acronyms and legacy phrasings), with a short intro, the Metric View linked as a related asset, and a named owner; the draft was reviewed before publish; Page ID + owner recorded in `.vibecoding-state.md`.

**➡️ Next step.** Return to the Optimize loop (Step 10) to capture domain-scoping gains, or continue to Share (Step 14) and the optional Activation tail.',
'',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 15 (Genie Accelerator · Tail): Dashboard on the Metric View - bypass_llm=TRUE (Type C; LIGHT router to Genie Code's native AI/BI dashboard skill)
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(74, 'gaccel_dashboard',
'Build an AI/BI dashboard on your governed Metric View. This is a **light-touch** beat — Genie Code''s **built-in dashboard capability** is excellent, so lean on it directly rather than hand-authoring a bundle. Tiles read the Metric View via `MEASURE()`, not the raw tables.

Copy and paste this prompt to Genie Code:

```
Read docs/genie_brief.md and .vibecoding-state.md first.

Using your built-in AI/BI dashboard capability, create a dashboard for {use_case_title} built on the
governed Metric View in {lakehouse_default_catalog}.{user_schema_prefix}_gold (the one recorded in
.vibecoding-state.md).

Add a tile for each governed measure (via MEASURE()) sliced by the key dimensions in the brief. Show
me the tile plan first. Then create the dashboard, open it on the canvas so I can see it, give me the
link, and save the dashboard id to .vibecoding-state.md.
```',
'',
'Dashboard on the Metric View (Genie Accelerator)',
'Light-touch — have Genie Code use its native AI/BI dashboard capability to build a dashboard on the governed Metric View (MEASURE() tiles), no bundle scaffolding for this beat',
74,
'> **Artifact root (client-aware).** Resolve `<ARTIFACT_ROOT>` via `vibecoding-state.resolve_root` and write every artifact under it.

## 1️⃣ How To Apply

Copy the prompt, paste it into a Genie Code Agent chat, and press Enter. Review the tile plan, then let Genie Code create the dashboard and open it on the canvas. This beat is optional (the tail) — the productionize step (Step 17) is where a dashboard becomes a reproducible bundle asset, if you want that.

## 2️⃣ What Are We Building?

An **AI/BI dashboard** on the governed Metric View — one tile per measure (`MEASURE()`) sliced by the brief''s key dimensions — created with Genie Code''s native dashboard tooling and opened on the canvas.

```mermaid
flowchart LR
  mv["governed Metric View"] --> plan["tile plan<br/>(one per measure)"]
  plan --> create["create dashboard<br/>(Genie Code native skill)"]
  create --> canvas["open on canvas<br/>(author widgets)"]
  canvas --> link["share link + save id → state"]
```

Because the tiles read the **same** Metric View the agent uses, the dashboard and the Genie Agent always show matching numbers.

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How it''s used here |
|----------|-------------------|
| **Lean on Genie Code''s native dashboard skill** | It authors AI/BI dashboards better than a hand-rolled runbook — this section just routes to it |
| **MEASURE() over the MV** | Tiles read the governed Metric View, so the dashboard matches the agent''s numbers |
| **Canvas authoring** | Widget editing happens on the dashboard canvas (there is no reliable remote widget edit) |
| **Light-touch tail** | No bundle scaffolding here; productionizing is the optional Step 17 hand-off |

## 4️⃣ What Happens Behind the Scenes?

1. **Plan the tiles** — Genie Code reads the brief for the governed measures and key dimensions and shows a tile plan first.
2. **Create via the native skill** — it mints the dashboard with `createAsset(assetType:"dashboard")` — no bundle, no extract-back at this beat.
3. **Open on the canvas** — `openAsset` auto-navigates to the canvas where widgets are authored (there''s no reliable remote widget API), and it prints a clickable link.
4. **Save the id** — the dashboard id is recorded to `.vibecoding-state.md`.

### Reference: light-touch vs productionized

This beat is deliberately light — a live dashboard for exploration. If you later want it **reproducible**, Step 17 packages the extracted `.lvdash.json` into the Asset Bundle so it redeploys across targets. The heavy bundle/extract-back runbook lives there, not here.',
'## Expected Deliverables

- A live AI/BI dashboard for `{use_case_title}` on the governed Metric View
- One tile per governed measure (via `MEASURE()`), sliced by the brief''s key dimensions
- Tile plan reviewed before build; dashboard opened on the canvas; link shared
- Dashboard id saved to `.vibecoding-state.md`

**Sample — the tile plan you review before build:**

```
Dashboard: {use_case_title} — Revenue
  KPI    Net Revenue            MEASURE(net_revenue)
  KPI    Average Order Value    MEASURE(average_order_value)
  Line   Net Revenue by quarter MEASURE(net_revenue) x order_quarter
  Bar    Net Revenue by region  MEASURE(net_revenue) x region
  Filter order_year (default: latest)
```',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 16 (Genie Accelerator · Tail): Synced Tables -> Lakebase -> App - bypass_llm=TRUE (Type C; sync the underlying Gold dims+facts, NOT the Metric View, so the app is meaningful)
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(75, 'gaccel_activation',
'Stand up the **operational surface**: sync the Gold **tables** behind your Metric View into Lakebase, then an app to visualize them. The key point: a Metric View is a **view**, so it cannot be synced — you must sync the **dimension and fact tables it reads from**. Those base tables are what give the app real, meaningful rows (a synced Metric View would give you nothing).

Copy and paste this prompt to Genie Code:

```
Read docs/genie_brief.md, docs/design_prd.md and .vibecoding-state.md first.

1) List the Gold BASE TABLES behind my Metric View — the dimension and fact tables in
   {lakehouse_default_catalog}.{user_schema_prefix}_gold it reads from (use the ERD and the Metric
   View''s source). Do NOT try to sync the Metric View itself — synced tables require real tables with
   a primary key, and a view syncs nothing. Include every dimension + fact the app will need to be
   meaningful, not just one.

2) Spin up Lakebase (Autoscaling) if I don''t have it, then create a synced table for each of those
   base tables in dependency order (dimensions before facts), each with its primary key. Poll each to
   a healthy state and verify non-zero row counts. Reuse one shared pipeline; do not use CONTINUOUS.

3) Scaffold an AppKit app under its own <app_name>/ root, wire it to the synced Lakebase tables, and
   deploy it. Give me the app URL.

Save the synced schema, the synced table list, the Lakebase project, and the app URL to
.vibecoding-state.md.
```',
'',
'Synced Tables → Lakebase → App (Genie Accelerator)',
'Sync the Gold dimension + fact TABLES behind your Metric View into Lakebase (views can''t be synced), then stand up an AppKit app on those tables so the app has real, meaningful rows',
75,
'> **Artifact root (client-aware).** Resolve `<ARTIFACT_ROOT>` via `vibecoding-state.resolve_root` and write every artifact under it. Keep the app under its own `<app_name>/` root (see AGENTS.md artifact rules).

> **Reuses the workshop''s proven mechanics.** The synced-table REST contract, PK/CDF rules, pipeline bin-packing, and cost caps are the same as the workshop''s **Create Synced Tables** step (`activation_reverse_sync`) — this section just aims them at the Gold tables behind your Metric View. Skills: `databricks-lakebase` (synced tables, Autoscaling) and `apps_lakebase` (AppKit scaffold → wire → deploy).

## 1️⃣ How To Apply

1. Copy the prompt, paste it into a Genie Code Agent chat, and press Enter.
2. Confirm the **table list** Genie Code proposes covers the dims + facts your app needs — not just one table, and never the Metric View.
3. Let it create the synced tables (dims → facts), verify row counts, then scaffold + deploy the app.

## 2️⃣ What Are We Building?

**Synced tables** in Lakebase for every Gold dimension + fact behind the Metric View, plus an **AppKit app** wired to them. The app reads low-latency Postgres rows, so it shows real data — not an empty shell.

```mermaid
flowchart LR
  mv["Metric View<br/>(a VIEW — not syncable)"] --> base["resolve base tables<br/>dims + facts in _gold"]
  base --> sync["synced tables → Lakebase<br/>dims → facts · PK · healthy · rows verified"]
  sync --> app["AppKit app<br/>(real, low-latency rows)"]
  app --> url["app URL → state"]
```

The key move: you **cannot** sync the Metric View (it''s a view). You sync the **dimension + fact tables it reads from** — every one the app needs — which is what fills the app with meaningful data.

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How it''s used here |
|----------|-------------------|
| **Sync tables, not views** | Metric Views/TVFs are not syncable — the underlying dimension + fact tables are synced, which is what makes the app meaningful |
| **Enough tables** | Every dim + fact the app needs is synced, not just one, so joins and slices work in-app |
| **Dims before facts** | Dependency order so foreign-key targets land first |
| **Cost-capped** | One shared pipeline, no CONTINUOUS, Autoscaling endpoint — the workshop cost guardrails |
| **App under its own root** | The AppKit app lives in `<app_name>/`, per the artifact-placement rules |

## 4️⃣ What Happens Behind the Scenes?

1. **Resolve base tables** — Genie Code reads the Metric View''s source and the ERD to list every Gold dimension + fact it reads from (not the MV).
2. **Spin up Lakebase** — it provisions an Autoscaling project/endpoint if you don''t have one.
3. **Create synced tables** — one per base table via the Postgres synced-tables REST API, in dependency order (dims → facts), each with a primary key, sharing one pipeline (no CONTINUOUS).
4. **Poll + verify** — it polls each to a healthy state and confirms non-zero row counts.
5. **Scaffold + deploy the app** — it stands up an AppKit app under its own `<app_name>/` root, wires it to the synced schema, and deploys it, then records the synced schema, table list, Lakebase project, and app URL.

### Reference: synced-table caveats (reuses `activation_reverse_sync`)

Primary key required — **rows with a NULL in any PK column are silently excluded**, and **duplicate PKs fail the sync** unless a `timeseries_key` is set. Limits: ≤20 synced tables per source, 16 TB total logical data, one shared pipeline to avoid per-table pipeline cost. Write-time CDF is Delta-only; non-Delta sources sync as SNAPSHOT. Skills: `databricks-lakebase`, `apps_lakebase`.',
'## Expected Deliverables

- Synced tables in Lakebase for **every** Gold dimension + fact behind the Metric View (not the MV itself), healthy with non-zero row counts
- An AppKit app under its own `<app_name>/` root, wired to the synced tables and deployed
- Synced schema, synced table list, Lakebase project, and app URL saved to `.vibecoding-state.md`

**Sample — base tables resolved and synced (not the Metric View):**

```
Metric View: order_revenue_metrics  → reads from:
  dim_customer   PK c_custkey    → dim_customer_synced   (7,500 rows)   ✓ healthy
  dim_region     PK r_regionkey  → dim_region_synced     (5 rows)       ✓ healthy
  fact_lineitem  PK l_orderkey,l_linenumber → fact_lineitem_synced (30M rows) ✓ healthy
App: jane-d-revenue → https://jane-d-revenue.<workspace>   (reads dim_* + fact_* from Lakebase)
```',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 17 (Genie Accelerator · Tail): Productionize as a DAB - bypass_llm=TRUE (Type C; LIGHT hand-off to databricks-asset-bundles / deploy_di_assets)
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(76, 'gaccel_productionize',
'Optional, soft-recommended: package the track''s assets as a **Databricks Asset Bundle** so the whole thing redeploys reproducibly. This is a **light hand-off** — it reuses the workshop''s DAB skills and the existing "Deploy Semantic Layer Assets" flow. Keep the dev-files vs. prod-bundle boundary explicit.

Copy and paste this prompt to Genie Code:

```
Read .vibecoding-state.md first.

Package my Genie Accelerator assets as a Databricks Asset Bundle under my bundle root: the Metric
View definition, the Genie space serialized_space export, the AI/BI dashboard .lvdash.json, and the
synced-table specs. Extend the existing bundle if one already exists — do not create a second one.

Keep dev files vs the prod bundle boundary explicit. Show me the databricks.yml and resource files
before deploying. Then validate and deploy --target dev from the bundle-editor page, and record the
bundle deploy target + result to .vibecoding-state.md.
```',
'',
'Productionize as a Databricks Asset Bundle (Genie Accelerator)',
'Optional hand-off — package the Metric View, Genie space export, dashboard, and synced-table specs as a DAB so the whole track redeploys reproducibly; reuses the workshop''s bundle skills',
76,
'> **Artifact root (client-aware).** Resolve `<ARTIFACT_ROOT>` via `vibecoding-state.resolve_root` and write every artifact under it. The bundle lives under your `dp_bundle_root` (see AGENTS.md artifact rules).

> **Reuses the workshop''s DAB path.** The bundle mechanics (resources, jobs, `${var.user_prefix}` naming, `bundle validate/deploy --target dev` from the bundle-editor page) are the same as the workshop''s **Deploy Semantic Layer Assets** (`deploy_di_assets`) flow. Skill: `skills/databricks-asset-bundles`.

## 1️⃣ How To Apply

Copy the prompt, paste it into a Genie Code Agent chat, and press Enter. Review the `databricks.yml` + resource files, then let Genie Code validate and deploy from the bundle-editor page. This step is optional — skip it if you only needed the conversational build.

## 2️⃣ What Are We Building?

A **Databricks Asset Bundle** that packages the Metric View, Genie space export, dashboard, and synced-table specs so the whole track redeploys with `bundle deploy` — turning the conversational build into a reproducible, version-controlled artifact.

```mermaid
flowchart LR
  mv["Metric View"] --> bundle["Databricks Asset Bundle<br/>(extend existing — don''t fork)"]
  space["Genie space export"] --> bundle
  dash[".lvdash.json dashboard"] --> bundle
  sync["synced-table specs"] --> bundle
  bundle --> deploy["validate → deploy --target dev<br/>(from the bundle-editor page)"]
```

This is the bridge from a hand-built track to a **repeatable** one — the same assets, now deployable to any target by bundle alone.

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How it''s used here |
|----------|-------------------|
| **Reuse the DAB skill** | The bundle path is the workshop''s existing `deploy_di_assets` / `databricks-asset-bundles` flow — no new machinery |
| **Extend, don''t fork** | The assets extend the existing bundle rather than spawning a second one |
| **Dev vs prod boundary** | Dev files stay separate from the prod bundle so promotion is clean |
| **Optional** | The tail is soft-recommended; the conversational build stands on its own |

## 4️⃣ What Happens Behind the Scenes?

1. **Gather the assets** — Genie Code collects the Metric View definition, the Genie space `serialized_space` export, the dashboard `.lvdash.json`, and the synced-table specs.
2. **Write bundle resources** — it writes them under your `dp_bundle_root`, extending the existing `databricks.yml` rather than spawning a second bundle, keeping the dev-vs-prod boundary explicit.
3. **Review, then validate + deploy** — it shows the `databricks.yml` + resources; on your OK it runs `bundle validate` / `deploy --target dev` from the bundle-editor page, then records the target + result.

### Reference: the bundle-editor page rule

`bundle deploy` is pinned to the **bundle-editor page** of the bundle root. A `databricks.yml not found` or "blocked" message means you''re on the wrong page — open the bundle editor and retry. Never fall back to raw SQL or the Jobs/Pipelines REST API (`genie-code-environment` §3). Skill: `skills/databricks-asset-bundles`.',
'## Expected Deliverables

- A Databricks Asset Bundle (extending the existing one) packaging the Metric View, Genie space export, dashboard, and synced-table specs
- Dev-files vs. prod-bundle boundary kept explicit; `databricks.yml` + resources reviewed before deploy
- `bundle validate` passes and `deploy --target dev` succeeds from the bundle-editor page
- Bundle deploy target + result recorded to `.vibecoding-state.md`

**Sample — the bundle resources this step lands:**

```
{dp_bundle_root}/
  databricks.yml                         # extended (targets.dev)
  resources/
    metric_views/order_revenue_metrics.yml
    genie/revenue_space.yml              # serialized_space export
    dashboards/revenue.lvdash.json
    synced_tables/dims_facts.yml
# databricks bundle validate --target dev  → OK
# databricks bundle deploy   --target dev  → deployed
```',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- gaccel_dashboard (genie-code fork) — canvas navigation router; bypass_LLM = TRUE
-- gaccel_dashboard (genie-code fork) — LIGHT router to Genie Code's native AI/BI dashboard skill; canvas navigation only; bypass_LLM = TRUE
INSERT INTO ${catalog}.${schema}.section_input_prompts
(input_id, section_tag, coding_assistant, input_template, system_prompt,
 bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(940, 'gaccel_dashboard', 'genie-code',
'Build an AI/BI dashboard on the governed Metric View. This is a **light-touch** beat — use your **built-in dashboard capability** (it''s better than any hand-authored runbook); do not scaffold a bundle here.

This will involve the following steps:

- **Read state first** — `docs/genie_brief.md` + `.vibecoding-state.md` for the Metric View name and key dimensions.
- **Plan the tiles** — one per governed measure (`MEASURE()`), sliced by the brief''s dimensions; show the plan first.
- **Create + open on the canvas** — mint the dashboard, then navigate to the canvas to lay out widgets.

**Genie Code navigation:** create the dashboard with `createAsset(assetType:"dashboard")`, then `openAsset(assetType:"dashboard", assetId=<uuid>)` to auto-navigate to the **canvas** — widget editing has no reliable remote API, so authoring happens there. Print a clickable link (`{host}/dashboardsv3/{id}/edit?o={o}`) built with the pre-authenticated `w`. Tiles query the Metric View via `MEASURE()`, never the raw tables.

```
Read docs/genie_brief.md and .vibecoding-state.md first.

Using your built-in AI/BI dashboard capability, create a dashboard for {use_case_title} on the
governed Metric View in {lakehouse_default_catalog}.{user_schema_prefix}_gold. Add a tile per
governed measure (via MEASURE()) sliced by the key dimensions in the brief. Show me the tile plan
first, then create the dashboard, open it on the canvas, give me the link, and save the dashboard id
to .vibecoding-state.md.
```

**State-lock:** append this step''s Per-Step Log entry, gate result, and the captured dashboard id to `.vibecoding-state.md`, then re-read to confirm the write landed.

**Gate:** `Dashboard live` — an AI/BI dashboard on the governed Metric View exists; tiles use `MEASURE()` (not raw tables); the dashboard was opened on the canvas; the dashboard id is recorded in `.vibecoding-state.md`.

**➡️ Next step.** Stand up the operational surface (Step 16): sync the Gold tables to Lakebase and wire an app.',
'',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- gaccel_activation (genie-code fork) — synced tables (REST) + apps init --output-dir + SDK SNAPSHOT deploy; bypass_LLM = TRUE
-- gaccel_activation (genie-code fork) — sync Gold dims+facts (NOT the Metric View) to Lakebase, then AppKit app; apps init --output-dir + SDK SNAPSHOT deploy; bypass_LLM = TRUE
INSERT INTO ${catalog}.${schema}.section_input_prompts
(input_id, section_tag, coding_assistant, input_template, system_prompt,
 bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(941, 'gaccel_activation', 'genie-code',
'Stand up the operational surface: sync the Gold **tables** behind your Metric View into Lakebase, then an app on them. A Metric View is a **view** and cannot be synced — sync the **dimension + fact tables it reads from**. Those base tables are what give the app real rows.

This will involve the following steps:

- **Resolve the base tables** — list the Gold dims + facts in `{lakehouse_default_catalog}.{user_schema_prefix}_gold` the Metric View reads from (use the ERD / MV source). Include every dim + fact the app needs, not just one.
- **Sync to Lakebase** — Autoscaling; one synced table per base table, dims before facts, each with a PK; poll to healthy + verify non-zero rows; one shared pipeline; no CONTINUOUS.
- **Scaffold + deploy the app** — AppKit app under its own `<app_name>/` root, wired to the synced tables.

**Genie Code navigation:** create synced tables via the Postgres synced-tables REST API with `requests` + the bearer token from `databricks auth token` (see the workshop''s `activation_reverse_sync` contract — PK required; NULL/dup-PK caveats; pipeline bin-packing). For the app, `apps init` needs `--output-dir` (it ignores the page CWD), and the reliable deploy is the **SDK SNAPSHOT path** (`w.apps.deploy(…, mode=SNAPSHOT)`), not `apps deploy` via CLI (see `genie-code-environment` §4). Skills: `databricks-lakebase`, `apps_lakebase`.

```
Read docs/genie_brief.md, docs/design_prd.md and .vibecoding-state.md first.

1) List the Gold BASE TABLES behind my Metric View — the dims + facts in
   {lakehouse_default_catalog}.{user_schema_prefix}_gold it reads from. Do NOT sync the Metric View
   itself (a view syncs nothing); include every dim + fact the app needs.
2) Spin up Lakebase (Autoscaling) if needed, then create a synced table for each base table in
   dependency order (dims before facts), each with its PK. Poll each to healthy + verify non-zero
   row counts. One shared pipeline; no CONTINUOUS.
3) Scaffold an AppKit app under its own <app_name>/ root, wire it to the synced Lakebase tables, and
   deploy it (apps init --output-dir; SDK SNAPSHOT deploy). Give me the app URL.

Save the synced schema, synced table list, Lakebase project, and app URL to .vibecoding-state.md.
```

**State-lock:** append this step''s Per-Step Log entry, gate result, and the captured synced schema / synced tables / Lakebase project / app URL to `.vibecoding-state.md`, then re-read to confirm the write landed.

**Gate:** `Activation live` — synced tables exist in Lakebase for every Gold dim + fact behind the Metric View (not the MV), each healthy with non-zero rows; an AppKit app under its own `<app_name>/` root is wired to them and deployed; the synced schema, table list, Lakebase project, and app URL are recorded in `.vibecoding-state.md`.

**➡️ Next step.** Optionally productionize the whole track as a Databricks Asset Bundle (Step 17).',
'',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- gaccel_productionize (genie-code fork) — bundle-editor page navigation; bypass_LLM = TRUE
-- gaccel_productionize (genie-code fork) — LIGHT hand-off to databricks-asset-bundles; bundle-editor page navigation; bypass_LLM = TRUE
INSERT INTO ${catalog}.${schema}.section_input_prompts
(input_id, section_tag, coding_assistant, input_template, system_prompt,
 bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(942, 'gaccel_productionize', 'genie-code',
'Optional: package the track''s assets as a **Databricks Asset Bundle** so it redeploys reproducibly. This is a **light hand-off** — reuse the workshop''s bundle path; do not invent new machinery.

This will involve the following steps:

- **Gather the assets** — Metric View definition, Genie space `serialized_space` export, dashboard `.lvdash.json`, and synced-table specs.
- **Write bundle resources** — under your `dp_bundle_root`; extend the existing bundle, don''t fork a second one; keep dev vs prod boundary explicit.
- **Validate + deploy** — `bundle validate` / `deploy --target dev` from the bundle-editor page.

**Genie Code navigation:** `bundle deploy` is pinned to the **bundle-editor page** of the bundle root — write `databricks.yml` under the bundle root, open that folder''s bundle editor, then run `bundle validate` / `deploy --target dev` there. A `databricks.yml not found` or "blocked" message means you''re on the wrong page — open the bundle editor; never fall back to raw SQL or the Jobs/Pipelines REST API (`genie-code-environment` §3). Skill: `skills/databricks-asset-bundles`.

```
Read .vibecoding-state.md first.

Package my Genie Accelerator assets as a Databricks Asset Bundle under my bundle root: the Metric
View definition, the Genie space serialized_space export, the dashboard .lvdash.json, and the
synced-table specs. Extend the existing bundle if one exists. Keep dev files vs the prod bundle
boundary explicit. Show me the databricks.yml + resource files before deploying, then validate and
deploy --target dev from the bundle-editor page. Record the bundle deploy target + result to
.vibecoding-state.md.
```

**State-lock:** append this step''s Per-Step Log entry, gate result, and the captured bundle deploy target + result to `.vibecoding-state.md`, then re-read to confirm the write landed.

**Gate:** `Track productionized` — the Metric View, Genie space export, dashboard, and synced-table specs are packaged in the (extended) bundle; `bundle validate` passes and `deploy --target dev` succeeds from the bundle-editor page; the bundle deploy target + result are recorded in `.vibecoding-state.md`.

**➡️ Next step.** The Genie Accelerator track is complete — the whole build now redeploys from the bundle.',
'',
true, 1, true, current_timestamp(), current_timestamp(), current_user());
