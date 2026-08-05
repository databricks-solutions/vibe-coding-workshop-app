-- =============================================================================
-- SEED DATA: DATA PRE-WORK PARAMETERS
-- =============================================================================
-- Parameters the data pre-work prompt substitutes.
--
-- synthetic_row_target defaults to 15000, not the 100K+ the synthetic-data-gen skill
-- recommends. That guidance targets production demos; this runs in a live workshop where
-- a room of attendees generates simultaneously, and 15K finishes in a couple of minutes
-- while still carrying trends, skew and an incident through aggregation. Live-editable so
-- a facilitator can drop it further if the room is slow or contended, or raise it for a
-- single-attendee deep dive.
--
-- industry_model_repo is a parameter rather than a constant so the prompt keeps working if
-- the industry-models repo moves, and so a team with an internal fork can point at it.
--
-- Idempotency: INSERT ... WHERE NOT EXISTS, so a facilitator's chosen values survive every
-- redeploy. Registered in POST_SEED_MIGRATIONS for existing installs.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

INSERT INTO ${schema}.workshop_parameters
(param_key, param_label, param_value, param_description, param_type, display_order,
 is_required, is_active, allow_session_override, inserted_at, updated_at, created_by)
SELECT
 'synthetic_row_target',
 'Synthetic Row Target',
 '15000',
 'Approximate row count for the main fact table when an attendee generates a dataset in the data pre-work. Deliberately below the synthetic-data-gen skill''s 100K+ guidance: that targets production demos, while this runs live with a whole room generating at once. 15K finishes in a couple of minutes and still shows trends and anomalies after aggregation. Lower it if the room is contended.',
 'text',
 32,
 FALSE,
 TRUE,
 TRUE,
 CURRENT_TIMESTAMP,
 CURRENT_TIMESTAMP,
 'seed'
WHERE NOT EXISTS (
  SELECT 1 FROM ${schema}.workshop_parameters WHERE param_key = 'synthetic_row_target'
);

INSERT INTO ${schema}.workshop_parameters
(param_key, param_label, param_value, param_description, param_type, display_order,
 is_required, is_active, allow_session_override, inserted_at, updated_at, created_by)
SELECT
 'industry_model_repo',
 'Industry Data Models Repo',
 'databricks-industry-solutions/lakehouse-industry-data-models',
 'Repository holding the pre-built industry data models used as the starting point for the data pre-work (41 industries, each with an MVM and ECM tier under data-models/<industry>/v1/). Change this to point at an internal fork.',
 'text',
 33,
 FALSE,
 TRUE,
 TRUE,
 CURRENT_TIMESTAMP,
 CURRENT_TIMESTAMP,
 'seed'
WHERE NOT EXISTS (
  SELECT 1 FROM ${schema}.workshop_parameters WHERE param_key = 'industry_model_repo'
);
