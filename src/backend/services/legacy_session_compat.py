"""Read-time backward-compatibility bridge for pre-2.8.0 ``sessions`` rows.

Existing installs coming from ``main`` (< 2.8.0) store step completion in the
TEXT columns ``completed_steps`` and ``skipped_steps``, while ``completed_gates``
(added by ``12_mcp_engine_state.sql``) defaults to ``'[]'::jsonb``.

To guarantee 100% backward compatibility without running any data-mutating
``UPDATE`` or ``DROP`` on the ``sessions`` table, this module synthesizes
``completed_gates`` and ``session_parameters['skipped_gates']`` in memory at
read time whenever a database row has empty ``completed_gates`` and non-empty
``completed_steps`` (or ``skipped_steps``).

Rules:
1. Read-only: this module NEVER issues ``INSERT``, ``UPDATE``, ``DELETE``,
   ``ALTER``, or ``DROP``.
2. Gates-first: if a row already has non-empty ``completed_gates`` (any 2.8.0
   Web or MCP session), this module is a no-op and legacy numeric columns are
   ignored.
3. Schema-aware: checks ``information_schema.columns`` once per table (cached)
   so it works both on databases that retain ``completed_steps`` /
   ``skipped_steps`` and on databases where those columns were dropped.
4. Test-stub friendly: only queries cursors from a real ``psycopg``/``psycopg2``
   driver or cursors explicitly marked ``legacy_compat_enabled = True``, so
   existing unit-test mock cursors that record exact SQL strings are unaffected.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple

from src.backend.workshop import manifest

logger = logging.getLogger(__name__)

# Cache of table_name -> bool indicating whether completed_steps & skipped_steps exist.
_LEGACY_COLUMNS_CACHE: Dict[str, bool] = {}


def clear_legacy_columns_cache() -> None:
    """Clear the schema introspection cache (used by tests)."""
    _LEGACY_COLUMNS_CACHE.clear()


def _is_compat_cursor(cursor: Any) -> bool:
    """True for real psycopg2/psycopg3 cursors or test cursors opting into compat."""
    if cursor is None:
        return False
    if getattr(cursor, "legacy_compat_enabled", False):
        return True
    mod = getattr(type(cursor), "__module__", "") or ""
    return mod.startswith("psycopg")


def _parse_json_list(value: Any) -> List[Any]:
    if isinstance(value, str):
        try:
            parsed = json.loads(value) if value else []
        except Exception:
            return []
        return parsed if isinstance(parsed, list) else []
    if isinstance(value, (list, tuple)):
        return list(value)
    return []


def _parse_json_obj(value: Any) -> Dict[str, Any]:
    if isinstance(value, str):
        try:
            parsed = json.loads(value) if value else {}
        except Exception:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    if isinstance(value, dict):
        return dict(value)
    return {}


def step_numbers_to_gates(step_numbers: Iterable[Any] | None) -> List[str]:
    """Map global ``ALL_STEPS`` step numbers to canonical ``sectionTag`` gates.

    Uses the authoritative ``manifest.step_number_to_tag()`` map (identical to
    the frontend ``stepNumbersToGates`` and ``r1_emit_map_sql.py``), preserving
    order and deduplicating. Booleans and unmapped numbers are ignored.
    """
    num_to_tag = manifest.step_number_to_tag()
    gates: List[str] = []
    for raw in step_numbers or []:
        if isinstance(raw, bool):
            continue
        if isinstance(raw, int):
            num = raw
        elif isinstance(raw, str) and raw.strip().isdigit():
            num = int(raw.strip())
        else:
            continue
        tag = num_to_tag.get(num)
        if tag and tag not in gates:
            gates.append(tag)
    return gates


def has_legacy_step_columns(cursor: Any, table_name: str) -> bool:
    """Check once per ``table_name`` whether ``completed_steps`` and ``skipped_steps`` exist."""
    if not _is_compat_cursor(cursor):
        return False
    if table_name in _LEGACY_COLUMNS_CACHE:
        return _LEGACY_COLUMNS_CACHE[table_name]

    parts = table_name.split(".", 1)
    schema_name, rel_name = (parts[0], parts[1]) if len(parts) == 2 else ("public", parts[0])
    try:
        cursor.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = %s
              AND table_name = %s
              AND column_name IN ('completed_steps', 'skipped_steps')
            """,
            (schema_name, rel_name),
        )
        rows = cursor.fetchall() or []
        cols = {
            (r.get("column_name") if isinstance(r, dict) else r[0])
            for r in rows
            if r
        }
        present = "completed_steps" in cols and "skipped_steps" in cols
        _LEGACY_COLUMNS_CACHE[table_name] = present
        return present
    except Exception as exc:
        logger.debug("Legacy column check failed for %s: %s", table_name, exc)
        return False


