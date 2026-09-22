"""Pure workshop progression and chaining operations."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Mapping

from . import manifest
from .manifest import Step


Status = Literal["done", "current", "locked", "skipped"]


@dataclass
class SessionState:
    completed_gates: list[str] = field(default_factory=list)
    captured_outputs: dict[str, str] = field(default_factory=dict)
    session_parameters: dict = field(default_factory=dict)


@dataclass(frozen=True)
class StepStatus:
    sectionTag: str
    title: str
    status: Status
    execution: str


@dataclass(frozen=True)
class Done:
    done: bool = True


@dataclass
class CompleteResult:
    ok: bool
    error_code: str | None = None
    completed_gates: list[str] = field(default_factory=list)
    next_step: Step | Done | None = None
    coached: bool = False

    @property
    def next(self) -> Step | Done | None:
        """Expose the transport-facing name without duplicating state."""

        return self.next_step


MANIFEST = manifest.load_manifest()


def _as_bool(value: object) -> bool:
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return bool(value)


def _flags_for(track_id: str, session: SessionState) -> dict[str, bool]:
    track = MANIFEST.tracks[track_id]
    parameters = session.session_parameters
    flags: dict[str, bool] = {}

    nested_flags = parameters.get("flags", {})
    if isinstance(nested_flags, Mapping):
        for name in track.flags:
            if name in nested_flags:
                flags[name] = _as_bool(nested_flags[name])

    for name in track.flags:
        if name in parameters:
            flags[name] = _as_bool(parameters[name])

    return flags


def _skipped_tags(session: SessionState) -> set[str]:
    parameters = session.session_parameters
    values = parameters.get("skipped_gates", parameters.get("skippedSteps", []))
    if isinstance(values, str):
        values = [values]
    if not isinstance(values, (list, tuple, set)):
        return set()
    return {value for value in values if isinstance(value, str)}


def _ordered_steps(track_id: str, session: SessionState) -> list[Step]:
    return MANIFEST.outline_order(track_id, flags=_flags_for(track_id, session))


def outline(track_id: str, session: SessionState) -> list[StepStatus]:
    """Return the visible ordered steps with their progression status."""

    steps = _ordered_steps(track_id, session)
    completed = set(session.completed_gates)
    skipped = _skipped_tags(session)
    current_tag: str | None = None

    statuses: list[StepStatus] = []
    for step in steps:
        if step.sectionTag in completed:
            status: Status = "done"
        elif step.sectionTag in skipped:
            status = "skipped"
        elif current_tag is None and can_start(step, session):
            current_tag = step.sectionTag
            status = "current"
        else:
            status = "locked"
        statuses.append(
            StepStatus(
                sectionTag=step.sectionTag,
                title=step.title,
                status=status,
                execution=step.execution,
            )
        )

    return statuses


def next_step(track_id: str, session: SessionState) -> Step | Done:
    """Return the first current step or a done sentinel."""

    statuses = outline(track_id, session)
    steps = _ordered_steps(track_id, session)
    for status, step in zip(statuses, steps):
        if status.status == "current":
            return step
    return Done()


def can_start(step: Step, session: SessionState) -> bool:
    """Return whether the step's predecessor gate has been satisfied."""

    return step.requiresGate is None or step.requiresGate in session.completed_gates


def _result_error(
    session: SessionState,
    error_code: str,
    *,
    coached: bool = False,
) -> CompleteResult:
    return CompleteResult(
        ok=False,
        error_code=error_code,
        completed_gates=list(session.completed_gates),
        coached=coached,
    )


def complete_step(
    track_id: str,
    session: SessionState,
    section_tag: str,
    captured_output: str | None = None,
) -> CompleteResult:
    """Complete a visible step, mutating only the supplied session state."""

    try:
        steps = MANIFEST.track_steps(track_id)
    except KeyError:
        return _result_error(session, "UNKNOWN_TRACK")

    step = next((candidate for candidate in steps if candidate.sectionTag == section_tag), None)
    if step is None:
        return _result_error(session, "UNKNOWN_STEP")

    if section_tag in session.completed_gates:
        return CompleteResult(
            ok=True,
            completed_gates=list(session.completed_gates),
            next_step=next_step(track_id, session),
        )

    if not can_start(step, session):
        return _result_error(session, "STEP_LOCKED")

    if step.execution == "ui-driven":
        return _result_error(session, "UI_DRIVEN_STEP", coached=True)

    session.completed_gates.append(section_tag)
    if step.produces is not None:
        session.captured_outputs[step.produces] = captured_output or ""

    return CompleteResult(
        ok=True,
        completed_gates=list(session.completed_gates),
        next_step=next_step(track_id, session),
    )


def resolve_previous_outputs(step: Step, session: SessionState) -> dict[str, str]:
    """Resolve available upstream outputs without raising for missing keys."""

    return {
        key: session.captured_outputs[key]
        for key in step.consumes
        if key in session.captured_outputs
    }
