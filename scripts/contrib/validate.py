#!/usr/bin/env python3
"""Validate the contrib/ folder exactly the way the app loads it.

    python scripts/contrib/validate.py                    # every rule the app enforces
    python scripts/contrib/validate.py --base origin/main # plus pull-request rules

Pull-request rules (with --base):
  * a changed use case must bump `version` (and the loader already requires a
    matching changelog entry);
  * use cases and contributors can't be renamed, moved or deleted (withdraw instead);
  * changes to a contributor's `type` or `can_certify` are flagged for maintainers.

Exits 1 when anything would stop a contribution from loading.
"""

from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import yaml

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from src.backend.contrib.loader import load_catalog  # noqa: E402
from src.backend.contrib.models import SEMVER_PATTERN, semver_tuple  # noqa: E402

IN_ACTIONS = os.getenv("GITHUB_ACTIONS") == "true"


def report(kind: str, path: str, message: str) -> None:
    if IN_ACTIONS:
        level = "error" if kind == "error" else "warning" if kind == "warning" else "notice"
        print(f"::{level} file={path}::{message}")
    else:
        print(f"  {kind.upper():8} {path}: {message}")


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, check=True, capture_output=True, text=True).stdout


def yaml_at(ref: str, path: str) -> Optional[dict]:
    try:
        data = yaml.safe_load(git("show", f"{ref}:{path}"))
    except (subprocess.CalledProcessError, yaml.YAMLError):
        return None
    return data if isinstance(data, dict) else None


def changed_files(base: str) -> List[Tuple[str, str, Optional[str]]]:
    out = git("diff", "--name-status", "-M", f"{base}...HEAD", "--", "contrib/")
    rows = []
    for line in out.splitlines():
        parts = line.split("\t")
        status = parts[0][0]
        rows.append((status, parts[1], parts[2] if len(parts) > 2 else None))
    return rows


def use_case_folder(path: str) -> Optional[str]:
    parts = Path(path).parts
    if len(parts) >= 5 and parts[:2] == ("contrib", "usecases"):
        return "/".join(parts[:4])
    return None


def pull_request_rules(base: str) -> int:
    errors = 0
    touched: Dict[str, bool] = {}
    for status, path, new_path in changed_files(base):
        name = Path(path).name
        if status in ("D", "R") and name in ("usecase.yaml", "contributor.yaml"):
            report("error", path, "use cases and contributors can't be renamed, moved or deleted; set status: withdrawn instead")
            errors += 1
        folder = use_case_folder(new_path or path)
        if folder and status != "D":
            is_new = status == "A" and name == "usecase.yaml"
            touched[folder] = touched.get(folder, False) or is_new
        if name == "contributor.yaml" and status == "M":
            old, new = yaml_at(base, path), yaml_at("HEAD", path)
            for field in ("type", "can_certify"):
                if old and new and old.get(field) != new.get(field):
                    report("warning", path, f"changes {field} from {old.get(field)!r} to {new.get(field)!r}; a maintainer must approve")

    for folder, is_new in sorted(touched.items()):
        if is_new:
            continue
        manifest = f"{folder}/usecase.yaml"
        old, new = yaml_at(base, manifest), yaml_at("HEAD", manifest)
        if not old or not new:
            continue
        ov, nv = str(old.get("version", "")), str(new.get("version", ""))
        if not (re.match(SEMVER_PATTERN, ov) and re.match(SEMVER_PATTERN, nv)):
            continue
        if semver_tuple(nv) <= semver_tuple(ov):
            report("error", manifest, f"files in this use case changed, so bump version (currently {nv}, was {ov}) and add a changelog entry")
            errors += 1
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dir", default=str(ROOT / "contrib"), help="contrib folder (default: repo contrib/)")
    parser.add_argument("--base", help="git ref to compare against for pull-request rules, e.g. origin/main")
    args = parser.parse_args()

    catalog = load_catalog(Path(args.dir))
    print(f"contrib: {len(catalog.contributors)} contributor(s), {len(catalog.use_cases)} use case(s)")
    for issue in catalog.issues:
        report(issue.severity, issue.path, issue.message)
    errors = len(catalog.errors)
    if args.base:
        errors += pull_request_rules(args.base)
    if errors:
        print(f"\n{errors} problem(s) found. See contrib/README.md.")
        return 1
    print("All contributions are valid.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
