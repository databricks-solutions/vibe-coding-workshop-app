import type { LucideIcon } from 'lucide-react';
import {
  BookOpenCheck, Compass, FileText, FolderOpen, Gauge, LayoutDashboard, MessageCircleQuestion,
  MessagesSquare, Ruler, ScrollText, Search, ShieldCheck, Sparkles, Tags,
} from 'lucide-react';
import type { DataSource } from './brief';

export type ChapterId = 'ready' | 'teach' | 'answer' | 'show';

export interface Chapter {
  id: ChapterId;
  title: string;
  promise: string;
  celebration: string;
}

export interface Moment {
  step: number;
  /** Binding to the prompt row. `semlayer_locate` is swapped per data source (see `tagForMoment`). */
  tag: string;
  chapter: ChapterId;
  kind: 'setup' | 'prompt';
  icon: LucideIcon;
  title: string;
  sentence: string;
  whatYoullSee: string;
  /** Shown in the companion once this moment is done: "It now ..." */
  unlock: string;
  minutes: number;
  /** Skills Navigator id of the Genie Accelerator skill this step follows. */
  skill?: string;
  /** Add-on steps can be skipped; the core steps cannot. */
  optional?: boolean;
}

export const CHAPTERS: Chapter[] = [
  {
    id: 'ready',
    title: 'Get ready',
    promise: 'Your workspace and a one-page brief',
    celebration: 'Your workspace is ready and your brief is written.',
  },
  {
    id: 'teach',
    title: 'Teach it your business',
    promise: 'It learns your data and what your numbers mean',
    celebration: 'Your Genie now speaks your language.',
  },
  {
    id: 'answer',
    title: 'Make it answer',
    promise: 'A Genie that answers your questions, and gets them right',
    celebration: 'Your Genie is answering your questions.',
  },
  {
    id: 'show',
    title: 'Show it',
    promise: 'A dashboard you can share',
    celebration: 'Your dashboard is live.',
  },
];

