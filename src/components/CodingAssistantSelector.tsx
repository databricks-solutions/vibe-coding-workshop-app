import { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, CheckCircle, ExternalLink, Download, Sparkles, Terminal, Lock } from 'lucide-react';
import { BorderBeamButton } from './BorderBeamButton';
import { AiGatewaySetupGuide } from './AiGatewaySetupGuide';
import {
  parseCodingAssistantsConfig,
  type AssistantId,
  type CodingAssistantConfigEntry,
} from '../constants/codingAssistants';
import { apiClient } from '../api/client';

// ---------------------------------------------------------------------------
// Brand SVG icons
// ---------------------------------------------------------------------------

function CursorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="5" fill="currentColor" fillOpacity="0.15" />
      <path d="M6 4L18 12L12 13.5L9.5 19.5L6 4Z" fill="currentColor" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function CopilotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.49.5.09.682-.218.682-.484 0-.236-.009-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.268 2.75 1.026A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.026 2.747-1.026.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .269.18.579.688.481C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
    </svg>
  );
}

function VSCodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.583 2.006L9.89 8.65 5.307 5.163l-1.87.91v11.854l1.87.91 4.583-3.487L17.583 22l3.98-1.94V3.945l-3.98-1.94zM5.437 14.27V9.73l2.926 2.27-2.926 2.27zm12.146 3.558l-5.708-5.828 5.708-5.828v11.656z" />
    </svg>
  );
}

function DatabricksIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 8.573l9 5.204v4.896L3 13.47V8.573zM12 2L3 7.204l9 5.204 9-5.204L12 2zm9 6.573l-9 5.204v4.896l9-5.204V8.573zM3 14.896l9 5.204 9-5.204v1.574L12 21.673 3 16.47v-1.574z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Assistant data with richer detail
// ---------------------------------------------------------------------------

interface AssistantOption {
  id: AssistantId;
  name: string;
  tagline: string;
  detail: string;
  features: string[];
  url: string;
  downloadLabel: string;
  comingSoon: boolean;
  iconColor: string;
  iconBg: string;
  selectedBorder: string;
  selectedRing: string;
  selectedBg: string;
  icon: React.ComponentType<{ className?: string }>;
}

