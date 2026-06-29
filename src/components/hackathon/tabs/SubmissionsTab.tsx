/**
 * Submissions tab — gallery of team submissions.
 * - Team leaders see a "Submit / Edit project" affordance for their team.
 * - Everyone can cast a community vote (if voting is enabled).
 */

import { useState } from 'react';
import {
  FileCode2,
  Github,
  ExternalLink,
  Video,
  Presentation,
  Heart,
  Plus,
  Pencil,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  apiClient,
  type HackathonDetail,
  type HackathonSubmission,
  type HackathonTeam,
} from '../../../api/client';
import { PrimaryButton, GhostButton } from '../hackathonShared';
import { inputClass } from '../hackathonStyles';
import { AIGenerateButton } from '../AIGenerateButton';

export function SubmissionsTab({
  detail,
  onChanged,
}: {
  detail: HackathonDetail;
  onChanged: () => Promise<void> | void;
}) {
  const [editTeam, setEditTeam] = useState<HackathonTeam | null>(null);
  const [voteBusy, setVoteBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Team(s) I lead, so I can submit for them.
  const myLedTeams = detail.teams.filter(
    (t) => t.leader_email === detail.your_email,
  );

  const vote = async (sub: HackathonSubmission) => {
    setVoteBusy(sub.submission_id);
    setError(null);
    try {
      await apiClient.voteSubmission(detail.hackathon_id, sub.submission_id);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to vote');
    } finally {
      setVoteBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-ui-sm text-muted-foreground">
          {detail.submissions.length}{' '}
          {detail.submissions.length === 1 ? 'submission' : 'submissions'}
        </p>
        {myLedTeams.map((t) => (
          <PrimaryButton key={t.team_id} onClick={() => setEditTeam(t)}>
            {t.has_submission ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {t.has_submission ? `Edit ${t.name}'s submission` : `Submit for ${t.name}`}
          </PrimaryButton>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-ui-xs text-rose-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {detail.submissions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
          <FileCode2 className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-ui-sm text-muted-foreground">No submissions yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {detail.submissions.map((sub) => (
            <div key={sub.submission_id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div>
                  <h3 className="text-ui-md font-semibold text-foreground">{sub.title}</h3>
                  <p className="text-ui-2xs text-muted-foreground">by {sub.team_name}</p>
                </div>
                {detail.has_voting && (
                  <button
                    onClick={() => vote(sub)}
                    disabled={voteBusy === sub.submission_id}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-ui-2xs font-medium border transition-all ${
                      sub.voted_by_me
                        ? 'text-rose-400 bg-rose-500/15 border-rose-500/30'
                        : 'text-muted-foreground border-border hover:text-rose-400 hover:border-rose-500/30'
                    }`}
                  >
                    {voteBusy === sub.submission_id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Heart
                        className={`w-3.5 h-3.5 ${sub.voted_by_me ? 'fill-rose-400' : ''}`}
                      />
                    )}
                    {sub.vote_count}
                  </button>
                )}
              </div>
              {sub.description && (
                <p className="text-ui-xs text-muted-foreground my-2">{sub.description}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                <LinkChip icon={Github} url={sub.repo_url} label="Repo" />
                <LinkChip icon={ExternalLink} url={sub.demo_url} label="Demo" />
                <LinkChip icon={Video} url={sub.video_url} label="Video" />
                <LinkChip icon={Presentation} url={sub.slides_url} label="Slides" />
              </div>
            </div>
          ))}
        </div>
      )}

      {editTeam && (
        <SubmitModal
          detail={detail}
          team={editTeam}
          existing={detail.submissions.find((s) => s.team_id === editTeam.team_id) || null}
          onClose={() => setEditTeam(null)}
          onSaved={async () => {
            setEditTeam(null);
            await onChanged();
          }}
        />
      )}
    </div>
  );
}

function LinkChip({
  icon: Icon,
  url,
  label,
}: {
  icon: typeof Github;
  url: string;
  label: string;
}) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2.5 py-1 text-ui-2xs text-foreground hover:border-primary/40 hover:text-primary transition-all"
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </a>
  );
}

function SubmitModal({
  detail,
  team,
  existing,
  onClose,
  onSaved,
}: {
  detail: HackathonDetail;
  team: HackathonTeam;
  existing: HackathonSubmission | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [title, setTitle] = useState(existing?.title || '');
  const [description, setDescription] = useState(existing?.description || '');
  const [repoUrl, setRepoUrl] = useState(existing?.repo_url || '');
  const [demoUrl, setDemoUrl] = useState(existing?.demo_url || '');
  const [videoUrl, setVideoUrl] = useState(existing?.video_url || '');
  const [slidesUrl, setSlidesUrl] = useState(existing?.slides_url || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) {
      setError('A project title is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiClient.submitProject(detail.hackathon_id, team.team_id, {
        title: title.trim(),
        description: description.trim(),
        repo_url: repoUrl.trim(),
        demo_url: demoUrl.trim(),
        video_url: videoUrl.trim(),
        slides_url: slidesUrl.trim(),
      });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-auto rounded-2xl border border-border bg-card shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between px-5 py-4 border-b border-border bg-card">
          <h2 className="text-ui-md font-semibold text-foreground">
            {existing ? 'Edit submission' : `Submit for ${team.name}`}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-ui-xs text-rose-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          <LabeledInput label="Project title" required value={title} onChange={setTitle} placeholder="e.g. ChurnSense" />
          <div>
            <label className="block text-ui-xs font-medium text-foreground mb-1.5">
              Description
            </label>
            <textarea
              className={`${inputClass} min-h-[4.5rem] resize-y`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does it do, and why does it matter?"
            />
            <div className="mt-1.5">
              <AIGenerateButton
                field="submission_description"
                label="Draft summary with AI"
                context={{ title, notes: description, hackathon_title: detail.title }}
                onGenerated={setDescription}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <LabeledInput label="Repo URL" value={repoUrl} onChange={setRepoUrl} placeholder="https://github.com/…" />
            <LabeledInput label="Demo URL" value={demoUrl} onChange={setDemoUrl} placeholder="https://…" />
            <LabeledInput label="Video URL" value={videoUrl} onChange={setVideoUrl} placeholder="https://…" />
            <LabeledInput label="Slides URL" value={slidesUrl} onChange={setSlidesUrl} placeholder="https://…" />
          </div>
        </div>
        <div className="sticky bottom-0 flex items-center justify-end gap-3 px-5 py-4 border-t border-border bg-card">
          <GhostButton onClick={onClose} disabled={saving}>
            Cancel
          </GhostButton>
          <PrimaryButton onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {existing ? 'Save changes' : 'Submit project'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  required,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-ui-xs font-medium text-foreground mb-1.5">
        {label}
        {required && <span className="text-rose-400 ml-0.5">*</span>}
      </label>
      <input
        className={inputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
