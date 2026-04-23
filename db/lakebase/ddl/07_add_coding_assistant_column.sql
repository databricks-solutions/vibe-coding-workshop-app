-- =============================================================================
-- ADD coding_assistant COLUMN (PostgreSQL/Lakebase) - IDEMPOTENT MIGRATION
-- =============================================================================
-- Adds the coding_assistant column + its CHECK constraint + the two
-- coding_assistant-dependent indexes (idx_section_assistant_version and the
-- partial unique uq_section_assistant_version_active) to
-- section_input_prompts.
--
-- This file is authoritative for all coding_assistant-dependent schema
-- objects on BOTH paths:
--   * Fresh install: DDL 02 creates the table (including the column + CHECK
--     inline so INSERTs immediately satisfy NOT NULL / the CHECK); DDL 07
--     then adds the two indexes. ADD COLUMN / DROP/ADD CONSTRAINT are
--     effectively no-ops here.
--   * Legacy upgrade: DDL 02 is a no-op on the pre-existing table; DDL 07
--     adds the column (NOT NULL DEFAULT '__default__' stamps every existing
--     row), re-adds the named CHECK, and creates the indexes.
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS, DROP IF
-- EXISTS + ADD CONSTRAINT).
--
-- Values: '__default__' (shared prompt), 'genie-code', 'coda' (forks).
-- No fork rows are ever created by this migration.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

ALTER TABLE ${schema}.section_input_prompts
  ADD COLUMN IF NOT EXISTS coding_assistant VARCHAR(40) NOT NULL DEFAULT '__default__';

ALTER TABLE ${schema}.section_input_prompts
  DROP CONSTRAINT IF EXISTS chk_coding_assistant;

ALTER TABLE ${schema}.section_input_prompts
  ADD CONSTRAINT chk_coding_assistant CHECK (coding_assistant IN ('__default__', 'genie-code', 'coda'));

CREATE INDEX IF NOT EXISTS idx_section_assistant_version
  ON ${schema}.section_input_prompts(section_tag, coding_assistant, version DESC);

-- Partial unique index: DB-level guard against concurrent-fork races. The
-- /config/section-inputs/fork endpoint's SELECT-then-INSERT check can be
-- raced; this index makes the second INSERT fail deterministically. Soft-
-- deleted rows (is_active=FALSE) are excluded so re-forking after a delete
-- still works.
CREATE UNIQUE INDEX IF NOT EXISTS uq_section_assistant_version_active
  ON ${schema}.section_input_prompts(section_tag, coding_assistant, version)
  WHERE is_active = TRUE;
