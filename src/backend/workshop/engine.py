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


@dataclass(frozen=True)
class Blocked:
    """No step is ``current`` yet a step remains ``locked``.

    Returned by ``next_step`` in place of ``Done()`` when the first unfinished
    step cannot start: its gate is not yet satisfied (e.g. prd_generation before
    the pre-journey use case is locked) or can never be (a dangling
    ``requiresGate``, the safety net that turns a gate-data defect into an
    explicit signal instead of a false ``Done``). Under strict order (D-78) it
    carries the FIRST locked step in outline order, which is the first
    unfinished step."""

    sectionTag: str
    title: str
    requiresGate: str | None


@dataclass
class CompleteResult:
    ok: bool
    error_code: str | None = None
    completed_gates: list[str] = field(default_factory=list)
    next_step: Step | Done | Blocked | None = None
    coached: bool = False

    @property
    def next(self) -> Step | Done | Blocked | None:
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


# Composition inputs the engine threads into manifest.outline_order to select a
# runtime variant (Phase 3 T3a). ``direction`` drives end-to-end reverse;
# ``chainContext`` drives the lakehouse / lakehouse-di additive-chain climb. The
# four reverse-* tracks bake reverse in as their default, so they need no input.
_COMPOSITION_INPUTS = ("direction", "chainContext")


def _inputs_for(session: SessionState) -> dict[str, str]:
    parameters = session.session_parameters
    inputs: dict[str, str] = {}
    for name in _COMPOSITION_INPUTS:
        value = parameters.get(name)
        if value is not None:
            inputs[name] = str(value)
    return inputs


def _skipped_tags(session: SessionState) -> set[str]:
    parameters = session.session_parameters
    values = parameters.get("skipped_gates", [])
    if isinstance(values, str):
        values = [values]
    if not isinstance(values, (list, tuple, set)):
        return set()
    return {value for value in values if isinstance(value, str)}


def _ordered_steps(track_id: str, session: SessionState) -> list[Step]:
    return MANIFEST.outline_order(
        track_id,
        flags=_flags_for(track_id, session),
        inputs=_inputs_for(session),
    )


def outline(track_id: str, session: SessionState) -> list[StepStatus]:
    """Return the visible ordered steps with their progression status.

    Strict order (D-78): the FIRST step that is neither ``done`` nor ``skipped``
    is ``current`` when it can start and ``locked`` otherwise; every later
    unfinished step is ``locked``. The scan never looks past an unfinished step,
    so an ungated later step cannot jump the queue.
    """

    steps = _ordered_steps(track_id, session)
    completed = set(session.completed_gates)
    skipped = _skipped_tags(session)
    outline_tags = {step.sectionTag for step in steps}
    frontier_seen = False

    statuses: list[StepStatus] = []
    for step in steps:
        if step.sectionTag in completed:
            status: Status = "done"
        elif step.sectionTag in skipped:
            status = "skipped"
        elif not frontier_seen and can_start(step, session, outline_tags):
            frontier_seen = True
            status = "current"
        else:
            frontier_seen = True
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


def next_step(track_id: str, session: SessionState) -> Step | Done | Blocked:
    """Return the first unfinished step, a done sentinel, or a blocked signal.

    Invariant (D-78): next is always the first unfinished, unskipped step in the
    ordered outline, or ``Blocked`` on it. When that step can start it is
    ``current`` and returned; when it cannot, it is the first ``locked`` step
    and ``Blocked`` names it. Only when every step is ``done`` or ``skipped`` is
    the result ``Done``, so a caller can trust ``Done`` to mean truly finished.
    This is a pure function of the strict outline scan; it introduces no skip
    source.
    """

    statuses = outline(track_id, session)
    steps = _ordered_steps(track_id, session)
    for status, step in zip(statuses, steps):
        if status.status == "current":
            return step
    for status, step in zip(statuses, steps):
        if status.status == "locked":
            return Blocked(
                sectionTag=step.sectionTag,
                title=step.title,
                requiresGate=step.requiresGate,
            )
    return Done()


def can_start(
    step: Step,
    session: SessionState,
    outline_tags: set[str] | None = None,
) -> bool:
    """Return whether the step's predecessor gate has been satisfied.

    A gate is satisfied when the step has no gate, the gate is already in
    ``completed_gates``, or the gate was skipped AND names a step in THIS
    session's ordered outline (``outline_tags``). The outline-membership
    condition is what keeps a non-outline gate — ``use_case_selection`` is
    resolved pre-journey, never as an outline node — unsatisfiable by a skip, so
    a stray ``skipped_gates`` entry can only unlock a genuinely skipped numbered
    step. Callers without the outline context (``outline_tags`` left as ``None``)
    fall back to the strict completed-only gate.
    """

    if step.requiresGate is None or step.requiresGate in session.completed_gates:
        return True
    return (
        outline_tags is not None
        and step.requiresGate in outline_tags
        and step.requiresGate in _skipped_tags(session)
    )


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


