import { useCallback, useSyncExternalStore } from 'react';
import { STEPS, type Idea } from '../components/ideate/types';
import { skippedImpact } from '../components/ideate/businessCase';

const STORAGE_KEY = 'v2v.ideate.ideas.v1';

type Listener = () => void;
const listeners = new Set<Listener>();

function load(): Idea[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((i): i is Idea => !!i && typeof i === 'object' && typeof i.id === 'string')
      .map(i => ({
        ...i,
        seed: i.seed ?? '',
        title: i.title || 'Untitled idea',
        industry: i.industry ?? '',
        status: i.status ?? 'exploring',
        step: STEPS.some(s => s.key === i.step) ? i.step : 'spark',
        approved: Array.isArray(i.approved) ? i.approved : [],
        answers: i.answers && typeof i.answers === 'object' ? i.answers : {},
        assumptions: Array.isArray(i.assumptions) ? i.assumptions : [],
        decisions: Array.isArray(i.decisions) ? i.decisions : [],
        createdAt: i.createdAt ?? new Date().toISOString(),
        updatedAt: i.updatedAt ?? new Date().toISOString(),
      }))
      .map(withImpactStep);
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
  } catch {
    // Storage full or disabled: keep the in-memory copy so the session still works.
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
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
}

export function useIdeas() {
  const ideas = useSyncExternalStore(subscribe, () => snapshot, () => snapshot);

  const createIdea = useCallback((seed: string, industry: string): Idea => {
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
    };
    commit([idea, ...snapshot]);
    return idea;
  }, []);

  const updateIdea = useCallback((id: string, patch: Partial<Idea> | ((idea: Idea) => Partial<Idea>)) => {
    commit(snapshot.map(i => {
      if (i.id !== id) return i;
      const p = typeof patch === 'function' ? patch(i) : patch;
      return { ...i, ...p, updatedAt: new Date().toISOString() };
    }));
  }, []);

  const deleteIdea = useCallback((id: string) => {
    commit(snapshot.filter(i => i.id !== id));
  }, []);

  const duplicateIdea = useCallback((id: string) => {
    const src = snapshot.find(i => i.id === id);
    if (!src) return;
    const now = new Date().toISOString();
    commit([{ ...src, id: newId(), title: `${src.title} (copy)`, status: 'exploring', catalogRef: undefined, createdAt: now, updatedAt: now }, ...snapshot]);
  }, []);

  return { ideas, createIdea, updateIdea, deleteIdea, duplicateIdea };
}
