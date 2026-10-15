"""
Value profiles for catalog use cases: what a use case is typically worth and
where the money comes from, so ideas started from it begin with sensible
numbers instead of a blank Impact step.

A profile is written when an Ideate idea is submitted with its business case,
or derived once from the use case description by the model. It lives in its
own table because the app principal cannot alter usecase_descriptions; the
table is created at runtime (mirrors db/lakebase/ddl/13_usecase_value_profiles.sql).
Without Lakebase, profiles are kept in memory for the life of the process.
"""

import asyncio
import json
import logging
import re
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

DRIVERS = {"time_saved", "cost_avoided", "revenue_uplift"}
HARD_SHARES = {"mostly hard", "mixed", "mostly soft"}
LLM_TIMEOUT_S = 20
MAX_VALUE = 1_000_000_000

_DDL = """CREATE TABLE IF NOT EXISTS {schema}.usecase_value_profiles (
    industry VARCHAR(100) NOT NULL,
    use_case VARCHAR(100) NOT NULL,
    profile JSONB NOT NULL,
    source VARCHAR(20) NOT NULL DEFAULT 'derived',
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (industry, use_case)
)"""

_memory: Dict[str, Dict[str, Any]] = {}
_table_ready: Optional[bool] = None

DERIVE_PROMPT = """You are a value engineer. Given a use case description, estimate what it is typically worth to a mid-size company in its industry at full rollout, and where the money comes from.

Rules:
- "driver" is the largest lever: "cost_avoided" (fewer costly events), "revenue_uplift" (more conversion, retention, yield), or "time_saved" (staff time freed).
- "driver_label" says where the value comes from in the industry's words, under 10 words.
- "value_pool" is one short phrase on where the money is, e.g. "Delay costs, often millions a year per hub".
- "typical_low" and "typical_high" are annual dollars at full rollout, conservative and realistic.
- "rollout_unit" is what it scales by (stores, plants, hubs, branches, regions, teams); "rollout_full" is a typical count.
- "hard_share" is "mostly hard", "mixed", or "mostly soft".
- Never name a study, firm, or source.
Return ONLY a JSON object:
{"driver": "cost_avoided", "driver_label": "...", "value_pool": "...", "typical_low": 500000, "typical_high": 2000000, "rollout_unit": "stores", "rollout_full": 50, "hard_share": "mostly hard"}"""


def _num(v: Any) -> Optional[float]:
    try:
        n = float(str(v).replace(",", "").replace("$", ""))
    except (TypeError, ValueError):
        return None
    return n if n == n and abs(n) != float("inf") else None


def normalize_profile(raw: Any) -> Optional[Dict[str, Any]]:
    """Accepts snake_case (model) or camelCase (browser); returns camelCase, or None when unusable."""
    if not isinstance(raw, dict):
        return None
    g = lambda *keys: next((raw[k] for k in keys if raw.get(k) not in (None, "")), None)  # noqa: E731
    driver = str(g("driver") or "").strip()
    low, high = _num(g("typical_low", "typicalLow")), _num(g("typical_high", "typicalHigh"))
    if driver not in DRIVERS or low is None or high is None or high <= 0:
        return None
    low, high = max(0.0, min(low, high)), min(MAX_VALUE, max(low, high))
    share = str(g("hard_share", "hardShare") or "").strip().lower()
    full = _num(g("rollout_full", "rolloutFull"))
    return {
        "driver": driver,
        "driverLabel": str(g("driver_label", "driverLabel") or "").strip()[:80],
        "valuePool": str(g("value_pool", "valuePool") or "").strip()[:140],
        "typicalLow": round(low),
        "typicalHigh": round(high),
        "rolloutUnit": str(g("rollout_unit", "rolloutUnit") or "").strip()[:30],
        "rolloutFull": int(min(10000, max(1, full))) if full else None,
        "hardShare": share if share in HARD_SHARES else None,
    }


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
        except Exception as e:
            logger.warning(f"[ValueProfiles] could not create table: {e}")
            _table_ready = False
        if not _table_ready:
            logger.warning("[ValueProfiles] table unavailable; run setup-lakebase.sh to apply 13_usecase_value_profiles.sql")
    return schema if _table_ready else None


def get_profile(industry: str, use_case: str) -> Optional[Dict[str, Any]]:
    key = f"{industry}/{use_case}"
    schema = _ensure_table()
    if not schema:
        return _memory.get(key)
    try:
        _, execute_query, _, _ = _db()
        rows = execute_query(
            f"SELECT profile, source FROM {schema}.usecase_value_profiles WHERE industry = %s AND use_case = %s",
            (industry, use_case),
        ) or []
    except Exception as e:
        logger.info(f"[ValueProfiles] read failed: {e}")
        return _memory.get(key)
    if not rows:
        return None
    profile = rows[0].get("profile")
    if isinstance(profile, str):
        try:
            profile = json.loads(profile)
        except ValueError:
            return None
    out = normalize_profile(profile)
    if out:
        out["source"] = rows[0].get("source") or "derived"
    return out


def put_profile(industry: str, use_case: str, profile: Dict[str, Any], source: str) -> bool:
    """Saves a normalized profile. A submitted profile always wins over a derived one."""
    clean = normalize_profile(profile)
    if not clean:
        return False
    key = f"{industry}/{use_case}"
    schema = _ensure_table()
    if not schema:
        if source == "submitted" or _memory.get(key, {}).get("source") != "submitted":
            _memory[key] = {**clean, "source": source}
        return True
    try:
        execute_insert, _, _, _ = _db()
        return bool(execute_insert(
            f"""INSERT INTO {schema}.usecase_value_profiles (industry, use_case, profile, source, updated_at)
                VALUES (%s, %s, %s::jsonb, %s, CURRENT_TIMESTAMP)
                ON CONFLICT (industry, use_case) DO UPDATE
                SET profile = EXCLUDED.profile, source = EXCLUDED.source, updated_at = CURRENT_TIMESTAMP
                WHERE {schema}.usecase_value_profiles.source <> 'submitted' OR EXCLUDED.source = 'submitted'""",
            (industry, use_case, json.dumps(clean), source),
        ))
    except Exception as e:
        logger.info(f"[ValueProfiles] write failed: {e}")
        return False


async def derive_profile(template: str) -> Optional[Dict[str, Any]]:
    try:
        from src.backend.api.routes import call_databricks_serving_endpoint
        result = await asyncio.wait_for(
            call_databricks_serving_endpoint(
                prompt=f"USE CASE:\n{template[:6000]}",
                system_prompt=DERIVE_PROMPT,
                max_tokens=400,
                temperature=0.3,
            ),
            timeout=LLM_TIMEOUT_S,
        )
    except Exception as e:
        logger.info(f"[ValueProfiles] derive unavailable: {e}")
        return None
    m = re.search(r"\{.*\}", (result.get("response") or ""), re.S)
    if not m:
        return None
    try:
        return normalize_profile(json.loads(m.group(0), strict=False))
    except ValueError:
        return None


async def profile_for(industry: str, use_case: str, template: str) -> Optional[Dict[str, Any]]:
    """Stored profile, or one derived now and stored for next time."""
    found = await asyncio.to_thread(get_profile, industry, use_case)
    if found:
        return found
    derived = await derive_profile(template)
    if derived:
        await asyncio.to_thread(put_profile, industry, use_case, derived, "derived")
        return {**derived, "source": "derived"}
    return None
