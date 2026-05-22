/**
 * Theme palette + per-card icon mapping for the Travel & Hospitality
 * Outcome Map grid.
 *
 * The slide's three columns (dark teal / green / orange) map to Tailwind's
 * cyan / emerald / amber families which support both light and dark modes.
 * A single THEMES map keeps every column's classes DRY and easy to tweak.
 *
 * NOTE: Tailwind's JIT must see every dynamic class string as a literal
 * somewhere in the codebase, so we use full class strings here rather than
 * template-string interpolation.
 */

import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  TrendingUp,
  Users,
  ShieldAlert,
  Wrench,
  CalendarClock,
  Radar,
  Gift,
  Network,
  MessagesSquare,
  Sparkles,
  Bot,
  Heart,
  Compass,
  HelpCircle,
} from 'lucide-react';

/**
 * Position of a category within an industry. Backend stores this as a free
 * `INTEGER`; the frontend now treats it as a generic `number` and resolves
 * the visual theme by the column's *rendered* index (not by `category_order`
 * value) so the palette stays predictable even when orders are sparse
 * (e.g. 1, 2, 5, 7).
 */
export type CategoryOrder = number;

export interface OutcomeMapTheme {
  /** Slide-style full-width gradient header band */
  headerBand: string;
  /** Subtle top-to-bottom column backdrop */
  columnBackdrop: string;
  /** Subtle column outer border (very low opacity, theme-tinted) */
  columnBorder: string;
  /** Top-edge gradient overlay (mounted as ::before in the card) */
  cardTopEdge: string;
  /** Hover ring + theme-tinted shadow */
  cardHoverRing: string;
  /** Selected ring + deeper theme-tinted shadow */
  cardSelectedRing: string;
  /** Selected card subtle theme-tinted background */
  cardSelectedBg: string;
  /** Title colour when card is selected (theme accent) */
  titleSelected: string;
  /** Themed icon disc background (in card top-left) */
  iconBg: string;
  /** Themed icon disc background when selected (slightly deeper tint) */
  iconBgSelected: string;
  /** Icon stroke / fill colour */
  iconAccent: string;
  /** Refined leaf-item pill: solid theme tint, no border */
  pillBg: string;
  /** Refined leaf-item pill when selected: deeper tint + subtle ring */
  pillBgSelected: string;
  /** "N features" count chip on the card top-right (subtle in idle, accent on select) */
  countChip: string;
  /** Use-case-count chip on the coloured column header band (white-on-theme) */
  headerCountChip: string;
  /** Lucide icon name to render inside the column header band (white) */
  headerIcon: LucideIcon;
  /** Theme suffix appended to .border-beam-wrapper (e.g. "theme-cyan") */
  beamClass: string;
  /** Inline CSS variable colour for the magnetic radial-gradient hover */
  magneticGlow: string;
}

