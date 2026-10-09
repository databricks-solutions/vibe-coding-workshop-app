"""Phase 3 T5 R4a — OLD-CLIENT COMPATIBILITY of the session write endpoints.

R4a removes ``current_step`` / ``completed_steps`` / ``skipped_steps`` from
``SessionSaveRequest`` and ``SessionUpdateMetadataRequest``. The deploy is not
atomic: an older SPA tab (served before R4a) keeps POSTing those legacy fields.
Pydantic v2's DEFAULT ``extra='ignore'`` must silently drop them — no 422, no
500, and crucially they must NOT be forwarded to ``save_session`` (which no
longer accepts them — a forward would be a TypeError).

What this pins:
- A full legacy payload (all three numbers + gates) → 200, the gates persist, and
  the captured ``save_session`` call carries NONE of the legacy kwargs.
- A legacy-ONLY payload (the three numbers, no gates) → 200 and NO progress is
  written (proves the fields are ignored, not translated into a gate/number write).
- Neither request model sets ``model_config = {'extra': 'forbid'}``, so a future
  change can't silently turn "ignore" into "reject".

TAMPER (both directions): set ``extra='forbid'`` on either model → the legacy POST
returns 422 and ``test_*_200_with_legacy_fields_ignored`` fails; restore the
default → 200 and it passes.

All offline: the router mounts on a bare app; ``save_session`` / ``load_session``
/ ``execute_insert`` / ``get_schema`` are monkeypatched — no live Lakebase. Gate-
carrying requests run the real ``save_session_merging_gates`` against the
in-memory ``_fake_sessions_db`` row.
"""

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

from src.backend.api import routes

from _fake_sessions_db import FakeSessionsDB, install

_LEGACY_FIELDS = ("current_step", "completed_steps", "skipped_steps")


class _SaveCapture:
    def __init__(self):
        self.calls: list[dict] = []

    def save_session(self, *args, **kwargs):
        self.calls.append(kwargs)
        return True

    @property
    def last(self) -> dict:
        assert self.calls, "save_session was never called"
        return self.calls[-1]


@pytest.fixture
def client(monkeypatch):
    saves = _SaveCapture()
    db = FakeSessionsDB()  # gate-carrying saves run the real locked merge against it
    install(monkeypatch, db)
    monkeypatch.setattr(routes, "save_session", saves.save_session)
    monkeypatch.setattr(routes, "load_session", lambda *a, **k: None)
    monkeypatch.setattr(routes, "execute_insert", lambda *a, **k: True)
    monkeypatch.setattr(routes, "execute_query", lambda *a, **k: [])
    monkeypatch.setattr(routes, "get_schema", lambda: "test_schema")

    app = FastAPI()
    app.include_router(routes.router, prefix="/api")
    test_client = TestClient(app)
    test_client.save_capture = saves  # type: ignore[attr-defined]
    test_client.db = db  # type: ignore[attr-defined]
    return test_client


# --- full legacy payload (numbers + gates) is accepted; numbers ignored -------


def test_save_200_with_legacy_fields_ignored(client):
    resp = client.post(
        "/api/session/save",
        json={
            "session_id": "s1",
            # Legacy number fields an old tab still sends — must be ignored.
            "current_step": 4,
            "completed_steps": [2, 3, 4],
            "skipped_steps": [6],
            "step_prompts": {},
            # The gate fields the current client sends.
            "completed_gates": ["project_setup", "prd_generation"],
            "skipped_gates": ["setup_lakebase"],
        },
    )
    assert resp.status_code == 200, resp.text

    save = client.db.upserts[-1]
    # Gates still persist...
    assert save.get("completed_gates") == ["project_setup", "prd_generation"]
    # ...and none of the legacy numbers reached save_session.
    for field in _LEGACY_FIELDS:
        assert field not in save, f"{field} must not be forwarded to save_session"


def test_update_metadata_200_with_legacy_fields_ignored(client):
    resp = client.post(
        "/api/session/update-metadata",
        json={
            "session_id": "s1",
            "current_step": 4,
            "completed_steps": [2, 3, 4],
            "skipped_steps": [6],
            "completed_gates": ["project_setup", "prd_generation"],
            "skipped_gates": ["setup_lakebase"],
        },
    )
    assert resp.status_code == 200, resp.text

    save = client.db.upserts[-1]
    assert save.get("completed_gates") == ["project_setup", "prd_generation"]
    for field in _LEGACY_FIELDS:
        assert field not in save, f"{field} must not be forwarded to save_session"


# --- legacy-ONLY payload (no gates) → 200 and NO progress written -------------


def test_save_legacy_only_payload_writes_no_progress(client):
    """Only the three legacy numbers, no gate fields: 200, and the save carries
    neither the legacy numbers (ignored) nor any gate (COALESCE-preserve => None),
    proving the fields are dropped, not translated into a progress write."""
    resp = client.post(
        "/api/session/save",
        json={
            "session_id": "s1",
            "current_step": 4,
            "completed_steps": [2, 3, 4],
            "skipped_steps": [6],
            "step_prompts": {},
        },
    )
    assert resp.status_code == 200, resp.text

    save = client.save_capture.last
    for field in _LEGACY_FIELDS:
        assert field not in save
    # No gate write either (absent => None => COALESCE preserves existing).
    assert save.get("completed_gates") is None


def test_update_metadata_legacy_only_payload_writes_no_progress(client):
    resp = client.post(
        "/api/session/update-metadata",
        json={
            "session_id": "s1",
            "current_step": 4,
            "completed_steps": [2, 3, 4],
            "skipped_steps": [6],
        },
    )
    assert resp.status_code == 200, resp.text

    save = client.save_capture.last
    for field in _LEGACY_FIELDS:
        assert field not in save
    assert save.get("completed_gates") is None


# --- guard: the models must stay extra='ignore', never 'forbid' ---------------


def test_request_models_do_not_forbid_extras():
    """A future ``extra='forbid'`` would turn the silent-ignore above into a 422
    for every old tab. Pin both models to the default (ignore)."""
    for model in (routes.SessionSaveRequest, routes.SessionUpdateMetadataRequest):
        assert model.model_config.get("extra") != "forbid", (
            f"{model.__name__} must not set extra='forbid' (breaks old-client compat)"
        )
