# seed-unique-conflict (D-40)

Base: origin/feature/genie-code-mcp-integration after #112 (seed-ledger-crash-window) merges (it edits the same helper).
PR plan path: docs/superpowers/plans/2026-10-06-seed-unique-conflict.md

## Problem (critic-p4-app-family r1 finding 3)
section_input_prompts has, besides its PK, a partial unique index uq_section_assistant_version_active on (section_tag, coding_assistant, version) WHERE is_active (seed header rule 3, 02 seed ~:75-77; DDL 02). The D-37/D-38 S4 path (scripts/seed_new_rows.py _atomic_apply on #112) inserts a new seed row with `ON CONFLICT (input_id) DO NOTHING`. If an admin has already created an ACTIVE row for the same (section_tag, coding_assistant, version), e.g. their own genie-code fork of a step the seed now forks (P4.3 adds forks 1001+), the insert raises UniqueViolation on that index. The helper exits 1 (S7), so the tables step fails and the release stops before the code deploy. That fails safe (nothing overwritten) but blocks every later deploy until a human intervenes.
The critic rejected a targetless `ON CONFLICT DO NOTHING`: it would silently absorb ANY unique constraint on any seed table, hiding real integrity bugs.

## Design (scoped, Rule 3: most reversible)
U1. In the S4 per-row apply only: wrap the atomic statement's execute in a try/except that catches a unique violation ONLY when its constraint name is exactly `uq_section_assistant_version_active` (psycopg3 and psycopg2 both expose `e.diag.constraint_name`; detect UniqueViolation by SQLSTATE 23505 via `getattr(e, 'sqlstate', None) or getattr(e, 'pgcode', None)`, so neither driver class is imported). Then: log `WARNING: section_input_prompts input_id=<pk> skipped: an active row for (section_tag, coding_assistant, version) already exists (uq_section_assistant_version_active); seed row not applied`, count it as a warning, do NOT ledger it, and continue with the next row. The runner connects with autocommit=True (setup-lakebase.sh ~:582/:589), so the failed statement doesn't abort later statements; assert that assumption in a comment and in a test using a fake that raises.
U2. Any other exception (another constraint, another SQLSTATE, or the same SQLSTATE with a different constraint name) re-raises exactly as today (fail closed, S7 exit 1).
U3. Only section_input_prompts has this index. The handler applies to it by constraint name, so usecase_descriptions is unaffected (its only unique key is the PK, already handled by ON CONFLICT).
U4. A re-run re-warns (not ledgered), same as a PK collision today: the admin row owns that slot; if the admin later deactivates their row, the next deploy inserts the seed fork. Documented as intended.
Fence: scripts/seed_new_rows.py, tests/workshop/test_seed_new_rows.py, the plan file, docs/superpowers/decision-log.md (D-40). Nothing else.

## Tests (fake cursor raising a driver-like exception with sqlstate/pgcode + diag.constraint_name)
V1: the active-triple collision → WARNING, 0 inserted, 1 warning, not ledgered, the NEXT row in the same run still applies.
V2: SQLSTATE 23505 on a DIFFERENT constraint name → re-raised (the helper fails closed).
V3: a non-unique error (e.g. 23502 not-null) → re-raised.
V4: both attribute spellings (psycopg3 `sqlstate`, psycopg2 `pgcode`) are recognized.
V5: the existing 54 seed tests unchanged and green.
Tampers: W1 catch any 23505 regardless of constraint → V2 red; W2 ledger the skipped row → V1 red; W3 stop the loop after the warning (break) → V1 red (next row not applied); W4 drop the pgcode spelling → V4 red.
Suite floor: the last merged count after #112.

## Live check
No seed change, so no rows move. Release reseed=no; code-only deploy (the helper runs only during a tables step, so nothing changes at runtime). Prober: L1 the merge touches only the fence; L2 7 tools, /health 200, clean log. The behavior is exercised for real by the next seed release (p4-app-family), whose tables-step log must show the expected counts.

## Decision D-40
question: how should a new seed row that collides with an admin's active row on uq_section_assistant_version_active be handled? · choice: catch exactly that constraint name per row → WARN, skip, don't ledger; everything else still fails closed · evidence: seed 02 header rule 3; seed_new_rows.py _atomic_apply; critic-p4-app-family r1 (3) · reversal: git revert (back to fail-closed).
