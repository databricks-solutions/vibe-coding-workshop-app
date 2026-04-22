import { useRef, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy } from 'lucide-react';

const REMARK_PLUGINS = [remarkGfm];

interface CodeBlockProps {
  children: React.ReactNode;
  onCopy?: (ok: boolean) => void;
}

function CodeBlock({ children, onCopy }: CodeBlockProps) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const text = preRef.current?.innerText ?? '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopy?.(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      onCopy?.(false);
    }
  }

  return (
    <div className="relative group my-2">
      <pre
        ref={preRef}
        className="bg-background text-foreground p-3 pr-12 rounded overflow-x-auto border border-border text-ui-sm font-mono"
      >
        {children}
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : 'Copy to clipboard'}
        className={`absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-md border text-ui-2xs font-medium transition-all ${
          copied
            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            : 'bg-secondary/80 text-muted-foreground border-border hover:text-foreground hover:bg-secondary opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
        }`}
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        <span>{copied ? 'Copied' : 'Copy'}</span>
      </button>
    </div>
  );
}

function buildComponents(onCopy?: (ok: boolean) => void): Components {
  return {
    h1: ({ children }) => (
      <h1 className="text-ui-md2 font-semibold text-foreground border-b border-border pb-2 mb-3 mt-1">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-ui-md font-semibold text-foreground mt-4 mb-2">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-ui-base font-medium text-foreground mt-3 mb-1.5">{children}</h3>
    ),
    p: ({ children }) => (
      <p className="text-muted-foreground text-ui-base leading-relaxed mb-2">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="list-disc my-2 space-y-1 text-muted-foreground text-ui-base pl-5">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal my-2 space-y-1 text-muted-foreground text-ui-base pl-5">{children}</ol>
    ),
    li: ({ children }) => (
      <li className="text-muted-foreground leading-relaxed pl-1 [&>p]:inline [&>p]:m-0">
        {children}
      </li>
    ),
    code: ({ className, children }) => {
      const isInline = !className;
      if (isInline) {
        return (
          <code className="bg-secondary text-primary px-1 py-0.5 rounded text-ui-sm font-mono">
            {children}
          </code>
        );
      }
      return <code className={`${className ?? ''} font-mono text-ui-sm`}>{children}</code>;
    },
    pre: ({ children }) => <CodeBlock onCopy={onCopy}>{children}</CodeBlock>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-3 border-primary bg-primary/10 pl-3 py-1.5 my-2 text-ui-base italic text-muted-foreground">
        {children}
      </blockquote>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-foreground">{children}</strong>
    ),
    em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
    hr: () => <hr className="border-t border-border my-3" />,
    a: ({ href, children }) => (
      <a
        href={href}
        className="text-primary hover:text-primary/80 underline text-ui-base"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto my-2">
        <table className="min-w-full border border-border rounded text-ui-sm">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="bg-secondary px-3 py-1.5 text-left font-medium text-foreground border-b border-border">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-3 py-1.5 text-muted-foreground border-b border-border/50">{children}</td>
    ),
  };
}

interface MarkdownWithCopyProps {
  content: string;
  onCopy?: (ok: boolean) => void;
  className?: string;
}

export function MarkdownWithCopy({ content, onCopy, className = '' }: MarkdownWithCopyProps) {
  const components = buildComponents(onCopy);
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={components}>
        {content ?? ''}
      </ReactMarkdown>
    </div>
  );
}
