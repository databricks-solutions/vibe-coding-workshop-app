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
"""

from __future__ import annotations

from typing import Any

from . import engine

# Mirrors mcp_server.DEFAULT_TRACK — MCP is exclusively the Genie Code client.
DEFAULT_TRACK = "genie-accelerator"


def build_session_state(record: dict[str, Any], track: str = DEFAULT_TRACK) -> engine.SessionState:
    completed_gates = list(record.get("completed_gates") or [])
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
