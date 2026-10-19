import type { BlueprintDigest } from './types';

/** An area from another schema must score this close to the best area to be picked. */
const OTHER_SCHEMA_SHARE = 0.8;

/**
 * With several schemas selected, keep the picks in the schema the idea is most about
 * (its two best areas together), plus only near-top areas from the others.
 * `scored` is best first.
 */
export function withinLeadingSchema<T extends { name: string; score: number }>(scored: T[], digest: BlueprintDigest): T[] {
  const schemaOf = new Map((digest.areas ?? []).map(a => [a.name, a.division ?? '']));
  const bySchema = new Map<string, number[]>();
  for (const s of scored) {
    const k = schemaOf.get(s.name) ?? '';
    bySchema.set(k, [...(bySchema.get(k) ?? []), s.score]);
  }
  if (bySchema.size < 2 || !scored.length) return scored;
  const strength = (xs: number[]) => xs.slice(0, 2).reduce((n, x) => n + x, 0);
  const [lead] = [...bySchema.entries()].sort((a, b) => strength(b[1]) - strength(a[1]))[0];
  const top = scored[0].score;
  return scored.filter(s => (schemaOf.get(s.name) ?? '') === lead || s.score >= top * OTHER_SCHEMA_SHARE);
}
