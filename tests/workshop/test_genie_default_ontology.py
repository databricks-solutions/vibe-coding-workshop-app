"""genie-default-ontology PR 2: learner-confirmed ui-driven steps and MCP default-on.

Plan: docs/superpowers/plans/2026-10-15-genie-default-ontology.md ('PR 2', r2.1, r2.2).

- R1: ontology_pages / ontology_routing (the two ui-driven steps) complete over MCP
  only after the learner answers the publish confirm ``published``; the engine
  records ``ui_confirmed:<tag>``; the marker cannot be forged via vibe_set_parameters.
- R2/R4: a NEW genie-accelerator MCP session takes Genie Ontology from
  VIBE_DEFAULT_GENIE_ONTOLOGY (unset = on) and stores view "technical"; resumed
  sessions are untouched; the learner opts out with include_genie_ontology=false.
- D-149: every MCP ontology write lands on all three keys; the snake key wins.

Offline: in-memory session store (the walk_env pattern), no Lakebase.

Tampers (each turns a test here red):
- X4 engine completes a ui-driven step without learner_confirmed
  -> test_engine_ui_driven_needs_learner_confirmed, test_ui_driven_without_confirm_is_gate_required
- X5 drop the ``ui_confirmed:`` prefix rejection -> test_marker_forgery_is_rejected
- X6 vibe_start_track writes only one ontology key -> test_opt_out_writes_all_three_keys,
  test_new_session_defaults_ontology_on
- X7 switch parsed as default false -> test_new_session_defaults_ontology_on,
  test_switch_parsing
- X16 drop the top-level case from the vibe_set_parameters mirror
  -> test_top_level_only_write_mirrors_all_three
"""

import ast
import copy
import logging
import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.api import routes
from src.backend.workshop import engine
from src.backend.workshop.state import build_session_state

TRACK = "genie-accelerator"
ONTOLOGY_TAGS = ["ontology_domain", "ontology_pages", "ontology_routing"]
UI_DRIVEN = ["ontology_pages", "ontology_routing"]
SWITCH = "VIBE_DEFAULT_GENIE_ONTOLOGY"
KEYS = ("include_genie_ontology", "includeGenieOntology")


@pytest.fixture
def env(monkeypatch):
    store: dict = {}
    answers: list = []

    def load_session(session_id):
        record = store.get(session_id)
        return copy.deepcopy(record) if record is not None else None

    def save_session(session_id, **fields):
        store.setdefault(session_id, {"session_id": session_id}).update(copy.deepcopy(fields))
        return True

    def append_session_interaction(**kwargs):
        answers.append(kwargs)
        return True

    monkeypatch.delenv(SWITCH, raising=False)
    monkeypatch.setattr(mcp_server, "load_session", load_session)
    monkeypatch.setattr(mcp_server, "save_session", save_session)
    monkeypatch.setattr(mcp_server, "append_session_interaction", append_session_interaction, raising=False)
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: True)
    monkeypatch.setattr(mcp_server, "_request_user", lambda ctx: "learner@acme.com")
    monkeypatch.setattr(mcp_server, "_curated_pair_status", lambda industry, use_case: "known")
    monkeypatch.setattr(mcp_server, "_industry_label_for", lambda industry, echo: "Travel")
    monkeypatch.setattr(mcp_server, "_use_case_label_for", lambda industry, use_case: None)
    return store


def _start(track=TRACK):
    started = mcp_server.vibe_start_track(track, use_case="ai_driven_booking", industry="travel")
    assert not isinstance(started, dict), started
    return started


def _tags(outline):
    return [item.sectionTag if hasattr(item, "sectionTag") else item["sectionTag"] for item in outline]


def _stored_outline(store, sid, track=TRACK):
    return [item.sectionTag for item in engine.outline(track, build_session_state(store[sid], track))]


def _code(result):
    assert isinstance(result, dict), result
    return result["error"]["code"]


