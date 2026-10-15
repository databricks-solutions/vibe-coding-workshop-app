import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, CheckCircle2, Download, RefreshCw, Send, X } from 'lucide-react';
import { ExpandableErrorBanner } from '../../ExpandableErrorBanner';
import { STEP_ART } from '../art';
import { modeOf } from '../modes';
import { Thinking } from './Thinking';
import { SubmitDialog } from './SubmitDialog';
import { caseFigures, overallClarity } from '../engine/ideaContext';
import { RAMP, money, multiple, payback, pct, units, type CaseFigures } from '../engine/businessCase';
import { useIdeaFlow, type IdeaFlow } from '../engine/useIdeaFlow';
import type { CaseSummary, Idea } from '../engine/types';

interface BusinessCaseViewProps {
  flow: IdeaFlow;
  /** Back link or close button at the start of the toolbar. */
  leading: ReactNode;
  /** Takes people to the brief when it is not written yet. */
  onBackToFlow: () => void;
  /** Takes people to the Impact step to add numbers. */
  onAddNumbers: () => void;
}

/** The decision-ready business case one-pager, shared by Ideate and Insights. */
export function BusinessCaseView({ flow, leading, onBackToFlow, onAddNumbers }: BusinessCaseViewProps) {
  const { idea, loading, error } = flow;
  const [submitOpen, setSubmitOpen] = useState(false);
  const asked = useRef(false);

  useEffect(() => {
    if (!idea?.brief || idea.summary || loading || error || asked.current) return;
    asked.current = true;
    flow.generateSummary();
  }, [idea, loading, error, flow]);

  const opened = !idea || !!idea.caseOpenedAt || flow.readOnly;
  useEffect(() => {
    if (!opened) flow.patch({ caseOpenedAt: new Date().toISOString() });
  }, [opened, flow]);

  if (!idea) return null;

  const config = modeOf(idea);
  const figures = caseFigures(idea);
  const summary = idea.summary;

  const download = () => {
    const prev = document.title;
    document.title = `${idea.title} - Business case 1-pager`;
    window.addEventListener('afterprint', () => { document.title = prev; }, { once: true });
    window.print();
  };

  const regenerate = () => {
    flow.clearError();
    flow.generateSummary();
  };

  return (
    <>
      <div className="sticky top-0 z-10 bg-background/85 backdrop-blur border-b border-border/60">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-3">
          {leading}
          <p className="flex-1 text-ui-base font-semibold text-foreground truncate">Business case 1-pager</p>
          {summary && (
            <>
              <button onClick={regenerate} disabled={!!loading} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-ui-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 disabled:opacity-40">
                <RefreshCw className={`w-3.5 h-3.5 ${loading === 'summary' ? 'animate-spin' : ''}`} /> Regenerate
              </button>
              <button onClick={download} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-ui-sm font-medium hover:bg-secondary/80">
                <Download className="w-3.5 h-3.5" /> Download PDF
              </button>
              {config.briefOutcomes && idea.status === 'committed' && (
                idea.catalogRef ? (
                  <button onClick={() => setSubmitOpen(true)} title="Resubmit with your latest changes" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-ui-sm font-medium hover:bg-emerald-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">On the use case map</span>
                  </button>
                ) : (
                  <button onClick={() => setSubmitOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-ui-sm font-semibold hover:opacity-90">
                    <Send className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Submit to use case map</span>
                  </button>
                )
              )}
            </>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-5 py-8">
        {!idea.brief ? (
          <div className="text-center py-16">
            <p className="text-ui-lg font-semibold text-foreground">Finish the brief first</p>
            <p className="text-ui-sm text-muted-foreground mt-1">The business case is built from your approved brief.</p>
            <button onClick={onBackToFlow} className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-ui-sm font-semibold">
              Back to the flow <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : error && !summary ? (
          <div className="space-y-2">
            <ExpandableErrorBanner error={error} summary="Something went wrong writing the business case." />
            <button onClick={regenerate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-ui-sm text-primary hover:bg-primary/10">
              <RefreshCw className="w-3.5 h-3.5" /> Try again
            </button>
          </div>
        ) : !summary ? (
          <Thinking label="Writing your business case" image={STEP_ART.brief.image} />
        ) : (
          <>
            {!figures && (
              <p className="mb-4 text-ui-sm text-muted-foreground">
                No numbers yet, so this is a one-page narrative.{' '}
                <button onClick={onAddNumbers} className="text-primary hover:underline">Add rough numbers in the Impact step</button> for the full two-page case.
              </p>
            )}
            <div className="overflow-x-auto pb-4">
              <div className="w-[8.5in] mx-auto space-y-6">
                <CaseDocument idea={idea} summary={summary} figures={figures} />
              </div>
            </div>
            {createPortal(
              <div className="bc-print">
                <CaseDocument idea={idea} summary={summary} figures={figures} />
              </div>,
              document.body,
            )}
          </>
        )}
      </div>

      {submitOpen && <SubmitDialog idea={idea} onClose={() => setSubmitOpen(false)} />}
    </>
  );
}

interface BusinessCaseSheetProps {
  ideaId: string;
  onClose: () => void;
  onAddNumbers: () => void;
}

/** The business case as a full-screen sheet, for flows that do not have their own route for it. */
export function BusinessCaseSheet({ ideaId, onClose, onAddNumbers }: BusinessCaseSheetProps) {
  const flow = useIdeaFlow(ideaId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Business case 1-pager" className="fixed inset-0 z-50 overflow-y-auto bg-background animate-fade-in print:hidden">
      <BusinessCaseView
        flow={flow}
        leading={
          <button onClick={onClose} className="flex items-center gap-1 p-1.5 -ml-1.5 rounded-lg text-ui-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60" aria-label="Close business case">
            <X className="w-4 h-4" /> <span className="hidden sm:inline">Back to brief</span>
          </button>
        }
        onBackToFlow={onClose}
        onAddNumbers={onAddNumbers}
      />
    </div>,
    document.body,
  );
}

const DATE = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

function CaseDocument({ idea, summary, figures }: { idea: Idea; summary: CaseSummary; figures: CaseFigures | null }) {
  const config = modeOf(idea);
  const pages = figures ? 2 : 1;
  const scope = idea.impact?.scope;

  return (
    <>
      <Page n={1} of={pages} footer={`Shaped in ${config.caseSource}: ${idea.decisions.length} decisions, clarity ${overallClarity(idea)}%.${figures ? ' Figures are directional; the appendix shows every input.' : ''}`}>
        <div className="flex items-baseline justify-between">
          <Eyebrow>Business case 1-pager</Eyebrow>
          <span className="text-[11px] text-neutral-500">{DATE.format(new Date())}</span>
        </div>
        <h1 className="text-[26px] font-bold leading-tight text-neutral-900 mt-1">{idea.title}</h1>
        <p className="text-[12.5px] leading-relaxed text-neutral-700 mt-2">{summary.subtitle}</p>

        {figures && <HeroBand figures={figures} scope={scope} />}
        {figures && <KpiRow figures={figures} />}
        {figures && <ValueStack figures={figures} story={summary.valueStory} />}

        <div className="grid grid-cols-2 gap-5 mt-4">
          <Section title="The problem today"><p>{summary.problemToday}</p></Section>
          <Section title="Who it's for"><p>{summary.whoItsFor}</p></Section>
        </div>

        {summary.metric.label && <MetricBand metric={summary.metric} source={config.caseSource} />}

        <Section title="What we'll build" className="mt-4"><p>{summary.whatWeBuild}</p></Section>

        {!figures && <HowItWorks summary={summary} />}

        {(summary.pilotSuccess || summary.killCriterion) && (
          <div className="grid grid-cols-2 gap-2.5 mt-4">
            {summary.pilotSuccess && <Criterion tone="go" label="The pilot earns the rollout if" text={summary.pilotSuccess} />}
            {summary.killCriterion && <Criterion tone="stop" label="We stop if" text={summary.killCriterion} />}
          </div>
        )}

        {figures?.rollout && figures.threeYear && <RolloutStrip figures={figures} />}

        {figures ? <Decision summary={summary} figures={figures} /> : <Closing summary={summary} />}
      </Page>

      {figures && (
        <Page n={2} of={pages} footer="Directional estimate at Databricks list price, sized on the inputs shown. Confirm with your Databricks account team; check anything marked assumed.">
          <div className="flex items-baseline justify-between">
            <Eyebrow>Appendix: the numbers</Eyebrow>
            <span className="text-[11px] text-neutral-500 truncate ml-4">{idea.title}</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 mt-3">
            <ScenarioCard name="Cautious" s={figures.scenarios.cautious} />
            <ScenarioCard name="Expected" s={figures.scenarios.expected} primary />
            <ScenarioCard name="Upside" s={figures.scenarios.upside} />
          </div>
          <p className="text-[10px] text-neutral-500 mt-1.5">
            A year at full adoption. Cautious sets the lowest value against the highest cost; upside does the reverse.
            {scope && ` Inputs are sized for ${lower(scope)}${figures.rollout ? `, then multiplied to ${units(figures.rollout.units, figures.rollout.unit)}` : ''}.`}
          </p>

          <div className="grid grid-cols-[3fr_2fr] gap-5 mt-4">
            <Section title="Where the value comes from">
              <div className="space-y-2.5">
                {figures.levers.map(l => (
                  <div key={l.driver}>
                    <p className="flex justify-between gap-3 font-semibold text-neutral-900">
                      <span>{l.label} <span className={`text-[9px] uppercase tracking-wide ${l.hard ? 'text-teal-700' : 'text-sky-700'}`}>{l.hard ? 'hard' : 'soft'}</span></span>
                      <span>{money(l.counted)} a year</span>
                    </p>
                    <p className="text-[10px] text-neutral-500 mt-0.5">{l.formula}{!l.hard && `, counted at ${pct(figures.captureRate)}`}</p>
                    <ul className="mt-1 space-y-0.5">
                      {l.inputs.map(i => (
                        <li key={i.key} className="flex items-baseline justify-between gap-3 text-[10.5px]">
                          <span className="text-neutral-700">{i.label}: <span className="text-neutral-900 font-medium">{i.display}</span></span>
                          <SourceTag source={i.fromAnswer ? 'from answers' : i.source} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Section>
            <div className="space-y-4">
              <Section title="What the cost is sized on">
                <ul className="space-y-1">
                  {figures.costBasis.map(c => (
                    <li key={c.label} className="flex items-baseline justify-between gap-3 text-[11px]">
                      <span className="text-neutral-700">{c.label}: <span className="text-neutral-900 font-medium">{c.value}</span></span>
                      <SourceTag source="assumed" />
                    </li>
                  ))}
                </ul>
              </Section>
              <Section title={`Run cost: ${money(figures.run.monthly)} a month${figures.rollout ? ' at full rollout' : ''}`}>
                <ul className="space-y-1">
                  {figures.run.lines.map(l => (
                    <li key={l.label} className="flex justify-between text-[11px]">
                      <span className="text-neutral-700">{l.label}{figures.rollout ? ' (pilot)' : ''}</span>
                      <span className="text-neutral-900 font-medium">{money(l.monthly)}</span>
                    </li>
                  ))}
                  <li className="flex justify-between text-[11px] pt-1 border-t border-neutral-200">
                    <span className="text-neutral-700">One-time build</span>
                    <span className="text-neutral-900 font-medium">{money(figures.build.low)} to {money(figures.build.high)}</span>
                  </li>
                  {figures.rollout && figures.rollout.onboarding > 0 && (
                    <li className="flex justify-between text-[11px]">
                      <span className="text-neutral-700">Onboarding {units(figures.rollout.units - figures.pilot.units, figures.rollout.unit)}</span>
                      <span className="text-neutral-900 font-medium">{money(figures.rollout.onboarding)}</span>
                    </li>
                  )}
                </ul>
              </Section>
            </div>
          </div>

          <Section title={`Value against cost, first ${figures.curve.value.length - 1} months`} className="mt-4">
            <Chart curve={figures.curve} />
          </Section>

          <HowItWorks summary={summary} />

          <div className="grid grid-cols-2 gap-5 mt-4">
            <Section title="Risks and guards">
              <ul className="space-y-1.5">
                {summary.risks.map((r, i) => (
                  <li key={i} className="text-[11px] leading-snug">
                    <span className="text-neutral-900">{r.risk}</span> <span className="text-neutral-500">{r.guard}</span>
                  </li>
                ))}
              </ul>
            </Section>
            <Section title="Next steps">
              <ol className="space-y-1 list-decimal pl-4">
                {summary.nextSteps.map((x, i) => <li key={i} className="text-[11px] leading-snug text-neutral-700">{x}</li>)}
              </ol>
            </Section>
          </div>

          {figures.flags.length > 0 && (
            <Section title="Sanity checks" className="mt-4">
              <ul className="space-y-0.5">
                {figures.flags.map(f => <li key={f} className="text-[10.5px] text-amber-700">{f}</li>)}
              </ul>
            </Section>
          )}
        </Page>
      )}
    </>
  );
}

const CONFIDENCE_LABEL = { high: 'Mostly your numbers', medium: 'Partly estimated', low: 'Mostly estimated' } as const;

function HeroBand({ figures, scope }: { figures: CaseFigures; scope?: string }) {
  const f = figures;
  return (
    <div className="mt-4 rounded-lg bg-neutral-900 text-white px-5 py-4 grid grid-cols-[1.4fr_1fr] gap-5 items-center">
      <div>
        <p className="text-[9px] uppercase tracking-[0.18em] font-semibold text-[#5eead4]">{f.rollout ? 'Value at full rollout' : 'Annual value'}</p>
        <p className="text-[34px] font-bold leading-none mt-1.5">{money(f.value.expected)}<span className="text-[15px] font-semibold text-neutral-300"> a year</span></p>
        <p className="text-[10.5px] text-neutral-300 mt-1.5">
          {f.rollout ? `Across ${units(f.rollout.units, f.rollout.unit)}. ` : scope ? `For ${lower(scope)}. ` : ''}
          Range {money(f.value.low)} to {money(f.value.high)}. {CONFIDENCE_LABEL[f.confidence]}.
        </p>
      </div>
      <div className="border-l border-white/15 pl-5 space-y-1.5">
        <p className="text-[9px] uppercase tracking-[0.18em] font-semibold text-[#5eead4]">The ask</p>
        <p className="text-[20px] font-bold leading-none">{money(f.ask.total)}</p>
        <p className="text-[10.5px] text-neutral-300 leading-snug">
          Build plus three months of {f.rollout ? `a ${units(f.pilot.units, f.pilot.unit)} pilot` : 'the pilot'}, worth {money(f.pilot.value)} a year on its own ({multiple(f.ask.valueToAsk)} the ask).
        </p>
      </div>
    </div>
  );
}

function KpiRow({ figures: f }: { figures: CaseFigures }) {
  const hardShare = f.value.expected > 0 ? f.hard / f.value.expected : 0;
  return (
    <div className="grid grid-cols-4 gap-2.5 mt-3">
      {f.threeYear
        ? <Kpi label="Three-year net" value={money(f.threeYear.net)} note={`${multiple(f.threeYear.ratio)} return as adoption ramps`} />
        : <Kpi label="Net, year one" value={money(f.scenarios.expected.net)} note={`${multiple(f.scenarios.expected.ratio)} return`} />}
      <Kpi label="Hard dollars" value={money(f.hard)} note={`${pct(hardShare)} of the value is cost or revenue`} />
      <Kpi label="Payback" value={payback(f.paybackMonths)} note={`breaks even at ${pct(Math.min(1, f.breakEvenShare))} of the estimate`} />
      <Kpi label="Cost of waiting" value={`${money(f.costOfDelay)}`} note="of value lost each month" />
    </div>
  );
}

function ValueStack({ figures: f, story }: { figures: CaseFigures; story?: string }) {
  const total = Math.max(1, f.levers.reduce((a, l) => a + l.counted, 0));
  return (
    <Section title="Where the value comes from" className="mt-4">
      <div className="flex h-3 rounded-full overflow-hidden bg-neutral-100">
        {f.levers.map(l => (
          <div key={l.driver} className={l.hard ? (l.primary ? 'bg-teal-600' : 'bg-teal-400') : 'bg-sky-400'} style={{ width: `${(l.counted / total) * 100}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-1.5">
        {f.levers.map(l => (
          <span key={l.driver} className="flex items-center gap-1.5 text-[10.5px] text-neutral-700">
            <span className={`w-2 h-2 rounded-full ${l.hard ? (l.primary ? 'bg-teal-600' : 'bg-teal-400') : 'bg-sky-400'}`} />
            {l.label}: <span className="font-semibold text-neutral-900">{money(l.counted)}</span>
            <span className="text-neutral-500">{l.hard ? 'hard' : `soft, ${pct(f.captureRate)} of ${money(l.gross)}`}</span>
          </span>
        ))}
      </div>
      {(story || f.hoursFreed > 0) && (
        <p className="text-[10.5px] text-neutral-600 mt-1.5">
          {story}{story && f.hoursFreed > 0 ? ' ' : ''}
          {f.hoursFreed > 0 && `Frees about ${Math.round(f.hoursFreed).toLocaleString()} hours a year, roughly ${f.fte.toFixed(1)} people's time.`}
        </p>
      )}
    </Section>
  );
}

function MetricBand({ metric, source }: { metric: CaseSummary['metric']; source: string }) {
  return (
    <div className="mt-4 rounded-lg bg-teal-50 border border-teal-100 px-4 py-3 flex items-center gap-6">
      <div className="flex-1">
        <Eyebrow>{metric.label}</Eyebrow>
        <p className="text-[10px] text-neutral-500 mt-0.5">Baseline and target from the {source} session.</p>
      </div>
      <div className="text-right">
        <p className="text-[9px] uppercase tracking-wider text-neutral-500">Today</p>
        <p className="text-[18px] font-bold text-neutral-900">{metric.today}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-teal-600" />
      <div>
        <p className="text-[9px] uppercase tracking-wider text-neutral-500">Target</p>
        <p className="text-[18px] font-bold text-teal-700">{metric.target}</p>
      </div>
    </div>
  );
}

function Criterion({ tone, label, text }: { tone: 'go' | 'stop'; label: string; text: string }) {
  return (
    <div className={`rounded-lg border px-3.5 py-2.5 ${tone === 'go' ? 'border-teal-200 bg-teal-50/60' : 'border-neutral-200 bg-neutral-50'}`}>
      <p className={`text-[9px] uppercase tracking-wider font-semibold ${tone === 'go' ? 'text-teal-700' : 'text-neutral-500'}`}>{label}</p>
      <p className="text-[11px] leading-snug text-neutral-800 mt-1">{text}</p>
    </div>
  );
}

function RolloutStrip({ figures: f }: { figures: CaseFigures }) {
  const r = f.rollout!;
  const years = f.threeYear!.years;
  const steps = [
    { k: 'Pilot', v: money(f.pilot.value), note: `${units(f.pilot.units, f.pilot.unit)}, a year` },
    ...years.map((y, i) => ({ k: `Year ${i + 1}`, v: money(y.value), note: `${pct(RAMP[i])} of ${units(r.units, r.unit)}` })),
  ];
  return (
    <Section title="From pilot to full rollout" className="mt-4">
      <div className="grid grid-cols-4 gap-1.5">
        {steps.map((x, i) => (
          <div key={x.k} className={`rounded-md px-3 py-2 ${i === 0 ? 'bg-neutral-100' : 'bg-teal-50'}`}>
            <p className="text-[9px] uppercase tracking-wider font-semibold text-neutral-500">{x.k}</p>
            <p className="text-[15px] font-bold text-neutral-900 leading-tight">{x.v}</p>
            <p className="text-[9.5px] text-neutral-500">{x.note}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Decision({ summary, figures }: { summary: CaseSummary; figures: CaseFigures }) {
  return (
    <div className="mt-4 rounded-lg bg-neutral-900 text-white px-4 py-3">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[9px] uppercase tracking-[0.18em] font-semibold text-[#5eead4]">The decision</p>
        {summary.sponsor && <p className="text-[9.5px] text-neutral-400">For: {summary.sponsor}</p>}
      </div>
      <p className="text-[12.5px] leading-snug mt-1">{summary.decision || `Approve ${money(figures.ask.total)} for the pilot.`}</p>
      {(summary.costOfInaction || !!summary.unlocksNext?.length) && (
        <p className="text-[10px] text-neutral-400 mt-1.5">
          {summary.costOfInaction}
          {summary.costOfInaction && summary.unlocksNext?.length ? ' ' : ''}
          {!!summary.unlocksNext?.length && `Then, on the same data: ${summary.unlocksNext.join(', ')}.`}
        </p>
      )}
    </div>
  );
}

function HowItWorks({ summary }: { summary: CaseSummary }) {
  return (
    <>
      <div className="grid grid-cols-4 gap-2.5 mt-3">
        {summary.workflowSteps.map((s, i) => (
          <div key={i} className="rounded-lg border border-neutral-200 p-3">
            <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
            <p className="text-[11px] leading-snug text-neutral-700 mt-2">{s}</p>
          </div>
        ))}
      </div>
      <Section title="How it's built on Databricks" className="mt-4">
        <div className="grid grid-cols-4 gap-2.5">
          {([['Your data', summary.stack.data], ['Shape it', summary.stack.shape], ['Serve it', summary.stack.serve], ['Use it', summary.stack.use]] as const).map(([k, v]) => (
            <div key={k} className="rounded-lg bg-neutral-50 border border-neutral-200 p-3">
              <p className="text-[9px] uppercase tracking-wider font-semibold text-neutral-500">{k}</p>
              <p className={`text-[11px] leading-snug mt-1 ${v === 'Not needed' ? 'text-neutral-400' : 'text-neutral-800'}`}>{v}</p>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}

function Closing({ summary, hideRisks }: { summary: CaseSummary; hideRisks?: boolean }) {
  return (
    <>
      <div className={`grid gap-5 mt-4 ${hideRisks ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {!hideRisks && (
          <Section title="Risks and guards">
            <ul className="space-y-1.5">
              {summary.risks.map((r, i) => (
                <li key={i} className="text-[11px] leading-snug">
                  <span className="text-neutral-900">{r.risk}</span> <span className="text-neutral-500">{r.guard}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}
        <Section title="Next steps">
          <ol className="space-y-1 list-decimal pl-4">
            {summary.nextSteps.map((s, i) => <li key={i} className="text-[11px] leading-snug text-neutral-700">{s}</li>)}
          </ol>
        </Section>
      </div>
      {summary.decision && (
        <div className="mt-4 rounded-lg bg-neutral-900 text-white px-4 py-3">
          <p className="text-[9px] uppercase tracking-[0.18em] font-semibold text-[#5eead4]">The decision</p>
          <p className="text-[12.5px] leading-snug mt-1">{summary.decision}</p>
        </div>
      )}
    </>
  );
}

function Page({ n, of, footer, children }: { n: number; of: number; footer: string; children: ReactNode }) {
  return (
    <section className="bc-page bg-white text-neutral-800 shadow-xl rounded-sm w-[8.5in] min-h-[11in] p-[0.5in] flex flex-col font-sans">
      <div className="flex-1">{children}</div>
      <div className="flex items-end justify-between gap-6 pt-3 mt-3 border-t border-neutral-200 text-[9.5px] text-neutral-500">
        <span>{footer}</span>
        <span className="shrink-0">{n} / {of}</span>
      </div>
    </section>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-teal-700">{children}</p>;
}

function Section({ title, className = '', children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <div className={className}>
      <p className="text-[9.5px] uppercase tracking-[0.16em] font-semibold text-neutral-500 mb-1.5">{title}</p>
      <div className="text-[11.5px] leading-relaxed text-neutral-800">{children}</div>
    </div>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 px-3 py-2.5">
      <p className="text-[9px] uppercase tracking-wider font-semibold text-neutral-500">{label}</p>
      <p className="text-[22px] font-bold text-neutral-900 leading-tight mt-0.5">{value}</p>
      <p className="text-[9.5px] text-neutral-500">{note}</p>
    </div>
  );
}

function ScenarioCard({ name, s, primary }: { name: string; s: CaseFigures['scenarios']['expected']; primary?: boolean }) {
  return (
    <div className={`rounded-lg px-3.5 py-3 ${primary ? 'border-2 border-teal-600 bg-teal-50/50' : 'border border-neutral-200'}`}>
      <p className="flex items-center justify-between text-[9px] uppercase tracking-wider font-semibold text-neutral-500">
        {name} {primary && <span className="text-teal-700">Primary estimate</span>}
      </p>
      <p className={`text-[20px] font-bold leading-tight mt-1 ${s.net < 0 ? 'text-neutral-900' : 'text-teal-700'}`}>{money(s.net)}</p>
      <p className="text-[9.5px] text-neutral-500">net, a full year</p>
      <dl className="mt-2 space-y-0.5 text-[10.5px]">
        <Row k="Value a year" v={money(s.value)} />
        <Row k="First-year cost" v={money(s.firstYearCost)} />
        <Row k="Return" v={multiple(s.ratio)} />
      </dl>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-neutral-500">{k}</dt>
      <dd className="text-neutral-900 font-medium">{v}</dd>
    </div>
  );
}

function SourceTag({ source }: { source: 'you said' | 'assumed' | 'from answers' }) {
  return (
    <span className={`shrink-0 text-[9px] font-semibold uppercase tracking-wide ${source === 'assumed' ? 'text-amber-600' : 'text-teal-700'}`}>
      {source}
    </span>
  );
}

function Chart({ curve }: { curve: CaseFigures['curve'] }) {
  const W = 720;
  const H = 120;
  const P = { l: 44, r: 8, t: 8, b: 20 };
  const max = Math.max(...curve.value, ...curve.cost, 1);
  const months = Math.max(1, curve.value.length - 1);
  const x = (m: number) => P.l + (m / months) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  const path = (pts: number[]) => pts.map((v, m) => `${m ? 'L' : 'M'}${x(m).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const ticks = [0, max / 2, max];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Cumulative value against cumulative cost over ${months} months`}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="#e5e5e5" strokeWidth={1} />
            <text x={P.l - 6} y={y(t) + 3} textAnchor="end" fontSize={9} fill="#737373">{money(t)}</text>
          </g>
        ))}
        {[0, 1, 2, 3, 4].map(q => Math.round((q * months) / 4)).map(m => (
          <text key={m} x={x(m)} y={H - 4} textAnchor={m === 0 ? 'start' : m === months ? 'end' : 'middle'} fontSize={9} fill="#737373">
            {m === 0 ? 'Start' : `Month ${m}`}
          </text>
        ))}
        <path d={path(curve.cost)} fill="none" stroke="#737373" strokeWidth={2} strokeDasharray="5 4" />
        <path d={path(curve.value)} fill="none" stroke="#0d9488" strokeWidth={2.5} />
      </svg>
      <div className="flex gap-5 text-[10px] text-neutral-600 mt-1">
        <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-teal-600" /> Cumulative value</span>
        <span className="flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-neutral-500" /> Cumulative cost: build, then running</span>
      </div>
    </div>
  );
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
