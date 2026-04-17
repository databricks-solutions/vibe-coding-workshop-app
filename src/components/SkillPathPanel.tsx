import { FileCode, Sparkles } from 'lucide-react';
import type { SelectOption } from '../api/client';
import { UseCaseDescriptionBox } from './UseCaseDescriptionBox';

interface SkillPathPanelProps {
  skills: Record<string, SelectOption[]>;
  promptTemplates: Record<string, Record<string, string>>;
  onGetStarted: (industry: string, useCase: string, industryLabel: string, useCaseLabel: string, description: string) => void;
  hasStarted: boolean;
}

const SKILL_STEPS = [
  'Explore Existing Skills',
  'Define Skill Strategy',
  'Create SKILL.md',
  'Apply & Test Skill',
  'Validate & Automate',
];

export function SkillPathPanel({ skills, promptTemplates, onGetStarted, hasStarted }: SkillPathPanelProps) {
  const skillEntry = Object.entries(skills).flatMap(([industry, items]) =>
    items.map(item => ({ industry, ...item }))
  )[0];

  if (!skillEntry) return null;

  const description = promptTemplates[skillEntry.industry]?.[skillEntry.value] || '';

  const handleStart = () => {
    onGetStarted(
      skillEntry.industry,
      skillEntry.value,
      'Sample',
      skillEntry.label,
      description
    );
  };

  return (
    <div className="animate-slide-up-fade">
      <div className="flex flex-col items-center text-center py-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center mb-4">
          <FileCode className="w-8 h-8 text-violet-400" />
        </div>
        <h3 className="text-ui-xl font-bold text-foreground mb-1">Build an Agent Skill</h3>
        <p className="text-ui-base text-muted-foreground mb-6 max-w-md">
          Follow the agentskills.io standard to create a production-ready skill
        </p>
      </div>

      {description && (
        <UseCaseDescriptionBox
          content={description}
          useCase={skillEntry.label}
          heading="Skill Description:"
        />
      )}

      <div className="mb-6">
        <p className="text-ui-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 text-center">
          Your journey
        </p>
        <div className="flex items-center justify-center gap-0">
          {SKILL_STEPS.map((step, idx) => (
            <div key={step} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-violet-500/40 border border-violet-500/60" />
                <span className="text-ui-2xs text-muted-foreground/70 mt-1.5 max-w-[72px] text-center leading-tight">
                  {step}
                </span>
              </div>
              {idx < SKILL_STEPS.length - 1 && (
                <div className="w-8 h-px bg-border mx-1 mb-5" />
              )}
            </div>
          ))}
        </div>
      </div>

      {!hasStarted && (
        <div className="border-beam-wrapper w-full">
          <button
            onClick={handleStart}
            className="w-full py-2.5 px-4 rounded-[calc(0.5rem-2px)] relative z-10 bg-violet-600 text-white hover:bg-violet-500 transition-all flex items-center justify-center gap-2 text-ui-base font-medium"
          >
            <Sparkles className="w-4 h-4" />
            Get Started with Skills
          </button>
        </div>
      )}
    </div>
  );
}
