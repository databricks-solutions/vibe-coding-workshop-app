"""
Databricks SQL (DBSQL) backend for Vibe Coding Workshop.

Connects to Delta tables via a Databricks SQL warehouse using ``databricks-sql-connector``
and ``databricks.sdk`` for authentication. Mirrors the public API of ``lakebase.py``.

Environment variables:
  LAKEHOUSE_CATALOG or DBSQL_CATALOG — Unity Catalog name
  LAKEHOUSE_SCHEMA or DBSQL_SCHEMA — schema name
  DATABRICKS_SQL_WAREHOUSE_HTTP_PATH — SQL warehouse HTTP path
  DATABRICKS_HOST or WORKSPACE_URL — workspace hostname (https:// stripped)
"""
from __future__ import annotations

import json
import logging
import os
import re
import sys
from contextlib import contextmanager
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("dbsql_backend")
logger.setLevel(logging.INFO)

PSYCOPG2_AVAILABLE = False

# ---------------------------------------------------------------------------
# Optional: databricks-sql-connector + SDK
# ---------------------------------------------------------------------------
DATABRICKS_SQL_AVAILABLE = False
_dbsql = None  # type: ignore

try:
    from databricks import sql as _dbsql

    DATABRICKS_SQL_AVAILABLE = True
except ImportError:
    logger.warning("databricks-sql-connector not installed; DBSQL backend unavailable.")

try:
    from databricks.sdk import WorkspaceClient

    DATABRICKS_SDK_AVAILABLE = True
except ImportError:
    DATABRICKS_SDK_AVAILABLE = False
    WorkspaceClient = None  # type: ignore
    logger.warning("databricks-sdk not available for DBSQL authentication.")

_workspace_client = None


def _get_workspace_client():
    global _workspace_client
    if not DATABRICKS_SDK_AVAILABLE:
        raise RuntimeError("databricks-sdk is required for DBSQL connections.")
    if _workspace_client is None:
        _workspace_client = WorkspaceClient()
    return _workspace_client


def _get_catalog() -> str:
    return (os.getenv("LAKEHOUSE_CATALOG") or os.getenv("DBSQL_CATALOG") or "").strip()


def _get_schema_name() -> str:
    return (os.getenv("LAKEHOUSE_SCHEMA") or os.getenv("DBSQL_SCHEMA") or "").strip()


def get_schema() -> str:
    """Return ``catalog.schema`` for Unity Catalog three-level namespace."""
    cat, sch = _get_catalog(), _get_schema_name()
    if cat and sch:
        return f"{cat}.{sch}"
    return sch or cat


def _table_ident(table: str) -> str:
    """Quote identifiers for SQL (catalog.schema.table)."""
    cat, sch = _get_catalog(), _get_schema_name()
    if cat and sch:
        return f"`{cat}`.`{sch}`.`{table}`"
    if sch:
        return f"`{sch}`.`{table}`"
    return f"`{table}`"


SESSIONS_TABLE = "sessions"


def _sessions_table() -> str:
    return _table_ident(SESSIONS_TABLE)


def _get_connection_params() -> Dict[str, str]:
    host = os.getenv("DATABRICKS_HOST") or os.getenv("WORKSPACE_URL", "")
    if host.startswith("https://"):
        host = host.replace("https://", "")
    if host.startswith("http://"):
        host = host.replace("http://", "")
    host = host.rstrip("/")
    http_path = os.getenv("DATABRICKS_SQL_WAREHOUSE_HTTP_PATH", "")
    return {"server_hostname": host, "http_path": http_path}


def _oauth_token_from_sdk(w) -> Optional[str]:
    """Best-effort PAT / OAuth token string for connector fallback."""
    try:
        if hasattr(w.config, "token") and w.config.token:
            return str(w.config.token)
        headers = w.config.authenticate()
        if headers and "Authorization" in headers:
            auth = headers["Authorization"]
            if auth.startswith("Bearer "):
                return auth[7:]
    except Exception as e:
        logger.debug("SDK token extraction failed: %s", e)
    return os.getenv("DATABRICKS_TOKEN") or None


def is_lakebase_configured() -> bool:
    """Check if DBSQL is properly configured (env + drivers)."""
    cat_ok = bool(_get_catalog())
    sch_ok = bool(_get_schema_name())
    params = _get_connection_params()
    host_ok = bool(params.get("server_hostname"))
    path_ok = bool(params.get("http_path"))
    sdk_ok = DATABRICKS_SDK_AVAILABLE
    sql_ok = DATABRICKS_SQL_AVAILABLE
    ok = bool(sql_ok and sdk_ok and cat_ok and sch_ok and host_ok and path_ok)
    if not ok:
        logger.info(
            "DBSQL config check: sql=%s sdk=%s catalog=%s schema=%s host=%s http_path=%s",
            sql_ok,
            sdk_ok,
            cat_ok,
            sch_ok,
            host_ok,
            path_ok,
        )
    else:
        logger.info(
            "DBSQL configured: catalog=%s schema=%s host=%s...",
            _get_catalog(),
            _get_schema_name(),
            params["server_hostname"][:40],
        )
    return ok


@contextmanager
def get_connection():
    """Yield a DBSQL connection (context manager)."""
    if not is_lakebase_configured():
        raise RuntimeError("DBSQL not configured. Set catalog, schema, host, and warehouse HTTP path.")
    params = _get_connection_params()
    host = params["server_hostname"]
    http_path = params["http_path"]
    w = _get_workspace_client()

    conn = None
    try:
        try:
            conn = _dbsql.connect(
                server_hostname=host,
                http_path=http_path,
                credentials_provider=w.config,
            )
        except Exception as e1:
            logger.warning("connect(credentials_provider=config) failed: %s; trying access_token", e1)
            token = _oauth_token_from_sdk(w)
            if not token:
                raise RuntimeError("Could not authenticate DBSQL (no token from SDK or DATABRICKS_TOKEN).") from e1
            conn = _dbsql.connect(
                server_hostname=host,
                http_path=http_path,
                access_token=token,
            )
        yield conn
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception as e:
                logger.debug("Error closing DBSQL connection: %s", e)


def _convert_params(sql: str, params: tuple = None):
    """Convert psycopg-style %s markers to native ? markers for databricks-sql-connector."""
    if params is None:
        return sql, None
    converted = sql.replace("%s", "?")
    return converted, list(params)


def execute_query(sql: str, params: tuple = None) -> List[Dict]:
    """Execute SELECT and return a list of row dicts."""
    if not is_lakebase_configured():
        logger.info("DBSQL not configured — returning empty query results")
        return []
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            native_sql, native_params = _convert_params(sql, params)
            if native_params is not None:
                cursor.execute(native_sql, native_params)
            else:
                cursor.execute(native_sql)
            if cursor.description is None:
                return []
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            return [dict(zip(columns, row)) for row in rows]
    except Exception as e:
        logger.error("DBSQL query error: %s", e, exc_info=True)
        return []


