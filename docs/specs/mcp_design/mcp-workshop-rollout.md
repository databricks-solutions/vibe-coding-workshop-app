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
| **0** | Engine: manifest + progression + assembler extraction + parity test (D3). UI unchanged. | D8 §2 green | Backend owns the walk; no user-visible change. |
| **1** | Mount FastMCP `/mcp/`; **read-only** tools (`start_track`, `get_step`, `next_step`) + engine REST routes. | D8 §3, §5 green; live smoke §8 read path | Genie Code walks the track verbatim — **no copy-paste**. **Ships now; no elicitation dependency.** |
| **2** | **Interactivity + state (in-band):** `complete_step`, `submit_answer`, `set_parameters`, resources, the `interaction` block (D1), Lakebase columns + interaction log (D6), auth + annotations. | D8 §4, §6, §7 green | Full guided loop: gates, decisions, comprehension checks, cross-surface sync — **all in-band, no elicitation**. |
| **3** | Repoint UI to the engine; retire TS orchestration; live-sync mirror. | parity stable; number↔tag flip (D6 §5) | Single brain; divergence eliminated. |
| **4** | Generalize to all tracks (incl. LLM-generated steps) + other surfaces. | — | Whole workshop is dual-surface. |

**Key change from the pre-probe roadmap:** interactivity (Phase 2) is **not** gated on Genie Code
elicitation. It is built in-band and ships independently. If elicitation later appears (§8), it is a
purely additive enhancement (D1 §9), not a new phase.

---

## 2. Reseed vs. redeploy matrix

| Change | Command | Why |
|---|---|---|
| Prompt content / question bank (`sections/*.md`) | template-repo sync → `deploy.sh --tables-only` | content lives in Lakebase; reseed only |
| Manifest / engine / adapter code | `deploy.sh --code-only -t <target>` | code redeploy |
| New Lakebase columns/tables (D6 `12_*.sql`) | `deploy.sh --tables-only` (additive, idempotent) | DDL apply |
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
