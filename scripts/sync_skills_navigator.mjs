#!/usr/bin/env node
/**
 * Sync the Agent Skills Navigator content from the template repo.
 *
 * Reads presentations/workshop-explorer.html from
 * databricks-solutions/vibe-coding-workshop-template, evaluates its data
 * script (SKILLS, STAGES, PHASES, AGENT_STAGES, GENIE_STAGES, TOURS, ACADEMY
 * and the build*Tree helpers) in an isolated vm context, validates every
 * cross-reference, and writes src/constants/skillsNavigatorData.ts.
 *
 * Usage:
 *   node scripts/sync_skills_navigator.mjs                 # latest main
 *   node scripts/sync_skills_navigator.mjs --ref <sha>     # pinned commit
 *   node scripts/sync_skills_navigator.mjs --file <path>   # local explorer.html
 *   node scripts/sync_skills_navigator.mjs --check         # validate only
 *
 * Set GITHUB_TOKEN to avoid API rate limits.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const REPO = 'databricks-solutions/vibe-coding-workshop-template';
const SOURCE_PATH = 'presentations/workshop-explorer.html';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src/constants/skillsNavigatorData.ts');

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const checkOnly = args.includes('--check');

async function gh(url, accept = 'application/vnd.github+json') {
  const headers = { Accept: accept, 'User-Agent': 'v2v-skills-sync' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return accept.includes('raw') ? res.text() : res.json();
}

async function loadSource() {
  const file = opt('--file');
  if (file) return { html: fs.readFileSync(file, 'utf8'), commit: opt('--ref') || 'local' };
  const ref = opt('--ref') || 'main';
  const { sha } = await gh(`https://api.github.com/repos/${REPO}/commits/${ref}`);
  const html = await gh(
    `https://api.github.com/repos/${REPO}/contents/${SOURCE_PATH}?ref=${sha}`,
    'application/vnd.github.raw'
  );
  return { html, commit: sha };
}

function evaluate(html) {
  const start = html.indexOf('// ======================== DATA MODEL');
  const end = html.indexOf('// ======================== THEME TOGGLE');
  if (start < 0 || end < 0) throw new Error('Could not locate the data script markers in the explorer HTML.');
  const code =
    html.slice(start, end) +
    '\n;({ SKILLS, STAGES, PHASES, AGENT_STAGES, GENIE_STAGES, TOURS, ACADEMY })';
  const data = vm.runInNewContext(code, {}, { timeout: 5000 });
  return JSON.parse(JSON.stringify(data));
}

function validate(d) {
  const errors = [];
  const warnings = [];
  const ids = new Set();
  for (const s of d.SKILLS) {
    if (ids.has(s.id)) errors.push(`duplicate skill id ${s.id}`);
    ids.add(s.id);
  }
  const modules = new Set(d.ACADEMY.map((m) => m.id));
  for (const s of d.SKILLS) {
    for (const w of s.workers || []) if (!ids.has(w)) errors.push(`${s.id}: unknown worker ${w}`);
    for (const c of s.commonDeps || []) if (!ids.has(c)) errors.push(`${s.id}: unknown common dep ${c}`);
    if (s.platform && !modules.has(s.platform)) warnings.push(`${s.id}: no academy module for platform "${s.platform}"`);
  }
  for (const st of [...d.STAGES, ...d.AGENT_STAGES, ...d.GENIE_STAGES]) {
    if (!ids.has(st.orch)) errors.push(`stage ${st.num} ${st.label}: unknown skill ${st.orch}`);
  }
  for (const p of d.PHASES) for (const s of p.skills) if (!ids.has(s)) errors.push(`phase ${p.num}: unknown skill ${s}`);
  for (const [key, tour] of Object.entries(d.TOURS)) {
    tour.steps.forEach((step, i) => {
      for (const s of step.skillIds || []) if (!ids.has(s)) errors.push(`tour ${key} step ${i + 1}: unknown skill ${s}`);
      for (const n of [...(step.activate || []), ...(step.expand || []), ...(step.lit || [])]) {
        if (!tour.tree.includes(`id="${n}"`)) errors.push(`tour ${key} step ${i + 1}: node ${n} not in tree`);
      }
    });
    for (const m of tour.tree.matchAll(/data-skill="([^"]+)"/g)) {
      if (!ids.has(m[1])) errors.push(`tour ${key} tree: unknown skill ${m[1]}`);
    }
  }
  return { errors, warnings };
}

function previousMeta() {
  if (!fs.existsSync(OUT)) return null;
  const src = fs.readFileSync(OUT, 'utf8');
  const meta = src.match(/export const NAV_META: NavMeta = (\{[\s\S]*?\n\});/);
  const skillsBlock = src.slice(src.indexOf('export const SKILLS'), src.indexOf('export const SKILL_MAP'));
  const acadBlock = src.slice(src.indexOf('export const ACADEMY'));
  const toursBlock = src.slice(src.indexOf('export const TOURS'), src.indexOf('export const ACADEMY'));
  return {
    meta: meta ? JSON.parse(meta[1]) : null,
    skillIds: new Set([...skillsBlock.matchAll(/^ {4}"id": "([^"]+)"/gm)].map((m) => m[1])),
    moduleIds: new Set([...acadBlock.matchAll(/^ {4}"id": "([^"]+)"/gm)].map((m) => m[1])),
    tourIds: new Set([...toursBlock.matchAll(/^ {2}"([a-z])": \{/gm)].map((m) => m[1])),
  };
}

function buildMeta(d, commit, prev) {
  if (prev?.meta && prev.meta.sourceCommit === commit) return prev.meta;
  const diff = (list, seen) => (seen && seen.size ? list.filter((x) => !seen.has(x)) : []);
  return {
    sourceRepo: REPO,
    sourceCommit: commit,
    syncedAt: new Date().toISOString().slice(0, 10),
    newSkillIds: diff(d.SKILLS.map((s) => s.id), prev?.skillIds),
    newModuleIds: diff(d.ACADEMY.map((m) => m.id), prev?.moduleIds),
    newTourIds: diff(Object.keys(d.TOURS), prev?.tourIds),
  };
}

const HEADER = `/**
 * Agent Skills Navigator data, generated from
 * presentations/workshop-explorer.html in the vibe-coding-workshop-template repo.
 *
 * GENERATED by scripts/sync_skills_navigator.mjs. Do not hand-edit; change the
 * template repo and re-run the script.
 *
 * \`desc\`, \`rationale\`, \`content\`, and tour \`tree\` fields contain trusted,
 * static HTML authored in the template repo. They are rendered with
 * dangerouslySetInnerHTML inside the scoped \`.skills-navigator\` styling.
 */

