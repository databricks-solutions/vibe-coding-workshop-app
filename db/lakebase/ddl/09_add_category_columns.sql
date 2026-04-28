-- =============================================================================
-- ADD outcome-map category COLUMNS (PostgreSQL/Lakebase) - IDEMPOTENT MIGRATION
-- =============================================================================
-- Adds three nullable columns to usecase_descriptions that drive the
-- outcome-map grid layout for Travel & Hospitality:
--   * category        VARCHAR(100) NULL  -- e.g. "Agentic AI Operations"
--   * category_order  INTEGER NULL       -- column position 1, 2, 3
--   * display_order   INTEGER NULL       -- card order within a column
--
-- All three are NULL for Sample and legacy rows. The frontend's OutcomeMapGrid
-- only renders when at least one row in the active set carries a category;
-- otherwise the existing UseCaseCardGrid is used as a fallback.
--
-- This file is authoritative for both paths:
--   * Fresh install: DDL 01 already creates the columns inline; the ALTERs
--     here are no-ops thanks to ADD COLUMN IF NOT EXISTS.
--   * Legacy upgrade: DDL 01 is a no-op on the pre-existing table; this
--     migration adds the three columns.
-- Safe to re-run; every statement is idempotent.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

ALTER TABLE ${schema}.usecase_descriptions
  ADD COLUMN IF NOT EXISTS category VARCHAR(100);

ALTER TABLE ${schema}.usecase_descriptions
  ADD COLUMN IF NOT EXISTS category_order INTEGER;

ALTER TABLE ${schema}.usecase_descriptions
  ADD COLUMN IF NOT EXISTS display_order INTEGER;

CREATE INDEX IF NOT EXISTS idx_usecase_industry_category
  ON ${schema}.usecase_descriptions(industry, category, category_order, display_order)
  WHERE is_active = TRUE;
