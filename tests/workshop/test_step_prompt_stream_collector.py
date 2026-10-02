"""MCP step-prompt generation SUCCESS: stream collector + negative cache.

The amended Phase 3 latency fix (human ruling 2026-10-02). Two pieces are pinned
here, both offline (fake async generator; no real FMAPI; the budget/TTL patched
small so the suite stays fast):

  1. COLLECTOR (`routes.collect_step_prompt_via_stream`) — drains the WEB streaming
     generator (`stream_llm_response`) with the MCP `genie-code` fork and returns a
     COMPLETE, UNTRUNCATED prompt. SUCCESS is a terminal `done` + non-empty content
     + NO max_tokens (truncation) warning + NO error + a non-`bypass_llm` model;
     anything else returns None so the caller keeps the assembled template. A
     truncated prompt is a FAILURE and is never returned.

  2. NEGATIVE CACHE (mcp_server) — a TRULY-resolved failure (None from the collector,
     or an exception) is negative-cached for `_STEP_PROMPT_NEGATIVE_TTL_S`, checked
     under the lock before electing/joining, so a known-failing key degrades to the
     template instantly instead of re-generating on every poll. It is NEVER written
     on a budget abandonment (the stream is still draining; a late success must still
     be able to land and cache). On TTL expiry the entry drops and the next read
     elects a fresh generation (retry-after-failure holds across the TTL).

Each test records the BOTH-DIRECTION tamper that would break it.
"""

import asyncio
import hashlib
import pathlib
import sys
import threading
import time

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server  # noqa: E402
from src.backend.api import routes  # noqa: E402

INDUSTRY = "Technology"
USE_CASE = "Genie Accelerator"
SECTION = "prd_generation"

# The shared conftest autouse fixture stubs ``routes.collect_step_prompt_via_stream``
# to None for offline isolation. Capture the REAL collector at import (before any
# fixture runs) so the tests that exercise the collector itself can call/restore it.
_REAL_COLLECTOR = routes.collect_step_prompt_via_stream


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


# --- fakes -----------------------------------------------------------------

def _make_stream(events, record=None):
    """Build a fake ``stream_llm_response`` yielding the given SSE events.

    ``record`` (a dict) captures the call's args/kwargs so a test can assert the
    collector forwards ``coding_assistant_override``.
    """

    async def fake(*args, **kwargs):
        if record is not None:
            record["args"] = args
            record["kwargs"] = kwargs
        for event in events:
            yield routes._sse_event(event)

    return fake


def _start(model="serving-ep"):
    return {"type": "start", "model": model}


def _content(text):
    return {"type": "content", "content": text}


def _truncation():
    return {"type": "warning", "code": "max_tokens", "message": "stopped at limit"}


def _error(msg="boom"):
    return {"type": "error", "error": msg}


def _done():
    return {"type": "done"}


def _collect(coding_assistant="genie-code"):
    # Call the REAL collector directly (bypassing the conftest None-stub) so the
    # drain + success/failure logic under test actually runs.
    return asyncio.run(
        _REAL_COLLECTOR(INDUSTRY, USE_CASE, SECTION, coding_assistant=coding_assistant)
    )


def _cache_key(session_id, section_tag=SECTION, input_text="TEMPLATE BODY"):
    return (session_id or "", section_tag, hashlib.sha256(input_text.encode()).hexdigest())


def _assembled(**overrides):
    base = {"input": "TEMPLATE BODY", "bypass_llm": False}
    base.update(overrides)
    return base


def _gen(session_id, section_tag=SECTION):
    return mcp_server._generate_step_prompt(
        INDUSTRY, USE_CASE, section_tag, _assembled(), {}, session_id
    )


# --- collector: success / concatenation ------------------------------------

def test_collector_concatenates_chunks_exactly(monkeypatch):
    # T-d: every content chunk is concatenated in order into the final prompt.
    # TAMPER: drop a chunk (e.g. yield only "AB") -> prompt != "ABCD" -> fail.
    events = [_start(), _content("AB"), _content("CD"), _done()]
    monkeypatch.setattr(routes, "stream_llm_response", _make_stream(events))

    out = _collect()
    assert out == {"source": "llm_generated", "prompt": "ABCD"}


