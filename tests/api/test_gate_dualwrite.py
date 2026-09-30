"""Phase 3 T5 PR3a — SPA gate DUAL-WRITE: the session write endpoints accept and
persist ``completed_gates`` / ``skipped_gates`` ALONGSIDE the legacy
``completed_steps`` / ``skipped_steps`` numbers (the EXPAND phase of
expand-migrate-contract).

What this proves (backend accept + persist side):
- ``completed_gates`` threads into the ``save_session(...)`` call so it lands in
  the existing ``completed_gates`` column (COALESCE-preserved when absent).
- ``skipped_gates`` is merged into the ``session_parameters`` JSONB under the key
  the READ side consumes (``state.build_session_state`` reads
  ``session_parameters['skipped_gates']``; ``engine._skipped_tags`` reads it too).
- The legacy number columns are STILL written (dual-write, not a cutover).

FAIL-BEFORE: prior to PR3a, ``completed_gates`` / ``skipped_gates`` are not fields
on ``SessionSaveRequest`` / ``SessionUpdateMetadataRequest``; Pydantic drops the
extra body keys, so ``save_session`` never receives ``completed_gates`` and the
JSONB patch never contains ``skipped_gates`` — both assertions fail.

All offline: the FastAPI router is mounted on a bare app; ``save_session``,
``execute_insert`` and ``get_schema`` are monkeypatched — no live Lakebase. The
JSONB ``||`` merge is a shallow top-level merge, so a captured patch dict mirrors
what Postgres would store.
"""

import json

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

from src.backend.api import routes


class _SaveCapture:
    """Captures the kwargs of each ``save_session`` call the endpoint makes."""

    def __init__(self):
        self.calls: list[dict] = []

    def save_session(self, *args, **kwargs):
        self.calls.append(kwargs)
        return True

    @property
    def last(self) -> dict:
        assert self.calls, "save_session was never called"
        return self.calls[-1]


class _ParamCapture:
    """Captures the session_parameters JSONB patch each endpoint merges."""

    def __init__(self):
        self.patches: list[dict] = []

    def execute_insert(self, sql, params=None):
        if params and isinstance(sql, str) and "session_parameters" in sql and "||" in sql:
            try:
                self.patches.append(json.loads(params[0]))
            except (TypeError, ValueError, IndexError):
                pass
        return True

    @property
    def last_patch(self) -> dict:
        assert self.patches, "no session_parameters patch was written"
        return self.patches[-1]


@pytest.fixture
def client(monkeypatch):
    saves = _SaveCapture()
    params = _ParamCapture()
    monkeypatch.setattr(routes, "save_session", saves.save_session)
    monkeypatch.setattr(routes, "execute_insert", params.execute_insert)
    monkeypatch.setattr(routes, "execute_query", lambda *a, **k: [])
    monkeypatch.setattr(routes, "get_schema", lambda: "test_schema")

    app = FastAPI()
    app.include_router(routes.router, prefix="/api")
    test_client = TestClient(app)
    test_client.save_capture = saves  # type: ignore[attr-defined]
    test_client.param_capture = params  # type: ignore[attr-defined]
    return test_client


# --- update-metadata (the progress-update path) ------------------------------


def test_update_metadata_dual_writes_completed_gates_and_skipped_gates(client):
    resp = client.post(
        "/api/session/update-metadata",
        json={
            "session_id": "s1",
            "completed_steps": [2, 3, 4],
            "skipped_steps": [6],
            "completed_gates": ["project_setup", "prd_generation", "cursor_copilot_ui_design"],
            "skipped_gates": ["setup_lakebase"],
        },
    )
    assert resp.status_code == 200, resp.text

    # completed_gates threads into save_session (-> completed_gates column).
    save = client.save_capture.last
    assert save.get("completed_gates") == [
        "project_setup",
        "prd_generation",
        "cursor_copilot_ui_design",
    ]  # FAILS before PR3a (field dropped -> None/absent)

    # The legacy numbers are STILL written (dual-write, not a cutover).
    assert sorted(save.get("completed_steps") or []) == [2, 3, 4]
    assert (save.get("skipped_steps") or []) == [6]

    # skipped_gates lands in the session_parameters JSONB (where the read side
    # consumes it: state.build_session_state / engine._skipped_tags).
    patch = client.param_capture.last_patch
    assert patch.get("skipped_gates") == ["setup_lakebase"]  # FAILS before PR3a


def test_update_metadata_omitting_gates_preserves_existing(client):
    """A partial metadata update (no gate fields) must NOT touch gates: it passes
    ``completed_gates=None`` (COALESCE-preserved) and writes no ``skipped_gates``
    into the JSONB patch."""
    resp = client.post(
        "/api/session/update-metadata",
        json={"session_id": "s1", "industry": "retail"},
    )
    assert resp.status_code == 200, resp.text

    assert client.save_capture.last.get("completed_gates") is None
    # No skipped_gates key written when the request carried none.
    assert all("skipped_gates" not in p for p in client.param_capture.patches)


# --- full save path ----------------------------------------------------------


def test_save_session_dual_writes_gates(client):
    resp = client.post(
        "/api/session/save",
        json={
            "session_id": "s1",
            "current_step": 4,
            "completed_steps": [2, 3, 4],
            "step_prompts": {},
            "completed_gates": ["project_setup", "prd_generation", "cursor_copilot_ui_design"],
            "skipped_gates": ["setup_lakebase"],
        },
    )
    assert resp.status_code == 200, resp.text

    save = client.save_capture.last
    assert save.get("completed_gates") == [
        "project_setup",
        "prd_generation",
        "cursor_copilot_ui_design",
    ]  # FAILS before PR3a
    assert sorted(save.get("completed_steps") or []) == [2, 3, 4]  # legacy still written

    patch = client.param_capture.last_patch
    assert patch.get("skipped_gates") == ["setup_lakebase"]  # FAILS before PR3a


def test_save_session_empty_gates_is_a_complete_empty_set(client):
    """A save with no completions carries an empty (complete) gate set — the SPA
    is authoritative on a full save, so empty means genuinely no completions."""
    resp = client.post(
        "/api/session/save",
        json={
            "session_id": "s1",
            "current_step": 1,
            "completed_steps": [],
            "step_prompts": {},
        },
    )
    assert resp.status_code == 200, resp.text
    # Defaulted to the empty complete set (not None) on the full-save path.
    assert client.save_capture.last.get("completed_gates") == []
