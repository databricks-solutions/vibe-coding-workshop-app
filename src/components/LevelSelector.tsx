/**
 * LevelSelector Component
 *
 * A tiered 4-column layout for selecting workshop paths.
 * Each column is an independent track. Options within a column are additive.
 *
 * Path locking: Once a user explicitly selects a level AND completes all foundation
 * steps (1, 2, 3), switching between tracks is disabled. Movement within the same
 * track (e.g. "Databricks Apps" → "+ Lakebase") remains allowed.
 *
 * Layout:
 * ┌──────────────────┬──────────────┬─────────────┬─────────────────────┐
 * │ Web App + DB     │ Analytics+AI │  End to End │    Accelerators     │
 * │ [Databricks Apps]│ [Lakehouse]  │ [Complete   │ [Data Product Acc.] │
 * │ [+ Lakebase]     │ [+ Data Int] │  Workshop]  │ [Genie Acc. (soon)] │
 * │                  │              │             │ [Lakebase Acc.(soon)]│
 * └──────────────────┴──────────────┴─────────────┴─────────────────────┘
 */

import { motion, LayoutGroup } from 'framer-motion';
import { WORKSHOP_LEVELS, SKILLS_ACCELERATOR_STATUS, getActiveChain, type WorkshopLevel, type WorkflowDirection } from '../constants/workflowSections';
import { Check, Info, Globe, HardDrive, Brain, Database, Rocket, Lock, Layers, MessageSquareText, BookOpen } from 'lucide-react';

function LockedTooltip() {
  return (
    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50
      opacity-0 scale-95 translate-y-1 group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0
      transition-all duration-200 ease-out pointer-events-none">
      <div className="w-2.5 h-2.5 rotate-45 bg-popover border-l border-t border-border/50 absolute -top-[5px] left-1/2 -translate-x-1/2 z-10" />
      <div className="relative bg-popover/95 backdrop-blur-md border border-border/50 shadow-xl rounded-lg px-3.5 py-2.5 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-[12px] font-semibold text-foreground">Path is locked</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1 ml-[22px]">
          Start a new session to switch tracks.
        </p>
      </div>
    </div>
  );
}

interface LevelSelectorProps {
  selectedLevel: WorkshopLevel;
  onLevelChange: (level: WorkshopLevel) => void;
  completedSteps?: Set<number>;
  levelExplicitlySelected?: boolean;
  useCaseLockedLevel?: WorkshopLevel | null;
  hasUseCaseSelected?: boolean;
  direction?: WorkflowDirection;
}

const BUTTON_LABELS: Record<WorkshopLevel, string> = {
  'app-only': 'Databricks Apps',
  'app-database': '+ Lakebase',
  'lakehouse': 'Lakehouse',
  'lakehouse-di': '+ Data Intelligence',
  'end-to-end': 'Complete Workshop',
  'accelerator': 'Data Product Accelerator',
  'genie-accelerator': 'Genie Accelerator',
  'data-engineering-accelerator': 'Data Engineering Accelerator',
  'skills-accelerator': 'Agent Skills Accelerator',
  'reverse-lakehouse': 'Lakehouse',
  'reverse-lakehouse-di': '+ Data Intelligence',
  'reverse-lakebase': '+ Lakebase (Synced)',
  'reverse-app': '+ Analytics App',
};

const LEVEL_DESCRIPTIONS: Record<WorkshopLevel, string> = {
  'app-only': 'Build and deploy a web app with Databricks Apps',
  'app-database': 'Add a PostgreSQL database to your web app',
  'lakehouse': 'Build Bronze/Silver/Gold data pipelines',
  'lakehouse-di': 'Add Genie Spaces, Agents & AI/BI Dashboards on top of your Lakehouse',
  'end-to-end': 'The complete end-to-end workshop covering all chapters',
  'accelerator': 'Start with table metadata and build end-to-end Bronze/Silver/Gold layers that power your data intelligence',
  'genie-accelerator': 'Analyze silver metadata, design Gold layer, and build Genie Spaces with Metric Views and TVFs',
  'data-engineering-accelerator': 'Build production-ready Bronze, Silver, and Gold data pipelines using Databricks Lakehouse best practices',
  'skills-accelerator': 'Build a Data Contract Governance Skill that tags gold-layer tables and validates compliance for certification',
  'reverse-lakehouse': 'Start with Lakehouse data engineering, then sync analytics into Lakebase.',
  'reverse-lakehouse-di': 'Build Gold layer analytics and Genie Spaces, then sync into Lakebase.',
  'reverse-lakebase': 'Push curated analytics data into Lakebase PostgreSQL using Databricks Synced Tables.',
  'reverse-app': 'Design and deploy an analytics application powered by synced Lakebase data.',
};

