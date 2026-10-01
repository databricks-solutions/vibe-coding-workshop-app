"""MCP adapter for the Vibe Coding Workshop."""

from __future__ import annotations

import asyncio
import contextvars
import hashlib
import json
import logging
import threading
import uuid
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any, Callable, Literal

import jsonschema
from fastapi import Request
from mcp.server.fastmcp import Context, FastMCP
from mcp.server.fastmcp.resources.types import FunctionResource, TextResource
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import (
    CallToolRequest,
    CallToolResult,
    ListToolsRequest,
    ServerResult,
    TextContent,
    ToolAnnotations,
)
from pydantic import BaseModel, ConfigDict, Field, RootModel

from .services.lakebase import (
    append_session_interaction,
    is_lakebase_configured,
    load_session,
    save_session,
)
from .workshop import assembler, engine, manifest
from .workshop.state import build_session_state

logger = logging.getLogger(__name__)

DEFAULT_TRACK = "genie-accelerator"
DEFAULT_INDUSTRY = "Technology"
DEFAULT_USE_CASE = "Genie Accelerator"
# MCP is exclusively the Genie Code client, so every step renders the
# 'genie-code' prompt fork. Steps without a fork fall back to '__default__'
# automatically inside the assembler.
DEFAULT_CODING_ASSISTANT = "genie-code"

ORIENTATION_PREAMBLE = (
    "First-run orientation: answer questions in chat; silence accepts the recommended default. "
    "Each step is learner-triggered — present the step, hand over its `user_trigger_prompt` (the "
    "plain-English ask), and WAIT for the learner to submit it before doing the work. Never auto-run "
    "the next step on your own. Step payloads are lean; call `vibe_explain_step` when the learner asks "
    "how to apply a step or what to expect. "
    "The track saves progress server-side and does not block, except for one benchmark hard stop. "
    "You can mirror progress in the web UI using the same session. If tools go missing, disconnect "
    "other MCP servers to stay within the 20-tool budget."
)

# Re-injected on EVERY step that authors a trigger (not just step 1): MCP is
# advisory, so the wait doctrine has to ride each payload or the agent drifts
# back into auto-running the next step (Workstream #4).
STEP_WAIT_DIRECTIVE = (
    "STOP — this step is learner-triggered. Surface `user_trigger_prompt` to the "
    "learner verbatim and WAIT for them to send it back. Do not call "
    "vibe_complete_step or vibe_next_step until the learner responds in a fresh "
    "turn; never chain steps on your own."
)

GETTING_STARTED_GUIDE = """# Getting started

This workshop is a guided conversation. Start a track, read each prompt verbatim, then narrate why
it matters. Step payloads are lean — call `vibe_explain_step` for how-to detail and expected
deliverables when the learner asks. Answer questions in chat; silence accepts the recommended
default. Progress is saved server-side and can be mirrored in the web UI using the same session.

Steps are learner-triggered. After you present a step, hand the learner its `user_trigger_prompt` —
a simple English prompt they submit back to you — and wait for them to send it before you do the
work. Do not auto-execute the next step; the trigger to move forward always comes from the learner.

There is one hard stop: the benchmark step requires an explicit confirmation before it can advance.
Everything else is designed to keep moving without pop-up forms or client elicitation.

Troubleshooting:
- 20-tool budget: disconnect other MCP servers if these tools are missing.
- Stateless server: every request reads current session state from Lakebase.
- 307 redirect: the app must mount the MCP HTTP app before the SPA catch-all.
"""

VIBECODING_STYLE = """# Vibe Coding gate ledger

Use `.vibecoding-state.md` as the server-side progress ledger. Keep Tier-G READ and RECORD
bookends around important actions. The MCP surface is additive to the web UI: it reads the same
session state and presents the same step prompts without rewriting their verbatim bodies.
"""


class OutlineItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sectionTag: str
    title: str
    status: Literal["done", "current", "locked", "skipped"]
    execution: str


