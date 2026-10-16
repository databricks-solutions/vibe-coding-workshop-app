"""Offload + fallback branches left unpinned by #77/#78/#79.

Seven offline tests, one per branch:

  (a) routes ``call_databricks_serving_endpoint``: schema-class OpenAI failure and
      EVERY agent variation fails -> the LAST agent error is raised.
  (b) a NON-schema OpenAI failure -> the agent fallback is never attempted.
  (c) variation 1 fails, variation 2 succeeds -> that response is used.
  (ctx) the OBO ContextVar reaches the ``make_request`` worker thread.
  (rr) ``_run_async_blocking`` re-raises the coroutine's own exception.
  (sd) a raising ``loop.shutdown_asyncgens()`` is contained by the runner.
  (be) the generation path's ``except BaseException`` serves the template,
       negative-caches, and resolves the single-flight Future for joiners.

Fakes only (monkeypatch); no real FMAPI; budgets patched small. The custom
``_Boom`` is a direct BaseException subclass — no real KeyboardInterrupt or
SystemExit is ever raised. Each docstring names the product line it pins and the
TAMPER that makes it fail (verified manually, product restored byte-identical).
"""

import asyncio
import contextvars
import pathlib
import sys
import threading
import time

import pytest
from fastapi import HTTPException

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server  # noqa: E402
from src.backend.api import routes  # noqa: E402
from src.backend.services import llm  # noqa: E402

INDUSTRY = "Technology"
USE_CASE = "Genie Accelerator"

SCHEMA_ERROR = "BAD_REQUEST: schema validation failed, missing inputs"


@pytest.fixture(autouse=True)
def _reset_step_prompt_state():
    """Isolate the module-global cache + in-flight + negative registries across tests."""
    mcp_server._STEP_PROMPT_CACHE.clear()
    with mcp_server._STEP_PROMPT_LOCK:
        mcp_server._STEP_PROMPT_INFLIGHT.clear()
        mcp_server._STEP_PROMPT_NEGATIVE.clear()
    yield
    mcp_server._STEP_PROMPT_CACHE.clear()
    with mcp_server._STEP_PROMPT_LOCK:
        mcp_server._STEP_PROMPT_INFLIGHT.clear()
        mcp_server._STEP_PROMPT_NEGATIVE.clear()


def _cache_key(session_id, section_tag="prd_generation", input_text="TEMPLATE BODY"):
    import hashlib

    return (session_id or "", section_tag, hashlib.sha256(input_text.encode()).hexdigest())


# --- routes.call_databricks_serving_endpoint fakes -------------------------

class _FakeConfig:
    host = "https://example.cloud.databricks.com"


class _FakeApiClientRaising:
    """OpenAI-format ``api_client.do`` that always raises ``message``."""

    def __init__(self, message):
        self.message = message
        self.calls = 0

    def do(self, method, path, body):  # noqa: ARG002 — mimics the SDK signature
        self.calls += 1
        raise RuntimeError(self.message)


class _FakeServingEndpoints:
    """Agent-format ``serving_endpoints.query``; ``outcomes[i]`` drives call i.

    An outcome that is an Exception is raised; anything else is returned. A
    callable ``on_call`` runs first on every call (in the calling thread).
    """

    def __init__(self, outcomes, on_call=None):
        self.outcomes = list(outcomes)
        self.on_call = on_call
        self.calls = 0

    def query(self, **kwargs):  # noqa: ARG002 — mimics the SDK signature
        idx = self.calls
        self.calls += 1
        if self.on_call is not None:
            self.on_call()
        outcome = self.outcomes[idx]
        if isinstance(outcome, BaseException):
            raise outcome
        return outcome


class _FakeClient:
    config = _FakeConfig()

    def __init__(self, api_client, serving_endpoints):
        self.api_client = api_client
        self.serving_endpoints = serving_endpoints


def _install_client(monkeypatch, api_client, serving_endpoints):
    client = _FakeClient(api_client, serving_endpoints)
    monkeypatch.setattr(llm, "DATABRICKS_SDK_AVAILABLE", True)
    monkeypatch.setattr(llm, "get_workspace_client", lambda: client)
    monkeypatch.setattr(llm, "get_best_available_endpoint", lambda: "ep")
    return client


def _call():
    return asyncio.run(routes.call_databricks_serving_endpoint("hello", endpoint_name="ep"))


def _ok(content):
    return {"choices": [{"message": {"content": content}}]}


# --- (a) every agent variation fails -> raise the LAST agent error ---------

