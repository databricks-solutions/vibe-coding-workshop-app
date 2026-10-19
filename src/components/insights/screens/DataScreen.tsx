import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Database, FileUp, FlaskConical, Info, Loader2, Plus, ShieldCheck, Sparkles, TriangleAlert, X } from 'lucide-react';
import type { DataSource } from '../brief';
import { useBlueprintCatalog, useInstalledModels } from '../blueprint/blueprintApi';
import type { ModelHint } from '../blueprint/industryMap';
import { useModelPick } from '../blueprint/useModelPick';
import { MiniConstellation } from '../blueprint/MiniConstellation';
import {
  addToLocation, isSourceId, locationEntries, matchTables, removeFromLocation, sourcesIn, useApprovedSources, useCheckedSources,
  type ApprovedSource, type CheckedSource,
} from '../sources/sourcesApi';
import type { ReactNode } from 'react';
import { FadeIn, GhostButton, Headline, PrimaryButton } from '../../journeykit';

type Option = { id: DataSource; icon: typeof Database | null; title: string; body: string; tag?: string; footnote?: string; slug?: string };

const OPTIONS: Option[] = [
  {
    id: 'existing', icon: Database,
    title: 'Already in Databricks',
    body: 'Point Genie at tables you already have. Nothing gets moved or copied.',
  },
  {
    id: 'upload', icon: FileUp,
    title: 'I have a schema definition file',
    body: 'Upload a metadata CSV that defines your tables and columns. Genie Code will propose matching sample data.',
  },
  {
    id: 'sample', icon: FlaskConical,
    title: 'Generate synthetic sample data',
    body: 'Create realistic sample data from your idea and questions, without an existing schema.',
  },
];

interface DataScreenProps {
  hint: ModelHint;
  value: DataSource | null;
  location: string;
  progress?: ReactNode;
  onChange: (v: DataSource) => void;
  onLocationChange: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  onOpenInstalled?: (slug: string) => void;
}

function useBlueprintOption(hint: ModelHint): Option | null {
  const { data, loading } = useBlueprintCatalog();
  const pick = useModelPick(hint);
  if (!data) {
    return loading ? {
      id: 'blueprint',
      icon: null,
      tag: 'New',
      title: 'Start from an industry data model',
      body: 'Loading the ready-made industry models that best fit your idea…',
      footnote: 'From Databricks Industry Solutions · lakehouse-industry-data-models',
    } : null;
  }
  const match = data.industries.find(i => i.slug === pick.slug);
  const size = match ? ` ${match.counts.tables} connected tables and ${match.counts.kpiSets} sets of KPIs, set up with realistic sample data.` : '';
  return {
    id: 'blueprint',
    icon: null,
    slug: match?.slug,
    tag: 'New',
    title: 'Start from an industry data model',
    body: match
      ? `Best fit for your idea: the ${match.label} model.${pick.why ? ` ${pick.why}` : ''}${size}`
      : pick.loading
        ? 'Finding the closest of the ready-made industry models for your idea…'
        : `Pick from ${data.industries.length} ready-made industry models with connected tables and KPIs, set up with realistic sample data.`,
    footnote: 'From Databricks Industry Solutions · lakehouse-industry-data-models',
  };
}

