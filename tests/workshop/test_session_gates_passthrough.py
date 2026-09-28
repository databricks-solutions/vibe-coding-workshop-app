"""Cross-surface resume: /session/{id} must forward the sectionTag-keyed
``completed_gates`` to the client.

The MCP/engine records progress as ``completed_gates`` (sectionTags) and, via the
sync bridge, ALSO as legacy ``completed_steps`` — but those legacy ints are dense
positions in the backend track outline, which do NOT line up with the frontend's
fixed global step numbers (e.g. ``semlayer_locate`` = 57). The App therefore
resumes off the sectionTags, mapping them to global numbers through its own
registry. That only works if the load endpoint actually surfaces
``completed_gates``; ``lakebase.load_session`` returns them, but the
``SessionLoadResponse`` model must carry them through. These tests pin that
passthrough (present + absent), the fix for the MCP->App deep-link resume.
"""

import asyncio
import pathlib
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.api import routes


def test_load_session_endpoint_forwards_completed_gates(monkeypatch):
    record = {
        "session_id": "gates-sid",
        "completed_steps": [1, 2],  # legacy dense positions (backend track order)
        "completed_gates": ["project_setup", "prd_generation", "semlayer_locate"],
        "session_parameters": {"coding_assistant": "genie-code"},
        "is_saved": True,
    }
    monkeypatch.setattr(routes, "load_session", lambda sid: dict(record))

    result = asyncio.run(routes.load_session_endpoint("gates-sid"))

    assert result.success is True
    # The sectionTag source of truth is forwarded verbatim, so the App can map it
    # to its own global step numbers (the legacy completed_steps ints cannot).
    assert result.completed_gates == [
        "project_setup",
        "prd_generation",
        "semlayer_locate",
    ]


def test_load_session_endpoint_defaults_gates_empty_for_legacy_sessions(monkeypatch):
    # A legacy web session has no engine gates — the field must default to [] so
    # the App falls back to the stored integer completed_steps.
    record = {
        "session_id": "legacy-sid",
        "completed_steps": [1, 2, 3],
        "is_saved": True,
    }
    monkeypatch.setattr(routes, "load_session", lambda sid: dict(record))

    result = asyncio.run(routes.load_session_endpoint("legacy-sid"))

    assert result.success is True
    assert result.completed_gates == []


def test_load_session_endpoint_coerces_null_boolean_columns(monkeypatch):
    # MCP-created sessions can persist NULL for the BOOLEAN columns
    # ``prerequisites_completed`` / ``is_saved``. Pydantic v2's strict bool
    # rejects None, which 500s the load endpoint; the SPA then silently falls
    # back to the default (end-to-end) session — the true cause of the "0/28"
    # resume defect. The model must coerce None -> False so the resume succeeds
    # and reaches the level resolver.
    record = {
        "session_id": "mcp-null-prereq",
        "completed_steps": [1, 2, 3],
        "completed_gates": ["project_setup", "use_case_selection", "prd_generation"],
        "session_parameters": {"coding_assistant": "genie-code"},
        "workshop_level": None,
        "prerequisites_completed": None,  # NULL in Lakebase for MCP sessions
        "is_saved": None,
    }
    monkeypatch.setattr(routes, "load_session", lambda sid: dict(record))

    # Before the fix this raised a validation error (surfaced as HTTP 500).
    result = asyncio.run(routes.load_session_endpoint("mcp-null-prereq"))

    assert result.success is True
    assert result.prerequisites_completed is False
    assert result.is_saved is False
    # The genie gates still forward so the App can map them to global numbers.
    assert result.completed_gates == [
        "project_setup",
        "use_case_selection",
        "prd_generation",
    ]
