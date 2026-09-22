"""Offline tests for Phase 2 MCP engine state persistence."""

import json
import unittest
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch

from src.backend.services import lakebase


class _FakeCursor:
    def __init__(self, row=None):
        self.row = row
        self.executions = []
        self.closed = False

    def execute(self, sql, params=None):
        self.executions.append((sql, params))

    def fetchone(self):
        return self.row

    def close(self):
        self.closed = True


class _FakeConnection:
    def __init__(self, row=None):
        self.cursor_for_dict = _FakeCursor(row=row)
        self.cursor_for_write = _FakeCursor()
        self.commits = 0

    def cursor(self, *args, **kwargs):
        return self.cursor_for_write

    def commit(self):
        self.commits += 1


class TestEngineStatePersistence(unittest.TestCase):
    def test_migration_is_idempotent_and_additive(self):
        ddl_path = (
            Path(__file__).resolve().parents[2]
            / "db"
            / "lakebase"
            / "ddl"
            / "12_mcp_engine_state.sql"
        )
        ddl = ddl_path.read_text()

        self.assertIn("ALTER TABLE ${schema}.sessions", ddl)
        self.assertIn("ADD COLUMN IF NOT EXISTS captured_outputs", ddl)
        self.assertIn("ADD COLUMN IF NOT EXISTS completed_gates", ddl)
        self.assertIn("CREATE TABLE IF NOT EXISTS ${schema}.session_interactions", ddl)
        self.assertIn("CREATE INDEX IF NOT EXISTS", ddl)
        self.assertNotIn("DROP TABLE", ddl.upper())
        self.assertNotIn("DROP COLUMN", ddl.upper())

        for statement in ddl.split(";"):
            normalized = " ".join(
                line.strip()
                for line in statement.splitlines()
                if line.strip() and not line.strip().startswith("--")
            ).upper()
            if normalized.startswith("CREATE "):
                self.assertIn("IF NOT EXISTS", normalized)
            if normalized.startswith("ALTER TABLE") and "ADD COLUMN" in normalized:
                self.assertIn("ADD COLUMN IF NOT EXISTS", normalized)

    def test_save_and_load_round_trip_legacy_and_engine_state(self):
        saved_connection = _FakeConnection()

        @contextmanager
        def saved_connection_context():
            yield saved_connection

        captured_outputs = {"semlayer_locate": "The semantic layer is in Unity Catalog."}
        completed_gates = ["semlayer_locate"]
        with patch.object(lakebase, "is_lakebase_configured", return_value=True), \
                patch.object(lakebase, "get_connection", saved_connection_context), \
                patch.object(lakebase, "get_schema", return_value="workshop"):
            self.assertTrue(
                lakebase.save_session(
                    session_id="session-1",
                    created_by="learner@example.com",
                    completed_steps=[1, 4],
                    captured_outputs=captured_outputs,
                    completed_gates=completed_gates,
                )
            )

        save_sql, save_params = saved_connection.cursor_for_write.executions[0]
        self.assertIn("completed_steps", save_sql)
        self.assertIn("captured_outputs", save_sql)
        self.assertIn("completed_gates", save_sql)
        self.assertIn(json.dumps(captured_outputs), save_params)
        self.assertIn(json.dumps(completed_gates), save_params)

        loaded_connection = _FakeConnection(
            row={
                "session_id": "session-1",
                "completed_steps": json.dumps([1, 4]),
                "skipped_steps": "[]",
                "step_prompts": {},
                "captured_outputs": json.dumps(captured_outputs),
                "completed_gates": json.dumps(completed_gates),
                "session_parameters": {},
            }
        )

        @contextmanager
        def loaded_connection_context():
            yield loaded_connection

        with patch.object(lakebase, "is_lakebase_configured", return_value=True), \
                patch.object(lakebase, "get_connection", loaded_connection_context), \
                patch.object(lakebase, "_dict_cursor", return_value=loaded_connection.cursor_for_dict), \
                patch.object(lakebase, "get_schema", return_value="workshop"):
            session = lakebase.load_session("session-1")

        self.assertEqual(session["completed_steps"], [1, 4])
        self.assertEqual(session["completed_gates"], completed_gates)
        self.assertEqual(session["captured_outputs"], captured_outputs)

    def test_append_session_interaction_writes_one_provenance_row(self):
        connection = _FakeConnection()

        @contextmanager
        def connection_context():
            yield connection

        with patch.object(lakebase, "is_lakebase_configured", return_value=True), \
                patch.object(lakebase, "get_connection", connection_context), \
                patch.object(lakebase, "get_schema", return_value="workshop"):
            self.assertTrue(
                lakebase.append_session_interaction(
                    session_id="session-1",
                    section_tag="semlayer_locate",
                    interaction_id="semlayer_locate.why",
                    kind="comprehension",
                    answer="uc",
                    recommended="uc",
                    was_default=True,
                    coaching_shown="Use Unity Catalog.",
                )
            )

        self.assertEqual(len(connection.cursor_for_write.executions), 1)
        sql, params = connection.cursor_for_write.executions[0]
        self.assertIn("INSERT INTO workshop.session_interactions", sql)
        self.assertIn("created_at", sql)
        self.assertEqual(
            params,
            (
                "session-1",
                "semlayer_locate",
                "semlayer_locate.why",
                "comprehension",
                "uc",
                "uc",
                True,
                "Use Unity Catalog.",
                "mcp",
            ),
        )
        self.assertEqual(connection.commits, 1)

    def test_load_defaults_new_state_for_legacy_row(self):
        connection = _FakeConnection(
            row={
                "session_id": "legacy-session",
                "completed_steps": "[2]",
                "skipped_steps": "[]",
                "step_prompts": {},
                "session_parameters": {},
                "captured_outputs": None,
                "completed_gates": None,
            }
        )

        @contextmanager
        def connection_context():
            yield connection

        with patch.object(lakebase, "is_lakebase_configured", return_value=True), \
                patch.object(lakebase, "get_connection", connection_context), \
                patch.object(lakebase, "_dict_cursor", return_value=connection.cursor_for_dict), \
                patch.object(lakebase, "get_schema", return_value="workshop"):
            session = lakebase.load_session("legacy-session")

        self.assertEqual(session["captured_outputs"], {})
        self.assertEqual(session["completed_gates"], [])


if __name__ == "__main__":
    unittest.main()
