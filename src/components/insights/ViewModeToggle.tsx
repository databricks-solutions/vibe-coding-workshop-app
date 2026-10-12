import { Suspense, lazy, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Code2, Route, Sparkles } from 'lucide-react';
import type { WorkflowViewMode } from '../../hooks/useWorkflowViewMode';

import { COMPARE_PATHS_EVENT } from './pathEvents';

const PathChooserModal = lazy(() => import('./PathChooserModal'));

const OPTIONS: { id: WorkflowViewMode; label: string; icon: typeof Code2; hint: string }[] = [
  { id: 'technical', label: 'Technical', icon: Code2, hint: 'The full workshop: apps, pipelines, agents and every option' },
  { id: 'insights', label: 'Insights', icon: Sparkles, hint: 'A simpler path: get answers and dashboards from data you already have' },
];

export function ViewModeToggle({ mode, onChange }: { mode: WorkflowViewMode; onChange: (m: WorkflowViewMode) => void }) {
  const [comparing, setComparing] = useState(false);
  useEffect(() => {
    const open = () => setComparing(true);
    window.addEventListener(COMPARE_PATHS_EVENT, open);
    return () => window.removeEventListener(COMPARE_PATHS_EVENT, open);
  }, []);

  return (
    <div className="flex items-center gap-1">
      <div role="radiogroup" aria-label="Workflow view" className="relative flex items-center p-0.5 rounded-lg bg-secondary/50 border border-border/50">
        {OPTIONS.map(opt => {
          const active = mode === opt.id;
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              role="radio"
              aria-checked={active}
              aria-label={`${opt.label} view`}
              title={`${opt.label}: ${opt.hint}`}
              onClick={() => onChange(opt.id)}
              className={`relative z-10 flex items-center gap-1.5 h-8 px-2 2xl:px-3 rounded-md text-ui-sm font-medium transition-colors ${
                active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="view-mode-thumb"
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                  className="absolute inset-0 -z-10 rounded-md bg-card shadow-sm border border-border/70"
                />
              )}
              <Icon className={`w-3.5 h-3.5 ${active && opt.id === 'insights' ? 'text-primary' : ''}`} />
              <span className="hidden 2xl:inline">{opt.label}</span>
            </button>
          );
        })}
      </div>
      <button
        onClick={() => setComparing(true)}
        title="Compare paths: see every stage of Insights and Technical"
        aria-label="Compare paths"
        className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
      >
        <Route className="w-4 h-4" />
      </button>
      {comparing && (
        <Suspense fallback={null}>
          <PathChooserModal mode={mode} onChoose={onChange} onClose={() => setComparing(false)} />
        </Suspense>
      )}
    </div>
  );
}
