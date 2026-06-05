-- =============================================================================
-- SEED DATA: PATH VISIBILITY OVERRIDES
-- =============================================================================
-- Per-coding-assistant workshop-path visibility. Stored in the existing
-- step_visibility_overrides table using a synthetic section_key namespace of
-- the form '__path_<level>__'. This mirrors the '__prerequisites__' precedent
-- already in 08_seed_step_visibility_overrides.sql.
--
-- Seeding strategy:
--   * Genie Code: disable the paths Genie Code does not yet support
--     (the end-to-end workshop, the Skills accelerator, and Reverse ETL paths
--     that terminate in Lakebase/App).
--   * TESTING: Apps, + Lakebase, and the Agents Accelerator are intentionally
--     LEFT ENABLED for Genie Code on this branch so they can be exercised
--     end-to-end. (Previously these were seeded FALSE.) The reconciliation
--     DELETE below clears any previously-seeded disable rows for them so
--     existing test deployments pick up the change on redeploy.
--   * Default and CoDA: NO seeded rows. Absence == enabled.
--
-- Idempotency contract:
--   * INSERTs use ON CONFLICT DO NOTHING so re-runs (or redeploys) never
--     overwrite an admin-made per-assistant value that already exists in
--     step_visibility_overrides.
--   * The set of levels here is purely an initial default; admins can flip any
--     row at any time via the Configuration -> Visibility tab.
--
-- Runs AFTER 08_seed_step_visibility_overrides.sql by virtue of filename
-- ordering (setup-lakebase.sh sorts seed files alphabetically).
-- =============================================================================

INSERT INTO ${catalog}.${schema}.step_visibility_overrides
  (section_key, coding_assistant, enabled, updated_at, updated_by)
VALUES
  ('__path_end-to-end__',              'genie-code', FALSE, CURRENT_TIMESTAMP, 'seed'),
  ('__path_skills-accelerator__',      'genie-code', FALSE, CURRENT_TIMESTAMP, 'seed'),
  ('__path_reverse-lakebase__',        'genie-code', FALSE, CURRENT_TIMESTAMP, 'seed'),
  ('__path_reverse-app__',             'genie-code', FALSE, CURRENT_TIMESTAMP, 'seed')
ON CONFLICT (section_key, coding_assistant) DO NOTHING;

-- TESTING reconciliation: enable Apps, + Lakebase, and the Agents Accelerator
-- for Genie Code by deleting any previously-seeded disable rows (absence ==
-- enabled). Guarded by updated_by='seed' so admin-made choices captured via the
-- Configuration -> Visibility tab (updated_by=<admin email>) are never touched.
DELETE FROM ${catalog}.${schema}.step_visibility_overrides
WHERE coding_assistant = 'genie-code'
  AND section_key IN (
    '__path_app-only__',
    '__path_app-database__',
    '__path_agents-accelerator__'
  )
  AND updated_by = 'seed';
