# MCP Design — Interactive Genie Accelerator over MCP

This folder is the **coherent document series** for turning the vibe-coding workshop app into an
MCP server that Genie Code walks in-conversation — turning the Genie Accelerator track from a
copy-paste sequence into an interactive, tutor-style experience.

It is organized as: **origin roadmap → research → probe-grounded plan → (to-be-written) design
docs.** Read in the order below.

---

## The series (reading order)

| # | Document | Kind | Status | What it is |
|---|---|---|---|---|
| 1 | [`mcp-workshop-engine.md`](./mcp-workshop-engine.md) | Roadmap / handoff | Written (2026-09-19) | The origin spec: lift orchestration into a backend Workshop Engine that both the UI and an MCP adapter consume. The substrate everything else builds on. **Predates the probe.** |
| 2 | [`mcp-research-and-findings.md`](./mcp-research-and-findings.md) | Reference | Written (2026-09-21) | The research that grounds the design: MCP `2026-07-28` protocol landscape, the interactivity thesis, and code-grounded corrections — **reconciled against the live probe** (probe wins on conflict). |
| 3 | [`mcp-interactive-track-doc-plan.md`](./mcp-interactive-track-doc-plan.md) | Build plan | Written (2026-09-21) | **§1 = the authoritative probe findings.** Then the D1–D10 document set to build, with content, dependencies, and write order. |
| 4 | [`designing-mcp-servers-for-genie-code.md`](./designing-mcp-servers-for-genie-code.md) | Generic spec | Written (2026-09-22) | **Product-agnostic.** How *any* agent should design, deploy, and verify an MCP server that works with Genie Code — client ground truth, deployment requirements, tool/prompt/resource design, in-band interaction patterns, a reusable capability probe, and a checklist. |
| 5 | [`workshop-engine-domain.md`](./workshop-engine-domain.md) | Spec (D3) | **Draft (2026-09-22)** | The backend domain: manifest JSON Schema, progression functions, assembler-parity contract, state model. Transport-agnostic keystone. |
| 6 | [`mcp-workshop-interactivity.md`](./mcp-workshop-interactivity.md) | Spec (D1) | **Draft (2026-09-22)** | The no-elicitation interaction model: the four in-band patterns, the `interaction` payload block, capability negotiation, the Step-9 hard-stop, and the elicitation upgrade path. |
| 7 | [`mcp-interface-contract.md`](./mcp-interface-contract.md) | Spec (D2) | **Draft (2026-09-22)** | The IDL: 6 tools (name, description-as-prompt, input/output schemas, all four annotations, error taxonomy), 3 resources, 2 prompts, and the tool-budget accounting. |
| 8 | [`mcp-workshop-pedagogy.md`](./mcp-workshop-pedagogy.md) | Spec (D5) | **Draft (2026-09-22)** | The learning model, where comprehension checks + decision points sit per section, the recommend-and-proceed doctrine, question-bank authoring via the `sections/*.md` pipeline, in-band phrasing, and the tone contract. |
| 9 | [`mcp-workshop-architecture.md`](./mcp-workshop-architecture.md) | Spec (D4) | **Draft (2026-09-22)** | Components, the Databricks Apps deployment topology (probe gotchas encoded), and the sequence diagrams (start/param intake, step walk + gate, cross-surface sync, Step-9 hard-stop). |
| 10 | [`mcp-workshop-data-model.md`](./mcp-workshop-data-model.md) | Spec (D6) | **Draft (2026-09-22)** | Additive Lakebase changes: `captured_outputs` / `completed_gates` columns, the `session_interactions` log, session-parameter keys, number↔tag migration, and the migration DDL. |
| 11 | [`mcp-workshop-security.md`](./mcp-workshop-security.md) | Spec (D7) | **Draft (2026-09-22)** | Identity → `session_id`, MCP-session≠auth, managed-proxy identity nuance, CORS reconciliation, the `/mcp` rate-limit decision, and stateless-concurrency isolation. |
| 12 | [`mcp-workshop-test-plan.md`](./mcp-workshop-test-plan.md) | Spec (D8) | **Draft (2026-09-22)** | Engine/parity, MCP contract, interactivity, the 307/mount/lifespan regressions, statelessness, data-model migration, the live Genie Code smoke, and the reusable re-probe harness — with a spec→test coverage matrix. |
| 13 | [`mcp-workshop-rollout.md`](./mcp-workshop-rollout.md) | Spec (D9) | **Draft (2026-09-22)** | The revised phasing (Phase 1 ships now; interactivity decoupled from elicitation), reseed-vs-redeploy matrix, dependency pinning, the deploy preflight checklist, STOP-and-ask gates, rollback, and the re-probe trigger. |
| 14 | [`mcp-workshop-facilitator-guide.md`](./mcp-workshop-facilitator-guide.md) | Guide (D10) | **Draft (2026-09-22)** | How a learner adds the app as a Custom MCP server, the dual-surface projector setup, the 20-tool caveat, what in-band interactivity looks like, and a troubleshooting table. |

---

## The one fact that shapes everything (probe result)

