"""P4.2 — use_case_selection hoisted into every track's define-usecase step (D-33, D-34).

Before P4.2 only genie-accelerator's prd_generation gated on the pre-journey
``use_case_selection`` gate and consumed ``use_case_brief`` (genie-only generator
overrides). D-33 makes both shared generator overrides, so every track that has
prd_generation gets them. D-34: the SPA records its own step-1 tag
``usecase_selection``, never the engine gate, so ``build_session_state`` credits the
gate when the record has defined intent (industry AND use_case, the App's step-1
rule shared with ``lakebase._has_defined_intent``) — otherwise the hoist would lock
prd_generation for every SPA-started session.

H1 manifest shape · H2 generator reproduces the manifest · H3 SPA-shaped sessions
match the base (7329736) per track · H4 the intent-credit bridge · H5 MCP outline ==
the outline endpoint · H6 no intent beat once intent is defined.
"""

import copy
import importlib.util
import json
import pathlib
import subprocess
import sys
from dataclasses import asdict

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.api import routes
from src.backend.services import lakebase
from src.backend.workshop import engine, manifest
from src.backend.workshop.state import build_session_state, has_defined_intent

BASE_REF = "7329736"
MANIFEST_RELPATH = "src/backend/workshop/manifest.json"
USE_CASE_GATE = "use_case_selection"
INDUSTRY = "travel"
USE_CASE = "ai_driven_booking"

HEAD_MANIFEST = json.loads((REPO_ROOT / MANIFEST_RELPATH).read_text())
BASE_MANIFEST = json.loads(
    subprocess.check_output(["git", "show", f"{BASE_REF}:{MANIFEST_RELPATH}"], cwd=REPO_ROOT)
)
ALL_TRACKS = sorted(HEAD_MANIFEST["tracks"])
# resolve_track downgrades skills-accelerator to end-to-end unless the use case is
# its lock (USE_CASE_LEVEL_LOCK: build_skill), exactly as the SPA does.
USE_CASE_FOR = {"skills-accelerator": "build_skill"}


def _spa_record(**overrides):
    """A record shaped like an SPA-started session: the SPA's own step-1 tag
    ``usecase_selection`` and project_setup completed, never the engine gate."""

    record = {
        "industry": INDUSTRY,
        "use_case": USE_CASE,
        "completed_gates": ["usecase_selection", "project_setup"],
        "session_parameters": {},
        "captured_outputs": {},
    }
    record.update(overrides)
    return record


# --- H4: the intent-credit bridge (Change 0, D-34) ------------------------------


@pytest.fixture
def mcp_env(monkeypatch):
    """In-memory Lakebase store with the curated catalogue stubbed (offline)."""

    store: dict = {}
    saves: list = []
    pair_status = {"value": "known"}

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
    monkeypatch.setattr(
        mcp_server, "_curated_pair_status", lambda industry, use_case: pair_status["value"]
    )
    monkeypatch.setattr(mcp_server, "_industry_label_for", lambda industry, echo: "Travel")
    monkeypatch.setattr(mcp_server, "_use_case_label_for", lambda industry, use_case: None)
    return store, saves, pair_status


def test_h4_bridge_credits_gate():
    record = _spa_record()
    state = build_session_state(record, "lakehouse")
    assert state.completed_gates == ["usecase_selection", "project_setup", USE_CASE_GATE]
    assert engine.use_case_resolved(state)
    # captured_outputs untouched: no brief is fabricated (assembler placeholder).
    assert state.captured_outputs == {}
    assert engine.USE_CASE_BRIEF not in state.captured_outputs
    # Read-side only: the record itself is not mutated.
    assert record["completed_gates"] == ["usecase_selection", "project_setup"]


def test_h4_bridge_is_idempotent():
    record = _spa_record(completed_gates=[USE_CASE_GATE, "project_setup"])
    state = build_session_state(record, "lakehouse")
    assert state.completed_gates == [USE_CASE_GATE, "project_setup"]
    again = build_session_state({**record, "completed_gates": state.completed_gates}, "lakehouse")
    assert again.completed_gates.count(USE_CASE_GATE) == 1


