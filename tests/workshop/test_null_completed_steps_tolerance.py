"""Phase 3 T5 R4a — readers tolerate a NULL ``completed_steps`` column.

R4a's INSERT omits ``completed_steps`` / ``current_step`` / ``skipped_steps``.
``current_step`` and ``skipped_steps`` carry DDL defaults (``1`` and ``'[]'``),
but ``completed_steps`` has NO DDL default (``03_sessions.sql``), so every row
written after R4a stores SQL NULL there. Every reader must tolerate that NULL —
no exception — and still produce the correct GATE-derived counts (R4a does not
change the readers; they were already gate-first after T5 PR3b′/PR3c, and this
pins it against the NULL that R4a now makes routine).

The row under test mimics an R4a-written gate-only session: ``completed_steps``
NULL, ``current_step`` = 1 (default), ``skipped_steps`` = '[]' (default), and a
populated ``completed_gates`` (semantic-layer tags → globals 57/58/59). Its
gate-derived completed count is therefore 3 even though the number column is NULL.

Covered readers: ``load_session``, ``get_user_default_session``,
``get_user_sessions``, ``get_leaderboard``, ``get_analytics``.

TAMPER: make any reader ``json.loads`` the raw ``completed_steps`` value without
the ``None`` guard → ``json.loads(None)`` raises ``TypeError`` and that reader's
test fails. Restore the guard → passes.

Offline: a fake connection / recording cursor / stubbed ``execute_query`` — no
live Lakebase (mirrors ``test_completion_keying_aggregations``).
"""

import json
import pathlib
import sys
from contextlib import contextmanager

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.services import lakebase

# Semantic-layer tags → globals 57/58/59; the high globals the dense-index read
# can't line up (so they only resolve via the gate map), count = 3.
GENIE_GATES = ["semlayer_locate", "semlayer_profile", "semlayer_measures"]
EXPECTED_GLOBALS = {57, 58, 59}


def _null_row(**overrides):
    """An R4a-written gate-only session row: completed_steps is SQL NULL, the other
    two legacy columns carry their DDL defaults, and progress lives in gates."""
    row = {
        "session_id": "s-null",
        "created_by": "learner@example.com",
        "session_name": "New Session",
        "session_description": None,
        "industry": None,
        "industry_label": None,
        "use_case": None,
        "use_case_label": None,
        "feedback_rating": None,
        "feedback_comment": None,
        "prerequisites_completed": False,
        "current_step": 1,            # DDL default
        "workshop_level": "genie-accelerator",
        "completed_steps": None,      # SQL NULL — the R4a shape
        "skipped_steps": "[]",        # DDL default
        "step_1_prompt": None,
        "step_prompts": {},
        "captured_outputs": json.dumps({}),
        "completed_gates": json.dumps(GENIE_GATES),
        "session_parameters": json.dumps({}),
        "created_at": None,
        "updated_at": None,
    }
    row.update(overrides)
    return row


class _RecCursor:
    """Recording cursor whose fetchone/fetchall return the NULL row(s)."""

    def __init__(self, one=None, many=None):
        self._one = one
        self._many = many or []
        self.executions = []

    def execute(self, sql, params=None):
        self.executions.append((sql, params))

    def fetchone(self):
        return self._one

    def fetchall(self):
        return self._many

    def close(self):
        pass


@contextmanager
def _fake_connection():
    yield object()


def _patch_conn(monkeypatch, cursor):
    monkeypatch.setattr(lakebase, "is_lakebase_configured", lambda: True)
    monkeypatch.setattr(lakebase, "_get_sessions_table_name", lambda: "genie.sessions")
    monkeypatch.setattr(lakebase, "get_connection", _fake_connection)
    monkeypatch.setattr(lakebase, "_dict_cursor", lambda conn: cursor)


# --- load_session -------------------------------------------------------------


def test_load_session_tolerates_null_completed_steps(monkeypatch):
    _patch_conn(monkeypatch, _RecCursor(one=_null_row()))
    session = lakebase.load_session("s-null")
    assert session is not None
    # NULL parsed to an empty list (not an error); gates survive intact.
    assert session["completed_steps"] == []
    assert session["completed_gates"] == GENIE_GATES


# --- get_user_default_session -------------------------------------------------


def test_get_user_default_session_tolerates_null_completed_steps(monkeypatch):
    _patch_conn(monkeypatch, _RecCursor(one=_null_row()))
    session = lakebase.get_user_default_session("learner@example.com")
    assert session is not None
    assert session["completed_steps"] == []
    assert session["current_step"] == 1


# --- get_user_sessions --------------------------------------------------------


def test_get_user_sessions_tolerates_null_completed_steps(monkeypatch):
    _patch_conn(monkeypatch, _RecCursor(many=[_null_row()]))
    sessions = lakebase.get_user_sessions("learner@example.com", saved_only=False)
    assert len(sessions) == 1
    # Count is gate-derived (3), computed with NO error despite the NULL column.
    assert sessions[0]["completed_step_count"] == 3


# --- get_leaderboard ----------------------------------------------------------


def test_get_leaderboard_tolerates_null_completed_steps(monkeypatch):
    _patch_conn(monkeypatch, _RecCursor(many=[_null_row()]))
    result = lakebase.get_leaderboard(limit=10)
    # The gate-only NULL-completed_steps row is admitted and counted via gates.
    entry = next(e for e in result if e["user_id"] == "learner@example.com")
    assert entry["completed_step_count"] == 3


# --- get_analytics ------------------------------------------------------------


def test_get_analytics_tolerates_null_completed_steps(monkeypatch):
    rows = [_null_row(session_id="s-null", feedback_rating=None)]

    def _fake_execute_query(sql, params=None):
        if "total_sessions" in sql:
            return [{"total_sessions": 1, "total_users": 1, "total_feedback": 0,
                     "positive_count": 0, "negative_count": 0}]
        if "avg_steps_per_session" in sql and "prereqs_completed" in sql:
            return [{"avg_steps_per_session": 0, "prereqs_completed": 0, "saved_sessions": 0}]
        if "total_prompts" in sql:
            return [{"total_prompts": 0}]
        # score_rows / step_rows / user_rows all select both completion columns.
        if "completed_gates" in sql and "completed_steps" in sql:
            return [dict(r) for r in rows]
        return []

    monkeypatch.setattr(lakebase, "is_lakebase_configured", lambda: True)
    monkeypatch.setattr(lakebase, "_get_sessions_table_name", lambda: "genie.sessions")
    monkeypatch.setattr(lakebase, "execute_query", _fake_execute_query)

    result = lakebase.get_analytics()
    # No error, and the gate-derived globals are counted even with NULL numbers.
    steps = {c["step_number"] for c in result["step_completion_counts"]}
    assert EXPECTED_GLOBALS <= steps
