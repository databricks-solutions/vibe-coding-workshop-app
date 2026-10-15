import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { apiClient } from '../../../api/client';
import { stepsFor, type Idea, type IdeaScore } from './types';
import { skippedImpact } from './businessCase';
import { caseFigures } from './ideaContext';

const STORAGE_KEY = 'v2v.ideate.ideas.v1';
const SAVE_DELAY_MS = 1500;
const RETRY_MS = 15000;

type Listener = () => void;
const listeners = new Set<Listener>();

function normalize(list: unknown): Idea[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((i): i is Idea => !!i && typeof i === 'object' && typeof (i as Idea).id === 'string')
    .map(i => ({
      ...i,
      seed: i.seed ?? '',
      title: i.title || 'Untitled idea',
      industry: i.industry ?? '',
      status: i.status ?? 'exploring',
      step: stepsFor(i.mode).some(s => s.key === i.step) ? i.step : 'spark',
      approved: Array.isArray(i.approved) ? i.approved : [],
      answers: i.answers && typeof i.answers === 'object' ? i.answers : {},
      assumptions: Array.isArray(i.assumptions) ? i.assumptions : [],
      decisions: Array.isArray(i.decisions) ? i.decisions : [],
      createdAt: i.createdAt ?? new Date().toISOString(),
      updatedAt: i.updatedAt ?? new Date().toISOString(),
    }))
    .map(withImpactStep);
}

/** One idea from outside the store (a server payload), with the same defaults the store applies. */
export function normalizeIdea(raw: unknown): Idea | null {
  return normalize([raw])[0] ?? null;
}

function load(): Idea[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return normalize(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

/** Ideas saved before the Impact step existed already sit at the Brief; treat Impact as skipped. */
function withImpactStep(idea: Idea): Idea {
  if (idea.approved.includes('impact') || !idea.approved.includes('shape') || idea.step !== 'brief') return idea;
  return { ...idea, impact: idea.impact ?? skippedImpact(), approved: [...idea.approved, 'impact'] };
}

let snapshot: Idea[] = typeof window !== 'undefined' ? load() : [];

function commit(next: Idea[]) {
  snapshot = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    if (syncState === 'storage-full') setSync(pending.size ? 'saving' : 'saved');
  } catch {
    // Storage full or disabled: keep the in-memory copy, and say so instead of failing silently.
    setSync('storage-full');
  }
  listeners.forEach(l => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      snapshot = load();
      listeners.forEach(l => l());
    }
  });
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function newId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

// ============== Server sync ==============

/** `local` means the server is not available (signed out or feature off): ideas stay in this browser only. */
export type SyncState = 'idle' | 'saving' | 'saved' | 'offline' | 'storage-full' | 'local';

let syncState: SyncState = 'idle';
const syncListeners = new Set<Listener>();
const pending = new Map<string, ReturnType<typeof setTimeout>>();
let serverEnabled = true;
let hydrated = false;

function setSync(s: SyncState) {
  if (s === syncState) return;
  syncState = s;
  syncListeners.forEach(l => l());
}

const forServer = (idea: Idea) => {
  const rest: Partial<Idea> = { ...idea };
  delete rest.score;
  return rest as unknown as Record<string, unknown>;
};

function applyScore(id: string, score: IdeaScore) {
  if (!snapshot.some(i => i.id === id)) return;
  commit(snapshot.map(i => (i.id === id ? { ...i, score } : i)));
}

function schedulePush(id: string, delay = SAVE_DELAY_MS) {
  if (!serverEnabled) return;
  clearTimeout(pending.get(id));
  setSync('saving');
  pending.set(id, setTimeout(() => void push(id), delay));
}

async function push(id: string) {
  pending.delete(id);
  const idea = snapshot.find(i => i.id === id);
  if (!idea || idea.sample) return;
  try {
    const r = await apiClient.ideaSave(forServer(idea), caseFigures(idea)?.value.expected ?? null);
    applyScore(id, r.score as IdeaScore);
    if (!pending.size) setSync('saved');
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 401 || status === 404 || status === 405) {
      serverEnabled = false;
      pending.forEach(t => clearTimeout(t));
      pending.clear();
      setSync('local');
    } else if (status === 403 || status === 400 || status === 410 || status === 413) {
      if (!pending.size) setSync('offline');
    } else {
      setSync('offline');
      schedulePush(id, RETRY_MS);
    }
  }
}

