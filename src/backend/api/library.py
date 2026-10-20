"""
Use Case Library API: admin curation of collections and use cases.

A collection is an industry (vertical), a business function or a technical
solution (horizontal). usecase_descriptions.industry is a use case's home
collection; usecase_collection_members cross-lists it into others. These
endpoints back the /library admin page; the workshop read path lives in
routes.py (get_industries / get_use_cases_map).
"""

import logging
import re
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field

from src.backend.api.routes import (
    SKILL_USE_CASES,
    _community_collection_row,
    _contrib_rows,
    _get_session_user,
    _invalidate_cache,
    _members_with_contrib,
    _refresh_lakebase_cache,
    ensure_library_schema,
    execute_insert,
    execute_query,
    get_schema,
)
from src.backend.api import routes as _routes
from src.backend.contrib import COMMUNITY_COLLECTION_ID, is_contributed_key
from src.backend.contrib import overrides as contrib_overrides

logger = logging.getLogger(__name__)
router = APIRouter()

CollectionKind = Literal["industry", "function", "solution"]
REVIEW_PENDING = "ideate"


def _slug(text: str, limit: int = 100) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (text or "").lower()).strip("_")[:limit]


def _require_tables(schema: str) -> Dict[str, bool]:
    caps = ensure_library_schema(schema)
    if not caps["tables"]:
        raise HTTPException(
            status_code=503,
            detail="The Use Case Library tables are not set up yet. Run ./scripts/setup-lakebase.sh to apply the latest schema.",
        )
    return caps


def _set_fields(body: BaseModel) -> Dict[str, Any]:
    return body.model_dump(exclude_unset=True)


def _ensure_collection_row(schema: str, collection_id: str, user: str) -> None:
    """Materialize a collection row for a legacy industry that only exists in usecase_descriptions."""
    execute_insert(
        f"""INSERT INTO {schema}.usecase_collections (collection_id, kind, label, updated_by)
            SELECT industry, 'industry', industry_label, %s
            FROM {schema}.usecase_descriptions WHERE industry = %s
            ORDER BY version DESC LIMIT 1
            ON CONFLICT (collection_id) DO NOTHING""",
        (user, collection_id),
    )


# ---------- Read ----------

@router.get("/config/library", summary="Collections, latest use cases and placements for the Library")
async def get_library(response: Response) -> Dict[str, Any]:
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    try:
        from src.backend.api import ideate_ideas as _ideas
        _ideas._review_rows()
    except Exception:
        pass
    schema = get_schema()
    caps = ensure_library_schema(schema)
    source_col = "source" if caps["source"] else "'admin' AS source"
    use_cases = execute_query(f"""
        SELECT DISTINCT ON (industry, use_case)
            industry, industry_label, use_case, use_case_label, prompt_template, version,
            is_active, is_certified, path_type, category, category_order, display_order,
            created_by, {source_col},
            TO_CHAR(inserted_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS updated_at,
            COUNT(*) OVER (PARTITION BY industry, use_case) AS version_count
        FROM {schema}.usecase_descriptions
        WHERE use_case <> '_placeholder'
        ORDER BY industry, use_case, version DESC
    """)
    for uc in use_cases:
        uc["path_type"] = uc.get("path_type") or ("skill" if uc.get("use_case") in SKILL_USE_CASES else "use_case")
        uc["is_certified"] = bool(uc.get("is_certified"))

    collections: List[Dict[str, Any]] = []
    members: List[Dict[str, Any]] = []
    if caps["tables"]:
        collections = execute_query(f"""
            SELECT collection_id, kind, label, description, icon, color, display_order, is_enabled,
                   TO_CHAR(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS updated_at, updated_by
            FROM {schema}.usecase_collections
        """)
        members = execute_query(f"""
            SELECT collection_id, home_industry, use_case, category, category_order, display_order
            FROM {schema}.usecase_collection_members
        """)

    contributed = _library_contributed(use_cases)
    use_cases.extend(contributed["use_cases"])
    members.extend(contributed["members"])

    known = {c["collection_id"] for c in collections}
    for uc in use_cases:
        ind = uc["industry"]
        if ind not in known:
            known.add(ind)
            if ind == COMMUNITY_COLLECTION_ID:
                collections.append({**_community_collection_row(), "updated_at": None, "updated_by": None})
                continue
            collections.append({
                "collection_id": ind, "kind": "industry", "label": uc.get("industry_label") or ind,
                "description": None, "icon": None, "color": None, "display_order": 100,
                "is_enabled": True, "updated_at": None, "updated_by": None,
            })

    return {"collections": collections, "use_cases": use_cases, "members": members, "capabilities": caps}


