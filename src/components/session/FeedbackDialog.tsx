import { useState, useEffect } from 'react';
import { MessageSquare, X, ThumbsUp, ThumbsDown, Send } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';

interface FeedbackDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rating: 'thumbs_up' | 'thumbs_down', comment: string, requestFollowup: boolean) => void;
  isSubmitting: boolean;
  initialRating?: 'thumbs_up' | 'thumbs_down' | null;
  initialComment?: string;
}

export function FeedbackDialog({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  initialRating = null,
  initialComment = '',
}: FeedbackDialogProps) {
  const [rating, setRating] = useState<'thumbs_up' | 'thumbs_down' | null>(initialRating);
  const [comment, setComment] = useState(initialComment || '');
  const [requestFollowup, setRequestFollowup] = useState(false);
  const [errors, setErrors] = useState<{ rating?: string; comment?: string }>({});

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setRating(initialRating);
      setComment(initialComment || '');
      setRequestFollowup(false);
      setErrors({});
    }
  }, [isOpen, initialRating, initialComment]);

  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const newErrors: { rating?: string; comment?: string } = {};
    
    if (!rating) {
      newErrors.rating = 'Please select a rating';
    }
    if (!comment.trim()) {
      newErrors.comment = 'Please provide your feedback';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSubmit(rating!, comment.trim(), requestFollowup);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card border border-border rounded-lg shadow-xl w-full max-w-md mx-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary/20 rounded">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-ui-md2 font-semibold text-foreground">Share Feedback</h2>
              <p className="text-ui-sm text-muted-foreground">Help us improve the workshop</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={isSubmitting}
            className="p-1.5 hover:bg-secondary rounded transition-colors"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Rating Selection */}
          <div className="space-y-2">
            <label className="text-ui-base font-medium text-foreground">
              How was your experience? <span className="text-red-400">*</span>
            </label>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setRating('thumbs_up');
                  setErrors(prev => ({ ...prev, rating: undefined }));
                }}
                disabled={isSubmitting}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all
                           ${rating === 'thumbs_up' 
                             ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                             : 'bg-secondary border-border text-muted-foreground hover:border-muted-foreground hover:bg-secondary/80'}`}
              >
                <ThumbsUp className={`h-6 w-6 ${rating === 'thumbs_up' ? 'fill-current' : ''}`} />
                <span className="text-ui-sm font-medium">Great!</span>
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setRating('thumbs_down');
                  setErrors(prev => ({ ...prev, rating: undefined }));
                }}
                disabled={isSubmitting}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all
                           ${rating === 'thumbs_down' 
                             ? 'bg-red-500/20 border-red-500 text-red-400' 
                             : 'bg-secondary border-border text-muted-foreground hover:border-muted-foreground hover:bg-secondary/80'}`}
              >
                <ThumbsDown className={`h-6 w-6 ${rating === 'thumbs_down' ? 'fill-current' : ''}`} />
                <span className="text-ui-sm font-medium">Needs Work</span>
              </button>
            </div>
            
            {errors.rating && (
              <p className="text-ui-sm text-red-400">{errors.rating}</p>
            )}
          </div>

          {/* Comment Field - REQUIRED */}
          <div className="space-y-1.5">
            <label htmlFor="feedback-comment" className="text-ui-base font-medium text-foreground">
              Additional Comments <span className="text-red-400">*</span>
            </label>
            <textarea
              id="feedback-comment"
              value={comment}
              onChange={(e) => {
                setComment(e.target.value.slice(0, 1000));
                if (errors.comment) setErrors(prev => ({ ...prev, comment: undefined }));
              }}
              placeholder={rating === 'thumbs_up' 
                ? "What did you find most helpful?" 
                : rating === 'thumbs_down'
                ? "What could we improve?"
                : "Share your thoughts..."}
              maxLength={1000}
              rows={4}
              disabled={isSubmitting}
              className={`w-full px-3 py-2 bg-input border rounded text-ui-base text-foreground 
                       placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary 
                       focus:border-transparent disabled:opacity-50 resize-none
                       ${errors.comment ? 'border-red-500' : 'border-border'}`}
            />
            <div className="flex justify-between text-ui-xs">
              {errors.comment ? (
                <span className="text-red-400">{errors.comment}</span>
              ) : (
                <span className="text-muted-foreground">Required</span>
              )}
              <span className="text-muted-foreground">{(comment || '').length}/1000</span>
            </div>
          </div>

          {/* Request Follow-up Checkbox */}
          <div className="pt-2 border-t border-border">
            <label className="flex items-start gap-3 cursor-pointer group">
              <div className="relative mt-0.5">
                <input
                  type="checkbox"
                  checked={requestFollowup}
                  onChange={(e) => setRequestFollowup(e.target.checked)}
                  disabled={isSubmitting}
                  className="sr-only peer"
                />
                <div className={`w-5 h-5 rounded border-2 transition-all flex items-center justify-center
                              ${requestFollowup 
                                ? 'bg-primary border-primary' 
                                : 'bg-background border-border group-hover:border-muted-foreground'}`}>
                  {requestFollowup && (
                    <svg className="w-3 h-3 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>
              <div className="flex-1">
                <span className="text-ui-base font-medium text-foreground">
                  Request follow-up support
                </span>
                <p className="text-ui-xs text-muted-foreground mt-0.5">
                  Check this if you'd like our team to reach out and provide additional help
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-secondary/30">
          <button 
            onClick={onClose} 
            disabled={isSubmitting}
            className="px-4 py-2 text-ui-base font-medium text-muted-foreground hover:text-foreground 
                     hover:bg-secondary rounded transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !rating || !comment.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 
                     text-primary-foreground text-ui-base font-medium rounded transition-colors 
                     disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5" />
                Submit Feedback
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
