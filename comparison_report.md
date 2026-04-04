# Prompt Comparison Report: main_br_prompts vs gen_prompts (Post-Rewrite)

Comparing main branch prompts with regenerated AppKit prompts after seed rewrites.
**Scope:** Steps 3–7 only. All AppKit-specific differences are excluded (TypeScript vs Python, `databricks apps deploy` vs `deploy.sh`, `server/server.ts` vs `routes.py`, `npm run dev` vs `python app.py`, AppKit plugin patterns, working directory differences, etc.).

---

## Step 3: PRD Generation — NO REMAINING GAPS

Both branches use the identical template (input_id 1). The only differences are variable substitutions (`{industry_name}`, `{use_case_description}`) which are user-specific. The template structure, instructions, and constraints are identical.

**Verdict: No changes needed.**

---

## Step 4b: UI Design (`cursor_copilot_ui_design`) — 2 MINOR ITEMS

### Previously Fixed (confirmed present):
- ✅ "Follow the existing project's framework, styling, and patterns" directive
- ✅ Config file validation with `grep -E "^name:" app.yaml`
- ✅ Expanded local testing with 4 numbered sub-steps
- ✅ Bold STOP condition: "Only proceed to the next step after local testing passes"

### Remaining Differences:

**1. databricks.yml validation (MINOR)**
- **Main says:** Update BOTH `app.yaml` AND `databricks.yml` with matching app names. Shows yaml examples for both files. Warns: "These files must have matching app names for deployment to work correctly."
- **AppKit says:** Update `app.yaml` name field + grep validation. No mention of `databricks.yml`.
- **Assessment:** In AppKit projects, `databricks.yml` manages the app name via DAB variables (`${var.app_name}`), so the user typically doesn't need to manually edit it. However, the user could benefit from a reminder to verify `databricks.yml` also has the correct name. **Borderline AppKit-specific** — the DAB variable pattern means manual editing is unnecessary.

**2. UI Design doc: "parent folder" clarification (TRIVIAL)**
- **Main says:** `@docs/ui_design.md` (parent folder at repo root)
- **AppKit says:** `@docs/ui_design.md`
- **Assessment:** AppKit projects store docs at root, so "parent folder" is unnecessary. **No action needed.**

**Verdict: No actionable gaps. The databricks.yml item is an AppKit architectural difference.**

---

## Step 4c: Deploy to Databricks App (`deploy_databricks_app`) — 2 MINOR ITEMS

### Previously Fixed (confirmed present):
- ✅ Frontend build verification (`dist/index.html`)
- ✅ Workspace app limit handling (find/delete stopped apps)
- ✅ "JSON Instead of Web UI" troubleshooting section

### Remaining Differences:

**1. Sync config validation (MINOR)**
- **Main says:** "Ensure `databricks.yml` sync config includes both `dist/**` AND `src/**` so the platform build succeeds."
- **AppKit says:** Nothing about sync config.
- **Assessment:** `databricks apps deploy` in AppKit handles syncing automatically. The `databricks.yml` sync config in the AppKit project already includes `dist/**` and `src/**`. This is a **valid preventive check** but unlikely to be an issue since the template already includes it.
- **Potential fix:** Add a note: "Verify `databricks.yml` sync config includes `dist/**` and `src/**`."

**2. Concrete endpoint examples in logs/errors (TRIVIAL)**
- **Main says:** Lists specific error messages like "No module named 'psycopg'" and "Could not import module"
- **AppKit says:** Lists AppKit-specific errors like `LAKEBASE_ENDPOINT is not set` and `ERR_MODULE_NOT_FOUND`
- **Assessment:** Different error sets are expected since the stacks differ. Both are appropriate. **No action needed.**

**Verdict: One minor preventive item (sync config validation). Low impact since the template already has correct sync config.**

---

## Step 5: Setup Lakebase (`setup_lakebase`) — 1 MINOR ITEM

### Previously Fixed (confirmed present):
- ✅ Explicit authentication step (`databricks auth login`)
- ✅ Connectivity verification (`databricks postgres get-endpoint ... | jq '.status.state'`)
- ✅ `{lakebase_mode}` note (autoscaling vs provisioned)
- ✅ Enhanced table verification (logs + local test + row count guidance)
- ✅ DDL guidelines (TEXT vs TEXT[], SERIAL, IF NOT EXISTS, CREATE SCHEMA)
- ✅ DML guidelines (escaping, FK integrity, ON CONFLICT DO NOTHING)

