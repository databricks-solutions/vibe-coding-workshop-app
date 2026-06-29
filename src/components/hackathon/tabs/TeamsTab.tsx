/** Teams tab — browse teams; participant can create one or join an open one. */

import { useState } from 'react';
import { Users, Crown, Plus, X, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiClient, type HackathonDetail, type HackathonTeam } from '../../../api/client';
import { PrimaryButton, GhostButton } from '../hackathonShared';
import { inputClass } from '../hackathonStyles';
import { AIGenerateButton } from '../AIGenerateButton';

export function TeamsTab({
  detail,
  onChanged,
}: {
  detail: HackathonDetail;
  onChanged: () => Promise<void> | void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [busyTeam, setBusyTeam] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onTeam = detail.my_team_ids.length > 0;

  const join = async (team: HackathonTeam) => {
    setBusyTeam(team.team_id);
    setError(null);
    try {
      await apiClient.joinTeam(detail.hackathon_id, team.team_id);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join team');
    } finally {
      setBusyTeam(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-ui-sm text-muted-foreground">
          {detail.teams.length} {detail.teams.length === 1 ? 'team' : 'teams'} · team size{' '}
          {detail.min_team_size}–{detail.max_team_size}
        </p>
        {!onTeam && (
          <PrimaryButton onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            Create a team
          </PrimaryButton>
        )}
        {onTeam && (
          <span className="inline-flex items-center gap-1.5 text-ui-xs text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            You're on a team
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-ui-xs text-rose-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {detail.teams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
          <Users className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-ui-sm text-muted-foreground">
            No teams yet. {onTeam ? '' : 'Create the first one!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {detail.teams.map((team) => {
            const full = team.member_count >= team.max_members;
            return (
              <div
                key={team.team_id}
                className={`rounded-xl border bg-card p-4 ${
                  team.is_mine ? 'border-primary/40' : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-ui-md font-semibold text-foreground">{team.name}</h3>
                  {team.is_mine && (
                    <span className="text-ui-2xs font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
                      Your team
                    </span>
                  )}
                </div>
                {team.description && (
                  <p className="text-ui-xs text-muted-foreground mb-3">{team.description}</p>
                )}
                <div className="space-y-1 mb-3">
                  {team.members.map((m) => (
                    <div key={m.email} className="flex items-center gap-1.5 text-ui-xs text-foreground">
                      {m.role === 'leader' ? (
                        <Crown className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <Users className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                      {m.name}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border/60">
                  <span className="text-ui-2xs text-muted-foreground">
                    {team.member_count}/{team.max_members} members
                    {team.has_submission && ' · submitted'}
                  </span>
                  {!onTeam && (
                    <GhostButton
                      onClick={() => join(team)}
                      disabled={full || busyTeam === team.team_id}
                    >
                      {busyTeam === team.team_id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : null}
                      {full ? 'Full' : 'Join'}
                    </GhostButton>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateTeamModal
          detail={detail}
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await onChanged();
          }}
        />
      )}
    </div>
  );
}

function CreateTeamModal({
  detail,
  onClose,
  onCreated,
}: {
  detail: HackathonDetail;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError('A team name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiClient.createTeam(detail.hackathon_id, {
        name: name.trim(),
        description: description.trim(),
        max_members: detail.max_team_size,
      });
      await onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create team');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-ui-md font-semibold text-foreground">Create a team</h2>
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
          <div>
            <label className="block text-ui-xs font-medium text-foreground mb-1.5">
              Team name<span className="text-rose-400 ml-0.5">*</span>
            </label>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. The Data Wranglers"
            />
          </div>
          <div>
            <label className="block text-ui-xs font-medium text-foreground mb-1.5">
              Description
            </label>
            <textarea
              className={`${inputClass} min-h-[4rem] resize-y`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's your team about?"
            />
            <div className="mt-1.5">
              <AIGenerateButton
                field="team_description"
                label="Draft bio with AI"
                context={{
                  team_name: name,
                  hackathon_title: detail.title,
                  notes: description,
                }}
                onGenerated={setDescription}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
          <GhostButton onClick={onClose} disabled={saving}>
            Cancel
          </GhostButton>
          <PrimaryButton onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create team
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