const ASSISTANTS: AssistantOption[] = [
  {
    id: 'cursor',
    name: 'Cursor',
    tagline: 'AI-first code editor',
    detail: 'A powerful AI-first code editor built on VS Code. Cursor understands your entire codebase and can generate, edit, and debug code with natural language.',
    features: ['Built-in AI chat & code generation', 'Full VS Code extension support', 'Codebase-aware completions'],
    url: 'https://cursor.com',
    downloadLabel: 'Download Cursor',
    comingSoon: false,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/15',
    selectedBorder: 'border-blue-500/60',
    selectedRing: 'ring-blue-500/30',
    selectedBg: 'bg-blue-500/5',
    icon: CursorIcon,
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot',
    tagline: 'AI pair programmer',
    detail: 'GitHub Copilot is an AI pair programmer that integrates into VS Code and other editors. It suggests whole lines and entire functions in real time.',
    features: ['Real-time code suggestions', 'Multi-language support', 'Works inside VS Code & JetBrains'],
    url: 'https://github.com/features/copilot',
    downloadLabel: 'Get GitHub Copilot',
    comingSoon: false,
    iconColor: 'text-purple-400',
    iconBg: 'bg-purple-500/15',
    selectedBorder: 'border-purple-500/60',
    selectedRing: 'ring-purple-500/30',
    selectedBg: 'bg-purple-500/5',
    icon: CopilotIcon,
  },
  {
    id: 'vscode',
    name: 'VS Code',
    tagline: 'Lightweight code editor',
    detail: 'Visual Studio Code is a free, open-source code editor by Microsoft. Pair it with extensions like GitHub Copilot for AI-assisted coding.',
    features: ['Rich extension marketplace', 'Integrated terminal & debugger', 'Git integration built-in'],
    url: 'https://code.visualstudio.com',
    downloadLabel: 'Download VS Code',
    comingSoon: false,
    iconColor: 'text-sky-400',
    iconBg: 'bg-sky-500/15',
    selectedBorder: 'border-sky-500/60',
    selectedRing: 'ring-sky-500/30',
    selectedBg: 'bg-sky-500/5',
    icon: VSCodeIcon,
  },
  {
    id: 'ai-gateway',
    name: 'VS Code + Databricks AI Gateway',
    tagline: 'Claude Code routed through Databricks AI Gateway',
    detail: 'Use VS Code with the Claude Code CLI, routed through a Databricks AI Gateway endpoint. Governed model access, per-user quotas, and usage tracking — no direct Anthropic account required.',
    features: [
      'Governed model access via AI Gateway',
      'Per-user quotas and usage tracking',
      'Works in the VS Code integrated terminal',
    ],
    url: 'https://docs.databricks.com/aws/en/mlflow3/genai/tracing/integrations/claude-code',
    downloadLabel: 'Open Docs',
    comingSoon: false,
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-500/15',
    selectedBorder: 'border-emerald-500/60',
    selectedRing: 'ring-emerald-500/30',
    selectedBg: 'bg-emerald-500/5',
    icon: VSCodeIcon,
  },
  {
    id: 'coda',
    name: 'CoDA',
    tagline: 'Coding agents in your browser on Databricks Apps',
    detail:
      'CoDA (Coding agents on Databricks Apps) runs Claude Code, Codex, Gemini CLI, and OpenCode directly in your browser — no local install required. Deploy once to your Databricks workspace and every agent comes wired to the AI Gateway with governed model access, MLflow session tracing, and Unity Catalog-scoped permissions out of the box.',
    features: [
      'Claude Code, Codex, Gemini CLI & OpenCode in one browser terminal',
      'Databricks AI Gateway with auto-rotating PAT (10-min cycle)',
      '39 pre-installed skills + automatic MLflow tracing per session',
    ],
    url: 'https://github.com/datasciencemonkey/coding-agents-databricks-apps/blob/main/docs/deployment.md',
    downloadLabel: 'Deploy to Databricks Apps',
    comingSoon: false,
    iconColor: 'text-orange-400',
    iconBg: 'bg-orange-500/15',
    selectedBorder: 'border-orange-500/60',
    selectedRing: 'ring-orange-500/30',
    selectedBg: 'bg-orange-500/5',
    icon: Terminal,
  },
  {
    id: 'genie-code',
    name: 'Genie Code',
    tagline: 'AI partner for data work',
    detail: 'Genie Code is an autonomous AI partner purpose-built for data work in Databricks, deeply integrated with Unity Catalog for contextual awareness.',
    features: ['Unity Catalog integration', 'Agentic data workflows', 'Built into Databricks platform'],
    url: 'https://docs.databricks.com/aws/en/genie-code/',
    downloadLabel: 'Learn More',
    comingSoon: true,
    iconColor: 'text-cyan-400',
    iconBg: 'bg-cyan-500/15',
    selectedBorder: 'border-cyan-500/60',
    selectedRing: 'ring-cyan-500/30',
    selectedBg: 'bg-cyan-500/5',
    icon: Sparkles,
  },
];

function getDisplayName(assistantId: string): string {
  return ASSISTANTS.find(a => a.id === assistantId)?.name ?? assistantId;
}

