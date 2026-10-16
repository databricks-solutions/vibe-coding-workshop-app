#!/usr/bin/env python3
"""
Splice the Genie Accelerator rows from the master section markdown into the app
repo's generated seed, **by input_id**, without touching any other rows.

Why this exists
---------------
`sync_markdown_to_seed.py` regenerates the *master* seed
(`apps_lakebase/prompts/02_seed_section_input_prompts.sql`) from `sections/*.md`.
The **app repo** ships its own generated artifact
(`db/lakebase/dml_seed/02_seed_section_input_prompts.sql`) that has drifted from
master (app-only rows, a different subset of sections). A wholesale copy is unsafe
— it would drop app-only rows (e.g. 949 `semlayer_metric_view_importbi`) and pull
in ~100 unrelated non-genie diffs.

So we surgically replace, in the app seed, only the blocks whose `input_id` belongs
to the Genie Accelerator family (`semlayer_* / gagent_* / ontology_* / gaccel_*`)
**and** has a matching master markdown file. Every other block — including app-only
genie rows with no master source — is left byte-for-byte untouched.

The replacement text is produced by the same `build_insert_block()` generator that
`sync_markdown_to_seed.py` uses, so master and app carry identical genie blocks.

Usage
-----
    cd apps_lakebase/prompts
    python splice_genie_to_app_seed.py --dry-run    # preview diff
    python splice_genie_to_app_seed.py --i-know-this-overwrites-the-seed  # apply
    python splice_genie_to_app_seed.py --dry-run --app-seed-dir /path/to/dml_seed
"""

import argparse
import difflib
import sys
from pathlib import Path

from _seed_guard import add_flag, refused
from _seed_parser import SEED_FILE, find_blocks, read_seed
from sync_markdown_to_seed import SECTIONS_DIR, build_insert_block, parse_markdown

GENIE_PREFIXES = ("semlayer_", "gagent_", "ontology_", "gaccel_")
# Activation app-track forks (activation_build_wire / _wire_lakebase / _wire_genie /
# _deploy_validate, etc.) are NOT genie-accelerator family, but they are likewise
# generated from sections/*.md and must be spliced master->app the same way. App-only
# rows with no master markdown are still preserved (they simply never match here).
SPLICEABLE_PREFIXES = GENIE_PREFIXES + ("activation_",)

# Exact section_tags that are Genie-Accelerator-only but do NOT carry a spliceable
# prefix. `use_case_selection` (Phase 2B / D11) is the certified-first use-case
# picker that runs before the PRD; it is generated from
# sections/02-use_case_selection.md and must stay master->app in sync like the
# prefixed genie rows.
#
# The remaining genie-accelerator steps that carry no spliceable prefix
# (prd_generation, genie_silver_metadata, gold_layer_design, gold_layer_pipeline,
# deploy_lakehouse_assets, iterate_enhance, redeploy_test, workspace_cleanup) are
# likewise generated from sections/*.md and must stay master->app in sync so the
# authored `user_trigger_prompt` (suggestion c) reaches the app seed. They are
# base (__default__) rows shared across tracks; the splice regenerates them from
# the same markdown they were originally generated from, so the diff stays
# confined to the added field (verified via --dry-run before applying).
SPLICEABLE_EXACT = (
    "use_case_selection",
    "prd_generation",
    "genie_silver_metadata",
    "gold_layer_design",
    "gold_layer_pipeline",
    "deploy_lakehouse_assets",
    "iterate_enhance",
    "redeploy_test",
    "workspace_cleanup",
)


def _is_genie(section_tag: str) -> bool:
    return section_tag.startswith(SPLICEABLE_PREFIXES) or section_tag in SPLICEABLE_EXACT


