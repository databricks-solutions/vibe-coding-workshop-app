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
        "approved": ["spark", "map", "clarify", "shape", "questions", "impact", "brief"],
        "questions": [{"id": "q1"}, {"id": "q2"}, {"id": "q3"}],
        "answers": {"q1": "Schedulers", "q2": "Not sure yet", "q3": "Daily"},
        "genieQuestions": ["Which crew swaps are delayed?", "Why is flight 102 waiting?", "How many swaps breached SLA?"],
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
        self._reviewers = os.environ.get("IDEATE_REVIEWERS")
        self._admins = os.environ.get("APP_ADMINS")
        os.environ["IDEATE_REVIEWERS"] = "*"
        os.environ.pop("APP_ADMINS", None)
        ii._ensure_table = lambda: None
        ii._library_approved = lambda: set()
        ii._memory.clear()
        ii._leaderboard_cache.clear()
        ii._score_log.clear()

    def tearDown(self):
        ii._ensure_table = self._ensure
        ii.call_databricks_serving_endpoint = self._llm
        ii._library_approved = self._approved
        if self._reviewers is None:
            os.environ.pop("IDEATE_REVIEWERS", None)
        else:
            os.environ["IDEATE_REVIEWERS"] = self._reviewers
        if self._admins is None:
            os.environ.pop("APP_ADMINS", None)
        else:
            os.environ["APP_ADMINS"] = self._admins

    def save(self, data, user=ALICE, value=None):
        return run(ii.save_idea(data["id"], ii.SaveIdeaRequest(idea=data, value_per_year=value), req(user)))


class TestPoints(unittest.TestCase):
    def test_journey_points_follow_quality_of_answers(self):
        i = idea()
        # spark 20 + map 20 + clarify 2 real answers (20) + shape 25 + questions 3 (30) + impact 40*(0.5+0.25)=30 + brief 45
        self.assertEqual(ii.journey_points(i), 20 + 20 + 20 + 25 + 30 + 30 + 45)

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
        self.save(idea(id="idea-0003", mode="insights", approved=["spark"]), user=BOB)
        ii._memory["idea-0003"].update(review_status="approved", approved_revision=1)
        self.save(idea(id="idea-0003", mode="insights", approved=["spark"], lockedAt="2026-01-01T00:00:00", buildStage="studio"), user=BOB)
        rows = run(ii.insights_leaderboard(req(), mode="insights"))
        self.assertEqual([r["idea_id"] for r in rows], ["idea-0003"])
        self.assertEqual(rows[0]["status"], "live")
        self.assertEqual(rows[0]["outcome"], 100)
        run(ii.delete_idea("idea-0001", req()))
        self.assertEqual([r["idea_id"] for r in run(ii.insights_leaderboard(req()))], ["idea-0003"])


