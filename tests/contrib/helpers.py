"""Build small contrib/ trees for tests."""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional

import yaml

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPG = b"\xff\xd8\xff\xe0" + b"\x00" * 64
BRIEF = "Build a **simple app** that helps teams plan their week.\n\n## Core Features\n- Plan\n- Track\n"


def write_yaml(path: Path, data: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")


def add_contributor(root: Path, cid: str, type_: str = "company", **extra: Any) -> Path:
    data = {"schema_version": 1, "id": cid, "type": type_, "display_name": cid.replace("_", " ").title(), **extra}
    write_yaml(root / "contributors" / cid / "contributor.yaml", data)
    return root / "contributors" / cid


def add_use_case(
    root: Path,
    cid: str,
    slug: str,
    version: str = "1.0.0",
    brief: Optional[str] = BRIEF,
    **extra: Any,
) -> Path:
    folder = root / "usecases" / cid / slug
    data = {
        "schema_version": 1,
        "slug": slug,
        "title": slug.replace("_", " ").title(),
        "summary": "A test use case.",
        "version": version,
        "collections": {"home": "retail"},
        "changelog": [{"version": version, "date": "2026-10-01", "notes": "First version."}],
    }
    data.update(extra)
    write_yaml(folder / "usecase.yaml", data)
    if brief is not None:
        (folder / "description.md").write_text(brief, encoding="utf-8")
    return folder


def add_certification(root: Path, certifier: str, owner: str, slug: str, version: str = "1.0.0") -> Path:
    path = root / "certifications" / certifier / f"{owner}__{slug}.yaml"
    write_yaml(path, {"schema_version": 1, "version": version, "date": "2026-10-02", "notes": "Validated end to end."})
    return path
