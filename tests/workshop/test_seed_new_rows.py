"""D-37 — new seed rows reach an existing install; admin edits and deletions stick.

Pins scripts/seed_new_rows.py and its wiring in scripts/setup-lakebase.sh:

  T-split      split_statements is a byte-for-byte mirror of the runner's
               parse_sql_statements (source text + outputs over 01/02 and
               adversarial strings). The runner's function is sliced out of the
               heredoc text and exec()'d alone; the script never runs.
  T-no-dollar  01/02 have no dollar quoting outside string literals.
  T-baseline   scripts/seed_baseline.json == every 01/02 PK at ca9ff61.
  T-populated  S4: post-baseline rows only; ON CONFLICT DO NOTHING + ledger;
               ledgered-then-deleted and admin-deleted baseline rows stay
               deleted; an admin-held PK warns and is not ledgered.
  T-fresh      S5: bulk seed ledgers post-baseline PKs; a later delete sticks.
  T-recreate   the ledger survives --recreate; stale ledger rows are harmless.
  T-seq        never-lower sequence raise (NULL / is_called / not is_called).
  T-gating     S6: populated 01/02 + empty step_visibility_overrides -> no 01/02.
  T-noupdate   the helper never emits UPDATE/DROP/TRUNCATE/ALTER, and its only
               DELETE clears its own seed_bulk_pending marker row (MARKER_CLEAR).
  T-unparseable an INSERT whose PK can't be parsed fails before any write.
  C1-C6 (D-38) F1 one-statement insert+ledger (CTE); F2 seed_bulk_pending
               marker lifecycle, crash recovery, partial bulk, --recreate.
  V1-V4 (D-40) an S4 insert hitting uq_section_assistant_version_active WARNs,
               is not ledgered and the run continues; every other error
               (another constraint or SQLSTATE) re-raises unchanged.

Offline only: a fake in-memory cursor stands in for Lakebase; nothing opens a
connection, runs setup-lakebase.sh, lakebase_manager.py or psql.
"""

import ast
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = REPO_ROOT / "scripts"
SETUP_SH = SCRIPTS / "setup-lakebase.sh"
DML_SEED = REPO_ROOT / "db" / "lakebase" / "dml_seed"
DDL_14 = REPO_ROOT / "db" / "lakebase" / "ddl" / "14_seed_rows_applied.sql"
DDL_15 = REPO_ROOT / "db" / "lakebase" / "ddl" / "15_seed_bulk_pending.sql"
BASELINE_COMMIT = "ca9ff61"

if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

import seed_new_rows as snr  # noqa: E402

SCHEMA = "forge_test_schema"
UC, SIP = "usecase_descriptions", "section_input_prompts"
F01, F02 = "01_seed_usecase_descriptions.sql", "02_seed_section_input_prompts.sql"
F03, F08, F09 = "03_seed_workshop_parameters.sql", "08_seed_step_visibility_overrides.sql", "09_seed_path_visibility_overrides.sql"
PK_COL = {UC: "config_id", SIP: "input_id"}
DESTRUCTIVE = re.compile(r"^\s*(UPDATE|DELETE|DROP|TRUNCATE|ALTER)\b", re.IGNORECASE)
# D-38: the one DELETE the helper may issue clears its own bulk-pending marker.
MARKER_CLEAR = f"DELETE FROM {SCHEMA}.seed_bulk_pending WHERE table_name = %s"


# ---------------------------------------------------------------------------
# Fixtures: the runner's splitter, a synthetic seed dir, a fake database
# ---------------------------------------------------------------------------


def _shell_splitter_source():
    text = SETUP_SH.read_text()
    start = text.index("def parse_sql_statements(")
    end = text.index("\n\n\ndef execute_sql_file(", start)
    return text[start:end]


def _shell_splitter():
    ns = {}
    exec(compile(_shell_splitter_source(), "<setup-lakebase.sh:parse_sql_statements>", "exec"), ns)
    return ns["parse_sql_statements"]


NEW_UC_ROW = """
INSERT INTO ${catalog}.${schema}.usecase_descriptions
(config_id, industry, industry_label, use_case, use_case_label, prompt_template, version, is_active, inserted_at, updated_at, created_by)
VALUES
(5001, 'forge', 'Forge', 'new_case', 'New Case', 'Body with ''quotes''; and -- not a comment (x;y)', 1, TRUE, current_timestamp(), current_timestamp(), 'system');
"""

NEW_SIP_ROWS = """
INSERT INTO ${catalog}.${schema}.section_input_prompts
(input_id, section_tag, coding_assistant, input_template, system_prompt, version, is_active, inserted_at, updated_at, created_by)
VALUES
(1001, 'prd_generation', 'genie-code', 'it''s; a template', 'sys (a;b) $$ not a quote $$', 1, TRUE, current_timestamp(), current_timestamp(), 'system');

INSERT INTO ${catalog}.${schema}.section_input_prompts
(input_id, section_tag, coding_assistant, input_template, system_prompt, version, is_active, inserted_at, updated_at, created_by)
VALUES
(1002, 'ui_design', 'genie-code', 'tmpl', 'sys', 1, TRUE, current_timestamp(), current_timestamp(), 'system');
"""

NEW_PKS = {UC: {5001}, SIP: {1001, 1002}}


@pytest.fixture
def seed_dir(tmp_path):
    """Real 01/02/08/09 plus post-baseline rows, and a generated-03 stand-in."""
    d = tmp_path / "dml_seed"
    d.mkdir()
    (d / F01).write_text((DML_SEED / F01).read_text() + NEW_UC_ROW)
    (d / F02).write_text((DML_SEED / F02).read_text() + NEW_SIP_ROWS)
    shutil.copy(DML_SEED / F08, d / F08)
    shutil.copy(DML_SEED / F09, d / F09)
    (d / F03).write_text("DELETE FROM ${schema}.workshop_parameters WHERE param_key = 'x';\n")
    return d


