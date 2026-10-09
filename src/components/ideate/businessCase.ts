import type { CostProfile, Impact, ImpactDriver, ImpactSource, ShapeOption } from './types';

/**
 * Deterministic business case math. The AI only proposes inputs; every figure
 * shown to the user is computed here so it is explainable and repeatable.
 * Prices are directional Databricks list-price approximations.
 */

interface InputSpec {
  key: string;
  label: string;
  unit: string;
  fallback: number;
}

export const DRIVERS: Record<ImpactDriver, { label: string; formula: string; inputs: InputSpec[] }> = {
  time_saved: {
    label: 'Time saved',
    formula: 'minutes saved per event x events per day x people involved x days per year x loaded hourly rate',
    inputs: [
      { key: 'baseline_minutes', label: 'Time per event today', unit: 'minutes', fallback: 30 },
      { key: 'target_minutes', label: 'Time per event after', unit: 'minutes', fallback: 10 },
      { key: 'events_per_day', label: 'Events per day', unit: 'events', fallback: 5 },
      { key: 'people_per_event', label: 'People involved each time', unit: 'people', fallback: 1 },
      { key: 'days_per_year', label: 'Days per year', unit: 'days', fallback: 250 },
      { key: 'hourly_rate', label: 'Loaded hourly rate', unit: '$/hour', fallback: 60 },
    ],
  },
  cost_avoided: {
    label: 'Cost avoided',
    formula: 'costly events per year x share avoided x cost per event',
    inputs: [
      { key: 'events_per_year', label: 'Costly events per year', unit: 'events', fallback: 50 },
      { key: 'reduction_pct', label: 'Share avoided', unit: '%', fallback: 20 },
      { key: 'cost_per_event', label: 'Cost per event', unit: '$', fallback: 5000 },
    ],
  },
  revenue_uplift: {
    label: 'Revenue uplift',
    formula: 'volume per year x uplift x value per unit',
    inputs: [
      { key: 'volume_per_year', label: 'Volume per year', unit: 'units', fallback: 10000 },
      { key: 'uplift_pct', label: 'Uplift', unit: '%', fallback: 2 },
      { key: 'value_per_unit', label: 'Value per unit', unit: '$', fallback: 100 },
    ],
  },
};

export interface ResolvedInput {
  key: string;
  label: string;
  value: number;
  unit: string;
  display: string;
  source: ImpactSource;
}

export interface CostLine {
  label: string;
  monthly: number;
}

export interface Scenario {
  value: number;
  firstYearCost: number;
  net: number;
  ratio: number;
}

export interface CaseFigures {
  driverLabel: string;
  formula: string;
  inputs: ResolvedInput[];
  value: { low: number; expected: number; high: number };
  run: { monthly: number; lines: CostLine[] };
  build: { low: number; high: number };
  scenarios: { cautious: Scenario; expected: Scenario; upside: Scenario };
  paybackMonths: number | null;
  curve: { value: number[]; cost: number[] };
  costBasis: { label: string; value: string }[];
}

const RATE = {
  warehousePerHour: 2.8,
  pipelinePerHour: 3,
  appPerHour: 0.48,
  lakebasePerHour: 0.4,
  storagePerGbMonth: 0.023,
  servingPerRequest: 0.01,
};

const RUNS_PER_DAY = { daily: 1, hourly: 24, frequent: 96, streaming: 0 } as const;
const TRANSFORM_FACTOR = { light: 0.6, medium: 1, heavy: 1.8 } as const;
const BUILD_RANGE: Record<string, [number, number]> = { S: [5000, 10000], M: [7200, 14000], L: [12000, 25000] };
const REFRESH_LABEL = { daily: 'daily', hourly: 'hourly', frequent: 'every 15 minutes', streaming: 'streaming' } as const;

export const DEFAULT_COST: CostProfile = { dataGbPerDay: 1, refresh: 'daily', transforms: 'medium', users: 10, hoursPerDay: 10 };

export function skippedImpact(): Impact {
  return { skipped: true, driver: 'time_saved', driverLabel: '', scope: '', questions: [], answers: {}, assumed: [], cost: DEFAULT_COST };
}

export const hasNumbers = (impact?: Impact): impact is Impact => !!impact && !impact.skipped && impact.questions.length > 0;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function formatInput(value: number, unit: string) {
  if (unit === '$') return money(value);
  if (unit === '$/hour') return `${money(value)}/hour`;
  if (unit === '%') return `${trim(value)}%`;
  if (value === 1 && unit === 'people') return '1 person';
  return `${trim(value)} ${unit}`;
}

function resolveInputs(impact: Impact): ResolvedInput[] {
  return DRIVERS[impact.driver].inputs.map(spec => {
    const answer = impact.answers[spec.key];
    const assumed = impact.assumed.find(a => a.key === spec.key);
    const value = answer?.value ?? assumed?.value ?? spec.fallback;
    const question = impact.questions.find(q => q.key === spec.key);
    const unit = question?.unit || assumed?.unit || spec.unit;
    return {
      key: spec.key,
      label: spec.label,
      value,
      unit,
      display: answer?.label && answer.source === 'you said' ? answer.label : formatInput(value, unit),
      source: answer?.source ?? 'assumed',
    };
  });
}

function annualValue(driver: ImpactDriver, v: Record<string, number>) {
  switch (driver) {
    case 'time_saved':
      return Math.max(0, v.baseline_minutes - v.target_minutes) / 60 * v.events_per_day * v.people_per_event * v.days_per_year * v.hourly_rate;
    case 'cost_avoided':
      return v.events_per_year * (v.reduction_pct / 100) * v.cost_per_event;
    case 'revenue_uplift':
      return v.volume_per_year * (v.uplift_pct / 100) * v.value_per_unit;
  }
}

