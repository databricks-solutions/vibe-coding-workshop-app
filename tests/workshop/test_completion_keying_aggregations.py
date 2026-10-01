"""T5 R4b — the leaderboard / analytics completion AGGREGATIONS are gate-derived.

Post-R4b there is no origin decision and no numeric fallback: a session's
completed/skipped GLOBAL step numbers come purely from its gate sets
(``completed_gates`` + ``skipped_gates`` in ``session_parameters``), mapped
tag -> GLOBAL number via the ``step_number_to_tag`` inverse. The retired numeric
columns are never read.

This file pins:

1. **Gates map to GLOBAL numbers** (completed from ``completed_gates``, skipped
   from ``skipped_gates``), unresolved tags dropped.
2. **No numeric fallback** — a row whose gates are empty yields NO progress even
   when the retired numeric column still carries values (number-independence /
   R4b tamper: re-add a numeric read and this fails).
3. **Skipped is ALWAYS gates-sourced** — a row with ``completed_gates`` empty but
   ``skipped_gates`` set still resolves its skips (the behaviour change vs the old
   gates-empty conditional).
4. **Convergence** — a gate row scores/counts identically whether or not a stale
   numeric column is present.
5. Scoring COVERAGE + BE/FE parity, step-1 intent credit, the LeaderboardEntry
   serialization boundary, and the SQL JSONB-empty-string guard end-to-end.

Run offline (no Lakebase): these exercise the pure helpers / orchestration, not
a live DB.
"""

import json
import pathlib
import re
import shutil
import subprocess
import sys
from contextlib import contextmanager

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.services import lakebase
from src.backend.workshop import manifest
from src.backend.workshop.completion_keying import (
    resolve_completion_globals,
    tag_to_global_number,
)

INVERSE = tag_to_global_number()


# =============================================================================
# Row builders — rows are keyed PURELY on gates (R4b). `stale_numbers`, when
# given, populates the RETIRED numeric column to prove the resolver IGNORES it.
# =============================================================================


def _gate_row(email, completed_gates, skipped_gates=None, stale_numbers=None, stale_skipped=None):
    row = {
        "created_by": email,
        "completed_gates": json.dumps(completed_gates),
        "session_parameters": json.dumps({"skipped_gates": skipped_gates or []}),
    }
    # The retired numeric columns. Present only to prove they are never read.
    if stale_numbers is not None:
        row["completed_steps"] = json.dumps(stale_numbers)
    if stale_skipped is not None:
        row["skipped_steps"] = json.dumps(stale_skipped)
    return row


def _new_leaderboard(rows):
    """Mirror of get_leaderboard's per-user best-score reduction over the real
    gate-derived helper."""
    best = {}
    for row in rows:
        cg, sg = lakebase._row_completion_globals(row, INVERSE)
        completed = sorted(cg)
        if not completed:
            continue
        score = lakebase._calculate_score(completed, sorted(sg))
        entry = {"score": score, "completed_step_count": len(cg)}
        email = row["created_by"]
        if email not in best or score > best[email]["score"]:
            best[email] = entry
    return best


def _new_step_completion(rows):
    return lakebase._aggregate_step_completion(rows, INVERSE)


# =============================================================================
# Helper-level anchors.
# =============================================================================


def test_inverse_map_is_the_step_number_to_tag_inverse():
    fwd = manifest.step_number_to_tag()
    assert INVERSE == {tag: num for num, tag in fwd.items()}
    assert INVERSE["setup_lakebase"] == 6
    assert INVERSE["genie_space"] == 17
    assert INVERSE["semlayer_locate"] == 57  # the high global the old code dropped


def test_gates_map_to_globals():
    """completed from completed_gates, skipped from skipped_gates."""
    completed, skipped = resolve_completion_globals(
        completed_gates=["genie_space", "agent_framework"],
        skipped_gates=["setup_lakebase"],
        inverse_map=INVERSE,
    )
    assert completed == {17, 18}
    assert skipped == {6}


def test_unresolved_gate_dropped_not_misindexed():
    completed, skipped = resolve_completion_globals(
        completed_gates=["not_a_real_tag"],
        skipped_gates=["also_bogus"],
        inverse_map=INVERSE,
    )
    assert completed == set()
    assert skipped == set()


# =============================================================================
# R4b — no numeric fallback (number-independence). TAMPER: re-add a read of the
# retired numeric column and these fail.
# =============================================================================


def test_empty_gates_with_stale_numbers_yields_no_progress():
    """gates empty + a stale completed_steps column => NO completion (R4b)."""
    row = _gate_row("legacy@x.com", [], stale_numbers=[1, 2, 3])
    completed, skipped = lakebase._row_completion_globals(row, INVERSE)
    assert completed == set(), "retired numeric column must NOT be read"
    assert skipped == set()


