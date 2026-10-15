"""Matching an idea to a data model: ids are checked against the digest."""
import asyncio

import pytest
from fastapi import HTTPException

from src.backend.api import blueprint_fit as fit

DIGEST = {
    "label": "Airlines",
    "version": "1.0",
    "areas": [
        {"name": "flight", "label": "Flight", "description": "Flights"},
        {"name": "airport", "label": "Airport", "description": "Gates and turns"},
        {"name": "crew", "label": "Crew", "description": "Flight crew"},
        {"name": "finance", "label": "Finance", "description": "Money"},
    ],
    "tables": [
        {"id": "flight.flight_leg", "label": "Flight leg", "area": "flight", "purpose": "One leg",
         "linksTo": [{"to": "flight.schedule", "via": "Schedule", "reason": ""}]},
        {"id": "flight.schedule", "label": "Schedule", "area": "flight", "purpose": "Timetable"},
        {"id": "airport.turnaround", "label": "Turnaround", "area": "airport", "purpose": "A turn",
         "linksTo": [{"to": "flight.flight_leg", "via": "Inbound leg", "reason": ""}]},
        {"id": "crew.roster", "label": "Roster", "area": "crew", "purpose": "Who flies",
         "linksTo": [{"to": "flight.flight_leg", "via": "Leg", "reason": ""}]},
        {"id": "finance.ledger", "label": "Ledger", "area": "finance", "purpose": "Money in and out"},
    ],
    "kpis": [{"id": "otp", "label": "On-time", "area": "flight"}],
    "links": [{"a": "flight", "b": "airport", "n": 9}, {"a": "flight", "b": "crew", "n": 3}],
}


def test_catalog_groups_tables_under_areas():
    cat = fit.catalog_of(DIGEST)
    flight = next(a for a in cat["areas"] if a["name"] == "flight")
    assert flight["tables"][0] == ["flight.flight_leg", "Flight leg", "One leg"]
    assert cat["kpis"] == [["otp", "On-time", "flight"]]


def test_catalog_lists_cross_area_joins_busiest_first():
    joins = fit.catalog_of(DIGEST)["joins"]
    assert joins == [["airport.turnaround", "flight.flight_leg", "Inbound leg"], ["crew.roster", "flight.flight_leg", "Leg"]]


def test_a_named_join_is_kept_only_when_real():
    out = fit.normalize_fit({"areas": [
        {"name": "airport", "role": "core", "join": ["airport.turnaround", "flight.flight_leg"]},
        {"name": "flight", "role": "core", "join": ["flight.flight_leg", "made.up"]},
    ]}, DIGEST, 0)
    joins = {a["name"]: a.get("join") for a in out["areas"]}
    assert joins["airport"] == ["airport.turnaround", "flight.flight_leg"]
    assert joins["flight"] == ["airport.turnaround", "flight.flight_leg"]


def test_a_supporting_area_that_joins_nothing_is_dropped():
    out = fit.normalize_fit({"areas": [
        {"name": "flight", "role": "core"}, {"name": "airport", "role": "core"}, {"name": "finance", "role": "supporting"},
    ]}, DIGEST, 0)
    assert [a["name"] for a in out["areas"]] == ["flight", "airport"]


def test_separate_core_areas_get_a_bridge():
    out = fit.normalize_fit({"areas": [{"name": "airport", "role": "core"}, {"name": "crew", "role": "core"}]}, DIGEST, 0)
    bridge = out["areas"][-1]
    assert (bridge["name"], bridge["role"]) == ("flight", "supporting")
    assert bridge["why"] == "Connects Airport and Crew"
    assert all(a.get("join") for a in out["areas"])


def test_skipped_keeps_real_unchosen_areas_with_a_reason():
    out = fit.normalize_fit({
        "areas": [{"name": "flight", "role": "core"}, {"name": "airport", "role": "core"}],
        "skipped": [{"name": "crew", "why": "Flight crew only"}, {"name": "airport", "why": "x"},
                    {"name": "ground", "why": "x"}, {"name": "finance", "why": ""}],
    }, DIGEST, 0)
    assert out["skipped"] == [{"name": "crew", "why": "Flight crew only"}]


def test_prompt_judges_by_tables_and_sets_the_language():
    assert "the user's language" not in fit.FIT_PROMPT
    assert "language the USE CASE is written in" in fit.FIT_PROMPT
    assert "never by its name" in fit.FIT_PROMPT


