import asyncio
import pathlib
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server


def _render_prompt(name, arguments=None):
    prompt = next(item for item in mcp_server.mcp._prompt_manager.list_prompts() if item.name == name)
    messages = asyncio.run(prompt.render(arguments or {}))
    return "\n".join(message.content.text for message in messages)


def test_start_prompt_and_first_step_include_orientation(monkeypatch):
    orientation = "FIRST-RUN ORIENTATION"
    monkeypatch.setattr(mcp_server, "ORIENTATION_PREAMBLE", orientation)
    start_text = _render_prompt("Start the Genie Accelerator")
    assert orientation in start_text

    monkeypatch.setattr(mcp_server, "_load_session_for_request", lambda *_args, **_kwargs: ({}, "test"))
    payload = mcp_server.vibe_get_step("test-session")
    assert orientation in payload.orientation


def test_continue_prompt_skips_orientation():
    text = _render_prompt("Continue where I left off")
    assert "orientation" not in text.lower()
    assert "vibe_next_step" in text


def test_guide_and_workshop_prompt_are_self_serve():
    guide = mcp_server.read_getting_started()
    assert "troubleshoot" in guide.lower()
    assert "20-tool" in guide
    workshop_text = _render_prompt("How does this workshop work?")
    assert "vibe_" not in workshop_text
    assert "vibe://guide/getting-started" in workshop_text


def test_orientation_free_client_reaches_step_one_with_prompts_and_resources(monkeypatch):
    assert "vibe://guide/getting-started" in _render_prompt("How does this workshop work?")
    assert "vibe_start_track" in _render_prompt("Start the Genie Accelerator")
    monkeypatch.setattr(mcp_server, "_load_session_for_request", lambda *_args, **_kwargs: ({}, "test"))
    payload = mcp_server.vibe_get_step("test-session")
    assert payload.sectionTag == "project_setup"
    assert payload.prompt
