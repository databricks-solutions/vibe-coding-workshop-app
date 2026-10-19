"""Matching a use case to tables at any size: resolution, budget, caching and the fallback."""
import asyncio
import json
import pathlib
import sys

import pytest
from fastapi import HTTPException

REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.backend.api import insights_cache
from src.backend.api import table_matcher as tm

CONTEXT = "Next-hour departure delay risk: flag flights likely to leave late so ops can act on gates, turns and crews."
QUESTIONS = [
    "Which flights departing in the next hour are at risk of delay?",
    "What are the top delay reasons by station this week?",
    "How long are turnarounds taking at each gate?",
]


def t(area, name, purpose, cols, links=()):
    return {"id": f"{area}.{name}", "name": name, "area": area, "label": name.replace("_", " ").capitalize(), "purpose": purpose,
            "columns": [{"n": c} for c in cols], "linksTo": [{"to": l, "via": "", "reason": ""} for l in links]}


REAL = [
    t("flight", "flight_leg", "One operated or planned flight leg with scheduled and actual times.",
      ["flight_leg_id", "scheduled_departure", "actual_departure", "departure_delay_minutes", "station_id", "gate_id"],
      ["airport.station", "airport.gate"]),
    t("flight", "delay_record", "A delay against a flight leg with its IATA delay code and minutes.",
      ["delay_record_id", "flight_leg_id", "delay_code", "delay_reason", "delay_minutes"], ["flight.flight_leg"]),
    t("airport", "turnaround", "Ground turnaround of an aircraft between an inbound and outbound leg.",
      ["turnaround_id", "gate_id", "actual_turnaround_minutes", "planned_turnaround_minutes"], ["airport.gate", "flight.flight_leg"]),
    t("airport", "gate", "A gate at a station.", ["gate_id", "station_id", "gate_code"], ["airport.station"]),
    t("airport", "station", "An airport station the airline serves.", ["station_id", "iata_code", "city"]),
    t("crew", "duty_period", "A crew member's duty period with flight duty limits.", ["duty_period_id", "fdp_hours", "fdp_limit"]),
]


def big_digest(n_filler=2000):
    tables = list(REAL)
    areas = ["flight", "airport", "crew"] + [f"area_{i}" for i in range(20)]
    for i in range(n_filler):
        a = areas[3 + i % 20]
        tables.append(t(a, f"entity_{i}", f"Reference records about item group {i} and its attributes.",
                        [f"entity_{i}_id", "name", "description", "created_at", "amount"], [f"{a}.entity_{max(0, i - 20)}"] if i >= 20 else []))
    return {
        "slug": "uc:test.big", "label": "Big",
        "areas": [{"name": a, "label": a.title(), "description": f"About {a}"} for a in areas],
        "tables": tables,
        "kpis": [{"id": "otp", "label": "On-time", "area": "flight", "table": "flight.flight_leg",
                  "measures": [{"name": "avg_delay", "label": "Average delay", "agg": "avg", "comment": "", "expr": "AVG(departure_delay_minutes)"}],
                  "slices": [{"name": "station", "label": "Station", "kind": "category", "comment": ""}]}],
        "links": [],
    }


@pytest.fixture(scope="module")
def digest():
    return big_digest()


def test_resolution_finds_the_operational_tables_among_thousands(digest):
    idx = tm.Index(digest)
    res = tm.resolve_all(idx, CONTEXT, QUESTIONS, tm.fallback_needs(CONTEXT, QUESTIONS))
    q0, q1, q2 = ([tid for tid, _ in hits[:3]] for hits in res["perQuestion"])
    assert "flight.flight_leg" in q0
    assert "flight.delay_record" in q1
    assert "airport.turnaround" in q2 and "airport.gate" in q2
    assert len(res["candidates"]) <= tm.MAX_CANDIDATES


def test_exact_names_win_and_a_name_that_matches_everything_is_ignored(digest):
    idx = tm.Index(digest)
    hits = idx.resolve("join turnaround to airport.gate", [])
    assert {h[0] for h in hits[:2]} == {"airport.turnaround", "airport.gate"}
    # "entity" is part of every filler name, so no table gets the name boost and the scores stay flat.
    hits = idx.resolve("entity", [])
    assert hits and hits[0][1] == hits[-1][1]