def _file_pks(path):
    """Independent of the helper: every (table, first-column PK) INSERT in a seed file."""
    out = {UC: set(), SIP: set()}
    for m in re.finditer(r"INSERT INTO \S+?\.(\w+)\s*\(\s*(\w+)[^)]*\)\s*VALUES\s*\(\s*(\d+)", Path(path).read_text()):
        table, col, pk = m.group(1), m.group(2), int(m.group(3))
        if table in out and col == PK_COL[table]:
            out[table].add(pk)
    return out


BASELINE = snr.load_baseline()


class Crash(Exception):
    """An injected crash / kill / connection drop."""


class FakeDB:
    def __init__(self, tables=None, ledger=(), seqs=None, svo_count=0, markers=()):
        self.tables = {UC: set(), SIP: set(), **(tables or {})}
        self.ledger = set(ledger)
        self.markers = set(markers)  # seed_bulk_pending table_name rows
        self.events = []  # ("file", name) / ("mark"|"clear", table) / ("ledger", table, pk) / ("setval", seq)
        self.crash_after = None  # predicate(sql): raise Crash once that statement has run
        self.crash_after_file = None  # seed file name: raise Crash once its rows are written
        self.fail = None  # predicate(sql) -> exception raised INSTEAD of running that statement
        # sequence relation name -> [last_value, is_called, start_value]
        self.seqs = seqs or {f"{t}_{c}_seq": [1, False, 1] for t, c in PK_COL.items()}
        self.svo_count = svo_count
        self.executed = []
        self.files_run = []
        self.setvals = []

    def cursor(self):
        return FakeCursor(self)

    def run_sql_file(self, path):
        """Stands in for the runner's execute_sql_file: duplicate keys are skipped."""
        name = os.path.basename(path)
        self.files_run.append(name)
        self.events.append(("file", name))
        if name in (F01, F02):
            for table, pks in _file_pks(path).items():
                self.tables[table] |= pks
        if name == self.crash_after_file:
            raise Crash(f"after {name}")

    def add_ledger(self, table, pk):
        if (table, pk) in self.ledger:
            return 0
        self.ledger.add((table, pk))
        self.events.append(("ledger", table, pk))
        return 1


class FakeCursor:
    def __init__(self, db):
        self.db = db
        self.rowcount = -1
        self._rows = []

    def fetchone(self):
        return self._rows[0]

    def fetchall(self):
        return list(self._rows)

    def execute(self, sql, params=None):
        if self.db.fail and (exc := self.db.fail(sql)):
            # Autocommit: the failed statement writes nothing and later ones run.
            self.db.executed.append(sql)
            raise exc
        self._execute(sql, params)
        if self.db.crash_after and self.db.crash_after(sql):
            raise Crash(sql[:80])

    def _execute(self, sql, params=None):
        db = self.db
        db.executed.append(sql)
        s = " ".join(sql.split())
        self.rowcount, self._rows = -1, []
        if m := re.fullmatch(rf"SELECT COUNT\(\*\) FROM {SCHEMA}\.(\w+)", s):
            table = m.group(1)
            self._rows = [(db.svo_count if table == "step_visibility_overrides" else len(db.tables[table]),)]
        elif re.fullmatch(rf"SELECT pk FROM {SCHEMA}\.seed_rows_applied WHERE table_name = %s", s):
            self._rows = [(pk,) for t, pk in sorted(db.ledger) if t == params[0]]
        elif re.fullmatch(
            rf"INSERT INTO {SCHEMA}\.seed_rows_applied \(table_name, pk\) VALUES \(%s, %s\) ON CONFLICT DO NOTHING", s
        ):
            db.add_ledger(*params)
        elif re.fullmatch(rf"SELECT table_name FROM {SCHEMA}\.seed_bulk_pending", s):
            self._rows = [(t,) for t in sorted(db.markers)]
        elif re.fullmatch(
            rf"INSERT INTO {SCHEMA}\.seed_bulk_pending \(table_name\) VALUES \(%s\) ON CONFLICT DO NOTHING", s
        ):
            if params[0] not in db.markers:
                db.markers.add(params[0])
                db.events.append(("mark", params[0]))
        elif s == MARKER_CLEAR:
            db.markers.discard(params[0])
            db.events.append(("clear", params[0]))
        elif s.startswith("WITH ins AS ("):
            self._cte(s, params)
        elif m := re.fullmatch(rf"SELECT (\w+) FROM {SCHEMA}\.(\w+) WHERE (\w+) = ANY\(%s\)", s):
            assert m.group(1) == m.group(3) == PK_COL[m.group(2)]
            self._rows = [(pk,) for pk in sorted(db.tables[m.group(2)] & set(params[0]))]
        elif m := re.fullmatch(rf"SELECT MAX\((\w+)\) FROM {SCHEMA}\.(\w+)", s):
            self._rows = [(max(db.tables[m.group(2)], default=None),)]
        elif m := re.fullmatch(rf"SELECT last_value, is_called FROM {SCHEMA}\.(\w+)", s):
            last, called, _ = db.seqs[m.group(1)]
            self._rows = [(last, called)]
        elif re.fullmatch(r"SELECT start_value FROM pg_sequences WHERE schemaname = %s AND sequencename = %s", s):
            assert params[0] == SCHEMA
            self._rows = [(db.seqs[params[1]][2],)]
        elif re.fullmatch(r"SELECT setval\(%s, %s, false\)", s):
            seq, target = params
            db.seqs[seq.split(".", 1)[1]][:2] = [target, False]
            db.setvals.append((seq, target))
            db.events.append(("setval", seq))
        elif m := re.match(rf"INSERT INTO {SCHEMA}\.(\w+) \((\w+),", s):
            table, col = m.group(1), m.group(2)
            assert col == PK_COL[table], s[:120]
            assert s.endswith(f"ON CONFLICT ({col}) DO NOTHING;"), s[-120:]
            pk = int(re.search(r"VALUES \( ?(\d+)", s).group(1))
            if pk in db.tables[table]:
                self.rowcount = 0
            else:
                db.tables[table].add(pk)
                self.rowcount = 1
        else:
            raise AssertionError(f"unexpected SQL: {s[:160]}")

    def _cte(self, s, params):
        """F1's data-modifying CTE: the table row iff its PK is free; the ledger row iff inserted."""
        m = re.fullmatch(
            rf"WITH ins AS \( (INSERT INTO {SCHEMA}\.(\w+) \((\w+),.*) ON CONFLICT \((\w+)\) DO NOTHING "
            rf"RETURNING (\w+) \) INSERT INTO {SCHEMA}\.seed_rows_applied \(table_name, pk\) "
            rf"SELECT %s, (\w+) FROM ins ON CONFLICT DO NOTHING",
            s,
        )
        assert m, s[:200]
        inner, table, col = m.group(1), m.group(2), m.group(3)
        assert col == m.group(4) == m.group(5) == m.group(6) == PK_COL[table], s[:200]
        # psycopg pyformat: every '%' is '%%' or the single %s placeholder.
        assert re.findall(r"%.", s.replace("%%", "")) == ["%s"] and params == (table,), (s[:200], params)
        assert not inner.rstrip().endswith(";"), inner[-40:]
        pk = int(re.search(r"VALUES \( ?(\d+)", inner).group(1))
        if pk in self.db.tables[table]:
            self.rowcount = 0
        else:
            self.db.tables[table].add(pk)
            self.rowcount = self.db.add_ledger(params[0], pk)


