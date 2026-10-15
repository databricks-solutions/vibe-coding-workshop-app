"""D-168 — the #144/#145 Insights fixes reach installs that ran main 2.6.0's seed.

main 2.6.0 (24e7b99) installed the Insights rows 300/305 (defaults) and 1300/1305
(genie-code forks) with its own text; #144/#145 then changed those rows' input_template
in place. seed_new_rows never updates a row, so the fix ships as version 2 under new ids:

  R1  the 2.6.0 ids keep main's statements byte for byte (v1).
  R2  320/321/1320/1321 are a9311af's rows 300/305/1300/1305 with only the id and the
      version changed (v2), outside the builder's id ranges.
  R3  on an install holding main's seed, seed_new_rows inserts the v2 rows, leaves the
      v1 rows untouched, and the resolver (routes._refresh_lakebase_cache's query, run
      by a fake that honours its DISTINCT ON / ORDER BY) serves the v2 text for all
      four (section, assistant) pairs.

Offline: git show for the two refs, a fake cursor for Lakebase.
"""

import re
import subprocess
import sys

import pytest

from scripts import seed_new_rows as snr
from src.backend.api import routes

from .test_app_family_genie_forks import REPO_ROOT, SEED, _row
from .test_seed_new_rows import BASELINE, DML_SEED, PK_COL, SCHEMA, SIP, UC, FakeCursor, FakeDB

sys.path.insert(0, str(REPO_ROOT / "scripts" / "insights_prompts"))
import build_rows  # noqa: E402

MAIN_REF = "24e7b99"  # main, Release 2.6.0
BASE_REF = "a9311af"  # integration before D-168
SEED_RELPATH = "db/lakebase/dml_seed/02_seed_section_input_prompts.sql"
# v1 input_id (main 2.6.0's text) -> v2 input_id (the #144/#145 text).
V2_OF = {300: 320, 305: 321, 1300: 1320, 1305: 1321}
PAIRS = {
    300: ("insights_activation", "__default__"),
    305: ("insights_alerts", "__default__"),
    1300: ("insights_activation", "genie-code"),
    1305: ("insights_alerts", "genie-code"),
}
MAIN_INSIGHTS_IDS = set(range(300, 306)) | set(range(1300, 1306))


def _statements(text):
    """{input_id: INSERT statement} for every section_input_prompts row in seed text."""
    out = {}
    for stmt in snr.split_statements(text):
        pk = snr._insert_pk(stmt, SIP, "input_id")
        if pk is not None:
            out[pk] = stmt
    return out


def _seed_at(ref):
    return _statements(subprocess.check_output(["git", "show", f"{ref}:{SEED_RELPATH}"], cwd=REPO_ROOT, text=True))


@pytest.fixture(scope="module")
def main_seed():
    return _seed_at(MAIN_REF)


@pytest.fixture(scope="module")
def base_seed():
    return _seed_at(BASE_REF)


HEAD = _statements(SEED.read_text())


# --- R1 / R2: the rows ---------------------------------------------------------------


def test_r1_main_insights_rows_are_main_bytes(main_seed):
    assert {pk for pk in main_seed if pk in MAIN_INSIGHTS_IDS} == MAIN_INSIGHTS_IDS
    for pk in sorted(MAIN_INSIGHTS_IDS):
        assert HEAD[pk] == main_seed[pk], f"{pk} differs from main {MAIN_REF}"
        assert _row(HEAD[pk])["version"] == 1


def test_r2_v2_rows_are_the_base_rows_with_new_id_and_version(base_seed):
    for v1, v2 in V2_OF.items():
        stmt = base_seed[v1]
        assert stmt.count(f"({v1}, '") == 1 and stmt.count("true, 1, true, current_timestamp()") == 1
        rebuilt = stmt.replace(f"({v1}, '", f"({v2}, '").replace(
            "true, 1, true, current_timestamp()", "true, 2, true, current_timestamp()"
        )
        assert HEAD[v2] == rebuilt, f"{v2} is not {BASE_REF}'s {v1} at version 2"


def test_r2_v2_ids_are_pinned_and_outside_the_builder_ranges():
    served = {}
    for pk, stmt in HEAD.items():
        row = _row(stmt)
        key = (row["section_tag"], row.get("coding_assistant") or "__default__")
        if key in PAIRS.values() and row.get("version", 1) == 2:
            served[key] = pk
    assert served == {PAIRS[v1]: v2 for v1, v2 in V2_OF.items()}
    assert dict(build_rows.V2_IDS) == served
    for pk in served.values():
        assert pk not in build_rows.DEFAULT_IDS and pk not in build_rows.FORK_IDS, pk


# --- R3: a main 2.6.0 install -------------------------------------------------------


class UniqueViolation(Exception):
    """Shaped like psycopg's: SQLSTATE + diag.constraint_name (seed_new_rows D-40)."""

    sqlstate = snr.UNIQUE_VIOLATION

    class diag:
        constraint_name = snr.ACTIVE_TRIPLE_INDEX


def _key(row):
    return (row["section_tag"], row.get("coding_assistant") or "__default__", row.get("version", 1))


class ContentDB(FakeDB):
    """FakeDB that also keeps each section_input_prompts row's content and enforces
    uq_section_assistant_version_active (one ACTIVE row per tag, assistant, version)."""

    def __init__(self, rows, **kw):
        super().__init__(**kw)
        self.rows = dict(rows)  # input_id -> parsed row
        self.tables[SIP] = set(self.rows)

    def cursor(self):
        return ContentCursor(self)


