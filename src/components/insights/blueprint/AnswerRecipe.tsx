import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, CalendarClock, CircleDashed, Pin, Shuffle, Table2 } from 'lucide-react';
import type { Recipe } from './match';
import { recipeFor } from './match';
import type { BlueprintDigest, BlueprintKpi } from './types';

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Illustrative shape of the answer, never real numbers. */
export function GhostChart({ seed, kind }: { seed: string; kind: 'time' | 'flag' | 'category' }) {
  const values = useMemo(() => {
    let h = hash(seed);
    const next = () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; return (h % 1000) / 1000; };
    if (kind === 'time') {
      let v = 0.45 + next() * 0.2;
      return Array.from({ length: 12 }, () => (v = Math.max(0.12, Math.min(0.95, v + (next() - 0.45) * 0.22))));
    }
    if (kind === 'flag') return [0.55 + next() * 0.35, 0.15 + next() * 0.3];
    return Array.from({ length: 6 }, () => 0.2 + next() * 0.75).sort((a, b) => b - a);
  }, [seed, kind]);

  const w = 168, h = 64;
  if (kind === 'time') {
    const step = w / (values.length - 1);
    const d = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - v * h).toFixed(1)}`).join(' ');
    return (
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-hidden>
        <motion.path d={`${d} L${w},${h} L0,${h} Z`} className="fill-primary/10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />
        <motion.path d={d} fill="none" className="stroke-primary" strokeWidth={2} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9 }} />
      </svg>
    );
  }
  const bw = w / values.length;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      {values.map((v, i) => (
        <motion.rect
          key={i}
          x={i * bw + bw * 0.18}
          width={bw * 0.64}
          rx={3}
          className={i === 0 ? 'fill-primary' : 'fill-primary/35'}
          initial={{ height: 0, y: h }}
          animate={{ height: v * h, y: h - v * h }}
          transition={{ duration: 0.6, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
    </svg>
  );
}

const CONFIDENCE = {
  strong: { label: 'Answerable', className: 'bg-emerald-500/10 text-emerald-500', note: 'A ready-made KPI in the model answers this directly.' },
  partial: { label: 'Close match', className: 'bg-amber-500/10 text-amber-500', note: 'The model has related numbers. Genie Code will confirm the exact definition with you.' },
  none: { label: 'Not covered yet', className: 'bg-secondary text-muted-foreground', note: 'Nothing in this model fits. Genie Code can add it later, or try another area.' },
} as const;

interface AnswerRecipeProps {
  index: number;
  recipe: Recipe;
  digest: BlueprintDigest;
  pinned: boolean;
  onTogglePin: (kpiId: string) => void;
  onShowArea: (area: string) => void;
}

export function AnswerRecipe({ index, recipe: initial, digest, pinned, onTogglePin, onShowArea }: AnswerRecipeProps) {
  const [altIdx, setAltIdx] = useState(-1);
  const recipe = altIdx < 0 ? initial : recipeFor(initial.alternatives[altIdx], initial.question);
  const conf = CONFIDENCE[altIdx < 0 ? recipe.confidence : 'partial'];
  const kpi = recipe.kpi as BlueprintKpi | null;
  const table = kpi ? digest.tables.find(t => t.id === kpi.table) : null;
  const area = kpi ? digest.areas.find(a => a.name === kpi.area) : null;
  const joins = table?.linksTo.slice(0, 2) ?? [];
  const tableLabel = (id: string) => digest.tables.find(t => t.id === id)?.label ?? id.split('.').pop();

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="rounded-2xl border border-border bg-card overflow-hidden"
    >
      <div className="flex items-start gap-3 px-5 pt-4">
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-ui-sm font-semibold shrink-0">{index + 1}</span>
        <p className="flex-1 text-ui-md font-medium text-foreground leading-snug pt-0.5">{recipe.question}</p>
        <span title={conf.note} className={`shrink-0 px-2 py-0.5 rounded-full text-ui-xs font-semibold ${conf.className}`}>{conf.label}</span>
      </div>

      {kpi && recipe.measure ? (
        <div className="grid sm:grid-cols-[1fr_auto] gap-4 px-5 py-4">
          <div className="space-y-3 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-ui-sm">
              <span className="text-muted-foreground">Measure</span>
              <span className="px-2 py-0.5 rounded-lg bg-primary/10 text-primary font-semibold">{recipe.measure.label}</span>
              {recipe.slice && <>
                <span className="text-muted-foreground">by</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-secondary text-foreground font-medium">
                  {recipe.slice.kind === 'time' && <CalendarClock className="w-3 h-3 text-muted-foreground" />}
                  {recipe.slice.label}
                </span>
              </>}
            </div>
            {recipe.measure.comment && <p className="text-ui-sm text-muted-foreground leading-relaxed line-clamp-2">{recipe.measure.comment}</p>}
            <div className="flex flex-wrap items-center gap-1.5 text-ui-xs text-muted-foreground">
              <Table2 className="w-3.5 h-3.5" />
              <span className="font-medium text-foreground/85">{table?.label ?? kpi.table}</span>
              {joins.map(j => (
                <span key={j.to} className="inline-flex items-center gap-1.5" title={j.reason}>
                  <span className="w-3 h-px bg-border" />{tableLabel(j.to)}
                </span>
              ))}
              {area && (
                <button onClick={() => onShowArea(area.name)} className="ml-1 px-1.5 rounded bg-secondary/70 hover:bg-secondary text-foreground/80">
                  in {area.label}
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <GhostChart seed={`${kpi.id}:${recipe.measure.name}:${recipe.slice?.name}`} kind={recipe.slice?.kind ?? 'category'} />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Example shape</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-5 py-4 text-ui-sm text-muted-foreground">
          <CircleDashed className="w-4 h-4 shrink-0" /> {conf.note}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-t border-border/70 bg-secondary/20">
        {kpi && (
          <button
            onClick={() => onTogglePin(kpi.id)}
            className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-ui-xs font-medium transition-colors ${pinned ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'}`}
          >
            <Pin className={`w-3.5 h-3.5 ${pinned ? 'fill-current' : ''}`} /> {pinned ? 'In your KPIs' : 'Add to your KPIs'}
          </button>
        )}
        {initial.alternatives.length > 0 && (
          <button
            onClick={() => setAltIdx(i => (i + 1 >= initial.alternatives.length ? -1 : i + 1))}
            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-ui-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            <Shuffle className="w-3.5 h-3.5" /> {altIdx === initial.alternatives.length - 1 ? 'Back to best match' : 'Try another KPI'}
          </button>
        )}
        {kpi && (
          <a href={kpi.sourceUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 h-8 px-2.5 rounded-lg text-ui-xs text-muted-foreground hover:text-primary">
            View KPI source <ArrowUpRight className="w-3 h-3" />
          </a>
        )}
      </div>
    </motion.article>
  );
}
