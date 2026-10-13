import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Code2, Link2, Sparkles } from 'lucide-react';
import { WORKFLOW_SECTIONS } from '../../constants/workflowSections';
import type { WorkflowViewMode } from '../../hooks/useWorkflowViewMode';
import { ideaMinutes } from '../journeykit';
import { BetaChip } from '../layout/SidebarNavItem';
import { CHAPTERS, TOTAL_MINUTES, chapterMinutes, formatMinutes } from './journey';

/** Technical sections the Insights path also runs, through the Genie Accelerator. */
const SHARED_SECTIONS = new Set(['define-usecase', 'semantic-layer', 'genie-agent', 'genie-activate']);

interface Stage {
  label: string;
  detail: string;
  shared?: boolean;
}

const INSIGHTS_STAGES: Stage[] = [
  { label: 'Idea', detail: `Start from an approved use case or your own idea, and shape it in short steps \u00b7 about ${formatMinutes(ideaMinutes('insights'))}` },
  { label: 'Data', detail: 'Existing tables, a file, sample data or an industry model' },
  { label: 'Plan', detail: 'Name it and see what you will get' },
  ...CHAPTERS.map(c => ({ label: c.title, detail: `${c.promise} \u00b7 ${formatMinutes(chapterMinutes(c.id))}`, shared: true })),
];

function technicalStages(): Stage[] {
  const intro: Stage[] = [
    { label: 'Welcome', detail: 'Pick your coding assistant and check prerequisites' },
    { label: 'Define intent', detail: 'Choose an approved use case or describe your own', shared: true },
    { label: 'Choose a path', detail: 'Apps, Lakebase, Lakehouse, agents or an accelerator' },
  ];
  const byChapter = new Map<string, { titles: string[]; focus: string; shared: boolean }>();
  for (const s of WORKFLOW_SECTIONS) {
    if (s.id === 'define-usecase' || s.chapter === 'Clean Up') continue;
    const entry = byChapter.get(s.chapter) ?? { titles: [], focus: s.focus, shared: false };
    if (s.title !== s.chapter) entry.titles.push(s.title);
    entry.shared ||= SHARED_SECTIONS.has(s.id);
    byChapter.set(s.chapter, entry);
  }
  return [
    ...intro,
    ...Array.from(byChapter.entries()).map(([chapter, e]) => ({
      label: chapter,
      detail: e.titles.length > 1 ? e.titles.join(', ') : e.focus,
      shared: e.shared,
    })),
  ];
}

function linkFor(mode: WorkflowViewMode): string {
  const url = new URL(window.location.href);
  url.searchParams.set('view', mode);
  return url.toString();
}

export function PathChooser({ mode, onChoose }: { mode: WorkflowViewMode; onChoose: (m: WorkflowViewMode) => void }) {
  const streams = [
    {
      id: 'insights' as const,
      icon: Sparkles,
      title: 'Insights',
      promise: 'A Genie your team can chat with, plus a dashboard, on data you already have.',
      who: 'Analysts and business teams',
      time: `About ${formatMinutes(TOTAL_MINUTES)}`,
      stages: INSIGHTS_STAGES,
    },
    {
      id: 'technical' as const,
      icon: Code2,
      title: 'Technical',
      promise: 'The full workshop: apps, Lakebase, pipelines, Genie and agents, with every option.',
      who: 'Builders and engineers',
      time: 'Half a day to two days',
      stages: technicalStages(),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        {streams.map(s => (
          <StreamCard key={s.id} {...s} current={mode === s.id} onOpen={() => onChoose(s.id)} />
        ))}
      </div>
      <p className="flex items-center gap-2 text-ui-sm text-muted-foreground">
        <span className="inline-block w-2 h-2 rounded-full bg-primary" />
        Stages marked like this are shared: Insights runs the Genie steps of the Technical workshop. Both use the same project, so you can switch at any time.
      </p>
    </div>
  );
}

function StreamCard({ id, icon: Icon, title, promise, who, time, stages, current, onOpen }: {
  id: WorkflowViewMode; icon: typeof Sparkles; title: string; promise: string; who: string; time: string; stages: Stage[]; current: boolean; onOpen: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(linkFor(id));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked */ }
  };

  return (
    <div className={`flex flex-col rounded-2xl border p-5 bg-card ${current ? 'border-primary/50 shadow-[0_0_0_4px_hsl(var(--primary)/0.08)]' : 'border-border'}`}>
      <div className="flex items-start gap-3">
        <span className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${id === 'insights' ? 'bg-primary/10 text-primary' : 'bg-secondary text-foreground'}`}>
          <Icon className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-2 text-ui-lg font-semibold text-foreground">
            {title}
            {id === 'insights' && <BetaChip />}
            {current && <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 rounded-full px-2 py-0.5">You are here</span>}
          </p>
          <p className="text-ui-sm text-muted-foreground">{who} · {time}</p>
        </div>
      </div>
      <p className="text-ui-md text-foreground/85 mt-3">{promise}</p>

      <ol className="relative mt-4 space-y-0.5 flex-1">
        {stages.map((st, i) => (
          <motion.li
            key={st.label}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.03 * i }}
            className="relative flex gap-3 pl-0.5"
          >
            <span className="flex flex-col items-center">
              <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${st.shared ? 'bg-primary' : 'bg-border'}`} />
              {i < stages.length - 1 && <span className="w-px flex-1 bg-border my-0.5" />}
            </span>
            <span className="pb-2 min-w-0">
              <span className="block text-ui-md font-medium text-foreground leading-snug">{st.label}</span>
              <span className="block text-ui-xs text-muted-foreground leading-snug line-clamp-2">{st.detail}</span>
            </span>
          </motion.li>
        ))}
      </ol>

      <div className="flex items-center gap-2 pt-3 mt-1 border-t border-border/60">
        <button
          onClick={onOpen}
          disabled={current}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-ui-sm font-semibold disabled:bg-secondary disabled:text-muted-foreground transition-opacity hover:opacity-90"
        >
          {current ? 'Open now' : `Open ${title}`} {!current && <ArrowRight className="w-4 h-4" />}
        </button>
        <button onClick={copy} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-ui-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60">
          {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Link2 className="w-4 h-4" />} {copied ? 'Link copied' : 'Copy link'}
        </button>
      </div>
    </div>
  );
}
