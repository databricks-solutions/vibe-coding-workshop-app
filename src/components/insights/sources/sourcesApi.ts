import { useEffect, useState } from 'react';
import type { BlueprintDigest, BlueprintFit } from '../blueprint/types';

const BASE = '/api/data-sources';

export interface ApprovedSource {
  id: string;
  catalog: string;
  schema: string;
  label: string;
  note: string;
  readable: boolean;
  tableCount: number;
  metricViews: number;
  tables: { name: string; comment: string }[];
  error: string;
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin', ...init });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.detail ?? ''; } catch { /* not json */ }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export interface UcName {
  name: string;
  comment: string;
}

let listPromise: Promise<ApprovedSource[]> | null = null;
let catalogsPromise: Promise<UcName[]> | null = null;
const schemaPromises = new Map<string, Promise<UcName[]>>();
const checkPromises = new Map<string, Promise<ApprovedSource>>();
const digestPromises = new Map<string, Promise<BlueprintDigest>>();
const fitPromises = new Map<string, Promise<BlueprintFit>>();

/** Sources are passed around as one comma-joined, sorted id so caches agree. */
export const sourceKey = (ids: string[]) => Array.from(new Set(ids.map(s => s.trim()).filter(Boolean))).sort().join(',');

const SOURCE_RE = /^[A-Za-z0-9_][A-Za-z0-9_-]*\.[A-Za-z0-9_][A-Za-z0-9_-]*$/;

/** The catalog.schema names in a free-text location; table names and junk are ignored. */
export function sourcesIn(location: string): string[] {
  return location.split(/[,\s]+/).map(s => s.trim()).filter(s => SOURCE_RE.test(s));
}

export const isSourceId = (s: string) => SOURCE_RE.test(s.trim());

/** The comma-separated entries of a location: catalog.schema ids and free-text hints. */
export const locationEntries = (location: string) => location.split(',').map(s => s.trim()).filter(Boolean);

/** Adds an entry once; a catalog.schema is matched case-insensitively. */
export function addToLocation(location: string, entry: string): string {
  const e = entry.trim().replace(/,/g, ' ');
  const entries = locationEntries(location);
  if (!e || entries.some(x => x.toLowerCase() === e.toLowerCase())) return entries.join(', ');
  return [...entries, e].join(', ');
}

export const removeFromLocation = (location: string, entry: string) => locationEntries(location).filter(x => x !== entry).join(', ');

