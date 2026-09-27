"""Shared offline guards for the workshop MCP test suite.

The MCP step payload now renders its prompt through the app FMAPI
(`generate_prompt_content_with_llm`) to match the web path. Left unstubbed that
would fire a real serving-endpoint call on every `vibe_get_step`, making the
offline suite slow and non-deterministic. The autouse fixture below defaults the
FMAPI to a fallback signal (``source != "llm_generated"``), so `_step_payload`
degrades to the assembled template exactly as it does when the endpoint is
unavailable. Tests that exercise the FMAPI wiring re-stub it with their own
`monkeypatch.setattr(routes, "generate_prompt_content_with_llm", ...)`.
"""

import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.api import routes


@pytest.fixture(autouse=True)
def _offline_step_prompt_fmapi(monkeypatch):
    async def _fake_generate(*args, **kwargs):
        # Offline default: no live generation -> _step_payload keeps the template.
        return {"source": "mock_llm", "prompt": ""}

    monkeypatch.setattr(routes, "generate_prompt_content_with_llm", _fake_generate)
    mcp_server._STEP_PROMPT_CACHE.clear()
    yield
    mcp_server._STEP_PROMPT_CACHE.clear()
