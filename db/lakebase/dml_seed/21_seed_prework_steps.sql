-- =============================================================================
-- SEED DATA: DATA PRE-WORK STEPS (57-59)
-- =============================================================================
-- Adds the three steps that get an attendee a dataset matching the use case they just
-- defined, before anything is built on top of it.
--
-- Why this section exists at all. Today:
--   * Step 4 tells the agent "Use static mock data arrays directly in your components…
--     hardcoded", so the app demos on invented data.
--   * Step 7 tells the agent to "derive the specific tables, API routes, and seed data"
--     from the PRD, so the agent invents the schema AND its contents.
--   * A self-defined use case has no dataset of its own, so Chapter 3 reads whatever the
--     global default happens to be — the tourism sample.
-- In every case the coding assistant, not the attendee, decides what the data is. That
-- is the pattern this whole rework exists to remove.
--
-- Step kinds are deliberate:
--   57 decision - connect vs generate is a real fork with real consequences
--   58 decision - the grain of a fact table is the classic modelling judgement call
--   59 verify   - NOT composite. CompositePhases is for SEQUENTIAL phases ("all of them
--                 happen, in order"), but connect-existing and generate-synthetic are
--                 mutually exclusive — the attendee already chose one in step 57, and a
--                 composite would march everyone through both.
--
-- Idempotency contract:
--   * INSERT ... WHERE NOT EXISTS on section_tag, so re-running never duplicates a step
--     and an admin who edits the prompt keeps their text across every redeploy.
--   * The one UPDATE at the end is guarded on created_by='seed' AND the broken token
--     still being present, so it repairs a bad prompt at most once and never clobbers an
--     admin edit.
--
-- The setval below is load-bearing, not defensive. seed 02 inserts EXPLICIT input_id
-- values, which leaves the SERIAL sequence at 1 — and setup-lakebase.sh only resets
-- sequences on the fresh-install branch, never before POST_SEED_MIGRATIONS. Without
-- this, the INSERT collides with input_id=4 and fails with a duplicate-key error that
-- execute_sql_file(ignore_errors=True) swallows, so the steps silently never appear.
-- Verified by replaying the real DDL + seed chain on a throwaway Postgres.
--
-- Substitution: {industry_name}, {use_case_title}, {use_case_description} come from the
-- session. Values committed on an earlier decision step arrive via _decision_params,
-- named after the FIELD KEY itself — a field `fact_grain` is available downstream as
-- {fact_grain}, NOT {committed_fact_grain}. (The existing {committed_features} token
-- works only because that field is literally named `committed_features`.) Getting this
-- wrong leaks the raw placeholder into the prompt, which is what happened on the first
-- pass here and was caught by reading the served prompt rather than the seed.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

-- Move the SERIAL past the explicit ids seed 02 inserted, so the INSERTs below can
-- allocate one. Idempotent: setval to MAX+1 is a no-op once already correct.
SELECT setval(
  pg_get_serial_sequence('${schema}.section_input_prompts', 'input_id'),
  COALESCE((SELECT MAX(input_id) FROM ${schema}.section_input_prompts), 0) + 1,
  false
);

-- -----------------------------------------------------------------------------
-- Step 57 — Data source: do you have data, or do we make it?
-- -----------------------------------------------------------------------------
INSERT INTO ${schema}.section_input_prompts
(section_tag, section_title, section_description, input_template, system_prompt,
 order_number, how_to_apply, expected_output, bypass_llm, step_enabled, version,
 is_active, step_kind, gate_label, step_config, expert_answer, created_by)
SELECT
 'data_source_decision',
 'Data Source',
 'Decide whether to build on data you already have, or generate a dataset for your use case',
 'You are choosing the data foundation for **{use_case_title}** ({industry_name}).

## What this use case is

{use_case_description}

## Why this decision comes first

Everything downstream is built on this choice — the app''s screens, the Lakebase tables it
reads and writes, and the Bronze/Silver/Gold pipelines. If you skip it, your coding
assistant will invent a schema and fill it with mock rows, and you will spend the rest of
the workshop building on data nobody chose.

**Connect existing data** if you already have tables in Unity Catalog that represent this
use case. Real data beats generated data every time: real skew, real nulls, real
surprises.

**Generate a dataset** if you do not have data yet, cannot use it here, or want a clean
story to demonstrate. You will start from a pre-built industry data model rather than a
blank page, so the result is a governed model rather than a guess.',
 'You are a pragmatic data architect helping someone choose a data foundation for a workshop use case. Be brief and concrete.',
 57,
 'Make your call, then read the recommendation. Your choice decides which branch of the next steps you follow.',
 'A committed data source decision, and the one question your data has to answer.',
 TRUE, TRUE, 1, TRUE,
 'decision',
 'Data source decided',
 '{
   "widget": "freeform",
   "fields": [
     {"key": "data_source", "label": "Where is your data coming from?", "kind": "radio", "options": ["I have existing tables", "Generate a dataset for me"], "required": true,
      "hint": "Existing data is almost always better if you have it — generated data can only ever contain the patterns someone asked for."},
     {"key": "key_question", "label": "The one question this data must be able to answer", "kind": "text", "min_chars": 30, "required": true,
      "placeholder": "Which carriers breach delivery SLAs most often, and what does it cost us?",
      "hint": "Phrase it the way a business stakeholder would ask it. If your data cannot answer this, it is the wrong dataset."}
   ],
   "rubric": {"criteria": ["question_specificity", "source_fit"]}
 }'::jsonb,
 '**Prefer existing data whenever you genuinely have it — generated data can only contain the patterns someone thought to ask for.**

