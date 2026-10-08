"""ddl-user-trigger-prompt (D-69): an install upgraded from main gets
section_input_prompts.user_trigger_prompt.

DDL 02 declares user_trigger_prompt only inside its CREATE TABLE IF NOT EXISTS,
a no-op on a table that predates the column, and no ALTER added it, so on a
legacy install the seed INSERTs and the Lakebase prompt query (both name the
column) fail. It is the only column added that way: 03_sessions.sql only removes
the number columns on fresh installs, and its workshop_level widen is DDL 16.

U1 DDL 17 is exactly one `ALTER TABLE ${schema}.section_input_prompts ADD
   COLUMN IF NOT EXISTS user_trigger_prompt TEXT` statement.
U2 it does nothing destructive (no DROP / TRUNCATE / DELETE / UPDATE / ALTER
   COLUMN ... TYPE / RENAME / NOT NULL / DEFAULT).
U3 setup-lakebase.sh runs DDL files sorted by filename
   (scripts/setup-lakebase.sh:509-515), DDL before seed in both modes (DDL
   :650-655 / :715-720, seed :668-674 / :734-737), so 17 runs after 02 and
   before any seed file.
U4 DDL 17 adds the column with DDL 02's type.
U5 every column a seed INSERT into section_input_prompts names is in DDL 02's
   CREATE TABLE (a seed column DDL 02 does not create fails here).
U6 every column a CREATE TABLE IF NOT EXISTS declares beyond what that table had
   on main is also added by an `ALTER TABLE ${schema}.<table> ADD COLUMN IF NOT
   EXISTS <column>`, so a column added only to a CREATE TABLE cannot repeat this
   gap. Tables new since main are exempt (created whole); removed columns are
   allowed.

TAMPER (verified, see PR body):
* X1 ADD COLUMN IF NOT EXISTS -> ADD COLUMN -> U1 fails.
* X2 append `NOT NULL DEFAULT ''` -> U2 fails.
* X3 rename 17 to 01a_add_user_trigger_prompt.sql -> U3 fails.
* X4 TEXT -> VARCHAR(20) -> U4 fails.
* X5 a made-up column in one seed INSERT column list (on a copy of the seed
  directory) -> U5 fails.
* X6 delete DDL 17 (on a copy of ddl/) -> U6 fails, naming
  section_input_prompts.user_trigger_prompt.
* X7 a made-up column in DDL 02's CREATE TABLE (on a copy of ddl/) -> U6 fails.
"""

import pathlib
import re

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
DDL_DIR = REPO_ROOT / "db" / "lakebase" / "ddl"
DML_SEED_DIR = REPO_ROOT / "db" / "lakebase" / "dml_seed"
DDL_02 = DDL_DIR / "02_section_input_prompts.sql"
DDL_17_NAME = "17_add_user_trigger_prompt.sql"
SETUP_SCRIPT = REPO_ROOT / "scripts" / "setup-lakebase.sh"

_ADD_COLUMN = re.compile(
    r"ALTER\s+TABLE\s+\$\{schema\}\.section_input_prompts\s+"
    r"ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+user_trigger_prompt\s+(\w+(?:\s*\(\s*\d+\s*\))?)",
    re.IGNORECASE,
)
_CREATE_BODY = re.compile(
    r"CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+\$\{schema\}\.section_input_prompts\s*\((.*?)\n\);",
    re.IGNORECASE | re.DOTALL,
)
_ANY_CREATE = re.compile(
    r"CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+\$\{schema\}\.(\w+)\s*\((.*?)\n\s*\);",
    re.IGNORECASE | re.DOTALL,
)
_ANY_ADD_COLUMN = re.compile(
    r"ALTER\s+TABLE\s+\$\{schema\}\.(\w+)\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+(\w+)",
    re.IGNORECASE,
)
_NOT_A_COLUMN = {"CONSTRAINT", "PRIMARY", "UNIQUE", "FOREIGN", "CHECK", "EXCLUDE"}

