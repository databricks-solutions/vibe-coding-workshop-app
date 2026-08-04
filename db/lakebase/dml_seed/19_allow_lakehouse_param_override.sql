-- =============================================================================
-- SEED DATA: ALLOW SESSION OVERRIDE ON THE LAKEHOUSE SOURCE PARAMETERS
-- =============================================================================
-- chapter_3_lakehouse_catalog and chapter_3_lakehouse_schema shipped with
-- allow_session_override = FALSE, which is why they never appear in the normal
-- per-session Configuration surface. The bespoke LakehouseParamsEditor writes them
-- anyway (PUT /session/{id}/lakehouse-params documents that it "bypasses the
-- allow_session_override check since it has custom UI"), so the flag was not
-- actually protecting anything — it just hid the values from the one screen a
-- facilitator would look at when a workshop is pointed at the wrong dataset.
--
-- Flipping it to TRUE makes these two editable through the standard surface as
-- well, which matters now that they carry a per-use-case default: a facilitator who
-- disagrees with the seeded choice can fix one session without a deploy.
--
-- Fresh installs get TRUE directly from seed 03; that seed's DELETE + INSERT only
-- runs when the tables are empty, so existing installs need this UPDATE to receive
-- the change.
--
-- Idempotency: re-running is a no-op once the flag is TRUE. Deliberately NOT
-- guarded on updated_by — allow_session_override is a capability flag rather than a
-- content value, and there is no admin surface that sets it, so there is no admin
-- edit here to clobber. The param_value is untouched.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

UPDATE ${schema}.workshop_parameters
SET allow_session_override = TRUE,
    updated_at = CURRENT_TIMESTAMP
WHERE param_key IN ('chapter_3_lakehouse_catalog', 'chapter_3_lakehouse_schema')
  AND allow_session_override = FALSE;
