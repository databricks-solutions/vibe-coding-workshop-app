/**
 * Non-component shared bits for the Hackathon UI (constants + helpers).
 *
 * Kept separate from hackathonShared.tsx so that file only exports components
 * (satisfies react-refresh/only-export-components and keeps HMR working).
 * Styling follows V2V theme tokens: color trios (text / bg / border),
 * text-ui-* scale, no MUI.
 */

import type { HackathonRole, HackathonStatus } from '../../api/client';

/** Status -> label + color-trio (text / bg / border), matching the section palette. */
export const STATUS_META: Record<
  HackathonStatus,
  { label: string; text: string; bg: string; border: string }
> = {
  draft: {
    label: 'Draft',
    text: 'text-slate-400',
    bg: 'bg-slate-500/15',
    border: 'border-slate-500/30',
  },
  registration_open: {
    label: 'Registration Open',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/30',
  },
  in_progress: {
    label: 'In Progress',
    text: 'text-sky-400',
    bg: 'bg-sky-500/15',
    border: 'border-sky-500/30',
  },
  judging: {
    label: 'Judging',
    text: 'text-violet-400',
    bg: 'bg-violet-500/15',
    border: 'border-violet-500/30',
  },
  completed: {
    label: 'Completed',
    text: 'text-amber-400',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
  },
};

/** Ordered statuses — used by the organizer's "advance status" control. */
export const STATUS_ORDER: HackathonStatus[] = [
  'draft',
  'registration_open',
  'in_progress',
  'judging',
  'completed',
];

export const ROLE_META: Record<HackathonRole, { label: string; text: string; bg: string }> = {
  organizer: { label: 'Organizer', text: 'text-rose-400', bg: 'bg-rose-500/15' },
  judge: { label: 'Judge', text: 'text-violet-400', bg: 'bg-violet-500/15' },
  participant: { label: 'Participant', text: 'text-emerald-400', bg: 'bg-emerald-500/15' },
};

export function displayName(email: string): string {
  if (email && email.includes('@')) {
    return email
      .split('@')[0]
      .replace(/[._]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return email || 'Unknown';
}

/** Tailwind input class used by the create form and editors. */
export const inputClass =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-ui-base text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all';
