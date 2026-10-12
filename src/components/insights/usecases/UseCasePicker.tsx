import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, Database, Layers, Loader2, Search, Users, X } from 'lucide-react';
import { CertifiedBadge } from '../../CertifiedBadge';
import { collectionIcon, iconForUseCase } from '../../library/theme';
import { PrimaryButton } from '../ui';
import {
  catalogIndustryFor,
  prefetchPreview,
  SAMPLE_COLLECTION,
  useApprovedIndustries,
  useApprovedUseCases,
  useUseCaseCounts,
  useUseCasePreview,
  type ApprovedIndustry,
  type ApprovedUseCase,
  type QuestionSource,
} from './useCaseApi';

const SOURCE_NOTE: Record<QuestionSource, string> = {
  use_case_genie: 'Straight from the use case\u2019s \u201cAsk it in Genie\u201d section.',
  use_case_text: 'Quoted in the use case description.',
  suggested: 'Suggested by AI from the use case description. Edit them freely.',
  none: 'This use case has no ready-made questions yet. Add your own after picking it.',
};

const SEARCH_THRESHOLD = 6;

interface UseCasePickerProps {
  insightsIndustryId: string;
  selected: ApprovedUseCase | null;
  /** How many more questions fit. */
  room: number;
  onApply: (uc: ApprovedUseCase, questions: string[]) => void;
}

const sameUseCase = (a: ApprovedUseCase | null, b: ApprovedUseCase | null) =>
  !!a && !!b && a.useCase === b.useCase && a.industry === b.industry;

