import type { ReactNode } from 'react';
import { ArrowRight, Briefcase, Pencil, Target } from 'lucide-react';
import {
  ART, FadeIn, GhostButton, PersonaChip, PrimaryButton, SecondaryButton, SHAPE_KINDS, UseCaseBadge, answerFor, chosenShape, placedLeaf, type Idea,
} from '../../journeykit';

interface IdeaLockedScreenProps {
  idea: Idea;
  readOnly: boolean;
  onEdit: () => void;
  onOpenCase?: () => void;
  onNext: () => void;
}

/** The beat between shaping and building: what is locked in, and what comes next. */
export function IdeaLockedScreen({ idea, readOnly, onEdit, onOpenCase, onNext }: IdeaLockedScreenProps) {
  const shape = chosenShape(idea);
  const kind = shape ? SHAPE_KINDS[shape.kind] : null;
  const personas = placedLeaf(idea)?.personas ?? idea.useCaseContext?.personas.map(p => p.name) ?? [];
  const metric = answerFor(idea, 'business');
  const questions = idea.genieQuestions ?? [];

  return (
    <>
      <FadeIn className="flex flex-col sm:flex-row sm:items-center gap-5">
        <img src={ART.celebrate} alt="" width={96} height={96} className="w-24 h-24 rounded-3xl object-cover ring-1 ring-border/60 shrink-0" />
        <div className="space-y-2 min-w-0">
          <p className="text-ui-sm font-semibold uppercase tracking-[0.14em] text-emerald-500">Idea locked in</p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground leading-[1.1]">{idea.title}</h1>
          <p className="text-ui-lg text-muted-foreground leading-relaxed">Nice work. Next, tell us where your data lives so we can build it.</p>
        </div>
      </FadeIn>

      <FadeIn delay={0.06} className="rounded-2xl border border-border bg-card divide-y divide-border/60">
        {idea.spark?.statement && (
          <Row label="The problem">
            <p className="text-ui-md text-foreground leading-relaxed">{idea.spark.statement}</p>
          </Row>
        )}
        {personas.length > 0 && (
          <Row label="Who it helps">
            <div className="flex flex-wrap gap-1.5">
              {personas.slice(0, 4).map(p => <PersonaChip key={p} name={p} />)}
            </div>
          </Row>
        )}
        {metric && (
          <Row label="Success looks like">
            <p className="flex items-center gap-2 text-ui-md text-foreground"><Target className="w-4 h-4 text-emerald-500 shrink-0" /> {metric}</p>
          </Row>
        )}
        {shape && kind && (
          <Row label="Approach">
            <p className="flex items-center gap-2.5 text-ui-md text-foreground">
              <span className={`flex items-center justify-center w-7 h-7 rounded-lg shrink-0 ${kind.tint}`}><kind.icon className="w-4 h-4" /></span>
              <span><span className="font-semibold">{shape.title}</span><span className="text-muted-foreground"> · {kind.label}</span></span>
            </p>
          </Row>
        )}
        {questions.length > 0 && (
          <Row label={`${questions.length} question${questions.length === 1 ? '' : 's'} for Genie`}>
            <ol className="space-y-1">
              {questions.slice(0, 3).map((q, i) => (
                <li key={q} className="flex gap-2 text-ui-md text-foreground"><span className="text-muted-foreground tabular-nums">{i + 1}.</span>{q}</li>
              ))}
              {questions.length > 3 && <li className="text-ui-sm text-muted-foreground pl-5">and {questions.length - 3} more</li>}
            </ol>
          </Row>
        )}
        {idea.sourceUseCase && (
          <Row label="Started from">
            <UseCaseBadge uc={idea.sourceUseCase} />
          </Row>
        )}
      </FadeIn>

      <FadeIn delay={0.12} className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && <GhostButton onClick={onEdit}><Pencil className="w-3.5 h-3.5" /> Edit idea</GhostButton>}
          {onOpenCase && <SecondaryButton onClick={onOpenCase}><Briefcase className="w-4 h-4" /> Business case</SecondaryButton>}
        </div>
        <PrimaryButton size="lg" onClick={onNext}>
          Next: where your data lives <ArrowRight className="w-4 h-4" />
        </PrimaryButton>
      </FadeIn>
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid sm:grid-cols-[10rem_1fr] gap-1.5 sm:gap-4 px-5 py-4">
      <p className="text-ui-xs font-medium uppercase tracking-wider text-muted-foreground sm:pt-0.5">{label}</p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
