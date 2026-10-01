# Phase 3 · T5 · R4 — Contract: remove all app reads/writes of the legacy step columns

**Status:** APPROVED 2026-10-01 with changes (see "Approval record" at the end). R4a dispatch blocked until host disk space is confirmed.
**Base:** `feature/genie-code-mcp-integration` @ `8619f4a` (R1 #69 merged `fc1cedb`, R3.1 #68 merged `8619f4a`).
**Columns in scope:** `completed_steps`, `current_step`, `skipped_steps` on `${schema}.sessions`.
**Goal:** zero application references to the three columns outside DDL, the R1 runbook tooling (until the DROP), and the tests that pin their absence. Expand → migrate → **contract** (this PR stack). The column DROP stays the human's, after R4 is deployed and soaked.

## Guardrails (inherited)

- No DDL, no column drop, no backfill run by polly, no reseed, no deploy. Human hard stops.
- Engine order authoritative; frozen-golden parity stays green; T4a preview endpoint untouched.
- `engine.py` / `manifest.py` / `manifest.json` zero-diff. `state.py`, `completion_keying.py`, `mcp_server.py`, `lakebase.py`, `routes.py` are in scope (justified below).
- Never compare a JSONB column to `''`.
- Explicit staging; never `.cursor/` or `.isaac/`; never `git add -A`.
- Offline gates: `tests/workshop` + `tests/api` pytest (main `.venv`, `mcp==1.30.0`, `DATABRICKS_CONFIG_FILE=/dev/null`, `LAKEBASE_HOST` unset) + `tests/frontend` node + `npm run build` + `npm run lint` on touched files, pasted in each PR.
- claude_code implements, cursor cross-reviews. One reviewer per diff.

## Decomposition — two stacked PRs, each shippable and reversible

| PR | Scope | Why this order |
|---|---|---|
| **R4a — stop writing** | Remove every WRITE of the three columns (SPA + backend + MCP). Request-model fields removed (old-client posts ignored). Reads unchanged. | Safe on its own: every row written since PR #64 already carries gates, and reads still have the numbers fallback for any row that doesn't. |
| **R4b — stop reading** (stacked on R4a) | Gates-only resolver (D-1 collapse), response fields removed, every SELECT/WHERE/ORDER BY stops touching the columns, SPA fallbacks removed, legacy admin fixup removed, tests rewritten, absence pin added. | Only safe once the pre-deploy gate below shows no row depends on the numbers. |

Human deploys R4a, then runs the pre-R4b gate, then deploys R4b, then soaks, then the DROP.

## 1. Inventory and dispositions

Disposition legend: **remove** · **replace-with-gates** · **ignore-on-input** · **keep-until-DROP** · **keep (not a column)** · **test-rewrite** · **test-delete** · **pin-absence**.

### 1.1 Backend — writes (R4a)

| Location | Column(s) | Disposition |
|---|---|---|
| `mcp_server.py:1304-1329` `_legacy_progress` | current_step, completed_steps | **remove** function |
| `mcp_server.py:949-950` `vibe_start_track` seed `save_session(current_step=1, completed_steps=[])` | both | **remove** kwargs |
| `mcp_server.py:1419-1421` + `1433-1440` `vibe_complete_step` | both | **remove** `_legacy_progress` call + kwargs; keep `completed_gates`/`captured_outputs` |
| `mcp_server.py:1717-1719` + `1745-1757` `vibe_set_parameters` lock path | both | **remove** call + kwargs; keep `completed_gates` + the four industry/use-case columns |
| `lakebase.py:628,630,631` `save_session` params | all three | **remove** params |
| `lakebase.py:677-679` logging, `707-710` dedupe/serialize | all three | **remove** |
| `lakebase.py:729`, VALUES, params tuple `~771` INSERT | all three | **remove** columns. INSERT then relies on DDL defaults (`current_step DEFAULT 1`, `skipped_steps DEFAULT '[]'`, `completed_steps` NULL) until the DROP — fine, nothing reads them after R4b |
| `lakebase.py:753,755,756` `ON CONFLICT … COALESCE` | all three | **remove** SET clauses |
| `routes.py:5630-5631` `create_new_session`, `5715-5716` default-session seed | current_step, completed_steps | **remove** kwargs |
| `routes.py:5789,5791` `save_session_endpoint` | current_step, completed_steps | **remove** forwarding |
| `routes.py:6142-6158` update-metadata logging, dedupe, `current_step = max(completed_steps)` | all three | **remove** |
| `routes.py:6184-6187` update-metadata forward to `save_session` | all three | **remove** |
| `routes.py:5456,5469` `SessionSaveRequest.current_step/completed_steps` | request | **remove** → **ignore-on-input** (§3) |
| `routes.py:6103,6104` `SessionUpdateMetadataRequest.completed_steps/skipped_steps` | request | **remove** → **ignore-on-input** |

### 1.2 Frontend — writes (R4a)

| Location | Disposition |
|---|---|
| `App.tsx:802` update-metadata `completed_steps` | **remove** (keep `completed_gates` @808-809) |
| `App.tsx:829` skip autosave `skipped_steps` | **remove** (keep `skipped_gates` @834) |
| `App.tsx:1015` save `current_step: Math.max(...)` | **remove** |
| `App.tsx:1024` save `completed_steps` | **remove** (keep gates @1028-1029) |
| `client.ts:296,307` `SessionSaveRequest` | **remove** |
| `client.ts:403-404` `UpdateSessionMetadataRequest` | **remove** |

### 1.3 Backend — reads (R4b)

| Location | Disposition |
|---|---|
| `completion_keying.py:52-59` `_globals_from_numbers` | **remove** |
| `completion_keying.py:75-90` `canonical_global_numbers(..., steps)` | **remove** numbers branch + param |
| `completion_keying.py:93-120` `resolve_completion_globals` | **replace-with-gates** — see D-1 (§2) |
| `state.py:37-55` `_globals_to_tags` | **remove** |
| `state.py:64-81` gates-empty fallback | **replace-with-gates** — delete block (§2) |
| `lakebase.py:872, 889-903, 976-979` `load_session` | **remove** from SELECT, parse, returned dict |
| `lakebase.py:1100-1101, 1116-1117, 1159` `get_user_sessions` | **replace-with-gates** (drop from SELECT once resolver is gates-only); remove `current_step` key |
| `lakebase.py:1205, 1213, 1223-1244, 1296-1299` `get_user_default_session` | **remove** reads; **replace** `ORDER BY current_step DESC, updated_at DESC` — **decision R4-D2 below** |
| `lakebase.py:1572,1574` `_row_completion_globals` | **replace-with-gates** (drop numbers args) |
| `lakebase.py:1705-1706, 1717` `get_leaderboard` SELECT + WHERE `completed_steps != '[]' OR …` | **replace-with-gates** — WHERE keeps only `completed_gates IS NOT NULL AND completed_gates != '[]'::jsonb` |
| `lakebase.py:1983-2144` five `get_analytics` SELECT/WHERE sites | **replace-with-gates** |
| `lakebase.py:2224-2319` `cleanup_session_steps` (41→4 one-off fixup, reads+writes both columns) + route `routes.py:6512-6531` + import-fallback import `routes.py:5386` and stub def `routes.py:5406` | **remove** (R4-D3 approved; no frontend caller) |
| `lakebase.py:1507-1511 _calculate_score`, `1602-1625 _get_chapter_status`, `1743-1744` locals | **keep (not a column)** — params/locals are resolved global numbers. **Rename** to `completed_globals`/`skipped_globals` so the absence pin can be a plain name grep |
| `lakebase.py:1761-1809` leaderboard output keys `completed_steps`/`skipped_steps` | already gate-derived globals, but named like the column → **rename** to `completed_globals`/`skipped_globals` (needed by the Leaderboard skipped tooltip) |
| `routes.py:5660-5691, 5872-5876` default/load endpoints populate response | **remove** |
| `routes.py:5504,5506,5508` `SessionLoadResponse` fields | **remove** (gates fields @5507/5509 stay) |
| `routes.py:5558` `SessionListItem.current_step` | **remove** (`completed_step_count` stays) |
| `routes.py:6421-6422` `LeaderboardEntry.completed_steps/skipped_steps` | **rename** → `completed_globals`/`skipped_globals` (counts @6426-6427 stay) |

### 1.4 Frontend — reads (R4b)

| Location | Disposition |
|---|---|
| `App.tsx:38-46` `deriveCompletedStepNumbers` numbers arm | **replace-with-gates** — collapse to `completedGatesToStepNumbers(completed_gates)` |
| `App.tsx:58-66` `deriveSkippedStepNumbers` numbers arm | **replace-with-gates** |
| `client.ts:336,338,341` `SessionLoadResponse` fields | **remove** |
| `client.ts:431` `SessionListItem.current_step` | **remove** |
| `client.ts:452-453` `LeaderboardEntry` arrays | **rename** to match backend |
| `LeaderboardPage.tsx:302-306` `?? completed_steps.length` fallbacks | **replace-with-gates** — counts only |
| `LeaderboardPage.tsx:349` skipped tooltip | read renamed `skipped_globals` |
| `workflowSections.ts:505, :519` comments; `SessionListDialog.tsx:196` comment | **reword** (R4b) — otherwise the absence pin fails |
| `SECTION_TAG_TO_STEP_NUMBER`, `completedGatesToStepNumbers`, `stepNumbersToGates`, `Set<number>` state, `mergeStatus`, scoring `STEP_SCORES` | **keep (not a column)** — the SPA and scoring still key on global step numbers internally |

### 1.5 DDL / docs / scripts / tests

| Location | Disposition |
|---|---|
| `db/lakebase/ddl/03_sessions.sql:24,26,27` | **keep-until-DROP** |
| `db/lakebase/README.md:115-118` | **keep-until-DROP** (human updates with the DROP) |
| `scripts/r1_emit_map_sql.py`, `scripts/r1_verify_backfill.py`, `tests/workshop/test_r1_backfill_runbook.py`, R1 runbook | **keep-until-DROP** — the pre-DROP re-check (§6) |
| `scripts/generate_manifest.py:752` comment | refresh comment; keep `step_number_to_tag` (engine/scoring use it) |
| `test_completion_reconcile.py` (PR1) | **test-rewrite** — delete App-origin numbers cases; keep gates-present; add "numbers-only row ⇒ no progress" pin |
| `test_status_projection_convergence.py` (PR2) | **test-rewrite** — fixtures to gates |
| `tests/api/test_gate_dualwrite.py`, `test_gate_dualwrite_roundtrip.py` (PR3a) | **test-rewrite** — delete "numbers still written" asserts (`:132-134`, `:180`); keep gate write / COALESCE / merge |
| `test_session_gates_passthrough.py`, `test_session_skipped_gates_passthrough.py` (PR3b′) | **test-rewrite** — gates-only hydrate |
| `test_completion_keying_aggregations.py` (PR3c) | **test-rewrite** — drop App-origin numbers cohort; keep gate-only + dense-collision |
| `test_pre_drop_cleanup.py` (R3) | **test-rewrite** → contributes to the absence pin |
| `test_sync_bridge.py` | **test-rewrite** — MCP no longer writes `current_step`/`completed_steps`; assert they are absent from `save_session` kwargs |
| `tests/frontend/deriveSkippedStepNumbers.node.test.ts` | **test-rewrite** — delete legacy fallback case |
| `tests/frontend/stepNumbersToGates`, `mergeStatus` | **keep** |
| other fixtures (`test_track_outline`, `test_engine_state`, `test_start_track_labels`, …) | **test-rewrite** as touched |
| `tests/e2e/**` | none |
| docs/plans, docs/specs | no change in R4 (historical) |

**New in R4b — absence pin** (`tests/workshop/test_legacy_columns_absent.py`): grep `src/**` (backend + frontend) for the three names as whole words; allowed files = none. A second assertion greps `save_session`'s signature and every `SELECT … FROM … sessions` string in `lakebase.py` for the three names. Tamper: re-add `current_step` to any SELECT → fails.

## 2. D-1 once the numbers are gone

Today (PR1): origin is decided by `completed_gates` presence. Gates present ⇒ map `completed_gates` + `skipped_gates`. Gates empty ⇒ read `completed_steps`/`skipped_steps` as global numbers.

After R4b there is **no origin decision**:

- `completion_keying.resolve_completion_globals(completed_gates, skipped_gates, inverse_map) -> (completed, skipped)`:
  - `completed` = globals of `completed_gates` (drop unresolved tags, as today).
  - `skipped` = globals of `session_parameters.skipped_gates`, **always** — no longer conditional on `completed_gates` being non-empty.
  - Step-1 credit rule (`_has_defined_intent`: industry + use_case set) unchanged.
- `state.build_session_state`: `completed_gates` verbatim; `skipped_gates` from `session_parameters` verbatim; the `if not completed_gates:` block and `_globals_to_tags` are deleted.

**Behaviour change, deliberate:** a row with `skipped_gates` set but `completed_gates` empty currently shows skips (in the leaderboard/analytics) from `skipped_steps` numbers; after R4b it shows skips from `skipped_gates`. That is exactly the A′ shape (§4) once A′ is backfilled. The MIXED count (§4) measures a different shape (gates present, `skipped_gates` absent), whose R4b effect is on the engine read path, not the aggregations.

## 3. Old-client compatibility

Every request model in `routes.py` uses Pydantic v2's default `extra='ignore'` (no `model_config` sets otherwise; the only `extra='forbid'` models are the two `OutlineItem` mirrors, which don't carry these fields). So after the fields are removed in R4a, an older SPA tab POSTing `current_step` / `completed_steps` / `skipped_steps` is silently ignored — no 422, no 500.

