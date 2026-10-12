import { useEffect, useState } from 'react';
import type { BlueprintCatalog, BlueprintDigest, BlueprintFit, Capabilities, InstallStatus, InstalledModel } from './types';

const BASE = '/api/blueprints';

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin', ...init });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.detail ?? ''; } catch { /* not json */ }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

let catalogPromise: Promise<BlueprintCatalog> | null = null;
let installedPromise: Promise<InstalledModel[]> | null = null;
const digestPromises = new Map<string, Promise<BlueprintDigest>>();
const fitPromises = new Map<string, Promise<BlueprintFit>>();
type ModelPickReply = { slug: string; label: string; why: string };
const pickPromises = new Map<string, Promise<ModelPickReply>>();

export const blueprintApi = {
  catalog(): Promise<BlueprintCatalog> {
    if (!catalogPromise) {
      catalogPromise = getJson<BlueprintCatalog>(BASE).catch(err => {
        catalogPromise = null;
        throw err;
      });
    }
    return catalogPromise;
  },
  digest(slug: string): Promise<BlueprintDigest> {
    let p = digestPromises.get(slug);
    if (!p) {
      p = getJson<BlueprintDigest>(`${BASE}/${encodeURIComponent(slug)}`).catch(err => {
        digestPromises.delete(slug);
        throw err;
      });
      digestPromises.set(slug, p);
    }
    return p;
  },
  installed(): Promise<InstalledModel[]> {
    if (!installedPromise) {
      installedPromise = getJson<{ models: InstalledModel[] }>(`${BASE}/installed`)
        .then(r => r.models ?? [])
        .catch(err => {
          installedPromise = null;
          throw err;
        });
    }
    return installedPromise;
  },
  fit(slug: string, context: string, questions: string[], suggested: string[] = []): Promise<BlueprintFit> {
    const key = JSON.stringify([slug, context, questions, suggested]);
    let p = fitPromises.get(key);
    if (!p) {
      p = getJson<BlueprintFit>(`${BASE}/${encodeURIComponent(slug)}/fit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, questions, suggested }),
      }).catch(err => {
        fitPromises.delete(key);
        throw err;
      });
      fitPromises.set(key, p);
    }
    return p;
  },
  pick(context: string): Promise<ModelPickReply> {
    let p = pickPromises.get(context);
    if (!p) {
      p = getJson<ModelPickReply>(`${BASE}/pick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context }),
      }).catch(err => {
        pickPromises.delete(context);
        throw err;
      });
      pickPromises.set(context, p);
    }
    return p;
  },
  capabilities: () => getJson<Capabilities>(`${BASE}/capabilities`),
  status: (slug: string) => getJson<InstallStatus>(`${BASE}/${encodeURIComponent(slug)}/status`),
  install: (slug: string) => getJson<InstallStatus>(`${BASE}/${encodeURIComponent(slug)}/install`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  }),
};

type Loadable<T> = { data: T | null; error: string | null; loading: boolean };

export function useBlueprintCatalog(): Loadable<BlueprintCatalog> {
  const [state, setState] = useState<Loadable<BlueprintCatalog>>({ data: null, error: null, loading: true });
  useEffect(() => {
    let alive = true;
    blueprintApi.catalog()
      .then(data => alive && setState({ data, error: null, loading: false }))
      .catch(err => alive && setState({ data: null, error: String(err?.message || err), loading: false }));
    return () => { alive = false; };
  }, []);
  return state;
}

/** Industry data models already in this workspace; empty on any failure. */
export function useInstalledModels(): InstalledModel[] {
  const [models, setModels] = useState<InstalledModel[]>([]);
  useEffect(() => {
    let alive = true;
    blueprintApi.installed().then(m => alive && setModels(m)).catch(() => {});
    return () => { alive = false; };
  }, []);
  return models;
}

export function useBlueprintDigest(slug: string | null, attempt = 0): Loadable<BlueprintDigest> {
  const key = slug ? `${slug}:${attempt}` : '';
  const [result, setResult] = useState<{ key: string; data: BlueprintDigest | null; error: string | null } | null>(null);
  useEffect(() => {
    if (!slug) return;
    let alive = true;
    blueprintApi.digest(slug)
      .then(data => alive && setResult({ key, data, error: null }))
      .catch(err => alive && setResult({ key, data: null, error: String(err?.message || err) }));
    return () => { alive = false; };
  }, [slug, key]);
  if (!slug) return { data: null, error: null, loading: false };
  if (result?.key === key) return { data: result.data, error: result.error, loading: false };
  return { data: null, error: null, loading: true };
}

/** The AI's match of the idea to a loaded model; `data` stays null while it thinks or when it fails. */
export function useBlueprintFit(slug: string | null, context: string, questions: string[], suggested: string[] = []) {
  const enabled = !!slug && (!!context.trim() || questions.length > 0);
  const key = enabled ? JSON.stringify([slug, context, questions, suggested]) : '';
  const [result, setResult] = useState<{ key: string; data: BlueprintFit | null; failed: boolean } | null>(null);
  useEffect(() => {
    if (!key) return;
    const [s, c, q, sg] = JSON.parse(key) as [string, string, string[], string[]];
    let alive = true;
    blueprintApi.fit(s, c, q, sg)
      .then(data => alive && setResult({ key, data, failed: false }))
      .catch(() => alive && setResult({ key, data: null, failed: true }));
    return () => { alive = false; };
  }, [key]);
  if (!enabled) return { data: null, loading: false, failed: false };
  if (result?.key === key) return { data: result.data, loading: false, failed: result.failed };
  return { data: null, loading: true, failed: false };
}

/** Polls install status; fast while installing, slow otherwise. */
export function useInstallStatus(slug: string | null, enabled = true) {
  const [status, setStatus] = useState<InstallStatus | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!slug || !enabled) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = () => {
      blueprintApi.status(slug)
        .then(s => {
          if (!alive) return;
          setStatus(s);
          timer = setTimeout(poll, s.state === 'installing' ? 5000 : 30000);
        })
        .catch(() => {
          if (!alive) return;
          setStatus(s => s ?? { state: 'unknown', catalog: '', percent: 0 });
          timer = setTimeout(poll, 30000);
        });
    };
    poll();
    return () => { alive = false; clearTimeout(timer); };
  }, [slug, enabled, tick]);
  const refresh = () => setTick(t => t + 1);
  /** Apply a fresh status (e.g. from install) and restart polling at the matching cadence. */
  const update = (s: InstallStatus) => { setStatus(s); refresh(); };
  return { status, update, refresh };
}
