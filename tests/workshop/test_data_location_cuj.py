"""Workstream 1 - Full CUJ match for the data location on ``semlayer_locate``.

The web app surfaces the source catalog/schema on the Locate Data step via the
LakehouseParams editor and persists a per-session override into
``session_parameters`` (chapter_3_lakehouse_catalog / chapter_3_lakehouse_schema).
Over MCP the same must hold:

- ``vibe_set_parameters`` accepts the friendly ``data_catalog`` / ``data_schema``
  aliases and writes them onto the workshop parameter keys the assembler
  substitutes (raw keys still work); a blank value is rejected.
- ``_step_payload`` surfaces the effective ``data_location`` on that step.
- The repurposed ``semlayer_locate`` decision interaction is the data-location
  confirm (keep default vs change source).
"""

import copy
import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.api import routes
from src.backend.workshop import engine, manifest

TRACK = "genie-accelerator"
SESSION_ID = "data-location-session"


@pytest.fixture
def session_store(monkeypatch):
    store = {
        SESSION_ID: {
            "session_id": SESSION_ID,
            "created_by": None,
            "completed_gates": [],
            "captured_outputs": {},
            "session_parameters": {},
        }
    }
    saves = []

    def load_session(session_id):
        record = store.get(session_id)
        return copy.deepcopy(record) if record is not None else None

    def save_session(session_id, **fields):
        saves.append((session_id, copy.deepcopy(fields)))
        store.setdefault(session_id, {"session_id": session_id}).update(copy.deepcopy(fields))
        return True

    monkeypatch.setattr(mcp_server, "load_session", load_session)
    monkeypatch.setattr(mcp_server, "save_session", save_session)
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: True)
    return store, saves


def _locate_step():
    steps = manifest.load_manifest().track_steps(TRACK)
    return next(s for s in steps if s.sectionTag == "semlayer_locate")


def _error_code(result):
    assert result["isError"] is True
    return result["structuredContent"]["error"]["code"]


# --- friendly aliases map onto the workshop parameter keys --------------------


def test_data_location_aliases_persist_as_workshop_keys(session_store):
    store, _ = session_store

    result = mcp_server.vibe_set_parameters(
        SESSION_ID, {"data_catalog": "main", "data_schema": "fleet_ops"}
    )

    persisted = store[SESSION_ID]["session_parameters"]
    assert persisted["chapter_3_lakehouse_catalog"] == "main"
    assert persisted["chapter_3_lakehouse_schema"] == "fleet_ops"
    # The friendly aliases are consumed, not stored raw.
    assert "data_catalog" not in persisted
    assert "data_schema" not in persisted
    # Plain merge (not a use-case selection), so nothing is reported missing.
    assert result.missing_required == []


def test_raw_workshop_keys_still_accepted(session_store):
    store, _ = session_store

    mcp_server.vibe_set_parameters(SESSION_ID, {"chapter_3_lakehouse_catalog": "main"})

    assert store[SESSION_ID]["session_parameters"]["chapter_3_lakehouse_catalog"] == "main"


def test_blank_data_location_alias_is_rejected(session_store):
    store, _ = session_store

    blocked = mcp_server.vibe_set_parameters(SESSION_ID, {"data_catalog": "   "})

    assert isinstance(blocked, dict)
    assert _error_code(blocked) == "INVALID_PARAMETER"
    # Nothing persisted - the default source stands.
    assert "chapter_3_lakehouse_catalog" not in store[SESSION_ID]["session_parameters"]


# --- the step payload surfaces the effective source --------------------------


def test_step_payload_surfaces_data_location_default(monkeypatch):
    monkeypatch.setattr(
        routes,
        "get_effective_workshop_parameters",
        lambda session_id=None: {
            "chapter_3_lakehouse_catalog": "samples",
            "chapter_3_lakehouse_schema": "wanderbricks",
        },
    )

    payload = mcp_server._step_payload(
        TRACK, engine.SessionState(), _locate_step(), session_id="s"
    )

    assert payload.data_location == {
        "catalog": "samples",
        "schema": "wanderbricks",
        "is_overridden": False,
    }


def test_step_payload_data_location_marks_override(monkeypatch):
    monkeypatch.setattr(
        routes,
        "get_effective_workshop_parameters",
        lambda session_id=None: {
            "chapter_3_lakehouse_catalog": "main",
            "chapter_3_lakehouse_schema": "fleet_ops",
        },
    )
    state = engine.SessionState(
        session_parameters={"chapter_3_lakehouse_catalog": "main", "chapter_3_lakehouse_schema": "fleet_ops"}
    )

    payload = mcp_server._step_payload(TRACK, state, _locate_step(), session_id="s")

    assert payload.data_location["catalog"] == "main"
    assert payload.data_location["schema"] == "fleet_ops"
    assert payload.data_location["is_overridden"] is True


# --- the interaction is the data-location confirm ----------------------------


def test_locate_decision_is_the_data_location_confirm():
    block = (manifest.interactions_for("semlayer_locate") or {}).get("decision")
    assert isinstance(block, dict)
    assert block["id"] == "semlayer_locate.data_location"
    option_ids = {option["id"] for option in block["options"]}
    assert option_ids == {"keep_default", "change_source"}
    assert block["recommended"] == "keep_default"
    # The change branch points the agent at the persist path.
    assert "vibe_set_parameters" in block["coaching"]["change_source"]
