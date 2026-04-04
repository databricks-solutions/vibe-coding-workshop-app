Set up the Silver layer using @data_product_accelerator/skills/silver/00-silver-layer-setup/SKILL.md

This will involve the following steps:

- **Generate SDP pipeline notebooks** — create Spark Declarative Pipeline notebooks with incremental ingestion from Bronze using Change Data Feed (CDF)
- **Create centralized DQ rules table** — build a configurable data quality rules table with expectations (null checks, range validation, referential integrity)
- **Create Asset Bundle** — generate bundle configuration for both the DQ rules setup job and the SDP pipeline
- **Deploy and run in order** — deploy the bundle, run the DQ rules setup job FIRST (creates the rules table), then run the SDP pipeline (reads rules from the table)

Ensure bundle is validated and deployed successfully, and silver layer jobs run with no errors.

Validate the results in the UI to ensure the DQ rules show up in centralized delta table, and that the silver layer pipeline runs successfully with Expectations being checked.

IMPORTANT: Use the EXISTING catalog `jaiwa_vibe_coding_workshop_catalog` -- do NOT create a new catalog. Create the Silver schema `jaiwant_j_booking_app_silver` and all Silver tables inside this catalog.

NOTE: Before creating the schema, check if `jaiwa_vibe_coding_workshop_catalog.jaiwant_j_booking_app_silver` already exists. If it does, DROP the schema with CASCADE and recreate it from scratch. These are user-specific schemas so dropping is safe.