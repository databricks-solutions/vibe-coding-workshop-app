# x3-pattern-gaps (app) — plan

Repo: app (databricks-solutions/vibe-coding-workshop-app). Base: origin/feature/genie-code-mcp-integration @ a175f3a.
Plan file in PR: docs/superpowers/plans/2026-10-05-x3-pattern-gaps.md
Scope: B. Lane: L (tests only; NO product code; no trunk file).

## Why
#97's reviewer (verdict f121f62.reviewer.json) found two remaining blind spots in the Phase 3 "numeric step-set" fence in tests/workshop/test_phase3_exit_gate.py:
1. X3c's `_NUMERIC_ADD` (around :295) requires a receiver whose name contains Completed/Skipped. A numeric-literal add on a copy held under another name, e.g. `newSet.add(<n>)` in src/components/WorkflowDiagram.tsx (around :753, :828, :888, :1286), stays green. So a new hard-coded step credit routed through a copy evades the fence.
2. X3b's `_NUMERIC_COPY` covers Array.from / new Set / spread only. A `for (const s of completedSteps|skippedSteps)` iteration is a copy-like read the fence never sees (e.g. src/constants/scoring.ts:103).

## Changes (tests only, in test_phase3_exit_gate.py)
X3d — numeric-literal add on ANY set receiver in the scanned frontend files:
  regex `_ANY_NUMERIC_ADD = re.compile(r"\b[A-Za-z_]\w*\??\.add\(\s*\d+\s*\)")`, counted per file via the existing `_scan_counts` over `_frontend_sources()`.
  NEW `NUMERIC_ANY_ADD_ALLOWLIST = {file: (exact count measured at a175f3a, reason)}`. For each allowlisted hit, the implementer reads the code and writes a specific reason (which variable, which step, which gate it ends up written as). Counts must be EXACT (==), like X3b/X3c.
  If a hit is NOT a step set (e.g. some unrelated Set<number>), allowlist it anyway with that reason. The point is that any NEW numeric add shows up for review.
  The X3c test and NUMERIC_ADD_ALLOWLIST stay unchanged; X3d is additive.
X3e — for-of iteration over a step set:
  regex `_NUMERIC_FOR_OF = re.compile(r"for\s*\(\s*(?:const|let|var)\s+\w+\s+of\s+[\w.]*?(completedSteps|skippedSteps)\b")`
  NEW `NUMERIC_FOR_OF_ALLOWLIST = {file: (exact count at a175f3a, reason)}`, exact counts, non-empty reasons, same assertion shape as X3b.
Both new tests carry a `# TAMPER (...)` comment like the existing ones.
Do NOT edit any src/ file. If the measured counts reveal a real gate-bypass (a numeric step credit that isn't step-1 intent and isn't written through stepNumbersToGates), STOP and report it in the PR body as a Finding. Don't fix it; the lead queues it.

## Fence
- docs/superpowers/plans/2026-10-05-x3-pattern-gaps.md (new)
- tests/workshop/test_phase3_exit_gate.py

## Acceptance
- X3d and X3e exist, are green at the PR head, and use exact-count allowlists with non-empty reasons.
- Tamper T1 (the critic finalises it): add `newSet.add(5);` inside an existing handler in WorkflowDiagram.tsx → X3d red; restore byte-identically.
- Tamper T2: add `for (const s of completedSteps) { void s; }` to App.tsx → X3e red; restore byte-identically.
- X3, X3b and X3c are unchanged and green.
- Backend suite: >= 666 passed (floor 664 + 2), 0 failed. If llm-extract-followups merges first, the floor becomes its merged count, and the gatekeeper uses that.

## Green gates
cd <worktree> && DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= $APP/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q → >= 666 passed, 0 failed.
No src/ change → no npm build or eslint needed (verify `git diff --stat origin/feature/genie-code-mcp-integration -- src` is empty).

## Live check
None (tests only).
Lead note (2026-10-05): floor is 668 at a175f3a (#98 merged), so the target is >= 670.
