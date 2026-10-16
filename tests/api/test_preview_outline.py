"""Phase 3 T4a — offline tests for the additive POST /api/track/{track}/outline/preview.

This route is the session-less SIBLING of GET /api/track/{track}/outline. It powers
the /config/test-scenario dev sandbox: it composes engine.outline() from inline
direction + flags on an EPHEMERAL SessionState, with NO session id, NO session load,
and NO database write. The GET (persisted) route must stay behaviorally identical —
these tests assert both the preview contract AND that the persisted branch is
untouched (load_session is never called on the preview path).

All tests are offline: the FastAPI router is mounted on a bare app (no static file
serving, no MCP mount), and load_session is monkeypatched to explode so any accidental
session load on the preview path is caught immediately.
"""

from dataclasses import asdict

import pytest
from fastapi import FastAPI
from starlette.testclient import TestClient

from src.backend.api import routes
from src.backend.workshop import engine


GENIE_TRACK = "genie-accelerator"


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(routes.router, prefix="/api")
    return TestClient(app)


@pytest.fixture
def no_session_load(monkeypatch):
    """Guard: the preview path must NEVER load a session. Any call is a bug."""

    def _boom(session_id):
        raise AssertionError("load_session must not be called on the preview path")

    monkeypatch.setattr(routes, "load_session", _boom)


def _expected(track, *, direction=None, flags=None):
    """Parity oracle: the SAME engine.outline the preview route builds, from an
    ephemeral SessionState carrying only the inline composition inputs."""
    params = {}
    if direction is not None:
        params["direction"] = direction
    if flags is not None:
        params["flags"] = flags
    state = engine.SessionState(session_parameters=params)
    return [asdict(item) for item in engine.outline(track, state)]


# --- T4a-B1 core: preview == engine.outline for the bare (default) composition ---


def test_preview_default_matches_fresh_engine_outline(client, no_session_load):
    resp = client.post(f"/api/track/{GENIE_TRACK}/outline/preview", json={})

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["track"] == GENIE_TRACK
    assert body["session_id"] is None  # never echoes a session — there is none
    assert body["outline"] == _expected(GENIE_TRACK)
    # Flat MCP parity: exactly four keys per item, same wire shape as the GET route.
    assert body["outline"], "expected a non-empty outline"
    for item in body["outline"]:
        assert set(item.keys()) == {"sectionTag", "title", "status", "execution"}
    # A fresh (all-locked-after-first) composition: first step current.
    assert body["outline"][0]["status"] == "current"


# --- T4a-B2 direction=reverse selects the reverse variant on end-to-end ---------


def test_preview_reverse_selects_reverse_variant_on_end_to_end(client, no_session_load):
    forward = client.post("/api/track/end-to-end/outline/preview", json={})
    reverse = client.post(
        "/api/track/end-to-end/outline/preview", json={"direction": "reverse"}
    )

    assert forward.status_code == 200 and reverse.status_code == 200
    fwd_tags = [i["sectionTag"] for i in forward.json()["outline"]]
    rev_tags = [i["sectionTag"] for i in reverse.json()["outline"]]
    # The reverse variant is a genuinely distinct ordering.
    assert fwd_tags != rev_tags
    assert reverse.json()["outline"] == _expected("end-to-end", direction="reverse")


def test_preview_reverse_is_baked_default_for_reverse_tracks(client, no_session_load):
    """The four reverse-* tracks bake reverse as their default: passing
    direction=reverse is a no-op the engine ignores (== the bare default)."""
    for track in (
        "reverse-lakehouse",
        "reverse-lakehouse-di",
        "reverse-lakebase",
        "reverse-app",
    ):
        default = client.post(f"/api/track/{track}/outline/preview", json={})
        reverse = client.post(
            f"/api/track/{track}/outline/preview", json={"direction": "reverse"}
        )
        assert default.status_code == 200 and reverse.status_code == 200
        assert default.json()["outline"] == reverse.json()["outline"]
        assert default.json()["outline"] == _expected(track)


