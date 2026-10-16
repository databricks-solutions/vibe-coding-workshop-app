"""MCP strict owner: an HTTP request with no user identity cannot open a session
someone owns (VIBE_MCP_STRICT_OWNER, unset = on). In-process calls stay trusted."""

import copy
import pathlib
import sys
import types

import pytest
from fastapi import Request

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server  # noqa: E402

SID = "0f8e2c1a-1111-4222-8333-944455556666"
OWNER = "ada.lovelace@acme.com"


def _context(headers: dict[str, str]):
    scope = {"type": "http", "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()]}
    return types.SimpleNamespace(request_context=types.SimpleNamespace(request=Request(scope)))


ANONYMOUS = {}
AS_OWNER = {"x-forwarded-email": OWNER}
AS_OTHER = {"x-forwarded-email": "someone.else@acme.com"}


@pytest.fixture
def store(monkeypatch):
    rows = {
        SID: {
            "session_id": SID,
            "created_by": OWNER,
            "session_name": "Retail demo",
            "workshop_level": "genie-accelerator",
            "completed_gates": [],
            "captured_outputs": {},
            "session_parameters": {},
        }
    }
    monkeypatch.setattr(mcp_server, "load_session", lambda sid: copy.deepcopy(rows.get(sid)))
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: True)
    # A developer PGUSER email would make every request look identified.
    monkeypatch.delenv("PGUSER", raising=False)
    monkeypatch.delenv("VIBE_MCP_STRICT_OWNER", raising=False)
    return rows


def _load(headers):
    return mcp_server._load_session_for_request(SID, _context(headers) if headers is not None else None)


def test_an_anonymous_http_request_cannot_open_an_owned_session(store):
    assert _load(ANONYMOUS) is None


def test_the_owner_and_in_process_calls_still_can(store):
    assert _load(AS_OWNER) is not None
    assert _load(None) is not None  # no context: tests and local tooling


def test_another_user_is_refused_as_before(store):
    assert _load(AS_OTHER) is None


def test_a_session_nobody_owns_stays_open(store):
    for owner in (None, "", "unknown"):
        store[SID]["created_by"] = owner
        assert _load(ANONYMOUS) is not None, owner


@pytest.mark.parametrize("value", ["false", "0", "off", "no", " FALSE "])
def test_the_switch_restores_the_old_behaviour(store, monkeypatch, value):
    monkeypatch.setenv("VIBE_MCP_STRICT_OWNER", value)
    assert _load(ANONYMOUS) is not None
    assert _load(AS_OTHER) is None  # another user is refused either way


@pytest.mark.parametrize("value", ["", "true", "1", "on", "yes"])
def test_unset_or_any_other_value_is_strict(store, monkeypatch, value):
    monkeypatch.setenv("VIBE_MCP_STRICT_OWNER", value)
    assert _load(ANONYMOUS) is None


def test_tools_answer_an_anonymous_caller_with_invalid_session(store):
    ctx = _context(ANONYMOUS)
    for result in (
        mcp_server.vibe_next_step(SID, context=ctx),
        mcp_server.vibe_get_step(SID, context=ctx),
        mcp_server.vibe_start_track("genie-accelerator", session_id=SID, context=ctx),
    ):
        assert isinstance(result, dict), result
        assert result["structuredContent"]["error"]["code"] == "INVALID_SESSION"


def test_the_template_turns_it_on():
    text = (REPO_ROOT / "app.yaml.template").read_text()
    block = text.split("- name: VIBE_MCP_STRICT_OWNER", 1)[1].split("- name:", 1)[0]
    assert 'value: "true"' in block
