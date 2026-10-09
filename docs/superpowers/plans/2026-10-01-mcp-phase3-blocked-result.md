# PR B — blocked safety net (amended; post-PR-A)

Ruling (human, 2026-10-01): PR B proceeds AFTER PR A merged+deployed (92e7fc8). PR A fixed the root
cause (prerequisite rewiring); PR B is the safety net for future gate-data defects. Charter exceptions
APPROVED for engine.py and mcp_server.py as this PR needs; state them in the PR body (D3 §5.2/§5.3 + §12).
Plan doc committed in-PR (per the #74 precedent).

## Invariant
vibe_next_step NEVER reports done:true while the track is unfinished. done stays reserved for
"every outline step is done or skipped".

## Contract change (D2 §3.3/§6; test_mcp_contract.py)
Third union member — NO top-level sectionTag/title (a blocked payload must not look like a step):
    class BlockedResult(BaseModel):        # extra="forbid"
        blocked: Literal[True] = True
        blocked_by: BlockedBy              # {sectionTag, title, requiresGate} — extra="forbid"
        message: str
    NextStepResult = RootModel[ExplainabilityPayload | DoneResult | BlockedResult]
DoneResult untouched ({done: Literal[True]}) — old clients keying on done never see a false done:true
(old-client note in PR body). Tool count stays 7; annotations matrix unchanged; test_mcp_contract.py
extended to schema-validate the blocked variant; vibe_next_step tool description updated (currently
mcp_server.py:1049 "Returns `{done:true}` when complete" — must cover the blocked outcome); D2 §3.3/§6
updated in-PR.

## Message (deterministic, no LLM) + logging
"The workshop cannot advance because '<title>' requires '<requiresGate>'. This indicates a workshop
configuration problem, not a learner action. Tell the learner and stop."
Server-side WARNING log: track, flags, the dangling gate (after PR A, any blocked result is a defect
signal). No params/PII in the log.

## Engine change (engine.py next_step, :144-152)
When no step is current: all-done-or-skipped -> Done() (unchanged); else -> Blocked carrying the FIRST
locked step in outline order (sectionTag, title, requiresGate). Pure function of the existing scan;
no new skip source; no schema change; tool count +0; SPA unaffected (explore-verified: zero runtime
consumers of outline statuses; the SPA never calls vibe_next_step); frozen-golden harness not
constrained (ORDER-only fresh sessions); T4a preview unaffected.

## Fixture + tests (OFFLINE ONLY — after PR A the blocked path is unreachable by construction; live smoke: none)
Fixture: a deliberately broken composition via monkeypatch (a dangling requiresGate on an otherwise
valid session) — NOT the use_case_selection row (PR A's intent beat intercepts that).
1. Forced-blocked row -> vibe_next_step returns the blocked variant naming the blocking step + gate
   (contract-validated against the new union schema).
2. Done-invariant: all-done-or-skipped -> Done(); ANY locked step -> never Done.
3. test_mcp_contract.py: blocked variant schema-validates; done/done_by shapes unchanged.
Tampers (both directions, named in PR body): T1 revert next_step to unconditional Done() -> blocked
tests fail; T2 strip the union member or blocked_by fields -> contract test fails; T3 make Done fire
while a locked step remains -> invariant test fails.
NOTE (recon finding): no existing test pins Done() on a locked-only state — fail-before is net-new.

## Fold-in from PR A review (test-only, fits the fence)
Pin the authored active-section gate graph: cycle == 0 AND missing == 0 (both 0 today) — makes the
_nearest_outline_ancestor docstring true and guards the defensive None->unlock path.

## Fences
engine.py + mcp_server.py only (charter exceptions stated in PR body); manifest.py/manifest.json,
state.py, frontend, routes.py, DDL: zero-diff. No DDL. No reseed. No deploy from the agent side.
Offline gates pasted: full tests/workshop + tests/api (SDK-neutralized, DATABRICKS_CONFIG_FILE=/dev/null,
main .venv mcp==1.30.0), npm run build + lint (frontend untouched = zero-diff), absence pin green,
JSONB-vs-'' sweep zero. Explicit staging; never git add -A; never .cursor/ or .isaac/.
STOP-and-report rather than a partial or red PR.
