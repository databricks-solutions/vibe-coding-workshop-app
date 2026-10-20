"""Placement rules: home fallback, overrides, withdrawn handling and file-declared cross-listings."""

from src.backend.contrib import COMMUNITY_COLLECTION_ID
from src.backend.contrib.merge import resolve_rows, synthesize_members


def row(**kw):
    base = {
        "industry": "retail", "use_case": "contrib__acme__planner", "provenance": "third_party",
        "contrib_status": "active", "contrib_also": [], "contrib_sample": False,
        "category": None, "category_order": None, "display_order": None,
    }
    base.update(kw)
    return base


LIVE = {"contrib__acme__planner": {"is_active": True}}


def test_new_contributions_are_inactive_until_an_admin_activates_them():
    assert resolve_rows([row()], {"retail"}, {}, {}, False) == []
    [r] = resolve_rows([row()], {"retail"}, {}, {}, True)
    assert r["is_active"] is False and r["contrib_listed"] is False
    [r] = resolve_rows([row()], {"retail"}, {}, LIVE, False)
    assert r["is_active"] is True and r["contrib_listed"] is True


def test_known_home_is_kept_with_its_label():
    [r] = resolve_rows([row()], {"retail"}, {"retail": "Retail"}, LIVE, False)
    assert r["industry"] == "retail" and r["industry_label"] == "Retail"


def test_unknown_home_falls_back_to_community_with_a_column():
    [r] = resolve_rows([row(industry="insurance", provenance="partner")], {"retail"}, {}, LIVE, False)
    assert r["industry"] == COMMUNITY_COLLECTION_ID
    assert r["category"] == "Partner contributions"


def test_sample_gets_its_own_column():
    [r] = resolve_rows([row(industry="nowhere", contrib_sample=True)], set(), {}, LIVE, False)
    assert r["category"] == "Start here: sample"


def test_admin_can_deactivate_but_templates_still_resolve():
    overrides = {"contrib__acme__planner": {"is_active": False}}
    assert resolve_rows([row()], {"retail"}, {}, overrides, False) == []
    [r] = resolve_rows([row()], {"retail"}, {}, overrides, True)
    assert r["is_active"] is False and r["contrib_listed"] is False


def test_withdrawn_is_unlisted_but_resolvable():
    assert resolve_rows([row(contrib_status="withdrawn")], {"retail"}, {}, LIVE, False) == []
    assert len(resolve_rows([row(contrib_status="withdrawn")], {"retail"}, {}, {}, True)) == 1


def test_layout_override_wins_and_nulls_keep_file_values():
    overrides = {"contrib__acme__planner": {"is_active": True, "category": "Ops", "category_order": 2, "display_order": None}}
    [r] = resolve_rows([row(display_order=7)], {"retail"}, {}, overrides, False)
    assert (r["category"], r["category_order"], r["display_order"]) == ("Ops", 2, 7)


def test_members_cover_community_and_known_also_collections():
    rows = resolve_rows([row(contrib_also=["office_of_cfo", "missing", "retail"])], {"retail", "office_of_cfo"}, {}, LIVE, False)
    members = synthesize_members(rows, {"retail", "office_of_cfo", COMMUNITY_COLLECTION_ID})
    assert [m["collection_id"] for m in members] == [COMMUNITY_COLLECTION_ID, "office_of_cfo"]
    assert all(m["locked"] for m in members)


def test_community_homed_rows_are_not_cross_listed_into_community_again():
    rows = resolve_rows([row(industry="nowhere")], set(), {}, LIVE, False)
    assert synthesize_members(rows, {COMMUNITY_COLLECTION_ID}) == []