# --- T4a-B3 flags drop steps structurally (engine-side) -------------------------


def test_preview_flags_drop_gated_steps(client, no_session_load):
    """An ai.* flag turned off structurally drops its gated step from the outline
    (the engine drop — the arbitrary client-side filter is a separate layer)."""
    all_on = client.post("/api/track/end-to-end/outline/preview", json={})
    agent_off = client.post(
        "/api/track/end-to-end/outline/preview",
        json={"flags": {"ai.agent": False}},
    )

    assert all_on.status_code == 200 and agent_off.status_code == 200
    all_tags = [i["sectionTag"] for i in all_on.json()["outline"]]
    off_tags = [i["sectionTag"] for i in agent_off.json()["outline"]]
    # Turning a default-true module off removes at least one step, and never adds.
    assert len(off_tags) < len(all_tags)
    assert set(off_tags) < set(all_tags)
    assert agent_off.json()["outline"] == _expected(
        "end-to-end", flags={"ai.agent": False}
    )


def test_preview_genie_flags_compose(client, no_session_load):
    for flags in (
        {"includeLakehouse": True},
        {"includeGenieOntology": True},
        {"includeLakehouse": True, "includeGenieOntology": True},
    ):
        resp = client.post(f"/api/track/{GENIE_TRACK}/outline/preview", json={"flags": flags})
        assert resp.status_code == 200, resp.text
        assert resp.json()["outline"] == _expected(GENIE_TRACK, flags=flags)


# --- T4a-B4 unknown track -> clean 404 (no 'auto', no session to resolve) -------


def test_preview_unknown_track_is_clean_404(client, no_session_load):
    resp = client.post("/api/track/not-a-real-track/outline/preview", json={})
    assert resp.status_code == 404, resp.text
    assert "detail" in resp.json()


def test_preview_auto_is_404_no_session_resolution(client, no_session_load):
    """The preview route has no session to resolve 'auto' against, so 'auto' is
    just an unknown track — a clean 404, never a 500."""
    resp = client.post("/api/track/auto/outline/preview", json={})
    assert resp.status_code == 404, resp.text
    assert "detail" in resp.json()


# --- T4a-B5 the request is strict (extra=forbid) --------------------------------


def test_preview_rejects_session_id_in_body(client, no_session_load):
    """The preview contract forbids a session id — the body model is extra=forbid,
    so smuggling session_id is a 422, never a silent session load."""
    resp = client.post(
        f"/api/track/{GENIE_TRACK}/outline/preview",
        json={"session_id": "sneaky"},
    )
    assert resp.status_code == 422, resp.text


def test_preview_rejects_bad_direction(client, no_session_load):
    resp = client.post(
        f"/api/track/{GENIE_TRACK}/outline/preview",
        json={"direction": "sideways"},
    )
    assert resp.status_code == 422, resp.text


# --- T4a-B6 the persisted GET route is untouched (behavioral identity) ----------


def test_persisted_get_route_still_serves_fresh_outline(client, monkeypatch):
    """The GET (session-only) route's no-session 200 path is unchanged: the additive
    preview sibling did not alter it."""

    def _boom(session_id):
        raise AssertionError("load_session must not be called without session_id")

    monkeypatch.setattr(routes, "load_session", _boom)

    resp = client.get(f"/api/track/{GENIE_TRACK}/outline")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["track"] == GENIE_TRACK
    assert body["session_id"] is None
    assert body["outline"] == _expected(GENIE_TRACK)


def test_get_route_rejects_post_and_preview_rejects_get(client, no_session_load):
    """Method separation: the two routes are distinct siblings, not one overloaded
    path. The persisted route is GET-only; the preview route is POST-only."""
    assert client.post(f"/api/track/{GENIE_TRACK}/outline", json={}).status_code == 405
    assert client.get(f"/api/track/{GENIE_TRACK}/outline/preview").status_code == 405
