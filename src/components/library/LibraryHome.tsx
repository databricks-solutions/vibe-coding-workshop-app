import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, BadgeCheck, Eye, Grid3x3, Inbox, Layers, Plus, Radio, Sparkles } from 'lucide-react';
import type { CollectionKind, LibraryCollection, LibraryUseCase } from '../../api/library';
import { intersect, keyOf, type LibraryModel } from './model';
import { KINDS, KIND_BY_ID, collectionIcon, collectionTint, relativeTime, tintStyle, iconForUseCase } from './theme';
import { Avatar, CollectionGlyph, cx } from './ui';
import { BTN_PRIMARY, BTN_SECONDARY } from '../skills/uiStyles';

interface Props {
  model: LibraryModel;
  onNavigate: (path: string) => void;
  onOpen: (uc: LibraryUseCase) => void;
  onPreview: () => void;
  onCreateCollection: (kind: CollectionKind) => void;
  onCreateIn: (homeId: string, alsoIn: string) => void;
}

function Kpi({ icon, label, value, sub, tint, onClick, delay }: { icon: React.ReactNode; label: string; value: number; sub: string; tint: { h: number; s: number }; onClick?: () => void; delay: number }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 30 }}
      onClick={onClick}
      style={tintStyle(tint)}
      className="group relative overflow-hidden text-left rounded-2xl bg-card ring-1 ring-border p-4 hover:ring-primary/30 hover:shadow-lg transition"
    >
      <div className="lib-wash absolute inset-0 opacity-60" />
      <div className="relative flex items-center gap-3">
        <span className="lib-tile w-10 h-10 rounded-xl inline-flex items-center justify-center">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-ui-xs text-muted-foreground">{label}</div>
          <div className="text-ui-3xl font-semibold tabular-nums text-foreground leading-tight">{value}</div>
        </div>
        {onClick && <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition" />}
      </div>
      <div className="relative mt-2 text-ui-xs text-muted-foreground">{sub}</div>
    </motion.button>
  );
}

