# Phase 3 — T3c: endpoint becomes the STATUS + live-sync authority (retire the getFilteredSections fallbacks)

Base: `feature/genie-code-mcp-integration` @ `87bff24` (PR #58 merged). ONE PR.
Lands BEFORE Task 4. polly supervises; claude_code implements -> cursor reviews
(codex down, HOME/isaac). polly WRITES NO CODE and NEVER MERGES.

HARD STOPS (human-only): any scripts/deploy.sh deploy; any reseed (none expected);
the number<->tag flip / legacy-store drop (that is Task 5 — the Set<number> compat
shim STAYS through T3c).

---

## NON-NEGOTIABLE GUARDRAILS (verbatim, inherited Phase 3)

1. ONE ENGINE: consume engine.outline() via the existing GET /api/track/{track}/outline;
   never fork a second outline/status builder. STATUS comes from the endpoint's
   per-step `status` field (done/current/locked/skipped), not a new source.
2. PARITY STAYS GREEN: the T2/T3a golden harness must remain non-hollow and passing;
   ORDER is unchanged by this task (already engine-sourced) — T3c only changes where
   STATUS comes from and removes the fallbacks.
3. NEVER BLANK THE SIDEBAR: replacing the getFilteredSections fallback must degrade to
   a loading/skeleton (and retry) state on an unresolved/errored fetch — never an empty
   outline, never a silent getFilteredSections re-render.
4. OPTIMISTIC STAYS INSTANT: keep the immediate local checkmark on a user action, but
   reconcile against the endpoint projection on the next fetch (optimistic overlay,
   endpoint truth). A completed step must never flicker back to not-done.
5. ADDITIVE/REVERSIBLE; REPO REALITY: no uvicorn/npm run dev; targeted offline
   `pytest tests/workshop` (SDK-neutralized) + `npm run build`/`lint` from repo ROOT,
   paste; IN-REPO context only; cross-review (claude_code <-> cursor).

---

## VERIFIED ANCHOR PACK (3 explores against live `87bff24`; drift corrected)

### orderedSectionsForRead (workflowSections.ts) — the 4 fallbacks
Function body 927-981 (doc comment 899-926). The `return fallbackSections` exits:
- **#1 (line 934)** `if (!outlineTags || outlineTags.length === 0) return fallbackSections;`
  — unresolved/errored/empty. T3c: route to a LOADING/SKELETON state, not getFilteredSections.
- **#2 (938-939)** `if (direction === 'reverse' && !isReverseTrack) return fallbackSections;`
  — forward-baseline track viewed reverse; removable once refetch-after-persist (Work A)
  guarantees `direction` is persisted BEFORE render (the 4 reverse-* tracks bake reverse
  intrinsically and are already safe).
- **#3 (960-961)** interleaving guard `if (seenSectionIds.has(meta.id)) return fallbackSections;`
  — defensive, never fires in steady state (parity keeps sections contiguous); assert
  contiguity in a test, then drop.
- **#4 (970-978)** coverage shortfall `if (adopted !== clientVisible) return fallbackSections;`
  — persisted-variant lag (un-persisted climb); removable once refetch-after-climb (Work A).
Success path builds `stepByTag`/`metaById` from fallbackSections (chrome/object stay
track-correct) and walks outlineTags with an instant client-side disabledSectionTags
filter (:955). Step-level `continue` skips at :955/:957 are NOT function-level fallbacks.

### Two order-path callers (both repoint)
- `WorkflowDiagram.tsx:372` builds `fallbackSections = getFilteredSections(...)`; `:381`
  `rawSections = orderedSectionsForRead(fallbackSections, outlineTags, ...)` -> visibleSections.
- `App.tsx:517` builds fallbackSections; `:525` `orderedSectionsForRead(...)` inside the
  next-incomplete-step resolver (504-541); called from restore (:436) + loadSession (:605).

### STATUS ownership today (App-owned optimistic)
- `completedSteps: Set<number>` declared App.tsx:105; derived on load via
  `deriveCompletedStepNumbers` (36-44, prefers completed_gates -> completedGatesToStepNumbers).
- Optimistic writes in WorkflowDiagram: `toggleStepComplete` (826-878, add), `resetStepComplete`
  (886-893, DELETE = the flicker risk), skip/define-intent/setup paths. Upward sink =
  `handleCompletedStepsChange` (App.tsx:700-714) -> persists `completed_steps` (INTS) +
  compositionParams; does NOT write completed_gates.
- Sidebar consumes `Set<number>`: `isStepComplete(n)=completedSteps.has(n)` (:39-42),
  render dot/Check at :207/:227-256. Also PathAndArchitecture, SectionDetailPanel, ~90 step
  cards, header `.size` (App.tsx:1498). Numeric-identity consumers that MUST keep the compat
  shim (T5, not now): >=4 direction-lock, >=2 started-guard, Math.max current_step,
  APP_LAKEBASE_STEPS chain inference, STEP_SCORES/CHAPTERS scoring.

### Endpoint STATUS field (present, typed, currently DISCARDED)
- `TrackOutlineItem { sectionTag, title, status:'done'|'current'|'locked'|'skipped', execution }`
  (client.ts:352-357; server routes.py:5837-5844). status computed in engine.py:112-140 from
  `completed_gates` + skipped: done-prefix / exactly-one current / locked tail. FULL projectable state.
- The SPA drops it: `App.tsx:1012 setOutlineTags(resp.outline.map(i => i.sectionTag))` — ORDER only.

### getTrackOutline + write/persist inventory + fetch effect
- `client.ts:1271-1278 getTrackOutline(track, sessionId?)` -> `GET /api/track/{track}/outline?session_id`.
  Session-less call returns the fresh/default outline (test_no_session_returns_fresh_outline_for_path_track).
- Fetch effect `App.tsx:1002-1023`, deps `[sessionId, workshopLevel, direction]` — FLAG writes
  do NOT refetch (the T3c gap). Mirror the visibility useEffect (975-992): cancelled-flag,
  keep-prior-on-error, log-not-blank. NO sidebar skeleton component exists today (add a minimal one).
- ORDER/STATUS-changing persist sites to add refetch-after-persist: handleWorkshopLevelChange
  (673-678), handleDirectionChange (802-809), handleIncludeLakehouseChange (818-825),
  handleIncludeGenieOntologyChange (834-840), handleAIModulesChange (851-855),
  handleMedallionLayersChange (866-870), handleSaveSession (879-900), handleCompletedStepsChange
  (700-715, STATUS). Metadata/vibe updates (industry/use_case/brand/etc.) do NOT change ORDER.

### Parity harness (STAYS non-hollow; getFilteredSections MUST stay through T3c)
- test_outline_parity.py (+ test_manifest_parity.py); oracles scripts/dump_outline_matrix.mjs +
  dump_getfilteredsections.mjs import the REAL getFilteredSections. Regen:
  `node --experimental-strip-types scripts/dump_outline_matrix.mjs`. Tamper guard =
  test_oracle_regeneration_is_byte_identical. Offline env:
  `env -u DATABRICKS_HOST -u DATABRICKS_TOKEN DATABRICKS_CONFIG_FILE=/dev/null .venv/bin/python -m pytest tests/workshop/<files> -c /dev/null --rootdir=. -p no:cacheprovider -q`.
- Reverse/status test extension points: tests/api/test_outline_write_read_roundtrip.py (add a
  direction:reverse persist->GET case; today has climb + subtoggle only), tests/api/test_track_outline.py
  (status projection from completed_gates/completed_steps).

### FRONTEND TEST-RUNNER REALITY (shapes Work E)
- NO vitest/jest — only Playwright e2e + Python. A JS "zero getFilteredSections calls" unit
  assertion has no runner. The "zero runtime consumers" proof is therefore: (a) the T4-readiness
  GREP artifact itself, (b) a Node oracle-style spy script (read workflowSections.ts -> stub
  lucide -> import() under node --experimental-strip-types, wrap/spy getFilteredSections, assert
  0 calls on the endpoint-success path), and/or (c) a Python endpoint-side order-authority test.
  Do NOT add vitest (net-new infra) unless the human approves.

---

## THE ONE DECISION TO SURFACE — TestScenarioConfig.tsx & the T4-readiness grep

The charter's authorizing artifact is `rg getFilteredSections src` showing ONLY the definition +
parity oracle + test scaffolding — NO runtime read-path consumer. Three runtime `src/` callers exist:
`App.tsx:517`, `WorkflowDiagram.tsx:373` (both journey read-path, T3c removes cleanly), and
**`TestScenarioConfig.tsx:172`** (a session-less config/dev sandbox — "nothing here is saved",
sessionId=null, zero backend writes — that calls getFilteredSections DIRECTLY, not via the endpoint).

The charter said "repoint OR prove-safe." The prove-safe proof came back NEGATIVE: TestScenarioConfig
genuinely needs CLIENT-SIDE composition (level + local chip toggles + direction reorder) with NO
session, so a clean repoint onto the endpoint is either impossible or a functional regression
(a session-less getTrackOutline(track) call returns DEFAULT FORWARD order — it cannot do the
sandbox's local direction reorder or reflect un-persisted chip state). So one of:

- **Option A (polly RECOMMENDS):** treat TestScenarioConfig as OUT of the workshop-journey
  read-path. T3c removes the two journey consumers (App + WorkflowDiagram) + status + polling; the
  T4-readiness artifact = "the workshop-journey read-path makes ZERO getFilteredSections calls; the
  sole remaining runtime caller is the session-less TestScenarioConfig dev sandbox." T4 then decides
  how to handle it (keep a minimal client composer, or refactor). Honest; keeps T3c focused; does
  NOT regress the sandbox. COST: the grep is not literally "zero src consumers" — it is
  "zero journey consumers + 1 documented sandbox consumer."
- **Option B:** T3c also refactors TestScenarioConfig off getFilteredSections onto a small RETAINED
  pure composer (extract the ordering the sandbox needs; getFilteredSections becomes deletable in
  full at T4). More scope; touches T4's territory; keeps the grep literally clean.
- **Option C:** repoint TestScenarioConfig onto session-less getTrackOutline(track) + local filter,
  ACCEPTING the sandbox loses local direction-reorder fidelity. Grep clean; sandbox regressed.

polly recommendation: **A**. This is the one item to confirm with the human before dispatch, because
it defines the meaning of the authorizing artifact.

---

## WORK (ONE PR, once the human confirms the TestScenarioConfig scope)

- **A. REFETCH-AFTER-PERSIST** — after each ORDER/STATUS-changing persist site (level, direction,
  lakehouse, ontology, AI, medallion, save, completed_steps), refetch getTrackOutline so the outline
  reflects just-persisted state. Closes fallback #2 (direction persisted before render) and #4
  (coverage lag after climb). Co-locate with the outline effect (App.tsx:1002-1023); sequence the
  refetch AFTER the persist resolves.
- **B. ENDPOINT STATUS PROJECTION + optimistic overlay** — keep the full resp.outline in App state
  (not just .sectionTag); project each step's done/current/locked/skipped -> a Map<number,Status>
  (or done-Set) via the same tag->number map orderedSectionsForRead builds; UNION with the local
  optimistic completedSteps so a just-completed step never flickers back (guardrail #4). Re-key the
  sidebar/step status read to sectionTag where clean; the Set<number> compat shim STAYS (T5). Wire
  in App.tsx (completedSteps ownership) + SectionedWorkflowSidebar.
- **C. RELAX THE 4 FALLBACKS** in orderedSectionsForRead: #1 -> loading/skeleton state (guardrail #3,
  add a minimal skeleton; never getFilteredSections); #2 removable via (A); #4 removable via (A);
  #3 assert contiguity in a test then drop. NET: orderedSectionsForRead + BOTH callers make ZERO
  getFilteredSections calls on the endpoint-success path. Handle TestScenarioConfig per the human's
  A/B/C pick.
- **D. POLLING v1 (NOT SSE)** — poll getTrackOutline on an interval + on window focus/visibilitychange;
  debounce; PAUSE when document.hidden. Invent beside the outline effect (no reusable hook exists;
  Leaderboard setInterval is the structural precedent). React 19.2.x.
- **E. TESTS + T4-READINESS PROOF** — (per the no-JS-runner reality) the "zero getFilteredSections
  calls on success path" proof via a Node oracle-style spy script AND the grep artifact; a
  reverse-order-from-endpoint case (4 reverse-* + one forward-viewed-reverse) extending
  test_outline_write_read_roundtrip.py; a status-projection test (done/current/locked reconciles the
  optimistic overlay) extending test_track_outline.py; a refetch-after-persist test; a polling test
  (interval fires + reconciles + pauses when hidden — Playwright or the best available harness);
  parity harness stays green (non-hollow tamper->fail/regen->restore, pasted).

## VERIFY (paste into the PR)
- Targeted offline `pytest tests/workshop` (SDK-neutralized) + tests/api roundtrip/outline; parity
  non-hollow proof; in-repo import resolves.
- `npm run build` + changed-files lint from repo ROOT: 0 errors.
- **T4-READINESS GREP:** `rg getFilteredSections src` — remaining refs = definition + parity oracle
  + (per the A/B/C decision) either zero runtime consumers (B/C) or only the documented
  TestScenarioConfig sandbox (A). This is the artifact that authorizes T4.

## Roster / review
claude_code implements (system.ai.claude-opus-4-8[1m]) -> cursor reviews. ONE PR; polly never merges.
