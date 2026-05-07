/**
 * PathDurationBar
 *
 * Animated, persona-toned "Estimated Build Time" bar for the Workshop Path &
 * Architecture card. Two variants:
 *
 *   - 'full'    : header (label + classification badge + "all chapters" chip),
 *                 large H:MM total + path summary, tick row 0/2/4/6h, segmented
 *                 stacked bar with hover popovers, compact legend.
 *   - 'compact' : 72 px miniature segmented bar + label + total, used inside
 *                 the collapsed Path & Architecture header.
 *
 * Segments are colored by persona bucket (Apps and Lakebase = amber,
 * Lakehouse = teal, AI and Agents = cyan, Activation = emerald, foundation +
 * tail = slate) so the bar visually rhymes with the COLUMN_PERSONAS caption
 * row immediately below it in LevelSelector.tsx.
 */

import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Clock, Layers } from 'lucide-react';
import {
  computeBuildTime,
  formatHM,
  formatLabelDuration,
  BUCKET_PALETTE,
  BUCKET_PERSONA_HINT,
  CLASSIFICATION_LABEL,
  CLASSIFICATION_TONE,
  type PersonaBucket,
  type ComputedBucket,
} from '../constants/pathDurations';
import { WORKFLOW_SECTIONS, type WorkshopLevel, type WorkflowDirection, type AIAgentModule, type MedallionLayer, type ChainContext } from '../constants/workflowSections';
import { BUTTON_LABELS } from './LevelSelector';

interface PathDurationBarProps {
  level: WorkshopLevel;
  direction: WorkflowDirection;
  aiModules: Set<AIAgentModule>;
  medallionLayers: Set<MedallionLayer>;
  completedSteps: Set<number>;
  chainContext?: ChainContext;
  variant?: 'full' | 'compact';
}

// Reverse direction renders columns Lakehouse → AI and Agents → Apps and
// Lakebase. The bar follows the same reordering so segments visually align
// with the workflow execution order.
const REVERSE_BUCKET_ORDER: PersonaBucket[] = [
  'foundation',
  'lakehouse',
  'ai-agents',
  'activation',
  'apps-lakebase',
  'tail',
];

export function PathDurationBar(props: PathDurationBarProps) {
  const { variant = 'full' } = props;
  return variant === 'compact' ? <CompactBar {...props} /> : <FullBar {...props} />;
}

// ---------------------------------------------------------------------------
// Full variant
// ---------------------------------------------------------------------------