def _walk_to(store, sid, target):
    """Complete steps in order until ``target`` is current (benchmark confirmed on the way)."""

    for tag in _stored_outline(store, sid):
        if tag == target:
            return
        if tag in store[sid].get("completed_gates", []):
            continue
        if tag == "gagent_benchmarks":
            mcp_server.vibe_submit_answer(sid, "gagent_benchmarks.benchmark_confirmation", "confirm")
        done = mcp_server.vibe_complete_step(sid, tag, f"{tag} done")
        assert not isinstance(done, dict), (tag, done)
    raise AssertionError(f"{target} not in outline")


# --- engine ------------------------------------------------------------------------


def test_engine_ui_driven_needs_learner_confirmed():
    state = engine.SessionState(
        session_parameters={"flags": {"includeGenieOntology": True}},
        completed_gates=[],
    )
    outline = engine._ordered_steps(TRACK, state)
    tags = [step.sectionTag for step in outline]
    state.completed_gates = ["use_case_selection", *tags[: tags.index("ontology_pages")]]

    refused = engine.complete_step(TRACK, state, "ontology_pages", "out")
    assert (refused.ok, refused.error_code) == (False, "UI_DRIVEN_STEP")
    assert "ontology_pages" not in state.completed_gates
    assert not any(key.startswith("ui_confirmed:") for key in state.captured_outputs)

    done = engine.complete_step(TRACK, state, "ontology_pages", "out", learner_confirmed=True)
    assert done.ok and "ontology_pages" in state.completed_gates
    assert state.captured_outputs["ui_confirmed:ontology_pages"] == "mcp"


def test_web_paths_never_call_engine_complete_step():
    """No web module calls engine.complete_step, so the False default changes nothing there."""

    callers = []
    for path in (REPO_ROOT / "src" / "backend").rglob("*.py"):
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.Call) and getattr(node.func, "attr", None) == "complete_step":
                callers.append(path.name)
    assert set(callers) == {"mcp_server.py"}


# --- MCP default-on ------------------------------------------------------------------


def test_new_session_defaults_ontology_on(env):
    started = _start()
    tags = _tags(started.outline)
    assert len(tags) == 27
    assert tags[13:16] == ONTOLOGY_TAGS
    params = env[started.session_id]["session_parameters"]
    assert params["include_genie_ontology"] is True
    assert params["includeGenieOntology"] is True
    assert params["flags"]["includeGenieOntology"] is True
    assert params["view"] == "technical"


def test_switch_false_new_sessions_have_24(env, monkeypatch):
    monkeypatch.setenv(SWITCH, "false")
    started = _start()
    assert len(started.outline) == 24
    assert not set(ONTOLOGY_TAGS) & set(_tags(started.outline))
    assert _stored_outline(env, started.session_id) == _tags(started.outline)


@pytest.mark.parametrize(
    "raw, expected",
    [(None, True), ("", True), ("true", True), ("1", True), (" TRUE ", True),
     ("false", False), ("0", False), ("off", False), ("No", False)],
)
def test_switch_parsing(monkeypatch, raw, expected):
    if raw is None:
        monkeypatch.delenv(SWITCH, raising=False)
    else:
        monkeypatch.setenv(SWITCH, raw)
    assert routes.default_genie_ontology() is expected


def test_resumed_pre_change_session_keeps_its_count(env):
    sid = "pre-change"
    env[sid] = {
        "session_id": sid,
        "workshop_level": TRACK,
        "completed_gates": ["use_case_selection", "project_setup"],
        "session_parameters": {"coding_assistant": "genie-code", "industry": "travel", "use_case": "x"},
    }
    resumed = mcp_server.vibe_start_track(TRACK, session_id=sid)
    assert not isinstance(resumed, dict), resumed
    assert len(resumed.outline) == 24
    params = env[sid]["session_parameters"]
    assert "view" not in params
    assert not {"include_genie_ontology", "includeGenieOntology"} & set(params)
    assert "flags" not in params


def test_opt_out_writes_all_three_keys(env):
    sid = _start().session_id
    result = mcp_server.vibe_set_parameters(sid, {"include_genie_ontology": False})
    assert not isinstance(result, dict), result
    params = env[sid]["session_parameters"]
    assert (params["include_genie_ontology"], params["includeGenieOntology"]) == (False, False)
    assert params["flags"]["includeGenieOntology"] is False
    assert len(_stored_outline(env, sid)) == 24


