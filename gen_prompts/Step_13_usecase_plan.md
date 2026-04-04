Perform project planning using @data_product_accelerator/skills/planning/00-project-planning/SKILL.md with planning_mode: workshop

This will involve the following steps:

- **Analyze Gold layer** — examine your completed Gold tables to identify natural business domains, key relationships, and analytical questions
- **Generate use-case plans** — create structured plans organized as Phase 1 addendums (1.2 TVFs, 1.3 Metric Views, 1.4 Monitors, 1.5 Dashboards, 1.6 Genie Spaces, 1.7 Alerts, 1.1 ML Models)
- **Produce YAML manifests** — generate 4 machine-readable manifest files (semantic-layer, observability, ML, GenAI agents) as contracts for downstream implementation stages
- **Apply workshop mode caps** — enforce hard limits (3-5 TVFs, 1-2 Metric Views, 1 Genie Space) to keep the workshop focused on pattern variety over depth
- **Define deployment order** — establish build sequence: TVFs → Metric Views → Genie Spaces → Dashboards → Monitors → Alerts → Agents

If a PRD exists at @docs/design_prd.md, reference it for business requirements, user personas, and workflows.