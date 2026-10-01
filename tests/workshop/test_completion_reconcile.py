"""T5 PR1/R4b — ``build_session_state`` reads progress from the gate sets.

The generated global ``step_number -> sectionTag`` map (authority = frontend
``ALL_STEPS``) remains the single cross-surface numbering authority. The read
path itself is gates-only (R4b): ``completed_gates`` are used verbatim and
``skipped_gates`` (in ``session_parameters``) verbatim — there is no number
backfill. A row whose gates are empty carries NO progress even if the retired
numeric columns still hold values.

This file pins the map (a drift oracle against the frontend ``ALL_STEPS``), the
gates-verbatim behaviour, and the gates-only "numbers are never read" guarantee.
"""

import pathlib
import re
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.workshop import engine, manifest
from src.backend.workshop.state import build_session_state

WORKFLOW_SOURCE = REPO_ROOT / "src/constants/workflowSections.ts"


def _fe_all_steps_map() -> dict[int, str]:
    """Independently parse the frontend ``ALL_STEPS`` object (the authority for
    global step numbering) into ``{number: sectionTag}``. Deliberately a separate
    regex from ``generate_manifest.parse_source`` so this is a true drift oracle
    for the generated backend map, not a tautology against the generator."""

    source = WORKFLOW_SOURCE.read_text(encoding="utf-8")
    start = source.index("export const ALL_STEPS")
    end = source.index("\n};", start)
    region = source[start:end]
    mapping: dict[int, str] = {}
    for match in re.finditer(
        r"^\s*(\d+):\s*\{\s*number:\s*\d+,.*?sectionTag:\s*'([^']+)'\s*\},",
        region,
        re.M,
    ):
        mapping[int(match.group(1))] = match.group(2)
    return mapping


# --- D-2: the generated backend map must equal the frontend ALL_STEPS map -----


def test_backend_map_equals_frontend_all_steps():
    frontend = _fe_all_steps_map()
    backend = manifest.load_manifest().step_number_to_tag
    assert backend == frontend, "backend step_number_to_tag drifted from ALL_STEPS"
    # Anchors from workflowSections.ts (not track-local Step.order):
    assert backend[1] == "usecase_selection"  # global 1, a pre-journey beat
    assert backend[6] == "setup_lakebase"
    assert backend[57] == "semlayer_locate"  # a global the dense-index guard dropped
    assert 70 not in backend  # step 70 was retired


def test_backend_map_module_accessor_matches():
    assert manifest.step_number_to_tag() == manifest.load_manifest().step_number_to_tag


# --- Gates present: gates trusted verbatim, numbers never read ----------------


def test_gates_trusted_verbatim():
    """``completed_gates`` are used as-is; a stale numeric completed_steps column
    does NOT re-synthesize any tag."""
    record = {
        "completed_gates": ["project_setup", "prd_generation"],
        "completed_steps": [1, 2, 3, 4, 5],  # retired column; must be ignored
        "session_parameters": {},
    }
    state = build_session_state(record, "end-to-end")
    assert state.completed_gates == ["project_setup", "prd_generation"]


def test_genie_high_global_gates_survive():
    """genie-accelerator progress at globals 57+ (semlayer_*) rides on the gates
    and is rendered done by the engine."""
    record = {
        "completed_gates": ["semlayer_locate", "semlayer_profile", "semlayer_measures"],
        "session_parameters": {},
    }
    state = build_session_state(record, "genie-accelerator")
    status = {item.sectionTag: item.status for item in engine.outline("genie-accelerator", state)}
    for tag in ("semlayer_locate", "semlayer_profile", "semlayer_measures"):
        assert status[tag] == "done"


def test_skipped_gates_trusted_verbatim():
    """``skipped_gates`` (in session_parameters) are used as-is; a stale
    skipped_steps column does not clobber them."""
    record = {
        "completed_gates": ["project_setup"],
        "skipped_steps": [6],  # retired column; must be ignored
        "session_parameters": {"skipped_gates": ["wire_ui_lakebase"]},
    }
    state = build_session_state(record, "end-to-end")
    assert state.session_parameters["skipped_gates"] == ["wire_ui_lakebase"]
    status = {item.sectionTag: item.status for item in engine.outline("end-to-end", state)}
    assert status["wire_ui_lakebase"] == "skipped"


# --- Gates-only (R4b): the retired numeric columns are NEVER read -------------


def test_numbers_only_row_yields_no_progress():
    """TAMPER: empty gates + stale completed_steps/skipped_steps columns => NO
    completed_gates and NO skipped_gates. Re-add a number backfill to
    build_session_state and this fails."""
    record = {
        "completed_gates": [],
        "completed_steps": [1, 2, 3, 4, 5],  # retired column; must be ignored
        "skipped_steps": [6],               # retired column; must be ignored
        "session_parameters": {},
    }
    state = build_session_state(record, "end-to-end")
    assert state.completed_gates == []
    assert "skipped_gates" not in state.session_parameters


def test_numbers_only_row_engine_marks_nothing_done():
    """Observable projection of the gates-only guarantee: with empty gates and a
    stale numeric column, no step is done or skipped."""
    record = {
        "completed_gates": [],
        "completed_steps": [1, 2, 3, 4, 5],
        "session_parameters": {},
    }
    state = build_session_state(record, "end-to-end")
    statuses = {item.status for item in engine.outline("end-to-end", state)}
    assert "done" not in statuses
    assert "skipped" not in statuses
