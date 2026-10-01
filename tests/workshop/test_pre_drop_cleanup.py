"""T5 R3 — pre-DROP cleanup: retire the raw ``current_step`` / ``completed_steps``
read consumers ahead of the human-run column DROP.

Every consumer here is re-pointed onto the SAME gate-derived disambiguation the
PR3c leaderboard/analytics aggregations use (``_row_completion_globals`` +
PR1's ``step_number_to_tag`` inverse map). This file pins the three surfaces the
R3 cleanup touches, each with an old-path-vs-new-path divergence so a revert of
the fix fails and a restore passes:

* **Item 1** — ``get_user_sessions`` surfaces ``completed_step_count`` (gate-
  derived, step-1 credit included) so the session-list UI drops ``current_step``.
* **Item 2** — ``get_analytics``'s ``usage.avg_steps_per_session`` and
  ``recent_sessions[].completed_count`` move off raw ``completed_steps`` numbers.
* **Item 3** — the MCP ``vibe_set_parameters`` lock path persists the top-level
  industry/industry_label/use_case/use_case_label columns so an MCP-created
  session earns step-1 credit AND joins the industry/use-case analytics
  breakdowns.

Run offline (no Lakebase) via the main .venv python; the DB layer is stubbed.
An offline stub cannot prove Postgres type/SQL semantics — the human re-runs the
live read-only predicate check at the gate.
"""

import copy
import json
import pathlib
import sys
from contextlib import contextmanager

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.services import lakebase
from src.backend.workshop import manifest
from src.backend.workshop.completion_keying import tag_to_global_number

INVERSE = tag_to_global_number()

# genie-accelerator HIGH globals — the class the raw completed_steps path drops
# for gate-only (MCP-origin) rows. semlayer_locate=57, semlayer_profile=58.
GENIE_GATES = ["semlayer_locate", "semlayer_profile"]


# =============================================================================
# ITEM 1 — get_user_sessions surfaces a gate-derived completed_step_count.
# =============================================================================


def _saved_row(**overrides):
    """A get_user_sessions-shaped DB row (the widened SELECT's columns)."""
    row = {
        "session_id": "s-1",
        "session_name": "My Session",
        "session_description": None,
        "industry": None,
        "industry_label": None,
        "use_case": None,
        "use_case_label": None,
        "current_step": 1,
        "feedback_rating": None,
        "completed_steps": "[]",
        "skipped_steps": "[]",
        "completed_gates": "[]",
        "session_parameters": "{}",
        "created_by": "u@x.com",
        "created_at": None,
        "updated_at": None,
    }
    row.update(overrides)
    return row


def _run_get_user_sessions(monkeypatch, rows):
    """Drive get_user_sessions against a recording cursor; return (result, sql)."""
    recorded: list = []

    class _RecCursor:
        def execute(self, sql, params=None):
            recorded.append(sql)

        def fetchall(self):
            return [dict(r) for r in rows]

        def close(self):
            pass

    @contextmanager
    def _fake_get_connection():
        yield object()

    monkeypatch.setattr(lakebase, "is_lakebase_configured", lambda: True)
    monkeypatch.setattr(lakebase, "_get_sessions_table_name", lambda: "genie.sessions")
    monkeypatch.setattr(lakebase, "get_connection", _fake_get_connection)
    monkeypatch.setattr(lakebase, "_dict_cursor", lambda conn: _RecCursor())

    result = lakebase.get_user_sessions("u@x.com", saved_only=True)
    return result, recorded


def test_gate_only_session_reports_gate_derived_count_with_step1(monkeypatch):
    # Gate-only row (completed_steps EMPTY, gates populated) WITH defined intent.
    # Real progress: globals 57,58 from the gates + global 1 from step-1 credit = 3.
    row = _saved_row(
        completed_gates=json.dumps(GENIE_GATES),
        industry="travel",
        use_case="predictive_maintenance",
    )
    result, _sql = _run_get_user_sessions(monkeypatch, [row])

    assert result[0]["completed_step_count"] == 3

    # FAIL-BEFORE: the retired raw read (len of completed_steps) counts 0 here —
    # gate-only progress and step-1 credit both vanish. Tamper = point the count
    # back at raw completed_steps -> this divergence collapses and the test fails.
    assert len(json.loads(row["completed_steps"])) == 0
    assert result[0]["completed_step_count"] != len(json.loads(row["completed_steps"]))


