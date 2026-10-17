"""
Saved ideas, Idea Points, and the Insights leaderboard.

Ideate and the Insights view share one idea journey. The browser keeps a
local copy of each idea and mirrors it here, so ideas follow the person across
browsers and can be ranked. Points are always computed on the server:

- Journey points (up to 300) come from the approved steps, mirrored from
  IDEA_STEP_SCORES in src/constants/scoring.ts.
- Quality points (up to 600) come from an AI judge that scores the stored
  idea on six dimensions.
- Outcome points (up to 100) come from submitting to the library and its
  approval (Ideate), or from starting and setting up the Genie build (Insights).

The table is created at runtime (mirrors db/lakebase/ddl/14_ideate_ideas.sql).
Without Lakebase, ideas are kept in memory for the life of the process.
"""

import json
import logging
import os
import re
import threading
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from src.backend.api.ideate_prompts import JUDGE_PROMPT

logger = logging.getLogger(__name__)
router = APIRouter()

try:
    from src.backend.api.hackathon import _resolve_user
except Exception:  # pragma: no cover
    from src.backend.api.routes import _get_session_user as _resolve_user  # type: ignore

try:
    from src.backend.api.routes import call_databricks_serving_endpoint
except Exception:  # pragma: no cover
    async def call_databricks_serving_endpoint(*args, **kwargs):  # type: ignore
        return {"response": "", "model": "none", "usage": None}


# ============== Idea Points (mirror of src/constants/scoring.ts) ==============

NOT_SURE = "Not sure yet"
IDEA_STEP_SCORES: Dict[str, Dict[str, int]] = {
    "ideate": {"spark": 25, "map": 25, "clarify": 60, "shape": 30, "impact": 60, "brief": 50},
    "insights": {"spark": 20, "map": 20, "clarify": 50, "shape": 25, "questions": 50, "impact": 40, "brief": 45},
}
POINTS_PER_ITEM = 10
DEPTH_GAPS = 15
DEPTH_CASE = 15
DEPTH_ASSUMPTION = 5
DEPTH_ASSUMPTION_MAX = 20
DEPTH_MAX = 50
OUTCOME_POINTS = {
    "ideate": {"first": 40, "second": 60},
    "insights": {"first": 40, "second": 60},
}
QUALITY_MAX = 600
TIERS: List[Tuple[int, str]] = [(750, "boardroom"), (500, "investable"), (250, "shaped"), (0, "spark")]
REVIEW_STATUSES = {"pending", "changes_requested", "approved", "rejected"}
REVIEW_ACTIONS = {"approve", "request_changes", "changes_requested", "reject"}

DIMENSIONS: List[Tuple[str, str]] = [
    ("problem", "Problem clarity"),
    ("users", "Users and workflow"),
    ("value", "Value case and evidence"),
    ("feasibility", "Feasibility and data"),
    ("risks", "Risks and kill criterion"),
    ("writing", "Writing quality"),
]
# Caps when the inputs a dimension depends on are missing, so a polished brief can't hide a skipped step.
CAP_NO_IMPACT = 40
CAP_NO_ANSWERS = 55
CAP_NO_MAP = 55

MAX_PAYLOAD_CHARS = 400_000
MAX_SCORES_PER_DAY = 5
LEADERBOARD_CACHE_S = 15
JUDGE_CONTEXT_CHARS = 14000


def _mode(idea: Dict[str, Any]) -> str:
    return "insights" if idea.get("mode") == "insights" else "ideate"


def _approved(idea: Dict[str, Any]) -> List[str]:
    a = idea.get("approved")
    return [s for s in a if isinstance(s, str)] if isinstance(a, list) else []


def _real_answers(idea: Dict[str, Any]) -> int:
    answers = idea.get("answers") if isinstance(idea.get("answers"), dict) else {}
    questions = idea.get("questions") if isinstance(idea.get("questions"), list) else []
    n = 0
    for q in questions:
        if isinstance(q, dict):
            a = answers.get(q.get("id"))
            if a and a != NOT_SURE:
                n += 1
    return n


def _impact_share(idea: Dict[str, Any]) -> Optional[float]:
    """Share of impact answers the user gave themselves, or None when the step was skipped."""
    impact = idea.get("impact") if isinstance(idea.get("impact"), dict) else None
    if not impact or impact.get("skipped"):
        return None
    answers = impact.get("answers") if isinstance(impact.get("answers"), dict) else {}
    if not answers:
        return 0.0
    said = sum(1 for a in answers.values() if isinstance(a, dict) and a.get("source") == "you said")
    return said / len(answers)


def step_points(idea: Dict[str, Any], step: str) -> int:
    table = IDEA_STEP_SCORES[_mode(idea)]
    available = table.get(step, 0)
    if step not in _approved(idea) or not available:
        return 0
    if step == "clarify":
        return min(available, POINTS_PER_ITEM * _real_answers(idea))
    if step == "questions":
        qs = idea.get("genieQuestions") if isinstance(idea.get("genieQuestions"), list) else []
        return min(available, POINTS_PER_ITEM * len(qs))
    if step == "impact":
        share = _impact_share(idea)
        return 0 if share is None else round(available * (0.5 + 0.5 * share))
    return available


def depth_points(idea: Dict[str, Any]) -> int:
    pts = 0
    if idea.get("gaps"):
        pts += DEPTH_GAPS
    if idea.get("caseOpenedAt"):
        pts += DEPTH_CASE
    assumptions = idea.get("assumptions") if isinstance(idea.get("assumptions"), list) else []
    resolved = sum(1 for a in assumptions if isinstance(a, dict) and a.get("status") in ("accepted", "question"))
    pts += min(DEPTH_ASSUMPTION_MAX, DEPTH_ASSUMPTION * resolved)
    return min(DEPTH_MAX, pts)


def journey_points(idea: Dict[str, Any]) -> int:
    return sum(step_points(idea, s) for s in IDEA_STEP_SCORES[_mode(idea)]) + depth_points(idea)


def outcome_points(idea: Dict[str, Any], approved_in_library: bool) -> int:
    o = OUTCOME_POINTS[_mode(idea)]
    if _mode(idea) == "insights":
        first = bool(idea.get("lockedAt"))
        second = idea.get("buildStage") == "studio"
    else:
        first = bool(idea.get("catalogRef"))
        second = first and approved_in_library
    return (o["first"] if first else 0) + (o["second"] if second else 0)


def quality_points(breakdown: Optional[List[Dict[str, Any]]]) -> Optional[int]:
    if not breakdown:
        return None
    scores = [int(d.get("score") or 0) for d in breakdown]
    return round(sum(scores) / len(scores) / 100 * QUALITY_MAX) if scores else None


def tier_for(total: int) -> str:
    return next(name for floor, name in TIERS if total >= floor)


# ============== Storage ==============

