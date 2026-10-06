# seed-ledger-crash-window (D-38)

Base: origin/feature/genie-code-mcp-integration @ 5e0ed6e8b00525fb4f2fa314a033508088da123f (PR #110 merged, deployed, live PASS).
PR plan path: docs/superpowers/plans/2026-10-06-seed-ledger-crash-window.md

## Problem (#110 review, nonblocking, 9565eb6)
seed_new_rows.py writes a seed row and its ledger entry as SEPARATE autocommit statements (the runner connects with autocommit=True, setup-lakebase.sh:582/:589):
- W1 (S4, populated install, apply_new_rows mode="insert", ~:300-314): `cursor.execute(INSERT … ON CONFLICT (pk) DO NOTHING)` then `_ledger(...)`. A crash, kill or connection drop between them leaves the row present and un-ledgered.
- W2 (bulk paths: create-mode empty-table bulk via run_create_mode_seed, ~:395-415, and the --recreate branch, setup-lakebase.sh ~:684 record_applied_rows): the runner's execute_sql_file seeds the whole file, and only THEN does mode="ledger" record the post-baseline PKs. A crash in between leaves every post-baseline row of that table un-ledgered.
On the retry both cases look like "populated, PK held by an existing row": rowcount 0 → WARNING, never ledgered. If an admin later deletes that row, the next deploy re-inserts it (resurrection, the class D-37 exists to stop). Unreachable today (no post-baseline rows: tables-step log 5e0ed6e "0 inserted / 0 warnings"); reachable as soon as P4.3 adds fork rows input_id 1001+. Must ship before the first P4.3 seed PR.

## Design
F1 (closes W1): make insert + ledger ONE statement, so autocommit makes it atomic:
  WITH ins AS (<seed INSERT> ON CONFLICT (<pk_col>) DO NOTHING RETURNING <pk_col>)
  INSERT INTO <schema>.seed_rows_applied (table_name, pk) SELECT %s, <pk_col> FROM ins ON CONFLICT DO NOTHING
  rowcount 1 → inserted + ledgered; rowcount 0 → the PK is held by an existing row → WARNING, not ledgered (unchanged semantics). _with_on_conflict becomes _atomic_apply(stmt, pk_col, table) and keeps its fail-closed checks (terminating ';', single VALUES tuple already enforced by seed_rows). The seed INSERT text is otherwise unchanged (it's already schema-transformed). PostgreSQL allows data-modifying CTEs with RETURNING and ON CONFLICT DO NOTHING (rows skipped by DO NOTHING are not returned).
F2 (closes W2): an additive bulk-in-progress marker, db/lakebase/ddl/15_seed_bulk_pending.sql:
  CREATE TABLE IF NOT EXISTS ${schema}.seed_bulk_pending (table_name VARCHAR(100) PRIMARY KEY, started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)
  - Before a bulk seed of 01 or 02 (create-mode empty table, and each table in the --recreate branch): INSERT the marker (ON CONFLICT DO NOTHING).
  - After the bulk seed + the never-lower sequence raise + mode="ledger" for that table: DELETE the marker row for that table (bookkeeping only; it is our own marker table, not seed or user data).
  - At the start of run_create_mode_seed (and before record_applied_rows in --recreate): for every table that has a marker → RECOVER: run mode="ledger" for it (ledger every post-baseline PK now present; the rows came from the interrupted bulk seed), then delete its marker, and log `<table>: recovered interrupted bulk seed (N post-baseline rows ledgered)`. Then continue with normal gating (the table is now populated → S4; any post-baseline row the interrupted bulk didn't reach is un-ledgered and absent → inserted atomically by F1).
  Why not one transaction around the bulk: execute_sql_file swallows per-statement errors; inside a transaction the first error aborts every later statement silently and the COMMIT rolls back, a behavior change in the runner. Not done.
  Residual (documented, accepted): an ADMIN deleting a post-baseline row in the seconds between an interrupted bulk and its retry is indistinguishable; the retry ledgers only present rows, so that deleted row is NOT ledgered and F1 would re-insert it. Requires a crash + an admin delete inside one deploy window on a fresh install; documented in the plan, not engineered.
F3: the never-lower sequence raise also runs after recovery (unchanged helper).
Fence: scripts/seed_new_rows.py, scripts/setup-lakebase.sh (only the --recreate call site: marker write before the bulk, recovery + marker clear around record_applied_rows; nothing else), db/lakebase/ddl/15_seed_bulk_pending.sql (new), tests/workshop/test_seed_new_rows.py, the plan file, docs/superpowers/decision-log.md (D-38). Not touched: seed files, deploy.sh, trunk files. No charter exception.

## Tests (offline, fake cursor; the fake must model the CTE: insert into the table iff the PK is free, and the ledger row iff inserted)
- C1 atomic: the S4 path emits exactly ONE statement per new row and it contains both the table INSERT and the seed_rows_applied INSERT; no separate _ledger call follows.
- C2 crash-between (W1): with the OLD two-statement shape this test would leave inserted-but-unledgered; with F1 a fault injected after the statement leaves ledger and table consistent (both or neither).
- C3 W2 recovery: simulate a bulk seed that ran, then a crash before ledgering (marker present, ledger empty, rows present); the rerun ledgers them, clears the marker, inserts 0, warns 0; an admin delete afterwards + rerun does NOT resurrect.
- C4 marker lifecycle: the happy-path bulk writes then clears the marker; a populated install never writes one.
- C5 partial bulk: marker present, some post-baseline rows absent → those are inserted atomically on the rerun and ledgered.
- C6 recreate branch: marker written before, cleared after (the call site is exercised the same way #110's T4 test exercises it).
- Existing 47 tests stay green unchanged except where they assert the two-statement shape (list any edited assertion in the PR).
Tampers: X1 split F1 back into two statements → C1/C2 red; X2 skip the recovery step → C3 red; X3 never delete the marker → C4 red; X4 write the marker AFTER the bulk → C3 red (crash right after the bulk loses the marker).
Suite floor 924 (5e0ed6e).

## Live check (prober, after deploy; release runs the tables step in DEFAULT create mode, reseed=yes for DDL 15)
L1 md5 of /api/all-data and /api/config/step-visibility-matrix identical before/after (as #110). L2 tables-step log: DDL 15 executed; no "recovered interrupted bulk" line; per-table populated lines; 0 inserted / 0 warnings ×2; sequences kept. L3 7 tools, /health 200, clean log.

## Decision D-38
question: how to close the insert/ledger crash windows of D-37 · choice: F1 single-statement CTE (atomic under autocommit) + F2 additive bulk-pending marker with recovery · evidence: seed_new_rows.py:300-314, :395-415; setup-lakebase.sh:582/:589 autocommit, :684 · Rule (3), most reversible · reversal: git revert; the empty marker table stays (DROP is a human decision).
