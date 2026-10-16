"""The track-switch rule shared by the web picker and MCP (track_switch.py)."""

import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.workshop import track_switch  # noqa: E402
from src.backend.workshop.track_switch import evaluate_switch, switch_params  # noqa: E402


def _record(level, gates=(), use_case=None, **params):
    return {
        "session_id": "s",
        "workshop_level": level,
        "use_case": use_case,
        "completed_gates": list(gates),
        "session_parameters": dict(params),
    }


# Global step 2 (project_setup) done = the workflow has started.
STARTED = ["use_case_selection", "project_setup"]


@pytest.mark.parametrize(
    "current, target",
    [
        ("end-to-end", "genie-accelerator"),
        ("genie-accelerator", "app-database"),
        ("genie-accelerator", "reverse-app"),
        ("reverse-lakehouse", "genie-accelerator"),
        ("lakehouse", "agents-accelerator"),
    ],
)
def test_any_switch_is_allowed_before_set_up_project(current, target):
    decision = evaluate_switch(_record(current, ["use_case_selection"]), target)
    assert decision.allowed and decision.reason == "ok", decision


def test_same_track_is_an_allowed_no_op():
    decision = evaluate_switch(_record("lakehouse", STARTED), "lakehouse")
    assert decision.allowed and decision.reason == "same"


def test_after_start_only_the_next_level_on_the_chain_is_open():
    record = _record("app-only", STARTED, chainContext="app")
    assert evaluate_switch(record, "app-database").allowed
    for target in ("lakehouse", "lakehouse-di", "genie-accelerator", "reverse-app", "end-to-end"):
        decision = evaluate_switch(record, target)
        assert not decision.allowed and decision.reason == "workflow-started", target
        assert decision.allowed_targets == ("app-database",)


def test_after_start_an_accelerator_is_locked_in():
    decision = evaluate_switch(_record("genie-accelerator", STARTED), "lakehouse")
    assert not decision.allowed and decision.reason == "workflow-started"
    assert decision.allowed_targets == ()


def test_after_start_end_to_end_is_locked_like_the_app_guard():
    # end-to-end is on no progression chain, so App.handleWorkshopLevelChange
    # refuses every move once started, whatever the picker shows.
    decision = evaluate_switch(_record("end-to-end", STARTED, chainContext="app"), "app-only")
    assert not decision.allowed


def test_lakehouse_climb_uses_the_stored_chain_context():
    assert evaluate_switch(_record("lakehouse", STARTED, chainContext="lakehouse"), "lakehouse-di").allowed
    assert not evaluate_switch(_record("lakehouse-di", STARTED, chainContext="lakehouse"), "lakehouse").allowed


def test_assistant_disabled_track_is_refused():
    decision = evaluate_switch(_record("genie-accelerator"), "app-database", {"app-database"})
    assert not decision.allowed and decision.reason == "assistant"


def test_use_case_lock_pins_the_track():
    decision = evaluate_switch(_record("skills-accelerator", use_case="build_skill"), "end-to-end")
    assert not decision.allowed and decision.reason == "use-case"


def test_skills_accelerator_needs_a_new_session():
    decision = evaluate_switch(_record("genie-accelerator"), "skills-accelerator")
    assert not decision.allowed and decision.reason == "skills-new-session"


def test_switch_params_write_what_the_web_picker_writes():
    params = switch_params(
        {"chainContext": "app", "flags": {"ai.genie": False}, "include_lakehouse": True, "keep": 1},
        "app-database",
        "lakehouse",
        genie_ontology_default=True,
    )
    assert params["keep"] == 1
    assert params["level_explicitly_selected"] is True
    assert params["chainContext"] == "app"  # climbing APP_CHAIN keeps the app context
    assert params["direction"] == "forward"
    assert params["flags"] == {
        "ai.genie": True, "ai.agent": True, "ai.dashboard": True,
        "medallion.bronze": True, "medallion.silver": True, "medallion.gold": True,
        "includeLakehouse": False, "includeGenieOntology": False,
    }
    assert params["include_lakehouse"] is False
    assert params["include_genie_ontology"] is False and params["includeGenieOntology"] is False


def test_switch_params_genie_takes_the_facilitator_ontology_default():
    on = switch_params({}, "end-to-end", "genie-accelerator", genie_ontology_default=True)
    off = switch_params({}, "end-to-end", "genie-accelerator", genie_ontology_default=False)
    for params, value in ((on, True), (off, False)):
        assert params["flags"]["includeGenieOntology"] is value
        assert params["include_genie_ontology"] is value
        assert params["includeGenieOntology"] is value
    # An accelerator has no chain: the stored context is left as it was (as the SPA does).
    assert "chainContext" not in on


def test_switch_params_reverse_sets_the_direction():
    params = switch_params({"direction": "forward"}, "genie-accelerator", "reverse-lakehouse", genie_ontology_default=True)
    assert params["direction"] == "reverse"
    assert params["chainContext"] == "reverse"
    back = switch_params(params, "reverse-lakehouse", "genie-accelerator", genie_ontology_default=True)
    assert back["direction"] == "forward"


def test_switch_params_do_not_mutate_the_input():
    original = {"flags": {"ai.genie": False}}
    switch_params(original, "app-only", "lakehouse", genie_ontology_default=True)
    assert original == {"flags": {"ai.genie": False}}


def test_completed_numbers_and_started():
    record = _record("app-only", ["use_case_selection"])
    assert not track_switch.has_started(track_switch.completed_numbers(record))
    record = _record("app-only", STARTED)
    assert track_switch.has_started(track_switch.completed_numbers(record))
