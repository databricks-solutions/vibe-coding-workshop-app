# Plan: coach-length (app) — PLAN ONLY, for human sign-off (D-116, D-176)

Base: feature/genie-code-mcp-integration @ 72e9bf0. Commit path (if built): docs/superpowers/plans/2026-10-15-coach-length.md. COACH_SYSTEM has been held unchanged since D-113, so any wording change needs the human's sign-off; nothing is built before it.

## Finding (lead, offline; evidence state/probes/coach-endpoint-r2/ for databricks-claude-sonnet-5-5 @ max_tokens 800, the deployed config)
- `COACH_SYSTEM` STYLE asks for "2–5 sentences" (`services/coaching.py:59`). The 8 sonnet/800 answers: median 153 words (124–191), median 7.5 sentences (5–10), 1–3 paragraphs; only 1 of 8 is within 5 sentences. Live on 4f14555: 122–212 words.
- None hit the 800-token cap; the length is the model's choice, not truncation.
- The visual adds a pointer sentence ("The table below shows …") that COACH_SYSTEM invites (`:63`), counted in the sentences above.

## Options
- **L1 (recommended): make the length rule concrete in COACH_SYSTEM STYLE.** Replace "- 2–5 sentences." with "- One short paragraph: at most 4 sentences and about 80 words. If the CONTEXT has `visual`, the pointer to it counts as one of the 4." Nothing else in COACH_SYSTEM changes. Reversal: restore the line.
- **L2: server-side trim** to the first N sentences after the scrub. Deterministic, but cuts mid-argument and edits model output after the scrub decided on the full text. Not recommended.
- **L3: lower max_tokens.** Truncates mid-sentence (sonnet ≈ 1.85 tokens/word); D-113 set 800 as a ceiling, not a length control. Rejected.

## Evidence before sign-off (probe, read-only, direct endpoint calls, no deploy, no env change)
- Reuse the 8 saved contexts (`state/probes/coach-endpoint/contexts.json`: user_message + forbidden_sources) — no app-code import needed.
- databricks-claude-sonnet-5-5, max_tokens 800, temperature omitted; COACH_SYSTEM current vs L1; 2 runs each (32 calls).
- Report per arm: words (median/max), sentences (median/max), paragraphs, share within the rule, scrub outcome per call using the shipped scrub logic re-implemented from `coaching.py:192-213` (or imported with D-146 stubs), latency.
- Unlabelled side-by-side (current vs L1) for the human's quality judgment; key in a separate file.

## Build (if signed)
- Files: `src/backend/services/coaching.py` (the one STYLE line only), `tests/workshop/test_coaching.py` (pin the new line; the existing COACH_SYSTEM tests must keep every HARD RULE and FOCUS line byte-identical), D2 §3.8 quote of COACH_SYSTEM if it reproduces the prompt verbatim (byte-for-byte update), plan, decision-log.
- Cache: coaching results are cached per (session, section, focus, visual); old-style cached texts age out with the existing TTL. Note it, no change.
- Tampers: X1 restore "2–5 sentences" → the pin test red; X2 alter a HARD RULE line → the byte-identity test red; X3 drop the visual clause → pin red.
- Live check (after the human deploys): the 8 #139 contexts on the deployed app: median ≤ 90 words, ≥ 6 of 8 within 4 sentences, no new scrub fallbacks vs the 4f14555 run.
- Suite ≥ 2087/0 + root 10/0.

