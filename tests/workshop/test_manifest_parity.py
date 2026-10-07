import json
import pathlib
import subprocess
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.workshop import manifest


FIX = pathlib.Path(__file__).parent / "fixtures"

# Frozen reference: `golden_define_usecase_by_track.json` was captured from the
# real `getFilteredSections` (`src/constants/workflowSections.ts`) while that
# function was still live — it recorded the `define-usecase` sectionTag order for
# every track. `getFilteredSections` and its node oracle were RETIRED in Phase 3
# T4b, so this golden is now a FROZEN, hand-independent reference. Asserting the
# generated manifest against it keeps the check honest (an external reference)
# instead of comparing manifest.json against itself.
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
    (default OFF) is confined to genie-accelerator. Shared lakehouse steps that
    also live in other tracks must NOT carry includeLakehouse and must stay in
    those tracks' default outline — otherwise the genie-only OFF-by-default toggle
    would silently drop them cross-track. The genie-accelerator parity fixtures do
    not cover other tracks, so this is the only guard for that regression.

    Phase 3 T3a: gold_layer_design / gold_layer_pipeline now carry the default-TRUE
    ``medallion.gold`` flag on medallion-toggle tracks. That is safe (default true =
    present unless the learner opts out) and is NOT the leak this test guards, so
    the assertion is on the specific includeLakehouse flag, not "flag is None".
    ``deploy_lakehouse_assets`` maps to no sub-toggle and stays unflagged."""
    loaded = manifest.load_manifest()

    # Only genie-accelerator defines the flag.
    for track_id, track in loaded.tracks.items():
        if track_id == "genie-accelerator":
            assert "includeLakehouse" in track.flags
        else:
            assert "includeLakehouse" not in track.flags, track_id

    # In every non-genie track, any shared lakehouse step never carries the
    # genie-scoped includeLakehouse flag and stays in the default outline (its own
    # sub-toggle, if any, is default ON so nothing is dropped by default).
    saw_shared_elsewhere = False
    for track_id in loaded.tracks:
        if track_id == "genie-accelerator":
            continue
        default_tags = set(_ordered_tags(loaded.outline_order(track_id, flags={})))
        for step in loaded.track_steps(track_id):
            if step.sectionTag in SHARED_LAKEHOUSE_TAGS:
                saw_shared_elsewhere = True
                assert step.flag != "includeLakehouse", (track_id, step.sectionTag, step.flag)
                assert step.sectionTag in default_tags, (track_id, step.sectionTag)

    # Positive control: the shared tags really do appear in >=1 non-genie track,
    # so the assertions above are not vacuously satisfied.
    assert saw_shared_elsewhere


# --- Phase 2B / D11: use_case_selection in the Genie Accelerator define-usecase ---


def test_genie_define_usecase_is_project_setup_then_prd_no_numbered_selection():
    """Contract 1 (ghost retirement): genie-accelerator define-usecase is
    [project_setup, prd_generation] — use_case_selection is NO LONGER a numbered
    outline step. Use-case capture is a pre-journey intent beat resolved up front
    (mirroring App step 1 / the MCP engine's resolve_use_case)."""
    loaded = manifest.load_manifest()
    tags = _define_usecase_tags(loaded, "genie-accelerator")
    # Frozen-reference parity: matches the captured getFilteredSections order for this track.
    assert tags == DEFINE_USECASE_BY_TRACK["genie-accelerator"]
    assert tags == ["project_setup", "prd_generation"]
    assert "use_case_selection" not in tags


def test_prd_generation_consumes_brief_and_gates_on_selection():
    """Contract 2 (LOCKED unchanged): prd_generation still consumes use_case_brief
    and still gates on use_case_selection — the gate is resolved pre-journey, so
    this contract is preserved exactly even though use_case_selection is no longer
    a numbered step. (requiresGate is pinned by GENIE_REQUIRES_GATE_OVERRIDES.)"""
    loaded = manifest.load_manifest()
    prd = _step_by_tag(loaded, "genie-accelerator", "prd_generation")
    assert "use_case_brief" in prd.consumes
    assert prd.requiresGate == "use_case_selection"


def test_use_case_selection_is_not_a_numbered_step_on_any_track():
    """Contract 3 (ghost retirement): use_case_selection appears as a numbered step
    in NO track's outline — it was retired everywhere, not just visually hidden.
    Its gate string stays valid (resolved pre-journey) but never surfaces a node."""
    loaded = manifest.load_manifest()
    for track_id in loaded.tracks:
        tags = [step.sectionTag for step in loaded.track_steps(track_id)]
        assert "use_case_selection" not in tags, track_id
    # And no numbered step produces the use_case_brief artifact (pre-journey only).
    genie_producers = [
        step.sectionTag
        for step in loaded.track_steps("genie-accelerator")
        if step.produces == "use_case_brief"
    ]
    assert genie_producers == []


def test_non_genie_tracks_define_usecase_unchanged():
    """Contract 4: non-genie tracks keep define-usecase == [project_setup, prd_generation]
    with use_case_selection absent. Asserted on two other tracks."""
    loaded = manifest.load_manifest()
    for track_id in ("app-only", "lakehouse"):
        tags = _define_usecase_tags(loaded, track_id)
        # Frozen-reference parity from the captured getFilteredSections order for this track.
        assert tags == DEFINE_USECASE_BY_TRACK[track_id], track_id
        assert tags == ["project_setup", "prd_generation"], track_id
        assert "use_case_selection" not in tags, track_id


def test_app_family_steps_are_all_agent_doable():
    """P4.3 (D-39): every app-only / app-database step is agent-doable in Genie
    Code (judgment table in docs/superpowers/plans/2026-10-06-p4-app-family.md).
    Pinned from both the JSON and the loaded model, per track."""
    loaded = manifest.load_manifest()
    data = json.loads((REPO_ROOT / "src/backend/workshop/manifest.json").read_text())["tracks"]
    for track_id in ("app-only", "app-database"):
        json_steps = [step for section in data[track_id]["sections"] for step in section["steps"]]
        assert json_steps, track_id
        assert {step["sectionTag"]: step["execution"] for step in json_steps} == {
            step["sectionTag"]: "agent-doable" for step in json_steps
        }, track_id
        assert {step.execution for step in loaded.track_steps(track_id)} == {"agent-doable"}, track_id


def test_lakehouse_family_steps_are_all_agent_doable():
    """P4.3 family 2 (D-41): every lakehouse, reverse-lakehouse, lakehouse-di and
    reverse-lakehouse-di step is agent-doable in Genie Code (judgment table in
    docs/superpowers/plans/2026-10-06-p4-lakehouse-family.md)."""
    loaded = manifest.load_manifest()
    data = json.loads((REPO_ROOT / "src/backend/workshop/manifest.json").read_text())["tracks"]
    for track_id in ("lakehouse", "reverse-lakehouse", "lakehouse-di", "reverse-lakehouse-di"):
        json_steps = [step for section in data[track_id]["sections"] for step in section["steps"]]
        assert json_steps, track_id
        assert {step["sectionTag"]: step["execution"] for step in json_steps} == {
            step["sectionTag"]: "agent-doable" for step in json_steps
        }, track_id
        assert {step.execution for step in loaded.track_steps(track_id)} == {"agent-doable"}, track_id


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
