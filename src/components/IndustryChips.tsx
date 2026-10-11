import { useLayoutEffect, useRef, useState } from 'react';
import type { SelectOption } from '../api/client';
import { KINDS, collectionIcon, collectionTint } from './library/theme';

interface IndustryTabsProps {
  industries: SelectOption[];
  selectedIndustry: string;
  onSelect: (industry: string) => void;
  disabled?: boolean;
}

type Kind = NonNullable<SelectOption['kind']>;
const kindOf = (o: SelectOption): Kind => o.kind || 'industry';
const asCollection = (o: SelectOption) => ({ collection_id: o.value, kind: kindOf(o), icon: o.icon ?? null, color: o.color ?? null, label: o.label });

/**
 * Horizontal tab strip for collection selection. Collections are industries
 * (vertical) plus business functions and technical solutions (horizontal);
 * when more than one kind is live, an "Explore by" switch filters the tabs.
 * Renders an animated, collection-tinted underline that slides between the
 * active tab on selection. Real role="tablist" with arrow-key navigation.
 *
 * The underline is positioned imperatively (DOM-write) inside a layout effect
 * to avoid the React state churn the lint rule flags for state-driven layout
 * effects.
 *
 * Exported as both `IndustryTabs` (preferred name) and `IndustryChips`
 * (back-compat alias) so existing imports don't break.
 */
export function IndustryTabs({ industries, selectedIndustry, onSelect, disabled }: IndustryTabsProps) {
  const all = industries.filter(i => i.value !== '');
  const kinds = KINDS.filter(k => all.some(o => kindOf(o) === k.id));
  const selectedOption = all.find(o => o.value === selectedIndustry);
  const [pickedKind, setPickedKind] = useState<Kind>('industry');
  const activeKind: Kind = selectedOption ? kindOf(selectedOption) : kinds.some(k => k.id === pickedKind) ? pickedKind : kinds[0]?.id || 'industry';
  const filtered = all.filter(o => kindOf(o) === activeKind);
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
    underline.style.background = activeBtn.dataset.tint || '';
  }, [selectedIndustry, filtered.length, activeKind]);

  if (all.length === 0) return null;

  const switchKind = (k: Kind) => {
    if (disabled || k === activeKind) return;
    setPickedKind(k);
    const first = all.find(o => kindOf(o) === k);
    if (first) onSelect(first.value);
  };

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

  const multiKind = kinds.length > 1;

  return (
    <div className="mb-5 animate-slide-up-fade">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/15 text-primary text-ui-2xs font-bold">1</span>
        <label className="text-ui-xs font-medium text-muted-foreground uppercase tracking-wider">{multiKind ? 'Explore by' : 'Industry'}</label>
        {multiKind && (
          <div role="radiogroup" aria-label="Explore by" className="inline-flex items-center gap-0.5 rounded-lg bg-secondary/60 p-0.5 ring-1 ring-border/60 ml-1">
            {kinds.map(k => {
              const on = k.id === activeKind;
              const Icon = k.icon;
              return (
                <button
                  key={k.id}
                  role="radio"
                  aria-checked={on}
                  disabled={disabled}
                  onClick={() => switchKind(k.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-ui-xs font-medium transition-colors ${on ? 'bg-card text-foreground shadow-sm ring-1 ring-border/70' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <Icon className="w-3.5 h-3.5" style={on ? { color: `hsl(${k.tint.h} ${k.tint.s}% 55%)` } : undefined} />
                  {k.singular}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div
        ref={tabsRef}
        role="tablist"
        aria-label={multiKind ? 'Collection' : 'Industry'}
        className="relative flex items-end gap-1 border-b border-border/60 overflow-x-auto"
      >
        {filtered.map((industry, idx) => {
          const isSelected = selectedIndustry === industry.value;
          const tint = collectionTint(asCollection(industry));
          const Icon = collectionIcon(asCollection(industry));
          const color = `hsl(${tint.h} ${tint.s}% 55%)`;
          return (
            <button
              key={industry.value}
              role="tab"
              aria-selected={isSelected}
              aria-controls={`industry-panel-${industry.value}`}
              tabIndex={isSelected ? 0 : -1}
              data-active={isSelected ? 'true' : 'false'}
              data-tint={color}
              onClick={() => !disabled && onSelect(industry.value)}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              disabled={disabled}
              className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-ui-sm font-medium rounded-t-md whitespace-nowrap transition-colors duration-200 ${
                disabled ? 'cursor-default' : 'cursor-pointer'
              } ${
                isSelected
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              }`}
            >
              <Icon className="w-4 h-4 transition-colors" style={{ color: isSelected ? color : undefined }} />
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
      {selectedOption?.description && (
        <p className="mt-2.5 text-ui-sm text-muted-foreground">{selectedOption.description}</p>
      )}
    </div>
  );
}

// Back-compat alias so existing imports (`import { IndustryChips }`) keep working.
export const IndustryChips = IndustryTabs;
