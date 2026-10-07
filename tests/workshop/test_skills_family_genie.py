"""P4.3 family 5 — skills-accelerator is walkable in Genie Code (D-45, D-46).

Same real-seed harness as the app and lakehouse families
(test_app_family_genie_forks.py, test_lakehouse_family_genie.py): every active
``section_input_prompts`` INSERT is parsed and served in place of the Lakebase cache.

S1 marker lint: every step in the skills-accelerator MCP outline, served to a
   genie-code session with a resolved learner email (as live), carries no local-IDE
   marker. The one allowance is project_setup's own /Workspace/Users/<email>/... path.
S2 fork resolution: a genie-code session gets the 1004-1006 and 1002 fork bodies; a
   non-genie session still gets the default rows.
S3 paths: the 1004/1005 bodies name no bare relative data_product_accelerator/skills/
   path, and 1005 saves under <REPO_ROOT>, publishes into .assistant/skills and
   verifies, in that order.
S4 no in-session mutation (D-46): 1005 generates the SET TAGS statements as a dry run
   and runs none of them; the next step's bundle job applies them.
S5 1006 writes its bundle files with executeCode open().write (never createAsset /
   editAsset), pins source_linked_deployment: false, and runs no `bundle run` before
   the bundle-editor page and the dev deploy.
"""

import re

import pytest

from src.backend import mcp_server
from src.backend.api import routes
from src.backend.workshop import assembler, engine

from .test_app_family_genie_forks import (  # noqa: F401  (seeded/store are fixtures)
    SEED_ROWS,
    _distinct_line,
    _hits,
    seeded,
    store,
)

TRACK = "skills-accelerator"
INDUSTRY = "sample"
# resolve_track keeps skills-accelerator only for its locked use case.
USE_CASE = "build_skill"
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

# section_tag -> genie-code fork input_id: 1002 (#114), 1004-1006 (this PR).
FORK_ID = {
    "skill_install_explore": 1004,
    "skill_apply_contracts": 1005,
    "skill_certify_tables": 1006,
    "redeploy_test": 1002,
}
NEW_FORKS = {"skill_install_explore": 1004, "skill_apply_contracts": 1005, "skill_certify_tables": 1006}
DEFAULT_ID = {
    row["section_tag"]: pk
    for pk, row in SEED_ROWS.items()
    if row.get("coding_assistant") is None and row.get("is_active") is not False
}
# section_tag -> (fork input_id, default input_id).
FORKS = {tag: (fork_id, DEFAULT_ID[tag]) for tag, fork_id in FORK_ID.items()}


def _served(tag):
    """The prompt _step_payload serves a genie-code (MCP) session for ``tag``."""
    state = engine.SessionState(session_parameters=dict(GENIE_PARAMS))
    return mcp_server._step_payload(TRACK, state, engine.resolve_step(TRACK, state, tag)).prompt


def _served_live(tag):
    """The prompt _step_payload serves a genie-code session whose email is resolved."""
    state = engine.SessionState(session_parameters=dict(GENIE_PARAMS, user_email=USER_EMAIL))
    return mcp_server._step_payload(TRACK, state, engine.resolve_step(TRACK, state, tag)).prompt


def _outline_tags():
    state = engine.SessionState(session_parameters=dict(GENIE_PARAMS))
    return [item.sectionTag for item in engine.outline(TRACK, state)]


def _fork(fork_id):
    row = SEED_ROWS.get(fork_id)
    assert row is not None, f"seed has no input_id {fork_id}"
    return row["input_template"]


# --- S1: marker lint --------------------------------------------------------------


def test_s1_skills_bodies_carry_no_local_ide_markers(seeded):
    excess = {}
    for tag in _outline_tags():
        body = _served_live(tag)
        for marker in _hits(body):
            exempt = ALLOWED.get((tag, marker))
            found = _hits(exempt[0].sub("", body) if exempt else body).get(marker)
            if found:
                excess[(tag, marker)] = found
    assert excess == {}, f"{TRACK}: local-IDE markers outside the allowances {excess}"