# Columns each table's CREATE TABLE IF NOT EXISTS declared on origin/main
# (9f9cf6def6ce841e34f27c38c0019da3ae52091d), parsed from
# `git show 9f9cf6d:db/lakebase/ddl/<file>`. An install upgraded from main has
# at least these; anything else needs an ALTER. Frozen: do not edit.
MAIN_COLUMNS = {
    "usecase_descriptions": (
        "config_id", "industry", "industry_label", "use_case", "use_case_label",
        "prompt_template", "version", "is_active", "inserted_at", "updated_at",
        "created_by", "path_type", "category", "category_order", "display_order",
        "is_certified",
    ),
    "section_input_prompts": (
        "input_id", "section_tag", "section_title", "section_description", "input_template",
        "system_prompt", "order_number", "how_to_apply", "expected_output",
        "how_to_apply_images", "expected_output_images", "bypass_llm", "coding_assistant",
        "step_enabled", "version", "is_active", "inserted_at", "updated_at", "created_by",
    ),
    "sessions": (
        "session_id", "created_by", "session_name", "session_description", "industry",
        "industry_label", "use_case", "use_case_label", "feedback_rating",
        "feedback_comment", "feedback_request_followup", "chapter_feedback",
        "step_1_prompt", "step_prompts", "prerequisites_completed", "current_step",
        "workshop_level", "completed_steps", "skipped_steps", "session_parameters",
        "created_at", "updated_at",
    ),
    "workshop_parameters": (
        "param_id", "param_key", "param_label", "param_value", "param_description",
        "param_type", "display_order", "is_required", "is_active", "allow_session_override",
        "inserted_at", "updated_at", "created_by",
    ),
    "saved_usecase_descriptions": (
        "id", "created_by", "display_name", "updated_by", "industry", "use_case_name",
        "description", "version", "is_active", "created_at", "updated_at",
    ),
    "step_visibility_overrides": (
        "section_key", "coding_assistant", "enabled", "updated_at", "updated_by",
    ),
    "hackathons": (
        "hackathon_id", "title", "description", "short_description", "status",
        "hackathon_type", "location", "venue", "registration_start", "registration_end",
        "start_date", "end_date", "submission_deadline", "max_participants",
        "max_team_size", "min_team_size", "total_prize_pool", "prize_description", "rules",
        "topics", "judging_criteria", "has_team_matching", "has_chat", "has_voting",
        "created_by", "created_at", "updated_at",
    ),
    "hackathon_judges": (
        "hackathon_id", "judge_email", "status", "assigned_by", "created_at",
    ),
    "hackathon_teams": (
        "team_id", "hackathon_id", "name", "description", "leader_email", "max_members",
        "is_public", "created_at",
    ),
    "hackathon_team_members": (
        "team_id", "member_email", "role", "joined_at",
    ),
    "hackathon_submissions": (
        "submission_id", "hackathon_id", "team_id", "submitted_by", "title", "description",
        "repo_url", "demo_url", "video_url", "slides_url", "is_submitted", "created_at",
        "updated_at",
    ),
    "hackathon_scores": (
        "score_id", "submission_id", "judge_email", "criteria", "overall", "feedback",
        "ai_assisted", "created_at", "updated_at",
    ),
    "hackathon_votes": (
        "submission_id", "voter_email", "created_at",
    ),
}
_SEED_INSERT = re.compile(
    r"^INSERT\s+INTO\s+\$\{catalog\}\.\$\{schema\}\.section_input_prompts\s*\(([^)]*)\)",
    re.IGNORECASE | re.MULTILINE,
)


def _sql(path: pathlib.Path) -> str:
    """The file's SQL with `--` comments stripped (headers may name keywords)."""

    return "\n".join(line.split("--", 1)[0] for line in path.read_text().splitlines())


def _ddl_17() -> pathlib.Path:
    matches = sorted(DDL_DIR.glob("*_add_user_trigger_prompt.sql"))
    assert len(matches) == 1, matches
    return matches[0]


def _statements(path: pathlib.Path) -> list:
    return [s.strip() for s in _sql(path).split(";") if s.strip()]


def _ddl_02_columns() -> dict:
    """DDL 02's CREATE TABLE columns -> their type (constraints skipped)."""

    bodies = _CREATE_BODY.findall(_sql(DDL_02))
    assert len(bodies) == 1, bodies
    columns = {}
    for line in bodies[0].splitlines():
        line = line.strip().rstrip(",")
        if not line or line.upper().startswith("CONSTRAINT"):
            continue
        m = re.match(r"(\w+)\s+(\w+(?:\s*\(\s*\d+\s*\))?)", line)
        assert m, line
        columns[m.group(1).lower()] = re.sub(r"\s+", "", m.group(2)).upper()
    return columns


def _seed_insert_columns(seed_dir: pathlib.Path) -> dict:
    """{seed file name: every column its section_input_prompts INSERTs name}."""

    found = {}
    for path in sorted(seed_dir.glob("*.sql")):
        for col_list in _SEED_INSERT.findall(path.read_text()):
            cols = {c.strip().lower() for c in col_list.split(",")}
            assert all(re.fullmatch(r"\w+", c) for c in cols), (path.name, cols)
            found.setdefault(path.name, set()).update(cols)
    return found


