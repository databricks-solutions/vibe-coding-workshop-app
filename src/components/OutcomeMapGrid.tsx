import { useMemo } from 'react';
import type { SelectOption } from '../api/client';
import { OutcomeMapColumn } from './OutcomeMapColumn';
import type { CategoryOrder } from './outcomeMapTheme';

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
  themeOrder: CategoryOrder;
  useCases: SelectOption[];
}

/**
 * Three-column themed outcome-map grid for Travel & Hospitality. Groups use
 * cases by `category`, sorts columns by `category_order`, and sorts cards
 * within each column by `display_order`. Returns null if no card carries a
 * `category` so the parent can fall back to the standard UseCaseCardGrid.
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
    for (const uc of useCases) {
      if (!uc.value || uc.path_type === 'skill') continue;
      if (!uc.category || !uc.category_order) continue;
      const order = uc.category_order as CategoryOrder;
      if (!grouped.has(order)) {
        grouped.set(order, { title: uc.category, themeOrder: order, useCases: [] });
      }
      grouped.get(order)!.useCases.push(uc);
    }
    // Sort columns by category_order, cards by display_order then label
    const result = Array.from(grouped.values()).sort((a, b) => a.themeOrder - b.themeOrder);
    for (const col of result) {
      col.useCases.sort((a, b) => {
        const ao = a.display_order ?? Number.MAX_SAFE_INTEGER;
        const bo = b.display_order ?? Number.MAX_SAFE_INTEGER;
        if (ao !== bo) return ao - bo;
        return a.label.localeCompare(b.label);
      });
    }
    return result;
  }, [useCases]);

  // Fall through to the standard grid when no use case carries a category.
  if (columns.length === 0) return null;

  const hasSelection = !!selectedUseCase;

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {columns.map((col, idx) => (
          <OutcomeMapColumn
            key={col.themeOrder}
            title={col.title}
            themeOrder={col.themeOrder}
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
    </div>
  );
}
