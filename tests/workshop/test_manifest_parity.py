import json
import pathlib
import sys

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.workshop import manifest


FIX = pathlib.Path(__file__).parent / "fixtures"


def _ordered_tags(steps):
    return [step.sectionTag for step in steps]


def test_order_parity_default_flags():
    loaded = manifest.load_manifest()
    got = _ordered_tags(loaded.outline_order("genie-accelerator", flags={}))
    want = json.loads((FIX / "golden_order_genie_default.json").read_text())
    assert got == want


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
    default = json.loads((FIX / "golden_order_genie_default.json").read_text())
    assert not any(tag.startswith("ontology_") for tag in default)
