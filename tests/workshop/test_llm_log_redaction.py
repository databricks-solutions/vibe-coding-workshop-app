"""llm.py never logs model output (llm-response-log-redact, D-27; D7 security.md §6/§8),
and the model-call paths never log error/response-body text (routes-log-redact, D-28).

Offline tests:

  R1 no content in logs: call_databricks_serving_endpoint over the OpenAI path, with a
     response whose content holds a planted marker, leaves NO log record (any level,
     logger src.backend.services.llm) containing the marker or any 20-char substring
     of the content. Parametrized over the chat (choices) and agent (output) shapes.
     TAMPER: restore `Response repr: {repr(query_response)[:500]}` -> red.
  R2 same for the agent-format fallback path (make_request).
  R3 the returned dict is unchanged ("response" is the planted content).
  R4 static AST scan of llm.py: no logger.* argument references a name that holds
     model output or prompt text, except through the allowed forms below.
     TAMPER: insert `logger.info(f"Leak {val_preview}")` -> red.
  R4 hardened (D-28): a taint scan of the logger calls in llm.py's get_workspace_client,
     get_available_serving_endpoints, call_databricks_serving_endpoint and routes.py's
     generate_prompt_content_with_llm, _stream_with_retry, stream_llm_response,
     collect_step_prompt_via_stream. Tainted: content names, `except ... as` names,
     locals derived from them (alias, str/repr, slicing, f-strings, string methods) or
     from a response-body read; traceback.format_exc(); exc_info above DEBUG. Allowed:
     type(x), len(x), isinstance, getattr(x, "status_code"|"error_code", ...),
     x.status_code / x.error_code, x.keys(), an if-expression's test. Only logger calls
     are checked (an HTTPException detail is a client response, not a log).
     TAMPER: restore `{e}` in llm.get_workspace_client -> red.
  R5 an exception whose text holds a planted marker, raised from the SDK fake in
     call_databricks_serving_endpoint, from the endpoint lister and from the
     workspace-client factory, reaches no INFO+ record (the DEBUG traceback may hold it).
  R6 routes._stream_with_retry with the marker in a non-200 body, in a retried 503
     body, in an auth error and in a transport exception, and collect_step_prompt_via_stream
     with the marker in a drain exception: no INFO+ record (message or traceback) holds it.
     TAMPER: log `{err_msg}` again at routes.py's non-200 branch -> red.
  R7 routes.generate_prompt_content_with_llm: a generated prompt holding the marker, and
     a model-call exception holding it, reach no INFO+ record.
     TAMPER: restore `Response preview: {generated_prompt[:200]}` -> red.
  R8 AST equivalence: each function edited by routes-log-redact equals its body at
     4b57581 once logger-call statements (and a then-unused `import traceback`) are
     removed from both, so the PR changes logging only. A clone without the base
     object FAILS, never skips (D-21).
     TAMPER: insert `x = str(e)` in generate_prompt_content_with_llm's except -> red.
"""

import ast
import asyncio
import logging
import pathlib
import shutil
import subprocess
import sys

import httpx
import pytest
from fastapi import HTTPException

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.api import routes  # noqa: E402
from src.backend.services import llm  # noqa: E402

LLM_PY = REPO_ROOT / "src" / "backend" / "services" / "llm.py"
ROUTES_PY = REPO_ROOT / "src" / "backend" / "api" / "routes.py"

# Captured at import, before tests/workshop/conftest.py's autouse fixture swaps both
# for offline fakes on routes.
_REAL_GENERATE = routes.generate_prompt_content_with_llm
_REAL_COLLECT = routes.collect_step_prompt_via_stream
LOGGER_NAME = "src.backend.services.llm"

MARKER = "ZQX-PLANTED-7731"
CONTENT = (
    f"Coaching draft {MARKER}: the rejected text says SELECT secret FROM learners "
    "and keeps going well past the old one hundred and fifty character preview window "
    "so every slice of it is distinctive."
)

CHAT_RESPONSE = {
    "choices": [{"message": {"content": CONTENT}, "finish_reason": "stop"}],
    "model": "ep",
    "usage": {"prompt_tokens": 3, "completion_tokens": 40, "total_tokens": 43},
}
AGENT_RESPONSE = {"output": [CONTENT], "usage": {}}