function SourceChip({ source: s, tables, on, added, onToggle, onRemove }: {
  source: ApprovedSource | CheckedSource;
  tables: string[];
  on: boolean;
  added?: boolean;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  const loading = 'loading' in s && s.loading;
  const failed = !loading && !s.readable;
  return (
    <div className={`relative rounded-xl border transition-colors ${on ? 'border-primary/60 bg-primary/[0.06]' : 'border-border bg-card hover:border-foreground/25'}`}>
      <button onClick={onToggle} aria-pressed={on} title={s.note || s.id} className="w-full text-left px-3 py-2.5">
        <span className="flex items-center gap-2 pr-5">
          <span className={`flex items-center justify-center w-4 h-4 rounded border shrink-0 ${on ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>
            {on && <Check className="w-3 h-3" strokeWidth={3} />}
          </span>
          <span className={`text-ui-sm font-semibold text-foreground truncate ${added ? 'font-mono' : ''}`}>{s.label}</span>
          {added && <span className="px-1.5 rounded bg-secondary text-[11px] font-medium text-muted-foreground shrink-0">Your source</span>}
          <span className="ml-auto text-ui-xs text-muted-foreground tabular-nums shrink-0">
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : failed ? 'no access' : `${s.tableCount} tables`}
          </span>
        </span>
        {!added && <span className="block font-mono text-ui-xs text-muted-foreground mt-0.5 pl-6">{s.id}</span>}
        {loading ? (
          <span className="block text-ui-xs text-muted-foreground mt-1 pl-6">Scanning its tables…</span>
        ) : failed ? (
          <span className="flex items-start gap-1 text-ui-xs text-amber-600 dark:text-amber-400 mt-1 pl-6">
            <TriangleAlert className="w-3 h-3 mt-0.5 shrink-0" />
            <span>The app can't read this schema. Check the name, or grant the app's service principal USE CATALOG, USE SCHEMA and SELECT.</span>
          </span>
        ) : tables.length > 0 ? (
          <span className="block text-ui-xs text-primary/90 mt-1 pl-6">Matches your questions: {tables.join(', ')}</span>
        ) : (
          <span className="block text-ui-xs text-muted-foreground/80 mt-1 pl-6">No obvious table matches. Explore to let the AI check.</span>
        )}
      </button>
      {onRemove && (
        <button onClick={onRemove} title="Remove" aria-label={`Remove ${s.id}`} className="absolute top-2 right-2 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export function DataScreen({ hint, value, location, progress, onChange, onLocationChange, onBack, onNext, onOpenInstalled }: DataScreenProps) {
  const blueprintOption = useBlueprintOption(hint);
  const { data: catalog, loading: catalogLoading } = useBlueprintCatalog();
  // Only the model that fits this idea; other installed models are a distraction here.
  const installed = useInstalledModels()
    .filter(m => m.ready && m.slug && m.slug === blueprintOption?.slug)
    .map(m => ({ ...m, label: catalog?.industries.find(i => i.slug === m.slug)?.label ?? m.slug }));
  const options = blueprintOption ? [OPTIONS[0], blueprintOption, ...OPTIONS.slice(1)] : OPTIONS;
  const matchInstalled = installed.length > 0;
  const { sources: approved } = useApprovedSources();
  const picked = locationEntries(location);
  const addedIds = picked.filter(p => isSourceId(p) && !approved.some(a => a.id.toLowerCase() === p.toLowerCase()));
  const hints = picked.filter(p => !isSourceId(p));
  const added = useCheckedSources(addedIds);
  const [draft, setDraft] = useState('');
  const matches = approved.filter(s => s.readable).map(s => ({ source: s, tables: matchTables(s, hint.text ?? '') }));
  const addedMatches = added.map(s => ({ source: s, tables: s.readable ? matchTables(s, hint.text ?? '') : [] }));
  const bestMatch = [...matches, ...addedMatches].sort((a, b) => b.tables.length - a.tables.length)[0];
  const strongApproved = !!bestMatch && bestMatch.tables.length >= 3;
  const recommended: { id: DataSource; why: string } = strongApproved
    ? { id: 'existing', why: `${addedIds.includes(bestMatch.source.id) ? 'Tables' : 'Approved tables'} in ${bestMatch.source.label} match your idea: ${bestMatch.tables.join(', ')}.` }
    : matchInstalled
      ? { id: 'blueprint', why: 'A matching industry model is already in your workspace, with data ready to ask questions of.' }
      : { id: 'existing', why: 'Most teams already have this data in Databricks. Nothing moves, and the answers are on real numbers.' };
  const toggleSource = (id: string) => onLocationChange(picked.includes(id) ? removeFromLocation(location, id) : addToLocation(location, id));
  const addDraft = () => {
    if (!draft.trim()) return;
    onLocationChange(addToLocation(location, draft));
    setDraft('');
  };
  const explorable = value === 'existing' && sourcesIn(location).length > 0;

  useEffect(() => {
    if (!catalogLoading && !blueprintOption && value === 'blueprint') onChange('existing');
  }, [blueprintOption, catalogLoading, onChange, value]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if ((t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)) || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) onChange(options[n - 1].id);
      else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        if (value) onNext();
        else onChange(recommended.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="max-w-4xl mx-auto px-1 py-6 sm:py-10 space-y-8">
      <FadeIn className="flex items-center justify-between gap-4">
        {progress}
        <GhostButton onClick={onBack}><ArrowLeft className="w-4 h-4" /> Back</GhostButton>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Headline
          title="How should your Genie start with data?"
          subtitle="Use governed tables, a ready-made model, your schema definition, or idea-grounded synthetic data."
        />
        <p className="flex items-center gap-1.5 text-ui-xs text-muted-foreground mt-3">
          <Info className="w-3 h-3 shrink-0" /> Decides what Genie Code sets up first. You can change it later.
          <span className="hidden md:inline text-muted-foreground/70"> Press 1 to {options.length}, Enter to {value ? 'continue' : 'take the recommendation'}.</span>
        </p>
      </FadeIn>

      <div role="radiogroup" className="grid gap-3">
        {catalogLoading ? (
          <div className="grid gap-3" aria-label="Loading data choices">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-[106px] rounded-2xl border border-border bg-card animate-pulse" />
            ))}
          </div>
        ) : options.map((opt, i) => {
          const selected = value === opt.id;
          const isRec = opt.id === recommended.id;
          const Icon = opt.icon;
          return (
            <FadeIn key={opt.id} delay={0.1 + i * 0.05}>
              <div
                className={`rounded-2xl border bg-card transition-all ${
                  selected ? 'border-primary/60 ring-4 ring-primary/10 shadow-sm' : isRec ? 'border-primary/35 ring-1 ring-primary/10 hover:border-primary/55' : 'border-border hover:border-foreground/25'
                }`}
              >
                <button
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange(opt.id)}
                  className="w-full flex items-start gap-4 p-5 text-left"
                >
                  <span className={`flex items-center justify-center w-11 h-11 rounded-xl shrink-0 transition-colors ${selected ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                    {Icon ? <Icon className="w-5 h-5" /> : <MiniConstellation nodes={8} size={30} active={selected} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-ui-lg font-semibold text-foreground">{opt.title}</span>
                      {isRec ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-ui-xs font-medium">
                          <Sparkles className="w-3 h-3" /> Recommended
                        </span>
                      ) : opt.tag && (
                        <span className={`px-2 py-0.5 rounded-full text-ui-xs font-medium ${opt.id === 'blueprint' ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>{opt.tag}</span>
                      )}
                      <kbd className="hidden md:flex ml-auto w-6 h-6 rounded-md bg-secondary text-ui-2xs font-semibold text-muted-foreground items-center justify-center">{i + 1}</kbd>
                    </span>
                    <span className="block text-ui-md text-muted-foreground mt-1">{opt.body}</span>
                    {isRec && <span className="block text-ui-xs text-primary/90 mt-1.5">{recommended.why}</span>}
                    {opt.footnote && <span className="block text-ui-xs text-muted-foreground/80 mt-1.5">{opt.footnote}</span>}
                  </span>
                  <span className={`mt-1 flex items-center justify-center w-6 h-6 rounded-full border-2 shrink-0 transition-all ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>
                    {selected && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                  </span>
                </button>
                {opt.id === 'blueprint' && installed.length > 0 && onOpenInstalled && (
                  <div className="flex flex-wrap items-center gap-1.5 px-5 pb-4 pl-[4.75rem] -mt-1">
                    <span className="flex items-center gap-1.5 text-ui-xs font-medium text-muted-foreground mr-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Already in your workspace, ready to explore:
                    </span>
                    {installed.map(m => (
                      <button
                        key={m.catalog}
                        onClick={() => onOpenInstalled(m.slug)}
                        title={`Open the ${m.label} model, installed as ${m.catalog}`}
                        className="h-7 inline-flex items-center gap-1 px-2.5 rounded-full border border-emerald-500/30 bg-emerald-500/[0.06] text-ui-xs font-medium text-foreground hover:border-emerald-500/60 transition-colors"
                      >
                        {m.label} <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                )}
                <AnimatePresence initial={false}>
                  {selected && opt.id === 'existing' && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-5 pb-5 pl-[4.75rem]">
                        {matches.length > 0 && (
                          <div className="mb-4 space-y-2">
                            <p className="flex items-center gap-1.5 text-ui-sm text-muted-foreground">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> Approved sources
                              <span className="opacity-70">· pick one or more to explore its tables</span>
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {matches.map(({ source: s, tables }) => (
                                <SourceChip key={s.id} source={s} tables={tables} on={picked.includes(s.id)} onToggle={() => toggleSource(s.id)} />
                              ))}
                            </div>
                          </div>
                        )}
                        {addedMatches.length > 0 && (
                          <div className="mb-4 space-y-2">
                            <p className="text-ui-sm text-muted-foreground">Your sources <span className="opacity-70">· scanned for this idea, not on the approved list</span></p>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {addedMatches.map(({ source: s, tables }) => (
                                <SourceChip
                                  key={s.id}
                                  source={s}
                                  tables={tables}
                                  on
                                  added
                                  onToggle={() => toggleSource(s.id)}
                                  onRemove={() => onLocationChange(removeFromLocation(location, s.id))}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        <label htmlFor="data-add-source" className="block text-ui-sm text-muted-foreground mb-1.5">
                          {matches.length ? 'Add another catalog.schema' : 'Know where it is?'} <span className="opacity-70">(optional)</span>
                        </label>
                        <div className="flex gap-2">
                          <input
                            id="data-add-source"
                            value={draft}
                            onChange={e => setDraft(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); addDraft(); } }}
                            placeholder="e.g. main.sales or just a table name"
                            className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-secondary/50 border border-transparent text-ui-md outline-none focus:border-primary/40 focus:bg-card transition-colors"
                          />
                          <GhostButton onClick={addDraft} disabled={!draft.trim()} className="h-10 border border-border">
                            <Plus className="w-4 h-4" /> {isSourceId(draft) ? 'Add and scan' : 'Add'}
                          </GhostButton>
                        </div>
                        {hints.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {hints.map(h => (
                              <span key={h} className="inline-flex items-center gap-1 h-7 pl-2.5 pr-1 rounded-full border border-border bg-card text-ui-xs text-foreground/85">
                                {h}
                                <button onClick={() => onLocationChange(removeFromLocation(location, h))} aria-label={`Remove ${h}`} className="p-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary">
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        <p className="text-ui-xs text-muted-foreground mt-1.5">
                          {explorable
                            ? 'Next, you will see how these tables connect and answer your questions.'
                            : 'Not sure? Leave it blank and Genie Code will look for it. Add a catalog.schema to scan it and explore its tables first.'}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </FadeIn>
          );
        })}
      </div>

      <FadeIn delay={0.3} className="flex justify-end pt-2">
        <PrimaryButton size="lg" disabled={!value} onClick={onNext}>
          {value === 'blueprint' ? 'Next: explore the model' : explorable ? 'Next: explore your tables' : 'Next: your plan'} <ArrowRight className="w-4 h-4" />
        </PrimaryButton>
      </FadeIn>
    </div>
  );
}
