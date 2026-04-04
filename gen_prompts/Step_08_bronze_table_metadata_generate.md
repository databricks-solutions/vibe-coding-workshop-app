## Design Database Schema from PRD

The business requirements are documented in @docs/design_prd.md.

---

### Instructions

Based on the PRD, design a **normalized relational schema** for the **Booking App** use case and save it as a CSV file.

Copy and paste this prompt to the AI:

```
Read the PRD at @docs/design_prd.md and design a complete database schema for the **Booking App** use case.

**Output file:** data_product_accelerator/context/booking_app_Schema.csv

**Schema design requirements:**
1. Design 5-15 tables covering all entities, relationships, and transactional data described in the PRD
2. Include primary keys (BIGINT, first column per table) and foreign keys referencing related tables
3. Use Spark SQL data types: STRING, BIGINT, INT, DOUBLE, DECIMAL(precision,scale), BOOLEAN, DATE, TIMESTAMP
4. Add descriptive comments for every column explaining its business meaning
5. Include standard operational columns per table: created_at (TIMESTAMP), updated_at (TIMESTAMP), is_active (BOOLEAN)
6. Use snake_case for all table and column names
7. Design for analytics — include fact tables with numeric measures and dimension tables with descriptive attributes

**CSV format (information_schema.columns compatible):**
```csv
table_catalog,table_schema,table_name,column_name,ordinal_position,data_type,is_nullable,comment
samples,wanderbricks,<table_name>,<column_name>,<position>,<type>,<YES/NO>,<description>
```

One row per column, all tables included. ordinal_position restarts at 1 for each table.

**After creating the CSV, validate and enrich:**
1. Verify required columns: table_name, column_name, data_type, ordinal_position, is_nullable, comment
2. Check ordinal_position is sequential per table (1, 2, 3...) — fix gaps
3. Fill empty comment fields with descriptions inferred from column_name and table_name
4. Normalize data_type to Spark SQL types (VARCHAR -> STRING, INT -> INTEGER, FLOAT -> DOUBLE)
5. Print verification summary: total tables, total columns, file path, fixes applied

**Downstream Compatibility Note:**
This CSV drives the entire Design-First Pipeline:
- Gold Design (Step 11) — reads CSV for dimensional model design
- Bronze Creation (Step 12) — uses schema to create Delta tables
- Silver DQ (Step 13) — uses schema for data quality expectations
- Gold Implementation (Step 14) — uses YAML schemas derived from this CSV
```