_DDL = """CREATE TABLE IF NOT EXISTS {schema}.ideate_ideas (
    id VARCHAR(64) PRIMARY KEY,
    created_by VARCHAR(255) NOT NULL,
    mode VARCHAR(20) NOT NULL DEFAULT 'ideate',
    session_id VARCHAR(64),
    title VARCHAR(300) NOT NULL DEFAULT '',
    industry VARCHAR(200) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'exploring',
    step VARCHAR(20) NOT NULL DEFAULT 'spark',
    approved JSONB NOT NULL DEFAULT '[]'::jsonb,
    payload JSONB NOT NULL,
    value_per_year DOUBLE PRECISION,
    journey_points INTEGER NOT NULL DEFAULT 0,
    quality_score INTEGER,
    quality_breakdown JSONB,
    quality_revision INTEGER,
    scored_at TIMESTAMP WITHOUT TIME ZONE,
    total_points INTEGER NOT NULL DEFAULT 0,
    catalog_ref JSONB,
    locked_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    points_reached_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITHOUT TIME ZONE,
    review_status VARCHAR(24),
    submitted_revision INTEGER,
    submitted_at TIMESTAMP WITHOUT TIME ZONE,
    reviewed_revision INTEGER,
    reviewed_at TIMESTAMP WITHOUT TIME ZONE,
    reviewed_by VARCHAR(255),
    review_note TEXT,
    approved_revision INTEGER,
    review_history JSONB NOT NULL DEFAULT '[]'::jsonb
)"""

_RUNTIME_MIGRATIONS = (
    "ADD COLUMN IF NOT EXISTS review_status VARCHAR(24)",
    "ADD COLUMN IF NOT EXISTS submitted_revision INTEGER",
    "ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITHOUT TIME ZONE",
    "ADD COLUMN IF NOT EXISTS reviewed_revision INTEGER",
    "ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITHOUT TIME ZONE",
    "ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(255)",
    "ADD COLUMN IF NOT EXISTS review_note TEXT",
    "ADD COLUMN IF NOT EXISTS approved_revision INTEGER",
    "ADD COLUMN IF NOT EXISTS review_history JSONB NOT NULL DEFAULT '[]'::jsonb",
)

_memory: Dict[str, Dict[str, Any]] = {}
_memory_lock = threading.Lock()
_table_ready: Optional[bool] = None


def _db():
    from src.backend.api.routes import execute_insert, execute_query, get_schema, is_lakebase_configured
    return execute_insert, execute_query, get_schema, is_lakebase_configured


def _ensure_table() -> Optional[str]:
    """Schema name when the table is usable, else None (memory only)."""
    global _table_ready
    try:
        execute_insert, _, get_schema, configured = _db()
        if not configured():
            return None
        schema = get_schema()
    except Exception:
        return None
    if _table_ready is None:
        try:
            _table_ready = bool(execute_insert(_DDL.format(schema=schema)))
            if _table_ready:
                for alteration in _RUNTIME_MIGRATIONS:
                    if not execute_insert(f"ALTER TABLE {schema}.ideate_ideas {alteration}"):
                        _table_ready = False
                        break
        except Exception as e:
            logger.warning(f"[Ideas] could not create table: {e}")
            _table_ready = False
        if not _table_ready:
            logger.warning("[Ideas] table unavailable; run setup-lakebase.sh to apply 14_ideate_ideas.sql")
    return schema if _table_ready else None


def _json(v: Any) -> Any:
    if isinstance(v, str):
        try:
            return json.loads(v)
        except ValueError:
            return None
    return v


def _iso(v: Any) -> Optional[str]:
    if v is None:
        return None
    return v.isoformat() if hasattr(v, "isoformat") else str(v)


