import { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronDown, ShieldCheck, UserRound } from 'lucide-react';
import { MarkdownWithCopy } from './MarkdownWithCopy';
import { ExpandableOutputModal } from './ExpandableOutputModal';
import attendeeMd from '../content/ai-gateway-attendee.md?raw';
import adminMd from '../content/ai-gateway-admin.md?raw';

type TabId = 'user' | 'admin';

const TABS: { id: TabId; label: string; Icon: typeof UserRound }[] = [
  { id: 'user', label: 'User setup', Icon: UserRound },
  { id: 'admin', label: 'Admin setup', Icon: ShieldCheck },
];

export function AiGatewaySetupGuide() {
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('user');
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  const activeContent = activeTab === 'user' ? attendeeMd : adminMd;
  const subtitle =
    activeTab === 'user'
      ? 'Step-by-step instructions to point Claude Code at your AI Gateway endpoint'
      : 'Workspace admin: create the AI Gateway endpoint and grant user access';
  const fullscreenTitle =
    activeTab === 'user'
      ? 'Setup Guide — User setup'
      : 'Setup Guide — Admin setup';

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

  function handleTabKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, current: TabId) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setActiveTab(current === 'user' ? 'admin' : 'user');
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
          <div className="text-ui-xs text-muted-foreground">{subtitle}</div>
        </div>
        <span onClick={(e) => e.stopPropagation()} className="flex items-center">
          <ExpandableOutputModal
            content={activeContent}
            title={fullscreenTitle}
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
          expanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
        }`}
      >
        <div className="relative border-t border-emerald-500/20">
          <div className="px-4 pt-4">
            <div
              role="tablist"
              aria-label="Setup guide audience"
              className="flex items-center gap-1 p-1 bg-secondary/30 rounded-lg border border-border/50"
            >
              {TABS.map((t) => {
                const isActive = activeTab === t.id;
                const { Icon } = t;
                return (
                  <button
                    key={t.id}
                    id={`ai-gw-tab-${t.id}`}
                    role="tab"
                    type="button"
                    aria-selected={isActive}
                    aria-controls="ai-gw-tabpanel"
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => setActiveTab(t.id)}
                    onKeyDown={(e) => handleTabKeyDown(e, t.id)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-ui-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-card text-foreground shadow-sm border border-border/50'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div
            id="ai-gw-tabpanel"
            role="tabpanel"
            aria-labelledby={`ai-gw-tab-${activeTab}`}
            ref={scrollRef}
            className="max-h-[380px] overflow-y-auto px-4 py-3 pr-5"
          >
            <MarkdownWithCopy content={activeContent} onCopy={handleCopy} />
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
