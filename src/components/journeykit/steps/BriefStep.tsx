import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Archive, ArrowRight, Check, CheckCircle2, ChevronDown, Copy, Download, FileText, Hammer, History, Loader2, Pencil, Search, Send, ShieldCheck, Shuffle, TriangleAlert } from 'lucide-react';
import { SubmitDialog } from '../ui/SubmitDialog';
import { ReviewDialog } from '../ui/ReviewDialog';
import { ApprovalTracker } from '../ui/ApprovalTracker';
import { personName, useCanReview, useReviewRefresh } from '../engine/approval';
import { BusinessCaseSheet, InlineBusinessCase } from '../ui/BusinessCase';
import { BusinessCaseButton } from '../ui/BusinessCaseButton';
import type { IdeaFlow } from '../engine/useIdeaFlow';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';
import { MARKDOWN_COMPONENTS, REMARK_PLUGINS } from '../../MarkdownContent.utils';
import { briefAsMarkdown, caseFigures, chosenShape, placedLeaf } from '../engine/ideaContext';
import { money, units } from '../engine/businessCase';
import { DIMENSIONS } from '../engine/types';
import { modeOf } from '../modes';
import { PersonaStack } from '../ui/PersonaChip';
import { isBuilding, needsBuildUpdate, openBuildHref, startBuildHref, updateBuildHref } from '../engine/handoff';
import { useEnabledAddOns } from '../engine/buildRecipes';
import { MakeItMineButton } from '../ui/SampleBanner';
import { RefineButton } from '../ui/RefineButton';
import { Scorecard } from '../ui/Scorecard';