def execute_insert(sql: str, params: tuple = None) -> bool:
    """Execute INSERT / UPDATE / DELETE (Databricks SQL auto-commits per statement)."""
    if not is_lakebase_configured():
        logger.error("DBSQL not configured — cannot execute write")
        return False
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            native_sql, native_params = _convert_params(sql, params)
            if native_params is not None:
                cursor.execute(native_sql, native_params)
            else:
                cursor.execute(native_sql)
            try:
                cursor.close()
            except Exception:
                pass
            return True
    except Exception as e:
        logger.error("DBSQL execute error: %s", e, exc_info=True)
        return False


def get_connection_status() -> dict:
    """Return connection health / configuration status."""
    params = _get_connection_params()
    base = {
        "backend": "dbsql",
        "configured": is_lakebase_configured(),
        "catalog": _get_catalog(),
        "schema": _get_schema_name(),
        "full_schema": get_schema(),
        "server_hostname_set": bool(params.get("server_hostname")),
        "http_path_set": bool(params.get("http_path")),
        "databricks_sql_connector": DATABRICKS_SQL_AVAILABLE,
        "databricks_sdk": DATABRICKS_SDK_AVAILABLE,
    }
    if not base["configured"]:
        base["ok"] = False
        base["error"] = "DBSQL environment incomplete or drivers missing"
        return base
    try:
        rows = execute_query("SELECT 1 AS ok")
        ok = bool(rows and rows[0].get("ok") == 1)
        base["ok"] = ok
        base["error"] = None if ok else "SELECT 1 returned unexpected result"
        return base
    except Exception as e:
        base["ok"] = False
        base["error"] = str(e)
        return base


# =============================================================================
# JSON helpers (STRING columns, no JSONB)
# =============================================================================


def _parse_json_str(val: Any, default: Any) -> Any:
    if val is None:
        return default
    if isinstance(val, (dict, list)):
        return val
    if isinstance(val, str):
        if not val.strip():
            return default
        try:
            return json.loads(val)
        except json.JSONDecodeError:
            return default
    return default


def _merge_json_column(session_id: str, column_name: str, new_data_dict: Dict[str, Any]) -> bool:
    """Read-modify-write for JSON stored as STRING."""
    table = _table_ident(SESSIONS_TABLE)
    rows = execute_query(f"SELECT {column_name} FROM {table} WHERE session_id = %s", (session_id,))
    current: Dict[str, Any] = {}
    if rows and rows[0].get(column_name) is not None:
        current = _parse_json_str(rows[0][column_name], {}) or {}
        if not isinstance(current, dict):
            current = {}
    merged = {**current, **new_data_dict}
    return execute_insert(
        f"UPDATE {table} SET {column_name} = %s, updated_at = CURRENT_TIMESTAMP() WHERE session_id = %s",
        (json.dumps(merged), session_id),
    )


# =============================================================================
# DDL
# =============================================================================


def get_create_tables_ddl() -> str:
    """Return Delta / DBSQL DDL for workshop tables (three-level names, no indexes)."""
    cat = _get_catalog() or "{catalog}"
    sch = _get_schema_name() or "{schema}"
    full = f"{cat}.{sch}"

    return f"""
-- =============================================================================
-- Vibe Coding Workshop — Databricks SQL (Delta) DDL
-- Namespace: {full}
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS {full};

-- -----------------------------------------------------------------------------
-- Sessions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS {full}.sessions (
    session_id STRING NOT NULL,
    created_by STRING NOT NULL,
    session_name STRING,
    session_description STRING,
    industry STRING,
    industry_label STRING,
    use_case STRING,
    use_case_label STRING,
    feedback_rating STRING,
    feedback_comment STRING,
    feedback_request_followup BOOLEAN DEFAULT FALSE,
    chapter_feedback STRING DEFAULT '{{}}',
    step_1_prompt STRING,
    step_prompts STRING DEFAULT '{{}}',
    prerequisites_completed BOOLEAN DEFAULT FALSE,
    current_step INT DEFAULT 1,
    workshop_level STRING DEFAULT '300',
    completed_steps STRING,
    skipped_steps STRING DEFAULT '[]',
    session_parameters STRING DEFAULT '{{}}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
) USING DELTA;

-- -----------------------------------------------------------------------------
-- Prompt library (same shape as Lakebase reference DDL)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS {full}.usecase_descriptions (
    config_id BIGINT GENERATED BY DEFAULT AS IDENTITY NOT NULL,
    industry STRING NOT NULL,
    industry_label STRING NOT NULL,
    use_case STRING NOT NULL,
    use_case_label STRING NOT NULL,
    prompt_template STRING NOT NULL,
    version INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    inserted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    created_by STRING
) USING DELTA;

CREATE TABLE IF NOT EXISTS {full}.section_input_prompts (
    input_id BIGINT GENERATED BY DEFAULT AS IDENTITY NOT NULL,
    section_tag STRING NOT NULL,
    section_title STRING,
    section_description STRING,
    input_template STRING NOT NULL,
    system_prompt STRING NOT NULL,
    order_number INT,
    how_to_apply STRING,
    expected_output STRING,
    version INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    inserted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    created_by STRING
) USING DELTA;

-- -----------------------------------------------------------------------------
-- Saved use case descriptions (community library)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS {full}.saved_usecase_descriptions (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY NOT NULL,
    created_by STRING NOT NULL,
    display_name STRING,
    updated_by STRING,
    industry STRING,
    use_case_name STRING,
    description STRING NOT NULL,
    version INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP()
) USING DELTA;
"""


# =============================================================================
# Leaderboard (same scoring model as lakebase.py)
# =============================================================================

STEP_SCORES = {
    1: 10, 2: 10, 3: 10,
    4: 20, 5: 20,
    6: 30, 7: 30, 8: 30,
    9: 40, 10: 40, 11: 40, 12: 40, 13: 40, 14: 40, 22: 40,
    15: 50, 16: 50, 17: 50, 18: 50, 19: 50,
    20: 60, 21: 60,
    26: 40, 27: 40, 28: 40, 29: 40, 30: 40,
}

CHAPTERS = {
    "Foundation": {"steps": {1, 2, 3}, "display": "Foundation"},
    "Chapter 1": {"steps": {4, 5}, "display": "Databricks App"},
    "Chapter 2": {"steps": {6, 7, 8}, "display": "Lakebase"},
    "Chapter 3": {"steps": {9, 10, 11, 12, 13, 14, 22}, "display": "Lakehouse"},
    "Chapter 4": {"steps": {15, 16, 17, 18, 19}, "display": "Data Intelligence"},
    "Refinement": {"steps": {20, 21}, "display": "Refinement"},
    "Agent Skills": {"steps": {26, 27, 28, 29, 30}, "display": "Agent Skills"},
}

AVATAR_EMOJIS = ["🦊", "🐙", "🦄", "🐼", "🦉", "🐬", "🦁", "🐸", "🦋", "🐯", "🦈", "🐨", "🦩", "🐻", "🦖"]

