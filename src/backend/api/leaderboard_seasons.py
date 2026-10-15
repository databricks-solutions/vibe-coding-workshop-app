"""
Leaderboard seasons: snapshot, archive and reset, and restore, for both boards.

Nothing here deletes ideas or sessions. A season is a start date: the live
board only counts work started on or after it. Archiving freezes the board as
it stood into a stored snapshot, and restoring reopens an archived season from
its start date (the current season is archived first, so a restore can't lose
anything either).

- technical: the workshop leaderboard (sessions, best session per person)
- insights: Ideate and Insights ideas (one row per idea)

The table is created at runtime (mirrors db/lakebase/ddl/15_leaderboard_seasons.sql).
Without Lakebase, seasons are kept in memory for the life of the process.
"""

import json
import logging
import os
import threading
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

try:
    from src.backend.api.hackathon import _resolve_user
except Exception:  # pragma: no cover
    from src.backend.api.routes import _get_session_user as _resolve_user  # type: ignore

BOARDS = ("technical", "insights")
SNAPSHOT_LIMIT = 100

_DDL = """CREATE TABLE IF NOT EXISTS {schema}.leaderboard_seasons (
    id VARCHAR(40) PRIMARY KEY,
    board VARCHAR(20) NOT NULL,
    kind VARCHAR(20) NOT NULL DEFAULT 'season',
    name VARCHAR(120) NOT NULL DEFAULT '',
    started_at TIMESTAMP WITHOUT TIME ZONE,
    ended_at TIMESTAMP WITHOUT TIME ZONE,
    entries JSONB,
    entry_count INTEGER NOT NULL DEFAULT 0,
    created_by VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
)"""

_memory: Dict[str, Dict[str, Any]] = {}
_memory_lock = threading.Lock()
_table_ready: Optional[bool] = None


# ============== Storage ==============

def _db():
    from src.backend.api.routes import execute_insert, execute_query, get_schema, is_lakebase_configured
    return execute_insert, execute_query, get_schema, is_lakebase_configured


def _ensure_table() -> Optional[str]:
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
        except Exception as e:
            logger.warning(f"[Seasons] could not create table: {e}")
            _table_ready = False
    return schema if _table_ready else None


def _iso(v: Any) -> Optional[str]:
    if v is None:
        return None
    return v.isoformat() if hasattr(v, "isoformat") else str(v)


def _out(r: Dict[str, Any], with_entries: bool = False) -> Dict[str, Any]:
    out = {
        "id": r["id"],
        "board": r["board"],
        "kind": r.get("kind") or "season",
        "name": r.get("name") or "",
        "startedAt": _iso(r.get("started_at")),
        "endedAt": _iso(r.get("ended_at")),
        "entryCount": int(r.get("entry_count") or 0),
        "createdBy": r.get("created_by") or "",
        "createdAt": _iso(r.get("created_at")),
    }
    if with_entries:
        entries = r.get("entries")
        out["entries"] = json.loads(entries) if isinstance(entries, str) else (entries or [])
    return out


def _rows(board: str) -> List[Dict[str, Any]]:
    schema = _ensure_table()
    if not schema:
        with _memory_lock:
            rows = [dict(r) for r in _memory.values() if r["board"] == board]
        return sorted(rows, key=lambda r: r["created_at"], reverse=True)
    _, execute_query, _, _ = _db()
    return execute_query(
        f"SELECT id, board, kind, name, started_at, ended_at, entry_count, created_by, created_at "
        f"FROM {schema}.leaderboard_seasons WHERE board = %s ORDER BY created_at DESC",
        (board,),
    ) or []


def _get(season_id: str) -> Optional[Dict[str, Any]]:
    schema = _ensure_table()
    if not schema:
        with _memory_lock:
            r = _memory.get(season_id)
            return dict(r) if r else None
    _, execute_query, _, _ = _db()
    rows = execute_query(f"SELECT * FROM {schema}.leaderboard_seasons WHERE id = %s", (season_id,)) or []
    return rows[0] if rows else None