def test_include_genie_ontology_must_be_bool(env):
    sid = _start().session_id
    before = copy.deepcopy(env[sid])
    assert _code(mcp_server.vibe_set_parameters(sid, {"include_genie_ontology": "no"})) == "INVALID_PARAMETER"
    assert env[sid] == before


def test_stale_top_level_key_follows_set_parameters(env, monkeypatch):
    monkeypatch.setenv(SWITCH, "false")
    sid = _start().session_id
    # A legacy top-level camelCase key the UI never cleared, overriding the rest.
    env[sid]["session_parameters"]["includeGenieOntology"] = True
    assert len(_stored_outline(env, sid)) == 27
    mcp_server.vibe_set_parameters(sid, {"include_genie_ontology": False})
    assert len(_stored_outline(env, sid)) == 24
    mcp_server.vibe_set_parameters(sid, {"flags": {"includeGenieOntology": True}})
    assert len(_stored_outline(env, sid)) == 27
    params = env[sid]["session_parameters"]
    assert (params["include_genie_ontology"], params["includeGenieOntology"]) == (True, True)


def test_disagreeing_request_snake_wins_on_all_three(env, caplog):
    sid = _start().session_id
    with caplog.at_level(logging.INFO, logger=mcp_server.logger.name):
        mcp_server.vibe_set_parameters(
            sid, {"include_genie_ontology": False, "flags": {"includeGenieOntology": True}}
        )
    params = env[sid]["session_parameters"]
    assert params["include_genie_ontology"] is False
    assert params["includeGenieOntology"] is False
    assert params["flags"]["includeGenieOntology"] is False
    logged = [r for r in caplog.records if "disagree" in r.getMessage()]
    assert len(logged) == 1 and logged[0].levelno == logging.INFO
    assert logged[0].args == (False, True)


def test_top_level_only_write_mirrors_all_three(env):
    """D-153: a top-level includeGenieOntology alone is an ontology write too."""

    sid = _start().session_id
    assert len(_stored_outline(env, sid)) == 27
    mcp_server.vibe_set_parameters(sid, {"includeGenieOntology": False})
    params = env[sid]["session_parameters"]
    assert params["includeGenieOntology"] is False
    assert params["flags"]["includeGenieOntology"] is False
    # The value the web UI hydrates from.
    assert params["include_genie_ontology"] is False
    assert len(_stored_outline(env, sid)) == 24


def test_flags_beat_top_level_on_disagreement(env, caplog):
    sid = _start().session_id
    with caplog.at_level(logging.INFO, logger=mcp_server.logger.name):
        mcp_server.vibe_set_parameters(
            sid, {"flags": {"includeGenieOntology": False}, "includeGenieOntology": True}
        )
    params = env[sid]["session_parameters"]
    assert (params["include_genie_ontology"], params["includeGenieOntology"]) == (False, False)
    assert params["flags"]["includeGenieOntology"] is False
    logged = [r for r in caplog.records if "disagree" in r.getMessage()]
    assert len(logged) == 1 and logged[0].args == (False, True)


def test_no_other_track_changes(env):
    for track in sorted(engine.MANIFEST.tracks):
        if track in (TRACK, "skills-accelerator"):
            continue
        started = _start(track)
        expected = [step.sectionTag for step in engine.MANIFEST.outline_order(track, flags={})]
        assert _tags(started.outline) == expected, track
        params = env[started.session_id]["session_parameters"]
        assert not {"include_genie_ontology", "includeGenieOntology"} & set(params), track
        assert "includeGenieOntology" not in (params.get("flags") or {}), track


def test_still_ten_tools_within_budget():
    tools = mcp_server.mcp._tool_manager.list_tools()
    assert len(tools) == 10
    assert all(len(tool.description or "") <= 400 for tool in tools)


def test_both_start_prompts_document_the_opt_out():
    phrase = "If your workspace doesn't have Genie One Pages, say skip the ontology"
    assert phrase in mcp_server.start_genie_accelerator()
    assert phrase in mcp_server.start_track(TRACK)
    assert phrase not in mcp_server.start_track("end-to-end")


# --- R1 learner-confirmed completion ---------------------------------------------------


