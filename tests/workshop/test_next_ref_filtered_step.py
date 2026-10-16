"""next-ref-filtered-step — ``_next_reference`` for an off-outline step.

``vibe_get_step`` on an explicitly requested flag-filtered tag resolves the
authored step (D-16) and builds its ``next`` with
``mcp_server._next_reference``. That tag has no outline index, so ``next`` is
the first OUTLINE step, walked in outline order, whose authored index is past
the tag's authored index (D-17). It never points at another filtered step, and
it reads "Track complete" only when no outline step is authored after the tag.

The subject is ``gold_layer_design`` on genie-accelerator (``includeLakehouse``,
default off). No real composition input reorders genie-accelerator's outline, so
N2 and N5 monkeypatch ``engine._ordered_steps`` over real manifest steps.

Tampers (each flips a green test to red; run manually, restore clean):
- **T1** drop the off-outline branch -> N1 (and R-F6) fail.
- **T2** return the authored-next step without checking outline membership -> N1 fails.
- **T3** break the outline-member path (``index + 2``) -> N3 fails.
- **T4** select by min authored index instead of outline order -> N5 fails.
"""

import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.workshop import engine

TRACK = "genie-accelerator"
FILTERED = "gold_layer_design"
TRACK_COMPLETE = ("", "Track complete")


def _state(**parameters) -> engine.SessionState:
    return engine.SessionState(
        completed_gates=["use_case_selection", "project_setup", "prd_generation"],
        captured_outputs={"use_case_brief": "demo brief"},
        session_parameters={"use_case": "demo", "use_case_label": "Demo", **parameters},
    )


def _authored() -> list:
    return engine.MANIFEST.track_steps(TRACK)


def _authored_step(tag: str):
    return next(step for step in _authored() if step.sectionTag == tag)


def _ref(reference) -> tuple[str, str]:
    return (reference.sectionTag, reference.title)


def test_n1_filtered_step_next_is_the_first_outline_step_authored_after_it():
    """N1 · filtered ``gold_layer_design`` -> ``semlayer_locate``.

    The authored successor ``gold_layer_pipeline`` is itself filtered, so it is
    skipped; the answer is the first outline step authored after the tag."""

    state = _state()
    outline_tags = [step.sectionTag for step in engine._ordered_steps(TRACK, state)]
    assert FILTERED not in outline_tags

    authored_tags = [step.sectionTag for step in _authored()]
    position = authored_tags.index(FILTERED)
    expected = next(tag for tag in outline_tags if authored_tags.index(tag) > position)
    assert expected == "semlayer_locate"
    assert authored_tags[position + 1] not in outline_tags

    reference = mcp_server._next_reference(TRACK, state, _authored_step(FILTERED))

    assert _ref(reference) == ("semlayer_locate", _authored_step("semlayer_locate").title)


def test_n2_filtered_step_authored_after_the_last_outline_step_is_track_complete(monkeypatch):
    """N2 · no outline step authored after the tag -> "Track complete".

    No real genie-accelerator flag filters a step past the last outline step,
    so the outline is stubbed to the real default outline minus its final
    ``workspace_cleanup``, which then plays the filtered tag."""

    state = _state()
    real_outline = engine._ordered_steps(TRACK, state)
    assert real_outline[-1].sectionTag == "workspace_cleanup"
    assert _authored()[-1].sectionTag == "workspace_cleanup"
    trimmed = real_outline[:-1]
    monkeypatch.setattr(engine, "_ordered_steps", lambda track_id, session: list(trimmed))

    reference = mcp_server._next_reference(TRACK, state, _authored_step("workspace_cleanup"))

    assert _ref(reference) == TRACK_COMPLETE


@pytest.mark.parametrize(
    ("tag", "expected"),
    [
        ("project_setup", "prd_generation"),
        ("prd_generation", "semlayer_locate"),
        ("gaccel_dashboard", "gaccel_activation"),
        ("redeploy_test", "workspace_cleanup"),
        ("workspace_cleanup", None),
    ],
)
def test_n3_outline_step_next_is_unchanged(tag, expected):
    """N3 · an outline step's ``next`` is its outline successor; the last
    outline step's is "Track complete"."""

    state = _state()
    outline = engine._ordered_steps(TRACK, state)
    index = [step.sectionTag for step in outline].index(tag)
    if expected is None:
        assert index == len(outline) - 1
    else:
        assert outline[index + 1].sectionTag == expected

    reference = mcp_server._next_reference(TRACK, state, outline[index])

    if expected is None:
        assert _ref(reference) == TRACK_COMPLETE
    else:
        assert _ref(reference) == (expected, outline[index + 1].title)


def test_n4_intent_beat_next_is_unchanged():
    """N4 · the pre-journey intent beat's ``next`` is the first numbered step."""

    state = _state()

    reference = mcp_server._next_reference(TRACK, state, mcp_server._INTENT_BEAT_STEP)

    assert _ref(reference) == ("project_setup", _authored_step("project_setup").title)


def test_n5_off_outline_next_follows_outline_order_not_min_authored_index(monkeypatch):
    """N5 · on a non-monotonic outline, the pick is by OUTLINE order.

    The stubbed outline (real manifest steps) swaps ``semlayer_profile`` ahead of
    ``semlayer_locate``. For filtered ``gold_layer_design``, the first outline
    step authored after it is ``semlayer_profile``; the smallest authored index
    past it is ``semlayer_locate``. The outline-order choice wins."""

    state = _state()
    real_outline = engine._ordered_steps(TRACK, state)
    tags = [step.sectionTag for step in real_outline]
    locate, profile = tags.index("semlayer_locate"), tags.index("semlayer_profile")
    assert profile == locate + 1
    reordered = list(real_outline)
    reordered[locate], reordered[profile] = reordered[profile], reordered[locate]
    monkeypatch.setattr(engine, "_ordered_steps", lambda track_id, session: list(reordered))

    authored_tags = [step.sectionTag for step in _authored()]
    position = authored_tags.index(FILTERED)
    later = [step for step in reordered if authored_tags.index(step.sectionTag) > position]
    min_authored = min(later, key=lambda step: authored_tags.index(step.sectionTag))
    assert later[0].sectionTag == "semlayer_profile"
    assert min_authored.sectionTag == "semlayer_locate"

    reference = mcp_server._next_reference(TRACK, state, _authored_step(FILTERED))

    assert _ref(reference) == ("semlayer_profile", _authored_step("semlayer_profile").title)