export type SkillNavType =
  | 'orchestrator' | 'worker' | 'common' | 'entry' | 'platform' | string;

export interface NavSkill {
  id: string;
  name: string;
  domain?: string;
  component?: string;
  type: SkillNavType;
  stage?: number | string;
  phase?: number;
  platform?: string;
  desc?: string;
  keywords?: string[];
  workers?: string[];
  commonDeps?: string[];
  emits?: string[];
  code?: string;
  rationale?: string;
  prompt?: string;
}

export interface NavStage { num: string; label: string; sc: string; orch: string; }
export interface NavPhase { num: number; label: string; skills: string[]; }

export interface TourStep {
  expand?: string[];
  activate?: string[];
  lit?: string[];
  narration: string;
  tier?: [number, string];
  skillIds?: string[];
  designRationale?: string;
  inputOutput?: { inputs: string[]; outputs: string[] };
  summary?: boolean;
}
export interface Tour { name: string; tree: string; steps: TourStep[]; }
export type TourId = 'a' | 'b' | 'c' | 'd' | 'e';

export interface AcademyQuizQ { q: string; opts: string[]; answer: number; }
export interface AcademyModule {
  id: string; title: string; subtitle: string; icon: string; color: string;
  content: string; quiz?: AcademyQuizQ[];
}

export interface NavMeta {
  sourceRepo: string;
  sourceCommit: string;
  syncedAt: string;
  newSkillIds: string[];
  newModuleIds: string[];
  newTourIds: string[];
}
`;

function render(d, meta) {
  const j = (v) => JSON.stringify(v, null, 2);
  return `${HEADER}
export const NAV_META: NavMeta = ${j(meta)};

export const SKILLS: NavSkill[] = ${j(d.SKILLS)};

export const SKILL_MAP: Record<string, NavSkill> = Object.fromEntries(
  SKILLS.map((s) => [s.id, s])
);

export const STAGES: NavStage[] = ${j(d.STAGES)};

export const PHASES: NavPhase[] = ${j(d.PHASES)};

export const AGENT_STAGES: NavStage[] = ${j(d.AGENT_STAGES)};

export const GENIE_STAGES: NavStage[] = ${j(d.GENIE_STAGES)};

export const TOURS: Record<TourId, Tour> = ${j(d.TOURS)};

export const ACADEMY: AcademyModule[] = ${j(d.ACADEMY)};
`;
}

const { html, commit } = await loadSource();
const data = evaluate(html);
const { errors, warnings } = validate(data);
warnings.forEach((w) => console.warn(`warning: ${w}`));
if (errors.length) {
  errors.forEach((e) => console.error(`error: ${e}`));
  console.error(`\n${errors.length} broken reference(s); ${path.relative(ROOT, OUT)} was not written.`);
  process.exit(1);
}
const summary = `${data.SKILLS.length} skills, ${Object.keys(data.TOURS).length} tours, ${data.ACADEMY.length} modules @ ${commit.slice(0, 7)}`;
if (checkOnly) {
  console.log(`OK: ${summary}`);
  process.exit(0);
}
const prev = previousMeta();
const meta = buildMeta(data, commit, prev);
fs.writeFileSync(OUT, render(data, meta));
console.log(`Wrote ${path.relative(ROOT, OUT)}: ${summary}`);
console.log(`New: ${meta.newSkillIds.length} skills, ${meta.newModuleIds.length} modules, tours [${meta.newTourIds.join(', ')}]`);
