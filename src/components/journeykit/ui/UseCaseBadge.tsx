import { createElement } from 'react';
import { Layers } from 'lucide-react';
import { CertifiedBadge } from '../../CertifiedBadge';
import { iconForUseCase } from '../../library/theme';
import type { SourceUseCase } from '../engine/types';

type UseCaseLike = Pick<SourceUseCase, 'useCase' | 'label' | 'certified'> & Partial<Pick<SourceUseCase, 'industryLabel'>>;

/** The use case glyph: its catalog icon in a tinted tile. */
export function UseCaseIcon({ uc, active = true, size = 'md' }: { uc: Pick<SourceUseCase, 'useCase' | 'label'>; active?: boolean; size?: 'sm' | 'md' }) {
  const icon = createElement(iconForUseCase({ use_case: uc.useCase, use_case_label: uc.label }, Layers), {
    className: size === 'sm' ? 'w-4 h-4' : 'w-[18px] h-[18px]',
  });
  return (
    <span className={`flex items-center justify-center rounded-lg shrink-0 transition-colors ${size === 'sm' ? 'w-7 h-7' : 'w-9 h-9'} ${active ? 'bg-primary/15 text-primary' : 'bg-secondary/70 text-muted-foreground'}`}>
      {icon}
    </span>
  );
}

/** One way to show "this came from an approved use case" everywhere. */
export function UseCaseBadge({ uc, showIndustry = true }: { uc: UseCaseLike; showIndustry?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <UseCaseIcon uc={uc} size="sm" />
      <span className="min-w-0 truncate text-ui-md">
        <span className="font-semibold text-foreground">{uc.label}</span>
        {showIndustry && uc.industryLabel && <span className="text-muted-foreground"> · {uc.industryLabel}</span>}
      </span>
      {uc.certified && <CertifiedBadge size="sm" />}
    </span>
  );
}
