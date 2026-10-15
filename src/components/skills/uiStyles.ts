export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}

export const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-ui-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50';
export const BTN_SECONDARY =
  'inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-ui-sm font-medium border border-border bg-card text-foreground hover:bg-secondary transition-colors disabled:opacity-50';
export const BTN_GHOST =
  'inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-ui-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors';
