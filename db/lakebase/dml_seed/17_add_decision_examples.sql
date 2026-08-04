-- =============================================================================
-- ADD WORKED EXAMPLES TO DECISION FIELDS (PostgreSQL/Lakebase)
-- =============================================================================
-- Bug this fixes: a decision step asked for "Three data-quality expectations worth
-- enforcing" and rendered three empty boxes labelled 1., 2., 3. — no examples, no
-- indication of the expected shape. The attendee's reaction was "what am I supposed to
-- put here?", which is the whole mechanism failing: a field nobody can answer produces
-- a guess, not a decision.
--
-- Only 5 of 35 decision fields carried an example. This rewrites the `fields` array for
-- the steps where the label alone cannot convey the shape of a good answer, adding a
-- per-row `placeholder` (the list widget splits it on `|`, one example per box) and a
-- `hint` line where the judgement itself needs framing.
--
-- Written as whole-array replacements rather than a PL/pgSQL helper on purpose: the
-- seed runner's statement splitter tracks single-quoted strings but has no
-- dollar-quoting support, so a `$$ ... $$` function body would be split mid-statement.
--
-- Every UPDATE is guarded on the placeholder being absent, so re-running is a no-op.
-- Field keys, kinds, min_chars and max_items are preserved exactly — only help text is
-- added — so nothing downstream (substitution, rubrics, radio_per_row pairing) changes.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 13 — Silver layer data quality. The field the attendee got stuck on.
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET step_config = jsonb_set(step_config, '{fields}', '[
      {"key": "dq_expectations", "label": "Three data-quality expectations worth enforcing", "kind": "list", "max_items": 3, "required": true,
       "placeholder": "order_id is not null|customer_id exists in customers|order_total >= 0",
       "hint": "Write each as a condition a row must satisfy, using your own column names. Pick rules that would change a decision if broken — not ones that are merely easy to write."},
      {"key": "dq_enforcement", "label": "For each: drop the row, or quarantine it for review?", "kind": "radio_per_row", "options": ["Drop", "Quarantine"], "required": true,
       "hint": "Drop when a row is unambiguously junk. Quarantine when it represents something real you cannot yet interpret — dropping those makes revenue quietly disappear."},
      {"key": "dq_rationale", "label": "Which of these would you be most upset to discover was silently violated, and why?", "kind": "text", "min_chars": 30, "required": true,
       "hint": "Think about which violation would quietly corrupt a number someone reports upward."}
    ]'::jsonb),
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'silver_layer_sdp'
  AND is_active = TRUE
  AND step_kind = 'decision'
  AND step_config->'fields' @> '[{"key": "dq_expectations"}]'
  AND NOT step_config->'fields' @> '[{"key": "dq_expectations", "placeholder": "order_id is not null|customer_id exists in customers|order_total >= 0"}]';

-- -----------------------------------------------------------------------------
-- Step 3 — PRD scope
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET step_config = jsonb_set(step_config, '{fields}', '[
      {"key": "committed_features", "label": "The 3 features v1 must ship (ranked)", "kind": "list", "max_items": 3, "required": true,
       "placeholder": "Regional performance comparison|Category trend view|Promotion lift tracker",
       "hint": "One capability per line, phrased as something a user can do. Line 1 is what you would ship if you could only ship one."},
      {"key": "success_metric", "label": "The one metric that proves this worked", "kind": "text", "min_chars": 40, "required": true,
       "placeholder": "Field reps change their call plan at least once a week based on the app",
       "hint": "Something someone could measure next month — not a restatement of the feature list."}
    ]'::jsonb),
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'prd_generation'
  AND is_active = TRUE
  AND step_kind = 'decision'
  AND step_config->'fields' @> '[{"key": "committed_features"}]'
  AND NOT step_config->'fields' @> '[{"key": "committed_features", "placeholder": "Regional performance comparison|Category trend view|Promotion lift tracker"}]';

-- -----------------------------------------------------------------------------
-- Step 10 — source scope and join key
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET step_config = jsonb_set(step_config, '{fields}', '[
      {"key": "in_scope_tables", "label": "Source tables in scope for this use case", "kind": "list", "required": true,
       "placeholder": "orders|products|locations",
       "hint": "Only tables that feed the metric you committed to in Step 3. Anything else is future work."},
      {"key": "join_key", "label": "The column that joins them", "kind": "text", "min_chars": 3, "required": true,
       "placeholder": "order_id",
       "hint": "The single column these tables join on. If they genuinely need different keys, say so — that is a real finding, not a wrong answer."}
    ]'::jsonb),
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'bronze_table_metadata'
  AND is_active = TRUE
  AND step_kind = 'decision'
  AND step_config->'fields' @> '[{"key": "in_scope_tables"}]'
  AND NOT step_config->'fields' @> '[{"key": "join_key", "placeholder": "order_id"}]';

