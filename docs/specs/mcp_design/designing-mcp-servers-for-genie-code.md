# Designing MCP Servers for Databricks Genie Code — A Generic Specification

**Status:** Reference (reusable, product-agnostic) · **Date:** 2026-09-22
**Audience:** Any agent or engineer building a **custom MCP server** that a user will connect to
**Databricks Genie Code**.
**Scope:** How to design, implement, deploy, and verify an MCP server that Genie Code can actually
drive — grounded in a live capability probe (2026-09-21) plus MCP `2026-07-28` protocol research.
This document is **not** specific to any one application; the vibe-coding workshop is used only as
an occasional worked example.

> **THE ONE RULE.** Design to what Genie Code's client **actually does**, not to what the MCP spec
> **allows**. These differ sharply today (see §2). Everything below follows from that.

> **FRESHNESS.** The client-behavior facts in §2 are empirical, dated **2026-09-21**, and Genie
> Code changes. **Before you rely on any capability, run the probe in §9** against your target
> workspace. Treat §9 as the source of truth; treat §2 as the last known reading.

---

## 1. Why this exists

MCP is a large protocol with an aggressive release cadence (latest revision `2026-07-28`). Genie
Code implements a **conservative subset** of it and reaches your server **through a managed proxy**.
Most MCP servers that "work in Cursor/Claude" fail or underperform in Genie Code for exactly three
reasons, all avoidable:

1. They assume **server→client interaction** (elicitation, sampling, MRTR) that Genie Code does not
   offer.
2. They trip a **deployment gotcha** specific to Databricks Apps (naming, routing, lifespan, and the
   browser-origin **"won't save" cluster** — CORS, Origin, Accept, the hanging `GET` SSE, and the
   `tools/list` payload shape — in §4.4).
3. They over-spend the **20-tool budget** or write tool descriptions the agent can't act on.

This spec removes all three.

---

## 2. Ground truth: Genie Code as an MCP client

Captured by connecting Genie Code (Agent mode) to a custom FastMCP server and logging the
transport. **Re-verify with §9.**

### 2.1 Client profile

| Dimension | Observed value (2026-09-21) | Design implication |
|---|---|---|
| Handshake | **Legacy `initialize` only** — never calls `server/discover` | You get the legacy protocol path; do not require the modern discovery flow |
| Protocol version offered | **`2025-11-25`** | Anything gated on `2026-07-28` (MRTR) is unavailable |
| Declared client capabilities | **`{}` — none** | **No `elicitation`, no `sampling`, no `roots`** |
| Server→client requests | **None possible** — `elicitation/create` fails `NoBackChannelError` | The server can never ask the user for input mid-call |
| MRTR (`input_required` round-trips) | **Unavailable** (needs `server/discover`) | Interaction cannot be a protocol round-trip |
| Enumerates tools / prompts / resources | **Yes** | **This is your entire interactive surface** |
| Transport | **Streamable HTTP, stateless**, via a **managed MCP proxy** | No held-open stream; no per-tool session identity from the client |
| `clientInfo.name` | The **connection name**, not `genie-code` | You cannot identify the end user from `clientInfo` |
| Mode | **Agent mode only** | Feature is unavailable in ask/edit modes |
| Workspace | **Same workspace** as the server app | No cross-workspace connections |
| Tool budget | **~20 tools total across *all* connected servers** | Your tools compete with Genie, UC-function, and other MCPs |

### 2.2 The capability floor (what you may rely on today)

- Tool calls (`tools/list`, `tools/call`) with JSON-Schema `inputSchema` / `outputSchema`.
- Prompts (`prompts/list`, `prompts/get`) — surfaced as discoverable slash entries.
- Resources (`resources/list`, `resources/read`) — for read-only context payloads.
- In-result errors (`isError`).
- Everything runs **stateless**: assume every request is independent.

### 2.3 The capability ceiling (do NOT depend on, may add as progressive enhancement)

- Elicitation (form/url), sampling, MRTR, `roots`, any server-initiated request.
- The `2026-07-28` stateless-core niceties reached via `server/discover`.

---

## 3. Non-negotiable constraints (design rules)

1. **Stateless.** Persist all durable state in an external store keyed by a stable identity
   (§8). Never rely on in-memory session state surviving between calls.
2. **Streamable HTTP only.** Do **not** implement or advertise sampling. Do not rely on HTTP+SSE
   (deprecated `2026-07-28`).
3. **No server→client requests.** Interactivity is **in-band** (§7): text the agent reads out +
   tools the agent calls. Never block waiting on the user through the protocol.
4. **Budget your tools.** Target **≤ 5–6 tools**. Move read-only context to **resources** and
   entry points to **prompts**. Consolidate parameters into one tool, not many.
5. **Agent-mode, same-workspace.** Document this for the user; it is not something you control.

