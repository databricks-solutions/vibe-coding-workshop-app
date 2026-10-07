"""P4.3 family 2 — the lakehouse family is walkable in Genie Code (D-41).

Same real-seed harness as the app family (test_app_family_genie_forks.py): every
active ``section_input_prompts`` INSERT is parsed and served in place of the
Lakebase cache.

L1 marker lint: every step in the MCP outline of lakehouse, reverse-lakehouse,
   lakehouse-di and reverse-lakehouse-di, served to a genie-code session with a
   resolved learner email (as live), carries no local-IDE marker. The one
   allowance is project_setup's own /Workspace/Users/<email>/... skill path.
L2 fork resolution: a genie-code session gets the 901-910, 1002 and 1003 fork
   bodies; a non-genie session still gets the default rows.
L3 the MCP outline of the -di tracks contains optimize_genie, although its default
   row sets step_enabled = FALSE: the SPA hides it, MCP does not. This is why
   optimize_genie needs the 1003 fork.
L4 the 1003 body runs no `bundle run` before the bundle-editor page and the dev
   deploy (the sibling deploy forks' mechanics).
"""

import re

import pytest

from src.backend import mcp_server
from src.backend.api import routes
from src.backend.workshop import assembler, engine

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

LAKEHOUSE_TRACKS = ("lakehouse", "reverse-lakehouse", "lakehouse-di", "reverse-lakehouse-di")
DI_TRACKS = ("lakehouse-di", "reverse-lakehouse-di")
GENIE_PARAMS = {"industry": INDUSTRY, "use_case": USE_CASE, "coding_assistant": "genie-code"}
# A live session has the learner's email; project_setup renders its paths from it.
USER_EMAIL = "learner@databricks.com"
# Reviewed allowances: (section_tag, marker) -> (exempt pattern, reason). Only the
# text the pattern matches is exempt; any other hit of the marker still fails.
ALLOWED = {
    ("project_setup", "@-mention"): (
        re.compile(r"/Workspace/Users/" + re.escape(USER_EMAIL) + r"/[\w./-]+\.md\b"),
        "reviewed 2026-10-07: the learner's own workspace path to the published "
        "genie-code-environment SKILL.md (mcp_server._project_setup_content); the "
        "email's '@domain/...SKILL.md' tail is not an @-mention of a repo file",
    ),
}

# section_tag -> genie-code fork input_id: 901-910 (lakehouse forks), 1002 (#114),
# 1003 (this PR).
FORK_ID = {
    "bronze_layer_creation": 901,
    "silver_layer_sdp": 902,
    "gold_layer_design": 903,
    "gold_layer_pipeline": 904,
    "deploy_lakehouse_assets": 905,
    "usecase_plan": 906,
    "aibi_dashboard": 907,
    "genie_space": 908,
    "deploy_di_assets": 909,
    "agent_framework": 910,
    "redeploy_test": 1002,
    "optimize_genie": 1003,
}
DEFAULT_ID = {
    row["section_tag"]: pk
    for pk, row in SEED_ROWS.items()
    if row.get("coding_assistant") is None and row.get("is_active") is not False
}
# section_tag -> (fork input_id, default input_id).
FORKS = {tag: (fork_id, DEFAULT_ID[tag]) for tag, fork_id in FORK_ID.items()}


def _served_live(track, tag):
    """The prompt _step_payload serves a genie-code session whose email is resolved."""
    state = engine.SessionState(session_parameters=dict(GENIE_PARAMS, user_email=USER_EMAIL))
    return mcp_server._step_payload(track, state, engine.resolve_step(track, state, tag)).prompt


def _outline_tags(track):
    """The step tags the MCP server outlines for a genie-code session on ``track``."""
    state = engine.SessionState(session_parameters=dict(GENIE_PARAMS))
    return [item.sectionTag for item in engine.outline(track, state)]


# --- L1: marker lint --------------------------------------------------------------


@pytest.mark.parametrize("track", LAKEHOUSE_TRACKS)
def test_l1_lakehouse_family_bodies_carry_no_local_ide_markers(seeded, track):
    excess = {}
    for tag in _outline_tags(track):
        body = _served_live(track, tag)
        for marker in _hits(body):
            exempt = ALLOWED.get((tag, marker))
            found = _hits(exempt[0].sub("", body) if exempt else body).get(marker)
            if found:
                excess[(tag, marker)] = found
    assert excess == {}, f"{track}: local-IDE markers outside the allowances {excess}"


def test_l1_project_setup_allowance_is_live(seeded):
    """The allowance is needed (the live path does hit) and covers every hit."""
    body = _served_live("lakehouse-di", "project_setup")
    exempt = ALLOWED[("project_setup", "@-mention")][0]
    assert _hits(body).get("@-mention")
    assert "@-mention" not in _hits(exempt.sub("", body))


