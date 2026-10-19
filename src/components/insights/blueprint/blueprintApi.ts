import { useEffect, useState } from 'react';
import type { BlueprintCatalog, BlueprintDigest, BlueprintFit, Capabilities, FitJob, InstallStatus, InstalledModel } from './types';

const BASE = '/api/blueprints';

/** An error from the app's API, with its HTTP status (0 when the request never got a reply). */
export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: 'same-origin', ...init });
  } catch (err) {
    throw new ApiError(String((err as Error)?.message || err), 0);
  }
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json())?.detail ?? ''; } catch { /* not json */ }
    throw new ApiError(detail || `Request failed (${res.status})`, res.status);
  }
  return res.json() as Promise<T>;
}

const postJson = <T>(url: string, body: unknown) =>
  getJson<T>(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

let catalogPromise: Promise<BlueprintCatalog> | null = null;
let installedPromise: Promise<InstalledModel[]> | null = null;
const digestPromises = new Map<string, Promise<BlueprintDigest>>();
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
  fit: {
    start: (slug, context, questions, suggested, retry = false) =>
      postJson<FitJob>(`${BASE}/${encodeURIComponent(slug)}/fit/start`, { context, questions, suggested, retry }),
    poll: (slug, job) => getJson<FitJob>(`${BASE}/${encodeURIComponent(slug)}/fit/${encodeURIComponent(job)}`),
  } satisfies FitFetcher,
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

/** Starts a match on the server and reports on it; `id` is the digest slug. */
export interface FitFetcher {
  start(id: string, context: string, questions: string[], suggested: string[], retry?: boolean): Promise<FitJob>;
  poll(id: string, job: string): Promise<FitJob>;
}

/**
 * `data` is the interim local match while `refining`, then the final one. `loading` means nothing to show yet.
 * `failed` means the app could not be reached or the match could not be built at all; `retry` starts it again.
 */
export type FitState = { data: BlueprintFit | null; loading: boolean; refining: boolean; failed: boolean; error: string; retry: () => void };

const POLL_MS = 2000;
/** Past the server's own deadline, so a lost job ends with what it has instead of spinning forever. */
const GIVE_UP_MS = 4 * 60 * 1000;
const MAX_RESTARTS = 2;

type FitResult = { tag: string; data: BlueprintFit | null; running: boolean; failed: boolean; error: string };

export function useFitWith(fetcher: FitFetcher, id: string | null, context: string, questions: string[], suggested: string[] = []): FitState {
  const enabled = !!id && (!!context.trim() || questions.length > 0);
  const key = enabled ? JSON.stringify([id, context, questions, suggested]) : '';
  const [attempt, setAttempt] = useState(0);
  const tag = `${key}#${attempt}`;
  const [result, setResult] = useState<FitResult | null>(null);
  useEffect(() => {
    if (!key) return;
    const [s, c, q, sg] = JSON.parse(key) as [string, string, string[], string[]];
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let restarts = 0;
    const startedAt = Date.now();
    let last: BlueprintFit | null = null;
    let lastJson = '';

    const settle = (job: FitJob) => {
      if (!alive) return;
      // Keep the same object while the fit is unchanged, so polling doesn't look like a new result.
      const json = job.fit ? JSON.stringify(job.fit) : '';
      if (json && json !== lastJson) {
        last = job.fit;
        lastJson = json;
      }
      const running = job.status === 'running' && Date.now() - startedAt < GIVE_UP_MS;
      setResult({ tag, data: last, running, failed: job.status === 'failed' && !last, error: job.error });
      if (running) timer = setTimeout(() => void poll(job.job), POLL_MS);
    };
    const fail = (err: unknown) => {
      if (!alive) return;
      setResult({ tag, data: last, running: false, failed: !last, error: String((err as Error)?.message || err) });
    };
    const start = (retry: boolean) => fetcher.start(s, c, q, sg, retry).then(settle, fail);
    const poll = (job: string) => fetcher.poll(s, job).then(settle, err => {
      // The job is gone (a restart or another replica); start it again rather than giving up.
      if (err instanceof ApiError && err.status === 404 && restarts < MAX_RESTARTS) {
        restarts += 1;
        void start(false);
      } else if (err instanceof ApiError && err.status === 0 && Date.now() - startedAt < GIVE_UP_MS) {
        timer = setTimeout(() => void poll(job), POLL_MS * 2);
      } else {
        fail(err);
      }
    });

    void start(attempt > 0);
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [key, tag, attempt, fetcher]);

  const retry = () => setAttempt(a => a + 1);
  if (!enabled) return { data: null, loading: false, refining: false, failed: false, error: '', retry };
  if (result?.tag === tag) {
    return { data: result.data, loading: result.running && !result.data, refining: result.running, failed: result.failed, error: result.error, retry };
  }
  // A retry keeps showing what the last attempt found while it runs.
  const kept = result && result.tag.startsWith(`${key}#`) ? result.data : null;
  return { data: kept, loading: !kept, refining: true, failed: false, error: '', retry };
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
