# Plan: coach-endpoint — coaching-only serving endpoint override (D-111)

- Date: 2026-10-14 · Repo: app · Base: origin/feature/genie-code-mcp-integration at dispatch time
  (after #140 spec-vibe-coach-sweep and coach-budget-default merge; f461643 today)
- Status: r2.1, critic ACCEPT (round 2); D-113 SIGNED 2026-10-14 (see "Signed values" below). Build on a worktree off 2f330bd.
- Commit this file unchanged at docs/superpowers/plans/<dispatch-date>-coach-endpoint.md
- Release: merge only (D-91). No deploy by the forge, no reseed, no DDL, no new MCP tool.
- Serialization: edits src/backend/services/coaching.py and tests/workshop/test_coaching.py, which
  coach-budget-default also edits; build strictly after coach-budget-default merges. No trunk file.

## Why

Under a 30-call burst the coach splits cleanly: every coached call ≤ 13.7 s wall, every other call at
the 20 s cap (state/probes/coach-concurrency.md). The app's threads and /health were fine, so the queue is
at the model endpoint. The coach calls `llm.call_databricks_serving_endpoint(..., endpoint_name=None, ...)`
(`coaching.py:389`), which resolves to the app-wide `llm.SERVING_ENDPOINT_NAME`
(`llm.py:36`, env `DATABRICKS_SERVING_ENDPOINT`, deployed as databricks-claude-opus-4-6). There is no
way to move only coaching to a different (faster or less loaded) endpoint without moving every LLM
feature of the app.

## Change

1. `src/backend/services/coaching.py`
   - New module constant `COACH_ENDPOINT_ENV = "VIBE_COACH_ENDPOINT"` beside the other knobs (:67–72)
     and a helper `_coach_endpoint() -> str | None`: reads `os.getenv("VIBE_COACH_ENDPOINT")` **per
     call**, returns the stripped value, or `None` when unset or blank. No validation of the name beyond
     strip (an unknown endpoint fails at the call and is already fail-open, `coaching.py:401–403`).
   - At `:389`, `endpoint_name=None` → `endpoint_name=_coach_endpoint()`. When the env var is unset this
     passes `None`, exactly today's argument, so behaviour is unchanged.
   - The `coaching timings` line (`:533–545`) gains a final field `endpoint=<name|default>`
     (the override value, or the literal `default` when unset). Endpoint names are workspace config, not
     learner content (D-29 rule: timings only, never prompt/context/model text). `visual=` stops being
     last. [Critic: judge whether this field is worth the TIMING_RE churn; the alternative is no log
     change, and live checks then can't prove which endpoint served a call.]
   - Untouched: scrub functions (`:153–237`), `COACH_SYSTEM`, `COACH_MAX_TOKENS`/`VIBE_COACH_MAX_TOKENS`,
     `COACH_TEMPERATURE`, the budget, the cache key (`:323`) and `llm.py` (the app-wide endpoint).
   - Cache key: unchanged on purpose. Switching the override mid-run can serve text cached from the
     previous endpoint for the same (session, step, focus, visual); that is benign and clears on
     restart. [Critic: confirm or argue for adding the endpoint to the key.]
2. `tests/workshop/test_coaching.py`
   - New test: env unset → the fake `call_databricks_serving_endpoint` receives `endpoint_name=None`;
     env set to `x-endpoint` → receives `"x-endpoint"`; env `"  "` → `None`; read per call (set, call,
     unset, call).
   - New test: the endpoint override leaves `system_prompt`, `max_tokens`, `temperature` and the scrub
     result identical to the unset case for the same fake model output.
   - `TIMING_RE` (`:783–786`) gains `endpoint=(\S+)$` after `visual=(\S+)`; the unpack at `:898`
     follows. No other existing assertion changes.
3. `app.yaml.template` — **no entry added** (unset = app endpoint). The human sets the value when they
   choose a model, in app.yaml, and that choice gets its own decision.
4. Docs: `docs/specs/mcp_design/mcp-workshop-rollout.md` §5 (the coaching knob bullets near the
   D-106 budget note) — one bullet: `VIBE_COACH_ENDPOINT` (unset = `DATABRICKS_SERVING_ENDPOINT`), read
   per call, fail-open on an unknown endpoint, and the app service principal needs CAN_QUERY on the
   chosen endpoint. D2 §12 (adaptive-coaching internals) — one sentence on the override. Nothing else.
5. `docs/superpowers/decision-log.md` — append D-110, D-111 (and the D-108 SIGNED line if
   coach-budget-default has not already carried it).

## Questions for the critic

(a) Is `coaching.py:389` the only call site that picks the coaching endpoint? Any other path (focus
    without visual, the cache join, retries) that calls the serving endpoint for coaching?
(b) Does `llm.call_databricks_serving_endpoint` honour a non-None `endpoint_name` without other side
    effects (endpoint discovery, fallbacks to another endpoint, auth)? Cite llm.py lines.
(c) Does the app service principal need an explicit resource/permission grant for a second endpoint
    (app.yaml resources, databricks.yml)? If so, the plan must say the human grants it; the forge
    changes no workspace permissions.
(d) Log field: keep or drop `endpoint=`? If kept, is any other consumer of the timings line (D8, smoke
    script, probes) broken by `visual=` no longer being last?
(e) Tampers (below): can each turn a named test red?

## Acceptance

- A1 Fence: coaching.py, test_coaching.py, rollout.md, mcp-interface-contract.md, decision-log.md, the
  plan. Nothing else; mcp_server.py and llm.py byte-identical.
- A2 With `VIBE_COACH_ENDPOINT` unset, every argument passed to the serving call is identical to base.
- A3 With it set, only `endpoint_name` differs; read per call.
- A4 Scrub functions, COACH_SYSTEM and the knobs other than the new one are byte-identical to base.
- A5 Suite ≥ floor (1892 today, or the coach-budget-default floor), 0 failed.
- Tampers: X1 hard-code `endpoint_name=None` again → the set-env test red; X2 read the env once at
  import → the per-call test red; X3 pass the override into `system_prompt` instead → A3 test red;
  X4 drop `endpoint=` from the log → TIMING_RE red (if the field is kept).
- Live checks (after the human deploys, and only once a model is chosen and set): the timings line shows
  `endpoint=<chosen>`; a burst of 30 re-run shows the new coached/timeout split; /health and
  vibe_get_step stay within the coach-concurrency pass rules.

## Revision r1 (probe findings, state/probes/coach-endpoint.md) — SUPERSEDED by r2 below

The probe found the plan as written cannot work with either candidate model: databricks-claude-sonnet-5-5
and databricks-claude-haiku-5-5 reject the exact coaching payload with HTTP 400 "does not support the
temperature parameter" (8/8 singles + 30/30 burst each). `llm.py:351-353` always sends `temperature`
unless the endpoint name contains "mini". Setting VIBE_COACH_ENDPOINT to either model at the code above
would make every coaching call fail open to static help. Options for the human (none chosen):

- T1 (lead's recommendation) — `llm.py`: treat `temperature=None` as "omit the field"
  (`if temperature is not None and "mini" not in ep_lower`); every existing caller passes a float, so
  their payloads are byte-identical. `coaching.py`: pass `temperature=None` when VIBE_COACH_ENDPOINT is
  set, `COACH_TEMPERATURE` (0.3) when unset. The probe's latency/quality numbers for E1/E2 were taken
  exactly this way (no temperature). Cost: an `llm.py` edit (payload builder, not the app-wide endpoint)
  and coupling "override set ⇒ no temperature". Reverse: unset the env var.
- T2 — same `llm.py` change, plus a separate knob VIBE_COACH_TEMPERATURE (number, or `omit`); default 0.3.
  Explicit, but the human must set two env vars; forgetting the second makes every call 400 → fallback.
- T3 — `llm.py` learns per endpoint: on that exact 400, retry once without temperature and remember the
  endpoint. No config, but adds a failed round-trip per endpoint per process and more code in a shared path.

Also flagged, not in scope (human constraint on max_tokens): E2 haiku hit the 400-token cap on 32/38
outputs, so most replies stop mid-text; adopting E2 would need VIBE_COACH_MAX_TOKENS raised.
The fence grows by `src/backend/services/llm.py` (+ a test) under T1–T3. The critic has not seen this
plan (Cursor-role policy error); it needs either the critic or a direct human approval.

## Revision r2 (2026-10-14, human rulings D-113) — THIS IS THE PLAN TO BUILD

r2 supersedes the Change, Acceptance and Tamper sections above wherever they conflict. Kept from r0:
the per-call `_coach_endpoint()` helper, `endpoint_name=_coach_endpoint()` at `coaching.py:389`, the
unchanged cache key, the rollout/D2 doc bullets. Values marked `<SIGNED>` are filled in from the
human-signed probe decision (probe-coach-endpoint-r2) before the implementer is dispatched; the
implementer never chooses them.

r2 changes:

1. Temperature (supersedes T1/T2/T3). The coach never sends temperature.
   - `src/backend/services/llm.py`: in `call_databricks_serving_endpoint`, `temperature=None` means
     "omit the field". The live OpenAI-compatible body (`:352-357`) becomes
     `if temperature is not None and "mini" not in ep_lower: body["temperature"] = temperature`.
     The other payload builders in the same function (`:237`, `:256-260`, `:279`) get the same
     None ⇒ omit rule wherever they are reachable [critic: say which of them are live code paths].
     Every other caller passes a number, so their request bodies are byte-identical to base.
     The signature default (0.5, `:169`) is unchanged.
   - `src/backend/services/coaching.py`: `COACH_TEMPERATURE = 0.3` (`:71`) is removed and the coach
     passes `temperature=None` always (`:391`). The opus fallback (override unset) therefore runs at the
     endpoint's default temperature — accepted by the human.
   - Tests: `test_coaching.py:202` changes to `call["temperature"] is None`; new `llm.py` tests
     (in `tests/workshop/test_llm_service.py`): None ⇒ no `temperature` key in the body; a float ⇒ key
     present with that value (byte-identical body to base for a float caller); "mini" rule unchanged.
2. Where the values live.
   - `VIBE_COACH_ENDPOINT`: read per call, unset/blank ⇒ `None` ⇒ app endpoint. **No code default**
     (FMAPI availability varies by workspace). Add an entry to `app.yaml.template` with the signed
     model `<SIGNED endpoint>` and a comment: "coaching-only endpoint; unset = DATABRICKS_SERVING_ENDPOINT;
     the app service principal needs CAN_QUERY on it". This reverses r0 item 3 (no entry).
   - `COACH_MAX_TOKENS` (`:68`): code default 400 → `<SIGNED max_tokens>`; `VIBE_COACH_MAX_TOKENS`
     override kept. Tests that pin 400 (`test_coaching.py:824`, and the doc line `:16`) move to the new
     value. The D-108 lesson: max_tokens is not workspace-specific, so it lives in code.
   - Log: the `coaching timings` line gains final field `endpoint=<name|default>` (kept; the critic's
     question (d) still applies to other consumers of the line). TIMING_RE gains `endpoint=(\S+)$`.
3. Unchanged (byte-identical to base): scrub functions, `COACH_SYSTEM`, the 20 s budget
   (`COACH_BUDGET_S` after coach-budget-default), the cache key, the app-wide
   `DATABRICKS_SERVING_ENDPOINT` / `llm.SERVING_ENDPOINT_NAME`, `mcp_server.py`.
4. Fence (r2): coaching.py, llm.py, test_coaching.py, test_llm_service.py, app.yaml.template, the
   template test from #139 (`tests/...` that pins the template env list — update it for the new entry,
   do not weaken it), rollout.md, mcp-interface-contract.md, decision-log.md (D-110..D-113 not yet
   carried), the plan.
5. Acceptance (r2):
   - A2' With the override unset, the coach's call differs from base only in `temperature`
     (None) and `max_tokens` (the signed value); the body sent to the endpoint has no `temperature`.
   - A3' With it set, additionally only `endpoint_name` differs; read per call.
   - A6 Every non-coach caller of `call_databricks_serving_endpoint` produces a body byte-identical to
     base (gatekeeper diffs the built body for a float temperature at base vs head).
   - A7 `app.yaml.template` renders through `vibe2value` in both Lakebase modes with
     `VIBE_COACH_ENDPOINT=<SIGNED endpoint>`; the #139 budget entry is unchanged.
   - A4/A5 as above (A4 now excludes COACH_TEMPERATURE, removed, and COACH_MAX_TOKENS, changed).
6. Tampers (r2, in addition to X1–X4): X5 restore `temperature=COACH_TEMPERATURE` in the coach →
   the None test red; X6 make llm.py send `"temperature": None` instead of omitting → the body test
   red; X7 make llm.py omit temperature for every caller → the float-caller body test red; X8 put a code
   default on VIBE_COACH_ENDPOINT → the unset ⇒ None test red; X9 revert COACH_MAX_TOKENS → its pin red.
7. Live checks (after the human deploys with the signed values): the timings line shows
   `endpoint=<SIGNED endpoint>`; 8 singles on the #139 contexts all `coached` or scrub-listed with no
   timeout and no 400 in the logs; a 30-burst with /health 200 < 1 s and vibe_get_step < 3 s; the
   finish_reason=length rate reported.
8. Questions for the critic (r2): (f) are the `:237/:256-260/:279` payload paths live, and does the
   None ⇒ omit rule there change any non-coach request? (g) does any other module read
   `coaching.COACH_TEMPERATURE` (removing it must not break an import)? (h) which test pins the
   app.yaml.template env list after #139, and is adding an entry compatible with it? (i) is there any
   path where the coach's `max_tokens` is clamped elsewhere (llm.py, endpoint limits)?

### r2.1 (critic round 1 BLOCK, finding (d)) — amends r2

- (d) The new last field breaks `tests/workshop/test_coach_visuals.py:696` (`endswith(" visual=table")`)
  and `:703` (`endswith(" visual=none")`). Fix: `test_coach_visuals.py` joins the fence. Those two
  assertions become `endswith(" visual=table endpoint=default")` and
  `endswith(" visual=none endpoint=default")` (env var unset in that fixture), so they still prove
  `visual=` is present with the right value and that nothing follows except the endpoint field. No other
  assertion in that file changes. D2 `mcp-interface-contract.md:742` (already in the fence) quotes the
  format string: append ` endpoint=%s` to it, byte-identical to the code's new format string.
- (f) Only the live body `openai_request_body` (`llm.py:351-357`) gets the None ⇒ omit rule.
  `openai_payload` (`:234-238`, unused) and `agent_payloads` (`:254-263`, whose `temperature` is ignored
  by `make_request` `:297-301`) stay byte-identical: editing dead or ignored code adds risk and no effect.
  This replaces r2 item 1's "the other payload builders … get the same rule".
- (h) Template env-list test is `tests/workshop/test_app_template_env.py:21-22` (uniqueness); it joins the
  fence only to add a pin that `VIBE_COACH_ENDPOINT` appears exactly once with the signed value. Existing
  assertions unchanged.
- Fence (r2.1) = r2 fence + `tests/workshop/test_coach_visuals.py` (the two assertions only), with
  `tests/workshop/test_app_template_env.py` named explicitly as the template test.
- New tamper X10: make the format string put `endpoint=` before `visual=` → test_coach_visuals:696 red.

### Signed values (D-113 SIGNED, 2026-10-14, human) — fill every `<SIGNED …>` above

- `<SIGNED endpoint>` = `databricks-claude-sonnet-5-5` (the `app.yaml.template` entry value, the
  `test_app_template_env.py` pin, A7 and the live checks).
- `<SIGNED max_tokens>` = `800` (`COACH_MAX_TOKENS` code default and the tests/doc lines that pin 400).
- Basis: probe-coach-endpoint-r2. Sonnet/800: 38/38 finish_reason=stop, slowest single 6.68 s, burst
  30/0. Haiku judged NOT on par on quality: 2 of its 4 review answers described the step as already
  done in a session with no work (r2 side-by-side 4D, 8C), against COACH_SYSTEM's no-invented-results
  rule, and both copied a literal `<STATE_FILE>`; sonnet 0 of 4. Latency did not separate them.
- Nothing else in r2.1 changes. CAN_QUERY: the human found no grant on any databricks-* pay-per-token
  endpoint, including opus-4-6, which the app already calls; no grant expected. Live check L1 = "the
  first coached call on sonnet succeeds"; a permission error there parks the task.

Queued, not in this plan: `llm-newer-model-compat` (app-wide: every other caller sends temperature, so
moving DATABRICKS_SERVING_ENDPOINT to a 5.x model would break PRD generation and the other prompts) and
`coach-timeout-ask-again` (the "ask again in about 30 s" hint; C5 showed late generations fill the cache).

## Evidence probe (runs now, separate from the build; see the prober dispatch)

Direct endpoint comparison on fevm-serverless (no deploy), databricks-claude-opus-4-6 (baseline) vs
databricks-claude-sonnet-5-5 vs databricks-claude-haiku-5-5: singles on the 8 #139 contexts, a 30-burst,
scrub rejections per endpoint with the rule, an unlabelled side-by-side of the 8 texts per endpoint, and
on the deployed app a post-burst 30 s re-call of timed-out sessions to count cache hits.
