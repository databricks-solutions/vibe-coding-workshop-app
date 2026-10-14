import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Archive, ArrowRight, Check, CheckCircle2, ChevronDown, Copy, Download, FileText, Hammer, History, Loader2, Plus, Rocket, Search, Send, Shuffle, TriangleAlert, X } from 'lucide-react';
import { SubmitDialog } from '../ui/SubmitDialog';
import { BusinessCaseSheet } from '../ui/BusinessCase';
import { BusinessCaseButton } from '../ui/BusinessCaseButton';
import type { IdeaFlow } from '../engine/useIdeaFlow';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';
import { MARKDOWN_COMPONENTS, REMARK_PLUGINS } from '../../MarkdownContent';
import { briefAsMarkdown, caseFigures, chosenShape, placedLeaf } from '../engine/ideaContext';
import { money, units } from '../engine/businessCase';
import { ART } from '../art';
import { DIMENSIONS } from '../engine/types';
import { modeOf } from '../modes';
import { PersonaStack } from '../ui/PersonaChip';
import { BUILD_TARGET_LABEL, buildTargetFor, isBuilding, needsBuildUpdate, openBuildHref, startBuildHref, updateBuildHref } from '../engine/handoff';
import { useEnabledAddOns } from '../engine/buildRecipes';
import { MakeItMineButton } from '../ui/SampleBanner';

const SECTIONS = ['Headline', 'Problem', "Who It's For", 'Chosen Shape', 'Success Metric', 'Scope', 'Top Risks', 'Test Scenarios', 'Open Questions'];
const INSIGHTS_SECTIONS = ['Headline', 'Problem', "Who It's For", 'Chosen Shape', 'Questions It Will Answer', 'Data It Needs', 'Success Metric', 'Scope', 'Top Risks', 'Open Questions'];
const CONFETTI = ['#10b981', '#5eead4', '#fbbf24', '#fda4af'];
/** Sections shown before "Show full brief". */
const PREVIEW_SECTIONS = 2;