def _library_contributed(db_use_cases: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
    """Contributed use cases as read-only Library rows, plus their file-declared placements."""
    _refresh_lakebase_cache()
    rows = _contrib_rows(db_use_cases, include_unlisted=True)
    db_members = {
        (m.get("collection_id"), m.get("home_industry"), m.get("use_case"))
        for m in _routes._lakebase_cache.get("collection_members") or []
    }
    use_cases = []
    for r in rows:
        c = r["contribution"]
        use_cases.append({
            "industry": r["industry"], "industry_label": r["industry_label"],
            "use_case": r["use_case"], "use_case_label": r["use_case_label"],
            "prompt_template": r["prompt_template"], "version": 1, "version_count": 1,
            "is_active": r["is_active"], "is_certified": False, "path_type": r["path_type"],
            "category": r.get("category"), "category_order": r.get("category_order"), "display_order": r.get("display_order"),
            "created_by": c["contributor"]["display_name"], "source": "contributed", "updated_at": None,
            "read_only": True, "provenance": r["provenance"], "contribution": c,
        })
    members = [m for m in _members_with_contrib(rows) if m.get("locked") and (m["collection_id"], m["home_industry"], m["use_case"]) not in db_members]
    return {"use_cases": use_cases, "members": members}


_CONTENT_FIELDS = {"is_certified", "use_case_label"}


def _contributed_update(schema: str, use_case: str, fields: Dict[str, Any], user: Optional[str]) -> bool:
    blocked = _CONTENT_FIELDS & set(fields)
    if blocked:
        raise HTTPException(
            status_code=409,
            detail="Contributed use cases are read-only here: their name and certification come from the contrib/ folder. "
                   "You can hide them or move them.",
        )
    return contrib_overrides.upsert(schema, use_case, fields, user)


# ---------- Collections ----------

class CollectionCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=255)
    kind: CollectionKind = "industry"
    collection_id: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class CollectionUpdate(BaseModel):
    label: Optional[str] = Field(default=None, min_length=1, max_length=255)
    kind: Optional[CollectionKind] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_enabled: Optional[bool] = None


class CollectionOrder(BaseModel):
    ids: List[str]


@router.post("/config/collections")
async def create_collection(body: CollectionCreate, request: Request) -> Dict[str, Any]:
    schema = get_schema()
    _require_tables(schema)
    cid = _slug(body.collection_id or body.label)
    if not cid:
        raise HTTPException(status_code=400, detail="Give the collection a name with at least one letter or number.")
    clash = execute_query(
        f"""SELECT 1 FROM {schema}.usecase_collections WHERE collection_id = %s
            UNION ALL SELECT 1 FROM {schema}.usecase_descriptions WHERE industry = %s LIMIT 1""",
        (cid, cid),
    )
    if clash:
        raise HTTPException(status_code=409, detail=f"A collection with the id '{cid}' already exists.")
    order_rows = execute_query(
        f"SELECT COALESCE(MAX(display_order), 0) AS m FROM {schema}.usecase_collections WHERE kind = %s",
        (body.kind,),
    )
    next_order = int((order_rows or [{}])[0].get("m") or 0) + 1
    ok = execute_insert(
        f"""INSERT INTO {schema}.usecase_collections
            (collection_id, kind, label, description, icon, color, display_order, is_enabled, updated_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE, %s)""",
        (cid, body.kind, body.label.strip(), body.description, body.icon, body.color, next_order, _get_session_user(request)),
    )
    if not ok:
        raise HTTPException(status_code=500, detail="Couldn't create the collection.")
    _invalidate_cache()
    return {"collection_id": cid}


@router.patch("/config/collections/{collection_id}")
async def update_collection(collection_id: str, body: CollectionUpdate, request: Request) -> Dict[str, Any]:
    schema = get_schema()
    _require_tables(schema)
    user = _get_session_user(request)
    fields = _set_fields(body)
    if not fields:
        return {"success": True}
    _ensure_collection_row(schema, collection_id, user)
    assignments = ", ".join(f"{k} = %s" for k in fields)
    ok = execute_insert(
        f"""UPDATE {schema}.usecase_collections
            SET {assignments}, updated_at = CURRENT_TIMESTAMP, updated_by = %s
            WHERE collection_id = %s""",
        tuple(fields.values()) + (user, collection_id),
    )
    if not ok:
        raise HTTPException(status_code=500, detail="Couldn't update the collection.")
    if "label" in fields:
        execute_insert(
            f"UPDATE {schema}.usecase_descriptions SET industry_label = %s WHERE industry = %s",
            (fields["label"], collection_id),
        )
    _invalidate_cache()
    return {"success": True}


