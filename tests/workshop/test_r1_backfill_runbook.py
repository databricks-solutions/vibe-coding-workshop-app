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


# =============================================================================
# 5. FIX LOOP 1 — A' (skipped-only) handling, no-op exit, read-only reset,
#    label backfill. Cross-review FAIL / OPTION A.
# =============================================================================


def _session_row(gates, completed, skipped, skipped_gates=None):
    """A sessions-shaped row (DB column shapes) for the cohort/admission mirror."""
    sp = {} if skipped_gates is None else {"skipped_gates": skipped_gates}
    return {
        "completed_gates": json.dumps(gates),
        "completed_steps": json.dumps(completed),
        "skipped_steps": json.dumps(skipped),
        "session_parameters": json.dumps(sp),
    }


def _a_prime_backup_row():
    """A backup row shaped like A' (skipped-only): no completed numbers."""
    return {
        "session_id": "s-aprime",
        "created_by": "aprime@x.com",
        "backup_completed_steps": json.dumps([]),
        "backup_skipped_steps": json.dumps([57]),
        "live_completed_gates": json.dumps([]),
        "live_session_parameters": json.dumps({"skipped_gates": ["semlayer_locate"]}),
        "industry": "",
        "use_case": "",
    }


# --- 5a. Cohort logic classifies A' and the verifier STOPs on it --------------


def test_classify_cohort_identifies_all_cohorts():
    assert r1_verify.classify_cohort(_session_row([], [6, 17], [])) == "A"
    assert r1_verify.classify_cohort(_session_row([], [], [57])) == "A_prime"
    assert r1_verify.classify_cohort(_session_row(["setup_lakebase"], [6], [])) == "B"
    assert r1_verify.classify_cohort(_session_row([], [], [])) == "C"


def test_verifier_raises_on_a_prime_backup_row():
    with pytest.raises(ValueError):
        r1_verify.compare_row(_a_prime_backup_row(), INVERSE)


def test_main_exits_nonzero_on_a_prime_row(monkeypatch):
    _install_fake_db(monkeypatch, [_a_prime_backup_row()])
    assert r1_verify.main(_main_args()) != 0


def test_runbook_a_prime_stop_and_r4(runbook_text):
    sec = _section(runbook_text, "### (a.1b)", "### (a.2)")
    assert "STOP" in sec
    assert "R4" in sec
    assert "completion_keying" in sec  # the stated root cause
    assert "skipped_tags" in sec  # lists skipped numbers -> mapped tags


# --- 5b. Backfill selection excludes A' --------------------------------------


def test_backfill_admits_only_cohort_a():
    assert r1_verify.is_backfill_admitted(_session_row([], [6, 17], [])) is True
    assert r1_verify.is_backfill_admitted(_session_row([], [], [57])) is False  # A'
    assert r1_verify.is_backfill_admitted(_session_row(["genie_space"], [6], [])) is False  # B
    assert r1_verify.is_backfill_admitted(_session_row([], [], [])) is False  # C
    # A-shaped but already carries skipped_gates (K-overlap) -> not admitted.
    assert r1_verify.is_backfill_admitted(_session_row([], [6], [], skipped_gates=["semlayer_locate"])) is False


def test_backfill_predicate_requires_completed_nonempty(runbook_text):
    backfill = _section(runbook_text, "## (b) BACKFILL", "### (b') Idempotence")
    assert "cohort A only" in backfill
    assert "completed_steps MUST be non-empty" in backfill


def test_backup_predicate_is_cohort_a_only(runbook_text):
    dpre = _section(runbook_text, "## (d-pre) BACKUP", "## (b) BACKFILL")
    assert "cohort A only" in dpre
    assert "backup_count <> cohort_a`" in dpre  # not cohort_a + cohort_a_prime


# --- 5c. A + A' = 0 no-op exit; post-run expectations cover only A -----------


def test_noop_exit_when_no_cohort_a():
    rows = [_session_row(["genie_space"], [6], []), _session_row([], [], [])]  # B + C
    cohorts = {r1_verify.classify_cohort(r) for r in rows}
    assert "A" not in cohorts and "A_prime" not in cohorts  # -> no-op exit
    with_a = rows + [_session_row([], [17], [])]
    assert "A" in {r1_verify.classify_cohort(r) for r in with_a}  # -> not a no-op


def test_runbook_has_noop_exit_text(runbook_text):
    assert "R1 complete — nothing to backfill" in runbook_text
    assert "cohort_a + cohort_a_prime = 0" in runbook_text


def test_postrun_expectations_cover_only_A(runbook_text):
    # The old (wrong) claims must be gone.
    assert "A = A' = 0" not in runbook_text
    assert "B += (A + A')" not in runbook_text
    # The corrected claim is present.
    assert "A' is unchanged" in runbook_text


# --- 5d. Read-only -> read-write reset before every write --------------------

_RO = "SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;"
_RW = "SET SESSION CHARACTERISTICS AS TRANSACTION READ WRITE;"
_SHOW = "SHOW transaction_read_only;"
_WRITE_RE = re.compile(r"(?m)^\s*(?:UPDATE vibe_coding_workshop|CREATE TABLE )")


