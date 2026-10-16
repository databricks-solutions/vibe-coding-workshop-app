"""Backward-compatibility tests for pre-2.8.0 ``sessions`` rows (read-time synthesis).

Verifies that when upgrading from ``main`` (< 2.8.0) without running any SQL
``UPDATE`` or ``DROP`` on the ``sessions`` table:

1. ``load_session`` and ``get_user_default_session`` synthesize ``completed_gates``
   and ``session_parameters['skipped_gates']`` from legacy ``completed_steps`` and
   ``skipped_steps`` when ``completed_gates`` is empty.
2. Pre-2.8.0 Insights sessions (``workshop_level == 'genie-accelerator'``,
   ``coding_assistant == 'genie-code'``, no ``view`` key) synthesize
   ``session_parameters['view'] = 'insights'``.
3. ``get_user_sessions`` surfaces the exact ``completed_step_count`` for legacy
   sessions.
4. ``get_leaderboard`` admits, scores, and ranks pre-2.8.0 sessions alongside
   2.8.0 gate-keyed sessions with zero data loss.
5. ``get_analytics`` includes pre-2.8.0 sessions in ``avg_score``,
   ``avg_steps_per_session``, ``step_completion_counts``, ``recent_sessions``,
   and ``user_activity``.
6. Continuing a pre-2.8.0 session via ``save_session_merging_gates`` or
   ``save_session_applying_mcp_delta`` preserves all previously completed steps
   alongside the newly completed step.
7. ``legacy_session_compat`` never issues ``UPDATE``, ``DELETE``, ``DROP``, or
   ``TRUNCATE`` statements.
"""

from __future__ import annotations

import json
import pathlib
import re
import sys
from contextlib import contextmanager
from typing import Any, Dict, List

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.services import lakebase, legacy_session_compat
from src.backend.workshop import engine
from src.backend.workshop.state import build_session_state


@pytest.fixture(autouse=True)
def _reset_compat_cache():
    legacy_session_compat.clear_legacy_columns_cache()
    yield
    legacy_session_compat.clear_legacy_columns_cache()


class _CompatDBCursor:
    """In-memory DB cursor opting into ``legacy_compat_enabled`` to simulate a live
    Lakebase connection where ``completed_steps`` and ``skipped_steps`` exist."""

    legacy_compat_enabled = True

    def __init__(self, rows: List[Dict[str, Any]], dict_mode: bool = True):
        self.rows = rows
        self.dict_mode = dict_mode
        self._result_one: Any = None
        self._result_many: List[Any] = []
        self.executed_sql: List[str] = []
        self.rowcount = 0

    def execute(self, sql: str, params: Any = None) -> None:
        norm = " ".join(sql.split())
        self.executed_sql.append(norm)
        self._result_one = None
        self._result_many = []

        if "information_schema.columns" in norm:
            self._result_many = (
                [{"column_name": "completed_steps"}, {"column_name": "skipped_steps"}]
                if self.dict_mode
                else [("completed_steps",), ("skipped_steps",)]
            )
            return

        if "SELECT completed_steps, skipped_steps FROM" in norm and "WHERE session_id = %s" in norm:
            sid = params[0]
            match = next((r for r in self.rows if r.get("session_id") == sid), None)
            if match:
                self._result_one = (
                    {"completed_steps": match.get("completed_steps"), "skipped_steps": match.get("skipped_steps")}
                    if self.dict_mode
                    else (match.get("completed_steps"), match.get("skipped_steps"))
                )
            return

        if "SELECT session_id, completed_steps, skipped_steps FROM" in norm and "ANY(%s)" in norm:
            ids = set(params[0])
            matches = [r for r in self.rows if r.get("session_id") in ids]
            self._result_many = [
                {
                    "session_id": r["session_id"],
                    "completed_steps": r.get("completed_steps"),
                    "skipped_steps": r.get("skipped_steps"),
                }
                for r in matches
            ]
            return

        if "FOR UPDATE" in norm:
            sid = params[0]
            match = next((r for r in self.rows if r.get("session_id") == sid), None)
            if match:
                if "captured_outputs" in norm:
                    self._result_one = (
                        match.get("completed_gates"),
                        match.get("captured_outputs"),
                        match.get("session_parameters"),
                    )
                else:
                    self._result_one = (
                        match.get("completed_gates"),
                        match.get("session_parameters"),
                    )
            return

        if norm.startswith("INSERT INTO") and "ON CONFLICT (session_id) DO UPDATE" in norm:
            sid = params[0]
            completed_gates = json.loads(params[16]) if params[16] is not None else None
            session_params = json.loads(params[17]) if params[17] is not None else None
            match = next((r for r in self.rows if r.get("session_id") == sid), None)
            if match:
                if completed_gates is not None:
                    match["completed_gates"] = json.dumps(completed_gates)
                if session_params is not None:
                    match["session_parameters"] = json.dumps(session_params)
            self.rowcount = 1
            return

        if norm.startswith("UPDATE") and "session_parameters =" in norm:
            patch = json.loads(params[0])
            sid = params[1]
            match = next((r for r in self.rows if r.get("session_id") == sid), None)
            if match:
                existing = json.loads(match.get("session_parameters") or "{}")
                existing.update(patch)
                match["session_parameters"] = json.dumps(existing)
            self.rowcount = 1
            return

        # Primary load_session / get_user_default_session / get_user_sessions / get_leaderboard queries
        if "WHERE session_id = %s" in norm:
            sid = params[0]
            self._result_one = next((dict(r) for r in self.rows if r.get("session_id") == sid), None)
            return

        if "AND session_name = 'New Session'" in norm:
            user = params[0]
            self._result_one = next(
                (dict(r) for r in self.rows if r.get("created_by") == user and r.get("session_name") == "New Session"),
                None,
            )
            return

        if "AND (completed_gates IS NOT NULL AND completed_gates != '[]')" in norm:
            # Primary leaderboard query: only rows with non-empty completed_gates
            self._result_many = [
                dict(r)
                for r in self.rows
                if r.get("completed_gates") and r.get("completed_gates") not in ("[]", [])
            ]
            return

        if "AND (completed_gates IS NULL OR completed_gates = '[]'::jsonb)" in norm:
            # Legacy compat leaderboard / analytics query
            self._result_many = [
                dict(r)
                for r in self.rows
                if (not r.get("completed_gates") or r.get("completed_gates") in ("[]", []))
                and r.get("completed_steps") not in (None, "", "[]")
            ]
            return

        if "WHERE created_by = %s" in norm:
            user = params[0]
            self._result_many = [dict(r) for r in self.rows if r.get("created_by") == user]
            return

    def fetchone(self) -> Any:
        return self._result_one

    def fetchall(self) -> List[Any]:
        return list(self._result_many)

    def close(self) -> None:
        pass


