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

    # (b) Interleave the walk. A advances two gates; B advances one.
    mcp_server.vibe_complete_step(SESSION_A, "project_setup", "a-setup")
    mcp_server.vibe_complete_step(SESSION_B, "project_setup", "b-setup")
    mcp_server.vibe_complete_step(SESSION_A, "prd_generation", "A-PRD")

    # B's ledger is untouched by A's second gate, and A's captured output has not
    # leaked into B.
    assert data[SESSION_A]["completed_gates"] == ["project_setup", "prd_generation"]
    assert data[SESSION_B]["completed_gates"] == ["project_setup"]
    assert data[SESSION_B]["captured_outputs"] == {}

    # The walk position itself diverges: A is past prd_generation, B is still on it.
    a_next = mcp_server.vibe_next_step(SESSION_A)
    b_next = mcp_server.vibe_next_step(SESSION_B)
    assert a_next.root.sectionTag == "genie_silver_metadata"
    assert b_next.root.sectionTag == "prd_generation"
    assert a_next.root.sectionTag != b_next.root.sectionTag

    # (c) Now B completes prd_generation with a DIFFERENT captured output. The two
    # sessions' outputs must be distinct — not a shared/overwritten value.
    mcp_server.vibe_complete_step(SESSION_B, "prd_generation", "B-PRD")
    assert data[SESSION_A]["captured_outputs"]["prd_document"] == "A-PRD"
    assert data[SESSION_B]["captured_outputs"]["prd_document"] == "B-PRD"
    assert data[SESSION_A]["captured_outputs"] != data[SESSION_B]["captured_outputs"]


def test_completing_one_session_does_not_advance_the_other(store):
    data, _ = store

    # Fully load only session A's ledger; B stays empty.
    data[SESSION_A]["completed_gates"] = ["project_setup", "prd_generation"]

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
    assert second.root.sectionTag == "prd_generation"
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


def test_session_state_resource_reflects_external_writes_on_next_read(store):
    data, _ = store

    first = json.loads(mcp_server._session_state_resource(SESSION_A))
    assert first["completed_gates"] == []
    assert first["captured_output_keys"] == []

    # Persist progress out-of-band, then re-read the (ttlMs:0, no-cache) resource.
    data[SESSION_A]["completed_gates"] = ["project_setup", "prd_generation"]
    data[SESSION_A]["captured_outputs"] = {"prd_document": "written elsewhere"}

    second = json.loads(mcp_server._session_state_resource(SESSION_A))
    assert second["completed_gates"] == ["project_setup", "prd_generation"]
    assert second["captured_output_keys"] == ["prd_document"]
    assert second != first


# ---------------------------------------------------------------------------
# Property 3 — IDEMPOTENT RETRIES
# ---------------------------------------------------------------------------

def test_complete_step_replay_is_idempotent_success(store):
    data, interactions = store
    data[SESSION_A]["completed_gates"] = ["project_setup"]

    first = mcp_server.vibe_complete_step(SESSION_A, "prd_generation", "ORIGINAL")
    second = mcp_server.vibe_complete_step(SESSION_A, "prd_generation", "REPLAY-MUST-NOT-OVERWRITE")

    # No spurious error — re-completing a done gate is idempotent success (§6/D3 F3).
    assert isinstance(first, mcp_server.CompleteStepResult)
    assert isinstance(second, mcp_server.CompleteStepResult)
    assert first.completed_gates == ["project_setup", "prd_generation"]
    assert second.completed_gates == ["project_setup", "prd_generation"]

    # Gate recorded exactly once — no duplicate append.
    assert data[SESSION_A]["completed_gates"].count("prd_generation") == 1
    assert data[SESSION_A]["completed_gates"] == ["project_setup", "prd_generation"]
    # Captured output is preserved, NOT overwritten by the replay's payload.
    assert data[SESSION_A]["captured_outputs"] == {"prd_document": "ORIGINAL"}
    # complete_step never touches the interaction provenance log.
    assert interactions == []


def test_submit_answer_decision_marker_is_idempotent_on_replay(store):
    data, interactions = store
    data[SESSION_A]["completed_gates"] = _benchmark_ready_gates()

    first = mcp_server.vibe_submit_answer(
        SESSION_A, "gagent_benchmarks.benchmark_confirmation", "confirm"
    )
    second = mcp_server.vibe_submit_answer(
        SESSION_A, "gagent_benchmarks.benchmark_confirmation", "confirm"
    )

    # No spurious error on retry; the confirm keeps unblocking the hard stop.
    assert first.recorded is True and second.recorded is True
    assert first.unblocks == "gagent_benchmarks"
    assert second.unblocks == "gagent_benchmarks"

    marker = mcp_server.decision_capture_key(
        "gagent_benchmarks", "gagent_benchmarks.benchmark_confirmation"
    )
    # The STATE that gates progression — the captured_outputs decision marker —
    # is written exactly once with a stable value. A retry neither adds a second
    # key nor corrupts the value. This is the idempotency a stateless re-read
    # regression would actually break.
    decision_keys = [key for key in data[SESSION_A]["captured_outputs"] if key == marker]
    assert decision_keys == [marker]
    assert data[SESSION_A]["captured_outputs"][marker] == "confirm"

    # NOTE: session_interactions is an APPEND-ONLY provenance table by design
    # (db/lakebase/ddl/12_mcp_engine_state.sql; pinned by test_interactivity's
    # single-submit assertions). Recording each attempt — including a retry — is
    # intended provenance, so a replay does append a second provenance row. The
    # correctness-bearing idempotency lives on the session STATE asserted above,
    # not on the audit trail; this assertion documents that intended behavior.
    assert len(interactions) == 2


def test_complete_step_replay_after_reload_never_double_appends_gate(store):
    """Drive a two-step walk, then replay every completion. Each gate must appear
    exactly once and every captured output must keep its first value — proving the
    walk is rebuilt from freshly-read state, not from an accumulating in-process
    list."""
    data, _ = store

    mcp_server.vibe_complete_step(SESSION_A, "project_setup", "setup")
    mcp_server.vibe_complete_step(SESSION_A, "prd_generation", "prd-v1")
    # Replay both, out of order, with different payloads.
    mcp_server.vibe_complete_step(SESSION_A, "prd_generation", "prd-v2")
    mcp_server.vibe_complete_step(SESSION_A, "project_setup", "setup-again")

    gates = data[SESSION_A]["completed_gates"]
    assert gates == ["project_setup", "prd_generation"]
    assert gates.count("project_setup") == 1
    assert gates.count("prd_generation") == 1
    assert data[SESSION_A]["captured_outputs"] == {"prd_document": "prd-v1"}
