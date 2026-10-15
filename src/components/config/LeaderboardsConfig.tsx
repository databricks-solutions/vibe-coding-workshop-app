import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Camera, Code2, Eye, History, Loader2, Mountain, RotateCcw, ShieldAlert } from 'lucide-react';
import { apiClient, type LeaderboardBoard, type LeaderboardSeason, type LeaderboardSeasons } from '../../api/client';
import { Modal } from '../library/ui';

interface LeaderboardsConfigProps {
  onToast: (message: string, type: 'success' | 'error') => void;
}

const BOARDS: { key: LeaderboardBoard; label: string; icon: typeof Code2; counts: string }[] = [
  { key: 'technical', label: 'Technical', icon: Code2, counts: 'workshop sessions' },
  { key: 'insights', label: 'Insights', icon: Mountain, counts: 'Ideate and Insights ideas' },
];

type Pending =
  | { action: 'reset' | 'snapshot'; board: LeaderboardBoard | 'all' }
  | { action: 'restore'; season: LeaderboardSeason };

const fmt = (iso: string | null) =>
  iso ? new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'the start';

const boardLabel = (b: LeaderboardBoard | 'all') => (b === 'all' ? 'both leaderboards' : `the ${BOARDS.find(x => x.key === b)!.label} leaderboard`);

/** Snapshot, archive and reset, and restore for both leaderboards. Nothing is ever deleted. */
export function LeaderboardsConfig({ onToast }: LeaderboardsConfigProps) {
  const [data, setData] = useState<Partial<Record<LeaderboardBoard, LeaderboardSeasons>>>({});
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Pending | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useRef(onToast);
  useEffect(() => { toast.current = onToast; });

  const load = useCallback(async () => {
    try {
      const [technical, insights] = await Promise.all(BOARDS.map(b => apiClient.leaderboardSeasons(b.key)));
      setData({ technical, insights });
    } catch {
      toast.current('Could not load leaderboard seasons', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const canManage = !!(data.technical?.canManage || data.insights?.canManage);

  const open = (p: Pending) => { setName(''); setPending(p); };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.action === 'restore') {
        await apiClient.leaderboardRestore(pending.season.id);
        onToast(`Restored "${pending.season.name}"`, 'success');
      } else {
        await apiClient.leaderboardAdmin(pending.action, pending.board, name.trim() || undefined);
        onToast(pending.action === 'reset' ? `Archived and reset ${boardLabel(pending.board)}` : `Saved a snapshot of ${boardLabel(pending.board)}`, 'success');
      }
      setPending(null);
      await load();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Something went wrong', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl space-y-5 pb-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Leaderboards</h2>
            <p className="text-sm text-muted-foreground max-w-2xl mt-1">
              Start a fresh season for a new cohort, keep snapshots, and bring an old season back. Ideas and sessions are never deleted:
              a reset only changes which work the live board counts, from the reset onward.
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => open({ action: 'reset', board: 'all' })}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-secondary"
            >
              <Archive className="w-4 h-4" /> Archive and reset both
            </button>
          )}
        </div>

        {!canManage && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
            Only app admins (APP_ADMINS) can manage leaderboards. You can still browse the archive.
          </div>
        )}

        {BOARDS.map(({ key, label, icon: Icon, counts }) => {
          const d = data[key];
          const cur = d?.current;
          return (
            <section key={key} className="rounded-xl border border-border bg-card">
              <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-border">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Icon className="w-4 h-4" /></div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">{label}</h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {cur ? <>Live season <span className="font-medium text-foreground">{cur.name}</span>, counting {counts} since {fmt(cur.startedAt)}</> : <>Live, all time. Counting every saved {counts.replace(/s$/, '')}.</>}
                  </p>
                </div>
                <Link to={`/leaderboard${key === 'insights' ? '?tab=insights' : ''}`} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary">
                  <Eye className="w-3.5 h-3.5" /> View live
                </Link>
                {canManage && (
                  <>
                    <button onClick={() => open({ action: 'snapshot', board: key })} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-secondary">
                      <Camera className="w-3.5 h-3.5" /> Save snapshot
                    </button>
                    <button onClick={() => open({ action: 'reset', board: key })} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90">
                      <Archive className="w-3.5 h-3.5" /> Archive and reset
                    </button>
                  </>
                )}
              </div>
              {d?.archive.length ? (
                <ul className="divide-y divide-border">
                  {d.archive.map(s => (
                    <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <History className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {s.name || 'Untitled'}
                          <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${s.kind === 'snapshot' ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400' : 'bg-secondary text-muted-foreground'}`}>
                            {s.kind === 'snapshot' ? 'Snapshot' : 'Season'}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {s.kind === 'snapshot' ? `Taken ${fmt(s.endedAt)}` : `${fmt(s.startedAt)} to ${fmt(s.endedAt)}`} · {s.entryCount} {s.entryCount === 1 ? 'entry' : 'entries'}{s.createdBy && ` · by ${s.createdBy}`}
                        </p>
                      </div>
                      <Link to={`/leaderboard?${key === 'insights' ? 'tab=insights&' : ''}season=${s.id}`} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary">
                        <Eye className="w-3.5 h-3.5" /> View
                      </Link>
                      {canManage && s.kind === 'season' && (
                        <button onClick={() => open({ action: 'restore', season: s })} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-secondary">
                          <RotateCcw className="w-3.5 h-3.5" /> Restore
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-4 text-xs text-muted-foreground">No archives yet.</p>
              )}
            </section>
          );
        })}
      </div>

      <Modal
        open={!!pending}
        onClose={() => !busy && setPending(null)}
        icon={<div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          {pending?.action === 'restore' ? <RotateCcw className="w-4 h-4" /> : pending?.action === 'snapshot' ? <Camera className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
        </div>}
        title={pending?.action === 'restore' ? `Restore "${pending.season.name}"?` : pending?.action === 'snapshot' ? `Snapshot ${boardLabel(pending.board)}` : pending ? `Archive and reset ${boardLabel(pending.board)}?` : ''}
        subtitle={pending?.action === 'restore'
          ? `The live board will count work from ${fmt(pending.season.startedAt)} again. The current season is archived first, so you can switch back.`
          : pending?.action === 'snapshot'
            ? 'Saves a frozen copy anyone can browse. The live board keeps going.'
            : 'The current board is frozen into the archive and a new season starts now. Only work started from now on counts. Ideas and sessions are kept and can be restored.'}
        footer={
          <div className="flex justify-end gap-2">
            <button onClick={() => setPending(null)} disabled={busy} className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary">Cancel</button>
            <button onClick={confirm} disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {pending?.action === 'restore' ? 'Restore season' : pending?.action === 'snapshot' ? 'Save snapshot' : 'Archive and reset'}
            </button>
          </div>
        }
      >
        {pending && pending.action !== 'restore' && (
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">{pending.action === 'reset' ? 'Name the new season' : 'Snapshot name'} (optional)</span>
            <input
              autoFocus
              value={name}
              maxLength={120}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void confirm(); }}
              placeholder={pending.action === 'reset' ? 'e.g. Chicago workshop, Oct 2026' : 'e.g. End of day one'}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </label>
        )}
      </Modal>
    </div>
  );
}
