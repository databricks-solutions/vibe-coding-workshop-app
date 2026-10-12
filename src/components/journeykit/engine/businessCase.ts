import { ROLLOUT_KEY, type CostProfile, type Impact, type ImpactDriver, type ImpactSource, type ShapeOption, type ValueProfile } from './types';

/**
 * Deterministic business case math. The AI only proposes inputs; every figure
 * shown to the user is computed here so it is explainable and repeatable.
 * Prices are directional Databricks list-price approximations.
 *
 * Inputs are sized for the pilot scope. A rollout multiplies them up to every
 * unit the idea would reach. Hard dollars (cost avoided, revenue gained) count
 * in full; soft dollars (time freed) count at the capture rate.
 */

interface InputSpec {
  key: string;
  label: string;
  unit: string;
  fallback: number;
}

export const DRIVERS: Record<ImpactDriver, { label: string; formula: string; hard: boolean; inputs: InputSpec[] }> = {
  time_saved: {
    label: 'Time saved',
    hard: false,
    formula: 'minutes saved per event x events per person per day x people doing the work x people per event x days per year x loaded hourly rate',
    inputs: [
      { key: 'baseline_minutes', label: 'Time per event today', unit: 'minutes', fallback: 30 },
      { key: 'target_minutes', label: 'Time per event after', unit: 'minutes', fallback: 10 },
      { key: 'events_per_day', label: 'Events per person per day', unit: 'events', fallback: 5 },
      { key: 'headcount', label: 'People doing this work', unit: 'people', fallback: 1 },
      { key: 'people_per_event', label: 'People involved each time', unit: 'people', fallback: 1 },
      { key: 'days_per_year', label: 'Days per year', unit: 'days', fallback: 250 },
      { key: 'hourly_rate', label: 'Loaded hourly rate', unit: '$/hour', fallback: 60 },
    ],
  },
  cost_avoided: {
    label: 'Cost avoided',
    hard: true,
    formula: 'costly events per year x share avoided x cost per event',
    inputs: [
      { key: 'events_per_year', label: 'Costly events per year', unit: 'events', fallback: 50 },
      { key: 'reduction_pct', label: 'Share avoided', unit: '%', fallback: 20 },
      { key: 'cost_per_event', label: 'Cost per event', unit: '$', fallback: 5000 },
    ],
  },
  revenue_uplift: {
    label: 'Revenue uplift',
    hard: true,
    formula: 'volume per year x uplift x value per unit',
    inputs: [
      { key: 'volume_per_year', label: 'Volume per year', unit: 'units', fallback: 10000 },
      { key: 'uplift_pct', label: 'Uplift', unit: '%', fallback: 2 },
      { key: 'value_per_unit', label: 'Value per unit', unit: '$', fallback: 100 },
    ],
  },
};

/** Inputs a secondary lever may leave out without the lever being made up. */
const SAFE_DEFAULTS: Record<string, number> = { headcount: 1, people_per_event: 1, days_per_year: 250 };

export const HOURS_PER_FTE = 1800;
export const DEFAULT_CAPTURE = 0.5;
/** Share of full-rollout value reached in years one, two and three. */
export const RAMP = [0.4, 0.85, 1] as const;
/** Each unit beyond the pilot adds this share of the pilot's run cost; the platform is shared. */
const RUN_SCALE_PER_UNIT = 0.35;
/** Onboarding each unit beyond the pilot costs this share of the build, capped at three builds. */
const ONBOARD_PER_UNIT = 0.15;

