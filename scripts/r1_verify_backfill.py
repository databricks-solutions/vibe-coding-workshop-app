#!/usr/bin/env python3
"""T5 R1 — read-only verification harness for the gates-backfill runbook.

WHAT IT PROVES
--------------
The backfill (runbook step b) writes ``completed_gates`` / ``skipped_gates`` for
legacy App-origin rows by mapping their numeric ``completed_steps`` /
``skipped_steps`` through the frozen ``step_map`` (``scripts/r1_emit_map_sql.py``).
Once gates are present, the read path (T5 PR1 / ``completion_keying``) trusts the
gates verbatim and IGNORES the numbers. This harness proves that round-trip is
loss-free: for every backed-up row it recomputes the canonical GLOBAL step sets
TWO ways and asserts they agree —

* **backup / number-derived**: the backup's numbers, with gates treated as EMPTY
  (the App-origin branch — ``completed_steps`` are already global numbers).
* **live / gate-derived**: the CURRENT row's ``completed_gates`` +
  ``skipped_gates``, mapped back to globals via the inverse map (the gates-present
  branch).

Both views are resolved with the app's OWN helpers
(``lakebase._row_completion_globals`` -> ``completion_keying`` +
``lakebase._calculate_score`` + the step-1 ``_has_defined_intent`` rule), so this
checks the real production math, not a re-implementation. ``industry`` /
``use_case`` are read from the LIVE row (the backfill never touches them, so they
are invariant) and applied to BOTH views, which makes the step-1 comparison a
check that global 1 survives the number->gate->number round trip rather than a
re-derivation of intent.

SAFETY
------
* Connects with the app's existing Lakebase helper (``lakebase.get_connection``);
  introduces NO new credential path.
* Issues ``SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`` as the very
  first statement, before any SELECT — the session is physically prevented from
  writing.
* Only SELECTs. Emails are md5-hashed before printing.
* Exit code is non-zero if ANY row mismatches (or on connection/SQL error), so it
  is safe to gate the runbook on ``&& echo OK``.

OFFLINE TESTABILITY
-------------------
The pure comparison core (:func:`compare_row`) takes plain dict rows and the
inverse map and returns a list of :class:`Mismatch`. The offline tests call it
directly with fixtures — no database. ``main`` is the thin DB wrapper around it.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import re
import sys
from dataclasses import dataclass
from typing import Any, Callable, Iterable

# scripts/ is not a package; make the repo importable when run as a plain script.
import pathlib

_REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from src.backend.services import lakebase  # noqa: E402
from src.backend.workshop.completion_keying import tag_to_global_number  # noqa: E402

# The read-only guard, issued before ANY data query. Named so the offline test
# can assert both its presence and that it precedes the first SELECT in source.
READ_ONLY_STATEMENT = "SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY"

# Operator-supplied identifiers (schema / backup table) are interpolated into SQL
# because identifiers cannot be bound as parameters. They are not untrusted input
# (they come from the runbook operator), but we still constrain them to a safe
# shape so a typo can never smuggle anything into the query text.
_SAFE_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$")


@dataclass(frozen=True)
class Mismatch:
    """One disagreement between the number-derived and gate-derived views."""

    field: str
    backup_value: Any
    live_value: Any


def _hash_email(email: str | None) -> str:
    return hashlib.md5((email or "").encode("utf-8")).hexdigest()[:12]


def _number_derived_view(row: dict[str, Any]) -> dict[str, Any]:
    """App-origin view: gates EMPTY, numbers taken verbatim from the backup."""
    return {
        "completed_gates": "[]",
        "session_parameters": "{}",
        "completed_steps": row.get("backup_completed_steps"),
        "skipped_steps": row.get("backup_skipped_steps"),
        "industry": row.get("industry"),
        "use_case": row.get("use_case"),
    }


def _gate_derived_view(row: dict[str, Any]) -> dict[str, Any]:
    """MCP-origin-shaped view: trust the LIVE gates; numbers emptied/ignored."""
    return {
        "completed_gates": row.get("live_completed_gates"),
        "session_parameters": row.get("live_session_parameters"),
        "completed_steps": "[]",
        "skipped_steps": "[]",
        "industry": row.get("industry"),
        "use_case": row.get("use_case"),
    }


def compare_row(
    row: dict[str, Any],
    inverse_map: dict[str, int],
    *,
    resolve: Callable[[dict[str, Any], dict[str, int]], tuple[set, set]] | None = None,
    score: Callable[[list, list], int] | None = None,
) -> list[Mismatch]:
    """Pure comparison of one joined (backup, live) row. No DB access.

    ``row`` carries both sides on a single dict (as the verification SELECT
    returns them): ``backup_completed_steps`` / ``backup_skipped_steps`` (TEXT
    JSON int arrays), ``live_completed_gates`` (JSONB tag array),
    ``live_session_parameters`` (JSONB object holding ``skipped_gates``), and the
    invariant ``industry`` / ``use_case``.

    Returns a list of :class:`Mismatch` (empty when the round trip is loss-free),
    comparing the completed set, the skipped set, the score, and the step-1
    credit. ``resolve`` / ``score`` default to the app's production helpers and
    are injectable only to keep the function trivially unit-testable."""

    _resolve = resolve or lakebase._row_completion_globals
    _score = score or lakebase._calculate_score

    backup_completed, backup_skipped = _resolve(_number_derived_view(row), inverse_map)
    live_completed, live_skipped = _resolve(_gate_derived_view(row), inverse_map)

    mismatches: list[Mismatch] = []

    # Full-set comparison (not just counts): a wrong tag that preserves the count
    # must still be caught. Counts/score/step-1 are reported as named fields for a
    # human-legible diff.
    if backup_completed != live_completed:
        mismatches.append(
            Mismatch("completed_steps", sorted(backup_completed), sorted(live_completed))
        )
    if backup_skipped != live_skipped:
        mismatches.append(
            Mismatch("skipped_steps", sorted(backup_skipped), sorted(live_skipped))
        )

    backup_score = _score(sorted(backup_completed), sorted(backup_skipped))
    live_score = _score(sorted(live_completed), sorted(live_skipped))
    if backup_score != live_score:
        mismatches.append(Mismatch("score", backup_score, live_score))

    backup_step1 = 1 in backup_completed
    live_step1 = 1 in live_completed
    if backup_step1 != live_step1:
        mismatches.append(Mismatch("step_1_credit", backup_step1, live_step1))

    return mismatches


def verify_rows(
    rows: Iterable[dict[str, Any]], inverse_map: dict[str, int]
) -> list[tuple[dict[str, Any], list[Mismatch]]]:
    """Run :func:`compare_row` over an iterable of rows. DB-free (pure)."""
    results: list[tuple[dict[str, Any], list[Mismatch]]] = []
    for row in rows:
        mismatches = compare_row(row, inverse_map)
        if mismatches:
            results.append((row, mismatches))
    return results


def _build_select(schema: str, backup_table: str) -> str:
    for ident in (schema, backup_table):
        if not _SAFE_IDENT.match(ident):
            raise SystemExit(f"refusing unsafe identifier: {ident!r}")
    return (
        "SELECT b.session_id AS session_id,\n"
        "       b.completed_steps AS backup_completed_steps,\n"
        "       b.skipped_steps   AS backup_skipped_steps,\n"
        "       s.completed_gates AS live_completed_gates,\n"
        "       s.session_parameters AS live_session_parameters,\n"
        "       s.industry AS industry,\n"
        "       s.use_case AS use_case,\n"
        "       s.created_by AS created_by\n"
        f"FROM {backup_table} b\n"
        f"JOIN {schema}.sessions s ON s.session_id = b.session_id\n"
        "ORDER BY b.session_id"
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Read-only gates-backfill verifier.")
    parser.add_argument(
        "--backup-table",
        required=True,
        help="Fully-qualified backup table, e.g. vibe_coding_workshop.r1_gates_backfill_backup_20260930_1200",
    )
    parser.add_argument(
        "--schema",
        default=os.getenv("LAKEBASE_SCHEMA") or None,
        help="Schema holding the live sessions table (defaults to lakebase.get_schema()).",
    )
    args = parser.parse_args(argv)

    schema = args.schema or lakebase.get_schema()
    if not schema:
        raise SystemExit("No schema resolved; pass --schema or set LAKEBASE_SCHEMA.")

    select_sql = _build_select(schema, args.backup_table)
    inverse_map = tag_to_global_number()

    try:
        with lakebase.get_connection() as conn:
            cursor = lakebase._dict_cursor(conn)
            # READ-ONLY guard FIRST — before any data query touches a table.
            cursor.execute(READ_ONLY_STATEMENT)
            cursor.execute(select_sql)
            rows = [dict(r) for r in cursor.fetchall()]
            cursor.close()
    except Exception as exc:  # noqa: BLE001 — surface any DB error as a hard failure
        print(f"ERROR: verification query failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 2

    offenders = verify_rows(rows, inverse_map)

    print(f"R1 verify: checked {len(rows)} backed-up row(s); {len(offenders)} mismatch(es).")
    for row, mismatches in offenders:
        print(
            f"  MISMATCH session_id={row.get('session_id')} "
            f"user_md5={_hash_email(row.get('created_by'))}"
        )
        for mm in mismatches:
            print(f"    - {mm.field}: backup={mm.backup_value!r} live={mm.live_value!r}")

    if offenders:
        print("RESULT: FAIL — gate-derived progress diverges from the backed-up numbers.")
        return 1
    print("RESULT: OK — 0 mismatches (number->gate round trip is loss-free).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
