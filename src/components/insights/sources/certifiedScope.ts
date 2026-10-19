import type { DigestScope } from '../blueprint/types';

export interface CertifiedHint {
  /** Uncertified tables the scan left out. */
  skipped: number;
  scanned: number;
  total: number;
  /** Nothing in the picked schemas is certified. */
  empty: boolean;
  /** Picked schemas with no certified tables at all. */
  uncertifiedSources: string[];
}

interface Match {
  answered: number;
  total: number;
  level: 'ok' | 'low' | 'veryLow';
  refining: boolean;
}

/**
 * Whether to suggest including uncertified tables: the scan was certified only, it left tables out,
 * and either nothing was certified or, once matching settles, a question is still unanswered.
 */
export function certifiedHint(scope: DigestScope | undefined, match: Match | null): CertifiedHint | null {
  if (!scope?.certifiedOnly) return null;
  const skipped = scope.total - scope.scanned;
  if (skipped <= 0) return null;
  const empty = scope.scanned === 0;
  if (!empty && (!match || match.refining || (match.level === 'ok' && match.answered >= match.total))) return null;
  return {
    skipped,
    scanned: scope.scanned,
    total: scope.total,
    empty,
    uncertifiedSources: scope.perSource.filter(p => p.total > 0 && p.certified === 0).map(p => p.id),
  };
}

/** "Certified tables only · 205 of 292" or "All tables · 292". */
export function scopeLabel(scope: DigestScope | undefined): string {
  if (!scope) return '';
  return scope.certifiedOnly
    ? `Certified tables only · ${scope.scanned.toLocaleString()} of ${scope.total.toLocaleString()}`
    : `All tables · ${scope.total.toLocaleString()}${scope.certified ? `, ${scope.certified.toLocaleString()} certified` : ''}`;
}
