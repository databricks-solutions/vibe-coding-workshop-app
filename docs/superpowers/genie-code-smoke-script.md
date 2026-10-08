# Genie Code smoke script (the human's client smoke)

This is the script for the one check the forge could not do: run the workshop in a real Genie Code client and execute what the server serves. The forge probes only read served text through MCP and REST. They never ran a served instruction, never sent `confirm cleanup`, and completed some steps headlessly (Phase 4 exit report §5, "What only the human Genie Code smoke can prove"). The record of what the forge did is [ledger.md](ledger.md).

Facts this script relies on, all at APP `99660a9` (the deployed SHA, FORGE/state/release/last_deployed_sha):
- 14 tracks in src/backend/workshop/manifest.json, 7 MCP tools, and 4 MCP prompts (99660a9…-docs-refresh.md L1b-L1c).
- For each step, the server serves the highest active version of that step's genie-code fork row. A step with no fork gets its default row (D-57). The served row ids in S3 were resolved that way from db/lakebase/dml_seed/02_seed_section_input_prompts.sql at this commit; they match the latest probes cited per track.

## S0. Prerequisites

1. A Databricks workspace with **Genie Code** in **Agent mode**, and a participant identity (your email) that owns nothing you would mind cleaning up (S4).
2. The app: https://mcp-vibe-coding-workshop-app-7474656657532371.aws.databricksapps.com
   - Its MCP endpoint is https://mcp-vibe-coding-workshop-app-7474656657532371.aws.databricksapps.com/mcp
   - The endpoint is mounted at app.py:284, `app.mount("/mcp", mcp_app, name="mcp")`, behind `MCP_MOUNT_ENABLED` (app.py:283).
   - It is documented in docs/specs/mcp_design/mcp-workshop-facilitator-guide.md:38.
3. Add the app as a Custom MCP server. The steps below are quoted from the facilitator guide §2 (:36-41):

   > 1. Open **Genie Code** in your workspace and switch to **Agent mode**.
   > 2. Open the MCP / custom-tools settings and **Add a custom MCP server**.
   > 3. Enter the app's MCP URL: `https://<app-url>/mcp` (the app URL + `/mcp`).
   > 4. Save. Genie Code performs the handshake; the `vibe_*` tools and the workshop prompts become available.
   > 5. If it doesn't appear, see Troubleshooting (§7) — the usual cause is the 307 or an `mcp-` name.

   And the start sentence (:43-44):

   > Then start: on the Genie Accelerator say "Start the Genie Accelerator"; on any other track say "Start a workshop track" with the track id shown in the app.

4. Check that the connection is up before starting:
   - Genie Code lists 7 tools: `vibe_complete_step`, `vibe_explain_step`, `vibe_get_step`, `vibe_next_step`, `vibe_set_parameters`, `vibe_start_track`, `vibe_submit_answer`.
   - It lists 4 prompts: "Start the Genie Accelerator", "Start a workshop track", "Continue where I left off", "How does this workshop work?" (mcp_server.py:2421-2490; 99660a9…-docs-refresh.md L1b-L1c).
   - If the count differs, record it (S5) and stop.

## S1. Project setup, then switch the clone to the integration branch

**S1.1 Start a track and run project_setup.** Say a start prompt (S2), for example "Start the Genie Accelerator".
1. On a fresh session with no use case, the first thing served is the use-case intent beat, `use_case_selection`, from default row 958 (99660a9…-docs-refresh.md L1d: "next_step sectionTag=use_case_selection"). Pick or lock a use case.
2. Then `project_setup` is served. It has no seed row: the server builds its three gated commands in src/backend/mcp_server.py:980-1047 (`_project_setup_content`, commands at :998-1011). With your email in place of `<email>`:
   1. Clone (:998):
      ```
      git clone https://github.com/databricks-solutions/vibe-coding-workshop-template.git /Workspace/Users/<email>/vibe-coding-workshop
      ```
   2. Publish the skills (copy_cmd, :999-1003):
      ```
      D=/Workspace/Users/<email>; rm -rf "$D/.assistant/skills/vibe-coding-workshop"; mkdir -p "$D/.assistant/skills"; cp -R "$D/vibe-coding-workshop" "$D/.assistant/skills/"
      ```
   3. Validate (validate_cmd, :1004-1011):
      ```
      D=/Workspace/Users/<email>; test -d "$D/vibe-coding-workshop/.git" && echo "✅ 1/2 project cloned" || echo "❌ 1/2 re-run command 1"; test -f "$D/.assistant/skills/vibe-coding-workshop/skills/genie-code-environment/SKILL.md" && echo "✅ 2/2 skills published" || echo "❌ 2/2 re-run command 2"
      ```
3. Expected (:1031-1036): `✅ 1/2 project cloned`, `✅ 2/2 skills published`. Then Genie Code re-verifies both paths with `os.path.exists` in one `executeCode` block, loads `skills/vibe-coding-workshop/skills/genie-code-environment/SKILL.md` with `readSkillFile`, and confirms "Setup verified ✅" (:1015-1023).

