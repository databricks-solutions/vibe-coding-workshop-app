/**
 * Judging tab — judges score each submission across the hackathon's criteria
 * (0–10 each; overall is their average) and leave feedback. Organizers see the
 * same list read-only (the score panel only lets assigned judges submit).
 */

import { useState } from 'react';
import { Gavel, Loader2, AlertCircle, CheckCircle2, ChevronDown, Sparkles } from 'lucide-react';
import {
  apiClient,
  type HackathonDetail,
  type HackathonSubmission,
} from '../../../api/client';
import { PrimaryButton } from '../hackathonShared';
import { inputClass } from '../hackathonStyles';
import { AIGenerateButton } from '../AIGenerateButton';

export function JudgingTab({
  detail,
  onChanged,
}: {
  detail: HackathonDetail;
  onChanged: () => Promise<void> | void;
}) {
  const isJudge = detail.your_role === 'judge';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-ui-sm text-muted-foreground">
        <Gavel className="w-4 h-4" />
        {isJudge
          ? 'Score each submission on the criteria below.'
          : "You're viewing judging as the organizer (read-only)."}
      </div>

      {detail.submissions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
          <Gavel className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-ui-sm text-muted-foreground">No submissions to judge yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {detail.submissions.map((sub) => (
            <ScorePanel
              key={sub.submission_id}
              detail={detail}
              sub={sub}
              canScore={isJudge}
              onSaved={onChanged}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ScorePanel({
  detail,
  sub,
  canScore,
  onSaved,
}: {
  detail: HackathonDetail;
  sub: HackathonSubmission;
  canScore: boolean;
  onSaved: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(!sub.scored_by_me && canScore);
  const [scores, setScores] = useState<Record<string, number>>(() =>
    // Pre-fill from the judge's prior score if present, else default to 5.
    Object.fromEntries(
      detail.judging_criteria.map((c) => [c, sub.my_score?.criteria?.[c] ?? 5]),
    ),
  );
  const [feedback, setFeedback] = useState(sub.my_score?.feedback ?? '');
  // Whether the CURRENT feedback text was AI-drafted (transparency). Set true when
  // a draft is accepted; cleared if the judge edits the text themselves.
  const [aiAssisted, setAiAssisted] = useState(sub.my_score?.ai_assisted ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOverall, setSavedOverall] = useState<number | null>(null);

  const avg =
    detail.judging_criteria.length > 0
      ? detail.judging_criteria.reduce((s, c) => s + (scores[c] ?? 0), 0) /
        detail.judging_criteria.length
      : 0;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiClient.scoreSubmission(detail.hackathon_id, sub.submission_id, {
        criteria: scores,
        feedback: feedback.trim(),
        ai_assisted: aiAssisted && feedback.trim().length > 0,
      });
      setSavedOverall(res.overall);
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit score');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-ui-md font-semibold text-foreground">{sub.title}</span>
          <span className="text-ui-2xs text-muted-foreground">by {sub.team_name}</span>
        </div>
        <div className="flex items-center gap-2">
          {(sub.scored_by_me || savedOverall !== null) && (
            <span className="inline-flex items-center gap-1 text-ui-2xs text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {savedOverall !== null ? `Scored ${savedOverall}` : 'Scored'}
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-border/60 space-y-4">
          {sub.description && (
            <p className="text-ui-xs text-muted-foreground">{sub.description}</p>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-ui-xs text-rose-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-3">
            {detail.judging_criteria.map((c) => (
              <div key={c} className="flex items-center gap-3">
                <span className="text-ui-sm text-foreground w-32 flex-shrink-0">{c}</span>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={scores[c] ?? 0}
                  disabled={!canScore}
                  onChange={(e) =>
                    setScores({ ...scores, [c]: Number(e.target.value) })
                  }
                  className="flex-1 accent-primary disabled:opacity-50"
                />
                <span className="text-ui-sm font-mono tabular-nums text-foreground w-10 text-right">
                  {scores[c] ?? 0}/10
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-ui-sm">
            <span className="text-muted-foreground">Overall</span>
            <span className="font-bold text-primary text-ui-md">{avg.toFixed(1)}/10</span>
          </div>

          {canScore && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-ui-xs font-medium text-foreground">
                  Feedback
                </label>
                {aiAssisted && feedback.trim() && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-ui-2xs font-medium text-violet-400">
                    <Sparkles className="w-3 h-3" />
                    AI-assisted
                  </span>
                )}
              </div>
              <textarea
                className={`${inputClass} min-h-[4rem] resize-y`}
                value={feedback}
                onChange={(e) => {
                  setFeedback(e.target.value);
                  // The judge is now writing this themselves — no longer AI-drafted.
                  if (aiAssisted) setAiAssisted(false);
                }}
                placeholder="Constructive feedback for the team…"
              />
              <div className="mt-1.5 flex items-center gap-2">
                <AIGenerateButton
                  field="judge_feedback"
                  label="Draft feedback with AI"
                  context={{ title: sub.title, scores, notes: feedback }}
                  onGenerated={(text) => {
                    setFeedback(text);
                    setAiAssisted(true); // accepted an AI draft → mark transparently
                  }}
                />
                <span className="text-ui-2xs text-muted-foreground/70">
                  AI-drafted feedback is labeled for transparency. Edit it and it becomes your own.
                </span>
              </div>
            </div>
          )}

          {canScore && (
            <div className="flex justify-end">
              <PrimaryButton onClick={submit} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gavel className="w-4 h-4" />}
                {sub.scored_by_me ? 'Update score' : 'Submit score'}
              </PrimaryButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
