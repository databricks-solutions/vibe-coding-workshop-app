"""P4.3 reference track — genie-accelerator is re-verified for Genie Code (D-53).

Same real-seed harness as the other families (test_app_family_genie_forks.py): every
active ``section_input_prompts`` INSERT is parsed and served in place of the Lakebase
cache. Both opt-in flags (includeLakehouse, includeGenieOntology) are on, so the MCP
outline is the full 31-step manifest outline.

G1 inventory: every outline step is a genie-code fork (FORK_ID: the 26 shipped forks
   plus 1017 genie_silver_metadata, this PR) or a recorded no-fork with a reason
   (NO_FORK); the union equals the outline exactly.
G2 served source: a genie-code session gets every FORK_ID row; a non-genie session
   still gets the default row.
G3 marker lint: every served fork body carries EXACTLY the reviewed number of each
   local-IDE marker (@-mention, --profile, npm/npx, localhost, auth login, `.sh`
   invocation, bare relative artifact path). An allowance is a NEVER / do-NOT
   prohibition, a description of the server-side build, or a path the same line
   already roots; each hit line is listed in the PR's hit appendix. A hit that is a
   real instruction is never allowed: its tag is PENDING with the reason (STOP rule).
G4 1017 is default 114 with only `docs/genie_plan.md` -> `<ARTIFACT_ROOT>/docs/genie_plan.md`.
G5 the hybrid / ui-driven execution classes stay as shipped.
"""

import re

import pytest

from src.backend import mcp_server
from src.backend.api import routes
from src.backend.workshop import assembler, engine, manifest

from .test_app_family_genie_forks import (  # noqa: F401  (seeded/store are fixtures)
    INDUSTRY,
    MARKERS as IDE_MARKERS,
    SEED_ROWS,
    USE_CASE,
    _distinct_line,
    seeded,
    store,
)
from .test_lakehouse_family_genie import DEFAULT_ID, GENIE_PARAMS, USER_EMAIL

TRACK = "genie-accelerator"
FLAGS = {"includeLakehouse": True, "includeGenieOntology": True}
SESSION_PARAMS = dict(GENIE_PARAMS, **FLAGS)

# section_tag -> genie-code fork input_id for every forked step of the track.
FORK_ID = {
    "gold_layer_design": 903,
    "gold_layer_pipeline": 904,
    "deploy_lakehouse_assets": 905,
    "semlayer_locate": 932,
    "semlayer_profile": 951,
    "semlayer_measures": 952,
    "semlayer_metric_view": 933,
    "semlayer_synonyms": 953,
    "gagent_describe": 934,
    "gagent_instructions": 954,
    "gagent_verified": 955,
    "gagent_benchmarks": 956,
    "gagent_optimize": 935,
    "gaccel_dashboard": 940,
    "gaccel_activation": 941,
    "activation_table_design": 924,
    "activation_reverse_sync": 925,
    "activation_app_design": 926,
    "activation_build_wire": 927,
    "activation_wire_lakebase": 928,
    "activation_wire_genie": 957,
    "activation_deploy_validate": 929,
    "ontology_domain": 936,
    "ontology_pages": 937,
    "ontology_routing": 938,
    "redeploy_test": 1002,
    "genie_silver_metadata": 1017,
}
NO_FORK = {
    "project_setup": "virtual step: mcp_server._project_setup_content, no seed body",
    "prd_generation": "LLM step: the model writes the PRD over the default row",
    "iterate_enhance": "D-39: marker-clean default; start-narrow promotion rule",
    "workspace_cleanup": "D-39: marker-clean default; start-narrow promotion rule",
}


def _outline_tags():
    state = engine.SessionState(session_parameters=dict(SESSION_PARAMS))
    return [item.sectionTag for item in engine.outline(TRACK, state)]


def _served(tag):
    """The prompt _step_payload serves a genie-code session whose email is resolved."""
    state = engine.SessionState(session_parameters=dict(SESSION_PARAMS, user_email=USER_EMAIL))
    return mcp_server._step_payload(TRACK, state, engine.resolve_step(TRACK, state, tag)).prompt


