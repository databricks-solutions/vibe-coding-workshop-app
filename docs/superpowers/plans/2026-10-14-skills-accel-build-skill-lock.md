# Plan: skills-accel-build-skill-lock — skills-accelerator always means build_skill (D-115)

- Date: 2026-10-14 · Repo: app · Base: origin/feature/genie-code-mcp-integration at dispatch time (2f330bd today;
  after coach-endpoint merges if that lands first)
- Status: r0 critic ACCEPT → HUMAN SIGNED 2026-10-14 with one change (D-120, r1 below) → critic delta review of r1 → build.
- Commit this file unchanged at docs/superpowers/plans/<dispatch-date>-skills-accel-build-skill-lock.md
- Release: merge only (D-91). No deploy by the forge, no reseed, no DDL, no new MCP tool, no web change.
- Serialization: edits src/backend/mcp_server.py (trunk) and docs/superpowers/decision-log.md, which
  coach-endpoint also edits; build strictly after coach-endpoint merges.

## Why (state/probes/skills-accel-unknown-step.md)

Every MCP tool except `vibe_start_track` resolves the session's track through
`track_resolution.resolve_track` (`track_resolution.py:63-80`): a use-case lock wins
(`USE_CASE_LEVEL_LOCK = {"build_skill": "skills-accelerator"}`, `:32-34`), otherwise
`skills-accelerator` is downgraded to `end-to-end` (`:79-80`). That mirrors the web app
(`restoreLevel.ts:75-77`), where skills-accelerator is reachable only via use case build_skill
(industry `sample`, label "Build a Data Contract Skill", seeded `01_seed_usecase_descriptions.sql:426`),
and any other pick hides the track and moves the learner to end-to-end visibly
(`App.tsx:1708-1715`, `LevelSelector.tsx:372-374`). So the shipped web behaviour defines the track.

MCP's gap: `vibe_start_track(track="skills-accelerator")` without industry+use_case persists a session
with no use case (`mcp_server.py:1271-1301`), returns the 9-step skills outline (`:1335`), and the
intent beat then offers every use case via `_available_use_cases(industry)` (`:2343`, used at `:1184`
and `:2174`). Until build_skill is locked, every later tool resolves end-to-end: the 5 `skill_*` steps
return UNKNOWN_STEP by name, and a non-skill pick (e.g. `booking`) silently walks the 24-step
end-to-end track while the learner's roadmap shows 9 skills steps.

## Change (MCP only; `src/backend/mcp_server.py`)

