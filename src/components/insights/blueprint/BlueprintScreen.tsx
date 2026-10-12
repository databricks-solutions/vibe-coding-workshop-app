import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, Gauge, Loader2, Map as MapIcon, MessageCircleQuestion, Network, RefreshCw, ShieldCheck, Table2,
} from 'lucide-react';
import { FadeIn, GhostButton, OnboardingProgress, PrimaryButton, SecondaryButton } from '../ui';
import { AnswerRecipe } from './AnswerRecipe';
import { AreaXray } from './AreaXray';
import { blueprintApi, useBlueprintCatalog, useBlueprintDigest, useInstallStatus, useInstalledModels } from './blueprintApi';
import { DataMap } from './DataMap';
import { ErDiagram } from './ErDiagram';
import { KpiLibrary } from './KpiLibrary';
import { matchQuestion, suggestAreas } from './match';
import { MiniConstellation } from './MiniConstellation';
import { SourceFooter, SourcePill } from './SourcePill';
import { TableCatalog } from './TableCatalog';
import type { BlueprintCatalog, BlueprintChoice, BlueprintDigest, Capabilities, InstallStatus } from './types';

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
  initialChoice: BlueprintChoice | null;
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

export function BlueprintScreen({ questions, initialSlug, initialChoice, onBack, onNext }: BlueprintScreenProps) {
  const catalog = useBlueprintCatalog();
  const [slug, setSlug] = useState<string | null>(initialChoice?.slug ?? initialSlug);
  const [attempt, setAttempt] = useState(0);
  const digest = useBlueprintDigest(slug, attempt);
  const { status, update } = useInstallStatus(digest.data ? slug : null);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [starting, setStarting] = useState(false);
  const [lens, setLens] = useState<Lens>(questions.length ? 'answers' : 'map');
  const [focus, setFocus] = useState<string[]>([]);
  const [pinned, setPinned] = useState<string[]>([]);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [diagramArea, setDiagramArea] = useState<string | null>(null);
  const [seededFor, setSeededFor] = useState<string | null>(null);

  useEffect(() => { blueprintApi.capabilities().then(setCaps).catch(() => setCaps(null)); }, []);

  const d = digest.data;
  const recipes = useMemo(() => (d ? questions.map(q => matchQuestion(q, d)) : []), [d, questions]);
  const matchedAreas = useMemo(() => Array.from(new Set(recipes.filter(r => r.kpi && r.confidence !== 'none').map(r => r.kpi!.area))), [recipes]);

  if (d && seededFor !== d.slug) {
    setSeededFor(d.slug);
    if (initialChoice && initialChoice.slug === d.slug) {
      setFocus(initialChoice.areas);
      setPinned(initialChoice.kpis);
    } else {
      const areas = suggestAreas(recipes, d);
      setFocus(areas);
      setPinned(Array.from(new Set(recipes.filter(r => r.kpi && r.confidence !== 'none').map(r => r.kpi!.id))));
    }
    setSelectedArea(null);
  }

  const toggleFocus = (area: string) => setFocus(f => (f.includes(area) ? f.filter(a => a !== area) : [...f, area]));
  const togglePin = (kpiId: string) => {
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
  if (!slug) {
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
        <FadeIn delay={0.05}><TrustStrip digest={d} /></FadeIn>

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
                  <DataMap digest={d} focus={focus} matched={matchedAreas} selected={selectedArea} onSelect={setSelectedArea} />
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 pt-1 text-ui-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-primary" /> in your Genie</span>
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
      <FadeIn className="flex items-center justify-between">
        <OnboardingProgress index={2} total={4} />
        <GhostButton onClick={onBack}><ArrowLeft className="w-4 h-4" /> Back</GhostButton>
      </FadeIn>

      <FadeIn delay={0.03} className="space-y-3">
        <p className="text-ui-sm font-semibold uppercase tracking-[0.14em] text-primary/90">Industry data model</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground leading-[1.1]">Start from a proven model</h1>
          {catalog.data && slug && <IndustryPicker catalog={catalog.data} value={slug} onChange={s => { setSlug(s); setAttempt(0); }} />}
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