An old tab's **reads** after R4b: its `deriveCompletedStepNumbers` is gate-first, so hydrate still works; its leaderboard `.length` fallback only runs if the count is missing, and the count is always present. The only degradation is the leaderboard skipped tooltip in an old tab (reads a renamed key → empty) until it reloads.

**Test (R4a), `tests/api/test_old_client_compat.py`:**
- POST `/api/session/save` and `/api/session/update-metadata` with the full legacy payload (all three fields + gates) → 200, the gates persist, and the captured `save_session` call carries **no** legacy kwargs.
- The same payload with only legacy fields (no gates) → 200 and no progress written (proves the fields are ignored, not translated).
- Add an assertion that `SessionSaveRequest` / `SessionUpdateMetadataRequest` have no `model_config` with `extra='forbid'`, so a future change can't silently turn ignore into reject.
- Tamper: set `extra='forbid'` on one model → the POST test fails with 422.

## 4. A′ disposition (and the pre-R4b gate)

**Pre-R4b gate (human, read-only, after R4a deploy, before R4b deploy).** Re-run R1 §(a) dry run verbatim, plus one new count added to the R1 runbook in R4a:

| Count | Meaning | Required |
|---|---|---|
| A | gates empty, `completed_steps` non-empty | **0** |
| A′ | gates empty, `completed_steps` empty, `skipped_steps` non-empty | see below |
| MIXED (new) | `completed_gates` non-empty, `skipped_steps` non-empty, `session_parameters.skipped_gates` missing/empty | **0** |
| M / P / U / K / origin | R1 guards | **0** |

