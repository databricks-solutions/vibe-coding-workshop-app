import { caseFigures } from './engine/ideaContext';
import { money } from './engine/businessCase';
import type { Assumption, ClarifyQuestion, Idea, IndustryBranch, IndustryLeaf, StepKey } from './engine/types';

/**
 * Worked examples shown on the Ideate home: one idea per featured industry,
 * taken from an approved library use case and walked through every step.
 * They are read-only; "Make it mine" saves a copy to My ideas.
 * Briefs and summaries quote figures as {{TOKENS}} filled from the business
 * case math, so the words always match the numbers on screen.
 */

const AT = '2026-09-01T15:00:00.000Z';
const ALL_STEPS: StepKey[] = ['spark', 'map', 'clarify', 'shape', 'questions', 'impact', 'brief'];
const ALL_COVERED = ['business', 'user', 'functional', 'technical', 'nfr', 'quality'].map(key => ({ key, covered: true, gap: '' }));

const leaf = (id: string, name: string, problem: string, valuePool: string, personas: string[], surfaces: string[]): IndustryLeaf =>
  ({ id, name, problem, valuePool, personas, surfaces });
const branch = (id: string, name: string, leaves: IndustryLeaf[]): IndustryBranch => ({ id, name, leaves });
const question = (id: string, dimension: string, text: string, why: string, options: string[], recommended: number, multi = false): ClarifyQuestion =>
  ({ id, dimension, question: text, why, options, recommended, multi });
const accepted = (prefix: string, step: StepKey, texts: string[]): Assumption[] =>
  texts.map((text, n) => ({ id: `${prefix}-${step}-${n}`, text, step, status: 'accepted' }));
const log = (texts: string[]) => texts.map(text => ({ at: AT, text }));

