import { useMemo } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  ClipboardCopy,
  Plug,
  Sparkles,
  Star,
  Terminal,
  Zap,
} from 'lucide-react';
import { CopyButton } from './CopyButton';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import {
  GENIE_CODE_MCP_CONNECTION_STEPS,
  mcpUrlFromOrigin,
  startLineForSession,
  useGenieCodeMode,
} from '../constants/genieCodeMcpConnection';

/** The app's MCP endpoint, from the page's own origin. */
function useMcpUrl(): string {
  return useMemo(
    () => mcpUrlFromOrigin(typeof window !== 'undefined' ? window.location.origin : ''),
    [],
  );
}

/**
 * The line a learner says in Genie Code to continue this web session there
 * ({@link startLineForSession}), with a copy button. Shared by the Genie Code
 * on-ramp and the Set Up Project note.
 */
export function GenieCodeStartLine({
  workshopLevel,
  sessionId,
  lead = 'Then say',
}: {
  workshopLevel?: string;
  sessionId?: string | null;
  lead?: string;
}) {
  const line = startLineForSession(workshopLevel, sessionId);
  const { copied, handleCopy } = useCopyToClipboard();
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/[0.06] px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2.5">
      <p className="text-ui-base text-muted-foreground flex items-start gap-2 flex-1 min-w-0">
        <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" aria-hidden />
        <span className="min-w-0 flex-1">
          {lead}{' '}
          <span data-testid="start-line" className="font-semibold text-foreground break-all">
            &lsquo;{line}&rsquo;
          </span>
        </span>
      </p>
      <CopyButton
        copied={copied}
        onClick={() => void handleCopy(line)}
        size="sm"
        className="flex-shrink-0 self-start sm:self-auto bg-primary text-primary-foreground hover:opacity-90 font-medium"
      />
    </div>
  );
}

/**
 * Self-serve "Connect to Genie Code" on-ramp (D4 §1.1), shown in the Genie Code
 * detail panel of Choose Your Coding Assistant.
 *
 * Presents both ways to run the workshop with Genie Code:
 *   1. Interactive Mode (MCP Server) — Recommended; shows the 3 connection steps
 *   2. Copy & Paste Prompts Mode — standard step-by-step flow; shows no extra setup
 *      instructions here since the user simply clicks Continue and follows the app.
 */
