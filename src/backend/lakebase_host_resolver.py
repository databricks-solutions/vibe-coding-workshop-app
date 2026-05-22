"""
Resolve LAKEBASE_HOST at app startup from a deterministic ENDPOINT_NAME.

Lakebase Autoscaling endpoints follow the resource-path scheme
``projects/{project_id}/branches/{branch_id}/endpoints/{endpoint_id}``,
which is fully known at bundle deploy time (project name, branch name, and
the literal "primary" endpoint that Lakebase auto-creates per branch).

The resulting host (``ep-...database.<region>.cloud.databricks.com``) is
only assigned at provision time, so it cannot be hardcoded in app.yaml
without a second deploy. Instead, this module looks the host up once on
process start via the SDK and exports it as ``os.environ["LAKEBASE_HOST"]``,
keeping the rest of the app's env-var contract unchanged.

Idempotent: subsequent calls return the cached value. Safe no-op when
``ENDPOINT_NAME`` is unset (Provisioned mode) or already-set
``LAKEBASE_HOST`` (operator override).
"""

from __future__ import annotations

import logging
import os
from typing import Optional

logger = logging.getLogger("lakebase.host_resolver")

_resolved_host: Optional[str] = None


def resolve_and_export_lakebase_host() -> Optional[str]:
    """Resolve the Lakebase Autoscaling host and export to LAKEBASE_HOST.

    Returns the resolved host (also written to ``os.environ``) or None when
    resolution is skipped (no ENDPOINT_NAME set, or LAKEBASE_HOST already
    populated by an operator/resource link).
    """
    global _resolved_host

    if _resolved_host:
        return _resolved_host

    existing = os.environ.get("LAKEBASE_HOST", "").strip()
    if existing:
        logger.info(
            "LAKEBASE_HOST already set (%s...); skipping endpoint lookup",
            existing[:30],
        )
        _resolved_host = existing
        return existing

    endpoint_name = os.environ.get("ENDPOINT_NAME", "").strip()
    if not endpoint_name:
        logger.info("ENDPOINT_NAME unset; Provisioned mode -- skipping host resolution")
        return None

    try:
        from src.backend.identity import get_tagged_workspace_client

        client = get_tagged_workspace_client()
        endpoint = client.postgres.get_endpoint(name=endpoint_name)
    except Exception as exc:
        logger.warning(
            "Could not resolve Lakebase host from ENDPOINT_NAME=%s: %s",
            endpoint_name,
            exc,
        )
        return None

    host = ""
    try:
        host = (endpoint.status.hosts.host or "").strip()
    except AttributeError:
        host = ""

    if not host:
        logger.warning(
            "Endpoint %s returned no host (state=%s); LAKEBASE_HOST left unset",
            endpoint_name,
            getattr(getattr(endpoint, "status", None), "current_state", None),
        )
        return None

    os.environ["LAKEBASE_HOST"] = host
    _resolved_host = host
    logger.info(
        "Resolved LAKEBASE_HOST=%s from ENDPOINT_NAME=%s",
        host,
        endpoint_name,
    )
    return host
