"""
Verification Gate Registry

Implements independent verification that a real artifact exists in the Databricks
workspace, allowing the workshop app to confirm step completion without relying on
self-attestation or unreliable async signals.

Design constraints:
  - THREE outcome states: pass, fail, unknown (unknown on permission denied, SDK
    unavailable, timeout, or missing required parameter)
  - Timeout ~8s per check, ~15s per step
  - 60s TTL result cache keyed (session_id, section_tag)
  - All auth via App Service Principal only, no OBO
  - VERIFY_GATES_ENABLED env var kill switch
"""

import asyncio
import logging
import os
import time
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Kill switch: env VERIFY_GATES_ENABLED=false disables all checks (return unknown)
VERIFY_GATES_ENABLED = os.getenv("VERIFY_GATES_ENABLED", "true").lower() != "false"

# Per-check timeout (seconds)
CHECK_TIMEOUT_S = 8

# Result cache: (session_id, section_tag) -> {result, timestamp}
_verification_cache: Dict[tuple, Dict[str, Any]] = {}
CACHE_TTL_S = 60


def _cache_key(session_id: str, section_tag: str) -> tuple:
    """Return the cache key for a step."""
    return (session_id, section_tag)


def _get_cached_result(session_id: str, section_tag: str) -> Optional[Dict[str, Any]]:
    """Return cached result if fresh, else None."""
    key = _cache_key(session_id, section_tag)
    entry = _verification_cache.get(key)
    if entry and (time.time() - entry["timestamp"]) < CACHE_TTL_S:
        logger.info(f"[Verification] Cache hit for ({session_id}, {section_tag})")
        return entry["result"]
    return None


def _set_cached_result(session_id: str, section_tag: str, result: Dict[str, Any]) -> None:
    """Cache a result with current timestamp."""
    key = _cache_key(session_id, section_tag)
    _verification_cache[key] = {"result": result, "timestamp": time.time()}


def _state_is(state: Any, expected: str) -> bool:
    """
    Compare an SDK state against an expected name.

    The SDK returns str-valued Enums, and `ApplicationState.RUNNING == "RUNNING"` is
    False — comparing directly would report a perfectly healthy app as broken. Read
    `.value` when present, and accept a plain string so tests can pass either.
    """
    if state is None:
        return False
    actual = getattr(state, "value", state)
    return str(actual).upper() == expected.upper()


def _state_name(state: Any) -> str:
    """Human-readable state name for a hint, tolerating enum or string."""
    if state is None:
        return "UNKNOWN"
    return str(getattr(state, "value", state))


def _run_succeeded(run: Any) -> bool:
    """
    Did a job run finish successfully?

    `run.state` is a RunState dataclass, so comparing it to a string is always False.
    The verdict is `state.result_state == SUCCESS`; newer SDKs also expose a flattened
    `status`, so fall back to that when result_state is absent.
    """
    state = getattr(run, "state", None)
    if state is not None:
        result_state = getattr(state, "result_state", None)
        if result_state is not None:
            return _state_is(result_state, "SUCCESS")
        # A run still in flight has a life cycle but no result yet.
        life_cycle = getattr(state, "life_cycle_state", None)
        if life_cycle is not None:
            return False
    return _state_is(getattr(run, "status", None), "SUCCESS")


def _run_state_name(run: Any) -> str:
    """Readable run outcome for a hint."""
    state = getattr(run, "state", None)
    if state is not None:
        for attr in ("result_state", "life_cycle_state"):
            value = getattr(state, attr, None)
            if value is not None:
                return _state_name(value)
    return _state_name(getattr(run, "status", None))


# =============================================================================
# CHECK IMPLEMENTATIONS
# =============================================================================


