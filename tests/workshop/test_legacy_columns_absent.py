"""T5 R4b — ABSENCE pin for the three legacy step columns across ``src/**``.

R4b removes every application READ of ``completed_steps`` / ``current_step`` /
``skipped_steps`` (R4a already removed the writes). After it, those names must
not appear ANYWHERE under ``src/`` — not in code, not in comments — so the only
remaining references live in the DDL, the R1 backfill tooling (``scripts/``), and
the tests that pin this absence. The column DROP itself stays the human's.

Two assertions:

1. **Whole-name grep over ``src/**``** — zero hits for any of the three names, in
   any file type. Allowed files: NONE.
2. **Backend read surface** — ``lakebase.save_session``'s signature and every
   ``SELECT ... FROM ... sessions`` string in ``services/lakebase.py`` name none
   of the three.

TAMPER: reintroduce any of the three names anywhere under ``src/`` (e.g. re-add
``current_step`` to a SELECT) and assertion (1) — or (2) for a lakebase SELECT —
fails.

Note: GLOBAL-number scoring structures (``STEP_SCORES`` / ``CHAPTERS`` /
``SECTION_TAG_TO_STEP_NUMBER`` / ``ALL_STEPS``) and the gate-derived
``completed_step_count`` / ``completed_globals`` identifiers do NOT contain any of
the three whole-word names, so they survive.
"""

import inspect
import pathlib
import re
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.services import lakebase

LEGACY = ("completed_steps", "current_step", "skipped_steps")

# Whole-word match: a name bounded by non-word characters. `completed_step_count`,
# `completed_globals`, `completedSteps` (camelCase) and the like do NOT match.
_NAME_RE = re.compile(r"\b(?:completed_steps|current_step|skipped_steps)\b")

SRC_ROOT = REPO_ROOT / "src"
_SCANNED_SUFFIXES = {".py", ".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"}

# Post-DROP (fevm-serverless 2026-10-01): the three columns were dropped from the
# live table, so fresh installs must never recreate them. These two dirs are the
# install-time schema source — DDL creates the table, dml_seed loads initial rows.
DDL_ROOT = REPO_ROOT / "db" / "lakebase" / "ddl"
SEED_ROOT = REPO_ROOT / "db" / "lakebase" / "dml_seed"

# THE SANCTIONED EXCEPTION. The R1 gates-backfill tooling is RETAINED (amended
# post-DROP scope, approved by the human gate 2026-10-01): fevm-serverless is done,
# but installs upgrading from `main` still carry number-only progress and must run
# R1 before deploying gates-only code. These three files reference the retired
# column names BY DESIGN (they read/translate them during the migration). This
# allowlist is the ONLY place that exception is granted — nothing else may join it.
# It is discovered against the `r1_*` globs below (NOT hand-expanded), so removing
# an entry while its file still references a legacy name fails the pin, and any new
# `r1_*` file that references one fails too.
R1_SANCTIONED_FILES = sorted(
    (
        "scripts/r1_emit_map_sql.py",
        "scripts/r1_verify_backfill.py",
        "tests/workshop/test_r1_backfill_runbook.py",
    )
)
_R1_GLOBS = ("scripts/r1_*.py", "tests/workshop/test_r1_*.py")


def _scanned_files() -> list[pathlib.Path]:
    return [
        p
        for p in SRC_ROOT.rglob("*")
        if p.is_file() and p.suffix in _SCANNED_SUFFIXES and "node_modules" not in p.parts
    ]


def test_no_legacy_column_names_anywhere_in_src():
    offenders: list[str] = []
    for path in _scanned_files():
        text = path.read_text(encoding="utf-8", errors="ignore")
        for lineno, line in enumerate(text.splitlines(), start=1):
            if _NAME_RE.search(line):
                rel = path.relative_to(REPO_ROOT)
                offenders.append(f"{rel}:{lineno}: {line.strip()}")
    assert offenders == [], "legacy column name(s) still present in src/**:\n" + "\n".join(offenders)


def test_scan_actually_covered_source_files():
    # Guard against a vacuous pass (e.g. a path typo making the sweep empty).
    files = _scanned_files()
    assert len(files) > 50, f"source sweep covered too few files ({len(files)}) — misconfigured?"


