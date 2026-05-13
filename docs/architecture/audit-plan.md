# Audit Plan

> **Purpose.** Define what V2V logs, where it lands, and how to query it.
> Required WAF design output. The audit plan is what auditors and
> incident responders actually use — keep it executable.

## Where audit data lives

V2V's audit trail is split across three surfaces today. Each surface
captures a different facet; none is a complete record on its own.

| Surface | What it captures | Owner | Retention |
|---------|------------------|-------|-----------|
| `system.access.audit` | Every Databricks SDK call from V2V, identified by User-Agent string built in `src/backend/identity.py` | Databricks platform | Per workspace policy (typically 1 year) |
| `system.serving.endpoint_usage` | Every model-serving invocation, with `usage_context` dict from `identity.py` | Databricks platform | Per workspace policy |
| App stdout / stderr (captured by Apps platform) | Python `logging` output from `app.py`, `services/lakebase.py`, `api/routes.py` | Databricks Apps | Short rolling window |
| **Lakebase `audit_log` table** | App-internal user actions on sessions, prompts, leaderboard | V2V | **❌ Does not exist today** — see gap #1 |

## Identity attribution

The **critical attribution rule** for V2V: every outbound call is made by
the App SP, but the *user* responsible for the call is identified only by
the User-Agent and `usage_context` constructed in `identity.py`. There is
no second principal at the data plane.

### What `identity.py` stamps

```
User-Agent: vibe-to-value-workshop/<VERSION>
            databricks-sdk-py/<sdk-version>
            python/<py-version>
            os/<platform>
            [section/<sanitized_section_tag>]
            [industry/<sanitized_industry>]
            [usecase/<sanitized_use_case>]
            [project/<auto-detected-repo-name>]   ← added by tag_client()
```

```python
usage_context = {
    "product":  "vibe-to-value-workshop",
    "version":  "<VERSION>",
    "section":  "<sanitized_section_tag>",     # optional
    "industry": "<sanitized_industry>",        # optional
    "usecase":  "<sanitized_use_case>",        # optional
}
```

Both pass through `_sanitize()` which collapses to `[a-zA-Z0-9._-]` and
caps length at 60 characters. This is the lower bound of attribution —
nothing further can be reconstructed.

### What `identity.py` does NOT stamp (gap)

- No `user/<email>` token in User-Agent
- No `user` key in `usage_context`
- No correlation ID linking a stream of SDK calls to an originating
  inbound request

**Reason.** V2V does not propagate the end user's identity past the
ingress today. The App SP is the only principal at the data plane.

**Workaround.** Cross-reference `section_tag` + timestamp against the
Lakebase `sessions` table to recover the user. This is fragile because
`sessions.user_id` is client-supplied and unverified — see
[../gaps/oauth-identity.md](../gaps/oauth-identity.md).

## Standard queries

### Q1 — All V2V model-serving invocations in the last hour

```sql
SELECT request_time, status_code, request_metadata.workspace_id,
       served_entity_id, usage_context, user_agent
FROM system.serving.endpoint_usage
WHERE usage_context['product'] = 'vibe-to-value-workshop'
  AND request_time >= current_timestamp() - INTERVAL 1 HOUR
ORDER BY request_time DESC;
```

### Q2 — V2V SDK calls grouped by section / use case

```sql
SELECT
  regexp_extract(user_agent, 'section/([^ ]+)', 1) AS section,
  regexp_extract(user_agent, 'usecase/([^ ]+)', 1) AS use_case,
  COUNT(*) AS calls
FROM system.access.audit
WHERE user_agent LIKE 'vibe-to-value-workshop/%'
  AND event_time >= current_timestamp() - INTERVAL 1 DAY
GROUP BY 1, 2
ORDER BY calls DESC;
```

### Q3 — Distinguishing workshop installations

`tag_client()` auto-detects the project name from the git remote, so two
installations of V2V running in different workspaces are distinguishable:

```sql
SELECT DISTINCT
  regexp_extract(user_agent, 'project/([^ ]+)', 1) AS install,
  COUNT(*) AS calls
FROM system.access.audit
WHERE user_agent LIKE 'vibe-to-value-workshop/%'
  AND event_time >= current_timestamp() - INTERVAL 7 DAYS
GROUP BY 1
ORDER BY calls DESC;
```

### Q4 — Hot endpoints by rate-limit rejections

V2V's middleware emits a 429 when `RATE_LIMIT_PER_MIN` is exceeded. The
Apps platform captures HTTP status codes:

```sql
-- Replace <APP_NAME> with the deployed app name. Schema for app-level
-- request logs varies by platform version; check the Apps system tables
-- documentation for the exact column names in your workspace.
SELECT date_trunc('minute', request_time) AS minute,
       endpoint_path,
       SUM(CASE WHEN status_code = 429 THEN 1 ELSE 0 END) AS rate_limited,
       COUNT(*) AS total
FROM system.apps.request_log   -- ← adjust if your workspace uses a different name
WHERE app_name = '<APP_NAME>'
  AND request_time >= current_timestamp() - INTERVAL 1 HOUR
GROUP BY 1, 2
ORDER BY rate_limited DESC;
```

## Gaps

### Gap #1 — No app-internal audit table

V2V has no dedicated audit row for user-driven writes. The four kinds of
write we care about:

| Action | Lakebase table | Captured today |
|--------|----------------|----------------|
| Save / load session | `sessions` | Only the row itself; no `who` / `when` audit |
| Update session parameter | `session_parameters` | Same |
| Submit leaderboard score | `leaderboard` | Same |
| Update prompt config (admin) | `section_input_prompts` | Same — and this is the highest-risk write |

**Recommended schema** (when implemented):

```sql
CREATE TABLE audit_log (
  id          BIGSERIAL PRIMARY KEY,
  ts          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id     TEXT NOT NULL,        -- best-effort from request; mark as unverified
  workspace_id TEXT,                -- from DATABRICKS_WORKSPACE_ID if available
  session_id  TEXT,
  action      TEXT NOT NULL,        -- 'session.update', 'prompt.write', etc.
  target      TEXT,                 -- resource key
  metadata    JSONB,
  user_agent  TEXT,                 -- snapshot of outbound UA at time of action
  client_ip   TEXT
);

CREATE INDEX ON audit_log (ts);
CREATE INDEX ON audit_log (user_id, ts);
CREATE INDEX ON audit_log (action, ts);
```

Tracked in [../gaps/oauth-identity.md](../gaps/oauth-identity.md).

### Gap #2 — Unverified `user_id`

`user_id` on inbound writes is client-supplied. Anyone with network
access to the app can claim any user_id. Until OBO is introduced, the
right interim posture is:

- Treat `user_id` as a **display attribute, not a security boundary**.
- Stamp the App SP and the request's `x-forwarded-email` (if present) in
  the future `audit_log` so the unverified `user_id` can be
  cross-checked.

### Gap #3 — No request correlation ID

A user clicking "Generate Prompt" triggers an SSE stream that fans out
into several SDK calls. There is no `request_id` linking them. Adding a
UUID per inbound request and threading it through `usage_context` would
close this.

## Maintenance

Update this plan whenever:

- A new sensitive write is added (update Gap #1 table)
- The User-Agent or `usage_context` format in `identity.py` changes
- A new system table becomes the canonical source for any V2V signal
- Retention policy changes
