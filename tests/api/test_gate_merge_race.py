"""The App gate write is an atomic locked read-merge-write (merge-gates-race).

Before: both session write endpoints did ``load_session`` -> ``_merge_app_gates``
-> ``save_session`` on separate connections. An MCP write resolving the
non-representable ``use_case_selection`` gate that committed between the load and
the save was overwritten by the App's merged list — the gate was lost and every
step whose ``requiresGate`` it satisfies re-locked.

After: ``lakebase.save_session_merging_gates`` reads the stored gates with
``SELECT ... FOR UPDATE``, merges, and runs the same upsert on ONE connection in
ONE transaction; the endpoints call it via ``asyncio.to_thread``.

All offline: ``lakebase.get_connection`` is the in-memory ``_fake_sessions_db``;
see that module for how a concurrent writer is interleaved.
"""

import asyncio

import pytest
from fastapi import FastAPI
from starlette.requests import Request
from starlette.testclient import TestClient

from src.backend.api import routes
from src.backend.services import lakebase
from src.backend.workshop import gate_merge

from _fake_sessions_db import FakeSessionsDB, install, mcp_resolves_use_case

_ENDPOINTS = ("/api/session/update-metadata", "/api/session/save")


@pytest.fixture
def db(monkeypatch):
    fake = FakeSessionsDB()
    install(monkeypatch, fake)
    # The REAL routes.save_session / load_session / save_session_merging_gates run
    # against the fake; only the unrelated session_parameters helpers are stubbed.
    monkeypatch.setattr(routes, "execute_insert", lambda *a, **k: True)
    monkeypatch.setattr(routes, "execute_query", lambda *a, **k: [])
    monkeypatch.setattr(routes, "get_schema", lambda: "test_schema")
    return fake


@pytest.fixture
def client(db):
    app = FastAPI()
    app.include_router(routes.router, prefix="/api")
    return TestClient(app)


# --- deterministic interleaving ----------------------------------------------


@pytest.mark.parametrize("path", _ENDPOINTS)
def test_mcp_gate_written_during_app_save_survives(client, db, path):
    # TAMPER: route the call site back through load_session -> _merge_app_gates ->
    # save_session -> the MCP write lands after the unlocked snapshot, the App's
    # merged list overwrites it, and use_case_selection is lost -> this fails.
    db.row = {"completed_gates": ["project_setup"], "session_parameters": {}}
    db.interleave = mcp_resolves_use_case  # MCP commits during the App's write

    resp = client.post(
        path,
        json={
            "session_id": "s1",
            "step_prompts": {},
            "completed_gates": ["project_setup", "prd_generation"],  # no use_case_selection
        },
    )
    assert resp.status_code == 200, resp.text

    assert db.interleave is None  # the concurrent write did happen
    stored = db.row["completed_gates"]
    assert "use_case_selection" in stored, stored
    assert "project_setup" in stored and "prd_generation" in stored


# --- SQL shape: one connection, one transaction --------------------------------


def test_locked_read_and_upsert_run_in_one_transaction(db):
    # TAMPER: split the upsert onto a second `with get_connection()` -> two
    # connections and a commit-less lock read -> this fails.
    db.row = {
        "completed_gates": ["use_case_selection", "project_setup"],
        "session_parameters": {"skipped_gates": ["use_case_selection"], "direction": "forward"},
    }

    ok = lakebase.save_session_merging_gates(
        "s1",
        app_completed_gates=["project_setup", "prd_generation"],
        app_skipped_gates=["setup_lakebase"],
        created_by="u@example.com",
    )

    assert ok is True
    assert len(db.connections) == 1
    conn = db.connections[0]
    assert db.events == [(0, "lock_read"), (0, "upsert"), (0, "param_patch"), (0, "commit")]
    assert conn.commits == 1 and conn.rollbacks == 0
    # Every statement ran inside the explicit transaction; the pool's autocommit
    # mode is restored when the connection goes back.
    assert conn.autocommit_during == [False, False, False]
    assert conn.autocommit is True

    assert db.upserts[-1]["completed_gates"] == ["project_setup", "prd_generation", "use_case_selection"]
    assert db.row["session_parameters"] == {
        "skipped_gates": ["setup_lakebase", "use_case_selection"],
        "direction": "forward",  # JSONB || patch leaves other keys alone
    }