async def _check_app_running(
    workspace_client: Any, params: Dict[str, str]
) -> Dict[str, Any]:
    """
    Check: app_running
    Verify app exists and is in RUNNING state with ACTIVE compute.

    Returns:
        {"name": "app_running", "ok": True|False|None, "detail": "..."}
    """
    try:
        app_name = params.get("user_app_name")
        if not app_name:
            return {
                "name": "app_running",
                "ok": None,
                "detail": "user_app_name not in session parameters",
            }

        app = workspace_client.apps.get(name=app_name)
        app_running = app.app_status and _state_is(app.app_status.state, "RUNNING")
        compute_active = app.compute_status and _state_is(app.compute_status.state, "ACTIVE")
        if app_running and compute_active:
            return {"name": "app_running", "ok": True, "detail": f"App '{app_name}' running"}
        else:
            app_state = _state_name(app.app_status.state) if app.app_status else "UNKNOWN"
            compute_state = _state_name(app.compute_status.state) if app.compute_status else "UNKNOWN"
            detail = (
                f"app '{app_name}' exists but is {app_state}/{compute_state} — "
                f"start it from the Apps page"
            )
            return {"name": "app_running", "ok": False, "detail": detail}
    except Exception as e:
        error_name = type(e).__name__
        if "PermissionDenied" in error_name or "Unauthenticated" in error_name:
            return {"name": "app_running", "ok": None, "detail": "Permission denied"}
        if "NotFound" in error_name or "not found" in str(e).lower():
            return {
                "name": "app_running",
                "ok": False,
                "detail": f"App '{params.get('user_app_name')}' does not exist — deploy it from the app.yaml",
            }
        logger.warning(f"[Verification] Error checking app_running: {e}")
        return {"name": "app_running", "ok": None, "detail": f"Error: {error_name}"}


async def _check_lakebase_project_exists(
    workspace_client: Any, params: Dict[str, str]
) -> Dict[str, Any]:
    """
    Check: lakebase_project_exists
    Verify a Lakebase/postgres project or database instance exists.

    Returns:
        {"name": "lakebase_project_exists", "ok": True|False|None, "detail": "..."}
    """
    try:
        instance_name = params.get("lakebase_instance_name")
        if not instance_name:
            return {
                "name": "lakebase_project_exists",
                "ok": None,
                "detail": "lakebase_instance_name not in parameters",
            }

        # Try to get the database via workspace client
        db = workspace_client.databases.get(full_name=instance_name)
        return {
            "name": "lakebase_project_exists",
            "ok": True,
            "detail": f"Lakebase instance '{instance_name}' accessible",
        }
    except Exception as e:
        error_name = type(e).__name__
        if "PermissionDenied" in error_name or "Unauthenticated" in error_name:
            return {"name": "lakebase_project_exists", "ok": None, "detail": "Permission denied"}
        if "NotFound" in error_name or "not found" in str(e).lower():
            return {
                "name": "lakebase_project_exists",
                "ok": False,
                "detail": f"Lakebase instance '{params.get('lakebase_instance_name')}' not found — create it from Lakebase console",
            }
        logger.warning(f"[Verification] Error checking lakebase_project_exists: {e}")
        return {"name": "lakebase_project_exists", "ok": None, "detail": f"Error: {error_name}"}


async def _check_uc_catalog_active(
    workspace_client: Any, params: Dict[str, str]
) -> Dict[str, Any]:
    """
    Check: uc_catalog_active
    Verify a Unity Catalog catalog exists and is active.

    Returns:
        {"name": "uc_catalog_active", "ok": True|False|None, "detail": "..."}
    """
    try:
        catalog_name = params.get("lakebase_uc_catalog_name")
        if not catalog_name:
            return {
                "name": "uc_catalog_active",
                "ok": None,
                "detail": "lakebase_uc_catalog_name not in parameters",
            }

        catalog = workspace_client.catalogs.get(name=catalog_name)
        return {
            "name": "uc_catalog_active",
            "ok": True,
            "detail": f"Catalog '{catalog_name}' is active in Unity Catalog",
        }
    except Exception as e:
        error_name = type(e).__name__
        if "PermissionDenied" in error_name or "Unauthenticated" in error_name:
            return {"name": "uc_catalog_active", "ok": None, "detail": "Permission denied"}
        if "NotFound" in error_name or "not found" in str(e).lower():
            return {
                "name": "uc_catalog_active",
                "ok": False,
                "detail": f"Catalog '{params.get('lakebase_uc_catalog_name')}' not registered in Unity Catalog — sync it from Lakebase",
            }
        logger.warning(f"[Verification] Error checking uc_catalog_active: {e}")
        return {"name": "uc_catalog_active", "ok": None, "detail": f"Error: {error_name}"}


