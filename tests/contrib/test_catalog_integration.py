"""Contributed use cases flow through the same catalog functions as native ones."""

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from src.backend.api import routes
from src.backend.api.contrib import router as contrib_router
from src.backend.contrib import COMMUNITY_COLLECTION_ID, registry
from src.backend.contrib.loader import load_catalog, make_key

from .helpers import PNG, add_certification, add_contributor, add_use_case

KEY = make_key("acme", "planner")
NATIVE = [{
    "industry": "retail", "industry_label": "Retail", "use_case": "customer_360", "use_case_label": "Customer 360",
    "prompt_template": "Native brief", "version": 3, "category": None, "category_order": None,
    "display_order": None, "is_certified": True,
}]


@pytest.fixture
def contrib(tmp_path, monkeypatch):
    add_contributor(tmp_path, "acme", "partner")
    add_contributor(tmp_path, "certco", "company", can_certify=True)
    folder = add_use_case(tmp_path, "acme", "planner", collections={"home": "retail", "also": ["office_of_cfo"]},
                          media={"cover": "images/cover.png"})
    (folder / "images").mkdir()
    (folder / "images" / "cover.png").write_bytes(PNG)
    add_certification(tmp_path, "certco", "acme", "planner")
    registry.reset_for_tests(load_catalog(tmp_path))

    cache = {
        "usecase_descriptions": NATIVE, "section_input_prompts": None,
        "collections": [
            {"collection_id": "retail", "kind": "industry", "label": "Retail", "display_order": 2, "is_enabled": True},
            {"collection_id": "office_of_cfo", "kind": "function", "label": "Office of the CFO", "display_order": 1, "is_enabled": True},
        ],
        "collection_members": [], "contrib_overrides": {KEY: {"is_active": True}}, "last_refresh": 1.0,
    }
    monkeypatch.setattr(routes, "_lakebase_cache", cache)
    monkeypatch.setattr(routes, "get_usecase_descriptions_from_lakebase", lambda: NATIVE)
    yield cache
    registry.reset_for_tests(None)


def entry(use_cases, collection, key=KEY):
    return next(e for e in use_cases[collection] if e.get("value") == key)


def test_contribution_appears_in_home_collection_with_provenance(contrib):
    use_cases = routes.get_use_cases_map()
    e = entry(use_cases, "retail")
    assert e["provenance"] == "partner"
    assert e["contribution"]["contributor"]["display_name"] == "Acme"
    assert [c["by"]["id"] for c in e["contribution"]["certifications"]] == ["certco"]
    assert e["contribution"]["media"]["cover_url"].startswith("/api/contrib/assets/")
    assert e["is_certified"] is False
    native = entry(use_cases, "retail", "customer_360")
    assert "provenance" not in native and native["is_certified"] is True


def test_contribution_is_cross_listed_into_community_and_also(contrib):
    use_cases = routes.get_use_cases_map()
    assert entry(use_cases, COMMUNITY_COLLECTION_ID)["category"] == "Partner contributions"
    assert entry(use_cases, "office_of_cfo")["home_industry"] == "retail"
    values = [i["value"] for i in routes.get_industries()]
    assert COMMUNITY_COLLECTION_ID in values and "office_of_cfo" in values


def test_prompt_templates_resolve_everywhere(contrib):
    templates = routes.get_prompt_templates_map()
    for collection in ("retail", COMMUNITY_COLLECTION_ID, "office_of_cfo"):
        assert templates[collection][KEY].startswith("Build a **simple app**")
    assert templates["retail"]["customer_360"] == "Native brief"


def test_new_contribution_stays_out_of_the_workshop_until_activated(contrib):
    contrib["contrib_overrides"] = {}
    use_cases = routes.get_use_cases_map()
    assert all(e.get("value") != KEY for lst in use_cases.values() for e in lst)
    assert COMMUNITY_COLLECTION_ID not in [i["value"] for i in routes.get_industries()]
    assert KEY in routes.get_prompt_templates_map()["retail"]


def test_deactivated_contribution_leaves_the_picker_but_keeps_its_brief(contrib):
    contrib["contrib_overrides"] = {KEY: {"is_active": False}}
    use_cases = routes.get_use_cases_map()
    assert all(e.get("value") != KEY for lst in use_cases.values() for e in lst)
    assert KEY in routes.get_prompt_templates_map()["retail"]


def test_community_collection_can_be_switched_off(contrib):
    contrib["collections"].append({"collection_id": COMMUNITY_COLLECTION_ID, "kind": "solution", "label": "P&C", "is_enabled": False})
    assert COMMUNITY_COLLECTION_ID not in routes.get_use_cases_map()
    assert entry(routes.get_use_cases_map(), "retail")


def test_contrib_failure_never_breaks_native_catalog(contrib, monkeypatch):
    def boom():
        raise RuntimeError("disk on fire")
    monkeypatch.setattr(registry, "catalog_rows", boom)
    use_cases = routes.get_use_cases_map()
    assert [e["value"] for e in use_cases["retail"] if e.get("value")] == ["customer_360"]


def test_yaml_fallback_still_includes_contributions(contrib, monkeypatch):
    monkeypatch.setattr(routes, "get_usecase_descriptions_from_lakebase", lambda: None)
    contrib["collections"] = None
    assert any(i["value"] == COMMUNITY_COLLECTION_ID for i in routes.get_industries())
    assert entry(routes.get_use_cases_map(), COMMUNITY_COLLECTION_ID)
    assert KEY in routes.get_prompt_templates_map()[COMMUNITY_COLLECTION_ID]


def test_mcp_summary_carries_provenance(contrib):
    from src.backend.mcp_server import _available_use_cases
    cases = {c["value"]: c for c in _available_use_cases("retail")}
    assert cases[KEY]["provenance"] == "partner"
    assert cases[KEY]["contributed_by"] == "Acme"
    assert cases[KEY]["certified_by"] == ["Certco"]
    assert cases["customer_360"]["provenance"] == "native"


def test_db_writes_on_contributed_keys_are_rejected():
    with pytest.raises(HTTPException) as exc:
        routes.reject_contributed_write(KEY)
    assert exc.value.status_code == 409
    routes.reject_contributed_write("customer_360")


def test_assets_are_served_only_when_listed(contrib):
    app = FastAPI()
    app.include_router(contrib_router, prefix="/api")
    client = TestClient(app)
    ok = client.get(f"/api/contrib/assets/{KEY}/images/cover.png")
    assert ok.status_code == 200 and ok.headers["content-type"] == "image/png"
    assert client.get(f"/api/contrib/assets/{KEY}/usecase.yaml").status_code == 404
    assert client.get(f"/api/contrib/assets/{KEY}/../../contributors/acme/contributor.yaml").status_code == 404
    assert client.get("/api/contrib/assets/contrib__nobody__x/images/cover.png").status_code == 404
    assert client.get("/api/contrib/contributors/acme/avatar").status_code == 404
    status = client.get("/api/contrib/status").json()
    assert status["use_cases"] == 1 and status["errors"] == []
    people = client.get("/api/contrib/contributors").json()
    assert {p["id"] for p in people} == {"acme", "certco"}
