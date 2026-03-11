-- =============================================================================
-- SAVED USE CASE DESCRIPTIONS TABLE (PostgreSQL/Lakebase)
-- =============================================================================
-- Stores user-generated use case descriptions from the Build Your Use Case
-- [Beta] feature. Community library -- all users can view and edit.
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

CREATE TABLE IF NOT EXISTS ${schema}.saved_usecase_descriptions (
    id SERIAL PRIMARY KEY,
    created_by VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    updated_by VARCHAR(255),
    industry VARCHAR(255),
    use_case_name VARCHAR(255),
    description TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_uc_created_by ON ${schema}.saved_usecase_descriptions(created_by);
CREATE INDEX IF NOT EXISTS idx_saved_uc_is_active ON ${schema}.saved_usecase_descriptions(is_active);

COMMENT ON TABLE ${schema}.saved_usecase_descriptions IS
'Community library of user-generated use case descriptions from Build Your Use Case [Beta]. All users can view and edit. created_by stores the original creator email, updated_by tracks the last editor.';
