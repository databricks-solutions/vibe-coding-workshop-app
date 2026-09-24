"""Phase 2 T5 — stateless-per-request proofs for the MCP tool boundary.

These tests pin three properties of the stateless MCP server (contract §8:
"no in-process session state"). Each is written so it would FAIL under a real
regression — an in-process/module-global per-session cache, a cross-session
memory leak, or a non-idempotent retry — rather than being a tautology:

1. TWO-SESSION ISOLATION — two session_ids driven interleaved through the tools
   never share completed_gates / captured_outputs / interactions.
2. PER-REQUEST FRESHNESS — engine decisions read persisted state FRESH on every
   request; a write that lands between two calls is reflected on the next call.
3. IDEMPOTENT RETRIES — replaying vibe_complete_step / vibe_submit_answer neither
   duplicates a gate, overwrites a captured output, corrupts the decision marker,
   nor raises a spurious error.

The fake store below deliberately hands every request a *deep copy* of the
persisted record (so a handler cannot smuggle state via a shared object) and
merges writes back through save_session — mirroring the read-per-request Lakebase
contract. Any in-process caching in mcp_server would make the tool results
diverge from this store and trip the assertions.
"""

import asyncio
import copy
import json
import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.workshop import manifest

SESSION_A = "stateless-session-a"
SESSION_B = "stateless-session-b"


def _fresh_record(session_id):
    return {
        "session_id": session_id,
        "created_by": None,
        "completed_gates": [],
        "captured_outputs": {},
        "session_parameters": {},
    }


def _benchmark_ready_gates():
    steps = manifest.load_manifest().track_steps("genie-accelerator")
    benchmark = next(step for step in steps if step.sectionTag == "gagent_benchmarks")
    return [step.sectionTag for step in steps if step.order < benchmark.order]


@pytest.fixture
def store(monkeypatch):
    """Two independent sessions backed by a fresh-read-per-request fake store."""

    data = {SESSION_A: _fresh_record(SESSION_A), SESSION_B: _fresh_record(SESSION_B)}
    interactions = []

    def load_session(session_id):
        record = data.get(session_id)
        # Deep copy: a handler that mutates the returned dict in place must not
        # affect the store — only save_session persists. This is exactly what a
        # stateless server that re-reads Lakebase every request guarantees.
        return copy.deepcopy(record) if record is not None else None

    def save_session(session_id, **fields):
        data.setdefault(session_id, {"session_id": session_id}).update(copy.deepcopy(fields))
        return True

    def append_session_interaction(*args, **kwargs):
        interactions.append(kwargs)
        return True

    monkeypatch.setattr(mcp_server, "load_session", load_session)
    monkeypatch.setattr(mcp_server, "save_session", save_session)
    monkeypatch.setattr(
        mcp_server, "append_session_interaction", append_session_interaction, raising=False
    )
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: True)
    return data, interactions


# ---------------------------------------------------------------------------
# Property 1 — TWO-SESSION ISOLATION
# ---------------------------------------------------------------------------

