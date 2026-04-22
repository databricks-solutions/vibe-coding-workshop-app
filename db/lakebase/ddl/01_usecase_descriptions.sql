-- =============================================================================
-- USE CASE DESCRIPTIONS TABLE (PostgreSQL/Lakebase)
-- =============================================================================
-- Stores versioned use case descriptions for industries and their use cases.
-- Latest version = MAX(version) per (industry, use_case)
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

CREATE TABLE IF NOT EXISTS ${schema}.usecase_descriptions (
    config_id SERIAL PRIMARY KEY,
    industry VARCHAR(100) NOT NULL,
    industry_label VARCHAR(255) NOT NULL,
    use_case VARCHAR(100) NOT NULL,
    use_case_label VARCHAR(255) NOT NULL,
    prompt_template TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    inserted_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    path_type VARCHAR(50) NOT NULL DEFAULT 'use_case'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_usecase_industry_usecase ON ${schema}.usecase_descriptions(industry, use_case);
CREATE INDEX IF NOT EXISTS idx_usecase_active_version ON ${schema}.usecase_descriptions(is_active, version DESC);
CREATE INDEX IF NOT EXISTS idx_usecase_path_type ON ${schema}.usecase_descriptions(path_type) WHERE is_active = TRUE;

COMMENT ON TABLE ${schema}.usecase_descriptions IS 
'Versioned use case descriptions for industries and their use cases. path_type distinguishes use_case from skill entries.';