def test_s1_project_setup_allowance_is_live(seeded):
    """The allowance is needed (the live path does hit) and covers every hit."""
    body = _served_live("project_setup")
    exempt = ALLOWED[("project_setup", "@-mention")][0]
    assert _hits(body).get("@-mention")
    assert "@-mention" not in _hits(exempt.sub("", body))


def test_s1_skills_forks_are_marker_clean():
    for tag, (fork_id, _) in FORKS.items():
        assert SEED_ROWS[fork_id]["section_tag"] == tag, fork_id
        assert _hits(_fork(fork_id)) == {}, fork_id


# --- S2: fork resolution ----------------------------------------------------------


@pytest.mark.parametrize("tag", sorted(NEW_FORKS))
def test_s2_seed_carries_the_fork_rows(tag):
    fork_id, default_id = FORKS[tag]
    fork, default = SEED_ROWS.get(fork_id), SEED_ROWS[default_id]
    assert fork is not None, f"seed has no input_id {fork_id}"
    assert (fork["section_tag"], fork["coding_assistant"]) == (tag, "genie-code")
    assert default["section_tag"] == tag and "coding_assistant" not in default
    # Seed header rule 4: only the prompt fields, at the default's bypass_llm.
    assert (fork["version"], fork["is_active"], fork["bypass_llm"]) == (1, True, default["bypass_llm"])
    assert "step_enabled" not in fork and "section_title" not in fork and "how_to_apply" not in fork


def test_s2_every_fork_is_on_the_outline():
    assert set(FORKS) <= set(_outline_tags())


@pytest.mark.parametrize("tag", sorted(FORKS))
def test_s2_genie_get_step_resolves_the_fork(seeded, store, tag):
    tags = _outline_tags()
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
    fork_id, default_id = FORKS[tag]
    fork, default = _fork(fork_id), SEED_ROWS[default_id]["input_template"]
    assert _distinct_line(fork, default) in got.prompt
    assert _distinct_line(default, fork) not in got.prompt
    assert got.prompt == _served(tag)


@pytest.mark.parametrize("tag", sorted(FORKS))
@pytest.mark.parametrize("assistant", [None, routes.DEFAULT_CODING_ASSISTANT_KEY, "coda"])
def test_s2_non_genie_session_still_gets_the_default(seeded, tag, assistant):
    fork_id, default_id = FORKS[tag]
    fork, default = _fork(fork_id), SEED_ROWS[default_id]["input_template"]
    body = assembler.get_section_input_content(
        industry=INDUSTRY,
        use_case=USE_CASE,
        section_tag=tag,
        coding_assistant_override=assistant,
    )["input"]
    assert _distinct_line(default, fork) in body
    assert _distinct_line(fork, default) not in body


# --- S3: no bare relative skill paths; 1005 publishes ----------------------------

_SKILL_PATH = re.compile(r"data_product_accelerator/skills/")
# A skill path is anchored when it is a readSkillFile path (which the published
# /Workspace/Users/<email>/.assistant/skills/vibe-coding-workshop/ path also ends in)
# or sits under the clone root.
_ANCHORS = ("skills/vibe-coding-workshop/", "<REPO_ROOT>/")


@pytest.mark.parametrize("fork_id", [1004, 1005])
def test_s3_no_bare_relative_skill_paths(fork_id):
    body = _fork(fork_id)
    starts = [m.start() for m in _SKILL_PATH.finditer(body)]
    assert starts, f"{fork_id} names no skill path; revisit this pin"
    bare = [body[max(0, at - 40) : at + 40] for at in starts if not body[:at].endswith(_ANCHORS)]
    assert bare == [], f"{fork_id}: bare relative skill path(s) {bare}"


_PUBLISHED = "/Workspace/Users/<your-email>/.assistant/skills/vibe-coding-workshop/"


