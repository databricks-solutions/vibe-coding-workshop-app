# MCP Phase 1 — Read-only MCP surface + self-serve on-ramp

**Phase:** 1 · **Date:** 2026-09-22 · **Base:** `feature/genie-code-mcp-integration` @ `8e9acdf`
(Phase 0 merged: manifest/engine/assembler present)
**Spec sources:** D2 (contract), D4 (architecture/mount), D7 (security), D8 (tests §3/§5/§4), D9 (rollout/phasing).

---

## NON-NEGOTIABLE GUARDRAILS (verbatim — propagate to EVERY sub-agent)

1.  **PROBE FLOOR** (plan §1; D1 §2, §10): Genie Code declares empty capabilities — NO elicitation,
    NO MRTR, NO sampling. ALL interactivity is IN-BAND. Never add a server→client protocol call.
    There is no code path where a missing capability blocks a step.
2.  **307 IS THE #1 KILLER** (D4 §2; D7 §2; D8 §5): POST /mcp MUST return 200, never a 307 redirect
    to /mcp/. Implement an ASGI path-rewrite so /mcp is served without redirect.
3.  **MOUNT ORDER** (D4 §2.1; anchor app.py catch-all): mount /mcp BEFORE the SPA catch-all
    `@app.get("/{full_path:path}")` and exclude /mcp in serve_spa.
4.  **LIFESPAN** (D4 §2 step 4; anchor app.py FastAPI ctor): the parent FastAPI(...) MUST compose
    mcp_app.lifespan or FastMCP's session manager never starts.
5.  **STATELESS** (D3 §4.2; D7 §5): stateless_http=True; read session state fresh from Lakebase per
    request; no engine correctness depends on in-process state; two concurrent sessions never share memory.
6.  **APP NAME** (D4 §2; D9 §4): the deployed app name MUST start with "mcp-".
7.  **TOOL BUDGET ≤ 6** (D2 §1, §9): exactly 6 tools. Read-only listings are RESOURCES; entry points
    are PROMPTS (both free of the ~20-tool budget).
8.  **ANNOTATIONS + ERRORS** (D2 §7, §8): every tool sets all four annotations and returns
    structuredContent validating its outputSchema PLUS a text block; expected failures return isError
    with a code from D2 §6 — never a protocol exception.
9.  **VERBATIM FIRST** (D1 §7; D3 §7.5 bypass_llm): present the step `prompt` body VERBATIM before
    narrating why/how. The Genie Accelerator is a bypass_llm track — the assembler renders, it does not paraphrase.
10. **RECOMMEND-AND-PROCEED** (D5 §3): every decision interaction carries a stated `recommended`
    default; the track never blocks on it (only the §11 hard-stop). [Interaction content is Phase 2.]
