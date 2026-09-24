# D1 — Interactivity & MCP-era Model

**Status:** Draft · **Doc ID:** D1 (keystone) · **Date:** 2026-09-22 · **Target repo:** `vibe-coding-workshop-app`
**Series:** [`README.md`](./README.md)
**Binding constraints:** [`mcp-interactive-track-doc-plan.md` §1](./mcp-interactive-track-doc-plan.md#1-probe-findings-authoritative-constraints--do-not-re-litigate-without-a-re-probe)
(the probe) · reconciliation in [`mcp-research-and-findings.md` §3](./mcp-research-and-findings.md).
**Depends on:** [D3 domain spec](./workshop-engine-domain.md) (the step / explainability payload and
progression functions this doc wraps). **Feeds:** D2 interface contract, D4 architecture, D5
pedagogy, D6 data model.
**Generic guidance:** [`designing-mcp-servers-for-genie-code.md` §7](./designing-mcp-servers-for-genie-code.md)
(the reusable in-band interaction patterns this doc specializes for the workshop).

> **THE CONSTRAINT (non-negotiable).** Genie Code connects as a legacy `initialize` client at
> protocol `2025-11-25` with **empty capabilities** — **no elicitation, no MRTR, no sampling**, no
> server→client requests. Interactivity is therefore **in-band**: questions travel as text in the
> step payload the agent reads out; the learner answers **in chat**; progression is driven by
> **tools + conversation**. Elicitation is a **forward-compatible upgrade only** (§9), never a
> dependency.

---

## 1. Purpose & the inversion principle

D3 makes the engine a competent narrator: each step already carries `why`, `prompt` (verbatim),
`how_to_apply`, `expected_output`, `gate`, and `next`. That is **fetch-and-narrate** — copy-paste
elimination, but not yet a tutor.

This doc adds the **interaction layer** that turns the track into a tutor: a mix of learning and
insightful questions, decision capture, and gated approvals — **without** any server→client
protocol call.

**The inversion (vs. the pre-probe roadmap):** the earlier design implied "elicitation-first,
next-paste fallback." The probe inverts it to **in-band-first**. What we build:

- **Questions** = text in the step payload; the agent reads them; the learner answers in chat; the
  agent calls a tool with the answer.
- **Decisions** = recommend-and-proceed prose + a tool that records confirm/override.
- **Gates** = **next-action-as-approval** (the agent's next tool call *is* the confirmation).
- **Parameters** = one `set_parameters` tool with resolved defaults.

Everything reuses content the track already owns; only comprehension-check *questions* are net-new
(§4.1), and they are optional.

---

## 1a. Self-serve by construction (invariant)

The MCP experience must be **self-serve**: a first-time learner goes from "I have the app URL" to
completing the track **with no human facilitator and no external document open**. The
[facilitator guide (D10)](./mcp-workshop-facilitator-guide.md) is a *fallback and classroom-ops
safety net* — never a prerequisite.

**The rule:** every piece of knowledge a learner needs to *start, run, and recover* is delivered
**by the server through the protocol** — MCP prompts, tool/description-as-prompt text, the first-run
orientation payload (§4.5), and a self-documenting help resource (`vibe://guide/getting-started`,
D2 §4). Nothing a learner needs to progress may live *only* in a doc a human must hand them.

**The one honest boundary.** MCP has no mechanism for a server to register itself in a client, so
the single unavoidable manual step is the learner pasting the app's `/mcp` URL into Genie Code's
custom-MCP-server setting. The design's job is to (a) make that step frictionless and
self-explanatory from the **app's own landing page** (D4 §1 SPA on-ramp), and (b) make **everything
after connection fully self-guided by the server**. We do not overclaim zero-touch; we make the one
touch trivial and self-serve the rest.

**Acceptance (tested in D8 §4, gated in D9 Phase 1):** with only the app URL and no other
instructions, a learner connects, is oriented by the server, and completes step 1.

---

## 2. Capability negotiation (default to in-band)

1. At connect, the server records the client's declared capabilities at the transport level
   (stateless-safe ASGI capture over the `initialize` body — see generic spec §4.6 / §9.2). It
   stores `{protocolVersion, capabilities}` per connection.
2. **Default path is always in-band.** The server renders interactions as in-band text + tools
   regardless of what the client declares.
3. If — and only if — a future client advertises `elicitation`, the server *may* upgrade specific
   patterns to elicitation forms (§9). This is off by default and never required for correctness.

There is **no code path** in which a missing capability blocks a step. Absence degrades silently to
in-band.

---

## 3. The interaction loop over a step

The engine's step lifecycle (D3 §5) with the in-band interaction layer wrapped around it:

```
vibe_get_step ──▶ agent presents `prompt` VERBATIM, then narrates `why` + `how_to_apply`
      │
      ├─(optional) interaction.pre  ── comprehension check → learner answers in chat → vibe_submit_answer → coached reply
      │
      ▼
   agent EXECUTES the step (writes YAML, runs SQL, builds dashboard …)
      │
      ├─(optional) interaction.decision ── recommend-and-proceed → learner confirms/overrides → vibe_submit_answer
      │
      ▼
   GATE: next-action-as-approval ── agent calls vibe_complete_step (captured_output) → engine records gate + captured output
      │
      ▼
   vibe_next_step ──▶ next step (or {done:true})
```

The loop **never blocks**: every question has a stated default one keystroke away, so silence
advances with the recommended answer (except the Step-9 hard-stop, §11).

---

## 4. The interaction patterns (in-band)

Each pattern reuses existing content and is carried by the step payload's optional `interaction`
block (§6) — except §4.5 (orientation) and §4.6 (adaptive coaching), which wrap the step rather than
riding the block. Full tool schemas live in D2; the tool names used here are the
interactivity-relevant subset. §4.1–§4.4 are the four core question/decision/gate/parameter
patterns; §4.5 is the first-run on-ramp; §4.6 is the Phase 2A coaching layer.

### 4.1 Comprehension check (net-new, optional/skippable)
- **Intent:** a "why does this matter" question before or after a step, to make it a lesson.
- **Content source:** manifest `why` + section focus/`description` + `expected_output` (D3). The
  question bank is authored via the template-repo `sections/*.md` pipeline (D5), **not** hardcoded.
- **Mechanism:** payload carries `interaction.pre` (or `.post`) with `type:"comprehension"`,
  a `question`, optional `options[]`, and `skippable:true`. The agent reads it; the learner answers
  in chat; the agent calls `vibe_submit_answer`; the engine returns a short **coached** reply
  (correct/'…because…' / gentle correction). Never blocks.

### 4.2 Decision capture (recommend-and-proceed)
- **Intent:** the Tier-G "recommend, don't ask" decision points (conflicts, unowned measures,
  data-supportability) become explicit, recorded choices.
- **Content source:** the recommend-and-proceed clauses already authored into `semlayer_*` /
  `gagent_*` prompts (see `../genie-accelerator-prompt-standardization.md` §16–§23).
- **Mechanism:** payload carries `interaction.decision` with `type:"decision"`, a `question`,
  `options[]`, and a **pre-selected `recommended`** value. The agent states the recommendation and
  proceeds; if the learner overrides in chat, the agent calls `vibe_submit_answer` with the choice.
  The recorded decision lands in `captured_outputs` / the interaction log (D6).

### 4.3 Gate approval (next-action-as-approval)
- **Intent:** replace "next paste = approval" with an explicit, still one-click confirmation; honor
  the §9/§20 review-gate contract.
- **Content source:** the manifest `gate` string + the review-gate contract.
- **Mechanism:** the gate is satisfied when the agent calls **`vibe_complete_step`** with the
  step's `captured_output` — the *next action is the approval*. The engine records the gate
  (D3 §5.4). For `execution:"ui-driven"` steps, `complete_step` records a coached/handoff marker,
  not a false gate (D3 §5.4 step 2). The **Step-9 benchmark** is the one genuine hard-stop (§11).

### 4.4 Parameter intake
- **Intent:** collect catalog, schema prefix, `includeGenieOntology`, `includeLakehouse`, Lakebase
  instance.
- **Content source:** the existing `/api/session/{id}/parameters` + flag model (D3 §4).
- **Mechanism:** one **`vibe_set_parameters`** tool with resolved defaults; it returns
  `{resolved_params, missing_required[]}`. Missing-required fields are surfaced as **prose** in the
  next result (not a protocol prompt); the agent asks in chat and re-calls the tool. Flags feed the
  engine's outline filter (D3 §5.1).

### 4.5 Orientation (first-run, in-band) — the self-serve on-ramp
- **Intent:** make the experience self-serve (§1a) by having the *server* orient a first-time
  learner instead of relying on a human or D10.
- **Content source:** static, server-owned orientation copy + the `vibe://guide/getting-started`
  resource (D2 §4).
- **Mechanism:** the `Start the Genie Accelerator` prompt (D2 §5) and the first `vibe_get_step`
  result carry a short **orientation preamble** the agent delivers before step 1, covering only what
  the learner needs to drive it themselves:
  - answer questions **in chat** (there are no pop-up forms — that's expected, §2);
  - **silence accepts the recommended default** — the track never blocks (except §11);
  - there is **one hard stop** (the benchmark step, §11);
  - progress is **saved server-side**; you can open the web UI on the same session to follow along
    (§8);
  - if tools go missing, it's the **20-tool budget** — disconnect other MCP servers (self-heal hint,
    mirrors D10 §5).
  Orientation is shown **once per session** (first step only) and is skippable; it never repeats or
  blocks. A returning learner (`Continue where I left off`) skips it.

### 4.6 Adaptive coaching (in-band, LLM-grounded) — *Phase 2A*
- **Intent:** turn the track from "present canned step + canned coaching" into a **live tutor** that
  explains *this* learner's situation on demand — what is happening at their current step and why —
  grounded in their own progress. It is the pull-based complement to §4.1–§4.2 (which are
  push-based, tied to a specific question).
- **What makes it possible:** the MCP server already holds everything a good explanation needs — the
  step's verbatim `prompt`, `why`, `how_to_apply`, `expected_output` and gate (D3 §8), the learner's
  `captured_outputs` and prior answers (D6), the parameters — **and** in-workspace access to an FMAPI
  model via `call_databricks_serving_endpoint` (`routes.py:1400`). §4.1's coaching is a static
  option→text lookup; §4.6 composes those same inputs into a grounded, personalized narration.
- **Content source:** server-assembled grounding context (D2 §12.3) + the `_COACH_SYSTEM` constant
  (D2 §12.2). The static per-option coaching bank (D5 §5.1) remains the **fallback** (below).
- **Mechanism:** one read-only tool, **`vibe_coach`** (D2 §3.7), that the learner invokes in chat
  ("why does this matter?", "what now?", "I'm stuck") with an optional `focus`
  (`what_now`/`why`/`unblock`/`review`). The server reads state fresh, assembles the context, calls
  the model with `_COACH_SYSTEM`, scrubs the output for leakage (D7 §6), and returns
  `CoachResult` (D2 §12.1). It **changes no workshop state** and **never blocks or advances** the
  track.
- **Fail-open (non-negotiable):** any model error/timeout degrades to the static option-keyed
  coaching (§4.1 / D5 §5.1) with `is_fallback:true`. Coaching failing must never fail a step or a
  tool. If no serving endpoint is configured, `vibe_coach` still returns useful static coaching.
- **Verbatim contract holds (§7):** coaching **explains** the step; it never rewrites or re-issues
  the verbatim `prompt`. The prompt is still presented first and remains authoritative.
- **Still in-band, still no server→client call:** the model call is a **server-side** FMAPI request
  (server → serving endpoint), not an MCP server→client protocol call. It respects the probe floor
  (§2, §10) — the agent invokes a normal tool and reads the result aloud.

---

## 5. Tool surface for interactivity

Within the ≤ ~5–6 tool budget (generic spec §3.4), the interactivity-relevant tools are:

| Tool | Role in interaction | Notes |
|---|---|---|
| `vibe_get_step` | Carries the `interaction` block (§6) alongside the explainability payload | readOnly; idempotent |
| `vibe_submit_answer` | Records a comprehension answer or a decision override; returns coaching | **new** (folds "quiz answer" + "decision" into one tool to save budget); not destructive |
| `vibe_complete_step` | The gate = next-action-as-approval (§4.3) | writes gate + captured output |
| `vibe_set_parameters` | Parameter intake (§4.4) | returns `missing_required[]` |
| `vibe_coach` | On-demand adaptive coaching (§4.6) | **new (Phase 2A)**; read-only; LLM-grounded, fail-open |

`vibe_submit_answer` and `vibe_coach` are the net-new tools this series adds beyond D3's engine
tools; D2 defines all schemas, annotations (all four), and `outputSchema`/`structuredContent`
contracts. **Do not** add a separate tool per *question pattern* (§4.1–§4.4) — those stay
consolidated in `vibe_submit_answer`. `vibe_coach` is the **one** deliberate exception: it is a
distinct **capability** (a pull-based, argument-taking, model-backed narration), not a duplicate of
a push-based question — so it earns its own tool. Net tool count is **7** (D2 §9), still far under
the shared ~20-tool budget.

---

## 6. The `interaction` payload block (schema)

An **optional** extension to D3's explainability payload (D3 §8). Absent ⇒ pure fetch-and-narrate.

```jsonc
"interaction": {
  "pre":      Interaction | null,     // asked before execution (usually a comprehension check)
  "decision": Interaction | null,     // asked at/after execution (recommend-and-proceed)
  "post":     Interaction | null      // optional reflection after the gate
}

// Interaction:
{
  "id": "semlayer_locate.why",        // stable id for logging (sectionTag-scoped)
  "type": "comprehension" | "decision" | "confirm",
  "question": "Why establish a governed Metric View before wiring an agent?",
  "options": [                        // omit for free-text
    { "id": "a", "label": "…" },
    { "id": "b", "label": "…" }
  ],
  "recommended": "a",                 // decision/confirm: the pre-selected default; null for open comprehension
  "skippable": true,                  // comprehension: silence advances; decision: default applies
  "coaching": {                       // engine-provided feedback keyed by option id (comprehension)
    "a": "Correct — governance first means…",
    "b": "Not quite — an agent over ungoverned data…"
  }
}
```

**Rendering contract for the agent** (stated in the `vibe_get_step` tool description, since fidelity
is instruction-enforced, not protocol-enforced — roadmap §16): present `prompt` **verbatim** first;
then narrate `why`/`how_to_apply`; then, if `interaction.pre` exists, ask it and wait for a chat
answer; execute; then handle `interaction.decision`; then complete via the gate.

---

## 7. The verbatim contract survives

The interaction layer **wraps** the step; it never rewrites the prompt body. `vibe_get_step` returns
the exact `bypass_llm` `input` (D3 §7.5). Questions, coaching, and recommendations live only in the
`interaction` block and the tool descriptions — never spliced into `prompt`.

---

## 8. Cross-surface honesty

In-band answers and gate approvals are **persisted**, keyed by `session_id`, so the UI mirror stays
truthful (roadmap §10.3):
- comprehension answers + decisions → the **interaction/decision log** (D6);
- gates → `completed_gates`; captured step output → `captured_outputs` (D3 §4);
- the `.vibecoding-state.md` ledger (Tier-G "RECORD bookend") remains the shared narrative source of
  truth, reflected in `completed_gates`.

A facilitator projecting the UI sees comprehension answers, decisions, and gate progress as the
learner drives Genie Code.

---

## 9. Progressive-enhancement upgrade path (off by default)

If a future Genie Code (or another client) advertises `elicitation` at `initialize` (verify with
the re-probe harness, generic spec §9), the server may upgrade:

| In-band today | Elicitation upgrade (future) |
|---|---|
| `interaction.pre` comprehension text + `vibe_submit_answer` | elicitation **form** (multiple-choice) |
| `interaction.decision` prose + pre-selected `recommended` | elicitation **form** with default pre-selected |
| next-action-as-approval | elicitation **confirm** |
| `vibe_set_parameters` prose for `missing_required` | **form-mode** elicitation driven by `missing_required` |

The upgrade is **purely additive**: the `interaction` block already carries everything an
elicitation `requestedSchema` needs (`question`, `options`, `recommended`). No content is
re-authored. The in-band path remains the guaranteed default.

---

## 10. Explicit non-dependencies

- **No sampling.** Do not implement or advertise it (deprecated `2026-07-28`).
- **No MRTR.** Genie Code never calls `server/discover`; do not gate any interaction on
  `input_required` round-trips.
- **Streamable HTTP only.** No SSE-dependent flows.
- **No server→client request** of any kind is on the critical path.
- **Server-side FMAPI is allowed and is NOT a server→client call.** The `vibe_coach` model call
  (§4.6) goes server → Databricks serving endpoint, entirely inside the app's request handling; the
  client only ever calls a normal tool and reads the result. It does **not** use sampling (which is
  the *client's* model) and never reaches back to the client. It is fail-open and off the critical
  path — the track completes fully without it.

---

## 11. The Step-9 hard-stop exception

`gagent_benchmarks` (order 9) is the one step that is a **genuine required stop** (benchmark-answer
verification; roadmap §16 / prompt-standardization §20). Here the "silence advances" rule does
**not** apply:
- `interaction.decision.skippable = false`; `type:"confirm"`.
- The engine will **not** accept `vibe_complete_step` for step 9 until the confirmation answer is
  recorded via `vibe_submit_answer` (an explicit, still one-click confirm in chat).
- This is the only place the loop may block, and it blocks by design.

---

## 12. Open questions (defer to human)

1. **`vibe_submit_answer` vs. folding into `vibe_complete_step`.** One extra tool buys clean
   comprehension/decision capture; folding saves a tool-budget slot but overloads `complete_step`.
   Recommend the separate tool; confirm against the 20-tool budget with the user's likely other
   MCPs.
2. **Comprehension coaching source.** Inline in the manifest vs. authored in the template-repo
   `sections/*.md` pipeline (D5). Recommend the pipeline so questions are seeded, not hardcoded.
3. **v1 ambition** (from the plan's open decisions): ship read-only fetch-and-narrate first, then
   layer this interaction block — recommended — vs. building it in the first interactive cut.
