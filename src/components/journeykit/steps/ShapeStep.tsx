import { useEffect, useState } from 'react';
import { Check, Clock, FlaskConical, Info, MessagesSquare, RotateCcw, Sparkles } from 'lucide-react';
import type { IdeaFlow } from '../engine/useIdeaFlow';
import type { ShapeOption } from '../engine/types';
import { placementLabel, shapeBuild } from '../engine/surfaces';
import { SurfaceChips } from '../ui/SurfaceChips';
import { SHAPE_KINDS } from '../modes';

const NO_SHAPES: ShapeOption[] = [];
const EFFORT: Record<string, string> = { S: 'Small', M: 'Medium', L: 'Large' };
const LEVER: Record<string, string> = { cost_avoided: 'Cost avoided', revenue_uplift: 'Revenue', time_saved: 'Time freed' };
const SHARE: Record<string, string> = { 'mostly hard': 'Hard dollars', mixed: 'Hard and soft', 'mostly soft': 'Mostly soft' };

/** The three approaches, recommended one marked; 1 to 3 picks, Enter takes the recommendation. */
export function ShapeStep({ flow }: { flow: IdeaFlow }) {
  const idea = flow.idea!;
  const shapes = idea.shapes ?? NO_SHAPES;
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});
  const rec = shapes.find(s => s.recommended) ?? null;
  const { readOnly, chooseShape } = flow;

  useEffect(() => {
    if (readOnly) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable) || e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= shapes.length) chooseShape(shapes[n - 1].id);
      else if (e.key === 'Enter' && rec && !idea.chosenShapeId && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        chooseShape(rec.id);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [chooseShape, readOnly, shapes, rec, idea.chosenShapeId]);

  return (
    <div className="space-y-5">
      <div className="animate-fade-in">
        <p className="text-ui-xl font-semibold text-foreground leading-snug">Which approach should we take?</p>
        <p className="flex items-center gap-1.5 text-ui-xs text-muted-foreground mt-1.5">
          <Info className="w-3 h-3 shrink-0" /> Decides who does the work, what we build, and how the value is sized.
        </p>
        <p className="text-ui-sm text-muted-foreground mt-3">
          {rec ? <>We recommend <span className="text-foreground font-medium">{rec.title}</span>. </> : 'Pick one. '}
          Every approach comes with Genie, so people can ask their own questions. Tap <span className="text-foreground">See risk</span> for what could sink it.
          {!readOnly && <span className="hidden md:inline text-muted-foreground/70"> Press 1 to {shapes.length}{rec && !idea.chosenShapeId ? ', or Enter for the recommended one' : ''}.</span>}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3 items-stretch">
        {shapes.map((s, i) => {
          const k = SHAPE_KINDS[s.kind] ?? SHAPE_KINDS.copilot;
          const Icon = k.icon;
          const chosen = idea.chosenShapeId === s.id;
          const isRec = s === rec;
          const isFlipped = !!flipped[s.id];
          const toggle = () => setFlipped(f => ({ ...f, [s.id]: !f[s.id] }));
          const build = shapeBuild(s);
          const ring = chosen ? 'border-primary ring-2 ring-primary/30' : isRec ? 'border-primary/40 ring-1 ring-primary/15' : 'border-border';
          const chips = [
            s.valueSize && { key: 'size', text: s.valueSize, tone: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-semibold' },
            s.valueLever && { key: 'lever', text: LEVER[s.valueLever], tone: 'text-foreground/80 bg-secondary' },
            s.hardShare && { key: 'share', text: SHARE[s.hardShare], tone: 'text-foreground/80 bg-secondary' },
          ].filter(Boolean) as { key: string; text: string; tone: string }[];
          const footer = (label: string) => (
            <div className="flex flex-wrap items-center gap-2 mt-auto pt-4">
              <button
                onClick={toggle}
                aria-expanded={isFlipped}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-ui-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              >
                <RotateCcw className="w-3 h-3" /> {label}
              </button>
              {readOnly
                ? chosen && <span className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-ui-sm font-medium bg-primary text-primary-foreground"><Check className="w-3.5 h-3.5" /> Chosen</span>
                : <ChooseButton chosen={chosen} onClick={() => chooseShape(s.id)} />}
            </div>
          );
          return (
            <div key={s.id} className="ideate-flip h-full animate-cascade-in" style={{ animationDelay: `${i * 120}ms` }}>
              <div className={`ideate-flip-inner ${isFlipped ? 'is-flipped' : ''}`}>
                <div
                  inert={isFlipped}
                  aria-hidden={isFlipped}
                  className={`ideate-flip-face rounded-2xl border p-5 flex flex-col bg-card transition-colors ${ring} ${isRec && !chosen ? 'bg-primary/[0.03]' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center ${k.tint}`}>
                      <Icon className="w-5 h-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-ui-sm font-semibold text-foreground truncate">{k.label}</span>
                      <span className="block text-ui-2xs text-muted-foreground">{EFFORT[s.effort] ?? s.effort} effort</span>
                    </span>
                    {isRec ? (
                      <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-ui-2xs font-medium">
                        <Sparkles className="w-3 h-3" /> Recommended
                      </span>
                    ) : (
                      <kbd className="shrink-0 w-6 h-6 rounded-md bg-secondary text-ui-2xs font-semibold text-muted-foreground flex items-center justify-center">{i + 1}</kbd>
                    )}
                  </div>
                  <p className="text-ui-lg font-semibold text-foreground mt-4 leading-snug break-words">{s.title}</p>
                  <p className="text-ui-sm text-muted-foreground mt-2 break-words">{s.value}</p>
                  {isRec && s.recommendedWhy && <p className="text-ui-xs text-primary/90 mt-2 break-words">{s.recommendedWhy}</p>}

                  <div className="mt-4 rounded-xl border border-border/70 bg-secondary/30 p-3 space-y-2">
                    <p className="text-ui-2xs uppercase tracking-wider font-semibold text-muted-foreground">What you'll build</p>
                    <SurfaceChips surfaces={build.visible} />
                    {build.genie ? (
                      <p className="flex items-start gap-1.5 text-ui-xs text-muted-foreground break-words">
                        <MessagesSquare className="w-3.5 h-3.5 shrink-0 mt-px text-teal-600 dark:text-teal-400" aria-hidden />
                        <span>
                          <span className="text-foreground/90">{placementLabel(build)}</span>
                          {build.askExamples[0] && <>: <span className="italic">"{build.askExamples[0]}"</span></>}
                        </span>
                      </p>
                    ) : build.noGenieWhy && (
                      <p className="text-ui-xs text-muted-foreground break-words">No Genie: {build.noGenieWhy}</p>
                    )}
                  </div>

                  {(chips.length > 0 || s.timeToValue) && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-3">
                      {chips.map(c => <span key={c.key} className={`px-1.5 py-0.5 rounded text-ui-2xs ${c.tone}`}>{c.text}</span>)}
                      {s.timeToValue && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-ui-2xs text-muted-foreground bg-secondary/60">
                          <Clock className="w-3 h-3" /> Value in {s.timeToValue}
                        </span>
                      )}
                    </div>
                  )}
                  {footer('See risk')}
                </div>

                <div
                  inert={!isFlipped}
                  aria-hidden={!isFlipped}
                  className={`ideate-flip-face ideate-flip-back rounded-2xl border p-5 flex flex-col bg-card ${chosen ? 'border-primary ring-2 ring-primary/30' : 'border-amber-500/30'}`}
                >
                  <p className="text-ui-2xs uppercase tracking-wider font-semibold text-amber-500">Riskiest assumption</p>
                  <p className="text-ui-base text-foreground mt-2 break-words">{s.riskiestAssumption}</p>
                  {s.cheapTest && (
                    <>
                      <p className="flex items-center gap-1 text-ui-2xs uppercase tracking-wider font-semibold text-muted-foreground mt-4">
                        <FlaskConical className="w-3 h-3" /> Cheapest test
                      </p>
                      <p className="text-ui-sm text-muted-foreground mt-1 break-words">{s.cheapTest}</p>
                    </>
                  )}
                  {build.askExamples.length > 1 && (
                    <>
                      <p className="flex items-center gap-1 text-ui-2xs uppercase tracking-wider font-semibold text-muted-foreground mt-4">
                        <MessagesSquare className="w-3 h-3" /> People could ask
                      </p>
                      <ul className="mt-1 space-y-1">
                        {build.askExamples.map(q => <li key={q} className="text-ui-sm text-muted-foreground italic break-words">"{q}"</li>)}
                      </ul>
                    </>
                  )}
                  {footer('See approach')}
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
