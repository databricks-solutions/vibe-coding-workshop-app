"""Suggestion (c) — authored ``user_trigger_prompt`` + user-triggered doctrine.

Every genie-accelerator step carries an authored plain-English ``user_trigger_prompt``
— the ask the agent hands the learner so THEY trigger the step, instead of the agent
auto-executing the next step. This exercises the whole plumbing:

  1. The assembler returns ``user_trigger_prompt`` (11-key contract), substitutes
     params into it, and takes it from the shared ``__default__`` row even when a
     ``genie-code`` fork is selected (it is a shared field like how_to_apply).
  2. ``_step_payload`` / ``ExplainabilityPayload`` expose and populate it; absent
     content degrades to an empty string, never a crash.
  3. Seed contract — the authored trigger prompts actually landed in the app seed.
  4. Doctrine — the orientation/getting-started text and the get_step/next_step
     tool descriptions instruct presenting the trigger and waiting.
"""

import copy
import pathlib
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server  # noqa: E402
from src.backend.api import routes  # noqa: E402
from src.backend.workshop import assembler  # noqa: E402

TAG = "prd_generation"

_TRIGGER_DEFAULT = "Kick off {use_case_title} now."  # token proves substitution
_TRIGGER_FORK = "FORK TRIGGER — must be ignored (shared field wins)"

_WORKSHOP_PARAMS = {
    "workspace_url": "https://example.cloud.databricks.com",
    "default_warehouse": "wh-123",
    "lakebase_instance_name": "vibe-lakebase",
    "lakebase_host_name": "vibe-lakebase.example.com",
    "company_brand_url": "",
}


def _usecase_rows():
    return [{
        "industry": "retail",
        "industry_label": "Retail",
        "use_case": "curbside_eta",
        "use_case_label": "Curbside ETA",
        "prompt_template": "A curbside ETA app for retail.",
        "version": 1,
        "is_certified": True,
    }]


def _section_rows():
    """A __default__ row (shared fields authoritative) + a genie-code fork whose
    user_trigger_prompt must be IGNORED in favour of the default's."""
    return [
        {
            "section_tag": TAG,
            "coding_assistant": routes.DEFAULT_CODING_ASSISTANT_KEY,
            "input_template": "Default body for {use_case_title}.",
            "system_prompt": "System for {industry_name}.",
            "section_title": f"Title {TAG}",
            "section_description": f"Desc {TAG}",
            "order_number": 3,
            "version": 1,
            "how_to_apply": "How to apply.",
            "expected_output": "Expected output.",
            "user_trigger_prompt": _TRIGGER_DEFAULT,
            "bypass_llm": False,
            "how_to_apply_images": [],
            "expected_output_images": [],
        },
        {
            "section_tag": TAG,
            "coding_assistant": "genie-code",
            "input_template": "[genie-code] body for {use_case_title}.",
            "system_prompt": "[genie-code] system.",
            "section_title": "IGNORED fork title",
            "section_description": "IGNORED fork desc",
            "order_number": 99,
            "version": 1,
            "how_to_apply": "IGNORED",
            "expected_output": "IGNORED",
            "user_trigger_prompt": _TRIGGER_FORK,
            "bypass_llm": False,
            "how_to_apply_images": [],
            "expected_output_images": [],
        },
    ]


@pytest.fixture
def seeded_rows(monkeypatch):
    routes.clear_lakebase_cache()
    monkeypatch.setattr(routes, "get_usecase_descriptions_from_lakebase", _usecase_rows)
    monkeypatch.setattr(routes, "get_section_input_prompts_from_lakebase", _section_rows)
    monkeypatch.setattr(routes, "get_workshop_parameters_sync", lambda: dict(_WORKSHOP_PARAMS))
    yield
    routes.clear_lakebase_cache()


# --- 1. Assembler: returns, substitutes, shared-field carry ------------------


def test_assembler_returns_and_substitutes_user_trigger_prompt(seeded_rows):
    out = assembler.get_section_input_content("retail", "curbside_eta", TAG)
    assert "user_trigger_prompt" in out
    # The {use_case_title} token was substituted (derived from the use-case slug).
    assert out["user_trigger_prompt"] == "Kick off Curbside Eta now."
    assert "{use_case_title}" not in out["user_trigger_prompt"]


