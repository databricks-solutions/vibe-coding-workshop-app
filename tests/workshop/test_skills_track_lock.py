"""D-115 / D-120 — skills-accelerator always means build_skill over MCP.

The web app reaches skills-accelerator only via use case build_skill (industry
``sample``), and ``resolve_track`` keeps a session on that track only while
build_skill is locked. Before this change ``vibe_start_track(track="skills-accelerator")``
persisted a session with no use case, so every later tool resolved end-to-end: the
5 ``skill_*`` steps returned UNKNOWN_STEP and a non-skill pick walked end-to-end.

Now ``vibe_start_track`` locks sample/build_skill before the first persist and
refuses any other pick; ``vibe_set_parameters`` on that track refuses a switch. A
catalogue that answers without the pair gives USE_CASE_UNAVAILABLE; a catalogue
outage starts anyway on the constant lock with one content-free WARNING (D-120).

The curated seams (``routes.get_industries`` / ``routes.get_use_cases_map``) are
stubbed; ``_curated_pair_status`` and ``_use_case_label_for`` run for real.

TAMPERS (verified, see PR body):
* X1 drop the force-lock in vibe_start_track            -> T-a, T-f fail.
* X2 drop the vibe_set_parameters refusal               -> T-d fails.
* X3 fall back to end-to-end on a missing pair          -> T-e(i) fails.
* X4 lock after the new-session persist                 -> T-f fails.
* X5 refuse on every track in vibe_set_parameters       -> T-g fails.
* X6 USE_CASE_UNAVAILABLE on an outage                  -> T-e(ii) fails.
* X7 drop the constant label fallback                   -> T-e(ii) fails.
* X8 put the session id in the outage WARNING           -> T-e(ii) fails.
"""

import copy
import json
import logging
import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.api import routes
from src.backend.workshop import engine
from src.backend.workshop.track_resolution import resolve_track

TRACK = "skills-accelerator"
LABEL = "Build a Data Contract Skill"
LOCK_MESSAGE = (
    "The skills-accelerator track always builds the Data Contract Skill (use case build_skill). "
    "To work on a different use case, start the end-to-end track with "
    'vibe_start_track(track="end-to-end").'
)
# Independent of the engine: straight from manifest.json.
SKILLS_TAGS = [
    step["sectionTag"]
    for section in json.loads((REPO_ROOT / "src" / "backend" / "workshop" / "manifest.json").read_text())[
        "tracks"
    ][TRACK]["sections"]
    for step in section["steps"]
]
SKILL_STEP_TAGS = [tag for tag in SKILLS_TAGS if tag.startswith("skill_")]

_INDUSTRIES = [
    {"value": "", "label": "Select an industry..."},
    {"value": "sample", "label": "Sample"},
    {"value": "retail", "label": "Retail"},
]
_USE_CASES = {
    "sample": [
        {"value": "", "label": "Select a use case..."},
        {"value": "build_skill", "label": LABEL, "is_certified": True},
    ],
    "retail": [
        {"value": "", "label": "Select a use case..."},
        {"value": "booking", "label": "Booking App", "is_certified": True},
    ],
}


def _outage():
    raise RuntimeError("catalogue down")


@pytest.fixture
def env(monkeypatch):
    """In-memory store + recorded saves; ``catalogue(industries, use_cases)``
    re-stubs the curated seams (a callable raises to simulate an outage)."""

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
    monkeypatch.setattr(mcp_server, "append_session_interaction", lambda **k: True, raising=False)
    monkeypatch.setattr(routes, "load_session", load_session)

    def catalogue(industries=_INDUSTRIES, use_cases=_USE_CASES):
        def _seam(value):
            return value if callable(value) else (lambda: value)

        monkeypatch.setattr(routes, "get_industries", _seam(industries))
        monkeypatch.setattr(routes, "get_use_cases_map", _seam(use_cases))

    catalogue()
    return store, saves, catalogue


def _start(**kwargs):
    started = mcp_server.vibe_start_track(TRACK, **kwargs)
    assert not isinstance(started, dict), started
    return started


def _code(result):
    assert isinstance(result, dict), result
    return result["error"]["code"]


def _tags(outline):
    return [item["sectionTag"] if isinstance(item, dict) else item.sectionTag for item in outline]


def _resource_tags(sid):
    return _tags(json.loads(mcp_server._session_state_resource(sid))["outline"])


# --- T-a: every skill_* step resolves by name ----------------------------------


