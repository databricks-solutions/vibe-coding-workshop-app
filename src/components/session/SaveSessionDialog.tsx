import { useState, useEffect } from 'react';
import { Save, X, ThumbsUp, ThumbsDown } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface SaveSessionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description: string, rating?: 'thumbs_up' | 'thumbs_down', comment?: string) => void;
  isSaving: boolean;
  initialName?: string;
  initialDescription?: string;
  showFeedback?: boolean;
}

export function SaveSessionDialog({
  isOpen,
  onClose,
  onSave,
  isSaving,
  initialName = '',
  initialDescription = '',
  showFeedback = true,
}: SaveSessionDialogProps) {
  const [name, setName] = useState(initialName || '');
  const [description, setDescription] = useState(initialDescription || '');
  const [feedbackRating, setFeedbackRating] = useState<'thumbs_up' | 'thumbs_down' | null>(null);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({});

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setName(initialName || '');
      setDescription(initialDescription || '');
      setFeedbackRating(null);
      setFeedbackComment('');
      setErrors({});
    }
  }, [isOpen, initialName, initialDescription]);

  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const newErrors: { name?: string; description?: string } = {};
    
    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      onSave(
        name.trim(), 
        description.trim(), 
        feedbackRating || undefined, 
        feedbackComment.trim() || undefined
      );
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-lg mx-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-emerald-500/20 rounded">
              <Save className="h-4 w-4 text-emerald-400" />
            </div>
            <h2 className="text-[15px] font-semibold text-foreground">Save Session</h2>
          </div>
          <button 
            onClick={onClose} 
            disabled={isSaving}
            className="p-1.5 hover:bg-secondary rounded transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Name Field */}
          <div className="space-y-1.5">
            <label htmlFor="session-name" className="text-[13px] font-medium text-foreground">
              Session Name <span className="text-red-400">*</span>
            </label>
            <input
              id="session-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value.slice(0, 100));
                if (errors.name) setErrors(prev => ({ ...prev, name: undefined }));
              }}
              placeholder="e.g., Retail Inventory Demo - Phase 1"
              maxLength={100}
              autoFocus
              disabled={isSaving}
              className={`w-full px-3 py-2 bg-input border rounded text-[13px] text-foreground placeholder:text-muted-foreground 
                         focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                         disabled:opacity-50 disabled:cursor-not-allowed
                         ${errors.name ? 'border-red-500' : 'border-border'}`}
            />
            <div className="flex justify-between text-[11px]">
              {errors.name ? (
                <span className="text-red-400">{errors.name}</span>
              ) : (
                <span className="text-muted-foreground">Give your session a memorable name</span>
              )}
              <span className="text-muted-foreground">{(name || '').length}/100</span>
            </div>
          </div>

          {/* Description Field - REQUIRED */}
          <div className="space-y-1.5">
            <label htmlFor="session-description" className="text-[13px] font-medium text-foreground">
              Description <span className="text-red-400">*</span>
            </label>
            <textarea
              id="session-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value.slice(0, 500));
                if (errors.description) setErrors(prev => ({ ...prev, description: undefined }));
              }}
              placeholder="Add notes about this session, progress made, or next steps..."
              maxLength={500}
              rows={3}
              disabled={isSaving}
              className={`w-full px-3 py-2 bg-input border rounded text-[13px] text-foreground placeholder:text-muted-foreground 
                         focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                         disabled:opacity-50 disabled:cursor-not-allowed resize-none
                         ${errors.description ? 'border-red-500' : 'border-border'}`}
            />
            <div className="flex justify-between text-[11px]">
              {errors.description ? (
                <span className="text-red-400">{errors.description}</span>
              ) : (
                <span className="text-muted-foreground">Required</span>
              )}
              <span className="text-muted-foreground">{(description || '').length}/500</span>
            </div>
          </div>

          {/* Feedback Section */}
          {showFeedback && (
            <div className="space-y-2 pt-2 border-t border-border">
              <label className="text-[13px] font-medium text-foreground">
                How was your experience? <span className="text-muted-foreground text-[11px]">(optional)</span>
              </label>
              
              {/* Rating Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFeedbackRating(feedbackRating === 'thumbs_up' ? null : 'thumbs_up')}
                  disabled={isSaving}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded border transition-all text-[12px] font-medium
                             ${feedbackRating === 'thumbs_up' 
                               ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                               : 'bg-secondary border-border text-muted-foreground hover:border-muted-foreground'}`}
                >
                  <ThumbsUp className={`h-4 w-4 ${feedbackRating === 'thumbs_up' ? 'fill-current' : ''}`} />
                  <span>Great!</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFeedbackRating(feedbackRating === 'thumbs_down' ? null : 'thumbs_down')}
                  disabled={isSaving}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded border transition-all text-[12px] font-medium
                             ${feedbackRating === 'thumbs_down' 
                               ? 'bg-red-500/20 border-red-500 text-red-400' 
                               : 'bg-secondary border-border text-muted-foreground hover:border-muted-foreground'}`}
                >
                  <ThumbsDown className={`h-4 w-4 ${feedbackRating === 'thumbs_down' ? 'fill-current' : ''}`} />
                  <span>Needs Work</span>
                </button>
              </div>

              {/* Comment Field */}
              {feedbackRating && (
                <textarea
                  value={feedbackComment}
                  onChange={(e) => setFeedbackComment(e.target.value.slice(0, 500))}
                  placeholder={feedbackRating === 'thumbs_up' 
                    ? "What did you like most?" 
                    : "What could be improved?"}
                  maxLength={500}
                  rows={2}
                  disabled={isSaving}
                  className="w-full px-3 py-2 bg-input border border-border rounded text-[13px] text-foreground 
                           placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary 
                           focus:border-transparent disabled:opacity-50 resize-none"
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-secondary/30">
          <button 
            onClick={onClose} 
            disabled={isSaving}
            className="px-4 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground 
                     hover:bg-secondary rounded transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            disabled={isSaving || !name.trim() || !description.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 
                     text-white text-[13px] font-medium rounded transition-colors 
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                Save Session
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
