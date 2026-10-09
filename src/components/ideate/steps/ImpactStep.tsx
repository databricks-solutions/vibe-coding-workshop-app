import { useState } from 'react';
import { Check, Pencil, Plus, TrendingUp } from 'lucide-react';
import type { IdeaFlow } from '../../../hooks/useIdeaFlow';
import { QuestionCard } from '../QuestionCard';
import { caseFigures } from '../ideaContext';
import { money, multiple, payback } from '../businessCase';
import type { ImpactQuestion } from '../types';

const ESTIMATE = 'Not sure, estimate for me';

/** Reads the number out of a free-text answer: "1.5k" → 1500, "2 hours" → 120 (for minute questions), "30 to 45" → 37.5. */
function parseNumber(text: string, unit: string): number | null {
  const nums = [...text.replace(/,/g, '').matchAll(/(\d+(?:\.\d+)?)\s*(k|m)?\b/gi)].map(m => {
    const n = parseFloat(m[1]);
    const mult = m[2]?.toLowerCase() === 'k' ? 1000 : m[2]?.toLowerCase() === 'm' && unit !== 'minutes' ? 1_000_000 : 1;
    return n * mult;
  });
  if (!nums.length) return null;
  let value = nums.length > 1 && /\bto\b|-/.test(text) ? (nums[0] + nums[1]) / 2 : nums[0];
  if (unit === 'minutes' && /hour|hr/i.test(text)) value *= 60;
  return value;
}

function closestOption(q: ImpactQuestion) {
  let best = -1;
  let gap = Infinity;
  q.options.forEach((o, i) => {
    const d = Math.abs(o.value - q.estimate.value);
    if (d < gap) { gap = d; best = i; }
  });
  return best;
}

