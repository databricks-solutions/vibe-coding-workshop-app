/**
 * LevelSelector Component
 *
 * A tiered 4-column layout for selecting workshop paths. The first three
 * columns are persona-aligned chapters; the fourth column holds role-agnostic
 * specialized tracks (Accelerators). On first open, `end-to-end` is the
 * default level and pre-highlights every chapter button — visually conveying
 * "everything selected" with no extra "Complete Workshop" toggle.
 *
 * Path locking: Once a user explicitly selects a level AND completes all foundation
 * steps (1, 2, 3), switching between tracks is disabled. Movement within the same
 * track (e.g. "Databricks Apps" → "+ Lakebase") remains allowed.
 *
 * Layout:
 *    [For App Developers]   [For Data Engineering]   [For Data Science]   (no caption)
 * ┌──────────────────────┬───────────────────────┬────────────────────┬────────────────────────┐
 * │  Apps and Lakebase   │     Lakehouse         │   AI and Agents    │      Accelerators      │
 * │  [Databricks Apps]   │  [Lakehouse]          │  [+ AI and Agents] │  [Agents Acc.]         │
 * │  [+ Lakebase]        │  Bronze/Silver/Gold   │  Genie/Agent/Dash  │  [Genie Acc.]          │
 * │                      │  chips                │  chips             │  [Data Eng. Acc.]      │
 * │                      │                       │                    │  [Skills Acc.]         │
 * └──────────────────────┴───────────────────────┴────────────────────┴────────────────────────┘
 */

import { motion, LayoutGroup } from 'framer-motion';
import { useState } from 'react';
import {
  WORKSHOP_LEVELS,
  SKILLS_ACCELERATOR_STATUS,
  getActiveChain,
  levelSupportsAIModuleToggles,
  getApplicableAIModules,
  ALL_AI_MODULES,
  NON_AI_FALLBACK,
  levelSupportsMedallionToggles,
  getApplicableMedallionLayers,
  ALL_MEDALLION_LAYERS,
  NON_LAKEHOUSE_FALLBACK,
  type WorkshopLevel,
  type WorkflowDirection,
  type AIAgentModule,
  type MedallionLayer,
  type ChainContext,
} from '../constants/workflowSections';
import { Check, Info, Globe, HardDrive, Brain, Database, Lock, Layers, MessageSquareText, BookOpen, Bot, LayoutDashboard, Code2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NewBadge } from './NewBadge';
import { PathDurationBar } from './PathDurationBar';

// Reasons a path button can be locked. Drives the tooltip wording so the user
// always knows *why* a path is unavailable. 'workflow-started' is the default
// path-lock-after-foundation; 'use-case' fires when a specific use case pinned
// the level; 'assistant' fires when the active coding assistant doesn't
// support this path (per admin Visibility config).
type LockReason = 'workflow-started' | 'use-case' | 'assistant';

const LOCK_REASON_TEXT: Record<LockReason, { title: string; body: string }> = {
  'workflow-started': {
    title: 'Path is locked',
    body: 'Start a new session to switch tracks.',
  },
  'use-case': {
    title: 'Path is locked',
    body: 'The selected use case pinned the workshop level.',
  },
  'assistant': {
    title: 'Not available with this assistant',
    body: "This path isn't supported by the selected coding assistant. Switch coding assistants to use it, or pick another path.",
  },
};

function LockedTooltip({
  reason = 'workflow-started',
  title,
  body,
}: { reason?: LockReason; title?: string; body?: string } = {}) {
  const fallback = LOCK_REASON_TEXT[reason];
  return (
    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50
      opacity-0 scale-95 translate-y-1 group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0
      transition-all duration-200 ease-out pointer-events-none">
      <div className="w-2.5 h-2.5 rotate-45 bg-popover border-l border-t border-border/50 absolute -top-[5px] left-1/2 -translate-x-1/2 z-10" />
      <div className="relative bg-popover/95 backdrop-blur-md border border-border/50 shadow-xl rounded-lg px-3.5 py-2.5 max-w-xs">
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-ui-sm font-semibold text-foreground whitespace-nowrap">{title ?? fallback.title}</span>
        </div>
        <p className="text-ui-xs text-muted-foreground mt-1 ml-[22px] whitespace-normal">
          {body ?? fallback.body}
        </p>
      </div>
    </div>
  );
}

interface LevelSelectorProps {
  selectedLevel: WorkshopLevel;
  chainContext?: ChainContext;
  onLevelChange: (level: WorkshopLevel) => void;
  completedSteps?: Set<number>;
  levelExplicitlySelected?: boolean;
  useCaseLockedLevel?: WorkshopLevel | null;
  hasUseCaseSelected?: boolean;
  direction?: WorkflowDirection;
  aiAgentsModules?: Set<AIAgentModule>;
  onAIModulesChange?: (modules: Set<AIAgentModule>) => void;
  medallionLayers?: Set<MedallionLayer>;
  onMedallionLayersChange?: (layers: Set<MedallionLayer>) => void;
  /** Workshop levels disabled for the active coding assistant. The currently-
   * selected level is grandfathered (always clickable) inside the picker so
   * shared sessions and mid-session assistant changes never lose state. */
  disabledWorkshopLevels?: Set<WorkshopLevel>;
}

const BUTTON_LABELS: Record<WorkshopLevel, string> = {
  'app-only': 'Databricks Apps',
  'app-database': '+ Lakebase',
  'lakehouse': 'Lakehouse',
  'lakehouse-di': '+ AI and Agents',
  'end-to-end': 'Complete Workshop',
  'accelerator': 'Data Product Accelerator',
  'genie-accelerator': 'Genie Accelerator',
  'data-engineering-accelerator': 'Data Engineering Accelerator',
  'skills-accelerator': 'Agent Skills Accelerator',
  'agents-accelerator': 'Agents Accelerator',
  'reverse-lakehouse': 'Lakehouse',
  'reverse-lakehouse-di': '+ AI and Agents',
  'reverse-lakebase': '+ Lakebase (Synced)',
  'reverse-app': '+ Analytics App',
};

