# Phase 3 · Skip-gate semantics fix (engine) — APPROVED PLAN (ruling recorded 2026-10-01)

Base `5e74683`. **Charter exception APPROVED by the human for BOTH guarded files: `engine.py` (`can_start`) and `mcp_server.py` (`vibe_set_parameters`).** The PR body states the exception and cites D3 §5.2/§5.3 and the workshop-engine-domain §12 open question. Evidence source: read-only explore `explore-skip-blocked-semantics` (cursor), anchors verified live.

## RULING (human, 2026-10-01 — recorded verbatim in intent)

- **Narrowed (a) + reserved-key guard in ONE PR now.**
- **(b)** the distinct `blocked` result is a **SCHEDULED follow-up PR** (planned after this one merges; not an open deferral).
- **Why narrowed — the gap the human's gate found:** `vibe_set_parameters` merges ANY key into `session_parameters` (`mcp_server.py:1566`, `state.session_parameters.update(params)`), including `skipped_gates`. Under (a) as originally written, a Genie Code agent could write `skipped_gates ["use_case_selection"]` and unlock `prd_generation` (`requiresGate use_case_selection`) without a locked use case, or skip any step — although MCP deliberately has no skip tool. Same hole already exists today: it can set `custom_draft_ready=True` directly and defeat the draft-first confirm gate (`mcp_server.py:1342`).

## Design (locked)

**1. `engine.py` `can_start` (:154-157):** a gate is satisfied iff
- `requiresGate is None`, OR
- `requiresGate ∈ completed_gates`, OR
- `requiresGate ∈ _skipped_tags(session)` **AND it is the sectionTag of a step in THIS session's ordered outline (`_ordered_steps`, `engine.py:104`)**.

A non-step gate (`use_case_selection`) can only be satisfied by real completion. Reuse the existing helpers (`_skipped_tags` :94, `_ordered_steps` :104); no new skip source, no schema change. The exact mechanism for outline membership (signature vs loop-supplied tag set) is the implementer's minimal-diff choice.

**2. `mcp_server.py` `vibe_set_parameters` (:1519; merge at :1566):** reject server-owned keys in the INCOMING params — `skipped_gates`, `custom_draft_ready`, `custom_drafted_description` — as one named constant (e.g. `_RESERVED_PARAM_KEYS`).
- Return the existing `INVALID_PARAMETER` error (`:1545` pattern) **BEFORE any update or save**, so nothing persists (all-or-nothing).
- The INTERNAL `custom_draft_ready` write in the draft_custom path (`resolved_params`, ~`:1622`) stays.
- No tool-contract change; tool count stays 7; `test_mcp_contract.py` unchanged.
- If the merged-params path can also receive camelCase aliases (e.g. `skippedSteps`) reaching the same store, FLAG it in the PR body; do not silently expand the reserved set.

**3. Zero-diff everywhere else:** frontend, `routes.py` (the web save legitimately writes `skipped_gates`), `state.py`, `manifest*`, frozen-golden parity harness, DDL. (`mcp_server.py` zero-diff no longer applies — exception granted.)

## Tests (each with a both-direction tamper named in the PR body)

1. **Soak repro row** (genie-accelerator; `completed_gates=[use_case_selection, project_setup, prd_generation, semlayer_locate, semlayer_profile]` + `skipped_gates=[semlayer_measures]`) → exactly one `"current"` (`semlayer_metric_view`); `next_step` returns that Step, **not** `Done`; completing it succeeds (both `engine.complete` and the `vibe_complete_step` path, `mcp_server.py:1035`).
2. **Non-step gate:** `skipped_gates ["use_case_selection"]` does NOT make `prd_generation` startable; completing `prd_generation` is rejected.
3. **Reserved keys:** each of the three via `vibe_set_parameters` → `INVALID_PARAMETER`, and the stored `session_parameters` are unchanged afterwards. A normal param in the same call is not persisted either (all-or-nothing).
4. **Tampers that must fail tests:** revert the `can_start` widening → repro fails; drop the outline-membership condition → the `use_case_selection` test fails; remove any one key from the reserved set → its test fails; move the guard after update/save → the "unchanged" test fails.
5. Full suite + FE node tests + build green; absence pin green (`skipped_gates`/`_skipped_tags` wordings only — never snake `skipped_steps`).

## Blast radius (explore-verified)

No SPA runtime consumer of outline `"locked"`/`"current"`/`"skipped"` (order + `done`-projection only) → zero frontend diff. Frozen-golden parity harness ORDER-only on fresh sessions → unconstraining. T4a preview unaffected (no progress fields). No existing test pins the buggy `Done()`. GATE_REQUIRED interactions unchanged.

## (b) — scheduled follow-up (separate PR, planned after this merges)

`next_step` returns a distinct `blocked` result (never false `Done` while unresolved non-skipped steps remain). Ripple mapped in the explore: `NextStepResult`/`DoneResult` oneOf, D2 §3.3/§6, `test_mcp_contract.py`, `isinstance(..., Done)` assumptions. After (a), the soak row never reaches it — it is a safety net for future gate-data bugs.

## Report (paste in PR)

`tests/workshop` + `tests/api` counts (offline, SDK-neutralized, main `.venv` `mcp==1.30.0`), FE node counts, `npm run build`, both-direction tampers, `git diff --stat` (engine + mcp_server + tests + this plan doc only), JSONB-vs-`''` sweep zero. PR body: charter exception + D3 cites; kept separate from PR #73 (post-DROP cleanup).