## r1 — critic round-1 BLOCK findings folded in (D-177)
- **Wording (no forward reference):** L1 is split. STYLE line `:59` first sentence becomes "- One short paragraph: at most 4 sentences and about 80 words." (rest of the line unchanged). The visual line `:63` gains, at its end, " The pointer counts toward the 4 sentences." Nothing else in COACH_SYSTEM changes. (The evidence probe measured the original single-line wording; the instruction is the same, only its position moves. A re-probe of r1 is offered to the human, not required.)
- **Verbatim quote:** D2 `mcp-interface-contract.md` §12.2 (~:740) quotes COACH_SYSTEM verbatim → joins the file list and is updated byte-for-byte. `test_coaching.py` does not quote it (`test_c2_system_prompt_track_neutral` :241-249 checks substrings); `test_coach_visuals.py:663` (`test_coach_system_visual_sentence`) pins the visual sentence and must be updated for the appended clause.
- **Cache note corrected:** positive coaching results in `_CACHE` have NO TTL (`coaching.py:415`); only `_NEGATIVE` ages out (`COACH_NEGATIVE_TTL_S`, `:417`). `_CACHE` is in-process, so the human's deploy (a restart) clears it; old-length texts cannot survive a deploy. Critic r2 to confirm nothing reads coaching text back from Lakebase into `_CACHE`.
- **New byte-identity pin (so X2 bites):** a test pins COACH_SYSTEM with every line except `:59` and `:63` byte-identical to its 72e9bf0 text (stored in the test as the expected lines, or their sha256), plus the exact new `:59` and `:63` lines. X2 (alter a HARD RULE line) → this test red; X1 (restore "2–5 sentences") → red; X3 (drop the appended visual clause) → this test and `test_coach_system_visual_sentence` red.
- Live check unchanged (deployed app, 8 #139 contexts, median ≤ 90 words, ≥ 6 of 8 within 4 sentences, no new scrub fallbacks).

## r2 — critic round-2 BLOCK findings folded in (D-178; task PARKED per protocol, awaiting human sign-off)
- Confirmed: nothing reads coaching text back from Lakebase into `_CACHE` or the tool result; `build_context` skips `kind == "coaching"` history rows (`coaching.py:313-314`). The deploy-clears-cache note holds.
- D2 `mcp-interface-contract.md:766-770` (inside the fenced COACH_SYSTEM block :741-771) → byte-for-byte update.
- Further docs that state the old length rule, added to the file list:
  - `mcp-interface-contract.md:705` (CoachResult.coaching schema description "2–5 sentences …") → the new rule;
  - `mcp-workshop-pedagogy.md:278` (doctrine "Recommend, don't interrogate. 2–5 sentences, …") → the new rule;
  - the human's D12 spec `mcp-workshop-coach-visuals.md:48` (quotes COACH_SYSTEM "2–5 sentences"), `:271` ("The prose stays 2–5 sentences") and `:273-274` (quotes the visual sentence) → **needs the human's authorisation** (D-121 only covered :49); otherwise these three stay as the spec's record and the PR says so.
- Gatekeeper check: after the build, `grep -rn "2–5 sentences"` over docs/specs and src finds only historical records the PR lists.

## SIGNED (D-182) — build scope
- L1 as revised: :59 → "- One short paragraph: at most 4 sentences and about 80 words." (rest of the line unchanged); :63 gains " The pointer counts toward the 4 sentences." No re-probe.
- D12 spec AUTHORIZED: `mcp-workshop-coach-visuals.md` :48, :271 and :273-274 updated to the new rule; each changed line carries "(was: 2–5 sentences; D-182)" (for :273-274, the quoted visual sentence gains the new clause and the note).
- docs-next-3 FOLDED: `mcp-workshop-pedagogy.md:229-230` (§10 checklist) — the static option coaching is the question-bank coaching, not the vibe_explain_step focus fallback; fix that clause the same way as #154's F3 (fallback = the step's static help with `is_fallback: true`; reason internal, logged only).
- Gatekeeper grep: `grep -rn "2–5 sentences"` over docs/specs and src after the build finds only historical records the PR lists, plus the "(was: …)" notes.
- Base: rebase onto the integration head after coach-scrub-optimize-unblock merges (both edit coaching.py and decision-log.md).

## Questions for plan_critic
1. Which tests and docs quote COACH_SYSTEM verbatim (D2 §3.8, test_coaching.py, D12 spec) and must change byte-for-byte?
2. Is the coaching cache key independent of COACH_SYSTEM (so no stale-key bug), and is the TTL note right?
3. Does anything parse coaching length or sentence count?
4. Are the saved contexts in contexts.json still representative at 72e9bf0 (build_context unchanged since 4f14555)?
