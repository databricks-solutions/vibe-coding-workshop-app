"""Caches for the Insights flow.

Each kind of result lives in its own namespace with its own size and age
limits, so a few large digests can't push out many small match results.
Keys are content fingerprints (a schema's table list, a use case's text), so
an entry is reused until the thing it describes changes.

`get_or_build` runs one build per key at a time: concurrent requests for the
same key wait for that build instead of repeating it. Namespaces marked
`persist` also keep entries in Lakebase, so restarts and other replicas reuse
them; that tier is best effort and is switched off for the process after a
failure.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import threading
import time
from collections import OrderedDict
from typing import Any, Awaitable, Callable, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

TABLE = "insights_cache"


def fingerprint(*parts: Any) -> str:
    raw = json.dumps(parts, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


def _size(value: Any) -> int:
    try:
        return len(json.dumps(value, separators=(",", ":"), default=str))
    except (TypeError, ValueError):
        return 1024


class Namespace:
    def __init__(self, name: str, max_bytes: int, ttl_s: float, persist: bool = False):
        self.name, self.max_bytes, self.ttl_s, self.persist = name, max_bytes, ttl_s, persist
        self._items: "OrderedDict[str, Tuple[float, int, Any]]" = OrderedDict()
        self._bytes = 0
        self._lock = threading.Lock()
        self._inflight: Dict[str, asyncio.Future] = {}
        self.stats = {"hits": 0, "misses": 0, "persistHits": 0, "builds": 0, "joined": 0, "evictions": 0}

    def get(self, key: str, ttl_s: Optional[float] = None) -> Any:
        ttl = self.ttl_s if ttl_s is None else ttl_s
        with self._lock:
            hit = self._items.get(key)
            if hit and time.time() - hit[0] < ttl:
                self._items.move_to_end(key)
                self.stats["hits"] += 1
                return hit[2]
            if hit:
                self._drop(key)
            self.stats["misses"] += 1
            return None

    def put(self, key: str, value: Any, size: Optional[int] = None) -> Any:
        """`size` is the value's rough footprint in bytes, for values that are not JSON."""
        size = _size(value) if size is None else size
        if size > self.max_bytes:
            return value
        with self._lock:
            if key in self._items:
                self._drop(key)
            self._items[key] = (time.time(), size, value)
            self._bytes += size
            while self._bytes > self.max_bytes and self._items:
                self._drop(next(iter(self._items)))
                self.stats["evictions"] += 1
        return value

    def _drop(self, key: str) -> None:
        _, size, _ = self._items.pop(key)
        self._bytes -= size

    def snapshot(self) -> Dict[str, Any]:
        with self._lock:
            return {**self.stats, "entries": len(self._items), "bytes": self._bytes, "maxBytes": self.max_bytes}

    async def lookup(self, key: str) -> Any:
        """The cached value from memory or the persistent tier, without building it."""
        hit = self.get(key)
        if hit is not None:
            return hit
        if self.persist:
            stored = await asyncio.to_thread(_db_get, self.name, key, self.ttl_s)
            if stored is not None:
                self.stats["persistHits"] += 1
                return self.put(key, stored)
        return None

    async def get_or_build(self, key: str, build: Callable[[], Awaitable[Tuple[Any, bool]]]) -> Any:
        """`build` returns (value, keep); a value with keep=False is returned but not cached."""
        hit = await self.lookup(key)
        if hit is not None:
            return hit
        running = self._inflight.get(key)
        if running is not None:
            self.stats["joined"] += 1
            return await asyncio.shield(running)
        fut: asyncio.Future = asyncio.get_running_loop().create_future()
        self._inflight[key] = fut
        try:
            self.stats["builds"] += 1
            value, keep = await build()
            if keep:
                self.put(key, value)
                if self.persist:
                    asyncio.get_running_loop().run_in_executor(None, _db_put, self.name, key, value)
            fut.set_result(value)
            return value
        except BaseException as e:
            fut.set_exception(e)
            fut.exception()
            raise
        finally:
            self._inflight.pop(key, None)


_SPACES: Dict[str, Namespace] = {}


def namespace(name: str, max_mb: float, ttl_s: float, persist: bool = False) -> Namespace:
    if name not in _SPACES:
        _SPACES[name] = Namespace(name, int(max_mb * 1024 * 1024), ttl_s, persist)
    return _SPACES[name]


def stats() -> Dict[str, Any]:
    return {"persistent": _DB["state"], "namespaces": {n: s.snapshot() for n, s in _SPACES.items()}}


# --------------------------------------------------------------------------------------
# Lakebase tier
# --------------------------------------------------------------------------------------

_DB = {"state": "unknown"}
_DB_LOCK = threading.Lock()


def _db_ready() -> bool:
    if _DB["state"] in ("on", "off"):
        return _DB["state"] == "on"
    with _DB_LOCK:
        if _DB["state"] != "unknown":
            return _DB["state"] == "on"
        try:
            from src.backend.services.lakebase import execute_insert, get_schema, is_lakebase_configured
            if not is_lakebase_configured():
                _DB["state"] = "off"
                return False
            schema = get_schema()
            ok = execute_insert(
                f"CREATE TABLE IF NOT EXISTS {schema}.{TABLE} ("
                " namespace VARCHAR(32) NOT NULL, cache_key VARCHAR(64) NOT NULL, value JSONB NOT NULL,"
                " created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,"
                " PRIMARY KEY (namespace, cache_key))"
            )
            _DB["state"] = "on" if ok else "off"
        except Exception as e:
            logger.warning(f"[InsightsCache] persistent tier off: {e}")
            _DB["state"] = "off"
    return _DB["state"] == "on"


def _db_get(name: str, key: str, ttl_s: float) -> Any:
    if not _db_ready():
        return None
    try:
        from src.backend.services.lakebase import execute_query, get_schema
        rows = execute_query(
            f"SELECT value FROM {get_schema()}.{TABLE} WHERE namespace = %s AND cache_key = %s"
            " AND created_at > CURRENT_TIMESTAMP - make_interval(secs => %s)",
            (name, key, float(ttl_s)),
        )
        if not rows:
            return None
        value = rows[0]["value"]
        return json.loads(value) if isinstance(value, str) else value
    except Exception as e:
        logger.warning(f"[InsightsCache] read failed, persistent tier off: {e}")
        _DB["state"] = "off"
        return None


def _db_put(name: str, key: str, value: Any) -> None:
    if not _db_ready():
        return
    try:
        from src.backend.services.lakebase import execute_insert, get_schema
        execute_insert(
            f"INSERT INTO {get_schema()}.{TABLE} (namespace, cache_key, value) VALUES (%s, %s, %s::jsonb)"
            " ON CONFLICT (namespace, cache_key) DO UPDATE SET value = EXCLUDED.value, created_at = CURRENT_TIMESTAMP",
            (name, key, json.dumps(value, separators=(",", ":"), default=str)),
        )
    except Exception as e:
        logger.warning(f"[InsightsCache] write failed, persistent tier off: {e}")
        _DB["state"] = "off"
