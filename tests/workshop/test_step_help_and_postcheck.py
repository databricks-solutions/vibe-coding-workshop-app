"""Anchor the per-step ceremony against client drift.

Three coupled changes are pinned here:

  1. The MCP step payload is deliberately SLIM — ``how_to_apply`` and
     ``expected_output`` are gone from ``ExplainabilityPayload`` (they inflated
     context and let the client drop the trigger/wait ritual on later steps), so
     the trigger + wait directive stay salient.
  2. ``vibe_explain_step`` serves that help ON DEMAND, only when the learner asks.
  3. ``vibe_complete_step`` re-surfaces the just-completed step's ``post``
     comprehension (answer key redacted) as an advisory reminder, suppressed once
     the learner has answered it (marker recorded by ``vibe_submit_answer``).
"""

import copy
import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server  # noqa: E402
from src.backend.workshop import manifest  # noqa: E402

SESSION_ID = "help-postcheck-session"
TAG = "prd_generation"


@pytest.fixture
def session_store(monkeypatch):
    store = {
        SESSION_ID: {
            "session_id": SESSION_ID,
            "created_by": None,
            "workshop_level": "genie-accelerator",
            "completed_gates": [],
            "captured_outputs": {},
            "session_parameters": {},
        }
    }
    saves = []
    interactions = []

    def load_session(session_id):
        record = store.get(session_id)
        return copy.deepcopy(record) if record is not None else None

    def save_session(session_id, **fields):
        saves.append((session_id, copy.deepcopy(fields)))
        store.setdefault(session_id, {"session_id": session_id}).update(copy.deepcopy(fields))
        return True

    def append_session_interaction(*args, **kwargs):
        interactions.append((args, kwargs))
        return True

    monkeypatch.setattr(mcp_server, "load_session", load_session)
    monkeypatch.setattr(mcp_server, "save_session", save_session)
    monkeypatch.setattr(
        mcp_server, "append_session_interaction", append_session_interaction, raising=False
    )
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: True)
    return store, saves, interactions


def _step(section_tag):
    steps = mcp_server.engine.MANIFEST.track_steps(mcp_server.DEFAULT_TRACK)
    step = next((s for s in steps if s.sectionTag == section_tag), None)
    assert step is not None, section_tag
    return step


def _gates_before(section_tag):
    steps = manifest.load_manifest().track_steps(mcp_server.DEFAULT_TRACK)
    target = next(s for s in steps if s.sectionTag == section_tag)
    # Option A: the use case is resolved PRE-JOURNEY (before any numbered step), so
    # a session positioned on a numbered step carries the use_case_selection gate —
    # which prd_generation.requiresGate depends on. It is not itself a numbered step.
    return ["use_case_selection"] + [s.sectionTag for s in steps if s.order < target.order]


# --- 1. Slim payload ---------------------------------------------------------


def test_explainability_payload_has_no_help_fields():
    fields = mcp_server.ExplainabilityPayload.model_fields
    assert "how_to_apply" not in fields
    assert "expected_output" not in fields


def test_step_payload_omits_help_but_keeps_trigger_and_instruction(monkeypatch):
    monkeypatch.setattr(
        mcp_server.assembler,
        "get_section_input_content",
        lambda **kwargs: {
            "input": "body",
            "how_to_apply": "SHOULD NOT SHIP",
            "expected_output": "SHOULD NOT SHIP",
            "user_trigger_prompt": "Let's create the PRD for my app.",
        },
    )
    payload = mcp_server._step_payload(
        mcp_server.DEFAULT_TRACK, mcp_server.engine.SessionState(), _step(TAG)
    )
    dumped = payload.model_dump()
    assert "how_to_apply" not in dumped
    assert "expected_output" not in dumped
    assert payload.user_trigger_prompt == "Let's create the PRD for my app."
    assert payload.instruction == mcp_server.STEP_WAIT_DIRECTIVE


# --- 2. vibe_explain_step ----------------------------------------------------


def test_vibe_explain_step_returns_help_on_demand(session_store, monkeypatch):
    monkeypatch.setattr(
        mcp_server.assembler,
        "get_section_input_content",
        lambda **kwargs: {
            "input": "body",
            "how_to_apply": "Paste the prompt into a new agent chat.",
            "expected_output": "A docs/design_prd.md is produced.",
            "user_trigger_prompt": "trigger",
        },
    )
    result = mcp_server.vibe_explain_step(SESSION_ID, TAG)
    assert result.sectionTag == TAG
    assert result.how_to_apply == "Paste the prompt into a new agent chat."
    assert result.expected_output == "A docs/design_prd.md is produced."
    assert result.title == "PRD Generation"  # sourced from the manifest step
    assert isinstance(result.why, str)


