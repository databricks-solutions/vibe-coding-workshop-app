"""Phase 3 · T5 · PR B — the ``blocked`` safety net.

PR A rewired dangling gates so a composed outline can no longer wedge a step
behind an unsatisfiable prerequisite; after it, ``next_step`` on authored data is
always a ``current`` step or a true ``Done``. PR B adds the safety net for a
FUTURE gate-data defect: when the scan finds no ``current`` step yet a ``locked``
step survives, ``next_step`` returns ``Blocked`` (naming the first locked step)
instead of a false ``Done``, and ``vibe_next_step`` surfaces it as the third
union member ``{blocked:true, blocked_by, message}``.

Because the blocked path is unreachable on authored data post-PR-A, the forced
block is manufactured by MONKEYPATCHing the composed outline to a deliberately
broken one (a dangling ``requiresGate``) — NOT the ``use_case_selection`` row,
which PR A's pre-journey intent beat intercepts before the engine scan.

OFFLINE ONLY — no live smoke (the path cannot be reached by a real session).

Tampers (each flips a green test to red; run manually, restore clean):
- **T1** revert ``engine.next_step`` to an unconditional ``Done()`` -> the
  forced-blocked tests (engine + MCP) fail (``Blocked`` expected, ``Done`` seen).
- **T2** strip ``BlockedResult`` from the ``NextStepResult`` union (or drop its
  ``blocked_by`` field) -> ``test_mcp_contract`` blocked-variant validation fails.
- **T3** make ``Done`` fire while a locked step remains -> the done-invariant
  test fails (``next_step`` is ``Done`` with ``beta`` still ``locked``).
"""

import asyncio
import copy
import itertools
import pathlib
import sys

import jsonschema
import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.workshop import engine, manifest
from src.backend.workshop.manifest import USE_CASE_GATE

TRACK = "genie-accelerator"
SESSION_ID = "blocked-safety-net"

# A deliberately broken two-step composition: ``alpha`` is open-then-done, and
# ``beta`` is gated on ``ghost_gate`` — a gate that is neither completed nor a
# member of this outline, so it can never be satisfied. With ``alpha`` complete,
# ``beta`` is the only remaining step and it is permanently ``locked``: no
# ``current`` step, but the track is NOT finished.
STEPS = [
    manifest.Step(order=1, sectionTag="alpha", title="Alpha", requiresGate=None),
    manifest.Step(order=2, sectionTag="beta", title="Beta", requiresGate="ghost_gate"),
]


def _patch_dangling(monkeypatch) -> None:
    """Force every composition to the broken STEPS outline.

    ``engine.next_step`` reads the ordered steps through ``engine._ordered_steps``
    (directly and via ``engine.outline``), so patching that single seam injects
    the dangling-gate composition into both the engine scan and the MCP handler
    without touching the frozen manifest."""

    monkeypatch.setattr(engine, "_ordered_steps", lambda track_id, session: list(STEPS))


def _blocked_state() -> engine.SessionState:
    """``alpha`` done, ``beta`` locked behind ``ghost_gate`` — the wedged state."""

    return engine.SessionState(
        completed_gates=["use_case_selection", "alpha"],
        captured_outputs={"use_case_brief": "demo brief"},
        session_parameters={"use_case": "demo", "use_case_label": "Demo"},
    )


# --- 1. engine: Blocked carries the first locked step -------------------------


def test_next_step_returns_blocked_naming_first_locked_step(monkeypatch):
    _patch_dangling(monkeypatch)
    result = engine.next_step(TRACK, _blocked_state())
    assert isinstance(result, engine.Blocked)
    assert not isinstance(result, engine.Done)
    assert result.sectionTag == "beta"
    assert result.title == "Beta"
    assert result.requiresGate == "ghost_gate"


# --- 2. engine: the done-invariant (what T3 re-breaks) ------------------------


def test_done_never_fires_while_a_step_is_locked(monkeypatch):
    """``Done`` is reserved for all-done-or-skipped; ANY locked step -> never Done."""

    _patch_dangling(monkeypatch)
    state = _blocked_state()
    locked = [s.sectionTag for s in engine.outline(TRACK, state) if s.status == "locked"]
    assert locked == ["beta"]
    assert not isinstance(engine.next_step(TRACK, state), engine.Done)


