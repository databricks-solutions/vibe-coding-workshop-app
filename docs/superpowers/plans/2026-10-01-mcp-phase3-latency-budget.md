# MCP step-prompt latency — AMENDED plan (off-loop + budget + single-flight; human-approved 2026-10-01)

Base: origin/feature/genie-code-mcp-integration @ 02827e2 (PR B merged). Charter exception APPROVED:
mcp_server.py + a NARROWLY scoped routes.py change (item 4 only). Plan doc committed in-PR.

## WHY (human's live proof, session 1cbe6311 — accepted)
The app is ONE uvicorn process / ONE event loop (app.py:323) shared by the web UI and /mcp. FastMCP
(mcp 1.30.0, func_metadata) calls SYNC tools directly on the loop (`return fn(**args)`), and
`_run_async_blocking`'s `thread.join()` (mcp_server.py:1362-1364) blocks that loop. One learner's
slow render (117.3s uncached vibe_get_step) froze the WHOLE app (web GET / 114.17s vs 0.25s
baseline). A budget alone shortens the freeze; it does not remove it. Also web POST /generate-prompt
(routes.py ~:2005, CsvUploadPanel) is `async def` but reaches the synchronous SDK
`client.api_client.do` (~:1605) on the loop — same freeze class on the web surface.

## CHANGE 1 — OFF-LOOP MCP tools (mcp_server.py)
No MCP tool call may block the shared event loop. Preferred: one central change in the error-aware
CallTool handler (`handle`, mcp_server.py ~:293) running SYNC tool bodies in a worker thread
(asyncio.to_thread). A registration-time wrapper (async shim with preserved `__signature__` +
`__annotations__` via functools.wraps, so FastMCP's Context detection and output-schema generation
see the ORIGINAL signature) is acceptable IF the plan evidence shows it meets the same bar —
implementer chooses, and states the choice + evidence in the PR body.
MUST PRESERVE: FastMCP arg validation + Context injection, the OBO ContextVar (asyncio.to_thread
copies contextvars — pinned by a test), the _ContractError/isError contract, output-schema
validation, direct-call unit tests (tests call tool fns directly — unaffected either way).

## CHANGE 2 — BUDGET (kept: STEP_PROMPT_BUDGET_S = 90.0)
90s = 1.5x the SDK per-attempt http timeout (60s — a healthy-but-slow attempt finishing 60-75s still
lands), <= the web streaming path's 120s ceiling (routes.py:2090), 3.3x under the OBSERVED 300s
Genie Code client default (observational/external — NOT in-repo; rg-verified; say so plainly).
On expiry: WARNING (step tag, budget, no PII) -> None -> template. The generation thread is
daemon=True EXPLICITLY (CORRECTION to the prior plan: today's thread at mcp_server.py:1362-1364 is
NOT daemon). A timed-out generation's result is DISCARDED unless late-success caching (change 3)
adopts it. Worst-case MCP render: ~budget + epsilon vs 117-246s observed.

## CHANGE 3 — SINGLE-FLIGHT per cache key + late-success caching (ADOPTED per recommendation)
Key = (session_id or "", section_tag, sha256(input_text)). A read arriving while a generation for
the same key is in flight JOINS it (with its own remaining budget) and never starts a second one —
at most one in-flight generation per key (threading.Lock-guarded registry; joiner waits
future/event with its own remaining budget -> None -> template on expiry).
LATE-SUCCESS CACHING ADOPTED: a generation finishing after the owner's budget still populates the
cache — it is a valid llm_generated result for that EXACT input hash (the key pins prompt
stability across reads; no stability argument against). The next read is instant. Implementation
sketch: registry maps key -> concurrent.futures.Future; the generation thread (daemon) resolves it
on success (writes cache) or failure; owner/joiners wait with remaining budget.

## CHANGE 4 — routes.py, NARROW (the only routes change)
Offload the blocking SDK calls on the serving-endpoint path with asyncio.to_thread so async callers
don't block the loop: `client.api_client.do` (~routes.py:1605) in
`call_databricks_serving_endpoint`, plus the `client.serving_endpoints.query` fallbacks (~:1518/
:1541) if on the same path. NO signature changes, NO timeout/retry/behavior changes; the streaming
path (_stream_with_retry) is byte-unchanged. Web GET / stays responsive during a slow render
(human smoke: < 2s).

## SDK VERSION RE-ANCHOR (correction)
Resolved/deployed: databricks-sdk 0.139.0 (main .venv verified). requirements.txt FLOATS
`>=0.81.0` (line 19) — the earlier 0.117.0/_base_client line refs are NOT the deployed truth; the
plan cites the resolved version's behavior (SDK-internal retried(timeout=300), http_timeout_seconds
defaults — re-verify exact line refs in the installed 0.139.0 during implementation). LEDGER: the
floating pin.

## TESTS (offline; fake slow endpoint via monkeypatch; NO real FMAPI; patch the budget SMALL so the
suite stays fast) — new tests/workshop/test_step_prompt_budget.py (+ additions where they fit):
1. Budget bites -> None/template, key ABSENT from cache (unless late-success later lands), call
   wall-clock < budget + slack. TAMPER: raise STEP_PROMPT_BUDGET_S past the fake's sleep -> fails.
2. Within-budget success -> llm_generated, cached, second call is a cache hit (fake invoked once).
3. Single-flight: two overlapping reads, one key -> fake invoked EXACTLY once. TAMPER: remove the
   in-flight registry -> invoked twice -> fail.
4. Late-success caching (adopted): read times out -> template; after the fake completes, the next
   read HITS the cache.
5. Loop non-blocking, MCP: drive the handler on an event loop with a slow sync tool while a
   concurrent ticker task runs; the ticker MUST make progress during the call. TAMPER: revert the
   offload -> ticker starves -> fail.
6. OBO propagation: a ContextVar set before the handler is visible inside the tool thread AND the
   generation thread.
7. Loop non-blocking, routes: call_databricks_serving_endpoint with a fake slow api_client.do + a
   concurrent ticker -> progress. TAMPER: remove to_thread -> starves -> fail.
8. Existing tests/workshop/test_step_prompt_fmapi.py + full tests/workshop + tests/api green;
   absence pin green; JSONB-vs-'' sweep zero; npm run build (frontend untouched).

## FENCES
mcp_server.py + routes.py (scoped to item 4 only) + new/extended tests + the two plan docs only.
state.py, manifest.py/manifest.json, frontend, DDL: ZERO-DIFF. No DDL/reseed; no agent-side deploy.
Offline gates pasted (SDK-neutralized main .venv, mcp==1.30.0, DATABRICKS_CONFIG_FILE=/dev/null).
Explicit staging; never git add -A; never .cursor/ or .isaac/. Charter exceptions stated in the PR
body (mcp_server.py: off-loop + budget + single-flight; routes.py: item-4 to_thread only).
STOP-and-report rather than a partial or red PR.

## Human acceptance smoke (after merge + deploy; informational here)
Web GET / during an uncached iterate_enhance render < 2s; render <= ~90s + eps (LLM prompt if it
lands, template otherwise); immediate repeat read joins/hits cache (no second 90s wait); app logs
show the budget WARNING only on timeouts and no errors.
