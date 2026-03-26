/**
 * Verification Links Configuration
 *
 * Maps section_tag values to dynamic workspace URLs that let users verify
 * deployed assets directly in their Databricks workspace. URL templates
 * use {param_key} placeholders resolved at runtime from session parameters.
 *
 * Available placeholders:
 *   {workspace_url}               - Databricks workspace base URL
 *   {workspace_org_id}            - Numeric workspace org ID (for ?o= parameter)
 *   {user_app_name}               - User's deployed Databricks App name (derived from email)
 *   {app_name}                    - Workshop platform Databricks App name
 *   {lakebase_instance_name}      - Lakebase project name (autoscaling) or instance name (provisioned)
 *   {lakebase_uc_catalog_name}    - Unity Catalog name for Lakebase
 *   {lakehouse_default_catalog}   - Target catalog for Bronze/Silver/Gold
 *   {chapter_3_lakehouse_catalog} - Source catalog for metadata extraction
 *   {chapter_3_lakehouse_schema}  - Source schema for metadata extraction
 *   {user_schema_prefix}          - Derived per-user schema prefix (e.g. varunrao_b_vibe_coding)
 *   {created_by}                  - User email
 */

export interface VerificationLink {
  label: string;
  urlTemplate: string;
  description: string;
}

export const STEP_VERIFICATION_LINKS: Record<string, VerificationLink[]> = {

  // --- Chapter 2: Databricks Apps ---

  workspace_setup_deploy: [
    {
      label: 'Open Databricks App',
      urlTemplate: '{workspace_url}apps/{user_app_name}?o={workspace_org_id}',
      description: 'You should see your app running with the deployed UI. Check that the page loads and the app status shows as "Running".',
    },
  ],
  deploy_databricks_app: [
    {
      label: 'Open Databricks App',
      urlTemplate: '{workspace_url}apps/{user_app_name}?o={workspace_org_id}',
      description: 'You should see the Databricks App detail page. Confirm the app status is "Running" and click the app URL to open it.',
    },
  ],
  iterate_enhance: [
    {
      label: 'Open Databricks App',
      urlTemplate: '{workspace_url}apps/{user_app_name}?o={workspace_org_id}',
      description: 'Open the app to verify your UI enhancements are live. Check that the new features and layout changes appear correctly.',
    },
  ],
  redeploy_test: [
    {
      label: 'Open Databricks App',
      urlTemplate: '{workspace_url}apps/{user_app_name}?o={workspace_org_id}',
      description: 'Verify the redeployed app is running. The app should show "Running" status with your latest changes applied.',
    },
    {
      label: 'Open Jobs',
      urlTemplate: '{workspace_url}jobs?o={workspace_org_id}',
      description: 'You should see your pipeline jobs listed. Look for recent runs with a "Succeeded" status to confirm everything ran correctly.',
    },
  ],

  // --- Chapter 2: Lakebase ---

  setup_lakebase: [
    {
      label: 'Open Lakebase Projects',
      urlTemplate: '{workspace_url}lakebase/projects?o={workspace_org_id}',
      description: 'Opens the Lakebase projects page. Look for your project named "{user_app_name}" in the list. Click into it to see the schemas and tables created in this step. Try running a query to verify data access.',
    },
  ],
  sync_from_lakebase: [
    {
      label: 'Open Lakebase in Catalog Explorer',
      urlTemplate: '{workspace_url}explore/data/{lakebase_uc_catalog_name}?o={workspace_org_id}',
      description: 'You should see the Lakebase catalog registered in Unity Catalog. Expand the catalog to verify the schemas and tables are visible and browseable.',
    },
  ],

  // --- Chapter 3: Lakehouse ---

  bronze_table_metadata: [
    {
      label: 'Open Source Catalog',
      urlTemplate: '{workspace_url}explore/data/{chapter_3_lakehouse_catalog}/{chapter_3_lakehouse_schema}?o={workspace_org_id}',
      description: 'Opens the source schema in Catalog Explorer. You should see the source tables whose metadata was extracted for the data dictionary CSV.',
    },
  ],
  bronze_layer_creation: [
    {
      label: 'Open Bronze Schema',
      urlTemplate: '{workspace_url}explore/data/{lakehouse_default_catalog}/{user_schema_prefix}_bronze?o={workspace_org_id}',
      description: 'You should see your Bronze schema with the ingested tables. Click into each table to verify columns and preview sample data.',
    },
  ],
  silver_layer_sdp: [
    {
      label: 'Open Silver Schema',
      urlTemplate: '{workspace_url}explore/data/{lakehouse_default_catalog}/{user_schema_prefix}_silver?o={workspace_org_id}',
      description: 'You should see your Silver schema with cleaned and transformed tables. Verify column types and row counts look correct.',
    },
    {
      label: 'Open Jobs/Pipelines',
      urlTemplate: '{workspace_url}jobs?o={workspace_org_id}',
      description: 'Look for your SDP/DLT pipeline in the jobs list. It should show a recent run with "Succeeded" status confirming the Silver layer was built.',
    },
  ],
  gold_layer_design: [
    {
      label: 'Open Gold Schema',
      urlTemplate: '{workspace_url}explore/data/{lakehouse_default_catalog}/{user_schema_prefix}_gold?o={workspace_org_id}',
      description: 'You should see your Gold schema created. After the pipeline runs, this will contain the business-level aggregated tables and views.',
    },
  ],
  gold_layer_pipeline: [
    {
      label: 'Open Gold Schema',
      urlTemplate: '{workspace_url}explore/data/{lakehouse_default_catalog}/{user_schema_prefix}_gold?o={workspace_org_id}',
      description: 'Verify the Gold tables are populated with aggregated data. Click into tables to preview rows and confirm the business logic was applied.',
    },
    {
      label: 'Open Jobs/Pipelines',
      urlTemplate: '{workspace_url}jobs?o={workspace_org_id}',
      description: 'Look for your Gold pipeline job. It should show "Succeeded" status, confirming the Gold layer tables were built from Silver data.',
    },
  ],
  genie_silver_metadata: [
    {
      label: 'Open Silver Schema',
      urlTemplate: '{workspace_url}explore/data/{lakehouse_default_catalog}/{user_schema_prefix}_silver?o={workspace_org_id}',
      description: 'Browse the Silver tables used for Genie analysis. Check table metadata, column tags, and comments to verify the analysis output matches.',
    },
  ],
  genie_gold_design: [
    {
      label: 'Open Gold Schema',
      urlTemplate: '{workspace_url}explore/data/{lakehouse_default_catalog}/{user_schema_prefix}_gold?o={workspace_org_id}',
      description: 'Verify the Gold schema designed for Genie. You should see metric views and aggregation tables ready for the Genie Space.',
    },
  ],
  deploy_lakehouse_assets: [
    {
      label: 'Open Catalog Explorer',
      urlTemplate: '{workspace_url}explore/data/{lakehouse_default_catalog}?o={workspace_org_id}',
      description: 'You should see all three schemas — Bronze, Silver, and Gold — under your catalog. Expand each to verify tables are populated with data.',
    },
    {
      label: 'Open Jobs/Pipelines',
      urlTemplate: '{workspace_url}jobs?o={workspace_org_id}',
      description: 'Verify all deployment jobs completed successfully. You should see recent runs for Bronze ingestion, Silver SDP, and Gold pipelines with "Succeeded" status.',
    },
  ],

  // --- Chapter 4: Data Intelligence ---

  aibi_dashboard: [
    {
      label: 'Open SQL Dashboards',
      urlTemplate: '{workspace_url}sql/dashboards?o={workspace_org_id}',
      description: 'Look for your newly created AI/BI dashboard in the list. Open it to verify the visualizations, filters, and data connections are working correctly.',
    },
  ],
  genie_space: [
    {
      label: 'Open Genie',
      urlTemplate: '{workspace_url}genie?o={workspace_org_id}',
      description: 'You should see your Genie Space in the list. Open it and try asking a natural language question about your data to verify it responds correctly.',
    },
  ],
  deploy_di_assets: [
    {
      label: 'Open Genie',
      urlTemplate: '{workspace_url}genie?o={workspace_org_id}',
      description: 'Verify your Genie Space and any associated dashboards were deployed. Try asking a question to confirm the space is connected to your Gold layer.',
    },
    {
      label: 'Open Catalog Explorer',
      urlTemplate: '{workspace_url}explore/data/{lakehouse_default_catalog}?o={workspace_org_id}',
      description: 'Check that the semantic layer assets (metric views, table functions) are visible in your catalog under the Gold schema.',
    },
  ],
  optimize_genie: [
    {
      label: 'Open Genie',
      urlTemplate: '{workspace_url}genie?o={workspace_org_id}',
      description: 'Open your Genie Space and test with sample questions. The optimized space should provide faster, more accurate answers based on your tuning.',
    },
  ],

  // --- Chapter 5: End-to-End ---

  wire_ui_agent: [
    {
      label: 'Open Databricks App',
      urlTemplate: '{workspace_url}apps/{user_app_name}?o={workspace_org_id}',
      description: 'Verify the app is connected to the AI agent. Open the app and test the agent-powered features to confirm the wiring is working end-to-end.',
    },
  ],
};
