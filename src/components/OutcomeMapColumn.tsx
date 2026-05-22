import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { SelectOption } from '../api/client';
import { ColumnHeaderBand } from './ColumnHeaderBand';
import { OutcomeMapCard } from './OutcomeMapCard';
import type { OutcomeMapTheme } from './outcomeMapTheme';

interface OutcomeMapColumnProps {
  title: string;
  /** Resolved theme for this column (palette is keyed by rendered column index). */
  theme: OutcomeMapTheme;
  useCases: SelectOption[];
  selectedUseCase: string;
  hasSelection: boolean;
  onSelect: (slug: string) => void;
  disabled?: boolean;
  promptTemplates: Record<string, string>;
  /** Index of this column among the rendered columns (0-based) for entrance stagger */
  columnIndex: number;
}

/**
 * Default number of cards rendered per column before the user opens it.
 * Three was the design intent — keeps every column tidy and same-height-ish
 * at first paint, so the row never stretches to the tallest column. The
 * grid-level "Show more" handles overflow across columns; this one handles
 * overflow within a single column.
 */
const INITIAL_VISIBLE_CARDS = 3;
/** Cards revealed per inner "Show more" click. */
const CARDS_PER_REVEAL = 3;

/**
 * One vertical column of the outcome-map grid. Slide-style coloured header
 * band + a stack of cards on a subtly theme-tinted backdrop. Renders the
 * top {@link INITIAL_VISIBLE_CARDS} cards by `display_order` initially and
 * exposes a compact "Show 3 more" pill to reveal the rest.
 */
export function OutcomeMapColumn({
  title,
  theme,
  useCases,
  selectedUseCase,
  hasSelection,
  onSelect,
  disabled,
  promptTemplates,
  columnIndex,
}: OutcomeMapColumnProps) {
  // Normalise card stagger so newly-revealed rows (after "Show more") still
  // cascade left-to-right within their row rather than inheriting an
  // ever-growing offset from earlier rows above. Each row of 3 columns
  // starts the stagger over.
  const rowColumnIndex = columnIndex % 3;

  const [visibleCardCount, setVisibleCardCount] = useState(INITIAL_VISIBLE_CARDS);

  // Reset to the default whenever the card set itself changes (industry
  // switch, config edit, etc). Without this, an expanded column would leak
  // its state into the next industry that happens to share the same theme
  // palette index.
  useEffect(() => {
    setVisibleCardCount(INITIAL_VISIBLE_CARDS);
  }, [useCases]);

  // If the current selection lives beyond the visible portion (e.g. session
  // restore landed on a card in slot 5 of an "Other" column), expand just
  // enough to keep it on screen. Never shrinks user-driven expansion.
  useEffect(() => {
    if (!selectedUseCase) return;
    const selectedIndex = useCases.findIndex(uc => uc.value === selectedUseCase);
    if (selectedIndex >= 0) {
      setVisibleCardCount(prev => Math.max(prev, selectedIndex + 1));
    }
  }, [useCases, selectedUseCase]);

  const cappedVisible = Math.min(visibleCardCount, useCases.length);
  const visibleCards = useCases.slice(0, cappedVisible);
  const remaining = useCases.length - cappedVisible;
  const isFullyExpanded = cappedVisible >= useCases.length;
  // Only surface the inner show-more affordance when there's something to
  // reveal beyond the default. Columns with 3 or fewer cards stay clean.
  const hasOverflow = useCases.length > INITIAL_VISIBLE_CARDS;

  const handleShowMore = () =>
    setVisibleCardCount(prev => Math.min(prev + CARDS_PER_REVEAL, useCases.length));
  const handleCollapse = () => setVisibleCardCount(INITIAL_VISIBLE_CARDS);

  return (
    <section
      role="tabpanel"
      aria-label={title}
      className={`relative rounded-2xl ${theme.columnBackdrop} ${theme.columnBorder} flex flex-col`}
    >
      <ColumnHeaderBand
        title={title}
        count={useCases.length}
        theme={theme}
        staggerIndex={columnIndex}
      />
      <div className="flex flex-col gap-3.5 p-3.5">
        {visibleCards.map((uc, idx) => (
          <OutcomeMapCard
            key={uc.value}
            useCase={uc}
            theme={theme}
            isSelected={selectedUseCase === uc.value}
            hasSelection={hasSelection}
            onSelect={onSelect}
            disabled={disabled}
            promptTemplate={promptTemplates[uc.value]}
            staggerIndex={rowColumnIndex * 4 + idx}
          />
        ))}

        {hasOverflow && (
          <div className="flex justify-center pt-1">
            {!isFullyExpanded ? (
              <button
                type="button"
                onClick={handleShowMore}
                disabled={disabled}
                aria-label={`Show ${Math.min(CARDS_PER_REVEAL, remaining)} more use case ${
                  Math.min(CARDS_PER_REVEAL, remaining) === 1 ? 'card' : 'cards'
                } in ${title}`}
                className={`group inline-flex items-center gap-1.5 px-3 py-1 rounded-full
                            text-ui-2xs font-medium text-foreground/75
                            bg-muted/40 ring-1 ring-border/30
                            transition-all duration-200
                            ${
                              disabled
                                ? 'cursor-default opacity-60'
                                : 'cursor-pointer hover:bg-muted/70 hover:text-foreground hover:ring-border/55 hover:-translate-y-0.5 active:translate-y-0'
                            }
                            animate-slide-up-fade`}
              >
                <ChevronDown
                  className="w-3 h-3 transition-transform duration-200 group-hover:translate-y-0.5"
                  strokeWidth={2.25}
                />
                Show {Math.min(CARDS_PER_REVEAL, remaining)} more
                <span className="text-muted-foreground/70">· {remaining} left</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCollapse}
                disabled={disabled}
                aria-label={`Collapse ${title} to first ${INITIAL_VISIBLE_CARDS}`}
                className={`inline-flex items-center gap-1 text-ui-2xs font-medium tracking-wide uppercase text-muted-foreground
                            transition-colors duration-200
                            ${
                              disabled
                                ? 'cursor-default opacity-60'
                                : 'cursor-pointer hover:text-foreground'
                            }
                            animate-slide-up-fade`}
              >
                <span className="underline-offset-4 hover:underline">Collapse</span>
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
