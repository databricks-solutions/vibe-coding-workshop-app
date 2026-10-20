-- =============================================================================
-- CONTRIBUTED USE CASE OVERRIDES (PostgreSQL/Lakebase) - IDEMPOTENT MIGRATION
-- =============================================================================
-- Contributed use cases live as files in contrib/ and change only by pull
-- request. This table records what an admin of THIS install chose: hide one
-- (is_active = FALSE) or move it on the outcome map. NULL means "use the file's
-- value". Content (name, brief, certification) is never stored here.
-- Keyed by the contributed use case key: contrib__<contributor_id>__<slug>.
-- The app also creates this table on first use (src/backend/contrib/overrides.py).
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

CREATE TABLE IF NOT EXISTS ${schema}.contributed_usecase_overrides (
    use_case_key VARCHAR(100) PRIMARY KEY,
    is_active BOOLEAN,
    category VARCHAR(100),
    category_order INTEGER,
    display_order INTEGER,
    updated_by VARCHAR(255),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
