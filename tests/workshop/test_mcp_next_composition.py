"""Phase 3 T3b-1 — MCP ``_next_reference`` is composition-consistent with the engine.

`_next_reference` builds the "next step" pointer that ships inside every MCP step
payload (`_step_payload(...).next`). It must point at the SAME successor the
composed outline (`engine.outline`) shows, otherwise the agent's "next" walk
disagrees with the sidebar/outline for any track whose order depends on a
composition INPUT (`direction` / `chainContext`), not just its flags.

Before the T3b-1 fix, `_next_reference` called
``MANIFEST.outline_order(track, flags=_flags_for(...))`` — threading flags but
OMITTING inputs — so it ordered against the input-blind (default) composition
while the outline ordered against the input-aware one. On the variant tracks
(lakehouse climb, end-to-end reverse) the two orders diverge mid-track, so the
"next" pointer pointed at the wrong step (or fell off the end as "Track
complete"). These tests pin the agreement.

The seam is LATENT under ``DEFAULT_TRACK=genie-accelerator`` (no input-driven
variants — every step's successor already agrees), so the divergence tests
exercise the variant tracks (lakehouse / end-to-end) DIRECTLY through
``_next_reference`` to genuinely cover the composition path. The genie-accelerator
regression guards that the live default track is unchanged.
"""

import pathlib
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.workshop import engine


def _session(track: str, params: dict, completed=None) -> engine.SessionState:
    return engine.SessionState(
        completed_gates=list(completed or []),
        captured_outputs={},
        session_parameters=dict(params),
    )


def _composed_tags(track: str, state: engine.SessionState) -> list[str]:
    return [status.sectionTag for status in engine.outline(track, state)]


def _outline_next_after(track: str, state: engine.SessionState, section_tag: str) -> str:
    """The tag AFTER ``section_tag`` in the composed outline ('' if it is last)."""
    tags = _composed_tags(track, state)
    idx = tags.index(section_tag)
    return tags[idx + 1] if idx + 1 < len(tags) else ""


def _assert_full_agreement(track: str, state: engine.SessionState) -> None:
    """Every step's `_next_reference` pointer equals its composed-outline successor."""
    steps = engine._ordered_steps(track, state)
    tags = [step.sectionTag for step in steps]
    for index, step in enumerate(steps):
        expected = tags[index + 1] if index + 1 < len(tags) else ""
        actual = mcp_server._next_reference(track, state, step).sectionTag
        assert actual == expected, (
            f"{track}: _next_reference after {step.sectionTag!r} = {actual!r}, "
            f"but composed outline has {expected!r}"
        )


def test_next_reference_agrees_with_outline_climb():
    """lakehouse + chainContext='app' (additive-chain climb): the "next" pointer
    must follow the CLIMB-composed order, not the standalone default. FAILS before
    the fix (input-blind ordering picks the wrong successor mid-track)."""
    track = "lakehouse"
    state = _session(track, {"chainContext": "app"}, completed=["project_setup"])

    # The current step (prd_generation) sits at a composition divergence point:
    # its climb successor differs from the input-blind default successor.
    current = engine.next_step(track, state)
    assert current.sectionTag == "prd_generation"
    assert (
        mcp_server._next_reference(track, state, current).sectionTag
        == _outline_next_after(track, state, current.sectionTag)
    )

    # And the pointer agrees at EVERY step of the composed outline.
    _assert_full_agreement(track, state)


def test_next_reference_agrees_with_outline_reverse():
    """end-to-end + direction='reverse': the "next" pointer must follow the
    reverse-composed order, not the forward default. FAILS before the fix."""
    track = "end-to-end"
    state = _session(track, {"direction": "reverse"}, completed=["project_setup"])

    current = engine.next_step(track, state)
    assert current.sectionTag == "prd_generation"
    assert (
        mcp_server._next_reference(track, state, current).sectionTag
        == _outline_next_after(track, state, current.sectionTag)
    )

    _assert_full_agreement(track, state)


def test_next_reference_default_track_unchanged():
    """Regression: genie-accelerator (DEFAULT_TRACK, no input-driven variants)
    already agrees step-for-step — this guards that the fix does not perturb the
    live track's "next" pointers."""
    track = "genie-accelerator"
    state = _session(track, {})
    _assert_full_agreement(track, state)

    # Spot-check the head of the outline explicitly.
    current = engine.next_step(track, state)
    assert (
        mcp_server._next_reference(track, state, current).sectionTag
        == _outline_next_after(track, state, current.sectionTag)
    )
