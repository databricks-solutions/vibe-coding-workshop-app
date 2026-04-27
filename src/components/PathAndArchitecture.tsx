import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronRight, ChevronLeft, Lock, Map, ArrowRight } from 'lucide-react';
import { LevelSelectorContent, BUTTON_LABELS } from './LevelSelector';
import { ArchitectureDiagramContent } from './ArchitectureDiagram';
import { BorderBeamButton } from './BorderBeamButton';
import { CopyLinkButton } from './CopyLinkButton';
import type { WorkshopLevel, WorkflowDirection, AIAgentModule, MedallionLayer } from '../constants/workflowSections';

interface PathAndArchitectureProps {
  selectedLevel: WorkshopLevel;
  onLevelChange: (level: WorkshopLevel) => void;
  completedSteps: Set<number>;
  levelExplicitlySelected?: boolean;
  forceCollapsed?: boolean;
  forceExpanded?: boolean;
  onContinue?: () => void;
  useCaseLockedLevel?: WorkshopLevel | null;
  hasUseCaseSelected?: boolean;
  direction?: WorkflowDirection;
  directionLocked?: boolean;
  onDirectionChange?: (direction: WorkflowDirection) => void;
  aiAgentsModules?: Set<AIAgentModule>;
  onAIModulesChange?: (modules: Set<AIAgentModule>) => void;
  medallionLayers?: Set<MedallionLayer>;
  onMedallionLayersChange?: (layers: Set<MedallionLayer>) => void;
}

