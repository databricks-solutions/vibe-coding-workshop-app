"""Workstream 2 - MCP -> UI deep-link handoff.

MCP and the web app already share the sessions table; the gap is discovery.
``vibe_start_track`` now hands back a ``session_url`` (``<base>?sessionId=<id>``)
derived from the forwarded request host, and the step-1 orientation carries the
same link so a learner can move between MCP and the app on one session.
"""

import pathlib
import sys
import types

import pytest
from fastapi import Request

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.workshop import engine, manifest

TRACK = "genie-accelerator"


def _context(headers: dict[str, str]):
    scope = {
        "type": "http",
        "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
    }
    request = Request(scope)
    return types.SimpleNamespace(request_context=types.SimpleNamespace(request=request))


# --- _request_base_url resolution --------------------------------------------


def test_base_url_from_forwarded_host():
    ctx = _context({"x-forwarded-host": "app.example.com", "x-forwarded-proto": "https"})
    assert mcp_server._request_base_url(ctx) == "https://app.example.com"


def test_base_url_from_host_header():
    ctx = _context({"host": "app.example.com"})
    assert mcp_server._request_base_url(ctx) == "https://app.example.com"


def test_base_url_none_without_context():
    assert mcp_server._request_base_url(None) is None


def test_base_url_none_for_localhost():
    ctx = _context({"host": "localhost:8000"})
    assert mcp_server._request_base_url(ctx) is None


# --- vibe_start_track returns the deep link ----------------------------------


def test_start_track_returns_session_url(monkeypatch):
    monkeypatch.setattr(mcp_server, "load_session", lambda session_id: None)
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: False)
    ctx = _context({"x-forwarded-host": "app.example.com", "x-forwarded-proto": "https"})

    result = mcp_server.vibe_start_track(TRACK, context=ctx)

    assert result.session_url is not None
    assert result.session_url.startswith("https://app.example.com?sessionId=")
    assert result.session_url.endswith(result.session_id)


def test_start_track_session_url_none_without_host(monkeypatch):
    monkeypatch.setattr(mcp_server, "load_session", lambda session_id: None)
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: False)

    result = mcp_server.vibe_start_track(TRACK)

    assert result.session_url is None


# --- the step-1 orientation carries the same link ----------------------------


def test_stash_base_url_sets_app_base_url():
    ctx = _context({"x-forwarded-host": "app.example.com", "x-forwarded-proto": "https"})
    state = engine.SessionState()

    mcp_server._stash_base_url(state, ctx)

    assert state.session_parameters["app_base_url"] == "https://app.example.com"


def test_step_one_orientation_includes_deep_link():
    steps = manifest.load_manifest().track_steps(TRACK)
    first = next(s for s in steps if s.order == 1)
    state = engine.SessionState(session_parameters={"app_base_url": "https://app.example.com"})

    payload = mcp_server._step_payload(TRACK, state, first, session_id="abc123")

    assert payload.orientation is not None
    assert "Open in the workshop UI: https://app.example.com?sessionId=abc123" in payload.orientation