class ContentCursor(FakeCursor):
    def _execute(self, sql, params=None):
        self._raw = sql  # FakeCursor hands _cte whitespace-collapsed SQL
        super()._execute(sql, params)

    def _cte(self, s, params):
        inner = re.match(r"WITH ins AS \(\n(INSERT INTO .*)\nON CONFLICT \(", self._raw, re.S).group(1).replace("%%", "%")
        if params == (SIP,):
            row = _row(inner)
            # ON CONFLICT (input_id) checks its arbiter first: a held PK skips without error.
            if row["input_id"] not in self.db.rows and row.get("is_active", True) and any(
                r.get("is_active", True) and _key(r) == _key(row) for r in self.db.rows.values()
            ):
                raise UniqueViolation(_key(row))
        super()._cte(s, params)
        if params == (SIP,) and self.rowcount == 1:
            self.db.rows[row["input_id"]] = row


def _main_install(main_seed):
    """An install that ran main 2.6.0's seed: every main row, no seed ledger (main has none)."""
    rows = {pk: _row(snr.transform_sql_for_postgres(stmt, SCHEMA)) for pk, stmt in main_seed.items()}
    seqs = {f"{t}_{c}_seq": [max(rows) if t == SIP else max(BASELINE[UC]), True, 1] for t, c in PK_COL.items()}
    db = ContentDB(rows, seqs=seqs, svo_count=10)
    db.tables[UC] = set(BASELINE[UC])
    return db


def _run_seed(db):
    log = []
    snr.run_create_mode_seed(db.cursor(), SCHEMA, str(DML_SEED), db.run_sql_file, log=log.append)
    return log


def _resolver_query(sql, rows):
    """routes' section_input_prompts query over ``rows``: WHERE is_active = TRUE, then
    the first row per DISTINCT ON key in ORDER BY order (version ASC or DESC)."""
    s = " ".join(sql.split())
    distinct = [c.strip() for c in re.search(r"DISTINCT ON \(([^)]*)\)", s).group(1).split(",")]
    order = re.search(r"ORDER BY (.*)$", s).group(1).split(",")
    assert "WHERE is_active = TRUE" in s, s
    picked = [r for r in rows if r.get("is_active", True)]
    for term in reversed(order):
        col, *direction = term.split()
        picked.sort(key=lambda r: r.get(col) or "", reverse=direction == ["DESC"])
    out = {}
    for r in picked:
        out.setdefault(tuple(r.get(c) for c in distinct), r)
    return list(out.values())


@pytest.fixture
def resolver_on(monkeypatch):
    """Point routes' Lakebase cache at a ContentDB through the real refresh query."""

    def bind(db):
        def execute_query(sql, params=None):
            if f"FROM {SCHEMA}.usecase_descriptions" in sql:
                return [{"industry": "travel", "use_case": "x", "version": 1}]
            assert f"FROM {SCHEMA}.section_input_prompts" in sql, sql[:120]
            rows = [dict(r, coding_assistant=r.get("coding_assistant") or "__default__") for r in db.rows.values()]
            return _resolver_query(sql, rows)

        monkeypatch.setattr(routes, "USE_LAKEBASE", True)
        monkeypatch.setattr(routes, "LAKEBASE_SERVICE_AVAILABLE", True)
        monkeypatch.setattr(routes, "is_lakebase_configured", lambda: True)
        monkeypatch.setattr(routes, "get_schema", lambda: SCHEMA)
        monkeypatch.setattr(routes, "execute_query", execute_query)
        monkeypatch.setattr(routes, "_load_library_collections", lambda schema: (None, None))
        routes.clear_lakebase_cache()

    yield bind
    routes.clear_lakebase_cache()


def test_r3_main_install_serves_main_text_before_the_upgrade(main_seed, resolver_on):
    """Control: the same install and resolver before seed_new_rows serve main's v1 text."""
    resolver_on(_main_install(main_seed))
    for v1, (tag, assistant) in PAIRS.items():
        assert routes.get_section_input_template(tag, assistant)["input"] == _row(main_seed[v1])["input_template"]


def test_r3_seed_new_rows_delivers_v2_to_a_main_install(main_seed, base_seed, resolver_on):
    db = _main_install(main_seed)
    before = {pk: dict(db.rows[pk]) for pk in V2_OF}
    log = _run_seed(db)
    inserted = {int(re.search(r"VALUES\s*\((\d+),", s).group(1)) for s in db.executed if s.startswith("WITH ins AS (")}
    assert set(V2_OF.values()) <= {pk for pk in inserted if pk in db.rows and pk not in main_seed}
    assert not [line for line in log if "already exists (uq_section_assistant_version_active)" in line], log
    # main's own Insights rows are held (PK present, no ledger on 2.6.0) and stay byte-unchanged.
    for pk in sorted(MAIN_INSIGHTS_IDS):
        assert f"    WARNING: {SIP} input_id={pk} is held by an existing row; seed row not applied" in log
    assert {pk: db.rows[pk] for pk in V2_OF} == before
    assert not [s for s in db.executed if re.match(r"\s*(UPDATE|DELETE FROM \S+section_input_prompts)", s)]

    resolver_on(db)
    for v1, (tag, assistant) in PAIRS.items():
        served = routes.get_section_input_template(tag, assistant)["input"]
        assert served == _row(base_seed[v1])["input_template"], f"{tag}/{assistant} does not serve v2"
        assert served != _row(main_seed[v1])["input_template"]
