"""Phase 3 T3b-2b — full write->read round-trip over the REAL endpoints.

The SPA read-path repoint (T3b-2b) makes ``GET /api/track/{track}/outline`` the
authoritative order/composition source for the workflow surfaces, and wires the
write path (``/session/save`` + ``/session/update-metadata``) to persist the
engine's composition inputs (``chain_context`` -> ``chainContext``; the complete
``flags`` object) from live UI state. This suite proves the loop end-to-end:

    POST the write endpoint  ->  capture the exact session_parameters JSONB patch
    the handler merges  ->  feed that patch back as the loaded session  ->  GET the
    outline endpoint  ->  assert a CONCRETE sectionTag delta that only appears if
    BOTH sides of the loop are correct.

Unlike ``test_session_composition_persist.py`` (which stops at the captured patch
and re-composes with an in-test ``_merge`` + ``engine.outline`` helper), these
tests drive the composition through the REAL ``GET /outline`` route, so a break in
either the write persistence (T3b-2a) OR the read composition (T3a) fails here.

Fail-before (both tests): before T3b-2a, ``chain_context`` / ``flags`` were not
fields on the write request models, so Pydantic dropped them, the captured patch
never carried ``chainContext`` / ``flags``, the reloaded session composed the plain
default outline, and the tag-delta assertion failed. The expected outline is
computed from the LIVE engine (never manifest.json).

All offline: the FastAPI router is mounted on a bare app; ``save_session`` /
``execute_insert`` / ``get_schema`` and ``load_session`` are monkeypatched — no
live Lakebase. The Postgres JSONB ``||`` merge is a shallow top-level dict update.
"""

import json
from dataclasses import asdict

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

from src.backend.api import routes
from src.backend.workshop import engine


class _WriteReadHarness:
    """Captures the write patch, then serves it back as the loaded session so a
    subsequent GET /outline composes from exactly what the write path persisted."""

    def __init__(self):
        self.patches: list[dict] = []
        self.record: dict | None = None

    # --- write side: capture the session_parameters composition patch ----------
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

    # --- read side: serve a session whose params are the persisted patch --------
    def load_session(self, session_id):
        return self.record

    def seed_reload(self, workshop_level: str, patch: dict) -> None:
        """Build the reloaded record the outline endpoint will see: a shallow
        top-level merge of the captured patch into session_parameters (mirroring
        the Postgres JSONB ``||`` the handler runs against the stored row)."""
        self.record = {
            "session_id": "s1",
            "workshop_level": workshop_level,
            "completed_gates": [],
            "captured_outputs": {},
            "session_parameters": {**patch},
        }


@pytest.fixture
def harness(monkeypatch):
    h = _WriteReadHarness()
    monkeypatch.setattr(routes, "save_session", lambda *a, **k: True)
    monkeypatch.setattr(routes, "execute_insert", h.execute_insert)
    monkeypatch.setattr(routes, "get_schema", lambda: "test_schema")
    monkeypatch.setattr(routes, "load_session", h.load_session)
    return h


@pytest.fixture
def client(harness):
    app = FastAPI()
    app.include_router(routes.router, prefix="/api")
    c = TestClient(app)
    c.harness = harness  # type: ignore[attr-defined]
    return c


def _outline_tags(client, track: str) -> list[str]:
    resp = client.get(f"/api/track/{track}/outline", params={"session_id": "s1"})
    assert resp.status_code == 200, resp.text
    return [item["sectionTag"] for item in resp.json()["outline"]]


def _default_tags(track: str) -> list[str]:
    """Non-hollow expected baseline: the LIVE engine's fresh (no-composition) outline."""
    return [asdict(i)["sectionTag"] for i in engine.outline(track, engine.SessionState())]


# --- (a) APP-CLIMB round-trip -------------------------------------------------


def test_app_climb_roundtrip_readmits_climbed_sections(client):
    """Persist ``chain_context='app'`` for the climb-capable ``lakehouse`` track via
    the write path, reload, and GET /outline: the app+lakebase chain the user
    climbed through must be re-admitted. Concrete delta: ``setup_lakebase`` is
    present WITH the persisted climb and ABSENT from the standalone outline."""
    # 1) WRITE: the SPA sends chain_context from live App state.
    resp = client.post(
        "/api/session/update-metadata",
        json={"session_id": "s1", "chain_context": "app"},
    )
    assert resp.status_code == 200, resp.text

    patch = client.harness.last_patch
    assert patch.get("chainContext") == "app"  # write side (fail-before: dropped)

    # 2) READ: reload the session with exactly that persisted patch, then compose.
    client.harness.seed_reload("lakehouse", patch)
    climbed = _outline_tags(client, "lakehouse")

    standalone = _default_tags("lakehouse")
    # Concrete, non-hollow tag delta: a specific climbed tag present here, absent
    # from the standalone lakehouse outline.
    assert "setup_lakebase" in climbed
    assert "setup_lakebase" not in standalone
    # The whole app+lakebase chain is re-admitted (the outline strictly grows).
    assert set(standalone) < set(climbed)


# --- (b) SUB-TOGGLE round-trip ------------------------------------------------


