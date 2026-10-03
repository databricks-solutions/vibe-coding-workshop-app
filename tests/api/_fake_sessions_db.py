"""In-memory stand-in for the Lakebase ``sessions`` row behind
``lakebase.get_connection`` — offline, no psycopg.

It understands exactly the statements the session write path issues:

- ``SELECT completed_gates, session_parameters ... FOR UPDATE`` (the locked
  read in ``save_session_merging_gates``) -> a positional tuple;
- the unlocked ``load_session`` SELECT (dict rows, via a patched
  ``_dict_cursor``) -> a dict;
- the ``_session_upsert`` INSERT ... ON CONFLICT -> COALESCE-applied to the row;
- the ``session_parameters || %s::jsonb`` patch -> shallow-merged.

``interleave`` models a concurrent writer (an MCP gate write) landing during the
App's read-modify-write. A real ``FOR UPDATE`` makes that writer wait for the
lock, so it is applied BEFORE the locked read returns (the read sees it). An
unlocked read cannot hold the writer off, so it is applied AFTER the snapshot is
taken (the stale-read window the race lives in).
"""

import json
import time
from contextlib import contextmanager

UPSERT_COLUMNS = (
    "session_id", "created_by",
    "session_name", "session_description",
    "industry", "industry_label", "use_case", "use_case_label",
    "feedback_rating", "feedback_comment", "feedback_request_followup",
    "step_1_prompt", "step_prompts",
    "prerequisites_completed", "workshop_level",
    "captured_outputs", "completed_gates", "session_parameters",
    "created_at", "updated_at",
)
_JSON_COLUMNS = ("step_prompts", "captured_outputs", "completed_gates", "session_parameters")


def mcp_resolves_use_case(row: dict) -> None:
    """An MCP write that resolves the non-representable ``use_case_selection``
    gate (vibe_set_parameters / vibe_start_track pre-journey resolution)."""
    gates = row.setdefault("completed_gates", [])
    if "use_case_selection" not in gates:
        gates.append("use_case_selection")


class FakeSessionsDB:
    def __init__(self):
        self.row: dict | None = None
        self.interleave = None  # callable(row) fired once, on the first read
        self.read_delay = 0.0  # seconds the read blocks (off-loop tests)
        self.connections: list["FakeConn"] = []
        self.events: list[tuple] = []  # (conn_index, kind)
        self.upserts: list[dict] = []
        self.param_patches: list[dict] = []
        self.fail_on: str | None = None  # "upsert" => the upsert raises

    @contextmanager
    def get_connection(self):
        conn = FakeConn(self, len(self.connections))
        self.connections.append(conn)
        yield conn

    def _fire_interleave(self):
        if self.interleave is not None and self.row is not None:
            hook, self.interleave = self.interleave, None
            hook(self.row)


class FakeConn:
    def __init__(self, db: FakeSessionsDB, index: int):
        self.db = db
        self.index = index
        self.autocommit = True  # the autoscaling pool's mode
        self.autocommit_during: list[bool] = []
        self.commits = 0
        self.rollbacks = 0

    def cursor(self, dict_rows: bool = False, **_kwargs):
        return FakeCursor(self, dict_rows)

    def commit(self):
        self.commits += 1
        self.db.events.append((self.index, "commit"))

    def rollback(self):
        self.rollbacks += 1
        self.db.events.append((self.index, "rollback"))


class FakeCursor:
    def __init__(self, conn: FakeConn, dict_rows: bool):
        self.conn = conn
        self.db = conn.db
        self.dict_rows = dict_rows
        self._result = None
        self.rowcount = 0

    def execute(self, sql, params=None):
        db = self.db
        text = " ".join(sql.split())
        self.conn.autocommit_during.append(self.conn.autocommit)
        if text.startswith("SELECT") and "FOR UPDATE" in text:
            db.events.append((self.conn.index, "lock_read"))
            if db.read_delay:
                time.sleep(db.read_delay)
            db._fire_interleave()  # the lock serialises the writer: read sees it
            row = db.row
            self._result = (
                None if row is None
                else (json.dumps(row.get("completed_gates")), row.get("session_parameters"))
            )
        elif text.startswith("SELECT"):
            db.events.append((self.conn.index, "read"))
            row = db.row
            self._result = None if row is None else {
                **{c: None for c in UPSERT_COLUMNS},
                **json.loads(json.dumps(row)),
            }
            db._fire_interleave()  # unlocked: the writer lands after the snapshot
        elif text.startswith("INSERT INTO"):
            db.events.append((self.conn.index, "upsert"))
            if db.fail_on == "upsert":
                raise RuntimeError("simulated upsert failure")
            values = dict(zip(UPSERT_COLUMNS, params))
            for col in _JSON_COLUMNS:
                if values[col] is not None:
                    values[col] = json.loads(values[col])
            db.upserts.append(values)
            if db.row is None:
                db.row = {"completed_gates": None, "session_parameters": None}
            for col in ("completed_gates", "session_parameters", "captured_outputs"):
                if values[col] is not None:  # COALESCE(EXCLUDED.x, table.x)
                    db.row[col] = values[col]
            self.rowcount = 1
        elif text.startswith("UPDATE") and "session_parameters" in text and "||" in text:
            db.events.append((self.conn.index, "param_patch"))
            patch = json.loads(params[0])
            db.param_patches.append(patch)
            if db.row is not None:
                db.row["session_parameters"] = {**(db.row.get("session_parameters") or {}), **patch}
            self.rowcount = 1
        else:
            raise AssertionError(f"unexpected SQL in fake: {text[:80]}")

    def fetchone(self):
        return self._result

    def close(self):
        pass


def install(monkeypatch, db: FakeSessionsDB) -> None:
    """Point the real lakebase session functions at ``db``."""
    from src.backend.services import lakebase

    monkeypatch.setattr(lakebase, "is_lakebase_configured", lambda: True)
    monkeypatch.setattr(lakebase, "get_connection", db.get_connection)
    monkeypatch.setattr(lakebase, "get_schema", lambda: "test_schema")
    monkeypatch.setattr(lakebase, "_dict_cursor", lambda conn: conn.cursor(dict_rows=True))
