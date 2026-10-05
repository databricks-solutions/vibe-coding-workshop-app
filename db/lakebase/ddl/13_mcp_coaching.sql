-- =============================================================================
-- MCP COACHING TELEMETRY (PostgreSQL/Lakebase) - IDEMPOTENT MIGRATION
-- =============================================================================
-- 13_mcp_coaching.sql — additive; safe to re-run; depends on 12_mcp_engine_state.sql.
-- Adds the coaching provenance columns (D6 §3a/§7a) to session_interactions.
-- Legacy rows get is_fallback=FALSE, focus=NULL (they are not coaching rows).
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

ALTER TABLE ${schema}.session_interactions ADD COLUMN IF NOT EXISTS is_fallback BOOLEAN DEFAULT FALSE;
ALTER TABLE ${schema}.session_interactions ADD COLUMN IF NOT EXISTS focus       VARCHAR(16);