_WORKSHOP_LEVEL_LABELS: Dict[str, str] = {
    "app-only": "Databricks Apps",
    "app-database": "+ Lakebase",
    "lakehouse": "Lakehouse",
    "lakehouse-di": "+ Data Intelligence",
    "end-to-end": "Complete Workshop",
    "accelerator": "Data Product Accelerator",
    "genie-accelerator": "Genie Accelerator",
    "data-engineering-accelerator": "Data Engineering Accelerator",
    "skills-accelerator": "Skills Accelerator",
}


def _calculate_score(completed_steps: List[int], skipped_steps: List[int] = None) -> int:
    skipped = set(skipped_steps) if skipped_steps else set()
    return sum(STEP_SCORES.get(step, 0) for step in completed_steps if step not in skipped)


def _get_chapter_status(completed_steps: List[int], skipped_steps: List[int] = None) -> Tuple[List[str], List[str]]:
    completed_set = set(completed_steps)
    skipped_set = set(skipped_steps) if skipped_steps else set()
    done_set = completed_set | skipped_set
    completed_chapters: List[str] = []
    in_progress_chapters: List[str] = []
    for _chapter_name, chapter_info in CHAPTERS.items():
        chapter_steps = chapter_info["steps"]
        done_in_chapter = done_set & chapter_steps
        if done_in_chapter == chapter_steps:
            completed_chapters.append(chapter_info["display"])
        elif done_in_chapter:
            in_progress_chapters.append(chapter_info["display"])
    return completed_chapters, in_progress_chapters


def _format_display_name(email: str) -> str:
    if not email or "@" not in email:
        return email or "Anonymous"
    name_part = email.split("@")[0]
    parts = re.split(r"[._\-]", name_part)
    parts = [p for p in parts if p]
    if len(parts) >= 2:
        first_name = parts[0].capitalize()
        last_initial = parts[1][0].upper() if parts[1] else ""
        return f"{first_name} {last_initial}."
    if parts:
        return parts[0].capitalize()
    return name_part.capitalize()


def _get_avatar_for_user(email: str) -> str:
    if not email:
        return AVATAR_EMOJIS[0]
    hash_value = hash(email.lower())
    index = abs(hash_value) % len(AVATAR_EMOJIS)
    return AVATAR_EMOJIS[index]


def _ts_to_str(val: Any) -> Optional[str]:
    if val is None:
        return None
    if hasattr(val, "isoformat"):
        try:
            return val.isoformat()
        except Exception:
            pass
    if hasattr(val, "strftime"):
        try:
            return val.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            pass
    return str(val)


# =============================================================================
# Session CRUD
# =============================================================================


def save_session(
    session_id: str,
    industry: str = None,
    industry_label: str = None,
    use_case: str = None,
    use_case_label: str = None,
    session_name: str = None,
    session_description: str = None,
    feedback_rating: str = None,
    feedback_comment: str = None,
    feedback_request_followup: bool = None,
    prerequisites_completed: bool = None,
    current_step: int = None,
    workshop_level: str = None,
    completed_steps: List[int] = None,
    skipped_steps: List[int] = None,
    step_prompts: Dict[int, str] = None,
    created_by: str = None,
) -> bool:
    """
    Insert or update a session row. Emulates PostgreSQL ON CONFLICT … COALESCE
    using read-merge-write (MERGE semantics in application code).
    """
    if not is_lakebase_configured():
        logger.warning("DBSQL not configured, cannot save session %s", session_id)
        return False

    table = _sessions_table()
    existing_rows = execute_query(
        f"""
        SELECT session_id, created_by, session_name, session_description,
               industry, industry_label, use_case, use_case_label,
               feedback_rating, feedback_comment, feedback_request_followup,
               chapter_feedback, step_1_prompt, step_prompts,
               prerequisites_completed, current_step, workshop_level,
               completed_steps, skipped_steps, session_parameters,
               created_at, updated_at
        FROM {table}
        WHERE session_id = %s
        """,
        (session_id,),
    )

    def _coalesce_str(new_val: Any, old_val: Any) -> Any:
        return old_val if new_val is None else new_val

    def _coalesce_json_merge_steps(
        old_step1: Any,
        old_steps_json: Any,
        step_prompts_arg: Optional[Dict[int, str]],
    ) -> Tuple[Any, str]:
        if step_prompts_arg is None:
            return old_step1, (
                json.dumps(_parse_json_str(old_steps_json, {}))
                if not isinstance(old_steps_json, dict)
                else json.dumps(old_steps_json)
            )
        new_step1 = step_prompts_arg.get(1)
        merged_small: Dict[str, str] = {}
        if isinstance(old_steps_json, dict):
            merged_small = {str(k): v for k, v in old_steps_json.items()}
        else:
            merged_small = _parse_json_str(old_steps_json, {}) or {}
            if not isinstance(merged_small, dict):
                merged_small = {}
        partial = {str(k): v for k, v in step_prompts_arg.items() if k != 1 and v}
        merged_small = {**merged_small, **partial}
        step1_out = _coalesce_str(new_step1, old_step1)
        return step1_out, json.dumps(merged_small)

    if not existing_rows:
        step_1_prompt_value = step_prompts.get(1) if step_prompts else None
        step_prompts_small: Dict[str, str] = {}
        if step_prompts:
            for step_num, prompt_text in step_prompts.items():
                if step_num != 1 and prompt_text:
                    step_prompts_small[str(step_num)] = prompt_text
        completed_steps_json = json.dumps(completed_steps) if completed_steps is not None else None
        skipped_steps_json = json.dumps(skipped_steps) if skipped_steps is not None else None
        sql = f"""
        INSERT INTO {table} (
            session_id, created_by,
            session_name, session_description,
            industry, industry_label, use_case, use_case_label,
            feedback_rating, feedback_comment, feedback_request_followup,
            step_1_prompt, step_prompts,
            prerequisites_completed, current_step, workshop_level,
            completed_steps, skipped_steps,
            created_at, updated_at
        ) VALUES (
            %s, %s,
            %s, %s,
            %s, %s, %s, %s,
            %s, %s, %s,
            %s, %s,
            %s, %s, %s,
            %s, %s,
            CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()
        )
        """
        params = (
            session_id,
            created_by or "",
            session_name,
            session_description,
            industry,
            industry_label,
            use_case,
            use_case_label,
            feedback_rating,
            feedback_comment,
            feedback_request_followup,
            step_1_prompt_value,
            json.dumps(step_prompts_small),
            prerequisites_completed,
            current_step,
            workshop_level,
            completed_steps_json,
            skipped_steps_json,
        )
        return execute_insert(sql, params)

    row = existing_rows[0]
    merged_industry = _coalesce_str(industry, row.get("industry"))
    merged_industry_label = _coalesce_str(industry_label, row.get("industry_label"))
    merged_use_case = _coalesce_str(use_case, row.get("use_case"))
    merged_use_case_label = _coalesce_str(use_case_label, row.get("use_case_label"))
    merged_session_name = _coalesce_str(session_name, row.get("session_name"))
    merged_session_desc = _coalesce_str(session_description, row.get("session_description"))
    merged_feedback_rating = _coalesce_str(feedback_rating, row.get("feedback_rating"))
    merged_feedback_comment = _coalesce_str(feedback_comment, row.get("feedback_comment"))
    merged_feedback_follow = (
        feedback_request_followup
        if feedback_request_followup is not None
        else row.get("feedback_request_followup")
    )
    merged_prereq = (
        prerequisites_completed
        if prerequisites_completed is not None
        else row.get("prerequisites_completed")
    )
    merged_current = _coalesce_str(current_step, row.get("current_step"))
    merged_level = _coalesce_str(workshop_level, row.get("workshop_level"))
    merged_completed = row.get("completed_steps")
    if completed_steps is not None:
        merged_completed = json.dumps(completed_steps)
    elif merged_completed is not None and not isinstance(merged_completed, str):
        merged_completed = json.dumps(merged_completed) if merged_completed is not None else None
    merged_skipped = row.get("skipped_steps")
    if skipped_steps is not None:
        merged_skipped = json.dumps(skipped_steps)
    elif merged_skipped is not None and not isinstance(merged_skipped, str):
        merged_skipped = json.dumps(merged_skipped)

    step1_m, step_prompts_m = _coalesce_json_merge_steps(
        row.get("step_1_prompt"),
        row.get("step_prompts"),
        step_prompts,
    )

    sql = f"""
    UPDATE {table} SET
        industry = %s,
        industry_label = %s,
        use_case = %s,
        use_case_label = %s,
        session_name = %s,
        session_description = %s,
        feedback_rating = %s,
        feedback_comment = %s,
        feedback_request_followup = %s,
        prerequisites_completed = %s,
        current_step = %s,
        workshop_level = %s,
        completed_steps = %s,
        skipped_steps = %s,
        step_1_prompt = %s,
        step_prompts = %s,
        updated_at = CURRENT_TIMESTAMP()
    WHERE session_id = %s
    """
    params = (
        merged_industry,
        merged_industry_label,
        merged_use_case,
        merged_use_case_label,
        merged_session_name,
        merged_session_desc,
        merged_feedback_rating,
        merged_feedback_comment,
        merged_feedback_follow,
        merged_prereq,
        merged_current,
        merged_level,
        merged_completed,
        merged_skipped,
        step1_m,
        step_prompts_m,
        session_id,
    )
    return execute_insert(sql, params)


