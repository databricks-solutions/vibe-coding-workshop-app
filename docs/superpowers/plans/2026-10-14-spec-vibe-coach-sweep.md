# Plan: spec-vibe-coach-sweep (docs only)

- Date: 2026-10-14 · Repo: app · Base: origin/feature/genie-code-mcp-integration @ f461643
- Worktree: FORGE/work/spec-vibe-coach-sweep · Branch: forge/spec-vibe-coach-sweep
- Commit this file unchanged at docs/superpowers/plans/2026-10-14-spec-vibe-coach-sweep.md
- Decisions: D-105 (this is its queued follow-up), D-107 (scope, below), D-109 (human approval in place of a critic ACCEPT; the critic path was denied by a policy evaluation error); carries D-106, D-107, D-108 and D-109 into docs/superpowers/decision-log.md
- Release: merge only (D-91). No deploy, no reseed, no DDL, no code, no new MCP tool.

## Goal

Finish the Phase 2A doc reconciliation that #138 started. D4 architecture, D5 pedagogy, D6 data-model
and D7 security still describe adaptive coaching as a separate `vibe_coach` tool (async, returning
`CoachResult`). Shipped code (f461643) delivers it as the optional `focus` argument on the sync
`vibe_explain_step` tool (D-22; tool count 7), with the system prompt in the constant `COACH_SYSTEM`
(`src/backend/services/coaching.py:35`). Also fix the #138 reviewer residuals and two stale citations,
and copy D-106/D-107 into the decision log.

Rule for every edit: **shipped code decides** (protocol (1)). Quote identifiers exactly as they appear
in the source at f461643. Where a section records the original design (e.g. D4 §3.5 already has a
"Shipped as …; the flow below is the original spec" note), keep the history and make it read as
history; do not delete reasoning, rationale or doctrine. Change names, signatures, pointers and
present-tense claims only.

## Fence (exactly these files may change)

1. docs/specs/mcp_design/mcp-workshop-architecture.md (D4)
2. docs/specs/mcp_design/mcp-workshop-pedagogy.md (D5)
3. docs/specs/mcp_design/mcp-workshop-data-model.md (D6)
4. docs/specs/mcp_design/mcp-workshop-security.md (D7)
5. docs/specs/mcp_design/mcp-interface-contract.md (D2)
6. docs/specs/mcp_design/mcp-workshop-interactivity.md (D1)
7. docs/specs/mcp_design/mcp-workshop-test-plan.md (D8)
8. docs/specs/mcp_design/mcp-workshop-rollout.md (D9) — citation fixes only (E14)
9. docs/specs/mcp_design/README.md
10. docs/superpowers/decision-log.md (append only)
11. docs/superpowers/plans/2026-10-14-spec-vibe-coach-sweep.md (this plan, new)

Never edited: polly-*.md charters, mcp-research-and-findings.md, mcp-interactive-track-doc-plan.md,
designing-mcp-servers-for-genie-code.md, mcp-workshop-coach-visuals.md (D12, human-owned, sha256
67e6cde0…726e), D9 §-table rows that record rollout history (:42 and the Phase 2A row), anything
under src/, tests/, db/, scripts/.

## Edits

Line numbers are at f461643; re-locate by text if they shift.

D4 architecture
- E1 :62 and :86 — "`vibe_coach`" as the handler/tool → the `focus` argument on `vibe_explain_step` (D-22).
- E2 :96 — the "define `vibe_coach` as an `async def` tool" instruction is not what shipped.
  `vibe_explain_step` is a sync tool (`mcp_server.py:1489`); FastMCP calls run off the event loop in a
  worker thread via the error-aware handler (`mcp_server.py:335`, `asyncio.to_thread` at `:368`), and the
  model wait uses `_run_async_blocking` with `thread.join(timeout_s)` (`mcp_server.py:1816`) on the
  32-worker pool (`src/backend/executor.py:25`). Rewrite to that, citing D-22 and the code lines only
  (no FORGE paths in repo docs).