def synthesize_gates_from_legacy_values(
    completed_gates: List[str],
    session_params: Dict[str, Any],
    completed_steps_raw: Any,
    skipped_steps_raw: Any,
    workshop_level: Optional[str] = None,
) -> Tuple[List[str], Dict[str, Any]]:
    """Synthesize ``(completed_gates, session_params)`` from legacy step numbers if gates are empty.

    When ``completed_gates`` is already non-empty, returns ``(completed_gates, session_params)``
    unchanged (gates-first rule).
    """
    existing_gates = [g for g in (completed_gates or []) if isinstance(g, str)]
    params = dict(session_params or {})
    existing_skipped = [g for g in _parse_json_list(params.get("skipped_gates")) if isinstance(g, str)]

    if existing_gates:
        return existing_gates, params

    completed_nums = _parse_json_list(completed_steps_raw)
    skipped_nums = _parse_json_list(skipped_steps_raw)

    synthesized_completed = step_numbers_to_gates(completed_nums)
    synthesized_skipped = step_numbers_to_gates(skipped_nums) if not existing_skipped else existing_skipped

    if not synthesized_completed and not (synthesized_skipped and not existing_skipped):
        return existing_gates, params

    if synthesized_skipped and not existing_skipped:
        params["skipped_gates"] = synthesized_skipped

    # Pre-2.8.0 Insights sessions stored workshop_level='genie-accelerator' and
    # coding_assistant='genie-code' without a 'view' key. Stamp view='insights'
    # in memory so they reopen in Insights view as before.
    if (
        synthesized_completed
        and "view" not in params
        and workshop_level == "genie-accelerator"
        and params.get("coding_assistant") == "genie-code"
    ):
        params["view"] = "insights"

    return synthesized_completed, params


def hydrate_legacy_session_row(
    cursor: Any,
    table_name: str,
    session_id: str,
    completed_gates: List[str],
    session_params: Dict[str, Any],
    workshop_level: Optional[str] = None,
    row_dict: Optional[Dict[str, Any]] = None,
) -> Tuple[List[str], Dict[str, Any]]:
    """Hydrate ``(completed_gates, session_params)`` for a single loaded session row."""
    if completed_gates:
        return completed_gates, session_params

    # If the row dict already carries legacy columns (e.g. in-memory test fixture
    # when compat cursor is enabled), use them directly before querying.
    if row_dict and ("completed_steps" in row_dict or "skipped_steps" in row_dict) and _is_compat_cursor(cursor):
        return synthesize_gates_from_legacy_values(
            completed_gates,
            session_params,
            row_dict.get("completed_steps"),
            row_dict.get("skipped_steps"),
            workshop_level=workshop_level,
        )

    if not has_legacy_step_columns(cursor, table_name):
        return completed_gates, session_params

    try:
        cursor.execute(
            f"SELECT completed_steps, skipped_steps FROM {table_name} WHERE session_id = %s",
            (session_id,),
        )
        legacy = cursor.fetchone()
        if not legacy:
            return completed_gates, session_params
        if isinstance(legacy, dict):
            cs_raw, sk_raw = legacy.get("completed_steps"), legacy.get("skipped_steps")
        else:
            cs_raw, sk_raw = legacy[0], legacy[1]
        return synthesize_gates_from_legacy_values(
            completed_gates,
            session_params,
            cs_raw,
            sk_raw,
            workshop_level=workshop_level,
        )
    except Exception as exc:
        logger.debug("Could not hydrate legacy steps for session %s: %s", session_id, exc)
        return completed_gates, session_params