A live capability probe (Genie Code → custom MCP server, `fevm-serverless`, 2026-09-21) found that
**Genie Code connects as a legacy `initialize` client at protocol `2025-11-25` and declares empty
capabilities (`{}`)** — **no elicitation, no MRTR, no sampling.** It enumerates
tools/prompts/resources, and nothing more.

**Consequence:** interactivity is built **in-band** (questions as text the agent reads out, answers
in chat, progression via tools + next-prompt-as-approval). Protocol elicitation is kept only as a
**forward-compatible upgrade behind capability negotiation** — never a hard dependency. The
canonical statement is [plan §1](./mcp-interactive-track-doc-plan.md#1-probe-findings-authoritative-constraints--do-not-re-litigate-without-a-re-probe);
the reasoning and reconciliation are in [research §2–§3](./mcp-research-and-findings.md).

**Design invariant — self-serve by construction ([D1 §1a](./mcp-workshop-interactivity.md)).** A
first-time learner goes from "I have the app URL" to completing the track with **no human
facilitator and no external doc**: the app's landing page carries the connection on-ramp
([D4 §1.1](./mcp-workshop-architecture.md)), and the server orients + helps in-band via the
`How does this workshop work?` prompt and the `vibe://guide/getting-started` resource
([D2 §4–§5](./mcp-interface-contract.md)). The one honest boundary is the manual paste of the
`/mcp` URL into Genie Code (no protocol lets a server self-register); everything after it is
server-driven. The [facilitator guide (D10)](./mcp-workshop-facilitator-guide.md) is a fallback, not
a prerequisite.

---

## Document set (from the plan) — all drafted ✅

Write order (complete): **D1 + D3** → **D2 + D5** → **D4 + D6 + D7** → **D8 + D9** → **D10**.

- **D1** ✅ [`mcp-workshop-interactivity.md`](./mcp-workshop-interactivity.md) — keystone: the no-elicitation interaction model + four patterns. *(Draft)*
- **D3** ✅ [`workshop-engine-domain.md`](./workshop-engine-domain.md) — manifest schema, progression semantics, assembler-parity contract. *(Draft)*
- **D2** ✅ [`mcp-interface-contract.md`](./mcp-interface-contract.md) — the tool/resource/prompt IDL. *(Draft)*
- **D5** ✅ [`mcp-workshop-pedagogy.md`](./mcp-workshop-pedagogy.md) — learning model + question authoring. *(Draft)*
- **D4** ✅ [`mcp-workshop-architecture.md`](./mcp-workshop-architecture.md) — components + sequences + deployment topology. *(Draft)*
- **D6** ✅ [`mcp-workshop-data-model.md`](./mcp-workshop-data-model.md) — Lakebase DDL incl. the interaction/decision log. *(Draft)*
- **D7** ✅ [`mcp-workshop-security.md`](./mcp-workshop-security.md) — identity, CORS reconciliation, `/mcp` rate-limit decision. *(Draft)*
- **D8** ✅ [`mcp-workshop-test-plan.md`](./mcp-workshop-test-plan.md) — parity, contract, 307-regression, re-probe harness. *(Draft)*
- **D9** ✅ [`mcp-workshop-rollout.md`](./mcp-workshop-rollout.md) — phasing (Phase 1 ships now), version pinning, deploy gates. *(Draft)*
- **D10** ✅ [`mcp-workshop-facilitator-guide.md`](./mcp-workshop-facilitator-guide.md) — setup + troubleshooting. *(Draft)*

All D1–D10 are drafted. Next step is human review + implementation (Phase 0 per D9). Full
content-per-doc and the dependency graph are in
[`mcp-interactive-track-doc-plan.md`](./mcp-interactive-track-doc-plan.md).

---

## Related specs (parent folder, `../`)

The Genie Accelerator track content these docs orchestrate lives one level up in `docs/specs/`:
[`PLAN.md`](../PLAN.md),
[`genie-accelerator-prompt-standardization.md`](../genie-accelerator-prompt-standardization.md),
[`genie-track-activation-and-step-cleanup.md`](../genie-track-activation-and-step-cleanup.md),
[`genie-accelerator-diagram-and-optional-lakehouse.md`](../genie-accelerator-diagram-and-optional-lakehouse.md),
[`genie-accelerator-locate-daisychain-and-prompt-cleanup.md`](../genie-accelerator-locate-daisychain-and-prompt-cleanup.md).
Architecture image: [`../images/mcp-workshop-engine-architecture.png`](../images/mcp-workshop-engine-architecture.png)
(source `.mmd` alongside it).

---

## Open decisions (before D1 is written)

1. **Companion files vs. inline** — keep D1–D10 as focused `.md` files in this folder
   (recommended) or fold some into `mcp-workshop-engine.md`.
2. **v1 ambition** — ship read-only fetch-and-narrate first (unblocked today), then layer in-band
   interactivity (recommended); or build the interactive layer in the first cut.
3. **Re-probe trigger** — when to re-run the capability probe to check whether Genie Code has
   gained elicitation (e.g., next Genie Code release; or before committing the interactivity phase).
