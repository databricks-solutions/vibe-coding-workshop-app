# p4-track-scoped-walk (app) — plan (RUN.md P4.1), revision 2 (after critic BLOCK round 1)

## Revision note (all round-1 findings accepted)
1. D-30's genie-accelerator override is DROPPED. resolve_track(record) already returns genie-accelerator for legacy MCP sessions (they carry coding_assistant="genie-code", mcp_server.py:1178 → _assistant_default track_resolution.py:58), and end-to-end for level-less SPA sessions, exactly what the SPA serves (routes.py:5400). An override would break MCP == SPA parity.
2. DEFAULT_USE_CASE = "Genie Accelerator" (mcp_server.py:48), the fallback at :1054 (_step_payload) and :1462 (explain), is a genie-only assumption → now in scope (change 8).
3. W1 was a tautology (vibe_next_step delegates to engine.next_step, :1444) → rewritten against an independent expectation from manifest.json data plus negative cases.
4. The intent beat stays track-agnostic (the SPA shows "Define Your Intent" as step 1 on every track, App.tsx:457).
5. Existing tests: test_track_persistence.py:71, :86 and test_start_track_labels.py are named for evaluation (rule below).

Repo: app. Base: origin/feature/genie-code-mcp-integration @ e579ca2 (Phase 2A complete).
Plan file in PR: docs/superpowers/plans/2026-10-05-p4-track-scoped-walk.md
Scope: P4.1. Lane: T (trunk: src/backend/mcp_server.py). Reseed: no (no DDL, no seed body change).

## Goal
The session's track drives every MCP tool. Today the walk is pinned to genie-accelerator (mcp_server.py:46 DEFAULT_TRACK, used at :1297, :1299, :1306, :1312, :1315, :1396, :1398, :1402, :1403, :1444, :1451, :1492, :1759, :1765, :1816, :1865, :1866, :1911, :2284; _load_session_for_request :526 default; vibe_start_track validates `track` at :1164 but stamps workshop_level=DEFAULT_TRACK at :1233). Keep genie-accelerator as the fallback for legacy sessions only, keep start_genie_accelerator working, generalize the start prompt, keep 7 tools.

## Charter exception (trunk file)
- File: src/backend/mcp_server.py.
- Reason: every walk tool, the outline/state resource and the start path live there.
- Scope: replace DEFAULT_TRACK with the per-session resolved track at the listed sites; thread it from _load_session_for_request; stamp the requested track in vibe_start_track; the session-name format (D-31); add one MCP PROMPT (not a tool). No change to engine.py, routes.py, the manifest, the seed, or the intent-beat rule.
- Reversal: revert the PR; the persisted workshop_level values written by it are valid tracks the SPA already reads.

## Decision D-30 (MCP track resolution, revised)
Rule (1), shipped code decides: the MCP walk uses `track_resolution.resolve_track(record)` UNCHANGED (lock → persisted workshop_level → assistant default → end-to-end), the same rule the SPA uses, so MCP outline == SPA outline. RUN.md's "genie-accelerator as the fallback for legacy sessions only" is satisfied by the shipped rule itself: legacy MCP sessions carry coding_assistant="genie-code" (mcp_server.py:1178), which _assistant_default (track_resolution.py:58) maps to genie-accelerator. The only non-record path (no Lakebase row and Lakebase not configured, i.e. local dev, :531-533) uses the requested track if given, else DEFAULT_TRACK. The helper `_session_track(record) -> str` is a thin wrapper that asserts the result is in engine.MANIFEST.tracks. Reverse: make _session_track return DEFAULT_TRACK.

## Decision D-31 (session names)
The client is Genie Code, so the "Genie Code — " prefix stays. For genie-accelerator the name is byte-identical to today (`Genie Code — {use_case}` / `Genie Code Workshop`, :1207, :1842, :2152). For any other track it's `Genie Code — {track title}: {use_case}` / `Genie Code — {track title}` (the title from the manifest's track record). Rule (3): the reference track is unchanged, so its pinned tests stay green. Reverse: drop the track title.

