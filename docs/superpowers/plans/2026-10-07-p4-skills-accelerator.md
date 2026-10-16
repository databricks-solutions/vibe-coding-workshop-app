# p4-skills-accelerator: skills-accelerator walkable in Genie Code (P4.3, family 5) — D-45, D-46 — ROUND 2 (critic r1 BLOCK folded in: 1006 file-write tier / bundle root; 1005 tags via the bundle; execution class kept)

Base: origin/feature/genie-code-mcp-integration @ 9710bbd2f2fe9738243ffa52b1ad477ac1796fa0 (forks up to 1003 live; live input_id sequence 1004).
PR plan path: docs/superpowers/plans/2026-10-07-p4-skills-accelerator.md

## Evidence (lead read-only @9710bbd)
Track skills-accelerator (manifest): project_setup, skill_install_explore, skill_define_strategy, skill_create_skillmd, skill_apply_contracts, skill_certify_tables, iterate_enhance, redeploy_test (fork 1002), workspace_cleanup. No prd_generation (track_resolution.py has a skills guard). Every step's execution = agent-doable (generator default, not judged).
Genie Code mechanics (shipped code decides): the learner's clone is /Workspace/Users/<email>/vibe-coding-workshop, published to /Workspace/Users/<email>/.assistant/skills/vibe-coding-workshop/ by project_setup (mcp_server.py:980-1010, `cp -R` + an os.path.exists gate). Forks read skills as readSkillFile("skills/vibe-coding-workshop/data_product_accelerator/skills/…/SKILL.md") (seed :2433-2434, :2798). TPL data_product_accelerator/skills/admin/create-agent-skill/SKILL.md (@775bebc) frontmatter already says: clients [ide_cli, genie_code]; "On Genie Code, write the new skill folder under the cloned repo root ({REPO_ROOT} = state_file_root from skills/vibecoding-state), not a bare relative path" → no TPL change needed for authoring.
Per step (default bodies, seed 02):
- skill_install_explore (130, :9629, bypass true): "Open your cloned repository … in your coding assistant", bare relative paths `data_product_accelerator/skills/common/naming-tagging-standards/SKILL.md` and `…/admin/create-agent-skill/SKILL.md` (P2: relative paths resolve against the page CWD) → FORK 1004.
- skill_define_strategy (131, :9710) and skill_create_skillmd (132, :9763), bypass FALSE: LLM-generated documents; no markers, no paths to run, no deploy. → NO fork (D-39 / decision 5, start narrow; P4.4 covers non-bypass generation for every track).
- skill_apply_contracts (133, :9818, bypass true): "Copy the generated files into your project" at a bare relative `data_product_accelerator/skills/common/<your-skill-name>/`; "Ask your AI assistant to use the new skill". In Genie Code a skill is only invocable once it's under .assistant/skills, so a skill saved only in the clone is not usable → FORK 1005.
- skill_certify_tables (134, :9901, bypass true): authors skill_validator.py + skill_validation_job.yml, then "Deploy using `databricks bundle deploy`" and "`databricks bundle run skill_validation_job`" with no target, no bundle page, no bundle root (RULE_1 / P2; cf. #115 B1) → FORK 1006.
- redeploy_test 1002 (all tracks); iterate_enhance, workspace_cleanup: per D-39.

## Changes
S1 (seed 02, TRUNK, charter exception requested): three new genie-code fork rows, input_id 1004 skill_install_explore, 1005 skill_apply_contracts, 1006 skill_certify_tables, each right after its default row. Same rules as #114/#115: only input_template / system_prompt / bypass_llm (true, as the defaults), version 1, is_active true, no step_enabled; same learning intent, deliverables, gate and {tokens} as the default (FORK_INTENT_PARITY: {use_case_title}, {use_case_description}, {gold_table_target}, {default_warehouse}). Prescriptive Genie Code runbook style (as 905/1003): no @-mentions, no bare relative paths, runDatabricksCli without --profile, the .vibecoding-state.md enter/exit ritual.
  - 1004: resolve <REPO_ROOT> via vibecoding-state.resolve_root; read both skills via readSkillFile on their published `skills/vibe-coding-workshop/data_product_accelerator/skills/…` paths; same observations checklist.
  - 1005: write the generated package under `<REPO_ROOT>/data_product_accelerator/skills/common/<skill-name>/` with fully qualified workspace paths (executeCode open().write or the workspace file tools), then PUBLISH it into `/Workspace/Users/<email>/.assistant/skills/vibe-coding-workshop/data_product_accelerator/skills/common/<skill-name>/` (copy just that folder; do not delete the published tree), verify both copies with os.path.exists, then use it via readSkillFile on the published path. CRITIC r1 (3), D-46: NO in-session `ALTER TABLE … SET TAGS` (RULE_10; the workshop changes warehouse state only through the bundle; no shipped fork runs SET TAGS in-session). Instead the agent exercises the skill as a DRY RUN against the EXISTING target tables: it uses the published skill to generate the exact `ALTER TABLE … SET TAGS` statements and the validation SQL for at least one target table, runs ONLY read-only checks (SELECT from `system.information_schema.table_tags` for the current state; DESCRIBE), shows the learner the statements and the before-state, and records them in `<REPO_ROOT>/data_product_accelerator/skills/common/<skill-name>/references/` as the dry-run output. The statements are APPLIED in the next step by the bundle-deployed validator job (1006). Deliverables, adjusted only in mechanism: skill saved + published; skill exercised against at least one target asset (statements generated and dry-run validated); application handed to Validate & Automate. The gate text stays the default's; FORK_INTENT_PARITY tokens unchanged.
  - 1006: CRITIC r1 (1) + shipped code (fork 901, seed :2774-2861): the learner's clone has NO databricks.yml for this track (TPL @775bebc has no databricks.yml anywhere), so the fork creates a self-contained bundle root exactly the way 901 creates <DP_BUNDLE_ROOT>: `<SKILL_BUNDLE_ROOT>` = `<REPO_ROOT>/{user_schema_prefix}_skill_validation_dab` (record it in the state file), files written with `executeCode` `open(path,"w").write(...)` one per file (the genie-code-environment §10 file-write tier; a trivial first `print("ready")` for the cold start), NEVER `createAsset`/`editAsset` (P3: API-written files may not reach the CLI's FUSE mount), each write verified with os.path.exists / a read-back (not listFiles); `databricks.yml` with `targets.dev` and `source_linked_deployment: false` from the start (901 :2831), `src/skill_validator.py`, `resources/skill_validation_job.yml`; the validator job's body is what APPLIES/removes the compliance tags (bundle-authored job body = allowed under RULE_10's test); then surface the bundle-editor link (w.workspace.get_status(...).object_id, as 901 :2843-2849) and run every bundle command from that page; the `databricks.yml not found` STOP; `bundle validate` → `bundle deploy --target dev` → `bundle run skill_validation_job` from that page; never hand-run DDL; STOP + escape hatch only on operator authorization. Gate "necessary but NOT sufficient" mechanism clause as in 905.
  Reason: P4.3; served-body correctness for Genie Code. Reversal: remove the three INSERTs (live rows stay; deactivate via the admin UI).
