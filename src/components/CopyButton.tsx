import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  copied: boolean;
  onClick: () => void;
  className?: string;
  disabled?: boolean;
  /** Enable glow animation to draw user attention */
  showGlow?: boolean;
  /** Size variant for the button */
  size?: 'sm' | 'md';
}

export function CopyButton({ 
  copied, 
  onClick, 
  className = '', 
  disabled = false,
  showGlow = false,
  size = 'md',
}: CopyButtonProps) {
  const sizeClasses = size === 'sm' 
    ? 'px-2 py-1 text-[11px] gap-1.5' 
    : 'px-2 py-0.5 text-[11px] gap-2';
  
  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses} ${
        copied 
          ? 'bg-emerald-900/40 text-emerald-400' 
          : showGlow && !disabled
          ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 animate-button-glow-copy'
          : ''
      } ${className}`}
    >
      {copied ? (
        <>
          <Check className={iconSize} />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <Copy className={iconSize} />
          <span>Copy to Clipboard</span>
        </>
      )}
    </button>
  );
}

