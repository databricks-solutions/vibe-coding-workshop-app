"""T5 R4b symmetry pins (from the R4b cross-review).

R4a (#70) stopped WRITING the legacy step columns; R4b (#71) stopped READING
them, leaving a gates-only contract: progress is resolved purely from the gate
sets — ``completed_gates`` (its own column) and ``skipped_gates`` (nested in the
``session_parameters`` JSONB) — mapped tag -> GLOBAL number via the shared
``step_number_to_tag`` inverse. The retired ``completed_steps`` /
``skipped_steps`` / ``current_step`` columns are never read.

The cross-review asked for three symmetry pins the gates-only contract was
missing a direct behavioural anchor for. Each is a both-direction tamper (see the
PR body for the exact fail-before edit):

a. ENGINE read path — ``state.build_session_state`` with ``completed_gates``
   empty but ``session_parameters['skipped_gates']`` populated still resolves the
   skips through the engine (there is no gates-empty conditional and no numeric
   fallback). Mirror of the aggregation-side pin
   ``test_skipped_resolves_from_skipped_gates_when_completed_empty``, now on the
   REST/MCP outline read path.
b. LEADERBOARD skipped end-to-end — ``get_leaderboard`` sources skipped from
   ``skipped_gates`` (not a numeric column), a completed-empty row contributes no
   completions (so it never ranks), and the score excludes nothing it should not.
c. ``SessionLoadResponse.model_dump()`` carries NONE of the three legacy step
   keys — the serialization boundary stays gates-only.

Run offline (no Lakebase): these exercise the pure engine / orchestration, not a
live DB.
"""

import asyncio
import json
import pathlib
import sys
from contextlib import contextmanager

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.services import lakebase
from src.backend.workshop import engine
from src.backend.workshop.state import DEFAULT_TRACK, build_session_state

# genie-accelerator outline tags (verified present in the composed outline).
_SKIPPED_TAG = "semlayer_profile"  # global 58


# =============================================================================
# (a) ENGINE read path — build_session_state preserves skipped_gates verbatim so
# the engine resolves skips even when completed_gates is empty.
# TAMPER (state.py build_session_state): reintroduce a gates-empty conditional,
# e.g. `if not completed_gates: params.pop("skipped_gates", None)` (the pre-R4b
# "skipped only when completions present" fallback) -> _SKIPPED_TAG is no longer
# "skipped" and this fails; restore to pass.
# =============================================================================


def test_build_session_state_resolves_skipped_from_gates_when_completed_empty():
    record = {
        "completed_gates": [],  # no completions
        "session_parameters": {"skipped_gates": [_SKIPPED_TAG]},
    }
    state = build_session_state(record, track=DEFAULT_TRACK)

    # skipped_gates survived the verbatim copy into session_parameters (the engine
    # reads skips from there — state.py does not re-index or drop them).
    assert state.session_parameters["skipped_gates"] == [_SKIPPED_TAG]

    statuses = {s.sectionTag: s.status for s in engine.outline(DEFAULT_TRACK, state)}
    assert statuses[_SKIPPED_TAG] == "skipped"
    # Nothing is "done": completed_gates is empty and no numeric column resurrects it.
    assert "done" not in set(statuses.values())


# =============================================================================
# (b) LEADERBOARD skipped end-to-end — get_leaderboard sources skipped purely from
# skipped_gates. A completed-empty (skipped-only) row contributes 0 completions, so
# the `if not completed_globals: continue` guard drops it (it never ranks — the
# "completed_step_count 0" case can only exist at the resolver, not as an entry; see
# PR body). The mixed row carries skipped_step_count/skipped_globals from the gates.
# TAMPER (lakebase._row_completion_globals): point skipped at the retired numeric
# column, e.g. `skipped_gates=_parse_json_list(row.get("skipped_steps"))` -> the
# mixed row's skipped_step_count becomes 3 (the stale decoy) and skipped_globals
# changes -> this fails; restore to pass.
# =============================================================================