Execution class (CRITIC r1 (2), rejected): every step stays agent-doable. The `STOP + escape hatch only on operator authorization` clause is the failure path for a blocked bundle command, not the normal path; shipped forks 901 (:2855), 905 and 1003 carry the identical clause and are agent-doable (manifest; generate_manifest.py default :472). Protocol (1): shipped code decides.
S2 tests (offline): NEW tests/workshop/test_skills_family_genie.py reusing #115's helpers (resolved learner email, MARKERS/_hits, exact-shape project_setup allowance):
  - served-body marker lint for every MCP-outline step of skills-accelerator (genie-code); prohibition hits get #114-style exact-count allowances with a reason; affirmative hits are failures.
  - fork resolution 1004-1006 (+1002) for genie-code; defaults for default sessions.
  - bare-relative-path pin: the 1004/1005 bodies contain no `data_product_accelerator/skills/` path that isn't prefixed by `skills/vibe-coding-workshop/` (readSkillFile) or `<REPO_ROOT>/` or `/Workspace/Users/`.
  - publish pin (1005): the body writes under <REPO_ROOT>, copies into `.assistant/skills/vibe-coding-workshop/`, and verifies with os.path.exists, in that order.
  - no-in-session-mutation pin (1005, D-46): the 1005 body contains no affirmative instruction to EXECUTE `SET TAGS` / `ALTER TABLE` / `CREATE` (they may appear only as generated dry-run text or inside a NEVER/do-NOT line), and it hands application to the next step.
  - file-write tier pin (1006): the body writes bundle files with executeCode open().write, never createAsset/editAsset, and sets source_linked_deployment: false.
  - bundle-mechanics pin (1006): every `bundle run` follows the bundle-editor page and `bundle deploy --target dev`; the STOP line is present.
  - additive: walk start → Done for skills-accelerator (test_track_scoped_walk.py), MCP outline == SPA outline (test_outline_parity.py), execution pin agent-doable (test_manifest_parity.py); test_seed_new_rows.py counts moved only as forced by the 3 rows (state each).