function FullBar({
  level,
  direction,
  aiModules,
  medallionLayers,
  completedSteps,
  chainContext,
}: PathDurationBarProps) {
  const reduceMotion = useReducedMotion();
  const result = computeBuildTime({ level, direction, aiModules, medallionLayers, completedSteps, chainContext });
  const { total, classification, scaleMaxMinutes, ticks, isEverythingSelected } = result;

  const orderedBuckets = orderBuckets(result.buckets, direction);
  const fillPercent = Math.min(100, (total / scaleMaxMinutes) * 100);
  const tone = CLASSIFICATION_TONE[classification];

  const summary = buildPathSummary(level, direction, isEverythingSelected);

  return (
    <div
      className="rounded-lg border border-border/60 bg-secondary/20 backdrop-blur-sm px-4 pt-3 pb-3.5"
      role="group"
      aria-label="Estimated workshop build time"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-ui-2xs uppercase tracking-[0.14em] font-semibold text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>Estimated Build Time</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isEverythingSelected && (
            <span className="inline-flex items-center gap-1 text-ui-3xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 border border-primary/30 text-primary">
              <Layers className="w-2.5 h-2.5" />
              All chapters
            </span>
          )}
          <span className={`text-ui-3xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${tone.bg} ${tone.border} ${tone.text}`}>
            {CLASSIFICATION_LABEL[classification]}
          </span>
        </div>
      </div>

      {/* Total + path summary */}
      <div className="flex items-baseline gap-3 mb-3">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={`t-${total}`}
            initial={reduceMotion ? false : { y: 6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduceMotion ? undefined : { y: -6, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="text-ui-3xl font-semibold text-foreground leading-none [font-variant-numeric:tabular-nums]"
            aria-live="polite"
          >
            {formatHM(total)}
          </motion.span>
        </AnimatePresence>
        <AnimatePresence mode="popLayout">
          <motion.span
            key={`s-${summary}`}
            initial={reduceMotion ? false : { y: 6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduceMotion ? undefined : { y: -6, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="text-ui-sm text-muted-foreground truncate"
          >
            {summary}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Tick row + bar track */}
      <div className="relative">
        <TickRow ticks={ticks} scaleMax={scaleMaxMinutes} />
        <div className="relative h-2.5 rounded-full bg-secondary/50 overflow-hidden ring-1 ring-border/40">
          <motion.div
            className="absolute inset-y-0 left-0 flex"
            style={{ width: `${fillPercent}%` }}
            transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 240, damping: 28, mass: 0.9 }}
            animate={{ width: `${fillPercent}%` }}
          >
            <AnimatePresence initial={false}>
              {orderedBuckets.map((b, i) => {
                const palette = BUCKET_PALETTE[b.id];
                const flexBasis = total > 0 ? (b.minutes / total) * 100 : 0;
                return (
                  <motion.div
                    key={b.id}
                    layout
                    initial={reduceMotion ? false : { opacity: 0, scaleX: 0.6 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    exit={reduceMotion ? undefined : { opacity: 0, scaleX: 0.6 }}
                    transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 240, damping: 28, mass: 0.9 }}
                    style={{ flexGrow: flexBasis, flexBasis: 0, transformOrigin: 'left center' }}
                    className={`relative h-full ${palette.fillClass} group`}
                  >
                    {/* Segment hover overlay */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 bg-foreground/10 pointer-events-none" />

                    {/* Inter-segment hairline gap (skip on the first child) */}
                    {i > 0 && (
                      <div className="absolute left-0 inset-y-0 w-px bg-card" aria-hidden="true" />
                    )}

                    {/* Hover popover */}
                    <SegmentPopover bucket={b} />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-ui-3xs text-muted-foreground [font-variant-numeric:tabular-nums]">
        {orderedBuckets.map(b => {
          const palette = BUCKET_PALETTE[b.id];
          return (
            <span key={b.id} className="inline-flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${palette.dotClass}`} />
              <span className="font-medium text-foreground/80">{palette.label}</span>
              <span>{formatLabelDuration(b.minutes)}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact variant — drops into the collapsed Path & Architecture header
// ---------------------------------------------------------------------------

function CompactBar({
  level,
  direction,
  aiModules,
  medallionLayers,
  completedSteps,
  chainContext,
}: PathDurationBarProps) {
  const reduceMotion = useReducedMotion();
  const result = computeBuildTime({ level, direction, aiModules, medallionLayers, completedSteps, chainContext });
  const orderedBuckets = orderBuckets(result.buckets, direction);
  const fillPercent = Math.min(100, (result.total / result.scaleMaxMinutes) * 100);

  const labelText = result.isEverythingSelected
    ? 'All chapters'
    : (BUTTON_LABELS[level] ?? 'Workshop');

  return (
    <span
      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/8 border border-primary/20"
      title={`${labelText} · ${formatLabelDuration(result.total)}`}
      aria-label={`${labelText}, estimated ${formatLabelDuration(result.total)}`}
    >
      <span className="relative h-1.5 w-[68px] rounded-full bg-secondary/50 overflow-hidden ring-1 ring-border/40 flex-shrink-0">
        <motion.span
          className="absolute inset-y-0 left-0 flex"
          style={{ width: `${fillPercent}%` }}
          animate={{ width: `${fillPercent}%` }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 240, damping: 28, mass: 0.9 }}
        >
          {orderedBuckets.map((b, i) => {
            const palette = BUCKET_PALETTE[b.id];
            const flexGrow = result.total > 0 ? (b.minutes / result.total) * 100 : 0;
            return (
              <motion.span
                key={b.id}
                layout
                style={{ flexGrow, flexBasis: 0 }}
                className={`relative h-full ${palette.fillClass}`}
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 240, damping: 28, mass: 0.9 }}
              >
                {i > 0 && <span className="absolute left-0 inset-y-0 w-px bg-card" aria-hidden="true" />}
              </motion.span>
            );
          })}
        </motion.span>
      </span>
      <span className="text-ui-xs font-medium text-primary [font-variant-numeric:tabular-nums]">
        <span className="text-primary/80">{labelText}</span>
        <span className="text-primary/50 mx-1">·</span>
        <span>{formatHM(result.total)}</span>
      </span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function TickRow({ ticks, scaleMax }: { ticks: readonly number[]; scaleMax: number }) {
  return (
    <div className="relative h-3 mb-1" aria-hidden="true">
      {ticks.map(h => {
        const pct = Math.min(100, (h * 60 / scaleMax) * 100);
        const align = pct === 0 ? 'left-0' : pct === 100 ? 'right-0' : '';
        return (
          <div
            key={h}
            className={`absolute top-0 flex flex-col items-${pct === 0 ? 'start' : pct === 100 ? 'end' : 'center'} ${align}`}
            style={pct === 0 || pct === 100 ? undefined : { left: `${pct}%`, transform: 'translateX(-50%)' }}
          >
            <span className="text-ui-3xs text-muted-foreground/80 font-medium [font-variant-numeric:tabular-nums]">{h}h</span>
            <span className="w-px h-1.5 bg-border/60 mt-0.5" />
          </div>
        );
      })}
    </div>
  );
}

function SegmentPopover({ bucket }: { bucket: ComputedBucket }) {
  const palette = BUCKET_PALETTE[bucket.id];
  const personaHint = BUCKET_PERSONA_HINT[bucket.id];

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-30
                 opacity-0 scale-95 translate-y-1 group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-0
                 transition-all duration-150 ease-out pointer-events-none"
    >
      <div className="w-2.5 h-2.5 rotate-45 bg-popover border-r border-b border-border/50 absolute -bottom-[5px] left-1/2 -translate-x-1/2 z-10" />
      <div className="relative bg-popover/95 backdrop-blur-md border border-border/50 shadow-xl rounded-lg px-3 py-2 min-w-[180px]">
        <div className="flex items-center gap-2 mb-1">
          <span className={`w-2 h-2 rounded-full ${palette.dotClass}`} />
          <span className="text-ui-sm font-semibold text-foreground">{palette.label}</span>
          <span className="ml-auto text-ui-xs font-medium text-muted-foreground [font-variant-numeric:tabular-nums]">
            {formatLabelDuration(bucket.minutes)}
          </span>
        </div>
        {personaHint && (
          <p className="text-ui-3xs uppercase tracking-wider text-muted-foreground/80 mb-1.5">{personaHint}</p>
        )}
        <ul className="space-y-0.5">
          {bucket.sub.map(s => {
            const section = WORKFLOW_SECTIONS.find(ws => ws.id === s.segment);
            const dotColor = section?.color?.replace('text-', 'bg-') ?? 'bg-foreground/40';
            return (
              <li key={s.segment} className="flex items-center gap-1.5 text-ui-xs">
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor} opacity-90`} />
                <span className="text-foreground/85 truncate">{section?.title ?? s.segment}</span>
                <span className="ml-auto text-muted-foreground [font-variant-numeric:tabular-nums]">
                  {formatLabelDuration(s.minutes)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function orderBuckets(buckets: ComputedBucket[], direction: WorkflowDirection): ComputedBucket[] {
  if (direction !== 'reverse') return buckets;
  // Forward order is canonical (foundation, apps, lakehouse, ai, activation, tail).
  // Reverse: foundation → lakehouse → ai → activation → apps → tail.
  const indexOf = (id: PersonaBucket) => REVERSE_BUCKET_ORDER.indexOf(id);
  return [...buckets].sort((a, b) => indexOf(a.id) - indexOf(b.id));
}

function buildPathSummary(level: WorkshopLevel, direction: WorkflowDirection, isEverythingSelected: boolean): string {
  const dirText = direction === 'reverse' ? 'Reverse ETL' : 'Forward';
  if (isEverythingSelected) {
    return `${dirText} · everything selected`;
  }
  const label = BUTTON_LABELS[level] ?? 'Workshop';
  // Add a friendly contextual phrase per level family.
  if (level === 'app-only' || level === 'app-database') return `${dirText} · ${label}`;
  if (level.startsWith('reverse-')) return `${dirText} · ${label}`;
  if (level.endsWith('-accelerator') || level === 'accelerator') return `${dirText} · ${label}`;
  return `${dirText} · ${label}`;
}
