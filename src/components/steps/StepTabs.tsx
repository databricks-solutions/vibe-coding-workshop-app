/**
 * Tab bar and content chrome shared by every step panel.
 *
 * The four tabs were previously four near-identical button literals plus three
 * parallel ternaries deciding the active colour and heading, so adding or recolouring
 * a tab meant editing the same shape in four places. They are declared as data here
 * instead; the accent colour is the single thing that varies per tab.
 *
 * Extracted from WorkflowStep so a step body only has to render its own content and
 * not reproduce the surrounding frame.
 */

import type { ReactNode } from 'react';
import { CheckCircle, Workflow } from 'lucide-react';

export type StepTabId = 'prompt' | 'how_to_apply' | 'expected_output' | 'skill_blueprint';

interface TabSpec {
  id: StepTabId;
  label: ReactNode;
  /** Underline on the active tab, and the heading colour for its content. */
  accent: string;
  headingColor: string;
  heading: string;
}

const TABS: TabSpec[] = [
  {
    id: 'prompt',
    label: 'Generated Prompt',
    accent: 'border-primary',
    headingColor: 'text-primary',
    heading: '💡 Generated Prompt:',
  },
  {
    id: 'how_to_apply',
    label: 'How to Apply',
    accent: 'border-emerald-500',
    headingColor: 'text-emerald-400',
    heading: '🚀 Steps to Apply:',
  },
  {
    id: 'expected_output',
    label: (
      <>
        <CheckCircle className="w-3.5 h-3.5 inline mr-1" /> Verify Results
      </>
    ),
    accent: 'border-amber-500',
    headingColor: 'text-amber-400',
    heading: '✅ Verify Your Results:',
  },
  {
    id: 'skill_blueprint',
    label: (
      <>
        <Workflow className="w-3.5 h-3.5 inline mr-1" /> Agent Skills Navigator
      </>
    ),
    accent: 'border-cyan-500',
    headingColor: 'text-cyan-400',
    heading: '⚡ How the Agent Skills Navigator Powers This Prompt:',
  },
];

interface StepTabsProps {
  activeTab: StepTabId;
  onTabChange: (tab: StepTabId) => void;
  /** The Agent Skills Navigator tab only exists for steps that have a blueprint. */
  showSkillBlueprint?: boolean;
  /** Right-aligned actions for the active tab (copy, expand, full-screen). */
  actions?: ReactNode;
  children: ReactNode;
}

export function StepTabs({
  activeTab,
  onTabChange,
  showSkillBlueprint = false,
  actions,
  children,
}: StepTabsProps) {
  const visible = TABS.filter(t => t.id !== 'skill_blueprint' || showSkillBlueprint);
  const active = TABS.find(t => t.id === activeTab) ?? TABS[0];

  return (
    <div className="mt-4 bg-secondary/40 rounded-lg border border-border overflow-hidden">
      <div className="flex border-b border-border">
        {visible.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 px-3 py-2 text-ui-sm font-medium transition-all ${
              activeTab === tab.id
                ? `text-foreground bg-secondary/60 border-b-2 ${tab.accent} -mb-[1px]`
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-ui-sm font-medium ${active.headingColor}`}>
            {active.heading}
          </span>
          <div className="flex items-center gap-2">{actions}</div>
        </div>
        {children}
      </div>
    </div>
  );
}
