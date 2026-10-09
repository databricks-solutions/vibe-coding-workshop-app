# Phase 2A gate report (2026-10-05)

Base: `feature/genie-code-mcp-integration` at 7e2b537 (#105). Phase 2A ships coaching as a consolidation into `vibe_explain_step` (D-22). It landed across #98, #100, #101, #102, #103, #104 and #105 (merges a175f3a, c63d6c8, e775185, 54e255e, 4b57581, 429eb46, 7e2b537). #99 (496588b, x3-pattern-gaps) merged in the same range but is Phase 3 test follow-up, not 2A. The MCP tool count stays 7. The backend suite re-run at 7e2b537 is 764 passed, 0 failed (`pytest tests/workshop tests/api -q`: `764 passed, 2 warnings in 15.77s`).

Line numbers below are at 7e2b537. Probe numbers come from the forge probes, named by the merge SHA each one probed, and are quoted as reported.

## 1. Summary

| PR | Merge | Title |
|---|---|---|
| #98 | a175f3a | Extract FMAPI seam to services/llm.py (D4 §1.2, D-20) |
| #100 | c63d6c8 | llm-extract follow-ups: SDK-flag patch target, E6 fail-not-skip, E7 guard (D-21) |
| #101 | e775185 | coaching: optional focus on vibe_explain_step (D-22..D-25) |
| #102 | 54e255e | coaching: record the scrub reject rule (observability only, D-26) |
| #103 | 4b57581 | llm: stop logging model output in call_databricks_serving_endpoint (D-27) |
| #104 | 429eb46 | routes/llm: log error class/status/length, not error or body text (D-28) |
| #105 | 7e2b537 | coaching: per-phase timing log and env knob overrides, no default changed (D-29) |

Verdict: every RUN.md §B requirement has shipped code, a pinning test, and (where it can be observed live) a probe number. One requirement carries a caveat (every track through MCP, row 12). Section 5 lists what is not proven, and section 6 lists three questions for a human.

## 2. Requirement matrix (RUN.md §B)

Tests are in `tests/workshop/test_coaching.py` (C), `tests/workshop/test_llm_service.py` (E) and `tests/workshop/test_llm_log_redaction.py` (R) unless named otherwise. All 98 tests in those three files are collected at 7e2b537.

| # | Requirement | Shipped where | Pinned by | Live evidence | Verdict |
|---|---|---|---|---|---|
| 1 | Optional `focus` (`what_now`/`why`/`unblock`/`review`) on `vibe_explain_step`, LLM-enriched over the step context, captured_outputs and prior interactions | #101. `ExplainResult.focus` mcp_server.py:221; `vibe_explain_step` mcp_server.py:1423, focus check :1429, `coaching.coach(...)` :1486; `FOCI` coaching.py:62; `build_context` coaching.py:244 | `test_c1_grounding` (:190), `test_c11_no_focus_parity` (:491), `test_invalid_focus_is_invalid_parameter` (:517) | probe e775185 L3: `why`, 909 chars, `grounded_on` keys | **PASS** |
| 2 | Fails open to the static StepHelpResult (`is_fallback: true`), never `isError` | #101. mcp_server.py:1484–1502 keeps the static fields and sets only coaching/focus/grounded_on/is_fallback; `CoachOutcome.is_fallback` defaults True (coaching.py:434); `coach()` catches and returns `reason="error"` (coaching.py:510) | `test_c3_fail_open` (:240), `test_c4_kill_switch` (:279), `test_c5_scrub*` (:323–:362) | probe 54e255e: 5/10 fallbacks, 0 isError | **PASS** |
| 3 | The `services/llm.py` extract (D4 §1.2) | #98 / D-20, follow-ups #100 / D-21 | `test_e1_routes_reexports_are_the_same_objects` … `test_e7_no_test_patches_a_moved_name_on_routes` (test_llm_service.py:76–:286) | n/a (a move, no behavior change) | **PASS** |
| 4 | `_COACH_SYSTEM` (D2 §12) | #101. `COACH_SYSTEM` coaching.py:33, track-neutral ("the track named in the CONTEXT") | `test_c2_system_prompt_track_neutral` (:229) | n/a | **PASS** |
| 5 | Leakage firewall (D7 §6.1): input scrub; output scrub failing closed (D-25, D-25a); reject-rule observability (D-26); no model or error text in logs (D-27, D-28) | `scrub_input` coaching.py:154; `scrub_output_with_reason` :206, `scrub_output` :222; reject log line with the rule, never the text, coaching.py:392–394 (#102); llm.py model-output logging removed (#103); error logs keep class/status/length only (#104, e.g. llm.py:618 traceback at DEBUG) | `test_c5_scrub` (19 parametrized cases incl. `sql_truncate_table`, `sql_alter_table_statement`, `sql_create_table_statement`), `test_c5_scrub_input_drops_new_secret_lines`, `test_c16_reasons` (7 cases: email, secret, code_fence, sql, overlap_prompt, overlap_captured, order), `test_c16_reject_log_has_rule_not_text` (:720); `test_r1_*` … `test_r8_*` (test_llm_log_redaction.py:143–:787) | probe 54e255e L2: `rule=overlap:prompt`; probe 4b57581: 0 content lines after the deploy; probe 429eb46: 0 preview/traceback/body lines | **PASS** (error branches: see §5) |
| 6 | Additive `db/lakebase/ddl/13_mcp_coaching.sql` (D6 §7a) | #101. `ADD COLUMN IF NOT EXISTS is_fallback BOOLEAN DEFAULT FALSE` and `focus VARCHAR(16)` (13_mcp_coaching.sql:11–12) | `test_c15_ddl` (:619), `test_c14_lakebase` (:583) | probe e775185 L1: 2 columns | **PASS** |
| 7 | Kill switch env, default on | `VIBE_COACHING_ENABLED`, `coaching_enabled()` coaching.py:78–81 (only `0/false/off/no` disable), checked per call at coaching.py:479–480 | `test_c4_kill_switch` (:279), which also pins D-25a (no session_interactions row when disabled) | not exercised live | **PASS** (tests) |
| 8 | D8 §4a tests | `test_coaching.py` C1–C19 | `test_c1_grounding`, `test_c2_system_prompt_track_neutral`, `test_c3_fail_open`, `test_c4_kill_switch`, `test_c5_scrub` (+ `_allows_select_prose`, `_input_drops_new_secret_lines`, `_raising_is_fallback`, `_clean_passes_through`), `test_c6_read_only`, `test_c7_provenance`, `test_c8_cache_and_single_flight`, `test_c9_retry_after_failure`, `test_c10_late_success`, `test_c11_no_focus_parity`, `test_invalid_focus_is_invalid_parameter`, `test_c12_tool_count_and_annotations`, `test_c13_every_track`, `test_c14_lakebase`, `test_c15_ddl`, `test_c16_reasons` (+ `_direct_and_exception`, `_reject_log_has_rule_not_text`, `_public_parity`), `test_c17_defaults_unchanged`, `test_c18_env_overrides`, `test_c19_timing_line` | n/a | **PASS** |
| 9 | Knobs per D9 §9 q4: app-default endpoint, ~400 max tokens, ~8 s, cached per (session_id, sectionTag, focus) | `COACH_MAX_TOKENS = 400` coaching.py:65, `COACH_BUDGET_S = 8.0` :66, unchanged by #105 (D-29); env overrides read at :363, :372, :271–272; cache key `tuple[str, str, str]` in `_single_flight` (coaching.py:340–341); timing line coaching.py:512–523 | `test_c17_defaults_unchanged` (:808), `test_c18_env_overrides` (:825), `test_c19_timing_line` (:891), `test_c8_cache_and_single_flight` (:415) | probe 7e2b537: `cache=hit` repeats in 0.09–0.12 s | **PASS** |
| 10 | Tool count stays 7 | No tool added (D-22) | `test_c12_tool_count_and_annotations` (:524, `assert len(tools) == 7`) | every probe: 7 tools | **PASS** |
| 11 | Reuse the off-loop / budget / single-flight / negative-cache machinery; retry after failure tested | D-24: `_run_async_blocking` (mcp_server.py:1673) passed in as `run_blocking` (mcp_server.py:1493); single-flight / negative-cache helper `_single_flight` in coaching.py:340, `COACH_NEGATIVE_TTL_S` :67 | `test_c8_cache_and_single_flight` (:415), `test_c9_retry_after_failure` (:446), `test_c10_late_success` (:469) | probe 7e2b537 late success: the prd what_now repeat returned 1277 cached chars | **PASS** |
| 12 | Coaching works on every track | `coach(track=...)` puts the track into the context | `test_c13_every_track` (:538, `_coach_direct(focus="why", track="app-only")`) | not exercised live off genie-accelerator | **PASS with caveat**: `vibe_explain_step` passes `track=DEFAULT_TRACK` (mcp_server.py:1492; `DEFAULT_TRACK = "genie-accelerator"` mcp_server.py:46) because the session record isn't available there, and the MCP walk itself is pinned to that track until P4.1 |

## 3. Latency evidence

Probe 7e2b537, first calls, medians as reported:

| Step | db (ms) | build (ms) | model (ms) | total (ms) | client | fallbacks |
|---|---|---|---|---|---|---|
| project_setup | 6 | 0 | 6721.5 | 6728.5 | 6.815 s | 0/4 |
| prd_generation | 6 | 0 | 8000 | 8008 | 8.126 s | 4/4 (budget) |

Repeats are cache hits (0.09–0.12 s, row 9). On prd_generation the model call is cut at the 8 s budget, the learner gets the static help, and the late answer is cached for the next call (row 11).

## 4. Decisions taken during 2A

All eleven are present in `docs/superpowers/decision-log.md` (grep at 7e2b537). No gaps.

- D-20 (#98, decision-log.md:24): the services/llm.py extract moves the 8 names in the closure verbatim; routes.py re-exports them; tests patch helpers on `services.llm`.
- D-21 (#100, :25): E6's base-object guard skips only when git is absent, otherwise fails with "fetch full history".
- D-22 (#101, :26): coaching ships as an optional `focus` on `vibe_explain_step` (tool count 7), not a `vibe_coach` tool.
- D-23 (#101, :27): with no focus, `vibe_explain_step` returns the static help unchanged (no model call).
- D-24 (#101, :28): coaching reuses `_run_async_blocking` plus a single-flight / negative-cache helper in coaching.py; the step-prompt path isn't migrated.
- D-25 (#101, :29): the leakage scrub rejects (fails closed) on ≥ 8-word overlap, secret-like tokens, emails, code fences or SQL statements; inputs are capped and scrubbed.
- D-25a (#101 review addendum, :30): the kill switch writes no session_interactions row; Bearer, PEM header, AKIA and case-insensitive SQL patterns added with C5 cases.
- D-26 (#102, :31): measure first: record the reject rule (log + `CoachOutcome.reason`, never the text); no pattern changed.
- D-27 (#103, :32): llm.py logs model responses by type/length only; E6 allows exactly the listed edits.
- D-28 (#104, :33): model-call error logs keep operation, endpoint, attempt, class, status, error_code and length; tracebacks at DEBUG only.
- D-29 (#105, :34): per-phase timing logs and env overrides, no default changed; raising the budget is a human decision (Q1).

Two citation corrections at 7e2b537. D-28 says "llm.py:629's HTTPException detail is unchanged". At 7e2b537 the details that carry the endpoint error text are llm.py:626–627 (403, `... Error: {error_str}`) and llm.py:638 (500, `Error calling serving endpoint '{endpoint}': {error_str}`). Line 629 is the `elif "not found"` branch, and its detail (:633) carries no error text. `track=DEFAULT_TRACK` is at mcp_server.py:1492. Line 1493 is `run_blocking=_run_async_blocking`.

## 5. What is NOT proven

- The redacted error branches (D-28) were not exercised live: every live model call returned 200. They are covered by tests only (`test_r5_*`, `test_r6_*`, `test_r7_*`).
- Coaching on tracks other than genie-accelerator through MCP. `test_c13_every_track` drives `coach()` directly. The MCP path passes `DEFAULT_TRACK` (mcp_server.py:1492) until P4.1.
- The step-prompt single-flight path (`_STEP_PROMPT_INFLIGHT`, mcp_server.py:744, :824–:885) wasn't migrated to the shared helper (D-24 follow-up).
- Only 2 steps × 4 foci were measured live (project_setup and prd_generation, section 3).

## 6. Open questions for the HUMAN

This report takes none of these decisions. Each option below can be reversed.

- **Q1: Coaching budget.** Evidence: the model call is 99.9% of coaching latency. prd_generation reaches the ≈8 s D9 §9 q4 budget on every first call (section 3: model 8000 ms, 4/4 budget fallbacks). It degrades to the static help, and the late answer is cached for the next call (row 11). The budget is human-signed (D-29). Options:
  (a) keep 8 s (current);
  (b) raise `VIBE_COACH_BUDGET_S`, an env override read at coaching.py:363 that needs no code change and is reversed by unsetting it;
  (c) accept first-call fallback on long steps.
- **Q2: Endpoint error body in the client response.** Evidence: `call_databricks_serving_endpoint` returns the serving endpoint's error text to the client in `HTTPException.detail` (llm.py:626–627 for 403, llm.py:638 for 500; D-28 cites this as ":629"). This is a client response, not a log, so it falls outside the scope of D-27 and D-28. The safe-shape list in `test_r4_hardened_scan_allows_the_safe_shapes` explicitly allows it. Options:
  (a) keep it (operators see the cause in the UI);
  (b) redact `detail` to class/status (a small llm.py change; E6 and R8 would need the edit listed).
- **Q3: Intent-beat coaching.** Evidence: the firewall rejected the coaching on the use_case_selection beat, and probe 54e255e L2 recorded the rule as `overlap:prompt`: the model restated the prompt, which `COACH_SYSTEM` forbids (coaching.py:42–44). Options:
  (a) accept the static fallback on that beat (current, fails closed per D7 §6.1);
  (b) tune `COACH_SYSTEM` for the intent beat, a prompt-text change that is reverted by restoring the string. Any tuning should keep the scrub patterns unchanged (D-26).

## 7. Follow-ups still queued

From the forge queue, by slug:

- step-prompt-singleflight-migrate (D-24: move the step-prompt path onto the shared helper)
- usecase-beat-current-mismatch (probe e775185: start_track vs explain disagree on the current step for an inactive pair)
- usecase-beat-post-check (the beat's post comprehension check never surfaces on the canonical path)
- usecase-gate-sticky (the App's step-1 gate isn't cleared when intent is cleared)
- header-count-projection (Phase 3 F5: the header count reads local `completedSteps.size`)
- x3-fence-nits / test-fence-nits: the cosmetic test gaps from the #102, #104 and #105 reviews. The queue records these under `x3-fence-nits`. No `test-fence-nits` row exists yet.