class _FakeConfig:
    host = "https://example.cloud.databricks.com"


class _FakeApiClient:
    def __init__(self, response):
        self._response = response

    def do(self, method, path, body):  # noqa: ARG002 — mimics the SDK signature
        return self._response


class _FakeApiClientSchemaError:
    def do(self, method, path, body):  # noqa: ARG002 — mimics the SDK signature
        # Force the OpenAI path to fail with a schema error so the agent-format
        # fallback (make_request) runs.
        raise RuntimeError("BAD_REQUEST: schema validation failed, missing inputs")


class _FakeServingEndpoints:
    def query(self, **kwargs):  # noqa: ARG002 — mimics the SDK signature
        return CHAT_RESPONSE


class _FakeClient:
    config = _FakeConfig()

    def __init__(self, response):
        self.api_client = _FakeApiClient(response)
        self.serving_endpoints = None


class _FakeClientAgentFallback:
    config = _FakeConfig()
    api_client = _FakeApiClientSchemaError()
    serving_endpoints = _FakeServingEndpoints()


def _call(monkeypatch, client):
    monkeypatch.setattr(llm, "DATABRICKS_SDK_AVAILABLE", True)
    monkeypatch.setattr(llm, "get_workspace_client", lambda: client)
    monkeypatch.setattr(llm, "get_best_available_endpoint", lambda: "ep")
    return asyncio.run(llm.call_databricks_serving_endpoint("hi", endpoint_name="ep"))


def _assert_no_content_logged(caplog):
    records = [r for r in caplog.records if r.name == LOGGER_NAME]
    assert records, "expected llm log records; the capture is not wired"
    windows = {CONTENT[i:i + 20] for i in range(len(CONTENT) - 19)}
    for r in records:
        msg = r.getMessage()
        assert MARKER not in msg, f"marker logged at {r.levelname}: {msg!r}"
        leaked = sorted(w for w in windows if w in msg)
        assert not leaked, f"content logged at {r.levelname}: {leaked[0]!r} in {msg!r}"


@pytest.mark.parametrize("response", [CHAT_RESPONSE, AGENT_RESPONSE], ids=["choices", "output"])
def test_r1_openai_path_logs_no_content(monkeypatch, caplog, response):
    caplog.set_level(logging.DEBUG, logger=LOGGER_NAME)
    _call(monkeypatch, _FakeClient(response))
    _assert_no_content_logged(caplog)


def test_r2_agent_fallback_path_logs_no_content(monkeypatch, caplog):
    caplog.set_level(logging.DEBUG, logger=LOGGER_NAME)
    result = _call(monkeypatch, _FakeClientAgentFallback())
    assert result["response"] == CONTENT  # the fallback really ran and parsed
    _assert_no_content_logged(caplog)


@pytest.mark.parametrize("client_factory", [
    lambda: _FakeClient(CHAT_RESPONSE),
    _FakeClientAgentFallback,
], ids=["openai", "agent_fallback"])
def test_r3_return_value_unchanged(monkeypatch, client_factory):
    result = _call(monkeypatch, client_factory())
    assert result == {
        "response": CONTENT,
        "model": "ep",
        "usage": {"prompt_tokens": 3, "completion_tokens": 40, "total_tokens": 43},
        "source": "llm_generated",
    }


# Names in llm.py that hold model output or prompt text (read from
# call_databricks_serving_endpoint and make_request). Model output: query_response,
# raw_result, result, result_dict, response, val, val_preview, item, choice, message,
# content, data, preview. Prompt text: prompt, system_prompt, messages, msg, parts,
# combined_prompt, openai_payload, agent_payloads, agent_payload, payload,
# input_data, input_list, openai_request_body.
FORBIDDEN_NAMES = {
    "query_response", "raw_result", "result", "result_dict", "response", "val",
    "val_preview", "item", "choice", "message", "content", "data", "preview",
    "prompt", "system_prompt", "messages", "msg", "parts", "combined_prompt",
    "openai_payload", "agent_payloads", "agent_payload", "payload", "input_data",
    "input_list", "openai_request_body",
}
# The only allowed ways a logger argument may reference a forbidden name; each
# yields a type name, a size, a bool or the key names, never the values:
#   type(X)  (incl. type(X).__name__)
#   len(X)   (incl. len(str(X)))
#   isinstance(X, T)
#   X.keys() (incl. list(X.keys()))
ALLOWED_WRAPPERS = {"type", "len", "isinstance"}
ALLOWED_METHODS = {"keys"}


