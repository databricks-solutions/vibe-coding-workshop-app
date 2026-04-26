/**
 * ArchitectureDiagram Component
 * 
 * A self-contained, collapsible section that displays the Databricks end-to-end architecture.
 * Layout: Left side has App + Lakebase stacked vertically, right side has large Lakehouse and AI and Agents.
 * 
 * Features:
 * - Per-column fade in/out when workshop level changes (transparent-to-solid transitions)
 * - Column-aligned learning objectives with staggered bullet reveal
 * - Service popovers (click for details + chat) via shared ServicePopover component
 */

import { useState, useEffect, useRef } from 'react';
import { 
  ChevronDown,
  Users, 
  ArrowDown, 
  ArrowLeftRight, 
  Database, 
  ChevronRight,
  Layers,
  Sparkles,
  Zap,
  Bot,
  LayoutDashboard,
  Info,
  Globe,
  HardDrive,
  Brain,
  BookOpen,
  FileCode,
  Cpu,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import {
  ARCH_VISIBILITY,
  CHAPTER_VISIBILITY,
  getCumulativeOverrides,
  levelSupportsAIModuleToggles,
  getApplicableAIModules,
  levelSupportsMedallionToggles,
  getApplicableMedallionLayers,
  type WorkshopLevel,
  type AIAgentModule,
  type MedallionLayer,
} from '../constants/workflowSections';
import { ServicePopover } from './ServicePopover';

// Learning objectives tagged by chapter - dynamically filtered by workshop level
interface LearningObjective {
  id: string;
  chapters: ('ch1' | 'ch2' | 'ch3' | 'ch4')[];
  content: React.ReactNode;
}

const LEARNING_OBJECTIVES: LearningObjective[] = [
  { id: '1', chapters: ['ch1'], content: <>Design and deploy a <strong className="text-foreground">web application</strong> on Databricks Apps</> },
  { id: '2', chapters: ['ch2'], content: <>Back the application with a <strong className="text-foreground">Lakebase PostgreSQL database</strong></> },
  { id: '3', chapters: ['ch2'], content: <>Wire the UI to <strong className="text-foreground">pull data from Lakebase</strong></> },
  { id: '4', chapters: ['ch3'], content: <>Sync operational data into the <strong className="text-foreground">Lakehouse</strong></> },
  { id: '5', chapters: ['ch3'], content: <>Build <strong className="text-foreground">Bronze, Silver, and Gold</strong> data layers</> },
  { id: '6', chapters: ['ch3'], content: <>Use <strong className="text-foreground">Spark Declarative Pipelines (SDP)</strong> for data quality</> },
  { id: '7', chapters: ['ch4'], content: <>Define <strong className="text-foreground">Metric Views</strong> to standardize key business metrics</> },
  { id: '8', chapters: ['ch4'], content: <>Use <strong className="text-foreground">Table Value Functions (TVFs)</strong> to encapsulate reusable query logic</> },
  { id: '9', chapters: ['ch4'], content: <>Power a <strong className="text-foreground">Genie Space</strong> with curated tables and governed metrics</> },
  { id: '10', chapters: ['ch4'], content: <>Build an <strong className="text-foreground">AI agent</strong> and connect it back to the deployed web application</> },
  { id: '11', chapters: ['ch4'], content: <>Create <strong className="text-foreground">AI/BI dashboards</strong> for data visualization and insights</> },
];

interface ReverseObjective {
  id: string;
  content: React.ReactNode;
}

const REVERSE_LAKEHOUSE_OBJECTIVES: ReverseObjective[] = [
  { id: 'r1', content: <>Build <strong className="text-foreground">Bronze, Silver, and Gold</strong> data layers</> },
  { id: 'r2', content: <>Use <strong className="text-foreground">Spark Declarative Pipelines</strong> for data quality</> },
  { id: 'r3', content: <>Create curated <strong className="text-foreground">Gold tables</strong> ready for analytics</> },
];

const REVERSE_DI_OBJECTIVES: ReverseObjective[] = [
  { id: 'r4', content: <>Define <strong className="text-foreground">Metric Views</strong> to standardize business metrics</> },
  { id: 'r5', content: <>Use <strong className="text-foreground">Table Value Functions (TVFs)</strong> for reusable query logic</> },
  { id: 'r6', content: <>Power a <strong className="text-foreground">Genie Space</strong> with governed metrics</> },
];

const REVERSE_ACTIVATION_OBJECTIVES: ReverseObjective[] = [
  { id: 'r7', content: <>Use <strong className="text-foreground">Synced Tables</strong> to push Gold data into Lakebase</> },
  { id: 'r8', content: <>Design an <strong className="text-foreground">analytics-serving app</strong> powered by synced data</> },
  { id: 'r9', content: <>Embed a <strong className="text-foreground">Genie Space</strong> in the app for conversational analytics</> },
  { id: 'r10', content: <>Wire the app to <strong className="text-foreground">Lakebase + Genie</strong> for dual-channel engagement</> },
  { id: 'r11', content: <>Deploy and validate the <strong className="text-foreground">reverse ETL pipeline</strong></> },
];

// Agents Accelerator — replaces the right (ch4) and middle (ch3) column bullets
// with agent-specific copy. Phase 1 ships with the Agents-on-Apps bullets active;
// the MLflow lifecycle bullet stays in the list with a "Phase 2" tag (still
// faded in the diagram chips themselves).
const AGENTS_RIGHT_OBJECTIVES: LearningObjective[] = [
  { id: 'a1', chapters: ['ch4'], content: <>Build a <strong className="text-foreground">Mosaic AI Agent Framework</strong> agent (ResponsesAgent + ChatAgent UI)</> },
  { id: 'a2', chapters: ['ch4'], content: <>Wire <strong className="text-foreground">Tools & MCP</strong> — Managed (UC Functions, Vector Search, Genie, SQL), External, Custom</> },
  { id: 'a3', chapters: ['ch4'], content: <>Persist conversation state with <strong className="text-foreground">Lakebase Memory</strong> (LangGraph checkpointer + long-term insights)</> },
  { id: 'a4', chapters: ['ch4'], content: <>Forward user identity via <strong className="text-foreground">on-behalf-of-user auth</strong> (X-Forwarded-Access-Token)</> },
  { id: 'a5', chapters: ['ch4'], content: <>Manage the lifecycle with <strong className="text-foreground">MLflow for Gen-AI</strong>: prompts, evaluation, monitoring</> },
];

// Replaces the middle (ch3) column bullets — just the Bronze layer for agents.
const AGENTS_MIDDLE_OBJECTIVES: LearningObjective[] = [
  { id: 'am1', chapters: ['ch3'], content: <>Sync operational data into the <strong className="text-foreground">Lakehouse</strong></> },
  { id: 'am2', chapters: ['ch3'], content: <>Build the <strong className="text-foreground">Bronze layer</strong> — UC-registered tables that the agent calls as tools</> },
];

// Animation timing constants
const FADE_MS = 300;
const BULLET_STAGGER_MS = 100;

// ---------------------------------------------------------------------------
// useFadeTransition -- per-element transparent-to-solid fade in/out
// On initial mount: renders immediately at target state (no animation).
// On show:  mount -> next frame transition opacity 0→1
// On hide:  transition opacity 1→0 -> unmount after FADE_MS
// ---------------------------------------------------------------------------
function useFadeTransition(visible: boolean) {
  const isInitial = useRef(true);
  const [shouldRender, setShouldRender] = useState(visible);
  const [isVisible, setIsVisible] = useState(visible);

  useEffect(() => {
    // Skip animation on the very first render so elements appear instantly
    if (isInitial.current) {
      isInitial.current = false;
      return;
    }

    if (visible) {
      // Mount first, then trigger CSS transition on next frame
      setShouldRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      // Trigger exit transition, then unmount after it completes
      setIsVisible(false);
      const timer = setTimeout(() => setShouldRender(false), FADE_MS);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  return { shouldRender, isVisible };
}

// ---------------------------------------------------------------------------
// AgentsAcceleratorPanel — custom ch4 contents for the Agents Accelerator.
// Replaces the standard "AI and Agents" stack (Genie / Dashboard / Agent grid)
// with: Agent tile + two sub-containers ("Agents on Apps" and "MLflow for
// Gen-AI"), each with 3 horizontal chips. Phase 1 ships with the MLflow chips
// rendered faded; Phase 2 un-fades them.
// ---------------------------------------------------------------------------
interface AgentsAcceleratorPanelProps {
  /** When true, the MLflow for Gen-AI sub-container chips render faded with a
   *  "Coming in Phase 2" tooltip. Set to false once Phase 2 lights them up. */
  mlflowFaded: boolean;
}

function AgentsAcceleratorPanel({ mlflowFaded }: AgentsAcceleratorPanelProps) {
  const mlflowFadedClass = mlflowFaded ? 'opacity-50 pointer-events-none' : '';
  const mlflowFadedTitle = mlflowFaded ? 'Coming in Phase 2' : undefined;

  return (
    <div className="flex flex-col gap-3">
      {/* Agents on Apps sub-container — 3 chips matching folder labels 02/03/05 */}
      <div className="bg-slate-800 border-2 border-blue-500/60 rounded-lg p-3 shadow-lg">
        <p className="text-ui-xs font-bold text-blue-300 mb-2 text-center">Agents on Apps</p>
        <div className="grid grid-cols-3 gap-1.5">
          <ServicePopover serviceKey="agentFramework" position="left" block>
            <div className="bg-blue-900/30 rounded px-1.5 py-1.5 border border-blue-500/30 hover:bg-blue-900/50 hover:border-blue-400 transition-all duration-200 hover:scale-105">
              <p className="text-ui-3xs font-semibold text-blue-200 text-center leading-tight">Agent Framework</p>
            </div>
          </ServicePopover>
          <ServicePopover serviceKey="toolsMcp" position="top" block>
            <div className="bg-blue-900/30 rounded px-1.5 py-1.5 border border-blue-500/30 hover:bg-blue-900/50 hover:border-blue-400 transition-all duration-200 hover:scale-105">
              <p className="text-ui-3xs font-semibold text-blue-200 text-center leading-tight">Tools &amp; MCP</p>
            </div>
          </ServicePopover>
          <ServicePopover serviceKey="lakebaseMemory" position="right" block>
            <div className="bg-blue-900/30 rounded px-1.5 py-1.5 border border-blue-500/30 hover:bg-blue-900/50 hover:border-blue-400 transition-all duration-200 hover:scale-105">
              <p className="text-ui-3xs font-semibold text-blue-200 text-center leading-tight">Lakebase Memory</p>
            </div>
          </ServicePopover>
        </div>
      </div>

      {/* MLflow for Gen-AI sub-container — 3 chips matching folder labels 01/02-04/07 */}
      <div className={`bg-slate-800 border-2 border-violet-500/60 rounded-lg p-3 shadow-lg ${mlflowFadedClass}`} title={mlflowFadedTitle}>
        <p className="text-ui-xs font-bold text-violet-300 mb-2 text-center">
          MLflow for Gen-AI{mlflowFaded && <span className="ml-1 text-ui-3xs font-normal text-violet-400/70">(Phase 2)</span>}
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          <ServicePopover serviceKey="mlflowPromptRegistry" position="left" block>
            <div className="bg-violet-900/30 rounded px-1.5 py-1.5 border border-violet-500/30 hover:bg-violet-900/50 hover:border-violet-400 transition-all duration-200 hover:scale-105">
              <p className="text-ui-3xs font-semibold text-violet-200 text-center leading-tight">Prompt Registry</p>
            </div>
          </ServicePopover>
          <ServicePopover serviceKey="mlflowEval" position="top" block>
            <div className="bg-violet-900/30 rounded px-1.5 py-1.5 border border-violet-500/30 hover:bg-violet-900/50 hover:border-violet-400 transition-all duration-200 hover:scale-105">
              <p className="text-ui-3xs font-semibold text-violet-200 text-center leading-tight">Evaluation</p>
            </div>
          </ServicePopover>
          <ServicePopover serviceKey="mlflowMonitoring" position="right" block>
            <div className="bg-violet-900/30 rounded px-1.5 py-1.5 border border-violet-500/30 hover:bg-violet-900/50 hover:border-violet-400 transition-all duration-200 hover:scale-105">
              <p className="text-ui-3xs font-semibold text-violet-200 text-center leading-tight">Monitoring</p>
            </div>
          </ServicePopover>
        </div>
      </div>
    </div>
  );
}

interface ArchitectureDiagramProps {
  /** When true, forces the section collapsed regardless of user toggle. */
  forceCollapsed?: boolean;
  /** Workshop level for filtering visible architecture sections */
  workshopLevel?: WorkshopLevel;
  /** Callback to navigate to the prerequisites / start building */
  onStartBuild?: () => void;
}

const SKILLS_CONCEPT_CARDS = [
  {
    iconName: 'BookOpen' as const,
    accent: 'violet',
    title: 'What Are Agent Skills?',
    summary: 'Open standard for packaging reusable AI capabilities as portable SKILL.md files.',
    details: [
      'Agent Skills follow the open agentskills.io specification for packaging domain expertise',
      'Each skill is a self-contained folder: SKILL.md (instructions), assets/ (templates), references/ (docs)',
      'Skills are portable across AI coding assistants — Cursor, Claude Code, Copilot, and more',
      'They encode best practices, patterns, and guardrails that the AI follows consistently',
      'The SKILL.md is the contract between the skill author and the AI — defining triggers, steps, and validation',
      'Skills compose together: a data contract skill can reference naming-tagging-standards for consistent governance',
    ],
    diagram: {
      type: 'ecosystem' as const,
      nodes: [
        { label: 'SKILL.md', sub: 'Instructions & triggers' },
        { label: 'references/', sub: 'Patterns & docs' },
        { label: 'assets/', sub: 'Templates & schemas' },
        { label: 'AI Agent', sub: 'Reads & executes' },
      ],
    },
    codeExample: `# SKILL.md (front-matter)
name: data-contract-governance
description: Applies contract tags to gold tables
metadata:
  domain: governance
  role: shared
triggers:
  - "data contract"
  - "certification"
  - "gold layer tags"`,
  },
  {
    iconName: 'Cpu' as const,
    accent: 'cyan',
    title: 'How Skills Work',
    summary: 'AI reads the SKILL.md, references supporting files, adapts to your context, and executes.',
    details: [
      'Step 1: The AI detects a trigger phrase (e.g., "apply data contracts") and loads the matching skill',
      'Step 2: It reads the SKILL.md instructions — understanding purpose, rules, and execution steps',
      'Step 3: It consults references/ for patterns (e.g., validation SQL, tagging best practices)',
      'Step 4: It loads assets/ for templates (e.g., contract-schema.yaml) to apply to your project',
      'Step 5: It adapts all instructions to your specific catalog, schema, and table names',
      'Step 6: It generates code, applies tags, creates validation pipelines — all following the skill\'s rules',
    ],
    diagram: {
      type: 'flow' as const,
      steps: [
        { label: 'Trigger', icon: '⚡' },
        { label: 'Load Skill', icon: '📖' },
        { label: 'Read Refs', icon: '📋' },
        { label: 'Adapt', icon: '🔧' },
        { label: 'Execute', icon: '▶' },
      ],
    },
    codeExample: `-- What the AI generates after reading the skill:
ALTER TABLE gold.dim_customer SET TAGS (
  'freshness_sla'            = '24h',
  'completeness_threshold'   = '99.5',
  'schema_version'           = '2.1',
  'data_owner'               = 'data-platform'
);`,
  },
  {
    iconName: 'FileCode' as const,
    accent: 'purple',
    title: 'Anatomy of a Skill',
    summary: 'A skill is a folder with SKILL.md, references, and assets that the AI reads.',
    details: [
      'SKILL.md — The primary file: YAML front-matter (name, description, triggers, metadata) + markdown body (rules & steps)',
      'references/ — Supporting documentation the AI consults: validation-patterns.md, tagging-best-practices.md',
      'assets/ — Concrete templates: contract-schema.yaml, validation-pipeline-template.py',
      'Triggers define when the skill activates: keyword matches like "data contract", "certification", "gold layer tags"',
      'Instructions are ordered steps with severity levels (Critical, Required, Recommended)',
      'A validation checklist at the end ensures the AI verifies its own work before finishing',
    ],
    diagram: {
      type: 'tree' as const,
      root: 'data-contract-governance/',
      children: [
        { name: 'SKILL.md', desc: 'Main instructions', highlight: true },
        { name: 'references/', desc: '', children: [
          { name: 'validation-patterns.md', desc: 'SQL examples' },
          { name: 'tagging-best-practices.md', desc: 'UC tag rules' },
        ]},
        { name: 'assets/', desc: '', children: [
          { name: 'contract-schema.yaml', desc: 'Tag definitions' },
          { name: 'pipeline-template.py', desc: 'Validation job' },
        ]},
      ],
    },
    codeExample: null,
  },
  {
    iconName: 'ShieldCheck' as const,
    accent: 'emerald',
    title: 'Governance & Validation',
    summary: 'Define governance rules as UC tags, validate compliance, and earn the certified badge.',
    details: [
      'Governance rules define what "good" looks like for a data asset: freshness, completeness, schema version, ownership, and more',
      'Each rule becomes a Unity Catalog tag applied via ALTER TABLE ... SET TAGS — no external tooling needed',
      'A scheduled validation pipeline reads the tags, runs checks, and scores each asset against its defined rules',
      'Assets passing all checks receive: system.certification_status = \'certified\'',
      'The certified badge is native to Databricks — visible in Unity Catalog, Data Explorer, lineage, and search results',
      'Example: A data contract skill defines freshness_sla, completeness_threshold, and quality_score_min as UC tags',
    ],
    diagram: {
      type: 'pipeline' as const,
      stages: [
        { label: 'Define\nContract', color: 'violet' },
        { label: 'Apply\nUC Tags', color: 'blue' },
        { label: 'Validate\nMeasures', color: 'amber' },
        { label: 'Certified\nBadge', color: 'emerald' },
      ],
    },
    codeExample: `-- Validation check (runs on schedule):
SELECT table_name,
  CASE WHEN DATEDIFF(hour, max_ts, now()) 
       <= CAST(tag_value AS INT) 
  THEN 'PASS' ELSE 'FAIL' END AS freshness
FROM contract_checks
WHERE tag_key = 'freshness_sla';

-- Assign certified badge on pass:
ALTER TABLE gold.dim_customer SET TAGS (
  'system.certification_status' = 'certified'
);`,
  },
];

const SKILLS_OBJECTIVES = [
  'Understand the Agent Skills standard',
  'Explore existing skills in your template',
  'Define a strategy for your new skill',
  'Generate a complete SKILL.md package',
  'Apply, test, and automate validation',
];

const CARD_ACCENT_CLASSES: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  violet: { border: 'border-violet-500/40', bg: 'bg-violet-500/10', text: 'text-violet-400', glow: 'shadow-[0_0_12px_rgba(139,92,246,0.15)]' },
  cyan: { border: 'border-cyan-500/40', bg: 'bg-cyan-500/10', text: 'text-cyan-400', glow: 'shadow-[0_0_12px_rgba(6,182,212,0.15)]' },
  purple: { border: 'border-purple-500/40', bg: 'bg-purple-500/10', text: 'text-purple-400', glow: 'shadow-[0_0_12px_rgba(168,85,247,0.15)]' },
  emerald: { border: 'border-emerald-500/40', bg: 'bg-emerald-500/10', text: 'text-emerald-400', glow: 'shadow-[0_0_12px_rgba(16,185,129,0.15)]' },
};

const CARD_ICONS: Record<string, React.ReactNode> = {
  BookOpen: <BookOpen className="w-6 h-6 text-violet-400" />,
  Cpu: <Cpu className="w-6 h-6 text-cyan-400" />,
  FileCode: <FileCode className="w-6 h-6 text-purple-400" />,
  ShieldCheck: <ShieldCheck className="w-6 h-6 text-emerald-400" />,
};

const CARD_ICONS_LG: Record<string, React.ReactNode> = {
  BookOpen: <BookOpen className="w-5 h-5 text-violet-400" />,
  Cpu: <Cpu className="w-5 h-5 text-cyan-400" />,
  FileCode: <FileCode className="w-5 h-5 text-purple-400" />,
  ShieldCheck: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
};

function FlowDiagram({ steps }: { steps: { label: string; icon: string }[] }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className="flex flex-col items-center gap-1 min-w-[3.5rem]">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-base">
              {step.icon}
            </div>
            <span className="text-ui-2xs text-muted-foreground text-center leading-tight font-medium">{step.label}</span>
          </div>
          {i < steps.length - 1 && (
            <ChevronRight className="w-3 h-3 text-muted-foreground/40 flex-shrink-0 mt-[-14px]" />
          )}
        </div>
      ))}
    </div>
  );
}

