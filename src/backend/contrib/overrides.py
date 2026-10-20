"""Per-install admin choices for contributed use cases (Live toggle and layout).

Content always comes from the files; this table only records what an admin of
this install chose to hide or move. NULL columns mean "use the file's value".
Mirrors db/lakebase/ddl/19_contributed_usecase_overrides.sql; the app creates
the table at runtime when it's missing, like value_profiles.py does.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

OVERRIDE_FIELDS = ("is_active", "category", "category_order", "display_order")

_DDL = """CREATE TABLE IF NOT EXISTS {schema}.contributed_usecase_overrides (
    use_case_key VARCHAR(100) PRIMARY KEY,
    is_active BOOLEAN,
    category VARCHAR(100),
    category_order INTEGER,
    display_order INTEGER,
    updated_by VARCHAR(255),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
)"""

_ensured: Dict[str, bool] = {}


def _db():
    from src.backend.api import routes

    return routes


def ensure_table(schema: str) -> bool:
    if _ensured.get(schema):
        return True
    db = _db()
    if not (db.LAKEBASE_SERVICE_AVAILABLE and db.is_lakebase_configured()) or not schema:
        return False
    try:
        ok = bool(db.execute_insert(_DDL.format(schema=schema)))
    except Exception as e:
        logger.warning(f"[Contrib] Couldn't create contributed_usecase_overrides: {e}")
        ok = False
    _ensured[schema] = ok
    return ok


def load_all(schema: str) -> Dict[str, Dict[str, Any]]:
    if not ensure_table(schema):
        return {}
    try:
        rows = _db().execute_query(
            f"""SELECT use_case_key, is_active, category, category_order, display_order
                FROM {schema}.contributed_usecase_overrides"""
        )
    except Exception as e:
        logger.warning(f"[Contrib] Couldn't read overrides: {e}")
        return {}
    return {r["use_case_key"]: r for r in rows or []}


def upsert(schema: str, key: str, fields: Dict[str, Any], user: Optional[str]) -> bool:
    fields = {k: v for k, v in fields.items() if k in OVERRIDE_FIELDS}
    if not fields:
        return True
    if not ensure_table(schema):
        return False
    cols = ", ".join(fields)
    placeholders = ", ".join(["%s"] * len(fields))
    updates = ", ".join(f"{k} = EXCLUDED.{k}" for k in fields)
    return bool(_db().execute_insert(
        f"""INSERT INTO {schema}.contributed_usecase_overrides
                (use_case_key, {cols}, updated_by, updated_at)
            VALUES (%s, {placeholders}, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (use_case_key) DO UPDATE
            SET {updates}, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP""",
        (key, *fields.values(), user),
    ))