def _is_logger_call(node):
    return (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and isinstance(node.func.value, ast.Name)
        and node.func.value.id == "logger"
    )


def _forbidden_refs(node):
    if isinstance(node, ast.Call):
        if isinstance(node.func, ast.Name) and node.func.id in ALLOWED_WRAPPERS:
            return []
        if (
            isinstance(node.func, ast.Attribute)
            and node.func.attr in ALLOWED_METHODS
            and not node.args
            and not node.keywords
        ):
            return []
    if isinstance(node, ast.Name) and node.id in FORBIDDEN_NAMES:
        return [node.id]
    return [n for child in ast.iter_child_nodes(node) for n in _forbidden_refs(child)]


def test_r4_no_logger_call_references_model_output():
    tree = ast.parse(LLM_PY.read_text(encoding="utf-8"))
    calls = [n for n in ast.walk(tree) if _is_logger_call(n)]
    assert len(calls) > 40, "scan found too few logger calls; is it still parsing llm.py?"
    hits = []
    for call in calls:
        for arg in list(call.args) + [k.value for k in call.keywords]:
            for name in _forbidden_refs(arg):
                hits.append(f"llm.py:{call.lineno}: logger.{call.func.attr} references {name}")
    assert hits == [], "log type/len/keys only, never the value:\n" + "\n".join(hits)


def test_r4_scan_catches_the_known_leak_shapes():
    # Self-check: the pre-fix lines and the T4 shape must be flagged.
    for src in [
        'logger.info(f"  Response repr: {repr(query_response)[:500]}")',
        "logger.debug(f\"    Key '{key}': type={val_type}, value={val_preview}\")",
        "logger.info(f\"     Preview: {preview}{'...' if len(str(content)) > 150 else ''}\")",
        'logger.info("x %s", content)',
        'logger.info(f"Leak {val_preview}")',
    ]:
        call = ast.parse(src).body[0].value
        assert any(_forbidden_refs(a) for a in call.args), src
    for src in [
        'logger.info(f"  Response received: type={type(query_response).__name__}")',
        'logger.info(f"     Response length: {len(str(content))} characters")',
        "logger.info(f\"  Response keys: {list(response.keys()) if isinstance(response, dict) else 'N/A'}\")",
    ]:
        call = ast.parse(src).body[0].value
        assert not any(_forbidden_refs(a) for a in call.args), src



# ---------------------------------------------------------------------------
# R4 hardened (routes-log-redact, D-28)
# ---------------------------------------------------------------------------

HARDENED_SCOPE = {
    LLM_PY: [
        "get_workspace_client",
        "get_available_serving_endpoints",
        "call_databricks_serving_endpoint",
    ],
    ROUTES_PY: [
        "generate_prompt_content_with_llm",
        "_stream_with_retry",
        "stream_llm_response",
        "collect_step_prompt_via_stream",
    ],
}
# routes.py names that hold prompt text, model output or a response body.
ROUTES_CONTENT_NAMES = {
    "generated_prompt", "input_text", "input_template", "how_to_apply",
    "expected_output", "section_content", "previous_outputs", "error_body", "err_msg",
    "content_buffer", "chunk", "chunks", "delta", "line", "raw", "event",
    "combined_output", "request_body",
}
CONTENT_NAMES = FORBIDDEN_NAMES | ROUTES_CONTENT_NAMES
BODY_READ_CALLS = {"decode", "json", "read", "aread"}
BODY_READ_ATTRS = {"text", "content"}
STRING_METHODS = {
    "lower", "upper", "casefold", "title", "strip", "lstrip", "rstrip", "replace",
    "format", "join", "split", "splitlines", "encode", "decode",
}
SAFE_ATTRS = {"status_code", "error_code"}


