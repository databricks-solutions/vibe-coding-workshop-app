"""Whether a session may switch tracks, and what a switch writes.

One rule for both interfaces: the web UI's track picker locks buttons with
``LevelSelectorGrid.getLockState`` (src/components/LevelSelector.tsx), then
``handleWorkshopLevelChange`` (src/App.tsx) refuses anything but a forward
progression once started; the MCP ``vibe_switch_track`` / ``vibe_start_track``
tools ask :func:`evaluate_switch`, which applies both.
The chain helpers are ports of ``src/constants/workflowSections.ts``
(APP_CHAIN … getActiveChain); tests/workshop/test_track_switch_parity.py runs the
TypeScript originals and compares.

Deliberate differences from the UI:
- The additive gate ("+ Lakebase" needs Apps selected first) is a picker
  building step, not a lock, so it does not apply here.
- skills-accelerator needs the build_skill use case, which only a new session
  gets (``resolve_track`` sends an unlocked skills session to end-to-end), so a
  switch to it is refused with a pointer to a new session.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
from typing import Any

from .completion_keying import tag_to_global_number
from .track_resolution import USE_CASE_LEVEL_LOCK, resolve_track

APP_CHAIN = ("app-only", "app-database", "lakehouse", "lakehouse-di")
LAKEHOUSE_CHAIN = ("lakehouse", "lakehouse-di")
REVERSE_ANALYTICS_CHAIN = ("reverse-lakehouse", "reverse-lakehouse-di", "reverse-lakebase", "reverse-app")
PROGRESSION_CHAINS = (APP_CHAIN, LAKEHOUSE_CHAIN, REVERSE_ANALYTICS_CHAIN)
APP_LAKEBASE_STEPS = frozenset({4, 5, 6, 7, 8})
ACCELERATORS = frozenset({
    "accelerator", "genie-accelerator", "data-engineering-accelerator", "skills-accelerator", "agents-accelerator",
})
CHAIN_CONTEXTS = frozenset({"app", "lakehouse", "reverse"})
_AI_MODULES = ("genie", "agent", "dashboard")
_MEDALLION_LAYERS = ("bronze", "silver", "gold")


def compute_chain_context(prev_chain: str | None, prev_level: str, next_level: str) -> str | None:
    """Port of ``computeChainContext``."""

    if next_level in ACCELERATORS:
        return None
    if next_level.startswith("reverse-"):
        return "reverse"
    if next_level in ("app-only", "app-database", "end-to-end"):
        return "app"
    if next_level in ("lakehouse", "lakehouse-di"):
        climbing_from_app = prev_level in ("app-only", "app-database") or (
            prev_level in ("lakehouse", "lakehouse-di") and prev_chain == "app"
        )
        return "app" if climbing_from_app else "lakehouse"
    return prev_chain


def derive_initial_chain_context(level: str, completed: set[int] | frozenset[int] = frozenset()) -> str | None:
    """Port of ``deriveInitialChainContext``."""

    if level in ("lakehouse", "lakehouse-di"):
        return "app" if APP_LAKEBASE_STEPS & set(completed) else "lakehouse"
    return compute_chain_context(None, level, level)


def active_chain(level: str, completed: set[int] | frozenset[int], chain_context: str | None = None) -> tuple[str, ...] | None:
    """Port of ``getActiveChain``."""

    if chain_context == "app":
        return APP_CHAIN
    if chain_context == "lakehouse":
        return LAKEHOUSE_CHAIN
    if chain_context == "reverse":
        return REVERSE_ANALYTICS_CHAIN
    if level in ("app-only", "app-database"):
        return APP_CHAIN
    if level.startswith("reverse-"):
        return REVERSE_ANALYTICS_CHAIN
    if level in ("lakehouse", "lakehouse-di"):
        return APP_CHAIN if APP_LAKEBASE_STEPS & set(completed) else LAKEHOUSE_CHAIN
    return None


def is_forward_progression(from_level: str, to_level: str) -> bool:
    """Port of ``isForwardProgression``: ``to`` is later than ``from`` on some chain."""

    return any(
        from_level in chain and to_level in chain and chain.index(to_level) > chain.index(from_level)
        for chain in PROGRESSION_CHAINS
    )


def completed_numbers(record: dict[str, Any]) -> set[int]:
    """The session's completed GLOBAL step numbers, from its gates (as the SPA derives them)."""

    inverse = tag_to_global_number()
    return {inverse[tag] for tag in record.get("completed_gates") or [] if isinstance(tag, str) and tag in inverse}


