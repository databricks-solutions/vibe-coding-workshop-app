## Deploy AppKit Application

**Workspace:** `https://adb-4101016551133680.0.azuredatabricks.ne`

App names must use lowercase letters, numbers, and dashes only.

---

### Step 1: Derive App Name

```bash
FIRSTNAME=$(databricks current-user me --output json | jq -r '.userName' | cut -d'@' -f1 | cut -d'.' -f1)
LASTINITIAL=$(databricks current-user me --output json | jq -r '.userName' | cut -d'@' -f1 | cut -d'.' -f2 | cut -c1)
APP_NAME="${FIRSTNAME}-${LASTINITIAL}-booking-app"
```

Verify `app.yaml` name matches: `grep -E "^name:" app.yaml`

---

### Step 2: Verify Frontend Build

Ensure the frontend build exists before deploying:
```bash
ls dist/index.html 2>/dev/null || npm run build
```
If `dist/index.html` does not exist, the deployed app will show JSON instead of the web UI.

---

### Step 3: Deploy

```bash
databricks apps deploy
```

This builds, syncs, and starts the app automatically. Use `--skip-build` for faster iteration after the first deploy.

---

### Step 4: Verify

```bash
APP_URL=$(databricks apps get $APP_NAME --output json | jq -r '.url')
echo $APP_URL
```

Open the URL — the web UI should load (not raw JSON).

---

### Step 5: Check Logs and Fix Errors (up to 3 iterations)

```bash
databricks apps logs $APP_NAME --tail-lines 50
```

Common errors:
- `LAKEBASE_ENDPOINT is not set` → add `valueFrom: postgres` in `app.yaml`
- `DATABRICKS_WAREHOUSE_ID is not set` → add `valueFrom: sql-warehouse` in `app.yaml`
- `ERR_MODULE_NOT_FOUND` → check ESM import paths; ensure all imports use correct extensions
- `role "..." does not exist` → grant Lakebase permissions: open Lakebase UI → Branch Overview → Add role → databricks_superuser

Fix and redeploy: `databricks apps deploy`

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

### Troubleshooting: JSON Instead of Web UI

If you open the app URL and see raw JSON instead of your web UI:
- The frontend build was not included in the deploy.
- Run `npm run build` to generate the `dist/` folder, then redeploy with `databricks apps deploy`.

---

Complete when: app deployed, UI loads (not JSON), plugins initialized, no errors in logs.