def _derives(node, tainted):
    """True if evaluating `node` yields (part of) a tainted value or a response body."""
    if isinstance(node, ast.Name):
        return node.id in tainted
    if isinstance(node, ast.JoinedStr):
        return any(_derives(v, tainted) for v in node.values)
    if isinstance(node, ast.FormattedValue):
        return _derives(node.value, tainted)
    if isinstance(node, ast.BinOp):
        return _derives(node.left, tainted) or _derives(node.right, tainted)
    if isinstance(node, ast.BoolOp):
        return any(_derives(v, tainted) for v in node.values)
    if isinstance(node, ast.IfExp):
        return _derives(node.body, tainted) or _derives(node.orelse, tainted)
    if isinstance(node, ast.Await):
        return _derives(node.value, tainted)
    if isinstance(node, ast.Subscript):
        return isinstance(node.slice, ast.Slice) and _derives(node.value, tainted)
    if isinstance(node, ast.Attribute):
        return node.attr in BODY_READ_ATTRS
    if isinstance(node, ast.Call):
        func = node.func
        if isinstance(func, ast.Name) and func.id in {"str", "repr", "format"}:
            return any(_derives(a, tainted) for a in node.args)
        if isinstance(func, ast.Attribute):
            if func.attr in BODY_READ_CALLS:
                return True
            if func.attr in STRING_METHODS:
                return _derives(func.value, tainted) or any(_derives(a, tainted) for a in node.args)
    return False


def _target_names(target):
    if isinstance(target, ast.Name):
        return [target.id]
    if isinstance(target, (ast.Tuple, ast.List)):
        return [n for elt in target.elts for n in _target_names(elt)]
    return []


def _tainted_names(func):
    tainted = set(CONTENT_NAMES)
    for node in ast.walk(func):
        if isinstance(node, ast.ExceptHandler) and node.name:
            tainted.add(node.name)
    changed = True
    while changed:
        changed = False
        for node in ast.walk(func):
            if isinstance(node, ast.Assign):
                pairs = [(t, node.value) for t in node.targets]
            elif isinstance(node, (ast.AnnAssign, ast.AugAssign, ast.NamedExpr)) and node.value is not None:
                pairs = [(node.target, node.value)]
            elif isinstance(node, (ast.For, ast.AsyncFor)):
                pairs = [(node.target, node.iter)]
            else:
                continue
            for target, value in pairs:
                if _derives(value, tainted):
                    new = set(_target_names(target)) - tainted
                    if new:
                        tainted |= new
                        changed = True
    return tainted


def _hard_refs(node, tainted):
    if isinstance(node, ast.Call):
        func = node.func
        if isinstance(func, ast.Name) and func.id in ALLOWED_WRAPPERS:
            return []
        if (
            isinstance(func, ast.Name)
            and func.id == "getattr"
            and len(node.args) >= 2
            and isinstance(node.args[1], ast.Constant)
            and node.args[1].value in SAFE_ATTRS
        ):
            return []
        if isinstance(func, ast.Attribute):
            if func.attr in ALLOWED_METHODS and not node.args and not node.keywords:
                return []
            if (
                func.attr == "format_exc"
                and isinstance(func.value, ast.Name)
                and func.value.id == "traceback"
            ):
                return ["traceback.format_exc()"]
            if func.attr in BODY_READ_CALLS:
                return [f".{func.attr}()"]
    if isinstance(node, ast.Attribute) and node.attr in SAFE_ATTRS:
        return []
    if isinstance(node, ast.Attribute) and node.attr in BODY_READ_ATTRS:
        return [f".{node.attr}"]
    if isinstance(node, ast.IfExp):
        # The test only decides which branch is logged; its value is never logged.
        return _hard_refs(node.body, tainted) + _hard_refs(node.orelse, tainted)
    if isinstance(node, ast.Name) and node.id in tainted:
        return [node.id]
    return [n for child in ast.iter_child_nodes(node) for n in _hard_refs(child, tainted)]