def test_two_sessions_driven_interleaved_never_share_state(store):
    data, interactions = store

    # (a) Interaction provenance is attributed to the right session. Both are at
    # the shared first step (project_setup); A answers explicitly, B stays silent
    # (accepting the recommended default).
    a_answer = mcp_server.vibe_submit_answer(SESSION_A, "project_setup.why", "prototype_first")
    b_answer = mcp_server.vibe_submit_answer(SESSION_B, "project_setup.why", "")

    assert a_answer.recorded is True
    assert b_answer.recorded is True
    assert len(interactions) == 2
    by_session = {row["session_id"]: row for row in interactions}
    assert set(by_session) == {SESSION_A, SESSION_B}
    # Real divergence — A's explicit override vs B's recommended default.
    assert by_session[SESSION_A]["answer"] == "prototype_first"
    assert by_session[SESSION_A]["was_default"] is False
    assert by_session[SESSION_B]["answer"] == "governed_first"
    assert by_session[SESSION_B]["was_default"] is True
    assert by_session[SESSION_A]["answer"] != by_session[SESSION_B]["answer"]

    # (b) Interleave the walk. The genie define-usecase order is now
    # project_setup -> use_case_selection -> prd_generation (D11 §3.6), so A walks
    # three gates while B stops after the shared first step.
    mcp_server.vibe_complete_step(SESSION_A, "project_setup", "a-setup")
    mcp_server.vibe_complete_step(SESSION_B, "project_setup", "b-setup")
    # use_case_selection is a blocking confirm (D11 §3.4/T3): confirm the
    # recommended selection before the step can complete.
    mcp_server.vibe_submit_answer(
        SESSION_A, "use_case_selection.usecase_confirmation", "use_certified"
    )
    mcp_server.vibe_complete_step(SESSION_A, "use_case_selection", "A-BRIEF")
    mcp_server.vibe_complete_step(SESSION_A, "prd_generation", "A-PRD")

    # B's ledger is untouched by A's later gates, and A's captured output has not
    # leaked into B.
    assert data[SESSION_A]["completed_gates"] == [
        "project_setup", "use_case_selection", "prd_generation",
    ]
    assert data[SESSION_B]["completed_gates"] == ["project_setup"]
    assert data[SESSION_B]["captured_outputs"] == {}

    # The walk position itself diverges: A is past prd_generation, B is still on
    # the newly inserted use_case_selection step.
    a_next = mcp_server.vibe_next_step(SESSION_A)
    b_next = mcp_server.vibe_next_step(SESSION_B)
    assert a_next.root.sectionTag == "genie_silver_metadata"
    assert b_next.root.sectionTag == "use_case_selection"
    assert a_next.root.sectionTag != b_next.root.sectionTag

    # (c) Now B walks its own use_case_selection + prd_generation with DIFFERENT
    # captured outputs. The two sessions' outputs must be distinct — not a
    # shared/overwritten value.
    mcp_server.vibe_submit_answer(
        SESSION_B, "use_case_selection.usecase_confirmation", "use_certified"
    )
    mcp_server.vibe_complete_step(SESSION_B, "use_case_selection", "B-BRIEF")
    mcp_server.vibe_complete_step(SESSION_B, "prd_generation", "B-PRD")
    assert data[SESSION_A]["captured_outputs"]["prd_document"] == "A-PRD"
    assert data[SESSION_B]["captured_outputs"]["prd_document"] == "B-PRD"
    assert data[SESSION_A]["captured_outputs"] != data[SESSION_B]["captured_outputs"]


def test_completing_one_session_does_not_advance_the_other(store):
    data, _ = store

    # Fully load only session A's ledger through prd_generation (including the
    # new use_case_selection gate, D11 §3.6); B stays empty.
    data[SESSION_A]["completed_gates"] = [
        "project_setup", "use_case_selection", "prd_generation",
    ]

    a_next = mcp_server.vibe_next_step(SESSION_A)
    b_next = mcp_server.vibe_next_step(SESSION_B)

    assert a_next.root.sectionTag == "genie_silver_metadata"
    # B must still be at the very first step — A's gates never bled across.
    assert b_next.root.sectionTag == "project_setup"


# ---------------------------------------------------------------------------
# Property 2 — PER-REQUEST FRESHNESS
# ---------------------------------------------------------------------------

def test_next_step_reads_gate_ledger_fresh_between_requests(store):
    data, _ = store

    first = mcp_server.vibe_next_step(SESSION_A)
    assert first.root.sectionTag == "project_setup"

    # A concurrent writer (the web UI, or another request for the same session)
    # persists a completed gate BETWEEN the two tool calls. A stateless server
    # must observe it on the very next request; an in-process cache would not.
    data[SESSION_A]["completed_gates"] = ["project_setup"]

    second = mcp_server.vibe_next_step(SESSION_A)
    # After project_setup the walk advances to the newly inserted use_case_selection
    # step (D11 §3.6), not straight to prd_generation.
    assert second.root.sectionTag == "use_case_selection"
    assert second.root.sectionTag != first.root.sectionTag


def test_get_step_reflects_externally_written_parameters(store):
    data, _ = store

    # Baseline: current step is project_setup with default parameters.
    baseline = mcp_server.vibe_get_step(SESSION_A)
    assert baseline.sectionTag == "project_setup"

    # A concurrent writer changes session parameters out-of-band.
    data[SESSION_A]["session_parameters"] = {"industry": "Healthcare", "use_case": "Claims"}

    # The next read must resolve against the freshly-persisted parameters — the
    # engine never reuses an in-process SessionState.
    refreshed = mcp_server.vibe_get_step(SESSION_A)
    assert refreshed.sectionTag == "project_setup"
    # set_parameters likewise merges onto freshly-read state (not a stale copy).
    result = mcp_server.vibe_set_parameters(SESSION_A, {"catalog": "prod"})
    assert result.resolved_params == {
        "industry": "Healthcare",
        "use_case": "Claims",
        "catalog": "prod",
    }


