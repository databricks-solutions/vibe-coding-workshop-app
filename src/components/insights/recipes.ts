import { useEffect, useState } from 'react';
import {
  BellRing, BookOpen, ClipboardList, Code2, Database, GitBranch, Globe, Link2, MessagesSquare, Palette,
  PencilLine, RefreshCw, Rocket, ShieldCheck, Table2,
} from 'lucide-react';
import { apiClient } from '../../api/client';
import { chosenShape, type Idea, type SwitchedAddOn } from '../journeykit';
import { MOMENTS, type Moment } from './journey';

/**
 * What an Insights build adds on top of the Genie Accelerator core (steps 2, 3, 57-66, 71).
 * Ontology uses the Accelerator's own steps. Every add-on is off until switched on.
 */
export type AddOn = SwitchedAddOn;
export const ADD_ON_ORDER: AddOn[] = ['ontology', 'alerts', 'app_view', 'copilot'];

export const ADD_ON_LABEL: Record<AddOn, { title: string; body: string; builds: string }> = {
  ontology: {
    title: 'Map your business domain',
    body: 'Pages that explain your metrics and route questions to the right one. Beta; skip any step you cannot do.',
    builds: 'a Discover business domain with pages and a routing page (Genie Ontology, Beta)',
  },
  alerts: {
    title: 'Alerts when numbers move',
    body: 'Alerts on your official metrics, plus a scheduled dashboard email.',
    builds: 'SQL alerts on the governed Metric View measures, plus a dashboard subscription',
  },
  app_view: {
    title: 'A read-only app',
    body: 'Your data and Genie in a web app, copied to a fast database.',
    builds: 'a read-only Databricks App on synced Lakebase tables, with the Genie space inside',
  },
  copilot: {
    title: 'An app people work in',
    body: 'Screens where your team saves decisions to a database, with Genie built in.',
    builds: 'a Databricks App with Lakebase read-write screens, with the Genie space inside',
  },
};

type AddOnMoment = Moment & { addOn: AddOn };

const m = (addOn: AddOn, x: Omit<Moment, 'kind'>): AddOnMoment => ({ ...x, kind: 'prompt', optional: true, addOn });

const ONTOLOGY: AddOnMoment[] = [
  m('ontology', {
    step: 67, tag: 'ontology_domain', chapter: 'answer', icon: Globe, minutes: 10, skill: 'gaccel-domain',
    title: 'Map your business domain',
    sentence: 'Your business areas become a domain with a few subdomains in Discover, so answers sit in the right context. Part of it is done by hand, and you can skip it if you do not have access.',
    whatYoullSee: 'A domain with three to five subdomains in Discover.',
    unlock: 'knows how your business is organised',
  }),
  m('ontology', {
    step: 68, tag: 'ontology_pages', chapter: 'answer', icon: BookOpen, minutes: 12, skill: 'gaccel-pages',
    title: 'Write pages about your metrics',
    sentence: 'Short pages explain your key metrics in plain words, with the official formula and the words people use.',
    whatYoullSee: 'Two published pages in your domain.',
    unlock: 'can explain your metrics in plain words',
  }),
  m('ontology', {
    step: 69, tag: 'ontology_routing', chapter: 'answer', icon: GitBranch, minutes: 8, skill: 'gaccel-routing',
    title: 'Point questions to the right metric',
    sentence: 'One page maps the ways people ask to the official metric that answers it.',
    whatYoullSee: 'A published routing page that covers every metric.',
    unlock: 'sends each question to the right metric',
  }),
];

const ALERTS: AddOnMoment[] = [
  m('alerts', {
    step: 74, tag: 'insights_alerts', chapter: 'show', icon: BellRing, minutes: 10,
    title: 'Get told when something changes',
    sentence: 'Alerts watch your official metrics and tell the right people when a number crosses the line you set. You approve each one before it is created.',
    whatYoullSee: 'Alerts on your key metrics, plus a scheduled dashboard email.',
    unlock: 'tells you when a number needs attention',
  }),
];

const GENIE_IN_APP = (addOn: AddOn): AddOnMoment => m(addOn, {
  step: 73, tag: 'insights_genie_in_app', chapter: 'show', icon: MessagesSquare, minutes: 8,
  title: 'Put your Genie in the app',
  sentence: 'A chat panel in the app, backed by the Genie space you tuned, so people can ask questions where they work.',
  whatYoullSee: 'A Genie chat panel added to the app.',
  unlock: 'answers questions inside the app',
});

