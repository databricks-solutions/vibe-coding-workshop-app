"""Dedicated default executor for the app's event loop.

Blocking work (sync MCP tool bodies, prompt/agent fallbacks, locked session
saves) is offloaded with ``asyncio.to_thread``, which runs on the loop's
DEFAULT executor. The platform default is a ThreadPoolExecutor with
``min(32, os.cpu_count() + 4)`` workers: 6-8 threads on a small Databricks
Apps container. A live workshop (~30 learners hitting a 17-38 s step at once)
would queue every offloaded call behind those threads, so the app lifespan
installs a workshop-sized pool instead.

``VIBE_THREAD_POOL_SIZE`` (int, default 32, clamped to 4..128) sizes it.
``VIBE_THREAD_POOL_SIZE=0`` disables it: the loop keeps the platform default.
"""

from __future__ import annotations

import asyncio
import logging
import os
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

ENV_VAR = "VIBE_THREAD_POOL_SIZE"
DEFAULT_SIZE = 32
MIN_SIZE = 4
MAX_SIZE = 128
THREAD_NAME_PREFIX = "vibe-io"

_executor: ThreadPoolExecutor | None = None


def _pool_size_from_env() -> int:
    """Read the pool size from the env var: 0 = disabled, else 4..128."""
    raw = os.environ.get(ENV_VAR, "").strip()
    if not raw:
        return DEFAULT_SIZE
    try:
        size = int(raw)
    except ValueError:
        logger.warning("%s=%r is not an int; using default %d", ENV_VAR, raw, DEFAULT_SIZE)
        return DEFAULT_SIZE
    if size == 0:
        return 0
    if size < 0:
        logger.warning("%s=%d is negative; using default %d", ENV_VAR, size, DEFAULT_SIZE)
        return DEFAULT_SIZE
    clamped = max(MIN_SIZE, min(MAX_SIZE, size))
    if clamped != size:
        logger.warning("%s=%d is out of range; clamped to %d", ENV_VAR, size, clamped)
    return clamped


def configure_default_executor(loop: asyncio.AbstractEventLoop) -> int:
    """Install the dedicated pool as ``loop``'s default executor.

    Returns the pool size, or 0 when disabled (the loop is left untouched).
    """
    global _executor
    size = _pool_size_from_env()
    if size == 0:
        _executor = None
        logger.info("default executor: platform default (%s=0)", ENV_VAR)
        return 0
    executor = ThreadPoolExecutor(max_workers=size, thread_name_prefix=THREAD_NAME_PREFIX)
    loop.set_default_executor(executor)
    _executor = executor
    logger.info("default executor: %s x%d", THREAD_NAME_PREFIX, size)
    return size


def shutdown_executor() -> None:
    """Shut down the dedicated pool on lifespan exit (no-op if disabled)."""
    global _executor
    executor, _executor = _executor, None
    if executor is not None:
        executor.shutdown(wait=False, cancel_futures=False)
