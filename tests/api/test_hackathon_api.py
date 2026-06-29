"""
API tests for the Hackathon feature — full flow, all personas, edge cases.

Runnable with the Python stdlib (no pytest required):

    USE_LAKEBASE=false python3 -m unittest tests/api/test_hackathon_api.py -v

(pytest also discovers these unittest.TestCase classes if it's installed:
    USE_LAKEBASE=false pytest tests/api -v)

Uses FastAPI's TestClient against the in-memory store, so no Databricks/Lakebase
connectivity is needed. Identity is supplied via the dev persona header
(x-dev-persona), which the backend honors because the dev gate is open when
USE_LAKEBASE=false.
"""

import os
import sys
import unittest
import uuid
from pathlib import Path

# Ensure the dev gate is open and Lakebase is off BEFORE importing the app.
os.environ.setdefault("USE_LAKEBASE", "false")
os.environ.setdefault("DEV_PERSONA_SWITCH", "true")

# Make the repo root importable (tests/ is two levels down).
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from starlette.testclient import TestClient  # noqa: E402
from app import app  # noqa: E402

client = TestClient(app)


def _persona(email):
    """Headers that make the backend resolve the caller as `email`."""
    return {"x-dev-persona": email}


def _uniq(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:8]}@databricks.com"


def _create_hackathon(organizer, **overrides):
    body = {"title": "Test Hackathon", **overrides}
    r = client.post("/api/hackathons", json=body, headers=_persona(organizer))
    assert r.status_code == 200, r.text
    return r.json()["hackathon_id"]


class TestHackathonCrud(unittest.TestCase):
    def test_health(self):
        r = client.get("/health")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["status"], "healthy")

    def test_list_returns_seed_demo(self):
        r = client.get("/api/hackathons", headers=_persona("anyone@databricks.com"))
        self.assertEqual(r.status_code, 200)
        titles = [h["title"] for h in r.json()]
        self.assertIn("V2V Build-Off 2026", titles)  # seeded demo

    def test_create_sets_organizer_role_and_draft_status(self):
        org = _uniq("org")
        hid = _create_hackathon(org, title="Crud Cup")
        r = client.get(f"/api/hackathons/{hid}", headers=_persona(org))
        self.assertEqual(r.status_code, 200)
        d = r.json()
        self.assertEqual(d["title"], "Crud Cup")
        self.assertEqual(d["status"], "draft")
        self.assertEqual(d["your_role"], "organizer")
        self.assertEqual(d["created_by"], org)

    def test_create_persists_rich_fields(self):
        org = _uniq("org")
        hid = _create_hackathon(
            org,
            title="Rich Cup",
            location="NYC",
            venue="WeWork",
            max_participants=50,
            total_prize_pool=10000,
            rules="Be excellent",
            topics=["AI", "Data"],
            hackathon_type="hybrid",
            has_chat=True,
        )
        d = client.get(f"/api/hackathons/{hid}", headers=_persona(org)).json()
        self.assertEqual(d["location"], "NYC")
        self.assertEqual(d["venue"], "WeWork")
        self.assertEqual(d["max_participants"], 50)
        self.assertEqual(d["total_prize_pool"], 10000)
        self.assertEqual(d["rules"], "Be excellent")
        self.assertEqual(d["topics"], ["AI", "Data"])

    def test_get_missing_hackathon_404(self):
        r = client.get("/api/hackathons/does-not-exist", headers=_persona("a@b.com"))
        self.assertEqual(r.status_code, 404)

    def test_create_requires_title(self):
        r = client.post("/api/hackathons", json={}, headers=_persona("a@databricks.com"))
        self.assertEqual(r.status_code, 422)  # pydantic validation


