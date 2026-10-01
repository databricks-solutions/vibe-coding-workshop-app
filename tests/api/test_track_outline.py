"""Phase 3 T1 — offline tests for the thin GET /api/track/{track}/outline route.

This endpoint is pure transport over the SAME ``engine.outline`` the MCP server
already calls (7 tools, unchanged). It must reach flat MCP parity, tolerate the
legacy ``workshop_level`` sentinels (None / '300') that are NOT valid track ids,
and never 500 on a malformed row.

All tests are offline: ``routes.load_session`` is monkeypatched to return crafted
dicts (no live Lakebase), and the FastAPI router is mounted on a bare app so we do
not drag in static-file serving or the MCP mount.
"""

from dataclasses import asdict

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

from src.backend.api import routes
from src.backend.workshop import engine, manifest
from src.backend.workshop.state import build_session_state


GENIE_TRACK = "genie-accelerator"


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(routes.router, prefix="/api")
    return TestClient(app)


@pytest.fixture
def stub_session(monkeypatch):
    """Install a monkeypatched load_session returning one crafted record."""

    def _install(record):
        def _load(session_id):
            return record

        monkeypatch.setattr(routes, "load_session", _load)
        return record

    return _install


def _genie_tags(n):
    steps = manifest.load_manifest().track_steps(GENIE_TRACK)
    return [step.sectionTag for step in steps[:n]]


def _expected_outline(track, record):
    """Parity oracle: run the ENGINE over the shared builder, not a hand list."""

    state = build_session_state(record, track)
    return [asdict(item) for item in engine.outline(track, state)]


# --- T1-B1 PARITY (core) ------------------------------------------------------


def test_explicit_genie_track_matches_engine_outline(client, stub_session):
    record = {
        "session_id": "sess-genie",
        "workshop_level": GENIE_TRACK,
        "completed_gates": _genie_tags(1),  # project_setup done
        "captured_outputs": {},
        "session_parameters": {"coding_assistant": "genie-code"},
    }
    stub_session(record)

    resp = client.get(f"/api/track/{GENIE_TRACK}/outline", params={"session_id": "sess-genie"})

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["track"] == GENIE_TRACK
    assert body["session_id"] == "sess-genie"
    assert body["outline"] == _expected_outline(GENIE_TRACK, record)
    # Flat MCP parity: no section grouping / metadata, exactly four keys per item.
    assert body["outline"], "expected a non-empty outline"
    for item in body["outline"]:
        assert set(item.keys()) == {"sectionTag", "title", "status", "execution"}


# --- T1-B2 LEGACY None / '300' (non-negotiable) -------------------------------


@pytest.mark.parametrize("legacy_level", [None, "300"])
def test_auto_resolves_legacy_genie_code_session(client, stub_session, legacy_level):
    record = {
        "session_id": "sess-legacy",
        "workshop_level": legacy_level,  # NOT a valid track id
        "completed_gates": [],
        "captured_outputs": {},
        "session_parameters": {"coding_assistant": "genie-code"},
    }
    stub_session(record)

    resp = client.get("/api/track/auto/outline", params={"session_id": "sess-legacy"})

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["track"] == GENIE_TRACK  # assistant default rescues the legacy row
    assert body["outline"] == _expected_outline(GENIE_TRACK, record)


# --- T1-B3 EXPLICIT PATH WINS -------------------------------------------------


def test_explicit_path_track_overrides_resolution(client, stub_session):
    record = {
        "session_id": "sess-genie",
        "workshop_level": GENIE_TRACK,
        "completed_gates": [],
        "captured_outputs": {},
        "session_parameters": {"coding_assistant": "genie-code"},
    }
    stub_session(record)

    resp = client.get("/api/track/end-to-end/outline", params={"session_id": "sess-genie"})

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["track"] == "end-to-end"
    assert body["outline"] == _expected_outline("end-to-end", record)


# --- T1-B4 UNKNOWN TRACK -> clean 404 -----------------------------------------


def test_unknown_track_without_session_is_clean_404(client, stub_session):
    stub_session(None)  # no such session to resolve against

    resp = client.get("/api/track/not-a-real-track/outline")

    assert resp.status_code == 404, resp.text
    assert "detail" in resp.json()  # structured error, not an unhandled KeyError/500


# --- NB2 hardening: provided-but-unloadable session is 404 on BOTH paths ------


def test_valid_track_with_unloadable_session_is_404(client, stub_session):
    """Explicit VALID track + session_id whose load returns None -> 404, not a
    misleading fresh/all-locked 200 that echoes a session that failed to load.

    Unlike test_unknown_track_without_session_is_clean_404 (which does NOT pass
    session_id, so load_session is never called), this test passes session_id in
    params so load_session is actually invoked and returns None.
    """
    stub_session(None)  # load_session(session_id) -> None

    resp = client.get(
        f"/api/track/{GENIE_TRACK}/outline", params={"session_id": "gone"}
    )

    assert resp.status_code == 404, resp.text
    assert "detail" in resp.json()