### Remaining Differences:

**1. Single-command table status check (MINOR)**
- **Main says:** `./scripts/setup-lakebase.sh --status` which shows per-table "✓ exists" with row counts in one command.
- **AppKit says:** 3-step verification: (1) check logs for DDL/DML messages, (2) verify via local test by hitting endpoints, (3) verify row counts via health/status endpoint or Deploy and Test step.
- **Assessment:** Main's approach gives instant, definitive verification in a single command. AppKit's approach is more distributed across multiple checks and partially deferred to the "Deploy and Test" step. The information is equivalent, but less consolidated.
- **Potential fix:** Add a concrete verification query example, e.g.: "After `npm run dev`, run `curl localhost:8000/api/<your-data-endpoint> | jq '.data | length'` to confirm row counts."

**Verdict: One minor item — verification is functional but less consolidated than main branch.**

---

## Step 6: Wire UI to Lakebase (`wire_ui_lakebase`) — NO REMAINING GAPS

### Previously Fixed (confirmed present):
- ✅ Service principal permission workflow (verify databricks_superuser role)
- ✅ INFO logging guidance (endpoint name, row count, errors)
- ✅ ConnectionStatus indicator component (Live Data / Mock Data / Warning)
- ✅ Data source tracking (`source: "live"` / `source: "mock"`)
- ✅ Defensive data handling ([], optional chaining, fallbacks)
- ✅ Connection resilience note (autoscaling cold starts)
- ✅ Expanded checklist (10 items vs main's 5)

### Remaining Differences:

**None.** The AppKit version is now MORE comprehensive than the main branch:
- 10-item checklist vs main's 5-item checklist
- Explicit "Part E: Connection Resilience Note" not in main (main has it in deploy step)
- Explicit "Part D: Defensive Data Handling" as a standalone section (main mentions it in Part C)

**Verdict: No changes needed. AppKit version is more comprehensive.**

---

## Step 7: Deploy and Test (`workspace_setup_deploy`) — 1 MINOR ITEM

### Previously Fixed (confirmed present):
- ✅ ConnectionStatus "Live Data" verification in UI check
- ✅ `source: "live"` field testing in API verification
- ✅ Specific log messages: "lakebase plugin initialized", "query executed", "rows returned"
- ✅ "Test fix locally first" before redeploying
- ✅ Workspace app limit handling
- ✅ Idle Connection Test

### Remaining Differences:

**1. Concrete API endpoint examples (MINOR/STYLISTIC)**
- **Main says:** `curl -s "$APP_URL/api/health/lakebase"`, `curl -s "$APP_URL/api/listings"`, `curl -s "$APP_URL/api/bookings"` — concrete endpoint names from the use case.
- **AppKit says:** `curl -s "$APP_URL/health"`, `curl -s -X POST "$APP_URL/api/analytics/query/<your-query-key>"`, `curl -s "$APP_URL/api/<your-custom-route>"` — generic placeholders.
- **Assessment:** Main's concrete examples are specific to the booking app use case and wouldn't generalize to other use cases. AppKit's placeholders are more reusable. This is a **design choice**, not a gap. The AppKit prompt correctly instructs users to test their actual routes.

**Verdict: No actionable gaps. The placeholder vs concrete example difference is intentional.**

---

## Summary

| Prompt | Status | Remaining Items |
|--------|--------|----------------|
| Step 3: PRD Generation | ✅ No gaps | None |
| Step 4b: UI Design | ✅ All fixed | databricks.yml validation (AppKit-specific) |
| Step 4c: Deploy App | ✅ All fixed | Sync config validation (low impact) |
| Step 5: Setup Lakebase | ✅ All fixed | Table verification less consolidated |
| Step 6: Wire UI | ✅ All fixed, now MORE comprehensive | None |
| Step 7: Deploy & Test | ✅ All fixed | Generic vs concrete endpoints (intentional) |

### Overall Assessment

The seed rewrites successfully closed **all major gaps** identified in the previous comparison. The 3 remaining items are all minor/low-impact:

1. **Sync config validation** in deploy_databricks_app — one-line preventive note
2. **Consolidated table verification** in setup_lakebase — a concrete curl example
3. **databricks.yml name validation** in UI design — borderline AppKit-specific

None of these would materially affect the workshop participant's experience. The Wire UI to Lakebase prompt is now significantly MORE comprehensive than the main branch version.
