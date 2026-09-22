# MCP + Genie Code — Research & Findings

**Status:** Reference (durable background) · **Date:** 2026-09-21
**Target repo:** `vibe-coding-workshop-app`
**Purpose:** Capture the research that grounds the interactive Genie-Code-over-MCP design — the
protocol landscape (MCP `2026-07-28`), the interactivity thesis, and the code-grounded corrections
to the roadmap spec — reconciled against the live capability probe.

> **AUTHORITY NOTE.** This document preserves both the pre-probe analysis (§1–§4, dated 2026-09-19)
> and its reconciliation with the live probe (2026-09-21). **Where the two conflict, the probe
> wins.** The probe findings are canonical in
> [`mcp-interactive-track-doc-plan.md` §1](./mcp-interactive-track-doc-plan.md#1-probe-findings-authoritative-constraints--do-not-re-litigate-without-a-re-probe).
> Reconciliation call-outs are marked **↪ PROBE** throughout.

**Read with:**
[`mcp-workshop-engine.md`](./mcp-workshop-engine.md) (the roadmap it critiques) ·
[`mcp-interactive-track-doc-plan.md`](./mcp-interactive-track-doc-plan.md) (the build plan it feeds) ·
[`README.md`](./README.md) (series index).

---

## 1. Verdict on the roadmap spec

[`mcp-workshop-engine.md`](./mcp-workshop-engine.md) is genuinely strong and unusually
well-grounded. The core architectural call — **lift orchestration out of the frontend TypeScript
into a backend Workshop Engine that both the UI and MCP consume, with two thin transport adapters
over one assembler** — is exactly right. The anti-divergence machinery (generated manifest +
`test_manifest_parity`) is the correct guardrail. The phasing (engine → read-only MCP → write/state
→ repoint UI → generalize) is sound and de-risked.

Two classes of gap remained, which the rest of this document addresses:

1. A **thesis-level gap**: the spec was written (2026-09-19) against an MCP mental model that the
   `2026-07-28` MCP revision moved past, and it left the "how do we make it *interactive*" question
   answered only as fetch-and-narrate.
2. Several **concrete correctness issues** grounded in the current code (§4).

**↪ PROBE.** The probe later confirmed the architecture holds, but closed the interactivity
question in the opposite direction from where §3 pointed — see §3's reconciliation.

---

## 2. MCP protocol research (the landscape as of `2026-07-28`)

The latest MCP revision is **`2026-07-28`**. Four findings shaped the design thinking. **All four
describe what the *protocol* now supports — not what Genie Code exposes today (see §2.5).**

### 2.1 Stateless core + MRTR (Multi Round-Trip Requests)
MCP now has a stateless protocol core, and server→client interactions (elicitation, sampling) were
redesigned as **MRTR**: a tool can return `resultType: "input_required"` with the questions it
needs, and the client re-calls the tool with `inputResponses` attached. This makes mid-tool
interaction possible over stateless HTTP — previously impossible without a held-open stream. On
paper this was the single most important finding for a "super interactive" goal.

**↪ PROBE.** MRTR is entered via the modern `server/discover` handshake. Genie Code **never calls
`server/discover`** — it uses the legacy `initialize` handshake only. **MRTR is unavailable in
Genie Code today.**

### 2.2 Elicitation is first-class
A server can request structured input mid-call via `requestedSchema` (form mode) or send the user
to a URL (url mode). On paper this is the protocol-native way to ask insightful questions, collect
parameters, and capture gate approvals — a cleaner replacement for the roadmap's "next paste =
approval" convention and a standalone `set_parameters` tool.

**↪ PROBE.** Genie Code declares **empty client capabilities (`{}`)** at `initialize` — no
`elicitation`. A live `elicitation/create` attempt failed with `NoBackChannelError`. **Elicitation
is unavailable in Genie Code today.** Elicitation has existed since MCP `2025-06-18`, so a client
that supported it would advertise it at the `2025-11-25` version Genie Code offers; it advertised
nothing. This is a **reliable negative** as of 2026-09-21 on the `fevm-serverless` workspace.

### 2.3 Sampling and legacy HTTP+SSE are deprecated (`2026-07-28`, 12-month offramp)
The roadmap already avoids sampling and mandates Streamable HTTP, so it is on the right side. The
docs should nonetheless state explicitly: **do not adopt sampling; Streamable HTTP only.** This
one survives the probe unchanged.

### 2.4 Genie Code client constraints
Per the Databricks Genie Code MCP docs: **Agent-mode only, same workspace, `/mcp`, stateless, and a
hard 20-tool limit across all connected MCP servers.** The `vibe_` tool set is fine alone, but a
learner will likely also connect Databricks-managed MCPs (Genie, UC functions), so the tool budget
is real and argues for **consolidation + leaning on prompts/resources.** Confirmed by the probe.

### 2.5 What Genie Code actually exposes (probe summary)
| Capability | Protocol supports? | Genie Code today? |
|---|---|---|
| Legacy `initialize` handshake | yes | **yes** (only path) |
| Modern `server/discover` | yes (`2026-07-28`) | **no** |
| Max protocol version | `2026-07-28` | offers **`2025-11-25`** |
| Elicitation (form/url) | yes (`2025-06-18`+) | **no** (`capabilities: {}`) |
| MRTR | yes (`2026-07-28`) | **no** (needs `server/discover`) |
| Sampling | deprecated | **no** (also declared none) |
| Tools / prompts / resources enumeration | yes | **yes** — this is the interactive surface we have |

**Design consequence:** the interactive layer must be built as **in-band text + tool round-trips**,
with elicitation kept only as a **forward-compatible upgrade** guarded by capability negotiation —
never a hard dependency. Full detail in the plan's §1.2.

### 2.6 Tool-design best practices (survive the probe)
- **Descriptions are the agent's only documentation** — write them as prompts: what + when + params
  + errors, **200–400 chars**.
- **Keep `inputSchema` flat** (< 8 params, enums + defaults).
- **Set all four annotations** — `readOnlyHint` / `destructiveHint` / `idempotentHint` /
  `openWorldHint`. Missing annotations are ~30% of connector-directory rejections.
- **Return errors inside the result** (`isError`), not as protocol errors.
- **Push large payloads to resource URIs** instead of inlining.
- **Cache list/read** — `tools/list`, `prompts/list`, `resources/list`, `resources/read` carry
  `ttlMs` / `cacheScope`; set sensible TTLs on outline/overview resources.

---

## 3. The interactivity thesis (pre-probe → reconciled)

**Original thesis (2026-09-19):** keep every prompt verbatim (`bypass_llm` untouched), but wrap
each step in a structured interaction loop using **elicitation/MRTR**, turning the track from a
vending machine into a tutor. The engine already owns everything needed to be a tutor — `why`
(motivation), `how_to_apply`, `expected_output` (success criteria), the gate string, and the
recommend-and-proceed decision points authored into the Tier-G prompts (per
[`../genie-accelerator-prompt-standardization.md`](../genie-accelerator-prompt-standardization.md)
§16–§23). Today those are just text; MCP was to turn them into interaction.

> **↪ PROBE — THE INVERSION.** Genie Code supports **no elicitation and no MRTR**. The thesis
> survives in *shape* — wrap each verbatim step in a structured interaction loop, reuse existing
> content, keep the verbatim contract, keep cross-surface honesty — but the **mechanism inverts
> from elicitation-first to in-band-first.** The elicitation column below becomes a *future
> upgrade*, not the build target. What we build now is the "Build now" column.

### The four interaction patterns (reconciled)

| Pattern | Content already exists in… | **Build now (in-band, tool-driven)** | Future upgrade (if a client gains elicitation) |
|---|---|---|---|
| **Comprehension check** — a "why does this matter" question before/after a step | manifest `why` + section focus/description + `expected_output` | Question text in the step payload the agent reads out; learner answers in chat; engine coaches; optional/skippable | elicitation **form** (multiple-choice) |
| **Decision capture** — recommend-and-proceed defaults (conflicts, unowned measures, data-supportability) | Tier-G "recommend, don't ask" clauses in `semlayer_*` / `gagent_*` prompts | Recommended default stated in prose; a `submit_answer` / `set_parameters` tool records confirm/override | elicitation form with the default **pre-selected** |
| **Gate approval** — Metric View YAML review; benchmark-answer hard-stop | gate strings + the §9/§20 review-gate contract | **Next-prompt-as-approval** (implicit, one-click flow) + `complete_step` records it; Step 9 becomes an explicit required in-band stop | elicitation **confirm** |
| **Parameter intake** — catalog, schema prefix, `includeGenieOntology`, `includeLakehouse`, Lakebase instance | existing `/api/session/{id}/parameters` + the flag model | `set_parameters` tool with resolved defaults; missing-required surfaced in prose | **form-mode** elicitation, `missing_required` drives the schema |

**Why this shape is still right:**
- **Learning + insight, not interrogation.** The pedagogy the track already fought for —
  recommend-and-proceed, implicit approval, "next-prompt-as-approval so it never blocks forever" —
  maps cleanly onto **in-band prompts with the recommended answer one keystroke away.** It stays a
  flow, not a quiz gauntlet. Comprehension checks are the only net-new questions, and they are
  optional.
- **The verbatim contract survives.** The interaction loop wraps the step; it never rewrites the
  prompt body. `get_step` still returns the exact `bypass_llm` text.
- **Cross-surface honesty.** In-band answers become captured outputs / gate records keyed by
  `session_id`, so the UI mirror still reflects everything — `.vibecoding-state.md` and
  `completed_gates` stay the source of truth.

**Progressive enhancement is mandatory.** The interactive layer must negotiate client capability
and **degrade by default to the in-band path**. Elicitation is switched on only when a client
advertises it. Never a hard dependency.

---

## 4. Concrete code-grounded corrections

Specific deltas to fold into the design docs, each verified against the current code on
2026-09-21.

### 4.1 The FastAPI lifespan requirement (confirmed by probe)
The roadmap's mount sketch is `app.mount("/mcp", mcp.http_app(stateless_http=True))`. That omits
the MCP app's **lifespan**, which FastMCP requires to start its session/transport manager — a
documented failure the probe reproduced. The correct pattern:

```python
mcp_app = mcp.http_app(path="/", transport="streamable-http", stateless_http=True)
app = FastAPI(lifespan=mcp_app.lifespan)
app.mount("/mcp", mcp_app)
```

`app.py` constructs `FastAPI(...)` at **`app.py:34`** *before* any router import, so wiring an
existing app's lifespan to a mounted sub-app needs explicit handling — a real integration detail,
not a one-liner.

### 4.2 CORS — reconciled (the pre-probe concern was theoretically sound but not the blocker)
- **Current code:** `app.py:108` sets `allow_origins=ALLOWED_ORIGINS` (empty by default) with
  `allow_credentials=False` at `app.py:109`.
- **Pre-probe concern:** the Databricks docs' CORS example uses `allow_credentials=True` + the
  workspace URL, and raw CORS forbids literal `allow_origins=["*"]` together with
  `allow_credentials=True` — so the "fix" looked like an explicit workspace-origin allowlist.
- **↪ PROBE — reconciliation:** CORS was **not** the failure. Two reasons: (a) Genie Code reaches
  `/mcp` **through the Databricks Apps auth proxy** (effectively server-to-server), not a browser
  CORS flow; and (b) Starlette's `CORSMiddleware`, given `allow_origins=["*"]` + `allow_credentials
  =True`, **echoes the specific request origin** rather than sending literal `*`, so preflight
  succeeds. The real failure was the **307 trailing-slash trap** (§4-adjacent; plan §1.3.2).
- **Net guidance:** keep the SPA's own browser calls on the existing explicit allowlist; do not
  chase a wildcard for Genie Code. Pin this in the security doc (D7).

### 4.3 Security-middleware bypass of `/mcp`
`security_middleware` (`app.py:60`) special-cases `if request.url.path.startswith("/api/")`
(`app.py:64`) — so `/mcp` POSTs **skip the origin guard and the rate limiter.** Convenient (Genie
Code won't be origin-blocked) but it means `/mcp` has **no rate limiting.** Pair the "stateless, all
durable state in Lakebase" note with an explicit decision on `/mcp` rate limiting / abuse (D7).

### 4.4 20-tool budget
Keep `vibe_` tools **≤ ~5–6**; fold parameter intake into a single `set_parameters` tool (or into
`start_track` / `get_step`) where possible; prefer **prompts** (discoverable slash entries) and
**resources** (outline / state / style) over more tools.

### 4.5 Annotations completeness
The roadmap tool table only sets `readOnly` / `destructive`. Add `idempotentHint` (e.g.
`get_step` / `outline` are idempotent) and `openWorldHint` (all tools touch Lakebase → external, so
**true**) to **every** tool.

### 4.6 Output schema on every tool
Every tool returns `structuredContent` validated by a per-tool `outputSchema`, mirrored to a text
block. Make this a **hard contract** in the interface doc (D2), not a passing mention.

### 4.7 Cacheable lists
Set sensible `ttlMs` / `cacheScope` on `tools/list`, `prompts/list`, `resources/list`,
`resources/read` — especially the outline / overview resources.

### 4.8 Line-anchor drift (re-verify at build time)
The roadmap cites the assembler at `routes.py:1201`. As of 2026-09-21 it is
**`get_section_input_content` at `routes.py:1241`**, with **`get_section_input_template` at
`routes.py:360`**. All `routes.py` / `workflowSections.ts` anchors must be **re-verified at build
time** — they have already moved since 2026-09-19.

### 4.9 Number↔tag migration must cover interaction records
`completed_steps` number↔tag migration is under-specified for the interactive case: in-band answers
and gate approvals also need a home. The data-model doc (D6) must define the
**interaction/decision log** alongside `captured_outputs` / `completed_gates`.

---

## 5. Sources

- MCP specification revision `2026-07-28` (spec blog) — stateless core, MRTR, deprecations.
- MCP elicitation specification — form / url modes, `requestedSchema`.
- Databricks Genie Code MCP documentation — Agent-mode, same-workspace, `/mcp`, stateless,
  20-tool limit, custom-MCP CORS example.
- MCP tool schema / annotation guidance (2026) + AWS MCP strategy notes — description-as-prompt,
  flat schemas, four annotations, `isError`, resource-links for large payloads.
- Live capability probe, `fevm-serverless`, 2026-09-21 — canonical in
  [`mcp-interactive-track-doc-plan.md` §1](./mcp-interactive-track-doc-plan.md).

*(External URLs intentionally cited by name/section — they rot on every edit; the probe is the
empirical control that outranks all of them for Genie Code's actual behavior.)*
