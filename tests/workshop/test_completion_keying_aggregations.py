"""T5 PR3c — re-key the leaderboard / analytics completion AGGREGATIONS from raw
``completed_steps`` numbers to gate-derived GLOBAL step numbers.

Unlike the FE completion consumers (already gate-first via PR1's
``deriveCompletedStepNumbers``), the BACKEND aggregations in
``services/lakebase.py`` read the raw numeric ``completed_steps`` column
directly. That mishandles the two-numbering collision PR1 fixed on the read path:

* **App-origin** rows persist **global ``ALL_STEPS`` numbers**, gates empty.
* **MCP-origin** rows persist **dense track positions** in ``completed_steps``
  AND write authoritative ``completed_gates`` (``mcp_server._legacy_progress``).

Two concrete bugs follow, and this file pins BOTH with old-path-vs-new-path
assertions in one test (like the PR3b′ test):

1. **Dropped gate-only rows** — ``get_leaderboard``'s ``WHERE completed_steps
   != '[]'`` (and the analytics ``json_array_elements_text(completed_steps)``
   unnest) EXCLUDE an MCP session whose progress lives entirely in
   ``completed_gates`` (``completed_steps`` empty). genie-accelerator's real
   progress is at globals 57+ — exactly this class.
2. **Mis-scored dense collision** — an MCP session with ``completed_steps=[1,2]``
   (dense) is scored/counted as globals 1,2 (Foundation) instead of the real
   sections its gates name.

The killer property: a **tag-only** cohort (``completed_steps`` empty, gates
populated) yields IDENTICAL leaderboard scores AND analytics
``step_completion_counts`` to its **number-populated** App-origin equivalent —
proving these consumers no longer need the raw number column. The OLD path
diverges (rows dropped / mis-scored); the NEW path converges. Number-populated
App-origin scores are preserved EXACTLY (their disambiguated global set ==
``completed_steps`` today).

Run offline (no Lakebase): these exercise the pure re-key helpers, not the DB.
"""

import json
import pathlib
import re
import sys
from contextlib import contextmanager

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.services import lakebase
from src.backend.workshop import manifest
from src.backend.workshop.completion_keying import (
    canonical_global_numbers,
    resolve_completion_globals,
    tag_to_global_number,
)

INVERSE = tag_to_global_number()


# =============================================================================
# Old-path replicas (what the code did BEFORE PR3c) — reimplemented in-test so
# the divergence is provable side-by-side, exactly as the PR3b′ test does.
# =============================================================================


def _parse_list(value):
    if isinstance(value, str):
        try:
            return json.loads(value) if value else []
        except Exception:
            return []
    return value or []


def _old_row_admitted_leaderboard(row) -> bool:
    """Old ``get_leaderboard`` WHERE + ``if not completed_steps: continue``:
    admitted only when ``completed_steps`` is a non-empty array."""
    cs = _parse_list(row.get("completed_steps"))
    return bool(cs)


def _old_leaderboard(rows):
    """Old path: parse raw completed_steps/skipped_steps numbers, drop gate-only
    rows, score the best session per user."""
    best = {}
    for row in rows:
        if not _old_row_admitted_leaderboard(row):
            continue
        cs = _parse_list(row.get("completed_steps"))
        sk = _parse_list(row.get("skipped_steps"))
        score = lakebase._calculate_score(cs, sk)
        entry = {"score": score, "completed_step_count": len(set(cs))}
        email = row["created_by"]
        if email not in best or score > best[email]["score"]:
            best[email] = entry
    return best


def _old_step_completion(rows):
    """Old path: ``json_array_elements_text(completed_steps)`` unnest — counts raw
    numbers, skips gate-only rows."""
    completed_map, skipped_map = {}, {}
    for row in rows:
        for s in _parse_list(row.get("completed_steps")):
            completed_map[s] = completed_map.get(s, 0) + 1
        for s in _parse_list(row.get("skipped_steps")):
            skipped_map[s] = skipped_map.get(s, 0) + 1
    nums = sorted(set(completed_map) | set(skipped_map))
    return [
        {"step_number": s, "completed": completed_map.get(s, 0), "skipped": skipped_map.get(s, 0)}
        for s in nums
    ]