// Per-theme palette. Color lives in the MATERIALS (backgrounds, rings, icons,
// header bands) — text stays neutral (text-foreground) so it flips cleanly
// black/light in light mode and white-ish in dark mode. This keeps every
// label legible while the theme palette still identifies each column.
//
// Ordered list (NOT a map keyed by `category_order`). The grid resolves a
// theme by the column's RENDERED index via `getThemeForColumn`, so backends
// can use sparse / non-contiguous `category_order` values and the colour
// rotation stays consistent. When the number of categories exceeds the
// palette length, themes cycle (palette[index % palette.length]).
export const THEME_PALETTE: OutcomeMapTheme[] = [
  {
    // Index 0 — slide dark teal (Travel default: Agentic AI Operations)
    headerBand: 'bg-gradient-to-r from-cyan-700 via-cyan-600 to-cyan-700/95',
    columnBackdrop: 'bg-gradient-to-b from-cyan-500/[0.05] via-cyan-500/[0.02] to-transparent',
    columnBorder: 'ring-1 ring-cyan-500/10',
    cardTopEdge: 'before:bg-gradient-to-r before:from-cyan-500/0 before:via-cyan-500/70 before:to-cyan-500/0',
    cardHoverRing: 'ring-1 ring-cyan-500/40 shadow-xl shadow-cyan-500/20',
    cardSelectedRing: 'ring-2 ring-cyan-500/70 dark:ring-cyan-400/70 shadow-2xl shadow-cyan-500/30',
    cardSelectedBg: 'bg-cyan-500/[0.07] dark:bg-cyan-500/[0.12]',
    // Title stays neutral when selected — color lives in bg/ring/beam, not text
    titleSelected: 'text-foreground',
    iconBg: 'bg-cyan-500/15 dark:bg-cyan-500/22 ring-1 ring-cyan-500/25',
    iconBgSelected: 'bg-cyan-500/25 dark:bg-cyan-500/35 ring-1 ring-cyan-500/40',
    iconAccent: 'text-cyan-700 dark:text-cyan-200',
    pillBg: 'bg-cyan-500/18 ring-1 ring-cyan-500/30 text-foreground dark:bg-cyan-500/15 dark:ring-cyan-400/25',
    pillBgSelected: 'bg-cyan-500/30 ring-1 ring-cyan-500/45 text-foreground dark:bg-cyan-500/25 dark:ring-cyan-300/45 font-semibold',
    countChip: 'bg-cyan-500/18 ring-1 ring-cyan-500/30 text-foreground dark:bg-cyan-500/15 dark:ring-cyan-400/25',
    headerCountChip: 'bg-white/20 text-white ring-1 ring-white/25',
    headerIcon: Activity,
    beamClass: 'theme-cyan',
    magneticGlow: 'hsla(189, 92%, 60%, 0.18)',
  },
  {
    // Index 1 — slide green (Travel default: Diversified Revenue Growth)
    headerBand: 'bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-700/95',
    columnBackdrop: 'bg-gradient-to-b from-emerald-500/[0.05] via-emerald-500/[0.02] to-transparent',
    columnBorder: 'ring-1 ring-emerald-500/10',
    cardTopEdge: 'before:bg-gradient-to-r before:from-emerald-500/0 before:via-emerald-500/70 before:to-emerald-500/0',
    cardHoverRing: 'ring-1 ring-emerald-500/40 shadow-xl shadow-emerald-500/20',
    cardSelectedRing: 'ring-2 ring-emerald-500/70 dark:ring-emerald-400/70 shadow-2xl shadow-emerald-500/30',
    cardSelectedBg: 'bg-emerald-500/[0.07] dark:bg-emerald-500/[0.12]',
    titleSelected: 'text-foreground',
    iconBg: 'bg-emerald-500/15 dark:bg-emerald-500/22 ring-1 ring-emerald-500/25',
    iconBgSelected: 'bg-emerald-500/25 dark:bg-emerald-500/35 ring-1 ring-emerald-500/40',
    iconAccent: 'text-emerald-700 dark:text-emerald-200',
    pillBg: 'bg-emerald-500/18 ring-1 ring-emerald-500/30 text-foreground dark:bg-emerald-500/15 dark:ring-emerald-400/25',
    pillBgSelected: 'bg-emerald-500/30 ring-1 ring-emerald-500/45 text-foreground dark:bg-emerald-500/25 dark:ring-emerald-300/45 font-semibold',
    countChip: 'bg-emerald-500/18 ring-1 ring-emerald-500/30 text-foreground dark:bg-emerald-500/15 dark:ring-emerald-400/25',
    headerCountChip: 'bg-white/20 text-white ring-1 ring-white/25',
    headerIcon: TrendingUp,
    beamClass: 'theme-emerald',
    magneticGlow: 'hsla(160, 84%, 55%, 0.18)',
  },
  {
    // Index 2 — slide orange (Travel default: Consumer at the Center of Every Decision)
    headerBand: 'bg-gradient-to-r from-amber-700 via-amber-600 to-amber-700/95',
    columnBackdrop: 'bg-gradient-to-b from-amber-500/[0.05] via-amber-500/[0.02] to-transparent',
    columnBorder: 'ring-1 ring-amber-500/10',
    cardTopEdge: 'before:bg-gradient-to-r before:from-amber-500/0 before:via-amber-500/70 before:to-amber-500/0',
    cardHoverRing: 'ring-1 ring-amber-500/40 shadow-xl shadow-amber-500/20',
    cardSelectedRing: 'ring-2 ring-amber-500/70 dark:ring-amber-400/70 shadow-2xl shadow-amber-500/30',
    cardSelectedBg: 'bg-amber-500/[0.07] dark:bg-amber-500/[0.12]',
    titleSelected: 'text-foreground',
    iconBg: 'bg-amber-500/15 dark:bg-amber-500/22 ring-1 ring-amber-500/25',
    iconBgSelected: 'bg-amber-500/25 dark:bg-amber-500/35 ring-1 ring-amber-500/40',
    iconAccent: 'text-amber-700 dark:text-amber-200',
    pillBg: 'bg-amber-500/18 ring-1 ring-amber-500/30 text-foreground dark:bg-amber-500/15 dark:ring-amber-400/25',
    pillBgSelected: 'bg-amber-500/30 ring-1 ring-amber-500/45 text-foreground dark:bg-amber-500/25 dark:ring-amber-300/45 font-semibold',
    countChip: 'bg-amber-500/18 ring-1 ring-amber-500/30 text-foreground dark:bg-amber-500/15 dark:ring-amber-400/25',
    headerCountChip: 'bg-white/20 text-white ring-1 ring-white/25',
    headerIcon: Users,
    beamClass: 'theme-amber',
    magneticGlow: 'hsla(38, 92%, 60%, 0.18)',
  },
  {
    // Index 3 — violet (deep purple, distinct from the first three hues)
    headerBand: 'bg-gradient-to-r from-violet-700 via-violet-600 to-violet-700/95',
    columnBackdrop: 'bg-gradient-to-b from-violet-500/[0.05] via-violet-500/[0.02] to-transparent',
    columnBorder: 'ring-1 ring-violet-500/10',
    cardTopEdge: 'before:bg-gradient-to-r before:from-violet-500/0 before:via-violet-500/70 before:to-violet-500/0',
    cardHoverRing: 'ring-1 ring-violet-500/40 shadow-xl shadow-violet-500/20',
    cardSelectedRing: 'ring-2 ring-violet-500/70 dark:ring-violet-400/70 shadow-2xl shadow-violet-500/30',
    cardSelectedBg: 'bg-violet-500/[0.07] dark:bg-violet-500/[0.12]',
    titleSelected: 'text-foreground',
    iconBg: 'bg-violet-500/15 dark:bg-violet-500/22 ring-1 ring-violet-500/25',
    iconBgSelected: 'bg-violet-500/25 dark:bg-violet-500/35 ring-1 ring-violet-500/40',
    iconAccent: 'text-violet-700 dark:text-violet-200',
    pillBg: 'bg-violet-500/18 ring-1 ring-violet-500/30 text-foreground dark:bg-violet-500/15 dark:ring-violet-400/25',
    pillBgSelected: 'bg-violet-500/30 ring-1 ring-violet-500/45 text-foreground dark:bg-violet-500/25 dark:ring-violet-300/45 font-semibold',
    countChip: 'bg-violet-500/18 ring-1 ring-violet-500/30 text-foreground dark:bg-violet-500/15 dark:ring-violet-400/25',
    headerCountChip: 'bg-white/20 text-white ring-1 ring-white/25',
    headerIcon: Sparkles,
    beamClass: 'theme-violet',
    magneticGlow: 'hsla(262, 90%, 65%, 0.18)',
  },
  {
    // Index 4 — rose (warm pink/red, distinct from amber)
    headerBand: 'bg-gradient-to-r from-rose-700 via-rose-600 to-rose-700/95',
    columnBackdrop: 'bg-gradient-to-b from-rose-500/[0.05] via-rose-500/[0.02] to-transparent',
    columnBorder: 'ring-1 ring-rose-500/10',
    cardTopEdge: 'before:bg-gradient-to-r before:from-rose-500/0 before:via-rose-500/70 before:to-rose-500/0',
    cardHoverRing: 'ring-1 ring-rose-500/40 shadow-xl shadow-rose-500/20',
    cardSelectedRing: 'ring-2 ring-rose-500/70 dark:ring-rose-400/70 shadow-2xl shadow-rose-500/30',
    cardSelectedBg: 'bg-rose-500/[0.07] dark:bg-rose-500/[0.12]',
    titleSelected: 'text-foreground',
    iconBg: 'bg-rose-500/15 dark:bg-rose-500/22 ring-1 ring-rose-500/25',
    iconBgSelected: 'bg-rose-500/25 dark:bg-rose-500/35 ring-1 ring-rose-500/40',
    iconAccent: 'text-rose-700 dark:text-rose-200',
    pillBg: 'bg-rose-500/18 ring-1 ring-rose-500/30 text-foreground dark:bg-rose-500/15 dark:ring-rose-400/25',
    pillBgSelected: 'bg-rose-500/30 ring-1 ring-rose-500/45 text-foreground dark:bg-rose-500/25 dark:ring-rose-300/45 font-semibold',
    countChip: 'bg-rose-500/18 ring-1 ring-rose-500/30 text-foreground dark:bg-rose-500/15 dark:ring-rose-400/25',
    headerCountChip: 'bg-white/20 text-white ring-1 ring-white/25',
    headerIcon: Heart,
    beamClass: 'theme-rose',
    magneticGlow: 'hsla(352, 84%, 60%, 0.18)',
  },
  {
    // Index 5 — sky (true blue, distinguishable from the teal cyan in index 0)
    headerBand: 'bg-gradient-to-r from-sky-700 via-sky-600 to-sky-700/95',
    columnBackdrop: 'bg-gradient-to-b from-sky-500/[0.05] via-sky-500/[0.02] to-transparent',
    columnBorder: 'ring-1 ring-sky-500/10',
    cardTopEdge: 'before:bg-gradient-to-r before:from-sky-500/0 before:via-sky-500/70 before:to-sky-500/0',
    cardHoverRing: 'ring-1 ring-sky-500/40 shadow-xl shadow-sky-500/20',
    cardSelectedRing: 'ring-2 ring-sky-500/70 dark:ring-sky-400/70 shadow-2xl shadow-sky-500/30',
    cardSelectedBg: 'bg-sky-500/[0.07] dark:bg-sky-500/[0.12]',
    titleSelected: 'text-foreground',
    iconBg: 'bg-sky-500/15 dark:bg-sky-500/22 ring-1 ring-sky-500/25',
    iconBgSelected: 'bg-sky-500/25 dark:bg-sky-500/35 ring-1 ring-sky-500/40',
    iconAccent: 'text-sky-700 dark:text-sky-200',
    pillBg: 'bg-sky-500/18 ring-1 ring-sky-500/30 text-foreground dark:bg-sky-500/15 dark:ring-sky-400/25',
    pillBgSelected: 'bg-sky-500/30 ring-1 ring-sky-500/45 text-foreground dark:bg-sky-500/25 dark:ring-sky-300/45 font-semibold',
    countChip: 'bg-sky-500/18 ring-1 ring-sky-500/30 text-foreground dark:bg-sky-500/15 dark:ring-sky-400/25',
    headerCountChip: 'bg-white/20 text-white ring-1 ring-white/25',
    headerIcon: Compass,
    beamClass: 'theme-sky',
    magneticGlow: 'hsla(199, 89%, 60%, 0.18)',
  },
];

