Set up the Bronze layer using @data_product_accelerator/skills/bronze/00-bronze-layer-setup/SKILL.md with Approach C — copy data from the existing source tables in the samples.wanderbricks schema.

This will involve the following steps:

- **Clone all source tables** from the samples.wanderbricks schema into your target catalog's Bronze schema
- **Apply enterprise table properties** — enable Change Data Feed (CDF), Liquid Clustering (CLUSTER BY AUTO), auto-optimize, and auto-compact on every table
- **Preserve source COMMENTs** — carry over all column-level documentation from the source schema
- **Create Asset Bundle job** — generate a repeatable, version-controlled deployment job (databricks.yml + clone script)
- **Deploy and run** — validate, deploy the bundle, and execute the clone job to populate Bronze tables

IMPORTANT: Use the EXISTING catalog `jaiwa_vibe_coding_workshop_catalog` -- do NOT create a new catalog. Create the Bronze schema `jaiwant_j_booking_app_bronze` and tables inside this catalog.

NOTE: Before creating the schema, check if `jaiwa_vibe_coding_workshop_catalog.jaiwant_j_booking_app_bronze` already exists. If it does, DROP the schema with CASCADE and recreate it from scratch. These are user-specific schemas so dropping is safe.