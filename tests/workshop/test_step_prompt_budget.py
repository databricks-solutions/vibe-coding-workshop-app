"""MCP step-prompt latency: off-loop execution, budget, single-flight, late-success.

These offline tests pin the four behaviours added to keep a slow FMAPI step-prompt
render from freezing the shared event loop (web UI + /mcp run on ONE loop):

  1. BUDGET — a generation that overruns ``STEP_PROMPT_BUDGET_S`` degrades the read
     to the assembled template (None), and the read returns within ~budget.
  2. SINGLE-FLIGHT — overlapping reads for one cache key run the generation EXACTLY
     once; the others join the same in-flight Future.
  3. LATE-SUCCESS CACHING — a generation that finishes after the owner's budget
     still writes the cache, so the next read is instant.
  4. OFF-LOOP — a sync MCP tool body (and the blocking serving-endpoint SDK call on
     the web path) runs in a worker thread, so a concurrent task keeps progressing;
     the OBO ContextVar propagates into both the tool thread and the generation
     thread.

All generation is faked via monkeypatch (no real FMAPI); the budget is patched
small so the suite stays fast. TAMPER notes on each test record what reverting the
change under test would do — verified manually during implementation.
"""

import asyncio
import contextvars
import pathlib
import sys
import threading
import time

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from mcp.types import CallToolRequest  # noqa: E402

from src.backend import mcp_server  # noqa: E402
from src.backend.api import routes  # noqa: E402

INDUSTRY = "Technology"
USE_CASE = "Genie Accelerator"


def _assembled(**overrides):
    base = {"input": "TEMPLATE BODY", "bypass_llm": False}
    base.update(overrides)
    return base


@pytest.fixture(autouse=True)
def _reset_step_prompt_state():
    """Isolate the module-global cache + in-flight + negative registries across tests."""
    mcp_server._STEP_PROMPT_CACHE.clear()
    with mcp_server._STEP_PROMPT_LOCK:
        mcp_server._STEP_PROMPT_INFLIGHT.clear()
        mcp_server._STEP_PROMPT_NEGATIVE.clear()
    yield
    mcp_server._STEP_PROMPT_CACHE.clear()
    with mcp_server._STEP_PROMPT_LOCK:
        mcp_server._STEP_PROMPT_INFLIGHT.clear()
        mcp_server._STEP_PROMPT_NEGATIVE.clear()


def _patch_generate(monkeypatch, *, source="llm_generated", prompt="GEN", delay=0.0,
                    gate=None, counter=None):
    """Install a fake async ``collect_step_prompt_via_stream``.

    The daemon generation now drains the web stream through
    ``collect_step_prompt_via_stream`` (returns the ``llm_generated`` dict shape on
    success, ``None`` on failure) instead of ``generate_prompt_content_with_llm``;
    the budget/single-flight/late-success machinery under test is unchanged, so this
    stub keeps returning the same dict shape ``_extract_llm_generated`` consumes.

    ``delay`` sleeps before returning; ``gate`` (a threading.Event) blocks the fake
    until the test releases it, so overlap is deterministic.
    """

    async def fake(*args, **kwargs):
        if counter is not None:
            counter["n"] += 1
        if gate is not None:
            while not gate.is_set():
                await asyncio.sleep(0.005)
        elif delay:
            await asyncio.sleep(delay)
        return {"source": source, "prompt": prompt}

    monkeypatch.setattr(routes, "collect_step_prompt_via_stream", fake)


def _gen(session_id, section_tag="prd_generation"):
    return mcp_server._generate_step_prompt(
        INDUSTRY, USE_CASE, section_tag, _assembled(), {}, session_id
    )


def _cache_key(session_id, section_tag="prd_generation", input_text="TEMPLATE BODY"):
    import hashlib

    return (session_id or "", section_tag, hashlib.sha256(input_text.encode()).hexdigest())


# --- 1. budget bites -------------------------------------------------------

def test_budget_bites_degrades_to_template(monkeypatch):
    # Fake sleeps well past the (small) budget; the read must degrade to template
    # (None), leave the cache key absent, and return within ~budget + slack.
    # TAMPER: raise STEP_PROMPT_BUDGET_S past the sleep -> the generation lands and
    # the read returns "GEN", failing the `is None` assertion (see the next test).
    monkeypatch.setattr(mcp_server, "STEP_PROMPT_BUDGET_S", 0.2)
    counter = {"n": 0}
    _patch_generate(monkeypatch, delay=2.0, counter=counter)

    start = time.monotonic()
    out = _gen("sess-budget")
    elapsed = time.monotonic() - start

    assert out is None  # template fallback
    assert _cache_key("sess-budget") not in mcp_server._STEP_PROMPT_CACHE
    assert elapsed < 0.2 + 1.0  # bounded by budget, not the 2s sleep
    assert counter["n"] == 1  # generation was started exactly once


