# Pin the untested offload + fallback paths from #77/#78/#79 (tests only)

## Evidence (lead read @ bfe95a0)
Covered today (tests/workshop/test_step_prompt_budget.py, test_step_prompt_stream_collector.py): budget bite/land, cache, single-flight, late success, off-loop tool, contextvar into tool + generation threads, api_client.do off-loop (:326), _run_async_blocking timeout + partial-stream finalize, retry after failure, make_request agent fallback off-loop (:484), collector success/error/truncation/bypass/empty/missing-done/raised, negative cache TTL/expiry/abandon. The #77 ledger (PR body) and #78 (`except BaseException` guard ledgered, PR body) leave these branches unpinned:
- routes.py:1626-1641 (call_databricks_serving_endpoint): (a) schema-class OpenAI failure where EVERY agent variation fails → `raise last_error` (the last agent error, not the OpenAI one); (b) a NON-schema OpenAI failure → agent fallback never attempted, error re-raised; (c) variation 1 fails, variation 2 succeeds → that response is used and last_error cleared.
- routes.py:1635 make_request offload: the OBO ContextVar is visible inside the make_request worker thread (only the api_client.do path is pinned today).
- mcp_server.py:1529 _run_async_blocking: a coroutine that raises → the SAME exception (type + message) re-raised on the calling thread.
- mcp_server.py:1538-1541: a raising loop.shutdown_asyncgens() must not mask the coroutine's successful result (pins the #79 contract BEFORE the phase3-nits PR splits it into separate try blocks).
- mcp_server.py:800 generation-path `except BaseException`: a generator raising a custom `class _Boom(BaseException)` → template served, negative entry written, the single-flight future resolved (a concurrent joiner returns, does not hang past its budget).

## Change — tests only
New file tests/workshop/test_offload_fallback_paths.py with 7 tests, one per bullet above (a, b, c, contextvar, re-raise, shutdown-no-mask, BaseException). Reuse the fakes/fixtures already in test_step_prompt_budget.py (import or copy minimal helpers; no conftest changes unless trivially needed). Fake endpoints only (monkeypatch); no real FMAPI; patch budgets small. Never raise a real KeyboardInterrupt/SystemExit in tests.
Each test names in its docstring the product line it pins and its tamper; PR body lists all 7 tampers:
T-a: replace `raise last_error` with `return {}`; T-b: drop the schema-class condition (always fall back); T-c: drop `break` after a successful variation (later failure overwrites); T-ctx: replace `asyncio.to_thread(make_request, …)` with a raw `threading.Thread` without copy_context; T-rr: in runner, swallow the exception instead of boxing it; T-sd: remove the try around the shutdowns; T-be: narrow `except BaseException` at :800 to `except Exception`.

## Fences
The new test file + the plan doc only. ZERO product-code diff (routes.py, mcp_server.py untouched). Explicit staging.

## Gates
Full `tests/workshop` + `tests/api` with the forge invocation ≥ last merged floor + 7, 0 failed; new tests < 5 s total.

## Deploy / live
No product change → release merges; code-only deploy, reseed=no. Live check: regression only (GET / 200; tools/list == 7).

## Reversal
Delete the test file.
