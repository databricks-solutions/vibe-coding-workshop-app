# Plan: x3-allowlist-widen (follow-up to #96)

- Repo: app, base origin/feature/genie-code-mcp-integration @ 3d5b700
- Commit this plan at: docs/superpowers/plans/2026-10-04-x3-allowlist-widen.md
- Source: #96 reviewer verdict on f61b301 (nonblocking 1 and 2).
- Files: tests/workshop/test_phase3_exit_gate.py, docs/superpowers/plans/2026-10-04-phase3-exit-report.md, this plan. Zero product code. App.tsx and WorkflowDiagram.tsx are READ only (no trunk-file write).

## Problem
1. X3 (`_NUMERIC_READ`, test_phase3_exit_gate.py:213) only matches `completedSteps|skippedSteps` followed by `.has/.size/.forEach/.values/.keys/.entries`. Copy-based reads, `Array.from(completedSteps)`, `new Set(completedSteps)`, `[...completedSteps]`, (seen at App.tsx:314/:596/:687, WorkflowDiagram.tsx:715), escape the scan, so a new copy-based number-key consumer stays green.
2. The exit report's F4 says the App hydrates completedSteps/skippedSteps "only from gates", but both App hydration paths also overlay `.add(1)` when industry and use_case are set (App.tsx:459/:622). The overlay is display/intent only; the wording overstates it.

## Change
- Add a second pattern `_NUMERIC_COPY` matching `Array.from\(\s*(completedSteps|skippedSteps)\b`, `new Set\(\s*(completedSteps|skippedSteps)\b`, and `\.\.\.\s*(completedSteps|skippedSteps)\b`, in the same scanned file set as X3.
- Allowlist each current copy site with a count and a one-line reason, measured on the base (don't trust the reviewer's line numbers; recount). The test asserts the exact per-file counts for both patterns, like the existing X3.
- Add a pinned allowlist entry (or an explicit assertion) for the `.add(1)` overlay sites (App.tsx hydration paths) with the reason "use_case_selection intent overlay, display only", so a new `.add(<number>)` elsewhere goes red: pattern `(completedSteps|skippedSteps|\w*[Cc]ompleted\w*)\.add\(\s*\d+\s*\)` over the same files, with exact counts.
- Report F4: reword to "hydrated from gates, plus the step-1 intent overlay (.add(1)) when industry and use_case are set (App.tsx hydration paths); the overlay is display-only and never written back as a gate", and cite the new X3b/X3c tests. Verify the "never written back" claim against the code before writing it; if false, write what is true and flag it in the PR body.

## Tampers (for the critic to formalize)
- Add `const x = Array.from(completedSteps)` to a scanned file → X3b red.
- Add `completedSteps.add(7)` to a scanned file → X3c red.

## Green gates
Backend suite (the standard invocation) with floor 662 + new cases, 0 failed. No product code, so no build or lint. `git diff --stat` must show only the 3 files.

## Findings

Measured at 3d5b700. The scanned file set is the same as X3's: `src/**/*.ts(x)` excluding `src/backend`.

**X3b copy-based reads** (`(?:Array\.from\(\s*|new Set\(\s*|\.\.\.\s*)(completedSteps|skippedSteps)\b`), 20 total:

| File | Count | Sites |
|---|---|---|
| src/App.tsx | 8 | :188 (comment), :314 direction lock, :596 ×2 initial expanded step, :687 level-switch guard, :776 toggle skipped_gates write, :994/:995 handleSaveSession gate write |
| src/components/LevelSelector.tsx | 1 | :318 hasStartedWorkflow threshold. X3 didn't cover this file because it has no direct `.has/.size` read |
| src/components/WorkflowDiagram.tsx | 8 | :715, :753, :828, :837, :888, :913, :920, :1286 (toggle/reset/skip handler seeds) |
| src/constants/scoring.ts | 3 | :78, :80, :101 (normalising the caller's sets) |

No spread (`...completedSteps`) site exists today.

**X3c numeric-literal adds** (`\b\w*(?:[Cc]ompleted|[Ss]kipped)\w*\??\.add\(\s*\d+\s*\)`), 3 total, all `.add(1)`:

| File | Count | Sites |
|---|---|---|
| src/App.tsx | 2 | :459 `restoredCompleted.add(1)`, :622 `loadedCompleted.add(1)` (hydration intent overlay) |
| src/components/WorkflowDiagram.tsx | 1 | :716 `newCompletedSteps.add(1)` (the learner picks a use case) |

The pattern adds `[Ss]kipped` so that the X3c contract also covers skipped sets; that finds no further sites. X3 didn't account for WorkflowDiagram.tsx:716, so it gets an entry.

**F4 "never written back" is FALSE.** The overlay is written back. `handleSaveSession` writes `completed_gates: stepNumbersToGates(Array.from(completedSteps))` (App.tsx:994), and `handleCompletedStepsChange` writes `stepNumbersToGates(Array.from(newSteps))` (App.tsx:775). Both sets carry step 1 once the overlay adds it. `stepNumbersToGates` (workflowSections.ts:523) maps step 1 to `ALL_STEPS[1].sectionTag`, which is **`usecase_selection`** (workflowSections.ts:392). The critic called this the `use_case_selection` gate, and that part is imprecise. `usecase_selection` is the App's step-1 gate (manifest global 1). The engine's `use_case_selection` is a different gate with no global number (gate_merge.py:20, lakebase.py:1746). So the overlay is persisted as `usecase_selection`, not as the engine's use-case gate. The exit report now says this (section "F4 correction").

**Defect?** I don't think so. The backend applies the same rule when it aggregates (lakebase.py:1746, `_has_defined_intent`: industry AND use_case ⇒ step 1), and D-15 makes a defined industry and use case the condition for step-1 credit. So persisting `usecase_selection` records the same intent the backend already infers. One observation for the lead, not a fix: once `usecase_selection` is written, the App only removes it if step 1 leaves the numeric set. Clearing industry or use_case doesn't remove a stored `usecase_selection` gate by itself. No change was made here, since product code is out of scope.

Tampers: T1 (`const copy = Array.from(completedSteps);` at App.tsx:315) makes X3b red, and T2 (`completedSteps.add(7);` at App.tsx:460) makes X3c red. In both cases App.tsx was restored byte-identically (shasum bd65514d…), and neither tamper was committed.
