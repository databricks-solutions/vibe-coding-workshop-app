import type { BlueprintDigest, BlueprintKpi } from './types';

export type Confidence = 'strong' | 'partial' | 'none';

export interface Recipe {
  question: string;
  kpi: BlueprintKpi | null;
  measure: BlueprintKpi['measures'][number] | null;
  slice: BlueprintKpi['slices'][number] | null;
  confidence: Confidence;
  /** Other good KPIs for the same question, best first. */
  alternatives: BlueprintKpi[];
}

const STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'by', 'with', 'is', 'are', 'was', 'were', 'be', 'our', 'we',
  'my', 'your', 'their', 'what', 'which', 'who', 'where', 'when', 'how', 'why', 'do', 'does', 'did', 'have', 'has', 'most',
  'top', 'about', 'this', 'that', 'these', 'those', 'from', 'at', 'it', 'its', 'than', 'vs', 'versus', 'per', 'each', 'all',
  'any', 'much', 'many', 'between', 'into', 'over', 'under', 'below', 'above', 'going', 'get', 'show', 'me', 'list', 'give',
  'change', 'changed', 'drove', 'driving', 'drive', 'trending', 'trend', 'last', 'next', 'this', 'month', 'week', 'quarter',
  'year', 'today', 'yesterday', 'run', 'out', 'longest', 'highest', 'lowest', 'best', 'worst', 'often', 'likely', 'rising',
  'falling', 'growing', 'declining', 'increasing', 'decreasing', 'biggest', 'smallest', 'more', 'less', 'least', 'can', 'should',
]);

const TIME_WORDS = /\b(trend|trending|over time|month|monthly|week|weekly|quarter|quarterly|year|yearly|daily|day|last|since|yoy|mom)\b/i;

const SYNONYMS: Record<string, string[]> = {
  sale: ['revenue', 'sales', 'gmv', 'merchandise', 'amount', 'net'],
  revenue: ['sales', 'gmv', 'amount', 'income', 'fee'],
  margin: ['gross', 'profit', 'markup'],
  stock: ['inventory', 'hand', 'atp', 'stockout', 'supply'],
  inventory: ['stock', 'hand', 'supply'],
  churn: ['attrition', 'cancel', 'cancellation', 'disconnect', 'retention', 'downgrade'],
  wait: ['wait', 'delay', 'queue', 'time', 'turnaround'],
  readmission: ['readmit', 'readmission', 'return'],
  downtime: ['downtime', 'outage', 'stoppage', 'availability', 'oee'],
  scrap: ['scrap', 'defect', 'yield', 'waste', 'reject'],
  late: ['delay', 'delayed', 'late', 'otd', 'time'],
  delivery: ['delivery', 'shipment', 'otd', 'fulfillment'],
  occupancy: ['occupancy', 'occupied', 'room', 'night'],
  cancellation: ['cancel', 'cancellation', 'cancelled'],
  rate: ['rate', 'pct', 'percent', 'ratio'],
  adr: ['average', 'daily', 'rate'],
  spend: ['spend', 'revenue', 'amount', 'value'],
  delinquency: ['delinquent', 'delinquency', 'past', 'due', 'default', 'arrears'],
  deposit: ['deposit', 'balance'],
  fee: ['fee', 'charge', 'income'],
  promotion: ['promotion', 'promo', 'campaign', 'discount', 'markdown'],
  basket: ['basket', 'order', 'transaction', 'aov', 'ticket'],
  store: ['store', 'location', 'site', 'branch'],
  branch: ['branch', 'location', 'store'],
  product: ['product', 'sku', 'item', 'merchandise'],
  customer: ['customer', 'member', 'account', 'client', 'subscriber'],
  subscriber: ['subscriber', 'subscription', 'customer', 'account'],
  patient: ['patient', 'member', 'encounter', 'visit'],
  clinic: ['clinic', 'facility', 'department', 'location'],
  department: ['department', 'unit', 'service', 'line'],
  plan: ['plan', 'subscription', 'tariff', 'package'],
  region: ['region', 'geography', 'territory', 'market', 'country', 'state'],
  supplier: ['supplier', 'vendor'],
  claim: ['claim', 'denial', 'denied'],
  denial: ['denial', 'denied', 'reject'],
  budget: ['budget', 'cost', 'spend', 'variance'],
  cost: ['cost', 'expense', 'spend'],
  target: ['target', 'goal', 'plan', 'variance'],
  loyalty: ['loyalty', 'tier', 'member', 'points'],
  engagement: ['engagement', 'view', 'watch', 'session', 'stream'],
  content: ['content', 'title', 'program', 'asset'],
  loan: ['loan', 'credit', 'lending'],
  booking: ['booking', 'reservation'],
  channel: ['channel', 'source'],
  segment: ['segment', 'tier', 'type', 'cohort'],
  property: ['property', 'hotel', 'site'],
  procedure: ['procedure', 'cpt', 'service'],
  production: ['production', 'work', 'order', 'line'],
  line: ['line', 'asset', 'equipment', 'machine'],
  plant: ['plant', 'site', 'facility'],
  arpu: ['arpu', 'revenue', 'average'],
};