async def _check_bronze_tables_exist(
    workspace_client: Any, params: Dict[str, str]
) -> Dict[str, Any]:
    """
    Check: bronze_tables_exist
    Verify bronze schema has at least one table.

    Returns:
        {"name": "bronze_tables_exist", "ok": True|False|None, "detail": "..."}
    """
    try:
        catalog = params.get("lakehouse_default_catalog")
        schema = params.get("user_schema_prefix")
        if not catalog or not schema:
            return {
                "name": "bronze_tables_exist",
                "ok": None,
                "detail": "lakehouse_default_catalog or user_schema_prefix missing",
            }

        bronze_schema = f"{schema}_bronze"
        tables = list(workspace_client.tables.list(catalog_name=catalog, schema_name=bronze_schema))
        if tables:
            return {
                "name": "bronze_tables_exist",
                "ok": True,
                "detail": f"Bronze schema '{bronze_schema}' has {len(tables)} table(s)",
            }
        else:
            return {
                "name": "bronze_tables_exist",
                "ok": False,
                "detail": f"Bronze schema '{bronze_schema}' is empty — run ingestion step",
            }
    except Exception as e:
        error_name = type(e).__name__
        if "PermissionDenied" in error_name or "Unauthenticated" in error_name:
            return {"name": "bronze_tables_exist", "ok": None, "detail": "Permission denied"}
        if "NotFound" in error_name or "not found" in str(e).lower():
            return {
                "name": "bronze_tables_exist",
                "ok": False,
                "detail": f"Bronze schema does not exist — create tables first",
            }
        logger.warning(f"[Verification] Error checking bronze_tables_exist: {e}")
        return {"name": "bronze_tables_exist", "ok": None, "detail": f"Error: {error_name}"}


async def _check_provisioned_tables_exist(
    workspace_client: Any, params: Dict[str, str]
) -> Dict[str, Any]:
    """
    Check: provisioned_tables_exist
    Verify the data pre-work actually produced tables the workshop can read.

    Covers both branches of step 59: an attendee who connected existing data and one
    whose agent generated a dataset both end up with `chapter_3_lakehouse_*` pointing at
    a schema, so this checks whichever they landed on.

    Two failure modes worth separating. A missing schema means the work did not happen.
    A schema with tables but a `dataset_status` still reporting `unset` means the tables
    exist but nobody told the workshop about them — the report_gate call was skipped — so
    every later step would silently read the product default instead. The second is the
    one that quietly ruins Chapter 3, and the hint says which it is.

    Returns:
        {"name": "provisioned_tables_exist", "ok": True|False|None, "detail": "..."}
    """
    name = "provisioned_tables_exist"
    try:
        catalog = params.get("chapter_3_lakehouse_catalog")
        schema = params.get("chapter_3_lakehouse_schema")
        if not catalog or not schema:
            return {
                "name": name,
                "ok": None,
                "detail": "No source catalog/schema resolved yet — set one on Step 10",
            }

        # Nothing has claimed a dataset, so catalog/schema are the product default. The
        # tables there DO exist, so a bare table check would pass and give false comfort.
        if params.get("dataset_status") == "unset":
            return {
                "name": name,
                "ok": False,
                "detail": (
                    f"Still pointing at the workshop default ({catalog}.{schema}). "
                    f"Connect your own tables on Step 10, or have your agent call "
                    f"report_gate with the catalog and schema it generated."
                ),
            }

        tables = list(
            workspace_client.tables.list(catalog_name=catalog, schema_name=schema)
        )
        if not tables:
            return {
                "name": name,
                "ok": False,
                "detail": f"{catalog}.{schema} has no tables — generation may have failed part-way",
            }

        return {
            "name": name,
            "ok": True,
            "detail": f"{catalog}.{schema} has {len(tables)} table(s)",
        }
    except Exception as e:
        error_name = type(e).__name__
        if "PermissionDenied" in error_name or "Unauthenticated" in error_name:
            # The App SP often cannot see an attendee's own catalog, and that must never
            # block them — unknown, not fail.
            return {
                "name": name,
                "ok": None,
                "detail": "Cannot see that catalog from the workshop app — carry on if the tables are there",
            }
        if "NotFound" in error_name or "not found" in str(e).lower():
            return {
                "name": name,
                "ok": False,
                "detail": "That schema does not exist yet — connect or generate your dataset first",
            }
        logger.warning(f"[Verification] Error checking {name}: {e}")
        return {"name": name, "ok": None, "detail": f"Error: {error_name}"}


