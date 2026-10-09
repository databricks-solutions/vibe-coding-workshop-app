"""Phase 3 Task 0 — track persistence (kills the live 0/28 defect).

MCP always walks the ``genie-accelerator`` track and persists ``completed_gates``,
but historically never stamped ``workshop_level``. On SPA resume, a genie-code
session with no persisted level fell back to the assistant cold-start default
(``lakehouse-di``), whose outline strips the genie sections — so the genie gates
mapped to steps absent from the rendered outline and progress collapsed to
``0/28``.

The backend half of the fix stamps ``workshop_level`` on the NEW-session seed
save inside ``vibe_start_track``. It is a top-level DB column (not a
``session_parameters`` JSONB key), and ``save_session`` COALESCE-preserves it on
later writes so subsequent ``vibe_complete_step`` saves (which omit it) never
clobber the seeded value.

These tests mirror the in-memory-store fixture pattern used by
``test_write_tools.py`` / ``test_session_autosave.py``.
"""

import copy
import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server

TRACK = "genie-accelerator"
SESSION_ID = "track-persistence-session"


@pytest.fixture
def new_session_env(monkeypatch):
    """A fresh (empty) Lakebase-backed store, so ``vibe_start_track`` seeds a
    brand-new session and exercises the new-session-only seed save."""
    store: dict = {}
    saves: list = []

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
    monkeypatch.setattr(mcp_server, "_request_user", lambda ctx: "learner@acme.com")
    return store, saves


# --- T0-B1: the NEW-session seed stamps workshop_level == the track ----------


def test_b1_new_session_stamps_track_as_workshop_level(new_session_env):
    store, saves = new_session_env

    result = mcp_server.vibe_start_track(TRACK)

    assert not isinstance(result, dict), result
    sid = result.session_id
    seed_saves = [fields for (s, fields) in saves if s == sid]
    assert seed_saves, "expected a new-session seed save"
    assert seed_saves[0].get("workshop_level") == "genie-accelerator"


# --- T0-B2: the stamp is a TOP-LEVEL column, not a session_parameters key -----


def test_b2_stamp_is_top_level_column_not_session_parameters(new_session_env):
    store, saves = new_session_env

    result = mcp_server.vibe_start_track(TRACK)

    assert not isinstance(result, dict), result
    sid = result.session_id
    seed_fields = next(fields for (s, fields) in saves if s == sid)
    # Top-level column carries the value...
    assert seed_fields.get("workshop_level") == "genie-accelerator"
    # ...and the JSONB session_parameters bag never gains a workshop_level key
    # (the SPA reads response.workshop_level, the column — not the JSONB).
    assert "workshop_level" not in (seed_fields.get("session_parameters") or {})
    assert "workshop_level" not in (store[sid].get("session_parameters") or {})


# --- T0-B3: a later complete_step save (no workshop_level) preserves it -------


def test_b3_later_complete_step_preserves_workshop_level(new_session_env):
    store, saves = new_session_env

    result = mcp_server.vibe_start_track(TRACK)
    assert not isinstance(result, dict), result
    sid = result.session_id
    assert store[sid].get("workshop_level") == "genie-accelerator"

    completed = mcp_server.vibe_complete_step(sid, "project_setup", "did setup")
    assert not isinstance(completed, dict), completed

    # Every save that came AFTER the seed (i.e. the complete_step write) omits
    # workshop_level, so COALESCE preserves the seeded value.
    later_saves = [fields for (s, fields) in saves if s == sid][1:]
    assert later_saves, "expected a complete_step save after the seed"
    assert all(fields.get("workshop_level") is None for fields in later_saves)
    assert store[sid].get("workshop_level") == "genie-accelerator"


# --- T0-B4: the session-load path surfaces the stamped workshop_level ---------


def test_b4_load_path_surfaces_workshop_level(new_session_env):
    store, saves = new_session_env

    result = mcp_server.vibe_start_track(TRACK)
    assert not isinstance(result, dict), result
    sid = result.session_id

    loaded = mcp_server.load_session(sid)
    assert loaded is not None
    assert loaded.get("workshop_level") == "genie-accelerator"


# --- T0-B5: resuming an EXISTING session must not clobber the saved level -----


def test_b5_resume_existing_session_does_not_clobber_level(monkeypatch):
    store = {
        SESSION_ID: {
            "session_id": SESSION_ID,
            "created_by": None,
            "completed_gates": [],
            "captured_outputs": {},
            "session_parameters": {},
            # A real, explicitly-persisted level that resume must not overwrite.
            "workshop_level": "end-to-end",
        }
    }
    saves: list = []

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
    monkeypatch.setattr(mcp_server, "_request_user", lambda ctx: "learner@acme.com")

    result = mcp_server.vibe_start_track(TRACK, session_id=SESSION_ID)

    assert not isinstance(result, dict), result
    # The seed save is new-session-only, so a resume never re-stamps the level.
    assert store[SESSION_ID]["workshop_level"] == "end-to-end"
    assert all(fields.get("workshop_level") is None for (_s, fields) in saves)
