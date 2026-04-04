## Your Task

Deploy the locally-tested AppKit application to Databricks Apps and run comprehensive end-to-end testing.

**Workspace:** `https://adb-4101016551133680.0.azuredatabricks.ne`

> **Prerequisite:** Complete the Wire UI to Lakebase step first. Local testing via `npm run dev` must pass before deployment.

---

## Deployment Constraints
- Databricks App names must use only lowercase letters, numbers, and dashes (no underscores). Use hyphens: `my-app-name` not `my_app_name`.

---

### Step 1: Verify Local Build

Ensure the app builds and local testing has passed:
```bash
npm run build
ls dist/index.html
```

---

### Step 2: Deploy Application

```bash
databricks apps deploy
```

This handles building, syncing, and starting automatically. Use `databricks apps deploy --skip-build` for faster iteration after the first deploy.

**If errors occur:** Fix them and retry the deployment.
**If the app already exists:** Use `databricks apps deploy` — it syncs and redeploys automatically.

---

### Step 3: Derive App Name and Verify UI

```bash
FIRSTNAME=$(databricks current-user me --output json | jq -r '.userName' | cut -d'@' -f1 | cut -d'.' -f1)
LASTINITIAL=$(databricks current-user me --output json | jq -r '.userName' | cut -d'@' -f1 | cut -d'.' -f2 | cut -c1)
USERNAME="${FIRSTNAME}-${LASTINITIAL}"
APP_NAME="${USERNAME}-booking-app"
APP_URL=$(databricks apps get $APP_NAME --output json | jq -r '.url')
echo $APP_URL
```

Open the URL — you should see the web UI (not JSON). Verify:
- The UI loads correctly
- Navigation works between all pages
- Data displays from Lakebase (not placeholder/mock data)
- **ConnectionStatus indicator shows "Live Data"** (green) — not "Mock Data"

---

### Step 4: Test All Backend APIs

Test the health endpoint and all data endpoints:
```bash
curl -s "$APP_URL/health" | jq .

# Test analytics query endpoints
curl -s -X POST "$APP_URL/api/analytics/query/<your-query-key>" | jq .

# Test custom Lakebase API routes
curl -s "$APP_URL/api/<your-custom-route>" | jq .
```

Verify each response includes actual data from your Lakebase tables and `"source": "live"` (not `"source": "mock"`).

---

### Step 5: Check Logs for Lakebase Connections

```bash
databricks apps logs $APP_NAME --tail-lines 100
```

You should see these specific messages:
- `"lakebase plugin initialized"` — confirms the lakebase() plugin loaded
- `"server plugin initialized"` — confirms the server() plugin loaded
- Query execution and row count messages (logged automatically by the lakebase plugin)
- DDL/DML migration messages (CREATE TABLE, INSERT) from startup
- No ERROR-level log entries

---

### Step 6: Fix Errors (up to 3 iterations)

If any errors occur:

1. **Check the logs:**
   ```bash
   databricks apps logs $APP_NAME --tail-lines 100
   ```

2. **Common errors and fixes:**
   - `LAKEBASE_ENDPOINT is not set` → add `valueFrom: postgres` in `app.yaml` env section
   - `DATABRICKS_WAREHOUSE_ID is not set` → add `valueFrom: sql-warehouse` in `app.yaml`
   - `role "..." does not exist` → grant Lakebase permissions: open Lakebase UI → Branch Overview → Add role → databricks_superuser
   - `ERR_MODULE_NOT_FOUND` → check ESM import paths; ensure all imports use correct extensions
   - `token's identity did not match` → verify app.yaml postgres resource matches your Lakebase project name
   - `permission denied for sequence` → redeploy to re-run DDL (GRANT on sequences for SERIAL columns)

3. **Test the fix locally first:**
   ```bash
   npm run dev
   ```
   Verify the fix resolves the issue at http://localhost:8000 before redeploying.

4. **Redeploy:**
   ```bash
   databricks apps deploy
   ```

5. **Repeat up to 3 times.** If errors persist, report them for manual investigation.

---

### If the Workspace App Limit Is Reached

If deployment fails because the workspace has hit its app limit, do NOT rename your app. Instead, free up a slot:

1. Find stopped apps sorted by oldest first:
   ```bash
   databricks apps list -o json | jq -r '[.[] | select(.compute_status.state == "STOPPED")] | sort_by(.update_time) | .[0] | .name'
   ```
2. Delete it and wait:
   ```bash
   databricks apps delete <name-from-above>
   sleep 10
   ```
3. Retry the deployment.

Stop after 3 total attempts. Never delete apps in RUNNING state.

---

### Idle Connection Test (CRITICAL for Lakebase Autoscaling)

After confirming endpoints return live data, wait 3-5 minutes, then reload the app. Verify it still returns data. If queries fail after idle, check logs for "terminating connection" errors — this indicates the Lakebase connection pool needs reconnection handling.

---

### Summary

Complete when:
- Databricks App is deployed and running
- Web UI is accessible at the app URL
- **ConnectionStatus shows "Live Data"** on all pages
- All API endpoints return live data with `source: "live"`
- Lakebase connection is stable (passes idle connection test)
- No errors in the app logs