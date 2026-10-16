#!/usr/bin/env python3
"""
Sync markdown section files back into the seed SQL file.

Reads each .md file in sections/, reconstructs a valid INSERT block,
and replaces the matching block (by input_id) in the seed SQL.

Usage:
    cd apps_lakebase/prompts
    python sync_markdown_to_seed.py              # apply changes
    python sync_markdown_to_seed.py --dry-run    # preview diff only
"""

import argparse
import difflib
import re
import sys
from pathlib import Path

from _seed_parser import SEED_FILE, read_seed, sql_escape

SECTIONS_DIR = "sections"


# ---------------------------------------------------------------------------
# Markdown parsing
# ---------------------------------------------------------------------------

def parse_markdown(path: Path) -> dict:
    """
    Parse a section markdown file into frontmatter dict + section bodies.

    Returns dict with keys matching SQL column names:
        input_id, section_tag, order_number, section_title, section_description,
        bypass_llm (optional), step_enabled (optional), version, is_active,
        system_prompt, input_template, how_to_apply, expected_output,
        sql_comments (list[str], optional)
    """
    text = path.read_text()

    # Split frontmatter
    if not text.startswith("---"):
        raise ValueError(f"{path}: missing YAML frontmatter")

    end_idx = text.index("---", 3)
    fm_text = text[3:end_idx].strip()
    body = text[end_idx + 3 :]

    fields = _parse_frontmatter(fm_text)
    fields.update(_parse_body_sections(body))
    return fields


def _parse_frontmatter(fm_text: str) -> dict:
    """Minimal YAML-ish parser for the frontmatter we produce."""
    result = {}
    lines = fm_text.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip() or line.strip().startswith("#"):
            i += 1
            continue

        if ":" not in line:
            i += 1
            continue

        key, _, value = line.partition(":")
        key = key.strip()
        value = value.strip()

        if key == "sql_comments":
            comments = []
            i += 1
            while i < len(lines) and lines[i].strip().startswith("- "):
                item = lines[i].strip()[2:]
                item = _yaml_unescape(item)
                comments.append(item)
                i += 1
            result["sql_comments"] = comments
            continue

        value = _yaml_unescape(value)

        if key in ("input_id", "order_number", "version"):
            result[key] = int(value)
        elif key in ("bypass_llm", "step_enabled", "is_active"):
            result[key] = value.lower() in ("true", "1", "yes")
        else:
            result[key] = value

        i += 1

    return result


def _yaml_unescape(value: str) -> str:
    """Remove YAML quoting."""
    if (value.startswith('"') and value.endswith('"')) or (
        value.startswith("'") and value.endswith("'")
    ):
        value = value[1:-1]
    value = value.replace('\\"', '"').replace("\\\\", "\\")
    return value


def _parse_body_sections(body: str) -> dict:
    """Extract the four known top-level sections from the markdown body."""
    known_headings = [
        "System Prompt", "Input Template", "How to Apply", "Expected Output",
        "User Trigger Prompt",
    ]
    section_map = {
        "System Prompt": "system_prompt",
        "Input Template": "input_template",
        "How to Apply": "how_to_apply",
        "Expected Output": "expected_output",
        "User Trigger Prompt": "user_trigger_prompt",
    }

    # Only match --- + ## for the four known section headers
    heading_alt = "|".join(re.escape(h) for h in known_headings)
    pattern = re.compile(
        r"^---\s*\n+## (" + heading_alt + r")\s*\n", re.MULTILINE
    )
    matches = list(pattern.finditer(body))

    result = {}
    for idx, match in enumerate(matches):
        heading = match.group(1).strip()
        col_name = section_map[heading]

        start = match.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(body)

        content = body[start:end].strip()
        result[col_name] = content

    return result


# ---------------------------------------------------------------------------
# SQL reconstruction
# ---------------------------------------------------------------------------

def _bool_sql(value: bool) -> str:
    return "true" if value else "false"


