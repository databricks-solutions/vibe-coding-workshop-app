"""T5 R3.1 — vibe_start_track persists the *_label columns the analytics
breakdowns GROUP BY.

The new-session seed save inside ``vibe_start_track`` historically persisted
``industry``/``use_case`` (the raw values) but NOT ``industry_label`` /
``use_case_label``. The ``by_industry`` / ``by_use_case`` analytics
(``get_analytics``) GROUP BY the ``*_label`` columns and drop NULL/'' labels, so a
start-track-only session (one that never walks the ``vibe_set_parameters``
selection lock) vanished from both breakdowns.

The fix resolves both labels from the SAME curated list the echo uses:
``industry`` via ``_industry_label_for``; ``use_case`` via ``_use_case_label_for``
(``_available_use_cases(industry)`` value->label). ``vibe_start_track`` has no
``use_case_label`` input, so the resolver — NOT the lock path's
``use_case_label or use_case`` fallback — is used: with no input that fallback
would always write the raw id as a label and forge a second wrong ``by_use_case``
group. Unresolved -> None so ``save_session`` COALESCE-preserves.

Mirrors the in-memory-store fixture pattern of ``test_track_persistence.py``.

TAMPER (verified, see PR body):
* id fallback (wire ``use_case_label=use_case`` lock-path style) -> (a) fails:
  the seed persists the raw id ``"booking"`` instead of ``"Booking App"``.
* drop the label kwargs from the seed save -> (c) fails: the persisted row has
  NULL labels, so the GROUP BY drops it from by_industry / by_use_case.
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
from src.backend.api import routes
from src.backend.services import lakebase

TRACK = "genie-accelerator"

# Curated options whose LABEL differs from the raw VALUE, so an id fallback is
# distinguishable from a real value->label resolution.
_INDUSTRIES = [
    {"value": "", "label": "Select an industry..."},  # dropdown placeholder — dropped
    {"value": "travel", "label": "Travel & Hospitality"},
    {"value": "retail", "label": "Retail"},
]
_USE_CASES = {
    "travel": [
        {"value": "", "label": "Select a use case..."},  # placeholder — dropped
        {"value": "booking", "label": "Booking App", "is_certified": True},
        {"value": "loyalty", "label": "Loyalty Program", "is_certified": False},
    ],
}


@pytest.fixture
def start_track_env(monkeypatch):
    """Fresh in-memory store + recorded saves, with the curated list seams
    stubbed so label resolution is deterministic and offline."""
    store: dict = {}
    saves: list = []

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
    # Curated-list seams the label resolvers lazy-import from .api.routes.
    monkeypatch.setattr(routes, "get_industries", lambda: _INDUSTRIES)
    monkeypatch.setattr(routes, "get_use_cases_map", lambda: _USE_CASES)
    return store, saves


def _seed_fields(saves, sid):
    """The NEW-session seed save's kwargs (the first save for this session)."""
    seeds = [fields for (s, fields) in saves if s == sid]
    assert seeds, "expected a new-session seed save"
    return seeds[0]


# --- (a) curated pair persists the LABELS, not the ids -----------------------


def test_a_curated_pair_persists_labels_not_ids(start_track_env):
    store, saves = start_track_env

    result = mcp_server.vibe_start_track(TRACK, use_case="booking", industry="travel")

    assert not isinstance(result, dict), result
    seed = _seed_fields(saves, result.session_id)
    # The curated DISPLAY labels, never the raw ids.
    assert seed.get("use_case_label") == "Booking App"
    assert seed.get("use_case_label") != "booking"
    assert seed.get("industry_label") == "Travel & Hospitality"
    # The raw value columns are still persisted alongside.
    assert seed.get("industry") == "travel"
    assert seed.get("use_case") == "booking"


# --- (b) unknown use case -> use_case_label NULL (None), never id/'' ----------


def test_b_unknown_use_case_persists_null_label(start_track_env):
    store, saves = start_track_env

    result = mcp_server.vibe_start_track(
        TRACK, use_case="nonexistent_uc", industry="travel"
    )

    assert not isinstance(result, dict), result
    seed = _seed_fields(saves, result.session_id)
    # Unresolved -> None so save_session COALESCE-preserves; NEVER the raw id, NEVER ''.
    assert seed.get("use_case_label") is None
    # The industry still resolves (it is curated).
    assert seed.get("industry_label") == "Travel & Hospitality"
    assert seed.get("use_case") == "nonexistent_uc"


# --- (c) end-to-end: four columns persisted + session surfaces in the --------
#         by_industry / by_use_case breakdowns + step-1 credited.


