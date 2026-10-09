import { FileText, Map as MapIcon, MessagesSquare, Shapes, Sparkles } from 'lucide-react';
import type { StepKey } from './types';

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
  shape: { image: `${BASE}/step-shape.webp`, icon: Shapes, promise: 'Each one comes with its biggest risk' },
  brief: { image: `${BASE}/step-brief.webp`, icon: FileText, promise: 'Review it, check for gaps, then decide' },
};

const AVATAR_COUNT = 6;

/** Same persona name always maps to the same face. */
export function avatarFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `${BASE}/avatar-${(h % AVATAR_COUNT) + 1}.webp`;
}
