-- =============================================================================
-- MAKE CONNECTING EXISTING DATA THE DEFAULT, NOT MERELY THE ADVICE
-- =============================================================================
-- Step 57 already hinted that existing data is better. This makes the recommendation
-- explicit and honest about cost, because the generate branch turned out to need
-- materially more setup than the prompt implied: a separate Python 3.12 environment, a
-- pinned databricks-connect, and shipping faker to the serverless executors. Each fails
-- somewhere other than its cause -- plain SQL over databricks-connect works on 3.11, so
-- a connectivity test passes and the run only dies once a Faker UDF executes.
--
-- Found by getting the branch actually working against a real workspace, not by reading
-- the skill. Having done the setup, it is not something to put a live room through: a
-- participant who picks "generate" without the prerequisites loses the part of the
-- session where they would otherwise be building.
--
-- What this does NOT do, deliberately:
--   * It does not remove the generate option. Some attendees have no usable data, and
--     for them generation is the whole point of the pre-work section. Removing the
--     choice would also make step 57 a question with one answer, which is not a
--     decision.
--   * It does not change the OPTION STRINGS. Step 59's headings switch on the literal
--     text ("## If you chose \"I have existing tables\"") and committed decisions are
--     already stored against those exact strings, so rewording them would orphan every
--     session saved so far and break the branch headings.
--
-- Instead it relabels the choice so the trade-off is visible at the moment of choosing,
-- and states the setup cost in the hint rather than three steps later.
--
-- Idempotency: guarded on the old hint text still being present. Re-running is a no-op
-- and a facilitator who rewords the hint keeps their text.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 57 — say which branch is recommended, and what the other one costs
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET step_config = jsonb_set(
      step_config,
      '{fields,0,hint}',
      to_jsonb(
        'Connecting existing data is the recommended default, and not only on principle: generated data can only ever contain the patterns someone thought to ask for, while real data brings real skew, real nulls and real surprises — which is what makes the later data-quality decisions genuine rather than theoretical. You only need a handful of tables, not your whole warehouse. Generating is the right answer if you have no usable data, but it needs a Python 3.12 environment, a pinned databricks-connect and serverless compute configured BEFORE the session (see docs/synthetic_data_setup.md). If that is not already set up, connect existing data and keep moving.'::text
      )
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'data_source_decision'
  AND is_active = TRUE
  AND step_kind = 'decision'
  AND step_config->'fields'->0->>'key' = 'data_source'
  AND position('generated data can only ever contain the patterns someone asked for'
              in coalesce(step_config->'fields'->0->>'hint', '')) > 0;

-- -----------------------------------------------------------------------------
-- Step 57 — the body text: lead with the recommendation
-- -----------------------------------------------------------------------------
-- The old paragraph presented the two branches even-handedly and put the generate
-- prerequisites nowhere. Attendees decide from this text, so the cost belongs here.
UPDATE ${schema}.section_input_prompts
SET input_template = replace(
      input_template,
      '**Generate a dataset** if you do not have data yet, cannot use it here, or want a clean
story to demonstrate. You will start from a pre-built industry data model rather than a
blank page, so the result is a governed model rather than a guess.',
      '**Generate a dataset** if you do not have data yet, cannot use it here, or want a clean
story to demonstrate. You will start from a pre-built industry data model rather than a
blank page, so the result is a governed model rather than a guess.

**Before you pick this, know what it costs.** Generation runs Spark and Faker on
serverless compute from your own machine, which needs a Python 3.12 environment, a
pinned `databricks-connect` and serverless enabled on your profile — set up *before* the
session, not during it (`docs/synthetic_data_setup.md`). Every one of those fails in a
way that points somewhere other than its cause, so it is not a five-minute detour. If it
is not already working, connect existing data instead: you will spend the session
building rather than debugging a local Python environment.'
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'data_source_decision'
  AND is_active = TRUE
  AND position('so the result is a governed model rather than a guess.' in input_template) > 0
  AND position('Before you pick this, know what it costs' in input_template) = 0;

-- -----------------------------------------------------------------------------
-- Step 57 — the reveal should back the recommendation with a reason
-- -----------------------------------------------------------------------------
-- The static expert_answer already argues for existing data. Add the operational point,
-- which is the one that actually decides it in a workshop.
UPDATE ${schema}.section_input_prompts
SET expert_answer = expert_answer || '

**One practical note that decides this more often than the principle does.** The generate
branch needs a working local Spark setup — a Python 3.12 environment matching serverless,
a pinned `databricks-connect`, and the Faker package shipped to the executors rather than
merely installed on your laptop. If that is not already set up and proven, connect
existing data. Real data is the better teacher anyway, and the time you would spend on a
local environment is time not spent building.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'data_source_decision'
  AND is_active = TRUE
  AND expert_answer IS NOT NULL
  AND position('One practical note that decides this' in expert_answer) = 0;
