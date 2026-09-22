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
2. They trip a **deployment gotcha** specific to Databricks Apps (naming, routing, lifespan).
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

### 4.4 CORS is (usually) a non-issue — don't over-engineer it
Genie Code reaches `/mcp` **through the Databricks Apps auth proxy** (effectively server-to-server),
so browser CORS rarely applies. If you do set CORS, note that Starlette's `CORSMiddleware` with
`allow_origins=["*"]` + `allow_credentials=True` **echoes the request origin** (it does not send
literal `*`), so it is valid. **Do not** conclude a failed connection is "a CORS problem" — check
§4.2 (the 307) first; that is the usual culprit.

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
- **Two-session concurrency:** two identities never observe each other's state.
- **Contract tests:** every tool validates against its `inputSchema` / `outputSchema` and sets all
  four annotations.
- **Live smoke:** add server in Genie Code → invoke a prompt → call a tool → verify persisted state.
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
- [ ] MCP app lifespan wired into the parent FastAPI app
- [ ] Stateless; durable state in an external store keyed by resolved identity
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
- ❌ Blaming CORS for a failed connection before ruling out the 307 (§4.2).
- ❌ Mounting the MCP app without wiring its lifespan (§4.3).
- ❌ Asking the user for input via the protocol (elicitation/MRTR) as a hard requirement.
- ❌ Shipping 10+ tools and starving the shared 20-tool budget.
- ❌ Tool descriptions that say *what* but not *when* / *params* / *errors*.
- ❌ Raising protocol errors for expected failures instead of `isError`.
- ❌ Trusting `clientInfo.name` as user identity.
- ❌ Relying on in-memory state between calls (it is stateless).

---

## 12. Provenance

Derived from a live Genie Code MCP capability probe (`fevm-serverless`, 2026-09-21) and MCP
`2026-07-28` protocol research. Worked example and the full reconciliation live alongside this file:
[`README.md`](./README.md), [`mcp-research-and-findings.md`](./mcp-research-and-findings.md),
[`mcp-interactive-track-doc-plan.md`](./mcp-interactive-track-doc-plan.md).
Empirical findings outrank protocol docs for Genie Code's actual behavior — **when in doubt, run
§9.**
