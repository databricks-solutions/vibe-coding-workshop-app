import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowUpRight, BadgeCheck, Check, ChevronDown, Database, Info, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { FadeIn, GhostButton, SecondaryButton } from '../../journeykit';
import { ErrorState, ExplorerHeader, LoadingState, ModelExplorer, type ExplorerCopy, type ExplorerPick } from '../blueprint/ModelExplorer';
import type { BlueprintDigest, SourceChoice } from '../blueprint/types';
import { sourceKey, sourcesApi, useApprovedSources, useCheckedSources, useSourceDigest, type ApprovedSource } from './sourcesApi';
import { CatalogSchemaPicker } from './CatalogSchemaPicker';
import { certifiedHint, scopeLabel, type CertifiedHint } from './certifiedScope';

interface SourceScreenProps {
  questions: string[];
  /** The idea in plain text, for matching it to areas and tables. */
  context: string;
  /** catalog.schema ids picked on the data step. */
  sources: string[];
  initialChoice: SourceChoice | null;
  /** Scan only tables tagged certified in Unity Catalog. */
  certifiedOnly: boolean;
  onCertifiedOnlyChange: (v: boolean) => void;
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
            <div className="mt-3 pt-3 border-t border-border/60 px-1">
              <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">Add another source</p>
              <CatalogSchemaPicker
                compact
                existing={value}
                onAdd={id => { if (!value.some(v => v.toLowerCase() === id.toLowerCase())) onChange([...value, id]); }}
              />
            </div>
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

function CertifiedNotice({ hint, onInclude, onBack }: { hint: CertifiedHint; onInclude: () => void; onBack?: () => void }) {
  const left = hint.uncertifiedSources.length ? ` ${hint.uncertifiedSources.join(', ')} ${hint.uncertifiedSources.length === 1 ? 'has' : 'have'} no certified tables.` : '';
  return (
    <FadeIn delay={0.08} className="flex items-start gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/[0.05] px-4 py-3">
      <Info className="w-4 h-4 mt-0.5 shrink-0 text-sky-500" />
      <div className="flex-1 min-w-0 text-ui-sm leading-relaxed">
        <p className="font-semibold text-foreground">
          {hint.empty ? 'No certified tables in these sources' : `This scan only looked at certified tables (${hint.scanned.toLocaleString()} of ${hint.total.toLocaleString()})`}
        </p>
        <p className="text-muted-foreground">
          {hint.skipped.toLocaleString()} uncertified table{hint.skipped === 1 ? ' was' : 's were'} left out and might hold what {hint.empty ? 'your questions need' : 'is missing'}.{left}{' '}
          Include them to check, or untick "Certified assets only" on the Data step.
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          <SecondaryButton onClick={onInclude}><ShieldAlert className="w-4 h-4" /> Include uncertified tables</SecondaryButton>
          {onBack && <GhostButton onClick={onBack}><ArrowLeft className="w-4 h-4" /> Back to the Data step</GhostButton>}
        </div>
      </div>
    </FadeIn>
  );
}

const sourceCopy = (d: BlueprintDigest): ExplorerCopy => ({
  noun: `your tables in ${d.label}`,
  fallback: 'This is a table-level match on names, descriptions and columns. You can adjust any area or KPI.',
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
    ...(d.scope?.certifiedOnly && d.scope.total > d.scope.scanned
      ? [`Include uncertified tables. This scan only looked at the ${d.scope.scanned.toLocaleString()} certified ones of ${d.scope.total.toLocaleString()}.`]
      : []),
    'Add another catalog and schema with the picker above. The data may live in a different schema.',
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
  const slices = k.slices.map(s => (s.column && s.column.toLowerCase() !== s.name.toLowerCase() ? `${s.column} AS ${s.name}` : s.column ?? s.name)).join(', ');
  return `${k.id} on ${table?.fqn ?? k.table}: ${measures}${slices ? `; by ${slices}` : ''}`;
}

export function SourceScreen({ questions, context, sources, initialChoice, certifiedOnly, onCertifiedOnlyChange, progress, onSourcesChange, onBack, onNext }: SourceScreenProps) {
  const { sources: approved } = useApprovedSources();
  const key = sourceKey(sources);
  const [attempt, setAttempt] = useState(0);
  const digest = useSourceDigest(key, attempt, certifiedOnly);
  const includeUncertified = () => { onCertifiedOnlyChange(false); setAttempt(0); };
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
        body={certifiedOnly
          ? 'Scanning the certified tables, their columns and how they join, then grouping them into business areas. The first look at a schema takes about 30 seconds.'
          : 'Scanning tables, columns and how they join, then grouping them into business areas. The first look at a schema takes about 30 seconds.'}
      />
    );
  } else if (!d.tables.length) {
    const hint = certifiedHint(d.scope, null);
    body = hint
      ? <CertifiedNotice hint={hint} onInclude={includeUncertified} onBack={onBack} />
      : <ErrorState message="No tables found in these sources." onRetry={() => { sourcesApi.reset(); setAttempt(a => a + 1); }} onBack={onBack} />;
  } else {
    body = (
      <ModelExplorer
        key={certifiedOnly ? 'certified' : 'all'}
        digest={d}
        questions={questions}
        context={context}
        initial={initial}
        fitFetcher={sourcesApi.fit(certifiedOnly)}
        copy={sourceCopy(d)}
        notice={m => {
          const hint = certifiedHint(d.scope, m);
          return hint && <CertifiedNotice hint={hint} onInclude={includeUncertified} />;
        }}
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
        why={d && (
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            {certified ? (
              <span className="inline-flex items-center gap-1.5 text-ui-sm text-emerald-600 dark:text-emerald-400"><ShieldCheck className="w-3.5 h-3.5" /> Approved source</span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-ui-sm text-muted-foreground"><ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Not on the approved list</span>
            )}
            {d.scope && (
              <button
                onClick={() => { onCertifiedOnlyChange(!certifiedOnly); setAttempt(0); }}
                title={certifiedOnly ? 'Only tables tagged certified in Unity Catalog are scanned. Click to include uncertified tables.' : 'Every table is scanned. Click to scan certified tables only.'}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-ui-xs font-medium transition-colors ${
                  certifiedOnly ? 'border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300 hover:border-emerald-500/60' : 'border-border bg-card text-muted-foreground hover:text-foreground'
                }`}
              >
                <BadgeCheck className="w-3.5 h-3.5" /> {scopeLabel(d.scope)}
              </button>
            )}
          </span>
        )}
        description={d ? d.description : 'The governed tables you already have, read live from Unity Catalog: business areas, connections, and how they answer your questions.'}
        pill={d && <CatalogPill digest={d} />}
      />

      {body}
    </div>
  );
}

export default SourceScreen;