- E3 the ASCII box at :102 and :111 — rename the handler label to `vibe_explain_step(focus)`; keep the
  box geometry aligned (right edge in the same column).
- E4 §3.5 :242–266 — keep the heading's "(Phase 2A)" and the existing "Shipped as …" note. In the
  sequence diagram, rename participant/messages to `vibe_explain_step {session_id, sectionTag, focus}`,
  `coach(context, system=COACH_SYSTEM)` and the return to `StepHelpResult {…, coaching, focus,
  is_fallback, grounded_on}` (the real field names, D2 §3.8). Do not convert the Mermaid in this spec;
  D12 twins are a seed concern, not docs.
- E5 :289 failure table and :297 component table — tool name → `vibe_explain_step` (`focus`);
  "async `vibe_coach` handler + `_COACH_SYSTEM`" → "`vibe_explain_step` `focus` path; `COACH_SYSTEM` and
  the coaching service live in `src/backend/services/coaching.py`".

D5 pedagogy
- E6 :239, :245, :270, :299, :302 — `vibe_coach` → `vibe_explain_step` with `focus`; "D2 §3.7" → "D2 §3.8"
  where it points at the tool contract. The doctrine text (what coaching is for, tone, settled
  decisions, fallback) is unchanged. :279 ("coach that path's…") is the verb, leave it.
- E7 :253 — `_COACH_SYSTEM` → `COACH_SYSTEM`.

D6 data-model
- E8 :112 and :124 — `vibe_coach` → the `vibe_explain_step` `focus` path; "D2 §3.7" → "D2 §3.8".
  :115 (`interaction_id = "coach.<focus>"`) matches `coaching.py:451` — leave.
- E9 :177 — "`coach` (§3a)" → "`vibe_explain_step` with `focus` (§3a)".

D7 security
- E10 :126, :136, :174 — `vibe_coach` → `vibe_explain_step` (`focus`); "D2 §3.7" → "D2 §3.8".
- E11 :140, :160 — `_COACH_SYSTEM` → `COACH_SYSTEM`. Do not change any scrub or firewall claim.

D2 interface contract (#138 residuals)
- E12a §3.6 Maps-to (:323–324) — the parameters route also accepts `PUT`; cite the real route
  definition in `src/backend/api/routes.py` (file:line) for both GET and PUT. If only one method exists
  at f461643, write what exists and say so in the PR body (shipped code decides).
- E12b §6 error table (:523) — `UNKNOWN_STEP` raisers: replace the short-name `coach` with
  `explain_step` (use the same short-name style as the other cells), matching D2 §3.8's error list.
- E12c :359, §12 heading (:633) and §12.2 heading (:677) — `_COACH_SYSTEM` → `COACH_SYSTEM`.
  `CoachResult` in the §12 heading: shipped code has no `CoachResult` type; add "(historical name; the
  shipped result is `StepHelpResult`, §3.8)" rather than renaming the section. No links to these anchors
  exist at f461643 (grep `_coach_system|12-adaptive` in docs/ is empty); re-grep and report.

D1 interactivity
- E13a :184, :190 — `_COACH_SYSTEM` → `COACH_SYSTEM`.

D8 test plan
- E13b :110 heading "D2 §3.7" → "D2 §3.8"; :114 keep "planned as `vibe_coach`, D2 §3.7" as history but
  add "now D2 §3.8"; :117 and :121 `_COACH_SYSTEM` → `COACH_SYSTEM`; :317 coverage row "D2 §3.7" → "D2 §3.8".

D9 rollout (citations only)
- E14 :158 and :245 — `mcp_server.py:798` → `mcp_server.py:802` (`STEP_PROMPT_BUDGET_S = 90.0`).
  No other D9 change.

