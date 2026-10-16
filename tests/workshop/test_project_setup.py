"""Workstream #5 - project_setup surfaces the real Genie Code one-time setup.

`project_setup` authors no seed row, so the MCP path used to serve an empty
template + a quiz and the clone/publish/validate steps never ran. The step now
mirrors the web UI's SetUpProjectStep (genie-code variant): three gated commands
(clone -> publish skills -> validate) plus a verify-first manifest load, with the
learner's email driving the /Workspace paths.
"""

import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server
from src.backend.workshop import engine, manifest

TRACK = "genie-accelerator"
REPO_URL = "https://github.com/databricks-solutions/vibe-coding-workshop-template.git"


def _project_setup_step():
    steps = manifest.load_manifest().track_steps(TRACK)
    return next(s for s in steps if s.sectionTag == "project_setup")


def test_project_setup_content_renders_commands_with_email():
    content = mcp_server._project_setup_content("dev@example.com")
    for key in ("prompt", "how_to_apply", "expected_output", "user_trigger_prompt"):
        assert content[key], key

    prompt = content["prompt"]
    # 1) clone into the learner's project folder
    assert (
        f"git clone {REPO_URL} /Workspace/Users/dev@example.com/vibe-coding-workshop"
        in prompt
    )
    # 2) publish the clone into the skills load path
    assert "/Workspace/Users/dev@example.com/.assistant/skills/vibe-coding-workshop" in prompt
    # 3) validate + verify the behavior manifest
    assert "genie-code-environment/SKILL.md" in prompt
    assert "✅" in content["expected_output"]


def test_project_setup_content_falls_back_to_placeholder():
    content = mcp_server._project_setup_content("")
    assert "<your_email>" in content["prompt"]
    assert "dev@example.com" not in content["prompt"]


def test_step_payload_project_setup_uses_setup_content_and_trigger():
    state = engine.SessionState()
    state.session_parameters["user_email"] = "learner@acme.com"
    payload = mcp_server._step_payload(TRACK, state, _project_setup_step(), session_id="s")

    assert "git clone" in payload.prompt
    assert "learner@acme.com" in payload.prompt
    assert payload.user_trigger_prompt.startswith("Set up my project")
    # The wait doctrine rides the setup step too.
    assert payload.instruction == mcp_server.STEP_WAIT_DIRECTIVE
    # The comprehension quiz is still a sibling (and still redacted, per #1).
    assert payload.interaction is not None


def test_step_payload_project_setup_email_placeholder_without_identity():
    payload = mcp_server._step_payload(
        TRACK, engine.SessionState(), _project_setup_step(), session_id="s"
    )
    assert "<your_email>" in payload.prompt


def test_start_track_persists_user_email(monkeypatch):
    saved = {}

    def fake_save(session_id, **fields):
        saved.update(fields)
        return True

    monkeypatch.setattr(mcp_server, "load_session", lambda session_id: None)
    monkeypatch.setattr(mcp_server, "save_session", fake_save)
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: True)
    monkeypatch.setattr(mcp_server, "_request_user", lambda ctx: "learner@acme.com")

    mcp_server.vibe_start_track("genie-accelerator")

    assert saved["session_parameters"]["user_email"] == "learner@acme.com"