MIXED catches rows where completion moved to gates but skips never did. The leaderboard/analytics already ignore `skipped_steps` on gates-present rows (completion_keying's gates branch), so R4b's effect on MIXED rows is in the **engine read path**: `state.build_session_state` today backfills `skipped_gates` from `skipped_steps` when the key is absent, and R4b deletes that fallback, so those rows' skips would disappear from the engine outline. Requirement stays MIXED = 0. (PR #64 always writes both, so it should be 0.)

Informational (not a STOP): rows with `completed_gates` empty AND `skipped_gates` non-empty — the sessions affected by the R4a→R4b window below.

**If A′ = 0** (today's value): R4b deploys as-is.

**If A′ > 0:** R4b's PR ships an additional runbook section "A′ skipped_gates backfill" (same shape as R1: backup table `r4_aprime_backup_YYYYMMDD_HHMM`, single-transaction `UPDATE … SET session_parameters = jsonb_set(…, '{skipped_gates}', mapped)` for A′ rows only, manual COMMIT, re-run = UPDATE 0, surgical rollback of the key only). It goes live in the **same deploy window** as R4b: human runs it immediately after R4b is deployed (with R4b's gates-only resolver, `skipped_gates` is the thing that's read). Verify: for every A′ row, the skipped count under the new rule equals the backup's `skipped_steps` count. `skipped_steps` is **not** dropped until A′ = 0 under the post-R4 rule.

## 5. No DDL

R4a and R4b contain no DDL. The DROP of `completed_steps`, `current_step`, `skipped_steps` is the human's, after R4b is deployed and soaked.

## 6. Pre-DROP re-check, and what the R1 tests become

**Runbook:** re-run **R1's §(a) dry run** (extended in R4a with the MIXED count) as the final pre-DROP check. Required: A = 0, A′ = 0, MIXED = 0, all guards 0, and the R4b absence pin green on the deployed commit. No new runbook — R1 already has the cohort SQL, and duplicating it would create a second copy to drift.

Optionally I can add a one-page "pre-DROP checklist" section to the R1 runbook in R4a (the gate above + `SELECT` confirming no app write touched the columns since the R4b deploy: `max(updated_at)` of rows where `completed_steps IS DISTINCT FROM` the DDL default — informational, can't prove absence but catches a stray writer). The DROP statement itself is not drafted by me.

**R1 tests after the DROP:** `test_r1_backfill_runbook.py`, `scripts/r1_emit_map_sql.py`, `scripts/r1_verify_backfill.py` and the R1 runbook all read the dropped columns, so they're **retired in a post-DROP cleanup PR** (delete), and the absence pin extends to assert the DDL no longer declares the columns. Until the DROP they stay green and unchanged (R4a only adds the MIXED count + its test).

## Decisions for the human

- **R4-D1 — two PRs (R4a writes, R4b reads)** vs one combined PR. Recommend two: each is independently deployable, and the pre-R4b gate sits between them.
- **R4-D2 — default-session ordering.** `get_user_default_session` picks the user's resumable unsaved session with `ORDER BY current_step DESC, updated_at DESC`. Options: (a) **`ORDER BY updated_at DESC`** — most recently touched wins; loses the "most progress" tiebreak; orphan cleanup normally keeps one unsaved session per user so impact is low. (b) Fetch the candidates and sort in Python by gate-derived completed count, then `updated_at`. Recommend **(a)**: simpler, and "most recent" is arguably the right resume target.
- **R4-D3 — remove `cleanup_session_steps` + its admin route.** It's a one-off 41→4 fixup that reads and writes both columns. Recommend remove (it can't work after the DROP anyway).
- **R4-D4 — rename gate-derived `completed_steps`/`skipped_steps` keys** on `LeaderboardEntry` and the scorer locals to `completed_globals`/`skipped_globals`, so the absence pin can be a strict name grep. Recommend yes.

## Ledger (not in R4)

- RMW race in `_merge_app_gates`.
- Slow `tests/workshop` (~295s).
- `vibe_start_track` accepts an unknown use case and still earns step-1 credit.
- R1 (e) label SQL reads `usecase_descriptions` labels but not `get_industries` `label_overrides` (`routes.py:810`).

## Approval record (2026-10-01)

- D1 two stacked PRs — YES. D2 `ORDER BY updated_at DESC` — YES. D3 remove `cleanup_session_steps` + admin route + the `routes.py:5386` import fallback / `:5406` stub — YES. D4 rename to `completed_globals`/`skipped_globals`, frontend renamed in the same PR (R4b), old-tab tooltip degradation stated in the R4b PR body — YES.

### Added to R4a
1. **NULL `completed_steps` test.** After R4a the INSERT omits `completed_steps`, which has no DDL default (`03_sessions.sql:26`), so new rows store NULL. A row with NULL `completed_steps` (plus default `current_step`/`skipped_steps`) goes through `load_session`, `get_user_default_session`, `get_user_sessions`, `get_leaderboard`, `get_analytics` with no error and correct gate-derived counts. Tamper: make one reader `json.loads` the raw value → fails.
2. **MCP → SPA visibility re-proof** (what `_legacy_progress` used to provide). An MCP `vibe_complete_step` completion appears in the session load response via `completed_gates`, and `deriveCompletedStepNumbers` maps it to the correct global step, with no `completed_steps` written. Tamper: drop the `completed_gates` write → fails.
3. **Pre-DROP checklist section** in the R1 runbook (informational), plus the MIXED count and the informational "gates empty, skipped_gates non-empty" count.
4. **R4a PR body states the R4a→R4b window:** until R4b deploys, a session with skips but no completions loses its skips from the leaderboard/analytics (the resolver reads `skipped_steps` when `completed_gates` is empty, and R4a stops writing them). Display-only; self-heals at R4b. Accepted.

### Added to R4b
5. Reword the three comment hits (`workflowSections.ts:505, :519`, `SessionListDialog.tsx:196`) so the absence pin (allowed files = none in `src/**`) holds.

### Human sequence
Gate + merge + deploy R4a → smoke (old-client POST 200 with fields ignored; new row has NULL `completed_steps` and loads; MCP-completed step visible in the SPA) → pre-R4b gate (R1 dry run + MIXED + informational count) → polly dispatches R4b → gate + merge + deploy → soak → human DROP.

## Gate record — R4a executed (2026-10-01, human-verified)

- **Merged:** `d27bfda` (squash of `5d9e9f2`, PR #70). **Deployed** `--code-only`, no reseed. Lakebase configured.
- **Gated:** `tests/workshop` + `tests/api` 458 passed; `tests/frontend` node 14/14; build clean (one pre-existing eslint warning, `App.tsx:393` exhaustive-deps, on base); no remaining `save_session` caller passes the removed kwargs; `/admin/cleanup-sessions` has no callers anywhere.
- **Human tampers, each bites and recovers:** App.tsx re-adds `completed_steps` → 1 fail; `SessionSaveRequest` `extra='forbid'` → 3 fail (422); `vibe_complete_step` re-passes `current_step` → 4 fail; default-session NULL guard removed → 1 fail.
- **Smoke PASS:** legacy-only POSTs to save + update-metadata → 200 (ignored, not translated); both new DB rows have `completed_steps` NULL, `current_step = 1`, `skipped_steps = '[]'` (DDL defaults only); MCP `vibe_complete_step(project_setup)` shows in the load response's `completed_gates` with `completed_steps` empty, and the real FE bridge (`completedGatesToStepNumbers`) maps it to global 2.
- **Pre-R4b gate (R1 runbook (a) verbatim incl. (a.1c); 22 rows, read-only):** A=0, A′=0, **MIXED=0**, informational=0; guards A′/M/P/U/K/origin = 0 rows; preview 0. → **NO A′ backfill section needed in R4b.**
- **Slow-suite diagnosis (ledger update):** with `DATABRICKS_CONFIG_FILE=/dev/null` (LAKEBASE_HOST and DATABRICKS_AUTH_TYPE unset), the full `tests/workshop` + `tests/api` run takes **~4s, not ~295s** — the slowness is SDK auth resolution, not the tests.

### R4b additions (human, at dispatch)

1. **Commit this plan doc in R4b** (it is untracked in the main tree), including this gate record.
2. **FE test fidelity:** `tests/frontend/deriveCompletedStepNumbers.node.test.ts` re-models the App's logic instead of importing it. In R4b, once the derive functions collapse to gates-only, **move them out of `App.tsx` into an importable module (no behaviour change)** and test the REAL functions. Tamper: re-add a numbers fallback in the real function → the test fails.
3. **Optional if trivially adjacent:** bake the SDK-auth isolation (`DATABRICKS_CONFIG_FILE=/dev/null`, LAKEBASE_HOST/DATABRICKS_AUTH_TYPE unset) into the tests conftest/pytest env so the default invocation is fast (~4s). Otherwise leave it on the ledger with the diagnosis above.
