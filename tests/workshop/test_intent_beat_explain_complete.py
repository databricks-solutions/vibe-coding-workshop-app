"""vibe_explain_step and vibe_complete_step agree with get/next on the intent beat.

On a fresh session vibe_next_step / vibe_get_step surface the pre-journey intent
beat (``use_case_selection``, not a manifest step of the default track). These pin
the two remaining surfaces to that beat:

  - E1–E4: vibe_explain_step resolves the beat the same way vibe_get_step does,
    with help from the same assembler row (section_tag ``use_case_selection``).
  - C1–C2: vibe_complete_step(use_case_selection) is an idempotent success once the
    use case is locked, and GATE_REQUIRED steering to vibe_set_parameters while it
    is unlocked — never UNKNOWN_STEP (D-8).

Tampers (each flips its own test red; run manually, restore clean):
- **T1** drop the beat branch in ``vibe_explain_step`` ->
  ``test_explain_default_on_fresh_session_is_the_beat`` fails.
- **T2** drop the resolved idempotent branch in ``vibe_complete_step`` ->
  ``test_complete_after_lock_is_idempotent_success`` fails.
- **T3** drop the unresolved GATE_REQUIRED fallback in ``vibe_complete_step`` ->
  ``test_complete_confirmed_but_unlocked_is_gate_required`` fails.
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

SESSION_ID = "intent-beat-session"
BEAT = "use_case_selection"
BEAT_HOW = "Pick a curated use case or author your own."
BEAT_EXPECTED = "A locked use case brief."

CURATED_LOCK = {
    "industry": "retail",
    "use_case": "demand_forecasting",
    "use_case_label": "Demand Forecasting",
    "use_case_source": "curated",
}


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


@pytest.fixture
def assembler_calls(monkeypatch):
    """Serve the beat's row (958) by section_tag, recording every lookup."""

    calls = []

    def get_section_input_content(**kwargs):
        calls.append(kwargs["section_tag"])
        if kwargs["section_tag"] == BEAT:
            return {
                "input": "beat prompt",
                "how_to_apply": BEAT_HOW,
                "expected_output": BEAT_EXPECTED,
                "user_trigger_prompt": "Help me pick my use case.",
            }
        return {"input": "other", "how_to_apply": "other how", "expected_output": "other out"}

    monkeypatch.setattr(mcp_server.assembler, "get_section_input_content", get_section_input_content)
    return calls


def _error(result):
    assert result["isError"] is True, f"expected an error, got {result!r}"
    return result["structuredContent"]["error"]


def _lock(store):
    result = mcp_server.vibe_set_parameters(SESSION_ID, dict(CURATED_LOCK))
    assert result.use_case_resolved is True
    assert BEAT in store[SESSION_ID]["completed_gates"]


# --- E1–E4: vibe_explain_step on the beat ------------------------------------


def test_explain_default_on_fresh_session_is_the_beat(session_store, assembler_calls):
    result = mcp_server.vibe_explain_step(SESSION_ID)

    assert result.sectionTag == BEAT
    assert result.title == "Define Your Use Case"
    assert result.how_to_apply == BEAT_HOW
    assert result.expected_output == BEAT_EXPECTED
    assert assembler_calls == [BEAT]


def test_explain_beat_by_tag_before_and_after_lock(session_store, assembler_calls):
    store, _saves, _interactions = session_store

    before = mcp_server.vibe_explain_step(SESSION_ID, BEAT)
    assert before.sectionTag == BEAT
    assert before.how_to_apply == BEAT_HOW

    _lock(store)
    after = mcp_server.vibe_explain_step(SESSION_ID, BEAT)
    assert after.sectionTag == BEAT
    assert after.title == "Define Your Use Case"
    assert after.how_to_apply == BEAT_HOW


def test_explain_default_after_lock_is_project_setup(session_store, assembler_calls):
    store, _saves, _interactions = session_store
    _lock(store)

    result = mcp_server.vibe_explain_step(SESSION_ID)

    assert result.sectionTag == "project_setup"
    assert "✅" in result.expected_output  # the synthesized setup content, unchanged


def test_get_and_explain_agree_on_the_beat(session_store, assembler_calls):
    got = mcp_server.vibe_get_step(SESSION_ID)
    explained = mcp_server.vibe_explain_step(SESSION_ID)

    assert got.sectionTag == explained.sectionTag == BEAT
    assert got.title == explained.title
    assert got.why == explained.why
    # Both read the same assembler row; explain serves that row's help.
    assert set(assembler_calls) == {BEAT}
    assert explained.how_to_apply == BEAT_HOW


# --- C1–C2: vibe_complete_step on the beat -----------------------------------


def test_complete_after_lock_is_idempotent_success(session_store, assembler_calls):
    store, saves, _interactions = session_store
    _lock(store)  # curated lock, NO confirm marker recorded
    gates = list(store[SESSION_ID]["completed_gates"])
    store_before = copy.deepcopy(store[SESSION_ID])
    saves.clear()

    result = mcp_server.vibe_complete_step(SESSION_ID, BEAT, "brief")

    assert isinstance(result, mcp_server.CompleteStepResult), f"unexpected: {result!r}"
    assert result.completed_gates == gates
    assert result.next.sectionTag == "project_setup"
    assert result.post_check is None
    assert saves == []
    assert store[SESSION_ID] == store_before


def test_complete_confirmed_but_unlocked_is_gate_required(session_store):
    store, saves, _interactions = session_store
    block = manifest.interactions_for(BEAT)["decision"]
    marker = mcp_server.decision_capture_key(BEAT, block["id"])
    store[SESSION_ID]["captured_outputs"] = {marker: block["recommended"]}
    store_before = copy.deepcopy(store[SESSION_ID])

    result = mcp_server.vibe_complete_step(SESSION_ID, BEAT, "brief")

    error = _error(result)
    assert error["code"] == "GATE_REQUIRED"
    assert "vibe_set_parameters" in error["message"]
    assert error["sectionTag"] == BEAT
    assert saves == []
    assert store[SESSION_ID] == store_before