/**
 * Resolve a theme by the column's rendered index (0-based). When the column
 * count exceeds the palette length, themes cycle from the start. This keeps
 * theme assignment fully decoupled from `category_order` so backends can use
 * any positive integers without breaking the visual rotation.
 */
export const getThemeForColumn = (columnIndex: number): OutcomeMapTheme =>
  THEME_PALETTE[((columnIndex % THEME_PALETTE.length) + THEME_PALETTE.length) % THEME_PALETTE.length];

/**
 * Back-compat: kept so any external consumer that referenced the old shape
 * still type-checks. New code should use `getThemeForColumn` instead.
 *
 * @deprecated Use `getThemeForColumn(columnIndex)` — addressing by
 * `category_order` ties theme to backend values, which we no longer do.
 */
export const THEMES = THEME_PALETTE;

/**
 * Per-card icon. Keyed by `use_case` slug so it stays in the frontend (no DB
 * column needed). Falls back to HelpCircle for unknown slugs.
 */
export const ICON_BY_SLUG: Record<string, LucideIcon> = {
  // Column 1: Agentic AI Operations
  autonomous_disruption_response: ShieldAlert,
  predictive_maintenance: Wrench,
  smarter_scheduling: CalendarClock,
  realtime_operations_view: Radar,
  // Column 2: Diversified Revenue Growth
  dynamic_pricing: TrendingUp,
  intelligent_offers_management: Gift,
  product_channel_development: Network,
  // Column 3: Consumer at the Center of Every Decision
  ai_driven_booking: MessagesSquare,
  hyper_personalized_marketing: Sparkles,
  agentic_customer_service: Bot,
};

