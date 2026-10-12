import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Database, FileUp, FlaskConical, Info, Sparkles } from 'lucide-react';
import type { DataSource } from '../brief';
import { useBlueprintCatalog, useInstalledModels } from '../blueprint/blueprintApi';
import { pickModel, type ModelHint } from '../blueprint/industryMap';
import { MiniConstellation } from '../blueprint/MiniConstellation';
import type { ReactNode } from 'react';
import { FadeIn, GhostButton, Headline, PrimaryButton } from '../../journeykit';

type Option = { id: DataSource; icon: typeof Database | null; title: string; body: string; tag?: string; footnote?: string; slug?: string };

const OPTIONS: Option[] = [
  {
    id: 'existing', icon: Database,
    title: 'It\'s already in Databricks',
    body: 'Point Genie at tables you already have. Nothing gets moved or copied.',
  },
  {
    id: 'upload', icon: FileUp,
    title: 'I have a file',
    body: 'A spreadsheet or CSV export. Genie Code helps you bring it in.',
  },
  {
    id: 'sample', icon: FlaskConical,
    title: 'Just show me with sample data',
    body: 'Realistic made-up data shaped around your questions. Great for a first try.',
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
  const { data } = useBlueprintCatalog();
  if (!data) return null;
  const slug = pickModel(hint, data.industries);
  const match = data.industries.find(i => i.slug === slug);
  return {
    id: 'blueprint',
    icon: null,
    slug: match?.slug,
    tag: 'New',
    title: 'Start from an industry data model',
    body: match
      ? `Explore a ready-made ${match.label} model: ${match.counts.tables} connected tables and ${match.counts.kpiSets} sets of KPIs, set up with realistic sample data.`
      : `Pick from ${data.industries.length} ready-made industry models with connected tables and KPIs, set up with realistic sample data.`,
    footnote: 'From Databricks Industry Solutions · lakehouse-industry-data-models',
  };
}

export function DataScreen({ hint, value, location, progress, onChange, onLocationChange, onBack, onNext, onOpenInstalled }: DataScreenProps) {
  const blueprintOption = useBlueprintOption(hint);
  const { data: catalog } = useBlueprintCatalog();
  const installed = useInstalledModels()
    .filter(m => m.ready && m.slug)
    .map(m => ({ ...m, label: catalog?.industries.find(i => i.slug === m.slug)?.label ?? m.slug }))
    .filter(m => catalog?.industries.some(i => i.slug === m.slug));
  const options = blueprintOption ? [...OPTIONS, blueprintOption] : OPTIONS;
  const matchInstalled = !!blueprintOption?.slug && installed.some(m => m.slug === blueprintOption.slug);
  const recommended: { id: DataSource; why: string } = matchInstalled
    ? { id: 'blueprint', why: 'A matching industry model is already in your workspace, with data ready to ask questions of.' }
    : { id: 'existing', why: 'Most teams already have this data in Databricks. Nothing moves, and the answers are on real numbers.' };

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
          title="Where does your data live?"
          subtitle="No need to move anything. Your Genie works on top of the data you already have."
        />
        <p className="flex items-center gap-1.5 text-ui-xs text-muted-foreground mt-3">
          <Info className="w-3 h-3 shrink-0" /> Decides what Genie Code sets up first. You can change it later.
          <span className="hidden md:inline text-muted-foreground/70"> Press 1 to {options.length}, Enter to {value ? 'continue' : 'take the recommendation'}.</span>
        </p>
      </FadeIn>

      <div role="radiogroup" className="grid gap-3">
        {options.map((opt, i) => {
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
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Already in your workspace:
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
                        <label className="block text-ui-sm text-muted-foreground mb-1.5">Know where it is? <span className="opacity-70">(optional)</span></label>
                        <input
                          value={location}
                          onChange={e => onLocationChange(e.target.value)}
                          placeholder="e.g. main.sales or just a table name"
                          className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-transparent text-ui-md outline-none focus:border-primary/40 focus:bg-card transition-colors"
                        />
                        <p className="text-ui-xs text-muted-foreground mt-1.5">Not sure? Leave it blank and Genie Code will look for it.</p>
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
          {value === 'blueprint' ? 'Next: explore the model' : 'Next: your plan'} <ArrowRight className="w-4 h-4" />
        </PrimaryButton>
      </FadeIn>
    </div>
  );
}
