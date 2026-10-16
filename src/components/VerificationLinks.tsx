import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, ExternalLink, ArrowUpRight, Loader2 } from 'lucide-react';
import { apiClient } from '../api/client';
import { hasVerificationLinks, resolveVerificationLinks } from './VerificationLinks.utils';

interface VerificationLinksProps {
  sectionTag: string;
  sessionId: string | null;
}

export function VerificationLinks({ sectionTag, sessionId }: VerificationLinksProps) {
  const hasLinks = hasVerificationLinks(sectionTag);

  const [params, setParams] = useState<Record<string, string> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    // Steps without verification links never fetch session parameters.
    if (!hasLinks || !sessionId || fetchedRef.current === sessionId) return;
    fetchedRef.current = sessionId;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the session-parameters fetch this effect starts
    setIsLoading(true);
    apiClient.getSessionParameters(sessionId)
      .then(data => {
        const map: Record<string, string> = {};
        for (const p of data) {
          map[p.param_key] = p.param_value;
        }
        setParams(map);
      })
      .catch(err => { console.error('Failed to fetch session parameters for verification links:', err); setParams(null); })
      .finally(() => setIsLoading(false));
  }, [hasLinks, sessionId]);

  if (!hasLinks) return null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 text-muted-foreground mb-3">
        <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
        <span className="text-ui-sm">Loading verification links...</span>
      </div>
    );
  }

  if (!params) return null;

  const resolvedLinks = resolveVerificationLinks(sectionTag, params);

  if (resolvedLinks.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border border-violet-500/30 bg-violet-500/5 border-l-4 border-l-violet-500 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 mb-0.5">
          <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
          <h4 className="text-ui-base font-semibold text-foreground">Verify Deployed Assets</h4>
        </div>
        <p className="text-ui-xs text-muted-foreground ml-6">
          Open your Databricks workspace to verify the results.
        </p>
      </div>

      {/* Links */}
      <div className="px-4 pb-3 space-y-2">
        {resolvedLinks.map((link, idx) => (
          <a
            key={idx}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-md bg-secondary/30 hover:bg-secondary/50 p-3 transition-colors group"
          >
            <div className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <span className="text-ui-sm font-medium text-violet-400 group-hover:text-violet-300 transition-colors">
                {link.label}
              </span>
              <ArrowUpRight className="w-3 h-3 text-muted-foreground ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-ui-xs text-muted-foreground mt-1.5 ml-5.5 leading-relaxed">
              {link.description}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
