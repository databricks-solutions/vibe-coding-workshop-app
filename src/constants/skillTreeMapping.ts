/**
 * Skill Blueprint Mapping — Hybrid Static + Dynamic
 *
 * Static SKILL_BLUEPRINTS provides the full multi-tier traversal for known steps
 * (orchestrators, workers, commons, references — all tiers).
 *
 * Dynamic buildSkillBlueprint() serves as a fallback for any new steps added to
 * the database that aren't yet in the static map. It parses @-references from
 * the input_template and builds a basic blueprint automatically.
 *
 * The traversal follows a 4-tier hierarchy:
 *   Tier 1: AGENTS.md → Skill Navigator → Always-on Commons
 *   Tier 2: Stage Orchestrator (or Direct Skill / Agent Prompt)
 *   Tier 3: Workers + Stage-specific Commons
 *   Tier 4: Reference files (deep-dive patterns)
 */

export type SkillType =
  | 'entry'
  | 'router'
  | 'orchestrator'
  | 'worker'
  | 'common'
  | 'admin'
  | 'agent-prompt'
  | 'reference'
  | 'manifest'
  | 'input';

export type BlueprintVariant =
  | 'orchestrator-cascade'
  | 'direct-skills'
  | 'agent-prompt';

export interface SkillItem {
  name: string;
  shortPath: string;
  type: SkillType;
  description?: string;
}

export interface SkillSection {
  tier: 1 | 2 | 3 | 4;
  label: string;
  description?: string;
  accent: string;
  skills: SkillItem[];
}

export interface SkillBlueprintConfig {
  variant: BlueprintVariant;
  stageLabel: string;
  summary: string;
  sections: SkillSection[];
  consumes?: string;
  emits?: string[];
}

// ---------------------------------------------------------------------------
// Always-on Foundation (Tier 1) — identical for every invocation
// ---------------------------------------------------------------------------
export const TIER1_FOUNDATION: SkillSection = {
  tier: 1,
  label: 'Foundation — Always Loaded',
  accent: 'cyan',
  skills: [
    { name: 'AGENTS.md', shortPath: 'AGENTS.md', type: 'entry', description: 'Universal entry point — auto-loaded by the IDE for every task' },
    { name: 'Skill Navigator', shortPath: 'data_product_accelerator/AGENTS.md', type: 'router', description: 'Keyword detection routes to the correct stage orchestrator' },
    { name: 'Expert Agent', shortPath: 'common/databricks-expert-agent', type: 'common', description: 'Core "Extract, Don\'t Generate" principle — loaded for every stage' },
    { name: 'Naming & Tagging Standards', shortPath: 'common/naming-tagging-standards', type: 'common', description: 'Enterprise naming conventions — loaded for every stage' },
  ],
};

// ---------------------------------------------------------------------------
// Reusable common skills (referenced by multiple stages)
// ---------------------------------------------------------------------------
const C_DAB: SkillItem = { name: 'Asset Bundles', shortPath: 'common/databricks-asset-bundles', type: 'common', description: 'Teaches the agent how to package and deploy your code using Databricks Asset Bundles' };
const C_AUTO_OPS: SkillItem = { name: 'Autonomous Operations', shortPath: 'common/databricks-autonomous-operations', type: 'common', description: 'Gives the agent a self-healing loop — deploy, check, diagnose, and auto-fix errors' };
const C_TABLE_PROPS: SkillItem = { name: 'Table Properties', shortPath: 'common/databricks-table-properties', type: 'common', description: 'Ensures every table gets production-grade settings like clustering and change tracking' };
const C_SCHEMA_MGMT: SkillItem = { name: 'Schema Management', shortPath: 'common/schema-management-patterns', type: 'common', description: 'Handles schema creation with proper governance tags and ownership' };
const C_PY_IMPORTS: SkillItem = { name: 'Python Imports', shortPath: 'common/databricks-python-imports', type: 'common', description: 'Guides the agent to write reusable Python modules shared across notebooks' };
const C_UC_CONSTRAINTS: SkillItem = { name: 'UC Constraints', shortPath: 'common/unity-catalog-constraints', type: 'common', description: 'Teaches primary key and foreign key constraint patterns for data integrity' };

