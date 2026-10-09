# T5 — Blocked-secondary-surfaces guard (plan)

Base: `bfe95a0` (PR #79 merged). ONE PR. Charter exceptions ALREADY GRANTED for
`engine.py` and `mcp_server.py` — stated in the PR body (D3 §5.2/§5.3 + §12; #74
and PR B precedents). Nothing in this plan touches `routes.py`, `state.py`,
`manifest*`, frontend, or DDL.

## Defect (cursor PR-B finding, human-confirmed; unreachable on authored data
post-PR-A, but a real crash/wrong-behavior class if the gate pin ever regresses)

PR B made `engine.next_step` return a third variant, `engine.Blocked`. Only
`vibe_next_step` handles it. Every other consumer of `next_step` mis-handles it:

| Site (live @ bfe95a0) | Today on `Blocked` | Effect |
|---|---|---|
| `vibe_get_step(None)` (`mcp_server.py:1211-1215`) | only checks `Done`; `Blocked` falls through to `_step_payload(step=Blocked)` | wrong payload / crash (`_step_payload` expects a `manifest.Step`) |
| `vibe_explain_step(None)` (`:1326-1330`) | same fall-through | same |
| `vibe_complete_step` next render (`:1657-1661`) | `isinstance(Done)` else `_step_payload(next_step)` | `Blocked` → wrong payload; `CompleteStepResult.next` union (`:196`) doesn't allow it |
| `vibe_submit_answer` answerable set (`:1709-1711`) | `answerable = {… else current.sectionTag}` | a **locked** step's interactions become answerable — the agent can answer a step it cannot work |
| `engine.CompleteResult.next_step` (`engine.py:56`) | annotation `Step \| Done \| None` | stale — `next_step()` (`engine.py:160`) returns `Step \| Done \| Blocked`, and `complete_step` populates it (`:270`/`:287`) |

## Changes

1. `vibe_get_step(None)`: add an `isinstance(current, engine.Blocked)` branch
   (beside the `Done` branch) → `_error_result("UNKNOWN_STEP", f"The workshop
   cannot advance because '{current.title}' requires '{current.requiresGate}' —
   workshop configuration problem.", sectionTag=current.sectionTag)`.
   Rationale: this surface's return contract (`ExplainabilityPayload`) is NOT
   widened (minimal scope); post-PR-A a blocked state is a config defect, and
   `vibe_next_step` is the surface that reports it.
2. `vibe_explain_step(None)`: identical guard + identical error.
3. `vibe_complete_step` next render: add the `Blocked` branch →
   `next_payload = _blocked_result(DEFAULT_TRACK, state, next_step)` (reuses the
   existing helper — deterministic message + the defect-signal WARNING, no PII);
   widen `CompleteStepResult.next` (`:196`) to
   `ExplainabilityPayload | DoneResult | BlockedResult`.
4. `vibe_submit_answer`: `Blocked` → the locked step's interactions are NOT
   answerable — `answerable` excludes it (submission returns the existing
   `UNKNOWN_INTERACTION`). The intent-beat eligibility is unchanged.
5. `engine.py:56`: widen to `next_step: Step | Done | Blocked | None = None`.

No new error codes; no tool-contract change beyond the `CompleteStepResult.next`
union widening; tool count stays 7; `test_mcp_contract.py` unchanged unless the
widened union requires it (implementer verifies; report either way).

## Tests (offline; reuse PR B's dangling-gate monkeypatch fixture as the
forced-blocked row). Each site gets a fail-before/pass-after test AND its own
tamper (revert that site's guard → that test fails), named in the PR body:

- `vibe_get_step(None)` on the blocked row → error names `requiresGate`
  (fail-before: `_step_payload` receives `Blocked`);
  tamper: drop the branch.
- `vibe_explain_step(None)` → same shape.
- `vibe_complete_step` on the blocked row → `next` is a valid `BlockedResult`
  payload (extra="forbid" validated); tamper: drop the branch.
- `vibe_submit_answer` on the blocked row → `UNKNOWN_INTERACTION`, and nothing
  is recorded; tamper: drop the guard (the locked step becomes answerable).
- Engine annotation: typing-only; no runtime test (stated in the PR body).

Plus: full `tests/workshop` + `tests/api` (expect ~525 + new), FE node tests,
`npm run build`, absence pin, JSONB-vs-`''` sweep 0 — all pasted.

## Fences

`mcp_server.py` + `engine.py` (annotation line) + tests ONLY.
`state.py` / `manifest*` / frontend / `routes.py` / DDL: zero-diff.
Explicit staging; never `.cursor/` or `.isaac/`; never `git add -A`.
No deploy/reseed agent-side. STOP-and-report rather than a partial/red PR.

## Post-merge

Human: merge → deploy `--code-only` (no reseed) → smoke optional (unreachable
on authored data; the offline tests carry the proof). Then the post-soak nits
PR (LeaderboardPage ESLint; pin-test docstring `__default__`; stale "1.5×"
rationale at `mcp_server.py:662`; the two #79 nits — separate try per shutdown
+ DEBUG-level cleanup logging; the S1 pin — alive-async-generator-must-aclose).

## Lead addendum (2026-10-03, autonomous run — supersedes conflicting lines above)

A1. Charter exception (trunk files): `src/backend/mcp_server.py` (guards at the four sites + the `CompleteStepResult.next` union) and `src/backend/workshop/engine.py` (annotations only). Reason: the `Blocked` variant from PR #76 reaches these consumers unhandled. Reversal: `git revert` of the single merge commit; no data, DDL or seed is touched, so revert is complete.
A2. Change 5 also widens the `CompleteResult.next` property return annotation (`engine.py:60`) to `Step | Done | Blocked | None` — same staleness, typing-only.
A3. Scope note: `DEFAULT_TRACK` stays as-is here; track-scoping of these call sites is P4.1 (a later PR), which must keep these guards.
A4. Post-merge is autonomous: the release role merges and deploys code-only (reseed=no); the prober runs live_checks.md (read-only regression: start → next → get → explain → complete → submit_answer on a fresh smoke session, all non-error and Blocked never surfaced on authored data; tool count 7). "Human" in the Post-merge section above means the release/prober roles for this run.
A5. The PR also creates `docs/superpowers/decision-log.md` (new file) carrying the run's decision D-1 verbatim from the lead; docs-only.
A6. Green gates (exact): `cd <worktree> && DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= <APP>/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q` ≥ 525 + new tests, 0 failed; `npm run build` green (frontend untouched); counts pasted in the PR body.