const LEVEL_DESCRIPTIONS: Record<WorkshopLevel, string> = {
  'app-only': 'Build and deploy a web app with Databricks Apps',
  'app-database': 'Add a PostgreSQL database to your web app',
  'lakehouse': 'Build Bronze/Silver/Gold data pipelines',
  'lakehouse-di': 'Add Genie Spaces, Agents & AI/BI Dashboards on top of your Lakehouse',
  'end-to-end': 'The complete end-to-end workshop covering all chapters',
  'accelerator': 'Start with table metadata and build end-to-end Bronze/Silver/Gold layers that power your AI and agents',
  'genie-accelerator': 'Analyze silver metadata, design Gold layer, and build Genie Spaces with Metric Views and TVFs',
  'data-engineering-accelerator': 'Build production-ready Bronze, Silver, and Gold data pipelines using Databricks Lakehouse best practices',
  'skills-accelerator': 'Build a Data Contract Governance Skill that tags gold-layer tables and validates compliance for certification',
  'agents-accelerator': 'Build, evaluate, and deploy a production-ready agent app — Databricks App + Lakebase + Mosaic AI Agent Framework + MLflow for Gen-AI lifecycle.',
  'reverse-lakehouse': 'Start with Lakehouse data engineering, then sync analytics into Lakebase.',
  'reverse-lakehouse-di': 'Build Gold layer analytics and Genie Spaces, then sync into Lakebase.',
  'reverse-lakebase': 'Push curated analytics data into Lakebase PostgreSQL using Databricks Synced Tables.',
  'reverse-app': 'Design and deploy an analytics application powered by synced Lakebase data.',
};

type Track = 'apps-lakebase' | 'lakehouse' | 'ai-agents' | 'accelerator';

function getTrack(level: WorkshopLevel): Track {
  if (level === 'app-only' || level === 'app-database' || level === 'reverse-lakebase' || level === 'reverse-app') return 'apps-lakebase';
  if (level === 'lakehouse' || level === 'reverse-lakehouse') return 'lakehouse';
  if (level === 'lakehouse-di' || level === 'reverse-lakehouse-di') return 'ai-agents';
  // 'end-to-end' and all accelerator levels fall through to the Accelerators
  // column for column-lock semantics. end-to-end no longer has its own UI button.
  return 'accelerator';
}

/**
 * Returns the set of buttons that should appear "included" (highlighted).
 * When on a progressive chain, all levels up to and including the current
 * position are highlighted to show the cumulative path.
 */
function getHighlightedButtons(
  selectedLevel: WorkshopLevel,
  completedSteps: Set<number>,
  chainContext?: ChainContext,
): Set<WorkshopLevel> {
  const chain = getActiveChain(selectedLevel, completedSteps, chainContext);
  if (chain) {
    const idx = chain.indexOf(selectedLevel);
    if (idx !== -1) return new Set(chain.slice(0, idx + 1));
  }
  switch (selectedLevel) {
    case 'end-to-end':
      // End-to-End is direction-agnostic: highlight every level on both forward
      // and reverse chains so the buttons in whichever column layout is currently
      // rendered (forward or reverse) all show the included/checkmark style.
      return new Set<WorkshopLevel>([
        'app-only', 'app-database', 'lakehouse', 'lakehouse-di',
        'reverse-lakehouse', 'reverse-lakehouse-di', 'reverse-lakebase', 'reverse-app',
        'end-to-end',
      ]);
    case 'accelerator':
      return new Set<WorkshopLevel>(['accelerator']);
    case 'genie-accelerator':
      return new Set<WorkshopLevel>(['genie-accelerator']);
    case 'data-engineering-accelerator':
      return new Set<WorkshopLevel>(['data-engineering-accelerator']);
    case 'skills-accelerator':
      return new Set<WorkshopLevel>(['skills-accelerator']);
    case 'agents-accelerator':
      return new Set<WorkshopLevel>(['agents-accelerator']);
    default:
      return new Set<WorkshopLevel>([selectedLevel]);
  }
}

const TRACK_LABEL: Record<Track, string> = {
  'apps-lakebase': 'Apps and Lakebase',
  'lakehouse': 'Lakehouse',
  'ai-agents': 'AI and Agents',
  'accelerator': 'Accelerators',
};

// Persona captions rendered above the three chapter columns. The accelerators
// column intentionally has no caption so the role-agnostic specialized tracks
// stay visually distinct from the persona-aligned chapter columns.
const COLUMN_PERSONAS: { icon: LucideIcon; label: string; tone: string }[] = [
  { icon: Code2,    label: 'For Application Developers', tone: 'text-amber-300/60' },
  { icon: Database, label: 'For Data Engineering',       tone: 'text-teal-300/60'  },
  { icon: Brain,    label: 'For Data Science',           tone: 'text-cyan-300/60'  },
];

export { BUTTON_LABELS, LEVEL_DESCRIPTIONS };

/**
 * Inner grid content without wrapper card or description block.
 * Used by PathAndArchitecture to embed inside a combined collapsible card.
 */
export function LevelSelectorContent({
  selectedLevel,
  chainContext,
  onLevelChange,
  completedSteps = new Set(),
  useCaseLockedLevel,
  hasUseCaseSelected,
  direction,
  aiAgentsModules,
  onAIModulesChange,
  medallionLayers,
  onMedallionLayersChange,
  disabledWorkshopLevels,
}: LevelSelectorProps) {
  return (
    <LevelSelectorGrid
      selectedLevel={selectedLevel}
      chainContext={chainContext}
      onLevelChange={onLevelChange}
      completedSteps={completedSteps}
      useCaseLockedLevel={useCaseLockedLevel}
      hasUseCaseSelected={hasUseCaseSelected}
      direction={direction}
      aiAgentsModules={aiAgentsModules}
      onAIModulesChange={onAIModulesChange}
      medallionLayers={medallionLayers}
      onMedallionLayersChange={onMedallionLayersChange}
      disabledWorkshopLevels={disabledWorkshopLevels}
    />
  );
}

