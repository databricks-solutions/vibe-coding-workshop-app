"""Cross-surface resume: /session/{id} must forward the sectionTag-keyed
``completed_gates`` to the client.

The MCP/engine records progress as ``completed_gates`` (sectionTags) — the single
source of truth. The load response forwards that list verbatim; the App maps each
tag to its own fixed GLOBAL step number through its tag<->number bridge (e.g.
``semlayer_locate`` = 57). There are NO legacy step numbers in the contract: the
``completed_steps`` dual-write was retired in R4a (#70) and every read went
gates-only in R4b (#71), so ``SessionLoadResponse`` carries gates and nothing
numeric. These tests pin that passthrough (present + absent): it works only if
``lakebase.load_session`` returns ``completed_gates`` AND the
``SessionLoadResponse`` model forwards the field — the MCP->App deep-link resume.
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
        "completed_steps": [1, 2],  # retired legacy column; a decoy that must never surface
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
    # A legacy web session has no engine gates — the field must default to []. The
    # retired numeric completed_steps column is NOT read (R4b): there is no numeric
    # fallback, so an empty gate set hydrates no gate-derived progress.
    record = {
        "session_id": "legacy-sid",
        "completed_steps": [1, 2, 3],  # retired column; must be ignored
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