def test_completed_only_leaves_skipped_gates_untouched(db):
    db.row = {"completed_gates": [], "session_parameters": {"skipped_gates": ["setup_lakebase"]}}

    assert lakebase.save_session_merging_gates(
        "s1", app_completed_gates=["project_setup"], app_skipped_gates=None
    )

    assert db.events == [(0, "lock_read"), (0, "upsert"), (0, "commit")]
    assert db.row["session_parameters"] == {"skipped_gates": ["setup_lakebase"]}


def test_skipped_only_preserves_completed_gates(db):
    db.row = {"completed_gates": ["use_case_selection", "project_setup"], "session_parameters": {}}

    assert lakebase.save_session_merging_gates(
        "s1", app_completed_gates=None, app_skipped_gates=["setup_lakebase"]
    )

    assert db.upserts[-1]["completed_gates"] is None  # COALESCE preserves the column
    assert db.row["completed_gates"] == ["use_case_selection", "project_setup"]
    assert db.row["session_parameters"] == {"skipped_gates": ["setup_lakebase"]}


def test_no_existing_row_inserts_the_incoming_gates(db):
    # First write for a session id: FOR UPDATE locks nothing and there are no
    # stored gates to preserve; the upsert inserts the App's set as-is.
    assert db.row is None

    assert lakebase.save_session_merging_gates(
        "s1", app_completed_gates=["project_setup"], app_skipped_gates=["setup_lakebase"]
    )

    assert db.events == [(0, "lock_read"), (0, "upsert"), (0, "param_patch"), (0, "commit")]
    assert db.row["completed_gates"] == ["project_setup"]
    assert db.row["session_parameters"] == {"skipped_gates": ["setup_lakebase"]}


def test_db_error_rolls_back_and_returns_false(db):
    db.row = {"completed_gates": ["use_case_selection"], "session_parameters": {}}
    db.fail_on = "upsert"

    assert lakebase.save_session_merging_gates(
        "s1", app_completed_gates=["project_setup"], app_skipped_gates=None
    ) is False

    conn = db.connections[0]
    assert conn.commits == 0 and conn.rollbacks == 1
    assert conn.autocommit is True
    assert db.row["completed_gates"] == ["use_case_selection"]


def test_not_configured_returns_false_without_touching_the_db(monkeypatch):
    def _no_connection():
        raise AssertionError("get_connection must not be called when Lakebase is not configured")

    monkeypatch.setattr(lakebase, "is_lakebase_configured", lambda: False)
    monkeypatch.setattr(lakebase, "get_connection", _no_connection)

    assert lakebase.save_session_merging_gates(
        "s1", app_completed_gates=["project_setup"], app_skipped_gates=["setup_lakebase"]
    ) is False


# --- off the event loop ----------------------------------------------------------


def _request() -> Request:
    return Request({
        "type": "http",
        "method": "POST",
        "path": "/api/session/save",
        "headers": [(b"host", b"testserver")],
        "query_string": b"",
        "scheme": "http",
        "server": ("testserver", 80),
        "root_path": "",
    })


async def _endpoint_with_ticker(coro_factory):
    state = {"ticks": 0, "stop": False}

    async def ticker():
        while not state["stop"]:
            state["ticks"] += 1
            await asyncio.sleep(0.01)

    task = asyncio.create_task(ticker())
    result = await coro_factory()
    state["stop"] = True
    await task
    return result, state["ticks"]


@pytest.mark.parametrize("which", ["save", "update-metadata"])
def test_locked_gate_write_runs_off_loop(db, monkeypatch, which):
    # TAMPER: call save_session_merging_gates directly in the endpoint (no
    # asyncio.to_thread) -> the 0.4s locked read blocks the loop -> ticks ~= 0.
    monkeypatch.setattr(routes, "_get_session_user", lambda request: "u@example.com")
    db.row = {"completed_gates": [], "session_parameters": {}}
    db.read_delay = 0.4

    if which == "save":
        body = routes.SessionSaveRequest(session_id="s1", completed_gates=["project_setup"])
        factory = lambda: routes.save_session_endpoint(body, _request())  # noqa: E731
    else:
        body = routes.SessionUpdateMetadataRequest(session_id="s1", completed_gates=["project_setup"])
        factory = lambda: routes.update_session_metadata_endpoint(body, _request())  # noqa: E731

    result, ticks = asyncio.run(_endpoint_with_ticker(factory))

    assert (result.success if which == "save" else result["success"]) is True
    assert db.row["completed_gates"] == ["project_setup"]
    assert ticks >= 5  # the loop kept progressing during the locked transaction