def load_session(session_id: str) -> Optional[Dict]:
    if not is_lakebase_configured():
        return None
    table = _sessions_table()
    rows = execute_query(
        f"""
        SELECT
            session_id, industry, industry_label, use_case, use_case_label,
            session_name, session_description, feedback_rating, feedback_comment,
            prerequisites_completed, current_step, workshop_level, completed_steps, skipped_steps,
            step_1_prompt, step_prompts,
            COALESCE(session_parameters, '{{}}') AS session_parameters,
            created_by, created_at, updated_at
        FROM {table}
        WHERE session_id = %s
        """,
        (session_id,),
    )
    if not rows:
        return None
    row = rows[0]
    completed_steps: List[int] = []
    raw_cs = row.get("completed_steps")
    if raw_cs:
        try:
            completed_steps = _parse_json_str(raw_cs, [])
            if not isinstance(completed_steps, list):
                completed_steps = []
        except Exception:
            completed_steps = []
    skipped_steps: List[int] = []
    raw_sk = row.get("skipped_steps")
    if raw_sk:
        try:
            skipped_steps = _parse_json_str(raw_sk, [])
            if not isinstance(skipped_steps, list):
                skipped_steps = []
        except Exception:
            skipped_steps = []

    step_prompts: Dict[int, str] = {}
    if row.get("step_1_prompt"):
        step_prompts[1] = row["step_1_prompt"]
    sp = row.get("step_prompts")
    sp_d = _parse_json_str(sp, {})
    if isinstance(sp_d, dict):
        for step_str, prompt_text in sp_d.items():
            try:
                sn = int(step_str)
                if prompt_text:
                    step_prompts[sn] = prompt_text
            except ValueError:
                continue

    session_params = _parse_json_str(row.get("session_parameters"), {})
    if not isinstance(session_params, dict):
        session_params = {}

    created_at = _ts_to_str(row.get("created_at"))
    updated_at = _ts_to_str(row.get("updated_at"))
    is_saved = bool(row.get("session_name") and row["session_name"] != "New Session")

    return {
        "session_id": row["session_id"],
        "industry": row.get("industry"),
        "industry_label": row.get("industry_label"),
        "use_case": row.get("use_case"),
        "use_case_label": row.get("use_case_label"),
        "session_name": row.get("session_name"),
        "session_description": row.get("session_description"),
        "feedback_rating": row.get("feedback_rating"),
        "feedback_comment": row.get("feedback_comment"),
        "prerequisites_completed": row.get("prerequisites_completed", False),
        "current_step": row.get("current_step", 1),
        "workshop_level": row.get("workshop_level", "300"),
        "completed_steps": completed_steps,
        "skipped_steps": skipped_steps,
        "step_prompts": step_prompts,
        "session_parameters": session_params,
        "created_by": row.get("created_by"),
        "created_at": created_at,
        "updated_at": updated_at,
        "is_saved": is_saved,
    }


def delete_session(session_id: str) -> bool:
    if not is_lakebase_configured():
        return False
    table = _sessions_table()
    return execute_insert(f"DELETE FROM {table} WHERE session_id = %s", (session_id,))


def get_user_sessions(created_by: str, limit: int = 50, saved_only: bool = True) -> List[Dict]:
    if not is_lakebase_configured():
        return []
    table = _sessions_table()
    if saved_only:
        sql = f"""
        SELECT
            session_id, session_name, session_description,
            industry, industry_label, use_case, use_case_label,
            current_step, feedback_rating,
            created_by, created_at, updated_at
        FROM {table}
        WHERE created_by = %s
          AND session_name IS NOT NULL
          AND session_name != ''
          AND session_name != 'New Session'
        ORDER BY updated_at DESC
        LIMIT %s
        """
    else:
        sql = f"""
        SELECT
            session_id, session_name, session_description,
            industry, industry_label, use_case, use_case_label,
            current_step, feedback_rating,
            created_by, created_at, updated_at
        FROM {table}
        WHERE created_by = %s
        ORDER BY updated_at DESC
        LIMIT %s
        """
    rows = execute_query(sql, (created_by, limit))
    out: List[Dict[str, Any]] = []
    for row in rows:
        out.append(
            {
                "session_id": row["session_id"],
                "session_name": row.get("session_name"),
                "session_description": row.get("session_description"),
                "industry": row.get("industry"),
                "industry_label": row.get("industry_label"),
                "use_case": row.get("use_case"),
                "use_case_label": row.get("use_case_label"),
                "current_step": row.get("current_step", 1),
                "feedback_rating": row.get("feedback_rating"),
                "created_by": row.get("created_by"),
                "created_at": _ts_to_str(row.get("created_at")),
                "updated_at": _ts_to_str(row.get("updated_at")),
                "is_saved": bool(row.get("session_name") and row["session_name"] != "New Session"),
            }
        )
    return out


