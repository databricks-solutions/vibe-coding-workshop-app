import { AnimatePresence, motion } from 'framer-motion';
import { Blocks, Clock } from 'lucide-react';
import type { WorkshopLevel, WorkflowDirection } from '../constants/workflowSections';
import { PATH_DESCRIPTIONS } from '../constants/pathDescriptions';

const ACCENT_CLASSES: Record<string, { pill: string; dot: string; border: string; bg: string }> = {
  violet: {
    pill: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
    dot: 'bg-violet-400',
    border: 'border-violet-500/30',
    bg: 'bg-violet-500/[0.04]',
  },
  emerald: {
    pill: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    dot: 'bg-emerald-400',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/[0.04]',
  },
  amber: {
    pill: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    dot: 'bg-amber-400',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/[0.04]',
  },
  primary: {
    pill: 'bg-primary/15 text-primary border-primary/25',
    dot: 'bg-primary',
    border: 'border-primary/30',
    bg: 'bg-primary/[0.04]',
  },
};

interface PathDescriptionPanelProps {
  selectedLevel: WorkshopLevel;
  direction?: WorkflowDirection;
}

export function PathDescriptionPanel({ selectedLevel }: PathDescriptionPanelProps) {
  const desc = PATH_DESCRIPTIONS[selectedLevel];
  if (!desc) return null;

  const accent = ACCENT_CLASSES[desc.accentColor] ?? ACCENT_CLASSES.primary;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={selectedLevel}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className={`rounded-lg border ${accent.border} ${accent.bg} px-5 py-4`}
      >
        {/* Header row */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Blocks className="w-4 h-4 text-muted-foreground" />
            <span className="text-ui-sm font-semibold text-foreground">What You'll Build</span>
          </div>
          <div className="flex items-center gap-1.5 text-ui-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>~{desc.estimatedMinutes} min</span>
          </div>
        </div>

        {/* Tagline */}
        <p className="text-ui-base text-muted-foreground italic mb-3">{desc.tagline}</p>

        {/* Tech stack pills */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {desc.techStack.map((tech) => (
            <span
              key={tech}
              className={`text-ui-3xs font-medium px-2 py-0.5 rounded-full border ${accent.pill}`}
            >
              {tech}
            </span>
          ))}
        </div>

        {/* Bullet list */}
        <ul className="space-y-1.5">
          {desc.bullets.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2 text-ui-sm text-foreground/90">
              <span className={`mt-[7px] w-1.5 h-1.5 rounded-full flex-shrink-0 ${accent.dot}`} />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </motion.div>
    </AnimatePresence>
  );
}
