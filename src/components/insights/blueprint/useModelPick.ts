import { useEffect, useState } from 'react';
import { blueprintApi, useBlueprintCatalog } from './blueprintApi';
import { pickModelWithReason, type ModelHint } from './industryMap';

export interface ModelChoice {
  slug: string | null;
  label: string | null;
  /** One line on why this model fits the idea, empty when it is only the broad industry's model. */
  why: string;
  /** Still asking the AI; `slug` is the word-based pick meanwhile. */
  loading: boolean;
}

/**
 * The model to start from. Clear domain words decide on their own; otherwise the AI reads
 * the idea and picks from the gallery, and the word-based pick stands in while it thinks or if it fails.
 */
export function useModelPick(hint: ModelHint): ModelChoice & { ready: boolean } {
  const { data: catalog, error } = useBlueprintCatalog();
  const words = catalog ? pickModelWithReason(hint, catalog.industries) : null;
  const context = (hint.text ?? '').trim();
  const askAi = !!catalog && !!words && words.basis !== 'domain' && context.length > 0;
  const [ai, setAi] = useState<{ context: string; slug: string | null; why: string } | null>(null);

  useEffect(() => {
    if (!askAi) return;
    let alive = true;
    blueprintApi.pick(context)
      .then(r => alive && setAi({ context, slug: r.slug, why: r.why }))
      .catch(() => alive && setAi({ context, slug: null, why: '' }));
    return () => { alive = false; };
  }, [askAi, context]);

  const labelOf = (slug: string | null) => catalog?.industries.find(i => i.slug === slug)?.label ?? null;
  if (!catalog || !words) return { slug: null, label: null, why: '', loading: !error, ready: !!error };
  const answered = askAi && ai?.context === context;
  if (answered && ai.slug && labelOf(ai.slug)) {
    return { slug: ai.slug, label: labelOf(ai.slug), why: ai.why, loading: false, ready: true };
  }
  const why = words.words.length >= 2 ? `Your idea mentions ${listOf(words.words.slice(0, 4))}.` : '';
  return { slug: words.slug, label: labelOf(words.slug), why, loading: askAi && !answered, ready: !askAi || answered };
}

function listOf(items: string[]) {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
