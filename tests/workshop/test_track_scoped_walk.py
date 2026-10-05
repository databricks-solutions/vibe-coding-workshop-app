"""P4.1 — the session's track drives every MCP walk tool (D-30, D-30a, D-31).

Before P4.1 the walk was pinned to ``genie-accelerator`` (``DEFAULT_TRACK``) and
``vibe_start_track`` stamped that pin whatever track was requested. Now the walk
resolves the session's track with ``track_resolution.resolve_track`` unchanged (the
SPA's rule), and ``vibe_start_track`` stamps the requested track.

The W1 expectations are INDEPENDENT of the engine: they come straight from the
manifest.json data (ordered step lists, ``requiresGate``, flag defaults), not from
engine functions, so the test cannot pass by delegating to the code under test.

Expectation rule (W1/W1b): with the use case resolved (gate ``use_case_selection``),
the step a session should get is the first step, in the track's base-section JSON
order, that is not completed, is not switched off by a default-off flag
(``flags[*].affectsSteps`` with ``default: false``), and whose ``requiresGate`` is
null or already completed.
"""

import ast
import asyncio
import copy
import json
import pathlib
import sys
from dataclasses import asdict

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.services import coaching
from src.backend.workshop import engine
from src.backend.workshop.state import build_session_state
from src.backend.workshop.track_resolution import resolve_track

MANIFEST_JSON = json.loads(
    (REPO_ROOT / "src" / "backend" / "workshop" / "manifest.json").read_text()
)["tracks"]
ALL_TRACKS = sorted(MANIFEST_JSON)
USE_CASE_GATE = "use_case_selection"
INDUSTRY = "travel"
USE_CASE = "ai_driven_booking"
# resolve_track downgrades skills-accelerator to end-to-end unless the use case is
# its lock (USE_CASE_LEVEL_LOCK: build_skill), exactly as the SPA does, so the
# skills-accelerator walk is started with that use case.
USE_CASE_FOR = {"skills-accelerator": "build_skill"}
# W1 walks this many steps past the first through vibe_next_step.
WALK_DEPTH = 3


def _json_steps(track):
    return [step for section in MANIFEST_JSON[track]["sections"] for step in section["steps"]]


def _json_all_tags(track):
    """Every sectionTag the track authors, base sections and variants alike."""

    data = MANIFEST_JSON[track]
    tags = {step["sectionTag"] for step in _json_steps(track)}
    for variant in data.get("variants") or []:
        tags |= {step["sectionTag"] for section in variant["sections"] for step in section["steps"]}
    return tags


def _json_default_off(track):
    return {
        tag
        for flag in (MANIFEST_JSON[track].get("flags") or {}).values()
        if not flag.get("default")
        for tag in flag.get("affectsSteps") or []
    }


def _expected_next(track, completed):
    off = _json_default_off(track)
    for step in _json_steps(track):
        tag = step["sectionTag"]
        if tag in completed or tag in off:
            continue
        gate = step.get("requiresGate")
        if gate is None or gate in completed:
            return tag
    return None


EXPECTED_FIRST = {track: _expected_next(track, {USE_CASE_GATE}) for track in ALL_TRACKS}


def _foreign_tag(track):
    """A tag some OTHER track authors that this track never does (None if none)."""

    own = _json_all_tags(track)
    for other in ALL_TRACKS:
        if other == track:
            continue
        for step in _json_steps(other):
            if step["sectionTag"] not in own:
                return step["sectionTag"]
    return None


def _code(result):
    assert isinstance(result, dict), result
    return result["error"]["code"]


@pytest.fixture
def walk_env(monkeypatch):
    """In-memory Lakebase store with the curated catalogue stubbed (offline)."""

    store: dict = {}
    saves: list = []

    def load_session(session_id):
        record = store.get(session_id)
        return copy.deepcopy(record) if record is not None else None

    def save_session(session_id, **fields):
        saves.append((session_id, copy.deepcopy(fields)))
        store.setdefault(session_id, {"session_id": session_id}).update(copy.deepcopy(fields))
        return True

    monkeypatch.setattr(mcp_server, "load_session", load_session)
    monkeypatch.setattr(mcp_server, "save_session", save_session)
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: True)
    monkeypatch.setattr(mcp_server, "_request_user", lambda ctx: "learner@acme.com")
    monkeypatch.setattr(mcp_server, "_curated_pair_status", lambda industry, use_case: "known")
    monkeypatch.setattr(mcp_server, "_industry_label_for", lambda industry, echo: "Travel")
    monkeypatch.setattr(mcp_server, "_use_case_label_for", lambda industry, use_case: None)
    return store, saves