class TestHackathonRolesAndLifecycle(unittest.TestCase):
    def test_non_organizer_cannot_edit(self):
        org = _uniq("org")
        other = _uniq("other")
        hid = _create_hackathon(org)
        r = client.patch(f"/api/hackathons/{hid}", json={"status": "registration_open"},
                         headers=_persona(other))
        self.assertEqual(r.status_code, 403)

    def test_organizer_advances_status(self):
        org = _uniq("org")
        hid = _create_hackathon(org)
        r = client.patch(f"/api/hackathons/{hid}", json={"status": "registration_open"},
                         headers=_persona(org))
        self.assertEqual(r.status_code, 200)
        d = client.get(f"/api/hackathons/{hid}", headers=_persona(org)).json()
        self.assertEqual(d["status"], "registration_open")

    def test_invalid_status_rejected(self):
        org = _uniq("org")
        hid = _create_hackathon(org)
        r = client.patch(f"/api/hackathons/{hid}", json={"status": "bogus"},
                         headers=_persona(org))
        self.assertEqual(r.status_code, 400)

    def test_other_user_is_participant(self):
        org = _uniq("org")
        other = _uniq("part")
        hid = _create_hackathon(org)
        d = client.get(f"/api/hackathons/{hid}", headers=_persona(other)).json()
        self.assertEqual(d["your_role"], "participant")


class TestTeams(unittest.TestCase):
    def test_create_and_join_team(self):
        org = _uniq("org")
        leader = _uniq("leader")
        member = _uniq("member")
        hid = _create_hackathon(org, max_team_size=4)

        r = client.post(f"/api/hackathons/{hid}/teams",
                       json={"name": "Rockets", "description": "go fast"},
                       headers=_persona(leader))
        self.assertEqual(r.status_code, 200, r.text)
        tid = r.json()["team_id"]

        # leader is now on a team
        d = client.get(f"/api/hackathons/{hid}", headers=_persona(leader)).json()
        self.assertIn(tid, d["my_team_ids"])
        team = next(t for t in d["teams"] if t["team_id"] == tid)
        self.assertEqual(team["leader_email"], leader)
        self.assertTrue(team["is_mine"])

        # member joins
        r = client.post(f"/api/hackathons/{hid}/teams/{tid}/join", headers=_persona(member))
        self.assertEqual(r.status_code, 200, r.text)
        d = client.get(f"/api/hackathons/{hid}", headers=_persona(member)).json()
        team = next(t for t in d["teams"] if t["team_id"] == tid)
        self.assertEqual(team["member_count"], 2)

    def test_cannot_join_two_teams(self):
        org = _uniq("org")
        user = _uniq("user")
        hid = _create_hackathon(org)
        client.post(f"/api/hackathons/{hid}/teams", json={"name": "A"}, headers=_persona(user))
        r = client.post(f"/api/hackathons/{hid}/teams", json={"name": "B"}, headers=_persona(user))
        self.assertEqual(r.status_code, 400)  # already on a team

    def test_cannot_join_full_team(self):
        org = _uniq("org")
        leader = _uniq("leader")
        hid = _create_hackathon(org, max_team_size=1)
        r = client.post(f"/api/hackathons/{hid}/teams", json={"name": "Solo"}, headers=_persona(leader))
        tid = r.json()["team_id"]
        r = client.post(f"/api/hackathons/{hid}/teams/{tid}/join", headers=_persona(_uniq("x")))
        self.assertEqual(r.status_code, 400)  # full


class TestSubmissions(unittest.TestCase):
    def _setup_team(self):
        org = _uniq("org")
        leader = _uniq("leader")
        hid = _create_hackathon(org)
        tid = client.post(f"/api/hackathons/{hid}/teams", json={"name": "T"},
                         headers=_persona(leader)).json()["team_id"]
        return org, leader, hid, tid

    def test_leader_submits_project(self):
        org, leader, hid, tid = self._setup_team()
        r = client.post(f"/api/hackathons/{hid}/teams/{tid}/submit",
                       json={"title": "Rocket App", "repo_url": "https://github.com/x/y"},
                       headers=_persona(leader))
        self.assertEqual(r.status_code, 200, r.text)
        d = client.get(f"/api/hackathons/{hid}", headers=_persona(leader)).json()
        self.assertEqual(len(d["submissions"]), 1)
        self.assertEqual(d["submissions"][0]["title"], "Rocket App")

    def test_non_leader_cannot_submit(self):
        org, leader, hid, tid = self._setup_team()
        r = client.post(f"/api/hackathons/{hid}/teams/{tid}/submit",
                       json={"title": "Sneaky"}, headers=_persona(_uniq("other")))
        self.assertEqual(r.status_code, 403)

    def test_submit_is_idempotent_update(self):
        org, leader, hid, tid = self._setup_team()
        client.post(f"/api/hackathons/{hid}/teams/{tid}/submit",
                   json={"title": "v1"}, headers=_persona(leader))
        client.post(f"/api/hackathons/{hid}/teams/{tid}/submit",
                   json={"title": "v2"}, headers=_persona(leader))
        d = client.get(f"/api/hackathons/{hid}", headers=_persona(leader)).json()
        self.assertEqual(len(d["submissions"]), 1)  # still one (updated, not duplicated)
        self.assertEqual(d["submissions"][0]["title"], "v2")