def test_user_trigger_prompt_is_a_shared_field_from_default_on_fork(seeded_rows):
    # Selecting the genie-code fork still takes the trigger from __default__.
    out = assembler.get_section_input_content(
        "retail", "curbside_eta", TAG, coding_assistant_override="genie-code"
    )
    assert out["coding_assistant_variant"] == "genie-code"
    # Fork body is used for the prompt, but the shared trigger comes from default.
    assert out["input"].startswith("[genie-code]")
    assert out["user_trigger_prompt"] == "Kick off Curbside Eta now."
    assert "FORK TRIGGER" not in out["user_trigger_prompt"]


# --- 2. Payload exposure -----------------------------------------------------


def _step(section_tag):
    steps = mcp_server.engine.MANIFEST.track_steps(mcp_server.DEFAULT_TRACK)
    step = next((s for s in steps if s.sectionTag == section_tag), None)
    assert step is not None, section_tag
    return step


def test_step_payload_populates_user_trigger_prompt(monkeypatch):
    monkeypatch.setattr(
        mcp_server.assembler,
        "get_section_input_content",
        lambda **kwargs: {
            "input": "body",
            "how_to_apply": "how",
            "expected_output": "expected",
            "user_trigger_prompt": "Let's create the PRD for my app.",
        },
    )
    state = mcp_server.engine.SessionState()
    payload = mcp_server._step_payload(mcp_server.DEFAULT_TRACK, state, _step(TAG))
    assert payload.user_trigger_prompt == "Let's create the PRD for my app."


def test_step_payload_trigger_degrades_to_empty_string(monkeypatch):
    monkeypatch.setattr(
        mcp_server.assembler,
        "get_section_input_content",
        lambda **kwargs: {"input": "body", "how_to_apply": "", "expected_output": ""},
    )
    state = mcp_server.engine.SessionState()
    payload = mcp_server._step_payload(mcp_server.DEFAULT_TRACK, state, _step(TAG))
    assert payload.user_trigger_prompt == ""


# --- 3. Seed contract — the authored prompts landed --------------------------

_SEED = (
    REPO_ROOT / "db" / "lakebase" / "dml_seed" / "02_seed_section_input_prompts.sql"
).read_text()

# A representative phrase from each genie family, proving the splice reached the
# app seed across prefixes and the non-prefixed exact tags.
_SEEDED_PHRASES = [
    "Let''s create the PRD for my app.",                 # prd_generation (exact)
    "Draft the measure inventory for my data",           # semlayer_ (prefix)
    "Run the benchmark scorer on my Genie Agent",        # gagent_ (prefix)
    "Help me set up the Discover domain and subdomains", # ontology_ (prefix)
    "Have Genie build an AI/BI dashboard",               # gaccel_ (prefix)
    "Create the Synced Tables from my Gold layer",       # activation_ (prefix)
    "Help me safely clean up and delete all",            # workspace_cleanup (exact)
]


def test_seed_declares_user_trigger_prompt_column():
    assert "user_trigger_prompt" in _SEED


@pytest.mark.parametrize("phrase", _SEEDED_PHRASES)
def test_authored_trigger_prompts_reached_the_app_seed(phrase):
    assert phrase in _SEED, f"missing seeded trigger prompt: {phrase!r}"


# --- 4. Doctrine — present the trigger and wait ------------------------------


def _tool_desc(name):
    tool = next(t for t in mcp_server.mcp._tool_manager.list_tools() if t.name == name)
    return tool.description or ""


def test_orientation_and_getting_started_teach_user_triggered_steps():
    for text in (mcp_server.ORIENTATION_PREAMBLE, mcp_server.GETTING_STARTED_GUIDE):
        low = text.lower()
        assert "user_trigger_prompt" in text
        assert "wait" in low
        assert "auto" in low  # "never auto-run" / "do not auto-execute"


def test_get_and_next_step_descriptions_present_the_trigger_and_wait():
    for name in ("vibe_get_step", "vibe_next_step"):
        desc = _tool_desc(name)
        assert "user_trigger_prompt" in desc, name
        low = desc.lower()
        assert "wait" in low or "auto-run" in low, name
