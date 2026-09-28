"""Shared reconstruction of ``engine.SessionState`` from a persisted record.

Extracted from ``mcp_server._session_state`` (Phase 3 T1, DECISION-T1-3) so the
MCP adapter and the REST ``/api/track/{track}/outline`` endpoint build session
state through ONE code path — the number->gate backfill lives here and nowhere
else — and so the REST layer never has to import the FastMCP app to reach it.

Behaviour is identical to the former inline ``_session_state``: back-fill
``completed_gates`` from legacy ``completed_steps`` indices against the manifest's
ordered step list for ``track``, copy ``session_parameters`` verbatim, and mirror
``industry``/``use_case``/``*_label`` into the parameters (setdefault, so a value
already in ``session_parameters`` wins).
"""

from __future__ import annotations

from typing import Any

from . import engine, manifest

# Mirrors mcp_server.DEFAULT_TRACK — MCP is exclusively the Genie Code client.
DEFAULT_TRACK = "genie-accelerator"


def build_session_state(record: dict[str, Any], track: str = DEFAULT_TRACK) -> engine.SessionState:
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
