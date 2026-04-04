## Create Lakebase Tables from UI Design

**Workspace:** `https://adb-4101016551133680.0.azuredatabricks.ne`
**Your Lakebase Project:** `jaiwa-vibe-coding-workshop` (from Session Settings)
**Lakebase Mode:** `autoscaling`. If autoscaling, the `postgres` resource auto-injects connection credentials (PGHOST, PGUSER, etc.) and authentication uses OAuth credential generation. If provisioned, you may need to configure `PGUSER` manually via `LAKEBASE_USER_OVERRIDE`.

Read `@docs/ui_design.md` and create the database tables needed to power the UI.

---

### Step 0a: Authenticate to Databricks

```bash
databricks auth login --host https://adb-4101016551133680.0.azuredatabricks.ne
```

Verify authentication:
```bash
databricks current-user me
```

---

### Step 0b: Create Your Own Lakebase Autoscaling Project

Each participant creates their own Lakebase project for full database access.

**0a. Create the project:**
```bash
databricks postgres create-project jaiwa-vibe-coding-workshop --json '{"spec": {"display_name": "jaiwa-vibe-coding-workshop"}}'
```

**0b. Get your endpoint hostname:**
```bash
databricks postgres get-endpoint projects/jaiwa-vibe-coding-workshop/branches/production/endpoints/primary --output json
```
From the JSON output, copy the value of `status.hosts.host` — this is your `LAKEBASE_HOST`.

**0c. Optimize compute and enable scale-to-zero (saves cost):**
```bash
databricks postgres update-endpoint projects/jaiwa-vibe-coding-workshop/branches/production/endpoints/primary "spec" --json '{"spec": {"endpoint_type": "ENDPOINT_TYPE_READ_WRITE", "autoscaling_limit_min_cu": 0.5, "autoscaling_limit_max_cu": 2.0, "suspend_timeout_duration": "300s"}}'
```

Your project is now ready. Use these values below:
- **Project name:** `jaiwa-vibe-coding-workshop`
- **ENDPOINT_NAME:** `projects/jaiwa-vibe-coding-workshop/branches/production/endpoints/primary`
- **LAKEBASE_HOST:** (the hostname from Step 0b)

---

### Step 1: Read UI Design

Review `@docs/ui_design.md` to identify all data entities, their fields, and relationships needed by the UI.

---

### Step 2: Create the DDL File

Create file `db/lakebase/ddl/05_app_tables.sql` with CREATE TABLE statements for ALL entities needed by the UI:

- Use PostgreSQL syntax
- Use `jaiwant_j_booking_app` as your schema name
- Include primary keys, foreign keys, and indexes
- Include `created_at`/`updated_at` TIMESTAMP columns on every table

**DDL Guidelines for Lakebase:**
- Use `TEXT` instead of `TEXT[]` (ARRAY types) — the SQL parser may not handle ARRAY syntax
- Use `SERIAL` or `BIGSERIAL` for auto-increment primary keys
- Use `IF NOT EXISTS` on all CREATE statements for idempotency
- Avoid complex PostgreSQL-specific types that may not be supported
- Always include `CREATE SCHEMA IF NOT EXISTS jaiwant_j_booking_app;` at the top

Example structure:
```sql
CREATE SCHEMA IF NOT EXISTS jaiwant_j_booking_app;

CREATE TABLE IF NOT EXISTS jaiwant_j_booking_app.hosts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

### Step 3: Create the DML Seed File

Create file `db/lakebase/dml_seed/04_seed_app_data.sql` with INSERT statements:

- 10-15 realistic records per table for Sample industry
- Use `jaiwant_j_booking_app` as your schema name (must match DDL files)
- Insert parent tables before child tables (e.g., hosts before listings, listings before reviews)

**DML Guidelines for Lakebase:**
- Use double single quotes ('') to escape apostrophes in SQL strings (e.g., 'chef''s kitchen')
- Avoid semicolons (;) inside string values — use pipe (|) or comma as delimiters instead
- Ensure FK references match parent table row counts (if you have 10 hosts, listings.host_id must be 1-10)
- Use `ON CONFLICT DO NOTHING` for idempotent seeds

---

### Step 4: Add Startup Migration in server/server.ts

Use AppKit's `lakebase()` plugin to execute the DDL and DML files on startup. This is the AppKit pattern — the Service Principal runs migrations on first deploy:

```typescript
import { createApp, server, analytics, lakebase } from "@databricks/appkit";
import { readFileSync } from "fs";
import { join } from "path";

const AppKit = await createApp({
  plugins: [server(), analytics(), lakebase()],
});

// Read and execute DDL
const ddl = readFileSync(join(__dirname, "../db/lakebase/ddl/05_app_tables.sql"), "utf-8");
for (const stmt of ddl.split(";").filter(s => s.trim())) {
  await AppKit.lakebase.query(stmt);
}

// Read and execute DML seed
const dml = readFileSync(join(__dirname, "../db/lakebase/dml_seed/04_seed_app_data.sql"), "utf-8");
for (const stmt of dml.split(";").filter(s => s.trim())) {
  await AppKit.lakebase.query(stmt);
}
```

Use `IF NOT EXISTS` in DDL and `ON CONFLICT DO NOTHING` in DML for idempotent re-runs.

---

### Step 5: Verify app.yaml

If you used `databricks apps init` with the lakebase plugin, `app.yaml` is already configured. Verify it has a `postgres` resource pointing to `jaiwa-vibe-coding-workshop` and `LAKEBASE_ENDPOINT` set to `valueFrom: postgres`. All other PG connection variables are auto-injected at deploy time.

---

### Step 6: Deploy to Create Tables

```bash
databricks apps deploy
```

The Service Principal executes DDL/DML on first deploy. Monitor startup:

```bash
databricks apps logs $APP_NAME --tail-lines 100
```

Look for schema/table creation messages. If you see errors, fix the DDL/DML files and redeploy.

---

### Step 7: Verify Deployment

Confirm all tables exist and have data:

1. **Check logs for DDL/DML messages:**
   ```bash
   databricks apps logs $APP_NAME --tail-lines 100 | grep -i "create\|insert\|error"
   ```
   You should see CREATE TABLE and INSERT messages with no errors.

2. **Verify via local test** — start `npm run dev` locally and hit a data endpoint to confirm tables exist and contain rows. If any endpoint returns empty results, the table may not have been created or seeded.

3. **Verify row counts** — if the app has a health or status endpoint, check that it reports table existence. Otherwise, the Deploy and Test step will verify row counts via API calls.

If any table is missing, fix the DDL file and redeploy with `databricks apps deploy`.

---

### Step 8: Grant Permissions for Local Dev

Per AppKit docs, deploy first (Service Principal creates tables), then grant yourself access:

1. Open Lakebase Autoscaling UI → your project → Branch Overview
2. Click **Add role** → select your Databricks identity → check **databricks_superuser**

This gives you full DML access to tables created by the Service Principal.

---

### Step 9: Test Locally

```bash
npm run dev
```

Verify at http://localhost:8000 that the app connects to Lakebase and queries return data.

---

**If deployment fails:** Fix DDL/DML files and redeploy: `databricks apps deploy`. Retry up to 3 times.
**If auth fails:** Re-run `databricks auth login --host https://adb-4101016551133680.0.azuredatabricks.ne`.