const RETAIL: Idea = {
  id: 'sample-retail',
  sample: true,
  mode: 'ideate',
  startPath: 'approved',
  seed: 'Store managers find empty shelves on fast movers only after customers complain. Flag the items that will run out in the next 48 hours, store by store, while there is still time to reorder.',
  title: 'Store Stockout Early Warning',
  industry: 'Retail',
  status: 'committed',
  createdAt: AT,
  updatedAt: AT,
  step: 'brief',
  approved: ALL_STEPS,
  sourceUseCase: { industry: 'retail', industryLabel: 'Retail', useCase: 'demand_inventory', label: 'Demand & Inventory Optimization', certified: false, category: 'Supply chain' },
  spark: {
    title: 'Store Stockout Early Warning',
    statement: 'Replenishment analysts and store managers see which fast movers will run out in the next 48 hours, store by store, and what to reorder before the shelf goes empty.',
    industry: 'Grocery Retail',
    catalogIndustry: 'retail',
    catalogIndustryLabel: 'Retail',
    industryAlternatives: [],
    valueHypothesis: 'More sales on fast movers because replenishment acts a day or two before the shelf goes empty, not after the complaint.',
    businessLine: 'revenue',
  },
  map: {
    branches: [
      branch('demand-inventory', 'Demand & Inventory', [
        leaf('stockout-warning', 'Store stockout early warning', 'Fast movers run out before anyone reorders', 'Lost sales on empty shelves, often 3% to 5% of affected item sales', ['Replenishment analyst', 'Store manager'], ['Genie', 'Dashboard']),
        leaf('demand-forecasting', 'Demand forecasting', 'Forecasts miss promotions and local events', 'Excess stock and markdowns, often millions a year', ['Demand planner'], ['Dashboard', 'Genie']),
        leaf('safety-stock', 'Safety stock tuning', 'Safety stock is set once a year and never revisited', 'Working capital tied up in slow stock', ['Inventory planner'], ['Dashboard']),
      ]),
      branch('store-ops', 'Store Operations', [
        leaf('shelf-audits', 'On-shelf availability audits', 'Gaps are found by walking the aisles', 'Store labour hours and missed sales', ['Store manager'], ['App', 'Genie']),
        leaf('labour-scheduling', 'Labour scheduling', 'Shelf-fill shifts do not match delivery times', 'Overtime and idle hours', ['Store operations lead'], ['App', 'Dashboard']),
      ]),
      branch('merchandising', 'Merchandising', [
        leaf('promo-planning', 'Promotion planning', 'Promoted items sell out in the first days', 'Promo lift lost to empty shelves', ['Category manager'], ['Genie', 'Dashboard']),
        leaf('markdowns', 'Markdown optimization', 'Markdowns come too late on slow stock', 'Margin given away on clearance', ['Pricing analyst'], ['Dashboard']),
      ]),
    ],
    placedLeafId: 'stockout-warning',
    adjacentLeafIds: ['demand-forecasting', 'promo-planning'],
    rationale: 'The idea acts on near-term stockout risk at each store: the hand-off between the forecast and the next order.',
  },
  questions: [
    question('who', 'user', 'Who acts on the warning first?', 'Names the persona', ['Central replenishment analysts', 'Store managers', 'Department leads on the floor', 'Category managers'], 0),
    question('metric', 'business', 'Which number would prove it worked?', 'Sets the success metric', ['Sales lost to empty shelves', 'Stockout rate on the top 500 items', 'Days of supply', 'Availability complaints'], 0),
    question('scale', 'scale', 'How big is the first pilot?', 'Sizes the business case', ['5 to 10 stores', '10 to 25 stores', 'One region of about 50 stores'], 1),
    question('cost', 'cost', 'What does an empty shelf on a fast mover cost a store each week?', 'Sizes the business case', ['$200 to $500', '$500 to $2k', '$2k to $5k'], 1),
    question('trigger', 'business', 'Why now?', 'Sets the urgency', ['Holiday season is coming', 'Availability scores dropped', 'A new replenishment system is rolling out', 'Leadership target on lost sales'], 0),
    question('scope', 'scope', 'What should the first version not do?', 'Keeps the pilot small', ['Place orders automatically', 'Change the forecast', 'Cover fresh and perishables', 'Rebalance stock between stores'], -1, true),
  ],
  answers: {
    who: 'Central replenishment analysts',
    metric: 'Sales lost to empty shelves',
    scale: '10 to 25 stores',
    cost: '$500 to $2k',
    trigger: 'Holiday season is coming',
    scope: 'Place orders automatically; Cover fresh and perishables',
  },
  followupChecked: true,
  shapes: [
    {
      id: 'insight-stockout-risk-board',
      kind: 'insight',
      title: 'Stockout Risk Board',
      value: 'Analysts start the day with at-risk items by store on a dashboard and ask Genie why an item is flagged, so orders go out before shelves empty.',
      valueLever: 'revenue_uplift',
      valueSize: '$$',
      timeToValue: 'weeks',
      hardShare: 'mostly hard',
      effort: 'S',
      riskiestAssumption: 'Store on-hand counts are accurate enough to trust a 48-hour risk score.',
      cheapTest: 'Compare last month\'s flagged items with real stockouts at five stores.',
      surfaces: ['Genie', 'Dashboard'],
      geniePlacement: 'genie_space',
      askExamples: ['Which items will run out at my stores in the next 48 hours?', 'Why is oat milk flagged at store 112?', 'How much did empty shelves cost the region last week?'],
      recommended: true,
      recommendedWhy: 'Most of the value for the least build, and analysts keep placing the orders.',
    },
    {
      id: 'copilot-replenishment-copilot',
      kind: 'copilot',
      title: 'Replenishment Copilot',
      value: 'An app ranks at-risk items with a suggested order for analysts to approve, with Genie inside it for the why.',
      valueLever: 'revenue_uplift',
      valueSize: '$$$',
      timeToValue: 'a quarter',
      hardShare: 'mostly hard',
      effort: 'M',
      riskiestAssumption: 'Suggested quantities are good enough that analysts approve most of them.',
      cheapTest: 'Have two analysts compare suggestions with their own orders for a week.',
      surfaces: ['App', 'Genie', 'Dashboard', 'Lakebase'],
      geniePlacement: 'in_app',
      askExamples: ['Which suggested orders are still waiting for me?', 'Why is the suggested order for store 87 so high?'],
    },
    {
      id: 'automation-auto-replenishment-agent',
      kind: 'automation',
      title: 'Emergency Reorder Agent',
      value: 'An agent raises emergency orders for at-risk items within limits and escalates the rest; analysts review in the app and ask Genie about any order.',
      valueLever: 'revenue_uplift',
      valueSize: '$$$',
      timeToValue: 'two quarters',
      hardShare: 'mostly hard',
      effort: 'L',
      riskiestAssumption: 'Distribution centres can fill emergency orders within 48 hours.',
      cheapTest: 'Replay four weeks of flagged items against DC fill rates.',
      surfaces: ['Agent', 'App', 'Genie', 'Dashboard', 'Lakebase'],
      geniePlacement: 'in_app',
      askExamples: ['Which emergency orders did the agent raise today?', 'Why did it skip store 87?'],
    },
  ],
  chosenShapeId: 'insight-stockout-risk-board',
  genieQuestions: [
    'Which items will run out at my stores in the next 48 hours?',
    'Why is this item flagged at this store?',
    'How much did empty shelves cost each region last week?',
    'Which stores have the most at-risk fast movers this week?',
  ],
  genieQuestionSources: {
    'Which items will run out at my stores in the next 48 hours?': 'ai',
    'Why is this item flagged at this store?': 'ai',
    'How much did empty shelves cost each region last week?': 'ai',
    'Which stores have the most at-risk fast movers this week?': 'ai',
  },
  impact: {
    driver: 'revenue_uplift',
    driverLabel: 'Sales recovered on fast movers that would have run out',
    scope: 'The top 500 fast movers in a 20-store pilot',
    questions: [
      {
        key: 'volume_per_year', question: 'How many fast-mover units do the pilot stores sell a year?', unit: 'units',
        options: [{ label: '2M to 4M units', value: 3_000_000 }, { label: '4M to 8M units', value: 6_000_000 }, { label: '8M to 12M units', value: 10_000_000 }],
        estimate: { label: 'About 6M units', value: 6_000_000 }, why: 'Twenty stores selling about 300k fast-mover units each.',
      },
      {
        key: 'uplift_pct', question: 'How much of those sales could fewer stockouts win back?', unit: '%',
        options: [{ label: 'About 1%', value: 1 }, { label: '1% to 2%', value: 1.5 }, { label: '2% to 3%', value: 2.5 }],
        estimate: { label: 'About 1.5%', value: 1.5 }, why: 'Stockouts cost 3% to 5% of affected sales; an early warning catches a third to half of them.',
      },
      {
        key: 'value_per_unit', question: 'What is the gross margin on a typical fast-mover unit?', unit: '$',
        options: [{ label: 'About $0.80', value: 0.8 }, { label: 'About $1.20', value: 1.2 }, { label: 'About $2', value: 2 }],
        estimate: { label: 'About $1.20', value: 1.2 }, why: 'Typical grocery margin on everyday fast movers.',
      },
      {
        key: 'rollout_units', question: 'How many stores would use this at full rollout?', unit: 'units',
        options: [{ label: '100 to 200 stores', value: 150 }, { label: '300 to 450 stores', value: 400 }, { label: 'All 600 stores', value: 600 }],
        estimate: { label: 'About 400 stores', value: 400 }, why: 'Every store on the same replenishment system.',
      },
    ],
    answers: {
      volume_per_year: { label: '4M to 8M units', value: 6_000_000, source: 'you said' },
      uplift_pct: { label: '1% to 2%', value: 1.5, source: 'you said' },
      value_per_unit: { label: 'About $1.20', value: 1.2, source: 'assumed' },
      rollout_units: { label: '300 to 450 stores', value: 400, source: 'you said' },
    },
    assumed: [],
    secondary: [{
      driver: 'cost_avoided',
      label: 'Fewer emergency transfers between stores',
      inputs: [
        { key: 'events_per_year', label: 'Emergency transfers a year', value: 400, unit: 'events', why: 'About 20 a year at each pilot store.' },
        { key: 'reduction_pct', label: 'Share avoided', value: 30, unit: '%', why: 'An earlier warning lets the regular order cover them.' },
        { key: 'cost_per_event', label: 'Cost of one transfer', value: 150, unit: '$', why: 'Driver time and handling.' },
      ],
    }],
    rollout: { unit: 'stores', pilot: 20, full: 400, why: 'Every store on the same replenishment system' },
    captureRate: null,
    cost: { dataGbPerDay: 2, refresh: 'hourly', transforms: 'medium', users: 40, hoursPerDay: 12 },
  },
  brief: `## Headline
Replenishment analysts see tomorrow's empty shelves today.

Every morning, analysts open one board that ranks the fast movers most likely to run out in the next 48 hours, store by store, and ask Genie why an item is flagged before they place the order. Shelves stay full through the holiday peak.

## Problem
Stockouts on fast movers are found by customers first. By the time a store reports an empty shelf, the next delivery is a day or more away and the sale is gone.

## Who It's For
Central replenishment analysts, with store managers checking their own stores.

## Chosen Shape
**Stockout Risk Board** (Insight). It gets most of the value with the smallest build and keeps analysts in charge of every order; the copilot and the agent can follow once the risk score is trusted.
**What we build:** a Genie space and an AI/BI dashboard on the same governed metrics.
**People can ask:** "Which items will run out at my stores in the next 48 hours?"; "Why is oat milk flagged at store 112?"; "How much did empty shelves cost the region last week?"

## Success Metric
Sales lost to empty shelves on the top 500 fast movers, from about 3% to under 1.5%. Directional estimate: {{VALUE}} a year at full rollout across 400 stores, {{HARD}} of it hard dollars.
**Pilot success:** lost sales on flagged items down 30% at the 20 pilot stores within 8 weeks.
**Stop if:** fewer than half of the flagged items would really have run out.

## Scope
**In**
- Top 500 fast movers at 20 pilot stores
- 48-hour risk score refreshed hourly
- Genie space and dashboard for analysts and store managers

**Out**
- Placing orders automatically
- Fresh and perishable items

## Top Risks
1. On-hand counts are wrong, so the score flags the wrong items. Test: compare last month's flags with real stockouts at five stores.
2. Analysts do not check the board daily. Test: track daily opens for two weeks.
3. Distribution centres cannot fill the extra orders. Test: check DC fill rates for flagged items.

## Test Scenarios
- **Happy path:** Given oat milk at store 112 will run out in 30 hours, when the analyst opens the board, then it is in the top ten with the reason and a suggested quantity.
- **Bad count:** Given store 87 reports negative on-hand stock, when the score runs, then the item is marked "check count" instead of flagged.
- **Late feed:** Given the sales feed is three hours late, when the board refreshes, then it shows when the data was last updated.

## Open Questions
- Which stores join the pilot first?
- Who owns the risk threshold after the pilot?`,
  gaps: ALL_COVERED,
  summary: {
    subtitle: 'A Stockout Risk Board worth about {{VALUE}} a year across 400 stores, for a pilot ask of {{ASK}}. Today fast movers run out before anyone reorders; analysts will see the risk 48 hours ahead and still place every order themselves.',
    problemToday: 'Empty shelves on fast movers are reported by customers first, a day or more before the next delivery can fix them.',
    whoItsFor: 'Central replenishment analysts, with store managers checking their own stores.',
    metric: { label: 'Sales lost to empty shelves on fast movers', today: 'about 3%', target: 'under 1.5%' },
    whatWeBuild: 'A Genie space and an AI/BI dashboard that rank the fast movers at risk in the next 48 hours, store by store, with the reason behind each flag.',
    workflowSteps: ['Open the risk board each morning', 'Sort at-risk items by store and lost sales', 'Ask Genie why an item is flagged', 'Place or bring forward the order'],
    stack: { data: 'Hourly point-of-sale, on-hand and delivery feeds land in Unity Catalog', shape: 'Declarative Pipelines build a 48-hour risk score per item and store', serve: 'Genie space and AI/BI Dashboards on the same governed metrics', use: 'Analysts check the board and ask Genie before ordering' },
    risks: [
      { risk: 'On-hand counts are wrong', guard: 'Items with impossible counts show as "check count", not as at risk' },
      { risk: 'Analysts ignore the board', guard: 'Daily top ten at-risk items, tracked in the pilot review' },
      { risk: 'Too many false alarms', guard: 'Stop if fewer than half of the flags would really have run out' },
    ],
    nextSteps: ['Run an 8-week pilot at 20 stores', 'Review flags against real stockouts every week', 'Decide on the copilot once the score is trusted'],
    decision: 'Approve an 8-week pilot at 20 stores for {{ASK}}.',
    valueStory: 'The 20 pilot stores recover about {{PILOT}} a year; the same board across 400 stores is worth about {{VALUE}}.',
    costOfInaction: 'Each month of waiting leaves about {{DELAY}} on the table.',
    pilotSuccess: 'Lost sales on flagged items down 30% at the 20 pilot stores within 8 weeks.',
    killCriterion: 'Fewer than half of the flagged items would really have run out.',
    sponsor: 'VP of Supply Chain',
    unlocksNext: ['Demand forecasting', 'Promotion planning'],
  },
  assumptions: [
    ...accepted('retail', 'spark', ['The top 500 items drive most of the lost sales.']),
    ...accepted('retail', 'map', ['Stores share one replenishment system and data feed.']),
    ...accepted('retail', 'shape', ['Hourly on-hand data is available for the pilot stores.']),
  ],
  decisions: log([
    'Started from the approved use case "Demand & Inventory Optimization"',
    'Confirmed intent: "Replenishment analysts and store managers see which fast movers will run out in the next 48 hours"',
    'Placed on industry map: Store stockout early warning',
    'Answered clarifying questions',
    'Chose approach: Stockout Risk Board',
    'Chose 4 questions for Genie',
    'Sized business impact',
    'Approved the brief',
    'Committed to this idea',
  ]),
};