def _scan_function(func, label):
    tainted = _tainted_names(func)
    hits = []
    for call in (n for n in ast.walk(func) if _is_logger_call(n)):
        where = f"{label}:{call.lineno}: logger.{call.func.attr}"
        for arg in list(call.args) + [k.value for k in call.keywords if k.arg != "exc_info"]:
            for name in _hard_refs(arg, tainted):
                hits.append(f"{where} references {name}")
        if call.func.attr == "exception":
            hits.append(f"{where} logs a traceback above DEBUG")
        for k in call.keywords:
            if k.arg == "exc_info" and call.func.attr != "debug" and not (
                isinstance(k.value, ast.Constant) and not k.value.value
            ):
                hits.append(f"{where} logs a traceback above DEBUG")
    return hits


def _top_level_functions(src, names):
    tree = ast.parse(src)
    found = {
        n.name: n for n in tree.body
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name in names
    }
    assert sorted(found) == sorted(names), f"missing functions: {set(names) - set(found)}"
    return found


def test_r4_hardened_model_call_paths_log_no_error_or_body_text():
    hits = []
    calls = 0
    for path, names in HARDENED_SCOPE.items():
        for name, func in _top_level_functions(path.read_text(encoding="utf-8"), names).items():
            calls += sum(1 for n in ast.walk(func) if _is_logger_call(n))
            hits += _scan_function(func, f"{path.name}:{name}")
    assert calls > 60, "scan found too few logger calls; is it still parsing the scope?"
    assert hits == [], "D-28: log class/status/error_code/length only:\n" + "\n".join(hits)


def _scan_snippet(src):
    func = ast.parse(src).body[0]
    return _scan_function(func, "snippet")


@pytest.mark.parametrize("src", [
    # alias of a content name
    "def f(content):\n    x = content\n    logger.info(f'{x}')\n",
    # an except name, bare
    "def f():\n    try:\n        pass\n    except Exception as openai_err:\n"
    "        logger.info(f'  OpenAI format failed: {openai_err}')\n",
    # llm.py:618 at 4b57581: str(e) through a local
    "def f():\n    try:\n        pass\n    except Exception as e:\n        error_str = str(e)\n"
    "        logger.error(f'     Error message: {error_str}')\n",
    # transitive: str(e).lower() -> local -> f-string -> local
    "def f():\n    try:\n        pass\n    except Exception as e:\n        a = str(e).lower()\n"
    "        b = f'x {a[:10]}'\n        logger.warning('%s', b)\n",
    # a response-body read through a local
    "def f(resp):\n    b = resp.read()\n    logger.error(f'{b}')\n",
    "def f(resp):\n    logger.error(resp.text)\n",
    # traceback text and tracebacks above DEBUG
    "def f():\n    import traceback\n    logger.error(f'{traceback.format_exc()}')\n",
    "def f():\n    logger.warning('drain raised', exc_info=True)\n",
    "def f():\n    logger.exception('boom')\n",
    # getattr is allowed only for the status/error code
    "def f():\n    try:\n        pass\n    except Exception as e:\n"
    "        logger.error(f'{getattr(e, \"args\", None)}')\n",
])
def test_r4_hardened_scan_flags_the_leak_shapes(src):
    assert _scan_snippet(src), src


@pytest.mark.parametrize("src", [
    # an HTTPException detail is a client response, not a log (llm.py:629 stays)
    "def f(endpoint):\n    try:\n        pass\n    except Exception as e:\n        error_str = str(e)\n"
    "        raise HTTPException(status_code=500, detail=f'Error: {error_str}')\n",
    "def f():\n    try:\n        pass\n    except Exception as e:\n"
    "        logger.error(f'{type(e).__name__} {getattr(e, \"status_code\", None)} "
    "{getattr(e, \"error_code\", None)} {len(str(e))}')\n",
    "def f(response):\n    logger.error(f'returned {response.status_code}')\n",
    "def f(error_body):\n    logger.error(f'{len(error_body or b\"\")}')\n",
    "def f(previous_outputs):\n"
    "    logger.info(f\"{list(previous_outputs.keys()) if previous_outputs else 'None'}\")\n",
    "def f():\n    logger.debug('traceback', exc_info=True)\n",
    # a value read by key (.get) is a structured field, not text
    "def f(llm_response):\n    usage = llm_response.get('usage', {})\n    logger.info(f'{usage}')\n",
])
def test_r4_hardened_scan_allows_the_safe_shapes(src):
    assert _scan_snippet(src) == [], src


