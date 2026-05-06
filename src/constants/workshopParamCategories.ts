/**
 * Workshop Parameter Categories
 *
 * Frontend-only grouping for the Workshop Parameters configuration screen.
 * Categories are organized by update cadence (set-once infra → per-event
 * customization → optional BYO agent tools) so admins can find the right
 * value to change without scrolling a flat list of 29 parameters.
 *
 * Adding a new param_key without updating this file is safe — unmapped keys
 * fall into the "Other" group and remain visible/editable.
 */

import type { ElementType } from 'react';
import {
  Globe,
  Database,
  Server,
  Layers,
  Palette,
  Wrench,
  HelpCircle,
} from 'lucide-react';

export type CadenceLabel =
  | 'Set once'
  | 'Per workshop'
  | 'Per session'
  | 'Optional / BYO';

/**
 * Tailwind class tokens used to render the chapter-band header. Mirrors the
 * `GROUP_STYLES` map in SectionInputsConfig.tsx so the two screens share the
 * same visual language.
 */
export interface CategoryStyle {
  bg: string;
  border: string;
  text: string;
  dot: string;
}

export interface CategoryMeta {
  id: string;
  label: string;
  description: string;
  icon: ElementType;
  cadence: CadenceLabel;
  defaultOpen: boolean;
  style: CategoryStyle;
}

export const CATEGORY_IDS = {
  workspace: 'workspace',
  deployment: 'deployment',
  lakehouse: 'lakehouse',
  participant: 'participant',
  agentTools: 'agent_tools',
  other: 'other',
} as const;

export const CATEGORY_ORDER: string[] = [
  CATEGORY_IDS.workspace,
  CATEGORY_IDS.deployment,
  CATEGORY_IDS.lakehouse,
  CATEGORY_IDS.participant,
  CATEGORY_IDS.agentTools,
  CATEGORY_IDS.other,
];