def _db_row_from_store(sid, row):
    """Shape the accumulated in-memory store row like a DB row get_analytics
    reads: list/dict columns serialized to JSON text/JSONB as persisted."""

    def _json(value, default):
        if value is None:
            return default
        return value if isinstance(value, str) else json.dumps(value)

    return {
        "session_id": sid,
        "created_by": row.get("created_by"),
        "industry": row.get("industry"),
        "industry_label": row.get("industry_label"),
        "use_case": row.get("use_case"),
        "use_case_label": row.get("use_case_label"),
        "completed_steps": _json(row.get("completed_steps"), "[]"),
        "skipped_steps": _json(row.get("skipped_steps"), "[]"),
        "completed_gates": _json(row.get("completed_gates"), "[]"),
        "session_parameters": _json(row.get("session_parameters"), "{}"),
        "workshop_level": row.get("workshop_level"),
        "feedback_rating": None,
        "created_at": None,
    }


def _group(rows, label_col, alias):
    """Emulate the Postgres `GROUP BY <label>` the analytics issues: skip
    NULL/'' labels (the WHERE), count per label."""
    counts: dict = {}
    for r in rows:
        value = r.get(label_col)
        if value is None or value == "":
            continue
        counts[value] = counts.get(value, 0) + 1
    return [{alias: k, "count": v} for k, v in counts.items()]


def _install_analytics_db(monkeypatch, db_rows):
    """Stub lakebase.execute_query so get_analytics runs offline end-to-end: the
    GROUP BY queries are emulated from db_rows' label columns, and the per-row
    completion queries get db_rows verbatim."""

    def _fake_execute_query(sql, params=None):
        if "total_sessions" in sql:
            return [{"total_sessions": len(db_rows), "total_users": 1,
                     "total_feedback": 0, "positive_count": 0, "negative_count": 0}]
        if "prereqs_completed" in sql and "saved_sessions" in sql:
            return [{"prereqs_completed": 0, "saved_sessions": 0}]
        if "total_prompts" in sql:
            return [{"total_prompts": 0}]
        if "GROUP BY industry_label" in sql:
            return _group(db_rows, "industry_label", "industry")
        if "GROUP BY use_case_label" in sql:
            return _group(db_rows, "use_case_label", "use_case")
        if "GROUP BY workshop_level" in sql:
            counts: dict = {}
            for r in db_rows:
                counts[r.get("workshop_level")] = counts.get(r.get("workshop_level"), 0) + 1
            return [{"level": k, "count": v} for k, v in counts.items()]
        if "chapter_feedback" in sql:
            return []
        # score_rows / avg_rows / step_rows / recent_rows / user_rows all SELECT
        # completed_steps; the feedback query does not.
        if "completed_steps" in sql:
            return [dict(r) for r in db_rows]
        return []

    monkeypatch.setattr(lakebase, "is_lakebase_configured", lambda: True)
    monkeypatch.setattr(lakebase, "_get_sessions_table_name", lambda: "genie.sessions")
    monkeypatch.setattr(lakebase, "execute_query", _fake_execute_query)


def test_c_start_track_session_surfaces_in_breakdowns_and_credits_step1(
    start_track_env, monkeypatch
):
    store, saves = start_track_env

    result = mcp_server.vibe_start_track(TRACK, use_case="booking", industry="travel")
    assert not isinstance(result, dict), result
    sid = result.session_id

    # Four columns persisted on the session row.
    persisted = store[sid]
    assert persisted.get("industry") == "travel"
    assert persisted.get("industry_label") == "Travel & Hospitality"
    assert persisted.get("use_case") == "booking"
    assert persisted.get("use_case_label") == "Booking App"
    # Starting with BOTH args resolves the use_case_selection gate up front, so the
    # row carries non-empty gates (admitted by the aggregation WHERE).
    assert "use_case_selection" in (persisted.get("completed_gates") or [])

    # Drive the REAL get_analytics over this exact persisted row (DB stubbed).
    db_row = _db_row_from_store(sid, persisted)
    _install_analytics_db(monkeypatch, [db_row])
    analytics = lakebase.get_analytics()

    # Appears in by_industry / by_use_case keyed on the DISPLAY labels.
    assert {"industry": "Travel & Hospitality", "count": 1} in analytics["by_industry"]
    assert {"use_case": "Booking App", "count": 1} in analytics["by_use_case"]

    # Step 1 ("Define Your Intent") credited from the industry+use_case intent rule.
    step1 = [c for c in analytics["step_completion_counts"] if c["step_number"] == 1]
    assert step1 and step1[0]["completed"] >= 1
