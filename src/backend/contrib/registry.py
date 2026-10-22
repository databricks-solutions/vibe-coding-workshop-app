"""Process-wide registry of contributed use cases.

Files under ``contrib/`` don't change while the app runs, so the catalog is
loaded once (at startup, or lazily on first use) and then treated as immutable.
``catalog_rows()`` returns rows shaped like the Lakebase cache rows in
``routes._refresh_lakebase_cache`` so the existing catalog code can merge them.
"""

from __future__ import annotations

import logging
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import quote

from .loader import ContribCatalog, ContributedUseCase, Contributor, load_catalog

logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_SOURCE_BASE_URL = "https://github.com/databricks-solutions/vibe-coding-workshop-app/tree/main"

_lock = threading.Lock()
_catalog: Optional[ContribCatalog] = None
_loaded_at: Optional[str] = None


def enabled() -> bool:
    return os.getenv("CONTRIB_ENABLED", "true").strip().lower() not in {"0", "false", "no", "off"}


def contrib_dir() -> Path:
    configured = os.getenv("CONTRIB_DIR", "").strip()
    return Path(configured).resolve() if configured else REPO_ROOT / "contrib"


def source_base_url() -> str:
    return os.getenv("CONTRIB_SOURCE_BASE_URL", DEFAULT_SOURCE_BASE_URL).strip().rstrip("/")


def load(force: bool = False) -> ContribCatalog:
    """Load (or return) the catalog. Never raises."""
    global _catalog, _loaded_at
    with _lock:
        if _catalog is not None and not force:
            return _catalog
        root = contrib_dir()
        if not enabled():
            _catalog = ContribCatalog(root=root)
            _loaded_at = datetime.now(timezone.utc).isoformat()
            logger.info("[Contrib] Disabled by CONTRIB_ENABLED")
            return _catalog
        try:
            _catalog = load_catalog(root)
        except Exception as e:  # defensive: the loader itself shouldn't raise
            logger.exception(f"[Contrib] Failed to load {root}: {e}")
            _catalog = ContribCatalog(root=root)
        for issue in _catalog.errors:
            logger.warning(f"[Contrib] Skipped {issue.path}: {issue.message}")
        _loaded_at = datetime.now(timezone.utc).isoformat()
        logger.info(
            f"[Contrib] Loaded {len(_catalog.use_cases)} contributed use case(s) from "
            f"{len(_catalog.contributors)} contributor(s); {len(_catalog.errors)} skipped"
        )
        return _catalog


def get_catalog() -> ContribCatalog:
    return _catalog if _catalog is not None else load()


def reset_for_tests(catalog: Optional[ContribCatalog] = None) -> None:
    global _catalog, _loaded_at
    with _lock:
        _catalog = catalog
        _loaded_at = None


# ---------- Public (API-facing) shapes ----------

def _avatar_url(c: Contributor) -> Optional[str]:
    return f"/api/contrib/contributors/{quote(c.manifest.id)}/avatar" if c.avatar else None


def _asset_url(uc: ContributedUseCase, rel: Optional[str]) -> Optional[str]:
    if not rel or rel not in uc.assets:
        return None
    return f"/api/contrib/assets/{quote(uc.key)}/{quote(rel)}"


def contributor_public(c: Contributor) -> Dict[str, Any]:
    m = c.manifest
    return {
        "id": m.id,
        "type": m.type,
        "display_name": m.display_name,
        "description": m.description,
        "website": m.website,
        "github": m.github,
        "avatar_url": _avatar_url(c),
        "members": [p.model_dump() for p in m.members],
        "can_certify": m.can_certify,
    }


def _contributor_brief(c: Contributor) -> Dict[str, Any]:
    m = c.manifest
    return {"id": m.id, "type": m.type, "display_name": m.display_name, "website": m.website, "avatar_url": _avatar_url(c)}


def provenance_of(uc: ContributedUseCase) -> str:
    return "partner" if uc.contributor.manifest.type == "partner" else "third_party"


def contribution_public(uc: ContributedUseCase) -> Dict[str, Any]:
    m = uc.manifest
    base = source_base_url()
    return {
        "key": uc.key,
        "provenance": provenance_of(uc),
        "sample": m.sample,
        "status": m.status,
        "version": m.version,
        "summary": m.summary,
        "contributor": _contributor_brief(uc.contributor),
        "co_contributors": [_contributor_brief(c) for c in uc.co_contributors],
        "authors": [p.model_dump() for p in m.authors],
        "tags": list(m.tags),
        "featured_resource": m.featured_resource.model_dump() if m.featured_resource else None,
        "links": [link.model_dump() for link in m.links],
        "changelog": [
            {"version": e.version, "date": e.date.isoformat(), "notes": e.notes}
            for e in sorted(m.changelog, key=lambda e: e.date, reverse=True)
        ],
        "media": {
            "cover_url": _asset_url(uc, m.media.cover),
            "screenshot_urls": [u for u in (_asset_url(uc, s) for s in m.media.screenshots) if u],
        },
        "certifications": [
            {
                "by": _contributor_brief(cert.certifier),
                "version": cert.manifest.version,
                "date": cert.manifest.date.isoformat(),
                "notes": cert.manifest.notes,
                "evidence_url": cert.manifest.evidence_url,
            }
            for cert in uc.current_certifications
        ],
        "source_path": uc.source_path,
        "source_url": f"{base}/{uc.source_path}" if base else None,
        "guide_url": f"{base}/contrib/README.md" if base else None,
    }


def catalog_rows() -> List[Dict[str, Any]]:
    """Every loaded contribution as a cache-shaped row (home collection not yet resolved)."""
    rows = []
    for uc in get_catalog().use_cases.values():
        m = uc.manifest
        rows.append({
            "industry": m.collections.home,
            "industry_label": None,
            "use_case": uc.key,
            "use_case_label": m.title,
            "prompt_template": uc.prompt_template,
            "version": 1,
            "category": m.collections.category,
            "category_order": m.collections.category_order if m.collections.category else None,
            "display_order": m.collections.display_order,
            "is_certified": False,
            "path_type": m.path_type,
            "source": "contributed",
            "provenance": provenance_of(uc),
            "contrib_status": m.status,
            "contrib_also": list(m.collections.also),
            "contrib_sample": m.sample,
            "contribution": contribution_public(uc),
        })
    return rows


def status() -> Dict[str, Any]:
    catalog = get_catalog()
    base = source_base_url()
    return {
        "enabled": enabled(),
        "root": catalog.root.name,
        "contributors": len(catalog.contributors),
        "use_cases": len(catalog.use_cases),
        "sample_present": any(uc.manifest.sample for uc in catalog.use_cases.values()),
        "loaded_at": _loaded_at,
        "guide_url": f"{base}/contrib/README.md" if base else None,
        "sample_url": f"{base}/contrib/usecases/sample/contributed_usecase_starter" if base else None,
        "errors": [{"path": i.path, "message": i.message} for i in catalog.errors],
        "warnings": [{"path": i.path, "message": i.message} for i in catalog.warnings],
    }


def asset_path(key: str, rel: str) -> Optional[Path]:
    uc = get_catalog().use_cases.get(key)
    return uc.assets.get(rel) if uc else None


def avatar_path(contributor_id: str) -> Optional[Path]:
    c = get_catalog().contributors.get(contributor_id)
    return c.avatar if c else None
