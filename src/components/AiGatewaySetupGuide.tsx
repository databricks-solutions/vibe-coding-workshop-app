import { useEffect, useState } from 'react';
import { BookOpen, ChevronDown } from 'lucide-react';
import { MarkdownWithCopy } from './MarkdownWithCopy';
import { ExpandableOutputModal } from './ExpandableOutputModal';
import attendeeMd from '../content/ai-gateway-attendee.md?raw';

export function AiGatewaySetupGuide() {
  const [expanded, setExpanded] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1500);
    return () => clearTimeout(t);
  }, [toast]);

  function handleCopy(ok: boolean) {
    setToast(ok ? 'Copied to clipboard' : 'Copy failed');
  }

  function toggleExpanded() {
    setExpanded((v) => !v);
  }

  function handleHeaderKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleExpanded();
    }
  }

  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 overflow-hidden">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={toggleExpanded}
        onKeyDown={handleHeaderKeyDown}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-emerald-500/10 transition-colors cursor-pointer select-none"
      >
        <div className="p-1.5 rounded-md bg-emerald-500/15">
          <BookOpen className="w-4 h-4 text-emerald-300" />
        </div>
        <div className="flex-1 text-left">
          <div className="text-ui-base font-medium text-foreground">
            Setup Guide — VS Code + Databricks AI Gateway
          </div>
          <div className="text-ui-xs text-muted-foreground">
            Step-by-step instructions to point Claude Code at your AI Gateway endpoint
          </div>
        </div>
        <span onClick={(e) => e.stopPropagation()} className="flex items-center">
          <ExpandableOutputModal
            content={attendeeMd}
            title="Setup Guide — VS Code + Databricks AI Gateway"
            buttonColor="emerald"
          />
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </div>

      <div
        className={`transition-all duration-300 ease-in-out ${
          expanded ? 'max-h-[420px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
        }`}
      >
        <div className="relative border-t border-emerald-500/20">
          <div className="max-h-[380px] overflow-y-auto px-4 py-3 pr-5">
            <MarkdownWithCopy content={attendeeMd} onCopy={handleCopy} />
          </div>
          {toast && (
            <div className="absolute bottom-3 right-4 px-3 py-1.5 rounded-md bg-emerald-600 text-white text-ui-xs font-medium shadow-lg animate-fade-in">
              {toast}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
