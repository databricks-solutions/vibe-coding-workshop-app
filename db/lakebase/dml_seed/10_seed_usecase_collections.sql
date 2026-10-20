-- =============================================================================
-- SEED: horizontal use case collections (PostgreSQL/Lakebase)
-- =============================================================================
-- Business-function and technical-solution shells for the Use Case Library.
-- They start disabled and empty; admins cross-list or author use cases into
-- them, then switch them on. ON CONFLICT DO NOTHING keeps admin edits intact,
-- so this file is safe to re-run on every deploy.
-- Variable: ${schema} - replaced at runtime
-- =============================================================================

INSERT INTO ${schema}.usecase_collections (collection_id, kind, label, description, icon, color, display_order, is_enabled, updated_by) VALUES
('office_of_cfo', 'function', 'Office of the CFO', 'Finance plays: close acceleration, forecasting, spend intelligence and margin analytics.', 'Calculator', 'violet', 1, FALSE, 'seed'),
('office_of_cmo', 'function', 'Office of the CMO', 'Marketing plays: audience building, campaign attribution, personalization and brand health.', 'Megaphone', 'rose', 2, FALSE, 'seed'),
('office_of_coo', 'function', 'Office of the COO', 'Operations plays: supply chain resilience, workforce planning and operational visibility.', 'Cog', 'amber', 3, FALSE, 'seed'),
('office_of_chro', 'function', 'Office of the CHRO', 'People plays: talent insights, attrition risk, workforce analytics and employee experience.', 'UsersRound', 'emerald', 4, FALSE, 'seed'),
('data_integration', 'solution', 'Data Integration', 'Ingest, unify and model data from operational systems into governed, analytics-ready tables.', 'Workflow', 'sky', 1, FALSE, 'seed'),
('observability', 'solution', 'Observability', 'Monitor pipelines, models and applications with lineage-aware health, cost and quality signals.', 'Activity', 'cyan', 2, FALSE, 'seed')
ON CONFLICT (collection_id) DO NOTHING;

-- Home of every use case contributed through contrib/. Starts enabled so the
-- sample contribution is visible on a fresh install; admins can switch it off.
INSERT INTO ${schema}.usecase_collections (collection_id, kind, label, description, icon, color, display_order, is_enabled, updated_by) VALUES
('community_contributions', 'solution', 'Partner & Community', 'Use cases contributed by partners, companies, groups and individuals.', 'Handshake', 'teal', 1, TRUE, 'seed')
ON CONFLICT (collection_id) DO NOTHING;
