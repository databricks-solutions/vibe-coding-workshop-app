"""T5 R1 — offline guards for the legacy gates-backfill runbook + helper scripts.

The runbook (``docs/superpowers/plans/2026-09-30-mcp-phase3-t5-r1-gates-backfill-runbook.md``)
is executed by a HUMAN against live Lakebase; nothing here touches a database.
These tests pin the two things an offline suite CAN prove:

1. **Three-way map pin.** ``manifest.step_number_to_tag()`` == the VALUES parsed
   out of ``scripts/r1_emit_map_sql.py``'s output == the VALUES parsed out of the
   runbook .md (and every inlined copy of the CTE in the runbook agrees). Tamper
   any one of the three and this fails.
2. **Verifier comparison core.** The pure ``compare_row`` returns 0 mismatches for
   a correct backfill and reports mismatches (and drives a non-zero exit) for a
   dropped tag, a wrong skipped tag, and a lost step-1 credit.
3. **Static SQL guards on the runbook text** — no JSONB column compared to ``''``;
   the backfill UPDATE carries the regex guard + gates-empty re-check + DISTINCT +
   ORDER BY; no COMMIT inside a DO block; the backup uses plain CREATE TABLE (no
   IF NOT EXISTS); the rollback touches ``skipped_gates`` via ``jsonb_set`` / ``-``
   rather than replacing the whole ``session_parameters`` object.
4. **Read-only harness.** ``r1_verify_backfill.py`` sets
   ``SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`` before any query — in
   source order AND at runtime (via a fake connection).

As stated in the PR body: offline tests CANNOT prove PostgreSQL semantics. The
human's live read-only dry run is the real gate.
"""

from __future__ import annotations

import importlib.util
import json
import pathlib
import re
import subprocess
import sys
from contextlib import contextmanager

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.workshop import manifest  # noqa: E402
from src.backend.workshop.completion_keying import tag_to_global_number  # noqa: E402

RUNBOOK = (
    REPO_ROOT
    / "docs/superpowers/plans/2026-09-30-mcp-phase3-t5-r1-gates-backfill-runbook.md"
)
EMIT_SCRIPT = REPO_ROOT / "scripts/r1_emit_map_sql.py"
VERIFY_SCRIPT = REPO_ROOT / "scripts/r1_verify_backfill.py"


def _load_script(path: pathlib.Path, name: str):
    """Import a scripts/ module by path (scripts/ is not a package)."""
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


r1_verify = _load_script(VERIFY_SCRIPT, "r1_verify_backfill")
r1_emit = _load_script(EMIT_SCRIPT, "r1_emit_map_sql")

INVERSE = tag_to_global_number()

# A VALUES tuple: (<int>, '<tag>').
_TUPLE_RE = re.compile(r"\(\s*(\d+)\s*,\s*'([a-z0-9_]+)'\s*\)")
# A full inlined CTE body (everything between `VALUES` and the closing `)`).
_CTE_BLOCK_RE = re.compile(
    r"WITH step_map\(step_number, tag\) AS \(\s*VALUES(.*?)\n\)", re.DOTALL
)


def _parse_values(text: str) -> dict[int, str]:
    return {int(n): t for n, t in _TUPLE_RE.findall(text)}


@pytest.fixture(scope="module")
def runbook_text() -> str:
    assert RUNBOOK.exists(), f"runbook missing: {RUNBOOK}"
    return RUNBOOK.read_text(encoding="utf-8")


# =============================================================================
# 1. THREE-WAY MAP PIN
# =============================================================================


def _emit_output() -> str:
    """Run the emit script as a subprocess (end-to-end) and return stdout."""
    out = subprocess.run(
        [sys.executable, str(EMIT_SCRIPT)],
        cwd=str(REPO_ROOT),
        check=True,
        capture_output=True,
        text=True,
    )
    return out.stdout


def _runbook_canonical_cte(doc: str) -> str:
    """The marked canonical CTE block from the runbook's §2."""
    begin = doc.index(r1_emit.CTE_BEGIN)
    end = doc.index(r1_emit.CTE_END, begin) + len(r1_emit.CTE_END)
    return doc[begin:end]


