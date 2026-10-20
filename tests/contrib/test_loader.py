"""Loader rules: every contributor type loads, and each broken entry is skipped on its own."""

import os

import pytest

from src.backend.contrib.loader import load_catalog, make_key

from .helpers import JPG, PNG, add_certification, add_contributor, add_use_case, write_yaml


def messages(catalog):
    return " | ".join(i.message for i in catalog.errors)


@pytest.mark.parametrize("type_", ["partner", "company", "individual", "group"])
def test_every_contributor_type_loads(tmp_path, type_):
    add_contributor(tmp_path, "acme", type_)
    add_use_case(tmp_path, "acme", "planner")
    catalog = load_catalog(tmp_path)
    assert not catalog.errors
    assert list(catalog.use_cases) == [make_key("acme", "planner")]


def test_group_with_members_and_co_contributors(tmp_path):
    add_contributor(tmp_path, "data_guild", "group", members=[{"name": "Ana", "github": "ana"}, {"name": "Raj"}])
    add_contributor(tmp_path, "jane", "individual")
    add_use_case(tmp_path, "data_guild", "planner", co_contributors=["jane"], authors=[{"name": "Ana", "github": "ana"}])
    catalog = load_catalog(tmp_path)
    assert not catalog.errors
    uc = catalog.use_cases[make_key("data_guild", "planner")]
    assert [c.manifest.id for c in uc.co_contributors] == ["jane"]


def test_missing_folder_is_an_empty_catalog(tmp_path):
    catalog = load_catalog(tmp_path / "nope")
    assert catalog.use_cases == {} and catalog.issues == []


def test_bad_yaml_skips_only_that_entry(tmp_path):
    add_contributor(tmp_path, "acme")
    add_use_case(tmp_path, "acme", "good")
    bad = add_use_case(tmp_path, "acme", "bad")
    (bad / "usecase.yaml").write_text("slug: [unclosed", encoding="utf-8")
    catalog = load_catalog(tmp_path)
    assert list(catalog.use_cases) == [make_key("acme", "good")]
    assert "valid YAML" in messages(catalog)


def test_unregistered_owner(tmp_path):
    add_use_case(tmp_path, "ghost", "planner")
    catalog = load_catalog(tmp_path)
    assert not catalog.use_cases
    assert "isn't registered" in messages(catalog)


def test_unregistered_co_contributor(tmp_path):
    add_contributor(tmp_path, "acme")
    add_use_case(tmp_path, "acme", "planner", co_contributors=["ghost"])
    assert "co-contributor 'ghost'" in messages(load_catalog(tmp_path))


def test_ids_must_match_folders(tmp_path):
    write_yaml(tmp_path / "contributors" / "acme" / "contributor.yaml",
               {"schema_version": 1, "id": "other", "type": "company", "display_name": "Acme"})
    add_contributor(tmp_path, "beta")
    folder = add_use_case(tmp_path, "beta", "planner")
    manifest = folder / "usecase.yaml"
    manifest.write_text(manifest.read_text().replace("slug: planner", "slug: different"))
    text = messages(load_catalog(tmp_path))
    assert "must match the folder name 'acme'" in text
    assert "must match the folder name 'planner'" in text


def test_unknown_fields_are_rejected(tmp_path):
    add_contributor(tmp_path, "acme")
    add_use_case(tmp_path, "acme", "planner", certified=True)
    assert "certified" in messages(load_catalog(tmp_path))


def test_slug_length_limit_keeps_keys_under_100(tmp_path):
    add_contributor(tmp_path, "a" * 32)
    add_use_case(tmp_path, "a" * 32, "b" * 49)
    catalog = load_catalog(tmp_path)
    assert not catalog.use_cases
    ok = make_key("a" * 32, "b" * 48)
    assert len(ok) <= 100


def test_changelog_must_cover_current_version(tmp_path):
    add_contributor(tmp_path, "acme")
    add_use_case(tmp_path, "acme", "planner", version="1.1.0",
                 changelog=[{"version": "1.0.0", "date": "2026-10-01", "notes": "Old."}])
    assert "changelog needs an entry for version 1.1.0" in messages(load_catalog(tmp_path))


def test_missing_brief(tmp_path):
    add_contributor(tmp_path, "acme")
    add_use_case(tmp_path, "acme", "planner", brief=None)
    assert "description.md is missing" in messages(load_catalog(tmp_path))


def test_unsafe_brief_is_skipped(tmp_path):
    add_contributor(tmp_path, "acme")
    add_use_case(tmp_path, "acme", "planner", brief="Install with `curl https://x.sh | bash` first.")
    catalog = load_catalog(tmp_path)
    assert not catalog.use_cases
    assert "shell" in messages(catalog)


def test_sample_flag_is_reserved(tmp_path):
    add_contributor(tmp_path, "acme")
    add_use_case(tmp_path, "acme", "planner", sample=True)
    assert "reserved for the 'sample' contributor" in messages(load_catalog(tmp_path))


