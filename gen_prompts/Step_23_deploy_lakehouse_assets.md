Deploy and run all Bronze, Silver, and Gold layer jobs end-to-end using @data_product_accelerator/skills/common/databricks-asset-bundles/SKILL.md and @data_product_accelerator/skills/common/databricks-autonomous-operations/SKILL.md

This is a **deployment checkpoint** — it validates and runs the complete Lakehouse pipeline in dependency order.

## Deployment Order (Mandatory)

Run these commands in strict sequence — each stage depends on the previous one:

```bash
# 1. Validate the bundle (catches config errors before deploy)
databricks bundle validate -t dev

# 2. Deploy all assets to workspace
databricks bundle deploy -t dev

# 3. Run Bronze clone job (creates Bronze tables from source)
databricks bundle run -t dev bronze_clone_job

# 4. Run Silver DQ setup job FIRST (creates dq_rules table — must exist before pipeline)
databricks bundle run -t dev silver_dq_setup_job

# 5. Run Silver DLT pipeline (reads from Bronze via CDF, applies DQ rules)
databricks bundle run -t dev silver_dlt_pipeline

# 6. Run Gold setup job (creates tables from YAML + adds PK/FK constraints)
databricks bundle run -t dev gold_setup_job

# 7. Run Gold merge job (deduplicates Silver → merges into Gold)
databricks bundle run -t dev gold_merge_job
```

If any job fails, use the autonomous operations skill to diagnose and fix:
- Get the failed task `run_id` (not the parent job `run_id`)
- Run `databricks runs get-run-output --run-id <TASK_RUN_ID>` to diagnose
- Apply fix and redeploy (max 3 iterations before escalation)

## Verification Queries

After all jobs complete successfully, verify end-to-end:

```sql
-- Bronze: verify tables and CDF
SHOW TABLES IN jaiwa_vibe_coding_workshop_catalog.jaiwant_j_booking_app_bronze;

-- Silver: verify DQ rules and cleaned tables
SELECT COUNT(*) FROM jaiwa_vibe_coding_workshop_catalog.jaiwant_j_booking_app_silver.dq_rules;
SHOW TABLES IN jaiwa_vibe_coding_workshop_catalog.jaiwant_j_booking_app_silver;

-- Gold: verify tables, constraints, and row counts
SHOW TABLES IN jaiwa_vibe_coding_workshop_catalog.jaiwant_j_booking_app_gold;
SELECT * FROM jaiwa_vibe_coding_workshop_catalog.information_schema.table_constraints
WHERE table_schema = 'jaiwant_j_booking_app_gold';
```

Target catalog: `jaiwa_vibe_coding_workshop_catalog`
Target schemas: `jaiwant_j_booking_app_bronze`, `jaiwant_j_booking_app_silver`, `jaiwant_j_booking_app_gold`