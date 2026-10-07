"""P4.3 family 6 — agents-accelerator is walkable in Genie Code (part A D-47, part B D-52).

Same real-seed harness as the app, lakehouse, covered and skills families
(test_app_family_genie_forks.py, test_lakehouse_family_genie.py,
test_covered_families_genie.py): every active ``section_input_prompts`` INSERT is
parsed and served in place of the Lakebase cache.

A1 marker lint: every step in the agents-accelerator MCP outline, served to a
   genie-code session with a resolved learner email, carries EXACTLY the reviewed
   number of each local-IDE marker (0 unless allowed). uc_resources_foundation
   is a NAMED pending set (D-51: no fork until a human RULE_10 ruling); its
   default 200 is linted with exact-count allowances and must stay unforked.
A2 fork resolution: every forked tag of the track, including 1007, 1008, 1010 and
   1011-1016, resolves to its fork for a genie-code session and to the default row
   otherwise; every step is forked, judged or pending.
A3 paths: the new forks name no bare relative `docs/` or `.vibecoding-state.md`
   path, and pass no `--profile` flag.
A4 mechanics: 1007/1008 write with executeCode open().write and read back; 1008
   records the `Agent tool plan ready` gate that default 200's `enter` requires.
B1-B5 (part B, 1011-1016, the MLflow SDLC loop from defaults 209-214): no skill
   @-mention and only the defaults' MLflow `@` tokens, at the defaults' counts;
   resolve_root then the default's own `enter`; every skill read by a pinned
   readSkillFile path; the default's `exit` and gate; 1015 stops for the SME
   before the sync and the sign-off.
"""

import collections
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
    "mlflow_prompt_registry": 1011,
    "mlflow_evaluation_datasets": 1012,
    "mlflow_scorers_and_judges": 1013,
    "mlflow_evaluation_runs_and_iteration": 1014,
    "mlflow_human_review_and_signoff": 1015,
    "mlflow_logged_model_uc_registration": 1016,
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
A_FORKS = {
    "agent_spec_design": 1007,
    "agent_tool_selection": 1008,
    "mlflow_agent_tracing_uc": 1010,
}
# Part B (D-52): the MLflow SDLC loop, each fork from its default 209-214.
B_FORKS = {
    "mlflow_prompt_registry": 1011,
    "mlflow_evaluation_datasets": 1012,
    "mlflow_scorers_and_judges": 1013,
    "mlflow_evaluation_runs_and_iteration": 1014,
    "mlflow_human_review_and_signoff": 1015,
    "mlflow_logged_model_uc_registration": 1016,
}
NEW_FORKS = {**A_FORKS, **B_FORKS}
# The recorded no-fork judgments (plan table): project_setup is virtual; prd_generation
# is LLM over the default; iterate_enhance and workspace_cleanup per D-39.
NO_FORK = {"project_setup", "prd_generation", "iterate_enhance", "workspace_cleanup"}
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
        found = _marker_counts(tag, _served_live(TRACK, tag))
        expected = {marker: cap for (t, marker), (cap, _) in ALLOWED.items() if t == tag}
        if found != expected:
            wrong[tag] = {"found": found, "reviewed": expected}
    assert wrong == {}, f"{TRACK}: local-IDE markers differ from the reviewed counts {wrong}"


def test_a1_every_allowance_is_on_the_track_with_a_reason():
    assert {tag for tag, _ in ALLOWED} <= set(_outline_tags(TRACK))
    assert all(reason for _, reason in ALLOWED.values())


def test_a1_pending_tags_are_still_unforked():
    """Each pending tag is on the outline, has a reason, and has no genie-code row
    yet: when its fork lands (1009 after the RULE_10 ruling), its tag must leave
    the set."""
    pending = PENDING_RULE10
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
    groups = [set(FORK_ID), NO_FORK, set(PENDING_RULE10)]
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


@pytest.mark.parametrize("fork_id", sorted(A_FORKS.values()))
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



# --- B: the MLflow SDLC loop (1011-1016, D-52) --------------------------------------

_SKILL_ROOT = "skills/vibe-coding-workshop/genai-agents/"
# Every template file the part-B forks read, per fork (11; all exist at TPL
# origin/feature/genie-code-mcp-integration 775bebc, the same files defaults 209-214
# @-mention).
B_SKILL_PATHS = {
    1011: {"sdlc/01-prompt-registry/SKILL.md"},
    1012: {"sdlc/02-evaluation-datasets/SKILL.md"},
    1013: {"sdlc/03-scorers-and-judges/SKILL.md"},
    1014: {
        "sdlc/04-evaluation-runs/SKILL.md",
        "sdlc/08b-prompt-handauthoring/SKILL.md",
        "tracks/A-custom-agent-apps/08-debugging/SKILL.md",
    },
    1015: {
        "sdlc/04-evaluation-runs/SKILL.md",
        "sdlc/02-evaluation-datasets/references/benchmark-generation.md",
        "sdlc/04b-stakeholder-signoff/SKILL.md",
    },
    1016: {"sdlc/08b-prompt-handauthoring/SKILL.md", "sdlc/05-logged-model-and-uc-registration/SKILL.md"},
}
# The only `@` tokens a part-B fork may carry, each at its default's count.
_AT_REASON = (
    "MLflow alias names, the prompts://…@alias placeholder and the @scorer decorator, "
    "verbatim from defaults 209-214"
)
AT_ALLOWED = {"@production", "@staging", "@champion", "@scorer", "@alias"}
_AT_TOKEN = re.compile(r"@[A-Za-z][\w-]*(/[\w./-]*)?")
_READ_SKILL = re.compile(r'readSkillFile\("([^"]+)"\)')
_ENTER = re.compile(r"`enter` — params: (.*?`)\.(?= |$)", re.M)
_EXIT = re.compile(r"op `exit` — params: (.*?`)\.(?= |$)", re.M)
_TEMPLATE_TOKEN = re.compile(r"(?<![$\\])\{[A-Za-z0-9_]+\}")
_GATE = re.compile(r"\*\*Gate:\*\*\s*`([^`]+)`")


