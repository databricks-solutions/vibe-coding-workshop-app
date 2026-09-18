-- =============================================================================
-- ADD per-use-case SAMPLE DATASET COLUMNS (PostgreSQL/Lakebase) - IDEMPOTENT
-- =============================================================================
-- Bug this fixes: an attendee running a Retail use case had Step 10 source
-- `samples.wanderbricks` — a hotel-booking dataset — and modelled a Bronze layer
-- of properties, hosts and bookings for a store-performance app.
--
-- The cause was not a substitution failure. Every prompt correctly templates
-- {chapter_3_lakehouse_catalog}/{chapter_3_lakehouse_schema}; those two workshop
-- parameters are simply GLOBAL, and their product default is the booking dataset.
-- One global default served all 48 use cases across 4 industries.
--
-- The per-session override that was supposed to cover this is written only when
-- Step 9 completes (auto_set_lakehouse_params_from_lakebase). Skip step 9, take a
-- path that omits it, or hit a silent failure, and nothing is ever written — so
-- the tourism default leaks into a retail workshop.
--
-- These two nullable columns give the data model somewhere to say which sample
-- dataset suits which use case, which is the piece that was actually missing:
--   * sample_catalog VARCHAR(255) NULL  -- e.g. "samples"
--   * sample_schema  VARCHAR(255) NULL  -- e.g. "bakehouse"
--
-- NULL means "no opinion, use the global default", so every existing row keeps
-- today's behaviour until dml_seed/18 fills them in. Resolution order in
-- get_effective_workshop_parameters becomes:
--     session override  ->  use-case default (here)  ->  global default
-- which is why the fix holds whether or not step 9 ever ran.
--
-- This file is authoritative for both paths:
--   * Fresh install: DDL 01 creates the table without these columns; the ALTERs
--     below add them.
--   * Legacy upgrade: identical, since ADD COLUMN IF NOT EXISTS is a no-op when
--     the column is already present.
-- Safe to re-run.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

ALTER TABLE ${schema}.usecase_descriptions
  ADD COLUMN IF NOT EXISTS sample_catalog VARCHAR(255);

ALTER TABLE ${schema}.usecase_descriptions
  ADD COLUMN IF NOT EXISTS sample_schema VARCHAR(255);

COMMENT ON COLUMN ${schema}.usecase_descriptions.sample_catalog IS
'Unity Catalog catalog holding the sample data for this use case. NULL falls back to the global chapter_3_lakehouse_catalog workshop parameter.';

COMMENT ON COLUMN ${schema}.usecase_descriptions.sample_schema IS
'Schema within sample_catalog whose tables become the Bronze layer data dictionary. NULL falls back to the global chapter_3_lakehouse_schema workshop parameter.';
