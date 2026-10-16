# cleanup-140-profile: genie-code fork 1033 for workspace_cleanup, participant-scoped, confirm-before-delete (D-58)

repo=app · base origin/feature/genie-code-mcp-integration after genie-forks-bare-paths merges (seed-02 serialization; ids 1018-1032 are taken by it) · plan path in PR: docs/superpowers/plans/2026-10-07-cleanup-140-profile.md
Trunk files touched: db/lakebase/dml_seed/02_seed_section_input_prompts.sql (one additive row). No src/, manifest or generate_manifest.

## Evidence (lead, read-only @7e4144d)
- workspace_cleanup is on every track's outline (shared step) and served from default 140 for genie-code (D-39 no-fork; #121 STOP hit: `--profile {databricks_cli_profile}`).
- Default 140: step 0a sets a CLI profile (`export DATABRICKS_CONFIG_PROFILE={databricks_cli_profile}`, `databricks current-user me --profile …`, a `~/.databrickscfg` lookup); discovery pipes `databricks api get … | python3 -c "…"`; jobs/pipelines/Genie spaces are matched by workshop KEYWORDS (`Loyalty Rewards`, `Bronze`, `Silver`, `Gold`, `Metric Views`, `TVF`, `Genie`, `Dashboard Deployment`; a python keyword list incl. 'genie', 'dashboard', 'dlt', 'merge', 'setup'); deletes: `databricks jobs delete`, `pipelines delete`, dashboards via trash, `api delete /api/2.0/genie/spaces/<id>`, `serving-endpoints delete`, and `DROP SCHEMA IF EXISTS $CATALOG.$SCHEMA CASCADE` through the SQL Statements API, schemas read from databricks.yml.
- Genie Code: runDatabricksCli is pre-authenticated, has no local profile file and no shell pipes (field guide); executeCode has a pre-authenticated WorkspaceClient `w`.

## Changes
S1 Seed 02: one genie-code row 1033 ← 140 (workspace_cleanup), version 1, is_active, placed right after 140, in the runbook shape of 1001/1010 (resolve_root → `<ARTIFACT_ROOT>`; `<STATE_FILE>` per the vibecoding-state rule; readSkillFile by full path; no @-mentions; no --profile; no bare paths). Same learning intent, gate and deliverable (a cleanup summary table) as 140. Mechanics + scope:
  1. Identity: `w.current_user.me()` in executeCode (no profile step at all).
  2. Discovery (read-only, executeCode): list jobs, pipelines, Lakeview dashboards, Genie spaces, serving endpoints, apps, and the UC schemas named in the participant's databricks.yml (read from `<ARTIFACT_ROOT>`), and classify each as MINE only if its name carries the participant prefix (`{db_schema}`, `{user_schema_prefix}`, or the APP_NAME / AGENT_APP_NAME from `<STATE_FILE>`) AND, where the object exposes a creator/owner, that equals the current user. A keyword-only match is listed as "not mine: skipped", never deleted.
  3. STOP: print the full table (type, name, id, why it is MINE) and ask the operator to reply exactly `confirm cleanup`; do nothing destructive before that reply. If nothing is MINE, report and exit the gate.
  4. Delete (only after the confirm), children before parents as in 140, each existence-checked, skip on not-found, via the SDK in executeCode (or runDatabricksCli with no pipes); schemas only those from databricks.yml that are MINE, `DROP SCHEMA IF EXISTS … CASCADE` through w.statement_execution with terminal polling (fail closed on FAILED/CANCELED/CLOSED, as in the merged F0 run_ddl).
  5. Report: deleted / skipped (not mine / not found) / errors; record the gate in `<STATE_FILE>`.
  Nothing outside the workshop scope is ever deleted; the fork can only narrow 140's selection.
