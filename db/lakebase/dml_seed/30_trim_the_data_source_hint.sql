-- =============================================================================
-- TRIM THE DATA-SOURCE HINT — SAY IT ONCE
-- =============================================================================
-- Seed 28 made connecting existing data the recommended default and stated what
-- generating costs. Reading it back as an attendee would, it says the same thing twice:
-- eight wrapped lines of hint under a two-option radio, and then the setup cost again in
-- the body text directly below it. A warning repeated in the same glance reads as
-- nagging, and nagging is skimmed.
--
-- The body paragraph is the right home for the cost -- it has room for the reasoning and
-- the attendee is already reading prose there. So the hint keeps only what a hint is for:
-- which option to pick and the one-line reason. Everything operational stays in the body,
-- where seed 28 already put it.
--
-- Nothing is lost. After this, the attendee still sees:
--   * hint  : connect is recommended, and why, in two sentences
--   * body  : the full "Before you pick this, know what it costs" paragraph
--   * reveal: the practical argument about a working local Spark setup
--
-- Idempotency: guarded on the long hint still being present, so it applies at most once
-- and a facilitator who has already reworded it keeps their text.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

UPDATE ${schema}.section_input_prompts
SET step_config = jsonb_set(
      step_config,
      '{fields,0,hint}',
      to_jsonb(
        'Connect existing data if you have any that fits — it is the recommended default, because generated data can only ever contain the patterns someone thought to ask for, while real data brings real skew and real surprises. A handful of tables is enough. Generating is the right answer if you have no usable data, but read the setup cost below before choosing it.'::text
      )
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'data_source_decision'
  AND is_active = TRUE
  AND step_kind = 'decision'
  AND step_config->'fields'->0->>'key' = 'data_source'
  AND position('but it needs a Python 3.12 environment'
              in coalesce(step_config->'fields'->0->>'hint', '')) > 0;
