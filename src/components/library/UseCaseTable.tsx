import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, BadgeCheck, Check, Star } from 'lucide-react';
import type { LibraryUseCase } from '../../api/library';
import { deriveValueProp } from '../outcomeMapTheme';
import { keyOf, placementsOf, type LibraryModel } from './model';
import { collectionIcon, relativeTime, iconForUseCase, collectionTint, tintStyle } from './theme';
import { Avatar, CollectionGlyph, Switch } from './ui';
import { cx } from './cx';

type SortKey = 'name' | 'status' | 'updated' | 'home';

export interface TableRow {
  uc: LibraryUseCase;
  category?: string | null;
}

interface Props {
  rows: TableRow[];
  model: LibraryModel;
  selected: Set<string>;
  onToggleSelect: (key: string) => void;
  onToggleAll: (keys: string[], on: boolean) => void;
  onOpen: (uc: LibraryUseCase) => void;
  onLive: (uc: LibraryUseCase, v: boolean) => void;
  onCertified: (uc: LibraryUseCase, v: boolean) => void;
  showHome?: boolean;
}

export function UseCaseTable({ rows, model, selected, onToggleSelect, onToggleAll, onOpen, onLive, onCertified, showHome }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 });
  const sorted = useMemo(() => {
    const val = (r: TableRow): string | number => {
      switch (sort.key) {
        case 'status': return (r.uc.is_active ? 0 : 2) + (r.uc.is_certified ? 0 : 1);
        case 'updated': return -(new Date(r.uc.updated_at || 0).getTime() || 0);
        case 'home': return model.byId[r.uc.industry]?.label || r.uc.industry;
        default: return r.uc.use_case_label.toLowerCase();
      }
    };
    return [...rows].sort((a, b) => {
      const va = val(a); const vb = val(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
  }, [rows, sort, model]);

  const keys = sorted.map(r => keyOf(r.uc));
  const allOn = keys.length > 0 && keys.every(k => selected.has(k));

  // A render helper, called as a function, so the header cells are not a component created during render.
  const Th = ({ k, children, className }: { k?: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={cx('px-3 py-2 text-left text-ui-2xs font-semibold uppercase tracking-wider text-muted-foreground', className)}>
      {k ? (
        <button onClick={() => setSort(s => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : 1 }))} className="inline-flex items-center gap-1 hover:text-foreground">
          {children}
          {sort.key === k && (sort.dir === 1 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
        </button>
      ) : children}
    </th>
  );

  return (
    <div className="rounded-2xl ring-1 ring-border bg-card overflow-hidden">
      <table className="w-full">
        <thead className="bg-secondary/40 border-b border-border">
          <tr>
            <th className="w-10 pl-4 py-2">
              <button
                aria-label={allOn ? 'Deselect all' : 'Select all'}
                onClick={() => onToggleAll(keys, !allOn)}
                className={cx('w-4 h-4 rounded-[5px] ring-1 inline-flex items-center justify-center', allOn ? 'bg-primary ring-primary text-primary-foreground' : 'ring-border bg-background')}
              >
                {allOn && <Check className="w-3 h-3" strokeWidth={3} />}
              </button>
            </th>
            {Th({ k: 'name', children: 'Use case' })}
            {showHome && Th({ k: 'home', children: 'Home' })}
            {Th({ k: 'status', className: 'w-32', children: 'Status' })}
            {Th({ children: 'Appears in' })}
            {!showHome && Th({ children: 'Category' })}
            {Th({ k: 'updated', className: 'w-40', children: 'Updated' })}
          </tr>
        </thead>
        <tbody>
          {sorted.map(({ uc, category }) => {
            const key = keyOf(uc);
            const isSel = selected.has(key);
            const home = model.byId[uc.industry];
            const Icon = iconForUseCase(uc, home ? collectionIcon(home) : Star);
            const places = placementsOf(model, uc).filter(p => p.collection);
            return (
              <tr
                key={key}
                onClick={() => onOpen(uc)}
                className={cx('group border-b border-border/60 last:border-0 cursor-pointer transition-colors', isSel ? 'bg-primary/[0.05]' : 'hover:bg-secondary/40', !uc.is_active && 'text-muted-foreground')}
              >
                <td className="pl-4 py-2.5" onClick={e => { e.stopPropagation(); onToggleSelect(key); }}>
                  <span className={cx('w-4 h-4 rounded-[5px] ring-1 inline-flex items-center justify-center', isSel ? 'bg-primary ring-primary text-primary-foreground' : 'ring-border bg-background')}>
                    {isSel && <Check className="w-3 h-3" strokeWidth={3} />}
                  </span>
                </td>
                <td className="px-3 py-2.5 max-w-[26rem]">
                  <div className="flex items-center gap-2.5">
                    <span style={tintStyle(home ? collectionTint(home) : { h: 172, s: 66 })} className={cx('lib-tile w-7 h-7 rounded-lg inline-flex items-center justify-center shrink-0', !uc.is_active && 'opacity-60')}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className={cx('text-ui-sm font-medium truncate', uc.is_active ? 'text-foreground' : 'text-muted-foreground')}>{uc.use_case_label}</span>
                        {uc.is_certified && <BadgeCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                        {uc.source === 'ideate' && !uc.is_active && <span className="ml-1 px-1.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 text-ui-3xs font-semibold">IDEATE</span>}
                      </div>
                      <div className="text-ui-xs text-muted-foreground truncate">{deriveValueProp(uc.prompt_template, '')}</div>
                    </div>
                  </div>
                </td>
                {showHome && (
                  <td className="px-3 py-2.5">
                    {home && <span className="inline-flex items-center gap-1.5 text-ui-sm"><CollectionGlyph collection={home} size="xs" off={!home.is_enabled} />{home.label}</span>}
                  </td>
                )}
                <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <Switch size="sm" checked={uc.is_active} onChange={v => onLive(uc, v)} label={uc.is_active ? 'Hide from attendees' : 'Show to attendees'} />
                    <span className={cx('text-ui-2xs font-medium w-10', uc.is_active ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground')}>{uc.is_active ? 'Live' : 'Hidden'}</span>
                    <button
                      onClick={() => onCertified(uc, !uc.is_certified)}
                      aria-label={uc.is_certified ? 'Remove certification' : 'Certify'}
                      className={cx('p-0.5 rounded', uc.is_certified ? 'text-amber-500' : 'text-muted-foreground/40 hover:text-amber-500')}
                    >
                      <Star className="w-3.5 h-3.5" fill={uc.is_certified ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1">
                    {places.slice(0, 4).map(p => <span key={p.id} title={`${p.collection!.label}${p.isHome ? ' (home)' : ''}`}><CollectionGlyph collection={p.collection!} size="xs" off={!p.collection!.is_enabled} /></span>)}
                    {places.length > 4 && <span className="text-ui-3xs text-muted-foreground">+{places.length - 4}</span>}
                  </div>
                </td>
                {!showHome && <td className="px-3 py-2.5 text-ui-xs text-muted-foreground truncate max-w-[12rem]">{category || '—'}</td>}
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-2 text-ui-xs text-muted-foreground">
                    <Avatar email={uc.created_by} size="xs" />
                    <span className="tabular-nums">v{uc.version} · {relativeTime(uc.updated_at) || '—'}</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
