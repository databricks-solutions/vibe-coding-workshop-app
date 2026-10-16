#!/usr/bin/env python3
"""
Guard for the scripts that overwrite a seed SQL file.

The app repo's seed (db/lakebase/dml_seed/02_seed_section_input_prompts.sql) is
the only source of truth for the prompt bodies. Seed edits go through builders
and reviewed PRs, so replace_inserts.py, splice_genie_to_app_seed.py and
sync_markdown_to_seed.py refuse a real write unless given FLAG. A --dry-run
writes nothing and is never refused.
"""

import sys

FLAG = "--i-know-this-overwrites-the-seed"
REFUSAL = (
    "Seed edits go through builders (e.g. scripts/insights_prompts/build_rows.py) "
    f"and reviewed PRs. Re-run with {FLAG} to bypass."
)


def add_flag(parser) -> None:
    parser.add_argument(
        FLAG,
        dest="overwrite_seed",
        action="store_true",
        help="Allow this script to overwrite the seed file.",
    )


def refused(overwrite_seed: bool) -> bool:
    """True (after printing REFUSAL) when a real seed write lacks FLAG."""
    if overwrite_seed:
        return False
    print(REFUSAL, file=sys.stderr)
    return True