// ---------------------------------------------------------------------------
// SKILL_BLUEPRINTS — full traversal for known skill-connected steps
// ---------------------------------------------------------------------------
export const SKILL_BLUEPRINTS: Record<string, SkillBlueprintConfig> = {

  // Step 11: Gold Layer Design
  gold_layer_design: {
    variant: 'orchestrator-cascade',
    stageLabel: 'Stage 1: Gold Design',
    summary: 'The agent reads your schema CSV, then cascades through the Gold Design orchestrator which coordinates 7 specialized workers to produce YAML schemas, ERD diagrams, and lineage documentation.',
    sections: [
      { tier: 2, label: 'Stage Coordinator', description: 'Loaded first — reads your inputs and decides which skills to activate', accent: 'purple', skills: [
        { name: 'Gold Layer Design Orchestrator', shortPath: 'gold/00-gold-layer-design', type: 'orchestrator', description: 'Reads context/*.csv schema input, then dispatches to 7 design workers in phased execution' },
      ]},
      { tier: 2, label: 'Input', description: 'Your data files that feed into the pipeline as starting context', accent: 'amber', skills: [
        { name: 'Customer Schema CSV', shortPath: 'context/*.csv', type: 'input', description: 'Your source schema file — the starting input for the entire design pipeline' },
      ]},
      { tier: 3, label: 'Specialist Workers', description: 'Dispatched by the orchestrator to handle specific tasks', accent: 'gold', skills: [
        { name: 'Grain Definition', shortPath: 'gold/design-workers/01-grain-definition', type: 'worker', description: 'Grain patterns for fact tables (Phase 2)' },
        { name: 'Dimension Patterns', shortPath: 'gold/design-workers/02-dimension-patterns', type: 'worker', description: 'SCD1, SCD2, conformed dimensions (Phase 2)' },
        { name: 'Fact Table Patterns', shortPath: 'gold/design-workers/03-fact-table-patterns', type: 'worker', description: 'Transactional, periodic, accumulating (Phase 2)' },
        { name: 'Conformed Dimensions', shortPath: 'gold/design-workers/04-conformed-dimensions', type: 'worker', description: 'Cross-domain conformed dimension patterns (Phase 2)' },
        { name: 'ERD Diagrams', shortPath: 'gold/design-workers/05-erd-diagrams', type: 'worker', description: 'Mermaid ERD diagram syntax and organization (Phase 3)' },
        { name: 'Table Documentation', shortPath: 'gold/design-workers/06-table-documentation', type: 'worker', description: 'Dual-purpose business + technical docs (Phase 4)' },
        { name: 'Design Validation', shortPath: 'gold/design-workers/07-design-validation', type: 'worker', description: 'Cross-checks YAML, ERD, lineage consistency (Phase 8)' },
      ]},
      { tier: 4, label: 'Deep-Dive Reference', description: 'Detailed documentation pulled in by a worker when it needs specific patterns', accent: 'orange', skills: [
        { name: 'ERD Patterns Reference', shortPath: 'gold/design-workers/05-erd-diagrams/references/erd-patterns.md', type: 'reference', description: 'Detailed Mermaid syntax patterns — loaded by 05-erd-diagrams worker (~4K tokens)' },
      ]},
    ],
    emits: ['gold_layer_design/yaml/*.yaml', 'gold_layer_design/COLUMN_LINEAGE.csv'],
  },

  genie_gold_design: {
    variant: 'orchestrator-cascade',
    stageLabel: 'Stage 1: Gold Design',
    summary: 'The agent reads your schema CSV, then cascades through the Gold Design orchestrator which coordinates 7 specialized workers to produce YAML schemas, ERD diagrams, and lineage documentation.',
    sections: [
      { tier: 2, label: 'Stage Coordinator', description: 'Loaded first — reads your inputs and decides which skills to activate', accent: 'purple', skills: [
        { name: 'Gold Layer Design Orchestrator', shortPath: 'gold/00-gold-layer-design', type: 'orchestrator', description: 'Reads context/*.csv schema input, then dispatches to 7 design workers in phased execution' },
      ]},
      { tier: 2, label: 'Input', description: 'Your data files that feed into the pipeline as starting context', accent: 'amber', skills: [
        { name: 'Customer Schema CSV', shortPath: 'context/*.csv', type: 'input', description: 'Your source schema file — the starting input for the entire design pipeline' },
      ]},
      { tier: 3, label: 'Specialist Workers', description: 'Dispatched by the orchestrator to handle specific tasks', accent: 'gold', skills: [
        { name: 'Grain Definition', shortPath: 'gold/design-workers/01-grain-definition', type: 'worker', description: 'Grain patterns for fact tables (Phase 2)' },
        { name: 'Dimension Patterns', shortPath: 'gold/design-workers/02-dimension-patterns', type: 'worker', description: 'SCD1, SCD2, conformed dimensions (Phase 2)' },
        { name: 'Fact Table Patterns', shortPath: 'gold/design-workers/03-fact-table-patterns', type: 'worker', description: 'Transactional, periodic, accumulating (Phase 2)' },
        { name: 'Conformed Dimensions', shortPath: 'gold/design-workers/04-conformed-dimensions', type: 'worker', description: 'Cross-domain conformed dimension patterns (Phase 2)' },
        { name: 'ERD Diagrams', shortPath: 'gold/design-workers/05-erd-diagrams', type: 'worker', description: 'Mermaid ERD diagram syntax and organization (Phase 3)' },
        { name: 'Table Documentation', shortPath: 'gold/design-workers/06-table-documentation', type: 'worker', description: 'Dual-purpose business + technical docs (Phase 4)' },
        { name: 'Design Validation', shortPath: 'gold/design-workers/07-design-validation', type: 'worker', description: 'Cross-checks YAML, ERD, lineage consistency (Phase 8)' },
      ]},
      { tier: 4, label: 'Deep-Dive Reference', description: 'Detailed documentation pulled in by a worker when it needs specific patterns', accent: 'orange', skills: [
        { name: 'ERD Patterns Reference', shortPath: 'gold/design-workers/05-erd-diagrams/references/erd-patterns.md', type: 'reference', description: 'Detailed Mermaid syntax patterns — loaded by 05-erd-diagrams worker (~4K tokens)' },
      ]},
    ],
    emits: ['gold_layer_design/yaml/*.yaml', 'gold_layer_design/COLUMN_LINEAGE.csv'],
  },

  // Step 12 (Clone mode): Bronze Layer
  bronze_layer_creation: {
    variant: 'orchestrator-cascade',
    stageLabel: 'Stage 2: Bronze',
    summary: 'The agent loads the Bronze orchestrator which first pulls in 5 common skill dependencies, then generates clone scripts with enterprise best practices applied automatically.',
    sections: [
      { tier: 2, label: 'Stage Coordinator', description: 'Loaded first — reads your inputs and decides which skills to activate', accent: 'purple', skills: [
        { name: 'Bronze Layer Setup Orchestrator', shortPath: 'bronze/00-bronze-layer-setup', type: 'orchestrator', description: 'Detects clone approach (A/B/C) and activates the appropriate workflow, loading its shared dependencies first' },
      ]},
      { tier: 3, label: 'Shared Tools', description: 'Reusable skills loaded by the orchestrator — shared across stages, activated only when this stage needs them', accent: 'emerald', skills: [C_DAB, C_TABLE_PROPS, C_SCHEMA_MGMT, C_PY_IMPORTS, C_AUTO_OPS] },
    ],
  },

  // Step 12 (Generate mode): same Bronze orchestrator
  bronze_layer_creation_upload: {
    variant: 'orchestrator-cascade',
    stageLabel: 'Stage 2: Bronze',
    summary: 'The agent loads the Bronze orchestrator which generates DDLs and Faker test data from your uploaded schema CSV.',
    sections: [
      { tier: 2, label: 'Stage Coordinator', description: 'Loaded first — reads your inputs and decides which skills to activate', accent: 'purple', skills: [
        { name: 'Bronze Layer Setup Orchestrator', shortPath: 'bronze/00-bronze-layer-setup', type: 'orchestrator', description: 'Parses schema CSV, activates Approach A workflow, and loads its shared dependencies' },
      ]},
      { tier: 3, label: 'Shared Tools', description: 'Reusable skills loaded by the orchestrator — shared across stages, activated only when this stage needs them', accent: 'emerald', skills: [C_DAB, C_TABLE_PROPS, C_SCHEMA_MGMT, C_PY_IMPORTS, C_AUTO_OPS] },
      { tier: 3, label: 'Specialist Workers', description: 'Dispatched by the orchestrator to handle specific tasks', accent: 'gold', skills: [
        { name: 'Faker Data Generation', shortPath: 'bronze/workers/01-faker-data-generation', type: 'worker', description: 'Generates realistic test data with seeded Faker, non-linear distributions, 5% corruption rate' },
      ]},
    ],
  },

  // Step 13: Silver Layer
  silver_layer_sdp: {
    variant: 'orchestrator-cascade',
    stageLabel: 'Stage 3: Silver',
    summary: 'The agent loads the Silver orchestrator which adds unity-catalog-constraints to the commons, then dispatches to 2 DQ workers for streaming ingestion with runtime-updateable data quality rules.',
    sections: [
      { tier: 2, label: 'Stage Coordinator', description: 'Loaded first — reads your inputs and decides which skills to activate', accent: 'purple', skills: [
        { name: 'Silver Layer Setup Orchestrator', shortPath: 'silver/00-silver-layer-setup', type: 'orchestrator', description: 'Activates the SDP pipeline with DQ rules stored in Delta tables (not hardcoded in notebooks)' },
      ]},
      { tier: 3, label: 'Shared Tools', description: 'Reusable skills loaded by the orchestrator — shared across stages, activated only when this stage needs them', accent: 'emerald', skills: [C_DAB, C_TABLE_PROPS, C_PY_IMPORTS, C_UC_CONSTRAINTS, C_SCHEMA_MGMT, C_AUTO_OPS] },
      { tier: 3, label: 'Specialist Workers', description: 'Dispatched by the orchestrator to handle specific tasks', accent: 'gold', skills: [
        { name: 'DLT Expectations Patterns', shortPath: 'silver/workers/01-dlt-expectations-patterns', type: 'worker', description: 'Portable DQ rules stored in Unity Catalog Delta tables' },
        { name: 'DQX Patterns', shortPath: 'silver/workers/02-dqx-patterns', type: 'worker', description: 'Advanced DQX framework validation with detailed failure diagnostics' },
      ]},
    ],
  },

  // Step 14: Gold Pipeline
  gold_layer_pipeline: {
    variant: 'orchestrator-cascade',
    stageLabel: 'Stage 4: Gold Implementation',
    summary: 'The agent loads the Gold Implementation orchestrator which reads your YAML schemas (from the Design step) and dispatches 5 workers for DDL generation, merge patterns, deduplication, and validation.',
    sections: [
      { tier: 2, label: 'Stage Coordinator', description: 'Loaded first — reads your inputs and decides which skills to activate', accent: 'purple', skills: [
        { name: 'Gold Layer Setup Orchestrator', shortPath: 'gold/01-gold-layer-setup', type: 'orchestrator', description: 'YAML-driven approach — reads gold_layer_design/yaml/ as the single source of truth for all table schemas' },
      ]},
      { tier: 3, label: 'Shared Tools', description: 'Reusable skills loaded by the orchestrator — shared across stages, activated only when this stage needs them', accent: 'emerald', skills: [C_DAB, C_TABLE_PROPS, C_UC_CONSTRAINTS, C_SCHEMA_MGMT, C_PY_IMPORTS, C_AUTO_OPS] },
      { tier: 3, label: 'Specialist Workers', description: 'Dispatched by the orchestrator to handle specific tasks', accent: 'gold', skills: [
        { name: 'YAML Table Setup', shortPath: 'gold/pipeline-workers/01-yaml-table-setup', type: 'worker', description: 'Reads YAML schemas and generates CREATE TABLE DDL with PKs' },
        { name: 'Merge Patterns', shortPath: 'gold/pipeline-workers/02-merge-patterns', type: 'worker', description: 'SCD Type 1/2 dimensions, fact table MERGE operations' },
        { name: 'Deduplication', shortPath: 'gold/pipeline-workers/03-deduplication', type: 'worker', description: 'Prevents DELTA_MULTIPLE_SOURCE_ROW_MATCHING errors' },
        { name: 'Grain Validation', shortPath: 'gold/pipeline-workers/04-grain-validation', type: 'worker', description: 'Validates grain before populating fact tables' },
        { name: 'Schema Validation', shortPath: 'gold/pipeline-workers/05-schema-validation', type: 'worker', description: 'Validates schemas before deployment' },
      ]},
      { tier: 4, label: 'Deep-Dive Reference', description: 'Detailed documentation pulled in by a worker when it needs specific patterns', accent: 'orange', skills: [
        { name: 'Merge SQL Patterns', shortPath: 'gold/pipeline-workers/02-merge-patterns/references/merge-sql-patterns.md', type: 'reference', description: 'SCD Type 1/2, accumulating snapshots, factless fact MERGE SQL — loaded by 02-merge-patterns worker' },
      ]},
    ],
    consumes: 'gold_layer_design/yaml/*.yaml',
  },

  // Step 15: Use-Case Plan
  usecase_plan: {
    variant: 'orchestrator-cascade',
    stageLabel: 'Stage 5: Planning',
    summary: 'The agent loads the Project Planning orchestrator which reads Gold YAML outputs and generates 4 YAML manifests — the Plan-as-Contract handoff to all downstream stages.',
    sections: [
      { tier: 2, label: 'Stage Coordinator', description: 'Loaded first — reads your Gold outputs and plans downstream stages', accent: 'purple', skills: [
        { name: 'Project Planning Orchestrator', shortPath: 'planning/00-project-planning', type: 'orchestrator', description: 'Workshop mode produces capped artifacts (3-5 TVFs, 1-2 MVs, 1 Genie Space) and 4 YAML manifests for downstream stages' },
      ]},
    ],
    consumes: 'gold_layer_design/yaml/*.yaml',
    emits: ['plans/manifests/semantic-layer-manifest.yaml', 'plans/manifests/observability-manifest.yaml', 'plans/manifests/ml-manifest.yaml', 'plans/manifests/genai-agents-manifest.yaml'],
  },

  // Step 16: AI/BI Dashboard
  aibi_dashboard: {
    variant: 'direct-skills',
    stageLabel: 'Stage 7: Observability (Worker)',
    summary: 'This prompt directly invokes the AI/BI Dashboard worker skill (from Stage 7 Observability). The agent reads your dashboard plan, then generates JSON templates, widgets, and deployment scripts.',
    sections: [
      { tier: 2, label: 'Direct Skill', description: 'Invoked directly by the prompt — no orchestrator needed for this step', accent: 'purple', skills: [
        { name: 'AI/BI Dashboard Skill', shortPath: 'monitoring/02-databricks-aibi-dashboards', type: 'worker', description: 'Complete Lakeview JSON templates, widget specs, grid layout, query patterns, and UPDATE-or-CREATE deployment' },
      ]},
      { tier: 3, label: 'Shared Tools', description: 'Reusable skills loaded alongside the direct skill — shared across stages', accent: 'emerald', skills: [C_DAB, C_PY_IMPORTS, C_AUTO_OPS] },
    ],
    consumes: 'plans/phase1-addendum-1.5-aibi-dashboards.md',
  },

  // Step 17: Genie Space
  genie_space: {
    variant: 'orchestrator-cascade',
    stageLabel: 'Stage 6: Semantic Layer',
    summary: 'The agent loads the Semantic Layer orchestrator which first reads your manifest, then dispatches 5 workers in phase order: Metric Views → TVFs → Genie Space → API Export → Optimization.',
    sections: [
      { tier: 2, label: 'Stage Coordinator', description: 'Loaded first — reads your manifest and decides which skills to activate', accent: 'purple', skills: [
        { name: 'Semantic Layer Setup Orchestrator', shortPath: 'semantic-layer/00-semantic-layer-setup', type: 'orchestrator', description: 'Phase 0: reads semantic-layer-manifest.yaml, then executes 5 phases in strict order' },
      ]},
      { tier: 3, label: 'Shared Tools', description: 'Reusable skills loaded by the orchestrator — shared across stages, activated only when this stage needs them', accent: 'emerald', skills: [C_DAB, C_PY_IMPORTS, C_AUTO_OPS] },
      { tier: 3, label: 'Specialist Workers', description: 'Dispatched by the orchestrator to handle specific tasks', accent: 'gold', skills: [
        { name: 'Metric View Patterns', shortPath: 'semantic-layer/01-metric-views-patterns', type: 'worker', description: 'WITH METRICS LANGUAGE YAML syntax, schema validation, join patterns' },
        { name: 'Table-Valued Functions', shortPath: 'semantic-layer/02-databricks-table-valued-functions', type: 'worker', description: 'STRING params, v3.0 comments, Top-N via ROW_NUMBER, SCD2 handling' },
        { name: 'Genie Space Patterns', shortPath: 'semantic-layer/03-genie-space-patterns', type: 'worker', description: '7-section deliverable, General Instructions ≤20 lines, 10+ benchmarks' },
        { name: 'Export/Import API', shortPath: 'semantic-layer/04-genie-space-export-import-api', type: 'worker', description: 'REST API JSON schema for programmatic CI/CD deployment' },
      ]},
    ],
    consumes: 'plans/manifests/semantic-layer-manifest.yaml',
  },

  // Step 18: Build Agent
  agent_framework: {
    variant: 'agent-prompt',
    stageLabel: 'Agent Framework',
    summary: 'This prompt references an agent build prompt (outside the skill hierarchy) to construct a multi-agent orchestrator that queries data through your Genie Spaces.',
    sections: [
      { tier: 2, label: 'Agent Prompt File', accent: 'violet', skills: [
        { name: 'Multi-Agent Build Prompt', shortPath: 'agentic-framework/agents/multi-agent-build-prompt.md', type: 'agent-prompt', description: 'Analyzes your PRD and UI designs to build a multi-agent orchestrator with agentic search capabilities' },
      ]},
    ],
    consumes: 'docs/design_prd.md',
  },

  // Step 19: Wire UI to Agent
  wire_ui_agent: {
    variant: 'agent-prompt',
    stageLabel: 'Agent Framework',
    summary: 'This prompt references the agent UI wiring prompt to connect your frontend to the Agent serving endpoint for end-to-end natural language search.',
    sections: [
      { tier: 2, label: 'Agent Prompt File', accent: 'violet', skills: [
        { name: 'Agent UI Wiring Prompt', shortPath: 'agentic-framework/agents/agent-ui-wiring-prompt.md', type: 'agent-prompt', description: 'Connects the web application frontend to the Agent serving endpoint built in the previous step' },
      ]},
    ],
  },

  // Step 21: Redeploy & Test
  redeploy_test: {
    variant: 'direct-skills',
    stageLabel: 'Deployment + Documentation',
    summary: 'The agent reads 2 common skills for self-healing deployment, then a separate prompt triggers the documentation skill to generate comprehensive repo documentation.',
    sections: [
      { tier: 2, label: 'Deployment Skills', accent: 'cyan', skills: [
        { ...C_AUTO_OPS, description: 'Deploy → poll → diagnose → fix loop with exponential backoff and error-solution matrix' },
        { ...C_DAB, description: 'Bundle validation, serverless environments, and proper task types' },
      ]},
      { tier: 2, label: 'Documentation Skill', accent: 'amber', skills: [
        { name: 'Documentation Organization', shortPath: 'admin/documentation-organization', type: 'admin', description: 'Framework Documentation Authoring mode — generates numbered docs under docs/ with a 43-item quality checklist' },
      ]},
    ],
  },

  // Step 23: Deploy Lakehouse Assets
  deploy_lakehouse_assets: {
    variant: 'direct-skills',
    stageLabel: 'Lakehouse Deployment',
    summary: 'The agent reads 2 skills to deploy and run all Bronze, Silver, and Gold layer jobs end-to-end with dependency ordering and self-healing when failures occur.',
    sections: [
      { tier: 2, label: 'Deployment Skills', accent: 'cyan', skills: [
        { ...C_DAB, description: 'Validates bundle structure, serverless environments, dependency-ordered execution' },
        { ...C_AUTO_OPS, description: 'Deploy → poll → diagnose → fix loop for each job in the deployment sequence' },
      ]},
    ],
  },

  // Step 24: Deploy DI Assets
  deploy_di_assets: {
    variant: 'direct-skills',
    stageLabel: 'Data Intelligence Deployment',
    summary: 'The agent reads 2 skills to deploy all Data Intelligence assets (TVFs, Metric Views, Genie Spaces, Dashboards) in mandatory order with Genie API integration.',
    sections: [
      { tier: 2, label: 'Deployment Skills', accent: 'cyan', skills: [
        { ...C_DAB, description: 'Bundle validation, serverless environments, and proper task types' },
        { name: 'Genie Export/Import API', shortPath: 'semantic-layer/04-genie-space-export-import-api', type: 'worker', description: 'JSON schema, ID generation, array sorting, and variable substitution for Genie Space deployment' },
      ]},
    ],
  },

  // Step 25: Optimize Genie
  optimize_genie: {
    variant: 'orchestrator-cascade',
    stageLabel: 'Stage 6b: Genie Optimization',
    summary: 'The agent loads the Genie Optimization orchestrator which evaluates benchmark accuracy with 8 scorers and tunes 6 control levers until quality targets are met.',
    sections: [
      { tier: 2, label: 'Stage Coordinator', description: 'Loaded first — sets up the optimization experiment and routes to workers', accent: 'purple', skills: [
        { name: 'Genie Optimization Orchestrator', shortPath: 'semantic-layer/05-genie-optimization-orchestrator', type: 'orchestrator', description: 'Resolves CLI profile, sets up MLflow experiment, routes to workers with mandatory session state persistence' },
      ]},
      { tier: 3, label: 'Specialist Workers', description: 'Dispatched by the orchestrator to handle specific tasks', accent: 'gold', skills: [
        { name: 'Benchmark Generator', shortPath: 'semantic-layer/genie-optimization-workers/01-genie-benchmark-generator', type: 'worker', description: 'Create/validate benchmarks, sync to MLflow dataset' },
        { name: 'Benchmark Evaluator', shortPath: 'semantic-layer/genie-optimization-workers/02-genie-benchmark-evaluator', type: 'worker', description: '8 scorers via mlflow.genai.evaluate(), eval scopes (full/slice/P0/held-out)' },
        { name: 'Metadata Optimizer', shortPath: 'semantic-layer/genie-optimization-workers/03-genie-metadata-optimizer', type: 'worker', description: 'Lever-aware analysis (L1-L5 targeted, L6 GEPA), 6 control levers' },
        { name: 'Optimization Applier', shortPath: 'semantic-layer/genie-optimization-workers/04-genie-optimization-applier', type: 'worker', description: 'Dual persistence — Genie API + repo files, rollback on regression' },
      ]},
    ],
  },
};

