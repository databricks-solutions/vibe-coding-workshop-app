/**
 * SetUpProjectStep Component
 *
 * Workflow Step 2: Set Up Project
 *
 * Renders one of three instructional variants based on the user-selected
 * coding assistant (no LLM processing in any variant):
 *
 *   - 'desktop' (default for cursor / copilot / vscode / ai-gateway / null /
 *     unknown): Clone Repository + Open in Editor + Configure AI Model +
 *     Configure Databricks Auth. Uses workspace_url from Workshop Parameters
 *     for the auth login command.
 *   - 'coda':        Single clone command. CoDA runs in a Databricks App
 *                    browser terminal so auth + model are already wired.
 *   - 'genie-code':  Single clone command targeting /Workspace/Users/<email>/
 *                    .assistant/skills/vibe-coding-workshop with the email
 *                    auto-injected from apiClient.getCurrentUser().
 */

import { useState, useEffect } from 'react';
import { GitBranch, Copy, Check, CheckCircle, ChevronDown, ChevronUp, ExternalLink, RefreshCw, Sparkles, Terminal } from 'lucide-react';
import { BorderBeamButton } from './BorderBeamButton';
import { useReadOnly } from '../contexts/ReadOnlyContext';

interface SetUpProjectStepProps {
  isComplete: boolean;
  onMarkComplete: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isPreviousStepComplete: boolean;
  refreshKey?: number;
  onStepReset?: () => void;
  sessionId?: string | null;
  useCaseLabel?: string;
  /**
   * The user-selected coding assistant (from CodingAssistantSelector / session).
   * Drives which body variant renders inside the Set Up Project card:
   *   - 'coda'       -> CoDA simplified body (clone only; auth + model already wired)
   *   - 'genie-code' -> Genie Code simplified body (/Workspace path with auto-injected email)
   *   - anything else (cursor / copilot / vscode / ai-gateway / null / unknown)
   *                  -> Desktop default body (A. clone + B. model + C. auth)
   */
  codingAssistant?: string | null;
  /**
   * The signed-in user's email (already fetched once at the App level via
   * apiClient.getCurrentUser). Only consumed by the Genie Code variant to
   * build the /Workspace/Users/<email>/.assistant/skills/vibe-coding-workshop
   * clone target. Falls back to '<your_email>' placeholder when null / empty.
   */
  currentUserEmail?: string | null;
}

type SetUpProjectVariant = 'coda' | 'genie-code' | 'desktop';

function resolveVariant(codingAssistant?: string | null): SetUpProjectVariant {
  if (codingAssistant === 'coda') return 'coda';
  if (codingAssistant === 'genie-code') return 'genie-code';
  return 'desktop';
}

const DEFAULT_FOLDER = 'vibe-coding-workshop-template';
const REPO_URL = 'https://github.com/databricks-solutions/vibe-coding-workshop-template.git';

function deriveFolderName(label?: string): string {
  if (!label || !label.trim()) return DEFAULT_FOLDER;
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || DEFAULT_FOLDER;
}

// Default workspace URL (fallback if API fails)
const DEFAULT_WORKSPACE_URL = '';

