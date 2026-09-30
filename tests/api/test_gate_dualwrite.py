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

    def patch_key(self, key):
        """The last merged value for `key`, or None if never patched."""
        for patch in reversed(self.patches):
            if key in patch:
                return patch[key]
        return None


class _ExistingStore:
    """Stand-in for the persisted row the endpoints load to compute the gate
    merge. Tests seed ``.record`` to simulate an MCP-origin session."""

    def __init__(self):
        self.record: dict | None = None

    def load_session(self, session_id):
        return self.record


@pytest.fixture
def client(monkeypatch):
    saves = _SaveCapture()
    params = _ParamCapture()
    existing = _ExistingStore()
    monkeypatch.setattr(routes, "save_session", saves.save_session)
    monkeypatch.setattr(routes, "load_session", existing.load_session)
    monkeypatch.setattr(routes, "execute_insert", params.execute_insert)
    monkeypatch.setattr(routes, "execute_query", lambda *a, **k: [])
    monkeypatch.setattr(routes, "get_schema", lambda: "test_schema")

    app = FastAPI()
    app.include_router(routes.router, prefix="/api")
    test_client = TestClient(app)
    test_client.save_capture = saves  # type: ignore[attr-defined]
    test_client.param_capture = params  # type: ignore[attr-defined]
    test_client.existing = existing  # type: ignore[attr-defined]
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


def test_save_session_omitting_gates_preserves_existing(client):
    """PRESERVE-on-absent (review fix, blocking #2): a save that omits the gate
    fields (composition-only save / older client) must NOT clobber persisted gates
    — it passes ``completed_gates=None`` (COALESCE-preserved) and writes no
    ``skipped_gates`` patch. The []-default that used to overwrite is gone."""
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
    assert client.save_capture.last.get("completed_gates") is None
    assert all("skipped_gates" not in p for p in client.param_capture.patches)


# --- cross-surface MERGE (review fix, blocking #1) ---------------------------
#
# The App can only represent gates that map to a global ALL_STEPS number. An
# MCP-origin session carries gates the App CANNOT represent — notably the engine
# gate `use_case_selection` (WITH underscore; retired from numbered ALL_STEPS,
# distinct from step-1 `usecase_selection` NO underscore). The dual-write must
# add-only PRESERVE those, or an App write destroys them and re-locks the steps
# whose requiresGate they satisfy (on genie-accelerator, prd_generation).


def test_mcp_origin_nonrepresentable_gate_preserved_keeps_prd_unlocked(client):
    from src.backend.workshop import engine
    from src.backend.workshop.state import build_session_state

    # Seeded MCP-origin row: use case resolved pre-journey + project_setup done;
    # prd_generation NOT yet done. `use_case_selection` is non-representable.
    client.existing.record = {
        "completed_gates": ["use_case_selection", "project_setup"],
        "session_parameters": {},
    }

    # App path: hydrate drops use_case_selection (unmappable), so a subsequent
    # completion write carries only the number-derived representable gate.
    resp = client.post(
        "/api/session/update-metadata",
        json={
            "session_id": "s1",
            "completed_steps": [2],
            "completed_gates": ["project_setup"],  # NO use_case_selection
        },
    )
    assert resp.status_code == 200, resp.text

    merged = client.save_capture.last.get("completed_gates")
    # The non-representable MCP gate survived the App write (add-only preserve).
    assert "use_case_selection" in merged
    assert "project_setup" in merged

    # And the engine agrees: prd_generation (requiresGate == use_case_selection on
    # genie-accelerator) stays UNLOCKED — 'current', not re-locked.
    state = build_session_state(
        {"completed_gates": merged, "completed_steps": [2], "session_parameters": {}},
        "genie-accelerator",
    )
    status = {item.sectionTag: item.status for item in engine.outline("genie-accelerator", state)}
    assert status["prd_generation"] == "current", status.get("prd_generation")
    prd = next(s for s in engine.MANIFEST.track_steps("genie-accelerator") if s.sectionTag == "prd_generation")
    assert engine.can_start(prd, state) is True

    # Contrast — the BUG a naive replace would cause: with use_case_selection
    # destroyed, prd_generation's requiresGate is unsatisfied and it RE-LOCKS.
    naive = build_session_state(
        {"completed_gates": ["project_setup"], "completed_steps": [2], "session_parameters": {}},
        "genie-accelerator",
    )
    assert engine.can_start(prd, naive) is False


def test_app_uncomplete_drops_representable_gate_but_preserves_nonrepresentable(client):
    """Representable gates stay App-AUTHORITATIVE: un-completing a numbered step on
    the App path correctly DROPS its representable tag, while a co-present
    non-representable gate (use_case_selection) is add-only preserved."""
    # MCP-origin row: use_case_selection + project_setup + prd_generation all done.
    client.existing.record = {
        "completed_gates": ["use_case_selection", "project_setup", "prd_generation"],
        "session_parameters": {},
    }

    # App un-completes prd_generation -> its remaining number-derived gate set.
    resp = client.post(
        "/api/session/update-metadata",
        json={
            "session_id": "s1",
            "completed_steps": [2],
            "completed_gates": ["project_setup"],  # prd_generation un-completed
        },
    )
    assert resp.status_code == 200, resp.text

    merged = client.save_capture.last.get("completed_gates")
    assert "prd_generation" not in merged  # representable => App drops it
    assert "project_setup" in merged
    assert "use_case_selection" in merged  # non-representable => preserved


def test_save_path_merges_nonrepresentable_gate(client):
    """The full-save path is symmetric: it too add-only preserves a stored
    non-representable gate, and merges skipped_gates the same way."""
    client.existing.record = {
        "completed_gates": ["use_case_selection", "project_setup"],
        "session_parameters": {"skipped_gates": ["use_case_selection"]},
    }
    resp = client.post(
        "/api/session/save",
        json={
            "session_id": "s1",
            "current_step": 3,
            "completed_steps": [2, 3],
            "step_prompts": {},
            "completed_gates": ["project_setup", "prd_generation"],
            "skipped_gates": [],
        },
    )
    assert resp.status_code == 200, resp.text
    merged = client.save_capture.last.get("completed_gates")
    assert set(merged) == {"project_setup", "prd_generation", "use_case_selection"}
    # skipped_gates merge preserves the non-representable stored skip too.
    assert client.param_capture.patch_key("skipped_gates") == ["use_case_selection"]
