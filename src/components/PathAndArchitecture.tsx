import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft, Lock, Map, ArrowRight, Star, Layers } from 'lucide-react';
import { LevelSelectorContent, LockedTooltip } from './LevelSelector';
import { computeLevelLockState, hasStartedWorkflow, trackTabForLevel, type LevelLockState } from '../constants/levelLock';
import { isForwardProgression } from '../constants/workflowSections';
import { useReadOnly } from '../contexts/ReadOnlyContext';
import { ArchitectureDiagramContent } from './ArchitectureDiagram';
import { PathDescriptionPanel } from './PathDescriptionPanel';
import { BorderBeamButton } from './BorderBeamButton';
import { NewBadge } from './NewBadge';
import { CopyLinkButton } from './CopyLinkButton';
import { PathDurationBar } from './PathDurationBar';
import { ALL_AI_MODULES, ALL_MEDALLION_LAYERS, type WorkshopLevel, type WorkflowDirection, type AIAgentModule, type MedallionLayer, type ChainContext } from '../constants/workflowSections';

interface PathAndArchitectureProps {
  selectedLevel: WorkshopLevel;
  chainContext?: ChainContext;
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
  includeLakehouse?: boolean;
  onIncludeLakehouseChange?: (next: boolean) => void;
  includeGenieOntology?: boolean;
  onIncludeGenieOntologyChange?: (next: boolean) => void;
  /** Workshop levels disabled for the active coding assistant. The currently-
   * selected level is grandfathered (still clickable) inside LevelSelector
   * so saved/shared sessions never break and mid-session assistant changes
   * never lose progress. */
  disabledWorkshopLevels?: Set<WorkshopLevel>;
}

