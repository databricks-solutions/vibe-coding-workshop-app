"""Workstream A — MCP always serves the ``genie-code`` prompt fork.

MCP is exclusively the Genie Code client, so every step must render the
``genie-code`` fork of ``section_input_prompts`` (falling back to
``__default__`` only when a tag has no fork). Before this wiring, MCP never set
``coding_assistant`` and the assembler defaulted every session to
``__default__`` — serving the Cursor/IDE copy-paste bodies over MCP.

These tests prove:
  1. ``vibe_get_step`` renders the fork body (integration through the real
     assembler with seeded default + fork rows) — the fork-only marker is
     present and the default marker is absent.
  2. ``_step_payload`` passes ``coding_assistant_override="genie-code"`` from
     both ``vibe_get_step`` and ``vibe_next_step`` (spy on the assembler seam).
  3. ``vibe_start_track`` persists ``coding_assistant`` on the session.
  4. ``vibe_set_parameters`` defaults ``coding_assistant`` and never drops it.
"""

import copy
import os
import sys
from pathlib import Path

# These tests never touch a real database; force the offline fallback path and
# the dev persona so importing routes needs no Databricks/Lakebase connectivity.
os.environ.setdefault("USE_LAKEBASE", "false")
os.environ.setdefault("DEV_PERSONA_SWITCH", "true")

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import pytest  # noqa: E402

from src.backend import mcp_server  # noqa: E402
from src.backend.api import routes  # noqa: E402

SESSION_ID = "coding-assistant-fork-session"
FORK_MARKER = ".vibecoding-state.md"
DEFAULT_MARKER = "Copy and paste this prompt to the AI"

# Two genie-accelerator tags that DO carry a genie-code fork in the real seed.
# Value = the requiresGate an explicit vibe_get_step read must satisfy.
FORKED_TAGS = {
    "semlayer_locate": None,
    "gold_layer_design": "genie_silver_metadata",
}

_WORKSHOP_PARAMS = {
    "workspace_url": "https://example.cloud.databricks.com",
    "default_warehouse": "wh-123",
    "lakebase_instance_name": "vibe-lakebase",
    "lakebase_host_name": "vibe-lakebase.example.com",
    "company_brand_url": "",  # empty -> no brand injection
}


def _usecase_rows():
    return [
        {
            "industry": "retail",
            "industry_label": "Retail",
            "use_case": "demand_forecasting",
            "use_case_label": "Demand Forecasting",
            "prompt_template": "Detailed demand forecasting description for retail.",
            "version": 1,
            "is_certified": True,
        }
    ]


def _section_rows():
    """A __default__ (Cursor/IDE) row + a genie-code fork row per forked tag."""
    rows = []
    for i, tag in enumerate(FORKED_TAGS):
        rows.append(
            {
                "section_tag": tag,
                "coding_assistant": routes.DEFAULT_CODING_ASSISTANT_KEY,
                "input_template": f"{DEFAULT_MARKER}: run the SQL for {tag}.",
                "system_prompt": "",
                "section_title": f"Title {tag}",
                "section_description": f"Description {tag}",
                "order_number": i + 1,
                "version": 1,
                "how_to_apply": f"How to apply {tag}.",
                "expected_output": f"Expected output {tag}.",
                "bypass_llm": True,  # input_template returned verbatim (no LLM)
                "how_to_apply_images": [],
                "expected_output_images": [],
            }
        )
        rows.append(
            {
                "section_tag": tag,
                "coding_assistant": "genie-code",
                "input_template": (
                    f"Genie Code bootstraps `{FORK_MARKER}` and seeds the brief for {tag}."
                ),
                "system_prompt": "",
                "section_title": f"IGNORED fork title {tag}",
                "section_description": f"IGNORED fork desc {tag}",
                "order_number": 99,
                "version": 1,
                "how_to_apply": "IGNORED fork how_to_apply",
                "expected_output": "IGNORED fork expected_output",
                "bypass_llm": True,
                "how_to_apply_images": [],
                "expected_output_images": [],
            }
        )
    return rows


