"""Phase 3 · T5 · PR A — dangling-gate rewire + all-tracks gate invariant.

Flag filtering drops a flagged step out of a composed outline but never touches
the surviving steps' ``requiresGate``. A step whose prerequisite was filtered
out therefore keeps a gate that can never be satisfied — it stays ``locked``
forever and, when it is all that remains, ``next_step`` returns ``Done()`` with
steps still locked (the live ``done:true`` bug: genie-accelerator defaults ->
``iterate_enhance.requiresGate = ontology_routing`` (filtered) -> after
``activation_deploy_validate`` three steps dangle locked -> false Done).

``Manifest.outline_order`` now rewires each dangling gate to the nearest ancestor
that IS in the composed outline (``_rewire_gates`` / ``_nearest_outline_ancestor``),
and the three step lookups that gate on ``requiresGate`` read the composed outline
through ``engine.resolve_step`` instead of the authored ``track_steps``.

This module pins:

1. The **all-tracks gate invariant** over every track x flag combo x composition
   input: each visible step's ``requiresGate`` is ``None``, the use-case gate, or
   an EARLIER visible step. The pre-rewire (authored-gate) composition has
   **898** violations over the 384 track x flag combos (**1226** over the full
   520-combo space including composition inputs); the rewired composition has
   **0** over the full space.
2. The rewire **target** for genie-accelerator defaults:
   ``iterate_enhance.requiresGate == "gagent_optimize"`` (NOT the immediate
   predecessor ``activation_deploy_validate`` — that is what makes T2 fail).
3. **End-to-end MCP agreement** on the regression row: ``vibe_next_step`` ==
   ``iterate_enhance``; ``vibe_get_step`` does not report ``STEP_LOCKED``;
   ``vibe_complete_step`` succeeds; the walk continues to ``workspace_cleanup``
   -> ``{done: true}``.
4. The **false-Done regression**: ``next_step`` is never ``Done`` while any step
   on the row is still ``locked``.

Tampers (each flips a green test to red; run manually, restore clean):
- **T1** drop ``_rewire_gates`` -> the invariant (rewired == 0) and the false-Done
  regression fail.
- **T2** rewire to the *immediately-preceding* visible step -> the target pin
  fails (``gagent_optimize`` != ``activation_deploy_validate``).
- **T3** revert ``engine.complete_step`` to look up ``track_steps`` -> the
  end-to-end ``vibe_complete_step(iterate_enhance)`` fails ``STEP_LOCKED``.
"""

import copy
import itertools
import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.workshop import engine
from src.backend.workshop.manifest import USE_CASE_GATE

MANIFEST = engine.MANIFEST
TRACK = "genie-accelerator"

# Documented before/after counts (the "898 -> 0" proof folded into the PR body).
# Counting the authored-gate (un-rewired) composition's invariant violations:
EXPECTED_VIOLATIONS_TRACK_FLAG = 898  # over the 384 track x flag combos (inputs defaulted)
EXPECTED_VIOLATIONS_FULL_SPACE = 1226  # over the full 520-combo space (incl. composition inputs)
EXPECTED_TRACK_FLAG_COMBOS = 384
EXPECTED_FULL_SPACE_COMBOS = 520


# --- combo-space enumeration --------------------------------------------------


def _flag_combos(track) -> list[dict[str, bool]]:
    names = list(track.flags)
    return [dict(zip(names, bits)) for bits in itertools.product((False, True), repeat=len(names))]


def _input_options(track) -> list[dict[str, str]]:
    """The composition inputs this track's variants key on.

    Each distinct ``when`` key becomes an axis of ``{{}}`` (the default / absent
    value) plus one option per value the variants use (``direction=reverse``,
    ``chainContext=app``). Their product is the composition-input space; a track
    with no variants yields the single empty input."""

    keyed: dict[str, set[str]] = {}
    for variant in track.variants:
        for key, value in variant.when.items():
            keyed.setdefault(key, set()).add(value)
    if not keyed:
        return [{}]
    axes = [[{}] + [{key: value} for value in sorted(values)] for key, values in keyed.items()]
    options: list[dict[str, str]] = []
    for combo in itertools.product(*axes):
        merged: dict[str, str] = {}
        for part in combo:
            merged.update(part)
        options.append(merged)
    return options


