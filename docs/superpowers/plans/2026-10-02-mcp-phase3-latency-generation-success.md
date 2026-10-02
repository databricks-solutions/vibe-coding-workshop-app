# Latency Generation-Success Plan — AMENDED per human ruling 2026-10-02

Status: APPROVED WITH AMENDMENTS — dispatched on this document.
Base: e7be8d2 (PR #77 merged). Chartered files: routes.py = ONE new function (the collector),
no existing function changes; mcp_server.py = MCP call-site switch + negative cache.
Everything else zero-diff. This document is committed in-PR.

## 1. Root cause (accepted, human ruling 2026-10-02)
SDK 60s per-attempt socket timeout; 300s overall retry deadline (`_base_client` / `retries`,
databricks-sdk 0.139.0 as resolved — requirements.txt floats >=0.81.0, ledgered). A silent
>60s non-streaming attempt dies on that attempt. 246.6s = 3x60s timeouts + backoff + ~59s
success on a later attempt (INFERENCE — attempt counts need app logs). App chain:
TimeoutError -> HTTPException(500) -> fallback_due_to_error -> None -> template.

## 2. New live evidence (human stream probe, session 191c48c8)
POST /api/generate-prompt-stream for iterate_enhance: first chunk 3.2s, total 121.5s,
29,301 chars (~7.3k tokens), ended with the max_tokens WARNING — truncated at the 8000-token
limit. Streaming finishes, but this step's output is truncated AND takes longer than the 90s
budget. The plan as first drafted would late-cache and serve that truncated prompt.

## 3. Fix (i) AMENDED — the collector drains the WEB GENERATOR ITSELF
ONE new function in routes.py draining:
    stream_llm_response(industry, use_case, section_tag, previous_outputs, session_id,
                        coding_assistant_override=DEFAULT_CODING_ASSISTANT)   # "genie-code"
(routes.py:2253; override param at :2259). mcp_server.py already imports DEFAULT_CODING_ASSISTANT (:49).
- Do NOT wrap _stream_with_retry / rebuild messages — that duplicates the system prompt,
  request text, brand appendix and bypass handling, and will drift.
- NEVER call clear_lakebase_cache from the collector (call sites :1952/:1966/:2351/:2626
  belong to the web path; the generator's internal behavior stays byte-identical).
- Byte-identical, untouched: stream_llm_response, _stream_with_retry,
  POST /generate-prompt(-stream), and every #77 to_thread site.
- (iii) REJECTED by the human: no max_tokens param change anywhere. The collector inherits
  the web's _max_tokens_for_section (routes.py:2079, used at :2318/:2329). T-c dropped.

### Success / failure definition (the truncation guard)
SUCCESS = a "done" event AND non-empty content AND NO max_tokens warning AND NO error event
AND a model that is not "bypass_llm".
ANYTHING ELSE = FAILURE: return None (template fallback), NEVER cache it as llm_generated,
and write the negative entry. A truncated prompt must never be served or cached.

## 4. Negative cache
- TTL 300s (approved). Checked under _STEP_PROMPT_LOCK BEFORE electing or joining.
- Written on TRUE FAILURE only (exception, error event, truncation, empty content) —
  NEVER on 90s budget abandonment (that would poison late-success caching).
- TTL expiry -> normal elect. Retry-after-failure (PR #77 M1 pin) re-verified across the TTL.

## 5. No module flag
No env var / config key. At most a plain module constant. Never invent config keys.

## 6. Plan-text corrections (supersede the first draft)
- httpx timeout=120 is a per-read (between-chunks) timeout, NOT a per-attempt ceiling; a
  flowing stream has no total bound (measured 121.5s at 8000 tokens).
- The 90s budget bounds the READER; the daemon thread is bounded by stream completion
  (or 3 x 120s stalls + backoff).
- #77 correction restated: SDK timeouts only bound stalled/failed requests; the budget
  bounds wall-clock. The "1.5x so a 60-75s attempt lands" claim is true only for
  streaming/longer-timeout paths, not silent non-streaming attempts.

## 7. (B) acceptance step — CONFIRMED WITH LIVE EVIDENCE (human ruling 2026-10-02)
(B) = **prd_generation** — the first REAL LLM step in the default outline, i.e. the
first step whose prompt actually drains through the collector.
project_setup is NOT a valid (B): it is a VIRTUAL step. _step_payload special-cases
section_tag == "project_setup" and returns _project_setup_content(email) (mcp_server.py
~:994-998) — a fixed clone→publish→validate procedure that NEVER reaches
_generate_step_prompt / the collector, so it exercises none of this fix. (It is also
manifest step 1, not step 2; the earlier "step 2 / Foundation family" framing was wrong
on both counts.)
Live measurement (human stream probe, session 191c48c8) confirms prd_generation renders
fast and UNTRUNCATED: web stream for prd_generation (genie-code) — first chunk 3.0s,
total 22.3s, 6,398 chars, ended on "done" with NO max_tokens truncation warning. This is
the confirmed (B) step for the acceptance smoke (no re-probe needed).

## 8. Tests (offline; fake generator; no real FMAPI; patch the budget small)
- Collector concatenates chunks exactly (T-d: drop chunks -> fail).
- Error event -> None.
- max_tokens warning -> None + negative entry + NOT cached (T-e: accept truncated -> fail).
- bypass model -> None.
- Collector passes coding_assistant_override="genie-code" (tamper: drop it -> fail).
- Negative cache honored inside the TTL (T-a: drop the TTL check -> fail) and expires to a
  normal retry.
- Never written on budget abandonment (T-b: negative-on-abandon -> fail).
- M1 retry-after-failure pin still holds across the TTL; #77's 11 budget/single-flight/
  off-loop tests and fmapi stay green; full tests/workshop + tests/api; absence pin;
  JSONB-vs-'' sweep 0; npm build (frontend untouched).

## 9. Fences
routes.py: ONE new function only — no existing function changes. mcp_server.py: call-site
switch + negative cache. state.py / manifest* / frontend / DDL zero-diff. #77 sites
byte-identical. Explicit staging; never .cursor/ or .isaac/; never git add -A.
Charter exceptions stated in the PR body. STOP-and-report over partial/red PRs.

## 10. Live acceptance (human, after merge + deploy)
(A) iterate_enhance, uncached: first read <= 90s + eps with the template; once the
    generation ends (truncated -> failure), a repeat read returns the template in < 2s
    (negative cache). Web GET / stays < 2s throughout.
(B) prd_generation (the first real LLM step; §7): web stream finishes UNTRUNCATED inside
    90s (measured 22.3s / 6,398 chars) -> the MCP read returns the LLM prompt.
(C) Logs: budget WARNING only on timeouts; the failure log names truncation distinctly;
    no new error classes.

Reseed: none (no DDL; prompt bodies are Lakebase content — the iterate_enhance truncation
itself is a content/prompt-body issue for the content owner; any fix there means a reseed,
a human hard stop. Ledgered.).
