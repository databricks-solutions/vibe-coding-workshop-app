Copy and paste this prompt to the AI:

```
## Task: Register Lakebase as a Read-Only Unity Catalog Database Catalog

Register the Lakebase PostgreSQL database as a Unity Catalog database catalog so that all tables are automatically accessible via SQL, notebooks, and ETL pipelines with zero ETL.

### Configuration
- **Catalog name:** jaiwa_vibe_coding_workshop_catalog
- **Lakebase project/instance:** jaiwa-vibe-coding-workshop
- **Lakebase mode:** autoscaling (autoscaling or provisioned)
- **Database name:** databricks_postgres (standard Lakebase database)
- **SQL Warehouse:** Serverless Starter Warehouse

### Step 1: Check if Catalog Already Exists

Run the following CLI command to check whether the catalog has already been registered:

```bash
databricks catalogs get jaiwa_vibe_coding_workshop_catalog
```

- If the command returns catalog info with **state: ACTIVE**, the catalog is already registered. Print a confirmation message: "Catalog 'jaiwa_vibe_coding_workshop_catalog' already exists and is ACTIVE. Skipping creation."
- If the command returns an error (e.g., "CATALOG_DOES_NOT_EXIST" or "not found"), proceed to Step 2.

### Step 2: Create the Database Catalog (only if it does not exist)

Register the Lakebase PostgreSQL database as a read-only Unity Catalog catalog. The command depends on the Lakebase mode:

**If autoscaling** — use the REST API:

```bash
databricks api post /api/2.0/postgres/catalogs --json '{"catalog_name": "jaiwa_vibe_coding_workshop_catalog", "project_id": "jaiwa-vibe-coding-workshop", "database_name": "databricks_postgres"}'
```

**If provisioned** — use the CLI:

```bash
databricks database create-database-catalog jaiwa_vibe_coding_workshop_catalog jaiwa-vibe-coding-workshop databricks_postgres
```

After creation, verify the catalog state:

```bash
databricks catalogs get jaiwa_vibe_coding_workshop_catalog
```

Confirm the output shows **state: ACTIVE**. If the state is not ACTIVE, wait a few seconds and check again.

### Step 3: List All Schemas in the Catalog

Whether the catalog was just created or already existed, always run this final verification step to display all available schemas:

```sql
SELECT schema_name 
FROM jaiwa_vibe_coding_workshop_catalog.information_schema.schemata 
ORDER BY schema_name;
```

Run this SQL query using the SQL Warehouse **Serverless Starter Warehouse**. Display the results to confirm which schemas are available in the registered catalog.

### Expected Result:
- Catalog `jaiwa_vibe_coding_workshop_catalog` is registered and ACTIVE in Unity Catalog
- All schemas from the Lakebase PostgreSQL database are listed and visible
- Tables within those schemas are now queryable via standard SQL (e.g., `SELECT * FROM jaiwa_vibe_coding_workshop_catalog.<schema>.<table>`)
```