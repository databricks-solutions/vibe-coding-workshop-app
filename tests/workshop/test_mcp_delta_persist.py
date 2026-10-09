"""MCP writes persist only their delta, under a row lock (mcp-gates-race, D-9).

Before: every MCP write tool loaded the session, mutated an in-memory
``engine.SessionState`` and saved the FULL ``completed_gates`` /
``captured_outputs`` / ``session_parameters``. ``_session_upsert`` replaces those
JSONB columns, so an App write that committed between the MCP read and the MCP
write (an SPA step completion, a skipped_gates patch, a parameter change) was
silently overwritten — the mirror of the App-side race #84 fixed.

After: ``_persist_mcp_delta`` diffs the state against a deep copy taken right
after the load, and ``lakebase.save_session_applying_mcp_delta`` applies only
that delta onto the row read with ``SELECT ... FOR UPDATE``, in one transaction.

All offline: the real ``load_session`` and the real locked write run against
#84's in-memory ``_fake_sessions_db``. That fake models the row lock: a
concurrent writer landing on a ``FOR UPDATE`` read inside an explicit
transaction is serialised ahead of it (the read sees it), while on an unlocked
read — or ``FOR UPDATE`` on an autocommit connection — it lands after the
snapshot. ``interleave_on`` picks the window: "read" is the MCP tool's
``load_session`` (the App commits between the MCP read and the MCP write);
"lock_read" is the locked read inside the write transaction.
"""

import pathlib
import sys

import pytest

_API_TESTS = pathlib.Path(__file__).resolve().parents[1] / "api"
if str(_API_TESTS) not in sys.path:
    sys.path.insert(0, str(_API_TESTS))

from _fake_sessions_db import FakeSessionsDB, install  # noqa: E402

from src.backend import mcp_server  # noqa: E402
from src.backend.services import lakebase  # noqa: E402
from src.backend.workshop import engine  # noqa: E402

SESSION_ID = "mcp-delta-session"
G_APP = "semlayer_locate"  # a representable gate the SPA completes

_WINDOWS = {"between_mcp_read_and_write": "read", "inside_mcp_write_transaction": "lock_read"}


@pytest.fixture
def db(monkeypatch):
    fake = FakeSessionsDB()
    install(monkeypatch, fake)
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: True)
    return fake


def _row(gates, outputs=None, params=None):
    return {
        "session_id": SESSION_ID,
        "created_by": None,
        "completed_gates": list(gates),
        "captured_outputs": dict(outputs or {}),
        "session_parameters": dict(params or {}),
    }


def _app_completes_gate_and_patches_skipped(row):
    """An App save: the SPA completes G_APP and patches skipped_gates."""
    row["completed_gates"] = [*row["completed_gates"], G_APP]
    row["session_parameters"] = {**row["session_parameters"], "skipped_gates": ["setup_lakebase"]}


def _app_removes_gate(row):
    """An App save that un-completes the representable G_APP."""
    row["completed_gates"] = [g for g in row["completed_gates"] if g != G_APP]


def _app_patches_parameter(row):
    row["session_parameters"] = {**row["session_parameters"], "warehouse_id": "wh-app"}


# --- R1: the race -------------------------------------------------------------------


@pytest.mark.parametrize("window", sorted(_WINDOWS))
def test_r1_app_gate_and_skipped_patch_survive_mcp_complete_step(db, window):
    # TAMPER T1 (merged_gates = stored only) -> prd_generation is lost -> red.
    # TAMPER T3 (drop FOR UPDATE, or the explicit transaction) -> the in-transaction
    # window reads a stale snapshot and the upsert overwrites G_APP -> red.
    db.row = _row(["use_case_selection", "project_setup"])
    db.interleave = _app_completes_gate_and_patches_skipped
    db.interleave_on = _WINDOWS[window]

    result = mcp_server.vibe_complete_step(SESSION_ID, "prd_generation", "Generated PRD")

    assert not isinstance(result, dict), result
    assert db.interleave is None  # the App write did land
    stored = db.row["completed_gates"]
    assert G_APP in stored, stored
    assert "prd_generation" in stored, stored
    assert stored.count("prd_generation") == 1
    assert db.row["session_parameters"]["skipped_gates"] == ["setup_lakebase"]
    assert db.row["captured_outputs"] == {"prd_document": "Generated PRD"}


