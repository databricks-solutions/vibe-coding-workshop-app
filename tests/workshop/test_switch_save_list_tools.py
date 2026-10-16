"""Session linking over MCP: vibe_switch_track, vibe_save_session, vibe_list_sessions,
and vibe_start_track attaching to a session the web UI created."""

import copy
import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server  # noqa: E402
from src.backend.api import routes  # noqa: E402

SID = "linked-session"
OWNER = "ada.lovelace@acme.com"


@pytest.fixture
def env(monkeypatch):
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
    monkeypatch.setattr(mcp_server, "_request_user", lambda ctx: OWNER)
    monkeypatch.setattr(mcp_server, "_disabled_paths", lambda state: set())
    monkeypatch.setattr(mcp_server, "_curated_pair_status", lambda industry, use_case: "known")
    monkeypatch.setattr(mcp_server, "_industry_label_for", lambda industry, echo: "Travel")
    monkeypatch.setattr(mcp_server, "_use_case_label_for", lambda industry, use_case: None)
    monkeypatch.setattr(routes, "get_workshop_parameters_sync", lambda: {"chapter_3_lakehouse_schema": "vibe_coding"})
    return store, saves


def _web_session(store, *, level="end-to-end", name="New Session", gates=(), **params):
    """A row as the web UI's GET /session/new + metadata writes leave it."""
    store[SID] = {
        "session_id": SID,
        "created_by": OWNER,
        "session_name": name,
        "workshop_level": level,
        "completed_gates": list(gates),
        "captured_outputs": {},
        "session_parameters": dict(params),
    }


def _code(result):
    assert isinstance(result, dict) and result["isError"] is True, result
    return result["structuredContent"]["error"]["code"]


# --- vibe_start_track attaching to a web session -------------------------------


def test_attach_names_an_unsaved_web_session_so_cleanup_cannot_delete_it(env):
    store, _ = env
    _web_session(store, level="genie-accelerator")

    result = mcp_server.vibe_start_track("Genie Accelerator", session_id=SID)

    assert result.session_id == SID and result.track == "genie-accelerator"
    assert result.track_name == "Genie Accelerator" and result.switched_from is None
    assert store[SID]["session_name"] == "Genie Code Workshop"
    assert store[SID]["session_parameters"]["coding_assistant"] == "genie-code"


def test_attach_keeps_a_name_the_learner_chose(env):
    store, _ = env
    _web_session(store, level="genie-accelerator", name="My demo")

    mcp_server.vibe_start_track("genie-accelerator", session_id=SID)

    assert store[SID]["session_name"] == "My demo"


def test_attach_with_a_track_name_switches_a_not_started_session(env):
    store, _ = env
    _web_session(store, level="genie-accelerator", direction="forward")

    result = mcp_server.vibe_start_track("Apps + Lakebase", session_id=SID)

    assert result.track == "app-database" and result.switched_from == "genie-accelerator"
    assert result.track_name == "Databricks Apps + Lakebase"
    row = store[SID]
    assert row["workshop_level"] == "app-database"
    assert row["session_name"] == "Genie Code — Databricks Apps + Lakebase"
    assert row["session_parameters"]["chainContext"] == "app"
    assert row["session_parameters"]["level_explicitly_selected"] is True
    # The returned outline is the track now in effect, as every later call walks it.
    assert {item.sectionTag for item in result.outline} == {
        item.sectionTag for item in mcp_server.vibe_switch_track(SID, "app-database").outline
    }


def test_attach_on_another_track_after_set_up_project_is_refused(env):
    store, saves = env
    _web_session(store, level="genie-accelerator", gates=["project_setup"])

    result = mcp_server.vibe_start_track("lakehouse", session_id=SID)

    assert _code(result) == "TRACK_SWITCH_BLOCKED"
    error = result["structuredContent"]["error"]
    assert error["current_track"] == "genie-accelerator"
    assert error["requested_track"] == "lakehouse"
    assert 'track="lakehouse" and no session_id' in error["suggestion"]
    assert store[SID]["workshop_level"] == "genie-accelerator"
    assert saves == []


