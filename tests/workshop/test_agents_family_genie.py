"""P4.3 family 6, part A — agents-accelerator's foundation steps are walkable in Genie Code (D-47).

Same real-seed harness as the app, lakehouse, covered and skills families
(test_app_family_genie_forks.py, test_lakehouse_family_genie.py,
test_covered_families_genie.py): every active ``section_input_prompts`` INSERT is
parsed and served in place of the Lakebase cache.

A1 marker lint: every step in the agents-accelerator MCP outline, served to a
   genie-code session with a resolved learner email, carries EXACTLY the reviewed
   number of each local-IDE marker (0 unless allowed). The six MLflow SDLC steps
   still on their default rows are a NAMED pending set (p4-agents-b) and are not
   linted until their forks land; each must still be unforked. uc_resources_foundation
   is a NAMED pending set too (D-51: no fork until a human RULE_10 ruling); its
   default 200 is linted with exact-count allowances and must stay unforked.
A2 fork resolution: every forked tag of the track, including 1007, 1008 and 1010,
   resolves to its fork for a genie-code session and to the default row otherwise;
   every step is forked, judged or pending.
A3 paths: 1007, 1008 and 1010 name no bare relative `docs/` or `.vibecoding-state.md`
   path, and pass no `--profile` flag.
A4 mechanics: 1007/1008 write with executeCode open().write and read back; 1008
   records the `Agent tool plan ready` gate that default 200's `enter` requires.
"""

import re

import pytest

from src.backend import mcp_server
from src.backend.api import routes
from src.backend.workshop import assembler

from .test_app_family_genie_forks import (  # noqa: F401  (seeded/store are fixtures)
    INDUSTRY,
    SEED_ROWS,
    USE_CASE,
    _distinct_line,
    _hits,
    _served,
    seeded,
    store,
)
from .test_covered_families_genie import ALLOWED as COVERED_ALLOWED
from .test_covered_families_genie import _marker_counts
from .test_lakehouse_family_genie import DEFAULT_ID, GENIE_PARAMS, _outline_tags, _served_live

TRACK = "agents-accelerator"

# section_tag -> genie-code fork input_id for every forked step of the track.
FORK_ID = {
    "cursor_copilot_ui_design": 911,
    "deploy_databricks_app": 912,
    "setup_lakebase": 922,
    "wire_ui_lakebase": 923,
    "workspace_setup_deploy": 1001,
    "agent_spec_design": 1007,
    "agent_tool_selection": 1008,
    "mlflow_agent_tracing_uc": 1010,
    "knowledge_assistant_create": 913,
    "track_a_agent_app_clone_framework": 914,
    "track_a_agent_ka_genie_tools": 915,
    "track_a_agent_auth_memory": 916,
    "track_a_agent_eval_deploy": 917,
    "appkit_agent_app_proxy_chat": 918,
    "appkit_chat_feedback_mlflow": 919,
    "mlflow_gateway_and_deployment": 920,
    "mlflow_production_monitoring_and_debugging": 921,
    "redeploy_test": 1002,
}
NEW_FORKS = {
    "agent_spec_design": 1007,
    "agent_tool_selection": 1008,
    "mlflow_agent_tracing_uc": 1010,
}
# The recorded no-fork judgments (plan table): project_setup is virtual; prd_generation
# is LLM over the default; iterate_enhance and workspace_cleanup per D-39.
NO_FORK = {"project_setup", "prd_generation", "iterate_enhance", "workspace_cleanup"}
# Still on their default rows (seed 209-214): the MLflow SDLC loop is task p4-agents-b.
# B removes each tag from this set as its fork lands; the default bodies @-mention
# their skills, so a tag removed early fails A1.
PENDING_B = {
    "mlflow_prompt_registry": "p4-agents-b",
    "mlflow_evaluation_datasets": "p4-agents-b",
    "mlflow_scorers_and_judges": "p4-agents-b",
    "mlflow_evaluation_runs_and_iteration": "p4-agents-b",
    "mlflow_human_review_and_signoff": "p4-agents-b",
    "mlflow_logged_model_uc_registration": "p4-agents-b",
}
# D-51: forking this step either restates the in-session create (the INSESSION_CREATE
# audit grows, which genie_gate_diff never waives) or hides it (reviewer BLOCK on
# 0287450), so it stays on its default until a human rules on RULE_10.
_RULE10 = "D-51: in-session UC provisioning needs a human RULE_10 ruling; served from default 200 until then"
PENDING_RULE10 = {"uc_resources_foundation": _RULE10}

