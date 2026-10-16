-- Governed Ideate review metadata. The owner-controlled payload.status remains
-- draft/park/exploring; review state is stored separately and owned by the API.

ALTER TABLE ${schema}.ideate_ideas
    ADD COLUMN IF NOT EXISTS review_status VARCHAR(24);
ALTER TABLE ${schema}.ideate_ideas
    ADD COLUMN IF NOT EXISTS submitted_revision INTEGER;
ALTER TABLE ${schema}.ideate_ideas
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE ${schema}.ideate_ideas
    ADD COLUMN IF NOT EXISTS reviewed_revision INTEGER;
ALTER TABLE ${schema}.ideate_ideas
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE ${schema}.ideate_ideas
    ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(255);
ALTER TABLE ${schema}.ideate_ideas
    ADD COLUMN IF NOT EXISTS review_note TEXT;
ALTER TABLE ${schema}.ideate_ideas
    ADD COLUMN IF NOT EXISTS approved_revision INTEGER;
ALTER TABLE ${schema}.ideate_ideas
    ADD COLUMN IF NOT EXISTS review_history JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_ideate_ideas_review_queue
    ON ${schema}.ideate_ideas (review_status, submitted_at DESC)
    WHERE deleted_at IS NULL AND review_status IS NOT NULL;