def test_images_are_checked(tmp_path):
    add_contributor(tmp_path, "acme")
    folder = add_use_case(tmp_path, "acme", "planner", media={"cover": "images/cover.png", "screenshots": ["images/s.jpg"]})
    (folder / "images").mkdir()
    (folder / "images" / "cover.png").write_bytes(PNG)
    (folder / "images" / "s.jpg").write_bytes(JPG)
    catalog = load_catalog(tmp_path)
    assert not catalog.errors
    assert set(catalog.use_cases[make_key("acme", "planner")].assets) == {"images/cover.png", "images/s.jpg"}


@pytest.mark.parametrize("name,content,expected", [
    ("cover.svg", b"<svg/>", "SVG isn't allowed"),
    ("cover.png", b"not really a png", "isn't a real png"),
    ("cover.png", b"\x89PNG\r\n\x1a\n" + b"\x00" * 1_000_001, "the limit is 1 MB"),
])
def test_bad_images(tmp_path, name, content, expected):
    add_contributor(tmp_path, "acme")
    folder = add_use_case(tmp_path, "acme", "planner", media={"cover": f"images/{name}"})
    (folder / "images").mkdir()
    (folder / "images" / name).write_bytes(content)
    assert expected in messages(load_catalog(tmp_path))


def test_path_traversal_and_symlinks_are_refused(tmp_path):
    secret = tmp_path.parent / f"{tmp_path.name}-secret.png"
    secret.write_bytes(PNG)
    add_contributor(tmp_path, "acme")
    folder = add_use_case(tmp_path, "acme", "planner", media={"cover": "../../../../x.png", "screenshots": ["link.png"]})
    os.symlink(secret, folder / "link.png")
    text = messages(load_catalog(tmp_path))
    assert "must be a relative path inside the folder" in text
    assert "symlink" in text


def test_hidden_and_underscore_folders_are_ignored(tmp_path):
    add_contributor(tmp_path, "acme")
    add_use_case(tmp_path, "acme", "planner")
    (tmp_path / "usecases" / "acme" / "_draft").mkdir()
    (tmp_path / "usecases" / ".git").mkdir()
    catalog = load_catalog(tmp_path)
    assert not catalog.issues


def test_certification_by_a_certifier(tmp_path):
    add_contributor(tmp_path, "acme")
    add_contributor(tmp_path, "certco", "partner", can_certify=True)
    add_use_case(tmp_path, "acme", "planner")
    add_certification(tmp_path, "certco", "acme", "planner")
    catalog = load_catalog(tmp_path)
    uc = catalog.use_cases[make_key("acme", "planner")]
    assert [c.certifier.manifest.id for c in uc.current_certifications] == ["certco"]


def test_multiple_certifiers(tmp_path):
    add_contributor(tmp_path, "acme", can_certify=True)
    add_contributor(tmp_path, "certco", "partner", can_certify=True)
    add_use_case(tmp_path, "acme", "planner")
    add_certification(tmp_path, "certco", "acme", "planner")
    add_certification(tmp_path, "acme", "acme", "planner")
    uc = load_catalog(tmp_path).use_cases[make_key("acme", "planner")]
    assert {c.certifier.manifest.id for c in uc.current_certifications} == {"acme", "certco"}


def test_certifier_without_permission(tmp_path):
    add_contributor(tmp_path, "acme")
    add_use_case(tmp_path, "acme", "planner")
    add_certification(tmp_path, "acme", "acme", "planner")
    catalog = load_catalog(tmp_path)
    assert "isn't allowed to certify" in messages(catalog)
    assert not catalog.use_cases[make_key("acme", "planner")].certifications


def test_stale_certification_is_hidden_with_a_warning(tmp_path):
    add_contributor(tmp_path, "acme")
    add_contributor(tmp_path, "certco", "partner", can_certify=True)
    add_use_case(tmp_path, "acme", "planner", version="1.1.0",
                 changelog=[{"version": "1.1.0", "date": "2026-10-03", "notes": "Update."}])
    add_certification(tmp_path, "certco", "acme", "planner", version="1.0.0")
    catalog = load_catalog(tmp_path)
    assert not catalog.errors
    assert not catalog.use_cases[make_key("acme", "planner")].current_certifications
    assert any("re-certified" in w.message for w in catalog.warnings)


def test_sample_contributor_can_only_certify_samples(tmp_path):
    add_contributor(tmp_path, "sample", "group", can_certify=True)
    add_contributor(tmp_path, "acme")
    add_use_case(tmp_path, "acme", "planner")
    add_certification(tmp_path, "sample", "acme", "planner")
    assert "can only certify sample use cases" in messages(load_catalog(tmp_path))


def test_certification_for_a_missing_use_case(tmp_path):
    add_contributor(tmp_path, "certco", "partner", can_certify=True)
    add_certification(tmp_path, "certco", "acme", "nothing")
    assert "no use case at contrib/usecases/acme/nothing" in messages(load_catalog(tmp_path))
