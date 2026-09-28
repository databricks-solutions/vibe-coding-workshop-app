"""Phase 3 T2/T3a — engine.outline() vs getFilteredSections() parity harness.

Proves the Python engine (``engine.outline`` over ``manifest.outline_order``)
reproduces the REAL ``getFilteredSections()`` ordered ``sectionTag`` sequence for
all 14 tracks at every legal flag/axis combo.

As of Phase 3 T3a the engine composes ALL four axes that were T2 gaps —
direction=reverse (baked into the four reverse-* tracks; a runtime variant on
end-to-end), additive-chain climb (a chainContext variant on lakehouse /
lakehouse-di), and the AI-module + medallion sub-toggles (six default-true
session flags) — so every enumerated cell is expressible and at parity.

The golden matrix (``fixtures/golden_outline_matrix.json``) is emitted by the
non-hollow oracle ``scripts/dump_outline_matrix.mjs`` (which runs the real TS
``getFilteredSections`` offline — never ``generate_manifest.py``/``manifest.json``
for the TS truth). Each cell carries ``ts`` (the real TS order), ``engine`` (the
manifest model), ``status`` (parity | gap), and the engine inputs (``flags`` plus
``direction`` / ``chainContext``) that reproduce its TS order.

Guarantees (D-T2-2 "lock the whole relationship"):
  * Every cell is HARD-asserted parity — a divergence is a real drift finding,
    never papered over.
  * The committed ``engine`` column is re-verified against the LIVE
    ``engine.outline()`` (using each cell's recorded inputs) for every cell, so
    the engine side is not hollow.
  * The committed ``status`` is re-derived and locked, so a regression to a gap
    fails and forces a conscious update.
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


def _fresh(flags=None, direction=None, chainContext=None):
    """A fresh session carrying the engine-expressible inputs for one cell:
    sub-toggle / genie ``flags`` plus the composition inputs (``direction`` /
    ``chainContext``) the engine reads from session_parameters to select a
    variant. Absent inputs => the default (baked) composition."""
    params = {"flags": flags or {}}
    if direction is not None:
        params["direction"] = direction
    if chainContext is not None:
        params["chainContext"] = chainContext
    return engine.SessionState(
        completed_gates=[],
        captured_outputs={},
        session_parameters=params,
    )


def _engine_tags(track, flags=None, direction=None, chainContext=None):
    session = _fresh(flags, direction, chainContext)
    return [status.sectionTag for status in engine.outline(track, session)]


def _engine_tags_for_cell(cell):
    return _engine_tags(
        cell["track"],
        cell.get("flags"),
        cell.get("direction"),
        cell.get("chainContext"),
    )


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
    tripwire across the entire expressible surface. Each cell is re-computed via
    the LIVE engine using its recorded inputs (flags + direction/chainContext)."""
    for cell in CELLS:
        if not cell["expressible"]:
            continue
        live = _engine_tags_for_cell(cell)
        assert live == cell["ts"], (
            f"DRIFT in expressible cell {cell['track']}/{cell['combo']}:\n"
            f"  engine: {live}\n  ts    : {cell['ts']}"
        )
        assert cell["status"] == "parity", f"{cell['track']}/{cell['combo']}"


def test_committed_matrix_matches_live_engine():
    """Lock the whole relationship: for EVERY cell the committed engine column
    must equal the real engine.outline() (non-hollow) computed from the cell's
    recorded inputs, and the committed status must equal the freshly re-derived
    parity verdict. A drift or a regression to a gap fails here and forces a
    conscious matrix update."""
    for cell in CELLS:
        live = _engine_tags_for_cell(cell)
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
# T3a — the four former gap axes are now engine-composed: zero gaps, zero
# non-expressible cells, and each axis reproduces the REAL getFilteredSections
# order via engine inputs (flags + direction/chainContext).
# --------------------------------------------------------------------------- #
def test_no_gap_cells_remain():
    """T3a exit gate: every enumerated cell is engine-expressible and at parity —
    zero gaps across the whole matrix."""
    gaps = _cells_where(status="gap")
    assert gaps == [], f"unexpected gap cells after T3a: {[(c['track'], c['combo']) for c in gaps]}"
    not_expressible = [c for c in CELLS if not c["expressible"]]
    assert not_expressible == [], (
        f"unexpected non-expressible cells: {[(c['track'], c['combo']) for c in not_expressible]}"
    )


