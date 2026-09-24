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
| 6 | [`mcp-workshop-interactivity.md`](./mcp-workshop-interactivity.md) | Spec (D1) | **Draft (2026-09-22; +§4.6 coaching 2026-09-23)** | The no-elicitation interaction model: the in-band patterns (four core + orientation + Phase 2A adaptive coaching), the `interaction` payload block, capability negotiation, the Step-9 hard-stop, and the elicitation upgrade path. |
| 7 | [`mcp-interface-contract.md`](./mcp-interface-contract.md) | Spec (D2) | **Draft (2026-09-22; +Phase 2A coaching 2026-09-23)** | The IDL: 7 tools (6 core + `vibe_coach`; name, description-as-prompt, input/output schemas, all four annotations, error taxonomy), resources, prompts, the tool-budget accounting, and the adaptive-coaching internals (`CoachResult` + `_COACH_SYSTEM`, §12). |
| 8 | [`mcp-workshop-pedagogy.md`](./mcp-workshop-pedagogy.md) | Spec (D5) | **Draft (2026-09-22)** | The learning model, where comprehension checks + decision points sit per section, the recommend-and-proceed doctrine, question-bank authoring via the `sections/*.md` pipeline, in-band phrasing, and the tone contract. |
| 9 | [`mcp-workshop-architecture.md`](./mcp-workshop-architecture.md) | Spec (D4) | **Draft (2026-09-22)** | Components, the Databricks Apps deployment topology (probe gotchas encoded), and the sequence diagrams (start/param intake, step walk + gate, cross-surface sync, Step-9 hard-stop). |
| 10 | [`mcp-workshop-data-model.md`](./mcp-workshop-data-model.md) | Spec (D6) | **Draft (2026-09-22)** | Additive Lakebase changes: `captured_outputs` / `completed_gates` columns, the `session_interactions` log, session-parameter keys, number↔tag migration, and the migration DDL. |
| 11 | [`mcp-workshop-security.md`](./mcp-workshop-security.md) | Spec (D7) | **Draft (2026-09-22)** | Identity → `session_id`, MCP-session≠auth, managed-proxy identity nuance, CORS reconciliation, the `/mcp` rate-limit decision, and stateless-concurrency isolation. |
| 12 | [`mcp-workshop-test-plan.md`](./mcp-workshop-test-plan.md) | Spec (D8) | **Draft (2026-09-22)** | Engine/parity, MCP contract, interactivity, the 307/mount/lifespan regressions, statelessness, data-model migration, the live Genie Code smoke, and the reusable re-probe harness — with a spec→test coverage matrix. |
| 13 | [`mcp-workshop-rollout.md`](./mcp-workshop-rollout.md) | Spec (D9) | **Draft (2026-09-22; +Phase 2A 2026-09-23)** | The revised phasing (Phase 1 ships now; interactivity decoupled from elicitation; **Phase 2A adaptive coaching**, decoupled from Phase 3), reseed-vs-redeploy matrix, dependency pinning, the deploy preflight checklist, STOP-and-ask gates, rollback, and the re-probe trigger. |
| 14 | [`mcp-workshop-facilitator-guide.md`](./mcp-workshop-facilitator-guide.md) | Guide (D10) | **Draft (2026-09-22)** | How a learner adds the app as a Custom MCP server, the dual-surface projector setup, the 20-tool caveat, what in-band interactivity looks like, and a troubleshooting table. |
| 15 | [`mcp-workshop-usecase-selection.md`](./mcp-workshop-usecase-selection.md) | Spec (D11) | **Draft (2026-09-23)** | Post-smoke addendum: an in-band use-case discovery/selection stage (industry → certified-first use cases → author-your-own) that gates PRD and produces a track-agnostic `use_case_brief` — **zero new tools** (resources + existing tools). Plus cross-surface MCP↔SPA step sync (the bridge + the Phase 3 repoint), and a paste-ready Polly charter task. |

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

