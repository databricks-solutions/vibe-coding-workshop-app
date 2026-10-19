import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ChevronDown, Loader2, Sparkles } from 'lucide-react';
import { FadeIn, GhostButton } from '../../journeykit';
import { blueprintApi, useBlueprintCatalog, useBlueprintDigest, useInstallStatus, useInstalledModels } from './blueprintApi';
import type { ModelHint } from './industryMap';
import { MiniConstellation } from './MiniConstellation';
import { ErrorState, ExplorerHeader, LoadingState, ModelExplorer, type ExplorerCopy, type ExplorerPick } from './ModelExplorer';
import { SourceFooter, SourcePill } from './SourcePill';
import type { BlueprintCatalog, BlueprintChoice, Capabilities, InstallStatus } from './types';
import { useModelPick } from './useModelPick';

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
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      ref.current?.querySelector('button')?.focus();
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
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

const modelCopy = (label: string, catalog: string): ExplorerCopy => ({
  noun: `the ${label} model`,
  fallback: "This is a table-level match on the model's names, descriptions and columns. You can adjust any area or KPI.",
  answersIntro: `How the ${label} model would answer each of your questions, using KPIs it already defines.`,
  uncovered: (n, total) => ({
    title: `${n} of your ${total} questions aren't in the ${label} model`,
    body: "Your Genie is built on this model's tables, so it should be about the same business as your idea. Pick a closer industry above, or keep this one and Genie Code will add what's missing in your own schema.",
  }),
  diagramNote: <>How the tables in each business area connect. These are the exact tables, keys and links that get created in <span className="font-mono text-foreground/80">{catalog}</span>.</>,
  inSource: 'in this model',
  gapNote: "Genie Code adds what's missing in your own schema, next to the model's tables.",
  trustNote: 'Structure is real. Rows are realistic sample data.',
  finishLabel: 'Use this model',
  lowMatchTips: [
    `Try a different industry model from the picker above. The ${label} model is built for another kind of business.`,
    'Use tables you already have: go back and pick "Already in Databricks" to scan an approved or your own catalog.schema.',
    `Reword your questions around what the ${label} model measures, if that still serves your idea.`,
  ],
});

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

  useEffect(() => { blueprintApi.capabilities().then(setCaps).catch(() => setCaps(null)); }, []);

  const d = digest.data;

  const startInstall = async () => {
    if (!slug) return;
    setStarting(true);
    try { update(await blueprintApi.install(slug)); } catch { /* the first chapter retries */ }
    setStarting(false);
  };

  const label = d?.label ?? catalog.data?.industries.find(i => i.slug === slug)?.label ?? 'industry';

  const finish = (pick: ExplorerPick) => {
    if (!d) return;
    onNext({
      slug: d.slug,
      label: d.label,
      version: d.version,
      flavour: d.flavour,
      catalog: d.catalog,
      commitSha: d.source.commitSha,
      areas: pick.focus,
      kpis: pick.pinned,
      evidence: {
        fit: pick.fit?.fit ?? (pick.fitFailed ? 'fallback' : 'unknown'),
        matchedQuestions: pick.recipes.filter(r => r.confidence !== 'none').length,
        totalQuestions: pick.recipes.length,
        coveredNeeds: pick.fit?.needs.filter(n => !n.gap).length ?? 0,
        totalNeeds: pick.fit?.needs.length ?? 0,
        gapCount: pick.fit?.needs.filter(n => !!n.gap).length ?? 0,
        tableCount: pick.focusTables,
        modelQuality: d.trust.qualityScore,
      },
      ...(pick.lowMatch ? { lowMatch: true } : {}),
    });
  };

  const loading = (l: string) => (
    <LoadingState title={`Reading the ${l} model from GitHub`} body="Pulling its business areas, tables, connections and KPIs from the Industry Data Models gallery." />
  );

  let body: React.ReactNode;
  if (!slug && !autoPicked) {
    body = loading('gallery');
  } else if (!slug) {
    body = catalog.data ? (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-4">
        <MiniConstellation nodes={10} size={64} />
        <p className="text-ui-lg font-semibold text-foreground">Which industry is closest to yours?</p>
        <div className="flex justify-center"><IndustryPicker catalog={catalog.data} value={slug} onChange={setSlug} /></div>
      </div>
    ) : catalog.error ? (
      <ErrorState message="The Industry Data Models gallery could not be reached." onRetry={() => window.location.reload()} onBack={onBack} />
    ) : loading('gallery');
  } else if (digest.error) {
    body = <ErrorState message={`The ${label} model could not be loaded from GitHub right now.`} onRetry={() => setAttempt(a => a + 1)} onBack={onBack} />;
  } else if (!d || digest.loading) {
    body = loading(label);
  } else {
    body = (
      <ModelExplorer
        digest={d}
        questions={questions}
        context={context}
        initial={initialChoice && initialChoice.slug === d.slug ? { areas: initialChoice.areas, kpis: initialChoice.kpis } : null}
        fitFetcher={blueprintApi.fit}
        copy={modelCopy(d.label, d.catalog)}
        onBack={onBack}
        footerStatus={<InstallChip status={status} caps={caps} onStart={startInstall} starting={starting} />}
        sourceFooter={<SourceFooter source={d.source} />}
        onFinish={finish}
      />
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-1 py-6 sm:py-10 space-y-6">
      <FadeIn className="flex items-center justify-between gap-4">
        {progress}
        <GhostButton onClick={onBack}><ArrowLeft className="w-4 h-4" /> Back</GhostButton>
      </FadeIn>

      <ExplorerHeader
        eyebrow="Industry data model"
        title="Start from a proven model"
        picker={catalog.data && slug && <IndustryPicker catalog={catalog.data} value={slug} onChange={s => { setSlug(s); setAttempt(0); }} />}
        why={!initialChoice && modelPick.slug === slug && modelPick.why && (
          <span className="inline-flex items-center gap-1.5 text-ui-sm text-muted-foreground"><Sparkles className="w-3.5 h-3.5 text-primary" /> {modelPick.why}</span>
        )}
        description={d ? d.description : 'A complete, connected industry data model your Genie can stand on: tables, connections and ready-made KPIs.'}
        pill={(d?.source ?? catalog.data?.source) && <SourcePill source={(d?.source ?? catalog.data!.source)} label={d?.label} />}
      />

      {body}
    </div>
  );
}

export default BlueprintScreen;