export const sourcesApi = {
  list(): Promise<ApprovedSource[]> {
    if (!listPromise) {
      listPromise = getJson<{ sources: ApprovedSource[] }>(BASE)
        .then(r => r.sources ?? [])
        .catch(err => { listPromise = null; throw err; });
    }
    return listPromise;
  },
  catalogs(): Promise<UcName[]> {
    if (!catalogsPromise) {
      catalogsPromise = getJson<{ catalogs: UcName[] }>(`${BASE}/catalogs`)
        .then(r => r.catalogs ?? [])
        .catch(err => { catalogsPromise = null; throw err; });
    }
    return catalogsPromise;
  },
  schemas(catalog: string): Promise<UcName[]> {
    let p = schemaPromises.get(catalog);
    if (!p) {
      p = getJson<{ schemas: UcName[] }>(`${BASE}/schemas?catalog=${encodeURIComponent(catalog)}`)
        .then(r => r.schemas ?? [])
        .catch(err => { schemaPromises.delete(catalog); throw err; });
      schemaPromises.set(catalog, p);
    }
    return p;
  },
  check(source: string): Promise<ApprovedSource> {
    let p = checkPromises.get(source);
    if (!p) {
      p = getJson<ApprovedSource>(`${BASE}/check?source=${encodeURIComponent(source)}`).catch(err => {
        checkPromises.delete(source);
        throw err;
      });
      checkPromises.set(source, p);
    }
    return p;
  },
  digest(key: string): Promise<BlueprintDigest> {
    let p = digestPromises.get(key);
    if (!p) {
      p = getJson<BlueprintDigest>(`${BASE}/digest?sources=${encodeURIComponent(key)}`).catch(err => {
        digestPromises.delete(key);
        throw err;
      });
      digestPromises.set(key, p);
    }
    return p;
  },
  /** `id` is the source key; matches the FitFetcher shape. */
  fit(id: string, context: string, questions: string[], suggested: string[]): Promise<BlueprintFit> {
    const key = JSON.stringify([id, context, questions, suggested]);
    let p = fitPromises.get(key);
    if (!p) {
      p = getJson<BlueprintFit>(`${BASE}/fit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources: id.split(','), context, questions, suggested }),
      }).catch(err => {
        fitPromises.delete(key);
        throw err;
      });
      fitPromises.set(key, p);
    }
    return p;
  },
  /** Forget the cached list, e.g. after an admin edits it. */
  reset() { listPromise = null; catalogsPromise = null; schemaPromises.clear(); checkPromises.clear(); },
};

export interface UcNameList {
  items: UcName[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/** Loads a Unity Catalog name list when `enabled`; `key` changes reload it. */
function useUcNames(key: string, enabled: boolean, load: () => Promise<UcName[]>): UcNameList {
  const [attempt, setAttempt] = useState(0);
  const tag = `${key}:${attempt}`;
  const [result, setResult] = useState<{ tag: string; items: UcName[]; error: string | null } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    load()
      .then(items => alive && setResult({ tag, items, error: null }))
      .catch(err => alive && setResult({ tag, items: [], error: String(err?.message || err) }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `tag` captures key and retries; `load` is rebuilt each render
  }, [enabled, tag]);
  const retry = () => { sourcesApi.reset(); setAttempt(a => a + 1); };
  if (!enabled) return { items: [], loading: false, error: null, retry };
  if (result?.tag === tag) return { items: result.items, loading: false, error: result.error, retry };
  return { items: [], loading: true, error: null, retry };
}

export const useCatalogs = (enabled: boolean) => useUcNames('catalogs', enabled, () => sourcesApi.catalogs());

export const useSchemas = (catalog: string) => useUcNames(`schemas:${catalog}`, !!catalog, () => sourcesApi.schemas(catalog));

export type CheckedSource = ApprovedSource & { loading: boolean };

const pendingSource = (id: string): CheckedSource => {
  const [catalog, schema] = id.split('.');
  return { id, catalog, schema, label: id, note: '', readable: false, tableCount: 0, metricViews: 0, tables: [], error: '', loading: true };
};

/** Scans catalog.schema ids that are not on the approved list; one result per id, in order. */
export function useCheckedSources(ids: string[]): CheckedSource[] {
  const key = ids.join(',');
  const [done, setDone] = useState<Record<string, ApprovedSource>>({});
  useEffect(() => {
    let alive = true;
    for (const id of key ? key.split(',') : []) {
      sourcesApi.check(id)
        .then(s => alive && setDone(m => (m[id] === s ? m : { ...m, [id]: s })))
        .catch(err => alive && setDone(m => ({ ...m, [id]: { ...pendingSource(id), loading: false, error: String(err?.message || err) } })));
    }
    return () => { alive = false; };
  }, [key]);
  return ids.map(id => (done[id] ? { ...done[id], label: id, loading: false } : pendingSource(id)));
}

/** The approved list; empty while loading or on any failure. */
export function useApprovedSources(): { sources: ApprovedSource[]; loading: boolean } {
  const [state, setState] = useState<{ sources: ApprovedSource[]; loading: boolean }>({ sources: [], loading: true });
  useEffect(() => {
    let alive = true;
    sourcesApi.list()
      .then(sources => alive && setState({ sources, loading: false }))
      .catch(() => alive && setState({ sources: [], loading: false }));
    return () => { alive = false; };
  }, []);
  return state;
}

export function useSourceDigest(key: string, attempt = 0): { data: BlueprintDigest | null; error: string | null; loading: boolean } {
  const tag = key ? `${key}:${attempt}` : '';
  const [result, setResult] = useState<{ tag: string; data: BlueprintDigest | null; error: string | null } | null>(null);
  useEffect(() => {
    if (!key) return;
    let alive = true;
    sourcesApi.digest(key)
      .then(data => alive && setResult({ tag, data, error: null }))
      .catch(err => alive && setResult({ tag, data: null, error: String(err?.message || err) }));
    return () => { alive = false; };
  }, [key, tag]);
  if (!key) return { data: null, error: null, loading: false };
  if (result?.tag === tag) return { data: result.data, error: result.error, loading: false };
  return { data: null, error: null, loading: true };
}

const WORD = /[a-z][a-z0-9]{2,}/g;
const STOP = new Set(['the', 'and', 'for', 'with', 'what', 'which', 'how', 'many', 'much', 'are', 'our', 'per', 'by', 'from', 'that', 'this', 'each', 'all', 'last', 'top', 'most', 'did', 'does', 'was', 'were', 'have', 'has', 'into', 'over', 'table', 'data', 'one', 'row']);

function stems(text: string): Set<string> {
  const out = new Set<string>();
  for (const w of text.toLowerCase().replace(/_/g, ' ').match(WORD) ?? []) {
    if (STOP.has(w)) continue;
    out.add(w.replace(/(ies|es|s)$/, m => (m === 'ies' ? 'y' : '')));
  }
  return out;
}

/** Tables in a source whose name or description share words with the idea; best first. No AI. */
export function matchTables(source: ApprovedSource, text: string, max = 4): string[] {
  const want = stems(text);
  if (!want.size) return [];
  return source.tables
    .map(t => {
      const nameHits = [...stems(t.name)].filter(w => want.has(w)).length;
      const aboutHits = [...stems(t.comment)].filter(w => want.has(w)).length;
      return { name: t.name, score: nameHits * 3 + aboutHits };
    })
    .filter(t => t.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map(t => t.name);
}
