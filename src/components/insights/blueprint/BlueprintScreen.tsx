import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, CircleDashed, Gauge, Loader2, Map as MapIcon, MessageCircleQuestion, Network, RefreshCw, ShieldCheck, Sparkles, Table2, TriangleAlert,
} from 'lucide-react';
import { FadeIn, GhostButton, PrimaryButton, SecondaryButton } from '../../journeykit';
import { AnswerRecipe } from './AnswerRecipe';
import { AreaXray } from './AreaXray';
import { blueprintApi, useBlueprintCatalog, useBlueprintDigest, useBlueprintFit, useInstallStatus, useInstalledModels } from './blueprintApi';
import { DataMap } from './DataMap';
import { ErDiagram } from './ErDiagram';
import { KpiLibrary } from './KpiLibrary';
import type { ModelHint } from './industryMap';
import { matchQuestion, rankAreas, recipeFor, type AreaPick } from './match';
import { MiniConstellation } from './MiniConstellation';
import { SourceFooter, SourcePill } from './SourcePill';
import { TableCatalog } from './TableCatalog';
import type { BlueprintCatalog, BlueprintChoice, BlueprintDigest, BlueprintFit, Capabilities, InstallStatus } from './types';
import { useModelPick } from './useModelPick';

const FOCUS_SOFT_CAP = 30;

type Lens = 'answers' | 'map' | 'diagram' | 'metrics' | 'tables';

const LENSES: { id: Lens; label: string; icon: typeof MapIcon }[] = [
  { id: 'answers', label: 'Your answers', icon: MessageCircleQuestion },
  { id: 'map', label: 'The map', icon: MapIcon },
  { id: 'diagram', label: 'Diagram', icon: Network },
  { id: 'metrics', label: 'KPIs', icon: Gauge },
  { id: 'tables', label: 'Tables', icon: Table2 },
];

interface BlueprintScreenProps {
  questions: string[];
  initialSlug: string | null;
  /** Used to pick the closest model when there is no earlier choice. */
  hint: ModelHint;
  /** The idea in plain text, for matching it to areas and tables. */
  context: string;
  initialChoice: BlueprintChoice | null;
  progress?: ReactNode;
  onBack: () => void;
  onNext: (choice: BlueprintChoice) => void;
}