export function ImpactStep({ flow }: { flow: IdeaFlow }) {
  const idea = flow.idea!;
  const impact = idea.impact!;
  const [editing, setEditing] = useState<number | null>(null);

  if (impact.skipped) {
    return (
      <div className="rounded-2xl border border-border bg-card/60 p-6 animate-slide-up-fade">
        <p className="text-ui-base font-semibold text-foreground">Skipped for now</p>
        <p className="text-ui-sm text-muted-foreground mt-1 max-w-lg">
          Your business case will be a one-page narrative without dollar figures. Add rough numbers any time; it takes about a minute.
        </p>
        <button onClick={flow.addImpact} className="mt-4 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary/10 text-primary text-ui-sm font-medium hover:bg-primary/20">
          <Plus className="w-4 h-4" /> Add rough numbers
        </button>
      </div>
    );
  }

  const questions = impact.questions;
  const firstOpen = questions.findIndex(q => !impact.answers[q.key]);
  const active = editing ?? (firstOpen === -1 ? null : firstOpen);
  const q = active !== null ? questions[active] : null;
  const answeredCount = questions.filter(x => impact.answers[x.key]).length;

  const save = (key: string, label: string, value: number, source: 'you said' | 'assumed') => {
    flow.answerImpact(key, { label, value, source });
    setEditing(null);
  };

  const pick = (text: string) => {
    if (!q) return;
    const opt = q.options.find(o => o.label === text);
    const value = opt ? opt.value : parseNumber(text, q.unit);
    if (value === null) return;
    save(q.key, text, value, 'you said');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1.5">
        {questions.map((x, i) => (
          <button
            key={x.key}
            onClick={() => impact.answers[x.key] && setEditing(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === active ? 'w-8 bg-primary' : impact.answers[x.key] ? 'w-4 bg-emerald-500' : 'w-4 bg-secondary'
            }`}
          />
        ))}
        <span className="ml-2 text-ui-xs text-muted-foreground">{answeredCount} of {questions.length}</span>
        {impact.scope && <span className="ml-auto text-ui-xs text-muted-foreground truncate">Sized for {impact.scope.charAt(0).toLowerCase() + impact.scope.slice(1)}</span>}
      </div>

      {q && (
        <QuestionCard
          key={q.key}
          question={q.question}
          options={q.options.map(o => o.label)}
          selected={impact.answers[q.key]?.source === 'you said' ? impact.answers[q.key].label : undefined}
          suggested={closestOption(q)}
          hint={q.why}
          notSureLabel={ESTIMATE}
          onPick={pick}
          onNotSure={() => save(q.key, q.estimate.label, q.estimate.value, 'assumed')}
          validateOther={text => (parseNumber(text, q.unit) === null ? 'Include a number, like 20' : null)}
        />
      )}

      {!q && <ImpactRecap flow={flow} onEdit={setEditing} />}
    </div>
  );
}

function ImpactRecap({ flow, onEdit }: { flow: IdeaFlow; onEdit: (i: number) => void }) {
  const idea = flow.idea!;
  const impact = idea.impact!;
  const f = caseFigures(idea);
  if (!f) return null;
  const e = f.scenarios.expected;

  const tiles = [
    { label: 'Annual value', value: money(f.value.expected), note: `range ${money(f.value.low)} to ${money(f.value.high)}` },
    { label: 'First-year cost', value: money(e.firstYearCost), note: `${money(f.run.monthly)} a month to run` },
    { label: 'Return, year one', value: multiple(e.ratio), note: `${multiple(f.scenarios.cautious.ratio)} in the cautious case` },
    { label: 'Payback', value: payback(f.paybackMonths), note: 'after the one-time build' },
  ];

  return (
    <div className="space-y-4 animate-slide-up-fade">
      <p className="flex items-center gap-1.5 text-ui-2xs uppercase tracking-wider font-semibold text-emerald-400">
        <TrendingUp className="w-3.5 h-3.5" /> Here's what it could be worth
      </p>
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {tiles.map((t, i) => (
          <div key={t.label} className="rounded-2xl border border-border bg-card p-4 animate-cascade-in" style={{ animationDelay: `${i * 70}ms` }}>
            <p className="text-ui-2xs uppercase tracking-wider font-semibold text-muted-foreground">{t.label}</p>
            <p className="text-ui-2xl font-semibold text-foreground mt-1">{t.value}</p>
            <p className="text-ui-xs text-muted-foreground mt-0.5">{t.note}</p>
          </div>
        ))}
      </div>
      <p className="text-ui-xs text-muted-foreground">
        <span className="text-foreground/80 font-medium">{f.driverLabel}:</span> {f.formula}. Directional, at Databricks list price.
      </p>

      <div className="space-y-2">
        {impact.questions.map((x, i) => {
          const a = impact.answers[x.key];
          return (
            <button
              key={x.key}
              onClick={() => onEdit(i)}
              className="group w-full flex items-start gap-3 text-left rounded-xl border border-border bg-card/60 px-4 py-3 hover:border-primary/40 animate-cascade-in"
              style={{ animationDelay: `${200 + i * 50}ms` }}
            >
              <Check className="w-4 h-4 mt-0.5 text-emerald-400 shrink-0" />
              <span className="flex-1">
                <span className="block text-ui-xs text-muted-foreground">{x.question}</span>
                <span className="block text-ui-base text-foreground">
                  {a?.label}
                  {a?.source === 'assumed' && <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 text-ui-2xs">estimated</span>}
                </span>
              </span>
              <Pencil className="w-3.5 h-3.5 mt-1 text-muted-foreground opacity-0 group-hover:opacity-100" />
            </button>
          );
        })}
      </div>

      {(impact.assumed.length > 0 || f.costBasis.length > 0) && (
        <p className="text-ui-xs text-muted-foreground">
          <span className="text-foreground/80 font-medium">Also assumed:</span>{' '}
          {[...impact.assumed.map(a => `${a.label.toLowerCase()} ${f.inputs.find(i => i.key === a.key)?.display ?? a.value}`), `cost sized on ${f.costBasis.map(c => `${c.label.toLowerCase()} ${c.value}`).join(', ')}`].join('; ')}.
          {' '}The business case marks each one so you can check it.
        </p>
      )}
    </div>
  );
}