type Track = 'app' | 'analytics' | 'full' | 'accelerator';

function getTrack(level: WorkshopLevel): Track {
  if (level === 'app-only' || level === 'app-database') return 'app';
  if (level === 'lakehouse' || level === 'lakehouse-di') return 'analytics';
  if (level === 'end-to-end') return 'full';
  return 'accelerator'; // 'accelerator', 'genie-accelerator', 'data-engineering-accelerator'
}

/**
 * Returns the set of buttons that should appear "included" (highlighted).
 * When on a progressive chain, all levels up to and including the current
 * position are highlighted to show the cumulative path.
 */
function getHighlightedButtons(selectedLevel: WorkshopLevel, completedSteps: Set<number>): Set<WorkshopLevel> {
  const chain = getActiveChain(selectedLevel, completedSteps);
  if (chain) {
    const idx = chain.indexOf(selectedLevel);
    if (idx !== -1) return new Set(chain.slice(0, idx + 1));
  }
  switch (selectedLevel) {
    case 'end-to-end':
      return new Set<WorkshopLevel>(['app-only', 'app-database', 'lakehouse', 'lakehouse-di', 'end-to-end']);
    case 'accelerator':
      return new Set<WorkshopLevel>(['accelerator']);
    case 'genie-accelerator':
      return new Set<WorkshopLevel>(['genie-accelerator']);
    case 'data-engineering-accelerator':
      return new Set<WorkshopLevel>(['data-engineering-accelerator']);
    case 'skills-accelerator':
      return new Set<WorkshopLevel>(['skills-accelerator']);
    default:
      return new Set<WorkshopLevel>([selectedLevel]);
  }
}

const TRACK_LABEL: Record<Track, string> = {
  app: 'Web App + Database',
  analytics: 'Analytics + AI',
  full: 'End to End',
  accelerator: 'Accelerators',
};

export { BUTTON_LABELS, LEVEL_DESCRIPTIONS };

/**
 * Inner grid content without wrapper card or description block.
 * Used by PathAndArchitecture to embed inside a combined collapsible card.
 */
export function LevelSelectorContent({
  selectedLevel,
  onLevelChange,
  completedSteps = new Set(),
  useCaseLockedLevel,
  hasUseCaseSelected,
  direction,
}: LevelSelectorProps) {
  return (
    <LevelSelectorGrid
      selectedLevel={selectedLevel}
      onLevelChange={onLevelChange}
      completedSteps={completedSteps}
      useCaseLockedLevel={useCaseLockedLevel}
      hasUseCaseSelected={hasUseCaseSelected}
      direction={direction}
    />
  );
}

