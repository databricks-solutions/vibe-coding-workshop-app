## Design Silver Layer Schema from PRD

The business requirements are documented in @docs/design_prd.md.

---

### Instructions

Based on the PRD, design a **normalized relational silver layer schema** for the **Booking App** use case and save it as an enriched metadata CSV.

Copy and paste this prompt to the AI:

```
Read the PRD at @docs/design_prd.md and design a complete silver layer database schema for the **Booking App** use case.

**Output file:** data_product_accelerator/context/booking_app_Metadata.csv

**Schema design requirements:**
1. Design 5-15 silver layer tables covering all entities, relationships, and transactional data described in the PRD
2. Include primary keys (BIGINT, first column per table) and foreign keys referencing related tables
3. Use Spark SQL data types: STRING, BIGINT, INT, DOUBLE, DECIMAL(precision,scale), BOOLEAN, DATE, TIMESTAMP
4. Add descriptive comments for every column explaining its business meaning
5. Include standard operational columns per table: created_at (TIMESTAMP), updated_at (TIMESTAMP), is_active (BOOLEAN)
6. Use snake_case for all table and column names
7. Design for analytics — include fact tables with numeric measures and dimension tables with descriptive attributes

**CSV format (enriched metadata compatible):**
```csv
table_name,table_type,table_comment,column_name,ordinal_position,data_type,is_nullable,column_default,column_comment,constraint_type,constraint_name,column_tags,table_tags
<table_name>,MANAGED,<table description>,<column_name>,<position>,<type>,<YES/NO>,,<column description>,<PK/FK/empty>,<constraint_name_or_empty>,,
```

One row per column, all tables included. ordinal_position restarts at 1 for each table.

**After creating the CSV, validate and enrich:**
1. Verify required columns: table_name, table_type, table_comment, column_name, data_type, ordinal_position, is_nullable, column_comment
2. Check ordinal_position is sequential per table (1, 2, 3...) — fix gaps
3. Fill empty column_comment fields with descriptions inferred from column_name and table_name
4. Fill empty table_comment fields with descriptions of the table's business purpose
5. Mark primary key columns with constraint_type=PK
6. Mark foreign key columns with constraint_type=FK and constraint_name referencing the target table
7. Normalize data_type to Spark SQL types (VARCHAR -> STRING, INT -> INTEGER, FLOAT -> DOUBLE)
8. Print verification summary: total tables, total columns, file path, fixes applied

**Then create the analysis document** at docs/genie_plan.md with:
- **Table Inventory**: List each table with its type, purpose, and business domain
- **Column Analysis**: Key columns per table — identify dimensions, measures, timestamps, and foreign keys
- **Relationship Map**: Relationships between tables (from FK constraints and naming patterns like *_id)
- **Table Relevance Assessment**: For each table, assess relevance to the use case (High/Medium/Low)
- **Recommended Genie Space Structure**: Suggest how tables should be grouped into Genie Spaces (max 25 assets per space)
- **Metric View Candidates**: Identify numeric columns that could become Metric Views (with suggested dimensions and measures)
- **TVF Candidates**: Suggest parameterized query patterns based on common access patterns

**Downstream Compatibility Note:**
This CSV drives the Genie Accelerator pipeline:
- Gold Design (Step 11) — reads CSV for dimensional model design
- Deploy Assets (Step 23) — uses schema to create and populate tables
- Optimize Genie (Step 25) — uses analysis for Genie Space configuration
```