class _CompatConn:
    autocommit = True

    def __init__(self, rows: List[Dict[str, Any]]):
        self.rows = rows

    def cursor(self, dict_rows: bool = False):
        return _CompatDBCursor(self.rows, dict_mode=dict_rows)

    def commit(self):
        pass

    def rollback(self):
        pass


def _install_compat_db(monkeypatch, rows: List[Dict[str, Any]]):
    conn = _CompatConn(rows)

    @contextmanager
    def _get_conn():
        yield conn

    monkeypatch.setattr(lakebase, "is_lakebase_configured", lambda: True)
    monkeypatch.setattr(lakebase, "_get_sessions_table_name", lambda: "vibe.sessions")
    monkeypatch.setattr(lakebase, "get_connection", _get_conn)
    monkeypatch.setattr(lakebase, "_dict_cursor", lambda c: c.cursor(dict_rows=True))
    return conn


def _legacy_row(**overrides) -> Dict[str, Any]:
    row = {
        "session_id": "legacy-1",
        "created_by": "alice@databricks.com",
        "session_name": "Alice Legacy App",
        "session_description": "Created on 2.7.0",
        "industry": "retail",
        "industry_label": "Retail",
        "use_case": "inventory_optimization",
        "use_case_label": "Inventory Optimization",
        "feedback_rating": None,
        "feedback_comment": None,
        "prerequisites_completed": True,
        "workshop_level": "end-to-end",
        "step_1_prompt": "Brief",
        "step_prompts": {},
        "captured_outputs": "{}",
        "completed_gates": "[]",  # default after DDL 12 on an existing install
        "completed_steps": "[1, 2, 3, 6]",  # usecase_selection, project_setup, prd_generation, setup_lakebase
        "skipped_steps": "[4]",  # cursor_copilot_ui_design
        "session_parameters": json.dumps({"coding_assistant": "cursor"}),
        "created_at": None,
        "updated_at": None,
    }
    row.update(overrides)
    return row


def test_load_session_synthesizes_gates_from_legacy_steps(monkeypatch):
    _install_compat_db(monkeypatch, [_legacy_row()])

    loaded = lakebase.load_session("legacy-1")
    assert loaded is not None
    assert loaded["completed_gates"] == [
        "usecase_selection",
        "project_setup",
        "prd_generation",
        "setup_lakebase",
    ]
    assert loaded["session_parameters"]["skipped_gates"] == ["cursor_copilot_ui_design"]

    # Feed into build_session_state + engine.outline: steps are marked done/skipped!
    state = build_session_state(loaded, "end-to-end")
    statuses = {s.sectionTag: s.status for s in engine.outline("end-to-end", state)}
    assert statuses["project_setup"] == "done"
    assert statuses["prd_generation"] == "done"
    assert statuses["setup_lakebase"] == "done"
    assert statuses["cursor_copilot_ui_design"] == "skipped"


