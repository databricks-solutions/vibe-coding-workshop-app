# p4-covered-families: end-to-end, accelerator, data-engineering-accelerator, reverse-lakebase, reverse-app walkable in Genie Code (P4.3, families 3, 4, 7, 8) — D-43, D-44 — ROUND 2 (critic r1 BLOCK folded in: prohibition hits; RULE_9)

Base: origin/feature/genie-code-mcp-integration @ 9710bbd2f2fe9738243ffa52b1ad477ac1796fa0 (#115 merged: fork 1003 optimize_genie live; #114: forks 1001/1002).
PR plan path: docs/superpowers/plans/2026-10-07-p4-covered-families.md

## Evidence (lead read-only parse @9710bbd: manifest.json tracks[*].sections[*].steps[*].sectionTag/execution, joined to the non-comment genie-code fork rows of seed 02)
After #114 and #115, every step of these five tracks either has a genie-code fork or has a recorded no-fork judgment:
- no-fork judgments: project_setup (virtual, _project_setup_content), prd_generation (LLM over default 1; B5 only), bronze_table_metadata (D-41: already client-aware), iterate_enhance and workspace_cleanup (D-39), use_case_selection (P4.2 shared beat).
- forked: everything else (901-910 lakehouse/DI, 911/912 app, 922/923 lakebase, 924-929 activation, 930 wire_ui_agent, 931 sync_from_lakebase, 1001 workspace_setup_deploy, 1002 redeploy_test, 1003 optimize_genie).
Per track (steps; open = neither forked nor judged): end-to-end 24, open 0 · accelerator 17, open 0 · data-engineering-accelerator 11 (= lakehouse), open 0 · reverse-lakebase 18, open 0 · reverse-app 23, open 0. Every step's manifest execution is "agent-doable" (no hybrid/ui-driven entries outside genie-accelerator).
Still open elsewhere (NOT this task): skills-accelerator (5 skill_* tags) and agents-accelerator (10 tags) → their own tasks; genie-accelerator's genie_silver_metadata is the known filtered-off step (reference track, re-verified in p4-genie-reverify).
Why one task, not four: the five tracks share the same forks (a fork is per section_tag, not per track), so the only per-track differences are step order, flags and which forks are reached. The served-body checks therefore differ only in parametrization. Not yet linted by any merged test: the activation forks 924-929 (reverse-lakebase, reverse-app), 930 wire_ui_agent and 931 sync_from_lakebase (end-to-end), as served for these tracks.

## Changes (tests + docs only; NO seed or code change)
S1 a NEW file tests/workshop/test_covered_families_genie.py, parametrized over the 5 tracks, reusing (importing) the helpers of tests/workshop/test_lakehouse_family_genie.py (served-body rendering with a resolved learner email, MARKERS/_hits, the exact-shape project_setup workspace-path allowance). Do NOT modify #114's APP_TRACKS or #115's track list.
  - served-body marker lint for every MCP-outline step of each track, genie-code session, with the default flags. CRITIC r1 (1): forks 925-931 contain marker hits that are PROHIBITIONS or server-side-build descriptions (e.g. seed :16116 "NEVER … run `npm run dev`, open `http://localhost:8000`", :16120/:16467/:16822/:17074 "do NOT run `databricks auth login`", :16265 "`npm not found` warning is expected … npm install runs server-side", :17425 "NEVER run `databricks auth login`"). Handle them EXACTLY like #114's ALLOWED map (test_app_family_genie_forks.py:216-231): per (section_tag, marker) a capped allowance (max hits = the measured count) with the reason "existing fork, reviewed 2026-10-07: every hit is a NEVER / do-NOT prohibition or a description of the server-side build". The implementer lists every hit line (seed line, tag, marker, verbatim snippet) in the plan file's appendix and classifies each as prohibition / server-side description; the reviewer re-verifies the list line by line. A hit that is an AFFIRMATIVE instruction to run npm/npx, open localhost, run auth login, run a .sh script or @-mention a file is NOT allowable → STOP RULE below. Caps are exact counts, so any new hit turns the test red. Tags with no hits get no allowance.
  - fork resolution: each forked tag in these tracks resolves to its fork for genie-code sessions and to the default for default sessions.
  - bundle-mechanics pin (as #115 L4): in every served fork body of these tracks, any `bundle run` is preceded by the bundle-editor page instruction and a `bundle deploy`.
  - app-deploy mechanics pin (D-44): each app-deploy fork served in these tracks (912 deploy_databricks_app, 929 activation_deploy_validate, 930 wire_ui_agent) names the SDK SNAPSHOT call (`w.apps.deploy(` … `AppDeploymentMode.SNAPSHOT`) via executeCode as the canonical mechanism, carries the STOP-on-blocked-deploy rule, and contains no affirmative local build step (`npm run build` only inside a NEVER line).
S2 additive extensions: per-track walk start → next → get → complete to Done for the 5 tracks (test_track_scoped_walk.py); MCP outline == SPA outline endpoint for the 5 tracks (test_outline_parity.py; add only what's missing); execution == "agent-doable" pin for every step of the 5 tracks (test_manifest_parity.py).
S3 plan file: a per-track table (tag → fork id or judgment → execution → RULE evidence, with RULE_9 P10/P11 noted for the app-deploy forks 912/929/930), the hit-line appendix, and the D-43 and D-44 entries.
D-44 (CRITIC r1 (2), RULE_9): TPL 00-overview RULE_9 row (:148) reads "Genie Code = `apps deploy` via `runDatabricksCli` when the page allows it … sanctioned fallback SDK w.apps.deploy SNAPSHOT (P11)", while P10 (:191) says the CLI path is "Not a reliable Genie Code path" (CWD pinned to the page's bundle root; hard-blocked on file-editor / Apps pages) and P11 (:192) says the SDK "works from any context". The SHIPPED forks are consistent with each other and with P10/P11, not with the row's ordering: 912 (seed :7840-7843, merged and app-family-linted in #114) says "DO NOT rely on `databricks apps deploy` via runDatabricksCli … canonical deploy mechanism is the SDK SNAPSHOT call"; 929 (:16795-16802, :17004) is the same and allows the CLI only as "an acceptable equivalent" when the page permits; 930 likewise. (The critic's reading that 912 is CLI-first is incorrect: :7840.) Decision protocol (1), shipped code decides: SDK SNAPSHOT canonical, CLI optional where the page allows; no fork change. Doc follow-up: the TPL RULE_9 row's ordering is reconciled with P10/P11 in the template RC docs (queue: tpl-rule9-wording). Reversal: if a live Genie Code smoke shows the CLI path is reliable, swap the order in all three forks together (seed task).
S4 docs/superpowers/decision-log.md: D-43, D-44 plus the lead decisions.md entries recorded after the #115 carry (HALT #3 / gh account).
STOP RULE: if any served body of these tracks contains an AFFIRMATIVE marker instruction (not a prohibition / server-side description), or fails the bundle-mechanics or app-deploy pin, do NOT add an allowance or weaken a check. Stop, report the step, the fork id and the hits, and leave the PR unopened. The lead then re-plans that tag as a seed task (charter exception on seed 02).

## Tampers (expected red)
X1 inject `Run npm install` into fork 927 (activation_build_wire) body → the new lint red for reverse-app.
X2 inject `@data_product_accelerator/skills/x/SKILL.md` into fork 931 (sync_from_lakebase) → the new lint red for end-to-end.
X3 delete fork 924's INSERT (activation_table_design) → the new fork-resolution test red for reverse-lakebase and reverse-app.
X4 flip one end-to-end step's execution to ui-driven in manifest.json (tamper only) → the agent-doable pin red.
X5 remove the `bundle deploy` line before `bundle run` in fork 905 → the bundle-mechanics pin red.
X6 add one more prohibition line containing `databricks auth login` to fork 925 → its exact-count allowance is exceeded → lint red (caps are exact).
X7 replace `AppDeploymentMode.SNAPSHOT` in fork 929 with nothing (delete the SDK call line) → the app-deploy pin red.
(Tampers are local mutations in the worktree; never committed.)

## Green gates
App suite: DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= <APP>/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q → all pass, ≥ 1060 (floor at 9710bbd) + the new tests. No seed change, so no genie gate diff is required; run it anyway with base seed = head seed as a sanity check (exit 0).
Fence: tests/workshop/ (the new file + additive extensions), the plan file, docs/superpowers/decision-log.md. Nothing else.

## Release
MERGE repo=app, reseed=no; code deploy of the merge (tests/docs only, so behaviour unchanged).

## Live checks (prober; sessions via app endpoints only; Lakebase read-only; use case lock travel / ai_driven_booking)
L1 end-to-end fresh genie-code walk to Done: 0 app tool errors; every served body 0 markers (project_setup workspace path = known exact-shape allowance); forks 911, 912, 922, 923, 931, 901-910, 930, 1001, 1002, 1003 served where reached.
L2 reverse-app fresh walk to Done: activation forks 924-929 served; 0 markers.
L3 accelerator walk to Done; data-engineering-accelerator and reverse-lakebase: start + outline + first served step.
L4 MCP outline == /api/track/<t>/outline?session_id= full JSON for all 5 tracks, 0 diffs.
L5 7 tools (MCP tools/list); /health 200; clean log (count iterate_enhance fallback lines).

## Decision D-43
question: do end-to-end, accelerator, data-engineering-accelerator, reverse-lakebase and reverse-app need their own forks? · choice: no; after #114/#115 every step has a fork or a recorded judgment; verify with per-track tests + live walks in ONE task (shared forks), with a STOP rule that turns any finding into a seed task · evidence: manifest.json + seed 02 @9710bbd (open = 0 for the 5 tracks) · reversal: drop the test file; split into per-family tasks.

## S3 per-track table (implementer, measured @9710bbd)

Numbers are the step's position in the MCP outline of that track (genie-code session, default flags); blank = not on the track. Every step's manifest execution is listed from manifest.track_steps. Tests: C1-C4 in tests/workshop/test_covered_families_genie.py; walks/outline/agent-doable in test_track_scoped_walk.py (w10), test_outline_parity.py and test_manifest_parity.py.

| tag | fork / judgment | execution | e2e | acc | de-acc | rev-lb | rev-app | RULE evidence (tests) |
|---|---|---|---|---|---|---|---|---|
| project_setup | no fork: virtual step (mcp_server._project_setup_content); exact-shape workspace-path allowance (#115) | agent-doable | 1 | 1 | 1 | 1 | 1 | C1 0 markers outside the exact-shape path |
| prd_generation | no fork: LLM over default 1 (B5 only) | agent-doable | 2 | 2 | 2 | 2 | 2 | C1 0 markers |
| cursor_copilot_ui_design | fork 911 | agent-doable | 3 |  |  |  |  | C2 resolution; C1 exact npm/npx=11, localhost=5, auth login=1 (appendix) |
| deploy_databricks_app | fork 912 | agent-doable | 4 |  |  |  |  | C2 resolution; C1 exact npm/npx=7, localhost=6, auth login=2 (appendix); C4 SDK SNAPSHOT via executeCode canonical + STOP rule; RULE_9 P10/P11 (D-44) |
| setup_lakebase | fork 922 | agent-doable | 5 |  |  |  |  | C2 resolution; C1 exact npm/npx=4, localhost=1, auth login=3 (appendix) |
| wire_ui_lakebase | fork 923 | agent-doable | 6 |  |  |  |  | C2 resolution; C1 exact npm/npx=7, localhost=1, auth login=2 (appendix) |
| workspace_setup_deploy | fork 1001 | agent-doable | 7 |  |  |  |  | C2 resolution; C1 0 markers |
| sync_from_lakebase | fork 931 | agent-doable | 8 |  |  |  |  | C2 resolution; C1 exact auth login=2 (appendix) |
| bronze_table_metadata | no fork: already client-aware (D-41) | agent-doable | 9 | 3 | 3 | 3 | 3 | C1 0 markers |
| bronze_layer_creation | fork 901 | agent-doable | 10 | 4 | 4 | 4 | 4 | C2 resolution; C1 0 markers; C3 bundle page -> dev deploy -> run |
| silver_layer_sdp | fork 902 | agent-doable | 11 | 5 | 5 | 5 | 5 | C2 resolution; C1 0 markers; C3 bundle page -> dev deploy -> run |
| gold_layer_design | fork 903 | agent-doable | 12 | 6 | 6 | 6 | 6 | C2 resolution; C1 0 markers |
| gold_layer_pipeline | fork 904 | agent-doable | 13 | 7 | 7 | 7 | 7 | C2 resolution; C1 0 markers; C3 bundle page -> dev deploy -> run |
| deploy_lakehouse_assets | fork 905 | agent-doable | 14 | 8 | 8 | 8 | 8 | C2 resolution; C1 0 markers; C3 bundle page -> dev deploy -> run |
| usecase_plan | fork 906 | agent-doable | 15 | 9 |  | 9 | 9 | C2 resolution; C1 0 markers |
| aibi_dashboard | fork 907 | agent-doable | 16 | 10 |  | 11 | 11 | C2 resolution; C1 0 markers; C3 bundle page -> dev deploy -> run |
| genie_space | fork 908 | agent-doable | 17 | 11 |  | 10 | 10 | C2 resolution; C1 0 markers; C3 bundle page -> dev deploy -> run |
| deploy_di_assets | fork 909 | agent-doable | 18 | 12 |  | 12 | 12 | C2 resolution; C1 0 markers; C3 bundle page -> dev deploy -> run |
| optimize_genie | fork 1003 | agent-doable | 19 | 13 |  | 13 | 13 | C2 resolution; C1 0 markers; C3 bundle page -> dev deploy -> run |
| agent_framework | fork 910 | agent-doable | 20 | 14 |  |  | 14 | C2 resolution; C1 0 markers; C3 bundle page -> dev deploy -> run |
| wire_ui_agent | fork 930 | agent-doable | 21 |  |  |  |  | C2 resolution; C1 exact npm/npx=6, localhost=3, auth login=2 (appendix); C4 SDK SNAPSHOT via executeCode canonical + STOP rule; RULE_9 P10/P11 (D-44) |
| iterate_enhance | no fork (D-39) | agent-doable | 22 | 15 | 9 | 16 | 21 | C1 0 markers |
| redeploy_test | fork 1002 | agent-doable | 23 | 16 | 10 | 17 | 22 | C2 resolution; C1 0 markers; C3 bundle page -> dev deploy -> run |
| workspace_cleanup | no fork (D-39) | agent-doable | 24 | 17 | 11 | 18 | 23 | C1 0 markers |
| activation_table_design | fork 924 | agent-doable |  |  |  | 14 | 15 | C2 resolution; C1 0 markers |
| activation_reverse_sync | fork 925 | agent-doable |  |  |  | 15 | 16 | C2 resolution; C1 exact auth login=2 (appendix) |
| activation_app_design | fork 926 | agent-doable |  |  |  |  | 17 | C2 resolution; C1 exact npm/npx=1, localhost=1, auth login=1, @-mention=1 (appendix) |
| activation_build_wire | fork 927 | agent-doable |  |  |  |  | 18 | C2 resolution; C1 exact npm/npx=6, localhost=4, auth login=1 (appendix) |
| activation_wire_lakebase | fork 928 | agent-doable |  |  |  |  | 19 | C2 resolution; C1 exact npm/npx=4, localhost=2, auth login=3 (appendix) |
| activation_deploy_validate | fork 929 | agent-doable |  |  |  |  | 20 | C2 resolution; C1 exact npm/npx=7, localhost=6, auth login=1 (appendix); C4 SDK SNAPSHOT via executeCode canonical + STOP rule; RULE_9 P10/P11 (D-44) |

Steps per track: end-to-end 24, accelerator 17, data-engineering-accelerator 11, reverse-lakebase 18, reverse-app 23; open (neither forked nor judged) = 0 on every track.

RULE_9 (D-44): 912 deploy_databricks_app, 929 activation_deploy_validate and 930 wire_ui_agent are the app-deploy forks; C4 pins the SDK SNAPSHOT call (`w.apps.deploy(` ... `AppDeploymentMode.SNAPSHOT`) via executeCode as canonical (P11), the `**DO NOT** rely on `databricks apps deploy` via `runDatabricksCli`` line (P10), the STOP-on-blocked-(re)deploy rule, and `npm run build` only inside prohibitions. Implementer note: the plan's sketch "`npm run build` only inside a NEVER line" is too strict for the shipped text: 912 :7887 and 929 :16845 say "pre-flights do NOT apply on Genie Code", 930 :17064 "not via a local `npm run build`" and :17118 "on Genie Code substitute the deploy-time server-side build". All are prohibitions, so C4 accepts NEVER / do NOT / not via / NO local / on Genie Code substitute on each `npm run build` line. No line is an affirmative local build.

C3 note: fork 908 genie_space has the prose "this bundle run proves the persisted files reproduce them" (served body before its dev deploy); it is not a command. C3 matches backtick-led `bundle run` commands only, and every one follows the bundle-editor page and a dev `bundle deploy`. 1002 redeploy_test states the page as "each run **from the bundle editor**" in its deploy sentence, not as the shared bullet; C3 uses that phrase for 1002.

## Hit-line appendix (every allowed hit)

One row per regex match in the fork's seed INSERT (served counts equal the raw counts for every tag). Allowance reason: "existing fork, reviewed 2026-10-07: every hit is a NEVER / do-NOT prohibition or a description of the server-side build" (911/912/922/923 keep #114's 2026-10-06 entries, imported unchanged); activation_app_design @-mention carries its own reason (row 56). project_setup's one @-mention is the virtual step's `/Workspace/Users/<email>/...SKILL.md` path, exempted by #115's exact-shape pattern (not a seed row). No hit is an affirmative instruction to run npm/npx, open localhost, run auth login, run a .sh script or @-mention a file: STOP RULE not triggered.

| # | seed line | input_id | tag | marker | verbatim snippet | classification |
|---|---|---|---|---|---|---|
| 1 | 806 | 911 | cursor_copilot_ui_design | localhost | AUTHOR the UI with mock data — you do NOT run a local server, you do NOT test at `http://localhost:8000`, and you do NOT run `databricks apps deploy`. Initial | prohibition |
| 2 | 810 | 911 | cursor_copilot_ui_design | npm/npx | ❌ **NEVER** run `npm run dev`, open `http://localhost:8000`, or rely on a local N | prohibition |
| 3 | 810 | 911 | cursor_copilot_ui_design | npm/npx | lhost:8000`, or rely on a local Node server — Genie Code is serverless and has **no local npm and no localhost** (`genie-code-environment` "AppKit/Node re | server-side build description |
| 4 | 810 | 911 | cursor_copilot_ui_design | npm/npx | correctness is proven server-side at deploy time (step 05), where the Apps runtime runs `npm install` + `npm run build` from source. | server-side build description |
| 5 | 810 | 911 | cursor_copilot_ui_design | npm/npx | proven server-side at deploy time (step 05), where the Apps runtime runs `npm install` + `npm run build` from source. | server-side build description |
| 6 | 810 | 911 | cursor_copilot_ui_design | localhost | ❌ **NEVER** run `npm run dev`, open `http://localhost:8000`, or rely on a local Node server — Genie Code is serve | prohibition |
| 7 | 810 | 911 | cursor_copilot_ui_design | localhost | , or rely on a local Node server — Genie Code is serverless and has **no local npm and no localhost** (`genie-code-environment` "AppKit/Node reality"). The IDE | server-side build description |
| 8 | 810 | 911 | cursor_copilot_ui_design | localhost | vironment` "AppKit/Node reality"). The IDE's `curl -o /dev/null -w "%{http_code}" http://localhost:8000` smoke check does **NOT** apply here; build correctnes | prohibition (IDE path, not applied on Genie Code) |
| 9 | 814 | 911 | cursor_copilot_ui_design | auth login | current-user me`, `databricks apps init …`). You are pre-authenticated — do **NOT** run `databricks auth login`. | prohibition |
| 10 | 863 | 911 | cursor_copilot_ui_design | npm/npx | `apps init` creates `<artifact_root>/<APP_NAME>/` = `<APP_ROOT>`. The `⚠ npm not found` warning is **expected** — Genie Code has no local | server-side build description |
| 11 | 863 | 911 | cursor_copilot_ui_design | npm/npx | _ROOT>`. The `⚠ npm not found` warning is **expected** — Genie Code has no local npm, so `npm install` is skipped here and runs **server-side on deploy** | server-side build description |
| 12 | 863 | 911 | cursor_copilot_ui_design | npm/npx | tall` is skipped here and runs **server-side on deploy** (step 05). Do not try to install npm or run `npm install`. Verify `<APP_ROOT>/databricks.yml` exi | prohibition |
| 13 | 863 | 911 | cursor_copilot_ui_design | npm/npx | pped here and runs **server-side on deploy** (step 05). Do not try to install npm or run `npm install`. Verify `<APP_ROOT>/databricks.yml` exists and cont | prohibition |
| 14 | 871 | 911 | cursor_copilot_ui_design | npm/npx | database at this stage. Skip the SQL-query parts of the build skill (`config/queries/`, `npm run typegen`, `useAnalyticsQuery`, `sql.*`). Replace the ent | prohibition |
| 15 | 881 | 911 | cursor_copilot_ui_design | npm/npx | o absorb the serverless cold start, then keep `timeoutMinutes` generous). Do **not** run `npm run build`/`npm run dev` — there is no local Node; the build | prohibition |
| 16 | 881 | 911 | cursor_copilot_ui_design | npm/npx | verless cold start, then keep `timeoutMinutes` generous). Do **not** run `npm run build`/`npm run dev` — there is no local Node; the build runs server-sid | prohibition |
| 17 | 967 | 911 | cursor_copilot_ui_design | localhost | ved), and `<artifact_root>/docs/ui_design.md` exists. NO local server was run, NO `http://localhost:8000` check was attempted, and NOTHING was deployed or vali | prohibition |
| 18 | 7830 | 912 | deploy_databricks_app | localhost | - **Verify the deployed app** — check the live URL, not localhost. | prohibition |
| 19 | 7834 | 912 | deploy_databricks_app | npm/npx | scaffolded and authored under `<APP_ROOT>`, then VERIFIES the live URL. There is no local npm and no localhost — the Apps runtime builds server-side. The | server-side build description |
| 20 | 7834 | 912 | deploy_databricks_app | localhost | and authored under `<APP_ROOT>`, then VERIFIES the live URL. There is no local npm and no localhost — the Apps runtime builds server-side. The reliable deploy | server-side build description |
| 21 | 7838 | 912 | deploy_databricks_app | npm/npx | ❌ **NEVER** run `npm run build` / `npm run dev` locally, and **NEVER** open `http | prohibition |
| 22 | 7838 | 912 | deploy_databricks_app | npm/npx | ❌ **NEVER** run `npm run build` / `npm run dev` locally, and **NEVER** open `http://localhost:8000` | prohibition |
| 23 | 7838 | 912 | deploy_databricks_app | npm/npx | ode toolchain** (`genie-code-environment` "AppKit/Node reality"). A SNAPSHOT deploy runs `npm install` + `npm run build` (Vite) **server-side from the un- | server-side build description |
| 24 | 7838 | 912 | deploy_databricks_app | npm/npx | (`genie-code-environment` "AppKit/Node reality"). A SNAPSHOT deploy runs `npm install` + `npm run build` (Vite) **server-side from the un-built source** u | server-side build description |
| 25 | 7838 | 912 | deploy_databricks_app | localhost | ❌ **NEVER** run `npm run build` / `npm run dev` locally, and **NEVER** open `http://localhost:8000` — Genie Code has **no local Node toolchain** (`genie- | prohibition |
| 26 | 7845 | 912 | deploy_databricks_app | npm/npx | kfile **hard-fails the source-export phase in ~10s** (`RESOURCE_DOES_NOT_EXIST`), before `npm install` ever runs. Change dependencies by editing `package. | server-side build description |
| 27 | 7863 | 912 | deploy_databricks_app | auth login | You are pre-authenticated — do **NOT** run `databricks auth login`. Re-derive identity read-only and re-confirm the app name | prohibition |
| 28 | 7872 | 912 | deploy_databricks_app | auth login | — runDatabricksCli/SDK are pre-authenticated, so omit `--profile`; do NOT run the IDE's `databricks auth login` profile-creation fallback. | prohibition |
| 29 | 7887 | 912 | deploy_databricks_app | npm/npx | icks apps deploy` step it shows into the SDK SNAPSHOT call below; the skill's localhost/`npm run build` pre-flights do NOT apply on Genie Code. | prohibition |
| 30 | 7887 | 912 | deploy_databricks_app | localhost | any `databricks apps deploy` step it shows into the SDK SNAPSHOT call below; the skill's localhost/`npm run build` pre-flights do NOT apply on Genie Code. | prohibition |
| 31 | 7963 | 912 | deploy_databricks_app | localhost | ### Step 4 — Verify the DEPLOYED app (not localhost) | prohibition |
| 32 | 7976 | 912 | deploy_databricks_app | localhost | he React mock-data UI with no ERROR logs. Verification used the DEPLOYED URL — NO `http://localhost:8000` check was attempted, and NO UI assets were hand-creat | prohibition |
| 33 | 15493 | 922 | setup_lakebase | npm/npx | ❌ **NEVER** run `npm install` / `npm run dev` locally or open `http://localhost:8 | prohibition |
| 34 | 15493 | 922 | setup_lakebase | npm/npx | ❌ **NEVER** run `npm install` / `npm run dev` locally or open `http://localhost:8000` — Genie Cod | prohibition |
| 35 | 15493 | 922 | setup_lakebase | localhost | ❌ **NEVER** run `npm install` / `npm run dev` locally or open `http://localhost:8000` — Genie Code is serverless with **no local Node toolc | prohibition |
| 36 | 15501 | 922 | setup_lakebase | auth login | es verbs or the SDK / REST via `executeCode`. You are pre-authenticated — do **NOT** run `databricks auth login`. | prohibition |
| 37 | 15516 | 922 | setup_lakebase | auth login | You are pre-authenticated — do **NOT** run `databricks auth login`. Re-derive identity read-only and re-confirm the app name | prohibition |
| 38 | 15526 | 922 | setup_lakebase | auth login | — runDatabricksCli/SDK are pre-authenticated, so omit `--profile`; do NOT run the IDE's `databricks auth login` profile-creation fallback. | prohibition |
| 39 | 15534 | 922 | setup_lakebase | npm/npx | LL.md")` — Lakebase config + wiring patterns. Its `databricks.yml` `postgres_projects` / `npm run build` / `databricks apps validate` mechanics are the ID | prohibition (IDE path, not applied on Genie Code) |
| 40 | 15541 | 922 | setup_lakebase | npm/npx | endencies` (match the `@databricks/appkit` version line already present). Do **NOT** run `npm install` and do **NOT** touch `package-lock.json` — the serv | prohibition |
| 41 | 15610 | 923 | wire_ui_lakebase | npm/npx | l Node toolchain: the build is proven server-side by the **Deploy** step, not by a local `npm run build`. The app is anchored to `<APP_ROOT>`; every skill | server-side build description |
| 42 | 15614 | 923 | wire_ui_lakebase | npm/npx | ❌ **NEVER** run `npm run build` / `npm run dev` locally or open `http://localhost | prohibition |
| 43 | 15614 | 923 | wire_ui_lakebase | npm/npx | ❌ **NEVER** run `npm run build` / `npm run dev` locally or open `http://localhost:8000` — Genie Cod | prohibition |
| 44 | 15614 | 923 | wire_ui_lakebase | npm/npx | **no local Node toolchain** (`genie-code-environment` "AppKit/Node reality"). The IDE's `npm run build` validation has **no Genie equivalent**; build cor | prohibition (IDE path, not applied on Genie Code) |
| 45 | 15614 | 923 | wire_ui_lakebase | localhost | ❌ **NEVER** run `npm run build` / `npm run dev` locally or open `http://localhost:8000` — Genie Code is serverless with **no local Node toolc | prohibition |
| 46 | 15620 | 923 | wire_ui_lakebase | auth login | *read-only** identity via `runDatabricksCli`. You are pre-authenticated — do **NOT** run `databricks auth login`. File writes go through `executeCode` against warm compute | prohibition |
| 47 | 15637 | 923 | wire_ui_lakebase | auth login | You are pre-authenticated — do **NOT** run `databricks auth login`: | prohibition |
| 48 | 15655 | 923 | wire_ui_lakebase | npm/npx | The skill's `npm run build` gates and `databricks apps validate` are the IDE | prohibition (IDE path, not applied on Genie Code) |
| 49 | 15709 | 923 | wire_ui_lakebase | npm/npx | baseData` with mock fallback, and the wiring static scan prints `BLOCKING: OK`. NO local `npm run build`/`npm run dev` was attempted; the server-side buil | prohibition |
| 50 | 15709 | 923 | wire_ui_lakebase | npm/npx | ock fallback, and the wiring static scan prints `BLOCKING: OK`. NO local `npm run build`/`npm run dev` was attempted; the server-side build runs at the ** | prohibition |
| 51 | 15924 | 925 | activation_reverse_sync | auth login | authenticated REST client (`w.api_client.do`); you are already authenticated — never run `databricks auth login`.** | prohibition |
| 52 | 15928 | 925 | activation_reverse_sync | auth login | oscaling), or the `databricks postgres` CLI (**blocked** on Genie Code). ❌ **NEVER** run `databricks auth login` / `databricks auth token` — `runDatabricksCli` and the `w` | prohibition |
| 53 | 16116 | 926 | activation_app_design | npm/npx | ❌ **NEVER** scaffold (`databricks apps init`), author component/server code, run `npm run dev`, open `http://localhost:8000`, or deploy in this st | prohibition |
| 54 | 16116 | 926 | activation_app_design | localhost | d (`databricks apps init`), author component/server code, run `npm run dev`, open `http://localhost:8000`, or deploy in this step — Genie Code is serverless wi | prohibition |
| 55 | 16120 | 926 | activation_app_design | auth login | er me`) to resolve `<APP_NAME>`/`<APP_ROOT>`. You are pre-authenticated — do **NOT** run `databricks auth login`. | prohibition |
| 56 | 16155 | 926 | activation_app_design | @-mention | The IDE rule keys on `apps_lakebase/app.py` + `@docs/ui_design.md`; on the genie track the Chapter-1 app is the AppKit projec | description of the IDE rule being re-keyed to `<APP_ROOT>` (not an @-mention instruction) |
| 57 | 16209 | 927 | activation_build_wire | localhost | nalytics pages with mock data — you do NOT run a local server, you do NOT test at `http://localhost:8000`, and you do NOT deploy. Live data is the **Wire to La | prohibition |
| 58 | 16213 | 927 | activation_build_wire | npm/npx | ❌ **NEVER** run `npm run dev`, `python app.py`, or open `http://localhost:8000` — | prohibition |
| 59 | 16213 | 927 | activation_build_wire | npm/npx | rrectness is proven server-side at the **Deploy & Validate** step (the Apps runtime runs `npm install` + `npm run build` from source). **Ignore the IDE Fa | server-side build description |
| 60 | 16213 | 927 | activation_build_wire | npm/npx | ven server-side at the **Deploy & Validate** step (the Apps runtime runs `npm install` + `npm run build` from source). **Ignore the IDE FastAPI contract e | server-side build description |
| 61 | 16213 | 927 | activation_build_wire | localhost | ❌ **NEVER** run `npm run dev`, `python app.py`, or open `http://localhost:8000` — Genie Code is serverless with **no local Node toolc | prohibition |
| 62 | 16213 | 927 | activation_build_wire | localhost | enie-code-environment` "AppKit/Node reality"). The IDE's local `python app.py` + `http://localhost:8000` smoke test has **NO Genie equivalent**; build correct | prohibition (IDE path, not applied on Genie Code) |
| 63 | 16219 | 927 | activation_build_wire | auth login | current-user me`, `databricks apps init …`). You are pre-authenticated — do **NOT** run `databricks auth login`. | prohibition |
| 64 | 16265 | 927 | activation_build_wire | npm/npx | The `⚠ npm not found` warning is **expected** — Genie Code has no local | server-side build description |
| 65 | 16265 | 927 | activation_build_wire | npm/npx | The `⚠ npm not found` warning is **expected** — Genie Code has no local npm; `npm install` runs server-side at deploy. Verify `<APP_ROOT>/data | server-side build description |
| 66 | 16290 | 927 | activation_build_wire | npm/npx | - Skip the IDE's SQL-warehouse build paths (`config/queries/`, `npm run typegen`, `useAnalyticsQuery`) — synced-table reads arri | prohibition |
| 67 | 16430 | 927 | activation_build_wire | localhost | OCKING: OK` with theming REVIEW items (G/H) resolved. NO local server was run, NO `http://localhost:8000` check was attempted, and NOTHING was deployed — deplo | prohibition |
| 68 | 16455 | 928 | activation_wire_lakebase | npm/npx | is proven server-side by the **Deploy & Validate** step, not by a local `python app.py`/`npm run build`. The IDE's hand-rolled `psycopg3` `ConnectionPoo | server-side build description |
| 69 | 16459 | 928 | activation_wire_lakebase | npm/npx | ❌ **NEVER** run `npm run build` / `npm run dev` / `python app.py` or open `http:/ | prohibition |
| 70 | 16459 | 928 | activation_wire_lakebase | npm/npx | ❌ **NEVER** run `npm run build` / `npm run dev` / `python app.py` or open `http://localhost:8000` — | prohibition |
| 71 | 16459 | 928 | activation_wire_lakebase | localhost | ❌ **NEVER** run `npm run build` / `npm run dev` / `python app.py` or open `http://localhost:8000` — Genie Code is serverless with **no local Node toolc | prohibition |
| 72 | 16467 | 928 | activation_wire_lakebase | auth login | *read-only** identity via `runDatabricksCli`. You are pre-authenticated — do **NOT** run `databricks auth login` (the IDE's `databricks auth login --host {workspace_url}` | prohibition |
| 73 | 16467 | 928 | activation_wire_lakebase | auth login | icksCli`. You are pre-authenticated — do **NOT** run `databricks auth login` (the IDE's `databricks auth login --host {workspace_url}` step does NOT apply on Genie Code). | prohibition (IDE path, not applied on Genie Code) |
| 74 | 16484 | 928 | activation_wire_lakebase | auth login | You are pre-authenticated — do **NOT** run `databricks auth login`: | prohibition |
| 75 | 16601 | 928 | activation_wire_lakebase | npm/npx | en against the deployed app at the **Deploy & Validate** step.) NO local `python app.py`/`npm run build` was attempted; NO table was created, seeded, or m | prohibition |
| 76 | 16601 | 928 | activation_wire_lakebase | localhost | Code "local" = the authored, statically-gated pre-deploy milestone — there is NO `http://localhost:8000` run; live synced reads are proven against the deploye | prohibition |
| 77 | 16780 | 929 | activation_deploy_validate | localhost | - **Verify the deployed app** — via envelope semantics (not localhost, not HTTP status). | prohibition |
| 78 | 16785 | 929 | activation_deploy_validate | npm/npx | reverse-ETL pipeline (Lakehouse Gold → Synced Tables → Lakebase → App). There is no local npm and no localhost — the Apps runtime builds server-side. The | server-side build description |
| 79 | 16785 | 929 | activation_deploy_validate | localhost | pipeline (Lakehouse Gold → Synced Tables → Lakebase → App). There is no local npm and no localhost — the Apps runtime builds server-side. The reliable deploy | server-side build description |
| 80 | 16789 | 929 | activation_deploy_validate | npm/npx | ❌ **NEVER** run `npm run build` / `npm run dev` / `python app.py` locally, and ** | prohibition |
| 81 | 16789 | 929 | activation_deploy_validate | npm/npx | ❌ **NEVER** run `npm run build` / `npm run dev` / `python app.py` locally, and **NEVER** open `http | prohibition |
| 82 | 16789 | 929 | activation_deploy_validate | npm/npx | ode toolchain** (`genie-code-environment` "AppKit/Node reality"). A SNAPSHOT deploy runs `npm install` + `npm run build` (Vite) **server-side from the un- | server-side build description |
| 83 | 16789 | 929 | activation_deploy_validate | npm/npx | (`genie-code-environment` "AppKit/Node reality"). A SNAPSHOT deploy runs `npm install` + `npm run build` (Vite) **server-side from the un-built source** u | server-side build description |
| 84 | 16789 | 929 | activation_deploy_validate | localhost | run `npm run build` / `npm run dev` / `python app.py` locally, and **NEVER** open `http://localhost:8000` — Genie Code has **no local Node toolchain** (`genie- | prohibition |
| 85 | 16804 | 929 | activation_deploy_validate | npm/npx | kfile **hard-fails the source-export phase in ~10s** (`RESOURCE_DOES_NOT_EXIST`), before `npm install` ever runs. | server-side build description |
| 86 | 16822 | 929 | activation_deploy_validate | auth login | You are pre-authenticated — do **NOT** run `databricks auth login`. Re-derive identity read-only and re-confirm the app name | prohibition |
| 87 | 16845 | 929 | activation_deploy_validate | npm/npx | deploy`/`databricks sync` step into the SDK SNAPSHOT call below; the skill's localhost/`npm run build` pre-flights do NOT apply on Genie Code. | prohibition |
| 88 | 16845 | 929 | activation_deploy_validate | localhost | bricks apps deploy`/`databricks sync` step into the SDK SNAPSHOT call below; the skill's localhost/`npm run build` pre-flights do NOT apply on Genie Code. | prohibition |
| 89 | 17023 | 929 | activation_deploy_validate | localhost | ### Step 4 — Verify the DEPLOYED app via envelope semantics (not localhost, not HTTP status) | prohibition |
| 90 | 17040 | 929 | activation_deploy_validate | localhost | everse_etl.md` both pre- and post-deploy. Verification used the DEPLOYED URL — NO `http://localhost:8000` check, NO `databricks sync`, NO mutating `update-endp | prohibition |
| 91 | 17064 | 930 | wire_ui_agent | npm/npx | here is no local Node toolchain: the build runs server-side at redeploy, not via a local `npm run build`. The app is anchored to `<APP_ROOT>`; every skill | server-side build description |
| 92 | 17068 | 930 | wire_ui_agent | npm/npx | ❌ **NEVER** run `npm run build` / `npm run dev` locally or open `http://localhost | prohibition |
| 93 | 17068 | 930 | wire_ui_agent | npm/npx | ❌ **NEVER** run `npm run build` / `npm run dev` locally or open `http://localhost:8000` — Genie Cod | prohibition |
| 94 | 17068 | 930 | wire_ui_agent | npm/npx | **no local Node toolchain** (`genie-code-environment` "AppKit/Node reality"). The IDE's `npm run build` gate has **no Genie equivalent**; build correctne | prohibition (IDE path, not applied on Genie Code) |
| 95 | 17068 | 930 | wire_ui_agent | npm/npx | `databricks apps logs <APP_NAME>` / `<app-url>/logz` (not from compute). Also do NOT run `npm run dev` — the `serving()` plugin throws `ConfigurationError | prohibition |
| 96 | 17068 | 930 | wire_ui_agent | localhost | ❌ **NEVER** run `npm run build` / `npm run dev` locally or open `http://localhost:8000` — Genie Code is serverless with **no local Node toolc | prohibition |
| 97 | 17074 | 930 | wire_ui_agent | auth login | r me`, `databricks serving-endpoints get …`). You are pre-authenticated — do **NOT** run `databricks auth login`, and do **NOT** use `databricks auth token` + a raw `Autho | prohibition |
| 98 | 17092 | 930 | wire_ui_agent | auth login | You are pre-authenticated — do **NOT** run `databricks auth login`: | prohibition |
| 99 | 17118 | 930 | wire_ui_agent | npm/npx | load EACH the same way (repo-relative path prefixed with `skill_ref_root`). The skills' `npm run build` gates and `databricks apps validate` are the IDE | prohibition (IDE path, not applied on Genie Code) |
| 100 | 17229 | 930 | wire_ui_agent | localhost | **Verify the DEPLOYED app (not localhost).** A deployed App sits behind the Apps OAuth gate — a raw | prohibition |
| 101 | 17236 | 930 | wire_ui_agent | localhost | ting — reached through the OAuth session. Verification used the DEPLOYED URL — NO `http://localhost:8000` check and NO hand-created UI assets as a workaround. | prohibition |
| 102 | 17425 | 931 | sync_from_lakebase | auth login | ❌ **NEVER run `databricks auth login`** (you are pre-authenticated), **NEVER use the SDK `databr | prohibition |
| 103 | 17579 | 931 | sync_from_lakebase | auth login | atalog was created or registered, and NO `databricks database create-database-catalog` / `databricks auth login` was run. If CDF was requested but unavailable, the fallbac | prohibition |