- **D1** ✅ [`mcp-workshop-interactivity.md`](./mcp-workshop-interactivity.md) — keystone: the no-elicitation interaction model + patterns (four core + orientation + Phase 2A coaching). *(Draft)*
- **D3** ✅ [`workshop-engine-domain.md`](./workshop-engine-domain.md) — manifest schema, progression semantics, assembler-parity contract. *(Draft)*
- **D2** ✅ [`mcp-interface-contract.md`](./mcp-interface-contract.md) — the tool/resource/prompt IDL. *(Draft)*
- **D5** ✅ [`mcp-workshop-pedagogy.md`](./mcp-workshop-pedagogy.md) — learning model + question authoring. *(Draft)*
- **D4** ✅ [`mcp-workshop-architecture.md`](./mcp-workshop-architecture.md) — components + sequences + deployment topology. *(Draft)*
- **D6** ✅ [`mcp-workshop-data-model.md`](./mcp-workshop-data-model.md) — Lakebase DDL incl. the interaction/decision log. *(Draft)*
- **D7** ✅ [`mcp-workshop-security.md`](./mcp-workshop-security.md) — identity, CORS reconciliation, `/mcp` rate-limit decision. *(Draft)*
- **D8** ✅ [`mcp-workshop-test-plan.md`](./mcp-workshop-test-plan.md) — parity, contract, 307-regression, re-probe harness. *(Draft)*
- **D9** ✅ [`mcp-workshop-rollout.md`](./mcp-workshop-rollout.md) — phasing (Phase 1 ships now), version pinning, deploy gates. *(Draft)*
- **D10** ✅ [`mcp-workshop-facilitator-guide.md`](./mcp-workshop-facilitator-guide.md) — setup + troubleshooting. *(Draft)*

All D1–D10 are drafted; D11 (post-smoke) adds the use-case layer + sync. Full content-per-doc and
the dependency graph are in [`mcp-interactive-track-doc-plan.md`](./mcp-interactive-track-doc-plan.md).

### Build charters & current status

Phasing authority is [D9 §1](./mcp-workshop-rollout.md#1-revised-phasing-elicitation-decoupled).

- **Phases 0, 1, 2 — SHIPPED** (PRs #40–#44, deployed to `fevm-serverless`, smoke green; **6 tools**).
- **Phase 2B — recommended next** ([D11](./mcp-workshop-usecase-selection.md)): use-case selection
  before PRD + step-sync bridge. Zero new tools. Fixes the PRD-jump and the cross-surface step
  visibility gap the first live run exposed.
- **Phase 2A — after/parallel to 2B**: adaptive coaching (`vibe_coach`, 7th tool), flag-off pending a
  cost/endpoint sign-off.
- **Phase 3** (UI-repoint, subsumes the 2B bridge) and **Phase 4** (generalize `use_case_selection`
  to all tracks) follow.

Charters (the paste-ready supervisor commands for Polly):
- [`polly-build-charter.md`](./polly-build-charter.md) — the original Phase 0→2/2A charter.
- [`polly-charter-next.md`](./polly-charter-next.md) — **the next increment: Phase 2B → 2A.**

**Later addition — Phase 2A: adaptive coaching (2026-09-23).** A new `vibe_coach` tool turns the
track from "canned step + canned help" into a live tutor: it calls an in-workspace **FMAPI** model
with the prompts/state the server already holds and coaches the learner on *what's happening and
why* (`what_now`/`why`/`unblock`/`review`). It is **in-band** (server-side model call, not
server→client sampling), **fail-open** to the authored static coaching, **read-only**, and
**firewalled**. It is decoupled from Phase 3 (depends only on Phase 2). The design threads
through the series: pattern [D1 §4.6](./mcp-workshop-interactivity.md); tool + `CoachResult` +
`_COACH_SYSTEM` [D2 §3.7/§12](./mcp-interface-contract.md); doctrine [D5 §11](./mcp-workshop-pedagogy.md);
provenance [D6 §3a/§7a](./mcp-workshop-data-model.md); firewall [D7 §6.1](./mcp-workshop-security.md);
`services/llm.py` + sequence [D4 §1.2/§3.5](./mcp-workshop-architecture.md); tests
[D8 §4a](./mcp-workshop-test-plan.md); phasing [D9 §1 Phase 2A](./mcp-workshop-rollout.md); and the
reusable generic pattern in
[`designing-mcp-servers-for-genie-code.md` §7.5](./designing-mcp-servers-for-genie-code.md).

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
