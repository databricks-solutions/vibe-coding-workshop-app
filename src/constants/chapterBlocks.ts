// ---------------------------------------------------------------------------
// Chapter block registry — the single source of truth for the "chapter"
// building blocks that the three Genie-facing surfaces compose from:
//
//   1. the persona chapter columns in the workshop-path selector
//      (LevelSelector's Lakehouse medallion + AI-and-Agents module chips),
//   2. the architecture flip-card's GenieAcceleratorPanel, and
//   3. the "Your Genie Accelerator Path" stage strip (LevelSelector).
//
// Before this registry each surface hand-authored its own copy of the same
// content (medallion layers, the Genie/Agent/Dashboard trio, the ontology
// sub-steps, the activation services), so a label or service edit had to be
// made in three places and routinely drifted. Now every surface reads the
// block title, icon, colours and service chips from here; each surface still
// owns its own layout (horizontal strip vs. vertical panel vs. toggle column)
// but the *content* is defined exactly once.
//
// Colours use the shared strip/flip-card grammar (a slate-800 box with a
// coloured border, a coloured title, coloured sub-chips and a coloured
// connector arrow) so the strip and the flip card read identically.
// ---------------------------------------------------------------------------

import type { LucideIcon } from 'lucide-react';
import { Database, FileCode, Brain, Globe, Rocket, MessageSquareText, Bot, LayoutDashboard } from 'lucide-react';
import type { ServiceKey } from '../components/ServicePopover';

/** Active-chip colour tokens shared by the persona selectors and the Genie
 *  path (rendered by ModuleChip). `box` = the pill bg+border, `icon` = the
 *  icon colour when the chip is "on". */
export interface ChipTone {
  box: string;
  icon: string;
}

/** A single service sub-chip inside a chapter block. */
export interface ServiceChip {
  /** Short label shown on the chip (curated to fit the tight layouts). */
  label: string;
  /** Drives the ServicePopover click-for-details / chat surface. */
  serviceKey: ServiceKey;
  /** Optional icon — used by the interactive persona columns; the strip and
   *  flip-card chips are text-only and ignore it. */
  icon?: LucideIcon;
  /** Optional toggle id — set when this chip maps to an interactive toggle in
   *  a persona column (medallion layer id, or AI module id). */
  toggleId?: string;
  /** Optional per-chip active colour override (e.g. the per-layer medallion
   *  palette). When absent, chips fall back to the block's accent chip tone. */
  chipTone?: ChipTone;
}

/** The shared box/border/chip/arrow colour grammar for a block. */
export interface ChapterBlockColors {
  title: string;
  border: string;
  chip: string;
  chipText: string;
  arrow: string;
}

export type ChapterBlockId =
  | 'lakehouse'
  | 'semantic-layer'
  | 'ai-agents'
  | 'ontology'
  | 'activation';

/** The shared "module" presentation tokens (used by ModuleBox/ModuleChip):
 *  the tinted inner container and the default chip tone for the block. Common
 *  modules and the Genie path both read these so they render identically. */
export interface BlockAccent {
  /** Tinted inner container classes, e.g. 'border-cyan-500/30 bg-cyan-500/[0.05]'. */
  container: string;
  /** Default active chip tone for this block's chips. */
  chip: ChipTone;
}

export interface ChapterBlock {
  id: ChapterBlockId;
  title: string;
  icon: LucideIcon;
  colors: ChapterBlockColors;
  /** Shared module-surface tokens (tinted container + default chip tone). */
  accent: BlockAccent;
  services: ServiceChip[];
}

