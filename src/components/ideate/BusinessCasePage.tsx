import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Download, Menu, RefreshCw, Send } from 'lucide-react';
import { useIdeaFlow } from '../../hooks/useIdeaFlow';
import { ExpandableErrorBanner } from '../ExpandableErrorBanner';
import { Thinking } from './StepFooter';
import { SubmitDialog } from './SubmitDialog';
import { STEP_ART } from './art';
import { caseFigures, overallClarity } from './ideaContext';
import { money, multiple, payback, type CaseFigures } from './businessCase';
import type { CaseSummary, Idea } from './types';

export function BusinessCasePage({ onOpenMobileNav }: { onOpenMobileNav?: () => void }) {
  const { ideaId = '' } = useParams();
  const flow = useIdeaFlow(ideaId);
  const { idea, loading, error } = flow;
  const [submitOpen, setSubmitOpen] = useState(false);
  const asked = useRef(false);

  useEffect(() => {
    if (!idea?.brief || idea.summary || loading || error || asked.current) return;
    asked.current = true;
    flow.generateSummary();
  }, [idea, loading, error, flow]);

  if (!idea) return <Navigate to="/ideate" replace />;

  const figures = caseFigures(idea);
  const summary = idea.summary;

  const download = () => {
    const prev = document.title;
    document.title = `${idea.title} - Business case`;
    window.addEventListener('afterprint', () => { document.title = prev; }, { once: true });
    window.print();
  };

  const regenerate = () => {
    flow.clearError();
    flow.generateSummary();
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-background">
      <div className="sticky top-0 z-10 bg-background/85 backdrop-blur border-b border-border/60">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-3">
          {onOpenMobileNav && (
            <button onClick={onOpenMobileNav} className="md:hidden p-2 -ml-2 rounded-lg hover:bg-secondary" aria-label="Open navigation">
              <Menu className="w-5 h-5" />
            </button>
          )}
          <Link to={`/ideate/${idea.id}`} className="flex items-center gap-1 text-ui-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back to brief</span>
          </Link>
          <p className="flex-1 text-ui-base font-semibold text-foreground truncate">Business case</p>
          {summary && (
            <>
              <button onClick={regenerate} disabled={!!loading} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-ui-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 disabled:opacity-40">
                <RefreshCw className={`w-3.5 h-3.5 ${loading === 'summary' ? 'animate-spin' : ''}`} /> Regenerate
              </button>
              <button onClick={download} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-foreground text-ui-sm font-medium hover:bg-secondary/80">
                <Download className="w-3.5 h-3.5" /> Download PDF
              </button>
              {idea.status === 'committed' && (
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
            <Link to={`/ideate/${idea.id}`} className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-ui-sm font-semibold">
              Back to the flow <ArrowRight className="w-4 h-4" />
            </Link>
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
                <Link to={`/ideate/${idea.id}`} className="text-primary hover:underline">Add rough numbers in the Impact step</Link> for the full two-page case.
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
    </div>
  );
}

const DATE = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

function CaseDocument({ idea, summary, figures }: { idea: Idea; summary: CaseSummary; figures: CaseFigures | null }) {
  const pages = figures ? 2 : 1;
  const e = figures?.scenarios.expected;
  const scope = idea.impact?.scope;

  return (
    <>
      <Page n={1} of={pages} footer={`Shaped in Ideate: ${idea.decisions.length} decisions, clarity ${overallClarity(idea)}%.`}>
        <div className="flex items-baseline justify-between">
          <Eyebrow>Business case</Eyebrow>
          <span className="text-[11px] text-neutral-500">{DATE.format(new Date())}</span>
        </div>
        <h1 className="text-[26px] font-bold leading-tight text-neutral-900 mt-1">{idea.title}</h1>
        <p className="text-[12.5px] leading-relaxed text-neutral-700 mt-2">{summary.subtitle}</p>
        {scope && figures && <p className="text-[11px] text-neutral-500 mt-2">Sized for {lower(scope)}. Every figure below uses this scope.</p>}

        {figures && e && (
          <div className="grid grid-cols-4 gap-2.5 mt-4">
            <Kpi label="Annual value" value={money(figures.value.expected)} note={`range ${money(figures.value.low)} to ${money(figures.value.high)}`} />
            <Kpi label="First-year cost" value={money(e.firstYearCost)} note={`${money(figures.run.monthly)} a month to run`} />
            <Kpi label="Return, year one" value={multiple(e.ratio)} note={`${multiple(figures.scenarios.cautious.ratio)} in the cautious case`} />
            <Kpi label="Payback" value={payback(figures.paybackMonths)} note="after the one-time build" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-5 mt-5">
          <Section title="The problem today"><p>{summary.problemToday}</p></Section>
          <Section title="Who it's for"><p>{summary.whoItsFor}</p></Section>
        </div>

        {summary.metric.label && (
          <div className="mt-4 rounded-lg bg-teal-50 border border-teal-100 px-4 py-3 flex items-center gap-6">
            <div className="flex-1">
              <Eyebrow>{summary.metric.label}</Eyebrow>
              <p className="text-[10px] text-neutral-500 mt-0.5">Baseline and target from the Ideate session.</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-wider text-neutral-500">Today</p>
              <p className="text-[18px] font-bold text-neutral-900">{summary.metric.today}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-teal-600" />
            <div>
              <p className="text-[9px] uppercase tracking-wider text-neutral-500">Target</p>
              <p className="text-[18px] font-bold text-teal-700">{summary.metric.target}</p>
            </div>
          </div>
        )}

        <Section title="What we'll build" className="mt-4"><p>{summary.whatWeBuild}</p></Section>

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

        {!figures && <Closing summary={summary} />}
      </Page>

      {figures && e && (
        <Page n={2} of={pages} footer="Directional estimate at Databricks list price, sized on the inputs shown. Confirm with your Databricks account team; check anything marked assumed.">
          <div className="flex items-baseline justify-between">
            <Eyebrow>The numbers</Eyebrow>
            <span className="text-[11px] text-neutral-500 truncate ml-4">{idea.title}</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5 mt-3">
            <ScenarioCard name="Cautious" s={figures.scenarios.cautious} />
            <ScenarioCard name="Expected" s={e} primary />
            <ScenarioCard name="Upside" s={figures.scenarios.upside} />
          </div>
          <p className="text-[10px] text-neutral-500 mt-1.5">Cautious sets the lowest value against the highest cost; upside does the reverse. Expected uses the middle of both.</p>

          <div className="grid grid-cols-[3fr_2fr] gap-5 mt-4">
            <Section title="Where the value comes from">
              <p className="flex justify-between font-semibold text-neutral-900">
                <span>{figures.driverLabel}</span>
                <span>{money(figures.value.low)} to {money(figures.value.high)} a year</span>
              </p>
              <p className="text-[10.5px] text-neutral-500 mt-0.5">{figures.formula}</p>
              <ul className="mt-2 space-y-1">
                {figures.inputs.map(i => (
                  <li key={i.key} className="flex items-baseline justify-between gap-3 text-[11px]">
                    <span className="text-neutral-700">{i.label}: <span className="text-neutral-900 font-medium">{i.display}</span></span>
                    <SourceTag source={i.source} />
                  </li>
                ))}
              </ul>
            </Section>
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
          </div>

          <Section title="Value against cost, first 12 months" className="mt-4">
            <Chart curve={figures.curve} />
          </Section>

          <div className="grid grid-cols-2 gap-5 mt-4">
            <Section title={`Run cost: ${money(figures.run.monthly)} a month, expected`}>
              <ul className="space-y-1">
                {figures.run.lines.map(l => (
                  <li key={l.label} className="flex justify-between text-[11px]">
                    <span className="text-neutral-700">{l.label}</span>
                    <span className="text-neutral-900 font-medium">{money(l.monthly)}</span>
                  </li>
                ))}
                <li className="flex justify-between text-[11px] pt-1 border-t border-neutral-200">
                  <span className="text-neutral-700">One-time: workshop day, then hardening</span>
                  <span className="text-neutral-900 font-medium">{money(figures.build.low)} to {money(figures.build.high)}</span>
                </li>
              </ul>
            </Section>
            <Section title="Risks and guards">
              <ul className="space-y-1.5">
                {summary.risks.map((r, i) => (
                  <li key={i} className="text-[11px] leading-snug">
                    <span className="text-neutral-900">{r.risk}</span> <span className="text-neutral-500">{r.guard}</span>
                  </li>
                ))}
              </ul>
            </Section>
          </div>

          <Closing summary={summary} hideRisks />
        </Page>
      )}
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
      <p className="text-[9.5px] text-neutral-500">net, year one</p>
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

function SourceTag({ source }: { source: 'you said' | 'assumed' }) {
  return (
    <span className={`shrink-0 text-[9px] font-semibold uppercase tracking-wide ${source === 'you said' ? 'text-teal-700' : 'text-amber-600'}`}>
      {source}
    </span>
  );
}

function Chart({ curve }: { curve: CaseFigures['curve'] }) {
  const W = 720;
  const H = 120;
  const P = { l: 44, r: 8, t: 8, b: 20 };
  const max = Math.max(...curve.value, ...curve.cost, 1);
  const x = (m: number) => P.l + (m / 12) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - v / max) * (H - P.t - P.b);
  const path = (pts: number[]) => pts.map((v, m) => `${m ? 'L' : 'M'}${x(m).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const ticks = [0, max / 2, max];

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Cumulative value against cumulative cost over 12 months">
        {ticks.map(t => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="#e5e5e5" strokeWidth={1} />
            <text x={P.l - 6} y={y(t) + 3} textAnchor="end" fontSize={9} fill="#737373">{money(t)}</text>
          </g>
        ))}
        {[0, 3, 6, 9, 12].map(m => (
          <text key={m} x={x(m)} y={H - 4} textAnchor={m === 0 ? 'start' : m === 12 ? 'end' : 'middle'} fontSize={9} fill="#737373">
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