def test_step1_credit_requires_both_intent_columns(monkeypatch):
    # A bare row with only industry+use_case (no gates, no steps) counts step 1.
    intent = _saved_row(industry="travel", use_case="predictive_maintenance")
    # Missing either intent column -> no step-1 credit -> 0.
    only_industry = _saved_row(industry="travel", use_case="")
    result, _ = _run_get_user_sessions(monkeypatch, [intent, only_industry])
    assert result[0]["completed_step_count"] == 1
    assert result[1]["completed_step_count"] == 0


def test_get_user_sessions_select_carries_all_six_disambiguation_columns(monkeypatch):
    # The count is only correct in prod if the SELECT actually fetches every
    # column _row_completion_globals reads. This SQL-string assert is the ONLY
    # guard for that: the behavioral tests above drive a stub whose fetchall()
    # returns full dict rows regardless of which columns the SELECT names, so a
    # dropped column would not make them fail — only this assertion catches it.
    _result, recorded = _run_get_user_sessions(monkeypatch, [_saved_row()])
    sql = recorded[0]
    for col in (
        "completed_steps",
        "skipped_steps",
        "completed_gates",
        "session_parameters",
        "industry",
        "use_case",
    ):
        assert col in sql, f"widened SELECT is missing {col}"


# =============================================================================
# ITEM 2 — get_analytics avg_steps_per_session + recent_sessions.completed_count.
# =============================================================================


def _app_row(completed_steps):
    return {
        "completed_steps": json.dumps(completed_steps),
        "skipped_steps": "[]",
        "completed_gates": "[]",
        "session_parameters": "{}",
        "industry": None,
        "use_case": None,
    }


def _mcp_gate_only_row(gates):
    return {
        "completed_steps": "[]",  # gate-only: raw column empty
        "skipped_steps": "[]",
        "completed_gates": json.dumps(gates),
        "session_parameters": "{}",
        "industry": None,
        "use_case": None,
    }


def _zero_row():
    """No completion, no intent — contributes 0 to the average (guards the
    denominator: the average is over ALL rows, not just completed ones)."""
    return _app_row([])


def _install_analytics_stub(monkeypatch, cohort):
    """Stub the analytics DB layer. Every completion query (avg_rows / score_rows
    / step_rows / recent_rows / user_rows selects completed_gates + completed_steps)
    gets the full cohort; scalar summary queries get benign zeros."""

    def _fake_execute_query(sql, params=None):
        if "total_sessions" in sql:
            return [{"total_sessions": len(cohort), "total_users": 1, "total_feedback": 0,
                     "positive_count": 0, "negative_count": 0}]
        if "prereqs_completed" in sql and "saved_sessions" in sql:
            return [{"prereqs_completed": 0, "saved_sessions": 0}]
        if "total_prompts" in sql:
            return [{"total_prompts": 0}]
        if "completed_gates" in sql and "completed_steps" in sql:
            return [dict(r) for r in cohort]
        return []

    monkeypatch.setattr(lakebase, "is_lakebase_configured", lambda: True)
    monkeypatch.setattr(lakebase, "_get_sessions_table_name", lambda: "genie.sessions")
    monkeypatch.setattr(lakebase, "execute_query", _fake_execute_query)


