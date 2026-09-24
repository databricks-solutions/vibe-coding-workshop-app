"""Phase 2B T4 (D11 §6) — lock + produce for use_case_selection.

D11 turns `use_case_selection` into the step that *locks* the learner's use case
and *produces* the `use_case_brief` consumed by `prd_generation`:

- ``vibe_set_parameters`` persists the selection (industry / use_case / label /
  description) and reports ``missing_required`` per the SetParametersResult
  contract (D11 §3.5, §5).
- ``vibe_complete_step("use_case_selection", brief)`` writes
  ``captured_outputs["use_case_brief"]`` (D11 §3.3).
- ``prd_generation`` renders against the LOCKED use case via the ONE assembler
  seam ``get_section_input_content`` (D11 §3.6, §5).
- ``vibe_complete_step("prd_generation")`` before selection → ``STEP_LOCKED``
  (T1 ``requiresGate`` via the engine gate; D11 §6).
- Custom path: after locking a custom UC via ``vibe_set_parameters`` the learner
  proceeds WITHOUT submitting a ``use_certified`` answer (recommend-and-proceed,
  D11 §3.5) and WITHOUT any write to the community library
  ``saved_usecase_descriptions`` (guardrail / D11 §2.1).
- Certified path still unblocks on ``use_certified``; the generic
  ``gagent_benchmarks`` gate behaviour is UNCHANGED.
"""

import copy
import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.services import lakebase as lakebase_service
from src.backend.workshop import manifest

SESSION_ID = "lock-produce-session"


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


@pytest.fixture
def no_community_writes(monkeypatch):
    """Spy the community-library writers so any call fails the custom-path test."""

    calls = []

    def _forbidden(name):
        def _spy(*args, **kwargs):
            calls.append((name, args, kwargs))
            raise AssertionError(f"community-library write {name} must not be called")

        return _spy

    for name in ("save_usecase_builder_description", "update_saved_usecase"):
        monkeypatch.setattr(lakebase_service, name, _forbidden(name), raising=False)
    return calls


def _error_code(result):
    assert result["isError"] is True
    assert result["content"]
    return result["structuredContent"]["error"]["code"]


def _usecase_block() -> dict:
    block = (manifest.interactions_for("use_case_selection") or {}).get("decision")
    assert isinstance(block, dict)
    return block


# --- D11 §3.5 / §5 — vibe_set_parameters persists the selection --------------


def test_set_parameters_persists_curated_selection(session_store):
    store, saves, _ = session_store

    result = mcp_server.vibe_set_parameters(
        SESSION_ID,
        {
            "industry": "retail",
            "industry_label": "Retail & CPG",
            "use_case": "demand_forecasting",
            "use_case_label": "Demand Forecasting",
            "use_case_source": "curated",
        },
    )

    assert result.missing_required == []
    persisted = store[SESSION_ID]["session_parameters"]
    assert persisted["industry"] == "retail"
    assert persisted["use_case"] == "demand_forecasting"
    assert persisted["use_case_label"] == "Demand Forecasting"
    assert persisted["use_case_source"] == "curated"
    assert saves[-1][1]["session_parameters"] == result.resolved_params


def test_set_parameters_persists_custom_selection_with_description(session_store):
    store, _, _ = session_store

    result = mcp_server.vibe_set_parameters(
        SESSION_ID,
        {
            "industry": "retail",
            "use_case": "curbside_eta",
            "use_case_label": "Curbside Pickup ETA",
            "use_case_source": "custom",
            "use_case_description": "Predict curbside pickup wait times from order + traffic signals.",
        },
    )

    assert result.missing_required == []
    persisted = store[SESSION_ID]["session_parameters"]
    assert persisted["use_case_source"] == "custom"
    assert persisted["use_case_description"].startswith("Predict curbside")


def test_set_parameters_custom_without_description_reports_missing(session_store):
    """A custom UC needs its authored brief before it can lock (D11 §3.3)."""
    _, _, _ = session_store

    result = mcp_server.vibe_set_parameters(
        SESSION_ID,
        {
            "industry": "retail",
            "use_case": "curbside_eta",
            "use_case_label": "Curbside Pickup ETA",
            "use_case_source": "custom",
        },
    )

    assert "use_case_description" in result.missing_required


def test_set_parameters_generic_params_are_unaffected(session_store):
    """Non-selection params keep the plain merge contract (no false missing)."""
    store, _, _ = session_store
    store[SESSION_ID]["session_parameters"] = {"catalog": "main"}

    result = mcp_server.vibe_set_parameters(
        SESSION_ID,
        {"catalog": "analytics", "schema_prefix": "workshop_"},
    )

    assert result.resolved_params == {"catalog": "analytics", "schema_prefix": "workshop_"}
    assert result.missing_required == []


# --- D11 §3.3 — use_case_brief captured on complete --------------------------


def test_complete_use_case_selection_captures_use_case_brief(session_store):
    store, _, _ = session_store
    store[SESSION_ID]["completed_gates"] = ["project_setup"]
    block = _usecase_block()

    # Confirm the certified default (recommend-and-proceed) to pass the gate.
    mcp_server.vibe_submit_answer(SESSION_ID, block["id"], block["recommended"])

    brief = '{"industry":"retail","use_case":"demand_forecasting","source":"curated"}'
    completed = mcp_server.vibe_complete_step(SESSION_ID, "use_case_selection", brief)

    assert completed.completed_gates[-1] == "use_case_selection"
    assert store[SESSION_ID]["captured_outputs"]["use_case_brief"] == brief