/** Splits Markdown at its H2 headings, keeping any preamble with the first part. */
function splitSections(md: string): string[] {
  const parts = md.split(/(?=^##\s)/m).filter(p => p.trim());
  return parts.length ? parts : [md];
}

export function BriefStep({ flow }: { flow: IdeaFlow }) {
  const idea = flow.idea!;
  const config = modeOf(idea);
  const navigate = useNavigate();
  const streaming = flow.loading === 'brief';
  const text = streaming ? flow.briefDraft : idea.brief ?? flow.briefDraft;
  const { copied, handleCopy } = useCopyToClipboard();
  const [celebrate, setCelebrate] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [fullBrief, setFullBrief] = useState(false);
  const [caseOpen, setCaseOpen] = useState(false);
  const sectionNames = idea.mode === 'insights' ? INSIGHTS_SECTIONS : SECTIONS;
  const sections = useMemo(() => splitSections(text), [text]);
  const collapsed = !streaming && !fullBrief && sections.length > PREVIEW_SECTIONS + 1;
  const visibleText = collapsed ? sections.slice(0, PREVIEW_SECTIONS + (sections[0].startsWith('##') ? 0 : 1)).join('') : text;
  const openCase = () => (config.mode === 'ideate' ? navigate(`/ideate/${idea.id}/business-case`) : setCaseOpen(true));
  const shape = chosenShape(idea);
  const personas = placedLeaf(idea)?.personas ?? [];
  const figures = caseFigures(idea);

  const done = useMemo(() => {
    const heads = (text.match(/^##\s+(.+)$/gm) ?? []).map(h => h.replace(/^##\s+/, '').toLowerCase());
    return new Set(sectionNames.filter(s => heads.some(h => h.startsWith(s.toLowerCase()))));
  }, [text, sectionNames]);

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

  useEnabledAddOns();
  const target = buildTargetFor(idea);
  const building = isBuilding(idea);
  const changed = needsBuildUpdate(idea);
  const update = changed && idea.approved.includes('brief');
  const goBuild = () => {
    if (!building) flow.logDecision(`Ready to build in ${BUILD_TARGET_LABEL[target]}`);
    navigate(update ? updateBuildHref(idea) : building ? openBuildHref(idea)! : startBuildHref(idea));
  };
  const buildButton = (primary?: boolean) => <BuildButton target={target} building={building} update={update} onClick={goBuild} primary={primary} />;

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
        {figures && (
          <span
            className="flex-shrink-0 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-ui-xs font-semibold"
            title={`${money(figures.hard)} hard and ${money(figures.soft)} soft dollars a year. Pilot: ${money(figures.pilot.value)} a year.`}
          >
            ~{money(figures.value.expected)} a year{figures.rollout ? ` across ${units(figures.rollout.units, figures.rollout.unit)}` : ''}
          </span>
        )}
        <PersonaStack names={personas} />
      </div>

      {streaming && (
        <div className="flex flex-wrap gap-1.5 animate-fade-in">
          {sectionNames.map(s => (
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
          <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>{visibleText}</ReactMarkdown>
        ) : (
          <p className="flex items-center gap-2 text-ui-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Writing your brief…</p>
        )}
        {streaming && text && <span className="inline-block w-2 h-4 bg-primary/70 animate-pulse align-middle" />}
        {collapsed && (
          <button onClick={() => setFullBrief(true)} className="mt-4 inline-flex items-center gap-1 text-ui-sm font-medium text-primary hover:underline">
            Show full brief ({sections.length - PREVIEW_SECTIONS} more sections) <ChevronDown className="w-4 h-4" />
          </button>
        )}
      </div>

      {!streaming && idea.brief && (
        <>
          <div className="flex flex-wrap items-center gap-1">
            {!flow.readOnly && <button onClick={() => flow.findGaps()} disabled={!!flow.loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-ui-sm text-primary hover:bg-primary/10 disabled:opacity-50">
              {flow.loading === 'gaps' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Find gaps
            </button>}
            <div className="flex-1" />
            <BusinessCaseButton idea={idea} onClick={openCase} variant="compact" className="mr-1" />
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
                  {!flow.readOnly && <button
                    onClick={() => flow.run('brief', `Fill these gaps: ${gaps.map(g => `${labelFor(g.key)}: ${g.gap}`).join('; ')}`)}
                    className="mt-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-ui-sm font-medium hover:bg-primary/20"
                  >
                    Fill gaps
                  </button>}
                </>
              )}
            </div>
          )}

          {changed && (
            <p className="flex items-start gap-2 rounded-xl border border-sky-500/30 bg-sky-500/[0.06] px-4 py-3 text-ui-sm text-muted-foreground">
              <History className="w-4 h-4 mt-0.5 shrink-0 text-sky-600 dark:text-sky-400" />
              {update
                ? 'Your answers changed since the build was set up. Update the build to carry them over; the current build keeps working until you do.'
                : 'Your answers changed since the build was set up. Approve this brief, then update the build. The current build keeps working until you do.'}
            </p>
          )}

          {flow.readOnly ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-primary/25 bg-primary/[0.05] p-5">
              <div className="flex-1 min-w-0">
                <p className="text-ui-base font-semibold text-foreground">That is the whole journey</p>
                <p className="text-ui-sm text-muted-foreground">Open the business case 1-pager to see what your sponsor gets, or make this sample yours to change it and build it.</p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <BusinessCaseButton onClick={openCase} />
                <MakeItMineButton idea={idea} />
              </div>
            </div>
          ) : !config.briefOutcomes ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-border bg-card/60 p-5">
              <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary shrink-0"><FileText className="w-5 h-5" /></span>
              <div className="flex-1 min-w-0">
                <p className="text-ui-base font-semibold text-foreground">Your business case 1-pager</p>
                <p className="text-ui-sm text-muted-foreground">
                  A decision-ready page for your sponsor: the problem, the success metric{figures ? ', what it is worth' : ''} and how it is built on Databricks. Ready to share or download as a PDF.
                </p>
              </div>
              <BusinessCaseButton onClick={openCase} />
            </div>
          ) : celebrate > 0 ? (
            <div className="relative rounded-2xl border border-emerald-500/30 bg-card overflow-hidden animate-slide-up-fade">
              <button onClick={() => setCelebrate(0)} className="absolute top-3 right-3 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
              <div className="flex flex-col sm:flex-row items-center gap-5 p-5">
                <img src={ART.celebrate} alt="" width={240} height={160} className="w-60 rounded-xl" />
                <div className="text-center sm:text-left">
                  <p className="text-ui-xl font-semibold text-foreground">Committed. Nice work.</p>
                  <p className="text-ui-sm text-muted-foreground mt-1">
                    {idea.catalogRef ? 'It\'s on the use case map, waiting for review.' : 'Submit it to the use case map so others can build it in the workshop.'}
                  </p>
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-4">
                    {buildButton(true)}
                    <SubmitButton submitted={!!idea.catalogRef} onClick={() => setSubmitOpen(true)} />
                    <BusinessCaseButton onClick={openCase} />
                    <button onClick={download} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-ui-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60">
                      <Download className="w-4 h-4" /> Brief
                    </button>
                    <button onClick={() => navigate('/ideate')} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-ui-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60">
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
                {buildButton(true)}
                <button onClick={commit} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-ui-sm font-semibold transition-all active:scale-95 ${idea.status === 'committed' ? 'bg-emerald-500 text-white' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}>
                  <Rocket className="w-4 h-4" /> {idea.status === 'committed' ? 'Committed' : 'Commit'}
                </button>
                {idea.status === 'committed' && <SubmitButton submitted={!!idea.catalogRef} onClick={() => setSubmitOpen(true)} />}
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

      {submitOpen && <SubmitDialog idea={idea} onClose={() => setSubmitOpen(false)} />}
      {caseOpen && (
        <BusinessCaseSheet
          ideaId={idea.id}
          onClose={() => setCaseOpen(false)}
          onAddNumbers={() => { setCaseOpen(false); flow.setViewStep('impact'); }}
        />
      )}
    </div>
  );
}

function BuildButton({ target, building, update, onClick, primary }: { target: ReturnType<typeof buildTargetFor>; building: boolean; update: boolean; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={update ? 'Rewrite the build from your latest answers' : building ? 'Open the project building this idea' : `Starts a new project in ${BUILD_TARGET_LABEL[target]}, ready for you to pick the data`}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-ui-sm font-semibold transition-all active:scale-95 ${primary ? 'bg-primary text-primary-foreground hover:opacity-90' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
    >
      {update ? <History className="w-4 h-4" /> : <Hammer className="w-4 h-4" />} {update ? 'Update the build' : building ? 'Open the build' : "I'm ready to build"}
      <span className="font-normal opacity-80">in {target === 'insights' ? 'Insights' : 'Technical'}</span>
      <ArrowRight className="w-3.5 h-3.5" />
    </button>
  );
}

function SubmitButton({ submitted, onClick, primary }: { submitted: boolean; onClick: () => void; primary?: boolean }) {
  if (submitted) {
    return (
      <button onClick={onClick} title="Resubmit with your latest changes" className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-ui-sm font-medium hover:bg-emerald-500/20">
        <CheckCircle2 className="w-4 h-4" /> On the use case map
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-ui-sm font-semibold transition-all active:scale-95 ${primary ? 'bg-primary text-primary-foreground hover:opacity-90' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
    >
      <Send className="w-4 h-4" /> Submit to use case map
    </button>
  );
}
