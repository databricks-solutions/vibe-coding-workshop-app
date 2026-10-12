import { ArrowRight, ArrowUpRight, Check, Code2, LayoutDashboard, Link2, MessagesSquare, RotateCcw } from 'lucide-react';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';
import { ART, FadeIn, GhostButton, SecondaryButton } from '../../journeykit';
import type { WorkspaceLinks } from '../types';
interface FinishScreenProps {
  name: string;
  questions: string[];
  links: WorkspaceLinks;
  onRevisit: () => void;
  onSwitchToTechnical: () => void;
}

function ActionCard({ icon: Icon, title, body, href, onClick, actionLabel }: {
  icon: typeof Link2; title: string; body: string; href?: string; onClick?: () => void; actionLabel: string;
}) {
  const inner = (
    <>
      <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary"><Icon className="w-5 h-5" /></span>
      <span className="block mt-4 text-ui-lg font-semibold text-foreground">{title}</span>
      <span className="block mt-1 text-ui-md text-muted-foreground">{body}</span>
      <span className="mt-4 inline-flex items-center gap-1.5 text-ui-md font-semibold text-primary">
        {actionLabel} {href ? <ArrowUpRight className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
      </span>
    </>
  );
  const cls = 'block text-left rounded-3xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30';
  return href
    ? <a href={href} target="_blank" rel="noreferrer" className={cls}>{inner}</a>
    : <button onClick={onClick} className={cls}>{inner}</button>;
}

export function FinishScreen({ name, questions, links, onRevisit, onSwitchToTechnical }: FinishScreenProps) {
  const { copied, handleCopy } = useCopyToClipboard();

  return (
    <div className="max-w-4xl mx-auto px-1 py-6 sm:py-10 space-y-10">
      <FadeIn className="grid md:grid-cols-[1fr_minmax(0,300px)] gap-8 items-center">
        <div className="space-y-4">
          <p className="text-ui-sm font-semibold uppercase tracking-[0.14em] text-primary">All four chapters done</p>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-foreground leading-[1.05]">
            {name || 'Your Genie'} is live.
          </h1>
          <p className="text-ui-lg text-muted-foreground max-w-lg">
            Your team can now ask questions in plain English and get answers built on one official set of numbers, with a dashboard to match.
          </p>
        </div>
        <img src={ART.celebrate} alt="" width={300} height={200} className="hidden md:block w-full rounded-3xl" />
      </FadeIn>

      {questions.length > 0 && (
        <FadeIn delay={0.05} className="rounded-3xl border border-border bg-card p-6">
          <p className="text-ui-md font-semibold text-foreground mb-3">It can answer</p>
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
            {questions.map(q => (
              <li key={q} className="flex items-start gap-2.5 text-ui-md text-foreground/90">
                <span className="mt-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white shrink-0"><Check className="w-3 h-3" strokeWidth={3.5} /></span>
                {q}
              </li>
            ))}
          </ul>
        </FadeIn>
      )}

      <FadeIn delay={0.1} className="grid sm:grid-cols-3 gap-4">
        <ActionCard icon={MessagesSquare} title="Try your Genie" body="Ask one of your questions and see the answer." href={links.genie} onClick={links.genie ? undefined : onRevisit} actionLabel="Open Genie" />
        <ActionCard icon={LayoutDashboard} title="Open your dashboard" body="Every question, as a chart you can share." href={links.dashboards} onClick={links.dashboards ? undefined : onRevisit} actionLabel="Open dashboards" />
        <ActionCard
          icon={Link2}
          title="Share this project"
          body="Send a link so a teammate can see how it was built."
          onClick={() => handleCopy(window.location.href)}
          actionLabel={copied ? 'Link copied' : 'Copy link'}
        />
      </FadeIn>

      <FadeIn delay={0.15} className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-3xl border border-dashed border-border p-6">
        <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-secondary text-muted-foreground shrink-0"><Code2 className="w-5 h-5" /></span>
        <div className="flex-1">
          <p className="text-ui-lg font-semibold text-foreground">Want to go further?</p>
          <p className="text-ui-md text-muted-foreground">Turn it into an app your whole company can use. The Technical view picks up right where you left off.</p>
        </div>
        <SecondaryButton onClick={onSwitchToTechnical}>Open in Technical</SecondaryButton>
      </FadeIn>

      <div className="flex justify-center">
        <GhostButton onClick={onRevisit}><RotateCcw className="w-3.5 h-3.5" /> Revisit any step</GhostButton>
      </div>
    </div>
  );
}
