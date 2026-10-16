// Markdown rendering config shared by MarkdownContent and PromptCopyPanel. Kept
// out of MarkdownContent.tsx so that file only exports components
// (react-refresh/only-export-components).
import { isValidElement, type ReactNode } from 'react';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Mermaid } from './MermaidDiagram';

export const REMARK_PLUGINS = [remarkGfm];

export const MARKDOWN_COMPONENTS: Components = {
  h1: ({ children }) => (
    <h1 className="text-ui-md2 font-semibold text-foreground border-b border-border pb-2 mb-3 mt-1">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-ui-md font-semibold text-foreground mt-4 mb-2">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-ui-base font-medium text-foreground mt-3 mb-1.5">
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-muted-foreground text-ui-base leading-relaxed mb-2">
      {children}
    </p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc my-2 space-y-1 text-muted-foreground text-ui-base pl-5">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal my-2 space-y-1 text-muted-foreground text-ui-base pl-5">
      {children}
    </ol>
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
    // Render ```mermaid fences as diagrams; all other fences stay on the styled path.
    if (className === 'language-mermaid') {
      return <Mermaid chart={String(children).replace(/\n$/, '')} />;
    }
    return (
      <code className="block bg-background text-foreground p-3 rounded overflow-x-auto text-ui-sm font-mono my-2 border border-border">
        {children}
      </code>
    );
  },
  pre: ({ children }) => {
    // Mermaid diagrams render as a block <div>; don't wrap them in <pre> (invalid
    // nesting + double border). Let the code component handle them directly.
    const child: ReactNode = Array.isArray(children) ? children[0] : children;
    if (isValidElement<{ className?: string }>(child) && child.props.className === 'language-mermaid') {
      return <>{children}</>;
    }
    return (
      <pre className="bg-background text-foreground p-3 rounded overflow-x-auto my-2 border border-border">
        {children}
      </pre>
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="border-l-3 border-primary bg-primary/10 pl-3 py-1.5 my-2 text-ui-base italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">
      {children}
    </strong>
  ),
  em: ({ children }) => (
    <em className="italic text-muted-foreground">
      {children}
    </em>
  ),
  hr: () => (
    <hr className="border-t border-border my-3" />
  ),
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
      <table className="min-w-full border border-border rounded text-ui-sm">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="bg-secondary px-3 py-1.5 text-left font-medium text-foreground border-b border-border">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-1.5 text-muted-foreground border-b border-border/50">
      {children}
    </td>
  ),
};
