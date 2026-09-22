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
| 5 | D1–D10 design docs | Specs | **Not yet written** | The workshop-specific specifications to author next, per the plan. See below. |

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

---

## Documents to build next (from the plan)

Write order: **D1 + D3** → **D2 + D5** → **D4 + D6 + D7** → **D8 + D9** → **D10**.

- **D1** `mcp-workshop-interactivity.md` — keystone: the no-elicitation interaction model + four patterns.
- **D3** `workshop-engine-domain.md` — manifest schema, progression semantics, assembler-parity contract.
- **D2** `mcp-interface-contract.md` — the tool/resource/prompt IDL.
- **D5** `mcp-workshop-pedagogy.md` — learning model + question authoring.
- **D4** `mcp-workshop-architecture.md` — components + sequences + deployment topology.
- **D6** `mcp-workshop-data-model.md` — Lakebase DDL incl. the interaction/decision log.
- **D7** `mcp-workshop-security.md` — identity, CORS reconciliation, `/mcp` rate-limit decision.
- **D8** `mcp-workshop-test-plan.md` — parity, contract, 307-regression, re-probe harness.
- **D9** `mcp-workshop-rollout.md` — phasing (Phase 1 ships now), version pinning, deploy gates.
- **D10** `mcp-workshop-facilitator-guide.md` — setup + troubleshooting (optional).

Full content-per-doc and the dependency graph are in
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