# =============================================================================
# New-path (PR3c) — calls the REAL re-key helpers under test.
# =============================================================================


def _new_row_admitted_leaderboard(row) -> bool:
    """New WHERE admits gate-only rows: completed_gates non-empty OR
    completed_steps non-empty."""
    return bool(_parse_list(row.get("completed_steps")) or _parse_list(row.get("completed_gates")))


def _new_leaderboard(rows):
    best = {}
    for row in rows:
        if not _new_row_admitted_leaderboard(row):
            continue
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
# Row builders for the two required cohorts.
# =============================================================================


def _app_row(email, completed_steps, skipped_steps=None):
    """App-origin: global numbers, no gates."""
    return {
        "created_by": email,
        "completed_steps": json.dumps(completed_steps),
        "skipped_steps": json.dumps(skipped_steps or []),
        "completed_gates": "[]",
        "session_parameters": "{}",
    }


def _mcp_row(email, completed_gates, dense_positions, skipped_gates=None):
    """MCP-origin: authoritative gates + DENSE completed_steps positions (the
    collision). skipped_gates live in session_parameters."""
    return {
        "created_by": email,
        "completed_steps": json.dumps(dense_positions),
        "skipped_steps": "[]",
        "completed_gates": json.dumps(completed_gates),
        "session_parameters": json.dumps({"skipped_gates": skipped_gates or []}),
    }


# =============================================================================
# Helper-level unit anchors (mirror PR1's disambiguation, resolving to NUMBERS).
# =============================================================================


def test_inverse_map_is_pr1_map_inverted():
    fwd = manifest.step_number_to_tag()
    assert INVERSE == {tag: num for num, tag in fwd.items()}
    # Anchors from workflowSections.ts globals:
    assert INVERSE["setup_lakebase"] == 6
    assert INVERSE["genie_space"] == 17
    assert INVERSE["semlayer_locate"] == 57  # the high global the old code drops


def test_mcp_gates_map_to_globals_dense_ignored():
    """gates present => map tags to GLOBAL numbers; dense completed_steps ignored."""
    completed, skipped = resolve_completion_globals(
        completed_gates=["genie_space", "agent_framework"],
        completed_steps=[1, 2],  # dense — MUST be ignored
        skipped_gates=["setup_lakebase"],
        skipped_steps=[9, 9],  # dense — MUST be ignored
        inverse_map=INVERSE,
    )
    assert completed == {17, 18}
    assert skipped == {6}


def test_app_numbers_used_verbatim():
    """gates empty => App-origin globals used as-is (score preservation)."""
    completed, skipped = resolve_completion_globals(
        completed_gates=[],
        completed_steps=[17, 18],
        skipped_gates=[],
        skipped_steps=[6],
        inverse_map=INVERSE,
    )
    assert completed == {17, 18}
    assert skipped == {6}


def test_unresolved_gate_dropped_not_misindexed():
    assert canonical_global_numbers(["not_a_real_tag"], [3], inverse_map=INVERSE) == set()


def test_bool_not_counted_as_step_number():
    # isinstance(True, int) is True in Python — must be excluded.
    assert canonical_global_numbers([], [True, 2], inverse_map=INVERSE) == {2}


# =============================================================================
# KILLER 1 — MIXED App-origin/MCP-origin cohort (the mis-scored dense collision).
# App writes global {17,18}; MCP writes dense [1,2] + gates {genie_space,
# agent_framework} (== globals 17,18). Same real progress, both scored steps.
# =============================================================================


def test_mixed_cohort_number_independence_scores():
    app = _app_row("app@x.com", [17, 18])                       # globals 17,18
    mcp = _mcp_row("mcp@x.com", ["genie_space", "agent_framework"], [1, 2])
    rows = [app, mcp]

    new = _new_leaderboard(rows)
    old = _old_leaderboard(rows)

    # NEW: tag-only cohort scores IDENTICALLY to the number-populated equivalent.
    assert new["app@x.com"]["score"] == new["mcp@x.com"]["score"] == 100
    assert new["app@x.com"]["completed_step_count"] == new["mcp@x.com"]["completed_step_count"] == 2

    # FAIL-BEFORE: OLD mis-scored the MCP dense positions [1,2] as Foundation
    # (10+10=20), diverging from the App-origin 100.
    assert old["app@x.com"]["score"] == 100          # App-origin preserved
    assert old["mcp@x.com"]["score"] == 20           # dense mis-score
    assert old["mcp@x.com"]["score"] != old["app@x.com"]["score"]