def _start(track, *, use_case=None, industry=INDUSTRY):
    use_case = use_case or USE_CASE_FOR.get(track, USE_CASE)
    started = mcp_server.vibe_start_track(track, use_case=use_case, industry=industry)
    assert not isinstance(started, dict), started
    return started.session_id


# --- W1: every track walks its own steps ---------------------------------------


@pytest.mark.parametrize("track", ALL_TRACKS)
def test_w1_walk_follows_the_session_track(walk_env, track):
    store, saves = walk_env
    first = EXPECTED_FIRST[track]
    assert first is not None, track

    sid = _start(track)
    seed = [fields for (s, fields) in saves if s == sid][0]
    assert seed.get("workshop_level") == track

    nxt = mcp_server.vibe_next_step(sid)
    assert nxt.root.sectionTag == first
    got = mcp_server.vibe_get_step(sid)
    assert got.sectionTag == first

    completed = mcp_server.vibe_complete_step(sid, first, "done")
    assert not isinstance(completed, dict), completed
    expected_second = _expected_next(track, {USE_CASE_GATE, first})
    assert completed.next.sectionTag == expected_second
    assert completed.next.sectionTag in _json_all_tags(track)
    assert completed.next.sectionTag != first

    # Keep walking through vibe_next_step: the tracks share their opening steps,
    # so a walk pinned to another track only shows past them.
    done = {USE_CASE_GATE, first}
    for _ in range(WALK_DEPTH):
        expected = _expected_next(track, done)
        if expected is None:
            break
        assert mcp_server.vibe_next_step(sid).root.sectionTag == expected
        assert not isinstance(mcp_server.vibe_complete_step(sid, expected, "out"), dict)
        done.add(expected)

    foreign = _foreign_tag(track)
    if foreign is None:
        pytest.skip(f"{track} authors every tag another track authors")
    assert _code(mcp_server.vibe_get_step(sid, foreign)) == "UNKNOWN_STEP"


def test_w1_expectations_from_json():
    # The JSON data itself: every track opens on project_setup; the second step is
    # prd_generation except on skills-accelerator (skill_install_explore).
    for track in ALL_TRACKS:
        assert EXPECTED_FIRST[track] == "project_setup", track
        second = _expected_next(track, {USE_CASE_GATE, "project_setup"})
        assert second == ("skill_install_explore" if track == "skills-accelerator" else "prd_generation")


def test_w1_lakehouse_walk_never_leaves_the_lakehouse_steps(walk_env):
    sid = _start("lakehouse")
    own = _json_all_tags("lakehouse")
    seen = []
    for _ in range(len(_json_steps("lakehouse")) + 1):
        nxt = mcp_server.vibe_next_step(sid).root
        if not hasattr(nxt, "sectionTag"):
            break
        assert nxt.sectionTag in own, nxt.sectionTag
        seen.append(nxt.sectionTag)
        done = mcp_server.vibe_complete_step(sid, nxt.sectionTag, "out")
        if isinstance(done, dict):
            break
    assert len(seen) >= 2, seen


# --- W1b: cross-track isolation -------------------------------------------------


def test_w1b_interleaved_sessions_stay_on_their_own_tracks(walk_env):
    tracks = {"genie-accelerator": _start("genie-accelerator"), "app-only": _start("app-only")}
    completed = {track: {USE_CASE_GATE} for track in tracks}
    for _ in range(3):
        for track, sid in tracks.items():
            nxt = mcp_server.vibe_next_step(sid).root
            assert nxt.sectionTag == _expected_next(track, completed[track]), track
            assert nxt.sectionTag in _json_all_tags(track)
            done = mcp_server.vibe_complete_step(sid, nxt.sectionTag, "out")
            assert not isinstance(done, dict), done
            completed[track].add(nxt.sectionTag)


