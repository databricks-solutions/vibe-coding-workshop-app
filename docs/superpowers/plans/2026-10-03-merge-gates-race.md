# Close the _merge_app_gates read-modify-write race

## Evidence (lead, @ c280933)
- routes.py :5855-5866 (save_session_endpoint) and :6235-6245 (update_session_metadata_endpoint), both `async def`: `_existing = load_session(session_id)` → `_merge_app_gates(incoming, existing)` (routes.py:5518) → `save_session(...completed_gates=merged...)`; the upsert does `completed_gates = COALESCE(EXCLUDED.completed_gates, table.completed_gates)` (lakebase.py:741); skipped_gates is merged the same way inside session_parameters JSONB.
- Race: an MCP write adding a non-representable gate (e.g. `use_case_selection`) committed between the App's load_session and save_session is overwritten by the App's merged list; the gate is lost and dependent steps re-lock. Ledgered in plan 2026-10-01-t5-r4 §Ledger.
- No in-memory session fallback exists: save_session returns False when Lakebase is not configured (lakebase.py:662-664).

## Change (no DDL)
1. Move the pure merge function unchanged to src/backend/workshop/gate_merge.py; routes.py imports it (one implementation).
2. lakebase.py: new `save_session_merging_gates(session_id, *, app_completed_gates, app_skipped_gates, **save_kwargs) -> bool`. Not configured → return False (same as save_session). Configured → ONE transaction on one connection: `SELECT completed_gates, session_parameters FROM <table> WHERE session_id=%s FOR UPDATE`; apply gate_merge (None = preserve-on-absent; representable authoritative; non-representable add-only); run the existing upsert SQL on the same connection; commit. No existing row → the existing upsert path (nothing to preserve). A concurrent first-insert is covered because the upsert's ON CONFLICT path re-reads nothing the App could lose (no stored gates existed at lock time); implementer confirms and states it in the PR body.
3. routes.py: both call sites replace load→merge→save with `success = await asyncio.to_thread(save_session_merging_gates, ...)` (the locked transaction runs off the shared event loop; to_thread copies contextvars, so OBO/user context is unchanged). The call is reached only when the request carries completed_gates or skipped_gates (as today); otherwise the existing save_session call is unchanged, byte-for-byte.
4. MCP writers are not changed; the PR body documents whether the MCP path has the symmetric race and ledgers it if so.

## Charter exception (trunk)
src/backend/api/routes.py (two call sites + import; merge function moved out). Reason: data-loss race. Reversal: git revert; no DDL; FOR UPDATE is a row lock in a short transaction.

## Tests (offline, fake connection/cursor)
- Deterministic interleaving: the fake cursor applies an MCP-style write of `use_case_selection` to the stored row when it is asked to lock; the locked read sees it and the gate survives. Tamper: route the call site back through load→merge→save → gate lost → fails.
- SQL shape: the read contains `FOR UPDATE` and the read + upsert run on the same connection inside one transaction (commit once, after the upsert). Tamper: split onto two connections → fails.
- Off-loop: with a slow fake cursor, a concurrent ticker on the event loop makes progress during the endpoint call (reuse the ticker pattern from tests/workshop/test_step_prompt_budget.py). Tamper: call the function directly (no to_thread) → ticker starves → fails.
- Not configured → returns False, no DB call.
- Existing _merge_app_gates semantics tests pass against the moved function.
- Full tests/workshop + tests/api ≥ floor + new, 0 failed.

## Fences
lakebase.py, routes.py (call sites + import only), new gate_merge.py, tests, plan doc. state.py, mcp_server.py, manifest*, db/: zero-diff.

## Deploy / live
release: code-only, reseed=no. Live (prober, smoke session only, via app endpoints): MCP vibe_start_track + resolve use_case_selection on a smoke session; POST the App save endpoint with completed_gates lacking it; GET load still shows use_case_selection; web GET / < 2 s during the save. Concurrency is proven offline, not live.

## Reversal
git revert of the merge commit.
