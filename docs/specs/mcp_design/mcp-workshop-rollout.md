# D9 — Rollout & Deploy Runbook

**Status:** Draft · **Doc ID:** D9 · **Date:** 2026-09-22 · **Target repo:** `vibe-coding-workshop-app`
**Series:** [`README.md`](./README.md)
**Depends on:** all prior specs (D1–D8). **Extends:** roadmap §14. **Grounded in:** the probe
(plan §1) + generic spec §4.

> **Scope.** The phased rollout (revised so the interactivity layer does **not** wait on
> elicitation), the reseed-vs-redeploy matrix, dependency pinning, the deploy preflight checklist
> (the probe gotchas), STOP-and-ask gates, rollback, and the re-probe trigger.

---

## 0. Anchors verified live (2026-09-22)

| Fact | Value |
|---|---|
| Deploy (code) | `./scripts/deploy.sh --code-only [-t <target>] [--skip-build]` |
| Reseed (content/tables) | `./scripts/deploy.sh --tables-only` |
| Full deploy | `./scripts/deploy.sh -t <target>` |
| Python deps | `requirements.txt` (this repo pins here — **no `uv.lock`/`pyproject.toml`**) |
| Prompt pipeline | template repo `sections/*.md` → `sync_markdown_to_seed.py` → seed SQL (not in this app repo) |
| Probe workspace used | `fevm-serverless` |

> **Note vs. the workspace rules.** The `uv` / `./scripts/test.sh` invocation in the ambient rules
> is for a *different* repo (Genie Workbench). **This** app pins via `requirements.txt` and deploys
> via `scripts/deploy.sh`. Follow the anchors above.

---

## 1. Revised phasing (elicitation decoupled)

Roadmap §14 with the probe folded in: **Phase 1 read-only ships now (unblocked), and the
interactivity layer is its own phase that does NOT wait on any capability upgrade.**

| Phase | Scope | Gate to enter | Outcome |
|---|---|---|---|
| **0** ✅ | Engine: manifest + progression + assembler extraction + parity test (D3). UI unchanged. | D8 §2 green | Backend owns the walk; no user-visible change. |
| **1** ✅ | Mount FastMCP `/mcp/`; **read-only** tools (`start_track`, `get_step`, `next_step`) + engine REST routes; the self-serve on-ramp: orientation prompt, `vibe://guide/getting-started`, and the SPA "Connect to Genie Code" panel (D1 §1a, D4 §1.1). | D8 §3, §5 green; live smoke §8 read path; **self-serve acceptance** (below) | Genie Code walks the track verbatim — **no copy-paste**. **Ships now; no elicitation dependency.** |
| **2** ✅ | **Interactivity + state (in-band):** `complete_step`, `submit_answer`, `set_parameters`, resources, the `interaction` block (D1), Lakebase columns + interaction log (D6), auth + annotations. | D8 §4, §6, §7 green | Full guided loop: gates, decisions, comprehension checks — **all in-band, no elicitation**. **Shared session store + cross-surface handoff** (same `session_id`, OBO-scoped): each surface can resume the other's session. *Step-progress **visibility** in the SPA is NOT yet delivered here* — MCP writes `completed_gates`/`captured_outputs` while the legacy SPA reads `current_step`/`completed_steps`; that reconciliation is Phase 2B (bridge) / Phase 3 (canonical). **Shipped: PRs #40–#44, deployed to `fevm-serverless`, smoke green (6 tools).** |
| **2A** | **Adaptive coaching (LLM, in-band):** `vibe_coach` tool (D2 §3.7), `services/llm.py` FMAPI extract (D4 §1.2), `_COACH_SYSTEM` + `CoachResult` (D2 §12), coaching provenance columns `13_mcp_coaching.sql` (D6 §7a), leakage firewall (D7 §6.1). | D8 §4a green; **Phase 2 shipped** | On-demand, grounded, personalized coaching ("what now / why / unblock / review") — **fail-open** to the authored static coaching; adds one tool (→7). |
| **2B** | **Continuity & correctness (in-band, additive, ZERO new tools):** the shared **use-case selection** step before PRD — industry → certified-first use cases → author-your-own — producing the track-agnostic `use_case_brief` gate ([D11 §3](./mcp-workshop-usecase-selection.md)); and the **step-sync bridge** so the existing SPA reflects MCP progress ([D11 §4.3](./mcp-workshop-usecase-selection.md)). **Genie Accelerator only** (generalization is Phase 4). | D8 use-case-gate + sync-bridge tests green ([D11 §6](./mcp-workshop-usecase-selection.md)); **Phase 2 shipped** | Fixes the PRD-jump (PRD no longer renders against `DEFAULT_USE_CASE`); a learner sees the same step across MCP and the web app. |
| **3** | Repoint UI to the engine; retire TS orchestration; live-sync mirror (engine-backed `GET /api/track/{track}/outline?session_id`, D4 §3.3). **Subsumes the 2B bridge** — makes the section/gate model the single source of truth, sync bidirectional. | parity stable; number↔tag flip (D6 §5) | Single brain; divergence eliminated. |
| **4** | Generalize to all tracks (incl. LLM-generated steps) + other surfaces. **Includes hoisting `use_case_selection` into the shared `define-usecase` section for all ten tracks** (D11 open q1). | — | Whole workshop is dual-surface. |

