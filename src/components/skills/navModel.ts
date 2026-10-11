import type { CSSProperties } from 'react';
import {
  Activity,
  AppWindow,
  BadgeCheck,
  BookOpen,
  Bot,
  Boxes,
  Brain,
  ClipboardCheck,
  Compass,
  Database,
  FlaskConical,
  KeyRound,
  Layers,
  Network,
  Package,
  Radar,
  Ruler,
  ShieldCheck,
  Sparkles,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import {
  ACADEMY,
  AGENT_STAGES,
  GENIE_STAGES,
  NAV_META,
  SKILLS,
  SKILL_MAP,
  STAGES,
  TOURS,
  type AcademyModule,
  type NavSkill,
  type NavStage,
  type TourId,
} from '../../constants/skillsNavigatorData';

export type View = 'map' | 'tours' | 'skills' | 'learn';
export type TrackId = 'dpa' | 'appkit' | 'agents' | 'gaccel' | 'agentic';

export const VIEW_HINTS: Record<View, string> = {
  map: 'Pick a track to see how its skills fit together.',
  tours: 'Step-by-step walkthroughs of how the skills work together.',
  skills: 'Browse every skill. Open one to see what it does and copy its prompt.',
  learn: 'Short lessons on the Databricks building blocks behind the skills.',
};

export const tint = (color: string): CSSProperties => ({ '--tint': color } as CSSProperties);

export interface Track {
  id: TrackId;
  label: string;
  outcome: string;
  icon: LucideIcon;
  color: string;
  tour: TourId | null;
  stages?: NavStage[];
}

export const TRACKS: Track[] = [
  {
    id: 'dpa',
    label: 'Data Product Accelerator',
    outcome: 'Turn a schema CSV into Gold tables, a semantic layer, Genie, monitoring, ML, and GenAI agents.',
    icon: Database,
    color: 'var(--purple)',
    tour: 'a',
    stages: STAGES,
  },
  {
    id: 'appkit',
    label: 'AppKit + Lakebase',
    outcome: 'Go from a PRD to a deployed Databricks App with live Lakebase data.',
    icon: AppWindow,
    color: 'var(--green)',
    tour: 'b',
  },
  {
    id: 'agents',
    label: 'Agents + MLflow',
    outcome: 'Turn the app into a governed agent with tools, memory, and auth, then evaluate, deploy, and monitor it.',
    icon: Bot,
    color: 'var(--blue)',
    tour: 'd',
    stages: AGENT_STAGES,
  },
  {
    id: 'gaccel',
    label: 'Genie Accelerator',
    outcome: 'Build the semantic layer, stand up a Genie agent, activate it, then model the ontology across spaces.',
    icon: Sparkles,
    color: 'var(--gold)',
    tour: 'e',
    stages: GENIE_STAGES,
  },
  {
    id: 'agentic',
    label: 'Agentic Framework',
    outcome: 'Prompts for designing and building multi-agent systems.',
    icon: Network,
    color: 'var(--pink)',
    tour: null,
  },
];

export const TRACK_MAP = Object.fromEntries(TRACKS.map((t) => [t.id, t])) as Record<TrackId, Track>;

export function trackOf(skill: NavSkill): Track | undefined {
  return TRACK_MAP[skill.component as TrackId];
}

export function skillsInTrack(id: TrackId): NavSkill[] {
  return SKILLS.filter((s) => s.component === id);
}

export const STAGE_TINT: Record<string, string> = {
  'sc-1': 'var(--purple)', 'sc-2': 'var(--bronze)', 'sc-3': 'var(--teal)', 'sc-4': 'var(--purple)',
  'sc-5': 'var(--gold)', 'sc-6': 'var(--blue)', 'sc-6b': 'var(--orange)', 'sc-7': 'var(--red)',
  'sc-8': 'var(--pink)', 'sc-9': 'var(--teal)',
  'sc-a1': 'var(--cyan)', 'sc-a2': 'var(--blue)', 'sc-a3': 'var(--teal)', 'sc-a4': 'var(--purple)',
  'sc-a5': 'var(--green)', 'sc-a6': 'var(--gold)',
  'sc-e1': 'var(--cyan)', 'sc-e2': 'var(--blue)', 'sc-e3': 'var(--teal)', 'sc-e4': 'var(--green)',
};

const STAGE_LABELS: Record<string, string> = {
  'Gold Impl': 'Gold Implementation',
  'Genie Opt': 'Genie Optimization',
  'Observ.': 'Observability',
};

export const stageLabel = (st: NavStage) => STAGE_LABELS[st.label] ?? st.label;

export const TYPE_INFO: Record<string, { label: string; color: string; meaning: string }> = {
  orchestrator: { label: 'Orchestrator', color: 'var(--purple)', meaning: 'Leads a stage and calls its steps in order.' },
  worker: { label: 'Worker', color: 'var(--gold)', meaning: 'One focused step inside a stage.' },
  common: { label: 'Shared', color: 'var(--green)', meaning: 'Standards every stage loads, like naming and asset bundles.' },
  entry: { label: 'Entry point', color: 'var(--cyan)', meaning: 'Where the coding assistant starts reading.' },
};

export function typeInfo(type: string) {
  return TYPE_INFO[type] ?? { label: type, color: 'var(--sn-text-dim)', meaning: '' };
}

/** Where a skill sits: its stage (or the stage of the orchestrator that owns it). */
export function placeOf(skill: NavSkill): string | null {
  const stages = [...STAGES, ...AGENT_STAGES, ...GENIE_STAGES];
  const own = stages.find((st) => st.orch === skill.id);
  const parent = own ? null : SKILLS.find((s) => s.workers?.includes(skill.id));
  const stage = own ?? (parent ? stages.find((st) => st.orch === parent.id) : undefined);
  if (stage) return `Stage ${stage.num}: ${stageLabel(stage)}`;
  if (skill.phase !== undefined) return `Phase ${skill.phase}`;
  return null;
}

export function parentOf(skill: NavSkill): NavSkill | undefined {
  return SKILLS.find((s) => s.workers?.includes(skill.id));
}

/** Full plain text of authored HTML (no truncation). */
export function plainText(html?: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** A one-sentence summary of a skill, skipping boilerplate headings. */
export function summaryOf(skill: NavSkill): string {
  const text = plainText(skill.desc).replace(/^What This (Stage|Step|Skill|Phase) Does\s*/i, '');
  const m = text.match(/^(.{20,320}?[.!?])(\s|$)/);
  if (m) return m[1];
  if (text.length <= 260) return text;
  return `${text.slice(0, 260).replace(/\s+\S*$/, '')}…`;
}

/** True when the full description adds little beyond the one-line summary. */
export function descIsSummary(skill: NavSkill): boolean {
  return plainText(skill.desc).length <= summaryOf(skill).length + 40;
}

export function canCopyPrompt(skill: NavSkill): boolean {
  return !!skill.prompt && skill.component !== 'gaccel';
}

export const MODULE_MAP: Record<string, AcademyModule> = Object.fromEntries(ACADEMY.map((m) => [m.id, m]));

export function moduleFor(skill: NavSkill): AcademyModule | undefined {
  return skill.platform ? MODULE_MAP[skill.platform] : undefined;
}

// ---------------------------------------------------------------- Tours

export interface TourMeta {
  id: TourId;
  title: string;
  outcome: string;
  color: string;
}

const TOUR_COPY: Record<TourId, Omit<TourMeta, 'id'>> = {
  a: { title: 'Schema to Production', outcome: 'All 9 data stages, from a schema CSV to GenAI agents.', color: 'var(--purple)' },
  b: { title: 'PRD to Deployed App', outcome: 'Build and deploy a Databricks App through the AppKit lifecycle.', color: 'var(--green)' },
  c: { title: 'The Full Picture', outcome: 'Where the data pipeline meets the application layer.', color: 'var(--cyan)' },
  d: { title: 'App to Agent', outcome: 'Tools, memory, and auth, then evaluate, deploy, and monitor with MLflow.', color: 'var(--blue)' },
  e: { title: 'Data to Genie Agent', outcome: 'Semantic layer, Genie agent, activation, and the ontology.', color: 'var(--gold)' },
};

export const TOUR_IDS = Object.keys(TOURS) as TourId[];

export const TOUR_LIST: TourMeta[] = TOUR_IDS.map((id) => ({
  id,
  ...(TOUR_COPY[id] ?? { title: TOURS[id].name, outcome: '', color: 'var(--cyan)' }),
}));

export function tourMinutes(id: TourId): number {
  return Math.max(3, Math.round(TOURS[id].steps.length * 0.5));
}

/** Tours that feature a skill, with the first step that covers it (or -1). */
export function toursForSkill(skillId: string): { tour: TourMeta; step: number }[] {
  const out: { tour: TourMeta; step: number }[] = [];
  for (const t of TOUR_LIST) {
    const tour = TOURS[t.id];
    const step = tour.steps.findIndex((s) => s.skillIds?.includes(skillId));
    if (step >= 0 || tour.tree.includes(`data-skill="${skillId}"`)) out.push({ tour: t, step });
  }
  return out;
}

// ---------------------------------------------------------------- Academy

export const MODULE_ICONS: Record<string, LucideIcon> = {
  apps: AppWindow,
  appkit: Boxes,
  lakebase: Database,
  sdp: Workflow,
  genie: Sparkles,
  uc: ShieldCheck,
  medallion: Layers,
  skills: Compass,
  'dq-expectations': BadgeCheck,
  'lakehouse-monitoring': Activity,
  'metric-views': Ruler,
  'asset-bundles': Package,
  'ml-pipelines': FlaskConical,
  'genai-agents': Bot,
  'agent-memory': Brain,
  'agent-auth': KeyRound,
  'knowledge-assistant': BookOpen,
  'mlflow-eval': ClipboardCheck,
  'agent-monitoring': Radar,
};

export const moduleIcon = (id: string): LucideIcon => MODULE_ICONS[id] ?? BookOpen;

export interface ModuleGroup {
  id: string;
  label: string;
  color: string;
  modules: AcademyModule[];
}

const GROUPS: { id: string; label: string; color: string; ids: string[] }[] = [
  { id: 'start', label: 'Foundations', color: 'var(--cyan)', ids: ['skills'] },
  { id: 'apps', label: 'Build apps', color: 'var(--green)', ids: ['apps', 'appkit', 'lakebase', 'asset-bundles'] },
  { id: 'data', label: 'Data engineering', color: 'var(--purple)', ids: ['medallion', 'sdp', 'dq-expectations', 'lakehouse-monitoring'] },
  { id: 'gov', label: 'Governance and semantics', color: 'var(--teal)', ids: ['uc', 'metric-views', 'genie'] },
  {
    id: 'ai',
    label: 'AI and agents',
    color: 'var(--blue)',
    ids: ['genai-agents', 'ml-pipelines', 'agent-memory', 'agent-auth', 'knowledge-assistant', 'mlflow-eval', 'agent-monitoring'],
  },
];

export const MODULE_GROUPS: ModuleGroup[] = (() => {
  const used = new Set<string>();
  const groups = GROUPS.map((g) => {
    const modules = g.ids.map((id) => MODULE_MAP[id]).filter(Boolean);
    modules.forEach((m) => used.add(m.id));
    return { id: g.id, label: g.label, color: g.color, modules };
  }).filter((g) => g.modules.length);
  const rest = ACADEMY.filter((m) => !used.has(m.id));
  if (rest.length) groups.push({ id: 'more', label: 'More', color: 'var(--sn-text-dim)', modules: rest });
  return groups;
})();

/** Modules in reading order (group order). */
export const MODULE_ORDER: AcademyModule[] = MODULE_GROUPS.flatMap((g) => g.modules);

export function groupOfModule(id: string): ModuleGroup | undefined {
  return MODULE_GROUPS.find((g) => g.modules.some((m) => m.id === id));
}

export function moduleMinutes(m: AcademyModule): number {
  const words = plainText(m.content).split(' ').length;
  return Math.max(2, Math.round(words / 200) + (m.quiz?.length ? 1 : 0));
}

export function relatedSkills(moduleId: string): NavSkill[] {
  return SKILLS.filter((s) => s.platform === moduleId);
}

// ---------------------------------------------------------------- What's new

export const NEW_SKILLS = new Set(NAV_META.newSkillIds);
export const NEW_MODULES = new Set(NAV_META.newModuleIds);
export const NEW_TOURS = new Set<string>(NAV_META.newTourIds);

export const isNewSkill = (id: string) => NEW_SKILLS.has(id);

export function newTracks(): Track[] {
  return TRACKS.filter((t) => {
    const all = skillsInTrack(t.id);
    return all.length > 0 && all.every((s) => NEW_SKILLS.has(s.id));
  });
}

// ---------------------------------------------------------------- Local storage

const KEY = 'v2v.skillsnav.';

export function readStore<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(KEY + name);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStore(name: string, value: unknown) {
  try {
    localStorage.setItem(KEY + name, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
}

export function pushRecent(skillId: string) {
  if (!SKILL_MAP[skillId]) return;
  const list = readStore<string[]>('recent', []).filter((id) => id !== skillId);
  writeStore('recent', [skillId, ...list].slice(0, 5));
}
