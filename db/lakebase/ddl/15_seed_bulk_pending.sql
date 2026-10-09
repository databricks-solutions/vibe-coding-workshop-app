-- =============================================================================
-- SEED BULK PENDING MARKER (PostgreSQL/Lakebase) - IDEMPOTENT MIGRATION
-- =============================================================================
-- 15_seed_bulk_pending.sql — additive; safe to re-run (D-38).
-- One row per 01/02 seed table whose bulk seed has started but whose
-- post-baseline rows are not yet ledgered in seed_rows_applied (DDL 14).
-- scripts/seed_new_rows.py writes the row before the bulk seed and deletes it
-- after ledgering; a row left by an interrupted run is recovered (ledgered)
-- by the next run, so an admin deletion of a seeded row is not resurrected.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

CREATE TABLE IF NOT EXISTS ${schema}.seed_bulk_pending (
    table_name VARCHAR(100) PRIMARY KEY,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
