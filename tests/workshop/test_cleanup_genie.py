"""D-58 — workspace_cleanup's genie-code fork 1033 is participant-scoped and stops
for an explicit `confirm cleanup` before any delete.

Same real-seed harness as the family tests (test_app_family_genie_forks.py): every
active ``section_input_prompts`` INSERT is parsed and served in place of the
Lakebase cache. workspace_cleanup is on every track's outline, so each family test
lists it in FORK_ID; this file pins what the fork itself must say.

C1 no CLI profile mechanics: 0 `--profile`, 0 `export DATABRICKS_CONFIG_PROFILE`,
   0 `~/.databrickscfg`, 0 `| python3` pipe, 0 @-mention or `@` token; the only
   bare-path hit is the fixed `<STATE_FILE>` definition.
C2 the `confirm cleanup` STOP appears before the first delete call.
C3 the MINE rule (participant prefix AND creator/owner == the current user where
   exposed) is stated once, before the first delete, and every delete call
   iterates the MINE rows.
C4 no keyword-only selection rule survives: none of 140's keyword lists, and a
   name without the prefix is "not mine: skipped".
C5 every DROP CATALOG is gated by the catalog rule (name contains `lakebase`; not the
   bundle's catalog.default / source_catalog.default), stated before the STOP, so
   the fork drops at most 140's single Lakebase UC catalog.
C6 run_sql fails closed like the F0 run_ddl: it raises unless the statement SUCCEEDED.
"""

import re

import pytest

from src.backend.workshop import manifest

from .test_app_family_genie_forks import SEED_ROWS, seeded, store  # noqa: F401  (seeded/store are fixtures)
from .test_genie_family_genie import MARKERS, STATE_FILE_DEFINITION, _marker_counts
from .test_lakehouse_family_genie import DEFAULT_ID, _served_live

TAG, FORK, DEFAULT = "workspace_cleanup", 1033, 140

# A call that removes something: an SDK delete / trash / stop, a raw REST DELETE,
# a DROP statement, or a CLI delete verb.
DELETE_CALL = re.compile(
    r"\.(?:delete|trash|trash_space|stop)\(|\bapi_client\.do\(\s*\"DELETE\"|"
    r"\bDROP\s+(?:SCHEMA|CATALOG)\b|\bdelete-project\b|"
    r"\bdatabricks\s+(?:jobs|pipelines|serving-endpoints|apps)\s+delete\b|\bapi\s+delete\b"
)
CONFIRM_STOP = "STOP and ask the operator to reply exactly `confirm cleanup`"
MINE_RULE = "**The MINE rule**"
PREFIX_LINE = (
    'PREFIXES = [p for p in ("{db_schema}", "{user_schema_prefix}", APP_NAME, AGENT_APP_NAME) '
    'if p and "<" not in p and "{" not in p]'
)
CREATOR_CHECK = "if creator is not None and creator.lower() != w_me.lower():"
NO_PREFIX = 'return False, "not mine: skipped (no participant prefix)"'
# Default 140's name-only selection: its keyword lists and keyword phrases.
KEYWORD_SELECTION = re.compile(
    r"\bkeywords?\s*=|\bany\(kw\b|''?loyalty''?|Loyalty Rewards|Dashboard Deployment|''?dlt''?|''?merge''?",
    re.IGNORECASE,
)


def _body():
    return SEED_ROWS[FORK]["input_template"]


def _first_delete(body):
    match = DELETE_CALL.search(body)
    assert match, "the fork has no delete call"
    return match.start()


# --- the row ----------------------------------------------------------------------


def test_1033_is_the_genie_code_fork_of_140():
    fork, default = SEED_ROWS[FORK], SEED_ROWS[DEFAULT]
    assert DEFAULT_ID[TAG] == DEFAULT and default["section_tag"] == TAG and "coding_assistant" not in default
    assert (fork["section_tag"], fork["coding_assistant"]) == (TAG, "genie-code")
    assert (fork["version"], fork["is_active"], fork["bypass_llm"]) == (1, True, default["bypass_llm"])
    assert "how_to_apply" not in fork and "section_title" not in fork
    order = list(SEED_ROWS)
    assert order.index(FORK) == order.index(DEFAULT) + 1


# --- C1: no profile / local config / pipes -----------------------------------------


@pytest.mark.parametrize(
    "marker",
    ["--profile", "export DATABRICKS_CONFIG_PROFILE", "~/.databrickscfg", "| python3"],
)
def test_c1_fork_has_no_local_cli_mechanics(marker):
    assert marker in SEED_ROWS[DEFAULT]["input_template"], f"default 140 no longer has {marker!r}"
    assert marker not in _body()


def test_c1_only_bare_path_is_the_state_file_definition():
    """No @-mention or other `@` token, no npm/localhost/auth login/`.sh`, and the one
    bare-path hit is the fixed `<STATE_FILE>` definition's prohibition."""
    body = _body()
    assert _marker_counts(body) == {"bare path": 1}
    assert body.count(STATE_FILE_DEFINITION) == 1
    assert MARKERS["bare path"].findall(body.replace(STATE_FILE_DEFINITION, "")) == []


# --- C2: the confirm STOP precedes every delete -------------------------------------


def test_c2_confirm_stop_precedes_the_first_delete():
    body = _body()
    assert body.count(CONFIRM_STOP) == 1
    assert body.index(CONFIRM_STOP) < _first_delete(body)


