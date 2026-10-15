"""genie-default-ontology PR 1 — the Genie Ontology chapter moves ahead of Activation (R7, D-137).

The genie-ontology section is now declared between genie-agent and genie-activate,
so an ontology-on genie-accelerator outline reads … Optimize Loop → AI/BI Dashboard →
Model the Domain → Author Pages → Write the Routing Page → Choose What to Activate → ….
Ontology-off outlines (every track) are unchanged, and no gate moves: strict order
(D-78) alone puts ontology_domain ahead of gaccel_activation (both gate on
gagent_optimize). D-144 adds the ontology_domain genie-code v3 row 1124, whose
position clause no longer says "the app is built".

O1 ontology-on order: the three ontology steps sit right after gaccel_dashboard.
O2 against base 44a5c26: every ontology-off outline (all 14 tracks x flag combos x
   composition inputs) is identical step for step, gates included; an ontology-on
   outline holds the same steps with the same gates, in the new order.
O3 in-flight session: ontology opted in after some Activation steps were done →
   ontology_domain is current, the done gates stay done, out-of-order completion is
   STEP_LOCKED (MCP), and the web outline endpoint agrees with the MCP outline.
S1 the genie-code ontology_domain step serves v3 1124; the default step is unchanged.
S2 1124 is 1030 byte for byte except the one reworded position clause.
S3 against base 44a5c26 the seed only gains 1124; 936 and 1030 are untouched.
"""

import copy
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

from scripts import seed_new_rows
from src.backend import mcp_server
from src.backend.api import routes
from src.backend.workshop import engine, manifest
from src.backend.workshop.state import build_session_state

from .test_app_family_genie_forks import SEED, SEED_ROWS
from .test_gate_rewire_invariant import _flag_combos, _input_options
from .test_genie_family_genie import every_active_version  # noqa: F401  (fixture)

BASE_REF = "44a5c26"
MANIFEST_RELPATH = "src/backend/workshop/manifest.json"
SEED_RELPATH = "db/lakebase/dml_seed/02_seed_section_input_prompts.sql"
TRACK = "genie-accelerator"
ONTOLOGY_FLAG = "includeGenieOntology"
ONTOLOGY_TAGS = ["ontology_domain", "ontology_pages", "ontology_routing"]

V1_ID, V2_ID, V3_ID = 936, 1030, 1124
OLD_CLAUSE = "You reach this after the agent is live and the app is built:"
NEW_CLAUSE = (
    "You reach this after the agent is live and the AI/BI Dashboard is built, "
    "before you choose what to activate (Lakebase sync, app):"
)


def _git_show(path):
    return subprocess.check_output(["git", "show", f"{BASE_REF}:{path}"], cwd=REPO_ROOT, text=True)


@pytest.fixture(scope="module")
def base_manifest(tmp_path_factory):
    path = tmp_path_factory.mktemp("base") / "manifest.json"
    path.write_text(_git_show(MANIFEST_RELPATH))
    return manifest.load_manifest(str(path))


def _shape(steps):
    """Everything a step carries except its 1-based position."""
    return [{k: v for k, v in asdict(step).items() if k != "order"} for step in steps]


# --- O1 / O2: the order ------------------------------------------------------------


@pytest.mark.parametrize("lakehouse", [False, True])
def test_o1_ontology_follows_the_dashboard_and_precedes_activation(lakehouse):
    tags = [
        step.sectionTag
        for step in engine.MANIFEST.outline_order(TRACK, flags={ONTOLOGY_FLAG: True, "includeLakehouse": lakehouse})
    ]
    at = tags.index("gaccel_dashboard") + 1
    assert tags[at - 2 : at + 4] == ["gagent_optimize", "gaccel_dashboard", *ONTOLOGY_TAGS, "gaccel_activation"]
    assert len(tags) == (31 if lakehouse else 27)


def test_o2_ontology_off_is_identical_and_ontology_on_only_reorders(base_manifest):
    checked_off = checked_on = 0
    for track_id, track in engine.MANIFEST.tracks.items():
        for flags in _flag_combos(track):
            for inputs in _input_options(track):
                head = engine.MANIFEST.outline_order(track_id, flags=flags, inputs=inputs)
                base = base_manifest.outline_order(track_id, flags=flags, inputs=inputs)
                if not flags.get(ONTOLOGY_FLAG):
                    assert _shape(head) == _shape(base), (track_id, flags, inputs)
                    checked_off += 1
                    continue
                assert track_id == TRACK
                by_tag = {step["sectionTag"]: step for step in _shape(base)}
                assert sorted(by_tag) == sorted(step["sectionTag"] for step in _shape(head))
                assert all(step == by_tag[step["sectionTag"]] for step in _shape(head)), flags
                assert [s.sectionTag for s in head] != [s.sectionTag for s in base]
                checked_on += 1
    assert checked_on == 2 and checked_off > checked_on


def test_o2_no_gate_changed_for_the_move():
    by_tag = {step.sectionTag: step for step in engine.MANIFEST.track_steps(TRACK)}
    assert by_tag["ontology_domain"].requiresGate == "gagent_optimize"
    assert by_tag["gaccel_activation"].requiresGate == "gagent_optimize"
    # GENIE_REQUIRES_GATE_OVERRIDES keeps iterate_enhance's authored gate as before.
    assert by_tag["iterate_enhance"].requiresGate == "ontology_routing"


# --- O3: an in-flight ontology-opted session ----------------------------------------