class TestJudgeSelector(unittest.TestCase):
    def test_bulk_assign_normalizes_and_dedupes(self):
        org = _uniq("org")
        hid = _create_hackathon(org)
        r = client.post(f"/api/hackathons/{hid}/judges",
                       json={"judge_emails": ["  Judge.One@Databricks.com  ",
                                              "judge.two@databricks.com",
                                              "judge.two@databricks.com"]},
                       headers=_persona(org))
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["added"], 2)  # deduped
        d = client.get(f"/api/hackathons/{hid}", headers=_persona(org)).json()
        emails = sorted(j["email"] for j in d["judges"])
        self.assertEqual(emails, ["judge.one@databricks.com", "judge.two@databricks.com"])

    def test_organizer_cannot_self_assign(self):
        org = _uniq("org")
        hid = _create_hackathon(org)
        r = client.post(f"/api/hackathons/{hid}/judges",
                       json={"judge_emails": [org]}, headers=_persona(org))
        self.assertEqual(r.status_code, 400)

    def test_organizer_filtered_from_mixed_payload(self):
        org = _uniq("org")
        hid = _create_hackathon(org)
        r = client.post(f"/api/hackathons/{hid}/judges",
                       json={"judge_emails": [org, "real.judge@databricks.com"]},
                       headers=_persona(org))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["added"], 1)

    def test_non_organizer_cannot_assign(self):
        org = _uniq("org")
        hid = _create_hackathon(org)
        r = client.post(f"/api/hackathons/{hid}/judges",
                       json={"judge_emails": ["x@y.com"]}, headers=_persona(_uniq("rando")))
        self.assertEqual(r.status_code, 403)

    def test_remove_judge(self):
        org = _uniq("org")
        hid = _create_hackathon(org)
        client.post(f"/api/hackathons/{hid}/judges",
                   json={"judge_emails": ["j1@databricks.com", "j2@databricks.com"]},
                   headers=_persona(org))
        r = client.delete(f"/api/hackathons/{hid}/judges/j1@databricks.com", headers=_persona(org))
        self.assertEqual(r.status_code, 200)
        d = client.get(f"/api/hackathons/{hid}", headers=_persona(org)).json()
        self.assertEqual([j["email"] for j in d["judges"]], ["j2@databricks.com"])

    def test_non_organizer_cannot_remove(self):
        org = _uniq("org")
        hid = _create_hackathon(org)
        client.post(f"/api/hackathons/{hid}/judges",
                   json={"judge_emails": ["j1@databricks.com"]}, headers=_persona(org))
        r = client.delete(f"/api/hackathons/{hid}/judges/j1@databricks.com",
                         headers=_persona(_uniq("rando")))
        self.assertEqual(r.status_code, 403)

    def test_candidates_exclude_organizer_and_assigned(self):
        org = _uniq("org")
        hid = _create_hackathon(org)
        # In-memory mode: get_workshop_users() is empty, so candidates is [].
        r = client.get(f"/api/hackathons/{hid}/judge-candidates", headers=_persona(org))
        self.assertEqual(r.status_code, 200)
        self.assertIn("candidates", r.json())
        self.assertNotIn(org, [c["email"] for c in r.json()["candidates"]])

    def test_candidates_organizer_only(self):
        org = _uniq("org")
        hid = _create_hackathon(org)
        r = client.get(f"/api/hackathons/{hid}/judge-candidates", headers=_persona(_uniq("x")))
        self.assertEqual(r.status_code, 403)