11. **SELF-SERVE BY CONSTRUCTION** (D1 §1a; D4 §1.1; D2 §4–§5): a learner reaches step 1 with ONLY
    the app URL — orientation + help come from the server (orientation prompt,
    vibe://guide/getting-started) and the SPA "Connect to Genie Code" panel. D10 is a fallback, never a prerequisite.
12. **ADDITIVE DATA ONLY** (D6 §2, §7): new Lakebase columns/tables only; migration DDL is idempotent
    (IF NOT EXISTS); never rewrite or drop existing columns. [DDL is Phase 2; Phase 1 must not require it.]
13. **REPO REALITY** (CLAUDE.md/AGENTS.md): this is a Databricks App — NEVER run uvicorn,
    npm run dev, or any local server. Pin mcp/fastmcp to EXACT versions in requirements.txt (this repo
    has NO uv/pyproject pinning). There is NO CI: run `pytest tests/...` (explicit paths) locally and
    PASTE results in every PR. Reseed = scripts/deploy.sh --tables-only; deploy = --code-only -t <target>.

---

## VERIFIED ANCHOR PACK (post-merge, against 8e9acdf — supersedes the charter's stale citations)

app.py (199 lines):
- `app = FastAPI(...)` @ **app.py:33-38** — NO `lifespan=` yet → compose FastMCP lifespan here (G#4).
- `security_middleware` @ **app.py:59-65**, guard `if request.url.path.startswith("/api/")` @ :64 →
  /mcp NOT intercepted by origin-guard/rate-limit (D7 §4 — intended for the guard; rate-limit gap = documented decision).
- CORS @ **app.py:106-112** (`allow_origins=ALLOWED_ORIGINS` env empty-default @ :44, `allow_credentials=False`).
- Routers @ :115-116; static mounts /assets :141-145, /uploads :156-158.
- SPA catch-all `@app.get("/{full_path:path}")` @ **app.py:161-167**; serve_spa excludes
  `api/ health docs openapi.json` @ :166 — NOT mcp. Mount /mcp BEFORE :161; add `mcp` exclusion (G#3).
- Launch: `python app.py` → `uvicorn.run(app,...)` @ :196-199 → lifespan must live on the `app` object.
- NO existing FastMCP/mcp_app/streamable_http/ASGI-rewrite anywhere in code (clean slate).

routes.py (`src/backend/api/routes.py`) — REUSE points (post-merge lines; charter citations were pre-merge):
- Identity: `_get_session_user(request)` @ **:5498-5524** reads `x-forwarded-*` headers → email/"unknown".
  `GET /user/current` @ **:6276** returns `{user, display_name}` — **NO session_id** (charter claim inaccurate).
- Session mint: `GET /session/new` @ **:5527** → `session_id = str(uuid.uuid4())`, `save_session(...)`.
- Persist: `POST /session/save` @ **:5663**, keyed by session_id; `save_session()` UPSERT
  (`services/lakebase.py:592`); flags in `session_parameters` JSONB.
- Step metadata: `GET /section-metadata/{section_tag}` @ **:1971** → 5-key dict via get_section_input_content.
- **NO `services/auth.py` / OBO ContextVar in this repo** (that was the injected Genie Workbench structure).
  Identity = headers via `_get_session_user`; SP client = `get_workspace_client()` @ :459.

Merged workshop core (`src/backend/workshop/`, importable as `src.backend.workshop.*`):
- engine.py: `outline(track_id, session)→list[StepStatus]`, `next_step(track_id, session)→Step|Done`,
  `can_start(step, session)→bool`, `complete_step(track_id, session, section_tag, captured_output=None)→CompleteResult`,
  `resolve_previous_outputs(step, session)→dict`. Types: SessionState, StepStatus, Done, CompleteResult.
  Module-level `MANIFEST = manifest.load_manifest()`.
- assembler.py: `get_section_input_content(industry, use_case, section_tag, previous_outputs=None,
  session_id=None, coding_assistant_override=None)→10-key dict` (input, input_template, system_prompt,
  how_to_apply, expected_output, how_to_apply_images, expected_output_images, bypass_llm, _brand_url,
  coding_assistant_variant).
- manifest.py: `load_manifest(path=None)→Manifest`, `track_steps(track_id, path=None)→list[Step]`;
  manifest.json resolves as sibling file.

Deps/test/deploy reality:
- requirements.txt uses `>=` ranges; `mcp`/`fastmcp` ABSENT. No pyproject.toml/uv.lock. fastapi 0.129 / pytest 9 locally.
- Deploy `python app.py`; requirements.txt synced via bundle. Tests: mixed unittest(tests/api)+pytest(tests/workshop); NO CI.
- **Isolated-pytest quirk:** home-dir `/Users/prashanth.subrahmanyam/pyproject.toml` (genie-workbench, asyncio_mode=auto,
  testpaths=backend/tests, langsmith) pollutes bare `pytest`. ALWAYS run with explicit paths +
  `-c /dev/null --rootdir=.` and LAKEBASE/PG env unset.

---

## PHASE 1 SCOPE (authoritative: D9 §1 + D4 §6 file map)

IN: mount FastMCP at /mcp/; **read-only tools** `vibe_start_track` / `vibe_get_step` / `vibe_next_step`
wired to the Phase 0 engine+assembler; the 4 resources (D2 §4); the 3 prompts (D2 §5); the self-serve
on-ramp (orientation prompt, `vibe://guide/getting-started`, SPA "Connect to Genie Code" panel).
OUT (→ Phase 2): `vibe_complete_step` / `vibe_submit_answer` / `vibe_set_parameters` full behavior,
the `interaction` block, Lakebase columns (`12_mcp_engine_state.sql`), interaction log, auth writes.

### DECISION D-1 (flag to human) — D8 §3 "exactly 6 tools" vs D9 §1 "3 read-only tools"
**Recommendation:** register the **full 6-tool catalog** in `mcp_server.py` in Phase 1 (satisfies the
D8 §3 budget/shape/annotation contract), with the **3 read-only tools fully functional** and the **3
write tools contract-complete** (correct inputSchema/outputSchema/all-4-annotations/description) but
their handlers returning a typed, in-result deferral until Phase 2 wires state (they must NOT perform
partial writes and MUST NOT require the Phase 2 DDL — G#12). D8 §3 shape/budget tests run in Phase 1;
the behavioral write-error-path tests (`GATE_REQUIRED`, `UI_DRIVEN_STEP`, `UNKNOWN_INTERACTION`,
`INVALID_PARAM`) land with their behavior in Phase 2 (D8 §4). Alternative: ship only 3 tools now and
make the "6 tools" test a Phase 2 gate — rejected because D9 §7 lists D8 §3 as the Phase 1 gate.

---

## TASKS

### T1 — `src/backend/mcp_server.py` (TRUNK; first) + contract & self-serve tests + dependency pin
**Produces:** module-level `mcp` FastMCP instance importable by app.py; `mcp.http_app(path="/",
transport="streamable-http", stateless_http=True)` usable. requirements.txt exact pin for `mcp`
(+`fastmcp` only if used).
**Consumes:** workshop engine/assembler/manifest; `_get_session_user`+`/session/new`(uuid4)+`save_session`
for identity→session; `/section-metadata` data (via assembler) for how_to_apply/expected_output.
**Contract:** D2 §3 (6 tools), §4 (4 resources), §5 (3 prompts), §6 (error taxonomy), §7 (output
contract), §8 (annotation matrix). Read-only tools map to engine `outline`/payload+assembler/`next_step`.
Identity→session per request, stateless (G#5, D7 §1). Verbatim-first in get_step payload (`prompt` from
bypass_llm branch, G#9). Prompts restate verbatim-first; orientation prompt + guide resource are the
self-serve surface (G#11). Version pin: implementer determines the latest stable `mcp` compatible with
Python 3.9+/fastapi 0.129, pins EXACTLY, records the value + rationale in the PR (DECISION D-2).
**Failing tests (TDD) — from D8:**
- `tests/workshop/test_mcp_contract.py` (D8 §3): exactly 6 tools; each description 200–400 chars;
  flat inputSchema (<8 params); outputSchema present; all 4 annotations set (D2 §8 matrix); every tool
  returns structuredContent validating outputSchema + mirrored text block; read-tool error codes
  (`UNKNOWN_TRACK`, `INVALID_SESSION`, `UNKNOWN_STEP`, `STEP_LOCKED`) return isError not exception;
  4 resources declare ttlMs+cacheScope with `vibe://session/{id}/state` no-cache; 3 prompts resolve to
  messages restating verbatim-first.
- `tests/workshop/test_mcp_selfserve.py` (D8 §4 self-serve subset / D9 §1 acceptance): the
  `Start the Genie Accelerator` prompt + first `vibe_get_step` carry the orientation preamble;
  `Continue where I left off` does NOT; `vibe://guide/getting-started` resolves and contains
  setup/troubleshoot copy; `How does this workshop work?` resolves without tool knowledge; an
  orientation-free client reaches "step 1 presented" using ONLY prompts + resources.
**Guard:** register write tools contract-complete but behavior-deferred (D-1); do NOT create/require
Phase 2 DDL; do NOT run a live server.

### T2 — `app.py` mount (TRUNK; after T1; SERIALIZE app.py) + mount regression tests
**Produces:** `/mcp` mounted before the SPA catch-all; ASGI path-rewrite middleware (/mcp→/mcp/, no
307); `mcp_app.lifespan` composed into the FastAPI app (contextlib AsyncExitStack per D4 §7 q3);
serve_spa excludes /mcp; the mount behind a feature flag (DECISION D-3: env var, default-OFF until
Phase 1 sign-off, D9 §6/§9).
**Consumes:** T1's `mcp` object.
**Failing tests (TDD) — from D8 §5:** `tests/api/test_mcp_mount.py`: POST /mcp returns **200 not 307**
(assert no `Location: /mcp/`); a /mcp request is NOT served index.html (mounted before catch-all;
serve_spa excludes it); the FastMCP session manager starts (a basic `initialize` handshake succeeds →
lifespan composed). Use FastAPI TestClient; no live server (G#13).
**Guard:** app.py is the single highest-risk shared file — one editor, minimal diff. CORS unchanged
(D7 §3). No in-process rate bucket on /mcp (D7 §4, DECISION D-4: auth-proxy-only for v1).

### T4 — SPA "Connect to Genie Code" on-ramp (LEAF; parallel with T1)
**Produces:** a landing-page panel (D4 §1.1): the exact `https://<app-url>/mcp` string + copy button;
the 3 steps (Agent mode → add custom MCP server → paste URL) rendered from the same source as D10 §2
(no drift); a one-line "then say *Start the Genie Accelerator*" pointer to the MCP prompt.
**Consumes:** nothing from T1/T2 except the URL convention (`/mcp`).
**Failing test:** a frontend component/render test asserting the panel shows the `/mcp` URL, copy
control, the 3 steps, and the prompt pointer. Build+lint clean (`npm run build`, lint) — D8 §11.
**Guard:** frontend only; no backend coupling; independent leaf → safe to run in parallel.

Note: the architecture image regen (D4 §6, `.mmd/.png` — add interactivity layer, drop elicitation
arrow) is an OPTIONAL Phase 1 doc chore; defer/skip unless requested (not a gate).

---

## DEPENDENCY GRAPH & EXECUTION

- **Trunk (sequential):** T1 (mcp_server.py) → T2 (app.py mount). T2 imports T1's `mcp`.
- **Leaf (parallel):** T4 (SPA on-ramp) runs concurrently with T1.
- **Serialize:** app.py (T2 only). requirements.txt pin folded into T1 (single editor).
- **Cross-review:** every PR reviewed by a DIFFERENT vendor (codex↔cursor). One PR per task.

Order: dispatch **T1 (codex) + T4 (cursor)** in parallel → cross-review each (cursor/codex resp.) →
on T1 clean, dispatch **T2 (cursor)**, review (codex). Verify all gates locally (isolated pytest) before
declaring the phase gate.

## PHASE 1 EXIT GATE (objective; D9 §7)
- D8 §3 contract tests green (6 tools, annotations, output/error, resources, prompts).
- D8 §5 regressions green (307-no-redirect, mount order, lifespan handshake).
- Self-serve acceptance (D8 §4 subset / D9 §1): orientation-free client → "step 1 presented" via URL only.
- Frontend build/lint clean.

## HARD STOPS (human-only — produce artifact/PR/runbook and WAIT; D9 §5, D8 §8)
- Deploying to ANY Databricks workspace (`scripts/deploy.sh`).
- The LIVE GENIE CODE SMOKE (D8 §8): a human in Agent mode pastes the /mcp URL; polly cannot self-verify the client side.
- Reseed (`--tables-only`).

## DECISIONS FOR HUMAN (recommend-and-proceed; flagged, not blocking)
- **D-1** 6-tool catalog vs 3 tools — recommend full 6 (read-only functional, writes deferred). [above]
- **D-2** exact `mcp`/`fastmcp` pin — implementer determines latest stable, pins exactly, records in PR;
  re-run 307/lifespan tests after (D9 §3). Recommend the `mcp` SDK's built-in `mcp.server.fastmcp.FastMCP`
  (D4 §2.1 API) → pin `mcp==<x>`; add standalone `fastmcp` only if actually imported.
- **D-3** MCP mount feature flag — recommend env var (e.g. `ENABLE_MCP`) default-OFF until Phase 1 sign-off (D9 §9).
- **D-4** /mcp rate limit — recommend auth-proxy-only for v1; no in-process bucket (D7 §4).
- **D-5** session creation policy — recommend auto-create on first `vibe_start_track` (D7 §9 q3).
- **D-6** test dir — `tests/workshop/` (contract+self-serve), `tests/api/` (mount) per D8 §13.
