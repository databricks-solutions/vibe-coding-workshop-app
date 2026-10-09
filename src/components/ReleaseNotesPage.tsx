/**
 * ReleaseNotesPage - versioned changelog of user-visible changes.
 *
 * Content lives in src/constants/releaseNotes.ts (newest first). The newest
 * release starts expanded and carries a "Latest" pill.
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  Cpu,
  Database,
  Network,
  Palette,
  Rocket,
  Route,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import {
  RELEASES,
  type Release,
  type ReleaseItem,
  type ReleaseItemAudience,
  type ReleaseItemCategory,
  type ReleaseItemIcon,
} from '../constants/releaseNotes';

const ICONS: Record<ReleaseItemIcon, LucideIcon> = {
  sparkles: Sparkles,
  palette: Palette,
  diagram: Network,
  shield: ShieldCheck,
  route: Route,
  cpu: Cpu,
  database: Database,
  rocket: Rocket,
  wrench: Wrench,
  terminal: Terminal,
  search: Search,
};

const CATEGORY_META: Record<ReleaseItemCategory, { label: string; icon: ReleaseItemIcon; chip: string; iconColor: string }> = {
  new: {
    label: 'New',
    icon: 'sparkles',
    chip: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
    iconColor: 'text-emerald-500',
  },
  improved: {
    label: 'Improved',
    icon: 'sparkles',
    chip: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30',
    iconColor: 'text-sky-500',
  },
  fix: {
    label: 'Fix',
    icon: 'wrench',
    chip: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
    iconColor: 'text-amber-500',
  },
};

const AUDIENCE_LABEL: Record<ReleaseItemAudience, string> = {
  attendee: 'Workshop',
  installer: 'Install & Admin',
};

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function ReleaseItemRow({ item }: { item: ReleaseItem }) {
  const meta = CATEGORY_META[item.category];
  const Icon = ICONS[item.icon ?? meta.icon];
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${meta.iconColor}`} aria-hidden="true" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="text-ui-base font-semibold text-foreground">{item.title}</h3>
          <span className={`text-ui-2xs font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 leading-none border ${meta.chip}`}>
            {meta.label}
          </span>
          {item.beta && (
            <span className="text-ui-2xs font-semibold uppercase tracking-wide rounded px-1.5 py-0.5 leading-none border border-amber-500/40 bg-amber-500/10 text-amber-400">
              Beta
            </span>
          )}
          {item.audience && (
            <span className="text-ui-2xs font-medium rounded px-1.5 py-0.5 leading-none border border-border text-muted-foreground">
              {AUDIENCE_LABEL[item.audience]}
            </span>
          )}
        </div>
        <p className="mt-1 text-ui-sm text-muted-foreground leading-relaxed">{item.description}</p>
      </div>
    </li>
  );
}

function ReleaseCard({ release, isLatest, defaultOpen }: { release: Release; isLatest: boolean; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-xl border bg-card ${isLatest ? 'border-primary/40' : 'border-border'}`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-foreground">v{release.version}</span>
            {isLatest && (
              <span className="text-ui-2xs font-semibold rounded px-1.5 py-0.5 leading-none bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                Latest
              </span>
            )}
          </div>
          <p className="text-ui-xs text-muted-foreground">
            {formatDate(release.date)} <span aria-hidden="true">·</span> {release.title}
          </p>
        </div>
        <ChevronDown
          className={`w-4 h-4 flex-shrink-0 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <ul className="border-t border-border px-5 py-4 divide-y divide-border">
              {release.items.map(item => (
                <ReleaseItemRow key={item.title} item={item} />
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ReleaseNotesPage() {
  return (
    <div className="flex-1 overflow-auto gradient-mesh">
      <div className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center shadow-lg shadow-primary/30">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Release Notes</h1>
              <p className="text-ui-xs text-muted-foreground">Stay up to date with the latest features and improvements</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </div>

      <div className="p-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {RELEASES.map((release, i) => (
            <ReleaseCard key={release.version} release={release} isLatest={i === 0} defaultOpen={i === 0} />
          ))}
        </div>
      </div>
    </div>
  );
}
