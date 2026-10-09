"""The dedicated default executor (VIBE_THREAD_POOL_SIZE) and its app lifespan."""

import asyncio
import contextvars
import importlib
import logging
import sys
import threading

import pytest
from starlette.testclient import TestClient

from src.backend import executor as executor_mod

LOGGER = "src.backend.executor"


@pytest.fixture
def fresh_loop():
    loop = asyncio.new_event_loop()
    try:
        yield loop
    finally:
        executor_mod.shutdown_executor()
        loop.close()


def _configure(monkeypatch, loop, value):
    if value is None:
        monkeypatch.delenv(executor_mod.ENV_VAR, raising=False)
    else:
        monkeypatch.setenv(executor_mod.ENV_VAR, value)
    return executor_mod.configure_default_executor(loop)


def _worker_thread_name(loop):
    async def probe():
        return await asyncio.to_thread(lambda: threading.current_thread().name)

    return loop.run_until_complete(probe())


# ---- E1 -------------------------------------------------------------------

@pytest.mark.parametrize(
    ("value", "expected"),
    [(None, 32), ("", 32), ("16", 16), ("1000", 128), ("2", 4)],
)
def test_executor_env_config(monkeypatch, fresh_loop, value, expected):
    assert _configure(monkeypatch, fresh_loop, value) == expected
    assert fresh_loop._default_executor._max_workers == expected
    assert _worker_thread_name(fresh_loop).startswith("vibe-io")


@pytest.mark.parametrize("value", ["abc", "-5"])
def test_executor_env_config_invalid_falls_back_with_warning(monkeypatch, fresh_loop, caplog, value):
    with caplog.at_level(logging.WARNING, logger=LOGGER):
        assert _configure(monkeypatch, fresh_loop, value) == 32
    assert fresh_loop._default_executor._max_workers == 32
    assert any(
        r.levelno == logging.WARNING and executor_mod.ENV_VAR in r.getMessage()
        for r in caplog.records
    )


def test_executor_env_config_zero_disables(monkeypatch, fresh_loop, caplog):
    with caplog.at_level(logging.INFO, logger=LOGGER):
        assert _configure(monkeypatch, fresh_loop, "0") == 0
    # The loop is left untouched: no default executor installed.
    assert fresh_loop._default_executor is None
    assert not _worker_thread_name(fresh_loop).startswith("vibe-io")
    assert any("platform default" in r.getMessage() for r in caplog.records)


def test_executor_info_log_names_the_size(monkeypatch, fresh_loop, caplog):
    with caplog.at_level(logging.INFO, logger=LOGGER):
        _configure(monkeypatch, fresh_loop, "16")
    assert any(r.getMessage() == "default executor: vibe-io x16" for r in caplog.records)


# ---- E2 -------------------------------------------------------------------

def test_executor_concurrency(monkeypatch, fresh_loop):
    size = 16
    assert _configure(monkeypatch, fresh_loop, str(size)) == size
    assert fresh_loop._default_executor._max_workers == size

    barrier = threading.Barrier(size, timeout=5)

    def wait_at_barrier():
        # Raises BrokenBarrierError unless `size` workers are blocked here at once.
        barrier.wait()
        return threading.current_thread().name

    async def run_all():
        return await asyncio.gather(*(asyncio.to_thread(wait_at_barrier) for _ in range(size)))

    names = fresh_loop.run_until_complete(run_all())
    assert len(set(names)) == size
    assert all(name.startswith("vibe-io") for name in names)


# ---- E3 -------------------------------------------------------------------

def _load_app(monkeypatch, mcp_enabled):
    if mcp_enabled:
        monkeypatch.setenv("MCP_MOUNT_ENABLED", "true")
    else:
        monkeypatch.delenv("MCP_MOUNT_ENABLED", raising=False)
    sys.modules.pop("app", None)
    if mcp_enabled:
        sys.modules.pop("src.backend.mcp_server", None)
    return importlib.import_module("app")


@pytest.mark.parametrize("mcp_enabled", [True, False])
def test_app_lifespan(monkeypatch, mcp_enabled):
    monkeypatch.setenv(executor_mod.ENV_VAR, "12")
    app_module = _load_app(monkeypatch, mcp_enabled)
    assert app_module.MCP_MOUNT_ENABLED is mcp_enabled

    async def probe():
        loop = asyncio.get_running_loop()
        name = await asyncio.to_thread(lambda: threading.current_thread().name)
        return name, loop._default_executor._max_workers

    with TestClient(app_module.app) as client:
        installed = executor_mod._executor
        assert installed is not None
        name, max_workers = client.portal.call(probe)
        assert name.startswith("vibe-io")
        assert max_workers == 12

    # Lifespan exit shut the pool down.
    assert executor_mod._executor is None
    with pytest.raises(RuntimeError):
        installed.submit(lambda: None)


# ---- E4 -------------------------------------------------------------------

_request_user = contextvars.ContextVar("_request_user", default="unset")


def test_executor_contextvar(monkeypatch, fresh_loop):
    _configure(monkeypatch, fresh_loop, "8")

    async def run():
        _request_user.set("learner@example.com")
        return await asyncio.to_thread(
            lambda: (_request_user.get(), threading.current_thread().name)
        )

    value, name = fresh_loop.run_until_complete(run())
    assert value == "learner@example.com"
    assert name.startswith("vibe-io")