def test_l1_lakehouse_forks_are_marker_clean():
    for tag, (fork_id, _) in FORKS.items():
        fork = SEED_ROWS.get(fork_id)
        assert fork is not None and fork["section_tag"] == tag, f"seed has no {tag} fork {fork_id}"
        assert _hits(fork["input_template"]) == {}, fork_id


# --- L2: fork resolution ----------------------------------------------------------


def test_l2_seed_carries_the_optimize_genie_fork():
    fork, default = SEED_ROWS.get(1003), SEED_ROWS[118]
    assert fork is not None, "seed has no input_id 1003"
    assert (fork["section_tag"], fork["coding_assistant"]) == ("optimize_genie", "genie-code")
    assert default["section_tag"] == "optimize_genie" and "coding_assistant" not in default
    # Seed header rule 4: only the prompt fields, at the default's bypass_llm. A fork
    # never carries step_enabled; the SPA reads it from the default.
    assert (fork["version"], fork["is_active"], fork["bypass_llm"]) == (1, True, default["bypass_llm"])
    assert "step_enabled" not in fork and default["step_enabled"] is False


def _fork_cells():
    return [(track, tag) for track in LAKEHOUSE_TRACKS for tag in _outline_tags(track) if tag in FORKS]


def test_l2_every_fork_is_on_a_lakehouse_track():
    assert {tag for _, tag in _fork_cells()} == set(FORKS)


@pytest.mark.parametrize(("track", "tag"), _fork_cells())
def test_l2_genie_get_step_resolves_the_fork(seeded, store, track, tag):
    tags = _outline_tags(track)
    store["s"] = {
        "session_id": "s",
        "workshop_level": track,
        "industry": INDUSTRY,
        "use_case": USE_CASE,
        # Everything before the step is done, so its requiresGate holds.
        "completed_gates": ["use_case_selection", *tags[: tags.index(tag)]],
        "captured_outputs": {},
        "session_parameters": dict(GENIE_PARAMS),
    }
    got = mcp_server.vibe_get_step("s", tag)
    assert not isinstance(got, dict), got
    fork_id, default_id = FORKS[tag]
    fork, default = SEED_ROWS[fork_id]["input_template"], SEED_ROWS[default_id]["input_template"]
    assert _distinct_line(fork, default) in got.prompt
    assert _distinct_line(default, fork) not in got.prompt
    assert got.prompt == _served(track, tag)


@pytest.mark.parametrize("tag", sorted(FORKS))
@pytest.mark.parametrize("assistant", [None, routes.DEFAULT_CODING_ASSISTANT_KEY, "coda"])
def test_l2_non_genie_session_still_gets_the_default(seeded, tag, assistant):
    fork_id, default_id = FORKS[tag]
    fork, default = SEED_ROWS[fork_id]["input_template"], SEED_ROWS[default_id]["input_template"]
    body = assembler.get_section_input_content(
        industry=INDUSTRY,
        use_case=USE_CASE,
        section_tag=tag,
        coding_assistant_override=assistant,
    )["input"]
    assert _distinct_line(default, fork) in body
    assert _distinct_line(fork, default) not in body


# --- L3: the step_enabled divergence ----------------------------------------------


@pytest.mark.parametrize("track", DI_TRACKS)
def test_l3_mcp_outline_contains_optimize_genie(track):
    """MCP ignores step_enabled (the SPA's get_disabled_step_tags); change it on purpose."""
    assert "optimize_genie" in _outline_tags(track)


# --- L4: bundle commands only from the bundle editor, deploy first ----------------

_BUNDLE_PAGE = "Open the bundle editor BEFORE any `bundle` command"
_DEPLOY = "`databricks bundle deploy --target dev`"


def test_l4_optimize_genie_fork_deploys_from_the_bundle_page_before_any_run(seeded):
    """Fork 1003 re-applies Metric View / TVF fixes through the bundle. Like forks
    904/905/909/1002, every `bundle run` follows the bundle-editor page and a dev
    deploy (with source_linked_deployment off, a run without a deploy re-runs the
    last uploaded body), and a `databricks.yml not found` STOP is present."""
    body = _served_live("lakehouse-di", "optimize_genie")
    runs = [m.start() for m in re.finditer(r"bundle run", body)]
    assert runs, "1003 no longer re-applies through the bundle; revisit this pin"
    assert _BUNDLE_PAGE in body and _DEPLOY in body
    assert body.index(_BUNDLE_PAGE) < body.index(_DEPLOY) < min(runs)
    assert "databricks.yml not found" in body
    assert "source_linked_deployment: false" in body
