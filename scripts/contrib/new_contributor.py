#!/usr/bin/env python3
"""Register a contributor by cloning the sample contributor.

    python scripts/contrib/new_contributor.py --id acme --type company --name "Acme Analytics" --github acme-org/solutions
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTRIB = ROOT / "contrib"
SAMPLE = CONTRIB / "contributors" / "sample" / "contributor.yaml"
ID_RE = re.compile(r"^[a-z0-9][a-z0-9_]{0,31}$")


def set_key(text: str, key: str, value: str) -> str:
    return re.sub(rf"^{key}:.*$", f"{key}: {value}", text, count=1, flags=re.M)


def drop_key(text: str, key: str) -> str:
    return re.sub(rf"^{key}:.*\n", "", text, count=1, flags=re.M)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--id", required=True, help="permanent id: lowercase letters, digits, underscores (max 32)")
    parser.add_argument("--type", required=True, choices=["partner", "company", "individual", "group"])
    parser.add_argument("--name", required=True, help="display name")
    parser.add_argument("--github", help="GitHub user or org/team")
    args = parser.parse_args()

    if not ID_RE.match(args.id) or args.id == "sample":
        print("--id must be lowercase letters, digits and underscores (max 32), and not 'sample'.")
        return 1
    folder = CONTRIB / "contributors" / args.id
    if folder.exists():
        print(f"{folder.relative_to(ROOT)} already exists.")
        return 1

    text = SAMPLE.read_text(encoding="utf-8")
    text = text.replace("# SAMPLE CONTRIBUTOR. Copy this folder to register", "# Contributor registration. Copied from the sample. Register")
    text = set_key(text, "id", args.id)
    text = set_key(text, "type", args.type)
    text = set_key(text, "display_name", f'"{args.name}"')
    text = set_key(text, "description", f'"{args.name} use cases for the Vibe Coding Workshop."')
    text = drop_key(text, "website")
    text = drop_key(text, "avatar")
    text = set_key(text, "github", args.github) if args.github else drop_key(text, "github")
    text = re.sub(r"^members:\n(?:  .*\n)+", "members: []\n", text, flags=re.M)
    text = set_key(text, "can_certify", "false")
    text = drop_key(text, "contact")

    folder.mkdir(parents=True)
    (folder / "contributor.yaml").write_text(text, encoding="utf-8")
    print(f"Created {(folder / 'contributor.yaml').relative_to(ROOT)}")
    print(f"Next: python scripts/contrib/new_usecase.py --contributor {args.id} --slug <your_use_case>")
    return 0


if __name__ == "__main__":
    sys.exit(main())
