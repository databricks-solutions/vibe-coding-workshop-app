# Plan: step-prompt-prefetch (app) — step-complete-latency option C (D-135, D-145)

Commit path (if built): `docs/superpowers/plans/2026-10-15-step-prompt-prefetch.md`
Base: `feature/genie-code-mcp-integration` @ 99b392c (genie-default-ontology PRs 1-3 merged). Floor 2049/0.
Status: r1 — plan_critic r0 ACCEPT (D-155); HUMAN SIGNED 2026-10-15 (D-160): `VIBE_STEP_PROMPT_PREFETCH` default ON. Build after genie-default-error-path merges (rebase on the integration head at dispatch). Sized on opus-4-6 (D-145: no endpoint switch).

**Known side effect (D-160, report, don't block):** prefetch starts `prd_generation` generation as soon as `project_setup` becomes current, i.e. at session start. In a workshop where learners start together this bunches `prd_generation` generations at session start more than today (today they spread over each learner's project_setup completion). The opus endpoint showed ~20 concurrent requests before queueing (state/probes/coach-endpoint.md). The PR body and the facilitator guide note this and the kill switch.

## Why
`vibe_complete_step` renders the NEXT step's prompt synchronously before returning (`_walk_next_payload` :2089 → `_step_payload` :1131 → `_generate_step_prompt` :858), a streaming opus-4-6 call (max 8000 tokens) taking 20-47 s on the four slow steps (state/probes/step-complete-latency.md; D probe state/probes/step-prompt-endpoint-d/report.md: opus wall median 32.3 s, max 47.2 s). Only the learner's own agent waits (/health and other clients unaffected).

## Facts at 99b392c (lead, read-only)
- Cache key `(session_id, section_tag, sha256(assembled input))` (`mcp_server.py:880-884`); `_STEP_PROMPT_CACHE`, single-flight `_STEP_PROMPT_INFLIGHT` (:822-830) with late-success caching and a negative cache; budget `STEP_PROMPT_BUDGET_S = 90.0` (:820); generation runs on a daemon thread via `_run_async_blocking` (:1884). `bypass_llm` sections return None (no LLM).
- Which slow steps qualify ("step N+1's consumes don't include step N's produces"), from manifest.json:
  - genie-accelerator / end-to-end `prd_generation`: previous step `project_setup` produces nothing; consumes `use_case_brief` (already captured before project_setup) → QUALIFIES.
  - `iterate_enhance` (all tracks): consumes nothing → QUALIFIES.
  - skills-accelerator `skill_define_strategy` consumes `exploration_findings` (produced by the previous step `skill_install_explore`) → does NOT qualify; `skill_create_skillmd` consumes `skill_strategy` (produced by `skill_define_strategy`) → does NOT qualify.