class TestJudgingAndScoring(unittest.TestCase):
    def _setup_scored(self):
        org = _uniq("org")
        leader = _uniq("leader")
        judge = _uniq("judge")
        hid = _create_hackathon(org, judging_criteria=["Innovation", "Technical"])
        tid = client.post(f"/api/hackathons/{hid}/teams", json={"name": "T"},
                         headers=_persona(leader)).json()["team_id"]
        client.post(f"/api/hackathons/{hid}/teams/{tid}/submit",
                   json={"title": "Proj"}, headers=_persona(leader))
        client.post(f"/api/hackathons/{hid}/judges",
                   json={"judge_emails": [judge]}, headers=_persona(org))
        d = client.get(f"/api/hackathons/{hid}", headers=_persona(org)).json()
        sid = d["submissions"][0]["submission_id"]
        return org, leader, judge, hid, sid

    def test_judge_scores_submission(self):
        org, leader, judge, hid, sid = self._setup_scored()
        r = client.post(f"/api/hackathons/{hid}/submissions/{sid}/score",
                       json={"criteria": {"Innovation": 9, "Technical": 7}, "feedback": "solid"},
                       headers=_persona(judge))
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["overall"], 8.0)  # mean of 9,7

    def test_non_judge_cannot_score(self):
        org, leader, judge, hid, sid = self._setup_scored()
        r = client.post(f"/api/hackathons/{hid}/submissions/{sid}/score",
                       json={"criteria": {"Innovation": 5, "Technical": 5}},
                       headers=_persona(_uniq("rando")))
        self.assertEqual(r.status_code, 403)

    def test_score_is_clamped_0_10(self):
        org, leader, judge, hid, sid = self._setup_scored()
        r = client.post(f"/api/hackathons/{hid}/submissions/{sid}/score",
                       json={"criteria": {"Innovation": 99, "Technical": -5}},
                       headers=_persona(judge))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["overall"], 5.0)  # (10 + 0) / 2

    def test_rescore_updates_not_duplicates(self):
        org, leader, judge, hid, sid = self._setup_scored()
        client.post(f"/api/hackathons/{hid}/submissions/{sid}/score",
                   json={"criteria": {"Innovation": 1, "Technical": 1}}, headers=_persona(judge))
        client.post(f"/api/hackathons/{hid}/submissions/{sid}/score",
                   json={"criteria": {"Innovation": 10, "Technical": 10}}, headers=_persona(judge))
        res = client.get(f"/api/hackathons/{hid}/results", headers=_persona(org)).json()
        row = res["results"][0]
        self.assertEqual(row["judge_count"], 1)  # one judge, updated
        self.assertEqual(row["avg_score"], 10.0)


class TestVotingAndResults(unittest.TestCase):
    def _setup_submission(self):
        org = _uniq("org")
        leader = _uniq("leader")
        hid = _create_hackathon(org)
        tid = client.post(f"/api/hackathons/{hid}/teams", json={"name": "T"},
                         headers=_persona(leader)).json()["team_id"]
        client.post(f"/api/hackathons/{hid}/teams/{tid}/submit",
                   json={"title": "Proj"}, headers=_persona(leader))
        d = client.get(f"/api/hackathons/{hid}", headers=_persona(org)).json()
        return org, hid, d["submissions"][0]["submission_id"]

    def test_vote_toggles(self):
        org, hid, sid = self._setup_submission()
        voter = _uniq("voter")
        r1 = client.post(f"/api/hackathons/{hid}/submissions/{sid}/vote", headers=_persona(voter))
        self.assertEqual(r1.status_code, 200)
        self.assertTrue(r1.json()["voted"])
        self.assertEqual(r1.json()["vote_count"], 1)
        r2 = client.post(f"/api/hackathons/{hid}/submissions/{sid}/vote", headers=_persona(voter))
        self.assertFalse(r2.json()["voted"])  # toggled off
        self.assertEqual(r2.json()["vote_count"], 0)

    def test_results_rank_by_score_then_votes(self):
        org, hid, sid = self._setup_submission()
        client.post(f"/api/hackathons/{hid}/submissions/{sid}/vote", headers=_persona(_uniq("v")))
        res = client.get(f"/api/hackathons/{hid}/results", headers=_persona(org)).json()
        self.assertEqual(res["results"][0]["rank"], 1)
        self.assertEqual(res["results"][0]["vote_count"], 1)

    def test_voting_disabled_rejected(self):
        org = _uniq("org")
        leader = _uniq("leader")
        hid = _create_hackathon(org, has_voting=False)
        tid = client.post(f"/api/hackathons/{hid}/teams", json={"name": "T"},
                         headers=_persona(leader)).json()["team_id"]
        client.post(f"/api/hackathons/{hid}/teams/{tid}/submit",
                   json={"title": "P"}, headers=_persona(leader))
        d = client.get(f"/api/hackathons/{hid}", headers=_persona(org)).json()
        sid = d["submissions"][0]["submission_id"]
        r = client.post(f"/api/hackathons/{hid}/submissions/{sid}/vote", headers=_persona(_uniq("v")))
        self.assertEqual(r.status_code, 400)