def test_pack_stays_within_budget_and_mentions_every_area(digest):
    idx = tm.Index(digest)
    res = tm.resolve_all(idx, CONTEXT, QUESTIONS, tm.fallback_needs(CONTEXT, QUESTIONS))
    for budget in (tm.PACK_BUDGET_CHARS, tm.SMALL_PACK_CHARS):
        model = tm.pack(digest, idx, res, budget)
        assert len(json.dumps(model, separators=(",", ":"))) <= budget
        assert {a["name"] for a in model["areas"]} == {a["name"] for a in digest["areas"]}
        assert any("more tables" in a.get("more", "") for a in model["areas"])


class FakeAI:
    def __init__(self, fit_reply=None, fail=None):
        self.needs_calls = self.fit_calls = 0
        self.prompts = []
        self.fit_reply = fit_reply
        self.fail = list(fail or [])

    async def __call__(self, system, prompt, max_tokens):
        if system == tm.NEEDS_PROMPT:
            self.needs_calls += 1
            return {"text": json.dumps({"needs": [{"need": "Departure delays per flight leg", "importance": "must",
                                                   "terms": ["flight leg", "departure delay", "delay code"]}]}), "model": "m"}
        self.fit_calls += 1
        self.prompts.append(prompt)
        await asyncio.sleep(0.01)
        if self.fail:
            raise self.fail.pop(0)
        return {"text": self.fit_reply or json.dumps({
            "areas": [{"name": "flight", "role": "core"}, {"name": "airport", "role": "supporting"}],
            "questions": [{"index": 0, "kpi": "otp"}], "fit": "strong", "summary": "ok"}), "model": "m"}


def _fresh(monkeypatch, ai):
    monkeypatch.setattr(tm, "_ask", ai)
    for ns in (tm._fit_cache, tm._needs_cache, tm._index_cache):
        monkeypatch.setattr(ns, "_items", type(ns._items)())
        monkeypatch.setattr(ns, "_bytes", 0)
    monkeypatch.setattr(tm, "_jobs", type(tm._jobs)())
    monkeypatch.setattr(insights_cache, "_DB", {"state": "off"})


class SlowAI(FakeAI):
    def __init__(self, delay, **kw):
        super().__init__(**kw)
        self.delay = delay

    async def __call__(self, system, prompt, max_tokens):
        if system != tm.NEEDS_PROMPT:
            await asyncio.sleep(self.delay)
        return await super().__call__(system, prompt, max_tokens)


def _attach(fit, raw, d):
    by = {q["index"]: q for q in (raw or {}).get("questions") or []}
    for q in fit["questions"]:
        q["tables"] = by.get(q["index"], {}).get("tables", [])
    return fit


def test_an_ai_pass_past_the_deadline_falls_back_with_a_reason(monkeypatch, digest):
    ai = SlowAI(5)
    _fresh(monkeypatch, ai)
    monkeypatch.setattr(tm, "MATCH_DEADLINE_S", 0.3)
    monkeypatch.setattr(tm, "MIN_CALL_S", 0.05)
    out = asyncio.run(tm.match(digest, "fp-d", CONTEXT, QUESTIONS, [], attach=_attach))
    assert out["mode"] == "tables" and out["reason"] == "timeout"
    assert all(q["tables"] for q in out["questions"])


def test_an_unavailable_ai_is_reported_as_such(monkeypatch, digest):
    _fresh(monkeypatch, FakeAI(fail=[HTTPException(status_code=503, detail="down")]))
    out = asyncio.run(tm.match(digest, "fp-u", CONTEXT, QUESTIONS, []))
    assert out["mode"] == "tables" and out["reason"] == "unavailable"


def _drain(job_id, timeout=5.0):
    async def wait():
        loop = asyncio.get_running_loop()
        end = loop.time() + timeout
        while loop.time() < end:
            view = tm.poll_match(job_id)
            if view["status"] != "running":
                return view
            await asyncio.sleep(0.02)
        raise AssertionError("job did not finish")
    return wait()


