"""
API tests for saved ideas, Idea Points, the AI judge, and the Insights leaderboard.

    USE_LAKEBASE=false DEV_PERSONA_SWITCH=true python3 -m unittest tests.api.test_ideate_ideas -v

Storage runs on the in-memory fallback and the judge's LLM call is monkeypatched,
so no Databricks connectivity is needed.
"""

import asyncio
import json
import os
import sys
import unittest
from pathlib import Path

os.environ.setdefault("USE_LAKEBASE", "false")
os.environ.setdefault("DEV_PERSONA_SWITCH", "true")

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from starlette.requests import Request  # noqa: E402

from src.backend.api import ideate_ideas as ii  # noqa: E402

ALICE = "alice@example.com"
BOB = "bob@example.com"


def req(user: str = ALICE) -> Request:
    headers = [(b"x-dev-persona", user.encode())] if user else []
    return Request({"type": "http", "method": "GET", "path": "/", "headers": headers, "query_string": b""})


def run(coro):
    return asyncio.run(coro)


def body(resp):
    return json.loads(resp.body) if hasattr(resp, "body") else resp


def idea(**over):
    base = {
        "id": "idea-0001",
        "mode": "ideate",
        "title": "Faster crew swaps",
        "seed": "Schedulers lose time on swaps",
        "industry": "Airlines",
        "status": "exploring",
        "step": "brief",
        "approved": ["spark", "map", "clarify", "shape", "impact", "brief"],
        "questions": [{"id": "q1"}, {"id": "q2"}, {"id": "q3"}],
        "answers": {"q1": "Schedulers", "q2": "Not sure yet", "q3": "Daily"},
        "map": {"placedLeafId": "leaf-1", "branches": []},
        "impact": {"answers": {"a": {"source": "you said"}, "b": {"source": "estimate"}}},
        "assumptions": [],
        "decisions": [],
        "brief": "## Problem\nSwaps take 40 minutes.",
        "revision": 1,
    }
    base.update(over)
    return base


def judge_reply(score=80):
    return {"response": json.dumps({
        "headline": "Clear and specific",
        "dimensions": {k: {"score": score, "why": "ok", "raise": "more"} for k, _ in ii.DIMENSIONS},
    })}


class Base(unittest.TestCase):
    def setUp(self):
        self._ensure = ii._ensure_table
        self._llm = ii.call_databricks_serving_endpoint
        self._approved = ii._library_approved
        ii._ensure_table = lambda: None
        ii._library_approved = lambda: set()
        ii._memory.clear()
        ii._leaderboard_cache.clear()
        ii._score_log.clear()

    def tearDown(self):
        ii._ensure_table = self._ensure
        ii.call_databricks_serving_endpoint = self._llm
        ii._library_approved = self._approved

    def save(self, data, user=ALICE, value=None):
        return run(ii.save_idea(data["id"], ii.SaveIdeaRequest(idea=data, value_per_year=value), req(user)))


class TestPoints(unittest.TestCase):
    def test_journey_points_follow_quality_of_answers(self):
        i = idea()
        # spark 25 + map 25 + clarify 2 real answers (20) + shape 30 + impact 60*(0.5+0.25)=45 + brief 50
        self.assertEqual(ii.journey_points(i), 25 + 25 + 20 + 30 + 45 + 50)

    def test_skipped_impact_earns_nothing(self):
        self.assertEqual(ii.step_points(idea(impact={"skipped": True}), "impact"), 0)

    def test_unapproved_steps_earn_nothing(self):
        self.assertEqual(ii.journey_points(idea(approved=[])), 0)

    def test_depth_is_capped(self):
        i = idea(gaps=[1], caseOpenedAt="x", assumptions=[{"status": "accepted"}] * 10)
        self.assertEqual(ii.depth_points(i), 50)

    def test_insights_outcome(self):
        self.assertEqual(ii.outcome_points({"mode": "insights", "lockedAt": "t"}, False), 40)
        self.assertEqual(ii.outcome_points({"mode": "insights", "lockedAt": "t", "buildStage": "studio"}, False), 100)

    def test_ideate_outcome_needs_library_approval_for_the_rest(self):
        self.assertEqual(ii.outcome_points({"catalogRef": {"industry": "a"}}, False), 40)
        self.assertEqual(ii.outcome_points({"catalogRef": {"industry": "a"}}, True), 100)

    def test_tiers(self):
        self.assertEqual([ii.tier_for(t) for t in (0, 249, 250, 500, 999)], ["spark", "spark", "shaped", "investable", "boardroom"])