@pytest.mark.parametrize(
    ("industry", "use_case"),
    [
        (None, USE_CASE),
        (INDUSTRY, None),
        ("", USE_CASE),
        (INDUSTRY, ""),
        ("   ", USE_CASE),
        (INDUSTRY, "  "),
        (None, None),
    ],
)
def test_h4_bridge_requires_both_non_blank(industry, use_case):
    record = _spa_record(industry=industry, use_case=use_case)
    state = build_session_state(record, "lakehouse")
    assert USE_CASE_GATE not in state.completed_gates
    assert not engine.use_case_resolved(state)


def test_h4_bridge_shares_the_lakebase_intent_rule():
    for record in (
        _spa_record(),
        _spa_record(industry=""),
        _spa_record(use_case=" "),
        _spa_record(industry=None, use_case=None),
    ):
        assert lakebase._has_defined_intent(record) == has_defined_intent(record)
        assert (USE_CASE_GATE in build_session_state(record, "lakehouse").completed_gates) == (
            has_defined_intent(record)
        )


def test_h4_bridge_unknown_usecase_not_credited(mcp_env):
    # D-13/D-15: an uncatalogued pick is never written to the use_case column, so
    # the bridge has nothing to credit — the intent beat still elicits a real pick.
    store, saves, pair_status = mcp_env
    pair_status["value"] = "unknown"
    started = mcp_server.vibe_start_track("lakehouse", use_case="invented_thing", industry=INDUSTRY)
    assert not isinstance(started, dict), started
    record = store[started.session_id]
    assert not (record.get("use_case") or "").strip()
    state = build_session_state(record, "lakehouse")
    assert USE_CASE_GATE not in state.completed_gates
    assert mcp_server._needs_use_case(state)


def test_h4_bridge_never_persists_the_gate(mcp_env):
    # The MCP delta write excludes gates already in ``before``; the bridge credits
    # the gate in ``before`` too, so no MCP call ever writes it on the bridge's behalf.
    store, saves, _ = mcp_env
    store["spa"] = _spa_record(session_id="spa", workshop_level="lakehouse")
    result = mcp_server.vibe_complete_step("spa", "prd_generation", "the prd")
    assert not isinstance(result, dict), result
    assert USE_CASE_GATE not in store["spa"]["completed_gates"]
    assert "prd_generation" in store["spa"]["completed_gates"]


# --- H1: the manifest carries the hoist on every track (Changes 1–2, D-33) -----


def _all_sections(track_data):
    """Base sections plus every variant's sections (variants replace the base)."""

    yield from track_data["sections"]
    for variant in track_data.get("variants") or []:
        yield from variant["sections"]


def _prd_steps(track_data):
    return [
        (section["id"], step)
        for section in _all_sections(track_data)
        for step in section["steps"]
        if step["sectionTag"] == "prd_generation"
    ]


def test_h1_manifest_requires_gate():
    assert len(ALL_TRACKS) == 14
    with_prd = [track for track in ALL_TRACKS if _prd_steps(HEAD_MANIFEST["tracks"][track])]
    # Every track but skills-accelerator has prd_generation (tracks.md).
    assert with_prd == [track for track in ALL_TRACKS if track != "skills-accelerator"]
    for track in with_prd:
        for section_id, step in _prd_steps(HEAD_MANIFEST["tracks"][track]):
            assert section_id == "define-usecase", (track, section_id)
            assert "use_case_brief" in step["consumes"], track
            assert step["requiresGate"] == USE_CASE_GATE, track
    # genie-accelerator's subtree is byte-identical to the base (it already had both).
    assert HEAD_MANIFEST["tracks"]["genie-accelerator"] == BASE_MANIFEST["tracks"]["genie-accelerator"]
    # The ONLY manifest change is those two prd_generation fields.
    assert {k: v for k, v in HEAD_MANIFEST.items() if k != "tracks"} == {
        k: v for k, v in BASE_MANIFEST.items() if k != "tracks"
    }
    rolled_back = copy.deepcopy(HEAD_MANIFEST)
    for track, data in rolled_back["tracks"].items():
        if track == "genie-accelerator":
            continue
        for _, step in _prd_steps(data):
            step["consumes"] = [key for key in step["consumes"] if key != "use_case_brief"]
            step["requiresGate"] = "project_setup"
    assert rolled_back == BASE_MANIFEST