def test_three_way_map_pin(runbook_text):
    manifest_map = {int(k): v for k, v in manifest.step_number_to_tag().items()}

    emit_map = _parse_values(_emit_output())
    runbook_map = _parse_values(_runbook_canonical_cte(runbook_text))

    assert manifest_map, "manifest step_number_to_tag is empty"
    # The pin: all three identical. Tampering any single one breaks this.
    assert emit_map == manifest_map, "emit script output diverges from the manifest map"
    assert runbook_map == manifest_map, "runbook CTE diverges from the manifest map"


def test_emit_output_matches_render_cte():
    """The subprocess stdout equals the module's own render (no stray output)."""
    assert _emit_output().strip() == r1_emit.render_cte(manifest.step_number_to_tag()).strip()


def test_all_inlined_runbook_cte_copies_agree(runbook_text):
    """Every inlined copy of the CTE in the runbook equals the canonical map, so a
    runnable SQL block can't silently drift from §2."""
    blocks = _CTE_BLOCK_RE.findall(runbook_text)
    assert len(blocks) >= 2, "expected the canonical CTE plus inlined copies"
    manifest_map = {int(k): v for k, v in manifest.step_number_to_tag().items()}
    for i, body in enumerate(blocks):
        assert _parse_values(body) == manifest_map, f"inlined CTE copy #{i} diverged"


# =============================================================================
# 2. VERIFIER COMPARISON CORE (pure, no DB)
# =============================================================================


def _good_row():
    """A correctly backfilled row: numbers [6,17,18] -> their tags; skipped [57] ->
    [semlayer_locate]; intent defined (adds global 1 on both sides)."""
    return {
        "session_id": "s-good",
        "created_by": "good@x.com",
        "backup_completed_steps": json.dumps([6, 17, 18]),
        "backup_skipped_steps": json.dumps([57]),
        "live_completed_gates": json.dumps(["setup_lakebase", "genie_space", "agent_framework"]),
        "live_session_parameters": json.dumps({"skipped_gates": ["semlayer_locate"]}),
        "industry": "Retail",
        "use_case": "Demand forecasting",
    }


def test_correct_backfill_has_zero_mismatches():
    assert r1_verify.compare_row(_good_row(), INVERSE) == []
    assert r1_verify.verify_rows([_good_row()], INVERSE) == []


def test_dropped_completed_tag_is_reported():
    row = _good_row()
    # Backfill dropped 'agent_framework' (global 18) from the gate set.
    row["live_completed_gates"] = json.dumps(["setup_lakebase", "genie_space"])
    fields = {m.field for m in r1_verify.compare_row(row, INVERSE)}
    assert "completed_steps" in fields
    assert "score" in fields  # 18 is a scored step, so the score diverges too


def test_wrong_skipped_tag_is_reported():
    row = _good_row()
    # Same COUNT, wrong tag: semlayer_profile (58) instead of semlayer_locate (57).
    row["live_session_parameters"] = json.dumps({"skipped_gates": ["semlayer_profile"]})
    mismatches = r1_verify.compare_row(row, INVERSE)
    fields = {m.field for m in mismatches}
    # A count-only check would miss this; the set comparison catches it.
    assert "skipped_steps" in fields


def test_lost_step_1_credit_is_reported():
    row = {
        "session_id": "s-step1",
        "created_by": "step1@x.com",
        "backup_completed_steps": json.dumps([1, 2, 3]),
        "backup_skipped_steps": json.dumps([]),
        # Backfill dropped usecase_selection (global 1); no intent to re-credit it.
        "live_completed_gates": json.dumps(["project_setup", "prd_generation"]),
        "live_session_parameters": json.dumps({}),
        "industry": "",
        "use_case": "",
    }
    fields = {m.field for m in r1_verify.compare_row(row, INVERSE)}
    assert "step_1_credit" in fields
    assert "completed_steps" in fields


# --- non-zero exit path through main() with a fake (offline) connection -------


class _FakeCursor:
    def __init__(self, rows):
        self._rows = rows
        self.executed: list[str] = []

    def execute(self, sql, params=None):
        self.executed.append(sql)

    def fetchall(self):
        return self._rows

    def close(self):
        pass


def _install_fake_db(monkeypatch, rows):
    cursor = _FakeCursor(rows)

    @contextmanager
    def _fake_get_connection():
        yield object()

    monkeypatch.setattr(r1_verify.lakebase, "get_connection", _fake_get_connection)
    monkeypatch.setattr(r1_verify.lakebase, "_dict_cursor", lambda conn: cursor)
    return cursor


