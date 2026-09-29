"""Phase 2B T5 (D11 §4.3, §6) — cross-surface step-sync bridge.

Today ``vibe_complete_step`` writes the MCP engine's progress model
(``captured_outputs`` + ``completed_gates``) but NOT the legacy SPA progress
model (``current_step`` INT + ``completed_steps`` int-list; ``03_sessions.sql``).
So a learner driving the workshop through MCP (Genie Code) leaves the legacy SPA
step indicator stuck at step 1 (D11 §4.2).

T5 closes that gap with a small ADDITIVE dual-write: ``vibe_complete_step`` ALSO
updates ``current_step``/``completed_steps`` — derived from the manifest's
section order — via the SAME ``save_session`` call it already makes (D11 §4.3).

Invariants proven here:

- **Derived from the manifest order, no magic numbers.** The section→legacy
  position map is the INVERSE of the ``completed_steps``→``completed_gates``
  translation in ``mcp_server._session_state`` — both key off the manifest's
  full ordered step list (``manifest.track_steps``). One section-order source.
- **Exit-gate proof (D11 §6).** A legacy ``get_user_default_session`` read of the
  SAME session row surfaces the MCP-driven ``current_step``/``completed_steps``.
- **Idempotent replay.** Completing a section twice never duplicates
  ``completed_steps`` nor regresses ``current_step``.
- **No regression.** The existing ``captured_outputs``/``completed_gates`` writes
  are preserved by the same save.
"""

import copy
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