def test_all_agent_variations_fail_raises_last_agent_error(monkeypatch):
    """Pins routes.py:1642-1644 ``if last_error: ... raise last_error``.

    A schema-class OpenAI failure triggers the agent fallback; all four variations
    fail with distinct messages. The raised error (wrapped by the outer handler in
    HTTPException 500) must carry the LAST agent error, not the OpenAI one.
    TAMPER T-a: replace ``raise last_error`` with ``return {}`` -> the call returns
    a dict (llm_empty_response) instead of raising -> pytest.raises fails.
    """
    agent_errors = [RuntimeError(f"agent variation {i} exploded") for i in range(1, 5)]
    client = _install_client(
        monkeypatch, _FakeApiClientRaising(SCHEMA_ERROR), _FakeServingEndpoints(agent_errors)
    )

    with pytest.raises(HTTPException) as excinfo:
        _call()

    assert excinfo.value.status_code == 500
    assert "agent variation 4 exploded" in excinfo.value.detail
    assert "BAD_REQUEST" not in excinfo.value.detail  # not the OpenAI error
    assert client.serving_endpoints.calls == 4  # every variation was tried


# --- (b) non-schema OpenAI failure -> no agent fallback --------------------

def test_non_schema_openai_failure_skips_agent_fallback(monkeypatch):
    """Pins routes.py:1629 ``if "schema" in error_msg or ... "input" in error_msg:``.

    A non-schema OpenAI failure (a dropped connection) must be re-raised as-is;
    the agent-format variations are never attempted.
    TAMPER T-b: drop the schema-class condition (always fall back) -> the agent
    fake is called (calls > 0) and the raised detail is the agent's error, not the
    OpenAI one -> both assertions below fail.
    """
    openai_message = "connection reset by peer while reading upstream"
    client = _install_client(
        monkeypatch,
        _FakeApiClientRaising(openai_message),
        _FakeServingEndpoints([RuntimeError("agent fallback was attempted")] * 4),
    )

    with pytest.raises(HTTPException) as excinfo:
        _call()

    assert client.serving_endpoints.calls == 0  # fallback never attempted
    assert openai_message in excinfo.value.detail
    assert "agent fallback was attempted" not in excinfo.value.detail


# --- (c) variation 2 succeeds -> its response is used, last_error cleared ---

def test_second_agent_variation_success_is_used(monkeypatch):
    """Pins routes.py:1636-1637 ``last_error = None`` + ``break`` after a success.

    Variation 1 fails, variation 2 succeeds, variations 3-4 would fail. The call
    must return variation 2's content and stop trying further variations.
    TAMPER T-c: drop ``break`` -> variations 3-4 run and their failure overwrites
    last_error -> HTTPException is raised instead of the V2 response.
    """
    client = _install_client(
        monkeypatch,
        _FakeApiClientRaising(SCHEMA_ERROR),
        _FakeServingEndpoints([
            RuntimeError("variation 1 failed"),
            _ok("V2 RESPONSE"),
            RuntimeError("variation 3 failed"),
            RuntimeError("variation 4 failed"),
        ]),
    )

    result = _call()

    assert result["response"] == "V2 RESPONSE"
    assert result["source"] == "llm_generated"
    assert client.serving_endpoints.calls == 2  # stopped at the first success


# --- (ctx) OBO ContextVar reaches the make_request worker thread -----------

_OBO_CV: contextvars.ContextVar[str] = contextvars.ContextVar("offload_obo_cv", default="unset")


def test_contextvar_propagates_into_make_request_thread(monkeypatch):
    """Pins routes.py:1635 ``await asyncio.to_thread(make_request, agent_payload)``.

    to_thread copies contextvars, so the OBO token set before the call must be
    visible inside the agent-format ``serving_endpoints.query`` worker thread
    (only the api_client.do offload was pinned before).
    TAMPER T-ctx: replace the to_thread call with a raw ``threading.Thread`` (no
    copy_context) -> the worker sees the default "unset" -> assertion fails.
    """
    seen: list[str] = []
    _install_client(
        monkeypatch,
        _FakeApiClientRaising(SCHEMA_ERROR),
        _FakeServingEndpoints([_ok("CTX OK")], on_call=lambda: seen.append(_OBO_CV.get())),
    )

    token = _OBO_CV.set("obo-token-make-request")
    try:
        result = _call()
    finally:
        _OBO_CV.reset(token)

    assert result["response"] == "CTX OK"
    assert seen == ["obo-token-make-request"]


# --- (rr) _run_async_blocking re-raises the coroutine's own exception ------

