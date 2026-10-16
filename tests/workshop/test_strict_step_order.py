"""Strict step order (D-78): the MCP walk can never skip an unfinished step.

A Genie Code kickoff on genie-accelerator returned ``next`` = semlayer_locate after
vibe_complete_step(project_setup), skipping the use-case pick and prd_generation:
engine.outline scanned past the locked prd_generation to the ungated
semlayer_locate. These tests pin the strict invariant (next is always the first
unfinished, unskipped step, or Blocked on it), complete_step's refusal of
out-of-order steps, and the use-case intent beat on vibe_complete_step's ``next``.
"""

import copy
import json
import pathlib
import sys
from dataclasses import asdict

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.api import routes
from src.backend.workshop import engine
from src.backend.workshop.state import build_session_state


TRACK = "genie-accelerator"
INDUSTRY = "travel"
USE_CASE = "ai_driven_booking"
ALL_TRACKS = sorted(engine.MANIFEST.tracks)
# resolve_track downgrades skills-accelerator unless the use case is its lock.
USE_CASE_FOR = {"skills-accelerator": "build_skill"}


def _session(gates=None, params=None):
    return engine.SessionState(
        completed_gates=list(gates or []),
        captured_outputs={},
        session_parameters=dict(params or {}),
    )


def _statuses(track, session):
    return {item.sectionTag: item.status for item in engine.outline(track, session)}


# --- T1: genie-accelerator after project_setup ----------------------------------


def test_genie_after_project_setup_is_blocked_on_prd():
    session = _session()
    result = engine.complete_step(TRACK, session, "project_setup", "out")
    assert result.ok
    nxt = engine.next_step(TRACK, session)
    assert isinstance(nxt, engine.Blocked)
    assert nxt.sectionTag == "prd_generation"
    assert result.next_step == nxt
    statuses = _statuses(TRACK, session)
    assert statuses["prd_generation"] == "locked"
    assert statuses["semlayer_locate"] == "locked"


# --- T2: the invariant, every track, every prefix -------------------------------


def _assert_prefix_invariant(track, base_gates):
    steps = engine._ordered_steps(track, _session(base_gates))
    tags = [step.sectionTag for step in steps]
    assert tags, track
    for k in range(len(steps) + 1):
        session = _session(list(base_gates) + tags[:k])
        # Completing steps never re-composes the outline on default flags.
        assert [step.sectionTag for step in engine._ordered_steps(track, session)] == tags
        outline = engine.outline(track, session)
        current = [item.sectionTag for item in outline if item.status == "current"]
        assert len(current) <= 1, (track, k, current)
        assert [item.status for item in outline[:k]] == ["done"] * k, (track, k)
        assert all(item.status == "locked" for item in outline[k + 1 :]), (track, k)
        nxt = engine.next_step(track, session)
        if k == len(steps):
            assert isinstance(nxt, engine.Done), (track, k, nxt)
            assert current == []
            continue
        if engine.can_start(steps[k], session, set(tags)):
            assert isinstance(nxt, engine.Step), (track, k, nxt)
            assert nxt.sectionTag == tags[k], (track, k)
            assert current == [tags[k]], (track, k)
        else:
            assert isinstance(nxt, engine.Blocked), (track, k, nxt)
            assert nxt.sectionTag == tags[k], (track, k)
            assert current == [], (track, k)
            assert outline[k].status == "locked"


@pytest.mark.parametrize("track", ALL_TRACKS)
def test_invariant_all_tracks(track):
    assert len(ALL_TRACKS) == 14
    # Without the use case (prd_generation stays Blocked) and with it resolved.
    _assert_prefix_invariant(track, [])
    _assert_prefix_invariant(track, [engine.USE_CASE_GATE])


# --- T3: complete_step refuses a strict-locked step -----------------------------


def test_complete_step_refuses_locked():
    session = _session()
    # semlayer_locate has no gate of its own (requiresGate None), yet it is
    # behind project_setup and prd_generation in the outline.
    semlayer = engine.resolve_step(TRACK, session, "semlayer_locate")
    assert semlayer.requiresGate is None
    result = engine.complete_step(TRACK, session, "semlayer_locate", "out")
    assert not result.ok
    assert result.error_code == "STEP_LOCKED"
    assert session.completed_gates == []

    engine.complete_step(TRACK, session, "project_setup", "out")
    refused = engine.complete_step(TRACK, session, "semlayer_locate", "out")
    assert refused.error_code == "STEP_LOCKED"

    engine.resolve_use_case(session, "{}")
    assert engine.complete_step(TRACK, session, "prd_generation", "prd").ok
    done = engine.complete_step(TRACK, session, "semlayer_locate", "out")
    assert done.ok, done
    assert "semlayer_locate" in session.completed_gates
    # Already-done steps stay idempotent successes.
    assert engine.complete_step(TRACK, session, "project_setup", "again").ok


# --- T6: skipped steps still pass ------------------------------------------------


