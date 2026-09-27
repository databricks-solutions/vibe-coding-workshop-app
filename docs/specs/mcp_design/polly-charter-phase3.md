# Polly Build Charter — Phase 3: UI-Repoint (one engine, two surfaces)

**Status:** Draft · **Date:** 2026-09-27 · **Target repo:** `vibe-coding-workshop-app`
**Series:** [`README.md`](./README.md) · **Predecessor:** [`polly-charter-next.md`](./polly-charter-next.md) (Phase 2B → 2A)
**Purpose:** the **single command** you hand Polly for the increment **after** Phase 2B shipped —
make the workshop **engine** the single source of truth for the outline and progress, and repoint
the React SPA to render it, retiring the parallel TypeScript orchestration.

> **Where we are (live, 2026-09-27; code-verified).** Phases **0, 1, 2, 2B are SHIPPED** — deployed to
> `fevm-serverless`, smoke green. The deployed MCP surface has **7 tools** (`vibe_start_track`,
> `vibe_get_step`, `vibe_next_step`, **`vibe_explain_step`**, `vibe_complete_step`,
> `vibe_submit_answer`, `vibe_set_parameters` — `mcp_server.py:848,924,966,995,1192,1313,1398`).
> `vibe_coach` was **never built**; the 7th slot is `vibe_explain_step` (shipped in `cb3fa95`).
> Phase **2A** (adaptive coaching) is **deferred and reframed as a consolidation** — it will extend
> `vibe_explain_step`, not add an 8th tool — and is a **separate charter after Phase 3**
> ([D9 §1 row 2A](./mcp-workshop-rollout.md)).
>
> **The live defect this fixes.** A resumed genie-code MCP session shows "Step 8 of 20" on the saved
> session card (the sync-bridge dense count) but **"0/28 done"** on open: `App.tsx` restores level
> `lakehouse-di` (`codingAssistants.ts:112`) while the walk is the `genie-accelerator` track, whose
> steps are stripped from that outline (`workflowSections.ts:774`). The gates persist correctly; only
> the restored outline is wrong. Phase 3 **Task 0** kills it, and the full repoint makes the whole
> class of `track↔level` divergence structurally impossible.

---

## Why Phase 3 now (the sequencing recommendation)

Phase 2B shipped the **bridge** (a backward-compatible dual-write of the legacy number-keyed SPA
progress). D9 always framed that as the fast path and Phase 3's UI-repoint as the **canonical** one
that **subsumes** it ([`mcp-workshop-rollout.md` §1](./mcp-workshop-rollout.md)). The engine already
produces exactly what the SPA needs — `engine.outline(track, session)` returns the filtered, ordered,
gate-aware, status-annotated step list (`engine.py:91`), with flag composition already applied
(`manifest.py:113`) — and the manifest already encodes **all 14 tracks 1:1 with the SPA's 14
`WorkshopLevel`s**. So the "shared brain" exists; Phase 3 is about **consuming** it and **deleting the
duplicate** (`getFilteredSections`, `workflowSections.ts:750`).

**Task 0 is a stepping stone, not throwaway:** persisting the track (the Option-2 fix) both fixes the
live defect immediately *and* is exactly what the new outline endpoint needs to resolve the track
from a session.

> **2A cost/endpoint sign-off still stands** (2026-09-24). It does not gate Phase 3; 2A is its own
> later charter and is decoupled (it touches `vibe_explain_step` + `services/llm.py`, not the UI).

---

## The charter (copy everything in this block into Polly)

