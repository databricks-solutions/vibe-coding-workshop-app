# dedicated-thread-pool

## Ledger item (#77 body: "thread-pool capacity (dedicated executor before a large live workshop)"; verified at 44f4fd7)
- Blocking work is offloaded with `asyncio.to_thread`: the MCP CallTool shim at mcp_server.py ~:351 (every sync MCP tool body), the prompt/agent fallbacks at routes.py ~:1610 and ~:1635, and the locked session saves at routes.py ~:5843 and ~:6236. All of these run on the event loop's DEFAULT executor, a ThreadPoolExecutor with max_workers = min(32, os.cpu_count() + 4). On a small Databricks Apps container (2–4 vCPU) that is 6–8 threads.
- Some calls hold a thread for a long time: `vibe_complete_step(project_setup)` takes 17–38 s live, because the next-step PRD generation runs inside the response. A workshop of ~30 learners hitting that step together would queue behind 6–8 threads, and every other offloaded call would queue too.
- There is no executor configuration anywhere: no `set_default_executor`, no ThreadPoolExecutor, no max_workers in app.py or src/backend.

## Change (reversible by env var)
1. New module src/backend/executor.py: `configure_default_executor(loop) -> int`, which reads `VIBE_THREAD_POOL_SIZE` (int; default 32; clamped to 4..128; invalid values fall back to the default with a WARNING), builds `ThreadPoolExecutor(max_workers=n, thread_name_prefix="vibe-io")`, calls `loop.set_default_executor(...)`, logs INFO "default executor: vibe-io x{n}", and returns n. `VIBE_THREAD_POOL_SIZE=0` means DISABLED: no change to the loop, the platform default stays (the reversal switch), and it logs INFO "default executor: platform default (VIBE_THREAD_POOL_SIZE=0)". Also expose `shutdown_executor()` for the lifespan exit (`executor.shutdown(wait=False, cancel_futures=False)`; a no-op if disabled).
2. app.py (not a trunk file): the lifespan ALWAYS runs. Today app_lifespan is None when the MCP mount is disabled. Make it a lifespan that calls configure_default_executor(asyncio.get_running_loop()) on entry and shutdown_executor() on exit, wrapping the existing mcp_app lifespan when MCP is enabled. Behavior with MCP disabled is otherwise unchanged.
3. FastMCP sync tools: check whether the MCP SDK runs sync tool bodies through anyio's default thread limiter (default 40 tokens) rather than asyncio.to_thread. If any request path does, ALSO set `anyio.to_thread.current_default_thread_limiter().total_tokens = n` inside the same startup (in the running loop). Record which path the shim at mcp_server.py ~:351 uses in `## Findings`. If it is purely asyncio.to_thread, skip anyio.
4. No change to any to_thread call site; no trunk file touched.
5. docs/superpowers/decision-log.md: D-18 (2026-10-04) · "A dedicated default executor (VIBE_THREAD_POOL_SIZE, default 32, 0 disables) sized for a live workshop. Rule (2), the #77 ledger. · Reverse: set VIBE_THREAD_POOL_SIZE=0 or revert." Public register, one line, at the end.

Fence: app.py, the new src/backend/executor.py, a new **tests/api/test_executor.py** (it must live under tests/api or tests/workshop to be collected by the suite command; the spec's tests/test_executor.py path is wrong, so use tests/api), docs/superpowers/decision-log.md, and the plan file. app.yaml is NOT changed.

## Tests (tests/api/test_executor.py)
- E1 test_executor_env_config: default 32; env 16 → 16; env 0 → disabled (loop default unchanged); env "abc" or -5 → default with a WARNING; env 1000 → clamped to 128.
- E2 test_executor_concurrency: with size 16 configured on a fresh loop, launch 16 `asyncio.to_thread(...)` calls that each wait on a shared `threading.Barrier(16, timeout=5)`. All complete only if 16 threads ran at once. Also assert the executor's max workers == 16.
- E3 test_app_lifespan: the app lifespan configures the executor on startup and shuts it down on exit, with MCP both enabled and disabled (TestClient runs the lifespan; use the existing app import path, and monkeypatch the MCP-enable flag as the module reads it).
- E4 test_executor_contextvar: a ContextVar set before `asyncio.to_thread` is visible inside the worker on the new executor.

## Acceptance contract
- Backend suite (DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= <APP>/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q): floor 618 (617 passed + 1 xfailed at base) plus the new tests, 0 failed. Lint ABSOLUTE (0 errors), build green, tools/list = 7.
- Tampers (FORGE/state/specs/dedicated-thread-pool/tampers.md; paths corrected to tests/api/test_executor.py), each verified and then restored byte-identically: T1 hardcode n=32 → E1 red; T2 skip set_default_executor → E2 red; T3 a lifespan without configure → E3 red; T4 shrink the barrier timeout or the assertion → E2 red; T5 drop the contextvar set → E4 red.
- Open a PR into feature/genie-code-mcp-integration titled "dedicated-thread-pool: a workshop-sized default executor (VIBE_THREAD_POOL_SIZE)".

## Findings
- **Step 3 (anyio): skipped. The shim at mcp_server.py ~:351 uses only `asyncio.to_thread`.** The installed MCP SDK (`mcp/server/fastmcp/utilities/func_metadata.py` `call_fn_with_arg_validation`) calls a sync tool body inline (`return fn(**arguments_parsed_dict)`), with no anyio offload. Our CallTool shim steps that coroutine inside `asyncio.to_thread(_run_sync_tool_in_thread, ...)` (mcp_server.py:351-353), so every sync MCP tool body runs on the loop's default executor, which is now the vibe-io pool. The only anyio `to_thread.run_sync` uses in the SDK are `FileResource`/`DirectoryResource` reads (`mcp/server/fastmcp/resources/types.py`) and the win32 process helper. This server registers neither, so no MCP request path uses anyio's 40-token limiter.
- Every FastAPI route is `async def`: 76 in routes.py, 15 in hackathon.py and 3 in app.py. So no route body runs on Starlette's anyio threadpool either. Starlette's `StaticFiles`/`FileResponse` still use anyio's default limiter (40 tokens) for file I/O. That is outside this ledger item and already larger than the old 6–8-thread default, so it is left alone.
- E1 checks the disabled case (env 0) through the loop's private `_default_executor` (still `None`) and by confirming worker threads are not `vibe-io`. E1 and E2 read the pool size from `ThreadPoolExecutor._max_workers`. Both are CPython internals with no public accessor.
- Values 1–3 clamp up to 4 with a WARNING, matching the out-of-range rule in step 1. The plan named only 1000 → 128.
- E3 checks the running app's loop through `client.portal.call(...)`: `asyncio.to_thread` inside the app loop runs on a `vibe-io` thread and `max_workers == 12`. After the `TestClient` exits, the installed pool rejects `submit` (it was shut down) and the module handle is cleared.
- Tamper T1 also turns the env-driven E1 cases red: 6 failed (16, 1000, 2, and the WARNING cases). T3 is red for both MCP-enabled and MCP-disabled params (2 failed).
- Live check L1 (FORGE/state/specs/dedicated-thread-pool/live_checks.md) needs a deployed app and is not run here.
