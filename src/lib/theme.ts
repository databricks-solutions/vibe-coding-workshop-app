import { useSyncExternalStore } from 'react';

/**
 * One app-wide theme. index.html applies the stored choice before first paint;
 * this module keeps it in sync after that. Both classes are set on <html>:
 * `light` drives the CSS variables, `dark` drives Tailwind's `dark:` variant.
 */
export type Theme = 'dark' | 'light';

const STORAGE_KEY = 'theme';
const listeners = new Set<() => void>();

function read(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

let current: Theme = typeof window === 'undefined' ? 'dark' : read();

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('light', theme === 'light');
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

export const getTheme = () => current;

export function setTheme(theme: Theme) {
  current = theme;
  applyTheme(theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Storage disabled: the choice still holds for this tab.
  }
  listeners.forEach(l => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => {
    if (e.key !== STORAGE_KEY) return;
    current = read();
    applyTheme(current);
    listeners.forEach(l => l());
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, getTheme, () => 'dark' as Theme);
  return [theme, setTheme];
}
