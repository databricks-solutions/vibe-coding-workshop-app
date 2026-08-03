-- =============================================================================
-- SEED STEP KINDS (PostgreSQL/Lakebase) - IDEMPOTENT
-- =============================================================================
-- Promotes selected steps from 'instant_prompt' to 'decision' or 'verify'.
--
-- Why UPDATE rather than editing 02_seed_section_input_prompts.sql:
-- the seeder runs with ignore_errors=True, so an INSERT whose primary key already
-- exists is silently skipped. Editing seed 02 therefore has NO effect on any
-- existing install — it only changes fresh ones. UPDATE works on both.
--
-- Every statement is guarded by `WHERE step_kind = 'instant_prompt'` so an admin who
-- has since changed a step's kind through the Configuration page is never clobbered
-- when this file is re-run on redeploy.
--
-- Decision steps (commit-before-reveal): the attendee has to make the real call
-- before the coding assistant acts, and their committed values are substituted into
-- the prompt so the agent implements THEIR design. Chosen because a competent
-- practitioner would genuinely pause at each of these; mechanical deploy steps get
-- verification gates instead, and read/explore steps are left alone.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Step 3 — PRD Generation
-- Reach: every attendee on every path. Today the PRD is generated without the
-- attendee ever saying what the product should do.
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET step_kind = 'decision',
    gate_label = 'PRD scope committed',
    step_config = '{
      "widget": "freeform",
      "min_chars": 40,
      "fields": [
        {"key": "committed_features", "label": "The 3 features v1 must ship (ranked)", "kind": "list", "max_items": 3, "required": true},
        {"key": "success_metric", "label": "The one metric that proves this worked", "kind": "text", "min_chars": 40, "required": true}
      ],
      "rubric": {"criteria": ["specificity", "measurability", "scope_discipline"]}
    }'::jsonb,
    expert_system_prompt = 'You are a pragmatic product lead reviewing a v1 scope for a {industry_name} application focused on {use_case_title}.

Given the use case below, state:
1. The three highest-leverage features for v1, ranked, one line each.
2. The single success metric that would prove the product works, phrased so it is measurable.
3. One feature teams commonly add here that should be cut from v1, and why.

Be concrete and opinionated. Do not hedge, do not list more than three features, and do not describe implementation. Output plain markdown, no preamble.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'prd_generation'
  AND is_active = TRUE
  AND step_kind = 'instant_prompt';

-- -----------------------------------------------------------------------------
-- Step 4 — UI Design
-- Reach: every attendee. Forces a focus decision before any UI is scaffolded.
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET step_kind = 'decision',
    gate_label = 'Primary screen and navigation committed',
    step_config = '{
      "widget": "choice_set",
      "fields": [
        {"key": "primary_screen", "label": "The one screen this app is judged on", "kind": "text", "min_chars": 15, "required": true},
        {"key": "primary_action", "label": "The single action that must be one click away", "kind": "text", "min_chars": 10, "required": true},
        {"key": "nav_shape", "label": "Navigation shape", "kind": "radio", "options": ["Single page", "Tabs", "Sidebar"], "required": true}
      ],
      "rubric": {"criteria": ["focus", "action_clarity"]}
    }'::jsonb,
    expert_answer = 'A strong answer names ONE screen, not a set of them, and one action a user could perform without reading a manual.

**Navigation, in practice:**
- **Single page** — one primary workflow. Almost always right for a workshop-scale app, and the fastest to build well.
- **Tabs** — two to four peer views of the same data. Adds cost; justify it.
- **Sidebar** — five or more distinct areas. At workshop scale this usually signals unfocused scope rather than a genuinely large app.

If the primary action needs more than one click from the landing screen, the screen is probably wrong.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'cursor_copilot_ui_design'
  AND is_active = TRUE
  AND step_kind = 'instant_prompt';

