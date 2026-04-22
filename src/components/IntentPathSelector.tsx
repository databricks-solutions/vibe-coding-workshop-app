import { Layers, FileCode, ArrowRight, CheckCircle2 } from 'lucide-react';

export type IntentPath = 'use_case' | 'skill' | null;

interface IntentPathSelectorProps {
  selectedPath: IntentPath;
  onSelectPath: (path: IntentPath) => void;
  disabled?: boolean;
}

const paths = [
  {
    id: 'use_case' as const,
    title: 'Build a Use Case',
    subtitle: 'Choose an industry use case from the library or create your own with AI',
    Icon: Layers,
    gradient: 'from-primary/20 to-emerald-500/20',
    selectedBorder: 'border-primary/60',
    selectedBg: 'bg-primary/5',
    selectedRing: 'ring-primary/20',
    checkColor: 'text-primary',
  },
  {
    id: 'skill' as const,
    title: 'Build a Skill',
    subtitle: 'Build a custom Agent Skill following the agentskills.io standard',
    Icon: FileCode,
    gradient: 'from-violet-500/20 to-indigo-500/20',
    selectedBorder: 'border-violet-500/60',
    selectedBg: 'bg-violet-500/5',
    selectedRing: 'ring-violet-500/20',
    checkColor: 'text-violet-400',
  },
] as const;

export function IntentPathSelector({ selectedPath, onSelectPath, disabled }: IntentPathSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
      {paths.map((path, idx) => {
        const isSelected = selectedPath === path.id;
        const siblingSelected = selectedPath !== null && !isSelected;

        return (
          <button
            key={path.id}
            onClick={() => !disabled && onSelectPath(isSelected ? null : path.id)}
            disabled={disabled}
            className={`group relative text-left p-6 rounded-xl border-2 transition-all duration-300 min-h-[160px] flex flex-col animate-slide-up-fade ${
              disabled
                ? 'cursor-default'
                : 'cursor-pointer'
            } ${
              isSelected
                ? `${path.selectedBorder} ${path.selectedBg} ring-1 ${path.selectedRing} shadow-md`
                : siblingSelected
                  ? 'border-border/30 bg-card/50 opacity-50 scale-[0.98]'
                  : 'border-border/50 bg-card hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5'
            }`}
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            {isSelected && (
              <div className="absolute top-3 right-3 animate-scale-in">
                <CheckCircle2 className={`w-5 h-5 ${path.checkColor}`} />
              </div>
            )}

            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${path.gradient} flex items-center justify-center mb-4`}>
              <path.Icon className={`w-6 h-6 ${isSelected ? path.checkColor : 'text-muted-foreground'} transition-colors`} />
            </div>

            <h3 className="text-ui-lg font-semibold text-foreground mb-1.5">{path.title}</h3>
            <p className="text-ui-sm text-muted-foreground leading-relaxed flex-1">{path.subtitle}</p>

            {!siblingSelected && !disabled && (
              <div className="flex items-center gap-1 mt-3 text-ui-xs text-muted-foreground/60">
                <span>{isSelected ? 'Selected' : 'Click to select'}</span>
                <ArrowRight className={`w-3 h-3 transition-transform duration-200 ${
                  isSelected ? 'translate-x-0' : 'group-hover:translate-x-1'
                }`} />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
