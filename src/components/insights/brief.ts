import type { BlueprintChoice } from './blueprint/types';
import { ADD_ON_LABEL, ADD_ON_ORDER, normalizeAddOns, type AddOn } from './recipes';
import type { ApprovedUseCase } from './usecases/useCaseApi';

export type DataSource = 'existing' | 'upload' | 'sample' | 'blueprint';

export interface InsightsBrief {
  name: string;
  industryLabel: string;
  questions: string[];
  dataSource: DataSource;
  dataLocation: string;
  blueprint?: BlueprintChoice | null;
  useCase?: ApprovedUseCase | null;
  idea?: IdeaBrief | null;
  /** What the build adds beyond the Genie space and dashboard. Empty keeps the brief exactly as before. */
  addOns?: AddOn[];
}

/** The shaped idea, written as one labelled line per field above the questions. */
export interface IdeaBrief {
  headline: string;
  problem?: string;
  who?: string;
  metric?: string;
  approach?: string;
  notDoing?: string[];
  value?: string;
  origin?: string;
}

const QUESTIONS_HEADER = 'Questions this should answer:';
const DATA_HEADER = 'Data:';
const BLUEPRINT_HEADER = 'Blueprint:';
const USE_CASE_HEADER = 'Approved use case:';
const IDEA_HEADER = 'Idea:';
const BUILDS_HEADER = 'Builds:';
const RECIPE_HEADER = 'Recipe:';
const RECIPE_CORE = 'genie-accelerator';
const BLUEPRINT_REPO = 'github.com/databricks-industry-solutions/lakehouse-industry-data-models';

const DATA_PHRASES: Record<DataSource, string> = {
  existing: 'Use data that already exists in Databricks',
  upload: 'Use a file I will upload',
  sample: 'Use realistic sample data',
  blueprint: 'Use the industry data model',
};

/** The session API rejects longer custom use case labels. */
export const MAX_NAME_LENGTH = 30;

/** Shortens a name to fit, at a word boundary where possible. */
export function fitName(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ');
  if (t.length <= MAX_NAME_LENGTH) return t;
  const cut = t.slice(0, MAX_NAME_LENGTH + 1);
  const space = cut.lastIndexOf(' ');
  let out = space > 12 ? cut.slice(0, space) : t.slice(0, MAX_NAME_LENGTH);
  for (let prev = ''; prev !== out;) {
    prev = out;
    out = out.replace(/[\s,;:–-]+$/, '').replace(/\s+(for|of|and|or|the|to|in|on|with|a|an|by|at|from)$/i, '');
  }
  return out;
}

export const toSlug = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

function blueprintLines(b: BlueprintChoice): string[] {
  return [
    `${BLUEPRINT_HEADER} ${b.slug} ${b.version} ${b.flavour} @${b.commitSha.slice(0, 7)} | catalog: ${b.catalog} | areas: ${b.areas.join(', ') || 'all'} | KPIs: ${b.kpis.join(', ') || 'none picked'}`,
    `Source: ${BLUEPRINT_REPO} (data-models/${b.slug}/${b.version}/${b.flavour}, commit ${b.commitSha}). Tables, foreign keys, sensitive-field tags and metric views come from that model; the rows are generated sample data.`,
  ];
}

/**
 * The brief is stored as the session's custom use-case description, so every
 * generated prompt sees the questions. `parseBrief` must keep reading what
 * `composeBrief` writes.
 */
export function composeBrief(b: InsightsBrief): string {
  const audience = b.industryLabel ? `${b.industryLabel} ` : '';
  const bp = b.dataSource === 'blueprint' ? b.blueprint : null;
  const source: DataSource = b.dataSource === 'blueprint' && !bp ? 'existing' : b.dataSource;
  const dataDetail = bp
    ? ` "${bp.label}" (${bp.catalog})`
    : b.dataSource === 'existing' && b.dataLocation ? ` (${b.dataLocation})` : '';
  const addOns = normalizeAddOns(b.addOns ?? []);
  const withApp = addOns.includes('copilot') || addOns.includes('app_view');
  const scope = withApp
    ? 'It builds on data that already exists, and adds the app described under Builds; no new pipelines.'
    : 'It builds on data that already exists; no new apps or pipelines.';
  const lines = [
    `${b.name}: a Genie space that lets ${audience}business users ask questions about their data in plain English and get trusted, consistent answers, plus an AI/BI dashboard built on the same governed metrics. ${scope}`,
    '',
    ...(addOns.length ? [...addOnLines(addOns), ''] : []),
    ...(b.idea ? [...ideaLines(b.idea), ''] : []),
    QUESTIONS_HEADER,
    ...b.questions.map(q => `- ${q}`),
    '',
    `${DATA_HEADER} ${DATA_PHRASES[source]}${dataDetail}.`,
    ...(bp ? blueprintLines(bp) : []),
    ...(b.useCase ? [approvedUseCaseLine(b.useCase)] : []),
  ];
  return lines.join('\n');
}

function addOnLines(addOns: AddOn[]): string[] {
  return [
    `${BUILDS_HEADER} a Genie space and an AI/BI dashboard on governed Metric Views; ${addOns.map(a => ADD_ON_LABEL[a].builds).join('; ')}.`,
    `${RECIPE_HEADER} ${[RECIPE_CORE, ...addOns].join(' + ')}`,
  ];
}

