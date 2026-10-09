import { forwardRef, useCallback, useEffect, useRef } from 'react';
import { Mic, MicOff, Square } from 'lucide-react';
import { useSpeechToText } from '../../hooks/useSpeechToText';

interface VoiceTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  autoFocus?: boolean;
  size?: 'lg' | 'md';
  onSubmit?: () => void;
  className?: string;
}

/** Textarea with a built-in mic. Speech is appended to the current text; Cmd/Ctrl+Enter submits. */
export const VoiceTextarea = forwardRef<HTMLTextAreaElement, VoiceTextareaProps>(function VoiceTextarea(
  { value, onChange, placeholder, rows = 3, autoFocus, size = 'md', onSubmit, className = '' },
  ref,
) {
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);
  const append = useCallback((text: string) => {
    const current = valueRef.current;
    const next = (current ? `${current.trimEnd()} ` : '') + text.trim();
    valueRef.current = next;
    onChange(next);
  }, [onChange]);

  const speech = useSpeechToText({ onFinalTranscript: append });

  return (
    <div className={`relative rounded-xl border bg-card transition-colors ${speech.isListening ? 'border-red-400/60 ring-2 ring-red-400/20' : 'border-border focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15'} ${className}`}>
      <textarea
        ref={ref}
        value={value}
        rows={rows}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'm' && speech.isSupported) {
            e.preventDefault();
            if (speech.isListening) speech.stopListening();
            else speech.startListening();
          } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && onSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
        className={`w-full resize-none bg-transparent outline-none text-foreground placeholder:text-muted-foreground/60 ${size === 'lg' ? 'text-ui-lg px-5 pt-4 pb-12' : 'text-ui-base px-3.5 pt-3 pb-10'}`}
      />
      {speech.isListening && (
        <p className={`absolute left-0 right-14 bottom-2.5 truncate text-ui-sm italic text-muted-foreground ${size === 'lg' ? 'px-5' : 'px-3.5'}`}>
          {speech.interimTranscript || 'Listening…'}
        </p>
      )}
      {speech.error && !speech.isListening && (
        <p role="alert" className={`absolute left-0 right-14 bottom-2 flex items-start gap-1.5 text-ui-xs leading-snug text-amber-400 line-clamp-2 ${size === 'lg' ? 'px-5' : 'px-3.5'}`}>
          <MicOff className="w-3.5 h-3.5 mt-px flex-shrink-0" /> {speech.error}
        </p>
      )}
      {!speech.isSupported && (
        <span
          title="Voice input needs Chrome, Edge or Safari. You can still type."
          className={`absolute right-2.5 bottom-2.5 flex items-center justify-center rounded-full bg-secondary/60 text-muted-foreground/50 cursor-not-allowed ${size === 'lg' ? 'w-10 h-10' : 'w-8 h-8'}`}
        >
          <MicOff className="w-4 h-4" />
        </span>
      )}
      {speech.isSupported && (
        <button
          type="button"
          onClick={speech.isListening ? speech.stopListening : speech.startListening}
          title={speech.isListening ? 'Stop (Ctrl+Shift+M)' : 'Speak (Ctrl+Shift+M)'}
          className={`absolute right-2.5 bottom-2.5 flex items-center justify-center rounded-full transition-all ${size === 'lg' ? 'w-10 h-10' : 'w-8 h-8'} ${
            speech.isListening
              ? 'bg-red-500 text-white shadow-[0_0_0_6px_rgba(239,68,68,0.18)] animate-pulse'
              : 'bg-secondary text-muted-foreground hover:bg-primary/15 hover:text-primary'
          }`}
        >
          {speech.isListening ? <Square className="w-3.5 h-3.5 fill-current" /> : <Mic className={size === 'lg' ? 'w-4.5 h-4.5' : 'w-4 h-4'} />}
        </button>
      )}
    </div>
  );
});