def _row_out(r: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(r)
    for k in ("payload", "approved", "quality_breakdown", "catalog_ref", "review_history"):
        out[k] = _json(out.get(k))
    return out


def _get_row(idea_id: str) -> Optional[Dict[str, Any]]:
    schema = _ensure_table()
    if not schema:
        with _memory_lock:
            r = _memory.get(idea_id)
            return dict(r) if r else None
    _, execute_query, _, _ = _db()
    rows = execute_query(f"SELECT * FROM {schema}.ideate_ideas WHERE id = %s", (idea_id,)) or []
    return _row_out(rows[0]) if rows else None


def _owner_rows(email: str) -> List[Dict[str, Any]]:
    schema = _ensure_table()
    if not schema:
        with _memory_lock:
            return [dict(r) for r in _memory.values() if r["created_by"] == email and not r.get("deleted_at")]
    _, execute_query, _, _ = _db()
    rows = execute_query(
        f"SELECT * FROM {schema}.ideate_ideas WHERE created_by = %s AND deleted_at IS NULL ORDER BY updated_at DESC",
        (email,),
    ) or []
    return [_row_out(r) for r in rows]


def _catalog_source_to_status(source: Optional[str], is_active: Any) -> Optional[str]:
    if source == "ideate_approved" or (source in {"ideate", "ideate_pending", "ideate_changes", "ideate_rejected"} and bool(is_active)):
        return "approved"
    if source in {"ideate", "ideate_pending"} and not bool(is_active):
        return "pending"
    if source == "ideate_changes":
        return "changes_requested"
    if source in {"ideate_rejected", "ideate_dismissed"}:
        return "rejected"
    return None


def _synthetic_catalog_row(uc: Dict[str, Any], status: str) -> Dict[str, Any]:
    industry = uc.get("industry") or "other"
    use_case = uc.get("use_case") or "use_case"
    title = uc.get("use_case_label") or use_case
    industry_label = uc.get("industry_label") or industry
    owner = uc.get("created_by") or "unknown"
    version = int(uc.get("version") or 1)
    brief = uc.get("prompt_template") or ""
    updated = uc.get("updated_at") or uc.get("inserted_at")
    profile = None
    try:
        from src.backend.api.value_profiles import get_profile
        profile = get_profile(industry, use_case)
    except Exception:
        profile = None
    value_per_year = None
    if isinstance(profile, dict):
        low = profile.get("typicalLow")
        high = profile.get("typicalHigh")
        if isinstance(low, (int, float)) and isinstance(high, (int, float)) and high > 0:
            value_per_year = round((low + high) / 2.0)
    catalog_ref = {"industry": industry, "useCase": use_case, "version": version}
    payload: Dict[str, Any] = {
        "id": f"catalog:{industry}.{use_case}",
        "mode": "ideate",
        "title": title,
        "seed": title,
        "industry": industry_label,
        "status": "committed",
        "step": "brief",
        "approved": ["spark", "brief"],
        "spark": {
            "title": title,
            "statement": title,
            "industry": industry_label,
            "catalogIndustry": industry,
            "catalogIndustryLabel": industry_label,
            "valueHypothesis": profile.get("valuePool") if isinstance(profile, dict) else None,
        },
        "brief": brief,
        "revision": version,
        "catalogRef": catalog_ref,
        "useCaseContext": {"valueProfile": profile} if profile else None,
        "createdAt": _iso(updated) or datetime.utcnow().isoformat() + "Z",
        "updatedAt": _iso(updated) or datetime.utcnow().isoformat() + "Z",
    }
    return {
        "id": f"catalog:{industry}.{use_case}",
        "created_by": owner,
        "mode": "ideate",
        "title": title,
        "industry": industry_label,
        "status": "committed",
        "step": "brief",
        "approved": ["spark", "brief"],
        "payload": payload,
        "value_per_year": value_per_year,
        "journey_points": journey_points(payload),
        "quality_score": None,
        "quality_breakdown": None,
        "total_points": journey_points(payload),
        "catalog_ref": catalog_ref,
        "created_at": updated,
        "updated_at": updated,
        "submitted_at": updated,
        "submitted_revision": version,
        "review_status": status,
        "reviewed_revision": version if status != "pending" else None,
        "approved_revision": version if status == "approved" else None,
        "review_history": [{"action": "submitted", "revision": version, "by": owner, "at": _iso(updated) or ""}],
    }


def _review_rows() -> List[Dict[str, Any]]:
    schema = _ensure_table()
    if not schema:
        with _memory_lock:
            rows = [
                dict(r) for r in _memory.values()
                if not r.get("deleted_at") and (r.get("review_status") in REVIEW_STATUSES or r.get("catalog_ref"))
            ]
            for r in rows:
                if r.get("review_status") not in REVIEW_STATUSES and r.get("catalog_ref"):
                    r["review_status"] = "pending"
                    rev = _revision(r.get("payload") or {}) or 1
                    r["submitted_revision"] = r.get("submitted_revision") or rev
        rows.sort(key=lambda r: _iso(r.get("submitted_at") or r.get("updated_at")) or "", reverse=True)
        return rows
    execute_insert, execute_query, _, _ = _db()
    rows = execute_query(
        f"SELECT * FROM {schema}.ideate_ideas "
        f"WHERE deleted_at IS NULL AND ("
        f"  review_status IN ('pending', 'changes_requested', 'approved', 'rejected') "
        f"  OR catalog_ref IS NOT NULL "
        f"  OR (payload ? 'catalogRef')"
        f") "
        f"ORDER BY submitted_at DESC NULLS LAST, updated_at DESC"
    ) or []
    parsed_rows = [_row_out(r) for r in rows]

    # Reconcile with usecase_descriptions so catalog rows and ideate_ideas never drift
    catalog_rows: List[Dict[str, Any]] = []
    try:
        catalog_rows = execute_query(
            f"SELECT DISTINCT ON (industry, use_case) "
            f"industry, industry_label, use_case, use_case_label, prompt_template, version, "
            f"is_active, category, created_by, source, inserted_at, updated_at "
            f"FROM {schema}.usecase_descriptions "
            f"WHERE use_case <> '_placeholder' "
            f"AND source IN ('ideate', 'ideate_pending', 'ideate_changes', 'ideate_rejected', 'ideate_approved', 'ideate_dismissed') "
            f"ORDER BY industry, use_case, version DESC"
        ) or []
    except Exception as e:
        logger.info(f"[Ideas] catalog review reconciliation skipped: {e}")

    catalog_by_key: Dict[tuple, Dict[str, Any]] = {
        (c.get("industry"), c.get("use_case")): c for c in catalog_rows
    }
    linked_keys: set = set()
    out_rows: List[Dict[str, Any]] = []

    for r in parsed_rows:
        ref = r.get("catalog_ref") or (r.get("payload") or {}).get("catalogRef")
        ref = _json(ref) if ref else None
        key = (ref.get("industry"), ref.get("useCase")) if isinstance(ref, dict) else None
        if key and key[0] and key[1]:
            linked_keys.add(key)
            r["catalog_ref"] = ref
        cat = catalog_by_key.get(key) if key else None
        cat_status = _catalog_source_to_status(cat.get("source"), cat.get("is_active")) if cat else None
        r_status = r.get("review_status")

        if r_status not in REVIEW_STATUSES:
            effective = cat_status or "pending"
            rev = _revision(r.get("payload") or {}) or 1
            r["review_status"] = effective
            r["submitted_revision"] = r.get("submitted_revision") or rev
            if effective == "approved":
                r["approved_revision"] = r.get("approved_revision") or rev
        elif cat and cat_status and cat_status != r_status:
            # If the catalog row was approved/dismissed directly in Library, or ideate_ideas was reviewed
            # while an older catalog version stayed ideate_pending, keep them consistent.
            if r_status in {"approved", "changes_requested", "rejected"} and cat.get("source") in {"ideate", "ideate_pending"}:
                _update_catalog_review(ref, r_status)
            elif r_status == "pending" and cat_status in {"approved", "rejected"}:
                rev = r.get("submitted_revision") or _revision(r.get("payload") or {}) or 1
                r["review_status"] = cat_status
                if cat_status == "approved":
                    r["approved_revision"] = rev

        if r.get("review_status") in REVIEW_STATUSES:
            out_rows.append(r)

    for key, cat in catalog_by_key.items():
        if key in linked_keys:
            continue
        cat_status = _catalog_source_to_status(cat.get("source"), cat.get("is_active"))
        if cat_status in REVIEW_STATUSES:
            out_rows.append(_synthetic_catalog_row(cat, cat_status))

    out_rows.sort(key=lambda r: _iso(r.get("submitted_at") or r.get("updated_at")) or "", reverse=True)
    return out_rows


def _active_rows() -> List[Dict[str, Any]]:
    schema = _ensure_table()
    if not schema:
        with _memory_lock:
            return [{**r, "build_stage": (r.get("payload") or {}).get("buildStage"),
                     "idea_created_at": (r.get("payload") or {}).get("createdAt") or _iso(r.get("created_at"))}
                    for r in _memory.values() if not r.get("deleted_at") and r.get("approved")]
    _, execute_query, _, _ = _db()
    rows = execute_query(
        f"SELECT id, created_by, mode, session_id, title, industry, status, step, approved, value_per_year, journey_points, "
        f"quality_score, quality_breakdown, total_points, catalog_ref, locked_at, payload->>'buildStage' AS build_stage, "
        f"COALESCE(payload->>'createdAt', created_at::text) AS idea_created_at, "
        f"updated_at, points_reached_at FROM {schema}.ideate_ideas "
        f"WHERE deleted_at IS NULL AND jsonb_array_length(approved) > 0"
    ) or []
    return [_row_out(r) for r in rows]


def _write_row(row: Dict[str, Any]) -> bool:
    schema = _ensure_table()
    if not schema:
        with _memory_lock:
            prev = _memory.get(row["id"], {})
            _memory[row["id"]] = {**prev, **row}
        return True
    execute_insert, _, _, _ = _db()
    cols = ["created_by", "mode", "session_id", "title", "industry", "status", "step", "approved", "payload",
            "value_per_year", "journey_points", "total_points", "catalog_ref", "locked_at"]
    jsonb = {"approved", "payload", "catalog_ref"}
    vals = [json.dumps(row[c]) if c in jsonb and row[c] is not None else row[c] for c in cols]
    placeholders = [("%s::jsonb" if c in jsonb else "%s") for c in cols]
    reached = "CASE WHEN {t}.total_points <> EXCLUDED.total_points THEN CURRENT_TIMESTAMP ELSE {t}.points_reached_at END".format(
        t=f"{schema}.ideate_ideas")
    updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols if c != "created_by")
    return bool(execute_insert(
        f"INSERT INTO {schema}.ideate_ideas (id, {', '.join(cols)}, created_at, updated_at, points_reached_at) "
        f"VALUES (%s, {', '.join(placeholders)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) "
        f"ON CONFLICT (id) DO UPDATE SET {updates}, updated_at = CURRENT_TIMESTAMP, points_reached_at = {reached} "
        f"WHERE {schema}.ideate_ideas.created_by = EXCLUDED.created_by AND {schema}.ideate_ideas.deleted_at IS NULL",
        tuple([row["id"]] + vals),
    ))


def _save_quality(idea_id: str, breakdown: List[Dict[str, Any]], quality: int, revision: int, total: int) -> bool:
    schema = _ensure_table()
    if not schema:
        with _memory_lock:
            if idea_id in _memory:
                _memory[idea_id].update(quality_breakdown=breakdown, quality_score=quality, quality_revision=revision,
                                        scored_at=datetime.utcnow(), total_points=total, points_reached_at=datetime.utcnow())
        return True
    execute_insert, _, _, _ = _db()
    return bool(execute_insert(
        f"UPDATE {schema}.ideate_ideas SET quality_breakdown = %s::jsonb, quality_score = %s, quality_revision = %s, "
        f"scored_at = CURRENT_TIMESTAMP, total_points = %s, points_reached_at = CURRENT_TIMESTAMP WHERE id = %s",
        (json.dumps(breakdown), quality, revision, total, idea_id),
    ))


