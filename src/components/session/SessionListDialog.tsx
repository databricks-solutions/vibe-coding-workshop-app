import { useState, useEffect } from 'react';
import { X, FolderOpen, Clock, MapPin, Trash2, ChevronRight, Loader2, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react';
import { apiClient } from '../../api/client';
import type { SessionListItem } from '../../api/client';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface SessionListDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSession: (sessionId: string) => void;
  currentSessionId?: string;
}

export function SessionListDialog({
  isOpen,
  onClose,
  onSelectSession,
  currentSessionId,
}: SessionListDialogProps) {
  useEscapeKey(isOpen, onClose);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.getUserSessions();
      setSessions(data);
    } catch (err) {
      setError('Failed to load sessions');
      console.error('Error fetching sessions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSessions();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelect = (sessionId: string) => {
    onSelectSession(sessionId);
    onClose();
  };

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this session?')) return;
    
    try {
      await apiClient.deleteSession(sessionId);
      setSessions(prev => prev.filter(s => s.session_id !== sessionId));
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Filter to only show saved sessions (not auto-tracked "New Session" entries)
  // Show ALL saved sessions including the current one
  const savedSessions = sessions.filter(s => 
    s.is_saved && 
    s.session_name !== 'New Session'
  );

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <FolderOpen className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">My Saved Sessions</h2>
              <p className="text-sm text-slate-400">Restore a saved session to continue where you left off</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchSessions}
              disabled={isLoading}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw className={`h-5 w-5 text-slate-400 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && sessions.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={fetchSessions}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : savedSessions.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 mb-2">No saved sessions yet</p>
              <p className="text-sm text-slate-500">
                Complete some workflow steps and save your session to see it here
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {savedSessions.map((session) => {
                const isCurrent = session.session_id === currentSessionId;
                return (
                <div
                  key={session.session_id}
                  onClick={() => handleSelect(session.session_id)}
                  className={`group p-4 border rounded-lg cursor-pointer transition-all ${
                    isCurrent 
                      ? 'bg-primary/10 border-primary/40 hover:bg-primary/15' 
                      : 'bg-slate-800/50 hover:bg-slate-800 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-white truncate">
                          {session.session_name || 'Untitled Session'}
                        </h3>
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-primary/20 text-primary rounded">
                            Current
                          </span>
                        )}
                        {session.feedback_rating && (
                          session.feedback_rating === 'thumbs_up' ? (
                            <ThumbsUp className="h-4 w-4 text-emerald-400 fill-current" />
                          ) : (
                            <ThumbsDown className="h-4 w-4 text-red-400 fill-current" />
                          )
                        )}
                      </div>
                      
                      {session.session_description && (
                        <p className="text-sm text-slate-400 line-clamp-2 mb-2">
                          {session.session_description}
                        </p>
                      )}
                      
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        {session.industry_label && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {session.industry_label}
                            {session.use_case_label && ` / ${session.use_case_label}`}
                          </span>
                        )}
                        
                        <span className="flex items-center gap-1">
                          Step {session.current_step} of 20
                        </span>
                        
                        {session.updated_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(session.updated_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Right actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => handleDelete(e, session.session_id)}
                        className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 
                                 text-slate-400 hover:text-red-400 rounded-lg transition-all"
                        title="Delete session"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-blue-400 transition-colors" />
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700 bg-slate-800/50 flex-shrink-0">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-slate-300 hover:text-white 
                     hover:bg-slate-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