# --- G1: inventory ----------------------------------------------------------------


def test_g1_outline_is_the_full_manifest_outline():
    assert _outline_tags() == [step.sectionTag for step in manifest.load_manifest().track_steps(TRACK)]
    assert len(_outline_tags()) == 31


def test_g1_every_step_is_forked_or_judged():
    assert set(_outline_tags()) == set(FORK_ID) | set(NO_FORK)
    assert not set(FORK_ID) & set(NO_FORK)
    assert len(FORK_ID) == 27 and all(NO_FORK.values())


@pytest.mark.parametrize("tag", sorted(FORK_ID))
def test_g1_seed_carries_the_fork(tag):
    fork = SEED_ROWS.get(FORK_ID[tag])
    assert fork is not None, f"seed has no {tag} fork {FORK_ID[tag]}"
    assert (fork["section_tag"], fork["coding_assistant"]) == (tag, "genie-code")
    assert fork.get("is_active") is not False
    assert tag in DEFAULT_ID, f"{tag} has no default row"


def test_g1_no_fork_steps_have_no_genie_code_row():
    forked = {row["section_tag"] for row in SEED_ROWS.values() if row.get("coding_assistant") == "genie-code"}
    assert not forked & set(NO_FORK)


# --- G2: served source ------------------------------------------------------------


def _bodies(tag):
    return SEED_ROWS[FORK_ID[tag]]["input_template"], SEED_ROWS[DEFAULT_ID[tag]]["input_template"]


@pytest.mark.parametrize("tag", sorted(FORK_ID))
def test_g2_genie_get_step_resolves_the_fork(seeded, store, tag):
    tags = _outline_tags()
    store["s"] = {
        "session_id": "s",
        "workshop_level": TRACK,
        "industry": INDUSTRY,
        "use_case": USE_CASE,
        # Everything before the step is done, so its requiresGate holds.
        "completed_gates": ["use_case_selection", *tags[: tags.index(tag)]],
        "captured_outputs": {},
        "session_parameters": dict(SESSION_PARAMS),
    }
    got = mcp_server.vibe_get_step("s", tag)
    assert not isinstance(got, dict), got
    fork, default = _bodies(tag)
    assert _distinct_line(fork, default) in got.prompt
    assert _distinct_line(default, fork) not in got.prompt


@pytest.mark.parametrize("tag", sorted(FORK_ID))
@pytest.mark.parametrize("assistant", [None, routes.DEFAULT_CODING_ASSISTANT_KEY, "coda"])
def test_g2_non_genie_session_still_gets_the_default(seeded, tag, assistant):
    fork, default = _bodies(tag)
    body = assembler.get_section_input_content(
        industry=INDUSTRY,
        use_case=USE_CASE,
        section_tag=tag,
        coding_assistant_override=assistant,
    )["input"]
    assert _distinct_line(default, fork) in body
    assert _distinct_line(fork, default) not in body


# --- G3: marker lint --------------------------------------------------------------

_MLFLOW_ALIASES = r"(?:production|staging|champion|challenger|scorer|alias|latest)\b"
# The L0 probe's strict forms (state/probes/p4-genie-reverify-before.md): any npm/npx
# word, any `.sh`, and every `@token`, split by kind. "@-mention" is a file-style
# mention (`@docs…`, `@x.md`, `@x.json`); "@ package / at-rule" is an npm scope
# (`@databricks/appkit`) or a CSS at-rule (`@import`, `@layer`, `@tailwind`), counted
# separately inside ``` code (file content / the static-scan script) and in prose.
MARKERS = {
    "npm/npx": re.compile(r"\bnp[mx]\b"),
    "localhost": IDE_MARKERS["localhost"],
    "auth login": IDE_MARKERS["auth login"],
    ".sh": re.compile(r"\.sh\b"),
    "--profile": re.compile(r"--profile\b"),
    "@-mention": re.compile(r"(?<![\w.@])@(?:docs\b|[\w.-]+(?:/[\w.-]+)*\.(?:md|json)\b)"),
    # A `docs/` or `.vibecoding-state.md` path not rooted by a `<…root>/` placeholder
    # or a /Workspace/... path (the A3 rule, test_agents_family_genie.py).
    "bare path": re.compile(r"(?<![\w/.-])(?:docs/|\.vibecoding-state\.md)"),
}
_AT_TOKEN = re.compile(
    r"(?<![\w.@])@(?!docs\b)(?!" + _MLFLOW_ALIASES + r")(?![\w.-]+(?:/[\w.-]+)*\.(?:md|json)\b)[A-Za-z_][\w./-]*"
)
AT_CODE, AT_PROSE = "@ package / at-rule (code)", "@ package / at-rule (prose)"