def test_mixed_cohort_number_independence_step_counts():
    app = _app_row("app@x.com", [17, 18])
    mcp = _mcp_row("mcp@x.com", ["genie_space", "agent_framework"], [1, 2])

    new_app = _new_step_completion([app])
    new_mcp = _new_step_completion([mcp])
    # NEW: identical step_completion_counts for both origins.
    assert new_app == new_mcp
    assert new_app == [
        {"step_number": 17, "completed": 1, "skipped": 0},
        {"step_number": 18, "completed": 1, "skipped": 0},
    ]

    # FAIL-BEFORE: OLD counted the MCP dense positions as steps 1,2.
    old_mcp = _old_step_completion([mcp])
    assert old_mcp == [
        {"step_number": 1, "completed": 1, "skipped": 0},
        {"step_number": 2, "completed": 1, "skipped": 0},
    ]
    assert old_mcp != new_mcp


# =============================================================================
# KILLER 2 — genie-accelerator HIGH globals 57+ (the gate-only rows the old code
# DROPS). App writes global {57,58,59}; MCP writes them as gates with EMPTY
# completed_steps (gate-only).
# =============================================================================

GENIE_GATES = ["semlayer_locate", "semlayer_profile", "semlayer_measures"]  # 57,58,59


def test_genie_high_globals_number_independence_leaderboard():
    app = _app_row("app@x.com", [57, 58, 59])
    mcp = _mcp_row("mcp@x.com", GENIE_GATES, [])  # gate-only: completed_steps empty

    new = _new_leaderboard([app, mcp])
    old = _old_leaderboard([app, mcp])

    # NEW: both users present, IDENTICAL score + completed count.
    assert set(new) == {"app@x.com", "mcp@x.com"}
    assert new["app@x.com"] == new["mcp@x.com"]
    assert new["mcp@x.com"]["completed_step_count"] == 3

    # FAIL-BEFORE: OLD DROPPED the gate-only MCP row entirely — no entry at all,
    # while the number-populated App user is present. Not number-independent.
    assert "app@x.com" in old
    assert "mcp@x.com" not in old


def test_genie_high_globals_number_independence_step_counts():
    app = _app_row("app@x.com", [57, 58, 59])
    mcp = _mcp_row("mcp@x.com", GENIE_GATES, [])

    new_app = _new_step_completion([app])
    new_mcp = _new_step_completion([mcp])
    expected = [
        {"step_number": 57, "completed": 1, "skipped": 0},
        {"step_number": 58, "completed": 1, "skipped": 0},
        {"step_number": 59, "completed": 1, "skipped": 0},
    ]
    # NEW: identical counts at globals 57+ for both origins.
    assert new_app == new_mcp == expected

    # FAIL-BEFORE: OLD unnest skipped the gate-only MCP row -> NO counts.
    assert _old_step_completion([mcp]) == []
    assert _old_step_completion([mcp]) != new_mcp


# =============================================================================
# Preservation — number-populated App-origin scores/counts are byte-identical
# to the pre-PR3c behavior (convergence is structural, not coincidental).
# =============================================================================


def test_app_origin_scores_unchanged_from_old_path():
    rows = [
        _app_row("a@x.com", [1, 2, 3, 4, 5]),          # mixed scored/unscored globals
        _app_row("b@x.com", [17, 18, 20], skipped_steps=[20]),
        _app_row("c@x.com", [6, 7, 8]),
    ]
    new = _new_leaderboard(rows)
    old = _old_leaderboard(rows)
    assert new == old  # exact preservation for App-origin cohorts


