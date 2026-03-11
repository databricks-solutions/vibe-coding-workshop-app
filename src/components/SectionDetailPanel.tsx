import { ArrowRight, Check, ChevronRight, Target, FileText, Sparkles } from 'lucide-react';
import { type WorkflowSection } from '../constants/workflowSections';

interface SectionDetailPanelProps {
  sectionId: string | null;
  completedSteps: Set<number>;
  onStartSection: () => void;
  onStepClick: (stepNumber: number) => void;
  visibleSections: WorkflowSection[];
}

export function SectionDetailPanel({
  sectionId,
  completedSteps,
  onStartSection,
  onStepClick,
  visibleSections,
}: SectionDetailPanelProps) {
  // Check if step 4 (UI Design) is complete
  const isStep4Complete = completedSteps.has(4);

  const isStepComplete = (stepNum: number) => {
    if (stepNum === 4) return isStep4Complete;
    return completedSteps.has(stepNum);
  };

  if (!sectionId) {
    // Show welcome/overview when no section is selected
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-emerald-500/20 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Welcome to Vibe Coding Workshop
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            Select a section from the sidebar to see details about each phase of the workshop. 
            Click on the section header to view its focus and description.
          </p>
          <div className="flex items-center justify-center gap-2 text-[12px] text-muted-foreground">
            <ChevronRight className="w-4 h-4" />
            <span>Click any section to get started</span>
          </div>
        </div>
      </div>
    );
  }

  const section = visibleSections.find(s => s.id === sectionId);
  if (!section) return null;

  const Icon = section.icon;
  const completedCount = section.steps.filter(s => isStepComplete(s.number)).length;
  const totalSteps = section.steps.length;
  const isSectionComplete = completedCount === totalSteps;
  const progressPercent = (completedCount / totalSteps) * 100;

  // Find first incomplete step
  const firstIncompleteStep = section.steps.find(s => !isStepComplete(s.number));

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-300">
      {/* Section Header - Hero area */}
      <div className={`${section.bgColor} border-b ${section.borderColor} p-6`}>
        <div className="flex items-start gap-4">
          {/* Large Section Icon */}
          <div className={`w-14 h-14 rounded-xl ${section.bgColor} border ${section.borderColor} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`w-7 h-7 ${section.color}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            {/* Chapter Label */}
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${section.color}`}>
              {section.chapter}
            </span>
            
            {/* Section Title */}
            <h1 className="text-2xl font-bold text-foreground mt-0.5 mb-2">
              {section.title}
            </h1>
            
            {/* Progress Bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-secondary/60 rounded-full overflow-hidden max-w-xs">
                <div 
                  className={`h-full transition-all duration-500 ${
                    isSectionComplete 
                      ? 'bg-emerald-500' 
                      : 'bg-gradient-to-r from-primary to-primary/70'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className={`text-[12px] font-semibold ${
                isSectionComplete ? 'text-emerald-400' : 'text-foreground'
              }`}>
                {completedCount}/{totalSteps} complete
              </span>
              {isSectionComplete && (
                <div className="flex items-center gap-1 text-emerald-400">
                  <Check className="w-4 h-4" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Focus Card */}
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className={`w-4 h-4 ${section.color}`} />
            <h3 className="text-[13px] font-semibold text-foreground">Focus</h3>
          </div>
          <p className="text-[14px] text-foreground leading-relaxed">
            {section.focus}
          </p>
        </div>

        {/* Description Card */}
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className={`w-4 h-4 ${section.color}`} />
            <h3 className="text-[13px] font-semibold text-foreground">Description</h3>
          </div>
          <p className="text-[14px] text-muted-foreground leading-relaxed">
            {section.description}
          </p>
        </div>

        {/* Steps Overview */}
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-secondary/30">
            <h3 className="text-[13px] font-semibold text-foreground">Steps in this Section</h3>
          </div>
          <div className="divide-y divide-border">
            {section.steps.map((step) => {
              const isComplete = isStepComplete(step.number);
              const isNext = firstIncompleteStep?.number === step.number;

              return (
                <button
                  key={step.number}
                  onClick={() => onStepClick(step.number)}
                  className={`w-full flex items-center gap-3 px-4 py-3 transition-all text-left ${
                    isNext
                      ? `${section.bgColor} hover:opacity-90`
                      : isComplete
                      ? 'bg-emerald-500/5 hover:bg-emerald-500/10'
                      : 'hover:bg-secondary/50'
                  }`}
                >
                  {/* Step Number */}
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold ${
                    isComplete
                      ? 'bg-emerald-500 text-white'
                      : isNext
                      ? `${section.bgColor} ${section.color} border ${section.borderColor}`
                      : 'bg-secondary text-muted-foreground'
                  }`}>
                    {isComplete ? (
                      <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                    ) : (
                      step.number
                    )}
                  </div>

                  {/* Step Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] font-medium ${
                      isComplete 
                        ? 'text-emerald-400 line-through' 
                        : isNext
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    }`}>
                      {step.title}
                    </p>
                  </div>

                  {/* Status / Action */}
                  {isNext && (
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${section.bgColor} ${section.color}`}>
                      Up Next
                    </span>
                  )}
                  {isComplete && (
                    <span className="text-[10px] font-medium text-emerald-400">
                      ✓ Done
                    </span>
                  )}
                  
                  <ChevronRight className={`w-4 h-4 flex-shrink-0 ${
                    isComplete ? 'text-emerald-400/50' : 'text-muted-foreground'
                  }`} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      {!isSectionComplete && firstIncompleteStep && (
        <div className="p-4 border-t border-border bg-card">
          <button
            onClick={onStartSection}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-[13px] transition-all ${
              section.bgColor
            } ${section.color} border ${section.borderColor} hover:opacity-90`}
          >
            <span>Continue to Step {firstIncompleteStep.number}: {firstIncompleteStep.title}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {isSectionComplete && (
        <div className="p-4 border-t border-border bg-emerald-500/10">
          <div className="flex items-center justify-center gap-2 text-emerald-400">
            <Check className="w-5 h-5" />
            <span className="font-semibold text-[13px]">Section Complete!</span>
          </div>
        </div>
      )}
    </div>
  );
}