_PROHIBITIONS = (
    "existing fork, reviewed 2026-10-07: every hit is a NEVER / do-NOT / no-local "
    "prohibition or a description of the server-side build"
)
_NOT_AT_DOCS = "existing fork, reviewed 2026-10-07: the prohibition 'NOT `@docs/…`' beside a rooted path"
_OMIT_PROFILE = "existing fork, reviewed 2026-10-07: '{databricks_cli_profile} is inert … omit `--profile`'"
_IN_CODE = (
    "existing fork, reviewed 2026-10-07: npm scopes / CSS at-rules inside ``` code — the "
    "server.ts / client import lines the agent writes as file content, and the string "
    "literals of the static-scan script it runs via executeCode; not an @-mention"
)
_IN_PROSE = (
    "existing fork, reviewed 2026-10-07: prose naming the npm package or CSS at-rule that "
    "an import / stylesheet line must (or must not) use; not an @-mention, not an npm run"
)
# Reviewed allowances: (section_tag, marker) -> (exact hit count, reason). Every
# other (fork, marker) is allowed none.
ALLOWED = {
    ("gold_layer_design", "bare path"): (
        2,
        "existing fork, reviewed 2026-10-07: `docs/BUSINESS_ONBOARDING_GUIDE.md` is named "
        "as a file inside `<DP_BUNDLE_ROOT>/gold_layer_design/`, the directory the same "
        "line roots (deliverables list; gate)",
    ),
    ("activation_table_design", "@-mention"): (1, _NOT_AT_DOCS),
    ("activation_table_design", "bare path"): (1, _NOT_AT_DOCS),
    ("activation_reverse_sync", "auth login"): (2, _PROHIBITIONS),
    ("activation_reverse_sync", "@-mention"): (1, _NOT_AT_DOCS),
    ("activation_reverse_sync", "bare path"): (
        2,
        "existing fork, reviewed 2026-10-07: one 'NOT `@docs/…`' prohibition; one names the "
        "`.vibecoding-state.md` of `dp_bundle_root`, which the same line roots at `<artifact_root>/`",
    ),
    ("activation_app_design", "npm/npx"): (1, _PROHIBITIONS),
    ("activation_app_design", "localhost"): (1, _PROHIBITIONS),
    ("activation_app_design", "auth login"): (1, _PROHIBITIONS),
    ("activation_app_design", "@-mention"): (
        2,
        "existing fork, reviewed 2026-10-07: one 'NOT `@docs/…`' prohibition; one names the "
        "IDE rule's `@docs/ui_design.md` key in order to re-key it to <APP_ROOT>",
    ),
    ("activation_app_design", AT_PROSE): (1, _IN_PROSE),
    ("activation_app_design", "bare path"): (
        2,
        "existing fork, reviewed 2026-10-07: the same two `@docs` lines as the @-mention entry",
    ),
    ("activation_build_wire", "npm/npx"): (8, _PROHIBITIONS),
    ("activation_build_wire", "localhost"): (4, _PROHIBITIONS),
    ("activation_build_wire", "auth login"): (1, _PROHIBITIONS),
    ("activation_build_wire", "--profile"): (1, _OMIT_PROFILE),
    ("activation_build_wire", "@-mention"): (1, _NOT_AT_DOCS),
    ("activation_build_wire", AT_CODE): (31, _IN_CODE),
    ("activation_build_wire", AT_PROSE): (17, _IN_PROSE),
    ("activation_build_wire", "bare path"): (1, _NOT_AT_DOCS),
    ("activation_wire_lakebase", "npm/npx"): (5, _PROHIBITIONS),
    ("activation_wire_lakebase", "localhost"): (2, _PROHIBITIONS),
    ("activation_wire_lakebase", "auth login"): (3, _PROHIBITIONS),
    ("activation_wire_lakebase", "--profile"): (1, _OMIT_PROFILE),
    ("activation_wire_lakebase", AT_CODE): (5, _IN_CODE),
    ("activation_wire_lakebase", AT_PROSE): (5, _IN_PROSE),
    ("activation_wire_genie", "npm/npx"): (5, _PROHIBITIONS),
    ("activation_wire_genie", "localhost"): (2, _PROHIBITIONS),
    ("activation_wire_genie", "auth login"): (2, _PROHIBITIONS),
    ("activation_wire_genie", "--profile"): (1, _OMIT_PROFILE),
    ("activation_wire_genie", AT_CODE): (8, _IN_CODE),
    ("activation_wire_genie", AT_PROSE): (11, _IN_PROSE),
    ("activation_wire_genie", "bare path"): (
        1,
        "existing fork, reviewed 2026-10-07: a back-reference to `<APP_ROOT>/.vibecoding-state.md`, "
        "which the body's **First:** line reads by its full rooted path",
    ),
    ("activation_deploy_validate", "npm/npx"): (8, _PROHIBITIONS),
    ("activation_deploy_validate", "localhost"): (6, _PROHIBITIONS),
    ("activation_deploy_validate", "auth login"): (1, _PROHIBITIONS),
    ("activation_deploy_validate", "--profile"): (1, _OMIT_PROFILE),
    ("activation_deploy_validate", AT_CODE): (30, _IN_CODE),
    ("activation_deploy_validate", AT_PROSE): (5, _IN_PROSE),
    ("redeploy_test", ".sh"): (
        1,
        "existing fork, reviewed 2026-10-07: 'do NOT run project shell scripts (… `.sh` files are IDE-only …)'",
    ),
    ("redeploy_test", "--profile"): (1, _OMIT_PROFILE),
    ("redeploy_test", "bare path"): (
        2,
        "existing fork, reviewed 2026-10-07: both are 'do not regenerate the whole `docs/` tree' prohibitions",
    ),
}
# STOP rule: real instructions, never allowed. Each fork tells Genie Code to read or
# write `docs/…` / `.vibecoding-state.md` by a bare relative path, which resolves
# against the page's cwd, not the project root. A seed task must root them; until
# then the marker is exempt here but must still hit (so the entry is removed with the fix).
_BARE_READS = (
    "STOP 2026-10-07: real instructions ('Read `docs/…` and `.vibecoding-state.md` first', "
    "'record … in `.vibecoding-state.md`', the gate's `docs/genie_brief.md`) by bare relative path"
)
PENDING = {
    (tag, "bare path"): _BARE_READS
    for tag in (
        "semlayer_locate",
        "semlayer_profile",
        "semlayer_measures",
        "semlayer_metric_view",
        "semlayer_synonyms",
        "gagent_describe",
        "gagent_instructions",
        "gagent_verified",
        "gagent_benchmarks",
        "gagent_optimize",
        "gaccel_dashboard",
        "gaccel_activation",
        "ontology_domain",
        "ontology_pages",
        "ontology_routing",
    )
}