def test_budget_large_enough_lets_generation_land(monkeypatch):
    # Positive control / the TAMPER proof for the budget test above: with the budget
    # raised past the fake's delay, the SAME slow fake lands and the read returns the
    # generated prompt. This is what reverting the budget would do to test 1.
    monkeypatch.setattr(mcp_server, "STEP_PROMPT_BUDGET_S", 5.0)
    _patch_generate(monkeypatch, prompt="LANDED", delay=0.3)

    out = _gen("sess-budget-ok")
    assert out == "LANDED"
    assert mcp_server._STEP_PROMPT_CACHE[_cache_key("sess-budget-ok")] == "LANDED"


# --- 2. within-budget success + cache --------------------------------------

def test_within_budget_success_is_cached(monkeypatch):
    monkeypatch.setattr(mcp_server, "STEP_PROMPT_BUDGET_S", 5.0)
    counter = {"n": 0}
    _patch_generate(monkeypatch, prompt="CACHED", counter=counter)

    first = _gen("sess-cache")
    second = _gen("sess-cache")

    assert first == second == "CACHED"
    assert counter["n"] == 1  # second read served from cache


# --- 3. single-flight ------------------------------------------------------

def test_single_flight_runs_generation_once(monkeypatch):
    # Two overlapping reads for the SAME key must trigger generation exactly once;
    # the second joins the in-flight Future.
    # TAMPER: remove the _STEP_PROMPT_INFLIGHT registry (each read generates) ->
    # counter == 2 -> this assertion fails.
    monkeypatch.setattr(mcp_server, "STEP_PROMPT_BUDGET_S", 5.0)
    gate = threading.Event()
    counter = {"n": 0}
    _patch_generate(monkeypatch, prompt="SHARED", gate=gate, counter=counter)

    results: dict[int, str | None] = {}

    def read(idx):
        results[idx] = _gen("sess-sf")

    t1 = threading.Thread(target=read, args=(0,))
    t2 = threading.Thread(target=read, args=(1,))
    t1.start()
    t2.start()
    # Give both reads time to enter: the owner starts the generation (blocked on the
    # gate) and the joiner attaches to the Future, before anything completes.
    time.sleep(0.3)
    gate.set()
    t1.join(5)
    t2.join(5)

    assert results == {0: "SHARED", 1: "SHARED"}
    assert counter["n"] == 1


# --- 4. late-success caching ----------------------------------------------

def test_late_success_populates_cache_for_next_read(monkeypatch):
    # The read times out (template), but the generation finishes afterwards and
    # still writes the cache, so the NEXT read hits it.
    # TAMPER: write the cache only on the owner's path (not inside the daemon
    # coroutine) -> the late result is lost and the next read regenerates.
    monkeypatch.setattr(mcp_server, "STEP_PROMPT_BUDGET_S", 0.2)
    counter = {"n": 0}
    _patch_generate(monkeypatch, prompt="LATE", delay=0.6, counter=counter)

    first = _gen("sess-late")
    assert first is None  # budget expired before the 0.6s generation finished

    key = _cache_key("sess-late")
    deadline = time.monotonic() + 3.0
    while key not in mcp_server._STEP_PROMPT_CACHE and time.monotonic() < deadline:
        time.sleep(0.02)
    assert mcp_server._STEP_PROMPT_CACHE.get(key) == "LATE"  # late-success landed

    second = _gen("sess-late")
    assert second == "LATE"
    assert counter["n"] == 1  # only the first (timed-out) read generated


# --- 5. off-loop MCP tool execution ---------------------------------------

def _fresh_server():
    server = mcp_server.WorkshopFastMCP(name="budget-test", stateless_http=True)
    server._install_error_aware_handler()
    return server


async def _invoke_with_ticker(server, tool_name):
    """Invoke the CallTool handler while a concurrent ticker runs; return ticks."""
    handler = server._mcp_server.request_handlers[CallToolRequest]
    req = CallToolRequest(method="tools/call", params={"name": tool_name, "arguments": {}})
    state = {"ticks": 0, "stop": False}

    async def ticker():
        while not state["stop"]:
            state["ticks"] += 1
            await asyncio.sleep(0.01)

    task = asyncio.create_task(ticker())
    result = await handler(req)
    state["stop"] = True
    await task
    return result, state["ticks"]


