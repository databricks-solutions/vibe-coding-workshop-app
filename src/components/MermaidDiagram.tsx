import { useEffect, useState } from 'react';

// Lazily-rendered Mermaid diagram. `mermaid` is dynamically imported so it stays
// out of the initial bundle and only loads when a diagram is actually present.
// On any parse/render error it degrades gracefully to the raw Mermaid source.
let mermaidIdCounter = 0;
export function Mermaid({ chart }: { chart: string }) {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const id = `mermaid-diagram-${mermaidIdCounter++}`;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' });
        const { svg } = await mermaid.render(id, chart);
        if (!cancelled) { setSvg(svg); setError(false); }
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [chart]);

  if (error) {
    // Graceful degradation — show the readable Mermaid source.
    return (
      <pre className="bg-background text-foreground p-3 rounded overflow-x-auto my-2 border border-border text-ui-sm font-mono">
        {chart}
      </pre>
    );
  }
  if (!svg) {
    return (
      <div className="my-3 text-ui-sm text-muted-foreground italic">Rendering diagram…</div>
    );
  }
  return (
    <div
      className="mermaid-diagram my-3 flex justify-center overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