class StepReference(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sectionTag: str
    title: str


class DoneResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    done: Literal[True] = True


class InteractionOption(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    label: str


class Interaction(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    type: Literal["comprehension", "decision", "confirm"]
    question: str
    options: list[InteractionOption] = Field(default_factory=list)
    recommended: str | None = None
    skippable: bool
    coaching: dict[str, str] = Field(default_factory=dict)


class ExplainabilityPayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    sectionTag: str
    title: str
    why: str
    prompt: str
    # The plain-English ask the learner submits to START this step. The agent
    # presents it and waits for the learner to say it, rather than auto-running
    # the step (suggestion c). Empty when a step authors no trigger.
    user_trigger_prompt: str = ""
    # Per-step wait doctrine, present on every step that authors a trigger so the
    # agent re-reads "present the trigger and WAIT" on each turn (Workstream #4).
    # Kept adjacent to user_trigger_prompt so the trigger + wait doctrine ride
    # together near the top of a deliberately slim payload. how_to_apply and
    # expected_output moved OFF the step payload to the on-demand vibe_explain_step
    # tool: the big markdown blocks inflated context and let the client drift out
    # of the "present trigger -> WAIT" ritual on later steps.
    instruction: str | None = None
    gate: str | None
    requiresGate: str | None
    consumes: list[str]
    produces: str | None
    execution: Literal["agent-doable", "ui-driven", "hybrid"]
    next: StepReference
    interaction: dict[str, Interaction | None] | None = None
    orientation: str | None = None
    # Use-case discovery inlined into the tool payload (Workstream D): the Genie
    # Code agent cannot read vibe:// resources, so the use_case_selection step
    # carries the curated industry options here, plus the certified-first use
    # cases for the chosen industry once one is set. None on every other step.
    available_industries: list[dict[str, Any]] | None = None
    available_use_cases: list[dict[str, Any]] | None = None
    # Data-location CUJ (Workstream 1): the effective source {catalog, schema,
    # is_overridden} on the Locate Data step, mirroring the web LakehouseParams
    # editor. None on every other step.
    data_location: dict[str, Any] | None = None


class StartTrackResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: str
    track: str
    outline: list[OutlineItem]
    # Deep-link handoff (Workstream 2): a ready-to-open web-UI URL for this session
    # (``<base>?sessionId=<id>``), or None when the request host is unavailable.
    session_url: str | None = None


class CompleteStepResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    completed_gates: list[str]
    next: ExplainabilityPayload | DoneResult
    # Advisory re-surfacing of the just-completed step's post-comprehension check
    # (answer key redacted). Non-gating: it nudges the agent to ask the quiz at
    # the moment it is due, since the slim step payload + long-run drift let the
    # client silently skip the optional post check. None when the step has no
    # post check or the learner already answered it.
    post_check: Interaction | None = None


class StepHelpResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # On-demand help for a step (how_to_apply + expected_output), moved OFF the
    # step payload to keep it slim. Fetched only when the learner asks how to
    # apply a step or what to expect.
    sectionTag: str
    title: str
    why: str
    how_to_apply: str
    expected_output: str


class SubmitAnswerResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    recorded: bool
    coaching: str
    unblocks: str | None


class SetParametersResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    resolved_params: dict[str, Any]
    missing_required: list[str]
    # PRD-grade custom use-case draft returned by the ``draft_custom`` mode. It is
    # returned for review and is NOT persisted until the learner confirms it back
    # through a normal ``vibe_set_parameters`` call carrying ``use_case_description``.
    drafted_description: str | None = None
    # Use-case discovery echoed back to the agent (Workstream D). Populated on any
    # selection-touching call so the agent never has to read a vibe:// resource:
    # the curated industries, and the certified-first use cases once a valid
    # industry is resolved. None on plain non-selection merges.
    available_industries: list[dict[str, Any]] | None = None
    available_use_cases: list[dict[str, Any]] | None = None
    # True when THIS call resolved the pre-journey use-case gate (Option A): a
    # fully-locked selection wrote use_case_selection -> completed_gates and the
    # use_case_brief artifact, so the walk can proceed to the first numbered step
    # and prd_generation is unlocked. False on plain merges and partial selections.
    use_case_resolved: bool = False


class _ContractError(dict):
    """Marker returned by handlers so the HTTP adapter can set `isError`."""


class NextStepResult(RootModel[ExplainabilityPayload | DoneResult]):
    pass


class WorkshopFastMCP(FastMCP):
    """FastMCP 1.x compatibility shim for the app's `http_app` contract."""

    def http_app(
        self,
        path: str = "/",
        transport: str = "streamable-http",
        stateless_http: bool = True,
    ) -> Any:
        if transport != "streamable-http":
            raise ValueError("Phase 1 exposes only streamable-http")
        self.settings.streamable_http_path = path
        self.settings.stateless_http = stateless_http
        return self.streamable_http_app()

    def _install_error_aware_handler(self) -> None:
        """Preserve structured error bodies while using FastMCP's tool catalog."""

        async def handle(request: CallToolRequest) -> ServerResult:
            tool_name = request.params.name
            arguments = request.params.arguments or {}
            tool = self._tool_manager.get_tool(tool_name)
            if tool is None:
                return ServerResult(
                    CallToolResult(
                        content=[TextContent(type="text", text=f"Unknown tool: {tool_name}")],
                        isError=True,
                    )
                )
            try:
                jsonschema.validate(instance=arguments, schema=tool.parameters)
                result = await tool.run(arguments, context=self.get_context(), convert_result=False)
                if isinstance(result, _ContractError):
                    structured = result["structuredContent"]
                    return ServerResult(
                        CallToolResult(
                            content=[TextContent(type="text", text=json.dumps(structured, sort_keys=True))],
                            structuredContent=structured,
                            isError=True,
                        )
                    )
                converted = tool.fn_metadata.convert_result(result)
                if isinstance(converted, tuple) and len(converted) == 2:
                    _, structured = converted
                else:
                    structured = None
                if tool.output_schema is not None:
                    jsonschema.validate(instance=structured, schema=tool.output_schema)
                return ServerResult(
                    CallToolResult(
                        content=[TextContent(type="text", text=json.dumps(structured, sort_keys=True))],
                        structuredContent=structured,
                        isError=False,
                    )
                )
            except Exception as error:  # noqa: BLE001
                return ServerResult(
                    CallToolResult(
                        content=[TextContent(type="text", text=str(error))],
                        isError=True,
                    )
                )

        self._mcp_server.request_handlers[CallToolRequest] = handle

        # Genie Code's save-time validation (protocolVersion 2025-11-25) rejects
        # a tools/list whose entries carry `outputSchema` / `annotations`: the
        # server lists but the "Add MCP server" Save silently fails (the client
        # re-runs initialize + tools/list in a loop and never persists). The
        # proven Genie Code reference returns ONLY name/description/inputSchema
        # (external-to-managed-table-migration-toolkit register-mcp.ts). Mirror
        # that by stripping the two optional fields from the tools/list result.
        # Structured output still flows to tolerant clients at tools/call time
        # (CallToolResult.structuredContent above); only the *listing* is slimmed.
        original_list_tools = self._mcp_server.request_handlers.get(ListToolsRequest)

        if original_list_tools is not None:

            async def list_tools(request: ListToolsRequest) -> ServerResult:
                result = await original_list_tools(request)
                for tool in result.root.tools:
                    tool.outputSchema = None
                    tool.annotations = None
                return result

            self._mcp_server.request_handlers[ListToolsRequest] = list_tools


# FastMCP defaults host to 127.0.0.1 and, for localhost, auto-enables DNS-
# rebinding protection with a localhost-only Origin allowlist
# (mcp/server/fastmcp/server.py). Behind the Databricks Apps proxy the app
# binds to 127.0.0.1, so that auto-protection rejects Genie Code's real
# workspace Origin (…cloud.databricks.com / …azuredatabricks.net) with
# 403 "Invalid Origin header" — which blocks "Add MCP server" from saving.
# DNS-rebinding protection is redundant in this topology: the app is a public
# HTTPS endpoint gated by the Databricks OAuth proxy, and browser origins are
# already restricted by CORSMiddleware (ALLOWED_ORIGINS) in app.py. Disable the
# transport-level check so the intended cross-origin browser client works.
# Ref: https://docs.databricks.com/aws/en/genie-code/mcp
_MCP_TRANSPORT_SECURITY = TransportSecuritySettings(
    enable_dns_rebinding_protection=False,
)

mcp = WorkshopFastMCP(
    name="vibe-coding-workshop",
    instructions=(
        "Use the prompts and resources to orient the learner. Present every workshop prompt "
        "verbatim before narrating it. All interactions stay in-band."
    ),
    stateless_http=True,
    # Reply with plain JSON instead of an SSE stream for maximum client
    # tolerance. Genie Code's browser save-time validation is happier with a
    # JSON body. Note: this does NOT relax the transport's Accept gate (see the
    # Accept-header normalization in app.py) — the POST handler still requires
    # both application/json and text/event-stream in Accept regardless.
    json_response=True,
    transport_security=_MCP_TRANSPORT_SECURITY,
)


def _error_result(code: str, message: str, **details: str) -> _ContractError:
    error = {"code": code, "message": message, **details}
    structured = {"isError": True, "error": error}
    return _ContractError(
        isError=True,
        error=error,
        structuredContent=structured,
        content=[TextContent(type="text", text=json.dumps(structured, sort_keys=True))],
    )


def _request_user(context: Context | None) -> str:
    if context is not None:
        try:
            request = context.request_context.request
            if isinstance(request, Request):
                for header in (
                    "x-forwarded-email",
                    "x-forwarded-user",
                    "x-databricks-user-email",
                    "x-databricks-user",
                    "x-user-email",
                    "x-user-id",
                ):
                    value = request.headers.get(header, "")
                    if "@" in value:
                        return value
        except (LookupError, ValueError, AttributeError):
            pass
    import os

    value = os.getenv("PGUSER", "")
    return value if "@" in value else "unknown"


def _request_base_url(context: Context | None) -> str | None:
    """Derive the app's own base URL from the forwarded request headers, mirroring
    the web save endpoint (routes.save_session_endpoint). Returns None when it
    cannot be resolved (no request context, or a localhost host), so the deep-link
    handoff degrades gracefully rather than emitting a broken URL."""
    if context is None:
        return None
    try:
        request = context.request_context.request
    except (LookupError, AttributeError):
        return None
    if not isinstance(request, Request):
        return None
    forwarded_host = request.headers.get("x-forwarded-host")
    if forwarded_host:
        protocol = request.headers.get("x-forwarded-proto", "https")
        return f"{protocol}://{forwarded_host}"
    host_header = request.headers.get("host")
    if host_header and "localhost" not in host_header:
        return f"https://{host_header}"
    return None


def _stash_base_url(state: engine.SessionState, context: Context | None) -> None:
    """Stash the derived base URL onto the in-memory session state so _step_payload
    can render a web-UI deep link in the step-1 orientation. Only read-only callers
    use this and it is never saved, so it does not pollute persisted
    session_parameters."""
    base = _request_base_url(context)
    if base:
        state.session_parameters.setdefault("app_base_url", base)


def _coerce_state(value: engine.SessionState | dict[str, Any]) -> engine.SessionState:
    if isinstance(value, engine.SessionState):
        return value
    return build_session_state(value)


def _load_session_for_request(
    session_id: str | None,
    context: Context | None = None,
    track: str = DEFAULT_TRACK,
) -> tuple[engine.SessionState, str] | None:
    """Resolve and authorize a session, reading Lakebase on every request."""

    if not session_id:
        return None
    record = load_session(session_id)
    if record is None:
        if not is_lakebase_configured():
            return engine.SessionState(), session_id
        return None
    owner = record.get("created_by")
    caller = _request_user(context)
    if owner and caller != "unknown" and owner != caller:
        return None
    return build_session_state(record, track), session_id


def _outline_items(track: str, state: engine.SessionState) -> list[OutlineItem]:
    return [OutlineItem(**asdict(item)) for item in engine.outline(track, state)]


def _next_reference(track: str, state: engine.SessionState, step: manifest.Step) -> StepReference:
    # Order against the SAME composition engine.outline uses — _ordered_steps
    # threads BOTH flags and composition inputs (direction / chainContext), so the
    # "next" pointer stays consistent with the outline on the variant tracks
    # (lakehouse climb, end-to-end reverse). Passing flags but omitting inputs
    # here ordered against the input-blind default and disagreed mid-track.
    ordered = engine._ordered_steps(track, state)
    ordered_tags = {candidate.sectionTag for candidate in ordered}
    # Pre-journey intent beat (Option A): use_case_selection is not a numbered step,
    # so it has no position in the ordered outline — its "next" is the first
    # numbered step (project_setup) the learner reaches once the use case locks.
    if step.sectionTag == _INTENT_BEAT_STEP.sectionTag and step.sectionTag not in ordered_tags:
        if ordered:
            return StepReference(sectionTag=ordered[0].sectionTag, title=ordered[0].title)
        return StepReference(sectionTag="", title="Track complete")
    index = next((idx for idx, candidate in enumerate(ordered) if candidate.sectionTag == step.sectionTag), None)
    if index is not None and index + 1 < len(ordered):
        following = ordered[index + 1]
        return StepReference(sectionTag=following.sectionTag, title=following.title)
    return StepReference(sectionTag="", title="Track complete")


def decision_capture_key(section_tag: str, interaction_id: str) -> str:
    return f"interaction_decision:{section_tag}:{interaction_id}"


def interaction_answered_key(section_tag: str, interaction_id: str) -> str:
    """Marker that a comprehension check was answered (suppresses the post-check
    reminder in vibe_complete_step). Distinct namespace from decision_capture_key
    so it never collides with gating or produce keys."""
    return f"interaction_answered:{section_tag}:{interaction_id}"


def _quiz_view(interaction: Interaction) -> Interaction:
    """Redact the answer key from a comprehension check before it ships.

    Comprehension quizzes must be *asked*, not announced: leaking `recommended`
    (the correct option) or `coaching` (the per-option verdicts) into the step
    payload lets the agent front-run the answer. Strip both for
    ``type == "comprehension"`` only — decisions/confirms legitimately surface
    their recommended default. The verdict still reaches the learner AFTER they
    answer, via `vibe_submit_answer`/`_resolve_interaction_answer`, which reads
    the un-redacted block straight from the manifest (`_find_interaction`), so
    silence-accepts-recommended is unaffected.
    """

    if interaction.type != "comprehension":
        return interaction
    return interaction.model_copy(update={"recommended": None, "coaching": {}})


def _interaction_payload(section_tag: str) -> dict[str, Interaction | None] | None:
    blocks = manifest.interactions_for(section_tag)
    if not blocks:
        return None
    return {
        slot: _quiz_view(Interaction.model_validate(block)) if block is not None else None
        for slot in manifest.INTERACTION_SLOTS
        for block in [blocks.get(slot)]
    }


def _pending_post_check(
    section_tag: str, state: engine.SessionState
) -> Interaction | None:
    """The just-completed step's post comprehension check, redacted, if still due.

    vibe_complete_step re-surfaces this so the agent asks the quiz at the moment
    it is due — the slim step payload plus long-run drift let the client skip the
    optional post check silently. Only comprehension checks are re-surfaced, and
    only until the learner has answered (marker recorded by vibe_submit_answer).
    """
    blocks = manifest.interactions_for(section_tag) or {}
    post = blocks.get("post")
    if not isinstance(post, dict) or post.get("type") != "comprehension":
        return None
    if interaction_answered_key(section_tag, str(post.get("id") or "")) in state.captured_outputs:
        return None
    return _quiz_view(Interaction.model_validate(post))


def _find_interaction(
    interaction_id: str,
) -> tuple[str, str, Interaction] | None:
    for section_tag, blocks in manifest.load_interactions().items():
        for slot in manifest.INTERACTION_SLOTS:
            block = blocks.get(slot)
            if isinstance(block, dict) and block.get("id") == interaction_id:
                return section_tag, slot, Interaction.model_validate(block)
    return None


def _resolve_interaction_answer(
    interaction: Interaction, answer: str
) -> tuple[str, bool, str]:
    silent = not answer.strip()
    if silent and interaction.skippable and interaction.recommended is not None:
        resolved = interaction.recommended
        was_default = True
    else:
        resolved = answer.strip()
        was_default = False

    for option in interaction.options:
        if resolved == option.id or resolved.casefold() == option.label.casefold():
            resolved = option.id
            break
    coaching = interaction.coaching.get(
        resolved,
        "Thanks — I’ll carry that answer forward without blocking the track.",
    )
    return resolved, was_default, coaching


# Cache of FMAPI-generated step prompts, keyed by (session, section, input-hash).
# The web path renders each copy-paste prompt through the app's serving endpoint
# (`generate_prompt_content_with_llm`); the MCP path must match it for
# consistency, but re-generating on every `vibe_get_step`/`vibe_next_step` read
# would be slow and costly. Cache only successful ("llm_generated") outputs so a
# mock/error result is retried when the endpoint comes back.
_STEP_PROMPT_CACHE: dict[tuple[str, str, str], str] = {}


def _generate_step_prompt(
    industry: str,
    use_case: str,
    section_tag: str,
    assembled: dict[str, Any],
    previous_outputs: dict[str, str] | None,
    session_id: str | None,
) -> str | None:
    """Generate the copy-paste prompt via the app FMAPI, matching the web path.

    Returns the LLM-generated prompt, or ``None`` to signal "use the assembled
    template verbatim". None is returned for ``bypass_llm`` sections and whenever
    the endpoint is unavailable (mock/error/exception) so the step never fails to
    render — identical degradation to the web path's own fallback.
    """

    if assembled.get("bypass_llm"):
        return None
    input_text = assembled.get("input") or ""
    if not input_text:
        return None
    cache_key = (
        session_id or "",
        section_tag,
        hashlib.sha256(input_text.encode("utf-8")).hexdigest(),
    )
    cached = _STEP_PROMPT_CACHE.get(cache_key)
    if cached is not None:
        return cached
    try:
        from .api.routes import generate_prompt_content_with_llm

        result = _run_async_blocking(
            lambda: generate_prompt_content_with_llm(
                industry=industry,
                use_case=use_case,
                section_tag=section_tag,
                previous_outputs=previous_outputs,
                session_id=session_id,
            )
        )
    except Exception:  # noqa: BLE001 — generation is best-effort; degrade to template
        logger.warning(
            "FMAPI step-prompt generation failed for %s; using assembled template",
            section_tag,
            exc_info=True,
        )
        return None
    # Only a genuine LLM generation replaces the template. Every other source
    # (mock_llm, fallback_due_to_error, bypass_llm, input_only_no_llm) already
    # returns the raw input, so we keep the MCP-assembled (genie-code) template.
    if not isinstance(result, dict) or result.get("source") != "llm_generated":
        return None
    generated = (result.get("prompt") or "").strip()
    if not generated:
        return None
    _STEP_PROMPT_CACHE[cache_key] = generated
    return generated


# Repo the workshop clones from. Kept in lockstep with the genie-code variant in
# frontend `src/components/SetUpProjectStep.tsx` (REPO_URL / the three genie-*
# commands / genieVerifyPrompt) — the web UI and the MCP path must run the SAME
# one-time setup. There is no shared TS<->Py module, so this mirror is the single
# backend copy; update both together.
_WORKSHOP_TEMPLATE_REPO = "https://github.com/databricks-solutions/vibe-coding-workshop-template.git"


def _project_setup_content(email: str) -> dict[str, str]:
    """Render the Genie Code one-time setup (clone -> publish skills -> validate).

    ``project_setup`` authors no seed row, so the MCP path used to surface an
    empty template. The real setup lives in the web UI's ``SetUpProjectStep``
    (genie-code variant); this mirrors it so the agent runs the exact same three
    gated commands transparently and reports the result, instead of skipping the
    step. ``email`` falls back to a visible placeholder when the session has not
    resolved the learner's identity yet (same as the frontend).
    """

    email = email.strip() or "<your_email>"
    user_root = f"/Workspace/Users/{email}"
    project_path = f"{user_root}/vibe-coding-workshop"
    skill_check = (
        f"{user_root}/.assistant/skills/vibe-coding-workshop/"
        "skills/genie-code-environment/SKILL.md"
    )
    clone_cmd = f"git clone {_WORKSHOP_TEMPLATE_REPO} {project_path}"
    copy_cmd = (
        f'D={user_root}; rm -rf "$D/.assistant/skills/vibe-coding-workshop"; '
        'mkdir -p "$D/.assistant/skills"; '
        'cp -R "$D/vibe-coding-workshop" "$D/.assistant/skills/"'
    )
    validate_cmd = (
        f'D={user_root}; '
        'test -d "$D/vibe-coding-workshop/.git" && echo "✅ 1/2 project cloned" '
        '|| echo "❌ 1/2 re-run command 1"; '
        'test -f "$D/.assistant/skills/vibe-coding-workshop/skills/'
        'genie-code-environment/SKILL.md" && echo "✅ 2/2 skills published" '
        '|| echo "❌ 2/2 re-run command 2"'
    )
    prompt = (
        "One-time project setup for Genie Code. Run these three terminal commands "
        "in order in the Genie Code terminal, show the learner each command and its "
        "output, and STOP if validation is not two green checks.\n\n"
        f"1) Clone the workshop into your project folder:\n{clone_cmd}\n\n"
        f"2) Publish the whole clone into your skills folder:\n{copy_cmd}\n\n"
        f"3) Validate (gate) — do not continue until you see two ✅:\n{validate_cmd}\n\n"
        "Then, in ONE executeCode block, re-verify with os.path.exists (NOT "
        f"listFiles): {project_path}/.git and {skill_check}. If either is missing, "
        "STOP and tell the learner which command to re-run. Finally load the "
        "behavior manifest with readSkillFile(\"skills/vibe-coding-workshop/skills/"
        "genie-code-environment/SKILL.md\") and confirm 'Setup verified ✅'."
    )
    how_to_apply = (
        "You are inside Genie Code — pre-authenticated and serverless (no "
        "`databricks auth login`, no model setup). Present each command verbatim, "
        "run it, and report the output. Command 2 is safe to re-run. The paths are "
        f"filled with the learner's Databricks email ({email})."
    )
    expected_output = (
        "The validate step prints two green checks:\n"
        "✅ 1/2 project cloned\n"
        "✅ 2/2 skills published\n"
        "and the re-verify confirms both paths exist before the manifest loads."
    )
    user_trigger_prompt = (
        "Set up my project: clone the workshop repo into my workspace, publish the "
        "skills folder, and validate that setup is complete."
    )
    return {
        "prompt": prompt,
        "how_to_apply": how_to_apply,
        "expected_output": expected_output,
        "user_trigger_prompt": user_trigger_prompt,
    }


# --- Pre-journey use-case intent beat (Option A) -----------------------------
# use_case_selection was retired as a numbered outline step. A fresh Genie Code
# learner who has NOT pre-picked a use case is still asked ONCE, up front, before
# the first numbered step (guardrail #3) — mirroring the App's step 1 "Define Your
# Intent". This synthetic step is surfaced by vibe_next_step / vibe_get_step while
# the use case is unresolved; it is NOT a manifest step and is never advanced
# THROUGH via vibe_complete_step. Locking the use case (vibe_set_parameters, or
# vibe_start_track with industry+use_case) resolves the gate via
# engine.resolve_use_case, after which the walk proceeds to project_setup.
_INTENT_BEAT_STEP = manifest.Step(
    order=1,
    sectionTag=engine.USE_CASE_GATE,
    title="Define Your Use Case",
    why=(
        "Lock the use case up front so the PRD, semantic layer, agent, and "
        "dashboard are all built for one governed target."
    ),
    requiresGate=None,
    consumes=[],
    produces=engine.USE_CASE_BRIEF,
    execution="agent-doable",
)


def _needs_use_case(state: engine.SessionState) -> bool:
    """Whether the pre-journey use-case pick is still due for this session."""

    return not engine.use_case_resolved(state)


def _build_use_case_brief(params: dict[str, Any]) -> str:
    """Assemble the ``use_case_brief`` artifact (D11 §3.3) from locked parameters.

    Track-agnostic; its job is to lock and record the choice (provenance +
    downstream narrative), not to re-plumb rendering — the assembler already keys
    on ``industry``/``use_case`` in session_parameters. ``description`` is present
    for a custom (author-your-own) use case, carrying the FMAPI-drafted brief.
    """

    source = "custom" if params.get("use_case_source") == "custom" else "curated"
    brief: dict[str, Any] = {
        "industry": str(params.get("industry") or ""),
        "use_case": str(params.get("use_case") or ""),
        "use_case_label": str(params.get("use_case_label") or params.get("use_case") or ""),
        "source": source,
        "selected_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    if source == "custom":
        description = str(
            params.get("use_case_description")
            or params.get("custom_drafted_description")
            or ""
        ).strip()
        if description:
            brief["description"] = description
    return json.dumps(brief)


def _step_payload(
    track: str,
    state: engine.SessionState,
    step: manifest.Step,
    session_id: str | None = None,
) -> ExplainabilityPayload:
    previous_outputs = engine.resolve_previous_outputs(step, state)
    industry = state.session_parameters.get("industry", DEFAULT_INDUSTRY)
    use_case = state.session_parameters.get("use_case", DEFAULT_USE_CASE)
    assembled = assembler.get_section_input_content(
        industry=industry,
        use_case=use_case,
        section_tag=step.sectionTag,
        previous_outputs=previous_outputs,
        session_id=session_id,
        coding_assistant_override=DEFAULT_CODING_ASSISTANT,
    )
    if step.sectionTag == "project_setup":
        # Surface the real one-time setup (clone -> publish skills -> validate ->
        # verify) that otherwise lives only in the web UI. Fixed procedure, so no
        # FMAPI call; the email drives the learner's /Workspace paths.
        setup = _project_setup_content(str(state.session_parameters.get("user_email") or ""))
        prompt = setup["prompt"]
        user_trigger_prompt = setup["user_trigger_prompt"]
    else:
        # Match the web path: render the prompt through the app FMAPI, falling back
        # to the assembled template when the endpoint is bypassed or unavailable.
        generated_prompt = _generate_step_prompt(
            industry=industry,
            use_case=use_case,
            section_tag=step.sectionTag,
            assembled=assembled,
            previous_outputs=previous_outputs,
            session_id=session_id,
        )
        prompt = generated_prompt if generated_prompt is not None else assembled.get("input", "")
        user_trigger_prompt = assembled.get("user_trigger_prompt", "")
    orientation = None
    if not state.completed_gates and step.order == 1:
        orientation = ORIENTATION_PREAMBLE
        # Deep-link handoff (Workstream 2): if a base URL was stashed on the state,
        # append a ready-to-open web-UI link so the learner can jump between MCP and
        # the app mid-run using the same session.
        _base = state.session_parameters.get("app_base_url")
        if _base and session_id:
            orientation = f"{orientation}\n\nOpen in the workshop UI: {_base}?sessionId={session_id}"
    payload = ExplainabilityPayload(
        sectionTag=step.sectionTag,
        title=step.title,
        why=step.why or "",
        prompt=prompt,
        user_trigger_prompt=user_trigger_prompt,
        gate=step.gate,
        requiresGate=step.requiresGate,
        consumes=list(step.consumes),
        produces=step.produces,
        execution=step.execution,
        next=_next_reference(track, state, step),
        interaction=_interaction_payload(step.sectionTag),
        orientation=orientation,
        # The wait doctrine rides every triggered step, not just step 1.
        instruction=STEP_WAIT_DIRECTIVE if user_trigger_prompt else None,
    )
    # Workstream D: the use-case picker inlines its options so the Genie Code agent
    # never has to read a vibe:// resource. Best-effort — a data-layer hiccup must
    # never keep the step from rendering, so the lists degrade to None.
    if step.sectionTag == "use_case_selection":
        try:
            payload.available_industries = _available_industries()
            chosen = state.session_parameters.get("industry")
            if chosen:
                payload.available_use_cases = _available_use_cases(str(chosen))
        except Exception:  # noqa: BLE001 — options are advisory, never fatal
            pass
    # Data-location CUJ (Workstream 1): surface the effective source catalog/schema
    # on the Locate Data step — the MCP analog of the web LakehouseParams editor — so
    # the agent can confirm the default or persist a change via vibe_set_parameters.
    if step.sectionTag == "semlayer_locate":
        try:
            from .api.routes import get_effective_workshop_parameters

            _eff = get_effective_workshop_parameters(session_id)
            payload.data_location = {
                "catalog": _eff.get("chapter_3_lakehouse_catalog", "samples"),
                "schema": _eff.get("chapter_3_lakehouse_schema", "wanderbricks"),
                "is_overridden": (
                    "chapter_3_lakehouse_catalog" in state.session_parameters
                    or "chapter_3_lakehouse_schema" in state.session_parameters
                ),
            }
        except Exception:  # noqa: BLE001 — enrichment is advisory, never fatal
            pass
    return payload


@mcp.tool(
    name="vibe_start_track",
    description=(
        "Start or resume a guided workshop track (e.g. the Genie Accelerator) for the current user. "
        "Call this first, in Agent mode, before any other vibe tool. Args: `track` (required), optional "
        "`use_case`/`industry`/`session_id`. Returns the session id, a `session_url` deep link to open "
        "the same session in the web UI, and the ordered step outline. Errors if `track` is unknown."
    ),
    annotations=ToolAnnotations(
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=True,
        openWorldHint=True,
    ),
    structured_output=True,
)
def vibe_start_track(
    track: str,
    use_case: str | None = None,
    industry: str | None = None,
    session_id: str | None = None,
    context: Context | None = None,
) -> StartTrackResult:
    if track not in engine.MANIFEST.tracks:
        return _error_result("UNKNOWN_TRACK", f"Unknown workshop track: {track}")  # type: ignore[return-value]
    resolved = session_id or str(uuid.uuid4())
    loaded = _load_session_for_request(resolved, context, track)
    if loaded is None:
        if session_id:
            return _error_result("INVALID_SESSION", "The requested session could not be resolved.")  # type: ignore[return-value]
        state = engine.SessionState()
    else:
        state, _ = loaded
    # MCP is exclusively the Genie Code client — mark the session so any other
    # read path (SPA bridge, the vibe://session/{id}/state resource) resolves
    # the genie-code fork too. setdefault never clobbers an explicit choice.
    state.session_parameters.setdefault("coding_assistant", DEFAULT_CODING_ASSISTANT)
    # Persist the learner's email so the project_setup step can render their
    # /Workspace/Users/<email> clone + skills paths (Workstream #5). setdefault so
    # an explicit value is never clobbered; only a real address is stored.
    _email = _request_user(context)
    if "@" in _email:
        state.session_parameters.setdefault("user_email", _email)
    if not session_id and is_lakebase_configured():
        # Auto-name the new session so it surfaces in the web UI session menu
        # (is_saved requires a name that is set and != "New Session"). Refined to
        # the confirmed use case once it locks in vibe_complete_step (Workstream 3).
        _initial_name = f"Genie Code — {use_case}" if use_case else "Genie Code Workshop"
        save_session(
            session_id=resolved,
            industry=industry,
            # R3.1: also persist the *_label columns the by_industry / by_use_case
            # analytics GROUP BY, so a start-track-only session (which never walks
            # the selection lock) is not dropped from those breakdowns. Resolved
            # from the curated list; None when unresolved so save_session COALESCE-
            # preserves rather than writing a raw id as a label. vibe_start_track
            # has no use_case_label input, so it is resolved via _use_case_label_for
            # (NOT a use_case fallback — see that helper's docstring).
            industry_label=_industry_label_for(industry or "", None),
            use_case=use_case,
            use_case_label=_use_case_label_for(industry or "", use_case or ""),
            session_name=_initial_name,
            created_by=_request_user(context),
            # Stamp the walked track as the top-level workshop_level column so the
            # SPA (which reads response.workshop_level) rebuilds the SAME filtered
            # outline the MCP walk uses. Without this, a resumed genie-code session
            # falls back to the assistant cold-start level and the genie gates map
            # to steps absent from the outline (the live 0/28 defect). This is the
            # column, NOT a session_parameters JSONB key; save_session COALESCE-
            # preserves it on later writes (see lakebase.save_session). New sessions
            # only — resume never reaches this block, so an existing level is safe.
            workshop_level=DEFAULT_TRACK,
            session_parameters=state.session_parameters,
        )
    if industry:
        state.session_parameters["industry"] = industry
    if use_case:
        state.session_parameters["use_case"] = use_case
    # Pre-journey use-case resolution (Option A): starting a track with BOTH an
    # industry and a use case resolves the use_case_selection gate up front (writes
    # the gate string + use_case_brief), so the learner never has to walk a numbered
    # use-case step and prd_generation is unlocked. Without both, the pre-journey
    # intent beat elicits the pick on the first vibe_next_step (guardrail #3).
    if industry and use_case and not engine.use_case_resolved(state):
        engine.resolve_use_case(state, _build_use_case_brief(state.session_parameters))
        if is_lakebase_configured():
            save_session(
                session_id=resolved,
                session_parameters=state.session_parameters,
                captured_outputs=dict(state.captured_outputs),
                completed_gates=list(state.completed_gates),
            )
    # Deep-link handoff (Workstream 2): hand back a ready-to-open web-UI URL for this
    # same session so the learner can move freely between MCP and the app. None when
    # the request headers do not expose a usable host (degrades gracefully).
    _base = _request_base_url(context)
    session_url = f"{_base}?sessionId={resolved}" if _base else None
    return StartTrackResult(
        session_id=resolved,
        track=track,
        outline=_outline_items(track, state),
        session_url=session_url,
    )


@mcp.tool(
    name="vibe_get_step",
    description=(
        "Fetch one workshop step to present. Returns the prompt to run **verbatim**, why it matters, "
        "the gate, the next step, and `user_trigger_prompt` — the plain-English ask you MUST show the "
        "learner verbatim BEFORE doing any work, then WAIT for them to send it (never auto-run or chain "
        "steps). Call `vibe_explain_step` for how-to or expected output. Args: `session_id`; "
        "`sectionTag` (optional)."
    ),
    annotations=ToolAnnotations(
        readOnlyHint=True,
        destructiveHint=False,
        idempotentHint=True,
        openWorldHint=True,
    ),
    structured_output=True,
)
def vibe_get_step(
    session_id: str,
    sectionTag: str | None = None,
    context: Context | None = None,
) -> ExplainabilityPayload:
    loaded = _load_session_for_request(session_id, context)
    if loaded is None:
        return _error_result("INVALID_SESSION", "The requested session could not be resolved.")  # type: ignore[return-value]
    state, _ = loaded
    state = _coerce_state(state)
    _stash_base_url(state, context)
    steps = engine.MANIFEST.track_steps(DEFAULT_TRACK)
    # The pre-journey intent beat (Option A) is not a manifest step, so it is
    # resolved here rather than looked up in track_steps: an explicit request for
    # use_case_selection, or the default (sectionTag=None) while the use case is
    # unresolved, returns the beat with its picker payload.
    if sectionTag == _INTENT_BEAT_STEP.sectionTag or (sectionTag is None and _needs_use_case(state)):
        return _step_payload(DEFAULT_TRACK, state, _INTENT_BEAT_STEP, session_id=session_id)
    if sectionTag is None:
        current = engine.next_step(DEFAULT_TRACK, state)
        if isinstance(current, engine.Done):
            return _error_result("UNKNOWN_STEP", "The track has no remaining step.")  # type: ignore[return-value]
        step = current
    else:
        step = next((candidate for candidate in steps if candidate.sectionTag == sectionTag), None)
        if step is None:
            return _error_result("UNKNOWN_STEP", f"Unknown workshop step: {sectionTag}", sectionTag=sectionTag)  # type: ignore[return-value]
        if not engine.can_start(step, state):
            return _error_result("STEP_LOCKED", f"Complete {step.requiresGate} before this step.", sectionTag=sectionTag)  # type: ignore[return-value]
    return _step_payload(DEFAULT_TRACK, state, step, session_id=session_id)


@mcp.tool(
    name="vibe_next_step",
    description=(
        "Advance to the first not-yet-completed step whose prerequisite gate is satisfied and return "
        "it (same shape as `vibe_get_step`, incl. `user_trigger_prompt`). Present it, show the trigger "
        "verbatim, then WAIT for the learner to submit it — never auto-run or chain steps without a "
        "fresh learner turn. Returns `{done:true}` when complete. Args: `session_id`."
    ),
    annotations=ToolAnnotations(
        readOnlyHint=True,
        destructiveHint=False,
        idempotentHint=True,
        openWorldHint=True,
    ),
    structured_output=True,
)
def vibe_next_step(session_id: str, context: Context | None = None) -> NextStepResult:
    loaded = _load_session_for_request(session_id, context)
    if loaded is None:
        return _error_result("INVALID_SESSION", "The requested session could not be resolved.")  # type: ignore[return-value]
    state, _ = loaded
    state = _coerce_state(state)
    _stash_base_url(state, context)
    # Pre-journey intent beat (Option A, guardrail #3): before the first numbered
    # step, a learner who has not yet locked a use case is asked to pick one. The
    # beat is surfaced until the use_case_selection gate resolves.
    if _needs_use_case(state):
        return NextStepResult.model_validate(
            _step_payload(DEFAULT_TRACK, state, _INTENT_BEAT_STEP, session_id=session_id)
        )
    next_item = engine.next_step(DEFAULT_TRACK, state)
    if isinstance(next_item, engine.Done):
        return NextStepResult.model_validate(DoneResult())
    return NextStepResult.model_validate(_step_payload(DEFAULT_TRACK, state, next_item, session_id=session_id))


@mcp.tool(
    name="vibe_explain_step",
    description=(
        "On-demand help for a step: returns `how_to_apply` and `expected_output`, plus `title` and "
        "`why`. The step payload is deliberately slim and omits these — call this ONLY when the learner "
        "asks you to explain a step, how to apply it, or what to expect. Args: `session_id`; "
        "`sectionTag` (optional, defaults to the current step)."
    ),
    annotations=ToolAnnotations(
        readOnlyHint=True,
        destructiveHint=False,
        idempotentHint=True,
        openWorldHint=True,
    ),
    structured_output=True,
)
def vibe_explain_step(
    session_id: str,
    sectionTag: str | None = None,
    context: Context | None = None,
) -> StepHelpResult:
    loaded = _load_session_for_request(session_id, context)
    if loaded is None:
        return _error_result("INVALID_SESSION", "The requested session could not be resolved.")  # type: ignore[return-value]
    state, _ = loaded
    state = _coerce_state(state)
    steps = engine.MANIFEST.track_steps(DEFAULT_TRACK)
    if sectionTag is None:
        current = engine.next_step(DEFAULT_TRACK, state)
        if isinstance(current, engine.Done):
            return _error_result("UNKNOWN_STEP", "The track has no remaining step.")  # type: ignore[return-value]
        step = current
    else:
        step = next((candidate for candidate in steps if candidate.sectionTag == sectionTag), None)
        if step is None:
            return _error_result("UNKNOWN_STEP", f"Unknown workshop step: {sectionTag}", sectionTag=sectionTag)  # type: ignore[return-value]
    if step.sectionTag == "project_setup":
        # project_setup authors no seed row; mirror _step_payload's synthesized content.
        setup = _project_setup_content(str(state.session_parameters.get("user_email") or ""))
        how_to_apply = setup["how_to_apply"]
        expected_output = setup["expected_output"]
    else:
        industry = state.session_parameters.get("industry", DEFAULT_INDUSTRY)
        use_case = state.session_parameters.get("use_case", DEFAULT_USE_CASE)
        previous_outputs = engine.resolve_previous_outputs(step, state)
        assembled = assembler.get_section_input_content(
            industry=industry,
            use_case=use_case,
            section_tag=step.sectionTag,
            previous_outputs=previous_outputs,
            session_id=session_id,
            coding_assistant_override=DEFAULT_CODING_ASSISTANT,
        )
        how_to_apply = assembled.get("how_to_apply", "")
        expected_output = assembled.get("expected_output", "")
    return StepHelpResult(
        sectionTag=step.sectionTag,
        title=step.title,
        why=step.why or "",
        how_to_apply=how_to_apply,
        expected_output=expected_output,
    )


# --- Use-case selection lock (D11 §3.3, §3.5) --------------------------------
# The learner's use case is locked into ``session_parameters`` via
# ``vibe_set_parameters``. A curated selection needs an industry + use_case; a
# custom ("author your own") selection additionally needs its authored brief
# (``use_case_description``) before it can lock. Custom selections stay
# SESSION-LOCAL — never written to the community library
# ``saved_usecase_descriptions`` (D11 §2.1 / guardrail #5).
_SELECTION_REQUIRED = ("industry", "use_case", "use_case_label")
_CUSTOM_REQUIRED = ("industry", "use_case", "use_case_label", "use_case_description")


def _is_selection_call(params: dict[str, Any]) -> bool:
    """A ``vibe_set_parameters`` call is a use-case selection when it carries a source."""

    return "use_case_source" in params


# Keys whose presence means THIS call is about picking a use case, so the result
# should echo the inlined discovery lists (Workstream D). Broader than
# ``_is_selection_call`` on purpose: a bare ``{"industry": ...}`` call — the
# reworded step body's way to fetch use cases without a vibe:// resource — must
# still echo ``available_use_cases``.
_SELECTION_TOUCH_KEYS = (
    "industry",
    "use_case",
    "use_case_label",
    "use_case_source",
    "use_case_description",
    "use_case_hints",
)


def _touches_usecase_selection(params: dict[str, Any]) -> bool:
    return any(key in params for key in _SELECTION_TOUCH_KEYS)


def _selection_missing_required(params: dict[str, Any]) -> list[str]:
    required = _CUSTOM_REQUIRED if params.get("use_case_source") == "custom" else _SELECTION_REQUIRED
    return [key for key in required if not str(params.get(key) or "").strip()]


def _custom_usecase_locked(params: dict[str, Any]) -> bool:
    """True once a custom ("author your own") use case is fully locked in-session."""

    return params.get("use_case_source") == "custom" and not _selection_missing_required(params)


def _mirror_custom_usecase(params: dict[str, Any]) -> None:
    """Land a locked custom use case in the fields the assembler actually reads.

    The selection lock is keyed on ``use_case_description``/``use_case_label`` but
    the prompt assembler resolves ``{use_case_description}`` (and the title) from
    ``custom_use_case_description``/``custom_use_case_label`` (assembler.py). Without
    this mirror an MCP-authored custom use case is silently dropped from the PRD
    and every downstream prompt. Mutates ``params`` in place; never overwrites an
    explicit custom_* value already present.
    """

    if params.get("use_case_source") != "custom":
        return
    desc = str(params.get("use_case_description") or "").strip()
    if desc and not str(params.get("custom_use_case_description") or "").strip():
        params["custom_use_case_description"] = desc
    label = str(params.get("use_case_label") or "").strip()
    if label and not str(params.get("custom_use_case_label") or "").strip():
        params["custom_use_case_label"] = label


def _industry_label_for(industry: str, echo: list[dict[str, Any]] | None) -> str | None:
    """Best-effort value->display-label for an industry (Workstream — R3 item 3).

    The analytics ``by_industry`` breakdown GROUPs BY the top-level
    ``industry_label`` column, so an MCP session that persists only ``industry``
    (the value) is dropped from it. The MCP selection contract never carries
    ``industry_label`` (``_SELECTION_REQUIRED`` is industry/use_case/use_case_label),
    so it is resolved here from the SAME curated list the echo uses. Reuses the
    already-computed ``echo`` list when present; otherwise does one best-effort
    lookup. Returns None when unresolved so ``save_session`` COALESCE-preserves any
    existing value rather than clobbering it with an empty string.
    """

    if not industry:
        return None
    options = echo
    if options is None:
        try:
            options = _available_industries()
        except Exception:  # noqa: BLE001 — label resolution is best-effort
            options = []
    for opt in options or []:
        if str(opt.get("value") or "") == industry:
            label = str(opt.get("label") or "").strip()
            return label or None
    return None


def _use_case_label_for(industry: str, use_case: str) -> str | None:
    """Best-effort value->display-label for a use case (R3.1 — start-track gap).

    The analytics ``by_use_case`` breakdown GROUPs BY the top-level
    ``use_case_label`` column, so a start-track-only MCP session that persists only
    ``use_case`` (the value) is dropped from it. Unlike the selection lock path,
    ``vibe_start_track`` has NO ``use_case_label`` input, so it is resolved here
    from the SAME curated list the echo uses — ``_available_use_cases(industry)`` —
    matching value -> label exactly as ``_industry_label_for`` resolves industries.
    Returns None when unresolved (unknown pair, or either arg missing) so
    ``save_session`` COALESCE-preserves any existing value. Crucially NOT the lock
    path's ``use_case_label or use_case`` fallback: with no label input that would
    always write the raw id (e.g. ``"booking"``) as a label and forge a second wrong
    ``by_use_case`` group. Never raises — a lookup failure degrades to None so
    session creation is never broken.
    """

    if not industry or not use_case:
        return None
    try:
        options = _available_use_cases(industry)
    except Exception:  # noqa: BLE001 — label resolution is best-effort
        options = []
    for opt in options or []:
        if str(opt.get("value") or "") == use_case:
            label = str(opt.get("label") or "").strip()
            return label or None
    return None


def _run_async_blocking(make_coro: Callable[[], Any]) -> Any:
    """Run an async coroutine to completion from a sync MCP tool.

    FastMCP invokes sync tools directly on the running event loop, so
    ``asyncio.run`` here would raise "cannot be called from a running event loop".
    Instead run the coroutine in a dedicated thread with its own loop, wrapped in a
    copied context so the OBO auth ContextVar propagates (SP fallback otherwise).
    """

    ctx = contextvars.copy_context()
    box: dict[str, Any] = {}

    def runner() -> None:
        loop = asyncio.new_event_loop()
        try:
            box["value"] = loop.run_until_complete(make_coro())
        except BaseException as exc:  # noqa: BLE001 — re-raised on the calling thread
            box["error"] = exc
        finally:
            loop.close()

    thread = threading.Thread(target=lambda: ctx.run(runner))
    thread.start()
    thread.join()
    if "error" in box:
        raise box["error"]
    return box["value"]


@mcp.tool(
    name="vibe_complete_step",
    description=(
        "Record that the current step's gate passed and store its captured output (the gate = this "
        "call); advances the walk. Call ONLY after the learner triggered and ran the step in a fresh "
        "turn — never chain it yourself. If its `interaction` has a `post` check, ask it via "
        "`vibe_submit_answer` first. Not for `execution:ui-driven` steps. Args: `session_id`, "
        "`sectionTag`, `captured_output`."
    ),
    annotations=ToolAnnotations(
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=True,
        openWorldHint=True,
    ),
    structured_output=True,
)
def vibe_complete_step(
    session_id: str,
    sectionTag: str,
    captured_output: str,
    context: Context | None = None,
) -> CompleteStepResult:
    loaded = _load_session_for_request(session_id, context)
    if loaded is None:
        return _error_result("INVALID_SESSION", "The requested session could not be resolved.")  # type: ignore[return-value]

    state, _ = loaded
    blocking = manifest.blocking_interactions(sectionTag)
    if blocking:
        confirmed = any(
            decision_capture_key(sectionTag, block["id"]) in state.captured_outputs
            for block in blocking
        )
        # Custom-path unblock (D11 §3.5): a learner who authors their own use case
        # locks it via vibe_set_parameters; that lock is the recommend-and-proceed
        # unblock for use_case_selection — proceeding WITHOUT a semantically-wrong
        # 'use_certified' answer. Scoped to use_case_selection so the generic
        # gagent_benchmarks gate (answer==recommended only) is provably untouched.
        if (
            not confirmed
            and sectionTag == "use_case_selection"
            and _custom_usecase_locked(state.session_parameters)
        ):
            # Workstream #3: a locked custom use case must have been drafted via the
            # app FMAPI (draft_custom). Without that marker, refuse the unblock and
            # steer the agent to the draft rather than a self-authored description.
            if not state.session_parameters.get("custom_draft_ready"):
                return _error_result(  # type: ignore[return-value]
                    "CUSTOM_DRAFT_REQUIRED",
                    "Draft the custom use case through the app FMAPI first: call "
                    'vibe_set_parameters(mode="draft_custom"), then confirm the draft.',
                    sectionTag=sectionTag,
                )
            confirmed = True
        if not confirmed:
            message = (
                "Confirm the use case selection before completing this step."
                if sectionTag == "use_case_selection"
                else "Confirm the benchmark decision before completing this step."
            )
            return _error_result(
                "GATE_REQUIRED",
                message,
                sectionTag=sectionTag,
            )  # type: ignore[return-value]
    result = engine.complete_step(DEFAULT_TRACK, state, sectionTag, captured_output)
    if not result.ok:
        messages = {
            "UNKNOWN_TRACK": "Unknown workshop track.",
            "UNKNOWN_STEP": f"Unknown workshop step: {sectionTag}",
            "STEP_LOCKED": "The requested step is locked until its prerequisite gate is complete.",
            "UI_DRIVEN_STEP": "This step is coached and must be completed in the web UI.",
            "GATE_REQUIRED": "Confirm the blocking interaction before completing this step.",
        }
        code = result.error_code or "UNKNOWN_STEP"
        return _error_result(
            code,
            messages.get(code, "The workshop step could not be completed."),
            sectionTag=sectionTag,
        )  # type: ignore[return-value]

    # Workstream 3: once the use case locks, refine the auto-name so the web UI
    # session menu shows what this session is building. None on every other step so
    # COALESCE preserves any name the learner set in the UI.
    _refined_name = None
    if sectionTag == "use_case_selection":
        _label = (
            state.session_parameters.get("use_case_label")
            or state.session_parameters.get("use_case")
        )
        if _label:
            _refined_name = f"Genie Code — {_label}"
    # Cross-surface progress rides on completed_gates alone (T5 R4a/R4b): the SPA
    # hydrates its step indicator from the gate set via deriveCompletedStepNumbers,
    # so MCP-driven progress shows up without any retired numeric progress columns.
    save_session(
        session_id=session_id,
        session_name=_refined_name,
        captured_outputs=dict(state.captured_outputs),
        completed_gates=list(result.completed_gates),
    )

    next_step = result.next_step
    if isinstance(next_step, engine.Done):
        next_payload: ExplainabilityPayload | DoneResult = DoneResult()
    else:
        next_payload = _step_payload(DEFAULT_TRACK, state, next_step, session_id=session_id)
    return CompleteStepResult(
        completed_gates=list(result.completed_gates),
        next=next_payload,
        post_check=_pending_post_check(sectionTag, state),
    )


@mcp.tool(
    name="vibe_submit_answer",
    description=(
        "Record the learner's answer to a step's `interaction` question — a comprehension check or a "
        "recommend-and-proceed decision/override — and return coaching feedback. Optional for skippable "
        "questions (silence applies the recommended default). Args: `session_id`, `interaction_id`, "
        "`answer` (all required)."
    ),
    annotations=ToolAnnotations(
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=True,
        openWorldHint=True,
    ),
    structured_output=True,
)
def vibe_submit_answer(
    session_id: str,
    interaction_id: str,
    answer: str,
    context: Context | None = None,
) -> SubmitAnswerResult:
    loaded = _load_session_for_request(session_id, context)
    if loaded is None:
        return _error_result("INVALID_SESSION", "The requested session could not be resolved.")  # type: ignore[return-value]

    state, _ = loaded
    resolved = _find_interaction(interaction_id)
    if resolved is None:
        return _error_result(
            "UNKNOWN_INTERACTION",
            f"Unknown workshop interaction: {interaction_id}",
            interaction_id=interaction_id,
        )  # type: ignore[return-value]
    section_tag, slot, interaction = resolved
    # Which step's interactions are answerable right now. The engine's current step
    # is always eligible; while the use case is unresolved the pre-journey intent
    # beat (Option A) is ALSO eligible, so its use_case_selection confirm/comprehension
    # interactions stay answerable even though the beat is not a manifest step
    # (the lock via vibe_set_parameters is what resolves the gate).
    current = engine.next_step(DEFAULT_TRACK, state)
    answerable = {None if isinstance(current, engine.Done) else current.sectionTag}
    if _needs_use_case(state):
        answerable.add(_INTENT_BEAT_STEP.sectionTag)
    if section_tag not in answerable:
        return _error_result(
            "UNKNOWN_INTERACTION",
            f"Interaction {interaction_id} is not on the current workshop step.",
            interaction_id=interaction_id,
        )  # type: ignore[return-value]

    resolved_answer, was_default, coaching = _resolve_interaction_answer(interaction, answer)
    recorded = append_session_interaction(
        session_id=session_id,
        section_tag=section_tag,
        interaction_id=interaction.id,
        kind=interaction.type,
        answer=resolved_answer,
        recommended=interaction.recommended,
        was_default=was_default,
        coaching_shown=coaching,
        surface="mcp",
    )

    unblocks = None
    if recorded and interaction.type in {"decision", "confirm"}:
        confirmed = (
            interaction.type == "decision"
            or (not was_default and resolved_answer == interaction.recommended)
        )
        if confirmed:
            state.captured_outputs[decision_capture_key(section_tag, interaction.id)] = resolved_answer
            save_session(
                session_id=session_id,
                captured_outputs=dict(state.captured_outputs),
            )
            unblocks = section_tag
    elif recorded and interaction.type == "comprehension" and slot == "post":
        # Mark the POST comprehension as answered so vibe_complete_step stops
        # re-surfacing it as a reminder. Scoped to the post slot (the only one the
        # reminder targets) so pre/decision checks never touch captured_outputs.
        # Non-gating — this only suppresses the advisory nudge; a silent accept
        # still counts as answered.
        state.captured_outputs[interaction_answered_key(section_tag, interaction.id)] = resolved_answer
        save_session(
            session_id=session_id,
            captured_outputs=dict(state.captured_outputs),
        )

    return SubmitAnswerResult(recorded=recorded, coaching=coaching, unblocks=unblocks)


@mcp.tool(
    name="vibe_set_parameters",
    description=(
        "Set/update session parameters, feature flags, and the use-case lock. "
        "Selection: pass `use_case_source` (curated/custom) with `industry`, `use_case`, "
        "`use_case_label`; custom also needs `use_case_description` (session-local). "
        "For a PRD-grade custom brief pass `mode=\"draft_custom\"` (+`use_case_hints`), "
        "then confirm by resending `use_case_description`. Args: `session_id`, `params`, `mode`."
    ),
    annotations=ToolAnnotations(
        readOnlyHint=False,
        destructiveHint=False,
        idempotentHint=True,
        openWorldHint=True,
    ),
    structured_output=True,
)
def vibe_set_parameters(
    session_id: str,
    params: dict[str, Any],
    mode: str | None = None,
    context: Context | None = None,
) -> SetParametersResult:
    loaded = _load_session_for_request(session_id, context)
    if loaded is None:
        return _error_result("INVALID_SESSION", "The requested session could not be resolved.")  # type: ignore[return-value]

    state, _ = loaded

    # Friendly data-location aliases (Workstream 1): map the web LakehouseParams
    # editor's catalog/schema fields onto the workshop parameter keys the assembler
    # substitutes ({chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema}), so an
    # MCP learner retargets the Locate Data source the same way the UI does. Raw keys
    # still work; a blank value is rejected rather than silently clearing the default.
    _DATA_LOCATION_ALIASES = {
        "data_catalog": "chapter_3_lakehouse_catalog",
        "data_schema": "chapter_3_lakehouse_schema",
    }
    for _alias, _target in _DATA_LOCATION_ALIASES.items():
        if _alias in params:
            _value = str(params.pop(_alias) or "").strip()
            if not _value:
                return _error_result(  # type: ignore[return-value]
                    "INVALID_PARAMETER",
                    f"{_alias} must be a non-empty catalog/schema name.",
                )
            params[_target] = _value

    # Reject an unknown industry BEFORE persisting anything (Workstream D). The
    # authoritative set is the industries that actually have use cases
    # (``get_use_cases_map()`` keys) — NOT ``get_industries()``, whose YAML fallback
    # can omit an industry that still has curated use cases. Fail-open on an empty
    # map so a data-layer outage never blocks a selection.
    if "industry" in params:
        from .api.routes import get_use_cases_map

        known_industries = set(get_use_cases_map().keys())
        industry_val = str(params.get("industry") or "")
        if known_industries and industry_val not in known_industries:
            return _error_result(  # type: ignore[return-value]
                "UNKNOWN_INDUSTRY",
                f"Unknown industry '{industry_val}'. Choose one from available_industries.",
            )

    state.session_parameters.update(params)
    # MCP is exclusively Genie Code: keep the fork marker present so a merge that
    # omits it never silently drops the session back to the __default__ prompt.
    state.session_parameters.setdefault("coding_assistant", DEFAULT_CODING_ASSISTANT)
    # A confirmed custom use case must land in the fields the assembler reads.
    _mirror_custom_usecase(state.session_parameters)
    resolved_params = dict(state.session_parameters)

    # Echo the inlined discovery lists on any selection-touching call so the agent
    # never has to read a vibe:// resource (Workstream D). Best-effort; None on a
    # plain non-selection merge (e.g. {"catalog": ...}).
    echo_industries: list[dict[str, Any]] | None = None
    echo_use_cases: list[dict[str, Any]] | None = None
    if _touches_usecase_selection(params):
        try:
            echo_industries = _available_industries()
            chosen = str(resolved_params.get("industry") or "").strip()
            if chosen:
                echo_use_cases = _available_use_cases(chosen)
        except Exception:  # noqa: BLE001 — echo is advisory, never fatal
            pass

    # draft_custom: generate a PRD-grade brief from the app's use-case builder and
    # return it for review WITHOUT persisting a description (the learner confirms
    # it back through a normal call carrying use_case_description).
    if mode == "draft_custom":
        if resolved_params.get("use_case_source") != "custom":
            return _error_result(  # type: ignore[return-value]
                "DRAFT_PRECONDITION",
                "draft_custom requires use_case_source=custom.",
            )
        name = str(
            resolved_params.get("use_case_label") or resolved_params.get("use_case") or ""
        ).strip()
        hints = str(resolved_params.get("use_case_hints") or "").strip()
        if not (name or hints):
            return _error_result(  # type: ignore[return-value]
                "DRAFT_PRECONDITION",
                "Provide a use case name (use_case_label) or use_case_hints to draft.",
            )
        # Persist the merged inputs (industry/source/label/hints) but NOT a draft.
        save_session(session_id=session_id, session_parameters=resolved_params)
        from .api.routes import UseCaseGenerateRequest, generate_usecase_description

        industry = str(resolved_params.get("industry") or "").strip() or None
        request_body = UseCaseGenerateRequest(
            industry=industry,
            use_case_name=name or None,
            hints=hints or None,
            mode="generate",
        )
        drafted = _run_async_blocking(lambda: generate_usecase_description(request_body))
        # Record that the app FMAPI produced a draft for THIS session. The confirm
        # gate (both here and in vibe_complete_step) requires this marker, so a
        # custom use case can never be locked from a self-authored description —
        # the learner must route through the FMAPI draft first (Workstream #3).
        resolved_params["custom_draft_ready"] = True
        resolved_params["custom_drafted_description"] = drafted
        save_session(session_id=session_id, session_parameters=resolved_params)
        return SetParametersResult(
            resolved_params=resolved_params,
            missing_required=_selection_missing_required(resolved_params),
            drafted_description=drafted,
            available_industries=echo_industries,
            available_use_cases=echo_use_cases,
        )

    # Workstream #3: a custom use case cannot be locked from a self-authored
    # description — it must come from the app FMAPI draft. Reject a completed
    # custom selection (source=custom, nothing missing) that never ran
    # draft_custom (no ``custom_draft_ready`` marker), pointing the agent at it.
    if (
        _is_selection_call(params)
        and _custom_usecase_locked(resolved_params)
        and not resolved_params.get("custom_draft_ready")
    ):
        return _error_result(  # type: ignore[return-value]
            "CUSTOM_DRAFT_REQUIRED",
            'Custom use cases must be drafted through the app FMAPI first. Call '
            'vibe_set_parameters(mode="draft_custom") with use_case_source=custom '
            "and a use_case_label or use_case_hints, then confirm the returned draft.",
        )

    # Whether THIS call is a use-case selection is decided from the incoming
    # params — never from the accumulated resolved state — so an unrelated later
    # merge (e.g. {"catalog": ...}) keeps the plain-merge contract even after a
    # prior selection left use_case_source in session_parameters (B2).
    missing_required = (
        _selection_missing_required(resolved_params)
        if _is_selection_call(params)
        else []
    )

    # Pre-journey use-case resolution (Option A). A fully-locked selection (this
    # call carries a source and nothing required is missing) resolves the
    # use_case_selection gate up front — writing the gate string to completed_gates
    # AND the use_case_brief artifact to captured_outputs, mirroring App step 1.
    # A custom selection has already cleared the FMAPI-draft gate above, so a lock
    # here is legitimate. This replaces the retired vibe_complete_step path for
    # use_case_selection; the gate then unlocks prd_generation
    # (requiresGate="use_case_selection", consumes=["use_case_brief"]).
    resolved_use_case = False
    if _is_selection_call(params) and not missing_required:
        newly = engine.resolve_use_case(state, _build_use_case_brief(resolved_params))
        resolved_use_case = engine.use_case_resolved(state)
        # Refine the auto-name to what this session is building — only when the
        # gate is newly resolved, so COALESCE preserves a name the learner set.
        refined_name = None
        if newly:
            label = resolved_params.get("use_case_label") or resolved_params.get("use_case")
            if label:
                refined_name = f"Genie Code — {label}"
        # R3 item 3: persist the top-level industry/use_case columns (NOT just the
        # session_parameters JSONB) so this MCP-locked session earns step-1 credit
        # (the aggregation reads industry AND use_case) AND appears in the
        # industry/use-case analytics breakdowns (which GROUP BY the *_label
        # columns). Labels: use_case_label is carried in resolved_params (a
        # selection required key); industry_label is resolved here from the same
        # curated list the echo uses. save_session COALESCE-preserves None, so a
        # missing value never clobbers an existing one (pass None, not "").
        _lock_industry = str(resolved_params.get("industry") or "").strip() or None
        _lock_use_case = str(resolved_params.get("use_case") or "").strip() or None
        _lock_use_case_label = (
            str(resolved_params.get("use_case_label") or resolved_params.get("use_case") or "").strip()
            or None
        )
        _lock_industry_label = (
            str(resolved_params.get("industry_label") or "").strip()
            or _industry_label_for(_lock_industry or "", echo_industries)
        )
        save_session(
            session_id=session_id,
            session_name=refined_name,
            industry=_lock_industry,
            industry_label=_lock_industry_label,
            use_case=_lock_use_case,
            use_case_label=_lock_use_case_label,
            session_parameters=resolved_params,
            captured_outputs=dict(state.captured_outputs),
            completed_gates=list(state.completed_gates),
        )
    else:
        save_session(session_id=session_id, session_parameters=resolved_params)
    return SetParametersResult(
        resolved_params=resolved_params,
        missing_required=missing_required,
        available_industries=echo_industries,
        available_use_cases=echo_use_cases,
        use_case_resolved=resolved_use_case,
    )


def _track_overview(track: str) -> str:
    if track not in engine.MANIFEST.tracks:
        return json.dumps({"error": "UNKNOWN_TRACK", "track": track})
    selected = engine.MANIFEST.tracks[track]
    sections = [
        {"id": section.id, "title": section.title, "chapter": section.chapter, "why": section.why}
        for section in selected.sections
    ]
    return json.dumps({"track": track, "title": selected.title, "sections": sections}, indent=2)


def read_getting_started() -> str:
    return GETTING_STARTED_GUIDE


def _available_industries() -> list[dict[str, Any]]:
    """Curated industry options as a list of {value, label} dicts.

    The single source of truth for both the ``vibe://usecases/industries`` resource
    (SPA/user-attach path) and the inlined tool payload / ``vibe_set_parameters``
    echo (Workstream D — the Genie Code agent cannot read resources). Backed by the
    SAME ``get_industries()`` seam the SPA uses; lazy-imported so nothing triggers a
    Databricks/Lakebase call at registration time. The leading ``value == ""``
    placeholder ("Select an industry...") is a dropdown affordance and is dropped so
    an agent sees only real options.
    """
    from .api.routes import get_industries

    return [
        {"value": opt.get("value"), "label": opt.get("label")}
        for opt in get_industries()
        if opt.get("value")
    ]


def _available_use_cases(industry: str) -> list[dict[str, Any]]:
    """Use cases for one industry, CERTIFIED-FIRST, as a list of dicts.

    Shared by the ``vibe://usecases/{industry}`` resource and the inlined payload /
    echo. Backed by ``get_use_cases_map()``, which returns RAW Lakebase order —
    certified-first is frontend-only today — so the ordering is enforced here with a
    stable sort (``is_certified`` True sorts ahead; original order preserved within
    each group). The empty ``"Select a use case..."`` placeholder is dropped. Each
    entry carries value/label/category/is_certified.
    """
    from .api.routes import get_use_cases_map

    entries = [e for e in get_use_cases_map().get(industry, []) if e.get("value")]
    ordered = sorted(entries, key=lambda e: not bool(e.get("is_certified")))
    return [
        {
            "value": e.get("value"),
            "label": e.get("label"),
            "category": e.get("category"),
            "is_certified": bool(e.get("is_certified")),
        }
        for e in ordered
    ]


def _usecase_industries_resource() -> str:
    """Curated industry options for use-case selection (D11 §3.1).

    Backed by the SAME seam the SPA uses — ``get_industries()`` — so there is one
    source of truth and no fork. Lazy-imported so registration triggers no
    import-time Databricks/Lakebase call. The leading ``value == ""`` placeholder
    ("Select an industry...") is a dropdown affordance and is dropped here so an
    agent sees only real options.
    """
    return json.dumps({"industries": _available_industries()}, indent=2)


def _usecases_for_industry_resource(industry: str) -> str:
    """Use cases for one industry, CERTIFIED-FIRST (D11 §3.1).

    Backed by ``get_use_cases_map()``. That seam returns RAW Lakebase order —
    certified-first is frontend-only today — so the ordering is enforced here with
    a stable sort (``is_certified`` True sorts ahead; original order preserved
    within each group). The empty ``"Select a use case..."`` placeholder is
    dropped. Each entry carries value/label/category/is_certified.
    """
    return json.dumps(
        {"industry": industry, "use_cases": _available_use_cases(industry)}, indent=2
    )


def _session_state_resource(session_id: str, context: Context | None = None) -> str:
    loaded = _load_session_for_request(session_id, context)
    if loaded is None:
        return json.dumps({"isError": True, "error": {"code": "INVALID_SESSION"}})
    state, _ = loaded
    outline = [item.model_dump() for item in _outline_items(DEFAULT_TRACK, state)]
    return json.dumps(
        {
            "outline": outline,
            "completed_gates": list(state.completed_gates),
            "captured_output_keys": sorted(state.captured_outputs),
        },
        indent=2,
    )


mcp._resource_manager.add_template(
    _track_overview,
    uri_template="vibe://track/{track}/overview",
    name="vibe-track-overview",
    description="Track narrative and manifest sections.",
    meta={"ttlMs": 3_600_000, "cacheScope": "global"},
)
mcp._resource_manager.add_template(
    _session_state_resource,
    uri_template="vibe://session/{session_id}/state",
    name="vibe-session-state",
    description="Fresh live session state and gate ledger.",
    meta={"ttlMs": 0, "cacheScope": "session"},
)
mcp.add_resource(
    TextResource(
        uri="vibe://style/vibecoding",
        name="vibe-style-vibecoding",
        description="Vibe Coding gate-ledger convention.",
        mime_type="text/markdown",
        text=VIBECODING_STYLE,
        meta={"ttlMs": 86_400_000, "cacheScope": "global"},
    )
)
mcp.add_resource(
    TextResource(
        uri="vibe://guide/getting-started",
        name="vibe-guide-getting-started",
        description="Self-serve workshop orientation and troubleshooting.",
        mime_type="text/markdown",
        text=GETTING_STARTED_GUIDE,
        meta={"ttlMs": 86_400_000, "cacheScope": "global"},
    )
)
mcp.add_resource(
    FunctionResource(
        uri="vibe://usecases/industries",
        name="vibe-usecases-industries",
        description="Curated industry options (value/label) for use-case selection.",
        mime_type="application/json",
        fn=_usecase_industries_resource,
        meta={"ttlMs": 3_600_000, "cacheScope": "global"},
    )
)
mcp._resource_manager.add_template(
    _usecases_for_industry_resource,
    uri_template="vibe://usecases/{industry}",
    name="vibe-usecases-for-industry",
    description="Use cases for an industry, certified-first, each with value/label/category/is_certified.",
    mime_type="application/json",
    meta={"ttlMs": 3_600_000, "cacheScope": "global"},
)


@mcp.prompt(
    name="Start the Genie Accelerator",
    description="Start the first-run Genie Accelerator orientation and present step one.",
)
def start_genie_accelerator(use_case: str | None = None, industry: str | None = None) -> str:
    parameters = []
    if use_case:
        parameters.append(f'use_case="{use_case}"')
    if industry:
        parameters.append(f'industry="{industry}"')
    suffix = ", " + ", ".join(parameters) if parameters else ""
    return (
        f"{ORIENTATION_PREAMBLE}\n\n"
        "Start the Genie Accelerator by calling `vibe_start_track` with "
        f'{{track:"genie-accelerator"{suffix}}}, then call `vibe_get_step`. '
        "Present the returned `prompt` verbatim first, then narrate `why`, the gate, and the next "
        "step, and show `user_trigger_prompt` verbatim before waiting. Call `vibe_explain_step` if the "
        "learner asks how to apply the step or what to expect. Keep questions in chat."
    )


@mcp.prompt(
    name="Continue where I left off",
    description="Resume the current workshop session without repeating first-run orientation.",
)
def continue_where_left_off() -> str:
    return (
        "Read `vibe://session/{session_id}/state`, call `vibe_next_step`, and resume the learner. "
        "Present the returned `prompt` verbatim first, then narrate the supporting fields."
    )


@mcp.prompt(
    name="How does this workshop work?",
    description="Explain the workshop using the server-side getting-started guide.",
)
def how_workshop_works() -> str:
    return (
        "Read `vibe://guide/getting-started` and explain how to answer in chat, how progress and "
        "gates work, the one benchmark hard stop, troubleshooting, and how to mirror progress in "
        "the web UI. When presenting a step later, always present its prompt verbatim first."
    )


def contract_error_results_for_tests() -> dict[str, _ContractError]:
    """Expose representative typed failures for the D8 contract test."""

    return {
        code: _error_result(code, f"Expected workshop error: {code}")
        for code in ("UNKNOWN_TRACK", "INVALID_SESSION", "UNKNOWN_STEP", "STEP_LOCKED")
    }


mcp._install_error_aware_handler()


mcp_app = mcp.http_app(path="/", transport="streamable-http", stateless_http=True)