export const CHAPTER_BLOCKS: Record<ChapterBlockId, ChapterBlock> = {
  lakehouse: {
    id: 'lakehouse',
    title: 'Lakehouse',
    icon: Database,
    colors: {
      title: 'text-teal-300',
      border: 'border-teal-500/60',
      chip: 'bg-teal-900/30 border-teal-500/30 hover:bg-teal-900/50 hover:border-teal-400',
      chipText: 'text-teal-200',
      arrow: 'text-teal-400',
    },
    // Teal tinted container (matches the persona Lakehouse column); chips carry
    // their own per-layer palette below so Bronze/Silver/Gold match the
    // interactive medallion selector one-for-one.
    accent: {
      container: 'border-teal-500/30 bg-teal-500/[0.05]',
      chip: { box: 'bg-teal-500/15 border-teal-500/50', icon: 'text-teal-400' },
    },
    services: [
      { label: 'Bronze', serviceKey: 'bronze', toggleId: 'bronze', chipTone: { box: 'bg-orange-500/15 border-orange-500/50', icon: 'text-orange-400' } },
      { label: 'Silver', serviceKey: 'silver', toggleId: 'silver', chipTone: { box: 'bg-slate-300/15 border-slate-300/50', icon: 'text-slate-200' } },
      { label: 'Gold', serviceKey: 'gold', toggleId: 'gold', chipTone: { box: 'bg-amber-400/15 border-amber-400/50', icon: 'text-amber-300' } },
    ],
  },
  'semantic-layer': {
    id: 'semantic-layer',
    title: 'Semantic Layer',
    icon: FileCode,
    colors: {
      title: 'text-cyan-300',
      border: 'border-cyan-500/60',
      chip: 'bg-cyan-900/30 border-cyan-500/30 hover:bg-cyan-900/50 hover:border-cyan-400',
      chipText: 'text-cyan-200',
      arrow: 'text-cyan-400',
    },
    accent: {
      container: 'border-cyan-500/30 bg-cyan-500/[0.05]',
      chip: { box: 'bg-cyan-500/15 border-cyan-500/50', icon: 'text-cyan-400' },
    },
    services: [
      { label: 'Metric View', serviceKey: 'metricViews' },
      { label: 'Synonyms', serviceKey: 'metricViews' },
    ],
  },
  'ai-agents': {
    id: 'ai-agents',
    title: 'AI and Agents',
    icon: Brain,
    colors: {
      title: 'text-sky-300',
      border: 'border-sky-500/60',
      chip: 'bg-sky-900/30 border-sky-500/30 hover:bg-sky-900/50 hover:border-sky-400',
      chipText: 'text-sky-200',
      arrow: 'text-sky-400',
    },
    // Cyan chips + tinted container — matches the interactive AI-module
    // selector's existing cyan chips exactly.
    accent: {
      container: 'border-cyan-500/30 bg-cyan-500/[0.05]',
      chip: { box: 'bg-cyan-500/15 border-cyan-500/50', icon: 'text-cyan-400' },
    },
    // The canonical AI-and-Agents trio (Genie · Agent · Dashboard), shared with
    // the persona AI-module column.
    services: [
      { label: 'Genie', serviceKey: 'genieSpaces', icon: MessageSquareText, toggleId: 'genie' },
      { label: 'Agent', serviceKey: 'agents', icon: Bot, toggleId: 'agent' },
      { label: 'Dashboard', serviceKey: 'aiBIDashboards', icon: LayoutDashboard, toggleId: 'dashboard' },
    ],
  },
  ontology: {
    id: 'ontology',
    title: 'Ontology',
    icon: Globe,
    colors: {
      title: 'text-violet-300',
      border: 'border-violet-500/60',
      chip: 'bg-violet-900/30 border-violet-500/30 hover:bg-violet-900/50 hover:border-violet-400',
      chipText: 'text-violet-200',
      arrow: 'text-violet-400',
    },
    // One calm accent for the new Genie boxes: cyan (matches AI and Agents).
    accent: {
      container: 'border-cyan-500/30 bg-cyan-500/[0.05]',
      chip: { box: 'bg-cyan-500/15 border-cyan-500/50', icon: 'text-cyan-400' },
    },
    services: [
      { label: 'Domains', serviceKey: 'discoverOntology' },
      { label: 'Pages', serviceKey: 'discoverOntology' },
      { label: 'Routing', serviceKey: 'discoverOntology' },
    ],
  },
  activation: {
    id: 'activation',
    title: 'Activation',
    icon: Rocket,
    colors: {
      title: 'text-emerald-300',
      border: 'border-emerald-500/60',
      chip: 'bg-emerald-900/30 border-emerald-500/30 hover:bg-emerald-900/50 hover:border-emerald-400',
      chipText: 'text-emerald-200',
      arrow: 'text-emerald-400',
    },
    // One calm accent for the new Genie boxes: cyan (matches AI and Agents).
    accent: {
      container: 'border-cyan-500/30 bg-cyan-500/[0.05]',
      chip: { box: 'bg-cyan-500/15 border-cyan-500/50', icon: 'text-cyan-400' },
    },
    services: [
      { label: 'Synced Tables', serviceKey: 'syncedTables' },
      { label: 'App', serviceKey: 'databricksApp' },
      { label: 'Lakebase', serviceKey: 'lakebase' },
    ],
  },
};

// AI-module toggleIds hidden in the Genie Accelerator views (strip + flip card).
// The Genie Accelerator builds a Genie space + dashboard, not a general agent.
const GENIE_ACCELERATOR_HIDDEN_TOGGLES: Partial<Record<ChapterBlockId, string[]>> = {
  'ai-agents': ['agent'],
};

/** Services to show for a block inside the Genie Accelerator surfaces. Both the
 *  selector strip and the flip card read this so the two views can't drift. */
export function genieAcceleratorServices(block: ChapterBlock): ServiceChip[] {
  const hidden = GENIE_ACCELERATOR_HIDDEN_TOGGLES[block.id];
  return hidden ? block.services.filter(s => !s.toggleId || !hidden.includes(s.toggleId)) : block.services;
}
