-- =============================================================================
-- Unity Catalog Tags for Vibe Coding Workshop Resources
-- =============================================================================
-- These tags are applied to all UC-registered securables created by this
-- deployment. Execution is handled by deploy.sh using the Databricks CLI
-- entity-tag-assignments commands (not psycopg2, since UC tags require the
-- Databricks control plane).
--
-- This file serves as the canonical tag definition reference.
-- Placeholders are substituted at deploy time:
--   __LAKEBASE_CATALOG__  -> UC catalog name
--   __LAKEBASE_SCHEMA__   -> PostgreSQL schema name
--   __TAG_PROJECT__       -> project tag value
--   __TAG_ENVIRONMENT__   -> environment tag value (development/production)
--   __TAG_MANAGED_BY__    -> managed_by tag value
--   __DEPLOYER_EMAIL__    -> owner email
-- =============================================================================

-- Tag the catalog
ALTER CATALOG __LAKEBASE_CATALOG__ SET TAGS (
  'project' = '__TAG_PROJECT__',
  'environment' = '__TAG_ENVIRONMENT__',
  'managed_by' = '__TAG_MANAGED_BY__',
  'owner' = '__DEPLOYER_EMAIL__'
);

-- Tag the schema
ALTER SCHEMA __LAKEBASE_CATALOG__.__LAKEBASE_SCHEMA__ SET TAGS (
  'project' = '__TAG_PROJECT__',
  'environment' = '__TAG_ENVIRONMENT__',
  'managed_by' = '__TAG_MANAGED_BY__'
);

-- Tag each table
ALTER TABLE __LAKEBASE_CATALOG__.__LAKEBASE_SCHEMA__.usecase_descriptions SET TAGS (
  'project' = '__TAG_PROJECT__',
  'managed_by' = '__TAG_MANAGED_BY__',
  'data_classification' = 'internal'
);

ALTER TABLE __LAKEBASE_CATALOG__.__LAKEBASE_SCHEMA__.section_input_prompts SET TAGS (
  'project' = '__TAG_PROJECT__',
  'managed_by' = '__TAG_MANAGED_BY__',
  'data_classification' = 'internal'
);

ALTER TABLE __LAKEBASE_CATALOG__.__LAKEBASE_SCHEMA__.sessions SET TAGS (
  'project' = '__TAG_PROJECT__',
  'managed_by' = '__TAG_MANAGED_BY__',
  'data_classification' = 'internal'
);

ALTER TABLE __LAKEBASE_CATALOG__.__LAKEBASE_SCHEMA__.workshop_parameters SET TAGS (
  'project' = '__TAG_PROJECT__',
  'managed_by' = '__TAG_MANAGED_BY__',
  'data_classification' = 'internal'
);

ALTER TABLE __LAKEBASE_CATALOG__.__LAKEBASE_SCHEMA__.saved_usecase_descriptions SET TAGS (
  'project' = '__TAG_PROJECT__',
  'managed_by' = '__TAG_MANAGED_BY__',
  'data_classification' = 'internal'
);