S2 Tests (tests/workshop/test_app_family_genie.py or a new test_cleanup_genie.py, whichever already lists workspace_cleanup's NO_FORK): move workspace_cleanup from NO_FORK to FORK_ID 1033 in EVERY family test that lists it (all tracks share it); C1 1033 has 0 --profile, 0 `export DATABRICKS_CONFIG_PROFILE`, 0 `~/.databrickscfg`, 0 `| python3`; C2 the confirm STOP (`confirm cleanup`) appears before the first delete call in the body; C3 every delete in the body is preceded by the MINE filter (the prefix + creator rule is stated once and referenced); C4 no keyword-only selection rule survives as a delete criterion.
S3 test_seed_new_rows.py: only what 1 row forces (F02 +1, ledger + 1033, sequence 1033 → 1034).
S4 decision-log.md: append D-58 verbatim.

## STOP rules
- If any family test or the genie gate shows the fork must touch src/, the manifest or another row, stop and report.
- genie_gate_diff: no key growth. NOTE: DROP SCHEMA is not an INSESSION_CREATE trigger; if any other audit key grows (e.g. SHELL_DATABRICKS), remove the added text rather than rewording to hide it.

## Green gates
pytest tests/workshop tests/api ≥ floor; genie_gate_diff (TPL edb07a9 or later) exit 0, no key growth.

## Tampers (anchor `(1033, 'workspace_cleanup', 'genie-code',`; restore each)
X1 add `databricks current-user me --profile {databricks_cli_profile}` → C1 red.
X2 move the `confirm cleanup` STOP after the first delete → C2 red.
X3 replace the MINE rule's prefix condition with the keyword list → C3/C4 red.
X4 delete the 1033 INSERT → the family tests red (workspace_cleanup served from 140 with --profile).
X5 add `databricks api get /api/2.0/genie/spaces | python3 -c "…"` → C1 red.

## Release
reseed=yes (1 inserted / 0 warnings, sequence 1033 → 1034).

## Live checks
L0 = the latest walks of genie-accelerator (#121 L2) and one app-family track (served workspace_cleanup sha from 140).
L1 tables log lines; ro DB 1033 present, genie-code v1 active.
L2 a genie-code walk to Done on genie-accelerator and on app-only: workspace_cleanup served from 1033 (sha ≠ L0), 0 --profile / export / pipes, the confirm STOP present before any delete; the prober does NOT execute any cleanup (read the served text only); every other non-LLM step = L0.
L3 outline-list hash MCP == /api == L0.
L4 7 tools, /health 200, clean log.

## Reverse
Delete row 1033 (default 140 serves again) and restore NO_FORK.

## Amendment r1 (PR #126 review round 1)
- F1 (blocking) The Lakebase UC catalog path is a strict subset of 140's single target. A catalog row is a candidate only if (a) its name contains `lakebase`, case-insensitive (140's Step 0d discriminator), AND (b) it is not the bundle's `variables.catalog.default`, its `variables.source_catalog.default`, or `{lakehouse_default_catalog}`, AND (c) it passes the MINE rule. A catalog that fails (a) or (b) is listed as `not mine: skipped (not the Lakebase catalog)`. The rule is stated once (`is_my_lakebase_catalog` + **The catalog rule**), next to the MINE rule and before the STOP. No other catalog is ever dropped; the lakehouse catalog only has the bundle's own schemas dropped inside it.
- F2 `run_sql` raises unless the terminal state is SUCCEEDED (`if resp.status.state != StatementState.SUCCEEDED:  # FAILED / CANCELED / CLOSED`), like the merged F0 run_ddl; pinned by C6.
- F3 test_cleanup_genie.py's DELETE_CALL also matches `w.api_client.do("DELETE", …)`, so C2/C3 treat the Lakebase project delete as a delete.
- C5 every DROP CATALOG is the single `mine["Lakebase UC catalog"]` line, gated by the catalog rule (contains `lakebase`; excludes catalog.default / source_catalog.default), and the rule appears before the STOP.
- Tampers: X6 remove the `lakebase` name condition → C5 red; X7 remove the lakehouse-catalog exclusion → C5 red; X8 raise only on FAILED → C6 red; X9 move the Lakebase project `w.api_client.do("DELETE", …)` line before the `confirm cleanup` STOP → C2 red.