def _main_args():
    return [
        "--backup-table",
        "vibe_coding_workshop.r1_gates_backfill_backup_20260930_1200",
        "--schema",
        "vibe_coding_workshop",
    ]


def test_main_exits_zero_on_clean_backfill(monkeypatch):
    _install_fake_db(monkeypatch, [_good_row()])
    assert r1_verify.main(_main_args()) == 0


def test_main_exits_nonzero_on_mismatch(monkeypatch):
    bad = _good_row()
    bad["live_completed_gates"] = json.dumps(["setup_lakebase", "genie_space"])  # dropped tag
    _install_fake_db(monkeypatch, [bad])
    assert r1_verify.main(_main_args()) == 1


def test_main_sets_read_only_before_any_query_at_runtime(monkeypatch):
    cursor = _install_fake_db(monkeypatch, [_good_row()])
    r1_verify.main(_main_args())
    # The very first statement issued is the read-only guard; the data SELECT follows.
    assert cursor.executed[0] == r1_verify.READ_ONLY_STATEMENT
    assert any("FROM vibe_coding_workshop.r1_gates_backfill_backup" in s for s in cursor.executed[1:])


# =============================================================================
# 3. STATIC SQL GUARDS ON THE RUNBOOK TEXT
# =============================================================================

# JSONB columns that must NEVER be compared to the empty string literal (the PR3c
# B2 parse-time bug). TEXT columns (completed_steps/skipped_steps) are excluded.
_JSONB_EMPTY_STRING_RE = re.compile(
    r"(completed_gates|session_parameters|captured_outputs|skipped_gates)\s*(=|!=|<>)\s*''"
)


def _section(doc: str, start: str, end: str) -> str:
    i = doc.index(start)
    j = doc.index(end, i)
    return doc[i:j]


def test_no_jsonb_column_compared_to_empty_string(runbook_text):
    offenders = _JSONB_EMPTY_STRING_RE.findall(runbook_text)
    assert offenders == [], f"JSONB column compared to '': {offenders}"


def test_backfill_update_carries_all_guards(runbook_text):
    backfill = _section(runbook_text, "## (b) BACKFILL", "### (b') Idempotence")
    # The int-array regex guard (distinctive fragment).
    assert r"\d+\s*(,\s*\d+\s*)*" in backfill, "regex guard missing from backfill UPDATE"
    # Gates-empty re-check at write time.
    assert "completed_gates IS NULL OR" in backfill
    assert "'[]'::jsonb" in backfill
    # Dedup + deterministic ordering.
    assert "DISTINCT" in backfill
    assert "ORDER BY sm.step_number" in backfill
    # Writes both ledgers; skipped via jsonb_set (object preserved).
    assert "jsonb_set(" in backfill


def test_no_commit_inside_do_block(runbook_text):
    # The runbook uses explicit BEGIN/COMMIT/ROLLBACK, never a DO block (which would
    # auto-commit). Assert there is no PL/pgSQL DO block at all.
    assert not re.search(r"\bDO\s*\$\$", runbook_text), "unexpected DO block in runbook"


def test_backup_uses_plain_create_table(runbook_text):
    # Plain CREATE TABLE so a name collision fails loudly.
    assert "CREATE TABLE :backup_tbl AS" in runbook_text
    assert "CREATE TABLE :label_backup_tbl AS" in runbook_text
    assert "CREATE TABLE IF NOT EXISTS" not in runbook_text


def test_rollback_touches_only_skipped_gates_key(runbook_text):
    rollback = _section(runbook_text, "Then the surgical restore", "After rollback")
    # Surgical: jsonb_set to restore the key, or the `-` operator to remove it.
    assert "jsonb_set(" in rollback
    assert "- 'skipped_gates'" in rollback
    assert "session_parameters = CASE" in rollback
    # NEVER a whole-object replacement from the backup.
    assert "session_parameters = w.backup_session_parameters" not in rollback


# =============================================================================
# 4. READ-ONLY HARNESS (source-order guard)
# =============================================================================


def test_verifier_sets_read_only_before_any_query_in_source():
    src = VERIFY_SCRIPT.read_text(encoding="utf-8")
    assert "SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY" in src
    ro = src.index("cursor.execute(READ_ONLY_STATEMENT)")
    sel = src.index("cursor.execute(select_sql)")
    assert ro < sel, "read-only guard must execute before the data SELECT"
