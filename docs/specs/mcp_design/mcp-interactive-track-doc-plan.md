# Interactive Genie Accelerator over MCP — Document Build Plan

**Status:** Planning · **Author:** pairing session (research → live probe → plan) · **Date:** 2026-09-21
**Target repo:** `vibe-coding-workshop-app`
**Purpose:** Identify the documents to build for the interactive Genie-Code-over-MCP
integration, the content each must carry, and their order. **This is a plan, not a
specification** — no implementation and no design docs are written yet.
**Extends:** [`mcp-workshop-engine.md`](./mcp-workshop-engine.md) (the roadmap/handoff spec) and its
companions ([`PLAN.md`](../PLAN.md),
[`genie-accelerator-prompt-standardization.md`](../genie-accelerator-prompt-standardization.md),
[`genie-track-activation-and-step-cleanup.md`](../genie-track-activation-and-step-cleanup.md),
[`genie-accelerator-diagram-and-optional-lakehouse.md`](../genie-accelerator-diagram-and-optional-lakehouse.md),
[`genie-accelerator-locate-daisychain-and-prompt-cleanup.md`](../genie-accelerator-locate-daisychain-and-prompt-cleanup.md)).
**Series:** see [`README.md`](./README.md) for the full doc series and reading order; the research
behind these findings is in [`mcp-research-and-findings.md`](./mcp-research-and-findings.md).

---

## 0. Why this plan exists

The roadmap spec (`mcp-workshop-engine.md`) turns the app into an MCP server so Genie Code
walks the Genie Accelerator in-conversation. It was written (2026-09-19) against an MCP mental
model that the **2026-07-28** MCP revision moved past, and it left one blocking design question
open: **does Genie Code support elicitation** (so the track can ask insightful questions and gate
on structured answers), or must interactivity be delivered another way?

We resolved that question with a **live capability probe** (see §1). The answer changes the
interaction design, so this plan folds the probe findings in and lays out the document set to
build before any code.

---

## 1. Probe findings (AUTHORITATIVE CONSTRAINTS — do not re-litigate without a re-probe)

A throwaway FastMCP + FastAPI MCP server was deployed as a Databricks App
(`mcp-genie-code-probe`) to the **`fevm-serverless`** workspace on 2026-09-21, connected from
**Genie Code (Agent mode)**, and its `initialize`/method traffic was captured at the transport
level. The app has since been torn down.

### 1.1 Client capability results

| Question | Finding | Basis |
|---|---|---|
| Protocol era | **Legacy handshake only** — uses `initialize`, never `server/discover` | `used_modern_discover: false` across all traffic |
| Max protocol version offered | **`2025-11-25`** | value Genie Code sent in its `initialize` |
| Declared capabilities | **`{}` (none)** — no `elicitation`, `sampling`, or `roots` | captured `initialize` params |
| MRTR (`2026-07-28`) | **Not available** | MRTR is entered via `server/discover`, which Genie Code never calls |
| Live `elicitation/create` | **`NoBackChannelError`** | stateless transport has no back-channel + capability not declared |
| Transport | Connects through a **managed MCP proxy** (`clientInfo.name` = the connection name, not `genie-code`) that forwards **no** client capabilities | captured `clientInfo` |

Reliability: elicitation has existed since MCP `2025-06-18`, so a client that supported it would
advertise it at `2025-11-25`; Genie Code advertised nothing. The server side (FastMCP 4.0.5 / MCP
Python SDK v2) *does* serve both eras, so the gap is on the client. **This is a reliable negative
as of 2026-09-21 on this workspace.** Databricks may upgrade the managed proxy later; the probe is
cheap to re-run when that happens (see §5, Re-probe trigger).

### 1.2 Design consequence (the inversion)

The roadmap's implied "elicitation-first, next-paste fallback" **inverts to fallback-first**:

- **No protocol elicitation and no MRTR.** Insightful questions, comprehension checks, and
  decision capture must be delivered **in-band** — as text in the step payload the agent reads
  out, with the learner answering in chat — and progression driven by **tools**
  (`complete_step`, a `submit_answer` / `set_parameters` tool) plus the **next-prompt-as-approval**
  convention already authored into the Tier-G prompts.
