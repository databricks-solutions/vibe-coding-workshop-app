"""
Hackathon feature API for the Vibe Coding Workshop.

Reachable from the bottom of the front page. Supports four personas, all scoped
*per hackathon* (no global RBAC):
  - Organizer  : whoever created the hackathon (hackathons.created_by)
  - Judge      : an email the organizer added to hackathon_judges
  - Participant: any signed-in user who creates/joins a team and submits
  - Voter      : any signed-in user (community people's-choice votes)

Persistence mirrors the rest of the app: raw SQL over Lakebase when configured,
otherwise an in-memory store so the feature is fully demoable locally with
`USE_LAKEBASE=false`. All access goes through the `store` object below, so the
endpoint code is identical in both modes.
"""

import os
import uuid
import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter()

# LLM helper for the AI-assist ("✨ Generate with AI") buttons. Reuses the same
# Databricks Model Serving call the rest of the app uses; degrades gracefully to
# a friendly message when no endpoint is configured (local dev).
try:
    from src.backend.api.routes import call_databricks_serving_endpoint
    LLM_AVAILABLE = True
except Exception:  # pragma: no cover
    LLM_AVAILABLE = False

    async def call_databricks_serving_endpoint(*args, **kwargs):  # type: ignore
        return {"response": "", "model": "none", "usage": None}

# Reuse the same user-resolution helper as the rest of the API.
try:
    from src.backend.api.routes import _get_session_user
except Exception:  # pragma: no cover - fallback if import order changes
    def _get_session_user(request: Request) -> str:  # type: ignore
        for h in ("x-forwarded-email", "x-forwarded-user", "x-user-email"):
            v = request.headers.get(h, "")
            if v and "@" in v:
                return v
        return os.getenv("PGUSER", "") or "local@workshop.dev"


def _dev_auth_enabled() -> bool:
    """Dev-only persona switching gate.

    Enabled when Lakebase is OFF (local two-server dev) or DEV_PERSONA_SWITCH is
    explicitly truthy. It can NEVER be on in a real Databricks Apps deployment,
    where Lakebase is configured. This lets local dev + Playwright act as any
    persona via the `x-dev-persona` header without touching production auth.
    """
    if os.getenv("DEV_PERSONA_SWITCH", "").lower() in ("1", "true", "yes"):
        return True
    return os.getenv("USE_LAKEBASE", "true").lower() == "false" and not is_lakebase_configured()


def _resolve_user(request: Request) -> str:
    """Caller email, honoring the dev persona override when the gate is open."""
    if _dev_auth_enabled():
        dev = request.headers.get("x-dev-persona", "")
        if dev and "@" in dev:
            return dev.strip().lower()
    return _get_session_user(request)

try:
    from src.backend.services.lakebase import (
        is_lakebase_configured,
        execute_query,
        execute_insert,
        get_schema,
    )
    LAKEBASE_AVAILABLE = True
except Exception:  # pragma: no cover
    LAKEBASE_AVAILABLE = False

    def is_lakebase_configured() -> bool:  # type: ignore
        return False


