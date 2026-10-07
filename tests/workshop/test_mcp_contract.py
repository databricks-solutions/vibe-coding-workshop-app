import asyncio
import json
import pathlib
import re
import sys

import jsonschema
import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend import mcp_server

EXPECTED_TOOLS = {
    "vibe_start_track",
    "vibe_get_step",
    "vibe_next_step",
    "vibe_explain_step",
    "vibe_complete_step",
    "vibe_submit_answer",
    "vibe_set_parameters",
}

EXPECTED_ANNOTATIONS = {
    "vibe_start_track": (False, False, True, True),
    "vibe_get_step": (True, False, True, True),
    "vibe_next_step": (True, False, True, True),
    "vibe_explain_step": (True, False, True, True),
    "vibe_complete_step": (False, False, True, True),
    "vibe_submit_answer": (False, False, True, True),
    "vibe_set_parameters": (False, False, True, True),
}


def _tools_by_name():
    return {tool.name: tool for tool in mcp_server.mcp._tool_manager.list_tools()}


def test_exactly_seven_tools_with_contract_metadata():
    tools = _tools_by_name()
    assert set(tools) == EXPECTED_TOOLS
    assert len(tools) == 7

    for name, tool in tools.items():
        assert 200 <= len(tool.description or "") <= 400, name
        assert tool.parameters["type"] == "object"
        assert len(tool.parameters.get("properties", {})) < 8
        assert tool.output_schema is not None
        annotations = tool.annotations
        assert annotations is not None
        actual = (
            annotations.readOnlyHint,
            annotations.destructiveHint,
            annotations.idempotentHint,
            annotations.openWorldHint,
        )
        assert actual == EXPECTED_ANNOTATIONS[name]


def test_registered_tools_return_schema_valid_structured_content_and_text():
    tools = _tools_by_name()
    for name, tool in tools.items():
        if name == "vibe_start_track":
            arguments = {"track": "genie-accelerator"}
        elif name in {"vibe_get_step", "vibe_next_step", "vibe_explain_step"}:
            arguments = {"session_id": "test-session"}
        elif name == "vibe_complete_step":
            arguments = {
                "session_id": "test-session",
                "sectionTag": "project_setup",
                "captured_output": "output",
            }
        elif name == "vibe_submit_answer":
            arguments = {
                "session_id": "test-session",
                "interaction_id": "project_setup.why",
                "answer": "yes",
            }
        else:
            arguments = {"session_id": "test-session", "params": {}}

        result = asyncio.run(tool.run(arguments, convert_result=True))
        assert isinstance(result, tuple), name
        text_content, structured_content = result
        assert structured_content
        assert text_content
        jsonschema.validate(structured_content, tool.output_schema)
        mirrored = json.loads(text_content[0].text)
        assert mirrored == structured_content or mirrored == structured_content.get("result") or mirrored.get("result") == structured_content


def test_next_step_union_admits_blocked_variant():
    """PR B: the ``NextStepResult`` union gains a third member ``BlockedResult``.

    DoneResult is untouched (``{done:true}`` with no extras) and a blocked payload
    must NOT carry a top-level step shape. Stripping the union member or its
    ``blocked_by`` field (T2) flips the blocked validation below to a failure."""

    schema = mcp_server.NextStepResult.model_json_schema()
    blocked = {
        "blocked": True,
        "blocked_by": {"sectionTag": "beta", "title": "Beta", "requiresGate": "ghost_gate"},
        "message": "configuration problem",
    }
    jsonschema.validate(blocked, schema)

    # DoneResult shape unchanged: `{done: true}`, no extra keys.
    jsonschema.validate({"done": True}, schema)
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate({"done": True, "extra": 1}, schema)

    # A blocked payload must not look like a step (no top-level sectionTag), and
    # `blocked_by` is required.
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate({**blocked, "sectionTag": "beta"}, schema)
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate({"blocked": True, "message": "m"}, schema)


def test_read_tool_errors_are_typed_results():
    expected = {"UNKNOWN_TRACK", "INVALID_SESSION", "UNKNOWN_STEP", "STEP_LOCKED"}
    results = mcp_server.contract_error_results_for_tests()
    assert expected.issubset(results)
    for code, result in results.items():
        assert result["isError"] is True, code
        assert result["structuredContent"]["error"]["code"] == code
        assert any(code in block.text for block in result["content"])


def test_resources_declare_ttl_and_cache_scope():
    resources = list(mcp_server.mcp._resource_manager.list_resources())
    templates = list(mcp_server.mcp._resource_manager.list_templates())
    all_resources = resources + templates
    # 4 workshop resources + the 2 use-case discovery resources (D11 §3.1):
    # vibe://usecases/industries (concrete) and vibe://usecases/{industry} (template).
    assert len(all_resources) == 6
    for resource in all_resources:
        assert resource.meta["ttlMs"] >= 0
        assert resource.meta["cacheScope"] in {"global", "session"}

    session_resource = next(
        resource for resource in templates if resource.uri_template == "vibe://session/{session_id}/state"
    )
    assert session_resource.meta["ttlMs"] == 0
    assert session_resource.meta["cacheScope"] == "session"


def test_prompts_restate_verbatim_first_contract():
    prompts = {prompt.name: prompt for prompt in mcp_server.mcp._prompt_manager.list_prompts()}
    assert set(prompts) == {
        "Start the Genie Accelerator",
        "Start a workshop track",
        "Continue where I left off",
        "How does this workshop work?",
    }
    for prompt in prompts.values():
        messages = asyncio.run(prompt.render({}))
        text = "\n".join(message.content.text for message in messages)
        assert "verbatim" in text.lower()


def test_spa_start_prompt_names_match_mcp_prompts():
    # startPromptForTrack (D-59) returns only these two constants; each must be
    # a registered prompt name, or the panel tells the learner to say a prompt
    # Genie Code does not have.
    source = (REPO_ROOT / "src/constants/genieCodeMcpConnection.ts").read_text()
    names = {
        constant: re.search(rf"export const {constant} = '([^']+)';", source).group(1)
        for constant in ("GENIE_ACCELERATOR_START_PROMPT", "GENERIC_TRACK_START_PROMPT")
    }
    returned = set(re.findall(r"prompt: (\w+_START_PROMPT)", source))
    assert returned == set(names)
    prompt_names = {prompt.name for prompt in mcp_server.mcp._prompt_manager.list_prompts()}
    for constant, name in names.items():
        assert name in prompt_names, f"{constant}={name!r} is not an MCP prompt"
