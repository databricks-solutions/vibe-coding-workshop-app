import copy
import inspect
import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.workshop import manifest

SESSION_ID = "interaction-session"


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


def _benchmark_ready_gates():
    steps = manifest.load_manifest().track_steps("genie-accelerator")
    benchmark = next(step for step in steps if step.sectionTag == "gagent_benchmarks")
    return [step.sectionTag for step in steps if step.order < benchmark.order]


def test_get_step_exposes_interaction_block_schema(session_store):
    payload = mcp_server.vibe_get_step(SESSION_ID, "project_setup")

    assert payload.interaction is not None
    interaction = payload.interaction["pre"]
    assert interaction is not None
    assert interaction.id
    assert interaction.type in {"comprehension", "decision", "confirm"}
    assert interaction.question
    assert interaction.recommended
    assert interaction.skippable is True
    assert interaction.options
    assert set(interaction.coaching) == {option.id for option in interaction.options}


def test_submit_answer_records_one_row_and_uses_recommended_default(session_store):
    store, saves, interactions = session_store

    result = mcp_server.vibe_submit_answer(SESSION_ID, "project_setup.why", "")

    assert result.recorded is True
    assert result.coaching
    assert result.unblocks is None
    assert len(interactions) == 1
    args, kwargs = interactions[0]
    assert args == ()
    assert kwargs["section_tag"] == "project_setup"
    assert kwargs["interaction_id"] == "project_setup.why"
    assert kwargs["kind"] == "comprehension"
    assert kwargs["answer"] == "governed_first"
    assert kwargs["recommended"] == "governed_first"
    assert kwargs["was_default"] is True
    assert kwargs["coaching_shown"] == result.coaching
    assert saves == []
    assert store[SESSION_ID]["captured_outputs"] == {}


def test_submit_answer_records_decision_and_confirmation_marker(session_store):
    store, _, interactions = session_store
    store[SESSION_ID]["completed_gates"] = _benchmark_ready_gates()

    result = mcp_server.vibe_submit_answer(
        SESSION_ID,
        "gagent_benchmarks.benchmark_confirmation",
        "confirm",
    )

    assert result.recorded is True
    assert result.unblocks == "gagent_benchmarks"
    assert len(interactions) == 1
    assert interactions[0][1]["was_default"] is False
    marker = mcp_server.decision_capture_key(
        "gagent_benchmarks", "gagent_benchmarks.benchmark_confirmation"
    )
    assert store[SESSION_ID]["captured_outputs"][marker] == "confirm"


def test_capabilities_are_in_band_only_and_never_block_a_step(session_store):
    source = inspect.getsource(mcp_server)
    assert "elicitation/create" not in source
    assert "ctx.elicit" not in source

    payload = mcp_server.vibe_get_step(SESSION_ID, "project_setup")
    assert payload.sectionTag == "project_setup"


def test_benchmark_hard_stop_requires_explicit_confirmation(session_store):
    store, _, _ = session_store
    store[SESSION_ID]["completed_gates"] = _benchmark_ready_gates()

    blocked = mcp_server.vibe_complete_step(SESSION_ID, "gagent_benchmarks", "benchmarks")
    assert _error_code(blocked) == "GATE_REQUIRED"

    submitted = mcp_server.vibe_submit_answer(
        SESSION_ID,
        "gagent_benchmarks.benchmark_confirmation",
        "confirm",
    )
    assert submitted.unblocks == "gagent_benchmarks"

    completed = mcp_server.vibe_complete_step(SESSION_ID, "gagent_benchmarks", "benchmarks")
    assert completed.completed_gates[-1] == "gagent_benchmarks"


def test_empty_benchmark_confirmation_does_not_unblock(session_store):
    store, _, _ = session_store
    store[SESSION_ID]["completed_gates"] = _benchmark_ready_gates()

    result = mcp_server.vibe_submit_answer(
        SESSION_ID,
        "gagent_benchmarks.benchmark_confirmation",
        "",
    )

    assert result.recorded is True
    assert result.unblocks is None
    blocked = mcp_server.vibe_complete_step(SESSION_ID, "gagent_benchmarks", "benchmarks")
    assert _error_code(blocked) == "GATE_REQUIRED"


def test_interaction_is_sibling_and_prompt_remains_verbatim(monkeypatch, session_store):
    prompt = "EXACT PROMPT BODY\nDo not rewrite this text."
    monkeypatch.setattr(
        mcp_server.assembler,
        "get_section_input_content",
        lambda **kwargs: {
            "input": prompt,
            "how_to_apply": "how",
            "expected_output": "output",
        },
    )

    payload = mcp_server.vibe_get_step(SESSION_ID, "project_setup")

    assert payload.prompt == prompt
    assert payload.interaction is not None