def _populated(**kw):
    # An install whose sequences were reset to max+1 by an earlier seed and then used.
    kw.setdefault(
        "seqs",
        {f"{t}_{c}_seq": [max(BASELINE[t]), True, 1] for t, c in PK_COL.items()},
    )
    return FakeDB(tables={UC: set(BASELINE[UC]), SIP: set(BASELINE[SIP])}, svo_count=10, **kw)


def _run_create(db, seed_dir):
    log = []
    snr.run_create_mode_seed(db.cursor(), SCHEMA, str(seed_dir), db.run_sql_file, log=log.append)
    return log


def _seed_inserts(db, table):
    return [s for s in db.executed if re.match(rf"\s*(WITH ins AS \(\s*)?INSERT INTO {SCHEMA}\.{table}\b", s)]


# ---------------------------------------------------------------------------
# T-split / T-no-dollar
# ---------------------------------------------------------------------------


def test_split_source_is_byte_identical_to_runner():
    ours = Path(snr.__file__).read_text()
    start = ours.index("def split_statements(")
    end = ours.index("\n\n\ndef ", start)
    assert ours[start:end] == _shell_splitter_source().replace(
        "def parse_sql_statements(", "def split_statements(", 1
    )


@pytest.mark.parametrize("seed_file", [F01, F02])
@pytest.mark.parametrize("transformed", [False, True])
def test_split_parity_on_seed_files(seed_file, transformed):
    content = (DML_SEED / seed_file).read_text()
    if transformed:
        content = snr.transform_sql_for_postgres(content, SCHEMA)
    ours, theirs = snr.split_statements(content), _shell_splitter()(content)
    assert ours == theirs
    assert len(ours) == {F01: 48 + 3, F02: 137}[seed_file]


ADVERSARIAL = [
    "INSERT INTO t VALUES ('it''s; -- not a comment');\nSELECT 1; -- trailing\n",
    "-- leading comment\nINSERT INTO t (a) VALUES ((1;2)), ('x');\nUPDATE t SET a = 'b;''c';",
    "INSERT INTO t VALUES ('unterminated; no semicolon at end')",
    "CREATE TABLE x (a int)",
    "SELECT 'a'';''b'; SELECT ')' ; SELECT (;",
    "SELECT $$a;b$$; SELECT 2;",
    "DO $tag$ BEGIN PERFORM 1; END $tag$;",
    "SELECT 1;;\n\n  ;SELECT 'x--y';",
    "",
]


@pytest.mark.parametrize("sql", ADVERSARIAL)
def test_split_parity_adversarial(sql):
    assert snr.split_statements(sql) == _shell_splitter()(sql)


def test_split_has_no_dollar_quote_handling():
    # The runner splits inside $$ ... $$; so must the mirror.
    assert snr.split_statements("SELECT $$a;b$$;") == ["SELECT $$a;", "b$$;"]


def _code_outside_strings(sql):
    out, i, in_string = [], 0, False
    while i < len(sql):
        ch = sql[i]
        if in_string:
            if ch == "'" and sql[i + 1 : i + 2] == "'":
                i += 2
                continue
            in_string = ch != "'"
        elif ch == "'":
            in_string = True
        elif sql.startswith("--", i):
            i = sql.find("\n", i)
            i = len(sql) if i < 0 else i
            continue
        else:
            out.append(ch)
        i += 1
    assert not in_string, "unterminated string literal"
    return "".join(out)


@pytest.mark.parametrize("seed_file", [F01, F02])
def test_seed_files_have_no_dollar_quoting(seed_file):
    code = _code_outside_strings((DML_SEED / seed_file).read_text())
    assert not re.search(r"\$[A-Za-z_0-9]*\$", code)


# ---------------------------------------------------------------------------
# T-baseline / seed_rows
# ---------------------------------------------------------------------------


