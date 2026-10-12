/**
 * The words behind question-to-KPI matching and model picking, in one place.
 * Extend with `extendVocabulary` rather than editing the matcher.
 */

export interface MatchVocabulary {
  /** Never matched: question filler like "which", "right now". */
  stop: Set<string>;
  /** Found in most KPIs ("total", "rate", "hours"), so sharing only these is not a match. */
  generic: Set<string>;
  /** Question word -> words a model may use for it. Keys are stemmed when the vocabulary is built. */
  synonyms: Record<string, string[]>;
}

export interface VocabularyInput {
  stop?: string[];
  generic?: string[];
  synonyms?: Record<string, string[]>;
}

/** Light English stemmer, shared by the matcher and the vocabulary so both sides agree. */
export function stem(w: string): string {
  if (w.length > 5 && w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && /(x|z|ch|sh)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

const STOP = [
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'by', 'with', 'is', 'are', 'was', 'were', 'be', 'our', 'we',
  'my', 'your', 'their', 'what', 'which', 'who', 'where', 'when', 'how', 'why', 'do', 'does', 'did', 'have', 'has', 'most',
  'top', 'about', 'this', 'that', 'these', 'those', 'from', 'at', 'it', 'its', 'than', 'vs', 'versus', 'per', 'each', 'all',
  'any', 'much', 'many', 'between', 'into', 'over', 'under', 'below', 'above', 'going', 'get', 'show', 'me', 'list', 'give',
  'change', 'changed', 'drove', 'driving', 'drive', 'trending', 'trend', 'last', 'next', 'month', 'week', 'quarter',
  'year', 'today', 'yesterday', 'run', 'out', 'longest', 'highest', 'lowest', 'best', 'worst', 'often', 'likely', 'rising',
  'falling', 'growing', 'declining', 'increasing', 'decreasing', 'biggest', 'smallest', 'more', 'less', 'least', 'can', 'should',
  'right', 'now', 'currently', 'could', 'would', 'will', 'had',
];

const GENERIC = [
  'hour', 'rate', 'total', 'count', 'avg', 'average', 'pct', 'percent', 'percentage', 'number', 'time', 'amount', 'day',
  'minute', 'value', 'level', 'status', 'type', 'score', 'ratio', 'sum', 'max', 'min', 'distinct', 'flag', 'date', 'take',
  'long', 'high', 'low', 'new', 'active', 'role', 'fill', 'coverage', 'because',
];

const SYNONYMS: Record<string, string[]> = {
  // Commercial
  sale: ['revenue', 'sales', 'gmv', 'merchandise', 'amount', 'net'],
  revenue: ['sales', 'gmv', 'amount', 'income', 'fee'],
  margin: ['gross', 'profit', 'markup'],
  spend: ['spend', 'revenue', 'amount', 'value'],
  promotion: ['promotion', 'promo', 'campaign', 'discount', 'markdown'],
  basket: ['basket', 'order', 'transaction', 'aov', 'ticket'],
  target: ['target', 'goal', 'plan', 'variance'],
  budget: ['budget', 'cost', 'spend', 'variance'],
  cost: ['cost', 'expense', 'spend'],
  fee: ['fee', 'charge', 'income'],
  arpu: ['arpu', 'revenue', 'average'],
  // Customers and products
  customer: ['customer', 'member', 'account', 'client', 'subscriber'],
  subscriber: ['subscriber', 'subscription', 'customer', 'account'],
  churn: ['attrition', 'cancel', 'cancellation', 'disconnect', 'retention', 'downgrade'],
  loyalty: ['loyalty', 'tier', 'member', 'points'],
  segment: ['segment', 'tier', 'type', 'cohort'],
  engagement: ['engagement', 'view', 'watch', 'session', 'stream'],
  content: ['content', 'title', 'program', 'asset'],
  plan: ['plan', 'subscription', 'tariff', 'package'],
  product: ['product', 'sku', 'item', 'merchandise'],
  channel: ['channel', 'source'],
  // Places
  store: ['store', 'location', 'site', 'branch'],
  branch: ['branch', 'location', 'store'],
  region: ['region', 'geography', 'territory', 'market', 'country', 'state'],
  plant: ['plant', 'site', 'facility'],
  property: ['property', 'hotel', 'site'],
  station: ['station', 'base', 'airport', 'location'],
  // Supply and operations
  stock: ['inventory', 'hand', 'atp', 'stockout', 'supply'],
  inventory: ['stock', 'hand', 'supply'],
  supplier: ['supplier', 'vendor'],
  delivery: ['delivery', 'shipment', 'otd', 'fulfillment'],
  late: ['delay', 'delayed', 'late', 'otd', 'time'],
  delay: ['delay', 'delayed', 'late', 'otp'],
  wait: ['wait', 'delay', 'queue', 'time', 'turnaround'],
  downtime: ['downtime', 'outage', 'stoppage', 'availability', 'oee'],
  scrap: ['scrap', 'defect', 'yield', 'waste', 'reject'],
  production: ['production', 'work', 'order', 'line'],
  line: ['line', 'asset', 'equipment', 'machine'],
  // Workforce
  callout: ['absence', 'absent', 'sick', 'replacement', 'callout'],
  absence: ['absence', 'absent', 'sick', 'leave'],
  sick: ['absence', 'sick', 'leave'],
  shift: ['shift', 'roster', 'duty', 'schedule'],
  unfilled: ['replacement', 'vacancy', 'unfilled', 'uncovered', 'open'],
  coverage: ['replacement', 'roster', 'staffing', 'coverage'],
  staff: ['staff', 'crew', 'employee', 'worker', 'headcount'],
  staffing: ['staffing', 'crew', 'roster', 'headcount'],
  crew: ['crew', 'roster', 'pairing'],
  employee: ['employee', 'staff', 'worker'],
  schedule: ['schedule', 'roster', 'pairing', 'duty'],
  // Industry terms
  occupancy: ['occupancy', 'occupied', 'room', 'night'],
  cancellation: ['cancel', 'cancellation', 'cancelled'],
  booking: ['booking', 'reservation'],
  adr: ['average', 'daily', 'rate'],
  flight: ['flight', 'leg', 'departure'],
  delinquency: ['delinquent', 'delinquency', 'past', 'due', 'default', 'arrears'],
  deposit: ['deposit', 'balance'],
  loan: ['loan', 'credit', 'lending'],
  patient: ['patient', 'member', 'encounter', 'visit'],
  clinic: ['clinic', 'facility', 'department', 'location'],
  department: ['department', 'unit', 'service', 'line'],
  readmission: ['readmit', 'readmission', 'return'],
  claim: ['claim', 'denial', 'denied'],
  denial: ['denial', 'denied', 'reject'],
  procedure: ['procedure', 'cpt', 'service'],
  rate: ['rate', 'pct', 'percent', 'ratio'],
};

/** Builds a vocabulary, lower-casing everything and stemming synonym keys so lookups always line up. */
export function createVocabulary(input: VocabularyInput): MatchVocabulary {
  const synonyms: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(input.synonyms ?? {})) {
    const key = stem(k.toLowerCase());
    synonyms[key] = Array.from(new Set([...(synonyms[key] ?? []), ...v.map(s => s.toLowerCase())]));
  }
  return {
    stop: new Set((input.stop ?? []).map(w => w.toLowerCase())),
    generic: new Set((input.generic ?? []).map(w => stem(w.toLowerCase()))),
    synonyms,
  };
}

/** Adds words on top of a vocabulary; synonyms for an existing key are merged, not replaced. */
export function extendVocabulary(base: MatchVocabulary, extra: VocabularyInput): MatchVocabulary {
  const merged: Record<string, string[]> = { ...base.synonyms };
  for (const [k, v] of Object.entries(createVocabulary({ synonyms: extra.synonyms }).synonyms)) {
    merged[k] = Array.from(new Set([...(merged[k] ?? []), ...v]));
  }
  return {
    stop: new Set([...base.stop, ...createVocabulary({ stop: extra.stop }).stop]),
    generic: new Set([...base.generic, ...createVocabulary({ generic: extra.generic }).generic]),
    synonyms: merged,
  };
}

export const DEFAULT_VOCABULARY = createVocabulary({ stop: STOP, generic: GENERIC, synonyms: SYNONYMS });

/**
 * Words that place an idea in one gallery model even when the idea never names the industry.
 * Only words that rarely mean anything else; "station" or "shift" are too broad.
 */
export const DOMAIN_WORDS: Record<string, string[]> = {
  airlines: ['airline', 'flight', 'aircraft', 'airport', 'pilot', 'cabin crew', 'crew', 'turnaround', 'baggage', 'boarding', 'gate agent'],
  travel_hospitality: ['hotel', 'resort', 'room night', 'occupancy', 'housekeeping', 'front desk', 'concierge'],
  restaurants: ['restaurant', 'menu', 'diner', 'kitchen'],
  staffing_hr: ['staffing agency', 'recruiter', 'candidate', 'placement', 'timesheet', 'job order'],
  grocery: ['grocery', 'supermarket'],
  healthcare: ['patient', 'hospital', 'clinic', 'nurse', 'readmission'],
  health_insurance: ['member claim', 'health plan', 'payer'],
  pc_insurance: ['policyholder', 'underwriting', 'claims adjuster'],
  banking: ['loan', 'deposit', 'branch banking', 'credit card'],
  telecommunication: ['subscriber', 'network outage', 'cell site'],
  shipping_ports: ['port', 'container terminal', 'berth', 'vessel'],
  transport_shipping: ['freight', 'truck', 'fleet route', 'shipment'],
  energy_utilities: ['grid', 'outage', 'meter', 'substation'],
  education: ['student', 'enrollment', 'course'],
};