**If you have existing tables:** point at them and move on. Real data brings real skew, real nulls and real edge cases, and those are exactly what make the later Silver-layer data-quality decisions meaningful rather than theoretical. You only need a handful of tables, not your whole warehouse.

**If you are generating:** the value is in starting from a pre-built industry data model rather than inventing entities. You get conformant naming, sensible grain and real relationships — and, importantly, a dataset built around a *story* (something goes wrong, it costs money, you can trace why) instead of flat random rows. Flat data looks fine in a table and then has nothing to say when you point Genie at it.

**On your question:** the good ones name a metric and a dimension — "which X drives Y, and by how much". A question like "show me my data" cannot be answered wrongly, which means it cannot guide a model either. If your question needs a comparison over time or across a category, your data needs that column; check that now rather than after the pipeline is built.',
 'seed'
WHERE NOT EXISTS (
  SELECT 1 FROM ${schema}.section_input_prompts WHERE section_tag = 'data_source_decision'
);

-- -----------------------------------------------------------------------------
-- Step 58 — The minimum viable data model.
--
-- The grain of a fact table is the classic modelling judgement call: "one row per
-- order" and "one row per order line" differ by two words and by a factor of ten in
-- every measure computed from them. So this is a decision, and the reveal is generated
-- rather than static because a useful answer has to name the attendee's own entities.
-- -----------------------------------------------------------------------------
INSERT INTO ${schema}.section_input_prompts
(section_tag, section_title, section_description, input_template, system_prompt,
 order_number, how_to_apply, expected_output, bypass_llm, step_enabled, version,
 is_active, step_kind, gate_label, step_config, expert_system_prompt, created_by)
SELECT
 'data_model_design',
 'Data Model',
 'Commit the minimum viable model: the entities, the grain of your main fact, and the story the data has to tell',
 'You are designing the **minimum viable model** for **{use_case_title}** ({industry_name}).

## What this use case is

{use_case_description}

## The question your data must answer

{key_question}

## Start from a pre-built industry model, not a blank page

Databricks publishes governed data models for 41 industries at
`databricks-industry-solutions/lakehouse-industry-data-models`, under
`data-models/<industry>/v1/mvm/` — schemas, an ontology, metric views and an ERD, with
conformant naming and grain already decided. Find the closest industry to yours and use
it as your starting point rather than inventing entities from scratch.

**Minimum viable, not comprehensive.** These models ship in two tiers: MVM (the smallest
set that explains the business) and ECM (full breadth — for retail, 177 products versus
408). You want MVM. A handful of tables with the right grain will carry this entire
workshop; the full model would not fit in it.

## What you are committing to

