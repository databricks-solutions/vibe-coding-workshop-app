"""Phase 3 ledger · resolve-step-fallback — pin the authored-manifest fallback.

``engine.resolve_step`` scans THIS session's composed outline first and, for a
tag outside it, falls back to the authored ``MANIFEST.track_steps`` list. This
file pins what each MCP surface does today for an EXPLICITLY requested
flag-filtered tag. No behavior change; D-16 records the decision.

The subject is ``gold_layer_design`` on genie-accelerator: authored under the
``includeLakehouse`` flag (default off), so a default session's outline omits
it. Its authored ``requiresGate`` is ``genie_silver_metadata``, which the same
flag also filters, so the gate dangles: no outline copy of the step exists to
rewire it. (``gaccel_dashboard``, the example the plan names, has no flag on
this track and is always in the outline, so it cannot be the subject.)

Tampers (each flips a green test to red; run manually, restore clean):
- **T1** make the fallback ``return None`` -> R-F1 fails.
- **T2** make the fallback search ``ordered`` instead of
  ``MANIFEST.track_steps(track_id)`` -> R-F1 fails.
"""

import copy
import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.workshop import engine

TRACK = "genie-accelerator"
SESSION_ID = "resolve-step-fallback"
FILTERED = "gold_layer_design"
DANGLING_GATE = "genie_silver_metadata"
PRE_GATES = ["use_case_selection", "project_setup", "prd_generation"]


def _state(gates, **parameters) -> engine.SessionState:
    return engine.SessionState(
        completed_gates=list(gates),
        captured_outputs={"use_case_brief": "demo brief"},
        session_parameters={"use_case": "demo", "use_case_label": "Demo", **parameters},
    )


def _outline_tags(state: engine.SessionState) -> set[str]:
    return {step.sectionTag for step in engine._ordered_steps(TRACK, state)}


@pytest.fixture
def store(monkeypatch):
    records: dict[str, dict] = {}

    def load_session(session_id):
        record = records.get(session_id)
        return copy.deepcopy(record) if record is not None else None

    def save_session(session_id, **fields):
        record = records.setdefault(session_id, {"session_id": session_id})
        record.update(copy.deepcopy({k: v for k, v in fields.items() if v is not None}))
        return True

    monkeypatch.setattr(mcp_server, "load_session", load_session)
    monkeypatch.setattr(mcp_server, "save_session", save_session)
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: True)

    def seed(gates, **parameters):
        state = _state(gates, **parameters)
        records[SESSION_ID] = {
            "session_id": SESSION_ID,
            "created_by": None,
            "workshop_level": "genie-accelerator",
            "completed_gates": list(state.completed_gates),
            "captured_outputs": dict(state.captured_outputs),
            "session_parameters": dict(state.session_parameters),
        }
        return records[SESSION_ID]

    return seed


def _error_code(result) -> str | None:
    return result["error"]["code"] if isinstance(result, dict) else None


def test_rf1_resolve_step_returns_the_authored_step_for_a_filtered_tag():
    """R-F1 · A filtered tag resolves to its AUTHORED Step, not None.

    The tag is absent from the composed outline, so the outline scan misses and
    the authored ``track_steps`` list answers. The returned step keeps its
    authored ``requiresGate`` (``genie_silver_metadata``), which is itself
    filtered: no rewire applies to a step that has no outline copy. A tag that
    no authored step carries still resolves to None."""

    state = _state(PRE_GATES)
    assert FILTERED not in _outline_tags(state)
    assert DANGLING_GATE not in _outline_tags(state)

    step = engine.resolve_step(TRACK, state, FILTERED)

    authored = next(s for s in engine.MANIFEST.track_steps(TRACK) if s.sectionTag == FILTERED)
    assert step is not None
    assert step == authored
    assert step.flag == "includeLakehouse"
    assert step.requiresGate == DANGLING_GATE
    assert engine.resolve_step(TRACK, state, "no_such_step") is None