export function PathAndArchitecture({
  selectedLevel,
  onLevelChange,
  completedSteps,
  forceCollapsed = false,
  forceExpanded = false,
  onContinue,
  useCaseLockedLevel,
  hasUseCaseSelected,
  direction = 'forward',
  directionLocked = false,
  onDirectionChange,
  aiAgentsModules,
  onAIModulesChange,
  medallionLayers,
  onMedallionLayersChange,
}: PathAndArchitectureProps) {
  const [userOverride, setUserOverride] = useState<boolean | null>(null);
  const prevForceCollapsed = useRef(forceCollapsed);

  useEffect(() => {
    if (forceCollapsed && !prevForceCollapsed.current) {
      setUserOverride(null);
    }
    prevForceCollapsed.current = forceCollapsed;
  }, [forceCollapsed]);

  // forceExpanded is authoritative; forceCollapsed sets the default (user can still override)
  const isExpanded = forceExpanded ? true : (userOverride ?? (forceCollapsed ? false : true));

  return (
    <div id="path-architecture-section" className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Clickable Header */}
      <button
        onClick={() => setUserOverride(!isExpanded)}
        className="group w-full p-4 flex items-center gap-3 hover:bg-secondary/30 transition-colors cursor-pointer"
      >
        <div className="p-2 rounded-md bg-primary/20">
          <Map className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 text-left">
          <h2 className="text-ui-md2 font-semibold text-foreground">
            Workshop Path & Architecture
          </h2>
          <p className="text-muted-foreground text-ui-base">
            Choose your track and preview the services you'll build
          </p>
        </div>

        {/* Selected path badge when collapsed */}
        {!isExpanded && (
          <span className="text-ui-xs font-medium text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
            {BUTTON_LABELS[selectedLevel]}
          </span>
        )}

        <CopyLinkButton sectionId="path-architecture-section" />

        <span className="inline-flex items-center gap-1 text-ui-xs font-medium text-muted-foreground border border-border rounded-full px-2.5 py-1 bg-secondary/40 group-hover:bg-secondary group-hover:text-foreground transition-colors">
          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          {isExpanded ? 'Collapse' : 'Expand'}
        </span>
      </button>

      {/* Collapsible Content */}
      <div className={`transition-all duration-300 ease-in-out ${
        isExpanded ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
      }`}>
        <div className="px-4 pb-4 space-y-4">
          {/* Direction Toggle */}
          <div className="flex justify-center mb-4">
            <div
              className={`relative inline-flex items-center p-1 rounded-full bg-slate-800/80 backdrop-blur-sm border border-border/50 direction-toggle-press ${
                directionLocked ? 'animate-direction-lock-pulse' : ''
              }`}
              style={
                {
                  '--lock-accent':
                    direction === 'forward' ? 'rgba(139, 92, 246, 0.4)' : 'rgba(52, 211, 153, 0.4)',
                } as React.CSSProperties
              }
            >
              {/* Sliding Indicator */}
              <motion.div
                layoutId="direction-indicator"
                className={`absolute top-1 bottom-1 rounded-full transition-colors duration-200 ${
                  direction === 'forward'
                    ? 'bg-violet-500/15 border border-violet-500/40 shadow-lg shadow-violet-500/10'
                    : 'bg-emerald-500/15 border border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                }`}
                style={{ width: 'calc(50% - 2px)', left: direction === 'forward' ? '4px' : 'calc(50% + 2px)' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.8 }}
              />

              {/* Forward Tab */}
              <button
                type="button"
                onClick={() => {
                  if (directionLocked && direction !== 'forward') return;
                  onDirectionChange?.('forward');
                }}
                className={`relative z-10 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-medium transition-colors duration-200 ${
                  direction === 'forward'
                    ? 'text-foreground font-semibold'
                    : directionLocked
                      ? 'text-muted-foreground/40 cursor-not-allowed'
                      : 'text-muted-foreground hover:text-foreground/70'
                }`}
              >
                <ChevronRight
                  className={`w-3.5 h-3.5 transition-transform duration-300 ${direction === 'forward' ? '' : 'rotate-180'}`}
                />
                <span>Build Forward</span>
              </button>

              {/* Reverse Tab — glows gently while the user is on Forward
                  direction so they notice the alternate flow exists. Glow
                  stops as soon as the user flips to reverse, and is suppressed
                  entirely when the direction is locked. */}
              <button
                type="button"
                onClick={() => {
                  if (directionLocked && direction !== 'reverse') return;
                  onDirectionChange?.('reverse');
                }}
                title={
                  direction === 'forward' && !directionLocked
                    ? 'Try Reverse ETL — flip the flow to start from Lakehouse Gold and sync into a Lakebase-powered analytics app.'
                    : undefined
                }
                className={`relative z-10 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-medium transition-colors duration-200 ${
                  direction === 'reverse'
                    ? 'text-foreground font-semibold'
                    : directionLocked
                      ? 'text-muted-foreground/40 cursor-not-allowed'
                      : 'text-muted-foreground hover:text-foreground/70 animate-reverse-etl-hint-glow'
                }`}
              >
                <ChevronLeft
                  className={`w-3.5 h-3.5 transition-transform duration-300 ${direction === 'reverse' ? '' : 'rotate-180'}`}
                />
                <span>Reverse ETL</span>
              </button>

              {/* Lock Icon */}
              {directionLocked && (
                <div className="absolute -right-7 top-1/2 -translate-y-1/2 animate-lock-icon-enter">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground/60" />
                </div>
              )}
            </div>
          </div>

          {/* Direction description — short write-up so users understand what
              each mode means before picking one. The currently-selected mode's
              description is highlighted; the other is dimmed to signal it's
              the alternate option. */}
          <div className="grid grid-cols-2 gap-3 max-w-2xl mx-auto -mt-2 mb-2 text-center">
            <div
              className={`rounded-lg px-3 py-2 border transition-all duration-200 ${
                direction === 'forward'
                  ? 'border-violet-500/40 bg-violet-500/[0.06] text-foreground'
                  : 'border-border/40 bg-slate-800/30 text-muted-foreground opacity-70'
              }`}
            >
              <p className="text-ui-xs font-semibold mb-0.5 flex items-center justify-center gap-1.5">
                <ChevronRight className="w-3 h-3" /> Build Forward
              </p>
              <p className="text-ui-3xs leading-snug">
                Start with a Databricks App + Lakebase, layer in Bronze → Silver → Gold in the Lakehouse,
                and activate AI/BI dashboards, Genie Spaces, and agents on top.
              </p>
            </div>
            <div
              className={`rounded-lg px-3 py-2 border transition-all duration-200 ${
                direction === 'reverse'
                  ? 'border-emerald-500/40 bg-emerald-500/[0.06] text-foreground'
                  : 'border-emerald-500/20 bg-emerald-500/[0.02] text-muted-foreground'
              }`}
            >
              <p className="text-ui-xs font-semibold mb-0.5 flex items-center justify-center gap-1.5">
                <ChevronLeft className="w-3 h-3" /> Reverse ETL
              </p>
              <p className="text-ui-3xs leading-snug">
                Start with curated Gold data in the Lakehouse, sync it back into Lakebase via Synced Tables,
                and build an analytics-serving app powered by that data.
              </p>
            </div>
          </div>

          {/* Level Selector Grid */}
          <LevelSelectorContent
            selectedLevel={selectedLevel}
            onLevelChange={onLevelChange}
            completedSteps={completedSteps}
            useCaseLockedLevel={useCaseLockedLevel}
            hasUseCaseSelected={hasUseCaseSelected}
            direction={direction}
            aiAgentsModules={aiAgentsModules}
            onAIModulesChange={onAIModulesChange}
            medallionLayers={medallionLayers}
            onMedallionLayersChange={onMedallionLayersChange}
          />

          {/* Divider */}
          <div className="border-t border-border/50" />

          {/* Architecture Diagram */}
          <ArchitectureDiagramContent
            workshopLevel={selectedLevel}
            completedSteps={completedSteps}
            direction={direction}
            aiAgentsModules={aiAgentsModules}
            medallionLayers={medallionLayers}
          />

          {/* Continue CTA */}
          {onContinue && (
            <div className="flex justify-end pt-2">
              <BorderBeamButton
                active
                onClick={() => {
                  setUserOverride(null);
                  onContinue();
                }}
                className="flex items-center gap-2 px-5 py-2.5 text-ui-base font-medium"
              >
                <span>Start Building</span>
                <ArrowRight className="w-4 h-4" />
              </BorderBeamButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
