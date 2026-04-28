import { createElement, useRef, type MouseEvent, type CSSProperties } from 'react';
import { Check } from 'lucide-react';
import type { SelectOption } from '../api/client';
import {
  THEMES,
  getIconForSlug,
  LEAF_PILLS_BY_SLUG,
  deriveValueProp,
  type CategoryOrder,
} from './outcomeMapTheme';

interface OutcomeMapCardProps {
  useCase: SelectOption;
  themeOrder: CategoryOrder;
  isSelected: boolean;
  hasSelection: boolean;
  onSelect: (slug: string) => void;
  disabled?: boolean;
  /** Used as the value-prop fallback when no full prompt-template is loaded yet */
  promptTemplate?: string;
  /** Position within the staggered entrance animation */
  staggerIndex: number;
}

/**
 * Single use-case card in the outcome map. Apple-grade restraint:
 *  • Glass-morph surface with theme-tinted gradient top edge
 *  • 44 px themed icon disc with subtle hover micro-rotation
 *  • Refined typography (tight title tracking, looser muted subtitle)
 *  • Always-visible feature pills at low opacity, ramping to full on hover/select
 *  • Selected state combines theme-tinted background, themed title colour,
 *    deeper shadow, and the BorderBeam orbit — sibling cards drop to 35 % so
 *    the selected card is unmistakable
 *  • Magnetic radial-gradient hover follows the cursor via CSS variables
 */
export function OutcomeMapCard({
  useCase,
  themeOrder,
  isSelected,
  hasSelection,
  onSelect,
  disabled,
  promptTemplate,
  staggerIndex,
}: OutcomeMapCardProps) {
  const theme = THEMES[themeOrder];
  const pills = LEAF_PILLS_BY_SLUG[useCase.value] ?? [];
  const cardRef = useRef<HTMLButtonElement>(null);

  // Magnetic radial-gradient hover. Updates two CSS variables on the root
  // element so a `::before` overlay can render a theme-coloured glow that
  // tracks the cursor. Pure CSS, no animation library.
  const handleMouseMove = (e: MouseEvent<HTMLButtonElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };

  const valueProp = deriveValueProp(promptTemplate, useCase.label);
  const siblingDimmed = hasSelection && !isSelected;

  // Visual layers — assembled top-down so each is obvious.
  const baseClasses = [
    'group relative overflow-hidden text-left',
    'rounded-2xl backdrop-blur-md',
    'p-5 min-h-[10rem]',
    'transition-all duration-300 will-change-transform',
    'animate-slide-up-fade',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card',
  ];

  const surfaceClasses = isSelected
    ? `${theme.cardSelectedBg} ${theme.cardSelectedRing}`
    : 'bg-card/85 ring-1 ring-border/50';

  const stateClasses = disabled
    ? 'cursor-default opacity-60'
    : isSelected
      ? 'cursor-pointer z-10'
      : siblingDimmed
        ? 'cursor-pointer opacity-55 scale-[0.97] hover:opacity-80'
        : `cursor-pointer hover:-translate-y-1.5 hover:${theme.cardHoverRing}`;

  // Top-edge gradient hairline (rendered as a positioned overlay below the
  // ::before magnetic-glow layer). Uses a separate span so we don't fight
  // Tailwind's pseudo-element pipeline.
  const topEdgeClasses = isSelected
    ? `${theme.cardTopEdge.replace(/before:/g, '')}`
    : `${theme.cardTopEdge.replace(/before:/g, '')} opacity-60 group-hover:opacity-100 transition-opacity duration-300`;

  // Inline style: stagger the entrance and expose the magnetic-glow colour.
  const inlineStyle: CSSProperties & Record<string, string> = {
    animationDelay: `${staggerIndex * 60}ms`,
    '--theme-glow': theme.magneticGlow,
  };

  const button = (
    <button
      ref={cardRef}
      type="button"
      role="tab"
      aria-pressed={isSelected}
      aria-label={`${useCase.label}, ${useCase.category ?? ''}, ${pills.length} features`}
      disabled={disabled}
      onClick={() => !disabled && onSelect(useCase.value)}
      onMouseMove={handleMouseMove}
      className={[...baseClasses, surfaceClasses, stateClasses].join(' ')}
      style={inlineStyle}
    >
      {/* Top-edge themed gradient hairline (1.5 px) */}
      <span aria-hidden="true" className={`pointer-events-none absolute inset-x-0 top-0 h-[1.5px] ${topEdgeClasses}`} />

      {/* Magnetic radial-gradient that follows the cursor on hover */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(420px circle at var(--mx, 50%) var(--my, 50%), var(--theme-glow), transparent 55%)',
        }}
      />

      {/* Top row: themed icon disc + selected check / "N features" chip */}
      <div className="relative flex items-start justify-between mb-4">
        <div
          className={`w-11 h-11 rounded-xl grid place-items-center transition-all duration-300 ${
            isSelected ? theme.iconBgSelected : theme.iconBg
          } group-hover:scale-[1.04] group-hover:rotate-[2deg]`}
        >
          {createElement(getIconForSlug(useCase.value), {
            className: `w-[18px] h-[18px] ${theme.iconAccent}`,
            'aria-hidden': true,
          })}
        </div>
        {isSelected ? (
          <span
            className={`inline-flex items-center gap-1 text-[10.5px] font-semibold tracking-wide uppercase px-2 py-[3px] rounded-full ${theme.pillBgSelected} animate-scale-in`}
          >
            <Check className="w-3 h-3" strokeWidth={2.5} />
            Selected
          </span>
        ) : (
          <span
            className={`text-[10.5px] font-medium tracking-wide px-2 py-[3px] rounded-full ${theme.countChip}`}
          >
            {pills.length} {pills.length === 1 ? 'feature' : 'features'}
          </span>
        )}
      </div>

      {/* Title + value prop — tight tracking, generous breathing room */}
      <h4
        className={`relative text-[15px] font-semibold leading-snug tracking-tight mb-1.5 transition-colors duration-300 ${
          isSelected ? theme.titleSelected : 'text-foreground'
        }`}
      >
        {useCase.label}
      </h4>
      <p className="relative text-[12.5px] leading-relaxed text-muted-foreground line-clamp-2 mb-4">
        {valueProp}
      </p>

      {/* Leaf-item pills — always fully visible, content over decoration */}
      {pills.length > 0 && (
        <div className="relative flex flex-wrap gap-1.5">
          {pills.map((pill, i) => (
            <span
              key={pill}
              className={`text-[10.5px] font-medium tracking-wide px-2 py-[3px] rounded-full transition-colors duration-300 ${
                isSelected ? theme.pillBgSelected : theme.pillBg
              } animate-cascade-in`}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              {pill}
            </span>
          ))}
        </div>
      )}
    </button>
  );

  // BorderBeam wrapper only when selected (and not disabled). Recoloured per
  // theme via the `theme-cyan|emerald|amber` modifier class added in
  // index.css alongside the existing .border-beam-wrapper rule. The wrapper
  // (not the inner button) carries the selection scale so the orbit and the
  // card stay edge-aligned — scaling the inner button alone caused it to
  // overflow the wrapper's clip and produced jagged right/bottom edges.
  if (isSelected && !disabled) {
    return (
      <div
        className={`border-beam-wrapper ${theme.beamClass} block w-full scale-[1.025] transition-transform duration-300`}
      >
        {button}
      </div>
    );
  }
  return button;
}
