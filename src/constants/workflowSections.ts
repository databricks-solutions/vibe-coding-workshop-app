/**
 * Workflow Sections Configuration
 * 
 * Defines the 7 logical groupings of the 30 workflow steps.
 * Each section has a chapter, title, focus, description, and the steps it contains.
 * 
 * 4-Chapter Structure:
 * - Ch1: Databricks App (UI Design, Deploy App)
 * - Ch2: Lakebase (Setup Lakebase, Wire UI, Deploy and Test)
 * - Ch3: Lakehouse (Bronze/Silver/Gold pipelines)
 * - Ch4: Data Intelligence (Dashboards, Genie, Agents, Wire UI to Agent)
 * 
 * Build: 2026-01-31T08:30:00Z
 */

import { 
  Database, 
  Brain, 
  Rocket,
  Sparkles,
  FolderGit2,
  FileText,
  Palette,
  Server,
  Link2,
  Play,
  Table2,
  GitBranch,
  FlaskConical,
  Shield,
  Merge,
  BarChart3,
  MessageSquareText,
  Bot,
  LayoutDashboard,
  RefreshCw,
  Target,
  Globe,
  HardDrive,
  Plug,
  Search,
  BookOpen,
  FileCode,
  Tag,
  ShieldCheck
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface WorkflowStep {
  number: number;
  title: string;
  icon: LucideIcon;
  color: string;
  sectionTag?: string;
}

export interface WorkflowSection {
  id: string;
  chapter: string;
  title: string;
  focus: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  borderColor: string;
  steps: WorkflowStep[];
}

// Workshop Level Types - 4-column structure
export type WorkshopLevel = 'app-only' | 'app-database' | 'lakehouse' | 'lakehouse-di' | 'end-to-end' | 'accelerator' | 'genie-accelerator' | 'data-engineering-accelerator' | 'skills-accelerator';

// ---------------------------------------------------------------------------
// Feature flag for the Agent Skills Accelerator
// ---------------------------------------------------------------------------
export type AcceleratorStatus = 'enabled' | 'beta' | 'coming-soon';
export const SKILLS_ACCELERATOR_STATUS: AcceleratorStatus = 'beta';

// ---------------------------------------------------------------------------
// Use-case-driven path lock: selecting certain use cases auto-locks the
// workshop level so the user cannot switch tracks.
// ---------------------------------------------------------------------------
export const USE_CASE_LEVEL_LOCK: Partial<Record<string, WorkshopLevel>> = {
  build_skill: 'skills-accelerator',
};

// Level configuration with descriptions
export interface LevelConfig {
  label: string;
  tooltip: string;
  description: string;
  sectionIds: string[];
}

export const WORKSHOP_LEVELS: Record<WorkshopLevel, LevelConfig> = {
  'app-only': {
    label: 'Databricks Apps',
    tooltip: 'Build and deploy a web app on Databricks Apps',
    description: 'Build and deploy a web application using Databricks Apps.',
    sectionIds: ['define-usecase', 'databricks-app', 'iterate-enhance'],
  },
  'app-database': {
    label: '+ Lakebase',
    tooltip: 'Add a PostgreSQL database to your web app',
    description: 'Connect your Databricks App to a PostgreSQL database for data persistence.',
    sectionIds: ['define-usecase', 'databricks-app', 'lakebase', 'iterate-enhance'],
  },
  'lakehouse': {
    label: 'Lakehouse',
    tooltip: 'Build Bronze/Silver/Gold data pipelines',
    description: 'Build a Lakehouse data foundation with Bronze, Silver, and Gold layer pipelines.',
    sectionIds: ['define-usecase', 'lakehouse', 'iterate-enhance'],
  },
  'lakehouse-di': {
    label: '+ Data Intelligence',
    tooltip: 'Add Genie Spaces, Agents & AI/BI Dashboards',
    description: 'Add AI capabilities with Genie Spaces, Agents & AI/BI Dashboards on top of your Lakehouse.',
    sectionIds: ['define-usecase', 'lakehouse', 'data-intelligence', 'iterate-enhance'],
  },
  'end-to-end': {
    label: 'Complete Workshop',
    tooltip: 'All chapters: App, Database, Lakehouse & Data Intelligence',
    description: 'The full end-to-end workshop covering every chapter — from Databricks App to Data Intelligence.',
    sectionIds: ['define-usecase', 'databricks-app', 'lakebase', 'lakehouse', 'data-intelligence', 'iterate-enhance'],
  },
  'accelerator': {
    label: 'Data Product Accelerator',
    tooltip: 'Focus on Lakehouse + Data Intelligence',
    description: 'Start with table metadata and build end-to-end Bronze/Silver/Gold layers that power your data intelligence.',
    sectionIds: ['define-usecase', 'lakehouse', 'data-intelligence', 'iterate-enhance'],
  },
  'genie-accelerator': {
    label: 'Genie Accelerator',
    tooltip: 'Analyze silver metadata, build Gold layer, and create Genie Spaces',
    description: 'Analyze your silver layer metadata, design and build a Gold layer, then create Genie Spaces with Metric Views and TVFs.',
    sectionIds: ['define-usecase', 'lakehouse', 'data-intelligence', 'iterate-enhance'],
  },
  'data-engineering-accelerator': {
    label: 'Data Engineering Accelerator',
    tooltip: 'Build Bronze/Silver/Gold data pipelines with best practices',
    description: 'Focus on building production-ready Bronze, Silver, and Gold data pipelines using Databricks Lakehouse best practices.',
    sectionIds: ['define-usecase', 'lakehouse', 'iterate-enhance'],
  },
  'skills-accelerator': {
    label: 'Agent Skills Accelerator',
    tooltip: 'Build a custom Agent Skill guided by your use case',
    description: 'Learn to build an Agent Skill following the agentskills.io standard — explore existing skills, define a strategy, generate SKILL.md, apply it, and validate.',
    sectionIds: ['define-usecase', 'agent-skills', 'iterate-enhance'],
  },
};

// Define all steps with their properties (21 total steps)
// IMPORTANT: sectionTag must match exactly with backend section_input_prompts.section_tag
export const ALL_STEPS: Record<number, WorkflowStep> = {
  // Step 1: Define Your Intent (standalone top-level section, not part of Foundation workflow)
  1: { number: 1, title: 'Define Your Intent', icon: Sparkles, color: 'text-primary', sectionTag: 'usecase_selection' },
  2: { number: 2, title: 'Set Up Project', icon: FolderGit2, color: 'text-orange-400', sectionTag: 'project_setup' },
  3: { number: 3, title: 'PRD Generation', icon: FileText, color: 'text-indigo-400', sectionTag: 'prd_generation' },
  
  // Section: Chapter 1 - Databricks App (Steps 4-5)
  4: { number: 4, title: 'UI Design', icon: Palette, color: 'text-purple-400', sectionTag: 'cursor_copilot_ui_design' },
  5: { number: 5, title: 'Deploy App', icon: Rocket, color: 'text-green-400', sectionTag: 'deploy_databricks_app' },
  
  // Section: Chapter 2 - Lakebase (Steps 6-8)
  6: { number: 6, title: 'Setup Lakebase', icon: Server, color: 'text-cyan-400', sectionTag: 'setup_lakebase' },
  7: { number: 7, title: 'Wire UI to Lakebase', icon: Link2, color: 'text-teal-400', sectionTag: 'wire_ui_lakebase' },
  8: { number: 8, title: 'Deploy and Test', icon: Play, color: 'text-lime-400', sectionTag: 'workspace_setup_deploy' },
  
  // Section: Chapter 3 - Lakehouse (Steps 9-14)
  // NOTE: Step 9 only shows when Lakebase (Chapter 2) is in the workflow
  9: { number: 9, title: 'Register Lakebase in UC', icon: Database, color: 'text-cyan-500', sectionTag: 'sync_from_lakebase' },
  10: { number: 10, title: 'Bring your Metadata', icon: Table2, color: 'text-amber-400', sectionTag: 'bronze_table_metadata' },
  11: { number: 11, title: 'Gold Layer Design', icon: GitBranch, color: 'text-yellow-400', sectionTag: 'gold_layer_design' },
  12: { number: 12, title: 'Bronze Layer Creation', icon: FlaskConical, color: 'text-orange-400', sectionTag: 'bronze_layer_creation' },
  13: { number: 13, title: 'Silver Layer', icon: Shield, color: 'text-slate-400', sectionTag: 'silver_layer_sdp' },
  14: { number: 14, title: 'Gold Pipeline', icon: Merge, color: 'text-amber-500', sectionTag: 'gold_layer_pipeline' },
  
  // Section: Chapter 4 - Data Intelligence (Steps 15-19)
  15: { number: 15, title: 'Use-Case Plan', icon: BarChart3, color: 'text-violet-400', sectionTag: 'usecase_plan' },
  16: { number: 16, title: 'AI/BI Dashboard', icon: LayoutDashboard, color: 'text-emerald-400', sectionTag: 'aibi_dashboard' },
  17: { number: 17, title: 'Genie Space', icon: MessageSquareText, color: 'text-cyan-400', sectionTag: 'genie_space' },
  18: { number: 18, title: 'Build Agent', icon: Bot, color: 'text-blue-400', sectionTag: 'agent_framework' },
  19: { number: 19, title: 'Wire UI to Agent', icon: Plug, color: 'text-teal-400', sectionTag: 'wire_ui_agent' },
  
  // Section: Refinement (Steps 20-21)
  20: { number: 20, title: 'Iterate & Enhance', icon: Rocket, color: 'text-pink-400', sectionTag: 'iterate_enhance' },
  21: { number: 21, title: 'Redeploy & Test', icon: RefreshCw, color: 'text-red-400', sectionTag: 'redeploy_test' },

  // Genie Accelerator - Step 22 (lives in Lakehouse section, only visible for genie-accelerator path)
  22: { number: 22, title: 'Analyze Silver Metadata', icon: Search, color: 'text-amber-300', sectionTag: 'genie_silver_metadata' },

  // Deployment & Optimization (Steps 23-25)
  23: { number: 23, title: 'Deploy Assets', icon: Rocket, color: 'text-emerald-400', sectionTag: 'deploy_lakehouse_assets' },
  24: { number: 24, title: 'Deploy Assets', icon: Rocket, color: 'text-violet-400', sectionTag: 'deploy_di_assets' },
  25: { number: 25, title: 'Optimize Genie', icon: Sparkles, color: 'text-amber-400', sectionTag: 'optimize_genie' },

  // Agent Skills Accelerator (Steps 26-30)
  26: { number: 26, title: 'Explore Existing Skills', icon: BookOpen, color: 'text-violet-400', sectionTag: 'skill_install_explore' },
  27: { number: 27, title: 'Define Skill Strategy', icon: FileText, color: 'text-indigo-400', sectionTag: 'skill_define_strategy' },
  28: { number: 28, title: 'Create SKILL.md', icon: FileCode, color: 'text-purple-400', sectionTag: 'skill_create_skillmd' },
  29: { number: 29, title: 'Apply & Test Skill', icon: Tag, color: 'text-teal-400', sectionTag: 'skill_apply_contracts' },
  30: { number: 30, title: 'Validate & Automate', icon: ShieldCheck, color: 'text-emerald-400', sectionTag: 'skill_certify_tables' },
};

// The 6 logical sections with their step groupings (new 4-chapter structure)
export const WORKFLOW_SECTIONS: WorkflowSection[] = [
  {
    id: 'define-usecase',
    chapter: 'Foundation',
    title: 'Project Setup',
    focus: 'Configure your environment and generate product requirements',
    description: 'Set up your development environment with the template repository and generate a focused Product Requirements Document (PRD) that guides all subsequent development.',
    icon: Target,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/15',
    borderColor: 'border-blue-500/30',
    steps: [2, 3].map(n => ALL_STEPS[n]),
  },
  {
    id: 'databricks-app',
    chapter: '',
    title: 'Databricks App',
    focus: 'Design user interface and deploy to Databricks Apps',
    description: 'Build the frontend of your application. You\'ll design the user interface using AI-assisted tools, test locally, and deploy your first working Databricks App.',
    icon: Globe,
    color: 'text-red-400',
    bgColor: 'bg-red-500/15',
    borderColor: 'border-red-500/30',
    steps: [4, 5].map(n => ALL_STEPS[n]),
  },
  {
    id: 'lakebase',
    chapter: '',
    title: 'Lakebase',
    focus: 'Set up PostgreSQL database, connect to your app, and deploy',
    description: 'Add data persistence to your application. You\'ll set up Lakebase as your PostgreSQL backend, wire the UI to pull data from the database, and deploy your working Databricks App.',
    icon: HardDrive,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/15',
    borderColor: 'border-violet-500/30',
    steps: [6, 7, 8].map(n => ALL_STEPS[n]),
  },
  {
    id: 'lakehouse',
    chapter: '',
    title: 'Lakehouse',
    focus: 'Data foundation, modeling, and pipelines',
    description: 'Build the data backbone of your solution. You\'ll extract metadata, create data dictionaries, clone source tables, and build Bronze → Silver → Gold layer pipelines following Databricks best practices.',
    icon: Database,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/15',
    borderColor: 'border-amber-500/30',
    steps: [9, 10, 22, 12, 13, 11, 14, 23].map(n => ALL_STEPS[n]),
  },
  {
    id: 'data-intelligence',
    chapter: '',
    title: 'Data Intelligence',
    focus: 'Translating data into insights, logic, and decisions',
    description: 'Convert raw data into actionable intelligence. You\'ll build Genie Spaces with Metric Views and TVFs, create AI agents using the Databricks Agent Framework, and build AI/BI dashboards.',
    icon: Brain,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/15',
    borderColor: 'border-cyan-500/30',
    steps: [15, 16, 17, 24, 25, 18, 19].map(n => ALL_STEPS[n]),
  },
  {
    id: 'agent-skills',
    chapter: 'Workshop',
    title: 'Build Agent Skill',
    focus: 'Build a custom Agent Skill guided by your use case',
    description: 'Explore existing skills, define your skill strategy, generate a complete SKILL.md package, apply and test it, then validate and automate.',
    icon: BookOpen,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/15',
    borderColor: 'border-violet-500/30',
    steps: [26, 27, 28, 29, 30].map(n => ALL_STEPS[n]),
  },
  {
    id: 'iterate-enhance',
    chapter: 'Refinement',
    title: 'Iterate & Enhance',
    focus: 'Continuous improvement, testing, and optimization',
    description: 'Ensure the solution evolves through feedback, redeployment, and enhancement. You\'ll iterate to add new features and improvements, then redeploy and test the complete application.',
    icon: Rocket,
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/15',
    borderColor: 'border-pink-500/30',
    steps: [20, 21].map(n => ALL_STEPS[n]),
  },
];

// Helper to find which section a step belongs to
export function getSectionForStep(stepNumber: number): WorkflowSection | null {
  return WORKFLOW_SECTIONS.find(section => 
    section.steps.some(step => step.number === stepNumber)
  ) || null;
}

// Helper to get section index for a step
// Build version for cache busting
export const BUILD_VERSION = '2026-01-31-chapter-restructure';

// Map old level values to new ones for backwards compatibility
export function normalizeLevel(level: string): WorkshopLevel {
  switch (level) {
    case '100-ui': return 'app-only';
    case '100-lakebase': return 'app-database';
    case '200-lakehouse': return 'end-to-end';
    case '200-di': return 'end-to-end';
    case '200': return 'end-to-end';
    case '300': return 'end-to-end';
    default: return level as WorkshopLevel;
  }
}

// Helper to get filtered sections based on workshop level.
// Optional `overrides` supplies cumulative sectionIds / chapterVisibility
// when a user has progressed across columns (e.g. app-database → lakehouse).
export function getFilteredSections(
  level: WorkshopLevel,
  disabledSectionTags: Set<string> = new Set(),
  overrides?: { sectionIds: string[]; chapterVisibility: Set<'ch1' | 'ch2' | 'ch3' | 'ch4'> },
): WorkflowSection[] {
  const normalizedLevel = normalizeLevel(level);
  const levelConfig = WORKSHOP_LEVELS[normalizedLevel];
  const sectionIds = overrides?.sectionIds ?? levelConfig.sectionIds;
  const chapterVisibility = overrides?.chapterVisibility ?? CHAPTER_VISIBILITY[normalizedLevel];
  
  const isGenie = normalizedLevel === 'genie-accelerator';
  const isSkillsAccelerator = normalizedLevel === 'skills-accelerator';

  let filtered = WORKFLOW_SECTIONS
    .filter(section => sectionIds.includes(section.id))
    .map(section => {
      // Skills Accelerator: remove PRD step from foundation
      if (section.id === 'define-usecase' && isSkillsAccelerator) {
        return {
          ...section,
          steps: section.steps.filter(step => step.number !== 3),
        };
      }
      // Genie Accelerator: lakehouse section shows only steps 22, 11, 14, 23
      if (section.id === 'lakehouse' && isGenie) {
        return {
          ...section,
          steps: section.steps.filter(step => [22, 11, 14, 23].includes(step.number))
        };
      }
      // Genie Accelerator: data-intelligence section shows only steps 15, 17, 24, 25
      if (section.id === 'data-intelligence' && isGenie) {
        return {
          ...section,
          steps: section.steps.filter(step => [15, 17, 24, 25].includes(step.number))
        };
      }
      // Non-genie paths: always hide step 22 and conditionally hide step 9
      if (section.id === 'lakehouse' && !isGenie) {
        let steps = section.steps.filter(step => step.number !== 22);
        if (!chapterVisibility.has('ch2')) {
          steps = steps.filter(step => step.number !== 9);
        }
        return { ...section, steps };
      }
      // Exclude step 19 (Wire UI to Agent) when there is no UI being built (ch1 not in path)
      if (section.id === 'data-intelligence' && !chapterVisibility.has('ch1')) {
        return {
          ...section,
          steps: section.steps.filter(step => step.number !== 19)
        };
      }
      return section;
    });

  if (disabledSectionTags.size > 0) {
    filtered = filtered
      .map(section => ({
        ...section,
        steps: section.steps.filter(s => !s.sectionTag || !disabledSectionTags.has(s.sectionTag))
      }))
      .filter(section => section.steps.length > 0);
  }

  return filtered;
}

// Chapter visibility for Learning Objectives
export const CHAPTER_VISIBILITY: Record<WorkshopLevel, Set<'ch1' | 'ch2' | 'ch3' | 'ch4'>> = {
  'app-only': new Set(['ch1']),
  'app-database': new Set(['ch1', 'ch2']),
  'lakehouse': new Set(['ch3']),
  'lakehouse-di': new Set(['ch3', 'ch4']),
  'end-to-end': new Set(['ch1', 'ch2', 'ch3', 'ch4']),
  'accelerator': new Set(['ch3', 'ch4']),
  'genie-accelerator': new Set(['ch3', 'ch4']),
  'data-engineering-accelerator': new Set(['ch3']),
  'skills-accelerator': new Set([]),
};

// Architecture visibility for diagram sections
export const ARCH_VISIBILITY: Record<WorkshopLevel, { ch1: boolean; ch2: boolean; ch3: boolean; ch4: boolean }> = {
  'app-only': { ch1: true, ch2: false, ch3: false, ch4: false },
  'app-database': { ch1: true, ch2: true, ch3: false, ch4: false },
  'lakehouse': { ch1: false, ch2: false, ch3: true, ch4: false },
  'lakehouse-di': { ch1: false, ch2: false, ch3: true, ch4: true },
  'end-to-end': { ch1: true, ch2: true, ch3: true, ch4: true },
  'accelerator': { ch1: false, ch2: false, ch3: true, ch4: true },
  'genie-accelerator': { ch1: false, ch2: false, ch3: true, ch4: true },
  'data-engineering-accelerator': { ch1: false, ch2: false, ch3: true, ch4: false },
  'skills-accelerator': { ch1: false, ch2: false, ch3: false, ch4: false },
};

// ---------------------------------------------------------------------------
// Per-level UI overrides -- centralised config for level-specific UI behaviour.
// Only levels that deviate from defaults need entries.
// Add new optional fields to the interface as new per-level tweaks arise.
// ---------------------------------------------------------------------------
export interface LevelUIOverrides {
  defaultUseCaseMode?: 'library' | 'custom';
}

export const LEVEL_UI_OVERRIDES: Partial<Record<WorkshopLevel, LevelUIOverrides>> = {
  'genie-accelerator': {
    defaultUseCaseMode: 'custom',
  },
  'skills-accelerator': {
    defaultUseCaseMode: 'library',
  },
};

export function getLevelUIOverrides(level: WorkshopLevel): LevelUIOverrides {
  return LEVEL_UI_OVERRIDES[level] ?? {};
}

// ---------------------------------------------------------------------------
// Progressive path expansion: forward-only chains using existing levels.
// Users can incrementally add capabilities but never go back.
// ---------------------------------------------------------------------------

const APP_CHAIN: WorkshopLevel[] = ['app-only', 'app-database', 'lakehouse', 'lakehouse-di'];
const LAKEHOUSE_CHAIN: WorkshopLevel[] = ['lakehouse', 'lakehouse-di'];
export const PROGRESSION_CHAINS: WorkshopLevel[][] = [APP_CHAIN, LAKEHOUSE_CHAIN];

const APP_LAKEBASE_STEPS = new Set([4, 5, 6, 7, 8]);

/**
 * Determine which progression chain a user is on, using completedSteps
 * to disambiguate when `lakehouse` / `lakehouse-di` appear in both chains.
 */
export function getActiveChain(
  level: WorkshopLevel,
  completedSteps: Set<number>,
): WorkshopLevel[] | null {
  if (level === 'app-only' || level === 'app-database') return APP_CHAIN;
  if (level === 'lakehouse' || level === 'lakehouse-di') {
    for (const s of APP_LAKEBASE_STEPS) {
      if (completedSteps.has(s)) return APP_CHAIN;
    }
    return LAKEHOUSE_CHAIN;
  }
  return null;
}

export function isOnProgressiveChain(level: WorkshopLevel): boolean {
  return PROGRESSION_CHAINS.some(chain => chain.includes(level));
}

export function isForwardProgression(
  from: WorkshopLevel,
  to: WorkshopLevel,
): boolean {
  for (const chain of PROGRESSION_CHAINS) {
    const fi = chain.indexOf(from);
    const ti = chain.indexOf(to);
    if (fi !== -1 && ti !== -1 && ti > fi) return true;
  }
  return false;
}

export function getNextLevel(
  current: WorkshopLevel,
  completedSteps: Set<number>,
): WorkshopLevel | null {
  const chain = getActiveChain(current, completedSteps);
  if (!chain) return null;
  const idx = chain.indexOf(current);
  return idx !== -1 && idx < chain.length - 1 ? chain[idx + 1] : null;
}

// ---------------------------------------------------------------------------
// Cumulative section overrides for the app-chain cross-column bridge.
// When someone progresses from app-database → lakehouse, the lakehouse level
// normally drops app+lakebase sections. These helpers compute the union of
// all prior chain levels' sectionIds and chapterVisibility so those sections
// remain visible.
// ---------------------------------------------------------------------------

export interface CumulativeOverrides {
  sectionIds: string[];
  chapterVisibility: Set<'ch1' | 'ch2' | 'ch3' | 'ch4'>;
  archVisibility: { ch1: boolean; ch2: boolean; ch3: boolean; ch4: boolean };
}

export function getCumulativeOverrides(
  level: WorkshopLevel,
  completedSteps: Set<number>,
): CumulativeOverrides | null {
  const chain = getActiveChain(level, completedSteps);
  if (!chain || chain === LAKEHOUSE_CHAIN) return null;

  const idx = chain.indexOf(level);
  if (idx <= 1) return null; // app-only and app-database don't need overrides

  const sectionIdSet = new Set<string>();
  const chVis = new Set<'ch1' | 'ch2' | 'ch3' | 'ch4'>();
  const aVis = { ch1: false, ch2: false, ch3: false, ch4: false };

  for (let i = 0; i <= idx; i++) {
    const l = chain[i];
    for (const sid of WORKSHOP_LEVELS[l].sectionIds) sectionIdSet.add(sid);
    for (const ch of CHAPTER_VISIBILITY[l]) chVis.add(ch);
    const av = ARCH_VISIBILITY[l];
    if (av.ch1) aVis.ch1 = true;
    if (av.ch2) aVis.ch2 = true;
    if (av.ch3) aVis.ch3 = true;
    if (av.ch4) aVis.ch4 = true;
  }

  return { sectionIds: Array.from(sectionIdSet), chapterVisibility: chVis, archVisibility: aVis };
}