# ---------------------------------------------------------------------------
# R5–R7: runtime, a planted marker in error / body / prompt text
# ---------------------------------------------------------------------------

ERR_MARKER = "ZQX-ERR-PLANTED-4419"
_FORMATTER = logging.Formatter("%(message)s")


def _info_plus_leaks(caplog, marker=ERR_MARKER):
    """INFO+ records whose message or attached traceback holds the marker."""
    leaks = []
    for r in caplog.records:
        if r.levelno < logging.INFO:
            continue
        text = _FORMATTER.format(r)
        if marker in text:
            leaks.append(f"{r.name} {r.levelname}: {text[:300]!r}")
    return leaks


def _has_debug_traceback(caplog):
    return any(r.levelno == logging.DEBUG and r.exc_info for r in caplog.records)


class _RaisingApiClient:
    def __init__(self, exc):
        self._exc = exc

    def do(self, method, path, body):  # noqa: ARG002 — mimics the SDK signature
        raise self._exc


class _RaisingServingEndpoints:
    def query(self, **kwargs):  # noqa: ARG002 — mimics the SDK signature
        raise RuntimeError(f"agent endpoint said {ERR_MARKER}")

    def list(self):
        raise RuntimeError(f"list endpoints said {ERR_MARKER}")


class _RaisingClient:
    config = _FakeConfig()
    serving_endpoints = _RaisingServingEndpoints()

    def __init__(self, exc):
        self.api_client = _RaisingApiClient(exc)


@pytest.mark.parametrize("exc", [
    RuntimeError(f"upstream refused: {ERR_MARKER}"),
    # schema-shaped, so the agent-format fallback (make_request) runs and fails too
    RuntimeError(f"BAD_REQUEST: schema validation failed, missing inputs {ERR_MARKER}"),
], ids=["openai_path", "agent_fallback"])
def test_r5_serving_call_errors_reach_no_info_record(monkeypatch, caplog, exc):
    caplog.set_level(logging.DEBUG)
    with pytest.raises(HTTPException) as raised:
        _call(monkeypatch, _RaisingClient(exc))
    assert ERR_MARKER in raised.value.detail  # the client response is out of scope
    assert _info_plus_leaks(caplog) == []
    assert _has_debug_traceback(caplog)


def test_r5_workspace_client_factory_error_reaches_no_info_record(monkeypatch, caplog):
    from src.backend import identity

    def _boom(**kwargs):  # noqa: ARG001
        raise RuntimeError(f"auth config said {ERR_MARKER}")

    caplog.set_level(logging.DEBUG)
    monkeypatch.setattr(llm, "DATABRICKS_SDK_AVAILABLE", True)
    monkeypatch.setattr(llm, "_workspace_client", None)
    monkeypatch.setattr(identity, "get_tagged_workspace_client", _boom)
    assert llm.get_workspace_client() is None
    assert any("Could not initialize WorkspaceClient" in r.getMessage() for r in caplog.records)
    assert _info_plus_leaks(caplog) == []
    assert _has_debug_traceback(caplog)


def test_r5_endpoint_listing_error_reaches_no_info_record(monkeypatch, caplog):
    caplog.set_level(logging.DEBUG)
    monkeypatch.setattr(llm, "_available_endpoints_cache", None)
    monkeypatch.setattr(llm, "get_workspace_client", lambda: _RaisingClient(RuntimeError()))
    assert llm.get_available_serving_endpoints() == []
    assert any("Error listing serving endpoints" in r.getMessage() for r in caplog.records)
    assert _info_plus_leaks(caplog) == []


class _StreamConfig:
    host = "https://example.cloud.databricks.com"

    def __init__(self, auth_exc=None):
        self._auth_exc = auth_exc

    def authenticate(self):
        if self._auth_exc is not None:
            raise self._auth_exc
        return {"Authorization": "Bearer test"}


class _StreamClient:
    def __init__(self, auth_exc=None):
        self.config = _StreamConfig(auth_exc)


