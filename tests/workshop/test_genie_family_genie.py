"""P4.3 reference track — genie-accelerator is re-verified for Genie Code (D-53).

Same real-seed harness as the other families (test_app_family_genie_forks.py): every
active ``section_input_prompts`` INSERT is parsed and served in place of the Lakebase
cache. Both opt-in flags (includeLakehouse, includeGenieOntology) are on, so the MCP
outline is the full 31-step manifest outline.

G1 inventory: every outline step is a genie-code fork (FORK_ID: the 26 shipped forks
   plus 1017 genie_silver_metadata and the D-58 workspace_cleanup fork 1033, with 15
   of them served by their D-57 v2 rows in 1018-1032, 1023/1028/1029 shipped by D-70)
   or a recorded no-fork with a reason (NO_FORK); the union equals the outline
   exactly.
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
G6 (D-57) each shipped v2 row in 1018-1032 is its v1 fork once the added root block + state-file
   definition is removed and `<ARTIFACT_ROOT>/docs/` -> `docs/`, `<STATE_FILE>` ->
   `.vibecoding-state.md` are reversed (the 1017-vs-114 pattern); v1 stays active.
G7 every row that uses `<STATE_FILE>` (the v2 rows and 1033) defines it with the one
   fixed sentence.
S3 with v1 and v2 both active, the genie-code resolver serves v2 (DISTINCT ON ...
   version DESC) and the shared help fields still come from the Default row.
"""

