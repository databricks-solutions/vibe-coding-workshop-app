"""Regression pins for retiring the numbered step-70 use_case_selection ghost.

use_case_selection was a numbered outline step (step 70) that rendered as a
done-but-empty GHOST inside FOUNDATION > Project Setup on a resumed genie-code
session (WorkflowDiagram has no case 70 -> default:null). Option A retires it as a
numbered step on both surfaces and captures the use case as a PRE-JOURNEY intent
beat resolved up front, mirroring the App's step 1 "Define Your Intent".

These pins guard the two risk-bearing invariants of that change:

  * Guardrail #3 — a fresh Genie Code learner who did NOT pre-pick is STILL asked
    once, UP FRONT, before the first numbered step, and locking records the use
    case (the gate + the use_case_brief). Removing the numbered node must NOT
    remove the elicitation, only its position/duplication.
  * Non-negotiable #6 — an EXISTING session carrying a persisted use_case_selection
    gate keeps advancing: it is NOT re-elicited and prd_generation stays unlocked
    (the gate still resolves the PRD chain).
"""

import copy
import json
import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.api import routes
from src.backend.workshop import engine, manifest

SESSION_ID = "ghost-retirement-session"


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
    monkeypatch.setattr(mcp_server, "append_session_interaction", lambda **k: True, raising=False)
    # Deterministic, offline industry validation for the lock path.
    monkeypatch.setattr(
        routes,
        "get_use_cases_map",
        lambda: {"retail": [{"value": "demand_forecasting", "label": "Demand Forecasting", "is_certified": True}]},
        raising=True,
    )
    # Keep the beat payload offline: the assembler + FMAPI are exercised elsewhere.
    monkeypatch.setattr(
        mcp_server.assembler,
        "get_section_input_content",
        lambda **kwargs: {"input": "PICK YOUR USE CASE", "how_to_apply": "h", "expected_output": "o", "user_trigger_prompt": "trigger"},
    )
    monkeypatch.setattr(mcp_server, "_generate_step_prompt", lambda **kwargs: None)
    return store, saves


# --- The ghost is gone from the numbered outline -----------------------------


def test_use_case_selection_is_not_a_numbered_step():
    """The retired step is a numbered node on NO track (belt-and-braces alongside
    the manifest-parity contract)."""
    loaded = manifest.load_manifest()
    for track_id in loaded.tracks:
        tags = [step.sectionTag for step in loaded.track_steps(track_id)]
        assert "use_case_selection" not in tags, track_id


# --- Guardrail #3: a fresh walk still elicits + records the use case up front --


def test_fresh_walk_elicits_use_case_before_the_first_numbered_step(session_store):
    store, _ = session_store

    # A fresh Genie Code walk surfaces the pre-journey intent beat BEFORE the first
    # numbered step (project_setup), carrying the picker interaction + industries.
    beat = mcp_server.vibe_next_step(SESSION_ID).root
    assert beat.sectionTag == "use_case_selection"
    assert beat.next.sectionTag == "project_setup"
    assert beat.interaction is not None
    assert beat.available_industries is not None

    # vibe_get_step with no sectionTag also lands on the beat while unresolved.
    assert mcp_server.vibe_get_step(SESSION_ID).sectionTag == "use_case_selection"


def test_locking_the_use_case_records_it_and_advances_the_walk(session_store):
    store, _ = session_store

    result = mcp_server.vibe_set_parameters(
        SESSION_ID,
        {
            "industry": "retail",
            "use_case": "demand_forecasting",
            "use_case_label": "Demand Forecasting",
            "use_case_source": "curated",
        },
    )

    # The pick is RECORDED up front: the gate + the use_case_brief artifact.
    assert result.use_case_resolved is True
    assert engine.USE_CASE_GATE in store[SESSION_ID]["completed_gates"]
    brief = json.loads(store[SESSION_ID]["captured_outputs"][engine.USE_CASE_BRIEF])
    assert brief["industry"] == "retail"
    assert brief["use_case"] == "demand_forecasting"

    # The beat is gone; the walk now proceeds to the first numbered step.
    assert mcp_server.vibe_next_step(SESSION_ID).root.sectionTag == "project_setup"


# --- Non-negotiable #6: an existing session keeps advancing (no re-elicit) ----


def test_existing_session_with_persisted_gate_is_not_re_elicited(session_store):
    store, _ = session_store
    # A live genie-code session (e.g. f1f31c6d) persisted use_case_selection in
    # completed_gates and walked project_setup. Under Option A it must NOT be
    # re-elicited and prd_generation must stay unlocked.
    store[SESSION_ID]["completed_gates"] = ["use_case_selection", "project_setup"]
    store[SESSION_ID]["captured_outputs"] = {"use_case_brief": "{}"}
    store[SESSION_ID]["session_parameters"] = {"industry": "retail", "use_case": "demand_forecasting"}

    # The walk does NOT re-surface the intent beat...
    nxt = mcp_server.vibe_next_step(SESSION_ID).root
    assert nxt.sectionTag != "use_case_selection"
    assert nxt.sectionTag == "prd_generation"

    # ...and prd_generation is reachable, NOT STEP_LOCKED (its use_case_selection
    # gate is satisfied by the persisted ledger).
    prd = mcp_server.vibe_get_step(SESSION_ID, "prd_generation")
    assert not isinstance(prd, dict), prd
    assert prd.sectionTag == "prd_generation"

    # Completing it advances the walk (does not re-lock or re-elicit).
    completed = mcp_server.vibe_complete_step(SESSION_ID, "prd_generation", "PRD")
    assert not isinstance(completed, dict), completed
    assert "prd_generation" in completed.completed_gates
    assert not isinstance(completed.next, mcp_server.DoneResult)
    assert completed.next.sectionTag != "use_case_selection"


def test_start_track_with_industry_and_use_case_resolves_gate_up_front(session_store):
    store, _ = session_store

    mcp_server.vibe_start_track(
        "genie-accelerator", use_case="demand_forecasting", industry="retail", session_id=SESSION_ID
    )

    assert engine.USE_CASE_GATE in store[SESSION_ID]["completed_gates"]
    assert engine.USE_CASE_BRIEF in store[SESSION_ID]["captured_outputs"]
    # Having pre-picked, the walk skips the beat and starts on the first numbered step.
    assert mcp_server.vibe_next_step(SESSION_ID).root.sectionTag == "project_setup"