DEFAULT_CRITERIA = ["Innovation", "Technical", "Presentation", "Impact"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return str(uuid.uuid4())


# =============================================================================
# Storage layer: Lakebase-backed or in-memory, behind one interface.
# =============================================================================

def _use_db() -> bool:
    return LAKEBASE_AVAILABLE and is_lakebase_configured()


class _MemoryStore:
    """Dict-of-lists store used when Lakebase is not configured (local dev)."""

    def __init__(self):
        self.hackathons: List[Dict] = []
        self.judges: List[Dict] = []
        self.teams: List[Dict] = []
        self.members: List[Dict] = []
        self.submissions: List[Dict] = []
        self.scores: List[Dict] = []
        self.votes: List[Dict] = []
        self._seed()

    def _seed(self):
        """A handful of rich, varied demo hackathons across the lifecycle, so the
        list, detail, judging, and results screens all look alive out of the box
        (local/in-memory mode only — Lakebase/prod starts empty)."""
        DEMO_ORG = "demo-organizer@databricks.com"

        def _hackathon(hid, **kw):
            row = {
                "hackathon_id": hid, "status": "registration_open",
                "hackathon_type": "hybrid", "location": "", "venue": "",
                "registration_start": None, "registration_end": None,
                "start_date": None, "end_date": None, "submission_deadline": None,
                "max_participants": 100, "max_team_size": 4, "min_team_size": 1,
                "total_prize_pool": 0, "prize_description": "", "rules": "",
                "topics": [], "judging_criteria": list(DEFAULT_CRITERIA),
                "has_team_matching": True, "has_chat": True, "has_voting": True,
                "created_by": DEMO_ORG, "created_at": _now(), "updated_at": _now(),
                "description": "", "short_description": "",
            }
            row.update(kw)
            self.hackathons.append(row)
            return hid

        def _team(hid, tid, name, leader, members, max_members=4):
            self.teams.append({
                "team_id": tid, "hackathon_id": hid, "name": name,
                "description": f"{name} — a passionate build team.",
                "leader_email": leader, "max_members": max_members,
                "is_public": True, "created_at": _now(),
            })
            self.members.append({"team_id": tid, "member_email": leader,
                                 "role": "leader", "joined_at": _now()})
            for m in members:
                self.members.append({"team_id": tid, "member_email": m,
                                     "role": "member", "joined_at": _now()})

        def _submission(hid, tid, sid, leader, title, desc):
            self.submissions.append({
                "submission_id": sid, "hackathon_id": hid, "team_id": tid,
                "submitted_by": leader, "title": title, "description": desc,
                "repo_url": "https://github.com/databricks-solutions/vibe-coding-workshop-app",
                "demo_url": "https://example.com/demo", "video_url": "",
                "slides_url": "", "is_submitted": True,
                "created_at": _now(), "updated_at": _now(),
            })

        def _score(sid, judge, criteria, feedback, ai=False):
            overall = round(sum(criteria.values()) / len(criteria), 2) if criteria else 0.0
            self.scores.append({
                "score_id": _new_id(), "submission_id": sid, "judge_email": judge,
                "criteria": criteria, "overall": overall, "feedback": feedback,
                "ai_assisted": ai, "created_at": _now(), "updated_at": _now(),
            })

        def _votes(sid, voters):
            for v in voters:
                self.votes.append({"submission_id": sid, "voter_email": v,
                                   "created_at": _now()})

        # --- 1) Registration open: the flagship, accepting teams -------------
        h1 = _hackathon(
            "demo-hackathon-0001", title="V2V Build-Off 2026",
            short_description="A one-day Databricks build-off.",
            description="Ship a data + AI app on Databricks in a day. Best end-to-end Vibe-to-Value build wins.",
            status="registration_open", location="San Francisco, CA", venue="Databricks HQ",
            max_participants=120, total_prize_pool=5000,
            prize_description="Glory, swag, and bragging rights.",
            rules="Build something new during the event. AI assistants encouraged. One submission per team.",
            topics=["Data Engineering", "GenAI", "Analytics"],
        )
        _team(h1, "demo-t1a", "The Data Wranglers", "sam.participant@databricks.com",
              ["riley.participant@databricks.com"])
        _team(h1, "demo-t1b", "Lakehouse Llamas", "morgan.builder@databricks.com", [])

        # --- 2) In progress: teams heads-down building -----------------------
        h2 = _hackathon(
            "demo-hackathon-0002", title="GenAI Agents Sprint",
            short_description="48 hours to build a production agent.",
            description="Design, build, and trace a GenAI agent on Databricks. Bonus for MLflow evaluation.",
            status="in_progress", hackathon_type="online", max_participants=80,
            total_prize_pool=10000, prize_description="$10k prize pool + mentorship",
            topics=["GenAI", "Agents", "MLflow"],
            judging_criteria=["Innovation", "Technical", "Impact"],
        )
        _team(h2, "demo-t2a", "Prompt Pilots", "sam.participant@databricks.com", [])
        _submission(h2, "demo-t2a", "demo-s2a", "sam.participant@databricks.com",
                    "SupportSense Agent",
                    "A support-triage agent with tool-calling over the docs Vector Search index.")

        # --- 3) Judging: submissions in, judges scoring ----------------------
        h3 = _hackathon(
            "demo-hackathon-0003", title="Lakehouse Analytics Cup",
            short_description="Best AI/BI dashboard + Genie space wins.",
            description="Turn raw data into insight: medallion pipeline, AI/BI dashboard, and a Genie space.",
            status="judging", hackathon_type="hybrid", location="Austin, TX",
            venue="Convention Center", total_prize_pool=7500,
            prize_description="Cash + a conference pass", topics=["Analytics", "Genie", "AI/BI"],
            judging_criteria=["Innovation", "Technical", "Presentation", "Impact"],
        )
        self.judges.append({"hackathon_id": h3, "judge_email": "jordan.judge@databricks.com",
                            "status": "active", "assigned_by": DEMO_ORG, "created_at": _now()})
        _team(h3, "demo-t3a", "Insight Engine", "sam.participant@databricks.com", [])
        _team(h3, "demo-t3b", "Query Quokkas", "morgan.builder@databricks.com", [])
        _submission(h3, "demo-t3a", "demo-s3a", "sam.participant@databricks.com",
                    "ChurnLens", "Customer-churn dashboard with a Genie space for ad-hoc questions.")
        _submission(h3, "demo-t3b", "demo-s3b", "morgan.builder@databricks.com",
                    "RevenuePulse", "Real-time revenue analytics with anomaly alerts.")
        _score("demo-s3a", "jordan.judge@databricks.com",
               {"Innovation": 8, "Technical": 9, "Presentation": 7, "Impact": 8},
               "Strong technical execution; tighten the demo narrative.")
        _votes("demo-s3a", ["casey.voter@databricks.com", "riley.participant@databricks.com"])
        _votes("demo-s3b", ["sam.participant@databricks.com"])

        # --- 4) Completed: a finished event with a clear winner --------------
        h4 = _hackathon(
            "demo-hackathon-0004", title="Reverse ETL Rumble 2025",
            short_description="Last year's champions — see the results.",
            description="Sync gold tables back to operational apps. A completed event, kept for reference.",
            status="completed", hackathon_type="online", total_prize_pool=3000,
            prize_description="Winner's trophy", topics=["Reverse ETL", "Apps"],
            judging_criteria=["Innovation", "Technical", "Impact"],
        )
        self.judges.append({"hackathon_id": h4, "judge_email": "jordan.judge@databricks.com",
                            "status": "active", "assigned_by": DEMO_ORG, "created_at": _now()})
        _team(h4, "demo-t4a", "Sync Squad", "sam.participant@databricks.com", [])
        _team(h4, "demo-t4b", "Pipeline Pros", "morgan.builder@databricks.com", [])
        _submission(h4, "demo-t4a", "demo-s4a", "sam.participant@databricks.com",
                    "ActivateAI", "One-click reverse-ETL from gold tables to a CRM, with a control app.")
        _submission(h4, "demo-t4b", "demo-s4b", "morgan.builder@databricks.com",
                    "SyncFlow", "Scheduled syncs with lineage-aware change detection.")
        _score("demo-s4a", "jordan.judge@databricks.com",
               {"Innovation": 9, "Technical": 9, "Impact": 10},
               "Outstanding — production-ready and genuinely useful. Clear winner.")
        _score("demo-s4b", "jordan.judge@databricks.com",
               {"Innovation": 7, "Technical": 8, "Impact": 7},
               "Solid engineering; would love to see the user-facing story fleshed out.")
        _votes("demo-s4a", ["casey.voter@databricks.com", "riley.participant@databricks.com",
                            "morgan.builder@databricks.com"])
        _votes("demo-s4b", ["sam.participant@databricks.com"])

    # --- generic helpers operating on the in-memory lists -------------------
    @staticmethod
    def _match(rows: List[Dict], **kw) -> List[Dict]:
        return [r for r in rows if all(r.get(k) == v for k, v in kw.items())]


_memory = _MemoryStore()


class HackathonStore:
    """Facade dispatching to Lakebase or the in-memory store."""

    # ---- hackathons --------------------------------------------------------
    def list_hackathons(self) -> List[Dict]:
        if _use_db():
            s = get_schema()
            return execute_query(
                f"SELECT * FROM {s}.hackathons ORDER BY created_at DESC"
            )
        return sorted(_memory.hackathons, key=lambda r: r["created_at"], reverse=True)

    def get_hackathon(self, hid: str) -> Optional[Dict]:
        if _use_db():
            s = get_schema()
            rows = execute_query(
                f"SELECT * FROM {s}.hackathons WHERE hackathon_id = %s", (hid,)
            )
            return rows[0] if rows else None
        rows = _MemoryStore._match(_memory.hackathons, hackathon_id=hid)
        return rows[0] if rows else None

    def create_hackathon(self, row: Dict) -> None:
        if _use_db():
            s = get_schema()
            execute_insert(
                f"""INSERT INTO {s}.hackathons
                    (hackathon_id, title, description, short_description, status,
                     hackathon_type, location, venue, registration_start,
                     registration_end, start_date, end_date, submission_deadline,
                     max_participants, max_team_size, min_team_size,
                     total_prize_pool, prize_description, rules, topics,
                     judging_criteria, has_team_matching, has_chat, has_voting,
                     created_by, created_at, updated_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                            %s::jsonb,%s::jsonb,%s,%s,%s,%s,%s,%s)""",
                (
                    row["hackathon_id"], row["title"], row["description"],
                    row["short_description"], row["status"], row["hackathon_type"],
                    row["location"], row["venue"], row["registration_start"],
                    row["registration_end"], row["start_date"], row["end_date"],
                    row["submission_deadline"], row["max_participants"],
                    row["max_team_size"], row["min_team_size"],
                    row["total_prize_pool"], row["prize_description"], row["rules"],
                    _json(row["topics"]), _json(row["judging_criteria"]),
                    row["has_team_matching"], row["has_chat"], row["has_voting"],
                    row["created_by"], row["created_at"], row["updated_at"],
                ),
            )
            return
        _memory.hackathons.append(dict(row))

    def update_hackathon(self, hid: str, fields: Dict) -> None:
        fields = {**fields, "updated_at": _now()}
        if _use_db():
            s = get_schema()
            sets, params = [], []
            for k, v in fields.items():
                if k in ("judging_criteria", "topics"):
                    sets.append(f"{k} = %s::jsonb")
                    params.append(_json(v))
                else:
                    sets.append(f"{k} = %s")
                    params.append(v)
            params.append(hid)
            execute_insert(
                f"UPDATE {s}.hackathons SET {', '.join(sets)} WHERE hackathon_id = %s",
                tuple(params),
            )
            return
        for r in _memory.hackathons:
            if r["hackathon_id"] == hid:
                r.update(fields)

    # ---- judges ------------------------------------------------------------
    def list_judges(self, hid: str) -> List[Dict]:
        if _use_db():
            s = get_schema()
            return execute_query(
                f"SELECT * FROM {s}.hackathon_judges WHERE hackathon_id = %s", (hid,)
            )
        return _MemoryStore._match(_memory.judges, hackathon_id=hid)

    def add_judge(self, hid: str, email: str, by: str) -> None:
        if self.is_judge(hid, email):
            return
        row = {"hackathon_id": hid, "judge_email": email, "status": "active",
               "assigned_by": by, "created_at": _now()}
        if _use_db():
            s = get_schema()
            execute_insert(
                f"""INSERT INTO {s}.hackathon_judges
                    (hackathon_id, judge_email, status, assigned_by, created_at)
                    VALUES (%s,%s,%s,%s,%s)
                    ON CONFLICT (hackathon_id, judge_email) DO NOTHING""",
                (hid, email, "active", by, row["created_at"]),
            )
            return
        _memory.judges.append(row)

    def add_judges_bulk(self, hid: str, emails: List[str], by: str) -> None:
        for e in emails:
            e = (e or "").strip().lower()
            if "@" not in e:
                continue
            self.add_judge(hid, e, by)

    def remove_judge(self, hid: str, email: str) -> None:
        if _use_db():
            s = get_schema()
            execute_insert(
                f"DELETE FROM {s}.hackathon_judges WHERE hackathon_id = %s AND judge_email = %s",
                (hid, email),
            )
            return
        _memory.judges = [j for j in _memory.judges
                          if not (j["hackathon_id"] == hid and j["judge_email"] == email)]

    def is_judge(self, hid: str, email: str) -> bool:
        return any(j["judge_email"] == email for j in self.list_judges(hid))

    # ---- teams + members ---------------------------------------------------
    def list_teams(self, hid: str) -> List[Dict]:
        if _use_db():
            s = get_schema()
            return execute_query(
                f"SELECT * FROM {s}.hackathon_teams WHERE hackathon_id = %s ORDER BY created_at",
                (hid,),
            )
        return sorted(_MemoryStore._match(_memory.teams, hackathon_id=hid),
                      key=lambda r: r["created_at"])

    def get_team(self, tid: str) -> Optional[Dict]:
        if _use_db():
            s = get_schema()
            rows = execute_query(
                f"SELECT * FROM {s}.hackathon_teams WHERE team_id = %s", (tid,)
            )
            return rows[0] if rows else None
        rows = _MemoryStore._match(_memory.teams, team_id=tid)
        return rows[0] if rows else None

    def create_team(self, row: Dict) -> None:
        if _use_db():
            s = get_schema()
            execute_insert(
                f"""INSERT INTO {s}.hackathon_teams
                    (team_id, hackathon_id, name, description, leader_email,
                     max_members, is_public, created_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
                (row["team_id"], row["hackathon_id"], row["name"], row["description"],
                 row["leader_email"], row["max_members"], row["is_public"],
                 row["created_at"]),
            )
        else:
            _memory.teams.append(dict(row))

    def list_members(self, tid: str) -> List[Dict]:
        if _use_db():
            s = get_schema()
            return execute_query(
                f"SELECT * FROM {s}.hackathon_team_members WHERE team_id = %s", (tid,)
            )
        return _MemoryStore._match(_memory.members, team_id=tid)

    def add_member(self, tid: str, email: str, role: str = "member") -> None:
        if any(m["member_email"] == email for m in self.list_members(tid)):
            return
        row = {"team_id": tid, "member_email": email, "role": role, "joined_at": _now()}
        if _use_db():
            s = get_schema()
            execute_insert(
                f"""INSERT INTO {s}.hackathon_team_members
                    (team_id, member_email, role, joined_at) VALUES (%s,%s,%s,%s)
                    ON CONFLICT (team_id, member_email) DO NOTHING""",
                (tid, email, role, row["joined_at"]),
            )
        else:
            _memory.members.append(row)

    def teams_for_user(self, hid: str, email: str) -> List[str]:
        """team_ids in this hackathon the user belongs to."""
        team_ids = {t["team_id"] for t in self.list_teams(hid)}
        if _use_db():
            s = get_schema()
            rows = execute_query(
                f"SELECT team_id FROM {s}.hackathon_team_members WHERE member_email = %s",
                (email,),
            )
            return [r["team_id"] for r in rows if r["team_id"] in team_ids]
        return [m["team_id"] for m in _memory.members
                if m["member_email"] == email and m["team_id"] in team_ids]

    # ---- submissions -------------------------------------------------------
    def list_submissions(self, hid: str) -> List[Dict]:
        if _use_db():
            s = get_schema()
            return execute_query(
                f"SELECT * FROM {s}.hackathon_submissions WHERE hackathon_id = %s ORDER BY created_at",
                (hid,),
            )
        return sorted(_MemoryStore._match(_memory.submissions, hackathon_id=hid),
                      key=lambda r: r["created_at"])

    def get_submission_by_team(self, tid: str) -> Optional[Dict]:
        if _use_db():
            s = get_schema()
            rows = execute_query(
                f"SELECT * FROM {s}.hackathon_submissions WHERE team_id = %s", (tid,)
            )
            return rows[0] if rows else None
        rows = _MemoryStore._match(_memory.submissions, team_id=tid)
        return rows[0] if rows else None

    def get_submission(self, sid: str) -> Optional[Dict]:
        if _use_db():
            s = get_schema()
            rows = execute_query(
                f"SELECT * FROM {s}.hackathon_submissions WHERE submission_id = %s", (sid,)
            )
            return rows[0] if rows else None
        rows = _MemoryStore._match(_memory.submissions, submission_id=sid)
        return rows[0] if rows else None

    def upsert_submission(self, row: Dict) -> None:
        existing = self.get_submission_by_team(row["team_id"])
        if existing:
            sid = existing["submission_id"]
            fields = {k: row[k] for k in
                      ("title", "description", "repo_url", "demo_url",
                       "video_url", "slides_url")}
            fields["updated_at"] = _now()
            if _use_db():
                s = get_schema()
                sets = ", ".join(f"{k} = %s" for k in fields)
                execute_insert(
                    f"UPDATE {s}.hackathon_submissions SET {sets} WHERE submission_id = %s",
                    tuple(list(fields.values()) + [sid]),
                )
            else:
                existing.update(fields)
            return
        if _use_db():
            s = get_schema()
            execute_insert(
                f"""INSERT INTO {s}.hackathon_submissions
                    (submission_id, hackathon_id, team_id, submitted_by, title,
                     description, repo_url, demo_url, video_url, slides_url,
                     is_submitted, created_at, updated_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (row["submission_id"], row["hackathon_id"], row["team_id"],
                 row["submitted_by"], row["title"], row["description"],
                 row["repo_url"], row["demo_url"], row["video_url"],
                 row["slides_url"], True, row["created_at"], row["updated_at"]),
            )
        else:
            _memory.submissions.append(dict(row))

    # ---- scores ------------------------------------------------------------
    def list_scores(self, sid: str) -> List[Dict]:
        if _use_db():
            s = get_schema()
            return execute_query(
                f"SELECT * FROM {s}.hackathon_scores WHERE submission_id = %s", (sid,)
            )
        return _MemoryStore._match(_memory.scores, submission_id=sid)

    def get_score(self, sid: str, judge: str) -> Optional[Dict]:
        return next((s for s in self.list_scores(sid) if s["judge_email"] == judge), None)

    def upsert_score(self, sid: str, judge: str, criteria: Dict, overall: float,
                     feedback: str, ai_assisted: bool = False) -> None:
        existing = self.get_score(sid, judge)
        if _use_db():
            s = get_schema()
            if existing:
                execute_insert(
                    f"""UPDATE {s}.hackathon_scores
                        SET criteria = %s::jsonb, overall = %s, feedback = %s,
                            ai_assisted = %s, updated_at = %s
                        WHERE submission_id = %s AND judge_email = %s""",
                    (_json(criteria), overall, feedback, ai_assisted, _now(), sid, judge),
                )
            else:
                execute_insert(
                    f"""INSERT INTO {s}.hackathon_scores
                        (score_id, submission_id, judge_email, criteria, overall,
                         feedback, ai_assisted, created_at, updated_at)
                        VALUES (%s,%s,%s,%s::jsonb,%s,%s,%s,%s,%s)""",
                    (_new_id(), sid, judge, _json(criteria), overall, feedback,
                     ai_assisted, _now(), _now()),
                )
            return
        if existing:
            existing.update({"criteria": criteria, "overall": overall,
                             "feedback": feedback, "ai_assisted": ai_assisted,
                             "updated_at": _now()})
        else:
            _memory.scores.append({
                "score_id": _new_id(), "submission_id": sid, "judge_email": judge,
                "criteria": criteria, "overall": overall, "feedback": feedback,
                "ai_assisted": ai_assisted,
                "created_at": _now(), "updated_at": _now(),
            })

    # ---- votes -------------------------------------------------------------
    def list_votes(self, sid: str) -> List[Dict]:
        if _use_db():
            s = get_schema()
            return execute_query(
                f"SELECT * FROM {s}.hackathon_votes WHERE submission_id = %s", (sid,)
            )
        return _MemoryStore._match(_memory.votes, submission_id=sid)

    def toggle_vote(self, sid: str, voter: str) -> bool:
        """Returns True if the vote is now ON, False if it was removed."""
        has = any(v["voter_email"] == voter for v in self.list_votes(sid))
        if _use_db():
            s = get_schema()
            if has:
                execute_insert(
                    f"DELETE FROM {s}.hackathon_votes WHERE submission_id = %s AND voter_email = %s",
                    (sid, voter),
                )
                return False
            execute_insert(
                f"""INSERT INTO {s}.hackathon_votes (submission_id, voter_email, created_at)
                    VALUES (%s,%s,%s) ON CONFLICT DO NOTHING""",
                (sid, voter, _now()),
            )
            return True
        if has:
            _memory.votes = [v for v in _memory.votes
                             if not (v["submission_id"] == sid and v["voter_email"] == voter)]
            return False
        _memory.votes.append({"submission_id": sid, "voter_email": voter, "created_at": _now()})
        return True


def _json(value: Any) -> str:
    import json
    return json.dumps(value)


store = HackathonStore()


# =============================================================================
# Helpers: role resolution + normalization
# =============================================================================

def _role_for(hackathon: Dict, email: str) -> str:
    if hackathon["created_by"] == email:
        return "organizer"
    if store.is_judge(hackathon["hackathon_id"], email):
        return "judge"
    return "participant"


def _display_name(email: str) -> str:
    if email and "@" in email:
        return email.split("@")[0].replace(".", " ").title()
    return (email or "Unknown").title()


def _coerce_criteria(value: Any) -> List[str]:
    """judging_criteria may come back from Postgres as a JSON string."""
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            import json
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return parsed
        except Exception:
            pass
    return list(DEFAULT_CRITERIA)


def _coerce_list(value: Any) -> List[str]:
    """A jsonb array column may come back as a JSON string from Postgres."""
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            import json
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return parsed
        except Exception:
            pass
    return []


def _coerce_dict(value: Any) -> Dict:
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            import json
            parsed = json.loads(value)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
    return {}


# =============================================================================
# Pydantic models
# =============================================================================

class HackathonCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = ""
    short_description: str = ""
    hackathon_type: str = "online"
    location: str = ""
    venue: str = ""
    registration_start: Optional[str] = None
    registration_end: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    submission_deadline: Optional[str] = None
    max_participants: int = 100
    max_team_size: int = 4
    min_team_size: int = 1
    total_prize_pool: float = 0
    prize_description: str = ""
    rules: str = ""
    topics: List[str] = Field(default_factory=list)
    judging_criteria: List[str] = Field(default_factory=lambda: list(DEFAULT_CRITERIA))
    has_team_matching: bool = True
    has_chat: bool = True
    has_voting: bool = True


class HackathonUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    status: Optional[str] = None
    hackathon_type: Optional[str] = None
    location: Optional[str] = None
    venue: Optional[str] = None
    registration_start: Optional[str] = None
    registration_end: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    submission_deadline: Optional[str] = None
    max_participants: Optional[int] = None
    max_team_size: Optional[int] = None
    min_team_size: Optional[int] = None
    total_prize_pool: Optional[float] = None
    prize_description: Optional[str] = None
    rules: Optional[str] = None
    topics: Optional[List[str]] = None
    judging_criteria: Optional[List[str]] = None
    has_team_matching: Optional[bool] = None
    has_chat: Optional[bool] = None
    has_voting: Optional[bool] = None


class JudgeAdd(BaseModel):
    judge_email: Optional[str] = None
    judge_emails: Optional[List[str]] = None


class TeamCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str = ""
    max_members: int = 4
    is_public: bool = True


class SubmissionUpsert(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str = ""
    repo_url: str = ""
    demo_url: str = ""
    video_url: str = ""
    slides_url: str = ""


class ScoreSubmit(BaseModel):
    criteria: Dict[str, float] = Field(default_factory=dict)
    feedback: str = ""
    ai_assisted: bool = False  # True if the feedback was AI-drafted (transparency)


VALID_STATUSES = {"draft", "registration_open", "in_progress", "judging", "completed"}


# =============================================================================
# Endpoints
# =============================================================================

# Suggested demo personas for the dev-only switcher (never shown in prod).
DEV_PERSONAS = [
    {"email": "demo-organizer@databricks.com", "name": "Demo Organizer", "hint": "Owns the seeded hackathon"},
    {"email": "alex.organizer@databricks.com", "name": "Alex (Organizer)", "hint": "Create & manage hackathons"},
    {"email": "sam.participant@databricks.com", "name": "Sam (Participant)", "hint": "Form a team & submit"},
    {"email": "riley.participant@databricks.com", "name": "Riley (Participant)", "hint": "Join a team"},
    {"email": "jordan.judge@databricks.com", "name": "Jordan (Judge)", "hint": "Score submissions"},
    {"email": "casey.voter@databricks.com", "name": "Casey (Voter)", "hint": "Community votes"},
]


@router.get("/hackathons/dev/persona-config")
async def dev_persona_config(request: Request) -> Dict:
    """Tells the frontend whether the dev persona switcher is available, the
    suggested personas, and who the backend currently resolves the caller as.
    Returns enabled=False in production (Lakebase on) so the UI hides it."""
    return {
        "enabled": _dev_auth_enabled(),
        "current": _resolve_user(request),
        "personas": DEV_PERSONAS,
    }


@router.get("/hackathons")
async def list_hackathons(request: Request) -> List[Dict]:
    me = _resolve_user(request)
    out = []
    for h in store.list_hackathons():
        teams = store.list_teams(h["hackathon_id"])
        subs = store.list_submissions(h["hackathon_id"])
        out.append({
            "hackathon_id": h["hackathon_id"],
            "title": h["title"],
            "short_description": h.get("short_description") or "",
            "description": h.get("description") or "",
            "status": h["status"],
            "hackathon_type": h.get("hackathon_type") or "online",
            "prize_description": h.get("prize_description") or "",
            "has_voting": bool(h.get("has_voting", True)),
            "team_count": len(teams),
            "submission_count": len(subs),
            "your_role": _role_for(h, me),
            "created_by": h["created_by"],
            "created_at": h.get("created_at"),
        })
    return out


@router.post("/hackathons")
async def create_hackathon(body: HackathonCreate, request: Request) -> Dict:
    me = _resolve_user(request)
    row = {
        "hackathon_id": _new_id(),
        "title": body.title,
        "description": body.description,
        "short_description": body.short_description,
        "status": "draft",
        "hackathon_type": body.hackathon_type,
        "location": body.location,
        "venue": body.venue,
        "registration_start": body.registration_start,
        "registration_end": body.registration_end,
        "start_date": body.start_date,
        "end_date": body.end_date,
        "submission_deadline": body.submission_deadline,
        "max_participants": body.max_participants,
        "max_team_size": body.max_team_size,
        "min_team_size": body.min_team_size,
        "total_prize_pool": body.total_prize_pool,
        "prize_description": body.prize_description,
        "rules": body.rules,
        "topics": body.topics or [],
        "judging_criteria": body.judging_criteria or list(DEFAULT_CRITERIA),
        "has_team_matching": body.has_team_matching,
        "has_chat": body.has_chat,
        "has_voting": body.has_voting,
        "created_by": me,
        "created_at": _now(),
        "updated_at": _now(),
    }
    store.create_hackathon(row)
    logger.info(f"[Hackathon] Created '{body.title}' by {me}")
    return {"hackathon_id": row["hackathon_id"]}


@router.get("/hackathons/{hid}")
async def get_hackathon_detail(hid: str, request: Request) -> Dict:
    me = _resolve_user(request)
    h = store.get_hackathon(hid)
    if not h:
        raise HTTPException(status_code=404, detail="Hackathon not found")

    role = _role_for(h, me)
    my_team_ids = set(store.teams_for_user(hid, me))

    teams = []
    for t in store.list_teams(hid):
        members = store.list_members(t["team_id"])
        teams.append({
            "team_id": t["team_id"],
            "name": t["name"],
            "description": t.get("description") or "",
            "leader_email": t["leader_email"],
            "leader_name": _display_name(t["leader_email"]),
            "max_members": t.get("max_members", 4),
            "members": [{"email": m["member_email"], "name": _display_name(m["member_email"]),
                         "role": m.get("role", "member")} for m in members],
            "member_count": len(members),
            "has_submission": store.get_submission_by_team(t["team_id"]) is not None,
            "is_mine": t["team_id"] in my_team_ids,
        })

    submissions = []
    for sub in store.list_submissions(hid):
        team = store.get_team(sub["team_id"]) or {}
        all_scores = store.list_scores(sub["submission_id"])
        my_score = next((s for s in all_scores if s["judge_email"] == me), None)
        submissions.append({
            "submission_id": sub["submission_id"],
            "team_id": sub["team_id"],
            "team_name": team.get("name", "Unknown team"),
            "title": sub["title"],
            "description": sub.get("description") or "",
            "repo_url": sub.get("repo_url") or "",
            "demo_url": sub.get("demo_url") or "",
            "video_url": sub.get("video_url") or "",
            "slides_url": sub.get("slides_url") or "",
            "vote_count": len(store.list_votes(sub["submission_id"])),
            "voted_by_me": any(v["voter_email"] == me
                               for v in store.list_votes(sub["submission_id"])),
            "scored_by_me": my_score is not None if role == "judge" else False,
            # The current judge's own prior score (to pre-fill the panel).
            "my_score": (
                {
                    "criteria": _coerce_dict(my_score.get("criteria")),
                    "feedback": my_score.get("feedback") or "",
                    "ai_assisted": bool(my_score.get("ai_assisted")),
                }
                if my_score and role == "judge"
                else None
            ),
            # Transparency: how many judges used AI to draft their feedback.
            "ai_assisted_count": sum(1 for s in all_scores if s.get("ai_assisted")),
            "judge_count": len(all_scores),
        })

    judges = [{"email": j["judge_email"], "name": _display_name(j["judge_email"])}
              for j in store.list_judges(hid)]

    return {
        "hackathon_id": h["hackathon_id"],
        "title": h["title"],
        "description": h.get("description") or "",
        "short_description": h.get("short_description") or "",
        "status": h["status"],
        "hackathon_type": h.get("hackathon_type") or "online",
        "location": h.get("location") or "",
        "venue": h.get("venue") or "",
        "registration_start": h.get("registration_start"),
        "registration_end": h.get("registration_end"),
        "start_date": h.get("start_date"),
        "end_date": h.get("end_date"),
        "submission_deadline": h.get("submission_deadline"),
        "max_participants": h.get("max_participants", 100),
        "max_team_size": h.get("max_team_size", 4),
        "min_team_size": h.get("min_team_size", 1),
        "total_prize_pool": float(h.get("total_prize_pool") or 0),
        "prize_description": h.get("prize_description") or "",
        "rules": h.get("rules") or "",
        "topics": _coerce_list(h.get("topics")),
        "judging_criteria": _coerce_criteria(h.get("judging_criteria")),
        "has_team_matching": bool(h.get("has_team_matching", True)),
        "has_chat": bool(h.get("has_chat", True)),
        "has_voting": bool(h.get("has_voting", True)),
        "created_by": h["created_by"],
        "organizer_name": _display_name(h["created_by"]),
        "your_role": role,
        "your_email": me,
        "my_team_ids": list(my_team_ids),
        "teams": teams,
        "submissions": submissions,
        "judges": judges,
    }


@router.patch("/hackathons/{hid}")
async def update_hackathon(hid: str, body: HackathonUpdate, request: Request) -> Dict:
    me = _resolve_user(request)
    h = store.get_hackathon(hid)
    if not h:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    if h["created_by"] != me:
        raise HTTPException(status_code=403, detail="Only the organizer can edit this hackathon")

    fields = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if "status" in fields and fields["status"] not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    if not fields:
        return {"success": True}
    store.update_hackathon(hid, fields)
    return {"success": True}


@router.post("/hackathons/{hid}/judges")
async def add_judge(hid: str, body: JudgeAdd, request: Request) -> Dict:
    me = _resolve_user(request)
    h = store.get_hackathon(hid)
    if not h:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    if h["created_by"] != me:
        raise HTTPException(status_code=403, detail="Only the organizer can add judges")
    raw = body.judge_emails if body.judge_emails is not None else [body.judge_email]
    organizer = (h["created_by"] or "").strip().lower()
    # Normalize, drop invalids, the organizer (can't judge their own event), and
    # de-dupe within the payload while preserving order.
    seen, emails = set(), []
    for e in raw:
        if not e or "@" not in e:
            continue
        norm = e.strip().lower()
        if norm == organizer or norm in seen:
            continue
        seen.add(norm)
        emails.append(norm)
    if not emails:
        raise HTTPException(
            status_code=400,
            detail="At least one valid email is required (the organizer can't be a judge of their own hackathon)",
        )
    store.add_judges_bulk(hid, emails, me)
    return {"success": True, "added": len(emails)}


@router.delete("/hackathons/{hid}/judges/{email}")
async def remove_judge_endpoint(hid: str, email: str, request: Request) -> Dict:
    me = _resolve_user(request)
    h = store.get_hackathon(hid)
    if not h:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    if h["created_by"] != me:
        raise HTTPException(status_code=403, detail="Only the organizer can remove judges")
    store.remove_judge(hid, email.strip().lower())
    return {"success": True}


@router.get("/hackathons/{hid}/judge-candidates")
async def judge_candidates(hid: str, request: Request) -> Dict:
    me = _resolve_user(request)
    h = store.get_hackathon(hid)
    if not h:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    if h["created_by"] != me:
        raise HTTPException(status_code=403, detail="Only the organizer can view judge candidates")

    try:
        from src.backend.services.lakebase import get_workshop_users
        result = get_workshop_users() or {}
        # get_workshop_users returns {"total": N, "users": [...]}, not a bare list.
        users = result.get("users", []) if isinstance(result, dict) else (result or [])
    except Exception:
        users = []

    assigned = {j["judge_email"].strip().lower() for j in store.list_judges(hid)}
    organizer = (h["created_by"] or "").strip().lower()

    candidates = []
    for u in users:
        email = (u.get("email") or "").strip().lower()
        if not email or email == organizer or email in assigned:
            continue
        # Return the canonical lowercased email so the UI key/display matches
        # how judges are stored (always lowercased on the assign path).
        candidates.append({
            "email": email,
            "name": u.get("display_name") or _display_name(email),
        })
    return {"candidates": candidates}


@router.post("/hackathons/{hid}/teams")
async def create_team(hid: str, body: TeamCreate, request: Request) -> Dict:
    me = _resolve_user(request)
    h = store.get_hackathon(hid)
    if not h:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    if store.teams_for_user(hid, me):
        raise HTTPException(status_code=400, detail="You are already on a team in this hackathon")
    tid = _new_id()
    # The team can't be larger than the hackathon's max team size, regardless of
    # what the client requested (defends against direct API calls bypassing the UI).
    hack_max = int(h.get("max_team_size") or 4)
    max_members = max(1, min(int(body.max_members or hack_max), hack_max))
    store.create_team({
        "team_id": tid,
        "hackathon_id": hid,
        "name": body.name,
        "description": body.description,
        "leader_email": me,
        "max_members": max_members,
        "is_public": body.is_public,
        "created_at": _now(),
    })
    store.add_member(tid, me, role="leader")
    return {"team_id": tid}


@router.post("/hackathons/{hid}/teams/{tid}/join")
async def join_team(hid: str, tid: str, request: Request) -> Dict:
    me = _resolve_user(request)
    h = store.get_hackathon(hid)
    if not h:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    team = store.get_team(tid)
    if not team or team["hackathon_id"] != hid:
        raise HTTPException(status_code=404, detail="Team not found")
    if store.teams_for_user(hid, me):
        raise HTTPException(status_code=400, detail="You are already on a team in this hackathon")
    members = store.list_members(tid)
    if len(members) >= team.get("max_members", 4):
        raise HTTPException(status_code=400, detail="This team is full")
    store.add_member(tid, me, role="member")
    return {"success": True}


@router.post("/hackathons/{hid}/teams/{tid}/submit")
async def upsert_submission(hid: str, tid: str, body: SubmissionUpsert, request: Request) -> Dict:
    me = _resolve_user(request)
    h = store.get_hackathon(hid)
    if not h:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    team = store.get_team(tid)
    if not team or team["hackathon_id"] != hid:
        raise HTTPException(status_code=404, detail="Team not found")
    if team["leader_email"] != me:
        raise HTTPException(status_code=403, detail="Only the team leader can submit")
    existing = store.get_submission_by_team(tid)
    store.upsert_submission({
        "submission_id": existing["submission_id"] if existing else _new_id(),
        "hackathon_id": hid,
        "team_id": tid,
        "submitted_by": me,
        "title": body.title,
        "description": body.description,
        "repo_url": body.repo_url,
        "demo_url": body.demo_url,
        "video_url": body.video_url,
        "slides_url": body.slides_url,
        "created_at": existing["created_at"] if existing else _now(),
        "updated_at": _now(),
    })
    return {"success": True}


@router.post("/hackathons/{hid}/submissions/{sid}/score")
async def score_submission(hid: str, sid: str, body: ScoreSubmit, request: Request) -> Dict:
    me = _resolve_user(request)
    h = store.get_hackathon(hid)
    if not h:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    if not store.is_judge(hid, me):
        raise HTTPException(status_code=403, detail="Only assigned judges can score submissions")
    sub = store.get_submission(sid)
    if not sub or sub["hackathon_id"] != hid:
        raise HTTPException(status_code=404, detail="Submission not found")

    criteria_names = _coerce_criteria(h.get("judging_criteria"))
    cleaned: Dict[str, float] = {}
    for name in criteria_names:
        try:
            val = float(body.criteria.get(name, 0))
        except (TypeError, ValueError):
            val = 0.0
        cleaned[name] = max(0.0, min(10.0, val))
    overall = round(sum(cleaned.values()) / len(cleaned), 2) if cleaned else 0.0
    # ai_assisted is only meaningful when there's feedback text; an empty feedback
    # can't have been AI-drafted in any meaningful sense.
    ai_assisted = bool(body.ai_assisted and body.feedback.strip())
    store.upsert_score(sid, me, cleaned, overall, body.feedback, ai_assisted=ai_assisted)
    return {"success": True, "overall": overall}


@router.post("/hackathons/{hid}/submissions/{sid}/vote")
async def vote_submission(hid: str, sid: str, request: Request) -> Dict:
    me = _resolve_user(request)
    h = store.get_hackathon(hid)
    if not h:
        raise HTTPException(status_code=404, detail="Hackathon not found")
    if not h.get("has_voting", True):
        raise HTTPException(status_code=400, detail="Community voting is disabled for this hackathon")
    sub = store.get_submission(sid)
    if not sub or sub["hackathon_id"] != hid:
        raise HTTPException(status_code=404, detail="Submission not found")
    now_on = store.toggle_vote(sid, me)
    return {"voted": now_on, "vote_count": len(store.list_votes(sid))}


@router.get("/hackathons/{hid}/results")
async def hackathon_results(hid: str, request: Request) -> Dict:
    """Compute-on-read leaderboard: rank by avg judge overall, tie-break on votes."""
    me = _resolve_user(request)
    h = store.get_hackathon(hid)
    if not h:
        raise HTTPException(status_code=404, detail="Hackathon not found")

    rows = []
    for sub in store.list_submissions(hid):
        scores = store.list_scores(sub["submission_id"])
        judge_count = len(scores)
        avg = round(sum(float(s.get("overall", 0)) for s in scores) / judge_count, 2) if judge_count else 0.0
        votes = len(store.list_votes(sub["submission_id"]))
        team = store.get_team(sub["team_id"]) or {}
        rows.append({
            "submission_id": sub["submission_id"],
            "team_name": team.get("name", "Unknown team"),
            "title": sub["title"],
            "avg_score": avg,
            "judge_count": judge_count,
            "vote_count": votes,
            "repo_url": sub.get("repo_url") or "",
            "demo_url": sub.get("demo_url") or "",
        })

    rows.sort(key=lambda r: (r["avg_score"], r["vote_count"]), reverse=True)
    for i, r in enumerate(rows, start=1):
        r["rank"] = i

    return {
        "hackathon_id": hid,
        "title": h["title"],
        "status": h["status"],
        "your_role": _role_for(h, me),
        "has_voting": bool(h.get("has_voting", True)),
        "results": rows,
    }


# =============================================================================
# AI assist: generate field text with an LLM ("✨ Generate with AI")
# =============================================================================

class AIGenerateRequest(BaseModel):
    # The field we're drafting text for; drives the prompt template.
    field: str = Field(..., description="hackathon_description | hackathon_short | team_description | submission_description | judge_feedback")
    # Free-form context the caller already has (title, team name, scores, etc.).
    context: Dict[str, Any] = Field(default_factory=dict)


def _build_ai_prompt(field: str, ctx: Dict[str, Any]) -> str:
    """Turn a field + context into a focused instruction for the LLM.

    Kept server-side so the client never crafts raw model prompts and the
    wording can be tuned in one place.
    """
    def g(key: str, default: str = "") -> str:
        v = ctx.get(key, default)
        return str(v).strip() if v is not None else default

    if field == "hackathon_description":
        return (
            "You are helping an organizer launch a hackathon. Write an engaging "
            "1-2 paragraph description that motivates people to participate. "
            f"Title: '{g('title', 'an upcoming hackathon')}'. "
            f"Theme/notes: {g('notes', 'open theme')}. "
            f"Format: {g('hackathon_type', 'online')}. "
            "Cover the goal, who should join, and what makes it exciting. "
            "Return only the description text, no headings or preamble."
        )
    if field == "hackathon_short":
        return (
            "Write a single punchy sentence (max 15 words) summarizing this "
            f"hackathon for a card. Title: '{g('title')}'. "
            f"Notes: {g('notes')}. Return only the sentence."
        )
    if field == "team_description":
        return (
            "Write a short, energetic team bio (1-2 sentences) for a hackathon team. "
            f"Team name: '{g('team_name', 'our team')}'. "
            f"Hackathon: '{g('hackathon_title')}'. "
            f"Notes: {g('notes', 'a passionate builder team')}. "
            "Return only the bio text."
        )
    if field == "submission_description":
        return (
            "Write a compelling project summary (2-3 sentences) for a hackathon "
            "submission that will be read by judges. "
            f"Project title: '{g('title', 'our project')}'. "
            f"What it does / notes: {g('notes', 'an innovative build')}. "
            f"Hackathon: '{g('hackathon_title')}'. "
            "Emphasize the problem solved, approach, and impact. "
            "Return only the summary text."
        )
    if field == "judge_feedback":
        crit = ctx.get("scores") or {}
        crit_str = ", ".join(f"{k}: {v}/10" for k, v in crit.items()) if isinstance(crit, dict) else ""
        return (
            "You are a hackathon judge. Write constructive, encouraging feedback "
            "(2-4 sentences) for a project submission based on the scores given. "
            f"Project: '{g('title', 'the project')}'. "
            f"Scores — {crit_str or 'not yet scored'}. "
            f"Notes: {g('notes', '')}. "
            "Be specific, balance strengths with one area to improve. "
            "Return only the feedback text."
        )
    # Generic fallback
    return (
        f"Write helpful text for the field '{field}'. Context: {ctx}. "
        "Return only the text."
    )


@router.post("/hackathons/ai/generate")
async def hackathon_ai_generate(body: AIGenerateRequest, request: Request) -> Dict:
    """Generate field text with the LLM. Auth is implicit (any signed-in user).

    Returns {text, model}. If no serving endpoint is configured (local dev),
    `call_databricks_serving_endpoint` returns a friendly notice that we pass
    through with available=False so the UI can show it without breaking.
    """
    _ = _resolve_user(request)  # ensure caller is resolvable / logged
    prompt = _build_ai_prompt(body.field, body.context)
    result = await call_databricks_serving_endpoint(
        prompt=prompt, max_tokens=512, temperature=0.8
    )
    text = (result.get("response") or "").strip()
    available = bool(text) and not text.startswith("[Error]")
    return {
        "text": text if available else "",
        "model": result.get("model", "unknown"),
        "available": available,
        "notice": text if not available else "",
    }
