import type { SelectOption } from '../api/client';
import { ColumnHeaderBand } from './ColumnHeaderBand';
import { OutcomeMapCard } from './OutcomeMapCard';
import { THEMES, type CategoryOrder } from './outcomeMapTheme';

interface OutcomeMapColumnProps {
  title: string;
  themeOrder: CategoryOrder;
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
 * One vertical column of the outcome-map grid. Slide-style coloured header
 * band + a stack of cards on a subtly theme-tinted backdrop.
 */
export function OutcomeMapColumn({
  title,
  themeOrder,
  useCases,
  selectedUseCase,
  hasSelection,
  onSelect,
  disabled,
  promptTemplates,
  columnIndex,
}: OutcomeMapColumnProps) {
  const theme = THEMES[themeOrder];

  return (
    <section
      role="tabpanel"
      aria-label={title}
      className={`relative rounded-2xl ${theme.columnBackdrop} ${theme.columnBorder} flex flex-col`}
    >
      <ColumnHeaderBand
        title={title}
        count={useCases.length}
        themeOrder={themeOrder}
        staggerIndex={columnIndex}
      />
      <div className="flex flex-col gap-3.5 p-3.5">
        {useCases.map((uc, idx) => (
          <OutcomeMapCard
            key={uc.value}
            useCase={uc}
            themeOrder={themeOrder}
            isSelected={selectedUseCase === uc.value}
            hasSelection={hasSelection}
            onSelect={onSelect}
            disabled={disabled}
            promptTemplate={promptTemplates[uc.value]}
            staggerIndex={columnIndex * 4 + idx}
          />
        ))}
      </div>
    </section>
  );
}
