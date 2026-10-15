import { ArrowLeft, ArrowRight, BadgeCheck, Check, LayoutDashboard, Loader2, MessagesSquare, Pencil, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react';
import { CertifiedBadge } from '../../CertifiedBadge';
import type { ApprovedUseCase } from '../usecases/useCaseApi';
import { sourceFromChoice } from '../blueprint/links';
import { MiniConstellation } from '../blueprint/MiniConstellation';
import { SourcePill } from '../blueprint/SourcePill';
import type { BlueprintChoice } from '../blueprint/types';
import { CHAPTERS, MOMENTS, chapterMinutes, formatMinutes, totalMinutes, type Moment } from '../journey';
import { ADD_ON_LABEL, type AddOn } from '../recipes';
import type { ReactNode } from 'react';
import { MAX_NAME_LENGTH } from '../brief';
import { BusinessCaseButton, FadeIn, GhostButton, Headline, PrimaryButton, SHAPE_KINDS, type ShapeKind } from '../../journeykit';

export interface IdeaRecap {
  headline: string;
  problem?: string;
  approach?: { label: string; kind: ShapeKind };
}

interface ReadyScreenProps {
  progress?: ReactNode;
  idea?: IdeaRecap | null;
  onEditIdea?: () => void;
  onOpenCase?: () => void;
  name: string;
  onNameChange: (v: string) => void;
  questionCount: number;
  dataLabel: string;
  blueprint?: BlueprintChoice | null;
  useCase?: ApprovedUseCase | null;
  onBack: () => void;
  onStart: () => void;
  readOnly: boolean;
  /** The build's steps with the chosen add-ons. */
  moments?: Moment[];
  /** Add-ons this idea can have, and the ones chosen. */
  offeredAddOns?: AddOn[];
  /** Build capabilities promised by the chosen approach; shown as included and cannot be switched off. */
  requiredAddOns?: AddOn[];
  addOns?: AddOn[];
  onToggleAddOn?: (addOn: AddOn) => void;
  buildChecking?: boolean;
  buildBlocker?: string | null;
}

export function ReadyScreen({
  progress, idea, onEditIdea, onOpenCase, name, onNameChange, questionCount, dataLabel, blueprint, useCase,
  onBack, onStart, readOnly, moments = MOMENTS, offeredAddOns = [], requiredAddOns = [], addOns = [],
  onToggleAddOn, buildChecking = false, buildBlocker = null,
}: ReadyScreenProps) {
  const genie = { icon: MessagesSquare, title: 'A Genie your team can chat with', body: 'Ask in plain English, get an answer in seconds.' };
  const trusted = { icon: ShieldCheck, title: `Trusted answers to your ${questionCount} question${questionCount === 1 ? '' : 's'}`, body: 'Tested and tuned until they come back right.' };
  const dashboard = { icon: LayoutDashboard, title: 'A dashboard to share', body: 'Built on the same numbers, so charts and Genie always agree.' };
  const outcomes = idea?.approach?.kind === 'monitor' ? [dashboard, genie, trusted] : [genie, trusted, dashboard];
  const kind = idea?.approach ? SHAPE_KINDS[idea.approach.kind] : null;

  return (
    <div className="max-w-4xl mx-auto px-1 py-6 sm:py-10 space-y-8">
      <FadeIn className="flex items-center justify-between gap-4">
        {progress}
        <GhostButton onClick={onBack}><ArrowLeft className="w-4 h-4" /> Back</GhostButton>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Headline title="Here's your plan" subtitle={`Using ${dataLabel}. Each step hands you instructions to paste into Genie Code, the AI assistant built into Databricks.${blueprint ? '' : ' Nothing to install.'}`} />
      </FadeIn>

      <FadeIn delay={0.1}>
        <label className="group flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10 transition-all">
          <Sparkles className="w-5 h-5 text-primary shrink-0" />
          <span className="flex-1 min-w-0">
            <span className="block text-ui-xs font-medium uppercase tracking-wider text-muted-foreground">Your Genie</span>
            <input
              value={name}
              onChange={e => onNameChange(e.target.value)}
              placeholder="Name your Genie"
              maxLength={MAX_NAME_LENGTH}
              className="w-full bg-transparent outline-none text-ui-xl font-semibold text-foreground placeholder:text-muted-foreground/50"
            />
          </span>
          <Pencil className="w-4 h-4 text-muted-foreground/60 group-focus-within:text-primary" />
        </label>
      </FadeIn>

      {idea && (
        <FadeIn delay={0.105} className="flex items-start gap-4 rounded-2xl border border-border bg-card px-5 py-4">
          <span className={`flex items-center justify-center w-11 h-11 rounded-xl shrink-0 ${kind ? kind.tint : 'bg-primary/10 text-primary'}`}>
            {kind ? <kind.icon className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-ui-xs font-medium uppercase tracking-wider text-muted-foreground">Your idea</p>
            <p className="text-ui-md font-semibold text-foreground">{idea.headline}</p>
            {idea.problem && <p className="text-ui-sm text-muted-foreground line-clamp-2">{idea.problem}</p>}
            {idea.approach && <p className="text-ui-sm text-muted-foreground mt-0.5">Approach: <span className="text-foreground/85">{idea.approach.label}</span></p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onOpenCase && <BusinessCaseButton onClick={onOpenCase} variant="quiet" />}
            {onEditIdea && !readOnly && <GhostButton onClick={onEditIdea}><Pencil className="w-3.5 h-3.5" /> Edit</GhostButton>}
          </div>
        </FadeIn>
      )}

      {useCase && (
        <FadeIn delay={0.11} className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4">
          <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 shrink-0">
            {useCase.certified ? <CertifiedBadge size="md" /> : <BadgeCheck className="w-6 h-6 text-primary" />}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-ui-xs font-medium uppercase tracking-wider text-muted-foreground">Based on an approved use case</p>
            <p className="text-ui-md font-semibold text-foreground truncate">
              {useCase.label}<span className="font-normal text-muted-foreground"> · {useCase.industryLabel}{useCase.certified ? ' · Certified' : ''}</span>
            </p>
            <p className="text-ui-sm text-muted-foreground">The Technical view opens this same use case, so you can switch any time.</p>
          </div>
        </FadeIn>
      )}

      {blueprint && (
        <FadeIn delay={0.12} className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-primary/25 bg-primary/[0.04] px-5 py-4">
          <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary shrink-0">
            <MiniConstellation nodes={8} size={30} active />
          </span>
          <div className="flex-1 min-w-0 space-y-1.5">
            <p className="text-ui-md font-semibold text-foreground">
              {blueprint.label} industry data model
              <span className="font-normal text-muted-foreground"> · {blueprint.areas.length} area{blueprint.areas.length === 1 ? '' : 's'} · {blueprint.kpis.length} KPI{blueprint.kpis.length === 1 ? '' : 's'}</span>
            </p>
            <p className="text-ui-sm text-muted-foreground">
              Set up for you as <span className="font-mono text-foreground/85">{blueprint.catalog}</span> in your first chapter, shared with everyone in the workspace.
            </p>
            <SourcePill source={sourceFromChoice(blueprint)} label={blueprint.label} compact />
          </div>
        </FadeIn>
      )}

      <FadeIn delay={0.15} className="grid sm:grid-cols-3 gap-3">
        {outcomes.map(o => (
          <div key={o.title} className="rounded-2xl border border-border bg-card p-5">
            <o.icon className="w-5 h-5 text-primary" />
            <p className="text-ui-md font-semibold text-foreground mt-3 leading-snug">{o.title}</p>
            <p className="text-ui-sm text-muted-foreground mt-1">{o.body}</p>
          </div>
        ))}
      </FadeIn>

      {offeredAddOns.length > 0 && onToggleAddOn && (
        <FadeIn delay={0.18} className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <p className="text-ui-md font-semibold text-foreground">
              {requiredAddOns.length ? 'Included in your build' : 'Also build'}
            </p>
            <p className="text-ui-sm text-muted-foreground">
              {requiredAddOns.length
                ? 'Your Copilot approach includes the app automatically. Optional extras can still be switched on or off.'
                : 'Optional extras go inside the same four chapters.'}
            </p>
          </div>
          <ul>
            {offeredAddOns.map(a => {
              const on = addOns.includes(a);
              const required = requiredAddOns.includes(a);
              return (
                <li key={a} className="border-b border-border/60 last:border-b-0">
                  <label className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${required ? 'bg-primary/[0.03]' : 'cursor-pointer hover:bg-secondary/30'}`}>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2 text-ui-md font-medium text-foreground">
                        {ADD_ON_LABEL[a].title}
                        {required && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-ui-xs font-semibold text-primary">
                            <Check className="w-3 h-3" strokeWidth={3} /> Included from your approach
                          </span>
                        )}
                      </span>
                      <span className="block text-ui-sm text-muted-foreground">
                        {required ? `Your Copilot includes this. ${ADD_ON_LABEL[a].body}` : ADD_ON_LABEL[a].body}
                      </span>
                    </span>
                    {!required && (
                      <>
                        <input
                          type="checkbox"
                          role="switch"
                          checked={on}
                          disabled={readOnly}
                          onChange={() => onToggleAddOn(a)}
                          className="peer sr-only"
                        />
                        <span aria-hidden className={`relative w-10 h-6 rounded-full transition-colors peer-focus-visible:ring-4 peer-focus-visible:ring-primary/20 ${on ? 'bg-primary' : 'bg-secondary'}`}>
                          <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : ''}`} />
                        </span>
                      </>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        </FadeIn>
      )}

      <FadeIn delay={0.2} className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <p className="text-ui-md font-semibold text-foreground">Four short chapters</p>
          <p className="text-ui-sm text-muted-foreground">About {formatMinutes(Math.round(totalMinutes(moments) / 15) * 15)} total, pause anytime</p>
        </div>
        <ol>
          {CHAPTERS.map((c, i) => (
            <li key={c.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-border/60 last:border-b-0">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-secondary text-ui-sm font-semibold text-foreground shrink-0">{i + 1}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-ui-md font-medium text-foreground">{c.title}</span>
                <span className="block text-ui-sm text-muted-foreground">{c.promise}</span>
              </span>
              <span className="text-ui-sm text-muted-foreground tabular-nums">{formatMinutes(chapterMinutes(c.id, moments))}</span>
            </li>
          ))}
        </ol>
      </FadeIn>

      {buildChecking && (
        <FadeIn className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-ui-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 shrink-0 animate-spin text-primary" />
          Checking the required Copilot build steps…
        </FadeIn>
      )}

      {buildBlocker && (
        <FadeIn className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/[0.06] px-4 py-3">
          <TriangleAlert className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
          <div>
            <p className="text-ui-sm font-semibold text-foreground">The Copilot app build is not available yet</p>
            <p className="text-ui-xs text-muted-foreground mt-0.5">{buildBlocker}</p>
          </div>
        </FadeIn>
      )}

      <FadeIn delay={0.25} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <p className="text-ui-sm text-muted-foreground">Your progress saves automatically.</p>
        <PrimaryButton size="lg" disabled={!name.trim() || readOnly || buildChecking || !!buildBlocker} onClick={onStart}>
          Start building <ArrowRight className="w-4 h-4" />
        </PrimaryButton>
      </FadeIn>
    </div>
  );
}
