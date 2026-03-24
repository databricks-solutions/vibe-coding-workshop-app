/**
 * Session Parameters Popover
 * 
 * A dropdown popover that appears near the settings icon, allowing users to
 * view and override workshop parameters at the session level.
 * Uses fixed positioning to escape parent overflow containers.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Settings, Lock, RotateCcw, Save, Loader2, Check, AlertCircle, Globe, Database, Server, Layers, Bot, ChevronDown, X } from 'lucide-react';
import { apiClient, type SessionParameter } from '../../api/client';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface SessionParametersPopoverProps {
  sessionId: string | null;
  onParametersChanged?: () => void;
}

// Icon mapping for parameter types
const paramIcons: Record<string, React.ElementType> = {
  url: Globe,
  text: Settings,
  warehouse: Database,
  lakebase: Server,
  catalog: Layers,
  endpoint: Bot,
};

export function SessionParametersPopover({ sessionId, onParametersChanged }: SessionParametersPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [parameters, setParameters] = useState<SessionParameter[]>([]);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Calculate popover position based on button location
  const updatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverWidth = 420;
      const popoverHeight = 520;
      
      // Position below button, but ensure it stays within viewport
      let top = rect.bottom + 8;
      let left = rect.left;
      
      // If popover would go off the right edge, align to right of button
      if (left + popoverWidth > window.innerWidth - 16) {
        left = Math.max(16, rect.right - popoverWidth);
      }
      
      // If popover would go off the bottom, position above button
      if (top + popoverHeight > window.innerHeight - 16) {
        top = Math.max(16, rect.top - popoverHeight - 8);
      }
      
      setPopoverPosition({ top, left });
    }
  }, []);

  // Update position on open and window resize
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [isOpen, updatePosition]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const closePopover = useCallback(() => setIsOpen(false), []);
  useEscapeKey(isOpen, closePopover);

  // Fetch parameters when popover opens
  useEffect(() => {
    if (isOpen && sessionId) {
      fetchParameters();
    }
  }, [isOpen, sessionId]);

  // Clear messages after delay
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const fetchParameters = async () => {
    if (!sessionId) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getSessionParameters(sessionId);
      setParameters(data);
      
      // Initialize edited values with current effective values
      const values: Record<string, string> = {};
      data.forEach(p => {
        values[p.param_key] = p.param_value;
      });
      setEditedValues(values);
      setHasChanges(false);
    } catch (err) {
      console.error('Error fetching session parameters:', err);
      setError('Failed to load parameters');
    } finally {
      setLoading(false);
    }
  };

  const handleValueChange = (paramKey: string, value: string) => {
    setEditedValues(prev => ({
      ...prev,
      [paramKey]: value
    }));
    
    // Check if any value differs from original
    const param = parameters.find(p => p.param_key === paramKey);
    if (param) {
      const hasAnyChange = parameters.some(p => {
        const editedVal = paramKey === p.param_key ? value : editedValues[p.param_key];
        return editedVal !== p.param_value;
      });
      setHasChanges(hasAnyChange);
    }
  };

  const handleSave = async () => {
    if (!sessionId || !hasChanges) return;
    
    setSaving(true);
    setError(null);
    try {
      // Build the parameters to save (only changed ones that allow override)
      const changedParams: Record<string, string> = {};
      parameters.forEach(p => {
        if (p.allow_session_override && editedValues[p.param_key] !== p.global_value) {
          changedParams[p.param_key] = editedValues[p.param_key];
        }
      });
      
      await apiClient.updateSessionParameters(sessionId, changedParams);
      setSuccess('Saved!');
      setHasChanges(false);
      
      // Refresh to get updated state
      await fetchParameters();
      onParametersChanged?.();
    } catch (err) {
      console.error('Error saving parameters:', err);
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (paramKey: string) => {
    if (!sessionId) return;
    
    try {
      await apiClient.resetSessionParameter(sessionId, paramKey);
      
      // Update local state
      const param = parameters.find(p => p.param_key === paramKey);
      if (param) {
        setEditedValues(prev => ({
          ...prev,
          [paramKey]: param.global_value
        }));
      }
      
      // Refresh to get updated state
      await fetchParameters();
      setSuccess('Reset');
      onParametersChanged?.();
    } catch (err) {
      console.error('Error resetting parameter:', err);
      setError('Failed to reset');
    }
  };

  const modifiedCount = parameters.filter(p => p.is_overridden).length;

  // Render the popover in a portal to escape parent overflow
  const popoverContent = isOpen ? createPortal(
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[100]"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Popover */}
      <div 
        ref={popoverRef}
        style={{
          position: 'fixed',
          top: popoverPosition.top,
          left: popoverPosition.left,
          zIndex: 101,
        }}
        className="w-[420px] bg-card border border-border rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border bg-secondary/30 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="text-[15px] font-semibold text-foreground">Session Settings</span>
                <p className="text-[11px] text-muted-foreground">Override parameters for this session</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[440px] overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 p-4 bg-red-900/20 border border-red-700/30 rounded-lg text-red-300">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span className="text-[13px]">{error}</span>
            </div>
          ) : (
            <div className="space-y-4">
              {parameters.map((param) => {
                const Icon = paramIcons[param.param_type] || Settings;
                const isModified = editedValues[param.param_key] !== param.global_value;
                const isDisabled = !param.allow_session_override;
                
                return (
                  <div 
                    key={param.param_key}
                    className={`p-4 rounded-lg border transition-all ${
                      isDisabled 
                        ? 'bg-secondary/20 border-border/50 opacity-60' 
                        : isModified
                        ? 'bg-amber-900/10 border-amber-500/40'
                        : 'bg-secondary/30 border-border hover:border-border/80'
                    }`}
                  >
                    {/* Parameter Header */}
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <label className="text-[13px] font-medium text-foreground">
                          {param.param_label}
                        </label>
                        {isDisabled && (
                          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        {isModified && !isDisabled && (
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 rounded">
                            Modified
                          </span>
                        )}
                      </div>
                      {param.is_overridden && !isDisabled && (
                        <button
                          onClick={() => handleReset(param.param_key)}
                          className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                          title="Reset to default"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Reset
                        </button>
                      )}
                    </div>
                    
                    {/* Input Field */}
                    <input
                      type={param.param_type === 'url' ? 'url' : 'text'}
                      value={editedValues[param.param_key] || ''}
                      onChange={(e) => handleValueChange(param.param_key, e.target.value)}
                      disabled={isDisabled}
                      className={`w-full px-3 py-2.5 text-[13px] rounded-md border transition-colors ${
                        isDisabled
                          ? 'bg-secondary/30 border-border/30 text-muted-foreground cursor-not-allowed'
                          : 'bg-input border-border focus:border-primary focus:ring-1 focus:ring-primary/30 text-foreground'
                      }`}
                      placeholder={param.global_value}
                    />
                    
                    {/* Show default if modified */}
                    {isModified && !isDisabled && (
                      <p className="mt-2 text-[11px] text-muted-foreground truncate">
                        Default: <span className="font-mono">{param.global_value}</span>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border bg-secondary/20 rounded-b-xl">
          {success && (
            <div className="flex items-center gap-2 text-emerald-400 text-[12px] mb-2">
              <Check className="h-4 w-4" />
              <span>{success}</span>
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              <Lock className="inline h-3.5 w-3.5 mr-1" />
              Locked = admin only
            </p>
            
            {hasChanges && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-[12px] font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes
              </button>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  ) : null;

  return (
    <>
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all ${
          isOpen
            ? 'bg-primary/20 text-primary'
            : modifiedCount > 0
            ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
        }`}
        title="Session Settings"
      >
        <Settings className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Settings</span>
        {modifiedCount > 0 && (
          <span className="px-1 py-0.5 text-[9px] bg-amber-500 text-white rounded-full font-bold">
            {modifiedCount}
          </span>
        )}
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Portal-rendered popover */}
      {popoverContent}
    </>
  );
}
