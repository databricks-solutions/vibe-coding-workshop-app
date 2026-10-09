# workshop-level-too-narrow
## Problem
Live probe of 0b07fc0: data-engineering-accelerator sessions never persist. sessions.workshop_level is VARCHAR(20) (db/lakebase/ddl/03_sessions.sql:24); the track id is 28 chars (the longest manifest track id). The save raises StringDataRightTruncation inside save_session_applying_mcp_delta (src/backend/services/lakebase.py:1022), which catches every exception, logs, and returns False. vibe_start_track (src/backend/mcp_server.py:1271, new-session branch) discards _persist_mcp_delta's return and still returns a StartTrackResult whose session_id does not exist in Lakebase.
## Changes
1. New DDL 16: idempotent widen to VARCHAR(64). Non-destructive: no row changes, no truncation possible, Postgres does not rewrite the table for a varchar widen, and no view or index depends on the column.
2. DDL 03: VARCHAR(64) so fresh installs match.
3. mcp_server.py vibe_start_track (trunk exception; reason: the only MCP path that creates a session silently hands back an unsaved id; reversal: revert the hunk): fail closed with SESSION_NOT_SAVED on a False first save. The second (use-case resolution) persist and the routes.py web create paths are out of scope.
4. Tests a-d as above.
5. Decision log D-48, D-49.
## Risk
setup-lakebase.sh runs DDL with ignore_errors=True, so a lock timeout during reseed could mask a failed ALTER; the live check reads the column width directly (L1).
## Live checks
L0 width=20 before deploy; L1 width=64 after reseed; L2 a DE-accelerator start persists and walks to Done; L3 lakehouse + end-to-end controls persist; L4 sessions row count after >= before; L5 0 StringDataRightTruncation in logs.
