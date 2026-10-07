-- =============================================================================
-- WIDEN sessions.workshop_level (PostgreSQL/Lakebase) - IDEMPOTENT MIGRATION
-- =============================================================================
-- Widens sessions.workshop_level from VARCHAR(20) to VARCHAR(64) (D-49).
--
-- The column stores the walked track id (vibe_start_track stamps it on a new
-- session). The longest manifest track id, data-engineering-accelerator, is
-- 28 chars, so a VARCHAR(20) column rejects the save with
-- StringDataRightTruncation and the session is never persisted.
--
--   * Fresh install: DDL 03 already creates the column as VARCHAR(64); this
--     ALTER is a no-op.
--   * Legacy upgrade: widens the existing VARCHAR(20) column in place.
-- Safe to re-run: altering to the same type is a no-op.
--
-- Non-destructive: a varchar widen changes no row, cannot truncate, and does
-- not rewrite the table. The DEFAULT '300' is kept (ALTER TYPE does not touch
-- it), and no view or index depends on the column.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

ALTER TABLE ${schema}.sessions
  ALTER COLUMN workshop_level TYPE VARCHAR(64);