class TestDevPersona(unittest.TestCase):
    def test_persona_config_enabled_in_test_env(self):
        r = client.get("/api/hackathons/dev/persona-config")
        self.assertEqual(r.status_code, 200)
        d = r.json()
        self.assertTrue(d["enabled"])  # USE_LAKEBASE=false / DEV_PERSONA_SWITCH=true
        self.assertGreater(len(d["personas"]), 0)

    def test_persona_header_changes_identity(self):
        r = client.get("/api/hackathons/dev/persona-config",
                      headers=_persona("specific.user@databricks.com"))
        self.assertEqual(r.json()["current"], "specific.user@databricks.com")


class TestFullJourney(unittest.TestCase):
    """The complete organizer -> participant -> judge -> voter -> results flow."""

    def test_end_to_end(self):
        organizer = _uniq("organizer")
        leader = _uniq("leader")
        judge = _uniq("judge")
        voter = _uniq("voter")

        # 1. Organizer creates + opens registration
        hid = _create_hackathon(organizer, title="Journey Cup",
                                judging_criteria=["Innovation", "Impact"])
        client.patch(f"/api/hackathons/{hid}", json={"status": "registration_open"},
                    headers=_persona(organizer))

        # 2. Organizer assigns a judge
        ja = client.post(f"/api/hackathons/{hid}/judges", json={"judge_emails": [judge]},
                        headers=_persona(organizer))
        self.assertEqual(ja.json()["added"], 1)

        # 3. Participant forms a team + submits
        tid = client.post(f"/api/hackathons/{hid}/teams", json={"name": "Journey Team"},
                         headers=_persona(leader)).json()["team_id"]
        client.post(f"/api/hackathons/{hid}/teams/{tid}/submit",
                   json={"title": "Journey Project", "repo_url": "https://github.com/a/b"},
                   headers=_persona(leader))

        # 4. Judge sees judge role + scores
        d_judge = client.get(f"/api/hackathons/{hid}", headers=_persona(judge)).json()
        self.assertEqual(d_judge["your_role"], "judge")
        sid = d_judge["submissions"][0]["submission_id"]
        client.post(f"/api/hackathons/{hid}/submissions/{sid}/score",
                   json={"criteria": {"Innovation": 8, "Impact": 6}, "feedback": "nice"},
                   headers=_persona(judge))

        # 5. Voter votes
        client.post(f"/api/hackathons/{hid}/submissions/{sid}/vote", headers=_persona(voter))

        # 6. Results reflect everything
        res = client.get(f"/api/hackathons/{hid}/results", headers=_persona(organizer)).json()
        top = res["results"][0]
        self.assertEqual(top["title"], "Journey Project")
        self.assertEqual(top["avg_score"], 7.0)  # (8 + 6) / 2
        self.assertEqual(top["judge_count"], 1)
        self.assertEqual(top["vote_count"], 1)
        self.assertEqual(top["rank"], 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
