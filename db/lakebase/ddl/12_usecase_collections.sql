-- =============================================================================
-- USE CASE LIBRARY: COLLECTIONS (PostgreSQL/Lakebase) - IDEMPOTENT MIGRATION
-- =============================================================================
-- A collection groups use cases. Three kinds:
--   * industry  - vertical (CPG, Retail, Travel & Hospitality)
--   * function  - horizontal by buyer (Office of the CFO, Office of the CMO)
--   * solution  - horizontal by capability (Data Integration, Observability)
--
-- Every use case keeps one HOME collection: usecase_descriptions.industry holds
-- the home collection_id, so versioning and existing lookups are unchanged.
-- usecase_collection_members cross-lists a use case into additional
-- collections, each with its own outcome-map category placement.
--
-- Attendees see a use case in a collection when the collection is enabled AND
-- the use case is active. Disabling a collection never touches use case flags.
--
-- usecase_descriptions.source records where a row came from
-- ('seed' | 'admin' | 'ideate' | 'ideate_approved' | 'ideate_dismissed') and
-- drives the Library's "Needs review" queue.
--
-- Safe to re-run; every statement is idempotent.
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

CREATE TABLE IF NOT EXISTS ${schema}.usecase_collections (
    collection_id VARCHAR(100) PRIMARY KEY,
    kind VARCHAR(20) NOT NULL DEFAULT 'industry',
    label VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(20),
    display_order INTEGER NOT NULL DEFAULT 100,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS ${schema}.usecase_collection_members (
    collection_id VARCHAR(100) NOT NULL,
    home_industry VARCHAR(100) NOT NULL,
    use_case VARCHAR(100) NOT NULL,
    category VARCHAR(100),
    category_order INTEGER,
    display_order INTEGER,
    added_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    added_by VARCHAR(255),
    PRIMARY KEY (collection_id, home_industry, use_case)
);

CREATE INDEX IF NOT EXISTS idx_collection_members_usecase
    ON ${schema}.usecase_collection_members(home_industry, use_case);

ALTER TABLE ${schema}.usecase_descriptions
    ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'admin';

-- Backfill one industry collection per existing industry (keeps today's
-- behaviour: every industry starts enabled).
INSERT INTO ${schema}.usecase_collections (collection_id, kind, label, display_order, is_enabled, updated_by)
SELECT DISTINCT ON (industry)
       industry,
       'industry',
       industry_label,
       CASE industry WHEN 'sample' THEN 1 WHEN 'retail' THEN 2 WHEN 'cpg' THEN 3 WHEN 'travel' THEN 4 ELSE 100 END,
       TRUE,
       'migration'
FROM ${schema}.usecase_descriptions
ORDER BY industry, version DESC
ON CONFLICT (collection_id) DO NOTHING;

-- Empty industries used to be kept alive by a '_placeholder' row; the
-- collection row now does that job.
DELETE FROM ${schema}.usecase_descriptions
WHERE use_case = '_placeholder'
  AND industry IN (SELECT collection_id FROM ${schema}.usecase_collections);