## Change (mcp_server.py only + tests + docs)
- **P1 prefetch trigger:** whenever an MCP payload makes step N current for a session (the `_step_payload` paths for vibe_start_track / vibe_get_step / vibe_next_step / the `next` of vibe_complete_step), compute N+1 = the next outline step. If (a) N+1 is not `bypass_llm`, (b) `set(N+1.consumes) ∩ {N.produces}` is empty, and (c) every N+1 consume is already in `captured_outputs`, START (do not join) the existing generation for N+1 through the same `_generate_step_prompt` owner path: same assembled input, same cache key, same single-flight Future, same 90 s budget, same negative cache. No new cache, no new key, no budget change.
- **P2 non-blocking:** the prefetch never delays the current response: a helper `_prefetch_step_prompt(...)` elects/joins the single-flight owner and returns immediately (fire-and-forget on the daemon thread). If a generation for the key is already in flight or cached, it does nothing.
- **P3 bounded:** at most one prefetch in flight per session (the single-flight key already dedupes per (session, tag, input)); no prefetch for N+2 or beyond.
- **P4 kill switch:** `VIBE_STEP_PROMPT_PREFETCH` read per call, same parsing as `VIBE_COACHING_ENABLED` (`services/coaching.py:82-84`); default ON (unset = on); `0/false/off/no` = off (exactly today's behaviour). Added to app.yaml.template commented with the default.
- **P5 logging:** one INFO line per prefetch start/hit/skip reason with tag names only (no prompt or captured text).
- **P6 docs:** D3 (workshop-engine-domain.md) note on prefetch semantics; facilitator guide (switch, cost: a prefetch for a step the learner never reaches is a wasted generation); rollout doc.
- Trunk exception: `src/backend/mcp_server.py` (prefetch helper + call site in `_step_payload` only). Reversal: set the switch off (no code change) or revert.

## Acceptance
- A1 fence: mcp_server.py, app.yaml.template, new tests, the three docs, the plan, decision-log. No engine.py, routes.py, seed, DDL, manifest, web UI or tool-description change (7 tools, descriptions unchanged).
- A2 tests (with a fake LLM stream that blocks until released, and the D-146 stub):
  - a session on project_setup triggers exactly one prefetch for prd_generation; completing project_setup then returns prd_generation's generated prompt from the cache (or by joining the in-flight Future) with no second LLM call;
  - same for the step before iterate_enhance;
  - skill_define_strategy / skill_create_skillmd are never prefetched;
  - bypass_llm next steps are never prefetched;
  - the current response is never delayed by the prefetch (timing-independent: the fake stream is still blocked when the response returns);
  - a prefetch failure writes the existing negative cache and the later complete degrades to the template exactly as today;
  - the assembled input at prefetch time equals the input at complete time for the qualifying steps (cache key equal) — if NOT equal for any qualifying step, STOP and report (critic Q1);
  - switch off → zero prefetches, byte-identical payloads to base;
  - web routes unchanged; no other track's payloads change.
- A3 suite ≥ 2049/0; 0 Mermaid; WEB_GOLDEN unchanged; tool count and descriptions unchanged.
- A4 tampers: X1 prefetch N+1 even when it consumes N's produces → skills test FAIL; X2 join (block on) the prefetch → non-blocking test FAIL; X3 use a different cache key for the prefetch → no-second-call test FAIL; X4 ignore the switch → switch-off test FAIL.
- Live checks (after the human deploys): on the deployed app, a fresh genie-accelerator session: time vibe_complete_step(project_setup) with ~N s of think time after reaching project_setup; report total vs the 27-41 s baseline (state/probes/step-complete-latency.md); count LLM calls via the coaching/stream log. Control = that measured baseline; NO switch-off redeploy (D-160). Opus-4-6 only (D-145).
- Live check (D-160, report only): start ~20 genie-accelerator sessions within 10 s; for each, report the prd_generation prefetch's completion time (from the stream/timings log) and the vibe_complete_step(project_setup) latency; summarise the spread and any timeouts. Not a pass/fail gate.

## Questions for plan_critic
1. Does `assembler.get_section_input_content` for N+1 use ONLY N+1's consumes, or all `previous_outputs`/session state, so that completing step N (which writes captured_output for N even when N produces nothing named?) changes N+1's assembled input and therefore the cache key? Cite `_step_payload` (:1131-1175) and the assembler. If the input changes, is there a sound way to prefetch without changing the cache key (forbidden)?
2. Every call site that makes a step current (start, get_step, next_step, complete's next): file:line; is `_step_payload` the single choke point?
3. Is the daemon-thread generation (`_run_async_blocking`) safe to start without a waiting reader (late-success caching suggests yes)? Any thread-count bound needed beyond single-flight?
4. Does the web UI path render step prompts through a different cache (routes.py), so that prefetching on MCP cannot affect web output?
5. Which other (non-slow) LLM-rendered steps would qualify under the rule, and what is the extra token cost per walk? Is default ON acceptable or should the plan propose default OFF for the human?
6. Any test pinning the number of LLM calls per walk that would change?
