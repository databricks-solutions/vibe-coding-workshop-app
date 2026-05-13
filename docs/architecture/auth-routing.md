# Auth Routing Map

> **Purpose.** Document the identity used for every outbound call V2V
> makes to a Databricks service. Required WAF design output.
> Anyone modifying this app must update this table in the same PR.

## Identities V2V can present

| Key | Source | Where injected | Used for |
|-----|--------|----------------|----------|
| **App Service Principal** (App SP) | Databricks Apps platform | `DATABRICKS_CLIENT_ID` + `DATABRICKS_TOKEN` env vars | All outbound Databricks calls |
| **Lakebase Autoscaling OAuth token** | `WorkspaceClient.database.generate_database_credential()` | Refreshed per connection via psycopg3 pool callback | Lakebase queries (autoscaling mode) |
| **Lakebase Provisioned password** | Databricks Apps resource link | `PGPASSWORD` env var | Lakebase queries (provisioned mode) |
| **End user (request-scoped)** | Inbound request headers | **Not currently propagated** to outbound calls | (gap — see [audit-plan.md](./audit-plan.md)) |

V2V does **not** use OBO (On-Behalf-Of-User) token forwarding today. Every
data-plane call is made by the App SP. The end user's identity is captured
in product telemetry (User-Agent + `usage_context`) but is **not** the
authenticated principal at any downstream service.

## Per-call routing

| Endpoint family | Outbound call | Identity used | SDK / driver | Fallback rule | Source |
|-----------------|---------------|---------------|--------------|---------------|--------|
| `POST /api/generate-prompt` (and SSE variants) | LLM invocation against `DATABRICKS_SERVING_ENDPOINT` | App SP | `databricks-sdk` `WorkspaceClient` | None — hard fail | `src/backend/api/routes.py`, `src/backend/identity.py` |
| `POST /api/sessions` / `PUT /api/sessions/{id}` | Insert/update in `sessions` table | App SP via Lakebase | psycopg3 (autoscaling) or psycopg2 (provisioned) | psycopg2 fallback if psycopg3 unavailable; YAML fallback if Lakebase unreachable | `src/backend/services/lakebase.py` |
| `GET /api/industries`, `/api/use-cases/*`, `/api/section-input-prompts/*` | Read from Lakebase config tables | App SP via Lakebase | psycopg3 / psycopg2 | YAML fallback (`prompts_config.yaml`) when `USE_LAKEBASE=false` or DB unreachable | `src/backend/services/lakebase.py`, `src/backend/api/routes.py` |
| `POST /api/leaderboard/*` | Insert/update in `leaderboard` table | App SP via Lakebase | psycopg3 / psycopg2 | Read-only fallback (no writes) | `src/backend/services/lakebase.py` |
| `POST /api/upload` | Write to local `uploads/` directory | OS user (app runtime UID) | filesystem | None | `src/backend/api/routes.py` |
| `/health` | None — local liveness only | n/a | n/a | n/a | `app.py` |

## Identity selection priority (Lakebase)

When V2V opens a Lakebase connection, the Postgres user is resolved in
this order (`src/backend/services/lakebase.py`):

```
PGUSER             → injected by Databricks Apps for provisioned mode
↓
LAKEBASE_USER      → manual override
↓
DATABRICKS_CLIENT_ID → App SP, used for autoscaling
```

Token resolution is decoupled from user resolution:

| Mode | Detector | Token source |
|------|----------|--------------|
| Autoscaling | `ENDPOINT_NAME` env var is set | `WorkspaceClient.database.generate_database_credential(endpoint_name)` — short-lived OAuth, rotated per pool checkout |
| Provisioned | `ENDPOINT_NAME` is empty | `PGPASSWORD` injected via Lakebase resource link |

Cold-start retry (autoscaling only): 5 attempts at 3s intervals during
connection acquisition. Documented in
[dependency-contract.md](./dependency-contract.md).

## Per-process vs per-request scope (known gap)

| Scope | Today | WAF expectation |
|-------|-------|-----------------|
| Identity selection | Process-level: chosen at startup from env vars | Per-request: re-evaluated for each inbound request |
| Token refresh | Per-connection (Lakebase autoscaling pool callback) | Same |
| User attribution | None at data plane; product telemetry only | Stamped on every sensitive write |

**Impact.** SSE streams (`/api/generate-prompt/stream`, etc.) may outlive
the user's session token if OBO is ever introduced. The current App-SP-only
model is internally consistent but does not satisfy WAF's "per-request
identity routing" principle.

**TODO** — see [../gaps/oauth-identity.md](../gaps/oauth-identity.md).

## What this map does NOT cover

- **Workspace-level IAM** (who can deploy V2V) — that is the CI/CD identity,
  managed via DABs `run_as`, and is out of scope for runtime auth routing.
- **Lakebase RLS** — V2V does not use row-level security today; all rows
  are reachable by the App SP.
- **Inter-app calls** — V2V does not call other Databricks Apps.

## Maintenance

Update this map whenever any of the following change:

- A new outbound call to a Databricks service is added
- The Lakebase driver / mode detection logic in `src/backend/services/lakebase.py`
- The User-Agent / `usage_context` construction in `src/backend/identity.py`
- Any new `DATABRICKS_*` or `LAKEBASE_*` env var in `app.yaml.template`

PR reviewers: if the diff touches any file in the **Source** column above
and this map is not also updated, request changes.
