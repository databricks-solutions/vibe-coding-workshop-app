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
| **2B** ✅ | **Continuity & correctness (in-band, additive, ZERO new tools):** the shared **use-case selection** step before PRD — industry → certified-first use cases → author-your-own — producing the track-agnostic `use_case_brief` gate ([D11 §3](./mcp-workshop-usecase-selection.md)); and the **step-sync bridge** so the existing SPA reflects MCP progress ([D11 §4.3](./mcp-workshop-usecase-selection.md)). **Genie Accelerator only** (generalization is Phase 4). | D8 use-case-gate + sync-bridge tests green ([D11 §6](./mcp-workshop-usecase-selection.md)); **Phase 2 shipped** | **Shipped: PRs #45–#49, deployed to `fevm-serverless`.** `use_case_selection` step `produces:"use_case_brief"` (`manifest.json:1819,1825`); `prd_generation` `requiresGate:"use_case_selection"` (`manifest.json:1839`); sync bridge dual-writes `current_step`/`completed_steps` via `_legacy_progress` (`mcp_server.py:1256-1283`). Fixes the PRD-jump; a learner sees the same step across MCP and the web app. **(Historical: that `_legacy_progress` dual-write was retired in Phase 3 T5 R4a (#70) and all reads went gates-only in R4b (#71) — the bridge is superseded by gate-first reads; see the Phase 3 row.)** |
| **2A** | **Adaptive coaching — delivered as a *consolidation*, not a new tool (DEFERRED, not built).** The specced 7th tool `vibe_coach` (D2 §3.7) overlaps almost entirely with the **shipped** `vibe_explain_step` (`mcp_server.py:995`): same on-demand help niche, same current-step default, same grounding fields (`title/why/how_to_apply/expected_output`), and the coach's fail-open fallback *is* the static help `vibe_explain_step` already returns. **Plan:** extend `vibe_explain_step` with an optional `focus` (`what_now\|why\|unblock\|review`), LLM-enrich over the context it already assembles + `captured_outputs`/prior interactions, and **degrade to today's static `StepHelpResult`** (`is_fallback:true`). Still needs `services/llm.py` extract (D4 §1.2), `_COACH_SYSTEM` (D2 §12), leakage firewall (D7 §6.1), `13_mcp_coaching.sql` (D6 §7a). Cost/endpoint signed off 2026-09-24 (§9 q4). | D8 §4a green; **Phase 2 shipped** | On-demand, grounded coaching ("what now / why / unblock / review") — **fail-open** to static help; **tool count stays 7 (budget honored by design)**. Sequenced as its **own charter after Phase 3**. |
| **3** ◧ | Repoint UI to the engine; retire TS orchestration; live-sync mirror (engine-backed `GET /api/track/{track}/outline?session_id`, D4 §3.3). **Subsumes the 2B bridge** — makes the section/gate model the single source of truth, sync bidirectional. | parity stable; number↔tag flip (D6 §5) | Single brain; divergence eliminated. **Scoped 2026-09-27; Task 0 persists the track and fixes the live "0/28" resume defect.** **Shipped: T0–T4 (PRs #50/#51/#52/#53/#57/#59/#61) — track persistence, the `/api/track/{track}/outline` endpoint, the engine-vs-TS parity harness, the SPA read-path repoint, and the `getFilteredSections` TS-orchestration retirement. T5 (gates-only contract) is at R4b (#71): the legacy `current_step`/`completed_steps`/`skipped_steps` dual-write stopped in R4a (#70) and all reads went gates-only in R4b — deployed and soaking; the legacy-column DROP (D6 §5/§9) is pending (human holds the soak clock).** |
| **4** ◧ | Generalize to all tracks (incl. LLM-generated steps) + other surfaces. **Includes hoisting `use_case_selection` into the shared `define-usecase` section for all 14 manifest tracks** (D11 open q1): app-only, app-database, lakehouse, lakehouse-di, end-to-end, accelerator, genie-accelerator, data-engineering-accelerator, skills-accelerator, agents-accelerator, reverse-lakehouse, reverse-lakehouse-di, reverse-lakebase, reverse-app (`manifest.json:77` `tracks`). | — | Whole workshop is dual-surface. **Shipped per the [Phase 4 exit report](../../superpowers/plans/2026-10-08-phase4-exit-report.md) §1–§2 (APP #107–#126, TPL #18/#19; still 7 tools):** P4.1 track-scoped walk **PASS with caveat** (#107, D-30; `skills-track-silent-fallback` open); P4.2 use-case hoist **PASS** (#108, D-33/D-34); P4.3 every track walkable in Genie Code **PASS with caveat** (genie-code forks 1001–1022, 1024–1027, 1030–1033; v2 rows 1023/1028/1029 **held** on v1 934/940/941 by D-61; `agents-213-execution-label` open); P4.4 step-prompt generation **PARTIAL** (D-62: served on every track, within the 90 s budget only for `prd_generation`); P4.5 SPA any-track connect **PASS** (#124, D-59). **Other surfaces: not shipped** (out of the run's scope, FORGE RUN.md:120-121). |

**Key change from the pre-probe roadmap:** interactivity (Phase 2) is **not** gated on Genie Code
elicitation. It is built in-band and ships independently. If elicitation later appears (§8), it is a
purely additive enhancement (D1 §9), not a new phase.

**Phase 2A is decoupled.** It depends **only** on Phase 2 (it needs the `session_interactions` log
and the in-band model), touches different files than Phase 3 (MCP coaching handler + `services/llm.py`
vs. the UI repoint), and is **fail-open** — the track is fully functional without it. It may be built
**after Phase 2 in parallel with Phase 3**, or deferred, without disturbing the strict Phase 3→4
order. It is still an in-band pattern (server-side FMAPI, not a server→client protocol call, D1 §10).

**Phase 2B was likewise decoupled — and SHIPPED (PRs #45–#49).** It depended **only** on Phase 2, was
**additive** (a manifest step, two resources, one interaction block, a bridge write in
`vibe_complete_step`), added **zero tools**, and touched different files from 2A. It was prioritized
*before* 2A because it fixed a live defect (the PRD-jump) and delivered the human's step-sync ask.
**With 2B shipped, the recommended NEXT increment is Phase 3** ([`polly-charter-phase3.md`](./polly-charter-phase3.md)).
Phase 3's UI-repoint **subsumes** the 2B sync bridge (the bridge is the fast, backward-compatible
path; the repoint is the canonical one), and Phase 4 **generalizes** 2B's `use_case_selection` step to
all 14 manifest tracks (shipped in #108, D-33; `manifest.json` `requiresGate: "use_case_selection"`, e.g. :114, :272, :510). No renumbering of Phase 3→4. (Phase 2A — the coaching *consolidation* into
`vibe_explain_step` — is its own charter *after* Phase 3.)

**Shipped outside the phase plan (2026-09-27 reconciliation — code-verified).** The deployed MCP
surface is **7 tools** (`vibe_start_track`, `vibe_get_step`, `vibe_next_step`, **`vibe_explain_step`**,
`vibe_complete_step`, `vibe_submit_answer`, `vibe_set_parameters` — `mcp_server.py:848,924,966,995,1192,1313,1398`).
`vibe_coach` was **never built** (no `src/backend/services/llm.py`, no `db/lakebase/ddl/13_mcp_coaching.sql`).
These increments landed between Phase 2B and Phase 3, outside the D9 plan:
- `cb3fa95` — **anchor per-step ceremony**: slim step payload + `vibe_explain_step` (the 7th tool) + advisory post-check.
- `a8395d3` — **resume step-sync as single source of truth** (`completed_gates` → `SessionLoadResponse`; gate→number derivation; level restore). **Phase-3 foundation work.**
- `9723328` — MCP↔App CUJ: data-location confirm, deep-link handoff, session autosave.
- `0cfff13` / `8628927` / `e562606` / `96ae916` — per-step comprehension quizzes, authored `user_trigger_prompt`, crash fixes.

**Known defect (RESOLVED — Phase 3 Task 0 shipped, PR #50).** A resumed genie-code MCP session showed the
sync-bridge dense count on the session card ("Step 8 of 20") but "0/28 done" on open: the App
restores level `lakehouse-di` (`codingAssistants.ts:112` `DEFAULT_LEVEL_BY_ASSISTANT`) while the walk
is the `genie-accelerator` track, whose steps (57–73 in the SPA registry) are stripped from that
outline (`workflowSections.ts:774`). The gates persist correctly; only the restored outline was wrong.
**Fixed by Phase 3 Task 0** (MCP persists the track into `workshop_level`; the assistant→level lookup
became a corrected legacy fallback).

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
| Adaptive coaching code (`vibe_explain_step` extension, `services/llm.py`) | `deploy.sh --code-only -t <target>` | code redeploy (no reseed — `_COACH_SYSTEM` is a code constant, not seeded content) |
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
- **Phase 2A adds no new dependency.** The coaching path (the `vibe_explain_step` extension) reuses
  the existing serving-endpoint client behind `call_databricks_serving_endpoint` (`routes.py:1400`) —
  whatever HTTP/OpenAI client the app already pins. Extracting it to `services/llm.py` (D4 §1.2) is a
  move, not a new import to pin.

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
- [ ] **(Phase 2A — ship enabled, §9 q4)** `13_mcp_coaching.sql` applied (D6 §7a);
      `DATABRICKS_SERVING_ENDPOINT` = app default (`databricks-claude-sonnet-4-5`); coaching
      kill-switch env present and **on**; `max_tokens≈400` / `≈8 s` timeout / per-triple cache wired;
      fail-open verified (D5 §11.4); coaching tests green (D8 §4a).
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

**Human gates as shipped in the autonomous run (2026-10):**
- **Budget changes** → human. Raising the coaching budget (`VIBE_COACH_BUDGET_S`, the §9 q4 values)
  or `STEP_PROMPT_BUDGET_S` (`mcp_server.py:798`) is not taken by the run: it measures and parks
  (D-29; D-62; Phase 4 exit report §6 Q2).
- **Destructive data operations** → never automatic. The deploy tables step is additive by default and a
  destructive reseed needs a double opt-in (#109, D-35); the release deploy guard denies a tables
  reseed whose `db/` diff adds non-additive SQL ("destructive operations are human-only", D-50).
- **`main`** in either repo → human-only: no agent commits to, pushes to, or merges into `main`
  (D-5); the release-candidate PRs into `main` are opened, never merged, by the run (FORGE RUN.md:108).

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
| 2A | D8 §4a (coaching: grounding, fail-open, leakage scrub, read-only, provenance) + §7 coaching migration. **As run:** [Phase 2A gate report](../../superpowers/plans/2026-10-05-phase2a-gate-report.md) (#98–#105; 764 passed, 0 failed at 7e2b537) |
| 2B | D11 §6: manifest parity (`use_case_selection` before PRD; PRD `requiresGate`+`consumes`); resources certified-first; PRD locked-before-render gate; custom = session-local (no `saved_usecase_descriptions` write); sync bridge updates `current_step`/`completed_steps` |
| 3 | parity stable across UI repoint; no number-key consumers |
| 4 | per-track parity for each newly onboarded track. **As run:** [Phase 4 exit report](../../superpowers/plans/2026-10-08-phase4-exit-report.md) §2–§4 (per-track parity tests and live walks for all 14 tracks; 1640 passed, 0 failed at 89ee6f0) |

No CI today (D8 §11) — run the suites locally and record results in the PR before each deploy.

**Gate actually used per PR in the autonomous run (Phases 2A, 3 cleanup, 4):**
- **Offline suite floor:** `pytest tests/workshop tests/api -q` with 0 failed and passed ≥ the current
  floor (1640 at 89ee6f0, Phase 4 exit report :5-11; 764 at 7e2b537, Phase 2A gate report :3).
- **Genie gate:** FORGE `tools/genie_gate_diff.py` must print no new findings and no audit-key growth
  for any seed or template change (Phase 4 exit report §4; a held fork whose key grows does not ship, D-61).
- **Tampers:** each acceptance check is made red by a scripted tamper and restored byte-identically
  (e.g. the Phase 3 exit report's T1–T4 and X3b/X3c).
- **Live probe:** after each app merge and deploy, the forge prober walks the deployed app over HTTP and
  MCP and reads the served text only; no served instruction is executed (Phase 4 exit report :13, §5).

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
   **PARTLY RESOLVED (2026-10):** the canonical workspace is `fevm-serverless`, app
   `mcp-vibe-coding-workshop-app` (FORGE RUN.md:6-7; every Phase 2B–4 deploy, §1). **Still open:** the `-t` target name for installs from `main`.
2. **MCP mount feature-flag** — env var name + default (recommend default-off until Phase 1 sign-off).
   **RESOLVED (shipped code decides):** `MCP_MOUNT_ENABLED`, default off in code (`app.py:31`), set to
   `"true"` in the deploy template (`app.yaml.template:82-83`).
3. **Who owns the re-probe cadence** — tie it to a release checklist or a periodic reminder.
   **Still open.**
4. **Coaching model + cost (Phase 2A)** — **RESOLVED 2026-09-24 (ship enabled).** Reuse the **app
   default** endpoint (`databricks-claude-sonnet-4-5`); `max_tokens≈400`; `≈8 s` timeout with
   **fail-open** to static coaching; **cache per `(session_id, sectionTag, focus)`** (D2 §12 q4). Keep
   a coaching **kill-switch** env (default **on**) so it can be disabled without a code revert (§6).
   The per-invocation FMAPI cost was reviewed and accepted; the remaining human gate is the deploy
   itself (§5), not the endpoint/knob choice.
5. **Genie gate change for the held v2 rows (Phase 4, D-61)** *(open, human)* — the gate counts
   superseded seed versions, so v2 rows 1023/1028/1029 cannot ship unchanged. (a) count only the
   highest active version per (section_tag, coding_assistant), or (b) keep the gate and leave the
   three tags on v1 934/940/941 (Phase 4 exit report §6 Q1).
6. **Step-prompt budget (Phase 4, D-62)** *(open, human)* — `iterate_enhance`, `skill_define_strategy`
   and `skill_create_skillmd` exceed the 90 s budget (`mcp_server.py:798`). (a) larger max_tokens or a
   smaller output contract for rows 14/131/132, (b) async or deferred generation, (c) accept the
   template fallback (current), or (d) raise `STEP_PROMPT_BUDGET_S` (Phase 4 exit report §6 Q2).