def _b_bodies(fork_id):
    return _fork(fork_id), SEED_ROWS[fork_id - 802]["input_template"]


def _at_counts(body):
    return collections.Counter(m.group(0) for m in _AT_TOKEN.finditer(body) if not m.group(1))


def test_b_forks_come_from_defaults_209_to_214():
    assert {tag: DEFAULT_ID[tag] for tag in B_FORKS} == {tag: fork_id - 802 for tag, fork_id in B_FORKS.items()}
    assert sum(len(paths) for paths in B_SKILL_PATHS.values()) == 11


@pytest.mark.parametrize("fork_id", sorted(B_FORKS.values()))
def test_b1_no_skill_mentions_and_only_the_defaults_at_tokens(fork_id):
    fork, default = _b_bodies(fork_id)
    assert "@genai-agents/" not in fork, fork_id
    assert [m.group(0) for m in _AT_TOKEN.finditer(fork) if m.group(1)] == [], fork_id
    found = _at_counts(fork)
    assert set(found) <= AT_ALLOWED, (fork_id, set(found) - AT_ALLOWED, _AT_REASON)
    # No new token and none dropped: the fork keeps exactly its default's wording.
    assert found == _at_counts(default), fork_id


@pytest.mark.parametrize("fork_id", sorted(B_FORKS.values()))
def test_b2_resolve_root_then_the_defaults_enter(fork_id):
    fork, default = _b_bodies(fork_id)
    assert "operation `resolve_root`, then `enter` — params: " in fork, fork_id
    assert fork.index("`resolve_root`") < fork.index("`enter` — params: "), fork_id
    # Same prompt_id, require_prior_gate (and 1016's hard_assert) as the default.
    assert _ENTER.findall(fork) == _ENTER.findall(default), fork_id
    assert len(_ENTER.findall(fork)) == 1, fork_id


@pytest.mark.parametrize("fork_id", sorted(B_FORKS.values()))
def test_b3_skills_load_by_pinned_readskillfile_paths(fork_id):
    fork, _ = _b_bodies(fork_id)
    paths = _READ_SKILL.findall(fork)
    assert all(path.startswith(_SKILL_ROOT) for path in paths), (fork_id, paths)
    assert {path.removeprefix(_SKILL_ROOT) for path in paths} == B_SKILL_PATHS[fork_id], fork_id
    assert "vibecoding-state` operation `resolve_root`" in fork, fork_id


@pytest.mark.parametrize("fork_id", sorted(B_FORKS.values()))
def test_b4_same_exit_gate_captured_and_tokens_as_the_default(fork_id):
    """FORK_INTENT_PARITY, pinned here: the exit params (gate, captured keys), the
    **Gate:** line and every {token} of the default survive in the fork."""
    fork, default = _b_bodies(fork_id)
    assert _EXIT.findall(fork) == _EXIT.findall(default), fork_id
    assert len(_EXIT.findall(fork)) == 1, fork_id
    assert _GATE.findall(fork)[:1] == _GATE.findall(default)[:1], fork_id
    assert set(_TEMPLATE_TOKEN.findall(default)) <= set(_TEMPLATE_TOKEN.findall(fork)), fork_id
    assert "**State-lock:**" in fork and "mandatory ritual, not advisory" in fork, fork_id


def test_b5_human_review_stops_for_the_sme_before_sync_and_signoff():
    """D-52: labeling is a human step; 1015 builds the session, hands the URL to the
    SME and stops before the sync and the sign-off."""
    fork, default = _b_bodies(B_FORKS["mlflow_human_review_and_signoff"])
    assert "labeling itself is a **human step**" in default and "labeling itself is a **human step**" in fork
    stop = "**STOP here** — do not run the sync or the sign-off until the operator confirms ≥ 10 traces are labeled."
    assert fork.count(stop) == 1
    order = [
        "### Step 2 — Build the labeling session in `executeCode`",
        "### Step 3 — SME handoff (STOP)",
        stop,
        "### Step 4 — Sync the labels back (after the operator confirms)",
        "### Step 5 — Stakeholder sign-off",
        "op `exit` — params: ",
    ]
    at = [fork.index(marker) for marker in order]
    assert at == sorted(at), dict(zip(order, at))
