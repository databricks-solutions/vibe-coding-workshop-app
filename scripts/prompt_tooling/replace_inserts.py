#!/usr/bin/env python3
"""
Surgical replacement of INSERT blocks in the seed SQL file.

Reads source SQL files (each containing a single INSERT statement),
matches them to existing blocks in the seed file by input_id,
and replaces the matched blocks in-place.

Usage:
    cd apps_lakebase/prompts
    python replace_inserts.py --i-know-this-overwrites-the-seed
"""

import argparse
import re
import sys
from pathlib import Path

from _seed_guard import add_flag, refused

SEED_FILE = "02_seed_section_input_prompts.sql"

SOURCE_FILES = [
    "01-scaffold-build-test.sql",
    "02-deploy.sql",
    "03-setup-lakebase.sql",
    "04-lakebase-wiring.sql",
    "05-e2e-test.sql",
]

INSERT_MARKER = "INSERT INTO ${catalog}.${schema}.section_input_prompts"
BLOCK_END_MARKER = "current_user());"
INPUT_ID_RE = re.compile(r"^\((\d+),\s*'([^']+)'")


def extract_input_id(lines: list[str]) -> tuple[int, str] | None:
    """Extract (input_id, section_tag) from lines containing a VALUES row."""
    for line in lines:
        m = INPUT_ID_RE.match(line.strip())
        if m:
            return int(m.group(1)), m.group(2)
    return None


def find_blocks(lines: list[str]) -> list[dict]:
    """
    Parse the seed file into INSERT blocks.

    Returns a list of dicts:
        { input_id, section_tag, start (0-based inclusive), end (0-based inclusive) }
    """
    blocks = []
    i = 0
    while i < len(lines):
        if INSERT_MARKER in lines[i]:
            insert_line = i

            # Walk backwards to capture preceding -- comment lines
            start = insert_line
            j = insert_line - 1
            while j >= 0 and lines[j].strip() == "":
                j -= 1
            while j >= 0 and lines[j].strip().startswith("--"):
                start = j
                j -= 1

            # Walk forward to find the closing current_user());
            end = insert_line
            while end < len(lines):
                if BLOCK_END_MARKER in lines[end]:
                    break
                end += 1

            # Extract input_id from the VALUES section
            result = extract_input_id(lines[insert_line:end + 1])
            if result:
                input_id, section_tag = result
                blocks.append({
                    "input_id": input_id,
                    "section_tag": section_tag,
                    "start": start,
                    "end": end,
                })

            i = end + 1
        else:
            i += 1

    return blocks


def read_source(path: Path) -> tuple[int, str, list[str]]:
    """Read a source SQL file. Returns (input_id, section_tag, lines)."""
    content = path.read_text()
    raw_lines = content.splitlines()

    # Strip trailing blank lines
    while raw_lines and raw_lines[-1].strip() == "":
        raw_lines.pop()

    result = extract_input_id(raw_lines)
    if not result:
        raise ValueError(f"Could not extract input_id from {path}")
    return result[0], result[1], raw_lines


def main():
    parser = argparse.ArgumentParser(
        description="Replace seed INSERT blocks with the NN-*.sql source files."
    )
    add_flag(parser)
    args = parser.parse_args()
    if refused(args.overwrite_seed):
        sys.exit(2)

    script_dir = Path(__file__).parent
    seed_path = script_dir / SEED_FILE

    if not seed_path.exists():
        print(f"ERROR: Seed file not found: {seed_path}")
        sys.exit(1)

    seed_lines = seed_path.read_text().splitlines()
    blocks = find_blocks(seed_lines)
    block_by_id = {b["input_id"]: b for b in blocks}

    print(f"Parsed {len(blocks)} INSERT blocks from seed file")
    print()

    replacements: list[tuple[int, int, list[str], str, str]] = []

    for src_name in SOURCE_FILES:
        src_path = script_dir / src_name
        if not src_path.exists():
            print(f"WARNING: Source file not found, skipping: {src_path}")
            continue

        src_id, src_tag, src_lines = read_source(src_path)

        if src_id not in block_by_id:
            print(f"WARNING: No block with input_id={src_id} in seed. Skipping {src_name}")
            continue

        block = block_by_id[src_id]
        old_tag = block["section_tag"]
        tag_change = f" (tag: {old_tag} -> {src_tag})" if old_tag != src_tag else ""

        print(
            f"  {src_name}: input_id={src_id}{tag_change}"
            f"  lines {block['start']+1}-{block['end']+1}"
            f" -> {len(src_lines)} new lines"
        )

        replacements.append((block["start"], block["end"], src_lines, src_name, old_tag))

    if not replacements:
        print("\nNo replacements to make.")
        return

    # Sort by start line descending so we replace from bottom to top
    replacements.sort(key=lambda r: r[0], reverse=True)

    print(f"\nApplying {len(replacements)} replacements (bottom-to-top)...")

    for start, end, new_lines, src_name, _old_tag in replacements:
        seed_lines[start:end + 1] = new_lines

    seed_path.write_text("\n".join(seed_lines) + "\n")

    print(f"\nSeed file updated: {seed_path}")
    print(f"  Old line count: {end + 1 + len(seed_lines) - len(new_lines)}")  # approximate
    print(f"  New line count: {len(seed_lines)}")


if __name__ == "__main__":
    main()