def test_a_started_match_answers_at_once_and_the_ai_fit_replaces_it(monkeypatch, digest):
    ai = SlowAI(0.3)
    _fresh(monkeypatch, ai)

    async def flow():
        first = await tm.start_match(digest, "fp-j", CONTEXT, QUESTIONS, [], attach=_attach)
        done = await _drain(first["job"])
        return first, done

    first, done = asyncio.run(flow())
    assert first["status"] == "running"
    assert first["fit"]["mode"] == "tables" and first["fit"]["reason"] == "pending"
    assert all(q["tables"] for q in first["fit"]["questions"])
    assert done["status"] == "done" and done["fit"]["mode"] == "ai" and done["fit"]["fit"] == "strong"


def test_concurrent_starts_share_one_job_and_a_cached_fit_needs_no_job(monkeypatch, digest):
    ai = SlowAI(0.1)
    _fresh(monkeypatch, ai)

    async def flow():
        views = await asyncio.gather(*[tm.start_match(digest, "fp-s", CONTEXT, QUESTIONS, []) for _ in range(4)])
        await _drain(views[0]["job"])
        tm._jobs.clear()
        again = await tm.start_match(digest, "fp-s", CONTEXT, QUESTIONS, [])
        return views, again

    views, again = asyncio.run(flow())
    assert len({v["job"] for v in views}) == 1 and ai.fit_calls == 1
    assert again["status"] == "done" and again["fit"]["mode"] == "ai" and ai.fit_calls == 1


def test_retry_drops_a_finished_fallback_but_keeps_an_ai_fit(monkeypatch, digest):
    ai = FakeAI(fail=[HTTPException(status_code=503, detail="down")])
    _fresh(monkeypatch, ai)

    async def flow():
        first = await tm.start_match(digest, "fp-r", CONTEXT, QUESTIONS, [])
        done = await _drain(first["job"])
        polled = await tm.start_match(digest, "fp-r", CONTEXT, QUESTIONS, [])
        calls_before_retry = ai.fit_calls
        retried = await tm.start_match(digest, "fp-r", CONTEXT, QUESTIONS, [], retry=True)
        again = await _drain(retried["job"])
        return done, polled, calls_before_retry, again

    done, polled, calls_before_retry, again = asyncio.run(flow())
    assert done["fit"]["mode"] == "tables" and done["fit"]["reason"] == "unavailable"
    # Without retry, a reload sees the finished job instead of asking the AI again.
    assert polled["status"] == "done" and calls_before_retry == 1
    assert again["fit"]["mode"] == "ai" and ai.fit_calls == 2


def test_polling_an_unknown_job_is_a_404():
    with pytest.raises(HTTPException) as e:
        tm.poll_match("nope")
    assert e.value.status_code == 404


def test_second_ask_is_served_from_cache_without_ai(monkeypatch, digest):
    ai = FakeAI()
    _fresh(monkeypatch, ai)
    out = asyncio.run(tm.match(digest, "fp-1", CONTEXT, QUESTIONS, []))
    assert out["mode"] == "ai" and out["fit"] == "strong"
    assert (ai.needs_calls, ai.fit_calls) == (1, 1)
    assert len(ai.prompts[0]) < tm.PACK_BUDGET_CHARS + 4000
    again = asyncio.run(tm.match(digest, "fp-1", CONTEXT, QUESTIONS, []))
    assert again == out and (ai.needs_calls, ai.fit_calls) == (1, 1)
    # A new schema version reuses the needs, only the fit is asked again.
    asyncio.run(tm.match(digest, "fp-2", CONTEXT, QUESTIONS, []))
    assert (ai.needs_calls, ai.fit_calls) == (1, 2)


def test_concurrent_asks_share_one_build(monkeypatch, digest):
    ai = FakeAI()
    _fresh(monkeypatch, ai)

    async def many():
        return await asyncio.gather(*[tm.match(digest, "fp-c", CONTEXT, QUESTIONS, []) for _ in range(5)])

    outs = asyncio.run(many())
    assert all(o == outs[0] for o in outs)
    assert (ai.needs_calls, ai.fit_calls) == (1, 1)


