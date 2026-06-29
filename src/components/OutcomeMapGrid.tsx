import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { SelectOption } from '../api/client';
import { OutcomeMapColumn } from './OutcomeMapColumn';
import { getThemeForColumn } from './outcomeMapTheme';

interface OutcomeMapGridProps {
  useCases: SelectOption[];
  selectedUseCase: string;
  onSelect: (slug: string) => void;
  disabled?: boolean;
  /** Used to derive each card's value-prop line from the spec's opening sentence */
  promptTemplates: Record<string, string>;
}

interface ColumnGroup {
  title: string;
  /** Backend-provided ordering key (any positive integer); used only for sort. */
  sortKey: number;
  useCases: SelectOption[];
}

/** Default number of columns visible before the user clicks "Show more". */
const INITIAL_VISIBLE_COLUMNS = 3;
/** How many additional columns each "Show more" click reveals. */
const COLUMNS_PER_REVEAL = 3;
/**
 * When the total column count is at or below this threshold we render every
 * column up-front (no "Show more" gate). Hiding the last one behind a click
 * when there are only 4 total felt off — there's still enough horizontal
 * room to fit them all at lg+ with a slightly narrower template.
 */
const SHOW_ALL_THRESHOLD = 4;
/**
 * Sentinel sort key used to push the synthetic "Other" column to the end of
 * the grid regardless of how high real `category_order` values get. Chosen
 * well above any realistic backend integer so genuine categories can't
 * accidentally land at or past it.
 */
const UNCATEGORIZED_SORT_KEY = Number.MAX_SAFE_INTEGER;
/**
 * Display title for the synthetic column that captures active use cases the
 * config UI created without a `category` (the create endpoint doesn't yet
 * accept one). Surfacing these in their own column avoids silently dropping
 * user-authored content from the workshop.
 */
const UNCATEGORIZED_COLUMN_TITLE = 'Other';

/**
 * Backend-driven themed outcome-map grid. Groups use cases by `category`,
 * sorts columns by `category_order`, and sorts cards within each column by
 * `display_order`. Returns null if no card carries a `category` so the
 * parent can fall back to the standard UseCaseCardGrid.
 *
 * Column count is unbounded — the visual cap of three themed columns was
 * removed. The first {@link INITIAL_VISIBLE_COLUMNS} columns render
 * immediately; the rest are progressively revealed with a "Show 3 more"
 * control below the grid. Themes are resolved by the column's *rendered*
 * index via {@link getThemeForColumn}, so backends can use sparse
 * `category_order` values (e.g. 1, 2, 5, 7) without breaking the rotation.
 */