def test_ta_every_skill_step_resolves_by_name(env):
    sid = _start().session_id
    assert SKILL_STEP_TAGS and len(SKILL_STEP_TAGS) == 5
    for tag in SKILL_STEP_TAGS:
        for result in (mcp_server.vibe_get_step(sid, tag), mcp_server.vibe_explain_step(sid, tag)):
            if isinstance(result, dict):
                assert result["error"]["code"] != "UNKNOWN_STEP", (tag, result)
            else:
                assert result.sectionTag == tag


# --- T-b: the walk stays on skills-accelerator to Done -------------------------


def test_tb_walk_stays_on_skills_accelerator_to_done(env):
    sid = _start().session_id
    walked = []
    for _ in range(len(SKILLS_TAGS) + 1):
        nxt = mcp_server.vibe_next_step(sid).root
        if isinstance(nxt, mcp_server.DoneResult):
            break
        done = mcp_server.vibe_complete_step(sid, nxt.sectionTag, "out")
        assert not isinstance(done, dict), done
        walked.append(nxt.sectionTag)
        if not isinstance(done.next, mcp_server.DoneResult):
            assert done.next.sectionTag in SKILLS_TAGS, done.next.sectionTag
    assert isinstance(nxt, mcp_server.DoneResult), nxt
    assert walked == SKILLS_TAGS
    assert "prd_generation" not in walked


# --- T-c: the start roadmap equals the actual outline --------------------------


def test_tc_start_roadmap_equals_actual_outline(env):
    started = _start()
    roadmap = _tags(started.outline)
    assert started.track == TRACK
    assert roadmap == _resource_tags(started.session_id)
    loaded = mcp_server._load_session_and_track(started.session_id)
    assert roadmap == [item.sectionTag for item in engine.outline(TRACK, loaded[0])]
    assert roadmap == SKILLS_TAGS


# --- T-d: a non-skill pick is refused, nothing persisted -----------------------


@pytest.mark.parametrize(
    "kwargs",
    [
        {"industry": "retail", "use_case": "booking"},
        {"use_case": "booking"},
        {"industry": "retail"},
        {"industry": "sample", "use_case": "booking"},
    ],
)
def test_td_start_track_refuses_a_non_skill_pick(env, kwargs):
    store, saves, _ = env
    result = mcp_server.vibe_start_track(TRACK, **kwargs)
    assert _code(result) == "INVALID_PARAMETER"
    assert result["error"]["message"] == LOCK_MESSAGE
    assert store == {} and saves == []


@pytest.mark.parametrize(
    "params",
    [{"use_case": "booking"}, {"industry": "retail"}, {"use_case_source": "custom"}],
)
def test_td_set_parameters_refuses_a_switch(env, params):
    store, saves, _ = env
    sid = _start().session_id
    before = copy.deepcopy(store[sid])
    save_count = len(saves)
    result = mcp_server.vibe_set_parameters(sid, dict(params))
    assert _code(result) == "INVALID_PARAMETER"
    assert result["error"]["message"] == LOCK_MESSAGE
    assert store[sid] == before
    assert len(saves) == save_count
    assert resolve_track(store[sid]) == TRACK


def test_td_set_parameters_keeps_non_selection_params(env):
    store, _, _ = env
    sid = _start().session_id
    result = mcp_server.vibe_set_parameters(sid, {"catalog": "main", "use_case": "build_skill"})
    assert not isinstance(result, dict), result
    assert store[sid]["session_parameters"]["catalog"] == "main"


# --- T-e: missing pair vs catalogue outage (r1, D-120) -------------------------


@pytest.mark.parametrize(
    "industries, use_cases",
    [
        # sample absent from a catalogue that answers.
        ([{"value": "retail", "label": "Retail"}], {"retail": _USE_CASES["retail"]}),
        # sample present, build_skill absent.
        (_INDUSTRIES, {"sample": [{"value": "other", "label": "Other"}], "retail": _USE_CASES["retail"]}),
    ],
)
def test_te_i_missing_pair_is_use_case_unavailable(env, industries, use_cases):
    store, saves, catalogue = env
    catalogue(industries, use_cases)
    result = mcp_server.vibe_start_track(TRACK)
    assert _code(result) == "USE_CASE_UNAVAILABLE"
    assert "Build a Data Contract Skill" in result["error"]["message"]
    assert store == {} and saves == []
    assert "outline" not in result


