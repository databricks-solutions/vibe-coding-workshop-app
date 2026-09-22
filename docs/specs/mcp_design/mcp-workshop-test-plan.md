# D8 — Test & Verification Plan

**Status:** Draft · **Doc ID:** D8 · **Date:** 2026-09-22 · **Target repo:** `vibe-coding-workshop-app`
**Series:** [`README.md`](./README.md)
**Depends on:** [D2 interface](./mcp-interface-contract.md) · [D3 domain](./workshop-engine-domain.md)
· [D6 data model](./mcp-workshop-data-model.md) · [D1 interactivity](./mcp-workshop-interactivity.md).
**Extends:** roadmap §15. **Grounded in:** the probe (plan §1) + generic spec §9.

> **Scope.** Every check that must pass before the MCP surface ships: engine parity, MCP contract,
> interactivity, the deployment regressions the probe exposed, statelessness, data-model migration,
> a live Genie Code smoke, and the reusable capability re-probe.

---

## 0. Anchors verified live (2026-09-22)

| Fact | Value |
|---|---|
| Existing test layout | `tests/api/*.py` (Python API tests) · `tests/e2e/*.spec.ts` (Playwright) · `tests/fixtures/` |
| Deploy/reseed | `./scripts/deploy.sh --tables-only` (reseed) · `--code-only [-t <target>]` (deploy) |
| Assembler under test | `get_section_input_content` `routes.py:1241` |
| Progression source | `getFilteredSections` `workflowSections.ts:729`; `getNextIncompleteStep` `App.tsx:441` |
| No CI today | run suites locally; record results in each PR (roadmap §15) |

New engine/MCP tests land under `tests/api/` (Python) or a new `tests/workshop/`; the live smoke
under `tests/e2e/` conventions.

---

## 1. Test layers

| Layer | What it proves | § |
|---|---|---|
| Engine / domain | manifest ↔ UI parity; assembler byte-parity; progression correctness | §2 |
| MCP contract | tool/resource/prompt shapes, annotations, output/error contracts | §3 |
| Interactivity | in-band patterns, recommend-and-proceed, Step-9 hard-stop, capability negotiation | §4 |
| Deployment regression | 307-no-redirect, mount order, lifespan | §5 |
| Statelessness | two-session isolation; per-request reads | §6 |
| Data model | additive DDL, dual-write, number↔tag, interaction log | §7 |
| Live smoke | end-to-end in real Genie Code | §8 |
| Re-probe | detect if/when Genie Code gains elicitation | §9 |
| Content lint | interaction blocks, decision defaults, tone | §10 |

---

## 2. Engine / domain tests (D3)

`tests/workshop/test_manifest_parity.py` (roadmap §15) and friends:

1. **Order parity** — engine `outline(track, defaults)` ordered `sectionTag`s ==
   `getFilteredSections(level, defaultDisabledTags…)` flattened, per track (genie: ontology **off**).
2. **Flag parity** — `includeGenieOntology=true` re-introduces `ontology_*` in the same positions.
3. **Chaining parity** — each step's `consumes` resolves to the same upstream keys as the
   `WorkflowDiagram.tsx` / `stepPreviousOutputs.ts` literals (translated number→tag).
4. **Assembler byte-parity** — `workshop/assembler.get_section_input_content(...)` output ==
   `routes.get_section_input_content(...)` **byte-for-byte** for a sample of genie `sectionTag`s
   (fork **and** default). This is the "no second assembler" guarantee (D3 §9.4).
5. **Progression units** — `next_step`, `can_start`, status enum transitions; `complete_step`
   idempotency (D3 F3); locked-step guard (F2); unknown-tag guard (F1).

CI-equivalent: run locally; a red parity test blocks the change (D3 §9).

---

## 3. MCP contract tests (D2)

`tests/workshop/test_mcp_contract.py`:

- **Budget:** exactly **6 tools** exposed (D2 §9); fail if a 7th appears.
- **Per tool:** non-empty description in the 200–400 char band; `inputSchema` present and flat
  (< 8 params); `outputSchema` present; **all four annotations** set (D2 §8).
- **Output contract:** every tool returns `structuredContent` validating against its `outputSchema`
  **and** a mirrored text block (D2 §7).
- **Error taxonomy:** each error path returns `isError:true` with a code from D2 §6 — never a
  protocol exception. Table-drive the codes (`UNKNOWN_TRACK`, `STEP_LOCKED`, `UI_DRIVEN_STEP`,
  `GATE_REQUIRED`, …).
- **Resources:** each declares `ttlMs` + `cacheScope`; `vibe://session/{id}/state` is no-cache
  (D2 §4).
- **Prompts:** the 2 prompt entries resolve to messages that restate the verbatim-first contract
  (D2 §5).

---

## 4. Interactivity tests (D1)

`tests/workshop/test_interactivity.py`:

- **Interaction block shape** — `vibe_get_step` payloads with an `interaction` validate against the
  D1 §6 schema; absence ⇒ pure fetch-and-narrate still valid.
- **`vibe_submit_answer`** — records to `session_interactions` (D6 §3) and returns coaching;
  comprehension coaching keyed by option.
- **Recommend-and-proceed invariant** — any `type:"decision"` interaction **must** carry a
  `recommended` value (D5 §3 anti-pattern). Fail otherwise.
- **Step-9 hard-stop** — `vibe_complete_step("gagent_benchmarks")` returns `GATE_REQUIRED` until a
  `confirm` answer is recorded; then it succeeds (D1 §11 / D2 §6).
- **Capability negotiation** — with a client declaring `capabilities:{}` (the probe case), the
  server serves the **in-band** path and never emits an `elicitation/create` (D1 §2). With a
  synthetic elicitation-capable client, the upgrade path is exercised but remains optional.
