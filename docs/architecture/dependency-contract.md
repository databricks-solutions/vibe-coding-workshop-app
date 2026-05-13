# Runtime Dependency Contract

> **Purpose.** Spell out which Databricks services V2V depends on,
> whether each is **required** or **optional**, and what V2V does when a
> service is unavailable. Required WAF design output. Used to scope
> incident response and to make degraded-mode behavior intentional rather
> than emergent.

## TL;DR

V2V degrades gracefully along two axes:

- **Lakebase outage** → falls back to in-repo YAML config; loses session
  persistence, leaderboard, and prompt-config editing.
- **Model Serving outage** → prompt generation fails hard; UI shows the
  error message. No retry-with-different-model logic.

The app process can start with **no** Databricks services reachable and
will serve the React SPA + health check. This is intentional so
participants who lose network mid-workshop still see a working UI.

## Service dependency table

| Service | Required? | Used by | Failure behavior | Recovery |
|---------|-----------|---------|------------------|----------|
| **Databricks Apps platform** | ⛔ Required to run | Hosting, identity injection (`DATABRICKS_CLIENT_ID`, `DATABRICKS_TOKEN`), reverse proxy, secrets | App doesn't start | Re-deploy / restart from Apps console |
| **Databricks Model Serving** | ⚠️ Required for core feature | `/api/generate-prompt`, all SSE streams | Endpoint returns HTTP error → V2V returns JSON `{error: ...}` to client, surfaces in UI | Check endpoint status, scale up, switch to a different `DATABRICKS_SERVING_ENDPOINT` value |
| **Lakebase (PostgreSQL)** | 🟡 Optional with degraded mode | Sessions, session parameters, leaderboard, prompt config | YAML fallback (`prompts_config.yaml`); session save/load disabled; no leaderboard | Auto-recovers when DB becomes reachable. Cold-start retry: 5 attempts × 3s for autoscaling wake-from-zero |
| **Databricks SDK (control plane)** | ⛔ Required for autoscaling Lakebase | `WorkspaceClient.database.generate_database_credential()` for OAuth token rotation | Lakebase autoscaling mode fails → can fall back to provisioned mode if `PGPASSWORD` is set | Verify SDK ≥ 0.81.0 in `requirements.txt`; check `DATABRICKS_HOST` reachable |
| **psycopg3** (Python driver) | 🟡 Optional | Lakebase autoscaling pool + token rotation callback | Falls back to psycopg2 (static-password connections only — autoscaling won't work) | Install `psycopg[binary,pool]` |
| **psycopg2** (Python driver) | 🟡 Optional fallback | Lakebase provisioned mode legacy compatibility | If both psycopg3 and psycopg2 are missing → YAML fallback only | Install `psycopg2-binary` |
| **PyMuPDF** | 🟡 Optional | `/api/upload` for PDF use-case extraction | Upload of PDF fails with import error; image upload still works | Install `PyMuPDF` |
| **Local filesystem `uploads/`** | ⛔ Required | `/api/upload` write target | Upload fails with 5xx | Verify volume is mounted RW |

## Mode matrix

V2V supports two Lakebase deployment modes. The mode is detected at
startup from `ENDPOINT_NAME`:

| Mode | Detector | Driver path | Token | Failure path |
|------|----------|-------------|-------|--------------|
| **Autoscaling** | `ENDPOINT_NAME` is set | psycopg3 + connection pool + OAuth rotation callback | `WorkspaceClient.database.generate_database_credential(endpoint_name)` per pool checkout | Cold-start retry 5×3s; if pool can't be created → degrades to YAML fallback |
| **Provisioned** | `ENDPOINT_NAME` is empty | psycopg3 if available, else psycopg2 | `PGPASSWORD` injected by Lakebase resource link | No retry; degrades to YAML fallback |
| **No-DB** | `USE_LAKEBASE=false` | n/a | n/a | YAML fallback is the only source |

## Pinned versions and why

`requirements.txt` (root):

| Package | Pin | Reason |
|---------|-----|--------|
| `databricks-sdk` | `≥ 0.81.0` | `postgres.generate_database_credential()` API added in 0.81.0 |
| `psycopg[binary,pool]` | `≥ 3.2.0` | ConnectionPool with token-refresh callback API stable from 3.2 |
| `psycopg2-binary` | `≥ 2.9.0` | Kept as fallback for legacy provisioned-mode deployments |
| `fastapi` | `≥ 0.109.0` | Streaming response API used by SSE endpoints |
| `pydantic` | `≥ 2.5.0` | FastAPI ≥ 0.109 requires Pydantic v2 |
| `PyMuPDF` | `≥ 1.25.0` | Recent CVE fixes in PDF parsing |

When bumping any of these:

1. Test both Lakebase modes end-to-end before merging.
2. Re-render `app.yaml.template` / `databricks.yml.template` if any
   resource link names changed.
3. Update this table.

## Degraded-mode behaviors (explicit list)

### "Lakebase is down" — what works

- ✅ React SPA loads
- ✅ Industries / use cases / workflow steps (served from `prompts_config.yaml`)
- ✅ Prompt generation (depends only on Model Serving)
- ✅ Upload + PDF parsing
- ❌ Session save / load
- ❌ Leaderboard
- ❌ Per-session parameter overrides

### "Model Serving is down" — what works

- ✅ Everything except actual prompt generation
- ❌ `/api/generate-prompt` and SSE streams (return error to client)
- ❌ Use Case Builder (depends on LLM)

### "Databricks Apps platform is down" — what works

Nothing. The app cannot start; the platform owns process lifecycle and
identity injection. Surface this in incident comms; don't try to fail over.

## Maintenance

Update this contract when:

- A new outbound service is added (most likely a future Vector Search /
  Genie integration) — add a row and decide its required/optional status
- A version pin in `requirements.txt` changes
- The fallback logic in `src/backend/services/lakebase.py` changes
- A new env var in `app.yaml.template` controls a feature toggle that
  changes degraded-mode behavior
