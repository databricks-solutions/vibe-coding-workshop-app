"""
Database service routing layer.

Delegates to ``lakebase`` (PostgreSQL / Lakebase) or ``dbsql_backend`` (Databricks SQL)
based on the ``DB_BACKEND`` environment variable.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

DB_BACKEND = os.getenv("DB_BACKEND", "lakebase").strip().lower() or "lakebase"

_backend = None  # type: ignore
# Set to True on first successful lazy import inside _get_backend().
DB_SERVICE_AVAILABLE = False


def _get_backend():
    """Lazily load and cache the active backend module."""
    global _backend, DB_SERVICE_AVAILABLE
    if _backend is not None:
        return _backend
    try:
        if DB_BACKEND == "dbsql":
            from src.backend.services import dbsql_backend as mod
        else:
            from src.backend.services import lakebase as mod
        _backend = mod
        DB_SERVICE_AVAILABLE = True
    except ImportError as e:
        logger.warning("Backend '%s' not available: %s", DB_BACKEND, e)
        DB_SERVICE_AVAILABLE = False
        _backend = None
    return _backend


def get_backend_type() -> str:
    """Return *lakebase* or *dbsql* (normalized from ``DB_BACKEND``)."""
    return "dbsql" if DB_BACKEND == "dbsql" else "lakebase"


def _is_configured_impl() -> bool:
    b = _get_backend()
    if b is None:
        return False
    fn = getattr(b, "is_lakebase_configured", None)
    if callable(fn):
        return bool(fn())
    fn = getattr(b, "is_configured", None)
    if callable(fn):
        return bool(fn())
    return False


def is_configured() -> bool:
    """True if the active backend reports a valid configuration."""
    return _is_configured_impl()


def is_lakebase_configured() -> bool:
    """Backward-compatible alias for :func:`is_configured` (name retained for imports)."""
    return _is_configured_impl()


def execute_query(sql: str, params: tuple = None) -> List[Dict]:
    backend = _get_backend()
    if backend is None:
        return []
    return backend.execute_query(sql, params)


def execute_insert(sql: str, params: tuple = None) -> bool:
    backend = _get_backend()
    if backend is None:
        return False
    return backend.execute_insert(sql, params)


def get_schema() -> str:
    backend = _get_backend()
    if backend is None:
        return os.getenv("LAKEBASE_SCHEMA", "")
    return backend.get_schema()


def get_connection():
    """Return the active backend’s connection context manager (caller: ``with get_connection() as conn``)."""
    backend = _get_backend()
    if backend is None:
        raise RuntimeError("Database backend not available")
    cm_factory = getattr(backend, "get_connection", None)
    if cm_factory is None:
        raise RuntimeError("Backend does not expose get_connection()")
    return cm_factory()


def get_create_tables_ddl() -> str:
    backend = _get_backend()
    if backend is None:
        return ""
    fn = getattr(backend, "get_create_tables_ddl", None)
    if not callable(fn):
        return ""
    return fn()


def get_connection_status(*args, **kwargs):
    """Return connection status dict if the backend implements ``get_connection_status``."""
    backend = _get_backend()
    if backend is None:
        return {"ok": False, "error": "backend not loaded"}
    fn = getattr(backend, "get_connection_status", None)
    if not callable(fn):
        return None
    return fn(*args, **kwargs)


def _call_or_default(fn_name: str, args, kwargs, default):
    backend = _get_backend()
    if backend is None:
        return default
    fn = getattr(backend, fn_name, None)
    if not callable(fn):
        logger.warning("Backend %s has no %r", DB_BACKEND, fn_name)
        return default
    return fn(*args, **kwargs)


def save_session(*args, **kwargs):
    return _call_or_default("save_session", args, kwargs, False)


def load_session(*args, **kwargs):
    return _call_or_default("load_session", args, kwargs, None)


def delete_session(*args, **kwargs):
    return _call_or_default("delete_session", args, kwargs, False)


def get_user_sessions(*args, **kwargs):
    return _call_or_default("get_user_sessions", args, kwargs, [])


def get_user_default_session(*args, **kwargs):
    return _call_or_default("get_user_default_session", args, kwargs, None)


def delete_user_unsaved_sessions(*args, **kwargs):
    return _call_or_default("delete_user_unsaved_sessions", args, kwargs, 0)


def update_step_prompt(*args, **kwargs):
    return _call_or_default("update_step_prompt", args, kwargs, False)


def save_chapter_feedback(*args, **kwargs):
    return _call_or_default("save_chapter_feedback", args, kwargs, False)


def get_leaderboard(*args, **kwargs):
    return _call_or_default("get_leaderboard", args, kwargs, [])


def get_workshop_users(*args, **kwargs):
    return _call_or_default("get_workshop_users", args, kwargs, {})


def get_analytics(*args, **kwargs):
    return _call_or_default("get_analytics", args, kwargs, {})


def cleanup_session_steps(*args, **kwargs):
    return _call_or_default(
        "cleanup_session_steps", args, kwargs, {"sessions_fixed": 0, "step_41_replaced": 0}
    )


def save_usecase_builder_description(*args, **kwargs):
    return _call_or_default("save_usecase_builder_description", args, kwargs, None)


def get_all_saved_usecases(*args, **kwargs):
    return _call_or_default("get_all_saved_usecases", args, kwargs, [])


def update_saved_usecase(*args, **kwargs):
    return _call_or_default("update_saved_usecase", args, kwargs, False)


def delete_saved_usecase(*args, **kwargs):
    return _call_or_default("delete_saved_usecase", args, kwargs, False)


def __getattr__(name: str) -> Any:
    """Lazy ``PSYCOPG2_AVAILABLE`` from the loaded backend (PEP 562)."""
    if name == "PSYCOPG2_AVAILABLE":
        b = _get_backend()
        return bool(getattr(b, "PSYCOPG2_AVAILABLE", False)) if b else False
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


# ---------------------------------------------------------------------------
# Dialect-specific SQL helpers
# ---------------------------------------------------------------------------

def _json_arg_to_obj(json_data: Any) -> Dict[str, Any]:
    if json_data is None:
        return {}
    if isinstance(json_data, dict):
        return dict(json_data)
    if isinstance(json_data, str):
        try:
            return json.loads(json_data)
        except json.JSONDecodeError:
            return {}
    return {}


def get_latest_usecase_descriptions(schema: str) -> List[Dict]:
    """DISTINCT ON / ROW_NUMBER — latest version per (industry, use_case), active only."""
    if DB_BACKEND == "dbsql":
        sql = f"""
            SELECT industry, industry_label, use_case, use_case_label, prompt_template, version
            FROM (
                SELECT industry, industry_label, use_case, use_case_label, prompt_template, version,
                       ROW_NUMBER() OVER (
                           PARTITION BY industry, use_case ORDER BY version DESC
                       ) AS rn
                FROM {schema}.usecase_descriptions
                WHERE is_active = TRUE
            ) t
            WHERE rn = 1
        """
    else:
        sql = f"""
            SELECT DISTINCT ON (industry, use_case)
                industry, industry_label, use_case, use_case_label, prompt_template, version
            FROM {schema}.usecase_descriptions
            WHERE is_active = TRUE
            ORDER BY industry, use_case, version DESC
        """
    return execute_query(sql)


def get_latest_section_input_prompts(schema: str) -> List[Dict]:
    """DISTINCT ON / ROW_NUMBER — latest version per section_tag, active only."""
    if DB_BACKEND == "dbsql":
        sql = f"""
            SELECT section_tag, input_template, system_prompt, section_title, section_description,
                   order_number, version, how_to_apply, expected_output, bypass_llm,
                   how_to_apply_images, expected_output_images
            FROM (
                SELECT section_tag, input_template, system_prompt, section_title, section_description,
                       order_number, version, how_to_apply, expected_output, bypass_llm,
                       how_to_apply_images, expected_output_images,
                       ROW_NUMBER() OVER (PARTITION BY section_tag ORDER BY version DESC) AS rn
                FROM {schema}.section_input_prompts
                WHERE is_active = TRUE
            ) t
            WHERE rn = 1
        """
    else:
        sql = f"""
            SELECT DISTINCT ON (section_tag)
                section_tag, input_template, system_prompt, section_title, section_description,
                order_number, version, how_to_apply, expected_output, bypass_llm,
                how_to_apply_images, expected_output_images
            FROM {schema}.section_input_prompts
            WHERE is_active = TRUE
            ORDER BY section_tag, version DESC
        """
    return execute_query(sql)


def get_latest_prompt_configs(schema: str) -> List[Dict]:
    """Latest version per (industry, use_case) with formatted timestamps (all rows, any is_active)."""
    if DB_BACKEND == "dbsql":
        sql = f"""
            SELECT config_id, industry, industry_label, use_case, use_case_label,
                   prompt_template, version, is_active,
                   date_format(inserted_at, 'yyyy-MM-dd HH:mm:ss') AS inserted_at,
                   date_format(updated_at, 'yyyy-MM-dd HH:mm:ss') AS updated_at,
                   created_by
            FROM (
                SELECT config_id, industry, industry_label, use_case, use_case_label,
                       prompt_template, version, is_active, inserted_at, updated_at, created_by,
                       ROW_NUMBER() OVER (
                           PARTITION BY industry, use_case ORDER BY version DESC
                       ) AS rn
                FROM {schema}.usecase_descriptions
            ) t
            WHERE rn = 1
        """
    else:
        sql = f"""
            SELECT DISTINCT ON (industry, use_case)
                config_id, industry, industry_label, use_case, use_case_label,
                prompt_template, version, is_active,
                TO_CHAR(inserted_at, 'YYYY-MM-DD HH24:MI:SS') AS inserted_at,
                TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at,
                created_by
            FROM {schema}.usecase_descriptions
            ORDER BY industry, use_case, version DESC
        """
    return execute_query(sql)


def get_prompt_config_versions(schema: str, industry: str, use_case: str) -> List[Dict]:
    """Version listing with formatted timestamps."""
    if DB_BACKEND == "dbsql":
        sql = f"""
            SELECT version,
                   date_format(inserted_at, 'yyyy-MM-dd HH:mm:ss') AS inserted_at,
                   date_format(updated_at, 'yyyy-MM-dd HH:mm:ss') AS updated_at,
                   created_by, is_active
            FROM {schema}.usecase_descriptions
            WHERE industry = %s AND use_case = %s
            ORDER BY version DESC
            LIMIT 5
        """
    else:
        sql = f"""
            SELECT version,
                   TO_CHAR(inserted_at, 'YYYY-MM-DD HH24:MI:SS') AS inserted_at,
                   TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at,
                   created_by, is_active
            FROM {schema}.usecase_descriptions
            WHERE industry = %s AND use_case = %s
            ORDER BY version DESC
            LIMIT 5
        """
    return execute_query(sql, (industry, use_case))


def get_prompt_config_by_version(
    schema: str, industry: str, use_case: str, version: int
) -> List[Dict]:
    """Single prompt config version with formatted timestamps."""
    if DB_BACKEND == "dbsql":
        sql = f"""
            SELECT config_id, industry, industry_label, use_case, use_case_label,
                   prompt_template, version, is_active,
                   date_format(inserted_at, 'yyyy-MM-dd HH:mm:ss') AS inserted_at,
                   date_format(updated_at, 'yyyy-MM-dd HH:mm:ss') AS updated_at,
                   created_by
            FROM {schema}.usecase_descriptions
            WHERE industry = %s AND use_case = %s AND version = %s
        """
    else:
        sql = f"""
            SELECT config_id, industry, industry_label, use_case, use_case_label,
                   prompt_template, version, is_active,
                   TO_CHAR(inserted_at, 'YYYY-MM-DD HH24:MI:SS') AS inserted_at,
                   TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at,
                   created_by
            FROM {schema}.usecase_descriptions
            WHERE industry = %s AND use_case = %s AND version = %s
        """
    return execute_query(sql, (industry, use_case, version))


def get_latest_section_inputs(schema: str) -> List[Dict]:
    """Latest active section inputs with formatted timestamps."""
    if DB_BACKEND == "dbsql":
        sql = f"""
            SELECT input_id, section_tag, section_title, section_description,
                   input_template, system_prompt, order_number, how_to_apply, expected_output,
                   how_to_apply_images, expected_output_images,
                   bypass_llm, step_enabled,
                   version, is_active,
                   date_format(inserted_at, 'yyyy-MM-dd HH:mm:ss') AS inserted_at,
                   date_format(updated_at, 'yyyy-MM-dd HH:mm:ss') AS updated_at,
                   created_by
            FROM (
                SELECT input_id, section_tag, section_title, section_description,
                       input_template, system_prompt, order_number, how_to_apply, expected_output,
                       how_to_apply_images, expected_output_images,
                       bypass_llm, step_enabled,
                       version, is_active, inserted_at, updated_at, created_by,
                       ROW_NUMBER() OVER (PARTITION BY section_tag ORDER BY version DESC) AS rn
                FROM {schema}.section_input_prompts
                WHERE is_active = TRUE
            ) t
            WHERE rn = 1
        """
    else:
        sql = f"""
            SELECT DISTINCT ON (section_tag)
                input_id, section_tag, section_title, section_description,
                input_template, system_prompt, order_number, how_to_apply, expected_output,
                how_to_apply_images, expected_output_images,
                bypass_llm, step_enabled,
                version, is_active,
                TO_CHAR(inserted_at, 'YYYY-MM-DD HH24:MI:SS') AS inserted_at,
                TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at,
                created_by
            FROM {schema}.section_input_prompts
            WHERE is_active = TRUE
            ORDER BY section_tag, version DESC
        """
    return execute_query(sql)


def get_section_input_versions(schema: str, section_tag: str) -> List[Dict]:
    """Section input version listing."""
    if DB_BACKEND == "dbsql":
        sql = f"""
            SELECT version,
                   date_format(inserted_at, 'yyyy-MM-dd HH:mm:ss') AS inserted_at,
                   date_format(updated_at, 'yyyy-MM-dd HH:mm:ss') AS updated_at,
                   created_by, is_active
            FROM {schema}.section_input_prompts
            WHERE section_tag = %s
            ORDER BY version DESC
            LIMIT 5
        """
    else:
        sql = f"""
            SELECT version,
                   TO_CHAR(inserted_at, 'YYYY-MM-DD HH24:MI:SS') AS inserted_at,
                   TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at,
                   created_by, is_active
            FROM {schema}.section_input_prompts
            WHERE section_tag = %s
            ORDER BY version DESC
            LIMIT 5
        """
    return execute_query(sql, (section_tag,))


def get_section_input_by_version(
    schema: str, section_tag: str, version: int
) -> List[Dict]:
    """Single section input version."""
    if DB_BACKEND == "dbsql":
        sql = f"""
            SELECT input_id, section_tag, section_title, section_description,
                   input_template, system_prompt, order_number, how_to_apply, expected_output,
                   how_to_apply_images, expected_output_images,
                   bypass_llm,
                   version, is_active,
                   date_format(inserted_at, 'yyyy-MM-dd HH:mm:ss') AS inserted_at,
                   date_format(updated_at, 'yyyy-MM-dd HH:mm:ss') AS updated_at,
                   created_by
            FROM {schema}.section_input_prompts
            WHERE section_tag = %s AND version = %s
        """
    else:
        sql = f"""
            SELECT input_id, section_tag, section_title, section_description,
                   input_template, system_prompt, order_number, how_to_apply, expected_output,
                   how_to_apply_images, expected_output_images,
                   bypass_llm,
                   version, is_active,
                   TO_CHAR(inserted_at, 'YYYY-MM-DD HH24:MI:SS') AS inserted_at,
                   TO_CHAR(updated_at, 'YYYY-MM-DD HH24:MI:SS') AS updated_at,
                   created_by
            FROM {schema}.section_input_prompts
            WHERE section_tag = %s AND version = %s
        """
    return execute_query(sql, (section_tag, version))


def merge_session_json_field(schema: str, session_id: str, json_data: Any) -> bool:
    """Merge JSON into ``session_parameters`` (PG jsonb || vs DBSQL read-modify-write)."""
    patch = _json_arg_to_obj(json_data)
    if not patch:
        return True
    payload = json.dumps(patch)
    if DB_BACKEND == "dbsql":
        rows = execute_query(
            f"SELECT COALESCE(session_parameters, '{{}}') AS sp FROM {schema}.sessions WHERE session_id = %s",
            (session_id,),
        )
        raw = rows[0]["sp"] if rows else "{}"
        current = _json_arg_to_obj(raw)
        merged = {**current, **patch}
        return execute_insert(
            f"UPDATE {schema}.sessions SET session_parameters = %s, updated_at = CURRENT_TIMESTAMP "
            f"WHERE session_id = %s",
            (json.dumps(merged), session_id),
        )
    return execute_insert(
        f"UPDATE {schema}.sessions SET session_parameters = COALESCE(session_parameters, '{{}}'::jsonb) "
        f"|| %s::jsonb, updated_at = CURRENT_TIMESTAMP WHERE session_id = %s",
        (payload, session_id),
    )


def update_session_metadata_json(schema: str, session_id: str, json_data: Any) -> bool:
    """Merge JSON into ``session_parameters`` for metadata-style updates."""
    return merge_session_json_field(schema, session_id, json_data)


def update_section_images_json(
    schema: str, section_tag: str, column: str, json_data: Any
) -> bool:
    """Update a JSON image column on active rows for ``section_tag``."""
    if column not in ("how_to_apply_images", "expected_output_images"):
        logger.warning("Unexpected section image column: %s", column)
    blob = json_data if isinstance(json_data, str) else json.dumps(json_data)
    if DB_BACKEND == "dbsql":
        return execute_insert(
            f"UPDATE {schema}.section_input_prompts SET {column} = %s, updated_at = CURRENT_TIMESTAMP "
            f"WHERE section_tag = %s AND is_active = TRUE",
            (blob, section_tag),
        )
    return execute_insert(
        f"UPDATE {schema}.section_input_prompts SET {column} = %s::jsonb, updated_at = CURRENT_TIMESTAMP "
        f"WHERE section_tag = %s AND is_active = TRUE",
        (blob, section_tag),
    )


__all__ = [
    "DB_BACKEND",
    "DB_SERVICE_AVAILABLE",
    "PSYCOPG2_AVAILABLE",
    "cleanup_session_steps",
    "delete_saved_usecase",
    "delete_session",
    "delete_user_unsaved_sessions",
    "execute_insert",
    "execute_query",
    "get_all_saved_usecases",
    "get_analytics",
    "get_backend_type",
    "get_connection",
    "get_connection_status",
    "get_create_tables_ddl",
    "get_latest_prompt_configs",
    "get_latest_section_input_prompts",
    "get_latest_section_inputs",
    "get_latest_usecase_descriptions",
    "get_leaderboard",
    "get_prompt_config_by_version",
    "get_prompt_config_versions",
    "get_schema",
    "get_section_input_by_version",
    "get_section_input_versions",
    "get_user_default_session",
    "get_user_sessions",
    "get_workshop_users",
    "is_configured",
    "is_lakebase_configured",
    "load_session",
    "merge_session_json_field",
    "save_chapter_feedback",
    "save_session",
    "save_usecase_builder_description",
    "update_saved_usecase",
    "update_section_images_json",
    "update_session_metadata_json",
    "update_step_prompt",
]
