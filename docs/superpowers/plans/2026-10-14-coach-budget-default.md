# Plan: coach-budget-default — SIGNED (D-108: option K, 20 s)

- Date: 2026-10-14 · Repo: app · Base: origin/feature/genie-code-mcp-integration at 8c84de6 (after #140)
- Proposed by: human (2026-10-14, item 4). Status: D-108 signed by the human (option K, 20 s). Option R and
  the "Questions for the human" below are closed; implement K only. Line numbers were taken at f461643;
  #140 (docs only) edited rollout.md and the smoke script's neighbours, so re-locate doc lines by content.
- Commit this file at docs/superpowers/plans/<dispatch-date>-coach-budget-default.md
- Amends D-106 (draft wording below). Release: merge only (D-91). No deploy, no reseed, no DDL, no new MCP tool.
- Serialization: touches no trunk file (coaching.py is not on the trunk list); must not run in parallel with
  spec-vibe-coach-sweep because both append to docs/superpowers/decision-log.md and both edit
  docs/specs/mcp_design/mcp-workshop-rollout.md. Dispatch after that PR merges.

## Why

D-106 put 20 s in the tracked `app.yaml.template` only. `app.yaml` is generated from it by
`scripts/vibe2value.py:140` and is git-ignored, so any deployment whose `app.yaml` predates #139 (or was
hand-written) silently runs the code default, 8.0 s, and coaching on the heavier genie-accelerator steps
falls back on timeout (state/probes/coach-timeout-8s.md: real model time 7.4–16.7 s). Making 20.0 the
code default removes that dependency; the env override stays for operators.

## Change

1. `src/backend/services/coaching.py:69` — `COACH_BUDGET_S = 8.0` → `COACH_BUDGET_S = 20.0`. Nothing else
   in coaching.py changes: `_knob` (:87), `COACH_MAX_TOKENS`, `COACH_NEGATIVE_TTL_S`, the model, the scrub
   functions and `COACH_SYSTEM` are untouched (scrub rules are a human constraint).
2. `app.yaml.template:34–35` — **keep** the `VIBE_COACH_BUDGET_S: "20"` entry (recommended, option K).
   It is now redundant with the default but keeps the operator knob visible and keeps
   `tests/workshop/test_app_template_env.py` meaningful. Edit only its comment, to exactly:
   "matches the code default; set to override" (human ruling, D-108: option K chosen).
   Alternative R (human may choose): remove the entry and delete/repurpose test_app_template_env.py, so the
   code default is the single source of truth. R is less reversible (two files) and drops a visible knob.
3. Tests that pin the old default, updated to 20.0 (intentional; no assertion weakened):
   - `tests/workshop/test_coaching.py:825` (`test_c17_defaults_unchanged`): `== 8.0` → `== 20.0`.
   - `tests/workshop/test_coaching.py:833`: `budgets == [8.0]` → `[20.0]`.
   - `tests/workshop/test_coaching.py:878` (`test_c18_env_overrides`, bad values fall back to default):
     `== 8.0` → `== 20.0`.
   - Tests that monkeypatch `COACH_BUDGET_S` to 0.2/0.3 (:264, :485) or set the env (:845, :850, :939) are
     unchanged.
   - New assertion in test_c17: the unset-env path yields 20.0 end to end through the call site
     (`coaching.py:371`), so a default regression can't hide behind the template.
4. Docs (current-tense claims only; history stays):
   - `docs/specs/mcp_design/mcp-workshop-rollout.md:157–164` — the D-106 bullet: code default is now 20.0
     (D-108); the template entry is an override; the 32-worker pool exposure (`executor.py:25`) now applies
     to every deployment, not only those with the env line.
   - `docs/superpowers/genie-code-smoke-script.md:154` and `:636` — "8.0 s by default … 20 s where app.yaml
     sets …" → "20 s by default (`coaching.py:69`), overridable with `VIBE_COACH_BUDGET_S`". :636's mention
     of the 54e255e probe stays as history.
   - `docs/specs/mcp_design/mcp-interface-contract.md:626` — check context; if it states the current
     budget, update to 20 s with D-108; if it records the Phase 2A plan, leave it.
   - D9 :140/:235 and the polly charters' `≈8 s` are rollout/charter history: not edited.
5. `docs/superpowers/decision-log.md` — append, after the last entry (D-109 at 8c84de6), verbatim from
   FORGE/state/lead/decisions.md: the "D-108 SIGNED" line, D-110, D-111, D-112, D-113, D-114. The
   provisional D-108 already in the log stays as written (history).

## Risk

- Every deployment now holds a worker thread up to 20 s per coaching call (was 8 s unless overridden).
  The live probe showed the wait runs on the 32-worker pool via `asyncio.to_thread`
  (`mcp_server.py:368`) and `/health` is unaffected (state/probes/mcp-loop-blocking.md); with > 32
  concurrent coaching calls, other MCP tool calls queue. Same exposure #139 already accepted where the
  env line is set.
- Local dev and CI: no test waits on the real budget (tests monkeypatch it), so suite time is unchanged.

## Acceptance (for the critic and gatekeeper once signed off)

- A1 Fence: coaching.py, app.yaml.template (comment only under K), test_coaching.py, test_app_template_env.py
  (only if R), rollout.md, genie-code-smoke-script.md, mcp-interface-contract.md (only if :626 is current
  tense), decision-log.md, the plan. Nothing else.
- A2 `git diff` of coaching.py is exactly the one constant line; scrub functions and COACH_SYSTEM byte-identical.
- A3 With VIBE_COACH_BUDGET_S unset, the budget passed to the model call is 20.0; with it set to 5.5 it is
  5.5; with 0/abc/-1/inf it is 20.0 plus the existing WARNING (name only).
- A4 Under K, the template still parses and its entry is still 20 (existing test green).
- A5 Suite ≥ 1892 passed, 0 failed.
- Tampers: revert the constant to 8.0 (test_c17 red); set it to 0 (A3 red); remove the end-to-end
  assertion and revert the constant (the new assertion's absence is caught by A3's script); edit a scrub
  function (A2 red).
- Live checks after the human deploys: deploy WITHOUT the env line in app.yaml (or confirm the line is
  absent) and repeat the #139 latency probe; expect no fallback:timeout and total_ms < 20000.

## D-108 — draft wording for sign-off (amends D-106)

- D-108 (2026-10-14, human proposal + lead; amends D-106) · D-106 set the 20 s coaching budget only in
  the tracked app.yaml.template; app.yaml is generated (scripts/vibe2value.py:140) and git-ignored, so a
  deployment with an older app.yaml silently runs the 8.0 s code default. Where should 20 s live? · In
  code: `COACH_BUDGET_S = 20.0` (coaching.py:69). `VIBE_COACH_BUDGET_S` stays as the per-call operator
  override via `_knob` (:87); the app.yaml.template entry stays as a visible override point [option K]
  [or: is removed, option R]. Tests pinning 8.0 (test_coaching.py:825, :833, :878) move to 20.0. D-106's
  value (20 s) and its evidence stand; only its location changes · evidence: D-106;
  state/probes/coach-timeout-8s.md; state/probes/mcp-loop-blocking.md (no event-loop blocking; 32-worker
  pool, executor.py:25) · Reverse: set COACH_BUDGET_S back to 8.0 (and the three tests), or set
  VIBE_COACH_BUDGET_S=8 in app.yaml and redeploy without a code change.

## Questions for the human — CLOSED

1. Option K (signed). 2. 20 s (signed).