def test_every_read_only_reset_before_next_write(runbook_text):
    ro_positions = [m.start() for m in re.finditer(re.escape(_RO), runbook_text)]
    assert ro_positions, "expected at least one READ ONLY statement"
    writes = [m.start() for m in _WRITE_RE.finditer(runbook_text)]
    for ro in ro_positions:
        nxt = min((w for w in writes if w > ro), default=None)
        assert nxt is not None, "a READ ONLY with no following write statement"
        window = runbook_text[ro:nxt]
        assert _RW in window, "no READ WRITE reset between READ ONLY and the next write"
        assert _SHOW in window, "no SHOW transaction_read_only check before the next write"
        assert window.index(_RW) < window.index(_SHOW), "SHOW must follow the READ WRITE reset"

    # (e) is reachable right after the no-op exit (a.8) in the SAME psql session,
    # which skipped (a.9) and may still be READ ONLY — so (e)'s write part must carry
    # its OWN reset before its first write, independent of (a.9) / (d-pre).
    e_write = _section(runbook_text, "### (e.3)", "### (e.5)")
    e_first_write = min(
        i for i in (e_write.find("CREATE TABLE"), e_write.find("UPDATE vibe_coding_workshop")) if i != -1
    )
    assert _RW in e_write and _SHOW in e_write, "(e) write part missing READ WRITE reset"
    assert e_write.index(_RW) < e_first_write, "(e) reset must precede its first write"
    assert e_write.index(_RW) < e_write.index(_SHOW), "SHOW must follow the (e) reset"


def test_rollback_resets_read_write_before_update(runbook_text):
    rollback = _section(runbook_text, "Then the surgical restore", "After rollback")
    assert _RW in rollback and _SHOW in rollback
    assert rollback.index(_RW) < rollback.index("UPDATE vibe_coding_workshop.sessions")


# --- 5e. Non-blocking: label backfill (e.2 industry+use_case; e.4 resolvable) -


def test_e2_lists_unresolved_industry_and_use_case(runbook_text):
    e2 = _section(runbook_text, "### (e.2)", "### (e.3)")
    assert "industry_src" in e2 and "usecase_src" in e2
    assert e2.count("NOT EXISTS") >= 2  # one unresolved listing per label kind


def test_e4_compares_to_resolvable_not_total(runbook_text):
    e4 = _section(runbook_text, "### (e.4)", "### (e.5)")
    assert "resolvable" in e4
    assert "unresolved" in e4
    assert "never" in e4  # unresolved is never a ROLLBACK signal


def test_bprime_states_accurate_rerun_reason(runbook_text):
    bprime = _section(runbook_text, "### (b') Idempotence", "## (c) VERIFY")
    assert "0 rows" in bprime
    assert "skipped_gates" in bprime  # the accurate WHERE re-check reason
    assert "write-time" in bprime


# =============================================================================
# 6. FIX LOOP 2 — NULL-safe emptiness predicates (the (a.1b) NULL trap).
# =============================================================================

# The distinctive digit check that tails every TEXT number-column non-empty test.
_DIGIT_TEST_RE = re.compile(r"~\s*'\[0-9\]'")


def test_number_emptiness_predicates_are_null_safe(runbook_text):
    """Every `completed_steps`/`skipped_steps` non-empty test must carry a leading
    `IS NOT NULL` guard, so a NULL column can't be miscounted (the (a.1b) NULL trap:
    `NOT (col ~ '…')` is NULL for a NULL column and silently drops the row). Keyed on
    the `~ '[0-9]'` digit check that tails each real predicate; prose mentions (no
    `\\]\\s*$'` regex body nearby) are skipped."""
    checked = 0
    for m in _DIGIT_TEST_RE.finditer(runbook_text):
        pos = m.start()
        window = runbook_text[max(0, pos - 185):pos]
        if r"\]\s*$'" not in window:
            continue  # prose mention of the test, not an actual SQL predicate
        checked += 1
        assert "IS NOT NULL" in window, (
            f"NULL-unsafe emptiness predicate near: {runbook_text[pos - 95:pos + 12]!r}"
        )
    assert checked >= 10, f"expected >= 10 SQL emptiness predicates, found {checked}"


def test_a1b_listing_matches_a1_aprime_filter(runbook_text):
    """(a.1b) must mirror the (a.1) cohort_a_prime filter: NOT(completed_nonempty)
    AND skipped_nonempty, each with the SAME IS-NOT-NULL-guarded non-empty test."""
    a1b = _section(runbook_text, "### (a.1b)", "### (a.2)")
    assert "NOT (s.completed_steps IS NOT NULL AND" in a1b  # exact negation of (a.1)
    assert "AND (s.skipped_steps IS NOT NULL AND" in a1b    # same skipped_nonempty guard


def test_classify_cohort_null_completed_is_a_prime():
    """A row whose completed_steps is SQL NULL (not '[]') with non-empty skipped is
    A' — the Python mirror must agree with the NULL-safe (a.1) classification."""
    row = {
        "completed_gates": json.dumps([]),
        "completed_steps": None,  # SQL NULL
        "skipped_steps": json.dumps([57]),
        "session_parameters": json.dumps({}),
    }
    assert r1_verify.classify_cohort(row) == "A_prime"
    assert r1_verify.is_backfill_admitted(row) is False


def test_verifier_raises_on_null_completed_a_prime_backup():
    row = _a_prime_backup_row()
    row["backup_completed_steps"] = None  # SQL NULL in the backup
    with pytest.raises(ValueError):
        r1_verify.compare_row(row, INVERSE)