const CPG: Idea = {
  id: 'sample-cpg',
  sample: true,
  mode: 'ideate',
  startPath: 'approved',
  seed: 'Half our trade promotions lose money and we only find out a quarter later. Help key account managers see which promotions actually pay back before they agree the next one with the retailer.',
  title: 'Trade Promotion ROI Advisor',
  industry: 'CPG',
  status: 'committed',
  createdAt: AT,
  updatedAt: AT,
  step: 'brief',
  approved: ALL_STEPS,
  sourceUseCase: { industry: 'cpg', industryLabel: 'CPG', useCase: 'revenue_growth_mgmt', label: 'Revenue Growth Management', certified: false, category: 'Revenue growth' },
  spark: {
    title: 'Trade Promotion ROI Advisor',
    statement: 'Key account managers see which past promotions paid back and get a recommended mechanic and depth before they commit the next one with a retailer.',
    industry: 'Consumer Packaged Goods',
    catalogIndustry: 'cpg',
    catalogIndustryLabel: 'CPG',
    industryAlternatives: [],
    valueHypothesis: 'Less trade spend lost on promotions that do not pay back, because the losers are dropped or redesigned before they run.',
    businessLine: 'cost',
  },
  map: {
    branches: [
      branch('rgm', 'Revenue Growth Management', [
        leaf('promo-roi', 'Trade promotion ROI', 'Promotions are agreed without knowing which ones pay back', 'Trade spend, often 15% to 20% of gross sales', ['Key account manager', 'RGM analyst'], ['App', 'Genie', 'Dashboard']),
        leaf('price-elasticity', 'Price elasticity', 'List price moves are set by gut feel', 'Margin on every price move', ['Pricing manager'], ['Genie', 'Dashboard']),
        leaf('pack-price', 'Pack-price architecture', 'Too many pack sizes compete with each other', 'Mix and margin across the range', ['Category manager'], ['Dashboard']),
      ]),
      branch('demand', 'Demand & Supply', [
        leaf('promo-forecast', 'Promotion demand forecasting', 'Promoted volume is under-forecast and stocks out', 'Lost promo volume and expedite costs', ['Demand planner'], ['Dashboard', 'Genie']),
        leaf('retail-execution', 'Retail execution', 'Displays agreed with the retailer do not happen in store', 'Promo lift lost at the shelf', ['Field sales lead'], ['App']),
      ]),
      branch('customer', 'Customer & Retailer', [
        leaf('joint-business-plan', 'Joint business planning', 'Annual plans are built in spreadsheets per retailer', 'Negotiation leverage with key retailers', ['Key account director'], ['App', 'Dashboard']),
        leaf('deductions', 'Deductions management', 'Retailer deductions are disputed months later', 'Unrecovered invalid deductions', ['Finance analyst'], ['Agent', 'Dashboard']),
      ]),
    ],
    placedLeafId: 'promo-roi',
    adjacentLeafIds: ['promo-forecast', 'joint-business-plan'],
    rationale: 'The idea decides which promotions to run and how deep, the core of trade promotion ROI.',
  },
  questions: [
    question('who', 'user', 'Who decides on the next promotion?', 'Names the persona', ['Key account managers', 'Revenue growth analysts', 'Category managers', 'Sales directors'], 0),
    question('metric', 'business', 'Which number would prove it worked?', 'Sets the success metric', ['Share of promotions that pay back', 'Incremental gross profit per trade dollar', 'Trade spend as a share of sales', 'Promoted volume'], 1),
    question('scale', 'scale', 'How big is the first pilot?', 'Sizes the business case', ['One category at one retailer', 'Two categories across three key retailers', 'A whole business unit'], 1),
    question('cost', 'cost', 'What does a promotion that does not pay back lose?', 'Sizes the business case', ['$2k to $5k', '$5k to $15k', '$15k to $40k'], 1),
    question('trigger', 'business', 'Why now?', 'Sets the urgency', ['Annual retailer negotiations start next quarter', 'Trade spend rose faster than sales', 'Finance asked for proof of trade ROI', 'A new RGM team was formed'], 0),
    question('scope', 'scope', 'What should the first version not do?', 'Keeps the pilot small', ['Change list prices', 'Plan promotions for every retailer', 'Settle retailer deductions', 'Forecast promoted volume'], -1, true),
  ],
  answers: {
    who: 'Key account managers',
    metric: 'Incremental gross profit per trade dollar',
    scale: 'Two categories across three key retailers',
    cost: '$5k to $15k',
    trigger: 'Annual retailer negotiations start next quarter',
    scope: 'Change list prices; Settle retailer deductions',
  },
  followupChecked: true,
  shapes: [
    {
      id: 'copilot-promo-planner-copilot',
      kind: 'copilot',
      title: 'Promo Planner Copilot',
      value: 'Key account managers draft a promotion in an app that scores its payback against past events, suggests a better depth, and lets them ask Genie why.',
      valueLever: 'cost_avoided',
      valueSize: '$$$',
      timeToValue: 'a quarter',
      hardShare: 'mostly hard',
      effort: 'M',
      riskiestAssumption: 'Past promotion results are clean enough to separate incremental volume from the baseline.',
      cheapTest: 'Score last year\'s 50 biggest promotions and check the losers with finance.',
      surfaces: ['App', 'Genie', 'Dashboard', 'Lakebase'],
      geniePlacement: 'in_app',
      askExamples: ['Which of my promotions last quarter lost money?', 'What depth paid back best for 12-packs at this retailer?', 'Why does this draft score below break-even?'],
      recommended: true,
      recommendedWhy: 'Catches losing promotions before they are agreed, while the account manager still owns the deal.',
    },
    {
      id: 'automation-promo-guardrail-agent',
      kind: 'automation',
      title: 'Promo Guardrail Agent',
      value: 'An agent checks every promotion submitted for approval, blocks the ones below break-even and routes exceptions to the RGM lead.',
      valueLever: 'cost_avoided',
      valueSize: '$$$',
      timeToValue: 'two quarters',
      hardShare: 'mostly hard',
      effort: 'L',
      riskiestAssumption: 'Account managers accept a hard block during retailer negotiations.',
      cheapTest: 'Run the agent in shadow mode on one month of approvals.',
      surfaces: ['Agent', 'App', 'Genie', 'Dashboard'],
      geniePlacement: 'in_app',
      askExamples: ['Which promotions did the agent block this week?', 'Why was the June feature at this retailer blocked?'],
    },
    {
      id: 'insight-trade-spend-roi-board',
      kind: 'insight',
      title: 'Trade Spend ROI Board',
      value: 'A dashboard of payback by retailer, category and mechanic, with a Genie space for follow-up questions.',
      valueLever: 'cost_avoided',
      valueSize: '$$',
      timeToValue: 'weeks',
      hardShare: 'mixed',
      effort: 'S',
      riskiestAssumption: 'Account managers look up past results before they negotiate.',
      cheapTest: 'Share a payback league table with two account teams for a month.',
      surfaces: ['Genie', 'Dashboard'],
      geniePlacement: 'genie_space',
      askExamples: ['Which mechanics paid back best last year?', 'How did trade ROI trend by retailer this quarter?'],
    },
  ],
  chosenShapeId: 'copilot-promo-planner-copilot',
  genieQuestions: [
    'Which past promotions in this category had the highest ROI at this retailer?',
    'Why does this draft promotion score below our $1.10 payback target?',
    'Which promotions lost money last quarter and what mechanics did they use?',
    'How did incremental gross profit per trade dollar trend by retailer this year?',
  ],
  genieQuestionSources: {
    'Which past promotions in this category had the highest ROI at this retailer?': 'ai',
    'Why does this draft promotion score below our $1.10 payback target?': 'ai',
    'Which promotions lost money last quarter and what mechanics did they use?': 'ai',
    'How did incremental gross profit per trade dollar trend by retailer this year?': 'ai',
  },
  impact: {
    driver: 'cost_avoided',
    driverLabel: 'Trade spend saved on promotions that would not pay back',
    scope: 'Two categories across three key retailers',
    questions: [
      {
        key: 'events_per_year', question: 'How many promotions do the pilot categories run a year?', unit: 'events',
        options: [{ label: '150 to 300', value: 225 }, { label: '300 to 500', value: 400 }, { label: '500 to 800', value: 650 }],
        estimate: { label: 'About 400', value: 400 }, why: 'Two categories, three retailers, a promotion most weeks.',
      },
      {
        key: 'reduction_pct', question: 'What share of the losing promotions could be dropped or fixed in time?', unit: '%',
        options: [{ label: 'About 10%', value: 10 }, { label: '10% to 20%', value: 15 }, { label: '20% to 30%', value: 25 }],
        estimate: { label: 'About 15%', value: 15 }, why: 'A first version catches the clearest losers.',
      },
      {
        key: 'rollout_units', question: 'How many categories would use this at full rollout?', unit: 'units',
        options: [{ label: '4 categories', value: 4 }, { label: '8 categories', value: 8 }, { label: '12 categories', value: 12 }],
        estimate: { label: 'About 8 categories', value: 8 }, why: 'Every category with a trade budget.',
      },
    ],
    answers: {
      events_per_year: { label: '300 to 500', value: 400, source: 'you said' },
      reduction_pct: { label: '10% to 20%', value: 15, source: 'you said' },
      rollout_units: { label: '8 categories', value: 8, source: 'you said' },
    },
    assumed: [{ key: 'cost_per_event', label: 'Loss on one promotion that does not pay back', value: 10_000, unit: '$', why: 'From your answer: "$5k to $15k".', fromAnswer: true }],
    secondary: [{
      driver: 'time_saved',
      label: 'Faster post-event analysis',
      inputs: [
        { key: 'baseline_minutes', label: 'Time to analyse one promotion today', value: 240, unit: 'minutes', why: 'Pulling shipments, scans and spend by hand.' },
        { key: 'target_minutes', label: 'Time after', value: 60, unit: 'minutes', why: 'Results are ready; analysts only review them.' },
        { key: 'events_per_day', label: 'Analyses per analyst per day', value: 0.3, unit: 'events', why: 'A few a week each.' },
        { key: 'headcount', label: 'Analysts doing this work', value: 6, unit: 'people', why: 'RGM analysts covering the pilot categories.' },
        { key: 'people_per_event', label: 'People per analysis', value: 1, unit: 'people', why: 'One analyst per promotion.' },
        { key: 'days_per_year', label: 'Working days', value: 230, unit: 'days', why: 'A typical working year.' },
        { key: 'hourly_rate', label: 'Loaded hourly rate', value: 75, unit: '$/hour', why: 'Typical analyst cost.' },
      ],
    }],
    rollout: { unit: 'categories', pilot: 2, full: 8, why: 'Every category with a trade budget' },
    captureRate: 0.5,
    captureWhy: 'Analysts spend about half of the freed time on next season\'s plans.',
    cost: { dataGbPerDay: 1, refresh: 'daily', transforms: 'medium', users: 25, hoursPerDay: 10 },
  },
  brief: `## Headline
Every promotion is checked for payback before it is agreed.

Key account managers draft next quarter's promotions in one app that scores each against past events at that retailer, suggests a better depth when one is losing money, and answers "why" through Genie inside the app.

## Problem
Trade spend has grown faster than sales, and the results of a promotion arrive a quarter after it ran. The same losing mechanics are agreed again in the next negotiation.

## Who It's For
Key account managers, with revenue growth analysts maintaining the payback model.

## Chosen Shape
**Promo Planner Copilot** (Copilot). It catches losing promotions before they are agreed while the account manager still owns the deal; an agent that blocks promotions would be hard to accept mid-negotiation.
**What we build:** a Databricks App with Genie inside it, an AI/BI dashboard, and Lakebase for draft promotions.
**People can ask:** "Which of my promotions last quarter lost money?"; "What depth paid back best for 12-packs at this retailer?"; "Why does this draft score below break-even?"

## Success Metric
Incremental gross profit per trade dollar, from about $0.80 to $1.10. Directional estimate: {{VALUE}} a year at full rollout across 8 categories, {{HARD}} of it hard dollars.
**Pilot success:** at least 15% of the losing promotions in the pilot categories dropped or redesigned within one planning cycle.
**Stop if:** finance cannot confirm the payback scores on last year's 50 biggest events.

## Scope
**In**
- Two categories across three key retailers
- Payback score and suggested depth for each draft promotion
- Genie inside the app and a payback dashboard

**Out**
- Changing list prices
- Settling retailer deductions

## Top Risks
1. The baseline is wrong, so incremental volume is over- or under-stated. Test: score last year's 50 biggest promotions and review the losers with finance.
2. Account managers skip the score under negotiation pressure. Test: track how many drafts are scored before submission.
3. Retailer scan data arrives too late. Test: check scan data lag for each pilot retailer.

## Test Scenarios
- **Happy path:** Given a 30%-off feature on 12-packs at a key retailer, when the account manager drafts it, then the app shows its expected payback and a better depth.
- **No history:** Given a mechanic never run at that retailer, when it is scored, then the app says the score uses similar retailers.
- **Missing scans:** Given scan data for last month is missing, when the score runs, then the app flags it as provisional.

## Open Questions
- Who signs off the payback model each season?
- Should private-label competition be part of the score?`,
  gaps: ALL_COVERED,
  summary: {
    subtitle: 'A Promo Planner Copilot worth about {{VALUE}} a year across 8 categories, for a pilot ask of {{ASK}}. Today losing promotions are found a quarter after they run; account managers will see the payback before they agree the deal.',
    problemToday: 'Promotion results arrive a quarter late, so losing mechanics are agreed again in the next negotiation.',
    whoItsFor: 'Key account managers, supported by revenue growth analysts.',
    metric: { label: 'Incremental gross profit per trade dollar', today: 'about $0.80', target: '$1.10' },
    whatWeBuild: 'A Databricks App that scores each draft promotion against past events, suggests a better depth, and has Genie inside it for the why, plus an AI/BI dashboard of payback by retailer.',
    workflowSteps: ['Draft next quarter\'s promotions in the app', 'See the payback score for each one', 'Ask Genie why a draft scores low', 'Adjust depth or mechanic before agreeing it'],
    stack: { data: 'Shipments, retailer scans and trade spend land in Unity Catalog', shape: 'Declarative Pipelines build baselines and payback per promotion', serve: 'Databricks App with Genie embedded, on Lakebase for drafts', use: 'Account managers score drafts and ask Genie before negotiating' },
    risks: [
      { risk: 'The baseline over-states incremental volume', guard: 'Finance reviews scores on last year\'s 50 biggest events first' },
      { risk: 'Account managers skip the score', guard: 'Drafts show their score status in the approval queue' },
      { risk: 'Late retailer scan data', guard: 'Scores are marked provisional when scans are missing' },
    ],
    nextSteps: ['Pilot with two categories across three retailers', 'Review scores with finance after the first cycle', 'Extend to all 8 categories before annual negotiations'],
    decision: 'Approve a one-cycle pilot in two categories for {{ASK}}.',
    valueStory: 'Two pilot categories save about {{PILOT}} a year; the same check across 8 categories is worth about {{VALUE}}.',
    costOfInaction: 'Each month of waiting costs about {{DELAY}} in trade spend that does not pay back.',
    pilotSuccess: 'At least 15% of losing promotions in the pilot categories dropped or redesigned within one planning cycle.',
    killCriterion: 'Finance cannot confirm the payback scores on last year\'s 50 biggest events.',
    sponsor: 'VP of Revenue Growth Management',
    unlocksNext: ['Promotion demand forecasting', 'Joint business planning'],
  },
  assumptions: [
    ...accepted('cpg', 'spark', ['Most trade spend goes through a few key retailers.']),
    ...accepted('cpg', 'shape', ['Two years of promotion history exist for the pilot categories.']),
    ...accepted('cpg', 'impact', ['A losing promotion loses about $10k, from your answer.']),
  ],
  decisions: log([
    'Started from the approved use case "Revenue Growth Management"',
    'Confirmed intent: "Key account managers see which past promotions paid back"',
    'Placed on industry map: Trade promotion ROI',
    'Answered clarifying questions',
    'Chose approach: Promo Planner Copilot',
    'Chose 4 questions for Genie',
    'Sized business impact',
    'Approved the brief',
    'Committed to this idea',
  ]),
};