---

## 4. Deployment requirements (Databricks Apps)

Each item below is a **hard requirement** proven to break the connection if violated.

### 4.1 App name must start with `mcp-`
Databricks recognizes an App as an MCP server by a **`mcp-` name prefix**. `mcp-my-server` works;
`my-server` will not be offered as an MCP connection.

### 4.2 Answer `POST /mcp` with 200, never a 307 (the trailing-slash trap)
Genie Code POSTs to **`/mcp`** (no trailing slash). If you mount the MCP app at `/mcp`, Starlette
answers `/mcp` with a **307 redirect to `/mcp/`**, and **Genie Code's client does not follow it** —
the connection fails silently. Fix with either:

- an **internal ASGI path rewrite** (`/mcp` → `/mcp/`) before the mount, or
- a mount configuration where `/mcp` resolves directly.

Add a regression test: `POST /mcp` returns **200**, not 307 (§9.3).

### 4.3 Wire the MCP app's lifespan into the parent app
FastMCP's session/transport manager starts in its **lifespan**. If you mount the sub-app without
passing its lifespan to the parent, the manager never starts and every call fails. Correct pattern:

```python
mcp_app = mcp.http_app(path="/", transport="streamable-http", stateless_http=True)
app = FastAPI(lifespan=mcp_app.lifespan)   # <-- required
app.mount("/mcp", mcp_app)
```

If the parent app already exists with its own lifespan, **compose** the two lifespans explicitly —
this is a real integration step, not a one-liner.

### 4.4 The "lists but won't save" cluster — CORS, Origin, Accept, the hanging GET, and the tools/list payload
> **This supersedes an earlier claim in this doc that "CORS is usually a non-issue."** A live
> save-failure investigation (2026-09-22, `fevm-serverless`) proved the opposite, and resolved it
> end-to-end: after all five gates below were fixed, Genie Code persisted the server and drove a full
> interactive tool session.

Genie Code's **"Add MCP server → Save"** runs a **browser-side** `initialize` + `tools/list`
validation **from the workspace origin** (`https://<workspace-host>` on `*.cloud.databricks.com` /
`*.azuredatabricks.net`) to your app origin (`*.databricksapps.com`). That is a genuine
**cross-origin, credentialed** request. (The *runtime* agent path is proxied; the *save-time*
validation is not — this is why it can list yet refuse to save.) **Five independent gates** can each
make the entry **list but silently fail to persist on Save**. The first three surface a *different*
status code you only see if you send the matching header; the last two are the cruel ones — the
server returns `200`/`405` throughout and a naive server-side smoke looks perfectly green:

**(a) CORS preflight — `400 Disallowed CORS origin`.**
The browser sends an `OPTIONS` preflight to `/mcp`. The Apps auth proxy lets `OPTIONS` through
unauthenticated, so it reaches your app; if the workspace origin is not allow-listed, the preflight
fails and Save aborts. Configure Starlette exactly:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[WORKSPACE_URL],       # full origin WITH scheme, never "*"
    allow_credentials=True,              # the request is credentialed
    allow_methods=["*"],
    allow_headers=["*"],                 # reflects Access-Control-Request-Headers
    expose_headers=["mcp-session-id", "mcp-protocol-version"],
)
```

- The origin must carry the **scheme** (`https://…`). A bare hostname (a common `DATABRICKS_HOST`
  value) yields an `Access-Control-Allow-Origin` that never matches byte-for-byte and the preflight
  fails — normalize it (`https://` + strip path/trailing slash) before use.
- `allow_credentials=True` **requires** an explicit origin; `"*"` + credentials is rejected by
  browsers. (The earlier "`*` echoes the origin" claim does not hold for the save-time path.)
- **Expose `mcp-session-id`** so the client can read it.

Verify: `curl -i -X OPTIONS "$APP_URL/mcp" -H "Origin: https://<workspace-host>" -H
"Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers:
content-type,authorization,mcp-protocol-version,mcp-session-id,accept"` → expect `200/204` with
`access-control-allow-origin: https://<workspace-host>` (**with scheme**) and
`access-control-allow-headers` reflecting your requested headers.

**(b) MCP transport Origin check — `403 Invalid Origin header`.**
The MCP Python SDK's `TransportSecurityMiddleware` (DNS-rebinding protection) validates `Origin`
**separately from CORS**. FastMCP **defaults `host="127.0.0.1"` and auto-enables this protection for
localhost**, allow-listing only `http://127.0.0.1:*` / `localhost`. Behind the Apps proxy your app
binds to 127.0.0.1, so the *Host* check passes but the real workspace `Origin` is rejected with
`403`. It is **invisible to a bare `curl`** (no `Origin` header ⇒ the check is skipped), so it hides
behind a green server-side smoke. Fix by passing explicit transport security:

