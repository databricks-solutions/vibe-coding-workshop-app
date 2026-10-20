"""Load and validate the ``contrib/`` folder.

Every entry is validated on its own: a broken file skips only that entry and is
recorded as a ``LoadIssue``. Nothing here raises for bad content, so a bad
contribution can never stop the app from starting. ``scripts/contrib/validate.py``
runs the same loader and fails CI on any error.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import yaml
from pydantic import ValidationError

from . import KEY_PREFIX, SAMPLE_CONTRIBUTOR_ID
from .lint import lint_brief
from .models import (
    ID_PATTERN,
    CertificationManifest,
    ContributorManifest,
    UseCaseManifest,
)

MAX_IMAGE_BYTES = 1_000_000
MAX_YAML_BYTES = 64_000
IMAGE_SIGNATURES = {
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".webp": (b"RIFF",),
}
IMAGE_MEDIA_TYPES = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}
_ID_RE = re.compile(ID_PATTERN)


@dataclass(frozen=True)
class LoadIssue:
    path: str
    message: str
    severity: str = "error"


@dataclass(frozen=True)
class Contributor:
    manifest: ContributorManifest
    folder: Path
    avatar: Optional[Path]


@dataclass(frozen=True)
class Certification:
    certifier: Contributor
    manifest: CertificationManifest
    current: bool


@dataclass
class ContributedUseCase:
    key: str
    contributor: Contributor
    manifest: UseCaseManifest
    prompt_template: str
    folder: Path
    source_path: str
    assets: Dict[str, Path]
    co_contributors: List[Contributor] = field(default_factory=list)
    certifications: List[Certification] = field(default_factory=list)

    @property
    def current_certifications(self) -> List[Certification]:
        return [c for c in self.certifications if c.current]


@dataclass
class ContribCatalog:
    root: Path
    contributors: Dict[str, Contributor] = field(default_factory=dict)
    use_cases: Dict[str, ContributedUseCase] = field(default_factory=dict)
    issues: List[LoadIssue] = field(default_factory=list)

    @property
    def errors(self) -> List[LoadIssue]:
        return [i for i in self.issues if i.severity == "error"]

    @property
    def warnings(self) -> List[LoadIssue]:
        return [i for i in self.issues if i.severity == "warning"]


def make_key(contributor_id: str, slug: str) -> str:
    return f"{KEY_PREFIX}{contributor_id}__{slug}"


def _rel(root: Path, path: Path) -> str:
    try:
        return path.relative_to(root.parent).as_posix()
    except ValueError:
        return path.as_posix()


def _children(folder: Path) -> List[Path]:
    """Visible child directories, sorted so every process loads the same catalog."""
    if not folder.is_dir():
        return []
    return sorted(
        p for p in folder.iterdir()
        if p.is_dir() and not p.is_symlink() and not p.name.startswith((".", "_"))
    )


def _format_validation(err: ValidationError) -> str:
    parts = []
    for e in err.errors():
        loc = ".".join(str(x) for x in e.get("loc", ())) or "(file)"
        parts.append(f"{loc}: {e.get('msg')}")
    return "; ".join(parts)


def _read_yaml(path: Path) -> Tuple[Optional[dict], Optional[str]]:
    if path.is_symlink() or not path.is_file():
        return None, "is missing"
    if path.stat().st_size > MAX_YAML_BYTES:
        return None, f"is larger than {MAX_YAML_BYTES // 1000} KB"
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (yaml.YAMLError, UnicodeDecodeError) as e:
        return None, f"isn't valid YAML: {e}"
    if not isinstance(data, dict):
        return None, "must be a YAML mapping"
    return data, None


def _resolve_file(base: Path, rel: str, root: Path) -> Tuple[Optional[Path], Optional[str]]:
    """Resolve a manifest-relative path, refusing anything outside ``base`` or behind a symlink."""
    if not rel or rel.startswith(("/", "\\")) or ".." in Path(rel).parts:
        return None, f"'{rel}' must be a relative path inside the folder"
    candidate = base / rel
    for parent in [candidate, *candidate.parents]:
        if parent == base.parent:
            break
        if parent.is_symlink():
            return None, f"'{rel}' is a symlink, which isn't allowed"
    try:
        resolved = candidate.resolve(strict=True)
    except (FileNotFoundError, RuntimeError):
        return None, f"'{rel}' doesn't exist"
    if not resolved.is_relative_to(base.resolve()) or not resolved.is_relative_to(root.resolve()):
        return None, f"'{rel}' points outside the folder"
    if not resolved.is_file():
        return None, f"'{rel}' isn't a file"
    return resolved, None


def _check_image(base: Path, rel: str, root: Path) -> Tuple[Optional[Path], Optional[str]]:
    path, err = _resolve_file(base, rel, root)
    if err:
        return None, err
    ext = path.suffix.lower()
    if ext not in IMAGE_SIGNATURES:
        return None, f"'{rel}' must be png, jpg or webp (SVG isn't allowed)"
    size = path.stat().st_size
    if size > MAX_IMAGE_BYTES:
        return None, f"'{rel}' is {size / 1_000_000:.1f} MB; the limit is 1 MB"
    with path.open("rb") as f:
        head = f.read(16)
    if not any(head.startswith(sig) for sig in IMAGE_SIGNATURES[ext]) or (ext == ".webp" and head[8:12] != b"WEBP"):
        return None, f"'{rel}' isn't a real {ext[1:]} image"
    return path, None


def _load_contributors(catalog: ContribCatalog) -> None:
    root = catalog.root
    for folder in _children(root / "contributors"):
        path = folder / "contributor.yaml"
        where = _rel(root, path)
        data, err = _read_yaml(path)
        if err:
            catalog.issues.append(LoadIssue(where, f"contributor.yaml {err}"))
            continue
        try:
            manifest = ContributorManifest.model_validate(data)
        except ValidationError as e:
            catalog.issues.append(LoadIssue(where, _format_validation(e)))
            continue
        if manifest.id != folder.name:
            catalog.issues.append(LoadIssue(where, f"id '{manifest.id}' must match the folder name '{folder.name}'"))
            continue
        avatar = None
        if manifest.avatar:
            avatar, err = _check_image(folder, manifest.avatar, root)
            if err:
                catalog.issues.append(LoadIssue(where, f"avatar: {err}"))
                continue
        catalog.contributors[manifest.id] = Contributor(manifest=manifest, folder=folder, avatar=avatar)


def _load_use_case(catalog: ContribCatalog, owner: Contributor, folder: Path) -> None:
    root = catalog.root
    path = folder / "usecase.yaml"
    where = _rel(root, path)
    if not _ID_RE.match(folder.name) or len(folder.name) > 48:
        catalog.issues.append(LoadIssue(_rel(root, folder), "folder name must be lowercase letters, digits and underscores (max 48)"))
        return
    data, err = _read_yaml(path)
    if err:
        catalog.issues.append(LoadIssue(where, f"usecase.yaml {err}"))
        return
    try:
        manifest = UseCaseManifest.model_validate(data)
    except ValidationError as e:
        catalog.issues.append(LoadIssue(where, _format_validation(e)))
        return

    problems: List[str] = []
    if manifest.slug != folder.name:
        problems.append(f"slug '{manifest.slug}' must match the folder name '{folder.name}'")
    if manifest.sample and owner.manifest.id != SAMPLE_CONTRIBUTOR_ID:
        problems.append("sample: true is reserved for the 'sample' contributor")
    if not any(entry.version == manifest.version for entry in manifest.changelog):
        problems.append(f"changelog needs an entry for version {manifest.version}")
    co_contributors: List[Contributor] = []
    for cid in manifest.co_contributors:
        if cid == owner.manifest.id:
            problems.append(f"co_contributors lists the owner '{cid}'")
        elif cid not in catalog.contributors:
            problems.append(f"co-contributor '{cid}' isn't registered under contrib/contributors/")
        else:
            co_contributors.append(catalog.contributors[cid])

    assets: Dict[str, Path] = {}
    for rel in filter(None, [manifest.media.cover, *manifest.media.screenshots]):
        image, err = _check_image(folder, rel, root)
        if err:
            problems.append(f"media: {err}")
        else:
            assets[Path(rel).as_posix()] = image

    brief_path, err = _resolve_file(folder, "description.md", root)
    brief = ""
    if err:
        problems.append("description.md is missing")
    else:
        try:
            brief = brief_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            problems.append("description.md must be UTF-8")
        else:
            lint_errors, lint_warnings = lint_brief(brief)
            problems.extend(f"description.md {m}" for m in lint_errors)
            catalog.issues.extend(LoadIssue(_rel(root, brief_path), f"description.md {m}", "warning") for m in lint_warnings)

    if problems:
        catalog.issues.extend(LoadIssue(where, p) for p in problems)
        return

    key = make_key(owner.manifest.id, manifest.slug)
    catalog.use_cases[key] = ContributedUseCase(
        key=key,
        contributor=owner,
        manifest=manifest,
        prompt_template=brief.strip() + "\n",
        folder=folder,
        source_path=_rel(root, folder),
        assets=assets,
        co_contributors=co_contributors,
    )


def _load_use_cases(catalog: ContribCatalog) -> None:
    root = catalog.root
    for owner_folder in _children(root / "usecases"):
        owner = catalog.contributors.get(owner_folder.name)
        if owner is None:
            catalog.issues.append(LoadIssue(
                _rel(root, owner_folder),
                f"'{owner_folder.name}' isn't registered; add contrib/contributors/{owner_folder.name}/contributor.yaml",
            ))
            continue
        for folder in _children(owner_folder):
            _load_use_case(catalog, owner, folder)


def _load_certifications(catalog: ContribCatalog) -> None:
    root = catalog.root
    for certifier_folder in _children(root / "certifications"):
        certifier = catalog.contributors.get(certifier_folder.name)
        for path in sorted(certifier_folder.glob("*.yaml")):
            where = _rel(root, path)
            if certifier is None:
                catalog.issues.append(LoadIssue(where, f"certifier '{certifier_folder.name}' isn't registered"))
                continue
            if not certifier.manifest.can_certify:
                catalog.issues.append(LoadIssue(where, f"'{certifier.manifest.id}' isn't allowed to certify (can_certify is false)"))
                continue
            owner_id, sep, slug = path.stem.partition("__")
            if not sep:
                catalog.issues.append(LoadIssue(where, "file name must be <contributor_id>__<slug>.yaml"))
                continue
            if certifier.manifest.id == SAMPLE_CONTRIBUTOR_ID and owner_id != SAMPLE_CONTRIBUTOR_ID:
                catalog.issues.append(LoadIssue(where, "the sample contributor can only certify sample use cases"))
                continue
            target = catalog.use_cases.get(make_key(owner_id, slug))
            if target is None:
                catalog.issues.append(LoadIssue(where, f"no use case at contrib/usecases/{owner_id}/{slug}"))
                continue
            data, err = _read_yaml(path)
            if err:
                catalog.issues.append(LoadIssue(where, err))
                continue
            try:
                manifest = CertificationManifest.model_validate(data)
            except ValidationError as e:
                catalog.issues.append(LoadIssue(where, _format_validation(e)))
                continue
            current = manifest.version == target.manifest.version
            if not current:
                catalog.issues.append(LoadIssue(
                    where,
                    f"certifies version {manifest.version} but the use case is now {target.manifest.version}; the badge is hidden until it's re-certified",
                    "warning",
                ))
            target.certifications.append(Certification(certifier=certifier, manifest=manifest, current=current))


def load_catalog(root: Path) -> ContribCatalog:
    catalog = ContribCatalog(root=root)
    if not root.is_dir():
        return catalog
    _load_contributors(catalog)
    _load_use_cases(catalog)
    _load_certifications(catalog)
    return catalog
