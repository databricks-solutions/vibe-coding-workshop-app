# Phase 3 · Task 1 — Outline Endpoint (net-new, thin transport over engine.outline)

**Status:** authored 2026-09-27. One task, one PR. polly never merges; the human merges.
**Base:** `feature/genie-code-mcp-integration` @ `7652ced` (local == origin). Includes T0 (`4c06945`) and the NULL-bool coercion fix (`7652ced`).
**Implementer → Reviewer:** claude_code (`system.ai.claude-opus-4-8[1m]`) → codex if its auth recovers this session, else cursor (different vendor either way).

---

## GUARDRAILS (verbatim — propagate to the implementer)

- **G1 — one engine / one assembler.** The new REST outline route is THIN transport over `engine.outline(track, state)` — the SAME function MCP already calls via `_outline_items`. NEVER fork a second outline builder. The adapter contains ZERO workshop logic (D4 §1). Reuse `engine.outline` (engine.py:91) / `manifest.outline_order` (manifest.py:113).
- **G2 — tool budget.** Adds exactly ONE REST route, ZERO MCP tools. Never an 8th tool.
- **G3 — additive only.** No legacy-store drops, NO UI change (that's T3), NO parity-gated behavior change (that's T2). No new DDL. No reseed.
- **G5 — repo reality.** No uvicorn / no `npm run dev`. Pin any dep EXACT in requirements.txt (none expected here). NO CI → run the offline pytest suite locally and PASTE results in the PR.
- **G6 — process.** /investigate every anchor before editing (done — see anchor pack). One PR for T1 only. Cross-review by a DIFFERENT vendor than the implementer.
- **Probe floor still holds** (not touched by T1, but do not regress): POST /mcp returns 200 not 307; /mcp mounted before the SPA catch-all; lifespan composed; stateless_http; app name starts with `mcp-`. The §4.4 browser-compat floor tests must stay green.
- **HARD STOPS — human only; produce the PR and WAIT:** no `scripts/deploy.sh` (no deploy); NO number↔tag flip / legacy-number-store drop (D6 §5, D9 §5); no reseed. Stop after the T1 PR is open.

---

## VERIFIED ANCHOR PACK (confirmed live against `7652ced` by 3 explores)

**Router / grafting (routes.py):**
- `router = APIRouter()` — no prefix; `/api` applied at include time (app.py:229). Declare `@router.get("/track/{track}/outline")`.
- No `_validators.py`. Track validation is downstream: `manifest._track(track_id)` raises `KeyError` on unknown track.
- Natural insertion: right after `load_session_endpoint` (ends routes.py:5810), in the session block (~5544–5830). That region already imports `load_session` / `get_user_default_session` (routes.py:5375–5387) and `_get_session_user` (routes.py:5515).
- Query-param pattern (matches request shape): `async def get_track_outline(track: str, session_id: Optional[str] = None)` — `track` from path, `session_id` from query (mirrors `/section-metadata/{section_tag}` at routes.py:1978).

**Session load (services/lakebase.py):**
- `load_session(session_id) -> Optional[Dict]` (lakebase.py:828) returns the full dict: top-level `workshop_level` (fallback `"300"` — NOT a valid track id), `completed_gates`, `captured_outputs`, `completed_steps`, `current_step`, `prerequisites_completed`, `created_by`, and `session_parameters` JSONB (which holds `coding_assistant`, `flags`, etc.).
- `get_user_default_session(created_by)` (lakebase.py:1129) omits `captured_outputs`/`completed_gates`.

