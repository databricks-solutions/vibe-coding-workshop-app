# Phase 4 exit gate report (RUN.md P4.6, 2026-10-08)

Base: `feature/genie-code-mcp-integration` at 89ee6f0 (#126). Phase 4 started at e579ca2 ("2026-10-05 Phase 4 starts", FORGE/state/lead/status.md:683) and covers RUN.md P4.1–P4.6. It landed in APP #107–#126 (20 PRs) and TPL #18 and #19. The MCP tool count is still 7. Every Phase 4 probe that listed tools found 7, the last being FORGE/state/probes/89ee6f063251437563069abc99dff0438db81ae0-cleanup-140-profile.md L4.

The backend suite was re-run at 89ee6f0:

`DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= $APP/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q`

`1640 passed, 2 warnings in 49.63s`

The floor is 1640. Result: 1640 passed, 0 failed.

Line numbers below are at 89ee6f0. Probe files are under FORGE/state/probes/ and are named by the merge SHA they probed. Their numbers are quoted as the probes report them. "FORGE" means the workshop-forge checkout. The forge probes only read the served text. No served instruction was executed (section 5).

## 1. Summary

APP (`git log --merges e579ca2..89ee6f0`):

| PR | Merge | Title |
|---|---|---|
| #107 | 7329736 | P4.1: walk the session's track instead of the genie-accelerator pin |
| #108 | 7c76a62 | P4.2: hoist use_case_selection onto every track's prd_generation (D-33, D-34) |
| #109 | ca9ff61 | fix(tables-step): additive by default; destructive reseed needs double opt-in (D-35, incident fix) |
| #110 | 5e0ed6e | feat(seed): new seed rows reach existing installs via baseline + ledger (D-37) |
| #111 | aca30f7 | test(start-track): pin unknown-pair step-1 credit (U7) + resume path (U8a/U8b) |
| #112 | 658cbe3 | fix(seed): close the D-37 insert/ledger crash windows (D-38) |
| #113 | 22a0402 | fix(seed): WARN and skip an S4 row that hits uq_section_assistant_version_active (D-40) |
| #114 | 6230f58 | feat(seed): genie-code forks for workspace_setup_deploy + redeploy_test (P4.3 app family, D-39) |
| #115 | 9710bbd | feat(seed): genie-code fork 1003 for optimize_genie (P4.3 lakehouse family, D-41) |
| #116 | 0b07fc0 | test(genie): P4.3 covered families walkable in Genie Code (end-to-end, accelerator, de-accelerator, reverse-lakebase, reverse-app; D-43, D-44) |
| #117 | ac40295 | feat(seed): genie-code forks 1004-1006 for skills-accelerator (P4.3 family 5, D-45, D-46) |
| #118 | 4540e86 | fix(sessions): widen workshop_level to VARCHAR(64); vibe_start_track fails closed (D-48, D-49). Rolled back (D-50) and re-landed as #122 |
| #119 | 7c3712c | feat(seed): genie-code forks 1007-1010 for agents-accelerator foundation (P4.3 family 6A, D-47). 1009 was dropped by D-51 and shipped in #123 |
| #120 | 7c014d7 | feat(seed): genie-code forks 1011-1016 for the agents-accelerator MLflow SDLC loop (P4.3 family 6B, D-52) |
| #121 | d0e9fe7 | feat(seed): genie-code fork 1017 genie_silver_metadata + genie-accelerator family test (P4.3 reference, D-53) |
| #122 | 7e4144d | Re-land #118: widen sessions.workshop_level to VARCHAR(64) (DDL 16) + SESSION_NOT_SAVED (D-55) |
| #123 | a7e1699 | p4-agents-a-1009: genie-code fork 1009 for uc_resources_foundation (RULE_10 foundation carve-out, D-56) |
| #124 | b260c64 | p4-spa-any-track: Genie Code panel names the start prompt for the session's track (P4.5, D-59) |
| #125 | 687cd4d | genie-forks-bare-paths: 12 v2 genie-code rows root the genie-accelerator forks' bare paths (D-57; 3 held by D-61) |
| #126 | 89ee6f0 | cleanup-140-profile: genie-code fork 1033 for workspace_cleanup, participant-scoped, confirm-before-delete (D-58) |

The same range also has 6 base-sync merges on PR branches. They are not PRs:
- 97e5200 (into p4-app-family)
- 07e434a (into p4-skills-accelerator)
- 8c53b7e (into workshop-level-too-narrow)
- 0287450 (into p4-agents-a)
- 51b8aa6 (into p4-spa-any-track)
- 00e6f20 (into genie-forks-bare-paths)

TPL (`git log origin/main..origin/feature/genie-code-mcp-integration`):

| PR | Merge | Title |
|---|---|---|
| #18 | 775bebc | forge/tpl-audit-bare-sh: fix(audit): catch bare ./x.sh in SETUP_SCRIPT / SCRIPT_DEPLOY (D-42) (1d6ee10) |
| #19 | edb07a9 | forge/tpl-rule10-foundation: feat(audit): RULE_10 foundation carve-out for prefixed CREATE SCHEMA/VOLUME IF NOT EXISTS (D-56) (4b94f59), fix(audit,F0) (77a8b60) |

**Verdict:** P4.1, P4.2, P4.3 and P4.5 have shipped code, pinning tests and live evidence. P4.3 passes with a caveat: 3 v2 rows are held (D-61), and one queue row is still open (agents-213-execution-label). P4.4 is PARTIAL (D-62): it is served on every track, but within budget only for prd_generation. Section 5 lists what is not proven. Section 6 lists the three questions for a human.

## 2. Requirement matrix (RUN.md P4.1–P4.5)

| # | Requirement | Shipped where (@89ee6f0) | Pinned by | Live evidence | Verdict |
|---|---|---|---|---|---|
| P4.1 | The MCP walk follows the session's track, not the genie-accelerator pin | #107. `_session_track` at mcp_server.py:529 calls `resolve_track` (track_resolution.py:62). `DEFAULT_TRACK` at mcp_server.py:49 is kept only as the definition and the no-record fallback. `SESSION_NOT_SAVED` fails closed at mcp_server.py:1304 (#122, D-55) | test_track_scoped_walk.py: `test_w1_walk_follows_the_session_track` (:147, all 14 tracks), `test_w1b_interleaved_sessions_stay_on_their_own_tracks` (:258), `test_w2_state_resource_outline_matches_the_track` (:275), `test_w3_session_track_is_resolve_track` (:300), `test_w5_tool_count_is_seven` (:420), `test_w7_default_track_only_in_its_definition_and_the_fallback` (:443) | 7329736…-p4-track-scoped-walk.md L2: 3 tracks; MCP vs SPA outline 24/24, 11/11 and 7/7, 0 diff. b260c64…-p4-llm-steps.md: all 14 tracks reached Done, 235 steps, 0 tool errors. 7e4144d…-workshop-level-reland.md L2c: data-engineering-accelerator 11/11, 0 SESSION_NOT_SAVED | **PASS with caveat**: `skills-track-silent-fallback` (§5). Without the use-case lock, skills-accelerator runs as end-to-end (ac40295…-p4-skills-accelerator.md, header) |
| P4.2 | use_case_selection is hoisted onto every track's prd_generation | #108. Override `"prd_generation": "use_case_selection"` at generate_manifest.py:281. `USE_CASE_GATE` at engine.py:317 and `resolve_use_case` at engine.py:327 (the D-34 read-side credit). manifest.json `requiresGate: use_case_selection` (e.g. :114, :272, :510) | test_usecase_hoist.py: `test_h1_manifest_requires_gate` (:199), `test_h2_generator_reproduces_manifest` (:243), `test_h3_spa_regression` (:316), `test_h4_bridge_credits_gate` (:102), `test_h4_bridge_never_persists_the_gate` (:168), `test_h5_mcp_outline_matches_endpoint` (:372), `test_h6_no_intent_beat_when_intent_defined` (:393) | 7c76a62…-p4-usecase-hoist.md: PASS 5/5 (L5 skipped). L2: lakehouse 11/11 and app-only 7/7 full_equal, prd_generation current. L3: no intent beat, prd_generation 8,893 chars, "booking" ×19. L4: the SPA genie session has prd_generation current, 24/24 | **PASS** |
| P4.3 | Every track is walkable in Genie Code: per-family genie-code forks, or a recorded no-fork | Seed 02 rows 1001–1022, 1024–1027 and 1030–1033 (db/lakebase/dml_seed/02_seed_section_input_prompts.sql; first lines :1484 (1001), :7004 (1002), :9588 (1003), :9814/:10083/:10243 (1004–1006), :12610/:12927/:13257/:13537 (1007–1010), :15422–:16582 (1011–1016), :8297 (1017), :19598–:21382 (v2 1018–1032), :10786 (1033)). Seed machinery: #109 (D-35), #110 (D-37), #112 (D-38), #113 (D-40) | test_app_family_genie_forks.py, test_lakehouse_family_genie.py, test_covered_families_genie.py, test_skills_family_genie.py, test_agents_family_genie.py, test_genie_family_genie.py, test_cleanup_genie.py, plus the `test_w8`–`test_w12` walks in test_track_scoped_walk.py (per track in §3) | Per track in §3. The latest probe for each of the 14 tracks walked it to Done with 0 tool errors and 0 empty prompts | **PASS with caveat**: 3 v2 rows are held (1023/1028/1029, D-61); agents-213-execution-label is open (§5) |
| P4.4 | The step-prompt generation path (#77–#79) serves every track's non-bypass sections, within budget | No code change. `STEP_PROMPT_BUDGET_S = 90.0` at mcp_server.py:798 | test_step_prompt_budget.py: `test_budget_bites_degrades_to_template` (:106), `test_late_success_populates_cache_for_next_read` (:185), `test_single_flight_runs_generation_once` (:153) | b260c64…-p4-llm-steps.md: 29/29 pairs returned within the budget (max 90.19 s). Generated within budget: 13/29, all prd_generation (median 29.75 s). Template fallback on the budget: 16 (14 iterate_enhance, skill_define_strategy, skill_create_skillmd). 15 of those 16 truncate afterwards. 0 empty prompts, 0 tool errors | **PARTIAL** (D-62) |
| P4.5 | A genie-code learner can choose any track and gets the MCP connect instructions for it | #124. `ConnectToGenieCodePanel({ workshopLevel })` with `startPromptForTrack` at ConnectToGenieCodePanel.tsx:18–19, track code at :91. The cold-start default `DEFAULT_LEVEL_BY_ASSISTANT` (codingAssistants.ts:121) is unchanged (D-59) | tests/frontend/ConnectToGenieCodePanel.node.test.ts:27, :34, :41, :47; tests/e2e/connect-genie-code.spec.ts:15, :42 | b260c64…-p4-spa-any-track.md: PASS (L0–L3). Fresh session shows `end-to-end`; Genie Code cold start shows "Start the Genie Accelerator"; lakehouse shows `lakehouse`; 7 tools; /health 200 | **PASS** |

## 3. Per-track table (all 14 tracks in src/backend/workshop/manifest.json)

Families follow FORGE/state/lead/tracks.md.

The parity tests named per row are the track-specific ones. Three tests also run on every track:
- `test_w1_walk_follows_the_session_track` and `test_w2_state_resource_outline_matches_the_track` (test_track_scoped_walk.py, parametrized over all 14)
- `test_every_track_serves_1033` (test_cleanup_genie.py:208, every track with workspace_cleanup)

How the no-fork reasons are recorded:
- `project_setup` is virtual. Its content comes from mcp_server.py `_project_setup_content`.
- `prd_generation` is LLM-generated over default row 1.
- `iterate_enhance` is the D-39 no-fork (LLM, row 14).
- `bronze_table_metadata` is the D-41 no-fork (already client-aware).
- `use_case_selection` is the shared P4.2 intent beat, served from default 958.

These sets are recorded in `NO_FORK` in test_covered_families_genie.py:84, test_agents_family_genie.py:102 and test_genie_family_genie.py:104. workspace_cleanup was a D-39 no-fork until D-58. It now forks to 1033 on every track.

| Track | Family | Parity tests | Live walk (latest probe) | Phase 4 genie-code forks reached (input_ids) | Left ui-driven / no-fork / held / parked |
|---|---|---|---|---|---|
| app-only | app | `test_f2_app_family_bodies_carry_no_local_ide_markers[app-only]`, `test_f1_genie_get_step_resolves_the_new_forks`, `test_w8_app_family_walks_every_step_to_done[app-only]` | 89ee6f0…-cleanup-140-profile.md L2: 7/7 to Done, 22 calls, 0 unexpected tool errors, 0 empty prompts, workspace_cleanup served from 1033 | 1002, 1033 | no-fork: project_setup, prd_generation, iterate_enhance, use_case_selection |
| app-database | app | `test_f2_app_family_bodies_carry_no_local_ide_markers[app-database]`, `test_f1_workspace_setup_deploy_is_app_database_only`, `test_w8_app_family_walks_every_step_to_done[app-database]` | b260c64…-p4-llm-steps.md: 10 steps to Done (per-track step count, S0 table); 0 tool errors and 0 empty prompts across all 235 steps. Per family: 6230f58…-p4-app-family.md L3: 11 steps, 0 tool errors in 36 calls | 1001, 1002, 1033 (1033 not walked live on this track) | no-fork: project_setup, prd_generation, iterate_enhance, use_case_selection |
| lakehouse | lakehouse | `test_l1_lakehouse_family_bodies_carry_no_local_ide_markers[lakehouse]`, `test_w1_lakehouse_walk_never_leaves_the_lakehouse_steps`, `test_w9_lakehouse_family_walks_every_step_to_done[lakehouse]` | b260c64…-p4-llm-steps.md: 11 steps to Done, 0 tool errors / 0 empty prompts (totals). Also 7e4144d…-workshop-level-reland.md L3: 11/11, 35 calls, 0 errors, 0 empty | 1002, 1033 (1033 not walked live on this track) | no-fork: project_setup, prd_generation, bronze_table_metadata, iterate_enhance, use_case_selection |
| lakehouse-di | lakehouse | `test_l1_…[lakehouse-di]`, `test_l3_mcp_outline_contains_optimize_genie[lakehouse-di]`, `test_l4_optimize_genie_fork_deploys_from_the_bundle_page_before_any_run`, `test_w9_…[lakehouse-di]` | b260c64…-p4-llm-steps.md: 17 steps to Done, 0 tool errors / 0 empty prompts (totals). Per family: 9710bbd…-p4-lakehouse-family.md L3: 18 steps, 59 calls, 0 app errors, optimize_genie served from 1003 | 1002, 1003, 1033 (1033 not walked live) | no-fork: project_setup, prd_generation, bronze_table_metadata, iterate_enhance, use_case_selection |
| end-to-end | end-to-end | `test_c1_covered_bodies_carry_exactly_the_reviewed_markers[end-to-end]`, `test_c2_every_step_is_forked_or_judged`, `test_c3_bundle_run_follows_the_bundle_page_and_a_dev_deploy`, `test_w10_covered_families_walk_every_step_to_done[end-to-end]` | b260c64…-p4-llm-steps.md: 24 steps to Done, 0 tool errors / 0 empty prompts (totals). Also 7e4144d…-workshop-level-reland.md L3: 24/24, 74 calls, 0 errors | 1001, 1002, 1003, 1033 (1033 not walked live) | no-fork: project_setup, prd_generation, bronze_table_metadata, iterate_enhance, use_case_selection |
| accelerator | accelerators | `test_c1_…[accelerator]`, `test_c2_genie_get_step_resolves_the_fork`, `test_w10_…[accelerator]` | b260c64…-p4-llm-steps.md: 17 steps to Done, 0 tool errors / 0 empty prompts (totals). 0b07fc0…-p4-covered-families.md L3: 18 steps, 59 calls, 0 app errors | 1002, 1003, 1033 (1033 not walked live) | no-fork: project_setup, prd_generation, bronze_table_metadata, iterate_enhance, use_case_selection |
| genie-accelerator | genie-accelerator (reference) | test_genie_family_genie.py: `test_g1_every_step_is_forked_or_judged`, `test_g2_genie_get_step_resolves_the_fork`, `test_g3_fork_bodies_carry_exactly_the_reviewed_markers`, `test_g5_execution_classes_stay_as_shipped`, `test_g6_v2_equals_v1_after_reversing_substitutions`, `test_g7_held_v2_ids_stay_free`, `test_s3_served_version`; `test_w4_genie_accelerator_names_are_byte_identical` | 89ee6f0…-cleanup-140-profile.md L2: 31/31 to Done, 99 calls, 0 unexpected tool errors (3 expected refusals), 0 empty prompts, workspace_cleanup from 1033 | 1002, 1017, 1018–1022, 1024–1027, 1030–1032, 1033 | ui-driven: ontology_pages, ontology_routing (UI_DRIVEN_STEP, SPA gate write). hybrid: semlayer_measures, ontology_domain (test_genie_family_genie.py:405). held: gagent_describe (1023), gaccel_dashboard (1028), gaccel_activation (1029) stay on v1 934/940/941 (D-61). no-fork: project_setup, prd_generation, iterate_enhance |
| data-engineering-accelerator | accelerators | `test_c1_…[data-engineering-accelerator]`, `test_w10_…[data-engineering-accelerator]` | b260c64…-p4-llm-steps.md: 11 steps to Done, 0 tool errors / 0 empty prompts (totals). 7e4144d…-workshop-level-reland.md L2c: 11/11, 35 calls, 0 errors, 0 empty | 1002, 1033 (1033 not walked live) | no-fork: project_setup, prd_generation, bronze_table_metadata, iterate_enhance, use_case_selection. Parked then fixed: workshop-level-too-narrow (D-50) → #122 (D-55) |
| skills-accelerator | skills | test_skills_family_genie.py: `test_s1_skills_bodies_carry_no_local_ide_markers`, `test_s2_genie_get_step_resolves_the_fork`, `test_s3_no_bare_relative_skill_paths`, `test_s5_certify_tables_deploys_from_the_bundle_page_before_any_run`; `test_w11_skills_accelerator_walks_every_step_to_done` | b260c64…-p4-llm-steps.md: 9 steps to Done with the use-case lock, 0 tool errors / 0 empty prompts (totals). ac40295…-p4-skills-accelerator.md L2: 9/9, 0 tool errors | 1002, 1004, 1005, 1006, 1033 (1033 not walked live) | no-fork: project_setup, iterate_enhance, skill_define_strategy (131) and skill_create_skillmd (132), the LLM default rows (D-62). Open: skills-track-silent-fallback |
| agents-accelerator | agents | test_agents_family_genie.py: `test_a1_agents_bodies_carry_exactly_the_reviewed_markers`, `test_a2_every_step_is_forked_judged_or_pending`, `test_a9_1009_provisions_only_the_literal_prefixed_statements`, `test_a10_run_ddl_fails_closed_like_the_f0_skill`, `test_b5_human_review_stops_for_the_sme_before_sync_and_signoff`; `test_w12_agents_accelerator_walks_every_step_to_done` | b260c64…-p4-llm-steps.md: 29 steps to Done, 0 tool errors / 0 empty prompts (totals). a7e1699…-p4-agents-a-1009.md L2: 29/29, 88 calls, 0 tool errors, 0 empty prompts | 1001, 1002, 1007–1016, 1033 (1033 not walked live) | no-fork: project_setup, prd_generation, iterate_enhance. Open: agents-213-execution-label (mlflow_human_review_and_signoff label class, D-52b). `PENDING_RULE10 = {}` (test_agents_family_genie.py:105) |
| reverse-lakehouse | lakehouse | `test_l1_…[reverse-lakehouse]`, `test_w9_…[reverse-lakehouse]` | b260c64…-p4-llm-steps.md: 11 steps to Done, 0 tool errors / 0 empty prompts (totals). 9710bbd…-p4-lakehouse-family.md L5: start and first step only | 1002, 1033 (1033 not walked live) | no-fork: project_setup, prd_generation, bronze_table_metadata, iterate_enhance, use_case_selection |
| reverse-lakehouse-di | lakehouse | `test_l1_…[reverse-lakehouse-di]`, `test_l3_mcp_outline_contains_optimize_genie[reverse-lakehouse-di]`, `test_w9_…[reverse-lakehouse-di]` | b260c64…-p4-llm-steps.md: 17 steps to Done, 0 tool errors / 0 empty prompts (totals). 9710bbd…-p4-lakehouse-family.md L5: start and first step only | 1002, 1003, 1033 (1033 not walked live) | no-fork: project_setup, prd_generation, bronze_table_metadata, iterate_enhance, use_case_selection |
| reverse-lakebase | reverse-lakebase | `test_c1_…[reverse-lakebase]`, `test_c4_app_deploy_forks_name_the_sdk_snapshot_call`, `test_w10_…[reverse-lakebase]` | b260c64…-p4-llm-steps.md: 18 steps to Done, 0 tool errors / 0 empty prompts (totals). 0b07fc0…-p4-covered-families.md L3: start and first step only | 1002, 1003, 1033 (1033 not walked live) | no-fork: project_setup, prd_generation, bronze_table_metadata, iterate_enhance, use_case_selection |
| reverse-app | reverse-app | `test_c1_…[reverse-app]`, `test_c4_app_deploy_forks_name_the_sdk_snapshot_call`, `test_w10_…[reverse-app]` | b260c64…-p4-llm-steps.md: 23 steps to Done, 0 tool errors / 0 empty prompts (totals). 0b07fc0…-p4-covered-families.md L2: 24 steps, 77 calls, 0 app errors | 1002, 1003, 1033 (1033 not walked live) | no-fork: project_setup, prd_generation, bronze_table_metadata, iterate_enhance, use_case_selection |

Notes on the table:
- **Step counts:** these are the b260c64 S0 per-track counts. They sum to 235, the "235 walked steps" in that probe.
- **Errors per track:** the b260c64 probe reports tool errors and empty prompts as totals over all 14 tracks, not per track.
- **Probe timing:** b260c64 is before #125 and #126. On tracks other than genie-accelerator and app-only, fork 1033 has tests (`test_every_track_serves_1033`) but was not walked live.

## 4. Genie gate (Phase 4 measured)

Commands:

```
git show e579ca2:db/lakebase/dml_seed/02_seed_section_input_prompts.sql > FORGE/work/p4-exit-gate-e579ca2.sql
python3 FORGE/tools/genie_gate_diff.py --base-ref origin/feature/genie-code-mcp-integration \
  --base-seed FORGE/work/p4-exit-gate-e579ca2.sql \
  --head-seed <worktree>/db/lakebase/dml_seed/02_seed_section_input_prompts.sql \
  --work FORGE/work/p4-exit-gate-genie
```

The template ref is TPL origin/feature/genie-code-mcp-integration at edb07a9. Output, verbatim (exit code 0):

```
base origin/feature/genie-code-mcp-integration · head origin/feature/genie-code-mcp-integration · fork findings 80 -> 80
genie gate diff: PASS (no new findings)
```

- **Audit-key deltas:** none. The tool prints an `[audit] <area::class>: <base> -> <head>` line only for a key that grew (genie_gate_diff.py:101), and it printed none. It also printed no `fixed:` lines.
- **Current fork-findings count:** 80.

The exit code is reported here but does not gate this PR. Phase 4 deliberately changed the seed.

## 5. Not proven, parked, held

Decisions:
- **D-61** (decision-log.md, entry "D-61 (2026-10-07, genie-forks-bare-paths PR #125 f2a2a53)")
  - Three v2 rows are held: 1023 gagent_describe, 1028 gaccel_dashboard and 1029 gaccel_activation.
  - Why: the TPL audit scans the raw seed, where v1 and v2 coexist, so the superseded v1 version is counted too. A v2 row that repeats a counted v1 line therefore reads as growth (apps_lakebase::APP_DEPLOY 1664→1665, INSESSION_CREATE 125→126).
  - They stay on v1 934/940/941. 89ee6f0…-cleanup-140-profile.md L2 confirms "the 3 held v1 rows" are still byte-identical.
  - Unblocking needs a human-owned gate change (Q1).
- **D-62** (FORGE/state/lead/decisions.md:78; b260c64…-p4-llm-steps.md)
  - iterate_enhance, skill_define_strategy and skill_create_skillmd go over the 90 s budget. iterate_enhance generations run 107.7–133.6 s and then truncate.
  - The "within budget" half is parked (Q2).

FORGE/state/lead/queue.md rows not done. These are rows whose scope column starts with P4, or whose source or notes tie them to a Phase 4 task. The list was computed from queue.md, including the rows packed onto one physical line with `\n` separators. Status is quoted as recorded:

| Row (queue.md line) | Scope | Status as recorded | Reason / note as recorded |
|---|---|---|---|
| start-track-usecase-resolved-null (:35) | P4 | verified-harmless (#108: StartTrackResult has no use_case_resolved field; only SetParametersResult) | probe 7329736: use_case_resolved null on 3/3 starts |
| app-family-fork-nits (:39) | P4 | partly planned: comment renumbering in p4-lakehouse-family S1b; nits 1-2 (fork 1001 BODY edits) **HELD** | an existing-row edit never reaches a live install (D-37 additive); the notes on genie-forks-bare-paths (:71) record that the v2 mechanism now unblocks it |
| tpl-audit-bare-sh (:39, first row) | P4 (strengthens every P4.3 fork's gate) | todo | superseded by the :50 row, which records "DONE: merged 775bebc" (TPL #18) |
| fresh-install-crash-skips-03 (:40) | P4 | todo | #112 note: a crash during the 01/02 bulk seed makes the retry skip 03; low priority |
| seed-958-help-wording (:41) | P4 | todo | row 958 how_to_apply / expected_output still say "Genie Code journey" / "Genie space"; the live row is a human follow-up |
| p4-lakehouse-family (:49) | P4.3 | status column opens "impl: hold LIFTED …" | the same cell records "done (merge 9710bbd, deploy 01f1c210…, live PASS 6/6)" |
| tpl-audit-bare-sh (:50) | P4 (gate tooling) | the status column holds "template #18 head 1d6ee10…" (columns shifted) | notes: "DONE: merged 775bebc (2026-10-07)" |
| tpl-gate-preexisting-overages (:51) | P4 (gate tooling) | todo: investigate first (real Genie Code issues, or a stale lock?) | at TPL a26c6d0 genie_gate.py exceeds its lock: apps_lakebase::GENIE_RESOURCE 8→14, data_product_accelerator::BARE_ARTIFACT_PATH 8→10, skills::APP_DEPLOY 108→114, skills::INSESSION_CREATE 14→17 |
| p4-covered-families (:53) | P4.3 | status column opens "planning: critic r1 BLOCK …" | the same cell records "merged 0b07fc0, deployed 01f1c218…" |
| workshop-level-too-narrow (:54) | P4 | PARKED (D-50) | superseded by workshop-level-reland (D-55), which is DONE (:57, merge 7e4144d) |
| skills-track-silent-fallback (:59) | P4 (P4.1 track-scoped walk correctness) | todo: investigate first | without the build_skill lock, skills-accelerator silently runs as end-to-end |
| agents-213-execution-label (:66) | P4.3 | todo (after p4-agents-b) | D-52b: 213 says labelling is a human step, but the manifest serves mlflow_human_review_and_signoff as agent-doable; needs a charter exception |
| cleanup-140-profile (:72) | P4.3 | status column opens "planning: D-58 …; impl: … implementer dispatched" | merged in git as #126 (89ee6f0); live PASS 5/5 (89ee6f0…-cleanup-140-profile.md) |
| p4-llm-steps (:73) | P4.4 | PARTLY DONE / PARKED (D-62) | → HUMAN: budget vs max_tokens/output size vs async vs accept template |
| p4-exit-gate (:75) | P4.6 | todo | this report |
| x3-fence-nits (:30) | B | todo | notes include the #111 review (8272438) U8b test gap |
| release-preflight-untracked (:37) | INCIDENT | todo | untracked test_errors.py reached 3 Phase 4 code deploys (658cbe3, 22a0402, 6230f58) |
| mcp-honours-step-enabled (:38) | B | todo | from critic-p4-lakehouse-family r1: step_enabled=FALSE hides a step in the SPA only |
| outline-locked-but-served (:39) | B | todo | probe p4-app-family phase 1 (22a0402): semlayer_locate is 'locked' in the outline but served |
| docs-workshop-level-width (:58) | C (docs) | folded into workshop-level-reland (R2) | reviewer #118: README.md:115 and mcp-workshop-data-model.md:48 still say VARCHAR(20) |
| tpl-rule9-wording (:60) | C (docs, with the TPL RC) | todo | D-44: the RULE_9 row orders the CLI first, while the forks make the SDK SNAPSHOT canonical |
| agents-b-pin-nits (:65) | C (test + seed wording) | todo (after p4-agents-b; can fold into the next seed-02 PR) | reviewer #120: `_GATE` misses the either-or form; fork 1014's step number |

What only the human Genie Code smoke can prove:
- **Real execution in a Genie Code client.** Every probe above reads served text through MCP. None ran a served instruction, for example `runDatabricksCli`, `executeCode`, a bundle deploy, the 1009 DDL or the 1033 deletes. The cleanup probe never sent `confirm cleanup` (89ee6f0…-cleanup-140-profile.md, header).
- **Steps completed headlessly.** The harness walks complete steps without running them. For example, b260c64 replays the ontology UI gates through `/api/session/update-metadata`. 7c014d7…-p4-agents-b.md states that its walk "does not show that SME labelling ran".
- **The SPA panel in a real Genie Code session.** It was checked in headless Chrome only (b260c64…-p4-spa-any-track.md L1).

## 6. Open questions for the HUMAN

This report takes none of these decisions.

- **Q1 (D-61): change the genie gate?**
  - The gate counts superseded seed versions, so the three v2 rows 1023/1028/1029 cannot ship unchanged.
  - Options:
    - (a) count only the highest active version per (section_tag, coding_assistant) in the raw-seed scan, or skip the raw .sql where section files exist. After that, the 3 rows ship unchanged.
    - (b) keep the gate as is. The 3 tags stay on v1 934/940/941 and keep their bare paths.
  - FORGE/tools is outside the lead's write scope, and genie_gate_diff.py has no waiver.
- **Q2 (D-62): how to handle the step-prompt budget.**
  - Evidence (b260c64…-p4-llm-steps.md):
    - prd_generation generates within the 90 s budget: 13/13, median 29.75 s.
    - iterate_enhance falls back to the template on 14/14 tracks. skill_define_strategy and skill_create_skillmd also fall back.
    - 15 of the 16 abandoned generations then truncate, so raising the budget alone would not help.
  - Options:
    - (a) a larger max_tokens, or a smaller output contract, for rows 14/131/132
    - (b) async or deferred generation
    - (c) accept the template fallback (current; fails open, never empty)
    - (d) raise `STEP_PROMPT_BUDGET_S` (mcp_server.py:798)
- **Q3: cost.** Not measured. `omnigent usage` returned 403 Forbidden for the whole run (FORGE/state/lead/status.md:268). The human directive of 2026-10-04 stopped cost tracking until it blocks the run (FORGE/state/lead/decisions.md:21). No cost figure exists for Phase 4.