def _create_table_columns(ddl_dir: pathlib.Path) -> dict:
    """{table: its CREATE TABLE IF NOT EXISTS column names} across ddl_dir."""

    tables = {}
    for path in sorted(ddl_dir.glob("*.sql")):
        for table, body in _ANY_CREATE.findall(_sql(path)):
            assert table not in tables, (path.name, table)
            # Split on top-level commas only (types and defaults have their own).
            depth, quoted, parts, part = 0, False, [], ""
            for ch in body:
                quoted ^= ch == "'"
                if not quoted:
                    depth += {"(": 1, ")": -1}.get(ch, 0)
                if ch == "," and depth == 0 and not quoted:
                    parts.append(part)
                    part = ""
                else:
                    part += ch
            parts.append(part)
            words = [p.split()[0] for p in parts if p.strip()]
            tables[table] = {w.lower() for w in words if w.upper() not in _NOT_A_COLUMN}
    return tables


def _unaltered_new_columns(ddl_dir: pathlib.Path) -> list:
    """`table.column` a CREATE TABLE adds beyond main that no ALTER adds."""

    altered = set()
    for path in sorted(ddl_dir.glob("*.sql")):
        altered.update((t.lower(), c.lower()) for t, c in _ANY_ADD_COLUMN.findall(_sql(path)))
    gaps = []
    for table, columns in _create_table_columns(ddl_dir).items():
        if table not in MAIN_COLUMNS:
            continue
        for column in sorted(columns - set(MAIN_COLUMNS[table])):
            if (table, column) not in altered:
                gaps.append(f"{table}.{column}")
    return gaps


# --- U1 exactly one additive, idempotent statement ---------------------------


def test_u1_ddl_17_is_one_add_column_if_not_exists():
    assert (DDL_DIR / DDL_17_NAME).exists(), DDL_17_NAME
    statements = _statements(_ddl_17())
    assert len(statements) == 1, statements
    assert _ADD_COLUMN.fullmatch(statements[0]), statements[0]


# --- U2 non-destructive -------------------------------------------------------


def test_u2_ddl_17_is_non_destructive():
    sql = _sql(_ddl_17())
    for pattern in (
        r"\bDROP\b",
        r"\bTRUNCATE\b",
        r"\bDELETE\b",
        r"\bUPDATE\b",
        r"\bINSERT\b",
        r"\bALTER\s+COLUMN\b",
        r"\bTYPE\b",
        r"\bRENAME\b",
        r"\bNOT\s+NULL\b",
        r"\bDEFAULT\b",
    ):
        assert not re.search(pattern, sql, re.IGNORECASE), pattern


# --- U3 runs after DDL 02 and before any seed ---------------------------------


def test_u3_ddl_17_runs_after_02_and_before_the_seed():
    script = SETUP_SCRIPT.read_text()
    # The sort rule: get_ddl_files() returns the DDL glob sorted by filename.
    assert "files = sorted(glob.glob(os.path.join(DDL_DIR, '*.sql')))" in script
    order = sorted(p.name for p in DDL_DIR.glob("*.sql"))
    name = _ddl_17().name
    assert order.index(DDL_02.name) < order.index(name), order

    # Both modes run every DDL file before the first seed step.
    ddl_runs = [m.start() for m in re.finditer(r"ddl_files = get_ddl_files\(\)", script)]
    recreate_seed = script.index("dml_files = get_dml_seed_files()")
    create_seed = script.index("seed_new_rows.run_create_mode_seed(")
    assert len(ddl_runs) == 2, ddl_runs
    assert ddl_runs[0] < recreate_seed < ddl_runs[1] < create_seed

    # Seed files live in their own directory, not in the DDL sort.
    assert DML_SEED_DIR != DDL_DIR and not set(order) & {p.name for p in DML_SEED_DIR.glob("*")}


# --- U4 same column definition as DDL 02 --------------------------------------


def test_u4_ddl_17_type_matches_ddl_02():
    added = _ADD_COLUMN.findall(_sql(_ddl_17()))
    assert len(added) == 1, added
    assert re.sub(r"\s+", "", added[0]).upper() == _ddl_02_columns()["user_trigger_prompt"]


# --- U5 every seed column is in DDL 02 ----------------------------------------


def test_u5_every_seed_insert_column_is_in_ddl_02():
    columns = set(_ddl_02_columns())
    seeded = _seed_insert_columns(DML_SEED_DIR)
    assert "02_seed_section_input_prompts.sql" in seeded, seeded
    assert "user_trigger_prompt" in seeded["02_seed_section_input_prompts.sql"]
    missing = {name: sorted(cols - columns) for name, cols in seeded.items() if cols - columns}
    assert not missing, missing


# --- U6 every column new since main has an ALTER ------------------------------


def test_u6_every_column_new_since_main_is_added_by_an_alter():
    tables = _create_table_columns(DDL_DIR)
    assert set(MAIN_COLUMNS) <= set(tables), set(MAIN_COLUMNS) - set(tables)
    assert "user_trigger_prompt" in tables["section_input_prompts"]
    gaps = _unaltered_new_columns(DDL_DIR)
    assert not gaps, f"added only inside CREATE TABLE IF NOT EXISTS, no ALTER: {gaps}"
