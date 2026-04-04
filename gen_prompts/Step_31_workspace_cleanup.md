Clean up all Databricks resources created during the Vibe Coding Workshop. Delete every resource safely — if it exists, delete it; if it does not exist, skip it and move on. Never fail on a missing resource.

---

## Workspace Context

- **Workspace URL**: https://adb-4101016551133680.0.azuredatabricks.ne
- **User App Name**: jaiwant-j-booking-app
- **Lakebase Project/Instance**: jaiwa-vibe-coding-workshop
- **Lakebase UC Catalog**: jaiwa_vibe_coding_workshop_catalog
- **Lakehouse Catalog**: jaiwa_vibe_coding_workshop_catalog
- **User Schema Prefix**: jaiwant_j_booking_app
- **User Email**: {created_by}

---

## IMPORTANT: Safety Rules

1. **Inventory first** — before deleting anything, list every resource that will be affected and print a summary.
2. **Confirm with the user** — after showing the inventory, ask for explicit confirmation before proceeding.
3. **If-exists checks** — every delete operation must check existence first. If the resource is not found, print a skip message and continue.
4. **Dependency order** — delete in the correct order to avoid dependency errors (children before parents, consumers before producers).
5. **Never delete resources outside the workshop scope** — only target resources matching the naming patterns below.
6. **Report results** — at the end, print a summary table showing each resource, whether it was deleted or skipped, and any errors.

---

## Resources to Clean Up (in order)

### Phase 1: Jobs and Pipelines
Delete all Databricks jobs whose name contains `jaiwant_j_booking_app` or that are tagged with `project=vibe_coding_workshop`.

```bash
# List matching jobs
databricks jobs list --output json | python3 -c "
import sys, json
jobs = json.load(sys.stdin).get('jobs', [])
for j in jobs:
    name = j.get('settings', {}).get('name', '')
    tags = j.get('settings', {}).get('tags', {})
    if 'jaiwant_j_booking_app' in name or tags.get('project') == 'vibe_coding_workshop':
        print(f\"Job {j['job_id']}: {name}\")
"

# Delete each matching job
databricks jobs delete --job-id <JOB_ID>
```

### Phase 2: AI/BI Dashboards
Delete Lakeview dashboards owned by `{created_by}` or whose name contains `jaiwant_j_booking_app`.

```bash
# List dashboards
databricks lakeview list --output json

# Delete matching dashboards
databricks lakeview delete <DASHBOARD_ID>
```

### Phase 3: Genie Spaces
Delete Genie rooms created by the user. Use the Genie REST API:

```bash
# List Genie rooms
databricks api get /api/2.0/genie/spaces

# Delete matching Genie room
databricks api delete /api/2.0/genie/spaces/<SPACE_ID>
```

### Phase 4: Model Serving Endpoints (Agents)
Delete any model serving endpoints whose name contains `jaiwant_j_booking_app` or that were created for the workshop agent.

```bash
# List serving endpoints
databricks serving-endpoints list --output json

# Delete matching endpoint
databricks serving-endpoints delete <ENDPOINT_NAME>
```

### Phase 5: Lakehouse Schemas (Bronze / Silver / Gold)
Drop the three medallion schemas from Unity Catalog. Use CASCADE to remove all tables and views within them.

```sql
DROP SCHEMA IF EXISTS `jaiwa_vibe_coding_workshop_catalog`.`jaiwant_j_booking_app_bronze` CASCADE;
DROP SCHEMA IF EXISTS `jaiwa_vibe_coding_workshop_catalog`.`jaiwant_j_booking_app_silver` CASCADE;
DROP SCHEMA IF EXISTS `jaiwa_vibe_coding_workshop_catalog`.`jaiwant_j_booking_app_gold` CASCADE;
```

