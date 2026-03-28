"""
Product identity and User-Agent utilities for telemetry via system.access.audit.

Modeled after the Databricks AI Dev Kit's identity.py pattern:
  - Static PRODUCT_NAME / PRODUCT_VERSION set once at import time
  - _sanitize() keeps User-Agent tokens safe (same regex as AI Dev Kit)
  - build_user_agent() constructs per-request UA strings with optional workflow context
  - get_workspace_client() returns a tagged WorkspaceClient singleton helper
"""

import logging
import re
import sys
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

PRODUCT_NAME = "vibe-to-value-workshop"


def _load_version() -> str:
    """Load version from the project-root VERSION file.

    Walks up from this file's directory (src/backend/) looking for a VERSION
    file.  Returns "0.0.0-dev" if not found so the app never crashes on a
    missing version.
    """
    fallback = "0.0.0-dev"
    try:
        d = Path(__file__).resolve().parent
        for _ in range(5):
            candidate = d / "VERSION"
            if candidate.is_file():
                version = candidate.read_text().strip()
                logger.debug("Loaded version %s from %s", version, candidate)
                return version
            if d.parent == d:
                break
            d = d.parent
    except Exception:
        logger.debug("Failed to read VERSION file", exc_info=True)
    logger.warning("VERSION file not found; falling back to %s", fallback)
    return fallback


PRODUCT_VERSION = _load_version()


def _sanitize(value: str, max_len: int = 60) -> str:
    """Sanitize a value for safe inclusion in a User-Agent token.

    Keeps only ``[a-zA-Z0-9._-]``, collapses consecutive hyphens, and caps
    length.  Same regex pattern as the AI Dev Kit's ``_sanitize_project_name``.
    """
    if not value:
        return ""
    sanitized = re.sub(r"[^a-zA-Z0-9._-]", "-", value)
    sanitized = re.sub(r"-+", "-", sanitized).strip("-")
    return sanitized[:max_len] or "unknown"


def build_user_agent(
    section_tag: Optional[str] = None,
    industry: Optional[str] = None,
    use_case: Optional[str] = None,
) -> str:
    """Build a User-Agent string with optional per-request workflow context.

    Static parts (product, python version, OS) are always present.
    Dynamic parts are sanitized and only appended when non-empty.
    """
    parts = [f"{PRODUCT_NAME}/{PRODUCT_VERSION}"]

    try:
        from databricks.sdk.version import __version__ as sdk_version
        parts.append(f"databricks-sdk-py/{sdk_version}")
    except ImportError:
        pass

    parts.append(f"python/{sys.version.split()[0]}")
    parts.append(f"os/{sys.platform}")

    if section_tag:
        parts.append(f"section/{_sanitize(section_tag)}")
    if industry:
        parts.append(f"industry/{_sanitize(industry)}")
    if use_case:
        parts.append(f"usecase/{_sanitize(use_case)}")

    return " ".join(parts)


def get_tagged_workspace_client(**kwargs):
    """Return a new WorkspaceClient pre-tagged with product identity.

    All SDK-based API calls made through this client will carry
    ``vibe-to-value-workshop/<version>`` in their User-Agent header.
    """
    from databricks.sdk import WorkspaceClient

    return WorkspaceClient(
        product=PRODUCT_NAME,
        product_version=PRODUCT_VERSION,
        **kwargs,
    )