export function UseCasePicker({ insightsIndustryId, selected, room, onApply }: UseCasePickerProps) {
  const { data: industries, failed } = useApprovedIndustries();
  const counts = useUseCaseCounts(industries);
  const [industryId, setIndustryId] = useState<string | null>(null);
  const [active, setActive] = useState<ApprovedUseCase | null>(selected);
  const [query, setQuery] = useState('');
  const [certifiedOnly, setCertifiedOnly] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const tabs = useMemo(() => (industries ?? []).filter(i => counts[i.id] !== 0), [industries, counts]);

  const effectiveIndustry = useMemo<ApprovedIndustry | null>(() => {
    if (!tabs.length) return null;
    const id = industryId ?? selected?.industry ?? catalogIndustryFor(insightsIndustryId, tabs);
    return tabs.find(i => i.id === id) ?? tabs.find(i => i.id === SAMPLE_COLLECTION) ?? tabs[0];
  }, [tabs, industryId, selected, insightsIndustryId]);

  const useCases = useApprovedUseCases(effectiveIndustry);
  const hasCertified = !!useCases?.some(u => u.certified) && !!useCases?.some(u => !u.certified);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (useCases ?? []).filter(u =>
      (!certifiedOnly || u.certified) &&
      (!q || u.label.toLowerCase().includes(q) || u.category.toLowerCase().includes(q)));
  }, [useCases, query, certifiedOnly]);
  const groups = useMemo(() => groupByCategory(visible), [visible]);
  const ordered = useMemo(() => groups.flatMap(([, items]) => items), [groups]);

  const current = active && useCases?.some(u => sameUseCase(u, active)) ? active : ordered[0] ?? null;

  const switchIndustry = (id: string) => {
    setIndustryId(id);
    setActive(null);
    setQuery('');
    setCertifiedOnly(false);
  };

  const onListKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const i = ordered.findIndex(u => sameUseCase(u, current));
    const next = ordered[Math.min(Math.max(i + (e.key === 'ArrowDown' ? 1 : -1), 0), ordered.length - 1)];
    if (!next) return;
    setActive(next);
    listRef.current?.querySelector<HTMLElement>(`[data-uc="${next.industry}/${next.useCase}"]`)?.focus();
  };

  if (failed) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-5 text-ui-md text-muted-foreground">
        Approved use cases are not available right now. Write your own questions instead.
      </p>
    );
  }

  const showSearch = (useCases?.length ?? 0) > SEARCH_THRESHOLD;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Collection">
        {industries === null
          ? Array.from({ length: 4 }, (_, i) => <span key={i} className="h-9 w-28 rounded-full bg-secondary/60 animate-pulse" />)
          : tabs.map(ind => {
            const on = effectiveIndustry?.id === ind.id;
            const Icon = collectionIcon({ collection_id: ind.id, kind: ind.kind, icon: ind.icon, label: ind.label });
            const n = counts[ind.id];
            return (
              <button
                key={ind.id}
                role="tab"
                aria-selected={on}
                onClick={() => switchIndustry(ind.id)}
                className={`group h-9 inline-flex items-center gap-2 pl-3 pr-2.5 rounded-full text-ui-sm font-medium border transition-all ${
                  on ? 'bg-foreground text-background border-foreground shadow-sm' : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
                }`}
              >
                <Icon className="w-4 h-4" />
                {ind.label}
                {n !== undefined && (
                  <span className={`min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full text-[11px] tabular-nums ${
                    on ? 'bg-background/15 text-background' : 'bg-secondary text-muted-foreground group-hover:text-foreground'
                  }`}>{n}</span>
                )}
              </button>
            );
          })}
      </div>
      {effectiveIndustry?.description && <p className="text-ui-sm text-muted-foreground -mt-1">{effectiveIndustry.description}</p>}

      {(showSearch || hasCertified) && (
        <div className="flex flex-wrap items-center gap-2">
          {showSearch && (
            <label className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70 pointer-events-none" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={`Search ${useCases?.length ?? ''} ${effectiveIndustry?.label ?? ''} use cases`}
                className="w-full h-9 pl-9 pr-8 rounded-xl border border-border bg-card text-ui-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
              />
              {query && (
                <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </label>
          )}
          {hasCertified && (
            <button
              onClick={() => setCertifiedOnly(v => !v)}
              aria-pressed={certifiedOnly}
              className={`h-9 inline-flex items-center gap-1.5 pl-2 pr-3 rounded-xl border text-ui-sm font-medium transition-all ${
                certifiedOnly ? 'border-amber-400/70 bg-amber-400/10 text-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground'
              }`}
            >
              <CertifiedBadge size="sm" /> Certified only
            </button>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4 items-start">
        <div ref={listRef} onKeyDown={onListKey} className="space-y-4 md:max-h-[520px] md:overflow-y-auto pr-1 -mr-1 pb-1">
          {useCases === null
            ? Array.from({ length: 5 }, (_, i) => <div key={i} className="h-[60px] rounded-xl bg-secondary/50 animate-pulse" />)
            : useCases.length === 0
              ? <p className="text-ui-md text-muted-foreground">Nothing in this collection yet.</p>
              : visible.length === 0
                ? (
                  <div className="rounded-xl border border-dashed border-border p-5 text-center space-y-2">
                    <p className="text-ui-md text-muted-foreground">No use cases match{query ? ` \u201c${query.trim()}\u201d` : ''}.</p>
                    <button onClick={() => { setQuery(''); setCertifiedOnly(false); }} className="text-ui-sm font-medium text-primary hover:underline">Show all</button>
                  </div>
                )
                : groups.map(([category, items]) => (
                  <div key={category || 'all'} className="space-y-1.5">
                    {category && (
                      <p className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80 px-1">
                        {category} <span className="tabular-nums font-medium tracking-normal">{items.length}</span>
                      </p>
                    )}
                    {items.map(uc => {
                      const on = sameUseCase(uc, current);
                      const applied = sameUseCase(uc, selected);
                      const crossListed = effectiveIndustry && uc.industry !== effectiveIndustry.id;
                      const Icon = iconForUseCase({ use_case: uc.useCase, use_case_label: uc.label }, Layers);
                      return (
                        <button
                          key={`${uc.industry}/${uc.useCase}`}
                          data-uc={`${uc.industry}/${uc.useCase}`}
                          onClick={() => setActive(uc)}
                          onMouseEnter={() => prefetchPreview(uc)}
                          onFocus={() => prefetchPreview(uc)}
                          aria-pressed={on}
                          className={`group w-full flex items-center gap-3 text-left rounded-xl border px-3 py-2.5 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                            on ? 'border-primary/60 bg-primary/[0.06] shadow-sm' : 'border-border bg-card hover:border-foreground/25 hover:bg-secondary/30'
                          }`}
                        >
                          <span className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 transition-colors ${on ? 'bg-primary/15 text-primary' : 'bg-secondary/70 text-muted-foreground group-hover:text-foreground'}`}>
                            <Icon className="w-[18px] h-[18px]" />
                          </span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-ui-md font-medium text-foreground truncate">{uc.label}</span>
                            {(applied || crossListed) && (
                              <span className="block text-ui-xs truncate">
                                {applied && <span className="text-primary font-medium">In use</span>}
                                {applied && crossListed && <span className="text-muted-foreground"> · </span>}
                                {crossListed && <span className="text-muted-foreground">From {uc.industryLabel}</span>}
                              </span>
                            )}
                          </span>
                          {uc.certified && <CertifiedBadge size="sm" />}
                          <ArrowRight className={`w-4 h-4 shrink-0 transition-all ${on ? 'text-primary translate-x-0.5' : 'text-muted-foreground/30 group-hover:text-muted-foreground'}`} />
                        </button>
                      );
                    })}
                  </div>
                ))}
        </div>

        <div className="md:sticky md:top-4">
          <AnimatePresence mode="wait" initial={false}>
            {current ? (
              <motion.div key={`${current.industry}/${current.useCase}`} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
                <PreviewPanel uc={current} room={room} onApply={onApply} />
              </motion.div>
            ) : useCases === null ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="hidden md:block rounded-2xl border border-border bg-card p-5 space-y-3 min-h-[300px]">
                <div className="h-3 w-24 rounded bg-secondary/70 animate-pulse" />
                <div className="h-6 w-2/3 rounded bg-secondary/70 animate-pulse" />
                <div className="h-16 rounded bg-secondary/50 animate-pulse" />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function PreviewPanel({ uc, room, onApply }: { uc: ApprovedUseCase; room: number; onApply: (uc: ApprovedUseCase, q: string[]) => void }) {
  const { data, failed } = useUseCasePreview(uc);
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const chosen = (data?.questions ?? []).filter(q => !unchecked.has(q)).slice(0, Math.max(room, 0));
  const toggle = (q: string) => setUnchecked(prev => {
    const next = new Set(prev);
    if (next.has(q)) next.delete(q); else next.add(q);
    return next;
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{uc.industryLabel}{uc.category ? ` \u00b7 ${uc.category}` : ''}</p>
          <h3 className="text-ui-xl font-semibold text-foreground leading-snug mt-0.5">{uc.label}</h3>
        </div>
        {uc.certified && <CertifiedBadge withLabel />}
      </div>

      {!data && !failed && (
        <div className="space-y-3 py-1" aria-busy="true">
          <div className="flex items-center gap-2 text-ui-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Reading the use case</div>
          <div className="h-3 rounded bg-secondary/60 animate-pulse" />
          <div className="h-3 w-5/6 rounded bg-secondary/60 animate-pulse" />
          <div className="flex gap-1.5 pt-1">{Array.from({ length: 3 }, (_, i) => <span key={i} className="h-7 w-24 rounded-full bg-secondary/60 animate-pulse" />)}</div>
        </div>
      )}
      {failed && <p className="text-ui-sm text-muted-foreground">This use case could not be read right now. Try another, or write your own questions.</p>}

      {data && (
        <>
          {data.summary && <p className="text-ui-md text-foreground/85 leading-relaxed">{data.summary}</p>}

          {data.personas.length > 0 && (
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-ui-xs font-semibold uppercase tracking-wide text-muted-foreground"><Users className="w-3.5 h-3.5" /> Who it is for</p>
              <div className="flex flex-wrap gap-1.5">
                {data.personas.map(p => (
                  <span key={p.name} title={p.role} className="h-7 inline-flex items-center px-2.5 rounded-full bg-secondary/70 text-ui-sm text-foreground">{p.name}</span>
                ))}
              </div>
            </div>
          )}

          {data.entities.length > 0 && (
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-ui-xs font-semibold uppercase tracking-wide text-muted-foreground"><Database className="w-3.5 h-3.5" /> Data it covers</p>
              <div className="flex flex-wrap gap-1.5">
                {data.entities.map(e => (
                  <span key={e} className="h-6 inline-flex items-center px-2 rounded-md border border-border text-ui-xs text-muted-foreground">{e}</span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-ui-xs font-semibold uppercase tracking-wide text-muted-foreground">Questions it was built to answer</p>
            {data.questions.length === 0 ? (
              <p className="text-ui-sm text-muted-foreground">{SOURCE_NOTE.none}</p>
            ) : (
              <ul className="space-y-1.5">
                {data.questions.map(q => {
                  const on = !unchecked.has(q);
                  return (
                    <li key={q}>
                      <button
                        onClick={() => toggle(q)}
                        aria-pressed={on}
                        className={`w-full flex items-start gap-2.5 text-left rounded-xl px-3 py-2 transition-colors ${on ? 'bg-primary/[0.06]' : 'hover:bg-secondary/50'}`}
                      >
                        <span className={`mt-0.5 flex items-center justify-center w-4 h-4 rounded border shrink-0 transition-colors ${on ? 'bg-primary border-primary text-primary-foreground' : 'border-border'}`}>
                          {on && <Check className="w-3 h-3" strokeWidth={3} />}
                        </span>
                        <span className={`text-ui-md ${on ? 'text-foreground' : 'text-muted-foreground line-through decoration-muted-foreground/40'}`}>{q}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {data.questions.length > 0 && (
              <p className={`text-ui-xs ${data.questionSource === 'suggested' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>{SOURCE_NOTE[data.questionSource]}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <p className="text-ui-xs text-muted-foreground">
              {room <= 0 ? 'Your question list is full. Remove one to add more.' : 'Your project will be linked to this approved use case.'}
            </p>
            <PrimaryButton onClick={() => onApply(uc, chosen)} disabled={!data}>
              {chosen.length ? `Use ${chosen.length} question${chosen.length === 1 ? '' : 's'}` : 'Use this use case'} <ArrowRight className="w-4 h-4" />
            </PrimaryButton>
          </div>
        </>
      )}
    </div>
  );
}

function groupByCategory(list: ApprovedUseCase[]): [string, ApprovedUseCase[]][] {
  const map = new Map<string, ApprovedUseCase[]>();
  for (const uc of list) {
    const k = uc.category || '';
    map.set(k, [...(map.get(k) ?? []), uc]);
  }
  return Array.from(map.entries()).map(([k, items]) => [k, [...items].sort((a, b) => Number(b.certified) - Number(a.certified))]);
}