def _read_session_state_resource(session_id):
    """Read vibe://session/{id}/state through the registered MCP resource layer
    (template resolution + Resource.read), not the private handler."""

    async def _read():
        manager = mcp_server.mcp._resource_manager
        resource = await manager.get_resource(f"vibe://session/{session_id}/state")
        assert resource is not None
        return await resource.read()

    return json.loads(asyncio.run(_read()))


def test_session_state_resource_reflects_external_writes_on_next_read(store):
    data, _ = store

    first = _read_session_state_resource(SESSION_A)
    assert first["completed_gates"] == []
    assert first["captured_output_keys"] == []

    # Persist progress out-of-band, then re-read the (ttlMs:0, no-cache) resource.
    data[SESSION_A]["completed_gates"] = ["project_setup", "prd_generation"]
    data[SESSION_A]["captured_outputs"] = {"prd_document": "written elsewhere"}

    second = _read_session_state_resource(SESSION_A)
    assert second["completed_gates"] == ["project_setup", "prd_generation"]
    assert second["captured_output_keys"] == ["prd_document"]
    assert second != first


# ---------------------------------------------------------------------------
# Property 3 — IDEMPOTENT RETRIES
# ---------------------------------------------------------------------------

def test_complete_step_replay_is_idempotent_and_re_reads_fresh(store):
    """A complete_step retry is idempotent success AND reads persisted state fresh.

    Cache-sensitive by construction: a concurrent writer advances SESSION_A's
    persisted ledger between the two calls. A stateless server re-reads it on the
    retry and preserves it; a cached in-process SessionState would replay against
    the stale object and clobber the out-of-band write on save — so this test
    fails on its own under a shared-cache bug.
    """
    data, interactions = store
    # prd_generation now gates on use_case_selection (D11 §3.6); seed both
    # predecessor gates so the first completion is unlocked.
    data[SESSION_A]["completed_gates"] = ["project_setup", "use_case_selection"]

    first = mcp_server.vibe_complete_step(SESSION_A, "prd_generation", "ORIGINAL")
    assert isinstance(first, mcp_server.CompleteStepResult)
    assert data[SESSION_A]["captured_outputs"] == {"prd_document": "ORIGINAL"}

    # Concurrent out-of-band write for the SAME session between the two calls.
    data[SESSION_A]["completed_gates"] = [
        "project_setup", "use_case_selection", "prd_generation", "genie_silver_metadata",
    ]
    data[SESSION_A]["captured_outputs"]["table_metadata"] = "OUT-OF-BAND"

    second = mcp_server.vibe_complete_step(
        SESSION_A, "prd_generation", "REPLAY-MUST-NOT-OVERWRITE"
    )

    # No spurious error — re-completing a done gate is idempotent success (§6/D3 F3).
    assert isinstance(second, mcp_server.CompleteStepResult)
    # The retry saw the out-of-band gate (fresh read) and did not duplicate it.
    assert data[SESSION_A]["completed_gates"] == [
        "project_setup", "use_case_selection", "prd_generation", "genie_silver_metadata",
    ]
    assert data[SESSION_A]["completed_gates"].count("prd_generation") == 1
    # The out-of-band output survived (fresh read) AND the replay payload did NOT
    # overwrite the original captured output.
    assert data[SESSION_A]["captured_outputs"] == {
        "prd_document": "ORIGINAL",
        "table_metadata": "OUT-OF-BAND",
    }
    # complete_step never touches the interaction provenance log.
    assert interactions == []


