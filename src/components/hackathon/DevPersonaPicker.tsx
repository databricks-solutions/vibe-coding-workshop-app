/**
 * DevPersonaPicker — a LOCAL-DEV-ONLY "act as" switcher (inspired by
 * HackathonHive's UserSwitcher). Lets you impersonate organizer/participant/judge/
 * voter personas without real auth, so you can exercise every hackathon flow on
 * one machine (and so Playwright can drive multi-persona journeys).
 *
 * It renders nothing unless the backend reports the dev gate is open
 * (USE_LAKEBASE=false / DEV_PERSONA_SWITCH). In production it's invisible and inert.
 */

import { useEffect, useState, useRef } from 'react';
import { UserCog, ChevronDown, Check, X } from 'lucide-react';
import {
  apiClient,
  getDevPersona,
  setDevPersona,
  type DevPersona,
} from '../../api/client';

export function DevPersonaPicker() {
  const [enabled, setEnabled] = useState(false);
  const [personas, setPersonas] = useState<DevPersona[]>([]);
  const [current, setCurrent] = useState<string | null>(getDevPersona());
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getDevPersonaConfig()
      .then((cfg) => {
        if (cancelled) return;
        setEnabled(cfg.enabled);
        setPersonas(cfg.personas);
        // If nothing chosen yet, reflect what the backend currently resolves.
        if (!getDevPersona() && cfg.current && cfg.current.includes('@')) {
          setCurrent(cfg.current);
        }
      })
      .catch(() => setEnabled(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!enabled) return null;

  const choose = (email: string | null) => {
    setDevPersona(email);
    setCurrent(email);
    setOpen(false);
    // Reload so every component refetches under the new identity.
    window.location.reload();
  };

  const currentPersona = personas.find((p) => p.email === current);
  const label = currentPersona?.name || (current ? current.split('@')[0] : 'Pick persona');

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-ui-2xs font-medium text-amber-400 hover:bg-amber-500/20 transition-all"
        title="Dev only: act as a different user"
        data-testid="dev-persona-trigger"
      >
        <UserCog className="w-3.5 h-3.5" />
        <span className="max-w-[8rem] truncate">{label}</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-64 z-50 rounded-xl border border-border bg-popover shadow-2xl overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-amber-500/5">
            <p className="text-ui-2xs font-semibold uppercase tracking-wider text-amber-400">
              Dev: act as
            </p>
            <p className="text-ui-2xs text-muted-foreground mt-0.5">
              Local only — switches the acting user.
            </p>
          </div>
          <div className="max-h-72 overflow-auto py-1">
            {personas.map((p) => (
              <button
                key={p.email}
                onClick={() => choose(p.email)}
                data-testid={`dev-persona-${p.email}`}
                className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-secondary/50 transition-colors"
              >
                <span className="mt-0.5 w-4 flex-shrink-0">
                  {current === p.email && <Check className="w-4 h-4 text-amber-400" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-ui-sm text-foreground font-medium truncate">{p.name}</span>
                  <span className="block text-ui-2xs text-muted-foreground truncate">{p.email}</span>
                  {p.hint && <span className="block text-ui-2xs text-muted-foreground/60">{p.hint}</span>}
                </span>
              </button>
            ))}
          </div>
          {current && (
            <button
              onClick={() => choose(null)}
              className="w-full flex items-center gap-2 px-3 py-2 border-t border-border text-ui-2xs text-muted-foreground hover:bg-secondary/50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear persona (use default identity)
            </button>
          )}
        </div>
      )}
    </div>
  );
}
