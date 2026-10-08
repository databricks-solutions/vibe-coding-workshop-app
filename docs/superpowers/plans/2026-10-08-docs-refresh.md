# docs-refresh: bring the design docs up to what shipped (RUN.md C, "docs refreshed")

repo=app · base origin/feature/genie-code-mcp-integration after p4-exit-gate (#127, d97a3df) · docs only · plan path in PR: docs/superpowers/plans/2026-10-08-docs-refresh.md
Files (exactly; nothing else): docs/specs/mcp_design/mcp-workshop-rollout.md (D9), docs/specs/mcp_design/mcp-workshop-usecase-selection.md (D11), docs/specs/mcp_design/mcp-workshop-engine.md (§11), docs/specs/mcp_design/mcp-workshop-test-plan.md (D8 §8), docs/specs/mcp_design/README.md, README.md (repo root), docs/specs/mcp_design/polly-build-charter.md, docs/specs/mcp_design/polly-charter-next.md, docs/specs/mcp_design/polly-charter-phase3.md (banners only), docs/specs/mcp_design/polly-charter-autonomous.md (new), docs/superpowers/plans/2026-10-08-phase4-exit-report.md (one citation fix), docs/superpowers/decision-log.md (append any FORGE decisions.md entry whose ID is still missing, per D-64), and this plan. No src/, tests/, db/, scripts/ or manifest change; no trunk file.
Ground truth (protocol 1: shipped code decides): src/backend/workshop/manifest.json `tracks` (14), src/backend/mcp_server.py (7 tools; prompts), the Phase 3 exit report, the Phase 2A gate report, the Phase 4 exit report (docs/superpowers/plans/2026-10-08-phase4-exit-report.md), and docs/superpowers/decision-log.md. Every changed statement cites one of these (file:line at the base or a D-number). Where a doc states a plan that did not ship, say "not shipped" with the decision; never delete history, mark it.

## Changes
S1 D9 (mcp-workshop-rollout.md):
 - §1 phase table: Phase 4 row status = what shipped per the Phase 4 exit report (P4.1-P4.5 verdicts, incl. P4.4 PARTIAL D-62 and the D-61 held rows); "all ten tracks" → the 14 manifest tracks (:44, :63), listing them once.
 - §5 STOP-and-ask gates: add the run's human gates as shipped (D-29 / D-62 budget changes are human; destructive data ops are never automatic; main is human-only).
 - §7 per-phase verification gates: add Phase 2A and Phase 4 rows pointing at their reports, and state the gate actually used (offline suite floor, genie_gate_diff no key growth, tampers, live probe).
 - §9 open questions: mark each as resolved (with the decision) or still open; add the open human questions from the Phase 4 exit report R6 (D-61 gate change, D-62 budget).
S2 D11 (mcp-workshop-usecase-selection.md): "ten tracks" → 14 (:6, :44, :75, :266); open q1 (hoisting use_case_selection into the shared define-usecase section) marked resolved by P4.2 (#108 or the PR the Phase 4 exit report names) with its evidence.
S3 Engine doc §11 "Extensibility to all tracks" (mcp-workshop-engine.md:378): describe the 14 tracks as shipped (track-scoped walk P4.1/D-30, the genie-code fork mechanism incl. versioned rows D-57, per-track parity tests), citing manifest.json and the family tests.
S4 D8 §8 (mcp-workshop-test-plan.md:178): split into §8a "Scripted smoke (prober)": what the forge prober runs (HTTP + MCP walks, read-only DB, served text only, never executes served instructions), and §8b "Human Genie Code client smoke": real client execution, pointing at docs/superpowers/genie-code-smoke-script.md (written by the handoff task; name the path even if it lands after this PR).
S5 READMEs: docs/specs/mcp_design/README.md status column / phase bullets updated to shipped state (Phase 2A shipped, Phase 3 shipped, Phase 4 per its report, 14 tracks, 7 tools) and the new polly-charter-autonomous.md listed; repo README.md: only where it states track count, tool count or phase status (grep first; if it states none, leave it untouched and say so in the PR body, and drop it from the file list).
S6 Superseded banners: at the top of polly-build-charter.md, polly-charter-next.md, polly-charter-phase3.md insert one blockquote line: "> **Superseded (2026-10-08)** by [polly-charter-autonomous.md](./polly-charter-autonomous.md); kept as history." Nothing else in those files changes.
S7 New polly-charter-autonomous.md: how this run was governed, from FORGE/RUN.md and the lead charter (read-only): roles (lead, plan_critic, implementer, reviewer, gatekeeper, release, prober) and the model-family separation rule; the pipeline (plan → critic → implement → review + gate on the same head SHA → release → probe; fix-up rounds; the 2-round / 3-attempt circuit breakers); the decision protocol (shipped code → doc recommendation → most reversible), the decision log; guards (verdict custody, clean checkouts, trunk-file serialization and charter exceptions, deploy guard, main human-only, never deploy older than f7731c0); HALT conditions and the HALTs that happened (HALT #2-#7 from the decision log, one line each); what the human does (smoke, RC review). Facts only, each with a D-number or RUN.md citation.
S8 Phase 4 exit report :84 citation fix (#127 reviewer nonblocking): the NO_FORK constants it cites do not contain use_case_selection; cite where its no-fork is actually recorded (the decision or test that pins it), or state that it has no NO_FORK entry and why. Only that sentence changes.
S9 decision-log: append verbatim any FORGE/state/lead/decisions.md entry whose ID is not yet in the APP log (ID match per D-64).

## Acceptance
A1 exactly the listed files (README.md only if S5 found something); every diff outside the new file and the decision log is a replacement of the named passages, nothing else (word-diff review); decision-log additions only.
A2 no doc in the set still says "ten tracks" (grep -n "ten tracks\|all ten" over the 5 spec docs + READMEs → 0).
A3 every new or changed factual statement carries a citation (file:line, PR #, or D-number).
A4 the three banners are byte-identical one-liners and are the only change in the charter files.
A5 polly-charter-autonomous.md names all seven roles and every HALT in the decision log.

## Green gates
pytest tests/workshop tests/api ≥ 1640, 0 failed (unchanged; docs only).

## Tampers
X1 leave one "ten tracks" in D11 → A2 fails.
X2 add a second edited line to a charter file → A4 fails.
X3 delete one existing D9 §9 question instead of marking it → A1 fails (history removed).
X4 drop one HALT from the autonomous charter → A5 fails.

## Live checks
None beyond the docs-only deploy: /health 200, 7 tools.

## Release
MERGE repo=app reseed=no.

## Reverse
Revert the PR.
