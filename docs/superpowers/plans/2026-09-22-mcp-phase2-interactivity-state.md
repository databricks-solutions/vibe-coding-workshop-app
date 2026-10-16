# MCP Phase 2 — Interactivity + State (in-band), with §4.4 compatibility floor

**Phase:** 2 of 5 (D9 §1). **Base:** `feature/genie-code-mcp-integration` @ `d5e9df3`.
**Scope (D9 §1):** turn the three Phase-1-deferred write tools into real, in-band
interactivity backed by additive Lakebase state — WITHOUT regressing the five
Genie Code browser-Save gates that were fixed live on top of merged Phase 1.
**Do NOT touch Phase 3+** (UI repoint, generalization).

Prior phases merged: Phase 0 (engine/manifest/assembler byte-parity) and Phase 1
(read-only MCP server + `/mcp` mount + 307 fix + self-serve on-ramp), plus five
browser-compat fixes (418434a, eeace35, 049dbaf, c9a85cf, baac0b5) and a config
commit (d5e9df3).

---

## GUARDRAILS (verbatim — propagate to EVERY sub-agent)

1.  PROBE FLOOR: Genie Code declares empty capabilities — NO elicitation, NO
    MRTR, NO sampling. ALL interactivity is IN-BAND. Never add a server→client
    protocol call. There is no code path where a missing capability blocks a step.
2.  307 IS THE #1 KILLER: POST /mcp MUST return 200, never a 307 redirect to
    /mcp/. The ASGI path-rewrite is already in place — do not break it.
3.  MOUNT ORDER: /mcp is mounted BEFORE the SPA catch-all and excluded in
    serve_spa. Do not disturb.
4.  LIFESPAN: the parent FastAPI composes the FastMCP session manager lifespan.
    Do not disturb.
5.  STATELESS: stateless_http=True; read session state FRESH from Lakebase per
    request; no engine correctness depends on in-process state; two concurrent
    sessions never share memory.
6.  APP NAME: the deployed app name MUST start with "mcp-". (Now baked into
    checked-in defaults at d5e9df3.)
7.  TOOL BUDGET ≤ 6: exactly 6 tools. Read-only listings are RESOURCES; entry
    points are PROMPTS. Do not add a 7th tool.
8.  ANNOTATIONS + ERRORS: every tool sets all four annotations and returns
    structuredContent validating its outputSchema PLUS a text block; expected
    failures return isError with a code from D2 §6 — never a protocol exception.
9.  VERBATIM FIRST: present the step `prompt` body VERBATIM before narrating
    why/how. The Genie Accelerator is a bypass_llm track — the assembler renders,
    it does not paraphrase. The interaction block is a SIBLING field, never text
    injected into the prompt.
10. RECOMMEND-AND-PROCEED: every decision interaction carries a stated
    `recommended` default; the track never blocks on it (only §11 hard-stops).
11. SELF-SERVE BY CONSTRUCTION: a learner reaches step 1 with ONLY the app URL.
12. ADDITIVE DATA ONLY: new Lakebase columns/tables only; migration DDL is
    idempotent (IF NOT EXISTS); never rewrite or drop existing columns.
13. REPO REALITY: this is a Databricks App — NEVER run uvicorn, npm run dev, or
    any local server. Pin mcp/fastmcp to EXACT versions (mcp is pinned; keep it).
    There is NO CI: run tests locally and PASTE results in every PR. The injected
    CLAUDE.md (uv / ./scripts/test.sh / asyncio_mode) is Genie Workbench's, NOT
    this repo — this repo uses unittest + pytest with FastAPI TestClient.

### §4.4 COMPATIBILITY FLOOR (Phase 2 regression contract — MUST stay green)

Server-side smoke passing while browser-side Save fails silently is the exact
trap. Every Phase 2 PR that touches mcp_server.py or app.py MUST keep all five
gates green and PASTE the gate-test results:

| Gate | Symptom | Fix location (do not break) | Test status |
|---|---|---|---|
| (a) CORS | 400 Disallowed CORS origin | `app.py:214-225` (allow_credentials=True; expose mcp-session-id, mcp-protocol-version) | **ADD test** |
| (b) Origin | 403 Invalid Origin | `mcp_server.py:254-267,282` (`enable_dns_rebinding_protection=False`) | **ADD test** |
| (c) Accept 406 | 406 dual-Accept required | `app.py:72-97,109-130`; `mcp_server.py:276-282` (`json_response=True`) | KEEP `tests/api/test_mcp_mount.py::test_normalize_mcp_accept_widens_intolerant_values`, `::test_post_mcp_with_json_only_accept_is_not_406` |
| (d) GET/DELETE | 200 hanging SSE stalls Save | `app.py:53-69,109-121` (405 on GET/DELETE) | KEEP `tests/api/test_mcp_mount.py::test_get_and_delete_mcp_return_405_not_a_hanging_sse` |
| (e) tools/list | all-200 handshake loop | `mcp_server.py:231-251` (strip outputSchema+annotations from listing) | **ADD test** |