def _build_coding_assistant_block(fields: dict) -> list[str]:
    """
    Reconstruct the coding_assistant fork shape (e.g. coding_assistant='genie-code').

    These rows carry a `coding_assistant` column and omit the order/title/
    description/how_to/expected columns the standard rows use. The seed's exact
    layout is reproduced so the round-trip diff stays clean.
    """
    parts = []
    if fields.get("sql_comments"):
        parts.extend(fields["sql_comments"])
    else:
        parts.append(f"-- {fields['section_tag']}")

    parts.append("INSERT INTO ${catalog}.${schema}.section_input_prompts")
    parts.append("(input_id, section_tag, coding_assistant, input_template, system_prompt,")
    parts.append(" bypass_llm, version, is_active, inserted_at, updated_at, created_by)")
    parts.append("VALUES")
    parts.append(
        f"({fields['input_id']}, '{sql_escape(fields['section_tag'])}', "
        f"'{sql_escape(fields['coding_assistant'])}',"
    )
    parts.append(f"'{sql_escape(fields.get('input_template', ''))}',")
    parts.append(f"'{sql_escape(fields.get('system_prompt', ''))}',")
    parts.append(
        f"{_bool_sql(fields.get('bypass_llm', True))}, "
        f"{fields.get('version', 1)}, {_bool_sql(fields.get('is_active', True))}, "
        f"current_timestamp(), current_timestamp(), current_user());"
    )

    block_str = "\n".join(parts)
    return block_str.split("\n")