@router.put("/config/collections/order")
async def reorder_collections(body: CollectionOrder, request: Request) -> Dict[str, Any]:
    schema = get_schema()
    _require_tables(schema)
    user = _get_session_user(request)
    for idx, cid in enumerate(body.ids):
        _ensure_collection_row(schema, cid, user)
        execute_insert(
            f"UPDATE {schema}.usecase_collections SET display_order = %s WHERE collection_id = %s",
            (idx + 1, cid),
        )
    _invalidate_cache()
    return {"success": True}


@router.delete("/config/collections/{collection_id}")
async def delete_collection(collection_id: str) -> Dict[str, Any]:
    schema = get_schema()
    _require_tables(schema)
    execute_insert(
        f"DELETE FROM {schema}.usecase_collection_members WHERE collection_id = %s OR home_industry = %s",
        (collection_id, collection_id),
    )
    execute_insert(f"DELETE FROM {schema}.usecase_descriptions WHERE industry = %s", (collection_id,))
    execute_insert(f"DELETE FROM {schema}.usecase_collections WHERE collection_id = %s", (collection_id,))
    _invalidate_cache()
    return {"success": True}


# ---------- Use cases ----------

class UseCaseKey(BaseModel):
    industry: str
    use_case: str


class UseCaseUpdate(BaseModel):
    is_active: Optional[bool] = None
    is_certified: Optional[bool] = None
    use_case_label: Optional[str] = Field(default=None, min_length=1, max_length=255)
    category: Optional[str] = None
    category_order: Optional[int] = None
    display_order: Optional[int] = None


class BulkUpdate(BaseModel):
    items: List[UseCaseKey]
    is_active: Optional[bool] = None
    is_certified: Optional[bool] = None


class Placement(BaseModel):
    collection_id: str
    category: Optional[str] = None


class PlacementsUpdate(BaseModel):
    placements: List[Placement]


class LayoutItem(BaseModel):
    industry: str
    use_case: str
    category: Optional[str] = None
    category_order: Optional[int] = None
    display_order: Optional[int] = None


class LayoutUpdate(BaseModel):
    items: List[LayoutItem]


class ReviewAction(BaseModel):
    action: Literal["approve", "dismiss"]


def _update_use_case(schema: str, industry: str, use_case: str, fields: Dict[str, Any]) -> bool:
    """Apply flag/label/placement fields to every version so they stay stable across edits."""
    if not fields:
        return True
    assignments = ", ".join(f"{k} = %s" for k in fields)
    return execute_insert(
        f"""UPDATE {schema}.usecase_descriptions
            SET {assignments}, updated_at = CURRENT_TIMESTAMP
            WHERE industry = %s AND use_case = %s""",
        tuple(fields.values()) + (industry, use_case),
    )


@router.patch("/config/use-cases/bulk")
async def bulk_update_use_cases(body: BulkUpdate, request: Request) -> Dict[str, Any]:
    schema = get_schema()
    user = _get_session_user(request)
    fields = {k: v for k, v in _set_fields(body).items() if k in ("is_active", "is_certified")}
    contrib_fields = {k: v for k, v in fields.items() if k == "is_active"}
    failed, skipped, updated = [], [], 0
    for i in body.items:
        if is_contributed_key(i.use_case):
            if not contrib_fields:
                skipped.append(i.use_case)
                continue
            ok = contrib_overrides.upsert(schema, i.use_case, contrib_fields, user)
        else:
            ok = _update_use_case(schema, i.industry, i.use_case, fields)
        if ok:
            updated += 1
        else:
            failed.append(f"{i.industry}/{i.use_case}")
    _invalidate_cache()
    if failed:
        raise HTTPException(status_code=500, detail=f"Couldn't update {len(failed)} use case(s).")
    return {"success": True, "updated": updated, "skipped": skipped}


@router.patch("/config/use-cases/{industry}/{use_case}")
async def update_use_case(industry: str, use_case: str, body: UseCaseUpdate, request: Request) -> Dict[str, Any]:
    schema = get_schema()
    fields = _set_fields(body)
    if is_contributed_key(use_case):
        ok = _contributed_update(schema, use_case, fields, _get_session_user(request))
    else:
        ok = _update_use_case(schema, industry, use_case, fields)
    if not ok:
        raise HTTPException(status_code=500, detail="Couldn't update the use case.")
    _invalidate_cache()
    return {"success": True}