/** Merge the server's copy once per page load; local ideas the server has never seen are uploaded. */
async function hydrate() {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  let remote: Idea[];
  try {
    remote = normalize(await apiClient.ideasList());
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 401 || status === 404 || status === 405) {
      serverEnabled = false;
      setSync('local');
    } else {
      setSync('offline');
    }
    return;
  }
  const byId = new Map(remote.map(i => [i.id, i]));
  const merged: Idea[] = [];
  const toPush: string[] = [];
  for (const local of snapshot) {
    const server = byId.get(local.id);
    byId.delete(local.id);
    if (!server) {
      merged.push(local);
      if (!local.sample) toPush.push(local.id);
    } else if (server.updatedAt > local.updatedAt) {
      merged.push(server);
    } else {
      merged.push({ ...local, score: server.score });
      if (local.updatedAt > server.updatedAt) toPush.push(local.id);
    }
  }
  merged.push(...byId.values());
  merged.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  commit(merged);
  toPush.forEach((id, n) => schedulePush(id, SAVE_DELAY_MS + n * 200));
  if (!toPush.length) setSync('saved');
}

function subscribeSync(listener: Listener) {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

/** Where the ideas are saved right now, for a quiet "Saved" indicator. */
export function useSyncState(): SyncState {
  return useSyncExternalStore(subscribeSync, () => syncState, () => syncState);
}

/** Saves an idea now instead of after the debounce; false when the server can't be used. */
export async function flushIdea(id: string): Promise<boolean> {
  if (!serverEnabled) return false;
  clearTimeout(pending.get(id));
  await push(id);
  return serverEnabled && syncState !== 'offline';
}

export const serverSyncEnabled = () => serverEnabled;

/** Puts a fresh server score on a stored idea, e.g. after the AI scorecard runs. */
export function setIdeaScore(id: string, score: IdeaScore) {
  applyScore(id, score);
}

// ============== Hook ==============

export function useIdeas() {
  const ideas = useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
  useEffect(() => { void hydrate(); }, []);

  const createIdea = useCallback((seed: string, industry: string, extra: Partial<Idea> = {}): Idea => {
    const now = new Date().toISOString();
    const idea: Idea = {
      id: newId(),
      seed,
      title: seed.split(/\s+/).slice(0, 6).join(' '),
      industry,
      status: 'exploring',
      createdAt: now,
      updatedAt: now,
      step: 'spark',
      approved: [],
      answers: {},
      assumptions: [],
      decisions: [{ at: now, text: 'Idea captured' }],
      ...extra,
    };
    commit([idea, ...snapshot]);
    schedulePush(idea.id);
    return idea;
  }, []);

  const updateIdea = useCallback((id: string, patch: Partial<Idea> | ((idea: Idea) => Partial<Idea>)) => {
    commit(snapshot.map(i => {
      if (i.id !== id) return i;
      const p = typeof patch === 'function' ? patch(i) : patch;
      return { ...i, ...p, updatedAt: new Date().toISOString() };
    }));
    schedulePush(id);
  }, []);

  const deleteIdea = useCallback((id: string) => {
    clearTimeout(pending.get(id));
    pending.delete(id);
    commit(snapshot.filter(i => i.id !== id));
    if (serverEnabled) void apiClient.ideaDelete(id).catch(() => undefined);
  }, []);

  const duplicateIdea = useCallback((id: string) => {
    const src = snapshot.find(i => i.id === id);
    if (!src) return;
    const copy = copyOf(src, { title: `${src.title} (copy)` });
    commit([copy, ...snapshot]);
    schedulePush(copy.id);
  }, []);

  /** Saves a copy of an idea that lives outside the store, such as a sample, and returns its id. */
  const adoptIdea = useCallback((src: Idea, note: string): string => {
    const copy = copyOf(src, { sample: undefined });
    commit([{ ...copy, decisions: [...src.decisions, { at: copy.createdAt, text: note }] }, ...snapshot]);
    schedulePush(copy.id);
    return copy.id;
  }, []);

  return { ideas, createIdea, updateIdea, deleteIdea, duplicateIdea, adoptIdea };
}

/** A copy never inherits the original's Insights project, build, or score. */
function copyOf(src: Idea, extra: Partial<Idea>): Idea {
  const now = new Date().toISOString();
  return {
    ...src,
    id: newId(),
    status: 'exploring',
    catalogRef: undefined,
    sessionId: undefined,
    lockedAt: undefined,
    buildTarget: undefined,
    buildStatus: undefined,
    buildStage: undefined,
    builtRevision: undefined,
    caseOpenedAt: undefined,
    score: undefined,
    trailSeenAt: undefined,
    createdAt: now,
    updatedAt: now,
    ...extra,
  };
}
