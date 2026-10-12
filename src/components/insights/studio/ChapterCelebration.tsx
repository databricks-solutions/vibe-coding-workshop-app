import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { ART } from '../../ideate/art';
import { CHAPTERS, type ChapterId } from '../journey';
import { PrimaryButton } from '../ui';

const CONFETTI_COLORS = ['bg-primary', 'bg-emerald-400', 'bg-amber-400', 'bg-sky-400', 'bg-pink-400'];

/** Deterministic 0..1 scatter so renders stay pure. */
const scatter = (i: number, salt: number) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

function Confetti() {
  const reduce = useReducedMotion();
  const pieces = useMemo(
    () => Array.from({ length: 28 }, (_, i) => ({
      left: scatter(i, 1) * 100,
      delay: scatter(i, 2) * 0.4,
      duration: 1.6 + scatter(i, 3) * 1.2,
      rotate: scatter(i, 4) * 360,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      round: i % 3 === 0,
    })),
    [],
  );
  if (reduce) return null;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className={`absolute top-0 ${p.round ? 'w-2 h-2 rounded-full' : 'w-1.5 h-3 rounded-sm'} ${p.color}`}
          style={{ left: `${p.left}%` }}
          initial={{ y: -20, opacity: 1, rotate: 0 }}
          animate={{ y: 420, opacity: 0, rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}

export function ChapterCelebration({ chapterId, onClose }: { chapterId: ChapterId; onClose: () => void }) {
  const idx = CHAPTERS.findIndex(c => c.id === chapterId);
  const chapter = CHAPTERS[idx];
  const next = CHAPTERS[idx + 1];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${chapter.title} complete`}
    >
      <motion.div
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
        initial={{ scale: 0.92, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        onClick={e => e.stopPropagation()}
      >
        <Confetti />
        <img src={ART.celebrate} alt="" width={448} height={240} className="w-full h-44 object-cover" />
        <div className="p-6 sm:p-7 space-y-4 text-center">
          <p className="text-ui-sm font-semibold uppercase tracking-[0.14em] text-primary">Chapter {idx + 1} complete</p>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">{chapter.celebration}</h2>
          {next && (
            <p className="text-ui-md text-muted-foreground">
              Next up, <span className="font-medium text-foreground">{next.title}</span>: {next.promise.charAt(0).toLowerCase() + next.promise.slice(1)}.
            </p>
          )}
          <PrimaryButton size="lg" onClick={onClose} autoFocus className="w-full">
            {next ? 'Keep going' : 'See what you built'} <ArrowRight className="w-4 h-4" />
          </PrimaryButton>
        </div>
      </motion.div>
    </motion.div>
  );
}