def test_submit_answer_confirmation_survives_a_different_retry_answer(store):
    """A recorded confirmation is not overwritten/cleared by a different retry
    answer, and never leaks across sessions.

    - Overwrite probe (BLOCKING 1): the retry submits a DIFFERENT valid answer
      ("not_ready"), so an overwrite/clear of the marker is observable — the
      assertion goes RED if the retry mutated the decision marker.
    - Cache-sensitive (BLOCKING 2): an interleaved SESSION_B confirmation with a
      distinct captured output must stay distinct. Under a shared cache, B would
      read/persist SESSION_A's outputs and the B assertion fails on its own.
    """
    data, interactions = store
    marker = mcp_server.decision_capture_key(
        "gagent_benchmarks", "gagent_benchmarks.benchmark_confirmation"
    )
    data[SESSION_A]["completed_gates"] = _benchmark_ready_gates()
    data[SESSION_A]["captured_outputs"] = {"prd_document": "A-PRD"}
    data[SESSION_B]["completed_gates"] = _benchmark_ready_gates()
    data[SESSION_B]["captured_outputs"] = {"prd_document": "B-PRD"}

    first = mcp_server.vibe_submit_answer(
        SESSION_A, "gagent_benchmarks.benchmark_confirmation", "confirm"
    )
    assert first.recorded is True
    assert first.unblocks == "gagent_benchmarks"
    assert data[SESSION_A]["captured_outputs"][marker] == "confirm"

    # Interleave SESSION_B confirming its OWN benchmark.
    b_result = mcp_server.vibe_submit_answer(
        SESSION_B, "gagent_benchmarks.benchmark_confirmation", "confirm"
    )
    assert b_result.unblocks == "gagent_benchmarks"

    # Retry SESSION_A with a DIFFERENT valid answer. It must neither re-confirm nor
    # clear/overwrite the confirmation already recorded on the first call.
    second = mcp_server.vibe_submit_answer(
        SESSION_A, "gagent_benchmarks.benchmark_confirmation", "not_ready"
    )
    assert second.recorded is True
    assert second.unblocks is None

    # SESSION_A: the marker reflects the FIRST accepted decision, unchanged. Exactly
    # one marker key mapping to "confirm"; this assertion fails if the retry
    # overwrote the value or dropped the key.
    a_captured = data[SESSION_A]["captured_outputs"]
    assert [key for key in a_captured if key == marker] == [marker]
    assert a_captured[marker] == "confirm"
    assert a_captured == {"prd_document": "A-PRD", marker: "confirm"}

    # SESSION_B stays distinct — its captured output is B-PRD, never A-PRD.
    b_captured = data[SESSION_B]["captured_outputs"]
    assert b_captured["prd_document"] == "B-PRD"
    assert b_captured[marker] == "confirm"
    assert a_captured != b_captured

    # Append-only provenance (§12 / DDL 12_mcp_engine_state.sql): every attempt is
    # recorded, attributed to the right session and answer — asserted concretely,
    # not by a bare count.
    assert [(row["session_id"], row["answer"]) for row in interactions] == [
        (SESSION_A, "confirm"),
        (SESSION_B, "confirm"),
        (SESSION_A, "not_ready"),
    ]


def test_complete_step_replay_reflects_out_of_band_reload(store):
    """Replaying complete_step re-reads the persisted ledger fresh: a gate a
    concurrent writer already recorded out-of-band is neither duplicated nor lost,
    and its captured output is preserved.

    Cache-sensitive: a cached in-process SessionState would replay against a stale
    object and clobber the out-of-band write on save, so this test fails on its own
    under a shared-cache bug.
    """
    data, interactions = store

    first = mcp_server.vibe_complete_step(SESSION_A, "project_setup", "setup")
    assert first.completed_gates == ["project_setup"]

    # Out-of-band: another request/UI for the SAME session completes the next gate
    # and records its output while our caller was idle (the actual reload step).
    data[SESSION_A]["completed_gates"] = ["project_setup", "prd_generation"]
    data[SESSION_A]["captured_outputs"] = {"prd_document": "OUT-OF-BAND-PRD"}

    # Replay the already-done project_setup completion — it must re-read fresh.
    second = mcp_server.vibe_complete_step(SESSION_A, "project_setup", "setup-again")
    assert isinstance(second, mcp_server.CompleteStepResult)

    gates = data[SESSION_A]["completed_gates"]
    assert gates == ["project_setup", "prd_generation"]
    assert gates.count("project_setup") == 1
    assert gates.count("prd_generation") == 1
    # The out-of-band captured output survived the replay (proves fresh re-read),
    # and project_setup (produces nothing) did not overwrite it.
    assert data[SESSION_A]["captured_outputs"] == {"prd_document": "OUT-OF-BAND-PRD"}
    assert interactions == []
