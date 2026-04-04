Build, deploy, and test the complete application using @data_product_accelerator/skills/common/databricks-autonomous-operations/SKILL.md for self-healing deployment and @data_product_accelerator/skills/common/databricks-asset-bundles/SKILL.md for DAB validation.

After deployment succeeds, document the entire repository using @data_product_accelerator/skills/admin/documentation-organization/SKILL.md in Framework Documentation Authoring mode.

---

## IMPORTANT: Analyze Current Project First

**This step uses your existing project deployment infrastructure.** Before deploying:

1. **Review the current project structure** to identify:
   - Deploy scripts (e.g., `deploy.sh`, `scripts/deploy.py`)
   - Build configurations (`package.json`, `tsconfig.json`)
   - DAB configuration (`databricks.yml`)
   - Environment configurations

Use the AI assistant to analyze the project:
```
@codebase What deploy scripts and configurations exist in this project? 
How do I build and deploy this application to Databricks?
```

---

## Deployment Process (Self-Healing Loop)

Follow the autonomous operations skill's core loop: **Deploy -> Poll -> Diagnose -> Fix -> Redeploy -> Verify** (max 3 iterations before escalation).

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

AppKit builds both server and client:
```bash
npm install
npm run build
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
databricks jobs get-run <RUN_ID> --output json | jq -r '.state.life_cycle_state'
# PENDING -> RUNNING -> TERMINATED

# When TERMINATED, check result:
databricks jobs get-run <RUN_ID> --output json | jq -r '.state.result_state'
# SUCCESS -> verify    FAILED -> diagnose
```

### Step 7: On Failure — Diagnose
```bash
# CRITICAL: Use TASK run_id, NOT parent job run_id
databricks jobs get-run <JOB_RUN_ID> --output json \
  | jq '.tasks[] | select(.state.result_state == "FAILED") | {task: .task_key, run_id: .run_id, error: .state.state_message}'

# Get detailed output for each failed task
databricks jobs get-run-output <TASK_RUN_ID> --output json \
  | jq -r '.notebook_output.result // .error // "No output"'
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
  | jq '.tasks[] | {task: .task_key, result: .state.result_state}'
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

This generates comprehensive project documentation under `docs/{project-name}-design/`.