function IndustryPicker({ catalog, value, onChange }: { catalog: BlueprintCatalog; value: string | null; onChange: (slug: string) => void }) {
  const [open, setOpen] = useState(false);
  const installed = new Set(useInstalledModels().filter(m => m.ready).map(m => m.slug));
  const ref = useRef<HTMLDivElement>(null);
  const current = catalog.industries.find(i => i.slug === value);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);
  const bySlug = new Map(catalog.industries.map(i => [i.slug, i]));
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 h-9 pl-3 pr-2.5 rounded-xl border border-border bg-card text-ui-md font-semibold text-foreground hover:border-foreground/30 transition-colors"
      >
        {current?.label ?? 'Pick an industry'} <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-40 left-0 mt-2 w-[min(92vw,560px)] max-h-[60vh] overflow-auto rounded-2xl border border-border bg-card shadow-xl p-3"
          >
            {installed.size > 0 && (
              <div className="pb-3 mb-3 border-b border-border/70">
                <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">In your workspace</p>
                <div className="grid sm:grid-cols-2 gap-x-4">
                  {catalog.industries.filter(i => installed.has(i.slug)).map(i => (
                    <button
                      key={i.slug}
                      onClick={() => { onChange(i.slug); setOpen(false); }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-ui-sm transition-colors ${i.slug === value ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-secondary/60'}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="flex-1">{i.label}</span>
                      <span className="text-ui-xs text-muted-foreground">ready</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="px-2 pb-2 text-ui-xs text-muted-foreground">{catalog.industries.length} industry models from the gallery</p>
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3">
              {catalog.sections.map(s => {
                const items = s.industries.map(slug => bySlug.get(slug)).filter(Boolean);
                if (!items.length) return null;
                return (
                  <div key={s.name}>
                    <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">{s.name}</p>
                    {items.map(i => (
                      <button
                        key={i!.slug}
                        onClick={() => { onChange(i!.slug); setOpen(false); }}
                        className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-left text-ui-sm transition-colors ${i!.slug === value ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-secondary/60'}`}
                      >
                        <span className="flex items-center gap-1.5">{installed.has(i!.slug) && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}{i!.label}</span>
                        <span className="text-ui-xs text-muted-foreground tabular-nums">{i!.counts.tables} tables</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TrustStrip({ digest }: { digest: BlueprintDigest }) {
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
        {typeof trust.qualityScore === 'number' && (
          <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Model quality {Math.round(trust.qualityScore)}/100</span>
        )}
        {trust.standards.length > 0 && <span>Aligned to {trust.standards.slice(0, 5).join(', ')}</span>}
        {trust.sensitiveFields > 0 && <span>{trust.sensitiveFields} sensitive fields labelled</span>}
        <span className="sm:ml-auto">Structure is real. Rows are realistic sample data.</span>
      </div>
    </div>
  );
}

function InstallChip({ status, caps, onStart, starting }: { status: InstallStatus | null; caps: Capabilities | null; onStart: () => void; starting: boolean }) {
  if (!status) return <span className="text-ui-xs text-muted-foreground">Checking your workspace…</span>;
  if (status.state === 'installed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-ui-xs text-emerald-500 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Already in your workspace <span className="font-mono text-muted-foreground font-normal">{status.catalog}</span>
      </span>
    );
  }
  if (status.state === 'installing') {
    return (
      <span className="inline-flex items-center gap-1.5 text-ui-xs text-foreground/90">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Setting up · {status.percent}% · {status.phaseLabel}
      </span>
    );
  }
  if (status.state === 'exists') {
    return <span className="text-ui-xs text-muted-foreground">Already in your workspace as <span className="font-mono">{status.catalog}</span>, still being set up or not shared yet.</span>;
  }
  const canStart = !!caps?.canInstall && caps.installEnabled;
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-ui-xs text-muted-foreground">
      {status.state === 'failed' ? 'Last setup did not finish. It will retry in your first chapter.' : 'Gets set up for you in your first chapter, about 15 minutes.'}
      {canStart && (
        <button onClick={onStart} disabled={starting} className="font-semibold text-primary hover:underline underline-offset-2 disabled:opacity-50">
          {starting ? 'Starting…' : 'Start now'}
        </button>
      )}
    </span>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 18, ease: 'linear' }}>
        <MiniConstellation nodes={11} size={72} />
      </motion.div>
      <p className="text-ui-md text-foreground font-medium">Reading the {label} model from GitHub</p>
      <p className="text-ui-sm text-muted-foreground max-w-sm">Pulling its business areas, tables, connections and KPIs from the Industry Data Models gallery.</p>
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

export function BlueprintScreen({ questions, initialSlug, hint, context, initialChoice, progress, onBack, onNext }: BlueprintScreenProps) {
  const catalog = useBlueprintCatalog();
  const modelPick = useModelPick(hint);
  const [slug, setSlug] = useState<string | null>(initialChoice?.slug ?? initialSlug);
  const [autoPicked, setAutoPicked] = useState(!!slug);
  if (!autoPicked && modelPick.ready) {
    setAutoPicked(true);
    setSlug(modelPick.slug);
  }
  const [attempt, setAttempt] = useState(0);
  const digest = useBlueprintDigest(slug, attempt);
  const { status, update } = useInstallStatus(digest.data ? slug : null);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [starting, setStarting] = useState(false);
  const [lens, setLens] = useState<Lens>('map');
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

  useEffect(() => { blueprintApi.capabilities().then(setCaps).catch(() => setCaps(null)); }, []);

  const d = digest.data;
  const wordRecipes = useMemo(() => (d ? questions.map(q => matchQuestion(q, d)) : []), [d, questions]);
  const quickPick = useMemo(() => (d ? rankAreas(d, [context, ...questions].join('\n'), wordRecipes) : []), [d, context, questions, wordRecipes]);
  const fit = useBlueprintFit(d?.slug ?? null, context, questions, quickPick.map(p => p.name));
  const fitData = fit.data && fit.data.slug === d?.slug ? fit.data : null;
  const recipes = useMemo(() => {
    if (!d) return [];
    return questions.map((q, i) => {
      const r = wordRecipes[i];
      if (r.confidence !== 'none') return r;
      const kpiId = fitData?.questions.find(x => x.index === i)?.kpi;
      const kpi = kpiId ? d.kpis.find(k => k.id === kpiId) : null;
      return kpi ? recipeFor(kpi, q) : r;
    });
  }, [d, questions, wordRecipes, fitData]);
  const uncovered = recipes.filter(r => r.confidence === 'none').length;
  const matchedAreas = useMemo(() => Array.from(new Set(recipes.filter(r => r.kpi && r.confidence !== 'none').map(r => r.kpi!.area))), [recipes]);

  if (d && seededFor !== d.slug) {
    setSeededFor(d.slug);
    if (initialChoice && initialChoice.slug === d.slug) {
      setFocus(initialChoice.areas);
      setPinned(initialChoice.kpis);
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
  if (d && fitData && fitApplied !== fitData && seededFor === d.slug && !edited) applyFit(fitData, true);
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
    const kpi = d?.kpis.find(k => k.id === kpiId);
    setPinned(p => (p.includes(kpiId) ? p.filter(x => x !== kpiId) : [...p, kpiId]));
    if (kpi && !pinned.includes(kpiId)) setFocus(f => (f.includes(kpi.area) ? f : [...f, kpi.area]));
  };
  const showArea = (area: string) => { setSelectedArea(area); setLens('map'); };

  const startInstall = async () => {
    if (!slug) return;
    setStarting(true);
    try { update(await blueprintApi.install(slug)); } catch { /* the first chapter retries */ }
    setStarting(false);
  };

  const focusTables = d ? d.areas.filter(a => focus.includes(a.name)).reduce((n, a) => n + a.tableIds.length, 0) : 0;
  const label = d?.label ?? catalog.data?.industries.find(i => i.slug === slug)?.label ?? 'industry';

  const finish = () => {
    if (!d) return;
    onNext({
      slug: d.slug,
      label: d.label,
      version: d.version,
      flavour: d.flavour,
      catalog: d.catalog,
      commitSha: d.source.commitSha,
      areas: focus,
      kpis: pinned,
    });
  };

  let body: React.ReactNode;
  if (!slug && !autoPicked) {
    body = <LoadingState label="gallery" />;
  } else if (!slug) {
    body = catalog.data ? (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-4">
        <MiniConstellation nodes={10} size={64} />
        <p className="text-ui-lg font-semibold text-foreground">Which industry is closest to yours?</p>
        <div className="flex justify-center"><IndustryPicker catalog={catalog.data} value={slug} onChange={setSlug} /></div>
      </div>
    ) : catalog.error ? (
      <ErrorState message="The Industry Data Models gallery could not be reached." onRetry={() => window.location.reload()} onBack={onBack} />
    ) : <LoadingState label="gallery" />;
  } else if (digest.error) {
    body = <ErrorState message={`The ${label} model could not be loaded from GitHub right now.`} onRetry={() => setAttempt(a => a + 1)} onBack={onBack} />;
  } else if (!d || digest.loading) {
    body = <LoadingState label={label} />;
  } else {
    body = (
      <div className="space-y-6">
        <FadeIn delay={0.05}>
          <FitPanel
            digest={d}
            fit={fitData}
            loading={fit.loading}
            focus={focus}
            notes={notes}
            offered={fitOffered}
            refining={fit.loading && !fitApplied && !edited}
            change={change}
            onUndo={undoChange}
            onAddBack={addBack}
            onUseSuggested={() => fitData && applyFit(fitData)}
            onShowArea={showArea}
            onToggleArea={toggleFocus}
          />
        </FadeIn>
        <FadeIn delay={0.07}><TrustStrip digest={d} /></FadeIn>

        {uncovered * 2 > recipes.length && (
          <FadeIn delay={0.08} className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <TriangleAlert className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
            <div className="text-ui-sm leading-relaxed">
              <p className="font-semibold text-foreground">
                {uncovered} of your {recipes.length} questions aren't in the {d.label} model
              </p>
              <p className="text-muted-foreground">
                Your Genie is built on this model's tables, so it should be about the same business as your idea. Pick a closer industry above, or keep this one and Genie Code will add what's missing in your own schema.
              </p>
            </div>
          </FadeIn>
        )}

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
                {l.id === 'answers' && recipes.length > 0 && <span className="text-ui-xs text-muted-foreground tabular-nums">{recipes.filter(r => r.confidence !== 'none').length}/{recipes.length}</span>}
              </button>
            ))}
          </div>
        </FadeIn>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={lens} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
            {lens === 'answers' && (
              <div className="space-y-3">
                <p className="text-ui-sm text-muted-foreground">
                  How the {d.label} model would answer each of your questions, using KPIs it already defines.
                </p>
                {recipes.map((r, i) => (
                  <AnswerRecipe
                    key={r.question}
                    index={i}
                    recipe={r}
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
                <p className="text-ui-sm text-muted-foreground">
                  How the tables in each business area connect. These are the exact tables, keys and links that get created in <span className="font-mono text-foreground/80">{d.catalog}</span>.
                </p>
                <ErDiagram key={diagramArea ?? 'auto'} digest={d} focus={focus} initialArea={diagramArea ?? focus[0] ?? matchedAreas[0] ?? null} />
              </div>
            )}
            {lens === 'metrics' && <KpiLibrary digest={d} focus={focus} pinned={pinned} onTogglePin={togglePin} />}
            {lens === 'tables' && <TableCatalog digest={d} focus={focus} />}
          </motion.div>
        </AnimatePresence>

        <SourceFooter source={d.source} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-1 py-6 sm:py-10 space-y-6">
      <FadeIn className="flex items-center justify-between gap-4">
        {progress}
        <GhostButton onClick={onBack}><ArrowLeft className="w-4 h-4" /> Back</GhostButton>
      </FadeIn>

      <FadeIn delay={0.03} className="space-y-3">
        <p className="text-ui-sm font-semibold uppercase tracking-[0.14em] text-primary/90">Industry data model</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground leading-[1.1]">Start from a proven model</h1>
          {catalog.data && slug && <IndustryPicker catalog={catalog.data} value={slug} onChange={s => { setSlug(s); setAttempt(0); }} />}
          {!initialChoice && modelPick.slug === slug && modelPick.why && (
            <span className="inline-flex items-center gap-1.5 text-ui-sm text-muted-foreground"><Sparkles className="w-3.5 h-3.5 text-primary" /> {modelPick.why}</span>
          )}
        </div>
        <p className="text-ui-lg text-muted-foreground max-w-2xl leading-relaxed">
          {d ? d.description : 'A complete, connected industry data model your Genie can stand on: tables, connections and ready-made KPIs.'}
        </p>
        {(d?.source ?? catalog.data?.source) && <SourcePill source={(d?.source ?? catalog.data!.source)} label={d?.label} />}
      </FadeIn>

      {body}

      {d && (
        <div className="sticky bottom-4 z-30">
          <div className="rounded-2xl border border-border bg-card/95 backdrop-blur shadow-lg px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-ui-md font-semibold text-foreground">
                {focus.length} area{focus.length === 1 ? '' : 's'} · {focusTables} tables · {pinned.length} KPI{pinned.length === 1 ? '' : 's'}
                {focusTables > FOCUS_SOFT_CAP && <span className="ml-2 text-ui-xs font-normal text-amber-500">Big. Genie Code will start with the tables behind your KPIs.</span>}
              </p>
              <InstallChip status={status} caps={caps} onStart={startInstall} starting={starting} />
            </div>
            <PrimaryButton size="lg" disabled={focus.length === 0} onClick={finish} title={focus.length ? undefined : 'Include at least one area'}>
              Use this model <ArrowRight className="w-4 h-4" />
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
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
  onUndo: () => void;
  onAddBack: (area: string) => void;
  onUseSuggested: () => void;
  onShowArea: (area: string) => void;
  onToggleArea: (area: string) => void;
}

/** The areas picked for the idea and, once the AI has read it, what the use case needs from the model. */
function FitPanel({ digest, fit, loading, focus, notes, offered, refining, change, onUndo, onAddBack, onUseSuggested, onShowArea, onToggleArea }: FitPanelProps) {
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
            {refining ? 'First guess from your words. Reading the tables to refine it…' : 'Reading your use case to match it to the model…'}
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
            <span className="ml-2 font-normal text-muted-foreground">{needs.length - gaps} of {needs.length} in this model</span>
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
          {gaps > 0 && (
            <p className="text-ui-xs text-muted-foreground">Genie Code adds what's missing in your own schema, next to the model's tables.</p>
          )}
        </div>
      )}
    </div>
  );
}

function ErrorState({ message, onRetry, onBack }: { message: string; onRetry: () => void; onBack: () => void }) {
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

export default BlueprintScreen;
