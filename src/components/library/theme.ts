/**
 * Visual system for the Use Case Library.
 *
 * Every collection carries a tint (hue + saturation pair) that library.css
 * turns into tiles, washes, dots and heat cells, with separate lightness for
 * dark and light themes. Kinds have their own accent so verticals and
 * horizontals read differently at a glance.
 */

import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity, BadgeDollarSign, Bot, Boxes, BrainCircuit, BriefcaseBusiness, Building2, CalendarCheck, Calculator, Car,
  ChartColumnBig, Clapperboard, Cog, Compass, Factory, FlaskConical, GraduationCap, Handshake, HeartPulse, Landmark,
  Layers, Lightbulb, Megaphone, PieChart, Plane, RadioTower, ServerCog, ShieldAlert, ShieldCheck, ShoppingBasket,
  Sparkles, Store, Target, TrendingUp, Truck, Umbrella, Users, UsersRound, Workflow, Zap,
} from 'lucide-react';
import type { CollectionKind, LibraryCollection, LibraryUseCase } from '../../api/library';
import { ICON_BY_SLUG } from '../outcomeMapTheme';

export interface Tint { h: number; s: number }

export const TINTS: Record<string, Tint & { label: string }> = {
  teal: { h: 172, s: 66, label: 'Teal' },
  cyan: { h: 189, s: 85, label: 'Cyan' },
  sky: { h: 205, s: 88, label: 'Sky' },
  indigo: { h: 236, s: 75, label: 'Indigo' },
  violet: { h: 262, s: 78, label: 'Violet' },
  fuchsia: { h: 292, s: 70, label: 'Fuchsia' },
  rose: { h: 350, s: 80, label: 'Rose' },
  orange: { h: 22, s: 90, label: 'Orange' },
  amber: { h: 38, s: 92, label: 'Amber' },
  emerald: { h: 158, s: 70, label: 'Emerald' },
};

export const tintStyle = (t: Tint): CSSProperties => ({ '--h': String(t.h), '--s': `${t.s}%` } as CSSProperties);

export interface KindMeta {
  id: CollectionKind;
  label: string;
  singular: string;
  short: string;
  blurb: string;
  icon: LucideIcon;
  tint: Tint;
}

export const KINDS: KindMeta[] = [
  { id: 'industry', label: 'Industries', singular: 'Industry', short: 'Industry', blurb: 'Vertical plays for a specific market', icon: Factory, tint: TINTS.teal },
  { id: 'function', label: 'Business Functions', singular: 'Business function', short: 'Function', blurb: 'Horizontal plays for a buyer, like the Office of the CFO', icon: BriefcaseBusiness, tint: TINTS.violet },
  { id: 'solution', label: 'Technical Solutions', singular: 'Technical solution', short: 'Solution', blurb: 'Horizontal plays for a capability, like Observability', icon: Boxes, tint: TINTS.sky },
];
export const KIND_BY_ID = Object.fromEntries(KINDS.map(k => [k.id, k])) as Record<CollectionKind, KindMeta>;

export const COLLECTION_ICONS: Record<string, LucideIcon> = {
  ShoppingBasket, Store, Plane, Landmark, HeartPulse, Factory, Zap, Clapperboard, Building2, FlaskConical, RadioTower,
  Umbrella, Car, GraduationCap, Calculator, Megaphone, UsersRound, Cog, ServerCog, Target, Truck, Workflow, Activity,
  ShieldCheck, Bot, ChartColumnBig, BrainCircuit, Layers, Compass, Sparkles, Handshake, PieChart,
};

const DEFAULT_ICON_BY_SLUG: Record<string, string> = {
  sample: 'FlaskConical', cpg: 'ShoppingBasket', retail: 'Store', travel: 'Plane',
};
const DEFAULT_TINT_BY_SLUG: Record<string, string> = {
  sample: 'indigo', cpg: 'emerald', retail: 'amber', travel: 'cyan',
};
const DEFAULT_TINT_BY_KIND: Record<CollectionKind, string> = { industry: 'teal', function: 'violet', solution: 'sky' };

const ICON_KEYWORDS: [RegExp, string][] = [
  [/health|pharma|life sci|hls/, 'HeartPulse'], [/bank|financial serv|fsi|capital market/, 'Landmark'],
  [/insur/, 'Umbrella'], [/manufact|industrial/, 'Factory'], [/energy|utilit|oil/, 'Zap'],
  [/media|entertain/, 'Clapperboard'], [/public|government/, 'Building2'], [/telco|communic/, 'RadioTower'],
  [/auto|mobility/, 'Car'], [/educat/, 'GraduationCap'], [/consumer|cpg/, 'ShoppingBasket'], [/retail/, 'Store'],
  [/travel|hospitality|airline/, 'Plane'], [/cfo|finance/, 'Calculator'], [/cmo|market/, 'Megaphone'],
  [/chro|people|human|talent/, 'UsersRound'], [/coo|operation/, 'Cog'], [/cio|cto|technolog/, 'ServerCog'],
  [/sales|revenue|cro/, 'Target'], [/supply/, 'Truck'], [/integrat|ingest|pipeline/, 'Workflow'],
  [/observ|monitor/, 'Activity'], [/govern|security|complian/, 'ShieldCheck'], [/agent/, 'Bot'],
  [/\bbi\b|dashboard|analytic/, 'ChartColumnBig'], [/\bml\b|machine learn|\bai\b/, 'BrainCircuit'],
];