const SECTIONS = ['Headline', 'Problem', "Who It's For", 'Chosen Shape', 'Success Metric', 'Scope', 'Top Risks', 'Test Scenarios', 'Open Questions'];
const INSIGHTS_SECTIONS = ['Headline', 'Problem', "Who It's For", 'Chosen Shape', 'Questions It Will Answer', 'Data It Needs', 'Success Metric', 'Scope', 'Top Risks', 'Open Questions'];
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
  const location = useLocation();
  const streaming = flow.loading === 'brief';
  const text = streaming ? flow.briefDraft : idea.brief ?? flow.briefDraft;
  const { copied, handleCopy } = useCopyToClipboard();
  const [toast, setToast] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const canReview = useCanReview();
  const [fullBrief, setFullBrief] = useState(false);
  const [caseOpen, setCaseOpen] = useState(false);
  const sectionNames = idea.mode === 'insights' ? INSIGHTS_SECTIONS : SECTIONS;
  const sections = useMemo(() => splitSections(text), [text]);
  const collapsed = !streaming && !fullBrief && sections.length > PREVIEW_SECTIONS + 1;
  const visibleText = collapsed ? sections.slice(0, PREVIEW_SECTIONS + (sections[0].startsWith('##') ? 0 : 1)).join('') : text;
  const openCase = () => (config.mode === 'ideate' && location.pathname.startsWith('/ideate') ? navigate(`/ideate/${idea.id}/business-case`) : setCaseOpen(true));
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

  useEnabledAddOns();
  const building = isBuilding(idea) && idea.buildTarget === 'insights';
  const changed = needsBuildUpdate(idea);
  const update = building && changed && idea.approved.includes('brief');
  const review = idea.review;
  const reviewApproved = review?.status === 'approved' && review.approvedRevision === (idea.revision ?? 0);
  const canOpenExistingBuild = building && !changed;
  useReviewRefresh(review?.status === 'pending');
  const goBuild = () => {
    const fresh = !!idea.sessionId && idea.buildTarget !== 'insights';
    navigate(update
      ? updateBuildHref({ ...idea, buildTarget: 'insights' })
      : building
        ? openBuildHref({ ...idea, buildTarget: 'insights' })!
        : `${startBuildHref(idea)}&target=insights${fresh ? '&fresh=1' : ''}`);
  };
  const park = () => {
    flow.setStatus('parked', 'Parked for later');
    setToast('Parked. It will be waiting in My Ideas.');
    setTimeout(() => setToast(null), 2500);
  };

  const approved = idea.approved.includes('brief');
  if (approved && !streaming && !flow.readOnly) {
    return (
      <div className="space-y-8 relative">
        <InlineBusinessCase flow={flow} onOpenFull={() => setCaseOpen(true)} />

        <details className="group rounded-2xl border border-border bg-card/60">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-ui-sm font-medium text-foreground">
            <FileText className="w-4 h-4 text-primary" />
            View the source brief
            <ChevronDown className="w-4 h-4 ml-auto text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div className="border-t border-border px-5 py-5">
            <div className="prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>{text}</ReactMarkdown>
            </div>
            <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-border/60">
              <button onClick={() => handleCopy(briefAsMarkdown(idea))} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-ui-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Copy brief'}
              </button>
              <button onClick={download} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-ui-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60">
                <Download className="w-3.5 h-3.5" /> Download brief
              </button>
            </div>
          </div>
        </details>

        <section className="rounded-3xl border border-border bg-card p-5 sm:p-6" aria-label="Quality score">
          <Scorecard idea={idea} editable autoScore onRaise={flow.setViewStep} />
        </section>

        <section className="rounded-3xl border border-primary/25 bg-primary/[0.04] p-5 sm:p-6 space-y-4" aria-label="Next actions">
          <div>
            <p className="text-ui-xl font-semibold text-foreground">{canOpenExistingBuild ? 'Your existing build is ready' : reviewApproved ? 'Approved and ready to build' : review?.status === 'pending' ? 'Pending approval' : review?.status === 'changes_requested' ? 'Changes requested' : review?.status === 'rejected' ? 'Not approved yet' : 'Choose what happens next'}</p>
            <p className="text-ui-sm text-muted-foreground mt-1">
              {canOpenExistingBuild
                ? 'You can reopen work that was already started. Approval is still required before starting a new build or applying a changed revision.'
                : reviewApproved
                ? 'The current revision is approved. Server authorization is checked again when you start the build.'
                : review?.status === 'pending'
                  ? canReview
                    ? "You're an approver, so you can review this revision and approve it yourself. Building unlocks as soon as it's approved."
                    : 'An approver is looking at this revision. This page updates the moment they decide.'
                  : review?.status === 'changes_requested' || review?.status === 'rejected'
                    ? `${personName(review.reviewer)}: ${review.note || 'Edit the idea using the journey steps, then resubmit the new revision.'}`
                    : 'Park the idea for later, or submit the one-pager and business case for required approval.'}
            </p>
            {review && review.status !== 'draft' && <ApprovalTracker idea={idea} building={building} size="md" className="mt-4" />}
          </div>
          {canOpenExistingBuild || reviewApproved ? (
            <button onClick={goBuild} className="w-full flex items-center justify-center gap-2 min-h-12 px-5 py-3 rounded-xl bg-primary text-primary-foreground text-ui-lg font-semibold shadow-sm hover:opacity-90 active:scale-[0.99]">
              <Hammer className="w-4 h-4" />
              {update ? 'Update the Insights build' : building ? 'Continue to the existing build' : 'Start building'}
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : review?.status === 'changes_requested' || review?.status === 'rejected' ? (
            <button onClick={() => flow.setViewStep('spark')} className="w-full flex items-center justify-center gap-2 min-h-12 px-5 py-3 rounded-xl bg-primary text-primary-foreground text-ui-lg font-semibold shadow-sm hover:opacity-90 active:scale-[0.99]">
              <Pencil className="w-4 h-4" /> Revise the idea
            </button>
          ) : review?.status === 'pending' ? (canReview ? (
            <button onClick={() => setReviewOpen(true)} className="w-full flex items-center justify-center gap-2 min-h-12 px-5 py-3 rounded-xl bg-amber-500 text-white text-ui-lg font-semibold shadow-sm hover:bg-amber-400 active:scale-[0.99] animate-pulse-glow">
              <ShieldCheck className="w-4 h-4" /> Review &amp; approve
            </button>
          ) : (
            <button onClick={() => navigate(`/ideate?focus=${encodeURIComponent(idea.id)}&event=submitted`)} className="w-full flex items-center justify-center gap-2 min-h-12 px-5 py-3 rounded-xl bg-secondary text-foreground text-ui-lg font-semibold hover:bg-secondary/80 active:scale-[0.99]">
              Back to my ideas <ArrowRight className="w-4 h-4" />
            </button>
          )) : (
            <button onClick={() => setSubmitOpen(true)} className="w-full flex items-center justify-center gap-2 min-h-12 px-5 py-3 rounded-xl bg-primary text-primary-foreground text-ui-lg font-semibold shadow-sm hover:opacity-90 active:scale-[0.99]">
              <Send className="w-4 h-4" /> Submit for approval
            </button>
          )}
          <div className="flex items-center justify-center gap-5 pt-1 text-ui-sm">
            <button onClick={flow.pivot} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
              <Shuffle className="w-4 h-4" /> Pivot this idea
            </button>
            <button onClick={park} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
              <Archive className="w-4 h-4" /> Park for later
            </button>
          </div>
        </section>

        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-foreground text-background text-ui-sm shadow-lg animate-slide-up-fade">{toast}</div>
        )}
        {submitOpen && <SubmitDialog idea={idea} onClose={() => setSubmitOpen(false)} />}
        {reviewOpen && <ReviewDialog idea={idea} onClose={() => setReviewOpen(false)} onStartBuild={() => { setReviewOpen(false); goBuild(); }} />}
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
            {!flow.readOnly && (
              <RefineButton
                icon={flow.loading === 'gaps' ? Loader2 : Search}
                spin={flow.loading === 'gaps'}
                tone="primary"
                label="Find gaps"
                hint="See what a reviewer would ask"
                badge={idea.gaps ? undefined : '+15'}
                onClick={() => flow.findGaps()}
                disabled={!!flow.loading}
              />
            )}
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
          ) : null}
        </>
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
