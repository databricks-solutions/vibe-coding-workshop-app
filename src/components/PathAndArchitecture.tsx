import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Map, ArrowRight } from 'lucide-react';
import { LevelSelectorContent, BUTTON_LABELS } from './LevelSelector';
import { ArchitectureDiagramContent } from './ArchitectureDiagram';
import { BorderBeamButton } from './BorderBeamButton';
import { CopyLinkButton } from './CopyLinkButton';
import type { WorkshopLevel } from '../constants/workflowSections';

interface PathAndArchitectureProps {
  selectedLevel: WorkshopLevel;
  onLevelChange: (level: WorkshopLevel) => void;
  completedSteps: Set<number>;
  levelExplicitlySelected?: boolean;
  forceCollapsed?: boolean;
  forceExpanded?: boolean;
  onContinue?: () => void;
  useCaseLockedLevel?: WorkshopLevel | null;
}

export function PathAndArchitecture({
  selectedLevel,
  onLevelChange,
  completedSteps,
  forceCollapsed = false,
  forceExpanded = false,
  onContinue,
  useCaseLockedLevel,
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
          <h2 className="text-[15px] font-semibold text-foreground">
            Workshop Path & Architecture
          </h2>
          <p className="text-muted-foreground text-[13px]">
            Choose your track and preview the services you'll build
          </p>
        </div>

        {/* Selected path badge when collapsed */}
        {!isExpanded && (
          <span className="text-[11px] font-medium text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
            {BUTTON_LABELS[selectedLevel]}
          </span>
        )}

        <CopyLinkButton sectionId="path-architecture-section" />

        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground border border-border rounded-full px-2.5 py-1 bg-secondary/40 group-hover:bg-secondary group-hover:text-foreground transition-colors">
          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          {isExpanded ? 'Collapse' : 'Expand'}
        </span>
      </button>

      {/* Collapsible Content */}
      <div className={`transition-all duration-300 ease-in-out ${
        isExpanded ? 'max-h-[3000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
      }`}>
        <div className="px-4 pb-4 space-y-4">
          {/* Level Selector Grid */}
          <LevelSelectorContent
            selectedLevel={selectedLevel}
            onLevelChange={onLevelChange}
            completedSteps={completedSteps}
            useCaseLockedLevel={useCaseLockedLevel}
          />

          {/* Divider */}
          <div className="border-t border-border/50" />

          {/* Architecture Diagram */}
          <ArchitectureDiagramContent
            workshopLevel={selectedLevel}
            completedSteps={completedSteps}
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
                className="flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium"
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
