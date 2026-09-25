import json
import pathlib
import subprocess
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.workshop import manifest


FIX = pathlib.Path(__file__).parent / "fixtures"

# Independent oracle: `scripts/dump_getfilteredsections.mjs` executes the real
# `getFilteredSections` from `src/constants/workflowSections.ts` and writes the
# resulting `define-usecase` sectionTag order for every track. Asserting the
# generated manifest against this fixture keeps the check honest (TS source is
# the oracle) instead of comparing manifest.json against itself.
DEFINE_USECASE_BY_TRACK = json.loads(
    (FIX / "golden_define_usecase_by_track.json").read_text()
)

# The four opt-in Genie lakehouse steps (mirrors GENIE_LAKEHOUSE_TAGS in
# workflowSections.ts and the includeLakehouse flag in the manifest).
LAKEHOUSE_TAGS = (
    "genie_silver_metadata",
    "gold_layer_design",
    "gold_layer_pipeline",
    "deploy_lakehouse_assets",
)

# The subset of lakehouse steps that ALSO appear in non-genie tracks
# (genie_silver_metadata is genie-only). The includeLakehouse flag is
# genie-accelerator-scoped (D3 §3.3), so these must never be flag-stamped in
# another track — stamping there would make outline_order drop them (unknown
# flag -> default False), a cross-track regression the genie-only fixtures miss.
SHARED_LAKEHOUSE_TAGS = (
    "gold_layer_design",
    "gold_layer_pipeline",
    "deploy_lakehouse_assets",
)


def _ordered_tags(steps):
    return [step.sectionTag for step in steps]


def _define_usecase_tags(loaded, track_id):
    track = loaded.tracks[track_id]
    section = next(section for section in track.sections if section.id == "define-usecase")
    return _ordered_tags(section.steps)


def _step_by_tag(loaded, track_id, section_tag):
    return next(
        step for step in loaded.track_steps(track_id) if step.sectionTag == section_tag
    )


def test_order_parity_default_flags():
    loaded = manifest.load_manifest()
    got = _ordered_tags(loaded.outline_order("genie-accelerator", flags={}))
    want = json.loads((FIX / "golden_order_genie_default.json").read_text())
    assert got == want
    # The lakehouse chapter is opt-in (default OFF): none of its steps appear.
    assert not any(tag in LAKEHOUSE_TAGS for tag in got)


def test_flag_parity_ontology_on_reintroduces_tags_in_position():
    loaded = manifest.load_manifest()
    got = _ordered_tags(
        loaded.outline_order(
            "genie-accelerator", flags={"includeGenieOntology": True}
        )
    )
    want = json.loads((FIX / "golden_order_genie_ontology_on.json").read_text())
    assert got == want
    assert any(tag.startswith("ontology_") for tag in got)
    # Enabling ontology must not pull in the independent lakehouse chapter.
    assert not any(tag in LAKEHOUSE_TAGS for tag in got)
    default = json.loads((FIX / "golden_order_genie_default.json").read_text())
    assert not any(tag.startswith("ontology_") for tag in default)


def test_flag_parity_lakehouse_on_reintroduces_tags_in_position():
    loaded = manifest.load_manifest()
    got = _ordered_tags(
        loaded.outline_order(
            "genie-accelerator", flags={"includeLakehouse": True}
        )
    )
    want = json.loads((FIX / "golden_order_genie_lakehouse_on.json").read_text())
    assert got == want
    assert all(tag in got for tag in LAKEHOUSE_TAGS)
    # Enabling lakehouse must not pull in the independent ontology chapter.
    assert not any(tag.startswith("ontology_") for tag in got)
    default = json.loads((FIX / "golden_order_genie_default.json").read_text())
    assert not any(tag in LAKEHOUSE_TAGS for tag in default)