def test_unknown_name_is_a_typed_error(env):
    assert _code(mcp_server.vibe_start_track("nope")) == "UNKNOWN_TRACK"
    assert _code(mcp_server.vibe_switch_track(SID, "nope")) == "UNKNOWN_TRACK"


def test_another_users_session_is_not_resolved(env, monkeypatch):
    store, _ = env
    _web_session(store)
    monkeypatch.setattr(mcp_server, "_request_user", lambda ctx: "someone.else@acme.com")
    assert _code(mcp_server.vibe_start_track("lakehouse", session_id=SID)) == "INVALID_SESSION"
    assert _code(mcp_server.vibe_switch_track(SID, "lakehouse")) == "INVALID_SESSION"
    assert _code(mcp_server.vibe_save_session(SID, "Mine")) == "INVALID_SESSION"


# --- vibe_switch_track ----------------------------------------------------------


def test_switch_persists_level_and_the_web_pickers_params(env):
    store, _ = env
    _web_session(store, level="app-database", name="Genie Code — Databricks Apps + Lakebase", chainContext="app")

    result = mcp_server.vibe_switch_track(SID, "genie")

    assert result.switched is True and result.previous_track == "app-database"
    assert result.track == "genie-accelerator"
    row = store[SID]
    assert row["workshop_level"] == "genie-accelerator"
    params = row["session_parameters"]
    assert params["direction"] == "forward"
    assert params["flags"]["includeLakehouse"] is False
    assert params["include_genie_ontology"] is params["flags"]["includeGenieOntology"]
    assert params["user_schema_prefix"] == "ada_l_vibe_coding"
    # Our own automatic name follows the track; it is not the learner's.
    assert row["session_name"] == "Genie Code Workshop"


def test_switch_keeps_the_learners_name(env):
    store, _ = env
    _web_session(store, level="app-database", name="Team demo")
    mcp_server.vibe_switch_track(SID, "lakehouse")
    assert store[SID]["session_name"] == "Team demo"


def test_switch_to_the_current_track_writes_nothing(env):
    store, saves = env
    _web_session(store, level="lakehouse", name="Team demo")
    result = mcp_server.vibe_switch_track(SID, "Lakehouse")
    assert result.switched is False and result.track == "lakehouse"
    assert saves == []


def test_switch_after_start_offers_only_the_next_level(env):
    store, _ = env
    _web_session(store, level="app-only", gates=["project_setup"], chainContext="app")
    result = mcp_server.vibe_switch_track(SID, "lakehouse")
    assert _code(result) == "TRACK_SWITCH_BLOCKED"
    assert "Databricks Apps + Lakebase (app-database)" in result["structuredContent"]["error"]["allowed_tracks"]
    assert mcp_server.vibe_switch_track(SID, "app-database").switched is True


def test_switch_to_reverse_and_back_flips_direction(env):
    store, _ = env
    _web_session(store, level="genie-accelerator", direction="forward")
    mcp_server.vibe_switch_track(SID, "reverse etl lakehouse")
    assert store[SID]["session_parameters"]["direction"] == "reverse"
    mcp_server.vibe_switch_track(SID, "genie accelerator")
    assert store[SID]["session_parameters"]["direction"] == "forward"
    assert store[SID]["workshop_level"] == "genie-accelerator"


def test_switch_unknown_session(env):
    assert _code(mcp_server.vibe_switch_track("missing", "lakehouse")) == "INVALID_SESSION"


# --- vibe_save_session ------------------------------------------------------------


def test_save_names_the_session(env):
    store, _ = env
    _web_session(store)
    result = mcp_server.vibe_save_session(SID, "  Retail demo  ", description="For the Tuesday group")
    assert result.session_name == "Retail demo" and result.is_saved is True
    assert store[SID]["session_name"] == "Retail demo"
    assert store[SID]["session_description"] == "For the Tuesday group"


@pytest.mark.parametrize("name", ["", "   ", "New Session", "new session", "x" * 101])
def test_save_rejects_placeholder_empty_and_long_names(env, name):
    store, saves = env
    _web_session(store)
    assert _code(mcp_server.vibe_save_session(SID, name)) == "INVALID_NAME"
    assert saves == []


