import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, BadgeCheck, Check, CircleDashed, Gauge, Loader2, Map as MapIcon, MessageCircleQuestion, Network, OctagonAlert, RefreshCw, RotateCcw, ShieldCheck, Sparkles, Table2, TriangleAlert,
} from 'lucide-react';
import { FadeIn, GhostButton, PrimaryButton, SecondaryButton } from '../../journeykit';
import { AnswerRecipe } from './AnswerRecipe';
import { AreaXray } from './AreaXray';
import { useFitWith, type FitFetcher } from './blueprintApi';
import { DataMap } from './DataMap';
import { ErDiagram } from './ErDiagram';
import { KpiLibrary } from './KpiLibrary';
import { matchQuestion, rankAreas, recipeFor, type AreaPick, type Recipe } from './match';
import { matchLevel } from './matchLevel';
import { MiniConstellation } from './MiniConstellation';
import { TableCatalog } from './TableCatalog';
import type { BlueprintDigest, BlueprintFit } from './types';

const FOCUS_SOFT_CAP = 30;

const FALLBACK_WHY: Record<NonNullable<BlueprintFit['reason']>, string> = {
  pending: '',
  timeout: 'The AI review took too long. ',
  unavailable: 'The AI review was unavailable. ',
  invalid: 'The AI review gave an answer that could not be used. ',
};

type Lens = 'answers' | 'map' | 'diagram' | 'metrics' | 'tables';

const LENSES: { id: Lens; label: string; icon: typeof MapIcon }[] = [
  { id: 'answers', label: 'Your answers', icon: MessageCircleQuestion },
  { id: 'map', label: 'The map', icon: MapIcon },
  { id: 'diagram', label: 'Diagram', icon: Network },
  { id: 'metrics', label: 'KPIs', icon: Gauge },
  { id: 'tables', label: 'Tables', icon: Table2 },
];

/** Wording that differs between an industry model and the team's own tables. */
export interface ExplorerCopy {
  /** e.g. "the Retail model" or "Wanderbricks". */
  noun: string;
  /** Shown after the reason when the fit has no AI review, e.g. "This is a table-level match on …". */
  fallback: string;
  answersIntro: string;
  uncovered: (uncovered: number, total: number) => { title: string; body: string };
  diagramNote: ReactNode;
  /** e.g. "in this model". */
  inSource: string;
  gapNote: string;
  trustNote: string;
  finishLabel: string;
  /** What to try instead when very few questions are answered. */
  lowMatchTips: string[];
}

export interface ExplorerPick {
  focus: string[];
  pinned: string[];
  fit: BlueprintFit | null;
  fitFailed: boolean;
  recipes: Recipe[];
  /** Questions answered by a KPI or, for approved data, by tables. */
  answered: number;
  focusTables: number;
  /** The participant continued past a very low match. */
  lowMatch: boolean;
}

export interface MatchSummary {
  answered: number;
  total: number;
  level: ReturnType<typeof matchLevel>;
  fit: BlueprintFit['fit'] | null;
  /** The AI review is still running. */
  refining: boolean;
}

interface ModelExplorerProps {
  digest: BlueprintDigest;
  questions: string[];
  /** The idea in plain text, for matching it to areas and tables. */
  context: string;
  /** Earlier picks for this same digest; they skip the matching wait. */
  initial: { areas: string[]; kpis: string[] } | null;
  fitFetcher: FitFetcher;
  copy: ExplorerCopy;
  /** Left of the finish button: install progress, or where the tables live. */
  footerStatus: ReactNode;
  sourceFooter?: ReactNode;
  /** Shown under the match banners once matching settles, e.g. what the scan left out. */
  notice?: (m: MatchSummary) => ReactNode;
  onFinish: (pick: ExplorerPick) => void;
  /** Back to the data step, offered when the match is very low. */
  onBack: () => void;
}

export function LoadingState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 18, ease: 'linear' }}>
        <MiniConstellation nodes={11} size={144} />
      </motion.div>
      <p className="text-ui-md text-foreground font-medium">{title}</p>
      <p className="text-ui-sm text-muted-foreground max-w-sm">{body}</p>
    </div>
  );
}