Source of truth: `docs/specs/mcp_design/designing-mcp-servers-for-genie-code.md`
§4.4 (gates), §10 (checklist), §11 (anti-patterns), §12 (provenance).
NOTE: D8 §5 covers only 307/mount/lifespan — it does NOT cover these five gates.
This table is additive to D8 and is a hard exit condition for Phase 2.

---

## VERIFIED ANCHOR PACK (confirmed against live source @ d5e9df3)

### The 6 tools (mcp_server.py) — exactly 6 enforced at `tests/workshop/test_mcp_contract.py:39-42`
- READ: `vibe_start_track` (:420-442, can persist a new session), `vibe_get_step`
  (:469-489), `vibe_next_step` (:510-525).
- WRITE (Phase-2-deferred stubs, all return `PHASE_2_NOT_ENABLED`, msg at :537):
  - `vibe_complete_step(session_id, sectionTag, captured_output)` → `CompleteStepResult{completed_gates[], next}` (:540-561, :136-140)
  - `vibe_submit_answer(session_id, interaction_id, answer)` → `SubmitAnswerResult{recorded, coaching, unblocks}` (:565-586, :143-149)
  - `vibe_set_parameters(session_id, params)` → `SetParametersResult{resolved_params, missing_required}` (:590-610, :151-155)
- Error envelope: `_error_result` (:286-294) + `_ContractError` handler (:195-205);
  success validated vs `tool.output_schema` (:207-219).

### Engine (engine.py) — domain logic ALREADY EXISTS (Phase 0)
- `SessionState` already has `completed_gates: list[str]`, `captured_outputs:
  dict[str,str]`, `session_parameters` (:16).
- `complete_step(track_id, session, section_tag, captured_output=None)` (:153):
  UNKNOWN_TRACK (:161), UNKNOWN_STEP (:166), idempotent already-completed (:170),
  STEP_LOCKED (:177), UI_DRIVEN_STEP coached=True (:180), else append gate + store
  produces key (:183), returns ok + completed_gates copy + next_step (:187).
  Does NOT persist, does NOT validate content, does NOT enforce a decision gate.
- `resolve_previous_outputs(step, session)` filters captured_outputs to `consumes`
  (:194). `can_start` checks requiresGate ∈ completed_gates (:133).

### Assembler (assembler.py) + step payload
- `get_section_input_content(industry, use_case, section_tag, previous_outputs,
  session_id, coding_assistant_override)` (:18); prev outputs substituted (:147),
  missing → fallback (:150); returns `input` (:313).
- `_step_payload` sets `prompt = assembled["input"]` (mcp_server.py:402) and
  currently `interaction = None` (:109, :415). Phase 2 POPULATES interaction.

### Session persistence (services/lakebase.py + routes.py)
- `save_session` UPSERT (:682-687) writes step_1_prompt, step_prompts,
  completed_steps, skipped_steps, session_parameters — NOT captured_outputs /
  completed_gates / interactions. `load_session` (:826) selects only legacy cols +
  session_parameters. Lakebase `{schema}.sessions`; returns False when
  unconfigured (:639) — there is NO durable in-memory fallback.
- MCP fresh-state fallback: empty `SessionState()` when unconfigured
  (mcp_server.py:351).
- Endpoints: `/session/new` (:5461/:5527), `/session/save` (:5407/:5686/:5704
  merges into session_parameters JSONB), `/user/current` → {user, display_name}
  (:6276), `/section-metadata/{tag}` (:1971).

### DDL — `db/lakebase/ddl/12_mcp_engine_state.sql` does NOT exist
`03_sessions.sql` has `session_id VARCHAR(36) PK`, `created_by`, `session_parameters
JSONB`, `completed_steps TEXT`, `step_prompts JSONB`, timestamps
`TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP`, etc.
D6 (`mcp-workshop-data-model.md` §2/§3/§7) additive spec:
- `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS captured_outputs JSONB DEFAULT '{}'` (:54)
- `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS completed_gates JSONB DEFAULT '[]'` (:58)
- `CREATE TABLE IF NOT EXISTS session_interactions` (:68-74): id BIGSERIAL PK,
  session_id VARCHAR(36) FK→sessions, section_tag VARCHAR(128), interaction_id
  VARCHAR(160), kind VARCHAR(16), answer TEXT, recommended TEXT, was_default
  BOOLEAN DEFAULT FALSE, coaching_shown TEXT, surface VARCHAR(8) DEFAULT 'mcp',
  created_at TIMESTAMP … . Indexes on (session_id) and (session_id, section_tag) (:88).