def resolve_step(
    track_id: str,
    session: SessionState,
    section_tag: str,
) -> Step | None:
    """Resolve a step against THIS session's composed outline first.

    The composed outline (``_ordered_steps``) carries the gate-rewired steps
    (Phase 3 T5 PR A) — a step whose authored ``requiresGate`` was flag-filtered
    dangles there but is rewired in the outline. Any lookup that gates on
    ``requiresGate`` must read the outline copy, or it re-checks the original
    dangling gate and disagrees with ``vibe_next_step``/``engine.outline``.
    Tags outside the outline (explicitly requested flag-filtered steps) keep
    the authored lookup — this fallback is the sole remaining direct
    ``track_steps`` read; no gate check may bypass the outline.

    Limitation (D-16, pinned by tests/workshop/test_resolve_step_fallback.py):
    a fallback step has no outline copy, so it carries its AUTHORED
    ``requiresGate``, which may itself be flag-filtered (dangling). ``can_start``
    then reads that authored gate: a skip cannot satisfy it (it is not an
    outline tag), only completing it can. Completing a fallback step records its
    gate and ``produces`` output but leaves ``outline`` and ``next_step``
    unchanged."""

    ordered = _ordered_steps(track_id, session)
    for step in ordered:
        if step.sectionTag == section_tag:
            return step
    authored = MANIFEST.track_steps(track_id)
    return next((candidate for candidate in authored if candidate.sectionTag == section_tag), None)


def complete_step(
    track_id: str,
    session: SessionState,
    section_tag: str,
    captured_output: str | None = None,
) -> CompleteResult:
    """Complete a visible step, mutating only the supplied session state."""

    try:
        step = resolve_step(track_id, session, section_tag)
    except KeyError:
        return _result_error(session, "UNKNOWN_TRACK")
    if step is None:
        return _result_error(session, "UNKNOWN_STEP")

    if section_tag in session.completed_gates:
        return CompleteResult(
            ok=True,
            completed_gates=list(session.completed_gates),
            next_step=next_step(track_id, session),
        )

    outline_tags = {candidate.sectionTag for candidate in _ordered_steps(track_id, session)}
    if not can_start(step, session, outline_tags):
        return _result_error(session, "STEP_LOCKED")
    # Strict order (D-78): an outline step behind an unfinished step is locked
    # even when its own gate is satisfied. Skipped and off-outline steps carry
    # no ``locked`` status here and keep the gate-only check above.
    if any(
        status.sectionTag == section_tag and status.status == "locked"
        for status in outline(track_id, session)
    ):
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


# --- Pre-journey use-case resolution (Option A) ------------------------------
# use_case_selection was retired as a numbered outline step. The use case is now
# captured UP FRONT — before the first numbered step — mirroring the App's step 1
# "Define Your Intent". Locking the use case is a pre-journey resolution: it marks
# the use_case_selection gate complete and records the use_case_brief artifact, so
# prd_generation (requiresGate="use_case_selection", consumes=["use_case_brief"])
# unlocks and resolves without a numbered use_case_selection node. This is the
# engine primitive the manifest lacked; the MCP lock/start_track paths call it.
USE_CASE_GATE = "use_case_selection"
USE_CASE_BRIEF = "use_case_brief"


def use_case_resolved(session: SessionState) -> bool:
    """Whether the pre-journey use-case gate has been resolved for this session."""

    return USE_CASE_GATE in session.completed_gates


def resolve_use_case(session: SessionState, brief: str) -> bool:
    """Resolve the pre-journey use-case gate, mutating only the supplied session.

    Records the ``use_case_selection`` gate (once — idempotent on a re-lock, so a
    learner refining their selection never double-appends) and stores the
    ``use_case_brief`` artifact. Returns True when this call newly resolved the
    gate (so callers can drive one-time side effects such as the session rename).
    """

    newly_resolved = USE_CASE_GATE not in session.completed_gates
    if newly_resolved:
        session.completed_gates.append(USE_CASE_GATE)
    session.captured_outputs[USE_CASE_BRIEF] = brief
    return newly_resolved
