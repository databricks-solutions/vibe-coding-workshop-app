#!/usr/bin/env python3
"""
Extract all INSERT blocks from the seed SQL into individual markdown files.

Each prompt becomes a markdown file in sections/ with YAML frontmatter
(metadata) and named sections (reviewable text content).

Usage:
    cd apps_lakebase/prompts
    python extract_to_markdown.py
    python extract_to_markdown.py --seed path/to/seed.sql --out path/to/sections

The seed defaults to 02_seed_section_input_prompts.sql next to this script; when
there is none, the app repo's seed (../../db/lakebase/dml_seed/, read only).
"""

import argparse
import sys
from pathlib import Path

from _seed_parser import SEED_FILE, extract_sql_strings, find_blocks

SECTIONS_DIR = "sections"
APP_SEED = Path("..", "..", "db", "lakebase", "dml_seed", SEED_FILE)


def _yaml_str(value: str) -> str:
    """Format a string for YAML frontmatter, quoting if needed."""
    if any(c in value for c in ":#{}[]&*?|>!%@`,\"'\\") or value.startswith("-"):
        escaped = value.replace("\\", "\\\\").replace('"', '\\"')
        return f'"{escaped}"'
    return value


def build_markdown(fields: dict, columns: list[str], comment_lines: list[str]) -> str:
    """Build a markdown file from extracted SQL fields."""
    parts = []

    # --- YAML frontmatter ---
    fm_lines = ["---"]
    fm_lines.append(f"input_id: {fields['input_id']}")
    fm_lines.append(f"section_tag: {fields['section_tag']}")
    # coding_assistant fork rows (e.g. 'genie-code') carry this column and omit
    # the order/title/description columns the standard rows use.
    if "coding_assistant" in fields:
        fm_lines.append(f"coding_assistant: {_yaml_str(fields['coding_assistant'])}")
    if "order_number" in fields:
        fm_lines.append(f"order_number: {fields['order_number']}")
    if "section_title" in fields:
        fm_lines.append(f"section_title: {_yaml_str(fields['section_title'])}")
    if "section_description" in fields:
        fm_lines.append(
            f"section_description: {_yaml_str(fields['section_description'])}"
        )

    if "bypass_llm" in fields:
        fm_lines.append(f"bypass_llm: {'true' if fields['bypass_llm'] else 'false'}")
    if "step_enabled" in fields:
        fm_lines.append(
            f"step_enabled: {'true' if fields['step_enabled'] else 'false'}"
        )

    fm_lines.append(f"version: {fields.get('version', 1)}")
    fm_lines.append(f"is_active: {'true' if fields.get('is_active', True) else 'false'}")

    if comment_lines:
        fm_lines.append("sql_comments:")
        for cl in comment_lines:
            fm_lines.append(f"  - {_yaml_str(cl)}")

    fm_lines.append("---")
    parts.append("\n".join(fm_lines))

    # --- H1 title ---
    h1 = fields.get("section_title") or fields.get("section_tag", "")
    parts.append(f"\n\n# {h1}\n")

    # --- System Prompt ---
    system_prompt = fields.get("system_prompt", "")
    parts.append("---\n\n## System Prompt\n")
    if system_prompt:
        parts.append(f"{system_prompt}\n")

    # --- Input Template ---
    input_template = fields.get("input_template", "")
    parts.append("---\n\n## Input Template\n")
    if input_template:
        parts.append(f"{input_template}\n")

    # --- How to Apply ---
    how_to_apply = fields.get("how_to_apply", "")
    parts.append("---\n\n## How to Apply\n")
    if how_to_apply:
        parts.append(f"{how_to_apply}\n")

    # --- Expected Output ---
    expected_output = fields.get("expected_output", "")
    parts.append("---\n\n## Expected Output\n")
    if expected_output:
        parts.append(f"{expected_output}\n")

    return "\n".join(parts)


def _default_seed(script_dir: Path) -> Path:
    local = script_dir / SEED_FILE
    return local if local.is_file() else script_dir / APP_SEED


def main():
    parser = argparse.ArgumentParser(
        description="Extract the seed's INSERT blocks into section markdown files."
    )
    parser.add_argument(
        "--seed",
        type=Path,
        help=f"Seed SQL to read (default: {SEED_FILE} next to this script, else {APP_SEED}).",
    )
    parser.add_argument(
        "--out",
        type=Path,
        help=f"Directory for the section files (default: {SECTIONS_DIR}/ next to this script).",
    )
    args = parser.parse_args()

    script_dir = Path(__file__).parent
    seed_path = args.seed or _default_seed(script_dir)
    if seed_path != script_dir / SEED_FILE:
        print(f"Seed: {seed_path}")
    seed_lines = seed_path.read_text().splitlines()
    blocks = find_blocks(seed_lines)

    sections_dir = args.out or script_dir / SECTIONS_DIR
    sections_dir.mkdir(parents=True, exist_ok=True)

    print(f"Parsed {len(blocks)} INSERT blocks from {SEED_FILE}")
    print(f"Output directory: {sections_dir}\n")

    manifest = []
    errors = []

    for block in blocks:
        block_text = "\n".join(
            seed_lines[block["start"] : block["end"] + 1]
        )
        fields = extract_sql_strings(block_text, block["columns"])

        if not fields:
            errors.append(
                f"  WARNING: Could not parse fields for input_id={block['input_id']} "
                f"({block['section_tag']})"
            )
            continue

        order = fields.get("order_number", 99)
        tag = fields.get("section_tag", block["section_tag"])
        # Disambiguate coding_assistant fork rows (same tag as a default row but a
        # distinct coding_assistant column) so they get their own section file.
        assistant = fields.get("coding_assistant")
        if assistant:
            filename = f"{order:02d}-{tag}.{assistant}.md"
        else:
            filename = f"{order:02d}-{tag}.md"

        md_content = build_markdown(
            fields, block["columns"], block["comment_lines"]
        )

        out_path = sections_dir / filename
        out_path.write_text(md_content)

        manifest.append(
            {
                "filename": filename,
                "input_id": fields["input_id"],
                "section_tag": tag,
                "section_title": fields.get("section_title", ""),
                "order_number": order,
            }
        )
        print(f"  {filename}  (input_id={fields['input_id']})")

    if errors:
        print()
        for e in errors:
            print(e, file=sys.stderr)

    # Write README manifest
    manifest.sort(key=lambda m: (m["order_number"], m["input_id"]))
    readme_lines = [
        "# Extracted Section Prompts",
        "",
        "Auto-generated by `extract_to_markdown.py`. Do not edit this file manually.",
        "",
        "| File | ID | Tag | Title | Order |",
        "|------|----|-----|-------|-------|",
    ]
    for m in manifest:
        readme_lines.append(
            f"| [{m['filename']}]({m['filename']}) "
            f"| {m['input_id']} "
            f"| `{m['section_tag']}` "
            f"| {m['section_title']} "
            f"| {m['order_number']} |"
        )
    (sections_dir / "README.md").write_text("\n".join(readme_lines) + "\n")

    print(f"\nExtracted {len(manifest)} prompts to {sections_dir}/")
    print(f"Manifest written to {sections_dir}/README.md")

    if errors:
        print(f"\n{len(errors)} warning(s) — see above.", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
