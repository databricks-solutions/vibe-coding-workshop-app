-- =============================================================================
-- ADD USE CASE ORIGIN COLUMNS (PostgreSQL/Lakebase) - IDEMPOTENT MIGRATION
-- =============================================================================
-- Lets a use case the attendee defined themselves become a first-class row in
-- usecase_descriptions, rather than living only as prose in
-- saved_usecase_descriptions.
--
-- Why that matters: the dataset a use case reads is resolved as
--     session override -> usecase_descriptions.sample_schema -> global default
-- (see ddl/14 and get_effective_workshop_parameters). A custom use case has no row in
-- that table, so it resolves nothing and inherits the global sample — the same silent
-- fallback that had a retail workshop modelling hotel bookings. Promoting the use case
-- into this table is what gives it somewhere to record its own dataset.
--
--   * origin            VARCHAR(20) NOT NULL DEFAULT 'seed'
--                       'seed'     - shipped product content
--                       'attendee' - promoted from the use case builder
--   * created_by_email  VARCHAR(255) NULL - who defined it, for attribution and so a
--                       facilitator can tell attendee content from product content
--
-- The DEFAULT is what makes this safe: every existing row becomes 'seed', which is
-- what it already was in practice, and nothing that reads this table changes
-- behaviour until a row is explicitly promoted.
--
-- This file is authoritative for both paths:
--   * Fresh install: DDL 01 creates the table without these columns; the ALTERs add them.
--   * Legacy upgrade: identical, since ADD COLUMN IF NOT EXISTS is a no-op when present.
-- Safe to re-run.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

ALTER TABLE ${schema}.usecase_descriptions
  ADD COLUMN IF NOT EXISTS origin VARCHAR(20) NOT NULL DEFAULT 'seed';

ALTER TABLE ${schema}.usecase_descriptions
  ADD COLUMN IF NOT EXISTS created_by_email VARCHAR(255);

-- Named CHECK, dropped first so re-running with a widened list is safe.
ALTER TABLE ${schema}.usecase_descriptions
  DROP CONSTRAINT IF EXISTS chk_usecase_origin;

ALTER TABLE ${schema}.usecase_descriptions
  ADD CONSTRAINT chk_usecase_origin CHECK (origin IN ('seed', 'attendee'));

-- Attendee-defined use cases are listed separately in the admin surface, and a
-- facilitator clearing up after a workshop wants to find them without scanning 48 rows.
CREATE INDEX IF NOT EXISTS idx_usecase_origin
  ON ${schema}.usecase_descriptions(origin)
  WHERE origin <> 'seed';

COMMENT ON COLUMN ${schema}.usecase_descriptions.origin IS
'Where the use case came from: seed (shipped product content) or attendee (promoted from the use case builder so it can carry its own dataset).';

COMMENT ON COLUMN ${schema}.usecase_descriptions.created_by_email IS
'Email of the attendee who defined this use case. NULL for seeded product content.';
