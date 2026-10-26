import { FileText, ListChecks, Map as MapIcon, MessagesSquare, Shapes, Sparkles, TrendingUp } from 'lucide-react';
import type { StepKey } from './engine/types';

const BASE = '/ideate';

export const ART = {
  hero: `${BASE}/hero.webp`,
  celebrate: `${BASE}/celebrate.webp`,
  empty: `${BASE}/empty.webp`,
};

export const STEP_ART: Record<StepKey, { image: string; icon: typeof Sparkles; promise: string }> = {
  spark: { image: `${BASE}/step-spark.webp`, icon: Sparkles, promise: 'A crisp one-line version of your idea' },
  map: { image: `${BASE}/step-map.webp`, icon: MapIcon, promise: 'Plus who it helps and what it touches' },
  clarify: { image: `${BASE}/step-clarify.webp`, icon: MessagesSquare, promise: 'Pick answers, no essays needed' },
  shape: { image: `${BASE}/step-shape.webp`, icon: Shapes, promise: 'Compare what each builds, the effort, and what to validate first' },
  questions: { image: `${BASE}/step-clarify.webp`, icon: ListChecks, promise: 'These become the questions your Genie is tested on' },
  impact: { image: `${BASE}/step-map.webp`, icon: TrendingUp, promise: 'Select directional baselines to model annual value and payback, or use industry benchmarks.' },
  brief: { image: `${BASE}/step-brief.webp`, icon: FileText, promise: 'Review it, check for gaps, then decide' },
};

const AVATAR_COUNT = 6;

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % AVATAR_COUNT;
}

/** Same persona name always maps to the same face. */
export function avatarFor(name: string) {
  return `${BASE}/avatar-${hashName(name) + 1}.webp`;
}

/** Assigns distinct avatar faces across a sequence of actors so two roles in the same flow never share the same face. */
export function avatarsForList(names: string[]): string[] {
  const used = new Set<number>();
  return names.map(name => {
    let slot = hashName(name);
    for (let step = 0; step < AVATAR_COUNT && used.has(slot); step++) {
      slot = (slot + 1) % AVATAR_COUNT;
    }
    used.add(slot);
    return `${BASE}/avatar-${slot + 1}.webp`;
  });
}