Name the entities you actually need, state the grain of your main fact table in one
sentence, and name the one thing that goes *wrong* in your data. That last one matters
more than it sounds: data with no incident, spike or anomaly has nothing to investigate,
so it cannot demonstrate anything later when you point Genie or a dashboard at it.',
 'You are a senior data modeller reviewing a minimum viable model.',
 58,
 'Commit your model, then compare it against how the industry model handles the same problem.',
 'A committed set of entities, an explicit fact grain, and the anomaly your data will contain.',
 TRUE, TRUE, 1, TRUE,
 'decision',
 'Minimum viable data model committed',
 '{
   "widget": "freeform",
   "fields": [
     {"key": "entities", "label": "The entities your model needs", "kind": "list", "max_items": 6, "required": true,
      "placeholder": "deliveries|carriers|routes|customers",
      "hint": "One per line, business nouns rather than table names. Fewer is better: every entity you add is one you have to populate and join."},
     {"key": "fact_grain", "label": "One row in your main fact table represents...", "kind": "text", "min_chars": 30, "required": true,
      "placeholder": "one delivery attempt, per parcel, per carrier",
      "hint": "Name every dimension the grain is per. This is the single most consequential sentence here — get it wrong and every measure silently double-counts."},
     {"key": "story_anomaly", "label": "The one thing that goes wrong in this data", "kind": "text", "min_chars": 30, "required": true,
      "placeholder": "One carrier degrades badly in week 6, breaching SLA on 30% of parcels in two regions",
      "hint": "An incident, spike or trend with a cost attached. Flat, uniform data has no story and nothing to investigate."}
   ],
   "rubric": {"criteria": ["grain_precision", "entity_economy", "story_strength"]}
 }'::jsonb,
 'You are a senior data modeller reviewing a minimum viable model for a {industry_name} use case: {use_case_title}.

Open with ONE bolded sentence: is this model sound, too thin, or too broad for the question it has to answer?

Then, concisely:
1. Assess their fact grain. Name explicitly what a row is per, and say where you expect double-counting or fan-out if that grain is wrong. Quote their sentence.
2. For each entity they listed, say whether it earns its place given the question. Name anything essential they omitted — and anything that is future work rather than minimum viable.
3. Assess their anomaly. Does it have a measurable cost, and would it actually be visible at their grain? A story that cannot be seen in the data is not a story.
4. Name the closest published industry model from databricks-industry-solutions/lakehouse-industry-data-models and say in one line what it would do differently.

Use their own words and entity names. If their model is sound, say so plainly and briefly rather than inventing criticism. Output plain markdown, no preamble.',
 'seed'
WHERE NOT EXISTS (
  SELECT 1 FROM ${schema}.section_input_prompts WHERE section_tag = 'data_model_design'
);

-- -----------------------------------------------------------------------------
-- Step 59 — Provision the data.
--
-- NOT a composite step, despite the plan's first guess. CompositePhases is explicitly
-- for SEQUENTIAL phases ("all of them happen, in order" — CompositePhases.tsx), but
-- connect-existing and generate-synthetic are mutually EXCLUSIVE: the attendee committed
-- to one of them in step 57. A composite would march everyone through both.
--
-- So it is a `verify` step whose prompt covers both branches and tells the attendee which
-- one applies, with the real work done by their coding agent. The app cannot do it:
-- verification.py is read-only and auth is the App Service Principal with no OBO, so the
-- app can confirm tables exist but never create them. That division is deliberate — the
-- agent generates, the app specifies and verifies.
--
-- The generated branch invokes the databricks-synthetic-data-gen skill from
-- databricks/databricks-agent-skills, whose own rules (business story, no uniform
-- distributions, parents before children, catalog never defaulted) are restated here
-- because they are what make the data usable by Chapter 4 rather than merely present.
-- -----------------------------------------------------------------------------
INSERT INTO ${schema}.section_input_prompts
(section_tag, section_title, section_description, input_template, system_prompt,
 order_number, how_to_apply, expected_output, bypass_llm, step_enabled, version,
 is_active, step_kind, gate_label, step_config, created_by)