def test_save_rejects_a_long_description(env):
    store, _ = env
    _web_session(store)
    assert _code(mcp_server.vibe_save_session(SID, "Fine", description="d" * 501)) == "INVALID_PARAMETER"


def test_a_saved_name_survives_the_use_case_lock(env):
    store, saves = env
    _web_session(store, level="app-only", name="Retail demo")
    mcp_server.vibe_set_parameters(
        SID,
        {
            "use_case_source": "curated",
            "industry": "travel",
            "use_case": "ai_driven_booking",
            "use_case_label": "AI Booking",
        },
    )
    assert store[SID]["session_name"] == "Retail demo"
    assert all(fields.get("session_name") in (None, "Retail demo") for (_s, fields) in saves)


def test_an_automatic_name_is_still_refined_by_the_use_case_lock(env):
    store, _ = env
    _web_session(store, level="app-only", name="Genie Code — Databricks Apps")
    mcp_server.vibe_set_parameters(
        SID,
        {
            "use_case_source": "curated",
            "industry": "travel",
            "use_case": "ai_driven_booking",
            "use_case_label": "AI Booking",
        },
    )
    assert store[SID]["session_name"] == "Genie Code — Databricks Apps: AI Booking"


# --- vibe_list_sessions -------------------------------------------------------------


def test_list_maps_rows_to_tracks_and_links(env, monkeypatch):
    calls = []

    def get_user_sessions(created_by, limit=50, saved_only=True):
        calls.append((created_by, limit, saved_only))
        return [
            {
                "session_id": "a",
                "session_name": "Retail demo",
                "workshop_level": "app-database",
                "use_case": None,
                "use_case_label": "AI Booking",
                "updated_at": "2026-10-15 10:00:00",
                "is_saved": True,
                "session_parameters": {},
            },
            {
                "session_id": "b",
                "session_name": None,
                "workshop_level": "300",
                "use_case": None,
                "is_saved": False,
                "session_parameters": {"coding_assistant": "genie-code"},
            },
        ]

    monkeypatch.setattr(mcp_server, "get_user_sessions", get_user_sessions)
    monkeypatch.setattr(mcp_server, "_request_base_url", lambda ctx: "https://app.example")

    result = mcp_server.vibe_list_sessions(limit=500, include_unsaved=True)

    assert calls == [(OWNER, 50, False)]
    first, second = result.sessions
    assert (first.track, first.track_name) == ("app-database", "Databricks Apps + Lakebase")
    assert first.session_url == "https://app.example?sessionId=a"
    assert first.use_case_label == "AI Booking" and first.is_saved is True
    # A legacy '300' level resolves the way the web UI restores it.
    assert second.track == "genie-accelerator" and second.session_name == "New Session"


def test_list_defaults_to_saved_sessions(env, monkeypatch):
    calls = []
    monkeypatch.setattr(mcp_server, "get_user_sessions", lambda created_by, limit=50, saved_only=True: calls.append((limit, saved_only)) or [])
    assert mcp_server.vibe_list_sessions().sessions == []
    assert calls == [(10, True)]


def test_list_refuses_an_anonymous_caller(env, monkeypatch):
    monkeypatch.setattr(mcp_server, "_request_user", lambda ctx: "unknown")
    monkeypatch.setattr(mcp_server, "get_user_sessions", lambda *a, **k: pytest.fail("must not query"))
    assert _code(mcp_server.vibe_list_sessions()) == "IDENTITY_UNKNOWN"


# --- prompts -------------------------------------------------------------------


def test_start_prompt_takes_a_name_and_the_web_session_id():
    text = mcp_server.start_track("Apps + Lakebase", session_id=SID)
    assert 'track:"app-database"' in text and f'session_id:"{SID}"' in text
    assert "Databricks Apps + Lakebase" in text


def test_start_prompt_lists_names_for_an_unknown_track():
    text = mcp_server.start_track("nope")
    assert "Unknown workshop track: nope" in text
    assert "Genie Accelerator (genie-accelerator)" in text
    assert "verbatim" in text


def test_continue_prompt_points_at_the_session_list():
    assert "vibe_list_sessions" in mcp_server.continue_where_left_off()
