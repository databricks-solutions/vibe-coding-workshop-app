"""Phase 3 T2 — engine.outline() vs getFilteredSections() parity harness.

Proves the Python engine (``engine.outline`` over ``manifest.outline_order``)
reproduces the REAL ``getFilteredSections()`` ordered ``sectionTag`` sequence for
all 14 tracks at every legal flag/axis combo.

The golden matrix (``fixtures/golden_outline_matrix.json``) is emitted by the
non-hollow oracle ``scripts/dump_outline_matrix.mjs`` (which runs the real TS
``getFilteredSections`` offline — never ``generate_manifest.py``/``manifest.json``
for the TS truth). Each cell carries ``ts`` (the real TS order), ``engine`` (the
manifest model), and ``status`` (parity | gap).

Guarantees (D-T2-2 "lock the whole relationship"):
  * Expressible cells (default forward, genie flags) are HARD-asserted parity —
    a divergence there is a real drift finding, never papered over.
  * The committed ``engine`` column is re-verified against the LIVE
    ``engine.outline()`` for every cell, so the engine side is not hollow.
  * The committed ``status`` is re-derived and locked, so a gap that drifts or
    becomes accidental parity fails and forces a conscious update.
  * Re-running the node oracle must reproduce the JSON byte-for-byte.
"""

import json
import pathlib
import subprocess
import sys

import pytest

from src.backend.workshop import engine, manifest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
FIX = pathlib.Path(__file__).parent / "fixtures"
MATRIX_PATH = FIX / "golden_outline_matrix.json"
ORACLE = "scripts/dump_outline_matrix.mjs"

MATRIX = json.loads(MATRIX_PATH.read_text(encoding="utf-8"))
CELLS = MATRIX["cells"]
TRACKS = MATRIX["tracks"]


def _fresh(flags=None):
    """A fresh session carrying only the engine-expressible flags."""
    return engine.SessionState(
        completed_gates=[],
        captured_outputs={},
        session_parameters={"flags": flags or {}},
    )


def _engine_tags(track, flags=None):
    return [status.sectionTag for status in engine.outline(track, _fresh(flags))]


def _cells_where(**match):
    return [c for c in CELLS if all(c[k] == v for k, v in match.items())]


# --------------------------------------------------------------------------- #
# T2-B1 — core safety net: 14 tracks at the default forward combo.
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize("track", TRACKS)
def test_default_forward_parity(track):
    """Each of the 14 tracks: engine.outline() at a fresh session equals the
    REAL getFilteredSections() default-forward order. HARD assert — any
    mismatch is a real engine/TS drift finding."""
    cell = _cells_where(track=track, combo="default")
    assert len(cell) == 1, f"missing single default cell for {track}"
    cell = cell[0]
    live = _engine_tags(track)
    assert live == cell["ts"], (
        f"DRIFT: engine.outline({track!r}) != getFilteredSections default order\n"
        f"  engine: {live}\n  ts    : {cell['ts']}"
    )
    assert cell["engine"] == cell["ts"], f"committed default cell not parity for {track}"
    assert cell["status"] == "parity", f"default cell must be parity for {track}"
    assert cell["expressible"] is True


def test_all_14_tracks_have_a_default_cell():
    assert sorted(TRACKS) == sorted(manifest.load_manifest().tracks)
    assert len(TRACKS) == 14
    covered = {c["track"] for c in _cells_where(combo="default")}
    assert covered == set(TRACKS)


# --------------------------------------------------------------------------- #
# T2-B2 — genie flag matrix: the 4 expressible genie-accelerator combos.
# --------------------------------------------------------------------------- #
def test_genie_flag_matrix_parity():
    """genie-accelerator's includeLakehouse / includeGenieOntology flags are the
    only engine-expressible axis beyond track selection. All 4 combos
    (none/+lakehouse/+ontology/+both) must be parity via session flags."""
    genie_cells = _cells_where(track="genie-accelerator")
    expressible = [c for c in genie_cells if c["expressible"]]
    # none(default) + 3 flag combos = 4 expressible cells.
    assert len(expressible) == 4, "expected 4 expressible genie combos"
    for cell in expressible:
        live = _engine_tags("genie-accelerator", cell["flags"])
        assert live == cell["ts"], (
            f"DRIFT: genie combo {cell['combo']} — engine != ts\n"
            f"  engine: {live}\n  ts    : {cell['ts']}"
        )
        assert cell["engine"] == cell["ts"]
        assert cell["status"] == "parity", cell["combo"]


# --------------------------------------------------------------------------- #
# T2-B (superset lock) — every expressible cell is parity, and the whole
# committed relationship (engine column + status) matches the LIVE engine.
# --------------------------------------------------------------------------- #
def test_every_expressible_cell_is_parity():
    """No expressible cell may be a gap. This subsumes B1/B2 and is the drift
    tripwire across the entire expressible surface."""
    for cell in CELLS:
        if not cell["expressible"]:
            continue
        live = _engine_tags(cell["track"], cell["flags"])
        assert live == cell["ts"], (
            f"DRIFT in expressible cell {cell['track']}/{cell['combo']}:\n"
            f"  engine: {live}\n  ts    : {cell['ts']}"
        )
        assert cell["status"] == "parity", f"{cell['track']}/{cell['combo']}"


