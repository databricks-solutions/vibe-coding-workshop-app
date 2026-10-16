# start-track-unknown-usecase

## Defect (ledgered in plan t5-r4 §Ledger: "vibe_start_track accepts an unknown use case and still earns step-1 credit"; verified at 957157f)
- `vibe_start_track(track, use_case, industry)` (mcp_server.py ~:1135-1215) resolves the pre-journey `use_case_selection` gate up front whenever BOTH industry and use_case are non-empty (`if industry and use_case and not engine.use_case_resolved(state): engine.resolve_use_case(...)`, ~:1196). It also persists both as the top-level industry/use_case columns (~:1172-1182) for new sessions.
- No validity check exists. An invented pair (e.g. industry="foo", use_case="bar") skips the intent beat, unlocks prd_generation and writes a use_case_brief for a use case with no curated content.
- lakebase `_has_defined_intent(row)` (lakebase.py:1757) grants App step-1 credit (_INTENT_STEP) to any row whose industry and use_case columns are non-empty, so the bogus pair also earns step-1 credit in the App/analytics read.
- The curated lookup already exists: `_use_case_label_for(industry, use_case)` (mcp_server.py:1547) matches against `_available_use_cases(industry)`, the same curated list vibe_set_parameters' curated path and the echo use, and returns None for an unknown pair.

## Change (trunk file src/backend/mcp_server.py; charter exception accepted by plan_critic)
1. Add `_curated_pair_status(industry, use_case) -> Literal["known", "unknown", "unavailable"]`, built on the same `_available_use_cases(industry)` call: known = the value is in the list; unknown = the list is non-empty and the value is absent; unavailable = the lookup raised or returned an empty list (catalogue down or offline).
2. In vibe_start_track, when both industry and use_case are given:
   - known → today's behavior (resolve the gate, persist the columns).
   - unknown → do NOT resolve the gate, do NOT persist the industry/use_case columns or session_parameters keys, and name the session "Genie Code Workshop" (not `Genie Code — <bogus>`). The session still starts, and the intent beat then elicits a real pick (curated, or custom via draft_custom) on the first vibe_next_step.
   - unavailable → today's behavior (fail open, D-13). Session creation must never break on a catalogue outage, and today's tests (offline catalogue) stay green.
   The StartTrackResult schema is unchanged (no new field, since extra=forbid on the contract). The ignored pair is logged at INFO with the session id.
   Compute the status ONCE, before the new-session persist block, so the name and columns for the new-session persist and the later resolve both follow it.
3. lakebase._has_defined_intent is NOT changed. With (2), MCP no longer writes unknown pairs, and the App only writes catalogue selections.
4. docs/superpowers/decision-log.md: append D-13 (2026-10-04) · "An unknown (industry, use_case) at vibe_start_track is ignored: no gate, no columns, and the intent beat elicits a real pick. The catalogue being unavailable fails open (today's behavior). Rule (3), most reversible, with no contract change. · Reverse: drop the unknown branch." Public register, in the file's one-line format.

Fence: src/backend/mcp_server.py, a new tests/workshop/test_start_track_unknown_usecase.py (existing start-track tests unchanged), docs/superpowers/decision-log.md, and the plan file.

## Tests (stub `_available_use_cases` per test)
- U1: a known pair → the gate is resolved, the columns are persisted, and the session is named `Genie Code — <use_case>` (unchanged).
- U2: an unknown pair (non-empty catalogue, value absent) → use_case_selection is NOT in completed_gates; no use_case_brief is captured; the industry/use_case columns and params are not written; the session is named "Genie Code Workshop"; vibe_next_step returns the intent beat.
- U3: catalogue unavailable (raises, or returns []) → today's behavior (gate resolved).
- U4: an unknown pair and then a valid vibe_set_parameters curated lock → the gate resolves normally.
- U5: only industry, or only use_case, given → unchanged (no resolve, as today).
- Existing test_start_track_labels.py, test_session_autosave.py and test_usecase_ghost_retirement.py stay green UNCHANGED. If any of them relies on a non-curated pair with a non-empty stub catalogue, STOP and report rather than edit it.

## Acceptance contract
- Backend suite (DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= <APP>/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q): floor 602 plus the new tests, 0 failed. Frontend `npm run lint` ABSOLUTE (0 errors), `npm run build` green, node tests unchanged (39 or whatever the base has, all green). MCP tools/list = 7.
- Tampers (FORGE/state/specs/start-track-unknown-usecase/tampers.md; line numbers indicative), each verified and then restored byte-identically: T1 map an absent value to known → U2 red; T2 map a catalogue failure to unknown → U3 red; T3 write industry/use_case unconditionally → U2 red (a column/params assertion).
- Open a PR into feature/genie-code-mcp-integration titled "start-track-unknown-usecase: ignore an uncatalogued use case at vibe_start_track".

## Fence amendment (post-implementation)

The STOP condition fired: `tests/workshop/test_start_track_labels.py::test_b_unknown_use_case_persists_null_label` sends an uncatalogued pair (`travel` / `nonexistent_uc`) against a non-empty stub catalogue and asserted (:129) that the raw `use_case` column is persisted, which contradicts Change §2. The lead resolved it with D-15:

> Decision D-15 (lead):
> - Keep writing `industry` and `industry_label` when the industry IS catalogued, even if the use case is unknown. This protects R3.1 by_industry analytics; test_b :128 stays as is.
> - Do NOT write the unknown `use_case`, neither the column nor session_parameters['use_case']. Do not resolve the gate, and use the default name "Genie Code Workshop". Step-1 credit (lakebase _has_defined_intent) needs both columns, so not writing use_case removes the bogus credit.
> - If the INDUSTRY itself is not catalogued, i.e. `_industry_label_for` returns None or the industry list is non-empty and lacks it, write neither.
> - The catalogue-unavailable fail-open is unchanged.

Files touched beyond the original Fence:
- `tests/workshop/test_start_track_labels.py`: test_b :129 only (`== "nonexistent_uc"` → `is None`), per D-15. The test name and comments still describe the behavior, so they are unchanged. Nothing else in that file is touched.

Adjustments to the plan's tests and tampers, per D-15:
- U2 (unknown use case on a catalogued industry): the gate is not resolved and no brief is captured; `industry` and `industry_label` ARE written; `use_case`, `use_case_label` and `session_parameters['use_case']` are NOT written; the name is "Genie Code Workshop"; vibe_next_step returns the intent beat.
- U6 (new; uncatalogued industry): neither `industry` nor `use_case` is written (column or param), and there is no gate.
- T3 now means "write use_case unconditionally" → U2 red.
- docs/superpowers/decision-log.md gets ONLY D-15, appended at the end of the file as it stands at base 957157f (lead amendment: PR #91 usecase-beat-seed-prereq already appends D-13 and D-14, so D-13 is not appended here, to avoid a duplicate and a merge conflict).

Implementation note on Change §1: an uncatalogued industry has an empty `_available_use_cases(industry)` list, which §1 alone would classify as "unavailable" (fail open), so the defect's own example (`foo`/`bar`) would still resolve the gate. To honor D-15's "the industry list is non-empty and lacks it", `_curated_pair_status` returns "unknown" when the use-case list is empty AND `_available_industries()` is non-empty and lacks the industry. It returns "unavailable" when a lookup raises or the whole catalogue is empty. U3 covers both outage shapes (raises; both lists empty).