export const MOMENTS: Moment[] = [
  {
    step: 2, tag: 'project_setup', chapter: 'ready', kind: 'setup', icon: FolderOpen, minutes: 10,
    title: 'Open your workspace',
    sentence: 'A quick one-time setup so Genie Code knows the playbook. Two copies and you are done.',
    whatYoullSee: 'Two green checkmarks in the terminal, then Genie Code replies "Setup verified".',
    unlock: 'has a home in your workspace',
  },
  {
    step: 3, tag: 'prd_generation', chapter: 'ready', kind: 'prompt', icon: FileText, minutes: 5,
    title: 'Write your one-page brief',
    sentence: 'Genie Code turns your questions into a short brief: who it is for, what it should answer, and how you will know it works.',
    whatYoullSee: 'A one-page brief saved in your project folder.',
    unlock: 'knows who it is for',
  },
  {
    step: 57, tag: 'semlayer_locate', chapter: 'teach', kind: 'prompt', icon: Search, minutes: 10, skill: 'gaccel-locate',
    title: 'Find your data',
    sentence: 'Genie Code finds the tables that can answer your questions. Nothing is built yet, it just looks.',
    whatYoullSee: 'A short list of the tables it found and why each one matters.',
    unlock: 'knows where your data lives',
  },
  {
    step: 58, tag: 'semlayer_profile', chapter: 'teach', kind: 'prompt', icon: Compass, minutes: 8, skill: 'gaccel-profile',
    title: 'Get to know your data',
    sentence: 'A quick health check: what each column holds, what is missing, and how the tables connect.',
    whatYoullSee: 'A plain summary of each table, with anything odd called out.',
    unlock: 'understands your columns',
  },
  {
    step: 59, tag: 'semlayer_measures', chapter: 'teach', kind: 'prompt', icon: Ruler, minutes: 10, skill: 'gaccel-measures',
    title: 'Agree on what your numbers mean',
    sentence: 'Genie Code proposes how things like revenue or churn should be calculated. Nothing is created until you approve.',
    whatYoullSee: 'A short list of metrics with their definitions, waiting for your OK.',
    unlock: 'uses the numbers you agreed on',
  },
  {
    step: 60, tag: 'semlayer_metric_view', chapter: 'teach', kind: 'prompt', icon: Gauge, minutes: 12, skill: 'gaccel-mv',
    title: 'Lock in your official metrics',
    sentence: 'Your approved definitions become one official source, so every answer uses the same math.',
    whatYoullSee: 'Your metrics, created and checked one by one.',
    unlock: 'has one official version of every metric',
  },
  {
    step: 61, tag: 'semlayer_synonyms', chapter: 'teach', kind: 'prompt', icon: Tags, minutes: 6, skill: 'gaccel-syn',
    title: 'Teach it the words your team uses',
    sentence: 'People say "sales", "revenue" and "bookings" for the same thing. This teaches Genie all of them.',
    whatYoullSee: 'A list of everyday words mapped to each metric.',
    unlock: 'speaks your team\'s language',
  },
  {
    step: 62, tag: 'gagent_describe', chapter: 'answer', kind: 'prompt', icon: MessagesSquare, minutes: 6, skill: 'gaccel-describe',
    title: 'Create your Genie',
    sentence: 'Your Genie space is created on top of your official metrics, with a clear description of what it is for.',
    whatYoullSee: 'A new Genie space you can open and chat with.',
    unlock: 'exists, and you can chat with it',
  },
  {
    step: 63, tag: 'gagent_instructions', chapter: 'answer', kind: 'prompt', icon: ScrollText, minutes: 8, skill: 'gaccel-instr',
    title: 'Give it house rules',
    sentence: 'A few short rules about tone, time periods and edge cases so answers feel like they come from your team.',
    whatYoullSee: 'A handful of clear instructions added to your Genie.',
    unlock: 'follows your house rules',
  },
  {
    step: 64, tag: 'gagent_verified', chapter: 'answer', kind: 'prompt', icon: ShieldCheck, minutes: 10, skill: 'gaccel-verified',
    title: 'Add answers you trust',
    sentence: 'For your most important questions, Genie gets a checked answer it will always use.',
    whatYoullSee: 'Your key questions saved with verified answers.',
    unlock: 'gives trusted answers to your key questions',
  },
  {
    step: 65, tag: 'gagent_benchmarks', chapter: 'answer', kind: 'prompt', icon: BookOpenCheck, minutes: 10, skill: 'gaccel-bench',
    title: 'Test it with your questions',
    sentence: 'Your questions become a test, so you can measure how often Genie gets them right.',
    whatYoullSee: 'A test set loaded, with a first score.',
    unlock: 'is tested against your questions',
  },
  {
    step: 66, tag: 'gagent_optimize', chapter: 'answer', kind: 'prompt', icon: Sparkles, minutes: 15, skill: 'gaccel-optimize',
    title: 'Tune it until it\'s right',
    sentence: 'Genie Code reruns the test, fixes what missed, and repeats until the score clears the bar.',
    whatYoullSee: 'The score climbing, then a short summary of what changed.',
    unlock: 'passes your accuracy bar',
  },
  {
    step: 71, tag: 'gaccel_dashboard', chapter: 'show', kind: 'prompt', icon: LayoutDashboard, minutes: 12, skill: 'gaccel-dash',
    title: 'Build your dashboard',
    sentence: 'A clean dashboard built on the same official metrics, so the charts and Genie always agree.',
    whatYoullSee: 'A published dashboard with a tile for each of your questions.',
    unlock: 'has a dashboard to match',
  },
];

/** Genie Accelerator skills the steps follow, by Skills Navigator id. */
export const ACCELERATOR_SKILLS: Record<string, string> = {
  'gaccel-locate': 'Locate Data & Bring Context',
  'gaccel-profile': 'Profile Your Schema',
  'gaccel-measures': 'Measures Analysis',
  'gaccel-mv': 'Draft the Metric View',
  'gaccel-syn': 'Review & Expand Synonyms',
  'gaccel-describe': 'Describe the Genie Agent',
  'gaccel-instr': 'Author Agent Instructions',
  'gaccel-verified': 'Add Verified Queries',
  'gaccel-bench': 'Load Benchmarks with Expected Answers',
  'gaccel-optimize': 'Optimize the Agent',
  'gaccel-domain': 'Model the Domain + Subdomains',
  'gaccel-pages': 'Author Pages',
  'gaccel-routing': 'Write the Routing Page',
  'gaccel-dash': 'AI/BI Dashboard',
  'gaccel-sync': 'Choose What to Activate',
};

export const TOTAL_MINUTES = MOMENTS.reduce((sum, m) => sum + m.minutes, 0);

export function tagForMoment(moment: Moment, dataSource: DataSource): string {
  if (moment.tag !== 'semlayer_locate') return moment.tag;
  if (dataSource === 'upload') return 'semlayer_locate_upload';
  if (dataSource === 'sample') return 'semlayer_locate_synthetic';
  return 'semlayer_locate';
}

