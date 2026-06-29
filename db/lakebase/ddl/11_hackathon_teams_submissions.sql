-- =============================================================================
-- HACKATHON TEAMS, MEMBERS, SUBMISSIONS, SCORES, VOTES (PostgreSQL/Lakebase)
-- =============================================================================
-- The participant/judge/voter data for a hackathon. Results (rankings) are
-- computed on read from scores + votes -- no stored ranks (mirrors the
-- sessions-derived /leaderboard pattern).
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

CREATE TABLE IF NOT EXISTS ${schema}.hackathon_teams (
    team_id VARCHAR(36) PRIMARY KEY,
    hackathon_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    leader_email VARCHAR(255) NOT NULL,
    max_members INTEGER DEFAULT 4,
    is_public BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hackathon_teams_hackathon ON ${schema}.hackathon_teams(hackathon_id);

CREATE TABLE IF NOT EXISTS ${schema}.hackathon_team_members (
    team_id VARCHAR(36) NOT NULL,
    member_email VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'member',                -- leader|member
    joined_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (team_id, member_email)
);

CREATE INDEX IF NOT EXISTS idx_hackathon_team_members_email ON ${schema}.hackathon_team_members(member_email);

CREATE TABLE IF NOT EXISTS ${schema}.hackathon_submissions (
    submission_id VARCHAR(36) PRIMARY KEY,
    hackathon_id VARCHAR(36) NOT NULL,
    team_id VARCHAR(36) NOT NULL,
    submitted_by VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    repo_url TEXT,
    demo_url TEXT,
    video_url TEXT,
    slides_url TEXT,
    is_submitted BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hackathon_submissions_hackathon ON ${schema}.hackathon_submissions(hackathon_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hackathon_submissions_team ON ${schema}.hackathon_submissions(team_id);

CREATE TABLE IF NOT EXISTS ${schema}.hackathon_scores (
    score_id VARCHAR(36) PRIMARY KEY,
    submission_id VARCHAR(36) NOT NULL,
    judge_email VARCHAR(255) NOT NULL,
    criteria JSONB DEFAULT '{}',                      -- { "Innovation": 8, "Technical": 9, ... }
    overall NUMERIC(5,2) DEFAULT 0,
    feedback TEXT,
    ai_assisted BOOLEAN DEFAULT FALSE,                -- TRUE if the feedback was AI-drafted (transparency)
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_submission_judge UNIQUE (submission_id, judge_email)
);

CREATE INDEX IF NOT EXISTS idx_hackathon_scores_submission ON ${schema}.hackathon_scores(submission_id);

CREATE TABLE IF NOT EXISTS ${schema}.hackathon_votes (
    submission_id VARCHAR(36) NOT NULL,
    voter_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (submission_id, voter_email)
);

COMMENT ON TABLE ${schema}.hackathon_submissions IS
'One submission per team (uq_hackathon_submissions_team). Judges score via hackathon_scores (one row per judge per submission); community votes are one-per-user in hackathon_votes. Final ranking = avg(scores.overall) tie-broken by vote count, computed at read time.';
