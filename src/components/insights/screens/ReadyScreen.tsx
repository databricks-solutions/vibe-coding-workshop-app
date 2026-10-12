import { ArrowLeft, ArrowRight, BadgeCheck, LayoutDashboard, MessagesSquare, Pencil, ShieldCheck, Sparkles } from 'lucide-react';
import { CertifiedBadge } from '../../CertifiedBadge';
import type { ApprovedUseCase } from '../usecases/useCaseApi';
import { sourceFromChoice } from '../blueprint/links';
import { MiniConstellation } from '../blueprint/MiniConstellation';
import { SourcePill } from '../blueprint/SourcePill';
import type { BlueprintChoice } from '../blueprint/types';
import { CHAPTERS, TOTAL_MINUTES, chapterMinutes, formatMinutes } from '../journey';
import { FadeIn, GhostButton, Headline, OnboardingProgress, PrimaryButton } from '../ui';

interface ReadyScreenProps {
  name: string;
  onNameChange: (v: string) => void;
  questionCount: number;
  dataLabel: string;
  blueprint?: BlueprintChoice | null;
  useCase?: ApprovedUseCase | null;
  onBack: () => void;
  onStart: () => void;
  readOnly: boolean;
}

export function ReadyScreen({ name, onNameChange, questionCount, dataLabel, blueprint, useCase, onBack, onStart, readOnly }: ReadyScreenProps) {
  const outcomes = [
    { icon: MessagesSquare, title: 'A Genie your team can chat with', body: 'Ask in plain English, get an answer in seconds.' },
    { icon: ShieldCheck, title: `Trusted answers to your ${questionCount} question${questionCount === 1 ? '' : 's'}`, body: 'Tested and tuned until they come back right.' },
    { icon: LayoutDashboard, title: 'A dashboard to share', body: 'Built on the same numbers, so charts and Genie always agree.' },
  ];

  return (
    <div className="max-w-3xl mx-auto px-1 py-6 sm:py-10 space-y-8">
      <FadeIn className="flex items-center justify-between">
        <OnboardingProgress index={blueprint ? 3 : 2} total={blueprint ? 4 : 3} />
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
              className="w-full bg-transparent outline-none text-ui-xl font-semibold text-foreground placeholder:text-muted-foreground/50"
            />
          </span>
          <Pencil className="w-4 h-4 text-muted-foreground/60 group-focus-within:text-primary" />
        </label>
      </FadeIn>

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

      <FadeIn delay={0.2} className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <p className="text-ui-md font-semibold text-foreground">Four short chapters</p>
          <p className="text-ui-sm text-muted-foreground">About {formatMinutes(Math.round(TOTAL_MINUTES / 15) * 15)} total, pause anytime</p>
        </div>
        <ol>
          {CHAPTERS.map((c, i) => (
            <li key={c.id} className="flex items-center gap-4 px-5 py-3.5 border-b border-border/60 last:border-b-0">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-secondary text-ui-sm font-semibold text-foreground shrink-0">{i + 1}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-ui-md font-medium text-foreground">{c.title}</span>
                <span className="block text-ui-sm text-muted-foreground">{c.promise}</span>
              </span>
              <span className="text-ui-sm text-muted-foreground tabular-nums">{formatMinutes(chapterMinutes(c.id))}</span>
            </li>
          ))}
        </ol>
      </FadeIn>

      <FadeIn delay={0.25} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <p className="text-ui-sm text-muted-foreground">Your progress saves automatically.</p>
        <PrimaryButton size="lg" disabled={!name.trim() || readOnly} onClick={onStart}>
          Start building <ArrowRight className="w-4 h-4" />
        </PrimaryButton>
      </FadeIn>
    </div>
  );
}