function PipelineDiagram({ stages }: { stages: { label: string; color: string }[] }) {
  const colorMap: Record<string, string> = {
    violet: 'from-violet-500/25 to-violet-600/10 border-violet-500/30 text-violet-300',
    blue: 'from-blue-500/25 to-blue-600/10 border-blue-500/30 text-blue-300',
    amber: 'from-amber-500/25 to-amber-600/10 border-amber-500/30 text-amber-300',
    emerald: 'from-emerald-500/25 to-emerald-600/10 border-emerald-500/30 text-emerald-300',
  };
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto py-2">
      {stages.map((stage, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className={`px-3 py-2 rounded-lg bg-gradient-to-b border text-center min-w-[4.25rem] ${colorMap[stage.color] || colorMap.violet}`}>
            <span className="text-ui-2xs font-semibold leading-tight whitespace-pre-line">{stage.label}</span>
          </div>
          {i < stages.length - 1 && (
            <div className="flex-shrink-0 text-muted-foreground/30">
              <svg width="16" height="12" viewBox="0 0 16 12" fill="none"><path d="M0 6h12M10 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TreeDiagram({ root, children }: { root: string; children: { name: string; desc: string; highlight?: boolean; children?: { name: string; desc: string }[] }[] }) {
  return (
    <div className="font-mono text-ui-xs leading-relaxed">
      <div className="text-purple-400 font-bold">{root}</div>
      {children.map((child, i) => {
        const isLast = i === children.length - 1;
        const prefix = isLast ? '└── ' : '├── ';
        const childPrefix = isLast ? '    ' : '│   ';
        return (
          <div key={i}>
            <div className="flex items-baseline gap-1">
              <span className="text-muted-foreground/50 select-none">{prefix}</span>
              <span className={child.highlight ? 'text-yellow-400 font-bold' : 'text-foreground'}>{child.name}</span>
              {child.desc && <span className="text-muted-foreground/60 text-ui-2xs ml-1">← {child.desc}</span>}
            </div>
            {child.children?.map((sub, j) => {
              const subIsLast = j === (child.children?.length ?? 0) - 1;
              const subPrefix = subIsLast ? '└── ' : '├── ';
              return (
                <div key={j} className="flex items-baseline gap-1">
                  <span className="text-muted-foreground/50 select-none">{childPrefix}{subPrefix}</span>
                  <span className="text-foreground/80">{sub.name}</span>
                  {sub.desc && <span className="text-muted-foreground/60 text-ui-2xs ml-1">← {sub.desc}</span>}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function EcosystemDiagram({ nodes }: { nodes: { label: string; sub: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 py-1">
      {nodes.map((node, i) => (
        <div key={i} className={`rounded-lg border px-3 py-2 text-center ${
          i === 3 ? 'bg-violet-500/15 border-violet-500/30' : 'bg-slate-700/40 border-slate-600/30'
        }`}>
          <div className={`text-ui-xs font-bold ${i === 3 ? 'text-violet-300' : 'text-foreground/90'}`}>{node.label}</div>
          <div className="text-ui-3xs text-muted-foreground mt-0.5">{node.sub}</div>
        </div>
      ))}
    </div>
  );
}

function SkillsAcceleratorView({
  expandedCard,
  setExpandedCard,
  bulletsRevealed,
}: {
  expandedCard: number | null;
  setExpandedCard: (v: number | null) => void;
  bulletsRevealed: boolean;
}) {
  return (
    <div>
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-violet-900/30 via-purple-900/25 to-indigo-900/30 border border-violet-500/20 rounded-xl p-5 mb-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-violet-500/20 shadow-[0_0_24px_rgba(139,92,246,0.25)] flex-shrink-0">
            <ShieldCheck className="w-7 h-7 text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-foreground tracking-tight">Data Contract Governance Skill</h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Build an Agent Skill that defines <strong className="text-violet-400">data contract measures</strong> as Unity Catalog tags,
              validates compliance on a schedule, and automatically assigns the Databricks <strong className="text-emerald-400">certified</strong> badge.
            </p>
            <div className="flex items-center gap-3 mt-3">
              <span className="inline-flex items-center gap-1.5 text-ui-2xs font-medium text-violet-400/80 bg-violet-500/10 border border-violet-500/20 rounded-full px-2.5 py-1">
                <BookOpen className="w-3 h-3" /> Agent Skills Standard
              </span>
              <span className="inline-flex items-center gap-1.5 text-ui-2xs font-medium text-cyan-400/80 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-2.5 py-1">
                <Database className="w-3 h-3" /> Unity Catalog Tags
              </span>
              <span className="inline-flex items-center gap-1.5 text-ui-2xs font-medium text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1">
                <ShieldCheck className="w-3 h-3" /> Certified Badge
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Concept Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {SKILLS_CONCEPT_CARDS.map((card, idx) => {
          const accent = CARD_ACCENT_CLASSES[card.accent] || CARD_ACCENT_CLASSES.violet;
          const isActive = expandedCard === idx;
          return (
            <button
              key={idx}
              onClick={() => setExpandedCard(isActive ? null : idx)}
              className={`text-left border rounded-xl p-4 cursor-pointer transition-all duration-250 group relative overflow-hidden ${
                isActive
                  ? `${accent.border} bg-slate-800/80 ${accent.glow} scale-[1.01]`
                  : `border-slate-700/40 bg-slate-800/50 hover:${accent.border} hover:bg-slate-800/70 hover:scale-[1.01]`
              }`}
            >
              <div className={`mb-2.5 p-2 rounded-lg w-fit ${accent.bg} transition-colors`}>
                {CARD_ICONS[card.iconName]}
              </div>
              <h4 className="text-ui-base font-semibold text-foreground mb-1.5 tracking-tight">{card.title}</h4>
              <p className="text-ui-xs text-muted-foreground leading-relaxed">{card.summary}</p>
              <div className={`mt-2.5 flex items-center gap-1 text-ui-2xs font-medium transition-colors ${isActive ? accent.text : 'text-muted-foreground/50 group-hover:' + accent.text}`}>
                <span>{isActive ? 'Click to collapse' : 'Click to explore'}</span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isActive ? 'rotate-180' : ''}`} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Expanded Detail Panel */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          expandedCard !== null ? 'max-h-[600px] opacity-100 mb-4' : 'max-h-0 opacity-0'
        }`}
      >
        {expandedCard !== null && (() => {
          const card = SKILLS_CONCEPT_CARDS[expandedCard];
          const accent = CARD_ACCENT_CLASSES[card.accent] || CARD_ACCENT_CLASSES.violet;
          return (
            <div className={`border ${accent.border} rounded-xl overflow-hidden`}>
              <div className={`${accent.bg} px-5 py-3 border-b ${accent.border}`}>
                <div className="flex items-center gap-2.5">
                  {CARD_ICONS_LG[card.iconName]}
                  <h4 className="text-ui-md font-bold text-foreground tracking-tight">{card.title}</h4>
                </div>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Left: Key points */}
                  <div>
                    <h5 className="text-ui-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Key Concepts</h5>
                    <ul className="space-y-2">
                      {card.details.map((detail, i) => (
                        <li key={i} className="flex items-start gap-2 text-ui-sm text-muted-foreground leading-relaxed">
                          <span className={`w-1.5 h-1.5 rounded-full ${accent.text.replace('text-', 'bg-')} mt-[7px] flex-shrink-0`} />
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* Right: Visual diagram + code example */}
                  <div className="space-y-3">
                    <div>
                      <h5 className="text-ui-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Visual Overview</h5>
                      <div className="bg-slate-900/60 border border-slate-700/40 rounded-lg p-3">
                        {card.diagram.type === 'ecosystem' && <EcosystemDiagram nodes={(card.diagram as { type: 'ecosystem'; nodes: { label: string; sub: string }[] }).nodes} />}
                        {card.diagram.type === 'flow' && <FlowDiagram steps={(card.diagram as { type: 'flow'; steps: { label: string; icon: string }[] }).steps} />}
                        {card.diagram.type === 'tree' && <TreeDiagram root={(card.diagram as { type: 'tree'; root: string; children: { name: string; desc: string; highlight?: boolean; children?: { name: string; desc: string }[] }[] }).root} children={(card.diagram as { type: 'tree'; root: string; children: { name: string; desc: string; highlight?: boolean; children?: { name: string; desc: string }[] }[] }).children} />}
                        {card.diagram.type === 'pipeline' && <PipelineDiagram stages={(card.diagram as { type: 'pipeline'; stages: { label: string; color: string }[] }).stages} />}
                      </div>
                    </div>
                    {card.codeExample && (
                      <div>
                        <h5 className="text-ui-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Example</h5>
                        <pre className="bg-slate-900/80 border border-slate-700/40 rounded-lg p-3 overflow-x-auto text-ui-2xs leading-relaxed font-mono text-slate-300 max-h-[140px]">
                          <code>{card.codeExample}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Learning Objectives */}
      <div className="pt-1">
        <h4 className="text-ui-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 text-center">
          What You'll Build
        </h4>
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          {SKILLS_OBJECTIVES.map((obj, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 text-ui-sm text-muted-foreground transition-all duration-300"
              style={{
                opacity: bulletsRevealed ? 1 : 0,
                transform: bulletsRevealed ? 'translateY(0)' : 'translateY(8px)',
                transitionDelay: `${idx * 100}ms`,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
              <span>{obj}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ArchitectureDiagramContentProps {
  workshopLevel?: WorkshopLevel;
  completedSteps?: Set<number>;
  direction?: 'forward' | 'reverse';
  aiAgentsModules?: Set<AIAgentModule>;
  medallionLayers?: Set<MedallionLayer>;
}

/**
 * Whether a given AI module's tile/group should render in the architecture
 * diagram. Modules are only gated on levels that actually support toggles AND
 * for modules that are actually applicable on that level — otherwise we fall
 * back to default visibility so non-AI levels and partially-applicable levels
 * (e.g. reverse-lakebase) keep their existing behavior.
 */
function shouldShowAIModule(
  level: WorkshopLevel,
  module: AIAgentModule,
  modules: Set<AIAgentModule> | undefined,
): boolean {
  if (!levelSupportsAIModuleToggles(level)) return true;
  if (!getApplicableAIModules(level).has(module)) return true;
  return modules?.has(module) ?? true;
}

/** Same gating semantics as shouldShowAIModule, but for Bronze/Silver/Gold. */
function shouldShowMedallionLayer(
  level: WorkshopLevel,
  layer: MedallionLayer,
  layers: Set<MedallionLayer> | undefined,
): boolean {
  if (!levelSupportsMedallionToggles(level)) return true;
  if (!getApplicableMedallionLayers(level).has(layer)) return true;
  return layers?.has(layer) ?? true;
}

/**
 * Inner diagram content without the outer card, header, or collapse logic.
 * Used by PathAndArchitecture to embed inside a combined collapsible card.
 */
export function ArchitectureDiagramContent({
  workshopLevel = 'end-to-end',
  completedSteps,
  direction = 'forward',
  aiAgentsModules,
  medallionLayers,
}: ArchitectureDiagramContentProps) {
  const showGenieModule = shouldShowAIModule(workshopLevel, 'genie', aiAgentsModules);
  const showAgentModule = shouldShowAIModule(workshopLevel, 'agent', aiAgentsModules);
  const showDashboardModule = shouldShowAIModule(workshopLevel, 'dashboard', aiAgentsModules);
  // Agents Accelerator forces Bronze-only and a custom ch4 layout. Acts like
  // Genie (no chip toggles exposed), but anchored on Bronze instead of Gold.
  const isAgentsAccelerator = workshopLevel === 'agents-accelerator';
  const showBronze = isAgentsAccelerator || shouldShowMedallionLayer(workshopLevel, 'bronze', medallionLayers);
  const showSilver = !isAgentsAccelerator && shouldShowMedallionLayer(workshopLevel, 'silver', medallionLayers);
  const showGold = !isAgentsAccelerator && shouldShowMedallionLayer(workshopLevel, 'gold', medallionLayers);
  const [bulletsRevealed, setBulletsRevealed] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setBulletsRevealed(true));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const prevLevelRef = useRef(workshopLevel);
  useEffect(() => {
    if (workshopLevel !== prevLevelRef.current) {
      prevLevelRef.current = workshopLevel;
      setBulletsRevealed(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setBulletsRevealed(true));
      });
    }
  }, [workshopLevel]);

  const prevDirectionRef = useRef(direction);
  useEffect(() => {
    if (direction !== prevDirectionRef.current) {
      prevDirectionRef.current = direction;
      setBulletsRevealed(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setBulletsRevealed(true));
      });
    }
  }, [direction]);

  const isSkillsAccelerator = workshopLevel === 'skills-accelerator';
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  useEffect(() => {
    if (!isSkillsAccelerator) setExpandedCard(null);
  }, [isSkillsAccelerator]);

  const cumOverrides = completedSteps ? getCumulativeOverrides(workshopLevel, completedSteps) : null;
  const visibility = cumOverrides?.archVisibility ?? ARCH_VISIBILITY[workshopLevel];
  const showAppLakebase = visibility.ch1 || visibility.ch2;
  const showLakehouse = visibility.ch3;
  const showDataIntel = visibility.ch4;
  const isGenie = workshopLevel === 'genie-accelerator';

  const appLakebaseFade = useFadeTransition(showAppLakebase);
  const lakehouseFade = useFadeTransition(showLakehouse);
  const dataIntelFade = useFadeTransition(showDataIntel);

  if (isSkillsAccelerator) {
    return (
      <SkillsAcceleratorView
        expandedCard={expandedCard}
        setExpandedCard={setExpandedCard}
        bulletsRevealed={bulletsRevealed}
      />
    );
  }

  const visibleChapters = cumOverrides?.chapterVisibility ?? CHAPTER_VISIBILITY[workshopLevel];
  const leftObjectives = LEARNING_OBJECTIVES.filter(obj =>
    obj.chapters.some(ch => (ch === 'ch1' || ch === 'ch2') && visibleChapters.has(ch))
  );
  // Agents Accelerator swaps in agent-specific bullets for ch3 (Bronze-only)
  // and ch4 (Agent Framework + MCP + Lakebase Memory + MLflow). The default
  // bullets describe Bronze/Silver/Gold + Genie/Dashboards which is wrong here.
  const middleObjectives = isAgentsAccelerator
    ? (visibleChapters.has('ch3') ? AGENTS_MIDDLE_OBJECTIVES : [])
    : LEARNING_OBJECTIVES.filter(obj =>
        obj.chapters.some(ch => ch === 'ch3' && visibleChapters.has(ch))
      );
  const rightObjectives = isAgentsAccelerator
    ? (visibleChapters.has('ch4') ? AGENTS_RIGHT_OBJECTIVES : [])
    : LEARNING_OBJECTIVES.filter(obj =>
        obj.chapters.some(ch => ch === 'ch4' && visibleChapters.has(ch))
      );
  const middleStaggerOffset = leftObjectives.length;
  const rightStaggerOffset = leftObjectives.length + middleObjectives.length;
  const hasAnyObjectives = leftObjectives.length > 0 || middleObjectives.length > 0 || rightObjectives.length > 0;

  const fadeClass = (isVisible: boolean) =>
    `transition-all ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`;

  return (
    <div>
      {/* Interactive hint */}
      <div className="mb-3 flex items-center justify-center gap-2 text-ui-sm text-slate-400 text-center px-2">
        <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
        <span>
          <span className="font-medium text-slate-300">Interactive hint</span>
          {' — '}
          Click on any service to learn more about it
          {direction === 'reverse' ? ' (Reverse ETL flow)' : ''}
        </span>
      </div>

      {/* Architecture Diagram Container - 3D Flip */}
      <div className="arch-perspective">
        <div className={`arch-card relative ${direction === 'reverse' ? 'flipped' : ''}`}>
          {/* FRONT FACE - Forward Layout */}
          <div className="arch-face w-full bg-slate-900 p-8 rounded-xl">
            <div className="max-w-6xl mx-auto">
          <div className="relative flex items-stretch gap-4 justify-center">
            {appLakebaseFade.shouldRender && (
              <div className={`border-2 border-[#FF3621]/60 rounded-xl p-4 bg-slate-800/50 w-[13.75rem] flex-shrink-0 duration-300 ${fadeClass(appLakebaseFade.isVisible)}`}>
                <div className="bg-[#FF3621] text-center py-2 px-3 rounded-lg mb-4">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    {visibility.ch1 && <Globe className="w-4 h-4 text-white" />}
                    {visibility.ch2 && <HardDrive className="w-4 h-4 text-white" />}
                  </div>
                  <p className="text-ui-base font-bold text-white">
                    {visibility.ch1 && visibility.ch2 ? 'App & Database' : visibility.ch1 ? 'Databricks App' : 'Lakebase'}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-gradient-to-br from-slate-500 to-slate-600 rounded-lg shadow-lg flex items-center justify-center">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-ui-base font-semibold text-slate-200">User</p>
                  <ArrowDown className="w-5 h-5 text-slate-400" />
                  {visibility.ch1 && (
                    <ServicePopover serviceKey="databricksApp" position="right" block>
                      <div className="w-full bg-gradient-to-br from-[#FF3621] to-[#E62D1B] rounded-lg shadow-lg p-3.5 hover:shadow-[#FF3621]/40 hover:shadow-xl transition-all duration-200 hover:scale-105">
                        <div className="flex flex-col items-center gap-1.5">
                          <Globe className="w-7 h-7 text-white" />
                          <p className="text-ui-base font-bold text-white text-center">Databricks App</p>
                        </div>
                      </div>
                    </ServicePopover>
                  )}
                  {visibility.ch1 && visibility.ch2 && (
                    <div className="flex items-center gap-1">
                      <ArrowDown className="w-4 h-4 text-violet-400" />
                      <ArrowLeftRight className="w-4 h-4 text-violet-400" />
                    </div>
                  )}
                  {visibility.ch2 && (
                    <ServicePopover serviceKey="lakebase" position="right" block>
                      <div className="w-full bg-gradient-to-br from-violet-600 to-purple-700 rounded-lg shadow-lg p-3.5 hover:shadow-violet-500/40 hover:shadow-xl transition-all duration-200 hover:scale-105">
                        <div className="flex flex-col items-center gap-1.5">
                          <HardDrive className="w-7 h-7 text-white" />
                          <p className="text-ui-base font-bold text-white">Lakebase</p>
                        </div>
                      </div>
                    </ServicePopover>
                  )}
                </div>
              </div>
            )}
            {showAppLakebase && showLakehouse && (
              <div className="flex flex-col items-center justify-center">
                <ChevronRight className="w-12 h-12 text-violet-400" strokeWidth={3} />
              </div>
            )}
            {showAppLakebase && !showLakehouse && showDataIntel && (
              <div className="flex flex-col items-center justify-center">
                <ChevronRight className="w-12 h-12 text-violet-400" strokeWidth={3} />
              </div>
            )}
            {lakehouseFade.shouldRender && (
              <div className={`border-2 border-teal-500/60 rounded-xl p-4 bg-slate-800/50 flex-1 duration-300 ${fadeClass(lakehouseFade.isVisible)}`}>
                <div className="bg-teal-600 text-center py-2 px-3 rounded-lg mb-4">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Database className="w-4 h-4 text-white" />
                  </div>
                  <p className="text-ui-base font-bold text-white">Lakehouse</p>
                </div>
                <div className="flex flex-col gap-2">
                  {!isGenie && showBronze && (<>
                    <ServicePopover serviceKey="dataIngestion" position="top" block>
                      <div className="bg-teal-900/40 rounded-lg px-3 py-2.5 border border-teal-400 hover:bg-teal-900/60 hover:border-teal-300 transition-all duration-200 hover:scale-105">
                        <p className="text-ui-sm font-semibold text-teal-200 text-center">Data Ingestion Pipeline</p>
                      </div>
                    </ServicePopover>
                    <ArrowDown className="w-5 h-5 text-teal-400 mx-auto" />
                    <ServicePopover serviceKey="bronze" position="left" block>
                      <div className="bg-gradient-to-br from-orange-700 to-amber-800 rounded-lg p-3.5 shadow-lg hover:shadow-orange-500/30 hover:shadow-xl transition-all duration-200 hover:scale-105">
                        <div className="flex items-center gap-2 mb-1">
                          <Layers className="w-5 h-5 text-orange-100" />
                          <p className="text-ui-base font-bold text-white">Bronze</p>
                        </div>
                        <p className="text-ui-xs text-orange-200">Raw data</p>
                      </div>
                    </ServicePopover>
                  </>)}
                  {!isGenie && showBronze && showSilver && (
                    <ArrowDown className="w-4 h-4 text-slate-400 mx-auto" />
                  )}
                  {!isGenie && showSilver && (<>
                    <ServicePopover serviceKey="sdp" position="left" block>
                      <div className="bg-teal-800/60 border border-teal-600/50 rounded px-2.5 py-1.5 hover:bg-teal-800/80 transition-all duration-200 hover:scale-105">
                        <p className="text-ui-xs font-semibold text-teal-200 text-center">SDP + Quality</p>
                      </div>
                    </ServicePopover>
                    <ArrowDown className="w-4 h-4 text-slate-400 mx-auto" />
                  </>)}
                  {showSilver && (
                    <ServicePopover serviceKey="silver" position="left" block>
                      <div className="bg-gradient-to-br from-slate-400 to-slate-500 rounded-lg p-3.5 shadow-lg hover:shadow-slate-300/30 hover:shadow-xl transition-all duration-200 hover:scale-105">
                        <div className="flex items-center gap-2 mb-1">
                          <Sparkles className="w-5 h-5 text-white" />
                          <p className="text-ui-base font-bold text-white">Silver</p>
                        </div>
                        <p className="text-ui-xs text-slate-100">Cleaned data</p>
                      </div>
                    </ServicePopover>
                  )}
                  {showGold && (<>
                    {showSilver && <ArrowDown className="w-4 h-4 text-slate-400 mx-auto" />}
                    <div className="bg-teal-800/60 border border-teal-600/50 rounded px-2.5 py-1.5">
                      <p className="text-ui-xs font-semibold text-teal-200 text-center">SDP Transform</p>
                    </div>
                    <ArrowDown className="w-4 h-4 text-slate-400 mx-auto" />
                    <ServicePopover serviceKey="gold" position="left" block>
                      <div className="bg-gradient-to-br from-yellow-500 to-amber-600 rounded-lg p-3.5 shadow-lg hover:shadow-yellow-400/30 hover:shadow-xl transition-all duration-200 hover:scale-105">
                        <div className="flex items-center gap-2 mb-1">
                          <Zap className="w-5 h-5 text-yellow-100" />
                          <p className="text-ui-base font-bold text-white">Gold</p>
                        </div>
                        <p className="text-ui-xs text-yellow-100">Business ready</p>
                      </div>
                    </ServicePopover>
                  </>)}
                </div>
              </div>
            )}
            {showLakehouse && showDataIntel && (
              <div className="flex flex-col items-center justify-center">
                <ChevronRight className="w-12 h-12 text-amber-400" strokeWidth={3} />
              </div>
            )}
            {dataIntelFade.shouldRender && (
              <div className={`border-2 border-blue-500/60 rounded-xl p-4 bg-slate-800/50 flex-1 duration-300 ${fadeClass(dataIntelFade.isVisible)}`}>
                <div className="bg-blue-600 text-center py-2 px-3 rounded-lg mb-4">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    {isAgentsAccelerator ? (
                      <Bot className="w-4 h-4 text-white" />
                    ) : (
                      <Brain className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <p className="text-ui-base font-bold text-white">{isAgentsAccelerator ? 'Agent' : 'AI and Agents'}</p>
                </div>
                {isAgentsAccelerator ? (
                  <AgentsAcceleratorPanel mlflowFaded={false} />
                ) : (
                  <div className="flex flex-col gap-3">
                    {showGenieModule && (
                      <div className="bg-slate-800 border-2 border-amber-500/60 rounded-lg p-3.5 shadow-lg">
                        <p className="text-ui-base font-bold text-amber-300 mb-2">Genie</p>
                        <div className="space-y-1.5">
                          <ServicePopover serviceKey="tvf" position="left" block>
                            <div className="bg-amber-900/30 rounded px-2.5 py-1.5 border border-amber-500/30 hover:bg-amber-900/50 hover:border-amber-400 transition-all duration-200 hover:scale-105">
                              <p className="text-ui-xs font-semibold text-amber-200">Table Value Functions</p>
                            </div>
                          </ServicePopover>
                          <ServicePopover serviceKey="metricViews" position="left" block>
                            <div className="bg-amber-900/30 rounded px-2.5 py-1.5 border border-amber-500/30 hover:bg-amber-900/50 hover:border-amber-400 transition-all duration-200 hover:scale-105">
                              <p className="text-ui-xs font-semibold text-amber-200">Metric Views</p>
                            </div>
                          </ServicePopover>
                          <ServicePopover serviceKey="genieSpaces" position="left" block>
                            <div className="bg-amber-900/30 rounded px-2.5 py-1.5 border border-amber-500/30 hover:bg-amber-900/50 hover:border-amber-400 transition-all duration-200 hover:scale-105">
                              <p className="text-ui-xs font-semibold text-amber-200">Genie Spaces</p>
                            </div>
                          </ServicePopover>
                        </div>
                      </div>
                    )}
                    {!isGenie && (showDashboardModule || showAgentModule) && (<>
                      {showGenieModule && (
                        <div className="flex justify-center gap-2">
                          {showDashboardModule && <ArrowDown className="w-4 h-4 text-green-400" />}
                          {showAgentModule && <ArrowDown className="w-4 h-4 text-blue-400" />}
                        </div>
                      )}
                      <div className={`grid gap-2.5 ${showDashboardModule && showAgentModule ? 'grid-cols-2' : 'grid-cols-1'}`}>
                        {showDashboardModule && (
                          <ServicePopover serviceKey="aiBIDashboards" position="top" block>
                            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-2.5 shadow-lg hover:shadow-green-500/30 hover:shadow-xl transition-all duration-200 hover:scale-105">
                              <div className="flex flex-col items-center gap-1">
                                <LayoutDashboard className="w-5 h-5 text-white" />
                                <p className="text-ui-sm font-bold text-white text-center">AI/BI Dashboards</p>
                              </div>
                            </div>
                          </ServicePopover>
                        )}
                        {showAgentModule && (
                          <ServicePopover serviceKey="agents" position="top" block>
                            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-2.5 shadow-lg hover:shadow-blue-500/30 hover:shadow-xl transition-all duration-200 hover:scale-105">
                              <div className="flex flex-col items-center gap-1">
                                <Bot className="w-5 h-5 text-white" />
                                <p className="text-ui-sm font-bold text-white text-center">Agent</p>
                              </div>
                            </div>
                          </ServicePopover>
                        )}
                      </div>
                    </>)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="mt-6 flex flex-wrap justify-center gap-5 md:gap-8">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#FF3621]" />
              <p className="text-ui-xs text-slate-400">Databricks Apps</p>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-violet-500" />
              <p className="text-ui-xs text-slate-400">Lakebase</p>
            </div>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-teal-500" />
              <p className="text-ui-xs text-slate-400">Lakehouse</p>
            </div>
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-blue-500" />
              <p className="text-ui-xs text-slate-400">AI and Agents</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <p className="text-ui-xs text-slate-400">Click for details</p>
            </div>
          </div>

          {hasAnyObjectives && (
            <div className="mt-5 flex gap-4 justify-center">
              {appLakebaseFade.shouldRender && leftObjectives.length > 0 && (
                <div className={`w-[13.75rem] flex-shrink-0 duration-300 ${fadeClass(appLakebaseFade.isVisible)}`}>
                  <div className="rounded-lg bg-slate-800/40 border border-[#FF3621]/20 p-3">
                    <ul className="space-y-1.5">
                      {leftObjectives.map((obj, idx) => (
                        <li key={obj.id} className={`flex items-start gap-1.5 text-ui-xs text-slate-300 transition-all duration-300 ease-out ${bulletsRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}
                          style={{ transitionDelay: bulletsRevealed ? `${idx * BULLET_STAGGER_MS}ms` : '0ms' }}>
                          <span className="text-[#FF3621]/70 mt-0.5 shrink-0">&#x2022;</span>
                          <span>{obj.content}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              {showAppLakebase && leftObjectives.length > 0 && (showLakehouse || showDataIntel) && (
                <div className="w-12 flex-shrink-0" />
              )}
              {lakehouseFade.shouldRender && middleObjectives.length > 0 && (
                <div className={`flex-1 duration-300 ${fadeClass(lakehouseFade.isVisible)}`}>
                  <div className="rounded-lg bg-slate-800/40 border border-teal-500/20 p-3">
                    <ul className="space-y-1.5">
                      {middleObjectives.map((obj, idx) => (
                        <li key={obj.id} className={`flex items-start gap-1.5 text-ui-xs text-slate-300 transition-all duration-300 ease-out ${bulletsRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}
                          style={{ transitionDelay: bulletsRevealed ? `${(middleStaggerOffset + idx) * BULLET_STAGGER_MS}ms` : '0ms' }}>
                          <span className="text-teal-400/70 mt-0.5 shrink-0">&#x2022;</span>
                          <span>{obj.content}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              {showLakehouse && middleObjectives.length > 0 && showDataIntel && rightObjectives.length > 0 && (
                <div className="w-12 flex-shrink-0" />
              )}
              {dataIntelFade.shouldRender && rightObjectives.length > 0 && (
                <div className={`flex-1 duration-300 ${fadeClass(dataIntelFade.isVisible)}`}>
                  <div className="rounded-lg bg-slate-800/40 border border-blue-500/20 p-3">
                    <ul className="space-y-1.5">
                      {rightObjectives.map((obj, idx) => (
                        <li key={obj.id} className={`flex items-start gap-1.5 text-ui-xs text-slate-300 transition-all duration-300 ease-out ${bulletsRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'}`}
                          style={{ transitionDelay: bulletsRevealed ? `${(rightStaggerOffset + idx) * BULLET_STAGGER_MS}ms` : '0ms' }}>
                          <span className="text-blue-400/70 mt-0.5 shrink-0">&#x2022;</span>
                          <span>{obj.content}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
          </div>

          {/* BACK FACE - Reverse Layout */}
          <div className="arch-face arch-face-back w-full bg-slate-900 p-8 rounded-xl overflow-y-auto">
            <div className="max-w-6xl mx-auto">
              <div className="relative flex items-stretch gap-4 justify-center">
                {/* LEFT: Lakehouse */}
                {lakehouseFade.shouldRender && (
                  <div className={`border-2 border-teal-500/60 rounded-xl p-4 bg-slate-800/50 flex-1 duration-300 ${fadeClass(lakehouseFade.isVisible)}`}>
                    <div className="bg-teal-600 text-center py-2 px-3 rounded-lg mb-4">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Database className="w-4 h-4 text-white" />
                      </div>
                      <p className="text-[13px] font-bold text-white">Lakehouse</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      {showBronze && (
                        <ServicePopover serviceKey="bronze" position="left" block>
                          <div className="bg-gradient-to-br from-orange-700 to-amber-800 rounded-lg p-3.5 shadow-lg hover:shadow-orange-500/30 hover:shadow-xl transition-all duration-200 hover:scale-105">
                            <div className="flex items-center gap-2 mb-1">
                              <Layers className="w-5 h-5 text-orange-100" />
                              <p className="text-[13px] font-bold text-white">Bronze</p>
                            </div>
                            <p className="text-[11px] text-orange-200">Raw data</p>
                          </div>
                        </ServicePopover>
                      )}
                      {showBronze && showSilver && <ArrowDown className="w-4 h-4 text-slate-400 mx-auto" />}
                      {showSilver && (
                        <ServicePopover serviceKey="silver" position="left" block>
                          <div className="bg-gradient-to-br from-slate-400 to-slate-500 rounded-lg p-3.5 shadow-lg hover:shadow-slate-300/30 hover:shadow-xl transition-all duration-200 hover:scale-105">
                            <div className="flex items-center gap-2 mb-1">
                              <Sparkles className="w-5 h-5 text-white" />
                              <p className="text-[13px] font-bold text-white">Silver</p>
                            </div>
                            <p className="text-[11px] text-slate-100">Cleaned data</p>
                          </div>
                        </ServicePopover>
                      )}
                      {showSilver && showGold && <ArrowDown className="w-4 h-4 text-slate-400 mx-auto" />}
                      {showGold && (
                        <ServicePopover serviceKey="gold" position="left" block>
                          <div className="bg-gradient-to-br from-yellow-500 to-amber-600 rounded-lg p-3.5 shadow-lg hover:shadow-yellow-400/30 hover:shadow-xl transition-all duration-200 hover:scale-105">
                            <div className="flex items-center gap-2 mb-1">
                              <Zap className="w-5 h-5 text-yellow-100" />
                              <p className="text-[13px] font-bold text-white">Gold</p>
                            </div>
                            <p className="text-[11px] text-yellow-100">Business ready</p>
                          </div>
                        </ServicePopover>
                      )}
                    </div>
                  </div>
                )}

                {/* Arrow: Lakehouse → DI */}
                {showLakehouse && showDataIntel && (
                  <div className="flex flex-col items-center justify-center">
                    <ChevronRight className="w-12 h-12 text-amber-400" strokeWidth={3} />
                  </div>
                )}

                {/* MIDDLE: AI and Agents */}
                {dataIntelFade.shouldRender && (
                  <div className={`border-2 border-blue-500/60 rounded-xl p-4 bg-slate-800/50 flex-1 duration-300 ${fadeClass(dataIntelFade.isVisible)}`}>
                    <div className="bg-blue-600 text-center py-2 px-3 rounded-lg mb-4">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Brain className="w-4 h-4 text-white" />
                      </div>
                      <p className="text-[13px] font-bold text-white">AI and Agents</p>
                    </div>
                    <div className="flex flex-col gap-3">
                      {showGenieModule && (
                        <div className="bg-slate-800 border-2 border-amber-500/60 rounded-lg p-3.5 shadow-lg">
                          <p className="text-[13px] font-bold text-amber-300 mb-2">Genie</p>
                          <div className="space-y-1.5">
                            <ServicePopover serviceKey="tvf" position="left" block>
                              <div className="bg-amber-900/30 rounded px-2.5 py-1.5 border border-amber-500/30 hover:bg-amber-900/50 hover:border-amber-400 transition-all duration-200 hover:scale-105">
                                <p className="text-[11px] font-semibold text-amber-200">Table Value Functions</p>
                              </div>
                            </ServicePopover>
                            <ServicePopover serviceKey="metricViews" position="left" block>
                              <div className="bg-amber-900/30 rounded px-2.5 py-1.5 border border-amber-500/30 hover:bg-amber-900/50 hover:border-amber-400 transition-all duration-200 hover:scale-105">
                                <p className="text-[11px] font-semibold text-amber-200">Metric Views</p>
                              </div>
                            </ServicePopover>
                            <ServicePopover serviceKey="genieSpaces" position="left" block>
                              <div className="bg-amber-900/30 rounded px-2.5 py-1.5 border border-amber-500/30 hover:bg-amber-900/50 hover:border-amber-400 transition-all duration-200 hover:scale-105">
                                <p className="text-[11px] font-semibold text-amber-200">Genie Spaces</p>
                              </div>
                            </ServicePopover>
                          </div>
                        </div>
                      )}
                      {!isGenie && (showDashboardModule || showAgentModule) && (<>
                        {showGenieModule && (
                          <div className="flex justify-center gap-2">
                            {showDashboardModule && <ArrowDown className="w-4 h-4 text-green-400" />}
                            {showAgentModule && <ArrowDown className="w-4 h-4 text-blue-400" />}
                          </div>
                        )}
                        <div className={`grid gap-2.5 ${showDashboardModule && showAgentModule ? 'grid-cols-2' : 'grid-cols-1'}`}>
                          {showDashboardModule && (
                            <ServicePopover serviceKey="aiBIDashboards" position="top" block>
                              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-2.5 shadow-lg hover:shadow-green-500/30 hover:shadow-xl transition-all duration-200 hover:scale-105">
                                <div className="flex flex-col items-center gap-1">
                                  <LayoutDashboard className="w-5 h-5 text-white" />
                                  <p className="text-[11px] font-bold text-white text-center">AI/BI Dashboards</p>
                                </div>
                              </div>
                            </ServicePopover>
                          )}
                          {showAgentModule && (
                            <ServicePopover serviceKey="agents" position="top" block>
                              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-2.5 shadow-lg hover:shadow-blue-500/30 hover:shadow-xl transition-all duration-200 hover:scale-105">
                                <div className="flex flex-col items-center gap-1">
                                  <Bot className="w-5 h-5 text-white" />
                                  <p className="text-[11px] font-bold text-white text-center">Agent</p>
                                </div>
                              </div>
                            </ServicePopover>
                          )}
                        </div>
                      </>)}
                    </div>
                  </div>
                )}

                {/* Dual-path arrows: DI → App & DB */}
                {showDataIntel && showAppLakebase && (
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="flex flex-col items-center">
                      <div className="reverse-arrow">
                        <ChevronRight className="w-10 h-10" strokeWidth={3} />
                      </div>
                      <span className="text-[9px] text-emerald-400/70 font-medium mt-0.5">Synced Tables</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <ChevronRight className="w-10 h-10 text-blue-400/80" strokeWidth={2} />
                      <span className="text-[9px] text-blue-400/70 font-medium mt-0.5">Genie Embed</span>
                    </div>
                  </div>
                )}

                {/* RIGHT: App & Database */}
                {appLakebaseFade.shouldRender && (
                  <div className={`border-2 border-emerald-500/60 rounded-xl p-4 bg-slate-800/50 w-[220px] flex-shrink-0 duration-300 ${fadeClass(appLakebaseFade.isVisible)}`}>
                    <div className="bg-emerald-600 text-center py-2 px-3 rounded-lg mb-4">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        {visibility.ch2 && <HardDrive className="w-4 h-4 text-white" />}
                        {visibility.ch1 && <Globe className="w-4 h-4 text-white" />}
                      </div>
                      <p className="text-[13px] font-bold text-white">
                        {visibility.ch1 && visibility.ch2 ? 'App & Database' : visibility.ch1 ? 'Databricks App' : 'Lakebase'}
                      </p>
                    </div>
                    <div className="flex flex-col items-center gap-3">
                      {visibility.ch2 && (
                        <ServicePopover serviceKey="lakebase" position="left" block>
                          <div className="w-full bg-gradient-to-br from-violet-600 to-purple-700 rounded-lg shadow-lg p-3.5 hover:shadow-violet-500/40 hover:shadow-xl transition-all duration-200 hover:scale-105">
                            <div className="flex flex-col items-center gap-1.5">
                              <HardDrive className="w-7 h-7 text-white" />
                              <p className="text-[13px] font-bold text-white">Lakebase</p>
                              <p className="text-[10px] text-violet-200">Synced Tables</p>
                            </div>
                          </div>
                        </ServicePopover>
                      )}
                      {visibility.ch1 && visibility.ch2 && (
                        <ArrowDown className="w-4 h-4 text-emerald-400" />
                      )}
                      {visibility.ch1 && (
                        <ServicePopover serviceKey="databricksApp" position="left" block>
                          <div className="w-full bg-gradient-to-br from-[#FF3621] to-[#E62D1B] rounded-lg shadow-lg p-3.5 hover:shadow-[#FF3621]/40 hover:shadow-xl transition-all duration-200 hover:scale-105">
                            <div className="flex flex-col items-center gap-1.5">
                              <Globe className="w-7 h-7 text-white" />
                              <p className="text-[13px] font-bold text-white">Analytics App</p>
                              <span className="inline-flex items-center gap-1 text-[9px] font-medium text-blue-200 bg-blue-500/25 border border-blue-400/30 rounded-full px-2 py-0.5">
                                <Sparkles className="w-2.5 h-2.5" />
                                Genie Embedded
                              </span>
                            </div>
                          </div>
                        </ServicePopover>
                      )}
                      <ArrowDown className="w-5 h-5 text-slate-400" />
                      <div className="w-16 h-16 bg-gradient-to-br from-slate-500 to-slate-600 rounded-lg shadow-lg flex items-center justify-center">
                        <Users className="w-8 h-8 text-white" />
                      </div>
                      <p className="text-[13px] font-semibold text-slate-200">User</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Reverse Legend */}
              <div className="mt-6 flex flex-wrap justify-center gap-5 md:gap-8">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-teal-500" />
                  <p className="text-[11px] text-slate-400">Lakehouse</p>
                </div>
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-blue-500" />
                  <p className="text-[11px] text-slate-400">AI and Agents</p>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <p className="text-[11px] text-slate-400">Genie Spaces</p>
                </div>
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-emerald-500" />
                  <p className="text-[11px] text-slate-400">Synced Tables (Reverse ETL)</p>
                </div>
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-violet-500" />
                  <p className="text-[11px] text-slate-400">Lakebase</p>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#FF3621]" />
                  <p className="text-[11px] text-slate-400">Analytics App</p>
                </div>
              </div>

              {/* Column-aligned reverse learning objectives */}
              <div className="mt-5 flex gap-4 justify-center">
                {/* Left: Lakehouse objectives */}
                {lakehouseFade.shouldRender && REVERSE_LAKEHOUSE_OBJECTIVES.length > 0 && (
                  <div className={`flex-1 duration-300 ${fadeClass(lakehouseFade.isVisible)}`}>
                    <div className="rounded-lg bg-slate-800/40 border border-teal-500/20 p-3">
                      <ul className="space-y-1.5">
                        {REVERSE_LAKEHOUSE_OBJECTIVES.map((obj, idx) => (
                          <li
                            key={obj.id}
                            className={`flex items-start gap-1.5 text-[11px] text-slate-300 transition-all duration-300 ease-out ${
                              bulletsRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
                            }`}
                            style={{ transitionDelay: bulletsRevealed ? `${idx * BULLET_STAGGER_MS}ms` : '0ms' }}
                          >
                            <span className="text-teal-400/70 mt-0.5 shrink-0">&#x2022;</span>
                            <span>{obj.content}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Spacer */}
                {showLakehouse && showDataIntel && (
                  <div className="w-12 flex-shrink-0" />
                )}

                {/* Middle: AI and Agents objectives */}
                {dataIntelFade.shouldRender && REVERSE_DI_OBJECTIVES.length > 0 && (
                  <div className={`flex-1 duration-300 ${fadeClass(dataIntelFade.isVisible)}`}>
                    <div className="rounded-lg bg-slate-800/40 border border-blue-500/20 p-3">
                      <ul className="space-y-1.5">
                        {REVERSE_DI_OBJECTIVES.map((obj, idx) => (
                          <li
                            key={obj.id}
                            className={`flex items-start gap-1.5 text-[11px] text-slate-300 transition-all duration-300 ease-out ${
                              bulletsRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
                            }`}
                            style={{ transitionDelay: bulletsRevealed ? `${(REVERSE_LAKEHOUSE_OBJECTIVES.length + idx) * BULLET_STAGGER_MS}ms` : '0ms' }}
                          >
                            <span className="text-blue-400/70 mt-0.5 shrink-0">&#x2022;</span>
                            <span>{obj.content}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Spacer */}
                {showDataIntel && showAppLakebase && (
                  <div className="w-12 flex-shrink-0" />
                )}

                {/* Right: Activation / App & Database objectives */}
                {appLakebaseFade.shouldRender && REVERSE_ACTIVATION_OBJECTIVES.length > 0 && (
                  <div className={`w-[220px] flex-shrink-0 duration-300 ${fadeClass(appLakebaseFade.isVisible)}`}>
                    <div className="rounded-lg bg-slate-800/40 border border-emerald-500/20 p-3">
                      <ul className="space-y-1.5">
                        {REVERSE_ACTIVATION_OBJECTIVES.map((obj, idx) => (
                          <li
                            key={obj.id}
                            className={`flex items-start gap-1.5 text-[11px] text-slate-300 transition-all duration-300 ease-out ${
                              bulletsRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
                            }`}
                            style={{ transitionDelay: bulletsRevealed ? `${(REVERSE_LAKEHOUSE_OBJECTIVES.length + REVERSE_DI_OBJECTIVES.length + idx) * BULLET_STAGGER_MS}ms` : '0ms' }}
                          >
                            <span className="text-emerald-400/70 mt-0.5 shrink-0">&#x2022;</span>
                            <span>{obj.content}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ArchitectureDiagram({ forceCollapsed = false, workshopLevel = 'end-to-end', onStartBuild }: ArchitectureDiagramProps) {
  const [userOverride, setUserOverride] = useState<boolean | null>(null);
  const prevForceCollapsed = useRef(forceCollapsed);

  // Staggered bullet reveal
  const [bulletsRevealed, setBulletsRevealed] = useState(false);

  // When forceCollapsed transitions to true, reset override so auto-collapse kicks in
  useEffect(() => {
    if (forceCollapsed && !prevForceCollapsed.current) {
      setUserOverride(null);
    }
    prevForceCollapsed.current = forceCollapsed;
  }, [forceCollapsed]);

  const autoExpanded = !forceCollapsed;
  const isExpanded = userOverride !== null ? userOverride : autoExpanded;

  // Initial mount: trigger bullet stagger
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setBulletsRevealed(true);
      });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // Re-stagger bullets when workshop level changes
  const prevLevelRef = useRef(workshopLevel);
  useEffect(() => {
    if (workshopLevel !== prevLevelRef.current) {
      prevLevelRef.current = workshopLevel;
      setBulletsRevealed(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setBulletsRevealed(true);
        });
      });
    }
  }, [workshopLevel]);

  // Compute visibility directly from workshopLevel (no delayed rendering)
  const visibility = ARCH_VISIBILITY[workshopLevel];
  const showAppLakebase = visibility.ch1 || visibility.ch2;
  const showLakehouse = visibility.ch3;
  const showDataIntel = visibility.ch4;
  const isGenie = workshopLevel === 'genie-accelerator';
  const isAgentsAccelerator = workshopLevel === 'agents-accelerator';
  // Standalone ArchitectureDiagram has no aiAgentsModules / medallionLayers prop
  // wiring; default to all-on so existing callers render unchanged. Agents
  // Accelerator forces Bronze-only and a custom ch4 layout.
  const showGenieModule = true;
  const showAgentModule = true;
  const showDashboardModule = true;
  const showBronze = true;
  const showSilver = !isAgentsAccelerator;
  const showGold = !isAgentsAccelerator;

  // Per-column fade transitions (transparent ↔ solid)
  const appLakebaseFade = useFadeTransition(showAppLakebase);
  const lakehouseFade = useFadeTransition(showLakehouse);
  const dataIntelFade = useFadeTransition(showDataIntel);

  // Group objectives by architecture column
  const visibleChapters = CHAPTER_VISIBILITY[workshopLevel];
  const leftObjectives = LEARNING_OBJECTIVES.filter(obj =>
    obj.chapters.some(ch => (ch === 'ch1' || ch === 'ch2') && visibleChapters.has(ch))
  );
  const middleObjectives = isAgentsAccelerator
    ? (visibleChapters.has('ch3') ? AGENTS_MIDDLE_OBJECTIVES : [])
    : LEARNING_OBJECTIVES.filter(obj =>
        obj.chapters.some(ch => ch === 'ch3' && visibleChapters.has(ch))
      );
  const rightObjectives = isAgentsAccelerator
    ? (visibleChapters.has('ch4') ? AGENTS_RIGHT_OBJECTIVES : [])
    : LEARNING_OBJECTIVES.filter(obj =>
        obj.chapters.some(ch => ch === 'ch4' && visibleChapters.has(ch))
      );
  const middleStaggerOffset = leftObjectives.length;
  const rightStaggerOffset = leftObjectives.length + middleObjectives.length;
  const hasAnyObjectives = leftObjectives.length > 0 || middleObjectives.length > 0 || rightObjectives.length > 0;

  // Transition class helper
  const fadeClass = (isVisible: boolean) =>
    `transition-all ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`;

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Clickable Header */}
      <button
        onClick={() => setUserOverride(!isExpanded)}
        className="group w-full p-4 flex items-center gap-3 hover:bg-secondary/30 transition-colors cursor-pointer"
      >
        <div className="p-2 rounded-md bg-primary/20">
          <LayoutDashboard className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 text-left">
          <h2 className="text-ui-md2 font-semibold text-foreground">
            Architecture Overview
          </h2>
          <p className="text-muted-foreground text-ui-base">
            Databricks services that will be deployed
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-ui-xs font-medium text-muted-foreground border border-border rounded-full px-2.5 py-1 bg-secondary/40 group-hover:bg-secondary group-hover:text-foreground transition-colors">
          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          {isExpanded ? 'Collapse' : 'Expand'}
        </span>
      </button>

      {/* Collapsible Content */}
      <div className={`transition-all duration-300 ease-in-out ${
        isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
      }`}>
        <div className="px-4 pb-4">
          {/* Interactive hint */}
          <div className="mb-3 flex items-center justify-center gap-2 text-ui-sm text-slate-400">
            <Info className="w-3.5 h-3.5 text-blue-400" />
            <span>Click on any service to learn more about it</span>
          </div>
          
          {/* Architecture Diagram Container */}
          <div className="w-full bg-slate-900 p-8 rounded-xl">
            <div className="max-w-6xl mx-auto">
              {/* Main Flow - Horizontal layout with proper sizing, centered */}
              <div className="relative flex items-stretch gap-4 justify-center">
                
                {/* LEFT SECTION: App & Lakebase - Stacked vertically */}
                {appLakebaseFade.shouldRender && (
                  <div
                    className={`border-2 border-[#FF3621]/60 rounded-xl p-4 bg-slate-800/50 w-[13.75rem] flex-shrink-0 duration-300 ${fadeClass(appLakebaseFade.isVisible)}`}
                  >
                    <div className="bg-[#FF3621] text-center py-2 px-3 rounded-lg mb-4">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        {visibility.ch1 && <Globe className="w-4 h-4 text-white" />}
                        {visibility.ch2 && <HardDrive className="w-4 h-4 text-white" />}
                      </div>
                      <p className="text-ui-base font-bold text-white">
                        {visibility.ch1 && visibility.ch2 ? 'App & Database' : visibility.ch1 ? 'Databricks App' : 'Lakebase'}
                      </p>
                    </div>
                    
                    <div className="flex flex-col items-center gap-3">
                      {/* User */}
                      <div className="w-16 h-16 bg-gradient-to-br from-slate-500 to-slate-600 rounded-lg shadow-lg flex items-center justify-center">
                        <Users className="w-8 h-8 text-white" />
                      </div>
                      <p className="text-ui-base font-semibold text-slate-200">User</p>
                      
                      <ArrowDown className="w-5 h-5 text-slate-400" />
                      
                      {/* Databricks App UI */}
                      {visibility.ch1 && (
                        <ServicePopover serviceKey="databricksApp" position="right" block>
                          <div className="w-full bg-gradient-to-br from-[#FF3621] to-[#E62D1B] rounded-lg shadow-lg p-3.5 hover:shadow-[#FF3621]/40 hover:shadow-xl transition-all duration-200 hover:scale-105">
                            <div className="flex flex-col items-center gap-1.5">
                              <Globe className="w-7 h-7 text-white" />
                              <p className="text-ui-base font-bold text-white text-center">Databricks App</p>
                            </div>
                          </div>
                        </ServicePopover>
                      )}
                      
                      {/* Bidirectional Arrow - only if both visible */}
                      {visibility.ch1 && visibility.ch2 && (
                        <div className="flex items-center gap-1">
                          <ArrowDown className="w-4 h-4 text-violet-400" />
                          <ArrowLeftRight className="w-4 h-4 text-violet-400" />
                        </div>
                      )}
                      
                      {/* Lakebase */}
                      {visibility.ch2 && (
                        <ServicePopover serviceKey="lakebase" position="right" block>
                          <div className="w-full bg-gradient-to-br from-violet-600 to-purple-700 rounded-lg shadow-lg p-3.5 hover:shadow-violet-500/40 hover:shadow-xl transition-all duration-200 hover:scale-105">
                            <div className="flex flex-col items-center gap-1.5">
                              <HardDrive className="w-7 h-7 text-white" />
                              <p className="text-ui-base font-bold text-white">Lakebase</p>
                            </div>
                          </div>
                        </ServicePopover>
                      )}
                    </div>
                  </div>
                )}

                {/* Large Arrow from App/Lakebase to Lakehouse */}
                {showAppLakebase && showLakehouse && (
                  <div className="flex flex-col items-center justify-center">
                    <ChevronRight className="w-12 h-12 text-violet-400" strokeWidth={3} />
                  </div>
                )}

                {/* Arrow from App/Lakebase to AI and Agents (when no Lakehouse) */}
                {showAppLakebase && !showLakehouse && showDataIntel && (
                  <div className="flex flex-col items-center justify-center">
                    <ChevronRight className="w-12 h-12 text-violet-400" strokeWidth={3} />
                  </div>
                )}

                {/* MIDDLE SECTION: Lakehouse - Full height */}
                {lakehouseFade.shouldRender && (
                  <div
                    className={`border-2 border-teal-500/60 rounded-xl p-4 bg-slate-800/50 flex-1 duration-300 ${fadeClass(lakehouseFade.isVisible)}`}
                  >
                    <div className="bg-teal-600 text-center py-2 px-3 rounded-lg mb-4">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <Database className="w-4 h-4 text-white" />
                      </div>
                      <p className="text-ui-base font-bold text-white">Lakehouse</p>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      {/* Data Ingestion + Bronze tile -- hidden for Genie Accelerator and Bronze chip */}
                      {!isGenie && showBronze && (<>
                        <ServicePopover serviceKey="dataIngestion" position="top" block>
                          <div className="bg-teal-900/40 rounded-lg px-3 py-2.5 border border-teal-400 hover:bg-teal-900/60 hover:border-teal-300 transition-all duration-200 hover:scale-105">
                            <p className="text-ui-sm font-semibold text-teal-200 text-center">Data Ingestion Pipeline</p>
                          </div>
                        </ServicePopover>
                        
                        <ArrowDown className="w-5 h-5 text-teal-400 mx-auto" />
                        
                        <ServicePopover serviceKey="bronze" position="left" block>
                          <div className="bg-gradient-to-br from-orange-700 to-amber-800 rounded-lg p-3.5 shadow-lg hover:shadow-orange-500/30 hover:shadow-xl transition-all duration-200 hover:scale-105">
                            <div className="flex items-center gap-2 mb-1">
                              <Layers className="w-5 h-5 text-orange-100" />
                              <p className="text-ui-base font-bold text-white">Bronze</p>
                            </div>
                            <p className="text-ui-xs text-orange-200">Raw data</p>
                          </div>
                        </ServicePopover>
                      </>)}

                      {/* Bronze -> Silver connector arrow */}
                      {!isGenie && showBronze && showSilver && (
                        <ArrowDown className="w-4 h-4 text-slate-400 mx-auto" />
                      )}

                      {/* SDP + Quality (Silver-owned, but skipped on Genie Accelerator) */}
                      {!isGenie && showSilver && (<>
                        <ServicePopover serviceKey="sdp" position="left" block>
                          <div className="bg-teal-800/60 border border-teal-600/50 rounded px-2.5 py-1.5 hover:bg-teal-800/80 transition-all duration-200 hover:scale-105">
                            <p className="text-ui-xs font-semibold text-teal-200 text-center">SDP + Quality</p>
                          </div>
                        </ServicePopover>
                        
                        <ArrowDown className="w-4 h-4 text-slate-400 mx-auto" />
                      </>)}
                      
                      {/* Silver tile */}
                      {showSilver && (
                        <ServicePopover serviceKey="silver" position="left" block>
                          <div className="bg-gradient-to-br from-slate-400 to-slate-500 rounded-lg p-3.5 shadow-lg hover:shadow-slate-300/30 hover:shadow-xl transition-all duration-200 hover:scale-105">
                            <div className="flex items-center gap-2 mb-1">
                              <Sparkles className="w-5 h-5 text-white" />
                              <p className="text-ui-base font-bold text-white">Silver</p>
                            </div>
                            <p className="text-ui-xs text-slate-100">Cleaned data</p>
                          </div>
                        </ServicePopover>
                      )}
                      
                      {/* SDP Transform + Gold tile (Gold-owned) */}
                      {showGold && (<>
                        {showSilver && <ArrowDown className="w-4 h-4 text-slate-400 mx-auto" />}

                        <div className="bg-teal-800/60 border border-teal-600/50 rounded px-2.5 py-1.5">
                          <p className="text-ui-xs font-semibold text-teal-200 text-center">SDP Transform</p>
                        </div>
                        
                        <ArrowDown className="w-4 h-4 text-slate-400 mx-auto" />
                        
                        <ServicePopover serviceKey="gold" position="left" block>
                          <div className="bg-gradient-to-br from-yellow-500 to-amber-600 rounded-lg p-3.5 shadow-lg hover:shadow-yellow-400/30 hover:shadow-xl transition-all duration-200 hover:scale-105">
                            <div className="flex items-center gap-2 mb-1">
                              <Zap className="w-5 h-5 text-yellow-100" />
                              <p className="text-ui-base font-bold text-white">Gold</p>
                            </div>
                            <p className="text-ui-xs text-yellow-100">Business ready</p>
                          </div>
                        </ServicePopover>
                      </>)}
                    </div>
                  </div>
                )}

                {/* Large Arrow from Lakehouse to AI and Agents */}
                {showLakehouse && showDataIntel && (
                  <div className="flex flex-col items-center justify-center">
                    <ChevronRight className="w-12 h-12 text-amber-400" strokeWidth={3} />
                  </div>
                )}

                {/* RIGHT SECTION: AI and Agents (or "Agent" for the Agents Accelerator) - Full height */}
                {dataIntelFade.shouldRender && (
                  <div
                    className={`border-2 border-blue-500/60 rounded-xl p-4 bg-slate-800/50 flex-1 duration-300 ${fadeClass(dataIntelFade.isVisible)}`}
                  >
                    <div className="bg-blue-600 text-center py-2 px-3 rounded-lg mb-4">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        {isAgentsAccelerator ? (
                          <Bot className="w-4 h-4 text-white" />
                        ) : (
                          <Brain className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <p className="text-ui-base font-bold text-white">{isAgentsAccelerator ? 'Agent' : 'AI and Agents'}</p>
                    </div>

                    {isAgentsAccelerator ? (
                      <AgentsAcceleratorPanel mlflowFaded={false} />
                    ) : (
                      <div className="flex flex-col gap-3">
                        {/* Genie module (TVF / Metric Views / Genie Spaces) */}
                        {showGenieModule && (
                          <div className="bg-slate-800 border-2 border-amber-500/60 rounded-lg p-3.5 shadow-lg">
                            <p className="text-ui-base font-bold text-amber-300 mb-2">Genie</p>
                            <div className="space-y-1.5">
                              <ServicePopover serviceKey="tvf" position="left" block>
                                <div className="bg-amber-900/30 rounded px-2.5 py-1.5 border border-amber-500/30 hover:bg-amber-900/50 hover:border-amber-400 transition-all duration-200 hover:scale-105">
                                  <p className="text-ui-xs font-semibold text-amber-200">Table Value Functions</p>
                                </div>
                              </ServicePopover>
                              <ServicePopover serviceKey="metricViews" position="left" block>
                                <div className="bg-amber-900/30 rounded px-2.5 py-1.5 border border-amber-500/30 hover:bg-amber-900/50 hover:border-amber-400 transition-all duration-200 hover:scale-105">
                                  <p className="text-ui-xs font-semibold text-amber-200">Metric Views</p>
                                </div>
                              </ServicePopover>
                              <ServicePopover serviceKey="genieSpaces" position="left" block>
                                <div className="bg-amber-900/30 rounded px-2.5 py-1.5 border border-amber-500/30 hover:bg-amber-900/50 hover:border-amber-400 transition-all duration-200 hover:scale-105">
                                  <p className="text-ui-xs font-semibold text-amber-200">Genie Spaces</p>
                                </div>
                              </ServicePopover>
                            </div>
                          </div>
                        )}

                        {/* AI/BI Dashboards + Agent -- hidden for Genie Accelerator and gated by chips */}
                        {!isGenie && (showDashboardModule || showAgentModule) && (<>
                          {showGenieModule && (
                            <div className="flex justify-center gap-2">
                              {showDashboardModule && <ArrowDown className="w-4 h-4 text-green-400" />}
                              {showAgentModule && <ArrowDown className="w-4 h-4 text-blue-400" />}
                            </div>
                          )}

                          <div className={`grid gap-2.5 ${showDashboardModule && showAgentModule ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            {showDashboardModule && (
                              <ServicePopover serviceKey="aiBIDashboards" position="top" block>
                                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-2.5 shadow-lg hover:shadow-green-500/30 hover:shadow-xl transition-all duration-200 hover:scale-105">
                                  <div className="flex flex-col items-center gap-1">
                                    <LayoutDashboard className="w-5 h-5 text-white" />
                                    <p className="text-ui-sm font-bold text-white text-center">AI/BI Dashboards</p>
                                  </div>
                                </div>
                              </ServicePopover>
                            )}

                            {showAgentModule && (
                              <ServicePopover serviceKey="agents" position="top" block>
                                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-2.5 shadow-lg hover:shadow-blue-500/30 hover:shadow-xl transition-all duration-200 hover:scale-105">
                                  <div className="flex flex-col items-center gap-1">
                                    <Bot className="w-5 h-5 text-white" />
                                    <p className="text-ui-sm font-bold text-white text-center">Agent</p>
                                  </div>
                                </div>
                              </ServicePopover>
                            )}
                          </div>
                        </>)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Legend */}
              <div className="mt-6 flex flex-wrap justify-center gap-5 md:gap-8">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[#FF3621]" />
                  <p className="text-ui-xs text-slate-400">Databricks Apps</p>
                </div>
                <div className="flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-violet-500" />
                  <p className="text-ui-xs text-slate-400">Lakebase</p>
                </div>
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-teal-500" />
                  <p className="text-ui-xs text-slate-400">Lakehouse</p>
                </div>
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-blue-500" />
                  <p className="text-ui-xs text-slate-400">AI and Agents</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  <p className="text-ui-xs text-slate-400">Click for details</p>
                </div>
              </div>

              {/* Column-aligned learning objectives -- text boxes below each section */}
              {hasAnyObjectives && (
                <div className="mt-5 flex gap-4 justify-center">
                  {/* Left: App & Database objectives */}
                  {appLakebaseFade.shouldRender && leftObjectives.length > 0 && (
                    <div className={`w-[13.75rem] flex-shrink-0 duration-300 ${fadeClass(appLakebaseFade.isVisible)}`}>
                      <div className="rounded-lg bg-slate-800/40 border border-[#FF3621]/20 p-3">
                        <ul className="space-y-1.5">
                          {leftObjectives.map((obj, idx) => (
                            <li
                              key={obj.id}
                              className={`flex items-start gap-1.5 text-ui-xs text-slate-300 transition-all duration-300 ease-out ${
                                bulletsRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
                              }`}
                              style={{ transitionDelay: bulletsRevealed ? `${idx * BULLET_STAGGER_MS}ms` : '0ms' }}
                            >
                              <span className="text-[#FF3621]/70 mt-0.5 shrink-0">&#x2022;</span>
                              <span>{obj.content}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Spacer matching arrow between left and next section */}
                  {showAppLakebase && leftObjectives.length > 0 && (showLakehouse || showDataIntel) && (
                    <div className="w-12 flex-shrink-0" />
                  )}

                  {/* Middle: Lakehouse objectives */}
                  {lakehouseFade.shouldRender && middleObjectives.length > 0 && (
                    <div className={`flex-1 duration-300 ${fadeClass(lakehouseFade.isVisible)}`}>
                      <div className="rounded-lg bg-slate-800/40 border border-teal-500/20 p-3">
                        <ul className="space-y-1.5">
                          {middleObjectives.map((obj, idx) => (
                            <li
                              key={obj.id}
                              className={`flex items-start gap-1.5 text-ui-xs text-slate-300 transition-all duration-300 ease-out ${
                                bulletsRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
                              }`}
                              style={{ transitionDelay: bulletsRevealed ? `${(middleStaggerOffset + idx) * BULLET_STAGGER_MS}ms` : '0ms' }}
                            >
                              <span className="text-teal-400/70 mt-0.5 shrink-0">&#x2022;</span>
                              <span>{obj.content}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Spacer matching arrow between middle and right */}
                  {showLakehouse && middleObjectives.length > 0 && showDataIntel && rightObjectives.length > 0 && (
                    <div className="w-12 flex-shrink-0" />
                  )}

                  {/* Right: AI and Agents objectives */}
                  {dataIntelFade.shouldRender && rightObjectives.length > 0 && (
                    <div className={`flex-1 duration-300 ${fadeClass(dataIntelFade.isVisible)}`}>
                      <div className="rounded-lg bg-slate-800/40 border border-blue-500/20 p-3">
                        <ul className="space-y-1.5">
                          {rightObjectives.map((obj, idx) => (
                            <li
                              key={obj.id}
                              className={`flex items-start gap-1.5 text-ui-xs text-slate-300 transition-all duration-300 ease-out ${
                                bulletsRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
                              }`}
                              style={{ transitionDelay: bulletsRevealed ? `${(rightStaggerOffset + idx) * BULLET_STAGGER_MS}ms` : '0ms' }}
                            >
                              <span className="text-blue-400/70 mt-0.5 shrink-0">&#x2022;</span>
                              <span>{obj.content}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {onStartBuild && (
            <div className="flex justify-end mt-4">
              <button
                onClick={onStartBuild}
                className="flex items-center gap-1.5 px-4 py-2 text-ui-sm font-medium text-muted-foreground hover:text-foreground bg-secondary/50 hover:bg-secondary rounded-full transition-all duration-200 group"
              >
                <span>Start the Build</span>
                <ArrowDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