async def _check_silver_pipeline_succeeded(
    workspace_client: Any, params: Dict[str, str]
) -> Dict[str, Any]:
    """
    Check: silver_pipeline_succeeded
    Verify silver schema exists AND latest pipeline update state is COMPLETED.

    Returns:
        {"name": "silver_pipeline_succeeded", "ok": True|False|None, "detail": "..."}
    """
    try:
        catalog = params.get("lakehouse_default_catalog")
        schema = params.get("user_schema_prefix")
        if not catalog or not schema:
            return {
                "name": "silver_pipeline_succeeded",
                "ok": None,
                "detail": "lakehouse_default_catalog or user_schema_prefix missing",
            }

        silver_schema = f"{schema}_silver"

        # First check silver tables exist
        tables = list(workspace_client.tables.list(catalog_name=catalog, schema_name=silver_schema))
        if not tables:
            return {
                "name": "silver_pipeline_succeeded",
                "ok": False,
                "detail": f"Silver schema '{silver_schema}' is empty — run pipeline",
            }

        # Now check if a pipeline with matching name exists and succeeded
        # Look for a pipeline job named something like "{schema}_silver" or similar
        jobs = list(workspace_client.jobs.list())
        matching_jobs = [j for j in jobs if schema in (j.settings.name or "").lower()]

        if not matching_jobs:
            return {
                "name": "silver_pipeline_succeeded",
                "ok": False,
                "detail": f"No pipeline job found for '{schema}' — create a Silver layer pipeline",
            }

        # Check latest run of matching jobs
        job = matching_jobs[0]
        runs = list(workspace_client.jobs.list_runs(job_id=job.job_id))
        if not runs:
            return {
                "name": "silver_pipeline_succeeded",
                "ok": False,
                "detail": f"Pipeline exists but has no runs — trigger it",
            }

        latest_run = runs[0]
        # jobs.list_runs returns a RunState dataclass, not a bare state — the outcome
        # lives in result_state, and SUCCESS is the only clean pass.
        if _run_succeeded(latest_run):
            return {
                "name": "silver_pipeline_succeeded",
                "ok": True,
                "detail": f"Pipeline '{job.settings.name}' latest run completed",
            }
        else:
            return {
                "name": "silver_pipeline_succeeded",
                "ok": False,
                "detail": f"Pipeline latest run is {_run_state_name(latest_run)} — wait or troubleshoot",
            }
    except Exception as e:
        error_name = type(e).__name__
        if "PermissionDenied" in error_name or "Unauthenticated" in error_name:
            return {"name": "silver_pipeline_succeeded", "ok": None, "detail": "Permission denied"}
        logger.warning(f"[Verification] Error checking silver_pipeline_succeeded: {e}")
        return {"name": "silver_pipeline_succeeded", "ok": None, "detail": f"Error: {error_name}"}


