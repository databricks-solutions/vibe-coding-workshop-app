"""Inline visuals for the MCP surface (D12, spec §3.2 and §3.5).

Genie Code chat does not render Mermaid (F1): a ```mermaid fence shows as code
with a Run button that fails. On the MCP path the assembler swaps each Mermaid
fence in ``how_to_apply`` / ``expected_output`` for a hand-converted twin in
``mcp_visuals/`` (D-84, D-86), and a post-substitution net (D-87) drops any
fence that arrives later. The web path never calls this module, so the web UI
keeps rendering Mermaid.

``lint_visual`` enforces the §3.2 format rules; PR 2's coach visuals import it
from here (D-85). Everything that serves MCP is fail-open: a load error or a
hash mismatch degrades a fence to ``FALLBACK_LINE``, never raises, and the
WARNING names only the section tag, field and fence position, never content.
"""
import hashlib
import json
import logging
import re
from functools import lru_cache
from pathlib import Path
from typing import Iterator, List, Optional, Tuple

logger = logging.getLogger(__name__)

TWIN_DIR = Path(__file__).resolve().parent / "mcp_visuals"
INDEX_PATH = TWIN_DIR / "index.json"

FALLBACK_LINE = "(This step has a diagram in the workshop web UI.)"
DIAGRAM_CAPTION = "Diagram only, nothing to run."  # D-84: diagram twins only

MAX_WIDTH = 60
MAX_HEIGHT = 20
MAX_TABLE_ROWS = 8
MAX_TABLE_COLUMNS = 3
MAX_CELL = 40
BOX_GLYPHS = frozenset("│─┌┐└┘├┤┬┴┼▼▲◀▶")

_PLACEHOLDER_RE = re.compile(r"\{[^{}]*\}")
_SEPARATOR_CELL_RE = re.compile(r"^:?-{3,}:?$")


# --- Lint (spec §3.2) ----------------------------------------------------------


def _bad_chars(line: str) -> List[str]:
    return sorted(
        {ch for ch in line if not (" " <= ch <= "~" and ch != "`") and ch not in BOX_GLYPHS}
    )


def _lint_diagram(text: str) -> List[str]:
    errors: List[str] = []
    lines = text.split("\n")
    if lines and lines[-1] == "":
        lines = lines[:-1]
    if len(lines) < 2 or lines[0] != "```text":
        return ["diagram must open with ```text"]
    if lines[-1] != "```":
        return ["diagram must close with ```"]
    body = lines[1:-1]
    if len(body) > MAX_HEIGHT:
        errors.append(f"{len(body)} lines inside the fence (max {MAX_HEIGHT})")
    for i, line in enumerate(body, 1):
        if line.startswith("```"):
            errors.append(f"line {i}: fence inside the diagram")
        if line[:1].isspace():
            errors.append(f"line {i}: starts with whitespace")
        if len(line) > MAX_WIDTH:
            errors.append(f"line {i}: {len(line)} characters (max {MAX_WIDTH})")
        if "\t" in line:
            errors.append(f"line {i}: tab")
        if line != line.rstrip():
            errors.append(f"line {i}: trailing whitespace")
        if "--" in line or "->" in line:
            errors.append(f"line {i}: ASCII arrow or --")
        if _PLACEHOLDER_RE.search(line):
            errors.append(f"line {i}: template placeholder")
        bad = _bad_chars(line)
        if bad:
            errors.append(f"line {i}: characters not allowed: {''.join(bad)!r}")
    return errors


def _table_cells(line: str) -> List[str]:
    inner = line.strip()
    inner = inner[1:] if inner.startswith("|") else inner
    inner = inner[:-1] if inner.endswith("|") else inner
    return [cell.strip() for cell in inner.split("|")]


def _lint_table(text: str) -> List[str]:
    errors: List[str] = []
    lines = text.strip("\n").split("\n")
    if len(lines) < 2:
        return ["table needs a header row and a separator row"]
    rows = [_table_cells(line) for line in lines]
    if not all(line.startswith("|") and line.endswith("|") for line in lines):
        errors.append("every table line must start and end with |")
    if not all(_SEPARATOR_CELL_RE.match(cell) for cell in rows[1]):
        errors.append("second line must be the header separator")
    columns = len(rows[0])
    if columns > MAX_TABLE_COLUMNS:
        errors.append(f"{columns} columns (max {MAX_TABLE_COLUMNS})")
    data = rows[2:]
    if len(data) > MAX_TABLE_ROWS:
        errors.append(f"{len(data)} data rows (max {MAX_TABLE_ROWS})")
    for i, row in enumerate([rows[0], *data]):
        if len(row) != columns:
            errors.append(f"row {i}: {len(row)} cells, header has {columns}")
        for cell in row:
            if len(cell) > MAX_CELL:
                errors.append(f"row {i}: cell of {len(cell)} characters (max {MAX_CELL})")
            if "```" in cell:
                errors.append(f"row {i}: fence inside a cell")
            if _PLACEHOLDER_RE.search(cell):
                errors.append(f"row {i}: template placeholder")
    for i, line in enumerate(lines, 1):
        if "\t" in line or line != line.rstrip():
            errors.append(f"line {i}: tab or trailing whitespace")
    return errors