**S1.2 Switch the clone to the TPL integration branch (until TPL RC #21 merges).** The clone above checks out the TPL default branch, main. The forge's template changes (TPL #18-#20) are only on `feature/genie-code-mcp-integration` (ledger L1, L3). Ask Genie Code to run these in the Genie Code terminal, the same way it ran the project_setup commands:
1. Fetch and switch:
   ```
   git -C /Workspace/Users/<email>/vibe-coding-workshop fetch origin feature/genie-code-mcp-integration && git -C /Workspace/Users/<email>/vibe-coding-workshop checkout -B feature/genie-code-mcp-integration origin/feature/genie-code-mcp-integration
   ```
   Expected: git reports the branch set up and switched; no error.
2. Re-publish the skills: the same copy_cmd as S1.1 step 2:
   ```
   D=/Workspace/Users/<email>; rm -rf "$D/.assistant/skills/vibe-coding-workshop"; mkdir -p "$D/.assistant/skills"; cp -R "$D/vibe-coding-workshop" "$D/.assistant/skills/"
   ```
   Expected: no output, exit 0.
3. Validate again: the same validate_cmd as S1.1 step 3. Expected: the same two ✅ lines.
4. Confirm the branch and head:
   ```
   git -C /Workspace/Users/<email>/vibe-coding-workshop rev-parse --abbrev-ref HEAD
   git -C /Workspace/Users/<email>/vibe-coding-workshop rev-parse HEAD
   ```
   Expected: `feature/genie-code-mcp-integration`, then `a77f33bc23c80fb89919ab8dd4297b9903c0426a` or a later integration head (ledger L1).

Known gap: project_setup itself serves `git clone` (mcp_server.py:998), so this script assumes git runs in the Genie Code terminal. If `git fetch` or `git checkout` is refused or unavailable there, record it as a failure of S1.2 (S5). Continue on main only as a recorded deviation; this script gives no other way to switch.

## S2. Quick check per track (all 14)

For each track: start a **new** session with the start prompt, check that the first outline step is the one listed, and check that the outline matches the SPA. The prompts and their names are mcp_server.py:2421-2467 (D-59: the SPA panel names the start prompt for the session's track).
- On genie-accelerator, say **"Start the Genie Accelerator"**.
- On every other track, say **"Start a workshop track"** with `track: <id>`.

**Expected first step.**
- `vibe_start_track` returns an outline whose first item is `project_setup` "Set Up Project" with status `current`, on every track.
- With no use case locked yet, `vibe_get_step` / `vibe_next_step` first serve the `use_case_selection` intent beat (default row 958), which precedes the outline. After the lock, the current step is `project_setup`.

**Outline vs SPA.**
1. Open the `session_url` that `vibe_start_track` returns (`<app>?sessionId=<id>`, mcp_server.py StartTrackResult). The SPA renders the track outline from `GET /api/track/<track>/outline?session_id=<id>` (App.tsx:131-169).
2. Compare it with the MCP outline, step by step (sectionTag, title, order, status): the `outline` field of `vibe_start_track`, or the `vibe://session/<id>/state` resource (mcp_server.py:2359, 2376).
3. `vibe_next_step` returns a step payload, not an outline (`NextStepResult`, mcp_server.py:287). Use it to check the current step, not the outline.
4. The forge's last full-JSON comparison found 0 diffs: 3d5b700…-phase3-exit-gate.md L1, 24 steps; 89ee6f0…-cleanup-140-profile.md L3.

Step counts come from the manifest (`sections[].steps[]`). The default outline is what `engine.outline` composes with no flags set; it was computed at this commit.

| # | Track id | Title (manifest) | Start prompt | Steps (manifest) | Default outline | First step | Second step |
|---|---|---|---|---|---|---|---|
| 1 | app-only | Databricks Apps | "Start a workshop track", `track: app-only` | 7 | 7 | project_setup "Set Up Project" | prd_generation |
| 2 | app-database | + Lakebase | "Start a workshop track", `track: app-database` | 10 | 10 | project_setup "Set Up Project" | prd_generation |
| 3 | lakehouse | Lakehouse | "Start a workshop track", `track: lakehouse` | 11 | 11 | project_setup "Set Up Project" | prd_generation |
| 4 | lakehouse-di | + AI and Agents | "Start a workshop track", `track: lakehouse-di` | 17 | 17 | project_setup "Set Up Project" | prd_generation |
| 5 | end-to-end | Complete Workshop | "Start a workshop track", `track: end-to-end` | 24 | 24 | project_setup "Set Up Project" | prd_generation |
| 6 | accelerator | Data Product Accelerator | "Start a workshop track", `track: accelerator` | 17 | 17 | project_setup "Set Up Project" | prd_generation |
| 7 | genie-accelerator | Genie Accelerator | "Start the Genie Accelerator" | 31 | 24 (31 with `includeLakehouse` and `includeGenieOntology` on) | project_setup "Set Up Project" | prd_generation |
| 8 | data-engineering-accelerator | Data Engineering Accelerator | "Start a workshop track", `track: data-engineering-accelerator` | 11 | 11 | project_setup "Set Up Project" | prd_generation |
| 9 | skills-accelerator | Agent Skills Accelerator | "Start a workshop track", `track: skills-accelerator` | 9 | 9 | project_setup "Set Up Project" | skill_install_explore (no prd_generation on this track) |
| 10 | agents-accelerator | Agents Accelerator | "Start a workshop track", `track: agents-accelerator` | 29 | 29 | project_setup "Set Up Project" | prd_generation |
| 11 | reverse-lakehouse | Lakehouse | "Start a workshop track", `track: reverse-lakehouse` | 11 | 11 | project_setup "Set Up Project" | prd_generation |
| 12 | reverse-lakehouse-di | + AI and Agents | "Start a workshop track", `track: reverse-lakehouse-di` | 17 | 17 | project_setup "Set Up Project" | prd_generation |
| 13 | reverse-lakebase | + Lakebase (Synced) | "Start a workshop track", `track: reverse-lakebase` | 18 | 18 | project_setup "Set Up Project" | prd_generation |
| 14 | reverse-app | + Analytics App | "Start a workshop track", `track: reverse-app` | 23 | 23 | project_setup "Set Up Project" | prd_generation |

Track-specific checks:
- **skills-accelerator:** lock the skills use case (`build_skill`) first. Without it, the session silently runs as end-to-end (queue.md:59, skills-track-silent-fallback). Record which you got.
- **data-engineering-accelerator:** the session must save (the 28-character track id needs the DDL 16 width from #122). A session id that later returns INVALID_SESSION is a regression (ledger L2 #118/#122).

## S3. Full walks (5 tracks)

Walk these five tracks to Done. The manifest has no family field; the families are the test groupings (tests/workshop/test_*_family_genie.py, test_covered_families_genie.py). The five tracks:
- genie-accelerator (reference)
- app-only (app family)
- lakehouse (lakehouse family)
- agents-accelerator (agents family)
- reverse-app (reverse family)

How the forge walked each track headlessly. Each probe read the served text and called the tools, but executed no served instruction:

| Track | Latest probe | What it recorded |
|---|---|---|
| genie-accelerator | FORGE/state/probes/89ee6f063251437563069abc99dff0438db81ae0-cleanup-140-profile.md L2 | 31/31 to Done, 99 calls, 0 unexpected tool errors, 3 expected refusals (GATE_REQUIRED gagent_benchmarks; UI_DRIVEN_STEP ontology_pages and ontology_routing), workspace_cleanup served from 1033 |
| app-only | the same probe, L2 | 7/7 to Done, 22 calls, 0 unexpected tool errors, workspace_cleanup served from 1033 |
| agents-accelerator | FORGE/state/probes/a7e169938b49ae2aeac00a95d4d10dddbaa35991-p4-agents-a-1009.md L2 | 29/29, 88 calls, 0 tool errors, 0 empty prompts |
| lakehouse | FORGE/state/probes/9710bbd2f2fe9738243ffa52b1ad477ac1796fa0-p4-lakehouse-family.md L2 | 12 steps walked (use_case_selection plus the 11 outline steps), 41 calls, 0 app-side tool errors, 0 empty prompts, forks 901-905 served. Later 11-step control walks: 7e4144d…-workshop-level-reland.md L3 (11/11, 35 calls, 0 errors) |
| reverse-app | FORGE/state/probes/0b07fc05b968b3fbacd677413ab4e49032630d3f-p4-covered-families.md L2 | 24 steps (the use_case_selection beat plus the 23 outline steps; outline n = 23 at :33), 24 gates, 77 calls, 0 app errors |

How to read each step below:
- Steps are listed in manifest.json order (`sections[].steps[]`).
- "Served row" is the row the server resolves for genie-code (D-57).
- "Genie Code" summarises what the served text tells Genie Code to do. "Expected output" and "Gate" are quoted or condensed from the served row; long gate texts are cut with "…".
- Every step completes with `vibe_complete_step(<step id>)` after its gate is met. If the step has a post comprehension check, the learner answers it with `vibe_submit_answer`.

For genie-accelerator, turn on both opt-in flags right after the start, so that the outline has all 31 steps. Ask Genie Code to call `vibe_set_parameters` with `params: {"flags": {"includeLakehouse": true, "includeGenieOntology": true}}`. This is what the probe did (cleanup_140_profile_probe.py:109-111). Without the flags, steps 3-6 and 26-28 are filtered off and the outline has 24 steps.

### Coaching foci (every step)

`vibe_explain_step(session_id, sectionTag, focus)` takes `focus` in `what_now | why | unblock | review` (mcp_server.py:1494-1504; services/coaching.py:62). Ask it at least once per walk for each focus, on any step. The table quotes the coach's own definitions from services/coaching.py:51-54:

| Focus | What to ask | A good answer contains |
|---|---|---|
| `what_now` | "Where am I and what do I do now?" | "orient them — where they are, what this step produces, what to do next" |
| `why` | "Why does this step matter?" | "motivate — why this step exists and what breaks downstream if it's skipped or wrong" |
| `unblock` | "I'm stuck on this step." | "diagnose — the most likely reason they're stuck here and the smallest next action" |
| `review` | "Recap what I've done so far." | "recap — what they've accomplished so far and how this step builds on it" |

Other rules for every answer (coaching.py:40-60):
- 2-5 sentences of prose, grounded in the step context.
- It never restates the step's prompt, and it never emits benchmark text, sample values, secrets or PII.

**Fail-open.** If the coach is disabled, errors, runs past its 8.0 s budget (coaching.py:66, `COACH_BUDGET_S`) or is rejected by the scrub, `vibe_explain_step` still returns the static `how_to_apply` / `expected_output`. In that case `coaching` is null and `is_fallback: true` (mcp_server.py:1566-1572; D-22). Record `is_fallback` for each call.

### Step-prompt fail-open

Four step tags are non-bypass, so the server generates their prompt with the LLM within `STEP_PROMPT_BUDGET_S = 90.0` (mcp_server.py:798): prd_generation, iterate_enhance, skill_define_strategy and skill_create_skillmd.

On expiry, error or truncation, the server serves the row's assembled template instead (mcp_server.py:960-969, the warning "MCP step-prompt generation exceeded …s budget … using assembled template"). The prompt is never empty (D-62). On the five walks, two of these tags appear:
- **prd_generation:** generated within budget, 13/13.
- **iterate_enhance:** expect the template fallback, 14/14 in b260c64…-p4-llm-steps.md.

#### genie-accelerator (31 steps)

1. **`project_setup`: Set Up Project** · agent-doable · served row virtual (mcp_server.py `_project_setup_content`)
   - Genie Code: No seed row: the server builds this step in mcp_server.py `_project_setup_content` (:980-1047). Genie Code runs the three commands of S1 (clone, publish skills, validate) in the Genie Code terminal, shows each command and its output, then re-verifies both paths with `os.path.exists` in one `executeCode` block and loads `skills/vibe-coding-workshop/skills/genie-code-environment/SKILL.md` with `readSkillFile`.
   - Expected output: The validate command prints `✅ 1/2 project cloned` and `✅ 2/2 skills published`; then 'Setup verified ✅' (mcp_server.py:1031-1036, `expected_output`).
   - Gate: two green checks; Genie Code must STOP if validation is not two green checks (:1015). Then `vibe_complete_step(project_setup)`. Expect this complete to take 17-38 s, because the next step's PRD prompt is generated inside the response (queue.md:18 complete-project-setup-latency).
2. **`prd_generation`: PRD Generation** · agent-doable · served row `1` (default row, version 1)
   - Genie Code: LLM-generated over default row 1 (prd_generation is a non-bypass tag; the server generates the step prompt from row 1's template within the 90 s budget, mcp_server.py:798). Row 1 asks for a prompt that creates a simple PRD for the locked use case.
   - Expected output: a PRD document saved under the project (row 1: "Create ONLY the PRD document").
   - Gate: row 1: "STOP after saving. Do not generate any code, tables, APIs, or proceed with other tasks." Then `vibe_complete_step(prd_generation)`. Requires the use_case_selection gate (manifest requiresGate). Budget evidence: 13/13 generated within budget, median 29.8 s (D-62).
3. **`genie_silver_metadata`: Analyze Silver Metadata** · agent-doable · flag `includeLakehouse` · served row `1017` (genie-code fork, version 1)
   - Genie Code: Fork 1017 (v1). Run the information_schema queries (tables, columns, table constraints, constraint column usage, column and table tags) against `{chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema}`, merge them into an enriched metadata CSV, and write a Genie analysis plan.
   - Expected output: an enriched metadata CSV and a Genie analysis plan (row 1017 "Merge and save" / "Analyze and document").
   - Gate: no **Gate:** line in row 1017; complete with `vibe_complete_step(genie_silver_metadata)`. On by flag `includeLakehouse` only.
4. **`gold_layer_design`: Gold Layer Design** · agent-doable · flag `includeLakehouse` · served row `903` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the required skills by their FULL skill_ref_root-prefixed paths; Run the design workflow, writing every artifact under <DP_BUNDLE_ROOT>/gold_layer_design/.
   - Expected output: `<DP_BUNDLE_ROOT>/gold_layer_design/` contains the FULL mandatory deliverables set from the orchestrator's deliverables checklist: `DESIGN_DECISIONS.md` (written before any YAML), one YAML per Gold table under `yaml/{domain}/`, the master ERD, `COLUMN_LINEAGE.csv` (+ `COLUMN_LINEAGE.md`), `SOURCE_TA…
   - Gate: `Gold design complete` (served text), then `vibe_complete_step(gold_layer_design)`.
5. **`gold_layer_pipeline`: Gold Pipeline** · agent-doable · flag `includeLakehouse` · served row `904` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the required skills by their FULL skill_ref_root-prefixed paths; Pin the Silver column inventory (read-only hard gate — do this BEFORE writing merge_gold_t; Author the Gold bundle (YAML-driven 2-job architecture). Do NOT execute anything yet.; Write bundle files to <DP_BUNDLE_ROOT>, then deploy FROM that page.
   - Expected output: `gold_setup_job` (both tasks) and `gold_merge_job` (both tasks — `merge` then `validate_gold`) were **created by `bundle deploy` and executed by `bundle run`** (the setup job ran first and the merge job populated data), the `validate_gold` task PASSED (PKs/FKs/NOT NULL/CDF/row-tracking all still pre…
   - Gate: `Gold layer live` (served text), then `vibe_complete_step(gold_layer_pipeline)`.
6. **`deploy_lakehouse_assets`: Deploy Assets** · agent-doable · flag `includeLakehouse` · served row `905` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the required skills by their FULL skill_ref_root-prefixed paths; Deploy and run the whole pipeline FROM the bundle editor; Verify end-to-end (read-only).
   - Expected output: all five jobs (`bronze_clone_job`, `silver_dq_setup_job`, `silver_dlt_pipeline`, `gold_setup_job`, `gold_merge_job`) were **deployed by `bundle deploy` and executed by `bundle run`** in dependency order end-to-end, AND the Bronze/Silver/Gold schemas in `{lakehouse_default_catalog}` are populated (`d…
   - Gate: `Lakehouse assets deployed` (served text), then `vibe_complete_step(deploy_lakehouse_assets)`.
7. **`semlayer_locate`: Locate Data & Bring Context** · agent-doable · served row `1018` (genie-code fork, version 2)
   - Genie Code: Point at my existing tables in `{chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema}`, read any definitions I bring, and seed the Genie brief — no building, just a first-pass brief for me to correct.
   - Expected output: `<ARTIFACT_ROOT>/docs/genie_brief.md` exists with function + candidate measures + the questions users ask; the source `{chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema}` is confirmed OR the synthetic branch was chosen; one batched, pre-assumed question list was presented; the gate result is…
   - Gate: `Brief seeded` (served text), then `vibe_complete_step(semlayer_locate)`.
8. **`semlayer_profile`: Profile Your Schema** · agent-doable · served row `1019` (genie-code fork, version 2)
   - Genie Code: Profile the source schema read-only — grain, joins, PK/FK candidates, hidden business columns, and an ERD — then mark each candidate measure can/can't-support. Create nothing, but for every can't-support give a concrete recommendation, not an open question.
   - Expected output: per-table grain/joins/PK-FK and hidden-column callouts reported; an ERD is produced; every candidate measure carries a can/can't-support verdict; every can't-support carries a concrete recommendation; nothing was created; the gate is recorded in `<STATE_FILE>`. Reply with corrections, or paste the n…
   - Gate: `Schema profiled` (served text), then `vibe_complete_step(semlayer_profile)`.
9. **`semlayer_measures`: Measures Analysis** · hybrid · served row `1020` (genie-code fork, version 2)
   - Genie Code: Draft a governed ≤5-measure inventory and self-discover any definitional conflicts. Keep the review gate — show me the inventory before any Metric View YAML — but resolve every conflict with a concrete recommendation, not an open question.
   - Expected output: a ≤5-row inventory exists in `<ARTIFACT_ROOT>/docs/genie_brief.md` with definition, concrete source of truth, grain, an owner (named or assumed-role), and for each conflict both readings plus a recommended one; at least one conflict was self-discovered; no Metric View YAML was written this turn; the…
   - Gate: `Inventory signed off` (served text), then `vibe_complete_step(semlayer_measures)`. Hybrid: row 1020 stops and shows the inventory table for review ("Review gate (kept)").
10. **`semlayer_metric_view`: Draft the Metric View** · agent-doable · served row `1021` (genie-code fork, version 2)
   - Genie Code: Build a governed Metric View in `{lakehouse_default_catalog}.{user_schema_prefix}_gold` from the signed-off inventory — keep the plan-review gate, then create it and prove each measure with a `MEASURE()` query.
   - Expected output: one governed Metric View exists in `{lakehouse_default_catalog}.{user_schema_prefix}_gold` for exactly the approved measures; the YAML was reviewed before creation; a `SELECT MEASURE(...) ... GROUP BY ALL` returns a number for each measure; non-additive measures are flagged; the Metric View name + g…
   - Gate: `Metric View live` (served text), then `vibe_complete_step(semlayer_metric_view)`.
11. **`semlayer_synonyms`: Review & Expand Synonyms** · agent-doable · served row `1022` (genie-code fork, version 2)
   - Genie Code: Review the synonyms already on the Metric View and expand them — acronyms, informal phrasing, legacy names (and any imported BI field aliases). Keep the diff-review gate; recommend the full set rather than asking me which to add.
   - Expected output: reviewed + expanded `synonyms:` (≤10 per measure/key dimension) proposed as a diff covering acronyms, informal phrasing, and legacy names (plus BI aliases when imported); the diff was shown before rebuild; on approval the Metric View was rebuilt; the gate is recorded in `<STATE_FILE>`.
   - Gate: `Synonyms reviewed` (served text), then `vibe_complete_step(semlayer_synonyms)`.
12. **`gagent_describe`: Describe the Agent** · agent-doable · served row `934` (genie-code fork, version 1); v2 `1023` is held by D-61, so v1 is served
   - Genie Code: Create a Genie Agent scoped from the PRD personas. Attach the governed Metric View (for measures) AND its base detail table(s) one grain below (for row-level questions), validate the serialized config, and review it before you create the space.
   - Expected output: a live Genie space exists for `{use_case_title}` with a plain-language scope; the governed Metric View is attached for measures AND the base detail table(s) one grain below are attached for row-level questions (the whole raw schema is NOT attached); the config was validated (`_assert_sql_arrays`) an…
   - Gate: `Agent scaffolded` (served text), then `vibe_complete_step(gagent_describe)`.
13. **`gagent_instructions`: Author Instructions** · agent-doable · served row `1024` (genie-code fork, version 2)
   - Genie Code: Author one lean, rule-shaped instruction block for the Genie space — every brief guardrail as one plain-English rule — always including a `MEASURE()`-vs-detail routing rule and an explicit scope boundary, and cut anything that isn't load-bearing.
   - Expected output: one lean consolidated `text_instructions` block on the space; a `MEASURE()`-vs-detail routing rule and an explicit scope boundary are present; non-load-bearing lines were cut; the config validated (`_assert_sql_arrays`); the gate is recorded in `<STATE_FILE>`.
   - Gate: `Instructions authored` (served text), then `vibe_complete_step(gagent_instructions)`.
14. **`gagent_verified`: Add Verified Queries** · agent-doable · served row `1025` (genie-code fork, version 2)
   - Genie Code: Add 2-3 verified example queries for the questions my users ask most — each exact SQL over the governed Metric View via `MEASURE()`, run once to prove it returns before you save it to the space.
   - Expected output: 2-3 `example_question_sqls` saved to the space, each a `MEASURE()` query (metrics) or detail query with correct filters, each proved to return (real entity substituted if the brief's example is absent; relative time anchored); the gate is recorded in `<STATE_FILE>`.
   - Gate: `Verified queries saved` (served text), then `vibe_complete_step(gagent_verified)`.
15. **`gagent_benchmarks`: Load Benchmarks** · agent-doable · served row `1026` (genie-code fork, version 2)
   - Genie Code: Load 15 benchmark questions onto the space, attach an expected SQL answer to every one, self-check each answer's confidence, then STOP so I can verify the low-confidence ones before any is treated as validated.
   - Expected output: 15 benchmarks on the space, each with expected SQL in `answer[].content`; a metric question and a detail question are both present; each expected SQL executes; low-confidence answers are flagged for owner verification; nothing is treated as validated yet; the gate is recorded in `<STATE_FILE>`.
   - Gate: `Benchmarks loaded (pending verification)` (served text), then `vibe_complete_step(gagent_benchmarks)`. The one benchmark hard stop: `vibe_complete_step` returns `GATE_REQUIRED` until the learner answers the check. Answer it, then retry; the forge probe recorded this as an expected refusal (89ee6f0…-cleanup-140-profile.md L2).
16. **`gagent_optimize`: Optimize Loop** · agent-doable · served row `1027` (genie-code fork, version 2)
   - Genie Code: On the Genie Space page, run the native benchmark scorer, read per-question results, load the benchmark-failure-analysis skill, triage each miss to ONE append-only curation fix via the native tools, then re-run — 2-3 iterations — and report before/after. Aim for ~85%, don't chase 100%.
   - Expected output: benchmarks ran via the native scorer (`runBenchmarks`/`getBenchmarkResults`) on the Genie Space page (or the documented `ask_genie` fallback); each miss was triaged to ONE of the 6 fix modes applied with its native tool; fixes were **appended** (validated rules untouched); 2-3 iterations were run an…
   - Gate: `Agent optimized` (served text), then `vibe_complete_step(gagent_optimize)`.
17. **`gaccel_dashboard`: AI/BI Dashboard** · agent-doable · served row `940` (genie-code fork, version 1); v2 `1028` is held by D-61, so v1 is served
   - Genie Code: Build an AI/BI dashboard across the PRD-relevant Gold data using your native dashboard capability — governed `MEASURE()` tiles plus supporting detail — review the tile plan first, then inventory the tables it uses so Choose What to Activate knows what to sync.
   - Expected output: an AI/BI dashboard covering the PRD-relevant Gold data exists; governed measures use `MEASURE()`; the dashboard was opened on the canvas; the dashboard id and a table inventory (Gold dims + facts used) are recorded in `.vibecoding-state.md`.
   - Gate: `Dashboard live` (served text), then `vibe_complete_step(gaccel_dashboard)`.
18. **`gaccel_activation`: Choose What to Activate** · agent-doable · served row `941` (genie-code fork, version 1); v2 `1029` is held by D-61, so v1 is served
   - Genie Code: Choose what to activate — decide which Gold dimension + fact tables (and why) should feed the app and dashboard, never the Metric View itself — and record the approved selection for the Synced Tables sequence. Business selection only; keys, grain, dependency order, and sync modes are the next step's job.
   - Expected output: an approved list of Gold dims + facts to activate (not the MV), each with a one-line business reason, is recorded in `.vibecoding-state.md`. Keys, grain, dependency order, and sync modes are deliberately deferred to Design & Provision Synced Tables. No synced tables, app, or deploy at this beat.
   - Gate: `Activation planned` (served text), then `vibe_complete_step(gaccel_activation)`.
19. **`activation_table_design`: Design & Provision Synced Tables** · agent-doable · served row `924` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Resolve the target catalog (no-create invariant — HARD STOP if absent); Load the required skills by their FULL skill_ref_root-prefixed paths; Author the planning docs AND the Lakebase bundle resource (write only — do NOT deploy yet); Wire the new resource dir into the bundle include:; Open the bundle editor, then validate → summary → dep…
   - Expected output: `<artifact_root>/docs/reverse_etl.md` and `<artifact_root>/docs/activation_sync_plan.md` exist with all required fields (including the cost-control block and the `lakebase_host` from the endpoint GET), AND the Lakebase project + primary endpoint were **created by `bundle deploy`** (visible in `bundl…
   - Gate: `Synced tables planned` (served text), then `vibe_complete_step(activation_table_design)`.
20. **`activation_reverse_sync`: Create Synced Tables** · agent-doable · served row `925` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Read the plan docs (<artifact_root>-anchored paths, NOT @docs/…); Pre-flight: confirm the endpoint caps did not drift (read-only); Enable CDF on Delta sources for TRIGGERED candidates only (gated); Create each synced table via the REST client (dependency order); Poll the long-running operation to a healthy state; Verify row counts in Lak…
   - Expected output: every candidate in `<artifact_root>/docs/activation_sync_plan.md` was created via `w.api_client.do POST /api/2.0/postgres/synced_tables` (unwrapped `SyncedTable` body, `synced_table_id` query param), polled to a healthy `detailed_state` within the 15-minute cap (any bin-packed table triggered its sh…
   - Gate: `Synced tables live` (served text), then `vibe_complete_step(activation_reverse_sync)`.
21. **`activation_app_design`: Design Analytics App** · agent-doable · served row `926` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Read the inputs (<artifact_root>-anchored paths, NOT @docs/…); Load the design-quality skill by its FULL skill_ref_root-prefixed path; Decide extend vs greenfield (genie-rekeyed; apply it mechanically); Design the analytics pages (mock-data-first, every element sourced); Save the analytics design doc (write only — no build).
   - Expected output: `<artifact_root>/docs/analytics_ui_design.md` exists with pages, per-page KPIs/charts, data sources (`{user_schema_prefix}.<synced_table>` + columns), navigation, and the extend-vs-greenfield decision with file evidence; every visualization cites a synced Lakebase table from the sync plan; and a "Vi…
   - Gate: `Analytics app designed` (served text), then `vibe_complete_step(activation_app_design)`.
22. **`activation_build_wire`: Build Analytics App** · agent-doable · served row `927` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Derive APP_NAME and <APP_ROOT> (no auth login); Load the required skills by their FULL skill_ref_root-prefixed paths; Read the analytics design + decide extend vs greenfield; Author the analytics pages with the { data, source } mock envelope (files only — no server; Pre-handoff static gate (the only static check here).
   - Expected output: `<APP_ROOT>` contains a scaffolded/extended AppKit project (`app.yaml`, `databricks.yml` with `name: <APP_NAME>`, `server/server.ts` registering routes inside `onPluginsReady` and returning the `{ data, source: "mock" }` envelope, and `client/` analytics pages that fetch from those routes with loadi…
   - Gate: `Analytics app built (mock)` (served text), then `vibe_complete_step(activation_build_wire)`.
23. **`activation_wire_lakebase`: Wire to Lakebase** · agent-doable · served row `928` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Confirm APP_NAME, <APP_ROOT>, and the synced binding target; Load the wiring skill by its FULL skill_ref_root-prefixed path; Introspect the synced schema (read-only) → synced_schema.md; Register lakebase() and author READ-ONLY routes via onPluginsReady; Wire the frontend + ConnectionStatus; Static gate (the only local check) + deploy-tim…
   - Expected output: `<artifact_root>/docs/synced_schema.md` exists (read-only `information_schema` introspection of the `*_synced` tables), `<APP_ROOT>/server/server.ts` registers `lakebase()` from `@databricks/appkit` with READ-ONLY analytics routes (`SELECT` from `"{user_schema_prefix}".<synced_table>` only, using co…
   - Gate: `Analytics app live data (local)` (served text), then `vibe_complete_step(activation_wire_lakebase)`.
24. **`activation_wire_genie`: Wire Genie** · agent-doable · served row `957` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Confirm APP_NAME, <APP_ROOT>, and the Genie space id; Load the plugin skill by its FULL skill_ref_root-prefixed path; Register genie() in server.ts (canonical import; add to the plugins array); Set the space id (static) + declare the OBO scope (both required); Wire the GenieChat frontend panel; Static gate (the only local check) + deploy…
   - Expected output: `<APP_ROOT>/server/server.ts` imports `genie` from `@databricks/appkit` and registers `genie()` in the `plugins` array (no hand-mounted `/api/genie/*`, no manual `start()`), `app.yaml` carries a STATIC `DATABRICKS_GENIE_SPACE_ID` (= `{genie_space_id}`, no `valueFrom` binding), the client renders `Ge…
   - Gate: `Genie wired to app` (served text), then `vibe_complete_step(activation_wire_genie)`.
25. **`activation_deploy_validate`: Deploy & Validate** · agent-doable · served row `929` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Confirm APP_NAME and <APP_ROOT>, validate config; Pre-deploy cost re-check (READ-ONLY); Load the deploy skill by its FULL skill_ref_root-prefixed path; Pre-deploy static gate (cheapest possible check); Grant the app SP on the SYNCED schema, then deploy via the SDK SNAPSHOT path; Re-assert the app-SP Genie grants + re-apply the OBO scope …
   - Expected output: `w.apps.get(APP_NAME)` reports `compute_status.state: "ACTIVE"` with the latest deployment `SUCCEEDED`, the deployed `url` was reached through the OAuth session (browser or 3-hop `requests.Session()`) showing the React UI with ConnectionStatus "Live Data", every `/api/analytics/*` (and `/api/chat` i…
   - Gate: `Activation app deployed + validated` (served text), then `vibe_complete_step(activation_deploy_validate)`.
26. **`ontology_domain`: Model the Domain + Subdomains** · hybrid · flag `includeGenieOntology` · served row `1030` (genie-code fork, version 2)
   - Genie Code: Model a Genie Ontology domain with 3-5 subdomains in Databricks Discover (UI-preferred, or reuse a pre-created domain) and capture the domain and subdomain IDs.
   - Expected output: a Discover domain with 3–5 subdomains exists (created in the UI or reused from the workshop); its domain ID + subdomain IDs are recorded in `<STATE_FILE>`; no Pages authored yet.
   - Gate: `Domain modeled` (served text), then `vibe_complete_step(ontology_domain)`. Hybrid: the domain may be created in the UI.
27. **`ontology_pages`: Author Pages** · ui-driven · flag `includeGenieOntology` · served row `1031` (genie-code fork, version 2)
   - Genie Code: Draft Discover Pages for my top measures — plain-language definition, exact formula naming the Metric View, synonyms, at least one negative rule, chunk-safe sentences — for me to review and publish, then capture the Page IDs.
   - Expected output: two published Pages, each with a business-language definition, the exact formula naming the Metric View, a full synonym list (acronym/informal/legacy), ≥1 negative rule, and the Metric View as a related asset; every rule sentence is chunk-safe; drafts were reviewed before publish; Page IDs recorded …
   - Gate: `Pages published` (served text), then `vibe_complete_step(ontology_pages)`. UI-driven: `vibe_complete_step` returns `UI_DRIVEN_STEP`. The step is completed in the web app (the forge probe replayed it with `POST /api/session/update-metadata`, 89ee6f0… L2).
28. **`ontology_routing`: Write the Routing Page** · ui-driven · flag `includeGenieOntology` · served row `1032` (genie-code fork, version 2)
   - Genie Code: Author one Question-to-Metric-View Routing Page covering every inventory measure — four or five phrasings each (formal, acronym, informal, legacy) routed to the governed Metric View and exact measure — then name an owner, publish, and capture the Page ID.
   - Expected output: one published Routing Page covering every inventory measure as a flat phrasing→(Metric View, measure) table (including acronyms and legacy phrasings), with a short intro, the Metric View linked as a related asset, and a named owner; the draft was reviewed before publish; Page ID + owner recorded in …
   - Gate: `Routing Page published` (served text), then `vibe_complete_step(ontology_routing)`. UI-driven: `vibe_complete_step` returns `UI_DRIVEN_STEP`. Complete it in the web app (as ontology_pages).
29. **`iterate_enhance`: Iterate & Enhance** · agent-doable · served row `14` (default row, version 1)
   - Genie Code: LLM-generated over default row 14 (no genie-code fork: D-39). Row 14 lists potential enhancements and a six-step iteration process, and ends with an output contract for Redeploy & Test.
   - Expected output: an iteration plan with the row 14 output contract: Change Manifest, Smoke Tests (per enhancement), Regression-Risk Surface, Migrations / Order of Operations. Redeploy & Test (1002) consumes it as `{iteration_plan}`.
   - Gate: no **Gate:** line in row 14; complete with `vibe_complete_step(iterate_enhance)`. **Fail-open:** on every track, generation overruns the 90 s budget (generations run 107.7-133.6 s, then truncate), so the server serves row 14's assembled template, about 4,000 characters, instead of a generated plan (D-62; b260c64…-p4-llm-steps.md). Record whether you got the template.
30. **`redeploy_test`: Redeploy & Test** · agent-doable · served row `1002` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the skills by their FULL skill_ref_root-prefixed paths; Diff review; Pick the deploy mode from the manifest; Run migrations BEFORE the app deploy; Deploy and poll; On failure, diagnose and self-heal (max 3 iterations); Verify the delta, not the whole app; Update docs for the changed surface only; Close the loop on the state file.
   - Expected output: every enhancement smoke test passes at the correct gate state and the once-per-deploy health checks pass. A `SUCCEEDED` deploy or a green job run alone is not sufficient: the delta must have shipped through its deploy mechanism (SNAPSHOT for app code, `bundle deploy --target dev` for bundle resource…
   - Gate: `Redeployed + smoke passed` (served text), then `vibe_complete_step(redeploy_test)`.
31. **`workspace_cleanup`: Workspace Clean Up** · agent-doable · served row `1033` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Identity and the MINE rule; Discover and classify (read-only); STOP: confirm before anything is deleted; Delete what is MINE (only after confirm cleanup); Report and record the gate.
   - Expected output: the table was shown and the operator replied `confirm cleanup` before any delete; only rows the MINE rule marked MINE were deleted; every `not mine: skipped` row is untouched; the summary and gate are recorded in `<STATE_FILE>`.
   - Gate: `Workspace cleaned up` (served text), then `vibe_complete_step(workspace_cleanup)`. Destructive: run S4 before replying `confirm cleanup`.

#### app-only (7 steps)

1. **`project_setup`: Set Up Project** · agent-doable · served row virtual (mcp_server.py `_project_setup_content`)
   - Genie Code: No seed row: the server builds this step in mcp_server.py `_project_setup_content` (:980-1047). Genie Code runs the three commands of S1 (clone, publish skills, validate) in the Genie Code terminal, shows each command and its output, then re-verifies both paths with `os.path.exists` in one `executeCode` block and loads `skills/vibe-coding-workshop/skills/genie-code-environment/SKILL.md` with `readSkillFile`.
   - Expected output: The validate command prints `✅ 1/2 project cloned` and `✅ 2/2 skills published`; then 'Setup verified ✅' (mcp_server.py:1031-1036, `expected_output`).
   - Gate: two green checks; Genie Code must STOP if validation is not two green checks (:1015). Then `vibe_complete_step(project_setup)`. Expect this complete to take 17-38 s, because the next step's PRD prompt is generated inside the response (queue.md:18 complete-project-setup-latency).
2. **`prd_generation`: PRD Generation** · agent-doable · served row `1` (default row, version 1)
   - Genie Code: LLM-generated over default row 1 (prd_generation is a non-bypass tag; the server generates the step prompt from row 1's template within the 90 s budget, mcp_server.py:798). Row 1 asks for a prompt that creates a simple PRD for the locked use case.
   - Expected output: a PRD document saved under the project (row 1: "Create ONLY the PRD document").
   - Gate: row 1: "STOP after saving. Do not generate any code, tables, APIs, or proceed with other tasks." Then `vibe_complete_step(prd_generation)`. Requires the use_case_selection gate (manifest requiresGate). Budget evidence: 13/13 generated within budget, median 29.8 s (D-62).
3. **`cursor_copilot_ui_design`: UI Design** · agent-doable · served row `911` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Derive APP_NAME and <APP_ROOT> (no auth login); Load the required skills by their FULL skill_ref_root-prefixed paths; Scaffold the blank app INTO <APP_ROOT> (no local npm); Read the PRD; Author the UI with mock data (files only — no server); Pre-handoff static gate (the only static check here); Create the UI design document.
   - Expected output: `<APP_ROOT>` contains a scaffolded blank AppKit project (`app.yaml`, `databricks.yml` with `name: <APP_NAME>`, `server/server.ts` using `await createApp({ plugins: [server()] })`, and `client/` pages built from the PRD with mock data), the app is themed to the brand (`--primary`/`--secondary`/`--acc…
   - Gate: `App scaffolded + UI authored (deploy + verify deferred to step 05)` (served text), then `vibe_complete_step(cursor_copilot_ui_design)`.
4. **`deploy_databricks_app`: Deploy App** · agent-doable · served row `912` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Confirm APP_NAME and <APP_ROOT>, validate config; Load the deploy skill by its FULL skill_ref_root-prefixed path; Pre-deploy static gate (cheapest possible check); Register (if needed) and deploy via the SDK SNAPSHOT path; Verify the DEPLOYED app (not localhost).
   - Expected output: `w.apps.get(APP_NAME)` reports `compute_status.state: "ACTIVE"`, the latest deployment is `SUCCEEDED`, and the deployed `url` was reached through the OAuth session (browser or 3-hop `requests.Session()`) showing the React mock-data UI with no ERROR logs. Verification used the DEPLOYED URL — NO `http…
   - Gate: `App deployed (SDK SNAPSHOT) + live URL verified behind OAuth` (served text), then `vibe_complete_step(deploy_databricks_app)`.
5. **`iterate_enhance`: Iterate & Enhance** · agent-doable · served row `14` (default row, version 1)
   - Genie Code: LLM-generated over default row 14 (no genie-code fork: D-39). Row 14 lists potential enhancements and a six-step iteration process, and ends with an output contract for Redeploy & Test.
   - Expected output: an iteration plan with the row 14 output contract: Change Manifest, Smoke Tests (per enhancement), Regression-Risk Surface, Migrations / Order of Operations. Redeploy & Test (1002) consumes it as `{iteration_plan}`.
   - Gate: no **Gate:** line in row 14; complete with `vibe_complete_step(iterate_enhance)`. **Fail-open:** on every track, generation overruns the 90 s budget (generations run 107.7-133.6 s, then truncate), so the server serves row 14's assembled template, about 4,000 characters, instead of a generated plan (D-62; b260c64…-p4-llm-steps.md). Record whether you got the template.
6. **`redeploy_test`: Redeploy & Test** · agent-doable · served row `1002` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the skills by their FULL skill_ref_root-prefixed paths; Diff review; Pick the deploy mode from the manifest; Run migrations BEFORE the app deploy; Deploy and poll; On failure, diagnose and self-heal (max 3 iterations); Verify the delta, not the whole app; Update docs for the changed surface only; Close the loop on the state file.
   - Expected output: every enhancement smoke test passes at the correct gate state and the once-per-deploy health checks pass. A `SUCCEEDED` deploy or a green job run alone is not sufficient: the delta must have shipped through its deploy mechanism (SNAPSHOT for app code, `bundle deploy --target dev` for bundle resource…
   - Gate: `Redeployed + smoke passed` (served text), then `vibe_complete_step(redeploy_test)`.
7. **`workspace_cleanup`: Workspace Clean Up** · agent-doable · served row `1033` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Identity and the MINE rule; Discover and classify (read-only); STOP: confirm before anything is deleted; Delete what is MINE (only after confirm cleanup); Report and record the gate.
   - Expected output: the table was shown and the operator replied `confirm cleanup` before any delete; only rows the MINE rule marked MINE were deleted; every `not mine: skipped` row is untouched; the summary and gate are recorded in `<STATE_FILE>`.
   - Gate: `Workspace cleaned up` (served text), then `vibe_complete_step(workspace_cleanup)`. Destructive: run S4 before replying `confirm cleanup`.

#### lakehouse (11 steps)

1. **`project_setup`: Set Up Project** · agent-doable · served row virtual (mcp_server.py `_project_setup_content`)
   - Genie Code: No seed row: the server builds this step in mcp_server.py `_project_setup_content` (:980-1047). Genie Code runs the three commands of S1 (clone, publish skills, validate) in the Genie Code terminal, shows each command and its output, then re-verifies both paths with `os.path.exists` in one `executeCode` block and loads `skills/vibe-coding-workshop/skills/genie-code-environment/SKILL.md` with `readSkillFile`.
   - Expected output: The validate command prints `✅ 1/2 project cloned` and `✅ 2/2 skills published`; then 'Setup verified ✅' (mcp_server.py:1031-1036, `expected_output`).
   - Gate: two green checks; Genie Code must STOP if validation is not two green checks (:1015). Then `vibe_complete_step(project_setup)`. Expect this complete to take 17-38 s, because the next step's PRD prompt is generated inside the response (queue.md:18 complete-project-setup-latency).
2. **`prd_generation`: PRD Generation** · agent-doable · served row `1` (default row, version 1)
   - Genie Code: LLM-generated over default row 1 (prd_generation is a non-bypass tag; the server generates the step prompt from row 1's template within the 90 s budget, mcp_server.py:798). Row 1 asks for a prompt that creates a simple PRD for the locked use case.
   - Expected output: a PRD document saved under the project (row 1: "Create ONLY the PRD document").
   - Gate: row 1: "STOP after saving. Do not generate any code, tables, APIs, or proceed with other tasks." Then `vibe_complete_step(prd_generation)`. Requires the use_case_selection gate (manifest requiresGate). Budget evidence: 13/13 generated within budget, median 29.8 s (D-62).
3. **`bronze_table_metadata`: Bring your Metadata** · agent-doable · flag `medallion.bronze` · served row `5` (default row, version 1)
   - Genie Code: Default row 5 (no genie-code fork: D-41 judged it already client-aware). Run one `information_schema.columns` query against `{chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema}` and save the result as a CSV data dictionary.
   - Expected output: `<ARTIFACT_ROOT>/data_product_accelerator/context/{use_case_file_prefix}_Schema.csv` (row 5), which every later lakehouse step reads.
   - Gate: no **Gate:** line in row 5; complete when the CSV exists. Row 5's technical reference uses `databricks warehouses list | jq`, `databricks api post /api/2.0/sql/statements` and a `python3 << 'EOF'` heredoc. Record whether Genie Code runs these or substitutes `executeCode`.
4. **`bronze_layer_creation`: Bronze Layer Creation** · agent-doable · flag `medallion.bronze` · served row `901` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Resolve the target catalog (no-create invariant — HARD STOP if absent); Load the required skills by their FULL skill_ref_root-prefixed paths; Author the bundle (Approach C — copy sample data). Do NOT execute anything yet.; Write bundle files to <DP_BUNDLE_ROOT>, then deploy FROM that page.
   - Expected output: the Bronze clone job was **created by `bundle deploy` and executed by `bundle run`** (the job is visible in Workflows and returned a successful run ID), AND every source table is present in `{lakehouse_default_catalog}.{user_schema_prefix}_bronze` with Change Data Feed enabled. Tables existing + CDF…
   - Gate: `Bronze layer live` (served text), then `vibe_complete_step(bronze_layer_creation)`.
5. **`silver_layer_sdp`: Silver Layer** · agent-doable · flag `medallion.silver` · served row `902` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the required skills by their FULL skill_ref_root-prefixed paths; Pin the Bronze column inventory (read-only hard gate — do this BEFORE writing any DQ rule ; Author the Silver bundle (SDP + centralized DQ rules). Do NOT execute anything yet.; Write bundle files to <DP_BUNDLE_ROOT>, then deploy FROM that page.
   - Expected output: the DQ-rules setup job and the Silver pipeline were **created by `bundle deploy` and executed by `bundle run`** (the setup job ran first and the pipeline shows expectations evaluated in its event log), AND the Silver tables exist in `{lakehouse_default_catalog}.{user_schema_prefix}_silver` with the …
   - Gate: `Silver layer live` (served text), then `vibe_complete_step(silver_layer_sdp)`.
6. **`gold_layer_design`: Gold Layer Design** · agent-doable · flag `medallion.gold` · served row `903` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the required skills by their FULL skill_ref_root-prefixed paths; Run the design workflow, writing every artifact under <DP_BUNDLE_ROOT>/gold_layer_design/.
   - Expected output: `<DP_BUNDLE_ROOT>/gold_layer_design/` contains the FULL mandatory deliverables set from the orchestrator's deliverables checklist: `DESIGN_DECISIONS.md` (written before any YAML), one YAML per Gold table under `yaml/{domain}/`, the master ERD, `COLUMN_LINEAGE.csv` (+ `COLUMN_LINEAGE.md`), `SOURCE_TA…
   - Gate: `Gold design complete` (served text), then `vibe_complete_step(gold_layer_design)`.
7. **`gold_layer_pipeline`: Gold Pipeline** · agent-doable · flag `medallion.gold` · served row `904` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the required skills by their FULL skill_ref_root-prefixed paths; Pin the Silver column inventory (read-only hard gate — do this BEFORE writing merge_gold_t; Author the Gold bundle (YAML-driven 2-job architecture). Do NOT execute anything yet.; Write bundle files to <DP_BUNDLE_ROOT>, then deploy FROM that page.
   - Expected output: `gold_setup_job` (both tasks) and `gold_merge_job` (both tasks — `merge` then `validate_gold`) were **created by `bundle deploy` and executed by `bundle run`** (the setup job ran first and the merge job populated data), the `validate_gold` task PASSED (PKs/FKs/NOT NULL/CDF/row-tracking all still pre…
   - Gate: `Gold layer live` (served text), then `vibe_complete_step(gold_layer_pipeline)`.
8. **`deploy_lakehouse_assets`: Deploy Assets** · agent-doable · served row `905` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the required skills by their FULL skill_ref_root-prefixed paths; Deploy and run the whole pipeline FROM the bundle editor; Verify end-to-end (read-only).
   - Expected output: all five jobs (`bronze_clone_job`, `silver_dq_setup_job`, `silver_dlt_pipeline`, `gold_setup_job`, `gold_merge_job`) were **deployed by `bundle deploy` and executed by `bundle run`** in dependency order end-to-end, AND the Bronze/Silver/Gold schemas in `{lakehouse_default_catalog}` are populated (`d…
   - Gate: `Lakehouse assets deployed` (served text), then `vibe_complete_step(deploy_lakehouse_assets)`.
9. **`iterate_enhance`: Iterate & Enhance** · agent-doable · served row `14` (default row, version 1)
   - Genie Code: LLM-generated over default row 14 (no genie-code fork: D-39). Row 14 lists potential enhancements and a six-step iteration process, and ends with an output contract for Redeploy & Test.
   - Expected output: an iteration plan with the row 14 output contract: Change Manifest, Smoke Tests (per enhancement), Regression-Risk Surface, Migrations / Order of Operations. Redeploy & Test (1002) consumes it as `{iteration_plan}`.
   - Gate: no **Gate:** line in row 14; complete with `vibe_complete_step(iterate_enhance)`. **Fail-open:** on every track, generation overruns the 90 s budget (generations run 107.7-133.6 s, then truncate), so the server serves row 14's assembled template, about 4,000 characters, instead of a generated plan (D-62; b260c64…-p4-llm-steps.md). Record whether you got the template.
10. **`redeploy_test`: Redeploy & Test** · agent-doable · served row `1002` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the skills by their FULL skill_ref_root-prefixed paths; Diff review; Pick the deploy mode from the manifest; Run migrations BEFORE the app deploy; Deploy and poll; On failure, diagnose and self-heal (max 3 iterations); Verify the delta, not the whole app; Update docs for the changed surface only; Close the loop on the state file.
   - Expected output: every enhancement smoke test passes at the correct gate state and the once-per-deploy health checks pass. A `SUCCEEDED` deploy or a green job run alone is not sufficient: the delta must have shipped through its deploy mechanism (SNAPSHOT for app code, `bundle deploy --target dev` for bundle resource…
   - Gate: `Redeployed + smoke passed` (served text), then `vibe_complete_step(redeploy_test)`.
11. **`workspace_cleanup`: Workspace Clean Up** · agent-doable · served row `1033` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Identity and the MINE rule; Discover and classify (read-only); STOP: confirm before anything is deleted; Delete what is MINE (only after confirm cleanup); Report and record the gate.
   - Expected output: the table was shown and the operator replied `confirm cleanup` before any delete; only rows the MINE rule marked MINE were deleted; every `not mine: skipped` row is untouched; the summary and gate are recorded in `<STATE_FILE>`.
   - Gate: `Workspace cleaned up` (served text), then `vibe_complete_step(workspace_cleanup)`. Destructive: run S4 before replying `confirm cleanup`.

#### agents-accelerator (29 steps)

1. **`project_setup`: Set Up Project** · agent-doable · served row virtual (mcp_server.py `_project_setup_content`)
   - Genie Code: No seed row: the server builds this step in mcp_server.py `_project_setup_content` (:980-1047). Genie Code runs the three commands of S1 (clone, publish skills, validate) in the Genie Code terminal, shows each command and its output, then re-verifies both paths with `os.path.exists` in one `executeCode` block and loads `skills/vibe-coding-workshop/skills/genie-code-environment/SKILL.md` with `readSkillFile`.
   - Expected output: The validate command prints `✅ 1/2 project cloned` and `✅ 2/2 skills published`; then 'Setup verified ✅' (mcp_server.py:1031-1036, `expected_output`).
   - Gate: two green checks; Genie Code must STOP if validation is not two green checks (:1015). Then `vibe_complete_step(project_setup)`. Expect this complete to take 17-38 s, because the next step's PRD prompt is generated inside the response (queue.md:18 complete-project-setup-latency).
2. **`prd_generation`: PRD Generation** · agent-doable · served row `1` (default row, version 1)
   - Genie Code: LLM-generated over default row 1 (prd_generation is a non-bypass tag; the server generates the step prompt from row 1's template within the 90 s budget, mcp_server.py:798). Row 1 asks for a prompt that creates a simple PRD for the locked use case.
   - Expected output: a PRD document saved under the project (row 1: "Create ONLY the PRD document").
   - Gate: row 1: "STOP after saving. Do not generate any code, tables, APIs, or proceed with other tasks." Then `vibe_complete_step(prd_generation)`. Requires the use_case_selection gate (manifest requiresGate). Budget evidence: 13/13 generated within budget, median 29.8 s (D-62).
3. **`cursor_copilot_ui_design`: UI Design** · agent-doable · served row `911` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Derive APP_NAME and <APP_ROOT> (no auth login); Load the required skills by their FULL skill_ref_root-prefixed paths; Scaffold the blank app INTO <APP_ROOT> (no local npm); Read the PRD; Author the UI with mock data (files only — no server); Pre-handoff static gate (the only static check here); Create the UI design document.
   - Expected output: `<APP_ROOT>` contains a scaffolded blank AppKit project (`app.yaml`, `databricks.yml` with `name: <APP_NAME>`, `server/server.ts` using `await createApp({ plugins: [server()] })`, and `client/` pages built from the PRD with mock data), the app is themed to the brand (`--primary`/`--secondary`/`--acc…
   - Gate: `App scaffolded + UI authored (deploy + verify deferred to step 05)` (served text), then `vibe_complete_step(cursor_copilot_ui_design)`.
4. **`deploy_databricks_app`: Deploy App** · agent-doable · served row `912` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Confirm APP_NAME and <APP_ROOT>, validate config; Load the deploy skill by its FULL skill_ref_root-prefixed path; Pre-deploy static gate (cheapest possible check); Register (if needed) and deploy via the SDK SNAPSHOT path; Verify the DEPLOYED app (not localhost).
   - Expected output: `w.apps.get(APP_NAME)` reports `compute_status.state: "ACTIVE"`, the latest deployment is `SUCCEEDED`, and the deployed `url` was reached through the OAuth session (browser or 3-hop `requests.Session()`) showing the React mock-data UI with no ERROR logs. Verification used the DEPLOYED URL — NO `http…
   - Gate: `App deployed (SDK SNAPSHOT) + live URL verified behind OAuth` (served text), then `vibe_complete_step(deploy_databricks_app)`.
5. **`setup_lakebase`: Setup Lakebase** · agent-doable · served row `922` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Confirm APP_NAME, <APP_ROOT>, and derive DB_SCHEMA; Load the Lakebase skill by its FULL skill_ref_root-prefixed path; Add the Lakebase dependency to package.json (no local install); Configure app.yaml for valueFrom: postgres; Provision the Lakebase project over REST and bind it to the app; Validate configuration locally (no apps validate…
   - Expected output: `<APP_ROOT>/package.json` lists `@databricks/lakebase`, `package-lock.json` is intact, `app.yaml` has `LAKEBASE_ENDPOINT` with `valueFrom: postgres` and a static `DB_SCHEMA`, the Lakebase project reports `ACTIVE`, and the app's `postgres` resource is bound (`PATCH`/`update` confirmed). `server.ts` i…
   - Gate: `Lakebase package + app.yaml configured, project provisioned + bound (REST)` (served text), then `vibe_complete_step(setup_lakebase)`.
6. **`wire_ui_lakebase`: Wire UI to Lakebase** · agent-doable · served row `923` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Confirm APP_NAME, <APP_ROOT>, and DB_SCHEMA; Load the wiring skill by its FULL skill_ref_root-prefixed path; Register lakebase() and author DDL + routes via onPluginsReady; Wire the frontend; Static gate (the only local check) + deploy-time build.
   - Expected output: `<APP_ROOT>/server/server.ts` registers `lakebase()` from `@databricks/appkit` with DDL + seed + `appkit.server.extend(...)` routes inside `onPluginsReady` (no `autoStart: false`, no manual `start()`), the frontend fetches via `useLakebaseData` with mock fallback, and the wiring static scan prints `…
   - Gate: `Lakebase wired (onPluginsReady) + static gate clean; build deferred to deploy` (served text), then `vibe_complete_step(wire_ui_lakebase)`.
7. **`workspace_setup_deploy`: Deploy and Test** · agent-doable · served row `1001` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Confirm APP_NAME and <APP_ROOT>; Confirm the Lakebase preconditions (read-only, before deploying); Deploy via the SDK SNAPSHOT path (SP creates database objects); Test all backend APIs (3-hop OAuth session, not a raw bearer token); Check logs and fix Lakebase errors (up to 3 iterations); Idle connection test (CRITICAL); Human render chec…
   - Expected output: the Lakebase-wired app is deployed (SDK SNAPSHOT) and RUNNING (`compute_status.state: "ACTIVE"`), the health endpoint reports source live through the OAuth session, and the idle-resilience re-test still reports live. Verification used the DEPLOYED URL — NO local server was run and NO database object…
   - Gate: `Infrastructure healthy` (served text), then `vibe_complete_step(workspace_setup_deploy)`.
8. **`agent_spec_design`: Agent Spec Design** · agent-doable · served row `1007` (genie-code fork, version 1)
   - Genie Code: You are a Databricks GenAI agent designer. Author the **Agent Spec** for the **{use_case_slug}** agent — a YAML design artifact at `<ARTIFACT_ROOT>/docs/agent_spec.yaml` that captures intent (purpose, personas, capabilities, model endpoint, MCPs, eval seeds, governance) before any code is written.
   - Expected output: Create ONLY `<ARTIFACT_ROOT>/docs/agent_spec.yaml` and STOP
   - Gate: `vibe_complete_step(agent_spec_design)` after the served STOP.
9. **`agent_tool_selection`: Agent Tool Selection** · agent-doable · served row `1008` (genie-code fork, version 1)
   - Genie Code: You are a Databricks GenAI agent designer. Author the **Agent Tool Plan** for the **{use_case_slug}** agent — a YAML design artifact at `<ARTIFACT_ROOT>/docs/agent_tool_plan.yaml` that pins the user-confirmed tool backends (managed MCPs, optional Knowledge Assistant, dynamic SQL MCP) and preserves the Agent Spec's `agent.model` under a Gateway-ready runtime route.
   - Expected output: Create ONLY `<ARTIFACT_ROOT>/docs/agent_tool_plan.yaml` and STOP
   - Gate: `Agent tool plan ready` (served text), then `vibe_complete_step(agent_tool_selection)`.
10. **`uc_resources_foundation`: UC Resources Foundation** · agent-doable · served row `1009` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your roots and enter (once, before anything else); Load the skills by their FULL skill_ref_root-prefixed paths; Hydrate state from the design pair; Derive user-scoped names; Provision the schemas + volumes exactly as the skill prescribes; Verify (read-only).
   - Expected output: both schemas exist (`SHOW SCHEMAS IN {lakehouse_default_catalog}` lists them), every entry in `uc_volumes` is reachable via `WorkspaceClient.volumes.read(...)`, and `knowledge_source_path` points to `/Volumes/{lakehouse_default_catalog}/{db_schema}_agent/{db_schema}_knowledge_sources`. Pre-existing …
   - Gate: `UC resources ready` (served text), then `vibe_complete_step(uc_resources_foundation)`. Runs the D-56 RULE_10 foundation carve-out: literal `CREATE SCHEMA/VOLUME IF NOT EXISTS` on the `{db_schema}`-prefixed names (queue.md:55). See S6 (D-67): Genie Code may refuse it because of TPL skills/genie-code-environment/SKILL.md:368.
11. **`mlflow_agent_tracing_uc`: MLflow Tracing + UC OTel** · agent-doable · served row `1010` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your roots and enter (once, before anything else); Load the skills by their FULL skill_ref_root-prefixed paths; Run the two skills in executeCode; Smoke-test the trace pipe (read-only check).
   - Expected output: `mlflow[databricks] >= 3.10.1` installed, autolog enabled, experiment visible at `{mlflow_experiment_path}`, 4 UC OTel Delta tables created in `{lakehouse_default_catalog}.{db_schema}_agent`, test trace visible in UC.
   - Gate: `Tracing live; UC OTel tables ready` (served text), then `vibe_complete_step(mlflow_agent_tracing_uc)`.
12. **`knowledge_assistant_create`: Knowledge Assistant** · agent-doable · served row `913` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Skip cleanly if KA is not selected; Load the required skills by their FULL skill_ref_root-prefixed paths; Stage source documents into the UC volume; Get-or-create the KA + source, sync, poll (all via w.api_client.do); Verify (read-only).
   - Expected output: `sync_status == "READY"`, `knowledge_source_file_count >= 1`, `ka_endpoint_name` and `knowledge_assistant_id` captured into state, KA reachable from a read-only `w.serving_endpoints.get(...)` smoke call — OR `Skipped - KA not selected` when the Tool Plan did not select KA. The KA existing is necessa…
   - Gate: `KA READY` (served text), then `vibe_complete_step(knowledge_assistant_create)`.
13. **`track_a_agent_app_clone_framework`: Clone + Framework** · agent-doable · served row `914` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the required skills by their FULL skill_ref_root-prefixed paths; Clone + author under <AGENT_APP_ROOT> (write files only); In-process "Hello" smoke + MLflow span check (NOT localhost).
   - Expected output: the cloned app under `<AGENT_APP_ROOT>` responds to an **in-process** "Hello" with MLflow AGENT spans visible at `{mlflow_experiment_path}`; `config.yml` carries `llm_endpoint`/`llm_api_base_url`/`llm_api_mode` from `runtime_config.llm`; the agent uses `ModelConfig(development_config="config.yml")` …
   - Gate: `Agent framework live` (served text), then `vibe_complete_step(track_a_agent_app_clone_framework)`.
14. **`track_a_agent_ka_genie_tools`: Tools and MCP** · agent-doable · served row `915` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the required skills by their FULL skill_ref_root-prefixed paths; Author tools + grants under <AGENT_APP_ROOT> (write files only); In-process per-tool TOOL-span smoke (NOT localhost).
   - Expected output: MLflow traces show one TOOL span per selected tool in `docs/agent_tool_plan.yaml.selected_tools[]` (asserted **in-process**, not via a local server); skipped families are marked skipped not failed; SQL smoke used read-only queries with fully-qualified table names; `databricks.yml`/`app.yaml` carry t…
   - Gate: `Tools wired` (served text), then `vibe_complete_step(track_a_agent_ka_genie_tools)`.
15. **`track_a_agent_auth_memory`: Auth + Memory** · agent-doable · served row `916` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the required skills by their FULL skill_ref_root-prefixed paths; Author auth + memory under <AGENT_APP_ROOT> (write files only); In-process OBO/SP + memory probes (NOT localhost).
   - Expected output: OBO and SP probes both pass **in-process**; same-thread turn 2 references turn 1; a fact stated in thread A is recalled in fresh thread B for the same user. NO `http://localhost:8000` check was attempted.
   - Gate: `Auth + Memory verified` (served text), then `vibe_complete_step(track_a_agent_auth_memory)`.
16. **`track_a_agent_eval_deploy`: Smoke Eval + Deploy** · agent-doable · served row `917` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the required skills by their FULL skill_ref_root-prefixed paths; Run the fail-closed smoke eval (in-session uv); Bundle-deploy the resource grants (from the bundle-editor page); Deploy the app host via the SDK SNAPSHOT path (server-side build); Post-deploy probes against the DEPLOYED /invocations (3-hop OAuth).
   - Expected output: smoke eval pass/fail visible in MLflow AND none of the four fail-closed conditions tripped; the bundle's resource grants deployed via `bundle deploy` from the bundle-editor page; the app host deployed via the SDK SNAPSHOT call (server-side `uv`/FastAPI build) with compute `ACTIVE`; the deployed `/in…
   - Gate: `Agent App RUNNING` (served text), then `vibe_complete_step(track_a_agent_eval_deploy)`.
17. **`appkit_agent_app_proxy_chat`: AppKit Agent Proxy** · agent-doable · served row `918` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the required skills by their FULL skill_ref_root-prefixed paths; Author the proxy + grants under <APP_ROOT> (write files only); Redeploy via SDK SNAPSHOT, then run the 3-probe e2e (OAuth).
   - Expected output: `/chat` streams chat against the Agent App with OBO forwarding; all three probes pass via the 3-hop OAuth session against the DEPLOYED URLs. NO bash test script, NO `curl`+`auth token`, NO localhost check was used.
   - Gate: `AppKit ↔ Agent App proxy live` (served text), then `vibe_complete_step(appkit_agent_app_proxy_chat)`.
18. **`appkit_chat_feedback_mlflow`: Chat Feedback to MLflow** · agent-doable · served row `919` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the required skills by their FULL skill_ref_root-prefixed paths; Author chat history + feedback (write files only); Redeploy both hosts via SDK SNAPSHOT, then verify (OAuth).
   - Expected output: sidebar + history works; thumbs up/down linked to MLflow traces via `mlflow.log_feedback(...)` from the Track A Agent App; an end-to-end 👎 round-trip shows up in the MLflow trace UI (verified through the 3-hop OAuth session against the DEPLOYED URL); the app survives 3-5 min idle. NO localhost check…
   - Gate: `Deployed + idle resilience passed + 04c round-trip verified` (served text), then `vibe_complete_step(appkit_chat_feedback_mlflow)`.
19. **`mlflow_prompt_registry`: Prompt Registry** · agent-doable · served row `1011` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your roots and enter (once, before anything else); Load the skills by their FULL skill_ref_root-prefixed paths; Run the skill in executeCode.
   - Expected output: every prompt the agent loads is now governed in UC and addressable via `prompts://...@alias` instead of inline strings.
   - Gate: `Prompts registered in UC; @production and @staging aliases set` (served text), then `vibe_complete_step(mlflow_prompt_registry)`.
20. **`mlflow_evaluation_datasets`: Evaluation Datasets** · agent-doable · served row `1012` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your roots and enter (once, before anything else); Load the skills by their FULL skill_ref_root-prefixed paths; Run the skill in executeCode.
   - Expected output: the benchmark table at `{lakehouse_default_catalog}.{db_schema}_agent.{agent_resource_prefix}_benchmarks` is the single source of truth for scorers (input_id 211) and eval runs (input_id 212). Coverage assertion holds across THREE axes: every `agent.benchmark_seeds.coverage_buckets[]`, every `ui.use…
   - Gate: `≥ 20 benchmark rows; every user journey covered` (served text), then `vibe_complete_step(mlflow_evaluation_datasets)`.
21. **`mlflow_scorers_and_judges`: Scorers and Judges** · agent-doable · served row `1013` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your roots and enter (once, before anything else); Load the skills by their FULL skill_ref_root-prefixed paths; Run the skill in executeCode.
   - Expected output: every scorer the use case needs (builtins + Guidelines + custom code scorers + LLM judges from the Spec) UNIONED with every tool-shaped scorer hint from `<ARTIFACT_ROOT>/docs/agent_tool_plan.yaml.runtime_guardrails.tool_shaped_scorers[]` is registered against `{mlflow_experiment_path}` with explicit…
   - Gate: `Scorer suite registered with thresholds` (served text), then `vibe_complete_step(mlflow_scorers_and_judges)`.
22. **`mlflow_evaluation_runs_and_iteration`: Evaluation Runs + Iteration** · agent-doable · served row `1014` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your roots and enter (once, before anything else); Load the skills by their FULL skill_ref_root-prefixed paths; Run the skill in executeCode.
   - Expected output: see the gate
   - Gate: `<Eval thresholds met | Eval regressed — iterate>` (served text), then `vibe_complete_step(mlflow_evaluation_runs_and_iteration)`.
23. **`mlflow_human_review_and_signoff`: Human Review + Sign-off** · agent-doable · served row `1015` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your roots and enter (once, before anything else); Load the skills by their FULL skill_ref_root-prefixed paths; Build the labeling session in executeCode; SME handoff (STOP); Sync the labels back (after the operator confirms); Stakeholder sign-off.
   - Expected output: see the gate
   - Gate: `<Signoff APPROVED | Signoff REJECTED — block promotion>` (served text), then `vibe_complete_step(mlflow_human_review_and_signoff)`. Row 1015 stops for the SME (Step 3, "SME handoff (STOP)"); the labels are synced only after the operator confirms. The manifest serves this step as agent-doable (D-52b, queue.md:66).
24. **`mlflow_logged_model_uc_registration`: Logged Model & UC Registration** · agent-doable · served row `1016` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your roots and enter (once, before anything else); Load the skills by their FULL skill_ref_root-prefixed paths; Run the skills in executeCode.
   - Expected output: the agent is logged via `mlflow.models.log_model`, registered at `{lakehouse_default_catalog}.{db_schema}_agent.{agent_resource_prefix}`, and the `@champion` alias is moved to the new version IFF eval scores are ≥ the prior champion. Promotion is hard-asserted on `signoff_decision == APPROVED` from …
   - Gate: `@champion set` (served text), then `vibe_complete_step(mlflow_logged_model_uc_registration)`.
25. **`mlflow_gateway_and_deployment`: AI Gateway + Deployment** · agent-doable · served row `920` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the required skills by their FULL skill_ref_root-prefixed paths; Gateway route or clean skip, then patch the bundle (write files only); DAB deploy from the bundle-editor page (only when not skipped).
   - Expected output: if a pre-provisioned Gateway exists, the agent routes through `{ai_gateway_endpoint}`, the DAB deploy ran via `bundle deploy` from the bundle-editor page, and `databricks_request_id` correlates traces to Gateway inference tables; otherwise `ai_gateway_status: "skipped_unavailable"` is recorded and t…
   - Gate: `Optional gateway route configured or skipped` (served text), then `vibe_complete_step(mlflow_gateway_and_deployment)`.
26. **`mlflow_production_monitoring_and_debugging`: Production Monitoring + Debugging** · agent-doable · served row `921` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the required skills by their FULL skill_ref_root-prefixed paths; SDK scorers + agent-as-judge categorizer (run via executeCode); Deploy the trace-archival / backfill job from the bundle-editor page; SQL alerts (≥ 4) via runDatabricksCli.
   - Expected output: continuous-eval scorers (registered via `executeCode`, confirmed via `get_scheduled_scorers`) sample production traces against `governance.scorer_suite.production_scorers[]`; ≥ 4 SQL alerts are configured; the trace-archival/backfill job was deployed via `bundle deploy` from the bundle-editor page; …
   - Gate: `alerts wired; agent-as-judge running` (served text), then `vibe_complete_step(mlflow_production_monitoring_and_debugging)`.
27. **`iterate_enhance`: Iterate & Enhance** · agent-doable · served row `14` (default row, version 1)
   - Genie Code: LLM-generated over default row 14 (no genie-code fork: D-39). Row 14 lists potential enhancements and a six-step iteration process, and ends with an output contract for Redeploy & Test.
   - Expected output: an iteration plan with the row 14 output contract: Change Manifest, Smoke Tests (per enhancement), Regression-Risk Surface, Migrations / Order of Operations. Redeploy & Test (1002) consumes it as `{iteration_plan}`.
   - Gate: no **Gate:** line in row 14; complete with `vibe_complete_step(iterate_enhance)`. **Fail-open:** on every track, generation overruns the 90 s budget (generations run 107.7-133.6 s, then truncate), so the server serves row 14's assembled template, about 4,000 characters, instead of a generated plan (D-62; b260c64…-p4-llm-steps.md). Record whether you got the template.
28. **`redeploy_test`: Redeploy & Test** · agent-doable · served row `1002` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the skills by their FULL skill_ref_root-prefixed paths; Diff review; Pick the deploy mode from the manifest; Run migrations BEFORE the app deploy; Deploy and poll; On failure, diagnose and self-heal (max 3 iterations); Verify the delta, not the whole app; Update docs for the changed surface only; Close the loop on the state file.
   - Expected output: every enhancement smoke test passes at the correct gate state and the once-per-deploy health checks pass. A `SUCCEEDED` deploy or a green job run alone is not sufficient: the delta must have shipped through its deploy mechanism (SNAPSHOT for app code, `bundle deploy --target dev` for bundle resource…
   - Gate: `Redeployed + smoke passed` (served text), then `vibe_complete_step(redeploy_test)`.
29. **`workspace_cleanup`: Workspace Clean Up** · agent-doable · served row `1033` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Identity and the MINE rule; Discover and classify (read-only); STOP: confirm before anything is deleted; Delete what is MINE (only after confirm cleanup); Report and record the gate.
   - Expected output: the table was shown and the operator replied `confirm cleanup` before any delete; only rows the MINE rule marked MINE were deleted; every `not mine: skipped` row is untouched; the summary and gate are recorded in `<STATE_FILE>`.
   - Gate: `Workspace cleaned up` (served text), then `vibe_complete_step(workspace_cleanup)`. Destructive: run S4 before replying `confirm cleanup`.

#### reverse-app (23 steps)

1. **`project_setup`: Set Up Project** · agent-doable · served row virtual (mcp_server.py `_project_setup_content`)
   - Genie Code: No seed row: the server builds this step in mcp_server.py `_project_setup_content` (:980-1047). Genie Code runs the three commands of S1 (clone, publish skills, validate) in the Genie Code terminal, shows each command and its output, then re-verifies both paths with `os.path.exists` in one `executeCode` block and loads `skills/vibe-coding-workshop/skills/genie-code-environment/SKILL.md` with `readSkillFile`.
   - Expected output: The validate command prints `✅ 1/2 project cloned` and `✅ 2/2 skills published`; then 'Setup verified ✅' (mcp_server.py:1031-1036, `expected_output`).
   - Gate: two green checks; Genie Code must STOP if validation is not two green checks (:1015). Then `vibe_complete_step(project_setup)`. Expect this complete to take 17-38 s, because the next step's PRD prompt is generated inside the response (queue.md:18 complete-project-setup-latency).
2. **`prd_generation`: PRD Generation** · agent-doable · served row `1` (default row, version 1)
   - Genie Code: LLM-generated over default row 1 (prd_generation is a non-bypass tag; the server generates the step prompt from row 1's template within the 90 s budget, mcp_server.py:798). Row 1 asks for a prompt that creates a simple PRD for the locked use case.
   - Expected output: a PRD document saved under the project (row 1: "Create ONLY the PRD document").
   - Gate: row 1: "STOP after saving. Do not generate any code, tables, APIs, or proceed with other tasks." Then `vibe_complete_step(prd_generation)`. Requires the use_case_selection gate (manifest requiresGate). Budget evidence: 13/13 generated within budget, median 29.8 s (D-62).
3. **`bronze_table_metadata`: Bring your Metadata** · agent-doable · flag `medallion.bronze` · served row `5` (default row, version 1)
   - Genie Code: Default row 5 (no genie-code fork: D-41 judged it already client-aware). Run one `information_schema.columns` query against `{chapter_3_lakehouse_catalog}.{chapter_3_lakehouse_schema}` and save the result as a CSV data dictionary.
   - Expected output: `<ARTIFACT_ROOT>/data_product_accelerator/context/{use_case_file_prefix}_Schema.csv` (row 5), which every later lakehouse step reads.
   - Gate: no **Gate:** line in row 5; complete when the CSV exists. Row 5's technical reference uses `databricks warehouses list | jq`, `databricks api post /api/2.0/sql/statements` and a `python3 << 'EOF'` heredoc. Record whether Genie Code runs these or substitutes `executeCode`.
4. **`bronze_layer_creation`: Bronze Layer Creation** · agent-doable · flag `medallion.bronze` · served row `901` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Resolve the target catalog (no-create invariant — HARD STOP if absent); Load the required skills by their FULL skill_ref_root-prefixed paths; Author the bundle (Approach C — copy sample data). Do NOT execute anything yet.; Write bundle files to <DP_BUNDLE_ROOT>, then deploy FROM that page.
   - Expected output: the Bronze clone job was **created by `bundle deploy` and executed by `bundle run`** (the job is visible in Workflows and returned a successful run ID), AND every source table is present in `{lakehouse_default_catalog}.{user_schema_prefix}_bronze` with Change Data Feed enabled. Tables existing + CDF…
   - Gate: `Bronze layer live` (served text), then `vibe_complete_step(bronze_layer_creation)`.
5. **`silver_layer_sdp`: Silver Layer** · agent-doable · flag `medallion.silver` · served row `902` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the required skills by their FULL skill_ref_root-prefixed paths; Pin the Bronze column inventory (read-only hard gate — do this BEFORE writing any DQ rule ; Author the Silver bundle (SDP + centralized DQ rules). Do NOT execute anything yet.; Write bundle files to <DP_BUNDLE_ROOT>, then deploy FROM that page.
   - Expected output: the DQ-rules setup job and the Silver pipeline were **created by `bundle deploy` and executed by `bundle run`** (the setup job ran first and the pipeline shows expectations evaluated in its event log), AND the Silver tables exist in `{lakehouse_default_catalog}.{user_schema_prefix}_silver` with the …
   - Gate: `Silver layer live` (served text), then `vibe_complete_step(silver_layer_sdp)`.
6. **`gold_layer_design`: Gold Layer Design** · agent-doable · flag `medallion.gold` · served row `903` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the required skills by their FULL skill_ref_root-prefixed paths; Run the design workflow, writing every artifact under <DP_BUNDLE_ROOT>/gold_layer_design/.
   - Expected output: `<DP_BUNDLE_ROOT>/gold_layer_design/` contains the FULL mandatory deliverables set from the orchestrator's deliverables checklist: `DESIGN_DECISIONS.md` (written before any YAML), one YAML per Gold table under `yaml/{domain}/`, the master ERD, `COLUMN_LINEAGE.csv` (+ `COLUMN_LINEAGE.md`), `SOURCE_TA…
   - Gate: `Gold design complete` (served text), then `vibe_complete_step(gold_layer_design)`.
7. **`gold_layer_pipeline`: Gold Pipeline** · agent-doable · flag `medallion.gold` · served row `904` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the required skills by their FULL skill_ref_root-prefixed paths; Pin the Silver column inventory (read-only hard gate — do this BEFORE writing merge_gold_t; Author the Gold bundle (YAML-driven 2-job architecture). Do NOT execute anything yet.; Write bundle files to <DP_BUNDLE_ROOT>, then deploy FROM that page.
   - Expected output: `gold_setup_job` (both tasks) and `gold_merge_job` (both tasks — `merge` then `validate_gold`) were **created by `bundle deploy` and executed by `bundle run`** (the setup job ran first and the merge job populated data), the `validate_gold` task PASSED (PKs/FKs/NOT NULL/CDF/row-tracking all still pre…
   - Gate: `Gold layer live` (served text), then `vibe_complete_step(gold_layer_pipeline)`.
8. **`deploy_lakehouse_assets`: Deploy Assets** · agent-doable · served row `905` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the required skills by their FULL skill_ref_root-prefixed paths; Deploy and run the whole pipeline FROM the bundle editor; Verify end-to-end (read-only).
   - Expected output: all five jobs (`bronze_clone_job`, `silver_dq_setup_job`, `silver_dlt_pipeline`, `gold_setup_job`, `gold_merge_job`) were **deployed by `bundle deploy` and executed by `bundle run`** in dependency order end-to-end, AND the Bronze/Silver/Gold schemas in `{lakehouse_default_catalog}` are populated (`d…
   - Gate: `Lakehouse assets deployed` (served text), then `vibe_complete_step(deploy_lakehouse_assets)`.
9. **`usecase_plan`: Use-Case Plan** · agent-doable · served row `906` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the required skills by their FULL skill_ref_root-prefixed paths; Run the planning workflow, writing every artifact under <DP_BUNDLE_ROOT>/plans/.
   - Expected output: `<DP_BUNDLE_ROOT>/plans/` contains the README + Phase-1 master + the selected addendums + all 4 manifests, the first plan line confirms `**Planning Mode:** Workshop`, and `gold-dependency-manifest.yaml` was intersected against the live `{lakehouse_default_catalog}.{user_schema_prefix}_gold` catalog …
   - Gate: `Use-case plan complete` (served text), then `vibe_complete_step(usecase_plan)`.
10. **`genie_space`: Genie Space** · agent-doable · flag `ai.genie` · served row `908` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the required skills by their FULL skill_ref_root-prefixed paths; Author the semantic-layer bundle (TVFs → Metric Views → Genie). Do NOT execute anything ye; Apply natively in dev, then extract-back and diff (the hybrid dev loop); Write bundle files to <DP_BUNDLE_ROOT>, then deploy FROM that page.
   - Expected output: the hybrid invariant holds for every artifact: (1) **persisted** — each TVF `.sql`, Metric View `.yaml`, and the full Genie `serialized_space` JSON live under `<DP_BUNDLE_ROOT>`; (2) **live matches file** — the Step 2.5 extract-back diffs clean (no drift), and the Genie GET shows **non-zero** genera…
   - Gate: `Genie Space live` (served text), then `vibe_complete_step(genie_space)`.
11. **`aibi_dashboard`: AI/BI Dashboard** · agent-doable · flag `ai.dashboard` · served row `907` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the required skills by their FULL skill_ref_root-prefixed paths; Author the dashboard draft + deploy job (file-first). Do NOT execute anything yet.; Author on the canvas (MANDATORY navigation), then extract-back and persist; Write bundle files to <DP_BUNDLE_ROOT>, then deploy FROM that page.
   - Expected output: the hybrid invariant holds: (1) **persisted** — the `.lvdash.json` lives under `<DP_BUNDLE_ROOT>/docs/dashboards/`; (2) **live matches file** — it was authored on the canvas (Step 2.5), extracted via `readAssetById`, and the extracted JSON matches the persisted file (no drift); (3) **reproducible** …
   - Gate: `Dashboard deployed` (served text), then `vibe_complete_step(aibi_dashboard)`.
12. **`deploy_di_assets`: Deploy Assets** · agent-doable · served row `909` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the required skills by their FULL skill_ref_root-prefixed paths; Pre-flight, then confirm the bundle resources exist. Do NOT deploy yet.; Deploy FROM the bundle page, in dependency order.
   - Expected output: the hybrid invariant holds for every artifact: (1) **persisted** — each TVF `.sql`, Metric View `.yaml`, dashboard `.lvdash.json`, and the full Genie `serialized_space` JSON live under `<DP_BUNDLE_ROOT>`; (2) **live matches file** — each per-task extract-back diffed clean (TVF `routine_definition`, …
   - Gate: `Semantic layer assets deployed` (served text), then `vibe_complete_step(deploy_di_assets)`.
13. **`optimize_genie`: Optimize Genie** · agent-doable · flag `ai.genie` · served row `1003` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the required skills by their FULL skill_ref_root-prefixed paths; Phase 1: Baseline evaluation (iteration 0); Phase 2: Per-lever optimization (Levers 1→5, up to 5 iterations); Re-apply a Metric View or TVF fix FROM the bundle editor (Levers 2-3 only); Phase 3: GEPA (Lever 6) — only if still below target; Phase 4: Promote and verify.
   - Expected output: all eight Genie quality targets pass on the benchmark (native scorer, or the documented `ask_genie` fallback); every applied fix is written back to its definition file under `<DP_BUNDLE_ROOT>` and the extract-back diff is clean; every Metric View / TVF fix reached the live object by `bundle deploy` …
   - Gate: `Genie quality targets passed` (served text), then `vibe_complete_step(optimize_genie)`.
14. **`agent_framework`: Build Agent** · agent-doable · flag `ai.agent` · served row `910` (genie-code fork, version 2)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the required skills by their FULL skill_ref_root-prefixed paths; Author the agent + its deploy job (write files only — do NOT execute anything yet); Deploy FROM the bundle-editor page, run the job, then verify.
   - Expected output: the `agent_deploy_job` was **created by `bundle deploy` and executed by `bundle run`** (visible in Workflows with a successful run ID), the serving endpoint reached READY, and a `w.serving_endpoints.query(...)` probe with a domain-specific question returned a tool call to the Genie MCP. The endpoint…
   - Gate: `Agent endpoint READY` (served text), then `vibe_complete_step(agent_framework)`.
15. **`activation_table_design`: Design & Provision Synced Tables** · agent-doable · served row `924` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Resolve the target catalog (no-create invariant — HARD STOP if absent); Load the required skills by their FULL skill_ref_root-prefixed paths; Author the planning docs AND the Lakebase bundle resource (write only — do NOT deploy yet); Wire the new resource dir into the bundle include:; Open the bundle editor, then validate → summary → dep…
   - Expected output: `<artifact_root>/docs/reverse_etl.md` and `<artifact_root>/docs/activation_sync_plan.md` exist with all required fields (including the cost-control block and the `lakebase_host` from the endpoint GET), AND the Lakebase project + primary endpoint were **created by `bundle deploy`** (visible in `bundl…
   - Gate: `Synced tables planned` (served text), then `vibe_complete_step(activation_table_design)`.
16. **`activation_reverse_sync`: Create Synced Tables** · agent-doable · served row `925` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Read the plan docs (<artifact_root>-anchored paths, NOT @docs/…); Pre-flight: confirm the endpoint caps did not drift (read-only); Enable CDF on Delta sources for TRIGGERED candidates only (gated); Create each synced table via the REST client (dependency order); Poll the long-running operation to a healthy state; Verify row counts in Lak…
   - Expected output: every candidate in `<artifact_root>/docs/activation_sync_plan.md` was created via `w.api_client.do POST /api/2.0/postgres/synced_tables` (unwrapped `SyncedTable` body, `synced_table_id` query param), polled to a healthy `detailed_state` within the 15-minute cap (any bin-packed table triggered its sh…
   - Gate: `Synced tables live` (served text), then `vibe_complete_step(activation_reverse_sync)`.
17. **`activation_app_design`: Design Analytics App** · agent-doable · served row `926` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Read the inputs (<artifact_root>-anchored paths, NOT @docs/…); Load the design-quality skill by its FULL skill_ref_root-prefixed path; Decide extend vs greenfield (genie-rekeyed; apply it mechanically); Design the analytics pages (mock-data-first, every element sourced); Save the analytics design doc (write only — no build).
   - Expected output: `<artifact_root>/docs/analytics_ui_design.md` exists with pages, per-page KPIs/charts, data sources (`{user_schema_prefix}.<synced_table>` + columns), navigation, and the extend-vs-greenfield decision with file evidence; every visualization cites a synced Lakebase table from the sync plan; and a "Vi…
   - Gate: `Analytics app designed` (served text), then `vibe_complete_step(activation_app_design)`.
18. **`activation_build_wire`: Build Analytics App** · agent-doable · served row `927` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Derive APP_NAME and <APP_ROOT> (no auth login); Load the required skills by their FULL skill_ref_root-prefixed paths; Read the analytics design + decide extend vs greenfield; Author the analytics pages with the { data, source } mock envelope (files only — no server; Pre-handoff static gate (the only static check here).
   - Expected output: `<APP_ROOT>` contains a scaffolded/extended AppKit project (`app.yaml`, `databricks.yml` with `name: <APP_NAME>`, `server/server.ts` registering routes inside `onPluginsReady` and returning the `{ data, source: "mock" }` envelope, and `client/` analytics pages that fetch from those routes with loadi…
   - Gate: `Analytics app built (mock)` (served text), then `vibe_complete_step(activation_build_wire)`.
19. **`activation_wire_lakebase`: Wire to Lakebase** · agent-doable · served row `928` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Confirm APP_NAME, <APP_ROOT>, and the synced binding target; Load the wiring skill by its FULL skill_ref_root-prefixed path; Introspect the synced schema (read-only) → synced_schema.md; Register lakebase() and author READ-ONLY routes via onPluginsReady; Wire the frontend + ConnectionStatus; Static gate (the only local check) + deploy-tim…
   - Expected output: `<artifact_root>/docs/synced_schema.md` exists (read-only `information_schema` introspection of the `*_synced` tables), `<APP_ROOT>/server/server.ts` registers `lakebase()` from `@databricks/appkit` with READ-ONLY analytics routes (`SELECT` from `"{user_schema_prefix}".<synced_table>` only, using co…
   - Gate: `Analytics app live data (local)` (served text), then `vibe_complete_step(activation_wire_lakebase)`.
20. **`activation_deploy_validate`: Deploy & Validate** · agent-doable · served row `929` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Confirm APP_NAME and <APP_ROOT>, validate config; Pre-deploy cost re-check (READ-ONLY); Load the deploy skill by its FULL skill_ref_root-prefixed path; Pre-deploy static gate (cheapest possible check); Grant the app SP on the SYNCED schema, then deploy via the SDK SNAPSHOT path; Re-assert the app-SP Genie grants + re-apply the OBO scope …
   - Expected output: `w.apps.get(APP_NAME)` reports `compute_status.state: "ACTIVE"` with the latest deployment `SUCCEEDED`, the deployed `url` was reached through the OAuth session (browser or 3-hop `requests.Session()`) showing the React UI with ConnectionStatus "Live Data", every `/api/analytics/*` (and `/api/chat` i…
   - Gate: `Activation app deployed + validated` (served text), then `vibe_complete_step(activation_deploy_validate)`.
21. **`iterate_enhance`: Iterate & Enhance** · agent-doable · served row `14` (default row, version 1)
   - Genie Code: LLM-generated over default row 14 (no genie-code fork: D-39). Row 14 lists potential enhancements and a six-step iteration process, and ends with an output contract for Redeploy & Test.
   - Expected output: an iteration plan with the row 14 output contract: Change Manifest, Smoke Tests (per enhancement), Regression-Risk Surface, Migrations / Order of Operations. Redeploy & Test (1002) consumes it as `{iteration_plan}`.
   - Gate: no **Gate:** line in row 14; complete with `vibe_complete_step(iterate_enhance)`. **Fail-open:** on every track, generation overruns the 90 s budget (generations run 107.7-133.6 s, then truncate), so the server serves row 14's assembled template, about 4,000 characters, instead of a generated plan (D-62; b260c64…-p4-llm-steps.md). Record whether you got the template.
22. **`redeploy_test`: Redeploy & Test** · agent-doable · served row `1002` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Load the skills by their FULL skill_ref_root-prefixed paths; Diff review; Pick the deploy mode from the manifest; Run migrations BEFORE the app deploy; Deploy and poll; On failure, diagnose and self-heal (max 3 iterations); Verify the delta, not the whole app; Update docs for the changed surface only; Close the loop on the state file.
   - Expected output: every enhancement smoke test passes at the correct gate state and the once-per-deploy health checks pass. A `SUCCEEDED` deploy or a green job run alone is not sufficient: the delta must have shipped through its deploy mechanism (SNAPSHOT for app code, `bundle deploy --target dev` for bundle resource…
   - Gate: `Redeployed + smoke passed` (served text), then `vibe_complete_step(redeploy_test)`.
23. **`workspace_cleanup`: Workspace Clean Up** · agent-doable · served row `1033` (genie-code fork, version 1)
   - Genie Code: Steps in the served text: Resolve your environment (once, before anything else); Identity and the MINE rule; Discover and classify (read-only); STOP: confirm before anything is deleted; Delete what is MINE (only after confirm cleanup); Report and record the gate.
   - Expected output: the table was shown and the operator replied `confirm cleanup` before any delete; only rows the MINE rule marked MINE were deleted; every `not mine: skipped` row is untouched; the summary and gate are recorded in `<STATE_FILE>`.
   - Gate: `Workspace cleaned up` (served text), then `vibe_complete_step(workspace_cleanup)`. Destructive: run S4 before replying `confirm cleanup`.

## S4. The destructive step: workspace_cleanup (fork 1033)

`workspace_cleanup` is the last step of all five walks. On genie-code it is served from fork 1033 (D-58; 89ee6f0…-cleanup-140-profile.md L2: "served from 1033" on genie-accelerator and app-only). What fork 1033 does:
1. Step 1, "Identity and the MINE rule".
2. Step 2, "Discover and classify (read-only)".
3. Step 3, "STOP: confirm before anything is deleted": it shows the table and asks you to reply exactly `confirm cleanup`.
4. Only then Step 4, "Delete what is MINE (only after confirm cleanup)".

In the served text the rules come before the STOP, and the STOP comes before the first delete call (89ee6f0… L2: the STOP is at character 8692, the first delete call, `w.jobs.delete(job.id)`, at 9561).

The smoke **must**, before replying:
1. Read the whole table Genie Code shows at Step 3.
2. Check that every row marked MINE is the participant's own resource: created by your identity, or under your `{user_schema_prefix}` / `{db_schema}` names.
3. Check that the exclusions hold: the lakehouse source catalog, `variables.catalog.default` / `variables.source_catalog.default`, and any catalog not created for this workshop must be `not mine: skipped`. Fork 1033's catalog rule deletes a catalog only if it is Lakebase-only (D-58; the probe located the catalog rule and the `contains \`lakebase\`` check in the served text).
4. If any MINE row is not yours, or you are unsure, **decline**: do not send `confirm cleanup`. Record the row (S5) and stop the step. Declining is a valid smoke outcome.

Only if every MINE row is yours, reply `confirm cleanup`. Then check that the gate is the served one, `Workspace cleaned up`: "the table was shown and the operator replied `confirm cleanup` before any delete; only rows the MINE rule marked MINE were deleted; every `not mine: skipped` row is untouched; the summary and gate are recorded in `<STATE_FILE>`" (row 1033).

The forge never sent `confirm cleanup` and never called a delete API (89ee6f0… header). This step is unproven until the smoke runs it.

## S5. What to record and where to report

Keep one record per walk (track id, session id, start and end time UTC, APP SHA from the app's `/health` or the ledger L1, TPL clone head from S1.2):

| Field | Per step |
|---|---|
| step id | as in S3 |
| served row | compare with S3's row id when you can see it (for example the fork's first lines). Note any mismatch |
| executed | what Genie Code actually ran (tool names: `runDatabricksCli`, `executeCode`, bundle deploy/run, UI actions) |
| artifact | the file or resource the gate names, and whether it exists |
| gate | met / not met, with the gate text Genie Code reported |
| complete | the `vibe_complete_step` result (ok, GATE_REQUIRED, UI_DRIVEN_STEP, STEP_LOCKED, other error code) |
| coaching | for each focus asked: `is_fallback` and whether the answer met the S3 coaching table |
| prompt fallback | on prd_generation and iterate_enhance: generated or template |
| result | PASS / FAIL, with the first error pasted verbatim (tool error JSON, Genie Code message, stack trace) |

Also record S0 (tools and prompts listed), S1 (each command's output, branch and HEAD), S2 (per track: first step, outline equal or the first diff) and S4 (the table, and whether you confirmed or declined).

Report it as a comment on the APP release-candidate PR (ledger L3: "see rc-app"), or to whoever owns that PR. Attach failures as pasted text, not screenshots only.

## S6. Known gaps the smoke may hit

- **D-67: Genie Code may refuse the sanctioned F0 foundation DDL.**
  - Where: agents-accelerator step 10, `uc_resources_foundation`, fork 1009. It provisions the participant's prefixed schemas and volumes with literal `CREATE SCHEMA/VOLUME IF NOT EXISTS`, the D-56 RULE_10 carve-out.
  - Why: the learner-facing TPL skill skills/genie-code-environment/SKILL.md:368 still says "The only sanctioned in-session creation is RULE_8 **Tier 3** Genie-Space `createAsset`", so a Genie Code that loaded that skill can refuse the DDL. The same "one sanctioned exception" wording is in skills/databricks-asset-bundles/SKILL.md:426 and 00-overview :28-38 / :151.
  - Status: a human item before merging TPL RC #21 (ledger L5 item 4).
  - If it happens: record the refusal text verbatim and mark the step FAIL (D-67). Do not hand-create the schemas.
- **D-61: 3 genie-accelerator steps are served their v1 rows,** with bare paths: gagent_describe (934), gaccel_dashboard (940) and gaccel_activation (941). Their v2 rows 1023/1028/1029 are held by the gate.
  - The v1 text reads and writes bare `docs/…` and `.vibecoding-state.md` paths with no root. For example, 940 and 941's gates record into `.vibecoding-state.md` (S3 rows 12, 17, 18).
  - In Genie Code the working directory is not the project root (D-57), so these files can land in the wrong place. Record where they were written.
- **D-62: budget fallbacks.**
  - iterate_enhance is served row 14's assembled template, about 4,000 characters, instead of a generated plan, on every track. On skills-accelerator, the same happens to skill_define_strategy (131) and skill_create_skillmd (132).
  - It fails open: the prompt is never empty. Record "template" and continue.
  - Coaching can also fall back (`is_fallback: true`), for example on prd_generation, whose coaching ran past the 8.0 s budget in probe 54e255e (D-29).
- **deploy-stale-worktree-files.** The code deploy's build log listed files under `.worktrees/mcp-p1-server/` uploaded into the app source (probe-p4-exit-gate, d97a3df). This is unresolved (queue.md:76). If the deployed app behaves like older code anywhere, note the step and the behaviour; do not delete anything.
- **Others the queue records** (ledger L4). These may show up in a walk:
  - complete-project-setup-latency: completing project_setup takes 17-38 s, which risks a client timeout.
  - outline-locked-but-served: semlayer_locate shows as `locked` in a fresh genie-accelerator outline, yet `vibe_get_step` serves it.
  - mcp-honours-step-enabled: an admin-hidden step is hidden in the SPA but walked by MCP, so S2's outline compare can differ on an install with `step_enabled=FALSE` rows.
  - skills-track-silent-fallback (S2).
  - agents-213-execution-label: mlflow_human_review_and_signoff is served as agent-doable, but row 1015 stops for the SME.
