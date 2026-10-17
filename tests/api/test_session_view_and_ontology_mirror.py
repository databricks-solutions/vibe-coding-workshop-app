"""genie-default-ontology PR 2 (r2.1/r2.2, D-148/D-149): the web session models.

- ``view`` (technical | insights) on SessionSaveRequest and
  SessionUpdateMetadataRequest is persisted into session_parameters, is
  preserve-on-omit (None leaves the stored value), and anything else is a 422.
- Any request that sets ``include_genie_ontology`` or ``flags.includeGenieOntology``
  writes the same value to all three keys; the snake key wins a disagreement
  (logged at INFO with only the two booleans). A stale top-level camelCase key can
  no longer override the toggle, so the engine outline follows it.
- GET /config/workshop-defaults reports the facilitator switch.

Offline: the real endpoints and ``execute_insert`` run against the in-memory
``_fake_sessions_db`` row, which applies the JSONB patch (and the nested flags
merge) the way Postgres would.

Tampers (each turns a test here red):
- X13 drop ``view`` from SessionUpdateMetadataRequest -> test_update_metadata_persists_view
- X14 drop the top-level mirror -> test_stale_top_level_key_follows_the_toggle
- X15 make the nested value win on disagreement -> test_disagreeing_request_snake_wins
"""

import logging
import pathlib

import pytest
import yaml
from fastapi import FastAPI
from starlette.testclient import TestClient

from src.backend.api import routes
from src.backend.workshop import engine
from src.backend.workshop.state import build_session_state

from _fake_sessions_db import FakeSessionsDB, install

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
TRACK = "genie-accelerator"
SID = "web-session"
ENDPOINTS = ["/api/session/save", "/api/session/update-metadata"]


@pytest.fixture
def client(monkeypatch):
    db = FakeSessionsDB()
    db.row = {
        "session_id": SID,
        "workshop_level": TRACK,
        "completed_gates": ["use_case_selection"],
        "session_parameters": {"coding_assistant": "genie-code"},
    }
    install(monkeypatch, db)
    monkeypatch.setattr(routes, "save_session", lambda *a, **k: True)
    monkeypatch.setattr(routes, "execute_query", lambda *a, **k: [])
    monkeypatch.setattr(routes, "get_schema", lambda: "test_schema")
    app = FastAPI()
    app.include_router(routes.router, prefix="/api")
    test_client = TestClient(app)
    test_client.db = db  # type: ignore[attr-defined]
    return test_client


def _params(client):
    return client.db.row["session_parameters"]


def _outline_len(client):
    return len(engine.outline(TRACK, build_session_state(client.db.row, TRACK)))


def _post(client, endpoint, **body):
    response = client.post(endpoint, json={"session_id": SID, **body})
    assert response.status_code == 200, response.text
    return response


# --- view -------------------------------------------------------------------------


def test_update_metadata_persists_view(client):
    _post(client, "/api/session/update-metadata", view="insights")
    assert _params(client)["view"] == "insights"


def test_save_persists_view(client):
    _post(client, "/api/session/save", view="technical")
    assert _params(client)["view"] == "technical"


@pytest.mark.parametrize("endpoint", ENDPOINTS)
@pytest.mark.parametrize("bad", ["Insights", "other", ""])
def test_invalid_view_is_422(client, endpoint, bad):
    response = client.post(endpoint, json={"session_id": SID, "view": bad})
    assert response.status_code == 422
    assert "view" not in _params(client)


def test_view_is_preserved_when_omitted_after_insights_setup(client):
    # The Insights setup (App.tsx) stores the marker with ontology off.
    _post(
        client,
        "/api/session/update-metadata",
        view="insights",
        include_genie_ontology=False,
        level_explicitly_selected=True,
    )
    _post(client, "/api/session/save", session_name="Saved", include_lakehouse=False)
    _post(client, "/api/session/update-metadata", industry="travel")
    _post(client, "/api/session/update-metadata", include_genie_ontology=True)
    assert _params(client)["view"] == "insights"


# --- three-key ontology mirror --------------------------------------------------------


@pytest.mark.parametrize("endpoint", ENDPOINTS)
def test_stale_top_level_key_follows_the_toggle(client, endpoint):
    # A legacy top-level camelCase key the UI never wrote overrides flags today.
    _params(client).update({"includeGenieOntology": True, "flags": {"includeLakehouse": False}})
    assert _outline_len(client) == 27

    _post(client, endpoint, include_genie_ontology=False)
    params = _params(client)
    assert (params["include_genie_ontology"], params["includeGenieOntology"]) == (False, False)
    # Snake-only request: the nested flag is merged into the stored flags object.
    assert params["flags"] == {"includeLakehouse": False, "includeGenieOntology": False}
    assert _outline_len(client) == 24

    _post(client, endpoint, flags={"includeLakehouse": False, "includeGenieOntology": True})
    params = _params(client)
    assert (params["include_genie_ontology"], params["includeGenieOntology"]) == (True, True)
    assert _outline_len(client) == 27


@pytest.mark.parametrize("endpoint", ENDPOINTS)
def test_disagreeing_request_snake_wins(client, endpoint, caplog):
    with caplog.at_level(logging.INFO, logger=routes.logger.name):
        _post(
            client,
            endpoint,
            include_genie_ontology=False,
            flags={"includeLakehouse": True, "includeGenieOntology": True},
        )
    params = _params(client)
    assert params["include_genie_ontology"] is False
    assert params["includeGenieOntology"] is False
    assert params["flags"] == {"includeLakehouse": True, "includeGenieOntology": False}
    logged = [r for r in caplog.records if "disagree" in r.getMessage()]
    assert len(logged) == 1 and logged[0].levelno == logging.INFO
    assert logged[0].args == (False, True)


@pytest.mark.parametrize("endpoint", ENDPOINTS)
def test_no_ontology_field_writes_no_ontology_key(client, endpoint):
    _post(client, endpoint, flags={"includeLakehouse": True})
    params = _params(client)
    assert not {"include_genie_ontology", "includeGenieOntology"} & set(params)
    assert params["flags"] == {"includeLakehouse": True}


# --- facilitator switch ------------------------------------------------------------------


@pytest.mark.parametrize("raw, expected", [(None, True), ("true", True), ("false", False), ("off", False)])
def test_workshop_defaults_route(client, monkeypatch, raw, expected):
    if raw is None:
        monkeypatch.delenv("VIBE_DEFAULT_GENIE_ONTOLOGY", raising=False)
    else:
        monkeypatch.setenv("VIBE_DEFAULT_GENIE_ONTOLOGY", raw)
    response = client.get("/api/config/workshop-defaults")
    assert response.status_code == 200
    assert response.json() == {
        "defaultTrack": "end-to-end",
        "genieCodeDefaultTrack": "genie-accelerator",
        "recommendedTrack": "genie-accelerator",
        "includeGenieOntology": expected,
    }


def test_app_template_sets_the_switch_on(monkeypatch):
    config = yaml.safe_load((REPO_ROOT / "app.yaml.template").read_text())
    entries = [entry for entry in config["env"] if entry["name"] == "VIBE_DEFAULT_GENIE_ONTOLOGY"]
    assert entries == [{"name": "VIBE_DEFAULT_GENIE_ONTOLOGY", "value": "true"}]
    monkeypatch.setenv("VIBE_DEFAULT_GENIE_ONTOLOGY", entries[0]["value"])
    assert routes.default_genie_ontology() is True