def test_stale_numbers_ignored_when_gates_present():
    """gates present + a DIFFERENT stale numeric column => gates win, numbers ignored."""
    row = _gate_row(
        "mcp@x.com",
        ["genie_space", "agent_framework"],  # -> globals 17,18
        stale_numbers=[1, 2],                 # retired dense positions, must be ignored
    )
    completed, _skipped = lakebase._row_completion_globals(row, INVERSE)
    assert completed == {17, 18}


def test_convergence_number_independent_score_and_counts():
    """A gate row scores/counts identically whether or not a stale numeric column
    is present — the aggregations no longer depend on the retired columns."""
    clean = _gate_row("a@x.com", ["genie_space", "agent_framework"])
    with_stale = _gate_row("b@x.com", ["genie_space", "agent_framework"], stale_numbers=[1, 2, 99])

    lb = _new_leaderboard([clean, with_stale])
    assert lb["a@x.com"] == lb["b@x.com"]
    assert lb["a@x.com"]["score"] == 100
    assert lb["a@x.com"]["completed_step_count"] == 2

    assert _new_step_completion([clean]) == _new_step_completion([with_stale]) == [
        {"step_number": 17, "completed": 1, "skipped": 0},
        {"step_number": 18, "completed": 1, "skipped": 0},
    ]


# =============================================================================
# R4b — skipped is ALWAYS gates-sourced, even when completed_gates is empty (the
# behaviour change vs the old gates-empty conditional). dispatch convergence req.
# =============================================================================


def test_skipped_resolves_from_skipped_gates_when_completed_empty():
    row = _gate_row(
        "skip@x.com",
        completed_gates=[],                  # no completions
        skipped_gates=["setup_lakebase"],    # -> global 6
        stale_skipped=[99],                  # retired column, must be ignored
    )
    completed, skipped = lakebase._row_completion_globals(row, INVERSE)
    assert completed == set()
    assert skipped == {6}

    # And it surfaces in the analytics step-completion aggregation.
    assert _new_step_completion([row]) == [
        {"step_number": 6, "completed": 0, "skipped": 1},
    ]


def test_skipped_lockstep_with_completed_gates():
    row = _gate_row("m@x.com", ["genie_space"], skipped_gates=["agent_framework"])
    assert _new_step_completion([row]) == [
        {"step_number": 17, "completed": 1, "skipped": 0},
        {"step_number": 18, "completed": 0, "skipped": 1},
    ]


# =============================================================================
# Gate-only genie HIGH globals 57+ — the class the pre-R4b WHERE/unnest dropped.
# =============================================================================

GENIE_GATES = ["semlayer_locate", "semlayer_profile", "semlayer_measures"]  # 57,58,59


def test_genie_high_globals_scored_and_counted():
    row = _gate_row("g@x.com", GENIE_GATES)
    lb = _new_leaderboard([row])
    assert lb["g@x.com"]["completed_step_count"] == 3
    assert _new_step_completion([row]) == [
        {"step_number": 57, "completed": 1, "skipped": 0},
        {"step_number": 58, "completed": 1, "skipped": 0},
        {"step_number": 59, "completed": 1, "skipped": 0},
    ]


# =============================================================================
# Serialization boundary — the gate-derived count fields must SURVIVE onto the
# LeaderboardEntry response model (Pydantic v2 extra='ignore' strips undeclared
# fields). The renamed GLOBAL-number arrays ride alongside.
# =============================================================================


def _leaderboard_entry_dict():
    return {
        "rank": 1,
        "user_id": "mcp@x.com",
        "session_id": "s-1",
        "display_name": "Mcp M.",
        "avatar": "🦊",
        "score": 0,
        "completed_globals": [57, 58, 59],
        "skipped_globals": [60],
        # Explicit gate-derived counts, deliberately != the array lengths so a
        # test could not pass by coincidence measuring the arrays.
        "completed_step_count": 3,
        "skipped_step_count": 1,
        "completed_chapters": [],
        "in_progress_chapters": [],
        "updated_at": None,
        "workshop_level": "genie-accelerator",
    }


def test_leaderboard_entry_preserves_gate_derived_counts():
    from src.backend.api.routes import LeaderboardEntry

    entry = _leaderboard_entry_dict()
    model = LeaderboardEntry(**entry)
    assert model.completed_step_count == 3
    assert model.skipped_step_count == 1

    dumped = model.model_dump()
    assert dumped["completed_step_count"] == 3
    assert dumped["skipped_step_count"] == 1
    # Renamed GLOBAL-number arrays survive, under the new names.
    assert dumped["completed_globals"] == [57, 58, 59]
    assert dumped["skipped_globals"] == [60]