export function OutcomeMapGrid({
  useCases,
  selectedUseCase,
  onSelect,
  disabled,
  promptTemplates,
}: OutcomeMapGridProps) {
  const columns = useMemo<ColumnGroup[]>(() => {
    const grouped = new Map<number, ColumnGroup>();
    const uncategorized: SelectOption[] = [];
    for (const uc of useCases) {
      if (!uc.value || uc.path_type === 'skill') continue;
      // Active use cases without a category (e.g. ones added through the
      // config-UI "Build New Use Case" flow, which doesn't yet capture a
      // category) are bucketed into a synthetic "Other" column at the end
      // rather than silently dropped from the workshop.
      if (!uc.category || !uc.category_order) {
        uncategorized.push(uc);
        continue;
      }
      const order = uc.category_order;
      if (!grouped.has(order)) {
        grouped.set(order, { title: uc.category, sortKey: order, useCases: [] });
      }
      grouped.get(order)!.useCases.push(uc);
    }
    // Sort categorized columns by category_order
    const result = Array.from(grouped.values()).sort((a, b) => a.sortKey - b.sortKey);
    // Append the synthetic "Other" column when any uncategorized actives exist
    if (uncategorized.length > 0) {
      result.push({
        title: UNCATEGORIZED_COLUMN_TITLE,
        sortKey: UNCATEGORIZED_SORT_KEY,
        useCases: uncategorized,
      });
    }
    // Sort cards within each column: certified first, then display_order, then label.
    // Certified use cases rise to the top of every column so they land in the
    // always-visible first three slots.
    for (const col of result) {
      col.useCases.sort((a, b) => {
        const ac = a.is_certified ? 0 : 1;
        const bc = b.is_certified ? 0 : 1;
        if (ac !== bc) return ac - bc;
        const ao = a.display_order ?? Number.MAX_SAFE_INTEGER;
        const bo = b.display_order ?? Number.MAX_SAFE_INTEGER;
        if (ao !== bo) return ao - bo;
        return a.label.localeCompare(b.label);
      });
    }
    return result;
  }, [useCases]);

  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COLUMNS);

  // Reset to the default count whenever the column set itself changes (e.g.
  // industry switch). When the total is at or below SHOW_ALL_THRESHOLD we
  // skip "Show more" entirely and render every column up-front so the last
  // one isn't gated behind a click for no real layout reason.
  useEffect(() => {
    const defaultVisible =
      columns.length <= SHOW_ALL_THRESHOLD ? columns.length : INITIAL_VISIBLE_COLUMNS;
    setVisibleCount(defaultVisible);
  }, [columns]);

  // If the current selection lives in a column beyond the default 3 (e.g.
  // session restore landed on a hidden card), expand just enough to keep it
  // on screen. Never shrinks user-driven expansion.
  useEffect(() => {
    if (!selectedUseCase) return;
    const selectedColumn = columns.findIndex(col =>
      col.useCases.some(uc => uc.value === selectedUseCase),
    );
    if (selectedColumn >= 0) {
      setVisibleCount(prev => Math.max(prev, selectedColumn + 1));
    }
  }, [columns, selectedUseCase]);

  // Fall through to the standard grid when no use case carries a category.
  if (columns.length === 0) return null;

  const hasSelection = !!selectedUseCase;
  const cappedVisible = Math.min(visibleCount, columns.length);
  const visibleColumns = columns.slice(0, cappedVisible);
  const remaining = columns.length - cappedVisible;
  const isFullyExpanded = cappedVisible >= columns.length;
  // Only surface the "Show more" affordance when the total genuinely exceeds
  // what we'd render on a single row. At or below the threshold we already
  // show everything, so there's nothing to reveal or collapse.
  const hasOverflow = columns.length > SHOW_ALL_THRESHOLD;

  // Use a 4-up template only when exactly 4 columns are visible so the row
  // stays tidy; everything else falls back to the proven 3-up grid (which
  // wraps cleanly to additional rows for 5+).
  const gridTemplateClass =
    cappedVisible === 4
      ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5'
      : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5';

  const handleShowMore = () => {
    setVisibleCount(prev => Math.min(prev + COLUMNS_PER_REVEAL, columns.length));
  };
  const handleCollapse = () => setVisibleCount(INITIAL_VISIBLE_COLUMNS);

  return (
    <div className="mb-5 animate-slide-up-fade">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/15 text-primary text-ui-2xs font-bold">
          2
        </span>
        <label className="text-ui-xs font-medium text-muted-foreground uppercase tracking-wider">
          Use Case
        </label>
      </div>
      <div className={gridTemplateClass}>
        {visibleColumns.map((col, idx) => (
          <OutcomeMapColumn
            key={col.sortKey}
            title={col.title}
            theme={getThemeForColumn(idx)}
            useCases={col.useCases}
            selectedUseCase={selectedUseCase}
            hasSelection={hasSelection}
            onSelect={onSelect}
            disabled={disabled}
            promptTemplates={promptTemplates}
            columnIndex={idx}
          />
        ))}
      </div>

      {hasOverflow && (
        <div className="mt-5 flex flex-col items-center gap-2">
          {!isFullyExpanded ? (
            <button
              type="button"
              onClick={handleShowMore}
              disabled={disabled}
              aria-label={`Show ${Math.min(COLUMNS_PER_REVEAL, remaining)} more use case ${
                Math.min(COLUMNS_PER_REVEAL, remaining) === 1 ? 'column' : 'columns'
              }`}
              className={`group inline-flex items-center gap-2 px-4 py-2 rounded-full
                          text-ui-xs font-medium text-foreground/80
                          bg-muted/60 ring-1 ring-border/40
                          transition-all duration-200
                          ${
                            disabled
                              ? 'cursor-default opacity-60'
                              : 'cursor-pointer hover:bg-muted hover:text-foreground hover:ring-border/70 hover:-translate-y-0.5 active:translate-y-0'
                          }
                          animate-slide-up-fade`}
            >
              <ChevronDown
                className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-y-0.5"
                strokeWidth={2.25}
              />
              Show {Math.min(COLUMNS_PER_REVEAL, remaining)} more
              <span className="text-muted-foreground/70">
                · {remaining} remaining
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCollapse}
              disabled={disabled}
              aria-label="Collapse to the default three columns"
              className={`inline-flex items-center gap-1.5 text-ui-2xs font-medium tracking-wide uppercase text-muted-foreground
                          transition-colors duration-200
                          ${disabled ? 'cursor-default opacity-60' : 'cursor-pointer hover:text-foreground'}
                          animate-slide-up-fade`}
            >
              Showing all {columns.length}
              <span aria-hidden="true" className="text-muted-foreground/40">·</span>
              <span className="underline-offset-4 hover:underline">Collapse</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
