"""Skip-gate semantics (Phase 3) — a skipped step's gate unlocks its successor,
and server-owned parameter keys cannot be injected through ``vibe_set_parameters``.

Context: ``vibe_set_parameters`` merges arbitrary keys into ``session_parameters``
(``state.session_parameters.update(params)``). A soak run left a genie-accelerator
session with ``skipped_gates=[semlayer_measures]`` and the five earlier gates
complete, but ``can_start`` honoured only ``completed_gates`` — so the successor
step (``semlayer_metric_view``) never became ``current`` and ``next_step`` returned
a false ``Done``. The same merge path could also set ``skipped_gates`` /
``custom_draft_ready`` directly and defeat the gate ledger.

Two fixes, pinned here:

1. ``engine.can_start`` — a gate is satisfied when it was skipped AND it names a
   step in THIS session's ordered outline. A non-outline gate
   (``use_case_selection``, resolved pre-journey, never an outline node) can still
   only be satisfied by real completion.
2. ``vibe_set_parameters`` — reject the server-owned keys
   (``skipped_gates``, ``custom_draft_ready``, ``custom_drafted_description``) in
   the incoming ``params`` BEFORE any update/save (all-or-nothing).

Both-direction tampers (each must flip a green test to red):
- revert the ``can_start`` widening → the ``test_soak_repro_*`` tests fail.
- drop the outline-membership condition → the ``test_non_step_gate_*`` tests fail
  (a stray ``use_case_selection`` skip would then unlock ``prd_generation``).
- remove any one key from ``_RESERVED_PARAM_KEYS`` → that key's rejection test fails.
- move the reserved guard after update/save → ``test_reserved_*_all_or_nothing``
  fails (a ``save_session`` fires / the store mutates).
"""

import copy
import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.workshop import engine

TRACK = "genie-accelerator"
SESSION_ID = "skip-gate-session"

# The soak repro ledger: use_case_selection resolved pre-journey, then the first
# four numbered gates, with the hybrid ``semlayer_measures`` step skipped.
SOAK_GATES = [
    "use_case_selection",
    "project_setup",
    "prd_generation",
    "semlayer_locate",
    "semlayer_profile",
]


def _session(gates=None, params=None, outputs=None):
    return engine.SessionState(
        completed_gates=list(gates or []),
        captured_outputs=dict(outputs or {}),
        session_parameters=dict(params or {}),
    )


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
    assert isinstance(result, dict), f"expected a contract error dict, got {type(result)}"
    assert result["isError"] is True
    assert result["content"]
    return result["structuredContent"]["error"]["code"]


# --- 1. engine.can_start: a skipped step's gate unlocks its successor ---------


def test_soak_repro_skipped_gate_unlocks_successor_in_outline():
    session = _session(SOAK_GATES, {"skipped_gates": ["semlayer_measures"]})
    statuses = {item.sectionTag: item.status for item in engine.outline(TRACK, session)}
    assert statuses["semlayer_measures"] == "skipped"
    current = [tag for tag, status in statuses.items() if status == "current"]
    assert current == ["semlayer_metric_view"]


def test_soak_repro_next_step_is_the_successor_not_done():
    session = _session(SOAK_GATES, {"skipped_gates": ["semlayer_measures"]})
    nxt = engine.next_step(TRACK, session)
    assert not isinstance(nxt, engine.Done)
    assert nxt.sectionTag == "semlayer_metric_view"


def test_soak_repro_engine_complete_step_succeeds():
    session = _session(SOAK_GATES, {"skipped_gates": ["semlayer_measures"]})
    result = engine.complete_step(TRACK, session, "semlayer_metric_view", "mv")
    assert result.ok
    assert "semlayer_metric_view" in session.completed_gates


def test_soak_repro_vibe_complete_step_path_succeeds(session_store):
    store, _ = session_store
    store[SESSION_ID]["completed_gates"] = list(SOAK_GATES)
    store[SESSION_ID]["session_parameters"] = {"skipped_gates": ["semlayer_measures"]}

    result = mcp_server.vibe_complete_step(SESSION_ID, "semlayer_metric_view", "mv")

    assert not isinstance(result, dict), f"unexpected contract error: {result}"
    assert "semlayer_metric_view" in result.completed_gates
    assert store[SESSION_ID]["completed_gates"][-1] == "semlayer_metric_view"


# --- 2. a non-outline (pre-journey) gate is NOT skip-satisfiable --------------


