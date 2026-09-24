"""Phase 2B T3 (D11 §6) — the use_case_selection blocking-interaction gate.

D11 makes `use_case_selection` a hard stop: `vibe_complete_step` must refuse with
a structured `GATE_REQUIRED` error until the learner confirms their use-case
selection via `vibe_submit_answer`. This reuses the EXISTING generic blocking
machinery (`manifest.blocking_interactions` + `decision_capture_key`, mirroring
`gagent_benchmarks`) — no new tool, no `mcp_server.py` change. The gate is authored
purely as a `type="confirm"`, `skippable=false` block in `interactions.json`.

Recommend-and-proceed (D5 §3): the certified use case is the stated `recommended`
default; confirming it (answer == recommended) unblocks the step.
"""

import copy
import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.workshop import manifest

SESSION_ID = "usecase-gate-session"


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
        mcp_server,
        "append_session_interaction",
        append_session_interaction,
        raising=False,
    )
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: True)
    return store, saves, interactions


def _error_code(result):
    assert result["isError"] is True
    return result["structuredContent"]["error"]["code"]


def _usecase_block() -> dict:
    """The authored use_case_selection interaction block (decision slot)."""
    blocks = manifest.interactions_for("use_case_selection")
    assert blocks is not None, "use_case_selection has no authored interaction block"
    block = blocks.get("decision")
    assert isinstance(block, dict), "expected a decision-slot interaction block"
    return block


# --- D11 §6 test 1: GATE_REQUIRED before any confirmation -------------------


def test_complete_step_gate_required_before_confirmation(session_store):
    store, _, _ = session_store
    # Positioned at use_case_selection (project_setup already gated).
    store[SESSION_ID]["completed_gates"] = ["project_setup"]

    blocked = mcp_server.vibe_complete_step(SESSION_ID, "use_case_selection", "brief")

    # A STRUCTURED isError, not a protocol exception (in-band only).
    assert isinstance(blocked, dict)
    assert _error_code(blocked) == "GATE_REQUIRED"


# --- D11 §6 test 2: confirming (answer == recommended) unblocks + advances ---


def test_confirmation_unblocks_and_completes_the_step(session_store):
    store, _, _ = session_store
    store[SESSION_ID]["completed_gates"] = ["project_setup"]
    block = _usecase_block()

    submitted = mcp_server.vibe_submit_answer(SESSION_ID, block["id"], block["recommended"])
    assert submitted.unblocks == "use_case_selection"

    # The decision marker the generic gate looks for is now present.
    marker = mcp_server.decision_capture_key("use_case_selection", block["id"])
    assert store[SESSION_ID]["captured_outputs"][marker] == block["recommended"]

    completed = mcp_server.vibe_complete_step(SESSION_ID, "use_case_selection", "brief")
    assert completed.completed_gates[-1] == "use_case_selection"


# --- D11 §6 test 3: step payload carries the block; prompt stays verbatim ----


def test_step_payload_carries_interaction_and_verbatim_prompt(monkeypatch, session_store):
    store, _, _ = session_store
    store[SESSION_ID]["completed_gates"] = ["project_setup"]

    prompt = "VERBATIM USE-CASE STEP PROMPT\nDo not rewrite or paraphrase this text."
    monkeypatch.setattr(
        mcp_server.assembler,
        "get_section_input_content",
        lambda **kwargs: {
            "input": prompt,
            "how_to_apply": "how",
            "expected_output": "output",
        },
    )

    payload = mcp_server.vibe_get_step(SESSION_ID, "use_case_selection")

    assert payload.sectionTag == "use_case_selection"
    # The interaction never rewrites the step prompt — presented verbatim.
    assert payload.prompt == prompt

    assert payload.interaction is not None
    interaction = payload.interaction["decision"]
    assert interaction is not None
    assert interaction.type == "confirm"
    assert interaction.skippable is False
    assert interaction.recommended
    # Decision text is carried through verbatim from the authored block.
    assert interaction.question == _usecase_block()["question"]


# --- D11 §6 test 4: recommend-and-proceed — certified is the stated default --


def test_recommended_default_is_the_certified_use_case(session_store):
    block = _usecase_block()

    assert block["type"] == "confirm"
    assert block["skippable"] is False

    option_ids = {option["id"] for option in block["options"]}
    # Options must offer the certified/curated use case AND an author-your-own path.
    assert "use_certified" in option_ids
    assert "author_own" in option_ids

    # The certified use case is the stated recommended default (recommend-and-proceed).
    assert block["recommended"] == "use_certified"
    assert block["recommended"] in option_ids

    # It is a genuine blocking interaction under the generic machinery.
    blocking = manifest.blocking_interactions("use_case_selection")
    assert [b["id"] for b in blocking] == [block["id"]]
