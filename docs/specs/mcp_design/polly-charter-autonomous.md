# Autonomous Run Charter — how the 2026-10 run was governed

**Status:** Record (as run) · **Date:** 2026-10-08 · **Target repos:** `vibe-coding-workshop-app` (APP),
`vibe-coding-workshop-template` (TPL)
**Series:** [`README.md`](./README.md) · **Supersedes:** [`polly-build-charter.md`](./polly-build-charter.md),
[`polly-charter-next.md`](./polly-charter-next.md), [`polly-charter-phase3.md`](./polly-charter-phase3.md)

> **Scope.** This describes how the autonomous run that shipped the Phase 3 cleanup, Phase 2A and
> Phase 4 was governed. It records facts only. "RUN.md" is the run brief and "lead charter" is
> `config.yaml` (the `forge_lead` definition), both in the workshop-forge checkout (FORGE), which is
> outside this repo. "Decision log" is [`docs/superpowers/decision-log.md`](../../superpowers/decision-log.md).
> Line numbers in FORGE files are as of 2026-10-08.

---

## 1. Mandate

- Execute the remaining roadmap through to the handoff, including Phase 4: every track walkable in
  Genie Code over MCP (RUN.md:1-2, :64-107).
- Ground truth order: repo reality > docs > the brief (RUN.md:15).
- Scope in order: A (Phase 3 cleanup), B (Phase 2A), P4 (Phase 4), C (release candidates and docs)
  (RUN.md:37-119). Other surfaces are out of scope (RUN.md:120-121).
- Budget cap $900 (RUN.md:135; lead charter `cost_budget` :138). The human later directed the run to
  stop tracking cost until it actually blocks the run (decision log, "Spend").

## 2. Roles and model-family separation

| Role | Does | Harness / model family (FORGE `agents/<role>/config.yaml`) |
|---|---|---|
| **lead** (`forge_lead`) | Plans, dispatches, keeps state; never writes product code or tests, never merges, never deploys; writes only under FORGE `state/lead/` (lead charter :141-145, :156-158) | claude-sdk / Claude (lead charter :33-36) |
| **plan_critic** | ACCEPT or BLOCK each plan; on ACCEPT writes the tampers and live checks (lead charter :201-202) | cursor / Gemini |
| **implementer** | One scoped task in a worktree; opens the PR into `feature/genie-code-mcp-integration` (lead charter :183-191, :203) | claude-native / Claude |
| **reviewer** | Reviews the PR head SHA and writes its verdict file (lead charter :204-206) | cursor / Grok |
| **gatekeeper** | Runs the gates and tampers on the same head SHA and writes its verdict file (lead charter :204-206) | codex-native / GPT |
| **release** | Merges; for APP also deploys and records the SHA; rolls back; template merges are never deployed (lead charter :207-209) | claude-sdk / Claude |
| **prober** | Runs the live checks against the deployed app over HTTP and MCP, read-only, and reports numbers (lead charter :210-213) | claude-sdk / Claude |

**Model-family rule:** per PR, implementer (Claude), reviewer (Grok via Cursor) and gatekeeper (GPT via
Codex) must be three different model families, and plan_critic (Gemini via Cursor) must differ from the
implementer. If routing collapses any of them, the lead records it and HALTs (lead charter :176-179).
The first-turn roster preflight checks the launch directory, the definition fingerprint, the four
harnesses and each role's reported model (lead charter :168-179).

## 3. Pipeline (one PR per task, in one repo)

1. **Plan** written by the lead, committed by the implementer at `docs/superpowers/plans/<date>-<slug>.md`
   (APP) or `retrospectives/plans/genie-code-integration/<date>-<slug>.md` (TPL; D-1) (lead charter :197-200).
2. **Critic:** plan_critic ACCEPT or BLOCK; BLOCK → revise and resend, **max 2 rounds**, then park
   (lead charter :201-202).
3. **Implement:** the implementer opens the PR; the lead records the PR number and head SHA (lead charter :203).
4. **Review + gate on the same head SHA**, in parallel. Any new head SHA (a fix-up round) re-runs both.
   Blocking findings go back to the implementer, **max 2 rounds**, then park (lead charter :204-206).
5. **Release:** merge (+ reseed when APP `db/` DDL or prompt bodies changed), deploy and record the SHA
   (lead charter :207-209).
6. **Probe** (APP merges): run the accepted live checks; FAIL → release ROLLBACK of that merge SHA, then
   park (lead charter :210-213).
7. **Record** in the queue and status (lead charter :214-215).

A change spanning both repos is two tasks; the template PR merges first (lead charter :216-217;
RUN.md:96-97).

**Circuit breakers (PARK):** 3 failed implementation attempts; 2 unresolved critic/review/gate rounds;
a live check failing after rollback; a policy DENY the plan cannot route around; any need for a main
write, another workspace, or destructive DDL (lead charter :235-239).

