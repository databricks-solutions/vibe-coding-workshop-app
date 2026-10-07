# p4-lakehouse-family: lakehouse, reverse-lakehouse, lakehouse-di, reverse-lakehouse-di walkable in Genie Code (P4.3, family 2) — D-41 — ROUND 2 (critic r1 BLOCK folded in)

Base: origin/feature/genie-code-mcp-integration @ 6230f58c10d314469febb1c672c6c83ea646aa9a (#114 merged: forks 1001/1002 live).
PR plan path: docs/superpowers/plans/2026-10-06-p4-lakehouse-family.md

## Evidence (lead read-only @6230f58; state/lead/tracks.md lakehouse family; critic r1)
Steps per track (manifest): lakehouse = reverse-lakehouse = project_setup, prd_generation, bronze_table_metadata, bronze_layer_creation (fork 901), silver_layer_sdp (902), gold_layer_design (903), gold_layer_pipeline (904), deploy_lakehouse_assets (905), iterate_enhance, redeploy_test (fork 1002), workspace_cleanup. lakehouse-di / reverse-lakehouse-di add usecase_plan (906), aibi_dashboard (907), genie_space (908; RULE_8 tiers), deploy_di_assets (909), optimize_genie, agent_framework (910); the -di tracks order genie_space and aibi_dashboard differently.
Critic r1: forks 901-910 are CLEAN (no npm/npx/localhost/auth login/.sh invocation; their only `@` text is the literal rule "do NOT use `@`-mentions", which the #114 regex `@[\w.-]+(?:/[\w.-]+)*\.md\b` (test_app_family_genie_forks.py:130) does not match).
Judged per unforked step:
- bronze_table_metadata (default 5, ~:1656): already client-aware (<ARTIFACT_ROOT> via vibecoding-state.resolve_root ~:1726, SQL through the Databricks CLI; no markers; its `/Users/` hits are workspace paths) -> no fork (TPL decision 5, start narrow).
- optimize_genie (default 118, ~:9230; step_enabled = FALSE). CORRECTED (critic r1, Rule 1 shipped code decides): step_enabled hides a step only in the SPA (routes.py get_disabled_step_tags :3535/:3555). The MCP outline comes from engine.outline() -> MANIFEST.outline_order() (engine.py ~:121; mcp_server.py ~:1322, ~:2348), which ignores step_enabled. So optimize_genie IS in the MCP outline for lakehouse-di / reverse-lakehouse-di (and end-to-end), and Genie Code is served the default body with `@data_product_accelerator/.../05-genie-optimization-orchestrator/SKILL.md` @-mentions (~:9234; RULE_6). -> FORK IT (S1). Rule 3, most reversible: a seed-only additive row. The alternative, making MCP honour step_enabled, changes outline semantics and SPA/MCP parity on every track -> split out as its own queue task `mcp-honours-step-enabled` (investigate first: is the divergence intended?).
- redeploy_test: fork 1002 already serves every track (#114). workspace_cleanup, iterate_enhance: unforked per D-39.

## Changes
S1 (seed 02, TRUNK, charter exception requested): one new genie-code fork row, input_id 1003 optimize_genie (next free id; seed max 1002; live sequence 1003). Same rules as #114: only input_template / system_prompt / bypass_llm (true, as the default), version 1, is_active true; placed right after the default row (~:9230). The body is prescriptive Genie Code mechanics with the SAME learning intent, gate ("Genie quality targets passed", ~:9298) and per-user prefix tokens as the default (FORK_INTENT_PARITY). Model it on genie-accelerator's optimization fork 935 (gagent_optimize, ~:19041): fully qualified skill paths from skill_ref_root instead of @-mentions; runDatabricksCli without --profile; MLflow experiment under /Users/<email>/ stays (a workspace path); the .vibecoding-state.md ritual kept. step_enabled is NOT set on a fork (rule 4: shared fields come from the default), so the SPA still hides the step by default, unchanged.
  Reason: P4.3; served-body correctness for Genie Code. Reversal: remove the INSERT (the live row stays; deactivate via the admin UI).
S1b (seed 02 comment-only, from #114 review nit 3): the header example (~:97) and the commented SEED FORK EXAMPLES (~:17469, ~:17484) use input_id 1001/1002, now real forks -> renumber them to clearly-placeholder ids (e.g. 1999, 1998) so an uncommented copy can't collide. Comments only. NOT changing fork 1001's body (#114 nits 1-2): an edit to an existing seeded row never reaches an existing install (D-37 additive-only), so seed and live would drift. Those two nits stay queued for a versioned-row mechanism.
S2 tests (offline): a NEW file tests/workshop/test_lakehouse_family_genie.py that imports MARKERS and _hits (and any served-body helper) from tests/workshop/test_app_family_genie_forks.py and does NOT modify #114's APP_TRACKS parametrization (critic r1 (4)):
  - served-body marker lint for every MCP-outline step of the 4 tracks, for a genie-code session (assembler/_step_payload, as #114), with optimize_genie now served from 1003; no allowances expected (any allowance needs a written reason).
  - fork resolution: 901-910, 1002 and 1003 resolve to the fork for genie-code sessions; defaults for default sessions.
  - a pin that the MCP outline of lakehouse-di contains optimize_genie (documents the step_enabled divergence, so a later change to it is deliberate).
  - per-track walk start -> next -> get -> complete to Done for all 4 tracks (extend test_track_scoped_walk.py additively).
  - MCP outline == SPA outline (the /api/track/<t>/outline endpoint) for the 4 tracks (test_outline_parity.py; add only what's missing).
  - execution pin == "agent-doable" for every step of the 4 tracks (test_manifest_parity.py, additive).
S3 plan file: the per-tag judgment table (tag -> fork or none -> execution class -> RULE evidence).
S4 decision log: D-41 (fork optimize_genie as 1003 because MCP ignores step_enabled; bronze_table_metadata already client-aware; 901-910 clean; the MCP-vs-SPA step_enabled divergence split out).
Tampers: X1 delete the 1003 INSERT -> the lint red (an @-mention on optimize_genie) + fork resolution red; X2 inject `Run npm install` into the bronze_table_metadata default -> lint red; X3 add a `@data_product_accelerator/skills/x/SKILL.md` mention to the 1003 body -> lint red; X4 flip one lakehouse step's execution to ui-driven in manifest.json (tamper only) -> pin red; X5 add `Run npm install` to 1003 -> genie gate red.
Green gates: app suite (floor 968 at 6230f58); genie gate diff: python3 FORGE/tools/genie_gate_diff.py --base-ref origin/feature/genie-code-mcp-integration --base-seed <APP seed @6230f58> --head-seed <worktree seed> -> exit 0, no new findings, FORK_INTENT_PARITY covering 55 forks.
Fence: db/lakebase/dml_seed/02_seed_section_input_prompts.sql (TRUNK, exception requested), tests/workshop/ (the new file + additive extensions), the plan file, docs/superpowers/decision-log.md. Nothing else.

## Release
reseed=yes (1 new seed row), tables step in DEFAULT create mode: expected `section_input_prompts: 1 inserted / 0 warnings`, sequence raised 1003 -> 1004; usecase_descriptions 0/0.

## Live checks (prober; sessions via app endpoints only; Lakebase read-only; use case lock travel / ai_driven_booking as #114)
L0 pre-deploy baseline (before the release): lakehouse-di walk to Done recording every served prompt's sha + markers (optimize_genie served from the default, with @-mentions).
L1 tables-step log: 1 inserted / 0 warnings; sequence raised 1003 -> 1004.
L2 lakehouse fresh walk to Done: 0 app tool errors; every served body has 0 markers; 901/905 forks served.
L3 lakehouse-di walk to Done: optimize_genie served from 1003 (0 @-mentions; sha differs from L0); every other step's sha equals L0, except LLM-regenerated prd_generation.
L4 MCP outline == SPA outline (endpoint) for all 4 tracks, full JSON, 0 diffs.
L5 reverse-lakehouse + reverse-lakehouse-di: start + outline + the first served step.
L6 7 tools (via MCP tools/list on the deployed app); /health 200; clean log (iterate_enhance fallback lines expected; count them).

## S3 — per-tag judgment table

Execution class is read only for "ui-driven" (engine.py:285, mcp_server.py:1794); "agent-doable" is the shipped generator default, so no manifest change. Tracks: L = lakehouse, RL = reverse-lakehouse, D = lakehouse-di, RD = reverse-lakehouse-di.

| section_tag | tracks | genie-code fork | execution | RULE evidence |
|---|---|---|---|---|
| project_setup | L RL D RD | none | agent-doable | default is marker-clean in the served-body lint (0 hits); D-39 start narrow (TPL decision 5) |
| prd_generation | L RL D RD | none | agent-doable | default is LLM-generated, marker-clean; no deploy or local tooling (RULE_1/2 n/a) |
| bronze_table_metadata | L RL D RD | none | agent-doable | already client-aware: `<ARTIFACT_ROOT>` via vibecoding-state.resolve_root, SQL through the Databricks CLI (RULE_6, RULE_1); `/Users/` hits are workspace paths; TPL decision 5 |
| bronze_layer_creation | L RL D RD | 901 (existing) | agent-doable | fork clean; lakehouse-fork discipline (catalog no-create, source_linked_deployment false); RULE_10 |
| silver_layer_sdp | L RL D RD | 902 (existing) | agent-doable | fork clean; lakehouse-fork discipline (contract test, DESCRIBE TABLE inventory); RULE_3 |
| gold_layer_design | L RL D RD | 903 (existing) | agent-doable | fork clean; design-only, just-in-time workers (G1-G4); RULE_6 |
| gold_layer_pipeline | L RL D RD | 904 (existing) | agent-doable | fork clean; saveAsTable forbidden, validate_gold; RULE_3/RULE_10 |
| deploy_lakehouse_assets | L RL D RD | 905 (existing) | agent-doable | fork clean; deploy-fork discipline (bundle editor, escape-hatch STOP); RULE_1 |
| usecase_plan | D RD | 906 (existing) | agent-doable | fork clean; plan-only; RULE_6 |
| aibi_dashboard | D RD | 907 (existing) | agent-doable | fork clean; hybrid discipline (openAsset/readAssetById, extract-back); RULE_8 |
| genie_space | D RD | 908 (existing) | agent-doable | fork clean; hybrid discipline (serialized_space, no data-rooms PATCH); RULE_8 tiers |
| deploy_di_assets | D RD | 909 (existing) | agent-doable | fork clean; hybrid + deploy discipline; RULE_1/RULE_8 |
| optimize_genie | D RD | **1003 (this PR)** | agent-doable | default 118 @-mentions `05-genie-optimization-orchestrator/SKILL.md` (RULE_6) and MCP serves it despite step_enabled = FALSE (engine.outline ignores it; Rule 1); fork uses skill_ref_root paths + native benchmark tools (as 935), runDatabricksCli with no --profile, the state ritual; Rule 3 seed-only additive |
| agent_framework | D RD | 910 (existing) | agent-doable | fork clean; RULE_4 workspace compute |
| iterate_enhance | L RL D RD | none | agent-doable | marker-clean default; D-39 (not forked) |
| redeploy_test | L RL D RD | 1002 (existing, #114) | agent-doable | fork serves every track (D-39); RULE_1, no `.sh` |
| workspace_cleanup | L RL D RD | none | agent-doable | marker-clean default; D-39 (not forked) |

Implementation note: the default's skill `data_product_accelerator/skills/semantic-layer/05-genie-optimization-orchestrator` does not exist in the template (origin/feature/genie-code-mcp-integration or origin/main), so 1003 loads the skills that do exist (`skills/genie-code-environment`, `semantic-layer/03-genie-space-patterns`, `semantic-layer/04-genie-space-export-import-api`) plus the built-in `benchmark-failure-analysis` skill and the native benchmark tools, as fork 935 does. The default's dangling path is left for a separate task.
