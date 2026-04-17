import { CheckCircle2 } from 'lucide-react';
import type { SelectOption } from '../api/client';

interface UseCaseCardGridProps {
  useCases: SelectOption[];
  selectedUseCase: string;
  onSelect: (useCase: string) => void;
  disabled?: boolean;
}

export function UseCaseCardGrid({ useCases, selectedUseCase, onSelect, disabled }: UseCaseCardGridProps) {
  const filtered = useCases.filter(uc => uc.value !== '' && uc.path_type !== 'skill');

  if (filtered.length === 0) return null;

  return (
    <div className="mb-5 animate-slide-up-fade">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/15 text-primary text-ui-2xs font-bold">2</span>
        <label className="text-ui-xs font-medium text-muted-foreground uppercase tracking-wider">Use Case</label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((uc, idx) => {
          const isSelected = selectedUseCase === uc.value;
          const siblingSelected = selectedUseCase !== '' && !isSelected;

          return (
            <button
              key={uc.value}
              onClick={() => !disabled && onSelect(uc.value)}
              disabled={disabled}
              className={`group relative text-left p-4 rounded-xl border-2 min-h-[72px] transition-all duration-200 animate-slide-up-fade ${
                disabled ? 'cursor-default' : 'cursor-pointer'
              } ${
                isSelected
                  ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20 shadow-md'
                  : siblingSelected
                    ? 'border-border/30 bg-card/80 opacity-60 scale-[0.98]'
                    : 'border-border/50 bg-card hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5'
              }`}
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              {isSelected && (
                <div className="absolute top-2.5 right-2.5 animate-scale-in">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                </div>
              )}
              <h4 className="text-ui-base font-semibold text-foreground pr-6">{uc.label}</h4>
            </button>
          );
        })}
      </div>
    </div>
  );
}