class _FakeStreamResponse:
    def __init__(self, status_code, body=b"", lines=()):
        self.status_code = status_code
        self._body = body
        self._lines = list(lines)

    async def aread(self):
        return self._body

    async def aiter_lines(self):
        for line in self._lines:
            yield line


class _FakeStreamCM:
    def __init__(self, outcome):
        self._outcome = outcome

    async def __aenter__(self):
        if isinstance(self._outcome, BaseException):
            raise self._outcome
        return self._outcome

    async def __aexit__(self, *exc):
        return False


def _fake_async_client(outcomes):
    """httpx.AsyncClient stand-in: each .stream() call takes the next outcome."""
    queue = list(outcomes)

    class _Client:
        def __init__(self, *args, **kwargs):  # noqa: ARG002
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        def stream(self, method, url, json=None, headers=None):  # noqa: ARG002
            return _FakeStreamCM(queue.pop(0))

    return _Client


def _drain_stream(monkeypatch, outcomes, auth_exc=None):
    monkeypatch.setenv("DATABRICKS_ENDPOINT_FALLBACK", "false")
    monkeypatch.setattr(llm, "_workspace_client", _StreamClient(auth_exc))
    monkeypatch.setattr(routes, "_BASE_DELAY", 0)
    monkeypatch.setattr(httpx, "AsyncClient", _fake_async_client(outcomes))

    async def _run():
        return [
            ev async for ev in routes._stream_with_retry(
                [{"role": "user", "content": "hi"}], max_tokens=10, temperature=0.5,
            )
        ]

    return asyncio.run(_run())


_DONE = _FakeStreamResponse(200, lines=["data: [DONE]"])


@pytest.mark.parametrize("outcomes,auth_exc,expect_error", [
    ([_FakeStreamResponse(400, body=f'{{"message": "{ERR_MARKER}"}}'.encode())], None, True),
    ([_FakeStreamResponse(503, body=f"busy {ERR_MARKER}".encode())] * 3, None, True),
    ([_DONE], RuntimeError(f"token refresh said {ERR_MARKER}"), False),
    ([httpx.ConnectError(f"connect said {ERR_MARKER}")] * 3, None, True),
    ([ValueError(f"bad frame {ERR_MARKER}")], None, True),
], ids=["http_400", "retry_exhausted_503", "auth_error", "retryable_exception", "non_retryable_exception"])
def test_r6_stream_errors_reach_no_info_record(monkeypatch, caplog, outcomes, auth_exc, expect_error):
    caplog.set_level(logging.DEBUG)
    events = _drain_stream(monkeypatch, outcomes, auth_exc)
    errors = [ev for ev in events if '"type": "error"' in ev]
    assert bool(errors) is expect_error, events
    assert any(r.levelno >= logging.WARNING for r in caplog.records), "no error was logged"
    assert _info_plus_leaks(caplog) == []


def test_r6_collector_drain_exception_reaches_no_info_record(monkeypatch, caplog):
    async def _raising_stream(*args, **kwargs):  # noqa: ARG001
        raise RuntimeError(f"drain said {ERR_MARKER}")
        yield  # pragma: no cover — makes this an async generator

    caplog.set_level(logging.DEBUG)
    monkeypatch.setattr(routes, "stream_llm_response", _raising_stream)
    assert asyncio.run(_REAL_COLLECT("ind", "uc", "prd_generation")) is None
    assert any("cause=exception" in r.getMessage() for r in caplog.records)
    assert _info_plus_leaks(caplog) == []
    assert _has_debug_traceback(caplog)


def _generate(monkeypatch, client):
    monkeypatch.setattr(
        routes, "get_section_input_content",
        lambda *a, **k: {"input": "Build the thing.", "system_prompt": "Be helpful."},
    )
    monkeypatch.setattr(llm, "DATABRICKS_SDK_AVAILABLE", True)
    monkeypatch.setattr(llm, "get_workspace_client", lambda: client)
    monkeypatch.setattr(llm, "get_best_available_endpoint", lambda: "ep")
    return asyncio.run(_REAL_GENERATE("ind", "uc", "prd_generation"))