/** Holds back every provisional result until the first AI fit is complete. */
function MatchingState({ noun, questions }: { noun: string; questions: number }) {
  return (
    <div className="min-h-[28rem] flex flex-col items-center justify-center gap-5 rounded-3xl border border-border bg-card/60 px-6 py-16 text-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 18, ease: 'linear' }}
        className="relative"
      >
        <MiniConstellation nodes={13} size={168} />
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-9 h-9 text-primary animate-spin" />
        </span>
      </motion.div>
      <div className="space-y-2">
        <p className="text-ui-xl font-semibold text-foreground">Matching your questions to {noun}</p>
        <p className="text-ui-sm text-muted-foreground">
          Reading business areas, table relationships and ready-made KPIs.
        </p>
      </div>
      <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/[0.05] px-3 py-1.5 text-ui-xs font-medium text-primary">
        <Sparkles className="w-3.5 h-3.5" />
        Matching {questions} question{questions === 1 ? '' : 's'}
      </span>
    </div>
  );
}

export function ErrorState({ message, onRetry, onBack }: { message: string; onRetry: () => void; onBack: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-4">
      <p className="text-ui-lg font-semibold text-foreground">{message}</p>
      <p className="text-ui-sm text-muted-foreground">You can try again, or go back and pick another way to bring in data.</p>
      <div className="flex justify-center gap-2">
        <SecondaryButton onClick={onRetry}><RefreshCw className="w-4 h-4" /> Try again</SecondaryButton>
        <GhostButton onClick={onBack}>Choose another option</GhostButton>
      </div>
    </div>
  );
}

/** Eyebrow, title with its picker, the description and the source link. */
export function ExplorerHeader({ eyebrow, title, picker, why, description, pill }: {
  eyebrow: string; title: string; picker?: ReactNode; why?: ReactNode; description: string; pill?: ReactNode;
}) {
  return (
    <FadeIn delay={0.03} className="space-y-3">
      <p className="text-ui-sm font-semibold uppercase tracking-[0.14em] text-primary/90">{eyebrow}</p>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground leading-[1.1]">{title}</h1>
        {picker}
        {why}
      </div>
      <p className="text-ui-lg text-muted-foreground max-w-2xl leading-relaxed">{description}</p>
      {pill}
    </FadeIn>
  );
}