def test_rf2_vibe_get_step_gates_a_filtered_tag_on_its_authored_gate(store):
    """R-F2 · vibe_get_step on a filtered tag gates on the AUTHORED, dangling gate.

    While ``genie_silver_metadata`` is incomplete the call returns STEP_LOCKED
    naming it, even though no outline step can ever complete it. Once that gate
    is in ``completed_gates`` (reachable only by completing the equally filtered
    ``genie_silver_metadata`` through this same fallback), the authored step
    payload renders with ``requiresGate == genie_silver_metadata``."""

    store(PRE_GATES)
    locked = mcp_server.vibe_get_step(SESSION_ID, FILTERED)
    assert _error_code(locked) == "STEP_LOCKED"
    assert DANGLING_GATE in locked["error"]["message"]

    store(PRE_GATES + [DANGLING_GATE])
    payload = mcp_server.vibe_get_step(SESSION_ID, FILTERED)
    assert _error_code(payload) is None, payload
    assert payload.sectionTag == FILTERED
    assert payload.requiresGate == DANGLING_GATE


def test_rf3_vibe_explain_step_explains_a_filtered_tag_without_a_gate_check(store):
    """R-F3 · vibe_explain_step on a filtered tag returns the authored step's help.

    Explain performs no gate check on any step, so a filtered tag gets its help
    while its authored gate is still open, the same as a locked outline step."""

    store(PRE_GATES)
    help_result = mcp_server.vibe_explain_step(SESSION_ID, FILTERED)
    assert _error_code(help_result) is None, help_result
    assert help_result.sectionTag == FILTERED
    assert help_result.title == "Gold Layer Design"


def test_rf4_vibe_complete_step_locks_until_the_authored_gate_completes(store):
    """R-F4 · vibe_complete_step on a filtered tag reads the authored gate.

    It returns STEP_LOCKED (never UNKNOWN_STEP) while ``genie_silver_metadata`` is
    incomplete. A skip cannot open it: the dangling gate is not an outline tag,
    so ``can_start``'s outline-membership rule rejects a ``skipped_gates`` entry
    for it. Completing the gate (a completed gate needs no outline membership)
    lets the completion succeed."""

    record = store(PRE_GATES)
    assert _error_code(mcp_server.vibe_complete_step(SESSION_ID, FILTERED, "out")) == "STEP_LOCKED"
    assert record["completed_gates"] == PRE_GATES

    record = store(PRE_GATES, skipped_gates=[DANGLING_GATE])
    assert _error_code(mcp_server.vibe_complete_step(SESSION_ID, FILTERED, "out")) == "STEP_LOCKED"
    assert record["completed_gates"] == PRE_GATES

    record = store(PRE_GATES + [DANGLING_GATE])
    result = mcp_server.vibe_complete_step(SESSION_ID, FILTERED, "design notes")
    assert _error_code(result) is None, result
    assert record["completed_gates"] == PRE_GATES + [DANGLING_GATE, FILTERED]


def test_rf5_completing_a_filtered_tag_leaves_outline_and_next_step_unchanged():
    """R-F5 · Completing a filtered tag does not move the session's walk.

    The gate and the step's ``produces`` output are recorded, but the composed
    outline (its tags and statuses) and ``engine.next_step`` are the same before
    and after: the completed tag is not an outline node and no outline step's
    (rewired) gate names it. The recorded ``gold_layer_design`` output is
    visible to outline steps that consume that key (``activation_table_design``,
    ``activation_app_design``)."""

    state = _state(PRE_GATES + [DANGLING_GATE])
    outline_before = engine.outline(TRACK, state)
    next_before = engine.next_step(TRACK, state)

    result = engine.complete_step(TRACK, state, FILTERED, "design notes")

    assert result.ok and result.error_code is None
    assert state.completed_gates[-1] == FILTERED
    assert state.captured_outputs["gold_layer_design"] == "design notes"
    assert engine.outline(TRACK, state) == outline_before
    assert engine.next_step(TRACK, state) == next_before
    assert result.next_step == next_before


def test_rf6_vibe_get_step_next_pointer_for_a_filtered_tag_is_not_track_complete(store):
    """R-F6 · vibe_get_step's ``next`` for a filtered tag is the next outline step.

    The filtered tag has no index in the composed outline, so ``next`` is the
    first outline step authored after it (D-17): ``semlayer_locate``, which is
    also what ``vibe_next_step`` answers mid-track. Previously a strict xfail
    that read "Track complete"; next-ref-filtered-step fixed it."""

    store(PRE_GATES + [DANGLING_GATE])
    payload = mcp_server.vibe_get_step(SESSION_ID, FILTERED)
    assert _error_code(payload) is None, payload
    assert payload.next.title != "Track complete"
    assert payload.next.sectionTag == "semlayer_locate"