def test_vibe_explain_step_project_setup_uses_setup_content(session_store):
    result = mcp_server.vibe_explain_step(SESSION_ID, "project_setup")
    assert result.sectionTag == "project_setup"
    assert "✅" in result.expected_output  # the two-green-checks validate step
    assert "Genie Code" in result.how_to_apply


def test_vibe_explain_step_unknown_section_errors(session_store):
    result = mcp_server.vibe_explain_step(SESSION_ID, "no_such_section")
    assert result["isError"] is True
    assert result["structuredContent"]["error"]["code"] == "UNKNOWN_STEP"


# --- 3. Post-check reminder helper -------------------------------------------


def test_pending_post_check_returns_redacted_quiz():
    state = mcp_server.engine.SessionState()
    check = mcp_server._pending_post_check(TAG, state)
    assert check is not None
    assert check.id == "prd_generation.check"
    assert check.type == "comprehension"
    # Answer key redacted so the agent cannot front-run it.
    assert check.recommended is None
    assert check.coaching == {}
    assert len(check.options) == 2


def test_pending_post_check_suppressed_once_answered():
    state = mcp_server.engine.SessionState()
    state.captured_outputs[
        mcp_server.interaction_answered_key(TAG, "prd_generation.check")
    ] = "context_spine"
    assert mcp_server._pending_post_check(TAG, state) is None


def test_pending_post_check_none_when_no_post():
    state = mcp_server.engine.SessionState()
    assert mcp_server._pending_post_check("no_such_section", state) is None


# --- 4. Wiring: completion surfaces it; submit records the suppression marker -


def test_vibe_complete_step_surfaces_post_check(session_store):
    store, _saves, _interactions = session_store
    store[SESSION_ID]["completed_gates"] = _gates_before(TAG)
    store[SESSION_ID]["session_parameters"] = {"industry": "retail", "use_case": "curbside_eta"}

    result = mcp_server.vibe_complete_step(SESSION_ID, TAG, "PRD captured")

    assert result.completed_gates[-1] == TAG
    assert result.post_check is not None
    assert result.post_check.id == "prd_generation.check"
    assert result.post_check.recommended is None  # redacted


def test_vibe_submit_answer_records_post_comprehension_marker(session_store):
    store, _saves, _interactions = session_store
    # Position on prd_generation so its POST comprehension (prd_generation.check)
    # is the current interaction; answering it records the suppression marker.
    store[SESSION_ID]["completed_gates"] = _gates_before(TAG)
    store[SESSION_ID]["session_parameters"] = {"industry": "retail", "use_case": "curbside_eta"}

    result = mcp_server.vibe_submit_answer(SESSION_ID, "prd_generation.check", "")
    assert result.recorded is True
    marker = mcp_server.interaction_answered_key(TAG, "prd_generation.check")
    assert marker in store[SESSION_ID]["captured_outputs"]


def test_vibe_submit_answer_pre_check_does_not_write_captured_outputs(session_store):
    store, saves, _interactions = session_store
    # A pre-slot comprehension (project_setup.why) must NOT touch captured_outputs
    # — the suppression marker is scoped to the post slot only.
    result = mcp_server.vibe_submit_answer(SESSION_ID, "project_setup.why", "")
    assert result.recorded is True
    assert store[SESSION_ID]["captured_outputs"] == {}
    assert saves == []


# --- 5. A completed step's post check stays answerable -----------------------
# vibe_complete_step surfaces the JUST-completed step's post check, but the engine
# has already moved on, so that step is no longer the current one.


def _complete_prd(store):
    store[SESSION_ID]["completed_gates"] = _gates_before(TAG)
    store[SESSION_ID]["session_parameters"] = {"industry": "retail", "use_case": "curbside_eta"}
    result = mcp_server.vibe_complete_step(SESSION_ID, TAG, "PRD captured")
    assert result.post_check is not None and result.post_check.id == "prd_generation.check"
    state, _ = mcp_server._load_session_for_request(SESSION_ID)
    current = mcp_server.engine.next_step(mcp_server.DEFAULT_TRACK, state)
    assert getattr(current, "sectionTag", None) != TAG  # the engine moved past prd_generation