def test_collector_forwards_genie_code_override(monkeypatch):
    # The collector drains the web generator with the MCP coding-assistant fork.
    # TAMPER: drop `coding_assistant_override=...` in the collector's call ->
    # the kwarg is absent/None here -> this assertion fails.
    record = {}
    events = [_start(), _content("Y"), _done()]
    monkeypatch.setattr(routes, "stream_llm_response", _make_stream(events, record=record))

    out = _collect()
    assert out == {"source": "llm_generated", "prompt": "Y"}
    assert record["kwargs"].get("coding_assistant_override") == "genie-code"


# --- collector: failure modes all return None ------------------------------

def test_collector_error_event_returns_none(monkeypatch):
    # An error event anywhere -> failure -> None (template).
    # TAMPER: ignore the error event in the collector -> partial content returned.
    events = [_start(), _content("partial"), _error()]
    monkeypatch.setattr(routes, "stream_llm_response", _make_stream(events))

    assert _collect() is None


def test_collector_truncation_returns_none(monkeypatch):
    # T-e: a max_tokens (truncation) warning is a FAILURE — the prompt is incomplete
    # and must never be served.
    # TAMPER: accept truncated output (ignore the warning) -> returns {"...": "LONG"}
    # instead of None -> this test fails.
    events = [_start(), _content("LONG"), _truncation(), _done()]
    monkeypatch.setattr(routes, "stream_llm_response", _make_stream(events))

    assert _collect() is None


def test_collector_bypass_model_returns_none(monkeypatch):
    # A bypass_llm "generation" is not an LLM result -> None (keep assembled template).
    # TAMPER: drop the `model != "bypass_llm"` guard -> returns the combined output.
    events = [_start(model="bypass_llm"), _content("COMBINED"), _done()]
    monkeypatch.setattr(routes, "stream_llm_response", _make_stream(events))

    assert _collect() is None


def test_collector_empty_content_returns_none(monkeypatch):
    # A clean done but no content is not a usable prompt -> None.
    # TAMPER: return a prompt for empty content -> returns {"...": ""}.
    events = [_start(), _done()]
    monkeypatch.setattr(routes, "stream_llm_response", _make_stream(events))

    assert _collect() is None


def test_collector_missing_done_returns_none(monkeypatch):
    # Content with no terminal done event = incomplete stream -> None.
    # TAMPER: treat a cut-off stream as success -> returns partial content.
    events = [_start(), _content("X")]
    monkeypatch.setattr(routes, "stream_llm_response", _make_stream(events))

    assert _collect() is None


def test_collector_handles_raised_stream(monkeypatch):
    # If the generator raises mid-drain, the collector degrades to None (not a crash).
    async def boom(*args, **kwargs):
        yield routes._sse_event(_start())
        raise RuntimeError("stream exploded")

    monkeypatch.setattr(routes, "stream_llm_response", boom)
    assert _collect() is None


# --- negative cache (mcp_server, via _generate_step_prompt) -----------------

def test_negative_cache_honored_within_ttl(monkeypatch):
    # T-a: a resolved failure is negative-cached; a repeat read within the TTL
    # degrades to the template instantly WITHOUT re-generating (fake invoked once).
    # TAMPER: drop the under-lock negative-cache check -> the second read elects a
    # fresh generation -> counter == 2 -> fail.
    monkeypatch.setattr(mcp_server, "STEP_PROMPT_BUDGET_S", 5.0)
    counter = {"n": 0}

    async def fake(*args, **kwargs):
        counter["n"] += 1
        return None  # true failure

    monkeypatch.setattr(routes, "collect_step_prompt_via_stream", fake)
    key = _cache_key("sess-neg")

    first = _gen("sess-neg")
    assert first is None  # template fallback
    assert key in mcp_server._STEP_PROMPT_NEGATIVE  # failure verdict recorded
    assert key not in mcp_server._STEP_PROMPT_CACHE  # never positive-cached

    second = _gen("sess-neg")
    assert second is None
    assert counter["n"] == 1  # served from the negative cache; no regeneration


