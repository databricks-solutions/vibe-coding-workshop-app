"""Phase 3 T4a — preview-path vs getFilteredSections parity harness.

The /config/test-scenario sandbox no longer calls getFilteredSections for its step
ORDER. It now fetches engine.outline() from the session-less preview endpoint and
applies its effectiveDisabledTags as a CLIENT-SIDE filter, exactly as
orderedSectionsForRead does for the production read path. This suite proves that
REBUILT path is byte-identical to the OLD getFilteredSections path across every
engine-expressible sandbox cell, and asserts the ONE thing the rebuild deliberately
drops — getFilteredSections' client-side reverse on variant-less tracks.

Non-hollow, both sides LIVE (getFilteredSections still exists in this PR; it is
retired in T4b):
  * ``gfs`` is the REAL getFilteredSections output, emitted by the node oracle
    ``scripts/dump_preview_parity.mjs`` (which runs the real TS offline). Never a
    hand-authored list.
  * ``previewTags`` (the manifest engine model in the oracle) is RE-VERIFIED here
    against the LIVE Python ``engine.outline()`` for every cell, so the engine side
    is not hollow either.
  * ``rebuilt`` == ``clientFilter(previewTags, effectiveDisabledTags)`` is asserted
    == ``gfs`` for every parity cell.
  * Re-running the node oracle must reproduce the committed JSON byte-for-byte
    (proving the ts/gfs column was not hand-authored).
"""

import json
import pathlib
import subprocess

import pytest

from src.backend.workshop import engine


REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
FIX = pathlib.Path(__file__).parent / "fixtures"
GOLDEN_PATH = FIX / "golden_preview_parity.json"
ORACLE = "scripts/dump_preview_parity.mjs"

GOLDEN = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))
PARITY = GOLDEN["parity"]
DIVERGENCE = GOLDEN["divergence"]

# The tracks the sandbox may preview in reverse (mirrors VARIANT_REVERSE_TRACKS /
# REVERSE_INTRINSIC_TRACKS in TestScenarioConfig.tsx).
REVERSE_INTRINSIC_TRACKS = {
    "reverse-lakehouse",
    "reverse-lakehouse-di",
    "reverse-lakebase",
    "reverse-app",
}
VARIANT_REVERSE_TRACKS = {"end-to-end"} | REVERSE_INTRINSIC_TRACKS


def _engine_tags(track, *, direction, flags):
    """Re-run the LIVE Python engine.outline exactly as the preview ENDPOINT does:
    a bare SessionState carrying the inline direction + flags."""
    params = {}
    if direction is not None:
        params["direction"] = direction
    if flags is not None:
        params["flags"] = flags
    state = engine.SessionState(session_parameters=params)
    return [status.sectionTag for status in engine.outline(track, state)]


def _client_filter(tags, disabled):
    """The sandbox's client-side filter — the identical tag-level drop that
    orderedSectionsForRead applies (workflowSections.ts:954-955)."""
    disabled = set(disabled)
    return [t for t in tags if t not in disabled]


# --------------------------------------------------------------------------- #
# The core safety net: for EVERY parity cell, the rebuilt preview path
# (engine order + client-side effectiveDisabledTags filter) is byte-identical to
# the REAL getFilteredSections output. Non-hollow: previewTags is re-derived from
# the LIVE engine, then the filter is re-applied here — nothing trusts the oracle's
# own `rebuilt` blindly.
# --------------------------------------------------------------------------- #
def test_every_parity_cell_is_byte_identical_to_getfilteredsections():
    assert PARITY, "expected a non-empty parity matrix"
    for cell in PARITY:
        # (1) LIVE engine reproduces the committed previewTags (engine not hollow).
        live = _engine_tags(
            cell["track"], direction=cell["direction"], flags=cell["flags"]
        )
        assert live == cell["previewTags"], (
            f"engine.outline drift for {cell['track']}/{cell['direction']}/"
            f"{cell['combo']}/{cell['tail']}:\n  live : {live}\n  golden: {cell['previewTags']}"
        )
        # (2) client-filter the LIVE engine order by the cell's effectiveDisabledTags.
        rebuilt = _client_filter(live, cell["disabledTags"])
        assert rebuilt == cell["rebuilt"], "oracle rebuilt column stale vs live re-filter"
        # (3) BYTE-IDENTITY: rebuilt == REAL getFilteredSections.
        assert rebuilt == cell["gfs"], (
            f"PARITY BREAK {cell['track']}/{cell['direction']}/{cell['combo']}/{cell['tail']}:\n"
            f"  rebuilt: {rebuilt}\n  gfs    : {cell['gfs']}"
        )


