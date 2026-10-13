"""Server-built inline visuals behind ``vibe_explain_step`` (D12 PR 2, spec §3.3-§3.7).

The server draws; the model explains (spec §3.1 inv. 2). Every visual is a
markdown table or a ```text box-drawing diagram built from the manifest and
the session state, and it passes ``lint_visual`` before it is returned.

Labels come only from manifest step titles and ``key_label(key)`` of output
key names (D-93). Captured output VALUES are read for truthiness only (the
unblock checklist's Present/Missing), so learner content never reaches
``visual`` or ``visual_caption`` (D7 §6 firewall).

Fail-open: any error, or a visual that fails the lint, returns None with one
WARNING naming only the section tag and the shape (spec §3.1 inv. 4).
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any, Callable

from ..workshop import engine
from ..workshop.visuals import DIAGRAM_CAPTION, lint_visual, twin_visual
from .coaching import _DISABLED_VALUES

logger = logging.getLogger(__name__)

VISUALS = ("auto", "none", "table", "diagram")

# Spec §3.4: (focus, visual) -> shape. "curated" falls back to "downstream".
SELECTION: dict[str | None, dict[str, str | None]] = {
    "what_now": {"auto": "progress", "table": "progress", "diagram": "curated"},
    "why": {"auto": "curated", "table": "progress", "diagram": "curated"},
    "unblock": {"auto": "unblock", "table": "unblock", "diagram": "curated"},
    "review": {"auto": "built", "table": "progress", "diagram": "built"},
    None: {"auto": None, "table": "progress", "diagram": "curated"},
}

ACRONYMS = frozenset({"prd", "ui", "api", "sql", "bi", "er", "uc", "kpi", "llm", "mcp", "id"})
# Whole words with a fixed mixed case (d-93a); same length as the key word.
CASED_WORDS = {"mlflow": "MLflow"}

PROGRESS_NEXT = 2
PROGRESS_DONE_ALL = 4
UNBLOCK_ROWS = 8
CHAIN_NODES = 5
CHAIN_NEXT = 4
BUILT_NODES = 6
MAX_LINE = 60


@dataclass(frozen=True)
class Visual:
    text: str
    kind: str
    caption: str


def visuals_enabled() -> bool:
    """Kill switch, read per call: VIBE_COACH_VISUALS_ENABLED=0/false/off/no disables."""

    return os.getenv("VIBE_COACH_VISUALS_ENABLED", "").strip().lower() not in _DISABLED_VALUES


def select_shape(focus: str | None, visual: str | None) -> str | None:
    """The §3.4 shape for this request, or None for no visual."""

    if visual is None:
        visual = "auto" if focus else "none"
    if visual == "none":
        return None
    return SELECTION[focus][visual]


def key_label(key: str) -> str:
    """``prd_document`` -> ``PRD document`` (D-93)."""

    words = []
    for word in key.split("_"):
        lower = word.lower()
        if lower in ACRONYMS:
            words.append(lower.upper())
        else:
            words.append(CASED_WORDS.get(lower, word))
    label = " ".join(words)
    return label[:1].upper() + label[1:]


# --- Rendering -----------------------------------------------------------------


def _table(header: list[str], rows: list[list[str]]) -> str:
    lines = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    lines += ["| " + " | ".join(row) + " |" for row in rows]
    return "\n".join(lines)


def _chain(lines: list[str]) -> str:
    body: list[str] = []
    for i, line in enumerate(lines):
        if i:
            body += ["│", "▼"]
        body.append(line)
    return "\n".join(["```text", *body, "```"])


# --- Shapes (spec §3.3) --------------------------------------------------------


@dataclass(frozen=True)
class _Request:
    step: Any
    state: Any
    track: str
    served_how_to_apply: str
    needs_use_case: bool
    beat_title: str


def _steps(request: _Request) -> list[tuple[Any, str]]:
    """The outline's steps, skipped ones left out, with their D-78 status."""

    statuses = engine.outline(request.track, request.state)
    steps = engine._ordered_steps(request.track, request.state)
    return [
        (step, status.status)
        for step, status in zip(steps, statuses)
        if status.status != "skipped"
    ]


def _progress(request: _Request) -> Visual | None:
    # The SESSION frontier (D-94), not the requested step.
    steps = _steps(request)
    done = [step for step, status in steps if status == "done"]
    unfinished = [step for step, status in steps if status != "done"]
    n = len(steps)
    if not unfinished and not request.needs_use_case:
        if not done:
            return None
        rows = [[step.title, "Done"] for step in done[-PROGRESS_DONE_ALL:]]
        return Visual(_table(["Step", "Status"], rows), "table", f"All {n} steps done.")
    if request.needs_use_case:
        now_title, later = request.beat_title, unfinished
    else:
        now_title, later = unfinished[0].title, unfinished[1:]
    rows = [[done[-1].title, "Done"]] if done else []
    rows.append([f"**{now_title}**", "**Now**"])
    rows += [[step.title, "Next"] for step in later[:PROGRESS_NEXT]]
    more = len(later) - PROGRESS_NEXT
    if more > 0:
        rows.append([f"{more} more steps", "Later"])
    caption = f"{len(done)} of {n} steps done. Now: {now_title}."
    return Visual(_table(["Step", "Status"], rows), "table", caption)


