"""T5 PR3c — disambiguate the two ``completed_steps`` numberings into canonical
GLOBAL step numbers for the scoring / leaderboard / analytics aggregations.

This mirrors ``state.build_session_state``'s D-1 disambiguation (T5 PR1) but
resolves to GLOBAL ``ALL_STEPS`` numbers — the keys that ``STEP_SCORES`` and
``CHAPTERS`` are keyed by — instead of track sectionTags. It exists because the
backend aggregations in ``services/lakebase.py`` (``get_leaderboard`` /
``get_analytics``) read the raw numeric ``completed_steps`` column directly and
therefore mis-handle the two-numbering collision that PR1 already fixed on the
read path:

* **App-origin** rows persist **global ``ALL_STEPS`` numbers** and never write
  ``completed_gates`` (gates arrive empty).
* **MCP-origin** rows persist **dense track positions** in ``completed_steps``
  AND write authoritative ``completed_gates`` (see ``mcp_server._legacy_progress``).

Disambiguation (origin decided ONCE by ``completed_gates`` presence, D-1; skipped
moves in lockstep, D-3):

* **gates present (MCP-origin)** => trust the gates. Map each gate TAG to its
  GLOBAL number via the INVERSE of ``manifest.step_number_to_tag()``; a tag that
  does not resolve is dropped. The (dense) ``completed_steps`` are ignored —
  NEVER re-indexed by dense position. ``skipped`` comes from the authoritative
  ``skipped_gates`` (persisted under ``session_parameters``), mapped the same way;
  the (dense) ``skipped_steps`` are ignored.
* **gates empty (App-origin)** => ``completed_steps`` / ``skipped_steps`` already
  ARE global numbers; use them verbatim (``STEP_SCORES.get`` returns 0 for any
  unscored number, so App-origin scores/counts are byte-for-byte preserved).

Pure read-side: no stored row is changed, and NO second numbering map is
introduced — the inverse is built from the SAME PR1 ``step_number_to_tag`` map,
so global-number authority stays singular.
"""

from __future__ import annotations

from typing import Any, Iterable

from . import manifest


def tag_to_global_number(path: str | None = None) -> dict[str, int]:
    """Inverse of ``manifest.step_number_to_tag()``: sectionTag -> GLOBAL number.

    Built from the SAME PR1 map (no second numbering authority). sectionTags are
    unique across ``ALL_STEPS`` so the inverse is well-defined. Callers that
    aggregate many rows build this once and pass it in via ``inverse_map``."""

    return {tag: number for number, tag in manifest.step_number_to_tag(path).items()}


def _globals_from_numbers(step_numbers: Iterable[Any] | None) -> set[int]:
    """App-origin ``completed_steps``/``skipped_steps`` are already GLOBAL numbers.

    Kept as-is (booleans excluded — ``isinstance(True, int)`` is True in Python)."""

    return {
        n for n in (step_numbers or []) if isinstance(n, int) and not isinstance(n, bool)
    }


def _globals_from_gates(
    gates: Iterable[str] | None, inverse_map: dict[str, int]
) -> set[int]:
    """MCP-origin sectionTags -> GLOBAL numbers via the inverse map; unresolved
    tags are dropped rather than mis-indexed."""

    return {
        inverse_map[tag]
        for tag in (gates or [])
        if isinstance(tag, str) and tag in inverse_map
    }


def canonical_global_numbers(
    gates: Iterable[str] | None,
    steps: Iterable[Any] | None,
    *,
    inverse_map: dict[str, int],
) -> set[int]:
    """Low-level per-field resolver: GLOBAL numbers from one (gates, steps) pair.

    gates present => map the gates; gates empty => the numbers are already global.
    Prefer :func:`resolve_completion_globals` for a session row so completed and
    skipped share ONE origin decision (D-3 lockstep)."""

    gate_list = [g for g in (gates or []) if isinstance(g, str)]
    if gate_list:
        return _globals_from_gates(gate_list, inverse_map)
    return _globals_from_numbers(steps)


def resolve_completion_globals(
    *,
    completed_gates: Iterable[str] | None,
    completed_steps: Iterable[Any] | None,
    skipped_gates: Iterable[str] | None,
    skipped_steps: Iterable[Any] | None,
    inverse_map: dict[str, int],
) -> tuple[set[int], set[int]]:
    """Resolve one session's (completed, skipped) canonical GLOBAL-number sets.

    Origin is decided ONCE by ``completed_gates`` presence (D-1) and applies to
    both completed and skipped (D-3 lockstep) — exactly as
    ``state.build_session_state`` decides it for the read path:

    * gates present (MCP-origin): map ``completed_gates`` and ``skipped_gates``;
      ignore the dense ``completed_steps`` / ``skipped_steps`` entirely.
    * gates empty (App-origin): ``completed_steps`` / ``skipped_steps`` are global
      numbers already; use verbatim.
    """

    completed_gate_list = [g for g in (completed_gates or []) if isinstance(g, str)]
    if completed_gate_list:
        completed = _globals_from_gates(completed_gate_list, inverse_map)
        skipped = _globals_from_gates(skipped_gates, inverse_map)
    else:
        completed = _globals_from_numbers(completed_steps)
        skipped = _globals_from_numbers(skipped_steps)
    return completed, skipped
