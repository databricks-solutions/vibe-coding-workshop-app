/**
 * CreateHackathonForm — modal for creating a hackathon (organizer flow).
 *
 * Mirrors the detail level of HackathonHive's CreateHackathon.tsx, rebuilt in
 * V2V's Tailwind idiom and grouped into sections: Basics, Schedule, Logistics,
 * Prize, Topics, Judging criteria, and Feature toggles. Dates use native
 * datetime-local inputs (no extra deps). AI-assist drafts the descriptions.
 */

import { useState } from 'react';
import { X, Plus, Loader2, AlertCircle } from 'lucide-react';
import { apiClient } from '../../api/client';
import { PrimaryButton, GhostButton } from './hackathonShared';
import { inputClass } from './hackathonStyles';
import { AIGenerateButton } from './AIGenerateButton';

const DEFAULT_CRITERIA = ['Innovation', 'Technical', 'Presentation', 'Impact'];

/** datetime-local -> ISO string (or null). */
function toIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function CreateHackathonForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (hackathonId: string) => void;
}) {
  // Basics
  const [title, setTitle] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [hackathonType, setHackathonType] = useState('online');
  // Logistics
  const [location, setLocation] = useState('');
  const [venue, setVenue] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(100);
  const [maxTeamSize, setMaxTeamSize] = useState(4);
  const [minTeamSize, setMinTeamSize] = useState(1);
  // Schedule
  const [registrationStart, setRegistrationStart] = useState('');
  const [registrationEnd, setRegistrationEnd] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submissionDeadline, setSubmissionDeadline] = useState('');
  // Prize
  const [totalPrizePool, setTotalPrizePool] = useState(0);
  const [prizeDescription, setPrizeDescription] = useState('');
  // Rules / topics
  const [rules, setRules] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState('');
  // Judging
  const [criteria, setCriteria] = useState<string[]>([...DEFAULT_CRITERIA]);
  const [newCriterion, setNewCriterion] = useState('');
  // Features
  const [hasTeamMatching, setHasTeamMatching] = useState(true);
  const [hasChat, setHasChat] = useState(true);
  const [hasVoting, setHasVoting] = useState(true);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isInPerson = hackathonType !== 'online';

  const addChip = (
    value: string,
    list: string[],
    setList: (l: string[]) => void,
    clear: () => void,
  ) => {
    const v = value.trim();
    if (v && !list.includes(v)) {
      setList([...list, v]);
      clear();
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('A title is required.');
      return;
    }
    if (criteria.length === 0) {
      setError('Add at least one judging criterion.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { hackathon_id } = await apiClient.createHackathon({
        title: title.trim(),
        short_description: shortDescription.trim(),
        description: description.trim(),
        hackathon_type: hackathonType,
        location: location.trim(),
        venue: venue.trim(),
        registration_start: toIso(registrationStart),
        registration_end: toIso(registrationEnd),
        start_date: toIso(startDate),
        end_date: toIso(endDate),
        submission_deadline: toIso(submissionDeadline),
        max_participants: maxParticipants,
        max_team_size: maxTeamSize,
        min_team_size: minTeamSize,
        total_prize_pool: totalPrizePool,
        prize_description: prizeDescription.trim(),
        rules: rules.trim(),
        topics,
        judging_criteria: criteria,
        has_team_matching: hasTeamMatching,
        has_chat: hasChat,
        has_voting: hasVoting,
      });
      onCreated(hackathon_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create hackathon');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-auto rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-border bg-card">
          <h2 className="text-ui-md font-semibold text-foreground">Create a Hackathon</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-ui-xs text-rose-400">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Basics */}
          <Section title="Basics">
            <Field label="Title" required>
              <input
                data-testid="hk-title"
                className={inputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. V2V Build-Off 2026"
              />
            </Field>
            <Field label="Short description">
              <input
                className={inputClass}
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="One-line summary shown on the card"
              />
              <div className="mt-1.5">
                <AIGenerateButton
                  field="hackathon_short"
                  label="Draft tagline with AI"
                  context={{ title, notes: description, hackathon_type: hackathonType }}
                  onGenerated={setShortDescription}
                />
              </div>
            </Field>
            <Field label="Description">
              <textarea
                className={`${inputClass} min-h-[5rem] resize-y`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's the challenge, theme, and goal?"
              />
              <div className="mt-1.5">
                <AIGenerateButton
                  field="hackathon_description"
                  label="Draft description with AI"
                  context={{ title, notes: description, hackathon_type: hackathonType }}
                  onGenerated={setDescription}
                />
              </div>
            </Field>
          </Section>

          {/* Logistics */}
          <Section title="Format & logistics">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Format">
                <select
                  className={inputClass}
                  value={hackathonType}
                  onChange={(e) => setHackathonType(e.target.value)}
                >
                  <option value="online">Online</option>
                  <option value="offline">In-person</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </Field>
              <Field label="Max participants">
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(Math.max(1, Number(e.target.value)))}
                />
              </Field>
              <div />
            </div>
            {isInPerson && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Location">
                  <input
                    className={inputClass}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="City / region"
                  />
                </Field>
                <Field label="Venue">
                  <input
                    className={inputClass}
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    placeholder="Building / address"
                  />
                </Field>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Min team size">
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={minTeamSize}
                  onChange={(e) => setMinTeamSize(Math.max(1, Number(e.target.value)))}
                />
              </Field>
              <Field label="Max team size">
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={maxTeamSize}
                  onChange={(e) => setMaxTeamSize(Math.max(1, Number(e.target.value)))}
                />
              </Field>
            </div>
          </Section>

          {/* Schedule */}
          <Section title="Schedule (optional)">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Registration opens">
                <input type="datetime-local" className={inputClass} value={registrationStart} onChange={(e) => setRegistrationStart(e.target.value)} />
              </Field>
              <Field label="Registration closes">
                <input type="datetime-local" className={inputClass} value={registrationEnd} onChange={(e) => setRegistrationEnd(e.target.value)} />
              </Field>
              <Field label="Event starts">
                <input type="datetime-local" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </Field>
              <Field label="Event ends">
                <input type="datetime-local" className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </Field>
              <Field label="Submission deadline">
                <input type="datetime-local" className={inputClass} value={submissionDeadline} onChange={(e) => setSubmissionDeadline(e.target.value)} />
              </Field>
            </div>
          </Section>

          {/* Prize */}
          <Section title="Prize">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Prize pool ($)">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={totalPrizePool}
                  onChange={(e) => setTotalPrizePool(Math.max(0, Number(e.target.value)))}
                />
              </Field>
              <div className="col-span-2">
                <Field label="Prize description">
                  <input
                    className={inputClass}
                    value={prizeDescription}
                    onChange={(e) => setPrizeDescription(e.target.value)}
                    placeholder="e.g. Swag, recognition, and bragging rights"
                  />
                </Field>
              </div>
            </div>
          </Section>

          {/* Topics */}
          <Section title="Topics / tracks (optional)">
            <ChipEditor
              items={topics}
              onRemove={(t) => setTopics(topics.filter((x) => x !== t))}
              value={newTopic}
              onChange={setNewTopic}
              onAdd={() => addChip(newTopic, topics, setTopics, () => setNewTopic(''))}
              placeholder="Add a topic (e.g. GenAI)"
            />
          </Section>

          {/* Rules */}
          <Section title="Rules (optional)">
            <textarea
              className={`${inputClass} min-h-[4rem] resize-y`}
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              placeholder="Eligibility, what counts, code of conduct…"
            />
          </Section>

          {/* Judging */}
          <Section title="Judging criteria">
            <ChipEditor
              items={criteria}
              onRemove={(c) => setCriteria(criteria.filter((x) => x !== c))}
              value={newCriterion}
              onChange={setNewCriterion}
              onAdd={() => addChip(newCriterion, criteria, setCriteria, () => setNewCriterion(''))}
              placeholder="Add a criterion (e.g. Creativity)"
            />
            <p className="text-ui-2xs text-muted-foreground/70 mt-1">
              Judges score each criterion 0–10; the overall is their average.
            </p>
          </Section>

          {/* Features */}
          <Section title="Features">
            <Toggle label="Team matching" checked={hasTeamMatching} onChange={setHasTeamMatching} />
            <Toggle label="In-event chat" checked={hasChat} onChange={setHasChat} />
            <Toggle
              label="Community (people's-choice) voting"
              checked={hasVoting}
              onChange={setHasVoting}
            />
          </Section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 px-5 py-4 border-t border-border bg-card">
          <GhostButton onClick={onClose} disabled={saving}>
            Cancel
          </GhostButton>
          <span data-testid="hk-create-submit">
            <PrimaryButton onClick={handleSubmit} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create
            </PrimaryButton>
          </span>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/30 p-4">
      <h3 className="text-ui-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-ui-xs font-medium text-foreground mb-1.5">
        {label}
        {required && <span className="text-rose-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function ChipEditor({
  items,
  onRemove,
  value,
  onChange,
  onAdd,
  placeholder,
}: {
  items: string[];
  onRemove: (item: string) => void;
  value: string;
  onChange: (v: string) => void;
  onAdd: () => void;
  placeholder: string;
}) {
  return (
    <div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {items.map((c) => (
            <span
              key={c}
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-ui-2xs font-medium text-foreground"
            >
              {c}
              <button onClick={() => onRemove(c)} className="text-muted-foreground hover:text-rose-400">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          className={inputClass}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onAdd();
            }
          }}
          placeholder={placeholder}
        />
        <GhostButton onClick={onAdd}>
          <Plus className="w-4 h-4" />
        </GhostButton>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
          checked ? 'bg-primary' : 'bg-secondary'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
      <span className="text-ui-sm text-foreground">{label}</span>
    </label>
  );
}
