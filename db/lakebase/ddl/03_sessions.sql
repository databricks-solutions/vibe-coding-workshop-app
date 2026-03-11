-- =============================================================================
-- SESSIONS TABLE (PostgreSQL/Lakebase)
-- =============================================================================
-- Stores user sessions with workflow progress and generated prompts
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

CREATE TABLE IF NOT EXISTS ${schema}.sessions (
    session_id VARCHAR(36) PRIMARY KEY,
    created_by VARCHAR(255) NOT NULL,
    session_name VARCHAR(100),
    session_description VARCHAR(500),
    industry VARCHAR(100),
    industry_label VARCHAR(255),
    use_case VARCHAR(100),
    use_case_label VARCHAR(255),
    feedback_rating VARCHAR(20),
    feedback_comment TEXT,
    feedback_request_followup BOOLEAN DEFAULT FALSE,
    chapter_feedback JSONB DEFAULT '{}',
    step_1_prompt TEXT,
    step_prompts JSONB DEFAULT '{}',
    prerequisites_completed BOOLEAN DEFAULT FALSE,
    current_step INTEGER DEFAULT 1,
    workshop_level VARCHAR(20) DEFAULT '300',
    completed_steps TEXT,
    skipped_steps TEXT DEFAULT '[]',
    session_parameters JSONB DEFAULT '{}',
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON ${schema}.sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_by ON ${schema}.sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_sessions_industry_usecase ON ${schema}.sessions(industry, use_case);

COMMENT ON TABLE ${schema}.sessions IS 
'Vibe Coding Workshop session storage for tracking user progress through the 30-step workflow. Workshop level determines which chapters are visible (app-only, app-database, lakehouse, lakehouse-di, end-to-end, accelerator, genie-accelerator, data-engineering-accelerator, skills-accelerator). Session parameters allow per-session overrides of global workshop parameters. Step 1 prompt stored in step_1_prompt column, steps 2-30 stored in step_prompts JSONB.';
