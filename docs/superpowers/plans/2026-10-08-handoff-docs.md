# handoff-docs: the ledger, the parked list and the Genie Code smoke script (RUN.md DONE 3-4)

repo=app · base origin/feature/genie-code-mcp-integration after docs-refresh (#128) merges · docs only · plan path in PR: docs/superpowers/plans/2026-10-08-handoff-docs.md
Files (exactly): docs/superpowers/ledger.md (new), docs/superpowers/genie-code-smoke-script.md (new; D8 §8b already points here), this plan. docs/superpowers/decision-log.md only if a FORGE decisions.md ID is missing at the base (ID match per D-64; expect none). No src/, tests/, db/, scripts/ or manifest change; no trunk file.
Sources (read-only): FORGE/state/lead/status.md, queue.md, decisions.md; FORGE/state/probes/*.md; FORGE/state/release/last_deployed_sha; APP and TPL git history; the Phase 3 exit report, the Phase 2A gate report and the Phase 4 exit report in docs/superpowers/plans/; src/backend/workshop/manifest.json; the APP seed (served prompt text per step). Every number cites its source; nothing is estimated.

## L ledger.md
L1 Header: run dates, the final APP integration head and last deployed SHA + active deployment id (from FORGE/state/release/last_deployed_sha and the latest probe), the final TPL integration head (a77f33b or later), the test floor (the latest merged suite count).
L2 PR ledger: one row per PR merged by the forge into either integration branch (APP #107 onward, plus any earlier forge PRs recorded in status.md; TPL #18-#20): repo · PR · title · head SHA · merge SHA · reviewer/gatekeeper verdicts (rounds) · tests · genie gate · reseed · deploy id · live check (PASS n/m, probe file) · decisions. Rollbacks and re-lands as their own rows (e.g. #118 → rollback e56c47d → #122).
L3 Release candidates: TPL #21 (open, not merged; verdicts) and APP RC (open, not merged; filled in by the rc-app task: leave a row with "see rc-app" if it does not exist yet).
L4 Parked / held / open list: every queue.md row whose status is not done (park reason as recorded; held rows with their decision: D-61's 1023/1028/1029, D-62's 3 steps, app-family-fork-nits, deploy-stale-worktree-files, tpl-gate-preexisting-overages, and every B / P4 todo), grouped by: needs a human decision · needs a gate/tooling change · deferred follow-up.
L5 Human decisions pending: D-61 (the gate counting superseded versions), D-62 (the 90 s budget for 3 steps), the pre-existing TPL lock overages (TPL RC #21 B5), plus any other open question the Phase 4 exit report R6 lists.
L6 Cost: per the `Spend` human directive (decision-log, 2026-10-04) cost tracking stopped; `omnigent usage` returned 403 throughout. State that; do not estimate.
L7 HALTs: one line each (decision-log entries + status.md for #5/#6), as in polly-charter-autonomous.md.

## S genie-code-smoke-script.md (the human's Genie Code client smoke; exact steps)
S0 Prerequisites: a Databricks workspace with Genie Code in Agent mode; the app URL https://mcp-vibe-coding-workshop-app-7474656657532371.aws.databricksapps.com and its MCP endpoint https://mcp-vibe-coding-workshop-app-7474656657532371.aws.databricksapps.com/mcp (mounted at app.py:284 `app.mount("/mcp", mcp_app, name="mcp")`, behind MCP_MOUNT_ENABLED; documented in docs/specs/mcp_design/mcp-workshop-facilitator-guide.md:38). Add it as a Custom MCP server with the 5 steps of facilitator guide §2 (:34-40), quoted, and its start sentence (:42-43).
S1 Project setup: say the start prompt; project_setup serves the three gated commands built in src/backend/mcp_server.py:985-1006 (clone `git clone <template repo> /Workspace/Users/<email>/vibe-coding-workshop`; copy skills `D=/Workspace/Users/<email>; rm -rf "$D/.assistant/skills/vibe-coding-workshop"; mkdir -p "$D/.assistant/skills"; cp -R "$D/vibe-coding-workshop" "$D/.assistant/skills/"`; validate). Then, until TPL RC #21 merges, switch the clone to the integration branch and re-publish the skills, as exact commands run in Genie Code the same way project_setup runs its commands: (1) `git -C /Workspace/Users/<email>/vibe-coding-workshop fetch origin feature/genie-code-mcp-integration && git -C /Workspace/Users/<email>/vibe-coding-workshop checkout -B feature/genie-code-mcp-integration origin/feature/genie-code-mcp-integration`; (2) the same copy_cmd as above (re-publish); (3) the validate command from :1004-1006 (quote it in full from the file). Expected output for each, and how to confirm the branch (`git -C … rev-parse --abbrev-ref HEAD` → feature/genie-code-mcp-integration; `git -C … rev-parse HEAD` → the TPL integration head a77f33b or later). If git is not available in that context, say so as a known gap rather than inventing an alternative.
S2 Per track, all 14 (from manifest.json), a quick check: the start prompt to say ("Start the Genie Accelerator" for genie-accelerator, else "Start a workshop track" with `track: <id>`, per D-59 / the shipped prompts), the expected first step id and title, and "the outline matches the SPA" (how to compare: the SPA's track outline vs vibe_next_step's outline).
S3 Full walks, these five exactly (manifest.json has no family field; the families are the test groupings, tests/workshop/test_*_family_genie.py and test_covered_families_genie.py): genie-accelerator (31 steps), app-only (app family; 7 steps), lakehouse (lakehouse family; 11 steps), agents-accelerator (agents family; 29 steps), reverse-app (reverse family; 23 steps). Each was walked live by the forge prober; cite the latest probe per track (genie-accelerator and app-only: state/probes/89ee6f0…-cleanup-140-profile.md; agents-accelerator: state/probes/a7e1699…-p4-agents-a-1009.md; lakehouse: state/probes/9710bbd…-p4-lakehouse-family.md; reverse-app: the p4-covered-families probe at 0b07fc0; the implementer locates each file and quotes its step list). The step list per track is generated from manifest.json at the base (sections[].steps[] in order), and for each step the served row is the one the server resolves for genie-code (the highest active version of the genie-code fork if one exists, else the default row; D-57), read from the APP seed at the base. Per step: the step id, what Genie Code should do, the expected output/artifact, and the gate that completes it, taken from the served prompt text (seed row id cited). Include each coaching focus (vibe_explain_step focus what_now / why / unblock / review: what to ask, what a good answer contains) and the fail-open path (what the learner sees when generation falls back: e.g. iterate_enhance's template fallback per D-62; coaching is_fallback).
S4 Destructive step: workspace_cleanup (fork 1033) lists what it would delete and STOPs for `confirm cleanup`; the smoke must check the list contains only the participant's own resources BEFORE replying, and may decline.
S5 What to record and where to report (pass/fail per step; paste errors).
S6 Known gaps the smoke may hit: D-61 held rows (3 genie-accelerator steps still on v1 bare paths), D-62 budget fallbacks, deploy-stale-worktree-files.

## Acceptance
A1 exactly the listed files; additions only.
A2 L2 contains every forge-merged PR in both repos (checked against git log --merges of both integration branches over the run's range) exactly once.
A3 L4 contains every non-done queue.md row.
A4 S2 covers all 14 manifest tracks exactly once; S3 has the 5 full walks and every step of each walked track (vs manifest.json), each with a cited seed row.
A5 every number and SHA cites a source; no claim that the forge executed a served instruction.

## Green gates
pytest tests/workshop tests/api ≥ the floor, 0 failed (docs only).

## Tampers
X1 drop one merged PR from L2 → A2 fails.
X2 drop one non-done queue row from L4 → A3 fails.
X3 drop one track from S2 → A4 fails.
X4 drop one step from a full walk in S3 → A4 fails.

## Live checks
The docs-only deploy: /health 200, 7 tools.

## Release
MERGE repo=app reseed=no.

## Reverse
Revert the PR.
