-- =============================================================================
-- CUT THE ARGUMENT OUT OF THE DATA-SOURCE HINT
-- =============================================================================
-- The hint still carried the reasoning for the recommendation — "because generated data
-- can only ever contain the patterns someone thought to ask for, while real data brings
-- real skew and real surprises". That is a fair point and the wrong place for it: a hint
-- under a radio should say which option to pick, not argue the case. The reasoning now
-- lives in the reveal, where the attendee has already chosen and is reading prose.
--
-- Leaves the hint at three short sentences: the recommendation, the scope ("a handful of
-- tables"), and when generating is right plus where to read its cost.
--
-- Idempotency: guarded on the clause still being present.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

UPDATE ${schema}.section_input_prompts
SET step_config = jsonb_set(
      step_config,
      '{fields,0,hint}',
      to_jsonb(
        'Connect existing data if you have any that fits — it is the recommended default. A handful of tables is enough. Generating is the right answer if you have no usable data, but read the setup cost below before choosing it.'::text
      )
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'data_source_decision'
  AND is_active = TRUE
  AND step_kind = 'decision'
  AND step_config->'fields'->0->>'key' = 'data_source'
  AND position('because generated data can only ever contain the patterns'
              in coalesce(step_config->'fields'->0->>'hint', '')) > 0;