def test_leaderboard_entry_counts_optional_for_legacy_shape():
    from src.backend.api.routes import LeaderboardEntry

    entry = _leaderboard_entry_dict()
    del entry["completed_step_count"]
    del entry["skipped_step_count"]
    model = LeaderboardEntry(**entry)
    assert model.completed_step_count is None
    assert model.skipped_step_count is None


# =============================================================================
# SQL-orchestration boundary — the gate-admitting WHERE branches must NOT compare
# a JSONB column to '' (Postgres casts '' to jsonb at parse time -> ERROR;
# execute_query swallows it and returns [] -> avg_score silently 0 and
# step_completion_counts silently EMPTY in prod). These RECORD every SQL string
# the aggregation issues (DB stubbed, offline) and assert (a) no JSONB column is
# compared to '', (b) get_analytics() returns non-empty counts AND non-zero
# avg_score end-to-end, and (c) get_leaderboard() admits the gate row.
#
# TAMPER: re-add `completed_gates != ''` (or `skipped_gates != ''`) to any query
# -> assertion (a) FAILS. An offline stub cannot prove Postgres JSONB semantics;
# the human re-runs the live read-only predicate check at the gate.
# =============================================================================

_JSONB_EMPTY_STRING_RE = re.compile(
    r"(completed_gates|session_parameters|captured_outputs|skipped_gates)\s*(!=|<>)\s*''"
)


def _analytics_cohort_rows():
    """A gate-scored row (globals 17,18 -> score 100) and a gate-only genie row
    (globals 57-59). Carry the extra keys the various analytics queries read."""
    a = _gate_row("app@x.com", ["genie_space", "agent_framework"])
    g = _gate_row("mcp@x.com", GENIE_GATES)
    for r, sid in ((a, "s-app"), (g, "s-mcp")):
        r["session_id"] = sid
        r["feedback_rating"] = None
        r["workshop_level"] = "genie-accelerator"
    return [a, g]


def _install_recording_execute_query(monkeypatch, recorded):
    rows = _analytics_cohort_rows()

    def _fake_execute_query(sql, params=None):
        recorded.append(sql)
        if "total_sessions" in sql:
            return [{"total_sessions": 2, "total_users": 2, "total_feedback": 0,
                     "positive_count": 0, "negative_count": 0}]
        if "avg_steps_per_session" in sql and "prereqs_completed" in sql:
            return [{"avg_steps_per_session": 0, "prereqs_completed": 0, "saved_sessions": 0}]
        if "total_prompts" in sql:
            return [{"total_prompts": 0}]
        # score_rows / avg_rows / step_rows / user_rows / recent_rows all select
        # the completed_gates column; the summary/by-* queries do not.
        if "completed_gates" in sql:
            return [dict(r) for r in rows]
        return []

    monkeypatch.setattr(lakebase, "is_lakebase_configured", lambda: True)
    monkeypatch.setattr(lakebase, "_get_sessions_table_name", lambda: "genie.sessions")
    monkeypatch.setattr(lakebase, "execute_query", _fake_execute_query)


def test_get_analytics_issues_no_jsonb_empty_string_comparison(monkeypatch):
    recorded: list = []
    _install_recording_execute_query(monkeypatch, recorded)

    result = lakebase.get_analytics()

    offenders = [s for s in recorded if _JSONB_EMPTY_STRING_RE.search(s)]
    assert offenders == [], f"JSONB column compared to '': {offenders}"

    assert result["step_completion_counts"], "step_completion_counts empty"
    assert result["usage"]["avg_score"] > 0, "avg_score silently zero"
    steps = {c["step_number"] for c in result["step_completion_counts"]}
    assert {17, 18, 57, 58, 59} <= steps


def _install_recording_leaderboard(monkeypatch, recorded):
    rows = _analytics_cohort_rows()

    class _RecCursor:
        def execute(self, sql, params=None):
            recorded.append(sql)

        def fetchall(self):
            return [dict(r) for r in rows]

        def fetchone(self):
            return None

        def close(self):
            pass

    @contextmanager
    def _fake_get_connection():
        yield object()

    monkeypatch.setattr(lakebase, "is_lakebase_configured", lambda: True)
    monkeypatch.setattr(lakebase, "_get_sessions_table_name", lambda: "genie.sessions")
    monkeypatch.setattr(lakebase, "get_connection", _fake_get_connection)
    monkeypatch.setattr(lakebase, "_dict_cursor", lambda conn: _RecCursor())


