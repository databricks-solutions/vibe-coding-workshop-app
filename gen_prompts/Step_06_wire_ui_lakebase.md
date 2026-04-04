## Wire Frontend to Lakebase Data

Connect UI components to real data from Lakebase. Replace all placeholder/mock API responses with live database queries.

AppKit provides two data paths:

- **Analytics plugin** (`analytics()`): SQL Warehouse queries via `config/queries/*.sql`. Use for read-only/analytical queries. Frontend: `useAnalyticsQuery` hook.
- **Lakebase plugin** (`lakebase()`): Direct Postgres via `AppKit.lakebase.query()`. Use for OLTP reads/writes. Frontend: custom API routes in `server/server.ts`.

---

### Part A: Verify Lakebase Permissions

After first deploy, the Service Principal (SP) that runs your app needs database access. Verify:

1. Open Lakebase Autoscaling UI → your project → **Branch Overview**
2. Check that the app's SP has the **databricks_superuser** role
3. If not listed, click **Add role** → select the SP identity → check **databricks_superuser**

> **Warning:** If permissions are missing, you will see `role "..." does not exist` or `permission denied` errors when the app tries to query Lakebase.

---

### Part B: Wire Backend to Lakebase Data

1. **Review DDL/DML files** — read `db/lakebase/ddl/05_app_tables.sql` and `db/lakebase/dml_seed/04_seed_app_data.sql` to understand the actual table names, column names, and relationships.

2. **Replace placeholder API responses** in `server/server.ts` with `AppKit.lakebase.query()` calls. Match queries to the actual table/column names from the DDL:

```typescript
AppKit.server.app.get("/api/items", async (req, res) => {
  try {
    const result = await AppKit.lakebase.query("SELECT * FROM jaiwant_j_booking_app.items ORDER BY created_at DESC");
    console.info("[/api/items] Query executed, rows:", result.rows.length);
    res.json({ data: result.rows, source: "live" });
  } catch (err) {
    console.error("[/api/items] Lakebase query failed:", err);
    res.json({ data: [], source: "mock" });
  }
});
```

3. **Add context-specific logging** — the lakebase plugin logs queries automatically, but add your own logs for business context (e.g., which endpoint triggered the query, row counts for debugging).

4. **Add fallback to mock data** — if a Lakebase query fails (e.g., during cold start), return placeholder data with `source: "mock"` so the UI still renders.

5. **All data API responses must include a `source` field**: `{ data: [...], source: "live" }` or `{ data: [...], source: "mock" }`. The frontend uses this to show connection status.

---

### Part C: Add ConnectionStatus Component

Create a React component that shows data source status to the user:

- **"Live Data"** (green indicator) — when API responses have `source: "live"`
- **"Mock Data"** (blue indicator) — when API responses have `source: "mock"`
- **Warning icon** — if API calls fail entirely

Place this indicator at the top of every page or in the navigation bar. Use `@databricks/appkit-ui` components (`Badge`, `Alert`) for styling.

Frontend should read the `source` field from API responses and update the indicator accordingly.

---

### Part D: Defensive Data Handling

Ensure the frontend never crashes on empty or missing data:

- Initialize arrays with `[]`, never `undefined`
- Use optional chaining: `data?.map(...)`, `data?.slice()`
- Provide fallbacks: `data ?? []`
- Check array length before rendering tables/charts
- Handle loading, error, and empty states for every data component

---

### Part E: Connection Resilience

The lakebase plugin handles connection pooling, retries, and OAuth token refresh automatically. The first request after an idle period may take a few seconds (cold start) — the `source: "mock"` fallback keeps the UI functional during this.

---

### Part F: Local Test

```bash
npm run dev
```

1. Open http://localhost:8000
2. Verify UI loads with live data from Lakebase
3. Verify ConnectionStatus shows **"Live Data"**
4. Verify all data endpoints return `source: "live"` — test via browser DevTools Network tab
5. Verify no console errors

> **STOP: Only proceed to deployment after local testing passes with live Lakebase data.**

---

## Checklist

- [ ] Lakebase SP permissions verified (databricks_superuser role)
- [ ] DDL/DML files reviewed for table/column names
- [ ] All placeholder API responses replaced with `AppKit.lakebase.query()` calls
- [ ] Context-specific logging added where needed (plugin logs queries automatically)
- [ ] `source` field included in all API responses (`"live"` or `"mock"`)
- [ ] ConnectionStatus component created and placed on all pages
- [ ] Defensive data handling: `[]` defaults, optional chaining, fallbacks
- [ ] Loading/error/empty states handled for every data component
- [ ] Frontend uses `useAnalyticsQuery` hooks with `useMemo` (for analytics queries)
- [ ] `npm run dev` passes — ConnectionStatus shows "Live Data"