import inspect
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
    "semlayer_locate": 1018,
    "semlayer_profile": 1019,
    "semlayer_measures": 1020,
    "semlayer_metric_view": 1021,
    "semlayer_synonyms": 1022,
    "gagent_describe": 1023,
    "gagent_instructions": 1024,
    "gagent_verified": 1025,
    "gagent_benchmarks": 1026,
    "gagent_optimize": 1027,
    "gaccel_dashboard": 1028,
    "gaccel_activation": 1029,
    "activation_table_design": 924,
    "activation_reverse_sync": 925,
    "activation_app_design": 926,
    "activation_build_wire": 927,
    "activation_wire_lakebase": 928,
    "activation_wire_genie": 957,
    "activation_deploy_validate": 929,
    "ontology_domain": 1030,
    "ontology_pages": 1031,
    "ontology_routing": 1032,
    "redeploy_test": 1002,
    "genie_silver_metadata": 1017,
    "workspace_cleanup": 1033,
}
# D-57: section_tag -> the v1 fork each v2 row above supersedes (v1 stays in the seed).
V1_ID = {
    "semlayer_locate": 932,
    "semlayer_profile": 951,
    "semlayer_measures": 952,
    "semlayer_metric_view": 933,
    "semlayer_synonyms": 953,
    "gagent_instructions": 954,
    "gagent_verified": 955,
    "gagent_benchmarks": 956,
    "gagent_describe": 934,
    "gagent_optimize": 935,
    "ontology_domain": 936,
    "ontology_pages": 937,
    "ontology_routing": 938,
    "gaccel_dashboard": 940,
    "gaccel_activation": 941,
}
NO_FORK = {
    "project_setup": "virtual step: mcp_server._project_setup_content, no seed body",
    "prd_generation": "LLM step: the model writes the PRD over the default row",
    "iterate_enhance": "D-39: marker-clean default; start-narrow promotion rule",
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
    assert len(FORK_ID) == 28 and all(NO_FORK.values())


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
# D-57: each v2 row's only bare-path hit is the fixed `<STATE_FILE>` definition (G7).
ALLOWED.update(
    {
        (tag, "bare path"): (
            1,
            "D-57 v2 fork: the fixed `<STATE_FILE>` definition's prohibition 'never "
            "`.vibecoding-state.md` relative to the page'; every real read/write is rooted",
        )
        for tag in V1_ID
    }
)
# D-58: 1033 defines `<STATE_FILE>` with the same fixed sentence (G7); every real
# read/write is `<STATE_FILE>` or rooted at `<ARTIFACT_ROOT>`.
ALLOWED[("workspace_cleanup", "bare path")] = (
    1,
    "D-58 fork: the fixed `<STATE_FILE>` definition's prohibition 'never "
    "`.vibecoding-state.md` relative to the page'; every real read/write is rooted",
)
# STOP rule: a real instruction that reads or writes `docs/…` / `.vibecoding-state.md`
# by a bare relative path (it resolves against the page's cwd, not the project root)
# is never allowed: its tag is listed here with the reason, exempt but still hitting,
# until a seed task roots it. D-57 rooted 12 genie-accelerator forks; D-70 ships the
# 3 D-61 held, so none is pending.
PENDING = {}


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


# --- G6 / G7: the D-57 v2 rows are mechanics-only copies of their v1 forks ---------

# 1017 serves 114's how_to_apply, which opens with the "Artifact root (client-aware)" block.
ROOT_BLOCK = SEED_ROWS[114]["how_to_apply"].split("\n\n", 1)[0]
STATE_FILE_DEFINITION = (
    "`<STATE_FILE>` = the live state file that `skills/vibecoding-state` resolves by its "
    "state-path rule (`<app_root>` → `<agent_app_root>` → `<dp_bundle_root>` → the bootstrap "
    "path, creating the canonical file if none exists yet), never `.vibecoding-state.md` "
    "relative to the page."
)
V2_PREAMBLE = ROOT_BLOCK + "\n\n" + STATE_FILE_DEFINITION + "\n\n"


def test_g6_root_block_is_the_shipped_a3_block():
    assert ROOT_BLOCK.startswith("> **Artifact root (client-aware).** Resolve `<ARTIFACT_ROOT>` via `vibecoding-state.resolve_root`")
    assert ROOT_BLOCK.endswith("— never the page's current working directory.") and "\n" not in ROOT_BLOCK


@pytest.mark.parametrize("tag", sorted(V1_ID))
def test_g6_v2_equals_v1_after_reversing_substitutions(tag):
    v2, v1 = SEED_ROWS[FORK_ID[tag]], SEED_ROWS[V1_ID[tag]]
    assert (v2["section_tag"], v2["coding_assistant"]) == (v1["section_tag"], v1["coding_assistant"]) == (tag, "genie-code")
    assert (v1["version"], v1["is_active"], v2["version"], v2["is_active"]) == (1, True, 2, True)
    assert (v2["system_prompt"], v2["bypass_llm"]) == (v1["system_prompt"], v1["bypass_llm"])
    assert "<ARTIFACT_ROOT>" not in v1["input_template"] and "<STATE_FILE>" not in v1["input_template"]
    assert v2["input_template"].startswith(V2_PREAMBLE)
    rest = v2["input_template"][len(V2_PREAMBLE):]
    assert MARKERS["bare path"].findall(rest) == []
    assert rest.replace("<ARTIFACT_ROOT>/docs/", "docs/").replace("<STATE_FILE>", ".vibecoding-state.md") == v1["input_template"]


def test_g7_v2_defines_state_file():
    users = {pk: row for pk, row in SEED_ROWS.items() if "<STATE_FILE>" in (row.get("input_template") or "")}
    assert set(users) == {FORK_ID[tag] for tag in V1_ID} | {FORK_ID["workspace_cleanup"]}
    for pk, row in users.items():
        body = row["input_template"]
        assert body.count(STATE_FILE_DEFINITION) == 1, f"{pk} does not define <STATE_FILE> exactly once"
        assert body.startswith(ROOT_BLOCK + "\n\n" + STATE_FILE_DEFINITION), f"{pk}: definition is not at the top"


def test_g6_d61_held_rows_ship_as_ordinary_v2_rows():
    """D-70: 1023/1028/1029, held by D-61, are served v2 rows of 934/940/941 (G6/G7/S3)."""
    shipped = {"gagent_describe": (934, 1023), "gaccel_dashboard": (940, 1028), "gaccel_activation": (941, 1029)}
    assert {tag: (V1_ID[tag], FORK_ID[tag]) for tag in shipped} == shipped
    assert len(V1_ID) == 15 and PENDING == {}


# --- S3: the resolver serves the highest active version ---------------------------


def _distinct_on(rows, order):
    """Postgres ``SELECT DISTINCT ON (section_tag, coding_assistant) … ORDER BY
    section_tag, coding_assistant, version <order>``: the first row per key."""
    first = {}
    for row in sorted(rows, key=lambda r: r.get("version", 1), reverse=order == "DESC"):
        first.setdefault((row["section_tag"], row["coding_assistant"]), row)
    return list(first.values())


@pytest.fixture
def every_active_version(monkeypatch):
    """The cache query run over every active seed row, v1 and v2 alike."""
    active = [
        dict(row, coding_assistant=row.get("coding_assistant") or routes.DEFAULT_CODING_ASSISTANT_KEY)
        for row in SEED_ROWS.values()
        if row.get("is_active") is not False
    ]
    rows = _distinct_on(active, "DESC")
    routes.clear_lakebase_cache()
    monkeypatch.setattr(routes, "get_section_input_prompts_from_lakebase", lambda: rows)
    yield
    routes.clear_lakebase_cache()


def test_s3_cache_query_orders_by_version_desc():
    assert "ORDER BY section_tag, coding_assistant, version DESC" in inspect.getsource(routes._refresh_lakebase_cache)


@pytest.mark.parametrize("tag", sorted(V1_ID))
def test_s3_served_version(every_active_version, tag):
    v1, v2, default = SEED_ROWS[V1_ID[tag]], SEED_ROWS[FORK_ID[tag]], SEED_ROWS[DEFAULT_ID[tag]]
    assert v1.get("is_active") is not False and v2.get("is_active") is not False
    served = routes.get_section_input_template(tag, "genie-code")
    assert served["input"] == v2["input_template"]
    assert (served["how_to_apply"], served["expected_output"]) == (
        default.get("how_to_apply") or "",
        default.get("expected_output") or "",
    )
    assert routes.get_section_input_template(tag, None)["input"] == default["input_template"]
