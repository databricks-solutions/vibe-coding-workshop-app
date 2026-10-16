-- Ideas shaped in Ideate or the Insights view, saved per user so they follow
-- the person across browsers and can be ranked on the Insights leaderboard.
-- `payload` is the whole client Idea; scores are owned by the server.
-- The app also creates this table at runtime (src/backend/api/ideate_ideas.py).

CREATE TABLE IF NOT EXISTS ${schema}.ideate_ideas (
    id VARCHAR(64) PRIMARY KEY,
    created_by VARCHAR(255) NOT NULL,
    mode VARCHAR(20) NOT NULL DEFAULT 'ideate',
    session_id VARCHAR(64),
    title VARCHAR(300) NOT NULL DEFAULT '',
    industry VARCHAR(200) NOT NULL DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'exploring',
    step VARCHAR(20) NOT NULL DEFAULT 'spark',
    approved JSONB NOT NULL DEFAULT '[]'::jsonb,
    payload JSONB NOT NULL,
    value_per_year DOUBLE PRECISION,
    journey_points INTEGER NOT NULL DEFAULT 0,
    quality_score INTEGER,
    quality_breakdown JSONB,
    quality_revision INTEGER,
    scored_at TIMESTAMP WITHOUT TIME ZONE,
    total_points INTEGER NOT NULL DEFAULT 0,
    catalog_ref JSONB,
    locked_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    points_reached_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITHOUT TIME ZONE,
    review_status VARCHAR(24),
    submitted_revision INTEGER,
    submitted_at TIMESTAMP WITHOUT TIME ZONE,
    reviewed_revision INTEGER,
    reviewed_at TIMESTAMP WITHOUT TIME ZONE,
    reviewed_by VARCHAR(255),
    review_note TEXT,
    approved_revision INTEGER,
    review_history JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ideate_ideas_owner ON ${schema}.ideate_ideas (created_by);
CREATE INDEX IF NOT EXISTS idx_ideate_ideas_points ON ${schema}.ideate_ideas (total_points DESC);