def test_avg_steps_per_session_gate_derived_over_all_rows(monkeypatch):
    # Mixed cohort with a ZERO-completion row so the denominator (all rows) matters.
    # New per-row counts: App {17,18}=2, MCP gate-only {57,58}=2, zero=0.
    cohort = [_app_row([17, 18]), _mcp_gate_only_row(GENIE_GATES), _zero_row()]
    _install_analytics_stub(monkeypatch, cohort)

    result = lakebase.get_analytics()
    # NEW: (2 + 2 + 0) / 3 = 1.333 -> 1.3, averaged over ALL rows.
    assert result["usage"]["avg_steps_per_session"] == 1.3

    # FAIL-BEFORE: the retired SQL used json_array_length(completed_steps) — the
    # gate-only row counts 0, so old = (2 + 0 + 0) / 3 = 0.666 -> 0.7. Divergence
    # proves the gate-only row was being dropped from the numerator; the zero row
    # proves the denominator stays every row (not just completed ones).
    old_numerators = [len(json.loads(r["completed_steps"])) for r in cohort]
    old_avg = round(sum(old_numerators) / len(cohort), 1)
    assert old_avg == 0.7
    assert result["usage"]["avg_steps_per_session"] != old_avg


def test_avg_steps_per_session_zero_on_empty_table(monkeypatch):
    _install_analytics_stub(monkeypatch, [])
    result = lakebase.get_analytics()
    assert result["usage"]["avg_steps_per_session"] == 0


def test_recent_sessions_completed_count_gate_derived(monkeypatch):
    # A gate-only genie session: raw completed_steps empty, gates -> globals 57,58.
    cohort = [_mcp_gate_only_row(GENIE_GATES)]
    _install_analytics_stub(monkeypatch, cohort)

    result = lakebase.get_analytics()
    counts = [s["completed_count"] for s in result["recent_sessions"]]
    # NEW: gate-derived count = 2.
    assert counts == [2]

    # FAIL-BEFORE: len(raw completed_steps) == 0 for a gate-only row.
    assert len(json.loads(cohort[0]["completed_steps"])) == 0
    assert counts[0] != len(json.loads(cohort[0]["completed_steps"]))


def test_analytics_no_jsonb_vs_empty_string_in_new_queries(monkeypatch):
    # The widened avg/recent SELECTs must NOT compare a JSONB column to '' (the
    # PR3c B2 parse-failure class). Record every issued query and sweep.
    import re

    recorded: list = []
    cohort = [_app_row([17, 18]), _mcp_gate_only_row(GENIE_GATES), _zero_row()]

    def _fake_execute_query(sql, params=None):
        recorded.append(sql)
        if "total_sessions" in sql:
            return [{"total_sessions": 3, "total_users": 1, "total_feedback": 0,
                     "positive_count": 0, "negative_count": 0}]
        if "prereqs_completed" in sql and "saved_sessions" in sql:
            return [{"prereqs_completed": 0, "saved_sessions": 0}]
        if "total_prompts" in sql:
            return [{"total_prompts": 0}]
        if "completed_gates" in sql and "completed_steps" in sql:
            return [dict(r) for r in cohort]
        return []

    monkeypatch.setattr(lakebase, "is_lakebase_configured", lambda: True)
    monkeypatch.setattr(lakebase, "_get_sessions_table_name", lambda: "genie.sessions")
    monkeypatch.setattr(lakebase, "execute_query", _fake_execute_query)

    lakebase.get_analytics()
    jsonb_empty = re.compile(
        r"(completed_gates|session_parameters|captured_outputs|skipped_gates)\s*(!=|<>)\s*''"
    )
    offenders = [s for s in recorded if jsonb_empty.search(s)]
    assert offenders == [], f"JSONB column compared to '': {offenders}"


# =============================================================================
# ITEM 3 — the MCP vibe_set_parameters lock path persists the four top-level
# columns so an MCP-created session earns step-1 credit AND joins the analytics
# industry/use-case breakdowns. End-to-end: drive the lock, inspect the persisted
# columns, then prove step-1 credit through the SAME aggregation helper.
# =============================================================================

SESSION_ID = "r3-lock-session"