def get_user_default_session(
    created_by: str,
    industry: Optional[str] = None,
    use_case: Optional[str] = None,
) -> Optional[Dict]:
    if not is_lakebase_configured():
        return None
    table = _sessions_table()
    conds = ["created_by = %s", "session_name = 'New Session'"]
    params: List[Any] = [created_by]
    if industry is not None:
        conds.append("industry = %s")
        params.append(industry)
    if use_case is not None:
        conds.append("use_case = %s")
        params.append(use_case)
    where = " AND ".join(conds)
    rows = execute_query(
        f"""
        SELECT
            session_id, industry, industry_label, use_case, use_case_label,
            session_name, session_description, feedback_rating, feedback_comment,
            prerequisites_completed, current_step, workshop_level, completed_steps, skipped_steps,
            step_1_prompt, step_prompts,
            COALESCE(session_parameters, '{{}}') AS session_parameters,
            created_by, created_at, updated_at
        FROM {table}
        WHERE {where}
        ORDER BY current_step DESC, updated_at DESC
        LIMIT 1
        """,
        tuple(params),
    )
    if not rows:
        return None
    row = rows[0]
    return load_session(row["session_id"])


def delete_user_unsaved_sessions(created_by: str, keep_session_id: str = None) -> int:
    if not is_lakebase_configured():
        return 0
    table = _sessions_table()
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            if keep_session_id:
                cur.execute(
                    f"""
                    DELETE FROM {table}
                    WHERE created_by = %s
                      AND session_name = 'New Session'
                      AND session_id != %s
                    """,
                    (created_by, keep_session_id),
                )
            else:
                cur.execute(
                    f"""
                    DELETE FROM {table}
                    WHERE created_by = %s
                      AND session_name = 'New Session'
                    """,
                    (created_by,),
                )
            rc = getattr(cur, "rowcount", None)
            try:
                cur.close()
            except Exception:
                pass
            if rc is None or rc < 0:
                return 0
            return int(rc)
    except Exception as e:
        logger.error("delete_user_unsaved_sessions: %s", e, exc_info=True)
        return 0


def update_step_prompt(
    session_id: str,
    step_number: int,
    prompt_text: str,
    workshop_level: str = None,
) -> bool:
    if not is_lakebase_configured():
        return False
    if not 1 <= step_number <= 30:
        logger.error("Invalid step number: %s", step_number)
        return False
    table = _sessions_table()
    if step_number == 1:
        if workshop_level:
            return execute_insert(
                f"""
                UPDATE {table}
                SET step_1_prompt = %s, workshop_level = %s, updated_at = CURRENT_TIMESTAMP()
                WHERE session_id = %s
                """,
                (prompt_text, workshop_level, session_id),
            )
        return execute_insert(
            f"""
            UPDATE {table}
            SET step_1_prompt = %s, updated_at = CURRENT_TIMESTAMP()
            WHERE session_id = %s
            """,
            (prompt_text, session_id),
        )
    rows_sp = execute_query(f"SELECT step_prompts FROM {table} WHERE session_id = %s", (session_id,))
    current: Dict[str, Any] = {}
    if rows_sp and rows_sp[0].get("step_prompts") is not None:
        current = _parse_json_str(rows_sp[0]["step_prompts"], {}) or {}
    if not isinstance(current, dict):
        current = {}
    current[str(step_number)] = prompt_text
    merged_json = json.dumps(current)
    if workshop_level:
        return execute_insert(
            f"""
            UPDATE {table}
            SET step_prompts = %s, workshop_level = %s, updated_at = CURRENT_TIMESTAMP()
            WHERE session_id = %s
            """,
            (merged_json, workshop_level, session_id),
        )
    return execute_insert(
        f"""
        UPDATE {table}
        SET step_prompts = %s, updated_at = CURRENT_TIMESTAMP()
        WHERE session_id = %s
        """,
        (merged_json, session_id),
    )


def save_chapter_feedback(session_id: str, chapter_name: str, rating: str) -> bool:
    if not is_lakebase_configured():
        return False
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    patch = {chapter_name: {"rating": rating, "timestamp": now}}
    return _merge_json_column(session_id, "chapter_feedback", patch)


def get_leaderboard(limit: int = 10) -> List[Dict]:
    if not is_lakebase_configured():
        return []
    table = _sessions_table()
    rows = execute_query(
        f"""
        SELECT created_by, completed_steps, skipped_steps, updated_at, workshop_level
        FROM {table}
        WHERE created_by IS NOT NULL
          AND created_by != ''
          AND completed_steps IS NOT NULL
          AND completed_steps != ''
          AND completed_steps != '[]'
        ORDER BY created_by, updated_at DESC
        """
    )
    user_scores: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        email = row.get("created_by") or ""
        if not email:
            continue
        try:
            cs_raw = row.get("completed_steps", "[]")
            cs = json.loads(cs_raw) if isinstance(cs_raw, str) else (cs_raw or [])
            if not cs:
                continue
            sk_raw = row.get("skipped_steps", "[]")
            sk = json.loads(sk_raw) if isinstance(sk_raw, str) else (sk_raw or [])
        except Exception:
            continue
        score = _calculate_score(cs, sk)
        updated_at = row.get("updated_at")
        wl = row.get("workshop_level")
        if email not in user_scores or score > user_scores[email]["score"]:
            user_scores[email] = {
                "score": score,
                "completed_steps": cs,
                "skipped_steps": sk,
                "updated_at": updated_at,
                "workshop_level": wl,
            }
        elif score == user_scores[email]["score"] and updated_at and user_scores[email]["updated_at"]:
            if updated_at < user_scores[email]["updated_at"]:
                user_scores[email] = {
                    "score": score,
                    "completed_steps": cs,
                    "skipped_steps": sk,
                    "updated_at": updated_at,
                    "workshop_level": wl,
                }
    sorted_users = sorted(
        user_scores.items(),
        key=lambda x: (-x[1]["score"], x[1]["updated_at"] or datetime.max),
    )
    leaderboard: List[Dict[str, Any]] = []
    for rank, (email, data) in enumerate(sorted_users[:limit], start=1):
        cc, ipc = _get_chapter_status(data["completed_steps"], data.get("skipped_steps", []))
        ua = data["updated_at"]
        if hasattr(ua, "isoformat"):
            ua_str = ua.isoformat()
        elif hasattr(ua, "strftime"):
            ua_str = ua.strftime("%Y-%m-%dT%H:%M:%S")
        else:
            ua_str = str(ua) if ua else None
        leaderboard.append(
            {
                "rank": rank,
                "user_id": email,
                "display_name": _format_display_name(email),
                "avatar": _get_avatar_for_user(email),
                "score": data["score"],
                "completed_steps": sorted(data["completed_steps"]),
                "skipped_steps": sorted(data.get("skipped_steps", [])),
                "completed_chapters": cc,
                "in_progress_chapters": ipc,
                "updated_at": ua_str,
                "workshop_level": data.get("workshop_level"),
            }
        )
    return leaderboard


