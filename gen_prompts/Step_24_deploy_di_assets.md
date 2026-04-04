Deploy all Data Intelligence assets (TVFs, Metric Views, Genie Spaces, and AI/BI Dashboards) using @data_product_accelerator/skills/common/databricks-asset-bundles/SKILL.md and @data_product_accelerator/skills/semantic-layer/04-genie-space-export-import-api/SKILL.md

This is a **semantic layer deployment checkpoint** — it deploys and verifies all Data Intelligence assets in the correct order.

## Deployment Order (Mandatory)

Deploy in this sequence — each component depends on the previous:

```bash
# 1. Validate the bundle
databricks bundle validate -t dev

# 2. Deploy all assets to workspace
databricks bundle deploy -t dev

# 3. Deploy TVFs (SQL task — creates parameterized functions in Gold schema)
databricks bundle run -t dev tvf_job

# 4. Deploy Metric Views (Python task — creates WITH METRICS LANGUAGE YAML views)
databricks bundle run -t dev metric_views_job

# 5. Deploy AI/BI Dashboard (if applicable)
databricks bundle run -t dev dashboard_deploy_job

# 6. Deploy Genie Space via Export/Import API
#    Uses UPDATE-or-CREATE pattern with variable substitution
databricks bundle run -t dev genie_deploy_job
```

## Genie Space API Deployment

The Genie Space is deployed programmatically using the Export/Import API skill:
- JSON config exported with `${catalog}` and `${gold_schema}` template variables
- All IDs use `uuid.uuid4().hex` (32-char hex, no dashes)
- `serialized_space` is a JSON string (`json.dumps()`), not a nested object
- Data asset arrays sorted before submission (tables by `table_name`, TVFs by `function_name`)
- Genie Space MUST use a **Serverless SQL Warehouse** (non-negotiable)

## Verification

```sql
-- Verify TVFs are created
SELECT * FROM get_revenue_by_period('2024-01-01', '2024-12-31');

-- Verify Metric Views exist
SELECT table_name, table_type FROM jaiwa_vibe_coding_workshop_catalog.information_schema.tables
WHERE table_schema = 'jaiwant_j_booking_app_gold' AND table_type = 'METRIC_VIEW';

-- Test Metric View queries
SELECT MEASURE(total_revenue) FROM jaiwa_vibe_coding_workshop_catalog.jaiwant_j_booking_app_gold.revenue_analytics_metrics;
```

Target catalog: `jaiwa_vibe_coding_workshop_catalog`
Gold schema: `jaiwant_j_booking_app_gold`