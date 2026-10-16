# usecase-beat-seed-prereq

## Defect (live-probed at ad64c10, #86 probe observation)
Seed row 958 (`use_case_selection`, the MCP pre-journey intent beat) has a how_to_apply that says "### Prerequisite — ✅ `project_setup` complete (workspace and CLI ready)" (db/lakebase/dml_seed/02_seed_section_input_prompts.sql:143-145). Under Option A (the use-case beat comes BEFORE project_setup on genie-accelerator; mcp_server.py's _INTENT_BEAT_STEP comment, and the #86 probe: explain(None) returns project_setup only after the lock), this prerequisite is wrong. Row 958 serves only the MCP tag `use_case_selection`; the App's step 1 uses the different tag `usecase_selection`, so App content is unaffected.

## Change (trunk file db/lakebase/dml_seed/02_seed_section_input_prompts.sql; charter exception accepted by plan_critic)
1. In row 958's how_to_apply only, replace the Prerequisite bullet with: "- None. This is the first step of the Genie Code journey; you lock the use case **before** Set Up Project." Keep the section header and the rest of the body byte-identical. No other row, column or INSERT changes. Keep the SQL quote escaping (`''`) valid.
2. Check the input_template body (:112-130) for any other "after project_setup" claim, and fix it the same way only if it exists. Report either way.
3. Live DB: none (D-14). The seed skips duplicate PKs on purpose, so the live row 958 is unchanged by a redeploy. The PR body states this, and that updating the live row is a human admin-UI action.
4. docs/superpowers/decision-log.md: append D-13 and D-14 in the file's one-line public-register format:
   - D-13 (2026-10-04) · An unknown (industry, use_case) passed to vibe_start_track is ignored: no gate, no columns, and the intent beat elicits a real pick. If the catalogue is unavailable it fails open. Rule (3), most reversible. · Reverse: drop the unknown branch. (Skip D-13 if the start-track-unknown-usecase PR has already merged with it into your base; check `git log origin/feature/genie-code-mcp-integration`.)
   - D-14 (2026-10-04) · How does a text edit to an EXISTING seed row reach the live DB? Re-running the seed skips duplicate keys by design (seed header rule 6: admin-edited content is never overwritten by a redeploy), and the repo has no UPDATE path. Seed text edits to existing rows reach fresh installs only; changing a live row is an admin-UI action, and live prompt rows are never overwritten by automation. New rows (new keys) are applied by a reseed. · Reverse: revert the seed edit; the live row is untouched either way.

Fence: the seed file, docs/superpowers/decision-log.md, the plan file, and one new test file.

## Tests
- S1: a pytest that parses the seed file's row 958 how_to_apply and asserts it does NOT contain "`project_setup` complete" and DOES contain "before** Set Up Project". Put it next to any existing seed-parse tests (grep tests/ for 02_seed_section_input_prompts, e.g. the file with test_seed_body_steers_custom_path_to_draft_custom); otherwise add tests/workshop/test_seed_usecase_beat_text.py. If you add it to an existing file, name that file in a fence amendment.
- The existing seed and genie-gate tests stay green.
- The SQL stays loadable: any existing seed parser or SQL-syntax test passes, and the quote count is balanced.

## Acceptance contract
- Backend suite (DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= <APP>/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q): floor 602 plus the new test, 0 failed. If the repo has a genie gate or seed-diff script that applies to seed edits (e.g. scripts/genie_gate_diff.py), run it and report. Frontend `npm run lint` ABSOLUTE (0 errors), `npm run build` green. MCP tools/list = 7.
- Tamper (FORGE/state/specs/usecase-beat-seed-prereq/tampers.md): revert the bullet → S1 red; restore byte-identically.
- Open a PR into feature/genie-code-mcp-integration titled "usecase-beat-seed-prereq: the use-case beat has no project_setup prerequisite (seed text)".