# --- W2: the state resource's outline is the session track's outline -----------


@pytest.mark.parametrize("track", ALL_TRACKS)
def test_w2_state_resource_outline_matches_the_track(walk_env, track):
    store, _ = walk_env
    sid = _start(track)
    resource = json.loads(mcp_server._session_state_resource(sid))
    state = build_session_state(store[sid], track)
    assert resource["outline"] == [asdict(item) for item in engine.outline(track, state)]


# --- W3: resolution is resolve_track unchanged (D-30) ---------------------------


@pytest.mark.parametrize(
    ("record", "expected"),
    [
        ({"workshop_level": "lakehouse"}, "lakehouse"),
        ({"workshop_level": "lakehouse", "use_case": "build_skill"}, "skills-accelerator"),
        # Legacy MCP session: no real level, coding_assistant=genie-code.
        ({"workshop_level": "300", "session_parameters": {"coding_assistant": "genie-code"}}, "genie-accelerator"),
        ({"workshop_level": "garbage", "session_parameters": {"coding_assistant": "genie-code"}}, "genie-accelerator"),
        # No level, lock or assistant: the SPA's system default.
        ({}, "end-to-end"),
        ({"workshop_level": "garbage"}, "end-to-end"),
        ({"workshop_level": "skills-accelerator"}, "end-to-end"),
    ],
)
def test_w3_session_track_is_resolve_track(record, expected):
    assert mcp_server._session_track(record) == expected
    assert mcp_server._session_track(record) == resolve_track(record)


def test_w3_load_returns_the_resolved_track(walk_env):
    store, _ = walk_env
    store["s"] = {"session_id": "s", "workshop_level": "lakehouse", "session_parameters": {}}
    state, sid, track = mcp_server._load_session_and_track("s")
    assert (sid, track) == ("s", "lakehouse")
    # An explicit track (vibe_start_track's request) wins.
    assert mcp_server._load_session_and_track("s", None, "app-only")[2] == "app-only"
    # The 2-tuple contract is unchanged (D-32).
    assert mcp_server._load_session_for_request("s")[1] == "s"
    assert len(mcp_server._load_session_for_request("s")) == 2


def test_w3_no_record_without_lakebase_falls_back_to_genie_accelerator(monkeypatch):
    monkeypatch.setattr(mcp_server, "load_session", lambda sid: None)
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: False)
    assert mcp_server._load_session_and_track("local")[2] == "genie-accelerator"
    assert mcp_server._load_session_and_track("local", None, "lakehouse")[2] == "lakehouse"


# --- W4: session names (D-31) ---------------------------------------------------


def _seed_name(saves, sid):
    return [fields for (s, fields) in saves if s == sid][0]["session_name"]


def test_w4_genie_accelerator_names_are_byte_identical(walk_env):
    _, saves = walk_env
    assert _seed_name(saves, _start("genie-accelerator", use_case="Demand")) == "Genie Code — Demand"
    started = mcp_server.vibe_start_track("genie-accelerator")
    assert _seed_name(saves, started.session_id) == "Genie Code Workshop"


def test_w4_other_tracks_add_the_track_title(walk_env):
    _, saves = walk_env
    title = MANIFEST_JSON["lakehouse"]["title"]
    assert _seed_name(saves, _start("lakehouse", use_case="Demand")) == f"Genie Code — {title}: Demand"
    started = mcp_server.vibe_start_track("lakehouse")
    assert _seed_name(saves, started.session_id) == f"Genie Code — {title}"


def test_w4_lock_refines_the_name_with_the_session_track(walk_env):
    _, saves = walk_env
    started = mcp_server.vibe_start_track("app-only")
    sid = started.session_id
    mcp_server.vibe_set_parameters(
        sid,
        {
            "use_case_source": "curated",
            "industry": INDUSTRY,
            "use_case": USE_CASE,
            "use_case_label": "AI Booking",
        },
    )
    names = [fields.get("session_name") for (s, fields) in saves if s == sid]
    assert f"Genie Code — {MANIFEST_JSON['app-only']['title']}: AI Booking" in names