```python
from mcp.server.transport_security import TransportSecuritySettings

mcp = FastMCP(..., transport_security=TransportSecuritySettings(
    enable_dns_rebinding_protection=False,   # or keep True + allowed_origins=[WORKSPACE_URL]
))
```

Disabling is safe in this topology: the app is a public HTTPS endpoint gated by the Apps OAuth proxy
and your CORS layer (a) already restricts browser origins. For defense-in-depth, keep protection on
and set `allowed_origins=[WORKSPACE_URL]` plus `allowed_hosts` to whatever the proxy forwards.

**(c) The Accept 406 gate — `406 Not Acceptable: Client must accept both application/json and
text/event-stream`.** ← **the most common "won't save" cause, and the hardest to spot.**
The Streamable HTTP transport's POST handler **rejects unless `Accept` lists BOTH `application/json`
and `text/event-stream`**. Genie Code's browser save-time validation sends a **JSON-only**
(`application/json`) or **wildcard** (`*/*`) Accept, so the handshake `406`s and the entry vanishes
on Save. **This gate is independent of `json_response` / `enableJsonResponse`** — that setting only
changes the *response* format, not the Accept requirement. Two coordinated fixes:

1. **Normalize the incoming `Accept`** at the transport layer (ASGI middleware over `/mcp`): if it
   does not already list both types (JSON-only, `*/*`, or empty), rewrite it to
   `application/json, text/event-stream`. Widening is safe because (2) makes a plain-JSON reply
   always valid; leave an already-tolerant Accept untouched.
2. **Enable JSON responses** (`json_response=True` in FastMCP / `enableJsonResponse: true` in the TS
   SDK) so the reply body is plain JSON for maximum client tolerance.

Verify (the check a green server-side smoke *misses* because it hand-sends the dual value):
`curl -X POST "$APP_URL/mcp" -H "Authorization: Bearer $TOKEN" -H "Origin: https://<workspace-host>"
-H "Accept: application/json" -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,
"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":
{"name":"x","version":"1"}}}'` → expect `200`, **not** `406`.

**(d) The hanging `GET /mcp` stream — a `200` that never returns.**
After a *successful* `initialize` + `tools/list`, Genie Code opens a `GET /mcp` **SSE stream** for
server→client messages. A **stateless** server has no such stream, but FastMCP still answers `GET`
with `200 Content-Type: text/event-stream` and **holds it open with zero bytes** (verified: `curl`
gets 0 bytes and times out). Genie Code stalls waiting on that stream and the entry **never persists
— even though every other request returned `200`.** This is the gate that survives all of (a)–(c):
your server-side logs look perfect (`OPTIONS 200`, `POST 200`, `tools/list 200`) yet Save fails.
Fix by rejecting `GET`/`DELETE` on `/mcp` with **`405`** (there is no stream to open and no session
to tear down in stateless mode), so the client proceeds instead of waiting:

```python
# ASGI middleware over /mcp, before the mount:
if scope["method"] in {"GET", "DELETE"}:
    # 405 JSON-RPC error; CORS headers still added by CORSMiddleware
    return _method_not_allowed(send)
```

Verify: `curl -i "$APP_URL/mcp" -H "Accept: text/event-stream" -H "Authorization: Bearer $TOKEN"`
→ expect a **fast `405`**, not a `200 text/event-stream` that hangs.

**(e) The `tools/list` payload — extra fields silently rejected (the all-`200` failure).**
The final gate, and the most disorienting: with (a)–(d) fixed, the server-side log shows a *complete,
successful* handshake — `initialize` → `notifications/initialized` → `GET 405` → `tools/list 200`,
every request green — yet Genie Code **still won't persist** and instead **re-runs `initialize` +
`tools/list` in a loop**. The cause is the **content** of the `tools/list` result: Genie Code
(protocolVersion `2025-11-25`) rejects tool entries that carry **`outputSchema`** and/or
**`annotations`**. FastMCP emits that richer shape by default; the proven reference returns **only**
`name`, `description`, and `inputSchema` per tool. Slim the *listing* to match — structured output
and annotations still flow to tolerant clients at `tools/call` time, so this changes only what is
advertised, not how the tools behave:

```python
from mcp.types import ListToolsRequest

# Wrap FastMCP's default ListTools handler (after the app/handlers are built):
_orig = mcp._mcp_server.request_handlers.get(ListToolsRequest)

async def _list_tools(request):
    result = await _orig(request)
    for tool in result.root.tools:
        tool.outputSchema = None   # Genie Code 2025-11-25 rejects these *in tools/list*
        tool.annotations = None
    return result

mcp._mcp_server.request_handlers[ListToolsRequest] = _list_tools
```

