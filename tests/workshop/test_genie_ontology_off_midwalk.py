"""genie-default-error-path C4 (D-158): Genie Ontology turned off mid-walk.

Plan: docs/superpowers/plans/2026-10-15-genie-default-error-path.md (C4).

A genie-accelerator session starts with ontology ON, walks in strict order and
the learner turns ontology OFF after step 14, 16 or 20. The write lands on all
three keys the way the server mirror stores it (routes._genie_ontology_mirror,
D-149), which is what engine._flags_for reads. Each walk still reaches Done
with ``iterate_enhance`` completed.

Pure engine + manifest, no DB.

Tamper (turns a test here red):
- X4 mark iterate_enhance skipped instead of completing it -> test_ontology_off_mid_walk_reaches_done
"""

import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.workshop import engine

TRACK = "genie-accelerator"


def _ontology(value):
    """The three keys as the server mirror writes them (D-149)."""

    return {
        "include_genie_ontology": value,
        "includeGenieOntology": value,
        "flags": {"includeGenieOntology": value},
    }


def _walk(off_after):
    """Complete steps in strict order; turn ontology off after ``off_after`` steps."""

    session = engine.SessionState(
        completed_gates=["use_case_selection"],
        session_parameters=_ontology(True),
    )
    walked = []
    while True:
        step = engine.next_step(TRACK, session)
        if isinstance(step, engine.Done):
            return session, walked
        assert not isinstance(step, engine.Blocked), (walked, step)
        result = engine.complete_step(TRACK, session, step.sectionTag, f"{step.sectionTag} done", learner_confirmed=True)
        assert result.ok, (step.sectionTag, result.error_code)
        walked.append(step.sectionTag)
        if len(walked) == off_after:
            session.session_parameters.update(_ontology(False))


def test_ontology_on_walk_is_the_baseline():
    session, walked = _walk(None)
    assert (len(walked), walked.index("iterate_enhance") + 1) == (27, 25)
    assert isinstance(engine.next_step(TRACK, session), engine.Done)


@pytest.mark.parametrize(
    ("off_after", "steps", "iterate_at"),
    [(14, 25, 23), (16, 27, 25), (20, 27, 25)],
)
def test_ontology_off_mid_walk_reaches_done(off_after, steps, iterate_at):
    session, walked = _walk(off_after)
    assert isinstance(engine.next_step(TRACK, session), engine.Done)
    assert "iterate_enhance" in session.completed_gates
    assert "iterate_enhance" not in session.session_parameters.get("skipped_gates", [])
    assert all(status.status == "done" for status in engine.outline(TRACK, session))
    assert (len(walked), walked.index("iterate_enhance") + 1) == (steps, iterate_at)
    assert engine._flags_for(TRACK, session)["includeGenieOntology"] is False