- **Recommend-and-proceed stays prose + tool defaults.** The protocol will not ask for us.
- **Prompts + resources are the interactive surface** Genie Code *does* support (it enumerates
  tools/prompts/resources). Discoverable entries ("Start the Genie Accelerator", "Continue where
  I left off") are prompts; overview/state/style are resources.
- **Phase 1 (read-only fetch-and-narrate) is unblocked today** — no dependency on any MCP
  capability upgrade.

### 1.3 Deployment gotchas proven live (must be encoded in D4/D7/D9)

1. **App name must start with `mcp-`** to be recognized as an MCP server.
2. **307 trailing-slash trap (the real failure — not CORS).** Genie Code POSTs to `/mcp` (no
   slash, per Databricks docs). Mounting the MCP app at `/mcp` makes Starlette answer `/mcp` with
   a **307 redirect** to `/mcp/` that Genie Code's client does not follow. Fix = internal ASGI
   path rewrite (or a mount where `/mcp` resolves directly).
3. **CORS is a non-issue.** `allow_origins=["*"]` + `allow_credentials=True` makes Starlette echo
   the request origin; the Databricks Apps auth proxy answers unauthenticated preflights fine.
   The docs' `ALLOWED_ORIGINS` example is optional hardening, not the blocker.
4. **Lifespan must be wired** to the parent FastAPI app (`FastAPI(lifespan=mcp_app.lifespan)`) or
   FastMCP's session manager never starts. The roadmap's `app.py` mount sketch omitted this.
5. **Stateless capture caveat.** With `stateless_http=True`, per-tool `client_params` is null on a
   later POST; any capability/identity capture must be **transport-level**, not tool-level.
6. **Genie Code constraints (confirmed):** Agent mode only; same workspace; Streamable HTTP;
   stateless; 20-tool budget across all connected servers.

---

## 2. The document set

Legend: **NEW** = net-new file · **EXT** = extends an existing spec/artifact.
Every doc must open with a pointer to §1 of this plan as binding constraints.

### Tier 1 — Foundational (write first; they gate the rest)

**D1. Interactivity & MCP-era addendum** — NEW (`mcp-workshop-interactivity.md`)
- **Now the keystone.** Content: the no-elicitation interaction model (§1.2); the four
  interaction patterns (comprehension check, decision capture, gate approval, parameter intake)
  re-expressed as **in-band text + tool round-trips**, not `elicitation/create`; the
  next-prompt-as-approval gate semantics; capability-negotiation stub that *detects* a future
  elicitation-capable client and can upgrade (forward-compatible, but off by default); explicit
  "no sampling, no MRTR dependency, Streamable HTTP only".
- Depends on: §1 findings + D3.

**D2. MCP Interface Contract** — NEW (`mcp-interface-contract.md`)
- Content: authoritative catalog of tools / resources / prompts. Per tool: `name` (verb+object,
  `vibe_` prefix), description-as-prompt (200–400 chars), Pydantic `inputSchema`, `outputSchema`,
  **all four** annotations (`readOnly`/`destructive`/`idempotent`/`openWorld`), error taxonomy
  (`isError` in-result). Per resource: URI template + `ttlMs`/`cacheScope`. Per prompt: name,
  args, resolved messages. **≤ ~5–6 tools** (20-tool budget); add a `submit_answer` /
  `set_parameters` tool for in-band decisions rather than elicitation.
- Depends on: D1, D3.

**D3. Workshop Engine Domain Spec** — NEW, promotes roadmap §4–§7 (`workshop-engine-domain.md`)
- Content: formal manifest JSON Schema; progression semantics (`outline`/`next_step`/`can_start`/
  `complete_step`) as pure functions; chaining (`consumes`/`produces`); flag gating; the
  assembler-extraction contract (behavior-identical to `get_section_input_content`,
  `routes.py:1241`); manifest generation + parity contract (`generate_manifest.py`,
  `test_manifest_parity`); the step-number ↔ sectionTag namespace formalization.
- Depends on: nothing (mostly relocation/formalization).

### Tier 2 — Cross-cutting design

**D4. Architecture & Sequence doc** — EXT of the existing architecture image
(`mcp-workshop-architecture.md` + updated `.mmd`/`.png`)
- Content: component diagram (engine core, two adapters, in-band interactivity layer, Lakebase,
  `.vibecoding-state.md`); Databricks Apps deployment topology **with the §1.3 gotchas encoded**
  (mcp- name, /mcp path-rewrite, lifespan wiring, stateless); sequence diagrams for (a) start
  track + in-band parameter capture, (b) get_step → in-band comprehension check → execute →
  next-prompt-as-approval gate → complete, (c) cross-surface live sync.
- Depends on: D1, D2, D3.

**D5. Pedagogy & Content-Design doc** — NEW (`mcp-workshop-pedagogy.md`)
- Content ("mix of learning and insightful questions"): learning model (why → check → do →
  verify → gate → reflect); where comprehension checks / decision points sit per section;
  question-bank authoring **seeded via the template-repo `sections/*.md` pipeline** (not
  hardcoded); coaching copy; tone (recommend-and-proceed, humanizer/economist bars); the Step-9
  benchmark hard-stop exception; **how checks are phrased for in-band delivery** (since no
  elicitation UI).
- Depends on: D1; coordinates with the template-repo prompt pipeline.

**D6. Data Model & Persistence spec** — NEW / EXT roadmap §13 (`mcp-workshop-data-model.md`)
- Content: additive Lakebase DDL for `captured_outputs`, `completed_gates`, `session_parameters`,
  and an **interaction/decision log** (in-band answers, gate approvals w/ provenance); number↔tag
  map + migration; stateless read-per-request patterns; retention.
- Depends on: D3, D5.

**D7. Auth, Identity & Security spec** — NEW / EXT roadmap §8.1 (`mcp-workshop-security.md`)
- Content: per-request identity mapping to `session_id`; the **§1.3 deployment facts** (mcp- name,
  path rewrite, lifespan, CORS reality vs. the docs example, `security_middleware` `/mcp` handling
  + rate-limit decision); "MCP session ≠ auth"; managed-proxy identity nuance (clientInfo is the
  connection, not the user); stateless concurrency isolation.
- Depends on: D4, D2.

### Tier 3 — Execution & verification

**D8. Test & Verification Plan** — NEW / EXT roadmap §15 (`mcp-workshop-test-plan.md`)
- Content: manifest-parity test; assembler byte-parity test; MCP contract tests (schemas/
  annotations/output validation); **307-no-redirect regression test** (`POST /mcp` returns 200,
  not 307); stateless two-session concurrency test; a **live Genie Code smoke script** (add
  server → start track → in-band step → gate → UI mirror); a **capability re-probe harness**
  (reusable, from this probe) to detect if/when Genie Code gains elicitation.
- Depends on: D2, D3, D6.

**D9. Rollout & Deploy Runbook** — NEW / EXT roadmap §14 (`mcp-workshop-rollout.md`)
- Content: revised phasing — Phase 1 read-only ships now (unblocked); the interactivity layer
  (D1) lands as its own phase **without** waiting on elicitation; reseed-vs-redeploy matrix;
  `mcp`/`fastmcp` exact-version pinning + `requirements.txt` regen-from-lock; the §1.3 deploy
  checklist as preflight; STOP-and-ask gates.
- Depends on: all above.

**D10. Facilitator & Learner Guide** — NEW, optional (`mcp-workshop-facilitator-guide.md`)
- Content: adding the app as a Custom MCP server in Genie Code (Agent mode, **mcp- name**),
  dual-surface projector setup, 20-tool caveat, troubleshooting (the 307 symptom, stateless 400s,
  "no elicitation → questions come in chat").
- Depends on: D4, D7, D9.

---

## 3. Sequencing & dependency graph

```
§1 findings ─▶ D1 (interactivity, no-elicitation) ─┬─▶ D2 (interface) ─┬─▶ D4 (arch) ─▶ D7 (security) ─┐
D3 (engine domain) ────────────────────────────────┘                   │                                ├─▶ D8 ─▶ D9 ─▶ D10
D5 (pedagogy) ──────────────────────────────────────────────────────────┴─▶ D6 (data model) ───────────┘
```

Write order: **D1 + D3** (keystones) → **D2 + D5** → **D4 + D6 + D7** → **D8 + D9** → **D10**.

---

## 4. Net changes vs. the pre-probe plan

- **D1 is rewritten around "no elicitation / no MRTR"** and promoted to the keystone; the previous
  "elicitation-first" framing is dropped.
- **§1.3 deployment gotchas** are new, promoted from live evidence, and threaded into D4/D7/D8/D9.
- **D8 gains** a 307-regression test and a reusable capability re-probe harness.
- **D9 decouples** Phase 1 from any capability upgrade (ships now).

---

## 5. Open decisions for the human

1. **Addendum vs. companion files:** keep D1–D10 as focused companion `.md` files under
   `docs/specs/mcp_design/` (recommended), or inline some into `mcp-workshop-engine.md`.
2. **v1 interactivity ambition:** ship read-only fetch-and-narrate first (Phase 1, unblocked),
   then layer in-band interactivity — recommended — vs. building the in-band interactive layer in
   the first cut.
3. **Re-probe trigger:** when should we re-run the capability probe (e.g., on the next Genie Code
   release, or before committing the interactivity phase) to check for elicitation support?