def test_sync_tool_runs_off_loop(monkeypatch):
    # A slow SYNC tool must not starve a concurrent loop task.
    # TAMPER: revert the asyncio.to_thread offload in `handle` (await tool.run on the
    # loop) -> the ticker makes no progress during the 0.4s sleep -> ticks ~= 0.
    server = _fresh_server()

    def slow_tool() -> str:
        time.sleep(0.4)
        return "ok"

    server.add_tool(slow_tool, name="slow_tool", structured_output=False)

    result, ticks = asyncio.run(_invoke_with_ticker(server, "slow_tool"))

    assert result.root.isError is False
    assert ticks >= 5  # the loop kept ticking (~40 possible) during the blocking call


# --- 6. OBO ContextVar propagation ----------------------------------------

_TEST_CV: contextvars.ContextVar[str] = contextvars.ContextVar("obo_test_cv", default="unset")


def test_contextvar_propagates_into_tool_thread():
    # The OBO auth context is a ContextVar; asyncio.to_thread copies contextvars, so
    # a value set before the handler must be visible inside the sync tool thread.
    server = _fresh_server()
    seen: dict[str, str] = {}

    def capturing_tool() -> str:
        seen["cv"] = _TEST_CV.get()
        return "ok"

    server.add_tool(capturing_tool, name="capturing_tool", structured_output=False)

    _TEST_CV.set("obo-token-abc")
    handler = server._mcp_server.request_handlers[CallToolRequest]
    req = CallToolRequest(method="tools/call", params={"name": "capturing_tool", "arguments": {}})
    asyncio.run(handler(req))

    assert seen["cv"] == "obo-token-abc"


def test_contextvar_propagates_into_generation_thread(monkeypatch):
    # _run_async_blocking copies contextvars, so the OBO context reaches the daemon
    # generation thread that runs the FMAPI call.
    monkeypatch.setattr(mcp_server, "STEP_PROMPT_BUDGET_S", 5.0)
    seen: dict[str, str] = {}

    async def fake(*args, **kwargs):
        seen["cv"] = _TEST_CV.get()
        return {"source": "llm_generated", "prompt": "GEN"}

    monkeypatch.setattr(routes, "collect_step_prompt_via_stream", fake)

    _TEST_CV.set("obo-token-xyz")
    out = _gen("sess-cv")
    assert out == "GEN"
    assert seen["cv"] == "obo-token-xyz"


# --- 7. routes serving-endpoint path runs off-loop -------------------------

class _FakeConfig:
    host = "https://example.cloud.databricks.com"


class _FakeApiClient:
    def do(self, method, path, body):  # noqa: ARG002 — mimics the SDK signature
        time.sleep(0.4)
        return {"choices": [{"message": {"content": "hi"}}]}


class _FakeClient:
    config = _FakeConfig()
    api_client = _FakeApiClient()


async def _call_endpoint_with_ticker():
    state = {"ticks": 0, "stop": False}

    async def ticker():
        while not state["stop"]:
            state["ticks"] += 1
            await asyncio.sleep(0.01)

    task = asyncio.create_task(ticker())
    result = await routes.call_databricks_serving_endpoint("hello", endpoint_name="ep")
    state["stop"] = True
    await task
    return result, state["ticks"]


def test_serving_endpoint_call_runs_off_loop(monkeypatch):
    # The blocking SDK api_client.do() must run off the shared loop.
    # TAMPER: remove the asyncio.to_thread wrapper at routes.py:~1605 (call do()
    # directly) -> the ticker starves during the 0.4s call -> ticks ~= 0.
    monkeypatch.setattr(routes, "DATABRICKS_SDK_AVAILABLE", True)
    monkeypatch.setattr(routes, "get_workspace_client", lambda: _FakeClient())
    monkeypatch.setattr(routes, "get_best_available_endpoint", lambda: "ep")

    result, ticks = asyncio.run(_call_endpoint_with_ticker())

    assert isinstance(result, dict)
    assert ticks >= 5  # loop kept progressing during the blocking SDK call


# --- extra: _run_async_blocking timeout primitive --------------------------

def test_run_async_blocking_times_out_without_blocking_callers():
    # The generic primitive: a budget raises TimeoutError; the default (None) waits
    # indefinitely (behaviour-identical to before this change).
    async def slow():
        await asyncio.sleep(2.0)
        return "done"

    start = time.monotonic()
    with pytest.raises(TimeoutError):
        mcp_server._run_async_blocking(slow, timeout_s=0.2)
    assert time.monotonic() - start < 1.0

    async def quick():
        return "quick"

    assert mcp_server._run_async_blocking(quick) == "quick"