def test_subtoggle_roundtrip_drops_disabled_step(client):
    """Persist a sub-toggle OFF (``ai.dashboard=false``) for ``end-to-end`` via the
    write path, reload, and GET /outline: the gated step drops. Concrete delta:
    ``aibi_dashboard`` present by default, ABSENT once the flag is persisted off."""
    flags = {"ai.dashboard": False}
    # 1) WRITE: the SPA sends the complete flags object from live UI state.
    resp = client.post(
        "/api/session/save",
        json={
            "session_id": "s1",
            "current_step": 1,
            "completed_steps": [],
            "step_prompts": {},
            "flags": flags,
        },
    )
    assert resp.status_code == 200, resp.text

    patch = client.harness.last_patch
    assert patch.get("flags") == flags  # write side (fail-before: dropped)

    # 2) READ: reload with the persisted flags, then compose.
    client.harness.seed_reload("end-to-end", patch)
    toggled = _outline_tags(client, "end-to-end")

    default = _default_tags("end-to-end")
    # Concrete, non-hollow tag delta on the exact gated step.
    assert "aibi_dashboard" in default
    assert "aibi_dashboard" not in toggled
    # Only the gated step drops (round-trip is surgical, not a wholesale change).
    assert set(default) - set(toggled) == {"aibi_dashboard"}


def test_subtoggle_medallion_gold_off_roundtrip(client):
    """A second, independent sub-toggle axis (medallion) proves the flags round-trip
    is not dashboard-specific: ``medallion.gold=false`` on ``accelerator`` drops the
    Gold design + pipeline steps."""
    flags = {"medallion.gold": False}
    resp = client.post(
        "/api/session/update-metadata",
        json={"session_id": "s1", "flags": flags},
    )
    assert resp.status_code == 200, resp.text

    patch = client.harness.last_patch
    assert patch.get("flags") == flags

    client.harness.seed_reload("accelerator", patch)
    toggled = _outline_tags(client, "accelerator")

    default = _default_tags("accelerator")
    assert {"gold_layer_design", "gold_layer_pipeline"} <= set(default)
    assert {"gold_layer_design", "gold_layer_pipeline"}.isdisjoint(toggled)
    assert set(toggled) < set(default)


# --- (c) DIRECTION:REVERSE round-trip ----------------------------------------
# T3c makes the endpoint the ORDER authority and removes the client-side reverse
# fallback, so a persisted direction:reverse MUST recompose the outline server-side
# (the SPA now refetches after persisting direction). These prove the reverse order
# survives the write->read loop through the REAL endpoint.


def _reverse_tags(track: str) -> list[str]:
    """Non-hollow reverse baseline: the LIVE engine's direction=reverse outline."""
    state = engine.SessionState(session_parameters={"direction": "reverse"})
    return [asdict(i)["sectionTag"] for i in engine.outline(track, state)]


def test_direction_reverse_roundtrip_recomposes_forward_baseline_track(client):
    """Forward-viewed-reverse: persist ``direction='reverse'`` for ``end-to-end``
    (a forward-baseline track whose reverse order is composed ONLY from the
    persisted direction) via the write path, reload, and GET /outline. The endpoint
    must return the reverse VARIANT — the exact case the removed client fallback #2
    used to guard, now closed by refetch-after-persist."""
    # 1) WRITE: the SPA sends direction from live state (handleDirectionChange).
    resp = client.post(
        "/api/session/update-metadata",
        json={"session_id": "s1", "direction": "reverse"},
    )
    assert resp.status_code == 200, resp.text

    patch = client.harness.last_patch
    assert patch.get("direction") == "reverse"  # write side (fail-before: dropped)

    # 2) READ: reload with that persisted patch, then compose through the endpoint.
    client.harness.seed_reload("end-to-end", patch)
    got = _outline_tags(client, "end-to-end")

    # Non-hollow: the endpoint reproduces the LIVE engine's reverse variant exactly,
    # and it genuinely differs from the forward default.
    assert got == _reverse_tags("end-to-end")
    assert got != _default_tags("end-to-end")

    # Concrete, human-checkable delta: the reverse-ETL activation arc (32-37) is
    # admitted only in reverse; the forward-only app/lakebase-wiring steps drop.
    forward = _default_tags("end-to-end")
    assert "activation_table_design" in got and "activation_table_design" not in forward
    assert "deploy_databricks_app" in forward and "deploy_databricks_app" not in got
    # Activation tags form a single contiguous block at the tail (pre-refinement),
    # which is what lets orderedSectionsForRead group them without the dropped
    # interleaving guard.
    activation = [t for t in got if t.startswith("activation_")]
    first = got.index(activation[0])
    assert got[first : first + len(activation)] == activation


@pytest.mark.parametrize(
    "track",
    ["reverse-lakehouse", "reverse-lakehouse-di", "reverse-lakebase", "reverse-app"],
)
def test_reverse_tracks_are_intrinsically_reverse_over_the_endpoint(client, track):
    """The four reverse-* tracks bake reverse into their default outline, so the
    endpoint serves the reverse order even with NO composition persisted — the SPA
    read path adopts it directly (these tracks were always safe)."""
    client.harness.seed_reload(track, {})
    got = _outline_tags(client, track)
    assert got == _default_tags(track) == _reverse_tags(track)
