# Polly Build Charter — MCP Interactive Track

**Status:** Draft · **Date:** 2026-09-22 · **Target repo:** `vibe-coding-workshop-app`
**Series:** [`README.md`](./README.md)
**Purpose:** the **single command** you hand Polly (Omnigent) so she autonomously builds the
MCP-driven interactive Genie Accelerator track from the D1–D10 series, delegating to harnesses with
cross-vendor review and one PR per task.

> **How to use.** Paste the fenced **CHARTER** block below into Polly as one message. Everything she
> needs — mission, guardrails, phase order, exact spec section numbers, and **live-verified
> file:line anchors** — is inline, so sub-agents never guess. The **Anchor Pack** (bottom) is copied
> into the charter and repeated here for humans.

> **Anchors verified live 2026-09-22** against this checkout (see Anchor Pack). Per
> [plan §1](./mcp-interactive-track-doc-plan.md#1-probe-findings-authoritative-constraints--do-not-re-litigate-without-a-re-probe),
> `routes.py`/`app.py` anchors **must be re-verified at build time** — the charter tells Polly to
> `/investigate` and confirm each anchor before editing. Drift already corrected here:
> `POST /api/session/save` is **`routes.py:5944`** (the D3 §4 / roadmap `:5787` citation is stale).

---

## The charter (copy everything in this block into Polly)

```text
════════════════════════════════════════════════════════════════════════════
POLLY CHARTER — BUILD THE MCP INTERACTIVE TRACK (vibe-coding-workshop-app)
════════════════════════════════════════════════════════════════════════════

MISSION
Implement the MCP-driven interactive track for the Genie Accelerator per the
design series in docs/specs/mcp_design/ (D1–D10). Deliver working, tested
software phase by phase. You are the supervisor: you plan, delegate to coding
sub-agents on their own harnesses + git worktrees, and route every diff to a
different-vendor reviewer. You WRITE NO CODE and you NEVER MERGE. The human
reviews and merges every PR.

READ FIRST (source of truth; repo reality wins over any doc)
- docs/specs/mcp_design/README.md .......... index + the one probe fact
- mcp-interactive-track-doc-plan.md §1 ...... probe constraints, AUTHORITATIVE
- D1 mcp-workshop-interactivity.md .......... interaction model (in-band)
- D2 mcp-interface-contract.md .............. tool/resource/prompt IDL
- D3 workshop-engine-domain.md .............. manifest, progression, assembler
- D4 mcp-workshop-architecture.md ........... components, deploy topology, flows
- D5 mcp-workshop-pedagogy.md ............... learning model, question authoring
- D6 mcp-workshop-data-model.md ............. Lakebase DDL (additive)
- D7 mcp-workshop-security.md ............... identity, CORS, rate-limit
- D8 mcp-workshop-test-plan.md .............. every gate + coverage matrix
- D9 mcp-workshop-rollout.md ................ phasing + STOP gates
- D10 mcp-workshop-facilitator-guide.md ..... setup/troubleshoot (fallback)

NON-NEGOTIABLE GUARDRAILS (propagate verbatim to EVERY sub-agent)
1.  PROBE FLOOR (plan §1; D1 §2, §10): Genie Code declares empty capabilities —
    NO elicitation, NO MRTR, NO sampling. ALL interactivity is IN-BAND. Never
    add a server→client protocol call. There is no code path where a missing
    capability blocks a step (D1 §2).
2.  307 IS THE #1 KILLER (D4 §2 step; D7 §2; D8 §5): POST /mcp MUST return 200,
    never a 307 redirect to /mcp/. Implement an ASGI path-rewrite so /mcp is
    served without redirect.
3.  MOUNT ORDER (D4 §2.1; anchor app.py:162): mount /mcp BEFORE the SPA
    catch-all `@app.get("/{full_path:path}")` and exclude /mcp in serve_spa.
4.  LIFESPAN (D4 §2 step 3; anchor app.py:34): the parent FastAPI(...) MUST
    compose mcp_app.lifespan or FastMCP's session manager never starts.
5.  STATELESS (D3 §4.2; D7 §5): stateless_http=True; read session state fresh
    from Lakebase per request; no engine correctness depends on in-process
    state; two concurrent sessions never share memory.
6.  APP NAME (D4 §2; D9 §4): the deployed app name MUST start with "mcp-".
7.  TOOL BUDGET ≤ 7 (D2 §1, §9): exactly 7 tools — 6 core + vibe_coach (added
    in Phase 2A, D2 §3.7). Read-only listings are RESOURCES; entry points are
    PROMPTS (both are free of the ~20-tool budget). Do NOT add an 8th.
8.  ANNOTATIONS + ERRORS (D2 §7, §8): every tool sets all four annotations and
    returns structuredContent validating its outputSchema PLUS a text block;
    expected failures return isError with a code from D2 §6 — never a protocol
    exception.
9.  VERBATIM FIRST (D1 §7; D3 §7.5 bypass_llm): present the step `prompt` body
    VERBATIM before narrating why/how. The Genie Accelerator is a bypass_llm
    track — the assembler renders, it does not paraphrase.
10. RECOMMEND-AND-PROCEED (D5 §3): every decision interaction carries a stated
    `recommended` default; the track never blocks on it (only §11 hard-stops).
11. SELF-SERVE BY CONSTRUCTION (D1 §1a; D4 §1.1; D2 §4–§5): a learner reaches
    step 1 with ONLY the app URL — orientation + help come from the server
    (orientation prompt, vibe://guide/getting-started) and the SPA
    "Connect to Genie Code" panel. D10 is a fallback, never a prerequisite.
12. ADDITIVE DATA ONLY (D6 §2, §7): new Lakebase columns/tables only; migration
    DDL is idempotent (IF NOT EXISTS); never rewrite or drop existing columns.
13. REPO REALITY (CLAUDE.md/AGENTS.md): this is a Databricks App — NEVER run
    uvicorn, npm run dev, or any local server. Pin mcp/fastmcp to EXACT
    versions in requirements.txt (this repo has NO uv/pyproject pinning).
    There is NO CI: run `pytest tests/...` locally and PASTE results in every
    PR. Reseed = scripts/deploy.sh --tables-only; deploy = --code-only -t
    <target>.

EXECUTION DOCTRINE
- PHASES RUN STRICTLY IN ORDER (D9 §1):
    Phase 0  engine (D3) ................. UI unchanged
    Phase 1  read-only MCP + self-serve on-ramp (D2, D4, D7)
    Phase 2  interactivity + state, in-band (D1, D5, D6)
    Phase 2A adaptive coaching (LLM, in-band) (D2 §3.7/§12, D1 §4.6, D5 §11,
             D6 §3a/§7a, D7 §6.1, D4 §1.2)
    Phase 3  repoint UI to the engine (D3 §4.3, D4 §3.3)
    Phase 4  generalize to all tracks
  Do NOT begin a phase until the prior phase's EXIT GATE is green AND the human
  has approved the between-phase gate. EXCEPTION (D9 §1): Phase 2A depends ONLY
  on Phase 2 and is decoupled from Phase 3 (different files, fail-open) — it may
  run AFTER Phase 2 in parallel with Phase 3, or be deferred. It is still
  IN-BAND: vibe_coach calls FMAPI server-side; it is NOT a server→client call
  and NOT sampling (D1 §10).
- PER PHASE, STEP 1: generate a writing-plans plan doc under
  docs/superpowers/plans/2026-09-22-mcp-phaseN-<name>.md from that phase's spec
  sources, copying these GUARDRAILS in verbatim and drawing each task's failing
  test from D8. THEN execute it task by task (TDD: write failing test → run →
  implement minimal → run → commit).
- TRUNK vs LEAVES: build the dependency TRUNK sequentially; /fanout only the
  independent LEAVES. Decide independence from each task's Interfaces
  (Produces/Consumes). SERIALIZE shared-file edits: app.py (the mount) and
  src/backend/workshop/manifest.json.
- /investigate (read-only) to CONFIRM every code anchor in the Anchor Pack
  against live source BEFORE any edit — anchors may have drifted (plan §1).
- /cross-review EVERY diff with a different-vendor reviewer than the
  implementer; blocking issues loop back until clean.
- ONE PR PER TASK. You never merge; the human merges.

EXIT GATES (first green gate each phase is OBJECTIVE)
- Phase 0: byte-parity of extracted assembler vs live routes.py:1241
  (D3 §9; D8 §2.4) + manifest order/flag/chaining parity (D8 §2.1–§2.3).
- Phase 1: MCP contract tests (D8 §3) + 307/mount/lifespan regressions
  (D8 §5) + SELF-SERVE ACCEPTANCE: learner → step 1 with only the URL
  (D9 §7 / D8 §4 self-serve).
- Phase 2: interactivity (D8 §4) + stateless isolation (D8 §6) + data-model
  migration (D8 §7).
- Phase 2A: coaching tests (D8 §4a) — grounding, FAIL-OPEN (model error / no
  endpoint → static fallback, is_fallback:true, NEVER isError), leakage scrub
  (before return AND before store, D7 §6.1), read-only, best-effort provenance
  (D6 §3a) — all mocking the services/llm.py FMAPI seam so they run offline.

HARD STOPS — human-only; NEVER attempt autonomously (D9 §5; D8 §8). Produce the
artifact/PR/runbook and WAIT:
- Deploying to ANY Databricks workspace (scripts/deploy.sh).
- The LIVE GENIE CODE SMOKE (D8 §8): a human must be in Agent mode and paste
  the /mcp URL; you cannot self-verify the client side.
- Reseed (deploy.sh --tables-only) and the number↔tag flip (D9 §5).
- (Phase 2A) The coaching serving-endpoint + per-call FMAPI cost decision
  (D9 §9 q4) is RESOLVED 2026-09-24 — ship 2A ENABLED: app-default endpoint,
  max_tokens~400, ~8s fail-open, per-triple cache, kill-switch env default on
  (superseded here; see polly-charter-next.md). Do NOT pick a different endpoint
  or change the knobs autonomously; enabling in a live workspace still rides the
  deploy hard stop.

PHASE FILE MAPS (where work lands)
- Phase 0 (D3 §11):
    src/backend/workshop/manifest.py + manifest.json   (loader + generated data)
    src/backend/workshop/engine.py                     (outline/next_step/
                                                        can_start/complete_step,
                                                        D3 §5.1–§5.4)
    src/backend/workshop/assembler.py                  (EXTRACT of
                                                        get_section_input_content
                                                        routes.py:1241,
                                                        behavior-identical, D3 §7)
    scripts/generate_manifest.py                       (emit manifest.json)
    tests/workshop/test_manifest_parity.py             (D3 §9 contract; test dir
                                                        per D8 §13 — use
                                                        tests/workshop/)
- Phase 1 (D4 §6):
    src/backend/mcp_server.py                          (FastMCP: 6 CORE tools D2 §3
                                                        (+ vibe_coach in Phase 2A → 7),
                                                        4 resources D2 §4,
                                                        3 prompts D2 §5)
    app.py                                             (mount /mcp before :162;
                                                        ASGI path-rewrite for 307;
                                                        compose lifespan at :34;
                                                        serve_spa excludes /mcp)
    SPA "Connect to Genie Code" on-ramp                (D4 §1.1)
- Phase 2 (D1, D6):
    interaction block + vibe_submit_answer handler     (D1 §5, §6)
    db/lakebase/ddl/12_mcp_engine_state.sql            (additive: captured_outputs,
                                                        completed_gates columns +
                                                        session_interactions table,
                                                        D6 §2, §3, §7)
- Phase 2A (D2 §3.7/§12, D1 §4.6, D5 §11, D6 §3a/§7a, D7 §6.1, D4 §1.2):
    src/backend/services/llm.py                        (EXTRACT of
                                                        call_databricks_serving_endpoint
                                                        routes.py:1400 + SERVING_ENDPOINT_NAME
                                                        routes.py:440; import from BOTH
                                                        routes.py and mcp_server.py — do
                                                        NOT import routes.py into the MCP
                                                        adapter)
    src/backend/mcp_server.py                          (ASYNC vibe_coach handler +
                                                        _COACH_SYSTEM constant + CoachResult
                                                        model; grounding context D2 §12.3;
                                                        leakage-scrub before return AND store)
    db/lakebase/ddl/13_mcp_coaching.sql                (additive: is_fallback, focus columns
                                                        on session_interactions, D6 §7a)
    tests/workshop/test_coaching.py                    (D8 §4a; mock the llm.py seam)

REUSE, DON'T REBUILD (D3 §7; roadmap "one engine, one assembler")
- The assembler is get_section_input_content (routes.py:1241). EXTRACT it;
  preserve: fork resolution (call at routes.py:1296; D3 §7.2), token
  substitution + placeholders (routes.py:1349–1356; D3 §7.3), return shape
  (routes.py:1515…; D3 §7.4), bypass_llm verbatim branch (D3 §7.5). NEVER write
  a second assembler.
- Identity: reuse GET /api/user/current (routes.py:6557) → session_id (D7 §1).
- Session store: reuse POST /api/session/save (routes.py:5944) keyed by
  session_id (D3 §4; NOTE: not :5787 — that citation is stale).
- Step metadata (how_to_apply/expected_output): GET /api/section-metadata/
  {section_tag} (routes.py:2252), bundled into the step payload (D3 §8).
- FMAPI for coaching (Phase 2A): call_databricks_serving_endpoint (routes.py:1400,
  ASYNC, takes system_prompt) + SERVING_ENDPOINT_NAME (routes.py:440). EXTRACT to
  services/llm.py; vibe_coach is an ASYNC tool so it can await it (D4 §1.2). NEVER
  write a second serving-endpoint client.

CADENCE
After each phase: summarize the PRs opened, the local pytest results, and the
human gate you're waiting on. Then STOP and wait.

START
Phase 0 only. /investigate and confirm the Anchor Pack against live code,
generate the Phase 0 plan, then execute to a green byte-parity + manifest-parity
gate. Do NOT touch Phase 1. Report and wait for my go.

──────────────────────────  ANCHOR PACK (verified 2026-09-22)  ──────────────────
app.py:34    app = FastAPI(...)                 (compose lifespan here)
app.py:44    ALLOWED_ORIGINS = [...]            (SPA allowlist, empty default)
app.py:60    async def security_middleware      (origin guard + rate limit)
app.py:64    if request.url.path.startswith("/api/")   (guards /api/ ONLY; /mcp skips it — D7 §4)
app.py:106   app.add_middleware(CORSMiddleware...)
app.py:108   allow_origins=ALLOWED_ORIGINS
app.py:109   allow_credentials=False
app.py:162   @app.get("/{full_path:path}")      (SPA catch-all; mount /mcp BEFORE)
routes.py:360    def get_section_input_template(...)      (fork resolver)
routes.py:1241   def get_section_input_content(...)       (THE assembler — extract)
routes.py:1296   get_section_input_template(section_tag, assistant_key)  (fork call)
routes.py:1349-1356  token substitution + placeholders + {prd_document} default
routes.py:1364-1371  conditional brand injection (fixed section_tag set)
routes.py:1515   return { ... }                 (assembler return shape)
routes.py:440    SERVING_ENDPOINT_NAME = os.getenv("DATABRICKS_SERVING_ENDPOINT", "databricks-claude-sonnet-4-5")  (Phase 2A coaching)
routes.py:1400   async def call_databricks_serving_endpoint(prompt, endpoint_name, max_tokens, temperature, system_prompt)  (EXTRACT to services/llm.py — Phase 2A)
routes.py:2252   @router.get("/section-metadata/{section_tag}")
routes.py:5944   @router.post("/session/save")  (CORRECTED; not :5787)
routes.py:6557   @router.get("/user/current")   (identity → session_id)
db/lakebase/ddl/03_sessions.sql          existing sessions schema (D6 §1)
db/lakebase/ddl/02_section_input_prompts.sql   prompt-content store (unchanged)
db/lakebase/ddl/12_mcp_engine_state.sql  Phase 2 additive migration (D6 §7)
db/lakebase/ddl/13_mcp_coaching.sql      Phase 2A additive migration: is_fallback, focus (D6 §7a)
════════════════════════════════════════════════════════════════════════════
```

---

## Notes for the human (not part of the charter)

- **Autonomy ceiling.** The charter drives Polly through **Phases 0–2 (plus the decoupled Phase 2A)
  built, tested, and PR'd**, stopping at the deploy and the live Genie Code smoke
  ([D9 §5](./mcp-workshop-rollout.md), [D8 §8](./mcp-workshop-test-plan.md)). The coaching
  serving-endpoint/cost decision that used to sit here is **resolved (2026-09-24): ship 2A enabled**
  with the signed-off knobs (D9 §9 q4) — it no longer gates the build.
- **Why "plan first."** Making Polly emit a writing-plans doc per phase keeps her execution on the
  byte-parity/test rails ([D3 §9](./workshop-engine-domain.md)) instead of free-decomposing from
  prose.
- **Drift found in this pass** (flagged, not yet fixed in the specs): D3 §4 and the retired roadmap
  cite `POST /api/session/save` at `routes.py:5787`; live it is **`routes.py:5944`**. The charter
  uses the correct anchor and tells Polly to re-verify regardless. Say the word and I'll refresh the
  D3 citation.
- **Test directory.** [D3 §11](./workshop-engine-domain.md) writes `tests/test_manifest_parity.py`
  while [D8 §2](./mcp-workshop-test-plan.md) uses `tests/workshop/…`; the charter picks
  `tests/workshop/` per [D8 §13](./mcp-workshop-test-plan.md)'s recommendation. Confirm or override.
