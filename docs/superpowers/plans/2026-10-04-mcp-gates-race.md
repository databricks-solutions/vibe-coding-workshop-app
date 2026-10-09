# mcp-gates-race

## Defect (ledgered by PR #84; verified at ad64c10)
MCP tools read the session (`_load_session_for_request`, mcp_server.py:515), mutate an in-memory `engine.SessionState`, then persist FULL values with `save_session(captured_outputs=dict(state.captured_outputs), completed_gates=list(state.completed_gates), session_parameters=resolved_params, …)` at roughly mcp_server.py:1124, 1162, 1706, 1816, 1828, 1951, 1968, 2040 and 2052 (re-grep: line numbers moved slightly with #86). `_session_upsert` (lakebase.py) writes those three JSONB columns by COALESCE replacement, not merge. So an App write that commits between the MCP read and the MCP write (an SPA step completion, an App skipped_gates patch, a session_parameters change) is silently overwritten. This is the mirror image of the App-side race #84 fixed with `save_session_merging_gates` (lakebase.py:818, SELECT … FOR UPDATE).

Verified invariant: the MCP write path only ADDS. engine.complete_step and engine.resolve_use_case append gates (engine.py:280, :330); no MCP or engine code removes a gate, pops a captured_outputs key or deletes a session_parameters key. Re-verify by grep. If you find a removal, STOP and report.

## Change
1. lakebase.py: add `save_session_applying_mcp_delta(session_id, *, add_gates: list[str], set_outputs: dict[str,str], set_params: dict[str,Any], **save_kwargs) -> bool`, structured exactly like save_session_merging_gates:
   - one connection, autocommit off, `SELECT completed_gates, captured_outputs, session_parameters … FOR UPDATE`;
   - merged_gates = stored + [g for g in add_gates if g not in stored] (order kept);
   - merged_outputs = {**stored_outputs, **set_outputs};
   - merged_params = {**stored_params, **set_params};
   - `_session_upsert(table, session_id, completed_gates=merged_gates, captured_outputs=merged_outputs, session_parameters=merged_params, **save_kwargs)`;
   - commit; rollback on error and return False; restore autocommit; and return False when Lakebase isn't configured (same contract as save_session).
   An empty delta (all three empty) with no save_kwargs is a no-op returning True, with no DB round trip.
2. mcp_server.py (trunk; charter exception accepted by plan_critic): add `_persist_mcp_delta(session_id, before: engine.SessionState, after: engine.SessionState, *, session_parameters: dict | None = None, **save_kwargs)`. It computes add_gates = gates in after not in before; set_outputs = keys whose value is new or changed; set_params = keys of the resolved params whose value is new or changed versus before.session_parameters. It then calls the new lakebase function. `before` is a deep copy taken right after `_load_session_for_request` in each writing tool. Replace every save_session call in mcp_server.py with it, passing the non-JSONB save_kwargs through unchanged (session_name, industry, industry_label, use_case, use_case_label and the like, which keep their COALESCE semantics).
   App removals survive, because a gate or key the App removed is not in the delta. App additions survive, because the stored row is the merge base.
3. Stale comment from the #86 review: update the Option A header at mcp_server.py ~925-931 so it says explain also surfaces the beat and that complete-on-the-beat follows D-8. Comment only.
4. decision-log.md: append D-9 (2026-10-04) · "MCP writes persist only their own delta (added gates, new or changed output and parameter keys) inside a SELECT…FOR UPDATE transaction. Rule (2), the ledger's recommendation (#84 named the symmetric fix), with delta rather than union so that App removals of representable gates are not resurrected. · Reverse: point _persist_mcp_delta back at save_session with full values." Public register, in the file's one-line format.

Not changed: the App path (save_session_merging_gates and routes.py), engine.py, manifest.json, db/ DDL (no schema change), and frontend.
Event loop: the MCP tools are synchronous and FastMCP runs them in worker threads (critic-verified); one extra SELECT inside the transaction, no new blocking pattern.

Fence: src/backend/services/lakebase.py, src/backend/mcp_server.py, tests (a new tests/workshop/test_mcp_delta_persist.py, plus the fake-sessions-DB helpers #84 added if extension is needed), docs/superpowers/decision-log.md, and the plan file.

## Tests (reuse #84's fake sessions DB / race harness)
- R1 (the race): an MCP vibe_complete_step loads the state, then an App save commits a representable gate G_app and a skipped_gates patch before the MCP write; afterwards stored gates contain both G_app and the MCP-completed tag, and skipped_gates survives.
- R2: the App removes a representable gate between the MCP read and write; the MCP write does not resurrect it.
- R3: concurrent vibe_set_parameters and App session_parameters patch; both keys survive.
- R4: the delta helper is unit-tested: add-only gates, changed-only outputs and params, and an empty delta does nothing (no DB call).
- R5: the transaction rolls back and returns False on a DB error mid-transaction, and autocommit is restored.
- Every existing MCP tool test stays green unchanged. Any test that asserts on save_session kwargs is adapted only to assert the same persisted end state; list each such adaptation in the PR body.

## Acceptance contract
- Backend suite (DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= <APP>/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q): floor 566 plus the new tests, 0 failed. The race tests are green on 3 consecutive runs. Frontend build green; lint passes the D-7 differential gate (no new errors vs ad64c10). MCP tools/list = 7.
- Tampers (FORGE/state/specs/mcp-gates-race/tampers.md), each verified and then restored byte-identically: T1 merged_gates = stored only → R1 red; T2 add_gates = all of after.completed_gates → R2 red; T3 drop FOR UPDATE / the explicit transaction → R1 red under the race harness; T4 make the empty delta hit the DB → R4 red. T3 is only observable if the harness models the row lock. Make the fake DB serialize or block on FOR UPDATE (as #84's race tests did, if they did), or assert the locking SELECT text and transaction boundaries directly. Say in the PR body which approach you took.
- Open a PR into feature/genie-code-mcp-integration titled "mcp-gates-race: MCP writes persist their delta under a row lock".

## Fence amendment (post-implementation)
Files touched outside the fence above, each test-only:
- tests/workshop/conftest.py: one autouse fixture. When a test stubs mcp_server.save_session, it applies the MCP delta to that test's stored record using the production `_apply_mcp_delta` and hands the stub the merged end state; otherwise the real locked function runs. This replaces edits to 52 tests across ~22 files, which stay byte-unchanged.
- tests/workshop/test_write_tools.py and tests/workshop/test_sync_bridge.py: one idempotent-replay assertion each. The replay now writes nothing, so they assert that no save happened; their end-state checks are unchanged.
- tests/api/_fake_sessions_db.py: models the FOR UPDATE row lock inside explicit transactions, with a new interleave_on window (None keeps #84's behavior).

Behavior note: industry, use_case and *_label are no longer re-written into the session_parameters JSONB on every MCP write, only when changed; readers re-derive them from the columns.
