"""Browser-compatibility regression tests for the optional MCP mount."""

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
        "clientInfo": {"name": "browser-compat-test", "version": "1.0"},
    },
}
MCP_HEADERS = {
    "Accept": "application/json, text/event-stream",
    "Content-Type": "application/json",
}


def load_app(monkeypatch, enabled: bool, allowed_origins: str | None = None):
    if enabled:
        monkeypatch.setenv("MCP_MOUNT_ENABLED", "true")
    else:
        monkeypatch.delenv("MCP_MOUNT_ENABLED", raising=False)
    if allowed_origins is None:
        monkeypatch.delenv("ALLOWED_ORIGINS", raising=False)
    else:
        monkeypatch.setenv("ALLOWED_ORIGINS", allowed_origins)
    sys.modules.pop("app", None)
    if enabled:
        sys.modules.pop("src.backend.mcp_server", None)
    return importlib.import_module("app")


def test_mcp_cors_preflight_allows_configured_origin(monkeypatch):
    origin = "https://genie-code.example"
    app_module = load_app(monkeypatch, enabled=True, allowed_origins=origin)

    with TestClient(app_module.app, base_url="http://127.0.0.1:8000", follow_redirects=False) as client:
        response = client.options(
            "/mcp",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": (
                    "content-type,authorization,mcp-protocol-version,mcp-session-id,accept"
                ),
            },
        )

    assert response.status_code in {200, 204}, response.text
    assert response.headers["access-control-allow-origin"] == origin
    assert response.headers["access-control-allow-origin"] != "*"
    assert response.headers["access-control-allow-credentials"].lower() == "true"
    allowed_methods = {
        method.strip().upper()
        for method in response.headers["access-control-allow-methods"].split(",")
    }
    assert "POST" in allowed_methods


def test_mcp_initialize_with_origin_is_not_rejected_and_exposes_cors_headers(monkeypatch):
    origin = "https://genie-code.example"
    app_module = load_app(monkeypatch, enabled=True, allowed_origins=origin)

    with TestClient(app_module.app, base_url="http://127.0.0.1:8000", follow_redirects=False) as client:
        response = client.post(
            "/mcp", headers={**MCP_HEADERS, "Origin": origin},
            json=INITIALIZE_REQUEST,
        )

    assert response.status_code == 200, response.text
    exposed_headers = {
        header.strip().lower()
        for header in response.headers["access-control-expose-headers"].split(",")
    }
    assert {"mcp-session-id", "mcp-protocol-version"} <= exposed_headers


def test_mcp_tools_list_exposes_only_genie_compatible_tool_fields(monkeypatch):
    app_module = load_app(monkeypatch, enabled=True)
    tools_list_request = {
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/list",
        "params": {},
    }

    with TestClient(app_module.app, base_url="http://127.0.0.1:8000", follow_redirects=False) as client:
        initialize_response = client.post(
            "/mcp", headers=MCP_HEADERS, json=INITIALIZE_REQUEST
        )
        tools_response = client.post(
            "/mcp", headers=MCP_HEADERS, json=tools_list_request
        )

    assert initialize_response.status_code == 200, initialize_response.text
    assert tools_response.status_code == 200, tools_response.text
    tools = tools_response.json()["result"]["tools"]
    assert tools
    for tool in tools:
        assert {"name", "description", "inputSchema"} <= tool.keys()
        assert "outputSchema" not in tool
        assert "annotations" not in tool
