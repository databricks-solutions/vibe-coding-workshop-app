-- =============================================================================
-- SEED ROWS APPLIED LEDGER (PostgreSQL/Lakebase) - IDEMPOTENT MIGRATION
-- =============================================================================
-- 14_seed_rows_applied.sql — additive; safe to re-run (D-37).
-- One row per post-baseline seed row (01/02 seed files) that has reached this
-- install. scripts/seed_new_rows.py never re-inserts a ledgered row, so an admin
-- deletion of a seed row is not resurrected by a redeploy. Rows present at the
-- baseline (scripts/seed_baseline.json) are never ledgered or re-inserted.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

CREATE TABLE IF NOT EXISTS ${schema}.seed_rows_applied (
    table_name VARCHAR(100) NOT NULL,
    pk INTEGER NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (table_name, pk)
);
