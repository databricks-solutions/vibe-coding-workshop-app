/**
 * JudgeSelector — organizer control for assigning judges to a hackathon.
 *
 * Pick from workshop users (fetched via getJudgeCandidates), or invite anyone
 * by typing an email. Selected emails are bulk-assigned via assignJudges; the
 * current roster is shown as removable violet chips. Components-only file to
 * satisfy react-refresh/only-export-components.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Search,
  CheckCircle2,
  Circle,
  X,
  Loader2,
  AlertCircle,
  UserPlus,
  Gavel,
  Mail,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { apiClient } from '../../api/client';
import { PrimaryButton } from './hackathonShared';
import { inputClass } from './hackathonStyles';

type Candidate = { email: string; name: string };

function looksLikeEmail(text: string): boolean {
  const t = text.trim();
  return t.includes('@') && t.includes('.') && !/\s/.test(t);
}

export function JudgeSelector({
  hackathonId,
  judges,
  onChanged,
}: {
  hackathonId: string;
  judges: { email: string; name: string }[];
  onChanged: () => Promise<void> | void;
}) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCandidates = useCallback(async () => {
    try {
      const res = await apiClient.getJudgeCandidates(hackathonId);
      setCandidates(res.candidates ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load candidates');
    } finally {
      setLoaded(true);
    }
  }, [hackathonId]);

  useEffect(() => {
    void fetchCandidates();
  }, [fetchCandidates]);

  const judgeEmails = new Set(judges.map((j) => j.email.toLowerCase()));

  const searchLower = search.trim().toLowerCase();
  const filtered = searchLower
    ? candidates.filter(
        (c) =>
          c.name.toLowerCase().includes(searchLower) ||
          c.email.toLowerCase().includes(searchLower),
      )
    : candidates;

  // Offer an "Invite <email>" row when the typed text is an email that matches
  // no candidate (and isn't already an assigned judge or selected).
  const typed = search.trim();
  const typedLower = typed.toLowerCase();
  const noCandidateMatch = !candidates.some((c) => c.email.toLowerCase() === typedLower);
  const showInvite =
    looksLikeEmail(typed) &&
    noCandidateMatch &&
    !judgeEmails.has(typedLower) &&
    !selected.has(typedLower);

  const toggle = (email: string) => {
    const key = email.toLowerCase();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const addInvite = (email: string) => {
    const key = email.trim().toLowerCase();
    if (!key) return;
    setSelected((prev) => new Set(prev).add(key));
    setSearch('');
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && looksLikeEmail(typed) && !judgeEmails.has(typedLower)) {
      e.preventDefault();
      addInvite(typed);
    }
  };

  const removeSelected = (email: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(email);
      return next;
    });
  };

  const assign = async () => {
    if (selected.size === 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.assignJudges(hackathonId, [...selected]);
      setSelected(new Set());
      setSearch('');
      await onChanged();
      await fetchCandidates();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to assign judges');
    } finally {
      setSaving(false);
    }
  };

  const removeJudge = async (email: string) => {
    if (!window.confirm(`Remove ${email} as a judge?`)) return;
    setError(null);
    try {
      await apiClient.removeJudge(hackathonId, email);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove judge');
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-ui-xs text-rose-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          data-testid="judge-search"
          className={`${inputClass} pl-9`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder="Search workshop users, or type an email to invite…"
        />
      </div>

      <p className="text-ui-2xs text-muted-foreground/80">
        Pick from workshop users below, or type an email to invite anyone.
      </p>

      {/* Candidate list */}
      <div className="max-h-48 overflow-auto rounded-md border border-border bg-background/40">
        {showInvite && (
          <button
            type="button"
            data-testid="judge-invite-row"
            onClick={() => addInvite(typed)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-ui-sm text-violet-400 hover:bg-violet-500/10 transition-colors border-b border-border"
          >
            <UserPlus className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Invite “{typed}”</span>
          </button>
        )}

        {!loaded ? (
          <div className="flex items-center gap-2 px-3 py-4 text-ui-xs text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading workshop users…
          </div>
        ) : candidates.length === 0 ? (
          <p className="px-3 py-4 text-ui-xs text-muted-foreground/70">
            No workshop users found — type an email to invite a judge.
          </p>
        ) : filtered.length === 0 && !showInvite ? (
          <p className="px-3 py-4 text-ui-xs text-muted-foreground/70">
            No users match “{search}”.
          </p>
        ) : (
          filtered.map((c, i) => {
            const key = c.email.toLowerCase();
            const isJudge = judgeEmails.has(key);
            const isSelected = selected.has(key);
            return (
              <motion.button
                key={c.email}
                type="button"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, delay: Math.min(i * 0.015, 0.2) }}
                onClick={() => !isJudge && toggle(c.email)}
                disabled={isJudge}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                  isJudge
                    ? 'opacity-50 cursor-default'
                    : 'hover:bg-secondary/50 cursor-pointer'
                }`}
              >
                {isSelected ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-violet-400" />
                ) : (
                  <Circle className="w-4 h-4 flex-shrink-0 text-muted-foreground/50" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-ui-sm text-foreground">{c.name}</span>
                  <span className="block truncate text-ui-2xs text-muted-foreground">{c.email}</span>
                </span>
                {isJudge && (
                  <span className="inline-flex items-center gap-1 text-ui-2xs text-violet-400">
                    <Gavel className="w-3 h-3" />
                    Judge
                  </span>
                )}
              </motion.button>
            );
          })
        )}
      </div>

      {/* Pending selection chips */}
      {selected.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {[...selected].map((email) => (
            <motion.span
              key={email}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.12 }}
              className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/15 px-2.5 py-1 text-ui-2xs font-medium text-violet-400"
            >
              <Mail className="w-3 h-3" />
              {email}
              <button
                type="button"
                onClick={() => removeSelected(email)}
                className="ml-0.5 rounded-full hover:bg-violet-500/25 p-0.5 transition-colors"
                aria-label={`Remove ${email} from selection`}
              >
                <X className="w-3 h-3" />
              </button>
            </motion.span>
          ))}
        </div>
      )}

      {/* Assign */}
      <span data-testid="judge-assign-btn">
        <PrimaryButton onClick={assign} disabled={selected.size === 0 || saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          Assign {selected.size} judge{selected.size === 1 ? '' : 's'}
        </PrimaryButton>
      </span>

      {/* Current judges */}
      <div className="pt-2">
        <p className="text-ui-2xs font-medium text-muted-foreground mb-2">Current judges</p>
        {judges.length === 0 ? (
          <p className="text-ui-xs text-muted-foreground/70">No judges assigned yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {judges.map((j) => (
              <motion.span
                key={j.email}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.12 }}
                className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/15 px-2.5 py-1 text-ui-2xs font-medium text-violet-400"
              >
                <Gavel className="w-3 h-3" />
                {j.name || j.email}
                <button
                  type="button"
                  onClick={() => void removeJudge(j.email)}
                  className="ml-0.5 rounded-full hover:bg-violet-500/25 p-0.5 transition-colors"
                  aria-label={`Remove ${j.email} as judge`}
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