def test_s3_apply_contracts_saves_publishes_then_verifies():
    """A skill saved only in the clone is not loadable in Genie Code: 1005 writes it
    under <REPO_ROOT>, copies that folder into the published skills copy, and checks
    both copies with os.path.exists, in that order; then loads it via readSkillFile."""
    body = _fork(1005)
    save = body.index("<REPO_ROOT>/data_product_accelerator/skills/common/<skill-name>/")
    copies = [
        line
        for line in body.splitlines()
        if "shutil.copytree(" in line and _PUBLISHED + "data_product_accelerator/skills/common/" in line
    ]
    assert len(copies) == 1, copies
    copy = body.index(copies[0])
    verify = body.index("os.path.exists", copy)
    use = body.index('readSkillFile("skills/vibe-coding-workshop/data_product_accelerator/skills/common/<skill-name>/')
    assert save < copy < verify < use


# --- S4: 1005 is a dry run (D-46) -----------------------------------------------

_MUTATION = re.compile(r"\b(?:ALTER\s+TABLE|SET\s+TAGS|UNSET\s+TAGS|CREATE|DROP|INSERT|UPDATE|DELETE|MERGE)\b")
_EXECUTE = re.compile(r"\b(?:run|runs|execute|executes|apply|applies|executeCode|spark\.sql)\b", re.IGNORECASE)
_PROHIBITION = re.compile(r"\bNEVER\b|\b[Dd]o NOT\b")


def test_s4_apply_contracts_runs_no_mutation_in_session():
    """Every line of 1005 that pairs a mutating statement with an execution verb is
    a NEVER / do-NOT line; application is handed to the next step's bundle job."""
    affirmative = [
        line.strip()
        for line in _fork(1005).splitlines()
        if _MUTATION.search(line) and _EXECUTE.search(line) and not _PROHIBITION.search(line)
    ]
    assert affirmative == [], affirmative
    body = _fork(1005)
    assert "SET TAGS" in body, "1005 no longer generates the tag statements; revisit this pin"
    assert "applied in the next step (Validate & Automate) by its bundle-deployed validator job" in body


# --- S5: 1006 file-write tier and bundle mechanics --------------------------------

_OPEN_WRITE = 'Write each file with `executeCode` `open(path, "w").write(...)`'
_BUNDLE_PAGE = "Open the bundle editor BEFORE any `bundle` command"
_DEPLOY = "`databricks bundle deploy --target dev`"


def test_s5_certify_tables_writes_bundle_files_with_execute_code():
    """genie-code-environment §10: API-written files may not reach the CLI's FUSE
    mount, so 1006 (like 901) writes with executeCode and never createAsset/editAsset."""
    body = _fork(1006)
    assert body.count(_OPEN_WRITE) == 1
    api_writes = [
        line.strip()
        for line in body.splitlines()
        if re.search(r"createAsset|editAsset|workspaceUpdateFile", line) and not _PROHIBITION.search(line)
    ]
    assert api_writes == [], api_writes
    assert 'print("ready")' in body
    assert "source_linked_deployment: false" in body
    assert "<REPO_ROOT>/{user_schema_prefix}_skill_validation_dab" in body


def test_s5_certify_tables_deploys_from_the_bundle_page_before_any_run(seeded):
    """Every `bundle run` follows the bundle-editor page and a dev deploy (with
    source_linked_deployment off, a run without a deploy re-runs the last uploaded
    body), and a `databricks.yml not found` STOP is present."""
    body = _served_live("skill_certify_tables")
    runs = [m.start() for m in re.finditer(r"bundle run", body)]
    assert runs, "1006 no longer runs the validator through the bundle; revisit this pin"
    assert _BUNDLE_PAGE in body and body.count(_DEPLOY) == 1
    assert body.index(_BUNDLE_PAGE) < body.index(_DEPLOY) < min(runs)
    assert "databricks.yml not found" in body
    assert "STOP" in body[body.index("databricks.yml not found") - 200 :]
    assert "necessary but NOT sufficient" in body
