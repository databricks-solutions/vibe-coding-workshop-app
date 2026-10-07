"""P4.3 families 3, 4, 7, 8 — end-to-end, accelerator, data-engineering-accelerator,
reverse-lakebase and reverse-app are walkable in Genie Code (D-43, D-44).

After #114 and #115 every step of these five tracks has a genie-code fork or a
recorded no-fork judgment, so this file adds NO fork: it pins what the shared forks
already serve on these tracks, over the same real-seed harness as the app and
lakehouse families (test_app_family_genie_forks.py, test_lakehouse_family_genie.py).

C1 marker lint: every step in the MCP outline of each track, served to a genie-code
   session with a resolved learner email, carries EXACTLY the reviewed number of
   each local-IDE marker (0 unless allowed). The allowed hits are prohibitions or
   descriptions of the server-side build, listed line by line in
   docs/superpowers/plans/2026-10-07-p4-covered-families.md.
C2 fork resolution: every forked tag of these tracks resolves to its fork for a
   genie-code session and to the default row otherwise.
C3 bundle mechanics: in every served fork body, the first `bundle run` command
   follows the bundle-editor page instruction and a dev `bundle deploy` (#115 L4).
C4 app-deploy mechanics (D-44): 912, 929 and 930 name the SDK SNAPSHOT call via
   executeCode as the canonical mechanism, carry the STOP-on-blocked-deploy rule,
   and mention `npm run build` only inside prohibitions.
"""

import re

import pytest

from src.backend import mcp_server
from src.backend.api import routes
from src.backend.workshop import assembler

from .test_app_family_genie_forks import (  # noqa: F401  (seeded/store are fixtures)
    ALLOWED as APP_ALLOWED,
    INDUSTRY,
    SEED_ROWS,
    USE_CASE,
    _distinct_line,
    _hits,
    _served,
    seeded,
    store,
)
from .test_lakehouse_family_genie import (
    ALLOWED as PROJECT_SETUP_ALLOWED,
    DEFAULT_ID,
    GENIE_PARAMS,
    _outline_tags,
    _served_live,
)

COVERED_TRACKS = ("end-to-end", "accelerator", "data-engineering-accelerator", "reverse-lakebase", "reverse-app")

# section_tag -> genie-code fork input_id for every forked step of the five tracks.
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
    "cursor_copilot_ui_design": 911,
    "deploy_databricks_app": 912,
    "setup_lakebase": 922,
    "wire_ui_lakebase": 923,
    "activation_table_design": 924,
    "activation_reverse_sync": 925,
    "activation_app_design": 926,
    "activation_build_wire": 927,
    "activation_wire_lakebase": 928,
    "activation_deploy_validate": 929,
    "wire_ui_agent": 930,
    "sync_from_lakebase": 931,
    "workspace_setup_deploy": 1001,
    "redeploy_test": 1002,
    "optimize_genie": 1003,
}
# The recorded no-fork judgments (plan table): project_setup is virtual; prd_generation
# is LLM over the default; bronze_table_metadata is already client-aware (D-41);
# iterate_enhance and workspace_cleanup per D-39.
NO_FORK = {"project_setup", "prd_generation", "bronze_table_metadata", "iterate_enhance", "workspace_cleanup"}

# Reviewed allowances: (section_tag, marker) -> (exact hit count, reason). The app
# forks' entries come from #114; the rest are the forks first served by these tracks.
_PROHIBITIONS = (
    "existing fork, reviewed 2026-10-07: every hit is a NEVER / do-NOT prohibition "
    "or a description of the server-side build"
)
ALLOWED = {
    **APP_ALLOWED,
    ("activation_reverse_sync", "auth login"): (2, _PROHIBITIONS),
    ("activation_app_design", "npm/npx"): (1, _PROHIBITIONS),
    ("activation_app_design", "localhost"): (1, _PROHIBITIONS),
    ("activation_app_design", "auth login"): (1, _PROHIBITIONS),
    ("activation_app_design", "@-mention"): (
        1,
        "existing fork, reviewed 2026-10-07: names the IDE rule's `@docs/ui_design.md` "
        "key in order to re-key it to <APP_ROOT>; not an instruction to @-mention a file",
    ),
    ("activation_build_wire", "npm/npx"): (6, _PROHIBITIONS),
    ("activation_build_wire", "localhost"): (4, _PROHIBITIONS),
    ("activation_build_wire", "auth login"): (1, _PROHIBITIONS),
    ("activation_wire_lakebase", "npm/npx"): (4, _PROHIBITIONS),
    ("activation_wire_lakebase", "localhost"): (2, _PROHIBITIONS),
    ("activation_wire_lakebase", "auth login"): (3, _PROHIBITIONS),
    ("activation_deploy_validate", "npm/npx"): (7, _PROHIBITIONS),
    ("activation_deploy_validate", "localhost"): (6, _PROHIBITIONS),
    ("activation_deploy_validate", "auth login"): (1, _PROHIBITIONS),
    ("wire_ui_agent", "npm/npx"): (6, _PROHIBITIONS),
    ("wire_ui_agent", "localhost"): (3, _PROHIBITIONS),
    ("wire_ui_agent", "auth login"): (2, _PROHIBITIONS),
    ("sync_from_lakebase", "auth login"): (2, _PROHIBITIONS),
}