def test_negative_cache_expires_to_fresh_elect(monkeypatch):
    # TTL expiry -> the next read elects a FRESH generation (retry-after-failure
    # holds across the TTL). TTL is patched to 0.0 so the first verdict is already
    # expired by the second read.
    # TAMPER: never expire the negative entry -> the second read stays template ->
    # counter == 1 and second is None -> fail.
    monkeypatch.setattr(mcp_server, "STEP_PROMPT_BUDGET_S", 5.0)
    monkeypatch.setattr(mcp_server, "_STEP_PROMPT_NEGATIVE_TTL_S", 0.0)
    counter = {"n": 0}

    async def fake(*args, **kwargs):
        counter["n"] += 1
        if counter["n"] == 1:
            return None  # first attempt fails
        return {"source": "llm_generated", "prompt": "RECOVERED"}

    monkeypatch.setattr(routes, "collect_step_prompt_via_stream", fake)
    key = _cache_key("sess-exp")

    assert _gen("sess-exp") is None  # failure degraded to template
    second = _gen("sess-exp")  # verdict expired -> re-elect -> late success
    assert second == "RECOVERED"
    assert counter["n"] == 2
    assert mcp_server._STEP_PROMPT_CACHE[key] == "RECOVERED"


def test_truncation_degrades_and_is_negative_cached_end_to_end(monkeypatch):
    # The real collector + the negative cache together: a truncated web stream yields
    # None (template served), is NEVER cached as llm_generated, AND writes a negative
    # entry so the next poll is instant.
    # TAMPER (T-e): accept truncated output in the collector -> _gen returns "LONG",
    # the positive cache holds it, and the negative entry is absent -> fail.
    monkeypatch.setattr(mcp_server, "STEP_PROMPT_BUDGET_S", 5.0)
    # Restore the REAL collector (conftest stubs it to None) so the daemon drains the
    # (stubbed) truncating stream through the actual success/failure logic.
    monkeypatch.setattr(routes, "collect_step_prompt_via_stream", _REAL_COLLECTOR)
    events = [_start(), _content("LONG"), _truncation(), _done()]
    monkeypatch.setattr(routes, "stream_llm_response", _make_stream(events))
    key = _cache_key("sess-trunc")

    out = _gen("sess-trunc")
    assert out is None  # truncated prompt never served
    assert key not in mcp_server._STEP_PROMPT_CACHE  # never cached as llm_generated
    assert key in mcp_server._STEP_PROMPT_NEGATIVE  # negative entry written


def test_budget_abandonment_does_not_write_negative(monkeypatch):
    # T-b: when the READER abandons on budget expiry (generation still in flight),
    # NO negative entry is written — so a late success can still land and cache.
    # TAMPER: write the negative entry on budget abandonment (e.g. in the owner's
    # TimeoutError branch) -> the "absent after abandonment" assertion fails.
    monkeypatch.setattr(mcp_server, "STEP_PROMPT_BUDGET_S", 0.2)
    gate = threading.Event()

    async def fake(*args, **kwargs):
        while not gate.is_set():
            await asyncio.sleep(0.005)
        return {"source": "llm_generated", "prompt": "LATE_OK"}

    monkeypatch.setattr(routes, "collect_step_prompt_via_stream", fake)
    key = _cache_key("sess-abandon")

    first = _gen("sess-abandon")
    assert first is None  # template on budget expiry, generation still draining
    assert key not in mcp_server._STEP_PROMPT_NEGATIVE  # abandonment wrote NO verdict

    # Release the generation: the late success lands in the POSITIVE cache (not poisoned).
    gate.set()
    deadline = time.monotonic() + 3.0
    while key not in mcp_server._STEP_PROMPT_CACHE and time.monotonic() < deadline:
        time.sleep(0.02)
    assert mcp_server._STEP_PROMPT_CACHE.get(key) == "LATE_OK"
    assert key not in mcp_server._STEP_PROMPT_NEGATIVE  # success never negative-caches
