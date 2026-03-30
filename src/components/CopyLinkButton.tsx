import { useState } from 'react';
import { Link2, Check } from 'lucide-react';

interface CopyLinkButtonProps {
  sectionId: string;
}

/**
 * Subtle hover-only button that copies a direct link to a section.
 * Must be placed inside a parent with `className="group ..."`.
 */
export function CopyLinkButton({ sectionId }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = new URL(window.location.href);
    url.hash = sectionId;
    navigator.clipboard.writeText(url.toString()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={copied ? 'Link copied!' : 'Copy link to section'}
      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1.5 rounded-md hover:bg-secondary/60 text-muted-foreground hover:text-foreground cursor-pointer"
    >
      {copied
        ? <Check className="w-3.5 h-3.5 text-emerald-400" />
        : <Link2 className="w-3.5 h-3.5" />
      }
    </button>
  );
}