export function collectionTint(c: Pick<LibraryCollection, 'collection_id' | 'kind' | 'color'>): Tint {
  return TINTS[c.color || ''] || TINTS[DEFAULT_TINT_BY_SLUG[c.collection_id]] || TINTS[DEFAULT_TINT_BY_KIND[c.kind] || 'teal'];
}

export function collectionTintKey(c: Pick<LibraryCollection, 'collection_id' | 'kind' | 'color'>): string {
  if (c.color && TINTS[c.color]) return c.color;
  return DEFAULT_TINT_BY_SLUG[c.collection_id] || DEFAULT_TINT_BY_KIND[c.kind] || 'teal';
}

export function collectionIconName(c: Pick<LibraryCollection, 'collection_id' | 'kind' | 'icon' | 'label'>): string {
  if (c.icon && COLLECTION_ICONS[c.icon]) return c.icon;
  if (DEFAULT_ICON_BY_SLUG[c.collection_id]) return DEFAULT_ICON_BY_SLUG[c.collection_id];
  const hay = `${c.collection_id} ${c.label}`.toLowerCase().replace(/_/g, ' ');
  const hit = ICON_KEYWORDS.find(([re]) => re.test(hay));
  if (hit) return hit[1];
  return c.kind === 'function' ? 'Compass' : c.kind === 'solution' ? 'Layers' : 'Factory';
}

export const collectionIcon = (c: Pick<LibraryCollection, 'collection_id' | 'kind' | 'icon' | 'label'>): LucideIcon =>
  COLLECTION_ICONS[collectionIconName(c)] || Layers;

const TINT_BY_ICON: Record<string, string> = { Store: 'amber', ShoppingBasket: 'emerald', Plane: 'cyan' };

/** Icon and tint for an industry outside the library, e.g. an idea's "Airlines", matching its library collection. */
export function industryTheme(key: string, label: string): { icon: LucideIcon; tint: Tint } {
  const iconName = collectionIconName({ collection_id: key, kind: 'industry', icon: null, label });
  return {
    icon: COLLECTION_ICONS[iconName] || Factory,
    tint: TINTS[DEFAULT_TINT_BY_SLUG[key] || TINT_BY_ICON[iconName] || DEFAULT_TINT_BY_KIND.industry],
  };
}

const UC_ICON_KEYWORDS: [RegExp, LucideIcon][] = [
  [/skill/, Sparkles], [/genie space|ask your/, Sparkles], [/agent|assistant|copilot/, Bot],
  [/close|p&l|spend|working capital|financ/, Calculator], [/control tower|operations/, Cog],
  [/attrition|mobility|people/, UsersRound], [/forecast|demand|growth/, TrendingUp],
  [/supplier|partner/, Handshake], [/supply|logistic|fleet/, Truck], [/inventory|stock/, Boxes],
  [/price|pricing|revenue|offer|ancillar|upsell/, BadgeDollarSign], [/risk|fraud|disruption/, ShieldAlert],
  [/employee|workforce|staff|crew/, UsersRound], [/customer|shopper|consumer|guest|360|audience/, Users],
  [/brand|marketing|campaign/, Megaphone], [/portfolio|mix/, PieChart], [/booking|schedul/, CalendarCheck],
  [/insight|ideas?/, Lightbulb], [/dashboard|report|analytic/, ChartColumnBig],
];

export function iconForUseCase(uc: Pick<LibraryUseCase, 'use_case' | 'use_case_label'>, fallback: LucideIcon): LucideIcon {
  const known = ICON_BY_SLUG[uc.use_case];
  if (known) return known;
  const hay = `${uc.use_case} ${uc.use_case_label}`.toLowerCase().replace(/_/g, ' ');
  return UC_ICON_KEYWORDS.find(([re]) => re.test(hay))?.[1] || fallback;
}

/** Category column tints follow the participant outcome map rotation. */
export const CATEGORY_TINTS: Tint[] = [TINTS.cyan, TINTS.emerald, TINTS.amber, TINTS.violet, TINTS.rose, TINTS.sky];
export const categoryTint = (index: number): Tint => CATEGORY_TINTS[((index % CATEGORY_TINTS.length) + CATEGORY_TINTS.length) % CATEGORY_TINTS.length];

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T')).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  if (s < 86400 * 365) return `${Math.floor(s / (86400 * 30))}mo ago`;
  return `${Math.floor(s / (86400 * 365))}y ago`;
}

export function initials(email: string | null | undefined): string {
  if (!email) return '?';
  const name = email.split('@')[0].replace(/[._-]+/g, ' ').trim();
  const parts = name.split(' ').filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || parts[0]?.[1] || '')).toUpperCase() || '?';
}

export function firstLine(template: string, max = 140): string {
  const line = (template || '')
    .split(/\r?\n/)
    .map(l => l.replace(/^#+\s*/, '').replace(/\*\*|__|\*|`/g, '').trim())
    .find(l => l.length > 0) || '';
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}
