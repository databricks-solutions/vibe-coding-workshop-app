# Polly Build Charter — Next Increment (Phase 2B → 2A)

**Status:** Draft · **Date:** 2026-09-23 · **Target repo:** `vibe-coding-workshop-app`
**Series:** [`README.md`](./README.md) · **Predecessor:** [`polly-build-charter.md`](./polly-build-charter.md) (Phase 0→2/2A)
**Purpose:** the **single command** you hand Polly for the increment **after** Phase 2 shipped —
build **Phase 2B (use-case selection + step-sync bridge)** first, then **Phase 2A (adaptive
coaching)**, stopping before Phase 3.

> **Where we are (live, 2026-09-23).** Phases **0, 1, 2 are SHIPPED** — PRs #40–#44 merged into
> `feature/genie-code-mcp-integration`, deployed to `fevm-serverless`, server-side smoke green. The
> deployed MCP surface has **6 tools** (`vibe_start_track`, `vibe_get_step`, `vibe_next_step`,
> `vibe_complete_step`, `vibe_submit_answer`, `vibe_set_parameters`). `vibe_coach` is **not** built.
> Full guided loop + in-band interactivity + Lakebase state all work. Two gaps remain, both surfaced
> by the human's first live Genie Code run:
> 1. **The PRD-jump** — no in-band way to pick/author a use case, so PRD renders against
>    `DEFAULT_USE_CASE` ([D11 §1.1](./mcp-workshop-usecase-selection.md)).
> 2. **No step-sync visibility** — MCP and the SPA write different progress fields on the same
>    session row, so switching surfaces doesn't show the same step ([D11 §4.2](./mcp-workshop-usecase-selection.md)).

