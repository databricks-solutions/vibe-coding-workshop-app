"""Pure track resolution for a resumed session (Phase 3 T1, DECISION-T1-1).

A Python port of the SPA's ``resolveRestoredLevel`` (``src/constants/restoreLevel.ts``)
that TOLERATES the legacy ``workshop_level`` sentinels — ``None`` and ``'300'`` —
which are NOT valid track ids. A naive ``track = record['workshop_level']`` 500s or
mis-resolves every legacy None/'300' session; this resolver mirrors the SPA
precedence so a resumed REST outline lands on the SAME filtered track the MCP walk
and the web UI use.

Precedence (mirrors resolveRestoredLevel):
  1. Use-case lock (``USE_CASE_LEVEL_LOCK``) — highest; a locked use case wins outright.
  2. A REAL persisted ``workshop_level`` — one that is a member of the backend's
     authoritative track set (``engine.MANIFEST.tracks``). '300'/'200'/'' are not
     members, so they intentionally fall through.
  3. The assistant legacy fallback (``DEFAULT_LEVEL_BY_ASSISTANT``), consulted only
     when there is no lock AND the level was not explicitly selected — this rescues
     pre-fix genie-code sessions still holding ``workshop_level='300'``.
  4. The system default, ``end-to-end``.
Then the preserved ``skills-accelerator -> end-to-end when no lock`` downgrade.

The authoritative track set is the backend manifest (NOT the TS ``WORKSHOP_LEVELS``
list), so this resolver never re-hardcodes the frontend's track vocabulary.
"""

from __future__ import annotations

from typing import Any

from . import engine

# Ported from src/constants/workflowSections.ts (USE_CASE_LEVEL_LOCK).
USE_CASE_LEVEL_LOCK: dict[str, str] = {
    "build_skill": "skills-accelerator",
}

# Ported from src/constants/codingAssistants.ts (DEFAULT_LEVEL_BY_ASSISTANT).
DEFAULT_LEVEL_BY_ASSISTANT: dict[str, str] = {
    "genie-code": "genie-accelerator",
}

# System default (mirrors normalizeLevel('end-to-end') fallback in the SPA).
DEFAULT_TRACK = "end-to-end"


def is_track(value: object) -> bool:
    """True iff ``value`` is a member of the backend's authoritative track set."""

    return isinstance(value, str) and value in engine.MANIFEST.tracks


def _assistant_default(session_parameters: dict, lock: str | None) -> str | None:
    """Port of ``assistantDefaultLevel`` — the legacy cold-start fallback."""

    if lock or session_parameters.get("level_explicitly_selected"):
        return None
    assistant = session_parameters.get("coding_assistant")
    if not assistant:
        return None
    return DEFAULT_LEVEL_BY_ASSISTANT.get(assistant)


def resolve_track(record: dict[str, Any]) -> str:
    """Resolve the track a resumed session opens on. Always returns a valid track."""

    # (1) Use-case lock wins outright; the skills guard never applies when locked.
    lock = USE_CASE_LEVEL_LOCK.get(record.get("use_case"))
    if lock:
        return lock

    # (2) A real persisted level is a direct member of the authoritative track set.
    raw_level = record.get("workshop_level")
    if is_track(raw_level):
        resolved = raw_level
    else:
        # (3) assistant legacy fallback, then (4) system default.
        session_parameters = record.get("session_parameters") or {}
        resolved = _assistant_default(session_parameters, lock) or DEFAULT_TRACK

    # Preserve 'skills-accelerator -> end-to-end when no lock' (lock is falsy here).
    return DEFAULT_TRACK if resolved == "skills-accelerator" else resolved
