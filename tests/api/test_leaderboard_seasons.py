"""
API tests for leaderboard seasons: snapshot, archive and reset, restore, and the admin gate.

    USE_LAKEBASE=false DEV_PERSONA_SWITCH=true python3 -m unittest tests.api.test_leaderboard_seasons -v

Runs on the in-memory fallbacks; the Insights board is exercised end to end, the
technical board's Lakebase query is monkeypatched.
"""

import asyncio
import os
import sys
import time
import unittest
from pathlib import Path

os.environ.setdefault("USE_LAKEBASE", "false")
os.environ.setdefault("DEV_PERSONA_SWITCH", "true")

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from starlette.requests import Request  # noqa: E402

from src.backend.api import ideate_ideas as ii  # noqa: E402
from src.backend.api import leaderboard_seasons as ls  # noqa: E402
from src.backend.services import lakebase  # noqa: E402

ADMIN = "admin@example.com"
ALICE = "alice@example.com"


def req(user: str = ADMIN) -> Request:
    headers = [(b"x-dev-persona", user.encode())] if user else []
    return Request({"type": "http", "method": "POST", "path": "/", "headers": headers, "query_string": b""})


def run(coro):
    return asyncio.run(coro)


def idea(i: str, created: str, approved=("spark", "map")):
    return {"id": i, "mode": "ideate", "title": i, "approved": list(approved), "step": "shape",
            "createdAt": created, "answers": {}, "assumptions": [], "decisions": []}


class Base(unittest.TestCase):
    def setUp(self):
        self._saved = (ii._ensure_table, ls._ensure_table, ii._library_approved, lakebase.get_leaderboard, os.environ.get("APP_ADMINS"))
        ii._ensure_table = lambda: None
        ls._ensure_table = lambda: None
        ii._library_approved = lambda: set()
        self.tech_calls = []

        def fake_tech(limit=10, since=None):
            self.tech_calls.append(since)
            return [{"rank": 1, "user_id": ALICE, "score": 120}]

        lakebase.get_leaderboard = fake_tech
        os.environ.pop("APP_ADMINS", None)
        ii._memory.clear()
        ls._memory.clear()
        ii._leaderboard_cache.clear()

    def tearDown(self):
        ii._ensure_table, ls._ensure_table, ii._library_approved, lakebase.get_leaderboard, admins = self._saved
        if admins is None:
            os.environ.pop("APP_ADMINS", None)
        else:
            os.environ["APP_ADMINS"] = admins

    def save(self, data, user=ALICE):
        return run(ii.save_idea(data["id"], ii.SaveIdeaRequest(idea=data), req(user)))

    def board(self):
        ii._leaderboard_cache.clear()
        return [r["idea_id"] for r in run(ii.insights_leaderboard(req(ALICE)))]


class TestSeasons(Base):
    def test_reset_archives_and_hides_older_ideas_without_deleting(self):
        self.save(idea("old-idea", "2020-01-01T00:00:00Z"))
        self.assertEqual(self.board(), ["old-idea"])

        out = run(ls.reset("insights", ls.NameRequest(name="Cohort 2"), req()))
        archived = out["reset"][0]["archived"]
        self.assertEqual(archived["entryCount"], 1)
        self.assertEqual(self.board(), [])
        self.assertIn("old-idea", ii._memory)  # still stored

        time.sleep(0.01)
        self.save(idea("new-idea", "2999-01-01T00:00:00Z"))
        self.assertEqual(self.board(), ["new-idea"])

        frozen = run(ls.get_season(archived["id"]))
        self.assertEqual([e["idea_id"] for e in frozen["entries"]], ["old-idea"])
        self.assertNotIn("is_mine", frozen["entries"][0])

        seasons = run(ls.list_seasons("insights", req()))
        self.assertEqual(seasons["current"]["name"], "Cohort 2")
        self.assertEqual([a["id"] for a in seasons["archive"]], [archived["id"]])
        self.assertTrue(seasons["canManage"])

    def test_restore_reopens_the_season_and_archives_the_current_one(self):
        self.save(idea("old-idea", "2020-01-01T00:00:00Z"))
        first = run(ls.reset("insights", ls.NameRequest(), req()))["reset"][0]["archived"]
        self.assertEqual(self.board(), [])

        out = run(ls.restore(first["id"], req()))
        self.assertEqual(out["archived"]["board"], "insights")
        self.assertTrue(out["current"]["name"].endswith("(restored)"))
        self.assertEqual(self.board(), ["old-idea"])
        self.assertEqual(len(run(ls.list_seasons("insights", req()))["archive"]), 2)

    def test_snapshot_keeps_the_live_board(self):
        self.save(idea("an-idea", "2020-01-01T00:00:00Z"))
        snap = run(ls.snapshot("insights", ls.NameRequest(name="Midday"), req()))["saved"][0]
        self.assertEqual((snap["kind"], snap["entryCount"]), ("snapshot", 1))
        self.assertEqual(self.board(), ["an-idea"])
        self.assertIsNone(run(ls.list_seasons("insights", req()))["current"])
        self.assertEqual(run(ls.restore(snap["id"], req())).status_code, 400)

    def test_technical_board_uses_season_start(self):
        self.assertIsNone(ls.season_start("technical"))
        out = run(ls.reset("all", ls.NameRequest(), req()))
        self.assertEqual({r["current"]["board"] for r in out["reset"]}, {"technical", "insights"})
        self.assertIsNotNone(ls.season_start("technical"))
        self.assertEqual(out["reset"][0]["archived"]["entryCount"], 1)
        self.assertIsNone(self.tech_calls[0])  # archived the all-time board


class TestAdminGate(Base):
    def test_requires_sign_in(self):
        self.assertEqual(run(ls.reset("insights", ls.NameRequest(), req(""))).status_code, 401)

    def test_allowlist(self):
        os.environ["APP_ADMINS"] = ADMIN
        self.assertEqual(run(ls.reset("insights", ls.NameRequest(), req(ALICE))).status_code, 403)
        self.assertFalse(run(ls.list_seasons("insights", req(ALICE)))["canManage"])
        self.assertIn("reset", run(ls.reset("insights", ls.NameRequest(), req(ADMIN))))

    def test_unknown_board(self):
        self.assertEqual(run(ls.reset("nope", ls.NameRequest(), req())).status_code, 404)


if __name__ == "__main__":
    unittest.main()