class TestSave(Base):
    def test_requires_sign_in(self):
        resp = run(ii.save_idea("idea-0001", ii.SaveIdeaRequest(idea=idea()), req("")))
        self.assertEqual(resp.status_code, 401)

    def test_server_ignores_client_score(self):
        out = self.save(idea(score={"total": 999999, "quality": 600}))
        self.assertIsNone(out["score"]["quality"])
        self.assertEqual(out["score"]["journey"], ii.journey_points(idea()))
        self.assertNotIn("score", ii._memory["idea-0001"]["payload"])

    def test_samples_are_not_saved(self):
        self.assertEqual(self.save(idea(sample=True)).status_code, 400)

    def test_mismatched_id(self):
        resp = run(ii.save_idea("idea-9999", ii.SaveIdeaRequest(idea=idea()), req()))
        self.assertEqual(resp.status_code, 400)

    def test_only_owner_can_overwrite(self):
        self.save(idea())
        self.assertEqual(self.save(idea(title="Mine now"), user=BOB).status_code, 403)

    def test_deleted_idea_is_gone(self):
        self.save(idea())
        run(ii.delete_idea("idea-0001", req()))
        self.assertEqual(self.save(idea()).status_code, 410)

    def test_bob_cannot_delete(self):
        self.save(idea())
        self.assertEqual(run(ii.delete_idea("idea-0001", req(BOB))).status_code, 403)


class TestRead(Base):
    def test_anyone_signed_in_can_view(self):
        self.save(idea())
        out = run(ii.get_idea("idea-0001", req(BOB)))
        self.assertFalse(out["isOwner"])
        self.assertEqual(out["idea"]["title"], "Faster crew swaps")
        self.assertIn("score", out["idea"])

    def test_view_requires_sign_in(self):
        self.save(idea())
        self.assertEqual(run(ii.get_idea("idea-0001", req(""))).status_code, 401)


class TestJudge(Base):
    def test_scores_caches_and_ranks(self):
        calls = []

        async def fake(**kw):
            calls.append(kw)
            return judge_reply(80)

        ii.call_databricks_serving_endpoint = fake
        self.save(idea())
        out = run(ii.score_idea("idea-0001", req()))
        self.assertFalse(out["cached"])
        self.assertEqual(out["score"]["quality"], 480)
        again = run(ii.score_idea("idea-0001", req()))
        self.assertTrue(again["cached"])
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0]["temperature"], 0.0)

        # Quality survives a later save without a new score.
        self.assertEqual(self.save(idea(title="Renamed"))["score"]["quality"], 480)

    def test_caps_when_steps_are_skipped(self):
        async def fake(**kw):
            return judge_reply(95)

        ii.call_databricks_serving_endpoint = fake
        self.save(idea(impact={"skipped": True}, answers={}, map={}))
        dims = {d["key"]: d for d in run(ii.score_idea("idea-0001", req()))["score"]["breakdown"]}
        self.assertEqual(dims["value"]["score"], ii.CAP_NO_IMPACT)
        self.assertEqual(dims["users"]["score"], ii.CAP_NO_ANSWERS)
        self.assertEqual(dims["feasibility"]["score"], ii.CAP_NO_MAP)
        self.assertTrue(dims["value"]["capped"])
        self.assertEqual(dims["writing"]["score"], 95)

    def test_only_owner_scores(self):
        self.save(idea())
        self.assertEqual(run(ii.score_idea("idea-0001", req(BOB))).status_code, 403)

    def test_needs_a_brief(self):
        self.save(idea(brief=""))
        self.assertEqual(run(ii.score_idea("idea-0001", req())).status_code, 400)

    def test_unreadable_reply(self):
        async def fake(**kw):
            return {"response": "not json"}

        ii.call_databricks_serving_endpoint = fake
        self.save(idea())
        self.assertEqual(run(ii.score_idea("idea-0001", req())).status_code, 502)


class TestLeaderboard(Base):
    def test_one_row_per_idea_sorted_by_points(self):
        self.save(idea())
        self.save(idea(id="idea-0002", title="Second", approved=["spark"]))
        self.save(idea(id="idea-0003", title="Bob's", mode="insights", approved=["spark", "map"]), user=BOB)
        self.save(idea(id="idea-0004", title="Not started", approved=[]))
        rows = run(ii.insights_leaderboard(req(), limit=50))
        self.assertEqual([r["idea_id"] for r in rows], ["idea-0001", "idea-0003", "idea-0002"])
        self.assertEqual([r["rank"] for r in rows], [1, 2, 3])
        self.assertTrue(rows[0]["is_mine"])
        self.assertFalse(rows[1]["is_mine"])
        self.assertEqual(rows[1]["status"], "shaping")

    def test_mode_filter_and_deleted_ideas(self):
        self.save(idea())
        self.save(idea(id="idea-0003", mode="insights", approved=["spark"], lockedAt="2026-01-01T00:00:00", buildStage="studio"), user=BOB)
        rows = run(ii.insights_leaderboard(req(), mode="insights"))
        self.assertEqual([r["idea_id"] for r in rows], ["idea-0003"])
        self.assertEqual(rows[0]["status"], "live")
        self.assertEqual(rows[0]["outcome"], 100)
        run(ii.delete_idea("idea-0001", req()))
        self.assertEqual([r["idea_id"] for r in run(ii.insights_leaderboard(req()))], ["idea-0003"])


if __name__ == "__main__":
    unittest.main()
