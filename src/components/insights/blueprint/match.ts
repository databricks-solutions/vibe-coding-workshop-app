import type { BlueprintDigest, BlueprintKpi } from './types';
import { DEFAULT_VOCABULARY, stem, type MatchVocabulary } from './vocabulary';

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

const TIME_WORDS = /\b(trend|trending|over time|month|monthly|week|weekly|quarter|quarterly|year|yearly|daily|day|last|since|yoy|mom)\b/i;
const COUNT_WORDS = /\b(how many|number of|count of)\b/i;
const WEAK_MEASURE = /(^|_)(row|record)_?count$|_id$|latitude|longitude|sequence|version|checksum|data_quality/i;
const WEAK_SLICE = /_id$|_number$|_code$|address|line_?\d|email|phone|postal|zip|url|description|comment|note/i;
/** How many unrelated KPIs a "Not covered yet" question still offers to browse. */
const BROWSE_WHEN_UNCOVERED = 3;

const keyOf = (s: string) => s.toLowerCase().replace(/[\s-]+/g, '_');
const spaced = (s: string | undefined) => (s ?? '').replace(/[._]/g, ' ');

/** A question-to-KPI matcher over one vocabulary. Use `matchQuestion` for the default one. */
export function createMatcher(vocab: MatchVocabulary = DEFAULT_VOCABULARY) {
  const tokens = (text: string | undefined): string[] =>
    (text ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1 && !vocab.stop.has(w) && !/^\d+[a-z]{0,3}$/.test(w))
      .map(stem);
  const tokenSet = (text: string) => new Set(tokens(text));
  const synonymsOf = (w: string) => (vocab.synonyms[w] ?? []).map(stem);

  /** The word, or one of its synonyms, is in the set. */
  const mentions = (set: Set<string>, word: string) => set.has(word) || synonymsOf(word).some(s => set.has(s));

  function expand(words: string[], weight = 1): Map<string, number> {
    const out = new Map<string, number>();
    for (const w of words) {
      out.set(w, Math.max(out.get(w) ?? 0, weight));
      for (const st of synonymsOf(w)) out.set(st, Math.max(out.get(st) ?? 0, weight * 0.45));
    }
    return out;
  }

  /** "Which customer segments ..." names the grouping, not the number. */
  function subjectWords(question: string): string[] {
    const m = question.toLowerCase().match(/\b(?:which|what|whose|top\s+\d+|top)\s+([a-z ]+)/);
    if (!m) return [];
    const out: string[] = [];
    for (const w of m[1].split(/\s+/)) {
      if (!w || vocab.stop.has(w) || out.length === 2) break;
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

  /** Rare words ("readmission") should outweigh common ones ("rate", "total"). */
  const idfCache = new WeakMap<BlueprintDigest, Map<string, number>>();
  function idfFor(digest: BlueprintDigest): Map<string, number> {
    let idf = idfCache.get(digest);
    if (idf) return idf;
    const df = new Map<string, number>();
    let n = 0;
    for (const k of digest.kpis ?? []) {
      for (const m of k.measures ?? []) {
        n += 1;
        for (const t of new Set(tokens(`${spaced(m.name)} ${m.label} ${k.label}`))) df.set(t, (df.get(t) ?? 0) + 1);
      }
    }
    idf = new Map([...df.entries()].map(([t, c]) => [t, Math.min(3, Math.max(0.35, Math.log(n / c) / 2.2))]));
    idfCache.set(digest, idf);
    return idf;
  }

  /** Every word the model uses for its tables, areas and KPIs. */
  const wordsCache = new WeakMap<BlueprintDigest, Set<string>>();
  function modelWords(digest: BlueprintDigest): Set<string> {
    let v = wordsCache.get(digest);
    if (v) return v;
    const parts = [
      ...(digest.areas ?? []).map(a => a.label),
      ...(digest.tables ?? []).map(t => `${t.label} ${spaced(t.id)}`),
      ...(digest.kpis ?? []).flatMap(k => [k.label, ...(k.measures ?? []).map(m => m.label), ...(k.slices ?? []).map(s => s.label)]),
    ];
    v = tokenSet(parts.join(' '));
    wordsCache.set(digest, v);
    return v;
  }

  const scorer = (bag: Map<string, number>, idf: Map<string, number>) => (text: string | undefined) => {
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

  function matchQuestion(question: string, digest: BlueprintDigest): Recipe {
    const idf = idfFor(digest);
    const all = tokens(question);
    const subject = new Set(subjectWords(question));
    const rest = all.filter(w => !subject.has(w));
    const measureBag = expand(rest);
    for (const [w, v] of expand([...subject], 0.35)) measureBag.set(w, Math.max(measureBag.get(w) ?? 0, v));
    const directBag = new Map(rest.map(w => [w, 1]));
    const sliceBag = expand(all);
    for (const w of subject) sliceBag.set(w, 1.5);
    const sliceOnly = new Set(byWords(question));
    for (const w of sliceOnly) sliceBag.set(w, 2.5);
    const wantsCount = COUNT_WORDS.test(question);
    const wantsTime = TIME_WORDS.test(question);

    const mScore = scorer(measureBag, idf);
    const mDirect = scorer(directBag, idf);
    const sScore = scorer(sliceBag, idf);
    const areaLabel = new Map((digest.areas ?? []).map(a => [a.name, a.label]));

    type Scored = { kpi: BlueprintKpi; score: number; measure: Recipe['measure']; slice: Recipe['slice']; direct: number };
    const scored: Scored[] = [];

    for (const kpi of digest.kpis ?? []) {
      const context = mScore(`${kpi.label} ${areaLabel.get(kpi.area) ?? ''}`) * 0.6 + mScore(kpi.description) * 0.25;
      let bestM: Recipe['measure'] = null;
      let best = -1;
      let direct = 0;
      for (const m of kpi.measures ?? []) {
        if (WEAK_MEASURE.test(keyOf(m.name ?? ''))) continue;
        const text = `${spaced(m.name)} ${m.label}`;
        const s = mScore(text) * 2 + mScore(m.comment) * 0.4 + (wantsCount && m.agg === 'count' ? 0.8 : 0);
        if (s > best) { best = s; bestM = m; direct = mDirect(text); }
      }
      if (!bestM) continue;

      let bestS: Recipe['slice'] = null;
      let bestSl = -1;
      for (const sl of kpi.slices ?? []) {
        if (WEAK_SLICE.test(keyOf(sl.name ?? ''))) continue;
        let s = sScore(`${spaced(sl.name)} ${sl.label}`) * 1.5 + sScore(sl.comment) * 0.2;
        if (wantsTime && sl.kind === 'time') s += 1.5;
        if (!wantsTime && sl.kind === 'time') s -= 0.3;
        if (s > bestSl) { bestSl = s; bestS = sl; }
      }
      scored.push({ kpi, score: best + Math.max(0, bestSl) * 0.7 + context, measure: bestM, slice: bestS, direct });
    }
    scored.sort((a, b) => b.score - a.score);

    const specific = rest.filter(w => !vocab.generic.has(w) && !sliceOnly.has(w));
    const subjectSpecific = [...subject].filter(w => !vocab.generic.has(w));
    const none = (): Recipe => ({
      question, kpi: null, measure: null, slice: null, confidence: 'none',
      alternatives: scored.slice(0, BROWSE_WHEN_UNCOVERED).map(s => s.kpi),
    });

    // "Which crew roles ..." cannot be answered by a model that has no crew at all.
    if (subjectSpecific.length && !subjectSpecific.some(w => mentions(modelWords(digest), w))) return none();

    const textOf = (s: Scored) => ({
      measure: tokenSet(`${spaced(s.measure?.name)} ${s.measure?.label ?? ''} ${s.kpi.label} ${spaced(s.kpi.table)} ${areaLabel.get(s.kpi.area) ?? ''}`),
      slices: tokenSet((s.kpi.slices ?? []).map(sl => `${spaced(sl.name)} ${sl.label}`).join(' ')),
    });
    /** How much of the question this KPI is about; rare words like "absence" count more than "assignment". */
    const fit = (s: Scored) => {
      const { measure, slices } = textOf(s);
      let hits = 0, weight = 0, inMeasure = false;
      for (const w of specific) {
        const direct = measure.has(w) || slices.has(w);
        if (!direct && !mentions(measure, w) && !mentions(slices, w)) continue;
        hits += 1;
        const synIdf = Math.max(0, ...synonymsOf(w).filter(x => measure.has(x) || slices.has(x)).map(x => idf.get(x) ?? 1));
        weight += direct ? (idf.get(w) ?? 1) : 0.7 * synIdf;
        inMeasure ||= mentions(measure, w);
      }
      return { hits, weight, inMeasure };
    };
    // The number has to be about the question, and cover at least half of what it asks about.
    const need = specific.length <= 2 ? specific.length : Math.ceil(specific.length / 2);
    const ranked = scored
      .map(s => ({ s, f: fit(s) }))
      .filter(({ f }) => !specific.length || (f.inMeasure && f.hits >= need))
      .sort((a, b) => (b.f.weight * 3 + b.s.score) - (a.f.weight * 3 + a.s.score))
      .map(r => r.s);
    const top = ranked[0];
    if (!top || top.score < 1.5) return none();

    const covered = tokenSet(`${spaced(top.measure?.name)} ${top.measure?.label ?? ''} ${top.slice?.label ?? ''} ${top.kpi.label} ${spaced(top.kpi.table)}`);
    const judged = specific.length ? specific : rest;
    const coverage = judged.length ? judged.filter(w => covered.has(w)).length / judged.length : 0;
    const { measure: mText, slices: sText } = textOf(top);
    const aboutSubject = !subjectSpecific.length || subjectSpecific.some(w => mentions(mText, w) || mentions(sText, w));
    const chosenSlice = tokenSet(`${spaced(top.slice?.name)} ${top.slice?.label ?? ''}`);
    const sliceFits = !sliceOnly.size || [...sliceOnly].some(w => mentions(chosenSlice, w));
    const confidence: Confidence = aboutSubject && sliceFits && top.direct > 0 && coverage >= 0.6 && top.score >= 3 ? 'strong' : 'partial';
    return {
      question,
      kpi: top.kpi,
      measure: top.measure,
      slice: top.slice,
      confidence,
      alternatives: ranked.slice(1, 6).map(s => s.kpi),
    };
  }

  return { matchQuestion };
}

const defaultMatcher = createMatcher();

/** Matches a question to the model's best KPI with the default vocabulary. */
export const matchQuestion = (question: string, digest: BlueprintDigest): Recipe => defaultMatcher.matchQuestion(question, digest);

export function recipeFor(kpi: BlueprintKpi, question: string): Recipe {
  const wantsTime = TIME_WORDS.test(question);
  const measures = kpi.measures ?? [];
  const measure = measures.find(m => !WEAK_MEASURE.test(keyOf(m.name ?? ''))) ?? measures[0] ?? null;
  const slices = (kpi.slices ?? []).filter(s => !WEAK_SLICE.test(keyOf(s.name ?? '')));
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
  const fromStarters = Array.from(new Set((digest.starterQuestions ?? []).map(s => s.area)));
  return fromStarters.slice(0, Math.min(2, max));
}

/** Areas a focus area pulls in through foreign keys, strongest first. */
export function neighbours(area: string, digest: BlueprintDigest): { area: string; n: number }[] {
  return (digest.links ?? [])
    .filter(l => l.a === area || l.b === area)
    .map(l => ({ area: l.a === area ? l.b : l.a, n: l.n }))
    .sort((x, y) => y.n - x.n);
}