Verify: `curl -X POST "$APP_URL/mcp" ... -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'` → each
tool object has **only** `name` / `description` / `inputSchema` (no `outputSchema`, no `annotations`).
Success signature in the app log: the `initialize` + `tools/list` loop **stops** (one handshake, then
`CallToolRequest`s as the agent actually uses the tools) instead of repeating.

> **⚠ This deliberately contradicts the tool-quality guidance in §5.3 / §5.4** (set all four
> annotations; declare `outputSchema` + return `structuredContent`). Repo reality wins for Genie
> Code: those fields are correct MCP and help *tolerant* agents, but Genie Code's current client
> rejects them **in the listing**. Keep them on your tool *definitions* (so `tools/call` still
> returns `structuredContent` and other clients benefit) and strip them **only from the `tools/list`
> response**. This is a client limitation, not a spec rule — re-test with the §9 probe when Genie
> Code's client advances, and drop the strip once it tolerates the richer shape.

> **Reference implementation (proven working).** The Databricks field-eng
> `external-to-managed-table-migration-toolkit` custom MCP server
> (`app/server/mcp/register-mcp.ts`) documents and fixes all five: `normalizeOrigin` (scheme-forcing,
> (a)), `setCors` (reflect `Access-Control-Request-Headers`, expose `mcp-session-id`, (a)),
> `normalizeAcceptHeader` + `enableJsonResponse: true` (the 406 fix, (c)),
> `app.get/delete('/mcp', noSession)` → `405` (the hanging-stream fix, (d)), and a
> `ListToolsRequestSchema` handler that returns only `name`/`description`/`inputSchema` (the payload
> fix, (e)). The Python guidance here mirrors that Node reference one-for-one.

### 4.5 The auth proxy handles user auth — MCP session ≠ auth
The Databricks Apps auth proxy authenticates the user before the request reaches your app.
**Unauthenticated** requests get a **302 to an OAuth login**, so raw `curl` without a token will not
reach your handler — this is expected, not a bug. Do not build your own auth on `/mcp`.

### 4.6 Stateless capture caveat
With `stateless_http=True`, per-tool `client_params` is **null** on subsequent POSTs. If you need to
record the client's declared capabilities or identity, capture them at the **transport level**
(ASGI middleware over the `initialize` body), not inside a tool.

### 4.7 Version-pin the MCP libraries
Pin `mcp` and `fastmcp` (and `fastapi`, `uvicorn`) to exact versions in your lockfile; MCP's cadence
means minor bumps change handshake behavior.

### 4.8 Deploying a **stateful** MCP server: two silent-failure landmines
> Discovered live (2026-09-23, `fevm-serverless`) while shipping an interactive, state-persisting
> workshop engine over MCP. Both landmines leave the server **up, listing tools, and answering
> `200`** while the *stateful* behavior is silently broken — so a green server-side smoke and a
> healthy app both lie. If your MCP server persists anything (sessions, provenance, gates), read this.

**(a) Apply schema changes ADDITIVELY — never route an additive migration through a destructive
drop+reseed, especially on a scale-to-zero / low-capacity Postgres.**
The state store here is Lakebase (Databricks' managed Postgres) in **autoscaling** mode (scale-to-zero,
e.g. 0.5 CU). The new-feature migration was correctly written additive and idempotent
(`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT
EXISTS`). But the deploy's "reseed" step ran a **`--recreate`** that `DROP`s content tables and
reseeds them from a large (>1 MB, ~thousands of statements) DML file over a **single long-lived
connection**. On the low-capacity endpoint that connection **dropped partway through the seed**, and
because the seeder swallowed per-statement errors (`ignore_errors`), it **silently left the content
table EMPTY** and never reached the grant step — while printing "seeded successfully". Rules:
- The additive DDL is all you need for an additive migration — apply it via a **non-destructive**
  path (`CREATE ... IF NOT EXISTS` + `ADD COLUMN IF NOT EXISTS`), not a drop+reseed.
- If you must run a large seed, make the loader **reconnect-on-drop** (regenerate the credential and
  reconnect, retry the statement) and **idempotent** (`ON CONFLICT DO NOTHING`). A single-connection
  bulk seed against a scale-to-zero endpoint is a coin-flip.
- **Never trust a seeder that swallows errors.** After any migration/seed, **assert row counts** on
  the tables you touched **and** re-assert the grants (below). "N statements executed" printed by an
  `ignore_errors` loop can mean "N of M failed silently".

**(b) A grant step that fails mid-run leaves new tables unreadable by the app's identity.**
The app connects to Postgres as its **service principal** (or via a `public`/inherited role). New
tables created by the *deployer's* identity are **not** automatically usable by the app SP. The grant
step (`GRANT ... ON ALL TABLES ... TO public` / `TO "<sp>"`, plus `ALTER DEFAULT PRIVILEGES`) ran
**after** the seed and so **never executed** when the connection dropped — leaving the new table
INSERT-denied for the app even once it was repopulated. Re-apply grants explicitly and verify with
`has_table_privilege('<role>', '<schema>.<table>', 'INSERT')` — do not assume the create implied them.