function TrustStrip({ digest, note }: { digest: BlueprintDigest; note: string }) {
  const { stats, trust } = digest;
  const tiles = [
    { v: stats.areas, l: 'business areas' },
    { v: stats.tables, l: 'tables' },
    { v: stats.measures, l: 'ready-made measures' },
    { v: stats.links, l: 'connections' },
  ];
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-border/70">
        {tiles.map(t => (
          <div key={t.l} className="px-4 py-3">
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">{t.v.toLocaleString()}</p>
            <p className="text-ui-xs text-muted-foreground">{t.l}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 border-t border-border/70 bg-secondary/20 text-ui-xs text-muted-foreground">
        {trust.certified && (
          <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Approved source</span>
        )}
        {digest.scope?.certifiedOnly && (
          <span className="inline-flex items-center gap-1"><BadgeCheck className="w-3.5 h-3.5 text-emerald-500" /> Certified tables only</span>
        )}
        {typeof trust.qualityScore === 'number' && (
          <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Model quality {Math.round(trust.qualityScore)}/100</span>
        )}
        {trust.standards.length > 0 && <span>Aligned to {trust.standards.slice(0, 5).join(', ')}</span>}
        {trust.sensitiveFields > 0 && <span>{trust.sensitiveFields} sensitive fields labelled</span>}
        <span className="sm:ml-auto">{note}</span>
      </div>
    </div>
  );
}

type AreaNote = { role: 'core' | 'supporting'; why: string; join?: [string, string] };

/** What a late AI match changed in the quick pick, so it can be explained and undone. */
type FitChange = { removed: { name: string; why: string }[]; added: string[]; prevFocus: string[]; prevNotes: Record<string, AreaNote> };

const notesFromRank = (picks: AreaPick[]): Record<string, AreaNote> =>
  Object.fromEntries(picks.map(p => [p.name, { role: p.role, why: p.words.length ? `Your idea mentions ${p.words.join(', ')}` : 'Connected to your main areas' }]));

const notesFromFit = (fit: BlueprintFit): Record<string, AreaNote> =>
  Object.fromEntries(fit.areas.map(a => [a.name, { role: a.role, why: a.why, join: a.join }]));

/** The match, map, diagram, KPIs and tables of one digest, with the sticky footer. */
export function ModelExplorer({ digest: d, questions, context, initial, fitFetcher, copy, footerStatus, sourceFooter, notice, onFinish, onBack }: ModelExplorerProps) {
  const [lens, setLens] = useState<Lens>('map');
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setConfirming(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirming]);
  const [focus, setFocus] = useState<string[]>([]);
  const [pinned, setPinned] = useState<string[]>([]);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [diagramArea, setDiagramArea] = useState<string | null>(null);
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, AreaNote>>({});
  /** The user changed areas or KPIs by hand, so a late AI match only offers itself. */
  const [edited, setEdited] = useState(false);
  const [fitApplied, setFitApplied] = useState<BlueprintFit | null>(null);
  const [change, setChange] = useState<FitChange | null>(null);

  const wordRecipes = useMemo(() => questions.map(q => matchQuestion(q, d)), [d, questions]);
  const quickPick = useMemo(() => rankAreas(d, [context, ...questions].join('\n'), wordRecipes), [d, context, questions, wordRecipes]);
  const fit = useFitWith(fitFetcher, d.slug, context, questions, quickPick.map(p => p.name));
  const fitData = fit.data && fit.data.slug === d.slug ? fit.data : null;
  // The quick keyword match is only a fallback. On first entry, do not expose it
  // as a result while the deeper fit is still changing areas, KPIs and answers.
  const matching = fit.loading && !fitData && !initial;
  const recipes = useMemo(() => questions.map((q, i) => {
    const r = wordRecipes[i];
    if (r.confidence !== 'none') return r;
    const kpiId = fitData?.questions.find(x => x.index === i)?.kpi;
    const kpi = kpiId ? d.kpis.find(k => k.id === kpiId) : null;
    return kpi ? recipeFor(kpi, q) : r;
  }), [d, questions, wordRecipes, fitData]);
  const paths = useMemo(() => questions.map((_, i) => {
    const q = fitData?.questions.find(x => x.index === i);
    return q?.tables?.length ? { tables: q.tables, how: q.how ?? '' } : null;
  }), [questions, fitData]);
  const answeredAt = (i: number) => recipes[i].confidence !== 'none' || !!paths[i];
  const answered = recipes.filter((_, i) => answeredAt(i)).length;
  const uncovered = recipes.length - answered;
  const matchedAreas = useMemo(() => Array.from(new Set(recipes.filter(r => r.kpi && r.confidence !== 'none').map(r => r.kpi!.area))), [recipes]);

  if (seededFor !== d.slug) {
    setSeededFor(d.slug);
    if (initial) {
      setFocus(initial.areas);
      setPinned(initial.kpis);
      setNotes({});
      setEdited(true);
    } else {
      setFocus(quickPick.map(p => p.name));
      setNotes(notesFromRank(quickPick));
      setPinned(Array.from(new Set(recipes.filter(r => r.kpi && r.confidence !== 'none').map(r => r.kpi!.id))));
      setEdited(false);
    }
    setFitApplied(null);
    setChange(null);
    setSelectedArea(null);
  }

  const applyFit = (f: BlueprintFit, auto = false) => {
    const next = f.areas.map(a => a.name);
    const removed = focus.filter(n => !next.includes(n)).map(name => ({
      name,
      why: f.skipped?.find(s => s.name === name)?.why || 'Not needed for the data this use case depends on',
    }));
    const added = next.filter(n => !focus.includes(n));
    setChange(auto && (removed.length || added.length) ? { removed, added, prevFocus: focus, prevNotes: notes } : null);
    setFitApplied(f);
    setFocus(next);
    setNotes(notesFromFit(f));
    setPinned(Array.from(new Set(recipes.filter(r => r.kpi && r.confidence !== 'none').map(r => r.kpi!.id))));
    setEdited(false);
  };
  if (fitData && fitApplied !== fitData && seededFor === d.slug && !edited) applyFit(fitData, true);
  const fitOffered = !!fitData && fitApplied !== fitData && edited;

  const undoChange = () => {
    if (!change) return;
    setFocus(change.prevFocus);
    setNotes(change.prevNotes);
    setEdited(true);
    setChange(null);
  };
  const addBack = (area: string) => {
    if (!change) return;
    setFocus(f => (f.includes(area) ? f : [...f, area]));
    setNotes(n => ({ ...n, [area]: change.prevNotes[area] ?? { role: 'supporting', why: 'Added back by you' } }));
    setEdited(true);
    const removed = change.removed.filter(r => r.name !== area);
    setChange(removed.length || change.added.length ? { ...change, removed } : null);
  };

  const toggleFocus = (area: string) => {
    setEdited(true);
    setChange(null);
    setFocus(f => (f.includes(area) ? f.filter(a => a !== area) : [...f, area]));
  };
  const togglePin = (kpiId: string) => {
    setEdited(true);
    setChange(null);
    const kpi = d.kpis.find(k => k.id === kpiId);
    setPinned(p => (p.includes(kpiId) ? p.filter(x => x !== kpiId) : [...p, kpiId]));
    if (kpi && !pinned.includes(kpiId)) setFocus(f => (f.includes(kpi.area) ? f : [...f, kpi.area]));
  };
  const showArea = (area: string) => { setSelectedArea(area); setLens('map'); };

  const focusTables = d.areas.filter(a => focus.includes(a.name)).reduce((n, a) => n + a.tableIds.length, 0);
  const level = matchLevel(answered, recipes.length, fitData?.fit);
  const veryLow = level === 'veryLow';
  const finish = () => onFinish({ focus, pinned, fit: fitData, fitFailed: fit.failed, recipes, answered, focusTables, lowMatch: veryLow });

  if (matching) return <MatchingState noun={copy.noun} questions={questions.length} />;

  const unc = copy.uncovered(uncovered, recipes.length);
  return (
    <>
      <div className="space-y-6">
        {(fit.failed || (fitData?.mode === 'tables' && !fit.refining)) && !initial && (
          <FadeIn className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.05] px-4 py-3">
            <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
            <p className="flex-1 text-ui-sm text-muted-foreground">
              {fit.failed ? `Could not match your idea to ${copy.noun}${fit.error ? `: ${fit.error}` : '.'} This is a quick match on your words only.` : `${FALLBACK_WHY[fitData?.reason ?? 'unavailable'] ?? ''}${copy.fallback}`}
            </p>
            <button onClick={fit.retry} className="shrink-0 inline-flex items-center gap-1.5 text-ui-xs font-medium text-primary hover:underline">
              <RotateCcw className="w-3.5 h-3.5" /> Try again
            </button>
          </FadeIn>
        )}
        <FadeIn delay={0.05}>
          <FitPanel
            digest={d}
            fit={fitData}
            loading={fit.refining}
            focus={focus}
            notes={notes}
            offered={fitOffered}
            refining={fit.refining && !edited}
            change={change}
            inSource={copy.inSource}
            gapNote={copy.gapNote}
            onUndo={undoChange}
            onAddBack={addBack}
            onUseSuggested={() => fitData && applyFit(fitData)}
            onShowArea={showArea}
            onToggleArea={toggleFocus}
          />
        </FadeIn>
        <FadeIn delay={0.07}><TrustStrip digest={d} note={copy.trustNote} /></FadeIn>

        {veryLow ? (
          <FadeIn delay={0.08} className="rounded-2xl border border-rose-500/40 bg-rose-500/[0.06] px-4 py-4 sm:px-5">
            <div role="alert" className="flex items-start gap-3">
              <OctagonAlert className="w-5 h-5 mt-0.5 text-rose-500 shrink-0" />
              <div className="flex-1 min-w-0 space-y-2 text-ui-sm leading-relaxed">
                <p className="text-ui-md font-semibold text-foreground">
                  Very low match: {answered} of {recipes.length} question{recipes.length === 1 ? '' : 's'} answered. We recommend you do not proceed.
                </p>
                <p className="text-muted-foreground">
                  This data {answered ? 'barely covers' : "doesn't cover"} what your idea asks, so a Genie built on it would give weak or wrong answers. Go back and look for other ways to get to the data:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-foreground/85">
                  {copy.lowMatchTips.map(t => <li key={t}>{t}</li>)}
                </ul>
                <div className="pt-1">
                  <SecondaryButton onClick={onBack}><ArrowLeft className="w-4 h-4" /> Go back and look for other data</SecondaryButton>
                </div>
              </div>
            </div>
          </FadeIn>
        ) : level === 'low' && (
          <FadeIn delay={0.08} className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <TriangleAlert className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
            <div className="text-ui-sm leading-relaxed">
              <p className="font-semibold text-foreground">{unc.title}</p>
              <p className="text-muted-foreground">{unc.body}</p>
            </div>
          </FadeIn>
        )}
        {notice?.({ answered, total: recipes.length, level, fit: fitData?.fit ?? null, refining: fit.refining })}

        <FadeIn delay={0.1}>
          <div role="tablist" className="flex gap-1 p-1 rounded-2xl bg-secondary/50 overflow-x-auto">
            {LENSES.map(l => (
              <button
                key={l.id}
                role="tab"
                aria-selected={lens === l.id}
                onClick={() => setLens(l.id)}
                className={`flex-1 min-w-fit inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-ui-sm font-medium whitespace-nowrap transition-all ${
                  lens === l.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <l.icon className="w-4 h-4" /> {l.label}
                {l.id === 'answers' && recipes.length > 0 && <span className="text-ui-xs text-muted-foreground tabular-nums">{answered}/{recipes.length}</span>}
              </button>
            ))}
          </div>
        </FadeIn>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={lens} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
            {lens === 'answers' && (
              <div className="space-y-3">
                <p className="text-ui-sm text-muted-foreground">{copy.answersIntro}</p>
                {recipes.map((r, i) => (
                  <AnswerRecipe
                    key={r.question}
                    index={i}
                    recipe={r}
                    path={paths[i]}
                    digest={d}
                    pinned={!!r.kpi && pinned.includes(r.kpi.id)}
                    onTogglePin={togglePin}
                    onShowArea={showArea}
                  />
                ))}
                {d.starterQuestions.length > 0 && (
                  <div className="rounded-2xl bg-secondary/30 border border-border/60 p-4 sm:p-5">
                    <p className="text-ui-sm font-semibold text-foreground">Also answerable out of the box</p>
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {d.starterQuestions.slice(0, 8).map(s => (
                        <button
                          key={s.question}
                          onClick={() => { togglePin(s.kpi); }}
                          title={pinned.includes(s.kpi) ? 'In your KPIs' : 'Add this KPI'}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-ui-xs transition-colors ${
                            pinned.includes(s.kpi) ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-card text-foreground/85 hover:border-foreground/30'
                          }`}
                        >
                          {pinned.includes(s.kpi) && <Check className="w-3 h-3" strokeWidth={3} />}{s.question}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {lens === 'map' && (
              <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
                <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
                  <DataMap digest={d} focus={focus} supporting={focus.filter(a => notes[a]?.role === 'supporting')} matched={matchedAreas} selected={selectedArea} onSelect={setSelectedArea} />
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 pt-1 text-ui-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary" /> in your Genie</span>
                    {focus.some(a => notes[a]?.role === 'supporting') && (
                      <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full border-2 border-primary bg-primary/15" /> supporting</span>
                    )}
                    <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> your questions land here</span>
                    <span>Number = tables · thicker thread = more connections</span>
                  </div>
                </div>
                {selectedArea ? (
                  <AreaXray
                    digest={d}
                    area={selectedArea}
                    inFocus={focus.includes(selectedArea)}
                    onToggleFocus={toggleFocus}
                    onSelect={setSelectedArea}
                    onClose={() => setSelectedArea(null)}
                    onOpenDiagram={a => { setDiagramArea(a); setLens('diagram'); }}
                  />
                ) : (
                  <div className="rounded-2xl border border-dashed border-border p-5 space-y-2">
                    <p className="text-ui-md font-semibold text-foreground">Tap an area to look inside</p>
                    <p className="text-ui-sm text-muted-foreground leading-relaxed">
                      See its tables, the KPIs it already defines, and why it connects to its neighbours. Include the areas your Genie should know about.
                    </p>
                  </div>
                )}
              </div>
            )}
            {lens === 'diagram' && (
              <div className="space-y-2">
                <p className="text-ui-sm text-muted-foreground">{copy.diagramNote}</p>
                <ErDiagram key={diagramArea ?? 'auto'} digest={d} focus={focus} initialArea={diagramArea ?? focus[0] ?? matchedAreas[0] ?? null} />
              </div>
            )}
            {lens === 'metrics' && <KpiLibrary digest={d} focus={focus} pinned={pinned} onTogglePin={togglePin} />}
            {lens === 'tables' && <TableCatalog digest={d} focus={focus} />}
          </motion.div>
        </AnimatePresence>

        {sourceFooter}
      </div>

      <div className="sticky bottom-4 z-30">
        <div className="rounded-2xl border border-border bg-card/95 backdrop-blur shadow-lg px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-ui-md font-semibold text-foreground">
              {focus.length} area{focus.length === 1 ? '' : 's'} · {focusTables} tables · {pinned.length} KPI{pinned.length === 1 ? '' : 's'}
              {focusTables > FOCUS_SOFT_CAP && <span className="ml-2 text-ui-xs font-normal text-amber-500">Big. Genie Code will start with the tables behind your KPIs.</span>}
            </p>
            {footerStatus}
          </div>
          {veryLow && confirming ? (
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <span className="text-ui-sm text-rose-600 dark:text-rose-400 font-medium">Matches are very low. Continue anyway?</span>
              <GhostButton onClick={onBack}><ArrowLeft className="w-4 h-4" /> Go back</GhostButton>
              <SecondaryButton onClick={finish}>Yes, continue</SecondaryButton>
            </div>
          ) : veryLow ? (
            <SecondaryButton disabled={focus.length === 0} onClick={() => setConfirming(true)} title={focus.length ? 'Not recommended: very few of your questions are answered' : 'Include at least one area'}>
              Proceed anyway <ArrowRight className="w-4 h-4" />
            </SecondaryButton>
          ) : (
            <PrimaryButton size="lg" disabled={focus.length === 0} onClick={finish} title={focus.length ? undefined : 'Include at least one area'}>
              {copy.finishLabel} <ArrowRight className="w-4 h-4" />
            </PrimaryButton>
          )}
        </div>
      </div>
    </>
  );
}

const FIT_LABEL: Record<BlueprintFit['fit'], { text: string; tone: string }> = {
  strong: { text: 'Strong fit', tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  partial: { text: 'Partial fit', tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  weak: { text: 'Weak fit', tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
};

interface FitPanelProps {
  digest: BlueprintDigest;
  fit: BlueprintFit | null;
  loading: boolean;
  focus: string[];
  notes: Record<string, AreaNote>;
  /** A fresh match arrived after the user edited the areas. */
  offered: boolean;
  /** The quick word-based pick is showing and the AI is still reading the tables. */
  refining: boolean;
  change: FitChange | null;
  inSource: string;
  gapNote: string;
  onUndo: () => void;
  onAddBack: (area: string) => void;
  onUseSuggested: () => void;
  onShowArea: (area: string) => void;
  onToggleArea: (area: string) => void;
}

/** The areas picked for the idea and, once the AI has read it, what the use case needs from the model. */
function FitPanel({ digest, fit, loading, focus, notes, offered, refining, change, inSource, gapNote, onUndo, onAddBack, onUseSuggested, onShowArea, onToggleArea }: FitPanelProps) {
  const labelOf = (name: string) => digest.areas.find(a => a.name === name)?.label ?? name;
  const tableOf = (id: string) => digest.tables.find(t => t.id === id);
  const joinText = (area: string, join?: [string, string]) => {
    if (!join) return '';
    const other = join.map(tableOf).find(t => t && t.area !== area);
    const [from, to] = join.map(id => tableOf(id)?.label ?? id);
    return other ? `Joins ${labelOf(other.area)} via ${from} → ${to}` : '';
  };
  const ordered = [...focus].sort((a, b) => Number(notes[a]?.role === 'supporting') - Number(notes[b]?.role === 'supporting'));
  const needs = fit ? [...fit.needs].sort((a, b) => Number(!!a.gap) - Number(!!b.gap) || Number(a.importance === 'nice') - Number(b.importance === 'nice')) : [];
  const gaps = needs.filter(n => n.gap).length;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-ui-md font-semibold text-foreground">Picked for your use case</p>
        {fit && <span className={`px-2 py-0.5 rounded-full text-ui-xs font-medium ${FIT_LABEL[fit.fit].tone}`}>{FIT_LABEL[fit.fit].text}</span>}
        {loading && (
          <span className="inline-flex items-center gap-1.5 text-ui-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            {refining ? 'Quick match on table names and columns. The AI is reading the tables to refine it…' : 'Reading your use case to match it…'}
          </span>
        )}
        {offered && (
          <button onClick={onUseSuggested} className="ml-auto inline-flex items-center gap-1.5 text-ui-sm font-semibold text-primary hover:underline underline-offset-2">
            <Sparkles className="w-3.5 h-3.5" /> Use the suggested areas
          </button>
        )}
      </div>
      {fit?.summary && <p className="text-ui-sm text-muted-foreground leading-relaxed -mt-2">{fit.summary}</p>}

      {change && (
        <div className="rounded-xl border border-primary/25 bg-primary/[0.04] px-3 py-2.5 space-y-1.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
            <p className="text-ui-sm text-foreground">
              Updated after reading the tables
              {change.removed.length > 0 && <>: removed {change.removed.map(r => labelOf(r.name)).join(', ')}</>}
              {change.added.length > 0 && <>{change.removed.length ? '; added ' : ': added '}{change.added.map(labelOf).join(', ')}</>}
            </p>
            <button onClick={onUndo} className="ml-auto text-ui-sm font-semibold text-primary hover:underline underline-offset-2">Undo</button>
          </div>
          {change.removed.map(r => (
            <div key={r.name} className="flex items-start gap-2 pl-5 text-ui-xs">
              <span className="text-muted-foreground leading-snug"><span className="font-medium text-foreground">{labelOf(r.name)}</span>: {r.why}</span>
              <button onClick={() => onAddBack(r.name)} className="ml-auto shrink-0 font-medium text-primary hover:underline underline-offset-2">Add back</button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {ordered.map(name => (
          <div key={name} className={`group inline-flex items-start gap-2 rounded-xl border px-3 py-2 max-w-sm ${notes[name]?.role === 'supporting' ? 'border-primary/30 bg-primary/[0.03]' : 'border-primary/50 bg-primary/[0.07]'}`}>
            <button onClick={() => onShowArea(name)} className="text-left min-w-0" title="Look inside this area">
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full shrink-0 ${notes[name]?.role === 'supporting' ? 'border-2 border-primary' : 'bg-primary'}`} />
                <span className="text-ui-sm font-semibold text-foreground">{labelOf(name)}</span>
                <span className="text-ui-2xs uppercase tracking-wider text-muted-foreground">{notes[name]?.role ?? 'added by you'}</span>
              </span>
              {notes[name]?.why && <span className="block text-ui-xs text-muted-foreground mt-0.5 leading-snug">{notes[name].why}</span>}
              {joinText(name, notes[name]?.join) && (
                <span className="block text-ui-2xs text-muted-foreground/80 mt-1 leading-snug">{joinText(name, notes[name]?.join)}</span>
              )}
            </button>
            <button onClick={() => onToggleArea(name)} aria-label={`Remove ${labelOf(name)}`} className="text-muted-foreground/60 hover:text-foreground text-ui-sm leading-none mt-0.5">×</button>
          </div>
        ))}
        {!ordered.length && <p className="text-ui-sm text-muted-foreground">No areas yet. Tap an area on the map to include it.</p>}
      </div>

      {needs.length > 0 && (
        <div className="border-t border-border/70 pt-3 space-y-2">
          <p className="text-ui-sm font-semibold text-foreground">
            What your use case needs
            <span className="ml-2 font-normal text-muted-foreground">{needs.length - gaps} of {needs.length} {inSource}</span>
          </p>
          <ul className="grid sm:grid-cols-2 gap-x-5 gap-y-2">
            {needs.map(n => (
              <li key={n.need} className="flex items-start gap-2 text-ui-sm">
                {n.gap
                  ? <CircleDashed className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                  : <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-500" strokeWidth={3} />}
                <span className="min-w-0">
                  <span className="text-foreground">{n.need}</span>
                  {n.importance === 'nice' && <span className="ml-1.5 text-ui-2xs uppercase tracking-wider text-muted-foreground">nice to have</span>}
                  <span className="block text-ui-xs text-muted-foreground leading-snug">
                    {n.gap || `In ${n.areas.map(labelOf).join(', ')}${n.grain ? ` · ${n.grain}` : ''}`}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {gaps > 0 && <p className="text-ui-xs text-muted-foreground">{gapNote}</p>}
        </div>
      )}
    </div>
  );
}