def _all_combos(*, with_inputs: bool):
    """Yield ``(track_id, flags, inputs)`` over the enumerated space."""

    for track_id, track in MANIFEST.tracks.items():
        input_space = _input_options(track) if with_inputs else [{}]
        for flags in _flag_combos(track):
            for inputs in input_space:
                yield track_id, flags, inputs


def _raw_composed(track_id: str, flags: dict, inputs: dict):
    """Replicate ``outline_order``'s flag filter WITHOUT the gate rewire.

    Built from the public manifest structure (``sections_for`` + ``track.flags``)
    so it stays the authored-gate baseline even if ``_rewire_gates`` is dropped
    (T1): with the rewire removed, ``outline_order`` collapses onto this and the
    rewired-violation assertions below go red."""

    track = MANIFEST.tracks[track_id]
    steps = []
    for section in track.sections_for(inputs):
        for step in section.steps:
            if step.flag is None:
                steps.append(step)
                continue
            flag_definition = track.flags.get(step.flag)
            default = flag_definition.default if flag_definition else False
            if bool(flags.get(step.flag, default)):
                steps.append(step)
    return steps


def _invariant_violations(steps) -> list[tuple[str, str]]:
    """Steps whose ``requiresGate`` is not None / use-case / an EARLIER visible step."""

    seen: set[str] = set()
    violations: list[tuple[str, str]] = []
    for step in steps:
        gate = step.requiresGate
        if not (gate is None or gate == USE_CASE_GATE or gate in seen):
            violations.append((step.sectionTag, gate))
        seen.add(step.sectionTag)
    return violations


# --- 1. the all-tracks gate invariant (898 -> 0) ------------------------------


def test_combo_space_shape_is_as_documented():
    """Guard the enumeration itself so the counts below mean what they claim."""

    assert sum(1 for _ in _all_combos(with_inputs=False)) == EXPECTED_TRACK_FLAG_COMBOS
    assert sum(1 for _ in _all_combos(with_inputs=True)) == EXPECTED_FULL_SPACE_COMBOS


def test_rewired_composition_has_zero_gate_invariant_violations():
    """The invariant holds for EVERY track x flag combo x composition input."""

    offenders: list[str] = []
    for track_id, flags, inputs in _all_combos(with_inputs=True):
        composed = MANIFEST.outline_order(track_id, flags=flags, inputs=inputs)
        for tag, gate in _invariant_violations(composed):
            offenders.append(f"{track_id} flags={flags} inputs={inputs}: {tag}.requiresGate={gate}")
    assert offenders == [], "dangling gates survived the rewire:\n" + "\n".join(offenders[:20])


def test_before_after_invariant_counts_track_flag_space():
    """898 -> 0 over the 384 track x flag combos (the headline proof)."""

    before = sum(
        len(_invariant_violations(_raw_composed(track_id, flags, inputs)))
        for track_id, flags, inputs in _all_combos(with_inputs=False)
    )
    after = sum(
        len(_invariant_violations(MANIFEST.outline_order(track_id, flags=flags, inputs=inputs)))
        for track_id, flags, inputs in _all_combos(with_inputs=False)
    )
    assert before == EXPECTED_VIOLATIONS_TRACK_FLAG
    assert after == 0


def test_before_after_invariant_counts_full_space():
    """1226 -> 0 over the full space including composition inputs."""

    before = sum(
        len(_invariant_violations(_raw_composed(track_id, flags, inputs)))
        for track_id, flags, inputs in _all_combos(with_inputs=True)
    )
    after = sum(
        len(_invariant_violations(MANIFEST.outline_order(track_id, flags=flags, inputs=inputs)))
        for track_id, flags, inputs in _all_combos(with_inputs=True)
    )
    assert before == EXPECTED_VIOLATIONS_FULL_SPACE
    assert after == 0


