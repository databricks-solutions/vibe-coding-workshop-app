"""Read-side surfacing of ``skipped_gates`` (Phase 3 T5 PR3b′, closes R2).

The SPA dual-writes ``skipped_gates`` (sectionTags) alongside the legacy integer
``skipped_steps`` (PR3a), persisting the gates under
``session_parameters['skipped_gates']`` — NOT a top-level column like
``completed_gates``. Before this PR the load response surfaced ``completed_gates``
(so completed hydration was gate-first) but never surfaced ``skipped_gates``, so
the App could only read the raw integer ``skipped_steps``. These tests pin the
now-symmetric passthrough: the load endpoints lift ``skipped_gates`` out of
``session_parameters`` onto the top-level ``SessionLoadResponse.skipped_gates``
field (present + absent), which is what lets the App hydrate skipped steps
gate-first via the same tag→number bridge it uses for completed steps.
"""

import asyncio
import pathlib
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.api import routes


def test_load_session_endpoint_surfaces_skipped_gates_from_session_parameters(monkeypatch):
    # skipped_gates lives in session_parameters (where the write path patches it),
    # NOT a top-level column — the load response must lift it out.
    record = {
        "session_id": "skip-gates-sid",
        "completed_steps": [1, 2],
        "completed_gates": ["project_setup", "prd_generation"],
        "skipped_steps": [],  # skipped-only-via-gates: no legacy numbers
        "session_parameters": {
            "coding_assistant": "genie-code",
            "skipped_gates": ["semlayer_locate", "semlayer_profile"],
        },
        "is_saved": True,
    }
    monkeypatch.setattr(routes, "load_session", lambda sid: dict(record))

    result = asyncio.run(routes.load_session_endpoint("skip-gates-sid"))

    assert result.success is True
    # The skipped sectionTags are forwarded verbatim so the App can map them to
    # global step numbers (symmetric to completed_gates).
    assert result.skipped_gates == ["semlayer_locate", "semlayer_profile"]
    # The raw numbers store is empty for this gate-only session — proving the App
    # would render NO skips if it kept reading skipped_steps alone.
    assert result.skipped_steps == []


def test_load_session_endpoint_defaults_skipped_gates_empty_for_legacy_sessions(monkeypatch):
    # A legacy web session has no skipped_gates in session_parameters — the field
    # must default to [] so the App falls back to the stored integer skipped_steps.
    record = {
        "session_id": "legacy-skip-sid",
        "completed_steps": [1, 2, 3],
        "skipped_steps": [2],
        "session_parameters": {"coding_assistant": "cursor"},
        "is_saved": True,
    }
    monkeypatch.setattr(routes, "load_session", lambda sid: dict(record))

    result = asyncio.run(routes.load_session_endpoint("legacy-skip-sid"))

    assert result.success is True
    assert result.skipped_gates == []
    assert result.skipped_steps == [2]


def test_load_session_endpoint_defaults_skipped_gates_empty_when_no_session_parameters(monkeypatch):
    # session_parameters entirely absent must not blow up — defaults to [].
    record = {
        "session_id": "no-params-sid",
        "completed_steps": [1],
        "skipped_steps": [],
        "is_saved": True,
    }
    monkeypatch.setattr(routes, "load_session", lambda sid: dict(record))

    result = asyncio.run(routes.load_session_endpoint("no-params-sid"))

    assert result.success is True
    assert result.skipped_gates == []


def test_default_session_endpoint_surfaces_skipped_gates_from_session_parameters(monkeypatch):
    # The second real construction site: get_or_create_default_session (the
    # unsaved "continue where you left off" path) must surface skipped_gates too.
    record = {
        "session_id": "default-skip-sid",
        "current_step": 5,
        "completed_steps": [1, 2],
        "completed_gates": ["project_setup", "prd_generation"],
        "skipped_steps": [],
        "session_parameters": {"skipped_gates": ["semlayer_measures"]},
        "prerequisites_completed": True,
    }
    monkeypatch.setattr(routes, "_get_session_user", lambda request: "user@example.com")
    monkeypatch.setattr(routes, "get_user_default_session", lambda created_by: dict(record))
    monkeypatch.setattr(routes, "delete_user_unsaved_sessions", lambda *a, **k: 0)

    result = asyncio.run(routes.get_or_create_default_session(request=object()))

    assert result.success is True
    assert result.skipped_gates == ["semlayer_measures"]
    assert result.skipped_steps == []