def _default_app_seed_dir(script_dir: Path) -> Path:
    # script_dir = <root>/vibe-coding-workshop-template/apps_lakebase/prompts
    # app seed   = <root>/vibe-coding-workshop-app/vibe-coding-workshop-app/db/lakebase/dml_seed
    root = script_dir.parents[2]
    return (
        root
        / "vibe-coding-workshop-app"
        / "vibe-coding-workshop-app"
        / "db"
        / "lakebase"
        / "dml_seed"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Preview diff only.")
    parser.add_argument(
        "--app-seed-dir",
        type=Path,
        default=None,
        help="Directory containing the app repo's 02_seed_section_input_prompts.sql",
    )
    add_flag(parser)
    args = parser.parse_args()
    if not args.dry_run and refused(args.overwrite_seed):
        return 2

    script_dir = Path(__file__).parent
    sections_dir = script_dir / SECTIONS_DIR
    app_seed_dir = args.app_seed_dir or _default_app_seed_dir(script_dir)
    app_seed_path = app_seed_dir / SEED_FILE

    if not sections_dir.exists():
        print(f"ERROR: sections dir not found: {sections_dir}", file=sys.stderr)
        return 1
    if not app_seed_path.exists():
        print(f"ERROR: app seed not found: {app_seed_path}", file=sys.stderr)
        return 1

    # 1. Parse genie markdown -> fields by input_id
    md_by_id: dict[int, dict] = {}
    for md_path in sorted(sections_dir.glob("*.md")):
        if md_path.name == "README.md":
            continue
        try:
            fields = parse_markdown(md_path)
        except Exception as e:  # noqa: BLE001
            print(f"  WARNING: could not parse {md_path.name}: {e}", file=sys.stderr)
            continue
        tag = fields.get("section_tag", "")
        iid = fields.get("input_id")
        if iid is None or not _is_genie(tag):
            continue
        md_by_id[iid] = fields

    # 2. Read app seed blocks
    app_lines = app_seed_path.read_text().splitlines()
    app_blocks = find_blocks(app_lines)
    app_genie_by_id = {
        b["input_id"]: b for b in app_blocks if _is_genie(b["section_tag"])
    }

    md_ids = set(md_by_id)
    app_ids = set(app_genie_by_id)
    splice_ids = sorted(md_ids & app_ids)
    preserved = sorted(app_ids - md_ids)  # app-only genie rows (no master source)
    md_only = sorted(md_ids - app_ids)  # in master, not in app seed

    print(f"App seed:   {app_seed_path}")
    print(f"Sections:   {sections_dir}")
    print(f"Genie ids — master md: {len(md_ids)}, app seed: {len(app_ids)}")
    print(f"Splicing {len(splice_ids)} block(s): {splice_ids}")
    if preserved:
        preserved_tags = [f"{i}:{app_genie_by_id[i]['section_tag']}" for i in preserved]
        print(f"Preserving app-only genie row(s): {preserved_tags}")
    if md_only:
        print(f"NOTE: master-only genie ids (not spliced, not in app): {md_only}")

    # 3. Build replacements
    replacements: list[tuple[int, int, list[str]]] = []
    for iid in splice_ids:
        fields = md_by_id[iid]
        block = app_genie_by_id[iid]
        new_lines = build_insert_block(fields)
        replacements.append((block["start"], block["end"], new_lines))
        print(
            f"  input_id={iid:>3} ({fields.get('section_tag', '?'):28s}) "
            f"lines {block['start'] + 1}-{block['end'] + 1} -> {len(new_lines)} lines"
        )

    if not replacements:
        print("\nNothing to splice.")
        return 0

    # 4. Apply bottom-to-top
    original_text = "\n".join(app_lines) + "\n"
    new_lines_all = list(app_lines)
    for start, end, new_block in sorted(replacements, key=lambda r: r[0], reverse=True):
        new_lines_all[start : end + 1] = new_block
    new_text = "\n".join(new_lines_all) + "\n"

    if args.dry_run:
        diff = difflib.unified_diff(
            original_text.splitlines(keepends=True),
            new_text.splitlines(keepends=True),
            fromfile=f"a/{SEED_FILE}",
            tofile=f"b/{SEED_FILE}",
            n=2,
        )
        diff_str = "".join(diff)
        print("\n--- DRY RUN diff ---\n")
        print(diff_str if diff_str else "No differences — app seed already in sync.")
    else:
        app_seed_path.write_text(new_text)
        print(f"\nApp seed updated: {app_seed_path}")
        print(f"  {len(replacements)} block(s) spliced")
        print(f"  Old line count: {len(app_lines)} -> new: {len(new_lines_all)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
