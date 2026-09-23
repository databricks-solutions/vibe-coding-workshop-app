import copy
import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.workshop import engine


SESSION_ID = "write-tools-session"


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


def _error_code(result):
    assert result["isError"] is True
    assert result["content"]
    return result["structuredContent"]["error"]["code"]


def test_complete_step_advances_and_persists_gate_and_output(session_store):
    store, saves = session_store
    store[SESSION_ID]["completed_gates"] = ["project_setup"]

    result = mcp_server.vibe_complete_step(
        SESSION_ID,
        "prd_generation",
        "Generated PRD",
    )

    assert result.completed_gates == ["project_setup", "prd_generation"]
    assert result.next.sectionTag == "genie_silver_metadata"
    assert store[SESSION_ID]["completed_gates"] == ["project_setup", "prd_generation"]
    assert store[SESSION_ID]["captured_outputs"] == {"prd_document": "Generated PRD"}
    assert saves[-1][1]["completed_gates"] == result.completed_gates
    assert saves[-1][1]["captured_outputs"] == {"prd_document": "Generated PRD"}


@pytest.mark.parametrize(
    ("engine_result", "expected_code"),
    [
        (engine.CompleteResult(ok=False, error_code="UNKNOWN_TRACK"), "UNKNOWN_TRACK"),
        (engine.CompleteResult(ok=False, error_code="UNKNOWN_STEP"), "UNKNOWN_STEP"),
        (engine.CompleteResult(ok=False, error_code="STEP_LOCKED"), "STEP_LOCKED"),
        (
            engine.CompleteResult(ok=False, error_code="UI_DRIVEN_STEP", coached=True),
            "UI_DRIVEN_STEP",
        ),
    ],
)
def test_complete_step_maps_expected_engine_errors(
    session_store, monkeypatch, engine_result, expected_code
):
    monkeypatch.setattr(mcp_server.engine, "complete_step", lambda *args, **kwargs: engine_result)

    result = mcp_server.vibe_complete_step(SESSION_ID, "project_setup", "output")

    assert _error_code(result) == expected_code


def test_complete_step_is_idempotent_and_does_not_overwrite_output(session_store):
    store, saves = session_store
    store[SESSION_ID]["completed_gates"] = ["project_setup"]
    store[SESSION_ID]["captured_outputs"] = {"existing": "stable"}

    result = mcp_server.vibe_complete_step(SESSION_ID, "project_setup", "replacement")

    assert result.completed_gates == ["project_setup"]
    assert store[SESSION_ID]["completed_gates"] == ["project_setup"]
    assert store[SESSION_ID]["captured_outputs"] == {"existing": "stable"}
    assert saves[-1][1]["completed_gates"] == ["project_setup"]
    assert saves[-1][1]["captured_outputs"] == {"existing": "stable"}


def test_set_parameters_merges_and_persists_effective_parameters(session_store):
    store, saves = session_store
    store[SESSION_ID]["session_parameters"] = {"catalog": "main"}

    result = mcp_server.vibe_set_parameters(
        SESSION_ID,
        {"catalog": "analytics", "schema_prefix": "workshop_"},
    )

    assert result.resolved_params == {
        "catalog": "analytics",
        "schema_prefix": "workshop_",
    }
    assert result.missing_required == []
    assert store[SESSION_ID]["session_parameters"] == result.resolved_params
    assert saves[-1][1]["session_parameters"] == result.resolved_params


def test_write_tools_return_invalid_session_in_result(session_store):
    assert _error_code(mcp_server.vibe_complete_step("missing", "project_setup", "output")) == (
        "INVALID_SESSION"
    )
    assert _error_code(mcp_server.vibe_set_parameters("missing", {"catalog": "main"})) == (
        "INVALID_SESSION"
    )
