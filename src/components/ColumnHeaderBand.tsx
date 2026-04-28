import { createElement } from 'react';
import type { CategoryOrder } from './outcomeMapTheme';
import { THEMES } from './outcomeMapTheme';

interface ColumnHeaderBandProps {
  title: string;
  count: number;
  themeOrder: CategoryOrder;
  /** Stagger the band's entrance so columns appear left-to-right */
  staggerIndex: number;
}

/**
 * Slide-style coloured header band for a single outcome-map column. Carries
 * the column theme icon, title with tight letter-spacing, animated use-case-
 * count chip, and a one-time diagonal shimmer sweep on first paint.
 */
export function ColumnHeaderBand({ title, count, themeOrder, staggerIndex }: ColumnHeaderBandProps) {
  const theme = THEMES[themeOrder];

  return (
    <div
      className={`relative overflow-hidden rounded-t-2xl ${theme.headerBand} px-4 py-3.5 animate-slide-up-fade`}
      style={{ animationDelay: `${staggerIndex * 60}ms` }}
    >
      {/* One-time diagonal shimmer sweep on mount */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -skew-x-12 animate-theme-shimmer"
        style={{
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.20) 50%, transparent 100%)',
        }}
      />
      {/* Subtle inner top-edge highlight (1px white at 8%) for material depth */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10"
      />

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {createElement(theme.headerIcon, {
            className: 'w-[15px] h-[15px] text-white/95 shrink-0',
            'aria-hidden': true,
            strokeWidth: 2.25,
          })}
          <h3 className="text-white font-semibold text-[14px] tracking-tight truncate">{title}</h3>
        </div>
        <span
          className={`shrink-0 text-[10.5px] font-medium tracking-wide px-2.5 py-[3px] rounded-full backdrop-blur-sm animate-count-up-fade ${theme.headerCountChip}`}
          style={{ animationDelay: `${staggerIndex * 60 + 200}ms` }}
        >
          {count} {count === 1 ? 'use case' : 'use cases'}
        </span>
      </div>
    </div>
  );
}