-- -----------------------------------------------------------------------------
-- Step 11 — Gold grain and SCD strategy
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET step_config = jsonb_set(step_config, '{fields}', '[
      {"key": "fact_grain", "label": "One row in your fact table represents...", "kind": "text", "min_chars": 30, "required": true,
       "placeholder": "one row per order line per day",
       "hint": "Name every dimension the grain is per. Getting this wrong is what silently double-counts a measure."},
      {"key": "scd_decisions", "label": "For each dimension: Type 1 (overwrite) or Type 2 (keep history)?", "kind": "radio_per_row", "options": ["Type 1", "Type 2"], "required": true,
       "hint": "Type 2 only where a change in the attribute would change a past decision."}
    ]'::jsonb),
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'gold_layer_design'
  AND is_active = TRUE
  AND step_kind = 'decision'
  AND step_config->'fields' @> '[{"key": "fact_grain"}]'
  AND NOT step_config->'fields' @> '[{"key": "fact_grain", "placeholder": "one row per order line per day"}]';

-- -----------------------------------------------------------------------------
-- Step 6 — OLTP vs analytical split
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET step_config = jsonb_set(step_config, '{fields}', '[
      {"key": "oltp_entities", "label": "Entities that belong in Lakebase (row-at-a-time reads and writes from the app)", "kind": "list", "max_items": 5, "required": true,
       "placeholder": "bookings|user_preferences|request_status",
       "hint": "Things the app reads or writes one row at a time while a user waits."},
      {"key": "analytical_entities", "label": "Entities that belong in the lakehouse (scanned and aggregated, not served per row)", "kind": "list", "max_items": 5, "required": true,
       "placeholder": "order_history|daily_revenue|category_trends",
       "hint": "Things that get scanned and aggregated — history, trends, anything feeding a dashboard or Genie."},
      {"key": "oltp_rationale", "label": "Why that split — what access pattern decided it?", "kind": "text", "min_chars": 30, "required": true,
       "placeholder": "A user waits on a single booking row; revenue trends are only ever scanned in bulk"}
    ]'::jsonb),
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'setup_lakebase'
  AND is_active = TRUE
  AND step_kind = 'decision'
  AND step_config->'fields' @> '[{"key": "oltp_entities"}]'
  AND NOT step_config->'fields' @> '[{"key": "oltp_entities", "placeholder": "bookings|user_preferences|request_status"}]';

-- -----------------------------------------------------------------------------
-- Step 17 — Genie scope
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET step_config = jsonb_set(step_config, '{fields}', '[
      {"key": "genie_questions", "label": "Three questions Genie must answer correctly", "kind": "list", "max_items": 3, "required": true,
       "placeholder": "Which regions grew fastest last quarter?|Which categories are declining?|What was revenue by store last month?",
       "hint": "Phrase them the way a business user would type them — not as SQL."},
      {"key": "genie_refusal", "label": "One question it should refuse rather than guess at", "kind": "text", "min_chars": 25, "required": true,
       "placeholder": "Why did sales drop in the north region?",
       "hint": "Pick something that LOOKS answerable from the schema but is not — a causal question, or one whose grain would double-count."}
    ]'::jsonb),
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'genie_space'
  AND is_active = TRUE
  AND step_kind = 'decision'
  AND step_config->'fields' @> '[{"key": "genie_questions"}]'
  AND NOT step_config->'fields' @> '[{"key": "genie_refusal", "placeholder": "Why did sales drop in the north region?"}]';

-- -----------------------------------------------------------------------------
-- Step 4 — UI focus
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET step_config = jsonb_set(step_config, '{fields}', '[
      {"key": "primary_screen", "label": "The one screen this app is judged on", "kind": "text", "min_chars": 15, "required": true,
       "placeholder": "Regional performance dashboard"},
      {"key": "primary_action", "label": "The single action that must be one click away", "kind": "text", "min_chars": 10, "required": true,
       "placeholder": "Filter to my region",
       "hint": "If it needs more than one click from the landing screen, the screen is probably wrong."},
      {"key": "nav_shape", "label": "Navigation shape", "kind": "radio", "options": ["Single page", "Tabs", "Sidebar"], "required": true,
       "hint": "Single page suits one primary workflow and is fastest to build well. Anything more needs justifying."}
    ]'::jsonb),
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'cursor_copilot_ui_design'
  AND is_active = TRUE
  AND step_kind = 'decision'
  AND step_config->'fields' @> '[{"key": "primary_screen"}]'
  AND NOT step_config->'fields' @> '[{"key": "primary_screen", "placeholder": "Regional performance dashboard"}]';