export function PathAndArchitecture({
  selectedLevel,
  chainContext = null,
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
  includeLakehouse = false,
  onIncludeLakehouseChange,
  includeGenieOntology = false,
  onIncludeGenieOntologyChange,
  disabledWorkshopLevels,
}: PathAndArchitectureProps) {
  const [userOverride, setUserOverride] = useState<boolean | null>(null);
  const [prevForceCollapsed, setPrevForceCollapsed] = useState(forceCollapsed);

  if (forceCollapsed !== prevForceCollapsed) {
    setPrevForceCollapsed(forceCollapsed);
    if (forceCollapsed) setUserOverride(null);
  }

  // forceExpanded is authoritative; forceCollapsed sets the default (user can still override)
  const isExpanded = forceExpanded ? true : (userOverride ?? (forceCollapsed ? false : true));

  // Track tabs (Mock B): [★ Genie Accelerator · Recommended] [Other tracks].
  // The tab follows the selected level whenever it changes (a pick here, a
  // session load, a use-case lock, a change from Genie Code); clicking Other
  // tracks only changes the view. Same render-time sync as prevForceCollapsed.
  const tabKey = `${selectedLevel}|${direction}`;
  const [tab, setTab] = useState(() => trackTabForLevel(selectedLevel, direction));
  const [prevTabKey, setPrevTabKey] = useState(tabKey);
  if (tabKey !== prevTabKey) {
    setPrevTabKey(tabKey);
    setTab(trackTabForLevel(selectedLevel, direction));
  }
  const readOnly = useReadOnly();
  const onGenie = selectedLevel === 'genie-accelerator';
  // Picking the Genie tab selects the Genie Accelerator, so it follows the
  // picker's lock rule; Reverse ETL has no accelerators. Viewing it while it is
  // already the track is always allowed.
  // The picker's lock, then the App's guard (handleWorkshopLevelChange): once
  // started, only a forward progression goes through. The Genie Accelerator is
  // on no chain, so a started session on another track can never move to it.
  const pickerLock = computeLevelLockState('genie-accelerator', {
    selectedLevel, completedSteps, chainContext, useCaseLockedLevel, hasUseCaseSelected, direction, disabledWorkshopLevels,
  });
  const genieLock: LevelLockState | null = pickerLock
    ?? (!onGenie && hasStartedWorkflow(completedSteps) && !isForwardProgression(selectedLevel, 'genie-accelerator')
      ? { reason: 'workflow-started' }
      : null);
  const genieTabDisabled = !onGenie && (readOnly || direction === 'reverse' || genieLock !== null);
  const trackLocked = hasStartedWorkflow(completedSteps) || !!useCaseLockedLevel;
  const selectGenieTab = () => {
    if (genieTabDisabled) return;
    if (onGenie) setTab('genie');
    else onLevelChange('genie-accelerator');
  };

  // The Path Duration Bar consumes all four state inputs. Some callers may
  // omit chip/module sets, so we fall back to the all-on defaults that match
  // the rest of the app's defaulting logic in App.tsx.
  const effectiveAIModules = aiAgentsModules ?? new Set(ALL_AI_MODULES);
  const effectiveMedallionLayers = medallionLayers ?? new Set(ALL_MEDALLION_LAYERS);

  return (
    <div id="path-architecture-section" className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Clickable Header */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={() => setUserOverride(!isExpanded)}
        onKeyDown={event => {
          if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
          event.preventDefault();
          setUserOverride(!isExpanded);
        }}
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

        {/* Compact duration bar — replaces the legacy path-name pill when collapsed */}
        {!isExpanded && (
          <PathDurationBar
            level={selectedLevel}
            direction={direction}
            aiModules={effectiveAIModules}
            medallionLayers={effectiveMedallionLayers}
            completedSteps={completedSteps}
            chainContext={chainContext}
            includeLakehouse={includeLakehouse}
            includeGenieOntology={includeGenieOntology}
            variant="compact"
          />
        )}

        <CopyLinkButton sectionId="path-architecture-section" />

        <span className="inline-flex items-center gap-1 text-ui-xs font-medium text-muted-foreground border border-border rounded-full px-2.5 py-1 bg-secondary/40 group-hover:bg-secondary group-hover:text-foreground transition-colors">
          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          {isExpanded ? 'Collapse' : 'Expand'}
        </span>
      </div>

      {/* Collapsible Content */}
      <div className={`transition-all duration-300 ease-in-out ${
        isExpanded ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
      }`}>
        <div className="px-4 pb-4 space-y-4">
          {/* Estimated Build Time bar moved into LevelSelectorGrid — it now
              renders right under the "Choose Your Workshop Path" header so it
              sits adjacent to the controls that drive it, instead of leading
              the entire card. The compact variant in the collapsed-card header
              still surfaces the total when this section is folded. */}

          {/* Track tabs (Mock B) */}
          <div role="tablist" aria-label="Workshop tracks" className="flex justify-center">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-secondary/40 border border-border">
              <div className={genieTabDisabled ? 'relative group' : undefined}>
                <button
                  type="button"
                  role="tab"
                  data-testid="track-tab-genie"
                  aria-selected={tab === 'genie'}
                  aria-disabled={genieTabDisabled}
                  onClick={selectGenieTab}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-ui-sm font-medium transition-colors ${
                    tab === 'genie'
                      ? 'bg-teal-500/15 border border-teal-500/40 text-foreground font-semibold'
                      : genieTabDisabled
                        ? 'border border-transparent text-muted-foreground/40 cursor-not-allowed'
                        : 'border border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Star className="w-3.5 h-3.5 text-amber-400" />
                  <span>Genie Accelerator</span>
                  <span className="text-ui-2xs font-semibold uppercase tracking-wide text-teal-300/80">Recommended</span>
                </button>
                {genieTabDisabled && direction === 'reverse' && !readOnly && (
                  <LockedTooltip
                    reason="workflow-started"
                    title="Build Forward track"
                    body="Switch to Build Forward (under Other tracks) to use the Genie Accelerator."
                  />
                )}
                {genieTabDisabled && direction !== 'reverse' && genieLock && (
                  <LockedTooltip reason={genieLock.reason} title={genieLock.title} body={genieLock.body} />
                )}
              </div>
              <button
                type="button"
                role="tab"
                data-testid="track-tab-other"
                aria-selected={tab === 'other'}
                onClick={() => setTab('other')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-ui-sm font-medium transition-colors ${
                  tab === 'other'
                    ? 'bg-violet-500/15 border border-violet-500/40 text-foreground font-semibold'
                    : 'border border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Other tracks</span>
              </button>
            </div>
          </div>

          {/* Other tracks while the Genie Accelerator is still the track: say so,
              so Start Building never continues on a track the view hides. */}
          {tab === 'other' && onGenie && (
            <p data-testid="current-track-note" className="text-center text-ui-xs text-muted-foreground">
              Current track: <span className="font-semibold text-foreground">Genie Accelerator</span>.{' '}
              {trackLocked
                ? 'The track is locked once Set Up Project is done; start a new session to switch.'
                : 'Pick one below to switch.'}
            </p>
          )}

          {tab === 'other' && (<>
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
              {/* Forward Tab — selected styling lives directly on the
                  button (no separate sliding indicator) so each button
                  can be any width without breaking layout math. */}
              <button
                type="button"
                onClick={() => {
                  if (directionLocked && direction !== 'forward') return;
                  onDirectionChange?.('forward');
                }}
                className={`relative z-10 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200 ${
                  direction === 'forward'
                    ? 'bg-violet-500/15 border border-violet-500/40 shadow-lg shadow-violet-500/10 text-foreground font-semibold'
                    : `border border-transparent ${
                        directionLocked
                          ? 'text-muted-foreground/40 cursor-not-allowed'
                          : 'text-muted-foreground hover:text-foreground/70'
                      }`
                }`}
              >
                <ChevronRight
                  className={`w-3.5 h-3.5 transition-transform duration-300 ${direction === 'forward' ? '' : 'rotate-180'}`}
                />
                <span>Build Forward</span>
              </button>

              {/* Reverse Tab — same shape as Build Forward, plus an inline
                  <NewBadge /> matching the Agents Accelerator pattern. The
                  badge animates while still fresh (Forward direction) and
                  switches to inverted tone + static state once the user
                  has clicked into Reverse. */}
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
                className={`relative z-10 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-medium transition-all duration-200 ${
                  direction === 'reverse'
                    ? 'bg-emerald-500/15 border border-emerald-500/40 shadow-lg shadow-emerald-500/10 text-foreground font-semibold'
                    : `border border-transparent ${
                        directionLocked
                          ? 'text-muted-foreground/40 cursor-not-allowed'
                          : 'text-muted-foreground hover:text-foreground/70'
                      }`
                }`}
              >
                <ChevronLeft
                  className={`w-3.5 h-3.5 transition-transform duration-300 ${direction === 'reverse' ? '' : 'rotate-180'}`}
                />
                <span>Reverse ETL</span>
                {!directionLocked && (
                  <NewBadge
                    tone={direction === 'reverse' ? 'inverted' : 'emerald'}
                    animated={direction === 'forward'}
                  />
                )}
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
          </>)}

          {/* Level Selector Grid */}
          <LevelSelectorContent
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
            includeLakehouse={includeLakehouse}
            onIncludeLakehouseChange={onIncludeLakehouseChange}
            includeGenieOntology={includeGenieOntology}
            onIncludeGenieOntologyChange={onIncludeGenieOntologyChange}
            disabledWorkshopLevels={disabledWorkshopLevels}
            view={tab}
          />

          {/* What You'll Build — path description panel */}
          <PathDescriptionPanel selectedLevel={selectedLevel} direction={direction} />

          {/* Divider */}
          <div className="border-t border-border/50" />

          {/* Architecture Diagram */}
          <ArchitectureDiagramContent
            workshopLevel={selectedLevel}
            chainContext={chainContext}
            completedSteps={completedSteps}
            direction={direction}
            aiAgentsModules={aiAgentsModules}
            medallionLayers={medallionLayers}
            includeLakehouse={includeLakehouse}
            includeGenieOntology={includeGenieOntology}
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