def test_skipped_outline_step_is_passed():
    tags = [step.sectionTag for step in engine._ordered_steps(TRACK, _session())]
    assert tags[:3] == ["project_setup", "prd_generation", "semlayer_locate"]
    session = _session(
        gates=["project_setup", engine.USE_CASE_GATE],
        params={"skipped_gates": ["prd_generation"]},
    )
    statuses = _statuses(TRACK, session)
    assert statuses["prd_generation"] == "skipped"
    assert statuses["semlayer_locate"] == "current"
    nxt = engine.next_step(TRACK, session)
    assert isinstance(nxt, engine.Step)
    assert nxt.sectionTag == "semlayer_locate"
    assert engine.complete_step(TRACK, session, "semlayer_locate", "out").ok


# --- MCP: T4 (complete's next) and T5 (MCP outline == endpoint) ----------------


@pytest.fixture
def mcp_env(monkeypatch):
    """In-memory Lakebase store with the curated catalogue stubbed (offline)."""

    store: dict = {}

    def load_session(session_id):
        record = store.get(session_id)
        return copy.deepcopy(record) if record is not None else None

    def save_session(session_id, **fields):
        store.setdefault(session_id, {"session_id": session_id}).update(copy.deepcopy(fields))
        return True

    monkeypatch.setattr(mcp_server, "load_session", load_session)
    monkeypatch.setattr(mcp_server, "save_session", save_session)
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: True)
    monkeypatch.setattr(mcp_server, "_request_user", lambda ctx: "learner@acme.com")
    monkeypatch.setattr(mcp_server, "_curated_pair_status", lambda industry, use_case: "known")
    monkeypatch.setattr(mcp_server, "_industry_label_for", lambda industry, echo: "Travel")
    monkeypatch.setattr(mcp_server, "_use_case_label_for", lambda industry, use_case: None)
    monkeypatch.setattr(
        routes, "load_session", lambda sid: copy.deepcopy(store[sid]) if sid in store else None
    )
    return store


def _start(track, *, locked):
    if locked:
        started = mcp_server.vibe_start_track(
            track, use_case=USE_CASE_FOR.get(track, USE_CASE), industry=INDUSTRY
        )
    else:
        started = mcp_server.vibe_start_track(track)
    assert not isinstance(started, dict), started
    return started.session_id


@pytest.mark.parametrize("track", [TRACK, "app-only"])
def test_vibe_complete_step_intent_beat(mcp_env, track):
    sid = _start(track, locked=False)
    completed = mcp_server.vibe_complete_step(sid, "project_setup", "out")
    assert not isinstance(completed, dict), completed
    beat = mcp_server.vibe_next_step(sid).root
    assert beat.sectionTag == engine.USE_CASE_GATE
    assert completed.next.sectionTag == beat.sectionTag
    assert completed.next.title == beat.title
    # The out-of-order step is refused over MCP too.
    refused = mcp_server.vibe_complete_step(sid, "prd_generation", "prd")
    assert isinstance(refused, dict) and refused["error"]["code"] == "STEP_LOCKED", refused

    sid = _start(track, locked=True)
    completed = mcp_server.vibe_complete_step(sid, "project_setup", "out")
    assert not isinstance(completed, dict), completed
    assert completed.next.sectionTag == "prd_generation"
    assert mcp_server.vibe_next_step(sid).root.sectionTag == "prd_generation"
    # The intent-beat idempotent path shares the same `next`.
    again = mcp_server.vibe_complete_step(sid, engine.USE_CASE_GATE, "")
    assert not isinstance(again, dict), again
    assert again.next.sectionTag == "prd_generation"


def test_semlayer_locate_refused_over_mcp(mcp_env):
    sid = _start(TRACK, locked=False)
    refused = mcp_server.vibe_complete_step(sid, "semlayer_locate", "out")
    assert isinstance(refused, dict) and refused["error"]["code"] == "STEP_LOCKED", refused


@pytest.mark.parametrize("locked", [False, True])
def test_mcp_outline_matches_endpoint_after_project_setup(mcp_env, locked):
    store = mcp_env
    sid = _start(TRACK, locked=locked)
    completed = mcp_server.vibe_complete_step(sid, "project_setup", "out")
    assert not isinstance(completed, dict), completed

    app = FastAPI()
    app.include_router(routes.router, prefix="/api")
    response = TestClient(app).get(f"/api/track/{TRACK}/outline", params={"session_id": sid})
    assert response.status_code == 200, response.text
    endpoint = response.json()["outline"]
    resource = json.loads(mcp_server._session_state_resource(sid))["outline"]
    assert resource == endpoint
    state = build_session_state(store[sid], TRACK)
    assert endpoint == [asdict(item) for item in engine.outline(TRACK, state)]

    status = {item["sectionTag"]: item["status"] for item in endpoint}
    assert status["project_setup"] == "done"
    assert status["prd_generation"] == ("current" if locked else "locked")
    assert status["semlayer_locate"] == "locked"
    assert [item["status"] for item in endpoint].count("current") <= 1