async def _check_gold_tables_exist(
    workspace_client: Any, params: Dict[str, str]
) -> Dict[str, Any]:
    """
    Check: gold_tables_exist
    Verify gold tables exist AND the most recent relevant job run succeeded.

    Returns:
        {"name": "gold_tables_exist", "ok": True|False|None, "detail": "..."}
    """
    try:
        catalog = params.get("lakehouse_default_catalog")
        schema = params.get("user_schema_prefix")
        if not catalog or not schema:
            return {
                "name": "gold_tables_exist",
                "ok": None,
                "detail": "lakehouse_default_catalog or user_schema_prefix missing",
            }

        gold_schema = f"{schema}_gold"

        # Check gold tables exist
        tables = list(workspace_client.tables.list(catalog_name=catalog, schema_name=gold_schema))
        if not tables:
            return {
                "name": "gold_tables_exist",
                "ok": False,
                "detail": f"Gold schema '{gold_schema}' is empty — run Gold pipeline",
            }

        # Look for matching job
        jobs = list(workspace_client.jobs.list())
        matching_jobs = [
            j for j in jobs if schema in (j.settings.name or "").lower() and "gold" in (j.settings.name or "").lower()
        ]

        if not matching_jobs:
            return {
                "name": "gold_tables_exist",
                "ok": False,
                "detail": f"Gold tables exist but no Gold pipeline found — create and run it",
            }

        job = matching_jobs[0]
        runs = list(workspace_client.jobs.list_runs(job_id=job.job_id))
        if not runs:
            return {
                "name": "gold_tables_exist",
                "ok": False,
                "detail": f"Gold pipeline exists but has no runs — trigger it",
            }

        latest_run = runs[0]
        if _run_succeeded(latest_run):
            return {
                "name": "gold_tables_exist",
                "ok": True,
                "detail": f"Gold tables populated by pipeline '{job.settings.name}'",
            }
        else:
            return {
                "name": "gold_tables_exist",
                "ok": False,
                "detail": f"Gold pipeline latest run is {_run_state_name(latest_run)} — wait or troubleshoot",
            }
    except Exception as e:
        error_name = type(e).__name__
        if "PermissionDenied" in error_name or "Unauthenticated" in error_name:
            return {"name": "gold_tables_exist", "ok": None, "detail": "Permission denied"}
        logger.warning(f"[Verification] Error checking gold_tables_exist: {e}")
        return {"name": "gold_tables_exist", "ok": None, "detail": f"Error: {error_name}"}


async def _check_genie_space_exists(
    workspace_client: Any, params: Dict[str, str]
) -> Dict[str, Any]:
    """
    Check: genie_space_exists
    Verify a Genie space exists matching user's schema prefix or captured genie space id.

    Returns:
        {"name": "genie_space_exists", "ok": True|False|None, "detail": "..."}
    """
    try:
        schema_prefix = params.get("user_schema_prefix")
        genie_space_id = params.get("genie_space_id")

        if genie_space_id:
            # Check by ID
            try:
                space = workspace_client.genie.get_space(space_id=genie_space_id)
                return {
                    "name": "genie_space_exists",
                    "ok": True,
                    "detail": f"Genie space '{space.name}' exists",
                }
            except Exception:
                pass

        if schema_prefix:
            # Check by name pattern
            spaces = list(workspace_client.genie.list_spaces())
            for space in spaces:
                if schema_prefix in (space.name or "").lower():
                    return {
                        "name": "genie_space_exists",
                        "ok": True,
                        "detail": f"Genie space '{space.name}' exists",
                    }

        return {
            "name": "genie_space_exists",
            "ok": False,
            "detail": "No Genie space found — create one from the Genie console",
        }
    except Exception as e:
        error_name = type(e).__name__
        if "PermissionDenied" in error_name or "Unauthenticated" in error_name:
            return {"name": "genie_space_exists", "ok": None, "detail": "Permission denied"}
        logger.warning(f"[Verification] Error checking genie_space_exists: {e}")
        return {"name": "genie_space_exists", "ok": None, "detail": f"Error: {error_name}"}