1. `vibe_start_track` on `track == "skills-accelerator"` (new session or resume of a session that has no
   locked use case yet):
   - If the caller passed an `industry` other than `sample` or a `use_case` other than `build_skill`,
     return `INVALID_PARAMETER` with the message in item 3, and create/persist nothing.
   - Otherwise force `industry = "sample"`, `use_case = "build_skill"` **before** the D-13 curated-pair
     check (`:1253`) and before the new-session persist (`:1271`), so the persisted record carries
     `use_case = build_skill` (and its label via `_use_case_label_for`) from the first write. The
     existing block at `:1316-1324` then resolves the `use_case_selection` gate via
     `engine.resolve_use_case`, so the intent beat (and its use-case picker) never appears on this track.
   - Missing pair: if `_curated_pair_status("sample", "build_skill")` is not `"known"`, return a new
     error code `USE_CASE_UNAVAILABLE` ("The skills-accelerator track needs the 'Build a Data Contract
     Skill' use case, which is not in this workspace's use-case catalogue. Start end-to-end instead, or
     ask the facilitator to reseed use cases.") and create/persist nothing. This covers both `"unknown"`
     and `"unavailable"` (catalogue outage): never fall back to end-to-end (D-115). [Critic: judge
     whether `"unavailable"` should fail the same way; D-115 says fail clearly.]
   - Resuming a session whose use case is already locked: unchanged (no new check).
2. `vibe_set_parameters` when the resolved `track == "skills-accelerator"` (only reachable for a
   build_skill-locked session, by `resolve_track`): refuse, with `INVALID_PARAMETER` and the item 3
   message, any incoming `use_case` other than `build_skill`, any `industry` other than `sample`, and
   `use_case_source == "custom"`. Checked with the other pre-persist rejections (after `_RESERVED_PARAM_KEYS`,
   `:2116`), so a refused call persists nothing (all-or-nothing). Non-selection params (catalog, schema,
   aliases) are unaffected.
3. Refusal message (one constant, `_SKILLS_TRACK_LOCK_MESSAGE`): "The skills-accelerator track always
   builds the Data Contract Skill (use case build_skill). To work on a different use case, start the
   end-to-end track with vibe_start_track(track=\"end-to-end\")."
4. Untouched: `track_resolution.py` (the lock already makes `resolve_track` return skills-accelerator),
   `_available_use_cases`, routes.py, the frontend (incl. `restoreLevel.ts`, `App.tsx`, `LevelSelector.tsx`),
   the manifest, seed and DDL, every other tool, every other track's behaviour.
5. Existing MCP sessions already switched to end-to-end (a non-skill use case locked after a
   skills-accelerator start) stay as they are: no migration, no data write. Their record has a non-skill
   use case, so `resolve_track` keeps returning end-to-end, which matches what they have walked.

### Charter exception (trunk file)

- File: `src/backend/mcp_server.py`, limited to `vibe_start_track` (the skills lock + missing-pair error),
  `vibe_set_parameters` (the refusal) and one new module constant. No other function changes.
- Reason: both tools live only there; the defect is in their skills-accelerator handling.
- Reversal: revert the PR; MCP returns to offering every use case on that track (today's behaviour).

## Tests (new `tests/workshop/test_skills_track_lock.py`; existing tests change only if they pin the gap)

- T-a Every `skill_*` step on the skills-accelerator outline resolves by name (`vibe_get_step` and
  `vibe_explain_step`, `sectionTag=<tag>`) on a fresh `vibe_start_track(track="skills-accelerator")`
  session: no UNKNOWN_STEP.
- T-b The walk stays on skills-accelerator from start to Done: complete each step in outline order;
  every `next` is the next skills-accelerator step, the final result is Done, and no end-to-end-only
  step (e.g. `prd_generation`) ever appears.
- T-c `vibe_start_track`'s roadmap equals the actual outline: its `outline` tags equal the outline the
  session-state resource returns on the next call, and equal `engine.outline("skills-accelerator", …)`.
- T-d A non-skill use case on that track is refused: `vibe_start_track(track="skills-accelerator",
  industry="retail", use_case="booking")` and `vibe_set_parameters(..., {"use_case": "booking"})`,
  `{"industry": "retail"}` and `{"use_case_source": "custom"}` each return INVALID_PARAMETER with the
  message, and the persisted state is unchanged (no session created for the start call).
- T-e Missing pair: with `get_use_cases_map` lacking sample/build_skill (and, separately, raising /
  returning empty), `vibe_start_track(track="skills-accelerator")` returns USE_CASE_UNAVAILABLE and
  persists nothing; it never returns an end-to-end outline.
- T-f The persisted record after the start call has `use_case == "build_skill"` and
  `track_resolution.resolve_track(record) == "skills-accelerator"`; the intent beat is never served
  (`vibe_next_step` first result is the first skills step, not "Define Your Use Case").
- T-g Web path unchanged: the SPA outline route for that session returns the same tags as MCP (parity
  with the #134 test pattern); other tracks' start/set_parameters behaviour unchanged (an end-to-end
  start without a use case still gets the intent beat; `booking` on end-to-end is accepted).

## Docs

- D2 `docs/specs/mcp_design/mcp-interface-contract.md`: `vibe_start_track` and `vibe_set_parameters`
  sections — one note each on the skills-accelerator lock, and `USE_CASE_UNAVAILABLE` added to the
  error list. Nothing else.
- `docs/superpowers/decision-log.md`: append every D-entry from FORGE/state/lead/decisions.md after the
  last one present at base, word for word.

## Acceptance

- A1 Fence: mcp_server.py (the three items only), tests/workshop/test_skills_track_lock.py, any existing
  test that pins the gap (named in the PR body with the reason), mcp-interface-contract.md,
  decision-log.md, the plan. `track_resolution.py`, `routes.py`, `src/**/*.ts(x)`, manifest, `db/`
  byte-identical to base.
- A2 Tool count still 7; no tool description changes [critic: confirm none is needed; if
  vibe_start_track's description must mention the lock, say so and check the 400-char bound].
- A3 T-a…T-g green; full suite ≥ floor (1892 today, or the coach-endpoint floor), 0 failed.
- A4 Gatekeeper offline probe at head vs base on skills-accelerator: base reproduces UNKNOWN_STEP for
  the 5 `skill_*` steps after a non-skill pick; head refuses the pick and resolves all 5.
- Tampers: X1 drop the force-lock in vibe_start_track → T-a/T-f red; X2 drop the set_parameters
  refusal → T-d red; X3 fall back to end-to-end on a missing pair → T-e red; X4 lock after the persist
  instead of before → T-f red (record use_case None); X5 apply the refusal on every track → T-g red.
- Live checks (after the human deploys): fresh skills-accelerator session over MCP shows the 9-step
  outline, first step is the first skills step, the 5 `skill_*` steps resolve by name, `booking` is
  refused with the message, and the session opens on skills-accelerator in the web UI.

## Questions for the critic

(a) Is forcing the pair before `:1253`/`:1271` enough for the persisted `use_case` column (and label) to
    read build_skill on the first save? Any other write that could clear it?
(b) Resume path: `vibe_start_track(session_id=…)` on an unlocked skills session — does `_load_session_and_track`
    with `track` already resolve end-to-end there? What should the plan do with such a session (lock it,
    or leave it per item 5)?
(c) Does any existing test start skills-accelerator without a use case and expect the intent beat or a
    use-case list? Name each, and whether the change is a pin of the gap.
(d) Is `USE_CASE_UNAVAILABLE` acceptable as a new error code, or does an existing one fit
    (`test_start_track_unknown_usecase.py`)?
(e) `vibe_explain_step`, `vibe_submit_answer`, `vibe_complete_step` on a locked skills session: any path
    that still re-derives the track without the lock?
(f) Can each tamper turn a named test red?

## Revision r1 (2026-10-14, human sign-off with one change, D-120) — amends Change item 1 and T-e

r1 supersedes the "Missing pair" bullet of Change item 1, T-e, and the tamper X3 wherever they conflict.

- Missing pair (`_curated_pair_status("sample", "build_skill") == "unknown"`: the catalogue answers but
  the pair is not in it): return `USE_CASE_UNAVAILABLE` with the item 1 message and create/persist nothing.
- Catalogue outage (`== "unavailable"`): let the start through. Lock `industry="sample"` and
  `use_case="build_skill"` anyway (constants, so `resolve_track` still returns skills-accelerator and the walk
  cannot leave the track); persist the label from `_use_case_label_for`, or the constant
  `"Build a Data Contract Skill"` when that lookup fails or returns None; log exactly one WARNING with no
  content (no session id, no params; e.g. "skills-accelerator start: use-case catalogue unavailable; locked
  build_skill with constant label"). This matches D-13's fail-open on other tracks. "Fail clearly" (D-115)
  means never silently moving the learner to end-to-end; r1 keeps that.
- T-e (r1): (i) `get_use_cases_map` answers without sample/build_skill → `USE_CASE_UNAVAILABLE`, nothing
  persisted, no end-to-end outline. (ii) `get_use_cases_map` raises, and separately returns empty → the start
  succeeds on skills-accelerator, persisted `use_case == "build_skill"`, label set (constant when the lookup
  fails), exactly one WARNING logged and it contains no session id or parameter value, never an end-to-end
  outline.
- Tampers (r1): X3 becomes "fall back to end-to-end on a missing pair" → T-e(i) red; new X6 "fail with
  USE_CASE_UNAVAILABLE on an outage" → T-e(ii) red; new X7 "drop the constant label fallback" → T-e(ii) red
  (label unset); new X8 "put the session id in the WARNING" → T-e(ii) red.
- Live checks (r1, lead additions to the critic's 3): the walk never reaches `prd_generation`;
  `vibe_start_track(track="skills-accelerator", industry="retail", use_case="booking")` is refused with the
  message; the `vibe_start_track` roadmap equals the outline from the session-state resource.
- Question for the delta review: (g) Is `_curated_pair_status`'s three-way split (`:1716`) exactly
  known/unknown/unavailable as r1 assumes, and does an empty map return "unavailable" (not "unknown")? If an
  empty map returns "unknown", say so: T-e(ii)'s empty case would then need the plan to define "empty" as an
  outage explicitly.