def test_unknown_ids_are_dropped_and_need_areas_follow_tables():
    out = fit.normalize_fit({
        "needs": [
            {"need": "Turn times", "importance": "must", "areas": ["ground"], "tables": ["airport.turnaround", "made.up"]},
            {"need": "Equipment", "importance": "must", "areas": [], "tables": [], "gap": "No GSE data."},
        ],
        "areas": [{"name": "ground", "role": "core"}, {"name": "flight", "role": "core", "why": "Schedule"}],
        "questions": [{"index": 0, "kpi": "otp"}, {"index": 1, "kpi": "nope"}, {"index": 9, "kpi": "otp"}],
        "fit": "partial",
    }, DIGEST, 2)
    assert out["needs"][0]["areas"] == ["airport"]
    assert out["needs"][0]["tables"] == ["airport.turnaround"]
    assert out["needs"][1]["gap"] == "No GSE data."
    assert [a["name"] for a in out["areas"]] == ["flight", "airport"]
    assert out["questions"] == [{"index": 0, "kpi": "otp"}, {"index": 1, "kpi": None}]


def test_a_single_area_gets_its_best_connected_neighbour():
    out = fit.normalize_fit({"areas": [{"name": "flight", "role": "core"}]}, DIGEST, 0)
    assert [(a["name"], a["role"]) for a in out["areas"]] == [("flight", "core"), ("airport", "supporting")]


def test_need_without_areas_or_gap_becomes_a_gap():
    out = fit.normalize_fit({"needs": [{"need": "Weather"}], "areas": [{"name": "flight"}]}, DIGEST, 0)
    assert out["needs"][0]["gap"] == "Not found in this model."


def test_long_text_is_cut_at_a_word():
    long = "Flight schedule and flight legs by departure time, the basis for departure banks and staffing"
    out = fit.normalize_fit({"needs": [{"need": long, "areas": ["flight"]}], "areas": [{"name": "flight"}]}, DIGEST, 0)
    need = out["needs"][0]["need"]
    assert len(need) <= 80 and need.endswith("…") and " ".join(need[:-1].split()) in long


def test_nothing_usable_is_none():
    assert fit.normalize_fit({"areas": [{"name": "ground"}]}, DIGEST, 0) is None
    assert fit.normalize_fit("nope", DIGEST, 0) is None


def test_bad_role_and_fit_fall_back():
    out = fit.normalize_fit({"areas": [{"name": "flight", "role": "main"}, {"name": "crew"}], "fit": "great"}, DIGEST, 0)
    assert out["areas"][0]["role"] == "core"
    assert out["fit"] == "partial"


def test_fit_retries_once_then_caches(monkeypatch):
    good = '{"areas": [{"name": "flight", "role": "core"}, {"name": "airport", "role": "supporting"}], "fit": "strong"}'
    replies = iter(["not json", good, good])
    calls = []

    async def fake_ask(system_prompt, prompt, max_tokens):
        calls.append(prompt)
        return {"text": next(replies), "model": "m"}

    async def fake_digest(slug, flavour="mvm"):
        return DIGEST

    monkeypatch.setattr(fit, "_ask", fake_ask)
    monkeypatch.setattr(fit, "load_digest", fake_digest)
    monkeypatch.setattr(fit, "_guard", lambda: None)
    body = fit.FitRequest(context="Plan ground crews per bank", questions=["OTP by station?"])
    out = asyncio.run(fit.blueprint_fit("airlines", body))
    assert out["fit"] == "strong" and out["slug"] == "airlines"
    assert len(calls) == 2 and "previous reply" in calls[1]
    again = asyncio.run(fit.blueprint_fit("airlines", body))
    assert again == out and len(calls) == 2
    nudged = fit.FitRequest(context=body.context, questions=body.questions, suggested=["crew", "nope"])
    asyncio.run(fit.blueprint_fit("airlines", nudged))
    assert len(calls) == 3 and "SUGGESTED AREAS:\ncrew\n" in calls[2]


def test_fit_needs_some_text(monkeypatch):
    async def fake_digest(slug, flavour="mvm"):
        return DIGEST

    monkeypatch.setattr(fit, "load_digest", fake_digest)
    monkeypatch.setattr(fit, "_guard", lambda: None)
    with pytest.raises(HTTPException) as e:
        asyncio.run(fit.blueprint_fit("airlines", fit.FitRequest()))
    assert e.value.status_code == 400
