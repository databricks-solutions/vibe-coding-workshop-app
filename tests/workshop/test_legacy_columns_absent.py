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