@pytest.mark.parametrize(
    "industries, use_cases",
    [(_outage, _outage), (_INDUSTRIES, _outage), ([], {}), (_INDUSTRIES, {})],
)
def test_te_ii_outage_starts_on_the_constant_lock(env, caplog, industries, use_cases):
    store, _, catalogue = env
    catalogue(industries, use_cases)
    caplog.clear()
    with caplog.at_level(logging.WARNING):
        started = mcp_server.vibe_start_track(TRACK)
    assert not isinstance(started, dict), started
    sid = started.session_id
    assert started.track == TRACK
    assert _tags(started.outline) == SKILLS_TAGS
    record = store[sid]
    assert record["use_case"] == "build_skill"
    assert record["industry"] == "sample"
    assert record["use_case_label"] == LABEL
    assert resolve_track(record) == TRACK
    warnings = [r for r in caplog.records if r.levelno >= logging.WARNING]
    assert len(warnings) == 1, [r.getMessage() for r in warnings]
    message = warnings[0].getMessage()
    assert not warnings[0].args
    assert sid not in message and "learner@acme.com" not in message
    assert mcp_server.vibe_next_step(sid).root.sectionTag == SKILLS_TAGS[0]


# --- T-f: the lock is on the first write; no intent beat -----------------------


def test_tf_first_save_carries_the_lock_and_no_intent_beat(env):
    store, saves, _ = env
    sid = _start().session_id
    seed = [fields for (s, fields) in saves if s == sid][0]
    assert seed["use_case"] == "build_skill"
    assert seed["industry"] == "sample"
    assert seed["use_case_label"] == LABEL
    assert store[sid]["use_case"] == "build_skill"
    assert resolve_track(store[sid]) == TRACK
    first = mcp_server.vibe_next_step(sid).root
    assert first.sectionTag == SKILLS_TAGS[0]
    assert first.sectionTag != engine.USE_CASE_GATE


def test_tf_resume_of_an_unlocked_skills_session_locks_it(env):
    store, _, _ = env
    store["old"] = {
        "session_id": "old",
        "workshop_level": TRACK,
        "created_by": "learner@acme.com",
        "session_parameters": {"coding_assistant": "genie-code"},
    }
    assert resolve_track(store["old"]) == "end-to-end"
    started = mcp_server.vibe_start_track(TRACK, session_id="old")
    assert not isinstance(started, dict), started
    assert store["old"]["use_case"] == "build_skill"
    assert resolve_track(store["old"]) == TRACK
    assert mcp_server.vibe_next_step("old").root.sectionTag == SKILLS_TAGS[0]


def test_tf_resume_of_a_switched_session_is_left_as_it_is(env):
    store, _, _ = env
    store["switched"] = {
        "session_id": "switched",
        "workshop_level": TRACK,
        "created_by": "learner@acme.com",
        "industry": "retail",
        "use_case": "booking",
        "completed_gates": [engine.USE_CASE_GATE],
        "session_parameters": {"industry": "retail", "use_case": "booking"},
    }
    before = copy.deepcopy(store["switched"])
    started = mcp_server.vibe_start_track(TRACK, session_id="switched")
    assert not isinstance(started, dict), started
    assert store["switched"]["use_case"] == before["use_case"] == "booking"
    assert resolve_track(store["switched"]) == "end-to-end"


# --- T-g: web path and other tracks unchanged ----------------------------------


def test_tg_spa_outline_route_matches_mcp(env):
    from fastapi import FastAPI
    from starlette.testclient import TestClient

    app = FastAPI()
    app.include_router(routes.router, prefix="/api")
    client = TestClient(app)
    sid = _start().session_id
    response = client.get("/api/track/auto/outline", params={"session_id": sid})
    assert response.status_code == 200, response.text
    assert response.json()["track"] == TRACK
    assert response.json()["outline"] == json.loads(mcp_server._session_state_resource(sid))["outline"]
    assert _tags(response.json()["outline"]) == SKILLS_TAGS


def test_tg_end_to_end_is_unchanged(env, monkeypatch):
    store, _, _ = env
    monkeypatch.setattr(mcp_server, "_generate_step_prompt", lambda **kwargs: None)
    bare = mcp_server.vibe_start_track("end-to-end")
    assert not isinstance(bare, dict), bare
    assert mcp_server.vibe_next_step(bare.session_id).root.sectionTag == engine.USE_CASE_GATE
    for params in ({"use_case": "booking"}, {"industry": "retail"}, {"use_case_source": "custom"}):
        result = mcp_server.vibe_set_parameters(bare.session_id, dict(params))
        assert not isinstance(result, dict), (params, result)
    picked = mcp_server.vibe_start_track("end-to-end", industry="retail", use_case="booking")
    assert not isinstance(picked, dict), picked
    assert store[picked.session_id]["use_case"] == "booking"
    assert resolve_track(store[picked.session_id]) == "end-to-end"
