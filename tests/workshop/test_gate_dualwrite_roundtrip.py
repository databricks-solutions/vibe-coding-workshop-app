"""Phase 3 T5 PR3a — the SPA gate DUAL-WRITE correctness guarantee (read-side).

THE GUARANTEE (the crux of PR3a): when the SPA dual-writes ``completed_gates`` it
MUST persist the **COMPLETE gate set** — the sectionTags for ALL currently
completed steps (``ALL_STEPS[n].sectionTag`` for every ``n`` in the same set it
writes as ``completed_steps``) — NOT just the toggled delta.

WHY: once ``completed_gates`` is non-empty, ``build_session_state`` takes the
'trust gates verbatim, IGNORE the numbers' branch (T5 PR1). A PARTIAL/delta gate
write would therefore make reconciliation silently DROP all number-only progress
not represented in the gate set. Deriving gates from the SAME set written as
``completed_steps`` makes them consistent by construction.

These three tests encode the guarantee:

1. ROUND-TRIP — a complete-set dual-write loses NOTHING: the gates-present
   (verbatim) done-set equals the done-set the numbers alone would have produced
   via the gates-empty reconciliation path. Skipped moves in lockstep.
2. TRAP — a PARTIAL gate write drops number-only progress (partial done-set is a
   strict subset of the full done-set) — documenting WHY the complete set is
   required.
3. DISSOLUTION — a dual-write session takes the gates-present verbatim path AND
   yields full progress even if the numbers were empty/garbage, so the PR2
   union->completed_steps convergence is no longer load-bearing for it.

Offline: builds session state via the shared ``build_session_state`` and runs the
same ``engine.outline`` the REST route and MCP server call. No live Lakebase.
"""

from src.backend.workshop import engine, manifest
from src.backend.workshop.state import build_session_state

END_TO_END = "end-to-end"
GENIE_TRACK = "genie-accelerator"


def _done_tags(track: str, record: dict) -> set[str]:
    state = build_session_state(record, track)
    return {item.sectionTag for item in engine.outline(track, state) if item.status == "done"}


def _skipped_tags(track: str, record: dict) -> set[str]:
    state = build_session_state(record, track)
    return {item.sectionTag for item in engine.outline(track, state) if item.status == "skipped"}


def _gates_for(step_numbers: list[int]) -> list[str]:
    """Mirror the SPA's ``stepNumbersToGates``: map GLOBAL step numbers to their
    ``ALL_STEPS`` sectionTag via the backend map (authority == frontend ALL_STEPS),
    dropping unmapped numbers. This is the COMPLETE gate set the SPA derives from
    the same set it writes as ``completed_steps``."""
    number_to_tag = manifest.step_number_to_tag()
    return [number_to_tag[n] for n in step_numbers if n in number_to_tag]


# --- 1. ROUND-TRIP: complete-set dual-write loses nothing --------------------


def test_complete_gate_set_yields_full_progress_end_to_end():
    # Globals the App completed, including the pre-journey global 1
    # (usecase_selection) which is not a numbered outline step.
    completed_steps = [1, 2, 3, 4, 5]
    skipped_steps = [6]  # global 6 => setup_lakebase
    complete_gates = _gates_for(completed_steps)
    complete_skipped_gates = _gates_for(skipped_steps)

    # The gate write shape the SPA persists: the COMPLETE gate set; skipped_gates
    # lives in session_parameters. (R4b: no numeric columns are read.)
    gate_write = {
        "completed_gates": complete_gates,
        "session_parameters": {"skipped_gates": complete_skipped_gates},
    }

    dual_done = _done_tags(END_TO_END, gate_write)

    # The complete gate set yields the real progress (not a trivially-passing match).
    assert {
        "project_setup",
        "prd_generation",
        "cursor_copilot_ui_design",
        "deploy_databricks_app",
    } <= dual_done
    assert "setup_lakebase" not in dual_done  # never completed; not over-completed

    # Skipped lockstep from skipped_gates: setup_lakebase is skipped.
    assert "setup_lakebase" in _skipped_tags(END_TO_END, gate_write)


def test_complete_gate_set_yields_full_progress_genie_high_globals():
    # genie-accelerator real progress lives at globals 57+ (semlayer_*).
    completed_steps = [2, 3, 57, 58, 59]
    gate_write = {
        "completed_gates": _gates_for(completed_steps),
        "session_parameters": {},
    }
    dual_done = _done_tags(GENIE_TRACK, gate_write)
    assert {"semlayer_locate", "semlayer_profile", "semlayer_measures"} <= dual_done


# --- 2. TRAP: a PARTIAL gate write drops number-only progress ----------------


def test_partial_gate_write_drops_number_only_progress():
    """PROVE THE TRAP: writing only the toggled delta (a PARTIAL, non-empty gate
    set) makes the gates-present branch drop every number-only completion not in
    the gate set. This is WHY the complete set is mandatory."""
    completed_steps = [1, 2, 3, 4, 5]
    full_gates = _gates_for(completed_steps)
    # The BUG shape: only the just-toggled step's tag (the delta), not the set.
    partial_gates = [full_gates[-1]]  # e.g. deploy_databricks_app only

    full_done = _done_tags(
        END_TO_END,
        {
            "completed_gates": full_gates,
            "completed_steps": completed_steps,
            "session_parameters": {},
        },
    )
    partial_done = _done_tags(
        END_TO_END,
        {
            "completed_gates": partial_gates,
            "completed_steps": completed_steps,  # ignored on the gates-present path
            "session_parameters": {},
        },
    )

    # The partial write silently drops progress: strictly fewer steps are done.
    assert partial_done != full_done
    assert partial_done < full_done
    # Concretely, earlier completions vanish though their NUMBERS are still stored.
    assert "project_setup" in full_done
    assert "project_setup" not in partial_done


# --- 3. DISSOLUTION: gates verbatim, numbers no longer load-bearing ----------


def test_dual_write_takes_gates_present_path_verbatim():
    """A dual-write session NO LONGER depends on the gates-empty number
    reconciliation: the gates are trusted verbatim (numbers ignored), so even an
    EMPTY/garbage ``completed_steps`` still yields the full done-set. The PR2
    union->completed_steps convergence is therefore not load-bearing here."""
    completed_steps = [1, 2, 3, 4, 5]
    complete_gates = _gates_for(completed_steps)

    # Numbers deliberately EMPTY: on the gates-empty path this would reconcile to
    # nothing; on the gates-present path the verbatim gates carry full progress.
    gates_only = {
        "completed_gates": complete_gates,
        "completed_steps": [],  # the number store is not consulted
        "session_parameters": {},
    }
    state = build_session_state(gates_only, END_TO_END)
    # Verbatim: state carries exactly the written gate set (not re-synthesized).
    assert state.completed_gates == complete_gates

    done = _done_tags(END_TO_END, gates_only)
    assert {
        "project_setup",
        "prd_generation",
        "cursor_copilot_ui_design",
        "deploy_databricks_app",
    } <= done

    # Contrast: the SAME empty-numbers row WITHOUT the dual-write (gates empty)
    # would reconcile to nothing done — proving the gates, not the numbers, carry
    # the progress for a dual-write session.
    without_gates = {
        "completed_gates": [],
        "completed_steps": [],
        "session_parameters": {},
    }
    assert _done_tags(END_TO_END, without_gates) == set()