def test_save_session_signature_names_no_legacy_columns():
    params = set(inspect.signature(lakebase.save_session).parameters)
    offenders = params & set(LEGACY)
    assert not offenders, f"save_session still accepts legacy params: {offenders}"


def _sessions_select_statements(source: str) -> list[str]:
    """Every ``SELECT ... FROM {table_name} ...`` block in the lakebase source
    (the sessions table is interpolated as ``{table_name}``)."""
    return re.findall(r"SELECT\b.*?FROM\s*\{table_name\}.*?(?=\"\"\"|\Z)", source, re.DOTALL)


def test_lakebase_sessions_selects_name_no_legacy_columns():
    source = pathlib.Path(lakebase.__file__).read_text(encoding="utf-8")
    selects = _sessions_select_statements(source)
    assert selects, "no SELECT ... FROM {table_name} statements found — regex drift?"
    offenders = []
    for stmt in selects:
        for name in LEGACY:
            if re.search(rf"\b{name}\b", stmt):
                offenders.append(f"{name} in: {' '.join(stmt.split())[:120]}")
    assert offenders == [], "lakebase sessions SELECT names a legacy column:\n" + "\n".join(offenders)


# =============================================================================
# POST-DROP: the install-time schema source must not recreate the dropped columns.
# =============================================================================


def _scan_sql_files(root: pathlib.Path) -> list[pathlib.Path]:
    """Every SQL source under ``root`` (``.sql`` and the ``.sql.template`` seeds)."""
    return sorted(
        p
        for p in root.rglob("*")
        if p.is_file() and (p.suffix == ".sql" or p.name.endswith(".sql.template"))
    )


def _legacy_offenders(files: list[pathlib.Path]) -> list[str]:
    offenders: list[str] = []
    for path in files:
        text = path.read_text(encoding="utf-8", errors="ignore")
        for lineno, line in enumerate(text.splitlines(), start=1):
            if _NAME_RE.search(line):
                offenders.append(f"{path.relative_to(REPO_ROOT)}:{lineno}: {line.strip()}")
    return offenders


def test_ddl_declares_no_legacy_step_columns():
    # TAMPER: re-add e.g. `current_step INTEGER DEFAULT 1,` to 03_sessions.sql ->
    # this fails. 12_mcp_engine_state.sql (the gates column source) is untouched and
    # names none of the three.
    files = _scan_sql_files(DDL_ROOT)
    assert len(files) > 5, f"DDL sweep covered too few files ({len(files)}) — path wrong?"
    offenders = _legacy_offenders(files)
    assert offenders == [], "legacy column name(s) still declared in db/lakebase/ddl/**:\n" + "\n".join(offenders)


def test_seed_dml_has_no_legacy_step_column_stragglers():
    files = _scan_sql_files(SEED_ROOT)
    assert files, f"seed sweep covered no files — path wrong? ({SEED_ROOT})"
    offenders = _legacy_offenders(files)
    assert offenders == [], "legacy column name(s) present in db/lakebase/dml_seed/**:\n" + "\n".join(offenders)


def _discovered_r1_referencing_files() -> list[str]:
    """Every ``r1_*`` tooling file that references a legacy column name, discovered
    by glob (NOT from the allowlist) so the pin below is load-bearing."""
    found: list[str] = []
    for pattern in _R1_GLOBS:
        for path in REPO_ROOT.glob(pattern):
            if _NAME_RE.search(path.read_text(encoding="utf-8", errors="ignore")):
                found.append(path.relative_to(REPO_ROOT).as_posix())
    return sorted(found)


def test_only_sanctioned_r1_tooling_references_legacy_names():
    # The R1 backfill tooling is the sole sanctioned exception (see R1_SANCTIONED_FILES).
    # Discovered-by-glob must equal the allowlist exactly, so BOTH tamper directions bite:
    #   - remove an entry from R1_SANCTIONED_FILES (while its file still references a
    #     legacy name) -> discovered superset of allowlist -> fails;
    #   - add a new `r1_*` file that references a legacy name -> same;
    #   - an allowlisted file that stops referencing the names -> discovered subset -> fails
    #     (a stale exception to prune).
    assert _discovered_r1_referencing_files() == R1_SANCTIONED_FILES
