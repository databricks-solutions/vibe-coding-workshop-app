# phase2a-gate-report (app) — plan

Repo: app. Base: origin/feature/genie-code-mcp-integration @ 7e2b537 (#105 merged).
Plan file in PR: docs/superpowers/plans/2026-10-05-phase2a-gate.md
Report file in PR: docs/superpowers/plans/2026-10-05-phase2a-gate-report.md (mirrors 2026-10-04-phase3-exit-report.md in structure and tone).
Scope: B (the Phase 2A gate, RUN.md DONE §2). Lane: L (docs only). Reseed: no. No code, no tests.

## Purpose
A self-contained report that Phase 2A (coaching as a consolidation into vibe_explain_step) meets RUN.md §B. Each requirement maps to a merged PR, a pinning test, and a live-probe number. The report states what is NOT proven and lists the open questions that need a human. A reader without access to the forge state must be able to verify every claim from the app repo (tests, decision-log, git) plus the numbers quoted.

## Report outline (the implementer writes it; every claim cites file:line at 7e2b537, a test name, or a quoted probe number)
1. Summary: Phase 2A shipped across #98, #100, #101, #102, #103, #104 and #105 (merges a175f3a, c63d6c8, e775185, 54e255e, 4b57581, 429eb46, 7e2b537). Tool count 7. Backend suite 764 passed at 7e2b537 (re-run it in the worktree and quote the real count).
2. Requirement matrix (RUN.md §B, one row each: requirement → shipped where → pinned by → live evidence):
   - optional focus (what_now|why|unblock|review) on vibe_explain_step, LLM-enriched over step context, captured_outputs and prior interactions → mcp_server.py vibe_explain_step + services/coaching.py build_context; C1, C11; probe e775185 L3 (why, 909 chars, grounded_on keys).
   - fails open to the static StepHelpResult (is_fallback: true), never isError → C3, C4, C5; probe 54e255e (5/10 fallbacks, 0 isError).
   - the services/llm.py extract (D4 §1.2) → #98 / D-20; E1–E7.
   - _COACH_SYSTEM (D2 §12) → coaching.py COACH_SYSTEM, track-neutral; C2.
   - the leakage firewall (D7 §6.1): the input scrub, the output scrub failing closed (D-25, D-25a), reject-rule observability (D-26), no model or error text in logs (D-27 #103, D-28 #104) → C5, C16, R1–R8; probes 54e255e L2 (rule=overlap:prompt), 4b57581 (0 content lines after the deploy), 429eb46 (0 preview/traceback/body lines).
   - additive db/lakebase/ddl/13_mcp_coaching.sql (D6 §7a) → #101; C15; probe e775185 L1 (2 columns).
   - kill switch env, default on → VIBE_COACHING_ENABLED; C4.
   - D8 §4a tests → test_coaching.py C1–C19 (list the names).
   - knobs per D9 §9 q4 (app-default endpoint, ~400 max tokens, ~8 s, cached per (session_id, sectionTag, focus)) → coaching.py constants unchanged (D-29); C17; probe 7e2b537 (cache=hit repeats in 0.09–0.12 s).
   - tool count stays 7 → C12; every probe (quote 7).
   - REUSE the off-loop / budget / single-flight / negative-cache machinery; retry after failure tested → D-24 (_run_async_blocking reused, a helper in coaching.py); C8, C9, C10; probe 7e2b537 late success (prd what_now repeat returned 1277 cached chars).
   - coaching works on every track → C13 (coach(track="app-only")); CAVEAT: vibe_explain_step passes DEFAULT_TRACK because the session record isn't available there, and the walk itself is pinned until P4.1 (mcp_server.py ~:1492).
3. Latency evidence (probe 7e2b537, first calls, the medians quoted verbatim): project_setup db 6 / build 0 / model 6721.5 / total 6728.5 ms (client 6.815 s), 0/4 fallbacks; prd_generation db 6 / build 0 / model 8000 / total 8008 ms (client 8.126 s), 4/4 budget fallbacks; repeats are cache hits.
4. Decisions taken during 2A: D-20 … D-29, plus D-25a. One line each with the PR, all already in docs/superpowers/decision-log.md; verify each is present and list any missing as a gap.
5. What is NOT proven:
   - the redacted error branches were not exercised live (every live model call returned 200); they're covered by R5–R7 only;
   - coaching on tracks other than genie-accelerator through MCP (P4.1);
   - the step-prompt single-flight path wasn't migrated to the shared helper (D-24 follow-up);
   - only 2 steps × 4 foci were measured live.
6. Open questions for the HUMAN (each with the evidence and the reversible options; no decision taken):
   - Q1 Coaching budget: the model call is 99.9% of coaching latency; prd_generation hits the ≈8 s D9 budget on every first call (it degrades to static help, and the late answer is cached for the next call). Options: keep 8 s (current), raise VIBE_COACH_BUDGET_S (an env override, no code change), or accept first-call fallback on long steps.
   - Q2 llm.py ~:629 returns the serving endpoint's error body to the client in HTTPException.detail (a client response, not a log; out of D-27/D-28's scope). Keep or redact?
   - Q3 Intent-beat coaching: the probe saw the firewall reject a restated prompt (overlap:prompt). Acceptable fallback, or tune COACH_SYSTEM?
7. Follow-ups still queued (from forge queue.md, by slug): step-prompt-singleflight-migrate, usecase-beat-current-mismatch, usecase-beat-post-check, usecase-gate-sticky, header-count-projection, x3-fence-nits / test-fence-nits (the cosmetic test gaps from #102, #104 and #105 reviews).

## Fence
docs/superpowers/plans/2026-10-05-phase2a-gate.md (new; this plan) · docs/superpowers/plans/2026-10-05-phase2a-gate-report.md (new). Nothing else. If a fact can't be verified at 7e2b537, write "not verified" instead of asserting it.

## Acceptance
- Every matrix row cites a real file:line or test name at 7e2b537. The implementer must `git grep` / pytest -k each cited test name and quote that it exists.
- The quoted probe numbers match the lead's numbers above exactly (they come from the forge probes; quote them as-is).
- Backend suite count re-run and quoted (≥ 764, 0 failed).
- No code or test change (`git diff --stat` shows the 2 docs only).

## Green gates
cd <worktree> && DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= $APP/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q → ≥ 764 passed, 0 failed (quote it in the report).

## Live checks
None of its own (docs). The release is a code-only deploy of a docs merge; the prober runs the baseline (src/backend diff 0 lines, deployed files = git, 7 tools, clean logs).
