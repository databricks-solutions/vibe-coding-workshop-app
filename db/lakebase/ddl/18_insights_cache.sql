-- =============================================================================
-- INSIGHTS CACHE (PostgreSQL/Lakebase) - IDEMPOTENT MIGRATION
-- =============================================================================
-- Shared, content-keyed cache for the Insights flow (use-case needs and
-- table matches), so restarts and other app replicas reuse results.
-- The app also creates this table on first use.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

CREATE TABLE IF NOT EXISTS ${schema}.insights_cache (
    namespace VARCHAR(32) NOT NULL,
    cache_key VARCHAR(64) NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (namespace, cache_key)
);