def test_committed_matrix_matches_live_engine():
    """Lock the whole relationship: for EVERY cell the committed engine column
    must equal the real engine.outline() (non-hollow), and the committed status
    must equal the freshly re-derived parity verdict. A gap that drifts or turns
    into accidental parity fails here and forces a conscious matrix update."""
    for cell in CELLS:
        live = _engine_tags(cell["track"], cell["flags"])
        assert live == cell["engine"], (
            f"committed engine column stale for {cell['track']}/{cell['combo']}:\n"
            f"  committed: {cell['engine']}\n  live     : {live}"
        )
        expected = "parity" if cell["ts"] == cell["engine"] else "gap"
        assert cell["status"] == expected, (
            f"committed status wrong for {cell['track']}/{cell['combo']}: "
            f"{cell['status']} != {expected}"
        )


# --------------------------------------------------------------------------- #
# T2-B3 — gap enumeration is non-hollow: every gap cell carries a concrete,
# non-empty TS-vs-engine difference, and the un-expressible axes are all present.
# --------------------------------------------------------------------------- #
def test_gap_cells_carry_a_concrete_diff():
    gaps = _cells_where(status="gap")
    assert gaps, "expected gap cells scoping T3"
    for cell in gaps:
        assert cell["expressible"] is False, cell["combo"]
        # A gap means the engine (forward model) does not reproduce the TS order.
        assert cell["ts"] != cell["engine"], (
            f"{cell['track']}/{cell['combo']} marked gap but ts == engine"
        )
        only_ts = [t for t in cell["ts"] if t not in cell["engine"]]
        only_engine = [t for t in cell["engine"] if t not in cell["ts"]]
        reordered = (
            not only_ts and not only_engine and cell["ts"] != cell["engine"]
        )
        assert only_ts or only_engine or reordered, (
            f"{cell['track']}/{cell['combo']} gap with no derivable diff"
        )


def test_all_unexpressible_axes_are_enumerated():
    """The T3 reconciliation list must cover every axis the engine can't express:
    direction=reverse, additive-chain climb, AI-module and medallion sub-toggles."""
    gap_axes = {c["axis"] for c in _cells_where(status="gap")}
    for axis in ("direction", "climb", "ai-modules", "medallion"):
        assert axis in gap_axes, f"missing gap axis {axis!r} in the matrix"


# --------------------------------------------------------------------------- #
# T2-B5 — completeness: every legal combo family is present for its tracks.
# --------------------------------------------------------------------------- #
def test_matrix_covers_every_legal_combo():
    combos_by_track = {}
    for cell in CELLS:
        combos_by_track.setdefault(cell["track"], set()).add(cell["combo"])

    # genie-accelerator: default + 3 flag combos.
    assert {
        "default",
        "flags:includeLakehouse",
        "flags:includeGenieOntology",
        "flags:includeLakehouse+includeGenieOntology",
    } <= combos_by_track["genie-accelerator"]

    # additive-chain climb offered on lakehouse / lakehouse-di only.
    for track in ("lakehouse", "lakehouse-di"):
        assert "climb:app" in combos_by_track[track], track

    # direction=reverse offered on the reverse column + end-to-end.
    for track in (
        "reverse-lakehouse",
        "reverse-lakehouse-di",
        "reverse-lakebase",
        "reverse-app",
        "end-to-end",
    ):
        assert "direction:reverse" in combos_by_track[track], track

    # AI-module sub-toggles: at least one ai-off:* combo per AI-module level.
    for track in (
        "lakehouse-di",
        "end-to-end",
        "accelerator",
        "reverse-lakehouse-di",
        "reverse-lakebase",
        "reverse-app",
    ):
        assert any(c.startswith("ai-off:") for c in combos_by_track[track]), track
        assert "ai-off:all" in combos_by_track[track], track

    # Medallion sub-toggles on every medallion-toggle level.
    for track in (
        "lakehouse",
        "lakehouse-di",
        "end-to-end",
        "accelerator",
        "data-engineering-accelerator",
        "reverse-lakehouse",
        "reverse-lakehouse-di",
        "reverse-lakebase",
        "reverse-app",
    ):
        assert "medallion:gold-off" in combos_by_track[track], track
        assert "medallion:silver+gold-off" in combos_by_track[track], track


# --------------------------------------------------------------------------- #
# T2-B4 — the oracle is real: re-running the node dump reproduces the golden
# matrix byte-for-byte (mirrors test_manifest_regeneration_is_byte_identical).
# --------------------------------------------------------------------------- #
def test_oracle_regeneration_is_byte_identical():
    """Re-run scripts/dump_outline_matrix.mjs and assert the committed JSON is
    byte-for-byte what the REAL getFilteredSections oracle emits — proving the
    ts column was not hand-authored. Skips only if node is unavailable offline;
    the parse/coverage guarantees above still run unconditionally."""
    before = MATRIX_PATH.read_bytes()
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
    after = MATRIX_PATH.read_bytes()
    assert after == before, (
        "dump_outline_matrix.mjs output differs from the committed "
        "golden_outline_matrix.json — regenerate and commit it "
        f"(node --experimental-strip-types {ORACLE})."
    )
