export type Movement = 'up' | 'down' | 'new' | 'same';

/** Rank movement since the last fetch, keyed by whatever identifies a row. */
export function withMovement<T extends { rank: number }>(entries: T[], prevRanks: Map<string, number>, keyOf: (e: T) => string) {
  const rows = entries.map(entry => {
    const prev = prevRanks.get(keyOf(entry));
    let movement: Movement = 'same';
    let rankChange: number | undefined;
    if (prev === undefined) {
      if (prevRanks.size > 0) movement = 'new';
    } else if (prev > entry.rank) {
      movement = 'up';
      rankChange = prev - entry.rank;
    } else if (prev < entry.rank) {
      movement = 'down';
      rankChange = entry.rank - prev;
    }
    return { ...entry, movement, rankChange };
  });
  return { rows, ranks: new Map(entries.map(e => [keyOf(e), e.rank])) };
}

/** Row surface by rank: gold, silver, bronze, then the plain card. */
export function rankRowClasses(rank: number) {
  if (rank === 1) return 'bg-gradient-to-r from-amber-500/10 to-amber-600/5 border-amber-500/30 shadow-lg shadow-amber-500/10';
  if (rank === 2) return 'bg-slate-500/5 border-slate-500/20';
  if (rank === 3) return 'bg-orange-500/5 border-orange-500/20';
  return 'bg-card border-border hover:border-primary/30 hover:bg-primary/5';
}

export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
