-- What a catalog use case is typically worth and where the money comes from.
-- Written when an Ideate idea is submitted with its business case ('submitted'),
-- or derived once from the use case description by the model ('derived').
-- The app also creates this table at runtime (src/backend/api/value_profiles.py).

CREATE TABLE IF NOT EXISTS ${schema}.usecase_value_profiles (
    industry VARCHAR(100) NOT NULL,
    use_case VARCHAR(100) NOT NULL,
    profile JSONB NOT NULL,
    source VARCHAR(20) NOT NULL DEFAULT 'derived',
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (industry, use_case)
);
