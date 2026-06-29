/**
 * Shared *components* for the Hackathon feature UI (badges + buttons).
 *
 * Non-component shared values (STATUS_META, STATUS_ORDER, ROLE_META,
 * displayName, inputClass) live in ./hackathonStyles — import those from there.
 * Keeping this file components-only satisfies react-refresh/only-export-components.
 */

import type { HackathonRole, HackathonStatus } from '../../api/client';
import { STATUS_META, ROLE_META } from './hackathonStyles';

export function StatusBadge({ status }: { status: HackathonStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.draft;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-ui-2xs font-semibold ${m.text} ${m.bg} border ${m.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${m.text.replace('text', 'bg')}`} />
      {m.label}
    </span>
  );
}

export function RoleBadge({ role }: { role: HackathonRole }) {
  const m = ROLE_META[role] ?? ROLE_META.participant;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-ui-2xs font-medium ${m.text} ${m.bg}`}
    >
      {m.label}
    </span>
  );
}

/** Primary button used across hackathon screens. */
export function PrimaryButton({
  children,
  onClick,
  type = 'button',
  disabled,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-md text-ui-base font-medium bg-primary text-primary-foreground transition-all duration-200 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

/** Secondary / outline button. */
export function GhostButton({
  children,
  onClick,
  disabled,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md text-ui-base font-medium border border-border text-foreground transition-all duration-200 hover:bg-secondary/60 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}
