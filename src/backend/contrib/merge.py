"""Pure helpers that place contributed rows into this install's collections.

Kept free of database and FastAPI imports so the merge rules are easy to test.
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, List, Set

from . import COMMUNITY_COLLECTION_ID, COMMUNITY_COLLECTION_LABEL

# Columns of the Partner & Community collection's outcome map.
COMMUNITY_COLUMNS = {
    "partner": ("Partner contributions", 1),
    "third_party": ("Third-party contributions", 2),
    "sample": ("Start here: sample", 3),
}


def community_column(row: Dict[str, Any]) -> tuple[str, int]:
    if row.get("contrib_sample"):
        return COMMUNITY_COLUMNS["sample"]
    return COMMUNITY_COLUMNS.get(row.get("provenance") or "", COMMUNITY_COLUMNS["third_party"])


def resolve_rows(
    raw_rows: Iterable[Dict[str, Any]],
    known_collections: Set[str],
    collection_labels: Dict[str, str],
    overrides: Dict[str, Dict[str, Any]],
    include_unlisted: bool,
) -> List[Dict[str, Any]]:
    """Resolve home collection, labels and admin overrides.

    Contributions arrive inactive: a row is listed only after an admin activates it
    in the Library, and never while withdrawn. Unlisted rows are still returned when
    ``include_unlisted`` is set, so the Library can show them and existing sessions
    keep resolving their prompt template.
    """
    out: List[Dict[str, Any]] = []
    for raw in raw_rows:
        row = dict(raw)
        if row["industry"] not in known_collections:
            row["industry"] = COMMUNITY_COLLECTION_ID
        home = row["industry"]
        row["industry_label"] = (
            COMMUNITY_COLLECTION_LABEL if home == COMMUNITY_COLLECTION_ID else collection_labels.get(home) or home
        )
        if home == COMMUNITY_COLLECTION_ID and not row.get("category"):
            row["category"], row["category_order"] = community_column(row)
        ov = overrides.get(row["use_case"]) or {}
        for f in ("category", "category_order", "display_order"):
            if ov.get(f) is not None:
                row[f] = ov[f]
        row["is_active"] = ov.get("is_active") is True
        listed = row["is_active"] and row.get("contrib_status") != "withdrawn"
        row["contrib_listed"] = listed
        if include_unlisted or listed:
            out.append(row)
    return out


def synthesize_members(rows: Iterable[Dict[str, Any]], known_collections: Set[str]) -> List[Dict[str, Any]]:
    """File-declared cross-listings: every contribution in Partner & Community plus its ``also`` collections."""
    members: List[Dict[str, Any]] = []
    for row in rows:
        home = row["industry"]
        targets = [COMMUNITY_COLLECTION_ID] + [c for c in row.get("contrib_also") or [] if c in known_collections]
        seen = {home}
        for cid in targets:
            if cid in seen:
                continue
            seen.add(cid)
            category, category_order = community_column(row) if cid == COMMUNITY_COLLECTION_ID else (None, None)
            members.append({
                "collection_id": cid,
                "home_industry": home,
                "use_case": row["use_case"],
                "category": category,
                "category_order": category_order,
                "display_order": row.get("display_order"),
                "locked": True,
            })
    return members