def test_run_async_blocking_reraises_same_exception():
    """Pins mcp_server.py:1529-1530 ``except BaseException as exc: box["error"] = exc``
    and mcp_server.py:1550 ``raise box["error"]``.

    A raising coroutine must surface the SAME exception object (type + message) on
    the calling thread.
    TAMPER T-rr: in runner, swallow the exception (``pass``) instead of boxing it
    -> the caller hits ``box["value"]`` and raises KeyError -> pytest.raises fails.
    """
    original = ValueError("coroutine failed: boom-xyz")

    async def failing():
        raise original

    with pytest.raises(ValueError, match="coroutine failed: boom-xyz") as excinfo:
        mcp_server._run_async_blocking(failing, timeout_s=2.0)

    assert excinfo.value is original


# --- (sd) a raising shutdown_asyncgens is contained ------------------------

def test_raising_shutdown_asyncgens_does_not_mask_result(monkeypatch):
    """Pins mcp_server.py:1537-1542, the ``try: ... except BaseException: pass``
    around ``loop.shutdown_asyncgens()`` / ``shutdown_default_executor()``.

    A cleanup failure must not mask the coroutine's successful result and must
    stay inside the runner: the result is returned, the private loop is still
    closed, and nothing escapes the worker thread.
    TAMPER T-sd: remove the try around the shutdowns -> the RuntimeError escapes
    the runner's finally, skipping ``loop.close()`` and reaching
    ``threading.excepthook`` -> the closed-loop and no-escape assertions fail.
    """
    loops: list[asyncio.AbstractEventLoop] = []

    async def raising_shutdown_asyncgens(self):
        loops.append(self)
        raise RuntimeError("shutdown_asyncgens failed")

    monkeypatch.setattr(
        asyncio.base_events.BaseEventLoop, "shutdown_asyncgens", raising_shutdown_asyncgens
    )
    escaped: list[BaseException] = []
    monkeypatch.setattr(threading, "excepthook", lambda args: escaped.append(args.exc_value))

    async def ok():
        return "RESULT"

    assert mcp_server._run_async_blocking(ok, timeout_s=2.0) == "RESULT"
    assert len(loops) == 1
    assert loops[0].is_closed()  # cleanup failure did not skip loop.close()
    assert escaped == []  # and did not escape the worker thread


# --- (be) generation-path except BaseException -----------------------------

class _Boom(BaseException):
    """A non-Exception BaseException; stands in for KeyboardInterrupt-class errors."""


def test_base_exception_in_generation_serves_template_and_resolves_joiner(monkeypatch):
    """Pins mcp_server.py:800 ``except BaseException:`` in ``_generate_and_resolve``.

    A collector raising a direct BaseException subclass must: serve the template
    to the owner (None, not a raise), write the negative-cache entry, and resolve
    the single-flight Future so a concurrent joiner returns promptly instead of
    waiting out its budget.
    TAMPER T-be: narrow to ``except Exception`` -> _Boom escapes the coroutine, is
    re-raised to the owner (owner result is the _Boom, not None), no negative
    entry is written, and the joiner waits its full budget -> assertions fail.
    """
    budget = 2.0
    monkeypatch.setattr(mcp_server, "STEP_PROMPT_BUDGET_S", budget)
    gate = threading.Event()

    async def fake(*args, **kwargs):
        while not gate.is_set():
            await asyncio.sleep(0.005)
        raise _Boom("generation interrupted")

    monkeypatch.setattr(routes, "collect_step_prompt_via_stream", fake)
    key = _cache_key("sess-boom")
    results: dict[str, object] = {}

    def read(name):
        try:
            results[name] = mcp_server._generate_step_prompt(
                INDUSTRY, USE_CASE, "prd_generation",
                {"input": "TEMPLATE BODY", "bypass_llm": False}, {}, "sess-boom",
            )
        except BaseException as exc:  # noqa: BLE001 — record, never propagate _Boom
            results[name] = exc

    owner = threading.Thread(target=read, args=("owner",))
    owner.start()
    deadline = time.monotonic() + 2.0
    while key not in mcp_server._STEP_PROMPT_INFLIGHT and time.monotonic() < deadline:
        time.sleep(0.005)
    assert key in mcp_server._STEP_PROMPT_INFLIGHT  # owner elected
    joiner = threading.Thread(target=read, args=("joiner",))
    joiner.start()
    time.sleep(0.2)  # let the joiner attach to the in-flight Future

    released = time.monotonic()
    gate.set()
    owner.join(budget + 2.0)
    joiner.join(budget + 2.0)
    joiner_wait = time.monotonic() - released

    assert results["owner"] is None  # template served, _Boom not re-raised
    assert results["joiner"] is None
    assert key in mcp_server._STEP_PROMPT_NEGATIVE  # negative entry written
    assert key not in mcp_server._STEP_PROMPT_CACHE
    assert joiner_wait < budget / 2  # Future resolved; joiner did not wait out its budget
