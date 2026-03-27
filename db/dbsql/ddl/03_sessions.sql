-- =============================================================================
-- SESSIONS TABLE (DBSQL / Delta Lake)
-- =============================================================================
-- Stores user sessions with workflow progress and generated prompts
-- Variables: ${catalog}.${schema} - replaced at runtime
-- =============================================================================

CREATE TABLE IF NOT EXISTS ${catalog}.${schema}.sessions (
    session_id STRING NOT NULL PRIMARY KEY,
    created_by STRING NOT NULL,
    session_name STRING,
    session_description STRING,
    industry STRING,
    industry_label STRING,
    use_case STRING,
    use_case_label STRING,
    feedback_rating STRING,
    feedback_comment STRING,
    feedback_request_followup BOOLEAN DEFAULT FALSE,
    chapter_feedback STRING DEFAULT '{}',
    step_1_prompt STRING,
    step_prompts STRING DEFAULT '{}',
    prerequisites_completed BOOLEAN DEFAULT FALSE,
    current_step INT DEFAULT 1,
    workshop_level STRING DEFAULT '300',
    completed_steps STRING,
    skipped_steps STRING DEFAULT '[]',
    session_parameters STRING DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) USING DELTA
TBLPROPERTIES ('delta.feature.allowColumnDefaults' = 'supported');
