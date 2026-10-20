#!/usr/bin/env python3
"""Start a new contributed use case by cloning the sample.

    python scripts/contrib/new_usecase.py --contributor acme --slug claims_triage --title "Claims Triage Agent"

The copy keeps every commented field from the sample, drops the sample flag and
images, and starts at version 1.0.0. Edit usecase.yaml and description.md, then
run python scripts/contrib/validate.py.
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTRIB = ROOT / "contrib"
SAMPLE = CONTRIB / "usecases" / "sample" / "contributed_usecase_starter"
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9_]{0,47}$")


def set_key(text: str, key: str, value: str) -> str:
    return re.sub(rf"^(\s*){key}:.*$", rf"\g<1>{key}: {value}", text, count=1, flags=re.M)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--contributor", required=True, help="your registered contributor id")
    parser.add_argument("--slug", required=True, help="permanent id: lowercase letters, digits, underscores (max 48)")
    parser.add_argument("--title", help="card title (defaults to the slug)")
    parser.add_argument("--home", default="sample", help="home collection id, e.g. retail (default: sample)")
    args = parser.parse_args()

    if not (CONTRIB / "contributors" / args.contributor / "contributor.yaml").exists():
        print(f"Contributor '{args.contributor}' isn't registered. Run scripts/contrib/new_contributor.py first.")
        return 1
    if not SLUG_RE.match(args.slug):
        print("--slug must be lowercase letters, digits and underscores (max 48).")
        return 1
    folder = CONTRIB / "usecases" / args.contributor / args.slug
    if folder.exists():
        print(f"{folder.relative_to(ROOT)} already exists.")
        return 1

    title = args.title or args.slug.replace("_", " ").title()
    today = dt.date.today().isoformat()
    text = (SAMPLE / "usecase.yaml").read_text(encoding="utf-8")
    text = text.replace("# SAMPLE USE CASE. This is the reference contribution and the template the\n# scaffolder copies.", "# Contributed use case. Copied from the sample.")
    text = re.sub(r"# Reserved: only the 'sample'.*\nsample: true\n\n", "", text)
    text = set_key(text, "slug", args.slug)
    text = set_key(text, "title", f'"{title}"')
    text = set_key(text, "summary", "One line that tells attendees what they will build.")
    text = set_key(text, "version", "1.0.0")
    text = set_key(text, "home", args.home)
    text = re.sub(r"^authors:\n(?:  .*\n)+", "authors: []\n", text, flags=re.M)
    text = set_key(text, "tags", "[]")
    text = re.sub(r"^media:\n(?:  .*\n)+", "media:\n  cover: null\n  screenshots: []\n", text, flags=re.M)
    text = re.sub(r"^links:\n(?:  .*\n)+", "links: []\n", text, flags=re.M)
    text = re.sub(
        r"^changelog:\n(?:  .*\n)+",
        f"changelog:\n  - version: 1.0.0\n    date: {today}\n    notes: First version.\n",
        text,
        flags=re.M,
    )

    folder.mkdir(parents=True)
    (folder / "images").mkdir()
    (folder / "usecase.yaml").write_text(text, encoding="utf-8")
    (folder / "description.md").write_text((SAMPLE / "description.md").read_text(encoding="utf-8"), encoding="utf-8")
    rel = folder.relative_to(ROOT)
    print(f"Created {rel}")
    print(f"Next: edit {rel}/usecase.yaml and {rel}/description.md, add images under {rel}/images/,")
    print("then run python scripts/contrib/validate.py and open a pull request.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