def _in_code(body):
    """Per line: True inside a ``` fence, False outside (fence lines count as code)."""
    flags, inside = [], False
    for line in body.splitlines():
        fence = line.strip().startswith("```")
        flags.append(inside or fence)
        inside ^= fence
    return flags


def _marker_counts(body):
    found = {name: len(rx.findall(body)) for name, rx in MARKERS.items() if rx.search(body)}
    in_code = _in_code(body)
    for match in _AT_TOKEN.finditer(body):
        kind = AT_CODE if in_code[body.count("\n", 0, match.start())] else AT_PROSE
        found[kind] = found.get(kind, 0) + 1
    return found


def test_g3_fork_bodies_carry_exactly_the_reviewed_markers(seeded):
    wrong = {}
    for tag in sorted(FORK_ID):
        found = _marker_counts(_served(tag))
        for key in PENDING:
            if key[0] == tag:
                assert found.pop(key[1], 0), f"{key} is fixed: drop it from PENDING"
        expected = {marker: cap for (t, marker), (cap, _) in ALLOWED.items() if t == tag}
        if found != expected:
            wrong[tag] = {"found": found, "reviewed": expected}
    assert wrong == {}, f"local-IDE markers differ from the reviewed counts {wrong}"


def test_g3_every_allowance_names_a_served_fork_with_a_reason():
    assert {tag for tag, _ in ALLOWED} | {tag for tag, _ in PENDING} <= set(FORK_ID)
    assert not set(ALLOWED) & set(PENDING)
    assert all(reason for _, reason in ALLOWED.values()) and all(PENDING.values())
    assert "genie_silver_metadata" not in {tag for tag, _ in ALLOWED} | {tag for tag, _ in PENDING}


