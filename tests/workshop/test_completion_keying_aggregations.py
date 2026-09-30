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
import sys

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