## Changes (mcp_server.py)
1. `_session_track(record)` per D-30 (import resolve_track, is_track, USE_CASE_LEVEL_LOCK, and the assistant-default helper from track_resolution; reuse, don't duplicate the rules).
2. `_load_session_for_request(session_id, context, track=None)` → returns `(state, session_id, track)`. If the `track` arg is given (vibe_start_track's requested track) it wins; else `_session_track(record)`; for the no-record / no-Lakebase path, the arg or genie-accelerator. build_session_state(record, track) receives the resolved track. Update every caller to unpack the track and pass it where DEFAULT_TRACK is used today (the sites above). DEFAULT_TRACK remains, only as the legacy fallback constant.
3. vibe_start_track: stamp workshop_level=<requested track> (:1233). Session names per D-31 (:1207 and the two refine sites :1842, :2152, which use the session's resolved track).
4. The outline/state resource (:2284) uses the session's track.
5. Coaching: vibe_explain_step passes the resolved track to coach() (:1492), closing the Phase 2A caveat.
6. A new MCP prompt `start_track(track: str, use_case: str | None = None, industry: str | None = None)` titled "Start a workshop track": it instructs calling vibe_start_track with the given track (validated against the manifest; unknown → a short message listing the valid tracks), then vibe_get_step. start_genie_accelerator stays, unchanged (byte-identical text). Orientation text: no genie-specific claims beyond the client being Genie Code (check :963 and the tool descriptions; generalize any sentence that says the walk IS the Genie Accelerator; list each edit).
7. Intent beat: unchanged and track-agnostic (_needs_use_case :1012, via engine.use_case_resolved). It applies on every track, matching the SPA (App.tsx:457); P4.2 generalizes the manifest/seed side.
8. DEFAULT_USE_CASE fallback (:48, used at :1054 and :1462): replace it with `_default_use_case(track)` = the manifest's display title for that track (the same title the SPA shows). For genie-accelerator it must equal today's "Genie Accelerator" byte for byte; if the manifest title differs, keep the literal for genie-accelerator and use the title for the others, and say which in the PR. The constant may remain as the genie-accelerator value.

## Tests
- NEW tests/workshop/test_track_scoped_walk.py:
  - W1, per track (all 14, parametrized), against an INDEPENDENT expectation: read the track's ordered step list straight from src/backend/workshop/manifest.json (JSON data, not engine functions), and build EXPECTED_FIRST[track] = the first numbered step a fresh session with a resolved use case should get. Then: vibe_start_track(track, curated industry/use_case) stamps workshop_level=track (assert on the save call); vibe_next_step returns EXPECTED_FIRST[track]; vibe_get_step() (no tag) returns the same; vibe_complete_step(EXPECTED_FIRST[track]) returns, as its next step, the manifest's next eligible step for that track (from the same JSON data; where the JSON alone can't decide because of gates or flags, document the rule used and assert the tag is in the JSON's step list for that track and != the completed one); vibe_get_step(<a sectionTag that exists ONLY in another track>) returns UNKNOWN_STEP (pick one per track from the JSON; skip with a reason if a track's step set is a superset of all others); vibe_next_step on a lakehouse session never returns a step that's absent from lakehouse's JSON list.
  - W1b, cross-track isolation: two sessions (genie-accelerator and app-only) walked alternately with interleaved calls each stay on their own track's steps (proves no module-level track leaks).
  - W2 outline parity per track: the MCP state resource's outline == [asdict(i) for i in engine.outline(track, state)] for the same state.
  - W3 resolution (D-30): a record with workshop_level=lakehouse → lakehouse; a use-case lock → the lock; no level/lock/assistant → genie-accelerator; workshop_level=garbage → per resolve_track (no lock) → genie-accelerator fallback; skills-accelerator without a lock → whatever resolve_track returns (end-to-end), matching the SPA.
  - W4 names (D-31): genie-accelerator names byte-identical; another track includes its title.
  - W5 prompts: start_track exists, start_genie_accelerator text unchanged; tool count 7.
  - W6 coaching: vibe_explain_step(focus) on a lakehouse session passes track="lakehouse" to coach().
  - W7 no DEFAULT_TRACK use remains in walk tools: AST scan of mcp_server.py, where DEFAULT_TRACK may appear only in its definition, _session_track and _load_session_for_request's fallback.
- Existing tests: unchanged EXCEPT any test that asserts the old pin for a NON-genie track (e.g. starting another track stamps genie-accelerator). Candidates named by the critic: tests/workshop/test_track_persistence.py:71 and :86 (they assert workshop_level == "genie-accelerator"; if they start genie-accelerator they stay as is; if they start another track they're amended to the requested track) and tests/workshop/test_start_track_labels.py (TRACK = "genie-accelerator", which stays as is). Each amendment is listed in the PR body as file:line, old → new, with the reason "pinned the P4.1 bug". Any other existing-test failure → STOP and report.

## Fence
src/backend/mcp_server.py (trunk) · tests/workshop/test_track_scoped_walk.py (new) · existing tests only as listed above · docs/superpowers/plans/2026-10-05-p4-track-scoped-walk.md (new) · docs/superpowers/decision-log.md (append D-30, D-31). Not engine.py, track_resolution.py, routes.py, the manifest, the seed or the frontend.

## Acceptance
- W1–W7 green for all 14 tracks; every pre-existing genie-accelerator test green unchanged.
- Backend suite ≥ 764 + new, 0 failed. 7 tools.

## Green gates
cd <worktree> && DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= $APP/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q → ≥ 764 + new, 0 failed.

## Live checks (for the critic to finalize)
After the code-only deploy: (L1) deployed mcp_server.py sha256 = git. (L2) For 3 tracks (genie-accelerator, lakehouse, app-only): a fresh MCP vibe_start_track with a curated active pair (travel/ai_driven_booking) → the session's workshop_level = track (REST GET session); the MCP state-resource outline == the full JSON of GET /api/track/{track}/outline for that session (0 differing positions); vibe_next_step returns a step in that outline; one vibe_complete_step advances, and both surfaces agree afterwards. (L3) A legacy check: an existing genie-accelerator session's outline is unchanged. (L4) 7 tools; prompts include start_track and start_genie_accelerator; 0 ERROR/Traceback.

## Decision text (append to decision-log.md)
D-30 (2026-10-05) · The MCP walk resolves the session's track with track_resolution.resolve_track unchanged (SPA parity); legacy MCP sessions resolve to genie-accelerator through the genie-code assistant default, which satisfies RUN.md's legacy rule; no override · Rule (1) · Reverse: _session_track returns DEFAULT_TRACK.
D-30a (2026-10-05) · DEFAULT_USE_CASE's "Genie Accelerator" fallback becomes the track's manifest title (genie-accelerator unchanged) · Rule (3) · Reverse: restore the constant.
D-31 (2026-10-05) · MCP session names keep the "Genie Code — " client prefix; genie-accelerator names are byte-identical; other tracks add the track title · Rule (3) · Reverse: drop the title.