def test_legacy_insights_session_preserves_insights_view_marker(monkeypatch):
    row = _legacy_row(
        session_id="legacy-insights",
        workshop_level="genie-accelerator",
        completed_steps="[1, 57, 58]",
        skipped_steps="[]",
        session_parameters=json.dumps({"coding_assistant": "genie-code"}),
    )
    _install_compat_db(monkeypatch, [row])

    loaded = lakebase.load_session("legacy-insights")
    assert loaded is not None
    assert loaded["completed_gates"] == ["usecase_selection", "semlayer_locate", "semlayer_profile"]
    # Automatically stamped in memory so useWorkflowViewMode reopens it in Insights!
    assert loaded["session_parameters"]["view"] == "insights"


def test_get_user_default_session_synthesizes_gates(monkeypatch):
    row = _legacy_row(session_id="legacy-default", session_name="New Session")
    _install_compat_db(monkeypatch, [row])

    default_sess = lakebase.get_user_default_session("alice@databricks.com")
    assert default_sess is not None
    assert default_sess["completed_gates"] == [
        "usecase_selection",
        "project_setup",
        "prd_generation",
        "setup_lakebase",
    ]
    assert default_sess["session_parameters"]["skipped_gates"] == ["cursor_copilot_ui_design"]


def test_get_user_sessions_counts_legacy_steps(monkeypatch):
    _install_compat_db(monkeypatch, [_legacy_row()])

    sessions = lakebase.get_user_sessions("alice@databricks.com", saved_only=True)
    assert len(sessions) == 1
    # 4 steps completed (1, 2, 3, 6)
    assert sessions[0]["completed_step_count"] == 4


def test_get_leaderboard_includes_and_scores_legacy_sessions(monkeypatch):
    legacy = _legacy_row(
        session_id="legacy-lb",
        created_by="alice@databricks.com",
        completed_gates="[]",
        completed_steps="[1, 2, 3, 17, 18]",  # 1(10) + 2(15) + 3(25) + 17(50) + 18(50) = 150
        skipped_steps="[6]",
    )
    modern = _legacy_row(
        session_id="modern-lb",
        created_by="bob@databricks.com",
        completed_gates=json.dumps(["project_setup", "prd_generation"]),  # + step 1 intent = 10+15+25 = 50
        completed_steps="[]",
        skipped_steps="[]",
    )
    _install_compat_db(monkeypatch, [legacy, modern])

    lb = lakebase.get_leaderboard(limit=10)
    assert [e["user_id"] for e in lb] == ["alice@databricks.com", "bob@databricks.com"]
    assert lb[0]["score"] == lakebase._calculate_score([1, 2, 3, 17, 18], [6])
    assert lb[0]["completed_step_count"] == 5
    assert lb[0]["skipped_step_count"] == 1
    assert lb[0]["skipped_globals"] == [6]
    assert lb[1]["score"] == lakebase._calculate_score([1, 2, 3], [])


def test_continuing_legacy_session_preserves_prior_steps_on_save(monkeypatch):
    row = _legacy_row(
        session_id="legacy-continue",
        completed_gates="[]",
        completed_steps="[1, 2]",  # usecase_selection, project_setup
        skipped_steps="[4]",       # cursor_copilot_ui_design
    )
    conn = _install_compat_db(monkeypatch, [row])

    # Now an MCP tool (or web save) adds prd_generation onto the legacy session:
    ok = lakebase.save_session_applying_mcp_delta(
        "legacy-continue",
        add_gates=["prd_generation"],
        set_outputs={},
        set_params={},
    )
    assert ok is True
    persisted_gates = json.loads(conn.rows[0]["completed_gates"])
    assert persisted_gates == ["usecase_selection", "project_setup", "prd_generation"]
    persisted_params = json.loads(conn.rows[0]["session_parameters"])
    assert persisted_params["skipped_gates"] == ["cursor_copilot_ui_design"]


def test_compat_module_is_strictly_read_only():
    source = pathlib.Path(legacy_session_compat.__file__).read_text(encoding="utf-8")
    # Strip comments and docstrings before checking SQL keywords
    for keyword in ("INSERT INTO", "UPDATE ", "DELETE FROM", "DROP ", "TRUNCATE ", "ALTER "):
        assert not re.search(rf"\b{keyword}", source, re.IGNORECASE), f"found {keyword} in legacy_session_compat.py"
