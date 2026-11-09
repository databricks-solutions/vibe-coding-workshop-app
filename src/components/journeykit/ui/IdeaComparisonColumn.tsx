import { ArrowRight, Target, UserRound } from 'lucide-react';
import { caseFigures, chosenShape, placedLeaf } from '../engine/ideaContext';
import { money } from '../engine/businessCase';
import type { Idea } from '../engine/types';

export interface ComparisonDraft {
  text: string;
  industry?: string;
}

export interface ComparisonOwner {
  displayName: string;
  email?: string;
  avatar?: string;
  isCurrentUser?: boolean;
}

const ROW_CLASS = 'min-h-[88px] border-t border-border/60 px-4 py-3 text-ui-sm';

export function ComparisonRowLabels() {
  const labels = ['Owner & status', 'Problem / decision', 'ROI', 'KPIs & value', 'Users', 'User flow', 'Approach', 'Journey state', 'Questions & data'];
  return (
    <div className="w-36 sm:w-40 shrink-0 sticky left-0 z-20 bg-card border-r border-border">
      <div className="h-[116px] px-3 py-4 flex items-end">
        <p className="text-ui-xs font-semibold uppercase tracking-wider text-muted-foreground">Compare</p>
      </div>
      {labels.map(label => (
        <div key={label} className={`${ROW_CLASS} flex items-start bg-card`}>
          <span className="text-ui-xs font-semibold text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  );
}

export function IdeaComparisonColumn({
  label,
  idea,
  draft,
  owner,
  status,
  primary = false,
  onDetails,
}: {
  label: string;
  idea?: Idea | null;
  draft?: ComparisonDraft;
  owner: ComparisonOwner;
  status: string;
  primary?: boolean;
  onDetails?: () => void;
}) {
  const shape = idea ? chosenShape(idea) : null;
  const leaf = idea ? placedLeaf(idea) : null;
  const figures = idea ? caseFigures(idea) : null;
  const problem = idea?.spark?.statement || idea?.seed || draft?.text || 'Not defined yet';
  const industry = idea?.spark?.industry || idea?.industry || draft?.industry || 'Industry not specified';
  const keyResults = idea?.summary?.keyResults ?? [];
  const actors = idea?.workflow?.slice(0, 3) ?? [];
  const questionDetails = idea?.genieQuestions?.map(q => idea.questionDetails?.[q]).filter(Boolean) ?? [];
  const action = questionDetails.find(d => d?.drivesAction)?.drivesAction;
  const metrics = Array.from(new Set(questionDetails.flatMap(d => d?.metrics ?? []))).slice(0, 4);
  const dimensions = Array.from(new Set(questionDetails.flatMap(d => d?.dimensions ?? []))).slice(0, 3);
  const journey = idea
    ? `${idea.approved.length} of 7 idea steps · ${idea.buildStage === 'studio' ? 'building' : idea.review?.status === 'pending' ? 'in review' : idea.review?.status === 'approved' ? 'approved' : 'shaping'}`
    : 'Draft · not shaped yet';
  const flow = actors.length
    ? actors.map(a => `${a.actor}: ${a.action}`).join(' → ')
    : [leaf?.personas?.[0], shape?.decisionStyle || action, shape?.value].filter(Boolean).join(' → ') || 'Not defined yet';

  return (
    <article className={`w-[19rem] sm:w-[21rem] shrink-0 bg-card ${primary ? 'ring-1 ring-primary/30' : ''}`}>
      <div className="h-[116px] px-4 py-4 flex flex-col">
        <div className="flex items-center gap-2">
          <p className="text-ui-2xs font-semibold uppercase tracking-wider text-primary">{label}</p>
          {primary && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-ui-3xs font-semibold text-primary">Primary related idea</span>}
        </div>
        <h3 className="text-ui-md font-semibold text-foreground mt-1 line-clamp-2">{idea?.title || draft?.text || 'Your proposed idea'}</h3>
        <p className="text-ui-xs text-muted-foreground mt-auto truncate">{industry}</p>
      </div>

      <div className={ROW_CLASS}>
        <p className="flex items-center gap-1.5 font-medium text-foreground"><UserRound className="w-3.5 h-3.5 text-muted-foreground" /> {owner.isCurrentUser ? 'You' : owner.displayName}</p>
        {owner.email && <p className="text-ui-xs text-muted-foreground truncate mt-0.5">{owner.email}</p>}
        <span className="inline-flex mt-1 rounded-full bg-secondary px-2 py-0.5 text-ui-2xs text-muted-foreground">{status}</span>
      </div>
      <div className={ROW_CLASS}><p className="text-foreground line-clamp-3">{problem}</p></div>
      <div className={ROW_CLASS}>
        {figures ? (
          <>
            <p className="text-ui-lg font-semibold text-emerald-600 dark:text-emerald-400">{money(figures.value.expected)}/yr</p>
            <p className="text-ui-xs text-muted-foreground">Pilot {money(figures.pilot.value)}/yr</p>
          </>
        ) : <Empty />}
      </div>
      <div className={ROW_CLASS}>
        {idea?.impact?.driverLabel || keyResults.length ? (
          <>
            {idea?.impact?.driverLabel && <p className="flex items-center gap-1.5 font-medium text-foreground"><Target className="w-3.5 h-3.5 text-emerald-500" /> {idea.impact.driverLabel}</p>}
            {keyResults.slice(0, 2).map(kr => <p key={`${kr.kr}-${kr.target}`} className="text-ui-xs text-muted-foreground mt-1">{kr.kr}: {kr.target}</p>)}
          </>
        ) : <Empty />}
      </div>
      <div className={ROW_CLASS}>
        {leaf?.personas?.length ? <p className="text-foreground">{leaf.personas.slice(0, 4).join(' · ')}</p> : <Empty />}
      </div>
      <div className={ROW_CLASS}><p className="text-foreground line-clamp-3">{flow}</p></div>
      <div className={ROW_CLASS}>
        {shape ? (
          <>
            <p className="font-medium text-foreground">{shape.title}</p>
            <p className="text-ui-xs text-muted-foreground mt-1">{[shape.decisionStyle, shape.cadence, idea?.spark?.primaryEntity].filter(Boolean).join(' · ') || shape.kind}</p>
          </>
        ) : <Empty />}
      </div>
      <div className={ROW_CLASS}><p className="font-medium text-foreground">{journey}</p></div>
      <div className={ROW_CLASS}>
        {idea?.genieQuestions?.length ? (
          <>
            <p className="font-medium text-foreground">{idea.genieQuestions.length} Genie questions</p>
            {!!metrics.length && <p className="text-ui-xs text-teal-700 dark:text-teal-300 mt-1 line-clamp-2">{metrics.join(' · ')}</p>}
            {!!dimensions.length && <p className="text-ui-2xs text-muted-foreground mt-1">{dimensions.join(' · ')}</p>}
          </>
        ) : <Empty />}
      </div>
      {onDetails && (
        <div className="border-t border-border px-4 py-3">
          <button onClick={onDetails} className="inline-flex items-center gap-1.5 text-ui-sm font-semibold text-primary hover:underline">
            View details <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </article>
  );
}

function Empty() {
  return <p className="text-ui-sm text-muted-foreground">Not defined yet</p>;
}
