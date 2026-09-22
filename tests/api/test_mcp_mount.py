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

    assert response.status_code == 200
    assert "Vibe Coding Workshop API" in response.text
    assert not any(getattr(route, "path", None) == "/mcp" for route in app_module.app.routes)


def test_mcp_mount_is_enabled_when_flag_is_on(monkeypatch):
    app_module = load_app(monkeypatch, enabled=True)

    assert any(getattr(route, "path", None) == "/mcp" for route in app_module.app.routes)