def _unblock(request: _Request) -> Visual | None:
    step, state = request.step, request.state
    completed = set(getattr(state, "completed_gates", None) or [])
    captured = getattr(state, "captured_outputs", None) or {}
    needs: list[tuple[list[str], bool]] = []
    gate = getattr(step, "requiresGate", None)
    if gate == engine.USE_CASE_GATE:
        met = gate in completed
        needs.append((["Use case", "Use case locked", "Done" if met else "Not done"], met))
    elif gate:
        titles = {s.sectionTag: s.title for s in engine.MANIFEST.track_steps(request.track)}
        met = gate in completed
        label = titles.get(gate) or key_label(gate)
        needs.append((["Previous step", label, "Done" if met else "Not done"], met))
    for key in getattr(step, "consumes", None) or []:
        # Presence only: the value is never read beyond its truthiness.
        met = bool(captured.get(key))
        needs.append((["Input", key_label(key), "Present" if met else "Missing"], met))
    total = len(needs)
    met_count = sum(1 for _, met in needs if met)
    rows = [row for row, _ in needs]
    if not rows:
        rows = [["None", "Nothing blocks this step", "Ready"]]
    elif len(rows) > UNBLOCK_ROWS:
        rows = rows[: UNBLOCK_ROWS - 1] + [["Input", f"{len(rows) - UNBLOCK_ROWS + 1} more inputs", "See step"]]
    caption = f"{met_count} of {total} needs met."
    return Visual(_table(["Kind", "Needs", "Status"], rows), "table", caption)


def _downstream(request: _Request) -> Visual | None:
    step = request.step
    steps = [s for s, _ in _steps(request)]
    tags = [s.sectionTag for s in steps]
    after = steps[tags.index(step.sectionTag) + 1:] if step.sectionTag in tags else steps
    keys = {step.produces} if getattr(step, "produces", None) else set()
    chain = [step]
    for later in after:
        if len(chain) >= CHAIN_NODES:
            break
        if keys & set(later.consumes):
            chain.append(later)
            if later.produces:
                keys.add(later.produces)
    if len(chain) == 1:
        chain += after[:CHAIN_NEXT]
    if len(chain) == 1:
        return None
    caption = f"{DIAGRAM_CAPTION} Steps that build on {step.title}."
    return Visual(_chain([s.title for s in chain]), "diagram", caption)


def _built(request: _Request) -> Visual | None:
    done = [step for step, status in _steps(request) if status == "done"][-BUILT_NODES:]
    if not done:
        return None
    lines = []
    for step in done:
        line = f"{step.title} ─▶ {key_label(step.produces)}" if step.produces else step.title
        lines.append(line if len(line) <= MAX_LINE else step.title)
    caption = f"{DIAGRAM_CAPTION} What you have built so far."
    return Visual(_chain(lines), "diagram", caption)


def _curated(request: _Request) -> Visual | None:
    # The step's how_to_apply twin, only if this call actually served it (D-95).
    title = request.step.title
    twin = twin_visual(f"{request.step.sectionTag}.how_to_apply.1")
    if twin is None or twin[0] not in (request.served_how_to_apply or ""):
        return _downstream(request)
    text, kind = twin
    if kind == "diagram":
        return Visual(text, kind, f"{DIAGRAM_CAPTION} How {title} fits together.")
    return Visual(text, kind, f"How {title} fits together.")


BUILDERS: dict[str, Callable[[_Request], Visual | None]] = {
    "progress": _progress,
    "unblock": _unblock,
    "downstream": _downstream,
    "built": _built,
    "curated": _curated,
}


def build_visual(
    *,
    step: Any,
    state: Any,
    track: str,
    focus: str | None,
    visual: str | None,
    served_how_to_apply: str,
    needs_use_case: bool = False,
    beat_title: str = "",
) -> Visual | None:
    """The §3.4 visual for this request, or None. Never raises."""

    if not visuals_enabled():
        return None
    section = str(getattr(step, "sectionTag", "") or "")
    shape = None
    try:
        shape = select_shape(focus, visual)
        if shape is None:
            return None
        request = _Request(step, state, track, served_how_to_apply, needs_use_case, beat_title)
        built = BUILDERS[shape](request)
        if built is None:
            return None
        if lint_visual(built.text, built.kind, built.caption):
            logger.warning("Coach visual failed lint section=%s shape=%s", section, shape)
            return None
        return built
    except Exception:  # noqa: BLE001 — a visual never fails the tool
        # No exc_info: a traceback could carry session values.
        logger.warning("Coach visual failed section=%s shape=%s", section, shape)
        return None