function CoverageMap({ model, onNavigate, onCreateIn, onCreateCollection }: Pick<Props, 'model' | 'onNavigate' | 'onCreateIn' | 'onCreateCollection'>) {
  const rows = model.byKind.industry;
  const cols = useMemo(() => [...model.byKind.function, ...model.byKind.solution], [model]);
  const industryIds = useMemo(() => new Set(rows.map(r => r.collection_id)), [rows]);

  const cross = useMemo(() => {
    const out: Record<string, number> = {};
    cols.forEach(c => {
      out[c.collection_id] = (model.entriesByCollection[c.collection_id] || []).filter(e => {
        if (industryIds.has(e.uc.industry)) return false;
        return !(model.membersByKey[e.key] || []).some(m => industryIds.has(m.collection_id));
      }).length;
    });
    return out;
  }, [cols, model, industryIds]);

  const cells = useMemo(() => {
    const out: Record<string, number> = {};
    rows.forEach(r => cols.forEach(c => { out[`${r.collection_id}|${c.collection_id}`] = intersect(model, r.collection_id, c.collection_id).length; }));
    return out;
  }, [rows, cols, model]);
  const max = Math.max(1, ...Object.values(cells), ...Object.values(cross));

  if (cols.length === 0) {
    return (
      <div className="rounded-2xl ring-1 ring-dashed ring-border border border-dashed border-border p-8 text-center">
        <Grid3x3 className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
        <p className="text-ui-md font-medium text-foreground">Add a horizontal to see coverage</p>
        <p className="text-ui-sm text-muted-foreground mt-1 mb-4">Business functions and technical solutions cut across industries. The map shows where you have plays and where you have gaps.</p>
        <div className="flex justify-center gap-2">
          <button className={BTN_SECONDARY} onClick={() => onCreateCollection('function')}>{(() => { const I = KIND_BY_ID.function.icon; return <I className="w-4 h-4" />; })()}Business function</button>
          <button className={BTN_SECONDARY} onClick={() => onCreateCollection('solution')}>{(() => { const I = KIND_BY_ID.solution.icon; return <I className="w-4 h-4" />; })()}Technical solution</button>
        </div>
      </div>
    );
  }

  const isFirstSolution = (i: number) => cols[i].kind === 'solution' && i > 0 && cols[i - 1].kind !== 'solution';

  const Cell = ({ row, col, count, divider }: { row: LibraryCollection | null; col: LibraryCollection; count: number; divider?: boolean }) => {
    const t = collectionTint(col);
    const off = !col.is_enabled || (row && !row.is_enabled);
    if (count === 0) {
      return (
        <td className={cx('p-1', off && 'lib-hatch', divider && 'border-l border-border')}>
          {row ? (
            <button
              onClick={() => onCreateIn(row.collection_id, col.collection_id)}
              title={`Create a ${col.label} play for ${row.label}`}
              className="group w-full h-11 rounded-lg border border-dashed border-border/70 text-muted-foreground/40 hover:text-foreground hover:border-primary/50 hover:bg-primary/5 transition inline-flex items-center justify-center"
            >
              <span className="group-hover:hidden">·</span>
              <Plus className="w-3.5 h-3.5 hidden group-hover:block" />
            </button>
          ) : <div className="h-11 rounded-lg text-center leading-[2.75rem] text-muted-foreground/30">·</div>}
        </td>
      );
    }
    const alpha = 0.12 + 0.55 * (count / max);
    return (
      <td className={cx('p-1', off && 'lib-hatch', divider && 'border-l border-border')}>
        <button
          onClick={() => onNavigate(row ? `/library/all?in=${row.collection_id},${col.collection_id}` : `/library/c/${col.collection_id}`)}
          style={{ ...tintStyle(t), '--a': String(alpha) } as React.CSSProperties}
          className={cx('lib-heat w-full h-11 rounded-lg text-ui-md font-semibold tabular-nums text-foreground hover:ring-2 hover:ring-primary/50 transition', off && 'opacity-50')}
        >
          {count}
        </button>
      </td>
    );
  };

  return (
    <div className="rounded-2xl ring-1 ring-border bg-card overflow-x-auto">
      <table className="w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky left-0 bg-card z-10 text-left px-4 py-3 text-ui-2xs font-semibold uppercase tracking-wider text-muted-foreground min-w-[13rem]">Industry</th>
            <th className="px-2 py-3 text-ui-2xs font-semibold uppercase tracking-wider text-muted-foreground w-20">Total</th>
            {cols.map((c, i) => {
              return (
                <th key={c.collection_id} className={cx('px-1.5 py-3 min-w-[6.5rem] align-bottom', isFirstSolution(i) && 'border-l border-border')}>
                  <button onClick={() => onNavigate(`/library/c/${c.collection_id}`)} className="w-full flex flex-col items-center gap-1.5 group">
                    <CollectionGlyph collection={c} size="sm" off={!c.is_enabled} />
                    <span className="text-ui-2xs font-medium text-muted-foreground group-hover:text-foreground leading-tight text-center line-clamp-2">{c.label}</span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const s = model.stats[r.collection_id];
            return (
              <tr key={r.collection_id} className="border-t border-border">
                <td className="sticky left-0 bg-card z-10 px-4 py-1 border-t border-border/60">
                  <button onClick={() => onNavigate(`/library/c/${r.collection_id}`)} className="flex items-center gap-2.5 group">
                    <CollectionGlyph collection={r} size="sm" off={!r.is_enabled} />
                    <span className={cx('text-ui-sm font-medium group-hover:underline underline-offset-2', r.is_enabled ? 'text-foreground' : 'text-muted-foreground')}>{r.label}</span>
                  </button>
                </td>
                <td className="px-2 py-1 border-t border-border/60 text-center">
                  <div className="text-ui-md font-semibold tabular-nums text-foreground">{s?.total ?? 0}</div>
                  <div className="text-ui-3xs text-muted-foreground tabular-nums">{s?.live ?? 0} live</div>
                </td>
                {cols.map((c, i) => (
                  <Cell key={c.collection_id} row={r} col={c} divider={isFirstSolution(i)} count={cells[`${r.collection_id}|${c.collection_id}`]} />
                ))}
              </tr>
            );
          })}
          <tr>
            <td className="sticky left-0 bg-card z-10 px-4 py-2 border-t border-border">
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg bg-secondary inline-flex items-center justify-center text-muted-foreground"><Layers className="w-3.5 h-3.5" /></span>
                <div>
                  <div className="text-ui-sm font-medium text-foreground">Cross-industry</div>
                  <div className="text-ui-3xs text-muted-foreground">Plays not tied to an industry</div>
                </div>
              </div>
            </td>
            <td className="border-t border-border" />
            {cols.map((c, i) => <Cell key={c.collection_id} row={null} col={c} divider={isFirstSolution(i)} count={cross[c.collection_id] || 0} />)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function LibraryHome({ model, onNavigate, onOpen, onPreview, onCreateCollection, onCreateIn }: Props) {
  const recent = useMemo(
    () => [...model.useCases].filter(u => u.updated_at).sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')).slice(0, 6),
    [model],
  );
  const onCount = model.collections.filter(c => c.is_enabled).length;
  const liveTotal = model.useCases.filter(u => u.is_active && u.path_type !== 'skill').length;

  return (
    <div className="px-8 py-8 max-w-[90rem] mx-auto space-y-8">
      <header className="flex items-end gap-4">
        <div className="flex-1">
          <motion.h1 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-ui-3xl font-semibold tracking-tight text-foreground">
            Your use case library
          </motion.h1>
          <p className="text-ui-md text-muted-foreground mt-1">
            Industries go deep on a market. Business functions and technical solutions cut across them. Switch any of them on or off for your next workshop.
          </p>
        </div>
        <button className={BTN_SECONDARY} onClick={() => onCreateCollection('industry')}><Plus className="w-4 h-4" />New collection</button>
      </header>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Kpi delay={0} icon={<Radio className="w-5 h-5" />} label="Live use cases" value={liveTotal} sub={`of ${model.useCases.length - model.skills.length} in the library`} tint={{ h: 158, s: 70 }} onClick={() => onNavigate('/library/all')} />
        <Kpi delay={0.04} icon={<Layers className="w-5 h-5" />} label="Collections on" value={onCount} sub={`${model.attendeeCollections.length} have live content`} tint={{ h: 172, s: 66 }} />
        <Kpi delay={0.08} icon={<BadgeCheck className="w-5 h-5" />} label="Certified" value={model.useCases.filter(u => u.is_certified).length} sub="Pinned to the top with a badge" tint={{ h: 38, s: 92 }} />
        <Kpi delay={0.12} icon={<Inbox className="w-5 h-5" />} label="Needs review" value={model.pendingReview.length} sub="Ideas submitted from Ideate" tint={{ h: 262, s: 78 }} onClick={() => onNavigate('/library/review')} />
      </div>

      {/* Attendee strip */}
      <section className="relative overflow-hidden rounded-2xl ring-1 ring-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.07] via-card to-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="relative flex w-2.5 h-2.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
            <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-emerald-500" />
          </span>
          <h2 className="text-ui-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Attendees see right now</h2>
          <span className="text-ui-xs text-muted-foreground tabular-nums">{model.attendeeUseCaseCount} use cases · {model.attendeeCertifiedCount} certified</span>
          <span className="flex-1" />
          <button className={BTN_PRIMARY} onClick={onPreview}><Eye className="w-4 h-4" />Preview as attendee</button>
        </div>
        {model.attendeeCollections.length === 0 ? (
          <p className="text-ui-sm text-muted-foreground">Nothing is visible yet. Switch on a collection that has live use cases.</p>
        ) : (
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {KINDS.map(k => {
              const list = model.attendeeCollections.filter(c => c.kind === k.id);
              if (!list.length) return null;
              const KIcon = k.icon;
              return (
                <div key={k.id} className="flex items-center gap-2 flex-wrap">
                  <span style={tintStyle(k.tint)} className="lib-ink inline-flex items-center gap-1 text-ui-2xs font-semibold uppercase tracking-wider mr-1"><KIcon className="w-3.5 h-3.5" />{k.short}</span>
                  {list.map(c => (
                    <button
                      key={c.collection_id}
                      onClick={() => onNavigate(`/library/c/${c.collection_id}`)}
                      style={tintStyle(collectionTint(c))}
                      className="lib-soft inline-flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full text-ui-sm font-medium text-foreground hover:scale-[1.03] transition-transform"
                    >
                      <CollectionGlyph collection={c} size="xs" />
                      {c.label}
                      <span className="lib-ink text-ui-2xs tabular-nums">{model.stats[c.collection_id]?.live ?? 0}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Coverage */}
      <section>
        <div className="flex items-end gap-3 mb-3">
          <div className="flex-1">
            <h2 className="text-ui-lg font-semibold text-foreground">Coverage map</h2>
            <p className="text-ui-sm text-muted-foreground">Where industries meet business functions and technical solutions. Click a number to see those use cases, or a gap to fill it.</p>
          </div>
        </div>
        <CoverageMap model={model} onNavigate={onNavigate} onCreateIn={onCreateIn} onCreateCollection={onCreateCollection} />
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <section>
          <h2 className="text-ui-lg font-semibold text-foreground mb-3">Recently edited</h2>
          <div className="rounded-2xl ring-1 ring-border bg-card divide-y divide-border/70">
            {recent.map(u => {
              const home = model.byId[u.industry];
              const Icon = iconForUseCase(u, home ? collectionIcon(home) : Sparkles);
              return (
                <button key={keyOf(u)} onClick={() => onOpen(u)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/40 transition-colors first:rounded-t-2xl last:rounded-b-2xl">
                  <span style={tintStyle(home ? collectionTint(home) : { h: 172, s: 66 })} className="lib-tile w-8 h-8 rounded-lg inline-flex items-center justify-center"><Icon className="w-4 h-4" /></span>
                  <div className="flex-1 min-w-0">
                    <div className="text-ui-sm font-medium text-foreground truncate">{u.use_case_label}</div>
                    <div className="text-ui-xs text-muted-foreground truncate">{home?.label} · v{u.version}</div>
                  </div>
                  <Avatar email={u.created_by} size="xs" />
                  <span className="text-ui-xs text-muted-foreground tabular-nums w-16 text-right">{relativeTime(u.updated_at)}</span>
                </button>
              );
            })}
          </div>
        </section>
        <section>
          <div className="flex items-center mb-3">
            <h2 className="text-ui-lg font-semibold text-foreground flex-1">Needs review</h2>
            {model.pendingReview.length > 0 && <button className="text-ui-sm text-primary hover:underline inline-flex items-center gap-1" onClick={() => onNavigate('/library/review')}>Review all<ArrowRight className="w-3.5 h-3.5" /></button>}
          </div>
          {model.pendingReview.length === 0 ? (
            <div className="rounded-2xl ring-1 ring-border bg-card px-5 py-10 text-center">
              <Inbox className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
              <p className="text-ui-sm font-medium text-foreground">Inbox zero</p>
              <p className="text-ui-xs text-muted-foreground mt-1">Ideas that attendees submit from Ideate land here for you to approve.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {model.pendingReview.slice(0, 4).map(u => (
                <button key={keyOf(u)} onClick={() => onOpen(u)} className="w-full flex items-center gap-3 rounded-2xl ring-1 ring-amber-500/25 bg-amber-500/[0.05] px-4 py-3 text-left hover:bg-amber-500/10 transition-colors">
                  <Avatar email={u.created_by} />
                  <div className="flex-1 min-w-0">
                    <div className="text-ui-sm font-medium text-foreground truncate">{u.use_case_label}</div>
                    <div className="text-ui-xs text-muted-foreground truncate">{model.byId[u.industry]?.label} · {relativeTime(u.updated_at)}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
