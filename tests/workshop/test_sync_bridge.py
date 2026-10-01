"""Phase 3 T5 R4a — cross-surface step sync rides on ``completed_gates`` ALONE.

History: the sync bridge (D11 §4.3) used to DUAL-WRITE the legacy SPA progress
model (``current_step`` INT + ``completed_steps`` int-list) alongside the engine's
``completed_gates`` so an MCP-driven (Genie Code) session showed up in the SPA
step indicator. T5 migrated the SPA/analytics read path to be gate-first, so the
numbers became redundant. R4a STOPS writing them (expand → migrate → *contract*).

What this file now proves:

- **No legacy writes.** ``vibe_complete_step`` and the ``vibe_set_parameters``
  pre-journey lock call ``save_session`` with ``completed_gates`` (+
  ``captured_outputs``) and NO ``current_step`` / ``completed_steps`` /
  ``skipped_steps`` kwargs. (The ``save_session`` signature no longer even
  accepts them — a stray kwarg would be a ``TypeError``.)
- **Cross-surface visibility survives on gates (R4a required test 3).** A legacy
  ``get_user_default_session`` read of the same row surfaces the MCP-driven
  ``completed_gates``; the SPA maps those tags to the correct GLOBAL step numbers
  via ``manifest.step_number_to_tag()`` (the inverse the frontend
  ``completedGatesToStepNumbers`` uses). The matching frontend half is
  ``tests/frontend/deriveCompletedStepNumbers.node.test.ts``.
- **Idempotent replay.** Completing a section twice never duplicates
  ``completed_gates`` and still writes no legacy numbers.
- **No regression.** The ``captured_outputs`` / ``completed_gates`` writes and the
  locked ``session_parameters`` are preserved by the same save.
"""

import copy
import inspect
import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.services import lakebase as lakebase_service
from src.backend.workshop import manifest

SESSION_ID = "sync-bridge-session"
TRACK = "genie-accelerator"
USER = "learner@example.com"

# The three legacy number columns R4a stopped writing. A write path must never
# pass these to save_session again.
_LEGACY_KWARGS = ("current_step", "completed_steps", "skipped_steps")


def _global_numbers(completed_gates: list[str]) -> list[int]:
    """Map completed gate tags to GLOBAL step numbers via the manifest map — the
    SAME inverse the frontend ``completedGatesToStepNumbers`` uses. This is how an
    MCP-driven gate set surfaces as SPA step numbers now that the dense
    ``completed_steps`` column is no longer written."""
    tag_to_number = {tag: num for num, tag in manifest.step_number_to_tag().items()}
    return sorted(tag_to_number[tag] for tag in completed_gates if tag in tag_to_number)


@pytest.fixture
def session_store(monkeypatch):
    store = {
        SESSION_ID: {
            "session_id": SESSION_ID,
            "created_by": USER,
            "completed_gates": [],
            "captured_outputs": {},
            "session_parameters": {},
        }
    }
    saves = []

    def load_session(session_id):
        record = store.get(session_id)
        return copy.deepcopy(record) if record is not None else None

    def save_session(session_id, **fields):
        saves.append((session_id, copy.deepcopy(fields)))
        store.setdefault(session_id, {"session_id": session_id}).update(copy.deepcopy(fields))
        return True

    def append_session_interaction(*args, **kwargs):
        return True

    def get_user_default_session(created_by):
        """Faithful stand-in for the DB reader: scope to ``created_by`` and surface
        the row's ``completed_gates`` (the cross-surface source of truth). R4a: the
        reader no longer depends on the legacy number columns to find or describe
        the session."""

        candidates = [rec for rec in store.values() if rec.get("created_by") == created_by]
        if not candidates:
            return None
        best = max(candidates, key=lambda rec: len(rec.get("completed_gates") or []))
        return {
            "session_id": best["session_id"],
            "completed_gates": best.get("completed_gates") or [],
        }

    monkeypatch.setattr(mcp_server, "load_session", load_session)
    monkeypatch.setattr(mcp_server, "save_session", save_session)
    monkeypatch.setattr(
        mcp_server, "append_session_interaction", append_session_interaction, raising=False
    )
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: True)
    monkeypatch.setattr(
        lakebase_service, "get_user_default_session", get_user_default_session, raising=True
    )
    return store, saves


# --- R4a — the save carries gates and NO legacy number kwargs ----------------


def test_save_session_signature_rejects_legacy_number_columns():
    """Structural guard: save_session no longer declares the three legacy params,
    so any residual write path passing them would raise TypeError at runtime."""
    params = set(inspect.signature(lakebase_service.save_session).parameters)
    assert not (params & set(_LEGACY_KWARGS))


def test_complete_step_writes_gates_without_legacy_numbers(session_store):
    store, saves = session_store
    # Use case resolved pre-journey (Option A), so the walk proceeds past
    # project_setup to prd_generation (which gates on use_case_selection).
    store[SESSION_ID]["completed_gates"] = ["use_case_selection"]

    completed = mcp_server.vibe_complete_step(SESSION_ID, "project_setup", "env configured")
    assert not isinstance(completed, dict), completed

    save_fields = saves[-1][1]
    # The gate set is written (cross-surface source of truth)...
    assert "project_setup" in save_fields["completed_gates"]
    # ...and NONE of the retired legacy number columns are passed to save_session.
    for kwarg in _LEGACY_KWARGS:
        assert kwarg not in save_fields