def test_app_origin_step_counts_unchanged_from_old_path():
    rows = [
        _app_row("a@x.com", [6, 7], skipped_steps=[8]),
        _app_row("b@x.com", [6, 17]),
    ]
    assert _new_step_completion(rows) == _old_step_completion(rows)


# =============================================================================
# D-3 lockstep — skipped re-keys off the SAME origin decision as completed.
# =============================================================================


def test_skipped_lockstep_mcp_uses_skipped_gates():
    mcp = _mcp_row("m@x.com", ["genie_space"], [1], skipped_gates=["agent_framework"])
    counts = _new_step_completion([mcp])
    assert counts == [
        {"step_number": 17, "completed": 1, "skipped": 0},
        {"step_number": 18, "completed": 0, "skipped": 1},
    ]


def test_skipped_lockstep_app_uses_skipped_numbers():
    app = _app_row("a@x.com", [17], skipped_steps=[6])
    counts = _new_step_completion([app])
    assert counts == [
        {"step_number": 6, "completed": 0, "skipped": 1},
        {"step_number": 17, "completed": 1, "skipped": 0},
    ]


# =============================================================================
# Serialization boundary — the gate-derived count fields must SURVIVE onto the
# LeaderboardEntry response model. get_leaderboard() puts completed_step_count /
# skipped_step_count in each dict, but the endpoint coerces every row through
# LeaderboardEntry(**entry) with response_model=List[LeaderboardEntry]. Pydantic
# v2's default extra='ignore' silently strips any field the model does not
# declare, so without the declaration the client never receives the counts and
# the FE `entry.completed_step_count ?? entry.completed_steps.length` always
# falls back to the raw array length — defeating the fix for exactly the
# gate-only / MCP-dense rows this PR admits. This crosses the boundary the pure
# aggregation tests never touch. FAILS before the LeaderboardEntry fields are
# declared (stripped), PASSES after.
# =============================================================================


