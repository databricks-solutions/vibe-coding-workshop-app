"""D-13 / D-15 — vibe_start_track ignores an uncatalogued use case.

Before this change, starting a track with ANY non-empty (industry, use_case) pair
resolved the pre-journey use_case_selection gate, wrote a use_case_brief and
persisted both columns — so an invented pair skipped the intent beat and earned
App step-1 credit (lakebase._has_defined_intent needs both columns non-empty).

Now the pair is classified against the curated catalogue
(``_curated_pair_status``, built on ``_available_use_cases``):

* known       -> today's behavior (gate resolved, columns persisted).
* unknown     -> no gate, no brief, no use_case column/param, default name. A
                 catalogued industry is still recorded (by_industry analytics,
                 D-15); an uncatalogued one is dropped too.
* unavailable -> today's behavior (fail open; a catalogue outage never breaks
                 session creation).

TAMPERS (verified, see PR body):
* T1 map an absent value to "known"          -> U2 fails.
* T2 map a catalogue failure to "unknown"    -> U3 fails.
* T3 write use_case unconditionally          -> U2 fails (column/params assertion).
* X1 state.has_defined_intent -> bool(row.get("industry"))
                                             -> U7(a)/(b) fail.
* X2 drop the ``if _has_defined_intent(row):`` guard in
     lakebase._row_completion_globals        -> U7(b) fails, U7(c) stays green.
* X3 add ``not session_id and`` to the curated-pair classification condition
     in vibe_start_track (skip it on resume) -> U8a fails.
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
from src.backend.services import lakebase
from src.backend.workshop import engine, state
from src.backend.workshop.completion_keying import tag_to_global_number

TRACK = "genie-accelerator"

_INDUSTRIES = [
    {"value": "", "label": "Select an industry..."},
    {"value": "travel", "label": "Travel & Hospitality"},
]
_USE_CASES = {
    "travel": [
        {"value": "", "label": "Select a use case..."},
        {"value": "booking", "label": "Booking App", "is_certified": True},
    ],
}


@pytest.fixture
def env(monkeypatch):
    """In-memory store + recorded saves; curated seams stubbed per test via
    ``catalogue(industries, use_cases)`` (callables raise to simulate an outage)."""
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
    # Keep the beat payload offline: the assembler + FMAPI are exercised elsewhere.
    monkeypatch.setattr(
        mcp_server.assembler,
        "get_section_input_content",
        lambda **kwargs: {"input": "PICK YOUR USE CASE", "how_to_apply": "h", "expected_output": "o", "user_trigger_prompt": "trigger"},
    )
    monkeypatch.setattr(mcp_server, "_generate_step_prompt", lambda **kwargs: None)

    def catalogue(industries=_INDUSTRIES, use_cases=_USE_CASES):
        def _seam(value):
            if callable(value):
                return value
            return lambda: value

        monkeypatch.setattr(routes, "get_industries", _seam(industries))
        monkeypatch.setattr(routes, "get_use_cases_map", _seam(use_cases))

    catalogue()
    return store, saves, catalogue


def _seed(saves, sid):
    seeds = [fields for (s, fields) in saves if s == sid]
    assert seeds, "expected a new-session seed save"
    return seeds[0]


def _outage():
    raise RuntimeError("catalogue down")


# --- U1: a known pair -> unchanged ------------------------------------------


def test_u1_known_pair_resolves_gate_and_persists_columns(env):
    store, saves, _ = env

    result = mcp_server.vibe_start_track(TRACK, use_case="booking", industry="travel")

    sid = result.session_id
    row = store[sid]
    assert engine.USE_CASE_GATE in row["completed_gates"]
    assert engine.USE_CASE_BRIEF in row["captured_outputs"]
    assert row["industry"] == "travel"
    assert row["use_case"] == "booking"
    assert row["session_parameters"]["use_case"] == "booking"
    assert _seed(saves, sid)["session_name"] == "Genie Code — booking"


# --- U2: unknown use case on a catalogued industry --------------------------


def test_u2_unknown_use_case_is_ignored_but_industry_recorded(env):
    store, saves, _ = env

    result = mcp_server.vibe_start_track(TRACK, use_case="bar", industry="travel")

    sid = result.session_id
    row = store[sid]
    # No gate, no brief.
    assert engine.USE_CASE_GATE not in (row.get("completed_gates") or [])
    assert engine.USE_CASE_BRIEF not in (row.get("captured_outputs") or {})
    # The catalogued industry IS recorded (D-15)...
    assert row.get("industry") == "travel"
    assert row.get("industry_label") == "Travel & Hospitality"
    # ...the unknown use case is NOT, neither column nor param.
    assert row.get("use_case") is None
    assert row.get("use_case_label") is None
    assert "use_case" not in (row.get("session_parameters") or {})
    assert _seed(saves, sid)["session_name"] == "Genie Code Workshop"
    # The intent beat then elicits a real pick.
    assert mcp_server.vibe_next_step(sid).root.sectionTag == engine.USE_CASE_GATE


# --- U3: catalogue unavailable -> fail open (today's behavior) ---------------


@pytest.mark.parametrize(
    "industries, use_cases",
    [(_outage, _outage), ([], {})],
    ids=["raises", "empty"],
)
def test_u3_catalogue_unavailable_fails_open(env, industries, use_cases):
    store, saves, catalogue = env
    catalogue(industries, use_cases)

    result = mcp_server.vibe_start_track(TRACK, use_case="bar", industry="foo")

    row = store[result.session_id]
    assert engine.USE_CASE_GATE in row["completed_gates"]
    assert row["industry"] == "foo"
    assert row["use_case"] == "bar"


# --- U4: unknown pair, then a valid curated lock -> resolves normally --------


def test_u4_unknown_pair_then_curated_lock_resolves_gate(env):
    store, _, _ = env

    sid = mcp_server.vibe_start_track(TRACK, use_case="bar", industry="travel").session_id
    assert engine.USE_CASE_GATE not in (store[sid].get("completed_gates") or [])

    locked = mcp_server.vibe_set_parameters(
        sid,
        {
            "industry": "travel",
            "use_case": "booking",
            "use_case_label": "Booking App",
            "use_case_source": "curated",
        },
    )

    assert locked.use_case_resolved is True
    assert engine.USE_CASE_GATE in store[sid]["completed_gates"]
    assert mcp_server.vibe_next_step(sid).root.sectionTag != engine.USE_CASE_GATE


# --- U5: only one of industry / use_case -> unchanged (no resolve) -----------


@pytest.mark.parametrize(
    "kwargs, name",
    [
        ({"industry": "travel"}, "Genie Code Workshop"),
        ({"use_case": "bar"}, "Genie Code — bar"),
    ],
    ids=["industry-only", "use-case-only"],
)
def test_u5_single_arg_is_unchanged(env, kwargs, name):
    store, saves, _ = env

    result = mcp_server.vibe_start_track(TRACK, **kwargs)

    sid = result.session_id
    row = store[sid]
    assert engine.USE_CASE_GATE not in (row.get("completed_gates") or [])
    assert _seed(saves, sid)["session_name"] == name
    for key, value in kwargs.items():
        assert row.get(key) == value


# --- U6: an uncatalogued industry -> neither is written ----------------------


def test_u6_unknown_industry_writes_neither(env):
    store, saves, _ = env

    result = mcp_server.vibe_start_track(TRACK, use_case="bar", industry="foo")

    sid = result.session_id
    row = store[sid]
    assert engine.USE_CASE_GATE not in (row.get("completed_gates") or [])
    assert row.get("industry") is None
    assert row.get("industry_label") is None
    assert row.get("use_case") is None
    params = row.get("session_parameters") or {}
    assert "industry" not in params and "use_case" not in params
    assert _seed(saves, sid)["session_name"] == "Genie Code Workshop"


# --- U7: the unknown pair's row earns no step-1 credit (D-34) ----------------

# Built the way the analytics tests build it
# (tests/workshop/test_completion_keying_aggregations.py: INVERSE = tag_to_global_number()).
_INVERSE = tag_to_global_number()
_INTENT_STEP = 1


def test_u7a_unknown_pair_row_has_no_defined_intent(env):
    store, _, _ = env

    sid = mcp_server.vibe_start_track(TRACK, use_case="bar", industry="travel").session_id
    row = store[sid]

    assert lakebase._has_defined_intent(row) is False
    assert state.has_defined_intent(row) is False


def test_u7b_unknown_pair_row_gets_no_step_1(env):
    store, _, _ = env

    sid = mcp_server.vibe_start_track(TRACK, use_case="bar", industry="travel").session_id
    completed, _skipped = lakebase._row_completion_globals(store[sid], _INVERSE)

    assert _INTENT_STEP not in completed


def test_u7c_known_pair_row_gets_step_1(env):
    # Positive control: U1's known pair has defined intent and earns step 1.
    store, _, _ = env

    sid = mcp_server.vibe_start_track(TRACK, use_case="booking", industry="travel").session_id
    row = store[sid]
    completed, _skipped = lakebase._row_completion_globals(row, _INVERSE)

    assert lakebase._has_defined_intent(row) is True
    assert _INTENT_STEP in completed


# --- U8: resume (session_id) runs the same classification -------------------


def test_u8a_resume_unresolved_unknown_pair_does_not_resolve_gate(env):
    store, saves, _ = env

    sid = mcp_server.vibe_start_track(TRACK).session_id
    assert engine.USE_CASE_GATE not in (store[sid].get("completed_gates") or [])

    result = mcp_server.vibe_start_track(TRACK, session_id=sid, use_case="bar", industry="travel")

    assert result.session_id == sid
    row = store[sid]
    assert engine.USE_CASE_GATE not in (row.get("completed_gates") or [])
    assert engine.USE_CASE_BRIEF not in (row.get("captured_outputs") or {})
    assert "use_case" not in (row.get("session_parameters") or {})
    # Resume seeds no new session.
    assert {s for (s, _fields) in saves} == {sid}
    assert mcp_server.vibe_next_step(sid).root.sectionTag == engine.USE_CASE_GATE


def test_u8b_resume_resolved_unknown_pair_leaves_pick_unchanged(env):
    store, _, _ = env

    sid = mcp_server.vibe_start_track(TRACK, use_case="booking", industry="travel").session_id
    before = copy.deepcopy(store[sid])

    mcp_server.vibe_start_track(TRACK, session_id=sid, use_case="bar", industry="travel")

    row = store[sid]
    assert row["completed_gates"] == before["completed_gates"]
    assert row["captured_outputs"][engine.USE_CASE_BRIEF] == before["captured_outputs"][engine.USE_CASE_BRIEF]
    assert row["use_case"] == before["use_case"] == "booking"
    assert row["session_parameters"]["use_case"] == before["session_parameters"]["use_case"] == "booking"