function parseAddOns(line: string | undefined): AddOn[] {
  if (!line) return [];
  const parts = line.slice(RECIPE_HEADER.length).split('+').map(p => p.trim());
  return normalizeAddOns(ADD_ON_ORDER.filter(a => parts.includes(a)));
}

function ideaLines(i: IdeaBrief): string[] {
  const one = (v?: string) => (v ?? '').replace(/\s+/g, ' ').trim();
  const fields: [string, string][] = [
    [IDEA_HEADER.slice(0, -1), one(i.headline)],
    ['Problem', one(i.problem)],
    ['Who', one(i.who)],
    ['Success metric', one(i.metric)],
    ['Approach', one(i.approach)],
    ['First version will not', (i.notDoing ?? []).map(one).filter(Boolean).join('; ')],
    ['Value', one(i.value)],
    ['Started from', one(i.origin)],
  ];
  return fields.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
}

function approvedUseCaseLine(u: ApprovedUseCase): string {
  const clean = (v: string) => v.replace(/\|/g, '/').trim();
  return `${USE_CASE_HEADER} ${clean(u.label)} | ${clean(u.industryLabel)} | ${u.industry}/${u.useCase}${u.certified ? ' | certified' : ''}${u.category ? ` | ${clean(u.category)}` : ''}`;
}

function parseUseCase(line: string): ApprovedUseCase | null {
  const parts = line.slice(USE_CASE_HEADER.length).split('|').map(p => p.trim());
  const ids = parts[2]?.match(/^([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)$/);
  if (!parts[0] || !ids) return null;
  const rest = parts.slice(3);
  return {
    label: parts[0],
    industryLabel: parts[1] ?? '',
    industry: ids[1],
    useCase: ids[2],
    certified: rest.includes('certified'),
    category: rest.find(r => r !== 'certified') ?? '',
  };
}

function parseBlueprint(line: string, label: string): BlueprintChoice | null {
  const m = line.slice(BLUEPRINT_HEADER.length).trim().match(/^(\S+)\s+(\S+)\s+(\S+)\s+@(\S+)\s*\|(.*)$/);
  if (!m) return null;
  const [, slug, version, flavour, sha, rest] = m;
  const field = (name: string) => rest.match(new RegExp(`${name}:\\s*([^|]*)`))?.[1].trim() ?? '';
  const list = (v: string) => (v && v !== 'all' && v !== 'none picked' ? v.split(',').map(s => s.trim()).filter(Boolean) : []);
  return {
    slug,
    version,
    flavour,
    commitSha: sha,
    label: label || slug,
    catalog: field('catalog') || `idm_${slug}_${flavour}`,
    areas: list(field('areas')),
    kpis: list(field('KPIs')),
  };
}

export interface ParsedBrief {
  questions: string[];
  dataSource: DataSource;
  dataLocation: string;
  blueprint: BlueprintChoice | null;
  useCase: ApprovedUseCase | null;
  /** Headline of the idea the brief was set up from, if it came from one. */
  ideaHeadline: string;
  addOns: AddOn[];
}

export function parseBrief(description: string): ParsedBrief {
  const questions: string[] = [];
  let dataSource: DataSource = 'existing';
  let dataLocation = '';
  let blueprint: BlueprintChoice | null = null;
  if (!description) return { questions, dataSource, dataLocation, blueprint, useCase: null, ideaHeadline: '', addOns: [] };

  const lines = description.split('\n');
  const start = lines.findIndex(l => l.trim() === QUESTIONS_HEADER);
  if (start >= 0) {
    for (const line of lines.slice(start + 1)) {
      const t = line.trim();
      if (!t.startsWith('- ')) break;
      questions.push(t.slice(2).trim());
    }
  }

  const dataLine = lines.find(l => l.startsWith(DATA_HEADER));
  if (dataLine) {
    const rest = dataLine.slice(DATA_HEADER.length).trim();
    if (rest.startsWith(DATA_PHRASES.upload)) dataSource = 'upload';
    else if (rest.startsWith(DATA_PHRASES.sample)) dataSource = 'sample';
    else if (rest.startsWith(DATA_PHRASES.blueprint)) {
      const label = rest.match(/"([^"]+)"/)?.[1] ?? '';
      const bpLine = lines.find(l => l.startsWith(BLUEPRINT_HEADER));
      blueprint = bpLine ? parseBlueprint(bpLine, label) : null;
      // Without a readable Blueprint line, fall back to the plain existing-data path.
      if (blueprint) {
        dataSource = 'blueprint';
        dataLocation = blueprint.catalog;
      }
    }
    if (dataSource !== 'blueprint') {
      const loc = rest.match(/\(([^)]+)\)/);
      if (loc) dataLocation = loc[1];
    }
  }
  const ucLine = lines.find(l => l.startsWith(USE_CASE_HEADER));
  const ideaLine = lines.find(l => l.startsWith(IDEA_HEADER));
  return {
    questions, dataSource, dataLocation, blueprint,
    useCase: ucLine ? parseUseCase(ucLine) : null,
    ideaHeadline: ideaLine ? ideaLine.slice(IDEA_HEADER.length).trim() : '',
    addOns: parseAddOns(lines.find(l => l.startsWith(RECIPE_HEADER))),
  };
}