def get_workshop_users() -> Dict[str, Any]:
    if not is_lakebase_configured():
        return {"total": 0, "users": []}
    table = _sessions_table()
    sql = f"""
        SELECT created_by, workshop_level, updated_at, session_id, session_name
        FROM (
            SELECT created_by, workshop_level, updated_at, session_id, session_name,
                   ROW_NUMBER() OVER (PARTITION BY created_by ORDER BY updated_at DESC) AS rn
            FROM {table}
            WHERE created_by IS NOT NULL AND created_by != ''
        ) t
        WHERE rn = 1
        ORDER BY updated_at DESC
    """
    rows = execute_query(sql)
    users: List[Dict[str, Any]] = []
    for row in rows:
        email = row.get("created_by") or ""
        if not email:
            continue
        level = row.get("workshop_level") or ""
        updated_at = row.get("updated_at")
        if hasattr(updated_at, "isoformat"):
            updated_at = updated_at.isoformat()
        elif hasattr(updated_at, "strftime"):
            updated_at = updated_at.strftime("%Y-%m-%dT%H:%M:%S")
        session_name = row.get("session_name") or ""
        users.append(
            {
                "display_name": _format_display_name(email),
                "email": email,
                "workshop_level": level,
                "workshop_level_label": _WORKSHOP_LEVEL_LABELS.get(level, level or "Unknown"),
                "updated_at": updated_at,
                "last_session_id": row.get("session_id") or "",
                "is_saved": bool(session_name and session_name != "New Session"),
            }
        )
    return {"total": len(users), "users": users}