- **Self-serve / first-run (D1 §1a)** — the `Start the Genie Accelerator` prompt and the first
  `vibe_get_step` result carry the orientation preamble (D1 §4.5); `Continue where I left off` does
  **not**; the `vibe://guide/getting-started` resource resolves and contains the setup/troubleshoot
  copy; and the `How does this workshop work?` prompt resolves without any tool knowledge. Assert an
  orientation-free client can reach "step 1 presented" using only prompts + resources (the
  self-serve acceptance, D9 Phase 1).

---

## 5. Deployment regression tests (probe-exposed)

`tests/api/test_mcp_mount.py`:

- **307-no-redirect (the big one):** `POST /mcp` returns **200**, not 307 (plan §1.3.2 / generic
  §4.2). Assert no `Location: /mcp/` redirect.
- **Mount order:** a request to `/mcp` is **not** served `index.html` (mounted before the SPA
  catch-all `app.py:162`; `serve_spa` excludes `/mcp`).
- **Lifespan:** the FastMCP session manager is started (a basic `initialize` handshake succeeds),
  proving the lifespan was composed (generic §4.3).

---

## 6. Statelessness & concurrency (D7 §5)

- **Two-session isolation:** interleave tool calls for identities A and B; assert neither observes
  the other's outline/gates/outputs.
- **Per-request freshness:** mutate state out-of-band, then a read reflects it (no stale in-process
  cache).
- **Idempotent retries:** re-issue `complete_step` for a done gate → success, no duplicate
  (D3 F3).

---

## 7. Data-model tests (D6)

`tests/api/test_engine_state.py`:

- **Additive DDL idempotent:** `12_mcp_engine_state.sql` re-runs cleanly (`IF NOT EXISTS`); legacy
  sessions get empty tag stores (D6 §7).
- **Dual-write:** `complete_step` writes both `completed_steps` (number) and `completed_gates`
  (tag) during migration (D6 §5).
- **Number↔tag map:** derived from the manifest, not stored; round-trips for every genie step
  (D6 §5).
- **Interaction log append:** `submit_answer` inserts exactly one `session_interactions` row with
  provenance (D6 §3).

---

## 8. Live Genie Code smoke (manual + scripted)

The one test only a real workspace can run (roadmap §15). Runbook:

1. Deploy an `mcp-`-named app to the same workspace (`deploy.sh --code-only -t <target>`).
2. In Genie Code (**Agent mode**), add the app as a Custom MCP server (D10).
3. Invoke the `Start the Genie Accelerator` prompt → `vibe_start_track` → `vibe_get_step` returns
   the **verbatim** prompt + `why` + `how_to_apply` + `gate` + `next`.
4. Answer an in-band comprehension check in chat → coaching returned.
5. Execute the step → `vibe_complete_step` advances `next_step`.
6. Open the SPA on the same `session_id` → the gate shows checked, narrative advanced (§ cross-
   surface, D4 §3.3).
7. At `gagent_benchmarks`, confirm the hard-stop blocks until confirmed (§4 / D1 §11).

Scriptable parts (handshake, tool calls, 307 check) can run headless against the deployed `/mcp`;
the Genie-Code-driven parts are manual.

---

## 9. Capability re-probe harness (reusable)

Keep the probe server from generic spec §9.2 runnable (a `tests/tools/mcp_probe/`). Purpose: detect
the day Genie Code advertises `elicitation` (which flips D1's upgrade path from optional to
available). Run it against the target workspace on each Genie Code release or before committing the
interactivity phase (D9 §8). Output: the captured `initialize` `capabilities` (plan §1.1).

---

## 10. Content lint (D5)

Extend the template-repo `lint_section_prompts.py` scoped check (D5 §5.2):
- every `type=decision` interaction block declares a `recommended` value;
- questions/coaching live **outside** `## Input Template` (verbatim body untouched, D1 §7);
- prose passes the `humanizer` / `economist-style` bars (advisory, not blocking).

---

## 11. Invocation (no CI today)

Run locally and record results in the PR (roadmap §15):
- Python: `pytest tests/workshop tests/api` (add the new files).
- Frontend build/lint: `npm run build` + lint clean (roadmap §15).
- Playwright smoke: `tests/e2e` conventions for the deployed check.

There is no CI wired for these yet — the parity/contract tests are the guardrail and **must** be run
before every deploy (D9 §7).

---

## 12. Coverage matrix (spec → test)

| Spec claim | Test |
|---|---|
| One engine, one assembler (D3 §7) | §2.4 byte-parity |
| Manifest never drifts from UI (D3 §9) | §2.1–§2.3 parity |
| 6-tool budget (D2 §9) | §3 budget |
| All four annotations (D2 §8) | §3 per-tool |
| Errors in-result (D2 §6) | §3 error taxonomy |
| No elicitation dependency (D1 §2) | §4 capability negotiation |
| Self-serve by construction (D1 §1a) | §4 self-serve / first-run |
| Recommend-and-proceed default (D5 §3) | §4 + §10 |
| Step-9 hard-stop (D1 §11) | §4 |
| 307-no-redirect (plan §1.3.2) | §5 |
| Stateless isolation (D7 §5) | §6 |
| Additive, reseed-safe DDL (D6) | §7 |

---

## 13. Open questions (defer to human)

1. **New test dir vs. `tests/api/`** — a dedicated `tests/workshop/` (recommended) vs. folding into
   `tests/api/`.
2. **Headless `/mcp` client for the scripted smoke** — reuse the probe client vs. a minimal MCP
   SDK client.
3. **Byte-parity sample size** — which genie `sectionTag`s (fork+default) form the golden set for
   §2.4; recommend all `semlayer_*` + `gagent_*` at minimum.
