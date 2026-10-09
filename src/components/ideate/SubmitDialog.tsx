import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2, Send, X } from 'lucide-react';
import { apiClient, type SelectOption } from '../../api/client';
import { useIdeas } from '../../hooks/useIdeas';
import { buildContext, caseFigures, placedLeaf } from './ideaContext';
import { figuresAsContext } from './businessCase';
import type { Idea } from './types';

const NEW = '__new__';

/** Hands a committed idea to the use case catalog as an inactive entry. */
export function SubmitDialog({ idea, onClose }: { idea: Idea; onClose: () => void }) {
  const { updateIdea } = useIdeas();
  const [industries, setIndustries] = useState<SelectOption[] | null>(null);
  const [industry, setIndustry] = useState('');
  const [newIndustry, setNewIndustry] = useState(idea.spark?.industry || idea.industry || '');
  const [name, setName] = useState(idea.catalogRef?.useCaseLabel || idea.title);
  const [category, setCategory] = useState(placedLeaf(idea)?.branch ?? '');
  const [categories, setCategories] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [initial] = useState(() => ({
    preferred: idea.catalogRef?.industry ?? idea.spark?.catalogIndustry ?? '',
    segment: (idea.spark?.industry ?? '').toLowerCase(),
    submitted: idea.catalogRef ? { value: idea.catalogRef.industry, label: idea.catalogRef.industryLabel } : null,
  }));

  useEffect(() => {
    apiClient.getIndustries()
      .then(list => {
        const real = list.filter(i => i.value && i.value !== 'sample');
        // A brand-new industry stays inactive until reviewed, so it isn't in the live list yet.
        if (initial.submitted && !real.some(i => i.value === initial.submitted!.value)) real.push(initial.submitted);
        setIndustries(real);
        const byLabel = real.find(i => i.label.toLowerCase() === initial.segment)?.value;
        setIndustry(real.some(i => i.value === initial.preferred) ? initial.preferred : byLabel ?? NEW);
      })
      .catch(() => { setIndustries([]); setIndustry(NEW); });
  }, [initial]);

  useEffect(() => {
    if (!industry || industry === NEW) { setCategories([]); return; }
    apiClient.getUseCases(industry)
      .then(list => setCategories([...new Set(list.map(u => u.category).filter((c): c is string => !!c))]))
      .catch(() => setCategories([]));
  }, [industry]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const industryLabel = industry === NEW ? newIndustry.trim() : industries?.find(i => i.value === industry)?.label ?? '';
  const ready = !!industryLabel && !!name.trim() && !busy;
  const resubmit = !!idea.catalogRef && idea.catalogRef.industry === industry;
  const chips = useMemo(() => [...new Set([placedLeaf(idea)?.branch, ...categories].filter((c): c is string => !!c))], [categories, idea]);

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const figures = caseFigures(idea);
      const r = await apiClient.ideateSubmit({
        idea: buildContext(idea, 'brief'),
        business_case: figures ? { scope: idea.impact?.scope, ...figuresAsContext(figures) } : null,
        brief: idea.brief,
        industry: industry === NEW ? undefined : industry,
        industry_label: industryLabel,
        use_case_label: name.trim(),
        category: category.trim() || undefined,
        use_case: resubmit ? idea.catalogRef!.useCase : undefined,
      });
      const at = new Date().toISOString();
      updateIdea(idea.id, i => ({
        catalogRef: { ...r, submittedAt: at },
        decisions: [...i.decisions, { at, text: `Submitted to the use case map: ${r.industryLabel} / ${r.useCaseLabel}${r.version > 1 ? ` (version ${r.version})` : ''}` }],
      }));
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in" onMouseDown={() => !busy && onClose()}>
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-scale-in" onMouseDown={e => e.stopPropagation()}>
        <button onClick={onClose} disabled={busy} className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60" aria-label="Close">
          <X className="w-4 h-4" />
        </button>

        {done && idea.catalogRef ? (
          <div className="text-center py-2">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" />
            <p className="text-ui-lg font-semibold text-foreground mt-3">Submitted to the use case map</p>
            <p className="text-ui-sm text-muted-foreground mt-1">
              <span className="text-foreground">{idea.catalogRef.useCaseLabel}</span> is in {idea.catalogRef.industryLabel}, waiting for review. An admin turns it on in Configuration to make it selectable in the Workflow.
            </p>
            <div className="flex justify-center gap-2 mt-5">
              <Link to="/config/prompts" className="px-4 py-2 rounded-xl bg-secondary text-foreground text-ui-sm font-medium hover:bg-secondary/80">View in Configuration</Link>
              <button onClick={onClose} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-ui-sm font-semibold hover:opacity-90">Done</button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-ui-lg font-semibold text-foreground">{resubmit ? 'Resubmit to the use case map' : 'Submit to the use case map'}</p>
            <p className="text-ui-sm text-muted-foreground mt-1">
              Adds this idea and its business case to the use case catalog for review. {resubmit && 'It becomes a new version of the same entry.'}
            </p>

            <div className="space-y-4 mt-5">
              <label className="block">
                <span className="text-ui-xs font-medium text-muted-foreground">Industry</span>
                {industries === null ? (
                  <p className="flex items-center gap-2 mt-1.5 text-ui-sm text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading the catalog…</p>
                ) : (
                  <select
                    value={industry}
                    onChange={e => setIndustry(e.target.value)}
                    className="mt-1.5 w-full bg-secondary/50 rounded-xl px-3 py-2 text-ui-sm outline-none border border-transparent focus:border-primary/40"
                  >
                    {industries.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                    <option value={NEW}>New industry…</option>
                  </select>
                )}
                {industry === NEW && (
                  <input
                    value={newIndustry}
                    onChange={e => setNewIndustry(e.target.value)}
                    placeholder="e.g. Airlines"
                    className="mt-2 w-full bg-secondary/50 rounded-xl px-3 py-2 text-ui-sm outline-none border border-transparent focus:border-primary/40"
                  />
                )}
              </label>

              <label className="block">
                <span className="text-ui-xs font-medium text-muted-foreground">Use case name</span>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="mt-1.5 w-full bg-secondary/50 rounded-xl px-3 py-2 text-ui-sm outline-none border border-transparent focus:border-primary/40"
                />
              </label>

              <label className="block">
                <span className="text-ui-xs font-medium text-muted-foreground">Outcome area on the map</span>
                <input
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  placeholder="Optional"
                  className="mt-1.5 w-full bg-secondary/50 rounded-xl px-3 py-2 text-ui-sm outline-none border border-transparent focus:border-primary/40"
                />
                {chips.length > 0 && (
                  <span className="flex flex-wrap gap-1.5 mt-2">
                    {chips.map(c => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setCategory(c)}
                        className={`px-2 py-0.5 rounded-full border text-ui-2xs ${category === c ? 'border-primary/50 text-primary bg-primary/10' : 'border-border text-muted-foreground hover:text-foreground'}`}
                      >
                        {c}
                      </button>
                    ))}
                  </span>
                )}
              </label>
            </div>

            {error && <p className="mt-4 text-ui-sm text-red-400">{error}</p>}

            <div className="flex items-center justify-between gap-3 mt-6">
              <span className="text-ui-2xs text-muted-foreground">Stays hidden from the Workflow until an admin turns it on.</span>
              <button
                onClick={submit}
                disabled={!ready}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-ui-sm font-semibold hover:opacity-90 active:scale-95 disabled:opacity-40 shrink-0"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {busy ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
