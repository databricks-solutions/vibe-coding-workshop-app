import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Archive, Check, CheckCircle2, Copy, Download, Loader2, Plus, Rocket, Search, Shuffle, TriangleAlert, X } from 'lucide-react';
import type { IdeaFlow } from '../../../hooks/useIdeaFlow';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';
import { MARKDOWN_COMPONENTS, REMARK_PLUGINS } from '../../MarkdownContent';
import { briefAsMarkdown, chosenShape, placedLeaf } from '../ideaContext';
import { ART, avatarFor } from '../art';
import { DIMENSIONS } from '../types';

const SECTIONS = ['Headline', 'Problem', "Who It's For", 'Chosen Shape', 'Success Metric', 'Scope', 'Top Risks', 'Test Scenarios', 'Open Questions'];
const CONFETTI = ['#10b981', '#5eead4', '#fbbf24', '#fda4af'];

export function BriefStep({ flow }: { flow: IdeaFlow }) {
  const idea = flow.idea!;
  const navigate = useNavigate();
  const streaming = flow.loading === 'brief';
  const text = streaming ? flow.briefDraft : idea.brief ?? flow.briefDraft;
  const { copied, handleCopy } = useCopyToClipboard();
  const [celebrate, setCelebrate] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const shape = chosenShape(idea);
  const personas = placedLeaf(idea)?.personas ?? [];

  const done = useMemo(() => {
    const heads = (text.match(/^##\s+(.+)$/gm) ?? []).map(h => h.replace(/^##\s+/, '').toLowerCase());
    return new Set(SECTIONS.filter(s => heads.some(h => h.startsWith(s.toLowerCase()))));
  }, [text]);

  const gaps = idea.gaps?.filter(g => !g.covered) ?? [];
  const labelFor = (key: string) => DIMENSIONS.find(d => d.key === key)?.label ?? key;

  const download = () => {
    const blob = new Blob([briefAsMarkdown(idea)], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(idea.title || 'idea').replace(/[^\w-]+/g, '-').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const commit = () => {
    flow.setStatus('committed', 'Committed to this idea');
    setCelebrate(c => c + 1);
  };

  const park = () => {
    flow.setStatus('parked', 'Parked for later');
    setToast('Parked. It will be waiting in My Ideas.');
    setTimeout(() => setToast(null), 2500);
  };

  return (
    <div className="space-y-5 relative">
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-card/60 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="text-ui-lg font-semibold text-foreground truncate">{idea.title}</p>
          {shape && <p className="text-ui-sm text-muted-foreground truncate">{shape.title}</p>}
        </div>
        {personas.length > 0 && (
          <div className="flex -space-x-2 flex-shrink-0" title={personas.join(', ')}>
            {personas.slice(0, 3).map(p => (
              <img key={p} src={avatarFor(p)} alt="" width={32} height={32} className="w-8 h-8 rounded-full ring-2 ring-card" />
            ))}
          </div>
        )}
      </div>

      {streaming && (
        <div className="flex flex-wrap gap-1.5 animate-fade-in">
          {SECTIONS.map(s => (
            <span
              key={s}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-ui-2xs font-medium transition-colors duration-300 ${
                done.has(s) ? 'bg-emerald-500/10 text-emerald-400' : 'bg-secondary/60 text-muted-foreground/60'
              }`}
            >
              {done.has(s) && <Check className="w-3 h-3" />} {s}
            </span>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-6 prose-sm max-w-none">
        {text ? (
          <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>{text}</ReactMarkdown>
        ) : (
          <p className="flex items-center gap-2 text-ui-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Writing your brief…</p>
        )}
        {streaming && text && <span className="inline-block w-2 h-4 bg-primary/70 animate-pulse align-middle" />}
      </div>

      {!streaming && idea.brief && (
        <>
          <div className="flex flex-wrap items-center gap-1">
            <button onClick={() => flow.findGaps()} disabled={!!flow.loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-ui-sm text-primary hover:bg-primary/10 disabled:opacity-50">
              {flow.loading === 'gaps' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Find gaps
            </button>
            <div className="flex-1" />
            <button onClick={() => handleCopy(briefAsMarkdown(idea))} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-ui-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy'}
            </button>
            <button onClick={download} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-ui-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60">
              <Download className="w-3.5 h-3.5" /> Download
            </button>
          </div>

          {idea.gaps && (
            <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-2 animate-slide-up-fade">
              {gaps.length === 0 ? (
                <p className="flex items-center gap-2 text-ui-sm text-emerald-400"><CheckCircle2 className="w-4 h-4" /> All six dimensions are covered.</p>
              ) : (
                <>
                  {gaps.map(g => (
                    <p key={g.key} className="flex items-start gap-2 text-ui-sm">
                      <TriangleAlert className="w-4 h-4 mt-0.5 text-amber-400 shrink-0" />
                      <span><span className="font-medium text-foreground">{labelFor(g.key)}:</span> <span className="text-muted-foreground">{g.gap}</span></span>
                    </p>
                  ))}
                  <button
                    onClick={() => flow.run('brief', `Fill these gaps: ${gaps.map(g => `${labelFor(g.key)}: ${g.gap}`).join('; ')}`)}
                    className="mt-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-ui-sm font-medium hover:bg-primary/20"
                  >
                    Fill gaps
                  </button>
                </>
              )}
            </div>
          )}

          {celebrate > 0 ? (
            <div className="relative rounded-2xl border border-emerald-500/30 bg-card overflow-hidden animate-slide-up-fade">
              <button onClick={() => setCelebrate(0)} className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
              <div className="flex flex-col sm:flex-row items-center gap-5 p-5">
                <img src={ART.celebrate} alt="" width={240} height={160} className="w-60 rounded-xl" />
                <div className="text-center sm:text-left">
                  <p className="text-ui-xl font-semibold text-foreground">Committed. Nice work.</p>
                  <p className="text-ui-sm text-muted-foreground mt-1">Your brief is ready to share or take into the workshop.</p>
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-4">
                    <button onClick={download} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-ui-sm font-semibold hover:opacity-90">
                      <Download className="w-4 h-4" /> Download brief
                    </button>
                    <button onClick={() => navigate('/ideate')} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-secondary text-foreground text-ui-sm font-medium hover:bg-secondary/80">
                      <Plus className="w-4 h-4" /> Start another idea
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card/60 p-5">
              <p className="text-ui-base font-semibold text-foreground">What's next for this idea?</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <button onClick={commit} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-ui-sm font-semibold transition-all active:scale-95 ${idea.status === 'committed' ? 'bg-emerald-500 text-white' : 'bg-primary text-primary-foreground hover:opacity-90'}`}>
                  <Rocket className="w-4 h-4" /> {idea.status === 'committed' ? 'Committed' : 'Commit'}
                </button>
                <button onClick={flow.pivot} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-ui-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60">
                  <Shuffle className="w-4 h-4" /> Pivot
                </button>
                <button onClick={park} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-ui-sm font-medium ${idea.status === 'parked' ? 'bg-amber-500/15 text-amber-400' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'}`}>
                  <Archive className="w-4 h-4" /> {idea.status === 'parked' ? 'Parked' : 'Park'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {celebrate > 0 && (
        <div key={celebrate} className="pointer-events-none fixed inset-x-0 top-0 h-64 overflow-hidden z-50 motion-reduce:hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-sm animate-confetti-fall"
              style={{ backgroundColor: CONFETTI[i % CONFETTI.length], left: `${(i * 53) % 100}%`, animationDelay: `${(i % 8) * 70}ms` }}
            />
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-foreground text-background text-ui-sm shadow-lg animate-slide-up-fade">{toast}</div>
      )}
    </div>
  );
}