function runCost(cost: CostProfile, surfaces: string[]): CostLine[] {
  const has = (s: string) => surfaces.some(x => x.toLowerCase().includes(s));
  const factor = TRANSFORM_FACTOR[cost.transforms];
  const runHours = (5 + cost.dataGbPerDay * 2 * factor) / 60;
  const pipelines = cost.refresh === 'streaming'
    ? 720 * RATE.pipelinePerHour * 1.5 * factor
    : RUNS_PER_DAY[cost.refresh] * 30 * runHours * RATE.pipelinePerHour;
  const lines: CostLine[] = [
    { label: has('app') ? 'SQL warehouse (app reads)' : 'SQL warehouse', monthly: cost.hoursPerDay * 30 * RATE.warehousePerHour * clamp(cost.users / 10, 0.5, 3) },
    { label: 'Declarative Pipelines', monthly: pipelines },
  ];
  if (has('agent')) lines.push({ label: 'Model Serving (agent)', monthly: 150 + cost.users * 20 * 30 * RATE.servingPerRequest });
  if (has('app')) lines.push({ label: 'Databricks App', monthly: 720 * RATE.appPerHour });
  if (has('lakebase')) lines.push({ label: 'Lakebase', monthly: 720 * RATE.lakebasePerHour });
  const subtotal = lines.reduce((a, l) => a + l.monthly, 0);
  lines.push({ label: 'Dev and test', monthly: subtotal * 0.2 });
  lines.push({ label: 'Storage', monthly: cost.dataGbPerDay * 365 * RATE.storagePerGbMonth });
  return lines.sort((a, b) => b.monthly - a.monthly);
}

function scenario(value: number, monthly: number, build: number): Scenario {
  const firstYearCost = monthly * 12 + build;
  return { value, firstYearCost, net: value - firstYearCost, ratio: firstYearCost ? value / firstYearCost : 0 };
}

export function computeCase(impact: Impact, shape: ShapeOption | null): CaseFigures {
  const spec = DRIVERS[impact.driver];
  const inputs = resolveInputs(impact);
  const byKey = Object.fromEntries(inputs.map(i => [i.key, i.value]));
  const expected = annualValue(impact.driver, byKey);
  const assumedCount = inputs.filter(i => i.source === 'assumed').length;
  const spread = Math.min(0.35, 0.1 + 0.05 * assumedCount);
  const value = { low: expected * (1 - spread), expected, high: expected * (1 + spread) };

  const lines = runCost(impact.cost, shape?.surfaces ?? []);
  const monthly = lines.reduce((a, l) => a + l.monthly, 0);
  const [buildLow, buildHigh] = BUILD_RANGE[shape?.effort ?? 'M'] ?? BUILD_RANGE.M;
  const buildMid = (buildLow + buildHigh) / 2;

  const net = expected / 12 - monthly;
  const curve = { value: [] as number[], cost: [] as number[] };
  for (let m = 0; m <= 12; m++) {
    curve.value.push((expected / 12) * m);
    curve.cost.push(buildMid + monthly * m);
  }

  return {
    driverLabel: impact.driverLabel || spec.label,
    formula: spec.formula,
    inputs,
    value,
    run: { monthly, lines },
    build: { low: buildLow, high: buildHigh },
    scenarios: {
      cautious: scenario(value.low, monthly * 1.3, buildHigh),
      expected: scenario(expected, monthly, buildMid),
      upside: scenario(value.high, monthly * 0.65, buildLow),
    },
    paybackMonths: net > 0 ? Math.max(1, Math.ceil(buildMid / net)) : null,
    curve,
    costBasis: [
      { label: 'Data', value: `${trim(impact.cost.dataGbPerDay)} GB a day` },
      { label: 'Refresh', value: REFRESH_LABEL[impact.cost.refresh] },
      { label: 'Transforms', value: impact.cost.transforms },
      { label: 'Users', value: String(impact.cost.users) },
      { label: 'In use', value: `${impact.cost.hoursPerDay} h a day` },
    ],
  };
}

/** Compact plain-text version of the figures, for prompts and catalog submissions. */
export function figuresAsContext(f: CaseFigures) {
  return {
    annualValue: `${money(f.value.expected)} (range ${money(f.value.low)} to ${money(f.value.high)})`,
    valueComesFrom: `${f.driverLabel}: ${f.formula}`,
    inputs: f.inputs.map(i => `${i.label}: ${i.display} (${i.source})`),
    firstYearCost: money(f.scenarios.expected.firstYearCost),
    monthlyRunCost: money(f.run.monthly),
    oneTimeBuild: `${money(f.build.low)} to ${money(f.build.high)}`,
    returnYearOne: multiple(f.scenarios.expected.ratio),
    payback: payback(f.paybackMonths),
  };
}

function trim(n: number) {
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function money(n: number) {
  const sign = n < 0 ? '-' : '';
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${sign}$${(a / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (a >= 10_000) return `${sign}$${Math.round(a / 1000)}k`;
  if (a >= 1000) return `${sign}$${(a / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${sign}$${Math.round(a)}`;
}

export const multiple = (r: number) => `${r >= 10 ? Math.round(r) : r.toFixed(1)}x`;

export const payback = (months: number | null) => (months === null ? 'n/a' : months > 36 ? '36+ months' : `${months} month${months === 1 ? '' : 's'}`);