def _assert_rejected(result, store_before, store, interactions):
    assert result["isError"] is True
    assert result["structuredContent"]["error"]["code"] == "UNKNOWN_INTERACTION"
    assert interactions == []
    assert store[SESSION_ID] == store_before


def test_post_check_answerable_after_completing_the_step(session_store):
    store, saves, interactions = session_store
    _complete_prd(store)
    gates_after_complete = list(store[SESSION_ID]["completed_gates"])
    saves.clear()

    result = mcp_server.vibe_submit_answer(SESSION_ID, "prd_generation.check", "")

    assert result.recorded is True
    assert len(interactions) == 1
    marker = mcp_server.interaction_answered_key(TAG, "prd_generation.check")
    assert marker in store[SESSION_ID]["captured_outputs"]
    # Only the answered marker is written; completed_gates are never touched.
    assert [set(fields) for _sid, fields in saves] == [{"captured_outputs"}]
    assert store[SESSION_ID]["completed_gates"] == gates_after_complete


def test_post_check_answerable_after_a_later_step_completes(session_store):
    # D-6: ANY completed step's post check is answerable, not only the most recent
    # one, so a learner can answer late. Restricting the condition to
    # completed_gates[-1] flips this red.
    store, _saves, _interactions = session_store
    _complete_prd(store)
    state, _ = mcp_server._load_session_for_request(SESSION_ID)
    later = mcp_server.engine.next_step(mcp_server.DEFAULT_TRACK, state)
    assert isinstance(later, manifest.Step), later
    completed = mcp_server.vibe_complete_step(SESSION_ID, later.sectionTag, "later output")
    assert isinstance(completed, mcp_server.CompleteStepResult), completed
    assert store[SESSION_ID]["completed_gates"][-1] == later.sectionTag != TAG

    result = mcp_server.vibe_submit_answer(SESSION_ID, "prd_generation.check", "")

    assert result.recorded is True


def test_post_check_not_resurfaced_once_answered_after_complete(session_store):
    store, _saves, _interactions = session_store
    _complete_prd(store)
    mcp_server.vibe_submit_answer(SESSION_ID, "prd_generation.check", "")

    state = mcp_server.engine.SessionState(
        captured_outputs=dict(store[SESSION_ID]["captured_outputs"])
    )
    assert mcp_server._pending_post_check(TAG, state) is None


def test_completed_step_pre_interaction_still_unknown(session_store):
    store, _saves, interactions = session_store
    _complete_prd(store)  # project_setup is completed and no longer current
    assert "project_setup" in store[SESSION_ID]["completed_gates"]
    store_before = copy.deepcopy(store[SESSION_ID])

    result = mcp_server.vibe_submit_answer(SESSION_ID, "project_setup.why", "")

    _assert_rejected(result, store_before, store, interactions)


def test_completed_step_confirm_interaction_still_unknown(session_store, monkeypatch):
    store, _saves, interactions = session_store
    _complete_prd(store)
    store_before = copy.deepcopy(store[SESSION_ID])
    # Every shipped post slot is a comprehension, so place a confirm interaction in a
    # completed step's post slot to pin the type guard on its own.
    confirm = mcp_server.Interaction.model_validate(
        manifest.load_interactions()["use_case_selection"]["decision"]
    )
    assert confirm.type == "confirm"
    monkeypatch.setattr(
        mcp_server, "_find_interaction", lambda _id: (TAG, "post", confirm)
    )

    result = mcp_server.vibe_submit_answer(SESSION_ID, confirm.id, confirm.recommended or "")

    _assert_rejected(result, store_before, store, interactions)


def test_uncompleted_non_current_post_check_still_unknown(session_store):
    store, _saves, interactions = session_store
    # Positioned ON prd_generation: genie_silver_metadata is neither current nor
    # completed, so its post check is not answerable yet.
    store[SESSION_ID]["completed_gates"] = _gates_before(TAG)
    store[SESSION_ID]["session_parameters"] = {"industry": "retail", "use_case": "curbside_eta"}
    assert "genie_silver_metadata" not in store[SESSION_ID]["completed_gates"]
    store_before = copy.deepcopy(store[SESSION_ID])

    result = mcp_server.vibe_submit_answer(SESSION_ID, "genie_silver_metadata.check", "")

    _assert_rejected(result, store_before, store, interactions)
