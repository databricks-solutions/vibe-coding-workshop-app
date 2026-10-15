import { useState } from 'react';
import { Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import type { Movement } from './ranking';

function ConfettiParticle({ delay, color, left, rotate }: { delay: number; color: string; left: number; rotate: number }) {
  return (
    <div
      className="absolute w-2 h-2 rounded-sm animate-confetti-fall"
      style={{
        backgroundColor: color,
        left: `${left}%`,
        animationDelay: `${delay}ms`,
        transform: `rotate(${rotate}deg)`,
      }}
    />
  );
}

/** The confetti that falls over the #1 row. */
export function RowConfetti() {
  const colors = ['#FFD700', '#FFA500', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
  const [particles] = useState(() => Array.from({ length: 30 }, (_, i) => ({
    id: i,
    delay: Math.random() * 1000,
    color: colors[Math.floor(Math.random() * colors.length)],
    left: Math.random() * 100,
    rotate: Math.random() * 360,
  })));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <ConfettiParticle key={p.id} delay={p.delay} color={p.color} left={p.left} rotate={p.rotate} />
      ))}
    </div>
  );
}

export function MovementIndicator({ movement, rankChange }: { movement: Movement; rankChange?: number }) {
  if (movement === 'same') return null;

  return (
    <div className={`absolute -right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 
      ${movement === 'up' ? 'text-emerald-400 animate-rank-up' : ''}
      ${movement === 'down' ? 'text-red-400 animate-rank-down' : ''}
      ${movement === 'new' ? 'text-amber-400 animate-new-entry' : ''}
    `}>
      {movement === 'up' && (
        <>
          <TrendingUp className="w-4 h-4" />
          {rankChange && rankChange > 1 && (
            <span className="text-ui-2xs font-bold">+{rankChange}</span>
          )}
        </>
      )}
      {movement === 'down' && (
        <>
          <TrendingDown className="w-4 h-4" />
          {rankChange && rankChange > 1 && (
            <span className="text-ui-2xs font-bold">-{rankChange}</span>
          )}
        </>
      )}
      {movement === 'new' && <Sparkles className="w-4 h-4" />}
    </div>
  );
}

export function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30 animate-crown-glow">
        <span className="text-lg">🥇</span>
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-slate-300 to-slate-500 flex items-center justify-center shadow-lg shadow-slate-400/30">
        <span className="text-lg">🥈</span>
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
        <span className="text-lg">🥉</span>
      </div>
    );
  }
  return (
    <div className="w-10 h-10 shrink-0 rounded-xl bg-secondary flex items-center justify-center">
      <span className="text-lg font-bold text-muted-foreground">{rank}</span>
    </div>
  );
}
