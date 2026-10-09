"""Shared reconstruction of ``engine.SessionState`` from a persisted record.

Extracted from ``mcp_server._session_state`` (Phase 3 T1, DECISION-T1-3) so the
MCP adapter and the REST ``/api/track/{track}/outline`` endpoint build session
state through ONE code path, and so the REST layer never has to import the
FastMCP app to reach it.

Progress is read from the authoritative gate sets (T5 R4b): ``completed_gates``
verbatim, and ``skipped_gates`` from ``session_parameters`` verbatim — the
sectionTag-keyed source of truth the engine composes with. There is no numeric
fallback and no re-indexing. This is a pure READ-side reconstruction: stored
rows are unchanged. ``session_parameters`` is copied verbatim and
``industry``/``use_case``/``*_label`` are mirrored in (setdefault, so an
existing parameter value wins).

Defined intent (industry AND use_case, both non-blank — the App's step-1 rule)
credits the ``use_case_selection`` gate (D-34). The SPA records its own step-1
tag ``usecase_selection``, never the engine gate, so without this credit every
track's prd_generation (requiresGate="use_case_selection", D-33) would be locked
for an SPA-started session. Read-side only and idempotent: no gate is removed,
``captured_outputs`` is untouched (use_case_brief stays absent, so consumers get
the assembler placeholder), and the MCP delta write never persists it (the gate
is already in ``before``). D-13/D-15: an uncatalogued use case is never written
to the use_case column, so it cannot earn this credit.
"""

from __future__ import annotations

from typing import Any

from . import engine

# Mirrors mcp_server.DEFAULT_TRACK — MCP is exclusively the Genie Code client.
DEFAULT_TRACK = "genie-accelerator"


def has_defined_intent(record: dict[str, Any]) -> bool:
    """The App's step-1 rule: industry AND use_case, both non-blank. Shared with
    ``lakebase._has_defined_intent`` (GAP 2) so the rule lives in one place."""

    return bool((record.get("industry") or "").strip() and (record.get("use_case") or "").strip())


def build_session_state(record: dict[str, Any], track: str = DEFAULT_TRACK) -> engine.SessionState:
    completed_gates = list(record.get("completed_gates") or [])
    if has_defined_intent(record) and engine.USE_CASE_GATE not in completed_gates:
        completed_gates.append(engine.USE_CASE_GATE)
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
