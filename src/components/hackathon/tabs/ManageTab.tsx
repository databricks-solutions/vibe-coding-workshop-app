/**
 * Manage tab — organizer only. Add judges by email and advance the hackathon
 * status through its lifecycle.
 */

import { useState } from 'react';
import {
  Gavel,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import {
  apiClient,
  type HackathonDetail,
  type HackathonStatus,
} from '../../../api/client';
import { PrimaryButton, StatusBadge } from '../hackathonShared';
import { STATUS_ORDER, STATUS_META } from '../hackathonStyles';
import { JudgeSelector } from '../JudgeSelector';

export function ManageTab({
  detail,
  onChanged,
}: {
  detail: HackathonDetail;
  onChanged: () => Promise<void> | void;
}) {
  const [statusBusy, setStatusBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentIdx = STATUS_ORDER.indexOf(detail.status);
  const nextStatus: HackathonStatus | null =
    currentIdx >= 0 && currentIdx < STATUS_ORDER.length - 1
      ? STATUS_ORDER[currentIdx + 1]
      : null;

  const setStatus = async (status: HackathonStatus) => {
    setStatusBusy(true);
    setError(null);
    try {
      await apiClient.updateHackathon(detail.hackathon_id, { status });
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setStatusBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-ui-xs text-rose-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Lifecycle */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-ui-sm font-semibold text-foreground mb-3">Lifecycle</h3>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {STATUS_ORDER.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span
                className={`text-ui-2xs font-medium px-2 py-0.5 rounded-full ${
                  i <= currentIdx
                    ? `${STATUS_META[s].text} ${STATUS_META[s].bg}`
                    : 'text-muted-foreground/50 bg-secondary/40'
                }`}
              >
                {STATUS_META[s].label}
              </span>
              {i < STATUS_ORDER.length - 1 && (
                <ArrowRight className="w-3 h-3 text-muted-foreground/40" />
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-ui-xs text-muted-foreground">Current:</span>
          <StatusBadge status={detail.status} />
          {nextStatus && (
            <PrimaryButton onClick={() => setStatus(nextStatus)} disabled={statusBusy} className="ml-auto">
              {statusBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Advance to “{STATUS_META[nextStatus].label}”
            </PrimaryButton>
          )}
          {!nextStatus && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-ui-xs text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              Hackathon complete
            </span>
          )}
        </div>
      </div>

      {/* Judges */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-ui-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <Gavel className="w-4 h-4" />
          Judges
        </h3>
        <p className="text-ui-2xs text-muted-foreground mb-3">
          Select workshop users to judge, or invite anyone by email.
        </p>
        <JudgeSelector
          hackathonId={detail.hackathon_id}
          judges={detail.judges}
          onChanged={onChanged}
        />
      </div>
    </div>
  );
}