/** Gives the locate step path-specific language while retaining the same step and prompt binding. */
export function dataSourceMoment(moment: Moment, dataSource: DataSource, blueprintLabel?: string): Moment {
  if (moment.tag !== 'semlayer_locate') return moment;
  if (dataSource === 'upload') {
    return {
      ...moment,
      title: 'Build sample data from your schema',
      sentence: 'Upload your schema definition CSV. Genie Code proposes matching tables and row counts, then waits for your approval before generating sample rows.',
      whatYoullSee: 'Your schema validated, followed by a data plan and instructions tailored to its tables and columns.',
      unlock: 'has sample data shaped by your schema',
    };
  }
  if (dataSource === 'sample') {
    return {
      ...moment,
      title: 'Generate sample data from your idea',
      sentence: 'Genie Code proposes a small schema from your idea and questions, then waits for your approval before generating realistic sample rows.',
      whatYoullSee: 'A proposed schema and row counts grounded in your idea, ready for your approval.',
      unlock: 'has idea-grounded synthetic sample data',
    };
  }
  if (dataSource === 'blueprint' && blueprintLabel) return blueprintMoment(moment, blueprintLabel);
  return moment;
}

/** In the blueprint path, "Find your data" becomes installing the chosen model. */
export function blueprintMoment(moment: Moment, label: string): Moment {
  if (moment.tag !== 'semlayer_locate') return moment;
  return {
    ...moment,
    title: 'Bring in your industry model',
    sentence: `The ${label} model is set up in your workspace with realistic sample data, then Genie Code learns where everything is.`,
    whatYoullSee: 'The setup finishing in the background, then a one-page data map from Genie Code.',
    unlock: `stands on the ${label} industry model`,
  };
}

export function chapterOf(id: ChapterId): Chapter {
  return CHAPTERS.find(c => c.id === id)!;
}

export function momentsIn(id: ChapterId, moments: Moment[] = MOMENTS): Moment[] {
  return moments.filter(m => m.chapter === id);
}

export function chapterMinutes(id: ChapterId, moments: Moment[] = MOMENTS): number {
  return momentsIn(id, moments).reduce((sum, m) => sum + m.minutes, 0);
}

export function totalMinutes(moments: Moment[] = MOMENTS): number {
  return moments.reduce((sum, m) => sum + m.minutes, 0);
}

export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export interface IndustryIdea {
  id: string;
  label: string;
  questions: string[];
}

export const INDUSTRY_IDEAS: IndustryIdea[] = [
  {
    id: 'retail', label: 'Retail & CPG',
    questions: [
      'Which stores are below their sales target this month?',
      'What are our top 10 products by margin?',
      'Where are we about to run out of stock?',
      'How did the last promotion change basket size?',
    ],
  },
  {
    id: 'financial_services', label: 'Financial services',
    questions: [
      'Which branches have rising loan delinquencies?',
      'What drove the change in deposits last quarter?',
      'Which customer segments are most likely to churn?',
      'How is fee revenue trending by product?',
    ],
  },
  {
    id: 'healthcare', label: 'Healthcare',
    questions: [
      'Which clinics have the longest patient wait times?',
      'How is the readmission rate trending by department?',
      'Where are we over budget on supplies?',
      'Which procedures have the most claim denials?',
    ],
  },
  {
    id: 'manufacturing', label: 'Manufacturing',
    questions: [
      'Which production lines had the most downtime last week?',
      'What is our scrap rate by plant?',
      'Which suppliers deliver late most often?',
      'How is on-time delivery trending this quarter?',
    ],
  },
  {
    id: 'media_telecom', label: 'Media & telecom',
    questions: [
      'Which regions have the highest subscriber churn?',
      'What content drives the most engagement?',
      'How is average revenue per user trending?',
      'Which plans are customers downgrading from?',
    ],
  },
  {
    id: 'travel_hospitality', label: 'Travel & hospitality',
    questions: [
      'Which properties have the lowest occupancy next month?',
      'How do cancellations trend by booking channel?',
      'What is our average daily rate by region?',
      'Which loyalty tiers spend the most per stay?',
    ],
  },
];

export const QUESTION_PLACEHOLDERS = [
  'Which stores are below their sales target this month?',
  'What drove the change in revenue last quarter?',
  'Which customers are most likely to churn?',
  'Where are we over budget?',
];

export const ASK_ICON = MessageCircleQuestion;
