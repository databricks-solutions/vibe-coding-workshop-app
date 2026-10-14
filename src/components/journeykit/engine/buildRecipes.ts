import { useSyncExternalStore } from 'react';
import { apiClient } from '../../../api/client';

/** Insights add-ons that build more than the Genie space and dashboard. Each stays off until it is turned on. */
export type SwitchedAddOn = 'ontology' | 'alerts' | 'app_view' | 'copilot';
export const SWITCHED_ADD_ONS: SwitchedAddOn[] = ['ontology', 'alerts', 'app_view', 'copilot'];

const OVERRIDE_KEY = 'v2v:insights-recipes';
const EMPTY: ReadonlySet<SwitchedAddOn> = new Set();

let server: ReadonlySet<SwitchedAddOn> = EMPTY;
let snapshot: ReadonlySet<SwitchedAddOn> = EMPTY;
let started = false;
const listeners = new Set<() => void>();

function parseList(raw: string | null | undefined): Set<SwitchedAddOn> {
  const parts = (raw ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (parts.includes('all')) return new Set(SWITCHED_ADD_ONS);
  return new Set(parts.filter((p): p is SwitchedAddOn => (SWITCHED_ADD_ONS as string[]).includes(p)));
}

/** `?recipes=all` (or a comma list) turns add-ons on in this browser only; `?recipes=off` clears it. */
function readOverride(): Set<SwitchedAddOn> | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('recipes');
    if (fromUrl !== null) {
      if (fromUrl === 'off' || fromUrl === '') localStorage.removeItem(OVERRIDE_KEY);
      else localStorage.setItem(OVERRIDE_KEY, fromUrl);
    }
    const stored = localStorage.getItem(OVERRIDE_KEY);
    return stored ? parseList(stored) : null;
  } catch {
    return null;
  }
}

function recompute() {
  const override = readOverride();
  const next = override ?? server;
  const same = next.size === snapshot.size && [...next].every(a => snapshot.has(a));
  if (same) return;
  snapshot = next;
  listeners.forEach(l => l());
}

function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  recompute();
  apiClient.getInsightsRecipes()
    .then(r => { server = parseList((r?.enabled ?? []).join(',')); })
    .catch(() => { server = EMPTY; })
    .finally(recompute);
}

/** Add-ons turned on right now. Empty until loaded, and empty if the setting cannot be read. */
export function enabledAddOns(): ReadonlySet<SwitchedAddOn> {
  start();
  return snapshot;
}

export function useEnabledAddOns(): ReadonlySet<SwitchedAddOn> {
  return useSyncExternalStore(
    cb => { start(); listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => snapshot,
    () => EMPTY,
  );
}
