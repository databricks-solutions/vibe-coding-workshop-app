#!/usr/bin/env python3
"""
Extract individual INSERT blocks from the seed SQL into standalone .sql files.

Each standalone file contains a single INSERT block (comment + INSERT statement)
matching the format used by replace_inserts.py.

Usage:
    cd apps_lakebase/prompts
    python extract_sql_blocks.py
"""

import sys
from pathlib import Path

from _seed_parser import read_seed

TARGETS: dict[int, str] = {
    3: "01-scaffold-build-test.sql",
    110: "02-deploy.sql",
    16: "03-setup-lakebase.sql",
    108: "04-lakebase-wiring.sql",
    4: "05-e2e-test.sql",
}


def main():
    script_dir = Path(__file__).parent
    seed_lines, blocks = read_seed(script_dir)
    block_by_id = {b["input_id"]: b for b in blocks}

    print(f"Parsed {len(blocks)} INSERT blocks from seed file\n")

    for input_id, filename in TARGETS.items():
        if input_id not in block_by_id:
            print(f"  WARNING: No block with input_id={input_id} in seed", file=sys.stderr)
            continue

        block = block_by_id[input_id]
        block_lines = seed_lines[block["start"] : block["end"] + 1]

        # Strip trailing blank lines
        while block_lines and block_lines[-1].strip() == "":
            block_lines.pop()

        out_path = script_dir / filename
        out_path.write_text("\n".join(block_lines) + "\n")

        print(
            f"  {filename}: input_id={input_id} ({block['section_tag']}) "
            f"  {len(block_lines)} lines"
        )

    print(f"\nExtracted {len(TARGETS)} standalone .sql files")


if __name__ == "__main__":
    main()