## 4. Decision protocol and the decision log

- **(1)** shipped code decides → follow it and mark the doc question resolved; **(2)** else the doc's
  recommended option; **(3)** else the most reversible option (lead charter :226-228).
- Each decision records question, choice, evidence and reversal in FORGE `state/lead/decisions.md`; the
  next implementer PR carries it into the decision log (lead charter :229-230). Catch-up appends only
  entries whose ID is absent from the APP log (D-64).
- Human rulings mid-run are recorded the same way (e.g. D-36, D-55, D-56). The lead never waits for a
  human mid-run (lead charter :248).

## 5. Guards

- **Verdict custody:** reviewer and gatekeeper verdicts live in FORGE `state/verdicts/<sha>.*.json`; the
  lead reads them with its file-read tool and never writes them; `verdict_custody` denies any shell
  command that names one (lead charter :84-88, :162-166).
- **Clean checkouts:** before a dispatch, APP must be clean on `feature/genie-code-mcp-integration` and
  TPL clean on `main`; a DENY means a checkout was written or moved outside the pipeline, and the lead
  HALTs without cleaning it (lead charter :100-110, :242-245).
- **Trunk-file serialization:** tasks touching APP `mcp_server.py`, `routes.py`, `engine.py`, `App.tsx`,
  `workflowSections.ts`, `generate_manifest.py`, `manifest.json`, seed 02, or TPL `scripts/genie_gate.py`
  and its baseline are serialized; at most 2 implementers at once (lead charter :218-225).
- **Charter exceptions:** a trunk-file exception is granted when the plan names the file, the reason
  and the reversal, and plan_critic accepts (lead charter :231-232; e.g. D-49).
- **Deploy guard:** release may run only `scripts/deploy.sh --code-only|--tables-only`, and
  `--tables-only` only when the `db/` diff since the last deploy adds nothing destructive (FORGE
  `forge_policies/__init__.py:441-443`, wired in `agents/release/config.yaml:38-45`; it denied #118's
  reseed, D-50). Destructive data operations are never automatic (lead charter :232-233; D-35).
- **`main` is human-only** in both repos: no agent commits to, pushes to or merges into it (RUN.md:4;
  lead charter :154-155; D-5).
- **Never deploy code older than f7731c0** (RUN.md:133; `agents/release/config.yaml:70`).

## 6. HALT conditions and the HALTs that happened

The run HALTs only on lost credentials (gh / Databricks), a broken toolchain (suites cannot run at all),
or a guard that should have denied and did not; a `clean_checkouts` or `current_definition` DENY is a
HALT (lead charter :240-247). The roster preflight also HALTs on a failed launch check or a collapsed
model-family separation (lead charter :170-179).

The decision log's HALT set is exactly five entries: an unnumbered "HALT (2026-10-06T07:35Z)", HALT #2,
#3, #4 and #7. There is no "HALT #1" entry; #5 and #6 are recorded only in the forge status log (cited below).

- **HALT (2026-10-06T07:35Z):** unauthorized writes by a non-implementer role into the APP main
  checkout; a guard that should have denied did not (decision log, "HALT (2026-10-06T07:35Z)").
- **HALT #2 (2026-10-06T23:30Z):** plan_critic ran `git checkout` and `genie_gate.py` in the human's TPL
  checkout with `read_only_shell` not denying (decision log, "HALT #2").
- **HALT #3 (2026-10-07T04:27Z):** release could not merge; the active gh account was not the pipeline's
  (lost gh credentials) (decision log, "HALT #3").
- **HALT #4 (2026-10-07T06:48Z):** disk full (110 MiB free) blocked suites, builds and deploys (broken
  toolchain) (decision log, "HALT #4").
- **HALT #5 (2026-10-07T16:45:50Z):** `clean_checkouts` DENY: APP had an untracked file
  (`p4-genie-reverify-pr.md`). No decision-log entry; recorded in FORGE `state/lead/status.md:1121-1123`.
- **HALT #6 (2026-10-07T17:22Z):** preflight step 0 failed: a lead session was launched from the APP
  checkout, not FORGE. No decision-log entry; recorded in FORGE `state/lead/status.md:1128-1131`.
- **HALT #7 (2026-10-07T23:09Z):** release could not merge #125; the active gh account had changed
  outside the pipeline (the HALT #3 precedent) (decision log, "HALT #7").

## 7. What the human does

- Rules on the questions the run parks for a human (e.g. Phase 4 exit report §6: the D-61 gate change
  and the D-62 budget; D-29 for the coaching budget).
- Runs the Genie Code client smoke from `docs/superpowers/genie-code-smoke-script.md` (RUN.md:148-153;
  D8 §8b).
- Refreshes the local TPL `apps_lakebase/prompts` tree from the APP seed, then reviews and merges the
  TPL release candidate, then the APP release candidate; the run opens both RCs into `main` and merges
  neither (RUN.md:108-114, :154-156).