def lint_visual(text: str, kind: str, caption: Optional[str]) -> List[str]:
    """Every spec §3.2 violation in ``text``; an empty list means it passes."""

    if kind == "diagram":
        errors = _lint_diagram(text)
        if not caption or not caption.startswith(DIAGRAM_CAPTION):
            errors.append(f"diagram caption must start with {DIAGRAM_CAPTION!r}")
    elif kind == "table":
        errors = _lint_table(text)
        if not caption or not caption.strip():
            errors.append("caption is required")
    else:
        return [f"unknown visual kind {kind!r}"]
    return errors


# --- Mermaid fences and their hash (D-86) --------------------------------------


def iter_mermaid_fences(text: str) -> Iterator[Tuple[int, Optional[int], str]]:
    """Yield ``(open_index, close_index, body)`` per ```mermaid fence, in order.

    Indices are into ``text.split("\\n")``. A line whose ``strip()`` is
    "```mermaid" opens; the next line whose ``strip()`` starts with "```"
    closes. An unclosed fence yields ``close_index=None`` and runs to the end.
    """

    lines = text.split("\n")
    i = 0
    while i < len(lines):
        if lines[i].strip() == "```mermaid":
            close = next(
                (j for j in range(i + 1, len(lines)) if lines[j].strip().startswith("```")),
                None,
            )
            end = close if close is not None else len(lines)
            yield i, close, "\n".join(lines[i + 1:end])
            i = end + 1
        else:
            i += 1


def mermaid_hash(body: str) -> str:
    """sha256 (UTF-8 hex) of a fence body: CRLF to LF, each line rstripped."""

    lines = body.replace("\r\n", "\n").split("\n")
    return hashlib.sha256("\n".join(line.rstrip() for line in lines).encode("utf-8")).hexdigest()


# --- Twins (spec §3.5) ---------------------------------------------------------


@lru_cache(maxsize=1)
def load_twins() -> Optional[dict]:
    """``{name: (sha256, kind, text)}`` from ``index.json``.

    Only a missing or unparseable index is global (None: every fence falls
    back). A twin file that is missing, unreadable or fails ``lint_visual``
    drops just its own entry, so only its fence falls back (spec §3.5, D-89).
    """

    try:
        index = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
        if not isinstance(index, dict):
            raise ValueError("index.json is not an object")
    except Exception:
        logger.warning("MCP visual twin index failed to load; every Mermaid fence falls back")
        return None
    twins = {}
    for name, entry in index.items():
        try:
            kind = entry["kind"]
            suffix = {"diagram": ".txt", "table": ".md"}[kind]
            text = (TWIN_DIR / f"{name}{suffix}").read_text(encoding="utf-8").rstrip("\n")
            # Tables carry no caption when served; lint the body with a stand-in.
            caption = DIAGRAM_CAPTION if kind == "diagram" else "twin"
            if lint_visual(text, kind, caption):
                raise ValueError("twin fails lint_visual")
            twins[name] = (entry["sha256"], kind, text)
        except Exception:
            logger.warning("MCP visual twin %s dropped (missing, unreadable or failing lint); its fence falls back", name)
    return twins


def _twin_text(kind: str, text: str) -> str:
    return f"{text}\n\n{DIAGRAM_CAPTION}" if kind == "diagram" else text


def swap_mermaid_for_mcp(text: str, section_tag: str, field: str) -> str:
    """Replace each Mermaid fence with its twin, or with ``FALLBACK_LINE``.

    Runs on the RAW template (before placeholder substitution), so the hash
    is taken over the seed text. Text without a fence is returned unchanged.
    """

    if "```mermaid" not in text:
        return text
    twins = load_twins() or {}
    lines = text.split("\n")
    out: List[str] = []
    cursor = 0
    for n, (start, close, body) in enumerate(iter_mermaid_fences(text), 1):
        out.extend(lines[cursor:start])
        twin = twins.get(f"{section_tag}.{field}.{n}")
        if close is not None and twin is not None and twin[0] == mermaid_hash(body):
            out.append(_twin_text(twin[1], twin[2]))
        else:
            logger.warning(
                "MCP visual fallback: no matching twin for section_tag=%s field=%s n=%d",
                section_tag,
                field,
                n,
            )
            out.append(FALLBACK_LINE)
        cursor = close + 1 if close is not None else len(lines)
    out.extend(lines[cursor:])
    return "\n".join(out)


def strip_residual_mermaid(text: str, section_tag: str, field: str) -> str:
    """D-87 post-substitution net (MCP only): any Mermaid fence left -> fallback."""

    if "```mermaid" not in text:
        return text
    lines = text.split("\n")
    out: List[str] = []
    cursor = 0
    for start, close, _ in iter_mermaid_fences(text):
        out.extend(lines[cursor:start])
        out.append(FALLBACK_LINE)
        cursor = close + 1 if close is not None else len(lines)
    out.extend(lines[cursor:])
    logger.warning(
        "MCP visual fallback: residual Mermaid after substitution for section_tag=%s field=%s",
        section_tag,
        field,
    )
    # A marker that is not on a line of its own opens no fence; drop it too.
    return "\n".join(out).replace("```mermaid", FALLBACK_LINE)