-- -----------------------------------------------------------------------------
-- Step 10 — Table Metadata
-- The reveal runs a real information_schema count, so an over-broad scope is
-- visibly over-broad.
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET step_kind = 'decision',
    gate_label = 'Source scope and join key committed',
    step_config = '{
      "widget": "freeform",
      "fields": [
        {"key": "in_scope_tables", "label": "Source tables in scope for this use case", "kind": "list", "required": true},
        {"key": "join_key", "label": "The column that joins them", "kind": "text", "min_chars": 3, "required": true}
      ],
      "rubric": {"criteria": ["scope_discipline", "key_correctness"]},
      "reveal_check": "source_schema_counts"
    }'::jsonb,
    expert_answer = 'Scope is a judgement call, and the usual error is taking everything.

Include a table only if it feeds the metric committed in Step 3. A table with no path to that metric is future work, not v1 scope. If a chosen join key is nullable or is not unique in at least one table, expect fan-out in the Silver layer — check before proceeding.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'bronze_table_metadata'
  AND is_active = TRUE
  AND step_kind = 'instant_prompt';

-- -----------------------------------------------------------------------------
-- Step 11 — Gold Layer Design
-- The genuinely hard modelling call, today outsourced entirely to a skill.
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET step_kind = 'decision',
    gate_label = 'Fact grain and SCD strategy committed',
    step_config = '{
      "widget": "freeform",
      "fields": [
        {"key": "fact_grain", "label": "One row in your primary fact table represents...", "kind": "text", "min_chars": 30, "required": true, "placeholder": "one row per booking per night"},
        {"key": "scd_decisions", "label": "For each dimension: Type 1 (overwrite) or Type 2 (keep history)?", "kind": "radio_per_row", "options": ["Type 1", "Type 2"], "required": true}
      ],
      "rubric": {"criteria": ["grain_precision", "scd_justification", "fk_coverage"]}
    }'::jsonb,
    expert_system_prompt = 'You are a senior data modeller reviewing a Gold layer design for a {industry_name} use case: {use_case_title}.

From the source metadata provided below, state:
1. The correct grain of the primary fact table, as a single "one row per ..." sentence. Be precise: name every dimension the grain is per.
2. For each dimension table, Type 1 or Type 2, with a one-line reason tied to whether history changes decisions.
3. Any dimension where the wrong grain would silently double-count a measure.

Ground every statement in the actual tables and columns given. Do not invent tables. Output plain markdown, no preamble.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'gold_layer_design'
  AND is_active = TRUE
  AND step_kind = 'instant_prompt';

-- -----------------------------------------------------------------------------
-- Verification gates
-- Only steps producing a durable, named workspace artifact the App SP can see.
-- `blocking` stays false everywhere: gates ship advisory so a permission gap or a
-- slow control plane can never stop a live workshop.
-- -----------------------------------------------------------------------------
UPDATE ${schema}.section_input_prompts
SET step_kind = 'verify',
    gate_label = 'App deployed and running',
    step_config = '{"check": "app_running", "blocking": false, "escape_hatch_points_pct": 60}'::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag IN (
        'deploy_databricks_app',
        'workspace_setup_deploy',
        'redeploy_test',
        'activation_deploy_validate'
      )
  AND is_active = TRUE
  AND step_kind = 'instant_prompt';

UPDATE ${schema}.section_input_prompts
SET step_kind = 'verify',
    gate_label = 'Lakebase project reachable',
    step_config = '{"check": "lakebase_project_exists", "blocking": false, "escape_hatch_points_pct": 60}'::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'setup_lakebase'
  AND is_active = TRUE
  AND step_kind = 'instant_prompt';

UPDATE ${schema}.section_input_prompts
SET step_kind = 'verify',
    gate_label = 'Lakebase registered in Unity Catalog',
    step_config = '{"check": "uc_catalog_active", "blocking": false, "escape_hatch_points_pct": 60}'::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'sync_from_lakebase'
  AND is_active = TRUE
  AND step_kind = 'instant_prompt';

UPDATE ${schema}.section_input_prompts
SET step_kind = 'verify',
    gate_label = 'Bronze tables created',
    step_config = '{"check": "bronze_tables_exist", "blocking": false, "escape_hatch_points_pct": 60}'::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'bronze_layer_creation'
  AND is_active = TRUE
  AND step_kind = 'instant_prompt';

