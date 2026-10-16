# workshop-level-reland: re-land #118 (DDL 16 widen + SESSION_NOT_SAVED) by reverting the revert e56c47d (D-55)

repo=app · base origin/feature/genie-code-mcp-integration AFTER #121 merges (so the decision-log append does not conflict) · plan path in PR: docs/superpowers/plans/2026-10-07-workshop-level-reland.md
Trunk files touched: src/backend/mcp_server.py (the #118 hunk, already critic-accepted under its trunk exception: reason = the only MCP path that creates a session silently returns an unsaved id; reversal = revert the hunk).

## Background
#118 (head 8c53b7e, reviewer ACCEPT + gatekeeper PASS 1286) merged as 4540e86. Its tables reseed was DENIED by the deploy guard on the word "truncate" inside a SQL `--` comment of DDL 16, so it was rolled back as e56c47d (D-50) with nothing deployed; the live column is still VARCHAR(20) and no data-engineering-accelerator session has ever saved. The human ruled (D-55): re-land through the normal pipeline. Forge 75eee97 makes the deploy guard ignore `--` comments, so DDL 16 is re-landed UNCHANGED (no rewording).

## Changes
R1 `git revert --no-edit e56c47d` on the forge branch (a normal revert commit; no cherry-pick of other commits, no force push). After it, these six paths must be byte-identical to 8c53b7e: db/lakebase/ddl/03_sessions.sql, db/lakebase/ddl/16_widen_workshop_level.sql, src/backend/mcp_server.py's vibe_start_track hunk (whole file equal to base + exactly that hunk), tests/workshop/test_workshop_level_width.py, docs/superpowers/plans/2026-10-07-workshop-level-too-narrow.md, and the D-48/D-49 lines of docs/superpowers/decision-log.md. If the revert conflicts (decision-log.md after #119-#121 appends), resolve by keeping every existing entry and placing #118's lines where they were in 8c53b7e's order; do not drop or reword any entry.
R2 Docs nit from the #118 review: db/lakebase/README.md (`| workshop_level | VARCHAR(20) |` row, ~:115) and docs/specs/mcp_design/mcp-workshop-data-model.md (~:48 `workshop_level VARCHAR(20) DEFAULT '300'`) → VARCHAR(64). Nothing else in either file.
R3 decision-log.md: append D-54 and D-55 verbatim from FORGE/state/lead/decisions.md (D-54 is final once #121's reviewer accepts; the lead passes the final text).
R4 This plan file at the plan path.
Out of scope (unchanged from #118): the second (use-case resolution) persist in vibe_start_track and the routes.py web create paths.

## Green gates
pytest tests/workshop tests/api ≥ the floor after #121 (the #121 gate count) + the 4 restored test_workshop_level_width tests; no seed change → no genie gate. No frontend change.

## Tampers (from state/specs/workshop-level-too-narrow/tampers.md, still valid; restore each)
X1 03_sessions.sql back to VARCHAR(20) and delete 16_widen_workshop_level.sql → test a red.
X2 DDL 16 → VARCHAR(25) → test a red.
X3 add `DELETE FROM sessions;` to DDL 16 → test b red.
X4 mcp_server.py: drop the return-value check in vibe_start_track → test c red.
X5 mcp_server.py: return the error even on True → test d red.
X6 (new) README/data-model still say VARCHAR(20) → the gatekeeper greps both docs; any VARCHAR(20) for workshop_level is a fence failure.

## Release
MERGE repo=app reseed=yes: the tables reseed (DDL 16 + 03) runs FIRST, then the code deploy. Quote the `16_widen` lines from the tables log (setup-lakebase.sh runs DDL with ignore_errors=True, so a silent ALTER failure must be caught by L1). If the deploy guard denies the DDL again → STOP, no rewording; the lead parks (D-55).

## Live checks (state/specs/workshop-level-too-narrow/live_checks.md)
L0 before release (read-only): sessions.workshop_level character_maximum_length = 20; sessions row count N0.
L1 after reseed: width = 64.
L2 vibe_start_track track=data-engineering-accelerator (a curated industry/use case) returns a session_id that EXISTS in Lakebase with workshop_level='data-engineering-accelerator', and the walk reaches Done with 0 app errors (the human's acceptance: a data-engineering-accelerator session now saves).
L3 control: a lakehouse and an end-to-end start persist their own ids.
L4 sessions row count after ≥ N0.
L5 0 StringDataRightTruncation and 0 SESSION_NOT_SAVED in the app logs over the walk window; 7 tools; /health 200.

## Reverse
release ROLLBACK of the re-land merge (code-only redeploy). The widened column needs no undo (a wider varchar truncates nothing).
