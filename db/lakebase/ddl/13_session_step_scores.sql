-- =============================================================================
-- SESSION STEP SCORES (PostgreSQL/Lakebase)
-- =============================================================================
-- Per-step quality scores, so the leaderboard reflects the quality of an
-- attendee's decisions and whether their artifacts really exist — not how many
-- times they clicked Done.
--
-- Deliberately shaped like hackathon_scores (DDL 11): criteria JSONB + an overall
-- 0-10 mean + an ai_assisted transparency flag. That lets the rubric helpers be
-- shared instead of reimplemented, and keeps the two scoring surfaces consistent.
--
-- Absence of a row is meaningful: _calculate_score falls back to the flat
-- STEP_SCORES value per step, so sessions from before this table existed score
-- exactly as they did before, with no migration and no backfill. A session that
-- spans both worlds scores correctly step by step.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

CREATE TABLE IF NOT EXISTS ${schema}.session_step_scores (
    session_id     VARCHAR(36) NOT NULL,
    step_number    INTEGER NOT NULL,
    section_tag    VARCHAR(100) NOT NULL,
    step_kind      VARCHAR(24) NOT NULL DEFAULT 'instant_prompt',
    -- Per-criterion 0-10 marks, e.g. {"grain_precision": 8, "fk_coverage": 6}
    criteria       JSONB DEFAULT '{}'::jsonb,
    -- Mean of criteria, 0-10. Redundant but stored so the leaderboard can sort
    -- without unpacking JSONB per row.
    overall        NUMERIC(5,2) DEFAULT 0,
    -- The step's ceiling from STEP_SCORES; kept so historical rows stay meaningful
    -- if the ceilings are ever retuned.
    max_points     INTEGER NOT NULL DEFAULT 0,
    awarded_points INTEGER NOT NULL DEFAULT 0,
    -- How the artifact was confirmed: workspace | agent_reported | self_attested | none
    verification   VARCHAR(20) DEFAULT 'none',
    ai_assisted    BOOLEAN DEFAULT FALSE,
    -- The committed decision / gate report this score was derived from.
    payload        JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (session_id, step_number)
);

-- The leaderboard reads every score for a set of sessions in one pass.
CREATE INDEX IF NOT EXISTS idx_session_step_scores_session
  ON ${schema}.session_step_scores(session_id);

COMMENT ON TABLE ${schema}.session_step_scores IS
'Per-step quality scores. Missing rows fall back to flat STEP_SCORES, so pre-existing sessions score unchanged.';

COMMENT ON COLUMN ${schema}.session_step_scores.verification IS
'How the step was confirmed. Scales the award: workspace 1.0, agent_reported 0.85, self_attested 0.6, none 0.5.';