function getAssistant(id: string): AssistantOption | undefined {
  return ASSISTANTS.find(a => a.id === id);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CodingAssistantSelectorProps {
  selectedAssistant: string | null;
  onSelect: (assistantId: string) => void;
  onConfirm: () => void;
  forceExpanded?: boolean;
  forceCollapsed?: boolean;
  hideConfirm?: boolean;
  highlightConfirm?: boolean;
  /** When true, the selection is locked for this session -- cards are disabled and Continue is hidden */
  isLocked?: boolean;
}

export function CodingAssistantSelector({
  selectedAssistant,
  onSelect,
  onConfirm,
  forceExpanded = false,
  forceCollapsed = false,
  hideConfirm = false,
  highlightConfirm = false,
  isLocked = false,
}: CodingAssistantSelectorProps) {
  const [userOverride, setUserOverride] = useState<boolean | null>(null);
  const prevForceCollapsed = useRef(forceCollapsed);

  useEffect(() => {
    if (forceCollapsed && !prevForceCollapsed.current) setUserOverride(null);
    prevForceCollapsed.current = forceCollapsed;
  }, [forceCollapsed]);

  // ------------------------------------------------------------------------
  // Admin-configured visibility / order / recommended state.
  // `null` means "not yet loaded" — we render the full hardcoded catalog with
  // no badges in that case (matches today's UX; no flicker).
  // ------------------------------------------------------------------------
  const [config, setConfig] = useState<CodingAssistantConfigEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .getWorkshopParametersDict()
      .then(dict => {
        if (cancelled) return;
        const parsed = parseCodingAssistantsConfig(dict?.coding_assistants_config);
        // Any parse failure / missing key -> empty array, which triggers the
        // "fallback to full catalog" branch below.
        setConfig(parsed ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setConfig([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const orderedAssistants = useMemo(() => {
    type OrderedEntry = { assistant: AssistantOption; recommended: boolean };
    // Fallback: nothing configured yet OR empty/invalid config -> full catalog, no badges.
    if (!config || config.length === 0) {
      return ASSISTANTS.map<OrderedEntry>(a => ({ assistant: a, recommended: false }));
    }
    const byId = new Map(ASSISTANTS.map(a => [a.id, a] as const));
    const ordered: OrderedEntry[] = [];
    for (const entry of config) {
      const assistant = byId.get(entry.id as AssistantId);
      if (!assistant) continue;
      ordered.push({ assistant, recommended: !!entry.recommended });
    }
    // Safety net: if the user has an assistant selected that the admin has
    // since hidden, append it so saved / shared sessions don't show a broken
    // "nothing selected" state. No badge — it's a grandfathered card.
    if (selectedAssistant && !ordered.some(o => o.assistant.id === selectedAssistant)) {
      const extra = byId.get(selectedAssistant as AssistantId);
      if (extra) {
        ordered.push({ assistant: extra, recommended: false });
      }
    }
    return ordered;
  }, [config, selectedAssistant]);

  const isExpanded = forceExpanded ? true : (userOverride ?? false);
  const isComplete = !!selectedAssistant;
  const selected = selectedAssistant ? getAssistant(selectedAssistant) : null;
  // Bug fix: when 'ai-gateway' is selected, the inline AiGatewaySetupGuide
  // pushes the collapsible body past the default 800px cap, clipping the
  // Continue button. Only this one option gets the looser cap so the collapse
  // animation on the other assistants stays snappy (see #ai-gateway-continue).
  const expandedMaxH =
    selected?.id === 'ai-gateway' ? 'max-h-[1200px]' : 'max-h-[800px]';

  const handleConfirm = () => {
    setUserOverride(false);
    onConfirm();
  };

  return (
    <div
      id="coding-assistant-section"
      className={`bg-card rounded-lg border overflow-hidden ${
        isComplete
          ? 'border-emerald-700/50'
          : highlightConfirm
            ? 'border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
            : 'border-border'
      }`}
    >
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <button
          onClick={() => setUserOverride(!isExpanded)}
          className="flex items-center gap-3 flex-1 hover:bg-secondary/30 transition-colors cursor-pointer rounded-md -m-2 p-2"
        >
          <div className={`p-2 rounded-md ${isComplete ? 'bg-emerald-900/40' : 'bg-blue-900/40'}`}>
            {isComplete && selected ? (
              <selected.icon className={`w-5 h-5 text-emerald-300`} />
            ) : (
              <DatabricksIcon className="w-5 h-5 text-blue-300" />
            )}
          </div>
          <div className="flex-1 text-left">
            <div className="flex items-center gap-2">
              <h2 className={`text-ui-md2 font-semibold text-foreground ${isComplete ? 'line-through opacity-60' : ''}`}>
                Choose Your Coding Assistant
              </h2>
              {isComplete && (
                <span className="text-emerald-400 text-ui-xs font-medium bg-emerald-900/30 px-1.5 py-0.5 rounded">
                  ✓ {getDisplayName(selectedAssistant!)}
                </span>
              )}
            </div>
            <p className={`text-muted-foreground text-ui-base ${isComplete ? 'line-through opacity-60' : ''}`}>
              Select the AI coding tool you'll use during this workshop
            </p>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          />
        </button>

        {!hideConfirm && isComplete && !isExpanded && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-ui-sm font-medium animate-fade-in">
            <CheckCircle className="w-3.5 h-3.5" /> Completed
          </div>
        )}
      </div>

      {/* Collapsible Content */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          isExpanded ? `${expandedMaxH} opacity-100` : 'max-h-0 opacity-0 overflow-hidden'
        }`}
      >
        <div className="px-4 pb-4 space-y-3">
          {/* Option cards */}
          <div className="flex flex-wrap gap-2">
            {orderedAssistants.map(({ assistant, recommended }) => {
              const isSelected = selectedAssistant === assistant.id;
              const isDisabled = assistant.comingSoon || isLocked;
              const Icon = assistant.icon;

              return (
                <button
                  key={assistant.id}
                  onClick={() => { if (!isDisabled) onSelect(assistant.id); }}
                  disabled={isDisabled}
                  className={`relative flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-all ${
                    isSelected && isLocked
                      ? `${assistant.selectedBorder} ring-1 ${assistant.selectedRing} ${assistant.selectedBg} cursor-default`
                      : isDisabled
                        ? 'border-border/40 opacity-40 cursor-not-allowed'
                        : isSelected
                          ? `${assistant.selectedBorder} ring-1 ${assistant.selectedRing} ${assistant.selectedBg}`
                          : 'border-border hover:border-muted-foreground/50 hover:bg-secondary/20 cursor-pointer'
                  }`}
                >
                  <div className={`p-1.5 rounded-md ${isSelected ? assistant.iconBg : 'bg-secondary/60'}`}>
                    <Icon className={`w-4 h-4 ${isSelected ? assistant.iconColor : 'text-muted-foreground'}`} />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-ui-base font-medium ${isSelected ? 'text-foreground' : 'text-foreground/80'}`}>
                        {assistant.name}
                      </span>
                      {isSelected && <CheckCircle className={`w-3.5 h-3.5 ${assistant.iconColor}`} />}
                      {recommended && (
                        <span
                          className="inline-flex items-center gap-1 text-ui-3xs font-semibold uppercase tracking-[0.08em] px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/15 to-amber-400/10 text-amber-200 border border-amber-400/30 whitespace-nowrap shadow-[inset_0_0_0_1px_rgba(251,191,36,0.05)]"
                          title="Recommended"
                        >
                          <Sparkles className="w-2.5 h-2.5" />
                          Recommended
                        </span>
                      )}
                    </div>
                    <span className="text-ui-2xs text-muted-foreground">{assistant.tagline}</span>
                  </div>
                  {assistant.comingSoon && (
                    <span className="ml-auto text-ui-3xs font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300/80 border border-amber-700/30 whitespace-nowrap">
                      Soon
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Detail panel for selected assistant */}
          {selected && (
            <div className={`rounded-lg border ${selected.selectedBorder} ${selected.selectedBg} overflow-hidden transition-all duration-200`}>
              <div className="p-4">
                <div className="flex items-start gap-4">
                  {/* Icon + name */}
                  <div className={`p-3 rounded-xl ${selected.iconBg} flex-shrink-0`}>
                    <selected.icon className={`w-7 h-7 ${selected.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-ui-md font-semibold text-foreground">{selected.name}</h3>
                    <p className="text-ui-sm text-muted-foreground mt-1 leading-relaxed">{selected.detail}</p>

                    {/* Features */}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                      {selected.features.map((feature, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className={`w-1 h-1 rounded-full ${selected.iconColor.replace('text-', 'bg-')}`} />
                          <span className="text-ui-xs text-muted-foreground">{feature}</span>
                        </div>
                      ))}
                    </div>

                    {/* Download CTA */}
                    <div className="mt-4 flex items-center gap-3">
                      <a
                        href={selected.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-ui-sm font-medium transition-colors ${selected.iconBg} ${selected.iconColor} hover:opacity-80 border ${selected.selectedBorder}`}
                      >
                        <Download className="w-3.5 h-3.5" />
                        {selected.downloadLabel}
                      </a>
                      <a
                        href={selected.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-ui-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Visit website
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Inline setup guide — only for the AI Gateway assistant */}
          {selected?.id === 'ai-gateway' && <AiGatewaySetupGuide />}

          {/* Prompt to select if nothing chosen yet */}
          {!selected && (
            <div className="flex items-center justify-center py-3 text-ui-sm text-muted-foreground/60">
              Select a coding assistant above to see details and download links
            </div>
          )}

          {/* Locked notice */}
          {isLocked && isExpanded && selected && (
            <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-slate-800/50 border border-slate-700/40 text-ui-xs text-muted-foreground">
              <Lock className="w-3 h-3 flex-shrink-0" />
              <span>Locked for this session. Start a new session to change your coding assistant.</span>
            </div>
          )}

          {/* Bottom continue bar */}
          {!hideConfirm && !isLocked && isExpanded && selectedAssistant && (
            <div className="pt-3 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle className="w-3.5 h-3.5" />
                <span className="text-ui-sm">
                  Ready with <strong>{getDisplayName(selectedAssistant)}</strong> — continue to prerequisites.
                </span>
              </div>
              <BorderBeamButton
                active={highlightConfirm}
                onClick={handleConfirm}
                className="text-ui-sm font-medium px-5 py-2"
              >
                Continue
              </BorderBeamButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
