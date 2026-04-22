/**
 * Inline word-level diff view comparing two text strings.
 * Shows additions in green and deletions in red, similar to a Git diff.
 */

import { diffWords } from 'diff';

interface DiffViewProps {
  oldText: string;
  newText: string;
  compact?: boolean;
}

export function DiffView({ oldText, newText, compact = false }: DiffViewProps) {
  const changes = diffWords(oldText, newText);

  return (
    <div
      className={`font-mono leading-relaxed whitespace-pre-wrap ${
        compact ? 'text-ui-xs' : 'text-ui-base'
      }`}
    >
      {changes.map((part, idx) => {
        if (part.added) {
          return (
            <span
              key={idx}
              className="bg-emerald-500/20 text-emerald-300 rounded-sm px-0.5"
            >
              {part.value}
            </span>
          );
        }
        if (part.removed) {
          return (
            <span
              key={idx}
              className="bg-red-500/20 text-red-400 line-through rounded-sm px-0.5"
            >
              {part.value}
            </span>
          );
        }
        return (
          <span key={idx} className="text-muted-foreground">
            {part.value}
          </span>
        );
      })}
    </div>
  );
}