def test_baseline_equals_seed_pks_at_ca9ff61(tmp_path):
    if shutil.which("git") is None:
        pytest.skip("git binary not available")
    probe = subprocess.run(
        ["git", "-C", str(REPO_ROOT), "cat-file", "-e", f"{BASELINE_COMMIT}^{{commit}}"],
        capture_output=True,
        text=True,
    )
    assert probe.returncode == 0, f"{BASELINE_COMMIT} missing from the repo; fetch full history"
    expected = {}
    for table, pk_col, seed_file in snr.SEED_TABLES:
        blob = subprocess.run(
            ["git", "-C", str(REPO_ROOT), "show", f"{BASELINE_COMMIT}:db/lakebase/dml_seed/{seed_file}"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout
        path = tmp_path / seed_file
        path.write_text(blob)
        expected[table] = {pk for pk, _ in snr.seed_rows(str(path), table, pk_col)}
    assert snr.load_baseline() == expected
    assert {t: len(v) for t, v in expected.items()} == {UC: 48, SIP: 137}


def test_seed_rows_returns_only_inserts_with_their_pk():
    for table, pk_col, seed_file in snr.SEED_TABLES:
        rows = snr.seed_rows(str(DML_SEED / seed_file), table, pk_col, SCHEMA)
        assert {pk for pk, _ in rows} == _file_pks(DML_SEED / seed_file)[table]
        for pk, stmt in rows:
            assert re.match(rf"INSERT INTO {SCHEMA}\.{table}\s*\(", stmt), stmt[:80]
            assert not DESTRUCTIVE.match(stmt)
    # 01's three UPDATEs are in the file but never returned.
    assert len(re.findall(r"^UPDATE\b", (DML_SEED / F01).read_text(), re.MULTILINE)) == 3


# ---------------------------------------------------------------------------
# T-unparseable: hard error before any write
# ---------------------------------------------------------------------------

BAD_INSERTS = {
    "default_pk": "INSERT INTO ${schema}.section_input_prompts (input_id, section_tag) VALUES (DEFAULT, 'x');",
    "no_pk_column": "INSERT INTO ${schema}.section_input_prompts (section_tag, input_template) VALUES ('x', 'y');",
    "multi_tuple": "INSERT INTO ${schema}.section_input_prompts (input_id, section_tag) VALUES (1003, 'x'), (1004, 'y');",
    "select_insert": "INSERT INTO ${schema}.section_input_prompts (input_id, section_tag) SELECT 1003, 'x';",
    "duplicate_pk": "INSERT INTO ${schema}.section_input_prompts (input_id, section_tag) VALUES (1001, 'dup');",
}


@pytest.mark.parametrize("bad", sorted(BAD_INSERTS))
def test_unparseable_pk_fails_before_any_write(seed_dir, bad):
    with open(seed_dir / F02, "a") as f:
        f.write("\n" + BAD_INSERTS[bad] + "\n")
    for db, call in [
        (_populated(), lambda db: _run_create(db, seed_dir)),
        (FakeDB(), lambda db: _run_create(db, seed_dir)),
        (FakeDB(), lambda db: snr.record_applied_rows(db.cursor(), SCHEMA, str(seed_dir), log=lambda _: None)),
    ]:
        with pytest.raises(snr.SeedError):
            call(db)
        assert db.executed == [] and db.files_run == []


# ---------------------------------------------------------------------------
# T-populated (S4)
# ---------------------------------------------------------------------------


def test_populated_applies_only_new_unledgered_rows(seed_dir):
    db = _populated(ledger={(SIP, 1002)})
    db.tables[UC].discard(5)  # admin deleted a baseline row
    db.tables[UC].add(5001)  # an admin-created row owns a future seed PK
    log = _run_create(db, seed_dir)

    assert 5 not in db.tables[UC], "an admin-deleted baseline row was resurrected"
    assert 1002 not in db.tables[SIP], "a ledgered-then-deleted row was resurrected"
    assert 1001 in db.tables[SIP] and (SIP, 1001) in db.ledger
    assert (UC, 5001) not in db.ledger, "an admin-held PK was ledgered"

    sip_inserts = _seed_inserts(db, SIP)
    assert len(sip_inserts) == 1 and re.search(r"VALUES\s*\(1001,", sip_inserts[0])
    assert "\nON CONFLICT (input_id) DO NOTHING\nRETURNING input_id\n)" in sip_inserts[0]  # D-38 F1
    assert len(_seed_inserts(db, UC)) == 1  # only the 5001 attempt, which conflicted

    assert db.files_run == [F08, F09], "populated install re-ran a bulk seed file"
    assert any("WARNING" in line and "config_id=5001" in line for line in log), log
    assert f"    {UC}: 0 inserted / 1 warnings" in log
    assert f"    {SIP}: 1 inserted / 0 warnings" in log
    assert any(line.startswith(f"  {UC}: populated") for line in log)
    assert any(line.startswith(f"  {SIP}: populated") for line in log)
    assert f"  {F03}: existing install -> skipped" in log
    assert not [s for s in db.executed if DESTRUCTIVE.match(s)]


def test_populated_rerun_is_a_noop_but_rewarns(seed_dir):
    db = _populated()
    db.tables[UC].add(5001)
    _run_create(db, seed_dir)
    before = (set(db.tables[UC]), set(db.tables[SIP]), set(db.ledger))
    log = _run_create(db, seed_dir)
    assert (db.tables[UC], db.tables[SIP], db.ledger) == before
    assert f"    {SIP}: 0 inserted / 0 warnings" in log
    assert f"    {UC}: 0 inserted / 1 warnings" in log


def test_populated_at_baseline_seed_files_inserts_nothing():
    """The live-check expectation: today's seed files on a populated install change nothing."""
    db = _populated()
    log = _run_create(db, DML_SEED)
    assert _seed_inserts(db, UC) == [] and _seed_inserts(db, SIP) == []
    assert db.ledger == set() and db.setvals == []
    assert f"    {UC}: 0 inserted / 0 warnings" in log
    assert f"    {SIP}: 0 inserted / 0 warnings" in log


def test_partially_seeded_populated_table_takes_new_row_path(seed_dir):
    db = _populated()
    db.tables[SIP] = {1, 2, 3}  # partially seeded
    _run_create(db, seed_dir)
    assert db.tables[SIP] == {1, 2, 3, 1001, 1002}
    assert F02 not in db.files_run


# ---------------------------------------------------------------------------
# T-fresh (S5) / T-recreate
# ---------------------------------------------------------------------------


def test_fresh_install_ledgers_post_baseline_rows_and_deletes_stick(seed_dir):
    db = FakeDB()
    log = _run_create(db, seed_dir)
    assert db.files_run == [F01, F02, F03, F08, F09]
    assert db.ledger == {(t, pk) for t, pks in NEW_PKS.items() for pk in pks}
    assert not any(pk in BASELINE[t] for t, pk in db.ledger)
    assert f"  {UC}: empty -> bulk seed {F01}" in log and f"  {F03}: fresh install -> run" in log
    assert db.seqs["section_input_prompts_input_id_seq"][:2] == [1003, False]
    assert db.seqs["usecase_descriptions_config_id_seq"][:2] == [5002, False]

    db.tables[SIP].discard(1001)  # admin deletes a post-baseline row
    db.tables[UC].discard(1)  # and a baseline row
    _run_create(db, seed_dir)
    assert 1001 not in db.tables[SIP] and 1 not in db.tables[UC]
    assert db.files_run[5:] == [F08, F09]


def test_recreate_keeps_ledger_and_stale_rows_are_harmless(seed_dir):
    text = SETUP_SH.read_text()
    recreate = text.split('elif ACTION == "recreate":', 1)[1].split('\n    elif ACTION ==', 1)[0]
    assert "seed_rows_applied" not in re.search(r"tables = \[[^\]]*\]", recreate).group(0)
    assert "DROP TABLE" in recreate and "seed_rows_applied" not in recreate.split("CREATE SCHEMA", 1)[0]

    # Recreate: the two tables were dropped and fully reseeded; the ledger
    # survived with a row the reseed rewrote and one for a seed row since removed.
    db = FakeDB(ledger={(SIP, 1001), (SIP, 990001)})
    db.run_sql_file(str(seed_dir / F01))
    db.run_sql_file(str(seed_dir / F02))
    snr.record_applied_rows(db.cursor(), SCHEMA, str(seed_dir), log=lambda _: None)
    assert db.ledger == {(SIP, 1001), (SIP, 990001), (SIP, 1002), (UC, 5001)}

    db.tables[SIP].discard(1002)
    log = _run_create(db, seed_dir)
    assert 1002 not in db.tables[SIP] and 1001 in db.tables[SIP]
    assert f"    {SIP}: 0 inserted / 0 warnings" in log


# ---------------------------------------------------------------------------
# T-seq
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "last_value, is_called, start, max_pk, expected",
    [
        (None, False, 1, 958, 959),  # NULL -> start_value; raise
        (None, False, 5000, 958, None),  # NULL -> start_value above max; keep
        (958, True, 1, 958, None),  # is_called: next 959 == max+1; keep
        (500, True, 1, 958, 959),  # is_called: next 501; raise
        (958, True, 1, 959, 960),  # is_called: next 959 < 960; raise
        (959, False, 1, 958, None),  # not is_called: next 959; keep
        (959, False, 1, 959, 960),  # not is_called: next 959 < 960; raise
        (2000, False, 1, 1001, None),  # never lower
        (2000, True, 1, 1001, None),  # never lower
    ],
)
def test_sequence_raise_never_lowers(last_value, is_called, start, max_pk, expected):
    seq = "section_input_prompts_input_id_seq"
    db = FakeDB(tables={SIP: {1, max_pk}}, seqs={seq: [last_value, is_called, start]})
    got = snr.raise_sequence_never_lower(db.cursor(), SCHEMA, SIP, "input_id", log=lambda _: None)
    assert got == expected
    if expected is None:
        assert db.setvals == [] and db.seqs[seq][:2] == [last_value, is_called]
    else:
        assert db.setvals == [(f"{SCHEMA}.{seq}", expected)]


# ---------------------------------------------------------------------------
# T-gating (S6) / T-noupdate
# ---------------------------------------------------------------------------


def test_empty_step_visibility_overrides_does_not_rerun_01_02(seed_dir):
    db = _populated()
    db.svo_count = 0
    _run_create(db, seed_dir)
    assert db.files_run == [F08, F09]
    assert set(db.tables[UC]) == BASELINE[UC] | NEW_PKS[UC]


def test_only_the_empty_table_gets_its_bulk_seed(seed_dir):
    db = _populated()
    db.tables[UC] = set()
    log = _run_create(db, seed_dir)
    assert db.files_run == [F01, F08, F09]
    assert (UC, 5001) in db.ledger and (SIP, 1001) in db.ledger
    assert f"  {UC}: empty -> bulk seed {F01}" in log
    assert f"  {F03}: existing install -> skipped" in log


def test_helper_never_emits_destructive_sql(seed_dir):
    runs = []
    for db in (FakeDB(), _populated(), _populated(ledger={(SIP, 1001)})):
        _run_create(db, seed_dir)
        snr.record_applied_rows(db.cursor(), SCHEMA, str(seed_dir), log=lambda _: None)
        runs.extend(db.executed)
    assert runs and not [s[:80] for s in runs if DESTRUCTIVE.match(s) and s != MARKER_CLEAR]


def test_helper_imports_no_db_driver():
    tree = ast.parse(Path(snr.__file__).read_text())
    imported = {
        alias.name.split(".")[0]
        for node in ast.walk(tree)
        if isinstance(node, (ast.Import, ast.ImportFrom))
        for alias in (node.names if isinstance(node, ast.Import) else [ast.alias(node.module or "")])
    }
    assert imported <= {"glob", "json", "os", "re"}, imported


# ---------------------------------------------------------------------------
# Wiring pins in setup-lakebase.sh and DDL 14
# ---------------------------------------------------------------------------


def _branch(text, action):
    body = text.split(f'elif ACTION == "{action}":', 1)[1].split("\n    elif ACTION ==", 1)[0]
    return body.split('print("✓ Tables ready")', 1)[0]


def test_setup_imports_helper_and_fails_closed():
    text = SETUP_SH.read_text()
    heredoc = text.split("<< 'PYTHON_EOF'", 1)[1].split("\nPYTHON_EOF", 1)[0]
    assert "sys.path.insert(0, os.path.join(PROJECT_ROOT, 'scripts'))" in heredoc
    imp = heredoc.index("import seed_new_rows")
    assert imp < heredoc.index("# Database Connection")
    assert "sys.exit(1)" in heredoc[imp : imp + 200]


def test_create_branch_uses_per_table_gating():
    create = _branch(SETUP_SH.read_text(), "create")
    code = "\n".join(line for line in create.splitlines() if not line.lstrip().startswith("#"))
    call = code.index("seed_new_rows.run_create_mode_seed(")
    assert "execute_sql_file(cursor, path, SCHEMA, ignore_errors=True)" in code[call:]
    assert "sys.exit(1)" in code[call:]
    assert "svo_count" not in code and " or " not in code
    assert "get_dml_seed_files" not in code and "setval" not in code


def test_recreate_branch_ledgers_after_reseed():
    recreate = _branch(SETUP_SH.read_text(), "recreate")
    code = "\n".join(line for line in recreate.splitlines() if not line.lstrip().startswith("#"))
    seed_loop = code.index("dml_files = get_dml_seed_files()")
    seq_reset = code.index("cursor.execute(f\"SELECT setval('{seq_name}', {max_val + 1}, false)\")")
    ledger = code.index("seed_new_rows.record_applied_rows(cursor, SCHEMA, DML_SEED_DIR)")
    assert seed_loop < seq_reset < ledger
    assert "sys.exit(1)" in code[ledger:]


def test_ddl_14_is_additive():
    sql = DDL_14.read_text()
    code = "\n".join(line for line in sql.splitlines() if not line.lstrip().startswith("--"))
    assert re.search(r"CREATE TABLE IF NOT EXISTS \$\{schema\}\.seed_rows_applied", code)
    assert re.search(r"PRIMARY KEY \(table_name, pk\)", code)
    assert not re.search(r"\b(ALTER|DROP|DELETE|TRUNCATE|UPDATE)\b", code, re.IGNORECASE)


def test_ddl_15_is_additive():
    sql = DDL_15.read_text()
    code = "\n".join(line for line in sql.splitlines() if not line.lstrip().startswith("--"))
    assert re.search(r"CREATE TABLE IF NOT EXISTS \$\{schema\}\.seed_bulk_pending", code)
    assert re.search(r"table_name VARCHAR\(100\) PRIMARY KEY", code)
    assert re.search(r"started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP", code)
    assert not re.search(r"\b(ALTER|DROP|DELETE|TRUNCATE|UPDATE)\b", code, re.IGNORECASE)


# ---------------------------------------------------------------------------
# D-38: insert/ledger crash windows (C1-C6)
# ---------------------------------------------------------------------------

PCT_ROW = """
INSERT INTO ${catalog}.${schema}.section_input_prompts
(input_id, section_tag, coding_assistant, input_template, system_prompt, version, is_active, inserted_at, updated_at, created_by)
VALUES
(1003, 'prd_generation', 'genie-code', 'covers 100% of %(name)s cases', 'sys', 1, TRUE, current_timestamp(), current_timestamp(), 'system');
"""

ALL_NEW = {(t, pk) for t, pks in NEW_PKS.items() for pk in pks}


def _ledger_writes(db):
    return [s for s in db.executed if re.match(rf"\s*INSERT INTO {SCHEMA}\.seed_rows_applied\b", s)]


def test_c1_s4_insert_and_ledger_are_one_statement(seed_dir):
    with open(seed_dir / F02, "a") as f:
        f.write(PCT_ROW)
    db = _populated()
    _run_create(db, seed_dir)

    writes = [s for s in db.executed if "INSERT INTO" in s]
    assert len(writes) == 4, [s[:60] for s in writes]  # 5001, 1001, 1002, 1003: one statement each
    for stmt in writes:
        assert stmt.startswith("WITH ins AS (\nINSERT INTO "), stmt[:80]
        assert f"INSERT INTO {SCHEMA}.seed_rows_applied (table_name, pk) SELECT %s," in stmt
    assert _ledger_writes(db) == [], "a separate ledger statement followed the seed insert"
    assert db.ledger == ALL_NEW | {(SIP, 1003)} and {1001, 1002, 1003} <= db.tables[SIP]
    pct = next(s for s in writes if "1003," in s)
    assert "covers 100%% of %%(name)s cases" in pct  # literal '%' survives pyformat


def test_c2_crash_after_the_s4_statement_leaves_table_and_ledger_consistent(seed_dir):
    db = _populated()
    db.crash_after = lambda sql: re.search(r"VALUES\s*\(1001,", sql)
    with pytest.raises(Crash):
        _run_create(db, seed_dir)
    for table, pk in ALL_NEW:
        assert (pk in db.tables[table]) == ((table, pk) in db.ledger), (table, pk)
    assert 1001 in db.tables[SIP]

    db.crash_after = None
    log = _run_create(db, seed_dir)
    assert not [line for line in log if "WARNING" in line], log
    assert db.ledger == ALL_NEW

    db.tables[SIP].discard(1001)  # admin delete after the retry
    _run_create(db, seed_dir)
    assert 1001 not in db.tables[SIP], "a crash-window row was resurrected"


def test_c3_interrupted_bulk_is_recovered_and_deletes_stick(seed_dir):
    db = FakeDB()
    db.crash_after_file = F02  # both bulk seeds wrote their rows; nothing ledgered yet
    with pytest.raises(Crash):
        _run_create(db, seed_dir)
    assert db.ledger == set() and db.markers == {UC, SIP}
    assert all(pk in db.tables[t] for t, pk in ALL_NEW)

    db.crash_after_file = None
    log = _run_create(db, seed_dir)
    assert f"  {UC}: recovered interrupted bulk seed (1 post-baseline rows ledgered)" in log
    assert f"  {SIP}: recovered interrupted bulk seed (2 post-baseline rows ledgered)" in log
    assert db.ledger == ALL_NEW and db.markers == set()
    assert f"    {UC}: 0 inserted / 0 warnings" in log and f"    {SIP}: 0 inserted / 0 warnings" in log
    assert not [line for line in log if "WARNING" in line], log
    assert db.files_run[2:] == [F08, F09]  # no bulk re-run on the retry

    db.tables[SIP].discard(1001)  # admin delete after recovery
    log = _run_create(db, seed_dir)
    assert 1001 not in db.tables[SIP], "an interrupted-bulk row was resurrected"
    assert not [line for line in log if "recovered" in line]


def test_c4_marker_lifecycle(seed_dir):
    db = FakeDB()
    _run_create(db, seed_dir)
    ev = db.events
    for table, seed_file in ((UC, F01), (SIP, F02)):
        mark, run, clear = ev.index(("mark", table)), ev.index(("file", seed_file)), ev.index(("clear", table))
        ledgers = [i for i, e in enumerate(ev) if e[:2] == ("ledger", table)]
        setval = ev.index(("setval", f"{SCHEMA}.{table}_{PK_COL[table]}_seq"))
        assert mark < run < setval < min(ledgers) and max(ledgers) < clear, (table, ev)
    assert db.markers == set()

    pop = _populated()
    _run_create(pop, seed_dir)
    assert not [e for e in pop.events if e[0] in ("mark", "clear")] and pop.markers == set()
    assert not [s for s in pop.executed if "seed_bulk_pending" in s and not s.startswith("SELECT")]


def test_c5_partial_bulk_rows_are_inserted_atomically_on_rerun(seed_dir):
    db = _populated(markers={SIP})
    db.tables[SIP] = set(BASELINE[SIP]) | {1001}  # the interrupted bulk never reached 1002
    log = _run_create(db, seed_dir)
    assert f"  {SIP}: recovered interrupted bulk seed (1 post-baseline rows ledgered)" in log
    assert {(SIP, 1001), (SIP, 1002)} <= db.ledger and 1002 in db.tables[SIP]
    assert f"    {SIP}: 1 inserted / 0 warnings" in log
    sip = _seed_inserts(db, SIP)
    assert len(sip) == 1 and sip[0].startswith("WITH ins AS (") and re.search(r"VALUES\s*\(1002,", sip[0])
    assert db.markers == set() and F02 not in db.files_run


def test_c6_recreate_branch_brackets_the_reseed_with_the_marker(seed_dir):
    recreate = _branch(SETUP_SH.read_text(), "recreate")
    code = "\n".join(line for line in recreate.splitlines() if not line.lstrip().startswith("#"))
    ddl_loop = code.index("ddl_files = get_ddl_files()")
    mark = code.index("leftover_bulks = seed_new_rows.mark_bulk_pending(")
    seed_loop = code.index("dml_files = get_dml_seed_files()")
    recover = code.index("seed_new_rows.recover_interrupted_bulks(cursor, SCHEMA, DML_SEED_DIR, leftover_bulks)")
    ledger = code.index("seed_new_rows.record_applied_rows(cursor, SCHEMA, DML_SEED_DIR)")
    assert ddl_loop < mark < seed_loop < recover < ledger
    assert "sys.exit(1)" in code[mark:seed_loop] and "sys.exit(1)" in code[ledger:]

    def recreate_run(db, crash_before_ledger=False):
        # The call site's sequence, as test_recreate_keeps_ledger_and_stale_rows_are_harmless drives it.
        cur, log = db.cursor(), []
        leftover = snr.mark_bulk_pending(cur, SCHEMA, [t for t, _, _ in snr.SEED_TABLES])
        db.run_sql_file(str(seed_dir / F01))
        db.run_sql_file(str(seed_dir / F02))
        if crash_before_ledger:
            return leftover, log
        snr.recover_interrupted_bulks(cur, SCHEMA, str(seed_dir), leftover, log=log.append)
        snr.record_applied_rows(cur, SCHEMA, str(seed_dir), log=log.append)
        return leftover, log

    db = FakeDB()
    leftover, log = recreate_run(db)
    assert leftover == set() and db.markers == set() and db.ledger == ALL_NEW
    assert not [line for line in log if "recovered" in line]
    assert db.events.index(("mark", SIP)) < db.events.index(("file", F01))

    # Crash between the reseed and record_applied_rows: the next create-mode run recovers.
    db = FakeDB()
    recreate_run(db, crash_before_ledger=True)
    assert db.markers == {UC, SIP} and db.ledger == set()
    log = _run_create(db, seed_dir)
    assert db.ledger == ALL_NEW and db.markers == set()
    assert f"  {SIP}: recovered interrupted bulk seed (2 post-baseline rows ledgered)" in log

    # A marker left by an earlier interrupted run is reported, recovered and cleared.
    db = FakeDB(markers={SIP})
    leftover, log = recreate_run(db)
    assert leftover == {SIP} and db.markers == set() and db.ledger == ALL_NEW
    assert f"  {SIP}: recovered interrupted bulk seed (2 post-baseline rows ledgered)" in log
    assert not [line for line in log if line.startswith(f"  {UC}: recovered")]


# ---------------------------------------------------------------------------
# D-40: an admin's active row owns the uq_section_assistant_version_active slot
# ---------------------------------------------------------------------------

ACTIVE_TRIPLE = "uq_section_assistant_version_active"


class _Diag:
    def __init__(self, constraint_name):
        self.constraint_name = constraint_name


class Psycopg3LikeError(Exception):
    """psycopg3 spelling: ``sqlstate`` + ``diag.constraint_name``."""

    def __init__(self, sqlstate, constraint_name):
        super().__init__(f"{sqlstate} on {constraint_name}")
        self.sqlstate = sqlstate
        self.diag = _Diag(constraint_name)


class Psycopg2LikeError(Exception):
    """psycopg2 spelling: ``pgcode`` + ``diag.constraint_name``."""

    def __init__(self, pgcode, constraint_name):
        super().__init__(f"{pgcode} on {constraint_name}")
        self.pgcode = pgcode
        self.diag = _Diag(constraint_name)


def _fail_on(pk, exc):
    return lambda sql: exc if sql.startswith("WITH ins AS (") and re.search(rf"VALUES\s*\({pk},", sql) else None


def test_v1_active_triple_collision_warns_skips_and_the_next_row_applies(seed_dir):
    db = _populated()
    db.fail = _fail_on(1001, Psycopg3LikeError("23505", ACTIVE_TRIPLE))
    log = _run_create(db, seed_dir)

    assert 1001 not in db.tables[SIP] and (SIP, 1001) not in db.ledger, "the skipped row was applied or ledgered"
    assert 1002 in db.tables[SIP] and (SIP, 1002) in db.ledger, "the next row in the same run was not applied"
    assert (UC, 5001) in db.ledger
    warn = [line for line in log if "WARNING" in line]
    assert warn == [
        f"    WARNING: {SIP} input_id=1001 skipped: an active row for (section_tag, coding_assistant, version) "
        f"already exists ({ACTIVE_TRIPLE}); seed row not applied"
    ], log
    assert f"    {SIP}: 1 inserted / 1 warnings" in log
    assert db.seqs["section_input_prompts_input_id_seq"][:2] == [1003, False]  # the run reached the sequence raise

    # U4: a re-run re-warns (not ledgered) and inserts nothing; the admin row owns the slot.
    log = _run_create(db, seed_dir)
    assert f"    {SIP}: 0 inserted / 1 warnings" in log
    assert (SIP, 1001) not in db.ledger and 1001 not in db.tables[SIP]

    # The admin deactivates their row: the next deploy inserts the seed fork.
    db.fail = None
    log = _run_create(db, seed_dir)
    assert f"    {SIP}: 1 inserted / 0 warnings" in log and (SIP, 1001) in db.ledger


@pytest.mark.parametrize(
    "exc",
    [
        Psycopg3LikeError("23505", "section_input_prompts_pkey"),
        Psycopg2LikeError("23505", "uq_some_other_index"),
        Psycopg3LikeError("23505", None),
        Psycopg3LikeError("23505", ACTIVE_TRIPLE + "_v2"),
    ],
    ids=["pkey", "other_index_pg2", "no_constraint", "near_miss_name"],
)
def test_v2_unique_violation_on_another_constraint_reraises(seed_dir, exc):
    db = _populated()
    db.fail = _fail_on(1001, exc)
    log = []
    with pytest.raises(type(exc)) as raised:
        snr.run_create_mode_seed(db.cursor(), SCHEMA, str(seed_dir), db.run_sql_file, log=log.append)
    assert raised.value is exc
    assert not [line for line in log if "WARNING" in line and "input_id=1001" in line], log
    assert 1002 not in db.tables[SIP], "the run continued past a fail-closed error"


@pytest.mark.parametrize(
    "exc",
    [
        Psycopg3LikeError("23502", ACTIVE_TRIPLE),  # not-null, even with the index's name
        Psycopg2LikeError("23503", ACTIVE_TRIPLE),  # foreign key
        RuntimeError("connection dropped"),  # no SQLSTATE at all
    ],
    ids=["not_null", "fk_pg2", "no_sqlstate"],
)
def test_v3_non_unique_errors_reraise(seed_dir, exc):
    db = _populated()
    db.fail = _fail_on(1001, exc)
    with pytest.raises(type(exc)) as raised:
        _run_create(db, seed_dir)
    assert raised.value is exc
    assert 1002 not in db.tables[SIP] and (SIP, 1001) not in db.ledger


@pytest.mark.parametrize("error_cls", [Psycopg3LikeError, Psycopg2LikeError], ids=["sqlstate", "pgcode"])
def test_v4_both_sqlstate_spellings_are_recognized(seed_dir, error_cls):
    db = _populated()
    db.fail = _fail_on(1001, error_cls("23505", ACTIVE_TRIPLE))
    log = _run_create(db, seed_dir)
    assert f"    {SIP}: 1 inserted / 1 warnings" in log
    assert (SIP, 1001) not in db.ledger and (SIP, 1002) in db.ledger


def test_v1_runner_connects_with_autocommit():
    # D-40's skip-and-continue relies on it: a failed statement must not abort the next one.
    heredoc = SETUP_SH.read_text().split("<< 'PYTHON_EOF'", 1)[1].split("\nPYTHON_EOF", 1)[0]
    connect = heredoc.split("# Database Connection", 1)[1]
    assert "autocommit=True," in connect and "conn.autocommit = True" in connect