function LevelSelectorGrid({
  selectedLevel,
  chainContext = null,
  onLevelChange,
  completedSteps = new Set(),
  useCaseLockedLevel,
  hasUseCaseSelected = false,
  direction = 'forward',
  aiAgentsModules,
  onAIModulesChange,
  medallionLayers,
  onMedallionLayersChange,
  disabledWorkshopLevels,
}: LevelSelectorProps) {
  const highlightedButtons = getHighlightedButtons(selectedLevel, completedSteps, chainContext);

  const hasStartedWorkflow = Array.from(completedSteps).some(s => s >= 2);
  const activeChain = hasStartedWorkflow ? getActiveChain(selectedLevel, completedSteps, chainContext) : null;
  const chainIdx = activeChain ? activeChain.indexOf(selectedLevel) : -1;
  const isPathLocked = hasStartedWorkflow || !!useCaseLockedLevel;

  // Additive-selection gates. The "+" prefix levels are hard-disabled until
  // their parent in the APP_CHAIN is highlighted/selected. Once Apps is
  // selected, "+ Lakebase" unlocks; once Lakehouse is selected, "+ AI and
  // Agents" unlocks. These gates apply only in forward direction — reverse
  // chain deals with its own separate level set.
  const isAdditiveGateDisabled = (level: WorkshopLevel): { disabled: boolean; tooltipBody?: string } => {
    if (direction === 'reverse') return { disabled: false };
    if (useCaseLockedLevel) return { disabled: false };
    if (level === 'app-database') {
      const appsSelected = highlightedButtons.has('app-only') || highlightedButtons.has('app-database');
      if (!appsSelected) {
        return { disabled: true, tooltipBody: 'Select Databricks Apps first to enable.' };
      }
    }
    if (level === 'lakehouse-di') {
      const lakehouseSelected = highlightedButtons.has('lakehouse') || highlightedButtons.has('lakehouse-di');
      if (!lakehouseSelected) {
        return { disabled: true, tooltipBody: 'Select Lakehouse first to enable.' };
      }
    }
    return { disabled: false };
  };

  // Resolve why a button is locked, in priority order. Returns null when the
  // button is enabled. The returned `reason` drives the LockedTooltip wording
  // so the user always knows whether this is an assistant restriction, a
  // use-case lock, an additive gate, or the standard "workflow started" lock.
  //
  // Grandfather rule: the currently-selected level is ALWAYS clickable, even
  // if it lives in `disabledWorkshopLevels`. This preserves shared sessions
  // (a session saved with `app-database` and a Cursor user, opened later by a
  // Genie Code user, still works) and prevents mid-session assistant changes
  // from silently mutating progress.
  const getLockState = (level: WorkshopLevel): { reason: LockReason; title?: string; body?: string } | null => {
    // Grandfather: current selection is always usable.
    if (level === selectedLevel) return null;

    // 1. Assistant restriction. Highest-priority message because it's the most
    //    likely cause of confusion when a user just switched assistants.
    if (disabledWorkshopLevels?.has(level)) {
      return { reason: 'assistant' };
    }

    // 2. Use-case lock pinned a specific level — every other level is locked.
    if (useCaseLockedLevel && level !== useCaseLockedLevel) {
      return { reason: 'use-case' };
    }

    // 3. Skills Accelerator is hidden once a non-skills use case is selected
    //    (the use-case lock above pins it directly when chosen).
    if (level === 'skills-accelerator' && !useCaseLockedLevel && hasUseCaseSelected) {
      return { reason: 'use-case' };
    }

    // 4. Additive gate ("+ Lakebase" needs Apps, "+ AI and Agents" needs
    //    Lakehouse). Friendlier wording than the generic locked tooltip.
    const additive = isAdditiveGateDisabled(level);
    if (additive.disabled) {
      return { reason: 'workflow-started', title: 'Select prerequisite first', body: additive.tooltipBody };
    }

    // 5. Workflow-started path lock. Foundation steps complete -> only the
    //    active chain's current and next-step buttons remain clickable.
    if (hasStartedWorkflow) {
      if (activeChain) {
        const targetIdx = activeChain.indexOf(level);
        if (targetIdx === chainIdx) return null;
        if (targetIdx === chainIdx + 1) return null;
        return { reason: 'workflow-started' };
      }
      return { reason: 'workflow-started' };
    }

    return null;
  };

  const isButtonDisabled = (level: WorkshopLevel): boolean => getLockState(level) !== null;

  // Dynamic button label. When the user is climbing APP_CHAIN, Lakehouse
  // becomes additive ("+ Lakehouse") to signal it stacks on top of the
  // already-selected Apps + Lakebase.
  const getButtonLabel = (level: WorkshopLevel): string => {
    if (level === 'lakehouse' && chainContext === 'app' && direction !== 'reverse') {
      return '+ Lakehouse';
    }
    return BUTTON_LABELS[level];
  };

  const isHighlighted = (level: WorkshopLevel) => highlightedButtons.has(level);

  const getButtonClass = (level: WorkshopLevel) => {
    const isSelected = selectedLevel === level;
    const isIncluded = isHighlighted(level);
    const disabled = isButtonDisabled(level);

    if (disabled) {
      return `px-4 py-2.5 rounded-lg text-ui-sm font-medium transition-all duration-200 w-full
        bg-secondary/40 text-muted-foreground/50 cursor-not-allowed`;
    } else if (isSelected) {
      return `px-4 py-2.5 rounded-lg text-ui-sm font-medium transition-all duration-200 w-full
        bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30`;
    } else if (isIncluded) {
      return `px-4 py-2.5 rounded-lg text-ui-sm font-medium transition-all duration-200 w-full
        bg-primary/20 text-primary border border-primary/40 shadow-sm`;
    } else {
      return `px-4 py-2.5 rounded-lg text-ui-sm font-medium transition-all duration-200 w-full
        bg-secondary/60 text-foreground hover:bg-secondary hover:shadow-sm`;
    }
  };

  const getBoxClass = (isActive: boolean, hasHighlighted: boolean, isLocked: boolean) => `
    flex-1 p-3 rounded-xl border-2 transition-all duration-200
    ${isLocked
      ? 'border-border/30 bg-card/30 opacity-60'
      : isActive
      ? 'border-primary/50 bg-primary/5 shadow-sm'
      : hasHighlighted
      ? 'border-primary/30 bg-primary/5'
      : 'border-border/50 bg-card/50 hover:border-border'
    }
  `;

  const appHasHighlight = isHighlighted('app-only') || isHighlighted('app-database') || isHighlighted('reverse-lakebase') || isHighlighted('reverse-app');
  const lakehouseHasHighlight = isHighlighted('lakehouse') || isHighlighted('reverse-lakehouse');
  const aiAgentsHasHighlight = isHighlighted('lakehouse-di') || isHighlighted('reverse-lakehouse-di');

  const isAppSelected = appHasHighlight && (selectedLevel === 'app-only' || selectedLevel === 'app-database' || selectedLevel === 'reverse-lakebase' || selectedLevel === 'reverse-app');
  const isLakehouseSelected = lakehouseHasHighlight && (selectedLevel === 'lakehouse' || selectedLevel === 'reverse-lakehouse');
  const isAiAgentsSelected = aiAgentsHasHighlight && (selectedLevel === 'lakehouse-di' || selectedLevel === 'reverse-lakehouse-di');
  const isAcceleratorSelected = selectedLevel === 'accelerator' || selectedLevel === 'genie-accelerator' || selectedLevel === 'data-engineering-accelerator' || selectedLevel === 'skills-accelerator' || selectedLevel === 'agents-accelerator';

  const isColumnLocked = (track: Track) => {
    if (!isPathLocked) return false;
    if (activeChain) {
      const trackLevels = (Object.keys(WORKSHOP_LEVELS) as WorkshopLevel[]).filter(
        l => getTrack(l) === track,
      );
      return !trackLevels.some(l => {
        const ti = activeChain.indexOf(l);
        return ti !== -1 && ti <= chainIdx + 1;
      });
    }
    const trackLevels = (Object.keys(WORKSHOP_LEVELS) as WorkshopLevel[]).filter(
      l => getTrack(l) === track,
    );
    return !trackLevels.includes(selectedLevel);
  };

  // Toggle-off baseline is chain-aware. Genie Code (and any future assistant
  // that can't run the Apps + Lakebase chapters) lives on LAKEHOUSE_CHAIN, so
  // deselecting Lakehouse-DI must fall back to Lakehouse — never jump across
  // chains into a flow the assistant doesn't support. Reverse direction has
  // no toggle-off (handled below).
  const getToggleOffBaseline = (): WorkshopLevel => {
    if (chainContext === 'lakehouse') return 'lakehouse';
    return 'app-database';
  };

  const handleLevelClick = (level: WorkshopLevel) => {
    if (isButtonDisabled(level)) return;
    // Toggle-off: clicking the currently-selected level deselects it and falls
    // back to the active chain's baseline (Apps + Lakebase for APP_CHAIN, plain
    // Lakehouse for LAKEHOUSE_CHAIN). Mirrors the Bronze/Silver/Gold chip
    // click-to-deselect pattern. Disabled when:
    //   - the clicked level IS already the baseline — nothing to fall back to.
    //   - the workflow has already started (cannot move backward across a chain).
    //   - a use-case lock is pinning the current level.
    //   - direction is reverse (forward-direction baselines don't apply).
    const baseline = getToggleOffBaseline();
    const isBaselineLevel = level === 'app-only' || level === baseline;
    const isReverse = direction === 'reverse';
    if (
      level === selectedLevel &&
      !isBaselineLevel &&
      !hasStartedWorkflow &&
      !useCaseLockedLevel &&
      !isReverse
    ) {
      onLevelChange(baseline);
      return;
    }
    onLevelChange(level);
  };

  // Tooltip hint when a level is currently selected and deselect-to-baseline
  // would be allowed on next click. Mirrors the Bronze/Silver/Gold chip UX.
  const getToggleHint = (level: WorkshopLevel): string | undefined => {
    if (level !== selectedLevel) return undefined;
    const baseline = getToggleOffBaseline();
    const isBaselineLevel = level === 'app-only' || level === baseline;
    if (isBaselineLevel || hasStartedWorkflow || useCaseLockedLevel || direction === 'reverse') {
      return undefined;
    }
    const baselineLabel = baseline === 'lakehouse' ? 'Lakehouse' : 'Apps + Lakebase';
    return `Click again to deselect and return to ${baselineLabel}`;
  };

  const renderButton = (level: WorkshopLevel, icon: React.ReactNode) => {
    const lockState = getLockState(level);
    const disabled = lockState !== null;
    const btn = (
      <button
        onClick={() => handleLevelClick(level)}
        disabled={disabled}
        className={getButtonClass(level)}
        title={getToggleHint(level)}
      >
        <div className="flex items-center gap-2.5">
          {icon}
          <span className="flex-1 text-left">{getButtonLabel(level)}</span>
          {!disabled && (selectedLevel === level || isHighlighted(level)) && (
            <Check className={`w-3.5 h-3.5 flex-shrink-0 ${selectedLevel === level ? '' : 'opacity-60'}`} />
          )}
        </div>
      </button>
    );
    if (disabled && lockState) {
      return (
        <div className="relative group">
          {btn}
          <LockedTooltip
            reason={lockState.reason}
            title={lockState.title}
            body={lockState.body}
          />
        </div>
      );
    }
    return btn;
  };

  const columnHeader = (track: Track) => (
    <div className="text-ui-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 text-center flex items-center justify-center gap-1.5">
      {isColumnLocked(track) && <Lock className="w-3 h-3 text-muted-foreground/60" />}
      {TRACK_LABEL[track]}
    </div>
  );

  // The Estimated Build Time bar is positioned here — directly below the
  // "Choose Your Workshop Path" header and above the chapter columns — so it
  // sits adjacent to the controls that actually drive its segments. Effective
  // chip sets fall back to "all on" when the parent hasn't wired up the
  // toggle props yet, mirroring PathAndArchitecture's coercion.
  const effectiveAIModules = aiAgentsModules ?? new Set(ALL_AI_MODULES);
  const effectiveMedallionLayers = medallionLayers ?? new Set(ALL_MEDALLION_LAYERS);

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-semibold text-foreground">
          Choose Your Workshop Path
        </span>
        {isPathLocked ? (
          <div className={`flex items-center gap-1 text-ui-2xs px-2 py-0.5 rounded-full ${
            activeChain
              ? 'text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20'
              : 'text-amber-400/80 bg-amber-500/10 border border-amber-500/20'
          }`}>
            <Lock className="w-2.5 h-2.5" />
            <span className="font-medium">{activeChain ? 'Progressive' : 'Locked'}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-ui-2xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">
            <Info className="w-3 h-3" />
            <span>Options within each track build on each other</span>
          </div>
        )}
      </div>

      {/* Estimated Build Time — sits right above the chapter columns so the
          time impact of each click is visible inline, instead of forcing the
          user to scroll back up to the card header. */}
      <div className="mb-4">
        <PathDurationBar
          level={selectedLevel}
          direction={direction}
          aiModules={effectiveAIModules}
          medallionLayers={effectiveMedallionLayers}
          completedSteps={completedSteps}
          chainContext={chainContext}
          variant="full"
        />
      </div>

      {/* Persona caption row — subtly aligns each chapter column with the
          target audience. The 4th slot (over Accelerators) is intentionally
          blank so the role-agnostic specialized tracks stay visually distinct.
          In reverse direction, columns reorder (Lakehouse leads), so the
          persona captions reorder to keep the alignment correct. */}
      <div className="flex gap-3 mb-1.5 px-1">
        {(direction === 'reverse'
          ? [COLUMN_PERSONAS[1], COLUMN_PERSONAS[2], COLUMN_PERSONAS[0]]
          : COLUMN_PERSONAS
        ).map(p => (
          <div
            key={p.label}
            className="flex-1 flex items-center justify-center gap-1.5 pb-0.5 border-b border-border/30
                       text-ui-3xs uppercase tracking-[0.12em] font-semibold text-muted-foreground/70"
          >
            <p.icon className={`w-3 h-3 ${p.tone}`} />
            <span>{p.label}</span>
          </div>
        ))}
        {direction !== 'reverse' && <div className="flex-1" aria-hidden="true" />}
      </div>

      {/* 4-Column Box Layout */}
      <LayoutGroup>
        <div className="flex gap-3">
          {(() => {
            // Build the three persona-aligned chapter columns. Each column
            // renders the same way regardless of direction; only the levels
            // they reference and the column ordering differ.
            const lakehouseLevel: WorkshopLevel = direction === 'reverse' ? 'reverse-lakehouse' : 'lakehouse';
            const aiLevel: WorkshopLevel = direction === 'reverse' ? 'reverse-lakehouse-di' : 'lakehouse-di';

            const appsLakebaseColumn = (
              <motion.div key="col-app" layout layoutId="col-app"
                className={getBoxClass(isAppSelected, appHasHighlight && !isAppSelected, isColumnLocked('apps-lakebase'))}
                transition={{ type: 'spring', stiffness: 250, damping: 22, mass: 0.9 }}>
                {columnHeader('apps-lakebase')}
                <div className="space-y-2">
                  {direction === 'reverse' ? (
                    <>
                      {renderButton('reverse-lakebase', <HardDrive className="w-4 h-4 flex-shrink-0" />)}
                      {renderButton('reverse-app', <Globe className="w-4 h-4 flex-shrink-0" />)}
                    </>
                  ) : (
                    <>
                      {renderButton('app-only', <Globe className="w-4 h-4 flex-shrink-0" />)}
                      {renderButton('app-database', <HardDrive className="w-4 h-4 flex-shrink-0" />)}
                    </>
                  )}
                </div>
              </motion.div>
            );

            // Lakehouse column: medallion chips only render when on a
            // progression-chain level. When an accelerator is selected, this
            // column shows the plain Lakehouse button without chips.
            const lakehouseColumn = (
              <motion.div key="col-lakehouse" layout layoutId="col-lakehouse"
                className={getBoxClass(isLakehouseSelected, lakehouseHasHighlight && !isLakehouseSelected, isColumnLocked('lakehouse'))}
                transition={{ type: 'spring', stiffness: 250, damping: 22, mass: 0.9 }}>
                {columnHeader('lakehouse')}
                <div className="space-y-2">
                  {!isAcceleratorSelected && levelSupportsMedallionToggles(selectedLevel) && medallionLayers && onMedallionLayersChange ? (
                    <div className="rounded-lg border border-teal-500/30 bg-teal-500/[0.05] p-1.5 space-y-1.5">
                      {renderButton(lakehouseLevel, <Database className="w-4 h-4 flex-shrink-0" />)}
                      <MedallionLayerSelector
                        level={selectedLevel}
                        layers={medallionLayers}
                        onChange={onMedallionLayersChange}
                        onLevelChange={onLevelChange}
                        hasStartedWorkflow={hasStartedWorkflow}
                        useCaseLockedLevel={useCaseLockedLevel ?? null}
                      />
                    </div>
                  ) : (
                    renderButton(lakehouseLevel, <Database className="w-4 h-4 flex-shrink-0" />)
                  )}
                </div>
              </motion.div>
            );

            // AI and Agents column: AI module chips only render when on a
            // progression-chain level (same rationale as Lakehouse column).
            const aiAgentsColumn = (
              <motion.div key="col-ai-agents" layout layoutId="col-ai-agents"
                className={getBoxClass(isAiAgentsSelected, aiAgentsHasHighlight && !isAiAgentsSelected, isColumnLocked('ai-agents'))}
                transition={{ type: 'spring', stiffness: 250, damping: 22, mass: 0.9 }}>
                {columnHeader('ai-agents')}
                <div className="space-y-2">
                  {!isAcceleratorSelected && levelSupportsAIModuleToggles(selectedLevel) && aiAgentsModules && onAIModulesChange ? (
                    <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/[0.05] p-1.5 space-y-1.5">
                      {renderButton(aiLevel, <Brain className="w-4 h-4 flex-shrink-0" />)}
                      <AIAgentsModuleSelector
                        level={selectedLevel}
                        modules={aiAgentsModules}
                        onChange={onAIModulesChange}
                        onLevelChange={onLevelChange}
                        hasStartedWorkflow={hasStartedWorkflow}
                      />
                    </div>
                  ) : (
                    renderButton(aiLevel, <Brain className="w-4 h-4 flex-shrink-0" />)
                  )}
                </div>
              </motion.div>
            );

            // Reverse direction reorders the persona-aligned columns:
            // Lakehouse leads (it's the entry point for reverse ETL),
            // followed by AI and Agents, then Apps and Lakebase
            // (which holds the analytics-app/synced-Lakebase outputs).
            return direction === 'reverse'
              ? <>{lakehouseColumn}{aiAgentsColumn}{appsLakebaseColumn}</>
              : <>{appsLakebaseColumn}{lakehouseColumn}{aiAgentsColumn}</>;
          })()}

        {/* Column 4: Accelerators — hidden in Reverse ETL direction. The
            accelerators are forward-progression flows; they have no meaningful
            reverse counterpart. Showing only 3 columns in reverse avoids
            confusing users with disabled/mismatched options. */}
        {direction !== 'reverse' && (
        <div className={getBoxClass(isAcceleratorSelected, false, isColumnLocked('accelerator'))}>
          {columnHeader('accelerator')}
          <div className="space-y-2">
            {/* Agents Accelerator — first in the list; works with any sample use case; clicking it locks the flow */}
            {(() => {
              const lockState = getLockState('agents-accelerator');
              const disabled = lockState !== null;
              return (
                <div className={disabled ? 'relative group' : undefined}>
                  <button
                    onClick={() => handleLevelClick('agents-accelerator')}
                    disabled={disabled}
                    className={getButtonClass('agents-accelerator')}
                    title={getToggleHint('agents-accelerator')}
                  >
                    <div className="flex items-center gap-2.5">
                      <Bot className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 text-left">{BUTTON_LABELS['agents-accelerator']}</span>
                      <NewBadge tone={selectedLevel === 'agents-accelerator' ? 'inverted' : 'emerald'} />
                      <span
                        title="Beta — feature is available but still being tested"
                        className={`text-ui-3xs px-1.5 py-0.5 rounded font-medium ${
                          selectedLevel === 'agents-accelerator'
                            ? 'bg-white/20 text-primary-foreground/80 border border-white/20'
                            : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        }`}
                      >Beta</span>
                      {!disabled && (selectedLevel === 'agents-accelerator' || isHighlighted('agents-accelerator')) && (
                        <Check className={`w-3.5 h-3.5 flex-shrink-0 ${selectedLevel === 'agents-accelerator' ? '' : 'opacity-60'}`} />
                      )}
                    </div>
                  </button>
                  {disabled && lockState && <LockedTooltip reason={lockState.reason} title={lockState.title} body={lockState.body} />}
                </div>
              );
            })()}

            {/* Genie Accelerator */}
            {(() => {
              const lockState = getLockState('genie-accelerator');
              const disabled = lockState !== null;
              return (
                <div className={disabled ? 'relative group' : undefined}>
                  <button
                    onClick={() => handleLevelClick('genie-accelerator')}
                    disabled={disabled}
                    className={getButtonClass('genie-accelerator')}
                    title={getToggleHint('genie-accelerator')}
                  >
                    <div className="flex items-center gap-2.5">
                      <MessageSquareText className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 text-left">{BUTTON_LABELS['genie-accelerator']}</span>
                      {!disabled && (selectedLevel === 'genie-accelerator' || isHighlighted('genie-accelerator')) && (
                        <Check className={`w-3.5 h-3.5 flex-shrink-0 ${selectedLevel === 'genie-accelerator' ? '' : 'opacity-60'}`} />
                      )}
                    </div>
                  </button>
                  {disabled && lockState && <LockedTooltip reason={lockState.reason} title={lockState.title} body={lockState.body} />}
                </div>
              );
            })()}

            {/* Data Engineering Accelerator */}
            {(() => {
              const lockState = getLockState('data-engineering-accelerator');
              const disabled = lockState !== null;
              return (
                <div className={disabled ? 'relative group' : undefined}>
                  <button
                    onClick={() => handleLevelClick('data-engineering-accelerator')}
                    disabled={disabled}
                    className={getButtonClass('data-engineering-accelerator')}
                    title={getToggleHint('data-engineering-accelerator')}
                  >
                    <div className="flex items-center gap-2.5">
                      <Database className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 text-left">{BUTTON_LABELS['data-engineering-accelerator']}</span>
                      {!disabled && (selectedLevel === 'data-engineering-accelerator' || isHighlighted('data-engineering-accelerator')) && (
                        <Check className={`w-3.5 h-3.5 flex-shrink-0 ${selectedLevel === 'data-engineering-accelerator' ? '' : 'opacity-60'}`} />
                      )}
                    </div>
                  </button>
                  {disabled && lockState && <LockedTooltip reason={lockState.reason} title={lockState.title} body={lockState.body} />}
                </div>
              );
            })()}

            {/* Agent Skills Accelerator - gated by SKILLS_ACCELERATOR_STATUS */}
            {SKILLS_ACCELERATOR_STATUS === 'coming-soon' ? (
              <button
                disabled
                title="Coming soon — Agent Skills Accelerator"
                className="px-4 py-2.5 rounded-lg text-ui-sm font-medium w-full bg-secondary/50 text-muted-foreground cursor-not-allowed border border-dashed border-border"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 flex-shrink-0 opacity-70" />
                  <span className="flex-1 text-left truncate">{BUTTON_LABELS['skills-accelerator']}</span>
                  <span className="text-ui-3xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground">soon</span>
                </div>
              </button>
            ) : (() => {
              const lockState = getLockState('skills-accelerator');
              const disabled = lockState !== null;
              return (
                <div className={disabled ? 'relative group' : undefined}>
                  <button
                    onClick={() => handleLevelClick('skills-accelerator')}
                    disabled={disabled}
                    className={getButtonClass('skills-accelerator')}
                    title={getToggleHint('skills-accelerator')}
                  >
                    <div className="flex items-center gap-2.5">
                      <BookOpen className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 text-left">{BUTTON_LABELS['skills-accelerator']}</span>
                      {!disabled && (selectedLevel === 'skills-accelerator' || isHighlighted('skills-accelerator')) && (
                        <Check className={`w-3.5 h-3.5 flex-shrink-0 ${selectedLevel === 'skills-accelerator' ? '' : 'opacity-60'}`} />
                      )}
                    </div>
                  </button>
                  {disabled && lockState && <LockedTooltip reason={lockState.reason} title={lockState.title} body={lockState.body} />}
                </div>
              );
            })()}

          </div>
        </div>
        )}
        </div>
      </LayoutGroup>
    </>
  );
}