const AIRLINES: Idea = {
  id: 'sample-airlines',
  sample: true,
  mode: 'ideate',
  startPath: 'approved',
  seed: 'Late turns at our hub cascade into delays because gates and ramp crews are reassigned by phone. I want to spot turns that will run late and have gate and crew swaps ready before the aircraft lands.',
  title: 'Turnaround and Gate Crew Advisor',
  industry: 'Travel & Hospitality',
  status: 'committed',
  createdAt: AT,
  updatedAt: AT,
  step: 'brief',
  approved: ALL_STEPS,
  sourceUseCase: { industry: 'travel', industryLabel: 'Travel & Hospitality', useCase: 'airline_airport_ops', label: 'Airport & Ground Operations', certified: false, category: 'Operations' },
  spark: {
    title: 'Turnaround and Gate Crew Advisor',
    statement: 'Hub ramp controllers see which turns will run late an hour ahead, with gate and ramp crew swaps already drafted, so fewer departures leave late.',
    industry: 'Airlines',
    catalogIndustry: 'travel',
    catalogIndustryLabel: 'Travel & Hospitality',
    industryAlternatives: ['Airports'],
    valueHypothesis: 'Fewer delay minutes at the hub because gates and ramp crews are moved before a late turn starts, not after.',
    businessLine: 'cost',
  },
  map: {
    branches: [
      branch('ground-ops', 'Airport & Ground Operations', [
        leaf('turn-recovery', 'Turnaround and gate crew recovery', 'Late turns are recovered by phone after they start', 'Delay costs, often millions a year per hub', ['Ramp controller', 'Hub duty manager'], ['Agent', 'App', 'Genie']),
        leaf('gate-planning', 'Gate and stand planning', 'Gate plans break as soon as arrivals slip', 'Towing, walking distance and missed connections', ['Gate planner'], ['App', 'Dashboard']),
        leaf('ground-handler-sla', 'Ground handler performance', 'Handler SLA misses are found in monthly reports', 'Penalties and service failures', ['Station manager'], ['Dashboard', 'Genie']),
      ]),
      branch('network-ops', 'Network Operations', [
        leaf('irops', 'Irregular operations recovery', 'Disruption plans are rebuilt by hand', 'Passenger compensation and rebooking cost', ['Ops controller'], ['Agent', 'App']),
        leaf('crew-recovery', 'Flight crew recovery', 'Crew legality checks slow down swaps', 'Reserve crew and overtime cost', ['Crew scheduler'], ['App', 'Genie']),
      ]),
      branch('customer', 'Passenger Experience', [
        leaf('missed-connections', 'Missed connection prediction', 'Tight connections are missed without warning', 'Rebooking cost and lost loyalty', ['Customer service lead'], ['Genie', 'Dashboard']),
        leaf('baggage', 'Short-connect baggage', 'Bags miss tight connections', 'Mishandled bag cost per passenger', ['Baggage supervisor'], ['Dashboard']),
      ]),
    ],
    placedLeafId: 'turn-recovery',
    adjacentLeafIds: ['gate-planning', 'missed-connections'],
    rationale: 'The idea acts on a turn at risk before it starts, by moving gates and ramp crews: turnaround recovery at the hub.',
  },
  questions: [
    question('who', 'user', 'Who acts on a late turn first?', 'Names the persona', ['Hub ramp controllers', 'Gate planners', 'Hub duty managers', 'Ground handler leads'], 0),
    question('metric', 'business', 'Which number would prove it worked?', 'Sets the success metric', ['Departures late because of the turn', 'Average turn time', 'Delay minutes per departure', 'Gate conflicts per day'], 0),
    question('scale', 'scale', 'How big is the first pilot?', 'Sizes the business case', ['One concourse at the main hub', 'The whole main hub', 'Two hubs'], 1),
    question('cost', 'cost', 'What does one late departure from a slow turn cost?', 'Sizes the business case', ['$1k to $3k', '$3k to $8k', '$8k to $20k'], 1),
    question('trigger', 'business', 'Why now?', 'Sets the urgency', ['Summer peak is coming', 'On-time performance fell below target', 'A new gate system is going live', 'Handler contracts are up for renewal'], 1),
    question('scope', 'scope', 'What should the first version not do?', 'Keeps the pilot small', ['Change flight crew assignments', 'Rebook passengers', 'Cover outstations', 'Change the published schedule'], -1, true),
  ],
  answers: {
    who: 'Hub ramp controllers',
    metric: 'Departures late because of the turn',
    scale: 'The whole main hub',
    cost: '$3k to $8k',
    trigger: 'On-time performance fell below target',
    scope: 'Change flight crew assignments; Rebook passengers; Cover outstations',
  },
  followupChecked: true,
  shapes: [
    {
      id: 'copilot-turn-recovery-copilot',
      kind: 'copilot',
      title: 'Turn Recovery Copilot',
      value: 'Controllers see turns at risk an hour ahead in an app with suggested gate and crew swaps to accept, and ask Genie inside it why a turn is at risk.',
      valueLever: 'cost_avoided',
      valueSize: '$$',
      timeToValue: 'a quarter',
      hardShare: 'mostly hard',
      effort: 'M',
      riskiestAssumption: 'Controllers have time to review every suggestion during the arrival bank.',
      cheapTest: 'Shadow two controllers through one arrival bank with printed suggestions.',
      surfaces: ['App', 'Genie', 'Dashboard'],
      geniePlacement: 'in_app',
      askExamples: ['Which turns are at risk in the next hour?', 'Why is the 14:20 to Denver at risk?'],
    },
    {
      id: 'automation-turn-recovery-agent',
      kind: 'automation',
      title: 'Turn Recovery Agent',
      value: 'An agent re-plans gates and ramp crews for turns at risk within agreed limits and sends only conflicts to the duty manager; everyone can ask Genie in the app what changed and why.',
      valueLever: 'cost_avoided',
      valueSize: '$$$',
      timeToValue: 'two quarters',
      hardShare: 'mostly hard',
      effort: 'L',
      riskiestAssumption: 'Gate and crew swaps inside the limits never break union or safety rules.',
      cheapTest: 'Replay last month\'s arrival banks and have the duty manager grade every swap.',
      surfaces: ['Agent', 'App', 'Genie', 'Dashboard', 'Lakebase'],
      geniePlacement: 'in_app',
      askExamples: ['Which gate swaps did the agent make this morning?', 'Why was crew B moved to gate C14?', 'How many late departures did we avoid this week?'],
      recommended: true,
      recommendedWhy: 'An arrival bank moves too fast for people to approve every swap; limits and escalation keep it safe.',
    },
    {
      id: 'insight-turn-risk-board',
      kind: 'insight',
      title: 'Turn Risk Board',
      value: 'A live board of turns at risk with a Genie space for "why" questions; controllers still plan the swaps themselves.',
      valueLever: 'cost_avoided',
      valueSize: '$',
      timeToValue: 'weeks',
      hardShare: 'mixed',
      effort: 'S',
      riskiestAssumption: 'Seeing the risk is enough for controllers to act in time.',
      cheapTest: 'Put the risk list on the ops room screen for two weeks.',
      surfaces: ['Genie', 'Dashboard'],
      geniePlacement: 'genie_space',
      askExamples: ['Which turns ran late most often this month?', 'What is the average turn time by aircraft type?'],
    },
  ],
  chosenShapeId: 'automation-turn-recovery-agent',
  genieQuestions: [
    'Which gate and crew swaps did the agent make for this arrival bank?',
    'Why was this incoming turn flagged at risk of a late departure?',
    'How many turn-caused late departures did we avoid at the hub this week?',
    'Which gates or ground handlers had the most turn delays this month?',
  ],
  genieQuestionSources: {
    'Which gate and crew swaps did the agent make for this arrival bank?': 'ai',
    'Why was this incoming turn flagged at risk of a late departure?': 'ai',
    'How many turn-caused late departures did we avoid at the hub this week?': 'ai',
    'Which gates or ground handlers had the most turn delays this month?': 'ai',
  },
  impact: {
    driver: 'cost_avoided',
    driverLabel: 'Fewer late departures from slow turns',
    scope: 'Ramp control at the main hub',
    questions: [
      {
        key: 'events_per_year', question: 'How many departures leave late because of the turn at the hub each year?', unit: 'events',
        options: [{ label: '1,000 to 1,500', value: 1250 }, { label: '1,500 to 2,500', value: 2000 }, { label: '2,500 to 4,000', value: 3250 }],
        estimate: { label: 'About 1,800', value: 1800 }, why: 'About five a day at a large hub.',
      },
      {
        key: 'reduction_pct', question: 'What share of those could earlier swaps prevent?', unit: '%',
        options: [{ label: 'About 8%', value: 8 }, { label: '10% to 15%', value: 12 }, { label: '15% to 25%', value: 20 }],
        estimate: { label: 'About 12%', value: 12 }, why: 'Turns that are late because of the gate or crew, not the aircraft.',
      },
      {
        key: 'rollout_units', question: 'How many hubs would use this at full rollout?', unit: 'units',
        options: [{ label: '3 hubs', value: 3 }, { label: '6 hubs', value: 6 }, { label: '10 hubs', value: 10 }],
        estimate: { label: 'About 6 hubs', value: 6 }, why: 'Every hub with its own ramp control room.',
      },
    ],
    answers: {
      events_per_year: { label: '1,500 to 2,500', value: 2000, source: 'you said' },
      reduction_pct: { label: '10% to 15%', value: 12, source: 'you said' },
      rollout_units: { label: '6 hubs', value: 6, source: 'you said' },
    },
    assumed: [{ key: 'cost_per_event', label: 'Cost of one late departure', value: 5000, unit: '$', why: 'From your answer: "$3k to $8k".', fromAnswer: true }],
    secondary: [{
      driver: 'time_saved',
      label: 'Less time re-planning gates and crews by phone',
      inputs: [
        { key: 'baseline_minutes', label: 'Time to re-plan one turn today', value: 25, unit: 'minutes', why: 'Phone calls to the gate, ramp lead and handler.' },
        { key: 'target_minutes', label: 'Time after', value: 8, unit: 'minutes', why: 'Only conflicts need a person.' },
        { key: 'events_per_day', label: 'Re-plans per controller per day', value: 6, unit: 'events', why: 'Two to three per arrival bank.' },
        { key: 'headcount', label: 'Controllers doing this work', value: 6, unit: 'people', why: 'Ramp controllers across shifts at the hub.' },
        { key: 'people_per_event', label: 'People per re-plan', value: 1, unit: 'people', why: 'One controller per turn.' },
        { key: 'days_per_year', label: 'Days per year', value: 365, unit: 'days', why: 'The hub runs every day.' },
        { key: 'hourly_rate', label: 'Loaded hourly rate', value: 55, unit: '$/hour', why: 'Typical ramp controller cost.' },
      ],
    }],
    rollout: { unit: 'hubs', pilot: 1, full: 6, why: 'Every hub with its own ramp control room' },
    captureRate: 0.4,
    captureWhy: 'Controllers spend part of the freed time on the next arrival bank.',
    cost: { dataGbPerDay: 5, refresh: 'frequent', transforms: 'medium', users: 30, hoursPerDay: 20 },
  },
  brief: `## Headline
Late turns at the hub are recovered before they start.

An hour before each arrival bank, an agent spots the turns that will run late and moves gates and ramp crews within agreed limits. Controllers see every change in one app, and anyone can ask Genie inside it what changed and why.

## Problem
Gates and ramp crews are reassigned by phone once a turn is already late. One slow turn takes a gate or crew from the next flight, and the delay spreads through the bank.

## Who It's For
Hub ramp controllers, with the hub duty manager handling the swaps the agent escalates.

## Chosen Shape
**Turn Recovery Agent** (Automation). An arrival bank moves too fast for people to approve every swap; limits and escalation keep it safe, which the copilot and board cannot match on speed.
**What we build:** an agent, a Databricks App with Genie inside it, an AI/BI dashboard, and Lakebase for the swap log.
**People can ask:** "Which gate swaps did the agent make this morning?"; "Why was crew B moved to gate C14?"; "How many late departures did we avoid this week?"

## Success Metric
Departures late because of the turn, from about 2,000 a year at the hub to under 1,760. Directional estimate: {{VALUE}} a year at full rollout across 6 hubs, {{HARD}} of it hard dollars.
**Pilot success:** turn-caused late departures at the main hub down 12% within 10 weeks, with no swap breaking a rule.
**Stop if:** the duty manager overrides more than one in five swaps.

## Scope
**In**
- The main hub, every arrival bank
- Gate and ramp crew swaps within agreed limits
- App with Genie inside it, and a turn performance dashboard

**Out**
- Flight crew assignments
- Passenger rebooking
- Outstations

## Top Risks
1. A swap breaks a union or safety rule. Test: replay last month's banks and have the duty manager grade every swap.
2. Live gate and handler feeds lag by more than a few minutes. Test: measure feed latency for two weeks.
3. Controllers do not trust automatic swaps. Test: run in suggest-only mode for the first two weeks.

## Test Scenarios
- **Happy path:** Given the 14:20 to Denver will block gate B7 for the next arrival, when the risk is found 50 minutes ahead, then the agent moves the arrival to B9 and the ramp crew with it, and logs why.
- **Outside the limits:** Given a swap would need a crew past its shift, when the agent plans it, then it escalates to the duty manager instead.
- **Stale feed:** Given the gate feed is ten minutes old, when the agent runs, then it pauses swaps and says so in the app.

## Open Questions
- Which limits does the union need to sign off?
- Should the agent also warn connecting passengers' gates?`,
  gaps: ALL_COVERED,
  summary: {
    subtitle: 'A Turn Recovery Agent worth about {{VALUE}} a year across 6 hubs, for a pilot ask of {{ASK}}. Today late turns are recovered by phone after they start; the agent moves gates and ramp crews before they do, within agreed limits.',
    problemToday: 'Gates and ramp crews are reassigned by phone once a turn is already late, so one slow turn delays the next.',
    whoItsFor: 'Hub ramp controllers, with the duty manager handling escalations.',
    metric: { label: 'Departures late because of the turn', today: 'about 2,000 a year', target: 'under 1,760' },
    whatWeBuild: 'An agent that re-plans gates and ramp crews within limits, a Databricks App where controllers see every change and ask Genie why, and an AI/BI dashboard of turn performance.',
    workflowSteps: ['The agent scores turns an hour before each bank', 'It moves gates and crews within the limits', 'Conflicts go to the duty manager in the app', 'Controllers ask Genie what changed and why'],
    stack: { data: 'Gate, flight and ground handler feeds stream into Unity Catalog', shape: 'Declarative Pipelines build a turn risk score every 15 minutes', serve: 'Agent on Model Serving, Databricks App with Genie embedded, Lakebase swap log', use: 'Controllers review swaps and ask Genie in the app' },
    risks: [
      { risk: 'A swap breaks a union or safety rule', guard: 'Hard limits in the agent, and every exception goes to the duty manager' },
      { risk: 'Live feeds lag', guard: 'The agent pauses swaps when feeds are stale' },
      { risk: 'Controllers distrust automatic swaps', guard: 'Two weeks in suggest-only mode before swaps go live' },
    ],
    nextSteps: ['Run a 10-week pilot at the main hub', 'Start in suggest-only mode for two weeks', 'Extend to the next two hubs if the pilot hits its target'],
    decision: 'Approve a 10-week pilot at the main hub for {{ASK}}.',
    valueStory: 'The main hub saves about {{PILOT}} a year; the same agent across 6 hubs is worth about {{VALUE}}.',
    costOfInaction: 'Each month of waiting costs about {{DELAY}} in late departures.',
    pilotSuccess: 'Turn-caused late departures at the main hub down 12% within 10 weeks, with no swap breaking a rule.',
    killCriterion: 'The duty manager overrides more than one in five swaps.',
    sponsor: 'SVP of Airport Operations',
    unlocksNext: ['Gate and stand planning', 'Missed connection prediction'],
  },
  assumptions: [
    ...accepted('airlines', 'spark', ['Most turn delays come from gate or crew conflicts, not the aircraft.']),
    ...accepted('airlines', 'shape', ['Gate and handler systems expose live feeds.']),
    ...accepted('airlines', 'impact', ['A late departure costs about $5k, from your answer.']),
  ],
  decisions: log([
    'Started from the approved use case "Airport & Ground Operations"',
    'Confirmed intent: "Hub ramp controllers see which turns will run late an hour ahead"',
    'Placed on industry map: Turnaround and gate crew recovery',
    'Answered clarifying questions',
    'Chose approach: Turn Recovery Agent',
    'Chose 4 questions for Genie',
    'Sized business impact',
    'Approved the brief',
    'Committed to this idea',
  ]),
};

function withFigures(idea: Idea): Idea {
  const f = caseFigures(idea);
  if (!f) return idea;
  const tokens: Record<string, string> = {
    VALUE: money(f.value.expected),
    HARD: money(f.hard),
    ASK: money(f.ask.total),
    PILOT: money(f.pilot.value),
    DELAY: money(f.costOfDelay),
  };
  const fill = (text: string) => text.replace(/\{\{(\w+)\}\}/g, (m, k: string) => tokens[k] ?? m);
  const summary = idea.summary && Object.fromEntries(
    Object.entries(idea.summary).map(([k, v]) => [k, typeof v === 'string' ? fill(v) : v]),
  ) as Idea['summary'];
  return { ...idea, brief: idea.brief && fill(idea.brief), summary };
}

export const SAMPLES: Idea[] = [RETAIL, CPG, AIRLINES].map(withFigures);

export const isSampleId = (id: string) => id.startsWith('sample-');

export const sampleById = (id: string): Idea | undefined => (isSampleId(id) ? SAMPLES.find(s => s.id === id) : undefined);
