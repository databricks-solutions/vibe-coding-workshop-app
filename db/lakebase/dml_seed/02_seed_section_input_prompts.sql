-- =============================================================================
-- SEED DATA: SECTION INPUT PROMPTS
-- =============================================================================
-- order_number determines display order on Configuration UI (ascending)
-- how_to_apply and expected_output are user-facing content shown after prompt generation
-- Updated for 30-step workflow (Steps 1 & 2 are handled elsewhere: usecase selection & project setup)
--
-- TEMPLATE VARIABLES (automatically substituted at runtime):
--   {industry_name}           - Formatted industry name
--   {use_case_title}          - Formatted use case title
--   {use_case_description}    - Full use case description
--   {workspace_url}           - From Workshop Parameters config
--   {lakebase_instance_name}  - From Workshop Parameters config (Lakebase instance name)
--   {lakebase_host_name}      - From Workshop Parameters config (Lakebase host DNS)
--   {default_warehouse}       - From Workshop Parameters config
--   {use_case_slug}            - Derived per-session: e.g. booking-app (hyphens)
--   {user_schema_prefix}      - Derived per-session: e.g. varunrao_b_booking_app
--   {prd_document}            - PRD from previous step
--   {table_metadata}          - Table metadata from previous step
--
-- Foundation (Steps 1-3)
--   Step 1 = Pick Use Case (handled by usecase_selection UI)
--   Step 2 = Set Up Project (handled by project_setup UI)
--   Step 3 = PRD Generation
--
-- Chapter 1: Databricks App (Steps 4-5)
--   Step 4 = UI Design
--   Step 5 = Deploy App
--
-- Chapter 2: Lakebase (Steps 6-8)
--   Step 6 = Setup Lakebase
--   Step 7 = Wire UI to Lakebase
--   Step 8 = Deploy and Test
--
-- Chapter 3: Lakehouse (Steps 9-14)
--   Step 9 = Sync from Lakebase (only shows when Lakebase ch2 is visible)
--   Step 10 = Table Metadata
--   Step 11 = Gold Layer Design
--   Step 12 = Bronze Layer Creation
--   Step 13 = Silver Layer
--   Step 14 = Gold Pipeline
--
-- Chapter 4: Data Intelligence (Steps 15-19)
--   Step 15 = Use-Case Plan
--   Step 16 = AI/BI Dashboard
--   Step 17 = Genie Space
--   Step 18 = Build Agent
--   Step 19 = Wire UI to Agent
--
-- Refinement (Steps 20-21)
--   Step 20 = Iterate & Enhance
--   Step 21 = Redeploy & Test
--
-- Clean Up (Step 31)
--   Step 31 = Workspace Clean Up
-- =============================================================================

-- Product Requirements Document (PRD)
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, version, is_active, inserted_at, updated_at, created_by)
VALUES
(1, 'prd_generation',
'Generate a prompt that I can copy into my AI coding assistant (Cursor/Copilot) to create a simple Product Requirements Document (PRD).

The generated prompt MUST include these instructions at the very beginning:

```
## IMPORTANT - READ FIRST
Your ONLY task is to create a PRD document. Do NOT:
- Generate any code or scripts
- Create any implementation files
- Start building the application
- Define table structures, schemas, or database designs
- Create table names or data models
- Define API endpoints, routes, or API specifications
- Include implementation-specific logic or technical details
- Do anything other than creating the PRD

You MUST:
- Create ONLY the PRD document
- Save it to: docs/design_prd.md
- STOP after saving the PRD - do nothing else
```

After those instructions, the prompt should ask for a simple, focused PRD for a {industry_name} application focused on {use_case_title}.

## Use Case Context to Include
{use_case_description}

## Application Context to Include
- **Industry**: {industry_name}
- **Use Case**: {use_case_title}
- Use a neutral, professional product name and generic terminology
- Web first, but include mobile considerations if applicable

## PRD Focus Guidelines
**Keep it simple** - Focus on providing enough details to generate a clear, readable PRD without over-engineering.

**Important Constraints:**
- Do NOT include table definitions, table names, or database schema designs - these will come in later steps
- Do NOT include API definitions, endpoints, or implementation-specific logic
- Only focus on **High Value workflows**
- Document **Happy Path only** - skip edge cases and error handling details for now
- Prioritize clarity over completeness

## PRD Structure to Request
The generated prompt should ask for a PRD with these sections:

1. **Summary** - Product vision, problem statement, target personas (2-3 max), goals + non-goals
2. **Scope** - MVP scope only, clear out of scope items
3. **User Journeys** - High-value end-to-end flows (Happy Path only) for primary personas
4. **Functional Requirements** - Key requirements with simple acceptance criteria
5. **Non-Functional Requirements** - Basic performance, security, accessibility notes
6. **High-Level Data Entities** - Entity names and relationships only (NO table definitions or schemas)
7. **Release Plan** - Simple milestones from MVP to GA

The prompt MUST end with:
```
Save this PRD to: docs/design_prd.md
STOP after saving. Do not generate any code, tables, APIs, or proceed with other tasks.
```',
'You are generating a prompt that users will copy into their AI coding assistant.

Your output should be a complete, ready-to-use prompt that when pasted into Cursor or Copilot will:
1. Create ONLY a simple Product Requirements Document
2. Save it to docs/design_prd.md
3. NOT generate any code, scripts, table definitions, or API specifications

CRITICAL: Your generated prompt MUST start with clear instructions telling the AI to ONLY create the PRD document and save it to docs/design_prd.md, and to NOT do anything else. Focus on High Value workflows with Happy Path only.

The prompt should be focused and specific to {use_case_title}, incorporating the use case context provided.

**OUTPUT FORMAT RULES:**
- Output the prompt directly as plain markdown text - do NOT wrap the entire output in code blocks or backticks
- Use proper markdown formatting: ## for headers, - for bullet points, **text** for bold
- For code blocks within your output (like file paths or specific instructions to include verbatim), use triple backticks on their own lines
- Do NOT use single backticks for multi-line content
- The output should render properly when displayed as markdown',
'Product Requirements Document (PRD)',
'Generate a simple PRD that defines what the application does and its key high-value features',
3,
'## Prerequisite

**Run this in your cloned Template Repository** (see Prerequisites in Step 0). These prompts assume you are working in that codebase with a coding assistant (Cursor or Copilot) enabled.

---

## Steps to Apply

1. **Copy the generated prompt** using the copy button
2. **Paste it into your AI coding assistant** (Cursor or VS Code with Copilot)
3. **Let the AI generate the PRD** - it will create a `docs/design_prd.md` file
4. **Review the generated PRD** carefully
   - Validate assumptions
   - Ensure all user personas are accurately represented
5. **DO NOT proceed to the next step** until you are satisfied with the PRD

**IMPORTANT:** This step ONLY generates the PRD document. No code or scripts should be created.

---

## After Generation

1. **Customize user personas** based on your actual target users
2. **Prioritize features** using MoSCoW method
3. **Refine acceptance criteria** - ensure all Given/When/Then scenarios are testable
4. **Get stakeholder sign-off** before proceeding to design',
'## Expected PRD Deliverables

### Document Sections
- **Summary** - Product vision, problem statement, personas, goals
- **Scope** - MVP vs V1/V2 with MoSCoW prioritization
- **User Journeys** - End-to-end flows with success/failure paths
- **Functional Requirements** - Numbered requirements with acceptance criteria
- **Non-Functional Requirements** - Performance, security, accessibility
- **Data & System Design** - Entity model, APIs, integrations
- **Risks & Dependencies** - What could go wrong
- **Release Plan** - Milestones from MVP to GA
- **Requirements Coverage Checklist** - Validation of completeness

### Quality Metrics
- Every requirement has acceptance criteria
- All user journeys have success AND failure paths
- Edge cases and error states are documented
- Analytics events are specified for key actions',
1, TRUE, current_timestamp(), current_timestamp(), current_user());

-- Figma UI Design
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(2, 'figma_ui_design',
'Generate the **actual UI mockups** for a simple, happy-path implementation using the Product Requirements Document as the source of truth.

## Product Requirements Document (PRD)

Use the following PRD to understand user personas, key user journeys, and core features:

{prd_document}

---

## Design Requirements

Create a **simple UI design** that includes:
- Key screens/pages for primary user personas
- Core components for functional requirements (Happy Path only)
- Simple data display layouts for main entities
- Basic navigation and interactions for high-value user journeys

In addition, document the design with:
- Key screens/pages
- Core components
- Basic navigation and interactions (happy path only)

**Keep it simple** — focus on essential screens and flows, not edge cases.',
'This prompt is returned as-is for you to paste into Figma AI. No LLM processing is applied.',
'Figma UI Design',
'Design a simple, clean user interface using Figma AI',
4,
'## Steps to Apply

1. **First, get your PRD ready:**
   - Copy the PRD content generated from the previous step (Step 3)
   - Or open `@docs/design_prd.md` and copy its contents

2. **Open Figma and create a new design file**

3. **Upload/Attach the PRD to Figma:**
   - In Figma AI, you can paste the PRD content directly
   - Or use Galileo AI and provide the PRD as context

4. **Copy the generated prompt** using the copy button above

5. **Paste into Figma AI or Galileo AI** to generate the design

6. **Review and iterate** on the generated components

7. **Export the design** when ready:
   - Export as images/assets for reference
   - Or use Figma''''s code export features

8. **Move to code implementation:**
   - Open Cursor or VS Code with the project
   - Use the exported Figma designs as visual reference
   - Implement the UI components in code

**Note:** The prompt includes `{prd_document}` which will be replaced with your actual PRD content.',
'## Expected Output

Simple UI design mockups that match the PRD:
- Key screens for primary user flows
- Basic component designs
- Clean, minimal layouts
- Ready for implementation in Cursor/Copilot',
TRUE,
1, TRUE, current_timestamp(), current_timestamp(), current_user());

-- UI Design - Build Locally
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(3, 'cursor_copilot_ui_design',
'## Your Task

You are a full-stack developer building a web application. Your goal is to **generate UI and backend APIs** from the PRD and **test locally**.

**Workspace:** `{workspace_url}`

**Working directory:** Run all app commands and create/edit app files under the `apps_lakebase/` folder. Design docs (PRD, UI design) remain in the parent `docs/` folder at repo root.

---

### Step 1: Authenticate and Set Up Variables

```bash
# Authenticate to Databricks
databricks auth login --host {workspace_url}

# Derive app name from your username + use case
FIRSTNAME=$(databricks current-user me --output json | jq -r ''.userName'' | cut -d''@'' -f1 | cut -d''.'' -f1)
LASTINITIAL=$(databricks current-user me --output json | jq -r ''.userName'' | cut -d''@'' -f1 | cut -d''.'' -f2 | cut -c1)
USERNAME="${FIRSTNAME}-${LASTINITIAL}"
APP_NAME="${USERNAME}-{use_case_slug}"
EMAIL=$(databricks current-user me --output json | jq -r ''.userName'')
echo "App: $APP_NAME | Email: $EMAIL"
```

---

### Step 2: Update Configuration Files

Update `apps_lakebase/app.yaml` with your app name:

```yaml
name: <APP_NAME>  # Replace with your APP_NAME from Step 1
```

Update `apps_lakebase/databricks.yml` with your app name in the resources section:

```yaml
resources:
  apps:
    vibe_coding_workshop:
      name: <APP_NAME>  # Replace with your APP_NAME from Step 1
```

**Important:** These files must have matching app names for deployment to work correctly. Both files are under `apps_lakebase/`.

---

### Step 3: Read the PRD

Review `@docs/design_prd.md` (parent folder) to understand:
- User personas and their needs
- Key user journeys (Happy Path only)
- Core features and requirements

---

### Step 4: Generate the UI

Create a **working web UI** with:
- Key pages/views for primary user personas
- Components for core features (Happy Path only)
- Simple data display and forms for high-value user journeys
- Follow the existing project''s framework, styling, and patterns

**Frontend code location:** `@apps_lakebase/src/components/`

---

### Step 5: Create Backend APIs

Add API endpoints in `@apps_lakebase/src/backend/api/routes.py` for each UI feature:
- The UI must call these APIs - no hardcoded/mock data in components
- Use placeholder data in API responses for now (Lakebase wiring comes later)

**Code Pattern:**

```python
# Backend API (routes.py)
@router.get("/api/items")
async def get_items():
    return {"data": [...]}
```

```typescript
// Frontend component - calls backend API
useEffect(() => {
  fetch(''/api/items'').then(res => res.json()).then(data => setItems(data.data));
}, []);
```

---

### Step 6: Create UI Design Document

Save a design overview to `@docs/ui_design.md` (parent folder at repo root) describing:
- Key screens/pages
- Core components
- Basic navigation flow

---

### Step 7: Verify app.py Serves Frontend

From the `apps_lakebase/` folder, ensure `app.py` serves the built frontend. It should have routes to serve `/` and `/assets`.

---

### Step 8: Test Locally

**Test the app locally before deployment (run from `apps_lakebase/`):**

1. Build the frontend: `npm install && npm run build`
2. Start the backend server: `python app.py`
3. Open `http://localhost:8000` in your browser
4. Verify:
   - The UI loads correctly
   - Navigation works
   - Backend API endpoints respond
   - No console errors

**Only proceed to deployment (next step) after local testing passes.**

---

### Summary

Your job is complete when:
- Configuration files (apps_lakebase/app.yaml, apps_lakebase/databricks.yml) are updated with your app name
- A working web UI is generated under apps_lakebase/
- Backend APIs are created in apps_lakebase/src/backend/api/routes.py
- `@docs/ui_design.md` is created (parent docs folder)
- Local testing passes at `http://localhost:8000` (run from apps_lakebase/)',
'You are a full-stack developer who builds web applications with React frontends and Python backends.

Your approach:
1. Read the PRD to understand user needs and journeys
2. Build functional UI components with clean code
3. Create backend API endpoints for data flow
4. Test locally before deployment

Development principles:
- Keep it simple - focus on Happy Path flows first
- UI must call backend APIs - no hardcoded/mock data
- Reuse existing components where possible
- Follow the project''s existing patterns and conventions

This prompt is returned as-is for direct use in Cursor/Copilot. No LLM processing.',
'UI Design - Build Locally',
'Build UI and backend APIs, test locally before deployment',
4,
'## How to Use

1. **Copy the generated prompt**
2. **Paste into Cursor or Copilot**
3. The code assistant will:
   - Read your PRD
   - Generate UI components and backend APIs
   - Create ui_design.md document
   - Test locally at localhost:8000

**Note:** This step focuses on local development. Deployment to Databricks happens in the next step.',
'## Expected Output

- Working web UI components under apps_lakebase/src/
- Backend API endpoints in apps_lakebase/src/backend/api/routes.py
- UI components calling backend APIs (not static HTML)
- UI design document at `@docs/ui_design.md` (parent folder)
- App running locally at `http://localhost:8000` (from apps_lakebase/)',
TRUE,
1, TRUE, current_timestamp(), current_timestamp(), current_user());

-- Deploy and Test
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(4, 'workspace_setup_deploy',
'## Your Task

Deploy the locally-tested web application to Databricks Apps and run comprehensive end-to-end testing.

**Workspace:** `{workspace_url}`

**Working directory:** All app paths and commands use the `apps_lakebase/` folder.

> **Prerequisite:** Complete Step 7 (Wire UI to Lakebase) first. Local testing must pass before deployment.

---

## Deployment Constraints
- Databricks App names must use only lowercase letters, numbers, and dashes (no underscores).
  Use hyphens: `my-app-name` not `my_app_name`.
- The Databricks Apps runtime auto-runs `npm install` and `npm run build` when it
  finds a `package.json`. Ensure `databricks.yml` sync config includes both `dist/**`
  AND `src/**` so the platform build succeeds.

---

### Step 1: Verify Local Build

Ensure the frontend is built and local testing has passed (from `apps_lakebase/` or check path):
```bash
ls apps_lakebase/dist/index.html || (cd apps_lakebase && npm run build)
```

---

### Step 2: Deploy Application

1. **Review the `apps_lakebase/scripts/` folder** in this project to find a deployment script (e.g., `deploy.sh`)
2. **Read the script** to understand its usage and options
3. **Run the deployment script** from `apps_lakebase/` (e.g. `cd apps_lakebase && ./scripts/deploy.sh`) with appropriate parameters for your target environment
4. **If errors occur:** Fix them and retry the deployment
5. **If no deployment script exists:** Search Databricks documentation for `databricks apps` CLI commands and deploy manually

**Note:** If the app already exists, use sync and redeploy instead of stop/start - it''s faster.

---

### Step 3: Derive App Name and Verify UI

Derive your app name and verify it''s running:
```bash
FIRSTNAME=$(databricks current-user me --output json | jq -r ''.userName'' | cut -d''@'' -f1 | cut -d''.'' -f1)
LASTINITIAL=$(databricks current-user me --output json | jq -r ''.userName'' | cut -d''@'' -f1 | cut -d''.'' -f2 | cut -c1)
USERNAME="${FIRSTNAME}-${LASTINITIAL}"
APP_NAME="${USERNAME}-{use_case_slug}"
databricks apps get $APP_NAME --output json | jq -r ''.url''
```

You should see the web UI, not JSON. Verify:
- The UI loads correctly
- Navigation works
- ConnectionStatus indicator shows "Live Data" or "Mock Data"

---

### Step 4: Test All Backend APIs

Test the health endpoint and all data endpoints:
```bash
APP_URL=$(databricks apps get $APP_NAME --output json | jq -r ''.url'')

# Test health endpoint
curl -s "$APP_URL/api/health/lakebase" | jq .

# Test each data endpoint used by your UI pages
# Replace with your actual API endpoints:
curl -s "$APP_URL/api/listings" | jq .
curl -s "$APP_URL/api/bookings" | jq .
# ... add all endpoints that fetch from Lakebase
```

**Verify each response includes:**
- `"source": "live"` (not "mock") when Lakebase is connected
- Actual data from your Lakebase tables

---

### Step 5: Check Logs for Lakebase Connections

```bash
databricks apps logs $APP_NAME --tail 100 | grep -i lakebase
```

You should see INFO logs showing:
- Autoscaling: "ConnectionPool initialised" | Provisioned: "Connected to Lakebase"
- Connection attempts to Lakebase (may include retries on first connect)
- Queries being executed for each page/endpoint
- Success messages with row counts

---

### Step 6: Fix Errors (up to 3 iterations)

If any errors occur:

1. **Check the logs:**
   ```bash
   databricks apps logs $APP_NAME --tail 100
   ```

2. **Common errors and fixes:**
   - "No module named ''psycopg''" or "No module named ''psycopg2''" → Add psycopg[binary,pool] and psycopg2-binary to requirements.txt and rebuild
   - "No module named ''psycopg_pool''" → Add psycopg[binary,pool]>=3.1.0 to requirements.txt
   - "No module named ''databricks.sdk''" → Add databricks-sdk>=0.81.0 to requirements.txt
   - "token''s identity did not match" → Check that app.yaml env vars match your mode ({lakebase_mode}): autoscaling needs ENDPOINT_NAME (no LAKEBASE_USER); provisioned needs LAKEBASE_USER via resource link
   - "role does not exist" → Run add-lakebase-role with --mode {lakebase_mode}
   - "permission denied for sequence" → Re-run setup-lakebase.sh --recreate (adds GRANT on sequences for SERIAL columns)
   - "404 on link-app-resource" → Autoscaling does not support App Resource linking; skip this step
   - "Connection attempt failed" → Normal on first request (cold start); retries handle this automatically
   - "Could not import module" → Check apps_lakebase/app.yaml command matches file structure

3. **Fix the issue, rebuild, and redeploy (from apps_lakebase/):**
   ```bash
   cd apps_lakebase && npm run build
   # Run deploy script again from apps_lakebase/
   ```

4. **Repeat up to 3 times.** If errors persist, report them for manual investigation.

---

### If the Workspace App Limit Is Reached

If deployment fails because the workspace has hit its app limit, do NOT rename your app. Instead, free up a slot by removing the oldest stopped app:

1. Find stopped apps sorted by oldest first:
   ```bash
   databricks apps list -o json | jq -r ''[.[] | select(.compute_status.state == "STOPPED")] | sort_by(.update_time) | .[0] | .name''
   ```
2. Delete it and wait for cleanup to complete:
   ```bash
   databricks apps delete <name-from-above>
   sleep 10
   ```
3. Retry the deployment.

If the limit error persists, repeat with the next oldest stopped app -- but **stop after 3 total attempts** (increase the wait to 20s, then 40s between retries). If it still fails after 3 tries, stop and report the issue for manual workspace cleanup. Never delete apps in RUNNING state.

---

### Idle Connection Test (CRITICAL)

After confirming endpoints return `source: "live"`, wait 3-5 minutes, then reload the app. Verify it still shows "Live Data". If it shows "Mock Data", check logs for "terminating connection" errors.

---

### Summary

Your job is complete when:
- Databricks App is deployed and running
- Web UI is accessible at the app URL
- ConnectionStatus shows "Live Data" (connected to Lakebase)
- All API endpoints return live data from Lakebase
- No errors in the app logs',
'You are deploying a web application to Databricks Apps and running comprehensive testing.

Your approach:
1. Use existing deployment scripts when available
2. Deploy to Databricks Apps
3. Verify the deployment by testing the app URL
4. Test all API endpoints for live data
5. Check logs for Lakebase connectivity
6. Debug and fix any deployment errors

CLI Best Practices:
- Check the `apps_lakebase/scripts/` folder for existing deploy scripts before writing ad-hoc commands
- Run CLI commands outside the IDE sandbox to avoid SSL/TLS certificate errors

This prompt is returned as-is for direct use in Cursor/Copilot. No LLM processing.',
'Deploy and Test',
'Deploy the application to Databricks and run full end-to-end testing',
7,
'## Prerequisite

Complete Step 7 (Wire UI to Lakebase) first. Local testing must pass.

---

## Steps to Apply

1. Copy the generated prompt
2. Paste into Cursor or Copilot
3. The code assistant will:
   - Deploy the app to Databricks
   - Get the app URL and verify UI loads
   - Test all backend APIs for live data
   - Check logs for Lakebase connectivity
   - Fix any errors and retry',
'## Expected Deliverables

- Databricks App deployed and running
- Web UI accessible at the app URL
- ConnectionStatus shows "Live Data"
- All API endpoints return live data from Lakebase
- No errors in the app logs',
TRUE,
1, TRUE, current_timestamp(), current_timestamp(), current_user());

-- Step 9: Table Metadata & Data Dictionary (Bronze Layer) - bypass_llm=TRUE
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(5, 'bronze_table_metadata',
'Extract table schema metadata from Databricks and save as a CSV data dictionary.

This will:

- **Query information_schema.columns** — extract all table and column metadata from the **{chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema}** source
- **Convert results to CSV** — transform the JSON API response into a structured CSV file using Python
- **Save as data_product_accelerator/context/{use_case_file_prefix}_Schema.csv** — create the data dictionary that drives the entire Design-First Pipeline (all subsequent steps reference this CSV)

**Source:** `{chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema}` (configured in the source panel above — auto-set from Step 9 or editable via Edit)

Copy and paste this prompt to the AI:

```
Run this SQL query and save results to CSV:

Query: SELECT * FROM {chapter_3_lakehouse_catalog}.information_schema.columns WHERE table_schema = ''{chapter_3_lakehouse_schema}'' ORDER BY table_name, ordinal_position

Output: data_product_accelerator/context/{use_case_file_prefix}_Schema.csv

---

Technical reference (for AI execution):

1. Get warehouse ID:
   databricks warehouses list --output json | jq ''.[0].id''

2. Execute SQL via Statement Execution API:
   databricks api post /api/2.0/sql/statements --json ''{
     "warehouse_id": "<WAREHOUSE_ID>",
     "statement": "<SQL_QUERY>",
     "wait_timeout": "50s",
     "format": "JSON_ARRAY"
   }'' > /tmp/sql_result.json

3. Convert JSON to CSV with Python:
   python3 << ''EOF''
   import json, csv
   with open(''/tmp/sql_result.json'', ''r'') as f:
       result = json.load(f)
   if result.get(''status'', {}).get(''state'') != ''SUCCEEDED'':
       print(f"Query failed: {result.get(''status'')}")
       exit(1)
   columns = [col[''name''] for col in result[''manifest''][''schema''][''columns'']]
   data = result[''result''][''data_array'']
   with open(''<OUTPUT_FILE>'', ''w'', newline='''') as f:
       writer = csv.writer(f)
       writer.writerow(columns)
       writer.writerows(data)
   print(f"Saved {len(data)} rows to <OUTPUT_FILE>")
   EOF

Known warehouse ID: <YOUR_WAREHOUSE_ID> (get via: databricks warehouses list --output json | jq ''.[0].id'')

Common queries:
- Schema info: SELECT * FROM <catalog>.information_schema.columns WHERE table_schema = ''<schema>'' ORDER BY table_name, ordinal_position
- Table list: SELECT * FROM <catalog>.information_schema.tables WHERE table_schema = ''<schema>''
- Sample data: SELECT * FROM <catalog>.<schema>.<table> LIMIT 1000

Expected output (for schema query):
- Console: "Saved N rows to data_product_accelerator/context/{use_case_file_prefix}_Schema.csv"
- CSV file with columns: table_catalog, table_schema, table_name, column_name, ordinal_position, is_nullable, data_type, comment, ...
```',
'',
'Table Metadata & Data Dictionary',
'Extract table schema metadata from Databricks and save as CSV for data dictionary reference',
8,
'## 1️⃣ How To Apply

Copy the prompt from the Prompt tab, start a new Agent chat in your IDE, paste it and press Enter.

**Prerequisite:** Run this in your cloned Template Repository (see Prerequisites in Step 0). Ensure Databricks CLI is authenticated.

**Steps:** Copy the prompt → paste into Cursor or VS Code with Copilot → AI executes SQL via Databricks CLI → CSV saved to data_product_accelerator/context/{use_case_file_prefix}_Schema.csv.

**Note:** The source catalog and schema are shown in the **Source** panel above this prompt. If you completed Step 9 (Register Lakebase in Unity Catalog), these are automatically set to your Lakebase UC catalog and user schema. You can edit or reset them using the Edit/Reset buttons.

---

## 2️⃣ What Are We Building?

This step extracts the **data dictionary** — a CSV file containing every table, column, data type, and comment from the source schema. This CSV becomes the starting input for the entire Design-First Pipeline:

```
data_product_accelerator/context/{use_case_file_prefix}_Schema.csv
  → Gold Design (Step 11)  — reads CSV to design dimensional model
  → Bronze (Step 12)       — uses schema to create tables
  → Silver (Step 13)       — uses schema for DQ expectations
  → Gold Impl (Step 14)    — uses YAML schemas derived from this CSV
```

---

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How It''s Used Here |
|----------|-------------------|
| **Unity Catalog `information_schema`** | Queries `information_schema.columns` — the standard UC metadata catalog — instead of proprietary DESCRIBE commands |
| **SQL Statement Execution API** | Uses the REST API (`/api/2.0/sql/statements`) for programmatic SQL execution — the production-grade approach for CI/CD |
| **Data Dictionary as Governance Foundation** | The CSV captures table/column COMMENTs from UC, establishing metadata lineage from day one |
| **Serverless SQL Warehouse** | Executes against a SQL warehouse (not a cluster) for cost-efficient, instant-start queries |

---

## 4️⃣ What Happens Behind the Scenes?

This step does **not** invoke an Agent Skill — it runs a direct SQL extraction via the Databricks CLI. Every subsequent skill references this CSV (or artifacts derived from it) to **extract** table names, column names, and data types — never generating them from scratch. This is the "Extract, Don''t Generate" principle.',
'## Expected Deliverables

- data_product_accelerator/context/{use_case_file_prefix}_Schema.csv file created
- Contains column metadata rows for all tables in {chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema}
- Includes: table_name, column_name, data_type, comment
- Ready for use as data dictionary reference
- **This CSV is the starting input for the entire Design-First Pipeline** (all subsequent steps reference it)',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 10 (Upload Mode): Table Metadata via CSV Upload - bypass_LLM = TRUE (direct copy-paste prompt)
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(119, 'bronze_table_metadata_upload',
'Save the uploaded schema metadata CSV and validate it for the Design-First Pipeline.

This will:

- **Save the CSV file** to `data_product_accelerator/context/{use_case_file_prefix}_Schema.csv`
- **Validate metadata quality** — check for missing comments, incorrect data types, and sequencing issues
- **Enrich if needed** — fill missing fields, normalize types, and add recommended columns
- **Print verification summary** — confirm table count, column count, and any fixes applied

Copy and paste this prompt to the AI:

```
Save the following CSV content to: data_product_accelerator/context/{use_case_file_prefix}_Schema.csv

--- CSV CONTENT START ---
{csv_content}
--- CSV CONTENT END ---

After saving the file, validate and enrich the metadata:

1. Validate structure:
   - Verify required columns: table_name, column_name, data_type, ordinal_position, is_nullable, comment
   - Check ordinal_position is sequential per table (1, 2, 3...) — fix gaps
   - Remove empty or duplicate rows

2. Enrich metadata:
   - Fill empty comment fields with descriptions inferred from column_name and table_name
   - Normalize data_type to Spark SQL types (VARCHAR -> STRING, INT -> INTEGER, FLOAT -> DOUBLE)
   - Add table_catalog and table_schema columns if missing (default: {chapter_3_lakehouse_schema})

3. Print verification summary:
   - Total tables found
   - Total column definitions
   - File path where CSV was saved
   - List of fixes applied (if any)

Downstream Compatibility Note:
This CSV drives the entire Design-First Pipeline:
- Gold Design (Step 11) — reads CSV for dimensional model design
- Bronze Creation (Step 12) — uses schema to create Delta tables
- Silver DQ (Step 13) — uses schema for data quality expectations
- Gold Implementation (Step 14) — uses YAML schemas derived from this CSV
Missing comments, incorrect types, or invalid rows will cascade into errors downstream.
```',
'',
'Table Metadata & Data Dictionary (Upload CSV)',
'Upload an existing schema CSV to create the data dictionary for your project',
8,
'## 1️⃣ How To Apply

Select the **Upload CSV** tab in Step 10, upload your schema metadata CSV file, and click **Process & Generate**.

**Steps:**
1. Click the upload area or drag your CSV file into the upload zone
2. Wait for validation — all required columns must be present (table_name, column_name, data_type, ordinal_position, is_nullable, comment)
3. Review the preview (table count, column count, detected table names)
4. Click **Process & Generate** to create the coding assistant prompt
5. Copy the generated prompt into Cursor or VS Code with Copilot
6. The coding assistant will save the CSV to `data_product_accelerator/context/{use_case_file_prefix}_Schema.csv`

---

## 2️⃣ What Are We Building?

Same as the Extract mode — a **data dictionary CSV** that drives the entire Design-First Pipeline. The only difference is the source: instead of querying `information_schema`, you''re providing the CSV directly.

```
data_product_accelerator/context/{use_case_file_prefix}_Schema.csv
  → Gold Design (Step 11)  — reads CSV to design dimensional model
  → Bronze (Step 12)       — uses schema to create tables
  → Silver (Step 13)       — uses schema for DQ expectations
  → Gold Impl (Step 14)    — uses YAML schemas derived from this CSV
```

---

## 3️⃣ When to Use Upload Mode

Use this when:
- Your source data is **not in Databricks** yet (external databases, CSV exports, data catalogs)
- You have a **pre-existing data dictionary** from another tool (ERStudio, dbt, etc.)
- You want to **skip the SQL extraction** step and provide metadata directly
- Your Databricks CLI is **not configured** for the source catalog

The CSV must follow the `information_schema.columns` format with required columns: `table_name`, `column_name`, `data_type`, `ordinal_position`, `is_nullable`, `comment`.',
'## Expected Deliverables

- `data_product_accelerator/context/{use_case_file_prefix}_Schema.csv` file created via coding assistant
- Contains column metadata rows for all tables in your schema
- Includes: table_name, column_name, data_type, ordinal_position, is_nullable, comment
- Ready for use as data dictionary reference
- **This CSV is the starting input for the entire Design-First Pipeline** (all subsequent steps reference it)',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 10 (Generate Mode): Design Schema from PRD - bypass_LLM = TRUE (prompt for coding assistant, like setup_lakebase)
INSERT INTO ${catalog}.${schema}.section_input_prompts
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(135, 'bronze_table_metadata_generate',
'## Design Database Schema from PRD

The business requirements are documented in @docs/design_prd.md.

---

### Instructions

Based on the PRD, design a **normalized relational schema** for the **{use_case_title}** use case and save it as a CSV file.

Copy and paste this prompt to the AI:

```
Read the PRD at @docs/design_prd.md and design a complete database schema for the **{use_case_title}** use case.

**Output file:** data_product_accelerator/context/{use_case_file_prefix}_Schema.csv

**Schema design requirements:**
1. Design 5-15 tables covering all entities, relationships, and transactional data described in the PRD
2. Include primary keys (BIGINT, first column per table) and foreign keys referencing related tables
3. Use Spark SQL data types: STRING, BIGINT, INT, DOUBLE, DECIMAL(precision,scale), BOOLEAN, DATE, TIMESTAMP
4. Add descriptive comments for every column explaining its business meaning
5. Include standard operational columns per table: created_at (TIMESTAMP), updated_at (TIMESTAMP), is_active (BOOLEAN)
6. Use snake_case for all table and column names
7. Design for analytics — include fact tables with numeric measures and dimension tables with descriptive attributes

**CSV format (information_schema.columns compatible):**
```csv
table_catalog,table_schema,table_name,column_name,ordinal_position,data_type,is_nullable,comment
{chapter_3_lakehouse_catalog},{chapter_3_lakehouse_schema},<table_name>,<column_name>,<position>,<type>,<YES/NO>,<description>
```

One row per column, all tables included. ordinal_position restarts at 1 for each table.

**After creating the CSV, validate and enrich:**
1. Verify required columns: table_name, column_name, data_type, ordinal_position, is_nullable, comment
2. Check ordinal_position is sequential per table (1, 2, 3...) — fix gaps
3. Fill empty comment fields with descriptions inferred from column_name and table_name
4. Normalize data_type to Spark SQL types (VARCHAR -> STRING, INT -> INTEGER, FLOAT -> DOUBLE)
5. Print verification summary: total tables, total columns, file path, fixes applied

**Downstream Compatibility Note:**
This CSV drives the entire Design-First Pipeline:
- Gold Design (Step 11) — reads CSV for dimensional model design
- Bronze Creation (Step 12) — uses schema to create Delta tables
- Silver DQ (Step 13) — uses schema for data quality expectations
- Gold Implementation (Step 14) — uses YAML schemas derived from this CSV
```',
'',
'Table Metadata & Data Dictionary (Design from PRD)',
'Design table schema from your PRD — for when you don''t have existing tables or a CSV',
8,
'## How To Apply

1. **Prerequisite:** Complete Step 3 (PRD Generation) first — the PRD is used as input to design the schema
2. Click **Generate** to create the prompt with your PRD embedded
3. Copy the prompt into Cursor or VS Code with Copilot
4. The coding assistant reads the PRD, designs tables, and saves the CSV to `data_product_accelerator/context/{use_case_file_prefix}_Schema.csv`
5. Review the generated schema and iterate if needed

---

## When to Use This Mode

Use **Design from PRD** when:
- You **don''t have existing tables** in Databricks yet
- You **don''t have a CSV export** from another tool
- You want to **start from scratch** with a schema designed from your requirements
- You have a **PRD from Step 3** that describes the data entities you need

This mode works just like the Lakebase table creation step — it gives your coding assistant a detailed prompt with the PRD as context, and the AI designs the schema for you.

---

## What Happens Next

The generated CSV becomes the **data dictionary** that drives the entire Design-First Pipeline:

```
data_product_accelerator/context/{use_case_file_prefix}_Schema.csv
  → Gold Design (Step 11)  — reads CSV to design dimensional model
  → Bronze (Step 12)       — uses schema to create tables
  → Silver (Step 13)       — uses schema for DQ expectations
  → Gold Impl (Step 14)    — uses YAML schemas derived from this CSV
```',
'## Expected Deliverables

- `data_product_accelerator/context/{use_case_file_prefix}_Schema.csv` file created via coding assistant
- Contains 5-15 tables with realistic column definitions designed from the PRD
- Includes: table_catalog, table_schema, table_name, column_name, ordinal_position, data_type, is_nullable, comment
- Every column has a descriptive business-context comment
- Ready for use as data dictionary reference
- **This CSV is the starting input for the entire Design-First Pipeline** (all subsequent steps reference it)',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Genie Accelerator: Upload CSV for Silver Metadata (bypass_llm = true)
INSERT INTO ${catalog}.${schema}.section_input_prompts
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(121, 'genie_silver_metadata_upload',
'Save the uploaded Silver layer schema metadata CSV and validate it for the Genie Accelerator pipeline.

This will:

- **Save the CSV file** to `data_product_accelerator/context/{use_case_file_prefix}_Schema.csv`
- **Validate metadata quality** — check for missing comments, incorrect data types, and sequencing issues
- **Enrich if needed** — fill missing fields, normalize types, and add recommended columns
- **Print verification summary** — confirm table count, column count, and any fixes applied

Copy and paste this prompt to the AI:

```
Save the following CSV content to: data_product_accelerator/context/{use_case_file_prefix}_Schema.csv

--- CSV CONTENT START ---
{csv_content}
--- CSV CONTENT END ---

After saving the file, validate and enrich the metadata:

1. Validate structure:
   - Verify required columns: table_name, column_name, data_type, ordinal_position, is_nullable, comment
   - Check ordinal_position is sequential per table (1, 2, 3...) — fix gaps
   - Remove empty or duplicate rows

2. Enrich metadata:
   - Fill empty comment fields with descriptions inferred from column_name and table_name
   - Normalize data_type to Spark SQL types (VARCHAR -> STRING, INT -> INTEGER, FLOAT -> DOUBLE)
   - Add table_catalog and table_schema columns if missing (default: {chapter_3_lakehouse_schema})

3. Print verification summary:
   - Total tables found
   - Total column definitions
   - File path where CSV was saved
   - List of fixes applied (if any)

Downstream Compatibility Note:
This CSV drives the Genie Accelerator pipeline:
- Bronze Creation (Step 12) — uses schema to create tables and sample data
- Gold Design (Step 11) — reads CSV for dimensional model design
- Gold Pipeline (Step 14) — uses YAML schemas derived from this CSV
Missing comments, incorrect types, or invalid rows will cascade into errors downstream.
```',
'',
'Analyze Silver Metadata (Upload CSV)',
'Upload an existing Silver layer schema CSV to create the data dictionary for your Genie Accelerator project',
8,
'## 1️⃣ How To Apply

Select the **Upload CSV** tab in the Analyze Silver Metadata step, upload your schema metadata CSV file, and click **Process & Generate**.

**Steps:**
1. Click the upload area or drag your CSV file into the upload zone
2. Wait for validation — all required columns must be present (table_name, column_name, data_type, ordinal_position, is_nullable, comment)
3. Review the preview (table count, column count, detected table names)
4. Click **Process & Generate** to create the coding assistant prompt
5. Copy the generated prompt into Cursor or VS Code with Copilot
6. The coding assistant will save the CSV to `data_product_accelerator/context/{use_case_file_prefix}_Schema.csv`

---

## 2️⃣ What Are We Building?

A **data dictionary CSV** that drives the Genie Accelerator pipeline. Instead of pointing to Silver layer tables in Databricks, you provide the CSV directly.

```
data_product_accelerator/context/{use_case_file_prefix}_Schema.csv
  → Bronze Creation (Step 12)  — uses schema to create tables and sample data
  → Gold Design (Step 11)      — reads CSV to design dimensional model
  → Gold Pipeline (Step 14)    — uses YAML schemas derived from this CSV
```

---

## 3️⃣ When to Use Upload Mode

Use this when:
- Your Silver layer data is **not in Databricks** yet (external databases, CSV exports, data catalogs)
- You have a **pre-existing data dictionary** from another tool (ERStudio, dbt, etc.)
- You want to **skip the Silver layer scan** and provide metadata directly
- Your Databricks CLI is **not configured** for the Silver catalog

The CSV must follow the `information_schema.columns` format with required columns: `table_name`, `column_name`, `data_type`, `ordinal_position`, `is_nullable`, `comment`.',
'## Expected Deliverables

- `data_product_accelerator/context/{use_case_file_prefix}_Schema.csv` file created via coding assistant
- Contains column metadata rows for all tables in your Silver layer schema
- Includes: table_name, column_name, data_type, ordinal_position, is_nullable, comment
- Ready for use as data dictionary reference
- **This CSV is the starting input for the Bronze Creation and Gold Design steps**',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 9: Gold Layer Design (PRD-aligned) - bypass_LLM = TRUE
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(6, 'gold_layer_design',
'I have a customer schema at @data_product_accelerator/context/{use_case_file_prefix}_Schema.csv.

Please design the Gold layer using @data_product_accelerator/skills/gold/00-gold-layer-design/SKILL.md

This skill will orchestrate the following end-to-end design workflow:

- **Parse the schema CSV** — read the source schema file, classify each table as a dimension, fact, or bridge, and infer foreign key relationships from column names and comments
- **Design the dimensional model** — identify dimensions (with SCD Type 1/2 decisions), fact tables (with explicit grain definitions), and measures, then assign tables to business domains
- **Create ERD diagrams** — generate Mermaid Entity-Relationship Diagrams organized by table count (master ERD always, plus domain and summary ERDs for larger schemas)
- **Generate YAML schema files** — produce one YAML file per Gold table with column definitions, PK/FK constraints, table properties, lineage metadata, and dual-purpose descriptions (human + LLM readable)
- **Document column-level lineage** — trace every Gold column back through Silver to Bronze with transformation type (DIRECT_COPY, AGGREGATION, DERIVATION, etc.) in both CSV and Markdown formats
- **Create business documentation** — write a Business Onboarding Guide with domain context, real-world scenarios, and role-based getting-started guides
- **Map source tables** — produce a Source Table Mapping CSV documenting which source tables are included, excluded, or planned with rationale for each
- **Validate design consistency** — cross-check YAML schemas, ERD diagrams, and lineage CSV to ensure all columns, relationships, and constraints are consistent

The orchestrator skill will automatically load its worker skills for merge patterns, deduplication, documentation standards, Mermaid ERDs, schema validation, grain validation, and YAML-driven setup.',
'',
'Gold Layer Design (PRD-aligned)',
'Design Gold layer using project skills with YAML definitions and Mermaid ERD',
9,
'## 1️⃣ How To Apply

Copy the prompt from the **Prompt** tab, start a **new Agent chat** in your IDE, paste it, and press Enter.

---

### Prerequisite

**Run this in your cloned Template Repository** (see Prerequisites in Step 0).

Ensure you have:
- ✅ `data_product_accelerator/context/{use_case_file_prefix}_Schema.csv` - Your source schema file (from Bronze/Silver)
- ✅ `data_product_accelerator/skills/gold/00-gold-layer-design/SKILL.md` - The Gold layer design orchestrator skill

---

### Steps to Apply

1. **Start new Agent thread** — Open Cursor and start a new Agent thread for clean context
2. **Copy and paste the prompt** — Use the copy button, paste into Cursor; the AI will read your schema and the orchestrator skill (which automatically loads all worker skills)
3. **Review generated design** — The AI creates `gold_layer_design/` with ERD diagrams, YAML schema files, and lineage documentation
4. **Validate the design** — Check grain, SCD type, relationships, and lineage for each fact/dimension
5. **Get stakeholder sign-off** — Share the ERD and design summary with business stakeholders before implementation

---

## 2️⃣ What Are We Building?

### What is the Gold Layer?

The Gold Layer is the **business-ready** analytics layer that transforms Silver data into dimensional models optimized for reporting, dashboards, and AI/ML consumption.

### Why Design Before Implementation?

| Principle | Benefit |
|-----------|---------|
| **Design First** | Catch errors before writing code |
| **YAML as Source of Truth** | Schema changes are reviewable diffs |
| **ERD Documentation** | Visual communication with stakeholders |
| **Documented Grain** | Prevents incorrect aggregations |
| **Lineage Tracking** | Know where every column comes from |

### Gold Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GOLD LAYER DESIGN                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        DIMENSIONAL MODEL                            │   │
│  │                                                                     │   │
│  │   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    │   │
│  │   │dim_store │    │dim_product│   │dim_date  │    │dim_host  │    │   │
│  │   │ (SCD2)   │    │ (SCD1)   │    │ (Static) │    │ (SCD2)   │    │   │
│  │   └────┬─────┘    └────┬─────┘    └────┬─────┘    └────┬─────┘    │   │
│  │        │               │               │               │          │   │
│  │        └───────────────┴───────┬───────┴───────────────┘          │   │
│  │                                │                                   │   │
│  │                        ┌───────▼───────┐                          │   │
│  │                        │ fact_bookings │                          │   │
│  │                        │   (Daily)     │                          │   │
│  │                        └───────────────┘                          │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Design Artifacts:                                                          │
│  • ERD Diagrams (Mermaid)      • YAML Schema Files                         │
│  • Column Lineage              • Business Documentation                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How It''s Used Here |
|----------|-------------------|
| **YAML-Driven Dimensional Modeling** | Gold schemas defined as YAML files — reviewable, version-controlled, machine-readable. No embedded DDL strings in Python. |
| **Star Schema with Surrogate Keys** | Dimensions use surrogate keys (BIGINT) as PRIMARY KEYs, not business keys. Facts reference surrogate PKs via FOREIGN KEY constraints. |
| **SCD Type 1 / Type 2 Classification** | Every dimension is classified: SCD1 (overwrite, e.g., `dim_destination`) or SCD2 (versioned with `is_current`/`valid_from`/`valid_to`, e.g., `dim_property`). |
| **Dual-Purpose COMMENTs** | Table and column COMMENTs serve both business users AND Genie/LLMs — written to be human-readable and machine-parseable simultaneously. |
| **Mermaid ERDs for Documentation** | Entity-Relationship Diagrams use Mermaid syntax — renderable in Databricks notebooks, GitHub, and any Markdown viewer. |
| **Column-Level Lineage** | Every Gold column traces back to its Silver source table and column with transformation type (DIRECT_COPY, AGGREGATION, DERIVATION). |
| **Grain Documentation** | Every fact table has an explicit grain statement (e.g., "One row per booking transaction") — prevents incorrect aggregations and joins. |

---

## 4️⃣ What Happens Behind the Scenes?

This framework uses a **skills-first architecture** with an **orchestrator/worker pattern**:

1. You paste **one prompt** referencing the orchestrator: `@data_product_accelerator/skills/gold/00-gold-layer-design/SKILL.md`
2. The AI reads the orchestrator skill, which lists **mandatory dependencies** (worker skills + common skills)
3. The AI automatically loads each worker skill as needed during the workflow
4. You never need to reference individual worker skills — the orchestrator handles it

### 9-Phase Workflow

| Phase | What Happens | Key Output |
|-------|-------------|------------|
| **Phase 0** | Parse schema CSV, classify tables (dim/fact/bridge), infer FKs | Table inventory |
| **Phase 1** | Gather project requirements (domain, use cases, stakeholders) | Project context |
| **Phase 2** | Design dimensional model (dimensions, facts, grain, SCD types) | Model blueprint |
| **Phase 3** | Create ERD diagrams using Mermaid syntax | `erd_master.md` + domain ERDs |
| **Phase 4** | Generate YAML schema files with lineage and descriptions | `yaml/{domain}/{table}.yaml` |
| **Phase 5** | Document column-level lineage (Bronze → Silver → Gold) | `COLUMN_LINEAGE.csv` |
| **Phase 6** | Write Business Onboarding Guide with real-world scenarios | `BUSINESS_ONBOARDING_GUIDE.md` |
| **Phase 7** | Map source tables with inclusion/exclusion rationale | `SOURCE_TABLE_MAPPING.csv` |
| **Phase 8** | Validate design consistency (YAML ↔ ERD ↔ Lineage) | Validation report |

### Orchestrator / Worker Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     ORCHESTRATOR / WORKER PATTERN                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  YOUR PROMPT                                                                │
│  "@data_product_accelerator/skills/gold/00-gold-layer-design/SKILL.md"                              │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────┐                                   │
│  │  ORCHESTRATOR (00-gold-layer-design)│                                   │
│  │  Manages the full design workflow   │                                   │
│  └──────────────┬──────────────────────┘                                   │
│                 │  automatically loads                                      │
│    ┌────────────┼────────────┬────────────┐                                │
│    ▼            ▼            ▼            ▼                                 │
│  ┌──────┐  ┌──────┐   ┌──────┐   ┌──────┐   + 3 more workers             │
│  │ 01-  │  │ 02-  │   │ 05-  │   │ 07-  │                                 │
│  │Grain │  │ Dims │   │ ERD  │   │Valid │                                 │
│  └──────┘  └──────┘   └──────┘   └──────┘                                 │
│                                                                             │
│  + Common Skills: naming-tagging-standards, databricks-expert-agent        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Design Worker Skills (Loaded Automatically by Orchestrator)

| Worker Skill | Path | Purpose |
|-----------|------|---------|
| `01-grain-definition` | `data_product_accelerator/skills/gold/design-workers/01-*/SKILL.md` | Grain definition patterns for fact tables |
| `02-dimension-patterns` | `data_product_accelerator/skills/gold/design-workers/02-*/SKILL.md` | Dimension design (SCD1, SCD2, conformed) |
| `03-fact-table-patterns` | `data_product_accelerator/skills/gold/design-workers/03-*/SKILL.md` | Fact table design (transactional, periodic, accumulating) |
| `04-conformed-dimensions` | `data_product_accelerator/skills/gold/design-workers/04-*/SKILL.md` | Cross-domain conformed dimension patterns |
| `05-erd-diagrams` | `data_product_accelerator/skills/gold/design-workers/05-*/SKILL.md` | Mermaid ERD diagram syntax and organization |
| `06-table-documentation` | `data_product_accelerator/skills/gold/design-workers/06-*/SKILL.md` | Dual-purpose (business + technical) documentation standards |
| `07-design-validation` | `data_product_accelerator/skills/gold/design-workers/07-*/SKILL.md` | Design consistency validation (YAML, ERD, lineage cross-check) |',
'## Expected Deliverables

### 📁 Generated Folder Structure

```
gold_layer_design/
├── README.md                           # Navigation hub
├── erd_master.md                       # Complete ERD (ALWAYS)
├── erd_summary.md                      # Domain overview (if 20+ tables)
├── erd/                                # Domain ERDs (if 9+ tables)
│   ├── erd_booking.md
│   ├── erd_property.md
│   └── erd_host.md
├── yaml/                               # YAML schemas by domain
│   ├── booking/
│   │   ├── dim_booking.yaml
│   │   └── fact_booking_daily.yaml
│   ├── property/
│   │   ├── dim_property.yaml
│   │   └── dim_destination.yaml
│   └── host/
│       └── dim_host.yaml
├── docs/
│   └── BUSINESS_ONBOARDING_GUIDE.md    # ⭐ Business context and stories
├── COLUMN_LINEAGE.csv                  # ⭐ Machine-readable lineage
├── COLUMN_LINEAGE.md                   # Human-readable lineage
├── SOURCE_TABLE_MAPPING.csv            # ⭐ Source table rationale
├── DESIGN_SUMMARY.md                   # Grain, SCD, decisions
└── DESIGN_GAP_ANALYSIS.md             # Coverage analysis
```

---

### 📊 ERD Organization (Based on Table Count)

| Total Tables | ERD Strategy |
|--------------|--------------|
| **1-8 tables** | Master ERD only |
| **9-20 tables** | Master ERD + Domain ERDs |
| **20+ tables** | Master ERD + Summary ERD + Domain ERDs |

---

### 📝 YAML Schema Example

```yaml
# gold_layer_design/yaml/booking/fact_booking_daily.yaml
table_name: fact_booking_daily
domain: booking
grain: "One row per property-date combination"

primary_key:
  columns: [''property_id'', ''check_in_date'']
  composite: true

foreign_keys:
  - columns: [''property_id'']
    references: dim_property(property_id)
  - columns: [''host_id'']
    references: dim_host(host_id)

columns:
  - name: property_id
    type: BIGINT
    nullable: false
    description: >
      Property identifier.
      Business: Links to property dimension.
      Technical: FK to dim_property.property_id.
    lineage:
      silver_table: silver_bookings
      silver_column: property_id
      transformation: "DIRECT_COPY"
```

---

### ✅ Success Criteria Checklist

**ERD Artifacts:**
- [ ] Master ERD created with all tables
- [ ] Domain ERDs created (if 9+ tables)
- [ ] All relationships shown with cardinality

**YAML Schemas:**
- [ ] One YAML file per table
- [ ] Organized by domain folders
- [ ] Primary keys defined
- [ ] Foreign keys defined
- [ ] Column lineage documented

**Mandatory Documentation:**
- [ ] COLUMN_LINEAGE.csv created
- [ ] SOURCE_TABLE_MAPPING.csv created
- [ ] BUSINESS_ONBOARDING_GUIDE.md created
- [ ] DESIGN_SUMMARY.md created

**Validation:**
- [ ] Grain explicitly stated for each fact
- [ ] SCD type specified for each dimension
- [ ] All columns trace back to source
- [ ] Stakeholder sign-off obtained',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 10: Bronze Layer Creation (Approach C - Copy Sample Data) - bypass_LLM = TRUE
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(7, 'bronze_layer_creation',
'Set up the Bronze layer using @data_product_accelerator/skills/bronze/00-bronze-layer-setup/SKILL.md with Approach C — copy data from the existing source tables in the {chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema} schema.

This will involve the following steps:

- **Clone all source tables** from the {chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema} schema into your target catalog''s Bronze schema
- **Apply enterprise table properties** — enable Change Data Feed (CDF), Liquid Clustering (CLUSTER BY AUTO), auto-optimize, and auto-compact on every table
- **Preserve source COMMENTs** — carry over all column-level documentation from the source schema
- **Create Asset Bundle job** — generate a repeatable, version-controlled deployment job (databricks.yml + clone script)
- **Deploy and run** — validate, deploy the bundle, and execute the clone job to populate Bronze tables

IMPORTANT: Use the EXISTING catalog `{lakehouse_default_catalog}` -- do NOT create a new catalog. Create the Bronze schema `{user_schema_prefix}_bronze` and tables inside this catalog.

NOTE: Before creating the schema, check if `{lakehouse_default_catalog}.{user_schema_prefix}_bronze` already exists. If it does, DROP the schema with CASCADE and recreate it from scratch. These are user-specific schemas so dropping is safe.',
'',
'Bronze Layer Creation (Approach C)',
'Create Bronze layer by copying sample data from {chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema} with Asset Bundle structure',
10,
'## 1️⃣ How To Apply

Copy the prompt above, start a **new Agent chat** in Cursor, and paste it.

### Prerequisite

**Run this in your cloned Template Repository** (see Prerequisites in Step 0).

Ensure you have:
- ✅ `data_product_accelerator/skills/bronze/00-bronze-layer-setup/SKILL.md` - The Bronze layer setup skill
- ✅ Access to `{chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema}` catalog in your Databricks workspace
- ✅ Permissions to create tables in your target catalog

### Steps to Apply

**Step 1:** Start a new Agent thread in Cursor
**Step 2:** Copy the prompt and paste it into Cursor
**Step 3:** Review generated code (Asset Bundle config, clone script, job definition)
**Step 4:** Validate: `databricks bundle validate -t dev`
**Step 5:** Deploy: `databricks bundle deploy -t dev`
**Step 6:** Run: `databricks bundle run -t dev bronze_clone_job`
**Step 7:** Verify in Databricks UI (SHOW TABLES, row counts, CDF enabled)

---

## 2️⃣ What Are We Building?

### What is the Bronze Layer?

The Bronze Layer is the **raw data landing zone** in the Medallion Architecture. It preserves source data exactly as received, enabling full traceability and reprocessing.

| Principle | Benefit |
|-----------|---------|
| **Raw Preservation** | Keep original data for audit and replay |
| **Change Data Feed** | Enable incremental processing downstream |
| **Schema Evolution** | Handle schema changes gracefully |
| **Single Source** | One place for all raw data ingestion |

### Bronze Layer in Medallion Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MEDALLION ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │   BRONZE    │───▶│   SILVER    │───▶│    GOLD     │                     │
│  │   (Raw)     │CDF │  (Cleaned)  │CDF │  (Business) │                     │
│  └─────────────┘    └─────────────┘    └─────────────┘                     │
│        ▲                                                                    │
│        │                                                                    │
│  ┌─────┴─────┐                                                             │
│  │  SOURCE   │  ◀── This step creates Bronze from source                   │
│  │   DATA    │                                                              │
│  └───────────┘                                                              │
│                                                                             │
│  CDF = Change Data Feed (enables incremental processing)                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Three Approaches for Bronze Data

| Approach | When to Use | What Happens |
|----------|-------------|--------------|
| **A: Generate Fake Data** | Testing/demos before customer delivery | Create DDLs, populate with Faker library |
| **B: Use Existing Bronze** | Customer already has Bronze layer | Skip this step, connect directly |
| **C: Copy from External** | Sample data available (THIS WORKSHOP) | Clone tables from `{chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema}` |

**This Prompt Uses Approach C** — we copy from `{chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema}` for real-world structure, immediate data availability, and focus on pipeline development.

### Bronze Clone Process

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BRONZE CLONE PROCESS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SOURCE                           TARGET                                    │
│  {chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema}     →       {lakehouse_default_catalog}.{user_schema_prefix}_bronze           │
│                                                                             │
│  ┌─────────────────────┐          ┌─────────────────────┐                  │
│  │ amenities           │  CREATE  │ amenities           │ + CDF enabled    │
│  │ booking_updates     │  TABLE   │ booking_updates     │ + CLUSTER BY AUTO│
│  │ bookings            │   AS     │ bookings            │ + Auto-optimize  │
│  │ clickstream         │ SELECT   │ clickstream         │ + TBLPROPERTIES  │
│  │ countries           │ ──────▶  │ countries           │ + COMMENTs       │
│  │ customer_support_.. │          │ customer_support_.. │                  │
│  │ destinations        │          │ destinations        │                  │
│  │ employees           │          │ employees           │                  │
│  │ hosts               │          │ hosts               │                  │
│  │ page_views          │          │ page_views          │                  │
│  │ payments            │          │ payments            │                  │
│  │ properties          │          │ properties          │                  │
│  │ property_amenities  │          │ property_amenities  │                  │
│  │ property_images     │          │ property_images     │                  │
│  │ reviews             │          │ reviews             │                  │
│  │ users               │          │ users               │                  │
│  └─────────────────────┘          └─────────────────────┘                  │
│                                     (all tables)                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Table Properties (Best Practices Enabled)

| Property | Setting | Why It Matters |
|----------|---------|----------------|
| **Liquid Clustering** | ✅ `CLUSTER BY AUTO` | Automatic data layout optimization |
| **Change Data Feed** | ✅ `delta.enableChangeDataFeed = true` | Enables incremental Silver processing |
| **Auto Optimize** | ✅ `delta.autoOptimize.optimizeWrite = true` | Automatic file compaction |
| **Auto Compact** | ✅ `delta.autoOptimize.autoCompact = true` | Reduces small files |

### Tables Cloned from {chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema}

| Table | Description | Columns |
|-------|-------------|---------|
| `amenities` | Property amenities (Wi-Fi, Pool, etc.) | 4 |
| `booking_updates` | Change log for booking modifications | 11 |
| `bookings` | Guest booking records | 10 |
| `clickstream` | User click behavior events | 5 |
| `countries` | Country reference data | 3 |
| `customer_support_logs` | Support ticket records | 5 |
| `destinations` | Travel destinations | 6 |
| `employees` | Company employee records | 10 |
| `hosts` | Property host profiles | 9 |
| `page_views` | Website page view events | 7 |
| `payments` | Payment transaction records | 6 |
| `properties` | Vacation rental listings | 13 |
| `property_amenities` | Property-to-amenity mapping (junction) | 2 |
| `property_images` | Property photo references | 6 |
| `reviews` | Guest reviews | 9 |
| `users` | Platform users (guests) | 8 |

### Verification Queries

```sql
-- 1. List all Bronze tables
SHOW TABLES IN {lakehouse_default_catalog}.{user_schema_prefix}_bronze;

-- 2. Check row counts for each table
SELECT ''amenities'' as tbl, COUNT(*) as cnt FROM {lakehouse_default_catalog}.{user_schema_prefix}_bronze.amenities
UNION ALL SELECT ''booking_updates'', COUNT(*) FROM {lakehouse_default_catalog}.{user_schema_prefix}_bronze.booking_updates
UNION ALL SELECT ''bookings'', COUNT(*) FROM {lakehouse_default_catalog}.{user_schema_prefix}_bronze.bookings
UNION ALL SELECT ''clickstream'', COUNT(*) FROM {lakehouse_default_catalog}.{user_schema_prefix}_bronze.clickstream
UNION ALL SELECT ''countries'', COUNT(*) FROM {lakehouse_default_catalog}.{user_schema_prefix}_bronze.countries
UNION ALL SELECT ''customer_support_logs'', COUNT(*) FROM {lakehouse_default_catalog}.{user_schema_prefix}_bronze.customer_support_logs
UNION ALL SELECT ''destinations'', COUNT(*) FROM {lakehouse_default_catalog}.{user_schema_prefix}_bronze.destinations
UNION ALL SELECT ''employees'', COUNT(*) FROM {lakehouse_default_catalog}.{user_schema_prefix}_bronze.employees
UNION ALL SELECT ''hosts'', COUNT(*) FROM {lakehouse_default_catalog}.{user_schema_prefix}_bronze.hosts
UNION ALL SELECT ''page_views'', COUNT(*) FROM {lakehouse_default_catalog}.{user_schema_prefix}_bronze.page_views
UNION ALL SELECT ''payments'', COUNT(*) FROM {lakehouse_default_catalog}.{user_schema_prefix}_bronze.payments
UNION ALL SELECT ''properties'', COUNT(*) FROM {lakehouse_default_catalog}.{user_schema_prefix}_bronze.properties
UNION ALL SELECT ''property_amenities'', COUNT(*) FROM {lakehouse_default_catalog}.{user_schema_prefix}_bronze.property_amenities
UNION ALL SELECT ''property_images'', COUNT(*) FROM {lakehouse_default_catalog}.{user_schema_prefix}_bronze.property_images
UNION ALL SELECT ''reviews'', COUNT(*) FROM {lakehouse_default_catalog}.{user_schema_prefix}_bronze.reviews
UNION ALL SELECT ''users'', COUNT(*) FROM {lakehouse_default_catalog}.{user_schema_prefix}_bronze.users;

-- 3. Verify CDF is enabled (check any table)
DESCRIBE EXTENDED {lakehouse_default_catalog}.{user_schema_prefix}_bronze.bookings;
-- Look for: delta.enableChangeDataFeed = true

-- 4. Preview sample data
SELECT * FROM {lakehouse_default_catalog}.{user_schema_prefix}_bronze.bookings LIMIT 5;
```

---

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How It''s Used Here |
|----------|-------------------|
| **Change Data Feed (CDF)** | `delta.enableChangeDataFeed = true` on every Bronze table — enables Silver to read only changed rows instead of full table scans |
| **Liquid Clustering** | `CLUSTER BY AUTO` — Databricks automatically chooses optimal clustering columns and reorganizes data layout over time |
| **Auto-Optimize** | `delta.autoOptimize.optimizeWrite = true` + `autoCompact = true` — automatic small file compaction, no manual OPTIMIZE needed |
| **Unity Catalog Governance** | All tables registered in Unity Catalog with proper catalog.schema.table naming, enabling lineage, access control, and discovery |
| **Schema-on-Read with Evolution** | Bronze preserves raw source schema; downstream layers handle schema evolution gracefully |
| **Databricks Asset Bundles (DAB)** | Infrastructure as Code — `databricks.yml` defines jobs, targets, and resources. Deploy with `databricks bundle deploy` for repeatable, CI/CD-ready deployments |
| **Serverless Jobs** | Jobs run on serverless compute — no cluster management, instant startup, pay-per-use cost model |
| **Enterprise Naming Standards** | Tables follow `{schema}.{table_name}` convention; COMMENTs applied to tables and columns for data discovery |

---

## 4️⃣ What Happens Behind the Scenes?

When you paste the prompt, the AI reads `@data_product_accelerator/skills/bronze/00-bronze-layer-setup/SKILL.md` — the **Bronze orchestrator skill**. Behind the scenes:

1. **Orchestrator reads approach** — detects "Approach C" and activates the clone-from-source workflow
2. **Common skills auto-loaded** — the orchestrator''s mandatory dependencies include:
   - `databricks-table-properties` — ensures CDF, liquid clustering, auto-optimize are set
   - `databricks-asset-bundles` — generates proper `databricks.yml` and job YAML
   - `naming-tagging-standards` — applies enterprise naming conventions and COMMENTs
   - `schema-management-patterns` — handles `CREATE SCHEMA IF NOT EXISTS`
   - `databricks-python-imports` — handles shared code modules between notebooks
3. **Code generation** — the skill produces clone scripts that read from `{chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema}` and write to your catalog with all best practices applied
4. **Deploy loop** — if deployment fails, the `databricks-autonomous-operations` skill kicks in for self-healing (deploy → poll → diagnose → fix → redeploy)',
'## Expected Deliverables

### 📁 Generated Asset Bundle Structure

```
project_root/
├── databricks.yml                      # Bundle configuration (updated)
├── src/
│   └── source_bronze/
│       ├── __init__.py
│       └── clone_samples.py            # Code to copy sample data
└── resources/
    └── bronze/
        └── bronze_clone_job.yml        # Job configuration
```

---

### ✅ Success Criteria Checklist

**Bundle Deployment:**
- [ ] `databricks bundle validate` passes with no errors
- [ ] `databricks bundle deploy` completes successfully
- [ ] Job appears in Databricks Workflows UI

**Job Execution:**
- [ ] Bronze clone job runs without errors
- [ ] All tables cloned successfully
- [ ] Job completes in < 10 minutes

**Table Verification:**
- [ ] All tables visible in Unity Catalog
- [ ] Row counts match source tables
- [ ] CDF enabled on all tables
- [ ] Liquid clustering enabled
- [ ] Sample data looks correct',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 10b: Bronze Layer Creation (from Uploaded CSV) - bypass_LLM = TRUE
-- Uses Agent Skill to generate DDLs + Faker test data from a schema CSV.
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(120, 'bronze_layer_creation_upload',
'## Bronze Layer Creation

Schema: @data_product_accelerator/context/{use_case_file_prefix}_Schema.csv
Skill: @data_product_accelerator/skills/bronze/00-bronze-layer-setup/SKILL.md
Approach: **A — Schema CSV + Faker** (DDLs + test data)

This will involve the following steps:

1. **Requirements** — Parse the schema CSV, classify tables (dims vs facts), identify FK relationships
2. **Table DDLs** — Generate `setup_tables.py` with CREATE TABLE for all tables (CLUSTER BY AUTO, CDF, TBLPROPERTIES)
3. **Faker Data** — Generate dimension + fact data scripts with seeded Faker, non-linear distributions, 5% corruption rate
4. **Asset Bundle Jobs** — Create job YAMLs for table creation and data generation (Serverless, Environments V4)
5. **Deploy & Validate** — After all artifacts are created, deploy and run:
   - `databricks bundle deploy -t dev`
   - `databricks bundle run bronze_setup_job -t dev`
   - `databricks bundle run bronze_data_generator_job -t dev`
   - Run validation queries to confirm tables exist, row counts are correct, and CDF is enabled',
'',
'Bronze Layer Creation (from CSV)',
'Generate DDLs and Faker test data from the uploaded schema CSV using Agent Skills to build the Bronze layer',
10,
'## 1️⃣ How To Apply

Copy the prompt above, start a **new Agent chat** in Cursor, and paste it. The AI will read the Bronze setup skill and generate the implementation.

### Prerequisite

**Run this in your cloned Template Repository** (see Prerequisites in Step 0).

Ensure you have:
- ✅ `data_product_accelerator/context/{use_case_file_prefix}_Schema.csv` — created in the previous step (Step 10 Upload CSV mode)
- ✅ `data_product_accelerator/skills/bronze/00-bronze-layer-setup/SKILL.md` — the Bronze layer setup skill in your repo
- ✅ Access to `{lakehouse_default_catalog}` catalog in your Databricks workspace
- ✅ Permissions to create schemas and tables in the target catalog

### Steps to Apply

**Step 1: Generate Bronze Layer Code**

1. **Start a new Agent thread** in Cursor
2. **Copy the prompt** using the copy button
3. **Paste it into Cursor** and let the AI:
   - Read the skill file and parse your schema CSV
   - Classify tables (dimensions vs facts) and identify FK relationships
   - Generate `setup_tables.py` with CREATE TABLE DDLs
   - Generate Faker data scripts with seeded data and corruption

**Step 2: Deploy the Bundle**

```bash
# Deploy to Databricks workspace
databricks bundle deploy -t dev

# Expected: Jobs created successfully
```

**Step 3: Run Table Setup Job**

```bash
# Create all Bronze tables
databricks bundle run bronze_setup_job -t dev

# Verify tables were created in the catalog
```

**Step 4: Run Data Generator Job**

```bash
# Generate and load Faker test data
databricks bundle run bronze_data_generator_job -t dev

# Verify data was loaded with expected row counts
```

**Step 5: Validate Results**

Verify in Databricks UI:
- Tables created in `{lakehouse_default_catalog}.{user_schema_prefix}_bronze`
- Faker data loaded with correct row counts
- CDF enabled on all tables
- Non-linear distributions and ~5% corruption rate present in data

---

## 2️⃣ What Are We Building?

### Bronze Layer from CSV with Faker Data

This mode uses an **Agent Skill** to generate the Bronze layer from your schema CSV, creating DDLs and realistic test data using Faker:

| Step | What Happens |
|------|-------------|
| **Parse CSV** | Read the metadata CSV, classify tables (dims vs facts), identify FK relationships |
| **Generate DDLs** | `setup_tables.py` with CREATE TABLE (proper types, CDF, liquid clustering, auto-optimize) |
| **Generate Faker Data** | Python scripts using seeded Faker with non-linear distributions and 5% corruption |
| **Bundle & Deploy** | Asset Bundle jobs for table creation and data generation (Serverless, Environments V4) |

### Why This Approach?

Use this when your source data is **not in Databricks** yet. The skill-based approach ensures consistent, well-structured Bronze tables with realistic test data that exercises downstream Silver and Gold pipelines.

---

## 3️⃣ Generated File Structure

```
data_product_accelerator/
├── skills/bronze/00-bronze-layer-setup/
│   └── SKILL.md                          # Bronze layer skill (input)
├── context/
│   └── {use_case_file_prefix}_Schema.csv           # Schema metadata CSV (input)
├── src/bronze/
│   ├── setup_tables.py                   # CREATE TABLE DDLs for all tables
│   └── generate_data.py                  # Faker-based data generation scripts
└── resources/bronze/
    ├── bronze_setup_job.yml              # Asset Bundle job for table creation
    └── bronze_data_generator_job.yml     # Asset Bundle job for data generation
```',
'## Expected Deliverables

### 📁 Generated File Structure

```
data_product_accelerator/
├── skills/bronze/00-bronze-layer-setup/
│   └── SKILL.md                          # Bronze layer skill (input)
├── context/
│   └── {use_case_file_prefix}_Schema.csv           # Schema metadata CSV (input)
├── src/bronze/
│   ├── setup_tables.py                   # CREATE TABLE DDLs for all tables
│   └── generate_data.py                  # Faker-based data generation scripts
├── resources/bronze/
│   ├── bronze_setup_job.yml              # Asset Bundle job for table creation
│   └── bronze_data_generator_job.yml     # Asset Bundle job for data generation
└── databricks.yml                         # Updated bundle config
```

---

### ✅ Success Criteria Checklist

**Table DDLs:**
- [ ] All tables from the schema CSV have corresponding CREATE TABLE statements
- [ ] Column types match the CSV data_type values
- [ ] CDF enabled on all tables (`delta.enableChangeDataFeed = true`)
- [ ] Liquid clustering enabled (`CLUSTER BY AUTO`)
- [ ] Auto-optimize enabled (`delta.autoOptimize.optimizeWrite`, `delta.autoOptimize.autoCompact`)

**Faker Data:**
- [ ] Dimension tables populated with seeded Faker data
- [ ] Fact tables populated with non-linear distributions
- [ ] ~5% corruption rate applied for data quality testing
- [ ] Referential integrity across related tables

**Bundle Deployment:**
- [ ] `databricks bundle validate` passes with no errors
- [ ] `databricks bundle deploy` completes successfully
- [ ] Jobs appear in Databricks Workflows UI

**Job Execution:**
- [ ] `bronze_setup_job` creates all tables in `{lakehouse_default_catalog}.{user_schema_prefix}_bronze`
- [ ] `bronze_data_generator_job` loads Faker data successfully
- [ ] Validation queries confirm tables exist, row counts are correct, and CDF is enabled',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 11: Silver Layer Pipelines (SDP with Centralized DQ Rules) - bypass_LLM = TRUE
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(8, 'silver_layer_sdp',
'Set up the Silver layer using @data_product_accelerator/skills/silver/00-silver-layer-setup/SKILL.md

This will involve the following steps:

- **Generate SDP pipeline notebooks** — create Spark Declarative Pipeline notebooks with incremental ingestion from Bronze using Change Data Feed (CDF)
- **Create centralized DQ rules table** — build a configurable data quality rules table with expectations (null checks, range validation, referential integrity)
- **Create Asset Bundle** — generate bundle configuration for both the DQ rules setup job and the SDP pipeline
- **Deploy and run in order** — deploy the bundle, run the DQ rules setup job FIRST (creates the rules table), then run the SDP pipeline (reads rules from the table)

Ensure bundle is validated and deployed successfully, and silver layer jobs run with no errors.

Validate the results in the UI to ensure the DQ rules show up in centralized delta table, and that the silver layer pipeline runs successfully with Expectations being checked.

IMPORTANT: Use the EXISTING catalog `{lakehouse_default_catalog}` -- do NOT create a new catalog. Create the Silver schema `{user_schema_prefix}_silver` and all Silver tables inside this catalog.

NOTE: Before creating the schema, check if `{lakehouse_default_catalog}.{user_schema_prefix}_silver` already exists. If it does, DROP the schema with CASCADE and recreate it from scratch. These are user-specific schemas so dropping is safe.',
'',
'Silver Layer Pipelines (SDP)',
'Create Silver layer using Spark Declarative Pipelines with centralized data quality rules',
11,
'## 1️⃣ How To Apply

Copy the prompt above, start a **new Agent chat** in Cursor, and paste it. The AI will read the Silver setup skill and generate the implementation.

### Prerequisite

**Run this in your cloned Template Repository** (see Prerequisites in Step 0).

Ensure you have:
- ✅ Bronze layer created and populated (Step 10 complete)
- ✅ `data_product_accelerator/skills/silver/00-silver-layer-setup/SKILL.md` - The Silver layer setup skill (loads worker skills automatically)

### Steps to Apply

**Step 1: Generate Silver Layer Code**

1. **Start a new Agent thread** in Cursor
2. **Copy the prompt** using the copy button
3. **Paste it into Cursor** and let the AI generate:
   - SDP pipeline notebooks
   - Data quality rules configuration
   - Asset Bundle job definitions

**Step 2: Validate the Bundle**

```bash
# Validate bundle configuration
databricks bundle validate -t dev

# Expected: No errors, all resources validated
```

**Step 3: Deploy the Bundle**

```bash
# Deploy to Databricks workspace
databricks bundle deploy -t dev

# Expected: Pipeline and jobs created successfully
```

**Step 4: Run DQ Rules Setup Job FIRST ⚠️**

**CRITICAL: You must create the DQ rules table before running the pipeline — otherwise the pipeline fails with `Table or view not found: dq_rules`.**

```bash
# Run the DQ rules setup job (creates and populates dq_rules table)
databricks bundle run -t dev silver_dq_setup_job

# Verify the rules table was created:
# SELECT * FROM {lakehouse_default_catalog}.{user_schema_prefix}_silver.dq_rules
```

**Step 5: Run the Silver DLT Pipeline**

```bash
# NOW run the DLT pipeline (it reads rules from the dq_rules table)
databricks bundle run -t dev silver_dlt_pipeline

# Or trigger from Databricks UI:
# Workflows → DLT Pipelines → [dev] Silver Layer Pipeline → Start
```

**Step 6: Validate Results in UI**

After pipeline completes, verify in Databricks UI:

1. **Check DQ Rules Table:**
   ```sql
   SELECT * FROM {lakehouse_default_catalog}.{user_schema_prefix}_silver.dq_rules;
   ```
   ✅ Should show all configured quality rules

2. **Check Pipeline Event Log:**
   - Navigate to: Workflows → DLT Pipelines → Your Pipeline
   - Click "Data Quality" tab
   - ✅ Should show Expectations being evaluated

3. **Check Silver Tables:**
   ```sql
   SHOW TABLES IN {lakehouse_default_catalog}.{user_schema_prefix}_silver;
   SELECT * FROM {lakehouse_default_catalog}.{user_schema_prefix}_silver.{table} LIMIT 10;
   ```
   ✅ Should show cleaned, validated data

---

## 2️⃣ What Are We Building?

### What is the Silver Layer?

The Silver Layer transforms raw Bronze data into **cleaned, validated, and enriched** data ready for Gold layer consumption.

### Core Philosophy: Schema Cloning

Silver should **mirror the Bronze schema** with minimal changes — same column names, same data types, same grain. The value-add is **data quality**, not transformation:

| ✅ DO in Silver | ❌ DON''T do in Silver (save for Gold) |
|----------------|--------------------------------------|
| Apply DQ rules (null checks, range validation) | Aggregation (SUM, COUNT, GROUP BY) |
| Add derived flags (`is_return`, `is_out_of_stock`) | Join across tables |
| Add business keys (SHA256 hashes) | Complex business logic |
| Add `processed_timestamp` | Schema restructuring |
| Deduplicate records | Rename columns significantly |

**Why?** Silver is the validated copy of source data. Gold handles complex transformations. This keeps Silver focused on data quality and makes troubleshooting easier (column names match source).

### Why Spark Declarative Pipelines (SDP)?

| Feature | Benefit |
|---------|---------|
| **Incremental Ingestion** | Reads only changed data from Bronze using Change Data Feed (CDF) |
| **Built-in Quality Rules** | Expectations framework for data validation |
| **Serverless Compute** | Cost-efficient, auto-scaling execution |
| **Automatic Schema Evolution** | Handles schema changes gracefully |
| **Complete Lineage** | Full data lineage tracking in Unity Catalog |
| **Photon Engine** | Vectorized query execution for faster processing |

### Key Validation Points

| What to Check | Where | Expected Result |
|---------------|-------|-----------------|
| DQ Rules loaded | `dq_rules` table | Rules visible in Delta table |
| Expectations running | Pipeline event log | Pass/Warn/Fail counts shown |
| Data quality | Silver tables | Clean, standardized data |
| Incremental working | Pipeline metrics | Only new/changed rows processed |

---

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How It''s Used Here |
|----------|-------------------|
| **Spark Declarative Pipelines (SDP/DLT)** | Silver uses SDP for declarative, streaming-first pipelines — define WHAT the data should look like, not HOW to process it |
| **Legacy `import dlt` API** | Uses `import dlt` (not modern `pyspark.pipelines`) because the DQ rules framework depends on `@dlt.expect_all_or_drop()` decorators. Will migrate when Databricks ports expectations to the modern API. |
| **CDF-Based Incremental Reads** | Silver reads from Bronze using Change Data Feed — only processing new/changed rows, not full table scans |
| **Expectations Framework** | DLT Expectations with severity levels: `@dlt.expect_all()` (warn but keep), `@dlt.expect_all_or_drop()` (quarantine bad rows), `@dlt.expect_or_fail()` (halt pipeline — avoided in favor of drop) |
| **Centralized DQ Rules in Delta Tables** | Quality rules stored in `dq_rules` Delta table — updateable at runtime via SQL without code redeployment. PK constraint on `(table_name, rule_name)`. |
| **Quarantine Pattern** | Records failing critical DQ rules are routed to quarantine tables for investigation, not silently dropped |
| **Row Tracking** | `delta.enableRowTracking = true` on EVERY Silver table — required for downstream Gold Materialized Views to use incremental refresh instead of expensive full recomputation |
| **Photon + ADVANCED Edition** | `photon: true` and `edition: ADVANCED` are non-negotiable in pipeline YAML — Photon for vectorized execution, ADVANCED for expectations/CDC support |
| **Serverless DLT Compute** | `serverless: true` in pipeline YAML — auto-scaling, no cluster configuration, no `clusters:` block |
| **Schema Cloning Philosophy** | Silver mirrors Bronze schema (same column names, same grain, no aggregation, no joins). Only adds: DQ rules, derived flags, business keys, `processed_timestamp`. Aggregation belongs in Gold. |
| **Unity Catalog Integration** | Silver tables are UC-managed, inheriting governance, lineage tracking, and access controls from Bronze |
| **Pure Python DQ Loader** | `dq_rules_loader.py` has NO notebook header — it''s a pure Python module importable by DLT notebooks. Cache pattern uses `toPandas()` (not `.collect()`) for performance. |
| **2-Job Deployment Pattern** | Two separate resources: (1) `silver_dq_setup_job` — regular job that creates and populates the `dq_rules` table, (2) `silver_dlt_pipeline` — DLT pipeline that reads rules from the table. Setup job MUST run first. |
| **Data Quality Monitoring** | DQ monitoring views created inside the DLT pipeline — per-table metrics, referential integrity checks, data freshness. Feeds into observability dashboards in later steps. |

---

## 4️⃣ What Happens Behind the Scenes?

When you paste the prompt, the AI reads `@data_product_accelerator/skills/silver/00-silver-layer-setup/SKILL.md` — the **Silver orchestrator skill**. Behind the scenes:

1. **Orchestrator activates** — reads the Silver setup workflow with streaming ingestion and DQ rules
2. **Worker skills auto-loaded:**
   - `01-dlt-expectations-patterns` — creates portable DQ rules stored in Unity Catalog Delta tables (not hardcoded in notebooks)
   - `02-dqx-patterns` — Databricks DQX framework for advanced validation with detailed failure diagnostics
3. **Common skills auto-loaded (8 total):**
   - `databricks-expert-agent` — core "Extract, Don''t Generate" principle
   - `databricks-table-properties` — ensures proper TBLPROPERTIES (CDF, row tracking, auto-optimize)
   - `databricks-asset-bundles` — generates DLT pipeline YAML and DQ setup job YAML
   - `databricks-python-imports` — ensures `dq_rules_loader.py` is pure Python (no notebook header)
   - `unity-catalog-constraints` — PK constraint on `dq_rules` table: `(table_name, rule_name)`
   - `schema-management-patterns` — `CREATE SCHEMA IF NOT EXISTS` with governance metadata
   - `naming-tagging-standards` — enterprise naming conventions and dual-purpose COMMENTs
   - `databricks-autonomous-operations` — self-healing deploy loop if pipeline fails
4. **Key innovation: Runtime-updateable DQ rules** — expectations are stored in a Delta table, not in code. You can update rules without redeploying the pipeline.',
'## Expected Deliverables

### 📁 Generated Files

```
project_root/
├── databricks.yml                        # Updated with Silver resources
├── src/
│   └── source_silver/
│       ├── setup_dq_rules_table.py       # Notebook: Create & populate DQ rules Delta table
│       ├── dq_rules_loader.py            # Pure Python module (NO notebook header!)
│       ├── silver_dimensions.py          # DLT notebook: Dimension tables
│       ├── silver_facts.py               # DLT notebook: Fact tables with quarantine
│       └── data_quality_monitoring.py    # DLT notebook: DQ metrics & freshness views
└── resources/
    └── silver/
        ├── silver_dq_setup_job.yml       # Job: Creates dq_rules table (run FIRST)
        └── silver_dlt_pipeline.yml       # DLT pipeline configuration
```

> **Key file note:** `dq_rules_loader.py` must be a **pure Python module** (no `# Databricks notebook source` header). This is because DLT notebooks import it as a regular module. If it has a notebook header, imports break.

---

### 🔄 Silver Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SILVER LAYER (SDP Pipeline)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌──────────────────┐    ┌─────────────────────┐        │
│  │   Bronze    │───▶│  SDP Pipeline    │───▶│   Silver Tables     │        │
│  │   Tables    │    │  (Serverless)    │    │   (Cleaned Data)    │        │
│  │   (CDF)     │    │                  │    │                     │        │
│  └─────────────┘    │  • Read CDF      │    └─────────────────────┘        │
│                     │  • Apply DQ      │              │                     │
│                     │  • Transform     │              ▼                     │
│  ┌─────────────┐    │  • Deduplicate   │    ┌─────────────────────┐        │
│  │  DQ Rules   │───▶│                  │    │  Quarantine Table   │        │
│  │  (Delta)    │    └──────────────────┘    │  (Failed Records)   │        │
│  └─────────────┘                            └─────────────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 📊 Tables Created

| Table Type | Tables | Description |
|------------|--------|-------------|
| **Silver Dimensions** | `silver_amenities`, `silver_destinations`, ... | Cleaned dimension data mirroring Bronze schema |
| **Silver Facts** | `silver_bookings`, `silver_payments`, ... | Transformed fact data with DQ expectations applied |
| **DQ Rules** | `dq_rules` | Centralized rule definitions (PK: `table_name, rule_name`) |
| **Quarantine** | `quarantine_*` | Records that failed `expect_all_or_drop` critical rules |
| **DQ Monitoring Views** | `dq_metrics_*`, `data_freshness_*` | Per-table quality metrics and freshness tracking |

---

### ✅ Data Quality Framework

| Quality Dimension | Example Rules |
|-------------------|---------------|
| **Completeness** | Required fields not null |
| **Validity** | Values within expected ranges |
| **Uniqueness** | No duplicates on key columns |
| **Consistency** | Cross-field validations |
| **Referential** | Foreign keys exist in parent tables |

---

### 🖼️ Visual Validation in Databricks

**1. DLT Pipeline - Data Quality Tab:**

Shows Expectations results with Pass/Warn/Fail counts for each rule.

**2. Unity Catalog - Silver Schema:**

All Silver tables visible with proper metadata and lineage.

**3. DQ Rules Table:**

```sql
SELECT rule_name, rule_type, expectation, action 
FROM {lakehouse_default_catalog}.{user_schema_prefix}_silver.dq_rules;
```

---

### ✅ Success Criteria Checklist

**Deployment:**
- [ ] Bundle validates with no errors
- [ ] Bundle deploys successfully
- [ ] DQ rules setup job runs and creates `dq_rules` table (**must run FIRST**)
- [ ] DLT pipeline runs without failures

**Data Quality:**
- [ ] DQ rules loaded into centralized Delta table
- [ ] Expectations show in pipeline event log (Data Quality tab)
- [ ] Quarantine table captures failed records (not silently dropped)

**Tables & Properties:**
- [ ] Silver tables populated with cleaned data
- [ ] Silver column names match Bronze (schema cloning)
- [ ] Row tracking enabled (`delta.enableRowTracking = true`)
- [ ] CDF enabled (`delta.enableChangeDataFeed = true`)
- [ ] `cluster_by_auto=True` on every table

**Pipeline Configuration:**
- [ ] `serverless: true` in pipeline YAML
- [ ] `photon: true` in pipeline YAML
- [ ] `edition: ADVANCED` in pipeline YAML
- [ ] `dq_rules_loader.py` has NO notebook header (pure Python)
- [ ] Incremental processing working (only new/changed rows)',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 12: Gold Layer Pipeline (YAML-Driven Implementation) - bypass_LLM = TRUE
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(9, 'gold_layer_pipeline',
'Implement the Gold layer using @data_product_accelerator/skills/gold/01-gold-layer-setup/SKILL.md

This will involve the following steps:

- **Read YAML schemas** — use the Gold layer design YAML files (from Step 9) as the single source of truth for all table definitions, columns, and constraints
- **Create Gold tables** — generate CREATE TABLE DDL from YAML, add PRIMARY KEY constraints, then add FOREIGN KEY constraints (NOT ENFORCED) in dependency order
- **Merge data from Silver** — deduplicate Silver records before MERGE, map columns using YAML lineage metadata, merge dimensions first (SCD1/SCD2) then facts (FK dependency order)
- **Deploy 2-job architecture** — gold_setup_job (2 tasks: create tables + add FK constraints) and gold_merge_job (populate data from Silver)
- **Validate results** — verify table creation, PK/FK constraints, row counts, SCD2 history, and fact-dimension joins

Use the gold layer design YAML files as the target destination, and the silver layer tables as source.

Limit pipelines to only 5 core tables for purposes of this exercise.

IMPORTANT: Use the EXISTING catalog `{lakehouse_default_catalog}` -- do NOT create a new catalog. Create the Gold schema `{user_schema_prefix}_gold` and all Gold tables inside this catalog.

NOTE: Before creating the schema, check if `{lakehouse_default_catalog}.{user_schema_prefix}_gold` already exists. If it does, DROP the schema with CASCADE and recreate it from scratch. These are user-specific schemas so dropping is safe.',
'',
'Gold Layer Pipeline (YAML-Driven)',
'Build Gold layer by reading YAML schemas, creating tables with PK/FK constraints (NOT ENFORCED), and merging from Silver with deduplication',
12,
'## 1️⃣ How To Apply

Copy the prompt above, start a **new Agent chat** in Cursor, and paste it. The AI will read YAML files and generate implementation code.

### Prerequisite

**Run this in your cloned Template Repository** (see Prerequisites in Step 0).

Ensure you have:
- ✅ Gold Layer Design completed (Step 9) with YAML files in `gold_layer_design/yaml/`
- ✅ Column lineage documentation in `gold_layer_design/COLUMN_LINEAGE.csv` (Silver→Gold column mappings)
- ✅ Silver Layer populated (Step 11) with data in Silver tables
- ✅ `data_product_accelerator/skills/gold/01-gold-layer-setup/SKILL.md` — The Gold implementation orchestrator (auto-loads 7 worker + 8 common skills)

### Steps to Apply

**Step 1: Start New Agent Thread** — Open Cursor and start a new Agent thread for clean context.

**Step 2: Copy and Paste the Prompt** — Copy the prompt using the copy button, paste it into Cursor. The AI will read YAML files and generate implementation code.

**Step 3: Review Generated Code** — The AI will create:
- `setup_tables.py` — reads YAML → CREATE TABLE + PKs
- `add_fk_constraints.py` — reads YAML → ALTER TABLE ADD FK (NOT ENFORCED)
- `merge_gold_tables.py` — dedup Silver → map columns → MERGE (SCD1/SCD2/fact)
- `gold_setup_job.yml` — 2-task job (setup → FK via `depends_on`)
- `gold_merge_job.yml` — merge job (scheduled, PAUSED in dev)

**Step 4: Validate the Bundle**

```bash
# Validate bundle configuration
databricks bundle validate -t dev

# Expected: No errors, all resources validated
```

**Step 5: Deploy the Bundle**

```bash
# Deploy to Databricks workspace
databricks bundle deploy -t dev

# Expected: Jobs created successfully
```

**Step 6: Run the Gold Setup Job (Tables + PKs + FKs)**

```bash
# Run Gold setup (creates tables, adds PKs, then adds FKs)
databricks bundle run -t dev gold_setup_job

# This job has TWO tasks:
#   Task 1: setup_tables (creates tables from YAML + adds PKs)
#   Task 2: add_fk_constraints (depends_on Task 1)
#
# FKs are added here (before data) because UC constraints are
# NOT ENFORCED — they''re informational only, no data validation needed.
```

**Step 7: Run the Gold Merge Job**

```bash
# Run Gold merge (populates tables from Silver)
databricks bundle run -t dev gold_merge_job

# Merges dimensions FIRST (SCD1/SCD2), then facts (FK dependency order)
```

**Step 8: Verify in Databricks UI**

After all jobs complete:

```sql
-- 1. List Gold tables
SHOW TABLES IN {lakehouse_default_catalog}.{user_schema_prefix}_gold;

-- 2. Check Primary Key constraints
SELECT * FROM information_schema.table_constraints 
WHERE table_schema = ''{user_schema_prefix}_gold'' AND constraint_type = ''PRIMARY KEY'';

-- 3. Check Foreign Key constraints
SELECT * FROM information_schema.table_constraints 
WHERE table_schema = ''{user_schema_prefix}_gold'' AND constraint_type = ''FOREIGN KEY'';

-- 4. Verify row counts
SELECT ''dim_property'' as tbl, COUNT(*) as cnt FROM {lakehouse_default_catalog}.{user_schema_prefix}_gold.dim_property
UNION ALL SELECT ''dim_destination'', COUNT(*) FROM {lakehouse_default_catalog}.{user_schema_prefix}_gold.dim_destination
UNION ALL SELECT ''dim_user'', COUNT(*) FROM {lakehouse_default_catalog}.{user_schema_prefix}_gold.dim_user
UNION ALL SELECT ''dim_host'', COUNT(*) FROM {lakehouse_default_catalog}.{user_schema_prefix}_gold.dim_host
UNION ALL SELECT ''fact_booking_detail'', COUNT(*) FROM {lakehouse_default_catalog}.{user_schema_prefix}_gold.fact_booking_detail;

-- 5. Preview fact with dimension lookups
SELECT 
    f.booking_id,
    p.property_name,
    d.destination_name,
    u.first_name || '' '' || u.last_name as guest_name,
    f.total_amount
FROM {lakehouse_default_catalog}.{user_schema_prefix}_gold.fact_booking_detail f
JOIN {lakehouse_default_catalog}.{user_schema_prefix}_gold.dim_property p ON f.property_id = p.property_id AND p.is_current = true
JOIN {lakehouse_default_catalog}.{user_schema_prefix}_gold.dim_destination d ON f.destination_id = d.destination_id
JOIN {lakehouse_default_catalog}.{user_schema_prefix}_gold.dim_user u ON f.user_id = u.user_id AND u.is_current = true
LIMIT 5;
```

---

## 2️⃣ What Are We Building?

### 📚 What is the Gold Layer Pipeline?

The Gold Layer Pipeline **implements** the Gold Layer Design by:
1. Reading YAML schema files (single source of truth)
2. Creating dimension and fact tables with proper constraints
3. Merging data incrementally from Silver layer

### Design vs Implementation

| Step | What Happens | Output |
|------|--------------|--------|
| **Step 9: Design** | Define schemas, ERDs, lineage | `gold_layer_design/` folder |
| **Step 12: Implementation** | Create tables, run merges | Populated Gold tables |

### 🎯 Core Philosophy: Extract, Don''t Generate

**ALWAYS prefer scripting techniques to extract names from existing source files over generating them from scratch.**

| Approach | Result |
|----------|--------|
| ❌ **Generate from scratch** | Hallucinations, typos, schema mismatches |
| ✅ **Extract from YAML** | 100% accuracy, consistency, no hallucinations |

### What "Extract" Means

```python
# ❌ WRONG: Hardcode table names (might be wrong!)
tables = ["dim_property", "dim_destination", "fact_booking"]

# ✅ CORRECT: Extract from YAML files
import yaml
from pathlib import Path

def get_gold_table_names():
    yaml_dir = Path("gold_layer_design/yaml")
    tables = []
    for yaml_file in yaml_dir.rglob("*.yaml"):
        with open(yaml_file) as f:
            config = yaml.safe_load(f)
            tables.append(config[''table_name''])
    return tables
```

**Benefits:**
- ✅ 100% accuracy (names come from actual schemas)
- ✅ No hallucinations (only existing entities referenced)
- ✅ Consistency across layers
- ✅ Immediate detection of schema changes

### 🏗️ Gold Layer Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      GOLD LAYER PIPELINE FLOW (2 Jobs)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INPUTS                          PROCESS                       OUTPUT      │
│                                                                             │
│  ┌─────────────────┐   ┌───────────────────────────────────────────────┐  │
│  │ Gold Layer      │   │ gold_setup_job                                │  │
│  │ Design YAML     │──▶│                                               │  │
│  │ (Schema Source) │   │  Task 1: setup_tables.py                     │  │
│  └─────────────────┘   │    • CREATE TABLE from YAML                  │  │
│                         │    • ALTER TABLE ADD PRIMARY KEY              │  │
│  ┌─────────────────┐   │         ↓ depends_on                         │  │
│  │ COLUMN_LINEAGE  │   │  Task 2: add_fk_constraints.py               │  │
│  │ .csv            │   │    • ALTER TABLE ADD FOREIGN KEY (NOT ENFORCED)│  │
│  └─────────────────┘   └───────────────────────────────────────────────┘  │
│                                          ↓                                 │
│  ┌─────────────────┐   ┌───────────────────────────────────────────────┐  │
│  │ Silver Layer    │   │ gold_merge_job                                │  │
│  │ Tables          │──▶│                                               │  │
│  │ (Data Source)   │   │  1. Deduplicate Silver (business_key)         │  │
│  └─────────────────┘   │  2. Map columns (YAML lineage / CSV)         │  │
│                         │  3. Merge dims first (SCD1/SCD2)             │  │
│                         │  4. Merge facts last (FK order)              │  │
│                         └───────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🎯 Workshop Scope: 5 Tables

For this exercise, we limit to **5 key tables**:

| Table | Type | Description |
|-------|------|-------------|
| `dim_property` | Dimension (SCD2) | Vacation rental property details |
| `dim_destination` | Dimension (SCD1) | Travel destinations/locations |
| `dim_user` | Dimension (SCD2) | Platform users (guests) |
| `dim_host` | Dimension (SCD2) | Property host profiles |
| `fact_booking_detail` | Fact | Individual booking transactions |

**Why 5 tables?**
- ✅ Demonstrates all patterns (SCD1, SCD2, Fact)
- ✅ Shows FK relationships (Fact → Dimensions)
- ✅ Completes in reasonable time for workshop
- ✅ Full pattern coverage without complexity overload

### 🔑 Constraint Application Order

```
┌────────────────────────────────────────────────────────────┐
│  gold_setup_job (2 tasks)                                  │
│                                                            │
│  Task 1: setup_tables.py                                   │
│    • CREATE OR REPLACE TABLE ... (from YAML)               │
│    • ALTER TABLE ... ADD CONSTRAINT pk_ PRIMARY KEY        │
│           ↓ (depends_on)                                   │
│  Task 2: add_fk_constraints.py                             │
│    • ALTER TABLE ... ADD CONSTRAINT fk_ FOREIGN KEY        │
│    • FK references PK → PK must exist first                │
│                                                            │
└────────────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────────────┐
│  gold_merge_job                                            │
│    • Merge dimensions first (SCD1/SCD2)                    │
│    • Merge facts last (FK dependency order)                │
└────────────────────────────────────────────────────────────┘
```

### ⚠️ Why FKs BEFORE Data?

Unity Catalog constraints are **NOT ENFORCED** — they are **informational only**:
- They do NOT reject invalid data on INSERT/MERGE
- They DO tell BI tools (Genie, Power BI, Tableau) how tables relate
- They DO improve query optimizer join planning
- Data does NOT need to exist for constraints to be applied

This is a key Databricks concept: PK/FK in Unity Catalog are for **metadata enrichment and BI tool discovery**, not data integrity enforcement.

---

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How It''s Used Here |
|----------|-------------------|
| **Surrogate Keys as PRIMARY KEYs** | Dimensions use surrogate BIGINT keys (not business keys) as PKs — informational constraints in Unity Catalog for BI tool discovery |
| **FOREIGN KEY Constraints** | Fact tables declare FK relationships to dimensions — enables Genie, Power BI, and Tableau to auto-discover joins |
| **SCD Type 1 (Overwrite)** | Reference dimensions like `dim_destination` use SCD1 — MERGE replaces old values with current values |
| **SCD Type 2 (Versioned History)** | Tracking dimensions like `dim_property`, `dim_host` use SCD2 — `is_current`, `valid_from`, `valid_to` columns preserve history |
| **Delta MERGE with Deduplication** | Pre-deduplicates source rows before MERGE to prevent `DELTA_MULTIPLE_SOURCE_ROW_MATCHING_TARGET_ROW_IN_MERGE` errors. Dedup key = `business_key` from YAML. |
| **2-Job Architecture** | `gold_setup_job` (2 tasks: create tables + add FKs) → `gold_merge_job` (populate data). FKs applied before data because constraints are NOT ENFORCED. |
| **NOT ENFORCED Constraints** | UC PK/FK are informational — they help BI tools discover relationships and improve query planning, but don''t reject invalid data |
| **Dual-Purpose COMMENTs** | Every table and column has a COMMENT serving both business users ("Property name for display") and technical users/Genie ("FK to dim_property.property_sk") |
| **Row Tracking** | `delta.enableRowTracking = true` on every Gold table — required for downstream Materialized View incremental refresh |
| **CLUSTER BY AUTO** | Gold tables use automatic liquid clustering — Databricks chooses optimal columns based on actual query patterns |
| **Predictive Optimization Ready** | Gold tables are structured for Databricks Predictive Optimization — auto-OPTIMIZE, auto-VACUUM, auto-ANALYZE |
| **YAML as Single Source of Truth** | Table schemas live in version-controlled YAML files, not in scattered SQL scripts — enables schema diff reviews in PRs |
| **PyYAML + YAML Sync** | `pyyaml>=6.0` in job environment; YAML files synced in `databricks.yml` — without sync, `setup_tables.py` can''t find schemas in workspace |
| **Variable Shadowing Prevention** | Never name variables `count`, `sum`, `min`, `max` — shadows PySpark functions. Use `spark_sum = F.sum`, `record_count = df.count()` |
| **Column Mapping from Lineage** | Silver→Gold column renames extracted from YAML `lineage.source_column` or `COLUMN_LINEAGE.csv` — never guessed or assumed |

---

## 4️⃣ What Happens Behind the Scenes?

When you paste the prompt, the AI reads `@data_product_accelerator/skills/gold/01-gold-layer-setup/SKILL.md` — the **Gold implementation orchestrator**. Behind the scenes:

1. **YAML-driven approach** — the orchestrator reads your `gold_layer_design/yaml/` files (from Step 9) as the **single source of truth**. Table names, columns, types, PKs, FKs are all extracted from YAML — never generated from scratch.
2. **Pipeline worker skills auto-loaded:**
   - `01-yaml-table-setup` — reads YAML schemas and generates CREATE TABLE DDL with PKs
   - `02-merge-patterns` — SCD Type 1/2 dimensions, fact table MERGE operations
   - `03-deduplication` — prevents DELTA_MULTIPLE_SOURCE_ROW_MATCHING errors by deduplicating Silver before MERGE
   - `04-grain-validation` — validates grain before populating fact tables
   - `05-schema-validation` — validates schemas before deployment
3. **Common skills auto-loaded (8 total):**
   - `databricks-expert-agent` — core "Extract, Don''t Generate" principle applied to EVERY YAML read
   - `databricks-asset-bundles` — generates 2 jobs (setup+FK combined, merge separate), `notebook_task` + `base_parameters`
   - `databricks-table-properties` — Gold TBLPROPERTIES (CDF, row tracking, auto-optimize, `layer=gold`)
   - `unity-catalog-constraints` — surrogate keys as PKs (NOT NULL), FK via ALTER TABLE (NOT ENFORCED)
   - `schema-management-patterns` — `CREATE SCHEMA IF NOT EXISTS` with governance metadata
   - `databricks-python-imports` — pure Python modules for shared config (avoids `sys.path` issues)
   - `naming-tagging-standards` — enterprise naming and dual-purpose COMMENTs
   - `databricks-autonomous-operations` — self-healing deploy loop if jobs fail

**Key principle: "Extract, Don''t Generate"** — every table name, column name, and type comes from YAML. The AI never hallucinates schema elements.',
'## Expected Deliverables

### 📁 Generated Asset Bundle Structure

```
project_root/
├── databricks.yml                          # Bundle config (MUST sync YAML files!)
├── src/
│   └── source_gold/
│       ├── setup_tables.py                 # Creates Gold tables from YAML + adds PKs
│       ├── add_fk_constraints.py           # Adds FK constraints (separate script)
│       └── merge_gold_tables.py            # Merges Silver → Gold (dedup + map + merge)
├── resources/
│   └── gold/
│       ├── gold_setup_job.yml              # 2 tasks: setup_tables → add_fk_constraints
│       └── gold_merge_job.yml              # Merge job (scheduled, PAUSED in dev)
└── gold_layer_design/                      # Source of truth (from Step 9 design)
    ├── COLUMN_LINEAGE.csv                  # Silver→Gold column mappings
    └── yaml/
        ├── property/
        │   ├── dim_property.yaml
        │   └── dim_destination.yaml
        ├── user/
        │   ├── dim_user.yaml
        │   └── dim_host.yaml
        └── booking/
            └── fact_booking_detail.yaml
```

> **Critical:** `databricks.yml` must include a sync rule for `gold_layer_design/yaml/**/*.yaml` — without it, the scripts can''t find YAML schemas in the workspace. The environment must also include `pyyaml>=6.0`.

---

### 🔄 What Each Script Does

#### `setup_tables.py` - Table Creation

```python
# Reads YAML → Generates DDL → Creates Tables
for yaml_file in gold_yaml_files:
    config = yaml.safe_load(yaml_file)
    
    # Extract schema from YAML (don''t hardcode!)
    table_name = config[''table_name'']
    columns = config[''columns'']
    primary_key = config[''primary_key'']
    
    # Generate and execute DDL
    ddl = generate_create_table(table_name, columns, primary_key)
    spark.sql(ddl)
```

#### `merge_gold_tables.py` - Data Population

```python
# For each table: Deduplicate → Map Columns → Validate → Merge
for table_name, meta in inventory.items():
    silver_df = spark.table(f"{lakehouse_default_catalog}.{user_schema_prefix}_silver.{meta[''source_table'']}")
    
    # 1. ALWAYS deduplicate Silver before MERGE (mandatory!)
    deduped_df = silver_df.orderBy(col("processed_timestamp").desc()) \
                          .dropDuplicates(meta["business_key"])
    
    # 2. Map columns (Silver names → Gold names from COLUMN_LINEAGE.csv)
    for gold_col, silver_col in meta["column_mappings"].items():
        deduped_df = deduped_df.withColumn(gold_col, col(silver_col))
    
    # 3. Merge (SCD1 or SCD2 based on YAML scd_type)
    merge_condition = build_merge_condition(meta["pk_columns"])
    merge_into_gold(deduped_df, table_name, merge_condition, meta)

# Note: uses spark_sum = F.sum (never shadow Python builtins)
```

#### `add_fk_constraints.py` - Foreign Keys

```python
# Reads FK definitions from YAML → Adds constraints
for yaml_file in gold_yaml_files:
    config = yaml.safe_load(yaml_file)
    
    for fk in config.get(''foreign_keys'', []):
        # Add FK constraint (NOT ENFORCED for performance)
        spark.sql(f"""
            ALTER TABLE {table_name}
            ADD CONSTRAINT fk_{table}_{ref_table}
            FOREIGN KEY ({fk_columns})
            REFERENCES {ref_table}({ref_columns})
            NOT ENFORCED
        """)
```

---

### 📊 Tables Created with Constraints

| Table | Type | Primary Key | Foreign Keys |
|-------|------|-------------|--------------|
| `dim_property` | Dimension (SCD2) | `property_key` | None |
| `dim_destination` | Dimension (SCD1) | `destination_id` | None |
| `dim_user` | Dimension (SCD2) | `user_key` | None |
| `dim_host` | Dimension (SCD2) | `host_key` | None |
| `fact_booking_detail` | Fact | `booking_id` | → dim_property, dim_destination, dim_user, dim_host |

---

### 🔀 Merge Strategies by Table Type

| Table Type | Merge Strategy | What Happens |
|------------|----------------|--------------|
| **Dimension (SCD1)** | Overwrite | Old values replaced with new |
| **Dimension (SCD2)** | Track History | Old record marked `is_current=false`, new record inserted |
| **Fact** | Upsert | INSERT new, UPDATE existing on PK match |

---

### ✅ Verification Queries

After all jobs complete:

```sql
-- 1. Verify table creation
SHOW TABLES IN {lakehouse_default_catalog}.{user_schema_prefix}_gold;

-- 2. Verify Primary Key constraints
SHOW CONSTRAINTS ON {lakehouse_default_catalog}.{user_schema_prefix}_gold.dim_property;

-- 3. Verify Foreign Key constraints
SHOW CONSTRAINTS ON {lakehouse_default_catalog}.{user_schema_prefix}_gold.fact_booking_detail;

-- 4. Verify SCD2 history (multiple versions for same entity)
SELECT property_id, is_current, effective_from, effective_to
FROM {lakehouse_default_catalog}.{user_schema_prefix}_gold.dim_property
WHERE property_id = 123
ORDER BY effective_from;

-- 5. Verify non-negotiable table properties
SHOW TBLPROPERTIES {lakehouse_default_catalog}.{user_schema_prefix}_gold.dim_property;
-- Look for: delta.enableChangeDataFeed=true, delta.enableRowTracking=true,
--           delta.autoOptimize.autoCompact=true, layer=gold

-- 6. Verify SCD2: exactly one is_current=true per business key
SELECT property_id, COUNT(*) as current_versions
FROM {lakehouse_default_catalog}.{user_schema_prefix}_gold.dim_property
WHERE is_current = true
GROUP BY property_id
HAVING COUNT(*) > 1;
-- Expected: ZERO rows (any results = SCD2 bug)

-- 7. Verify fact-dimension joins work (no orphan records)
SELECT 
    f.booking_id,
    p.property_name,
    h.host_name,
    f.total_amount
FROM {lakehouse_default_catalog}.{user_schema_prefix}_gold.fact_booking_detail f
JOIN {lakehouse_default_catalog}.{user_schema_prefix}_gold.dim_property p 
    ON f.property_id = p.property_id AND p.is_current = true
JOIN {lakehouse_default_catalog}.{user_schema_prefix}_gold.dim_host h 
    ON f.host_id = h.host_id AND h.is_current = true
LIMIT 10;
```

---

### ✅ Success Criteria Checklist

**Bundle Deployment:**
- [ ] `databricks bundle validate -t dev` passes (no errors)
- [ ] `databricks bundle deploy -t dev` completes
- [ ] 2 jobs appear in Workflows UI (`gold_setup_job`, `gold_merge_job`)
- [ ] YAML files synced to workspace (verify `gold_layer_design/yaml/` exists)
- [ ] PyYAML dependency present in job environment (`pyyaml>=6.0`)

**Gold Setup Job (2 tasks):**
- [ ] Task 1: All 5 tables created from YAML (no hardcoded DDL)
- [ ] Primary keys added to dimension tables (via `ALTER TABLE`)
- [ ] Task 2: Foreign key constraints added (runs after Task 1 via `depends_on`)
- [ ] Constraints visible in `information_schema.table_constraints`

**Table Properties (non-negotiable):**
- [ ] `CLUSTER BY AUTO` on every table (never specific columns)
- [ ] `delta.enableChangeDataFeed = true` (required for incremental propagation)
- [ ] `delta.enableRowTracking = true` (required for downstream MV refresh)
- [ ] `delta.autoOptimize.autoCompact = true`
- [ ] `delta.autoOptimize.optimizeWrite = true`
- [ ] `layer = gold` in TBLPROPERTIES

**Gold Merge Job:**
- [ ] Dimensions merged BEFORE facts (FK dependency order)
- [ ] Every MERGE deduplicates Silver first (key from YAML `business_key`)
- [ ] Column mappings extracted from YAML/`COLUMN_LINEAGE.csv` (not hardcoded)
- [ ] No variable names shadow PySpark functions (`count`, `sum`, etc.)
- [ ] Row counts match expectations
- [ ] SCD2 dimensions: exactly one `is_current = true` per business key
- [ ] Fact-to-dimension joins resolve correctly (no orphan records)

**Job Configuration:**
- [ ] Jobs use `notebook_task` (never `python_task`)
- [ ] Parameters use `base_parameters` dict (never CLI-style `parameters`)
- [ ] Serverless: `environments` block with `environment_version: "4"`
- [ ] Tags applied: `environment`, `layer=gold`, `job_type`',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 13: Create Use-Case Plan (Operationalization Planning) - bypass_LLM = TRUE
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(10, 'usecase_plan',
'Perform project planning using @data_product_accelerator/skills/planning/00-project-planning/SKILL.md with planning_mode: workshop

This will involve the following steps:

- **Analyze Gold layer** — examine your completed Gold tables to identify natural business domains, key relationships, and analytical questions
- **Generate use-case plans** — create structured plans organized as Phase 1 addendums (1.2 TVFs, 1.3 Metric Views, 1.4 Monitors, 1.5 Dashboards, 1.6 Genie Spaces, 1.7 Alerts, 1.1 ML Models)
- **Produce YAML manifests** — generate 4 machine-readable manifest files (semantic-layer, observability, ML, GenAI agents) as contracts for downstream implementation stages
- **Apply workshop mode caps** — enforce hard limits (3-5 TVFs, 1-2 Metric Views, 1 Genie Space) to keep the workshop focused on pattern variety over depth
- **Define deployment order** — establish build sequence: TVFs → Metric Views → Genie Spaces → Dashboards → Monitors → Alerts → Agents

If a PRD exists at @docs/design_prd.md, reference it for business requirements, user personas, and workflows.',
'',
'Create Use-Case Plan',
'Generate implementation plans for operationalizing use cases with supporting artifacts',
13,
'## 1️⃣ How To Apply

Copy the prompt above, start a **new Agent chat** in Cursor, and paste it. The AI will analyze your Gold layer and create use case plans.

### Prerequisite

**Run this in your cloned Template Repository** (see Prerequisites in Step 0).

Ensure you have:
- ✅ Gold Layer Design completed (Step 9)
- ✅ Gold Layer Implementation completed (Step 12)
- ✅ `data_product_accelerator/skills/planning/00-project-planning/SKILL.md` - The project planning skill
- ✅ `docs/design_prd.md` - PRD with business requirements (optional, if available)

### Steps to Apply

1. **Start new Agent thread** — Open Cursor and start a new Agent thread for clean context
2. **Copy and paste the prompt** — Use the copy button, paste into Cursor; the AI will analyze your Gold layer and create use case plans
3. **Review generated plans** — Plans appear in `plans/` folder (Phase addendums, artifact specs, implementation priorities)
4. **Prioritize use cases** — Identify highest-value use cases, assign P0/P1/P2, determine implementation order
5. **Prepare for implementation** — Use plans to guide Step 14+ (implement artifacts based on plans)

---

## 2️⃣ What Are We Building?

### 📚 What is Use-Case Planning?

After building the Gold layer (data foundation), we now plan how to **operationalize** that data through various artifacts that serve different use cases.

### From Data to Value

| Layer | What You Have | What''s Next |
|-------|---------------|--------------|
| **Bronze** | Raw data | ✅ Complete |
| **Silver** | Clean data | ✅ Complete |
| **Gold** | Business-ready data | ✅ Complete |
| **Artifacts** | Operational use cases | 👉 **THIS STEP** |

### 🎯 Why Plan Before Building?

**The Goal:** Identify use cases FIRST, then create artifacts to realize them.

| Approach | Result |
|----------|--------|
| ❌ Build random artifacts | Unused dashboards, irrelevant metrics |
| ✅ Plan use cases first | Every artifact serves a business need |

### PRD-Driven Planning

If a **Product Requirements Document (PRD)** exists at `docs/design_prd.md`, it provides:

| PRD Element | How It Informs Planning |
|-------------|-------------------------|
| **User Personas** | Who needs what data? |
| **Workflows** | What questions do users ask? |
| **Business Requirements** | What metrics matter most? |
| **Success Criteria** | How do we measure value? |

**PRD → Use Cases → Artifacts**

### 🏗️ Agent Layer Architecture (How Artifacts Connect)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   FROM GOLD LAYER TO USE CASES                               │
│                   (Agent Layer Architecture)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  USERS (Natural Language)                                                   │
│       ↓                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ PHASE 3: Frontend App (Databricks App / Custom UI)                  │    │
│  └──────────────────────────────┬──────────────────────────────────────┘    │
│                                 ↓                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ PHASE 2: AI Agents (orchestrator → domain agents)                   │    │
│  │          Agents query through Genie Spaces — NEVER direct SQL       │    │
│  └──────────────────────────────┬──────────────────────────────────────┘    │
│                                 ↓                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ PHASE 1.6: Genie Spaces (NL-to-SQL interface, ≤ 25 assets each)    │    │
│  └──────────────────────────────┬──────────────────────────────────────┘    │
│                                 ↓                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ PHASE 1 DATA ASSETS (consumed by Genie & Dashboards):               │    │
│  │  1.3 Metric Views │ 1.2 TVFs │ 1.1 ML Tables │ 1.4 Monitors       │    │
│  └──────────────────────────────┬──────────────────────────────────────┘    │
│                                 ↓                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ GOLD LAYER (Foundation — completed in prior steps)                  │    │
│  │  dim_property │ dim_destination │ dim_user │ dim_host │ fact_booking │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

> **Key principle:** Each layer consumes the layer below it. Agents never bypass Genie Spaces to query Gold directly. This provides abstraction, query optimization, and built-in guardrails.

### 📋 Phase 1 Addendums (Artifact Categories)

All analytics artifacts are organized as Phase 1 addendums:

| # | Addendum | Artifacts | Downstream Manifest |
|---|----------|-----------|---------------------|
| 1.1 | **ML Models** | Prediction models, feature tables | `ml-manifest.yaml` |
| 1.2 | **TVFs** | Parameterized SQL functions for Genie | `semantic-layer-manifest.yaml` |
| 1.3 | **Metric Views** | Semantic measures & dimensions | `semantic-layer-manifest.yaml` |
| 1.4 | **Lakehouse Monitoring** | Data quality monitors, custom metrics | `observability-manifest.yaml` |
| 1.5 | **AI/BI Dashboards** | Lakeview visualizations | `observability-manifest.yaml` |
| 1.6 | **Genie Spaces** | NL query interfaces (≤ 25 assets each) | `semantic-layer-manifest.yaml` |
| 1.7 | **Alerting Framework** | SQL Alerts with severity routing | `observability-manifest.yaml` |

> **Workshop default:** 1.2 TVFs, 1.3 Metric Views, and 1.6 Genie Spaces are included by default. Others included if requested.

### 🔄 Planning Methodology

The planning skill organizes work into **3 phases**, with Phase 1 containing **7 addendums** for all analytics artifacts:

### Phase & Addendum Structure

```
Phase 1: Use Cases (ALL analytics artifacts)
├── 1.1 ML Models           (demand predictors, pricing optimizers)
├── 1.2 TVFs                (parameterized queries for Genie)
├── 1.3 Metric Views        (semantic measures & dimensions)
├── 1.4 Lakehouse Monitoring (data quality monitors)
├── 1.5 AI/BI Dashboards    (Lakeview visualizations)
├── 1.6 Genie Spaces        (natural language query interfaces)
└── 1.7 Alerting Framework   (SQL alerts with severity routing)

Phase 2: Agent Framework (AI Agents with Genie integration)
└── Agents use Genie Spaces as query interface (never direct SQL)

Phase 3: Frontend App (User interface — optional)
└── Databricks Apps or custom UI consuming Phase 1-2 artifacts
```

> **Key insight:** ALL data artifacts (TVFs, Metric Views, Dashboards, Monitors, Alerts, ML, Genie Spaces) are addendums within Phase 1. Agents (Phase 2) and Frontend (Phase 3) **consume** Phase 1 artifacts — they are not separate artifact categories.

### Agent Domain Framework

**Domains emerge from business questions, not fixed categories.** The skill derives domains from your Gold table groupings and stakeholder questions:

| Rule | Why |
|------|-----|
| Domains come from Gold table relationships | Natural boundaries, not arbitrary labels |
| A domain needs ≥ 3 business questions | Fewer = merge into a neighbor domain |
| Two domains sharing > 70% of Gold tables → consolidate | Avoid duplicate artifacts |
| Don''t force a fixed count (2-3 for 5-10 tables is fine) | More domains ≠ better |

**Example for your source data:**

| Domain | Focus Area | Key Gold Tables |
|--------|------------|----------------|
| 💰 **Revenue** | Bookings, pricing, revenue trends | `fact_booking_detail`, `dim_property` |
| 🏠 **Host Performance** | Host activity, ratings, response times | `dim_host`, `fact_review` |
| 👤 **Guest Experience** | Guest behavior, satisfaction, lifetime value | `dim_user`, `fact_booking_detail` |

> **Anti-pattern:** Creating 5+ generic domains (Cost, Performance, Quality, Reliability, Security) that don''t map to your actual Gold tables.

### 💡 Use Case Examples for Vacation Rentals

Based on your Gold layer, typical use cases include:

### Revenue Analytics
- "What is our total booking revenue by destination?"
- "Which properties have the highest average nightly rate?"
- "Revenue trend over the past 12 months?"

### Host Performance
- "Who are our top-performing hosts?"
- "Which hosts have the best guest ratings?"
- "Host response time analysis?"

### Guest Insights
- "Customer lifetime value by segment?"
- "Repeat booking rate analysis?"
- "Guest demographics by destination?"

### Property Optimization
- "Property occupancy rates by season?"
- "Which amenities correlate with higher bookings?"
- "Pricing optimization recommendations?"

### Operational Monitoring
- "Data freshness alerts?"
- "Booking anomaly detection?"
- "Revenue target tracking?"

---

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How It''s Used Here |
|----------|-------------------|
| **Agent Domain Framework** | Domains derived from business questions and Gold table groupings (not forced to a fixed count). Each domain maps to a potential Genie Space. |
| **Artifact Rationalization** | Every artifact must trace to a business question. TVFs only when Metric Views can''t answer. No quota-filling. Prevents artifact bloat. |
| **Genie Space 25-Asset Limit** | Hard constraint: each Genie Space holds ≤ 25 data assets. Plan calculates total assets → determines space count. Under 10 assets = merge. |
| **Deployment Order Discipline** | Build order enforced: Phase 1 addendums (1.2→1.3→1.6→1.5→1.4→1.7→1.1) → Phase 2 (Agents). Genie Spaces MUST exist before Agents can use them. |
| **Agent Layer Architecture** | AI Agents (Phase 2) query data through Genie Spaces (Phase 1.6), never direct SQL. Provides abstraction, optimization, and guardrails. |
| **Serverless-First Architecture** | Every artifact designed for serverless execution — SQL warehouses for queries, serverless jobs for ETL, serverless DLT for pipelines |
| **Lakehouse Monitoring Integration** | Plans include monitor specifications leveraging Databricks Lakehouse Monitoring with custom business metrics (AGGREGATE, DERIVED, DRIFT) |
| **AI/BI Dashboard Planning** | Dashboard specs designed for Databricks AI/BI (Lakeview) — native format with widget-query alignment and parameter configuration |
| **Genie Space Optimization Targets** | Plans include benchmark questions with accuracy targets (95%+) and repeatability targets (90%+). General Instructions ≤ 20 lines. |
| **YAML Manifests as Contracts** | 4 machine-readable manifests bridge planning and implementation. Downstream skills parse manifests (not prose). `planning_mode: workshop` prevents expansion. |
| **Workshop Mode Hard Caps** | When `planning_mode: workshop` is active, artifact counts are capped (3-5 TVFs, 1-2 MVs, 1 Genie Space). Manifests propagate this ceiling to all downstream skills. |

---

## 4️⃣ What Happens Behind the Scenes?

When you paste the prompt, the AI reads `@data_product_accelerator/skills/planning/00-project-planning/SKILL.md` — the **Project Planning orchestrator**. Behind the scenes:

1. **Workshop mode detection** — `planning_mode: workshop` activates the workshop profile, which produces a **minimal representative plan** (3-5 TVFs, 1-2 Metric Views, 1 Genie Space) designed for hands-on workshops. The first line of output confirms: `**Planning Mode:** Workshop (explicit opt-in — artifact caps active)`.
2. **Interactive quick start** — the skill asks key decisions before generating plans:
   - Which domains to include (derived from business questions and Gold table groupings)
   - Which Phase 1 addendums to generate (1.1 ML through 1.7 Alerting)
   - Whether to include Phase 2 (Agents) and Phase 3 (Frontend)
   - Agent-to-Genie Space mapping strategy
3. **Artifact Rationalization** — the skill applies rigorous rules to prevent artifact bloat:
   - Every artifact must trace to a business question (no quota-filling)
   - TVFs only where Metric Views can''t answer the question
   - Genie Spaces sized by total asset count (25-asset hard limit per space)
   - Domains consolidated when overlap exceeds 70% of Gold tables
4. **YAML manifest contracts** — 4 machine-readable manifests generated for downstream stages:
   - `semantic-layer-manifest.yaml` (TVFs + Metric Views + Genie Spaces)
   - `observability-manifest.yaml` (Monitors + Dashboards + Alerts)
   - `ml-manifest.yaml` and `genai-agents-manifest.yaml`
5. **Common skills auto-loaded:**
   - `databricks-expert-agent` — "Extract, Don''t Generate" applied to plan-to-implementation handoff
   - `naming-tagging-standards` — enterprise naming conventions for all planned artifacts

**Key concept: Agent Layer Architecture** — Agents (Phase 2) use Genie Spaces (Phase 1.6) as their query interface, NOT direct SQL. This means Genie Spaces must be deployed before agents can consume them.',
'## Expected Deliverables

### 📁 Generated Plan Files

```
plans/
├── README.md                               # Plan index and navigation
├── prerequisites.md                        # Bronze/Silver/Gold summary
├── phase1-use-cases.md                     # Phase 1 master (all analytics artifacts)
│   ├── phase1-addendum-1.1-ml-models.md        # ML model specifications
│   ├── phase1-addendum-1.2-tvfs.md             # TVF definitions
│   ├── phase1-addendum-1.3-metric-views.md     # Metric view specifications
│   ├── phase1-addendum-1.4-lakehouse-monitoring.md  # Monitor configurations
│   ├── phase1-addendum-1.5-aibi-dashboards.md  # Dashboard specifications
│   ├── phase1-addendum-1.6-genie-spaces.md     # Genie Space setups
│   └── phase1-addendum-1.7-alerting.md         # Alert configurations
├── phase2-agent-framework.md               # AI agent specifications (optional)
├── phase3-frontend-app.md                  # App integration plans (optional)
└── manifests/                              # ⭐ Machine-readable contracts
    ├── semantic-layer-manifest.yaml        # TVFs + Metric Views + Genie Spaces
    ├── observability-manifest.yaml         # Monitors + Dashboards + Alerts
    ├── ml-manifest.yaml                    # Feature Tables + Models + Experiments
    └── genai-agents-manifest.yaml          # Agents + Tools + Eval Datasets
```

> **Key innovation: Plan-as-Contract.** The 4 YAML manifests serve as **contracts** between planning and implementation. When downstream skills (semantic layer, monitoring, ML, GenAI) run, they read their manifest to know exactly what to build — enforcing "Extract, Don''t Generate" across the planning-to-implementation handoff. In workshop mode, manifests include `planning_mode: workshop` to prevent downstream skills from expanding beyond listed artifacts.

---

### 📊 Plan Document Structure

Each plan document includes:

```markdown
# Artifact Category Plan

## Overview
- Business objectives
- Target users
- Success metrics

## Artifact Specifications

### Artifact 1: [Name]
- **Agent Domain:** [Derived from your business questions]
- **Description:** [What it does]
- **Source Gold Tables:** [Gold tables used]
- **Business Questions Answered:** [Which stakeholder questions does this serve?]
- **Implementation Priority:** [P0/P1/P2]

### Artifact 2: [Name]
...

## Implementation Timeline
- Sprint assignments
- Dependencies
- Milestones

## Validation Criteria
- How to verify success
- Expected outcomes
```

---

### 🎯 Workshop Mode Artifact Caps

This workshop uses `planning_mode: workshop` — hard caps prevent artifact bloat:

| Category | Workshop Cap | Selection Criteria | Acceleration (default) |
|----------|-------------|-------------------|----------------------|
| **Domains** | 1-2 max | Richest Gold table relationships | Derived from business questions |
| **TVFs** | 3-5 total | One per parameter pattern (date-range, entity-filter, top-N) | ~1-2 per Gold table |
| **Metric Views** | 1-2 total | One per fact table (pick richest joins) | One per distinct grain |
| **Genie Spaces** | 1 unified | All workshop assets in one space (< 15 assets) | Based on 25-asset limit |
| **Dashboards** | 0-1 | Optional if time permits | 5-8 |
| **Monitors** | 1-2 | One fact + one dimension | 10-15 |
| **Alerts** | 2-3 | One CRITICAL + one WARNING (severity demo) | 10-15 |
| **ML Models** | 0-1 | Skip unless explicitly requested | 5-7 |
| **Phase 2 (Agents)** | Skip | Excluded by default in workshop | Full agent framework |
| **Phase 3 (Frontend)** | Skip | Excluded by default in workshop | Databricks App |

> **Selection principle:** Pick the **most representative** artifact for each pattern type. Prefer **variety of patterns** (date-range TVF, entity-filter TVF, top-N TVF) over depth in a single domain. The goal is to teach the full pattern vocabulary with minimum artifacts.

---

### 🔀 Deployment Order (Critical!)

**Phase 1 addendums must be deployed in this order:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                  PHASE 1 DEPLOYMENT ORDER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1.2 TVFs ──────────▶ 1.3 Metric Views ──────────▶ 1.6 Genie Spaces       │
│  (parameterized         (semantic measures           (NL-to-SQL using       │
│   queries)               & dimensions)                TVFs + MVs + tables)  │
│                                                            │                │
│  1.4 Monitors ──────▶ 1.7 Alerts                          │                │
│  (data quality          (threshold/anomaly                 │                │
│   profiling)             notifications)                    │                │
│                                                            │                │
│  1.5 Dashboards                                            │                │
│  (visualizes Metric Views + TVFs + Monitors)               │                │
│                                                            │                │
│  1.1 ML Models                                             │                │
│  (predictions feed into Genie Spaces as tables)            │                │
│                                                            ▼                │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ PHASE 2: AI Agents (consume Genie Spaces — deploy AFTER Phase 1.6) │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                          ↓                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ PHASE 3: Frontend App (consumes Agents + Dashboards — optional)     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

> **Why order matters:** Genie Spaces need TVFs and Metric Views to exist before they can be added as assets. Agents need Genie Spaces to exist before they can query through them. Violating this order causes deployment failures.

---

### ✅ Success Criteria Checklist

**Plan Structure:**
- [ ] First line confirms mode: `**Planning Mode:** Workshop (explicit opt-in)`
- [ ] `plans/README.md` provides navigation with links to all documents
- [ ] Phase 1 master + selected addendums (1.2 TVFs, 1.3 MVs, 1.6 Genie included by default in workshop)
- [ ] Each plan document follows standard template (Overview, Specs, Timeline, Validation)

**Agent Domain Framework:**
- [ ] Domains derived from business questions and Gold table groupings
- [ ] Each domain has ≥ 3 business questions (or merged)
- [ ] No two domains share > 70% of Gold tables (or consolidated)
- [ ] Domain count justified (2-3 for 5-10 Gold tables)

**Artifact Rationalization (Prevent Bloat):**
- [ ] Every artifact traces to a business question
- [ ] No TVF duplicates what a Metric View already provides
- [ ] Each Genie Space has ≤ 25 data assets and ≥ 10 assets
- [ ] Genie Space count based on total asset volume (not domain count)
- [ ] Workshop caps respected: 3-5 TVFs, 1-2 MVs, 1 Genie Space

**YAML Manifests (Plan-as-Contract):**
- [ ] 4 manifests generated in `plans/manifests/`
- [ ] `planning_mode: workshop` present in all manifests
- [ ] All table/column references validated against Gold YAML
- [ ] Artifact counts in manifests match plan addendum counts

**Deployment Order:**
- [ ] Phase 1 addendum dependencies documented
- [ ] Genie Spaces listed as deployed AFTER TVFs + Metric Views
- [ ] Agents (Phase 2) listed as deployed AFTER Genie Spaces (if included)

**Use Case Coverage:**
- [ ] Key business questions documented per domain (≥ 3 each)
- [ ] All artifacts tagged with Agent Domain
- [ ] LLM-friendly comments specified for all artifacts
- [ ] Source Gold tables identified for each artifact',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 14: Build AI/BI Dashboard (moved to step 16, order_number 14) - bypass_LLM = TRUE
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(12, 'aibi_dashboard',
'Build an AI/BI (Lakeview) Dashboard using @data_product_accelerator/skills/monitoring/02-databricks-aibi-dashboards/SKILL.md

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
6. Deploy via Workspace Import API',
'',
'Build AI/BI Dashboard',
'Create an AI/BI (Lakeview) dashboard with KPI counters, charts, filters, and automated deployment from Gold layer data',
14,
'## 1️⃣ How To Apply

**Copy the prompt above**, start a **new Agent thread** in Cursor, and **paste it**. The AI will build the dashboard in phases.

---

### Prerequisites

**Run this in your cloned Template Repository** (see Prerequisites in Step 0).

Ensure you have:
- ✅ Gold Layer Implementation completed (Step 12) — with column COMMENTs
- ✅ Semantic Layer completed (Step 14) — Metric Views for dashboard queries
- ✅ Use-Case Plan created (Step 13) — with dashboard requirements
- ✅ Plan file exists: `plans/phase1-addendum-1.1-dashboards.md`
- ✅ Gold YAML schemas available for column name validation

---

### Steps to Apply

**Step 1:** Start new Agent thread — Open Cursor and start a **new Agent thread** for clean context.

**Step 2:** Copy and paste the prompt — Copy the entire prompt using the copy button, paste it into Cursor. The AI will build the dashboard in phases.

**Step 3:** Plan Reading — The AI will read dashboard plan (`plans/phase1-addendum-1.1-dashboards.md`), extract KPI requirements, chart types, filter dimensions, and identify data sources (Metric Views preferred over raw Gold tables).

**Step 4:** Dataset Creation — The AI will create SQL queries for each widget (using `${catalog}` substitution), use `MEASURE()` function for Metric View queries, include "All" option for filter datasets, and handle NULLs with `COALESCE()` and SCD2 with `is_current = true`.

**Step 5:** Widget and Layout Creation — The AI will build KPI counters (version 2) for top-line metrics, build charts (version 3) for trends and comparisons, build data tables (version 1) for drill-down, and position using 6-column grid (widths 1-6, NOT 12!).

**Step 6:** Parameter and Filter Configuration — The AI will add DATE parameters with static defaults (not DATETIME), create Global Filters page (`PAGE_TYPE_GLOBAL_FILTERS`), and link filter widgets to dataset parameters.

**Step 7:** Validate and Deploy

```bash
# Pre-deployment validation
python scripts/validate_dashboard_queries.py
python scripts/validate_widget_encodings.py

# Deploy via Asset Bundle or API
databricks bundle deploy -t dev
```

```sql
-- Verify Gold tables have COMMENTs (prerequisite for good queries)
SELECT table_name, comment FROM information_schema.tables 
WHERE table_schema = ''{user_schema_prefix}_gold'' AND comment IS NOT NULL;
```

---

## 2️⃣ What Are We Building?

### What is an AI/BI (Lakeview) Dashboard?

**AI/BI Dashboards** (formerly Lakeview) provide **visual, self-service analytics** for business users — no SQL required. They are built from JSON configuration files that define datasets, widgets, pages, and parameters.

**Core Philosophy: Self-Service Analytics**
- ✅ Visual insights for non-technical users
- ✅ Consistent metrics across the organization (via Metric Views)
- ✅ Professional, branded appearance with auto-refresh
- ✅ Automated deployment with validation
- ❌ NOT a code editor — business users interact through UI only

### Lakeview Dashboard Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     AI/BI (LAKEVIEW) DASHBOARD                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    DASHBOARD JSON                                    │   │
│  │              (.lvdash.json configuration file)                      │   │
│  │                                                                     │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │                    PAGES                                     │   │   │
│  │  │  Page 1: Overview    │  Page 2: Details   │  Global Filters │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                     │   │
│  │  ┌───────────────────────────────────────────────────────────────┐ │   │
│  │  │                  WIDGETS (6-Column Grid)                       │ │   │
│  │  │                                                               │ │   │
│  │  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │ │   │
│  │  │  │ KPI  │ │ KPI  │ │ KPI  │ │ KPI  │ │ KPI  │ │ KPI  │    │ │   │
│  │  │  │ (v2) │ │ (v2) │ │ (v2) │ │ (v2) │ │ (v2) │ │ (v2) │    │ │   │
│  │  │  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘    │ │   │
│  │  │  ┌─────────────────┐ ┌─────────────────┐                    │ │   │
│  │  │  │  Line Chart (v3)│ │  Bar Chart (v3) │                    │ │   │
│  │  │  │  Trend over time│ │  By dimension   │                    │ │   │
│  │  │  └─────────────────┘ └─────────────────┘                    │ │   │
│  │  │  ┌─────────────────────────────────────┐                    │ │   │
│  │  │  │         Data Table (v1)              │                    │ │   │
│  │  │  │         Detailed drill-down          │                    │ │   │
│  │  │  └─────────────────────────────────────┘                    │ │   │
│  │  └───────────────────────────────────────────────────────────────┘ │   │
│  │                                                                     │   │
│  │  ┌───────────────────────────────────────────────────────────────┐ │   │
│  │  │                    DATASETS                                    │ │   │
│  │  │  SQL queries → Metric Views / Gold tables / Monitoring tables │ │   │
│  │  │  Parameters: DATE type (not DATETIME), variable substitution  │ │   │
│  │  └───────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────┐  ┌──────────────────────┐                       │
│  │   DEPLOY via API     │  │   VALIDATE before     │                       │
│  │   UPDATE-or-CREATE   │  │   deploy (SQL + widget)│                       │
│  │   Preserves URLs     │  │   90% faster dev loop  │                       │
│  └──────────────────────┘  └──────────────────────┘                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Key Concepts

| Concept | What It Means | Why It Matters |
|---------|--------------|----------------|
| **Lakeview JSON** | Dashboards are defined as `.lvdash.json` files | Version-controlled, deployable via API |
| **6-Column Grid** | Widget positions use columns 0-5 (NOT 12!) | #1 cause of widget snapping issues |
| **Widget Versions** | KPIs=v2, Charts=v3, Tables=v1, Filters=v2 | Wrong version causes rendering errors |
| **DATE Parameters** | Use DATE type (not DATETIME) with static defaults | DATETIME with dynamic expressions won''t work |
| **`dataset_catalog`/`dataset_schema`** | Variable substitution for environment portability | Never hardcode catalog/schema in queries |
| **Widget-Query Alignment** | Widget `fieldName` MUST match query output alias | #1 cause of "no fields to visualize" errors |
| **Number Formatting** | Return raw numbers; widgets format them | `FORMAT_NUMBER()` or string concat breaks widgets |
| **Global Filters Page** | Dedicated page for cross-dashboard filtering | Required for consistent filter behavior |

---

### Dashboard Components

#### Widget Type Reference

| Widget Type | Version | Use Case | Grid Size |
|-------------|---------|----------|-----------|
| **KPI Counter** | v2 | Single metric display (revenue, count) | width: 1-2, height: 2 |
| **Bar Chart** | v3 | Category comparisons (revenue by destination) | width: 3, height: 6 |
| **Line Chart** | v3 | Trends over time (daily revenue) | width: 3, height: 6 |
| **Pie Chart** | v3 | Distribution (booking share by type) | width: 3, height: 6 |
| **Area Chart** | v3 | Stacked trends (revenue by category over time) | width: 3-6, height: 6 |
| **Data Table** | v1 | Detailed drill-down data | width: 6, height: 6+ |
| **Filter** | v2 | Single-select / multi-select / date range | width: 2, height: 2 |

#### Chart Scale Rules (Encoding Requirements)

```
Pie Charts:   color.scale = categorical, angle.scale = quantitative
Bar Charts:   x.scale = categorical, y.scale = quantitative
Line Charts:  x.scale = temporal, y.scale = quantitative
Area Charts:  x.scale = temporal, y.scale = quantitative, y.stack = "zero"
```

> **Missing `scale` in encodings** is the #2 cause of "unable to render visualization" errors.

#### Standard Dashboard Layout (6-Column Grid)

```
┌─────────────────────────────────────────────────────┐
│ Page 1: Overview                                     │
│                                                     │
│ Row 0 (height 2): Filters                           │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│ │ Date (w2)│ │ Filter(w2│ │ Filter(w2│            │
│ └──────────┘ └──────────┘ └──────────┘            │
│                                                     │
│ Row 2 (height 2): KPI Counters                      │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐       │
│ │KPI │ │KPI │ │KPI │ │KPI │ │KPI │ │KPI │       │
│ │w=1 │ │w=1 │ │w=1 │ │w=1 │ │w=1 │ │w=1 │       │
│ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘       │
│                                                     │
│ Row 4 (height 6): Charts                            │
│ ┌──────────────────┐ ┌──────────────────┐          │
│ │  Line Chart (w3) │ │  Bar Chart  (w3) │          │
│ │  Revenue Trend   │ │  By Destination  │          │
│ └──────────────────┘ └──────────────────┘          │
│                                                     │
│ Row 10 (height 6): Detail Table                     │
│ ┌──────────────────────────────────────┐            │
│ │         Data Table (w6)              │            │
│ │         Full-width drill-down        │            │
│ └──────────────────────────────────────┘            │
│                                                     │
├─────────────────────────────────────────────────────┤
│ Page: Global Filters                                 │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│ │ Date (w2)│ │ Dim  (w2)│ │ Dim  (w2)│            │
│ └──────────┘ └──────────┘ └──────────┘            │
│ pageType: PAGE_TYPE_GLOBAL_FILTERS                  │
└─────────────────────────────────────────────────────┘
```

---

### Query Pattern Best Practices

#### Use Metric Views (Preferred)

```sql
-- ✅ PREFERRED: Query Metric View with MEASURE()
SELECT 
  destination,
  MEASURE(total_revenue) as revenue,
  MEASURE(booking_count) as bookings
FROM ${catalog}.${gold_schema}.revenue_analytics_metrics
WHERE booking_date BETWEEN :start_date AND :end_date
GROUP BY destination
ORDER BY revenue DESC
```

#### Direct Gold Table Query (Fallback)

```sql
-- When no Metric View exists for the data
SELECT 
  d.destination_name as destination,
  SUM(f.total_amount) as revenue,
  COUNT(*) as bookings
FROM ${catalog}.${gold_schema}.fact_booking_detail f
JOIN ${catalog}.${gold_schema}.dim_destination d 
  ON f.destination_id = d.destination_id
WHERE f.booking_date BETWEEN :start_date AND :end_date
GROUP BY d.destination_name
ORDER BY revenue DESC
```

#### Number Formatting Rules

| Return This | Widget Displays | Format Type |
|-------------|-----------------|-------------|
| `0.85` | `85%` | `number-percent` |
| `1234.56` | `$1,234.56` | `number-currency` |
| `1234` | `1,234` | `number-plain` |

> **NEVER** use `FORMAT_NUMBER()`, `CONCAT(''$'', ...)`, or `CONCAT(..., ''%'')` in queries. Return raw numbers; let widgets format them.

---

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How It''s Used Here |
|----------|-------------------|
| **6-Column Grid (NOT 12!)** | Widget widths use 1-6 columns. `width: 6` = full width, `width: 3` = half. This is the #1 cause of layout issues — most platforms use 12 columns, Lakeview uses 6. |
| **Widget Version Specs** | KPI Counters = version 2, Charts (bar/line/pie/area) = version 3, Tables = version 1, Filters = version 2. Wrong version causes rendering failures. |
| **Widget-Query Column Alignment** | Every widget `fieldName` MUST exactly match the SQL alias in its dataset query. Mismatch = "no fields to visualize" error. |
| **Raw Number Formatting** | Queries return raw numbers (e.g., `0.85` for 85%). Widgets apply formatting (`number-percent`, `number-currency`, `number-plain`). NEVER use `FORMAT_NUMBER()` or string concatenation. |
| **DATE Parameters (Not DATETIME)** | Dashboard parameters use `DATE` type with static default values. `DATETIME` with dynamic expressions like `now-30d/d` does NOT work. |
| **Variable Substitution** | All queries use `${catalog}.${gold_schema}` — never hardcoded catalog/schema. Substitution done in Python at deployment time. |
| **Global Filters Page** | Every dashboard includes a `PAGE_TYPE_GLOBAL_FILTERS` page for cross-dashboard date range and dimension filtering. |
| **Metric View Queries** | Dashboards query Metric Views using `MEASURE()` function for consistent metric definitions. Metric Views are preferred over raw Gold tables. |
| **UPDATE-or-CREATE Deployment** | Workspace Import API with `overwrite: true` — single code path for create and update. Preserves dashboard URLs and viewer permissions. |
| **Pre-Deployment SQL Validation** | All dataset queries validated with `SELECT ... LIMIT 1` before dashboard import. Catches UNRESOLVED_COLUMN, TABLE_NOT_FOUND, UNBOUND_PARAMETER errors. |
| **SCD2 Handling in Queries** | Dimension queries use `QUALIFY ROW_NUMBER() OVER(PARTITION BY id ORDER BY change_time DESC) = 1` or `WHERE is_current = true` |
| **"All" Option for Filters** | Filter datasets include `SELECT ''All'' UNION ALL SELECT DISTINCT ...` so users can clear filters |

---

## 4️⃣ What Happens Behind the Scenes?

When you paste the prompt, the AI reads `@data_product_accelerator/skills/monitoring/02-databricks-aibi-dashboards/SKILL.md` — the **AI/BI Dashboard worker skill**. Behind the scenes:

1. **Plan reading** — the skill reads your dashboard plan (`plans/phase1-addendum-1.1-dashboards.md`) to extract: KPIs, charts, filters, layout requirements
2. **Dashboard skill loaded** — provides complete JSON templates, widget specs, grid layout rules, query patterns, validation scripts, and deployment workflows
3. **5 Common skills auto-loaded:**
   - `databricks-expert-agent` — "Extract, Don''t Generate" for table/column names
   - `databricks-asset-bundles` — dashboard resource deployment
   - `databricks-python-imports` — deployment script module patterns
   - `naming-tagging-standards` — dashboard and file naming conventions
   - `databricks-autonomous-operations` — self-healing deploy loop
4. **Query pattern selection:** Metric Views → Gold tables → Monitoring tables (priority order)
5. **Pre-deployment validation** — SQL validation + widget-encoding alignment check before import (catches 90% of errors before deploy)
6. **UPDATE-or-CREATE deployment** — Workspace Import API with `overwrite: true` preserves URLs and permissions

**Key principle:** The AI reads your plan to **extract** KPI/chart requirements. Dashboard queries use `${catalog}` and `${gold_schema}` variable substitution — never hardcoded schemas.

> **Note:** For the full observability stack (Lakehouse Monitoring + Dashboards + SQL Alerts), use the orchestrator at `@data_product_accelerator/skills/monitoring/00-observability-setup/SKILL.md`. This step focuses specifically on the dashboard.',
'## Expected Deliverables

### 📁 Dashboard Files Created

```
docs/dashboards/
├── analytics_dashboard.lvdash.json   # Dashboard JSON config
└── README.md                                      # Dashboard documentation

scripts/
├── deploy_dashboard.py                            # UPDATE-or-CREATE deployment
├── validate_dashboard_queries.py                  # Pre-deploy SQL validation
└── validate_widget_encodings.py                   # Widget-query alignment check

resources/monitoring/
└── dashboard_deploy_job.yml                       # Asset Bundle deployment job
```

> **Key:** The `.lvdash.json` file IS the dashboard. It contains all datasets, pages, widgets, parameters, and theme settings. Version-control this file.

---

### 📊 Dashboard Configuration Summary (Workshop Scope)

| Element | Value |
|---------|-------|
| **Dashboard Name** | Analytics Dashboard |
| **Pages** | 2 (Overview + Global Filters) |
| **KPI Counters** | 3-6 top-line metrics (total revenue, bookings, avg rate) |
| **Charts** | 2-4 visualizations (trend line, bar comparison, pie distribution) |
| **Data Tables** | 1 drill-down table |
| **Filters** | Date range + 1-2 dimension filters |
| **Data Sources** | Metric Views (preferred) + Gold tables (fallback) |
| **Parameters** | DATE type with static defaults |
| **Deployment** | UPDATE-or-CREATE via Workspace Import API |

---

### 📊 What Each Widget Does

| Widget | Type | Version | Data Source | Insight |
|--------|------|---------|-------------|---------|
| Total Revenue | KPI Counter | v2 | `revenue_analytics_metrics` | Top-line revenue figure |
| Booking Count | KPI Counter | v2 | `revenue_analytics_metrics` | Total bookings in period |
| Avg Nightly Rate | KPI Counter | v2 | `revenue_analytics_metrics` | Average price metric |
| Revenue Trend | Line Chart | v3 | `fact_booking_detail` | Revenue over time |
| Revenue by Destination | Bar Chart | v3 | `revenue_analytics_metrics` | Geographic breakdown |
| Booking Details | Data Table | v1 | `fact_booking_detail + dims` | Drill-down for analysis |
| Date Range | Filter | v2 | Parameter | Cross-page date filtering |
| Destination | Filter | v2 | `dim_destination` | Geographic filtering |

---

### 📊 6-Column Grid Layout (Critical)

```
┌──────────────────────────────────────────┐
│ Grid columns: 0  1  2  3  4  5          │
│                                          │
│ width: 1 = one column (1/6 of page)     │
│ width: 2 = two columns (1/3 of page)    │
│ width: 3 = three columns (1/2 of page)  │
│ width: 6 = full width (entire page)     │
│                                          │
│ Common layouts:                          │
│ • 6 KPIs: [w1][w1][w1][w1][w1][w1]     │
│ • 3 KPIs: [w2  ][w2  ][w2  ]           │
│ • 2 charts: [w3     ][w3     ]          │
│ • Full table: [w6                ]       │
└──────────────────────────────────────────┘
```

> **#1 mistake:** Using width values from a 12-column grid. In Lakeview, `width: 6` = FULL width, not half!

---

### 📊 Dashboard JSON Structure (Simplified)

```json
{
  "datasets": [
    {
      "name": "kpi_totals",
      "query": "SELECT ... FROM ${catalog}.${gold_schema}.metric_view ..."
    }
  ],
  "pages": [
    {
      "name": "page_overview",
      "displayName": "Overview",
      "layout": [ /* widgets with positions */ ]
    },
    {
      "name": "page_global_filters",
      "displayName": "Global Filters",
      "pageType": "PAGE_TYPE_GLOBAL_FILTERS",
      "layout": [ /* filter widgets */ ]
    }
  ],
  "parameters": [
    {
      "keyword": "start_date",
      "dataType": "DATE",
      "defaultSelection": { "values": { "values": [{"value": "2024-01-01"}] } }
    }
  ]
}
```

---

### ✅ Success Criteria Checklist

**Grid and Layout:**
- [ ] All widget widths use 6-column grid (1-6, never 7-12)
- [ ] KPI row uses consistent heights (height: 2)
- [ ] Chart row uses consistent heights (height: 6)
- [ ] Full-width tables use width: 6
- [ ] Global Filters page included (`PAGE_TYPE_GLOBAL_FILTERS`)

**Widget Versions (non-negotiable):**
- [ ] KPI Counters use version 2 (not 3)
- [ ] Bar/Line/Pie/Area Charts use version 3
- [ ] Data Tables use version 1
- [ ] Filters use version 2

**Widget-Query Alignment:**
- [ ] Every widget `fieldName` matches its SQL alias exactly
- [ ] Pie charts have `scale` on both `color` and `angle` encodings
- [ ] Bar charts have `scale` on both `x` and `y` encodings
- [ ] Line charts use `temporal` scale on x-axis

**Number Formatting:**
- [ ] Percentages returned as 0-1 decimal (widget displays as %)
- [ ] Currency returned as raw number (widget displays as $)
- [ ] No `FORMAT_NUMBER()` or string concatenation in queries

**Parameters:**
- [ ] Date parameters use DATE type (never DATETIME)
- [ ] Static default values (never dynamic expressions like `now-30d`)
- [ ] All parameters defined in dataset''s `parameters` array
- [ ] Filters include "All" option via `UNION ALL`

**Data Sources:**
- [ ] Queries use `${catalog}.${gold_schema}` variable substitution
- [ ] No hardcoded catalog or schema names in queries
- [ ] Metric View queries use `MEASURE()` function where applicable
- [ ] SCD2 dimensions filtered with `is_current = true` or `QUALIFY`
- [ ] NULL values handled with `COALESCE()`

**Deployment:**
- [ ] `.lvdash.json` file created and version-controlled
- [ ] `deploy_dashboard.py` uses UPDATE-or-CREATE pattern
- [ ] `validate_dashboard_queries.py` passes all SQL checks
- [ ] `validate_widget_encodings.py` passes all alignment checks
- [ ] `databricks bundle deploy -t dev` succeeds

**Verification:**
```sql
-- Check dashboard exists in workspace
-- Navigate to: Databricks → Dashboards → find your dashboard

-- Verify data sources are connected
SELECT COUNT(*) FROM ${catalog}.${gold_schema}.fact_booking_detail;

-- Verify Metric Views exist
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = ''{user_schema_prefix}_gold'' AND table_type = ''METRIC_VIEW'';
```',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 15: Build Genie Space [Metric Views/TVFs] - bypass_LLM = TRUE
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(11, 'genie_space',
'Set up the semantic layer using @data_product_accelerator/skills/semantic-layer/00-semantic-layer-setup/SKILL.md

This will involve the following end-to-end workflow:

- **Read plan manifests** — extract TVF, Metric View, and Genie Space specifications from the semantic-layer-manifest.yaml (from Step 13 planning)
- **Create Metric Views** — build Metric Views using `WITH METRICS LANGUAGE YAML` syntax with dimensions, measures, 3-5 synonyms each, and format specifications
- **Create Table-Valued Functions (TVFs)** — write parameterized SQL functions with STRING date params (non-negotiable for Genie), v3.0 bullet-point COMMENTs, and ROW_NUMBER for Top-N patterns
- **Configure Genie Space** — set up natural language query interface with data assets (Metric Views → TVFs → Gold tables priority), General Instructions (≤20 lines), and ≥10 benchmark questions with exact expected SQL
- **Create JSON exports** — export Genie Space configuration as JSON for CI/CD deployment across environments
- **Optimize for accuracy** — run benchmark questions via Conversation API and tune 6 control levers until accuracy ≥95% and repeatability ≥90%

Implement in this order:

1. **Table-Valued Functions (TVFs)** — using plan at @data_product_accelerator/plans/phase1-addendum-1.2-tvfs.md
2. **Metric Views** — using plan at @data_product_accelerator/plans/phase1-addendum-1.3-metric-views.md
3. **Genie Space** — using plan at @data_product_accelerator/plans/phase1-addendum-1.6-genie-spaces.md
4. **Genie JSON Exports** — create export/import deployment jobs

The orchestrator skill automatically loads worker skills for TVFs, Metric Views, Genie Space patterns, and export/import API.',
'',
'Build Genie Space [Metric Views/TVFs]',
'Create semantic layer with TVFs, Metric Views, and Genie Space for natural language analytics',
15,
'## 1️⃣ How To Apply

Copy the prompt above, start a **new Agent chat** in Cursor, and paste it. The AI will process all 4 implementation steps in order.

---

### Prerequisite

**Run this in your cloned Template Repository** (see Prerequisites in Step 0).

Ensure you have:
- ✅ Gold Layer Implementation completed (Step 12) — with column COMMENTs on all tables
- ✅ Use-Case Plan created (Step 13) — with `planning_mode: workshop`
- ✅ Plan manifest exists: `plans/manifests/semantic-layer-manifest.yaml`
- ✅ Plan addendum files exist:
  - `plans/phase1-addendum-1.2-tvfs.md`
  - `plans/phase1-addendum-1.3-metric-views.md`
  - `plans/phase1-addendum-1.6-genie-spaces.md`
- ✅ Gold YAML schemas available in `gold_layer_design/yaml/` (for schema validation)

---

### Steps to Apply

**Step 1: Start New Agent Thread** — Open Cursor and start a new Agent thread for clean context.

**Step 2: Copy and Paste the Prompt** — Copy the entire prompt using the copy button, paste it into Cursor. The AI will process all 4 implementation steps in order.

**Step 3: Phase 0 — Plan Reading** — The AI will read `plans/manifests/semantic-layer-manifest.yaml` (implementation checklist), extract exact TVF names, Metric View specs, Genie Space configuration. If no manifest exists, fall back to self-discovery from Gold tables.

**Step 4: Phase 1 — Metric Views** — The AI will read Metric View plan (`plans/phase1-addendum-1.3-metric-views.md`), create YAML definition files (dimensions, measures, synonyms, formats), create `create_metric_views.py` (reads YAML → `CREATE VIEW WITH METRICS LANGUAGE YAML`), create `metric_views_job.yml` for Asset Bundle deployment.

**Step 5: Phase 2 — TVFs** — The AI will read TVF plan (`plans/phase1-addendum-1.2-tvfs.md`), validate Gold YAML schemas (confirm column names/types exist), create `table_valued_functions.sql` with v3.0 bullet-point COMMENTs, create `tvf_job.yml` (SQL task) for Asset Bundle deployment.

**Step 6: Phase 3 — Genie Space** — The AI will read Genie Space plan (`plans/phase1-addendum-1.6-genie-spaces.md`), verify ALL Gold tables have column COMMENTs (prerequisite), configure: data assets (MVs → TVFs → tables), General Instructions (≤20 lines), create ≥10 benchmark questions with exact expected SQL.

**Step 7: Deploy and Validate**

```bash
# Deploy all semantic layer jobs
databricks bundle deploy -t dev
databricks bundle run tvf_job -t dev
databricks bundle run metric_views_job -t dev
```

```sql
-- Test TVFs (note: STRING date params, not DATE)
SELECT * FROM get_revenue_by_period(''2024-01-01'', ''2024-12-31'');
SELECT * FROM get_top_properties_by_revenue(''2024-01-01'', ''2024-12-31'', 10);

-- Verify Metric View created correctly
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = ''{user_schema_prefix}_gold'' AND table_type = ''METRIC_VIEW'';
```

**Step 8: Phase 5 — Optimization Loop** — After Genie Space is created: run benchmark questions via Conversation API, check accuracy (target: ≥ 95%) and repeatability (target: ≥ 90%), apply 6 control levers if targets not met (UC metadata → Metric Views → TVFs → Monitoring → ML → Genie Instructions), re-test until targets achieved.

---

## 2️⃣ What Are We Building?

### What is the Semantic Layer?

The **Semantic Layer** sits between your Gold data and end users, providing:
- **Natural language** access to data
- **Standardized metrics** with business definitions
- **Reusable query patterns** via functions

### Semantic Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SEMANTIC LAYER STACK                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                   GENIE SPACE (Phase 3)                              │   │
│  │              Natural Language Interface                              │   │
│  │   "What is our total revenue this month by destination?"            │   │
│  │   Serverless SQL Warehouse │ ≤20-line Instructions │ ≥10 Benchmarks │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 │ Data Asset Priority:                      │
│                    ┌────────────┴────────────┐                             │
│                    │ 1st choice   2nd choice │                             │
│                    ▼                         ▼                             │
│  ┌─────────────────────────┐   ┌─────────────────────────┐                │
│  │  METRIC VIEWS (Phase 1) │   │    TVFs (Phase 2)       │                │
│  │  WITH METRICS YAML      │   │  STRING date params     │                │
│  │                         │   │                         │                │
│  │  • Dimensions + Synonyms│   │  • get_revenue_by_period│                │
│  │  • Measures + Formats   │   │  • get_top_properties   │                │
│  │  • Joins (snowflake)    │   │  • get_host_performance │                │
│  │  • v1.1 specification   │   │  • v3.0 bullet comments │                │
│  └────────────┬────────────┘   └────────────┬────────────┘                │
│               │                             │                              │
│               └──────────────┬──────────────┘                              │
│                              │ 3rd choice (raw tables)                     │
│                              ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    GOLD LAYER (prerequisite)                         │   │
│  │   dim_property │ dim_host │ dim_user │ fact_booking_detail │ ...    │   │
│  │   All tables must have column COMMENTs before Genie Space creation  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    OPTIMIZATION (Phase 5)                            │   │
│  │   Benchmark → Test → Apply 6 Levers → Re-test                      │   │
│  │   Target: Accuracy ≥ 95%  │  Repeatability ≥ 90%                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Why This Order Matters

| Phase | Artifact | Depends On | Enables | Non-Negotiable Rule |
|-------|----------|------------|---------|---------------------|
| 0 | **Read Plan** | Semantic layer manifest | All phases | Extract specs from plan, don''t generate |
| 1 | **Metric Views** | Gold tables + COMMENTs | Genie + Dashboards | `WITH METRICS LANGUAGE YAML` syntax |
| 2 | **TVFs** | Gold YAML schemas | Genie NL queries | All date params STRING (not DATE) |
| 3 | **Genie Space** | MVs + TVFs + COMMENTs | End-user queries | ≥10 benchmarks, Serverless warehouse |
| 4 | **JSON Export** | Genie Space | CI/CD deployment | Variable substitution for env portability |
| 5 | **Optimization** | Genie Space deployed | Production readiness | ≥95% accuracy, ≥90% repeatability |

**Build bottom-up:** Metric Views and TVFs FIRST (both depend only on Gold), then Genie Space (depends on both), then Optimize.

---

### The Three Semantic Components

### 1️⃣ Table-Valued Functions (TVFs)

**What:** Parameterized SQL functions that return tables.

```sql
-- Example TVF (v3.0 bullet-point comment format)
CREATE OR REPLACE FUNCTION get_top_properties_by_revenue(
  start_date STRING COMMENT ''Start date (format: YYYY-MM-DD)'',
  end_date STRING COMMENT ''End date (format: YYYY-MM-DD)'',
  top_n INT DEFAULT 10 COMMENT ''Number of top properties to return''
)
RETURNS TABLE(
  rank INT COMMENT ''Property rank by revenue'',
  property_name STRING COMMENT ''Property display name'',
  destination STRING COMMENT ''Property location'',
  total_revenue DECIMAL(18,2) COMMENT ''Total booking revenue for period''
)
COMMENT ''
• PURPOSE: Returns top N properties ranked by booking revenue for a date range
• BEST FOR: "top properties by revenue" | "best performing properties" | "highest earning rentals"
• RETURNS: Individual property rows (rank, name, destination, revenue)
• PARAMS: start_date, end_date (YYYY-MM-DD), top_n (default: 10)
• SYNTAX: SELECT * FROM get_top_properties_by_revenue(''''2024-01-01'''', ''''2024-12-31'''', 10)
''
RETURN
  WITH ranked AS (
    SELECT 
      p.property_name,
      d.destination_name as destination,
      SUM(f.total_amount) as total_revenue,
      ROW_NUMBER() OVER (ORDER BY SUM(f.total_amount) DESC) as rank
    FROM {lakehouse_default_catalog}.{user_schema_prefix}_gold.fact_booking_detail f
    JOIN {lakehouse_default_catalog}.{user_schema_prefix}_gold.dim_property p 
      ON f.property_id = p.property_id AND p.is_current = true
    JOIN {lakehouse_default_catalog}.{user_schema_prefix}_gold.dim_destination d 
      ON f.destination_id = d.destination_id
    WHERE f.booking_date BETWEEN CAST(start_date AS DATE) AND CAST(end_date AS DATE)
    GROUP BY p.property_name, d.destination_name
  )
  SELECT rank, property_name, destination, total_revenue
  FROM ranked
  WHERE rank <= top_n;
```

**⚠️ Critical TVF Rules:**
- ✅ **STRING for date params** — Genie passes dates as strings. DATE type breaks Genie SQL generation.
- ✅ **ROW_NUMBER + WHERE** for Top N — never `LIMIT {param}` (SQL compilation error)
- ✅ **v3.0 bullet-point COMMENT** — `• PURPOSE:`, `• BEST FOR:`, `• RETURNS:`, `• PARAMS:`, `• SYNTAX:`
- ✅ **SCD2 filter** — `AND p.is_current = true` on dimension joins
- ✅ **NULLIF** for all divisions — prevents divide-by-zero errors

---

### 2️⃣ Metric Views

**What:** Semantic definitions with dimensions, measures, and synonyms using Databricks'' `WITH METRICS LANGUAGE YAML` syntax.

```sql
-- Metric Views use YAML syntax, NOT regular SQL views:
CREATE OR REPLACE VIEW {lakehouse_default_catalog}.{user_schema_prefix}_gold.revenue_analytics_metrics
WITH METRICS
LANGUAGE YAML
COMMENT ''PURPOSE: Revenue and booking analytics...''
AS $$
version: "1.1"

source: {lakehouse_default_catalog}.{user_schema_prefix}_gold.fact_booking_detail

dimensions:
  - name: destination
    expr: source.destination_name
    comment: Travel destination for geographic analysis
    display_name: Destination
    synonyms: [location, city, travel destination]

measures:
  - name: total_revenue
    expr: SUM(source.total_amount)
    comment: Total booking revenue in USD
    display_name: Total Revenue
    format:
      type: currency
      currency_code: USD
    synonyms: [revenue, earnings, income, amount]

  - name: booking_count
    expr: COUNT(*)
    comment: Number of bookings
    display_name: Booking Count
    synonyms: [bookings, reservations, count]
$$
```

**⚠️ Critical Metric View Rules:**
- ✅ **`WITH METRICS LANGUAGE YAML`** — NOT regular `CREATE VIEW` with TBLPROPERTIES
- ✅ **`AS $$ ... $$`** — YAML wrapped in dollar-quote delimiters (no SELECT)
- ✅ **`version: "1.1"`** — required in every metric view YAML
- ✅ **3-5 synonyms** per dimension/measure — dramatically improves Genie NL accuracy
- ✅ **Format specs** — currency, percentage, number for proper display

---

### 3️⃣ Genie Space

**What:** Natural language interface to your data, configured with a **7-section deliverable structure.**

**Required sections:**

| # | Section | Requirement |
|---|---------|-------------|
| 1 | **Name & Description** | Domain-specific, descriptive name |
| 2 | **Data Assets** | Priority order: Metric Views → TVFs → Gold Tables (≤ 25 total) |
| 3 | **General Instructions** | ≤ 20 lines: table preferences, defaults, disambiguation |
| 4 | **Benchmark Questions** | ≥ 10 questions with exact expected SQL |
| 5 | **Sample Questions** | 5-10 curated examples shown to users |
| 6 | **Warehouse** | Serverless SQL Warehouse (non-negotiable) |
| 7 | **Column Comments** | Verify ALL Gold tables have COMMENTs before creation |

**Data Asset Priority:** Genie uses Metric Views FIRST (pre-aggregated), then TVFs (parameterized), then raw Gold tables. This priority order maximizes accuracy.

**Example benchmark question (with exact SQL):**
```
Q: "What is our total revenue this month?"
SQL: SELECT MEASURE(total_revenue) FROM revenue_analytics_metrics
     WHERE booking_date >= DATE_TRUNC(''month'', CURRENT_DATE())
```

---

---

## 💡 TVF Design Best Practices

### v3.0 Bullet-Point Comment Format (CRITICAL for Genie)

```sql
COMMENT ''
• PURPOSE: [One-line description of what it returns]
• BEST FOR: [Question 1] | [Question 2] | [Question 3]
• RETURNS: [Description of output rows — what each row represents]
• PARAMS: [param1] (required), [param2] (optional, default: X)
• SYNTAX: SELECT * FROM function_name(''''value1'''', ''''value2'''')
''
```

> **Why bullet format?** Genie''s SQL generation engine parses these structured comments to decide WHEN to invoke a TVF and WHICH parameters to pass. Unstructured prose comments reduce Genie accuracy.

### Parameter Rules (Non-Negotiable)

| Rule | Do This | Never Do This |
|------|---------|---------------|
| **Date params** | `start_date STRING COMMENT ''Format: YYYY-MM-DD''` | ❌ `start_date DATE` (breaks Genie) |
| **Param ordering** | Required first, DEFAULT params last | ❌ Optional before required |
| **Top N** | `ROW_NUMBER() OVER(...) + WHERE rank <= top_n` | ❌ `LIMIT top_n` (SQL error in TVF) |
| **Null safety** | `NULLIF(denominator, 0)` for all divisions | ❌ Bare division (divide-by-zero) |
| **SCD2 joins** | `AND dim.is_current = true` | ❌ Joining without SCD2 filter (duplicates) |

### Schema Validation BEFORE Writing SQL

**100% of TVF compilation errors are caused by not consulting Gold YAML schemas first.**

```python
# ALWAYS validate before writing SQL:
# 1. Read gold_layer_design/yaml/{domain}/{table}.yaml
# 2. Confirm column names and types exist
# 3. Then write TVF SQL using validated names
```

---

## 💡 Metric View Best Practices

### COMMENT Format (on the CREATE VIEW, not inside YAML)

```sql
COMMENT ''PURPOSE: Revenue and booking analytics by property and destination.
BEST FOR: "total revenue" | "bookings by destination" | "average nightly rate"
NOT FOR: Host-level metrics (use host_performance_metrics instead)
DIMENSIONS: destination, property_type, booking_month
MEASURES: total_revenue, booking_count, avg_nightly_rate
SOURCE: fact_booking_detail (bookings domain)''
```

### Schema Validation (100% Error Prevention)

```python
# Before writing YAML, validate column names exist:
# 1. Read gold_layer_design/yaml/bookings/fact_booking_detail.yaml
# 2. Confirm "destination_name", "total_amount", "property_type" exist
# 3. Only THEN write dimension/measure expressions using validated names
```

### Synonym Guidelines (3-5 per field)

```yaml
synonyms:
  - exact_alternative    # "revenue" for "total_revenue"
  - business_term        # "earnings" for "total_revenue"
  - abbreviation         # "qty" for "quantity"
  - common_variation     # "amount" for "total_amount"
  - colloquial           # "income" for "total_revenue"
```

> **Why 3-5?** Fewer synonyms miss natural language variations. More than 5 creates ambiguity where Genie can''t distinguish which measure the user means.

---

## 💡 Genie Space Configuration

### General Instructions (≤ 20 Lines)

```
-- These instructions tell Genie HOW to query your data:
1. For revenue queries, prefer revenue_analytics_metrics (Metric View) first
2. For parameterized queries (date ranges, top-N), use TVFs
3. For detail-level queries, use Gold tables directly
4. Default date range: last 30 days if not specified
5. Always join dimensions with is_current = true (SCD2)
6. For host queries, use dim_host; for property queries, use dim_property
7. Revenue = SUM(total_amount) from fact_booking_detail
8. When asked "top N", use get_top_properties_by_revenue TVF
```

> **Why ≤ 20 lines?** Genie''s instruction processing degrades with too many rules. Focus on table preferences, defaults, and common disambiguation.

### Benchmark Questions (Minimum 10, with Exact SQL)

```
-- Each benchmark includes the question AND the expected SQL:
Q1: "What is total revenue this month?"
SQL: SELECT MEASURE(total_revenue) FROM revenue_analytics_metrics WHERE ...

Q2: "Top 10 properties by revenue last year"
SQL: SELECT * FROM get_top_properties_by_revenue(''2025-01-01'', ''2025-12-31'', 10)

Q3: "How many bookings per destination?"
SQL: SELECT destination, MEASURE(booking_count) FROM revenue_analytics_metrics GROUP BY ...
-- ... (minimum 10 total)
```

> **Why exact SQL?** Benchmark SQL enables automated testing via the Conversation API — you can programmatically verify Genie generates correct queries.

---

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How It''s Used Here |
|----------|-------------------|
| **Metric View `WITH METRICS LANGUAGE YAML`** | Metric views use Databricks'' native YAML syntax (`CREATE VIEW ... WITH METRICS LANGUAGE YAML AS $$ ... $$`) — NOT regular views with TBLPROPERTIES |
| **TVFs with STRING Parameters** | All TVF date parameters use STRING type — non-negotiable for Genie compatibility. Genie passes dates as strings; DATE type breaks SQL generation. |
| **v3.0 Bullet-Point Comments** | `• PURPOSE:`, `• BEST FOR:`, `• RETURNS:`, `• PARAMS:`, `• SYNTAX:` — Genie parses these structured bullets to decide when to invoke each TVF |
| **Schema Validation Before SQL** | Always read Gold YAML schemas before writing TVF SQL. 100% of compilation errors are caused by referencing non-existent columns. |
| **ROW_NUMBER for Top-N** | Never `LIMIT {param}` in TVFs (SQL compilation error). Use `ROW_NUMBER() OVER(...) + WHERE rank <= top_n` instead. |
| **SCD2 Filter on Dimension Joins** | Every TVF joining dimensions must include `AND dim.is_current = true` — omitting this causes row duplication from historical SCD2 records |
| **Genie Space General Instructions** | ≤20 lines of focused instructions telling Genie which tables to prefer, default time ranges, and disambiguation rules |
| **Minimum 10 Benchmark Questions** | Each Genie Space requires ≥ 10 benchmark questions with exact expected SQL — enables automated accuracy testing via the Conversation API |
| **Column Comments Required** | All Gold tables must have column COMMENTs BEFORE creating a Genie Space — Genie uses these to understand column semantics for SQL generation |
| **Export/Import API for CI/CD** | Genie Space configuration exported as JSON — enables version-controlled deployment across dev/staging/prod environments |
| **Optimization Loop (6 Levers)** | Iterative tuning: UC metadata → Metric Views → TVFs → Monitoring tables → ML tables → Genie Instructions, targeting 95%+ accuracy, 90%+ repeatability |
| **Serverless SQL Warehouse** | Genie Spaces MUST use a Serverless SQL warehouse — required for natural language query execution. NEVER Classic or Pro. |
| **Synonym-Rich Definitions** | 3-5 synonyms per dimension/measure (e.g., "revenue" → "earnings", "income", "amount") — dramatically improves Genie NL understanding |

---

## 4️⃣ What Happens Behind the Scenes?

When you paste the prompt, the AI reads `@data_product_accelerator/skills/semantic-layer/00-semantic-layer-setup/SKILL.md` — the **Semantic Layer orchestrator**. Behind the scenes:

1. **Phase 0: Read Plan** — the orchestrator first looks for `plans/manifests/semantic-layer-manifest.yaml`. If found, it uses this as the implementation checklist (every TVF, Metric View, and Genie Space pre-defined). If not found, it falls back to self-discovery from Gold tables.
2. **5 Worker skills auto-loaded:**
   - `01-metric-views-patterns` — `WITH METRICS LANGUAGE YAML` syntax, schema validation, join patterns (including snowflake schema)
   - `02-databricks-table-valued-functions` — STRING parameters (non-negotiable), v3.0 bullet-point comments, Top-N via ROW_NUMBER, SCD2 handling
   - `03-genie-space-patterns` — 7-section deliverable structure, General Instructions (≤20 lines), minimum 10 benchmark questions
   - `04-genie-space-export-import-api` — REST API JSON schema for programmatic Genie Space deployment (CI/CD)
   - `05-genie-space-optimization` — iterative 6-lever optimization loop targeting 95%+ accuracy, 90%+ repeatability
3. **5 Common skills auto-loaded:**
   - `databricks-expert-agent` — "Extract, Don''t Generate" applied to all schema references
   - `databricks-asset-bundles` — SQL task jobs for TVF deployment, Python jobs for Metric Views
   - `databricks-python-imports` — pure Python module patterns for Metric View creation scripts
   - `naming-tagging-standards` — enterprise naming for all semantic layer artifacts
   - `databricks-autonomous-operations` — self-healing deploy loop when jobs fail
4. **Phase-ordered execution:** Metric Views → TVFs → Genie Space → API Export → Optimization. Each phase only begins after the previous completes.
5. **Phase 5: Optimization Loop** — after Genie Space creation, the orchestrator runs benchmark questions via the Conversation API and tunes 6 control levers (UC metadata, Metric Views, TVFs, Monitoring tables, ML tables, Genie Instructions) until accuracy ≥95% and repeatability ≥90%.

**Key principle:** The AI reads your plan manifest to **extract** specifications — it doesn''t generate them from scratch. This ensures the semantic layer matches your approved plan exactly.',
'## Expected Deliverables

### 📁 Semantic Layer Files Created

```
src/source_gold/
├── table_valued_functions.sql           # All TVFs in one SQL file (3-5 functions)
├── semantic/
│   └── metric_views/
│       ├── revenue_analytics_metrics.yaml   # Metric view YAML definition
│       └── create_metric_views.py           # Script: reads YAML → CREATE VIEW WITH METRICS
├── genie/
│   └── genie_space_config.json          # Exported Genie Space config (CI/CD)
resources/
├── semantic-layer/
│   ├── tvf_job.yml                      # SQL task to deploy TVFs
│   ├── metric_views_job.yml             # Python task to deploy Metric Views
│   └── genie_deploy_job.yml             # Genie Space import job (optional)
```

**TVF Count:** 3-5 functions (workshop mode) — one per parameter pattern (date-range, entity-filter, top-N)

---

### 📊 Metric View Deployment Pattern

Each Metric View is created via a Python script that reads YAML and runs:

```python
# create_metric_views.py reads YAML → generates DDL
create_sql = f"""
CREATE OR REPLACE VIEW {lakehouse_default_catalog}.{user_schema_prefix}_gold.{view_name}
WITH METRICS
LANGUAGE YAML
COMMENT ''{view_comment}''
AS $$
{yaml_content}
$$
"""
spark.sql(create_sql)
```

> **Key:** Metric Views use `WITH METRICS LANGUAGE YAML` — NOT regular views with TBLPROPERTIES. This is a non-negotiable syntax requirement.

**Metric View Count:** 1-2 metric views (workshop mode) — one per fact table with richest dimension joins

---

### 📊 TVF Summary Table (Workshop Scope: 3-5 TVFs)

| Pattern | Function | Parameters (all STRING for dates) | Returns |
|---------|----------|----------------------------------|---------|
| **Date Range** | `get_revenue_by_period` | start_date STRING, end_date STRING | Revenue aggregates by destination |
| **Top-N** | `get_top_properties_by_revenue` | start_date STRING, end_date STRING, top_n INT | Top N properties ranked by revenue |
| **Entity Filter** | `get_host_performance` | host_id STRING DEFAULT NULL, min_bookings STRING DEFAULT ''5'' | Host performance metrics |

> **Workshop selection:** One per parameter pattern to teach the full TVF vocabulary. Production would add 10-15 more.

---

### 📊 Metric View Summary (Workshop Scope: 1-2)

| Metric View | Source | Dimensions | Measures | Synonyms |
|-------------|--------|------------|----------|----------|
| `revenue_analytics_metrics` | fact_booking_detail + dim_property + dim_destination | destination, property_type, booking_month | total_revenue, booking_count, avg_nightly_rate | revenue→earnings, bookings→reservations |

> **Workshop selection:** One metric view with richest joins to demonstrate full YAML syntax (dimensions, measures, joins, formats, synonyms).

---

### 🔗 Genie Space Configuration (1 Unified Space)

| Element | Value |
|---------|-------|
| **Name** | Analytics |
| **Data Assets** | 1 Metric View + 3-5 TVFs + 4 Gold Tables (< 15 total) |
| **General Instructions** | ≤ 20 lines (table preferences, defaults, disambiguation) |
| **Benchmark Questions** | ≥ 10 with exact expected SQL |
| **Sample Questions** | 5-10 curated examples shown to users |
| **Warehouse** | Serverless SQL Warehouse (non-negotiable) |
| **Optimization Target** | Accuracy ≥ 95%, Repeatability ≥ 90% |

---

### ✅ Success Criteria Checklist

**TVFs (non-negotiable):**
- [ ] All date parameters use STRING type (never DATE — breaks Genie)
- [ ] v3.0 bullet-point COMMENT format on every TVF (`• PURPOSE:`, `• BEST FOR:`, etc.)
- [ ] Top-N uses `ROW_NUMBER() + WHERE rank <=` (never `LIMIT {param}`)
- [ ] SCD2 dimension joins include `AND dim.is_current = true`
- [ ] `NULLIF(denominator, 0)` for all divisions
- [ ] Schema validated against Gold YAML before writing SQL
- [ ] 3-5 TVFs created (workshop mode)

**Metric Views (non-negotiable):**
- [ ] Created with `WITH METRICS LANGUAGE YAML` syntax (not regular VIEW)
- [ ] `table_type = ''METRIC_VIEW''` in `information_schema.tables`
- [ ] 3-5 synonyms per dimension/measure
- [ ] Format specifications (currency, percentage) where applicable
- [ ] Source table references validated against Gold YAML
- [ ] 1-2 metric views created (workshop mode)

**Genie Space (non-negotiable):**
- [ ] All Gold tables have column COMMENTs (prerequisite verified)
- [ ] Uses Serverless SQL Warehouse (never Classic or Pro)
- [ ] General Instructions ≤ 20 lines
- [ ] ≥ 10 benchmark questions with exact expected SQL
- [ ] Data assets: Metric Views → TVFs → Gold Tables (priority order)
- [ ] Total data assets ≤ 25 per space (< 15 for workshop)
- [ ] Natural language queries producing correct SQL

**Optimization (target):**
- [ ] Accuracy ≥ 95% (benchmark questions answered correctly)
- [ ] Repeatability ≥ 90% (same question → same SQL each time)
- [ ] 6-lever optimization applied if targets not met

**Deployment:**
- [ ] `tvf_job.yml` — SQL task for TVF deployment
- [ ] `metric_views_job.yml` — Python task for Metric View deployment
- [ ] JSON export created for Genie Space CI/CD (optional)
- [ ] `databricks bundle deploy -t dev` succeeds',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Build Agent
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(13, 'agent_framework',
'Build a multi-agent orchestrator for this project by analyzing the PRD document from @docs/design_prd.md and the UI design documents from @docs/ folder.

Refer to the instruction from @vibe-coding-workshop-template/agentic-framework/agents/multi-agent-build-prompt.md to build the agentic framework.
',
'You are a senior full-stack engineer implementing advanced agentic search capabilities.',
'Build Agent',
'Build advanced agentic search with Genie integration, LLM rewrite, and web search fallback',
16,
'
## Steps to Apply

1. **Copy the generated prompt** using the copy button
2. **Paste into Cursor or VS Code** with Copilot
3. Let the AI **analyze the PRD and UI design structure**
4. **Implement** agent orchestrator and tool calling
5. **Test** with mock data
',
'## Expected Agent Deliverables

### Backend Modules

| Module | Purpose |
|--------|---------|
| `genie_client` | Genie Space integration |
| `llm_client` | LLM rewrite functionality |
| `web_search_client` | Web search fallback |

### API Endpoints

- `POST /api/search/standard`
- `POST /api/search/nl`
- `POST /api/search/assistant`

### Configuration

- `.env.example` with all required variables
- Mock mode for local development

### Tests

- Unit tests for LLM parsing
- Unit tests for Genie no-answer detection
- Integration tests in mock mode',
true, 1, TRUE, current_timestamp(), current_timestamp(), current_user());

-- Step 19: Wire UI to Agent - bypass_LLM = TRUE
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(113, 'wire_ui_agent',
'## Task: Wire Frontend UI to Agent Serving Endpoint

Connect your web application''s frontend to the Agent serving endpoint built in the previous step (Build Agent). This enables end-to-end natural language search in your application.

Refer to the instruction from @vibe-coding-workshop-template/agentic-framework/agents/agent-ui-wiring-prompt.md to wire the multi-agent system with the UI.',
'',
'Wire UI to Agent',
'Connect frontend UI to the Agent serving endpoint for end-to-end natural language search',
17,
'## What is Wire UI to Agent?

This step connects your frontend application to the AI Agent built in the previous step. 

---

## Steps to Apply

1. Copy the generated prompt using the copy button
2. Paste it into Cursor or VS Code with Copilot
4. Test the Agent''s response.

**Note:** This step requires the Build Agent step to be completed first. The Agent serving endpoint must be deployed and accessible.',
'## Expected Deliverables

- Agent endpoint configured in `apps_lakebase/app.yaml`
- `agent_client.py` module with query function and mock mode
- Backend API route `POST /api/agent/query` responding correctly
- Frontend NL search wired to agent endpoint
- Results rendering inline without page navigation
- Local testing passed in both mock and live modes

**Next Step:** Iterate and enhance your application in Step 20',
true, 1, TRUE, current_timestamp(), current_timestamp(), current_user());

-- Iterate & Enhance App
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, version, is_active, inserted_at, updated_at, created_by)
VALUES
(14, 'iterate_enhance',
'Iterate and enhance the application based on user feedback and business needs.

---

## Potential Enhancements

Review the current application and identify areas for improvement:

### UI/UX Improvements
- Dark mode support
- Better visualizations and charts
- Improved navigation and user flows
- Mobile responsiveness
- Accessibility improvements

### Data Features
- Additional filters and search capabilities
- Data export functionality (CSV, Excel, PDF)
- Saved views and bookmarks
- Custom dashboards per user

### Agent Enhancements
- Additional tools and capabilities
- Conversation history and context
- Multi-turn conversations
- Integration with more data sources

### Performance Optimizations
- Query caching strategies
- Pagination for large datasets
- Lazy loading for UI components
- Database query optimization

### Integration Enhancements
- Additional data source connections
- External API integrations
- Webhook notifications
- SSO/authentication improvements

---

## Iteration Process

### Step 1: Gather User Feedback
- Conduct user interviews
- Review usage analytics
- Collect feature requests
- Identify pain points

### Step 2: Prioritize Enhancements
Use MoSCoW method:
- **Must Have**: Critical for user success
- **Should Have**: Important but not critical
- **Could Have**: Nice to have
- **Won''t Have**: Out of scope for now

### Step 3: Plan Implementation
- Break down into sprints
- Estimate effort for each enhancement
- Identify dependencies
- Create implementation tickets

### Step 4: Implement Changes
- Work on one enhancement at a time
- Write tests for new features
- Document changes
- Review code before merging

### Step 5: Test and Validate
- Unit tests for new functionality
- Integration tests for workflows
- User acceptance testing
- Performance testing

### Step 6: Deploy and Monitor
- Deploy to staging first
- Validate in staging environment
- Deploy to production
- Monitor for issues

---

## Industry Context
Industry: {industry}
Use Case: {use_case}

Review the current implementation and identify enhancements specific to the {industry} {use_case} use case.',
'You are a product manager and developer specializing in iterative application development.
Generate a detailed, actionable prompt for enhancing the application based on user feedback.
Focus on:
- Identifying high-impact improvements
- Prioritizing based on user value
- Breaking down into manageable tasks
- Ensuring quality through testing',
'Iterate & Enhance App',
'Iterate on the application to add new features, update functionality, and improve user experience',
18,
'## Prerequisite

**Run this in your cloned Template Repository** (see Prerequisites in Step 0). These prompts assume you are working in that codebase with a coding assistant (Cursor or Copilot) enabled.

---

## Steps to Iterate and Enhance

### Step 1: Review Current State
```
@codebase What are the main features of this application? 
What areas could be improved?
```

### Step 2: Gather Feedback
- Review user feedback
- Analyze usage patterns
- Identify pain points

### Step 3: Prioritize Enhancements
- Use MoSCoW method
- Consider effort vs impact
- Plan sprint backlog

### Step 4: Implement Changes
- One enhancement at a time
- Write tests
- Document changes

### Step 5: Test and Deploy
- Run all tests
- Deploy to staging
- Validate and deploy to production',
'## Expected Enhancement Outcomes

### UI/UX Improvements
- [ ] Dark mode implemented
- [ ] Better visualizations
- [ ] Improved navigation

### Data Features
- [ ] Export functionality
- [ ] Advanced filters
- [ ] Saved views

### Performance
- [ ] Faster load times
- [ ] Optimized queries
- [ ] Better caching

### Documentation
- [ ] Updated user guide
- [ ] API documentation
- [ ] Release notes',
1, TRUE, current_timestamp(), current_timestamp(), current_user());

-- Step 21: Redeploy & Test Application (Autonomous Operations + Repository Documentation) - bypass_LLM = TRUE
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(15, 'redeploy_test',
'Build, deploy, and test the complete application using @data_product_accelerator/skills/common/databricks-autonomous-operations/SKILL.md for self-healing deployment and @data_product_accelerator/skills/common/databricks-asset-bundles/SKILL.md for DAB validation.

After deployment succeeds, document the entire repository using @data_product_accelerator/skills/admin/documentation-organization/SKILL.md in Framework Documentation Authoring mode.

---

## IMPORTANT: Analyze Current Project First

**This step uses your existing project deployment infrastructure.** Before deploying:

1. **Review the current project structure** to identify:
   - Deploy scripts (e.g., `deploy.sh`, `scripts/deploy.py`)
   - Build configurations (`package.json`, `requirements.txt`)
   - DAB configuration (`databricks.yml`)
   - Environment configurations

Use the AI assistant to analyze the project:
```
@codebase What deploy scripts and configurations exist in this project? 
How do I build and deploy this application to Databricks?
```

---

## Deployment Process (Self-Healing Loop)

Follow the autonomous operations skill''s core loop: **Deploy -> Poll -> Diagnose -> Fix -> Redeploy -> Verify** (max 3 iterations before escalation).

### Step 1: Identify Deployment Scripts
Look for existing scripts in your project:
```bash
# Common locations to check:
ls -la deploy.sh
ls -la scripts/
ls -la databricks.yml
cat package.json | grep scripts
```

### Step 2: Build the Application
Based on your project type:

**For React/Node.js frontend:**
```bash
npm install
npm run build
```

**For Python backend:**
```bash
pip install -r requirements.txt
```

### Step 3: Validate the Bundle (Pre-Deploy)
```bash
# Pre-flight validation catches ~80% of errors
databricks bundle validate -t dev
```
If validation fails, read the error, fix the YAML, and re-validate before proceeding.

### Step 4: Deploy Using Project Scripts
Use the deploy scripts found in your project:
```bash
# If deploy.sh exists:
./deploy.sh

# Or if using DAB:
databricks bundle deploy -t dev
```

### Step 5: Deploy DAB Artifacts
If you have Databricks Asset Bundles configured:
```bash
# Authenticate if needed
databricks auth login --host https://e2-demo-field-eng.cloud.databricks.com --profile DEFAULT

# Validate and deploy
databricks bundle validate
databricks bundle deploy -t dev

# Run jobs/pipelines (extract RUN_ID from output URL)
databricks bundle run <job_name> -t dev
```

### Step 6: Poll with Exponential Backoff
After triggering a job run, poll for completion:
```bash
# Poll job status (30s -> 60s -> 120s backoff)
databricks jobs get-run <RUN_ID> --output json | jq -r ''.state.life_cycle_state''
# PENDING -> RUNNING -> TERMINATED

# When TERMINATED, check result:
databricks jobs get-run <RUN_ID> --output json | jq -r ''.state.result_state''
# SUCCESS -> verify    FAILED -> diagnose
```

### Step 7: On Failure — Diagnose
```bash
# CRITICAL: Use TASK run_id, NOT parent job run_id
databricks jobs get-run <JOB_RUN_ID> --output json \
  | jq ''.tasks[] | select(.state.result_state == "FAILED") | {task: .task_key, run_id: .run_id, error: .state.state_message}''

# Get detailed output for each failed task
databricks jobs get-run-output <TASK_RUN_ID> --output json \
  | jq -r ''.notebook_output.result // .error // "No output"''
```

### Step 8: Self-Healing Loop (Fix -> Redeploy -> Re-Poll)
1. Read the source file(s) identified from the error
2. Apply the fix
3. Redeploy: `databricks bundle deploy -t dev`
4. Re-run: `databricks bundle run -t dev <job_name>`
5. Return to Step 6 (Poll)

**Maximum 3 iterations.** After 3 failed attempts, escalate to user with all errors, fixes attempted, and run page URLs.

### Step 9: Verify Deployment
Check deployment status:
```bash
# Check app status
databricks apps get <app-name>

# View logs
databricks apps get <app-name> --output json | jq .app_status

# For multi-task jobs, verify all tasks succeeded:
databricks jobs get-run <RUN_ID> --output json \
  | jq ''.tasks[] | {task: .task_key, result: .state.result_state}''
```

---

## Testing Checklist

After deployment, verify:

### Application Health
- [ ] App URL is accessible
- [ ] `/api/health` returns 200 OK
- [ ] No errors in application logs

### Frontend Functionality
- [ ] UI loads without JavaScript errors
- [ ] Navigation works correctly
- [ ] Forms submit successfully
- [ ] Data displays in tables and charts

### Backend Functionality
- [ ] API endpoints respond correctly
- [ ] Database connections work
- [ ] Authentication/authorization works

### Data Pipelines (if DAB deployed)
- [ ] Bronze jobs completed successfully
- [ ] Silver pipeline processed data
- [ ] Gold tables populated correctly
- [ ] Data visible in dashboards/Genie

---

## Debugging Failed Deployments

If deployment fails:
1. Check build logs for errors
2. Verify environment variables are set
3. Check Databricks workspace permissions
4. Review app.yaml configuration
5. Check network connectivity

```bash
# View deployment logs
databricks apps get <app-name>

# Check bundle deployment status
databricks bundle validate
databricks bundle deploy -t dev --verbose
```

---

## Post-Deployment: Document the Entire Repository

**After deployment succeeds**, run this prompt in a new AI assistant thread:

```
Document this entire repository using @data_product_accelerator/skills/admin/documentation-organization/SKILL.md

Use Framework Documentation Authoring mode to create a complete docs/ set:
- Architecture overview with diagrams
- Component deep dives for each major module
- Deployment guide
- Operations guide (health checks, monitoring, alerting)
- Troubleshooting guide (common errors and solutions)

Also run organizational enforcement:
- Audit root directory for stray .md files
- Move any misplaced docs to correct docs/ subdirectory
- Validate all naming uses kebab-case
```

This generates comprehensive project documentation under `docs/{project-name}-design/`.',
'',
'Redeploy & Test Application',
'Use project deploy scripts and DAB to build, deploy, and test the complete application with self-healing operations and full repository documentation',
19,
'## 🔄 What is Redeploy and Test?

**Redeploy & Test** is not "deploy and pray" — it is a **systematic, self-healing operational loop** powered by the autonomous operations skill. Every deployment follows a disciplined cycle: validate, deploy, poll, diagnose, fix, and verify. After deployment succeeds, the **entire repository** is documented comprehensively.

### Two Skills Working Together

| Skill | Role | When It Activates |
|-------|------|-------------------|
| **Autonomous Operations** | Self-healing deploy loop with diagnostics | During deployment and troubleshooting |
| **Documentation Organization** | Full repository documentation authoring | After deployment succeeds (explicit prompt) |

### Core Principles

| Principle | Benefit |
|-----------|---------|
| **Self-Healing Loop** | Deploy -> Poll -> Diagnose -> Fix -> Redeploy (max 3 iterations) |
| **Pre-Deploy Validation** | `databricks bundle validate` catches ~80% of errors before deploy |
| **Exponential Backoff** | 30s -> 60s -> 120s polling prevents API rate limits |
| **Task-Level Diagnostics** | Get output from failed tasks, not just the parent job |
| **Documentation as Final Step** | Every project gets architecture, operations, and troubleshooting docs |

---

## 🏗️ Self-Healing Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AUTONOMOUS DEPLOY-TEST-DOCUMENT LOOP                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌──────────────┐     │
│  │ VALIDATE │───▶│  DEPLOY  │───▶│  POLL        │───▶│  RESULT?     │     │
│  │  Bundle  │    │  Bundle  │    │  (Backoff)   │    │              │     │
│  └──────────┘    └──────────┘    │  30s→60s→120s│    └──────┬───────┘     │
│       ▲                          └──────────────┘           │              │
│       │                                                     │              │
│       │            ┌────────────────────────────────────────┤              │
│       │            │                                        │              │
│       │            ▼                                        ▼              │
│       │     ┌──────────────┐                    ┌──────────────────┐      │
│       │     │    FAILED    │                    │    SUCCESS       │      │
│       │     │              │                    │                  │      │
│       │     │ ┌──────────┐ │                    │ ┌──────────────┐ │      │
│       │     │ │ Diagnose │ │                    │ │ Verify All   │ │      │
│       │     │ │ (task-   │ │                    │ │ Tasks + App  │ │      │
│       │     │ │  level)  │ │                    │ │ Health       │ │      │
│       │     │ └────┬─────┘ │                    │ └──────┬───────┘ │      │
│       │     │      │       │                    │        │         │      │
│       │     │      ▼       │                    │        ▼         │      │
│       │     │ ┌──────────┐ │                    │ ┌──────────────┐ │      │
│       │     │ │   Fix    │ │                    │ │ Document     │ │      │
│       │     │ │  Source  │ │                    │ │ Entire Repo  │ │      │
│       │     │ └────┬─────┘ │                    │ │ (Framework   │ │      │
│       │     │      │       │                    │ │  Authoring)  │ │      │
│       │     └──────┼───────┘                    │ └──────────────┘ │      │
│       │            │                            └──────────────────┘      │
│       │            │                                                      │
│       └────────────┘                                                      │
│       Redeploy (max 3 iterations)                                         │
│                                                                           │
│  After 3 failures ──▶ ESCALATE to user with all errors + run URLs        │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📖 Key Concepts

| Concept | Why It Matters |
|---------|----------------|
| **Self-Healing Loop** | Deploy -> Poll -> Diagnose -> Fix -> Redeploy (max 3 iterations before escalation) |
| **Exponential Backoff** | 30s -> 60s -> 120s polling intervals prevent API rate limits and reduce noise |
| **Task-Level Diagnostics** | `get-run-output` needs the **TASK** `run_id`, not the parent job `run_id` — critical for multi-task jobs |
| **Dependency Ordering** | Bronze -> Silver -> Gold -> Semantic -> Monitoring -> Alerts -> Genie |
| **Structured Notebook Exit** | `dbutils.notebook.exit(json.dumps({...}))` enables machine-parseable output retrieval |
| **Partial Success** | >=90% tasks succeeding = OK; fix individual failures without rerunning everything |
| **Full Repo Documentation** | Post-deployment step generates complete `docs/{project}-design/` with architecture, operations, troubleshooting |
| **Framework Doc Authoring** | 4-step workflow: Requirements Gathering -> File Structure -> Fill Templates -> Quality Validation |
| **Root Directory Hygiene** | Only README.md, QUICKSTART.md, CHANGELOG.md allowed in root; all other docs in `docs/` |
| **43-Item Quality Checklist** | Validates organization, naming, structure, content, usability, and maintenance of all documentation |

---

## Prerequisite

**Run this in your cloned Template Repository** (see Prerequisites in Step 0). These prompts assume you are working in that codebase with a coding assistant (Cursor or Copilot) enabled.

**Before this step, you should have completed:**
- Bronze, Silver, and Gold layer setup (tables populated)
- Semantic layer (Metric Views, TVFs, Genie Space)
- Any application code (frontend/backend)
- DAB configuration (`databricks.yml`)

---

## Steps to Apply

### Step 1: Analyze Project
```
@codebase What deploy scripts and configurations exist? How do I build and deploy?
```

### Step 2: Build Application
```bash
npm install && npm run build  # or equivalent for your project
pip install -r requirements.txt  # if Python backend
```

### Step 3: Validate Bundle (Pre-Deploy)
```bash
databricks bundle validate -t dev
# Catches ~80% of errors — fix any issues before proceeding
```

### Step 4: Deploy Using Project Scripts
```bash
./deploy.sh  # or your project''''s deploy script
# Or: databricks bundle deploy -t dev
```

### Step 5: Deploy DAB Artifacts
```bash
databricks bundle deploy -t dev
databricks bundle run <job_name> -t dev
# Extract RUN_ID from the output URL
```

### Step 6: Poll with Exponential Backoff
```bash
# Poll: 30s -> 60s -> 120s intervals
databricks jobs get-run <RUN_ID> --output json | jq -r ''.state.life_cycle_state''
# When TERMINATED: check .state.result_state
```

### Step 7: On Failure — Diagnose and Fix
```bash
# Get failed tasks (use TASK run_id, not parent)
databricks jobs get-run <RUN_ID> --output json \
  | jq ''.tasks[] | select(.state.result_state == "FAILED") | {task: .task_key, run_id: .run_id}''

# Get task output
databricks jobs get-run-output <TASK_RUN_ID> --output json \
  | jq -r ''.notebook_output.result // .error // "No output"''

# Fix -> Redeploy -> Re-poll (max 3 iterations)
```

### Step 8: Verify All Tasks and Application Health
```bash
# Verify all tasks succeeded
databricks jobs get-run <RUN_ID> --output json \
  | jq ''.tasks[] | {task: .task_key, result: .state.result_state}''

# Check app health
curl -s https://<app-url>/api/health
databricks apps get <app-name> --output json | jq .app_status
```

### Step 9: Run Testing Checklist
- Application health (URL accessible, health endpoint OK)
- Frontend functionality (UI loads, navigation, forms, data display)
- Backend functionality (API endpoints, database, auth)
- Data pipelines (Bronze, Silver, Gold, dashboards, Genie)

### Step 10: Document the Entire Repository
After deployment succeeds, paste this prompt in a **new AI assistant thread**:

```
Document this entire repository using @data_product_accelerator/skills/admin/documentation-organization/SKILL.md

Use Framework Documentation Authoring mode to create a complete docs/ set:
- Architecture overview with diagrams
- Component deep dives for each major module
- Deployment guide
- Operations guide (health checks, monitoring, alerting)
- Troubleshooting guide (common errors and solutions)

Also run organizational enforcement:
- Audit root directory for stray .md files
- Move any misplaced docs to correct docs/ subdirectory
- Validate all naming uses kebab-case
```

This triggers the documentation-organization skill''''s **Mode 2: Framework Documentation Authoring** which:
1. Gathers requirements (framework name, audience, tech stack, components)
2. Generates numbered docs under `docs/{project-name}-design/`
3. Fills templates (index, introduction, architecture, components, implementation, operations, troubleshooting)
4. Validates against the 43-item quality checklist

---

## 🔧 What Happens Behind the Scenes

When you paste the deployment prompt, the AI reads `@data_product_accelerator/skills/common/databricks-autonomous-operations/SKILL.md` — the **autonomous operations skill**. Behind the scenes:

### Autonomous Operations Skill

1. **Bundle Discovery** — reads `databricks.yml` to identify all resources (jobs, pipelines, dashboards, alerts)
2. **Pre-Deploy Validation** — runs `databricks bundle validate` which catches ~80% of errors before deployment
3. **Deploy and Extract** — deploys bundle and extracts RUN_ID from the output URL
4. **Exponential Backoff Polling** — polls job status at 30s -> 60s -> 120s intervals until terminal state
5. **On Failure: Task-Level Diagnosis** — extracts task-level run_ids (NOT parent job run_id), gets detailed output via `get-run-output`, matches errors against the error-solution matrix
6. **Self-Healing Loop** — applies fix, redeploys, re-polls (max 3 iterations before escalation)
7. **On Success: Full Verification** — verifies all tasks succeeded, retrieves structured JSON output from notebooks
8. **Common skills auto-loaded**:
   - `databricks-asset-bundles` — DAB validation and deployment patterns
   - `databricks-expert-agent` — core Databricks best practices
   - `naming-tagging-standards` — enterprise naming conventions

### Documentation Organization Skill (Explicit Post-Deployment Trigger)

After deployment succeeds, the user runs a **separate prompt** that triggers the documentation-organization skill''''s **Framework Documentation Authoring mode (Mode 2)** to document the entire repository:

1. **Requirements Gathering** — skill determines framework name, audience, tech stack, component count, and documentation depth
2. **File Structure Generation** — creates numbered docs under `docs/{project-name}-design/`:
   - `00-index.md` — document index with architecture summary and quick start
   - `01-introduction.md` — purpose, scope, prerequisites, success criteria
   - `02-architecture-overview.md` — Mermaid/ASCII diagrams, data flows, component inventory
   - `03-{component-1}.md` through `NN-{component-N}.md` — component deep dives
   - `{N+1}-implementation-guide.md` — phased steps with validation
   - `{N+2}-operations-guide.md` — health checks, alerting, escalation matrix
   - `appendices/A-code-examples.md`, `B-troubleshooting.md`, `C-references.md`
3. **Quality Validation** — runs 43-item checklist (organization, naming, structure, content, usability, maintenance, special cases)
4. **Organizational Enforcement** — audits root for stray `.md` files, enforces `kebab-case` naming, routes misplaced docs to correct `docs/` subdirectory

### 🏅 Databricks Best Practices Applied

| Practice | How It''''s Used Here |
|----------|-------------------|
| **Self-Healing Deploy Loop** | Max 3 iterations of deploy-diagnose-fix before escalation to user |
| **Exponential Backoff Polling** | 30s -> 60s -> 120s intervals prevent API rate limiting and reduce noise |
| **Task-Level Diagnostics** | Uses **task** `run_id` (not parent job `run_id`) for `get-run-output` — critical for multi-task jobs |
| **Structured Notebook Exit** | JSON output from `dbutils.notebook.exit()` enables machine-parseable result retrieval |
| **Pre-Deploy Validation** | `databricks bundle validate` catches ~80% of errors before any deployment attempt |
| **Dependency-Aware Ordering** | Follows Bronze -> Gold -> Semantic -> Monitoring -> Genie deployment order |
| **Partial Success Handling** | >=90% task success = OK; debug individual failures without rerunning everything |
| **CLI jq Patterns** | Structured JSON parsing for job state, failed tasks, and task output |
| **App Health Verification** | `/api/health` endpoint check + app logs review after deployment |
| **Never Retry Destructive Ops** | No auto-retry of `bundle destroy`, `DROP TABLE`, `DELETE` monitors/alerts |
| **Full Repository Documentation** | Post-deployment prompt triggers Framework Documentation Authoring for entire repo |
| **Numbered Documentation Set** | `docs/{project-name}-design/` with `00-index.md` through `NN-operations-guide.md` |
| **Root Directory Hygiene** | Only README/QUICKSTART/CHANGELOG in root; all other docs in `docs/` hierarchy |
| **Quality Checklist Validation** | 43-item checklist covering organization, naming, structure, content, usability |

---

## ⚠️ Error Troubleshooting Quick Reference

If deployment or jobs fail, check this table first:

| Error | Quick Fix |
|-------|-----------|
| `ModuleNotFoundError` | Add to `%pip install` or DAB environment spec |
| `TABLE_OR_VIEW_NOT_FOUND` | Run setup job first; check 3-part catalog.schema.table path |
| `DELTA_MULTIPLE_SOURCE_ROW_MATCHING` | Deduplicate source before MERGE |
| `Invalid access token (403)` | `databricks auth login --host <url> --profile <name>` |
| `ResourceAlreadyExists` | Delete + recreate (monitors, alerts) |
| `python_task not recognized` | Use `notebook_task` with `notebook_path` |
| `PARSE_SYNTAX_ERROR` | Read failing SQL file, fix syntax, redeploy |
| `Parameter not found` | Use `base_parameters` dict, not CLI-style `parameters` |
| `run_job_task` vs `job_task` | Use `run_job_task` (not `job_task`) |
| Genie `INTERNAL_ERROR` | Deploy semantic layer (TVFs + Metric Views) first |

---

## 📂 Post-Deployment: Document the Entire Repository

After deployment succeeds, run the documentation-organization skill to create comprehensive project documentation.

### The Documentation Prompt

Paste this in a **new AI assistant thread** after deployment:

```
Document this entire repository using @data_product_accelerator/skills/admin/documentation-organization/SKILL.md

Use Framework Documentation Authoring mode to create a complete docs/ set:
- Architecture overview with diagrams
- Component deep dives for each major module
- Deployment guide
- Operations guide (health checks, monitoring, alerting)
- Troubleshooting guide (common errors and solutions)

Also run organizational enforcement:
- Audit root directory for stray .md files
- Move any misplaced docs to correct docs/ subdirectory
- Validate all naming uses kebab-case
```

### Expected Documentation Structure

```
docs/{project-name}-design/
├── 00-index.md                        # Document index, architecture summary
├── 01-introduction.md                 # Purpose, scope, prerequisites
├── 02-architecture-overview.md        # Diagrams, data flows, components
├── 03-{component-1}.md               # Component deep dive
├── 04-{component-2}.md               # Component deep dive
├── ...                                # Additional components
├── {N}-implementation-guide.md        # Phased steps with validation
├── {N+1}-operations-guide.md          # Health checks, alerting, escalation
└── appendices/
    ├── A-code-examples.md             # Code snippets and patterns
    ├── B-troubleshooting.md           # Error-solution matrix
    └── C-references.md                # External references and links
```

### Documentation Naming Rules

| Format | Use For | Example |
|--------|---------|---------|
| `kebab-case.md` | All docs | `deployment-guide.md` |
| `NN-descriptive-name.md` | Framework docs (numbered) | `03-data-pipelines.md` |
| `YYYY-MM-DD-description.md` | Historical/dated records | `2026-02-07-initial-deployment.md` |
| NEVER `PascalCase.md` | -- | `DeploymentGuide.md` |
| NEVER `ALL_CAPS.md` | -- | `DEPLOYMENT_GUIDE.md` |

### 4-Step Documentation Workflow

| Step | What Happens | Output |
|------|-------------|--------|
| 1. Requirements Gathering | Skill asks about framework, audience, components, depth | Requirements table |
| 2. File Structure | Creates numbered file tree under `docs/` | Directory structure |
| 3. Fill Templates | Generates each doc from fill-in-the-blank templates | Complete documentation |
| 4. Quality Validation | Runs 43-item checklist across 7 categories | Validation report |',
'## Expected Deliverables

### 🔄 Deployment Process (Self-Healing Loop)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SELF-HEALING DEPLOYMENT LOOP                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Iteration 1: Deploy → Run → Poll → [FAIL] → Diagnose → Fix → Redeploy   │
│  Iteration 2: Run → Poll → [FAIL] → Diagnose → Fix → Redeploy             │
│  Iteration 3: Run → Poll → [FAIL] → ESCALATE TO USER                      │
│                                                                             │
│  OR: Deploy → Run → Poll → [SUCCESS] → Verify → Document Repo             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Self-Healing Loop Tracking

| Iteration | Error | Fix Applied | Outcome |
|-----------|-------|-------------|---------|
| 1 | (recorded from diagnosis) | (what was changed) | FAIL / SUCCESS |
| 2 | (recorded from diagnosis) | (what was changed) | FAIL / SUCCESS |
| 3 | (recorded from diagnosis) | (what was changed) | FAIL / ESCALATE |

---

### 📊 Deployment Verification Commands

```bash
# 1. Check overall job status
databricks jobs get-run <RUN_ID> --output json | jq ''.state''

# 2. Get summary of all tasks
databricks jobs get-run <RUN_ID> --output json \
  | jq ''.tasks[] | {task: .task_key, run_id: .run_id, result: .state.result_state}''

# 3. Get failed tasks only
databricks jobs get-run <RUN_ID> --output json \
  | jq ''.tasks[] | select(.state.result_state == "FAILED") | {task: .task_key, error: .state.state_message, url: .run_page_url}''

# 4. Get task output (MUST use TASK run_id, not parent job run_id)
databricks jobs get-run-output <TASK_RUN_ID> --output json \
  | jq -r ''.notebook_output.result // "No output"''

# 5. Check app status
databricks apps get <app-name>
databricks apps get <app-name> --output json | jq .app_status

# 6. Check bundle status
databricks bundle validate
databricks bundle summary
```

---

### ✅ Application Health Checks

**Application:**
- [ ] App deployed and accessible at URL
- [ ] Health endpoint (`/api/health`) returns 200 OK
- [ ] UI loads without JavaScript errors
- [ ] Navigation works correctly
- [ ] Forms submit successfully
- [ ] Data displays in tables and charts
- [ ] Authentication/authorization working
- [ ] API endpoints respond correctly
- [ ] Database connections working
- [ ] No errors in application logs

**DAB Artifacts (if deployed):**
- [ ] All jobs visible in Workflows UI
- [ ] All job tasks completed with `SUCCESS` result state
- [ ] Pipelines running successfully
- [ ] Tables created in Unity Catalog
- [ ] Data flowing correctly through Bronze -> Silver -> Gold
- [ ] Data visible in dashboards/Genie

---

### 📂 Repository Documentation Set Created

After running the documentation-organization prompt, the following structure is generated:

```
docs/{project-name}-design/
├── 00-index.md                        # Document index
├── 01-introduction.md                 # Purpose, scope, prerequisites
├── 02-architecture-overview.md        # Diagrams, data flows
├── 03-{component-1}.md               # Component deep dive
├── ...                                # Additional components
├── {N}-implementation-guide.md        # Build instructions
├── {N+1}-operations-guide.md          # Health checks, alerting
└── appendices/
    ├── A-code-examples.md             # Code patterns
    ├── B-troubleshooting.md           # Error-solution matrix
    └── C-references.md                # External references
```

**Organizational Enforcement Results:**
- [ ] Root directory audited (only README, QUICKSTART, CHANGELOG remain)
- [ ] All doc filenames use `kebab-case`
- [ ] Numbered sequence for framework docs (00-, 01-, 02-, ...)
- [ ] No misplaced `.md` files in root or wrong subdirectories

---

### ✅ Success Criteria Checklist

**Bundle Deployment:**
- [ ] `databricks bundle validate` passes with no errors
- [ ] `databricks bundle deploy` completes successfully
- [ ] All resources deployed to target workspace

**Job Execution and Monitoring:**
- [ ] Jobs triggered and RUN_ID captured
- [ ] Polling with exponential backoff (30s -> 60s -> 120s)
- [ ] All tasks reached terminal state (SUCCESS)
- [ ] Task output retrieved via `get-run-output` using task run_id

**Application Health:**
- [ ] App URL is accessible
- [ ] `/api/health` returns 200 OK
- [ ] UI loads without errors
- [ ] API endpoints respond correctly
- [ ] No errors in application logs

**Self-Healing Loop:**
- [ ] If failures occurred: diagnosed using task-level CLI commands
- [ ] If failures occurred: fix applied and redeployed (max 3 iterations)
- [ ] If escalated: all errors, fixes, and run URLs provided to user

**Data Pipeline Verification:**
- [ ] Bronze tables populated with data
- [ ] Silver pipeline processed without errors
- [ ] Gold tables reflect correct aggregations
- [ ] Dashboards and Genie Spaces functional

**Repository Documentation:**
- [ ] `docs/{project-name}-design/` directory exists with numbered docs
- [ ] Architecture overview includes diagrams (Mermaid or ASCII)
- [ ] Component deep dives cover each major module
- [ ] Operations guide includes health checks and alerting procedures
- [ ] Troubleshooting guide includes common errors and solutions
- [ ] No stray `.md` files in root (only README, QUICKSTART, CHANGELOG)
- [ ] All doc filenames use `kebab-case`
- [ ] 43-item quality checklist passed',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Setup Lakebase
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(16, 'setup_lakebase',
'## Create Lakebase Tables from UI Design

**Workspace:** `{workspace_url}`
**Your Lakebase Project:** `{user_app_name}` (created in Step 0 below)

**Working directory:** All app and Lakebase assets go under `apps_lakebase/`. Read the UI design from the parent `docs/` folder.

Read `@docs/ui_design.md` (parent folder at repo root) and create the database tables needed to power the UI under `apps_lakebase/`.

---

**Step 0: Create Your Own Lakebase Project**

> Each workshop participant creates their own Lakebase project. This gives you full database access with no permission issues.

**0a. Create the project:**
```bash
databricks postgres create-project {user_app_name} --json ''''{"spec": {"display_name": "{user_app_name}"}}''''
```

**0b. Get your endpoint hostname:**
```bash
databricks postgres get-endpoint projects/{user_app_name}/branches/production/endpoints/primary --output json
```
From the JSON output, copy the value of `status.hosts.host` — this is your `LAKEBASE_HOST`.

**0c. Optimize compute and enable scale-to-zero (saves cost):**
```bash
databricks postgres update-endpoint projects/{user_app_name}/branches/production/endpoints/primary "spec" --json ''''{"spec": {"endpoint_type": "ENDPOINT_TYPE_READ_WRITE", "autoscaling_limit_min_cu": 0.5, "autoscaling_limit_max_cu": 2.0, "suspend_timeout_duration": "300s"}}''''
```

Your project is now ready. Use these values in the steps below:
- **Project name:** `{user_app_name}`
- **ENDPOINT_NAME:** `projects/{user_app_name}/branches/production/endpoints/primary`
- **LAKEBASE_HOST:** (the hostname from Step 0b)

---

**Step 1: Authenticate to Databricks**

```bash
databricks auth login --host {workspace_url}
```

**Step 2: Create the DDL file**

Create file `apps_lakebase/db/lakebase/ddl/05_app_tables.sql` with CREATE TABLE statements for ALL entities needed by the UI:
- Use PostgreSQL syntax
- Use `{user_schema_prefix}` as your schema name (e.g. varunrao_b_booking_app)
- Include primary keys, foreign keys, indexes
- Include created_at/updated_at timestamps

**DDL Guidelines for Lakebase:**
- Use `TEXT` instead of `TEXT[]` (ARRAY types) - the SQL parser may not handle ARRAY syntax correctly
- Avoid complex PostgreSQL-specific types that may not be supported

**Step 3: Create the DML seed file**

Create file `apps_lakebase/db/lakebase/dml_seed/04_seed_app_data.sql` with INSERT statements:
- 10-15 realistic records per table for {industry_name} industry
- Use `{user_schema_prefix}` as your schema name (must match DDL files)
- Insert parent tables before child tables (e.g., hosts before listings, listings before reviews)

**DML Guidelines for Lakebase:**
- Use double single quotes ('''') to escape apostrophes in SQL strings (e.g., ''''chef''''''''s kitchen'''')
- Avoid semicolons (;) inside string values - use pipe (|) or comma as delimiters instead (e.g., ''''Rule 1 | Rule 2'''' not ''''Rule 1; Rule 2'''')
- Ensure FK references match parent table row counts (if you have 10 hosts, listings.host_id must be 1-10, not 1-12)

**Step 4: Get your schema name and instance info**

```bash
# Your schema name (derived from your use case)
SCHEMA_NAME="{user_schema_prefix}"
echo "Your schema: $SCHEMA_NAME"

# Check Lakebase connectivity and instance status (run from apps_lakebase/ or use path)
cd apps_lakebase && python3 scripts/lakebase_manager.py --action check --instance-name {user_app_name}
```

**Step 5: Deploy to Lakebase**

> **Lakebase Mode:** `{lakebase_mode}`. If autoscaling, authentication uses OAuth credential generation (no LAKEBASE_USER_OVERRIDE needed). If provisioned, set LAKEBASE_USER_OVERRIDE to your email.

```bash
# Set environment overrides (replace <values> with your actual values from Step 4)
export LAKEBASE_HOST_OVERRIDE="<instance-dns-from-step-4>"
export LAKEBASE_DATABASE_OVERRIDE="databricks_postgres"
export LAKEBASE_SCHEMA_OVERRIDE="{user_schema_prefix}"
export LAKEBASE_PORT_OVERRIDE="5432"
export LAKEBASE_MODE={lakebase_mode}
# Autoscaling only — skip this line for provisioned:
export ENDPOINT_NAME="projects/{user_app_name}/branches/production/endpoints/primary"
# If app is already deployed, export the SP ID so setup-lakebase.sh grants sequence permissions:
# export APP_SERVICE_PRINCIPAL_ID="<service-principal-id-from-app-info>"

# Deploy tables (run from apps_lakebase/)
cd apps_lakebase && ./scripts/setup-lakebase.sh --recreate --instance-name {user_app_name}
```

Type `YES-PRODUCTION` when prompted.

**Step 6: Verify deployment**

```bash
cd apps_lakebase && ./scripts/setup-lakebase.sh --status --instance-name {user_app_name}
```

All tables must show `✓ exists` with row counts before proceeding.

**Step 7: Update app.yaml**

Update the env section in `apps_lakebase/app.yaml`:

```yaml
env:
  - name: LAKEBASE_HOST
    value: "<your-instance-dns>"
  - name: LAKEBASE_DATABASE
    value: "databricks_postgres"
  - name: LAKEBASE_SCHEMA
    value: "{user_schema_prefix}"
  - name: LAKEBASE_PORT
    value: "5432"
  # Autoscaling only — include ENDPOINT_NAME; omit for provisioned:
  - name: ENDPOINT_NAME
    value: "projects/{user_app_name}/branches/production/endpoints/primary"
  - name: USE_LAKEBASE
    value: "true"
```

> **Note on LAKEBASE_USER:** For **autoscaling**, do NOT set it — the identity is injected automatically. For **provisioned**, it is set via the Lakebase app resource link.

---

**If deployment fails:** Fix the error in your DDL/DML files and re-run Step 5. Retry up to 3 times.
**If auth fails:** Re-run `databricks auth login --host {workspace_url}`',
'You are a database engineer setting up Lakebase (PostgreSQL) tables for a web application.

Key requirements:
1. Read the UI design to understand what data entities are needed
2. Create DDL with proper PostgreSQL syntax, keys, and indexes
3. Create realistic seed data that matches the industry context
4. Deploy tables and verify they exist with data
5. Configure apps_lakebase/app.yaml so the application can connect

This prompt is returned as-is for direct use in Cursor/Copilot. No LLM processing.

CLI Best Practices:
- Run from apps_lakebase/ or use apps_lakebase/scripts/ for scripts
- Run CLI commands outside the IDE sandbox to avoid SSL/TLS certificate errors',
'Setup Lakebase',
'Create and deploy Lakebase tables from UI Design',
5,
'## How to Use

1. **Copy the generated prompt**
2. **Paste into Cursor or Copilot**
3. The code assistant will execute all steps:
   - Authenticate to Databricks workspace
   - Create DDL and DML files
   - Run deployment commands
   - Verify tables exist
   - Update app.yaml',
'## Expected Output

- DDL file: `apps_lakebase/db/lakebase/ddl/05_app_tables.sql`
- DML file: `apps_lakebase/db/lakebase/dml_seed/04_seed_app_data.sql`
- Tables deployed to {user_app_name}
- apps_lakebase/app.yaml updated with Lakebase config',
TRUE,
1, TRUE, current_timestamp(), current_timestamp(), current_user());

-- Default Section
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, version, is_active, inserted_at, updated_at, created_by)
VALUES
(99, 'default',
'Generate content for {section_tag} in {industry_name} for {use_case_title}.

Industry: {industry_name}
Use Case: {use_case_title}
Section: {section_tag}

Please provide detailed requirements and specifications for this section.',
'You are an expert Databricks solutions architect.
Generate a detailed, actionable prompt for {section_tag} in a {industry_name} {use_case_title} application.',
'Default Section',
'Default template for unknown sections',
99,
'',
'',
1, TRUE, current_timestamp(), current_timestamp(), current_user());

-- Wire UI to Lakebase
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(108, 'wire_ui_lakebase',
'## Task: Wire Frontend UI to Lakebase Backend

Connect the web application to the Lakebase database so the UI displays real data. This step focuses on **local development and testing**.

**Working directory:** All app code and commands use the `apps_lakebase/` folder.

**Your Lakebase Project:** `{user_app_name}` (from the setup_lakebase step)

> Use the project name and LAKEBASE_HOST from the **setup_lakebase** step.

> **⚠️ IMPORTANT NOTE:** The Lakebase Instance/Project Name and Host Name above are configured in the Workshop Parameters. Ensure these match your Databricks workspace Lakebase setup before proceeding.

---

## Part A: Install Dependencies (CRITICAL - Prevent driver import errors)

**Both files must be updated in `apps_lakebase/`** - `apps_lakebase/pyproject.toml` is the source of truth and `apps_lakebase/requirements.txt` may be regenerated from it.

> **Lakebase Mode:** `{lakebase_mode}`. Both `psycopg` (v3) and `psycopg2-binary` are required regardless of mode. Autoscaling uses psycopg3 ConnectionPool with OAuth token rotation; provisioned uses psycopg2 with resource-linked credentials.

1. **Check if `apps_lakebase/pyproject.toml` exists** - if yes, add these to `[project.dependencies]`:
   ```toml
   [project]
   dependencies = [
       "psycopg[binary,pool]>=3.1.0",
       "psycopg2-binary>=2.9.0",
       "databricks-sdk>=0.81.0",
       # ... other deps
   ]
   ```

2. **Add to `apps_lakebase/requirements.txt`** - ensure these lines exist:
   ```
   psycopg[binary,pool]>=3.1.0
   psycopg2-binary>=2.9.0
   databricks-sdk>=0.81.0
   ```

3. **Verify both files have the dependencies (from apps_lakebase/):**
   ```bash
   cd apps_lakebase && grep -i psycopg pyproject.toml requirements.txt
   cd apps_lakebase && grep -i databricks-sdk pyproject.toml requirements.txt
   ```
   You should see `psycopg[binary,pool]` and `databricks-sdk` in BOTH files.

4. **Test locally** before proceeding (from apps_lakebase/):
   ```bash
   cd apps_lakebase && pip install -r requirements.txt
   cd apps_lakebase && python3 -c "import psycopg; from psycopg_pool import ConnectionPool; print(''psycopg3 + pool OK'')"
   cd apps_lakebase && python3 -c "from databricks.sdk import WorkspaceClient; print(''databricks-sdk OK'')"
   ```

5. **Ensure `requirements.txt` is NOT in `apps_lakebase/.gitignore`:**
   ```bash
   grep -q "requirements.txt" apps_lakebase/.gitignore && echo "WARNING: Remove requirements.txt from .gitignore!" || echo "OK"
   ```
   If ignored, Databricks sync will skip it and deployment will fail.

**Why this matters:** The app uses `psycopg3` + `databricks-sdk` for autoscaling and `psycopg2` for provisioned mode. Both drivers must be available so the code can select the right one at runtime.

---

## Part B: Configure App Permissions (CRITICAL)

Your app runs as a **service principal**. It cannot connect to Lakebase until you grant permissions.

**Step 1: Get service principal ID**
```bash
cd apps_lakebase && python scripts/lakebase_manager.py --action app-info --app-name $APP_NAME
```
Copy the Service Principal ID from the output.

**Step 2: Grant Lakebase role**
```bash
cd apps_lakebase && python scripts/lakebase_manager.py --action add-lakebase-role --app-name $APP_NAME --instance-name {user_app_name} --mode {lakebase_mode} --branch "projects/{user_app_name}/branches/production"
```
> The `--branch` flag is used by autoscaling; provisioned mode ignores it.

Look for: `✓ Successfully added Lakebase role`

> **Sequence permissions:** The `setup-lakebase.sh` script (run earlier in setup_lakebase) grants sequence permissions needed for SERIAL columns. If you later see `permission denied for sequence` errors, re-run: `cd apps_lakebase && ./scripts/setup-lakebase.sh --recreate`

**Step 3: Link Lakebase as App Resource (provisioned only)**
> **Autoscaling mode ({lakebase_mode}):** Skip this step entirely. Autoscaling does not support App Resource linking (returns 404). The app authenticates via `generate_database_credential()` with the SQL-level role from Step 2.

```bash
# Provisioned only — do NOT run for autoscaling:
cd apps_lakebase && python scripts/lakebase_manager.py --action link-app-resource --app-name $APP_NAME --instance-name {user_app_name} --mode {lakebase_mode}
```
Look for: `✓ Successfully linked Lakebase` (provisioned) or `ℹ️ Autoscaling mode` (autoscaling)

**Step 4: Verify permissions were added**
```bash
cd apps_lakebase && python scripts/lakebase_manager.py --action list-lakebase-roles --instance-name {user_app_name} --mode {lakebase_mode} --branch "projects/{user_app_name}/branches/production"
```
Your service principal ID must appear with `DATABRICKS_SUPERUSER` role.

**Step 5: Verify apps_lakebase/app.yaml env vars match your mode (`{lakebase_mode}`)**
```yaml
  - name: USE_LAKEBASE
    value: "true"
  # Autoscaling only — include ENDPOINT_NAME; omit for provisioned:
  - name: ENDPOINT_NAME
    value: "projects/{user_app_name}/branches/production/endpoints/primary"
```
> For autoscaling, do NOT set `LAKEBASE_USER`. For provisioned, `LAKEBASE_USER` is set via the app resource link.

**⚠️ If you skip permission steps, you will see errors like:**
```
role "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" does not exist
```
or for cold-start timeouts:
```
Connection attempt 1/5 failed (scale-to-zero wake?), retrying...
```
Go back and run steps 2-4 again. Cold-start retries are normal for the first connection after scale-to-zero.

---

## Lakebase Authentication Pattern (CRITICAL)

Databricks Apps inject these env vars for linked database resources:
- `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPORT`, `PGSSLMODE`

**⚠️ PGPASSWORD is NOT injected!** Your mode is `{lakebase_mode}`. Authentication differs by mode:

1. **Autoscaling mode** (when `ENDPOINT_NAME` is set) - uses psycopg3 ConnectionPool with credential rotation:
   ```python
   from databricks.sdk import WorkspaceClient
   import psycopg
   from psycopg_pool import ConnectionPool

   ws = WorkspaceClient()
   endpoint_name = os.environ["ENDPOINT_NAME"]

   class OAuthConnection(psycopg.Connection):
       @classmethod
       def connect(cls, conninfo='''', **kwargs):
           credential = ws.postgres.generate_database_credential(endpoint=endpoint_name)
           kwargs[''password''] = credential.token
           return super().connect(conninfo, **kwargs)

   pool = ConnectionPool(
       conninfo=f"dbname={db} user={user} host={host} port={port} sslmode=require",
       connection_class=OAuthConnection,
       min_size=1, max_size=10, open=True,
   )
   ```

2. **Provisioned mode** (when `ENDPOINT_NAME` is NOT set) - uses OAuth token directly:
   ```python
   from databricks.sdk import WorkspaceClient
   ws = WorkspaceClient()
   headers = ws.config.authenticate()
   token = headers["Authorization"][7:]  # Remove "Bearer "
   ```

**When updating `@apps_lakebase/src/backend/services/lakebase.py`, ensure it detects `ENDPOINT_NAME` and uses the appropriate pattern.** The existing lakebase.py template already handles both modes.

---

## Part C: Wire UI to Backend

### Backend Changes

1. **Review DDL and DML files** to understand the database structure (under apps_lakebase/)
   - Open `@apps_lakebase/db/lakebase/ddl/` and review all table DDL files
   - Open `@apps_lakebase/db/lakebase/dml_seed/` and review the seed data files
   - Understand the table names, column names, data types, and relationships
   - Note which tables power which UI pages/components

2. **Update query functions** in `@apps_lakebase/src/backend/services/lakebase.py`
   - Based on your understanding of the backend Lakebase tables, update the query functions
   - Ensure queries match the actual table and column names from the DDL files
   - Use existing connection code - do NOT create new database connections
   - Ensure OAuth token authentication is used (see pattern above)
   - Functions should return `None` if Lakebase connection fails (for fallback)
   - **Check your work:** Run each query manually to verify it returns expected data without errors
   - **Connection Resilience (CRITICAL for Autoscaling):** Lakebase autoscaling instances scale to zero after idle periods, which kills pooled connections. Your Lakebase service layer MUST: (1) Configure `psycopg_pool.ConnectionPool` with `check=ConnectionPool.check_connection` and `max_idle=300`. (2) Add retry-once logic in query helpers for "terminating connection" errors. (3) Log retries at WARNING level.

3. **Add INFO logging** to all Lakebase connection code
   - Log when connecting to Lakebase (host, database, schema)
   - Log the query being executed and which page/endpoint triggered it
   - Log success with row count or failure with error details
   - Example:
     ```python
     import logging
     logger = logging.getLogger(__name__)
     
     logger.info(f"[Lakebase] Connecting to {host}/{database}/{schema}")
     logger.info(f"[Lakebase] Executing query for endpoint: /api/your-endpoint")
     logger.info(f"[Lakebase] Query successful - returned {len(results)} rows")
     ```

4. **Add/update API endpoints** in `@apps_lakebase/src/backend/api/routes.py`
   - Health endpoint: `/api/health/lakebase` - returns connection status and any errors
   - Data endpoints should return both `data` AND `source` ("live" or "mock")
   - When Lakebase fails, fall back to mock data

### Frontend Changes

5. **Create a ConnectionStatus indicator component**
   - Shows "🔴 Live Data" when connected to Lakebase  
   - Shows "📋 Mock Data" when using fallback data
   - Displays error indicator (⚠️) with tooltip when connection fails
   - **Place at the TOP center of the page** (header area) so users clearly see it immediately
   - **Must appear on ALL pages** that fetch data from Lakebase
   - Show the specific action/data being loaded for that page (e.g., "Loading listings...", "Fetching bookings...")

6. **Update data-fetching components**
   - Handle both live and mock data from backend
   - Track the data source so UI can display it if needed

**Important:** Users must clearly see whether they''re viewing live or mock data on every page.

---

## Part D: Local Build and Test

Run all commands from the `apps_lakebase/` folder.

1. **Build the frontend:**
   ```bash
   cd apps_lakebase && npm install && npm run build
   ls apps_lakebase/dist/index.html || echo "ERROR: Build failed!"
   ```

2. **Test the backend locally:**
   ```bash
   cd apps_lakebase && python3 app.py
   ```

3. **Open `http://localhost:8000` in your browser and verify:**
   - The UI loads correctly
   - Navigation works between pages
   - ConnectionStatus indicator shows data source
   - Backend API endpoints respond (check browser dev tools Network tab)
   - No console errors

4. **Test API endpoints locally:**
   ```bash
   curl -s "http://localhost:8000/api/health/lakebase" | jq .
   ```

**Only proceed to Step 8 (Deploy and Test) after local testing passes.**

---

## Defensive Data Handling

When wiring UI to backend, prevent runtime errors:
- Initialize arrays with `[]`, not `undefined`
- Use optional chaining: `data?.slice()`, `data?.map()`
- Provide fallbacks: `(data ?? []).map(...)` or `data || []`
- Check before rendering: `{data && data.map(...)}`

---

## Route Prefix Reminder

Health endpoints are mounted at root (`/health/*`), not under `/api`. Frontend calls to health checks should use `/health/lakebase`, not `/api/health/lakebase`.

---

## Checklist

- [ ] psycopg[binary,pool]>=3.1.0 AND psycopg2-binary AND databricks-sdk in BOTH pyproject.toml AND requirements.txt
- [ ] requirements.txt NOT in .gitignore (will be skipped by sync!)
- [ ] Tested locally: `python3 -c "import psycopg; from psycopg_pool import ConnectionPool"`
- [ ] Service principal ID obtained
- [ ] Lakebase database role granted (add-lakebase-role --mode {lakebase_mode})
- [ ] Lakebase linked as App Resource (provisioned only; autoscaling skips this step)
- [ ] apps_lakebase/app.yaml env vars match mode: ENDPOINT_NAME for autoscaling, LAKEBASE_USER via resource link for provisioned
- [ ] INFO logging added to all Lakebase connection code
- [ ] Backend APIs return data with source indicator (live/mock)
- [ ] Backend falls back to mock data when Lakebase unavailable
- [ ] ConnectionStatus component shows live vs mock indicator on ALL pages
- [ ] Frontend built successfully: `npm run build` (from apps_lakebase/)
- [ ] Local testing passed at localhost:8000',
'You are a full-stack developer connecting a web app to Lakebase.

Key requirements:
1. Configure service principal permissions (apps don''t run as your user)
2. Grant Lakebase database role (required for both modes) AND link as App Resource (provisioned only -- autoscaling skips this)
3. Backend APIs must indicate data source (live/mock) and fall back gracefully
4. UI must show a clear indicator: "Live Data" vs "Mock Data"
5. Display connection errors so users understand any issues
6. Test locally before deployment (deployment is done in the next step)

This prompt is returned as-is for direct use in Cursor/Copilot. No LLM processing.

CLI Best Practices:
- Run from apps_lakebase/ or use apps_lakebase/scripts/ for deploy and lakebase scripts
- Run CLI commands outside the IDE sandbox to avoid SSL/TLS certificate errors',
'Wire UI to Lakebase',
'Connect frontend UI to Lakebase backend, test locally',
6,
'## Prerequisite

Complete Step 6 (Setup Lakebase) first. Tables must exist.

---

## Steps to Apply

1. Copy the generated prompt
2. Paste into Cursor or Copilot
3. Follow Parts A → B → C → D in order
4. Test locally before proceeding to deployment

**CRITICAL:** The deployed app uses a service principal. Get its ID and grant Lakebase permissions.

**Note:** This step focuses on local development. Deployment to Databricks is done in Step 8.',
'## Expected Deliverables

- Service principal with Lakebase database role granted (autoscaling mode)
- Lakebase linked as App Resource (enables PGHOST/PGUSER injection)
- Backend APIs with fallback to mock data
- ConnectionStatus indicator showing live/mock state
- Frontend built successfully (`npm run build`)
- Local testing passed at localhost:8000

**Next Step:** Deploy to Databricks in Step 8',
TRUE,
1, TRUE, current_timestamp(), current_timestamp(), current_user());

-- Deploy to Databricks App
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(110, 'deploy_databricks_app',
'## Your Task

Deploy the locally-tested web application to Databricks Apps.

**Workspace:** `{workspace_url}`

**Working directory:** All app paths and commands use the `apps_lakebase/` folder.

---

## Deployment Constraints
- Databricks App names must use only lowercase letters, numbers, and dashes (no underscores).
  Use hyphens: `my-app-name` not `my_app_name`.
- The Databricks Apps runtime auto-runs `npm install` and `npm run build` when it
  finds a `package.json`. Ensure `databricks.yml` sync config includes both `dist/**`
  AND `src/**` so the platform build succeeds.

---

### Step 0: Derive App Name (MUST match UI Design step)

Derive your app name from your username + use case. This ensures the deployed app matches your `app.yaml` and `databricks.yml` configuration.

```bash
FIRSTNAME=$(databricks current-user me --output json | jq -r ''.userName'' | cut -d''@'' -f1 | cut -d''.'' -f1)
LASTINITIAL=$(databricks current-user me --output json | jq -r ''.userName'' | cut -d''@'' -f1 | cut -d''.'' -f2 | cut -c1)
USERNAME="${FIRSTNAME}-${LASTINITIAL}"
APP_NAME="${USERNAME}-{use_case_slug}"
echo "Deploying app: $APP_NAME"
```

**Validate** that your config files match this name:
```bash
grep -E "^name:" apps_lakebase/app.yaml
grep "name:" apps_lakebase/databricks.yml | head -1
```
Both must show `$APP_NAME`. If they don''t match, update them before proceeding.

---

### Step 1: Verify Frontend Build (CRITICAL)

Before deploying, verify the `apps_lakebase/dist/` folder exists with the built frontend:

```bash
ls -la apps_lakebase/dist/index.html
```

**If missing or error, build the frontend first (from apps_lakebase/):**
```bash
cd apps_lakebase && npm run build
ls -la apps_lakebase/dist/
# Should show: index.html, assets/, vite.svg
```

**Why this matters:** The app serves the UI from the `dist/` folder inside apps_lakebase. If `dist/` is missing, you will see "No frontend deployed" instead of the web UI.

---

### Step 2: Deploy Application (USE SCRIPT ONLY)

**CRITICAL:** Always use the deployment script from `apps_lakebase/`. Do NOT use ad-hoc `databricks apps` commands.

```bash
cd apps_lakebase && ./scripts/deploy.sh --code-only -t production -p e2-demo-field-eng
```

This script automatically:
1. Builds the frontend (`npm run build` in apps_lakebase)
2. Syncs ALL files including `dist/` to workspace
3. Triggers rolling deployment

**WARNING:** Direct `databricks apps deploy` or `databricks workspace import` commands will SKIP the `dist/` folder because it''s in `.gitignore`. Only the deploy script in apps_lakebase syncs it correctly via `databricks bundle sync` (see apps_lakebase/databricks.yml).

---

### Step 3: Verify UI Loads in Browser

Get the deployed app URL and open it in a browser:

```bash
databricks apps get $APP_NAME --output json | jq -r ''.url''
```

**Expected:** You should see the **web UI with sidebar and content** (the React application).

**If you see JSON with "No frontend deployed"** - see Troubleshooting below.

---

### Step 4: Check Logs and Fix Errors (up to 3 iterations)

1. **Get the app logs** and scan for errors:

```bash
databricks apps logs $APP_NAME --tail 100
```

2. **If errors exist:**
   - Research the issue to understand the root cause
   - Apply the fix to the code in apps_lakebase/
   - Rebuild: `cd apps_lakebase && npm run build`
   - Redeploy: `cd apps_lakebase && ./scripts/deploy.sh --code-only -t production -p e2-demo-field-eng`
   - Check logs again

3. **If no errors:** Deployment successful!

4. **Repeat up to 3 times.** If errors persist after 3 attempts, report them for manual investigation.

**Common errors:**
- "Could not import module" → Check `apps_lakebase/app.yaml` command matches your file structure (e.g., `app:app` vs `server.app:app`)
- "No module named ''psycopg''" → Ensure psycopg[binary,pool]>=3.1.0 is in requirements.txt
- "Connection attempt failed" → Normal on first connect; check that Lakebase env vars in app.yaml match your mode ({lakebase_mode})
- "password authentication failed" → For provisioned: verify app resource link and LAKEBASE_USER; for autoscaling: verify ENDPOINT_NAME is set
- "permission denied for sequence" → Sequence GRANT missing; re-run: cd apps_lakebase && ./scripts/setup-lakebase.sh --recreate

---

### Troubleshooting: "No frontend deployed"

If you see this JSON response instead of the web UI:
```json
{"note": "No frontend deployed. Visit /docs for API documentation."}
```

**Cause:** The `apps_lakebase/dist/` folder (built frontend) was not synced to the workspace.

**Fix:**
1. Verify dist exists locally: `ls apps_lakebase/dist/index.html`
2. If missing, build it: `cd apps_lakebase && npm run build`
3. Redeploy using the script (NOT ad-hoc commands):
   ```bash
   cd apps_lakebase && ./scripts/deploy.sh --code-only -t production -p e2-demo-field-eng
   ```

**Root cause:** The `dist/` folder is in `.gitignore`. Only `databricks bundle sync` (used by deploy.sh in apps_lakebase) includes it via explicit config in apps_lakebase/databricks.yml.

---

### If the Workspace App Limit Is Reached

If deployment fails because the workspace has hit its app limit, do NOT rename your app. Instead, free up a slot by removing the oldest stopped app:

1. Find stopped apps sorted by oldest first:
   ```bash
   databricks apps list -o json | jq -r ''[.[] | select(.compute_status.state == "STOPPED")] | sort_by(.update_time) | .[0] | .name''
   ```
2. Delete it and wait for cleanup to complete:
   ```bash
   databricks apps delete <name-from-above>
   sleep 10
   ```
3. Retry the deployment.

If the limit error persists, repeat with the next oldest stopped app -- but **stop after 3 total attempts** (increase the wait to 20s, then 40s between retries). If it still fails after 3 tries, stop and report the issue for manual workspace cleanup. Never delete apps in RUNNING state.

---

### Summary

Your job is complete when:
- The Databricks App is deployed and running
- **The web UI loads in browser** (React app with sidebar, NOT JSON)
- No "No frontend deployed" message
- No errors in the app logs',
'You are deploying a locally-tested web application to Databricks Apps. Focus on deployment, verification, and troubleshooting.

Your approach:
1. Use existing deployment scripts when available
2. Deploy to Databricks Apps
3. Verify the deployment by checking the app URL
4. Debug and fix any deployment errors

CLI Best Practices:
- Use the deployment script from apps_lakebase/scripts/ (run from apps_lakebase/)
- Run CLI commands outside the IDE sandbox to avoid SSL/TLS certificate errors

This prompt is returned as-is for direct use in Cursor/Copilot. No LLM processing.',
'Deploy to Databricks App',
'Deploy your locally-tested app to Databricks workspace',
4,
'## How to Use

1. **Copy the generated prompt**
2. **Paste into Cursor or Copilot**
3. The code assistant will:
   - Use the deployment script from apps_lakebase/scripts/ folder
   - Deploy your app to Databricks
   - Get the app URL and verify it works
   - Fix any deployment errors

**Note:** Make sure local testing passed before running this step.',
'## Expected Output

- Databricks App deployed and running
- **Web UI loads in browser** (React app with sidebar and content, NOT JSON)
- No "No frontend deployed" error message
- No errors in the app logs',
TRUE,
1, TRUE, current_timestamp(), current_timestamp(), current_user());

-- Register Lakebase in Unity Catalog
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(112, 'sync_from_lakebase',
'Copy and paste this prompt to the AI:

```
## Task: Register Lakebase as a Read-Only Unity Catalog Database Catalog

Register the Lakebase PostgreSQL database as a Unity Catalog database catalog so that all tables are automatically accessible via SQL, notebooks, and ETL pipelines with zero ETL.

### Configuration
- **Catalog name:** {lakebase_uc_catalog_name}
- **Lakebase instance:** {user_app_name}
- **Database name:** databricks_postgres (standard Lakebase database)
- **SQL Warehouse:** {default_warehouse}

### Step 1: Check if Catalog Already Exists

Run the following CLI command to check whether the catalog has already been registered:

```bash
databricks catalogs get {lakebase_uc_catalog_name}
```

- If the command returns catalog info with **state: ACTIVE**, the catalog is already registered. Print a confirmation message: "Catalog ''{lakebase_uc_catalog_name}'' already exists and is ACTIVE. Skipping creation."
- If the command returns an error (e.g., "CATALOG_DOES_NOT_EXIST" or "not found"), proceed to Step 2.

### Step 2: Create the Database Catalog (only if it does not exist)

Register the Lakebase PostgreSQL database as a read-only Unity Catalog catalog:

```bash
databricks database create-database-catalog {lakebase_uc_catalog_name} {user_app_name} databricks_postgres
```

After creation, verify the catalog state:

```bash
databricks catalogs get {lakebase_uc_catalog_name}
```

Confirm the output shows **state: ACTIVE**. If the state is not ACTIVE, wait a few seconds and check again.

### Step 3: List All Schemas in the Catalog

Whether the catalog was just created or already existed, always run this final verification step to display all available schemas:

```sql
SELECT schema_name 
FROM {lakebase_uc_catalog_name}.information_schema.schemata 
ORDER BY schema_name;
```

Run this SQL query using the SQL Warehouse **{default_warehouse}**. Display the results to confirm which schemas are available in the registered catalog.

### Expected Result:
- Catalog `{lakebase_uc_catalog_name}` is registered and ACTIVE in Unity Catalog
- All schemas from the Lakebase PostgreSQL database are listed and visible
- Tables within those schemas are now queryable via standard SQL (e.g., `SELECT * FROM {lakebase_uc_catalog_name}.<schema>.<table>`)
```',
'',
'Register Lakebase in Unity Catalog',
'Register Lakebase as a read-only Unity Catalog database catalog',
9,
'## What is a Unity Catalog Database Catalog?

A **Database Catalog** in Unity Catalog allows you to register an external database (such as Lakebase PostgreSQL) as a read-only catalog. Once registered, all tables from the source database appear automatically in Unity Catalog and can be queried via SQL, notebooks, and ETL pipelines -- with zero ETL needed.

This replaces the manual process of syncing individual tables and converting types.

---

## Steps to Apply

1. Copy the generated prompt using the copy button
2. Paste it into Cursor or VS Code with Copilot
3. The AI will check if the catalog already exists
4. If not, it will create the database catalog using the Databricks CLI
5. It will verify the catalog is ACTIVE
6. Finally, it will list all schemas in the catalog as confirmation

**Note:** This is a one-time registration. Once the catalog is created, all current and future tables in the Lakebase database are automatically accessible in Unity Catalog.',
'## Expected Deliverables

- Catalog `{lakebase_uc_catalog_name}` is registered in Unity Catalog with state ACTIVE
- All schemas from the Lakebase PostgreSQL database are listed and displayed to the user
- Tables are queryable via standard SQL (e.g., `SELECT * FROM {lakebase_uc_catalog_name}.<schema>.<table>`)',
TRUE,
1, TRUE, current_timestamp(), current_timestamp(), current_user());

-- =============================================
-- GENIE ACCELERATOR PROMPTS
-- =============================================

-- Step 22: Analyze Silver Metadata (Genie Accelerator) - bypass_LLM = TRUE
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(114, 'genie_silver_metadata',
'Extract and analyze comprehensive table and column metadata from your Silver layer schema.

This will:

- **Query table metadata** — extract table names, types, and table-level comments from `{chapter_3_lakehouse_catalog}.information_schema.tables`
- **Query column metadata** — extract column names, data types, ordinal positions, nullability, defaults, and column-level comments from `{chapter_3_lakehouse_catalog}.information_schema.columns`
- **Query constraints** — extract primary key and foreign key constraint definitions from `{chapter_3_lakehouse_catalog}.information_schema.table_constraints` and `constraint_column_usage`
- **Query column tags** — extract Unity Catalog tags from `{chapter_3_lakehouse_catalog}.information_schema.column_tags` (if available)
- **Query table tags** — extract Unity Catalog tags from `{chapter_3_lakehouse_catalog}.information_schema.table_tags` (if available)
- **Merge and save** — combine all results into an enriched metadata CSV
- **Analyze and document** — produce a Genie analysis plan based on the metadata

**Source:** `{chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema}` (configured in the Silver Layer panel above)

Copy and paste this prompt to the AI:

```
Run the following SQL queries against {chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema} and merge the results into a comprehensive metadata file.

---

**Query 1 — Table inventory:**
SELECT table_catalog, table_schema, table_name, table_type, comment
FROM {chapter_3_lakehouse_catalog}.information_schema.tables
WHERE table_schema = ''{chapter_3_lakehouse_schema}''
ORDER BY table_name

**Query 2 — Column metadata:**
SELECT table_name, column_name, ordinal_position, data_type, is_nullable, column_default, comment
FROM {chapter_3_lakehouse_catalog}.information_schema.columns
WHERE table_schema = ''{chapter_3_lakehouse_schema}''
ORDER BY table_name, ordinal_position

**Query 3 — Table constraints (PKs, FKs):**
SELECT constraint_name, table_name, constraint_type
FROM {chapter_3_lakehouse_catalog}.information_schema.table_constraints
WHERE constraint_schema = ''{chapter_3_lakehouse_schema}''
ORDER BY table_name, constraint_type

**Query 4 — Constraint column usage:**
SELECT constraint_name, table_name, column_name
FROM {chapter_3_lakehouse_catalog}.information_schema.constraint_column_usage
WHERE constraint_schema = ''{chapter_3_lakehouse_schema}''
ORDER BY constraint_name, table_name

**Query 5 — Column tags (may not exist — skip gracefully if error):**
SELECT table_name, column_name, tag_name, tag_value
FROM {chapter_3_lakehouse_catalog}.information_schema.column_tags
WHERE schema_name = ''{chapter_3_lakehouse_schema}''
ORDER BY table_name, column_name

**Query 6 — Table tags (may not exist — skip gracefully if error):**
SELECT table_name, tag_name, tag_value
FROM {chapter_3_lakehouse_catalog}.information_schema.table_tags
WHERE schema_name = ''{chapter_3_lakehouse_schema}''
ORDER BY table_name

---

**Technical reference (for AI execution):**

1. Get warehouse ID:
   databricks warehouses list --output json | jq ''.[0].id''

2. Execute each SQL query via Statement Execution API:
   databricks api post /api/2.0/sql/statements --json ''{
     "warehouse_id": "<WAREHOUSE_ID>",
     "statement": "<SQL_QUERY>",
     "wait_timeout": "50s",
     "format": "JSON_ARRAY"
   }'' > /tmp/query_N_result.json

3. For queries 5 and 6 (tags), if the table does not exist, skip gracefully and continue.

4. Merge all results into a single enriched CSV with Python:
   - Read each query result JSON
   - Join table metadata (Query 1) with column metadata (Query 2) on table_name
   - Append constraint info (Queries 3-4) as additional columns: constraint_type, constraint_name
   - Append tag info (Queries 5-6) as additional columns: column_tags, table_tags
   - Output columns: table_name, table_type, table_comment, column_name, ordinal_position, data_type, is_nullable, column_default, column_comment, constraint_type, constraint_name, column_tags, table_tags
   - Save to: data_product_accelerator/context/{use_case_file_prefix}_Metadata.csv

5. Analyze the metadata and create docs/genie_plan.md with:
   - **Table Inventory**: List each table with its type, row purpose (inferred from table comment and column patterns), and estimated business domain
   - **Column Analysis**: Key columns per table — identify likely dimensions, measures, timestamps, and foreign keys based on data types, names, and comments
   - **Relationship Map**: Inferred relationships between tables (from FK constraints and column naming patterns like *_id)
   - **Table Relevance Assessment**: For each table, assess relevance to the use case (High/Medium/Low) with rationale
   - **Recommended Genie Space Structure**: Suggest how tables should be grouped into Genie Spaces (max 25 assets per space)
   - **Metric View Candidates**: Identify numeric columns with business context that could become Metric Views (with suggested dimensions and measures)
   - **TVF Candidates**: Suggest parameterized query patterns based on common access patterns inferred from table structure
   - **Data Lineage Notes**: Document any lineage hints from column comments or naming conventions

Known warehouse ID: <YOUR_WAREHOUSE_ID> (get via: databricks warehouses list --output json | jq ''.[0].id'')
```',
'',
'Analyze Silver Metadata',
'Extract and analyze comprehensive table/column metadata from Silver layer schema including comments, constraints, and tags',
22,
'## 1️⃣ How To Apply

Copy the prompt from the Prompt tab, start a new Agent chat in your IDE, paste it and press Enter.

**Prerequisite:** Run this in your cloned Template Repository (see Prerequisites in Step 0). Ensure Databricks CLI is authenticated.

**Steps:** Copy the prompt → paste into Cursor or VS Code with Copilot → AI executes 6 SQL queries via Databricks CLI → merges results into enriched CSV → creates analysis document.

**Note:** The source catalog and schema are shown in the **Silver Layer** panel above this prompt. You can edit them using the Edit button.

---

## 2️⃣ What Are We Building?

This step extracts **comprehensive metadata** from your Silver layer — not just column names and types, but also table comments, column comments, constraints, and Unity Catalog tags. This enriched metadata powers the Gold layer design.

### Two Output Files

| File | Purpose |
|------|---------|
| `data_product_accelerator/context/{use_case_file_prefix}_Metadata.csv` | Enriched metadata CSV with all table/column/constraint/tag information. Fed into Gold Layer Design. |
| `docs/genie_plan.md` | Analysis document with table relevance, relationship maps, Genie Space recommendations, and metric/TVF candidates. |

### Why Enriched Metadata Matters

| Data Point | What It Tells Us |
|------------|-----------------|
| **Column comments** | Business meaning and context for each field |
| **Table comments** | Purpose and scope of each table |
| **PK/FK constraints** | Explicit relationships between tables |
| **Column tags** | Governance classifications and sensitivity levels |
| **Data types** | Dimension vs. measure classification hints |

---

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How It''''s Used Here |
|----------|-------------------|
| **Unity Catalog information_schema** | Queries the standard UC metadata catalog for comprehensive table/column metadata |
| **Constraint Discovery** | Extracts PK/FK from `table_constraints` to understand explicit relationships |
| **Tag Integration** | Pulls UC tags for governance context and data classification |
| **Graceful Degradation** | Tag queries skip gracefully if the views don''''t exist |
| **Analysis-Driven Design** | The genie_plan.md provides a reasoned assessment before jumping into Gold design |',
'## Expected Deliverables

- `data_product_accelerator/context/{use_case_file_prefix}_Metadata.csv` — enriched metadata CSV
- `docs/genie_plan.md` — analysis with table relevance, relationships, Genie Space recommendations, metric/TVF candidates
- CSV contains: table_name, table_type, table_comment, column_name, data_type, is_nullable, column_comment, constraint_type, constraint_name, column_tags, table_tags',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 22 (Generate Mode): Design Silver Schema from PRD - bypass_LLM = TRUE
INSERT INTO ${catalog}.${schema}.section_input_prompts
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(136, 'genie_silver_metadata_generate',
'## Design Silver Layer Schema from PRD

The business requirements are documented in @docs/design_prd.md.

---

### Instructions

Based on the PRD, design a **normalized relational silver layer schema** for the **{use_case_title}** use case and save it as an enriched metadata CSV.

Copy and paste this prompt to the AI:

```
Read the PRD at @docs/design_prd.md and design a complete silver layer database schema for the **{use_case_title}** use case.

**Output file:** data_product_accelerator/context/{use_case_file_prefix}_Metadata.csv

**Schema design requirements:**
1. Design 5-15 silver layer tables covering all entities, relationships, and transactional data described in the PRD
2. Include primary keys (BIGINT, first column per table) and foreign keys referencing related tables
3. Use Spark SQL data types: STRING, BIGINT, INT, DOUBLE, DECIMAL(precision,scale), BOOLEAN, DATE, TIMESTAMP
4. Add descriptive comments for every column explaining its business meaning
5. Include standard operational columns per table: created_at (TIMESTAMP), updated_at (TIMESTAMP), is_active (BOOLEAN)
6. Use snake_case for all table and column names
7. Design for analytics — include fact tables with numeric measures and dimension tables with descriptive attributes

**CSV format (enriched metadata compatible):**
```csv
table_name,table_type,table_comment,column_name,ordinal_position,data_type,is_nullable,column_default,column_comment,constraint_type,constraint_name,column_tags,table_tags
<table_name>,MANAGED,<table description>,<column_name>,<position>,<type>,<YES/NO>,,<column description>,<PK/FK/empty>,<constraint_name_or_empty>,,
```

One row per column, all tables included. ordinal_position restarts at 1 for each table.

**After creating the CSV, validate and enrich:**
1. Verify required columns: table_name, table_type, table_comment, column_name, data_type, ordinal_position, is_nullable, column_comment
2. Check ordinal_position is sequential per table (1, 2, 3...) — fix gaps
3. Fill empty column_comment fields with descriptions inferred from column_name and table_name
4. Fill empty table_comment fields with descriptions of the table''s business purpose
5. Mark primary key columns with constraint_type=PK
6. Mark foreign key columns with constraint_type=FK and constraint_name referencing the target table
7. Normalize data_type to Spark SQL types (VARCHAR -> STRING, INT -> INTEGER, FLOAT -> DOUBLE)
8. Print verification summary: total tables, total columns, file path, fixes applied

**Then create the analysis document** at docs/genie_plan.md with:
- **Table Inventory**: List each table with its type, purpose, and business domain
- **Column Analysis**: Key columns per table — identify dimensions, measures, timestamps, and foreign keys
- **Relationship Map**: Relationships between tables (from FK constraints and naming patterns like *_id)
- **Table Relevance Assessment**: For each table, assess relevance to the use case (High/Medium/Low)
- **Recommended Genie Space Structure**: Suggest how tables should be grouped into Genie Spaces (max 25 assets per space)
- **Metric View Candidates**: Identify numeric columns that could become Metric Views (with suggested dimensions and measures)
- **TVF Candidates**: Suggest parameterized query patterns based on common access patterns

**Downstream Compatibility Note:**
This CSV drives the Genie Accelerator pipeline:
- Gold Design (Step 11) — reads CSV for dimensional model design
- Deploy Assets (Step 23) — uses schema to create and populate tables
- Optimize Genie (Step 25) — uses analysis for Genie Space configuration
```',
'',
'Analyze Silver Metadata (Design from PRD)',
'Design silver layer schema from your PRD — for when you don''t have existing Silver tables or a CSV',
22,
'## How To Apply

1. **Prerequisite:** Complete Step 3 (PRD Generation) first — the PRD is used as input to design the schema
2. Click **Generate** to create the prompt with your PRD embedded
3. Copy the prompt into Cursor or VS Code with Copilot
4. The coding assistant reads the PRD, designs tables, and saves the CSV to `data_product_accelerator/context/{use_case_file_prefix}_Metadata.csv`
5. Review the generated schema and iterate if needed

---

## When to Use This Mode

Use **Design from PRD** when:
- You **don''t have existing Silver tables** in Databricks yet
- You **don''t have a CSV export** from another tool
- You want to **start from scratch** with a schema designed from your requirements
- You have a **PRD from Step 3** that describes the data entities you need

This mode works just like the Extract and Upload modes — it gives your coding assistant a detailed prompt with the PRD as context, and the AI designs the silver layer schema for you.

---

## What Happens Next

The generated CSV and analysis document drive the entire Genie Accelerator pipeline:

```
data_product_accelerator/context/{use_case_file_prefix}_Metadata.csv
  → Gold Design (Step 11)  — reads CSV to design dimensional model
  → Deploy Assets (Step 23) — uses schema to create tables
  → Optimize Genie (Step 25) — uses analysis for Genie Space config

docs/genie_plan.md
  → Genie Space recommendations, metric views, TVF candidates
```',
'## Expected Deliverables

- `data_product_accelerator/context/{use_case_file_prefix}_Metadata.csv` file created via coding assistant
- Contains 5-15 tables with enriched metadata designed from the PRD
- Includes: table_name, table_type, table_comment, column_name, ordinal_position, data_type, is_nullable, column_comment, constraint_type, constraint_name
- Every column has a descriptive business-context comment and every table has a table_comment
- `docs/genie_plan.md` — analysis with table relevance, relationships, Genie Space recommendations, metric/TVF candidates
- Ready for use as enriched metadata reference for the Genie Accelerator pipeline
- **This CSV is the starting input for the Genie Accelerator pipeline** (Gold Design, Deploy Assets, Optimize Genie all reference it)',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Gold Layer Design for Genie Accelerator (references _Metadata.csv + PRD) - bypass_LLM = TRUE
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(115, 'genie_gold_design',
'I have enriched silver layer metadata at @data_product_accelerator/context/{use_case_file_prefix}_Metadata.csv and a metadata analysis at @docs/genie_plan.md.

The business requirements are documented in @docs/design_prd.md.

Please design the Gold layer using @data_product_accelerator/skills/gold/00-gold-layer-design/SKILL.md

This skill will orchestrate the following end-to-end design workflow:

- **Parse the metadata CSV** — read the enriched metadata file (includes table comments, column comments, constraints, and tags), classify each table as a dimension, fact, or bridge, and use constraint info to map foreign key relationships
- **Cross-reference with PRD** — align the Gold design with business requirements, user personas, and use case workflows documented in the PRD
- **Cross-reference with Genie plan** — use the genie_plan.md analysis for table relevance assessments and recommended Genie Space structure
- **Design the dimensional model** — identify dimensions (with SCD Type 1/2 decisions), fact tables (with explicit grain definitions), and measures, then assign tables to business domains
- **Create ERD diagrams** — generate Mermaid Entity-Relationship Diagrams organized by table count (master ERD always, plus domain and summary ERDs for larger schemas)
- **Generate YAML schema files** — produce one YAML file per Gold table with column definitions, PK/FK constraints, table properties, lineage metadata, and dual-purpose descriptions (human + LLM readable)
- **Document column-level lineage** — trace every Gold column back through Silver with transformation type (DIRECT_COPY, AGGREGATION, DERIVATION, etc.) in both CSV and Markdown formats
- **Create business documentation** — write a Business Onboarding Guide with domain context, real-world scenarios, and role-based getting-started guides
- **Map source tables** — produce a Source Table Mapping CSV documenting which source tables are included, excluded, or planned with rationale for each
- **Validate design consistency** — cross-check YAML schemas, ERD diagrams, and lineage CSV to ensure all columns, relationships, and constraints are consistent

The orchestrator skill will automatically load its worker skills for merge patterns, deduplication, documentation standards, Mermaid ERDs, schema validation, grain validation, and YAML-driven setup.

IMPORTANT: Use the EXISTING catalog `{lakehouse_default_catalog}` -- do NOT create a new catalog. Create the Gold schema `{user_schema_prefix}_gold` and all Gold tables inside this catalog.

NOTE: Before creating the schema, check if `{lakehouse_default_catalog}.{user_schema_prefix}_gold` already exists. If it does, DROP the schema with CASCADE and recreate it from scratch. These are user-specific schemas so dropping is safe.',
'',
'Gold Layer Design (Genie Accelerator)',
'Design Gold layer from enriched silver metadata and PRD using project skills with YAML definitions and Mermaid ERD',
23,
'## 1️⃣ How To Apply

Copy the prompt from the **Prompt** tab, start a **new Agent chat** in your IDE, paste it, and press Enter.

---

### Prerequisite

**Run this in your cloned Template Repository** (see Prerequisites in Step 0).

Ensure you have:
- ✅ `data_product_accelerator/context/{use_case_file_prefix}_Metadata.csv` - Your enriched silver metadata (from Analyze Silver Metadata step)
- ✅ `docs/genie_plan.md` - Metadata analysis with table relevance and Genie recommendations
- ✅ `docs/design_prd.md` - Product Requirements Document (from PRD Generation step)
- ✅ `data_product_accelerator/skills/gold/00-gold-layer-design/SKILL.md` - The Gold layer design orchestrator skill

---

### Steps to Apply

1. **Start new Agent thread** — Open Cursor and start a new Agent thread for clean context
2. **Copy and paste the prompt** — Use the copy button, paste into Cursor; the AI will read your metadata, PRD, genie plan, and the orchestrator skill
3. **Review generated design** — The AI creates `gold_layer_design/` with ERD diagrams, YAML schema files, and lineage documentation
4. **Validate the design** — Check grain, SCD type, relationships, and lineage for each fact/dimension
5. **Verify PRD alignment** — Ensure the Gold design supports the business requirements from the PRD

---

## 2️⃣ What Are We Building?

This is the **Genie Accelerator variant** of Gold Layer Design. Unlike the standard path that starts from raw schema CSV, this version uses:

| Input | What It Provides |
|-------|-----------------|
| **Enriched Metadata CSV** | Table/column comments, constraints, and tags from the Silver layer |
| **Genie Plan (genie_plan.md)** | Pre-analyzed table relevance, relationship maps, and Genie Space recommendations |
| **PRD (design_prd.md)** | Business requirements, user personas, and success criteria |

This triple-input approach produces a Gold design that is **already optimized for Genie Space consumption** — with the right dimensions, measures, and TVF patterns identified upfront.

---

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How It''''s Used Here |
|----------|-------------------|
| **Metadata-Driven Design** | Uses enriched metadata (comments, constraints, tags) instead of raw column lists — producing more accurate table classifications |
| **PRD Alignment** | Cross-references business requirements to ensure Gold tables serve actual use cases |
| **Genie-Optimized** | The genie_plan.md pre-identifies metric view and TVF candidates, so the Gold design accounts for downstream semantic layer needs |
| **YAML-Driven Dimensional Modeling** | Gold schemas defined as YAML files — reviewable, version-controlled, machine-readable |
| **Dual-Purpose COMMENTs** | Table and column COMMENTs serve both business users AND Genie/LLMs |',
'## Expected Deliverables

- `gold_layer_design/` folder with:
  - ERD diagrams (Mermaid) — master + domain ERDs
  - YAML schema files — one per Gold table
  - COLUMN_LINEAGE.csv — Silver-to-Gold column mappings
  - SOURCE_TABLE_MAPPING.csv — table inclusion/exclusion rationale
  - BUSINESS_ONBOARDING_GUIDE.md — stakeholder documentation
- Gold design aligned with PRD requirements and Genie plan recommendations',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 23: Deploy Lakehouse Assets - bypass_LLM = TRUE
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(116, 'deploy_lakehouse_assets',
'Deploy and run all Bronze, Silver, and Gold layer jobs end-to-end using @data_product_accelerator/skills/common/databricks-asset-bundles/SKILL.md and @data_product_accelerator/skills/common/databricks-autonomous-operations/SKILL.md

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
SHOW TABLES IN {lakehouse_default_catalog}.{user_schema_prefix}_bronze;

-- Silver: verify DQ rules and cleaned tables
SELECT COUNT(*) FROM {lakehouse_default_catalog}.{user_schema_prefix}_silver.dq_rules;
SHOW TABLES IN {lakehouse_default_catalog}.{user_schema_prefix}_silver;

-- Gold: verify tables, constraints, and row counts
SHOW TABLES IN {lakehouse_default_catalog}.{user_schema_prefix}_gold;
SELECT * FROM {lakehouse_default_catalog}.information_schema.table_constraints
WHERE table_schema = ''{user_schema_prefix}_gold'';
```

Target catalog: `{lakehouse_default_catalog}`
Target schemas: `{user_schema_prefix}_bronze`, `{user_schema_prefix}_silver`, `{user_schema_prefix}_gold`',
'',
'Deploy Lakehouse Assets (Bronze → Silver → Gold)',
'Validate, deploy, and run all Bronze, Silver, and Gold layer jobs in dependency order using Asset Bundles with autonomous operations',
23,
'## 1️⃣ How To Apply

Copy the prompt from the **Prompt** tab, start a **new Agent chat** in your IDE, paste it, and press Enter.

---

### Prerequisite

**Run this in your cloned Template Repository** (see Prerequisites in Step 0).

Ensure you have:
- ✅ Bronze layer code generated (Step 10): `src/source_bronze/`, `resources/bronze/`
- ✅ Silver layer code generated (Step 11): `src/source_silver/`, `resources/silver/`
- ✅ Gold layer code generated (Step 12): `src/source_gold/`, `resources/gold/`, `gold_layer_design/yaml/`
- ✅ `databricks.yml` bundle configuration file (created/updated in Steps 10-12)
- ✅ Databricks CLI installed and authenticated (`databricks auth login`)

---

### Steps to Apply

**Step 1: Start New Agent Thread** — Open Cursor and start a new Agent thread for clean context.

**Step 2: Copy and Paste the Prompt** — Use the copy button, paste it into Cursor. The AI reads both the Asset Bundles skill and the Autonomous Operations skill.

**Step 3: Validate** — The AI runs `databricks bundle validate -t dev` to catch config errors before deploying.

**Step 4: Deploy** — The AI runs `databricks bundle deploy -t dev` to push all assets to your workspace.

**Step 5: Run Jobs in Dependency Order** — The AI runs each job in sequence:

```
Bronze clone job
    ↓
Silver DQ setup job (creates dq_rules table)
    ↓
Silver DLT pipeline (reads Bronze via CDF)
    ↓
Gold setup job (2 tasks: create tables → add FK constraints)
    ↓
Gold merge job (dedup Silver → merge into Gold)
```

**Step 6: Diagnose Failures (if any)** — If a job fails, the autonomous operations skill kicks in:
1. Get failed task `run_id` from the job run
2. Run `databricks runs get-run-output --run-id <TASK_RUN_ID>`
3. Match error against known patterns, apply fix, redeploy
4. Max 3 iterations before escalation

**Step 7: Verify End-to-End** — Run the verification queries to confirm all layers are populated.

---

## 2️⃣ What Are We Building?

This is a **deployment checkpoint** that validates the entire Lakehouse pipeline works end-to-end before moving to the Data Intelligence layer.

### Asset Bundle Structure (Built in Steps 10-12)

```
project_root/
├── databricks.yml                        # Bundle configuration (all layers)
├── src/
│   ├── source_bronze/                    # Bronze notebooks (clone/generate)
│   │   └── clone_samples.py
│   ├── source_silver/                    # Silver notebooks (DLT + DQ)
│   │   ├── setup_dq_rules_table.py
│   │   ├── dq_rules_loader.py           # Pure Python (NO notebook header)
│   │   ├── silver_dimensions.py
│   │   ├── silver_facts.py
│   │   └── data_quality_monitoring.py
│   └── source_gold/                      # Gold notebooks (YAML-driven)
│       ├── setup_tables.py
│       ├── add_fk_constraints.py
│       └── merge_gold_tables.py
├── resources/
│   ├── bronze/
│   │   └── bronze_clone_job.yml
│   ├── silver/
│   │   ├── silver_dq_setup_job.yml
│   │   └── silver_dlt_pipeline.yml
│   └── gold/
│       ├── gold_setup_job.yml
│       └── gold_merge_job.yml
└── gold_layer_design/yaml/               # YAML schemas (synced to workspace)
```

### Deployment Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LAKEHOUSE DEPLOYMENT CHECKPOINT                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Step 1: VALIDATE                                                           │
│  databricks bundle validate -t dev                                          │
│         ↓                                                                   │
│  Step 2: DEPLOY                                                             │
│  databricks bundle deploy -t dev                                            │
│         ↓                                                                   │
│  Step 3: RUN IN ORDER                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐     │
│  │   Bronze    │→ │ Silver DQ    │→ │ Silver DLT  │→ │  Gold Setup  │     │
│  │  clone_job  │  │ setup_job    │  │  pipeline   │  │  (2 tasks)   │     │
│  └─────────────┘  └──────────────┘  └─────────────┘  └──────┬───────┘     │
│                                                              ↓              │
│                                                      ┌──────────────┐      │
│                                                      │  Gold Merge  │      │
│                                                      │    job       │      │
│                                                      └──────────────┘      │
│         ↓                                                                   │
│  Step 4: VERIFY                                                             │
│  SHOW TABLES / row counts / constraints / CDF checks                       │
│                                                                             │
│  ON FAILURE → Autonomous Operations (diagnose → fix → redeploy, max 3x)   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How It''''s Used Here |
|----------|-------------------|
| **Asset Bundles** | Single `databricks.yml` manages all notebooks, pipelines, and jobs as a versioned, deployable unit |
| **Serverless Compute** | Every job uses `environments` with `environment_version: "4"` — no cluster management |
| **Dependency-Ordered Execution** | Bronze → Silver DQ → Silver DLT → Gold Setup → Gold Merge — each stage depends on the previous |
| **Autonomous Operations** | Deploy → Poll → Diagnose → Fix → Redeploy loop with max 3 iterations before escalation |
| **Idempotent Deploys** | `databricks bundle deploy` is safe to run multiple times — no duplicates |
| **Task-Level Diagnostics** | Failed task `run_id` (not parent job `run_id`) used for `get-run-output` — provides actionable error details |
| **notebook_task** | All jobs use `notebook_task` (never `python_task`) with `base_parameters` dict (never CLI-style `parameters`) |
| **Environment Separation** | Bundle targets (`-t dev`, `-t staging`, `-t prod`) for multi-environment deployments from the same config |

---

## 4️⃣ What Happens Behind the Scenes?

When you paste the prompt, the AI reads two skills:

1. **`@data_product_accelerator/skills/common/databricks-asset-bundles/SKILL.md`** — validates bundle structure, ensures serverless environments, proper task types, and parameter patterns
2. **`@data_product_accelerator/skills/common/databricks-autonomous-operations/SKILL.md`** — provides the deploy-poll-diagnose-fix loop for self-healing when jobs fail

The autonomous operations skill follows this protocol:
1. Run `databricks bundle run` and capture the RUN_ID from the output URL
2. Poll with exponential backoff (30s → 60s → 120s) until terminal state
3. On SUCCESS: verify all tasks completed, report run URL
4. On FAILURE: get failed task `run_id`, run `get-run-output`, match error pattern, apply fix
5. Redeploy and re-run (max 3 iterations before escalation with full error context)',
'## Expected Deliverables

### ✅ Deployment Verification

**Bundle:**
- [ ] `databricks bundle validate -t dev` passes with no errors
- [ ] `databricks bundle deploy -t dev` completes successfully
- [ ] All 5 jobs appear in Databricks Workflows UI

**Bronze Layer:**
- [ ] `bronze_clone_job` completes successfully
- [ ] All tables visible in `{lakehouse_default_catalog}.{user_schema_prefix}_bronze`
- [ ] CDF enabled on all Bronze tables (`delta.enableChangeDataFeed = true`)

**Silver Layer:**
- [ ] `silver_dq_setup_job` creates `dq_rules` table in Silver schema
- [ ] `silver_dlt_pipeline` completes with Expectations evaluated
- [ ] Silver tables populated with cleaned data
- [ ] Row tracking enabled (`delta.enableRowTracking = true`)

**Gold Layer:**
- [ ] `gold_setup_job` creates all Gold tables with PK constraints (Task 1) and FK constraints (Task 2)
- [ ] `gold_merge_job` populates Gold tables from Silver
- [ ] PK/FK constraints visible in `information_schema.table_constraints`
- [ ] Fact-to-dimension joins resolve correctly (no orphan records)

**End-to-End:**
- [ ] Data flows from Bronze → Silver → Gold without errors
- [ ] Row counts are reasonable across all layers
- [ ] Ready for Data Intelligence layer (Genie, Dashboards)',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 24: Deploy Data Intelligence Assets - bypass_LLM = TRUE
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(117, 'deploy_di_assets',
'Deploy all Data Intelligence assets (TVFs, Metric Views, Genie Spaces, and AI/BI Dashboards) using @data_product_accelerator/skills/common/databricks-asset-bundles/SKILL.md and @data_product_accelerator/skills/semantic-layer/04-genie-space-export-import-api/SKILL.md

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
SELECT * FROM get_revenue_by_period(''2024-01-01'', ''2024-12-31'');

-- Verify Metric Views exist
SELECT table_name, table_type FROM {lakehouse_default_catalog}.information_schema.tables
WHERE table_schema = ''{user_schema_prefix}_gold'' AND table_type = ''METRIC_VIEW'';

-- Test Metric View queries
SELECT MEASURE(total_revenue) FROM {lakehouse_default_catalog}.{user_schema_prefix}_gold.revenue_analytics_metrics;
```

Target catalog: `{lakehouse_default_catalog}`
Gold schema: `{user_schema_prefix}_gold`',
'',
'Deploy Semantic Layer Assets (TVFs → Metric Views → Genie → Dashboard)',
'Deploy TVFs, Metric Views, Genie Spaces (via Export/Import API), and AI/BI Dashboards in dependency order',
24,
'## 1️⃣ How To Apply

Copy the prompt from the **Prompt** tab, start a **new Agent chat** in your IDE, paste it, and press Enter.

---

### Prerequisite

**Run this in your cloned Template Repository** (see Prerequisites in Step 0).

Ensure you have:
- ✅ Lakehouse Deployment Checkpoint passed (Step 23) — Bronze, Silver, Gold tables populated
- ✅ Semantic layer code generated (Step 15): `src/source_gold/table_valued_functions.sql`, `src/source_gold/semantic/`, `src/source_gold/genie/`
- ✅ AI/BI Dashboard generated (Step 14): `docs/dashboards/*.lvdash.json`, `scripts/deploy_dashboard.py`
- ✅ Plan files: `plans/phase1-addendum-1.2-tvfs.md`, `plans/phase1-addendum-1.3-metric-views.md`, `plans/phase1-addendum-1.6-genie-spaces.md`
- ✅ Serverless SQL Warehouse available in your workspace
- ✅ Databricks CLI installed and authenticated

---

### Steps to Apply

**Step 1: Start New Agent Thread** — Open Cursor and start a new Agent thread for clean context.

**Step 2: Copy and Paste the Prompt** — Use the copy button, paste it into Cursor. The AI reads the Asset Bundles skill and the Genie Space Export/Import API skill.

**Step 3: Deploy TVFs** — SQL task creates parameterized functions (STRING date params, v3.0 bullet COMMENTs, ROW_NUMBER for Top-N).

**Step 4: Deploy Metric Views** — Python task creates `WITH METRICS LANGUAGE YAML` views with dimensions, measures, and synonyms.

**Step 5: Deploy AI/BI Dashboard** — Workspace Import API with `overwrite: true` (UPDATE-or-CREATE pattern preserving URLs and permissions).

**Step 6: Deploy Genie Space** — Export/Import API with:
- `${catalog}` / `${gold_schema}` variable substitution
- Data assets in priority order: Metric Views → TVFs → Gold Tables
- General Instructions (≤ 20 lines)
- ≥ 10 benchmark questions with exact expected SQL
- Serverless SQL Warehouse (non-negotiable)

**Step 7: Verify All Components**

```sql
-- Test TVFs
SELECT * FROM get_revenue_by_period(''2024-01-01'', ''2024-12-31'');

-- Verify Metric Views
SELECT table_name, table_type FROM information_schema.tables
WHERE table_schema = ''{user_schema_prefix}_gold'' AND table_type = ''METRIC_VIEW'';

-- Navigate to Genie Space in Databricks UI and ask a sample question
```

---

## 2️⃣ What Are We Building?

This deployment checkpoint verifies the complete **Data Intelligence layer** — everything end users interact with for analytics and natural language queries.

### Semantic Layer Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 SEMANTIC LAYER DEPLOYMENT CHECKPOINT                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Step 1: VALIDATE & DEPLOY BUNDLE                                           │
│  databricks bundle validate → databricks bundle deploy                      │
│         ↓                                                                   │
│  Step 2: DEPLOY IN ORDER                                                    │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐     │
│  │    TVFs     │→ │ Metric Views │→ │  Dashboard  │→ │ Genie Space  │     │
│  │  (SQL task) │  │ (Python task)│  │ (Import API)│  │(Export/Import)│     │
│  └─────────────┘  └──────────────┘  └─────────────┘  └──────────────┘     │
│                                                                             │
│  Step 3: VERIFY                                                             │
│  TVF execution │ Metric View queries │ Dashboard renders │ Genie NL test   │
│                                                                             │
│  Genie Space API Rules:                                                     │
│  • serialized_space = json.dumps() (string, not nested object)             │
│  • All IDs = uuid.uuid4().hex (32-char, no dashes)                         │
│  • All arrays sorted before submission                                      │
│  • Template vars: ${catalog}, ${gold_schema} (never hardcoded)             │
│  • Serverless SQL Warehouse ONLY                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Files Deployed

```
src/source_gold/
├── table_valued_functions.sql              # TVFs (STRING params, v3.0 comments)
├── semantic/
│   └── metric_views/
│       ├── revenue_analytics_metrics.yaml  # Metric View YAML definitions
│       └── create_metric_views.py          # Reads YAML → CREATE VIEW WITH METRICS
├── genie/
│   └── genie_space_config.json             # Exported Genie Space (CI/CD)
docs/dashboards/
├── analytics_dashboard.lvdash.json         # Dashboard JSON config
scripts/
├── deploy_dashboard.py                     # UPDATE-or-CREATE deployment
├── deploy_genie_space.py                   # Genie Space API deployment
resources/semantic-layer/
├── tvf_job.yml                             # SQL task for TVF deployment
├── metric_views_job.yml                    # Python task for Metric Views
└── genie_deploy_job.yml                    # Genie Space API deployment job
resources/monitoring/
└── dashboard_deploy_job.yml                # Dashboard deployment job
```

---

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How It''''s Used Here |
|----------|-------------------|
| **Dependency-Ordered Deployment** | TVFs → Metric Views → Dashboard → Genie Space — each depends on the previous |
| **Genie Space Export/Import API** | Programmatic deployment via REST API with `serialized_space` as JSON string, UUID IDs, sorted arrays, and variable substitution |
| **Serverless SQL Warehouse** | Genie Spaces MUST use Serverless SQL warehouse — required for NL query execution (never Classic or Pro) |
| **Variable Substitution** | `${catalog}` and `${gold_schema}` in all queries and configs — never hardcoded catalog/schema |
| **UPDATE-or-CREATE Pattern** | Dashboard and Genie Space deploy use idempotent update-or-create — preserves URLs and permissions |
| **Asset Bundles for SQL Tasks** | TVFs deployed via `sql_task` in bundle YAML; Metric Views via `notebook_task` |
| **Dual Validation** | Pre-deploy SQL validation for dashboards (`validate_dashboard_queries.py`) and TVF compilation checks |

---

## 4️⃣ What Happens Behind the Scenes?

When you paste the prompt, the AI reads two skills:

1. **`@data_product_accelerator/skills/common/databricks-asset-bundles/SKILL.md`** — validates bundle structure, ensures serverless environments, proper task types
2. **`@data_product_accelerator/skills/semantic-layer/04-genie-space-export-import-api/SKILL.md`** — provides the JSON schema, ID generation, array sorting, and variable substitution patterns for programmatic Genie Space deployment

The Genie Space deployment follows this protocol:
1. Load `genie_space_config.json` from repo
2. Substitute `${catalog}` → actual catalog, `${gold_schema}` → actual schema
3. Generate UUIDs for all ID fields (`uuid.uuid4().hex`)
4. Sort all arrays (tables by `table_name`, TVFs by `function_name`, etc.)
5. Serialize as `json.dumps()` for the `serialized_space` field
6. Call Create or PATCH API (update-or-create pattern)
7. Verify with GET API

**Key constraint:** After this checkpoint passes, the Genie Space is live and queryable — required before running Genie Optimization (Step 25).',
'## Expected Deliverables

### ✅ Deployment Verification

**TVFs:**
- [ ] All TVFs created in `{lakehouse_default_catalog}.{user_schema_prefix}_gold` schema
- [ ] DATE parameters use STRING type (non-negotiable for Genie)
- [ ] v3.0 bullet-point COMMENTs applied
- [ ] TVF execution returns expected results

**Metric Views:**
- [ ] Created with `WITH METRICS LANGUAGE YAML` syntax
- [ ] `table_type = ''METRIC_VIEW''` in `information_schema.tables`
- [ ] `MEASURE()` queries return correct aggregations
- [ ] 3-5 synonyms per dimension/measure

**AI/BI Dashboard:**
- [ ] `.lvdash.json` deployed via Workspace Import API
- [ ] Dashboard renders correctly in Databricks UI
- [ ] Widget-query alignment verified (fieldName matches SQL alias)
- [ ] 6-column grid layout correct

**Genie Space:**
- [ ] Genie Space accessible in Databricks UI
- [ ] Uses Serverless SQL Warehouse (non-negotiable)
- [ ] Data assets include Metric Views, TVFs, and Gold tables
- [ ] General Instructions present (≤ 20 lines)
- [ ] ≥ 10 benchmark questions with expected SQL
- [ ] Natural language queries produce correct SQL
- [ ] JSON export saved for CI/CD (`genie_space_config.json`)

**End-to-End:**
- [ ] All 4 components deployed and functional
- [ ] Variable substitution working (`${catalog}`, `${gold_schema}`)
- [ ] Ready for Genie Optimization (Step 25)',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 25: Optimize Genie - bypass_LLM = TRUE, step_enabled = FALSE (hidden by default)
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, step_enabled, version, is_active, inserted_at, updated_at, created_by)
VALUES
(118, 'optimize_genie',
'Optimize your Genie Space for production accuracy using @data_product_accelerator/skills/semantic-layer/05-genie-optimization-orchestrator/SKILL.md

This orchestrator runs a systematic **benchmark → evaluate → optimize → apply → re-evaluate** loop with 4 specialized workers and MLflow experiment tracking.

## Optimization Loop

The orchestrator executes up to **5 iterations**, applying 6 control levers in priority order until all quality targets are met:

### Phase 1: Baseline Evaluation
1. Snapshot current Genie Space metadata (instructions, assets, benchmarks)
2. Create MLflow LoggedModel for the Genie Space
3. Run the **Benchmark Generator** — create/validate benchmark dataset with ≥ 10 questions and ground-truth SQL
4. Run the **Benchmark Evaluator** — evaluate all benchmarks using 8 quality scorers via `mlflow.genai.evaluate()`
5. Record baseline scores as iteration 0

### Phase 2: Per-Lever Optimization (Levers 1→5)
For each control lever in priority order:
1. Run the **Metadata Optimizer** — analyze evaluation results and propose metadata changes for the current lever
2. Run the **Optimization Applier** — apply proposals with **dual persistence** (Genie API + repo files)
3. Wait 30 seconds for Genie to pick up changes
4. Run slice evaluation (affected benchmarks only)
5. If slice passes → run P0 gate (full evaluation)
6. If P0 fails → **rollback** and move to next lever

### Phase 3: GEPA (Lever 6) — Only if Still Below Target
- General-Purpose Architecture changes (add/remove data assets, restructure instructions)
- Applied ONLY after Levers 1-5 have been attempted
- Requires dual persistence verification (`git diff`)

### Phase 4: Deploy and Verify
- Promote best model iteration
- Run held-out evaluation (benchmarks not seen during optimization)
- Post-deploy verification

## 6 Control Levers (Priority Order)

| Lever | Target | What Gets Changed |
|-------|--------|-------------------|
| **1: UC Metadata** | Column/table COMMENTs, tags | Add synonyms, clarify ambiguous columns |
| **2: Metric Views** | YAML definitions, measures | Add missing measures, fix aggregation logic |
| **3: TVFs** | Function signatures, COMMENTs | Fix parameter types, improve BEST FOR guidance |
| **4: Monitoring Tables** | DQ metrics, freshness views | Add monitoring assets to Genie Space |
| **5: ML Tables** | Feature tables, predictions | Add ML outputs as Genie data assets |
| **6: GEPA** | Instructions, data assets | Restructure Genie Space architecture |

## 8 Quality Targets

| Scorer | Target | What It Measures |
|--------|--------|-----------------|
| **Syntax Correctness** | ≥ 98% | Generated SQL parses without errors |
| **Schema Accuracy** | ≥ 95% | All tables/columns exist in the catalog |
| **Logical Correctness** | ≥ 90% | SQL logic matches the question intent |
| **Semantic Equivalence** | ≥ 90% | Results equivalent to ground-truth SQL |
| **Completeness** | ≥ 90% | All requested dimensions/measures present |
| **Result Correctness** | ≥ 85% | Actual query results match expected values |
| **Asset Routing** | ≥ 95% | Genie uses the right table/view/TVF |
| **Repeatability** | ≥ 90% | Same question → same SQL on repeated runs |

Target catalog: `{lakehouse_default_catalog}`
Gold schema: `{user_schema_prefix}_gold`',
'',
'Optimize Genie Space (Benchmark-Driven)',
'Systematically optimize Genie Space accuracy using 4 workers, 8 quality scorers, 6 control levers, and MLflow experiment tracking',
25,
'## 1️⃣ How To Apply

Copy the prompt from the **Prompt** tab, start a **new Agent chat** in your IDE, paste it, and press Enter.

---

### Prerequisite

**Run this in your cloned Template Repository** (see Prerequisites in Step 0).

Ensure you have:
- ✅ Semantic Layer Deployment Checkpoint passed (Step 24) — Genie Space live and queryable
- ✅ Gold layer tables populated with data
- ✅ Serverless SQL Warehouse running
- ✅ Databricks CLI authenticated (profile resolved from `databricks.yml` → `workspace.profile`)
- ✅ MLflow access configured (`DATABRICKS_HOST`, `DATABRICKS_TOKEN`, `MLFLOW_TRACKING_URI=databricks`)

**Critical:** The Genie Space MUST be live and queryable before running optimization. This step runs ONLY after the Semantic Layer Deployment Checkpoint (Step 24) has passed.

---

### Steps to Apply

**Step 1: Start New Agent Thread** — Open Cursor and start a new Agent thread for clean context.

**Step 2: Copy and Paste the Prompt** — Use the copy button, paste it into Cursor. The AI reads the Genie Optimization Orchestrator skill which automatically loads 4 worker skills.

**Step 3: Phase 1 — Baseline** — The AI:
1. Snapshots current Genie Space metadata
2. Creates MLflow experiment under `/Users/<your-email>/`
3. Creates LoggedModel for the Genie Space
4. Runs **Benchmark Generator** — creates/validates ≥ 10 benchmark questions with ground-truth SQL
5. Runs **Benchmark Evaluator** — 8 scorers via `mlflow.genai.evaluate(model_id=...)`, records baseline

**Step 4: Phase 2 — Per-Lever Optimization** — For each lever (1→5):
1. **Metadata Optimizer** analyzes evaluation results, proposes changes for current lever
2. **Optimization Applier** applies with dual persistence (API + repo), waits 30s
3. Slice evaluation on affected benchmarks
4. P0 gate (full evaluation) — if fails, rollback and try next lever

**Step 5: Phase 3 — GEPA (if needed)** — Lever 6 applied only if still below target after Levers 1-5.

**Step 6: Phase 4 — Deploy and Verify** — Promote best model, held-out evaluation, post-deploy check.

**Step 7: Review Results** — Check MLflow experiment for iteration scores, view `optimization-progress.json` for session state.

---

## 2️⃣ What Are We Building?

A **production-ready Genie Space** that consistently generates accurate SQL from natural language queries, verified by systematic benchmark evaluation.

### Optimization Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GENIE OPTIMIZATION LOOP                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  PHASE 1: BASELINE                                                   │   │
│  │  Snapshot → LoggedModel → Benchmark Generator → Evaluator (iter 0)  │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 ↓                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  PHASE 2: PER-LEVER OPTIMIZATION (max 5 iterations)                 │   │
│  │                                                                     │   │
│  │  For lever = 1 → 5:                                                 │   │
│  │    Metadata Optimizer → Optimization Applier → wait 30s             │   │
│  │         ↓                                                           │   │
│  │    Slice eval → P0 gate → if fail: rollback, next lever            │   │
│  │                         → if pass: check all targets                │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 ↓                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  PHASE 3: GEPA (Lever 6) — only if still below target              │   │
│  │  Architecture-level changes with dual persistence verification     │   │
│  └──────────────────────────────┬──────────────────────────────────────┘   │
│                                 ↓                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  PHASE 4: DEPLOY & VERIFY                                           │   │
│  │  Promote best model → held-out eval → post-deploy check            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  MLflow Tracking: Every evaluation logged │ Session: optimization-progress │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4 Worker Skills (Loaded by Orchestrator)

| Worker | Path | Purpose |
|--------|------|---------|
| **01-genie-benchmark-generator** | `data_product_accelerator/skills/semantic-layer/genie-optimization-workers/01-*/SKILL.md` | Create/validate benchmarks, sync to MLflow dataset |
| **02-genie-benchmark-evaluator** | `data_product_accelerator/skills/semantic-layer/genie-optimization-workers/02-*/SKILL.md` | 8 scorers via `mlflow.genai.evaluate()`, eval scopes (full/slice/P0/held-out) |
| **03-genie-metadata-optimizer** | `data_product_accelerator/skills/semantic-layer/genie-optimization-workers/03-*/SKILL.md` | Lever-aware analysis (L1-L5: targeted, L6: GEPA), 6 control levers |
| **04-genie-optimization-applier** | `data_product_accelerator/skills/semantic-layer/genie-optimization-workers/04-*/SKILL.md` | Apply proposals with dual persistence (Genie API + repo files) |

### Dual Persistence (Non-Negotiable)

Every metadata change must be applied to BOTH:
1. **Genie API** — live Genie Space updated via PATCH/Create API
2. **Repo files** — `genie_space_config.json` and source SQL files updated

Verify with `git diff` after each apply. If either persistence fails, the optimization is incomplete.

---

## 3️⃣ Why Are We Building It This Way? (Databricks Best Practices)

| Practice | How It''''s Used Here |
|----------|-------------------|
| **MLflow Experiment Tracking** | Every evaluation iteration logged to MLflow with model_id, scores, and metadata — enables comparison across iterations |
| **LoggedModel per Genie Space** | `mlflow.genai.evaluate(model_id=...)` ties evaluations to a specific Genie Space version |
| **8 Quality Scorers** | Comprehensive evaluation: syntax, schema, logic, semantics, completeness, results, asset routing, repeatability |
| **6 Control Levers in Priority Order** | Levers 1→5 applied sequentially (targeted fixes first), Lever 6 (GEPA) only as last resort |
| **Dual Persistence** | Changes applied to BOTH Genie API (live) and repo files (version-controlled) — prevents drift |
| **Slice → P0 → Held-Out Evaluation** | Slice eval (affected benchmarks) → P0 gate (full suite) → held-out (unseen benchmarks) — prevents overfitting |
| **Rollback on Regression** | If P0 gate fails after applying a lever, changes are rolled back before trying the next lever |
| **SQL Sanitization** | All Genie SQL processed through `sanitize_sql()` before `EXPLAIN` or `spark.sql()` — handles multi-statement, comments, markdown |
| **Ground-Truth Variable Resolution** | `${catalog}` / `${gold_schema}` in ground-truth SQL resolved via `resolve_sql()` before execution |
| **Max 5 Iterations** | Hard limit prevents infinite optimization loops — escalate with context if targets not met |

---

## 4️⃣ What Happens Behind the Scenes?

When you paste the prompt, the AI reads `@data_product_accelerator/skills/semantic-layer/05-genie-optimization-orchestrator/SKILL.md` — the **Genie Optimization Orchestrator**. Behind the scenes:

1. **CLI profile resolution** — resolves Databricks profile from `databricks.yml` → `workspace.profile` before any API call
2. **MLflow setup** — creates experiment under `/Users/<email>/`, registers judge prompts to MLflow Prompt Registry
3. **Worker routing table** — mandatory routing; every worker invocation reads its SKILL.md
4. **Session state** — persisted in `optimization-progress.json` and MLflow experiment tags; enables resume after interruption
5. **Lever-aware optimization** — Metadata Optimizer receives the current lever number and only proposes changes within that lever''''s scope
6. **GEPA (Lever 6)** — General-Purpose Architecture changes applied ONLY after Levers 1-5; includes add/remove data assets and instruction restructuring
7. **Dual persistence verification** — after every apply, verifies both API success AND `git diff` shows expected repo changes

**Key constraint:** The orchestrator MUST start with the Benchmark Generator (never skip to Evaluator) and MUST create a LoggedModel before the first evaluation.',
'## Expected Deliverables

### ✅ Optimization Results

**MLflow Tracking:**
- [ ] MLflow experiment created under `/Users/<email>/`
- [ ] LoggedModel created for the Genie Space
- [ ] Baseline evaluation logged (iteration 0)
- [ ] Each lever iteration logged with scores

**Quality Targets (all must pass):**
- [ ] Syntax Correctness ≥ 98%
- [ ] Schema Accuracy ≥ 95%
- [ ] Logical Correctness ≥ 90%
- [ ] Semantic Equivalence ≥ 90%
- [ ] Completeness ≥ 90%
- [ ] Result Correctness ≥ 85%
- [ ] Asset Routing ≥ 95%
- [ ] Repeatability ≥ 90%

**Dual Persistence:**
- [ ] Genie API updated with optimized metadata
- [ ] Repo files updated (`genie_space_config.json`, source SQL)
- [ ] `git diff` confirms expected changes

**Session State:**
- [ ] `optimization-progress.json` records all iterations
- [ ] Best model iteration identified and promoted
- [ ] Held-out evaluation passes (unseen benchmarks)

**Optimization Report:**
- [ ] Summary of levers applied and their impact
- [ ] Before/after scores for each quality dimension
- [ ] Remaining known limitations (if any)
- [ ] Recommendations for future optimization cycles',
true, false, 1, true, current_timestamp(), current_timestamp(), current_user());

-- =============================================================================
-- AGENT SKILLS ACCELERATOR (Steps 26-30)
-- =============================================================================
-- Step 26: Explore Existing Skills (bypass_llm = true)
-- Step 27: Define Contract Strategy (bypass_llm = false)
-- Step 28: Create SKILL.md (bypass_llm = false)
-- Step 29: Apply Contract Tags (bypass_llm = true)
-- Step 30: Certify & Validate (bypass_llm = true)
-- =============================================================================

-- Step 26: Explore Existing Skills
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(130, 'skill_install_explore',
'## Step 1: Explore Existing Skills in Your Template Repository

Now that you have cloned the workshop template repository (from Step 2), let''s explore the existing Agent Skills that ship with it and identify the gap your new skill will fill.

### Your Use Case: {use_case_title}
{use_case_description}

### Navigate to the Skills Directory

Open your cloned repository and explore these two key skills:

```
data_product_accelerator/skills/common/naming-tagging-standards/SKILL.md
data_product_accelerator/skills/admin/create-agent-skill/SKILL.md
```

### What to Look For

**In `naming-tagging-standards/SKILL.md`:**
- How tags are defined (naming conventions, owner, domain)
- The SET TAGS SQL patterns used
- What governance tags are currently covered
- What capabilities are **missing** that your use case requires

**In `create-agent-skill/SKILL.md`:**
- The standard folder structure for new skills (SKILL.md, assets/, references/)
- How instructions are organized as numbered steps
- How references and assets are declared
- The agentskills.io specification patterns

### Identify the Gap

Review the **Measures / Rules** and **Extends** sections from your use case description above. The existing skills provide a foundation, but they do **not** address the specific capabilities your new skill needs.

### Your Target Assets

{gold_table_target}

### Deliverables

After exploring, you should understand:
- [ ] How existing skills are structured (SKILL.md + references/ + assets/)
- [ ] What the existing skills already cover
- [ ] What specific gap your new skill ({use_case_title}) will fill
- [ ] Which target assets (tables, schemas) you will work with',
'',
'Explore Existing Skills',
'Navigate the template repo skills and identify the gap your new skill will fill',
26,
'## How to Apply

1. Open your cloned workshop template repository in Cursor/VS Code
2. Navigate to `data_product_accelerator/skills/common/naming-tagging-standards/SKILL.md`
3. Read through the existing tagging patterns and note what governance capabilities exist
4. Navigate to `data_product_accelerator/skills/admin/create-agent-skill/SKILL.md`
5. Study the skill creation template and folder structure
6. Compare what exists against the **Measures / Rules** in your use case description
7. Note which capabilities are missing — this is the gap your new skill will fill
8. Confirm your target assets for use in subsequent steps',
'## Expected Output

After exploring, you should have:

### Understanding Checklist
- [ ] Read `naming-tagging-standards/SKILL.md` and noted existing patterns
- [ ] Read `create-agent-skill/SKILL.md` and understood the skill template structure
- [ ] Identified the specific gap your new skill will address
- [ ] Confirmed your target assets

### Key Observations
- The existing naming-tagging skill uses `ALTER TABLE ... SET TAGS` syntax
- Skills follow a standard structure: SKILL.md + assets/ + references/
- The `create-agent-skill` template provides the scaffolding for new skills
- Your use case describes capabilities not covered by existing skills',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 27: Define Skill Strategy
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(131, 'skill_define_strategy',
'Generate a comprehensive **Skill Strategy** document for the **{use_case_title}** skill in a {industry_name} data platform.

## Use Case Specification
{use_case_description}

## Target Assets
{gold_table_target}

## Exploration Findings (from previous step)
{exploration_findings}

## Requirements

Using the **Measures / Rules**, **Validation Approach**, and **Certification Criteria** sections from the use case specification above, generate a complete strategy document that covers:

### 1. Measures & Rules
For each measure/rule defined in the use case specification:
- **Tag key** and **value format** (with examples)
- **Description** of what it enforces
- **Default value** for new assets

### 2. Validation SQL
For each measure, provide a SQL query that validates compliance. The SQL should:
- Query `system.information_schema` or the target asset itself
- Return a boolean pass/fail result
- Be parameterizable for any table/asset name

### 3. Success / Certification Criteria
Define the rules from the use case specification for when an asset is considered compliant:
- Which measures must pass
- Grace periods for newly created assets
- What happens when compliance fails

### 4. Scheduling & Automation Recommendations
- How often should validation run?
- Should it run as a Databricks Job or Lakehouse Monitor?
- Alert/notification strategy for failures

## Output Format
Structure the strategy as a clear, actionable document with sections for each area above. Use code blocks for SQL examples. Tailor all content to the specific use case described above.',
'You are an expert in Databricks data governance, Unity Catalog, and data quality best practices. Generate a comprehensive skill strategy based on the provided use case specification. The strategy should define measures as Unity Catalog tags, provide validation SQL for each measure, and specify success/certification criteria. The strategy should be practical, follow Databricks best practices, and be ready to implement as an Agent Skill following the agentskills.io standard.',
'Define Skill Strategy',
'Generate a comprehensive strategy for your Agent Skill based on your use case specification',
27, '', '', false, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 28: Create SKILL.md
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(132, 'skill_create_skillmd',
'Generate a complete **Agent Skill package** for **{use_case_title}**, following the agentskills.io SKILL.md standard.

## Use Case Specification
{use_case_description}

## Skill Strategy (from previous step)
{skill_strategy}

## Target Assets
{gold_table_target}

## Requirements

Using the **Skill Identity** and **Skill Artifacts** sections from the use case specification, plus the detailed strategy from the previous step, generate a complete Agent Skill package.

### File 1: `<skill-name>/SKILL.md`

The primary skill file following the agentskills.io standard with:
- **Name**: from the Skill Identity section
- **Description**: One-line summary of what the skill does
- **Triggers**: from the Skill Identity section — when should this skill activate
- **Instructions**: Numbered step-by-step instructions the AI agent should follow, derived from the strategy
- **References**: List any reference files
- **Assets**: List any asset files (configs, templates)

### File 2: `<skill-name>/references/<reference-doc>.md`

A reference document containing:
- Validation or execution patterns (SQL, code, etc.) from the strategy
- Example outputs showing pass/fail or expected results
- Parameterized patterns that work with any target asset name

### File 3: `<skill-name>/assets/<config-file>.yaml`

A YAML configuration file defining:
- All measures/rules with their keys, value formats, and defaults
- Success/certification criteria
- Scheduling or automation defaults
- Asset filter patterns (which tables/objects to include/exclude)

## Output Format
Generate all files with clear file path headers. Use proper markdown for SKILL.md, standard markdown for the reference doc, and valid YAML for the config file. Derive all file names, folder names, and content from the use case specification.',
'You are an expert Agent Skills author following the agentskills.io specification. Generate a complete, production-ready Agent Skill package based on the provided use case specification and skill strategy. The SKILL.md must be clear, actionable, and follow the standard structure. All patterns must use real Databricks SQL syntax where applicable. Config files must be valid YAML. Derive the skill name, folder structure, and all content from the use case specification.',
'Create SKILL.md',
'Generate the complete SKILL.md package with references and assets based on your skill strategy',
28, '', '', false, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 29: Apply & Test Skill
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(133, 'skill_apply_contracts',
'## Step 4: Apply & Test Your New Skill

Now that you have your complete Agent Skill package (SKILL.md + references + assets), it''s time to save it to your project and test it against your target assets.

### Your Use Case: {use_case_title}

### Save the Skill to Your Project

Copy the generated files into your project using the folder structure from the SKILL.md output:

```
data_product_accelerator/skills/common/<your-skill-name>/
├── SKILL.md
├── references/
│   └── <reference-doc>.md
└── assets/
    └── <config-file>.yaml
```

Use the exact file names and folder structure from the previous step''s output.

### Test the Skill

Ask your AI assistant to use the new skill against your target assets:

Target: **{gold_table_target}**

**IMPORTANT: These are EXISTING gold-layer tables. Do NOT create new schemas or tables. Your skill should read and apply governance to the tables already in this schema.**

For example, ask:
> "Use the <skill-name> skill to apply [your measures/rules] to the existing tables in my target schema"

### Verify the Results

After the agent executes the skill, verify the results. For Unity Catalog tags:

```sql
SHOW TAGS ON TABLE <catalog>.<schema>.<table_name>;
```

For other asset types, use the verification approach described in your use case specification.

### Deliverables

- [ ] All skill files saved to the correct folder structure
- [ ] Skill applied to at least one target asset
- [ ] Results verified using the appropriate verification method
- [ ] No errors during skill execution',
'',
'Apply & Test Skill',
'Save your generated skill to the project and test it against your target assets',
29,
'## How to Apply

1. Create the skill folder structure in your project:
   ```
   data_product_accelerator/skills/common/<your-skill-name>/
   ```
2. Save all generated files (SKILL.md, references, assets) from the previous step
3. Open your AI assistant (Cursor) and ask it to use the new skill
4. Review the commands/queries the agent generates
5. Verify the results were applied correctly',
'## Expected Output

### Applied Results
Your target assets should now have the measures/rules applied as defined in your skill strategy.

### Verification
Run the appropriate verification query or check for your use case:
```sql
-- For Unity Catalog tags:
SHOW TAGS ON TABLE <catalog>.<schema>.<table_name>;
```

### File Structure
Confirm your skill folder matches the expected structure from your SKILL.md output.',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Step 30: Validate & Automate
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(134, 'skill_certify_tables',
'## Step 5: Build a Validation & Automation Pipeline

The final step is to automate the validation and compliance workflow for your **{use_case_title}** skill so it runs continuously.

### What to Build

**IMPORTANT: The target assets below are EXISTING gold-layer tables. Do NOT create new schemas or tables. Your validation should query the tables already in this schema.**

Ask your AI assistant to create two files:

#### 1. Validation Notebook: `skill_validator.py`

A Databricks notebook that:
- Lists all target assets ({gold_table_target})
- For each asset, reads its current tags/state via the appropriate method
- Runs the validation checks from your skill''s reference document
- Collects pass/fail results for each measure/rule
- Updates the asset''s status based on results (e.g., applies or removes compliance tags)
- Outputs a summary report of which assets passed/failed and why

Use the **Validation Approach** and **Certification Criteria** from your use case specification to drive the logic.

#### 2. Job Configuration: `skill_validation_job.yml`

A Databricks Asset Bundle (DAB) job YAML that:
- Runs `skill_validator.py` on a schedule (from the use case specification''s scheduling recommendations)
- Uses the default SQL warehouse: `{default_warehouse}`
- Sends email alerts on failure
- Tags the job with a descriptive purpose tag

### Running the Validation

After creating the files:
1. Deploy using `databricks bundle deploy`
2. Run the validation job manually first: `databricks bundle run skill_validation_job`
3. Check the results in the notebook output
4. Verify the compliance status on your target assets

### Deliverables

- [ ] `skill_validator.py` notebook created and tested
- [ ] `skill_validation_job.yml` DAB config created
- [ ] Validation job deployed and run successfully
- [ ] At least one target asset shows the expected compliance status
- [ ] Summary report showing pass/fail results
- [ ] Job scheduled for recurring validation',
'',
'Validate & Automate',
'Build a validation notebook and scheduled job to automate compliance checking for your skill',
30,
'## How to Apply

1. Ask your AI assistant to create `skill_validator.py` using the validation patterns from your skill''s reference document
2. Ask it to create `skill_validation_job.yml` for scheduled execution
3. Deploy with `databricks bundle deploy`
4. Run the job: `databricks bundle run skill_validation_job`
5. Check the output notebook for validation results
6. Verify the compliance status on your target assets',
'## Expected Output

### Validation Results (example)
```
Asset                    | Measures Pass | Status
-------------------------|---------------|----------
asset_1                  | 6/6           | COMPLIANT
asset_2                  | 6/6           | COMPLIANT
asset_3                  | 5/6           | FAILED
asset_4                  | 6/6           | COMPLIANT
```

### Files Created
- [ ] `skill_validator.py` -- Validation notebook
- [ ] `skill_validation_job.yml` -- DAB job config
- [ ] Job deployed and running on schedule',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- =============================================================================
-- Clean Up (Step 31) - Workspace Clean Up - bypass_LLM = TRUE
-- =============================================================================
-- Generates a comprehensive cleanup prompt the user copies into their AI coding
-- assistant to safely delete all Databricks resources created during the workshop.
-- =============================================================================
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(140, 'workspace_cleanup',
'Clean up all Databricks resources created during the Vibe Coding Workshop. Delete every resource safely — if it exists, delete it; if it does not exist, skip it and move on. Never fail on a missing resource.

---

## Workspace Context

- **Workspace URL**: {workspace_url}
- **User App Name**: {user_app_name}
- **Lakebase Project/Instance**: {lakebase_instance_name}
- **Lakebase UC Catalog**: {lakebase_uc_catalog_name}
- **Lakehouse Catalog**: {lakehouse_default_catalog}
- **User Schema Prefix**: {user_schema_prefix}
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
Delete all Databricks jobs whose name contains `{user_schema_prefix}` or that are tagged with `project=vibe_coding_workshop`.

```bash
# List matching jobs
databricks jobs list --output json | python3 -c "
import sys, json
jobs = json.load(sys.stdin).get(''jobs'', [])
for j in jobs:
    name = j.get(''settings'', {}).get(''name'', '''')
    tags = j.get(''settings'', {}).get(''tags'', {})
    if ''{user_schema_prefix}'' in name or tags.get(''project'') == ''vibe_coding_workshop'':
        print(f\"Job {j[''job_id'']}: {name}\")
"

# Delete each matching job
databricks jobs delete --job-id <JOB_ID>
```

### Phase 2: AI/BI Dashboards
Delete Lakeview dashboards owned by `{created_by}` or whose name contains `{user_schema_prefix}`.

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
Delete any model serving endpoints whose name contains `{user_schema_prefix}` or that were created for the workshop agent.

```bash
# List serving endpoints
databricks serving-endpoints list --output json

# Delete matching endpoint
databricks serving-endpoints delete <ENDPOINT_NAME>
```

### Phase 5: Lakehouse Schemas (Bronze / Silver / Gold)
Drop the three medallion schemas from Unity Catalog. Use CASCADE to remove all tables and views within them.

```sql
DROP SCHEMA IF EXISTS `{lakehouse_default_catalog}`.`{user_schema_prefix}_bronze` CASCADE;
DROP SCHEMA IF EXISTS `{lakehouse_default_catalog}`.`{user_schema_prefix}_silver` CASCADE;
DROP SCHEMA IF EXISTS `{lakehouse_default_catalog}`.`{user_schema_prefix}_gold` CASCADE;
```

Run via CLI:
```bash
databricks sql execute --warehouse-id <WAREHOUSE_ID> --statement "DROP SCHEMA IF EXISTS \`{lakehouse_default_catalog}\`.\`{user_schema_prefix}_bronze\` CASCADE"
databricks sql execute --warehouse-id <WAREHOUSE_ID> --statement "DROP SCHEMA IF EXISTS \`{lakehouse_default_catalog}\`.\`{user_schema_prefix}_silver\` CASCADE"
databricks sql execute --warehouse-id <WAREHOUSE_ID> --statement "DROP SCHEMA IF EXISTS \`{lakehouse_default_catalog}\`.\`{user_schema_prefix}_gold\` CASCADE"
```

### Phase 6: Lakebase Unity Catalog Registration
Drop the UC database catalog that was created when registering Lakebase in Unity Catalog (Step 9).

```bash
databricks sql execute --warehouse-id <WAREHOUSE_ID> --statement "DROP CATALOG IF EXISTS \`{lakebase_uc_catalog_name}\` CASCADE"
```

Or via CLI:
```bash
databricks unity-catalog catalogs delete {lakebase_uc_catalog_name} --force
```

### Phase 7: Lakebase Project / Schema

**IMPORTANT**: The behavior here depends on the Lakebase mode.

**Autoscaling mode** — the workshop created a dedicated Lakebase project, so it is safe to delete the entire project:
```bash
databricks postgres delete-project --project-id {lakebase_instance_name}
```

**Provisioned mode** — the workshop uses a **shared** Lakebase instance and only created a schema inside it. **DO NOT delete the instance** — other users may be sharing it. Only drop the workshop schema:
```bash
# Drop the workshop schema from the shared Lakebase instance (provisioned mode only)
# Connect to the Lakebase PostgreSQL instance and run:
DROP SCHEMA IF EXISTS {user_schema_prefix} CASCADE;
```
If unsure which mode was used, check `user-config.yaml` for `lakebase.mode` (`autoscaling` or `provisioned`). When in doubt, only drop the schema — never delete the instance.

### Phase 8: Databricks App
Stop and delete the user''s deployed Databricks App.

```bash
# Stop the app first (ignore error if already stopped)
databricks apps stop {user_app_name} || true

# Delete the app
databricks apps delete {user_app_name}
```

### Phase 9: Databricks Asset Bundle (DAB)
If you are inside the user''s cloned template repository, destroy the DAB bundle to remove any remaining workspace files.

```bash
databricks bundle destroy --auto-approve
```

### Phase 10: Skill Validation Assets (if Agent Skills track was used)
Delete the skill validation job and notebook if they exist.

```bash
# Find and delete skill_validation_job
databricks jobs list --output json | python3 -c "
import sys, json
jobs = json.load(sys.stdin).get(''jobs'', [])
for j in jobs:
    if ''skill_validation'' in j.get(''settings'', {}).get(''name'', '''').lower():
        print(j[''job_id''])
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
 Resource                        | Status
---------------------------------|---------------------------
 Jobs / Pipelines                | Deleted (3) / Skipped (0)
 AI/BI Dashboards                | Deleted (1) / Skipped (0)
 Genie Spaces                    | Deleted (1) / Skipped (0)
 Model Serving Endpoints         | Skipped (not found)
 Bronze Schema                   | Deleted
 Silver Schema                   | Deleted
 Gold Schema                     | Deleted
 Lakebase UC Catalog             | Deleted
 Lakebase Project                | Deleted
 Databricks App                  | Deleted
 DAB Bundle                      | Destroyed
 Skill Validation Assets         | Skipped (not found)
============================================================
 Total: 10 deleted, 2 skipped, 0 errors
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

Alternatively, execute the phases interactively one at a time using the Databricks CLI, confirming with the user between phases.',
'',
'Workspace Clean Up',
'Safely delete all Databricks resources created during the workshop',
31,
'## How to Apply

**Run this in your cloned Template Repository** (see Prerequisites in Step 0). These commands assume the Databricks CLI is authenticated and you are in the project root.

---

### Step 1: Copy the Generated Prompt
Copy the cleanup prompt into your AI coding assistant (Cursor or Copilot).

### Step 2: Review the Inventory
The assistant will first list all resources it finds that match the workshop naming patterns. Review the list carefully.

### Step 3: Confirm Deletion
Once you are satisfied the list is correct, confirm to proceed. The assistant will delete resources in dependency order.

### Step 4: Verify
Use the verification links to confirm resources have been removed:
- Check the **Apps** page — your app should no longer appear
- Check **Catalog Explorer** — Bronze, Silver, Gold schemas should be gone
- Check **Lakebase Projects** — your project should be removed
- Check **Jobs** — workshop-related jobs should be deleted

### Step 5: Optional — Destroy DAB Bundle
If you want to remove workspace-synced files as well:
```bash
databricks bundle destroy --auto-approve
```',
'## Expected Cleanup Results

### Resources Removed
- [ ] All workshop jobs and pipelines deleted
- [ ] AI/BI dashboards deleted
- [ ] Genie spaces deleted
- [ ] Agent serving endpoints deleted (if created)
- [ ] Bronze, Silver, Gold schemas dropped (CASCADE)
- [ ] Lakebase UC catalog dropped
- [ ] Lakebase project/instance deleted
- [ ] Databricks App stopped and deleted
- [ ] DAB bundle destroyed (workspace files removed)
- [ ] Skill validation assets deleted (if created)

### Verification
- [ ] Apps page shows no workshop app
- [ ] Catalog Explorer shows no workshop schemas
- [ ] Lakebase Projects page shows no workshop project
- [ ] Jobs page shows no workshop jobs',
true, 1, true, current_timestamp(), current_timestamp(), current_user());

-- Activation: Reverse ETL (Steps 32-36)
INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(141, 'activation_table_design',
'## Context from prior workshop steps

### Gold layer design
{gold_layer_design}

### Use-case plan
{usecase_plan}

### PRD
{prd_document}

---

## Your task

Plan which **Gold tables**, **Metric Views**, and **table-valued functions (TVFs)** to sync into **Lakebase PostgreSQL** using the Databricks **createSyncedTable** API.

Your plan must cover:

- **Scope** — list candidate Gold tables, Metric Views, and TVFs; prioritize what to sync for analytics serving
- **Primary keys** — identify or define stable primary keys for each synced object
- **Sync modes** — choose **snapshot**, **triggered**, or **continuous** sync per object and justify each choice
- **Data type compatibility** — note Databricks → PostgreSQL mapping issues and mitigations (casts, narrowed types, JSON or text fallbacks)
- **Dependencies** — creation order when objects depend on each other

Produce a concise sync plan suitable for implementation in the next step.',
'You are a data architect planning reverse ETL sync from Databricks Lakehouse to Lakebase PostgreSQL using Synced Tables.',
'Plan Synced Tables',
'Design which Gold assets to sync into Lakebase via createSyncedTable, including keys, modes, and types',
32,
'## How to apply

**Run this in your cloned Template Repository** (see Prerequisites in Step 0).

1. Complete prior steps so **Gold layer design**, **use-case plan**, and **PRD** content are available (placeholders are filled by the workshop UI).
2. Copy the prompt from the **Prompt** tab and paste it into Cursor or your AI coding assistant.
3. Review the generated sync plan against your actual Unity Catalog Gold schema and Lakebase project.
4. Save the plan (for example under `docs/`) for use in **Create Synced Tables**.',
'## Expected output

- [ ] List of Gold tables, Metric Views, and TVFs targeted for sync, with rationale
- [ ] Primary key (or surrogate key) strategy per synced object
- [ ] Sync mode (snapshot / triggered / continuous) per object with justification
- [ ] Data type mapping notes and risk mitigations
- [ ] Ordered implementation checklist for createSyncedTable calls',
false, 1, true, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(142, 'activation_reverse_sync',
'## Sync plan (from previous step)

{activation_table_design}

---

## Your task

Generate **executable** code and CLI commands to create **Synced Tables** using the **Databricks Python SDK** and **REST API (curl)** for each object in the sync plan.

### Supported sources

Synced tables support the following Unity Catalog source types:
- Managed and external **Delta tables**
- Managed and external **Iceberg tables**
- **Views** and **materialized views**

### Sync modes and CDF requirements

Choose the correct sync mode per the plan. CDF requirements differ by mode:

| Mode | Description | CDF required? | When to use |
|------|-------------|---------------|-------------|
| **Snapshot** | One-time full copy | No — also works with views and Iceberg tables | Source changes >10% of rows per cycle, or source does not support CDF |
| **Triggered** | Scheduled incremental updates | Yes | Source rows change on a known cadence; good cost/lag balance |
| **Continuous** | Real-time streaming (seconds of latency) | Yes | Changes must appear in Lakebase in near real time |

> **Workshop note:** Use **Snapshot** or **Triggered** mode for this workshop. Only use **Continuous** mode if explicitly requested by the workshop participant.

For **Triggered** or **Continuous** mode, enable CDF on the source Delta table first:

```sql
ALTER TABLE <catalog>.<schema>.<table>
SET TBLPROPERTIES (delta.enableChangeDataFeed = true)
```

### Requirements

1. **Create synced tables** — execute `createSyncedTable` for each object in the plan using the appropriate sync mode
2. **Use the correct `synced_table_id` format** — `catalog.schema.table` (the UC schema name becomes the Postgres schema name)
3. **Provide both Python SDK and REST API examples**:

   **Python SDK:**
   ```python
   from databricks.sdk import WorkspaceClient
   from databricks.sdk.service.postgres import (
       SyncedTable,
       SyncedTableSyncedTableSpec,
       SyncedTableSyncedTableSpecSyncedTableSchedulingPolicy,
   )

   w = WorkspaceClient()

   synced_table = w.postgres.create_synced_table(
       synced_table=SyncedTable(spec=SyncedTableSyncedTableSpec(
           source_table_full_name="<catalog>.<schema>.<gold_table>",
           project="projects/<lakebase-project>",
           branch="projects/<lakebase-project>/branches/main",
           primary_key_columns=["<primary_key_column>"],
           scheduling_policy=SyncedTableSyncedTableSpecSyncedTableSchedulingPolicy.TRIGGERED,
           postgres_database="<database>",
           create_database_objects_if_missing=True,
       )),
       synced_table_id="<catalog>.<schema>.<synced_table_name>",
   ).wait()

   print(f"Synced table created: {synced_table.name}")
   ```

   **REST API (curl):**
   ```bash
   curl -X POST "https://{workspace_url}/api/2.0/postgres/synced_tables?synced_table_id=<catalog>.<schema>.<synced_table_name>" \
     -H "Authorization: Bearer ${DATABRICKS_TOKEN}" \
     -H "Content-Type: application/json" \
     -d ''{"spec": {"source_table_full_name": "<catalog>.<schema>.<gold_table>", "project": "projects/<lakebase-project>", "branch": "projects/<lakebase-project>/branches/main", "primary_key_columns": ["<pk>"], "scheduling_policy": "TRIGGERED", "postgres_database": "<database>", "create_database_objects_if_missing": true}}''
   ```
   Note: the REST API returns a long-running operation — poll the returned `name` field until `done: true`.

4. **Check sync status** after creation:
   ```python
   table = w.postgres.get_synced_table("synced_tables/<catalog>.<schema>.<synced_table_name>")
   print(f"State: {table.status.detailed_state}")
   print(f"Last sync: {table.status.last_sync_time}")
   print(f"Message: {table.status.message}")
   ```

5. **Schedule subsequent syncs** (Snapshot and Triggered modes require explicit triggers after the initial sync):

   **Programmatic trigger:**
   ```python
   table = w.postgres.get_synced_table("synced_tables/<catalog>.<schema>.<synced_table_name>")
   pipeline_id = table.status.pipeline_id
   w.pipelines.start_update(pipeline_id=pipeline_id)
   ```

   **Lakeflow Jobs options:**
   - **Table update trigger** — fires when the source UC table is updated (ideal for Triggered mode)
   - **Scheduled trigger** — runs on a cron schedule (ideal for Snapshot mode with nightly/weekly refresh)

   Both use the **Database Table Sync pipeline** task type in Lakeflow Jobs.

6. **Verify data landed** — query the Postgres table:
   ```sql
   SELECT count(*) FROM <schema>.<synced_table_name>;
   ```

### Data type compatibility

Key Unity Catalog to Postgres type mappings:

| Source column type | Postgres column type |
|---|---|
| STRING | TEXT |
| INT | INTEGER |
| BIGINT | BIGINT |
| DOUBLE | DOUBLE PRECISION |
| FLOAT | REAL |
| DECIMAL(p,s) | NUMERIC |
| BOOLEAN | BOOLEAN |
| DATE | DATE |
| TIMESTAMP | TIMESTAMP WITH TIME ZONE |
| TIMESTAMP_NTZ | TIMESTAMP WITHOUT TIME ZONE |
| BINARY | BYTEA |
| ARRAY, MAP, STRUCT | JSONB |

**Unsupported types:** GEOGRAPHY, GEOMETRY, VARIANT, OBJECT.

**Invalid characters:** Null bytes (0x00) in STRING/ARRAY/MAP/STRUCT columns cause sync failures. Sanitize before syncing:
```sql
SELECT REPLACE(column_name, CAST(CHAR(0) AS STRING), '''''''') AS cleaned FROM your_table
```

### Capacity planning constraints

- Each synced table uses up to **16 connections** to the Lakebase database
- Total logical data limit: **8 TB** across all synced tables
- Database, schema, and table names: **alphanumeric and underscores only** (`[A-Za-z0-9_]+`)
- Schema evolution: only **additive changes** (e.g., adding columns) supported for Triggered and Continuous modes
- Throughput: ~150 rows/sec/CU (Triggered/Continuous), ~2,000 rows/sec/CU (Snapshot)

### References
- Docs: https://docs.databricks.com/aws/en/oltp/projects/sync-tables
- API: https://docs.databricks.com/api/workspace/postgres/createsyncedtable',
'You are a Databricks engineer implementing Synced Tables for reverse ETL using the Databricks Python SDK, REST API, or CLI. You understand all three sync modes (Snapshot, Triggered, Continuous) and their CDF requirements. You produce executable code with proper error handling, status checking, and scheduling configuration. You account for data type compatibility between Unity Catalog and Postgres and adhere to capacity planning constraints.',
'Create Synced Tables',
'Implement createSyncedTable with SDK and REST API, configure sync modes and CDF, verify pipelines, and schedule subsequent syncs',
33,
'## How to apply

**Run this in your cloned Template Repository** with the Databricks CLI authenticated.

1. Ensure **Plan Synced Tables** (Step 32) is complete and the sync plan is accurate.
2. Copy the prompt, paste into your AI assistant, and review generated scripts before running against production catalogs.
3. For each object in the sync plan, choose the correct sync mode:
   - **Snapshot** for one-time copies or sources without CDF support (views, Iceberg)
   - **Triggered** for scheduled incremental updates (enable CDF first)
   - **Continuous** for real-time streaming (enable CDF first)
4. Enable CDF on source Delta tables where required: `ALTER TABLE ... SET TBLPROPERTIES (delta.enableChangeDataFeed = true)`
5. Run `createSyncedTable` calls in dependency order per the plan.
6. After each creation, check sync status using `get_synced_table()` — confirm `detailed_state` shows sync completed and `last_sync_time` is populated.
7. Configure scheduling for subsequent syncs via Lakeflow Jobs (table update trigger or cron schedule) or programmatic trigger.
8. Verify data landed in Postgres: `SELECT count(*) FROM <schema>.<synced_table_name>;`
9. Monitor pipeline runs in the Databricks UI and fix failures before continuing to app design.',
'## Expected output

- [ ] Python SDK and curl examples that call createSyncedTable for each planned object with the correct sync mode
- [ ] CDF enabled on required source tables (ALTER TABLE commands documented)
- [ ] Status check commands confirming sync completed (detailed_state, last_sync_time)
- [ ] Scheduling configuration for subsequent syncs (Lakeflow Jobs or programmatic trigger)
- [ ] Data type compatibility confirmed — no unsupported types or invalid characters in source data
- [ ] Verification SQL showing row counts match between source tables and synced Lakebase tables
- [ ] Notes on capacity (connections, data size limits) and naming constraints',
false, 1, true, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(143, 'activation_app_design',
'## Context

### Sync plan (tables to activate)
{activation_table_design}

### Gold layer design
{gold_layer_design}

### PRD
{prd_document}

---

## Your task

Design the UI for an **analytics-serving Databricks App** powered by data **synced into Lakebase** from the Gold layer.

Focus on:

- **Dashboards** — layout of primary analytics pages
- **KPI visualizations** — headline metrics aligned with Gold entities and the use-case plan
- **Data exploration** — filters, drill-downs, and tabular views for analysts

If an app **already exists from Chapter 1**, specify **new analytics pages or routes** that **extend** it (do not replace working CRUD flows unless necessary).

Deliver wireframe-level descriptions, component hierarchy, and navigation. Implementation is a later step.',
'You are a UI/UX designer creating an analytics dashboard application powered by Lakebase synced data.',
'Design Analytics App',
'Design analytics dashboards and exploration UI on top of synced Lakebase data',
34,
'## How to apply

1. Review the **sync plan**, **Gold design**, and **PRD** so KPIs match stakeholder needs.
2. Copy the prompt into your AI assistant and iterate on information architecture before coding.
3. If Chapter 1 app exists, explicitly map **new** routes or pages vs existing ones.
4. Capture the design in `docs/` (for example `docs/analytics_ui_design.md`) for the build step.',
'## Expected output

- [ ] Page or route list for the analytics experience
- [ ] KPIs and charts specified per page with data sources (synced tables / views)
- [ ] Exploration patterns (filters, sort, detail panels) documented
- [ ] Clear note of extensions to an existing Chapter 1 app vs greenfield',
false, 1, true, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(144, 'activation_build_wire',
'## Context

### Analytics UI design
{activation_app_design}

### Sync plan
{activation_table_design}

---

## Your task

**Build and wire** the analytics experience:

- **FastAPI** — backend routes that read **synced Lakebase tables** using standard **PostgreSQL** queries via **psycopg** (or another approved driver for this repo)
- **React** — frontend components that match the design
- **End-to-end wiring** — request/response contracts, loading and error states, environment configuration for DB host and credentials

Follow the **existing Databricks App project layout** (for example `apps_lakebase/`) and reuse patterns from earlier chapters where possible.',
'You are a full-stack developer building a Databricks App that queries synced Lakebase tables.',
'Build & Wire App',
'FastAPI + React wired to Lakebase via PostgreSQL (psycopg)',
35,
'## How to apply

1. From the app root (for example `apps_lakebase/`), implement API routes that query synced tables only (no mock data in production paths).
2. Configure database URL or secrets per Databricks Apps / Lakebase documentation.
3. Connect UI components to the new endpoints and test locally before deploy.
4. Commit working code for the **Deploy & Validate** step.',
'## Expected output

- [ ] FastAPI routes with parameterized SQL against synced Lakebase tables
- [ ] React components matching the analytics design
- [ ] psycopg (or equivalent) connection handling and safe query patterns
- [ ] Local smoke test documented (curl or browser) for at least one KPI path',
false, 1, true, current_timestamp(), current_timestamp(), current_user());

INSERT INTO ${catalog}.${schema}.section_input_prompts 
(input_id, section_tag, input_template, system_prompt, section_title, section_description, order_number, how_to_apply, expected_output, bypass_llm, version, is_active, inserted_at, updated_at, created_by)
VALUES
(145, 'activation_deploy_validate',
'## Context

### Sync plan
{activation_table_design}

### Build artifacts
{activation_build_wire}

---

## Your task

**Deploy and validate** the reverse ETL analytics application end to end:

1. **Deploy** the app to **Databricks Apps** (asset bundle, CLI, or documented UI workflow)
2. **Configure sync schedules** using **Lakeflow Jobs** (or Databricks Jobs) so pipelines refresh on the intended cadence
3. **Validate data freshness** from Lakehouse → Lakebase → app: define checks that prove recent upstream changes appear in the UI
4. **Performance** — document how to verify **sub-10ms query latency** from the app to synced Lakebase tables (assumptions, warm connection pooling, measurement method, and where to read timings)

Produce a **runbook**: commands, configuration pointers, and pass/fail criteria.',
'You are a DevOps engineer deploying and validating a reverse ETL analytics application on Databricks.',
'Deploy & Validate',
'Deploy to Databricks Apps, schedule sync jobs, verify freshness and latency',
36,
'## How to apply

1. Deploy or update the app bundle; confirm the Apps URL serves the analytics UI.
2. Attach or verify Lakeflow / Jobs schedules for sync pipelines match SLAs.
3. Run the validation checklist after a controlled upstream change (or wait for a scheduled run).
4. Capture latency measurements using your chosen tool (logs, APM, or `EXPLAIN ANALYZE` patterns as appropriate for PostgreSQL).',
'## Expected output

- [ ] App live on Databricks Apps with correct environment and secrets
- [ ] Sync schedules documented and confirmed running
- [ ] Freshness checks passed (timestamps or row counts align with expectations)
- [ ] Latency validation documented with method and results toward sub-10ms read path from Lakebase',
false, 1, true, current_timestamp(), current_timestamp(), current_user());