S3 plan file: the per-tag judgment table (tag → fork/none → execution → RULE evidence) + D-45.
S4 decision log: D-45 and lead decisions.md entries after the last carry (D-43, D-44 if p4-covered-families hasn't merged first; the implementer carries whatever is not yet in decision-log.md).
Fence: seed 02 (TRUNK), tests/workshop/, the plan file, docs/superpowers/decision-log.md.

## Tampers (expected red)
X1 delete the 1005 INSERT → fork resolution red + the publish pin red.
X2 add `Open your cloned repository in your coding assistant and open data_product_accelerator/skills/common/naming-tagging-standards/SKILL.md` to 1004 → the bare-path pin red.
X3 remove the publish copy line from 1005 → the publish pin red.
X4 remove `bundle deploy --target dev` before `bundle run` in 1006 → the bundle pin red.
X5 add `Run npm install` to 1006 → the lint red AND the genie gate diff red.
X6 flip skill_certify_tables' execution to ui-driven in manifest.json (tamper only) → the agent-doable pin red.
X7 add `Run the generated ALTER TABLE ... SET TAGS statements now with executeCode spark.sql.` to 1005 → the no-in-session-mutation pin red.
X8 replace the executeCode open().write instruction in 1006 with `createAsset` → the file-write tier pin red.

## Green gates
App suite (floor 1060 at 9710bbd) all pass + new tests; genie gate diff: python3 FORGE/tools/genie_gate_diff.py --base-ref origin/feature/genie-code-mcp-integration (TPL @775bebc) --base-seed <APP seed @9710bbd> --head-seed <worktree seed> → exit 0, no new findings, FORK_INTENT_PARITY covering 58 forks, deploy-fork discipline gate passes for 1006.

## Release
reseed=yes (3 new rows), tables step in DEFAULT create mode: expected `section_input_prompts: 3 inserted / 0 warnings`, sequence raised 1004 → 1007; usecase_descriptions 0/0.

## Live checks (prober; sessions via app endpoints only; Lakebase read-only)
L0 pre-deploy baseline: skills-accelerator genie-code walk to Done, recording every served body's sha + markers (130/133/134 served from defaults).
L1 tables-step log: 3 inserted / 0 warnings; sequence 1004 → 1007.
L2 skills-accelerator fresh walk to Done: 0 app tool errors; skill_install_explore / skill_apply_contracts / skill_certify_tables served from 1004/1005/1006 (shas ≠ L0), 0 affirmative markers; 1006's bundle page < bundle deploy --target dev < bundle run; every other step's sha = L0 except LLM steps (131, 132, iterate_enhance).
L3 MCP outline == /api/track/skills-accelerator/outline?session_id= full JSON, = L0.
L4 7 tools (tools/list); /health 200; clean log.

## Decision D-46
question: may a genie-code fork run `ALTER TABLE … SET TAGS` in-session (skill_apply_contracts)? · choice: no; dry-run in 1005 (generate + read-only verify), apply through the bundle-deployed validator job in 1006 (protocol 3, most reversible + RULE_10-safe; no shipped fork mutates in-session) · evidence: TPL 00-overview :26-30 (all state through the bundle), RULE_10 :149; critic r1 (3) · reversal: if the human rules tag application on existing tables is allowed in-session, replace 1005's dry-run block with an applied run (new fork version).

## Decision D-45
question: which skills-accelerator steps need a genie-code fork? · choice: 1004 skill_install_explore (bare relative skill paths, "open in your coding assistant"), 1005 skill_apply_contracts (save + PUBLISH to .assistant/skills so Genie Code can invoke the new skill), 1006 skill_certify_tables (bundle deploy/run without page/target, RULE_1); none for the LLM steps 131/132; no TPL change (create-agent-skill already documents the Genie Code repo-root write) · evidence: seed :9629-9960; mcp_server.py:980-1010; TPL create-agent-skill SKILL.md:5-8 · reversal: remove the three INSERTs.

## S3 — per-tag judgment table

Execution class is read only for "ui-driven" (engine.py:285, mcp_server.py:1794); "agent-doable" is the shipped generator default, so no manifest change. Track: skills-accelerator (MCP outline order). Seed lines are as of this PR's head.

| section_tag | genie-code fork | execution | RULE evidence |
|---|---|---|---|
| project_setup | none (no seed row; MCP serves mcp_server._project_setup_content) | agent-doable | served body marker-clean apart from the learner's own `/Workspace/Users/<email>/…SKILL.md` path (the #115 allowance, exact pattern); publishes the clone into `.assistant/skills` (mcp_server.py:980-1010) |
| skill_install_explore | 1004 (new, seed :9711) | agent-doable | default 130 says "open in your coding assistant" and names bare relative `data_product_accelerator/skills/…` paths (RULE_0, RULE_6; P2: relative paths resolve against the page CWD); fork reads both skills by `readSkillFile("skills/vibe-coding-workshop/…")`, `<REPO_ROOT>` via resolve_root, read-only |
| skill_define_strategy | none | agent-doable | default 131 bypass_llm false: an LLM-generated document, no paths to run, no deploy, marker-clean; D-39 / TPL decision 5 (start narrow; P4.4 covers non-bypass generation) |
| skill_create_skillmd | none | agent-doable | default 132 bypass_llm false: as 131 |
| skill_apply_contracts | 1005 (new, seed :9980) | agent-doable | default 133 copies to a bare relative path and asks "your AI assistant" to use a skill Genie Code can't load until it is published (RULE_6); fork saves under `<REPO_ROOT>`, publishes just that folder into `.assistant/skills/vibe-coding-workshop/`, verifies with os.path.exists, loads via readSkillFile; D-46: dry run only (RULE_10: no in-session ALTER/SET TAGS) |
| skill_certify_tables | 1006 (new, seed :10140) | agent-doable | default 134 runs `bundle deploy` / `bundle run` with no target, no bundle root and no bundle page (RULE_1; cf. #115 B1); fork creates `<REPO_ROOT>/{user_schema_prefix}_skill_validation_dab` as 901 creates `<DP_BUNDLE_ROOT>` (executeCode writes, source_linked_deployment false), deploys and runs from the bundle editor; the operator-authorization STOP is the failure path, as in 901/905/1003 (protocol 1) |
| iterate_enhance | none | agent-doable | LLM-generated plan, marker-clean in the served-body lint; D-39 |
| redeploy_test | 1002 (existing, #114) | agent-doable | fork shared by all tracks; marker-clean |
| workspace_cleanup | none | agent-doable | default 140 marker-clean in the served-body lint; D-39 |

Implementation notes:
- The forks carry the enter/exit ritual under a `**State file:**` label, not `**State-lock:**`. The TPL state-persistence gate requires a `State-lock:` fork to name `<dp_bundle_root|app_root|agent_app_root>/.vibecoding-state.md`, and this track has none of those roots: vibecoding-state resolves its live file under `state_file_root` (`<REPO_ROOT>`). Every other sentinel of that gate is present (`prompt_id:`, `gate:`, "mandatory ritual, not advisory", "NOT complete until", re-read and echo).
- The defaults carry no `**Gate:**` line and the manifest gates are null, so FORK_INTENT_PARITY has no gate to match. 1006 adds the 905-style gate (`Skill validation job deployed and run`, "necessary but NOT sufficient").
