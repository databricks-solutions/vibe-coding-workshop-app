# Plan: coach-scrub-optimize-unblock (app) — PLAN ONLY, for human sign-off (D-116, D-173)

Base: feature/genie-code-mcp-integration @ 4e1052c. Commit path (if built): docs/superpowers/plans/2026-10-15-coach-scrub-optimize-unblock.md. Any scrub-rule change needs the human's sign-off (D-116); nothing is built before it.
**SIGNED (D-181): S1 with PROMPT_OVERLAP_WORDS = 12; captured-output and unlabelled sources keep 8. Build on 72e9bf0.**

## Finding (lead, offline, read-only; evidence state/probes/coach-endpoint{,-r2}/quality-side-by-side.md + coach-endpoint/contexts.json)
- The cause is NOT the tool-name list. Every rejected `gagent_optimize`/unblock answer (r2: 4/4 across haiku/sonnet × 800/1200; r1: 2 of 3 models) shares ONE run with the step prompt: "on the Genie Space page for the `genie_space_id` recorded in" — 10 words under the scrub's tokeniser (`_WORD_RE = [a-z0-9_']+`, `coaching.py:156`; 8-gram overlap, `OVERLAP_WORDS = 8`, `:76`, checked at `:207-211`).
- That sentence is the step's page precondition, `**Genie Code navigation — page precondition:** you MUST be on the Genie Space page for the `genie_space_id` recorded in <STATE_FILE>` (row 1027 v2, seed `:21300`; also v1 935, `:21259`; only these two rows carry it). "Go to the Genie Space page for your space" is the correct unblock advice, so a good answer almost has to restate it, and the ID token makes the restatement exact.
- Longest verbatim run (words) between each saved answer and its step prompt, across all 56 saved coaching texts: every accepted answer ≤ 7; overlap rejects 8 (3×) or 10 (6×); the `sql` rejects are a different rule. The other overlap rejects: `gagent_optimize`/what_now (8: same sentence, cut short; and "diagnose the root cause and map it to") and `semlayer_metric_view`/what_now (8: "a measure query to prove each measure returns").
- The forbidden "prompt" source is the full step prompt `help["prompt"]` (`coaching.py:517`); the model is already told "REFERENCE ONLY — do not restate or paraphrase" (`:287`).

## Options
- **S1 (recommended): a longer run for the step-prompt source only.** Overlap with the `prompt` source rejects at ≥ 12 words; captured outputs (`captured_outputs:<key>`, the learner's own data) keep 8. Data: all 9 saved overlap rejects pass at 12 (max 10); no accepted answer comes near (max 7). Still blocks reciting the prompt (any 12-word verbatim stretch). Change: one new constant (e.g. `PROMPT_OVERLAP_WORDS = 12`) and a per-label threshold in `_scrub_output` (`:207-211`); `scrub_output`'s docstring (`:234`) updated; `OVERLAP_WORDS` unchanged for every other source. Reversal: set the constant to 8.
- **S2: ignore identifier tokens in the overlap.** Drop tokens containing `_` (e.g. `genie_space_id`) before building n-grams. Breaks this run (7 words) but changes the rule for every source including captured outputs, and identifiers are often what a leak would carry. Not recommended.
- **S3: phrase allowlist.** Exempt n-grams fully inside named "precondition" sentences of the step prompt. Narrowest effect, but needs a marker in seed text (seed change + genie gate) or a hard-coded phrase list that drifts. Not recommended.
- **N1 (no scrub change): COACH_SYSTEM wording** asking the model to name page preconditions in its own words. Changes COACH_SYSTEM (unchanged since D-113 — needs sign-off too); the model already ignores "do not restate", and the exact ID token makes a paraphrase unlikely. Weak.
- **N2: reword the seed sentence.** Any wording gets echoed; seed change through the genie gate; not a fix.

## S1 build (if signed)
- Files: `src/backend/services/coaching.py` (constant + per-label threshold + docstring only; COACH_SYSTEM, every other scrub rule, the input scrub and the cache untouched), `tests/workshop/test_coaching.py`, docs (D2 coaching contract wording if it states 8 words for the prompt; D7 security scrub description), plan, decision-log.
- Tests:
  - prompt source: 11 shared words pass, 12 reject; captured-output source: 7 pass, 8 reject (existing `:343` pin kept for captured outputs, extended for prompt);
  - regression fixtures: the four saved r2 `gagent_optimize`/unblock answers and the `semlayer_metric_view`/what_now answer pass the scrub against the saved step prompt (stored as test data, tag names only, no learner data);
  - a 12-word verbatim slice of the gagent_optimize prompt still rejects as `overlap:prompt`.
- Tampers: X1 set the prompt threshold back to 8 → regression fixtures red; X2 apply 12 to captured outputs too → captured 8-word test red; X3 drop the prompt-source check → 12-word slice test red.
- Live check (after the human deploys): `gagent_optimize`/unblock on sonnet-5-5 returns coached text (no `scrub:overlap:prompt`) in ≥ 3 of 4 fresh sessions; the coaching timings line shows the outcome; no other focus regresses on the 8 #139 contexts.
- Suite ≥ 2087/0 + root 10/0. No seed, DDL, manifest, MCP tool or web change.

## Questions for plan_critic
1. Does any other caller use `scrub_output` / `_ngrams` / `OVERLAP_WORDS` (MCP, routes, D7 tests) whose behaviour must not change?
2. Is the per-label split safe for unlabelled sources (`source<i>`, `_labelled` `:184-190`)? They must keep 8.
3. Do D2/D7/D5 state the 8-word rule as a contract that needs amending?
4. Can the saved r2 answers be used as fixtures without carrying any learner data (they were generated on probe sessions)?