export function ConnectToGenieCodePanel({
  workshopLevel,
  sessionId,
}: { workshopLevel?: string; sessionId?: string | null } = {}) {
  const mcpUrl = useMcpUrl();
  const { copied, handleCopy } = useCopyToClipboard();
  const [mode, setMode] = useGenieCodeMode();

  return (
    <section
      data-testid="connect-to-genie-code"
      id="connect-to-genie-code"
      className="bg-card rounded-xl border border-border overflow-hidden shadow-sm"
      aria-labelledby="connect-to-genie-code-heading"
    >
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30 flex-shrink-0">
              <Plug className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="connect-to-genie-code-heading"
                  className="text-ui-md2 font-semibold text-foreground"
                >
                  Connect to Genie Code
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 border border-primary/25 px-2.5 py-0.5 text-ui-3xs font-semibold text-primary">
                  <Sparkles className="w-3 h-3" /> 2 Ways to Run
                </span>
              </div>
              <p className="text-muted-foreground text-ui-sm mt-0.5">
                Choose how you want to run your workshop in Genie Code — hands-free via our live MCP server, or by copy-pasting prompts step by step.
              </p>
            </div>
          </div>
        </div>

        {/* Two-Mode Interactive Selector Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" role="radiogroup" aria-label="Genie Code operating mode">
          {/* Option 1: Interactive MCP Mode (Recommended) */}
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'mcp'}
            onClick={() => setMode('mcp')}
            className={`text-left rounded-xl p-4 border-2 transition-all relative overflow-hidden ${
              mode === 'mcp'
                ? 'border-primary bg-primary/[0.06] ring-2 ring-primary/20 shadow-sm'
                : 'border-border/80 bg-background/50 hover:border-primary/40 hover:bg-secondary/30'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-primary/15 text-primary inline-flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </span>
                <span className="text-ui-base font-bold text-foreground">
                  Interactive Mode (MCP Server)
                </span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/35 px-2 py-0.5 text-ui-3xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                <Star className="w-2.5 h-2.5 fill-current" /> Recommended
              </span>
            </div>
            <p className="text-ui-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Zero copy-pasting.</strong> Connect Genie Code once to this app&apos;s MCP URL. Genie Code automatically walks you through every step in chat and syncs progress back here.
            </p>
            <div className="mt-2.5 flex items-center gap-3 text-ui-2xs font-medium text-primary">
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> ~30 sec one-time link
              </span>
              <span>·</span>
              <span>Server-driven autopilot</span>
            </div>
          </button>

          {/* Option 2: Copy & Paste Prompts Mode */}
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'copy-paste'}
            onClick={() => setMode('copy-paste')}
            className={`text-left rounded-xl p-4 border-2 transition-all relative overflow-hidden ${
              mode === 'copy-paste'
                ? 'border-violet-500 bg-violet-500/[0.06] ring-2 ring-violet-500/20 shadow-sm'
                : 'border-border/80 bg-background/50 hover:border-violet-500/40 hover:bg-secondary/30'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-300 inline-flex items-center justify-center">
                  <ClipboardCopy className="w-4 h-4" />
                </span>
                <span className="text-ui-base font-bold text-foreground">
                  Copy &amp; Paste Prompts Mode
                </span>
              </div>
              <span className="rounded-full bg-secondary border border-border px-2 py-0.5 text-ui-3xs font-semibold uppercase tracking-wider text-muted-foreground">
                Default flow
              </span>
            </div>
            <p className="text-ui-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Classic step-by-step control.</strong> Just click Continue below and follow the guided steps on this page to copy and paste each prompt into Genie Code.
            </p>
            <div className="mt-2.5 flex items-center gap-3 text-ui-2xs font-medium text-violet-600 dark:text-violet-300">
              <span className="inline-flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5" /> No MCP setup required
              </span>
              <span>·</span>
              <span>Click Continue to proceed</span>
            </div>
          </button>
        </div>

        {/* Interactive MCP Setup Steps — shown ONLY when Interactive Mode (MCP Server) is selected */}
        {mode === 'mcp' && (
          <div className="rounded-xl border border-primary/30 bg-background/60 p-4 space-y-4">
            <div>
              <p className="text-ui-xs font-bold uppercase tracking-wider text-primary">
                Quick 3-Step Interactive MCP Setup
              </p>
              <p className="text-ui-xs text-muted-foreground mt-0.5">
                Paste this app&apos;s MCP URL into Genie Code — the one manual step. Everything after is server-driven.
              </p>
            </div>

            {/* Step A: Copy MCP URL */}
            <div className="rounded-xl border border-border bg-card px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2.5 shadow-2xs">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="px-2 py-0.5 rounded bg-primary/15 text-primary text-ui-3xs font-bold uppercase tracking-wider shrink-0">
                  MCP URL
                </span>
                <code
                  data-testid="mcp-url"
                  className="flex-1 min-w-0 text-ui-sm font-mono text-foreground break-all"
                >
                  {mcpUrl}
                </code>
              </div>
              <CopyButton
                copied={copied}
                onClick={() => void handleCopy(mcpUrl)}
                size="sm"
                className="flex-shrink-0 self-start sm:self-auto bg-secondary hover:bg-secondary/80 text-foreground font-medium"
              />
            </div>

            {/* Step B: The 3 Connection Steps (exact D10 §2 strings preserved) */}
            <ol className="grid grid-cols-1 md:grid-cols-3 gap-2.5 list-none m-0 p-0">
              {GENIE_CODE_MCP_CONNECTION_STEPS.map((step, index) => (
                <li
                  key={step}
                  className="rounded-xl border border-border/80 bg-card/80 p-3 flex items-start gap-2.5 text-ui-sm text-muted-foreground"
                >
                  <span
                    className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary text-ui-xs font-bold flex items-center justify-center mt-0.5"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <span className="text-foreground leading-snug text-ui-xs font-medium">{step}</span>
                </li>
              ))}
            </ol>

            {/* Step C: Say the 1-line starter prompt */}
            <div className="pt-1 space-y-1.5">
              <GenieCodeStartLine workshopLevel={workshopLevel} sessionId={sessionId} />
              <p className="text-ui-xs text-muted-foreground pl-2">
                It continues this session in Genie Code. You pick or change the track in Workshop Path, and progress syncs automatically between Genie Code and this page.
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/** Compact MCP URL copy chip for the collapsed / locked assistant selector. */
export function McpUrlChip() {
  const mcpUrl = useMcpUrl();
  const { copied, handleCopy } = useCopyToClipboard();
  return (
    <span data-testid="mcp-url-chip" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-2 py-0.5">
      <code className="text-ui-2xs font-mono text-muted-foreground max-w-[18rem] truncate">{mcpUrl}</code>
      <CopyButton
        copied={copied}
        onClick={() => void handleCopy(mcpUrl)}
        size="sm"
        className="bg-transparent text-muted-foreground hover:text-foreground"
      />
    </span>
  );
}
