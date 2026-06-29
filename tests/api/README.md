# Hackathon API tests

Zero-dependency API tests for the Hackathon feature, using FastAPI's `TestClient`
against the **in-memory store** (no Databricks / Lakebase needed). They run with
the Python **stdlib** `unittest` — no `pytest` install required.

## Run

```bash
cd <repo root>
USE_LAKEBASE=false DEV_PERSONA_SWITCH=true python3 -m unittest tests.api.test_hackathon_api -v
```

Quieter (summary only):

```bash
USE_LAKEBASE=false DEV_PERSONA_SWITCH=true python3 -m unittest tests.api.test_hackathon_api 2>/dev/null
```

If `pytest` is available it also discovers these tests:

```bash
USE_LAKEBASE=false DEV_PERSONA_SWITCH=true pytest tests/api -v
```

## What's covered (34 tests)

- **CRUD** — create (organizer role + draft status), rich fields persisted, 404s, title required
- **Roles & lifecycle** — non-organizer can't edit (403), status advance, invalid status (400), participant role
- **Teams** — create + join, can't join two teams, can't join a full team, size clamped to hackathon max
- **Submissions** — leader submits, non-leader blocked (403), re-submit updates (no dup)
- **Judge selector** — bulk assign (normalize + dedupe), organizer can't self-assign, organizer filtered from mixed payload, non-organizer blocked (403), remove judge, candidates exclude organizer/assigned, candidates organizer-only
- **Judging & scoring** — judge scores (mean overall), non-judge blocked (403), scores clamped 0–10, rescore updates (no dup)
- **Voting & results** — vote toggles, results rank by score then votes, voting-disabled rejected (400)
- **Dev persona** — config enabled in test env, persona header changes identity
- **Full journey** — end-to-end organizer → participant → judge → voter → results

## How identity works in tests

Tests pass an `x-dev-persona: <email>` header. The backend honors it because the
dev gate is open when `USE_LAKEBASE=false` (or `DEV_PERSONA_SWITCH=true`). This is
the same mechanism the in-app dev persona picker and the Playwright tests use.
