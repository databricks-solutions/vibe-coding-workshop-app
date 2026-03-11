-- =============================================================================
-- WORKSHOP PARAMETERS TABLE (PostgreSQL/Lakebase)
-- =============================================================================
-- Stores configurable key-value parameters that are available to all workflow
-- steps and section input prompts. These parameters are replaced in templates
-- using {param_key} syntax (e.g., {workspace_url}, {default_warehouse}).
--
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

CREATE TABLE IF NOT EXISTS ${schema}.workshop_parameters (
    param_id SERIAL PRIMARY KEY,
    param_key VARCHAR(100) NOT NULL UNIQUE,
    param_label VARCHAR(255) NOT NULL,
    param_value TEXT NOT NULL,
    param_description TEXT,
    param_type VARCHAR(50) NOT NULL DEFAULT 'text',
    display_order INTEGER NOT NULL DEFAULT 0,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    allow_session_override BOOLEAN NOT NULL DEFAULT TRUE,
    inserted_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_workshop_params_key ON ${schema}.workshop_parameters(param_key);
CREATE INDEX IF NOT EXISTS idx_workshop_params_active ON ${schema}.workshop_parameters(is_active);
CREATE INDEX IF NOT EXISTS idx_workshop_params_order ON ${schema}.workshop_parameters(display_order);

COMMENT ON TABLE ${schema}.workshop_parameters IS 
'Configurable key-value parameters available to all workflow steps and prompts. Parameters are replaced in templates using {param_key} syntax.';

COMMENT ON COLUMN ${schema}.workshop_parameters.param_key IS 
'Unique key used in templates as {param_key} for variable substitution';

COMMENT ON COLUMN ${schema}.workshop_parameters.param_type IS 
'Type hint for UI rendering: text, url, select, number';

COMMENT ON COLUMN ${schema}.workshop_parameters.allow_session_override IS 
'Whether users can override this parameter value at the session level';