def test_four_axes_fully_expressible_and_parity():
    """The four T3 axes (direction, climb, ai-modules, medallion) are each present
    in the matrix and every one of their cells is expressible + parity via the
    LIVE engine."""
    for axis in ("direction", "climb", "ai-modules", "medallion"):
        axis_cells = _cells_where(axis=axis)
        assert axis_cells, f"axis {axis!r} vanished from the matrix"
        for cell in axis_cells:
            assert cell["expressible"] is True, f"{cell['track']}/{cell['combo']} not expressible"
            live = _engine_tags_for_cell(cell)
            assert live == cell["ts"] == cell["engine"], (
                f"{axis} cell {cell['track']}/{cell['combo']} not parity:\n"
                f"  engine: {live}\n  ts    : {cell['ts']}"
            )


def test_direction_reverse_is_composed_for_every_reverse_track():
    """AXIS 1: the four reverse-* tracks bake reverse into their default outline
    (direction input is a no-op), and end-to-end selects a reverse VARIANT. Every
    direction:reverse cell reproduces the REAL reverse getFilteredSections order."""
    direction_cells = _cells_where(axis="direction")
    covered = {c["track"] for c in direction_cells}
    assert covered == {
        "reverse-lakehouse",
        "reverse-lakehouse-di",
        "reverse-lakebase",
        "reverse-app",
        "end-to-end",
    }, covered
    for cell in direction_cells:
        assert cell["direction"] == "reverse", cell["track"]
        assert _engine_tags_for_cell(cell) == cell["ts"], cell["track"]

    # The four reverse-* tracks are intrinsically reverse: their default cell (no
    # inputs) already equals their direction:reverse cell.
    for track in ("reverse-lakehouse", "reverse-lakehouse-di", "reverse-lakebase", "reverse-app"):
        default_cell = _cells_where(track=track, combo="default")[0]
        reverse_cell = _cells_where(track=track, combo="direction:reverse")[0]
        assert default_cell["ts"] == reverse_cell["ts"], track
        assert _engine_tags(track) == reverse_cell["ts"], track


def test_climb_reads_chaincontext_variant():
    """AXIS 2: lakehouse / lakehouse-di re-admit the app+lakebase chain when the
    engine reads chainContext='app' (a manifest variant), matching the REAL
    getCumulativeOverrides-driven getFilteredSections order."""
    climb_cells = _cells_where(axis="climb")
    assert {c["track"] for c in climb_cells} == {"lakehouse", "lakehouse-di"}
    for cell in climb_cells:
        assert cell["chainContext"] == "app", cell["track"]
        # The variant only fires with the chainContext input; the bare default
        # (standalone) outline must be SHORTER (no app/lakebase re-admission).
        assert _engine_tags_for_cell(cell) == cell["ts"]
        standalone = _engine_tags(cell["track"])
        assert len(standalone) < len(cell["ts"]), cell["track"]


def test_compound_reverse_x_subtoggle_is_covered_and_parity():
    """Compound reverse x sub-toggle: the reverse-* tracks' AI-module / medallion
    cells are computed at the reverse baseline, so they ARE compound cells. Assert
    coverage exists and every compound cell is parity via the LIVE engine."""
    reverse_tracks = {"reverse-lakehouse", "reverse-lakehouse-di", "reverse-lakebase", "reverse-app"}
    compound = [
        c for c in CELLS
        if c["track"] in reverse_tracks and c["axis"] in ("ai-modules", "medallion")
    ]
    assert compound, "expected compound reverse x sub-toggle cells"
    # Every reverse track that supports a sub-toggle contributes at least one.
    for track in reverse_tracks:
        assert any(c["track"] == track for c in compound), f"no compound cell for {track}"
    for cell in compound:
        assert cell["expressible"] is True
        assert _engine_tags_for_cell(cell) == cell["ts"] == cell["engine"], (
            f"compound {cell['track']}/{cell['combo']} not parity"
        )


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