export interface ResolvedInput {
  key: string;
  label: string;
  value: number;
  unit: string;
  display: string;
  source: ImpactSource;
  fromAnswer?: boolean;
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

export interface LeverFigure {
  driver: ImpactDriver;
  label: string;
  formula: string;
  hard: boolean;
  primary: boolean;
  /** Annual value at full rollout before the capture rate. */
  gross: number;
  /** What counts toward the headline: gross for hard dollars, gross x capture rate for soft. */
  counted: number;
  inputs: ResolvedInput[];
}

export interface YearFigure {
  value: number;
  cost: number;
}

export type Confidence = 'low' | 'medium' | 'high';

export interface CaseFigures {
  driverLabel: string;
  formula: string;
  inputs: ResolvedInput[];
  levers: LeverFigure[];
  /** Annual value at full rollout, once adoption has ramped up. */
  value: { low: number; expected: number; high: number };
  hard: number;
  soft: number;
  /** Freed time before the capture rate. */
  softGross: number;
  captureRate: number;
  pilot: { value: number; units: number; unit: string; monthly: number };
  rollout: { units: number; unit: string; why: string; monthly: number; onboarding: number } | null;
  run: { monthly: number; lines: CostLine[] };
  build: { low: number; high: number };
  scenarios: { cautious: Scenario; expected: Scenario; upside: Scenario };
  paybackMonths: number | null;
  threeYear: { years: YearFigure[]; value: number; cost: number; net: number; ratio: number } | null;
  curve: { value: number[]; cost: number[] };
  hoursFreed: number;
  fte: number;
  costOfDelay: number;
  /** Share of the estimate that already covers the first-year cost. */
  breakEvenShare: number;
  /** The pilot approval: build plus three months of running it. */
  ask: { build: number; run: number; total: number; valueToAsk: number };
  confidence: Confidence;
  flags: string[];
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

/** Ideas sized before rollouts and soft-dollar discounting keep their original figures. */
const isLegacy = (impact: Impact) => impact.captureRate === undefined && impact.rollout === undefined && impact.secondary === undefined;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function formatInput(value: number, unit: string) {
  if (unit === '$') return money(value);
  if (unit === '$/hour') return `${money(value)}/hour`;
  if (unit === '%') return `${trim(value)}%`;
  if (value === 1 && unit === 'people') return '1 person';
  return `${trim(value)} ${unit}`;
}

function resolveInputs(impact: Impact, legacy: boolean): ResolvedInput[] {
  const specs = DRIVERS[impact.driver].inputs.filter(s => !legacy || s.key !== 'headcount' || impact.answers.headcount || impact.assumed.some(a => a.key === 'headcount'));
  return specs.map(spec => {
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
      fromAnswer: !answer && assumed?.fromAnswer,
    };
  });
}

/** Inputs of a secondary lever, or null when it is missing a number it cannot default. */
function resolveSecondary(driver: ImpactDriver, given: Impact['assumed']): ResolvedInput[] | null {
  const out: ResolvedInput[] = [];
  for (const spec of DRIVERS[driver].inputs) {
    const a = given.find(x => x.key === spec.key);
    const value = a?.value ?? SAFE_DEFAULTS[spec.key];
    if (value === undefined) return null;
    const unit = a?.unit || spec.unit;
    out.push({ key: spec.key, label: a?.label || spec.label, value, unit, display: formatInput(value, unit), source: 'assumed' });
  }
  return out;
}

function annualValue(driver: ImpactDriver, v: Record<string, number>) {
  switch (driver) {
    case 'time_saved':
      return Math.max(0, v.baseline_minutes - v.target_minutes) / 60 * v.events_per_day * (v.headcount ?? 1) * v.people_per_event * v.days_per_year * v.hourly_rate;
    case 'cost_avoided':
      return v.events_per_year * (v.reduction_pct / 100) * v.cost_per_event;
    case 'revenue_uplift':
      return v.volume_per_year * (v.uplift_pct / 100) * v.value_per_unit;
  }
}

function hoursOf(driver: ImpactDriver, v: Record<string, number>) {
  return driver === 'time_saved' && v.hourly_rate > 0 ? annualValue(driver, v) / v.hourly_rate : 0;
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

function scenario(value: number, monthly: number, upfront: number): Scenario {
  const firstYearCost = monthly * 12 + upfront;
  return { value, firstYearCost, net: value - firstYearCost, ratio: firstYearCost ? value / firstYearCost : 0 };
}

function confidenceOf(inputs: ResolvedInput[], rolloutAnswered: boolean, hasRollout: boolean): Confidence {
  const known = inputs.filter(i => i.source === 'you said' || i.fromAnswer).length + (rolloutAnswered ? 1 : 0);
  const share = known / (inputs.length + (hasRollout ? 1 : 0));
  return share >= 0.6 ? 'high' : share >= 0.3 ? 'medium' : 'low';
}

function sanityFlags(byKey: Record<string, number>, levers: LeverFigure[], value: number, hard: number) {
  const flags: string[] = [];
  if (byKey.reduction_pct > 50) flags.push(`Avoiding ${trim(byKey.reduction_pct)}% of costly events is aggressive for a first version; 10% to 30% is more typical.`);
  if (byKey.uplift_pct > 10) flags.push(`A ${trim(byKey.uplift_pct)}% uplift is aggressive; most first versions move revenue 1% to 5%.`);
  if (byKey.hourly_rate > 200) flags.push(`A loaded rate of ${money(byKey.hourly_rate)}/hour is high for most roles.`);
  if (value > 0 && hard / value < 0.3 && levers.some(l => !l.hard)) flags.push('Most of the value is freed time. Finance may discount it unless the time is redeployed.');
  if (value > 50_000_000) flags.push('Over $50M a year is rare for one build. Check the scale and the rollout count.');
  return flags;
}

export function computeCase(impact: Impact, shape: ShapeOption | null): CaseFigures {
  const spec = DRIVERS[impact.driver];
  const legacy = isLegacy(impact);
  const inputs = resolveInputs(impact, legacy);
  const byKey = Object.fromEntries(inputs.map(i => [i.key, i.value]));
  const capture = legacy ? 1 : clamp(impact.captureRate ?? DEFAULT_CAPTURE, 0.1, 1);

  const r = impact.rollout;
  const pilotUnits = Math.max(1, r?.pilot ?? 1);
  const answeredUnits = impact.answers[ROLLOUT_KEY]?.value;
  const fullUnits = r ? Math.max(pilotUnits, answeredUnits ?? r.full) : pilotUnits;
  const scale = fullUnits / pilotUnits;

  const raw: { driver: ImpactDriver; label: string; inputs: ResolvedInput[]; primary: boolean }[] = [
    { driver: impact.driver, label: impact.driverLabel || spec.label, inputs, primary: true },
  ];
  for (const s of impact.secondary ?? []) {
    if (s.driver === impact.driver || impact.secondaryOff?.includes(s.driver) || raw.some(l => l.driver === s.driver)) continue;
    const resolved = resolveSecondary(s.driver, s.inputs);
    if (resolved) raw.push({ driver: s.driver, label: s.label || DRIVERS[s.driver].label, inputs: resolved, primary: false });
  }
  let hoursPilot = 0;
  const levers: LeverFigure[] = raw.map(l => {
    const v = Object.fromEntries(l.inputs.map(i => [i.key, i.value]));
    const hard = DRIVERS[l.driver].hard;
    const gross = annualValue(l.driver, v) * scale;
    hoursPilot += hoursOf(l.driver, v);
    return { ...l, formula: DRIVERS[l.driver].formula, hard, gross, counted: hard ? gross : gross * capture };
  });

  const hard = levers.filter(l => l.hard).reduce((a, l) => a + l.counted, 0);
  const soft = levers.filter(l => !l.hard).reduce((a, l) => a + l.counted, 0);
  const softGross = levers.filter(l => !l.hard).reduce((a, l) => a + l.gross, 0);
  const expected = hard + soft;
  const assumedCount = inputs.filter(i => i.source === 'assumed' && !i.fromAnswer).length + (r && answeredUnits === undefined ? 1 : 0);
  const spread = Math.min(0.35, 0.1 + 0.05 * assumedCount + (levers.length - 1) * 0.03);
  const value = { low: expected * (1 - spread), expected, high: expected * (1 + spread) };

  const lines = runCost(impact.cost, shape?.surfaces ?? []);
  const pilotMonthly = lines.reduce((a, l) => a + l.monthly, 0);
  const monthly = pilotMonthly * (1 + RUN_SCALE_PER_UNIT * (scale - 1));
  const [buildLow, buildHigh] = BUILD_RANGE[shape?.effort ?? 'M'] ?? BUILD_RANGE.M;
  const buildMid = (buildLow + buildHigh) / 2;
  const onboarding = Math.min(buildMid * 3, buildMid * ONBOARD_PER_UNIT * Math.max(0, fullUnits - pilotUnits));
  const upfront = buildMid + onboarding;

  const scenarios = {
    cautious: scenario(value.low, monthly * 1.3, buildHigh + onboarding),
    expected: scenario(expected, monthly, upfront),
    upside: scenario(value.high, monthly * 0.65, buildLow + onboarding),
  };
  const netMonthly = expected / 12 - monthly;

  const curve = { value: [] as number[], cost: [] as number[] };
  let threeYear: CaseFigures['threeYear'] = null;
  if (legacy || !r) {
    for (let m = 0; m <= 12; m++) {
      curve.value.push((expected / 12) * m);
      curve.cost.push(upfront + monthly * m);
    }
  } else {
    const years: YearFigure[] = RAMP.map((ramp, y) => ({
      value: expected * ramp,
      cost: (pilotMonthly + (monthly - pilotMonthly) * ramp) * 12 + (y === 0 ? upfront : 0),
    }));
    const v3 = years.reduce((a, y) => a + y.value, 0);
    const c3 = years.reduce((a, y) => a + y.cost, 0);
    threeYear = { years, value: v3, cost: c3, net: v3 - c3, ratio: c3 ? v3 / c3 : 0 };
    let cv = 0;
    let cc = upfront;
    curve.value.push(0);
    curve.cost.push(cc);
    for (let m = 1; m <= 36; m++) {
      const ramp = RAMP[Math.min(2, Math.floor((m - 1) / 12))];
      cv += (expected * ramp) / 12;
      cc += pilotMonthly + (monthly - pilotMonthly) * ramp;
      curve.value.push(cv);
      curve.cost.push(cc);
    }
  }

  const pilotValue = scale > 0 ? expected / scale : expected;
  const askRun = pilotMonthly * 3;
  const hoursFreed = hoursPilot * scale;

  return {
    driverLabel: impact.driverLabel || spec.label,
    formula: spec.formula,
    inputs,
    levers,
    value,
    hard,
    soft,
    softGross,
    captureRate: capture,
    pilot: { value: pilotValue, units: pilotUnits, unit: r?.unit ?? '', monthly: pilotMonthly },
    rollout: r ? { units: fullUnits, unit: r.unit, why: r.why, monthly, onboarding } : null,
    run: { monthly, lines },
    build: { low: buildLow, high: buildHigh },
    scenarios,
    paybackMonths: netMonthly > 0 ? Math.max(1, Math.ceil(upfront / netMonthly)) : null,
    threeYear,
    curve,
    hoursFreed,
    fte: hoursFreed / HOURS_PER_FTE,
    costOfDelay: expected / 12,
    breakEvenShare: expected > 0 ? scenarios.expected.firstYearCost / expected : 0,
    ask: { build: buildMid, run: askRun, total: buildMid + askRun, valueToAsk: buildMid + askRun > 0 ? pilotValue / (buildMid + askRun) : 0 },
    confidence: confidenceOf(inputs, answeredUnits !== undefined, !!r),
    flags: legacy ? [] : sanityFlags(byKey, levers, expected, hard),
    costBasis: [
      { label: 'Data', value: `${trim(impact.cost.dataGbPerDay)} GB a day` },
      { label: 'Refresh', value: REFRESH_LABEL[impact.cost.refresh] },
      { label: 'Transforms', value: impact.cost.transforms },
      { label: 'Users', value: String(impact.cost.users) },
      { label: 'In use', value: `${impact.cost.hoursPerDay} h a day` },
    ],
  };
}

export const pct = (share: number) => `${Math.round(share * 100)}%`;

export const units = (n: number, unit: string) => `${trim(n)} ${n === 1 ? unit.replace(/(?<!s)s$/, '') : unit}`.trim();

/** Compact plain-text version of the figures, for prompts and catalog submissions. */
export function figuresAsContext(f: CaseFigures) {
  const ctx: Record<string, unknown> = {
    annualValue: `${money(f.value.expected)} a year${f.rollout ? ` at full rollout (${units(f.rollout.units, f.rollout.unit)})` : ''} (range ${money(f.value.low)} to ${money(f.value.high)})`,
    hardVsSoft: `${money(f.hard)} hard dollars, ${money(f.soft)} soft dollars (freed time counted at ${pct(f.captureRate)})`,
    valueComesFrom: f.levers.map(l => `${l.label} (${l.hard ? 'hard' : 'soft'}, ${money(l.counted)} a year): ${l.formula}`),
    inputs: f.inputs.map(i => `${i.label}: ${i.display} (${i.fromAnswer ? 'from your answers' : i.source})`),
    firstYearCost: money(f.scenarios.expected.firstYearCost),
    monthlyRunCost: money(f.run.monthly),
    oneTimeBuild: `${money(f.build.low)} to ${money(f.build.high)}`,
    returnYearOne: multiple(f.scenarios.expected.ratio),
    payback: payback(f.paybackMonths),
    costOfDelay: `${money(f.costOfDelay)} for each month of waiting`,
    pilotAsk: `${money(f.ask.total)} (build plus three months of running the pilot), ${multiple(f.ask.valueToAsk)} the pilot's annual value`,
    confidence: f.confidence,
  };
  if (f.rollout) ctx.pilotValue = `${money(f.pilot.value)} a year for the pilot (${units(f.pilot.units, f.pilot.unit)})`;
  if (f.threeYear) ctx.threeYear = `${money(f.threeYear.value)} value against ${money(f.threeYear.cost)} cost over three years as adoption ramps ${RAMP.map(pct).join(', ')}`;
  if (f.hoursFreed > 0) ctx.timeFreed = `${trim(Math.round(f.hoursFreed))} hours a year, about ${f.fte.toFixed(1)} FTE`;
  return ctx;
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

/** "$500k to $2M a year", or a single figure when the range collapses. */
export function typicalRange(p: Pick<ValueProfile, 'typicalLow' | 'typicalHigh'>) {
  const lo = money(p.typicalLow), hi = money(p.typicalHigh);
  return lo === hi ? `about ${hi} a year` : `${lo} to ${hi} a year`;
}

/** The profile a submitted idea leaves behind, so the next idea from the same use case starts from its numbers. */
export function valueProfileFrom(impact: Impact, f: CaseFigures, valuePool = ''): ValueProfile {
  const share = f.hard + f.soft > 0 ? f.hard / (f.hard + f.soft) : 0;
  return {
    driver: impact.driver,
    driverLabel: f.driverLabel,
    valuePool,
    typicalLow: Math.round(f.value.low),
    typicalHigh: Math.round(f.value.high),
    rolloutUnit: f.rollout?.unit ?? f.pilot.unit,
    rolloutFull: f.rollout?.units ?? null,
    hardShare: share >= 0.7 ? 'mostly hard' : share <= 0.3 ? 'mostly soft' : 'mixed',
  };
}

export const multiple = (r: number) => `${r >= 10 ? Math.round(r) : r.toFixed(1)}x`;

export const payback = (months: number | null) => (months === null ? 'n/a' : months > 36 ? '36+ months' : `${months} month${months === 1 ? '' : 's'}`);
