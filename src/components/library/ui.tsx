import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { MoreHorizontal, X } from 'lucide-react';
import type { CollectionKind, LibraryCollection } from '../../api/library';
import { cx } from '../skills/uiStyles';
import { KIND_BY_ID, collectionIcon, collectionTint, initials, tintStyle, type Tint } from './theme';

export { cx };

export function Switch({
  checked,
  onChange,
  label,
  size = 'md',
  tint,
  disabled,
  stopPropagation = true,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  tint?: Tint;
  disabled?: boolean;
  stopPropagation?: boolean;
}) {
  const dims = size === 'sm' ? 'w-7 h-4' : size === 'lg' ? 'w-11 h-6' : 'w-9 h-5';
  const knob = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={e => {
        if (stopPropagation) e.stopPropagation();
        onChange(!checked);
      }}
      style={tint ? tintStyle(tint) : undefined}
      className={cx(
        'relative inline-flex shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-40',
        dims,
        checked ? 'lib-switch-on justify-end' : 'bg-muted-foreground/25 justify-start',
      )}
    >
      <motion.span layout transition={{ type: 'spring', stiffness: 700, damping: 35 }} className={cx('rounded-full bg-white shadow-sm', knob)} />
    </button>
  );
}

export function StatusPill({ live, compact }: { live: boolean; compact?: boolean }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        compact ? 'text-ui-2xs' : 'px-2 py-0.5 text-ui-xs',
        live ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground',
        !compact && (live ? 'bg-emerald-500/12 ring-1 ring-emerald-500/25' : 'bg-muted-foreground/10 ring-1 ring-border'),
      )}
    >
      <span className={cx('w-1.5 h-1.5 rounded-full', live ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]' : 'ring-1 ring-muted-foreground/70')} />
      {live ? 'Live' : 'Hidden'}
    </span>
  );
}

export function CollectionGlyph({
  collection,
  size = 'md',
  off,
}: {
  collection: Pick<LibraryCollection, 'collection_id' | 'kind' | 'icon' | 'color' | 'label'>;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  off?: boolean;
}) {
  const Icon = collectionIcon(collection);
  const box = { xs: 'w-5 h-5 rounded-md', sm: 'w-7 h-7 rounded-lg', md: 'w-8 h-8 rounded-lg', lg: 'w-11 h-11 rounded-xl', xl: 'w-14 h-14 rounded-2xl' }[size];
  const icon = { xs: 'w-3 h-3', sm: 'w-3.5 h-3.5', md: 'w-4 h-4', lg: 'w-5 h-5', xl: 'w-7 h-7' }[size];
  return (
    <span style={tintStyle(collectionTint(collection))} className={cx('lib-tile inline-flex items-center justify-center shrink-0 transition-[filter,opacity] duration-300', box, off && 'lib-tile-off')}>
      <Icon className={icon} strokeWidth={2} />
    </span>
  );
}

export function KindBadge({ kind, subtle }: { kind: CollectionKind; subtle?: boolean }) {
  const k = KIND_BY_ID[kind];
  const Icon = k.icon;
  return (
    <span style={tintStyle(k.tint)} className={cx('inline-flex items-center gap-1 rounded-full font-medium text-ui-2xs uppercase tracking-wider', subtle ? 'lib-ink' : 'lib-soft lib-ink px-2 py-0.5')}>
      <Icon className="w-3 h-3" />
      {k.short}
    </span>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  id,
  size = 'md',
}: {
  options: { id: T; label: string; icon?: ReactNode; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  id: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="tablist" className="inline-flex items-center gap-0.5 rounded-xl bg-secondary/60 p-1 ring-1 ring-border/60">
      {options.map(o => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={cx(
              'relative inline-flex items-center gap-1.5 rounded-lg font-medium transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-ui-xs' : 'px-3 py-1.5 text-ui-sm',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {active && (
              <motion.span layoutId={`seg-${id}`} transition={{ type: 'spring', stiffness: 500, damping: 38 }} className="absolute inset-0 rounded-lg bg-card shadow-sm ring-1 ring-border/70" />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              {o.icon}
              {o.label}
              {o.count !== undefined && <span className="tabular-nums text-muted-foreground text-ui-2xs">{o.count}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Meter({ live, total, tint, className }: { live: number; total: number; tint: Tint; className?: string }) {
  const pct = total ? Math.round((live / total) * 100) : 0;
  return (
    <div style={tintStyle(tint)} className={cx('h-1.5 rounded-full bg-muted-foreground/15 overflow-hidden', className)}>
      <motion.div initial={false} animate={{ width: `${pct}%` }} transition={{ type: 'spring', stiffness: 120, damping: 22 }} className="lib-bar h-full rounded-full" />
    </div>
  );
}

export function Avatar({ email, size = 'sm' }: { email: string | null | undefined; size?: 'xs' | 'sm' }) {
  const hue = [...(email || '?')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  return (
    <span
      title={email || 'Unknown'}
      style={{ '--h': String(hue), '--s': '55%' } as React.CSSProperties}
      className={cx('lib-tile inline-flex items-center justify-center rounded-full font-semibold shrink-0', size === 'xs' ? 'w-5 h-5 text-[9px]' : 'w-6 h-6 text-ui-3xs')}
    >
      {initials(email)}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="px-1.5 py-0.5 rounded-md bg-secondary ring-1 ring-border text-ui-2xs font-mono text-muted-foreground">{children}</kbd>;
}

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  hidden?: boolean;
}

export function RowMenu({ items, label = 'More actions', className }: { items: MenuItem[]; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return (
    <div ref={ref} className={cx('relative', className)} onClick={e => e.stopPropagation()}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <motion.div
          role="menu"
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.12 }}
          className="absolute right-0 top-full mt-1 z-50 min-w-[11rem] rounded-xl bg-popover p-1 shadow-xl ring-1 ring-border"
        >
          {items.filter(i => !i.hidden).map(i => (
            <button
              key={i.label}
              role="menuitem"
              onClick={() => { setOpen(false); i.onSelect(); }}
              className={cx(
                'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-ui-sm text-left transition-colors',
                i.danger ? 'text-red-500 hover:bg-red-500/10' : 'text-foreground hover:bg-secondary',
              )}
            >
              {i.icon && <span className="w-4 h-4 inline-flex items-center justify-center opacity-80">{i.icon}</span>}
              {i.label}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="lib-root fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        className={cx('relative w-full rounded-2xl bg-card shadow-2xl ring-1 ring-border flex flex-col max-h-[90vh]', width)}
      >
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          {icon}
          <div className="flex-1 min-w-0">
            <h3 className="text-ui-lg font-semibold text-foreground">{title}</h3>
            {subtitle && <p className="text-ui-sm text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 pb-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-border flex items-center justify-end gap-2 bg-secondary/20 rounded-b-2xl">{footer}</div>}
      </motion.div>
    </div>,
    document.body,
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="relative mb-4">
        <div className="absolute inset-0 blur-2xl bg-primary/20 rounded-full" />
        <div className="relative w-14 h-14 rounded-2xl bg-card ring-1 ring-border flex items-center justify-center text-primary shadow-lg">{icon}</div>
      </div>
      <h3 className="text-ui-md2 font-semibold text-foreground">{title}</h3>
      {body && <p className="text-ui-sm text-muted-foreground mt-1 max-w-sm">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
