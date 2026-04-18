import { Check } from 'lucide-react';
import type { SelectOption } from '../api/client';

interface IndustryChipsProps {
  industries: SelectOption[];
  selectedIndustry: string;
  onSelect: (industry: string) => void;
  disabled?: boolean;
}

export function IndustryChips({ industries, selectedIndustry, onSelect, disabled }: IndustryChipsProps) {
  const filtered = industries.filter(i => i.value !== '');

  if (filtered.length === 0) return null;

  return (
    <div className="mb-5 animate-slide-up-fade">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/15 text-primary text-ui-2xs font-bold">1</span>
        <label className="text-ui-xs font-medium text-muted-foreground uppercase tracking-wider">Industry</label>
      </div>
      <div className="flex flex-wrap gap-2">
        {filtered.map((industry) => {
          const isSelected = selectedIndustry === industry.value;
          return (
            <button
              key={industry.value}
              onClick={() => !disabled && onSelect(industry.value)}
              disabled={disabled}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-ui-sm font-medium transition-all duration-200 ${
                disabled ? 'cursor-default' : 'cursor-pointer'
              } ${
                isSelected
                  ? 'bg-primary/15 text-primary border border-primary/40 shadow-sm'
                  : selectedIndustry
                    ? 'bg-secondary/30 text-muted-foreground/70 border border-transparent hover:bg-secondary/50 hover:text-foreground'
                    : 'bg-secondary/40 text-muted-foreground border border-transparent hover:bg-secondary/70 hover:text-foreground hover:shadow-sm hover:-translate-y-px'
              }`}
            >
              {isSelected && <Check className="w-3.5 h-3.5 animate-scale-in" />}
              {industry.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