class TestReviewLifecycle(Base):
    def submit(self, idea_id="idea-0001", revision=1, user=ALICE):
        return ii.mark_submitted(
            idea_id,
            user,
            revision,
            {"industry": "travel", "useCase": "crew_swaps", "version": 1},
        )

    def test_default_reviewer_policy_and_explicit_allowlist_with_admin_override(self):
        self.assertEqual(ii.reviewer_email(req(BOB)), BOB)
        os.environ["IDEATE_REVIEWERS"] = "reviewer@example.com"
        self.assertIsNone(ii.reviewer_email(req(BOB)))
        os.environ["APP_ADMINS"] = BOB.upper()
        self.assertEqual(ii.reviewer_email(req(BOB)), BOB)
        denied = run(ii.list_ideate_reviews(req(ALICE)))
        self.assertEqual(denied.status_code, 403)

    def test_cross_owner_queue_detail_and_approval_history(self):
        self.save(idea())
        self.assertTrue(self.submit())
        queue = run(ii.list_ideate_reviews(req(BOB)))
        self.assertEqual(queue["ideas"][0]["owner"]["email"], ALICE)
        self.assertEqual(queue["ideas"][0]["idea"]["brief"], idea()["brief"])
        self.assertIn("score", queue["ideas"][0])
        detail = run(ii.get_ideate_review("idea-0001", req(BOB)))
        self.assertEqual(detail["review"]["status"], "pending")

        approved = run(ii.review_ideate_idea(
            "idea-0001",
            ii.ReviewActionRequest(action="approve", note="Ready for build"),
            req(BOB),
        ))
        self.assertEqual(approved["review"]["status"], "approved")
        self.assertEqual(approved["review"]["approvedRevision"], 1)
        self.assertEqual(approved["review"]["latestNote"], "Ready for build")
        self.assertEqual(
            [event["action"] for event in approved["review"]["history"]],
            ["submitted", "approved"],
        )

    def test_notes_required_for_changes_and_rejection(self):
        self.save(idea())
        self.submit()
        for action in ("request_changes", "reject"):
            out = run(ii.review_ideate_idea(
                "idea-0001", ii.ReviewActionRequest(action=action), req(BOB),
            ))
            self.assertEqual(out.status_code, 400)
        changed = run(ii.review_ideate_idea(
            "idea-0001",
            ii.ReviewActionRequest(action="request_changes", note="Add a kill criterion"),
            req(BOB),
        ))
        self.assertEqual(changed["review"]["status"], "changes_requested")
        self.assertEqual(changed["review"]["latestNote"], "Add a kill criterion")

    def test_rejection_records_note_and_can_be_resubmitted(self):
        self.save(idea())
        self.submit()
        rejected = run(ii.review_ideate_idea(
            "idea-0001",
            ii.ReviewActionRequest(action="reject", note="Not aligned to the program"),
            req(BOB),
        ))
        self.assertEqual(rejected["review"]["status"], "rejected")
        self.assertEqual(rejected["review"]["history"][-1]["action"], "rejected")
        self.save(idea(revision=2))
        self.assertTrue(self.submit(revision=2))
        self.assertEqual(ii._memory["idea-0001"]["review_status"], "pending")

    def test_frontend_aliases_and_response_contract(self):
        self.save(idea())
        self.submit()
        capability = run(ii.ideate_capabilities(req(BOB)))
        self.assertTrue(capability["canReview"])
        queue = run(ii.list_ideate_reviews(req(BOB), status="all"))
        item = queue["ideas"][0]
        self.assertEqual((item["id"], item["title"], item["review"]["revision"]), (
            "idea-0001", "Faster crew swaps", 1,
        ))
        self.assertFalse(item["isOwner"])
        changed = run(ii.review_ideate_idea(
            "idea-0001",
            ii.ReviewActionRequest(action="changes_requested", note="Tighten scope"),
            req(BOB),
        ))
        self.assertEqual(changed["review"]["history"][-1]["action"], "changes_requested")

    def test_stale_submitted_revision_cannot_be_approved_and_resubmit_returns_pending(self):
        self.save(idea())
        self.submit()
        self.save(idea(revision=2))
        stale = run(ii.review_ideate_idea(
            "idea-0001", ii.ReviewActionRequest(action="approve"), req(BOB),
        ))
        self.assertEqual(stale.status_code, 409)
        self.assertTrue(self.submit(revision=2))
        self.assertEqual(ii._memory["idea-0001"]["review_status"], "pending")
        self.assertEqual(ii._memory["idea-0001"]["submitted_revision"], 2)

    def test_build_authorization_owner_approval_and_staleness(self):
        self.save(idea())
        self.submit()
        self.assertEqual(run(ii.authorize_build("idea-0001", req(BOB))).status_code, 403)
        self.assertEqual(run(ii.authorize_build("idea-0001", req(ALICE))).status_code, 409)
        run(ii.review_ideate_idea(
            "idea-0001", ii.ReviewActionRequest(action="approve"), req(BOB),
        ))
        allowed = run(ii.authorize_build("idea-0001", req(ALICE)))
        self.assertTrue(allowed["authorized"])
        mismatch = run(ii.get_build_authorization("idea-0001", req(ALICE), revision=99, operation="update"))
        self.assertEqual(mismatch.status_code, 409)
        self.save(idea(revision=2))
        self.assertEqual(run(ii.authorize_build("idea-0001", req(ALICE))).status_code, 409)

    def test_save_blocks_new_build_link_but_preserves_existing_link(self):
        self.save(idea())
        blocked = self.save(idea(sessionId="session-new", lockedAt="now"))
        self.assertEqual(blocked.status_code, 409)
        self.submit()
        run(ii.review_ideate_idea(
            "idea-0001", ii.ReviewActionRequest(action="approve"), req(BOB),
        ))
        linked = self.save(idea(sessionId="session-1", lockedAt="now"))
        self.assertNotIsInstance(linked, ii.JSONResponse)
        # Existing builds remain saveable/reopenable even after the idea revision changes.
        reopened = self.save(idea(revision=2, sessionId="session-1", lockedAt="later", buildStage="studio"))
        self.assertNotIsInstance(reopened, ii.JSONResponse)
        # A different build/session remains governed.
        replacement = self.save(idea(revision=2, sessionId="session-2", lockedAt="later"))
        self.assertEqual(replacement.status_code, 409)

    def test_review_metadata_is_server_owned_and_legacy_rows_default_to_draft(self):
        out = self.save(idea(review={"status": "approved", "approvedRevision": 1}))
        self.assertEqual(out["review"]["status"], "draft")
        self.assertIsNone(out["review"]["approvedRevision"])
        fetched = run(ii.get_idea("idea-0001", req()))
        self.assertEqual(fetched["idea"]["review"]["status"], "draft")


if __name__ == "__main__":
    unittest.main()