def _category_slot(schema: str, collection_id: str, category: Optional[str]) -> Dict[str, Optional[int]]:
    """Column and next card position for a category within a collection (home rows and cross-listings)."""
    if not category:
        return {"category_order": None, "display_order": None}
    rows = execute_query(
        f"""SELECT category, MAX(category_order) AS co, MAX(display_order) AS dmax FROM (
                SELECT category, category_order, display_order FROM {schema}.usecase_descriptions
                WHERE industry = %s AND category IS NOT NULL
                UNION ALL
                SELECT category, category_order, display_order FROM {schema}.usecase_collection_members
                WHERE collection_id = %s AND category IS NOT NULL
            ) t GROUP BY category""",
        (collection_id, collection_id),
    ) or []
    for r in rows:
        if (r.get("category") or "").lower() == category.lower():
            return {"category_order": r.get("co"), "display_order": int(r.get("dmax") or 0) + 1}
    return {"category_order": max([int(r.get("co") or 0) for r in rows] or [0]) + 1, "display_order": 1}


@router.put("/config/use-cases/{industry}/{use_case}/placements")
async def set_placements(industry: str, use_case: str, body: PlacementsUpdate, request: Request) -> Dict[str, Any]:
    schema = get_schema()
    _require_tables(schema)
    user = _get_session_user(request)
    wanted = {p.collection_id: p for p in body.placements if p.collection_id != industry}
    current = {
        r["collection_id"]: r
        for r in execute_query(
            f"""SELECT collection_id, category FROM {schema}.usecase_collection_members
                WHERE home_industry = %s AND use_case = %s""",
            (industry, use_case),
        )
    }
    for cid in set(current) - set(wanted):
        execute_insert(
            f"""DELETE FROM {schema}.usecase_collection_members
                WHERE collection_id = %s AND home_industry = %s AND use_case = %s""",
            (cid, industry, use_case),
        )
    for cid, p in wanted.items():
        if cid in current and (current[cid].get("category") or None) == (p.category or None):
            continue
        slot = _category_slot(schema, cid, p.category)
        execute_insert(
            f"""INSERT INTO {schema}.usecase_collection_members
                (collection_id, home_industry, use_case, category, category_order, display_order, added_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (collection_id, home_industry, use_case) DO UPDATE
                SET category = EXCLUDED.category, category_order = EXCLUDED.category_order,
                    display_order = EXCLUDED.display_order""",
            (cid, industry, use_case, p.category, slot["category_order"], slot["display_order"], user),
        )
    _invalidate_cache()
    return {"success": True}


@router.put("/config/collections/{collection_id}/layout")
async def set_layout(collection_id: str, body: LayoutUpdate) -> Dict[str, Any]:
    """Persist card order and category moves from the Library board."""
    schema = get_schema()
    for item in body.items:
        fields = {"category": item.category, "category_order": item.category_order, "display_order": item.display_order}
        if item.industry == collection_id and is_contributed_key(item.use_case):
            contrib_overrides.upsert(schema, item.use_case, fields, None)
        elif item.industry == collection_id:
            _update_use_case(schema, item.industry, item.use_case, fields)
        elif is_contributed_key(item.use_case):
            execute_insert(
                f"""INSERT INTO {schema}.usecase_collection_members
                    (collection_id, home_industry, use_case, category, category_order, display_order, added_by)
                    VALUES (%s, %s, %s, %s, %s, %s, 'library')
                    ON CONFLICT (collection_id, home_industry, use_case) DO UPDATE
                    SET category = EXCLUDED.category, category_order = EXCLUDED.category_order,
                        display_order = EXCLUDED.display_order""",
                (collection_id, item.industry, item.use_case, item.category, item.category_order, item.display_order),
            )
        else:
            execute_insert(
                f"""UPDATE {schema}.usecase_collection_members
                    SET category = %s, category_order = %s, display_order = %s
                    WHERE collection_id = %s AND home_industry = %s AND use_case = %s""",
                (item.category, item.category_order, item.display_order, collection_id, item.industry, item.use_case),
            )
    _invalidate_cache()
    return {"success": True}


@router.post("/config/use-cases/{industry}/{use_case}/review")
async def review_use_case(industry: str, use_case: str, body: ReviewAction) -> Dict[str, Any]:
    if is_contributed_key(use_case):
        raise HTTPException(status_code=409, detail="Contributed use cases are reviewed in their pull request.")
    schema = get_schema()
    caps = ensure_library_schema(schema)
    fields: Dict[str, Any] = {"is_active": True} if body.action == "approve" else {}
    if caps["source"]:
        fields["source"] = "ideate_approved" if body.action == "approve" else "ideate_dismissed"
    if not fields:
        raise HTTPException(status_code=503, detail="Dismissing needs the latest schema. Run ./scripts/setup-lakebase.sh.")
    if not _update_use_case(schema, industry, use_case, fields):
        raise HTTPException(status_code=500, detail="Couldn't update the submission.")
    _invalidate_cache()
    return {"success": True}
