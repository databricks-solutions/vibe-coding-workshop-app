"""Shared reconstruction of ``engine.SessionState`` from a persisted record.

Extracted from ``mcp_server._session_state`` (Phase 3 T1, DECISION-T1-3) so the
MCP adapter and the REST ``/api/track/{track}/outline`` endpoint build session
state through ONE code path — the number->gate reconciliation lives here and
nowhere else — and so the REST layer never has to import the FastMCP app to reach it.

Reconciling the two ``completed_steps`` numberings (T5 PR1, decision D-1)
-------------------------------------------------------------------------
``completed_steps`` (and ``skipped_steps``) collide two numberings on one column:

* **App-origin** rows persist **global ``ALL_STEPS`` numbers** and never write
  ``completed_gates`` (so gates arrive empty).
* **MCP-origin** rows persist **dense track positions** AND write authoritative
  ``completed_gates``.

So the disambiguation is: **gates present => MCP-origin, trust the gates verbatim**
and ignore the (dense) numbers entirely; **gates empty => App-origin**, resolve the
numbers as GLOBAL ``ALL_STEPS`` numbers via ``manifest.step_number_to_tag`` and keep
only tags that belong to THIS track's step set (cross-track / non-step globals such
as the pre-journey ``usecase_selection`` are dropped, never mis-indexed).
``skipped`` moves in lockstep (D-3). This is a pure READ-side fix: stored rows are
unchanged. ``session_parameters`` is copied verbatim and ``industry``/``use_case``/
``*_label`` are mirrored in (setdefault, so an existing parameter value wins).
"""

from __future__ import annotations

from typing import Any

from . import engine, manifest

# Mirrors mcp_server.DEFAULT_TRACK — MCP is exclusively the Genie Code client.
DEFAULT_TRACK = "genie-accelerator"


def _globals_to_tags(
    step_numbers: Any,
    number_to_tag: dict[int, str],
    track_tags: set[str],
) -> list[str]:
    """Map App-origin GLOBAL step numbers to sectionTags, in order, de-duplicated.

    A number is kept only when it maps to a tag (``number_to_tag``) that belongs to
    the track (``track_tags``); everything else — unmapped numbers, out-of-track
    globals, non-ints — is dropped rather than mis-indexed."""

    tags: list[str] = []
    for step_number in step_numbers or []:
        if not isinstance(step_number, int):
            continue
        tag = number_to_tag.get(step_number)
        if tag is not None and tag in track_tags and tag not in tags:
            tags.append(tag)
    return tags


def build_session_state(record: dict[str, Any], track: str = DEFAULT_TRACK) -> engine.SessionState:
    completed_gates = list(record.get("completed_gates") or [])
    params = dict(record.get("session_parameters") or {})

    # gates empty => App-origin: resolve completed/skipped GLOBAL numbers to tags.
    # gates present => MCP-origin: trust gates as-is, ignore the (dense) numbers.
    if not completed_gates:
        loaded = manifest.load_manifest()
        number_to_tag = loaded.step_number_to_tag
        try:
            track_tags = {step.sectionTag for step in loaded.track_steps(track)}
        except KeyError:
            track_tags = set()
        completed_gates = _globals_to_tags(
            record.get("completed_steps"), number_to_tag, track_tags
        )
        # Skipped moves in lockstep (D-3). Only backfill when the tag-side is absent
        # so an explicit ``skipped_gates`` (if ever present) is never clobbered.
        if "skipped_gates" not in params:
            skipped_tags = _globals_to_tags(
                record.get("skipped_steps"), number_to_tag, track_tags
            )
            if skipped_tags:
                params["skipped_gates"] = skipped_tags

    for key in ("industry", "use_case", "industry_label", "use_case_label"):
        if record.get(key) is not None:
            params.setdefault(key, record[key])
    captured_outputs = dict(record.get("captured_outputs") or {})
    return engine.SessionState(
        completed_gates=completed_gates,
        captured_outputs=captured_outputs,
        session_parameters=params,
    )
