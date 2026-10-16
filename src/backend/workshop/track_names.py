"""Track names a learner can say, resolved to a manifest track id.

The web UI and Genie Code both name tracks the way a learner reads them
("Databricks Apps + Lakebase", "Reverse ETL: Analytics App"). The manifest titles
are button labels for additive picks ("+ Lakebase"), so every track also has one
standalone display name here, mirrored in ``src/constants/trackNames.ts`` (parity
test: tests/workshop/test_track_switch_parity.py).

Matching is deterministic, never fuzzy: a normalized exact match on an id, a
display name, a unique title or a synonym, then the same on the word set. A name
that says "reverse" only matches the Reverse ETL tracks; any other name never
does, so "Lakehouse" means the Build Forward track.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from . import engine

TRACK_DISPLAY_NAMES: dict[str, str] = {
    "app-only": "Databricks Apps",
    "app-database": "Databricks Apps + Lakebase",
    "lakehouse": "Lakehouse",
    "lakehouse-di": "Lakehouse + AI and Agents",
    "end-to-end": "Complete Workshop",
    "accelerator": "Data Product Accelerator",
    "genie-accelerator": "Genie Accelerator",
    "data-engineering-accelerator": "Data Engineering Accelerator",
    "skills-accelerator": "Agent Skills Accelerator",
    "agents-accelerator": "Agents Accelerator",
    "reverse-lakehouse": "Reverse ETL: Lakehouse",
    "reverse-lakehouse-di": "Reverse ETL: Lakehouse + AI and Agents",
    "reverse-lakebase": "Reverse ETL: Lakebase (Synced)",
    "reverse-app": "Reverse ETL: Analytics App",
}

# Other ways learners name a track. Reverse ETL synonyms omit "reverse"/"etl":
# those words only pick the Reverse ETL partition (see _REVERSE_WORDS).
TRACK_SYNONYMS: dict[str, tuple[str, ...]] = {
    "app-only": ("apps", "app", "app only", "apps only", "web app"),
    "app-database": (
        "apps and lakebase", "app and lakebase", "lakebase", "apps and database",
        "app and database", "apps lakebase",
    ),
    "lakehouse": ("medallion", "medallion lakehouse", "bronze silver gold"),
    "lakehouse-di": (
        "lakehouse and ai", "lakehouse ai", "ai and agents", "lakehouse and agents",
        "lakehouse and ai agents",
    ),
    "end-to-end": ("complete", "end to end", "full workshop", "everything"),
    "accelerator": ("data product", "data products"),
    "genie-accelerator": ("genie", "genie code accelerator", "genie ontology"),
    "data-engineering-accelerator": ("data engineering", "de accelerator"),
    "skills-accelerator": ("agent skills", "skills", "skills accelerator", "data contract skill"),
    "agents-accelerator": ("agents", "agent accelerator", "agents only"),
    "reverse-lakehouse": ("", "lakehouse"),
    "reverse-lakehouse-di": ("lakehouse and ai", "ai and agents", "lakehouse and ai and agents"),
    "reverse-lakebase": ("lakebase", "synced", "lakebase synced", "synced tables"),
    "reverse-app": ("app", "analytics app", "analytics"),
}

_REVERSE_WORDS = frozenset({"reverse", "etl"})
# Filler a learner adds around a name: "the Genie Accelerator track".
_FILLER_WORDS = frozenset({"the", "a", "track", "path"})
_AND_WORDS = frozenset({"plus", "with", "and"})


@dataclass(frozen=True)
class TrackMatch:
    track: str
    name: str


@dataclass(frozen=True)
class TrackNameError:
    code: str  # UNKNOWN_TRACK | AMBIGUOUS_TRACK
    message: str


# The web UI's start line: "Start a workshop track: <name> (session <id>)". An
# agent may pass all of it as the track; the prefix and the id are taken off.
_START_PREFIX = re.compile(r"^\s*start\s+(?:a\s+)?(?:workshop\s+)?track\s*[:\-]?\s*", re.IGNORECASE)
_SESSION_PART = re.compile(r"\(?\s*\bsession(?:\s+id)?\s*[:#]?\s*([0-9a-f]{8}-[0-9a-f-]{27,})\s*\)?", re.IGNORECASE)


def parse_start_line(text: str | None) -> tuple[str, str | None]:
    """Split a start line into (track text, session id or None)."""

    if not text:
        return "", None
    session = _SESSION_PART.search(text)
    track_text = _SESSION_PART.sub(" ", text) if session else text
    track_text = _START_PREFIX.sub("", track_text).strip()
    return track_text, session.group(1).lower() if session else None


def display_name(track: str) -> str:
    """The standalone name of a track (the manifest title for an unlisted id)."""

    return TRACK_DISPLAY_NAMES.get(track) or engine.MANIFEST.tracks[track].title


def _words(text: str) -> list[str]:
    text = text.lower().replace("&", " and ").replace("+", " and ")
    words = re.sub(r"[^a-z0-9]+", " ", text).split()
    words = ["and" if word in _AND_WORDS else word for word in words]
    words = [word for word in words if word not in _FILLER_WORDS]
    while words and words[0] == "and":
        words.pop(0)
    while words and words[-1] == "and":
        words.pop()
    return words


def normalize(text: str) -> str:
    """Lowercase, "+"/"&"/"plus"/"with" as "and", no punctuation or filler words."""

    return " ".join(_words(text))


def _core(words: list[str]) -> list[str]:
    return [word for word in words if word not in _REVERSE_WORDS]


def _is_reverse(track: str) -> bool:
    return track.startswith("reverse-")


def _keys(track: str) -> set[str]:
    """Every normalized name for ``track``, Reverse ETL ones without reverse/etl."""

    raw = [track.replace("-", " "), display_name(track), *TRACK_SYNONYMS.get(track, ())]
    title = engine.MANIFEST.tracks[track].title
    same_side = [t for t in engine.MANIFEST.tracks if _is_reverse(t) == _is_reverse(track)]
    if sum(engine.MANIFEST.tracks[t].title == title for t in same_side) == 1:
        raw.append(title)
    keys = set()
    for name in raw:
        words = _words(name)
        keys.add(" ".join(_core(words) if _is_reverse(track) else words))
    return keys


def _word_set(key: str) -> frozenset[str]:
    return frozenset(word for word in key.split() if word != "and")


def valid_tracks_text() -> str:
    """'Genie Accelerator (genie-accelerator), …' for error messages and prompts."""

    return ", ".join(f"{display_name(track)} ({track})" for track in engine.MANIFEST.tracks)


def resolve_track_name(text: str | None) -> TrackMatch | TrackNameError:
    """Resolve a learner's track name (id, name or synonym) to one manifest track."""

    original = text
    text, _session = parse_start_line(text)
    if not text:
        return TrackNameError("UNKNOWN_TRACK", f"Choose a workshop track. Valid tracks: {valid_tracks_text()}.")
    if text in engine.MANIFEST.tracks:
        return TrackMatch(text, display_name(text))
    words = _words(text)
    reverse = bool(_REVERSE_WORDS.intersection(words))
    query = " ".join(_core(words)) if reverse else " ".join(words)
    candidates = [t for t in engine.MANIFEST.tracks if _is_reverse(t) == reverse]
    keyed = {track: _keys(track) for track in candidates}
    matches = [track for track in candidates if query in keyed[track]]
    if not matches:
        query_set = _word_set(query)
        matches = [track for track in candidates if any(_word_set(key) == query_set for key in keyed[track])]
    if len(matches) == 1:
        return TrackMatch(matches[0], display_name(matches[0]))
    if matches:
        options = ", ".join(f"{display_name(track)} ({track})" for track in matches)
        return TrackNameError("AMBIGUOUS_TRACK", f"Workshop track {original!r} matches more than one: {options}. Name one.")
    return TrackNameError("UNKNOWN_TRACK", f"Unknown workshop track: {original}. Valid tracks: {valid_tracks_text()}.")