# --- R4a required test 3 — MCP → SPA visibility WITHOUT the numbers ----------


def test_mcp_completion_visible_to_spa_via_gates(session_store):
    """An MCP ``vibe_complete_step`` is reflected to the SPA through
    ``completed_gates`` alone: the legacy default-session read surfaces the gate,
    and the SPA's gate→global map resolves it to the correct step number — with no
    ``completed_steps`` ever written."""
    store, saves = session_store
    store[SESSION_ID]["completed_gates"] = ["use_case_selection"]

    mcp_server.vibe_complete_step(SESSION_ID, "project_setup", "env configured")

    # The write persisted project_setup to the gate set and no legacy numbers.
    save_fields = saves[-1][1]
    assert "project_setup" in save_fields["completed_gates"]
    assert all(kwarg not in save_fields for kwarg in _LEGACY_KWARGS)

    # The SAME session row, read by the legacy get_user_default_session contract,
    # now reflects the MCP-driven progress via completed_gates.
    default_session = lakebase_service.get_user_default_session(USER)
    assert default_session is not None
    assert default_session["session_id"] == SESSION_ID
    assert "project_setup" in default_session["completed_gates"]
    assert "completed_steps" not in default_session

    # The SPA maps those gates to GLOBAL step numbers (the frontend
    # deriveCompletedStepNumbers path). project_setup resolves to its global.
    numbers = _global_numbers(default_session["completed_gates"])
    assert numbers == _global_numbers(["project_setup"])
    assert numbers, "project_setup must resolve to a global step number"


# --- Idempotent replay — gates do not duplicate; still no legacy numbers ------


def test_idempotent_replay_no_duplicate_gates_no_legacy_numbers(session_store):
    store, saves = session_store
    store[SESSION_ID]["completed_gates"] = ["use_case_selection"]

    first_result = mcp_server.vibe_complete_step(SESSION_ID, "project_setup", "env configured")
    assert not isinstance(first_result, dict), first_result

    saves_before_replay = len(saves)
    replay_result = mcp_server.vibe_complete_step(
        SESSION_ID, "project_setup", "env configured (again)"
    )
    assert not isinstance(replay_result, dict), replay_result
    assert replay_result.completed_gates[-1] == "project_setup"
    assert len(saves) == saves_before_replay + 1

    replay = saves[-1][1]
    # project_setup appears exactly once (idempotent); no legacy numbers written.
    assert replay["completed_gates"].count("project_setup") == 1
    assert all(kwarg not in replay for kwarg in _LEGACY_KWARGS)
    assert store[SESSION_ID]["completed_gates"].count("project_setup") == 1


# --- No regression — engine writes preserved; still no legacy numbers ---------


def test_pre_journey_lock_save_carries_engine_writes_only(session_store):
    """Option A: the pre-journey lock (vibe_set_parameters) writes the engine state
    (use_case_brief + the use_case_selection gate) in the SAME save, and carries
    NONE of the retired legacy number columns."""
    store, saves = session_store

    result = mcp_server.vibe_set_parameters(
        SESSION_ID,
        {
            "industry": "retail",
            "use_case": "demand_forecasting",
            "use_case_label": "Demand Forecasting",
            "use_case_source": "curated",
        },
    )
    assert result.use_case_resolved is True

    save_fields = saves[-1][1]
    import json

    assert json.loads(save_fields["captured_outputs"]["use_case_brief"])["use_case"] == "demand_forecasting"
    assert "use_case_selection" in save_fields["completed_gates"]
    # R4a: no legacy number columns in the lock save.
    for kwarg in _LEGACY_KWARGS:
        assert kwarg not in save_fields


def test_locked_use_case_in_session_parameters_survives_complete_step(session_store):
    """vibe_complete_step must NOT clobber the locked UC in session_parameters.

    session_parameters is written by vibe_set_parameters, not vibe_complete_step;
    the complete_step save omits it, and save_session preserves it via
    ``session_parameters = COALESCE(EXCLUDED.session_parameters, <table>...)``
    (none-preserve — mirrored by the fake store's merge).
    """

    store, _ = session_store
    store[SESSION_ID]["completed_gates"] = ["use_case_selection"]
    locked_uc = {
        "industry": "retail",
        "use_case": "curbside_eta",
        "use_case_label": "Curbside Pickup ETA",
        "use_case_source": "custom",
        "use_case_description": "Predict curbside pickup wait times.",
        "custom_draft_ready": True,
    }
    store[SESSION_ID]["session_parameters"] = dict(locked_uc)

    completed = mcp_server.vibe_complete_step(SESSION_ID, "project_setup", "env configured")
    assert not isinstance(completed, dict), completed

    assert store[SESSION_ID]["session_parameters"] == locked_uc
