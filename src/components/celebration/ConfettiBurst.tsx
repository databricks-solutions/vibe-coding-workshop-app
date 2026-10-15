import { useState } from 'react';

const COLORS = [
  '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE',
];

type Size = 'small' | 'normal' | 'large';
const SIZE_CLASSES: Record<Size, string> = { small: 'w-1.5 h-1.5', normal: 'w-2.5 h-2.5', large: 'w-3 h-3' };

/** Celebration confetti shared by the workshop and idea flows. */
export function ConfettiBurst({
  count = 40,
  centerX = 50,
  centerY = 40,
  spread = 30,
}: {
  count?: number;
  centerX?: number;
  centerY?: number;
  spread?: number;
}) {
  const [particles] = useState(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    delay: Math.random() * 300,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: (Math.random() > 0.7 ? 'large' : Math.random() > 0.4 ? 'normal' : 'small') as Size,
    startX: centerX + (Math.random() - 0.5) * spread,
    startY: centerY + (Math.random() - 0.5) * spread * 0.5,
    rotate: Math.random() * 360,
  })));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none motion-reduce:hidden">
      {particles.map(p => (
        <div
          key={p.id}
          className={`absolute ${SIZE_CLASSES[p.size]} rounded-sm animate-celebration-confetti`}
          style={{
            backgroundColor: p.color,
            left: `${p.startX}%`,
            top: `${p.startY}%`,
            animationDelay: `${p.delay}ms`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}