**(c) A "code-only" / fast deploy can ship the app with its state backend SILENTLY DISABLED.**
The state store's connection config (host + endpoint/credential) is populated by a **discovery step**
that runs only in the *full* deploy. The **fast/code-only** path **skips** it, syncing an `app.yaml`
whose `LAKEBASE_HOST` / `ENDPOINT_NAME` are **blank**. Result: the app boots, `/mcp` lists tools,
every tool returns `200` — but `is_state_configured()` is **False**, so **every load/save/append is a
no-op** and nothing persists across requests (fatal for a stateless-HTTP server that relies on the DB
for continuity). "App is RUNNING" + "tools list" **do not** prove state works. Rules:
- Treat the state-backend connection env as **required config**, and **fail loud** (or log a stark
  warning) at startup when it's blank — don't degrade to a silent in-memory/YAML fallback for a
  server whose whole contract is persistence.
- The **deploy smoke must include a WRITE + read-back**, not just `initialize`/`tools/list`. Call a
  write tool, then confirm the row landed (query the store directly, or a read tool). See §9.3.
- After a fast deploy, confirm the state backend logged **"configured"**, not "not configured".

**Bottom line:** for a stateful MCP server, "healthy app + green handshake" is necessary but **not
sufficient**. The acceptance signal is **a write that persists and reads back**, plus explicit
row-count and grant checks after any migration.

---

## 5. Tool design (the surface Genie Code uses most)

### 5.1 Descriptions are the agent's only documentation — write them as prompts
200–400 chars, covering **what** the tool does, **when** to call it, its **params**, and its
**errors/outputs**. The model chooses tools from descriptions alone.

### 5.2 Keep `inputSchema` flat
< 8 parameters, prefer **enums with defaults**, avoid nested objects. A flat, defaulted schema is
one the agent fills correctly on the first try.

### 5.3 Set all four annotations on every tool
`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`. Missing annotations are a
leading cause of connector-directory rejection. Anything that touches an external store (Lakebase,
UC, a warehouse) is `openWorldHint: true`.

### 5.4 Return `structuredContent` validated by an `outputSchema`, mirrored to text
Every tool declares an `outputSchema` and returns `structuredContent`, plus a human-readable text
block. Make this a hard contract, not optional.

### 5.5 Return errors **inside the result** (`isError`)
Do not raise protocol-level errors for expected failures (bad input, not-found, gate-not-met).
Return `isError: true` with an actionable message the agent can relay.

### 5.6 Push large payloads to resource URIs
Do not inline large context (full documents, long outputs). Return a **resource link**; let the
agent read it via `resources/read`.

### 5.7 Naming
`verb_object`, namespaced by a short product prefix (e.g. `vibe_get_step`). Names are part of the
agent's reasoning surface — make them predictable.

---

## 6. Prompts and resources (spend here before adding tools)

Because of the **20-tool budget** (§3.4), move work off tools:

- **Prompts** = discoverable, user-invokable **entry points** ("Start X", "Continue where I left
  off"). They cost nothing against the tool budget and are how users *find* your server.
- **Resources** = read-only **context** (overviews, current state, style guides, catalogs). Set
  `ttlMs` / `cacheScope` on `resources/list` and `resources/read` so the client caches them.
- Reserve **tools** for actions with side effects or parameters.

Rule of thumb: if it only *reads*, it is a resource; if it *starts a flow*, it is a prompt; if it
*changes state or takes arguments*, it is a tool.

---

## 7. Interaction design **without** server→client capabilities

This is the section most servers get wrong for Genie Code.

### 7.1 The inversion principle
You cannot ask the user anything through the protocol (no elicitation/MRTR). So **interaction is
in-band**: the tool result carries the question as **text the agent reads out**, the user answers
**in chat**, and the agent calls a **follow-up tool** with the answer. Progression is driven by
**tools + conversation**, not by protocol round-trips.

### 7.2 The four reusable interaction patterns

| Intent | In-band mechanism (build this) |
|---|---|
| **Ask a question / comprehension check** | Tool returns the question text (optionally multiple-choice) in `structuredContent`; agent reads it; user answers in chat; agent calls `submit_answer`; server coaches in the next result. Keep it **optional/skippable**. |
| **Capture a decision (recommend-and-proceed)** | State the **recommended default in prose**; a single tool records confirm-or-override. Default is one keystroke away → it stays a flow, not an interrogation. |
| **Gate / approval** | **Next action = approval**: the agent's next tool call *is* the confirmation, and the server records it. Reserve an explicit required stop only for true hard-stops. |
| **Parameter intake** | One `set_parameters` tool with **resolved defaults**; surface any missing-required field as prose in the result, not as a protocol prompt. |

### 7.3 Progressive enhancement (forward-compatible, off by default)
Read the client's declared capabilities at `initialize`. If a future client advertises
`elicitation`, you *may* upgrade the patterns above to elicitation forms — but **only** behind that
negotiation. **Never** make elicitation a hard dependency; the in-band path is always the default
and must always work.

### 7.4 Keep any verbatim content contract intact
If your server serves canonical text (prompts, docs), the interaction layer **wraps** the step; it
must not rewrite the payload. Interaction is additive.

---

## 8. State and identity

- **Durable store, keyed by a stable identity.** Because every call is stateless, persist progress /
  answers / approvals in an external store (e.g. Lakebase/Postgres) keyed by an identity you can
  resolve per request.
- **Identity comes from the auth proxy, not `clientInfo`.** `clientInfo.name` is the connection
  name. Resolve the real user from the authenticated request context the Apps proxy provides.
- **Concurrency isolation.** Two users hitting the same stateless server must never see each other's
  state — scope every read/write by the resolved identity/session key.
- **Additive, reseed-safe schema.** Design tables to be additive; migrations must not break existing
  rows (e.g. a number↔tag map must migrate cleanly).

---

## 9. Verification — the capability probe (run this first, every time)

Genie Code evolves; **empirically confirm** its capabilities against your target workspace before
committing an interaction design.

### 9.1 What the probe must capture (transport-level, stateless-safe)
- The `initialize` params: `protocolVersion`, `clientInfo`, and **`capabilities`** (the key field).
- Whether the client ever calls `server/discover` (modern era) vs. only `initialize` (legacy).
- The result of an attempted `elicitation/create` from within a tool (expect `NoBackChannelError`
  today).

### 9.2 Minimal probe server (FastMCP + FastAPI)

```python
import json, logging
from fastmcp import FastMCP
from fastapi import FastAPI

log = logging.getLogger("mcp-probe")
LAST: dict = {}
METHODS_SEEN: list[str] = []

mcp = FastMCP("mcp-probe")

@mcp.tool()  # readOnly/idempotent; touches nothing external
def probe_capabilities() -> dict:
    """Return the most recent client handshake captured at the transport layer:
    protocolVersion, clientInfo, declared capabilities, and the method sequence seen."""
    return {"last_handshake": LAST, "methods_seen": METHODS_SEEN[-20:]}

@mcp.tool()
def probe_elicit() -> dict:
    """Attempt a server->client elicitation. Succeeds only if the client supports it;
    otherwise returns the failure (e.g. NoBackChannelError) so we learn the ceiling."""
    try:
        # In a real probe, call the elicitation API here; capture the exception.
        raise RuntimeError("call elicitation API here")
    except Exception as e:  # noqa: BLE001
        return {"elicitation_supported": False, "error": type(e).__name__, "detail": str(e)}

class InitCapture:
    """Pure-ASGI middleware: tee the request body; if it is initialize/server-discover,
    record the client's declared protocolVersion/clientInfo/capabilities. Also rewrites
    /mcp -> /mcp/ in-place to avoid the 307 the MCP client won't follow."""
    def __init__(self, app): self.app = app
    async def __call__(self, scope, receive, send):
        if scope.get("type") == "http" and scope.get("path") == "/mcp":
            scope = dict(scope); scope["path"] = "/mcp/"; scope["raw_path"] = b"/mcp/"
        if scope.get("type") != "http" or scope.get("method") != "POST":
            return await self.app(scope, receive, send)
        chunks, done = [], {"v": False}
        async def recv():
            msg = await receive()
            if msg.get("type") == "http.request":
                chunks.append(msg.get("body", b""))
                if not msg.get("more_body") and not done["v"]:
                    done["v"] = True
                    try:
                        data = json.loads(b"".join(chunks))
                        for m in (data if isinstance(data, list) else [data]):
                            if not isinstance(m, dict): continue
                            method = m.get("method")
                            if method: METHODS_SEEN.append(method); del METHODS_SEEN[:-50]
                            if method in ("initialize", "server/discover"):
                                p = m.get("params", {}) or {}
                                LAST.clear(); LAST.update({
                                    "entry": method,
                                    "protocolVersion": p.get("protocolVersion"),
                                    "clientInfo": p.get("clientInfo"),
                                    "capabilities": p.get("capabilities"),
                                })
                                log.info("HANDSHAKE %s", json.dumps(LAST, default=str))
                    except Exception:  # non-JSON / partial — ignore
                        pass
            return msg
        await self.app(scope, recv, send)

mcp_app = mcp.http_app(path="/", transport="streamable-http", stateless_http=True)
app = FastAPI(lifespan=mcp_app.lifespan)      # §4.3
app.mount("/mcp", mcp_app)
app.add_middleware(InitCapture)               # §4.2 + §4.6
```

Deploy as a Databricks App named **`mcp-<something>`** (§4.1). Connect Genie Code (Agent mode, same
workspace), call `probe_capabilities` and `probe_elicit`, then read `capabilities` in the logs /
tool result. **Tear the probe down when done.**

### 9.3 Regression + smoke tests to keep
- **307 regression:** `POST /mcp` returns **200**, not 307.
- **The "won't save" cluster (§4.4) — test each of the five gates with the header/method that
  exposes it (or assert the slimmed listing), or a server-side smoke will pass while the browser
  Save fails:**
  - **CORS preflight:** `OPTIONS /mcp` **with** `Origin: https://<workspace-host>` → `200/204` with
    `access-control-allow-origin` echoing the scheme-qualified origin (not `400`).
  - **Origin check:** authenticated `POST /mcp` **with** an `Origin` header → not `403 Invalid
    Origin header`.
  - **Accept 406 gate:** `POST /mcp` with `Accept: application/json` (and with `*/*`) → `200`, not
    `406`. This is the one a hand-crafted smoke hides by sending the dual `Accept`.
  - **Hanging GET stream:** `GET /mcp` (and `DELETE /mcp`) → a fast `405`, **not** a
    `200 text/event-stream` that returns zero bytes and hangs. This survives all the above — a
    server-side log full of `200`s can still fail Save on this one.
  - **`tools/list` payload shape:** `POST /mcp` `tools/list` → each tool has **only**
    `name`/`description`/`inputSchema` (assert **no** `outputSchema`, **no** `annotations`). The
    all-`200` failure — the app log shows a clean handshake, but Genie Code loops `initialize` +
    `tools/list` and never persists until these fields are stripped.
- **Two-session concurrency:** two identities never observe each other's state.
- **Contract tests:** every tool validates against its `inputSchema` / `outputSchema` and sets all
  four annotations.
- **Live smoke:** add server in Genie Code → **confirm it persists on Save** → invoke a prompt →
  call a tool → verify persisted state.
- **Write + read-back (stateful servers, §4.8):** the deploy smoke must call a **write** tool and
  then confirm the row landed — query the store directly or call a read tool — **not** just
  `initialize`/`tools/list`. A blank state-backend config (§4.8c) leaves every write a silent no-op
  while all requests still return `200`; only a read-back catches it. Also assert the startup log
  shows the state backend **"configured"**.
- **Post-migration row-count + grant check (§4.8a/b):** after any migration/seed, assert row counts
  on touched tables and `has_table_privilege('<app-role>', '<schema>.<table>', 'INSERT')` on new
  tables — an `ignore_errors` seeder can report success while leaving a table empty and ungranted.
- **Re-probe harness:** keep §9.2 runnable so you can detect the day Genie Code gains elicitation.

---

## 10. Design checklist (copy into your PR)

**Protocol / interaction**
- [ ] No dependency on elicitation, sampling, MRTR, or any server→client request
- [ ] Interactivity is in-band (text + follow-up tools); nothing blocks on the user
- [ ] Progressive-enhancement stub reads client capabilities but defaults to in-band
- [ ] Streamable HTTP only; sampling not implemented

**Deployment**
- [ ] App name starts with `mcp-`
- [ ] `POST /mcp` returns 200 (no 307) — regression test present
- [ ] **"Won't save" gates handled (§4.4):** (a) CORS allows the scheme-qualified workspace origin
      with credentials + `expose_headers` `mcp-session-id`; (b) transport `Origin` check won't `403`;
      (c) incoming `Accept` normalized to the dual value + `json_response=True`; (d) `GET`/`DELETE`
      `/mcp` return a fast `405`, not a hanging SSE; (e) `tools/list` entries are stripped to
      `name`/`description`/`inputSchema` (no `outputSchema`/`annotations`) — each covered by a test
      that sends the exposing header/method (`Origin`, JSON-only `Accept`, `GET`) or asserts the
      slimmed listing
- [ ] MCP app lifespan wired into the parent FastAPI app
- [ ] Stateless; durable state in an external store keyed by resolved identity
- [ ] **Stateful-deploy landmines handled (§4.8):** schema changes applied additively (no
      drop+reseed for an additive migration); large seeds reconnect-on-drop + idempotent;
      post-migration row-count **and** grant checks; state-backend config treated as required
      (fail-loud on blank, no silent in-memory fallback); deploy smoke does a **write + read-back**
- [ ] MCP/FastMCP versions pinned in the lockfile

**Tools / prompts / resources**
- [ ] ≤ ~5–6 tools; read-only context is resources; entry points are prompts
- [ ] Every tool: description-as-prompt (200–400 chars), flat `inputSchema`, `outputSchema` +
      `structuredContent`, all four annotations, `isError` for expected failures
- [ ] Large payloads returned as resource links, not inlined
- [ ] `ttlMs` / `cacheScope` set on list/read

**Verification**
- [ ] Ran the §9 probe against the target workspace and recorded `capabilities`
- [ ] Concurrency + contract + live smoke tests pass

---

## 11. Anti-patterns (do not do)

- ❌ Assuming "works in Cursor/Claude" ⇒ "works in Genie Code." Genie Code's floor is lower.
- ❌ Assuming CORS is a non-issue for the **Save** step — it is browser-origin and credentialed
  (§4.4a). Conversely, blaming generic "CORS" without checking the specific gates: the 307 (§4.2),
  the transport `Origin` 403 (§4.4b), the Accept `406` (§4.4c), the hanging `GET` (§4.4d), and the
  `tools/list` payload shape (§4.4e).
- ❌ Trusting a green **server-side** smoke: a bare `curl` sends no `Origin` (skips §4.4b) and a
  hand-set dual `Accept` (skips §4.4c), so it passes while the browser Save fails. Reproduce the
  browser's headers.
- ❌ Requiring the dual `Accept` from browser clients — normalize JSON-only/`*/*` to the dual value
  and enable JSON responses (§4.4c).
- ❌ Leaving a stateless `GET /mcp` as FastMCP's default hanging `200` SSE — return `405` so Genie
  Code's save-time validation doesn't stall on a stream that never delivers (§4.4d).
- ❌ Advertising `outputSchema`/`annotations` in `tools/list` to Genie Code — it silently rejects the
  richer listing and loops the handshake; strip those two fields from the *listing* only, keep them
  on the tool definitions for `tools/call` and tolerant clients (§4.4e).
- ❌ Mounting the MCP app without wiring its lifespan (§4.3).
- ❌ Routing an **additive** migration through a destructive `drop+reseed`, or trusting a large
  single-connection bulk seed against a scale-to-zero / low-capacity Postgres — it drops mid-run and
  an `ignore_errors` loop leaves the table **empty** while reporting success. Apply additively,
  reconnect-on-drop, and assert row counts + grants afterward (§4.8a/b).
- ❌ Accepting **"app RUNNING + tools/list works"** as proof a **stateful** server works. A
  code-only/fast deploy can ship a **blank** state-backend config (§4.8c) so every write is a silent
  no-op behind `200`s. Fail loud on blank config; make the deploy smoke do a **write + read-back**.
- ❌ Asking the user for input via the protocol (elicitation/MRTR) as a hard requirement.
- ❌ Shipping 10+ tools and starving the shared 20-tool budget.
- ❌ Tool descriptions that say *what* but not *when* / *params* / *errors*.
- ❌ Raising protocol errors for expected failures instead of `isError`.
- ❌ Trusting `clientInfo.name` as user identity.
- ❌ Relying on in-memory state between calls (it is stateless).

---

## 12. Provenance

Derived from:
- A live Genie Code MCP **capability probe** (`fevm-serverless`, 2026-09-21) and MCP `2026-07-28`
  protocol research (§2).
- A live **"lists but won't save" investigation** (`fevm-serverless`, 2026-09-22) that reproduced
  and fixed the five save-time gates in §4.4 (`400` CORS origin → `403` Invalid Origin → `406`
  Accept → the hanging `GET` SSE, fixed with `405` → the `tools/list` payload strip), then confirmed
  a full interactive learner session over the persisted server, cross-checked against the working
  Databricks field-eng reference
  `external-to-managed-table-migration-toolkit` (`app/server/mcp/register-mcp.ts`:
  `normalizeAcceptHeader`, `normalizeOrigin`, `setCors`) and the official docs
  [Connect Genie Code to MCP servers](https://docs.databricks.com/aws/en/genie-code/mcp).
- A live **stateful-deploy investigation** (`fevm-serverless`, 2026-09-23) shipping an interactive,
  state-persisting workshop engine over MCP — source of §4.8: a destructive `--recreate` reseed that
  dropped a content table then died mid-seed on a scale-to-zero Lakebase (leaving it empty +
  ungranted), and a `--code-only` deploy that shipped a blank state-backend config so every write was
  a silent no-op behind `200`s. Both were invisible to a green server-side handshake and a healthy
  app; only a **write + read-back** and post-migration row-count/grant checks caught them.

Worked example and the full reconciliation live alongside this file: [`README.md`](./README.md),
[`mcp-research-and-findings.md`](./mcp-research-and-findings.md),
[`mcp-interactive-track-doc-plan.md`](./mcp-interactive-track-doc-plan.md).
Empirical findings outrank protocol docs for Genie Code's actual behavior — **when in doubt, run
§9.**
