"""Resolve a session's completion/skip gates into canonical GLOBAL step numbers
for the scoring / leaderboard / analytics aggregations.

``STEP_SCORES`` / ``CHAPTERS`` are keyed by GLOBAL ``ALL_STEPS`` numbers. The
authoritative per-session progress is the sectionTag-keyed gate set:
``completed_gates`` (its own column) and ``skipped_gates`` (nested in the
``session_parameters`` JSONB). This module maps each gate TAG to its GLOBAL
number via the INVERSE of ``manifest.step_number_to_tag()`` — the SAME map the
engine composes with, so global-number authority stays singular — dropping any
tag that does not resolve rather than mis-indexing it.

Gates are the only source (T5 R4b): there is no origin decision and no numeric
fallback. ``state.build_session_state`` resolves the read path the same way.
Pure read-side: no stored row is changed.
"""

from __future__ import annotations

from typing import Iterable

from . import manifest


def tag_to_global_number(path: str | None = None) -> dict[str, int]:
    """Inverse of ``manifest.step_number_to_tag()``: sectionTag -> GLOBAL number.

    Built from the SAME map the engine uses (no second numbering authority).
    sectionTags are unique across ``ALL_STEPS`` so the inverse is well-defined.
    Callers that aggregate many rows build this once and pass it in via
    ``inverse_map``."""

    return {tag: number for number, tag in manifest.step_number_to_tag(path).items()}


def _globals_from_gates(
    gates: Iterable[str] | None, inverse_map: dict[str, int]
) -> set[int]:
    """sectionTags -> GLOBAL numbers via the inverse map; unresolved tags are
    dropped rather than mis-indexed."""

    return {
        inverse_map[tag]
        for tag in (gates or [])
        if isinstance(tag, str) and tag in inverse_map
    }


def resolve_completion_globals(
    *,
    completed_gates: Iterable[str] | None,
    skipped_gates: Iterable[str] | None,
    inverse_map: dict[str, int],
) -> tuple[set[int], set[int]]:
    """Resolve one session's (completed, skipped) canonical GLOBAL-number sets.

    Both sides come straight from their gates (T5 R4b): ``completed`` from
    ``completed_gates`` and ``skipped`` from ``skipped_gates``, each mapped
    tag -> GLOBAL number through ``inverse_map``. There is no numeric fallback —
    exactly as ``state.build_session_state`` resolves the read path.
    """

    completed = _globals_from_gates(completed_gates, inverse_map)
    skipped = _globals_from_gates(skipped_gates, inverse_map)
    return completed, skipped