# Reviewed allowances: (section_tag, marker) -> (exact hit count, reason). The app
# forks' entries come from #114 (via test_covered_families_genie); the rest are the
# agent forks first served by this track.
_PROHIBITIONS = (
    "existing fork, reviewed 2026-10-07: every hit is a NEVER / do-NOT prohibition "
    "or an in-process 'not localhost' note"
)
ALLOWED = {
    **{key: value for key, value in COVERED_ALLOWED.items() if key[0] in FORK_ID},
    ("track_a_agent_app_clone_framework", "localhost"): (6, _PROHIBITIONS),
    ("track_a_agent_ka_genie_tools", "localhost"): (3, _PROHIBITIONS),
    ("track_a_agent_auth_memory", "localhost"): (4, _PROHIBITIONS),
    ("track_a_agent_eval_deploy", "localhost"): (2, _PROHIBITIONS),
    ("appkit_agent_app_proxy_chat", "localhost"): (4, _PROHIBITIONS),
    ("appkit_chat_feedback_mlflow", "localhost"): (3, _PROHIBITIONS),
    # Default 200 @-mentions its skill and the PRD; both lapse when its fork lands.
    **{(tag, "@-mention"): (2, reason) for tag, reason in PENDING_RULE10.items()},
}


def _fork(fork_id):
    row = SEED_ROWS.get(fork_id)
    assert row is not None, f"seed has no input_id {fork_id}"
    return row["input_template"]


# --- A1: marker lint --------------------------------------------------------------


def test_a1_agents_bodies_carry_exactly_the_reviewed_markers(seeded):
    wrong = {}
    for tag in _outline_tags(TRACK):
        if tag in PENDING_B:
            continue
        found = _marker_counts(tag, _served_live(TRACK, tag))
        expected = {marker: cap for (t, marker), (cap, _) in ALLOWED.items() if t == tag}
        if found != expected:
            wrong[tag] = {"found": found, "reviewed": expected}
    assert wrong == {}, f"{TRACK}: local-IDE markers differ from the reviewed counts {wrong}"


def test_a1_every_allowance_is_on_the_track_with_a_reason():
    assert {tag for tag, _ in ALLOWED} <= set(_outline_tags(TRACK))
    assert all(reason for _, reason in ALLOWED.values())


@pytest.mark.parametrize("pending", [PENDING_B, PENDING_RULE10], ids=["PENDING_B", "PENDING_RULE10"])
def test_a1_pending_tags_are_still_unforked(pending):
    """Each pending tag is on the outline, has a reason, and has no genie-code row
    yet: when its fork lands (p4-agents-b, or 1009 after the RULE_10 ruling), its
    tag must leave the set."""
    forked = {row["section_tag"] for row in SEED_ROWS.values() if row.get("coding_assistant") == "genie-code"}
    assert set(pending) <= set(_outline_tags(TRACK))
    assert all(pending.values())
    assert not set(pending) & forked, set(pending) & forked


def test_a1_input_id_1009_stays_free():
    """D-51 leaves the gap so the later uc_resources_foundation fork can take 1009."""
    assert 1009 not in SEED_ROWS


def test_a1_new_forks_are_marker_clean():
    for tag, fork_id in NEW_FORKS.items():
        assert SEED_ROWS[fork_id]["section_tag"] == tag, fork_id
        assert _hits(_fork(fork_id)) == {}, fork_id


# --- A2: fork resolution ----------------------------------------------------------


def test_a2_every_step_is_forked_judged_or_pending():
    groups = [set(FORK_ID), NO_FORK, set(PENDING_B), set(PENDING_RULE10)]
    assert set(_outline_tags(TRACK)) == set().union(*groups)
    assert sum(len(group) for group in groups) == len(set().union(*groups)), "a tag is in two groups"


@pytest.mark.parametrize("tag", sorted(NEW_FORKS))
def test_a2_seed_carries_the_new_fork_rows(tag):
    fork, default = SEED_ROWS.get(NEW_FORKS[tag]), SEED_ROWS[DEFAULT_ID[tag]]
    assert fork is not None, f"seed has no input_id {NEW_FORKS[tag]}"
    assert (fork["section_tag"], fork["coding_assistant"]) == (tag, "genie-code")
    assert default["section_tag"] == tag and "coding_assistant" not in default
    # Seed header rule 4: only the prompt fields, at the default's bypass_llm.
    assert (fork["version"], fork["is_active"], fork["bypass_llm"]) == (1, True, default["bypass_llm"])
    assert "step_enabled" not in fork and "section_title" not in fork and "how_to_apply" not in fork


@pytest.mark.parametrize("tag", sorted(NEW_FORKS))
def test_a2_new_fork_rows_follow_their_default(tag):
    """Each fork INSERT sits right after its default row in the seed file."""
    order = list(SEED_ROWS)
    assert order.index(NEW_FORKS[tag]) == order.index(DEFAULT_ID[tag]) + 1