@pytest.fixture
def seeded_prompt_rows(monkeypatch):
    """Seed default + genie-code fork rows into the in-memory fallback the
    assembler reads (via routes.*), resetting the TTL cache around the run."""
    routes.clear_lakebase_cache()
    usecase_rows = _usecase_rows()
    section_rows = _section_rows()
    monkeypatch.setattr(routes, "get_usecase_descriptions_from_lakebase", lambda: usecase_rows)
    monkeypatch.setattr(routes, "get_section_input_prompts_from_lakebase", lambda: section_rows)
    monkeypatch.setattr(routes, "get_workshop_parameters_sync", lambda: dict(_WORKSHOP_PARAMS))
    yield
    routes.clear_lakebase_cache()


@pytest.fixture
def session_store(monkeypatch):
    store = {
        SESSION_ID: {
            "session_id": SESSION_ID,
            "created_by": None,
            # Satisfies gold_layer_design's requiresGate for explicit reads.
            "completed_gates": ["genie_silver_metadata"],
            "captured_outputs": {},
            "session_parameters": {"industry": "retail", "use_case": "demand_forecasting"},
        }
    }
    saves = []

    def load_session(session_id):
        record = store.get(session_id)
        return copy.deepcopy(record) if record is not None else None

    def save_session(session_id, **fields):
        saves.append((session_id, copy.deepcopy(fields)))
        store.setdefault(session_id, {"session_id": session_id}).update(copy.deepcopy(fields))
        return True

    monkeypatch.setattr(mcp_server, "load_session", load_session)
    monkeypatch.setattr(mcp_server, "save_session", save_session)
    monkeypatch.setattr(mcp_server, "is_lakebase_configured", lambda: True)
    return store, saves


@pytest.mark.parametrize("tag", list(FORKED_TAGS))
def test_get_step_renders_genie_code_fork_body(seeded_prompt_rows, session_store, tag):
    payload = mcp_server.vibe_get_step(SESSION_ID, tag)

    assert payload.sectionTag == tag
    # The genie-code fork is served, not the Cursor/IDE default.
    assert FORK_MARKER in payload.prompt
    assert DEFAULT_MARKER not in payload.prompt


def _override_spy():
    captured = {}

    def _spy(**kwargs):
        captured.update(kwargs)
        return {"input": "x", "how_to_apply": "h", "expected_output": "o"}

    return captured, _spy


def test_get_step_passes_genie_code_override(session_store, monkeypatch):
    captured, spy = _override_spy()
    monkeypatch.setattr(mcp_server.assembler, "get_section_input_content", spy)

    mcp_server.vibe_get_step(SESSION_ID, "semlayer_locate")

    assert captured.get("coding_assistant_override") == "genie-code"


def test_next_step_passes_genie_code_override(session_store, monkeypatch):
    captured, spy = _override_spy()
    monkeypatch.setattr(mcp_server.assembler, "get_section_input_content", spy)

    mcp_server.vibe_next_step(SESSION_ID)

    assert captured.get("coding_assistant_override") == "genie-code"


def test_start_track_persists_genie_code_assistant(session_store):
    store, saves = session_store

    result = mcp_server.vibe_start_track("genie-accelerator")
    sid = result.session_id

    assert store[sid]["session_parameters"]["coding_assistant"] == "genie-code"
    assert saves[-1][1]["session_parameters"]["coding_assistant"] == "genie-code"


def test_set_parameters_defaults_genie_code_assistant(session_store):
    store, _ = session_store
    # Start from a session with no coding_assistant marker.
    store[SESSION_ID]["session_parameters"] = {"catalog": "main"}

    result = mcp_server.vibe_set_parameters(SESSION_ID, {"catalog": "analytics"})

    assert result.resolved_params["coding_assistant"] == "genie-code"
    assert store[SESSION_ID]["session_parameters"]["coding_assistant"] == "genie-code"