**Key change from the pre-probe roadmap:** interactivity (Phase 2) is **not** gated on Genie Code
elicitation. It is built in-band and ships independently. If elicitation later appears (§8), it is a
purely additive enhancement (D1 §9), not a new phase.

**Phase 2A is decoupled.** It depends **only** on Phase 2 (it needs the `session_interactions` log
and the in-band model), touches different files than Phase 3 (MCP coaching handler + `services/llm.py`
vs. the UI repoint), and is **fail-open** — the track is fully functional without it. It may be built
**after Phase 2 in parallel with Phase 3**, or deferred, without disturbing the strict Phase 3→4
order. It is still an in-band pattern (server-side FMAPI, not a server→client protocol call, D1 §10).

**Phase 2B is likewise decoupled — and is the recommended NEXT increment.** It also depends **only**
on Phase 2, is **additive** (a manifest step, two resources, one interaction block, a bridge write in
`vibe_complete_step`), adds **zero tools**, and touches different files from 2A. Ordering is by
*priority, not label*: **2B fixes a live defect (the PRD-jump) and delivers the human's step-sync ask,
so it is recommended before 2A** (a coaching *enhancement* that also carries a cost sign-off, §9 q4).
2A and 2B can run in parallel; both precede Phase 3. Phase 3's UI-repoint **subsumes** the 2B sync
bridge (the bridge is the fast, backward-compatible path; the repoint is the canonical one), and
Phase 4 **generalizes** 2B's `use_case_selection` step to all ten tracks. No renumbering of Phase 3→4.

**Self-serve acceptance gate (Phase 1 exit, D1 §1a).** Ship only when a **first-time learner, given
just the app URL and no other instructions or human help**, can: land on the app page → follow the
"Connect to Genie Code" panel → be oriented by the server → reach "step 1 presented." The one manual
step (paste the `/mcp` URL) is expected; everything after it must be server-driven. Verified by
D8 §4 (self-serve / first-run) plus the live smoke (D8 §8).

---

## 2. Reseed vs. redeploy matrix

| Change | Command | Why |
|---|---|---|
| Prompt content / question bank (`sections/*.md`) | template-repo sync → `deploy.sh --tables-only` | content lives in Lakebase; reseed only |
| Manifest / engine / adapter code | `deploy.sh --code-only -t <target>` | code redeploy |
| New Lakebase columns/tables (D6 `12_*.sql`) | `deploy.sh --tables-only` (additive, idempotent) | DDL apply |
| Coaching columns (D6 `13_*.sql`, Phase 2A) | `deploy.sh --tables-only` (additive, idempotent) | DDL apply after `12_` |
| Adaptive coaching code (`vibe_coach`, `services/llm.py`) | `deploy.sh --code-only -t <target>` | code redeploy (no reseed — `_COACH_SYSTEM` is a code constant, not seeded content) |
| Use-case step code (manifest, resources, interaction, bridge — Phase 2B) | `deploy.sh --code-only -t <target>` | code redeploy (manifest/adapter change) |
| `use_case_selection` prompt content (if the step ships a `sections/*.md` body) | template-repo sync → `deploy.sh --tables-only` **then** `--code-only` | content lives in Lakebase; reseed before the code that renders it |
| Both (e.g. new interactive step + its prompt) | `--tables-only` **then** `--code-only` | content first, then code |
| Backend-only code (no frontend) | `deploy.sh --code-only --skip-build -t <target>` | faster |

Roadmap rule: **prompt-content changes require reseed + redeploy; engine/adapter changes require a
code redeploy.**

---

## 3. Dependency pinning

- Add `mcp` (FastMCP) **pinned to an exact version** in `requirements.txt` (this repo's pinning
  file). Pin `fastapi`/`uvicorn` consistent with the current app.
- MCP's release cadence changes handshake behavior — never float the version (generic §4.7).
- After bumping, re-run the deployment regression tests (D8 §5), especially the 307 and lifespan
  checks, since transport behavior can shift across `mcp`/`fastmcp` patch releases.
- **Phase 2A adds no new dependency.** `vibe_coach` reuses the existing serving-endpoint client
  behind `call_databricks_serving_endpoint` (`routes.py:1400`) — whatever HTTP/OpenAI client the app
  already pins. Extracting it to `services/llm.py` (D4 §1.2) is a move, not a new import to pin.

---

