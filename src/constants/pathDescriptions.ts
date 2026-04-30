import type { WorkshopLevel } from './workflowSections';

export interface PathDescription {
  tagline: string;
  techStack: string[];
  bullets: string[];
  estimatedMinutes: number;
  accentColor: 'violet' | 'emerald' | 'amber' | 'primary';
}

export const PATH_DESCRIPTIONS: Record<WorkshopLevel, PathDescription> = {
  'app-only': {
    tagline: 'From PRD to deployed web app in one session',
    techStack: ['Databricks Apps', 'React / Gradio / Streamlit'],
    bullets: [
      'Generate a focused Product Requirements Document (PRD) from your use case',
      'Design the UI with AI-assisted code generation',
      'Deploy a live Databricks App accessible via URL',
    ],
    estimatedMinutes: 30,
    accentColor: 'violet',
  },

  'app-database': {
    tagline: 'A full-stack app backed by a managed PostgreSQL database',
    techStack: ['Databricks Apps', 'Lakebase (PostgreSQL)'],
    bullets: [
      'Generate a PRD and design the UI with AI-assisted tooling',
      'Deploy your app to Databricks Apps',
      'Provision a Lakebase PostgreSQL instance with schema and seed data',
      'Wire the UI to read/write from Lakebase and redeploy',
    ],
    estimatedMinutes: 45,
    accentColor: 'violet',
  },

  'lakehouse': {
    tagline: 'Build a production data foundation with Bronze, Silver, and Gold',
    techStack: ['Unity Catalog', 'Spark Declarative Pipelines', 'Delta Lake'],
    bullets: [
      'Import source table metadata and design a target Gold layer schema',
      'Create Bronze tables from raw/external data sources',
      'Apply data quality rules with Spark Declarative Pipelines to produce Silver',
      'Build Gold-layer aggregations and deploy the Lakehouse assets',
    ],
    estimatedMinutes: 45,
    accentColor: 'violet',
  },

  'lakehouse-di': {
    tagline: 'Data pipelines plus AI-powered analytics and agents',
    techStack: ['Unity Catalog', 'SDP', 'Delta Lake', 'Genie Spaces', 'AI/BI Dashboards', 'Agent Framework'],
    bullets: [
      'Build Bronze, Silver, and Gold data pipelines with SDP',
      'Define Metric Views and Table Value Functions (TVFs) for your semantic layer',
      'Create a Genie Space for natural-language analytics over governed data',
      'Build an AI/BI Dashboard for self-serve visualization',
      'Deploy an AI agent using the Databricks Agent Framework',
    ],
    estimatedMinutes: 75,
    accentColor: 'violet',
  },

  'end-to-end': {
    tagline: 'The full Databricks platform, end to end — app to AI',
    techStack: ['Databricks Apps', 'Lakebase', 'Unity Catalog', 'SDP', 'Genie Spaces', 'AI/BI Dashboards', 'Agent Framework'],
    bullets: [
      'Deploy a Databricks App and connect it to Lakebase PostgreSQL',
      'Sync operational data into the Lakehouse and build Bronze/Silver/Gold pipelines',
      'Create Metric Views, TVFs, and a Genie Space for governed analytics',
      'Build AI/BI Dashboards and deploy an AI agent',
      'Wire the agent back into your app for end-user interaction',
    ],
    estimatedMinutes: 120,
    accentColor: 'primary',
  },

  'accelerator': {
    tagline: 'From table metadata to AI-ready Gold layers and agents',
    techStack: ['Unity Catalog', 'SDP', 'Delta Lake', 'Genie Spaces', 'AI/BI Dashboards', 'Agent Framework'],
    bullets: [
      'Import existing table metadata (schema, types, relationships)',
      'Design and build Gold layer pipelines from Bronze through Silver',
      'Define Metric Views and TVFs as a governed semantic layer',
      'Create a Genie Space and AI/BI Dashboard powered by Gold data',
      'Deploy an AI agent that queries your curated data product',
    ],
    estimatedMinutes: 60,
    accentColor: 'amber',
  },

  'genie-accelerator': {
    tagline: 'Analyze Silver metadata, design Gold, and ship a Genie Space',
    techStack: ['Unity Catalog', 'Delta Lake', 'Metric Views', 'TVFs', 'Genie Spaces'],
    bullets: [
      'Extract and analyze comprehensive metadata from your Silver layer schema',
      'Design a Gold layer schema with business-aligned aggregations',
      'Build the Gold pipeline with quality enforcement',
      'Define Metric Views (YAML-syntax) and TVFs for the semantic layer',
      'Create and optimize a Genie Space with governed natural-language queries',
    ],
    estimatedMinutes: 45,
    accentColor: 'amber',
  },

  'data-engineering-accelerator': {
    tagline: 'Production-ready data pipelines following Lakehouse best practices',
    techStack: ['Unity Catalog', 'Spark Declarative Pipelines', 'Delta Lake'],
    bullets: [
      'Import source metadata and plan your target data model',
      'Create Bronze tables from raw ingestion sources',
      'Apply schema enforcement and data quality via SDP to produce Silver',
      'Build Gold-layer business aggregations and deploy all Lakehouse assets',
    ],
    estimatedMinutes: 45,
    accentColor: 'amber',
  },

  'skills-accelerator': {
    tagline: 'Build a custom Agent Skill following the agentskills.io standard',
    techStack: ['Agent Skills SDK', 'SKILL.md', 'Unity Catalog Tags'],
    bullets: [
      'Explore existing Agent Skills in the template repository',
      'Define a skill strategy document aligned to your use case',
      'Generate a complete SKILL.md package (instructions, references, assets)',
      'Apply the skill to target tables and validate data contracts',
      'Build an automation pipeline for continuous compliance validation',
    ],
    estimatedMinutes: 45,
    accentColor: 'amber',
  },

  'agents-accelerator': {
    tagline: 'Ship a production AI agent — from app scaffold to MLflow lifecycle',
    techStack: ['Databricks Apps', 'Lakebase', 'OpenAI Agents SDK', 'Agent Framework', 'MLflow 3', 'Unity Catalog'],
    bullets: [
      'Deploy a Databricks App + Lakebase foundation with UC resources and volumes',
      'Enable MLflow tracing with UC OTel Delta tables for observability',
      'Clone the OpenAI Agents SDK template and wire selected tools (optionally Genie, Knowledge Assistant, UC Functions, MCP) with OBO auth and Lakebase memory',
      'Evaluate with scorers and judges, deploy via AI Gateway, and capture chat feedback through AppKit',
    ],
    estimatedMinutes: 90,
    accentColor: 'amber',
  },

  'reverse-lakehouse': {
    tagline: 'Build data pipelines designed to feed downstream analytics apps',
    techStack: ['Unity Catalog', 'SDP', 'Delta Lake'],
    bullets: [
      'Import source metadata and design a Gold schema optimized for reverse sync',
      'Build Bronze and Silver pipelines with data quality enforcement',
      'Create Gold-layer tables that will power downstream Synced Tables',
    ],
    estimatedMinutes: 45,
    accentColor: 'emerald',
  },

  'reverse-lakehouse-di': {
    tagline: 'Gold-layer analytics and Genie Spaces, ready for reverse sync',
    techStack: ['Unity Catalog', 'SDP', 'Genie Spaces', 'Metric Views', 'TVFs', 'AI/BI Dashboards'],
    bullets: [
      'Build Bronze, Silver, and Gold data pipelines',
      'Define Metric Views and TVFs as a governed semantic layer',
      'Create a Genie Space and AI/BI Dashboard over Gold data',
      'Prepare curated Gold tables for Synced Table downstream sync',
    ],
    estimatedMinutes: 60,
    accentColor: 'emerald',
  },

  'reverse-lakebase': {
    tagline: 'Push Gold data into Lakebase via Synced Tables',
    techStack: ['Unity Catalog', 'SDP', 'Synced Tables', 'Lakebase (PostgreSQL)', 'Genie Spaces'],
    bullets: [
      'Build the full Lakehouse (Bronze/Silver/Gold) with Genie and Dashboards',
      'Plan which Gold assets to sync into Lakebase PostgreSQL',
      'Create Synced Tables via the Databricks Postgres REST API',
      'Verify row counts and healthy sync state',
    ],
    estimatedMinutes: 75,
    accentColor: 'emerald',
  },

  'reverse-app': {
    tagline: 'A complete reverse ETL pipeline — Lakehouse to analytics app',
    techStack: ['Unity Catalog', 'SDP', 'Synced Tables', 'Lakebase', 'Databricks Apps', 'Genie Spaces'],
    bullets: [
      'Build the Lakehouse and AI layers (Bronze through Genie Spaces)',
      'Sync Gold data into Lakebase using Synced Tables',
      'Design and build an analytics app powered by synced Lakebase data',
      'Wire the app to Lakebase + embed a Genie Space for conversational analytics',
      'Deploy and validate the end-to-end reverse ETL pipeline',
    ],
    estimatedMinutes: 90,
    accentColor: 'emerald',
  },
};