def _covered_tags():
    return {tag for track in COVERED_TRACKS for tag in _outline_tags(track)}


# --- C1: marker lint --------------------------------------------------------------


def _marker_counts(tag, body):
    """Per-marker hit counts; project_setup's own workspace skill path is exempt."""
    exempt = PROJECT_SETUP_ALLOWED.get((tag, "@-mention"))
    found = _hits(body)
    if exempt:
        found = dict(found, **{"@-mention": _hits(exempt[0].sub("", body)).get("@-mention", 0)})
    return {marker: count for marker, count in found.items() if count}


@pytest.mark.parametrize("track", COVERED_TRACKS)
def test_c1_covered_bodies_carry_exactly_the_reviewed_markers(seeded, track):
    wrong = {}
    for tag in _outline_tags(track):
        found = _marker_counts(tag, _served_live(track, tag))
        expected = {marker: cap for (t, marker), (cap, _) in ALLOWED.items() if t == tag}
        if found != expected:
            wrong[tag] = {"found": found, "reviewed": expected}
    assert wrong == {}, f"{track}: local-IDE markers differ from the reviewed counts {wrong}"


def test_c1_every_allowance_is_on_a_covered_track():
    """No stale allowance: each (tag, marker) allowed here is served by some track."""
    assert {tag for tag, _ in ALLOWED} <= _covered_tags()
    assert all(reason for _, reason in ALLOWED.values())


# --- C2: fork resolution ----------------------------------------------------------


def test_c2_every_step_is_forked_or_judged():
    assert _covered_tags() == set(FORK_ID) | NO_FORK
    assert not set(FORK_ID) & NO_FORK


@pytest.mark.parametrize("tag", sorted(FORK_ID))
def test_c2_seed_carries_the_fork(tag):
    fork = SEED_ROWS.get(FORK_ID[tag])
    assert fork is not None, f"seed has no {tag} fork {FORK_ID[tag]}"
    assert (fork["section_tag"], fork["coding_assistant"]) == (tag, "genie-code")
    assert fork.get("is_active") is not False
    assert tag in DEFAULT_ID, f"{tag} has no default row"


def _fork_cells():
    return [(track, tag) for track in COVERED_TRACKS for tag in _outline_tags(track) if tag in FORK_ID]


def _bodies(tag):
    fork = SEED_ROWS.get(FORK_ID[tag])
    assert fork is not None and fork["section_tag"] == tag, f"seed has no {tag} fork {FORK_ID[tag]}"
    return fork["input_template"], SEED_ROWS[DEFAULT_ID[tag]]["input_template"]


@pytest.mark.parametrize(("track", "tag"), _fork_cells())
def test_c2_genie_get_step_resolves_the_fork(seeded, store, track, tag):
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
    fork, default = _bodies(tag)
    assert _distinct_line(fork, default) in got.prompt
    assert _distinct_line(default, fork) not in got.prompt
    assert got.prompt == _served(track, tag)


@pytest.mark.parametrize("tag", sorted(FORK_ID))
@pytest.mark.parametrize("assistant", [None, routes.DEFAULT_CODING_ASSISTANT_KEY, "coda"])
def test_c2_non_genie_session_still_gets_the_default(seeded, tag, assistant):
    fork, default = _bodies(tag)
    body = assembler.get_section_input_content(
        industry=INDUSTRY,
        use_case=USE_CASE,
        section_tag=tag,
        coding_assistant_override=assistant,
    )["input"]
    assert _distinct_line(default, fork) in body
    assert _distinct_line(fork, default) not in body


# --- C3: bundle commands only from the bundle editor, deploy first ----------------