function LevelSelectorGrid({
  selectedLevel,
  onLevelChange,
  completedSteps = new Set(),
  useCaseLockedLevel,
  hasUseCaseSelected = false,
  direction = 'forward',
}: LevelSelectorProps) {
  const highlightedButtons = getHighlightedButtons(selectedLevel, completedSteps);

  const hasStartedWorkflow = Array.from(completedSteps).some(s => s >= 2);
  const activeChain = hasStartedWorkflow ? getActiveChain(selectedLevel, completedSteps) : null;
  const chainIdx = activeChain ? activeChain.indexOf(selectedLevel) : -1;
  const isPathLocked = hasStartedWorkflow || !!useCaseLockedLevel;

  const isButtonDisabled = (level: WorkshopLevel): boolean => {
    if (useCaseLockedLevel && level !== useCaseLockedLevel) return true;
    if (level === 'skills-accelerator' && !useCaseLockedLevel && hasUseCaseSelected) return true;
    if (!hasStartedWorkflow) return false;

    if (activeChain) {
      const targetIdx = activeChain.indexOf(level);
      if (targetIdx === chainIdx) return false;
      if (targetIdx === chainIdx + 1) return false;
      return true;
    }

    return level !== selectedLevel;
  };

  const isHighlighted = (level: WorkshopLevel) => highlightedButtons.has(level);

  const getButtonClass = (level: WorkshopLevel) => {
    const isSelected = selectedLevel === level;
    const isIncluded = isHighlighted(level);
    const disabled = isButtonDisabled(level);

    if (disabled) {
      return `px-4 py-2.5 rounded-lg text-[12px] font-medium transition-all duration-200 w-full
        bg-secondary/40 text-muted-foreground/50 cursor-not-allowed`;
    } else if (isSelected) {
      return `px-4 py-2.5 rounded-lg text-[12px] font-medium transition-all duration-200 w-full
        bg-primary text-primary-foreground shadow-md ring-2 ring-primary/30`;
    } else if (isIncluded) {
      return `px-4 py-2.5 rounded-lg text-[12px] font-medium transition-all duration-200 w-full
        bg-primary/20 text-primary border border-primary/40 shadow-sm`;
    } else {
      return `px-4 py-2.5 rounded-lg text-[12px] font-medium transition-all duration-200 w-full
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

  const appHasHighlight = isHighlighted('app-only') || isHighlighted('app-database');
  const analyticsHasHighlight = isHighlighted('lakehouse') || isHighlighted('lakehouse-di');
  const endToEndHasHighlight = isHighlighted('end-to-end');

  const isAppSelected = appHasHighlight && (selectedLevel === 'app-only' || selectedLevel === 'app-database');
  const isAnalyticsSelected = analyticsHasHighlight && (selectedLevel === 'lakehouse' || selectedLevel === 'lakehouse-di');
  const isEndToEndSelected = selectedLevel === 'end-to-end';
  const isAcceleratorSelected = selectedLevel === 'accelerator' || selectedLevel === 'genie-accelerator' || selectedLevel === 'data-engineering-accelerator' || selectedLevel === 'skills-accelerator';

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

  const handleLevelClick = (level: WorkshopLevel) => {
    if (isButtonDisabled(level)) return;
    onLevelChange(level);
  };

  const renderButton = (level: WorkshopLevel, icon: React.ReactNode) => {
    const disabled = isButtonDisabled(level);
    const btn = (
      <button
        onClick={() => handleLevelClick(level)}
        disabled={disabled}
        className={getButtonClass(level)}
      >
        <div className="flex items-center gap-2.5">
          {icon}
          <span className="flex-1 text-left">{BUTTON_LABELS[level]}</span>
          {!disabled && (selectedLevel === level || isHighlighted(level)) && (
            <Check className={`w-3.5 h-3.5 flex-shrink-0 ${selectedLevel === level ? '' : 'opacity-60'}`} />
          )}
        </div>
      </button>
    );
    if (disabled) {
      return (
        <div className="relative group">
          {btn}
          <LockedTooltip />
        </div>
      );
    }
    return btn;
  };

  const columnHeader = (track: Track) => (
    <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2 text-center flex items-center justify-center gap-1.5">
      {isColumnLocked(track) && <Lock className="w-3 h-3 text-muted-foreground/60" />}
      {TRACK_LABEL[track]}
    </div>
  );

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-semibold text-foreground">
          Choose Your Workshop Path
        </span>
        {isPathLocked ? (
          <div className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${
            activeChain
              ? 'text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20'
              : 'text-amber-400/80 bg-amber-500/10 border border-amber-500/20'
          }`}>
            <Lock className="w-2.5 h-2.5" />
            <span className="font-medium">{activeChain ? 'Progressive' : 'Locked'}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">
            <Info className="w-3 h-3" />
            <span>Options within each track build on each other</span>
          </div>
        )}
      </div>

      {/* 4-Column Box Layout */}
      <LayoutGroup>
        <div className="flex gap-3">
          {direction === 'reverse' ? (
            <>
              {/* Column 1 (was Column 2): Analytics + AI */}
              <motion.div layout layoutId="col-analytics" className={getBoxClass(isAnalyticsSelected, analyticsHasHighlight && !isAnalyticsSelected, isColumnLocked('analytics'))}
                transition={{ type: 'spring', stiffness: 250, damping: 22, mass: 0.9 }}>
                {columnHeader('analytics')}
                <div className="space-y-2">
                  {renderButton('lakehouse', <Database className="w-4 h-4 flex-shrink-0" />)}
                  {renderButton('lakehouse-di', <Brain className="w-4 h-4 flex-shrink-0" />)}
                </div>
              </motion.div>

              {/* Column 2 (was Column 1): Web App + DB — Lakebase on top */}
              <motion.div layout layoutId="col-app" className={getBoxClass(isAppSelected, appHasHighlight && !isAppSelected, isColumnLocked('app'))}
                transition={{ type: 'spring', stiffness: 250, damping: 22, mass: 0.9 }}>
                {columnHeader('app')}
                <div className="space-y-2">
                  {renderButton('app-database', <HardDrive className="w-4 h-4 flex-shrink-0" />)}
                  {renderButton('app-only', <Globe className="w-4 h-4 flex-shrink-0" />)}
                </div>
              </motion.div>
            </>
          ) : (
            <>
              {/* Column 1: Web App + Database (default) */}
              <motion.div layout layoutId="col-app" className={getBoxClass(isAppSelected, appHasHighlight && !isAppSelected, isColumnLocked('app'))}
                transition={{ type: 'spring', stiffness: 250, damping: 22, mass: 0.9 }}>
                {columnHeader('app')}
                <div className="space-y-2">
                  {renderButton('app-only', <Globe className="w-4 h-4 flex-shrink-0" />)}
                  {renderButton('app-database', <HardDrive className="w-4 h-4 flex-shrink-0" />)}
                </div>
              </motion.div>

              {/* Column 2: Analytics + AI (default) */}
              <motion.div layout layoutId="col-analytics" className={getBoxClass(isAnalyticsSelected, analyticsHasHighlight && !isAnalyticsSelected, isColumnLocked('analytics'))}
                transition={{ type: 'spring', stiffness: 250, damping: 22, mass: 0.9 }}>
                {columnHeader('analytics')}
                <div className="space-y-2">
                  {renderButton('lakehouse', <Database className="w-4 h-4 flex-shrink-0" />)}
                  {renderButton('lakehouse-di', <Brain className="w-4 h-4 flex-shrink-0" />)}
                </div>
              </motion.div>
            </>
          )}

        {/* Column 3: End to End */}
        <div className={getBoxClass(isEndToEndSelected, endToEndHasHighlight && !isEndToEndSelected, isColumnLocked('full'))}>
          {columnHeader('full')}
          <div className="space-y-2">
            {renderButton('end-to-end', <Layers className="w-4 h-4 flex-shrink-0" />)}
          </div>
        </div>

        {/* Column 4: Accelerators */}
        <div className={getBoxClass(isAcceleratorSelected, false, isColumnLocked('accelerator'))}>
          {columnHeader('accelerator')}
          <div className="space-y-2">
            {/* Data Product Accelerator (New) */}
            <div className={isButtonDisabled('accelerator') ? 'relative group' : undefined}>
              <button
                onClick={() => handleLevelClick('accelerator')}
                disabled={isButtonDisabled('accelerator')}
                className={getButtonClass('accelerator')}
              >
                <div className="flex items-center gap-2.5">
                  <Rocket className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{BUTTON_LABELS['accelerator']}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                    selectedLevel === 'accelerator'
                      ? 'bg-white/20 text-primary-foreground/80 border border-white/20'
                      : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  }`}>New</span>
                  {!isButtonDisabled('accelerator') && (selectedLevel === 'accelerator' || isHighlighted('accelerator')) && (
                    <Check className={`w-3.5 h-3.5 flex-shrink-0 ${selectedLevel === 'accelerator' ? '' : 'opacity-60'}`} />
                  )}
                </div>
              </button>
              {isButtonDisabled('accelerator') && <LockedTooltip />}
            </div>

            {/* Genie Accelerator */}
            <div className={isButtonDisabled('genie-accelerator') ? 'relative group' : undefined}>
              <button
                onClick={() => handleLevelClick('genie-accelerator')}
                disabled={isButtonDisabled('genie-accelerator')}
                className={getButtonClass('genie-accelerator')}
              >
                <div className="flex items-center gap-2.5">
                  <MessageSquareText className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{BUTTON_LABELS['genie-accelerator']}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                    selectedLevel === 'genie-accelerator'
                      ? 'bg-white/20 text-primary-foreground/80 border border-white/20'
                      : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  }`}>New</span>
                  {!isButtonDisabled('genie-accelerator') && (selectedLevel === 'genie-accelerator' || isHighlighted('genie-accelerator')) && (
                    <Check className={`w-3.5 h-3.5 flex-shrink-0 ${selectedLevel === 'genie-accelerator' ? '' : 'opacity-60'}`} />
                  )}
                </div>
              </button>
              {isButtonDisabled('genie-accelerator') && <LockedTooltip />}
            </div>

            {/* Data Engineering Accelerator */}
            <div className={isButtonDisabled('data-engineering-accelerator') ? 'relative group' : undefined}>
              <button
                onClick={() => handleLevelClick('data-engineering-accelerator')}
                disabled={isButtonDisabled('data-engineering-accelerator')}
                className={getButtonClass('data-engineering-accelerator')}
              >
                <div className="flex items-center gap-2.5">
                  <Database className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{BUTTON_LABELS['data-engineering-accelerator']}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                    selectedLevel === 'data-engineering-accelerator'
                      ? 'bg-white/20 text-primary-foreground/80 border border-white/20'
                      : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                  }`}>New</span>
                  {!isButtonDisabled('data-engineering-accelerator') && (selectedLevel === 'data-engineering-accelerator' || isHighlighted('data-engineering-accelerator')) && (
                    <Check className={`w-3.5 h-3.5 flex-shrink-0 ${selectedLevel === 'data-engineering-accelerator' ? '' : 'opacity-60'}`} />
                  )}
                </div>
              </button>
              {isButtonDisabled('data-engineering-accelerator') && <LockedTooltip />}
            </div>

            {/* Agent Skills Accelerator - gated by SKILLS_ACCELERATOR_STATUS */}
            {SKILLS_ACCELERATOR_STATUS === 'coming-soon' ? (
              <button
                disabled
                title="Coming soon — Agent Skills Accelerator"
                className="px-4 py-2.5 rounded-lg text-[12px] font-medium w-full bg-secondary/50 text-muted-foreground cursor-not-allowed border border-dashed border-border"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 flex-shrink-0 opacity-70" />
                  <span className="flex-1 text-left truncate">{BUTTON_LABELS['skills-accelerator']}</span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">soon</span>
                </div>
              </button>
            ) : (
              <div className={isButtonDisabled('skills-accelerator') ? 'relative group' : undefined}>
                <button
                  onClick={() => handleLevelClick('skills-accelerator')}
                  disabled={isButtonDisabled('skills-accelerator')}
                  className={getButtonClass('skills-accelerator')}
                >
                  <div className="flex items-center gap-2.5">
                    <BookOpen className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 text-left">{BUTTON_LABELS['skills-accelerator']}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                      selectedLevel === 'skills-accelerator'
                        ? 'bg-white/20 text-primary-foreground/80 border border-white/20'
                        : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                    }`}>New</span>
                    {!isButtonDisabled('skills-accelerator') && (selectedLevel === 'skills-accelerator' || isHighlighted('skills-accelerator')) && (
                      <Check className={`w-3.5 h-3.5 flex-shrink-0 ${selectedLevel === 'skills-accelerator' ? '' : 'opacity-60'}`} />
                    )}
                  </div>
                </button>
                {isButtonDisabled('skills-accelerator') && <LockedTooltip />}
              </div>
            )}

            {/* Lakebase Accelerator - Coming Soon */}
            <button
              disabled
              title="Coming soon — Lakebase Accelerator"
              className="px-4 py-2.5 rounded-lg text-[12px] font-medium w-full bg-secondary/50 text-muted-foreground cursor-not-allowed border border-dashed border-border"
            >
              <div className="flex items-center gap-2.5">
                <HardDrive className="w-4 h-4 flex-shrink-0 opacity-70" />
                <span className="flex-1 text-left truncate">Lakebase Accelerator</span>
                <span className="text-[9px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">soon</span>
              </div>
            </button>
          </div>
        </div>
        </div>
      </LayoutGroup>
    </>
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
        : 'Progressive — App + Lakebase + Lakehouse + Data Intelligence';
    }
    const isAppSelected = selectedLevel === 'app-only' || selectedLevel === 'app-database';
    const isAnalyticsSelected = selectedLevel === 'lakehouse' || selectedLevel === 'lakehouse-di';
    const isEndToEndSelected = selectedLevel === 'end-to-end';
    const isAcceleratorSelected = selectedLevel === 'accelerator' || selectedLevel === 'genie-accelerator' || selectedLevel === 'data-engineering-accelerator' || selectedLevel === 'skills-accelerator';
    if (isAppSelected) return `Web App + Database — ${BUTTON_LABELS[selectedLevel]}`;
    if (isAnalyticsSelected) return `Analytics + AI — ${BUTTON_LABELS[selectedLevel]}`;
    if (isEndToEndSelected) return 'End to End — Complete Workshop';
    if (isAcceleratorSelected) return `Accelerators — ${BUTTON_LABELS[selectedLevel]}`;
    return BUTTON_LABELS[selectedLevel];
  })();

  const includesText = (() => {
    if (isAppChainCrossColumn) {
      return selectedLevel === 'lakehouse'
        ? 'Foundation → Databricks App → Lakebase → Lakehouse → Refinement'
        : 'Foundation → Databricks App → Lakebase → Lakehouse → Data Intelligence → Refinement';
    }
    switch (selectedLevel) {
      case 'app-only': return 'Foundation → Databricks App → Refinement';
      case 'app-database': return 'Foundation → Databricks App → Lakebase → Refinement';
      case 'lakehouse': return 'Foundation → Lakehouse → Refinement';
      case 'lakehouse-di': return 'Foundation → Lakehouse → Data Intelligence → Refinement';
      case 'end-to-end': return 'Foundation → All Sections (App, Lakebase, Lakehouse, Data Intelligence) → Refinement';
      case 'accelerator': return 'Foundation → Lakehouse → Data Intelligence → Refinement';
      case 'genie-accelerator': return 'Foundation → Silver Metadata → Gold Layer → Use-Case Plan → Genie Space → Refinement';
      case 'data-engineering-accelerator': return 'Foundation → Lakehouse (Bronze → Silver → Gold) → Refinement';
      case 'skills-accelerator': return 'Foundation → Build Agent Skill (Explore, Strategy, SKILL.md, Apply & Test, Validate) → Refinement';
      case 'reverse-lakehouse': return 'Foundation → Lakehouse → Refinement';
      case 'reverse-lakehouse-di': return 'Foundation → Lakehouse → Data Intelligence → Refinement';
      case 'reverse-lakebase': return 'Foundation → Lakehouse → Data Intelligence → Reverse ETL (Synced Tables) → Refinement';
      case 'reverse-app': return 'Foundation → Lakehouse → Data Intelligence → Reverse ETL → Refinement';
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
            <span className="text-[13px] font-semibold text-foreground">
              {descriptionLabel}:
            </span>{' '}
            <span className="text-[13px] text-muted-foreground">
              {LEVEL_DESCRIPTIONS[selectedLevel]}
            </span>
          </div>
        </div>

        {/* What's included hint */}
        <div className="mt-2 text-[11px] text-muted-foreground/80 pl-4">
          <span className="font-medium">Includes: </span>
          {includesText}
        </div>
      </div>
    </div>
  );
}