const APP_VIEW: AddOnMoment[] = [
  m('app_view', {
    step: 72, tag: 'insights_activation', chapter: 'show', icon: ClipboardList, minutes: 8, skill: 'gaccel-sync',
    title: 'Choose what your app shows',
    sentence: 'Pick the tables behind your metrics and dashboard that the app needs, with a reason for each.',
    whatYoullSee: 'A short list of tables waiting for your OK.',
    unlock: 'knows what the app should show',
  }),
  m('app_view', {
    step: 32, tag: 'insights_table_design', chapter: 'show', icon: Table2, minutes: 12,
    title: 'Plan the app\'s data copy',
    sentence: 'A fast database is set up for the app, with a plan for how each table is copied and how often.',
    whatYoullSee: 'A sync plan and a database with cost limits.',
    unlock: 'has a fast database for the app',
  }),
  m('app_view', {
    step: 33, tag: 'insights_reverse_sync', chapter: 'show', icon: RefreshCw, minutes: 12,
    title: 'Copy the data for the app',
    sentence: 'Your chosen tables are copied into the app database and kept in sync.',
    whatYoullSee: 'Each table copied, with row counts that match.',
    unlock: 'keeps the app\'s data in sync',
  }),
  m('app_view', {
    step: 34, tag: 'activation_app_design', chapter: 'show', icon: Palette, minutes: 10,
    title: 'Design the app',
    sentence: 'Screens planned around your questions and the copied data.',
    whatYoullSee: 'A one-page app design.',
    unlock: 'has an app design',
  }),
  m('app_view', {
    step: 35, tag: 'activation_build_wire', chapter: 'show', icon: Code2, minutes: 15,
    title: 'Build the app',
    sentence: 'The screens are built with sample data first, so you can see them before anything is connected.',
    whatYoullSee: 'The app running with sample data.',
    unlock: 'has app screens',
  }),
  m('app_view', {
    step: 36, tag: 'activation_wire_lakebase', chapter: 'show', icon: Link2, minutes: 10,
    title: 'Connect it to live data',
    sentence: 'The screens switch from sample data to the copied tables.',
    whatYoullSee: 'The app showing your real numbers.',
    unlock: 'shows live data in the app',
  }),
  GENIE_IN_APP('app_view'),
  m('app_view', {
    step: 37, tag: 'activation_deploy_validate', chapter: 'show', icon: Rocket, minutes: 12,
    title: 'Publish the app',
    sentence: 'The app goes live in Databricks with the right permissions, then every screen is checked.',
    whatYoullSee: 'A link to your live app.',
    unlock: 'is live as an app',
  }),
];

const COPILOT: AddOnMoment[] = [
  m('copilot', {
    step: 4, tag: 'cursor_copilot_ui_design', chapter: 'show', icon: Palette, minutes: 20,
    title: 'Build your app',
    sentence: 'Screens and a small backend built from your one-page brief, with sample data so you can see them straight away.',
    whatYoullSee: 'The app\'s screens, ready to put online.',
    unlock: 'has app screens',
  }),
  m('copilot', {
    step: 5, tag: 'deploy_databricks_app', chapter: 'show', icon: Rocket, minutes: 10,
    title: 'Put it online',
    sentence: 'A first version of the app goes live in Databricks, so the next steps have somewhere to connect.',
    whatYoullSee: 'A link to your app, running on sample data.',
    unlock: 'is online',
  }),
  m('copilot', {
    step: 6, tag: 'setup_lakebase', chapter: 'show', icon: Database, minutes: 10,
    title: 'Give it a database',
    sentence: 'A Lakebase database is created and connected to the app, with cost limits.',
    whatYoullSee: 'The app connected to its own database.',
    unlock: 'has its own database',
  }),
  m('copilot', {
    step: 7, tag: 'wire_ui_lakebase', chapter: 'show', icon: PencilLine, minutes: 15,
    title: 'Let people save their work',
    sentence: 'The screens read and write the database, so decisions and updates are kept.',
    whatYoullSee: 'Changes made in the app saved to the database.',
    unlock: 'saves what people do',
  }),
  GENIE_IN_APP('copilot'),
  m('copilot', {
    step: 8, tag: 'insights_app_deploy', chapter: 'show', icon: ShieldCheck, minutes: 12,
    title: 'Publish it for your team',
    sentence: 'The app is redeployed with access to your Genie, metrics and database, then checked end to end.',
    whatYoullSee: 'A link to your live app, with saving and Genie both working.',
    unlock: 'is live for your team',
  }),
];

