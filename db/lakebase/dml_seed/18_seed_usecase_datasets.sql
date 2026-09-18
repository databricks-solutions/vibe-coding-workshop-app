-- =============================================================================
-- SEED DATA: PER-USE-CASE SAMPLE DATASETS
-- =============================================================================
-- Fills in usecase_descriptions.sample_catalog / sample_schema (added by
-- ddl/14_add_usecase_dataset.sql) so a Retail workshop stops sourcing a
-- hotel-booking dataset.
--
-- Why by industry rather than per use case: `samples` ships exactly two schemas
-- with an app-shaped transactional model, and each maps cleanly onto whole
-- industries. Verified against the workspace:
--
--   samples.bakehouse    sales_transactions, sales_customers, sales_franchises,
--                        sales_suppliers, media_customer_reviews,
--                        media_gold_reviews_chunked
--                        -> a franchise sales model: transactions, customers,
--                           outlets, suppliers, reviews. This is the retail/CPG
--                           shape (stores, SKUs, baskets, supply, sentiment).
--
--   samples.wanderbricks bookings, properties, hosts, users, payments, reviews,
--                        destinations, clickstream, page_views, amenities, ...
--                        -> a travel marketplace. Correct for travel, and for
--                           the Sample booking app that is literally built on it.
--
-- So: retail + cpg -> bakehouse; travel + sample -> wanderbricks (unchanged
-- behaviour for those two, made explicit rather than inherited by accident).
--
-- Idempotency contract:
--   * Guarded on `sample_catalog IS NULL`, so this only ever fills a blank. An
--     admin who points a use case at their own catalog keeps it across every
--     redeploy — the same posture as the `updated_by = 'seed'` guards in seed 08.
--   * Deliberately NOT guarded on version/is_active: the columns describe the
--     (industry, use_case) pair rather than one revision of its prose, so every
--     row of a versioned use case should agree on its dataset.
--
-- Runs as a POST_SEED_MIGRATION (scripts/setup-lakebase.sh) so existing installs
-- get the fix without a destructive --recreate.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

-- Retail and CPG: the bakery-franchise sales model.
UPDATE ${schema}.usecase_descriptions
SET sample_catalog = 'samples',
    sample_schema  = 'bakehouse',
    updated_at     = CURRENT_TIMESTAMP
WHERE industry IN ('retail', 'cpg')
  AND sample_catalog IS NULL;

-- Travel & Hospitality: the booking marketplace it was always meant to be.
UPDATE ${schema}.usecase_descriptions
SET sample_catalog = 'samples',
    sample_schema  = 'wanderbricks',
    updated_at     = CURRENT_TIMESTAMP
WHERE industry = 'travel'
  AND sample_catalog IS NULL;

-- Sample path: the demo booking app is built on wanderbricks by design.
UPDATE ${schema}.usecase_descriptions
SET sample_catalog = 'samples',
    sample_schema  = 'wanderbricks',
    updated_at     = CURRENT_TIMESTAMP
WHERE industry = 'sample'
  AND sample_catalog IS NULL;

-- Any industry added later without an explicit dataset falls back to the global
-- workshop parameter, which is the pre-existing behaviour. Nothing to seed here;
-- this comment exists so the omission reads as deliberate.