// Helper function to render description with basic formatting
function renderDescription(text: string): React.ReactNode {
  // Guard against null/undefined
  if (!text) return null;
  const paragraphs = text.split(/\n\n+/);
  
  return paragraphs.map((paragraph, pIdx) => {
    const lines = paragraph.split('\n');
    
    return (
      <div key={pIdx} className={pIdx > 0 ? 'mt-2' : ''}>
        {lines.map((line, lIdx) => {
          // Process bold text (**text**)
          const parts = line.split(/(\*\*[^*]+\*\*)/g);
          const processedLine = parts.map((part, partIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={partIdx} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>;
            }
            // Process inline code (`code`)
            const codeParts = part.split(/(`[^`]+`)/g);
            return codeParts.map((codePart, codeIdx) => {
              if (codePart.startsWith('`') && codePart.endsWith('`')) {
                return (
                  <code key={`${partIdx}-${codeIdx}`} className="bg-background/80 px-1 py-0.5 rounded text-primary font-mono text-ui-xs">
                    {codePart.slice(1, -1)}
                  </code>
                );
              }
              return codePart;
            });
          });
          
          return (
            <span key={lIdx}>
              {processedLine}
              {lIdx < lines.length - 1 && <br />}
            </span>
          );
        })}
      </div>
    );
  });
}

// Command box with copy functionality
function CommandBox({ label, cmd, copiedKey, onCopy }: { 
  label: string; 
  cmd: string; 
  copiedKey: string;
  onCopy: (key: string, cmd: string) => void;
}) {
  const isCopied = copiedKey === `${label}-${cmd}`;
  
  return (
    <div className="flex items-center gap-2 bg-slate-900/70 rounded-lg px-3 py-2 border border-slate-700/50">
      <code className="flex-1 text-emerald-400 font-mono text-xs break-all">
        {cmd}
      </code>
      <button
        onClick={() => onCopy(`${label}-${cmd}`, cmd)}
        className="flex-shrink-0 p-1.5 rounded hover:bg-slate-700/50 transition-colors"
        title={isCopied ? "Copied!" : "Copy command"}
      >
        {isCopied ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <Copy className="w-3.5 h-3.5 text-slate-400" />
        )}
      </button>
    </div>
  );
}


// Link button component
function LinkButton({ label, url, color }: { label: string; url: string; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-900/30 text-blue-300 hover:bg-blue-900/50 border border-blue-700/30',
    purple: 'bg-purple-900/30 text-purple-300 hover:bg-purple-900/50 border border-purple-700/30',
    green: 'bg-emerald-900/30 text-emerald-300 hover:bg-emerald-900/50 border border-emerald-700/30',
    orange: 'bg-orange-900/30 text-orange-300 hover:bg-orange-900/50 border border-orange-700/30',
  };
  
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${colorClasses[color] || colorClasses.blue}`}
    >
      {label}
      <ExternalLink className="w-3 h-3" />
    </a>
  );
}

export function SetUpProjectStep({
  isComplete,
  onMarkComplete,
  isExpanded,
  onToggleExpand,
  isPreviousStepComplete,
  refreshKey = 0,
  onStepReset,
  sessionId,
  useCaseLabel,
  codingAssistant,
  currentUserEmail,
}: SetUpProjectStepProps) {
  const readOnly = useReadOnly();
  const folderName = deriveFolderName(useCaseLabel);
  const cloneCmd = `git clone ${REPO_URL} ${folderName}`;
  const variant = resolveVariant(codingAssistant);

  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [workspaceUrl, setWorkspaceUrl] = useState<string>(DEFAULT_WORKSPACE_URL);
  const [isReloading, setIsReloading] = useState(false);

  const fetchWorkspaceUrl = async () => {
    try {
      if (sessionId) {
        const response = await fetch(`/api/session/${sessionId}/parameters`);
        if (response.ok) {
          const params = await response.json();
          const wsParam = params.find((p: { param_key: string }) => p.param_key === 'workspace_url');
          if (wsParam?.param_value) {
            setWorkspaceUrl(wsParam.param_value);
            return;
          }
        }
      }
      const response = await fetch('/api/config/workshop-parameters/workspace_url');
      if (response.ok) {
        const data = await response.json();
        if (data.param_value) {
          setWorkspaceUrl(data.param_value);
        }
      }
    } catch {
      // Falls back to default workspace URL
    }
  };

  // Re-fetch workspace URL when refreshKey or sessionId changes so the
  // Desktop variant's auth login command stays current with the active
  // session / workshop parameters. The Genie Code variant's email comes
  // in as a prop from App.tsx (no extra API call needed here).
  useEffect(() => {
    fetchWorkspaceUrl();
  }, [refreshKey, sessionId]);

  const handleReload = async () => {
    setIsReloading(true);
    onStepReset?.();
    await fetchWorkspaceUrl();
    setIsReloading(false);
  };

  const handleCopyCommand = async (key: string, command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCommand(key);
      setTimeout(() => setCopiedCommand(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className={`bg-card border rounded-xl overflow-hidden transition-all duration-300 ${
      isComplete ? 'border-emerald-500/30' : 'border-border'
    }`}>
      {/* Header - Always visible */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/30 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isComplete ? 'bg-emerald-900/40 text-emerald-300' : 'bg-orange-900/40 text-orange-300'}`}>
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <h3 className={`font-semibold ${isComplete ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              Set Up Project
            </h3>
            <p className="text-sm text-muted-foreground">
              {variant === 'coda'
                ? 'Clone the workshop template into your CoDA browser terminal'
                : variant === 'genie-code'
                  ? 'Clone the workshop template into your Databricks /Workspace path'
                  : 'Clone the template repository and configure Databricks authentication'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {!readOnly && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleReload();
              }}
              disabled={isReloading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-ui-sm font-medium rounded bg-emerald-900/40 text-emerald-300 hover:bg-emerald-900/60 transition-all group"
              title="Reload with latest parameters"
            >
              <RefreshCw className={`w-3 h-3 ${isReloading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-300'}`} />
              Reload
            </button>
          )}

          {isComplete ? (
            <span className="flex items-center gap-1.5 text-emerald-400 text-sm font-medium bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-lg animate-fade-in">
              <CheckCircle className="w-3.5 h-3.5" />
              Done
            </span>
          ) : !readOnly ? (
            <BorderBeamButton
              active={isPreviousStepComplete}
              onClick={(e) => {
                e.stopPropagation();
                onMarkComplete();
              }}
              disabled={!isPreviousStepComplete}
              className="px-4 py-1.5 text-sm"
            >
              Done
            </BorderBeamButton>
          ) : null}
          
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
      </div>
      
      {/* Expandable Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-6 border-t border-border pt-4">
          {/* Prerequisite hint */}
          {!isPreviousStepComplete && !isComplete && (
            <div className="px-3 py-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-ui-sm flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Select an industry and use case in &quot;Define Your Intent&quot; to get started
            </div>
          )}

          {/* ===========================================================
               VARIANT 1: DESKTOP (default)
               Applies to: cursor / copilot / vscode / ai-gateway / null / unknown.
               Three sub-sections (A. Clone, B. Model, C. Auth) -- unchanged.
               =========================================================== */}
          {variant === 'desktop' && (
          <>
          {/* Sub-section A: Clone the repository */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-orange-900/50 text-orange-300 flex items-center justify-center text-xs font-bold">
                A
              </div>
              <h4 className="font-semibold text-foreground">Clone the repository</h4>
            </div>
            
            <div className="pl-8 space-y-4">
              <div className="text-sm text-muted-foreground space-y-2">
                {renderDescription(`Clone the workshop template repository from GitHub to get started.

**Step 1:** Open a terminal:
- **Windows:** Press Win + R, type cmd or powershell, press Enter. Or use Git Bash.
- **macOS:** Press Cmd + Space, type Terminal, press Enter.

**Step 2:** Navigate to your preferred directory, then run the clone command.`)}
              </div>
              
              {/* Commands */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Commands</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Navigate to folder</p>
                    <CommandBox 
                      label="Navigate" 
                      cmd="cd ~/Documents" 
                      copiedKey={copiedCommand || ''} 
                      onCopy={handleCopyCommand} 
                    />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Clone the repository</p>
                    <CommandBox 
                      label="Clone" 
                      cmd={cloneCmd} 
                      copiedKey={copiedCommand || ''} 
                      onCopy={handleCopyCommand} 
                    />
                  </div>
                </div>
              </div>
              
              {/* Open in Editor */}
              <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                <p className="text-sm font-medium text-blue-300 mb-3">Open in Code Editor</p>
                
                <div className="mb-4">
                  <p className="text-xs font-medium text-emerald-400 uppercase tracking-wide mb-2">Open the cloned project</p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {renderDescription(`**1.** Open **Cursor** or **VS Code** from your Applications folder or Start Menu

**2.** Go to **File → Open Folder** (or press Cmd/Ctrl+O)

**3.** Navigate to the cloned folder: \`${folderName}\`

**4.** Click **Open** to load the project`)}
                  </div>
                  <p className="text-xs text-slate-500 mt-2 italic">
                    Tip: If you don't see files, click View → Explorer (Cmd/Ctrl+Shift+E)
                  </p>
                </div>
              </div>
              
              {/* Links */}
              <div className="flex flex-wrap gap-2 mt-3">
                <LinkButton label="View Repository" url="https://github.com/databricks-solutions/vibe-coding-workshop-template" color="orange" />
                <LinkButton label="Git Troubleshooting" url="https://docs.github.com/en/get-started/getting-started-with-git/set-up-git" color="blue" />
              </div>
            </div>
          </div>
          
          {/* Divider */}
          <div className="border-t border-border/50 my-4" />
          
          {/* Sub-section B: Configure Claude Model */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-red-900/50 text-red-300 flex items-center justify-center text-xs font-bold">
                B
              </div>
              <h4 className="font-semibold text-foreground">Configure AI Assistant Model</h4>
            </div>
            
            <div className="pl-8 space-y-4">
              {/* Important Notice */}
              <div className="p-4 bg-red-900/20 border border-red-600/40 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-600 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">!</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-300 mb-2">
                      IMPORTANT: Set the Default Model to Claude
                    </p>
                    <div className="text-sm text-muted-foreground space-y-2">
                      {renderDescription(`Make sure you set the default model used by the agent to the **latest version of Claude** (e.g., \`claude-4.5-opus-high\` or newer).

In **Cursor**, click on the model selector in the Agent panel and choose the latest Claude model available.`)}
                    </div>
                    
                    {/* Visual mockup of model selection */}
                    <div className="mt-4 rounded-lg overflow-hidden border border-slate-600/50 bg-slate-900/80 max-w-sm">
                      <div className="px-3 py-2 border-b border-slate-700/50">
                        <p className="text-xs text-red-400 font-medium">Use latest Claude model</p>
                        <p className="text-ui-2xs text-slate-500">Plan context, / for commands</p>
                      </div>
                      <div className="px-3 py-2 flex items-center gap-2">
                        <span className="text-slate-400 text-xs">∞ Agent</span>
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs">
                          <span className="text-emerald-400 font-mono">claude-4.5-opus-high</span>
                          <ChevronDown className="w-3 h-3 text-slate-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Divider */}
          <div className="border-t border-border/50 my-4" />
          
          {/* Sub-section C: Configure authentication */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-purple-900/50 text-purple-300 flex items-center justify-center text-xs font-bold">
                C
              </div>
              <h4 className="font-semibold text-foreground">Configure authentication</h4>
            </div>
            
            <div className="pl-8 space-y-4">
              <div className="text-sm text-muted-foreground space-y-2">
                {renderDescription(`Set up authentication with your Databricks workspace using the integrated terminal in your code editor.

**Step 1:** Open the integrated terminal in your code editor:
- **Cursor/VS Code:** Press Ctrl+\` (backtick) or go to View → Terminal
- Alternatively: Terminal → New Terminal from the menu

**Step 2:** Run the authentication command below. The workspace URL is pre-configured from Workshop Parameters (you can change it in Configuration → Workshop Parameters).

**Step 3:** A browser window will open for OAuth authentication. Log in with your Databricks credentials.

**Step 4:** Verify the authentication was successful by running the verify command.`)}
              </div>
              
              {/* Commands */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Commands</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Auth Login (using configured workspace URL)</p>
                    <CommandBox 
                      label="Auth Login" 
                      cmd={`databricks auth login --host ${workspaceUrl}`}
                      copiedKey={copiedCommand || ''} 
                      onCopy={handleCopyCommand} 
                    />
                    <p className="text-xs text-slate-500 mt-1 italic">
                      💡 Workspace URL is configured in Configuration → Workshop Parameters
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Verify Authentication</p>
                    <CommandBox 
                      label="Verify Auth" 
                      cmd="databricks current-user me" 
                      copiedKey={copiedCommand || ''} 
                      onCopy={handleCopyCommand} 
                    />
                  </div>
                </div>
              </div>
              
              {/* Links */}
              <div className="flex flex-wrap gap-2 mt-3">
                <LinkButton label="Databricks Auth Guide" url="https://docs.databricks.com/en/dev-tools/cli/authentication.html" color="purple" />
                <LinkButton label="OAuth Troubleshooting" url="https://docs.databricks.com/en/dev-tools/cli/authentication.html#oauth-user-to-machine-u2m-authentication" color="blue" />
                <LinkButton label="VS Code Terminal Guide" url="https://code.visualstudio.com/docs/terminal/basics" color="green" />
              </div>
            </div>
          </div>
          </>
          )}

          {/* ===========================================================
               VARIANT 2: CoDA (simplified)
               CoDA runs Claude Code / Codex / Gemini CLI / OpenCode in a
               browser terminal inside a Databricks App. Already on the
               workspace auth context, model already wired through the AI
               Gateway -- so we drop sub-sections B and C entirely and just
               show the clone command + a "why no extra setup" info card.
               =========================================================== */}
          {variant === 'coda' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-orange-900/50 text-orange-300 flex items-center justify-center text-xs font-bold">
                  A
                </div>
                <h4 className="font-semibold text-foreground">Clone the repository</h4>
              </div>

              <div className="pl-8 space-y-4">
                <div className="text-sm text-muted-foreground space-y-2">
                  {renderDescription(`Clone the workshop template into your CoDA browser terminal.

**Step 1:** Open the integrated terminal inside your CoDA workspace (it opens by default on the right side of the screen).

**Step 2:** Run the clone command below. The cloned folder will appear in CoDA's file tree -- open and edit files directly there.`)}
                </div>

                {/* Single clone command */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Command</p>
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Clone the repository</p>
                    <CommandBox
                      label="Clone"
                      cmd={cloneCmd}
                      copiedKey={copiedCommand || ''}
                      onCopy={handleCopyCommand}
                    />
                  </div>
                </div>

                {/* Why no further setup card -- replaces sub-sections B + C */}
                <div className="mt-4 p-3 bg-orange-900/15 border border-orange-700/30 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Terminal className="w-4 h-4 text-orange-300 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-orange-300 mb-2">You're running inside CoDA &mdash; no extra setup needed</p>
                      <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside marker:text-orange-300/60">
                        <li>Already authenticated to your Databricks workspace (no <code className="bg-background/80 px-1 py-0.5 rounded text-primary font-mono text-ui-xs">databricks auth login</code>)</li>
                        <li>Claude / Codex / Gemini / OpenCode are pre-wired through the Databricks AI Gateway (no model picker)</li>
                        <li>39 pre-installed skills + MLflow session tracing already enabled</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Links */}
                <div className="flex flex-wrap gap-2 mt-3">
                  <LinkButton label="View Repository" url="https://github.com/databricks-solutions/vibe-coding-workshop-template" color="orange" />
                  <LinkButton label="CoDA Deployment Docs" url="https://github.com/databrickslabs/coding-agents-databricks-apps/blob/main/docs/deployment.md" color="blue" />
                </div>
              </div>
            </div>
          )}

          {/* ===========================================================
               VARIANT 3: Genie Code (simplified, /Workspace path)
               Genie Code is native to Databricks and operates on /Workspace
               paths via Unity Catalog. User is already authenticated and the
               underlying model is already configured -- they just need to
               clone the repo into the right /Workspace location so Genie
               Code can see it. Email is auto-injected from getCurrentUser().
               =========================================================== */}
          {variant === 'genie-code' && (() => {
            const emailForPath = currentUserEmail || '<your_email>';
            // Skills the prompts reference (skills/genie-code-environment, 16 refs)
            // only exist on this branch until it merges to main. Flip to '' after merge.
            const CLONE_REF = 'genie-code-integration';
            const refFlag = CLONE_REF ? `-b ${CLONE_REF} ` : '';
            const genieCloneCmd = `git clone ${refFlag}https://github.com/databricks-solutions/vibe-coding-workshop-template.git /Workspace/Users/${emailForPath}/.assistant/skills/vibe-coding-workshop`;
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-orange-900/50 text-orange-300 flex items-center justify-center text-xs font-bold">
                    A
                  </div>
                  <h4 className="font-semibold text-foreground">One-time setup</h4>
                </div>

                <div className="pl-8 space-y-4">
                  <div className="text-sm text-muted-foreground space-y-2">
                    {renderDescription(`You're inside Genie Code -- pre-authenticated and serverless. No \`databricks auth login\`, no model setup.

**Step 1 -- Clone into your skills folder** (run in the Genie Code terminal). This is the folder Genie Code reads skills from. Cloning anywhere else means the workshop skills will **NOT** load.`)}
                  </div>

                  {/* Step 1 clone command (email auto-injected, branch-pinned) */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Command</p>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Clone into your skills folder</p>
                      <CommandBox
                        label="Clone"
                        cmd={genieCloneCmd}
                        copiedKey={copiedCommand || ''}
                        onCopy={handleCopyCommand}
                      />
                      <p className="text-xs text-slate-500 mt-1 italic">
                        {currentUserEmail
                          ? '💡 Auto-filled with your signed-in Databricks email. Swap it if you\'re cloning into someone else\'s workspace path.'
                          : '💡 Your email will be auto-filled once the session loads, or replace `<your_email>` manually.'}
                      </p>
                    </div>
                  </div>

                  {/* Step 2 + Step 3 -- skills only activate on a new thread + manifest load */}
                  <div className="text-sm text-muted-foreground space-y-2">
                    {renderDescription(`**Step 2 -- Start a NEW Agent-mode chat thread.** Skills load on the next Agent-mode thread, not the current one. If they don't appear, hard-refresh the tab.

**Step 3 -- Load the behavior manifest:** open \`skills/genie-code-environment\` so the agent knows how it runs here (page-context CLI via \`runDatabricksCli\`, serverless, files under the clone root -- never \`/tmp\`). The workshop then auto-detects your client and gates each step.`)}
                  </div>

                  {/* Why no further setup card -- replaces sub-sections B + C */}
                  <div className="mt-4 p-3 bg-cyan-900/15 border border-cyan-700/30 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-300 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-cyan-300 mb-2">You're running inside Genie Code &mdash; no extra setup needed</p>
                        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside marker:text-cyan-300/60">
                          <li>Already authenticated to your Databricks workspace (no <code className="bg-background/80 px-1 py-0.5 rounded text-primary font-mono text-ui-xs">databricks auth login</code>)</li>
                          <li>The underlying AI model is already configured (no model picker)</li>
                          <li>Files at <code className="bg-background/80 px-1 py-0.5 rounded text-primary font-mono text-ui-xs">/Workspace/Users/...</code> appear directly in the workspace browser</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Links */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    <LinkButton label="View Repository" url="https://github.com/databricks-solutions/vibe-coding-workshop-template" color="orange" />
                    <LinkButton label="Genie Code Docs" url="https://docs.databricks.com/aws/en/genie-code/" color="blue" />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Bottom Mark Done Button */}
          <div className="flex justify-end pt-4 border-t border-border/50">
            {!isComplete && !readOnly && (
              <BorderBeamButton
                active={isPreviousStepComplete}
                onClick={onMarkComplete}
                disabled={!isPreviousStepComplete}
                className="px-6 py-2 text-sm"
              >
                Done
              </BorderBeamButton>
            )}
            {isComplete && (
              <span className="flex items-center gap-2 text-emerald-400 text-sm font-medium bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 rounded-lg animate-fade-in">
                <CheckCircle className="w-4 h-4" />
                Done
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