# --- R2: removals are not resurrected ----------------------------------------------


@pytest.mark.parametrize("window", sorted(_WINDOWS))
def test_r2_app_removed_gate_is_not_resurrected(db, window):
    # TAMPER T2 (add_gates = all of after.completed_gates) -> the stale G_APP the
    # MCP loaded is re-added -> red.
    db.row = _row(["use_case_selection", "project_setup", G_APP])
    db.interleave = _app_removes_gate
    db.interleave_on = _WINDOWS[window]

    result = mcp_server.vibe_complete_step(SESSION_ID, "prd_generation", "Generated PRD")

    assert not isinstance(result, dict), result
    assert db.interleave is None
    assert db.row["completed_gates"] == ["use_case_selection", "project_setup", "prd_generation"]


# --- R3: concurrent parameter writes -------------------------------------------------


@pytest.mark.parametrize("window", sorted(_WINDOWS))
def test_r3_concurrent_set_parameters_and_app_patch_both_survive(db, window):
    db.row = _row(["use_case_selection"], params={"catalog": "main"})
    db.interleave = _app_patches_parameter
    db.interleave_on = _WINDOWS[window]

    result = mcp_server.vibe_set_parameters(SESSION_ID, {"catalog": "analytics"})

    assert not isinstance(result, dict), result
    assert db.interleave is None
    params = db.row["session_parameters"]
    assert params["catalog"] == "analytics"  # the MCP key
    assert params["warehouse_id"] == "wh-app"  # the App key
    assert db.row["completed_gates"] == ["use_case_selection"]


# --- R4: the delta helper ------------------------------------------------------------


def _state(gates=(), outputs=None, params=None):
    return engine.SessionState(
        completed_gates=list(gates),
        captured_outputs=dict(outputs or {}),
        session_parameters=dict(params or {}),
    )


@pytest.fixture
def recorded(monkeypatch):
    calls = []

    def record(session_id, **kwargs):
        calls.append((session_id, kwargs))
        return True

    monkeypatch.setattr(mcp_server, "save_session_applying_mcp_delta", record)
    return calls


def test_r4_delta_is_add_only_gates_and_changed_only_keys(recorded):
    before = _state(
        ["use_case_selection", "project_setup"],
        outputs={"same": "x", "changed": "old"},
        params={"keep": 1, "bump": "a"},
    )
    after = _state(
        ["use_case_selection", "project_setup", "prd_generation"],
        outputs={"same": "x", "changed": "new", "added": "y"},
        params={"keep": 1, "bump": "a"},
    )

    assert mcp_server._persist_mcp_delta(
        SESSION_ID,
        before,
        after,
        session_parameters={"keep": 1, "bump": "b", "fresh": True},
        session_name="Genie Code — X",
    )

    assert recorded == [
        (
            SESSION_ID,
            {
                "add_gates": ["prd_generation"],
                "set_outputs": {"changed": "new", "added": "y"},
                "set_params": {"bump": "b", "fresh": True},
                "session_name": "Genie Code — X",
            },
        )
    ]


def test_r4_omitted_session_parameters_write_no_parameter_keys(recorded):
    before = _state(params={"a": 1})
    after = _state(params={"a": 2})

    mcp_server._persist_mcp_delta(SESSION_ID, before, after)

    assert recorded[0][1]["set_params"] == {}


