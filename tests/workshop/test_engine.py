import json
import pathlib
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.workshop import engine, manifest


FIX = pathlib.Path(__file__).parent / "fixtures"
TRACK = "genie-accelerator"


def _session(gates=None, outputs=None, params=None):
    return engine.SessionState(
        completed_gates=list(gates or []),
        captured_outputs=dict(outputs or {}),
        session_parameters=dict(params or {}),
    )


def test_next_step_is_first_current():
    session = _session()
    step = engine.next_step(TRACK, session)
    order = [
        status.sectionTag
        for status in engine.outline(TRACK, session)
    ]
    assert step.sectionTag == order[0]


def test_can_start_requires_gate():
    loaded = manifest.load_manifest()
    gated = next(step for step in loaded.track_steps(TRACK) if step.requiresGate)
    assert engine.can_start(gated, _session()) is False
    assert engine.can_start(gated, _session(gates=[gated.requiresGate])) is True


def test_outline_status_transitions_after_completion():
    session = _session()
    first = engine.next_step(TRACK, session)
    statuses = {status.sectionTag: status.status for status in engine.outline(TRACK, session)}
    assert statuses[first.sectionTag] == "current"

    result = engine.complete_step(TRACK, session, first.sectionTag, "out")
    assert result.ok
    statuses = {status.sectionTag: status.status for status in engine.outline(TRACK, session)}
    assert statuses[first.sectionTag] == "done"
    assert statuses[result.next_step.sectionTag] == "current"


def test_complete_step_idempotent_success():  # D3 F3
    session = _session()
    first = engine.next_step(TRACK, session)
    first_result = engine.complete_step(TRACK, session, first.sectionTag, "out")
    second_result = engine.complete_step(TRACK, session, first.sectionTag, "out")
    assert first_result.ok and second_result.ok
    assert session.completed_gates.count(first.sectionTag) == 1


def test_complete_locked_step_is_error_no_mutation():  # D3 F2
    loaded = manifest.load_manifest()
    locked = next(
        step
        for step in loaded.track_steps(TRACK)
        if step.requiresGate and step.requiresGate not in []
    )
    session = _session()
    result = engine.complete_step(TRACK, session, locked.sectionTag)
    assert result.ok is False and result.error_code == "STEP_LOCKED"
    assert session.completed_gates == []


def test_unknown_tag_is_error_no_mutation():  # D3 F1
    session = _session()
    result = engine.complete_step(TRACK, session, "not_a_real_tag")
    assert result.ok is False and result.error_code in {"UNKNOWN_TRACK", "UNKNOWN_STEP"}
    assert session.completed_gates == []


def test_ui_driven_step_is_coached_without_false_gate():
    loaded = manifest.load_manifest()
    step = next(step for step in loaded.track_steps(TRACK) if step.execution == "ui-driven")
    session = _session(gates=[step.requiresGate] if step.requiresGate else [])
    result = engine.complete_step(TRACK, session, step.sectionTag)
    assert result.ok is False
    assert result.error_code == "UI_DRIVEN_STEP"
    assert result.coached is True
    assert step.sectionTag not in session.completed_gates


def test_chaining_parity_consumes_matches_ts_literals():  # D8 §2.3
    loaded = manifest.load_manifest()
    golden = json.loads((FIX / "golden_chaining_genie.json").read_text())
    for step in loaded.track_steps(TRACK):
        assert sorted(step.consumes) == sorted(golden.get(step.sectionTag, []))


def test_resolve_previous_outputs_missing_key_does_not_raise():  # I4
    loaded = manifest.load_manifest()
    step = next(step for step in loaded.track_steps(TRACK) if step.consumes)
    output = engine.resolve_previous_outputs(step, _session())
    assert isinstance(output, dict)
    assert output == {}


def test_resolve_previous_outputs_returns_captured_values():
    loaded = manifest.load_manifest()
    step = next(step for step in loaded.track_steps(TRACK) if step.consumes)
    outputs = {key: f"value:{key}" for key in step.consumes}
    assert engine.resolve_previous_outputs(step, _session(outputs=outputs)) == outputs