def _positions() -> dict[str, int]:
    """1-based legacy step positions off the manifest's full ordered step list.

    This is the ordering ``mcp_server._session_state`` uses to translate
    ``completed_steps`` back into ``completed_gates`` — asserting against it
    (rather than literals) proves the bridge reuses the ONE section-order source.
    """

    steps = manifest.load_manifest().track_steps(TRACK)
    return {step.sectionTag: index + 1 for index, step in enumerate(steps)}


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
        """Faithful stand-in for the DB reader (D-3: unchanged, reads those cols).

        Mirrors the real SELECT: scope to ``created_by`` and surface the row's
        ``current_step``/``completed_steps`` (most progress first).
        """

        candidates = [rec for rec in store.values() if rec.get("created_by") == created_by]
        if not candidates:
            return None
        best = max(candidates, key=lambda rec: rec.get("current_step") or 0)
        return {
            "session_id": best["session_id"],
            "current_step": best.get("current_step"),
            "completed_steps": best.get("completed_steps") or [],
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


def _usecase_block() -> dict:
    block = (manifest.interactions_for("use_case_selection") or {}).get("decision")
    assert isinstance(block, dict)
    return block


# --- D11 §4.3 — dual-write derives legacy progress from the manifest order ----


def test_complete_step_writes_legacy_progress_from_manifest_order(session_store):
    store, saves = session_store
    positions = _positions()
    # The use case is resolved pre-journey (Option A), so the walk can proceed
    # past project_setup to prd_generation (which gates on use_case_selection).
    store[SESSION_ID]["completed_gates"] = ["use_case_selection"]

    # project_setup is the first numbered step (no prerequisite gate) — completing
    # it via MCP must record legacy step 1 done and advance current_step to prd.
    completed = mcp_server.vibe_complete_step(SESSION_ID, "project_setup", "env configured")

    assert not isinstance(completed, dict), completed
    save_fields = saves[-1][1]
    # use_case_selection is not a numbered step, so it never maps to a legacy
    # position (completed_steps counts only numbered steps).
    assert save_fields["completed_steps"] == [positions["project_setup"]]
    assert save_fields["current_step"] == positions["prd_generation"]


# --- D11 §6 — EXIT-GATE PROOF: legacy reader surfaces MCP-driven progress -----


def test_legacy_reader_reflects_mcp_driven_progress(session_store):
    store, _ = session_store
    positions = _positions()
    store[SESSION_ID]["completed_gates"] = ["use_case_selection"]

    mcp_server.vibe_complete_step(SESSION_ID, "project_setup", "env configured")

    # The SAME session row, read by the legacy get_user_default_session contract
    # (D-3, unchanged), now reflects the MCP-driven progress.
    default_session = lakebase_service.get_user_default_session(USER)
    assert default_session is not None
    assert default_session["session_id"] == SESSION_ID
    assert default_session["completed_steps"] == [positions["project_setup"]]
    assert default_session["current_step"] == positions["prd_generation"]


# --- D11 §4.3 — idempotent replay: no duplicates, no backward regression ------


def test_idempotent_replay_does_not_duplicate_or_regress(session_store):
    store, saves = session_store
    positions = _positions()
    store[SESSION_ID]["completed_gates"] = ["use_case_selection"]

    first_result = mcp_server.vibe_complete_step(SESSION_ID, "project_setup", "env configured")
    assert not isinstance(first_result, dict), first_result
    first = saves[-1][1]
    assert first["completed_steps"] == [positions["project_setup"]]
    assert first["current_step"] == positions["prd_generation"]

    # Replaying the SAME completion must (a) genuinely run to a successful save
    # again — not short-circuit or error into a re-read of the FIRST save — and
    # (b) not duplicate the completed step nor move current_step backward.
    saves_before_replay = len(saves)
    replay_result = mcp_server.vibe_complete_step(
        SESSION_ID, "project_setup", "env configured (again)"
    )
    # The replay is a real success (not an isError dict), and it appended a NEW
    # save entry — so the assertions below are checking the REPLAY's write.
    assert not isinstance(replay_result, dict), replay_result
    assert replay_result.completed_gates[-1] == "project_setup"
    assert len(saves) == saves_before_replay + 1

    replay = saves[-1][1]
    assert replay["completed_steps"] == [positions["project_setup"]]
    assert len(replay["completed_steps"]) == len(set(replay["completed_steps"]))
    assert replay["current_step"] >= first["current_step"]
    assert store[SESSION_ID]["completed_steps"] == [positions["project_setup"]]


# --- No regression — captured_outputs / completed_gates preserved by same save-


def test_pre_journey_lock_save_carries_engine_writes_and_legacy_fields(session_store):
    """Option A: the pre-journey lock (vibe_set_parameters) writes the engine state
    (use_case_brief + the use_case_selection gate) AND the legacy progress fields in
    the SAME save. No numbered step is done yet, so completed_steps is empty and
    current_step points at the first numbered step (project_setup)."""
    store, saves = session_store
    positions = _positions()

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
    # Engine-state writes land in the SAME save...
    import json

    assert json.loads(save_fields["captured_outputs"]["use_case_brief"])["use_case"] == "demand_forecasting"
    assert "use_case_selection" in save_fields["completed_gates"]
    # ...alongside the legacy progress fields. use_case_selection is not a numbered
    # step, so it never appears in completed_steps; project_setup is next.
    assert save_fields["completed_steps"] == []
    assert save_fields["current_step"] == positions["project_setup"]


# --- Guard — a locked use case in session_parameters survives complete_step ---


def test_locked_use_case_in_session_parameters_survives_complete_step(session_store):
    """vibe_complete_step must NOT clobber the locked UC in session_parameters.

    session_parameters is written by vibe_set_parameters, not vibe_complete_step;
    the complete_step save omits it, and save_session preserves it via
    ``session_parameters = COALESCE(EXCLUDED.session_parameters, <table>...)``
    (none-preserve — mirrored by the fake store's merge). This guard would catch
    a future regression that started writing/wiping session_parameters here.
    """

    store, _ = session_store
    # Use case already resolved pre-journey; a locked CUSTOM use case sits in
    # session_parameters. Completing a NUMBERED step (project_setup) must not
    # clobber it — vibe_complete_step's save omits session_parameters.
    store[SESSION_ID]["completed_gates"] = ["use_case_selection"]
    locked_uc = {
        "industry": "retail",
        "use_case": "curbside_eta",
        "use_case_label": "Curbside Pickup ETA",
        "use_case_source": "custom",
        "use_case_description": "Predict curbside pickup wait times.",
        # Custom locks now require the FMAPI draft marker (Workstream #3).
        "custom_draft_ready": True,
    }
    store[SESSION_ID]["session_parameters"] = dict(locked_uc)

    completed = mcp_server.vibe_complete_step(SESSION_ID, "project_setup", "env configured")
    assert not isinstance(completed, dict), completed

    # The locked UC is still intact, unchanged, after completing the step.
    assert store[SESSION_ID]["session_parameters"] == locked_uc