# --- the moved merge function ----------------------------------------------------


def test_routes_and_lakebase_share_one_merge_implementation():
    assert routes._merge_app_gates is gate_merge._merge_app_gates
    assert not hasattr(routes._merge_app_gates, "__wrapped__")
    assert routes._merge_app_gates.__module__ == "src.backend.workshop.gate_merge"


def test_moved_merge_semantics():
    merge = gate_merge._merge_app_gates
    # None => preserve-on-absent.
    assert merge(None, ["use_case_selection"]) is None
    # Representable gates are authoritative from the App (prd_generation dropped);
    # non-representable stored gates are add-only (use_case_selection kept, once).
    assert merge(["project_setup"], ["use_case_selection", "project_setup", "prd_generation"]) == [
        "project_setup",
        "use_case_selection",
    ]
    assert merge(["use_case_selection"], ["use_case_selection"]) == ["use_case_selection"]
    assert merge([], None) == []


# --- base-aware App merge (app-save-drops-unseen-mcp-gates, D-12) ----------------
#
# The SPA sends the gate sets it last saw as base_completed_gates /
# base_skipped_gates. With a base the server removes only gates the App SAW
# (representable, in base) and dropped; gates added elsewhere since survive.


def _legacy_merge(incoming, existing):
    """``_merge_app_gates`` as it was before ``base`` existed (the G3 oracle)."""
    if incoming is None:
        return None
    from src.backend.workshop import manifest
    representable = set(manifest.step_number_to_tag().values())
    merged = list(incoming)
    for gate in existing or []:
        if gate not in representable and gate not in merged:
            merged.append(gate)
    return merged


def test_g1_mcp_completed_gate_unseen_by_app_survives():
    # TAMPER (T1): ignore base -> App-authoritative -> project_setup is dropped.
    merged = gate_merge._merge_app_gates(
        ["activation_app_design"],
        ["use_case_selection", "project_setup"],  # project_setup: MCP-added
        base=["use_case_selection"],
    )
    assert merged == ["use_case_selection", "project_setup", "activation_app_design"]


def test_g2_learner_uncompleting_in_app_removes_the_gate():
    # TAMPER (T2): removals = representable - incoming -> prd_generation (not in
    # base, so MCP-added) is dropped too and this fails.
    merged = gate_merge._merge_app_gates(
        ["project_setup"],
        ["project_setup", "setup_lakebase", "prd_generation"],
        base=["project_setup", "setup_lakebase"],
    )
    assert merged == ["project_setup", "prd_generation"]


@pytest.mark.parametrize(
    "incoming, existing",
    [
        (None, ["use_case_selection"]),
        (["project_setup"], ["use_case_selection", "project_setup", "prd_generation"]),
        (["use_case_selection"], ["use_case_selection"]),
        ([], None),
        ([], ["use_case_selection", "project_setup"]),
        (["prd_generation", "project_setup"], ["project_setup", "setup_lakebase"]),
        (["project_setup"], []),
        (["project_setup", "project_setup"], ["use_case_selection"]),
    ],
)
def test_g3_no_base_is_todays_app_authoritative_merge(incoming, existing):
    expected = _legacy_merge(incoming, existing)
    assert gate_merge._merge_app_gates(incoming, existing) == expected
    assert gate_merge._merge_app_gates(incoming, existing, None) == expected
    assert gate_merge._merge_app_gates(incoming, existing, base=None) == expected


@pytest.mark.parametrize("base", [None, [], ["use_case_selection", "project_setup"]])
def test_g4_non_representable_stored_gate_survives_with_and_without_base(base):
    # TAMPER (T3): removals = base - incoming (no representable filter) -> the
    # hydrated base carries use_case_selection, the App can't send it -> dropped.
    merged = gate_merge._merge_app_gates(
        ["project_setup"], ["use_case_selection", "project_setup"], base=base
    )
    assert "use_case_selection" in merged
    assert merged.count("use_case_selection") == 1
    assert "project_setup" in merged


