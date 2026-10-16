import { useMemo } from 'react';
import { Plug, ChevronRight } from 'lucide-react';
import { CopyButton } from './CopyButton';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import {
  GENIE_CODE_MCP_CONNECTION_STEPS,
  mcpUrlFromOrigin,
  startLineForSession,
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
    <p className="text-ui-base text-muted-foreground flex items-start gap-2">
      <ChevronRight className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" aria-hidden />
      <span className="min-w-0 flex-1">
        {lead}{' '}
        <span data-testid="start-line" className="font-semibold text-foreground break-all">
          &lsquo;{line}&rsquo;
        </span>
      </span>
      <CopyButton
        copied={copied}
        onClick={() => void handleCopy(line)}
        size="sm"
        className="flex-shrink-0 bg-secondary/60 text-foreground hover:bg-secondary"
      />
    </p>
  );
}

/**
 * Self-serve "Connect to Genie Code" on-ramp (D4 §1.1), shown in the Genie Code
 * detail panel of Choose Your Coding Assistant.
 *
 * Step copy comes from {@link GENIE_CODE_MCP_CONNECTION_STEPS} — the same source
 * locked to D10 §2 by the on-ramp Playwright suite. The start line names the
 * session's track and id, so Genie Code continues this session (session linking).
 */
export function ConnectToGenieCodePanel({
  workshopLevel,
  sessionId,
}: { workshopLevel?: string; sessionId?: string | null } = {}) {
  const mcpUrl = useMcpUrl();
  const { copied, handleCopy } = useCopyToClipboard();

  return (
    <section
      data-testid="connect-to-genie-code"
      id="connect-to-genie-code"
      className="bg-card rounded-lg border border-border overflow-hidden"
      aria-labelledby="connect-to-genie-code-heading"
    >
      <div className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-md bg-primary/20 flex-shrink-0">
            <Plug className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="connect-to-genie-code-heading"
              className="text-ui-md2 font-semibold text-foreground"
            >
              Connect to Genie Code
            </h2>
            <p className="text-muted-foreground text-ui-base mt-0.5">
              Paste this app&apos;s MCP URL into Genie Code — the one manual step. Everything after
              is server-driven.
            </p>
          </div>
        </div>

        <div className="rounded-md border border-border bg-secondary/30 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2">
          <code
            data-testid="mcp-url"
            className="flex-1 min-w-0 text-ui-sm font-mono text-foreground break-all"
          >
            {mcpUrl}
          </code>
          <CopyButton
            copied={copied}
            onClick={() => void handleCopy(mcpUrl)}
            size="sm"
            className="flex-shrink-0 self-start sm:self-auto bg-secondary/60 text-foreground hover:bg-secondary"
          />
        </div>

        <ol className="space-y-2.5 list-none m-0 p-0">
          {GENIE_CODE_MCP_CONNECTION_STEPS.map((step, index) => (
            <li key={step} className="flex items-start gap-2.5 text-ui-base text-muted-foreground">
              <span
                className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary text-ui-xs font-semibold flex items-center justify-center mt-0.5"
                aria-hidden
              >
                {index + 1}
              </span>
              <span className="text-foreground leading-snug">{step}</span>
            </li>
          ))}
        </ol>

        <div className="pt-1 border-t border-border space-y-1">
          <GenieCodeStartLine workshopLevel={workshopLevel} sessionId={sessionId} />
          <p className="text-ui-xs text-muted-foreground pl-6">
            It continues this session in Genie Code. You pick or change the track in Workshop Path.
          </p>
        </div>
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
