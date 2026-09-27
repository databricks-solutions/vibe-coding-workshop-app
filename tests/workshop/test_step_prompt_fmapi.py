"""Workstream #2 - the MCP step prompt is rendered through the app FMAPI.

The web path generates each copy-paste prompt via
``routes.generate_prompt_content_with_llm`` (system_prompt + assembled input ->
serving endpoint). The MCP path must match it for consistency, degrading to the
assembled template verbatim whenever the section bypasses the LLM or the
endpoint is unavailable. Only a genuine ``source == "llm_generated"`` result
replaces the template; results are cached per (session, section, input-hash).
"""

import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.api import routes
from src.backend.workshop import engine, manifest

TRACK = "genie-accelerator"
INDUSTRY = "Technology"
USE_CASE = "Genie Accelerator"


def _assembled(**overrides):
    base = {
        "input": "TEMPLATE BODY",
        "system_prompt": "SYS",
        "how_to_apply": "how",
        "expected_output": "out",
        "user_trigger_prompt": "",
        "bypass_llm": False,
    }
    base.update(overrides)
    return base


def _content_step():
    """A normal (non-special-cased, LLM-generated) content step from the track."""
    steps = manifest.load_manifest().track_steps(TRACK)
    return next(s for s in steps if s.sectionTag == "prd_generation")


def _stub_generate(monkeypatch, source, prompt="GEN", counter=None):
    async def fake(*args, **kwargs):
        if counter is not None:
            counter["n"] += 1
        return {"source": source, "prompt": prompt}

    monkeypatch.setattr(routes, "generate_prompt_content_with_llm", fake)


def test_generate_step_prompt_uses_llm_generated(monkeypatch):
    _stub_generate(monkeypatch, "llm_generated", "GENERATED PROMPT")
    out = mcp_server._generate_step_prompt(
        INDUSTRY, USE_CASE, "prd_generation", _assembled(), {}, "sess-1"
    )
    assert out == "GENERATED PROMPT"


def test_generate_step_prompt_bypass_skips_fmapi(monkeypatch):
    counter = {"n": 0}
    _stub_generate(monkeypatch, "llm_generated", "SHOULD NOT RUN", counter=counter)
    out = mcp_server._generate_step_prompt(
        INDUSTRY, USE_CASE, "prd_generation", _assembled(bypass_llm=True), {}, "sess-b"
    )
    assert out is None
    assert counter["n"] == 0


@pytest.mark.parametrize("source", ["mock_llm", "fallback_due_to_error", "input_only_no_llm"])
def test_generate_step_prompt_falls_back_on_non_llm_source(monkeypatch, source):
    _stub_generate(monkeypatch, source, "IGNORED")
    out = mcp_server._generate_step_prompt(
        INDUSTRY, USE_CASE, "prd_generation", _assembled(), {}, "sess-f"
    )
    assert out is None


def test_generate_step_prompt_caches_llm_generated(monkeypatch):
    counter = {"n": 0}
    _stub_generate(monkeypatch, "llm_generated", "CACHED", counter=counter)
    first = mcp_server._generate_step_prompt(
        INDUSTRY, USE_CASE, "prd_generation", _assembled(), {}, "sess-cache"
    )
    second = mcp_server._generate_step_prompt(
        INDUSTRY, USE_CASE, "prd_generation", _assembled(), {}, "sess-cache"
    )
    assert first == second == "CACHED"
    assert counter["n"] == 1  # second read served from cache


def test_step_payload_prompt_is_fmapi_generated(monkeypatch):
    _stub_generate(monkeypatch, "llm_generated", "FMAPI PROMPT")
    monkeypatch.setattr(
        mcp_server.assembler, "get_section_input_content", lambda **kwargs: _assembled()
    )
    payload = mcp_server._step_payload(
        TRACK, engine.SessionState(), _content_step(), session_id="sess-int"
    )
    assert payload.prompt == "FMAPI PROMPT"


def test_step_payload_prompt_falls_back_to_template(monkeypatch):
    _stub_generate(monkeypatch, "fallback_due_to_error", "IGNORED")
    monkeypatch.setattr(
        mcp_server.assembler,
        "get_section_input_content",
        lambda **kwargs: _assembled(input="VERBATIM TEMPLATE"),
    )
    payload = mcp_server._step_payload(
        TRACK, engine.SessionState(), _content_step(), session_id="sess-fb"
    )
    assert payload.prompt == "VERBATIM TEMPLATE"
