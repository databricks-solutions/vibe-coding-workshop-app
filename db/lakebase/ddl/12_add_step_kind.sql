-- =============================================================================
-- ADD step_kind COLUMNS (PostgreSQL/Lakebase) - IDEMPOTENT MIGRATION
-- =============================================================================
-- Turns section_input_prompts from "every step is a prompt to copy" into a small
-- set of step kinds, so a step can ask the attendee to make a decision before the
-- coding assistant acts on it.
--
--   * step_kind            VARCHAR(24) NOT NULL DEFAULT 'instant_prompt'
--   * step_config          JSONB       NOT NULL DEFAULT '{}'  -- per-kind settings
--   * gate_label           VARCHAR(200) NULL -- the gate an agent reports on exit
--   * expert_answer        TEXT NULL         -- static reveal, shown after commit
--   * expert_system_prompt TEXT NULL         -- used when the reveal must be
--                                            -- grounded in the attendee's own
--                                            -- schema/PRD instead of static text
--
-- step_kind is a scalar column rather than a step_config key because it is read
-- on every cache refresh and selected by an explicit column list; step_config is
-- schemaless and differs per kind, so it stays JSONB.
--
-- The DEFAULT is what makes this safe to ship: every existing row becomes
-- 'instant_prompt', which renders exactly as it does today. Upgrading a step to
-- another kind is then a single UPDATE (see dml_seed/12_seed_step_kinds.sql) or a
-- normal admin edit, never a deploy.
--
-- Kinds:
--   instant_prompt - render the templated text immediately (today's behaviour)
--   decision       - commit a choice, then reveal the expert answer and diff it
--   verify         - confirm a real workspace artifact exists
--   prediction     - reserved; predict an outcome, then reveal ground truth
--   critique       - reserved; score a submitted artifact against a rubric
--   composite      - a group of phases sharing one step number
-- prediction and critique are permitted here so adding one later needs no
-- migration, even though the current workshop uses neither.
--
-- This file is authoritative for both paths:
--   * Fresh install: DDL 02 creates the table without these columns; the ALTERs
--     below add them.
--   * Legacy upgrade: identical, since every statement is idempotent
--     (ADD COLUMN IF NOT EXISTS, DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT).
-- Safe to re-run.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

ALTER TABLE ${schema}.section_input_prompts
  ADD COLUMN IF NOT EXISTS step_kind VARCHAR(24) NOT NULL DEFAULT 'instant_prompt';

ALTER TABLE ${schema}.section_input_prompts
  ADD COLUMN IF NOT EXISTS step_config JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE ${schema}.section_input_prompts
  ADD COLUMN IF NOT EXISTS gate_label VARCHAR(200);

ALTER TABLE ${schema}.section_input_prompts
  ADD COLUMN IF NOT EXISTS expert_answer TEXT;

ALTER TABLE ${schema}.section_input_prompts
  ADD COLUMN IF NOT EXISTS expert_system_prompt TEXT;

-- Named CHECK, dropped first so re-running with a widened kind list is safe.
ALTER TABLE ${schema}.section_input_prompts
  DROP CONSTRAINT IF EXISTS chk_step_kind;

ALTER TABLE ${schema}.section_input_prompts
  ADD CONSTRAINT chk_step_kind CHECK (step_kind IN (
    'instant_prompt', 'decision', 'prediction', 'verify', 'critique', 'composite'
  ));

-- Decision and verify steps are looked up by kind when the UI builds a session's
-- gate list; partial index keeps that off a full scan as step count grows.
CREATE INDEX IF NOT EXISTS idx_section_step_kind
  ON ${schema}.section_input_prompts(step_kind)
  WHERE is_active = TRUE AND step_kind <> 'instant_prompt';

COMMENT ON COLUMN ${schema}.section_input_prompts.step_kind IS
'How the step is presented: instant_prompt (static text), decision (commit then reveal), verify (confirm a workspace artifact), or the reserved prediction/critique/composite kinds.';

COMMENT ON COLUMN ${schema}.section_input_prompts.step_config IS
'Per-kind settings. decision: widget, fields, rubric, min_chars, expert_source. verify: check, params, blocking, escape_hatch_points_pct. composite: phases[].';

COMMENT ON COLUMN ${schema}.section_input_prompts.gate_label IS
'Human-readable gate the coding agent reports when it finishes this step, matching the vibecoding-state skill exit ritual.';