def has_started(completed: set[int]) -> bool:
    """The SPA's "workflow started" test (App.tsx handleWorkshopLevelChange): any step >= 2 done."""

    return any(number >= 2 for number in completed)


# The only levels whose chain varies (an Apps climb or standalone); every other
# level's chain follows from the level, whatever chainContext was left stored
# (the SPA never clears it on a move to an accelerator).
CHAIN_VARIABLE_LEVELS = frozenset({"lakehouse", "lakehouse-di"})


def stored_chain_context(record: dict[str, Any]) -> str | None:
    value = (record.get("session_parameters") or {}).get("chainContext")
    return value if value in CHAIN_CONTEXTS else None


def session_chain_context(record: dict[str, Any], level: str, completed: set[int]) -> str | None:
    """The chain the session is on: the stored one on a lakehouse level, else derived
    (as utils/sessionSync chainFromParams reads it in the web UI)."""

    stored = stored_chain_context(record)
    if stored and level in CHAIN_VARIABLE_LEVELS:
        return stored
    return derive_initial_chain_context(level, completed)


@dataclass(frozen=True)
class SwitchDecision:
    allowed: bool
    current: str
    target: str
    # assistant | use-case | skills-new-session | workflow-started | same (allowed no-op) | ok
    reason: str
    message: str = ""
    allowed_targets: tuple[str, ...] = field(default_factory=tuple)


def evaluate_switch(record: dict[str, Any], target: str, disabled_paths: set[str] | frozenset[str] = frozenset()) -> SwitchDecision:
    """May this session move to ``target``? Same order as the SPA's ``getLockState``."""

    current = resolve_track(record)
    if target == current:
        return SwitchDecision(True, current, target, "same")
    completed = completed_numbers(record)
    started = has_started(completed)
    chain = active_chain(current, completed, session_chain_context(record, current, completed)) if started else None
    allowed_targets = _allowed_targets(current, chain) if started else ()

    if target in disabled_paths:
        return SwitchDecision(False, current, target, "assistant", "That track is turned off for Genie Code in this workshop.", allowed_targets)
    lock = USE_CASE_LEVEL_LOCK.get(record.get("use_case"))
    if lock and target != lock:
        return SwitchDecision(False, current, target, "use-case", "This session's use case keeps it on its track.", allowed_targets)
    if target == "skills-accelerator":
        return SwitchDecision(
            False, current, target, "skills-new-session",
            "The Agent Skills Accelerator needs its own session (it always builds the Data Contract Skill).",
            allowed_targets,
        )
    if started:
        # The picker's lock (current or next on the active chain) AND the App's
        # guard (handleWorkshopLevelChange: forward progression only).
        if target in allowed_targets and is_forward_progression(current, target):
            return SwitchDecision(True, current, target, "ok", allowed_targets=allowed_targets)
        return SwitchDecision(
            False, current, target, "workflow-started",
            "The track is locked once Set Up Project is done; only the next step on the same path is open.",
            allowed_targets,
        )
    return SwitchDecision(True, current, target, "ok")


def _allowed_targets(current: str, chain: tuple[str, ...] | None) -> tuple[str, ...]:
    if chain and current in chain:
        index = chain.index(current)
        if index + 1 < len(chain):
            return (chain[index + 1],)
    return ()


def switch_params(
    params: dict[str, Any],
    current: str,
    target: str,
    *,
    genie_ontology_default: bool,
) -> dict[str, Any]:
    """The session parameters after a switch: what the SPA's handleWorkshopLevelChange
    and handleDirectionChange write (chips back to all-on, Lakehouse off, Genie
    Ontology at the facilitator default on entry, chain and direction for the target).
    Genie Ontology lands in all three keys the readers use (D-149)."""

    updated = copy.deepcopy(params)
    updated["level_explicitly_selected"] = True
    next_chain = compute_chain_context(stored_chain_context({"session_parameters": params}), current, target)
    if next_chain:
        updated["chainContext"] = next_chain
    ontology = target == "genie-accelerator" and genie_ontology_default
    flags = {f"ai.{module}": True for module in _AI_MODULES}
    flags.update({f"medallion.{layer}": True for layer in _MEDALLION_LAYERS})
    flags["includeLakehouse"] = False
    flags["includeGenieOntology"] = ontology
    updated["flags"] = flags
    updated["include_lakehouse"] = False
    updated["include_genie_ontology"] = ontology
    updated["includeGenieOntology"] = ontology
    updated["direction"] = "reverse" if target.startswith("reverse-") else "forward"
    return updated
