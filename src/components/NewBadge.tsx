import { Sparkles } from 'lucide-react';

interface NewBadgeProps {
  /**
   * Visual tone:
   * - 'emerald' (default): emerald accent on transparent/dark surface
   * - 'inverted': white-on-translucent for use over a saturated/selected button
   *               background where emerald-on-emerald would have low contrast
   */
  tone?: 'emerald' | 'inverted';
  /**
   * When false, the badge renders the same chip but without the glow pulse
   * and shimmer sweep. Use `false` once the user has acknowledged the cue
   * so the chip stays as a quiet label instead of continuously demanding
   * attention. Default: true.
   */
  animated?: boolean;
  /** Extra classes appended to the chip */
  className?: string;
  /** Hide the leading sparkle icon (for very tight rows) */
  iconOff?: boolean;
}

/**
 * Animated "New" chip — emerald glow pulse + diagonal shimmer sweep when
 * `animated` is true; static chip with the same dimensions otherwise.
 * Honors prefers-reduced-motion (falls back to a quiet outline).
 *
 * Animations are CSS-driven (see .animate-new-badge in src/index.css) so
 * multiple instances stay in lock-step without framer-motion overhead.
 */
export function NewBadge({
  tone = 'emerald',
  animated = true,
  className = '',
  iconOff = false,
}: NewBadgeProps) {
  const toneClass =
    tone === 'inverted'
      ? 'bg-white/25 text-primary-foreground border border-white/30'
      : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40';

  const animClass = animated ? 'animate-new-badge' : '';

  return (
    <span
      aria-label="New"
      className={`${animClass} inline-flex items-center gap-1 text-[10px] uppercase tracking-wide leading-none px-1.5 py-0.5 rounded-full font-semibold ${toneClass} ${className}`}
    >
      {!iconOff && <Sparkles className="w-2.5 h-2.5" aria-hidden="true" />}
      <span>New</span>
    </span>
  );
}
