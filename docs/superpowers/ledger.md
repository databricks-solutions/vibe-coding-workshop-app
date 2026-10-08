# Ledger: the autonomous Genie Code MCP run (2026-10)

This is the hand-off record of the forge run (RUN.md DONE 3-4). It lists every PR the forge merged into either integration branch, the release candidates, everything still open, the decisions waiting on a human, cost and the HALTs.

Conventions:
- "FORGE" means the workshop-forge checkout. Its `state/` files are the source for every number below unless another file is named.
- Probe files are under FORGE/state/probes/ and are named by the merge SHA they probed. Verdict files are under FORGE/state/verdicts/ and are named by the head SHA they judged.
- "R" is the reviewer verdict and "G" the gatekeeper verdict. A round is one review + gate pass on one head SHA. A re-gate of the same SHA after a spec defect is not a new round (D-7, D-60, D-63).
- The forge probes only read served text through MCP and REST. The forge executed no served instruction (Phase 4 exit report §5; every probe header). Executing them is what [genie-code-smoke-script.md](genie-code-smoke-script.md) is for.

## L1. Header

| Item | Value | Source |
|---|---|---|
| Run dates | 2026-10-02 (forge seeded, preflight) to 2026-10-08 (#128 merged 2026-10-08T04:13:59Z) | FORGE/state/lead/status.md:3 ("2026-10-02 seed"); `git log --merges` of the APP integration branch |
| First forge PR merged | APP #80, merge c280933, 2026-10-03T16:25:20Z | `git log --merges origin/feature/genie-code-mcp-integration` |
| Final APP integration head | `99660a93b8bb0c5e80a21e616061e9de8d023553` (merge of #128 docs-refresh) | `git rev-parse origin/feature/genie-code-mcp-integration` at this PR's base |
| Last deployed APP SHA | `99660a93b8bb0c5e80a21e616061e9de8d023553` | FORGE/state/release/last_deployed_sha |
| Active deployment | `01f1c2ced4cf1ddb824560da0127c0b5`, created 2026-10-08T04:15:01Z, SUCCEEDED, nothing pending | FORGE/state/probes/99660a93b8bb0c5e80a21e616061e9de8d023553-docs-refresh.md L0; status.md "2026-10-08T04:15Z docs-refresh MERGED + DEPLOYED" |
| Final TPL integration head | `a77f33bc23c80fb89919ab8dd4297b9903c0426a` (merge of TPL #20) | GitHub API `repos/databricks-solutions/vibe-coding-workshop-template/commits?sha=feature/genie-code-mcp-integration` |
| TPL main (the RC base) | `a26c6d0` | status.md, rc-template entry ("range main a26c6d0 .. a77f33b") |
| Test floor | 1640 (`tests/workshop tests/api`, 0 failed) | the last merged gate: the 619f216 gatekeeper verdict ("1640 passed, 0 failed"); re-run on this PR's base: `1640 passed, 2 warnings in 60.81s` |
| MCP tools | 7 | 99660a9…-docs-refresh.md L1b |
| Forge-merged PRs | APP 49 (#80-#128) plus 1 rollback commit (e56c47d); TPL 3 (#18-#20) | L2 below |

## L2. PR ledger

One row per PR the forge merged into `feature/genie-code-mcp-integration` in either repo (APP #80-#128, TPL #18-#20), plus the #118 rollback as its own row. APP #71-#79 and earlier on that branch came from the earlier `polly/*` run (their head branches are `polly/…`), not the forge. The forge's first APP PR is #80 (status.md:239, "app PR #80 sha 6229b99").

Where each column comes from:
- Title, head SHA and merge SHA: `gh pr list --json`.
- Verdicts and test counts: the verdict files for every head SHA of the PR. A FAIL that was later re-gated on the same SHA comes from status.md or queue.md, because the re-gate overwrites the file.
- Reseed and deploy id: the release record in status.md and the probe's L0. "not recorded" means that release record has no deployment id; ids are recorded from #96 on.
- Live check: the probe named by the merge SHA (or the named probe file).

| repo | PR | title | head SHA | merge SHA | verdicts (rounds) | tests passed | genie gate | reseed | deploy id | live check (probe) | decisions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| app | #80 | fix(mcp): handle engine.Blocked at every secondary next_step consumer (T5) | `6229b99` | `c280933` | R ACCEPT · G PASS (r1) | 529 | skipped | no | not recorded (status.md:283) | FAIL (L1 '0 errors surfaced' clause; scoped out by D-4, no rollback) — `c280933265a1a75094cacc8007d30ff81f78a75c-blocked-secondary-surfaces.md` | D-4, D-5 |
| app | #81 | chore(deps): pin databricks-sdk==0.139.0 (Phase 3 cleanup) | `8bd8222` | `3b893e7` | R ACCEPT · G PASS (r1) | 527 | skipped | no | not recorded (status.md:306) | PASS 4/4 — `3b893e7b50998b8d001fc28f312295215b0ab958-pin-databricks-sdk.md` | D-3, D-5 |
| app | #82 | test(mcp): pin untested offload + fallback paths from #77/#78/#79 | `d2b8385` | `45d89dc` | R ACCEPT · G PASS (r1) | 532 | skipped | no | not recorded (status.md:313) | PASS 2/2 — `45d89dca45398f559b4c23e01db7ba3a5d17dfd0-offload-fallback-tests.md` |  |
| app | #83 | chore(mcp): Phase 3 post-soak nits + drop dead skippedSteps alias | `f36b773` | `2cecfe4` | R ACCEPT · G PASS (r1) | 533 | skipped | no | not recorded (status.md:319) | PASS 4/4 — `2cecfe4f2630350618c54bbf96c951a1ba25eef9-phase3-nits.md` | D-2, D-3 |
| app | #84 | fix(session): close the _merge_app_gates read-modify-write race | `0cefb2c` | `f97f813` | R ACCEPT · G PASS (r1) | 541 | skipped | no | not recorded (status.md:325) | PASS 2/2 — `f97f81302fb5025d8d687e63871c23310da7473b-merge-gates-race.md` |  |
| app | #85 | post-check-answerable: accept completed steps' post comprehension answers | `a157aca` | `4d93628` | R ACCEPT · G FAIL (absolute lint only) → re-gate same SHA PASS (D-7) | 559 | skipped | no | not recorded (status.md:339) | PASS — `4d93628d2bc029ada7054209ef5e3e8d8bb5a3c9-post-check-answerable.md` | D-6, D-7 |
| app | #86 | intent-beat-explain-complete: explain and complete agree with get/next on the use-case beat | `eb8bf60` | `ad64c10` | R ACCEPT · G PASS (r1) | 566 | skipped | no | not recorded (status.md:354) | PASS 7/7 — `ad64c101939d35750affa2dd1e3c85128e05a553-intent-beat-explain-complete.md` | D-6, D-7, D-8 |
| app | #87 | frontend-lint-baseline: repo-wide lint to 0 errors | `1a74cac` | `f0d4d59` | r1 ed6c2b3: R ACCEPT · G FAIL; r2 1a74cac: R ACCEPT · G PASS | 559 backend; 24 frontend | skipped | no | not recorded (status.md:377) | FAIL (L4 only; pre-existing, scoped out by D-10, no rollback) — `f0d4d59db5cf695845d729ac4ad0f91ad0012b24-frontend-lint-baseline.md` | D-7, D-10 |
| app | #88 | mcp-gates-race: MCP writes persist their delta under a row lock | `2e03e2d` | `7479b29` | R ACCEPT · G PASS (r1) | 581 | skipped | no | not recorded (status.md:387) | PASS (scope per D-11) — `7479b296f9a38d023f9715f2cc6d6939419c88a9-mcp-gates-race.md` | D-11 |
| app | #89 | workflowstep-session-switch-restore: restore the target session's prompt on an in-page switch | `13a93fb` | `e6af06f` | R ACCEPT · G PASS (r1) | 581 | skipped | no | not recorded (status.md:399) | PASS 5/5 — `e6af06f61fb4c999adfa9f52ee354c271b6e3c49-workflowstep-session-switch-restore.md` |  |
| app | #90 | app-save-drops-unseen-mcp-gates: App gate writes merge against the gate set the SPA last saw | `476077c` | `957157f` | R ACCEPT · G PASS (r1) | 602 | skipped | no | not recorded (status.md:410) | PASS — `957157f894b8f99c2622853032b2a3750d50b9fd-app-save-drops-unseen-mcp-gates.md` | D-11 |
| app | #91 | usecase-beat-seed-prereq: the use-case beat has no project_setup prerequisite (seed text) | `f825976` | `64f0772` | R ACCEPT · G PASS (r1) | 604 | pass | no (D-14) | not recorded (status.md:428) | PASS (live row 958 unchanged by design, D-14) | D-14 |
| app | #92 | start-track-unknown-usecase: ignore an uncatalogued use case at vibe_start_track | `692a19b` | `49aa634` | r1 22e4a82: R ACCEPT · G FAIL; r2 692a19b (base merge after #91): R ACCEPT · G PASS | 612 | skipped | no | not recorded (status.md:441) | PASS 5/5 — `49aa634df97c30bfc3ddb95f3221334e793e5e1b-start-track-unknown-usecase.md` | D-15 |
| app | #93 | resolve-step-fallback: define and pin the authored-manifest fallback for filtered steps | `ae6411c` | `44f4fd7` | r1 65a72f4: R ACCEPT · G FAIL; r2 ae6411c: R ACCEPT · G PASS | 617 + 1 xfailed | skipped | no | not recorded (status.md:453) | PASS 5/5 — `44f4fd7f5dd2fb7743db02eb9a61432d086ec0a2-resolve-step-fallback.md` | D-16 |
| app | #94 | next-ref-filtered-step: get_step's next for a filtered step points at the next outline step | `4c5e647` | `17e8767` | R ACCEPT · G PASS (r1) | 627 | skipped | no | not recorded (status.md:467) | PASS (L0-L3) — `17e8767e90d4c1762f95bd0d93b9acbfd3e72af9-next-ref-filtered-step.md` | D-17 |
| app | #95 | dedicated-thread-pool: a workshop-sized default executor (VIBE_THREAD_POOL_SIZE) | `200b240` | `0f05bed` | R ACCEPT · G PASS (r1) | 640 | skipped | no | not recorded (status.md:476) | PASS (L0-L3) — `0f05bed2247f35c409cfa593275befdabc2e2568-dedicated-thread-pool.md` | D-18 |
| app | #96 | phase3-exit-gate: pin MCP == SPA outline per session; numeric-consumer allowlist; Phase 3 exit report | `f61b301` | `3d5b700` | R ACCEPT · G PASS (r1) | 662 | skipped | no | `01f1c04f8b5319b3a4ec317c4100e10c` | PASS 3/3 — `3d5b700195464c3da9af16e2acb9ce4ff5ef7865-phase3-exit-gate.md` | D-19 |
| app | #97 | test(phase3): X3b/X3c numeric step-set allowlists; correct exit-report F4 | `f121f62` | `58d067b` | R ACCEPT · G PASS (r1) | 664 | skipped | no | first deploy FAILED ×2 (lost Databricks credentials, HALT 2026-10-05); then 01f1c0c615b81621938289eed5b4d44c | PASS |  |
| app | #98 | Extract FMAPI seam to services/llm.py (D4 §1.2, D-20) | `03d0153` | `a175f3a` | R ACCEPT · G PASS (r1) | 668 | skipped | no | `01f1c0c73aff187aaa08c1e39dbd1378` | PASS 3/3 — `a175f3a3e45d0c4cea7db8cc69d6f0fda69c24c0-llm-service-extract.md` | D-20 |
| app | #99 | X3d/X3e: close the numeric step-set fence gaps (tests only) | `5907804` | `496588b` | R ACCEPT · G PASS (r1) | 672 | skipped | no | `01f1c0caadf41c398b3c6732268c19ae` | PASS 4/4 — `496588b197657449122e478d09c9502a3f220361-x3-pattern-gaps.md` |  |
| app | #100 | llm-extract follow-ups: SDK-flag patch target, E6 fail-not-skip, E7 guard (D-21) | `f3f1a3d` | `c63d6c8` | R ACCEPT · G PASS (r1) | 671 | skipped | no | `01f1c0cbc13b1056883ee4cc0609ae1d` | PASS 4/4 — `c63d6c8d5bc0c4a31fb63218244bbc0348ff9883-llm-extract-followups.md` | D-21 |
| app | #101 | coaching: optional focus on vibe_explain_step (D-22..D-25) | `f07e88e` | `e775185` | r1 96e6b9a: R ACCEPT · G PASS; final f07e88e: R ACCEPT · G PASS | 706 | skipped | yes (DDL 13) | `01f1c0d3e0ac15d9b441f249b4e1303a` | PASS 8/8 — `e775185de48f95aeca3673e6eac0bbaf4dc54ebd-coaching-explain-step.md` | D-22..D-25 |
| app | #102 | coaching: record the scrub reject rule (observability only, D-26) | `54b7691` | `54e255e` | R ACCEPT · G PASS (r1) | 721 | skipped | no | `01f1c0d8f9931017ac9252b283825cb8` | PASS 5/5 — `54e255e7c271f489f00e510d1c9f5b6925324f0d-coaching-scrub-tuning.md` | D-26 |
| app | #103 | llm: stop logging model output in call_databricks_serving_endpoint (D-27) | `dae41d4` | `4b57581` | R ACCEPT · G PASS (r1) | 728 | skipped | no | `01f1c0de110c1c37995e1f24d2245636` | PASS 4/4 — `4b57581aec86f7bdf66228705117f66c570c6458-llm-response-log-redact.md` | D-27 |
| app | #104 | routes/llm: log error class/status/length, not error or body text (D-28) | `da23f50` | `429eb46` | R ACCEPT · G PASS (r1) | 761 | skipped | no | `01f1c0e537aa1ae3b97ab5a3b7701fc2` | PASS 4/4 — `429eb46d61e5520dec31ae05a1085f1554067cd2-routes-log-redact.md` | D-28 |
| app | #105 | coaching: per-phase timing log and env knob overrides, no default changed (D-29) | `33b6553` | `7e2b537` | R ACCEPT · G PASS (r1) | 764 | skipped | no | `01f1c0ea0b4f15489d9f456ee1343cb1` | PASS 3/3 — `7e2b5377e28af9ac8b60000672e323201a997165-coaching-latency.md` | D-29 |
| app | #106 | docs: Phase 2A gate report (RUN.md §B) | `64dc564` | `e579ca2` | 226f9b2: R ACCEPT · G PASS; 64dc564: R ACCEPT · G PASS | 764 | skipped | no | `01f1c0edeae91cf3937ccb0b9c88c60d` | PASS 4/4 (PHASE 2A COMPLETE) — `e579ca20d64d1113b841d084b2dacff1536e91d0-phase2a-gate-report.md` | D-20..D-29, D-25a |
| app | #107 | P4.1: walk the session's track instead of the genie-accelerator pin | `266de65` | `7329736` | R ACCEPT · G PASS (r1) | 814 | skipped | no | `01f1c0f4dc501952ad9ad5c32896a1b1` | PASS 4/4 — `7329736dd3db506c50e95e11ed0e75404428029c-p4-track-scoped-walk.md` | D-30, D-30a, D-31, D-32 |
| app | #108 | P4.2: hoist use_case_selection onto every track's prd_generation (D-33, D-34) | `d6db59e` | `7c76a62` | R ACCEPT · G PASS (r1) | 861 | pass | yes — the tables step DROPPED and recreated the live tables (INCIDENT, HALT; status.md:712) | `01f1c0fd3a9316bf8fe2814de07a3767` | PASS 5/5 — `7c76a628bea842a7b212bd592fc46bc034945280-p4-usecase-hoist.md` | D-33, D-34, D-36 |
| app | #109 | fix(tables-step): additive by default; destructive reseed needs double opt-in (D-35, incident fix) | `f0d94f0` | `ca9ff61` | R ACCEPT · G PASS (r1) | 877 | skipped | no (code-only) | `01f1c135384a1c9ea15d8e51156d30d0` | PASS 4/4 (probes/tables-step-nondestructive.md) | D-35 |
| app | #110 | feat(seed): new seed rows reach existing installs via baseline + ledger (D-37) | `9565eb6` | `5e0ed6e` | R ACCEPT · G PASS (r1) | 924 | skipped | tables step create mode 0/0 | `01f1c13f433a1826bec770c29ba5ea99` | PASS 5/5 (probes/seed-new-rows-existing-install.md) | D-37 |
| app | #111 | test(start-track): pin unknown-pair step-1 credit (U7) + resume path (U8a/U8b) | `8272438` | `aca30f7` | R ACCEPT · G PASS (r1) | 929 | skipped | no (code-only) | `01f1c142d0921d82881bcb931d3091fc` | PASS 3/3 — `aca30f794a86b3fa1e089077be7f5164ee515365-start-track-unknown-pins.md` |  |
| app | #112 | fix(seed): close the D-37 insert/ledger crash windows (D-38) | `618bcb6` | `658cbe3` | R ACCEPT · G PASS (r1) | 931 | skipped | DDL 15 applied, 0/0 | `01f1c14626be1420b554d26b272fb541` | PASS 4/4 — `658cbe3b3558b26b7f1e4158ab1273fc3dc3e95e-seed-ledger-crash-window.md` | D-38 |
| app | #113 | fix(seed): WARN and skip an S4 row that hits uq_section_assistant_version_active (D-40) | `bee7e4d` | `22a0402` | R ACCEPT · G PASS (r1) | 947 | skipped | no (code-only) | `01f1c149d36a1f5a819d564a97261f3e` | PASS 3/3 (L2 deferred) — `22a0402f92b59d9a46c7a210b10fd69f3febfb3b-seed-unique-conflict.md` | D-40 |
| app | #114 | feat(seed): genie-code forks for workspace_setup_deploy + redeploy_test (P4.3 app family, D-39) | `236536b` | `6230f58` | R ACCEPT · G PASS (r1) | 968 | pass | yes (forks 1001/1002) | `01f1c1511724153dbc76ff8e7ba0d370` | PASS 6/6 (queue.md p4-app-family) — `6230f58c10d314469febb1c672c6c83ea646aa9a-p4-app-family.md` | D-39 |
| app | #115 | feat(seed): genie-code fork 1003 for optimize_genie (P4.3 lakehouse family, D-41) | `8e0ad65` | `9710bbd` | r1 e2faaf4: R BLOCK (1003 bundle mechanics) · G PASS; fix-up 8e0ad65: R ACCEPT · G PASS | 1060 | pass | yes: 1 inserted, sequence 1003→1004 | `01f1c210b4621dcb8e76e75bf62435c7` | PASS 6/6 — `9710bbd2f2fe9738243ffa52b1ad477ac1796fa0-p4-lakehouse-family.md` | D-41 |
| app | #116 | test(genie): P4.3 covered families walkable in Genie Code (end-to-end, accelerator, de-accelerator, reverse-lakebase, reverse-app; D-43, D-44) | `080ec93` | `0b07fc0` | R ACCEPT · G PASS (r1) | 1250 | pass | no | `01f1c218dc4c10c0abab2df99009e283` | FAIL at the time: 3/5 (data-engineering-accelerator failed on the pre-existing width defect D-48; closed by #122, live 5/5) — `0b07fc05b968b3fbacd677413ab4e49032630d3f-p4-covered-families.md` | D-43, D-44, D-48 |
| app | #117 | feat(seed): genie-code forks 1004-1006 for skills-accelerator (P4.3 family 5, D-45, D-46) | `07e434a` | `ac40295` | 07e434a (after base merge; was 5708c05): R ACCEPT · G PASS | 1282 | pass | yes: 3 inserted, sequence 1004→1007 | `01f1c24e75ff17ecbbafe378390c4bcd` | PASS 4/4 — `ac40295cbee341af9dc6d216ae86774b7064b4f7-p4-skills-accelerator.md` | D-45, D-46 |
| app | #118 | fix(sessions): widen workshop_level to VARCHAR(64); vibe_start_track fails closed (D-48, D-49) | `8c53b7e` | `4540e86` | 8c7133c: R ACCEPT · G PASS; 8c53b7e (base merge): R ACCEPT · G PASS | 1286 | skipped | DENIED by policy (DDL 16 flagged human-only) → rollback | none (code not deployed; rolled back) | — (rolled back before any live check) | D-48, D-49, D-50 |
| app | rollback of #118 | Revert "Merge pull request #118 …" (direct commit on the integration branch, no PR) | — | `e56c47d` | release ROLLBACK after the denied reseed (D-50) | — | — | no | `01f1c251372419b4ac7361ce9fbbe6c2` | PASS — `rollback-e56c47d.md` | D-50; re-landed as #122 (D-55) |
| app | #119 | feat(seed): genie-code forks 1007-1010 for agents-accelerator foundation (P4.3 family 6A, D-47) | `9281bd0` | `7c3712c` | r1 0287450: R BLOCK (fork 1009) · G PASS; r2 9281bd0 (1009 dropped): R ACCEPT · G PASS | 1337 | pass (INSESSION_CREATE 129→129) | yes: 3 inserted, sequence 1007→1011 | 01f1c2608e0418d6877e495dab187df6 (code-only retry) | PASS 4/4 — `7c3712cc8436e5555fef2bdd13c0a47a1276003f-p4-agents-a.md` | D-47, D-51 |
| app | #120 | feat(seed): genie-code forks 1011-1016 for the agents-accelerator MLflow SDLC loop (P4.3 family 6B, D-52) | `ee11542` | `7c014d7` | R ACCEPT · G PASS (r1) | 1410 | pass | yes: 6 inserted, sequence 1011→1017 | `01f1c268609e1ba6b343524caea66f46` | PASS 4/4 — `7c014d745395300dfcda24b6f704885e7d3591f1-p4-agents-b.md` | D-52 |
| app | #121 | feat(seed): genie-code fork 1017 genie_silver_metadata + genie-accelerator family test (P4.3 reference, D-53) | `ed3d47c` | `d0e9fe7` | R ACCEPT · G PASS (r1, after the HALT #6 resume) | 1553 | pass (80→80) | yes: 1 inserted, sequence 1017→1018 | `01f1c285997d158b88362d62d986e948` | PASS 4/4 — `d0e9fe7ddec2ff4f2ec4f6ceab98f9daa304330a-p4-genie-reverify.md` | D-53, D-54 |
| app | #122 | Re-land #118: widen sessions.workshop_level to VARCHAR(64) (DDL 16) + SESSION_NOT_SAVED (D-55) | `831b5a6` | `7e4144d` | R ACCEPT · G PASS (r1) | 1557 | skipped | yes: tables (DDL 16) then code | `01f1c28995f6141e8bc30646c1ea4c65` | PASS 5/5 — `7e4144d3eb3c08626fb25224fce5df0e645e5f91-workshop-level-reland.md` | D-55 |
| app | #123 | p4-agents-a-1009: genie-code fork 1009 for uc_resources_foundation (RULE_10 foundation carve-out, D-56) | `bcc177b` | `a7e1699` | R ACCEPT · G PASS (r1) | 1568 | pass (125→125) | yes: 1 inserted, sequence kept at 1018 | `01f1c2959ba51e2f94dccf7924d028f9` | PASS 4/4 — `a7e169938b49ae2aeac00a95d4d10dddbaa35991-p4-agents-a-1009.md` | D-56 |
| app | #124 | p4-spa-any-track: Genie Code panel names the start prompt for the session's track (P4.5, D-59) | `091b457` | `b260c64` | 51b8aa6: R ACCEPT · G PASS; fix-up r1 091b457: R ACCEPT · G FAIL (fence spec defect) → re-gate same SHA PASS (D-60) | 1569; node 47/47 | skipped | no | `01f1c29a954718d6abec3ff8e4bdf58e` | PASS 4/4 — `b260c646b6a39d85b70f472cea695155d424b6b4-p4-llm-steps.md` | D-59, D-60 |
| app | #125 | genie-forks-bare-paths: 12 v2 genie-code rows root the genie-accelerator forks' bare paths (D-57; 3 held by D-61) | `00e6f20` | `687cd4d` | R ACCEPT · G PASS (r1); merge waited on HALT #7 | 1599 | pass (80→80) | yes: 12 inserted, sequence 1018→1033 | `01f1c2b888161daab7edd528ef433e9f` | PASS 5/5 — `687cd4d1bbfab87e301a750e519d0947aa9ca877-genie-forks-bare-paths.md` | D-57, D-61 |
| app | #126 | cleanup-140-profile: genie-code fork 1033 for workspace_cleanup, participant-scoped, confirm-before-delete (D-58) | `ad68235` | `89ee6f0` | r1 038bc06: R BLOCK (catalog scope) · G FAIL (tamper-target spec defect) → re-gate same SHA PASS (D-63); fix-up ad68235: R ACCEPT · G PASS (r2 of 2) | 1640 | pass (80→80) | yes: 1 inserted, sequence 1033→1034 | `01f1c2c1574b1b90999eed1dfd1d9bd5` | PASS 5/5 — `89ee6f063251437563069abc99dff0438db81ae0-cleanup-140-profile.md` | D-58, D-63 |
| app | #127 | p4-exit-gate: Phase 4 exit gate report (RUN.md P4.6) + decision-log catch-up | `13c52ac` | `d97a3df` | R ACCEPT · G PASS (r1; pre-review fix-up per D-64) | 1640 | skipped | no | `01f1c2c70cc918efb08d7c4faa5857bf` | PASS 8/8 — `d97a3df9f89efb0e8e12a6ed60bb2de7dffbe433-p4-exit-gate.md` | D-64 |
| app | #128 | docs-refresh: bring the design docs up to what shipped (RUN.md C) | `619f216` | `99660a9` | r1 c0f9d2c: R ACCEPT · G FAIL (A3 factual mismatch); r2 619f216: R ACCEPT · G PASS | 1640 | skipped | no | `01f1c2ced4cf1ddb824560da0127c0b5` | PASS (L0, L1a-d, L2) — `99660a93b8bb0c5e80a21e616061e9de8d023553-docs-refresh.md` | D-65, D-66 |
| template | #18 | fix(audit): catch bare ./x.sh in SETUP_SCRIPT / SCRIPT_DEPLOY (D-42) | `1d6ee10` | `775bebc` | 1d6ee10: R ACCEPT · G FAIL (spec defects G1/T1-T3) → specs amended → re-gate same SHA PASS (D-7 precedent); merge waited on HALT #2/#3 | n/a (no template suite) | pass | n/a | n/a (template, never deployed) | — | D-42 |
| template | #19 | RULE_10 second carve-out: prefixed foundation CREATE SCHEMA/VOLUME IF NOT EXISTS (D-56) | `77a8b60` | `edb07a9` | r1 4b94f59: R BLOCK · G FAIL; fix-up r1 77a8b60: R ACCEPT · G PASS (r2) | n/a (61/61 scan cases, 25/25 mock) | pass (INSESSION_CREATE 129→125 at 4b94f59) | n/a | n/a (template, never deployed) | — | D-56, D-56a |
| template | #20 | docs(00-overview): RULE_9 names the SDK SNAPSHOT deploy as canonical on Genie Code (D-44) | `9854978` | `a77f33b` | r1 6d95892: R ACCEPT · G PASS; fix-up r1 9854978 (S2b): R ACCEPT · G PASS (r2) | n/a (no template suite) | pass (80→80) | n/a | n/a (template, never deployed) | — | D-44 |

Rows the table does not show on its own:
- **#118 → rollback e56c47d → #122.** #118 merged as 4540e86, but its tables reseed was denied by policy: the guard matched the word "truncate" in a DDL 16 comment. Nothing was deployed. Release reverted the merge as e56c47d (tree identical to ac40295) and redeployed code-only as `01f1c251…`. #122 re-landed it after the human ruling D-55 and forge 75eee97 (status.md "workshop-level-too-narrow MERGED but RESEED DENIED → ROLLBACK → PARK", "ROLLED BACK; PARKED"; queue.md:57).
- **#116's live FAIL** was the pre-existing `sessions.workshop_level` varchar(20) defect (D-48), not #116's tests. #122 closed it: DE sessions save and walk to Done, live 5/5 (queue.md:53, :57).
- **#80 and #87's live FAILs** were scoped out by human decisions D-4 and D-10, with no rollback. The defects they hit got their own queue rows, which shipped as #85, #86 and #89.

## L3. Release candidates

| Repo | PR | Head | Base | State | Verdicts | Notes |
|---|---|---|---|---|---|---|
| template | #21 "Release candidate: Genie Code MCP integration (template)" | `a77f33bc23c80fb89919ab8dd4297b9903c0426a` (the integration branch; no commit added) | main `a26c6d0` | OPEN, not merged (autoMergeRequest null) | R ACCEPT (0 blocking, 3 nonblocking) + G PASS on a77f33b (the a77f33b verdict files) | Range #18/#19/#20, 8 files +589/-42. Genie gate PASS under D-66: the raw own-ref FAIL is the #18 scorer change; a same-scorer run shows no key growth except genai-agents::INSESSION_CREATE 21→19 (-2, D-56). Tamper gating per D-65. **Before merging, the human resolves D-67** (L5). Any fix moves the head, so RC #21 then needs a re-review and a re-gate (status.md, "TPL RC #21 gatekeeper PASS on a77f33b"). Merge order: TPL before APP (status.md, rc-template plan). |
| app | see rc-app | — | — | not opened yet | — | queue.md:79 records "rc-app planning (critic)". The rc-app task fills in this row. |

## L4. Parked, held and open

Every FORGE/state/lead/queue.md row whose status is not done, counting the rows packed onto one physical line with `\n` separators (lines 18, 36 and 39 hold several rows each). The second tpl-audit-bare-sh row (:50) has its status in the lane column, and that status is "done (template #18 merged 775bebc)", so it is not listed. Park reasons and statuses are quoted as recorded. The rows are grouped by what unblocks them. Two items here come from rows the queue marks done: the held rows of genie-forks-bare-paths (D-61) and of p4-llm-steps (D-62), listed under their decisions.

### L4.1 Needs a human decision

| Row (queue.md line) | Status as recorded | Reason / decision | Human item |
|---|---|---|---|
| tpl-overview-carveouts (:75) | PARKED (D-67: 2 critic BLOCKs) → HUMAN before merging TPL RC #21 | five TPL passages still say ONE sanctioned exception (vs D-56) or App via `apps deploy` (vs D-44); F0 `deploy_verb` | L5 item 4 and item 5 |
| p4-llm-steps (:73) | PARTLY DONE / PARKED (D-62) | iterate_enhance (14), skill_define_strategy (131), skill_create_skillmd (132) fall back to the template on the 90 s budget | L5 item 2 |
| genie-forks-bare-paths, held rows (:71, status done) | 3 rows held, D-61 | v2 rows 1023 gagent_describe, 1028 gaccel_dashboard, 1029 gaccel_activation not shipped; the tags stay on v1 934/940/941 | L5 item 1 (a gate change; see L4.2) |
| agents-213-execution-label (:66) | todo (after p4-agents-b) | D-52b: the 213 default says labelling is a human step, but the manifest serves mlflow_human_review_and_signoff as agent-doable; the fix needs a charter exception (generate_manifest.py + manifest.json) | charter exception |
| release-preflight-untracked (:37) | todo | HALT 2026-10-06: the untracked test_errors.py reached 3 code deploys (658cbe3, 22a0402, 6230f58), because release's preflight uses `--untracked-files=no` | "human: refuse untracked files or deploy from a clean worktree; redeploy 6230f58 clean" |
| tpl-gate-preexisting-overages (:51) | todo: investigate first (real Genie Code issues, or a stale lock?) | at TPL a26c6d0 genie_gate.py already exceeds its lock: apps_lakebase::GENIE_RESOURCE 8→14, data_product_accelerator::BARE_ARTIFACT_PATH 8→10, skills::APP_DEPLOY 108→114, skills::INSESSION_CREATE 14→17 | L5 item 3 (TPL RC #21 B5 explains them; re-lock or fix is the human's call) |

### L4.2 Needs a gate or tooling change

| Row (queue.md line) | Status as recorded | Reason |
|---|---|---|
| D-61 held rows (from genie-forks-bare-paths :71) | held | the genie gate counts superseded seed versions in the raw-seed scan, so a v2 row that repeats a counted v1 line reads as growth (apps_lakebase::APP_DEPLOY 1664→1665, INSESSION_CREATE 125→126). FORGE/tools is outside the lead's write scope and genie_gate_diff.py has no waiver (D-61) |
| tpl-gate-preexisting-overages (:51) | todo | see L4.1; the fix is in the TPL gate lock or the content |
| deploy-stale-worktree-files (:76) | todo: investigate (stale files in the workspace source path?); low; report in the handoff if not resolved | probe-p4-exit-gate (d97a3df): the code deploy's build log lists files under `.worktrees/mcp-p1-server/`, though APP/.worktrees does not exist, .gitignore:54 ignores it and databricks.yml:121 sync-excludes `.worktrees/**`. Not resolved in this run. "no deletion without a human" |

### L4.3 Deferred follow-ups

| Row (queue.md line) | Scope | Status as recorded | Note as recorded (short) |
|---|---|---|---|
| complete-project-setup-latency (:18) | B | todo | vibe_complete_step(project_setup) takes 17-38 s (next-step PRD generation inside the response) |
| off-outline-output-leak (:18) | B | todo | an off-outline completed step's captured output reaches activation prompts via resolve_previous_outputs; refuse or filter, decide by protocol |
| gatebase-write-seq (:18) | B | todo | out-of-order SPA gate-write results can shrink lastServerGatesRef; fails safe |
| workflowstep-stream-generation-token (:18) | B | todo | a late stream chunk can overwrite the restored prompt after a switch |
| visibility-400-fresh-session (:18) | B | todo | GET /api/config/visibility returns 400 before an assistant is chosen; console noise |
| usecase-beat-post-check (:19) | B | todo | the beat's post check never surfaces on the lock path |
| usecase-gate-sticky (:25) | B | todo | the step-1 gate stays after clearing industry or use case; investigate reachability first |
| header-count-projection (:26) | B | todo | #96 plan Finding F5 |
| x3-fence-nits (:30) | B | todo | X3/E7 fence nits; U8b should assert session_id; a V2 case for a 23505 with no diag |
| mcp-honours-step-enabled (:38) | B | todo | step_enabled=FALSE hides a step in the SPA only; the MCP outline ignores it; intended or a defect? |
| outline-locked-but-served (:39) | B | todo | semlayer_locate shows 'locked' in a fresh genie-accelerator outline yet get_step serves it |
| app-family-fork-nits (:39) | P4 | partly planned …; nits 1-2 (fork 1001 BODY edits) HELD | an existing-row edit never reaches a live install (D-37); the v2 mechanism (D-57) now unblocks it (:71 notes) |
| fresh-install-crash-skips-03 (:40) | P4 | todo | a crash during the 01/02 bulk seed makes the retry skip 03; low |
| seed-958-help-wording (:41) | P4 | todo | row 958 how_to_apply / expected_output still say "Genie Code journey" / "Genie space"; the live row is a human follow-up |
| usecase-beat-current-mismatch (:42) | B | todo (narrowed by #108: only the uncatalogued-pair D-13 path remains) | start_track reports project_setup while explain resolves the beat |
| step-prompt-singleflight-migrate (:45) | B | todo | move the step-prompt path onto the coaching single-flight helper (D-24) |
| skills-track-silent-fallback (:59) | P4 | todo: investigate first | without the build_skill lock, skills-accelerator silently runs as end-to-end |
| agents-b-pin-nits (:65) | C | todo (after p4-agents-b; can fold into the next seed-02 PR) | `_GATE` misses the either-or form; fork 1014's step number |

### L4.4 Closed by other means, superseded or stale (status not recorded as done)

| Row (queue.md line) | Status as recorded | Where it actually stands |
|---|---|---|
| workflowstep-session-switch-restore (:18) | todo | the slug cell says "DONE #89 13a93fb → merge e6af06f; probe PASS 5/5" (L2 #89) |
| app-save-drops-unseen-mcp-gates (:18) | todo | the slug cell says "DONE #90 476077c → merge 957157f" (L2 #90) |
| usecase-beat-seed-prereq (:18) | todo | the slug cell says "DONE #91 f825976 → merge 64f0772"; the live row 958 keeps the old prerequisite (D-14) → "human admin-UI follow-up" |
| lakebase-recovery (:36) | CLOSED 2026-10-06T03:53Z | the human chose option (c), no restore (D-36) |
| p4-end-to-end (:52) | merged into p4-covered-families (D-43) | shipped in #116 |
| workshop-level-too-narrow (:54) | PARKED (D-50) | superseded by workshop-level-reland (D-55), shipped as #122 |
| docs-workshop-level-width (:58) | folded into workshop-level-reland (R2) | shipped in #122 |
| tpl-rule9-wording (:60) | todo | shipped as TPL #20 (merge a77f33b, L2) |
| rc-app / rc-template / docs-refresh / handoff (:79) | docs-refresh DONE (#128 99660a9, live PASS); rc-template OPEN TPL #21 …; handoff-docs impl; rc-app planning (critic) | docs-refresh: L2 #128; rc-template: L3; handoff: this PR; rc-app: L3 "see rc-app" |

## L5. Human decisions pending

The forge takes none of these.

1. **D-61: change the genie gate so it counts only the highest active version?**
   - At issue: the 3 v2 rows 1023/1028/1029.
   - (a) Count only the highest active version per (section_tag, coding_assistant) in the raw-seed scan, or skip the raw .sql where section files exist. The 3 rows then ship unchanged.
   - (b) Keep the gate. The 3 tags stay on v1 934/940/941 and keep their bare `docs/…` paths.
   - Sources: decision-log D-61; Phase 4 exit report §6 Q1.
2. **D-62: the 90 s step-prompt budget for iterate_enhance, skill_define_strategy and skill_create_skillmd.**
   - Evidence: iterate_enhance falls back to the template on 14/14 tracks. 15 of the 16 abandoned generations also truncate, so raising the budget alone would not help.
   - Options: (a) a larger max_tokens or a smaller output contract for rows 14/131/132; (b) async or deferred generation; (c) accept the template fallback (current; fails open, never empty); (d) raise `STEP_PROMPT_BUDGET_S` (mcp_server.py:798).
   - Sources: decision-log D-62; b260c64…-p4-llm-steps.md; Phase 4 exit report §6 Q2.
3. **The pre-existing TPL genie_gate.py lock overages (TPL RC #21 B5).**
   - genie_gate.py FAILs at both a26c6d0 and a77f33b, so the overages are pre-existing. Total delta: -115 (main) vs -131 (head). Main is also over-lock on apps_lakebase::INSESSION_CREATE 136→139, which is gone at head.
   - The queue row lists GENIE_RESOURCE 8→14, BARE_ARTIFACT_PATH 8→10, skills::APP_DEPLOY 108→114 and skills::INSESSION_CREATE 14→17 at a26c6d0.
   - The choice: are these real Genie Code issues to fix, or a stale lock to re-lock with evidence?
   - Sources: status.md, "rc-template STOP"; queue.md:51.
4. **D-67: reconcile 5 TPL passages with D-56 (two RULE_10 carve-outs) and D-44 (SDK SNAPSHOT canonical) before merging TPL RC #21.**
   1. 00-overview :28-38, the authoring note ("one sanctioned exception").
   2. 00-overview :42-43, locked decision 1 ("App via `apps deploy`").
   3. 00-overview :151, the RULE_8 row ("the **one sanctioned exception** to the authoring discipline").
   4. skills/databricks-asset-bundles/SKILL.md:426 ("This is the **one sanctioned exception** to the authoring discipline").
   5. skills/genie-code-environment/SKILL.md:368, learner-facing ("The only sanctioned in-session creation is RULE_8 **Tier 3** Genie-Space `createAsset`"). This line can make Genie Code refuse the sanctioned F0 `CREATE SCHEMA/VOLUME IF NOT EXISTS` (fork 1009, uc_resources_foundation).
   - The plan with S1-S3b is at FORGE/state/lead/plans/tpl-overview-carveouts.md; the 2 skill lines need the same treatment. Any fix moves RC #21's head → re-review + re-gate.
   - Sources: decision-log D-67; status.md, "2026-10-08 tpl-overview-carveouts PARKED".
5. **F0 `deploy_verb`.** The F0 SKILL.md frontmatter says `deploy_verb: bundle_deploy`. This is pre-existing and flagged nonblocking by the RC #21 reviewer. No code reads `deploy_verb` (lead check: 0 hits in *.py/*.sh/*.json/*.yml; 80 md files use bundle_deploy/apps_deploy/none). Keep it, or change it to match D-44/D-56? It is a semantics choice, so the lead left it (protocol 3). Sources: status.md, "TPL RC #21 reviewer ACCEPT on a77f33b"; D-67.
6. **The Phase 4 exit report's open questions (§6, "R6").** That section lists exactly two questions, Q1 (D-61) and Q2 (D-62), which are items 1 and 2 above. It states "Cost is not a question" (L6).

Also waiting on a human, recorded in L4.1: the agents-213 charter exception (D-52b), and the release runbook for untracked files (release-preflight-untracked).

## L6. Cost

The human directive "Spend" (2026-10-04, decision-log) says: stop tracking cost until it actually blocks the run. Cost tracking stopped then. Before that, `omnigent usage` returned 403 Forbidden (status.md:268), and the status notes recorded the cost as unreadable. This ledger gives no cost figure, and none is estimated.

## L7. HALTs

The numbered set follows the autonomous charter (docs/specs/mcp_design/polly-charter-autonomous.md §6). The decision log has five HALT entries: an unnumbered "HALT (2026-10-06T07:35Z)", plus #2, #3, #4 and #7. #5 and #6 are only in the forge status log.

- **HALT (2026-10-06T07:35Z):** unauthorized writes by a non-implementer role into the APP main checkout; a guard that should have denied did not (decision-log "HALT (2026-10-06T07:35Z)"; status.md:861).
- **HALT #2 (2026-10-06T23:30Z):** plan_critic ran `git checkout` and `genie_gate.py` in the human's TPL checkout, and `read_only_shell` did not deny it (decision-log "HALT #2"; status.md:910).
- **HALT #3 (2026-10-07T04:27Z):** release could not merge, because the active gh account was not prashsub (decision-log "HALT #3"; status.md:956).
- **HALT #4 (2026-10-07T06:48Z):** disk full (110 MiB free) blocked suites, builds and deploys (decision-log "HALT #4"; status.md:1014).
- **HALT #5 (2026-10-07T16:45:50Z):** `clean_checkouts` DENY, because APP had an untracked file (p4-genie-reverify-pr.md) (status.md:1121).
- **HALT #6 (2026-10-07T17:22Z):** preflight step 0 failed, because a duplicate lead session was launched from the APP checkout (status.md:1128, :1135).
- **HALT #7 (2026-10-07T23:09Z):** release could not merge #125, because the active gh account had changed outside the pipeline (decision-log "HALT #7"; status.md:1258).

Earlier stops, recorded in status.md only and outside the numbered set:
- preflight HALTs on 2026-10-02/03 (status.md:7, :30)
- the run #6 disk-full HALT (status.md:214)
- the 2026-10-05 lost-Databricks-credentials HALT after #97 (status.md:522)
- the 2026-10-05 reseed INCIDENT HALT after #108 (status.md:712)
