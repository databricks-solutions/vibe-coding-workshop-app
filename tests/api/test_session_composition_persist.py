"""Phase 3 T3b-2a — the session write paths persist the engine's composition
inputs into ``session_parameters`` so ``GET /api/track/{track}/outline`` composes
the same variant / sub-toggle outline the UI shows.

Round-trip proof (non-hollow): POST the write endpoint carrying ``chain_context``
+ ``flags`` -> capture the exact JSONB patch the handler merges -> feed that patch
back through ``build_session_state`` + ``engine.outline`` and assert the composed
outline actually changed (variant selected / sub-toggle steps dropped). The engine
reads ``chainContext`` top-level (``engine._inputs_for``) and the flags under a
nested ``flags`` object (``engine._flags_for``), so the handler must write exactly
those keys.

FAIL-BEFORE: prior to T3b-2a, ``chain_context`` / ``flags`` are not fields on
``SessionUpdateMetadataRequest`` / ``SessionSaveRequest``; Pydantic drops the extra
body keys, so the captured patch never contains ``chainContext`` / ``flags`` and the
first assertion in each round-trip test fails.

All offline: the FastAPI router is mounted on a bare app, and the session DB
functions (``save_session``, ``execute_insert``, ``get_schema``) are monkeypatched —
no live Lakebase. The JSONB ``||`` merge is a shallow top-level merge, mirrored here
by a dict update.
"""

import json

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

from src.backend.api import routes
from src.backend.workshop import engine
from src.backend.workshop.state import build_session_state


class _WriteCapture:
    """Captures the session_parameters JSONB patch each write endpoint merges."""

    def __init__(self):
        self.patches: list[dict] = []

    def execute_insert(self, sql, params=None):
        # The composition merge is the statement that ORs a JSON blob into
        # session_parameters; ignore any other write (e.g. derived schema prefix).
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
    capture = _WriteCapture()
    monkeypatch.setattr(routes, "save_session", lambda *a, **k: True)
    monkeypatch.setattr(routes, "execute_insert", capture.execute_insert)
    monkeypatch.setattr(routes, "get_schema", lambda: "test_schema")

    app = FastAPI()
    app.include_router(routes.router, prefix="/api")
    test_client = TestClient(app)
    test_client.capture = capture  # type: ignore[attr-defined]
    return test_client


def _merge(patch: dict, existing: dict | None = None) -> dict:
    """Mirror the Postgres JSONB ``||`` shallow top-level merge."""

    return {**(existing or {}), **patch}


def _outline_tags(track: str, session_parameters: dict) -> list[str]:
    record = {"completed_gates": [], "session_parameters": session_parameters}
    state = build_session_state(record, track)
    return [item.sectionTag for item in engine.outline(track, state)]


def _default_tags(track: str) -> list[str]:
    return [item.sectionTag for item in engine.outline(track, engine.SessionState())]


# --- update-metadata round-trips ---------------------------------------------


def test_update_metadata_persists_chain_context_and_composes_variant(client):
    # `chainContext: app` selects the lakehouse track's app-climb variant.
    resp = client.post(
        "/api/session/update-metadata",
        json={"session_id": "s1", "chain_context": "app"},
    )
    assert resp.status_code == 200, resp.text

    patch = client.capture.last_patch
    assert patch.get("chainContext") == "app"  # FAILS before T3b-2a (field dropped)

    composed = _outline_tags("lakehouse", _merge(patch))
    assert composed != _default_tags("lakehouse"), (
        "persisted chainContext did not select a different (app-climb) variant"
    )


def test_update_metadata_persists_flags_and_drops_subtoggle_steps(client):
    flags = {"ai.genie": False, "ai.agent": False, "ai.dashboard": False}
    resp = client.post(
        "/api/session/update-metadata",
        json={"session_id": "s1", "flags": flags},
    )
    assert resp.status_code == 200, resp.text

    patch = client.capture.last_patch
    assert patch.get("flags") == flags  # FAILS before T3b-2a (field dropped)

    composed = set(_outline_tags("end-to-end", _merge(patch)))
    default = set(_default_tags("end-to-end"))
    assert composed < default, (
        "turning off ai.* flags should drop those steps from the composed outline"
    )


def test_update_metadata_leaves_snake_case_keys_intact(client):
    """Additive: the existing snake_case direction/include_* keys still persist
    alongside the new composition keys (other consumers depend on them)."""

    resp = client.post(
        "/api/session/update-metadata",
        json={
            "session_id": "s1",
            "direction": "reverse",
            "include_lakehouse": True,
            "chain_context": "reverse",
            "flags": {"includeLakehouse": True},
        },
    )
    assert resp.status_code == 200, resp.text

    patch = client.capture.last_patch
    assert patch.get("direction") == "reverse"
    assert patch.get("include_lakehouse") is True
    assert patch.get("chainContext") == "reverse"
    assert patch.get("flags") == {"includeLakehouse": True}


# --- save round-trip ----------------------------------------------------------


def test_save_session_persists_composition_inputs(client):
    flags = {"medallion.bronze": True, "medallion.silver": False, "medallion.gold": False}
    resp = client.post(
        "/api/session/save",
        json={
            "session_id": "s1",
            "current_step": 1,
            "completed_steps": [],
            "step_prompts": {},
            "chain_context": "app",
            "flags": flags,
        },
    )
    assert resp.status_code == 200, resp.text

    patch = client.capture.last_patch
    assert patch.get("chainContext") == "app"  # FAILS before T3b-2a
    assert patch.get("flags") == flags

    # Read-back: silver/gold off should shorten the accelerator medallion outline.
    composed = set(_outline_tags("accelerator", _merge(patch)))
    default = set(_default_tags("accelerator"))
    assert composed < default


# --- guardrail: default (no composition keys) still round-trips unchanged -----


def test_default_genie_resume_outline_unchanged_without_composition_keys():
    """A default genie-accelerator session (no persisted composition keys) must
    still compose the plain default outline — T3b-2a only ADDS optional keys."""

    assert _outline_tags("genie-accelerator", {}) == _default_tags("genie-accelerator")
