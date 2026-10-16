"""BE<->FE parity for the track switch (session linking: one engine, two interfaces).

Runs tests/frontend/trackRulesDump.node.mts, which evaluates the REAL TypeScript
names (src/constants/trackNames.ts) and chain helpers (workflowSections.ts), and
asserts the Python ports in track_names.py / track_switch.py give the same answer
for every case, so the MCP switch and the web picker cannot drift apart.
"""

import json
import pathlib
import shutil
import subprocess
import sys

import pytest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.workshop import engine, track_switch  # noqa: E402
from src.backend.workshop.track_names import TRACK_DISPLAY_NAMES  # noqa: E402
from src.backend.workshop.track_resolution import USE_CASE_LEVEL_LOCK  # noqa: E402


@pytest.fixture(scope="module")
def dump():
    node = shutil.which("node")
    if node is None:
        pytest.skip("node not available for BE/FE track-rule parity")
    out = subprocess.run(
        [node, "--experimental-strip-types", "tests/frontend/trackRulesDump.node.mts"],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    ).stdout
    return json.loads(out)


def test_levels_are_the_manifest_tracks(dump):
    assert set(dump["levels"]) == set(engine.MANIFEST.tracks)


def test_display_names_match(dump):
    assert dump["names"] == TRACK_DISPLAY_NAMES


def test_use_case_lock_and_chains_match(dump):
    assert dump["useCaseLock"] == USE_CASE_LEVEL_LOCK
    assert [tuple(chain) for chain in dump["progressionChains"]] == list(track_switch.PROGRESSION_CHAINS)


def test_chain_helpers_match_case_by_case(dump):
    checked = 0
    for case in dump["cases"]:
        if "activeChain" in case:
            got = track_switch.active_chain(case["level"], set(case["steps"]), case["chain"])
            want = tuple(case["activeChain"]) if case["activeChain"] is not None else None
            assert got == want, case
        elif "derived" in case:
            assert track_switch.derive_initial_chain_context(case["level"], set(case["steps"])) == case["derived"], case
        elif "computed" in case:
            got = track_switch.compute_chain_context(case["chain"], case["prevLevel"], case["nextLevel"])
            assert got == case["computed"], case
        else:
            assert track_switch.is_forward_progression(case["from"], case["to"]) == case["forward"], case
        checked += 1
    assert checked == len(dump["cases"]) > 0