// ---------------------------------------------------------------------------
// Dynamic fallback — parses @-references from input_template
// ---------------------------------------------------------------------------

interface ParsedRef {
  rawPath: string;
  type: SkillType;
  tier: 2 | 3 | 4;
  domain: string;
  name: string;
  shortPath: string;
}

const DOMAIN_LABELS: Record<string, string> = {
  gold: 'Gold Layer', silver: 'Silver Layer', bronze: 'Bronze Layer',
  planning: 'Planning', monitoring: 'Observability', 'semantic-layer': 'Semantic Layer',
  common: 'Common Skills', admin: 'Admin',
};

function humanize(slug: string): string {
  return slug.replace(/^\d+-/, '').split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function classifyReference(rawPath: string): ParsedRef | null {
  const skillMatch = rawPath.match(/data_product_accelerator\/skills\/([\w-]+)\/([\w-]+(?:\/[\w-]+)*)\/SKILL\.md$/);
  if (skillMatch) {
    const [, domain, skillPath] = skillMatch;
    const leafSlug = skillPath.split('/').pop()!;
    const name = humanize(leafSlug);
    const shortPath = `${domain}/${skillPath}`;
    if (domain === 'common') return { rawPath, type: 'common', tier: 3, domain, name, shortPath };
    if (domain === 'admin') return { rawPath, type: 'admin', tier: 3, domain, name, shortPath };
    const isOrchestrator = /^00-/.test(leafSlug);
    return { rawPath, type: isOrchestrator ? 'orchestrator' : 'worker', tier: isOrchestrator ? 2 : 3, domain, name, shortPath };
  }

  const agentMatch = rawPath.match(/(?:vibe-coding-workshop-template\/)?agentic-framework\/agents\/([\w-]+)\.md$/);
  if (agentMatch) {
    const slug = agentMatch[1];
    return { rawPath, type: 'agent-prompt', tier: 2, domain: 'agent', name: humanize(slug), shortPath: `agentic-framework/agents/${slug}.md` };
  }

  const planMatch = rawPath.match(/data_product_accelerator\/plans\/([\w.-]+\.md)$/);
  if (planMatch) return { rawPath, type: 'reference', tier: 4, domain: 'plans', name: humanize(planMatch[1].replace(/\.md$/, '')), shortPath: `plans/${planMatch[1]}` };

  const contextMatch = rawPath.match(/data_product_accelerator\/context\/([\w{}_.*-]+\.\w+)$/);
  if (contextMatch) return { rawPath, type: 'input', tier: 2, domain: 'context', name: 'Schema CSV', shortPath: `context/${contextMatch[1]}` };

  const docsMatch = rawPath.match(/docs\/([\w_.-]+\.md)$/);
  if (docsMatch) return { rawPath, type: 'reference', tier: 4, domain: 'docs', name: humanize(docsMatch[1].replace(/\.md$/, '')), shortPath: `docs/${docsMatch[1]}` };

  return null;
}

function parseSkillReferences(template: string): ParsedRef[] {
  const regex = /@([\w\-./{}*]+\.(?:md|csv))/g;
  const seen = new Set<string>();
  const refs: ParsedRef[] = [];
  let match;
  while ((match = regex.exec(template)) !== null) {
    const rawPath = match[1];
    if (seen.has(rawPath)) continue;
    seen.add(rawPath);
    const classified = classifyReference(rawPath);
    if (classified) refs.push(classified);
  }
  return refs;
}

export function buildSkillBlueprint(inputTemplate: string, sectionTag: string): SkillBlueprintConfig | null {
  const refs = parseSkillReferences(inputTemplate);
  const skillRefs = refs.filter(r => ['orchestrator', 'worker', 'common', 'admin', 'agent-prompt'].includes(r.type));
  if (skillRefs.length === 0) return null;

  const variant: BlueprintVariant = refs.some(r => r.type === 'agent-prompt') ? 'agent-prompt'
    : refs.some(r => r.type === 'orchestrator') ? 'orchestrator-cascade' : 'direct-skills';
  const stageLabel = sectionTag.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const sections: SkillSection[] = [];

  const orchestrators = refs.filter(r => r.type === 'orchestrator');
  if (orchestrators.length > 0) sections.push({ tier: 2, label: 'Stage Coordinator', description: 'Loaded first — reads your inputs and decides which skills to activate', accent: 'purple', skills: orchestrators.map(r => ({ name: r.name, shortPath: r.shortPath, type: r.type })) });
  const agentPrompts = refs.filter(r => r.type === 'agent-prompt');
  if (agentPrompts.length > 0) sections.push({ tier: 2, label: 'Agent Prompt File', description: 'A prompt template that guides the agent through a specific task', accent: 'violet', skills: agentPrompts.map(r => ({ name: r.name, shortPath: r.shortPath, type: r.type })) });
  const inputs = refs.filter(r => r.type === 'input');
  if (inputs.length > 0) sections.push({ tier: 2, label: 'Input', description: 'Your data files that feed into the pipeline as starting context', accent: 'amber', skills: inputs.map(r => ({ name: r.name, shortPath: r.shortPath, type: r.type })) });
  const commons = refs.filter(r => r.type === 'common');
  if (commons.length > 0) sections.push({ tier: 3, label: 'Shared Tools', description: 'Reusable skills loaded by the orchestrator — shared across stages, activated only when this stage needs them', accent: 'emerald', skills: commons.map(r => ({ name: r.name, shortPath: r.shortPath, type: r.type })) });
  const admins = refs.filter(r => r.type === 'admin');
  if (admins.length > 0) sections.push({ tier: 3, label: 'Admin Skills', description: 'Utility skills available on demand for maintenance tasks', accent: 'amber', skills: admins.map(r => ({ name: r.name, shortPath: r.shortPath, type: r.type })) });
  const workers = refs.filter(r => r.type === 'worker');
  if (workers.length > 0) {
    const domainGroups = new Map<string, ParsedRef[]>();
    for (const w of workers) { const g = domainGroups.get(w.domain) ?? []; g.push(w); domainGroups.set(w.domain, g); }
    for (const [domain, group] of domainGroups) {
      sections.push({ tier: 3, label: DOMAIN_LABELS[domain] ? `${DOMAIN_LABELS[domain]} Workers` : 'Specialist Workers', description: 'Dispatched by the orchestrator to handle specific tasks', accent: 'gold', skills: group.map(r => ({ name: r.name, shortPath: r.shortPath, type: r.type })) });
    }
  }
  const references = refs.filter(r => r.type === 'reference');
  if (references.length > 0) sections.push({ tier: 4, label: 'Deep-Dive Reference', description: 'Detailed documentation pulled in by a worker when it needs specific patterns', accent: 'orange', skills: references.map(r => ({ name: r.name, shortPath: r.shortPath, type: r.type })) });

  return { variant, stageLabel, summary: `This prompt references ${skillRefs.length} skill${skillRefs.length > 1 ? 's' : ''} that the agent loads to complete this step.`, sections };
}

/**
 * Hybrid lookup: static SKILL_BLUEPRINTS first (full traversal),
 * dynamic buildSkillBlueprint() as fallback for unlisted steps.
 */
export function getSkillBlueprint(sectionTag: string, inputTemplate?: string): SkillBlueprintConfig | null {
  if (SKILL_BLUEPRINTS[sectionTag]) return SKILL_BLUEPRINTS[sectionTag];
  if (inputTemplate) return buildSkillBlueprint(inputTemplate, sectionTag);
  return null;
}
