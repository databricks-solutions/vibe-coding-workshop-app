"""Pure gate merge for the App (SPA) gate write path.

Moved verbatim out of ``src/backend/api/routes.py`` so the route handlers and
``lakebase.save_session_merging_gates`` (which applies it inside the locked
read-merge-write transaction) share ONE implementation.
"""

from typing import List, Optional


def _merge_app_gates(incoming: Optional[List[str]], existing: Optional[List[str]]) -> Optional[List[str]]:
    """Server-side gate MERGE for the SPA dual-write (T5 PR3a review fix).

    The App can only represent gates that map to a global ``ALL_STEPS`` number
    (the values of ``manifest.step_number_to_tag``). MCP-origin sessions carry
    gates the App CANNOT represent — notably the engine gate ``use_case_selection``
    (retired from numbered ALL_STEPS; distinct from step-1 ``usecase_selection``) —
    which several steps depend on via ``requiresGate``. A naive replace on the App
    write path would destroy those and re-lock the dependent steps.

    Resolution (generic, not string-specific): persist the UNION of the incoming
    App-derived gates and the EXISTING stored gates that are NOT App-representable.
    So App-representable gates are AUTHORITATIVE from the App — an un-completed
    numbered step correctly drops its representable tag — while non-representable
    stored gates are ADD-ONLY (the App never drops what it cannot represent).

    Returns None when ``incoming`` is None (preserve-on-absent: the caller leaves
    the persisted gates untouched). ``manifest.step_number_to_tag`` is read-only
    (the PR1 accessor); no engine/state/manifest behavior changes."""
    if incoming is None:
        return None
    from src.backend.workshop import manifest
    representable = set(manifest.step_number_to_tag().values())
    merged = list(incoming)
    for gate in existing or []:
        if gate not in representable and gate not in merged:
            merged.append(gate)
    return merged
