import { useState } from 'react';
import { AlertTriangle, Check, Loader2, Pencil, Plus, RefreshCw, TrendingUp } from 'lucide-react';
import type { IdeaFlow } from '../engine/useIdeaFlow';
import { QuestionCard } from '../ui/QuestionCard';
import { AnswerTrail } from '../ui/AnswerTrail';
import { caseFigures } from '../engine/ideaContext';
import { RAMP, money, multiple, payback, pct, typicalRange, units } from '../engine/businessCase';
import type { ImpactQuestion } from '../engine/types';

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
        {!flow.readOnly && <button onClick={flow.addImpact} className="mt-4 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary/10 text-primary text-ui-sm font-medium hover:bg-primary/20">
          <Plus className="w-4 h-4" /> Add rough numbers
        </button>}
      </div>
    );
  }

  const questions = impact.questions;
  const firstOpen = questions.findIndex(q => !impact.answers[q.key]);
  const active = flow.readOnly ? null : editing ?? (firstOpen === -1 ? null : firstOpen);
  const q = active !== null ? questions[active] : null;
  const answeredCount = questions.filter(x => impact.answers[x.key]).length;
  const lastOpen = questions.filter(x => !impact.answers[x.key]).length <= 1;
  const trail = questions
    .map((x, index) => ({ key: x.key, index, question: x.question, answer: impact.answers[x.key]?.label ?? '', soft: impact.answers[x.key]?.source === 'assumed' }))
    .filter(x => x.answer);
  const typical = idea.useCaseContext?.valueProfile;

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
            disabled={flow.readOnly}
            onClick={() => impact.answers[x.key] && setEditing(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === active ? 'w-8 bg-primary' : impact.answers[x.key] ? 'w-4 bg-emerald-500' : 'w-4 bg-secondary'
            }`}
          />
        ))}
        <span className="ml-2 text-ui-xs text-muted-foreground">{answeredCount} of {questions.length}</span>
        {impact.scope && <span className="ml-auto text-ui-xs text-muted-foreground truncate">Sized for {impact.scope.charAt(0).toLowerCase() + impact.scope.slice(1)}</span>}
      </div>

      {q && <AnswerTrail items={trail} activeIndex={editing} onEdit={setEditing} />}

      {q && (
        <QuestionCard
          key={q.key}
          question={q.question}
          options={q.options.map(o => o.label)}
          selected={impact.answers[q.key]?.source === 'you said' ? impact.answers[q.key].label : undefined}
          recommended={closestOption(q)}
          recommendLabel="Best guess"
          reorder={false}
          hint={q.why}
          notSureLabel={ESTIMATE}
          confirmLabel={editing !== null || lastOpen ? 'Done' : 'Next'}
          onPick={pick}
          onNotSure={() => save(q.key, q.estimate.label, q.estimate.value, 'assumed')}
          validateOther={text => (parseNumber(text, q.unit) === null ? 'Include a number, like 20' : null)}
        />
      )}

      {q && answeredCount > 0 && <RunningEstimate flow={flow} />}

      {!q && <ImpactRecap flow={flow} onEdit={setEditing} />}

      {typical && idea.sourceUseCase && (
        <p className="text-ui-xs text-muted-foreground" title={typical.source === 'submitted' ? 'From a business case built for this use case' : 'Estimated from the use case description'}>
          Typical for {idea.sourceUseCase.label}: <span className="font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">{typicalRange(typical)}</span>
          {typical.rolloutFull && typical.rolloutUnit ? ` across about ${typical.rolloutFull} ${typical.rolloutUnit}` : ''}
          {typical.driverLabel ? `, mostly from ${typical.driverLabel.charAt(0).toLowerCase()}${typical.driverLabel.slice(1)}` : ''}.
        </p>
      )}
    </div>
  );
}

/** Value so far, with best guesses standing in for the questions not answered yet. */
function RunningEstimate({ flow }: { flow: IdeaFlow }) {
  const idea = flow.idea!;
  const impact = idea.impact!;
  const answers = { ...impact.answers };
  for (const x of impact.questions) answers[x.key] ??= { ...x.estimate, source: 'assumed' };
  const f = caseFigures({ ...idea, impact: { ...impact, answers } });
  if (!f) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ui-sm text-muted-foreground animate-fade-in">
      <TrendingUp className="w-4 h-4 text-emerald-500" />
      So far: <span className="text-foreground font-semibold">{money(f.value.expected)} a year</span>
      {f.rollout ? `at full rollout across ${units(f.rollout.units, f.rollout.unit)}` : ''}
      {f.hard > 0 && f.soft > 0 && <span className="text-ui-xs">({money(f.hard)} hard, {money(f.soft)} soft)</span>}
      <span className="text-ui-xs text-muted-foreground/70">Best guesses fill in the rest.</span>
    </p>
  );
}

function ImpactRecap({ flow, onEdit }: { flow: IdeaFlow; onEdit: (i: number) => void }) {
  const idea = flow.idea!;
  const impact = idea.impact!;
  const f = caseFigures(idea);
  if (!f) return null;
  const e = f.scenarios.expected;
  const rolloutNote = f.rollout ? `across ${units(f.rollout.units, f.rollout.unit)}` : impact.scope ? `for ${impact.scope.charAt(0).toLowerCase()}${impact.scope.slice(1)}` : '';
  const hardShare = f.value.expected > 0 ? f.hard / f.value.expected : 0;
  const looksSmall = f.value.expected < 100_000;

  const tiles = [
    { label: f.rollout ? 'Value at full rollout' : 'Annual value', value: `${money(f.value.expected)}/yr`, note: rolloutNote || `range ${money(f.value.low)} to ${money(f.value.high)}` },
    f.threeYear
      ? { label: 'Three years', value: money(f.threeYear.net), note: `net, as adoption ramps ${RAMP.map(pct).join(' / ')}` }
      : { label: 'First-year cost', value: money(e.firstYearCost), note: `${money(f.run.monthly)} a month to run` },
    { label: 'The pilot ask', value: money(f.ask.total), note: `build plus 3 months; ${multiple(f.ask.valueToAsk)} its yearly value` },
    { label: 'Payback', value: payback(f.paybackMonths), note: `${money(f.costOfDelay)} lost each month we wait` },
  ];

  return (
    <div className="space-y-4 animate-slide-up-fade">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex items-center gap-1.5 text-ui-2xs uppercase tracking-wider font-semibold text-emerald-400">
          <TrendingUp className="w-3.5 h-3.5" /> Here's what it could be worth
        </p>
        <span className={`px-1.5 py-0.5 rounded text-ui-2xs font-medium ${CONFIDENCE[f.confidence].tone}`}>{CONFIDENCE[f.confidence].label}</span>
        {!flow.readOnly && <button
          onClick={flow.refreshImpact}
          disabled={!!flow.loading}
          className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-ui-xs text-muted-foreground hover:text-foreground hover:bg-secondary/60 disabled:opacity-40"
          title="Re-size from your latest answers"
        >
          {flow.loading === 'impact' ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Refresh the numbers
        </button>}
      </div>

      {impact.fallbackModel && (
        <p className="flex items-start gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-ui-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Sized by a backup model ({impact.fallbackModel}) because the usual one was unavailable. Check the estimates, or refresh later.
        </p>
      )}

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {tiles.map((t, i) => (
          <div key={t.label} className="rounded-2xl border border-border bg-card p-4 animate-cascade-in" style={{ animationDelay: `${i * 70}ms` }}>
            <p className="text-ui-2xs uppercase tracking-wider font-semibold text-muted-foreground">{t.label}</p>
            <p className="text-ui-2xl font-semibold text-foreground mt-1">{t.value}</p>
            <p className="text-ui-xs text-muted-foreground mt-0.5">{t.note}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-ui-sm font-semibold text-foreground">Where the value comes from</p>
          <p className="text-ui-xs text-muted-foreground">
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">{money(f.hard)} hard</span>
            {f.soft > 0 && <> · <span className="text-sky-600 dark:text-sky-400 font-medium">{money(f.soft)} soft</span></>}
          </p>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden flex">
          <div className="h-full bg-emerald-500" style={{ width: pct(hardShare) }} />
          <div className="h-full bg-sky-400" style={{ width: pct(1 - hardShare) }} />
        </div>
        <div className="space-y-1.5">
          {f.levers.map(l => (
            <LeverRow key={l.driver} label={l.label} hard={l.hard} amount={money(l.counted)} formula={l.formula} />
          ))}
          {(impact.secondary ?? []).filter(s => impact.secondaryOff?.includes(s.driver)).map(s => (
            <LeverRow key={s.driver} label={s.label} hard={s.driver !== 'time_saved'} amount="off" formula="" muted onToggle={flow.readOnly ? undefined : () => flow.toggleLever(s.driver)} />
          ))}
        </div>
        {!flow.readOnly && f.levers.filter(l => !l.primary).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {f.levers.filter(l => !l.primary).map(l => (
              <button key={l.driver} onClick={() => flow.toggleLever(l.driver)} className="px-2 py-1 rounded-lg text-ui-2xs text-muted-foreground hover:text-foreground hover:bg-secondary/60">
                Leave out "{l.label}"
              </button>
            ))}
          </div>
        )}
        {f.soft > 0 && (
          <p className="text-ui-xs text-muted-foreground">
            Freed time counts at {pct(f.captureRate)} of {money(f.softGross)}
            {f.hoursFreed > 0 && <> ({Math.round(f.hoursFreed).toLocaleString()} hours a year, about {f.fte.toFixed(1)} people)</>}.
            {impact.captureWhy && <> {impact.captureWhy}</>}
          </p>
        )}
        {f.rollout && (
          <p className="text-ui-xs text-muted-foreground">
            Pilot: {money(f.pilot.value)} a year at {units(f.pilot.units, f.pilot.unit)}. Full rollout: {units(f.rollout.units, f.rollout.unit)}{f.rollout.why ? `, ${f.rollout.why.charAt(0).toLowerCase()}${f.rollout.why.slice(1)}` : ''}.
          </p>
        )}
      </div>

      {(looksSmall || f.flags.length > 0) && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.05] px-4 py-3 space-y-1.5">
          {looksSmall && (
            <p className="text-ui-sm text-foreground">
              <span className="font-medium">Looks small?</span>{' '}
              <span className="text-muted-foreground">Small numbers usually mean the scale is off: how many people do this work, how many {f.rollout?.unit || 'sites'} it would reach, or a costlier event it prevents. Edit an answer below, or ask for changes with that in mind.</span>
            </p>
          )}
          {f.flags.map(x => <p key={x} className="flex items-start gap-1.5 text-ui-xs text-amber-600 dark:text-amber-400"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {x}</p>)}
        </div>
      )}

      <div className="space-y-2">
        {impact.questions.map((x, i) => {
          const a = impact.answers[x.key];
          return (
            <button
              key={x.key}
              disabled={flow.readOnly}
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
              {!flow.readOnly && <Pencil className="w-3.5 h-3.5 mt-1 text-muted-foreground opacity-0 group-hover:opacity-100" />}
            </button>
          );
        })}
      </div>

      {(impact.assumed.length > 0 || f.costBasis.length > 0) && (
        <p className="text-ui-xs text-muted-foreground">
          <span className="text-foreground/80 font-medium">Also assumed:</span>{' '}
          {[
            ...impact.assumed.map(a => `${a.label.toLowerCase()} ${f.inputs.find(i => i.key === a.key)?.display ?? a.value}${a.fromAnswer ? ' (from your answers)' : ''}`),
            `cost sized on ${f.costBasis.map(c => `${c.label.toLowerCase()} ${c.value}`).join(', ')}`,
          ].join('; ')}.
          {' '}Directional, at Databricks list price. The business case marks each one so you can check it.
        </p>
      )}
    </div>
  );
}

const CONFIDENCE = {
  high: { label: 'Mostly your numbers', tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  medium: { label: 'Partly estimated', tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  low: { label: 'Mostly estimated', tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
} as const;

function LeverRow({ label, hard, amount, formula, muted, onToggle }: { label: string; hard: boolean; amount: string; formula: string; muted?: boolean; onToggle?: () => void }) {
  return (
    <div className={`flex items-start gap-2 ${muted ? 'opacity-50' : ''}`}>
      <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${hard ? 'bg-emerald-500' : 'bg-sky-400'}`} />
      <span className="flex-1 min-w-0">
        <span className="block text-ui-sm text-foreground">{label} <span className="text-ui-2xs text-muted-foreground">{hard ? 'hard dollars' : 'soft dollars'}</span></span>
        {formula && <span className="block text-ui-2xs text-muted-foreground truncate" title={formula}>{formula}</span>}
      </span>
      {onToggle
        ? <button onClick={onToggle} className="text-ui-xs text-primary hover:underline">Add back</button>
        : <span className="text-ui-sm font-medium text-foreground tabular-nums">{amount}</span>}
    </div>
  );
}