// ---------------------------------------------------------------------------
// AI and Agents sub-module selector (Genie / Agent / Dashboard chips)
// ---------------------------------------------------------------------------

interface AIAgentsModuleSelectorProps {
  level: WorkshopLevel;
  modules: Set<AIAgentModule>;
  onChange: (modules: Set<AIAgentModule>) => void;
  onLevelChange: (level: WorkshopLevel) => void;
  hasStartedWorkflow: boolean;
}

const AI_MODULE_ITEMS: { id: AIAgentModule; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'genie',     label: 'Genie',     icon: MessageSquareText },
  { id: 'agent',     label: 'Agent',     icon: Bot               },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard   },
];

function AIAgentsModuleSelector({
  level,
  modules,
  onChange,
  onLevelChange,
  hasStartedWorkflow,
}: AIAgentsModuleSelectorProps) {
  const applicable = getApplicableAIModules(level);
  const items = AI_MODULE_ITEMS.filter(i => applicable.has(i.id));

  // Effective selection (intersect stored state with what applies on this level).
  const effective = new Set<AIAgentModule>([...modules].filter(m => applicable.has(m)));

  // Track which chip is "blocked" right now to drive the shake animation.
  const [shakeId, setShakeId] = useState<AIAgentModule | null>(null);

  const triggerShake = (id: AIAgentModule) => {
    setShakeId(id);
    window.setTimeout(() => setShakeId(prev => (prev === id ? null : prev)), 450);
  };

  const handleToggle = (id: AIAgentModule) => {
    const next = new Set(effective);
    if (next.has(id)) next.delete(id); else next.add(id);

    if (next.size === 0) {
      const fallback = NON_AI_FALLBACK[level];
      // Auto-revert only when (a) a clean fallback exists and (b) the workflow
      // hasn't started yet. Once started, App.handleWorkshopLevelChange would
      // silently reject the backward move — so we block here for a clear UX.
      if (fallback && !hasStartedWorkflow) {
        onLevelChange(fallback);
        onChange(new Set(ALL_AI_MODULES));
        return;
      }
      triggerShake(id);
      return;
    }

    // Preserve flags for non-applicable modules so they persist if the user
    // switches to a level where they apply again.
    const stored = new Set(modules);
    items.forEach(i => {
      if (next.has(i.id)) stored.add(i.id); else stored.delete(i.id);
    });
    onChange(stored);
  };

  const onlyOneActive = effective.size === 1;
  const willBlockOnLastOff = !NON_AI_FALLBACK[level] || hasStartedWorkflow;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26, mass: 0.8 }}
      className="grid grid-cols-3 gap-1"
      title="Customize the AI section. Use-Case Plan and Deploy Assets are always included."
    >
      {items.map(item => {
        const Icon = item.icon;
        const isOn = effective.has(item.id);
        const isShaking = shakeId === item.id;
        const wouldBlockClick = isOn && onlyOneActive && willBlockOnLastOff;

        return (
          <motion.button
            key={item.id}
            type="button"
            layout
            onClick={() => handleToggle(item.id)}
            whileTap={{ scale: 0.94 }}
            animate={isShaking ? { x: [0, -2, 2, -2, 2, 0] } : { x: 0 }}
            transition={{ duration: 0.32 }}
            title={
              wouldBlockClick
                ? 'At least one module required for this path'
                : isOn
                ? `Click to remove ${item.label}`
                : `Click to add ${item.label}`
            }
            className={`group flex flex-col items-center justify-center gap-0.5 rounded-md border px-1 py-1.5 transition-colors duration-150 ${
              isOn
                ? 'bg-cyan-500/15 border-cyan-500/50 text-foreground shadow-sm'
                : 'bg-secondary/40 border-border/40 text-muted-foreground hover:bg-secondary/70 hover:border-border/70 hover:text-foreground'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${isOn ? 'text-cyan-400' : ''}`} />
            <span className="text-ui-3xs font-medium leading-tight">{item.label}</span>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Medallion layer selector (Bronze / Silver / Gold chips).
// Cascading semantics: Gold requires Silver, Silver requires Bronze.
// Last-chip behavior:
//  - If a clean fallback path exists in NON_LAKEHOUSE_FALLBACK *and* the
//    workflow has not started *and* the level isn't pinned by a use-case lock,
//    auto-revert to the fallback (matches the AI selector's pattern).
//  - Otherwise block the deselect with a shake animation.
// ---------------------------------------------------------------------------

interface MedallionLayerSelectorProps {
  level: WorkshopLevel;
  layers: Set<MedallionLayer>;
  onChange: (layers: Set<MedallionLayer>) => void;
  onLevelChange: (level: WorkshopLevel) => void;
  hasStartedWorkflow: boolean;
  useCaseLockedLevel: WorkshopLevel | null;
}

const MEDALLION_ITEMS: { id: MedallionLayer; label: string; activeClass: string; iconActiveClass: string }[] = [
  { id: 'bronze', label: 'Bronze', activeClass: 'bg-orange-500/15 border-orange-500/50',  iconActiveClass: 'text-orange-400' },
  { id: 'silver', label: 'Silver', activeClass: 'bg-slate-300/15 border-slate-300/50',    iconActiveClass: 'text-slate-200' },
  { id: 'gold',   label: 'Gold',   activeClass: 'bg-amber-400/15 border-amber-400/50',    iconActiveClass: 'text-amber-300' },
];

function MedallionLayerSelector({
  level,
  layers,
  onChange,
  onLevelChange,
  hasStartedWorkflow,
  useCaseLockedLevel,
}: MedallionLayerSelectorProps) {
  const applicable = getApplicableMedallionLayers(level);
  const items = MEDALLION_ITEMS.filter(i => applicable.has(i.id));

  // Effective on-state respects per-level applicability without mutating storage.
  const effective = new Set<MedallionLayer>([...layers].filter(l => applicable.has(l)));

  const [shakeId, setShakeId] = useState<MedallionLayer | null>(null);
  const triggerShake = (id: MedallionLayer) => {
    setShakeId(id);
    window.setTimeout(() => setShakeId(prev => (prev === id ? null : prev)), 450);
  };

  // A fallback is only *viable* when:
  //   1. NON_LAKEHOUSE_FALLBACK has an entry for this level,
  //   2. the workflow hasn't started (handleWorkshopLevelChange would silently
  //      reject backward moves once steps are complete), and
  //   3. the use-case lock isn't pinning a different level.
  const fallback = NON_LAKEHOUSE_FALLBACK[level];
  const fallbackViable =
    !!fallback && !hasStartedWorkflow && (!useCaseLockedLevel || useCaseLockedLevel === fallback);

  const handleToggle = (id: MedallionLayer) => {
    // Cascading: deselecting Bronze drops Silver+Gold; deselecting Silver drops Gold.
    // Selecting Silver pulls in Bronze; selecting Gold pulls in Silver+Bronze.
    const cascaded = new Set(effective);
    if (cascaded.has(id)) {
      cascaded.delete(id);
      if (id === 'bronze') { cascaded.delete('silver'); cascaded.delete('gold'); }
      if (id === 'silver') { cascaded.delete('gold'); }
    } else {
      cascaded.add(id);
      if (id === 'silver') cascaded.add('bronze');
      if (id === 'gold')   { cascaded.add('silver'); cascaded.add('bronze'); }
    }

    // Detect last-chip deselect *before* normalizeMedallionLayers re-fills empty.
    if (cascaded.size === 0) {
      if (fallbackViable && fallback) {
        // App.handleWorkshopLevelChange resets medallionLayers to all-on on
        // level change, so we don't need to reset here.
        onLevelChange(fallback);
        return;
      }
      triggerShake(id);
      return;
    }

    // Persist into the parent store; only update bits applicable on this level.
    const stored = new Set(layers);
    items.forEach(i => {
      if (cascaded.has(i.id)) stored.add(i.id); else stored.delete(i.id);
    });
    onChange(stored);
  };

  const onlyOneActive = effective.size === 1;
  const willBlockOnLastOff = !fallbackViable;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26, mass: 0.8 }}
      className="grid grid-cols-3 gap-1"
      title="Customize the Lakehouse layers. Bronze→Silver→Gold cascade automatically."
    >
      {items.map(item => {
        const isOn = effective.has(item.id);
        const isShaking = shakeId === item.id;
        const wouldBlockClick = isOn && onlyOneActive && willBlockOnLastOff;

        return (
          <motion.button
            key={item.id}
            type="button"
            layout
            onClick={() => handleToggle(item.id)}
            whileTap={{ scale: 0.94 }}
            animate={isShaking ? { x: [0, -2, 2, -2, 2, 0] } : { x: 0 }}
            transition={{ duration: 0.32 }}
            title={
              wouldBlockClick
                ? 'At least one medallion layer required for this path'
                : isOn
                ? `Click to remove ${item.label}`
                : `Click to add ${item.label}`
            }
            className={`group flex flex-col items-center justify-center gap-0.5 rounded-md border px-1 py-1.5 transition-colors duration-150 ${
              isOn
                ? `${item.activeClass} text-foreground shadow-sm`
                : 'bg-secondary/40 border-border/40 text-muted-foreground hover:bg-secondary/70 hover:border-border/70 hover:text-foreground'
            }`}
          >
            <Layers className={`w-3.5 h-3.5 flex-shrink-0 ${isOn ? item.iconActiveClass : ''}`} />
            <span className="text-ui-3xs font-medium leading-tight">{item.label}</span>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

export function LevelSelector({
  selectedLevel,
  onLevelChange,
  completedSteps = new Set(),
  direction = 'forward',
}: LevelSelectorProps) {
  const chain = getActiveChain(selectedLevel, completedSteps);
  const isAppChainCrossColumn = chain && chain.length === 4 && (selectedLevel === 'lakehouse' || selectedLevel === 'lakehouse-di');

  const descriptionLabel = (() => {
    if (isAppChainCrossColumn) {
      return selectedLevel === 'lakehouse'
        ? 'Progressive — App + Lakebase + Lakehouse'
        : 'Progressive — App + Lakebase + Lakehouse + AI and Agents';
    }
    const isAppSelected = selectedLevel === 'app-only' || selectedLevel === 'app-database' || selectedLevel === 'reverse-lakebase' || selectedLevel === 'reverse-app';
    const isLakehouseSelected = selectedLevel === 'lakehouse' || selectedLevel === 'reverse-lakehouse';
    const isAiAgentsSelected = selectedLevel === 'lakehouse-di' || selectedLevel === 'reverse-lakehouse-di';
    const isEndToEndSelected = selectedLevel === 'end-to-end';
    const isAcceleratorSelected = selectedLevel === 'accelerator' || selectedLevel === 'genie-accelerator' || selectedLevel === 'data-engineering-accelerator' || selectedLevel === 'skills-accelerator' || selectedLevel === 'agents-accelerator';
    if (isAppSelected) return `Apps and Lakebase — ${BUTTON_LABELS[selectedLevel]}`;
    if (isLakehouseSelected) return `Lakehouse — ${BUTTON_LABELS[selectedLevel]}`;
    if (isAiAgentsSelected) return `AI and Agents — ${BUTTON_LABELS[selectedLevel]}`;
    if (isEndToEndSelected) return 'Complete Workshop — All chapters selected';
    if (isAcceleratorSelected) return `Accelerators — ${BUTTON_LABELS[selectedLevel]}`;
    return BUTTON_LABELS[selectedLevel];
  })();

  const includesText = (() => {
    if (isAppChainCrossColumn) {
      return selectedLevel === 'lakehouse'
        ? 'Foundation → Databricks App → Lakebase → Lakehouse → Refinement'
        : 'Foundation → Databricks App → Lakebase → Lakehouse → AI and Agents → Refinement';
    }
    switch (selectedLevel) {
      case 'app-only': return 'Foundation → Databricks App → Refinement';
      case 'app-database': return 'Foundation → Databricks App → Lakebase → Refinement';
      case 'lakehouse': return 'Foundation → Lakehouse → Refinement';
      case 'lakehouse-di': return 'Foundation → Lakehouse → AI and Agents → Refinement';
      case 'end-to-end': return 'Foundation → All Sections (App, Lakebase, Lakehouse, AI and Agents) → Refinement';
      case 'accelerator': return 'Foundation → Lakehouse → AI and Agents → Refinement';
      case 'genie-accelerator': return 'Foundation → Silver Metadata → Gold Layer → Use-Case Plan → Genie Space → Refinement';
      case 'data-engineering-accelerator': return 'Foundation → Lakehouse (Bronze → Silver → Gold) → Refinement';
      case 'skills-accelerator': return 'Foundation → Build Agent Skill (Explore, Strategy, SKILL.md, Apply & Test, Validate) → Refinement';
      case 'agents-accelerator': return 'Foundation → Databricks App → Lakebase → Agents on Apps → MLflow for Gen-AI → Refinement';
      case 'reverse-lakehouse': return 'Foundation → Lakehouse → Refinement';
      case 'reverse-lakehouse-di': return 'Foundation → Lakehouse → AI and Agents → Refinement';
      case 'reverse-lakebase': return 'Foundation → Lakehouse → AI and Agents → Reverse ETL (Synced Tables) → Refinement';
      case 'reverse-app': return 'Foundation → Lakehouse → AI and Agents → Reverse ETL (Analytics App) → Refinement';
      default: return '';
    }
  })();

  return (
    <div className="bg-card rounded-lg border border-border p-4 mb-4">
      <LevelSelectorGrid selectedLevel={selectedLevel} onLevelChange={onLevelChange} completedSteps={completedSteps} direction={direction} />

      {/* Description for selected level */}
      <div className="mt-4 pt-3 border-t border-border/50">
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          </div>
          <div>
            <span className="text-ui-base font-semibold text-foreground">
              {descriptionLabel}:
            </span>{' '}
            <span className="text-ui-base text-muted-foreground">
              {LEVEL_DESCRIPTIONS[selectedLevel]}
            </span>
          </div>
        </div>

        {/* What's included hint */}
        <div className="mt-2 text-ui-xs text-muted-foreground/80 pl-4">
          <span className="font-medium">Includes: </span>
          {includesText}
        </div>
      </div>
    </div>
  );
}
