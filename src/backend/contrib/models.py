"""File contract for contributed use cases.

These pydantic models are the single source of truth for the YAML files under
``contrib/``. ``scripts/contrib/gen_schema.py`` turns them into the JSON Schemas
in ``contrib/schema/`` that editors use for autocompletion.
"""

from __future__ import annotations

import datetime as dt
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

ID_PATTERN = r"^[a-z0-9][a-z0-9_]*$"
SEMVER_PATTERN = r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$"
GITHUB_PATTERN = r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})(?:/[A-Za-z0-9_.-]+)?$"
CONTRIBUTOR_ID_MAX = 32
SLUG_MAX = 48

ContributorType = Literal["partner", "company", "individual", "group"]
UseCaseStatus = Literal["active", "deprecated", "withdrawn"]


def _https(value: Optional[str]) -> Optional[str]:
    if value is not None and not value.startswith("https://"):
        raise ValueError("must be an https:// URL")
    return value


def semver_tuple(version: str) -> tuple[int, int, int]:
    major, minor, patch = (int(p) for p in version.split("."))
    return major, minor, patch


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Person(_Strict):
    name: str = Field(..., min_length=1, max_length=80)
    github: Optional[str] = Field(default=None, pattern=GITHUB_PATTERN)
    url: Optional[str] = None

    _url = field_validator("url")(_https)


class ContributorManifest(_Strict):
    """``contrib/contributors/<id>/contributor.yaml``"""

    schema_version: Literal[1] = Field(..., description="Contract version. Always 1 for now.")
    id: str = Field(..., pattern=ID_PATTERN, max_length=CONTRIBUTOR_ID_MAX, description="Must match the folder name. Permanent.")
    type: ContributorType = Field(..., description="partner | company | individual | group. Maintainers review changes.")
    display_name: str = Field(..., min_length=1, max_length=80)
    description: Optional[str] = Field(default=None, max_length=280)
    website: Optional[str] = None
    avatar: Optional[str] = Field(default=None, description="Image file in this folder (png, jpg or webp, max 1 MB).")
    github: Optional[str] = Field(default=None, pattern=GITHUB_PATTERN, description="GitHub user or org/team that co-owns this contributor's use cases.")
    members: List[Person] = Field(default_factory=list, max_length=50)
    can_certify: bool = Field(default=False, description="Granted by maintainers only.")
    contact: Optional[str] = Field(default=None, max_length=120)

    _website = field_validator("website")(_https)


class Collections(_Strict):
    home: str = Field(..., pattern=ID_PATTERN, max_length=100, description="Collection id, e.g. 'retail'. Falls back to Partner & Community when this install doesn't have it.")
    also: List[str] = Field(default_factory=list, max_length=10, description="Extra collection ids to cross-list into.")
    category: Optional[str] = Field(default=None, max_length=100, description="Outcome-map column in the home collection.")
    category_order: Optional[int] = Field(default=None, ge=1, le=999)
    display_order: Optional[int] = Field(default=None, ge=1, le=999)

    @field_validator("also")
    @classmethod
    def _ids(cls, value: List[str]) -> List[str]:
        import re

        for cid in value:
            if not re.match(ID_PATTERN, cid) or len(cid) > 100:
                raise ValueError(f"'{cid}' is not a valid collection id")
        return value


class Media(_Strict):
    cover: Optional[str] = Field(default=None, description="Path relative to the use case folder, e.g. images/cover.jpg.")
    screenshots: List[str] = Field(default_factory=list, max_length=6)


class Link(_Strict):
    label: str = Field(..., min_length=1, max_length=80)
    url: str

    _url = field_validator("url")(_https)


class ChangelogEntry(_Strict):
    version: str = Field(..., pattern=SEMVER_PATTERN)
    date: dt.date
    notes: str = Field(..., min_length=1, max_length=500)


class UseCaseManifest(_Strict):
    """``contrib/usecases/<contributor_id>/<slug>/usecase.yaml``"""

    schema_version: Literal[1]
    slug: str = Field(..., pattern=ID_PATTERN, max_length=SLUG_MAX, description="Must match the folder name. Permanent.")
    title: str = Field(..., min_length=1, max_length=80)
    summary: str = Field(..., min_length=1, max_length=200, description="One line shown on cards.")
    version: str = Field(..., pattern=SEMVER_PATTERN, description="Bump on every change; add a changelog entry.")
    status: UseCaseStatus = "active"
    path_type: Literal["use_case", "skill"] = "use_case"
    sample: bool = Field(default=False, description="Reserved for the 'sample' contributor.")
    co_contributors: List[str] = Field(default_factory=list, max_length=10, description="Other registered contributor ids.")
    authors: List[Person] = Field(default_factory=list, max_length=20)
    collections: Collections
    tags: List[str] = Field(default_factory=list, max_length=10)
    media: Media = Field(default_factory=Media)
    links: List[Link] = Field(default_factory=list, max_length=10)
    changelog: List[ChangelogEntry] = Field(..., min_length=1)

    @field_validator("tags")
    @classmethod
    def _tags(cls, value: List[str]) -> List[str]:
        for tag in value:
            if not tag or len(tag) > 32:
                raise ValueError("tags must be 1-32 characters")
        return value


class CertificationManifest(_Strict):
    """``contrib/certifications/<certifier_id>/<contributor_id>__<slug>.yaml``"""

    schema_version: Literal[1]
    version: str = Field(..., pattern=SEMVER_PATTERN, description="The use case version this certification covers.")
    date: dt.date
    notes: str = Field(..., min_length=1, max_length=500)
    evidence_url: Optional[str] = None

    _evidence = field_validator("evidence_url")(_https)