def test_without_the_ai_every_question_still_gets_tables(monkeypatch, digest):
    ai = FakeAI(fail=[HTTPException(status_code=503, detail="down")])
    _fresh(monkeypatch, ai)
    attached = []

    def attach(fit, raw, d):
        attached.append(raw)
        by = {q["index"]: q for q in raw["questions"]}
        for q in fit["questions"]:
            q["tables"] = by.get(q["index"], {}).get("tables", [])
        return fit

    out = asyncio.run(tm.match(digest, "fp-off", CONTEXT, QUESTIONS, [], attach=attach))
    assert out["mode"] == "tables" and ai.fit_calls == 1
    assert all(q["tables"] for q in out["questions"])
    assert "flight.flight_leg" in out["questions"][0]["tables"]
    # A fallback is not cached, so the AI gets another try next time.
    asyncio.run(tm.match(digest, "fp-off", CONTEXT, QUESTIONS, [], attach=attach))
    assert ai.fit_calls == 2


def test_a_timeout_retries_once_with_a_smaller_slice(monkeypatch, digest):
    ai = FakeAI(fail=[asyncio.TimeoutError()])
    _fresh(monkeypatch, ai)
    wide = dict(digest)
    wide["tables"] = digest["tables"] + [
        t("flight", f"departure_delay_{i}", "Departure delay detail for flight legs at a station and gate. " * 3,
          [f"departure_delay_measure_column_{j}" for j in range(20)]) for i in range(40)]
    out = asyncio.run(tm.match(wide, "fp-t", CONTEXT, QUESTIONS, []))
    assert out["mode"] == "ai" and ai.fit_calls == 2
    assert len(ai.prompts[1]) < 0.8 * len(ai.prompts[0])


def test_a_timeout_on_an_already_small_slice_goes_straight_to_the_fallback(monkeypatch, digest):
    ai = FakeAI(fail=[asyncio.TimeoutError()])
    _fresh(monkeypatch, ai)
    out = asyncio.run(tm.match(digest, "fp-t2", CONTEXT, QUESTIONS, []))
    assert out["mode"] == "tables" and ai.fit_calls == 1


def test_a_bad_reply_is_retried_with_a_note(monkeypatch, digest):
    replies = iter(["not json", None])
    ai = FakeAI()
    base = ai.__call__

    async def ask(system, prompt, max_tokens):
        out = await base(system, prompt, max_tokens)
        if system != tm.NEEDS_PROMPT:
            r = next(replies)
            if r:
                out = {**out, "text": r}
        return out

    _fresh(monkeypatch, ask)
    out = asyncio.run(tm.match(digest, "fp-b", CONTEXT, QUESTIONS, []))
    assert out["mode"] == "ai" and ai.fit_calls == 2 and "previous reply" in ai.prompts[1]


def test_cache_namespaces_are_bounded_by_bytes():
    ns = insights_cache.Namespace("t", max_bytes=1000, ttl_s=60)
    for i in range(50):
        ns.put(f"k{i}", "x" * 100)
    snap = ns.snapshot()
    assert snap["bytes"] <= 1000 and snap["evictions"] > 0
    assert ns.get("k49") == "x" * 100 and ns.get("k0") is None


def test_within_leading_schema_drops_weak_areas_from_other_schemas():
    digest = {"areas": [
        {"name": "flight_ops", "division": "c.airlines"},
        {"name": "network", "division": "c.airlines"},
        {"name": "hotel_loyalty", "division": "c.travel"},
        {"name": "bookings", "division": "c.travel"},
    ]}
    scored = [("flight_ops", 10.0), ("bookings", 9.0), ("network", 6.0), ("hotel_loyalty", 5.0)]
    kept = [a for a, _ in tm.within_leading_schema(scored, digest)]
    assert kept == ["flight_ops", "bookings", "network"]


def test_within_leading_schema_single_schema_unchanged():
    digest = {"areas": [{"name": "a", "division": ""}, {"name": "b", "division": ""}]}
    scored = [("a", 3.0), ("b", 0.5)]
    assert tm.within_leading_schema(scored, digest) == scored
