-- =============================================================================
-- SECTION INPUT PROMPTS TABLE (PostgreSQL/Lakebase)
-- =============================================================================
-- Stores versioned section input prompts for LLM prompt generation.
-- Latest version = MAX(version) per section_tag
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

CREATE TABLE IF NOT EXISTS ${schema}.section_input_prompts (
    input_id SERIAL PRIMARY KEY,
    section_tag VARCHAR(100) NOT NULL,
    section_title VARCHAR(255),
    section_description TEXT,
    input_template TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    order_number INTEGER,
    how_to_apply TEXT,
    expected_output TEXT,
    how_to_apply_images JSONB DEFAULT '[]'::jsonb,
    expected_output_images JSONB DEFAULT '[]'::jsonb,
    bypass_llm BOOLEAN NOT NULL DEFAULT FALSE,
    coding_assistant VARCHAR(40) NOT NULL DEFAULT '__default__',
    step_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    inserted_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    -- Named CHECK so fresh installs and migrated installs (DDL 07) share the
    -- same constraint name. DDL 07 is then a strict no-op on fresh installs.
    CONSTRAINT chk_coding_assistant CHECK (coding_assistant IN ('__default__', 'genie-code', 'coda'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_section_tag ON ${schema}.section_input_prompts(section_tag);
CREATE INDEX IF NOT EXISTS idx_section_active_version ON ${schema}.section_input_prompts(is_active, version DESC);
CREATE INDEX IF NOT EXISTS idx_section_order ON ${schema}.section_input_prompts(order_number);

-- NOTE: The two indexes referencing `coding_assistant`
-- (idx_section_assistant_version and the partial unique
-- uq_section_assistant_version_active) are created by DDL 07
-- (07_add_coding_assistant_column.sql). Keeping them there — and out of this
-- file — means a legacy upgrade (where CREATE TABLE IF NOT EXISTS is a no-op
-- on a pre-existing table without the coding_assistant column) does not emit
-- any silently-swallowed "column does not exist" errors. On a fresh install,
-- DDL 07 runs immediately after this file and creates them on the freshly
-- created table; on a legacy install, DDL 07 first adds the column and then
-- creates the indexes. Either way the final schema is identical.

COMMENT ON TABLE ${schema}.section_input_prompts IS 
'Versioned section input prompts for LLM prompt generation. bypass_llm=TRUE means return input_template as-is without LLM processing.';
