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
   CREATE TABLE, so a future seed column cannot repeat this gap silently.

TAMPER (verified, see PR body):
* X1 ADD COLUMN IF NOT EXISTS -> ADD COLUMN -> U1 fails.
* X2 append `NOT NULL DEFAULT ''` -> U2 fails.
* X3 rename 17 to 01a_add_user_trigger_prompt.sql -> U3 fails.
* X4 TEXT -> VARCHAR(20) -> U4 fails.
* X5 a made-up column in one seed INSERT column list (on a copy of the seed
  directory) -> U5 fails.
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
