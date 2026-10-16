#!/usr/bin/env python3
"""
Generate standalone .md files from the seed SQL for the 5 workshop steps.

Each .md file presents the prompt fields in a human-readable format with
section headers matching the existing convention (System Prompt, Input Template,
How to Use, Expected Output).

Usage:
    cd apps_lakebase/prompts
    python generate_standalone_md.py
"""

import sys
from pathlib import Path

from _seed_parser import extract_sql_strings, read_seed

TARGETS: dict[int, str] = {
    3: "01-scaffold-build-test.md",
    110: "02-deploy.md",
    16: "03-setup-lakebase.md",
    108: "04-lakebase-wiring.md",
    4: "05-e2e-test.md",
}

# RULE_0 (00-overview / 03-prompt-section-chain): the ONLY thing that differs
# between coding clients is the opening navigation line; the body is byte-identical.
# The active client is a property of the SESSION — `skills/vibecoding-state` detects
# it and writes `client_context` to the state file. At render time we pass that value
# here. Default is "agnostic" (build-time, no session) so generated files stay neutral.
_PREAMBLE = {
    "ide_cli": "> **Open this bundle in your IDE** (Cursor / VS Code / Claude Code), then paste the prompt into a new Agent chat.",
    "genie_code": (
        "> **Genie Code — first-run setup (do this once per session, before anything else):** "
        "(1) clone this whole repo into your per-user skills folder so Genie Code recurses and "
        "auto-discovers every skill — "
        "`git clone https://github.com/databricks-solutions/vibe-coding-workshop-template.git "
        "/Users/<your-username>/.assistant/skills/vibe-coding-workshop`; then "
        "(2) load the `skills/genie-code-environment` manifest so the agent knows how it behaves on "
        "Genie Code (pre-auth, serverless, page-context CLI via `runDatabricksCli`, file placement). "
        "Then open this bundle's project in Genie Code and paste the prompt into a new Agent chat."
    ),
    "agnostic": "> **Open this bundle in your coding assistant**, then paste the prompt into a new Agent chat.",
}


def preamble_line(client_context: str = "agnostic") -> str:
    """Return the RULE_0 client-specific opening line (body stays identical)."""
    return _PREAMBLE.get(client_context, _PREAMBLE["agnostic"])


def build_standalone_md(fields: dict, client_context: str = "agnostic") -> str:
    """Build a standalone .md file from extracted SQL fields.

    `client_context` selects ONLY the opening navigation line (RULE_0); the rest of
    the body is identical across clients.
    """
    parts = []

    title = fields.get("section_title", "Untitled")
    bypass_llm = fields.get("bypass_llm", False)

    # Title + RULE_0 client-specific opening line (body below is byte-identical)
    parts.append(f"# {title}\n")
    parts.append(f"{preamble_line(client_context)}\n")
    parts.append("---\n")

    # System Prompt
    parts.append("## System Prompt\n")
    parts.append("*Instructions for the AI model*\n")
    system_prompt = fields.get("system_prompt", "")
    if system_prompt:
        parts.append(f"{system_prompt}\n")

    parts.append("---\n")

    # Input Template
    parts.append("## Input Template\n")
    if bypass_llm:
        parts.append("*Pass as-is to output (skip LLM)*\n")
        parts.append(
            "*LLM bypass enabled — This template will be returned directly "
            "to the user without AI processing*\n"
        )

    input_template = fields.get("input_template", "")
    if input_template:
        parts.append(f"{input_template}\n")

    parts.append("---\n")

    # How to Use
    parts.append("## How to Use\n")
    how_to_apply = fields.get("how_to_apply", "")
    if how_to_apply:
        parts.append(f"{how_to_apply}\n")

    parts.append("---\n")

    # Expected Output
    parts.append("## Expected Output\n")
    expected_output = fields.get("expected_output", "")
    if expected_output:
        parts.append(f"{expected_output}\n")

    return "\n".join(parts)


def main():
    import argparse

    ap = argparse.ArgumentParser(description="Generate standalone workshop .md files from the seed.")
    ap.add_argument(
        "--client-context",
        choices=sorted(_PREAMBLE),
        default="agnostic",
        help="RULE_0 opening-line variant (default: agnostic). Body is identical across clients.",
    )
    args = ap.parse_args()

    script_dir = Path(__file__).parent
    seed_lines, blocks = read_seed(script_dir)
    block_by_id = {b["input_id"]: b for b in blocks}

    print(f"Parsed {len(blocks)} INSERT blocks from seed file\n")

    for input_id, filename in TARGETS.items():
        if input_id not in block_by_id:
            print(f"  WARNING: No block with input_id={input_id} in seed", file=sys.stderr)
            continue

        block = block_by_id[input_id]
        block_text = "\n".join(seed_lines[block["start"] : block["end"] + 1])
        fields = extract_sql_strings(block_text, block["columns"])

        if not fields:
            print(
                f"  WARNING: Could not parse fields for input_id={input_id}",
                file=sys.stderr,
            )
            continue

        md_content = build_standalone_md(fields, args.client_context)
        out_path = script_dir / filename
        out_path.write_text(md_content)

        print(
            f"  {filename}: input_id={input_id} ({block['section_tag']}) "
            f"  {title}"
        ) if False else print(
            f"  {filename}: input_id={input_id} ({fields.get('section_title', '')})"
        )

    print(f"\nGenerated {len(TARGETS)} standalone .md files")


if __name__ == "__main__":
    main()