def test_ui_driven_without_confirm_is_gate_required(env):
    sid = _start().session_id
    _walk_to(env, sid, "ontology_pages")
    refused = mcp_server.vibe_complete_step(sid, "ontology_pages", "published it")
    assert _code(refused) == "GATE_REQUIRED"
    assert refused["error"]["message"] == mcp_server.UI_DRIVEN_GATE_MESSAGE
    assert "ontology_pages" not in env[sid]["completed_gates"]


def test_not_yet_keeps_the_step_open(env):
    sid = _start().session_id
    _walk_to(env, sid, "ontology_pages")
    answered = mcp_server.vibe_submit_answer(sid, "ontology_pages.publish_confirmation", "not_yet")
    assert answered.recorded and answered.unblocks is None
    assert _code(mcp_server.vibe_complete_step(sid, "ontology_pages", "x")) == "GATE_REQUIRED"
    assert "ontology_pages" not in env[sid]["completed_gates"]


def test_published_completes_with_gate_and_marker(env):
    sid = _start().session_id
    _walk_to(env, sid, "ontology_pages")
    answered = mcp_server.vibe_submit_answer(sid, "ontology_pages.publish_confirmation", "published")
    assert answered.unblocks == "ontology_pages"
    done = mcp_server.vibe_complete_step(sid, "ontology_pages", "Page published")
    assert not isinstance(done, dict), done
    assert "ontology_pages" in env[sid]["completed_gates"]
    assert env[sid]["captured_outputs"]["ui_confirmed:ontology_pages"] == "mcp"


def test_locked_ui_driven_step_stays_step_locked(env):
    sid = _start().session_id
    assert _code(mcp_server.vibe_complete_step(sid, "ontology_routing", "x")) == "STEP_LOCKED"


@pytest.mark.parametrize("key", ["ui_confirmed:ontology_pages", "ui_confirmed:anything"])
def test_marker_forgery_is_rejected(env, key):
    sid = _start().session_id
    before = copy.deepcopy(env[sid])
    assert _code(mcp_server.vibe_set_parameters(sid, {key: "mcp"})) == "INVALID_PARAMETER"
    assert env[sid] == before


def test_ui_driven_payload_carries_the_hint(env):
    sid = _start().session_id
    _walk_to(env, sid, "ontology_pages")
    payload = mcp_server.vibe_get_step(sid, "ontology_pages")
    assert mcp_server.UI_DRIVEN_HINT in (payload.instruction or "")
    assert payload.interaction["decision"].id == "ontology_pages.publish_confirmation"
    assert payload.interaction["post"].id == "ontology_pages.check"
    other = mcp_server.vibe_get_step(sid, "ontology_domain")
    assert mcp_server.UI_DRIVEN_HINT not in (other.instruction or "")


def test_full_mcp_walk_reaches_done_with_the_two_confirms(env):
    started = _start()
    sid = started.session_id
    outline = _tags(started.outline)
    assert len(outline) == 27
    confirms = []
    nxt = mcp_server.vibe_next_step(sid).root
    walked = []
    while not isinstance(nxt, mcp_server.DoneResult):
        tag = nxt.sectionTag
        walked.append(tag)
        if tag == "gagent_benchmarks":
            mcp_server.vibe_submit_answer(sid, "gagent_benchmarks.benchmark_confirmation", "confirm")
        if tag in UI_DRIVEN:
            assert _code(mcp_server.vibe_complete_step(sid, tag, "x")) == "GATE_REQUIRED"
            assert mcp_server.vibe_submit_answer(sid, f"{tag}.publish_confirmation", "published").unblocks == tag
            confirms.append(tag)
        done = mcp_server.vibe_complete_step(sid, tag, f"{tag} done")
        assert not isinstance(done, dict), (tag, done)
        nxt = done.next
    assert walked == outline
    assert confirms == UI_DRIVEN
    record = env[sid]
    assert set(outline) <= set(record["completed_gates"])
    assert not record["session_parameters"].get("skipped_gates")
    assert {key for key in record["captured_outputs"] if key.startswith("ui_confirmed:")} == {
        f"ui_confirmed:{tag}" for tag in UI_DRIVEN
    }
