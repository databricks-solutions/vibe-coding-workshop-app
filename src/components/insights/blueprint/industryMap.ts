import { DOMAIN_WORDS, stem } from './vocabulary';

/** Insights industry ideas (journey.ts) to their closest data model in the gallery. */
export const INDUSTRY_TO_BLUEPRINT: Record<string, string> = {
  retail: 'retail',
  financial_services: 'banking',
  healthcare: 'healthcare',
  manufacturing: 'manufacturing',
  media_telecom: 'telecommunication',
  travel_hospitality: 'travel_hospitality',
};

export const blueprintForIndustry = (industryId: string): string | null => INDUSTRY_TO_BLUEPRINT[industryId] ?? null;

/** What we know about the idea when choosing a data model. */
export interface ModelHint {
  /** Broad Insights industry id, the fallback. */
  industryId: string;
  /** The idea's own industry, e.g. "Airlines", from the idea or its use case. */
  industry?: string;
  /** Title, problem and questions. */
  text?: string;
}

const words = (s: string) => s.toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length > 2 && w !== 'and');
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface ModelPick {
  slug: string | null;
  /** What decided it: several domain words, the industry's name, or only the broad industry. */
  basis: 'domain' | 'name' | 'fallback' | 'none';
  /** Domain words from the idea that point at this model. */
  words: string[];
}

/**
 * The gallery model closest to the idea, in order of evidence: several domain words for one model,
 * then the idea's industry name, then the broad industry's model. Ties go to the broad industry's model.
 */
export function pickModelWithReason(
  hint: ModelHint,
  industries: { slug: string; label: string }[],
  domainWords: Record<string, string[]> = DOMAIN_WORDS,
): ModelPick {
  const known = new Set(industries.map(i => i.slug));
  const fallback = blueprintForIndustry(hint.industryId);
  const named = new Set(words(hint.industry ?? '').map(stem));
  const text = ` ${(hint.text ?? '').toLowerCase()} `;

  const scored = industries.map(ind => {
    const label = words(ind.label ?? '').map(stem);
    const hits = label.filter(w => named.has(w)).length;
    const found = (domainWords[ind.slug] ?? []).filter(w => new RegExp(`\\b${escape(w.toLowerCase())}s?\\b`).test(text));
    return { slug: ind.slug, name: hits ? hits / label.length + hits : 0, domain: found.length, found };
  });
  const best = (key: 'name' | 'domain', min: number) => {
    const top = Math.max(0, ...scored.map(s => s[key]));
    if (top < min) return null;
    const tied = scored.filter(s => s[key] === top);
    return tied.find(s => s.slug === fallback) ?? tied[0];
  };
  const byDomain = best('domain', 2);
  if (byDomain) return { slug: byDomain.slug, basis: 'domain', words: byDomain.found };
  const byName = best('name', 1);
  if (byName) return { slug: byName.slug, basis: 'name', words: byName.found };
  if (fallback && known.has(fallback)) return { slug: fallback, basis: 'fallback', words: [] };
  return { slug: null, basis: 'none', words: [] };
}

export const pickModel = (
  hint: ModelHint,
  industries: { slug: string; label: string }[],
  domainWords: Record<string, string[]> = DOMAIN_WORDS,
): string | null => pickModelWithReason(hint, industries, domainWords).slug;