Run via CLI:
```bash
databricks sql execute --warehouse-id <WAREHOUSE_ID> --statement "DROP SCHEMA IF EXISTS \`jaiwa_vibe_coding_workshop_catalog\`.\`jaiwant_j_booking_app_bronze\` CASCADE"
databricks sql execute --warehouse-id <WAREHOUSE_ID> --statement "DROP SCHEMA IF EXISTS \`jaiwa_vibe_coding_workshop_catalog\`.\`jaiwant_j_booking_app_silver\` CASCADE"
databricks sql execute --warehouse-id <WAREHOUSE_ID> --statement "DROP SCHEMA IF EXISTS \`jaiwa_vibe_coding_workshop_catalog\`.\`jaiwant_j_booking_app_gold\` CASCADE"
```

### Phase 6: Lakebase Unity Catalog Registration
Drop the UC database catalog that was created when registering Lakebase in Unity Catalog (Step 9).

```bash
databricks sql execute --warehouse-id <WAREHOUSE_ID> --statement "DROP CATALOG IF EXISTS \`jaiwa_vibe_coding_workshop_catalog\` CASCADE"
```

Or via CLI:
```bash
databricks unity-catalog catalogs delete jaiwa_vibe_coding_workshop_catalog --force
```

### Phase 7: Lakebase Project / Schema

**IMPORTANT**: The behavior here depends on the Lakebase mode.

**Autoscaling mode** — the workshop created a dedicated Lakebase project, so it is safe to delete the entire project:
```bash
databricks postgres delete-project --project-id jaiwa-vibe-coding-workshop
```

**Provisioned mode** — the workshop uses a **shared** Lakebase instance and only created a schema inside it. **DO NOT delete the instance** — other users may be sharing it. Only drop the workshop schema:
```bash
# Drop the workshop schema from the shared Lakebase instance (provisioned mode only)
# Connect to the Lakebase PostgreSQL instance and run:
DROP SCHEMA IF EXISTS jaiwant_j_booking_app CASCADE;
```
If unsure which mode was used, check `user-config.yaml` for `lakebase.mode` (`autoscaling` or `provisioned`). When in doubt, only drop the schema — never delete the instance.

### Phase 8: Databricks App
Stop and delete the user's deployed Databricks App.

```bash
# Stop the app first (ignore error if already stopped)
databricks apps stop jaiwant-j-booking-app || true

# Delete the app
databricks apps delete jaiwant-j-booking-app
```

### Phase 9: Databricks Asset Bundle (DAB)
If you are inside the user's cloned template repository, destroy the DAB bundle to remove any remaining workspace files.

```bash
databricks bundle destroy --auto-approve
```

### Phase 10: Skill Validation Assets (if Agent Skills track was used)
Delete the skill validation job and notebook if they exist.

```bash
# Find and delete skill_validation_job
databricks jobs list --output json | python3 -c "
import sys, json
jobs = json.load(sys.stdin).get('jobs', [])
for j in jobs:
    if 'skill_validation' in j.get('settings', {}).get('name', '').lower():
        print(j['job_id'])
"
# databricks jobs delete --job-id <JOB_ID>
```

---

## Output: Summary Report

After running all phases, print a summary like this:

```
============================================================
                 WORKSHOP CLEANUP SUMMARY
============================================================
| Resource                        | Status
|---------------------------------|---------------------------
| Jobs / Pipelines                | Deleted (3) / Skipped (0)
| AI/BI Dashboards                | Deleted (1) / Skipped (0)
| Genie Spaces                    | Deleted (1) / Skipped (0)
| Model Serving Endpoints         | Skipped (not found)
| Bronze Schema                   | Deleted
| Silver Schema                   | Deleted
| Gold Schema                     | Deleted
| Lakebase UC Catalog             | Deleted
| Lakebase Project                | Deleted
| Databricks App                  | Deleted
| DAB Bundle                      | Destroyed
| Skill Validation Assets         | Skipped (not found)
============================================================
| Total: 10 deleted, 2 skipped, 0 errors
============================================================
```

---

## Execution Approach

Create a single cleanup shell script called `cleanup.sh` that:
1. Accepts the workspace context variables above (or reads them from environment / `user-config.yaml`)
2. Runs each phase in order
3. Wraps every delete in a try/catch (bash: `|| true` with error capture)
4. Prints the summary report at the end
5. Returns exit code 0 even if some resources were not found (skip is not an error)

Alternatively, execute the phases interactively one at a time using the Databricks CLI, confirming with the user between phases.