def test_g5_skipped_gates_base_keeps_unseen_and_removes_seen(db):
    db.row = {
        "completed_gates": [],
        "session_parameters": {"skipped_gates": ["setup_lakebase", "prd_generation"]},
    }

    assert lakebase.save_session_merging_gates(
        "s1",
        app_completed_gates=None,
        app_skipped_gates=["activation_app_design"],
        base_skipped_gates=["setup_lakebase"],
    )

    # G2-shape: setup_lakebase was seen and dropped -> removed. G1-shape:
    # prd_generation was skipped elsewhere, unseen by the App -> survives.
    assert db.row["session_parameters"]["skipped_gates"] == ["prd_generation", "activation_app_design"]


def test_g5_completed_base_reaches_the_locked_merge(db):
    db.row = {"completed_gates": ["project_setup", "setup_lakebase"], "session_parameters": {}}

    assert lakebase.save_session_merging_gates(
        "s1",
        app_completed_gates=["prd_generation"],
        app_skipped_gates=None,
        base_completed_gates=["setup_lakebase"],
    )

    assert db.row["completed_gates"] == ["project_setup", "prd_generation"]


def _mcp_completes_project_setup(row: dict) -> None:
    """An MCP ``vibe_complete_step`` delta (the #88 add-only merge) adding project_setup."""
    row["completed_gates"], _, _ = lakebase._apply_mcp_delta(
        row.get("completed_gates") or [], {}, {}, add_gates=["project_setup"], set_outputs={}, set_params={}
    )


@pytest.mark.parametrize("path", _ENDPOINTS)
def test_g6_app_write_after_mcp_delta_keeps_the_mcp_gate(client, db, path):
    # The #88 probe's variant A, offline: the MCP vibe_complete_step delta commits,
    # THEN the App write lands carrying a base that predates it.
    # TAMPER (T1): ignore base -> App-authoritative -> project_setup is lost.
    db.row = {"completed_gates": ["use_case_selection"], "session_parameters": {}}
    assert lakebase.save_session_applying_mcp_delta(
        "s1", add_gates=["project_setup"], set_outputs={}, set_params={}
    )
    assert db.row["completed_gates"] == ["use_case_selection", "project_setup"]

    resp = client.post(
        path,
        json={
            "session_id": "s1",
            "step_prompts": {},
            "completed_gates": ["activation_app_design"],
            "base_completed_gates": ["use_case_selection"],
            "skipped_gates": [],
            "base_skipped_gates": [],
        },
    )
    assert resp.status_code == 200, resp.text

    assert db.row["completed_gates"] == ["use_case_selection", "project_setup", "activation_app_design"]


@pytest.mark.parametrize("path", _ENDPOINTS)
def test_g6_mcp_delta_during_app_write_keeps_the_mcp_gate(client, db, path):
    # Same, with the MCP delta landing while the App write waits on the row lock.
    db.row = {"completed_gates": ["use_case_selection"], "session_parameters": {}}
    db.interleave = _mcp_completes_project_setup
    db.interleave_on = "lock_read"

    resp = client.post(
        path,
        json={
            "session_id": "s1",
            "step_prompts": {},
            "completed_gates": ["activation_app_design"],
            "base_completed_gates": ["use_case_selection"],
        },
    )
    assert resp.status_code == 200, resp.text

    assert db.interleave is None
    assert db.row["completed_gates"] == ["use_case_selection", "project_setup", "activation_app_design"]


@pytest.mark.parametrize("path", _ENDPOINTS)
def test_g6_without_base_the_endpoint_stays_app_authoritative(client, db, path):
    # Old clients (no base_*): unchanged behavior, the unseen representable gate
    # is dropped exactly as before this change.
    db.row = {"completed_gates": ["use_case_selection", "project_setup"], "session_parameters": {}}

    resp = client.post(
        path,
        json={"session_id": "s1", "step_prompts": {}, "completed_gates": ["activation_app_design"]},
    )
    assert resp.status_code == 200, resp.text

    assert db.row["completed_gates"] == ["activation_app_design", "use_case_selection"]
