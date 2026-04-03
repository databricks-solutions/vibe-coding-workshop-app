import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronDown, Check, SkipForward } from 'lucide-react';
import { StepStatusLegend } from './StepStatusLegend';
import type { WorkflowSection } from '../constants/workflowSections';
import { SessionParametersPopover } from './session';

interface SectionedWorkflowSidebarProps {
  completedSteps: Set<number>;
  skippedSteps?: Set<number>;
  expandedStep: number | null;
  expandedSectionId: string | null;
  selectedSectionId: string | null;
  onSectionClick: (sectionId: string) => void;
  onSectionToggle: (sectionId: string) => void;
  onStepClick: (stepNumber: number) => void;
  visibleSections: WorkflowSection[];
  sessionId: string | null;
  onParametersChanged?: () => void;
}

export function SectionedWorkflowSidebar({
  completedSteps,
  skippedSteps = new Set(),
  expandedStep,
  expandedSectionId,
  selectedSectionId,
  onSectionClick,
  onSectionToggle,
  onStepClick,
  visibleSections,
  sessionId,
  onParametersChanged,
}: SectionedWorkflowSidebarProps) {
  // Check if step 4 (UI Design) is complete
  const isStep4Complete = completedSteps.has(4);

  const isStepComplete = (stepNum: number) => {
    if (stepNum === 4) return isStep4Complete;
    return completedSteps.has(stepNum);
  };

  const isStepDoneOrSkipped = (stepNum: number) => {
    return isStepComplete(stepNum) || skippedSteps.has(stepNum);
  };

  // Calculate completion for each section (completed + skipped both count for progress)
  const getSectionCompletion = (section: WorkflowSection) => {
    const completed = section.steps.filter(s => isStepDoneOrSkipped(s.number)).length;
    return { completed, total: section.steps.length };
  };

  // Overall progress - based on visible sections only
  const totalSteps = visibleSections.reduce((acc, s) => acc + s.steps.length, 0);
  const totalCompleted = visibleSections.reduce((acc, section) => {
    return acc + section.steps.filter(s => isStepDoneOrSkipped(s.number)).length;
  }, 0);
  const progressPercent = Math.round((totalCompleted / totalSteps) * 100);

  const sidebarScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll sidebar so the active section + step are near the top
  useEffect(() => {
    if (expandedStep == null) return;
    const section = visibleSections.find(s => s.steps.some(st => st.number === expandedStep));
    if (!section) return;
    // Small delay to let the section expand and render its steps
    setTimeout(() => {
      const container = sidebarScrollRef.current;
      if (!container) return;
      const sectionEl = container.querySelector(`[data-sidebar-section="${section.id}"]`) as HTMLElement | null;
      if (sectionEl) {
        const containerRect = container.getBoundingClientRect();
        const sectionRect = sectionEl.getBoundingClientRect();
        const scrollTop = container.scrollTop + (sectionRect.top - containerRect.top) - 8;
        container.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
      }
    }, 150);
  }, [expandedStep, visibleSections]);

  return (
    <div className="bg-card rounded-xl border border-border h-full flex flex-col overflow-hidden">
      {/* Header with overall progress */}
      <div className="p-4 border-b border-border bg-secondary/30">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[13px] font-semibold text-foreground">Workshop Progress</h3>
          <SessionParametersPopover sessionId={sessionId} onParametersChanged={onParametersChanged} />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-[11px] font-semibold text-foreground tabular-nums">
            {totalCompleted}/{totalSteps}
          </span>
        </div>
      </div>

      {/* Top Legend */}
      <div className="px-3 py-2 border-b border-border bg-secondary/10">
        <StepStatusLegend />
      </div>

      {/* Sections List */}
      <div ref={sidebarScrollRef} className="flex-1 overflow-y-auto p-2 space-y-2">
        <AnimatePresence mode="popLayout">
          {visibleSections.map((section) => {
            const { completed, total } = getSectionCompletion(section);
            const isExpanded = expandedSectionId === section.id;
            const isSelected = selectedSectionId === section.id;
            const isSectionComplete = completed === total;
            const Icon = section.icon;

            return (
              <motion.div
                key={section.id}
                layout
                layoutId={`sidebar-section-${section.id}`}
                data-sidebar-section={section.id}
                initial={false}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                className={`rounded-lg border transition-colors duration-200 ${
                  isSelected
                    ? `${section.bgColor} ${section.borderColor} border-2 shadow-sm`
                    : isExpanded
                      ? 'bg-secondary/40 border-border'
                      : 'border-transparent hover:bg-secondary/30'
                }`}
              >
              {/* Section Header */}
              <button
                onClick={() => onSectionClick(section.id)}
                className="w-full text-left"
              >
                <div className="flex items-center gap-3 p-3">
                  {/* Section Icon with progress ring */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-10 h-10 rounded-lg ${section.bgColor} flex items-center justify-center transition-all`}>
                      <Icon className={`w-5 h-5 ${section.color}`} />
                    </div>
                    {/* Completion indicator */}
                    {isSectionComplete && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center shadow-sm">
                        <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                      </div>
                    )}
                  </div>

                  {/* Title and Progress */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${section.color}`}>
                        {section.chapter}
                      </span>
                    </div>
                    <h4 className={`text-[13px] font-semibold truncate ${
                      isSectionComplete ? 'text-muted-foreground' : 'text-foreground'
                    }`}>
                      {section.title}
                    </h4>
                    {/* Mini progress bar */}
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-300 ${
                            isSectionComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-primary/80 to-primary'
                          }`}
                          style={{ width: `${(completed / total) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                        {completed}/{total}
                      </span>
                    </div>
                  </div>

                  {/* Expand/Collapse Toggle */}
                  <button
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      onSectionToggle(section.id); 
                    }}
                    className={`p-1.5 rounded-md transition-all ${
                      isExpanded 
                        ? 'bg-secondary text-foreground' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                    }`}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </button>

              {/* Expanded Steps */}
              {isExpanded && (
                <div className="px-3 pb-3 animate-in slide-in-from-top-2 duration-200">
                  <div className="ml-2 pl-4 border-l-2 border-border/50 space-y-0.5">
                    {section.steps.map((step) => {
                      const isComplete = isStepComplete(step.number);
                      const isSkipped = skippedSteps.has(step.number);
                      const isActive = expandedStep === step.number;

                      return (
                        <button
                          key={step.number}
                          data-sidebar-step={step.number}
                          onClick={() => onStepClick(step.number)}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md transition-all text-left ${
                            isActive
                              ? 'bg-primary/15 border border-primary/30'
                              : isSkipped
                              ? 'hover:bg-amber-500/10'
                              : isComplete
                              ? 'hover:bg-emerald-500/10'
                              : 'hover:bg-secondary/60'
                          }`}
                        >
                          {/* Step Status Icon */}
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[9px] font-bold transition-all ${
                            isSkipped
                              ? 'bg-amber-500/30 text-amber-400'
                              : isComplete
                              ? 'bg-emerald-500 text-white'
                              : isActive
                              ? `${section.bgColor} ${section.color}`
                              : 'bg-secondary text-muted-foreground'
                          }`}>
                            {isSkipped ? (
                              <SkipForward className="w-3 h-3" />
                            ) : isComplete ? (
                              <Check className="w-3 h-3" strokeWidth={2.5} />
                            ) : (
                              step.number
                            )}
                          </div>

                          {/* Step Title */}
                          <span className={`text-[11px] font-medium flex-1 truncate ${
                            isActive
                              ? 'text-foreground'
                              : isSkipped
                              ? 'text-amber-400/70 line-through'
                              : isComplete
                              ? 'text-emerald-400/80 line-through'
                              : 'text-muted-foreground'
                          }`}>
                            {step.title}
                          </span>

                          {/* Active indicator */}
                          {isActive && (
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Footer Legend */}
      <div className="p-3 border-t border-border bg-secondary/20">
        <StepStatusLegend />
      </div>
    </div>
  );
}
