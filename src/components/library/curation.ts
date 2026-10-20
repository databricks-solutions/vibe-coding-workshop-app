import type { LibraryUseCase } from '../../api/library';

type UseCaseLike = Pick<LibraryUseCase, 'source' | 'created_by' | 'contribution'>;

/** Contributed: from the contrib/ folder (partners, community) or submitted by a person through Ideate. */
export function isContributed(uc: Pick<LibraryUseCase, 'source'>): boolean {
  return uc.source === 'contributed' || uc.source.startsWith('ideate');
}

/** "jane.doe@x.com" -> "Jane Doe". Service principal ids and blanks give null. */
export function nameFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  if (!email.includes('@')) return /^[0-9a-f-]{20,}$/i.test(email) ? null : email;
  const parts = email.split('@')[0].split(/[._-]+/).filter(p => p && !/^\d+$/.test(p));
  if (!parts.length) return null;
  return parts.map(p => p[0].toUpperCase() + p.slice(1)).join(' ');
}

export function contributorName(uc: UseCaseLike): string | null {
  return uc.contribution?.contributor.display_name ?? nameFromEmail(uc.created_by);
}

interface EntryLike {
  uc: Pick<LibraryUseCase, 'is_active' | 'is_certified' | 'use_case_label'>;
  isHome: boolean;
  category: string | null;
  displayOrder: number | null;
}

export interface FocusColumn<E> {
  title: string | null;
  keep: E[];
  hide: E[];
  /** True when the column has no certified use case and its best one is kept so it isn't empty. */
  filled: boolean;
}

export interface FocusPlan<E> {
  columns: FocusColumn<E>[];
  /** Kept use cases that are hidden today and will go live. */
  show: E[];
  /** Live use cases that will be hidden. */
  hide: E[];
  keepCount: number;
}

const rank = (a: EntryLike, b: EntryLike) =>
  Number(b.uc.is_active) - Number(a.uc.is_active)
  || (a.displayOrder ?? 999) - (b.displayOrder ?? 999)
  || a.uc.use_case_label.localeCompare(b.uc.use_case_label);

/**
 * Trim a collection to its certified use cases. A column with nothing certified
 * keeps its first live entry (board order) so it doesn't go empty; it never
 * turns on something hidden, such as an idea still waiting for review.
 * Only use cases homed in the collection are considered: Live is global, so a
 * cross-listing is curated from its home.
 */
export function focusPlan<E extends EntryLike>(entries: E[]): FocusPlan<E> {
  const byCol = new Map<string, E[]>();
  entries.filter(e => e.isHome).forEach(e => {
    const k = e.category ?? '';
    byCol.set(k, [...(byCol.get(k) || []), e]);
  });
  const columns: FocusColumn<E>[] = [...byCol.entries()].map(([k, list]) => {
    const sorted = [...list].sort(rank);
    const certified = sorted.filter(e => e.uc.is_certified);
    const keep = certified.length ? certified : sorted.filter(e => e.uc.is_active).slice(0, 1);
    return { title: k || null, keep, hide: sorted.filter(e => !keep.includes(e)), filled: !certified.length && keep.length > 0 };
  });
  return {
    columns,
    show: columns.flatMap(c => c.keep.filter(e => !e.uc.is_active)),
    hide: columns.flatMap(c => c.hide.filter(e => e.uc.is_active)),
    keepCount: columns.reduce((n, c) => n + c.keep.length, 0),
  };
}