def test_r4_empty_delta_makes_no_db_call(db):
    # TAMPER T4 (let the empty delta reach the DB) -> a connection opens -> red.
    db.row = _row(["project_setup"], outputs={"k": "v"}, params={"p": 1})

    assert lakebase.save_session_applying_mcp_delta(
        SESSION_ID, add_gates=[], set_outputs={}, set_params={}, session_name=None
    ) is True

    assert db.connections == []
    assert db.events == []


def test_r4_idempotent_mcp_replay_makes_no_db_write(db):
    db.row = _row(["use_case_selection", "project_setup"])

    result = mcp_server.vibe_complete_step(SESSION_ID, "project_setup", "again")

    assert not isinstance(result, dict), result
    assert not {"lock_read", "upsert", "commit"} & {kind for _, kind in db.events}
    assert db.upserts == []


# --- R5: the transaction -------------------------------------------------------------


def test_r5_db_error_rolls_back_returns_false_and_restores_autocommit(db):
    db.row = _row(["use_case_selection"])
    db.fail_on = "upsert"

    assert lakebase.save_session_applying_mcp_delta(
        SESSION_ID, add_gates=["project_setup"], set_outputs={}, set_params={}
    ) is False

    conn = db.connections[0]
    assert conn.commits == 0 and conn.rollbacks == 1
    assert conn.autocommit is True
    assert db.row["completed_gates"] == ["use_case_selection"]


def test_locked_read_and_upsert_run_in_one_transaction(db):
    db.row = _row(
        ["use_case_selection", "project_setup"],
        outputs={"prd_document": "v1", "other": "keep"},
        params={"skipped_gates": ["setup_lakebase"], "catalog": "main"},
    )

    assert lakebase.save_session_applying_mcp_delta(
        SESSION_ID,
        add_gates=["project_setup", "prd_generation", "prd_generation"],
        set_outputs={"prd_document": "v2"},
        set_params={"catalog": "analytics"},
        session_name="Genie Code — X",
    ) is True

    assert len(db.connections) == 1
    conn = db.connections[0]
    assert db.events == [(0, "lock_read"), (0, "upsert"), (0, "commit")]
    assert conn.commits == 1 and conn.rollbacks == 0
    assert conn.autocommit_during == [False, False]
    assert conn.autocommit is True

    upsert = db.upserts[-1]
    assert upsert["completed_gates"] == ["use_case_selection", "project_setup", "prd_generation"]
    assert upsert["captured_outputs"] == {"prd_document": "v2", "other": "keep"}
    assert upsert["session_parameters"] == {"skipped_gates": ["setup_lakebase"], "catalog": "analytics"}
    assert upsert["session_name"] == "Genie Code — X"


def test_no_existing_row_inserts_the_delta(db):
    assert db.row is None

    assert lakebase.save_session_applying_mcp_delta(
        SESSION_ID,
        add_gates=["use_case_selection"],
        set_outputs={"use_case_brief": "brief"},
        set_params={"coding_assistant": "genie-code"},
        created_by="u@example.com",
    ) is True

    assert db.events == [(0, "lock_read"), (0, "upsert"), (0, "commit")]
    assert db.row["completed_gates"] == ["use_case_selection"]
    assert db.row["captured_outputs"] == {"use_case_brief": "brief"}
    assert db.row["session_parameters"] == {"coding_assistant": "genie-code"}


def test_not_configured_returns_false_without_touching_the_db(monkeypatch):
    def _no_connection():
        raise AssertionError("get_connection must not be called when Lakebase is not configured")

    monkeypatch.setattr(lakebase, "is_lakebase_configured", lambda: False)
    monkeypatch.setattr(lakebase, "get_connection", _no_connection)

    assert lakebase.save_session_applying_mcp_delta(
        SESSION_ID, add_gates=["project_setup"], set_outputs={}, set_params={}
    ) is False


def test_no_mcp_write_tool_calls_save_session_directly():
    import inspect

    source = inspect.getsource(mcp_server)
    assert "save_session(" not in source.replace("save_session_applying_mcp_delta(", "")