def test_done_fires_when_all_steps_done_or_skipped(monkeypatch):
    _patch_dangling(monkeypatch)

    # Every step completed -> Done (unchanged behavior).
    all_done = engine.SessionState(completed_gates=["use_case_selection", "alpha", "beta"])
    assert isinstance(engine.next_step(TRACK, all_done), engine.Done)

    # The locked step skipped (alpha done, beta skipped) -> Done, not Blocked.
    skipped = engine.SessionState(
        completed_gates=["use_case_selection", "alpha"],
        session_parameters={"skipped_gates": ["beta"]},
    )
    statuses = {s.sectionTag: s.status for s in engine.outline(TRACK, skipped)}
    assert statuses == {"alpha": "done", "beta": "skipped"}
    assert isinstance(engine.next_step(TRACK, skipped), engine.Done)


# --- 3. MCP: vibe_next_step surfaces the blocked variant ----------------------


@pytest.fixture
def session_store(monkeypatch):
    store = {
        SESSION_ID: {
            "session_id": SESSION_ID,
            "created_by": None,
            "completed_gates": ["use_case_selection", "alpha"],
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
    _patch_dangling(monkeypatch)
    return store


def test_vibe_next_step_returns_blocked_variant(session_store):
    result = mcp_server.vibe_next_step(SESSION_ID)
    assert not isinstance(result, dict), f"unexpected error: {result}"
    inner = result.root
    assert isinstance(inner, mcp_server.BlockedResult)
    assert inner.blocked is True
    # A blocked payload must NOT look like a step — no top-level sectionTag/title.
    assert not hasattr(inner, "sectionTag")
    assert inner.blocked_by.sectionTag == "beta"
    assert inner.blocked_by.title == "Beta"
    assert inner.blocked_by.requiresGate == "ghost_gate"
    # Deterministic, no-LLM message naming the step and the gate.
    assert "Beta" in inner.message and "ghost_gate" in inner.message
    assert "configuration problem" in inner.message


def test_vibe_next_step_blocked_is_contract_valid(session_store):
    """The blocked variant schema-validates against the live tool output schema."""

    tool = next(
        t for t in mcp_server.mcp._tool_manager.list_tools() if t.name == "vibe_next_step"
    )
    _text, structured = asyncio.run(tool.run({"session_id": SESSION_ID}, convert_result=True))
    jsonschema.validate(structured, tool.output_schema)
    emitted = structured.get("result", structured)
    assert emitted["blocked"] is True
    assert emitted["blocked_by"]["sectionTag"] == "beta"
    assert "sectionTag" not in emitted  # top-level step shape is forbidden


# --- 4. fold-in: authored active-section gate graph is clean ------------------
#
# The rewire's ancestor walk (manifest._nearest_outline_ancestor) returns None on
# a cycle or a missing link, which would silently unlock the dangling step. Its
# docstring claims both are "0 occurrences in the manifest today"; this pins that
# claim — cycle == 0 AND missing == 0 across the whole composed combo space — so
# the defensive None->unlock path is never exercised by authored data.

MANIFEST = engine.MANIFEST


def _flag_combos(track):
    names = list(track.flags)
    return [dict(zip(names, bits)) for bits in itertools.product((False, True), repeat=len(names))]


def _input_options(track):
    keyed: dict[str, set[str]] = {}
    for variant in track.variants:
        for key, value in variant.when.items():
            keyed.setdefault(key, set()).add(value)
    if not keyed:
        return [{}]
    axes = [[{}] + [{key: value} for value in sorted(values)] for key, values in keyed.items()]
    options = []
    for combo in itertools.product(*axes):
        merged: dict[str, str] = {}
        for part in combo:
            merged.update(part)
        options.append(merged)
    return options


def _classify_walk(gate, outline_tags, active_map):
    """Mirror ``_nearest_outline_ancestor`` but name WHY the walk terminates."""

    seen: set[str] = set()
    current = gate
    while current is not None:
        if current == USE_CASE_GATE:
            return "use_case"
        if current in outline_tags:
            return "outline"
        required = active_map.get(current)
        if required is None:
            return "missing"
        if current in seen:
            return "cycle"
        seen.add(current)
        current = required.requiresGate
    return "none_link"


def test_authored_gate_graph_has_no_cycles_or_missing_links():
    cycles: list[str] = []
    missing: list[str] = []
    for track_id, track in MANIFEST.tracks.items():
        for flags in _flag_combos(track):
            for inputs in _input_options(track):
                composed = MANIFEST.outline_order(track_id, flags=flags, inputs=inputs)
                outline_tags = {step.sectionTag for step in composed}
                active_map = {
                    step.sectionTag: step
                    for section in track.sections_for(inputs)
                    for step in section.steps
                }
                for tag in outline_tags:
                    gate = active_map[tag].requiresGate
                    if gate is None or gate in outline_tags:
                        continue
                    outcome = _classify_walk(gate, outline_tags, active_map)
                    if outcome == "cycle":
                        cycles.append(f"{track_id} {flags} {inputs}: {tag}->{gate}")
                    elif outcome == "missing":
                        missing.append(f"{track_id} {flags} {inputs}: {tag}->{gate}")
    assert cycles == [], "gate-graph cycles:\n" + "\n".join(cycles[:20])
    assert missing == [], "gate-graph missing links:\n" + "\n".join(missing[:20])


# --- 5. secondary surfaces: every other next_step consumer handles Blocked ----
#
# PR B taught only ``vibe_next_step`` the Blocked variant. These pin the other
# consumers on the same forced-blocked row (``session_store`` -> _patch_dangling).
# Tampers (each flips its own test red; run manually, restore clean):
# - **T4** drop the ``engine.Blocked`` branch in ``vibe_get_step(None)`` ->
#   ``test_vibe_get_step_default_on_blocked_is_unknown_step`` fails.
# - **T5** drop the ``engine.Blocked`` branch in ``vibe_explain_step(None)`` ->
#   ``test_vibe_explain_step_default_on_blocked_is_unknown_step`` fails.
# - **T6** drop the ``engine.Blocked`` branch in the ``vibe_complete_step`` next
#   render -> ``test_vibe_complete_step_next_is_blocked_result`` fails.
# - **T7** revert ``vibe_submit_answer``'s answerable set to Done-only (the locked
#   step becomes answerable) -> ``test_vibe_submit_answer_on_blocked_is_unknown_interaction``
#   fails.


def _assert_blocked_unknown_step(result):
    assert isinstance(result, mcp_server._ContractError), f"expected an error, got {result!r}"
    assert result["isError"] is True
    assert result["error"]["code"] == "UNKNOWN_STEP"
    assert result["error"]["sectionTag"] == "beta"
    assert "Beta" in result["error"]["message"]
    assert "ghost_gate" in result["error"]["message"]
    assert "configuration problem" in result["error"]["message"]


def test_vibe_get_step_default_on_blocked_is_unknown_step(session_store):
    _assert_blocked_unknown_step(mcp_server.vibe_get_step(SESSION_ID))


def test_vibe_explain_step_default_on_blocked_is_unknown_step(session_store):
    _assert_blocked_unknown_step(mcp_server.vibe_explain_step(SESSION_ID))


def test_vibe_complete_step_next_is_blocked_result(session_store):
    # Re-completing ``alpha`` (already done) returns the engine's next_step, which
    # on this row is Blocked on ``beta``.
    result = mcp_server.vibe_complete_step(SESSION_ID, "alpha", "alpha output")
    assert isinstance(result, mcp_server.CompleteStepResult), f"unexpected: {result!r}"
    assert isinstance(result.next, mcp_server.BlockedResult)
    assert result.next.blocked_by.sectionTag == "beta"
    assert result.next.blocked_by.requiresGate == "ghost_gate"
    # extra="forbid" round-trip: the emitted payload is a valid CompleteStepResult.
    dumped = result.model_dump()
    assert mcp_server.CompleteStepResult.model_validate(dumped).next == result.next
    assert "sectionTag" not in dumped["next"]


def test_vibe_submit_answer_on_blocked_is_unknown_interaction(session_store, monkeypatch):
    # Bind a real authored interaction to the locked ``beta`` step so the only
    # thing standing between the agent and recording an answer is the guard.
    _, slot, interaction = mcp_server._find_interaction("project_setup.why")
    monkeypatch.setattr(
        mcp_server,
        "_find_interaction",
        lambda interaction_id: ("beta", slot, interaction) if interaction_id == interaction.id else None,
    )
    recorded: list[dict] = []
    monkeypatch.setattr(
        mcp_server,
        "append_session_interaction",
        lambda **kwargs: recorded.append(kwargs) or True,
        raising=False,
    )
    before = copy.deepcopy(session_store)

    result = mcp_server.vibe_submit_answer(SESSION_ID, interaction.id, "an answer")

    assert isinstance(result, mcp_server._ContractError), f"expected an error, got {result!r}"
    assert result["error"]["code"] == "UNKNOWN_INTERACTION"
    assert recorded == []
    assert session_store == before
