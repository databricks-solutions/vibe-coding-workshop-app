/**
 * AIGenerateButton — "✨ Generate with AI" affordance reused across hackathon
 * forms (descriptions, team bios, submission summaries, judge feedback).
 *
 * Calls the server-side /hackathons/ai/generate endpoint, which crafts a
 * focused prompt per field and hits Databricks Model Serving. Degrades
 * gracefully: when no serving endpoint is configured (local dev) the backend
 * returns available=false and we surface the notice inline instead of erroring.
 */

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { apiClient } from '../../api/client';

type Field =
  | 'hackathon_description'
  | 'hackathon_short'
  | 'team_description'
  | 'submission_description'
  | 'judge_feedback';

export function AIGenerateButton({
  field,
  context,
  onGenerated,
  label = 'Generate with AI',
  className = '',
}: {
  field: Field;
  context: Record<string, unknown>;
  onGenerated: (text: string) => void;
  label?: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const res = await apiClient.hackathonAiGenerate(field, context);
      if (res.available && res.text) {
        onGenerated(res.text);
      } else {
        setNotice(
          res.notice ||
            'AI generation is unavailable here (no model serving endpoint configured).',
        );
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'AI generation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`inline-flex flex-col items-start gap-1 ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-ui-2xs font-medium text-violet-400 bg-violet-500/10 border border-violet-500/30 hover:bg-violet-500/20 transition-all disabled:opacity-50"
        title="Draft this with AI"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Sparkles className="w-3.5 h-3.5" />
        )}
        {loading ? 'Generating…' : label}
      </button>
      {notice && (
        <span className="text-ui-2xs text-muted-foreground/80 max-w-xs">{notice}</span>
      )}
    </div>
  );
}
