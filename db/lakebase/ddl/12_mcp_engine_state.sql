-- =============================================================================
-- MCP ENGINE STATE (PostgreSQL/Lakebase) - IDEMPOTENT MIGRATION
-- =============================================================================
-- Adds the stateless MCP engine's captured output and gate ledgers to sessions,
-- plus an append-only interaction provenance table.
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

ALTER TABLE ${schema}.sessions
  ADD COLUMN IF NOT EXISTS captured_outputs JSONB DEFAULT '{}';

ALTER TABLE ${schema}.sessions
  ADD COLUMN IF NOT EXISTS completed_gates JSONB DEFAULT '[]';

CREATE TABLE IF NOT EXISTS ${schema}.session_interactions (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL REFERENCES ${schema}.sessions(session_id),
    section_tag VARCHAR(128) NOT NULL,
    interaction_id VARCHAR(160) NOT NULL,
    kind VARCHAR(16) NOT NULL,
    answer TEXT,
    recommended TEXT,
    was_default BOOLEAN DEFAULT FALSE,
    coaching_shown TEXT,
    surface VARCHAR(8) DEFAULT 'mcp',
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_session_interactions_session
  ON ${schema}.session_interactions(session_id);

CREATE INDEX IF NOT EXISTS idx_session_interactions_tag
  ON ${schema}.session_interactions(session_id, section_tag);
