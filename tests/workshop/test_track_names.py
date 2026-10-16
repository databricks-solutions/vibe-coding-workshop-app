"""Track names a learner can say (track_names.resolve_track_name)."""

import pathlib
import sys
from collections import defaultdict

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.workshop import engine  # noqa: E402
from src.backend.workshop.track_names import (  # noqa: E402
    TRACK_DISPLAY_NAMES,
    TRACK_SYNONYMS,
    TrackMatch,
    TrackNameError,
    _keys,
    display_name,
    normalize,
    resolve_track_name,
)


def _track(text):
    match = resolve_track_name(text)
    assert isinstance(match, TrackMatch), (text, match)
    return match.track


def test_every_track_has_a_display_name():
    assert set(TRACK_DISPLAY_NAMES) == set(engine.MANIFEST.tracks)
    assert set(TRACK_SYNONYMS) <= set(engine.MANIFEST.tracks)


@pytest.mark.parametrize("track", sorted(engine.MANIFEST.tracks))
def test_id_display_name_and_spaced_id_resolve(track):
    assert _track(track) == track
    assert _track(display_name(track)) == track
    assert _track(display_name(track).upper()) == track
    assert _track(track.replace("-", " ")) == track


@pytest.mark.parametrize("track", sorted(engine.MANIFEST.tracks))
def test_every_synonym_resolves_to_its_track(track):
    reverse = track.startswith("reverse-")
    for synonym in TRACK_SYNONYMS.get(track, ()):
        assert _track(f"reverse etl {synonym}" if reverse else synonym) == track, synonym


def test_no_name_belongs_to_two_tracks_on_the_same_side():
    for reverse in (False, True):
        owners = defaultdict(set)
        for track in engine.MANIFEST.tracks:
            if track.startswith("reverse-") == reverse:
                for key in _keys(track):
                    owners[key].add(track)
        assert {key: tracks for key, tracks in owners.items() if len(tracks) > 1} == {}


@pytest.mark.parametrize(
    "text, track",
    [
        ("Genie Accelerator", "genie-accelerator"),
        ("the genie accelerator track", "genie-accelerator"),
        ("genie", "genie-accelerator"),
        ("Apps + Lakebase", "app-database"),
        ("apps & lakebase", "app-database"),
        ("Databricks Apps plus Lakebase", "app-database"),
        ("Lakehouse", "lakehouse"),
        ("lakehouse with AI", "lakehouse-di"),
        ("+ AI and Agents", "lakehouse-di"),
        ("AI and Agents", "lakehouse-di"),
        ("Complete Workshop", "end-to-end"),
        ("end-to-end", "end-to-end"),
        ("Reverse ETL", "reverse-lakehouse"),
        ("reverse etl lakehouse", "reverse-lakehouse"),
        ("Reverse ETL: Lakehouse + AI and Agents", "reverse-lakehouse-di"),
        ("reverse lakebase", "reverse-lakebase"),
        ("Reverse ETL: Analytics App", "reverse-app"),
        ("agents", "agents-accelerator"),
        ("data engineering", "data-engineering-accelerator"),
    ],
)
def test_learner_phrasings(text, track):
    assert _track(text) == track


def test_forward_names_never_pick_a_reverse_track():
    for track in engine.MANIFEST.tracks:
        if not track.startswith("reverse-"):
            continue
        title = engine.MANIFEST.tracks[track].title
        match = resolve_track_name(title)
        assert not (isinstance(match, TrackMatch) and match.track.startswith("reverse-")), title


def test_unknown_name_lists_every_track_by_name_and_id():
    error = resolve_track_name("nope")
    assert isinstance(error, TrackNameError)
    assert error.code == "UNKNOWN_TRACK"
    assert error.message.startswith("Unknown workshop track: nope.")
    for track in engine.MANIFEST.tracks:
        assert f"{display_name(track)} ({track})" in error.message


def test_empty_name_asks_for_a_track():
    for text in (None, "", "   "):
        error = resolve_track_name(text)
        assert isinstance(error, TrackNameError) and error.code == "UNKNOWN_TRACK"


def test_normalize():
    assert normalize("Databricks Apps + Lakebase") == "databricks apps and lakebase"
    assert normalize("Lakehouse with AI & Agents!") == "lakehouse and ai and agents"
    assert normalize("+ AI and Agents") == "ai and agents"
