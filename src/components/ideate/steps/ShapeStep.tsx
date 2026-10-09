import { useState } from 'react';
import { BarChart3, Bot, Check, FlaskConical, RotateCcw, UserRoundCog } from 'lucide-react';
import type { IdeaFlow } from '../../../hooks/useIdeaFlow';
import type { ShapeKind, ShapeOption } from '../types';

const KIND: Record<ShapeKind, { label: string; icon: typeof Bot; tint: string }> = {
  copilot: { label: 'Copilot', icon: UserRoundCog, tint: 'text-sky-400 bg-sky-500/10' },
  automation: { label: 'Automation', icon: Bot, tint: 'text-violet-400 bg-violet-500/10' },
  insight: { label: 'Insight', icon: BarChart3, tint: 'text-emerald-400 bg-emerald-500/10' },
};

const EFFORT: Record<string, string> = { S: 'Small', M: 'Medium', L: 'Large' };

export function ShapeStep({ flow }: { flow: IdeaFlow }) {
  const idea = flow.idea!;
  const shapes = idea.shapes ?? [];
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});

  const choose = (s: ShapeOption) => flow.patch({ chosenShapeId: s.id });

  return (
    <div className="space-y-6">
      <p className="text-ui-base text-muted-foreground animate-fade-in">
        Three genuinely different ways to deliver it. <span className="text-foreground">Flip a card to see what could sink it.</span>
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {shapes.map((s, i) => {
          const k = KIND[s.kind] ?? KIND.copilot;
          const Icon = k.icon;
          const chosen = idea.chosenShapeId === s.id;
          const isFlipped = !!flipped[s.id];
          const toggle = () => setFlipped(f => ({ ...f, [s.id]: !f[s.id] }));
          return (
            <div key={s.id} className="ideate-flip h-72 animate-cascade-in" style={{ animationDelay: `${i * 120}ms` }}>
              <div className={`ideate-flip-inner ${isFlipped ? 'is-flipped' : ''}`}>
                <div className={`ideate-flip-face rounded-2xl border p-5 flex flex-col bg-card transition-colors ${chosen ? 'border-primary ring-2 ring-primary/30' : 'border-border'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-ui-xs font-semibold ${k.tint}`}>
                      <Icon className="w-3.5 h-3.5" /> {k.label}
                    </span>
                    <span className="text-ui-2xs text-muted-foreground">Effort: {EFFORT[s.effort] ?? s.effort}</span>
                  </div>
                  <p className="text-ui-lg font-semibold text-foreground mt-4 leading-snug">{s.title}</p>
                  <p className="text-ui-base text-muted-foreground mt-2 flex-1">{s.value}</p>
                  <div className="flex flex-wrap gap-1 mb-3">
                    {s.surfaces.map(x => <span key={x} className="px-1.5 py-0.5 rounded border border-border text-ui-2xs text-muted-foreground">{x}</span>)}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={toggle} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-ui-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60">
                      <RotateCcw className="w-3 h-3" /> Risk
                    </button>
                    <ChooseButton chosen={chosen} onClick={() => choose(s)} />
                  </div>
                </div>

                <div className={`ideate-flip-face ideate-flip-back rounded-2xl border p-5 flex flex-col bg-card ${chosen ? 'border-primary ring-2 ring-primary/30' : 'border-amber-500/30'}`}>
                  <p className="text-ui-2xs uppercase tracking-wider font-semibold text-amber-400">Riskiest assumption</p>
                  <p className="text-ui-base text-foreground mt-2">{s.riskiestAssumption}</p>
                  {s.cheapTest && (
                    <>
                      <p className="flex items-center gap-1 text-ui-2xs uppercase tracking-wider font-semibold text-muted-foreground mt-4">
                        <FlaskConical className="w-3 h-3" /> Cheapest test
                      </p>
                      <p className="text-ui-sm text-muted-foreground mt-1">{s.cheapTest}</p>
                    </>
                  )}
                  <div className="flex items-center gap-2 mt-auto">
                    <button onClick={toggle} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-ui-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60">
                      <RotateCcw className="w-3 h-3" /> Back
                    </button>
                    <ChooseButton chosen={chosen} onClick={() => choose(s)} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChooseButton({ chosen, onClick }: { chosen: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-ui-sm font-medium transition-all active:scale-95 ${
        chosen ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground hover:bg-primary/15 hover:text-primary'
      }`}
    >
      {chosen && <Check className="w-3.5 h-3.5 animate-scale-in" />} {chosen ? 'Chosen' : 'Choose this'}
    </button>
  );
}
