# coaching-scrub-tuning (app) — plan, revision 2 (after critic BLOCK round 1)

Repo: app. Base: origin/feature/genie-code-mcp-integration @ e775185 (#101 coaching merged).
Plan file in PR: docs/superpowers/plans/2026-10-05-coaching-scrub-tuning.md
Scope: B. Lane: L (src/backend/services/coaching.py + tests/workshop/test_coaching.py + docs; NOT trunk; no DDL; no seed). Reseed: no.

## Revision note
Round 1 proposed narrowing the SQL patterns to statement shapes. The critic BLOCKed it, correctly. (a) It would let real statements through that f07e88e catches (`alter table my_table add column c1 int`, `create table my_table using delta`). (b) It contradicts the plan's own no-weakening rule: test_coaching.py:312-316 pins prose-shaped SQL instructions as rejects ("Then run insert into the staging table…", "Next, create table for the gold layer.", "Run update orders set status to closed.", "Run delete from the staging rows…", "Then drop table on the old copy."), and those are indistinguishable by shape from the reviewer's false-positive collocations. The critic also judged the 8-word overlap rule (coaching.py:154-158) the more plausible cause of the live intent-beat reject.
Revision 2 is therefore MEASURE FIRST. It adds observability and the missing test cases, and changes NO pattern. Any narrowing becomes a later task, driven by the live reject-rule data this PR makes visible.

## Why (evidence)
- Probe e775185 (session f925175f): on the use_case_selection intent beat, focus=why, the model returned 1,051 chars and scrub_output rejected them; no rule was recorded (`_scrub_output` coaching.py:150-164 returns a bare None).
- #101 reviewer (f07e88e) nonblocking #2: merge into / alter table / truncate table have no C5 case.

## Changes
1. Reject reasons (no behavior change). Internally `_scrub_output` returns `(text | None, rule | None)` with rule ∈ {"empty", "email", "secret", "code_fence", "sql", "overlap:prompt", "overlap:captured_outputs:<key>", "exception"}. `<key>` is the static produces/consumes field name (coaching.py:169-174), never user content. Checks run in the SAME order as today, so the first matching rule is reported and the accept/reject result is identical for every input. The public `scrub_output(text, *, forbidden_sources) -> str | None` keeps its signature and result. A new `scrub_output_with_reason(...)` returns the pair. coach() uses it, so CoachOutcome.reason for a scrub reject becomes `f"scrub:{rule}"`. One INFO log line per reject: `"coaching scrub rejected section=%s focus=%s rule=%s"`, never including the text. Internally, forbidden sources are carried as (label, text) pairs so the overlap source can be labelled; the public list[str] form still works (labels "source<i>").
2. NO change to _SECRET_RES, _EMAIL_RE, _CODE_FENCE_RE, _SQL_RES, _SQL_IDENT, OVERLAP_WORDS or scrub_input.
3. Tests (test_coaching.py, additions only; no existing case changed or removed):
   - C5 gains reject cases for prose-shaped "merge into", "alter table" and "truncate table" (in the style of :312-316), and for the critic's statement examples `alter table my_table add column c1 int` and `create table my_table using delta`.
   - New C16 reasons: for each rule, a planted input yields the exact `scrub:<rule>` reason on CoachOutcome; for overlap, the label names the source (prompt vs captured_outputs:<key>); a raising scrub yields scrub:exception; the INFO line contains the rule and does NOT contain the rejected text or any substring of ≥ 20 chars of it (caplog); public scrub_output returns exactly what it returned at e775185 for every existing C5 input (a parity loop over the C5 parameter list).
4. docs/superpowers/decision-log.md: append D-26 (below).

## Fence
src/backend/services/coaching.py · tests/workshop/test_coaching.py · docs/superpowers/plans/2026-10-05-coaching-scrub-tuning.md (new) · docs/superpowers/decision-log.md. No other file. Existing test cases are not edited.

## Acceptance
- Every e775185 C5 reject still rejects, and every allowed case still passes (the parity loop).
- The new C5 cases reject; C16 green.
- `git diff origin/feature/genie-code-mcp-integration -- src/backend/services/coaching.py` leaves the regex constants and OVERLAP_WORDS byte-identical.
- Backend suite ≥ 706 + new, 0 failed. 7 tools.

## Green gates
cd <worktree> && DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= $APP/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q → ≥ 706 + new, 0 failed.

## Live checks (for the critic to finalize)
After the code-only deploy: (L1) deployed coaching.py sha256 = git. (L2) Reproduce the probe's case: a fresh session with an unresolved use case (vibe_start_track with an inactive or omitted use case), then vibe_explain_step(focus="why") on the intent beat. Report is_fallback and latency, and if it falls back, the `rule=` from the app log line. This is a MEASUREMENT, not pass/fail on is_fallback; it passes if a fallback carries exactly one rule line, or there is no fallback. (L3) A resolved session (travel/ai_driven_booking), project_setup, focus=why → is_fallback false (no regression). (L4) A resolved session: 4 foci × the first 2 walkable steps; report the fallback count and the rule per fallback. Measurement, no threshold. (L5) 0 Traceback/ERROR; 7 tools; no log line contains coaching text (spot-check: no INFO "rejected" line longer than 200 chars).

## Decision text (append to decision-log.md)
D-26 (2026-10-05) · Coaching scrub after the #101 probe's unexplained intent-beat reject: MEASURE FIRST. Record the reject rule (log + CoachOutcome.reason, never the text) and add the missing C5 cases; change NO pattern. The statement-shape narrowing considered in round 1 was rejected (plan_critic: it lets real SQL through and contradicts pinned rejects); prose-shaped SQL stays rejected, failing closed per D7 §6.1. Narrowing, if the data warrants it, is a later task. · Rule (3) · Evidence: probe e775185 (f925175f); critic-coaching-scrub-tuning round 1; coaching.py:150-164 · Reverse: drop scrub_output_with_reason and the log line; behavior is unchanged either way.