export const CATEGORY_META: Record<string, CategoryMeta> = {
  [CATEGORY_IDS.workspace]: {
    id: CATEGORY_IDS.workspace,
    label: 'Workspace, CLI & Compute',
    description: 'Workspace URL, CLI profile, default warehouse, and model serving endpoint. Set once at install.',
    icon: Globe,
    cadence: 'Set once',
    defaultOpen: false,
    style: { bg: 'bg-blue-500/8', border: 'border-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-500' },
  },
  [CATEGORY_IDS.deployment]: {
    id: CATEGORY_IDS.deployment,
    label: 'Lakebase & App Deployment',
    description: 'Lakebase Postgres instance, UC catalog, and Databricks App naming. Renaming requires redeploy.',
    icon: Server,
    cadence: 'Set once',
    defaultOpen: false,
    style: { bg: 'bg-violet-500/8', border: 'border-violet-500/20', text: 'text-violet-400', dot: 'bg-violet-500' },
  },
  [CATEGORY_IDS.lakehouse]: {
    id: CATEGORY_IDS.lakehouse,
    label: 'Lakehouse Data Layout',
    description: 'Default lakehouse catalog and the sample source catalog/schema used in Step 10. Users can override the source per session.',
    icon: Layers,
    cadence: 'Per session',
    defaultOpen: false,
    style: { bg: 'bg-amber-500/8', border: 'border-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-500' },
  },
  [CATEGORY_IDS.participant]: {
    id: CATEGORY_IDS.participant,
    label: 'Participant Experience',
    description: 'Branding URL and visible coding assistants. Customize per workshop or per customer.',
    icon: Palette,
    cadence: 'Per workshop',
    defaultOpen: false,
    style: { bg: 'bg-purple-500/8', border: 'border-purple-500/20', text: 'text-purple-400', dot: 'bg-purple-500' },
  },
  [CATEGORY_IDS.agentTools]: {
    id: CATEGORY_IDS.agentTools,
    label: 'Agent Tools (BYO, optional)',
    description: 'Inputs for Step 39 (Agent Tool Selection). Enable only the tool families you want — fill IDs for each.',
    icon: Wrench,
    cadence: 'Optional / BYO',
    defaultOpen: false,
    style: { bg: 'bg-cyan-500/8', border: 'border-cyan-500/20', text: 'text-cyan-400', dot: 'bg-cyan-500' },
  },
  [CATEGORY_IDS.other]: {
    id: CATEGORY_IDS.other,
    label: 'Other',
    description: 'Parameters not yet categorized. Update workshopParamCategories.ts to place them in a section.',
    icon: HelpCircle,
    cadence: 'Set once',
    defaultOpen: false,
    style: { bg: 'bg-secondary/40', border: 'border-border', text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  },
};

export interface ParamLocation {
  category: string;
  subgroup?: string;
}

/**
 * Sub-group order inside a category. Only Agent Tools uses sub-groups today.
 */
export const SUBGROUP_ORDER: Record<string, string[]> = {
  [CATEGORY_IDS.agentTools]: [
    'SQL MCP',
    'Genie',
    'Vector Search',
    'UC Functions',
    'External MCP',
  ],
};

/**
 * Authoritative mapping for every param_key seeded in
 * db/lakebase/dml_seed/03_seed_workshop_parameters.sql.
 *
 * If a key is missing here, categorizeParam() returns the "Other" bucket so
 * the param remains visible and editable in the UI.
 */
export const PARAM_KEY_TO_CATEGORY: Record<string, ParamLocation> = {
  // Workspace, CLI & Compute
  workspace_url: { category: CATEGORY_IDS.workspace },
  workspace_org_id: { category: CATEGORY_IDS.workspace },
  databricks_cli_profile: { category: CATEGORY_IDS.workspace },
  default_warehouse: { category: CATEGORY_IDS.workspace },
  model_serving_endpoint: { category: CATEGORY_IDS.workspace },

  // Lakebase & App Deployment
  lakebase_mode: { category: CATEGORY_IDS.deployment },
  lakebase_instance_name: { category: CATEGORY_IDS.deployment },
  lakebase_host_name: { category: CATEGORY_IDS.deployment },
  lakebase_uc_catalog_name: { category: CATEGORY_IDS.deployment },
  app_name: { category: CATEGORY_IDS.deployment },

  // Lakehouse Data Layout
  lakehouse_default_catalog: { category: CATEGORY_IDS.lakehouse },
  chapter_3_lakehouse_catalog: { category: CATEGORY_IDS.lakehouse },
  chapter_3_lakehouse_schema: { category: CATEGORY_IDS.lakehouse },

  // Participant Experience
  company_brand_url: { category: CATEGORY_IDS.participant },
  coding_assistants_config: { category: CATEGORY_IDS.participant },

  // Agent Tools - SQL MCP
  agent_tool_sql_mcp_enabled: { category: CATEGORY_IDS.agentTools, subgroup: 'SQL MCP' },
  agent_sql_catalog: { category: CATEGORY_IDS.agentTools, subgroup: 'SQL MCP' },
  agent_sql_schema: { category: CATEGORY_IDS.agentTools, subgroup: 'SQL MCP' },
  agent_sql_warehouse_id: { category: CATEGORY_IDS.agentTools, subgroup: 'SQL MCP' },
  agent_sql_table_scope: { category: CATEGORY_IDS.agentTools, subgroup: 'SQL MCP' },

  // Agent Tools - Genie
  agent_tool_genie_enabled: { category: CATEGORY_IDS.agentTools, subgroup: 'Genie' },
  genie_space_id: { category: CATEGORY_IDS.agentTools, subgroup: 'Genie' },

  // Agent Tools - Vector Search
  agent_tool_vector_search_enabled: { category: CATEGORY_IDS.agentTools, subgroup: 'Vector Search' },
  vs_endpoint: { category: CATEGORY_IDS.agentTools, subgroup: 'Vector Search' },
  vs_index: { category: CATEGORY_IDS.agentTools, subgroup: 'Vector Search' },

  // Agent Tools - UC Functions
  agent_tool_uc_functions_enabled: { category: CATEGORY_IDS.agentTools, subgroup: 'UC Functions' },
  uc_function_targets: { category: CATEGORY_IDS.agentTools, subgroup: 'UC Functions' },

  // Agent Tools - External MCP
  agent_tool_external_mcp_enabled: { category: CATEGORY_IDS.agentTools, subgroup: 'External MCP' },
  external_mcp_connection: { category: CATEGORY_IDS.agentTools, subgroup: 'External MCP' },
};

/**
 * Returns the category and (optional) sub-group for a param_key.
 * Unknown keys land in the "Other" bucket so they stay visible in the UI.
 */
export function categorizeParam(paramKey: string): ParamLocation {
  return PARAM_KEY_TO_CATEGORY[paramKey] ?? { category: CATEGORY_IDS.other };
}

/**
 * Optional icon override per individual param_key (used for the per-row icon
 * column inside a section). When undefined, the row falls back to the
 * `paramIcons` map keyed by param_type in WorkshopParametersConfig.tsx.
 */
export const PARAM_ICON_OVERRIDES: Record<string, ElementType> = {
  workspace_url: Globe,
  default_warehouse: Database,
};