```text
════════════════════════════════════════════════════════════════════════════
POLLY CHARTER — PHASE 3: UI-REPOINT (one engine, two surfaces) — vibe-coding-workshop-app
════════════════════════════════════════════════════════════════════════════

MISSION
Phases 1, 2, 2B are SHIPPED (deployed, smoke green, 7 tools). Phase 2A (adaptive
coaching) is DEFERRED and will be delivered as a CONSOLIDATION — extending
vibe_explain_step into adaptive coaching, staying at 7 tools — as its OWN future
charter; do NOT build coaching here. Build Phase 3: make the workshop ENGINE the
single source of truth for the outline and progress, and repoint the React SPA
to render it — retiring the parallel TS orchestration. This subsumes the 2B sync
bridge and eliminates the track↔level divergence (the live "Step 8 of 20" vs
"0/28 done" defect).

You are the supervisor: plan, delegate to coding sub-agents on their own git
worktrees, route every diff to a different-vendor reviewer. You WRITE NO CODE and
NEVER MERGE. The human reviews and merges every PR.

READ FIRST (source of truth; repo reality wins; /investigate & re-confirm live)
- mcp-workshop-rollout.md (D9) ............. Phase 3 row + number↔tag-flip hard stop (§5)
- mcp-workshop-architecture.md (D4) §3.3 ... cross-surface live-sync + GET /api/track/{track}/outline
- mcp-workshop-data-model.md (D6) §5, §9 ... number↔tag flip; drop-legacy-stores consumer audit
- workshop-engine-domain.md (D3) §4.3 ...... engine keys everything by sectionTag; map is a bridge
- polly-charter-next.md .................... inherit ALL guardrails

NON-NEGOTIABLE GUARDRAILS (inherit from predecessor charters)
1. ONE ENGINE / ONE ASSEMBLER: the new REST outline route is THIN transport over
   engine.outline(...) — the SAME function MCP already calls. NEVER fork a second
   outline builder. Adapters contain no workshop logic (D4 §1).
2. TOOL BUDGET unchanged: 7 tools. Phase 3 adds ZERO MCP tools (it adds ONE REST
   route). Never an 8th tool.
3. ADDITIVE DATA ONLY; migrations idempotent. Legacy number stores are dropped
   LAST, behind the consumer audit (D6 §9) and the human flip sign-off (D9 §5).
4. PARITY IS THE SAFETY NET: no UI behavior change ships until a golden test
   proves engine.outline() reproduces today's getFilteredSections() sectionTag
   sequence for ALL 14 tracks × flag combos. Snapshot TS first, then match it.
5. REPO REALITY: no uvicorn/npm run dev; pin deps EXACT in requirements.txt; NO CI
   → run `pytest tests/workshop` locally + paste results in every PR.
6. IN-REPO CONTEXT ONLY; /investigate every anchor before editing; /cross-review
   every diff with a different-vendor reviewer; ONE PR PER TASK.

EXECUTION DOCTRINE
- STRICT ORDER; each task independently shippable + reversible. Task 0 gates the
  rest; the flip (T4/T5) rides the human hard stop.
- PER-TASK STEP 1: emit a plan doc under docs/superpowers/plans/ copying these
  guardrails and drawing failing tests from D6 §5 / D8 parity style.
- SERIALIZE shared-file edits: mcp_server.py, workflowSections.ts, App.tsx,
  routes.py are trunk files. /fanout only independent leaves.

TASKS
  0. TRACK PERSISTENCE (fixes the live 0/28 defect; foundation for the endpoint).
     MCP stamps the engine track into the shared row (workshop_level = DEFAULT_TRACK)
     at seed time (mcp_server.py:868 and :1448, beside the coding_assistant
     setdefault). App.tsx restores level from the persisted value; the
     assistant→level lookup (codingAssistants.ts:112 DEFAULT_LEVEL_BY_ASSISTANT)
     becomes a LEGACY FALLBACK only, corrected to 'genie-accelerator'.
     TEST: a resumed genie-code session opens on the genie-accelerator outline
     with gates mapped; no 0/28.
  1. OUTLINE ENDPOINT (net-new, thin). GET /api/track/{track}/outline?session_id
     → engine.outline(track, SessionState-from-session): sections + steps + status
     + section metadata. Reuse engine.outline (parity with MCP _outline_items);
     resolve track from the session's persisted workshop_level (T0).
  2. PARITY HARNESS. Golden test: engine.outline() sectionTag order ==
     getFilteredSections() for all 14 tracks × flag combos. Authorizes every later
     task. NO UI change in this PR.
  3. SPA READS THE ENGINE. Repoint sidebar/step surfaces to the endpoint's outline;
     re-key progress from Set<number> to sectionTag (completed_gates). Collapse
     ALL_STEPS to a presentation-only (icon/color) sectionTag-keyed map. Behind
     the T2 parity proof.
  4. RETIRE TS ORCHESTRATION. Delete getFilteredSections + the level/direction/
     chapter/reverse special-cases (workflowSections.ts:750) once T2/T3 are green
     across all tracks.
  5. DROP LEGACY NUMBER STORES (D6 §5/§9) — LAST. Audit consumers first
     (LeaderboardPage, AnalyticsDashboard, stepPreviousOutputs, session card);
     retire the current_step/completed_steps dual-write; the number↔tag map stays
     manifest-derived for legacy-session backfill on read.
  EXIT GATE (D9 Phase 3): parity stable across the repoint; no number-key consumers
  remain; MCP outline == SPA outline for the same session_id.

DECISIONS TO SURFACE TO THE HUMAN BEFORE T3 (do not decide autonomously)
- Which App axes are engine COMPOSITION vs SPA PRESENTATION: additive chain
  context (climb app→+lakebase→+lakehouse→+AI), reverse-direction re-ordering,
  AI-module/medallion sub-toggles. Manifest flags cover includeLakehouse/
  includeGenieOntology (D6 §4) but NOT obviously these — each needs a home.
- Live-sync transport: polling (D4 open-q1 recommends v1) vs SSE.
- Legacy-session backfill policy (synthesize gates from numbers on read).

HARD STOPS — human-only; produce artifact/PR and WAIT (D9 §5)
- Deploying to any workspace (scripts/deploy.sh).
- The NUMBER↔TAG FLIP / dropping legacy number stores (D6 §5, D9 §5).
- Any reseed (deploy.sh --tables-only), if a prompt body changes.

ANCHOR PACK (verify live before editing)
  mcp_server.py:868,1448   coding_assistant setdefault (add workshop_level here, T0)
  mcp_server.py:1256-1283  _legacy_progress bridge (subsumed T3; retired T5)
  src/backend/workshop/engine.py:91      engine.outline() — the shared brain (T1 reuse)
  src/backend/workshop/manifest.py:113   outline_order(flags) — composition
  routes.py  (no /api/track/* today — T1 is net-new)
  src/constants/workflowSections.ts:390  ALL_STEPS ; :508 completedGatesToStepNumbers ; :750 getFilteredSections (retire T4)
  src/constants/codingAssistants.ts:112  DEFAULT_LEVEL_BY_ASSISTANT (T0 fallback fix)
  src/App.tsx:35 deriveCompletedStepNumbers ; :515 loadSession ; :581 getNextIncompleteStep
  src/components/SectionedWorkflowSidebar.tsx:9-16  Set<number> state (re-key T3)

START
Task 0 only. /investigate & confirm the Anchor Pack against live code, emit the
T0 plan doc, land the track-persistence fix + test (kills the 0/28 defect).
Report and wait for the human gate before Task 1.
════════════════════════════════════════════════════════════════════════════
```

---

## Notes for the human (not part of the charter)

- **Autonomy ceiling** is unchanged from the predecessor charters: Polly plans, builds, tests, and
  opens one PR per task, stopping at the deploy and any number↔tag flip. The human reviews and merges
  every PR.
- **Task 0 is the standalone win.** It fixes the live "0/28" resume defect on its own and is
  independently shippable; the rest of Phase 3 can follow at your pace behind the parity harness (T2),
  which is the gate that authorizes the SPA repoint.
- **This charter deliberately does not copy the task text from the D-series** — the canonical Phase 3
  design lives in [D9 Phase 3 row](./mcp-workshop-rollout.md), [D4 §3.3](./mcp-workshop-architecture.md),
  [D6 §5/§9](./mcp-workshop-data-model.md), and [D3 §4.3](./workshop-engine-domain.md) — so there is one
  source, avoiding the two-copies-drift the predecessor charters warned about.
- **Phase 2A (consolidated coaching) is intentionally deferred to its own charter after Phase 3.** It
  is decoupled (it touches `vibe_explain_step` + `services/llm.py`, not the UI-repoint) and its
  cost/endpoint knobs are already signed off (2026-09-24). Charter it separately once Phase 3 Task 0
  has landed.
