-- Leaderboard seasons: archived snapshots and the live season start, per board.
-- Nothing is deleted on reset; the live board only counts work started on or after
-- the open season's started_at. Also created at runtime by src/backend/api/leaderboard_seasons.py.
CREATE TABLE IF NOT EXISTS ${schema}.leaderboard_seasons (
    id VARCHAR(40) PRIMARY KEY,
    board VARCHAR(20) NOT NULL,              -- 'technical' | 'insights'
    kind VARCHAR(20) NOT NULL DEFAULT 'season', -- 'season' (live or archived) | 'snapshot' (frozen copy, no reset)
    name VARCHAR(120) NOT NULL DEFAULT '',
    started_at TIMESTAMP WITHOUT TIME ZONE,  -- NULL = all time
    ended_at TIMESTAMP WITHOUT TIME ZONE,    -- NULL = the live season
    entries JSONB,                           -- frozen board rows once archived
    entry_count INTEGER NOT NULL DEFAULT 0,
    created_by VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_seasons_board ON ${schema}.leaderboard_seasons (board, created_at DESC);