def hydrate_locked_legacy_gates(
    cursor: Any,
    table_name: str,
    session_id: str,
    stored_completed: List[str],
    stored_skipped: List[str],
) -> Tuple[List[str], List[str]]:
    """Seed ``(stored_completed, stored_skipped)`` inside a ``FOR UPDATE`` transaction
    when a pre-2.8.0 session row is about to receive its first 2.8.0 gate write."""
    if stored_completed or stored_skipped:
        return stored_completed, stored_skipped
    if not has_legacy_step_columns(cursor, table_name):
        return stored_completed, stored_skipped
    try:
        cursor.execute(
            f"SELECT completed_steps, skipped_steps FROM {table_name} WHERE session_id = %s",
            (session_id,),
        )
        legacy = cursor.fetchone()
        if not legacy:
            return stored_completed, stored_skipped
        if isinstance(legacy, dict):
            cs_raw, sk_raw = legacy.get("completed_steps"), legacy.get("skipped_steps")
        else:
            cs_raw, sk_raw = legacy[0], legacy[1]
        synth_completed = step_numbers_to_gates(_parse_json_list(cs_raw))
        synth_skipped = step_numbers_to_gates(_parse_json_list(sk_raw)) if synth_completed else []
        return synth_completed, synth_skipped
    except Exception as exc:
        logger.debug("Could not hydrate locked legacy gates for %s: %s", session_id, exc)
        return stored_completed, stored_skipped


def hydrate_legacy_session_rows(
    cursor: Any,
    table_name: str,
    rows: List[Dict[str, Any]],
) -> None:
    """In-place hydration of ``completed_gates`` / ``session_parameters`` for a list of
    session rows (used by ``get_user_sessions``)."""
    if not rows or not _is_compat_cursor(cursor):
        return

    empty_gate_ids: List[str] = []
    for row in rows:
        cg = _parse_json_list(row.get("completed_gates"))
        if not cg and row.get("session_id"):
            empty_gate_ids.append(row["session_id"])

    if not empty_gate_ids or not has_legacy_step_columns(cursor, table_name):
        return

    try:
        cursor.execute(
            f"SELECT session_id, completed_steps, skipped_steps FROM {table_name} WHERE session_id = ANY(%s)",
            (empty_gate_ids,),
        )
        fetched = cursor.fetchall() or []
        by_id: Dict[str, Tuple[Any, Any]] = {}
        for item in fetched:
            if isinstance(item, dict):
                by_id[item["session_id"]] = (item.get("completed_steps"), item.get("skipped_steps"))
            else:
                by_id[item[0]] = (item[1], item[2])

        for row in rows:
            sid = row.get("session_id")
            if sid in by_id:
                cs_raw, sk_raw = by_id[sid]
                params = _parse_json_obj(row.get("session_parameters"))
                new_gates, new_params = synthesize_gates_from_legacy_values(
                    [],
                    params,
                    cs_raw,
                    sk_raw,
                    workshop_level=row.get("workshop_level"),
                )
                if new_gates:
                    row["completed_gates"] = new_gates
                if new_params != params:
                    row["session_parameters"] = new_params
    except Exception as exc:
        logger.debug("Could not batch-hydrate legacy session rows: %s", exc)


