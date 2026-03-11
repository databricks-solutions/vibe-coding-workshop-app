import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, ExternalLink, ArrowUpRight, Loader2 } from 'lucide-react';
import { apiClient } from '../api/client';
import { STEP_VERIFICATION_LINKS } from '../constants/verificationLinks';

interface VerificationLinksProps {
  sectionTag: string;
  sessionId: string | null;
}

function resolveUrl(template: string, params: Record<string, string>): string | null {
  const workspaceUrl = (params.workspace_url || '').replace(/\/+$/, '');
  const resolvedParams: Record<string, string> = { ...params, workspace_url: workspaceUrl ? workspaceUrl + '/' : '' };

  let url = template;
  const placeholders = template.match(/\{(\w+)\}/g);
  if (!placeholders) return template;

  for (const ph of placeholders) {
    const key = ph.slice(1, -1);
    const val = resolvedParams[key];
    if (!val) return null;
    const isAbsoluteUrl = /^https?:\/\//i.test(val);
    url = url.replace(ph, isAbsoluteUrl ? val : encodeURIComponent(val));
  }
  return url;
}

export function VerificationLinks({ sectionTag, sessionId }: VerificationLinksProps) {
  const linkDefs = STEP_VERIFICATION_LINKS[sectionTag];
  if (!linkDefs || linkDefs.length === 0) return null;

  const [params, setParams] = useState<Record<string, string> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionId || fetchedRef.current === sessionId) return;
    fetchedRef.current = sessionId;
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
  }, [sessionId]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 text-muted-foreground mb-3">
        <Loader2 className="w-4 h-4 animate-spin text-violet-400" />
        <span className="text-[12px]">Loading verification links...</span>
      </div>
    );
  }

  if (!params) return null;

  const resolvedLinks = linkDefs
    .map(link => ({ ...link, url: resolveUrl(link.urlTemplate, params) }))
    .filter(link => link.url !== null);

  if (resolvedLinks.length === 0) return null;

  return (
    <div className="mb-3 rounded-lg border border-violet-500/30 bg-violet-500/5 border-l-4 border-l-violet-500 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 mb-0.5">
          <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
          <h4 className="text-[13px] font-semibold text-foreground">Verify Deployed Assets</h4>
        </div>
        <p className="text-[11px] text-muted-foreground ml-6">
          Open your Databricks workspace to verify the results.
        </p>
      </div>

      {/* Links */}
      <div className="px-4 pb-3 space-y-2">
        {resolvedLinks.map((link, idx) => (
          <a
            key={idx}
            href={link.url!}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-md bg-secondary/30 hover:bg-secondary/50 p-3 transition-colors group"
          >
            <div className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <span className="text-[12px] font-medium text-violet-400 group-hover:text-violet-300 transition-colors">
                {link.label}
              </span>
              <ArrowUpRight className="w-3 h-3 text-muted-foreground ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5 ml-5.5 leading-relaxed">
              {link.description}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
}
