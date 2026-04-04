## Your Task

You are a full-stack developer building a web application. Your goal is to **generate UI and backend API routes** from the PRD and **test locally**. This is a Databricks AppKit project — follow AppKit conventions (run `npx @databricks/appkit docs` for reference).

**Workspace:** `https://adb-4101016551133680.0.azuredatabricks.ne`

---

### Step 1: Authenticate and Derive App Name

```bash
databricks auth login --host https://adb-4101016551133680.0.azuredatabricks.ne

FIRSTNAME=$(databricks current-user me --output json | jq -r '.userName' | cut -d'@' -f1 | cut -d'.' -f1)
LASTINITIAL=$(databricks current-user me --output json | jq -r '.userName' | cut -d'@' -f1 | cut -d'.' -f2 | cut -c1)
USERNAME="${FIRSTNAME}-${LASTINITIAL}"
APP_NAME="${USERNAME}-booking-app"
EMAIL=$(databricks current-user me --output json | jq -r '.userName')
echo "App: $APP_NAME | Email: $EMAIL"
```

Update `app.yaml` name field to match `$APP_NAME`.

Verify the name matches:
```bash
grep -E "^name:" app.yaml
```
Confirm the output shows your app name. Mismatched names between `app.yaml` and what you deploy will break deployment.

---

### Step 2: Read the PRD

Review `@docs/design_prd.md` to understand:
- User personas and their needs
- Key user journeys (Happy Path only)
- Core features and requirements

---

### Step 3: Generate the UI

**Follow the existing project's framework, styling, and patterns.** Review the project structure before generating new code — reuse existing components, styles, and conventions wherever possible.

Create a **working web UI** under `client/src/` with:
- Key pages/views for primary user personas
- Components for core features (Happy Path only)
- Simple data display and forms for high-value user journeys

Use `@databricks/appkit-ui` components: `DataTable`, `Card`, `Badge`, `Button`, `Skeleton`, `Tabs`, `NavigationMenu`, `Alert`. Import from `@databricks/appkit-ui/react`.

Ensure `analytics()` is in your plugin list in `server/server.ts` if you need SQL warehouse queries.

---

### Step 4: Create Data Queries

**For analytical / read-only queries (SQL Warehouse):**

Create `.sql` files in `config/queries/` with `:paramName` placeholders and `-- @param` type annotations. Endpoints auto-mount at `/api/analytics/query/<key>`. Use `useAnalyticsQuery` hook with `useMemo` for parameters. Use `sql.string()`, `sql.date()`, `sql.number()` helpers from `@databricks/appkit-ui/js`. Always handle loading/error/empty states.

**For OLTP reads/writes (Lakebase — added later):**

Use `AppKit.lakebase.query()` in custom routes in `server/server.ts`. Access from frontend via `fetch("/api/your-route")`. This is wired up in the Setup Lakebase step.

---

### Step 5: Create Backend API Routes

Add custom API routes in `server/server.ts` for each UI feature that needs backend logic:

```typescript
import { createApp, server, analytics } from "@databricks/appkit";

const AppKit = await createApp({
  plugins: [server(), analytics()],
});

// Custom routes for CRUD operations (Lakebase queries added later)
AppKit.server.app.get("/api/items", async (req, res) => {
  // Placeholder data — will be replaced with AppKit.lakebase.query() in Setup Lakebase step
  res.json({ data: [...] });
});

AppKit.server.app.post("/api/items", async (req, res) => {
  res.json({ success: true });
});
```

The UI must call these APIs — no hardcoded/mock data in components. Use placeholder responses for now (Lakebase wiring comes in a later step).

---

### Step 6: Create UI Design Document

Save a design overview to `@docs/ui_design.md` describing:
- Key screens/pages and their purpose
- Core components used
- Basic navigation flow
- **Data entities and their fields** (tables, columns, relationships) — this is critical because the Setup Lakebase step reads this document to create database tables

---

### Step 7: Test Locally

1. **Build and start the dev server:**
   ```bash
   npm run dev
   ```

2. **Open browser** at http://localhost:8000

3. **Verify UI and endpoints:**
   - The UI loads correctly with all pages/views
   - Navigation works between all pages
   - Backend API endpoints respond: `/health`, `/api/analytics/query/*`, custom routes
   - Data displays in the UI (placeholder data is OK at this stage)

4. **Check for errors:**
   - No console errors in browser DevTools
   - No server-side errors in the terminal

> **STOP: Only proceed to the next step after local testing passes.** Do not deploy until the app runs cleanly on localhost.

---

### Summary

Complete when:
- `app.yaml` configured with your app name
- Working web UI under `client/src/` with `@databricks/appkit-ui` components
- SQL queries in `config/queries/` for analytics
- Backend API routes in `server/server.ts` with placeholder data
- `docs/ui_design.md` created (including data entity definitions)
- `npm run dev` passes locally