# --- D-30a: the use-case fallback is the track's manifest title -----------------


def test_d30a_default_use_case_is_the_manifest_title():
    for track in ALL_TRACKS:
        assert mcp_server._default_use_case(track) == MANIFEST_JSON[track]["title"]
    assert mcp_server._default_use_case("genie-accelerator") == "Genie Accelerator"


def test_d30a_step_payload_renders_with_the_track_title(monkeypatch):
    seen = []
    real = mcp_server.assembler.get_section_input_content

    def spy(**kwargs):
        seen.append(kwargs["use_case"])
        return real(**kwargs)

    monkeypatch.setattr(mcp_server.assembler, "get_section_input_content", spy)
    step = engine.resolve_step("lakehouse", engine.SessionState(), "prd_generation")
    mcp_server._step_payload("lakehouse", engine.SessionState(), step)
    assert seen == [MANIFEST_JSON["lakehouse"]["title"]]


# --- W5: prompts and tool count -------------------------------------------------


def _prompts():
    return {prompt.name: prompt for prompt in mcp_server.mcp._prompt_manager.list_prompts()}


def _render(name, arguments):
    messages = asyncio.run(_prompts()[name].render(arguments))
    return "\n".join(message.content.text for message in messages)


def test_w5_start_track_prompt(walk_env):
    assert "Start a workshop track" in _prompts()
    text = _render("Start a workshop track", {"track": "lakehouse", "use_case": "u"})
    assert 'track:"lakehouse"' in text and "vibe_start_track" in text and "vibe_get_step" in text
    unknown = _render("Start a workshop track", {"track": "nope"})
    assert "Unknown workshop track: nope" in unknown
    for track in ALL_TRACKS:
        assert track in unknown
    assert "Valid tracks:" in _render("Start a workshop track", {})


def test_w5_start_genie_accelerator_is_unchanged():
    expected_tail = (
        'Start the Genie Accelerator by calling `vibe_start_track` with '
        '{track:"genie-accelerator", use_case="U", industry="I"}, then call `vibe_get_step`. '
        "Present the returned `prompt` verbatim first, then narrate `why`, the gate, and the next "
        "step, and show `user_trigger_prompt` verbatim before waiting. Call `vibe_explain_step` if the "
        "learner asks how to apply the step or what to expect. Keep questions in chat."
    )
    assert mcp_server.start_genie_accelerator("U", "I") == f"{mcp_server.ORIENTATION_PREAMBLE}\n\n{expected_tail}"


def test_w5_tool_count_is_seven():
    assert len(mcp_server.mcp._tool_manager.list_tools()) == 7


# --- W6: coaching receives the session track ------------------------------------


def test_w6_explain_focus_passes_the_session_track(walk_env, monkeypatch):
    calls = []

    def fake_coach(**kwargs):
        calls.append(kwargs)
        return coaching.CoachOutcome(coaching=None, grounded_on=(), is_fallback=True)

    monkeypatch.setattr(mcp_server.coaching, "coach", fake_coach)
    sid = _start("lakehouse")
    mcp_server.vibe_explain_step(sid, focus="why")
    assert [call["track"] for call in calls] == ["lakehouse"]


# --- W7: no walk tool uses DEFAULT_TRACK ----------------------------------------


def test_w7_default_track_only_in_its_definition_and_the_fallback():
    tree = ast.parse((REPO_ROOT / "src" / "backend" / "mcp_server.py").read_text())
    allowed = {"_session_track", "_load_session_and_track"}
    offenders = []

    def visit(node, function):
        for child in ast.iter_child_nodes(node):
            inner = child.name if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)) else function
            if isinstance(child, ast.Name) and child.id == "DEFAULT_TRACK":
                is_definition = function is None and isinstance(child.ctx, ast.Store)
                if not is_definition and function not in allowed:
                    offenders.append((function, child.lineno))
            visit(child, inner)

    visit(tree, None)
    assert offenders == []
