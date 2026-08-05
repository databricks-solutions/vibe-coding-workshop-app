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
--   57 decision  - connect vs generate is a real fork with real consequences
--   58 decision  - the grain of a fact table is the classic modelling judgement call
--   59 composite - two branches of one activity behind one Done (see CompositeStep.tsx)
--
-- Idempotency contract:
--   * INSERT ... WHERE NOT EXISTS on section_tag, so re-running never duplicates a step
--     and an admin who edits the prompt keeps their text across every redeploy.
--   * No UPDATE of existing rows, so this is safe in POST_SEED_MIGRATIONS.
--
-- The setval below is load-bearing, not defensive. seed 02 inserts EXPLICIT input_id
-- values, which leaves the SERIAL sequence at 1 — and setup-lakebase.sh only resets
-- sequences on the fresh-install branch, never before POST_SEED_MIGRATIONS. Without
-- this, the INSERT collides with input_id=4 and fails with a duplicate-key error that
-- execute_sql_file(ignore_errors=True) swallows, so the steps silently never appear.
-- Verified by replaying the real DDL + seed chain on a throwaway Postgres.
--
-- Substitution: {industry_name}, {use_case_title}, {use_case_description} come from the
-- session; {committed_*} tokens come from earlier decisions via _decision_params.
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
