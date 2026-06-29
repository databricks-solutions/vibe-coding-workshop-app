-- =============================================================================
-- HACKATHONS + JUDGES (PostgreSQL/Lakebase)
-- =============================================================================
-- Stores hackathon events and per-hackathon judge assignments.
-- Roles are per-hackathon and self-serve: the creator (created_by) is the
-- organizer; judges are added by email into hackathon_judges; everyone else is
-- a participant/voter. There is no global RBAC.
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

CREATE TABLE IF NOT EXISTS ${schema}.hackathons (
    hackathon_id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    status VARCHAR(30) NOT NULL DEFAULT 'draft',      -- draft|registration_open|in_progress|judging|completed
    hackathon_type VARCHAR(20) DEFAULT 'online',      -- online|offline|hybrid
    location VARCHAR(255),                            -- city/region (offline/hybrid)
    venue VARCHAR(255),                               -- specific venue (offline/hybrid)
    registration_start TIMESTAMP WITHOUT TIME ZONE,
    registration_end TIMESTAMP WITHOUT TIME ZONE,
    start_date TIMESTAMP WITHOUT TIME ZONE,
    end_date TIMESTAMP WITHOUT TIME ZONE,
    submission_deadline TIMESTAMP WITHOUT TIME ZONE,
    max_participants INTEGER DEFAULT 100,
    max_team_size INTEGER DEFAULT 4,
    min_team_size INTEGER DEFAULT 1,
    total_prize_pool NUMERIC(12,2) DEFAULT 0,
    prize_description TEXT,
    rules TEXT,
    topics JSONB DEFAULT '[]',                        -- list of theme/track names
    judging_criteria JSONB DEFAULT '["Innovation","Technical","Presentation","Impact"]',
    has_team_matching BOOLEAN DEFAULT TRUE,
    has_chat BOOLEAN DEFAULT TRUE,
    has_voting BOOLEAN DEFAULT TRUE,
    created_by VARCHAR(255) NOT NULL,                 -- organizer email
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hackathons_created_by ON ${schema}.hackathons(created_by);
CREATE INDEX IF NOT EXISTS idx_hackathons_status ON ${schema}.hackathons(status);

CREATE TABLE IF NOT EXISTS ${schema}.hackathon_judges (
    hackathon_id VARCHAR(36) NOT NULL,
    judge_email VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',              -- invited|active
    assigned_by VARCHAR(255),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (hackathon_id, judge_email)
);

CREATE INDEX IF NOT EXISTS idx_hackathon_judges_email ON ${schema}.hackathon_judges(judge_email);

COMMENT ON TABLE ${schema}.hackathons IS
'Hackathon events for the V2V workshop. Per-hackathon self-serve roles: created_by is the organizer; hackathon_judges holds assigned judges; all other signed-in users are participants/voters. judging_criteria is a JSON array of criterion names scored 0-10 by judges.';