def _gate_row(email, completed_gates, skipped_gates=None, stale_skipped=None):
    row = {
        "created_by": email,
        "session_id": f"s-{email}",
        "updated_at": None,
        "workshop_level": "genie-accelerator",
        "completed_gates": json.dumps(completed_gates),
        "session_parameters": json.dumps({"skipped_gates": skipped_gates or []}),
    }
    if stale_skipped is not None:
        # Retired numeric column — present only to prove it is never read.
        row["skipped_steps"] = json.dumps(stale_skipped)
    return row


@contextmanager
def _fake_get_connection():
    yield object()


class _RecCursor:
    def __init__(self, rows):
        self._rows = rows

    def execute(self, sql, params=None):
        pass

    def fetchall(self):
        return [dict(r) for r in self._rows]

    def fetchone(self):
        return None

    def close(self):
        pass


def _install_leaderboard_rows(monkeypatch, rows):
    monkeypatch.setattr(lakebase, "is_lakebase_configured", lambda: True)
    monkeypatch.setattr(lakebase, "_get_sessions_table_name", lambda: "genie.sessions")
    monkeypatch.setattr(lakebase, "get_connection", _fake_get_connection)
    monkeypatch.setattr(lakebase, "_dict_cursor", lambda conn: _RecCursor(rows))


def test_get_leaderboard_skipped_count_is_gate_derived_and_skipped_only_row_drops(monkeypatch):
    # setup_lakebase -> global 6; genie_space/agent_framework -> globals 17,18.
    skipped_only = _gate_row("skip@x.com", completed_gates=[], skipped_gates=["setup_lakebase"])
    mixed = _gate_row(
        "mixed@x.com",
        completed_gates=["genie_space", "agent_framework"],
        skipped_gates=["setup_lakebase"],
        stale_skipped=[99, 98, 97],  # retired numeric column — must be ignored
    )
    _install_leaderboard_rows(monkeypatch, [skipped_only, mixed])

    result = lakebase.get_leaderboard(limit=10)
    user_ids = {e["user_id"] for e in result}

    # The completed-empty (skipped-only) row contributes 0 completions and never ranks.
    assert "skip@x.com" not in user_ids

    entry = next(e for e in result if e["user_id"] == "mixed@x.com")
    assert entry["completed_step_count"] == 2
    # Skipped sourced from skipped_gates ([6]), NOT the stale numeric [99,98,97].
    assert entry["skipped_step_count"] == 1
    assert entry["skipped_globals"] == [6]
    # score = STEP_SCORES[17] + STEP_SCORES[18]; the skipped global (6) is not a
    # completion, so it neither adds nor is wrongly double-counted.
    assert entry["score"] == lakebase._calculate_score([17, 18], [6])


# =============================================================================
# (c) Serialization boundary — SessionLoadResponse.model_dump() carries none of the
# three retired legacy step keys; the contract is gate-keyed only.
# TAMPER (routes.SessionLoadResponse): re-add any one field, e.g.
# `completed_steps: List[int] = Field(default_factory=list)` -> that key reappears
# in the dump and this fails; restore to pass.
# =============================================================================


def test_session_load_response_dump_has_no_legacy_step_keys():
    from src.backend.api.routes import SessionLoadResponse

    resp = SessionLoadResponse(
        success=True,
        session_id="s-1",
        completed_gates=["project_setup"],
        skipped_gates=["semlayer_locate"],
        message="ok",
    )
    dumped = resp.model_dump()

    for legacy in ("completed_steps", "skipped_steps", "current_step"):
        assert legacy not in dumped, f"retired legacy key {legacy!r} leaked into the response"

    # The gate-keyed contract is what remains.
    assert dumped["completed_gates"] == ["project_setup"]
    assert dumped["skipped_gates"] == ["semlayer_locate"]
