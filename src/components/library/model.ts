import type { CollectionKind, LibraryCollection, LibraryMember, LibraryPayload, LibraryUseCase } from '../../api/library';

export const ucKey = (industry: string, useCase: string) => `${industry}.${useCase}`;
export const keyOf = (uc: Pick<LibraryUseCase, 'industry' | 'use_case'>) => ucKey(uc.industry, uc.use_case);

/** A use case as it appears inside one collection (home or cross-listed). */
export interface Entry {
  uc: LibraryUseCase;
  key: string;
  collectionId: string;
  isHome: boolean;
  category: string | null;
  categoryOrder: number | null;
  displayOrder: number | null;
}

export interface CollectionStats {
  total: number;
  live: number;
  hidden: number;
  certified: number;
  crossListed: number;
}

export interface LibraryModel {
  collections: LibraryCollection[];
  byId: Record<string, LibraryCollection>;
  byKind: Record<CollectionKind, LibraryCollection[]>;
  useCases: LibraryUseCase[];
  ucByKey: Record<string, LibraryUseCase>;
  membersByKey: Record<string, LibraryMember[]>;
  entriesByCollection: Record<string, Entry[]>;
  stats: Record<string, CollectionStats>;
  skills: LibraryUseCase[];
  pendingReview: LibraryUseCase[];
  attendeeCollections: LibraryCollection[];
  attendeeUseCaseCount: number;
  attendeeCertifiedCount: number;
}

const KIND_ORDER: Record<CollectionKind, number> = { industry: 0, function: 1, solution: 2 };

export function sortCollections(list: LibraryCollection[]): LibraryCollection[] {
  return [...list].sort(
    (a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (a.display_order ?? 100) - (b.display_order ?? 100) || a.label.localeCompare(b.label),
  );
}

export function buildModel(p: LibraryPayload): LibraryModel {
  const collections = sortCollections(p.collections.map(c => ({ ...c, kind: (c.kind || 'industry') as CollectionKind })));
  const byId = Object.fromEntries(collections.map(c => [c.collection_id, c]));
  const byKind: Record<CollectionKind, LibraryCollection[]> = { industry: [], function: [], solution: [] };
  collections.forEach(c => byKind[c.kind].push(c));

  const useCases = p.use_cases;
  const ucByKey = Object.fromEntries(useCases.map(u => [keyOf(u), u]));
  const membersByKey: Record<string, LibraryMember[]> = {};
  p.members.forEach(m => {
    const k = ucKey(m.home_industry, m.use_case);
    if (!ucByKey[k]) return;
    (membersByKey[k] ||= []).push(m);
  });

  const entriesByCollection: Record<string, Entry[]> = {};
  collections.forEach(c => { entriesByCollection[c.collection_id] = []; });
  useCases.forEach(uc => {
    if (uc.path_type === 'skill') return;
    (entriesByCollection[uc.industry] ||= []).push({
      uc, key: keyOf(uc), collectionId: uc.industry, isHome: true,
      category: uc.category, categoryOrder: uc.category_order, displayOrder: uc.display_order,
    });
  });
  p.members.forEach(m => {
    const uc = ucByKey[ucKey(m.home_industry, m.use_case)];
    if (!uc || uc.path_type === 'skill' || m.collection_id === m.home_industry) return;
    (entriesByCollection[m.collection_id] ||= []).push({
      uc, key: keyOf(uc), collectionId: m.collection_id, isHome: false,
      category: m.category, categoryOrder: m.category_order, displayOrder: m.display_order,
    });
  });

  const stats: Record<string, CollectionStats> = {};
  Object.entries(entriesByCollection).forEach(([cid, list]) => {
    const live = list.filter(e => e.uc.is_active).length;
    stats[cid] = {
      total: list.length,
      live,
      hidden: list.length - live,
      certified: list.filter(e => e.uc.is_certified).length,
      crossListed: list.filter(e => !e.isHome || (membersByKey[e.key]?.length ?? 0) > 0).length,
    };
  });

  const liveSkillHomes = new Set(useCases.filter(u => u.path_type === 'skill' && u.is_active).map(u => u.industry));
  const attendeeCollections = collections.filter(c => c.is_enabled && ((stats[c.collection_id]?.live ?? 0) > 0 || liveSkillHomes.has(c.collection_id)));
  const attendeeKeys = new Set<string>();
  let attendeeCertifiedCount = 0;
  attendeeCollections.forEach(c => (entriesByCollection[c.collection_id] || []).forEach(e => {
    if (e.uc.is_active && !attendeeKeys.has(e.key)) {
      attendeeKeys.add(e.key);
      if (e.uc.is_certified) attendeeCertifiedCount += 1;
    }
  }));

  return {
    collections, byId, byKind, useCases, ucByKey, membersByKey, entriesByCollection, stats,
    skills: useCases.filter(u => u.path_type === 'skill'),
    pendingReview: useCases.filter(u => u.source === 'ideate' && !u.is_active),
    attendeeCollections,
    attendeeUseCaseCount: attendeeKeys.size,
    attendeeCertifiedCount,
  };
}

export const UNCATEGORIZED = '__uncategorized__';

export interface Column {
  id: string;
  title: string;
  order: number;
  entries: Entry[];
}

/** Category columns for a collection, matching the participant outcome map ordering. */
export function columnsFor(entries: Entry[], extraCategories: string[] = []): Column[] {
  const map = new Map<string, Column>();
  entries.forEach(e => {
    const id = e.category || UNCATEGORIZED;
    if (!map.has(id)) map.set(id, { id, title: e.category || 'Uncategorized', order: e.category ? e.categoryOrder ?? 999 : Number.MAX_SAFE_INTEGER, entries: [] });
    const col = map.get(id)!;
    if (e.category && e.categoryOrder != null) col.order = Math.min(col.order, e.categoryOrder);
    col.entries.push(e);
  });
  extraCategories.forEach((c, i) => {
    if (!map.has(c)) map.set(c, { id: c, title: c, order: 900 + i, entries: [] });
  });
  const cols = [...map.values()].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  cols.forEach(c => c.entries.sort((a, b) =>
    Number(b.uc.is_certified) - Number(a.uc.is_certified) || (a.displayOrder ?? 999) - (b.displayOrder ?? 999) || a.uc.use_case_label.localeCompare(b.uc.use_case_label)));
  return cols;
}

export function categoriesOf(model: LibraryModel, collectionId: string): string[] {
  return columnsFor(model.entriesByCollection[collectionId] || []).filter(c => c.id !== UNCATEGORIZED).map(c => c.title);
}

/** Collections a use case appears in: home first, then cross-listings. */
export function placementsOf(model: LibraryModel, uc: LibraryUseCase): { collection: LibraryCollection | undefined; isHome: boolean; category: string | null; id: string }[] {
  const home = { id: uc.industry, collection: model.byId[uc.industry], isHome: true, category: uc.category };
  const others = (model.membersByKey[keyOf(uc)] || [])
    .filter(m => m.collection_id !== uc.industry)
    .map(m => ({ id: m.collection_id, collection: model.byId[m.collection_id], isHome: false, category: m.category }));
  return [home, ...others];
}

/** Use cases that belong to both collections (home or cross-listed in either). */
export function intersect(model: LibraryModel, a: string, b: string): LibraryUseCase[] {
  const inA = new Set((model.entriesByCollection[a] || []).map(e => e.key));
  return (model.entriesByCollection[b] || []).filter(e => inA.has(e.key)).map(e => e.uc);
}