const ADD_ON_MOMENTS: Record<AddOn, AddOnMoment[]> = { ontology: ONTOLOGY, alerts: ALERTS, app_view: APP_VIEW, copilot: COPILOT };

/** Section tags an add-on needs; it is only offered when every one has a prompt. */
export function tagsFor(addOn: AddOn): string[] {
  return ADD_ON_MOMENTS[addOn].map(x => x.tag);
}

/** Keeps a valid, ordered set: the two apps never go together. */
export function normalizeAddOns(list: Iterable<AddOn>): AddOn[] {
  const set = new Set(list);
  if (set.has('copilot')) set.delete('app_view');
  return ADD_ON_ORDER.filter(a => set.has(a));
}

/** The build's steps. With no add-ons this is exactly the core list. */
export function momentsFor(addOns: AddOn[]): Moment[] {
  const list = normalizeAddOns(addOns);
  if (list.length === 0) return MOMENTS;
  const answerTail = list.includes('ontology') ? ONTOLOGY : [];
  const showTail = list.filter(a => a !== 'ontology').flatMap(a => ADD_ON_MOMENTS[a]);
  const out: Moment[] = [];
  for (const x of MOMENTS) {
    out.push(x);
    if (x.step === 66) out.push(...answerTail);
  }
  out.push(...showTail);
  return out;
}

export function addOnOf(moment: Moment): AddOn | null {
  return (moment as Partial<AddOnMoment>).addOn ?? null;
}

const isLargerEffort = (effort?: string) => {
  const e = (effort ?? '').trim().toUpperCase();
  return e === 'M' || e === 'L' || /^(M\b|L\b|MEDIUM|LARGE|HIGH)/.test(e);
};

/** What the chosen approach needs by default, limited to what is turned on. */
export function defaultAddOns(idea: Idea | undefined, enabled: ReadonlySet<SwitchedAddOn>): AddOn[] {
  const shape = idea ? chosenShape(idea) : null;
  if (!shape) return [];
  const out: AddOn[] = [];
  if (isLargerEffort(shape.effort) && enabled.has('ontology')) out.push('ontology');
  if ((shape.kind === 'signal' || shape.kind === 'automation') && enabled.has('alerts')) out.push('alerts');
  if (shape.kind === 'copilot' && enabled.has('copilot')) out.push('copilot');
  return normalizeAddOns(out);
}

/** Add-ons the person can choose on the plan screen. */
export function offeredAddOns(idea: Idea | undefined, enabled: ReadonlySet<SwitchedAddOn>): AddOn[] {
  const kind = idea ? chosenShape(idea)?.kind : undefined;
  const out: AddOn[] = [];
  if (enabled.has('ontology')) out.push('ontology');
  if (enabled.has('alerts')) out.push('alerts');
  if (kind === 'copilot' && enabled.has('copilot')) out.push('copilot');
  else if (enabled.has('app_view')) out.push('app_view');
  return out;
}

export interface TagAvailability {
  /** True once both lookups finished; false while loading. */
  loaded: boolean;
  /** False when a lookup failed, so nothing can be confirmed. */
  known: boolean;
  has: (tag: string) => boolean;
}

let availabilityCache: Promise<{ tags: Set<string>; disabled: Set<string> } | null> | null = null;

function loadAvailability() {
  availabilityCache ??= Promise.all([apiClient.getSectionTags(), apiClient.getDisabledSteps('genie-code')])
    .then(([tags, disabled]) => ({ tags: new Set(tags.map(t => t.section_tag)), disabled: new Set(disabled) }))
    .catch(() => { availabilityCache = null; return null; });
  return availabilityCache;
}

/**
 * Which prompts exist and are switched on. A missing prompt makes the backend fall back to a
 * generic one, so add-ons are only offered when all of theirs are present.
 */
export function useTagAvailability(): TagAvailability {
  const [state, setState] = useState<{ loaded: boolean; data: { tags: Set<string>; disabled: Set<string> } | null }>({ loaded: false, data: null });
  useEffect(() => {
    let cancelled = false;
    loadAvailability().then(data => { if (!cancelled) setState({ loaded: true, data }); });
    return () => { cancelled = true; };
  }, []);
  const { loaded, data } = state;
  return {
    loaded,
    known: !!data,
    has: tag => !!data && data.tags.has(tag) && !data.disabled.has(tag),
  };
}

export function addOnAvailable(addOn: AddOn, availability: TagAvailability): boolean {
  return availability.known && tagsFor(addOn).every(availability.has);
}