async def _check_serving_endpoint_ready(
    workspace_client: Any, params: Dict[str, str]
) -> Dict[str, Any]:
    """
    Check: serving_endpoint_ready
    Verify a serving endpoint exists and is READY.

    Returns:
        {"name": "serving_endpoint_ready", "ok": True|False|None, "detail": "..."}
    """
    try:
        endpoint_name = params.get("agent_serving_endpoint_name")
        if not endpoint_name:
            return {
                "name": "serving_endpoint_ready",
                "ok": None,
                "detail": "agent_serving_endpoint_name not in parameters",
            }

        endpoint = workspace_client.serving_endpoints.get(name=endpoint_name)
        # `state.ready` is an EndpointStateReady enum, and NOT_READY is truthy — a
        # bare truthiness test would call a broken endpoint healthy.
        if endpoint.state and _state_is(endpoint.state.ready, "READY"):
            return {
                "name": "serving_endpoint_ready",
                "ok": True,
                "detail": f"Endpoint '{endpoint_name}' is READY",
            }
        else:
            state_str = _state_name(endpoint.state.ready) if endpoint.state else "UNKNOWN"
            return {
                "name": "serving_endpoint_ready",
                "ok": False,
                "detail": f"Endpoint '{endpoint_name}' is {state_str} — wait for it to become READY",
            }
    except Exception as e:
        error_name = type(e).__name__
        if "PermissionDenied" in error_name or "Unauthenticated" in error_name:
            return {"name": "serving_endpoint_ready", "ok": None, "detail": "Permission denied"}
        if "NotFound" in error_name or "not found" in str(e).lower():
            return {
                "name": "serving_endpoint_ready",
                "ok": False,
                "detail": f"Endpoint '{params.get('agent_serving_endpoint_name')}' not found — deploy it",
            }
        logger.warning(f"[Verification] Error checking serving_endpoint_ready: {e}")
        return {"name": "serving_endpoint_ready", "ok": None, "detail": f"Error: {error_name}"}


# Registry of check functions keyed by check name
_CHECK_REGISTRY = {
    "app_running": _check_app_running,
    "lakebase_project_exists": _check_lakebase_project_exists,
    "uc_catalog_active": _check_uc_catalog_active,
    "provisioned_tables_exist": _check_provisioned_tables_exist,
    "bronze_tables_exist": _check_bronze_tables_exist,
    "silver_pipeline_succeeded": _check_silver_pipeline_succeeded,
    "gold_tables_exist": _check_gold_tables_exist,
    "genie_space_exists": _check_genie_space_exists,
    "serving_endpoint_ready": _check_serving_endpoint_ready,
}


# =============================================================================
# PUBLIC API
# =============================================================================


