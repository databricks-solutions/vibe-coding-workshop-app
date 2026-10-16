import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2, Send, X } from 'lucide-react';
import { apiClient, type SelectOption } from '../../../api/client';
import { flushIdea, useIdeas } from '../engine/useIdeas';
import { buildContext, caseFigures, placedLeaf } from '../engine/ideaContext';
import { figuresAsContext, valueProfileFrom } from '../engine/businessCase';
import type { Idea } from '../engine/types';

const NEW = '__new__';

/** Submits the current idea revision to the approval queue. */
export function SubmitDialog({ idea, onClose }: { idea: Idea; onClose: () => void }) {
  const { updateIdea } = useIdeas();
  const navigate = useNavigate();
  const [industries, setIndustries] = useState<SelectOption[] | null>(null);
  const [industry, setIndustry] = useState('');
  const [newIndustry, setNewIndustry] = useState(idea.spark?.industry || idea.industry || '');
  const [name, setName] = useState(idea.catalogRef?.useCaseLabel || idea.title);
  const [category, setCategory] = useState(placedLeaf(idea)?.branch ?? '');
  const [categories, setCategories] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const preferred = idea.catalogRef?.industry ?? idea.spark?.catalogIndustry ?? '';
  useEffect(() => {
    apiClient.getIndustries()
      .then(list => {
        const real = list.filter(i => i.value && i.value !== 'sample');
        if (idea.catalogRef && !real.some(i => i.value === idea.catalogRef!.industry)) {
          real.push({ value: idea.catalogRef.industry, label: idea.catalogRef.industryLabel });
        }
        setIndustries(real);
        const segment = (idea.spark?.industry ?? '').toLowerCase();
        const byLabel = real.find(i => i.label.toLowerCase() === segment)?.value;
        setIndustry(real.some(i => i.value === preferred) ? preferred : byLabel ?? NEW);
      })
      .catch(() => { setIndustries([]); setIndustry(NEW); });
  }, [idea.catalogRef, idea.spark?.industry, preferred]);

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

  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; });
  const goHome = useCallback(() => {
    closeRef.current();
    navigate(`/ideate?focus=${encodeURIComponent(idea.id)}&event=submitted`);
  }, [idea.id, navigate]);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(goHome, 1200);
    return () => clearTimeout(t);
  }, [done, goHome]);

  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await flushIdea(idea.id);
      if (!saved) throw new Error('Save this idea to the server before submitting it for approval.');
      const figures = caseFigures(idea);
      const r = await apiClient.ideateSubmit({
        idea_id: idea.id,
        idea: { ...buildContext(idea, 'brief'), id: idea.id, revision: idea.revision ?? 1 },
        business_case: figures ? { scope: idea.impact?.scope, ...figuresAsContext(figures) } : null,
        value_profile: figures && idea.impact ? { ...valueProfileFrom(idea.impact, figures, placedLeaf(idea)?.valuePool ?? idea.spark?.valueHypothesis ?? '') } : null,
        brief: idea.brief,
        industry: industry === NEW ? undefined : industry,
        industry_label: industryLabel,
        use_case_label: name.trim(),
        category: category.trim() || undefined,
        use_case: resubmit ? idea.catalogRef!.useCase : undefined,
      });
      updateIdea(idea.id, i => ({
        catalogRef: { industry: r.industry, industryLabel: r.industryLabel, useCase: r.useCase, useCaseLabel: r.useCaseLabel, version: r.version, submittedAt: new Date().toISOString() },
        review: r.review ?? i.review,
        status: 'committed',
        decisions: [...i.decisions, { at: new Date().toISOString(), text: `Submitted revision ${i.revision ?? 0} for approval` }],
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

        {done ? (
          <div className="text-center py-2">
            <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" />
            <p className="text-ui-lg font-semibold text-foreground mt-3">Submitted for approval</p>
            <p className="text-ui-sm text-muted-foreground mt-1">
              Taking you to My Ideas, where you can follow it to approval.
            </p>
            <div className="mt-5 h-1 w-40 mx-auto rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-primary origin-left motion-safe:animate-[grow-x_1.2s_linear_forwards]" />
            </div>
            <button onClick={goHome} className="mt-4 text-ui-sm font-medium text-primary hover:underline underline-offset-2">Go now</button>
          </div>
        ) : (
          <>
            <p className="text-ui-lg font-semibold text-foreground">{idea.review?.status === 'changes_requested' || idea.review?.status === 'rejected' ? 'Resubmit for approval' : 'Submit for approval'}</p>
            <p className="text-ui-sm text-muted-foreground mt-1">
              Approval is required before this idea can start a build. The reviewer will see the one-pager, business case, evidence, and current revision.
            </p>
            <div className="mt-5 rounded-xl border border-border bg-secondary/30 p-4">
              <p className="text-ui-sm font-medium text-foreground">{idea.title}</p>
              <p className="text-ui-xs text-muted-foreground mt-1">Revision {idea.revision ?? 0} · Review history and prior notes are retained.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mt-4">
              <label className="block">
                <span className="text-ui-xs font-medium text-muted-foreground">Library collection</span>
                {industries === null ? <p className="mt-2 text-ui-xs text-muted-foreground">Loading…</p> : (
                  <select value={industry} onChange={e => setIndustry(e.target.value)} className="mt-1.5 w-full bg-secondary/50 rounded-xl px-3 py-2 text-ui-sm outline-none border border-transparent focus:border-primary/40">
                    {industries.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
                    <option value={NEW}>New industry…</option>
                  </select>
                )}
                {industry === NEW && <input value={newIndustry} onChange={e => setNewIndustry(e.target.value)} placeholder="Industry name" className="mt-2 w-full bg-secondary/50 rounded-xl px-3 py-2 text-ui-sm outline-none border border-transparent focus:border-primary/40" />}
              </label>
              <label className="block">
                <span className="text-ui-xs font-medium text-muted-foreground">Use case name</span>
                <input value={name} onChange={e => setName(e.target.value)} className="mt-1.5 w-full bg-secondary/50 rounded-xl px-3 py-2 text-ui-sm outline-none border border-transparent focus:border-primary/40" />
              </label>
            </div>
            <label className="block mt-3">
              <span className="text-ui-xs font-medium text-muted-foreground">Outcome area <span className="font-normal">(optional)</span></span>
              <input value={category} onChange={e => setCategory(e.target.value)} className="mt-1.5 w-full bg-secondary/50 rounded-xl px-3 py-2 text-ui-sm outline-none border border-transparent focus:border-primary/40" />
              {!!chips.length && <span className="flex flex-wrap gap-1.5 mt-2">{chips.map(c => <button type="button" key={c} onClick={() => setCategory(c)} className="px-2 py-0.5 rounded-full border border-border text-ui-2xs text-muted-foreground hover:text-foreground">{c}</button>)}</span>}
            </label>

            {error && <p className="mt-4 text-ui-sm text-red-400">{error}</p>}

            <div className="flex items-center justify-end gap-3 mt-6">
              <button onClick={onClose} disabled={busy} className="px-4 py-2 text-ui-sm text-muted-foreground hover:text-foreground">Cancel</button>
              <button
                onClick={submit}
                disabled={!ready}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-ui-sm font-semibold hover:opacity-90 active:scale-95 disabled:opacity-40 shrink-0"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {busy ? 'Submitting…' : 'Submit for approval'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
