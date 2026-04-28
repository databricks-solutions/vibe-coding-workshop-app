import { useLayoutEffect, useRef } from 'react';
import type { SelectOption } from '../api/client';

interface IndustryTabsProps {
  industries: SelectOption[];
  selectedIndustry: string;
  onSelect: (industry: string) => void;
  disabled?: boolean;
}

/**
 * Horizontal tab strip for industry selection. Renders an animated underline
 * that slides between the active tab on selection. Real role="tablist" with
 * arrow-key navigation for keyboard users.
 *
 * The underline is positioned imperatively (DOM-write) inside a layout effect
 * to avoid the React state churn the lint rule flags for state-driven layout
 * effects.
 *
 * Exported as both `IndustryTabs` (preferred name) and `IndustryChips`
 * (back-compat alias) so existing imports don't break.
 */
export function IndustryTabs({ industries, selectedIndustry, onSelect, disabled }: IndustryTabsProps) {
  const filtered = industries.filter(i => i.value !== '');
  const tabsRef = useRef<HTMLDivElement>(null);
  const underlineRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const container = tabsRef.current;
    const underline = underlineRef.current;
    if (!container || !underline) return;
    const activeBtn = container.querySelector<HTMLButtonElement>('[data-active="true"]');
    if (!activeBtn) {
      underline.style.opacity = '0';
      return;
    }
    const c = container.getBoundingClientRect();
    const a = activeBtn.getBoundingClientRect();
    underline.style.opacity = '1';
    underline.style.left = `${a.left - c.left}px`;
    underline.style.width = `${a.width}px`;
  }, [selectedIndustry, filtered.length]);

  if (filtered.length === 0) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (disabled) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const dir = e.key === 'ArrowRight' ? 1 : -1;
      const next = (idx + dir + filtered.length) % filtered.length;
      onSelect(filtered[next].value);
      const container = tabsRef.current;
      const buttons = container?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      buttons?.[next]?.focus();
    }
  };

  return (
    <div className="mb-5 animate-slide-up-fade">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/15 text-primary text-ui-2xs font-bold">1</span>
        <label className="text-ui-xs font-medium text-muted-foreground uppercase tracking-wider">Industry</label>
      </div>
      <div
        ref={tabsRef}
        role="tablist"
        aria-label="Industry"
        className="relative flex items-end gap-1 border-b border-border/60"
      >
        {filtered.map((industry, idx) => {
          const isSelected = selectedIndustry === industry.value;
          return (
            <button
              key={industry.value}
              role="tab"
              aria-selected={isSelected}
              aria-controls={`industry-panel-${industry.value}`}
              tabIndex={isSelected ? 0 : -1}
              data-active={isSelected ? 'true' : 'false'}
              onClick={() => !disabled && onSelect(industry.value)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              disabled={disabled}
              className={`relative px-4 py-2.5 text-ui-sm font-medium rounded-t-md transition-colors duration-200 ${
                disabled ? 'cursor-default' : 'cursor-pointer'
              } ${
                isSelected
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              {industry.label}
            </button>
          );
        })}
        {/* Animated underline that slides between active tabs.
            Position is set imperatively in useLayoutEffect so no extra render. */}
        <span
          ref={underlineRef}
          aria-hidden="true"
          className="absolute bottom-0 h-0.5 bg-primary rounded-full transition-all duration-300 ease-out"
          style={{ left: 0, width: 0, opacity: 0 }}
        />
      </div>
    </div>
  );
}

// Back-compat alias so existing imports (`import { IndustryChips }`) keep working.
export const IndustryChips = IndustryTabs;
