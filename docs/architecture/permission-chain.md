# Permission Chain

> **Purpose.** Trace the end-to-end privilege grants required for V2V's
> most sensitive operations. Required WAF design output. Used during
> security review to confirm least-privilege and during incident response
> to scope blast radius.

## How to read

Each operation lists the chain of grants required, top-down: from
workspace IAM down to the data-plane row. If any link is broken the
operation fails.

| Symbol | Meaning |
|--------|---------|
| ⟶ | Privilege flows down |
| ✅ | Granted via platform automatically (Apps resource link, system grant) |
| 📝 | Granted manually (admin must configure) |
| ⚠️ | Coarse — currently broader than needed (TODO tighten) |

---

## Operation 1 — Run a workshop prompt (LLM call)

**Endpoint:** `POST /api/generate-prompt` (and SSE variants)
**Risk:** Triggers paid LLM compute. Exposes prompt contents to model.

```
End user (browser, authenticated by Databricks Apps SSO)
   ⟶ V2V app accepts request via Databricks Apps reverse proxy
   ⟶ Rate-limit + size-limit middleware (app.py)
   ⟶ App SP token (DATABRICKS_TOKEN)
      ⟶ Workspace IAM:    📝 SP must have `CAN_QUERY` on the serving endpoint
      ⟶ Serving endpoint: ✅ Endpoint name from DATABRICKS_SERVING_ENDPOINT
      ⟶ Model Serving:    🟢 Invocation logged in system.serving.endpoint_usage
      ⟶ Audit:            🟢 system.access.audit captures the SP, not the user
                          ⚠️ User identity only visible via User-Agent + usage_context
                             (see audit-plan.md)
```

**Grants required:**

| Layer | Principal | Privilege | Granted by |
|-------|-----------|-----------|------------|
| Workspace | App SP | `CAN_QUERY` on serving endpoint | Admin (📝) |
| App | End user | Apps reverse-proxy passes request | Apps platform (✅) |
| App-internal | End user | None — no app-internal RBAC today | n/a (TODO) |

---

## Operation 2 — Save a workshop session

**Endpoint:** `POST /api/sessions`, `PUT /api/sessions/{id}`
**Risk:** Writes to a multi-tenant Lakebase table. A bug could allow one
user to overwrite another's session.

```
End user (browser)
   ⟶ V2V app accepts request
   ⟶ section_tag validation (routes.py) — regex `[a-zA-Z0-9_-]{1,64}`
   ⟶ App SP → Lakebase connection
      ⟶ Lakebase mode detect (ENDPOINT_NAME)
         autoscaling: short-lived OAuth token (rotated per pool checkout)
         provisioned: PGPASSWORD (long-lived, injected via resource link)
      ⟶ Postgres role:  📝 SP role must have INSERT/UPDATE on `sessions` table
      ⟶ Row write:      ⚠️ No row-level security; SP can read/write any session row
                         ⚠️ user_id column populated from request payload, NOT a
                            verified header — caller can spoof user_id
                            (see ../gaps/oauth-identity.md)
      ⟶ Audit:          ❌ Lakebase has no dedicated audit_log table today
                         (see audit-plan.md → gap #1)
```

**Grants required:**

| Layer | Principal | Privilege | Granted by |
|-------|-----------|-----------|------------|
| Workspace | App SP | Resource link to Lakebase database | DAB / admin (📝) |
| Postgres | App SP role | `INSERT, UPDATE, SELECT` on `sessions`, `session_parameters`, `leaderboard` | DB migration (📝) |
| App-internal | End user | None today — sessions are user-scoped only by `user_id` column | n/a (TODO — RBAC layer) |

---

## Operation 3 — Upload an image / PDF for use-case extraction

**Endpoint:** `POST /api/upload`
**Risk:** User-supplied bytes hit the filesystem. PDF parser (PyMuPDF)
expands input. Path traversal would leak workshop files.

```
End user (browser)
   ⟶ V2V app accepts multipart/form-data
   ⟶ Size cap: MAX_REQUEST_BYTES env (default 50 MiB) — middleware (app.py)
   ⟶ Rate limit: RATE_LIMIT_PER_MIN env (default 1000) — middleware (app.py)
   ⟶ section_tag validation: `[a-zA-Z0-9_-]{1,64}` (routes.py)
   ⟶ File written to `uploads/<section_tag>/<uuid>.<ext>`
      ⟶ Filesystem: OS user that runs the app process (App SP container UID)
      ⟶ PDF parse:  PyMuPDF, in-process
   ⟶ Response:     File path returned for use in subsequent prompt
```

**Grants required:**

| Layer | Principal | Privilege | Granted by |
|-------|-----------|-----------|------------|
| Filesystem | App process | Write to `uploads/` | App container (✅) |
| App | End user | Implicit — no app-internal RBAC | n/a (TODO) |

**Hardening already present** — request size cap, rate limit, origin
check on POST, `section_tag` regex prevents path traversal.

**TODO** — content-type sniff + extension allowlist. Tracked in
[../gaps/uploads-hardening.md](../gaps/uploads-hardening.md).

---

## Cross-cutting: who can deploy V2V?

This is a **separate** chain because the CI/CD identity is different from
the runtime identity (or should be — see WAF "identity-separated deploy"):

```
Deployer (human or CI runner)
   ⟶ Databricks CLI auth (PAT or M2M)
   ⟶ CI/CD SP (📝 should be distinct from App SP)
   ⟶ Workspace IAM:    📝 CAN_MANAGE on the Databricks App resource
                       📝 USE_CATALOG / USE_SCHEMA / CREATE on Lakebase database
                       📝 CAN_QUERY on serving endpoint (for verify step)
   ⟶ Asset Bundle deploys app + creates / updates resources
   ⟶ Verify (TODO):    smoke-test endpoints with CI/CD SP, fail loudly
```

**Today**: V2V's `databricks.yml.template` uses a single identity for
deploy and runtime. WAF principle: separate them. Tracked in
[../gaps/cicd-identity.md](../gaps/cicd-identity.md).

---

## When to update

Add a new operation to this doc whenever you add a route that:

- Writes to Lakebase
- Calls a Databricks service (serving, files, jobs, etc.)
- Accepts user-supplied files or large payloads
- Reads or writes data that crosses workspace boundaries