def _soft_delete(idea_id: str) -> bool:
    schema = _ensure_table()
    if not schema:
        with _memory_lock:
            if idea_id in _memory:
                _memory[idea_id]["deleted_at"] = datetime.utcnow()
        return True
    execute_insert, _, _, _ = _db()
    return bool(execute_insert(f"UPDATE {schema}.ideate_ideas SET deleted_at = CURRENT_TIMESTAMP WHERE id = %s", (idea_id,)))


_approved_cache: Dict[str, Any] = {"at": 0.0, "keys": set()}


def _library_approved() -> set:
    """(industry, use_case) pairs of Ideate submissions an admin has approved."""
    if time.time() - _approved_cache["at"] < 60:
        return _approved_cache["keys"]
    keys: set = set()
    try:
        _, execute_query, get_schema, configured = _db()
        if configured():
            rows = execute_query(
                f"SELECT DISTINCT industry, use_case FROM {get_schema()}.usecase_descriptions "
                f"WHERE is_active = TRUE AND source = 'ideate_approved'"
            ) or []
            keys = {(r.get("industry"), r.get("use_case")) for r in rows}
    except Exception as e:
        logger.info(f"[Ideas] library approval lookup failed: {e}")
    _approved_cache.update(at=time.time(), keys=keys)
    return keys


def _is_library_approved(catalog_ref: Any) -> bool:
    ref = _json(catalog_ref)
    if not isinstance(ref, dict):
        return False
    return (ref.get("industry"), ref.get("useCase")) in _library_approved()