function stem(w: string): string {
  if (w.length > 5 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('es') && !w.endsWith('ses')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(w => w && !STOP.has(w) && !/^\d+$/.test(w))
    .map(stem);
}

function expand(words: string[], weight = 1): Map<string, number> {
  const out = new Map<string, number>();
  for (const w of words) {
    out.set(w, Math.max(out.get(w) ?? 0, weight));
    for (const syn of SYNONYMS[w] ?? []) {
      const st = stem(syn);
      out.set(st, Math.max(out.get(st) ?? 0, weight * 0.45));
    }
  }
  return out;
}

/** "Which customer segments ..." names the grouping, not the number. */
function subjectWords(question: string): string[] {
  const m = question.toLowerCase().match(/\b(?:which|what|whose|top\s+\d+|top)\s+([a-z ]+)/);
  if (!m) return [];
  const out: string[] = [];
  for (const w of m[1].split(/\s+/)) {
    if (!w || STOP.has(w) || out.length === 2) break;
    out.push(stem(w));
  }
  return out;
}

/** "... by channel" names the slice outright. */
function byWords(question: string): string[] {
  if (/\btop\s*\d*\s+[a-z]+(?:\s+[a-z]+)?\s+by\b/i.test(question)) return [];
  const m = question.toLowerCase().match(/\b(?:by|per|across|for each)\s+([a-z ]+)/);
  return m ? tokens(m[1]).slice(0, 2) : [];
}

const COUNT_WORDS = /\b(how many|number of|count of)\b/i;

/** Rare words ("readmission") should outweigh common ones ("rate", "total"). */
const idfCache = new WeakMap<BlueprintDigest, Map<string, number>>();
function idfFor(digest: BlueprintDigest): Map<string, number> {
  let idf = idfCache.get(digest);
  if (idf) return idf;
  const df = new Map<string, number>();
  let n = 0;
  for (const k of digest.kpis) {
    for (const m of k.measures) {
      n += 1;
      for (const t of new Set(tokens(`${m.name.replace(/_/g, ' ')} ${m.label} ${k.label}`))) df.set(t, (df.get(t) ?? 0) + 1);
    }
  }
  idf = new Map([...df.entries()].map(([t, c]) => [t, Math.min(3, Math.max(0.35, Math.log(n / c) / 2.2))]));
  idfCache.set(digest, idf);
  return idf;
}

const scorer = (bag: Map<string, number>, idf: Map<string, number>) => (text: string) => {
  let score = 0;
  const seen = new Set<string>();
  for (const t of tokens(text)) {
    if (seen.has(t)) continue;
    seen.add(t);
    const w = bag.get(t);
    if (w) score += w * (idf.get(t) ?? 1);
  }
  return score;
};

const WEAK_MEASURE = /(^|_)(row|record)_?count$|_id$|latitude|longitude|sequence|version|checksum|data_quality/i;
const WEAK_SLICE = /_id$|_number$|_code$|address|line_?\d|email|phone|postal|zip|url|description|comment|note/i;

const keyOf = (s: string) => s.toLowerCase().replace(/[\s-]+/g, '_');

export function matchQuestion(question: string, digest: BlueprintDigest): Recipe {
  const idf = idfFor(digest);
  const all = tokens(question);
  const subject = new Set(subjectWords(question));
  const rest = all.filter(w => !subject.has(w));
  const measureBag = expand(rest);
  for (const [w, v] of expand([...subject], 0.35)) measureBag.set(w, Math.max(measureBag.get(w) ?? 0, v));
  const directBag = new Map(rest.map(w => [w, 1]));
  const sliceBag = expand(all);
  for (const w of subject) sliceBag.set(w, 1.5);
  for (const w of byWords(question)) sliceBag.set(w, 2.5);
  const wantsCount = COUNT_WORDS.test(question);

  const mScore = scorer(measureBag, idf);
  const mDirect = scorer(directBag, idf);
  const sScore = scorer(sliceBag, idf);
  const wantsTime = TIME_WORDS.test(question);
  const areaLabel = new Map(digest.areas.map(a => [a.name, a.label]));

  type Scored = { kpi: BlueprintKpi; score: number; measure: Recipe['measure']; slice: Recipe['slice']; direct: number };
  const scored: Scored[] = [];

  for (const kpi of digest.kpis) {
    const context = mScore(`${kpi.label} ${areaLabel.get(kpi.area) ?? ''}`) * 0.6 + mScore(kpi.description) * 0.25;
    let bestM: Recipe['measure'] = null;
    let best = -1;
    let direct = 0;
    for (const m of kpi.measures) {
      if (WEAK_MEASURE.test(keyOf(m.name))) continue;
      const text = `${m.name.replace(/_/g, ' ')} ${m.label}`;
      const s = mScore(text) * 2 + mScore(m.comment) * 0.4 + (wantsCount && m.agg === 'count' ? 0.8 : 0);
      if (s > best) { best = s; bestM = m; direct = mDirect(text); }
    }
    if (!bestM) continue;

    let bestS: Recipe['slice'] = null;
    let bestSl = -1;
    for (const sl of kpi.slices) {
      if (WEAK_SLICE.test(keyOf(sl.name))) continue;
      let s = sScore(`${sl.name.replace(/_/g, ' ')} ${sl.label}`) * 1.5 + sScore(sl.comment) * 0.2;
      if (wantsTime && sl.kind === 'time') s += 1.5;
      if (!wantsTime && sl.kind === 'time') s -= 0.3;
      if (s > bestSl) { bestSl = s; bestS = sl; }
    }
    scored.push({ kpi, score: best + Math.max(0, bestSl) * 0.7 + context, measure: bestM, slice: bestS, direct });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0];
  if (!top || top.score < 1.5) {
    return { question, kpi: null, measure: null, slice: null, confidence: 'none', alternatives: scored.slice(0, 3).map(s => s.kpi) };
  }
  const covered = new Set(tokens(`${top.measure?.name.replace(/_/g, ' ')} ${top.measure?.label} ${top.slice?.label ?? ''} ${top.kpi.label} ${top.kpi.table.replace(/[._]/g, ' ')}`));
  const coverage = rest.length ? rest.filter(w => covered.has(w)).length / rest.length : 0;
  const confidence: Confidence = top.direct > 0 && coverage >= 0.6 && top.score >= 3 ? 'strong' : 'partial';
  return {
    question,
    kpi: top.kpi,
    measure: top.measure,
    slice: top.slice,
    confidence,
    alternatives: scored.slice(1, 6).map(s => s.kpi),
  };
}

export function recipeFor(kpi: BlueprintKpi, question: string): Recipe {
  const wantsTime = TIME_WORDS.test(question);
  const measure = kpi.measures.find(m => !WEAK_MEASURE.test(keyOf(m.name))) ?? kpi.measures[0] ?? null;
  const slices = kpi.slices.filter(s => !WEAK_SLICE.test(keyOf(s.name)));
  const slice = (wantsTime ? slices.find(s => s.kind === 'time') : slices.find(s => s.kind === 'category')) ?? slices[0] ?? null;
  return { question, kpi, measure, slice, confidence: 'partial', alternatives: [] };
}

/** Areas worth focusing on, ranked by how many of the user's questions land there. */
export function suggestAreas(recipes: Recipe[], digest: BlueprintDigest, max = 3): string[] {
  const counts = new Map<string, number>();
  for (const r of recipes) {
    if (!r.kpi) continue;
    counts.set(r.kpi.area, (counts.get(r.kpi.area) ?? 0) + (r.confidence === 'strong' ? 2 : 1));
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a);
  if (ranked.length >= 1) return ranked.slice(0, max);
  const fromStarters = Array.from(new Set(digest.starterQuestions.map(s => s.area)));
  return fromStarters.slice(0, Math.min(2, max));
}

/** Areas a focus area pulls in through foreign keys, strongest first. */
export function neighbours(area: string, digest: BlueprintDigest): { area: string; n: number }[] {
  return digest.links
    .filter(l => l.a === area || l.b === area)
    .map(l => ({ area: l.a === area ? l.b : l.a, n: l.n }))
    .sort((x, y) => y.n - x.n);
}