# A `bundle run` COMMAND (backtick-led); prose such as "this bundle run proves …" is not.
_RUN = re.compile(r"`(?:databricks )?bundle run\b")
_DEPLOY = re.compile(r"`(?:databricks )?bundle deploy --target dev`")
_BUNDLE_PAGE = "Open the bundle editor BEFORE any `bundle` command"
# 1002 states the page in its deploy sentence rather than as the shared bullet.
_BUNDLE_PAGE_FOR = {"redeploy_test": "from the bundle editor"}
BUNDLE_RUN_TAGS = {
    "bronze_layer_creation",
    "silver_layer_sdp",
    "gold_layer_pipeline",
    "deploy_lakehouse_assets",
    "aibi_dashboard",
    "genie_space",
    "deploy_di_assets",
    "optimize_genie",
    "agent_framework",
    "redeploy_test",
}


def _served_forks():
    """(track, tag, body) for one track that serves each forked tag."""
    seen = {}
    for track, tag in _fork_cells():
        seen.setdefault(tag, track)
    return [(track, tag, _served_live(track, tag)) for tag, track in sorted(seen.items())]


def test_c3_bundle_run_follows_the_bundle_page_and_a_dev_deploy(seeded):
    """The deploy closest before the first run must itself follow the page
    instruction: an earlier "deploy verb = `bundle deploy …`" note does not count."""
    with_runs = set()
    for _, tag, body in _served_forks():
        runs = [m.start() for m in _RUN.finditer(body)]
        if not runs:
            continue
        with_runs.add(tag)
        page = body.find(_BUNDLE_PAGE_FOR.get(tag, _BUNDLE_PAGE))
        deploys = [m.start() for m in _DEPLOY.finditer(body) if m.start() < runs[0]]
        assert page >= 0, f"{tag}: no bundle-editor page instruction"
        assert deploys and page < deploys[-1], f"{tag}: first `bundle run` has no dev deploy after the page"
        assert "databricks.yml not found" in body, tag
    assert with_runs == BUNDLE_RUN_TAGS


# --- C4: app deploy = SDK SNAPSHOT via executeCode (D-44) -------------------------

_SDK_CALL = re.compile(r"w\.apps\.deploy\([^\n]*AppDeploymentMode\.SNAPSHOT\)")
# tag -> (SDK call lines, canonical-mechanism statement, STOP rule).
APP_DEPLOY = {
    "deploy_databricks_app": (
        2,
        re.compile(r"canonical deploy mechanism here is the \*\*SDK SNAPSHOT\*\* call run through `executeCode`:\n`w\.apps\.deploy\("),
        "STOP — do not work around a blocked deploy.",
    ),
    "activation_deploy_validate": (
        2,
        re.compile(r"canonical deploy mechanism here is the \*\*SDK SNAPSHOT\*\* call run through `executeCode`:\n`w\.apps\.deploy\("),
        "STOP — do not work around a blocked deploy.",
    ),
    "wire_ui_agent": (
        1,
        re.compile(r"Redeploy via the SDK SNAPSHOT path[^\n]*\n\nRun via `executeCode`"),
        "STOP — do not work around a blocked redeploy.",
    ),
}
_CLI_NOT_CANONICAL = "**DO NOT** rely on `databricks apps deploy` via `runDatabricksCli`"
# Every `npm run build` line is one of these prohibitions / server-side descriptions.
_NO_LOCAL_BUILD = re.compile(r"\bNEVER\b|\bdo NOT\b|\bnot via\b|\bNO local\b|on Genie Code substitute")


@pytest.mark.parametrize("tag", sorted(APP_DEPLOY))
def test_c4_app_deploy_forks_name_the_sdk_snapshot_call(seeded, tag):
    calls, canonical, stop = APP_DEPLOY[tag]
    served = {t: body for _, t, body in _served_forks()}
    assert tag in served, f"{tag} is not served on a covered track"
    body = served[tag]
    assert len(_SDK_CALL.findall(body)) == calls, f"{tag}: SDK SNAPSHOT call lines changed"
    assert canonical.search(body), f"{tag}: no canonical SDK SNAPSHOT via executeCode statement"
    assert _CLI_NOT_CANONICAL in body, tag
    assert stop in body, tag
    builds = [line for line in body.splitlines() if "npm run build" in line]
    assert builds and all(_NO_LOCAL_BUILD.search(line) for line in builds), [
        line[:120] for line in builds if not _NO_LOCAL_BUILD.search(line)
    ]