def test_get_leaderboard_issues_no_jsonb_empty_string_and_admits_gate_row(monkeypatch):
    recorded: list = []
    _install_recording_leaderboard(monkeypatch, recorded)

    result = lakebase.get_leaderboard(limit=10)

    offenders = [s for s in recorded if _JSONB_EMPTY_STRING_RE.search(s)]
    assert offenders == [], f"JSONB column compared to '': {offenders}"

    user_ids = {e["user_id"] for e in result}
    assert "mcp@x.com" in user_ids
    mcp_entry = next(e for e in result if e["user_id"] == "mcp@x.com")
    assert mcp_entry["completed_step_count"] == 3


# =============================================================================
# GAP 1 — scoring COVERAGE + BE/FE parity (unchanged by R4b: STEP_SCORES/CHAPTERS
# are GLOBAL-number structures, not columns). Pins: (1) backend STEP_SCORES/
# CHAPTERS equal the frontend scoring.ts copy, (2) every manifest global is scored
# AND in exactly one chapter, (3) a concrete session scores correctly.
# =============================================================================


def _node_scoring_dump():
    node = shutil.which("node")
    if node is None:
        pytest.skip("node not available for BE/FE scoring parity")
    out = subprocess.run(
        [node, "--experimental-strip-types", "tests/frontend/scoringDump.node.mts"],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return json.loads(out)


def test_step_scores_and_chapters_parity_backend_vs_frontend():
    dump = _node_scoring_dump()

    fe_scores = {int(k): v for k, v in dump["step_scores"].items()}
    assert fe_scores == dict(lakebase.STEP_SCORES)

    be_chapters = {
        name: {"steps": sorted(info["steps"]), "display": info["display"]}
        for name, info in lakebase.CHAPTERS.items()
    }
    fe_chapters = {
        name: {"steps": sorted(info["steps"]), "display": info["display"]}
        for name, info in dump["chapters"].items()
    }
    assert fe_chapters == be_chapters


def test_every_manifest_global_is_scored_and_in_one_chapter():
    globals_ = set(manifest.step_number_to_tag().keys())

    missing = sorted(globals_ - set(lakebase.STEP_SCORES))
    assert missing == [], f"globals with no STEP_SCORES entry: {missing}"

    from collections import Counter

    membership = Counter()
    for info in lakebase.CHAPTERS.values():
        for step in info["steps"]:
            membership[step] += 1
    no_chapter = sorted(g for g in globals_ if membership[g] == 0)
    multi_chapter = sorted(g for g in globals_ if membership[g] > 1)
    assert no_chapter == [], f"globals in no chapter: {no_chapter}"
    assert multi_chapter == [], f"globals in >1 chapter: {multi_chapter}"


def test_genie_completions_scored_correctly():
    # 2,3 (Foundation 10 each) + 57-60 (Semantic Layer 50 each) = 20 + 200.
    completed = [2, 3, 57, 58, 59, 60]
    assert lakebase._calculate_score(completed, []) == 220


# =============================================================================
# GAP 2 — step 1 ("Define Your Intent") credit. The MCP gate use_case_selection
# has no global number, so it is dropped; the intent rule (industry AND use_case
# set => step 1 done) credits it at the aggregation layer. TAMPER: drop the
# union-{1} rule -> the intent row loses step 1 and this fails.
# =============================================================================


def _intent_row(industry, use_case):
    row = _gate_row("intent@x.com", ["use_case_selection"])
    row["industry"] = industry
    row["use_case"] = use_case
    return row


def test_session_with_defined_intent_gets_step_1():
    row = _intent_row("Retail", "Demand forecasting")
    completed, _skipped = lakebase._row_completion_globals(row, INVERSE)
    # use_case_selection does not map to a global; step 1 comes from the intent rule.
    assert 1 in completed


def test_row_missing_either_intent_column_does_not_get_step_1():
    for row in (_intent_row("Retail", ""), _intent_row("", "Demand forecasting"), _intent_row("", "")):
        completed, _ = lakebase._row_completion_globals(row, INVERSE)
        assert 1 not in completed


def test_step_1_intent_credit_is_idempotent():
    # A row whose gates already include a global-1-mapping tag AND defined intent —
    # the union must not double-count or drop anything else.
    row = _gate_row("app@x.com", ["genie_space"])  # -> 17
    row["industry"] = "Retail"
    row["use_case"] = "Demand forecasting"
    completed, _ = lakebase._row_completion_globals(row, INVERSE)
    assert completed == {1, 17}
