# genie-forks-held-v2: ship the 3 D-61-held genie-accelerator v2 rows unchanged (D-70)

repo=app · base origin/feature/genie-code-mcp-integration (4d08ad9 or later) · plan path in PR: docs/superpowers/plans/2026-10-08-genie-forks-held-v2.md
Trunk file touched: db/lakebase/dml_seed/02_seed_section_input_prompts.sql (3 additive rows; charter exception: the seed is the only place a prompt row can live; reason D-70; reversal: delete the 3 rows). No src/, manifest, generate_manifest.

## Evidence (lead, read-only)
- D-61 held 1023 gagent_describe, 1028 gaccel_dashboard, 1029 gaccel_activation out of #125 only because the old genie_gate_diff scanned the raw seed where v1 and v2 coexist. Human ruling D-70: forge 15ec49d makes genie_gate_diff audit only the served rows (per (section_tag, coding_assistant), the newest active version, as routes.py resolves), printing the superseded input_ids it skips; verified on 75d9ade → f2a2a53 (FAIL → PASS; a real new deploy line in a v2 still FAILs).
- The 3 bodies exist in commit f2a2a53 (reachable in APP): seed :20731 (1023), :21528 (1028), :21576 (1029). #125 already shipped their 12 siblings with the same S1 transformation, G6/G7 and the `<STATE_FILE>` sentence.
- tests/workshop/test_genie_family_genie.py:103 HELD_V2_ID, :328 PENDING (D-61), :461 the reserved-ids test.

## Changes
S1 Seed 02: insert the 3 INSERT tuples for 1023, 1028, 1029 BYTE-EQUAL to f2a2a53's (verify: extract each tuple from `git show f2a2a53:<seed>` and from the head seed, diff = empty), each placed right after its v1 fork (934, 940, 941), version 2, is_active true. No other row changes. NEVER reword a body to pass the gate.
S2 tests/workshop/test_genie_family_genie.py: the 3 tags move from HELD_V2_ID to FORK_ID (v2 ids); PENDING becomes empty; the reserved-ids test (:461) is replaced by G6/G7 coverage of the 3 rows (they are now ordinary v2 rows); G3 then sees 0 bare docs/ and 0 bare state paths across all 15.
S3 test_seed_new_rows.py (and any count test): only what 3 rows force (F02 +3, ledger +1023/1028/1029; sequence stays 1034 because max input_id stays 1033).
S4 decision-log.md: append D-70, D-71, D-72, D-73, HALT #8 verbatim from FORGE/state/lead/decisions.md (only IDs absent from the APP log; D-64 rule).

## STOP rules
- genie_gate_diff (forge 15ec49d) must exit 0 with no audit key growth. Its fork-check line now reads 73 → 73-ish on both sides (superseded rows are not fork-checked); do not compare it with earlier 80 → 80 results. If any key grows, STOP and report the lines; do not reword.
- If a f2a2a53 tuple conflicts with anything merged since (unique index, a test), STOP and report.

## Green gates
pytest tests/workshop tests/api ≥ floor 1646 (expect small +/− from S2); genie_gate_diff (base = APP origin seed copy) exit 0, no key growth, and its printed superseded-id list includes 934, 940, 941.

## Tampers (anchor `(<id>, '<tag>', 'genie-code',`; restore each)
X1 in 1023, put back one bare `docs/` path → G3 red.
X2 in 1028, change one non-path word → G6 red.
X3 delete the 1029 INSERT → FORK_ID / G2 red.
X4 in 1023, delete the `<STATE_FILE>` definition sentence → G7 red.
X5 in 1028, add one `databricks apps deploy` line → genie_gate_diff FAIL (proves the served-rows gate still sees v2 content).

## Release
MERGE reseed=yes (expect `section_input_prompts: 3 inserted / 0 warnings`, `sequence kept at 1034 (max input_id 1033)`).

## Live checks
L1 tables log as above; ro DB: 1023/1028/1029 present, version 2, active; 934/940/941 unchanged and active; row count 167 → 170.
L2 genie-accelerator genie-code walk to Done: 0 unexpected errors, 0 empty; gagent_describe / gaccel_dashboard / gaccel_activation served from 1023/1028/1029 with 0 bare `docs/` and 0 bare `.vibecoding-state.md`, `<STATE_FILE>` defined once per prompt; every other non-LLM step byte-equal to the #125 probe (state/probes/687cd4d*-genie-forks-bare-paths.md).
L3 outline-list hash MCP == /api == the #125 baseline.
L4 7 tools, /health 200, clean log.

## Reverse
Delete rows 1023/1028/1029 (v1 serves again); restore HELD_V2_ID/PENDING.