def get_analytics() -> Dict[str, Any]:
    _empty: Dict[str, Any] = {
        "summary": {
            "total_sessions": 0,
            "total_users": 0,
            "total_feedback": 0,
            "positive_count": 0,
            "negative_count": 0,
        },
        "usage": {
            "avg_steps_per_session": 0,
            "prereqs_completed": 0,
            "total_prompts_generated": 0,
            "saved_sessions": 0,
            "avg_score": 0,
        },
        "by_industry": [],
        "by_use_case": [],
        "by_level": [],
        "step_completion_counts": [],
        "chapter_feedback": [],
        "recent_sessions": [],
        "user_activity": [],
        "feedback_details": [],
    }
    if not is_lakebase_configured():
        return _empty
    table = _sessions_table()
    try:
        summary_rows = execute_query(
            f"""
            SELECT
                (SELECT COUNT(*) FROM {table}) AS total_sessions,
                (SELECT COUNT(DISTINCT created_by) FROM {table}
                 WHERE created_by IS NOT NULL AND created_by != '') AS total_users,
                (SELECT COUNT(*) FROM {table}
                 WHERE feedback_rating IS NOT NULL AND feedback_rating != '') AS total_feedback,
                (SELECT COUNT(*) FROM {table}
                 WHERE feedback_rating = 'thumbs_up') AS positive_count,
                (SELECT COUNT(*) FROM {table}
                 WHERE feedback_rating = 'thumbs_down') AS negative_count
            """
        )
        summary = summary_rows[0] if summary_rows else _empty["summary"]

        usage_rows = execute_query(
            f"""
            SELECT
                (SELECT COUNT(*) FROM {table} WHERE prerequisites_completed = TRUE) AS prereqs_completed,
                (SELECT COUNT(*) FROM {table}
                 WHERE session_name IS NOT NULL
                   AND session_name != ''
                   AND session_name != 'New Session') AS saved_sessions
            """
        )
        usage_base = usage_rows[0] if usage_rows else {}

        raw_sessions = execute_query(
            f"""
            SELECT completed_steps, skipped_steps, step_1_prompt, step_prompts
            FROM {table}
            """
        )
        step_len_sum = 0
        step_len_n = 0
        scores: List[float] = []
        total_prompts = 0
        for s in raw_sessions:
            cs: List[int] = []
            sk: List[int] = []
            try:
                cs_raw = s.get("completed_steps")
                cs = json.loads(cs_raw) if isinstance(cs_raw, str) else (cs_raw or [])
                if not isinstance(cs, list):
                    cs = []
            except Exception:
                cs = []
            try:
                sk_raw = s.get("skipped_steps", "[]")
                sk = json.loads(sk_raw) if isinstance(sk_raw, str) else (sk_raw or [])
                if not isinstance(sk, list):
                    sk = []
            except Exception:
                sk = []
            if cs:
                step_len_sum += len(cs)
                step_len_n += 1
                scores.append(float(_calculate_score(cs, sk)))
            if s.get("step_1_prompt"):
                total_prompts += 1
            sp = _parse_json_str(s.get("step_prompts"), {})
            if isinstance(sp, dict):
                total_prompts += len([k for k, v in sp.items() if v])

        avg_steps = round(step_len_sum / step_len_n, 1) if step_len_n else 0.0
        avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0

        usage = {
            "avg_steps_per_session": float(avg_steps),
            "prereqs_completed": int(usage_base.get("prereqs_completed", 0)),
            "total_prompts_generated": int(total_prompts),
            "saved_sessions": int(usage_base.get("saved_sessions", 0)),
            "avg_score": float(avg_score),
        }

        industry_rows = execute_query(
            f"""
            SELECT industry_label AS industry, COUNT(*) AS count
            FROM {table}
            WHERE industry_label IS NOT NULL AND industry_label != ''
            GROUP BY industry_label
            ORDER BY count DESC
            LIMIT 10
            """
        )
        usecase_rows = execute_query(
            f"""
            SELECT use_case_label AS use_case, COUNT(*) AS count
            FROM {table}
            WHERE use_case_label IS NOT NULL AND use_case_label != ''
            GROUP BY use_case_label
            ORDER BY count DESC
            LIMIT 10
            """
        )
        level_rows = execute_query(
            f"""
            SELECT COALESCE(workshop_level, 'unknown') AS level, COUNT(*) AS count
            FROM {table}
            GROUP BY workshop_level
            ORDER BY count DESC
            """
        )
        by_level = []
        for lr in level_rows:
            lvl = lr.get("level", "unknown")
            by_level.append(
                {
                    "level": lvl,
                    "label": _WORKSHOP_LEVEL_LABELS.get(lvl, lvl or "Unknown"),
                    "count": int(lr["count"]),
                }
            )

        completed_map: Dict[int, int] = {}
        skipped_map: Dict[int, int] = {}
        for s in raw_sessions:
            try:
                cs = json.loads(s["completed_steps"]) if isinstance(s.get("completed_steps"), str) else s.get("completed_steps")
                if isinstance(cs, list):
                    for st in cs:
                        completed_map[int(st)] = completed_map.get(int(st), 0) + 1
            except Exception:
                pass
            try:
                sk = json.loads(s["skipped_steps"]) if isinstance(s.get("skipped_steps"), str) else s.get("skipped_steps")
                if isinstance(sk, list):
                    for st in sk:
                        skipped_map[int(st)] = skipped_map.get(int(st), 0) + 1
            except Exception:
                pass
        all_step_nums = sorted(set(list(completed_map.keys()) + list(skipped_map.keys())))
        step_completion_counts = [
            {"step_number": s, "completed": completed_map.get(s, 0), "skipped": skipped_map.get(s, 0)}
            for s in all_step_nums
        ]

        cf_rows = execute_query(
            f"""
            SELECT chapter_feedback
            FROM {table}
            WHERE chapter_feedback IS NOT NULL
              AND chapter_feedback != ''
              AND chapter_feedback != '{{}}'
            """
        )
        ch_tally: Dict[str, Dict[str, int]] = {}
        for cfr in cf_rows:
            cf = _parse_json_str(cfr.get("chapter_feedback"), {})
            if not isinstance(cf, dict):
                continue
            for ch_name, ch_val in cf.items():
                if ch_name not in ch_tally:
                    ch_tally[ch_name] = {"up": 0, "down": 0}
                rating = ""
                if isinstance(ch_val, dict):
                    rating = ch_val.get("rating", "") or ""
                if rating in ("up", "thumbs_up"):
                    ch_tally[ch_name]["up"] += 1
                elif rating in ("down", "thumbs_down"):
                    ch_tally[ch_name]["down"] += 1
        chapter_feedback = [{"chapter": ch, "up": vals["up"], "down": vals["down"]} for ch, vals in ch_tally.items()]

        recent_rows = execute_query(
            f"""
            SELECT session_id, created_by, industry_label, use_case_label,
                   workshop_level, completed_steps, created_at
            FROM {table}
            ORDER BY created_at DESC
            LIMIT 10
            """
        )
        recent_sessions = []
        for rr in recent_rows:
            email = rr.get("created_by", "")
            cs_raw = rr.get("completed_steps", "[]")
            try:
                cs = json.loads(cs_raw) if isinstance(cs_raw, str) else (cs_raw or [])
                completed_count = len(cs) if isinstance(cs, list) else 0
            except Exception:
                completed_count = 0
            lvl = rr.get("workshop_level") or ""
            ca = rr.get("created_at")
            if hasattr(ca, "isoformat"):
                ca = ca.isoformat()
            elif hasattr(ca, "strftime"):
                ca = ca.strftime("%Y-%m-%dT%H:%M:%S")
            recent_sessions.append(
                {
                    "session_id": rr.get("session_id"),
                    "display_name": _format_display_name(email),
                    "industry_label": rr.get("industry_label") or "",
                    "use_case_label": rr.get("use_case_label") or "",
                    "workshop_level": lvl,
                    "workshop_level_label": _WORKSHOP_LEVEL_LABELS.get(lvl, lvl or "Unknown"),
                    "completed_count": completed_count,
                    "created_at": str(ca or ""),
                }
            )

        user_rows = execute_query(
            f"""
            SELECT created_by, session_id, completed_steps, skipped_steps, feedback_rating
            FROM {table}
            WHERE created_by IS NOT NULL AND created_by != ''
            """
        )
        user_agg: Dict[str, Dict[str, Any]] = {}
        for ur in user_rows:
            email = ur.get("created_by", "")
            if not email:
                continue
            if email not in user_agg:
                user_agg[email] = {"sessions": set(), "total_steps": 0, "best_score": 0, "feedback_given": 0}
            user_agg[email]["sessions"].add(ur.get("session_id"))
            try:
                cs = json.loads(ur["completed_steps"]) if isinstance(ur.get("completed_steps"), str) else (ur.get("completed_steps") or [])
                sk = json.loads(ur["skipped_steps"]) if isinstance(ur.get("skipped_steps"), str) else (ur.get("skipped_steps") or [])
            except Exception:
                cs, sk = [], []
            user_agg[email]["total_steps"] += len(cs) if isinstance(cs, list) else 0
            score = _calculate_score(cs if isinstance(cs, list) else [], sk if isinstance(sk, list) else [])
            if score > user_agg[email]["best_score"]:
                user_agg[email]["best_score"] = score
            if ur.get("feedback_rating"):
                user_agg[email]["feedback_given"] += 1

        user_activity = sorted(
            [
                {
                    "email": em,
                    "display_name": _format_display_name(em),
                    "session_count": len(data["sessions"]),
                    "total_steps": data["total_steps"],
                    "best_score": data["best_score"],
                    "feedback_given": data["feedback_given"],
                }
                for em, data in user_agg.items()
            ],
            key=lambda x: -x["best_score"],
        )

        fb_rows = execute_query(
            f"""
            SELECT session_id, created_by, feedback_rating, feedback_comment,
                   industry_label, use_case_label, created_at
            FROM {table}
            WHERE feedback_rating IS NOT NULL AND feedback_rating != ''
            ORDER BY created_at DESC
            LIMIT 100
            """
        )
        feedback_details = []
        for fr in fb_rows:
            email = fr.get("created_by", "")
            ca = fr.get("created_at")
            if hasattr(ca, "isoformat"):
                ca = ca.isoformat()
            elif hasattr(ca, "strftime"):
                ca = ca.strftime("%Y-%m-%dT%H:%M:%S")
            feedback_details.append(
                {
                    "session_id": fr.get("session_id"),
                    "display_name": _format_display_name(email),
                    "feedback_rating": fr.get("feedback_rating") or "",
                    "feedback_comment": fr.get("feedback_comment") or "",
                    "industry_label": fr.get("industry_label") or "",
                    "use_case_label": fr.get("use_case_label") or "",
                    "created_at": str(ca or ""),
                }
            )

        return {
            "summary": {k: int(v or 0) for k, v in summary.items()},
            "usage": usage,
            "by_industry": [{"industry": r["industry"], "count": int(r["count"])} for r in industry_rows],
            "by_use_case": [{"use_case": r["use_case"], "count": int(r["count"])} for r in usecase_rows],
            "by_level": by_level,
            "step_completion_counts": step_completion_counts,
            "chapter_feedback": chapter_feedback,
            "recent_sessions": recent_sessions,
            "user_activity": user_activity,
            "feedback_details": feedback_details,
        }
    except Exception as e:
        logger.warning("Analytics aggregation failed: %s", e, exc_info=True)
        return _empty


def cleanup_session_steps(
    session_id: Optional[str] = None,
    max_step: Optional[int] = None,
) -> Union[Dict[str, int], bool]:
    """
    Two modes:
    - No arguments: legacy migration (replace step 41 with 4, fix current_step) — same intent as Lakebase.
    - ``session_id`` + ``max_step``: drop step references greater than ``max_step`` from prompts and arrays; returns bool.
    """
    if not is_lakebase_configured():
        if session_id is not None and max_step is not None:
            return False
        return {"sessions_fixed": 0, "step_41_replaced": 0}

    if session_id is not None and max_step is not None:
        return _cleanup_session_steps_for_session(session_id, max_step)

    return _cleanup_session_steps_legacy_migration()


