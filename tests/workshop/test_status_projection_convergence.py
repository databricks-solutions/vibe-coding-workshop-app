"""Phase 3 T5 PR2 (Work B) — endpoint STATUS projection convergence contract.

Work B projects the outline endpoint's per-step ``status`` onto the SPA's
Set<number> done-set, UNIONed with the local optimistic completions (the
no-flicker overlay, implemented as the pure ``src/constants/mergeStatus.ts``
helper and exercised by ``tests/frontend/mergeStatus.node.test.ts``).

This Python contract proves the OTHER half the overlay depends on: once the App
persists a completion and the ``GET /api/track/{track}/outline`` refetch lands,
the endpoint's gate-derived ``status`` catches up to report that step as
``done`` (PR1 made this correct for App-origin sessions). Therefore the overlay
CONVERGES to endpoint truth — the merged set equals the endpoint projection and
pins nothing stale — rather than MASKING a stale/regressed endpoint.

Offline: builds session state via the shared ``build_session_state`` and runs the
same ``engine.outline`` the REST route and MCP server call. No live Lakebase.
"""

from dataclasses import asdict

from src.backend.workshop import engine, manifest
from src.backend.workshop.state import build_session_state

GENIE_TRACK = "genie-accelerator"


def _status_by_tag(track, record):
    state = build_session_state(record, track)
    return {item.sectionTag: item.status for item in engine.outline(track, state)}


def _fe_tag_to_number():
    """Mirror the frontend SECTION_TAG_TO_STEP_NUMBER: invert the backend's global
    number->tag map (both derive from the one ALL_STEPS authority; the BE<->FE
    parity is pinned elsewhere). This is the map mergeStatus uses to project
    endpoint-done tags back to the SPA's global step numbers."""
    return {tag: number for number, tag in manifest.step_number_to_tag().items()}


def _merge_status(local_optimistic, status_by_tag, tag_to_number):
    """Pure Python mirror of mergeStatus: union of endpoint status=='done'
    (mapped to global numbers, unmapped dropped) and the local optimistic set."""
    endpoint_done = {
        tag_to_number[tag]
        for tag, status in status_by_tag.items()
        if status == "done" and tag in tag_to_number
    }
    return endpoint_done | set(local_optimistic), endpoint_done


# The persisted gate set the App writes; globals 2,3,57,58 (incl. the genie
# high-globals 57/58 the old dense-index misread silently dropped).
_CONVERGE_GATES = ["project_setup", "prd_generation", "semlayer_locate", "semlayer_profile"]


def test_endpoint_status_catches_up_for_completions():
    # Gate-only row (R4b): completions ride on completed_gates.
    record = {
        "session_id": "sess-converge",
        "workshop_level": GENIE_TRACK,
        "completed_gates": _CONVERGE_GATES,
        "captured_outputs": {},
        "session_parameters": {},
    }

    status = _status_by_tag(GENIE_TRACK, record)

    # The refetch has landed: every persisted gate is reported done by the
    # endpoint (its tag status == 'done').
    for tag in _CONVERGE_GATES:
        assert status[tag] == "done", f"{tag} should be done: {status.get(tag)}"

    # And the endpoint is NOT marking everything done — a step the user never
    # completed is still current/locked (no over-completion; guards against a
    # trivially-passing 'all done' oracle).
    not_done = [s for s in status.values() if s != "done"]
    assert not_done, "some steps must remain not-done"


def test_overlay_converges_to_endpoint_after_refetch_not_masking():
    record = {
        "session_id": "sess-converge",
        "workshop_level": GENIE_TRACK,
        "completed_gates": _CONVERGE_GATES,
        "captured_outputs": {},
        "session_parameters": {},
    }
    local_optimistic = [2, 3, 57, 58]  # what the App holds locally

    status = _status_by_tag(GENIE_TRACK, record)
    merged, endpoint_done = _merge_status(local_optimistic, status, _fe_tag_to_number())

    # CONVERGENCE (not masking): once the endpoint has caught up, the union adds
    # nothing the endpoint doesn't already report -> merged == endpoint. The
    # overlay does not permanently pin a stale local value.
    assert merged == endpoint_done, f"overlay did not converge: {merged} != {endpoint_done}"
    # Sanity: the round-trip preserved the in-track globals the App persisted.
    assert endpoint_done == {2, 3, 57, 58}