def _insert(row: Dict[str, Any]) -> bool:
    schema = _ensure_table()
    if not schema:
        with _memory_lock:
            _memory[row["id"]] = dict(row)
        return True
    execute_insert, _, _, _ = _db()
    return bool(execute_insert(
        f"INSERT INTO {schema}.leaderboard_seasons (id, board, kind, name, started_at, ended_at, entries, entry_count, created_by, created_at) "
        f"VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s)",
        (row["id"], row["board"], row["kind"], row["name"], row["started_at"], row["ended_at"],
         json.dumps(row["entries"]) if row.get("entries") is not None else None,
         row["entry_count"], row["created_by"], row["created_at"]),
    ))


def _close(season_id: str, ended_at: datetime, entries: List[Dict[str, Any]]) -> bool:
    schema = _ensure_table()
    if not schema:
        with _memory_lock:
            if season_id in _memory:
                _memory[season_id].update(ended_at=ended_at, entries=entries, entry_count=len(entries))
        return True
    execute_insert, _, _, _ = _db()
    return bool(execute_insert(
        f"UPDATE {schema}.leaderboard_seasons SET ended_at = %s, entries = %s::jsonb, entry_count = %s WHERE id = %s",
        (ended_at, json.dumps(entries), len(entries), season_id),
    ))


def current_season(board: str) -> Optional[Dict[str, Any]]:
    """The open season for a board, or None when the board has never been reset (all time)."""
    for r in _rows(board):
        if (r.get("kind") or "season") == "season" and not r.get("ended_at"):
            return r
    return None


def season_start(board: str) -> Optional[datetime]:
    """Start of the live season (naive UTC), or None for all time. Never raises."""
    try:
        cur = current_season(board)
    except Exception as e:
        logger.warning(f"[Seasons] lookup failed for {board}: {e}")
        return None
    start = cur.get("started_at") if cur else None
    if isinstance(start, str):
        try:
            start = datetime.fromisoformat(start)
        except ValueError:
            return None
    return start


# ============== Live boards ==============

def _clear_caches() -> None:
    try:
        from src.backend.api import routes
        routes._leaderboard_cache.update(data=None, timestamp=0)
    except Exception:
        pass
    try:
        from src.backend.api import ideate_ideas
        ideate_ideas._leaderboard_cache.clear()
    except Exception:
        pass


def _live_entries(board: str, request: Request) -> List[Dict[str, Any]]:
    _clear_caches()
    if board == "technical":
        from src.backend.services.lakebase import get_leaderboard
        return get_leaderboard(limit=SNAPSHOT_LIMIT, since=season_start("technical"))
    from src.backend.api.ideate_ideas import insights_leaderboard_entries
    return insights_leaderboard_entries(limit=SNAPSHOT_LIMIT)