@pytest.fixture
def session_store(monkeypatch):
    store = {
        SESSION_ID: {
            "session_id": SESSION_ID,
            "created_by": None,
            "completed_gates": [],
            "captured_outputs": {},
            "session_parameters": {},
        }
    }
    saves = []

    def load_session(session_id):
        record = store.get(session_id)
        return copy.deepcopy(record) if record is not None else None

    def save_session(session_id, **fields):
        saves.append((session_id, copy.deepcopy(fields)))
        store.setdefault(session_id, {"session_id": session_id}).update(copy.deepcopy(fields))
        return True

    def append_session_interaction(*args, **kwargs):
        return True

    monkeypatch.setattr(mcp_server, "load_session", load_session)
    monkeypatch.setattr(mcp_server, "save_session", save_session)
    monkeypatch.setattr(mcp_server, "append_session_interaction", append_session_interaction, raising=False)
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: True)
    return store, saves


def _lock_selection():
    """A fully-locked curated selection for an industry that resolves a label
    from the offline curated list (travel -> "Travel & Hospitality")."""
    return {
        "industry": "travel",
        "use_case": "predictive_maintenance",
        "use_case_label": "Predictive Maintenance",
        "use_case_source": "curated",
    }


def _confirm_usecase_beat():
    blocks = manifest.interactions_for("use_case_selection")
    block = blocks["decision"]
    mcp_server.vibe_submit_answer(SESSION_ID, block["id"], block["recommended"])


def _lock_save_fields(saves):
    """The lock-path save is the one carrying completed_gates (Option A)."""
    lock = [f for (_sid, f) in saves if "completed_gates" in f]
    assert lock, "lock path never saved the resolved selection"
    return lock[-1]


def test_mcp_lock_persists_four_columns_step1_credit_and_breakdown(session_store):
    store, saves = session_store
    _confirm_usecase_beat()

    result = mcp_server.vibe_set_parameters(SESSION_ID, _lock_selection())
    assert result.use_case_resolved is True
    assert "use_case_selection" in store[SESSION_ID]["completed_gates"]

    fields = _lock_save_fields(saves)

    # (1) ALL FOUR top-level columns persisted (not just session_parameters).
    assert fields["industry"] == "travel"
    assert fields["use_case"] == "predictive_maintenance"
    assert fields["use_case_label"] == "Predictive Maintenance"
    assert fields["industry_label"] == "Travel & Hospitality"

    # (3) Analytics breakdown MEMBERSHIP condition: by_industry/by_use_case
    # GROUP BY the *_label columns WHERE label IS NOT NULL AND label != ''. Both
    # labels non-empty => this MCP session now joins both breakdowns.
    assert fields["industry_label"] and fields["use_case_label"]

    # (2) step-1 credit through the SAME aggregation helper the leaderboard uses,
    # off the persisted top-level columns.
    row = {
        "industry": fields["industry"],
        "use_case": fields["use_case"],
        "completed_gates": json.dumps(fields.get("completed_gates") or []),
        "completed_steps": "[]",
        "skipped_steps": "[]",
        "session_parameters": "{}",
    }
    completed, _skipped = lakebase._row_completion_globals(row, INVERSE)
    assert 1 in completed


def test_old_lock_without_columns_loses_step1_and_breakdown():
    # FAIL-BEFORE replica: the pre-R3 lock persisted ONLY session_parameters (no
    # top-level columns). Reconstruct that row and prove BOTH regressions:
    # step-1 credit gone AND breakdown membership gone.
    old_row = {
        # industry/use_case absent from the row (lived only in session_parameters).
        "completed_gates": json.dumps(["use_case_selection"]),  # no global number
        "completed_steps": "[]",
        "skipped_steps": "[]",
        "session_parameters": json.dumps(
            {"industry": "travel", "use_case": "predictive_maintenance"}
        ),
    }
    completed, _ = lakebase._row_completion_globals(old_row, INVERSE)
    # use_case_selection has no global; without the top-level columns, no step-1.
    assert 1 not in completed
    # And no industry_label/use_case_label columns => dropped from the breakdowns.
    assert not old_row.get("industry_label")
    assert not old_row.get("use_case_label")
