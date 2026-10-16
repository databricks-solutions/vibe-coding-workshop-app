# ddl-user-trigger-prompt: additive DDL 17 adds section_input_prompts.user_trigger_prompt on upgrading installs (D-69)

repo=app · base origin/feature/genie-code-mcp-integration @1f797f9 · plan path in PR: docs/superpowers/plans/2026-10-08-ddl-user-trigger-prompt.md
Files (exactly): db/lakebase/ddl/17_add_user_trigger_prompt.sql (new), tests/workshop/test_user_trigger_prompt_ddl.py (new), docs/superpowers/decision-log.md (append D-68 and D-69 verbatim from FORGE/state/lead/decisions.md, ID match per D-64), db/lakebase/README.md (only the DDL file list, if it enumerates DDL files; add 17 in the same style), this plan. No src/, no other db/ file, no seed change, no scripts/ change; no trunk file.

## Evidence (lead, read-only)
- db/lakebase/ddl/02_section_input_prompts.sql:19 has `user_trigger_prompt TEXT,` only inside `CREATE TABLE IF NOT EXISTS` (added by 8628927); `git grep user_trigger_prompt origin/main -- db scripts src` → 0 hits; no ALTER adds it.
- Readers/writers on the integration branch: src/backend/api/routes.py:216-222 (the Lakebase prompt query names the column; on error execute_query returns [], services/lakebase.py:449); the seed INSERTs name it (e.g. dml_seed/02_seed_section_input_prompts.sql:110, :233).
- The DDL convention: idempotent additive migrations named NN_*.sql under db/lakebase/ddl/, `${schema}` replaced at runtime, header comment block (see 13_mcp_coaching.sql, 16_widen_workshop_level.sql); the tables step runs the DDL files in filename order before any seed (confirm in scripts/setup-lakebase.sh and cite the line).

## Changes
S1 db/lakebase/ddl/17_add_user_trigger_prompt.sql: the header block in the 13/16 style (what, why: D-69; fresh install: a no-op because DDL 02 creates the column; legacy upgrade from main: adds it; safe to re-run; non-destructive: adds a nullable TEXT column, rewrites no row, no default), then exactly one statement:
  `ALTER TABLE ${schema}.section_input_prompts ADD COLUMN IF NOT EXISTS user_trigger_prompt TEXT;`
S2 tests/workshop/test_user_trigger_prompt_ddl.py, modelled on tests/workshop/test_workshop_level_width.py: U1 the file exists and, comments stripped, has exactly one statement, an `ALTER TABLE ${schema}.section_input_prompts ADD COLUMN IF NOT EXISTS user_trigger_prompt TEXT`; U2 non-destructive: no DROP / TRUNCATE / DELETE / UPDATE / ALTER COLUMN … TYPE / RENAME / NOT NULL / DEFAULT in the statement; U3 ordering: the tables step's DDL glob/sort puts 17 after 02 and before any seed step (assert on the setup script's file list or sort rule, whichever the script uses; cite it); U4 the column name and type equal DDL 02's definition (parse DDL 02's CREATE TABLE); U5 every column named by the seed INSERT column lists exists in DDL 02's CREATE TABLE (so a future seed column cannot repeat this gap silently).
S3 decision-log: append D-68 and D-69 (and any other FORGE ID missing at the base).
S4 db/lakebase/README.md: add 17 to its DDL list only if it lists DDL files.

## Acceptance
A1 exactly the files above; A2 DDL 17 is a single additive idempotent statement; A3 U1-U5 pass; A4 no other db/ or seed change.

## Green gates
pytest tests/workshop tests/api ≥ 1640 + the new tests, 0 failed. The seed is unchanged, so the genie gate is not required (run it anyway and report: expect no movement).

## Tampers
X1 change ADD COLUMN IF NOT EXISTS to ADD COLUMN → U1 red.
X2 add `NOT NULL DEFAULT ''` → U2 red.
X3 rename the file to 01a_… so it sorts before 02 → U3 red.
X4 type TEXT → VARCHAR(20) → U4 red.
X5 add a made-up column to one seed INSERT column list (in a test fixture copy, not the real seed) → U5 red.

## Release
MERGE repo=app reseed=yes (a db/lakebase/ddl/ change): tables-only first (expected: DDL 17 runs; on the dev install the column already exists, so a no-op; `section_input_prompts: 0 inserted`), then code-only. The deploy guard must not see anything destructive (the file has only an ADD COLUMN IF NOT EXISTS).

## Live checks
L0 active deployment newer than 01f1c2d688001ca68fd495a2257e7fc3, nothing pending. L1 read-only DB: section_input_prompts has user_trigger_prompt TEXT (information_schema), row count unchanged vs before the release (read L0 count first). L2 /health 200, 7 tools, a fresh genie-accelerator vibe_get_step returns a non-empty prompt (prompts still load from Lakebase). L3 log capture: 0 Traceback/ERROR around the tables step and after.

## Reverse
Revert the PR (ADD COLUMN IF NOT EXISTS left the column where it was; nothing to undo on the dev install).

## Amendment r1 (review)
F1 db/lakebase/README.md: the DDL tree lists every file in db/lakebase/ddl/ at the head, in filename order, in the existing tree style (no other README change).
F2 tests/workshop/test_user_trigger_prompt_ddl.py: U5 stays, its docstring now says only what it checks (seed INSERT columns are a subset of DDL 02's CREATE TABLE).
U6 a frozen MAIN_COLUMNS baseline (literal dict; source origin/main 9f9cf6def6ce841e34f27c38c0019da3ae52091d, parsed from `git show 9f9cf6d:db/lakebase/ddl/<file>` for every CREATE TABLE on main). For each head CREATE TABLE IF NOT EXISTS whose table is in the baseline, every column not in the baseline must be added by an `ALTER TABLE ${schema}.<table> ADD COLUMN IF NOT EXISTS <column>` in some DDL file. Tables new since main are exempt; removed columns are allowed.
X6 delete DDL 17 in a temp copy of ddl/ → U6 red naming section_input_prompts.user_trigger_prompt.
X7 add a made-up column to DDL 02's CREATE TABLE in a temp copy of ddl/ → U6 red.
