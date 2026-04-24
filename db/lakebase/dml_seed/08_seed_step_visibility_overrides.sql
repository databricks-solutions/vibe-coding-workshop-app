-- =============================================================================
-- SEED DATA: STEP VISIBILITY OVERRIDES
-- =============================================================================
-- Seeds CoDA and Genie Code visibility rows to mirror the CURRENT Default
-- step_enabled values on section_input_prompts. Also seeds three rows for the
-- special '__prerequisites__' section_key.
--
-- CoDA product defaults:
--   The Prerequisites section and the 'project_setup' workflow step are hidden
--   out-of-the-box for the CoDA coding assistant because CoDA handles workspace
--   bootstrapping itself -- users would otherwise be asked to do redundant work.
--   Admins can re-enable either from Config -> Step Visibility at any time.
--
-- Idempotency contract:
--   * The INSERTs below use ON CONFLICT DO NOTHING so re-runs (or redeploys)
--     never overwrite an admin-made per-assistant value that already exists.
--   * The final UPDATE forces the two CoDA product defaults to FALSE, but ONLY
--     for rows still in their original seeded state (updated_by = 'seed').
--     This makes the migration safe for existing installs (where the previous
--     version of this file left those rows as TRUE) while never clobbering a
--     value that an admin has already toggled in the UI.
--
-- Runs AFTER db/lakebase/dml_seed/02_seed_section_input_prompts.sql because
-- setup-lakebase.sh sorts seed files by filename (see scripts/setup-lakebase.sh
-- L432-437).
-- =============================================================================

-- CoDA: mirror Default step_enabled for every existing section_tag.
-- We collapse to the active Default row per section_tag (at most one by the
-- uq_section_assistant_version_active partial-unique index from DDL 07) so
-- this INSERT can never emit two rows for the same (section_tag,'coda') pair.
INSERT INTO ${catalog}.${schema}.step_visibility_overrides
  (section_key, coding_assistant, enabled, updated_at, updated_by)
SELECT
  section_tag,
  'coda',
  BOOL_AND(COALESCE(step_enabled, TRUE)),
  CURRENT_TIMESTAMP,
  'seed'
FROM ${catalog}.${schema}.section_input_prompts
WHERE coding_assistant = '__default__'
  AND is_active = TRUE
GROUP BY section_tag
ON CONFLICT (section_key, coding_assistant) DO NOTHING;

-- Genie Code: mirror Default step_enabled for every existing section_tag.
INSERT INTO ${catalog}.${schema}.step_visibility_overrides
  (section_key, coding_assistant, enabled, updated_at, updated_by)
SELECT
  section_tag,
  'genie-code',
  BOOL_AND(COALESCE(step_enabled, TRUE)),
  CURRENT_TIMESTAMP,
  'seed'
FROM ${catalog}.${schema}.section_input_prompts
WHERE coding_assistant = '__default__'
  AND is_active = TRUE
GROUP BY section_tag
ON CONFLICT (section_key, coding_assistant) DO NOTHING;

-- Virtual / non-prompt section keys. These aren't rows in section_input_prompts
-- (they have no LLM template -- the UI renders them as static instructional
-- sections) so the mirror-from-Default INSERTs above don't reach them. We seed
-- them explicitly here:
--   * __prerequisites__ : the workshop Prerequisites block. Visible for Default
--     and Genie Code; hidden for CoDA (CoDA handles environment setup itself).
--   * project_setup     : Step 2 "Set Up Project". Same rationale -- CoDA users
--     bootstrap their workspace through the CoDA flow, so this redundant step
--     is hidden out-of-the-box for that assistant.
INSERT INTO ${catalog}.${schema}.step_visibility_overrides
  (section_key, coding_assistant, enabled, updated_at, updated_by)
VALUES
  ('__prerequisites__', '__default__', TRUE,  CURRENT_TIMESTAMP, 'seed'),
  ('__prerequisites__', 'coda',        FALSE, CURRENT_TIMESTAMP, 'seed'),
  ('__prerequisites__', 'genie-code',  TRUE,  CURRENT_TIMESTAMP, 'seed'),
  ('project_setup',     'coda',        FALSE, CURRENT_TIMESTAMP, 'seed'),
  ('project_setup',     'genie-code',  TRUE,  CURRENT_TIMESTAMP, 'seed')
ON CONFLICT (section_key, coding_assistant) DO NOTHING;

-- Migration for installs that received the earlier (all-TRUE) version of this
-- seed: force the two CoDA product defaults to FALSE, but only when the row is
-- still in its original seeded state. updated_by='seed' = never touched by an
-- admin, so flipping it to the new default is safe and preserves any admin
-- intent captured via the Config UI (which writes updated_by=<user email>).
UPDATE ${catalog}.${schema}.step_visibility_overrides
SET enabled    = FALSE,
    updated_at = CURRENT_TIMESTAMP,
    updated_by = 'seed'
WHERE coding_assistant = 'coda'
  AND section_key IN ('__prerequisites__', 'project_setup')
  AND enabled = TRUE
  AND updated_by = 'seed';
