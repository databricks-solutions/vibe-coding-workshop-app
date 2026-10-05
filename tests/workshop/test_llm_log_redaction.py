"""llm.py never logs model output (llm-response-log-redact, D-27; D7 security.md §6/§8).

Four offline tests:

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
"""

import ast
import asyncio
import logging
import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.services import llm  # noqa: E402

LLM_PY = REPO_ROOT / "src" / "backend" / "services" / "llm.py"
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