def _snapshot_entries(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Frozen rows: no viewer-specific flags."""
    return [{k: v for k, v in e.items() if k != "is_mine"} for e in entries]


# ============== Admin guard ==============

def _admins() -> List[str]:
    raw = os.environ.get("APP_ADMINS") or os.environ.get("LEADERBOARD_ADMINS") or ""
    return [e.strip().lower() for e in raw.split(",") if e.strip()]


def _admin(request: Request) -> Optional[str]:
    """Caller email when they may manage leaderboards. With APP_ADMINS unset, any signed-in user may."""
    user = _resolve_user(request)
    if not user or user == "unknown":
        return None
    admins = _admins()
    return user if not admins or user.lower() in admins else None


def _forbidden(request: Request) -> JSONResponse:
    user = _resolve_user(request)
    if not user or user == "unknown":
        return JSONResponse({"error": "Sign in to manage leaderboards."}, status_code=401)
    return JSONResponse({"error": "Only app admins can manage leaderboards."}, status_code=403)


def _boards(board: str) -> List[str]:
    return list(BOARDS) if board == "all" else [board] if board in BOARDS else []


def _default_name(prefix: str) -> str:
    return f"{prefix} {datetime.utcnow().strftime('%b %d, %Y')}"


def _archive_current(board: str, user: str, request: Request, now: datetime) -> Dict[str, Any]:
    """Freezes the live board into the current season (creating an all-time one if needed) and closes it."""
    entries = _snapshot_entries(_live_entries(board, request))
    cur = current_season(board)
    if cur:
        _close(cur["id"], now, entries)
        cur = {**cur, "ended_at": now, "entry_count": len(entries)}
        return _out(cur)
    row = {
        "id": uuid.uuid4().hex, "board": board, "kind": "season", "name": "Before the first reset",
        "started_at": None, "ended_at": now, "entries": entries, "entry_count": len(entries),
        "created_by": user, "created_at": now,
    }
    _insert(row)
    return _out(row)


def _open_season(board: str, name: str, started_at: Optional[datetime], user: str, now: datetime) -> Dict[str, Any]:
    row = {
        "id": uuid.uuid4().hex, "board": board, "kind": "season", "name": name[:120],
        "started_at": started_at, "ended_at": None, "entries": None, "entry_count": 0,
        "created_by": user, "created_at": now,
    }
    _insert(row)
    return _out(row)


# ============== Endpoints ==============

class NameRequest(BaseModel):
    name: Optional[str] = None


@router.get("/leaderboards/{board}/seasons", summary="A board's current season and its archive")
async def list_seasons(board: str, request: Request):
    if board not in BOARDS:
        return JSONResponse({"error": "Unknown board."}, status_code=404)
    rows = _rows(board)
    cur = next((r for r in rows if (r.get("kind") or "season") == "season" and not r.get("ended_at")), None)
    return {
        "board": board,
        "current": _out(cur) if cur else None,
        "archive": [_out(r) for r in rows if r is not cur],
        "canManage": bool(_admin(request)),
    }


@router.get("/leaderboards/seasons/{season_id}", summary="A frozen snapshot, read only")
async def get_season(season_id: str):
    row = _get(season_id)
    if not row:
        return JSONResponse({"error": "That archive isn't available."}, status_code=404)
    return _out(row, with_entries=True)


@router.post("/admin/leaderboards/{board}/snapshot", summary="Save a frozen copy of the board without resetting it")
async def snapshot(board: str, body: NameRequest, request: Request):
    user = _admin(request)
    if not user:
        return _forbidden(request)
    boards = _boards(board)
    if not boards:
        return JSONResponse({"error": "Unknown board."}, status_code=404)
    now = datetime.utcnow()
    out = []
    for b in boards:
        entries = _snapshot_entries(_live_entries(b, request))
        row = {
            "id": uuid.uuid4().hex, "board": b, "kind": "snapshot", "name": (body.name or _default_name("Snapshot"))[:120],
            "started_at": season_start(b), "ended_at": now, "entries": entries, "entry_count": len(entries),
            "created_by": user, "created_at": now,
        }
        if not _insert(row):
            return JSONResponse({"error": "Couldn't save the snapshot."}, status_code=500)
        out.append(_out(row))
    logger.info(f"[Seasons] {user} saved a snapshot of {board}")
    return {"saved": out}


@router.post("/admin/leaderboards/{board}/reset", summary="Archive the board and start a new season")
async def reset(board: str, body: NameRequest, request: Request):
    user = _admin(request)
    if not user:
        return _forbidden(request)
    boards = _boards(board)
    if not boards:
        return JSONResponse({"error": "Unknown board."}, status_code=404)
    now = datetime.utcnow()
    out = []
    for b in boards:
        archived = _archive_current(b, user, request, now)
        current = _open_season(b, body.name or _default_name("Season from"), now, user, now)
        out.append({"archived": archived, "current": current})
    _clear_caches()
    logger.info(f"[Seasons] {user} reset {board}")
    return {"reset": out}


@router.post("/admin/leaderboards/seasons/{season_id}/restore", summary="Reopen an archived season")
async def restore(season_id: str, request: Request):
    user = _admin(request)
    if not user:
        return _forbidden(request)
    target = _get(season_id)
    if not target or (target.get("kind") or "season") != "season" or not target.get("ended_at"):
        return JSONResponse({"error": "Only archived seasons can be restored."}, status_code=400)
    board = target["board"]
    now = datetime.utcnow()
    archived = _archive_current(board, user, request, now)
    current = _open_season(board, f"{target.get('name') or 'Season'} (restored)", target.get("started_at"), user, now)
    _clear_caches()
    logger.info(f"[Seasons] {user} restored {season_id} on {board}")
    return {"archived": archived, "current": current}