def test_all_dangling_gates_are_backward_no_forward_references():
    """The authored dangling gates are all ``dangling_filtered`` — a filtered-out
    prerequisite — never a forward reference to a later visible step. This is what
    lets the ancestor walk resolve 100% of them (``forward == 0`` in the sweep)."""

    forward = 0
    for track_id, flags, inputs in _all_combos(with_inputs=True):
        raw = _raw_composed(track_id, flags, inputs)
        position = {step.sectionTag: index for index, step in enumerate(raw)}
        for index, step in enumerate(raw):
            gate = step.requiresGate
            if gate is not None and gate != USE_CASE_GATE and position.get(gate, -1) > index:
                forward += 1
    assert forward == 0


# --- 2. the rewire TARGET (what makes T2 fail) --------------------------------


def test_rewire_target_genie_accelerator_defaults():
    """genie-accelerator defaults -> composed ``iterate_enhance`` is gated on
    ``gagent_optimize`` (the nearest in-outline ancestor of the filtered
    ``ontology_routing`` chain), NOT the immediate predecessor."""

    composed = MANIFEST.outline_order(TRACK, flags={}, inputs={})
    by_tag = {step.sectionTag: step for step in composed}
    assert "iterate_enhance" in by_tag
    assert by_tag["iterate_enhance"].requiresGate == "gagent_optimize"

    # Pin the authored gate was dangling and that the rewire is NOT the immediate
    # predecessor (otherwise T2 would pass vacuously).
    authored = {step.sectionTag: step for step in MANIFEST.track_steps(TRACK)}
    assert authored["iterate_enhance"].requiresGate == "ontology_routing"
    order = [step.sectionTag for step in composed]
    predecessor = order[order.index("iterate_enhance") - 1]
    assert predecessor == "activation_deploy_validate"
    assert by_tag["iterate_enhance"].requiresGate != predecessor


def test_rewire_never_mutates_shared_step_objects():
    """The rewire copies via ``dataclasses.replace`` — the authored ``Step`` the
    track still exposes keeps its original (dangling) gate."""

    MANIFEST.outline_order(TRACK, flags={}, inputs={})
    authored = {step.sectionTag: step for step in MANIFEST.track_steps(TRACK)}
    assert authored["iterate_enhance"].requiresGate == "ontology_routing"


# --- 3. end-to-end agreement over MCP (what makes T3 fail) --------------------

SESSION_ID = "gate-rewire-e2e"


def _regression_completed_gates() -> list[str]:
    """genie defaults completed through ``activation_deploy_validate`` (plus the
    pre-journey use-case gate)."""

    order = [step.sectionTag for step in MANIFEST.outline_order(TRACK, flags={}, inputs={})]
    through = order[: order.index("activation_deploy_validate") + 1]
    return ["use_case_selection", *through]


@pytest.fixture
def session_store(monkeypatch):
    store = {
        SESSION_ID: {
            "session_id": SESSION_ID,
            "created_by": None,
            "workshop_level": "genie-accelerator",
            "completed_gates": _regression_completed_gates(),
            "captured_outputs": {"use_case_brief": "demo brief"},
            "session_parameters": {"use_case": "demo", "use_case_label": "Demo"},
        }
    }

    def load_session(session_id):
        record = store.get(session_id)
        return copy.deepcopy(record) if record is not None else None

    def save_session(session_id, **fields):
        record = store.setdefault(session_id, {"session_id": session_id})
        record.update(copy.deepcopy({k: v for k, v in fields.items() if v is not None}))
        return True

    monkeypatch.setattr(mcp_server, "load_session", load_session)
    monkeypatch.setattr(mcp_server, "save_session", save_session)
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: True)
    # Render step payloads without a live assembler / FMAPI data call.
    monkeypatch.setattr(
        mcp_server.assembler,
        "get_section_input_content",
        lambda **kwargs: {"input": "PROMPT", "user_trigger_prompt": "GO"},
    )
    return store


