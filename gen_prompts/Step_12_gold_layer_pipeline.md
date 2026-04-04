Implement the Gold layer using @data_product_accelerator/skills/gold/01-gold-layer-setup/SKILL.md

This will involve the following steps:

- **Read YAML schemas** — use the Gold layer design YAML files (from Step 9) as the single source of truth for all table definitions, columns, and constraints
- **Create Gold tables** — generate CREATE TABLE DDL from YAML, add PRIMARY KEY constraints, then add FOREIGN KEY constraints (NOT ENFORCED) in dependency order
- **Merge data from Silver** — deduplicate Silver records before MERGE, map columns using YAML lineage metadata, merge dimensions first (SCD1/SCD2) then facts (FK dependency order)
- **Deploy 2-job architecture** — gold_setup_job (2 tasks: create tables + add FK constraints) and gold_merge_job (populate data from Silver)
- **Validate results** — verify table creation, PK/FK constraints, row counts, SCD2 history, and fact-dimension joins

Use the gold layer design YAML files as the target destination, and the silver layer tables as source.

Limit pipelines to only 5 core tables for purposes of this exercise.

IMPORTANT: Use the EXISTING catalog `jaiwa_vibe_coding_workshop_catalog` -- do NOT create a new catalog. Create the Gold schema `jaiwant_j_booking_app_gold` and all Gold tables inside this catalog.

NOTE: Before creating the schema, check if `jaiwa_vibe_coding_workshop_catalog.jaiwant_j_booking_app_gold` already exists. If it does, DROP the schema with CASCADE and recreate it from scratch. These are user-specific schemas so dropping is safe.