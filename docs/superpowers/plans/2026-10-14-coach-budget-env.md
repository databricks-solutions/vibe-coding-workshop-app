# Plan: coach-budget-env (app; config + docs, no Python change)

Date: 2026-10-14 · repo: app · base: origin/feature/genie-code-mcp-integration @ 5c37937
Commit this plan at docs/superpowers/plans/2026-10-14-coach-budget-env.md.
Decisions carried: none in this PR (lead amendment after critic ACCEPT: decision-log.md left out of
the fence so this PR can run beside contract-doc-phase2a-reconcile, which appends D-103..D-105).
D-106 is carried by the next app PR.

## Why
Human ruling 2026-10-14: raise the coaching time budget through `VIBE_COACH_BUDGET_S`.
Evidence (FORGE/state/probes/coach-timeout-8s.md): on deployment 01f1c75e… (5c37937), 17
cache-miss `vibe_explain_step` focus calls on genie-accelerator steps took 7.42–16.66 s of real
model time (Opus 4.6, `databricks-claude-opus-4-6`, ~33 tok/s, 254–400 output tokens); 16/17 hit
the 8.0 s budget (`outcome=fallback:timeout`). The timeouts predate D12 (prd_generation 4/4 on
7e2b537). The env override already exists: `coaching._knob("VIBE_COACH_BUDGET_S", COACH_BUDGET_S,
float)` at src/backend/services/coaching.py:371, read per call; `_knob` (:87) rejects
non-numeric, non-finite or <= 0 values with a WARNING and no other clamp.

## Event loop (critic r1 finding (b), refuted with evidence)
r1 claimed a 20 s budget blocks the uvicorn event loop because FastMCP calls sync tools
directly. At 5c37937 it doesn't: `WorkshopFastMCP._install_error_aware_handler`
(src/backend/mcp_server.py:335, installed at :2545) wraps every tool call in
`asyncio.to_thread` (:368), so `_run_async_blocking`'s `thread.join(timeout_s)` (:1827) blocks a
worker thread, not the loop (commit 78ea6ce). Live proof (FORGE/state/probes/mcp-loop-blocking.md,
deployment 01f1c75e…): during 5 coaching calls holding the server 7.7–8.0 s each, /health max
stayed 0.247–0.297 s (baseline 0.252–0.261 s), all 392 polls returned 200, and a concurrent
no-focus vibe_explain_step took 0.38–0.40 s.
Residual risk, accepted and documented: the app installs its own default executor of 32 workers
(src/backend/executor.py:25 `DEFAULT_SIZE = 32`, env-overridable there), and a coaching call now holds one for up to 20 s instead of 8 s. A burst of slow calls
larger than the pool makes other MCP tool calls queue (not /health or the async HTTP routes).
C4 adds one sentence saying this to the rollout bullet, and L3 below measures it lightly.

## Change
- C1 app.yaml.template (tracked; `scripts/vibe2value.py:140` generates the git-ignored app.yaml
  from it): add, in the `env:` list after `DATABRICKS_SERVING_ENDPOINT`, a short commented entry
  `- name: VIBE_COACH_BUDGET_S` / `value: "20"`. The comment says it is the coaching model time
  budget in seconds read per call by services/coaching.py, the code default is 8.0 when unset,
  and cites D-106. No other template line changes.
- C2 Code default unchanged: `COACH_BUDGET_S = 8.0` stays (tests/workshop/test_coaching.py:825
  pins it). No change to coaching.py, max_tokens, the model, the scrub rules, or any other knob.
- C3 New test tests/workshop/test_app_template_env.py: parse app.yaml.template with yaml.safe_load
  (placeholders are plain strings); assert exactly one env entry named VIBE_COACH_BUDGET_S with
  value "20"; and, with monkeypatch.setenv to that value, `coaching._knob("VIBE_COACH_BUDGET_S",
  coaching.COACH_BUDGET_S, float) == 20.0` (so the template value is one `_knob` accepts).
