"""
Product identity and User-Agent utilities for telemetry tracking.

Modeled after the Databricks AI Dev Kit's identity.py pattern:
  - Static PRODUCT_NAME / PRODUCT_VERSION set once at import time
  - _sanitize() keeps User-Agent tokens safe (same regex as AI Dev Kit)
  - tag_client() adds project-level extra tags to a WorkspaceClient
  - build_user_agent() constructs per-request UA strings with optional workflow context
  - build_usage_context() returns a dict for serving endpoint usage_context tracking

Tracking surfaces (standard Databricks platform mechanisms):
  - User-Agent header on all SDK and HTTP calls (system.access.audit)
  - usage_context dict on serving endpoint invocations (system.serving.endpoint_usage)
"""

import logging
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, Optional

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


def _detect_project_name() -> str:
    """Auto-detect the project name from git remote or directory name.

    Matches the AI Dev Kit's detection priority:
      1. Git remote origin URL → repository name
      2. Git repo root directory → basename
      3. Current working directory → basename
    """
    # Try git remote origin
    try:
        result = subprocess.run(
            ["git", "remote", "get-url", "origin"],
            stdin=subprocess.DEVNULL,
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0 and result.stdout.strip():
            name = result.stdout.strip().rstrip("/").split("/")[-1].removesuffix(".git")
            if name:
                return _sanitize(name)
    except Exception:
        pass
    # Fallback to cwd basename
    return _sanitize(os.path.basename(os.getcwd()) or "unknown")


def tag_client(client: "WorkspaceClient") -> "WorkspaceClient":
    """Add project identifier to a WorkspaceClient's user-agent.

    Appends ``project/<auto-detected-repo-name>`` so different installations
    of the workshop are distinguishable in centralized logs.
    """
    client.config.with_user_agent_extra("project", _detect_project_name())
    return client


def build_usage_context(
    section_tag: Optional[str] = None,
    industry: Optional[str] = None,
    use_case: Optional[str] = None,
) -> Dict[str, str]:
    """Build a ``usage_context`` dict for serving endpoint request bodies.

    This populates ``system.serving.endpoint_usage.usage_context`` so
    invocations are queryable without parsing User-Agent strings.
    """
    ctx: Dict[str, str] = {
        "product": PRODUCT_NAME,
        "version": PRODUCT_VERSION,
    }
    if section_tag:
        ctx["section"] = _sanitize(section_tag)
    if industry:
        ctx["industry"] = _sanitize(industry)
    if use_case:
        ctx["usecase"] = _sanitize(use_case)
    return ctx


def get_tagged_workspace_client(**kwargs) -> "WorkspaceClient":
    """Return a new WorkspaceClient pre-tagged with product identity.

    All SDK-based API calls made through this client will carry
    ``vibe-to-value-workshop/<version>`` in their User-Agent header,
    plus a ``project/<repo-name>`` extra tag.
    """
    from databricks.sdk import WorkspaceClient

    client = WorkspaceClient(
        product=PRODUCT_NAME,
        product_version=PRODUCT_VERSION,
        **kwargs,
    )
    return tag_client(client)
