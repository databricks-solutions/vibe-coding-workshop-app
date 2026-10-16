# Pin databricks-sdk to the deployed version (Phase 3 cleanup)

## Evidence
- requirements.txt:19 `databricks-sdk>=0.81.0` floats. This repo pins in requirements.txt (D9 §0, §3: never float; `mcp==1.30.0` at :15 is the precedent).
- PR #77 body "SDK version re-anchor + floating-pin ledger": resolved/deployed truth = 0.139.0; plan 2026-10-01-mcp-phase3-latency-budget §SDK re-anchor ledgers the float. The #77/#78 timeout/retry reasoning (60 s per-attempt socket timeout, 300 s retry deadline) is anchored to 0.139.0, so a float to a newer SDK silently invalidates it.
- APP .venv (the env every suite runs against): databricks.sdk.version 0.139.0.
- Lead decision D-3: pin ==0.139.0 (shipped code decides).

## Change
1. requirements.txt:19 → `databricks-sdk==0.139.0` (keep any trailing comment on the line). No other requirements line changes; the other `>=` lines stay as-is and remain ledgered (out of scope: RUN.md names the SDK only).
2. New test tests/api/test_requirements_pins.py: parse requirements.txt and assert `databricks-sdk` and `mcp` are exact `==` pins, and that the databricks-sdk pin equals the installed `databricks.sdk.version.__version__` (so the suite env cannot drift from the pin). Tamper T1: restore `>=0.81.0` → test fails. Tamper T2: change the pin to `==0.138.0` → the installed-version equality fails.
3. The PR appends D-2 and D-3 (lead text) to docs/superpowers/decision-log.md if that file exists on the base when the PR is cut; if not, skip and say so in the PR body.

## Fences
requirements.txt (one line) + the new test + the plan doc (+ decision-log append). Zero diff elsewhere. No trunk files. Explicit staging.

## Gates
`DATABRICKS_CONFIG_FILE=/dev/null LAKEBASE_HOST= <APP>/.venv/bin/python -m pytest -c /dev/null --rootdir=. tests/workshop tests/api -q` ≥ last merged floor (+ the new tests), 0 failed. No frontend change.

## Deploy / live
release: code-only deploy, reseed=no (no DDL / seed). The platform then installs exactly 0.139.0. Live check (prober): web GET / 200 < 2 s; POST /mcp handshake and tools/list == 7 tools; vibe_start_track on a fresh smoke session → vibe_next_step returns a step payload; GET /api/track/genie-accelerator/outline?session_id=<smoke> 200.

## Reversal
One-line revert of requirements.txt (+ delete the test); redeploy code-only.
