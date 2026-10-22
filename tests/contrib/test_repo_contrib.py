"""Guards on the real contrib/ folder that ships with the app."""

import importlib.util
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from src.backend.contrib import registry
from src.backend.contrib.loader import load_catalog, make_key

ROOT = Path(__file__).resolve().parents[2]
CONTRIB = ROOT / "contrib"
SAMPLE_KEY = make_key("sample", "contributed_usecase_starter")


def test_repo_contrib_folder_loads_with_zero_errors():
    catalog = load_catalog(CONTRIB)
    assert catalog.errors == [], [f"{i.path}: {i.message}" for i in catalog.errors]


def test_sample_is_present_flagged_and_certified():
    catalog = load_catalog(CONTRIB)
    sample = catalog.use_cases[SAMPLE_KEY]
    assert sample.manifest.sample is True
    assert sample.manifest.collections.home == "sample"
    assert [c.certifier.manifest.id for c in sample.current_certifications] == ["sample"]
    assert set(sample.assets) == {"images/cover.jpg", "images/screenshot-1.jpg"}


def test_registry_status_reports_reload_metadata(monkeypatch):
    monkeypatch.setenv("CONTRIB_DIR", str(CONTRIB))
    registry.reset_for_tests()
    try:
        registry.load(force=True)
        status = registry.status()
        assert status["loaded_at"]
        assert status["guide_url"].endswith("/contrib/README.md")
        assert status["sample_url"].endswith("/contrib/usecases/sample/contributed_usecase_starter")
    finally:
        registry.reset_for_tests()


def test_schemas_are_current():
    result = subprocess.run([sys.executable, "scripts/contrib/gen_schema.py", "--check"], cwd=ROOT, capture_output=True, text=True)
    assert result.returncode == 0, result.stdout


def test_codeowners_covers_every_contributor():
    codeowners = (ROOT / ".github" / "CODEOWNERS").read_text(encoding="utf-8")
    assert "/contrib/contributors/" in codeowners
    for cid in load_catalog(CONTRIB).contributors:
        assert f"/contrib/usecases/{cid}/" in codeowners, f"add /contrib/usecases/{cid}/ to .github/CODEOWNERS"


def _load_script(name, contrib_root):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / "contrib" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.CONTRIB = contrib_root
    module.ROOT = contrib_root.parent
    if hasattr(module, "SAMPLE"):
        rel = module.SAMPLE.relative_to(CONTRIB)
        module.SAMPLE = contrib_root / rel
    return module


@pytest.mark.parametrize("type_", ["partner", "company", "individual", "group"])
def test_scaffolded_contributions_pass_the_validator(tmp_path, monkeypatch, type_):
    root = tmp_path / "contrib"
    shutil.copytree(CONTRIB, root)
    new_contributor = _load_script("new_contributor", root)
    new_usecase = _load_script("new_usecase", root)

    monkeypatch.setattr(sys, "argv", ["x", "--id", "acme", "--type", type_, "--name", "Acme Analytics", "--github", "acme-org/team"])
    assert new_contributor.main() == 0
    monkeypatch.setattr(sys, "argv", ["x", "--contributor", "acme", "--slug", "claims_triage", "--title", "Claims Triage", "--home", "retail"])
    assert new_usecase.main() == 0

    catalog = load_catalog(root)
    assert catalog.errors == [], [f"{i.path}: {i.message}" for i in catalog.errors]
    uc = catalog.use_cases[make_key("acme", "claims_triage")]
    assert uc.manifest.sample is False
    assert uc.manifest.title == "Claims Triage"
    assert uc.contributor.manifest.type == type_
    assert uc.contributor.manifest.can_certify is False