README
- E15 row 16 Status — "PR 3 docs" is stale: → "PR 1 twins #135, PR 2 visuals #136, PR 3 docs #137 merged".
- E16 row 7 description and :144–145 — `_COACH_SYSTEM` → `COACH_SYSTEM`; "D2 §3.7/§12" → "D2 §3.8/§12"
  where it names the tool contract. Rows keep 5 cells.

Decision log
- E17 append, verbatim from FORGE/state/lead/decisions.md, the D-106, D-107, D-108 and D-109 lines, in
  that order after D-105, in the existing one-line format. D-108 is copied as it stands (PROVISIONAL,
  not signed). Nothing else in the log changes.

## D-107 (to carry)

- D-107 (2026-10-14, lead; human: "spec-vibe-coach-sweep: Go … docs only") · Scope of the D-105
  follow-up · D4–D7 `vibe_coach`/`_COACH_SYSTEM`/async-handler claims re-pointed to the shipped
  `vibe_explain_step` `focus` path and `COACH_SYSTEM`, history kept as history; plus the #138 residuals
  (D2 §3.6 PUT, §6 short-name, §12 headings, D8 §3.7→§3.8, D1/D8/README constant name), README row 16
  status, and D9 `:798`→`:802` citations. Charters, research, the doc plan, the generic Genie Code spec,
  D12 and D9 history rows are never edited · evidence: grep at f461643; #138 reviewer verdict residuals;
  #139 implementer note · Reverse: revert the PR.

## Acceptance

- A1 Fence: `git diff --name-only origin/feature/genie-code-mcp-integration...HEAD` is exactly the 11
  files above. The committed plan is byte-identical to FORGE/state/lead/plans/spec-vibe-coach-sweep.md.
  D12 spec sha256 unchanged.
- A2 No code: `git diff … -- src tests db scripts app.yaml.template` is empty.
- A3 Residual grep: in D1, D2, D4–D8 and README, every remaining `vibe_coach` and `_COACH_SYSTEM`
  occurrence is listed in the PR body with file:line and a class: history (explicitly marked as the
  planned/original name) or pointer. Zero present-tense claims that `vibe_coach` is a tool or that the
  handler is async. Paste the grep and the classification.
- A4 Identifier truth: every code identifier the PR adds or changes (`COACH_SYSTEM`, `StepHelpResult`
  field names, `vibe_explain_step`, `_run_async_blocking`, `asyncio.to_thread`, `STEP_PROMPT_BUDGET_S`,
  route methods) exists in the source at f461643, checked by a script; paste the script and output.
- A5 Citations: every file:line and § reference on an added or changed line resolves at f461643 to the
  thing the sentence says (D-103 rule: only added/changed lines are in scope). Paste the list.
- A6 Additive in spirit: no rationale, doctrine or history sentence is deleted; for each removed line,
  the PR body shows the replacement line (diff pairs). Markdown tables keep their cell counts; the D4
  ASCII box keeps its right edge column.
- A7 Decision log: D-106, D-107, D-108 and D-109 appended verbatim from FORGE/state/lead/decisions.md, in
  order after D-105, nothing else changed.
- A8 Tests: full suite unchanged, ≥ 1892 passed, 0 failed (floor 1892).

## Tampers (each must turn its check red, then restore)

- X1 Leave one present-tense `vibe_coach` claim in D7 :126 → A3 red.
- X2 Write `_COACH_SYSTEMS` in D5 :253 → A4 red.
- X3 Cite `mcp_server.py:798` in E14 → A5 red.
- X4 Delete one D5 §11 doctrine sentence → A6 red.
- X5 Drop a cell in README row 16 → A6 red.
- X6 Edit one character of D-105 in the decision log → A7 red.
- X7 Touch polly-charter-next.md → A1 red.

## Gates

pytest floor 1892/0. No build (no frontend change). No genie gate (no seed change).
Open a PR into feature/genie-code-mcp-integration; paste A1–A8 evidence and X1–X7 results in the body.
Report any guard denial instead of working around it.
