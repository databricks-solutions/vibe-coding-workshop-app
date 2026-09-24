"""Phase 2B / Task 2 — use-case discovery MCP resources (D11 §3.1, §6).

Two read-only, budget-free resources backed by the existing repository seams:

  vibe://usecases/industries   -> get_industries()     (value/label options)
  vibe://usecases/{industry}   -> get_use_cases_map()  (certified-first)

These are RESOURCES, not tools: the 6-tool budget must stay 6. Certified-first
ordering is enforced by the resource itself (the API returns raw Lakebase order).
All seams are mocked so the suite runs fully offline.
"""

import asyncio
import json
import pathlib
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server

INDUSTRIES_URI = "vibe://usecases/industries"

# get_industries() returns a leading placeholder option, then priority-ordered
# real industries (routes.py get_industries()).
INDUSTRIES_FIXTURE = [
    {"value": "", "label": "Select an industry..."},
    {"value": "retail", "label": "Retail & CPG"},
    {"value": "travel", "label": "Travel & Hospitality"},
]

# get_use_cases_map() returns RAW Lakebase order (certified-first is FRONTEND-only
# today). This fixture interleaves certified/non-certified so a stable
# certified-first sort is observable: raw order is F, T, T, F.
USE_CASES_FIXTURE = {
    "retail": [
        {"value": "", "label": "Select a use case..."},
        {"value": "returns_analysis", "label": "Returns Analysis",
         "path_type": "use_case", "is_certified": False, "category": "Ops"},
        {"value": "demand_forecasting", "label": "Demand Forecasting",
         "path_type": "use_case", "is_certified": True, "category": "Planning"},
        {"value": "assortment", "label": "Assortment Optimization",
         "path_type": "use_case", "is_certified": True, "category": "Planning"},
        {"value": "pricing", "label": "Dynamic Pricing",
         "path_type": "use_case", "is_certified": False, "category": "Revenue"},
    ]
}


def _read_resource(uri):
    """Read a resource through the MCP resource manager and parse its JSON."""
    resource = asyncio.run(mcp_server.mcp._resource_manager.get_resource(uri))
    assert resource is not None, f"resource not registered: {uri}"
    body = asyncio.run(resource.read())
    return json.loads(body)


def test_industries_resource_returns_options(monkeypatch):
    """(1) vibe://usecases/industries returns value/label options off get_industries()."""
    monkeypatch.setattr("src.backend.api.routes.get_industries", lambda: list(INDUSTRIES_FIXTURE))
    data = _read_resource(INDUSTRIES_URI)
    options = data["industries"]

    # Placeholder ("Select an industry...", value == "") is stripped; real options remain.
    assert [o["value"] for o in options] == ["retail", "travel"]
    for opt in options:
        assert set(("value", "label")) <= set(opt)
        assert opt["value"]


def test_usecases_resource_is_certified_first(monkeypatch):
    """(2) vibe://usecases/{industry} returns use cases certified-first, each with
    value/label/category/is_certified."""
    monkeypatch.setattr("src.backend.api.routes.get_use_cases_map", lambda: dict(USE_CASES_FIXTURE))
    data = _read_resource("vibe://usecases/retail")

    assert data["industry"] == "retail"
    cases = data["use_cases"]

    # Placeholder stripped.
    assert all(c["value"] for c in cases)
    values = [c["value"] for c in cases]

    # Certified entries sort ahead of non-certified.
    flags = [c["is_certified"] for c in cases]
    assert flags == [True, True, False, False]

    # Stable within each group: raw relative order preserved.
    assert values == ["demand_forecasting", "assortment", "returns_analysis", "pricing"]

    # Each entry carries the contract fields.
    for c in cases:
        assert set(("value", "label", "category", "is_certified")) <= set(c)


def test_usecases_resource_unknown_industry_is_empty(monkeypatch):
    """An industry with no rows yields an empty (but well-formed) listing."""
    monkeypatch.setattr("src.backend.api.routes.get_use_cases_map", lambda: dict(USE_CASES_FIXTURE))
    data = _read_resource("vibe://usecases/does-not-exist")
    assert data["industry"] == "does-not-exist"
    assert data["use_cases"] == []


def test_tool_budget_stays_six_and_resources_are_not_tools():
    """(3) Resources are budget-free: the registered tool set stays exactly 6, and
    neither use-case URI is a tool."""
    tool_names = {tool.name for tool in mcp_server.mcp._tool_manager.list_tools()}
    assert len(tool_names) == 6, f"tool budget drifted: {sorted(tool_names)}"

    # The use-case resources are registered as a concrete resource + a template,
    # never as tools.
    resource_uris = {str(r.uri) for r in mcp_server.mcp._resource_manager.list_resources()}
    template_uris = {t.uri_template for t in mcp_server.mcp._resource_manager.list_templates()}
    assert INDUSTRIES_URI in resource_uris
    assert "vibe://usecases/{industry}" in template_uris


def test_resources_are_read_only(monkeypatch):
    """(4) Reading the resources performs no writes / session mutation."""
    monkeypatch.setattr("src.backend.api.routes.get_industries", lambda: list(INDUSTRIES_FIXTURE))
    monkeypatch.setattr("src.backend.api.routes.get_use_cases_map", lambda: dict(USE_CASES_FIXTURE))

    def _boom(*args, **kwargs):
        raise AssertionError("resource read must not mutate session state")

    # Any accidental persistence call surfaces as a hard failure.
    monkeypatch.setattr(mcp_server, "save_session", _boom)
    monkeypatch.setattr(mcp_server, "append_session_interaction", _boom)

    first = _read_resource(INDUSTRIES_URI)
    second = _read_resource(INDUSTRIES_URI)
    assert first == second  # deterministic, side-effect-free
    _read_resource("vibe://usecases/retail")