- Migration file = the two ALTERs + table + indexes, all idempotent (:142).
  Match the real DDL's timestamp type (`TIMESTAMP WITHOUT TIME ZONE NOT NULL
  DEFAULT CURRENT_TIMESTAMP`), not D6's abbreviated `TIMESTAMP`.

### Interaction contract (D1 §5/§6, D5 §3)
- Block is optional, sibling field: `pre` (comprehension), `decision`
  (recommend-and-proceed), `post` (reflection). Each: id, type, question, options?,
  recommended, skippable, option-keyed coaching (D1 :195-202).
- Render order: prompt verbatim → why/how → pre → execute → decision → complete
  gate (D1 :220). Decisions MUST carry `recommended`; agent states it and proceeds;
  override via `vibe_submit_answer`; decision recorded in captured_outputs + log
  (D1 :126-131).
- Comprehension answers return short coaching, NEVER block; skippable silence
  advances accepting the recommended default (D1 :117; D5 :77,:163).
- `vibe_submit_answer` = single consolidated write for comprehension + decision
  override: resolve default/override, record ONE session_interactions row, return
  coaching, advance interaction/decision state — gate completion + next_step stay
  with `vibe_complete_step` (D1 :136,:180).

---

## DECISIONS (recommend-and-proceed — flag any to change)

- **D-1 (interaction content source):** author interaction blocks in a NEW additive
  data file `src/backend/workshop/interactions.json` loaded by `manifest.py`,
  keyed by sectionTag — NOT baked into the byte-parity `manifest.json` (which is
  guarded by parity tests and TS-derived; mutating it risks Phase 0 regressions).
  Phase 2 authors a MINIMAL set covering the Genie track's real decision points,
  especially step-9 `gagent_benchmarks`. RECOMMENDED. Alternative: extend the
  manifest generator — rejected (couples to getFilteredSections parity).
- **D-2 (step-9 hard-stop):** add a `GATE_REQUIRED` error code + gate to the ENGINE
  for `gagent_benchmarks` so `vibe_complete_step` refuses until the decision is
  confirmed (the ONE §11 hard-stop; all other decisions recommend-and-proceed).
  RECOMMENDED.
- **D-3 (persistence shape):** extend `save_session`/`load_session` to read/write the
  two new JSONB columns and add `append_session_interaction(...)`; keep legacy
  number-keyed writes intact (dual-write completed_steps + completed_gates per D8
  §7). RECOMMENDED. No new endpoint — the MCP tools call the lakebase service
  functions directly, same as Phase 1.
- **D-4 (flag):** keep write behavior behind the existing `MCP_MOUNT_ENABLED` mount
  flag; no separate Phase-2 flag. RECOMMENDED.
- **D-5 (test dirs):** engine/data tests → `tests/workshop/` + `tests/api/`; §4.4
  wire tests → `tests/api/test_mcp_mount.py` (extend) or a new
  `tests/api/test_mcp_browser_compat.py`. RECOMMENDED.
- **D-6 (isolation via TestClient):** stateless-isolation tests (D8 §6) run two
  independent sessions through the mounted app and assert no cross-talk; per-request
  freshness asserted by mutating Lakebase state between calls. RECOMMENDED.

---

## TASK GRAPH (trunk vs leaves; SERIALIZE shared files)

Shared files that must be serialized: `src/backend/mcp_server.py` (T2 ↔ T3),
`src/backend/services/lakebase.py` (T1 owns), `src/backend/workshop/engine.py`
(T2 owns). `app.py` is NOT edited in Phase 2 (§4.4 fixes already landed).

**Parallel wave 1 (independent leaves):** T1 ∥ T4.
**Then:** T2 (needs T1) → T3 (needs T1, serialized after T2 on mcp_server.py) → T5 (needs T2/T3).

### T1 — Data layer (TRUNK, foundational) — worktree `polly/mcp-p2-data`
- Add `db/lakebase/ddl/12_mcp_engine_state.sql`: the two `ADD COLUMN IF NOT EXISTS`
  + `CREATE TABLE IF NOT EXISTS session_interactions` + indexes (D6 §2/§3/§7,
  guardrail #12, match real timestamp type).
- Extend `services/lakebase.py`: `load_session` selects + returns
  `captured_outputs`/`completed_gates`; `save_session` UPSERT writes them
  (dual-write with legacy `completed_steps`); add `append_session_interaction(...)`.
- Failing tests first (D8 §7) → `tests/api/test_engine_state.py`: DDL idempotency
  (run twice, no error), dual-write completed_steps + completed_gates, number↔tag
  round-trip, interaction-log append (exactly one row + provenance fields).
- Produces: persistence functions consumed by T2/T3.

### T4 — §4.4 regression tests (LEAF, test-only) — worktree `polly/mcp-p2-compat-tests`
- ADD wire-level tests for gates (a) CORS OPTIONS (Origin echoed, credentials,
  exposed headers), (b) POST /mcp with Origin ≠ 403, (e) tools/list response has
  NO outputSchema/annotations. Assert (c)/(d) still green (reference existing).
- No production code change expected (fixes already landed). If a test reveals a
  real gap, STOP and report — do not silently patch beyond the gate.
- Independent of T1–T3; dispatch in parallel with T1.

### T2 — Write tools: complete_step + set_parameters (TRUNK) — worktree `polly/mcp-p2-complete`
- Implement `vibe_complete_step`: load FRESH `SessionState` from Lakebase (guardrail
  #5) → `engine.complete_step` → persist captured_outputs/completed_gates → return
  `CompleteStepResult`. Add engine `GATE_REQUIRED` hard-stop for `gagent_benchmarks`
  (D-2). Idempotent retries (D8 §6).
- Implement `vibe_set_parameters`: resolve params, compute missing_required, persist
  into session_parameters, return `SetParametersResult`.
- Failing tests first (D8 §4/§6) → extend `tests/workshop/`: complete_step advances
  gate + persists; step-9 `gagent_benchmarks` → `GATE_REQUIRED` until confirm;
  idempotent complete_step retry; set_parameters resolved/missing.
- Depends on T1 (rebase onto T1 branch).

### T3 — Interaction layer: submit_answer + populate interaction block (TRUNK) — worktree `polly/mcp-p2-interaction`
- Add `interactions.json` (D-1) + loader; populate `ExplainabilityPayload.interaction`
  in `_step_payload` (verbatim prompt untouched — guardrail #9).
- Implement `vibe_submit_answer`: resolve default/override, append ONE
  session_interactions row (answer, recommended, was_default, coaching_shown,
  surface, ts), return coaching, never block (guardrail #10); gate stays with T2.
- Failing tests first (D8 §4) → `tests/workshop/test_interactivity.py`: interaction
  block schema on vibe_get_step; submit_answer → session_interactions + coaching;
  decision type carries `recommended`; capabilities:{} → in-band only (NO
  elicitation/create); orientation preamble present.
- Depends on T1; SERIALIZE after T2 (shared mcp_server.py) — rebase onto T2.

### T5 — Statelessness / isolation (D8 §6) — worktree `polly/mcp-p2-stateless`
- Failing tests → two-session A/B isolation (never see each other's captured_outputs/
  gates), per-request freshness (no stale in-process cache), idempotent complete_step.
- Depends on T2/T3 (working write path); rebase onto the merged head.

---

## PER-TASK CONTRACT (every implementer)
- TDD: write the failing test from D8 first → run (red) → minimal implement → run
  (green) → commit. One PR per task; open your OWN PR; never merge.
- Run the FULL affected suites with the pinned `mcp==<pinned>` interpreter (the
  worktree `.venv`, NOT pyenv-global) and PASTE results in the PR. Isolate from the
  home-dir pyproject.toml: `python3 -m pytest -c /dev/null --rootdir=. <paths>`.
- If your task touches mcp_server.py or app.py, ALSO run the §4.4 gate tests
  (a)–(e) and paste them — the compatibility floor is a hard exit condition.
- Never run uvicorn/npm dev; never deploy; never reseed. Additive DDL only.
- Confirm any anchor line against live source before editing (lines drift).

## EXIT GATE (objective; verified by polly + cross-review)
- D8 §4 interactivity green (tests/workshop/test_interactivity.py) + D8 §6 stateless
  isolation green + D8 §7 data-model migration green (tests/api/test_engine_state.py).
- §4.4 gates (a)–(e) all green (compatibility floor).
- Every PR cross-reviewed by a DIFFERENT vendor (codex ↔ cursor this run).

## HARD STOPS (human-only — produce artifact/PR/runbook and WAIT)
- Any `scripts/deploy.sh` deploy to a workspace.
- Reseed (`scripts/deploy.sh --tables-only`) to apply `12_mcp_engine_state.sql`, and
  the live Genie Code smoke (D8 §8) re-run to confirm interactive Save end-to-end.
- polly never merges; the human merges every PR.
