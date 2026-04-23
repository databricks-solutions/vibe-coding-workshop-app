-- =============================================================================
-- ADD coding_assistant COLUMN (PostgreSQL/Lakebase) - IDEMPOTENT MIGRATION
-- =============================================================================
-- Adds the coding_assistant column to section_input_prompts for existing
-- deployments. Safe to re-run: every statement is idempotent.
--
-- Values: '__default__' (shared prompt), 'genie-code', 'coda' (forks).
-- All pre-existing rows are stamped '__default__' via the column default.
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
