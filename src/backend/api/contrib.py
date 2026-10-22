"""Contributed use cases API: images, contributor avatars, the public registry and load status.

Files are served only when a validated manifest lists them, so a request can
never reach anything else on disk.
"""

from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from src.backend.contrib import registry
from src.backend.contrib.loader import IMAGE_MEDIA_TYPES

router = APIRouter()

_ASSET_HEADERS = {"Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff"}


def _image(path) -> FileResponse:
    media_type = IMAGE_MEDIA_TYPES.get(path.suffix.lower())
    if media_type is None:
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(str(path), media_type=media_type, headers=_ASSET_HEADERS)


@router.get("/contrib/assets/{key}/{rel:path}", include_in_schema=False)
async def contrib_asset(key: str, rel: str) -> FileResponse:
    path = registry.asset_path(key, rel)
    if path is None:
        raise HTTPException(status_code=404, detail="Not found")
    return _image(path)


@router.get("/contrib/contributors/{contributor_id}/avatar", include_in_schema=False)
async def contrib_avatar(contributor_id: str) -> FileResponse:
    path = registry.avatar_path(contributor_id)
    if path is None:
        raise HTTPException(status_code=404, detail="Not found")
    return _image(path)


@router.get("/contrib/contributors", summary="Registered contributors")
async def contrib_contributors() -> List[Dict[str, Any]]:
    return [registry.contributor_public(c) for c in registry.get_catalog().contributors.values()]


@router.get("/contrib/status", summary="Contributed use cases load status")
async def contrib_status() -> Dict[str, Any]:
    return registry.status()


@router.post("/contrib/reload", summary="Reload contributed use cases from deployed files")
async def reload_contributions() -> Dict[str, Any]:
    """Re-read the deployed contrib/ directory; this intentionally does not fetch source control."""
    registry.load(force=True)
    return registry.status()
