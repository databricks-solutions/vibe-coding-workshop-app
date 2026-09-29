"""T5 PR1 — reconcile ``completed_steps``/``skipped_steps`` with ``completed_gates``.

Root cause (verified): ``completed_steps`` carries TWO numberings on one column.
The **App** persists **global ``ALL_STEPS`` numbers** and never writes
``completed_gates``; the **MCP** walk persists **dense track positions** AND writes
authoritative ``completed_gates``. The former ``build_session_state`` read every
``completed_steps`` int as a 1-based *dense track index*, so App-origin rows were
systematically misread (off-by-one over-completion on ``end-to-end``; silent
drop of the learner's real ``genie-accelerator`` progress at globals 57+).

The fix is pure read-side (no Lakebase touch, no migration): a generated global
``step_number -> sectionTag`` map (authority = frontend ``ALL_STEPS``) plus a
disambiguation rule — **gates present => trust gates verbatim** (MCP-origin);
**gates empty => App-origin globals**, mapped through the global map and filtered
to the track's own step set. ``skipped`` moves in lockstep.

These tests FAIL against the old ``steps[n-1]`` dense-index logic and PASS after
the fix. See docs/superpowers/plans/2026-09-29-mcp-phase3-t5-completion-keying-tags.md.
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


# --- App-origin (gates empty): globals mapped, then track-filtered ------------


def test_app_origin_end_to_end_no_off_by_one():
    """end-to-end App globals {1,2,3,4,5}: the old dense-index read stamped
    ``setup_lakebase`` (dense position 5) done. As GLOBAL numbers, 6=setup_lakebase
    was never completed, so it must NOT be done. Global 1 (``usecase_selection``)
    is not a numbered step on any track and is dropped."""
    record = {
        "completed_gates": [],
        "completed_steps": [1, 2, 3, 4, 5],
        "session_parameters": {},
    }
    state = build_session_state(record, "end-to-end")
    gates = set(state.completed_gates)
    assert "setup_lakebase" not in gates  # the off-by-one over-completion, fixed
    assert {
        "project_setup",
        "prd_generation",
        "cursor_copilot_ui_design",
        "deploy_databricks_app",
    } <= gates
    assert "usecase_selection" not in gates  # global 1 is not a track step


def test_app_origin_genie_high_globals_not_dropped():
    """genie-accelerator's real learner progress lives at globals 57+. The old
    ``1 <= n <= len(steps)`` guard (31 dense steps) silently dropped them; as
    global numbers they map to real genie steps and must survive."""
    record = {
        "completed_gates": [],
        "completed_steps": [57, 58, 59],
        "session_parameters": {},
    }
    state = build_session_state(record, "genie-accelerator")
    gates = set(state.completed_gates)
    assert {"semlayer_locate", "semlayer_profile", "semlayer_measures"} <= gates


def test_app_origin_genie_low_globals_no_false_lakehouse():
    """genie-accelerator App globals {1,2,3}: the old dense read stamped dense[2] =
    ``genie_silver_metadata`` done. As globals, {2,3} => project_setup/prd_generation
    and 1 is dropped, so genie_silver_metadata is NOT falsely completed."""
    record = {
        "completed_gates": [],
        "completed_steps": [1, 2, 3],
        "session_parameters": {},
    }
    state = build_session_state(record, "genie-accelerator")
    gates = set(state.completed_gates)
    assert "genie_silver_metadata" not in gates
    assert {"project_setup", "prd_generation"} <= gates


def test_app_origin_cross_track_global_ignored():
    """A global that maps to a tag NOT in this track (e.g. a genie step number on
    end-to-end) is dropped, never mis-indexed onto some other step."""
    record = {
        "completed_gates": [],
        "completed_steps": [57],  # semlayer_locate — genie-only
        "session_parameters": {},
    }
    state = build_session_state(record, "end-to-end")
    assert state.completed_gates == []


def test_engine_outline_end_to_end_setup_lakebase_not_done():
    """Observable projection: with App globals {1,2,3,4,5}, engine.outline must not
    report ``setup_lakebase`` as done while ``deploy_databricks_app`` is done."""
    record = {
        "completed_gates": [],
        "completed_steps": [1, 2, 3, 4, 5],
        "session_parameters": {},
    }
    state = build_session_state(record, "end-to-end")
    status = {item.sectionTag: item.status for item in engine.outline("end-to-end", state)}
    assert status["deploy_databricks_app"] == "done"
    assert status["setup_lakebase"] != "done"


# --- MCP-origin (gates present): gates trusted verbatim, numbers ignored ------


def test_mcp_origin_gates_trusted_verbatim():
    """Gates present => MCP-origin/authoritative. ``completed_steps`` (dense track
    positions) must NOT re-synthesize any tag — the gates are used as-is."""
    record = {
        "completed_gates": ["project_setup", "prd_generation"],
        "completed_steps": [1, 2, 3, 4, 5],  # dense positions; must be ignored
        "session_parameters": {},
    }
    state = build_session_state(record, "end-to-end")
    assert state.completed_gates == ["project_setup", "prd_generation"]


# --- D-3: skipped moves in lockstep with completed ----------------------------


def test_app_origin_skipped_globals_mapped():
    """App-origin ``skipped_steps`` are global numbers too — map them to tags into
    ``session_parameters.skipped_gates`` so the engine renders them skipped."""
    record = {
        "completed_gates": [],
        "completed_steps": [2],
        "skipped_steps": [6],  # global 6 => setup_lakebase
        "session_parameters": {},
    }
    state = build_session_state(record, "end-to-end")
    assert state.session_parameters.get("skipped_gates") == ["setup_lakebase"]
    status = {item.sectionTag: item.status for item in engine.outline("end-to-end", state)}
    assert status["setup_lakebase"] == "skipped"


def test_mcp_origin_skipped_gates_trusted():
    """Gates present => trust ``skipped_gates`` verbatim; ``skipped_steps`` (dense)
    is ignored and must not clobber the authoritative tag set."""
    record = {
        "completed_gates": ["project_setup"],
        "skipped_steps": [6],
        "session_parameters": {"skipped_gates": ["wire_ui_lakebase"]},
    }
    state = build_session_state(record, "end-to-end")
    assert state.session_parameters["skipped_gates"] == ["wire_ui_lakebase"]
