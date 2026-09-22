"""Regression tests for the optional read-only MCP mount."""

import importlib
import sys

from starlette.testclient import TestClient

INITIALIZE_REQUEST = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
        "protocolVersion": "2025-11-25",
        "capabilities": {},
        "clientInfo": {"name": "mount-test", "version": "1.0"},
    },
}
MCP_HEADERS = {
    "Accept": "application/json, text/event-stream",
    "Content-Type": "application/json",
}


def load_app(monkeypatch, enabled: bool):
    if enabled:
        monkeypatch.setenv("MCP_MOUNT_ENABLED", "true")
    else:
        monkeypatch.delenv("MCP_MOUNT_ENABLED", raising=False)
    sys.modules.pop("app", None)
    if enabled:
        sys.modules.pop("src.backend.mcp_server", None)
    return importlib.import_module("app")


def test_post_mcp_without_trailing_slash_is_not_redirected(monkeypatch):
    app_module = load_app(monkeypatch, enabled=True)

    with TestClient(app_module.app, base_url="http://127.0.0.1:8000", follow_redirects=False) as client:
        response = client.post("/mcp", headers=MCP_HEADERS, json=INITIALIZE_REQUEST)

    assert response.status_code == 200
    assert "location" not in response.headers
    assert response.headers["content-type"].split(";", 1)[0] in {
        "application/json",
        "text/event-stream",
    }


def test_mcp_is_handled_by_mcp_app_not_spa_catch_all(monkeypatch):
    app_module = load_app(monkeypatch, enabled=True)

    with TestClient(app_module.app, base_url="http://127.0.0.1:8000", follow_redirects=False) as client:
        response = client.post("/mcp", headers=MCP_HEADERS, json=INITIALIZE_REQUEST)

    assert response.status_code == 200
    assert "Vibe Coding Workshop API" not in response.text


def test_mcp_lifespan_starts_session_manager(monkeypatch):
    app_module = load_app(monkeypatch, enabled=True)

    with TestClient(app_module.app, base_url="http://127.0.0.1:8000", follow_redirects=False) as client:
        response = client.post("/mcp", headers=MCP_HEADERS, json=INITIALIZE_REQUEST)

    assert response.status_code == 200


def test_mcp_mount_is_feature_flagged_default_off(monkeypatch):
    app_module = load_app(monkeypatch, enabled=False)

    with TestClient(app_module.app, base_url="http://127.0.0.1:8000", follow_redirects=False) as client:
        response = client.get("/mcp")

    # With the flag off, /mcp is not a mount; it falls through to the SPA
    # catch-all and returns 200. We assert the structural fact — no /mcp route
    # is registered — rather than the response body, which depends on whether
    # frontend/dist has been built (SPA index.html when built, API-banner JSON
    # when not). Asserting the body string made this test env-dependent.
    assert response.status_code == 200
    assert not any(getattr(route, "path", None) == "/mcp" for route in app_module.app.routes)


def test_mcp_mount_is_enabled_when_flag_is_on(monkeypatch):
    app_module = load_app(monkeypatch, enabled=True)

    assert any(getattr(route, "path", None) == "/mcp" for route in app_module.app.routes)


def test_mcp_path_rewrite_accepts_app_kwarg(monkeypatch):
    """Starlette builds the middleware stack as cls(app=app, ...) — passing the
    ASGI app by KEYWORD. The middleware's first param must therefore be named
    `app`, or every route 500s at stack-build time. This guards the convention
    directly (some Starlette versions instantiate positionally, which hid the
    bug in the TestClient-based tests)."""
    app_module = load_app(monkeypatch, enabled=True)

    async def _noop(scope, receive, send):
        return None

    mw = app_module._MCPPathRewrite(app=_noop)  # must not raise on `app=`
    assert mw.app is _noop


def test_normalize_mcp_accept_widens_intolerant_values(monkeypatch):
    """The Streamable HTTP transport 406s unless Accept lists BOTH
    application/json and text/event-stream. Genie Code's browser save-time probe
    sends a JSON-only / wildcard / empty Accept, so the middleware must widen it
    to the dual value; a client that already lists both is left untouched."""
    app_module = load_app(monkeypatch, enabled=True)
    dual = b"application/json, text/event-stream"

    def accept_of(headers):
        return dict(app_module._normalize_mcp_accept(headers)).get(b"accept")

    # JSON-only, wildcard, and a bare accept are all widened to the dual value.
    assert accept_of([(b"accept", b"application/json")]) == dual
    assert accept_of([(b"accept", b"*/*")]) == dual
    assert accept_of([(b"accept", b"")]) == dual
    # Missing Accept entirely -> the dual value is injected.
    assert accept_of([(b"content-type", b"application/json")]) == dual
    # Already-tolerant Accept is preserved verbatim (case-insensitive match).
    preserved = b"text/event-stream, application/json"
    assert accept_of([(b"accept", preserved)]) == preserved


def test_post_mcp_with_json_only_accept_is_not_406(monkeypatch):
    """End-to-end guard for the root cause: a JSON-only Accept (what Genie Code's
    browser save-time validation sends) must NOT 406 — the middleware widens it
    so the initialize handshake succeeds and the server can be saved."""
    app_module = load_app(monkeypatch, enabled=True)

    with TestClient(app_module.app, base_url="http://127.0.0.1:8000", follow_redirects=False) as client:
        response = client.post(
            "/mcp",
            headers={"Accept": "application/json", "Content-Type": "application/json"},
            json=INITIALIZE_REQUEST,
        )

    assert response.status_code == 200, response.text


def test_mcp_mount_is_ordered_before_spa_catch_all(monkeypatch):
    """The /mcp mount must precede the SPA catch-all so /mcp is never resolved
    by index.html. Guards route ordering structurally (method-independent),
    not just via a single POST round-trip."""
    app_module = load_app(monkeypatch, enabled=True)

    routes = app_module.app.routes
    mcp_index = next(
        i for i, r in enumerate(routes) if getattr(r, "path", None) == "/mcp"
    )
    catch_all_index = next(
        i for i, r in enumerate(routes)
        if getattr(r, "path", None) == "/{full_path:path}"
    )
    assert mcp_index < catch_all_index