SELECT
 'data_provision',
 'Provision Data',
 'Connect your existing tables, or generate a governed synthetic dataset in your own catalog',
 'You are provisioning the data for **{use_case_title}** ({industry_name}).

Your committed choice was: **{data_source}**

Your model: entities `{entities}`, with one fact row being
{fact_grain}. The story the data must contain: {story_anomaly}.

---

## If you chose "I have existing tables"

Point the workshop at them. Set the source catalog and schema on Step 10 (there is an
inline editor on that step), then confirm:

1. The tables your model needs are all in one schema, and you can `SELECT` from them.
2. The grain matches what you committed to. If your fact table is per-order but you
   committed to per-order-line, fix one or the other now — not after the Gold layer.
3. You know which column joins them.

Nothing to generate. Mark this step done and carry on.

---

## If you chose "Generate a dataset for me"

Ask your coding assistant to run the **`databricks-synthetic-data-gen`** skill from
`databricks/databricks-agent-skills`. Give it exactly this brief:

```
Use the databricks-synthetic-data-gen skill to generate a dataset.

Target:    {user_catalog}.{user_schema_prefix}_raw     <- create the schema if needed
Rows:      about {synthetic_row_target} in the main fact table
Model:     start from the closest industry model in
           databricks-industry-solutions/lakehouse-industry-data-models
           (data-models/<industry>/v1/mvm/) and use its MVM tier, not ECM
Entities:  {entities}
Grain:     {fact_grain}
Story:     {story_anomaly}
           Give the incident a measurable cost, and make it visible at my grain.

Rules I care about:
- No uniform distributions. Skewed categories, log-normal amounts, 80/20 patterns.
- Write parent tables to Delta first, then children with valid foreign keys.
- Show me the plan before you generate anything.
```

**Prerequisites, worth checking before you start:** the skill runs Spark + Faker on
serverless via `databricks-connect`, so you need `serverless_compute_id = auto` in your
`~/.databrickscfg` and the local dependencies installed. If that is not set up, say so
rather than fighting it — you can connect an existing dataset instead and keep moving.

When the tables exist, tell the workshop where they are so every later step uses them:

```
report_gate("data_provision", "Dataset provisioned", "pass", captured={
  "chapter_3_lakehouse_catalog": "<your catalog>",
  "chapter_3_lakehouse_schema":  "<your schema>"
})
```

That single call is what points Step 10 and the whole Bronze/Silver/Gold chapter at your
data instead of the workshop default.',
 'You are a data engineer provisioning a dataset for a workshop use case.',
 59,
 'Follow the branch matching your Step 57 choice. The verification below confirms the tables really exist before you build on them.',
 'Tables in your own catalog that match your committed model, and the workshop pointed at them.',
 TRUE, TRUE, 1, TRUE,
 'verify',
 'Dataset provisioned',
 '{"check": "provisioned_tables_exist", "blocking": false, "escape_hatch_points_pct": 60}'::jsonb,
 'seed'
WHERE NOT EXISTS (
  SELECT 1 FROM ${schema}.section_input_prompts WHERE section_tag = 'data_provision'
);

-- -----------------------------------------------------------------------------
-- Repair: the first version of this seed used {committed_entities} and friends, but
-- _decision_params names tokens after the FIELD KEY, so those leaked into the prompt as
-- raw placeholders. The INSERTs above are guarded on section_tag and therefore cannot fix
-- a row that already exists, so patch the text in place.
--
-- Guarded on the broken token still being present AND created_by = 'seed', so this runs
-- at most once and never touches a prompt an admin has edited.
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET input_template = replace(
      replace(
        replace(
          replace(input_template, '{committed_entities}', '{entities}'),
          '{committed_fact_grain}', '{fact_grain}'),
        '{committed_story_anomaly}', '{story_anomaly}'),
      '{committed_data_source}', '{data_source}'),
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag IN ('data_model_design', 'data_provision')
  AND created_by = 'seed'
  AND input_template LIKE '%{committed_%';

UPDATE ${schema}.section_input_prompts
SET input_template = replace(input_template, '{committed_key_question}', '{key_question}'),
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'data_model_design'
  AND created_by = 'seed'
  AND input_template LIKE '%{committed_key_question}%';