@pytest.fixture
def walk(monkeypatch):
    store: dict = {}

    def load_session(session_id):
        record = store.get(session_id)
        return copy.deepcopy(record) if record is not None else None

    def save_session(session_id, **fields):
        store.setdefault(session_id, {"session_id": session_id}).update(copy.deepcopy(fields))
        return True

    monkeypatch.setattr(mcp_server, "load_session", load_session)
    monkeypatch.setattr(mcp_server, "save_session", save_session)
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: True)
    monkeypatch.setattr(mcp_server, "_request_user", lambda ctx: "learner@acme.com")
    monkeypatch.setattr(mcp_server, "_curated_pair_status", lambda industry, use_case: "known")
    monkeypatch.setattr(mcp_server, "_industry_label_for", lambda industry, echo: "Travel")
    monkeypatch.setattr(mcp_server, "_use_case_label_for", lambda industry, use_case: None)
    monkeypatch.setattr(routes, "load_session", load_session)
    app = FastAPI()
    app.include_router(routes.router, prefix="/api")
    return store, TestClient(app)


def _outlines_agree(client, store, sid):
    resource = json.loads(mcp_server._session_state_resource(sid))["outline"]
    response = client.get("/api/track/auto/outline", params={"session_id": sid})
    assert response.status_code == 200, response.text
    assert response.json()["track"] == TRACK
    assert resource == response.json()["outline"]
    state = build_session_state(store[sid], TRACK)
    assert resource == [asdict(item) for item in engine.outline(TRACK, state)]
    return resource


def test_o3_in_flight_session_gets_ontology_next_with_its_gates_intact(walk, monkeypatch):
    store, client = walk
    # A pre-default session: started with ontology off (PR 2 made new MCP
    # genie-accelerator sessions default on via VIBE_DEFAULT_GENIE_ONTOLOGY).
    monkeypatch.setenv("VIBE_DEFAULT_GENIE_ONTOLOGY", "false")
    sid = mcp_server.vibe_start_track(TRACK, use_case="ai_driven_booking", industry="travel").session_id
    off_tags = [item["sectionTag"] for item in _outlines_agree(client, store, sid)]
    assert not set(ONTOLOGY_TAGS) & set(off_tags)
    # Ontology off, the learner got two steps into Activation, then opted in.
    done = off_tags[: off_tags.index("activation_table_design") + 1]
    record = store[sid]
    record["completed_gates"] = sorted(set(record["completed_gates"]) | set(done))
    # Opt in the way every write path does since PR 2: all three keys (D-149).
    mcp_server._write_genie_ontology(record.setdefault("session_parameters", {}), True)
    gates_before = list(record["completed_gates"])

    outline = _outlines_agree(client, store, sid)
    status = {item["sectionTag"]: item["status"] for item in outline}
    assert [item["sectionTag"] for item in outline].index("ontology_domain") == off_tags.index("gaccel_dashboard") + 1
    assert status["ontology_domain"] == "current"
    assert all(status[tag] == "done" for tag in done)
    assert {status[tag] for tag in ("ontology_pages", "ontology_routing", "activation_reverse_sync")} == {"locked"}
    assert mcp_server.vibe_next_step(sid).root.sectionTag == "ontology_domain"

    for tag in ("activation_reverse_sync", "ontology_pages", "iterate_enhance"):
        refused = mcp_server.vibe_complete_step(sid, tag, "out")
        assert isinstance(refused, dict) and refused["error"]["code"] == "STEP_LOCKED", (tag, refused)
    assert store[sid]["completed_gates"] == gates_before
    assert _outlines_agree(client, store, sid) == outline


# --- S1-S3: the D-144 v3 row ---------------------------------------------------------


def test_s1_genie_code_ontology_domain_serves_v3(every_active_version):  # noqa: F811
    served = routes.get_section_input_template("ontology_domain", "genie-code")
    assert served["input"] == SEED_ROWS[V3_ID]["input_template"]
    assert NEW_CLAUSE in served["input"] and OLD_CLAUSE not in served["input"]
    default = routes.get_section_input_template("ontology_domain", None)
    assert default["input"] != served["input"] and NEW_CLAUSE not in default["input"]


def test_s2_v3_is_1030_except_the_position_clause():
    v2, v3 = SEED_ROWS[V2_ID], SEED_ROWS[V3_ID]
    assert (v3["version"], v3["is_active"], v2["version"], v2["is_active"]) == (3, True, 2, True)
    assert SEED_ROWS[V1_ID]["is_active"] is True
    assert {k: v for k, v in v3.items() if k not in ("input_id", "version", "input_template")} == {
        k: v for k, v in v2.items() if k not in ("input_id", "version", "input_template")
    }
    assert v2["input_template"].count(OLD_CLAUSE) == 1
    assert v3["input_template"] == v2["input_template"].replace(OLD_CLAUSE, NEW_CLAUSE)
    # The statement itself differs only in the id, the clause and the version.
    statements = dict(seed_new_rows.seed_rows(str(SEED), "section_input_prompts", "input_id"))
    v2_sql, v3_sql = statements[V2_ID], statements[V3_ID]
    rebuilt = (
        v2_sql.replace(f"({V2_ID}, 'ontology_domain'", f"({V3_ID}, 'ontology_domain'", 1)
        .replace(OLD_CLAUSE, NEW_CLAUSE, 1)
        .replace("true, 2, true, current_timestamp()", "true, 3, true, current_timestamp()", 1)
    )
    assert v3_sql == rebuilt


def test_s3_seed_only_gains_1124_and_keeps_936_and_1030(tmp_path):
    base_path = tmp_path / "02_base.sql"
    base_path.write_text(_git_show(SEED_RELPATH))
    base = dict(seed_new_rows.seed_rows(str(base_path), "section_input_prompts", "input_id"))
    head = dict(seed_new_rows.seed_rows(str(SEED), "section_input_prompts", "input_id"))
    assert set(head) - set(base) == {V3_ID}
    assert {pk: head[pk] for pk in base} == base
    assert (head[V1_ID], head[V2_ID]) == (base[V1_ID], base[V2_ID])