def test_lakehouse_flag_is_genie_scoped_only():
    """Regression guard (D3 §3.3 track-scoped stamping): the includeLakehouse flag
    and its per-step stamping are confined to genie-accelerator. Shared lakehouse
    steps that also live in other tracks must stay unflagged (flag is None) and
    present in those tracks' default outline — otherwise the genie-only toggle
    would silently drop them cross-track. The genie-accelerator parity fixtures
    do not cover other tracks, so this is the only guard for that regression."""
    loaded = manifest.load_manifest()

    # Only genie-accelerator defines the flag.
    for track_id, track in loaded.tracks.items():
        if track_id == "genie-accelerator":
            assert "includeLakehouse" in track.flags
        else:
            assert "includeLakehouse" not in track.flags, track_id

    # In every non-genie track, any shared lakehouse step is unstamped and stays
    # in the default outline (default flags = nothing dropped for these).
    saw_shared_elsewhere = False
    for track_id in loaded.tracks:
        if track_id == "genie-accelerator":
            continue
        default_tags = set(_ordered_tags(loaded.outline_order(track_id, flags={})))
        for step in loaded.track_steps(track_id):
            if step.sectionTag in SHARED_LAKEHOUSE_TAGS:
                saw_shared_elsewhere = True
                assert step.flag is None, (track_id, step.sectionTag, step.flag)
                assert step.sectionTag in default_tags, (track_id, step.sectionTag)

    # Positive control: the shared tags really do appear in >=1 non-genie track,
    # so the assertions above are not vacuously satisfied.
    assert saw_shared_elsewhere


# --- Phase 2B / D11: use_case_selection in the Genie Accelerator define-usecase ---


def test_genie_define_usecase_has_use_case_selection_before_prd():
    """Contract 1: genie-accelerator define-usecase contains use_case_selection
    ordered before prd_generation, and it produces use_case_brief."""
    loaded = manifest.load_manifest()
    tags = _define_usecase_tags(loaded, "genie-accelerator")
    # Oracle parity: matches what getFilteredSections yields for this track.
    assert tags == DEFINE_USECASE_BY_TRACK["genie-accelerator"]
    assert tags == ["project_setup", "use_case_selection", "prd_generation"]
    assert tags.index("use_case_selection") < tags.index("prd_generation")

    selection = _step_by_tag(loaded, "genie-accelerator", "use_case_selection")
    assert selection.produces == "use_case_brief"


def test_prd_generation_consumes_brief_and_gates_on_selection():
    """Contract 2: prd_generation consumes use_case_brief and gates on use_case_selection."""
    loaded = manifest.load_manifest()
    prd = _step_by_tag(loaded, "genie-accelerator", "prd_generation")
    assert "use_case_brief" in prd.consumes
    assert prd.requiresGate == "use_case_selection"


def test_use_case_selection_chains_gate_to_project_setup():
    """Contract 3: use_case_selection chains its gate to the preceding project_setup."""
    loaded = manifest.load_manifest()
    selection = _step_by_tag(loaded, "genie-accelerator", "use_case_selection")
    assert selection.requiresGate == "project_setup"


def test_non_genie_tracks_define_usecase_unchanged():
    """Contract 4: non-genie tracks keep define-usecase == [project_setup, prd_generation]
    with use_case_selection absent. Asserted on two other tracks."""
    loaded = manifest.load_manifest()
    for track_id in ("app-only", "lakehouse"):
        tags = _define_usecase_tags(loaded, track_id)
        # Oracle parity from getFilteredSections for this track.
        assert tags == DEFINE_USECASE_BY_TRACK[track_id], track_id
        assert tags == ["project_setup", "prd_generation"], track_id
        assert "use_case_selection" not in tags, track_id


def test_manifest_regeneration_is_byte_identical():
    """Contract 5: re-running the generator changes nothing — the committed
    manifest.json is byte-for-byte what generate_manifest.py emits, so no hand
    edit has drifted from the TS source. Compared directly (not via `git diff`)
    so the check is deterministic and independent of working-tree/commit state.
    """
    manifest_path = REPO_ROOT / "src/backend/workshop/manifest.json"
    before = manifest_path.read_bytes()
    subprocess.run(
        [sys.executable, "scripts/generate_manifest.py"],
        cwd=REPO_ROOT,
        check=True,
    )
    after = manifest_path.read_bytes()
    assert after == before, (
        "generate_manifest.py output differs from the committed manifest.json — "
        "regenerate and commit it (a manual edit is overwritten on regen)."
    )
