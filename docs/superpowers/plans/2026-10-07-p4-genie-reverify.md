# p4-genie-reverify: re-verify the genie-accelerator reference track for Genie Code (P4.3, reference) — D-53

repo=app · base origin/feature/genie-code-mcp-integration @7c014d7 · plan path in PR: docs/superpowers/plans/2026-10-07-p4-genie-reverify.md
Trunk files touched: db/lakebase/dml_seed/02_seed_section_input_prompts.sql (one additive row). No src/, no manifest, no generate_manifest.

## Evidence (lead, read-only @7c014d7)
- The manifest genie-accelerator outline has 31 steps. 26 are served from genie-code forks: 903 gold_layer_design, 904 gold_layer_pipeline, 905 deploy_lakehouse_assets, 932 semlayer_locate, 951 semlayer_profile, 952 semlayer_measures, 933 semlayer_metric_view, 953 semlayer_synonyms, 934 gagent_describe, 954 gagent_instructions, 955 gagent_verified, 956 gagent_benchmarks, 935 gagent_optimize, 940 gaccel_dashboard, 941 gaccel_activation, 924 activation_table_design, 925 activation_reverse_sync, 926 activation_app_design, 927 activation_build_wire, 928 activation_wire_lakebase, 957 activation_wire_genie, 929 activation_deploy_validate, 936 ontology_domain, 937 ontology_pages, 938 ontology_routing, 1002 redeploy_test. 4 are recorded no-forks (project_setup virtual; prd_generation LLM; iterate_enhance and workspace_cleanup per D-39). 1 is unforked: genie_silver_metadata, served from default 114.
- Execution classes (manifest): semlayer_measures and ontology_domain are hybrid; ontology_pages and ontology_routing are ui-driven; the rest are agent-doable. Unchanged here.
- Default 114 (seed, row anchor `(114, 'genie_silver_metadata',`) is already client-aware (the "Artifact root (client-aware)" block; resolve_root; `<ARTIFACT_ROOT>/data_product_accelerator/context/{use_case_file_prefix}_Metadata.csv`), but writes `docs/genie_plan.md` as a bare relative path 3 times. On Genie Code a bare path resolves against the page's cwd, not the project root.
- No family test covers genie-accelerator: tests/workshop/test_{app,lakehouse,covered,skills,agents}_family_genie.py cover the other tracks.
- Served 903 does not read genie_plan.md; only the unserved rows 115 genie_gold_design and 136 genie_silver_metadata_generate do. So nothing downstream breaks; this is the A3 bare-path rule.

## Changes
S1 Seed 02: one genie-code row 1017 ← 114 (genie_silver_metadata), version 1, is_active, in the existing fork INSERT shape, placed right after its default. A mechanics-only copy of 114: every bare `docs/genie_plan.md` becomes `<ARTIFACT_ROOT>/docs/genie_plan.md`. Every other byte of input_template / system_prompt / bypass_llm and the other columns stays equal to 114. Sequence 1017 → 1018.
S2 New tests/workshop/test_genie_family_genie.py, modelled on test_covered_families_genie.py:
  - G1 every genie-accelerator outline step is either in FORK_ID (the 26 tag→input_id pairs above plus genie_silver_metadata→1017, 27 in all) or in NO_FORK with a reason; the union equals the outline exactly.
  - G2 every step served genie-code for this track (assembler-backed, like the covered-families walk) comes from its FORK_ID row.
  - G3 marker lint over each fork body: @-mentions, --profile, npm, localhost, `.sh`, bare relative artifact paths. Each hit is either 0 or covered by an exact, reasoned cap (count + reason) in the style of #114/#116. Caps measured at this base are listed in the PR in a hit appendix (fork, marker, line text); a cap is allowed only for a NEVER / do-NOT prohibition, a description of server-side behaviour, or a path already prefixed with `<ARTIFACT_ROOT>`/`<APP_ROOT>`.
  - G4 1017 differs from 114 only in the `docs/genie_plan.md` → `<ARTIFACT_ROOT>/docs/genie_plan.md` replacement (pin: replacing it back makes 1017's input_template == 114's).
  - G5 the execution classes for the four hybrid/ui-driven steps above stay as shipped.
S3 Seed-count / ledger tests: only the changes forced by 1 row (test_seed_new_rows: F02 152→153, ledger + 1017, seq 1018). If other parity tests need a change, explain why in the PR body.
S4 docs/superpowers/decision-log.md: append D-53 verbatim from FORGE/state/lead/decisions.md.

## STOP rules
- If any marker hit in a served genie-accelerator fork is a real instruction (it tells the agent to run npm / localhost / a bare `./x.sh` / `--profile`, or to read via @-mention), do NOT cap it: report it with fork, line and text, and keep it out of the caps. The lead turns it into its own seed task. The test-only PR still ships, with that tag in a PENDING set with the reason.
- genie_gate_diff must show no audit key growth; 1017 should LOWER or keep BARE_ARTIFACT_PATH-type findings. If a key grows, remove the added text.

## Tampers (expected red, each restored with `git checkout -- <file>`)
Seed tampers edit db/lakebase/dml_seed/02_seed_section_input_prompts.sql inside the row whose first line starts `(1017, 'genie_silver_metadata', 'genie-code',`, located by grep on that anchor, never by line number. Tests: tests/workshop/test_genie_family_genie.py.
X1 in row 1017, replace the first `<ARTIFACT_ROOT>/docs/genie_plan.md` with `docs/genie_plan.md` → G3 (bare path) red.
X2 in row 1017, change one other word (e.g. `enriched` → `enrich`) → G4 red.
X3 in test_genie_family_genie.py, delete `genie_silver_metadata` from FORK_ID → G1 red.
X4 in the row whose first line starts `(905, 'deploy_lakehouse_assets', 'genie-code',`, add the line `npm install` → G3 red AND genie_gate_diff exits non-zero.
X5 in the row whose first line starts `(932, 'semlayer_locate', 'genie-code',`, add the line `Read @docs/genie_plan.md` → G3 (@-mention) red.
X6 in test_genie_family_genie.py, raise one cap by 1 → that cap's exact-count assertion red.

## Green gates
pytest tests/workshop tests/api (floor 1410); genie_gate_diff against base 7c014d7's seed (template ref 775bebc) exits 0 with no audit key growth.

## Release
reseed=yes (seed only; 1 inserted / 0 warnings, seq 1017 → 1018).

## Live checks
L0 pre-deploy baseline on 7c014d7: a genie-accelerator genie-code walk to Done; per-step served sha and strict marker counts; genie_silver_metadata from default 114 with 3 bare `docs/genie_plan.md`; outline-list hash at start / mid / Done.
L1 tables log `<merge7>-tables.log`: `section_input_prompts: 1 inserted / 0 warnings` and `section_input_prompts.input_id sequence raised 1017 -> 1018`. Read-only DB (transaction_read_only = on): `SELECT input_id, section_tag, version, is_active FROM <schema>.section_input_prompts WHERE input_id BETWEEN 1007 AND 1018 ORDER BY input_id` → 1007, 1008, 1010-1017, with 1017 genie_silver_metadata genie-code v1 active; 0 rows at 1009.
L2 a fresh genie-accelerator walk to Done: 0 tool errors, 0 empty prompts; genie_silver_metadata served from input_id 1017 (difflib vs the seed body) with 0 bare `docs/` paths; every other non-LLM step sha = L0.
L3 MCP outline == /api outline (outline-list hash) at start, mid and Done; = L0.
L4 7 tools; /health 200; clean log.
