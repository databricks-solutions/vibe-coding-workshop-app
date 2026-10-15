import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const loadedBundle = () =>
  Array.from(document.scripts)
    .map(s => new URL(s.src, location.href).pathname)
    .find(path => /\/assets\/index-[\w-]+\.js$/.test(path)) ?? null;

const bundleFromHtml = (html: string) =>
  html.match(/<script[^>]+src=["']([^"']*\/assets\/index-[\w-]+\.js)["']/i)?.[1] ?? null;

/** Tells an already-open SPA when a rolling deployment has published a new hashed bundle. */
export function BundleUpdateNotice() {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const current = loadedBundle();
    if (!current) return; // Vite dev mode has no production bundle hash.
    let alive = true;

    const check = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const res = await fetch(`/?_bundle_check=${Date.now()}`, { cache: 'no-store', credentials: 'same-origin' });
        if (!res.ok) return;
        const next = bundleFromHtml(await res.text());
        if (alive && next && new URL(next, location.href).pathname !== current) setAvailable(true);
      } catch {
        // A rolling deploy can briefly make the root unavailable; the next check retries.
      }
    };

    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(check, 45_000);
    void check();
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  if (!available) return null;
  return (
    <div className="fixed inset-x-4 bottom-5 z-[100] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-primary/30 bg-card/95 px-4 py-3 shadow-xl backdrop-blur" role="status">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <RefreshCw className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-ui-sm font-semibold text-foreground">A newer version is ready</span>
        <span className="block text-ui-xs text-muted-foreground">Your saved progress is safe.</span>
      </span>
      <button onClick={() => location.reload()} className="shrink-0 rounded-lg bg-primary px-3 py-2 text-ui-sm font-semibold text-primary-foreground hover:opacity-90">
        Reload
      </button>
    </div>
  );
}
