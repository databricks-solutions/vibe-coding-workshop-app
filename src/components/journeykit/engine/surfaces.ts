import type { GeniePlacement, ShapeKind, ShapeOption } from './types';

export type Surface = 'Genie' | 'Dashboard' | 'App' | 'Agent' | 'Lakebase' | 'Lakehouse';

/** User-facing first, then the data layers behind them. */
const ORDER: Surface[] = ['App', 'Agent', 'Genie', 'Dashboard', 'Lakebase', 'Lakehouse'];

/** What people get on every approach. Keep in step with SHAPE_BUNDLES in ideate.py. */
const BUNDLES: Record<ShapeKind, Surface[]> = {
  insight: ['Genie', 'Dashboard'],
  ask: ['Genie', 'Dashboard'],
  monitor: ['Genie', 'Dashboard'],
  signal: ['Genie', 'Dashboard'],
  copilot: ['App', 'Genie', 'Dashboard'],
  automation: ['Agent', 'App', 'Genie', 'Dashboard'],
};

/** The job each surface does for the people using it. */
export const SURFACE_JOB: Record<Surface, string> = {
  App: 'Act on it',
  Agent: 'Acts within guardrails',
  Genie: 'Ask in plain English',
  Dashboard: 'Watch the numbers',
  Lakebase: 'Stores app data',
  Lakehouse: 'Governed data',
};

export function canonicalSurface(name: string): Surface | null {
  const n = name.trim().toLowerCase();
  if (n.includes('genie')) return 'Genie';
  if (n.includes('dashboard') || n.includes('ai/bi')) return 'Dashboard';
  if (n.includes('agent')) return 'Agent';
  if (n.includes('lakebase')) return 'Lakebase';
  if (n.includes('lakehouse') || n.includes('pipeline')) return 'Lakehouse';
  if (n.includes('app')) return 'App';
  return null;
}

export interface ShapeBuild {
  surfaces: Surface[];
  /** User-facing surfaces only, for the "What you'll build" row. */
  visible: Surface[];
  genie: boolean;
  placement: GeniePlacement;
  askExamples: string[];
  noGenieWhy?: string;
}

/**
 * The complete product an approach builds. Ideas shaped before bundles existed,
 * and replies that left a surface out, still show the full bundle; Genie is only
 * missing when the approach says why.
 */
export function shapeBuild(shape: Pick<ShapeOption, 'kind' | 'surfaces'> & Partial<Pick<ShapeOption, 'geniePlacement' | 'askExamples' | 'noGenieWhy'>>): ShapeBuild {
  const noGenieWhy = shape.noGenieWhy?.trim() || undefined;
  const given = shape.surfaces.map(canonicalSurface).filter((s): s is Surface => !!s);
  const wanted = new Set<Surface>([...(BUNDLES[shape.kind] ?? BUNDLES.insight), ...given]);
  if (noGenieWhy) wanted.delete('Genie');
  const surfaces = ORDER.filter(s => wanted.has(s));
  const genie = surfaces.includes('Genie');
  const placement: GeniePlacement = shape.geniePlacement ?? (surfaces.includes('App') ? 'in_app' : 'genie_space');
  return {
    surfaces,
    visible: surfaces.filter(s => s !== 'Lakebase' && s !== 'Lakehouse'),
    genie,
    placement,
    askExamples: genie ? (shape.askExamples ?? []).map(q => q.trim()).filter(Boolean).slice(0, 3) : [],
    noGenieWhy,
  };
}

export const placementLabel = (b: Pick<ShapeBuild, 'placement'>) => (b.placement === 'in_app' ? 'Ask inside the app' : 'Ask Genie');

/** Plain-language lines handed to the build, so Genie and the dashboard are never dropped. */
export function buildLines(shape: ShapeOption | null): string[] {
  if (!shape) return [];
  const b = shapeBuild(shape);
  const lines = [`What it builds: ${b.surfaces.map(s => (s === 'Genie' && b.placement === 'in_app' ? 'Genie (inside the app)' : s)).join(', ')}`];
  if (b.askExamples.length) lines.push(`People can ask Genie: ${b.askExamples.map(q => `"${q}"`).join('; ')}`);
  if (b.noGenieWhy) lines.push(`No Genie because: ${b.noGenieWhy}`);
  return lines;
}