export const getIconForSlug = (slug: string): LucideIcon =>
  ICON_BY_SLUG[slug] ?? HelpCircle;

/**
 * Per-card leaf-item pills. These are derived from the slide's leaf items and
 * surface as the cascading pills inside each card on hover/selected. Kept
 * frontend-side to avoid bloating the DB row.
 */
export const LEAF_PILLS_BY_SLUG: Record<string, string[]> = {
  // Column 1: Agentic AI Operations (C1-C4) — pills name the YAML sub-use-cases
  autonomous_disruption_response: ['Weather rebooking', 'Staffing response', 'Complaint triage', 'Cascading incidents'],
  predictive_maintenance: ['HVAC failures', 'Fleet components', 'Kitchen equipment'],
  smarter_scheduling: ['Crew rostering', 'Housekeeping', 'Front-of-house', 'Event reallocation'],
  realtime_operations_view: ['Property ops', 'NOC view', 'Flight ops', 'Guest journey'],
  // Column 2: Diversified Revenue Growth (C5-C7)
  dynamic_pricing: ['Room rates', 'Seat revenue', 'Event surge', 'Ancillary upsell'],
  intelligent_offers_management: ['Next-best-offer', 'Loyalty perks', 'Cross-sell', 'Pre-arrival'],
  product_channel_development: ['New routes', 'Channel economics', 'Competitive intel', 'Partnerships'],
  // Column 3: Consumer at the Center of Every Decision (C8-C10)
  ai_driven_booking: ['Filter search', 'Natural language', 'Agent intent', 'Cart recovery'],
  hyper_personalized_marketing: ['Guest identity', 'Churn & retention', 'Generative content', 'Attribution'],
  agentic_customer_service: ['Autonomous agent', 'Proactive recovery', 'Voice AI', 'Post-stay'],
};

