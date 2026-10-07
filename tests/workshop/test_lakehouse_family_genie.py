"""P4.3 family 2 — the lakehouse family is walkable in Genie Code (D-41).

Same real-seed harness as the app family (test_app_family_genie_forks.py): every
active ``section_input_prompts`` INSERT is parsed and served in place of the
Lakebase cache.

L1 marker lint: every step in the MCP outline of lakehouse, reverse-lakehouse,
   lakehouse-di and reverse-lakehouse-di, served to a genie-code session, carries
   no local-IDE marker. There are no allowances.
L2 fork resolution: a genie-code session gets the 901-910, 1002 and 1003 fork
   bodies; a non-genie session still gets the default rows.
L3 the MCP outline of the -di tracks contains optimize_genie, although its default
   row sets step_enabled = FALSE: the SPA hides it, MCP does not. This is why
   optimize_genie needs the 1003 fork.
"""

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
# Reviewed allowances: (section_tag, marker) -> (max hits, reason). None today.
ALLOWED: dict = {}

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


def _outline_tags(track):
    """The step tags the MCP server outlines for a genie-code session on ``track``."""
    state = engine.SessionState(session_parameters=dict(GENIE_PARAMS))
    return [item.sectionTag for item in engine.outline(track, state)]


# --- L1: marker lint --------------------------------------------------------------


@pytest.mark.parametrize("track", LAKEHOUSE_TRACKS)
def test_l1_lakehouse_family_bodies_carry_no_local_ide_markers(seeded, track):
    excess = {}
    for tag in _outline_tags(track):
        for marker, count in _hits(_served(track, tag)).items():
            allowed = ALLOWED.get((tag, marker), (0, None))[0]
            if count > allowed:
                excess[(tag, marker)] = (count, allowed)
    assert excess == {}, f"{track}: local-IDE markers over the allowance {excess}"


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
