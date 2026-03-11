import { useState, useEffect, useRef } from 'react';
import { PromptGenerator } from './PromptGenerator';
import type { WorkshopLevel } from '../constants/workflowSections';

interface DefineIntentSectionProps {
  selectedIndustry: string;
  selectedUseCase: string;
  selectedIndustryLabel?: string;
  selectedUseCaseLabel?: string;
  customUseCaseLabel?: string;
  customDescription?: string;
  initialPrompt?: string;
  initialBrandUrl?: string;
  isComplete: boolean;
  isSessionLoaded?: boolean;
  workshopLevel: WorkshopLevel;
  dataRefreshKey?: number;
  /** When true, defaults the section to collapsed (user can still manually expand). */
  forceCollapsed?: boolean;
  /** When true, forces the section expanded (user cannot collapse). */
  forceExpanded?: boolean;
  onIntentDefined: (prompt: string, industry: string, useCase: string, industryLabel?: string, useCaseLabel?: string, customDescription?: string) => void;
  onBrandUrlChange?: (url: string) => void;
}

/**
 * Standalone top-level section for defining workshop intent.
 * Wraps PromptGenerator and manages auto-collapse on completion.
 *
 * Uses derived state for expand/collapse to eliminate timing issues:
 * - autoExpanded is computed from props on every render (no effects needed)
 * - userOverride only tracks manual toggles
 */
export function DefineIntentSection({
  selectedIndustry,
  selectedUseCase,
  selectedIndustryLabel,
  selectedUseCaseLabel,
  customUseCaseLabel,
  customDescription,
  initialPrompt,
  initialBrandUrl,
  isComplete,
  isSessionLoaded = false,
  workshopLevel,
  dataRefreshKey,
  forceCollapsed = false,
  forceExpanded = false,
  onIntentDefined,
  onBrandUrlChange,
}: DefineIntentSectionProps) {
  // Tracks user's manual expand/collapse toggle; null = use auto behavior
  const [userOverride, setUserOverride] = useState<boolean | null>(null);
  const prevForceCollapsed = useRef(forceCollapsed);

  // Intent is defined when industry + use case are selected (matches PromptGenerator's "Done" badge)
  // OR when step 1 is formally in completedSteps
  const intentDefined = isComplete || (!!selectedIndustry && !!selectedUseCase);

  // Reset user override when forceCollapsed transitions to true
  useEffect(() => {
    if (forceCollapsed && !prevForceCollapsed.current) {
      setUserOverride(null);
    }
    prevForceCollapsed.current = forceCollapsed;
  }, [forceCollapsed]);

  // forceExpanded is authoritative; forceCollapsed sets the default (user can still override)
  const autoExpanded = isSessionLoaded ? !intentDefined : false;
  const isExpanded = forceExpanded ? true : (userOverride !== null ? userOverride : (forceCollapsed ? false : autoExpanded));

  // When intent becomes defined mid-session, reset override so auto-collapse kicks in
  useEffect(() => {
    if (intentDefined) {
      setUserOverride(null);
    }
  }, [intentDefined]);

  const handleToggle = () => setUserOverride(!isExpanded);

  const summaryText = intentDefined
    ? customUseCaseLabel || selectedUseCaseLabel || selectedUseCase || 'Intent defined'
    : '';

  return (
    <div id="define-intent-section">
      <PromptGenerator
        onPromptGenerated={onIntentDefined}
        onBrandUrlChange={onBrandUrlChange}
        initialIndustry={selectedIndustry}
        initialUseCase={selectedUseCase}
        initialPrompt={initialPrompt}
        initialCustomUseCaseLabel={customUseCaseLabel}
        initialCustomDescription={customDescription}
        initialBrandUrl={initialBrandUrl}
        isExpanded={isExpanded}
        onToggleExpand={handleToggle}
        prerequisitesCompleted={true}
        dataRefreshKey={dataRefreshKey}
        workshopLevel={workshopLevel}
      />
      {/* Summary line visible when collapsed and complete */}
      {!isExpanded && intentDefined && summaryText && (
        <div className="mt-1 px-5 pb-0">
          <p className="text-[11px] text-muted-foreground/60 truncate">
            {selectedIndustryLabel || selectedIndustry}
            {summaryText !== (selectedIndustryLabel || selectedIndustry) && ` › ${summaryText}`}
          </p>
        </div>
      )}
    </div>
  );
}