> **How to use.** Paste the fenced **CHARTER** block into Polly as one message. The task
> decompositions live in the specs (not copied here, to avoid drift): Phase 2B = **[D11 §6/§8](./mcp-workshop-usecase-selection.md)**;
> Phase 2A = the coaching thread ([D1 §4.6](./mcp-workshop-interactivity.md), [D2 §3.7/§12](./mcp-interface-contract.md),
> [D4 §1.2](./mcp-workshop-architecture.md), [D5 §11](./mcp-workshop-pedagogy.md), [D6 §7a](./mcp-workshop-data-model.md),
> [D7 §6.1](./mcp-workshop-security.md), [D8 §4a](./mcp-workshop-test-plan.md)). Phasing authority is
> **[D9 §1](./mcp-workshop-rollout.md#1-revised-phasing-elicitation-decoupled)**.

---

## Why 2B before 2A (the sequencing recommendation)

Both are decoupled fast-follows on shipped Phase 2 (D9 §1). Order by **priority, not label**:

- **2B fixes a live defect** (PRD-jump) **and** delivers the human's explicit step-sync ask. It is
  additive, adds **zero tools**, and needs **no cost sign-off**.
- **2A is an enhancement** (nicer help) that adds the 7th tool **and** carries a per-call FMAPI
  **cost/endpoint decision** — a human sign-off (D9 §5, §9 q4).

So: **2B next**, then 2A (which may even run in parallel — different files). Both precede Phase 3,
whose UI-repoint **subsumes** the 2B sync bridge and makes sync canonical.

---

## The charter (copy everything in this block into Polly)

```text
════════════════════════════════════════════════════════════════════════════
POLLY CHARTER — NEXT INCREMENT: PHASE 2B then 2A (vibe-coding-workshop-app)
════════════════════════════════════════════════════════════════════════════

MISSION
Phases 0–2 are SHIPPED (merged, deployed to fevm-serverless, smoke green; 6
tools). Build the two decoupled fast-follows on Phase 2, IN ORDER:
  Phase 2B — use-case selection step + step-sync bridge (Genie Accelerator).
  Phase 2A — adaptive coaching (vibe_coach), the 7th tool, flag-off by default.
You are the supervisor: plan, delegate to coding sub-agents on their own
harnesses + git worktrees, route every diff to a different-vendor reviewer.
You WRITE NO CODE and NEVER MERGE. The human reviews and merges every PR.

READ FIRST (source of truth; repo reality wins; /investigate & re-confirm anchors)
- README.md ................................ series index + probe fact
- mcp-workshop-rollout.md (D9) §1 .......... PHASING AUTHORITY (2B & 2A rows)
- mcp-workshop-usecase-selection.md (D11) .. Phase 2B design + §6 tests + §8 tasks
- mcp-workshop-interactivity.md (D1) §4.6 .. coaching pattern (2A)
- mcp-interface-contract.md (D2) §3.7/§12 .. vibe_coach IDL + CoachResult/_COACH_SYSTEM
- mcp-workshop-architecture.md (D4) §1.2/§3.3  services/llm.py extract; cross-surface sync
- mcp-workshop-pedagogy.md (D5) §11 ........ coaching doctrine
- mcp-workshop-data-model.md (D6) §7a ...... 13_mcp_coaching.sql (2A) ; §7 12_ (shipped)
- mcp-workshop-security.md (D7) §6.1 ....... coaching leakage firewall
- mcp-workshop-test-plan.md (D8) §4a ....... coaching tests
- polly-build-charter.md ................... the predecessor charter (inherit its guardrails)

NON-NEGOTIABLE GUARDRAILS (inherit ALL from polly-build-charter.md; load-bearing here)
1. TOOL BUDGET: 2B adds ZERO tools (listings are RESOURCES; mutation reuses
   existing tools). 2A adds EXACTLY ONE (vibe_coach) → 7 total. Never an 8th.
2. ONE REPOSITORY / ONE ENGINE / ONE ASSEMBLER / ONE FMAPI SEAM — reuse
   get_industries()/get_use_cases_map()/get_section_input_content/
   call_databricks_serving_endpoint; never fork a second one.
3. ADDITIVE DATA ONLY; migrations idempotent (IF NOT EXISTS).
4. RECOMMEND-AND-PROCEED (D5 §3): certified use case is the recommended default;
   never block except the existing gates (PRD-needs-locked-UC; Step-9 benchmark).
5. CUSTOM USE CASE STAYS SESSION-LOCAL — no write to saved_usecase_descriptions.
6. IN-BAND ONLY (D1 §2, §10): no server→client protocol calls. vibe_coach is a
   SERVER-SIDE FMAPI call, FAIL-OPEN to static coaching (is_fallback:true), and
   NEVER returns an FMAPI error.
7. PROBE FLOOR still holds: /mcp returns 200 not 307; mount before SPA catch-all;
   lifespan composed; stateless_http; app name starts with mcp-.
8. REPO REALITY: NO local server (no uvicorn/npm run dev). Pin any dep EXACT in
   requirements.txt. NO CI → run `pytest tests/workshop` locally and PASTE
   results in every PR.

EXECUTION DOCTRINE
- STRICT ORDER: finish Phase 2B to its green exit gate and the human's
  between-phase approval BEFORE starting Phase 2A. (2A MAY then run in parallel
  with any Phase 3 prep, but NOT before 2B is approved.)
- PER PHASE, STEP 1: emit a writing-plans plan doc under
  docs/superpowers/plans/2026-09-23-mcp-phase2b-<name>.md (then -phase2a-),
  copying these GUARDRAILS verbatim and drawing each failing test from D11 §6
  (2B) / D8 §4a (2A). Then execute task by task (TDD).
- TRUNK vs LEAVES: SERIALIZE shared-file edits — src/backend/workshop/
  manifest.json and src/backend/mcp_server.py are touched by both phases.
  /fanout only independent leaves.
- /investigate (read-only) to CONFIRM every Anchor-Pack line against live source
  BEFORE editing. /cross-review EVERY diff with a different-vendor reviewer.
- ONE PR PER TASK. You never merge; the human merges.

PHASE 2B — TASKS (authoritative list: D11 §8; tests: D11 §6)
  1. manifest: add use_case_selection (produces "use_case_brief") before
     prd_generation in the GENIE ACCELERATOR define-usecase section ONLY; set
     prd_generation.consumes=["use_case_brief"], requiresGate="use_case_selection".
  2. resources: vibe://usecases/industries (get_industries) +
     vibe://usecases/{industry} (get_use_cases_map, certified-first).
  3. interaction: use_case_selection decision block in interactions.json
     (certified recommended + "author your own"); wire the EXISTING
     blocking-interaction gate.
  4. lock + produce: extend vibe_set_parameters (industry/use_case/label/
     description); confirm vibe_complete_step writes captured_outputs
     ["use_case_brief"] and PRD renders against the locked UC; custom path
     writes NO saved_usecase_descriptions row.
  5. sync bridge: vibe_complete_step ALSO updates current_step/completed_steps
     (derived from manifest section order) via save_session, so the legacy SPA
     reflects MCP progress (D11 §4.3).
  EXIT GATE (D9 §7 row 2B): D11 §6 tests green; tool count ≤7 unchanged; PRD
  gated + locked-render; sync bridge proven via get_user_default_session.

PHASE 2A — TASKS (D1 §4.6, D2 §3.7/§12, D4 §1.2, D5 §11, D6 §7a, D7 §6.1, D8 §4a)
  1. services/llm.py: EXTRACT call_databricks_serving_endpoint (routes.py:1400,
     async) + SERVING_ENDPOINT_NAME (routes.py:440); import from BOTH routes.py
     and mcp_server.py — do NOT import routes.py into the MCP adapter.
  2. db/lakebase/ddl/13_mcp_coaching.sql: additive is_fallback/focus columns on
     session_interactions (D6 §7a).
  3. mcp_server.py: async vibe_coach handler + _COACH_SYSTEM + CoachResult;
     grounding context (D2 §12.3); LEAKAGE SCRUB before return AND before store
     (D7 §6.1); FAIL-OPEN to static coaching (is_fallback:true).
  4. tests/workshop/test_coaching.py (D8 §4a): grounding, fail-open (model error
     / no endpoint → static, NEVER isError), leakage scrub, read-only,
     provenance — mocking the services/llm.py FMAPI seam so they run offline.
  EXIT GATE (D9 §7 row 2A): D8 §4a green + 13_ migration; ship FLAG-OFF unless
  the human approves the endpoint/cost (below).

HARD STOPS — human-only; produce the artifact/PR/runbook and WAIT (D9 §5):
- Deploying to ANY workspace (scripts/deploy.sh) — incl. the 2B code redeploy.
- Reseed (deploy.sh --tables-only) — needed only if a use_case_selection prompt
  body is added (D9 §2): reseed BEFORE the code redeploy.
- The LIVE GENIE CODE SMOKE (client side) — a human pastes the /mcp URL.
- (2A) The coaching serving-endpoint + per-call FMAPI COST decision (D9 §9 q4):
  recommend a model + max_tokens/timeout + cache key; ship 2A flag-off if unsure.
  Do NOT pick/enable an endpoint autonomously.

CADENCE
After each phase: summarize PRs opened, local pytest results, and the human gate
you're waiting on. Then STOP and wait.

START
Phase 2B only. /investigate & confirm the Anchor Pack against live code, emit the
2B plan doc, execute to the green D11 §6 gate. Do NOT touch 2A. Report and wait.

──────────────────────────  ANCHOR PACK (verify live before editing)  ────────────
mcp_server.py:36-38   DEFAULT_TRACK/DEFAULT_INDUSTRY/DEFAULT_USE_CASE
mcp_server.py:~435    _step_payload (reads industry/use_case; calls assembler)
mcp_server.py:486     vibe_start_track
mcp_server.py:603     vibe_complete_step (blocking-gate 613-625; save_session 642-646)
mcp_server.py:675     vibe_submit_answer (decision→captured_outputs, unblocks)
mcp_server.py:748     vibe_set_parameters
manifest.json:1786    genie-accelerator define-usecase section
manifest.json:1793    project_setup (produces null 1799)
manifest.json:1809    prd_generation (produces "prd_document" 1815; consumes []/requiresGate to set)
routes.py:1924/1935   GET /industries → get_industries()
routes.py:1938/1950   GET /use-cases/{industry} → get_use_cases_map()
routes.py:1241        get_section_input_content (THE assembler — reuse, never fork)
routes.py:1400        call_databricks_serving_endpoint (async — EXTRACT to services/llm.py, 2A)
routes.py:440         SERVING_ENDPOINT_NAME (default endpoint, 2A)
lakebase.py:592       save_session (accepts current_step/completed_steps — the bridge)
lakebase.py:828       load_session
lakebase.py:1046      get_user_sessions ; :1129 get_user_default_session (handoff)
db/lakebase/ddl/03_sessions.sql        industry/use_case/current_step/completed_steps
db/lakebase/ddl/12_mcp_engine_state.sql captured_outputs/completed_gates (shipped)
db/lakebase/ddl/01_usecase_descriptions.sql   curated repository (certified/path_type)
db/lakebase/ddl/05_saved_usecase_descriptions.sql  community library (do NOT write in 2B)
db/lakebase/ddl/13_mcp_coaching.sql    additive coaching columns (2A — to create)
════════════════════════════════════════════════════════════════════════════
```

---

## Notes for the human (not part of the charter)

- **Autonomy ceiling** is unchanged: Polly builds + tests + PRs Phase 2B, then 2A **flag-off**,
  stopping at the deploy, the live Genie Code smoke, and the 2A endpoint/cost sign-off (D9 §5).
- **This charter deliberately does not copy the task text** — 2B tasks are canonical in
  [D11 §8](./mcp-workshop-usecase-selection.md), 2A tasks in the coaching thread — so there is one
  source per phase (avoids the two-copies-drift the predecessor charter warned about).
- **Phase 3 (UI-repoint) is intentionally deferred.** It subsumes the 2B sync bridge and needs the
  number↔tag flip sign-off (D6 §5 / D9 §5). Charter it separately once 2B is in.
- **Decision still needed for 2A:** the coaching endpoint + cost knobs (D9 §9 q4). Until you answer,
  Polly ships 2A behind a flag.
