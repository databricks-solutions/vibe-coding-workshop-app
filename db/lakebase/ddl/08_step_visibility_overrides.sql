-- =============================================================================
-- STEP VISIBILITY OVERRIDES TABLE (PostgreSQL/Lakebase) - IDEMPOTENT
-- =============================================================================
-- Stores per-coding-assistant visibility state that diverges from (or explicitly
-- mirrors) the Default value authored on section_input_prompts.
--
-- Conventions:
--   * Real steps (section_key = <section_tag>):
--     Default visibility lives on section_input_prompts.step_enabled (unchanged).
--     Only 'coda' and 'genie-code' rows are stored here.
--   * Prerequisites (section_key = '__prerequisites__'):
--     All three keys ('__default__','coda','genie-code') live here. Default
--     defaults to TRUE when no row exists.
--
-- Initial values are seeded by db/lakebase/dml_seed/08_seed_step_visibility_overrides.sql
-- which copies the current section_input_prompts.step_enabled values into CoDA
-- and Genie Code rows. Seeding uses ON CONFLICT DO NOTHING so re-runs never
-- clobber admin-made per-assistant values.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

CREATE TABLE IF NOT EXISTS ${schema}.step_visibility_overrides (
    section_key      VARCHAR(100) NOT NULL,
    coding_assistant VARCHAR(40)  NOT NULL,
    enabled          BOOLEAN      NOT NULL,
    updated_at       TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by       VARCHAR(255),
    PRIMARY KEY (section_key, coding_assistant),
    CONSTRAINT chk_svo_assistant CHECK (coding_assistant IN ('__default__','coda','genie-code'))
);

CREATE INDEX IF NOT EXISTS idx_svo_assistant
    ON ${schema}.step_visibility_overrides(coding_assistant);

COMMENT ON TABLE ${schema}.step_visibility_overrides IS
'Per-coding-assistant visibility overrides. Real steps: CoDA/Genie rows only (Default lives on section_input_prompts). Prerequisites: all three keys keyed under section_key=__prerequisites__.';
