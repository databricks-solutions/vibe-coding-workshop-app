"""MCP adapter for the Vibe Coding Workshop."""

from __future__ import annotations

import asyncio
import contextvars
import json
import logging
import threading
import uuid
from dataclasses import asdict
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
    "the next step on your own. "
    "The track saves progress server-side and does not block, except for one benchmark hard stop. "
    "You can mirror progress in the web UI using the same session. If tools go missing, disconnect "
    "other MCP servers to stay within the 20-tool budget."
)

GETTING_STARTED_GUIDE = """# Getting started

This workshop is a guided conversation. Start a track, read each prompt verbatim, then narrate why
it matters and how to apply it. Answer questions in chat; silence accepts the recommended default.
Progress is saved server-side and can be mirrored in the web UI using the same session.

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
    how_to_apply: str
    expected_output: str
    # The plain-English ask the learner submits to START this step. The agent
    # presents it and waits for the learner to say it, rather than auto-running
    # the step (suggestion c). Empty when a step authors no trigger.
    user_trigger_prompt: str = ""
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


class StartTrackResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    session_id: str
    track: str
    outline: list[OutlineItem]


class CompleteStepResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    completed_gates: list[str]
    next: ExplainabilityPayload | DoneResult


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


def _session_state(record: dict[str, Any], track: str = DEFAULT_TRACK) -> engine.SessionState:
    completed_gates = list(record.get("completed_gates") or [])
    completed_steps = record.get("completed_steps") or []
    try:
        steps = manifest.load_manifest().track_steps(track)
        for step_number in completed_steps:
            if isinstance(step_number, int) and 1 <= step_number <= len(steps):
                tag = steps[step_number - 1].sectionTag
                if tag not in completed_gates:
                    completed_gates.append(tag)
    except KeyError:
        pass
    params = dict(record.get("session_parameters") or {})
    for key in ("industry", "use_case", "industry_label", "use_case_label"):
        if record.get(key) is not None:
            params.setdefault(key, record[key])
    captured_outputs = dict(record.get("captured_outputs") or {})
    return engine.SessionState(
        completed_gates=completed_gates,
        captured_outputs=captured_outputs,
        session_parameters=params,
    )


def _coerce_state(value: engine.SessionState | dict[str, Any]) -> engine.SessionState:
    if isinstance(value, engine.SessionState):
        return value
    return _session_state(value)


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
    return _session_state(record, track), session_id


def _outline_items(track: str, state: engine.SessionState) -> list[OutlineItem]:
    return [OutlineItem(**asdict(item)) for item in engine.outline(track, state)]


def _next_reference(track: str, state: engine.SessionState, step: manifest.Step) -> StepReference:
    ordered = engine.MANIFEST.outline_order(track, flags=engine._flags_for(track, state))
    index = next((idx for idx, candidate in enumerate(ordered) if candidate.sectionTag == step.sectionTag), None)
    if index is not None and index + 1 < len(ordered):
        following = ordered[index + 1]
        return StepReference(sectionTag=following.sectionTag, title=following.title)
    return StepReference(sectionTag="", title="Track complete")


def decision_capture_key(section_tag: str, interaction_id: str) -> str:
    return f"interaction_decision:{section_tag}:{interaction_id}"


def _interaction_payload(section_tag: str) -> dict[str, Interaction | None] | None:
    blocks = manifest.interactions_for(section_tag)
    if not blocks:
        return None
    return {
        slot: Interaction.model_validate(block) if block is not None else None
        for slot in manifest.INTERACTION_SLOTS
        for block in [blocks.get(slot)]
    }


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
    orientation = ORIENTATION_PREAMBLE if not state.completed_gates and step.order == 1 else None
    payload = ExplainabilityPayload(
        sectionTag=step.sectionTag,
        title=step.title,
        why=step.why or "",
        prompt=assembled.get("input", ""),
        how_to_apply=assembled.get("how_to_apply", ""),
        expected_output=assembled.get("expected_output", ""),
        user_trigger_prompt=assembled.get("user_trigger_prompt", ""),
        gate=step.gate,
        requiresGate=step.requiresGate,
        consumes=list(step.consumes),
        produces=step.produces,
        execution=step.execution,
        next=_next_reference(track, state, step),
        interaction=_interaction_payload(step.sectionTag),
        orientation=orientation,
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
    return payload


@mcp.tool(
    name="vibe_start_track",
    description=(
        "Start or resume a guided workshop track (e.g. the Genie Accelerator) for the current user. "
        "Call this first, in Agent mode, before any other vibe tool. Args: `track` (required), optional "
        "`use_case`/`industry`/`session_id`. Returns the session id and the ordered step outline. "
        "Errors if `track` is unknown."
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
    if not session_id and is_lakebase_configured():
        save_session(
            session_id=resolved,
            industry=industry,
            use_case=use_case,
            created_by=_request_user(context),
            current_step=1,
            completed_steps=[],
            session_parameters=state.session_parameters,
        )
    if industry:
        state.session_parameters["industry"] = industry
    if use_case:
        state.session_parameters["use_case"] = use_case
    return StartTrackResult(session_id=resolved, track=track, outline=_outline_items(track, state))


@mcp.tool(
    name="vibe_get_step",
    description=(
        "Fetch one workshop step to present. Returns the prompt to run **verbatim**, plus why it "
        "matters, how to apply it, expected output, the gate, the next step, and `user_trigger_prompt` "
        "— the plain-English ask to hand the learner so THEY start the work (present it and wait; never "
        "auto-run). Optional `interaction` to ask in chat. Args: `session_id`; `sectionTag` (optional, "
        "defaults to current)."
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
        if not engine.can_start(step, state):
            return _error_result("STEP_LOCKED", f"Complete {step.requiresGate} before this step.", sectionTag=sectionTag)  # type: ignore[return-value]
    return _step_payload(DEFAULT_TRACK, state, step, session_id=session_id)


@mcp.tool(
    name="vibe_next_step",
    description=(
        "Advance to the first not-yet-completed step whose prerequisite gate is satisfied, and return "
        "it (same shape as `vibe_get_step`, incl. `user_trigger_prompt`). Present the step, hand the "
        "learner its trigger prompt, then WAIT for them to submit it — never auto-run. Returns "
        "`{done:true}` when complete. Call after a step's gate is recorded. Args: `session_id`."
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
    next_item = engine.next_step(DEFAULT_TRACK, state)
    if isinstance(next_item, engine.Done):
        return NextStepResult.model_validate(DoneResult())
    return NextStepResult.model_validate(_step_payload(DEFAULT_TRACK, state, next_item, session_id=session_id))


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


# --- Cross-surface step-sync bridge (D11 §4.3) -------------------------------
# The MCP engine tracks progress as completed_gates/captured_outputs, while the
# legacy SPA tracks it as current_step (int) + completed_steps (int list). To let
# MCP-driven progress show up in the legacy SPA, vibe_complete_step dual-writes
# the legacy fields — derived from the SAME manifest section order that
# ``_session_state`` uses to translate completed_steps back into gates. This is
# the inverse of that reader (one section-order source, no hardcoded positions).
def _legacy_progress(
    track: str,
    completed_gates: list[str],
    next_step: manifest.Step | engine.Done,
) -> tuple[int, list[int]]:
    """Map engine progress to legacy (current_step, completed_steps).

    ``completed_steps`` are the 1-based positions of every completed gate in the
    manifest's full ordered step list (sorted, de-duplicated — idempotent on
    replay). ``current_step`` is the position of the engine's next step, or one
    past the end when the track is done. Because completed_gates only grows
    within a session, current_step is monotonic and never regresses.
    """

    positions = {
        step.sectionTag: index + 1
        for index, step in enumerate(manifest.load_manifest().track_steps(track))
    }
    completed_steps = sorted(
        {positions[tag] for tag in completed_gates if tag in positions}
    )
    if isinstance(next_step, engine.Done):
        current_step = len(positions) + 1
    else:
        current_step = positions.get(next_step.sectionTag, len(positions) + 1)
    return current_step, completed_steps


@mcp.tool(
    name="vibe_complete_step",
    description=(
        "Record that the current step's gate passed and store its captured output (the gate = this "
        "call, next-action-as-approval); advances the walk. Call only after the learner triggered and "
        "ran the step. If its `interaction` has a `post` check, ask it via `vibe_submit_answer` first "
        "(only while current). Not for `execution:ui-driven` steps. Args: `session_id`, `sectionTag`, "
        "`captured_output`."
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

    # D11 §4.3 sync bridge: dual-write the legacy SPA progress fields
    # (current_step/completed_steps) alongside the engine state, in the SAME
    # save — so a learner driving the workshop through MCP is reflected in the
    # legacy SPA step indicator. Additive; the existing captured_outputs/
    # completed_gates writes are preserved (COALESCE-safe, none-preserve).
    current_step, completed_steps = _legacy_progress(
        DEFAULT_TRACK, result.completed_gates, result.next_step
    )
    save_session(
        session_id=session_id,
        captured_outputs=dict(state.captured_outputs),
        completed_gates=list(result.completed_gates),
        current_step=current_step,
        completed_steps=completed_steps,
    )

    next_step = result.next_step
    if isinstance(next_step, engine.Done):
        next_payload: ExplainabilityPayload | DoneResult = DoneResult()
    else:
        next_payload = _step_payload(DEFAULT_TRACK, state, next_step, session_id=session_id)
    return CompleteStepResult(
        completed_gates=list(result.completed_gates),
        next=next_payload,
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
    section_tag, _slot, interaction = resolved
    current = engine.next_step(DEFAULT_TRACK, state)
    if isinstance(current, engine.Done) or current.sectionTag != section_tag:
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
        return SetParametersResult(
            resolved_params=resolved_params,
            missing_required=_selection_missing_required(resolved_params),
            drafted_description=drafted,
            available_industries=echo_industries,
            available_use_cases=echo_use_cases,
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
    save_session(session_id=session_id, session_parameters=resolved_params)
    return SetParametersResult(
        resolved_params=resolved_params,
        missing_required=missing_required,
        available_industries=echo_industries,
        available_use_cases=echo_use_cases,
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
        "Present the returned `prompt` verbatim first, then narrate `why`, `how_to_apply`, "
        "`expected_output`, the gate, and the next step. Keep questions in chat."
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
