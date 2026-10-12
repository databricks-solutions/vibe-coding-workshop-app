import { useState } from 'react';
import { Check, Copy, SquareTerminal, MessageSquarePlus } from 'lucide-react';
import { useCopyToClipboard } from '../../../hooks/useCopyToClipboard';
import { SetUpProjectStep } from '../../SetUpProjectStep';

const REPO_URL = 'https://github.com/databricks-solutions/vibe-coding-workshop-template.git';

/**
 * Same three commands and first message as the Genie Code variant of
 * SetUpProjectStep, combined so the user copies twice instead of four times.
 * Keep the paths in sync with that component.
 */
function genieSetup(email: string) {
  const projectPath = `/Workspace/Users/${email}/vibe-coding-workshop`;
  const commands = [
    `git clone ${REPO_URL} ${projectPath}`,
    `D=/Workspace/Users/${email}; rm -rf "$D/.assistant/skills/vibe-coding-workshop"; mkdir -p "$D/.assistant/skills"; cp -R "$D/vibe-coding-workshop" "$D/.assistant/skills/"`,
    `D=/Workspace/Users/${email}; test -d "$D/vibe-coding-workshop/.git" && echo "✅ 1/2 project cloned" || echo "❌ 1/2 re-run command 1"; test -f "$D/.assistant/skills/vibe-coding-workshop/skills/genie-code-environment/SKILL.md" && echo "✅ 2/2 skills published" || echo "❌ 2/2 re-run command 2"`,
  ].join('\n');
  const firstMessage = `You're running in Databricks Genie Code. Before anything else, in this exact order:

1. Verify my setup in ONE executeCode block (use os.path.exists, NOT listFiles):
   - ${projectPath}/.git
   - /Workspace/Users/${email}/.assistant/skills/vibe-coding-workshop/skills/genie-code-environment/SKILL.md
   If EITHER is missing, STOP and tell me which Step 1 command to re-run. Do not continue.

2. Load the behavior manifest:
   readSkillFile("skills/vibe-coding-workshop/skills/genie-code-environment/SKILL.md")

3. Reply "Setup verified ✅" plus one line on how you'll operate here (runDatabricksCli, serverless, files under my project folder, never /tmp), then wait.`;
  return { commands, firstMessage };
}

export function CopyRow({ n, icon: Icon, title, body, text, onCopied }: {
  n: number; icon: typeof Copy; title: string; body: string; text: string; onCopied?: () => void;
}) {
  const { copied, handleCopy } = useCopyToClipboard();
  const [used, setUsed] = useState(false);
  return (
    <li className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <span className={`flex items-center justify-center w-9 h-9 rounded-full text-ui-md font-semibold shrink-0 transition-colors ${used ? 'bg-emerald-500 text-white' : 'bg-secondary text-foreground'}`}>
        {used ? <Check className="w-4 h-4" strokeWidth={3} /> : n}
      </span>
      <div className="flex-1 min-w-0">
        <p className="flex items-center gap-2 text-ui-md font-semibold text-foreground"><Icon className="w-4 h-4 text-muted-foreground" /> {title}</p>
        <p className="text-ui-sm text-muted-foreground mt-0.5">{body}</p>
      </div>
      <button
        onClick={async () => { if (await handleCopy(text)) { setUsed(true); onCopied?.(); } }}
        className={`inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-ui-md font-semibold transition-all active:scale-[0.98] ${
          copied ? 'bg-emerald-600 text-white' : 'bg-primary text-primary-foreground hover:opacity-90'
        }`}
      >
        {copied ? <><Check className="w-4 h-4" strokeWidth={3} /> Copied</> : <><Copy className="w-4 h-4" /> Copy</>}
      </button>
    </li>
  );
}

interface SetupBodyProps {
  codingAssistant: string | null;
  currentUser: string;
  isDone: boolean;
  onDone: () => void;
  onUndo: () => void;
  sessionId: string | null;
  useCaseLabel: string;
}

export function SetupBody({ codingAssistant, currentUser, isDone, onDone, onUndo, sessionId, useCaseLabel }: SetupBodyProps) {
  const email = currentUser && currentUser.includes('@') && currentUser !== 'user@databricks.com' ? currentUser : null;

  if (codingAssistant !== 'genie-code') {
    return (
      <SetUpProjectStep
        isComplete={isDone}
        onMarkComplete={isDone ? onUndo : onDone}
        isExpanded
        onToggleExpand={() => {}}
        isPreviousStepComplete
        sessionId={sessionId}
        useCaseLabel={useCaseLabel}
        codingAssistant={codingAssistant}
        currentUserEmail={email}
      />
    );
  }

  const { commands, firstMessage } = genieSetup(email || '<your_email>');
  return (
    <div className="space-y-3">
      <ol className="space-y-3">
        <CopyRow
          n={1}
          icon={SquareTerminal}
          title="Run the setup in the Genie Code terminal"
          body="Open Genie Code, open its terminal, paste and press Enter. You should see two ✅."
          text={commands}
        />
        <CopyRow
          n={2}
          icon={MessageSquarePlus}
          title="Start a new Agent chat and paste this"
          body="Genie Code checks the setup and replies “Setup verified ✅”."
          text={firstMessage}
        />
      </ol>
      {!email && (
        <p className="text-ui-sm text-amber-500">We could not read your email yet. Replace &lt;your_email&gt; in the copied text before running it.</p>
      )}
    </div>
  );
}