# --- D11 §3.6 / §5 — PRD renders against the LOCKED use case -----------------


def test_prd_generation_renders_against_locked_use_case(monkeypatch, session_store):
    store, _, _ = session_store
    store[SESSION_ID]["completed_gates"] = ["project_setup", "use_case_selection"]

    # Lock a specific use case in the session.
    mcp_server.vibe_set_parameters(
        SESSION_ID,
        {
            "industry": "retail",
            "use_case": "demand_forecasting",
            "use_case_label": "Demand Forecasting",
            "use_case_source": "curated",
        },
    )

    seen = {}

    def spy(**kwargs):
        seen.update(kwargs)
        return {"input": "PRD PROMPT", "how_to_apply": "how", "expected_output": "out"}

    monkeypatch.setattr(mcp_server.assembler, "get_section_input_content", spy)

    payload = mcp_server.vibe_get_step(SESSION_ID, "prd_generation")

    assert payload.sectionTag == "prd_generation"
    # The ONE assembler seam received the LOCKED use case, not the default.
    assert seen["industry"] == "retail"
    assert seen["use_case"] == "demand_forecasting"


# --- D11 §6 — prd_generation before selection → STEP_LOCKED ------------------


def test_prd_generation_before_selection_is_step_locked(session_store):
    store, _, _ = session_store
    # Only project_setup is gated; use_case_selection is NOT complete yet.
    store[SESSION_ID]["completed_gates"] = ["project_setup"]

    blocked = mcp_server.vibe_complete_step(SESSION_ID, "prd_generation", "PRD")

    assert isinstance(blocked, dict)
    assert _error_code(blocked) == "STEP_LOCKED"


# --- D11 §3.5 — custom path proceeds after lock (recommend-and-proceed) ------


def test_custom_path_proceeds_after_lock_without_use_certified(session_store, no_community_writes):
    store, _, _ = session_store
    store[SESSION_ID]["completed_gates"] = ["project_setup"]

    # Learner authors + locks a custom UC — no 'use_certified' answer submitted.
    mcp_server.vibe_set_parameters(
        SESSION_ID,
        {
            "industry": "retail",
            "use_case": "curbside_eta",
            "use_case_label": "Curbside Pickup ETA",
            "use_case_source": "custom",
            "use_case_description": "Predict curbside pickup wait times.",
        },
    )

    brief = '{"industry":"retail","use_case":"curbside_eta","source":"custom"}'
    completed = mcp_server.vibe_complete_step(SESSION_ID, "use_case_selection", brief)

    # The lock alone unblocked the gate (no 'use_certified' capture marker).
    assert not isinstance(completed, dict), completed
    assert completed.completed_gates[-1] == "use_case_selection"
    assert store[SESSION_ID]["captured_outputs"]["use_case_brief"] == brief

    # Guardrail #5: custom UC stayed session-local — no community-library write.
    assert no_community_writes == []
    marker = mcp_server.decision_capture_key("use_case_selection", _usecase_block()["id"])
    assert marker not in store[SESSION_ID]["captured_outputs"]


def test_custom_lock_incomplete_does_not_unblock(session_store):
    """A partial custom lock (no description) must NOT satisfy the gate."""
    store, _, _ = session_store
    store[SESSION_ID]["completed_gates"] = ["project_setup"]

    mcp_server.vibe_set_parameters(
        SESSION_ID,
        {
            "industry": "retail",
            "use_case": "curbside_eta",
            "use_case_source": "custom",
        },
    )

    blocked = mcp_server.vibe_complete_step(SESSION_ID, "use_case_selection", "brief")

    assert isinstance(blocked, dict)
    assert _error_code(blocked) == "GATE_REQUIRED"


# --- D11 §6 — certified path still unblocks on 'use_certified' ---------------


def test_certified_path_still_unblocks_on_use_certified(session_store):
    store, _, _ = session_store
    store[SESSION_ID]["completed_gates"] = ["project_setup"]
    block = _usecase_block()

    submitted = mcp_server.vibe_submit_answer(SESSION_ID, block["id"], "use_certified")
    assert submitted.unblocks == "use_case_selection"

    completed = mcp_server.vibe_complete_step(SESSION_ID, "use_case_selection", "brief")
    assert not isinstance(completed, dict), completed
    assert completed.completed_gates[-1] == "use_case_selection"


# --- Scope guard — gagent_benchmarks gate behaviour is UNCHANGED -------------


def test_gagent_benchmarks_gate_unchanged_by_custom_lock(session_store):
    """A locked custom UC must not leak into the gagent_benchmarks gate."""
    store, _, _ = session_store
    # Pretend the learner has walked up to gagent_benchmarks with a custom UC
    # locked in the session — the benchmark gate must STILL require its confirm.
    benchmark_gates = [
        step.sectionTag
        for step in manifest.load_manifest().track_steps("genie-accelerator")
    ]
    prerequisites = benchmark_gates[: benchmark_gates.index("gagent_benchmarks")]
    store[SESSION_ID]["completed_gates"] = prerequisites
    store[SESSION_ID]["session_parameters"] = {
        "use_case_source": "custom",
        "use_case": "curbside_eta",
        "use_case_description": "Predict curbside pickup wait times.",
    }

    blocked = mcp_server.vibe_complete_step(SESSION_ID, "gagent_benchmarks", "answers")

    assert isinstance(blocked, dict)
    assert _error_code(blocked) == "GATE_REQUIRED"
