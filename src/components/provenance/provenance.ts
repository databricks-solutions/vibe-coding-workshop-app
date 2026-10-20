import type { SelectOption } from '../../api/client';
import type { Provenance } from '../../api/contrib';

export type SourceFilterValue = 'all' | 'native' | 'partner' | 'third_party' | 'certified';

export function hasContributions(items: { provenance?: Provenance }[]): boolean {
  return items.some(i => i.provenance && i.provenance !== 'native');
}

export function matchesSource(uc: SelectOption, filter: SourceFilterValue): boolean {
  if (!uc.value) return true;
  switch (filter) {
    case 'all':
      return true;
    case 'native':
      return !uc.provenance || uc.provenance === 'native';
    case 'certified':
      return !!uc.is_certified || (uc.contribution?.certifications.length ?? 0) > 0;
    default:
      return uc.provenance === filter;
  }
}

export function filterBySource(items: SelectOption[], filter: SourceFilterValue): SelectOption[] {
  return items.filter(uc => matchesSource(uc, filter));
}