**7652ced NULL-coercion posture (mirror it):** `SessionLoadResponse` (routes.py:5442) has `@field_validator("prerequisites_completed","is_saved", mode="before")` coercing `None -> False`. Any strict bool/int field fed from a row column in a new response model MUST mirror this. (T1's outline items are all strings, so likely no bool fields — but keep the posture for any session-derived scalar.)

**The engine (the single source of truth):**
- `engine.outline(track_id: str, session: SessionState) -> list[StepStatus]` (engine.py:91). `StepStatus = {sectionTag, title, status, execution}`; `status ∈ {"done","current","locked","skipped"}`; `execution ∈ {"agent-doable","ui-driven","hybrid"}` (typed as bare `str` on the wire).
- `engine.outline` → `_ordered_steps` → `manifest.outline_order(track, flags=_flags_for(session))`. Ordering = manifest declaration order (section order, then step order), flag-gated steps filtered. `_flags_for` reads flags from `session.session_parameters` (nested `["flags"][name]`, then top-level `[name]`), else the flag's manifest `default`. genie-accelerator: `includeGenieOntology` (default false), `includeLakehouse` (default false); no `direction` flag.
- `SessionState` (engine.py:15): 3 fields — `completed_gates: list[str]`, `captured_outputs: dict`, `session_parameters: dict`.
- **The reusable builder:** `_session_state(record, track)` (mcp_server.py:435) converts a `load_session` dict → `SessionState`, back-filling `completed_gates` from `completed_steps` indices (the read-time number→gate backfill) and mirroring industry/use_case/*_label into params, copying `session_parameters` verbatim.
- **MCP parity reference:** `_outline_items(track, state)` (mcp_server.py:486) = `[OutlineItem(**asdict(i)) for i in engine.outline(track, state)]`. `OutlineItem` (mcp_server.py:97, `extra="forbid"`) = exactly `{sectionTag, title, status, execution}`. NO section grouping / metadata in the outline. Confirmed no second outline builder anywhere.

**Track resolution (SPA `resolveRestoredLevel`, src/constants/restoreLevel.ts) — NO Python equivalent exists:**
- Precedence: (1) use-case lock (`USE_CASE_LEVEL_LOCK`, only `build_skill -> skills-accelerator`) → (2) persisted `workshop_level` ONLY if it's a direct `WORKSHOP_LEVELS` key (`'300'`/`'200'`/`''`/`None` all FAIL and fall through) → (3) `assistantDefaultLevel` from `session_parameters.coding_assistant` via `DEFAULT_LEVEL_BY_ASSISTANT` (`{genie-code: genie-accelerator}` only; gated by no-lock + no `level_explicitly_selected`) → (4) `'end-to-end'`. Post-guard: resolved `skills-accelerator` with no lock → `'end-to-end'`.
- `WORKSHOP_LEVELS` = 14 track keys. `coding_assistant` is JSONB (`session_parameters`); `workshop_level` is a top-level column.
- Backend today: `mcp_server.py` hardcodes `DEFAULT_TRACK="genie-accelerator"` (:40) and never resolves track from the session.

---

## DECISIONS (recommend-and-proceed — surfaced here + in the PR body; none is the number↔tag flip, which stays the human's hard stop)

**DECISION-T1-1 — Track resolution (the load-bearing one, per the human's design note).**
The endpoint resolves the *effective* track via a **faithful Python port of `resolveRestoredLevel`** (a small pure helper, e.g. `src/backend/workshop/track_resolution.py::resolve_track(record)`), tolerating `workshop_level=None`/`'300'`:
1. use-case lock (`USE_CASE_LEVEL_LOCK.get(record["use_case"])`) →
2. `workshop_level` iff it is a member of the closed track-key set (`MANIFEST.tracks` keys) →
3. assistant default from `session_parameters.coding_assistant` (`{genie-code: genie-accelerator}`), gated by no-lock + no `level_explicitly_selected` →
4. `DEFAULT_TRACK` (`end-to-end`); with the `skills-accelerator`→`end-to-end` no-lock downgrade.
**Path-param interaction:** `{track}` is the highest-priority EXPLICIT request — if it is a valid known track key, the endpoint uses it directly (thin `engine.outline(track, state)`). The documented sentinel `auto` (or any non-track value) triggers the session-resolution chain above. **A naive `track = record["workshop_level"]` is explicitly forbidden** (500s/mis-resolves every legacy None session). The port must key off `MANIFEST.tracks` (the backend's authoritative track set), NOT re-hardcode the TS `WORKSHOP_LEVELS` list, so the two sets never drift. *Alternative for human veto: strict path-authoritative + 404 on unknown track, no session resolution — rejected because it doesn't honor the charter's "resolve track from persisted workshop_level" clause nor the None-tolerance requirement.*

**DECISION-T1-2 — Payload scope = flat MCP parity; sections/metadata are T3 presentation.**
The endpoint returns the **flat `_outline_items`-parity payload**: `outline: [{sectionTag, title, status, execution}]`, plus `track` (the resolved track) and `session_id`. It does **NOT** embed section grouping or per-section metadata — MCP's outline deliberately omits them, and the charter's own T3 task keeps a "presentation-only sectionTag-keyed map" and calls the existing `/section-metadata/{tag}` route per-step. Embedding section metadata now would fork behavior from `_outline_items` (violates G1 parity) and pull heavy assembler content onto the outline. *The charter prose says "sections + section metadata"; repo reality (the parity anchor `_outline_items` + `engine.outline`) wins — section composition is presentation, deferred to T3. Alternative for human veto: additively include manifest-derived section grouping (`sectionTag -> {section_id, section_title, chapter}`) now, sourced from the same manifest `Section` dataclass (no second builder, no assembler content).*

**DECISION-T1-3 — Extract the shared SessionState builder (no second builder; no FastMCP import into the REST layer).**
`_session_state(record, track)` and the thin `_outline_items` wrapper currently live in `mcp_server.py`. Importing `mcp_server` into `routes.py` would drag the FastMCP app/module side effects into the REST layer. So **extract `_session_state` (and, if trivial, the outline-wrapping) into `src/backend/workshop/` (e.g. `state.py` or into `engine.py`)** and have BOTH `mcp_server.py` and `routes.py` import it — one builder, behavior-identical (guarded by the existing MCP tests staying green). This keeps the adapter free of workshop logic (the number→gate backfill lives in the shared builder, not inlined in the route). *Alternative: keep `_session_state` in mcp_server and import it from routes — rejected (FastMCP import side effects).*

---

## TASK (single cohesive task → one worktree, one PR)

Implement `GET /api/track/{track}/outline?session_id=...` as thin transport over `engine.outline`, with the ported track resolver, following TDD.

**Files:**
- `src/backend/workshop/track_resolution.py` (new) — `resolve_track(record)` Python port (DECISION-T1-1).
- `src/backend/workshop/state.py` (new) OR `engine.py` — extracted `build_session_state(record, track)` (was `_session_state`) (DECISION-T1-3).
- `src/backend/mcp_server.py` — import the extracted builder; keep behavior identical (delete the local `_session_state`, re-point callers).
- `src/backend/api/routes.py` — the new route + a `TrackOutlineResponse` Pydantic model (mirror the 7652ced NULL-coercion posture for any strict scalar).
- `tests/api/test_track_outline.py` (new) — the failing tests below.

**TDD failing tests (write first, watch them fail, then implement minimally):**
- **T1-B1 (parity, the core):** for a crafted session (genie-code, some `completed_gates`), `GET /api/track/genie-accelerator/outline?session_id=X` returns 200 and its `outline` equals `[{sectionTag,title,status,execution}, …]` **byte-identical to `[asdict(i) for i in engine.outline("genie-accelerator", build_session_state(record,"genie-accelerator"))]`** (same object the MCP `_outline_items` would emit). Proves thin parity, no second builder.
- **T1-B2 (the human's non-negotiable — legacy None session):** a session with `workshop_level=None`, `session_parameters={"coding_assistant":"genie-code"}`, called with the sentinel (`/api/track/auto/outline?session_id=X`) → resolves to `genie-accelerator` and returns 200 with the genie outline. Does NOT 500, does NOT mis-resolve. Add the mirror case `workshop_level="300"` → same result.
- **T1-B3 (explicit path track wins):** `/api/track/end-to-end/outline?session_id=X` on the same genie-code session → renders the `end-to-end` outline (explicit request beats assistant default).
- **T1-B4 (unknown track → clean 404, not 500):** `/api/track/not-a-track/outline` with no session (or a session that also can't resolve it) → 404 with a structured error, never a 500 / unhandled `KeyError`.
- **T1-B5 (number→gate backfill parity):** a session with `completed_steps` set but `completed_gates` empty yields the correct `done` statuses via the shared builder — proving the read-time backfill is reused, not reimplemented.
- **T1-B6 (NULL tolerance):** a session row with `prerequisites_completed=None` / other NULL scalars does not 500 the new route (7652ced posture).
- **T1-B7 (extraction guard):** the existing MCP outline tests still pass after `_session_state` is extracted (behavior-identical); the extracted `build_session_state` produces the same `SessionState` the old inline path did.
- **T1-B8 (no-session behavior):** define + test the `session_id`-absent case (recommend: 200 with an all-`locked`/fresh outline for the resolved/゙path track, using an empty `SessionState`) so the endpoint is well-defined without a session.

Tests must run OFFLINE: monkeypatch/stub `load_session` to return crafted dicts (no live Lakebase), SDK-neutralized env. Use FastAPI `TestClient`.

**Flags note:** build `SessionState` from the record's `session_parameters` verbatim (via the shared builder) so `_flags_for` sees identical flag keys → identical genie-accelerator filtering (ontology/lakehouse steps off by default). Parity depends on this.

---

## EXIT GATE (T1)
- `tests/api/test_track_outline.py` green (T1-B1..B8).
- Full offline suite green: `tests/workshop` + `tests/api` (incl. the §4.4 browser-compat floor + MCP outline regressions) — PASTE outputs in the PR.
- Zero MCP tools added (still 7); one REST route added.
- No DDL, no reseed, no UI change, no legacy-store change.
- The route is provably thin: outline == MCP `_outline_items` parity for the same track+session (T1-B1).
- Track resolution mirrors the SPA chain and tolerates `None`/`'300'` (T1-B2). Chosen policy documented in the PR body (DECISION-T1-1/-2/-3), with the number↔tag flip explicitly noted as still-deferred to the human.

## CROSS-REVIEW FOCUS (different vendor)
- Parity is real (T1-B1 not hollow — compares against `engine.outline`, not a hand-rolled expected list).
- No second outline builder; adapter carries zero workshop logic; extraction is behavior-identical.
- Track resolver faithfully mirrors `resolveRestoredLevel` (precedence order, valid-key check against `MANIFEST.tracks`, None/'300' handling, skills-accelerator downgrade) and never 500s on a legacy session.
- §4.4 floor + MCP outline untouched/green.
