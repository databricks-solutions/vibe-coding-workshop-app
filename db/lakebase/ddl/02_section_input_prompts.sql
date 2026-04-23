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
    coding_assistant VARCHAR(40) NOT NULL DEFAULT '__default__' CHECK (coding_assistant IN ('__default__', 'genie-code', 'coda')),
    step_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    inserted_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_section_tag ON ${schema}.section_input_prompts(section_tag);
CREATE INDEX IF NOT EXISTS idx_section_active_version ON ${schema}.section_input_prompts(is_active, version DESC);
CREATE INDEX IF NOT EXISTS idx_section_order ON ${schema}.section_input_prompts(order_number);
CREATE INDEX IF NOT EXISTS idx_section_assistant_version ON ${schema}.section_input_prompts(section_tag, coding_assistant, version DESC);

-- Prevents a concurrent-fork race: the /config/section-inputs/fork endpoint
-- guards against duplicates at the application layer, but two simultaneous
-- requests could both pass the SELECT check and both INSERT. This partial
-- unique index is the DB-level belt-and-suspenders that guarantees at most one
-- active row per (section_tag, coding_assistant, version). Soft-deleted rows
-- (is_active=FALSE) are excluded so re-forking after a delete still works.
CREATE UNIQUE INDEX IF NOT EXISTS uq_section_assistant_version_active
    ON ${schema}.section_input_prompts(section_tag, coding_assistant, version)
    WHERE is_active = TRUE;

COMMENT ON TABLE ${schema}.section_input_prompts IS 
'Versioned section input prompts for LLM prompt generation. bypass_llm=TRUE means return input_template as-is without LLM processing.';