## 4. Deploy preflight checklist (the probe gotchas)

Before any `/mcp` deploy (plan §1.3 / generic §4 / D4 §2):

- [ ] App name starts with **`mcp-`**.
- [ ] `/mcp` mounted **before** the SPA catch-all (`app.py:162`); `serve_spa` excludes `/mcp`.
- [ ] `POST /mcp` returns **200, not 307** (path rewrite in place; D8 §5).
- [ ] MCP app **lifespan composed** into the parent (`app.py:34`); handshake succeeds.
- [ ] `stateless_http=True`; no in-process correctness state.
- [ ] CORS unchanged for `/mcp` (goes through the auth proxy; D7 §3); SPA allowlist intact.
- [ ] `/mcp` rate-limit decision recorded (D7 §4).
- [ ] `mcp`/`fastmcp` pinned in `requirements.txt`.
- [ ] Parity + contract tests green (D8 §2–§3).
- [ ] **(Phase 2A)** `13_mcp_coaching.sql` applied (D6 §7a); `DATABRICKS_SERVING_ENDPOINT` set (or
      confirm fail-open static coaching is acceptable, D5 §11.4); coaching tests green (D8 §4a).
- [ ] **(Phase 2B)** tool count still **≤7** (use-case work adds zero tools); `prd_generation` is
      gated on `use_case_selection` and renders against the locked use case; `vibe_complete_step`
      updates `current_step`/`completed_steps` (sync bridge); D11 §6 tests green; if a
      `use_case_selection` prompt body was added, reseed ran **before** the code redeploy.

---

## 5. STOP-and-ask gates

- **Deploy to any real workspace** → explicit human OK (roadmap golden rule). Never auto-deploy.
- **Reseed** (`--tables-only`) → confirm the content diff (prompt/question changes) was reviewed.
- **Number↔tag flip** (Phase 3) → confirm no external consumer reads legacy number keys (D6 §9).
- **`databricks bundle init`** → never run (destroys config; roadmap).

---

## 6. Rollback

- **Feature-flag the `/mcp` mount** — a config toggle to disable the MCP surface without reverting
  the engine (the engine is safe; the UI is unchanged through Phase 2).
- **Additive DDL is safe** — new columns/tables (D6) don't break existing rows; no destructive
  rollback needed. Leaving them in place after a code revert is harmless.
- **Code revert** — `deploy.sh --code-only` to the prior build; Lakebase state is compatible
  because writes are additive and dual-keyed (D6 §5).
- **Content revert** — re-sync the prior `sections/*.md` and `--tables-only`.

---

## 7. Per-phase verification gates (tie to D8)

| Phase | Must be green before ship |
|---|---|
| 0 | D8 §2 (engine/parity/byte-parity) |
| 1 | D8 §3 (contract), §5 (307/mount/lifespan), §8 read-path smoke |
| 2 | D8 §4 (interactivity), §6 (isolation), §7 (data model), §8 full smoke |
| 2A | D8 §4a (coaching: grounding, fail-open, leakage scrub, read-only, provenance) + §7 coaching migration |
| 2B | D11 §6: manifest parity (`use_case_selection` before PRD; PRD `requiresGate`+`consumes`); resources certified-first; PRD locked-before-render gate; custom = session-local (no `saved_usecase_descriptions` write); sync bridge updates `current_step`/`completed_steps` |
| 3 | parity stable across UI repoint; no number-key consumers |
| 4 | per-track parity for each newly onboarded track |

No CI today (D8 §11) — run the suites locally and record results in the PR before each deploy.

---

## 8. Re-probe trigger (elicitation watch)

Re-run the capability probe (D8 §9 / generic §9) when **any** of:
- a new Genie Code release ships;
- before committing the Phase 2 interactivity work (sanity-check the floor hasn't moved);
- Databricks announces MCP client upgrades (elicitation / `server/discover` / `2026-07-28`).

If the probe shows `elicitation` is now advertised, open a follow-up to enable D1 §9's upgrade path
(additive; in-band remains the default).

---

## 9. Open questions (defer to human)

1. **Deploy target names** — confirm the `-t <target>` values (e.g. `production`) and the canonical
   workspace for the MCP app.
2. **MCP mount feature-flag** — env var name + default (recommend default-off until Phase 1 sign-off).
3. **Who owns the re-probe cadence** — tie it to a release checklist or a periodic reminder.
4. **Coaching model + cost (Phase 2A)** — reuse the app default endpoint
   (`databricks-claude-sonnet-4-5`) or a smaller/cheaper one for coaching; set `max_tokens`/timeout
   and whether to cache per `(session_id, sectionTag, focus)` (D2 §11 q4). Coaching adds
   per-invocation FMAPI cost — confirm it is acceptable, or ship Phase 2A **flagged off** and enable
   after review. A serving-endpoint or cost decision is a human sign-off, like any deploy (§5).
