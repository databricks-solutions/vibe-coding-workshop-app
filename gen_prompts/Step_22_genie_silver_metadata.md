Extract and analyze comprehensive table and column metadata from your Silver layer schema.

This will:

- **Query table metadata** — extract table names, types, and table-level comments from `samples.information_schema.tables`
- **Query column metadata** — extract column names, data types, ordinal positions, nullability, defaults, and column-level comments from `samples.information_schema.columns`
- **Query constraints** — extract primary key and foreign key constraint definitions from `samples.information_schema.table_constraints` and `constraint_column_usage`
- **Query column tags** — extract Unity Catalog tags from `samples.information_schema.column_tags` (if available)
- **Query table tags** — extract Unity Catalog tags from `samples.information_schema.table_tags` (if available)
- **Merge and save** — combine all results into an enriched metadata CSV
- **Analyze and document** — produce a Genie analysis plan based on the metadata

**Source:** `samples.wanderbricks` (configured in the Silver Layer panel above)

Copy and paste this prompt to the AI:

```
Run the following SQL queries against samples.wanderbricks and merge the results into a comprehensive metadata file.

---

**Query 1 — Table inventory:**
SELECT table_catalog, table_schema, table_name, table_type, comment
FROM samples.information_schema.tables
WHERE table_schema = 'wanderbricks'
ORDER BY table_name

**Query 2 — Column metadata:**
SELECT table_name, column_name, ordinal_position, data_type, is_nullable, column_default, comment
FROM samples.information_schema.columns
WHERE table_schema = 'wanderbricks'
ORDER BY table_name, ordinal_position

**Query 3 — Table constraints (PKs, FKs):**
SELECT constraint_name, table_name, constraint_type
FROM samples.information_schema.table_constraints
WHERE constraint_schema = 'wanderbricks'
ORDER BY table_name, constraint_type

**Query 4 — Constraint column usage:**
SELECT constraint_name, table_name, column_name
FROM samples.information_schema.constraint_column_usage
WHERE constraint_schema = 'wanderbricks'
ORDER BY constraint_name, table_name

**Query 5 — Column tags (may not exist — skip gracefully if error):**
SELECT table_name, column_name, tag_name, tag_value
FROM samples.information_schema.column_tags
WHERE schema_name = 'wanderbricks'
ORDER BY table_name, column_name

**Query 6 — Table tags (may not exist — skip gracefully if error):**
SELECT table_name, tag_name, tag_value
FROM samples.information_schema.table_tags
WHERE schema_name = 'wanderbricks'
ORDER BY table_name

---

**Technical reference (for AI execution):**

1. Get warehouse ID:
   databricks warehouses list --output json | jq '.[0].id'

2. Execute each SQL query via Statement Execution API:
   databricks api post /api/2.0/sql/statements --json '{
     "warehouse_id": "<WAREHOUSE_ID>",
     "statement": "<SQL_QUERY>",
     "wait_timeout": "50s",
     "format": "JSON_ARRAY"
   }' > /tmp/query_N_result.json

3. For queries 5 and 6 (tags), if the table does not exist, skip gracefully and continue.

4. Merge all results into a single enriched CSV with Python:
   - Read each query result JSON
   - Join table metadata (Query 1) with column metadata (Query 2) on table_name
   - Append constraint info (Queries 3-4) as additional columns: constraint_type, constraint_name
   - Append tag info (Queries 5-6) as additional columns: column_tags, table_tags
   - Output columns: table_name, table_type, table_comment, column_name, ordinal_position, data_type, is_nullable, column_default, column_comment, constraint_type, constraint_name, column_tags, table_tags
   - Save to: data_product_accelerator/context/booking_app_Metadata.csv

5. Analyze the metadata and create docs/genie_plan.md with:
   - **Table Inventory**: List each table with its type, row purpose (inferred from table comment and column patterns), and estimated business domain
   - **Column Analysis**: Key columns per table — identify likely dimensions, measures, timestamps, and foreign keys based on data types, names, and comments
   - **Relationship Map**: Inferred relationships between tables (from FK constraints and column naming patterns like *_id)
   - **Table Relevance Assessment**: For each table, assess relevance to the use case (High/Medium/Low) with rationale
   - **Recommended Genie Space Structure**: Suggest how tables should be grouped into Genie Spaces (max 25 assets per space)
   - **Metric View Candidates**: Identify numeric columns with business context that could become Metric Views (with suggested dimensions and measures)
   - **TVF Candidates**: Suggest parameterized query patterns based on common access patterns inferred from table structure
   - **Data Lineage Notes**: Document any lineage hints from column comments or naming conventions

Known warehouse ID: <YOUR_WAREHOUSE_ID> (get via: databricks warehouses list --output json | jq '.[0].id')
```