/**
 * Derive a one-line value prop from the prompt-template opening line. The card
 * UI displays this as the muted subtitle below the title. We strip markdown
 * emphasis, drop the boilerplate "Create a simple <type>" prefix, and trim to
 * a compact ~95 chars so the line wraps to at most two lines under the title
 * without leaving a stray third line.
 */
export const deriveValueProp = (template: string | undefined, fallback: string): string => {
  if (!template) return fallback;
  const firstLine = template.split(/\r?\n/, 1)[0] ?? '';
  // Strip markdown emphasis
  let stripped = firstLine.replace(/\*\*/g, '').replace(/\*/g, '').trim();
  // Drop the boilerplate "Create a simple X similar to Y, " prefix when present
  // so the visible value-prop leads with the verb-rich tail clause.
  const similarToMatch = stripped.match(/^Create a simple [^,]+similar to [^,]+,\s*(.+)$/i);
  if (similarToMatch && similarToMatch[1].length > 30) {
    stripped = similarToMatch[1].charAt(0).toUpperCase() + similarToMatch[1].slice(1);
  }
  if (stripped.endsWith('.')) {
    stripped = stripped.slice(0, -1);
  }
  return stripped.length > 95 ? stripped.slice(0, 92).trimEnd() + '…' : stripped;
};
