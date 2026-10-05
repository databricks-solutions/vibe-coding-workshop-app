"""P4.2 — use_case_selection hoisted into every track's define-usecase step (D-33, D-34).

Before P4.2 only genie-accelerator's prd_generation gated on the pre-journey
``use_case_selection`` gate and consumed ``use_case_brief`` (genie-only generator
overrides). D-33 makes both shared generator overrides, so every track that has
prd_generation gets them. D-34: the SPA records its own step-1 tag
``usecase_selection``, never the engine gate, so ``build_session_state`` credits the
gate when the record has defined intent (industry AND use_case, the App's step-1
rule shared with ``lakebase._has_defined_intent``) — otherwise the hoist would lock
prd_generation for every SPA-started session.

H1 manifest shape · H2 generator reproduces the manifest · H3 SPA-shaped sessions
match the base (7329736) per track · H4 the intent-credit bridge · H5 MCP outline ==
the outline endpoint · H6 no intent beat once intent is defined.
"""

import copy
import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.services import lakebase
from src.backend.workshop import engine
from src.backend.workshop.state import build_session_state, has_defined_intent

USE_CASE_GATE = "use_case_selection"
INDUSTRY = "travel"
USE_CASE = "ai_driven_booking"


def _spa_record(**overrides):
    """A record shaped like an SPA-started session: the SPA's own step-1 tag
    ``usecase_selection`` and project_setup completed, never the engine gate."""

    record = {
        "industry": INDUSTRY,
        "use_case": USE_CASE,
        "completed_gates": ["usecase_selection", "project_setup"],
        "session_parameters": {},
        "captured_outputs": {},
    }
    record.update(overrides)
    return record


# --- H4: the intent-credit bridge (Change 0, D-34) ------------------------------


@pytest.fixture
def mcp_env(monkeypatch):
    """In-memory Lakebase store with the curated catalogue stubbed (offline)."""

    store: dict = {}
    saves: list = []
    pair_status = {"value": "known"}

    def load_session(session_id):
        record = store.get(session_id)
        return copy.deepcopy(record) if record is not None else None

    def save_session(session_id, **fields):
        saves.append((session_id, copy.deepcopy(fields)))
        store.setdefault(session_id, {"session_id": session_id}).update(copy.deepcopy(fields))
        return True

    monkeypatch.setattr(mcp_server, "load_session", load_session)
    monkeypatch.setattr(mcp_server, "save_session", save_session)
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: True)
    monkeypatch.setattr(mcp_server, "_request_user", lambda ctx: "learner@acme.com")
    monkeypatch.setattr(
        mcp_server, "_curated_pair_status", lambda industry, use_case: pair_status["value"]
    )
    monkeypatch.setattr(mcp_server, "_industry_label_for", lambda industry, echo: "Travel")
    monkeypatch.setattr(mcp_server, "_use_case_label_for", lambda industry, use_case: None)
    return store, saves, pair_status


def test_h4_bridge_credits_gate():
    record = _spa_record()
    state = build_session_state(record, "lakehouse")
    assert state.completed_gates == ["usecase_selection", "project_setup", USE_CASE_GATE]
    assert engine.use_case_resolved(state)
    # captured_outputs untouched: no brief is fabricated (assembler placeholder).
    assert state.captured_outputs == {}
    assert engine.USE_CASE_BRIEF not in state.captured_outputs
    # Read-side only: the record itself is not mutated.
    assert record["completed_gates"] == ["usecase_selection", "project_setup"]


def test_h4_bridge_is_idempotent():
    record = _spa_record(completed_gates=[USE_CASE_GATE, "project_setup"])
    state = build_session_state(record, "lakehouse")
    assert state.completed_gates == [USE_CASE_GATE, "project_setup"]
    again = build_session_state({**record, "completed_gates": state.completed_gates}, "lakehouse")
    assert again.completed_gates.count(USE_CASE_GATE) == 1


@pytest.mark.parametrize(
    ("industry", "use_case"),
    [
        (None, USE_CASE),
        (INDUSTRY, None),
        ("", USE_CASE),
        (INDUSTRY, ""),
        ("   ", USE_CASE),
        (INDUSTRY, "  "),
        (None, None),
    ],
)
def test_h4_bridge_requires_both_non_blank(industry, use_case):
    record = _spa_record(industry=industry, use_case=use_case)
    state = build_session_state(record, "lakehouse")
    assert USE_CASE_GATE not in state.completed_gates
    assert not engine.use_case_resolved(state)


def test_h4_bridge_shares_the_lakebase_intent_rule():
    for record in (
        _spa_record(),
        _spa_record(industry=""),
        _spa_record(use_case=" "),
        _spa_record(industry=None, use_case=None),
    ):
        assert lakebase._has_defined_intent(record) == has_defined_intent(record)
        assert (USE_CASE_GATE in build_session_state(record, "lakehouse").completed_gates) == (
            has_defined_intent(record)
        )


def test_h4_bridge_unknown_usecase_not_credited(mcp_env):
    # D-13/D-15: an uncatalogued pick is never written to the use_case column, so
    # the bridge has nothing to credit — the intent beat still elicits a real pick.
    store, saves, pair_status = mcp_env
    pair_status["value"] = "unknown"
    started = mcp_server.vibe_start_track("lakehouse", use_case="invented_thing", industry=INDUSTRY)
    assert not isinstance(started, dict), started
    record = store[started.session_id]
    assert not (record.get("use_case") or "").strip()
    state = build_session_state(record, "lakehouse")
    assert USE_CASE_GATE not in state.completed_gates
    assert mcp_server._needs_use_case(state)


def test_h4_bridge_never_persists_the_gate(mcp_env):
    # The MCP delta write excludes gates already in ``before``; the bridge credits
    # the gate in ``before`` too, so no MCP call ever writes it on the bridge's behalf.
    store, saves, _ = mcp_env
    store["spa"] = _spa_record(session_id="spa", workshop_level="lakehouse")
    result = mcp_server.vibe_complete_step("spa", "prd_generation", "the prd")
    assert not isinstance(result, dict), result
    assert USE_CASE_GATE not in store["spa"]["completed_gates"]
    assert "prd_generation" in store["spa"]["completed_gates"]
