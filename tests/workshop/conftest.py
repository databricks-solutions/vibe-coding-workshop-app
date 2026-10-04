"""Shared offline guards for the workshop MCP test suite.

The MCP step payload now renders its prompt by draining the web streaming
generator (`collect_step_prompt_via_stream`) to match the web path. Left unstubbed
that would fire a real serving-endpoint stream on every `vibe_get_step`, making the
offline suite slow and non-deterministic. The autouse fixture below defaults the
collector to a failure signal (``None``), so `_step_payload` degrades to the
assembled template exactly as it does when the endpoint is unavailable. Tests that
exercise the generation wiring re-stub it with their own
`monkeypatch.setattr(routes, "collect_step_prompt_via_stream", ...)`.

The legacy `generate_prompt_content_with_llm` stub is kept too (the non-streaming
web `/generate-prompt` endpoint still calls it), and the negative cache is cleared
per-test alongside the positive cache so a failure verdict never leaks between tests.
"""

import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.api import routes
from src.backend.services import lakebase


@pytest.fixture(autouse=True)
def _offline_step_prompt_fmapi(monkeypatch):
    async def _fake_collect(*args, **kwargs):
        # Offline default: no live generation -> _step_payload keeps the template.
        return None

    async def _fake_generate(*args, **kwargs):
        return {"source": "mock_llm", "prompt": ""}

    monkeypatch.setattr(routes, "collect_step_prompt_via_stream", _fake_collect)
    monkeypatch.setattr(routes, "generate_prompt_content_with_llm", _fake_generate)
    mcp_server._STEP_PROMPT_CACHE.clear()
    with mcp_server._STEP_PROMPT_LOCK:
        mcp_server._STEP_PROMPT_NEGATIVE.clear()
    yield
    mcp_server._STEP_PROMPT_CACHE.clear()
    with mcp_server._STEP_PROMPT_LOCK:
        mcp_server._STEP_PROMPT_NEGATIVE.clear()


_NO_LEGACY_SAVE_STUB = object()


@pytest.fixture(autouse=True)
def _route_mcp_delta_through_legacy_save_stub(monkeypatch):
    """Keep the store-backed ``save_session`` stubs in these tests meaningful.

    MCP writes go through ``_persist_mcp_delta`` -> the locked
    ``save_session_applying_mcp_delta`` (D-9), no longer ``save_session``. Many
    tests stub ``mcp_server.save_session`` over an in-memory store. While such a
    stub is installed, the delta is applied to the stub's stored record with the
    production merge (``lakebase._apply_mcp_delta``) and handed to the stub as the
    merged end state: only the touched JSONB columns, plus the non-None
    ``save_session`` columns. An empty delta is the same no-op as in production.
    With no stub, the real locked function runs (test_mcp_delta_persist.py).
    """

    real = mcp_server.save_session_applying_mcp_delta
    monkeypatch.setattr(mcp_server, "save_session", _NO_LEGACY_SAVE_STUB, raising=False)

    def bridge(session_id, *, add_gates, set_outputs, set_params, **save_kwargs):
        stub = mcp_server.save_session
        if stub is _NO_LEGACY_SAVE_STUB:
            return real(
                session_id,
                add_gates=add_gates,
                set_outputs=set_outputs,
                set_params=set_params,
                **save_kwargs,
            )
        fields = {key: value for key, value in save_kwargs.items() if value is not None}
        if not (add_gates or set_outputs or set_params or fields):
            return True
        record = mcp_server.load_session(session_id) or {}
        gates, outputs, params = lakebase._apply_mcp_delta(
            list(record.get("completed_gates") or []),
            dict(record.get("captured_outputs") or {}),
            dict(record.get("session_parameters") or {}),
            add_gates=add_gates,
            set_outputs=set_outputs,
            set_params=set_params,
        )
        if add_gates:
            fields["completed_gates"] = gates
        if set_outputs:
            fields["captured_outputs"] = outputs
        if set_params:
            fields["session_parameters"] = params
        return stub(session_id=session_id, **fields)

    monkeypatch.setattr(mcp_server, "save_session_applying_mcp_delta", bridge)