def _next_tag(result):
    assert not isinstance(result, dict), f"unexpected error from vibe_next_step: {result}"
    inner = result.root
    assert not isinstance(inner, mcp_server.DoneResult), "unexpected Done from vibe_next_step"
    return inner.sectionTag


def _is_done(payload) -> bool:
    return isinstance(payload, mcp_server.DoneResult) or getattr(payload, "done", False) is True


def test_mcp_end_to_end_through_rewired_gate(session_store):
    # vibe_next_step points at the rewired step...
    assert _next_tag(mcp_server.vibe_next_step(SESSION_ID)) == "iterate_enhance"

    # ...and vibe_get_step agrees it is open (not STEP_LOCKED): resolve_step hands
    # back the composed-outline copy whose gate (gagent_optimize) is satisfied.
    got = mcp_server.vibe_get_step(SESSION_ID, "iterate_enhance")
    assert not isinstance(got, dict), f"vibe_get_step reported an error: {got}"
    assert got.sectionTag == "iterate_enhance"

    # vibe_complete_step succeeds (fails STEP_LOCKED under T3) and the walk runs to
    # the end of the track.
    for tag in ("iterate_enhance", "redeploy_test", "workspace_cleanup"):
        assert _next_tag(mcp_server.vibe_next_step(SESSION_ID)) == tag
        result = mcp_server.vibe_complete_step(SESSION_ID, tag, "ok")
        assert not isinstance(result, dict), f"vibe_complete_step({tag}) errored: {result}"
        assert tag in result.completed_gates

    # Track complete -> {done: true}.
    final = mcp_server.vibe_next_step(SESSION_ID)
    assert not isinstance(final, dict)
    assert _is_done(final.root)
    completed = mcp_server.vibe_complete_step(SESSION_ID, "workspace_cleanup", "ok")
    # Re-completing the last step is idempotent and its ``next`` is Done.
    assert not isinstance(completed, dict)
    assert _is_done(completed.next)


def test_resolve_step_reads_rewired_gate_not_authored(session_store):
    """``engine.resolve_step`` returns the composed-outline copy (rewired gate),
    the seam T3 reverts. The authored lookup would carry ``ontology_routing``."""

    record = session_store[SESSION_ID]
    state = engine.SessionState(
        completed_gates=list(record["completed_gates"]),
        captured_outputs=dict(record["captured_outputs"]),
        session_parameters=dict(record["session_parameters"]),
    )
    resolved = engine.resolve_step(TRACK, state, "iterate_enhance")
    assert resolved is not None
    assert resolved.requiresGate == "gagent_optimize"


# --- 4. false-Done regression (what T1 re-breaks) -----------------------------


def _assert_no_premature_done(track_id: str, state: engine.SessionState) -> None:
    """``next_step`` may only be ``Done`` when NO step is still ``locked``."""

    nxt = engine.next_step(track_id, state)
    if isinstance(nxt, engine.Done):
        locked = [s.sectionTag for s in engine.outline(track_id, state) if s.status == "locked"]
        assert locked == [], f"{track_id}: next_step=Done while locked remain: {locked}"


def test_next_step_not_done_while_locked_on_regression_row():
    """The exact bug row: genie defaults completed through activation_deploy_validate
    must advance to iterate_enhance, never a false Done (fails under T1)."""

    state = engine.SessionState(
        completed_gates=_regression_completed_gates(),
        captured_outputs={"use_case_brief": "demo brief"},
        session_parameters={"use_case": "demo"},
    )
    _assert_no_premature_done(TRACK, state)
    assert engine.next_step(TRACK, state).sectionTag == "iterate_enhance"


def test_fresh_sessions_never_report_premature_done():
    """Across the full combo space, a fresh session (nothing completed) never
    reports Done while steps are locked."""

    for track_id, flags, inputs in _all_combos(with_inputs=True):
        state = engine.SessionState(session_parameters=dict(flags, **inputs))
        _assert_no_premature_done(track_id, state)