def extend_with_legacy_leaderboard_rows(
    cursor: Any,
    table_name: str,
    gate_rows: List[Dict[str, Any]],
    since: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    """Append pre-2.8.0 sessions (empty ``completed_gates``, non-empty ``completed_steps``)
    with synthesized gates so ``get_leaderboard`` ranks all existing sessions."""
    if not has_legacy_step_columns(cursor, table_name):
        return gate_rows

    try:
        query = f"""
        SELECT
            session_id,
            created_by,
            completed_gates,
            completed_steps,
            skipped_steps,
            session_parameters,
            industry,
            use_case,
            updated_at,
            workshop_level
        FROM {table_name}
        WHERE created_by IS NOT NULL
          AND created_by != ''
          AND (completed_gates IS NULL OR completed_gates = '[]'::jsonb)
          AND completed_steps IS NOT NULL
          AND completed_steps != ''
          AND completed_steps != '[]'
          {"AND created_at >= %s" if since else ""}
        ORDER BY created_by, updated_at DESC
        """
        if since:
            cursor.execute(query, (since,))
        else:
            cursor.execute(query)
        legacy_rows = cursor.fetchall() or []
        seen_ids = {r.get("session_id") for r in gate_rows if r.get("session_id")}
        combined = list(gate_rows)
        for raw_row in legacy_rows:
            row = dict(raw_row)
            sid = row.get("session_id")
            if sid and sid in seen_ids:
                continue
            params = _parse_json_obj(row.get("session_parameters"))
            synth_gates, synth_params = synthesize_gates_from_legacy_values(
                _parse_json_list(row.get("completed_gates")),
                params,
                row.get("completed_steps"),
                row.get("skipped_steps"),
                workshop_level=row.get("workshop_level"),
            )
            if not synth_gates:
                continue
            row["completed_gates"] = synth_gates
            row["session_parameters"] = synth_params
            combined.append(row)
        return combined
    except Exception as exc:
        logger.debug("Could not fetch legacy leaderboard rows: %s", exc)
        return gate_rows


def enrich_analytics_cohorts(
    get_connection_fn: Callable,
    dict_cursor_fn: Callable,
    table_name: str,
    score_rows: List[Dict[str, Any]],
    avg_rows: List[Dict[str, Any]],
    step_rows: List[Dict[str, Any]],
    recent_rows: List[Dict[str, Any]],
    user_rows: List[Dict[str, Any]],
) -> Tuple[
    List[Dict[str, Any]],
    List[Dict[str, Any]],
    List[Dict[str, Any]],
    List[Dict[str, Any]],
    List[Dict[str, Any]],
]:
    """Enrich ``get_analytics`` row cohorts with pre-2.8.0 ``completed_steps`` data when
    running against a Lakebase schema that has the legacy columns."""
    try:
        with get_connection_fn() as conn:
            cursor = dict_cursor_fn(conn)
            if not has_legacy_step_columns(cursor, table_name):
                cursor.close()
                return score_rows, avg_rows, step_rows, recent_rows, user_rows

            cursor.execute(
                f"""
                SELECT session_id, created_by, completed_gates, completed_steps, skipped_steps,
                       session_parameters, industry, use_case
                FROM {table_name}
                WHERE (completed_gates IS NULL OR completed_gates = '[]'::jsonb)
                  AND (
                        (completed_steps IS NOT NULL AND completed_steps != '' AND completed_steps != '[]')
                     OR (skipped_steps IS NOT NULL AND skipped_steps != '' AND skipped_steps != '[]')
                  )
                """
            )
            legacy_raw = cursor.fetchall() or []
            cursor.close()
    except Exception:
        return score_rows, avg_rows, step_rows, recent_rows, user_rows

    if not legacy_raw:
        return score_rows, avg_rows, step_rows, recent_rows, user_rows

    synthesized_by_id: Dict[str, Dict[str, Any]] = {}
    new_score_rows = list(score_rows)
    new_step_rows = list(step_rows)
    new_avg_rows = list(avg_rows)

    for raw in legacy_raw:
        row = dict(raw)
        params = _parse_json_obj(row.get("session_parameters"))
        synth_gates, synth_params = synthesize_gates_from_legacy_values(
            _parse_json_list(row.get("completed_gates")),
            params,
            row.get("completed_steps"),
            row.get("skipped_steps"),
        )
        if not synth_gates and not synth_params.get("skipped_gates"):
            continue
        row["completed_gates"] = synth_gates
        row["session_parameters"] = synth_params
        sid = row.get("session_id")
        if sid:
            synthesized_by_id[sid] = row
        if synth_gates:
            new_score_rows.append(row)
        new_step_rows.append(row)

    # avg_rows has no session_id in its SELECT list, so replace up to len(synthesized)
    # empty-gate rows with their synthesized counterparts so the denominator (len(avg_rows))
    # stays identical to total_sessions while the numerator reflects legacy completions.
    remaining_synth = [r for r in synthesized_by_id.values() if r.get("completed_gates")]
    for idx, ar in enumerate(new_avg_rows):
        if not remaining_synth:
            break
        if not _parse_json_list(ar.get("completed_gates")):
            synth = remaining_synth.pop(0)
            new_avg_rows[idx] = {
                **ar,
                "completed_gates": synth["completed_gates"],
                "session_parameters": synth["session_parameters"],
            }

    new_recent_rows = []
    for rr in recent_rows:
        sid = rr.get("session_id")
        if sid in synthesized_by_id and not _parse_json_list(rr.get("completed_gates")):
            synth = synthesized_by_id[sid]
            rr = {**rr, "completed_gates": synth["completed_gates"], "session_parameters": synth["session_parameters"]}
        new_recent_rows.append(rr)

    new_user_rows = []
    for ur in user_rows:
        sid = ur.get("session_id")
        if sid in synthesized_by_id and not _parse_json_list(ur.get("completed_gates")):
            synth = synthesized_by_id[sid]
            ur = {**ur, "completed_gates": synth["completed_gates"], "session_parameters": synth["session_parameters"]}
        new_user_rows.append(ur)

    return new_score_rows, new_avg_rows, new_step_rows, new_recent_rows, new_user_rows