# --------------------------------------------------------------------------- #
# Coverage: the matrix spans every track and both tail-toggle scenarios, and only
# offers reverse where a track can express it.
# --------------------------------------------------------------------------- #
def test_matrix_covers_every_track_and_tail_scenario():
    from src.backend.workshop import manifest

    tracks = set(manifest.load_manifest().tracks)
    covered = {c["track"] for c in PARITY}
    assert covered == tracks, f"missing tracks: {tracks - covered}"

    tails = {c["tail"] for c in PARITY}
    assert {"tails-off", "tails-on"} <= tails

    # tails-off (the DEFAULT sandbox — both opt-ins off) filters the tail sections.
    default_cell = next(
        c for c in PARITY if c["track"] == "end-to-end" and c["combo"] == "default"
        and c["tail"] == "tails-off" and c["direction"] == "forward"
    )
    for tag in ("workspace_cleanup", "iterate_enhance", "redeploy_test"):
        assert tag in default_cell["disabledTags"]
        assert tag not in default_cell["rebuilt"]


def test_reverse_cells_only_on_variant_reverse_tracks():
    for cell in PARITY:
        if cell["direction"] == "reverse":
            assert cell["track"] in VARIANT_REVERSE_TRACKS, cell["track"]
    # And every reverse-intrinsic track is previewed ONLY in reverse.
    for track in REVERSE_INTRINSIC_TRACKS:
        dirs = {c["direction"] for c in PARITY if c["track"] == track}
        assert dirs == {"reverse"}, f"{track} previewed at {dirs}, expected reverse-only"
    # end-to-end is previewed BOTH forward and reverse.
    e2e_dirs = {c["direction"] for c in PARITY if c["track"] == "end-to-end"}
    assert e2e_dirs == {"forward", "reverse"}


def test_arbitrary_assistant_hide_tags_flow_through_client_filter():
    """GAP A: per-assistant disabled tags map to NO engine flag — the engine KEEPS
    them and the client filter must drop them exactly as getFilteredSections does."""
    cell = next(c for c in PARITY if c["combo"] == "assistant-hides")
    # The arbitrary tags are present in the engine order (not dropped structurally)...
    for tag in cell["extraDisabled"]:
        assert tag in cell["previewTags"], tag
        # ...but gone from the rebuilt output (dropped by the client filter)...
        assert tag not in cell["rebuilt"], tag
    # ...and rebuilt still equals the REAL getFilteredSections with those tags.
    assert cell["rebuilt"] == cell["gfs"]


# --------------------------------------------------------------------------- #
# POSITIVE DIVERGENCE ASSERTION (required by the human gate): on a variant-less
# track, engine.outline returns the FORWARD order while getFilteredSections applies
# its client-side reverse. This is the INTENTIONALLY-RETIRED branch — the rebuilt
# sandbox never sends reverse for these tracks (B1), so it is deliberately dropped.
# The harness shows BOTH what is preserved (byte-identity above) AND what is
# dropped (here).
# --------------------------------------------------------------------------- #
def test_variant_less_reverse_diverges_documenting_the_retired_branch():
    assert DIVERGENCE, "expected at least one documented divergence cell"
    for cell in DIVERGENCE:
        track = cell["track"]
        assert track not in VARIANT_REVERSE_TRACKS, track
        # The engine has no reverse variant here: reverse == forward (a no-op).
        live_reverse = _engine_tags(track, direction="reverse", flags=cell["flags"])
        live_forward = _engine_tags(track, direction="forward", flags=cell["flags"])
        assert live_reverse == live_forward == cell["previewReverse"], track
        # getFilteredSections DOES client-reverse — the retired branch — so it
        # genuinely differs from the engine's forward order.
        assert live_reverse != cell["gfsReverse"], (
            f"expected divergence for {track}: engine forward vs GFS client-reverse"
        )
        assert cell["previewReverse"] == cell["previewForward"] != cell["gfsReverse"]


# --------------------------------------------------------------------------- #
# The oracle is real: re-running the node dump reproduces the committed golden
# byte-for-byte (mirrors test_outline_parity.test_oracle_regeneration_is_byte_identical).
# --------------------------------------------------------------------------- #
def test_oracle_regeneration_is_byte_identical():
    before = GOLDEN_PATH.read_bytes()
    try:
        subprocess.run(
            ["node", "--experimental-strip-types", ORACLE],
            cwd=REPO_ROOT,
            check=True,
            capture_output=True,
        )
    except FileNotFoundError:
        pytest.skip(
            "node not available offline; regenerate with: "
            f"node --experimental-strip-types {ORACLE}"
        )
    after = GOLDEN_PATH.read_bytes()
    assert after == before, (
        "dump_preview_parity.mjs output differs from the committed "
        "golden_preview_parity.json — regenerate and commit it "
        f"(node --experimental-strip-types {ORACLE})."
    )
