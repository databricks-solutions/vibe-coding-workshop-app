## Bronze Layer Creation

Schema: @data_product_accelerator/context/booking_app_Schema.csv
Skill: @data_product_accelerator/skills/bronze/00-bronze-layer-setup/SKILL.md
Approach: **A — Schema CSV + Faker** (DDLs + test data)

This will involve the following steps:

1. **Requirements** — Parse the schema CSV, classify tables (dims vs facts), identify FK relationships
2. **Table DDLs** — Generate `setup_tables.py` with CREATE TABLE for all tables (CLUSTER BY AUTO, CDF, TBLPROPERTIES)
3. **Faker Data** — Generate dimension + fact data scripts with seeded Faker, non-linear distributions, 5% corruption rate
4. **Asset Bundle Jobs** — Create job YAMLs for table creation and data generation (Serverless, Environments V4)
5. **Deploy & Validate** — After all artifacts are created, deploy and run:
   - `databricks bundle deploy -t dev`
   - `databricks bundle run bronze_setup_job -t dev`
   - `databricks bundle run bronze_data_generator_job -t dev`
   - Run validation queries to confirm tables exist, row counts are correct, and CDF is enabled