# p4-llm-steps-shorter-output: shorter output contracts for iterate_enhance, skill_define_strategy, skill_create_skillmd (D-72, option a)

repo=app · base origin/feature/genie-code-mcp-integration after genie-forks-held-v2 (952a487) is live-checked · plan path in PR: docs/superpowers/plans/2026-10-08-p4-llm-steps-shorter-output.md
Trunk file touched: db/lakebase/dml_seed/02_seed_section_input_prompts.sql (3 additive rows; charter exception: prompt rows live only in the seed; reason D-72; reversal: delete the 3 rows). No src/ change: STEP_PROMPT_BUDGET_S stays 90.0 (mcp_server.py:798) and LLM_MAX_OUTPUT_TOKENS stays 8000 (routes.py:1471), by the human's ruling.

## Evidence (lead, read-only @952a487)
- P4.4 probe (state/probes/p4-llm-steps.md, @b260c64): all 4 non-bypass tags are served from `__default__` rows (no genie-code fork): prd_generation 1 generates 13/13 in 23.9-37.0 s (median 29.8); iterate_enhance 14 falls back on all 14 tracks (generation 107.7-133.6 s, then truncates); skill_define_strategy 131 and skill_create_skillmd 132 (skills-accelerator only) fall back on the budget (truncated; 132 finished 12 s late at 25,950 chars).
- The truncation means the output exceeds LLM_MAX_OUTPUT_TOKENS = 8000; at the observed rate, an ~8000-token output takes ~110-130 s. A budget raise alone cannot help (D-62).
- mcp_server.py:836-870 `_generate_step_prompt` generates "via the app FMAPI, matching the web path", with the same 8000-token ceiling (routes.py:1474), so the IDE/web path is expected to hit the same truncation (inference; the critic is asked to confirm or refute from code).
- Seed rows: 14 iterate_enhance (seed :6504, 5832 B), 131 skill_define_strategy (:9891, 2275 B), 132 skill_create_skillmd (:9944, 2492 B); all `__default__`, version 1.

## Design choice (protocol 3, most reversible; recorded as D-77)
Additive `version = 2` `__default__` rows (the D-57 mechanism: the resolvers order active rows by version DESC per (section_tag, coding_assistant); v1 untouched; reversal = delete v2), NOT new genie-code forks:
- a genie-code fork would add a second served row per tag whose counted audit lines duplicate v1's, i.e. audit growth under the served-rows gate; a v2 default row REPLACES v1 in the served set, so its counts equal v1's;
- the shorter contract is not client mechanics (FORK rules are about client mechanics), and the IDE web path shares the 8000-token ceiling.

## Changes
S1 Seed 02: 3 new `__default__` rows, version 2, is_active true, same section_tag, input_id 1034 (iterate_enhance), 1035 (skill_define_strategy), 1036 (skill_create_skillmd), each placed right after its v1. Each v2 = its v1 byte-for-byte EXCEPT one added fixed "Output length contract" paragraph, appended at the end of the generation instruction the LLM receives (the implementer identifies the column: the one `_generate_step_prompt` sends as the instruction/input; same column in all 3):
  "## Output length contract\nKeep the prompt you write under {N} words. Prefer a short ordered checklist over prose; name each file, command or check once; do not restate this specification, the PRD or earlier outputs; omit examples unless one is essential. If the full scope does not fit, cover the highest-value items and end with one line listing what was left out."
  with N = 900 for iterate_enhance and skill_define_strategy, N = 1200 for skill_create_skillmd (it must carry a SKILL.md skeleton). No other field changes (gates, captured keys, how_to_apply, bypass_llm=false, {tokens}).
S2 Tests: a new tests/workshop/test_llm_output_contract.py (or the existing seed-row test module, whichever already holds version tests): (C1) for each of the 3 tags the served `__default__` row is the v2 id; (C2) v2 == v1 + exactly the contract paragraph (byte-level, with the per-tag N); (C3) bypass_llm is false on all 3 v2 rows; (C4) no other row changed.
S3 test_seed_new_rows.py: only what 3 rows force (F02 +3, ledger +1034-1036, sequence 1034 → 1037).
S4 decision-log.md: append D-74, D-75, D-76, D-77 verbatim from FORGE/state/lead/decisions.md (only IDs absent from the APP log).

## PASS BAR (fixed BEFORE any measurement; human D-72)
Measured live by the prober after deploy, genie-code client via MCP, fresh sessions, no cache hits (each run a distinct session/use case so the input hash differs):
- iterate_enhance: 10 runs across ≥ 8 distinct tracks;
- skill_define_strategy: 10 runs and skill_create_skillmd: 10 runs on skills-accelerator (the only track that serves them), 10 distinct use cases;
- per run record: wall time of the vibe_get_step call, generated vs fallback (and cause), output chars, and whether a `max_tokens` truncation warning was logged.
PASS iff, for EACH of the 3 tags: 10/10 runs generated (not fallback), 0 truncation warnings, and every run ≤ 75 s (≥ 15 s margin under the 90 s budget). prd_generation must stay within its P4.4 envelope (spot-check 3 runs, all generated, ≤ 75 s) as a regression guard.
MISS (any tag fails any clause) → release ROLLBACK of the merge, park the task, and propose option (c) (accept the static fallback for the missing tags) to the human, NOT (b), per D-72. No in-pipeline retuning of N after a miss without a new plan + critic round.

## STOP rules
- genie_gate_diff (forge 15ec49d) exit 0 with no audit key growth; the superseded list must include 14, 131, 132. If any key grows (e.g. the contract paragraph matches a counted pattern), STOP and report; do not reword other text.
- If the generation instruction for the 3 tags is not a single seed column (e.g. assembled in code), STOP and report: this plan changes no src/.

## Green gates
pytest tests/workshop tests/api ≥ floor 1652; genie_gate_diff as above.

## Tampers (anchor `(<id>, '<tag>',`: default rows omit the coding_assistant column from their INSERT (critic r1, seed :6502), so copy v1's INSERT shape exactly, incl. its column list; restore each)
X1 in 1034 delete the contract paragraph → C2 red.
X2 in 1035 change N from 900 to 9000 → C2 red.
X3 set 1036's version to 1 → seed-load / unique-index test red.
X4 in 1034 change one word outside the contract → C2 red.
X5 set 1035 bypass_llm true → C3 red.

## Release
MERGE reseed=yes (expect `3 inserted / 0 warnings`, `sequence raised 1034 -> 1037`).

## Live checks
L0 none needed beyond P4.4 (state/probes/p4-llm-steps.md is the before-baseline).
L1 tables log as above; ro DB: 1034-1036 present, version 2, active; 14/131/132 unchanged and active; rows 170 → 173.
L2 the PASS BAR measurement above (30 runs + 3 prd spot-checks), with per-run numbers in the report.
L3 one full skills-accelerator walk and one app-only walk to Done: 0 unexpected errors, 0 empty prompts; every non-LLM step byte-equal to the 952a487 probe.
L4 7 tools, /health 200, logs clean except budget/truncation lines, which L2 counts.

## Reverse
Delete rows 1034-1036 (v1 serves again).
