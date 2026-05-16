-- =============================================================================
-- SEED DATA: STEP VISIBILITY OVERRIDES
-- =============================================================================
-- Seeds CoDA and Genie Code visibility rows to mirror the CURRENT Default
-- step_enabled values on section_input_prompts. Also seeds three rows for the
-- special '__prerequisites__' section_key.
--
-- CoDA product defaults:
--   The Prerequisites section is hidden out-of-the-box for the CoDA coding
--   assistant because CoDA handles workspace bootstrapping itself -- users
--   would otherwise be asked to do redundant work. The 'project_setup'
--   workflow step is left visible (admins can hide it per-assistant via the
--   Visibility matrix when desired).
--
-- Genie Code product defaults:
--   The Prerequisites section is also hidden out-of-the-box for Genie Code
--   for the same reason as CoDA: Genie Code drives the workspace bootstrap
--   on its own, so the manual environment-check checklist is redundant. The
--   'project_setup' workflow step is left visible (controlled independently
--   from Prerequisites via its own toggle in the Visibility matrix).
--
-- Idempotency contract:
--   * The INSERTs below use ON CONFLICT DO NOTHING so re-runs (or redeploys)
--     never overwrite an admin-made per-assistant value that already exists.
--   * The final UPDATE block reconciles installs that received earlier
--     versions of this seed:
--       - For Prerequisites: forces 'coda' AND 'genie-code' rows to FALSE
--         when still in seeded state (older seeds left Genie Code as TRUE).
--       - For project_setup: forces 'coda' AND 'genie-code' rows to TRUE
--         when still in seeded state (older seeds set them to FALSE, hiding
--         step 2; that product default has been retracted).
--     Every UPDATE is guarded by `updated_by = 'seed'` so admin-touched rows
--     (where updated_by carries the admin's identity) are never clobbered.
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
--   * __prerequisites__ : the workshop Prerequisites block. Visible for Default;
--     hidden for both CoDA and Genie Code (both assistants bootstrap the
--     workspace themselves, so the manual environment-check checklist is
--     redundant for them).
--   * project_setup     : Step 2 "Set Up Project". Visible for all three
--     assistants by default. Lives entirely in this overrides table (it has
--     no section_input_prompts row) and is exposed as its own three-column
--     toggle in the admin Visibility matrix so admins can hide it per
--     coding-assistant if desired.
INSERT INTO ${catalog}.${schema}.step_visibility_overrides
  (section_key, coding_assistant, enabled, updated_at, updated_by)
VALUES
  ('__prerequisites__', '__default__', TRUE,  CURRENT_TIMESTAMP, 'seed'),
  ('__prerequisites__', 'coda',        FALSE, CURRENT_TIMESTAMP, 'seed'),
  ('__prerequisites__', 'genie-code',  FALSE, CURRENT_TIMESTAMP, 'seed'),
  ('project_setup',     '__default__', TRUE,  CURRENT_TIMESTAMP, 'seed'),
  ('project_setup',     'coda',        TRUE,  CURRENT_TIMESTAMP, 'seed'),
  ('project_setup',     'genie-code',  TRUE,  CURRENT_TIMESTAMP, 'seed')
ON CONFLICT (section_key, coding_assistant) DO NOTHING;

-- Migration for installs that received earlier versions of this seed.
-- updated_by='seed' = never touched by an admin, so flipping it to the new
-- default is safe and preserves any admin intent captured via the Config UI
-- (which writes updated_by=<user email>).
--
-- Prerequisites: hide for both CoDA and Genie Code. Older seeds left Genie
-- Code's row as TRUE (visible); the new product default is FALSE.
UPDATE ${catalog}.${schema}.step_visibility_overrides
SET enabled    = FALSE,
    updated_at = CURRENT_TIMESTAMP,
    updated_by = 'seed'
WHERE coding_assistant IN ('coda', 'genie-code')
  AND section_key = '__prerequisites__'
  AND enabled = TRUE
  AND updated_by = 'seed';

-- project_setup: reveal for both CoDA and Genie Code. Older seeds set this
-- to FALSE for both assistants (hiding step 2); the new product default is
-- TRUE. Admin overrides remain untouched via the updated_by='seed' guard.
UPDATE ${catalog}.${schema}.step_visibility_overrides
SET enabled    = TRUE,
    updated_at = CURRENT_TIMESTAMP,
    updated_by = 'seed'
WHERE coding_assistant IN ('coda', 'genie-code')
  AND section_key = 'project_setup'
  AND enabled = FALSE
  AND updated_by = 'seed';