def build_insert_block(fields: dict) -> list[str]:
    """Reconstruct a SQL INSERT block from parsed markdown fields."""
    if "coding_assistant" in fields:
        return _build_coding_assistant_block(fields)

    has_bypass = "bypass_llm" in fields
    has_step_enabled = "step_enabled" in fields

    cols = [
        "input_id",
        "section_tag",
        "input_template",
        "system_prompt",
        "section_title",
        "section_description",
        "order_number",
        "how_to_apply",
        "expected_output",
        "user_trigger_prompt",
    ]
    if has_bypass and has_step_enabled:
        cols.extend(["bypass_llm", "step_enabled"])
    elif has_bypass:
        cols.append("bypass_llm")
    cols.extend(["version", "is_active", "inserted_at", "updated_at", "created_by"])

    # Trailing metadata values (everything after expected_output / bypass_llm / step_enabled)
    version = fields.get("version", 1)
    is_active = _bool_sql(fields.get("is_active", True))

    if has_bypass and has_step_enabled:
        tail = (
            f"{_bool_sql(fields['bypass_llm'])}, "
            f"{_bool_sql(fields['step_enabled'])}, "
            f"{version}, {is_active}, "
            f"current_timestamp(), current_timestamp(), current_user());"
        )
    elif has_bypass:
        tail = (
            f"{_bool_sql(fields['bypass_llm'])}, "
            f"{version}, {is_active}, "
            f"current_timestamp(), current_timestamp(), current_user());"
        )
    else:
        tail = (
            f"{version}, {is_active}, "
            f"current_timestamp(), current_timestamp(), current_user());"
        )

    # Build the block as a single string then split to lines for replacement
    parts = []

    # Comment line(s)
    if "sql_comments" in fields and fields["sql_comments"]:
        for c in fields["sql_comments"]:
            parts.append(c)
    else:
        parts.append(f"-- {fields['section_title']}")

    parts.append(f"INSERT INTO ${{catalog}}.${{schema}}.section_input_prompts ")
    parts.append(f"({', '.join(cols)})")
    parts.append("VALUES")
    parts.append(f"({fields['input_id']}, '{sql_escape(fields['section_tag'])}',")
    parts.append(f"'{sql_escape(fields.get('input_template', ''))}',")
    parts.append(f"'{sql_escape(fields.get('system_prompt', ''))}',")
    parts.append(f"'{sql_escape(fields['section_title'])}',")
    parts.append(f"'{sql_escape(fields['section_description'])}',")
    parts.append(f"{fields['order_number']},")
    parts.append(f"'{sql_escape(fields.get('how_to_apply', ''))}',")
    parts.append(f"'{sql_escape(fields.get('expected_output', ''))}',")
    parts.append(f"'{sql_escape(fields.get('user_trigger_prompt', ''))}',")
    parts.append(tail)

    # Join into a single string then split on actual newlines so the line
    # count accounts for embedded newlines in the text fields.
    block_str = "\n".join(parts)
    return block_str.split("\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Sync markdown section files back into the seed SQL."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print diff without modifying the seed file.",
    )
    args = parser.parse_args()

    script_dir = Path(__file__).parent
    seed_path = script_dir / SEED_FILE
    sections_dir = script_dir / SECTIONS_DIR

    if not sections_dir.exists():
        print(f"ERROR: Sections directory not found: {sections_dir}")
        sys.exit(1)

    seed_lines, blocks = read_seed(script_dir)
    block_by_id = {b["input_id"]: b for b in blocks}
    original_text = "\n".join(seed_lines) + "\n"

    print(f"Parsed {len(blocks)} INSERT blocks from {SEED_FILE}")

    md_files = sorted(
        p for p in sections_dir.glob("*.md") if p.name != "README.md"
    )
    print(f"Found {len(md_files)} markdown files in {sections_dir}/\n")

    md_by_id: dict[int, dict] = {}
    for md_path in md_files:
        try:
            fields = parse_markdown(md_path)
        except Exception as e:
            print(f"  WARNING: Could not parse {md_path.name}: {e}", file=sys.stderr)
            continue

        input_id = fields.get("input_id")
        if input_id is None:
            print(
                f"  WARNING: No input_id in {md_path.name}, skipping",
                file=sys.stderr,
            )
            continue

        md_by_id[input_id] = fields

    # Warn about mismatches
    seed_ids = set(block_by_id.keys())
    md_ids = set(md_by_id.keys())

    for missing in seed_ids - md_ids:
        b = block_by_id[missing]
        print(
            f"  WARNING: Seed block input_id={missing} ({b['section_tag']}) "
            f"has no markdown file",
            file=sys.stderr,
        )
    for extra in md_ids - seed_ids:
        print(
            f"  WARNING: Markdown input_id={extra} has no matching seed block",
            file=sys.stderr,
        )

    # Build replacements
    replacements: list[tuple[int, int, list[str], int]] = []

    for input_id in md_ids & seed_ids:
        fields = md_by_id[input_id]
        block = block_by_id[input_id]
        new_lines = build_insert_block(fields)

        replacements.append((block["start"], block["end"], new_lines, input_id))
        print(
            f"  input_id={input_id:>3} ({fields.get('section_tag', '?'):30s}) "
            f"lines {block['start']+1}-{block['end']+1} -> {len(new_lines)} new lines"
        )

    if not replacements:
        print("\nNo replacements to make.")
        return

    # Apply bottom-to-top
    replacements.sort(key=lambda r: r[0], reverse=True)

    new_seed_lines = list(seed_lines)
    for start, end, new_lines, _id in replacements:
        new_seed_lines[start : end + 1] = new_lines

    new_text = "\n".join(new_seed_lines) + "\n"

    if args.dry_run:
        diff = difflib.unified_diff(
            original_text.splitlines(keepends=True),
            new_text.splitlines(keepends=True),
            fromfile=f"a/{SEED_FILE}",
            tofile=f"b/{SEED_FILE}",
            n=3,
        )
        diff_str = "".join(diff)
        if diff_str:
            print(f"\n--- Diff preview ({len(replacements)} blocks) ---\n")
            print(diff_str)
        else:
            print("\nNo differences detected — seed file is already in sync.")
    else:
        seed_path.write_text(new_text)
        print(f"\nSeed file updated: {seed_path}")
        print(f"  {len(replacements)} blocks replaced")
        print(f"  Old line count: {len(seed_lines)}")
        print(f"  New line count: {len(new_seed_lines)}")


if __name__ == "__main__":
    main()