UPDATE ${schema}.section_input_prompts
SET step_kind = 'verify',
    gate_label = 'Silver pipeline completed',
    step_config = '{"check": "silver_pipeline_succeeded", "blocking": false, "escape_hatch_points_pct": 60}'::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'silver_layer_sdp'
  AND is_active = TRUE
  AND step_kind = 'instant_prompt';

UPDATE ${schema}.section_input_prompts
SET step_kind = 'verify',
    gate_label = 'Gold tables populated',
    step_config = '{"check": "gold_tables_exist", "blocking": false, "escape_hatch_points_pct": 60}'::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag IN ('gold_layer_pipeline', 'deploy_lakehouse_assets')
  AND is_active = TRUE
  AND step_kind = 'instant_prompt';

UPDATE ${schema}.section_input_prompts
SET step_kind = 'verify',
    gate_label = 'Genie space created',
    step_config = '{"check": "genie_space_exists", "blocking": false, "escape_hatch_points_pct": 60}'::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag IN ('genie_space', 'deploy_di_assets')
  AND is_active = TRUE
  AND step_kind = 'instant_prompt';

UPDATE ${schema}.section_input_prompts
SET step_kind = 'verify',
    gate_label = 'Agent endpoint ready',
    step_config = '{"check": "serving_endpoint_ready", "blocking": false, "escape_hatch_points_pct": 60}'::jsonb,
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'agent_framework'
  AND is_active = TRUE
  AND step_kind = 'instant_prompt';

-- =============================================================================
-- FEED COMMITTED DECISIONS INTO THE PROMPTS
-- =============================================================================
-- A decision only matters if the coding assistant acts on it. Each committed field
-- is substituted as {field_key} (see _decision_params in routes.py), so appending a
-- block that references those tokens makes the agent build the attendee's design
-- rather than inventing its own.
--
-- Appended with `||` and guarded by a NOT LIKE check so re-running is a no-op and
-- any admin edits to the body of the template are preserved.
-- =============================================================================

UPDATE ${schema}.section_input_prompts
SET input_template = input_template || '

## Scope the Attendee Committed To

The attendee has already decided what v1 must do. Treat this as the source of truth
and do NOT substitute your own feature list.

**The three features v1 ships, in priority order:**
{committed_features}

**The metric that defines success:** {success_metric}

Write the PRD around exactly these three features and this metric. If something the
attendee chose looks unwise, build it anyway and note the concern in a short
"Risks" subsection — do not silently replace their decision.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'prd_generation'
  AND is_active = TRUE
  AND input_template NOT LIKE '%Scope the Attendee Committed To%';

UPDATE ${schema}.section_input_prompts
SET input_template = input_template || '

## Design Decisions the Attendee Committed To

**Primary screen:** {primary_screen}
**The action that must be one click away:** {primary_action}
**Navigation shape:** {nav_shape}

Build this screen first and make that action reachable in a single click from the
landing view. Use the chosen navigation shape even if you would have picked another.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'cursor_copilot_ui_design'
  AND is_active = TRUE
  AND input_template NOT LIKE '%Design Decisions the Attendee Committed To%';

UPDATE ${schema}.section_input_prompts
SET input_template = input_template || '

## Source Scope the Attendee Committed To

**Tables in scope:**
{in_scope_tables}

**Join key:** {join_key}

Restrict the metadata extract to these tables. If the join key is not unique in one
of them, say so explicitly rather than silently choosing a different key.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'bronze_table_metadata'
  AND is_active = TRUE
  AND input_template NOT LIKE '%Source Scope the Attendee Committed To%';

UPDATE ${schema}.section_input_prompts
SET input_template = input_template || '

## Model the Attendee Committed To

**Fact grain — one row represents:** {fact_grain}

**SCD strategy per dimension:**
{scd_decisions}

Implement exactly this grain and these SCD types. The grain statement governs every
measure: if a measure cannot be expressed at this grain, flag it instead of quietly
re-graining the fact table. If a chosen SCD type will lose history the use case needs,
implement the attendee''s choice and note the trade-off.',
    updated_at = CURRENT_TIMESTAMP
WHERE section_tag = 'gold_layer_design'
  AND is_active = TRUE
  AND input_template NOT LIKE '%Model the Attendee Committed To%';
