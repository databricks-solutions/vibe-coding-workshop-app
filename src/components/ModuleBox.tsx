/**
 * Shared workshop "module" primitives.
 *
 * These are the ONE definition of the module box and the chip that both the
 * persona chapter columns and the Genie Accelerator path render from, so the
 * common modules (Lakehouse, AI and Agents) are identical by construction and
 * can never drift again. Colours/labels come from the CHAPTER_BLOCKS registry.
 *
 *   ModuleBox  = card chrome + header + (optional) tinted inner container that
 *                wraps a name-button + a chip row.
 *   ModuleChip = the icon-on-top pill. Interactive (an on/off toggle button)
 *                when given onClick; otherwise a static display pill.
 */

import { motion, type Transition } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ChipTone } from '../constants/chapterBlocks';

// Shared pill geometry + the muted (off) look, so every chip is byte-identical.
const CHIP_BASE =
  'group flex flex-col items-center justify-center gap-0.5 rounded-md border px-1 py-1.5 transition-colors duration-150';
const CHIP_OFF =
  'bg-secondary/40 border-border/40 text-muted-foreground hover:bg-secondary/70 hover:border-border/70 hover:text-foreground';

function chipClass(on: boolean, tone: ChipTone, extra?: string): string {
  return `${CHIP_BASE} ${on ? `${tone.box} text-foreground shadow-sm` : CHIP_OFF}${extra ? ` ${extra}` : ''}`;
}

interface ModuleChipProps {
  label: string;
  icon: LucideIcon;
  tone: ChipTone;
  /** Active (coloured) vs muted. Display chips are always on (default true). */
  on?: boolean;
  /** When provided, the chip becomes an interactive on/off toggle button. */
  onClick?: () => void;
  title?: string;
  disabled?: boolean;
  /** Drives the horizontal shake used when a toggle is blocked. */
  shaking?: boolean;
  /** Extra classes appended to the pill (e.g. hover:scale-105 for display chips). */
  className?: string;
}

export function ModuleChip({
  label,
  icon: Icon,
  tone,
  on = true,
  onClick,
  title,
  disabled,
  shaking,
  className,
}: ModuleChipProps) {
  const inner = (
    <>
      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${on ? tone.icon : ''}`} />
      <span className="text-ui-3xs font-medium leading-tight text-center">{label}</span>
    </>
  );

  if (onClick) {
    return (
      <motion.button
        type="button"
        layout
        onClick={onClick}
        disabled={disabled}
        whileTap={{ scale: 0.94 }}
        animate={shaking ? { x: [0, -2, 2, -2, 2, 0] } : { x: 0 }}
        transition={{ duration: 0.32 }}
        title={title}
        className={chipClass(on, tone, className)}
      >
        {inner}
      </motion.button>
    );
  }

  return (
    <div className={chipClass(on, tone, className)} title={title}>
      {inner}
    </div>
  );
}

interface ModuleBoxProps {
  /** framer layout identity, kept stable across reorders (reverse direction). */
  layoutId?: string;
  /** Outer card chrome (persona passes getBoxClass(...); Genie passes resting). */
  cardClassName: string;
  transition?: Transition;
  /** Uppercase header node (persona columnHeader, or the Genie stage title). */
  header: ReactNode;
  /** Tinted inner container classes. When omitted, the button + chips render
   *  without the tinted wrapper (persona plain-button case). */
  accentContainer?: string;
  /** The full-width name-button (interactive in persona, static in Genie). */
  button?: ReactNode;
  /** The chip row (interactive selector in persona, display chips in Genie). */
  children?: ReactNode;
}

export function ModuleBox({
  layoutId,
  cardClassName,
  transition,
  header,
  accentContainer,
  button,
  children,
}: ModuleBoxProps) {
  const body = accentContainer ? (
    <div className={`rounded-lg border ${accentContainer} p-1.5 space-y-1.5`}>
      {button}
      {children}
    </div>
  ) : (
    <>
      {button}
      {children}
    </>
  );

  return (
    <motion.div
      layout
      layoutId={layoutId}
      className={cardClassName}
      transition={transition ?? { type: 'spring', stiffness: 250, damping: 22, mass: 0.9 }}
    >
      {header}
      <div className="space-y-2">{body}</div>
    </motion.div>
  );
}