def _points(row: Dict[str, Any], idea: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """The score object the browser shows; `idea` defaults to the stored payload."""
    idea = idea if idea is not None else (row.get("payload") or {})
    approved_lib = _is_library_approved(row.get("catalog_ref") or idea.get("catalogRef"))
    journey = journey_points(idea)
    outcome = outcome_points(idea, approved_lib)
    breakdown = row.get("quality_breakdown") or None
    quality = row.get("quality_score")
    total = journey + outcome + (quality or 0)
    return {
        "journey": journey,
        "quality": quality,
        "outcome": outcome,
        "total": total,
        "tier": tier_for(total),
        "breakdown": breakdown.get("dimensions") if isinstance(breakdown, dict) else None,
        "headline": breakdown.get("headline") if isinstance(breakdown, dict) else None,
        "revision": row.get("quality_revision"),
        "scoredAt": _iso(row.get("scored_at")),
        "approvedInLibrary": approved_lib,
    }


def _with_score(row: Dict[str, Any]) -> Dict[str, Any]:
    idea = dict(row.get("payload") or {})
    if row.get("catalog_ref"):
        idea["catalogRef"] = _json(row.get("catalog_ref"))
    else:
        idea.pop("catalogRef", None)
    idea["score"] = _points(row, idea)
    idea["review"] = _review_metadata(row)
    return idea


# ============== Helpers ==============

def _review_metadata(row: Dict[str, Any]) -> Dict[str, Any]:
    current_revision = _revision(row.get("payload") or {})
    return {
        "status": row.get("review_status") or "draft",
        "revision": row.get("submitted_revision") or current_revision or 0,
        "submittedRevision": row.get("submitted_revision"),
        "submittedAt": _iso(row.get("submitted_at")),
        "reviewedRevision": row.get("reviewed_revision"),
        "reviewedAt": _iso(row.get("reviewed_at")),
        "reviewer": row.get("reviewed_by"),
        "reviewedBy": row.get("reviewed_by"),
        "note": row.get("review_note"),
        "latestNote": row.get("review_note"),
        "approvedRevision": row.get("approved_revision"),
        "history": _json(row.get("review_history")) or [],
    }


def _email_set(name: str) -> set:
    return {email.strip().lower() for email in os.getenv(name, "").split(",") if email.strip()}


def reviewer_email(request: Request) -> Optional[str]:
    """Central reviewer policy. Provider groups can be added here later."""
    user = _signed_in(request)
    if not user:
        return None
    lowered = user.lower()
    if lowered in _email_set("APP_ADMINS"):
        return user
    configured = os.getenv("IDEATE_REVIEWERS", "*").strip()
    if configured == "*":
        return user
    allowed = {email.strip().lower() for email in configured.split(",") if email.strip()}
    return user if lowered in allowed else None


def _review_forbidden(request: Request) -> Optional[JSONResponse]:
    if not _signed_in(request):
        return JSONResponse({"error": "Sign in to review ideas."}, status_code=401)
    if not reviewer_email(request):
        return JSONResponse({"error": "You are not configured as an Ideate reviewer."}, status_code=403)
    return None

def _signed_in(request: Request) -> Optional[str]:
    user = _resolve_user(request)
    return user if user and user != "unknown" else None


def _display_name(email: str) -> str:
    from src.backend.services.lakebase import _format_display_name
    return _format_display_name(email)


def _avatar(email: str) -> str:
    from src.backend.services.lakebase import AVATAR_EMOJIS
    h = 0
    for ch in (email or "").lower():
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return AVATAR_EMOJIS[h % len(AVATAR_EMOJIS)]


def _clean_payload(idea: Dict[str, Any]) -> Dict[str, Any]:
    """Drops what the server owns or must never store."""
    out = {k: v for k, v in idea.items() if k not in ("score", "sample", "review", "catalogRef")}
    return out


def _str(v: Any, limit: int) -> str:
    return str(v or "").strip()[:limit]


def _row_from_idea(idea: Dict[str, Any], owner: str, value_per_year: Optional[float]) -> Dict[str, Any]:
    spark = idea.get("spark") if isinstance(idea.get("spark"), dict) else {}
    approved = _approved(idea)
    journey = journey_points(idea)
    total_wo_quality = journey
    return {
        "id": _str(idea.get("id"), 64),
        "created_by": owner,
        "mode": _mode(idea),
        "session_id": _str(idea.get("sessionId"), 64) or None,
        "title": _str(idea.get("title"), 300) or "Untitled idea",
        "industry": _str(spark.get("industry") or idea.get("industry"), 200),
        "status": _str(idea.get("status"), 20) or "exploring",
        "step": _str(idea.get("step"), 20) or "spark",
        "approved": approved,
        "payload": idea,
        "value_per_year": value_per_year if isinstance(value_per_year, (int, float)) and value_per_year >= 0 else None,
        "journey_points": journey,
        "total_points": total_wo_quality,
        "catalog_ref": None,
        "locked_at": idea.get("lockedAt") or None,
    }


def _revision(idea: Dict[str, Any]) -> Optional[int]:
    value = idea.get("revision")
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 1 else None


def _has_build_link(idea: Dict[str, Any]) -> bool:
    return bool(idea.get("sessionId") or idea.get("lockedAt") or idea.get("buildStage"))


def _new_build_link(existing: Optional[Dict[str, Any]], idea: Dict[str, Any]) -> bool:
    old = (existing or {}).get("payload") or {}
    if not _has_build_link(idea):
        return False
    if not _has_build_link(old):
        return True
    old_session = old.get("sessionId")
    new_session = idea.get("sessionId")
    return bool(new_session and new_session != old_session)


def _build_authorization_error(row: Dict[str, Any], owner: str) -> Optional[JSONResponse]:
    if row.get("created_by") != owner:
        return JSONResponse(
            {"error": "Only the idea owner can build this idea.", "reason": "Owner access is required.", "code": "not_owner"},
            status_code=403,
        )
    current = _revision(row.get("payload") or {})
    if row.get("review_status") != "approved":
        return JSONResponse(
            {
                "error": "This idea must be approved before starting a build.",
                "reason": "Submit the current revision and wait for approval.",
                "code": "approval_required",
                "review": _review_metadata(row),
            },
            status_code=409,
        )
    if current is None or row.get("approved_revision") != current:
        return JSONResponse(
            {
                "error": "This idea changed after approval. Submit the current revision for review.",
                "reason": "The approved revision is stale.",
                "code": "stale_approval",
                "review": _review_metadata(row),
            },
            status_code=409,
        )
    return None


def _history_entry(action: str, revision: int, actor: str, note: Optional[str] = None) -> Dict[str, Any]:
    return {
        "action": action,
        "revision": revision,
        "by": actor,
        "at": datetime.utcnow().isoformat() + "Z",
        "note": note or None,
    }


def mark_submitted(idea_id: str, owner: str, revision: int, catalog_ref: Dict[str, Any]) -> bool:
    """Persist the server-owned catalog link and pending review metadata."""
    schema = _ensure_table()
    entry = _history_entry("submitted", revision, owner)
    if not schema:
        with _memory_lock:
            row = _memory.get(idea_id)
            if not row or row.get("created_by") != owner or _revision(row.get("payload") or {}) != revision:
                return False
            history = list(row.get("review_history") or [])
            history.append(entry)
            payload = dict(row.get("payload") or {})
            payload["catalogRef"] = catalog_ref
            row.update(
                payload=payload,
                catalog_ref=catalog_ref,
                review_status="pending",
                submitted_revision=revision,
                submitted_at=datetime.utcnow(),
                review_history=history,
                updated_at=datetime.utcnow(),
            )
        return True
    execute_insert, _, _, _ = _db()
    return bool(execute_insert(
        f"UPDATE {schema}.ideate_ideas SET catalog_ref = %s::jsonb, "
        f"payload = payload || jsonb_build_object('catalogRef', %s::jsonb), "
        f"review_status = 'pending', submitted_revision = %s, submitted_at = CURRENT_TIMESTAMP, "
        f"review_history = COALESCE(review_history, '[]'::jsonb) || %s::jsonb, updated_at = CURRENT_TIMESTAMP "
        f"WHERE id = %s AND created_by = %s AND deleted_at IS NULL "
        f"AND COALESCE((payload->>'revision')::integer, 0) = %s",
        (json.dumps(catalog_ref), json.dumps(catalog_ref), revision, json.dumps([entry]), idea_id, owner, revision),
    ))


# ============== Endpoints ==============

class SaveIdeaRequest(BaseModel):
    idea: Dict[str, Any]
    value_per_year: Optional[float] = None


class ReviewActionRequest(BaseModel):
    action: str
    note: Optional[str] = None


def _review_payload(row: Dict[str, Any], viewer: str = "") -> Dict[str, Any]:
    owner = row.get("created_by") or ""
    idea = _with_score(row)
    return {
        "id": row.get("id"),
        "title": row.get("title") or idea.get("title") or "Untitled idea",
        "industry": row.get("industry") or idea.get("industry") or "",
        "idea": idea,
        "isOwner": bool(viewer) and owner == viewer,
        "owner": {"email": owner, "displayName": _display_name(owner), "avatar": _avatar(owner)},
        "review": _review_metadata(row),
        "updatedAt": _iso(row.get("updated_at")),
        "businessContext": {
            "spark": idea.get("spark"),
            "brief": idea.get("brief"),
            "impact": idea.get("impact"),
            "summary": idea.get("summary"),
            "valuePerYear": row.get("value_per_year"),
        },
        "score": idea.get("score"),
    }


def _update_catalog_review(catalog_ref: Any, status: str) -> bool:
    ref = _json(catalog_ref)
    if not isinstance(ref, dict):
        return False
    schema = _ensure_table()
    if not schema:
        return True
    execute_insert, _, _, _ = _db()
    source = {
        "pending": "ideate_pending",
        "approved": "ideate_approved",
        "changes_requested": "ideate_changes",
        "rejected": "ideate_rejected",
    }[status]
    ok = bool(execute_insert(
        f"UPDATE {schema}.usecase_descriptions SET is_active = %s, source = %s, updated_at = CURRENT_TIMESTAMP "
        f"WHERE industry = %s AND use_case = %s",
        (status == "approved", source, ref.get("industry"), ref.get("useCase")),
    ))
    try:
        from src.backend.api.routes import _invalidate_cache
        _invalidate_cache()
    except Exception:
        pass
    return ok


def _find_review_row(idea_id: str) -> Optional[Dict[str, Any]]:
    row = _get_row(idea_id)
    if row and not row.get("deleted_at"):
        if row.get("review_status") in REVIEW_STATUSES:
            return row
        if row.get("catalog_ref") or (row.get("payload") or {}).get("catalogRef"):
            for r in _review_rows():
                if r.get("id") == idea_id:
                    return r
    for r in _review_rows():
        if r.get("id") == idea_id:
            return r
        ref = r.get("catalog_ref")
        if isinstance(ref, dict) and f"catalog:{ref.get('industry')}.{ref.get('useCase')}" == idea_id:
            return r
    return None


def _store_review_action(row: Dict[str, Any], reviewer: str, status: str, action: str, note: Optional[str]) -> bool:
    idea_id = str(row["id"])
    if idea_id.startswith("catalog:"):
        return True
    revision = int(row.get("submitted_revision") or _revision(row.get("payload") or {}) or 1)
    entry = _history_entry(action, revision, reviewer, note)
    schema = _ensure_table()
    if not schema:
        with _memory_lock:
            current = _memory.get(idea_id)
            if (
                not current
                or current.get("review_status") != "pending"
                or current.get("submitted_revision") != revision
                or _revision(current.get("payload") or {}) != revision
            ):
                return False
            history = list(current.get("review_history") or [])
            history.append(entry)
            current.update(
                review_status=status,
                reviewed_revision=revision,
                reviewed_at=datetime.utcnow(),
                reviewed_by=reviewer,
                review_note=note,
                approved_revision=revision if status == "approved" else current.get("approved_revision"),
                review_history=history,
                updated_at=datetime.utcnow(),
            )
        return True
    execute_insert, _, _, _ = _db()
    approved_sql = "approved_revision = %s," if status == "approved" else ""
    params: List[Any] = [status, revision, reviewer, note]
    if status == "approved":
        params.append(revision)
    params.extend([json.dumps([entry]), idea_id, revision, revision])
    return bool(execute_insert(
        f"UPDATE {schema}.ideate_ideas SET review_status = %s, reviewed_revision = %s, "
        f"reviewed_at = CURRENT_TIMESTAMP, reviewed_by = %s, review_note = %s, {approved_sql} "
        f"review_history = COALESCE(review_history, '[]'::jsonb) || %s::jsonb, updated_at = CURRENT_TIMESTAMP "
        f"WHERE id = %s AND (review_status = 'pending' OR review_status IS NULL) "
        f"AND COALESCE(submitted_revision, COALESCE((payload->>'revision')::integer, 1)) = %s "
        f"AND COALESCE((payload->>'revision')::integer, 1) = %s",
        tuple(params),
    ))


@router.get("/ideate/capabilities", summary="Current user's Ideate permissions")
@router.get("/ideate/reviews/capability", summary="Whether the current user may review ideas")
async def ideate_capabilities(request: Request):
    user = _signed_in(request)
    return {
        "signedIn": bool(user),
        "email": user,
        "canReview": bool(reviewer_email(request)),
        "reviewPolicy": "authenticated" if os.getenv("IDEATE_REVIEWERS", "*").strip() == "*" else "allowlist",
    }


@router.get("/ideate/reviews", summary="Reviewer queue across idea owners")
async def list_ideate_reviews(request: Request, status: str = ""):
    denied = _review_forbidden(request)
    if denied:
        return denied
    if status and status != "all" and status not in REVIEW_STATUSES:
        return JSONResponse({"error": "Unknown review status."}, status_code=400)
    rows = _review_rows()
    if status and status != "all":
        rows = [row for row in rows if row.get("review_status") == status]
    viewer = _signed_in(request) or ""
    return {"ideas": [_review_payload(row, viewer) for row in rows]}


@router.get("/ideate/reviews/{idea_id}", summary="Reviewer detail for one submitted idea")
async def get_ideate_review(idea_id: str, request: Request):
    denied = _review_forbidden(request)
    if denied:
        return denied
    row = _find_review_row(idea_id)
    if not row or row.get("deleted_at") or row.get("review_status") not in REVIEW_STATUSES:
        return JSONResponse({"error": "This submitted idea isn't available."}, status_code=404)
    return _review_payload(row, _signed_in(request) or "")


@router.post("/ideate/reviews/{idea_id}/action", summary="Approve, request changes, or reject a submitted idea")
@router.post("/ideate/reviews/{idea_id}/actions", summary="Approve, request changes, or reject a submitted idea")
async def review_ideate_idea(idea_id: str, body: ReviewActionRequest, request: Request):
    denied = _review_forbidden(request)
    if denied:
        return denied
    if body.action not in REVIEW_ACTIONS:
        return JSONResponse({"error": "Action must be approve, request_changes, or reject."}, status_code=400)
    note = (body.note or "").strip() or None
    if body.action in {"request_changes", "changes_requested", "reject"} and not note:
        return JSONResponse({"error": "A review note is required for this action."}, status_code=400)
    row = _find_review_row(idea_id)
    if not row or row.get("deleted_at"):
        return JSONResponse({"error": "This submitted idea isn't available."}, status_code=404)
    if row.get("review_status") != "pending":
        return JSONResponse({"error": "Only a pending submission can be reviewed.", "review": _review_metadata(row)}, status_code=409)
    is_catalog_only = str(row.get("id", "")).startswith("catalog:")
    current = _revision(row.get("payload") or {})
    if not is_catalog_only and (current is None or current != row.get("submitted_revision")):
        return JSONResponse(
            {"error": "The idea changed after submission. Ask the owner to resubmit the current revision."},
            status_code=409,
        )
    status = {
        "approve": "approved",
        "request_changes": "changes_requested",
        "changes_requested": "changes_requested",
        "reject": "rejected",
    }[body.action]
    if not _update_catalog_review(row.get("catalog_ref"), status):
        return JSONResponse({"error": "The linked catalog entry could not be updated."}, status_code=500)
    reviewer = reviewer_email(request) or ""
    if not _store_review_action(row, reviewer, status, status, note):
        _update_catalog_review(row.get("catalog_ref"), "pending")
        return JSONResponse({"error": "The review changed concurrently. Reload and try again."}, status_code=409)
    _approved_cache["at"] = 0.0
    _leaderboard_cache.clear()
    updated = _find_review_row(str(row.get("id"))) or {
        **row,
        "review_status": status,
        "reviewed_revision": row.get("submitted_revision") or 1,
        "reviewed_by": reviewer,
        "review_note": note,
        "approved_revision": (row.get("submitted_revision") or 1) if status == "approved" else row.get("approved_revision"),
        "review_history": list(row.get("review_history") or []) + [
            _history_entry(status, int(row.get("submitted_revision") or 1), reviewer, note)
        ],
    }
    return _review_payload(updated, _signed_in(request) or "")


@router.get("/ideate/ideas", summary="My saved ideas, with their points")
async def list_my_ideas(request: Request):
    user = _signed_in(request)
    if not user:
        return JSONResponse({"error": "Sign in to save ideas."}, status_code=401)
    return {"ideas": [_with_score(r) for r in _owner_rows(user)]}


@router.put("/ideate/ideas/{idea_id}", summary="Save an idea; the server recomputes its points")
async def save_idea(idea_id: str, body: SaveIdeaRequest, request: Request):
    user = _signed_in(request)
    if not user:
        return JSONResponse({"error": "Sign in to save ideas."}, status_code=401)
    if not re.fullmatch(r"[A-Za-z0-9_-]{4,64}", idea_id) or body.idea.get("id") != idea_id:
        return JSONResponse({"error": "Idea id does not match."}, status_code=400)
    if body.idea.get("sample"):
        return JSONResponse({"error": "Samples are not saved."}, status_code=400)
    idea = _clean_payload(body.idea)
    if len(json.dumps(idea, ensure_ascii=False)) > MAX_PAYLOAD_CHARS:
        return JSONResponse({"error": "This idea is too large to save."}, status_code=413)

    existing = _get_row(idea_id)
    if existing and existing.get("created_by") != user:
        return JSONResponse({"error": "This idea belongs to someone else."}, status_code=403)
    if existing and existing.get("deleted_at"):
        return JSONResponse({"error": "This idea was deleted.", "deleted": True}, status_code=410)
    if _new_build_link(existing, idea):
        candidate = {**(existing or {}), "payload": idea}
        blocked = _build_authorization_error(candidate, user)
        if blocked:
            return blocked

    row = _row_from_idea(idea, user, body.value_per_year)
    if existing and existing.get("catalog_ref"):
        row["catalog_ref"] = existing["catalog_ref"]
        row["payload"]["catalogRef"] = existing["catalog_ref"]
        row["total_points"] += outcome_points(row["payload"], _is_library_approved(existing["catalog_ref"]))
    if existing and existing.get("quality_score") is not None:
        row["total_points"] += int(existing["quality_score"])
    if not _write_row(row):
        return JSONResponse({"error": "Couldn't save the idea. Your work is still in this browser."}, status_code=500)
    _leaderboard_cache.clear()
    merged = {**(existing or {}), **row}
    return {"id": idea_id, "score": _points(merged, idea), "review": _review_metadata(merged)}


@router.post("/ideate/ideas/{idea_id}/submit-review", summary="Submit the saved current revision for governed review")
async def submit_saved_idea_for_review(idea_id: str, request: Request):
    user = _signed_in(request)
    if not user:
        return JSONResponse({"error": "Sign in to submit an idea."}, status_code=401)
    row = _get_row(idea_id)
    if not row or row.get("deleted_at"):
        return JSONResponse({"error": "Save this idea before submitting it for review."}, status_code=404)
    if row.get("created_by") != user:
        return JSONResponse({"error": "Only the idea owner can submit it for review."}, status_code=403)
    idea = row.get("payload") or {}
    spark = idea.get("spark") if isinstance(idea.get("spark"), dict) else {}
    from src.backend.api.ideate import IdeateSubmitRequest, ideate_submit

    result = await ideate_submit(
        IdeateSubmitRequest(
            idea_id=idea_id,
            idea={"id": idea_id, "revision": idea.get("revision")},
            business_case=idea.get("summary") if isinstance(idea.get("summary"), dict) else None,
            brief=str(idea.get("brief") or ""),
            industry=spark.get("catalogIndustry") or None,
            industry_label=str(spark.get("catalogIndustryLabel") or spark.get("industry") or row.get("industry") or "Other"),
            use_case_label=str(idea.get("title") or row.get("title") or "Untitled idea"),
            category=str(idea.get("category") or "").strip() or None,
            use_case=(row.get("catalog_ref") or {}).get("useCase") if isinstance(row.get("catalog_ref"), dict) else None,
        ),
        request,
    )
    return result


@router.get("/ideate/ideas/{idea_id}", summary="Read one idea (read-only for anyone signed in)")
async def get_idea(idea_id: str, request: Request):
    user = _signed_in(request)
    if not user:
        return JSONResponse({"error": "Sign in to view ideas."}, status_code=401)
    row = _get_row(idea_id)
    if not row or row.get("deleted_at"):
        return JSONResponse({"error": "This idea isn't available."}, status_code=404)
    owner = row.get("created_by") or ""
    return {
        "idea": _with_score(row),
        "owner": {"displayName": _display_name(owner), "avatar": _avatar(owner)},
        "isOwner": owner == user,
    }


def _authorize_build_response(
    idea_id: str,
    request: Request,
    requested_revision: Optional[int] = None,
    operation: str = "start",
):
    user = _signed_in(request)
    if not user:
        return JSONResponse({"error": "Sign in to build an idea."}, status_code=401)
    if operation not in {"start", "update"}:
        return JSONResponse({"error": "Operation must be start or update.", "code": "invalid_operation"}, status_code=400)
    row = _get_row(idea_id)
    if not row or row.get("deleted_at"):
        return JSONResponse({"error": "This idea isn't available."}, status_code=404)
    current = _revision(row.get("payload") or {})
    if requested_revision is not None and requested_revision != current:
        return JSONResponse(
            {
                "error": "The requested build revision is not the current saved revision.",
                "reason": "Save the current idea before building.",
                "code": "revision_mismatch",
                "review": _review_metadata(row),
            },
            status_code=409,
        )
    blocked = _build_authorization_error(row, user)
    if blocked:
        return blocked
    return {
        "authorized": True,
        "ideaId": idea_id,
        "revision": current,
        "approvedRevision": row.get("approved_revision"),
        "review": _review_metadata(row),
        "operation": operation,
    }


@router.get("/ideate/ideas/{idea_id}/build-authorization", summary="Check whether the current approved revision may build")
async def get_build_authorization(
    idea_id: str,
    request: Request,
    revision: Optional[int] = None,
    operation: str = "start",
):
    return _authorize_build_response(idea_id, request, revision, operation)


@router.post("/ideate/ideas/{idea_id}/authorize-build", summary="Authorize applying or starting the current idea revision")
async def authorize_build(idea_id: str, request: Request):
    return _authorize_build_response(idea_id, request)


@router.delete("/ideate/ideas/{idea_id}", summary="Delete one of my ideas")
async def delete_idea(idea_id: str, request: Request):
    user = _signed_in(request)
    if not user:
        return JSONResponse({"error": "Sign in to manage ideas."}, status_code=401)
    row = _get_row(idea_id)
    if not row:
        return {"deleted": True}
    if row.get("created_by") != user:
        return JSONResponse({"error": "This idea belongs to someone else."}, status_code=403)
    _soft_delete(idea_id)
    _leaderboard_cache.clear()
    return {"deleted": True}


# ---------- AI quality judge ----------

_score_log: Dict[str, List[float]] = {}


def _judge_context(idea: Dict[str, Any]) -> str:
    def pick(d: Any, *keys: str) -> Dict[str, Any]:
        return {k: d.get(k) for k in keys if isinstance(d, dict) and d.get(k)}

    map_ = idea.get("map") if isinstance(idea.get("map"), dict) else {}
    leaf = None
    also_ids = [i for i in map_.get("alsoLeafIds") or [] if isinstance(i, str)]
    also: Dict[str, str] = {}
    for b in map_.get("branches") or []:
        for l in (b or {}).get("leaves") or []:
            if l.get("id") == map_.get("placedLeafId"):
                leaf = {"branch": b.get("name"), **pick(l, "name", "problem", "personas", "valuePool")}
            elif l.get("id") in also_ids:
                also[l.get("id")] = f"{b.get('name')}: {l.get('name')}"
    if leaf and also:
        leaf["alsoCovers"] = [also[i] for i in also_ids if i in also]
    questions = {q.get("id"): q.get("question") for q in idea.get("questions") or [] if isinstance(q, dict)}
    answers = [{"question": questions.get(k), "answer": v} for k, v in (idea.get("answers") or {}).items() if questions.get(k)]
    shape = next((s for s in idea.get("shapes") or [] if isinstance(s, dict) and s.get("id") == idea.get("chosenShapeId")), None)
    impact = idea.get("impact") if isinstance(idea.get("impact"), dict) else None
    ctx = {
        "mode": _mode(idea),
        "title": idea.get("title"),
        "rawIdea": idea.get("seed"),
        "intent": pick(idea.get("spark"), "statement", "industry", "valueHypothesis", "businessLine"),
        "industryPlacement": leaf,
        "clarifyingAnswers": answers,
        "chosenApproach": pick(shape, "title", "value", "effort", "riskiestAssumption", "cheapTest") if shape else None,
        "genieQuestions": idea.get("genieQuestions"),
        "impact": "skipped" if not impact or impact.get("skipped") else {
            **pick(impact, "driverLabel", "scope"),
            "answers": [{"value": a.get("label"), "source": a.get("source")} for a in (impact.get("answers") or {}).values() if isinstance(a, dict)],
        },
        "acceptedAssumptions": [a.get("text") for a in idea.get("assumptions") or [] if isinstance(a, dict) and a.get("status") == "accepted"],
    }
    text = json.dumps({k: v for k, v in ctx.items() if v}, ensure_ascii=False, indent=1)
    brief = str(idea.get("brief") or "")
    return f"<idea>\nCONTEXT:\n{text[:JUDGE_CONTEXT_CHARS // 2]}\n\nBRIEF:\n{brief[:JUDGE_CONTEXT_CHARS]}\n</idea>"


def _parse_judge(text: str, idea: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    m = re.search(r"\{.*\}", text or "", re.S)
    if not m:
        return None
    try:
        data = json.loads(m.group(0), strict=False)
    except ValueError:
        return None
    dims_in = data.get("dimensions") if isinstance(data, dict) else None
    if not isinstance(dims_in, dict):
        return None
    caps: Dict[str, int] = {}
    if _impact_share(idea) is None:
        caps["value"] = CAP_NO_IMPACT
    if _real_answers(idea) == 0:
        caps["users"] = CAP_NO_ANSWERS
    if not (idea.get("map") or {}).get("placedLeafId"):
        caps["feasibility"] = CAP_NO_MAP
    dims = []
    for key, label in DIMENSIONS:
        d = dims_in.get(key)
        if not isinstance(d, dict):
            return None
        try:
            score = int(round(float(d.get("score"))))
        except (TypeError, ValueError):
            return None
        score = max(0, min(100, score, caps.get(key, 100)))
        dims.append({
            "key": key,
            "label": label,
            "score": score,
            "why": _str(d.get("why"), 220),
            "raise": _str(d.get("raise"), 160),
            "capped": key in caps and score == caps[key],
        })
    return {"dimensions": dims, "headline": _str(data.get("headline"), 200)}


@router.post("/ideate/ideas/{idea_id}/score", summary="Score the stored idea with the AI judge")
async def score_idea(idea_id: str, request: Request):
    user = _signed_in(request)
    if not user:
        return JSONResponse({"error": "Sign in to score ideas."}, status_code=401)
    row = _get_row(idea_id)
    if not row or row.get("deleted_at"):
        return JSONResponse({"error": "Save the idea first."}, status_code=404)
    if row.get("created_by") != user:
        return JSONResponse({"error": "Only the owner can score this idea."}, status_code=403)
    idea = row.get("payload") or {}
    if not idea.get("brief"):
        return JSONResponse({"error": "Write the brief first, then get your scorecard."}, status_code=400)

    revision = int(idea.get("revision") or 0)
    if row.get("quality_score") is not None and row.get("quality_revision") == revision:
        return {"score": _points(row, idea), "cached": True}

    now = time.time()
    recent = [t for t in _score_log.get(idea_id, []) if now - t < 86400]
    if len(recent) >= MAX_SCORES_PER_DAY:
        return JSONResponse({"error": "You've re-scored this idea 5 times today. Try again tomorrow."}, status_code=429)

    breakdown = None
    for attempt in range(2):
        result = await call_databricks_serving_endpoint(
            prompt=_judge_context(idea) + ("" if attempt == 0 else "\n\nReturn ONLY the JSON object."),
            system_prompt=JUDGE_PROMPT,
            max_tokens=1500,
            temperature=0.0,
        )
        text = (result.get("response") or "").strip()
        if not text or text.startswith("[Error]") or text.startswith("[Mock Response"):
            return JSONResponse({"error": "The scorecard isn't available right now. Try again in a minute."}, status_code=503)
        breakdown = _parse_judge(text, idea)
        if breakdown:
            break
    if not breakdown:
        return JSONResponse({"error": "The scorecard came back unreadable. Please try again."}, status_code=502)

    _score_log[idea_id] = recent + [now]
    quality = quality_points(breakdown["dimensions"]) or 0
    merged = {**row, "quality_breakdown": breakdown, "quality_score": quality, "quality_revision": revision,
              "scored_at": datetime.utcnow()}
    points = _points(merged, idea)
    _save_quality(idea_id, breakdown, quality, revision, points["total"])
    _leaderboard_cache.clear()
    logger.info(f"[Ideas] Scored {idea_id} for {user}: quality {quality}, total {points['total']}")
    return {"score": points, "cached": False}


# ---------- Insights leaderboard ----------

_leaderboard_cache: Dict[str, Any] = {}


def _status_label(r: Dict[str, Any]) -> str:
    if r.get("mode") == "insights":
        if r.get("build_stage") == "studio":
            return "live"
        return "building" if r.get("locked_at") else "shaping"
    if r.get("catalog_ref"):
        return "approved" if _is_library_approved(r.get("catalog_ref")) else "submitted"
    return r.get("status") or "exploring"


def _parse_ts(v: Any) -> Optional[datetime]:
    if isinstance(v, datetime):
        return v.replace(tzinfo=None)
    try:
        return datetime.fromisoformat(str(v).replace("Z", "+00:00")).replace(tzinfo=None)
    except (TypeError, ValueError):
        return None


def _season_start() -> Optional[datetime]:
    try:
        from src.backend.api.leaderboard_seasons import season_start
        return season_start("insights")
    except Exception:
        return None


def insights_leaderboard_entries(limit: int = 50, mode: str = "", industry: str = "") -> List[Dict[str, Any]]:
    """Ranked rows for the live season; ideas started before the season's start sit out (they are kept)."""
    limit = max(1, min(limit, 100))
    key = f"{limit}|{mode}|{industry}"
    cached = _leaderboard_cache.get(key)
    if cached and time.time() - cached["at"] < LEADERBOARD_CACHE_S:
        return cached["entries"]
    since = _season_start()
    entries = []
    for r in _active_rows():
        if since:
            created = _parse_ts(r.get("idea_created_at"))
            if created and created < since:
                continue
        if mode in ("ideate", "insights") and r.get("mode") != mode:
            continue
        if industry and (r.get("industry") or "").lower() != industry.lower():
            continue
        approved = r.get("approved") or []
        quality = r.get("quality_score")
        breakdown = r.get("quality_breakdown") if isinstance(r.get("quality_breakdown"), dict) else {}
        # journey_points is recomputed on every save, so it is current; outcome depends on library approval.
        idea_stub = {"mode": r.get("mode"), "catalogRef": r.get("catalog_ref"), "lockedAt": r.get("locked_at"),
                     "buildStage": r.get("build_stage")}
        outcome = outcome_points(idea_stub, _is_library_approved(r.get("catalog_ref")))
        journey = int(r.get("journey_points") or 0)
        total = journey + outcome + (quality or 0)
        email = r.get("created_by") or ""
        entries.append({
            "idea_id": r["id"],
            "title": r.get("title") or "Untitled idea",
            "mode": r.get("mode") or "ideate",
            "industry": r.get("industry") or "",
            "user_id": email,
            "display_name": _display_name(email),
            "avatar": _avatar(email),
            "total": total,
            "journey": journey,
            "quality": quality,
            "outcome": outcome,
            "tier": tier_for(total),
            "dimensions": [{"key": d.get("key"), "label": d.get("label"), "score": d.get("score")}
                           for d in breakdown.get("dimensions") or []],
            "approved": approved,
            "step": r.get("step") or "spark",
            "status": _status_label(r),
            "value_per_year": r.get("value_per_year"),
            "session_id": r.get("session_id"),
            "updated_at": _iso(r.get("updated_at")),
            "_reached": _iso(r.get("points_reached_at")) or "",
        })
    entries.sort(key=lambda e: (-e["total"], e["_reached"]))
    entries = entries[:limit]
    for i, e in enumerate(entries, start=1):
        e["rank"] = i
        e.pop("_reached", None)
    _leaderboard_cache[key] = {"at": time.time(), "entries": entries}
    return entries


@router.get("/insights/leaderboard", summary="Ideas ranked by Idea Points, one row per idea")
async def insights_leaderboard(request: Request, limit: int = 50, mode: str = "", industry: str = ""):
    user = _signed_in(request) or ""
    entries = insights_leaderboard_entries(limit, mode, industry)
    return [{**e, "is_mine": bool(user) and e["user_id"] == user} for e in entries]


@router.get("/ideate/ideas-summary", summary="Admin glance: funnel and quality across saved ideas")
async def ideas_summary(request: Request):
    if not _signed_in(request):
        return JSONResponse({"error": "Sign in to view analytics."}, status_code=401)
    rows = _active_rows()
    steps = {m: list(t.keys()) for m, t in IDEA_STEP_SCORES.items()}
    funnel = {m: {s: 0 for s in steps[m]} for m in steps}
    by_mode = {"ideate": 0, "insights": 0}
    scored = []
    for r in rows:
        m = r.get("mode") if r.get("mode") in steps else "ideate"
        by_mode[m] += 1
        for s in r.get("approved") or []:
            if s in funnel[m]:
                funnel[m][s] += 1
        if r.get("quality_score") is not None:
            scored.append(int(r["quality_score"]))
    return {
        "total": len(rows),
        "byMode": by_mode,
        "funnel": funnel,
        "scored": len(scored),
        "avgQuality": round(sum(scored) / len(scored)) if scored else None,
        "qualityMax": QUALITY_MAX,
    }