async def verify_step(
    workspace_client: Any,
    session_id: str,
    section_tag: str,
    check_key: str,
    params: Dict[str, str],
    force: bool = False,
) -> Dict[str, Any]:
    """
    Run a single verification check with timeout and caching.

    Args:
        workspace_client: Databricks WorkspaceClient (App SP only, not OBO)
        session_id: Session ID for caching
        section_tag: Section tag for caching
        check_key: Name of check to run (must be in _CHECK_REGISTRY)
        params: Resolved workshop + session parameters
        force: If True, bypass cache

    Returns:
        {
            "name": check_key,
            "ok": True|False|None,  # None means unknown (permission denied, timeout, etc)
            "detail": "human-actionable hint"
        }
    """
    # Kill switch
    if not VERIFY_GATES_ENABLED:
        logger.info(f"[Verification] Kill switch active (VERIFY_GATES_ENABLED=false)")
        return {
            "name": check_key,
            "ok": None,
            "detail": "Verification disabled",
        }

    # Check cache (unless force=true)
    if not force:
        cached = _get_cached_result(session_id, section_tag)
        if cached:
            # Find this check's result in the cached per-step result
            for check in cached.get("checks", []):
                if check.get("name") == check_key:
                    return check

    # Get check function
    check_fn = _CHECK_REGISTRY.get(check_key)
    if not check_fn:
        return {
            "name": check_key,
            "ok": None,
            "detail": f"Unknown check: {check_key}",
        }

    # Run with timeout
    try:
        result = await asyncio.wait_for(
            check_fn(workspace_client, params),
            timeout=CHECK_TIMEOUT_S,
        )
        return result
    except asyncio.TimeoutError:
        logger.warning(f"[Verification] Check {check_key} timed out after {CHECK_TIMEOUT_S}s")
        return {
            "name": check_key,
            "ok": None,
            "detail": "Check timed out",
        }
    except Exception as e:
        logger.error(f"[Verification] Unexpected error in {check_key}: {e}")
        return {
            "name": check_key,
            "ok": None,
            "detail": f"Unexpected error: {type(e).__name__}",  # verify_step_checks catches this
        }


async def verify_step_checks(
    workspace_client: Any,
    session_id: str,
    section_tag: str,
    check_keys: List[str],
    params: Dict[str, str],
    force: bool = False,
) -> Dict[str, Any]:
    """
    Run multiple checks for a step and return aggregated result with per-check details.

    Args:
        workspace_client: Databricks WorkspaceClient (App SP only)
        session_id: Session ID
        section_tag: Section tag
        check_keys: List of check keys to run
        params: Resolved workshop + session parameters
        force: If True, bypass cache

    Returns:
        {
            "status": "pass" | "fail" | "unknown",
            "method": "workspace" | "agent_reported" | "self_attested" | "none",
            "checks": [
                {"name": key, "ok": True|False|None, "detail": "..."},
                ...
            ],
            "hint": "human-actionable next step",
            "cached_at": timestamp or None,
            "ttl_s": 60
        }
    """
    # Kill switch
    if not VERIFY_GATES_ENABLED:
        return {
            "status": "unknown",
            "method": "workspace",
            "checks": [],
            "hint": "Verification disabled",
            "cached_at": None,
            "ttl_s": CACHE_TTL_S,
        }

    # Check cache (unless force=true)
    cached_at = None
    if not force:
        cached = _get_cached_result(session_id, section_tag)
        if cached:
            return cached

    # Run all checks in parallel with individual timeouts
    checks = []
    for check_key in check_keys:
        check_result = await verify_step(
            workspace_client, session_id, section_tag, check_key, params, force=True
        )
        checks.append(check_result)

    # Aggregate status:
    # - pass: all ok=True
    # - fail: any ok=False
    # - unknown: otherwise (all None, or mix of None and True)
    all_ok_true = all(c.get("ok") is True for c in checks)
    any_ok_false = any(c.get("ok") is False for c in checks)

    if all_ok_true:
        status = "pass"
    elif any_ok_false:
        status = "fail"
    else:
        status = "unknown"

    # Build hint from first failure or unknown
    hint = ""
    for check in checks:
        if check.get("ok") is False or (status == "unknown" and check.get("ok") is None):
            hint = check.get("detail", "Step not completed yet")
            break

    now = time.time()
    result = {
        "status": status,
        "method": "workspace",
        "checks": checks,
        "hint": hint,
        "cached_at": now,
        "ttl_s": CACHE_TTL_S,
    }

    # Cache it
    _set_cached_result(session_id, section_tag, result)

    return result