- C4 Docs (additive notes, no rewording of existing sentences except where a sentence states the
  live budget as fact):
  - docs/specs/mcp_design/mcp-workshop-rollout.md §5 "Budget changes" bullet (:157): append one
    sentence: the human raised `VIBE_COACH_BUDGET_S` to 20 s on 2026-10-14 (D-106), set in
    app.yaml.template; the code default stays 8.0. Add one more sentence: each coaching call holds a
    worker thread (asyncio.to_thread, mcp_server.py:368) for up to the budget, so a burst of slow
    calls larger than the 32-worker pool (executor.py:25) queues other MCP tool calls (not the event loop).
  - docs/superpowers/genie-code-smoke-script.md :154 and :636: say the budget is 8.0 s by default
    (coaching.py `COACH_BUDGET_S`) and 20 s where app.yaml sets `VIBE_COACH_BUDGET_S` (D-106).
    Fix the stale line citation coaching.py:66 → the line of `COACH_BUDGET_S` at 5c37937 (:69).

## Fence (exactly these files)
app.yaml.template · tests/workshop/test_app_template_env.py ·
docs/specs/mcp_design/mcp-workshop-rollout.md · docs/superpowers/genie-code-smoke-script.md ·
docs/superpowers/plans/2026-10-14-coach-budget-env.md.
Never app.yaml (git-ignored, the human's), never src/, never db/.

## Acceptance contract
- A1 Scope: exactly the fence files; plan byte-identical to FORGE/state/lead/plans/coach-budget-env.md.
- A2 `git diff 5c37937 -- src/` is empty; COACH_BUDGET_S is still 8.0.
- A3 The template diff adds only the VIBE_COACH_BUDGET_S entry (+ its comment lines); the file
  still parses with yaml.safe_load and env names are unique.
- A4 C3's test passes; it fails if the template entry is removed, renamed, or set to "0", "abc" or
  "-1" (tampers below).
- A5 Suite green: ≥1892 passed, 0 failed (floor 1891 + the new test file's cases).
- A6 Docs: the two smoke-script lines and the rollout bullet state 8.0 default / 20 s with the
  override; every citation on an added or changed line resolves at head (D-103 rule).
- A7 Release: merge only (D-91); no deploy. reseed=no.

## Tampers
- X1 delete the template entry → C3 fails.
- X2 rename it to VIBE_COACH_BUDGET → C3 fails.
- X3 value "0" → C3 fails (the _knob assertion).
- X4 value "abc" → C3 fails.
- X5 duplicate the entry → C3 fails.
- X6 change COACH_BUDGET_S to 20.0 in coaching.py → test_coaching.py:825 fails and A2 fails.

## Green gates
`cd <worktree> && DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= $APP/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q`
→ ≥1892 passed, 0 failed. No genie gate (no seed change). No frontend change.

## Live checks (after the human regenerates app.yaml or adds the line, and deploys)
- L0 the active deployment's app.yaml sets VIBE_COACH_BUDGET_S=20.
- L1 4 fresh-session cache-miss calls each on semlayer_metric_view focus=why and gaccel_dashboard
  focus=what_now (visual omitted): report model_ms, outcome. Expect no `fallback:timeout` for
  model times < 20 s; `scrub:overlap:prompt` fallbacks are reported, not failed (scrub unchanged).
- L2 wall time per call ≤ budget + 1 s.
- L3 during one cache-miss coaching call, poll /health every 0.25 s: max latency stays under 1 s
  and every poll returns 200 (the mcp-loop-blocking method), and a concurrent no-focus
  vibe_explain_step from another probe session returns in under 2 s.

## Reversal
Remove the env entry from app.yaml (or the template) and redeploy: the budget returns to 8.0 s.
Revert the merge commit for the docs/test.

## Note for the human
The deployed app.yaml is generated and git-ignored. After this merges, run `./vibe2value
configure` (or add the two lines to app.yaml) before deploying, or the live budget stays 8.0 s.