# --- C3: every delete is gated by the MINE rule -------------------------------------


def test_c3_mine_rule_is_stated_once_before_any_delete():
    body = _body()
    assert body.count(MINE_RULE) == 1
    assert body.count(PREFIX_LINE) == 1 and body.count(CREATOR_CHECK) == 1
    assert max(body.index(MINE_RULE), body.index(PREFIX_LINE), body.index(CREATOR_CHECK)) < _first_delete(body)
    rule = body[body.index(MINE_RULE):].split("\n\n", 1)[0]
    for prefix in ("`{db_schema}`", "`{user_schema_prefix}`", "`APP_NAME`", "`AGENT_APP_NAME`"):
        assert prefix in rule, prefix
    assert "AND, where the object exposes a creator or owner, that creator/owner equals the current user" in rule


def test_c3_every_delete_iterates_the_mine_rows():
    lines = [line for line in _body().splitlines() if DELETE_CALL.search(line)]
    assert lines
    loose = [line for line in lines if not re.match(r"\s*for \w+ in mine\[\"[^\"]+\"\]:", line) and not line.startswith("    w.apps.")]
    assert loose == [], loose
    assert 'for a in mine["App"]:' in _body()


# --- C4: no keyword-only selection ---------------------------------------------------


def test_c4_no_keyword_selection_survives():
    assert KEYWORD_SELECTION.search(SEED_ROWS[DEFAULT]["input_template"]), "default 140 lost its keyword lists"
    assert KEYWORD_SELECTION.findall(_body()) == []
    assert _body().count(NO_PREFIX) == 1
    assert "is listed as `not mine: skipped` and is never deleted" in _body()


# --- C5: DROP CATALOG only for 140's single Lakebase UC catalog ---------------------

CATALOG_RULE = "**The catalog rule**"
CATALOG_CHECKS = [
    "def is_my_lakebase_catalog(name, owner):",
    'excluded = {c.lower() for c in LAKEHOUSE_CATALOGS | {"{lakehouse_default_catalog}"} if c and "<" not in c and "{" not in c}',
    'if "lakebase" not in n:',
    "if n in excluded:",
    "return is_mine(name, owner)",
]
CATALOG_EXCLUDES = ("`lakebase`", "`variables.catalog.default`", "`variables.source_catalog.default`")


def test_c5_drop_catalog_is_gated_by_the_catalog_rule():
    body = _body()
    stop = body.index(CONFIRM_STOP)
    assert body.count(CATALOG_RULE) == 1 and body.index(MINE_RULE) < body.index(CATALOG_RULE) < stop
    rule = body[body.index(CATALOG_RULE):].split("\n\n", 1)[0]
    assert all(term in rule for term in CATALOG_EXCLUDES), rule
    for check in CATALOG_CHECKS:
        assert body.count(check) == 1 and body.index(check) < stop, check
    fn = body[body.index(CATALOG_CHECKS[0]):body.index(CATALOG_CHECKS[-1])]
    assert fn.index('if "lakebase" not in n:') < fn.index("if n in excluded:")
    assert body.count("Add the two catalog names to `LAKEHOUSE_CATALOGS` before classifying any catalog.") == 1
    assert "classified ONLY by `is_my_lakebase_catalog(name, owner)` (the catalog rule)" in body
    drops = [line for line in body.splitlines() if re.search(r"\bDROP\s+CATALOG\b", line)]
    assert drops == ['for c in mine["Lakebase UC catalog"]: run_sql("DROP CATALOG IF EXISTS `" + c.name + "` CASCADE")']


# --- C6: run_sql fails closed --------------------------------------------------------

_RUN_SQL_SHAPE = [
    "def run_sql(statement):",
    "w.statement_execution.execute_statement(",
    'statement=statement, wait_timeout="30s"',
    "deadline = time.monotonic() + SQL_TIMEOUT_S",
    "while resp.status.state in (StatementState.PENDING, StatementState.RUNNING):",
    "if time.monotonic() > deadline:",
    "w.statement_execution.cancel_execution(resp.statement_id)",
    "raise TimeoutError(",
    "resp = w.statement_execution.get_statement(resp.statement_id)",
    "if resp.status.state != StatementState.SUCCEEDED:  # FAILED / CANCELED / CLOSED",
    "raise RuntimeError(",
]


def test_c6_run_sql_raises_unless_succeeded():
    body = _body()
    fn = body[body.index(_RUN_SQL_SHAPE[0]):]
    fn = fn[: fn.index("\n\n")]
    pos = [fn.find(part) for part in _RUN_SQL_SHAPE]
    assert -1 not in pos, [part for part, at in zip(_RUN_SQL_SHAPE, pos) if at == -1]
    assert pos == sorted(pos)
    assert "StatementState.FAILED" not in fn


# --- served on every track ----------------------------------------------------------


def _tracks():
    m = manifest.load_manifest()
    return sorted(t for t in m.tracks if TAG in [s.sectionTag for s in m.track_steps(t)])


@pytest.mark.parametrize("track", _tracks())
def test_every_track_serves_1033(seeded, track):
    served = _served_live(track, TAG)
    assert CONFIRM_STOP in served and PREFIX_LINE in served
    assert "--profile" not in served and "export DATABRICKS_CONFIG_PROFILE" not in served
