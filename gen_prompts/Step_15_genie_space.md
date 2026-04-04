Set up the semantic layer using @data_product_accelerator/skills/semantic-layer/00-semantic-layer-setup/SKILL.md

This will involve the following end-to-end workflow:

- **Read plan manifests** — extract TVF, Metric View, and Genie Space specifications from the semantic-layer-manifest.yaml (from Step 13 planning)
- **Create Metric Views** — build Metric Views using `WITH METRICS LANGUAGE YAML` syntax with dimensions, measures, 3-5 synonyms each, and format specifications
- **Create Table-Valued Functions (TVFs)** — write parameterized SQL functions with STRING date params (non-negotiable for Genie), v3.0 bullet-point COMMENTs, and ROW_NUMBER for Top-N patterns
- **Configure Genie Space** — set up natural language query interface with data assets (Metric Views → TVFs → Gold tables priority), General Instructions (≤20 lines), and ≥10 benchmark questions with exact expected SQL
- **Create JSON exports** — export Genie Space configuration as JSON for CI/CD deployment across environments
- **Optimize for accuracy** — run benchmark questions via Conversation API and tune 6 control levers until accuracy ≥95% and repeatability ≥90%

Implement in this order:

1. **Table-Valued Functions (TVFs)** — using plan at @data_product_accelerator/plans/phase1-addendum-1.2-tvfs.md
2. **Metric Views** — using plan at @data_product_accelerator/plans/phase1-addendum-1.3-metric-views.md
3. **Genie Space** — using plan at @data_product_accelerator/plans/phase1-addendum-1.6-genie-spaces.md
4. **Genie JSON Exports** — create export/import deployment jobs

The orchestrator skill automatically loads worker skills for TVFs, Metric Views, Genie Space patterns, and export/import API.