# --- G4: 1017 is a mechanics-only copy of 114 -------------------------------------

BARE_PLAN = "docs/genie_plan.md"
ROOTED_PLAN = "<ARTIFACT_ROOT>/docs/genie_plan.md"


def test_g4_1017_differs_from_114_only_in_the_rooted_plan_path():
    fork, default = SEED_ROWS[1017], SEED_ROWS[114]
    assert (default["section_tag"], default.get("coding_assistant")) == ("genie_silver_metadata", None)
    assert fork["input_template"].count(ROOTED_PLAN) == default["input_template"].count(BARE_PLAN) == 1
    assert ROOTED_PLAN not in default["input_template"]
    assert fork["input_template"].replace(ROOTED_PLAN, BARE_PLAN) == default["input_template"]
    assert (fork["system_prompt"], fork["bypass_llm"]) == (default["system_prompt"], default["bypass_llm"])
    assert (fork["version"], fork["is_active"]) == (1, True)


def test_g4_shared_fields_still_come_from_114(seeded):
    """how_to_apply / expected_output carry the other two `docs/genie_plan.md` mentions.
    The resolver ALWAYS serves those shared fields from the default row
    (routes.get_section_input_template), so a fork cannot change them; they are help
    text (vibe_explain_step), not the prompt Genie Code runs."""
    got = assembler.get_section_input_content(
        industry=INDUSTRY,
        use_case=USE_CASE,
        section_tag="genie_silver_metadata",
        coding_assistant_override="genie-code",
    )
    shared = got["how_to_apply"] + got["expected_output"]
    assert len(MARKERS["bare path"].findall(shared)) == 2
    assert got["expected_output"].startswith(SEED_ROWS[114]["expected_output"][:40])


# --- G5: execution classes --------------------------------------------------------

EXECUTION = {
    "semlayer_measures": "hybrid",
    "ontology_domain": "hybrid",
    "ontology_pages": "ui-driven",
    "ontology_routing": "ui-driven",
}


def test_g5_execution_classes_stay_as_shipped():
    steps = manifest.load_manifest().track_steps(TRACK)
    assert {step.sectionTag: step.execution for step in steps if step.execution != "agent-doable"} == EXECUTION
    state = engine.SessionState(session_parameters=dict(SESSION_PARAMS))
    outlined = {item.sectionTag: item.execution for item in engine.outline(TRACK, state)}
    assert {tag: outlined[tag] for tag in EXECUTION} == EXECUTION