def _leaderboard_entry_dict():
    """A representative get_leaderboard()-shaped dict for a gate-only/MCP row —
    canonical GLOBAL steps + the gate-derived counts, built in-test (no DB)."""
    return {
        "rank": 1,
        "user_id": "mcp@x.com",
        "session_id": "s-1",
        "display_name": "Mcp M.",
        "avatar": "🦊",
        "score": 0,
        "completed_steps": [57, 58, 59],
        "skipped_steps": [60],
        # Explicit gate-derived counts. Deliberately DIFFERENT from the array
        # lengths so a test that only checked len(completed_steps) could not pass
        # by coincidence — the fields must be transmitted independently.
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

    # Survive onto the constructed model (not stripped by extra='ignore').
    assert model.completed_step_count == 3
    assert model.skipped_step_count == 1

    # Survive onto the serialized wire shape the client receives.
    dumped = model.model_dump()
    assert "completed_step_count" in dumped and dumped["completed_step_count"] == 3
    assert "skipped_step_count" in dumped and dumped["skipped_step_count"] == 1


def test_leaderboard_entry_counts_optional_for_legacy_shape():
    """Cached / older-shape entries omit the counts — the model must still
    construct (Optional/None), so the FE fallback path stays intact."""
    from src.backend.api.routes import LeaderboardEntry

    entry = _leaderboard_entry_dict()
    del entry["completed_step_count"]
    del entry["skipped_step_count"]
    model = LeaderboardEntry(**entry)
    assert model.completed_step_count is None
    assert model.skipped_step_count is None


# =============================================================================
# SQL-orchestration boundary (B2) — the analytics gate-admitting WHERE branches
# must NOT compare the completed_gates JSONB column to '' . Postgres casts '' to
# jsonb at parse time -> ERROR: invalid input syntax for type json; execute_query
# swallows it and returns [] -> avg_score silently 0 and step_completion_counts
# silently EMPTY in prod. The pure-helper tests never see this because they call
# the helpers with dict rows, so the SQL string never reaches a Postgres parser.
#
# These tests RECORD every SQL string the aggregation issues (stubbing the DB so
# it stays offline) and assert (a) no JSONB column is compared to '' in ANY
# issued query, (b) get_analytics() returns non-empty step_completion_counts AND
# non-zero avg_score end-to-end (through the orchestration wrapper), and (c)
# get_leaderboard() admits the gate-only row end-to-end.
#
# TAMPER: re-adding `completed_gates != ''` to either analytics query makes the
# recorded SQL contain it, so assertion (a) FAILS. NOTE: an offline stub cannot
# prove Postgres JSONB type semantics — it proves the bad predicate is gone and
# the orchestration returns non-empty; the human re-runs the live read-only
# predicate check at the gate.
# =============================================================================

# JSONB columns that must never be compared to '' (skipped_gates lives inside
# session_parameters JSONB). completed_steps/skipped_steps are TEXT — excluded.
_JSONB_EMPTY_STRING_RE = re.compile(
    r"(completed_gates|session_parameters|captured_outputs|skipped_gates)\s*(!=|<>)\s*''"
)


def _analytics_cohort_rows():
    """Mixed cohort as get_analytics' completion queries would return it:
    an App-origin scored row (globals 17,18 -> score 100) and an MCP gate-only
    genie row (globals 57-59, completed_steps empty). Rows carry the extra keys
    the various analytics queries read (session_id / feedback_rating)."""
    app = _app_row("app@x.com", [17, 18])
    mcp = _mcp_row("mcp@x.com", GENIE_GATES, [])
    for r, sid in ((app, "s-app"), (mcp, "s-mcp")):
        r["session_id"] = sid
        r["feedback_rating"] = None
    return [app, mcp]


def _install_recording_execute_query(monkeypatch, recorded):
    """Stub lakebase.execute_query: record the SQL, return plausible rows so
    get_analytics runs end-to-end. Any query selecting the completion columns
    (score_rows / step_rows / user_rows) gets the mixed cohort."""
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
        # score_rows, step_rows AND user_rows all select these two columns.
        if "completed_gates" in sql and "completed_steps" in sql:
            return [dict(r) for r in rows]
        return []

    monkeypatch.setattr(lakebase, "is_lakebase_configured", lambda: True)
    monkeypatch.setattr(lakebase, "_get_sessions_table_name", lambda: "genie.sessions")
    monkeypatch.setattr(lakebase, "execute_query", _fake_execute_query)


def test_get_analytics_issues_no_jsonb_empty_string_comparison(monkeypatch):
    recorded: list = []
    _install_recording_execute_query(monkeypatch, recorded)

    result = lakebase.get_analytics()

    # (a) No issued query compares a JSONB column to '' .
    offenders = [s for s in recorded if _JSONB_EMPTY_STRING_RE.search(s)]
    assert offenders == [], f"JSONB column compared to '': {offenders}"

    # (b) End-to-end the orchestration returns real data (not the swallowed []).
    assert result["step_completion_counts"], "step_completion_counts empty"
    assert result["usage"]["avg_score"] > 0, "avg_score silently zero"
    # Gate-derived globals present (17,18 from App; 57-59 from the gate-only MCP row).
    steps = {c["step_number"] for c in result["step_completion_counts"]}
    assert {17, 18, 57, 58, 59} <= steps


def _install_recording_leaderboard(monkeypatch, recorded):
    """Stub get_leaderboard's DB layer: a fake connection + recording cursor
    that captures the executed SQL and returns the mixed cohort."""
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


def test_get_leaderboard_issues_no_jsonb_empty_string_and_admits_gate_only(monkeypatch):
    recorded: list = []
    _install_recording_leaderboard(monkeypatch, recorded)

    result = lakebase.get_leaderboard(limit=10)

    # (a) No issued query compares a JSONB column to '' .
    offenders = [s for s in recorded if _JSONB_EMPTY_STRING_RE.search(s)]
    assert offenders == [], f"JSONB column compared to '': {offenders}"

    # (c) The gate-only MCP row (completed_steps empty, gates populated) is
    # admitted end-to-end — the class the pre-PR3c WHERE dropped.
    user_ids = {e["user_id"] for e in result}
    assert "mcp@x.com" in user_ids
    mcp_entry = next(e for e in result if e["user_id"] == "mcp@x.com")
    assert mcp_entry["completed_step_count"] == 3