def test_non_step_gate_skip_does_not_unlock_prd_generation():
    # use_case_selection is resolved pre-journey — never a step in the ordered
    # outline — so a stray skip entry must not satisfy prd_generation's gate.
    session = _session(["project_setup"], {"skipped_gates": ["use_case_selection"]})
    statuses = {item.sectionTag: item.status for item in engine.outline(TRACK, session)}
    assert statuses["prd_generation"] != "current"

    prd = next(s for s in engine.MANIFEST.track_steps(TRACK) if s.sectionTag == "prd_generation")
    outline_tags = {s.sectionTag for s in engine._ordered_steps(TRACK, session)}
    assert engine.can_start(prd, session, outline_tags) is False


def test_non_step_gate_skip_rejects_completing_prd_generation():
    session = _session(["project_setup"], {"skipped_gates": ["use_case_selection"]})
    result = engine.complete_step(TRACK, session, "prd_generation", "prd")
    assert not result.ok
    assert result.error_code == "STEP_LOCKED"


# --- 3. vibe_set_parameters rejects server-owned keys (all-or-nothing) --------

RESERVED = ["skipped_gates", "skippedSteps", "custom_draft_ready", "custom_drafted_description"]


@pytest.mark.parametrize("key", RESERVED)
def test_reserved_param_key_is_rejected(session_store, key):
    store, saves = session_store
    before = dict(store[SESSION_ID]["session_parameters"])

    result = mcp_server.vibe_set_parameters(SESSION_ID, {key: "x"})

    assert _error_code(result) == "INVALID_PARAMETER"
    # Nothing persisted — the guard returns before any update/save.
    assert store[SESSION_ID]["session_parameters"] == before
    assert saves == []


@pytest.mark.parametrize("key", RESERVED)
def test_reserved_param_key_rejects_whole_call_all_or_nothing(session_store, key):
    store, saves = session_store

    result = mcp_server.vibe_set_parameters(
        SESSION_ID, {key: "x", "chapter_3_lakehouse_catalog": "main"}
    )

    assert _error_code(result) == "INVALID_PARAMETER"
    # The co-submitted ordinary param did NOT persist either.
    assert "chapter_3_lakehouse_catalog" not in store[SESSION_ID]["session_parameters"]
    assert saves == []


# --- 4. the camelCase skippedSteps alias cannot forge a skip (amendment) ------
# engine._skipped_tags still falls back to session_parameters["skippedSteps"] when
# "skipped_gates" is absent (a dead legacy read, no writer — deliberately kept).
# Pre-widening that write was display-only; the widened can_start would otherwise
# turn it into a real self-skip bypass over MCP, so it is a reserved key too.
# (test_reserved_param_key_* above already parametrize "skippedSteps".)
# TAMPER: remove "skippedSteps" from _RESERVED_PARAM_KEYS → this test and the
# parametrized skippedSteps rejection both fail.


def test_skipped_steps_alias_cannot_change_the_engine_current_step(session_store):
    store, _ = session_store
    # MCP-only soak row with NO skipped_gates key: current sits at semlayer_measures.
    store[SESSION_ID]["completed_gates"] = list(SOAK_GATES)
    store[SESSION_ID]["session_parameters"] = {}

    def _current_tag():
        record = store[SESSION_ID]
        state = engine.SessionState(
            completed_gates=list(record["completed_gates"]),
            captured_outputs={},
            session_parameters=dict(record["session_parameters"]),
        )
        return engine.next_step(TRACK, state).sectionTag

    before = _current_tag()
    result = mcp_server.vibe_set_parameters(SESSION_ID, {"skippedSteps": ["semlayer_measures"]})
    after = _current_tag()

    assert _error_code(result) == "INVALID_PARAMETER"
    # The rejected alias write did not move the walk off semlayer_measures.
    assert before == after == "semlayer_measures"


# --- 5. vibe_get_step agrees with vibe_next_step after a web skip (fold-in) ---
# TAMPER: drop the outline tags at the vibe_get_step can_start call → this fails
# (the explicit lookup falsely reports STEP_LOCKED while vibe_next_step opens it).


def test_vibe_get_step_not_locked_for_successor_after_web_skip(session_store, monkeypatch):
    store, _ = session_store
    store[SESSION_ID]["completed_gates"] = list(SOAK_GATES)
    store[SESSION_ID]["session_parameters"] = {"skipped_gates": ["semlayer_measures"]}
    # Stub the assembler seam so _step_payload renders without an FMAPI/data call.
    monkeypatch.setattr(
        mcp_server.assembler,
        "get_section_input_content",
        lambda **kwargs: {"input": "PROMPT", "user_trigger_prompt": "GO"},
    )

    payload = mcp_server.vibe_get_step(SESSION_ID, "semlayer_metric_view")

    assert not isinstance(payload, dict), f"unexpected STEP_LOCKED / error: {payload}"
    assert payload.sectionTag == "semlayer_metric_view"
