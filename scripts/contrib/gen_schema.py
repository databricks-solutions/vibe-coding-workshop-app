#!/usr/bin/env python3
"""Regenerate contrib/schema/*.schema.json from the pydantic models.

    python scripts/contrib/gen_schema.py          # write
    python scripts/contrib/gen_schema.py --check  # exit 1 if out of date
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from src.backend.contrib.models import CertificationManifest, ContributorManifest, UseCaseManifest  # noqa: E402

SCHEMA_DIR = ROOT / "contrib" / "schema"
MODELS = {
    "usecase.schema.json": UseCaseManifest,
    "contributor.schema.json": ContributorManifest,
    "certification.schema.json": CertificationManifest,
}


def render(model) -> str:
    schema = model.model_json_schema()
    schema["$schema"] = "https://json-schema.org/draft/2020-12/schema"
    return json.dumps(schema, indent=2, sort_keys=True) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    stale = []
    SCHEMA_DIR.mkdir(parents=True, exist_ok=True)
    for name, model in MODELS.items():
        path = SCHEMA_DIR / name
        text = render(model)
        if args.check:
            if not path.exists() or path.read_text(encoding="utf-8") != text:
                stale.append(name)
        else:
            path.write_text(text, encoding="utf-8")
            print(f"wrote {path.relative_to(ROOT)}")
    if stale:
        print(f"Out of date: {', '.join(stale)}. Run python scripts/contrib/gen_schema.py")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