def test_run_async_blocking_finalizes_partial_stream_without_destroyed_task(caplog, monkeypatch):
    # A generation that abandons an async generator mid-stream (truncated FMAPI
    # stream) leaves its athrow finalizer task scheduled on the private loop; the
    # runner must run loop.shutdown_asyncgens()/shutdown_default_executor() before
    # loop.close(), or Task.__del__ logs "Task was destroyed but it is pending!"
    # on every MCP generation. TAMPER: reverting the finally block to a bare
    # loop.close() re-surfaces that ERROR line and fails this test.
    import gc
    import logging

    async def stream():
        for i in range(3):
            yield i

    async def partial_consumer():
        async for _item in stream():
            break  # abandon mid-stream, like a truncated generation
        return "done"

    executor_shutdowns: list[int] = []
    original = asyncio.base_events.BaseEventLoop.shutdown_default_executor

    async def counting_shutdown_default_executor(self):
        executor_shutdowns.append(1)
        await original(self)

    monkeypatch.setattr(
        asyncio.base_events.BaseEventLoop,
        "shutdown_default_executor",
        counting_shutdown_default_executor,
    )

    with caplog.at_level(logging.ERROR, logger="asyncio"):
        assert mcp_server._run_async_blocking(partial_consumer) == "done"
        gc.collect()  # force the finalizer / Task.__del__ that would log the error

    assert "Task was destroyed but it is pending" not in caplog.text
    assert executor_shutdowns, "loop.shutdown_default_executor must run before close"


def test_run_async_blocking_acloses_alive_async_generator():
    # S1 pin: a generation that returns while an async generator is still ALIVE
    # (suspended mid-iteration, not exhausted) must have that generator aclose()d
    # by the runner's loop.shutdown_asyncgens() — its finally block runs before
    # _run_async_blocking returns, not merely "no destroyed-task warning".
    # TAMPER: remove the shutdown_asyncgens() call from the runner's finally ->
    # the generator is never finalized -> `finalized` stays empty -> this fails.
    finalized: list[str] = []
    keep_alive: list = []

    async def stream():
        try:
            for i in range(3):
                yield i
        finally:
            finalized.append("closed")

    async def partial_consumer():
        agen = stream()
        keep_alive.append(agen)  # strong ref: GC cannot finalize it behind our back
        assert await agen.__anext__() == 0
        return "done"

    assert mcp_server._run_async_blocking(partial_consumer) == "done"
    assert finalized == ["closed"]


def test_run_async_blocking_executor_shutdown_runs_when_asyncgens_shutdown_raises(monkeypatch, caplog):
    # #79 nit: each loop shutdown runs in its own try, so a raising
    # shutdown_asyncgens() neither skips shutdown_default_executor() nor masks the
    # coroutine's result, and the cleanup failure is logged at DEBUG (not swallowed).
    # TAMPER: merge both shutdowns back into ONE try -> the asyncgens failure skips
    # the executor shutdown -> `executor_shutdowns` stays empty -> this fails.
    import logging

    async def raising_shutdown_asyncgens(self):
        raise RuntimeError("shutdown_asyncgens failed")

    executor_shutdowns: list[int] = []
    original = asyncio.base_events.BaseEventLoop.shutdown_default_executor

    async def counting_shutdown_default_executor(self):
        executor_shutdowns.append(1)
        await original(self)

    monkeypatch.setattr(
        asyncio.base_events.BaseEventLoop, "shutdown_asyncgens", raising_shutdown_asyncgens
    )
    monkeypatch.setattr(
        asyncio.base_events.BaseEventLoop,
        "shutdown_default_executor",
        counting_shutdown_default_executor,
    )

    async def ok():
        return "RESULT"

    with caplog.at_level(logging.DEBUG, logger=mcp_server.logger.name):
        assert mcp_server._run_async_blocking(ok, timeout_s=2.0) == "RESULT"

    assert executor_shutdowns == [1]
    debug_lines = [
        r for r in caplog.records
        if r.levelno == logging.DEBUG and "shutdown_asyncgens failed" in r.getMessage()
    ]
    assert debug_lines, "a cleanup failure must be logged at DEBUG"


