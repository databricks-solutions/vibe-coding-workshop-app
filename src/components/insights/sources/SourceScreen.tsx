import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowUpRight, Check, ChevronDown, Database, Loader2, Plus, ShieldAlert, ShieldCheck } from 'lucide-react';
import { FadeIn, GhostButton } from '../../journeykit';
import { ErrorState, ExplorerHeader, LoadingState, ModelExplorer, type ExplorerCopy, type ExplorerPick } from '../blueprint/ModelExplorer';
import type { BlueprintDigest, SourceChoice } from '../blueprint/types';
import { isSourceId, sourceKey, sourcesApi, useApprovedSources, useCheckedSources, useSourceDigest, type ApprovedSource } from './sourcesApi';

interface SourceScreenProps {
  questions: string[];
  /** The idea in plain text, for matching it to areas and tables. */
  context: string;
  /** catalog.schema ids picked on the data step. */
  sources: string[];
  initialChoice: SourceChoice | null;
  progress?: ReactNode;
  onSourcesChange: (sources: string[]) => void;
  onBack: () => void;
  onNext: (choice: SourceChoice) => void;
}

function SourcePicker({ approved, value, onChange }: { approved: ApprovedSource[]; value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
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
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState('');
  const typed = value.filter(v => !approved.some(a => a.id === v));
  const checked = useCheckedSources(typed);
  const labelOf = (id: string) => approved.find(a => a.id === id)?.label ?? id;
  const toggle = (id: string) => {
    const next = value.includes(id) ? value.filter(v => v !== id) : [...value, id];
    if (next.length) onChange(next);
  };
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 h-9 pl-3 pr-2.5 rounded-xl border border-border bg-card text-ui-md font-semibold text-foreground hover:border-foreground/30 transition-colors"
      >
        {value.length === 1 ? labelOf(value[0]) : `${value.length} sources`} <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-40 left-0 mt-2 w-[min(92vw,440px)] max-h-[60vh] overflow-auto rounded-2xl border border-border bg-card shadow-xl p-3"
          >
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Approved sources</p>
            {approved.map(a => (
              <button
                key={a.id}
                onClick={() => toggle(a.id)}
                disabled={!a.readable}
                title={a.readable ? a.note || a.id : a.error}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-ui-sm transition-colors disabled:opacity-50 ${value.includes(a.id) ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-secondary/60'}`}
              >
                <span className={`flex items-center justify-center w-4 h-4 rounded border shrink-0 ${value.includes(a.id) ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>
                  {value.includes(a.id) && <Check className="w-3 h-3" strokeWidth={3} />}
                </span>
                <span className="flex-1 min-w-0 truncate">{a.label}</span>
                <span className="font-mono text-ui-xs text-muted-foreground">{a.id}</span>
                <span className="text-ui-xs text-muted-foreground tabular-nums">{a.readable ? `${a.tableCount} tables` : 'no access'}</span>
              </button>
            ))}
            {typed.length > 0 && (
              <>
                <p className="px-2 pt-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">Your sources</p>
                {checked.map(s => (
                  <button key={s.id} onClick={() => toggle(s.id)} title={s.error || s.id} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-ui-sm bg-primary/10 text-primary font-medium">
                    <span className="flex items-center justify-center w-4 h-4 rounded border border-primary bg-primary text-primary-foreground shrink-0"><Check className="w-3 h-3" strokeWidth={3} /></span>
                    <span className="flex-1 font-mono truncate">{s.id}</span>
                    <span className="text-ui-xs text-muted-foreground font-normal tabular-nums">
                      {s.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : s.readable ? `${s.tableCount} tables` : 'no access'}
                    </span>
                  </button>
                ))}
              </>
            )}
            <form
              onSubmit={e => {
                e.preventDefault();
                const id = draft.trim();
                if (!isSourceId(id)) { setDraftError('Use catalog.schema, for example main.sales.'); return; }
                if (!value.some(v => v.toLowerCase() === id.toLowerCase())) onChange([...value, id]);
                setDraft('');
                setDraftError('');
              }}
              className="mt-3 pt-3 border-t border-border/60 px-1"
            >
              <label htmlFor="source-picker-add" className="block px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">Add a catalog.schema</label>
              <div className="flex gap-2">
                <input
                  id="source-picker-add"
                  value={draft}
                  onChange={e => { setDraft(e.target.value); setDraftError(''); }}
                  placeholder="e.g. main.sales"
                  className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-secondary/50 border border-transparent font-mono text-ui-sm outline-none focus:border-primary/40 focus:bg-card transition-colors"
                />
                <button type="submit" disabled={!draft.trim()} className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-border text-ui-sm font-medium text-foreground hover:border-foreground/30 disabled:opacity-40">
                  <Plus className="w-3.5 h-3.5" /> Add and scan
                </button>
              </div>
              {draftError && <p className="px-1 pt-1.5 text-ui-xs text-amber-600 dark:text-amber-400">{draftError}</p>}
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CatalogPill({ digest }: { digest: BlueprintDigest }) {
  return (
    <a
      href={digest.source.repoUrl || undefined}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 h-7 pl-2 pr-2.5 rounded-full border border-border bg-card text-ui-xs text-muted-foreground hover:text-foreground hover:border-foreground/25 transition-colors max-w-full"
    >
      <Database className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate min-w-0">Unity Catalog</span>
      <span className="shrink-0 font-mono text-[11px] px-1.5 rounded bg-secondary text-foreground/80">{(digest.sources ?? []).join(', ')}</span>
      {digest.source.repoUrl && <ArrowUpRight className="w-3 h-3 shrink-0 opacity-60" />}
    </a>
  );
}

const sourceCopy = (d: BlueprintDigest): ExplorerCopy => ({
  noun: `your tables in ${d.label}`,
  fallback: 'The deeper match was unavailable, so this is a keyword match on your tables. You can adjust any area or KPI.',
  answersIntro: `How the tables in ${d.label} would answer each of your questions, using KPIs that exist or that Genie Code would create.`,
  uncovered: (n, total) => ({
    title: `${n} of your ${total} questions aren't covered by these tables`,
    body: 'Your Genie answers from the tables you pick, so they should hold the data your idea is about. Add another approved source above, or keep these and Genie Code will flag what is missing.',
  }),
  diagramNote: <>How the tables in each business area connect, read live from <span className="font-mono text-foreground/80">{(d.sources ?? []).join(', ')}</span>. Joins come from declared keys, or from matching id columns.</>,
  inSource: 'in these tables',
  gapNote: 'Genie Code will flag these gaps; bring the missing data into an approved schema to cover them.',
  trustNote: 'Live from Unity Catalog. Real tables and rows.',
  finishLabel: 'Use these tables',
  lowMatchTips: [
    'Add another catalog.schema with the picker above. The data may live in a different schema.',
    'Check whether an industry data model fits better: go back and pick "Start from an industry data model".',
    "Start from synthetic data or a schema definition file if the real tables don't exist yet.",
  ],
});

/** "booking_revenue on samples.x.bookings: SUM(total_amount) AS total_revenue; by check_in, status" */
function proposedLine(d: BlueprintDigest, kpiId: string): string | null {
  const k = d.kpis.find(x => x.id === kpiId);
  if (!k?.proposed) return null;
  const table = d.tables.find(t => t.id === k.table);
  const measures = k.measures.map(m => `${m.expr ?? m.name} AS ${m.name}`).join(', ');
  const slices = k.slices.map(s => s.column ?? s.name).join(', ');
  return `${k.id} on ${table?.fqn ?? k.table}: ${measures}${slices ? `; by ${slices}` : ''}`;
}

export function SourceScreen({ questions, context, sources, initialChoice, progress, onSourcesChange, onBack, onNext }: SourceScreenProps) {
  const { sources: approved } = useApprovedSources();
  const key = sourceKey(sources);
  const [attempt, setAttempt] = useState(0);
  const digest = useSourceDigest(key, attempt);
  const d = digest.data;
  const initial = initialChoice && d && sourceKey(initialChoice.sources) === key ? { areas: initialChoice.areas, kpis: initialChoice.kpis } : null;

  const finish = (pick: ExplorerPick) => {
    if (!d) return;
    const tables = d.tables.filter(t => pick.focus.includes(t.area)).map(t => t.fqn ?? t.name);
    onNext({
      sources: d.sources ?? sources,
      label: d.label,
      certified: !!d.trust.certified,
      areas: pick.focus,
      tables,
      kpis: pick.pinned,
      proposed: pick.pinned.map(id => proposedLine(d, id)).filter((l): l is string => !!l),
      evidence: {
        fit: pick.fit?.fit ?? (pick.fitFailed ? 'fallback' : 'unknown'),
        matchedQuestions: pick.answered,
        totalQuestions: pick.recipes.length,
      },
      ...(pick.lowMatch ? { lowMatch: true } : {}),
    });
  };

  let body: ReactNode;
  if (!key) {
    body = <ErrorState message="Pick at least one catalog.schema to explore." onRetry={() => setAttempt(a => a + 1)} onBack={onBack} />;
  } else if (digest.error) {
    body = <ErrorState message={digest.error} onRetry={() => { sourcesApi.reset(); setAttempt(a => a + 1); }} onBack={onBack} />;
  } else if (!d || digest.loading) {
    body = (
      <LoadingState
        title="Reading your tables from Unity Catalog"
        body="Scanning tables, columns and how they join, then grouping them into business areas. The first look at a schema takes about 30 seconds."
      />
    );
  } else {
    body = (
      <ModelExplorer
        digest={d}
        questions={questions}
        context={context}
        initial={initial}
        fitFetcher={sourcesApi.fit}
        copy={sourceCopy(d)}
        onBack={onBack}
        footerStatus={(
          <span className="inline-flex items-center gap-1.5 text-ui-xs text-emerald-500 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live in your workspace <span className="font-mono text-muted-foreground font-normal">{(d.sources ?? []).join(', ')}</span>
          </span>
        )}
        sourceFooter={(
          <p className="text-ui-xs text-muted-foreground text-center leading-relaxed">
            Tables read from Unity Catalog with the app's permissions. Business areas and proposed KPIs are suggested by AI from real table and column names.
          </p>
        )}
        onFinish={finish}
      />
    );
  }

  const certified = d?.trust.certified;
  return (
    <div className="max-w-5xl mx-auto px-1 py-6 sm:py-10 space-y-6">
      <FadeIn className="flex items-center justify-between gap-4">
        {progress}
        <GhostButton onClick={onBack}><ArrowLeft className="w-4 h-4" /> Back</GhostButton>
      </FadeIn>

      <ExplorerHeader
        eyebrow="Your governed data"
        title="Explore your tables"
        picker={<SourcePicker approved={approved} value={sources} onChange={s => { onSourcesChange(s); setAttempt(0); }} />}
        why={d && (certified ? (
          <span className="inline-flex items-center gap-1.5 text-ui-sm text-emerald-600 dark:text-emerald-400"><ShieldCheck className="w-3.5 h-3.5" /> Certified source</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-ui-sm text-muted-foreground"><ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Not on the approved list</span>
        ))}
        description={d ? d.description : 'The governed tables you already have, read live from Unity Catalog: business areas, connections, and how they answer your questions.'}
        pill={d && <CatalogPill digest={d} />}
      />

      {body}
    </div>
  );
}

export default SourceScreen;
