-- Optional featured resource displayed with a use case.
-- Kept on every version so Library flag/metadata updates remain simple and
-- restoring an older description does not unexpectedly drop the resource.

ALTER TABLE ${schema}.usecase_descriptions
    ADD COLUMN IF NOT EXISTS resource_url TEXT;

ALTER TABLE ${schema}.usecase_descriptions
    ADD COLUMN IF NOT EXISTS resource_label VARCHAR(120);

COMMENT ON COLUMN ${schema}.usecase_descriptions.resource_url IS
'Optional HTTPS recording, document, presentation, spreadsheet, or supporting web resource.';

COMMENT ON COLUMN ${schema}.usecase_descriptions.resource_label IS
'Optional display label for resource_url.';
