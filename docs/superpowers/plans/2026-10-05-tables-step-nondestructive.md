# tables-step-nondestructive (app) — plan (INCIDENT FIX, human-authorized)

Repo: app. Base: origin/feature/genie-code-mcp-integration @ 7c76a62 (#108 merged).
Plan file in PR: docs/superpowers/plans/2026-10-05-tables-step-nondestructive.md
Scope: incident fix. Lane: L (scripts/deploy.sh, scripts/setup-lakebase.sh + a new test + docs; neither script is a trunk file). Reseed: NO (this PR must ship code-only; nobody runs the tables step until it's merged).

## Why (evidence)
- scripts/deploy.sh:1221 @7c76a62 runs `./scripts/setup-lakebase.sh --recreate --yes` unconditionally on the `--tables-only` / tables path, then prints "Lakebase tables created and seeded". `--recreate` → ACTION="recreate" (setup-lakebase.sh:90-92) → `Dropping existing tables...` (:582-627). The forge release runbook's reseed=yes uses this path, so it wiped the live schema twice (state/release/e775185-tables.log, 7c76a62-tables.log).
- setup-lakebase.sh's DEFAULT action is "create" (:84; :629-700): `CREATE SCHEMA IF NOT EXISTS`, DDL that is IF NOT EXISTS, seed INSERTs with ON CONFLICT DO NOTHING (:650, :692), duplicate-key / already-exists errors ignored (:446-447), sequences reset after seeding (:675). This is the additive mode D-14 assumed.
- setup-lakebase.sh:184 sets `ACTION="recreate"  # Continue with table recreation` on another path (read the context: likely --full-setup). That's a second destructive default to neutralize.

## Lead-verified facts @7c76a62 (critic round 1 failed on a guard; these replace its open questions)
- Destructive SQL inside the DDL/DML files: the ONLY statement-level hit is db/lakebase/ddl/07_add_coding_assistant_column.sql:31 `DROP CONSTRAINT IF EXISTS chk_coding_assistant;`, which is immediately re-added (schema-only, idempotent, no data loss). Every other DROP/DELETE/TRUNCATE match is prompt TEXT inside seed strings. So the additive runner loses no data.
- setup-lakebase.sh:170-185 is the `--full-setup` branch: status check, then `ACTION="recreate"  # Continue with table recreation` (:184). Every --full-setup silently drops tables.
- deploy.sh: the ONLY setup-lakebase.sh call passing --recreate/--drop is :1221. Critic r2 confirmed: deploy.sh parses args at :100-170 and makes its first network call at :468; setup-lakebase.sh parses at :85-135 and makes its first network call at :483. Place both refusal checks right after argument parsing.
- Scope correction: `--recreate` drops ONLY usecase_descriptions and section_input_prompts (setup-lakebase.sh:582-590); the user tables are untouched; 03_seed_workshop_parameters.sql DELETEs + re-inserts its 34 keys whenever the bulk seed runs. Other callers: scripts/vibe2value.py:1177 runs `setup-lakebase.sh --drop` in its explicit teardown/destroy flow (skipped with --keep-data); lakebase_manager.py:872/:900 are doc strings.
- create-mode with existing data (:665-707): when usecase/section_prompts/visibility tables already have rows, the bulk DML seed does NOT run; only POST_SEED_MIGRATIONS 08/09 run (ON CONFLICT DO NOTHING; updated_by='seed' guards, so admin edits are never clobbered). The sequence reset (:675-684) runs only after a bulk seed and sets MAX+1, never below the current max. CONSEQUENCE (out of scope here, queued): new seed rows (e.g. new genie-code fork rows with new PKs) do NOT reach an existing install via create mode; D-14's "reseed applies new rows" assumption is also false for this mode.

## Decision D-35
Rule (2)/(3): the tables step must be ADDITIVE by default; destructive recreate only on explicit, double opt-in. (a) deploy.sh's tables step calls `./scripts/setup-lakebase.sh --yes` (default ACTION=create), and its success message says "applied additively (create-if-not-exists + ON CONFLICT DO NOTHING seed)". (b) A destructive recreate is reachable only via an explicit new deploy.sh flag `--tables-recreate` AND the env `VIBE_CONFIRM_DESTRUCTIVE_RESEED=<schema name>` matching the target schema; otherwise deploy.sh exits non-zero BEFORE connecting, with a message naming the data loss. (c) setup-lakebase.sh:184 (--full-setup) sets ACTION="create" instead of "recreate", unless `--recreate` was ALSO passed explicitly (in which case (d)'s confirmation applies). (d) setup-lakebase.sh --recreate and --drop themselves remain (operators use them deliberately), but each requires `--yes` AND the same `VIBE_CONFIRM_DESTRUCTIVE_RESEED=<schema>` env; otherwise they refuse with a clear message. Reversal (documentation only, NOT an instruction, NOT recommended): `git revert` of this PR's commit would bring back the pre-fix behavior, which is the incident itself. If any part must be undone, prefer relaxing only the confirmation message wording, never restoring an unconditional --recreate. The implementer must NOT implement any reversal.

## Changes
1. scripts/deploy.sh: the tables path per D-35 (a)(b). Document `--tables-recreate` in the script's usage header. No other behavior change (the code path, flags and bundle deploy are untouched).
2. scripts/setup-lakebase.sh: D-35 (c)(d). The default "create" path is unchanged.
2b. scripts/vibe2value.py:1177 (the teardown flow is an explicit destroy, so it opts in): add `drop_env["VIBE_CONFIRM_DESTRUCTIVE_RESEED"] = <the target schema name the flow uses>` before the `--drop` call; if the schema name isn't available there, read how setup-lakebase.sh resolves it and pass the same value; state it in the PR. Behavior is otherwise unchanged (it already skips with --keep-data).
3. NEW tests/workshop/test_tables_step_nondestructive.py (static + subprocess, offline):
   - S1 static: deploy.sh's tables path invokes setup-lakebase.sh WITHOUT `--recreate`/`--drop`, except inside the guarded `--tables-recreate` branch (parse the script text; assert that the only `--recreate` occurrence sits under the guard).
   - S2 subprocess: run `bash scripts/setup-lakebase.sh --recreate --yes` with `VIBE_CONFIRM_DESTRUCTIVE_RESEED` unset and no Databricks credentials (DATABRICKS_CONFIG_FILE=/dev/null, PATH without databricks if needed). It must exit non-zero with the refusal message BEFORE any connection attempt (assert the message, and that no "Connected" / "Dropping" text appears). Same for `--drop`, and for a mismatched schema value.
   - S3 subprocess: `bash scripts/deploy.sh --tables-only --tables-recreate ...` without the confirm env refuses before any network call (if deploy.sh needs args/profile to reach the check, place the check FIRST in argument handling so the test needs no workspace).
   - S4: the default create path's SQL behavior is unchanged: assert the script text still contains the ON CONFLICT DO NOTHING / IF NOT EXISTS create path (a regression pin).
   - S5: `--full-setup` resolves to ACTION=create (static, or run the arg parser in a dry mode if one exists); `--full-setup --recreate` without the confirm env refuses.
   - S6: vibe2value.py's teardown sets VIBE_CONFIRM_DESTRUCTIVE_RESEED before calling --drop (static AST/text check).
4. docs/superpowers/decision-log.md: append D-35. Add a short "Reseed safety" note to the deploy section of README.md ONLY if a deploy/reseed section exists there; otherwise skip it.

## Fence
scripts/deploy.sh · scripts/setup-lakebase.sh · scripts/vibe2value.py (the one opt-in line) · tests/workshop/test_tables_step_nondestructive.py (new) · docs/superpowers/plans/2026-10-05-tables-step-nondestructive.md (new) · docs/superpowers/decision-log.md · README.md (only as stated). Nothing else.

## Acceptance
- S1–S4 green; the backend suite ≥ 861 + new, 0 failed (floor 861 at 7c76a62).
- No test or check connects to a workspace or a database.
- Released CODE-ONLY (reseed=no). The release runbook's reseed path becomes additive once this merges.

## Green gates
cd <worktree> && DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= $APP/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q → ≥ 861 + new, 0 failed.

## Live checks
None that touch the database. After the merge: (L1) deployed source unchanged for src/ (these are scripts); (L2) 7 tools; app healthy. The first real additive reseed happens only under the recovery plan, with the lead's explicit go.

## Decision text (append to decision-log.md)
D-35 (2026-10-05) · INCIDENT FIX: the deploy tables step ran `setup-lakebase.sh --recreate --yes` (deploy.sh:1221), which drops usecase_descriptions + section_input_prompts and re-runs all seeds (03_seed_workshop_parameters DELETE+INSERT), resetting 3 live config tables twice · Rule (2)/(3): the tables step is additive by default (setup-lakebase.sh default create mode: IF NOT EXISTS + ON CONFLICT DO NOTHING, no bulk seed on populated tables); a destructive recreate/drop requires an explicit flag AND VIBE_CONFIRM_DESTRUCTIVE_RESEED=<schema> · Reversal (not recommended): git revert of the PR, which reintroduces the incident.
