-- =============================================================================
-- ADD is_certified COLUMN (PostgreSQL/Lakebase) - IDEMPOTENT MIGRATION
-- =============================================================================
-- Adds a single nullable-with-default flag to usecase_descriptions that marks a
-- use case as "Certified". Certified use cases:
--   * sort to the TOP within each section of the workshop flow
--     (each outcome-map category column for Travel; the top of the flat grid
--      for Sample), and
--   * render a "Certified" badge on the use-case card and on the workflow steps.
--
-- This file is authoritative for both paths:
--   * Fresh install: DDL 01 already creates the column inline; the ALTER here
--     is a no-op thanks to ADD COLUMN IF NOT EXISTS.
--   * Legacy upgrade: DDL 01 is a no-op on the pre-existing table; this
--     migration adds the column.
-- Safe to re-run; every statement is idempotent.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

ALTER TABLE ${schema}.usecase_descriptions
  ADD COLUMN IF NOT EXISTS is_certified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_usecase_certified
  ON ${schema}.usecase_descriptions(industry, is_certified)
  WHERE is_active = TRUE AND is_certified = TRUE;
