# T4 — Rebuild the sandbox on the engine, then retire getFilteredSections (Fork 4, 2-PR stack)

Status: T4a GATED (human-approved 2026-09-29; GAP B ruled B1). T4b stays stacked behind green+merged T4a.
Base: e7b2808 (PR #59 merged). Lands before T5.
Implementer: claude_code (model `system.ai.claude-opus-4-8[1m]`) → cursor review (codex down: host-side HOME/isaac auth).
Supervisor writes no code, never merges. Human reviews + merges. TWO PRs: T4a, then T4b stacked on T4a.

## FORK DECISION (human-ruled)
Rebuild the /config/test-scenario dev/QA preview so it renders engine.outline() computed on an EPHEMERAL,
UNPERSISTED SessionState built from the sandbox's chosen params (level, direction, disabled chips) — no session
creation, no writes. Sandbox STAYS. Not delete (Fork 3), not rename (Fork 1), not session-less-endpoint (Fork 2).

## GUARDRAILS (inherit T4 charter)
1. PARITY NON-HOLLOW ACROSS THE FLIP (T4b): freeze golden_outline_matrix.json + the manifest-parity goldens as
   PERMANENT; retire dump_getfilteredsections.mjs + dump_outline_matrix.mjs + the oracle-regeneration test + the
   Node spy; parity test compares engine.outline() vs FROZEN golden; prove tamper-golden->fail AND tamper-engine->fail.
2. NO T5 SCOPE: no completed_steps<->gate reconciliation, no number<->tag flip, no legacy-store drop, no
   endpoint-STATUS projection. Backend state.py/engine.py untouched EXCEPT the additive preview endpoint in routes.py.
3. NO BEHAVIOR CHANGE to the journey: engine order already authoritative + parity-identical; the persisted
   outline path, STATUS, number-stores, WorkflowDiagram/App orderedSectionsForRead are UNTOUCHED.
4. REPO REALITY: no uvicorn/npm run dev; targeted pytest offline (DATABRICKS_AUTH_TYPE=pat, unset LAKEBASE_HOST) +
   npm build/lint from repo ROOT, pasted; IN-REPO; cross-review claude_code<->cursor.

## HARD STOPS (human-only; produce PR + WAIT): deploy; any reseed; all T5 work.

## FEASIBILITY (verified, engine anchors) — CONDITIONAL GO -> GO under B1
- SessionState (engine.py:15-19) is a pure dataclass; constructible in-memory with NO DB/session-id. engine.outline
  is a pure fn of (track, session); the no-session branch already builds bare SessionState() at routes.py:5902.
  Additive preview coexists with the persisted path (gated behind `if session_id:` routes.py:5876).
- direction=reverse IS expressible via session_parameters['direction'] (_inputs_for engine.py:84-91; variant select
  manifest.py:130-140) FOR end-to-end (has a {direction:reverse} variant) + the 4 reverse-* tracks (reverse baked as
  default). Proven by test_outline_parity.py:204-227 (T3a).
- AI-module + medallion chips ARE structured flags (ai.*/medallion.*) read by _flags_for (engine.py:59-74), applied
  by outline_order (manifest.py:161-170). Proven parity (T3a 65-cell matrix).

## GAP A (resolved — NOT a stop)
The sandbox's ARBITRARY disabled-tag set — per-assistant getVisibility().disabled_steps + workspace_cleanup +
iterate_enhance/redeploy_test — does NOT map to any engine flag; _skipped_tags (engine.py:94-101) marks-but-keeps,
it does not DROP. But the production read path never asks the engine to drop them: orderedSectionsForRead applies
the disabled-tag filter CLIENT-SIDE (workflowSections.ts:954-955). The rebuilt sandbox does the identical thing:
engine.outline (flags + direction) for ORDER + structural drops, then filter effectiveDisabledTags client-side.
Arbitrary tags never enter the engine.

## GAP B (RULED: B1 — constrain the sandbox reverse toggle to variant-having tracks)
direction=reverse x a FORWARD level with NO manifest reverse variant is INEXPRESSIBLE ephemerally (engine returns
forward; only end-to-end has a {direction:reverse} variant; the 4 reverse-* tracks bake reverse as default).
DECISION: constrain the REBUILT SANDBOX's reverse toggle to {end-to-end + reverse-lakehouse, reverse-lakehouse-di,
reverse-lakebase, reverse-app}.
JUSTIFICATION (corrected — do NOT claim this mirrors the real app's gating):
  - The real app does NOT level-gate the reverse toggle. `directionLocked` (App.tsx:294-296) is a PROGRESS lock, not
    a level gate; the toggle renders on all non-accelerator levels and simply NO-OPS on variant-less ones post-T3c
    (the engine returns forward order for them).
  - B1 is justified on its own merits: (i) reverse is a DISTINCT ordering only for variant-having tracks — offering
    it on a variant-less level is meaningless (identical to forward); (ii) Reverse ETL is conceptually END-TO-END, so
    it belongs on end-to-end + the reverse-* tracks anyway.
OUT OF SCOPE (do NOT fold in): the real app's no-op reverse toggle on variant-less levels is a possible SEPARATE
  ticket, NOT T4. B2 (reverse-on-arbitrary-forward-levels) is REJECTED — not a product requirement; it is a no-op in
  the real app.

## T4a — WORK (ONE PR; scope LOCKED)
- A. Additive preview endpoint (routes.py, sibling to GET /track/{track}/outline): accepts track + direction +
     flags (ai.*/medallion.* + includeLakehouse/includeGenieOntology) inline; builds ephemeral
     SessionState(session_parameters={direction, flags}); returns engine.outline tags. NO session-id, NO persist.
     Does NOT touch the persisted branch. NOT the arbitrary disabled tags (those stay client-side).
- B. New client method (src/api/client.ts) sibling to getTrackOutline (do NOT overload the session-only GET).
- C. Repoint TestScenarioConfig.tsx:171-174: replace the sync getFilteredSections useMemo with an async fetch of the
     preview endpoint -> ordered tags -> join tag->number (ALL_STEPS / SECTION_TAG_TO_STEP_NUMBER) -> apply
     effectiveDisabledTags client-side filter -> runnableSteps/displaySteps. Add load/race/empty UX (mirror
     App.tsx:160-174 seq-guard). CONSTRAIN the reverse toggle to variant-having tracks per B1 (sandbox-only; do NOT
     touch the real app's toggle). Run-All (:301-368) + runOneStep (:228-281) + stepPreviousOutputs.ts UNCHANGED
     (number-keyed, no GFS).
- D. PARITY GATE (this PR's safety net; while getFilteredSections STILL EXISTS):
     (1) BYTE-IDENTITY across EVERY engine-expressible cell: prove the rebuilt preview path (engine order + client
         filter) == getFilteredSections(level, effectiveDisabledTags, undefined, direction) for all forward levels x
         chip combos + reverse on {end-to-end + reverse-*} x chip combos. Non-hollow (both sides live; compare vs
         REAL getFilteredSections output, not a hand-authored list).
     (2) POSITIVE DIVERGENCE ASSERTION (required by the human gate): for >=1 (variant-less level x reverse) cell,
         assert engine.outline returns the FORWARD order, DOCUMENTING that getFilteredSections' client-reverse on
         those cells is the INTENTIONALLY-RETIRED branch. This makes the harness honest: it shows both what is
         preserved (byte-identity) AND what is deliberately dropped (variant-less client-reverse).
     TOOLING: no JS unit runner (Playwright + Python only) -> Python endpoint test vs the committed getFilteredSections
     `ts` golden + a Node oracle comparison for the client-filter layer while GFS lives (retired in T4b). Implementer
     designs the exact harness.

## T4a VERIFY (paste into PR)
- `rg getFilteredSections src` end-state map (T4a still has the def + the sandbox no longer calls it directly for
  order — it calls the preview endpoint; document the exact remaining refs).
- The FULL byte-identical parity matrix (every engine-expressible cell) + the NEW divergence assertion output.
- Targeted pytest tests/workshop + tests/api offline + npm build + changed-files lint from ROOT: 0 errors.
- Confirm (diff) persisted outline path / STATUS / number-stores / journey read path UNTOUCHED (no T5 creep).

## T4b — WORK (stacked on green+merged T4a; ONE PR; dispatched only after human merges+deploys+smokes T4a)
- Delete getFilteredSections body (:776-897) + orphaned REVERSE_SECTION_ORDER (:1042-1049). orderedSectionsForRead
  untouched. Reword 6 stale comments (:112,:216,:248,:340,:903,:915).
- Retire dump_outline_matrix.mjs + dump_getfilteredsections.mjs + spy_ordered_sections_for_read.mjs +
  test_oracle_regeneration_is_byte_identical. Freeze golden_outline_matrix.json + golden_order_genie_* +
  golden_define_usecase_by_track as permanent. Rewire parity to engine-vs-frozen-golden. Reword dump-citing comments
  in test_manifest_parity.py.
- EXIT: `rg getFilteredSections src` -> ZERO callers AND zero definition. Non-hollow post-flip proof (tamper
  golden->fail; tamper engine->fail) pasted. Targeted pytest + build/lint from ROOT green. Backend/number-stores/
  STATUS untouched (diff-confirmed).