def _cleanup_session_steps_for_session(session_id: str, max_step: int) -> bool:
    """Remove step data beyond max_step (completed/skipped arrays and step_prompts JSON)."""
    table = _sessions_table()
    rows = execute_query(
        f"SELECT completed_steps, skipped_steps, step_prompts, step_1_prompt, current_step FROM {table} WHERE session_id = %s",
        (session_id,),
    )
    if not rows:
        return False
    row = rows[0]
    try:
        cs = json.loads(row["completed_steps"]) if isinstance(row.get("completed_steps"), str) else row.get("completed_steps") or []
        sk = json.loads(row["skipped_steps"]) if isinstance(row.get("skipped_steps"), str) else row.get("skipped_steps") or []
    except Exception:
        cs, sk = [], []
    cs = [x for x in cs if int(x) <= max_step] if isinstance(cs, list) else []
    sk = [x for x in sk if int(x) <= max_step] if isinstance(sk, list) else []
    sp = _parse_json_str(row.get("step_prompts"), {})
    if not isinstance(sp, dict):
        sp = {}
    sp = {k: v for k, v in sp.items() if int(k) <= max_step}
    step1 = row.get("step_1_prompt") if max_step >= 1 else None
    new_current = max(cs) if cs else min(max_step, int(row.get("current_step") or 1))
    return execute_insert(
        f"""
        UPDATE {table}
        SET completed_steps = %s,
            skipped_steps = %s,
            step_prompts = %s,
            step_1_prompt = %s,
            current_step = %s,
            updated_at = CURRENT_TIMESTAMP()
        WHERE session_id = %s
        """,
        (json.dumps(cs), json.dumps(sk), json.dumps(sp), step1, new_current, session_id),
    )


def _cleanup_session_steps_legacy_migration() -> Dict[str, int]:
    table = _sessions_table()
    stats = {"sessions_fixed": 0, "step_41_replaced": 0}
    rows = execute_query(f"SELECT session_id, completed_steps, current_step FROM {table} WHERE completed_steps IS NOT NULL")
    for row in rows:
        sid = row["session_id"]
        try:
            raw = row.get("completed_steps", "[]")
            completed_steps = json.loads(raw) if isinstance(raw, str) else raw or []
        except Exception:
            completed_steps = []
        if not isinstance(completed_steps, list) or not completed_steps:
            continue
        cur_step = row.get("current_step", 1)
        needs = False
        if 41 in completed_steps:
            completed_steps = [4 if s == 41 else s for s in completed_steps]
            seen = set()
            completed_steps = [s for s in completed_steps if not (s in seen or seen.add(s))]
            stats["step_41_replaced"] += 1
            needs = True
        if completed_steps:
            correct = max(completed_steps)
            if cur_step != correct:
                cur_step = correct
                needs = True
        if needs:
            ok = execute_insert(
                f"""
                UPDATE {table}
                SET completed_steps = %s, current_step = %s, updated_at = CURRENT_TIMESTAMP()
                WHERE session_id = %s
                """,
                (json.dumps(completed_steps), cur_step, sid),
            )
            if ok:
                stats["sessions_fixed"] += 1
    return stats


# =============================================================================
# Saved use cases (community library)
# =============================================================================


def _saved_uc_table() -> str:
    return _table_ident("saved_usecase_descriptions")


def save_usecase_builder_description(
    created_by: str,
    display_name: str,
    industry: str,
    use_case_name: str,
    description: str,
) -> Optional[int]:
    if not is_lakebase_configured():
        return None
    t = _saved_uc_table()
    ok = execute_insert(
        f"""
        INSERT INTO {t} (created_by, display_name, updated_by, industry, use_case_name, description)
        VALUES (%s, %s, %s, %s, %s, %s)
        """,
        (created_by, display_name, created_by, industry, use_case_name, description),
    )
    if not ok:
        return None
    rid = execute_query(
        f"""
        SELECT id FROM {t}
        WHERE created_by = %s AND use_case_name = %s AND description = %s
        ORDER BY id DESC
        LIMIT 1
        """,
        (created_by, use_case_name, description),
    )
    if rid:
        return int(rid[0]["id"])
    return None


def get_all_saved_usecases() -> List[Dict[str, Any]]:
    if not is_lakebase_configured():
        return []
    t = _saved_uc_table()
    rows = execute_query(
        f"""
        SELECT id, created_by, display_name, updated_by, industry, use_case_name,
               description, version, created_at, updated_at
        FROM {t}
        WHERE is_active = TRUE
        ORDER BY updated_at DESC
        """
    )
    results: List[Dict[str, Any]] = []
    for row in rows:
        results.append(
            {
                "id": row["id"],
                "created_by": row["created_by"],
                "display_name": row.get("display_name") or _format_display_name(row["created_by"]),
                "updated_by": row.get("updated_by"),
                "industry": row.get("industry"),
                "use_case_name": row.get("use_case_name"),
                "description": row.get("description"),
                "version": row.get("version"),
                "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
                "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
            }
        )
    return results


def update_saved_usecase(
    uc_id: int,
    updated_by: str,
    industry: Optional[str] = None,
    use_case_name: Optional[str] = None,
    description: Optional[str] = None,
) -> bool:
    if not is_lakebase_configured():
        return False
    t = _saved_uc_table()
    set_clauses = ["updated_by = %s", "updated_at = CURRENT_TIMESTAMP()"]
    params: List[Any] = [updated_by]
    if industry is not None:
        set_clauses.append("industry = %s")
        params.append(industry)
    if use_case_name is not None:
        set_clauses.append("use_case_name = %s")
        params.append(use_case_name)
    if description is not None:
        set_clauses.append("description = %s")
        params.append(description)
    params.append(uc_id)
    sql = f"""
    UPDATE {t}
    SET {', '.join(set_clauses)}
    WHERE id = %s AND is_active = TRUE
    """
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, tuple(params))
            rc = getattr(cur, "rowcount", None)
            try:
                cur.close()
            except Exception:
                pass
            return bool(rc and rc > 0)
    except Exception as e:
        logger.error("update_saved_usecase: %s", e, exc_info=True)
        return False


def delete_saved_usecase(uc_id: int) -> bool:
    if not is_lakebase_configured():
        return False
    t = _saved_uc_table()
    sql = f"""
        UPDATE {t}
        SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP()
        WHERE id = %s AND is_active = TRUE
        """
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, (uc_id,))
            rc = getattr(cur, "rowcount", None)
            try:
                cur.close()
            except Exception:
                pass
            return bool(rc and rc > 0)
    except Exception as e:
        logger.error("delete_saved_usecase: %s", e, exc_info=True)
        return False