def test_r7_generated_prompt_reaches_no_info_record(monkeypatch, caplog):
    generated = f"Generated prompt {ERR_MARKER} with the learner's draft text in it."
    caplog.set_level(logging.DEBUG)
    result = _generate(monkeypatch, _FakeClient({
        "choices": [{"message": {"content": generated}, "finish_reason": "stop"}],
        "model": "ep",
    }))
    assert result["prompt"] == generated
    assert result["source"] == "llm_generated"
    assert _info_plus_leaks(caplog) == []


def test_r7_generation_exception_reaches_no_info_record(monkeypatch, caplog):
    caplog.set_level(logging.DEBUG)
    result = _generate(monkeypatch, _RaisingClient(RuntimeError(f"upstream refused: {ERR_MARKER}")))
    assert result["prompt"] == "Build the thing."  # fell back to the input
    assert any("ERROR generating prompt with LLM" in r.getMessage() for r in caplog.records)
    assert _info_plus_leaks(caplog) == []
    assert _has_debug_traceback(caplog)


# ---------------------------------------------------------------------------
# R8: the edited functions differ from 4b57581 only in logging
# ---------------------------------------------------------------------------

R8_BASE_SHA = "4b57581aec86f7bdf66228705117f66c570c6458"
R8_EDITED = {
    "src/backend/api/routes.py": [
        "generate_prompt_content_with_llm",
        "_stream_with_retry",
        "collect_step_prompt_via_stream",
    ],
    "src/backend/services/llm.py": [
        "get_workspace_client",
        "get_available_serving_endpoints",
        "call_databricks_serving_endpoint",
    ],
}


def _is_logger_stmt(stmt):
    return isinstance(stmt, ast.Expr) and _is_logger_call(stmt.value)


def _is_traceback_import(stmt):
    return isinstance(stmt, ast.Import) and [a.name for a in stmt.names] == ["traceback"]


class _StripLogging(ast.NodeTransformer):
    def __init__(self, drop_traceback_import):
        self._drop_import = drop_traceback_import

    def generic_visit(self, node):
        super().generic_visit(node)
        for field, value in ast.iter_fields(node):
            if isinstance(value, list) and value and isinstance(value[0], ast.stmt):
                kept = [
                    s for s in value
                    if not _is_logger_stmt(s) and not (self._drop_import and _is_traceback_import(s))
                ]
                setattr(node, field, kept)
        return node


def _log_free_dump(func):
    _StripLogging(drop_traceback_import=False).visit(func)
    uses_traceback = any(
        isinstance(n, ast.Name) and n.id == "traceback" for n in ast.walk(func)
    )
    if not uses_traceback:
        _StripLogging(drop_traceback_import=True).visit(func)
    return ast.dump(func)


def _base_source(rel_path):
    if shutil.which("git") is None:
        pytest.skip("git is not available")
    out = subprocess.run(
        ["git", "show", f"{R8_BASE_SHA}:{rel_path}"],
        cwd=REPO_ROOT, capture_output=True, text=True,
    )
    if out.returncode != 0:
        pytest.fail(
            f"base SHA {R8_BASE_SHA} is not in this clone; fetch full history "
            f"(git fetch --unshallow) — R8 must not skip: {out.stderr.strip()}"
        )
    return out.stdout


@pytest.mark.parametrize("rel_path", sorted(R8_EDITED))
def test_r8_edited_functions_change_only_logging(rel_path):
    names = R8_EDITED[rel_path]
    base = _top_level_functions(_base_source(rel_path), names)
    head = _top_level_functions((REPO_ROOT / rel_path).read_text(encoding="utf-8"), names)
    for name in names:
        assert _log_free_dump(head[name]) == _log_free_dump(base[name]), (
            f"{rel_path}:{name} changed beyond logger calls vs {R8_BASE_SHA[:7]}"
        )


def test_r8_strip_keeps_a_non_log_change_visible():
    # Self-check: the T4 shape (a non-log statement beside a logger call) stays red.
    before = "def f():\n    try:\n        pass\n    except Exception as e:\n        logger.error('x')\n"
    after = (
        "def f():\n    try:\n        pass\n    except Exception as e:\n"
        "        x = str(e)\n        logger.error('x')\n"
    )
    assert _log_free_dump(ast.parse(before).body[0]) != _log_free_dump(ast.parse(after).body[0])