# --- 8. retry after a failed generation (cache contract, ACROSS the TTL) ----
# A generation that resolves None (endpoint error / non-llm source) must leave
# the key out of the POSITIVE cache and the in-flight registry, so once its
# negative-cache verdict expires the next read starts a FRESH generation and a
# later success is cached. This pins the PR #77 "a mock/error result is retried
# when the endpoint comes back" contract, now carried ACROSS the negative-cache
# TTL (the retry no longer happens on the immediately-following read — it waits
# out the TTL). The TTL is patched to 0.0 so the retry is observable in-test.
# TAMPER M1: replace the `_STEP_PROMPT_INFLIGHT.pop(...)` in the generation's
# finally with `pass` -> the resolved-None Future lingers in the registry, every
# later read joins it and gets the template forever -> both tests below fail
# (the in-flight-absence assertion, and the retry never happens: fake called once).

def test_non_llm_source_failure_is_retried_and_then_cached(monkeypatch):
    monkeypatch.setattr(mcp_server, "STEP_PROMPT_BUDGET_S", 5.0)
    monkeypatch.setattr(mcp_server, "_STEP_PROMPT_NEGATIVE_TTL_S", 0.0)  # expire immediately
    calls = {"n": 0}

    async def fake(*args, **kwargs):
        calls["n"] += 1
        if calls["n"] == 1:
            return {"source": "fallback_due_to_error", "prompt": "IGNORED"}
        return {"source": "llm_generated", "prompt": "RETRIED"}

    monkeypatch.setattr(routes, "collect_step_prompt_via_stream", fake)
    key = _cache_key("sess-retry-src")

    first = _gen("sess-retry-src")
    assert first is None  # degraded to template
    assert key not in mcp_server._STEP_PROMPT_CACHE  # failure is never positive-cached
    assert key not in mcp_server._STEP_PROMPT_INFLIGHT  # and the registry is cleared

    second = _gen("sess-retry-src")  # negative verdict already expired -> a NEW generation runs
    assert second == "RETRIED"
    assert calls["n"] == 2
    assert mcp_server._STEP_PROMPT_CACHE[key] == "RETRIED"


def test_raised_generation_is_retried_and_then_cached(monkeypatch):
    monkeypatch.setattr(mcp_server, "STEP_PROMPT_BUDGET_S", 5.0)
    monkeypatch.setattr(mcp_server, "_STEP_PROMPT_NEGATIVE_TTL_S", 0.0)  # expire immediately
    calls = {"n": 0}

    async def fake(*args, **kwargs):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("serving endpoint down")
        return {"source": "llm_generated", "prompt": "RECOVERED"}

    monkeypatch.setattr(routes, "collect_step_prompt_via_stream", fake)
    key = _cache_key("sess-retry-raise")

    first = _gen("sess-retry-raise")
    assert first is None  # exception degraded to template
    assert key not in mcp_server._STEP_PROMPT_CACHE
    assert key not in mcp_server._STEP_PROMPT_INFLIGHT

    second = _gen("sess-retry-raise")
    assert second == "RECOVERED"
    assert calls["n"] == 2
    assert mcp_server._STEP_PROMPT_CACHE[key] == "RECOVERED"


# --- 9. make_request (agent-format fallback) runs off-loop -----------------

class _FakeApiClientSchemaError:
    def do(self, method, path, body):  # noqa: ARG002 — mimics the SDK signature
        # Force the OpenAI path to fail with a schema error so the agent-format
        # fallback (make_request) is exercised.
        raise RuntimeError("BAD_REQUEST: schema validation failed, missing inputs")


class _FakeServingEndpointsSlow:
    def query(self, **kwargs):  # noqa: ARG002 — mimics the SDK signature
        time.sleep(0.4)
        return {"choices": [{"message": {"content": "hi"}}]}


class _FakeClientAgentFallback:
    config = _FakeConfig()
    api_client = _FakeApiClientSchemaError()
    serving_endpoints = _FakeServingEndpointsSlow()


def test_make_request_agent_fallback_runs_off_loop(monkeypatch):
    # The agent-format fallback wraps the blocking serving_endpoints.query() in
    # make_request; it must run off the shared loop too.
    # TAMPER M5: revert `await asyncio.to_thread(make_request, agent_payload)` to a
    # direct `make_request(agent_payload)` -> the ticker starves during the 0.4s
    # query() -> ticks ~= 0.
    monkeypatch.setattr(routes, "DATABRICKS_SDK_AVAILABLE", True)
    monkeypatch.setattr(routes, "get_workspace_client", lambda: _FakeClientAgentFallback())
    monkeypatch.setattr(routes, "get_best_available_endpoint", lambda: "ep")

    result, ticks = asyncio.run(_call_endpoint_with_ticker())

    assert isinstance(result, dict)
    assert ticks >= 5  # loop kept progressing during the blocking fallback query
