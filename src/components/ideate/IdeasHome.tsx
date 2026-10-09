import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Copy, Lightbulb, Menu, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useIdeas } from '../../hooks/useIdeas';
import { VoiceTextarea } from './VoiceTextarea';
import { STEPS, type Idea, type IdeaStatus } from './types';
import { stepIndex } from './ideaContext';
import { ART, STEP_ART } from './art';

const STATUS: Record<IdeaStatus, { label: string; cls: string }> = {
  exploring: { label: 'Exploring', cls: 'bg-sky-500/10 text-sky-400' },
  committed: { label: 'Committed', cls: 'bg-emerald-500/10 text-emerald-400' },
  parked: { label: 'Parked', cls: 'bg-amber-500/10 text-amber-400' },
};

const PROMPTS = [
  'Field techs waste hours finding the right repair manual…',
  'Claims adjusters re-key the same data into three systems…',
  'Store managers never know which shelves will run empty…',
];

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function IdeasHome({ onOpenMobileNav }: { onOpenMobileNav?: () => void }) {
  const { ideas, createIdea, updateIdea, deleteIdea, duplicateIdea } = useIdeas();
  const navigate = useNavigate();
  const [seed, setSeed] = useState('');
  const [industry, setIndustry] = useState('');
  const [filter, setFilter] = useState<IdeaStatus | 'all'>('all');
  const [promptIdx, setPromptIdx] = useState(0);

  useEffect(() => {
    if (seed) return;
    const t = setInterval(() => setPromptIdx(i => (i + 1) % PROMPTS.length), 3500);
    return () => clearInterval(t);
  }, [seed]);

  const start = () => {
    if (!seed.trim()) return;
    const idea = createIdea(seed.trim(), industry.trim());
    navigate(`/ideate/${idea.id}`);
  };

  const visible = useMemo(() => ideas.filter(i => filter === 'all' || i.status === filter), [ideas, filter]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-background">
      <div className="max-w-4xl mx-auto px-5 py-8 md:py-12">
        {onOpenMobileNav && (
          <button onClick={onOpenMobileNav} className="md:hidden p-2 -ml-2 mb-2 rounded-lg hover:bg-secondary" aria-label="Open navigation">
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="grid items-center gap-6 md:grid-cols-[1fr_minmax(0,320px)] mb-6 animate-fade-in">
          <div>
            <p className="flex items-center gap-2 text-ui-sm font-medium text-primary">
              <Lightbulb className="w-4 h-4" /> Ideate
              <span className="px-1.5 py-0.5 rounded text-ui-2xs font-semibold uppercase tracking-wide bg-amber-500/15 text-amber-400">Beta</span>
            </p>
            <h1 className="text-ui-3xl font-semibold text-foreground leading-tight mt-2">Say the messy version.<br />I'll ask the questions.</h1>
            <p className="text-ui-base text-muted-foreground mt-3 max-w-md">
              Five short steps turn a rough idea into a one-page brief. You pick, the AI does the heavy lifting.
            </p>
          </div>
          <img src={ART.hero} alt="" width={320} height={213} className="hidden md:block w-full rounded-3xl" />
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 md:p-6 shadow-sm animate-slide-up-fade">
          <VoiceTextarea
            value={seed}
            onChange={setSeed}
            size="lg"
            rows={3}
            autoFocus
            placeholder={PROMPTS[promptIdx]}
            onSubmit={start}
          />
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <input
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              placeholder="Industry (optional)"
              className="flex-1 min-w-[10rem] bg-secondary/50 rounded-xl px-3 py-2 text-ui-sm outline-none border border-transparent focus:border-primary/40"
              onKeyDown={e => e.key === 'Enter' && start()}
            />
            <button
              onClick={start}
              disabled={!seed.trim()}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-ui-sm font-semibold transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
            >
              Start ideating <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {ideas.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-ui-lg font-semibold text-foreground mr-2">My ideas</h2>
              {(['all', 'exploring', 'committed', 'parked'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-full text-ui-xs font-medium transition-colors ${filter === f ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-secondary'}`}
                >
                  {f === 'all' ? `All ${ideas.length}` : STATUS[f].label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {visible.map((idea, i) => (
                <IdeaCard
                  key={idea.id}
                  idea={idea}
                  delay={i * 50}
                  onOpen={() => navigate(`/ideate/${idea.id}`)}
                  onRename={title => updateIdea(idea.id, { title })}
                  onDuplicate={() => duplicateIdea(idea.id)}
                  onDelete={() => deleteIdea(idea.id)}
                />
              ))}
              {visible.length === 0 && (
                <div className="sm:col-span-2 flex flex-col items-center py-6 text-center">
                  <img src={ART.empty} alt="" width={200} height={133} className="w-48 rounded-2xl opacity-90" />
                  <p className="text-ui-sm text-muted-foreground mt-3">No {filter === 'all' ? '' : STATUS[filter as IdeaStatus].label.toLowerCase()} ideas yet.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface IdeaCardProps {
  idea: Idea;
  delay: number;
  onOpen: () => void;
  onRename: (title: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function IdeaCard({ idea, delay, onOpen, onRename, onDuplicate, onDelete }: IdeaCardProps) {
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const progress = (idea.approved.length / STEPS.length) * 100;
  const status = STATUS[idea.status];
  const StepIcon = STEP_ART[idea.step].icon;

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) { setMenu(false); setConfirmDelete(false); } };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  return (
    <div
      onClick={() => !renaming && onOpen()}
      className="group relative text-left rounded-2xl border border-border bg-card/60 p-4 cursor-pointer transition-colors hover:border-primary/40 hover:bg-card animate-cascade-in"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start gap-2.5">
        <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0" title={`At: ${STEPS[stepIndex(idea.step)].label}`}>
          <StepIcon className="w-4 h-4" />
        </span>
        {renaming ? (
          <input
            autoFocus
            defaultValue={idea.title}
            onClick={e => e.stopPropagation()}
            onBlur={e => { onRename(e.target.value.trim() || idea.title); setRenaming(false); }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setRenaming(false); }}
            className="flex-1 bg-transparent text-ui-base font-semibold outline-none border-b border-primary/50"
          />
        ) : (
          <p className="flex-1 text-ui-base font-semibold text-foreground line-clamp-1 mt-1">{idea.title}</p>
        )}
        <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
          <button onClick={() => setMenu(m => !m)} className="p-1 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-secondary" aria-label="Idea actions">
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menu && (
            <div className="absolute right-0 top-7 z-20 w-40 rounded-xl border border-border bg-popover p-1 shadow-lg animate-scale-in">
              <MenuItem icon={Pencil} label="Rename" onClick={() => { setRenaming(true); setMenu(false); }} />
              <MenuItem icon={Copy} label="Duplicate" onClick={() => { onDuplicate(); setMenu(false); }} />
              <MenuItem
                icon={Trash2}
                label={confirmDelete ? 'Click to confirm' : 'Delete'}
                danger
                onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
              />
            </div>
          )}
        </div>
      </div>
      <p className="text-ui-sm text-muted-foreground line-clamp-2 mt-1 min-h-[2.5em]">{idea.spark?.statement ?? idea.seed}</p>
      <div className="flex items-center gap-2 mt-3">
        <span className={`px-2 py-0.5 rounded-full text-ui-2xs font-semibold ${status.cls}`}>{status.label}</span>
        {(idea.spark?.industry || idea.industry) && <span className="text-ui-2xs text-muted-foreground">{idea.spark?.industry || idea.industry}</span>}
        <span className="ml-auto text-ui-2xs text-muted-foreground">{STEPS[stepIndex(idea.step)].label} · {timeAgo(idea.updatedAt)}</span>
      </div>
      <div className="h-0.5 rounded-full bg-secondary mt-3 overflow-hidden">
        <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: typeof Pencil; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-ui-sm hover:bg-secondary ${danger ? 'text-red-400' : 'text-foreground'}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}