# --- H2: the generator reproduces the committed manifest -------------------------
# (test_manifest_parity.test_manifest_regeneration_is_byte_identical pins the same
# property by re-running the script; this one builds in-process, writing nothing.)


def _generator():
    spec = importlib.util.spec_from_file_location(
        "generate_manifest_h2", REPO_ROOT / "scripts" / "generate_manifest.py"
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module  # dataclasses resolve annotations via sys.modules
    try:
        spec.loader.exec_module(module)
    finally:
        sys.modules.pop(spec.name, None)
    return module


def test_h2_generator_reproduces_manifest():
    generator = _generator()
    built = generator.build_manifest(generator.WORKFLOW_SOURCE.read_text(encoding="utf-8"))
    emitted = json.dumps(built, indent=2, ensure_ascii=False) + "\n"
    assert emitted == (REPO_ROOT / MANIFEST_RELPATH).read_text(encoding="utf-8")
    # The two use-case overrides are shared, not genie-scoped (D-33).
    assert generator.USE_CASE_REQUIRES_GATE_OVERRIDES == {"prd_generation": USE_CASE_GATE}
    assert generator.USE_CASE_CHAINING_LITERAL_OVERRIDES == {3: {"use_case_brief": 1}}
    assert 3 not in generator.GENIE_CHAINING_LITERAL_OVERRIDES


# --- H3: SPA-shaped sessions, base (7329736) vs HEAD, every track ---------------
# Base = the base manifest + the base build_session_state (no intent credit).
# Compared: outline (sectionTag, status) and next_step's kind + sectionTag. The
# Step objects themselves differ by design (prd_generation's requiresGate/consumes).

# genie-accelerator's prd_generation already required use_case_selection at the
# base, so an SPA-shaped genie session had prd_generation locked there (a defect
# Change 0 fixes). Recorded here, not asserted equal (see the PR body). Under the
# strict-order engine (D-78) the base walk no longer scans past that locked step to
# the ungated semlayer_locate: it is Blocked on prd_generation.
GENIE_BASE_PRD_STATUS = "locked"
GENIE_BASE_NEXT_AFTER_SETUP = ("Blocked", "prd_generation")

SPA_PROGRESS = (
    ["usecase_selection"],
    ["usecase_selection", "project_setup"],
    ["usecase_selection", "project_setup", "prd_generation"],
)
# Variant selectors (manifest ``variants[].when``): each composes a different outline.
SPA_PARAMS = ({}, {"direction": "reverse"}, {"chainContext": "app"})


@pytest.fixture(scope="module")
def base_manifest(tmp_path_factory):
    path = tmp_path_factory.mktemp("base") / "manifest.json"
    path.write_text(json.dumps(BASE_MANIFEST))
    return manifest.load_manifest(str(path))


def _base_build_session_state(record):
    """build_session_state as it was at the base: gates verbatim, no intent credit."""

    params = dict(record.get("session_parameters") or {})
    for key in ("industry", "use_case", "industry_label", "use_case_label"):
        if record.get(key) is not None:
            params.setdefault(key, record[key])
    return engine.SessionState(
        completed_gates=list(record.get("completed_gates") or []),
        captured_outputs=dict(record.get("captured_outputs") or {}),
        session_parameters=params,
    )


def _walk_view(track, state):
    statuses = [(item.sectionTag, item.status) for item in engine.outline(track, state)]
    nxt = engine.next_step(track, state)
    return statuses, (type(nxt).__name__, getattr(nxt, "sectionTag", None))


def _base_view(monkeypatch, base_manifest, track, record):
    with monkeypatch.context() as patch:
        patch.setattr(engine, "MANIFEST", base_manifest)
        return _walk_view(track, _base_build_session_state(record))


def _spa_record_for(track, gates, params):
    return _spa_record(
        use_case=USE_CASE_FOR.get(track, USE_CASE),
        completed_gates=list(gates),
        session_parameters=dict(params),
    )


@pytest.mark.parametrize("track", ALL_TRACKS)
def test_h3_spa_regression(monkeypatch, base_manifest, track):
    for params in SPA_PARAMS:
        for gates in SPA_PROGRESS:
            record = _spa_record_for(track, gates, params)
            base = _base_view(monkeypatch, base_manifest, track, record)
            head = _walk_view(track, build_session_state(record, track))
            head_status = dict(head[0])
            if track == "genie-accelerator":
                # HEAD: prd_generation is reachable once project_setup is done.
                if "project_setup" in gates and "prd_generation" not in gates:
                    assert head_status["prd_generation"] == "current", (params, gates)
                    assert head[1] == ("Step", "prd_generation"), (params, gates)
                    if not params:
                        assert dict(base[0])["prd_generation"] == GENIE_BASE_PRD_STATUS
                        assert base[1] == GENIE_BASE_NEXT_AFTER_SETUP
                continue
            assert head == base, (track, params, gates)
            if "prd_generation" in head_status and gates == SPA_PROGRESS[1]:
                assert head_status["prd_generation"] == "current", (track, params)


def test_h3_spa_regression_needs_the_bridge(monkeypatch, base_manifest):
    # Without Change 0 the hoist WOULD regress the SPA: HEAD manifest + base state.
    record = _spa_record_for("lakehouse", SPA_PROGRESS[1], {})
    statuses, nxt = _walk_view("lakehouse", _base_build_session_state(record))
    assert dict(statuses)["prd_generation"] == "locked"
    assert nxt != ("Step", "prd_generation")


# --- H5: MCP outline == the outline endpoint, every track -----------------------


@pytest.fixture
def outline_client(mcp_env, monkeypatch):
    store, _, _ = mcp_env
    monkeypatch.setattr(
        routes, "load_session", lambda sid: copy.deepcopy(store[sid]) if sid in store else None
    )
    app = FastAPI()
    app.include_router(routes.router, prefix="/api")
    return TestClient(app)


def _assert_mcp_matches_endpoint(client, store, sid, track):
    resource = json.loads(mcp_server._session_state_resource(sid))
    response = client.get("/api/track/auto/outline", params={"session_id": sid})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["track"] == track
    assert resource["outline"] == body["outline"]
    state = build_session_state(store[sid], track)
    assert body["outline"] == [asdict(item) for item in engine.outline(track, state)]
    return body["outline"]


@pytest.mark.parametrize("track", ALL_TRACKS)
def test_h5_mcp_outline_matches_endpoint(mcp_env, outline_client, track):
    store, _, _ = mcp_env
    use_case = USE_CASE_FOR.get(track, USE_CASE)
    # (a) a fresh MCP session after the lock.
    started = mcp_server.vibe_start_track(track, use_case=use_case, industry=INDUSTRY)
    assert not isinstance(started, dict), started
    assert USE_CASE_GATE in store[started.session_id]["completed_gates"]
    _assert_mcp_matches_endpoint(outline_client, store, started.session_id, track)
    # (b) an SPA-shaped session (intent defined, no MCP lock).
    store["spa"] = _spa_record_for(track, SPA_PROGRESS[1], {})
    store["spa"].update(session_id="spa", workshop_level=track, created_by="learner@acme.com")
    outline = _assert_mcp_matches_endpoint(outline_client, store, "spa", track)
    status = {item["sectionTag"]: item["status"] for item in outline}
    if "prd_generation" in status:
        assert status["prd_generation"] == "current", track


# --- H6: no intent beat once intent is defined (Change 0 consequence) -----------


@pytest.mark.parametrize("track", ["lakehouse", "app-only", "genie-accelerator"])
def test_h6_no_intent_beat_when_intent_defined(mcp_env, track):
    store, _, _ = mcp_env
    store["spa"] = _spa_record_for(track, SPA_PROGRESS[1], {})
    store["spa"].update(session_id="spa", workshop_level=track, created_by="learner@acme.com")
    got = mcp_server.vibe_get_step("spa")
    assert not isinstance(got, dict), got
    assert got.sectionTag != USE_CASE_GATE
    assert got.sectionTag == "prd_generation"
    assert mcp_server.vibe_next_step("spa").root.sectionTag == "prd_generation"


def test_h6_intent_beat_still_shown_without_intent(mcp_env):
    store, _, _ = mcp_env
    store["spa"] = _spa_record_for("lakehouse", SPA_PROGRESS[1], {})
    store["spa"].update(
        session_id="spa", workshop_level="lakehouse", created_by="learner@acme.com", use_case=None
    )
    got = mcp_server.vibe_get_step("spa")
    assert not isinstance(got, dict), got
    assert got.sectionTag == USE_CASE_GATE
