Build an AI/BI (Lakeview) Dashboard using @data_product_accelerator/skills/monitoring/02-databricks-aibi-dashboards/SKILL.md

This will involve the following end-to-end workflow:

- **Build Lakeview dashboard** — create a complete `.lvdash.json` configuration with KPI counters, charts, data tables, and filters for business self-service analytics
- **Use 6-column grid layout** — position all widgets on a 6-column grid (NOT 12!) with correct widget versions (KPIs=v2, Charts=v3, Tables=v1, Filters=v2)
- **Query Metric Views** — write dataset queries using `MEASURE()` function against Metric Views with `${catalog}.${gold_schema}` variable substitution
- **Validate SQL and widget alignment** — run pre-deployment validation ensuring every widget `fieldName` matches its SQL alias exactly (90% reduction in dev loop time)
- **Deploy via UPDATE-or-CREATE** — use Workspace Import API with `overwrite: true` to preserve dashboard URLs and viewer permissions

Reference the dashboard plan at @data_product_accelerator/plans/phase1-addendum-1.1-dashboards.md

The skill provides:
- Dashboard JSON structure with **6-column grid** layout (NOT 12!)
- Widget patterns: KPI counters (v2), charts (v3), tables (v1), filters (v2)
- Query patterns from Metric Views using `MEASURE()` function
- Pre-deployment SQL validation (90% reduction in dev loop time)
- UPDATE-or-CREATE deployment pattern (preserves URLs and permissions)
- Variable substitution (`${catalog}`, `${gold_schema}`) — no hardcoded schemas
- Monitoring table query patterns (window structs, CASE pivots) if Lakehouse Monitors exist

Build the dashboard in this order:
1. Plan layout (KPIs, filters, charts, tables)
2. Create datasets (validated SQL queries)
3. Build widgets with correct version specs
4. Configure parameters (DATE type, not DATETIME)
5. Add Global Filters page
6. Deploy via Workspace Import API