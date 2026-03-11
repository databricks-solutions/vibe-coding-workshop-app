import { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Save,
  FolderOpen,
  Plus,
  Share2,
  CheckCircle,
  Hash,
  FileText,
  LogOut,
  Loader2,
} from 'lucide-react';

interface HeaderSessionMenuProps {
  sessionId: string | null;
  sessionSaved: boolean;
  sessionName?: string;
  shareUrl: string | null;
  isSaving: boolean;
  currentUser: string;
  completedSteps: number;
  totalSteps: number;
  onSave: () => void;
  onLoadSession: () => void;
  onNewSession: () => void;
  onShare: () => void;
}

export function HeaderSessionMenu({
  sessionId,
  sessionSaved,
  sessionName,
  shareUrl,
  isSaving,
  currentUser,
  completedSteps,
  totalSteps,
  onSave,
  onLoadSession,
  onNewSession,
  onShare
}: HeaderSessionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const safeUser = currentUser || 'user@databricks.com';
  const displayName = safeUser.split('@')[0].replace('.', ' ');
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* Session Status Badge - Hidden on small screens */}
      {sessionId && (
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary/50 rounded-md border border-border/50">
          {sessionName && sessionSaved ? (
            <>
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span className="text-[12px] font-medium text-foreground truncate max-w-[100px]">
                {sessionName}
              </span>
              <CheckCircle className="h-3 w-3 text-emerald-400" />
            </>
          ) : (
            <>
              <Hash className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-mono text-muted-foreground">
                {sessionId.slice(0, 8)}
              </span>
              {sessionSaved && <CheckCircle className="h-3 w-3 text-emerald-400" />}
            </>
          )}
        </div>
      )}

      {/* Steps Progress Indicator */}
      <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 bg-primary/10 rounded-md border border-primary/20">
        <span className="hidden sm:inline text-[10px] text-muted-foreground font-medium">Steps:</span>
        <span className={`text-[11px] font-semibold ${completedSteps > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
          [{completedSteps}/{totalSteps}]
        </span>
        {completedSteps > 0 && (
          <div className="hidden sm:flex w-10 h-1 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="hidden sm:block h-6 w-px bg-border/50" />

      {/* Save Session Button */}
      <button
        onClick={onSave}
        disabled={isSaving || !sessionId}
        className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-[11px] font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow"
        title={sessionSaved ? 'Update session' : 'Save session'}
      >
        {isSaving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">{sessionSaved ? 'Update' : 'Save'}</span>
      </button>

      {/* Start New Session Button */}
      <button
        onClick={onNewSession}
        disabled={!sessionId}
        className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-md text-[11px] font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow"
        title="Start a fresh session"
      >
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Start New Session</span>
      </button>

      {/* User Menu Dropdown */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-secondary/50 hover:bg-secondary border border-border/50 hover:border-border transition-all duration-200"
        >
          {/* Avatar */}
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center text-white text-[11px] font-semibold">
            {initials}
          </div>
          <div className="hidden md:flex flex-col items-start">
            <span className="text-[12px] font-medium text-foreground capitalize leading-tight">
              {displayName}
            </span>
            <span className="text-[10px] text-muted-foreground leading-tight">
              Logged in
            </span>
          </div>
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-56 bg-card rounded-lg border border-border shadow-lg z-50 overflow-hidden animate-fade-in">
            {/* User Info Header */}
            <div className="px-3 py-2.5 border-b border-border bg-secondary/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center text-white text-[11px] font-semibold">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-foreground capitalize truncate">
                    {displayName}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {currentUser}
                  </p>
                </div>
              </div>
            </div>

            {/* Session Section */}
            <div className="px-1.5 py-1.5 border-b border-border">
              <p className="px-2 py-1 text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                Session
              </p>
              
              <button
                onClick={() => { onSave(); setIsOpen(false); }}
                disabled={isSaving || !sessionId}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-[12px] text-foreground hover:bg-secondary/50 transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                ) : (
                  <Save className="h-3.5 w-3.5 text-primary" />
                )}
                <span>{sessionSaved ? 'Update Session' : 'Save Session'}</span>
              </button>

              {sessionSaved && shareUrl && (
                <button
                  onClick={() => { onShare(); setIsOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-[12px] text-foreground hover:bg-secondary/50 transition-colors"
                >
                  <Share2 className="h-3.5 w-3.5 text-blue-400" />
                  <span>Copy Share Link</span>
                </button>
              )}

              <button
                onClick={() => { onLoadSession(); setIsOpen(false); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-[12px] text-foreground hover:bg-secondary/50 transition-colors"
              >
                <FolderOpen className="h-3.5 w-3.5 text-amber-400" />
                <span>My Saved Sessions</span>
              </button>

              <button
                onClick={() => { onNewSession(); setIsOpen(false); }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-[12px] text-foreground hover:bg-secondary/50 transition-colors"
              >
                <Plus className="h-3.5 w-3.5 text-emerald-400" />
                <span>New Session</span>
              </button>
            </div>

            {/* Sign Out (placeholder) */}
            <div className="px-1.5 py-1.5">
              <button
                disabled
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-[12px] text-muted-foreground cursor-not-allowed opacity-50"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
