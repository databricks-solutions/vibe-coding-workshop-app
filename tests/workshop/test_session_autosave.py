"""Workstream 3 - auto-save MCP session state so it is discoverable in the UI.

State is already persisted on every MCP tool call; the web session menu just
never listed MCP sessions because it filters on ``session_name`` (is_saved).
``vibe_start_track`` now names the session at creation, and the name is refined
to the confirmed use case once ``use_case_selection`` locks.
"""

import copy
import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.workshop import manifest

TRACK = "genie-accelerator"
SESSION_ID = "autosave-session"


def _usecase_block() -> dict:
    block = (manifest.interactions_for("use_case_selection") or {}).get("decision")
    assert isinstance(block, dict)
    return block


# --- vibe_start_track names the new session ----------------------------------


def test_start_track_names_new_session(monkeypatch):
    saved = {}

    monkeypatch.setattr(mcp_server, "load_session", lambda session_id: None)
    monkeypatch.setattr(mcp_server, "save_session", lambda session_id, **f: saved.update(f) or True)
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: True)
    monkeypatch.setattr(mcp_server, "_request_user", lambda ctx: "learner@acme.com")

    mcp_server.vibe_start_track(TRACK)

    # A non-empty name != "New Session" is what makes is_saved true in the UI list.
    assert saved["session_name"] == "Genie Code Workshop"
    assert saved["session_name"] != "New Session"


def test_start_track_name_includes_use_case_when_known(monkeypatch):
    saved = {}

    monkeypatch.setattr(mcp_server, "load_session", lambda session_id: None)
    monkeypatch.setattr(mcp_server, "save_session", lambda session_id, **f: saved.update(f) or True)
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: True)
    monkeypatch.setattr(mcp_server, "_request_user", lambda ctx: "learner@acme.com")

    mcp_server.vibe_start_track(TRACK, use_case="demand_forecasting")

    assert saved["session_name"] == "Genie Code \u2014 demand_forecasting"


# --- the name is refined once the use case locks -----------------------------


def test_complete_use_case_selection_refines_session_name(monkeypatch):
    store = {
        SESSION_ID: {
            "session_id": SESSION_ID,
            "created_by": None,
            "completed_gates": ["project_setup"],
            "captured_outputs": {},
            "session_parameters": {},
        }
    }
    saves = []

    def load_session(session_id):
        record = store.get(session_id)
        return copy.deepcopy(record) if record is not None else None

    def save_session(session_id, **fields):
        saves.append(copy.deepcopy(fields))
        store.setdefault(session_id, {"session_id": session_id}).update(copy.deepcopy(fields))
        return True

    monkeypatch.setattr(mcp_server, "load_session", load_session)
    monkeypatch.setattr(mcp_server, "save_session", save_session)
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: True)
    # The decision marker is only persisted when the interaction record lands
    # (vibe_submit_answer gates on ``recorded``); offline that write no-ops, so
    # stub it truthy the same way the lock/produce suite does.
    monkeypatch.setattr(mcp_server, "append_session_interaction", lambda **k: True, raising=False)

    mcp_server.vibe_set_parameters(
        SESSION_ID,
        {
            "industry": "retail",
            "use_case": "demand_forecasting",
            "use_case_label": "Demand Forecasting",
            "use_case_source": "curated",
        },
    )
    block = _usecase_block()
    mcp_server.vibe_submit_answer(SESSION_ID, block["id"], block["recommended"])

    completed = mcp_server.vibe_complete_step(SESSION_ID, "use_case_selection", "brief")

    assert not isinstance(completed, dict), completed
    # The complete-step save carried the refined, use-case-aware name.
    named = [s.get("session_name") for s in saves if s.get("session_name")]
    assert "Genie Code \u2014 Demand Forecasting" in named


def test_non_selection_complete_does_not_force_a_name(monkeypatch):
    """Completing a non-selection step must leave session_name untouched (None)."""
    store = {
        SESSION_ID: {
            "session_id": SESSION_ID,
            "created_by": None,
            "completed_gates": ["project_setup", "use_case_selection"],
            "captured_outputs": {},
            "session_parameters": {
                "industry": "retail",
                "use_case": "demand_forecasting",
                "use_case_label": "Demand Forecasting",
                "use_case_source": "curated",
            },
        }
    }
    saves = []

    def load_session(session_id):
        return copy.deepcopy(store.get(session_id))

    def save_session(session_id, **fields):
        saves.append(copy.deepcopy(fields))
        store.setdefault(session_id, {"session_id": session_id}).update(copy.deepcopy(fields))
        return True

    monkeypatch.setattr(mcp_server, "load_session", load_session)
    monkeypatch.setattr(mcp_server, "save_session", save_session)
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: True)

    completed = mcp_server.vibe_complete_step(SESSION_ID, "prd_generation", "PRD")

    assert not isinstance(completed, dict), completed
    assert all(s.get("session_name") is None for s in saves)
