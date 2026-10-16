#!/usr/bin/env python3
"""
Shared utilities for parsing the seed SQL file into structured blocks.

Used by extract_to_markdown.py and sync_markdown_to_seed.py.
"""

import re
from pathlib import Path

SEED_FILE = "02_seed_section_input_prompts.sql"
INSERT_MARKER = "INSERT INTO ${catalog}.${schema}.section_input_prompts"
BLOCK_END_MARKER = "current_user());"
INPUT_ID_RE = re.compile(r"^\((\d+),\s*'([^']+)'")


def find_blocks(lines: list[str]) -> list[dict]:
    """
    Parse the seed file into INSERT blocks.

    Returns a list of dicts with keys:
        input_id, section_tag, start (0-based inclusive), end (0-based inclusive),
        comment_lines (preceding -- comment lines),
        columns (list of column names from the INSERT column list)
    """
    blocks = []
    i = 0
    while i < len(lines):
        if INSERT_MARKER in lines[i]:
            insert_line = i

            start = insert_line
            j = insert_line - 1
            while j >= 0 and lines[j].strip() == "":
                j -= 1
            while j >= 0 and lines[j].strip().startswith("--"):
                start = j
                j -= 1

            end = insert_line
            while end < len(lines):
                if BLOCK_END_MARKER in lines[end]:
                    break
                end += 1

            comment_lines = []
            for k in range(start, insert_line):
                stripped = lines[k].strip()
                if stripped.startswith("--"):
                    comment_lines.append(stripped)

            columns = _extract_columns(lines, insert_line, end)

            result = _extract_input_id(lines[insert_line : end + 1])
            if result:
                input_id, section_tag = result
                blocks.append(
                    {
                        "input_id": input_id,
                        "section_tag": section_tag,
                        "start": start,
                        "end": end,
                        "comment_lines": comment_lines,
                        "columns": columns,
                    }
                )

            i = end + 1
        else:
            i += 1

    return blocks


def _extract_input_id(lines: list[str]) -> tuple[int, str] | None:
    for line in lines:
        m = INPUT_ID_RE.match(line.strip())
        if m:
            return int(m.group(1)), m.group(2)
    return None


def _extract_columns(lines: list[str], insert_line: int, end: int) -> list[str]:
    """Extract column names from the INSERT INTO ... (...) line(s)."""
    combined = ""
    for k in range(insert_line, min(end + 1, insert_line + 5)):
        combined += lines[k]
        if ")" in combined and "VALUES" not in combined.split(")")[0]:
            break

    m = re.search(r"\(([^)]+)\)", combined)
    if m:
        return [c.strip() for c in m.group(1).split(",")]
    return []


def extract_sql_strings(block_text: str, columns: list[str]) -> dict[str, object]:
    """
    Parse a full INSERT block text and extract field values.

    Returns a dict mapping column names to their Python values.
    Text fields are unescaped (SQL '' -> Python ').
    Boolean fields become Python bools.
    Integer fields become Python ints.
    """
    values_idx = block_text.find("VALUES")
    if values_idx == -1:
        return {}

    after_values = block_text[values_idx + len("VALUES") :]
    after_values = after_values.strip()
    if after_values.startswith("\n"):
        after_values = after_values.lstrip("\n")

    text_columns = {
        "section_tag",
        "coding_assistant",
        "input_template",
        "system_prompt",
        "section_title",
        "section_description",
        "how_to_apply",
        "expected_output",
        "user_trigger_prompt",
    }
    bool_columns = {"bypass_llm", "step_enabled", "is_active"}
    int_columns = {"input_id", "order_number", "version"}
    auto_columns = {"inserted_at", "updated_at", "created_by"}

    result = {}
    pos = 0

    # Skip opening paren
    pos = after_values.find("(", pos)
    if pos == -1:
        return {}
    pos += 1

    for col in columns:
        # Skip whitespace and newlines
        while pos < len(after_values) and after_values[pos] in " \t\n\r":
            pos += 1

        if col in auto_columns:
            break

        if col in text_columns:
            val, pos = _read_sql_string(after_values, pos)
            result[col] = val
        elif col in bool_columns:
            val, pos = _read_sql_literal(after_values, pos)
            result[col] = val.strip().lower() in ("true", "1")
        elif col in int_columns:
            val, pos = _read_sql_literal(after_values, pos)
            result[col] = int(val.strip())
        else:
            val, pos = _read_sql_literal(after_values, pos)
            result[col] = val.strip()

        # Skip comma separator
        while pos < len(after_values) and after_values[pos] in " \t\n\r":
            pos += 1
        if pos < len(after_values) and after_values[pos] == ",":
            pos += 1

    return result


def _read_sql_string(text: str, pos: int) -> tuple[str, int]:
    """
    Read a SQL single-quoted string starting at pos, handling '' escapes.
    Returns (unescaped_value, new_pos_after_closing_quote).
    """
    while pos < len(text) and text[pos] in " \t\n\r":
        pos += 1

    if pos >= len(text) or text[pos] != "'":
        return "", pos

    pos += 1  # skip opening quote
    chars = []
    while pos < len(text):
        if text[pos] == "'" and pos + 1 < len(text) and text[pos + 1] == "'":
            chars.append("'")
            pos += 2
        elif text[pos] == "'":
            pos += 1  # skip closing quote
            break
        else:
            chars.append(text[pos])
            pos += 1

    return "".join(chars), pos


def _read_sql_literal(text: str, pos: int) -> tuple[str, int]:
    """Read a non-string SQL literal (number, boolean, function call) until comma or closing paren."""
    while pos < len(text) and text[pos] in " \t\n\r":
        pos += 1

    chars = []
    paren_depth = 0
    while pos < len(text):
        ch = text[pos]
        if ch == "(":
            paren_depth += 1
            chars.append(ch)
            pos += 1
        elif ch == ")":
            if paren_depth > 0:
                paren_depth -= 1
                chars.append(ch)
                pos += 1
            else:
                break
        elif ch == "," and paren_depth == 0:
            break
        else:
            chars.append(ch)
            pos += 1

    return "".join(chars), pos


def sql_escape(text: str) -> str:
    """Escape a Python string for SQL single-quoted embedding (' -> '')."""
    return text.replace("'", "''")


def read_seed(script_dir: Path | None = None) -> tuple[list[str], list[dict]]:
    """Read the seed file and return (lines, blocks)."""
    if script_dir is None:
        script_dir = Path(__file__).parent
    seed_path = script_dir / SEED_FILE
    seed_lines = seed_path.read_text().splitlines()
    blocks = find_blocks(seed_lines)
    return seed_lines, blocks