def _bodies(tag):
    return _fork(FORK_ID[tag]), SEED_ROWS[DEFAULT_ID[tag]]["input_template"]


@pytest.mark.parametrize("tag", sorted(FORK_ID))
def test_a2_genie_get_step_resolves_the_fork(seeded, store, tag):
    tags = _outline_tags(TRACK)
    store["s"] = {
        "session_id": "s",
        "workshop_level": TRACK,
        "industry": INDUSTRY,
        "use_case": USE_CASE,
        # Everything before the step is done, so its requiresGate holds.
        "completed_gates": ["use_case_selection", *tags[: tags.index(tag)]],
        "captured_outputs": {},
        "session_parameters": dict(GENIE_PARAMS),
    }
    got = mcp_server.vibe_get_step("s", tag)
    assert not isinstance(got, dict), got
    fork, default = _bodies(tag)
    assert _distinct_line(fork, default) in got.prompt
    assert _distinct_line(default, fork) not in got.prompt
    assert got.prompt == _served(TRACK, tag)


@pytest.mark.parametrize("tag", sorted(NEW_FORKS))
@pytest.mark.parametrize("assistant", [None, routes.DEFAULT_CODING_ASSISTANT_KEY, "coda"])
def test_a2_non_genie_session_still_gets_the_default(seeded, tag, assistant):
    fork, default = _bodies(tag)
    body = assembler.get_section_input_content(
        industry=INDUSTRY,
        use_case=USE_CASE,
        section_tag=tag,
        coding_assistant_override=assistant,
    )["input"]
    assert _distinct_line(default, fork) in body
    assert _distinct_line(fork, default) not in body


# --- A3: fully qualified paths, no --profile --------------------------------------

_ARTIFACT_PATH = re.compile(r"docs/|\.vibecoding-state\.md")
# A path is anchored when it sits under a resolved root or a workspace user folder.
_ANCHORED = re.compile(r"(?:<ARTIFACT_ROOT>/|<APP_ROOT>/|<app_root>/|/Workspace/Users/[^\s`\"]*)$")


@pytest.mark.parametrize("fork_id", sorted(NEW_FORKS.values()))
def test_a3_no_bare_relative_artifact_paths(fork_id):
    body = _fork(fork_id)
    starts = [m.start() for m in _ARTIFACT_PATH.finditer(body)]
    assert starts, f"{fork_id} names no artifact path; revisit this pin"
    bare = [body[max(0, at - 40) : at + 30] for at in starts if not _ANCHORED.search(body[:at])]
    assert bare == [], f"{fork_id}: bare relative path(s) {bare}"


@pytest.mark.parametrize("fork_id", sorted(NEW_FORKS.values()))
def test_a3_no_profile_flag(fork_id):
    body = _fork(fork_id)
    assert "--profile" not in body, fork_id
    assert "NO profile flag" in body, fork_id


@pytest.mark.parametrize("fork_id", sorted(NEW_FORKS.values()))
def test_a3_skills_load_by_readskillfile(fork_id):
    body = _fork(fork_id)
    assert 'readSkillFile("skills/vibe-coding-workshop/genai-agents/foundation/' in body, fork_id
    assert "vibecoding-state` operation `resolve_root`" in body, fork_id


# --- A4: write mechanics and the 1008 gate ------------------------------------------

_OPEN_WRITE = '`executeCode` `open(path, "w").write(...)`'


@pytest.mark.parametrize(("fork_id", "path"), [(1007, "agent_spec.yaml"), (1008, "agent_tool_plan.yaml")])
def test_a4_design_files_are_written_and_read_back(fork_id, path):
    body = _fork(fork_id)
    target = f"`path` = `<ARTIFACT_ROOT>/docs/{path}`"
    assert body.count(_OPEN_WRITE) == 1 and target in body, fork_id
    write = body.index(_OPEN_WRITE)
    assert write < body.index("os.path.exists(path)", write) < body.index("open(path).read()", write)
    assert "NOT `listFiles`" in body
    assert f"Save it to: <ARTIFACT_ROOT>/docs/{path}" in body


def test_a4_tool_selection_records_the_gate_uc_foundation_requires():
    """Default 200 (served until D-51 is ruled) consumes the gate in its `enter`."""
    body = _fork(1008)
    assert '`prompt_id: "agent_tool_selection"`, `gate: "Agent tool plan ready"`' in body
    consumer = _fork(DEFAULT_ID["uc_resources_foundation"])
    assert '{prompt_id: "agent_tool_selection", gate: "Agent tool plan ready"}' in consumer
    assert body.index("os.path.exists(path)") < body.index('gate: "Agent tool plan ready"')