def test_valid_track_with_raising_load_session_is_404(client, monkeypatch):
    """Explicit VALID track + session_id whose load raises -> 404 (not 500, not a
    misleading fresh outline). The load error is swallowed, then treated as
    provided-but-unloadable."""

    def _boom(session_id):
        raise RuntimeError("lakebase unavailable")

    monkeypatch.setattr(routes, "load_session", _boom)

    resp = client.get(
        f"/api/track/{GENIE_TRACK}/outline", params={"session_id": "explodes"}
    )

    assert resp.status_code == 404, resp.text
    assert "detail" in resp.json()


# --- T1-B5 NUMBER -> GATE BACKFILL parity (T5 PR1: GLOBAL numbers) ------------


def test_completed_gates_mark_done(client, stub_session):
    # T5 R4b: progress is read from completed_gates verbatim (gates-only). A row
    # whose gates name project_setup / prd_generation marks exactly those done.
    tags = _genie_tags(2)  # [project_setup, prd_generation]
    record = {
        "session_id": "sess-gates",
        "workshop_level": GENIE_TRACK,
        "completed_gates": tags,
        "captured_outputs": {},
        "session_parameters": {},
    }
    stub_session(record)

    resp = client.get(f"/api/track/{GENIE_TRACK}/outline", params={"session_id": "sess-gates"})

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["outline"] == _expected_outline(GENIE_TRACK, record)
    status_by_tag = {item["sectionTag"]: item["status"] for item in body["outline"]}
    for tag in tags:
        assert status_by_tag[tag] == "done"


def test_completed_steps_numbers_are_not_read(client, stub_session):
    # T5 R4b TAMPER: a row with EMPTY gates but a stale numeric completed_steps
    # column marks NOTHING done — the number backfill is gone. Re-add a numeric
    # read to build_session_state and this fails (steps become done).
    tags = _genie_tags(2)
    record = {
        "session_id": "sess-nums",
        "workshop_level": GENIE_TRACK,
        "completed_gates": [],
        "completed_steps": [2, 3],  # retired column — must be ignored
        "captured_outputs": {},
        "session_parameters": {},
    }
    stub_session(record)

    resp = client.get(f"/api/track/{GENIE_TRACK}/outline", params={"session_id": "sess-nums"})

    assert resp.status_code == 200, resp.text
    status_by_tag = {item["sectionTag"]: item["status"] for item in resp.json()["outline"]}
    for tag in tags:
        assert status_by_tag[tag] != "done", "stale numeric column must not mark steps done"


# --- T1-B6 NULL tolerance -----------------------------------------------------


def test_null_columns_do_not_500(client, stub_session):
    record = {
        "session_id": "sess-null",
        "workshop_level": None,
        "prerequisites_completed": None,
        "current_step": None,
        "completed_gates": None,
        "captured_outputs": None,
        "session_parameters": None,
        "use_case": None,
    }
    stub_session(record)

    resp = client.get("/api/track/auto/outline", params={"session_id": "sess-null"})

    assert resp.status_code == 200, resp.text
    body = resp.json()
    # No coding assistant, no lock, no real level -> system default.
    assert body["track"] == "end-to-end"
    assert body["outline"] == _expected_outline("end-to-end", record)


# --- T1-B8 NO-SESSION ---------------------------------------------------------


def test_no_session_returns_fresh_outline_for_path_track(client, monkeypatch):
    # Guard: the route must not even try to load when session_id is absent.
    def _boom(session_id):
        raise AssertionError("load_session must not be called without session_id")

    monkeypatch.setattr(routes, "load_session", _boom)

    resp = client.get(f"/api/track/{GENIE_TRACK}/outline")

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["track"] == GENIE_TRACK
    assert body["session_id"] is None
    # A fresh (empty) SessionState: first step current, everything after locked.
    fresh = [asdict(item) for item in engine.outline(GENIE_TRACK, engine.SessionState())]
    assert body["outline"] == fresh
    assert body["outline"][0]["status"] == "current"


# --- T1-B7 EXTRACTION GUARD ---------------------------------------------------


def test_mcp_coerce_state_uses_shared_builder():
    """mcp_server must route through the shared builder (no divergent copy)."""

    from src.backend import mcp_server

    # The local _session_state def is gone; the shared builder is the one path.
    assert not hasattr(mcp_server, "_session_state")

    record = {"completed_steps": [1], "completed_gates": [], "session_parameters": {}}
    coerced = mcp_server._coerce_state(record)
    expected = build_session_state(record)  # default track parity
    assert coerced.completed_gates == expected.completed_gates
    assert coerced.session_parameters == expected.session_parameters


def test_build_session_state_uses_gates_verbatim():
    # T5 R4b: completed_gates are used verbatim; there is no number backfill.
    record = {
        "completed_gates": ["project_setup", "prd_generation", "semlayer_locate"],
        "session_parameters": {},
    }

    state = build_session_state(record, GENIE_TRACK)

    assert state.completed_gates == ["project_setup", "prd_generation", "semlayer_locate"]


def test_build_session_state_ignores_stale_number_column():
    # T5 R4b TAMPER: empty gates + a stale completed_steps column => empty gates
    # (the number backfill is gone). Re-add the backfill and this fails.
    record = {
        "completed_steps": [2, 3, 57, 58],
        "completed_gates": [],
        "session_parameters": {},
    }

    state = build_session_state(record, GENIE_TRACK)

    assert state.completed_gates == []
