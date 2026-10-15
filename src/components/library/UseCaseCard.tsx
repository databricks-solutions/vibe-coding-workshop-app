import type { DragEvent } from 'react';
import { motion } from 'framer-motion';
import { BadgeCheck, Check, CornerDownRight, Star } from 'lucide-react';
import type { LibraryCollection } from '../../api/library';
import { deriveValueProp } from '../outcomeMapTheme';
import { placementsOf, type Entry, type LibraryModel } from './model';
import { collectionIcon, relativeTime, tintStyle, iconForUseCase, type Tint } from './theme';
import { CollectionGlyph, Switch, cx } from './ui';

interface Props {
  entry: Entry;
  model: LibraryModel;
  collection: LibraryCollection;
  tint: Tint;
  selected: boolean;
  selectionMode: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onLive: (v: boolean) => void;
  onCertified: (v: boolean) => void;
  dragging?: boolean;
  dropBefore?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragEnd?: () => void;
  onDragOver?: (e: DragEvent) => void;
}

export function UseCaseCard({
  entry, model, collection, tint, selected, selectionMode, onToggleSelect, onOpen, onLive, onCertified,
  dragging, dropBefore, onDragStart, onDragEnd, onDragOver,
}: Props) {
  const { uc } = entry;
  const Icon = iconForUseCase(uc, collectionIcon(collection));
  const others = placementsOf(model, uc).filter(p => p.id !== entry.collectionId && p.collection);
  const home = model.byId[uc.industry];
  const live = uc.is_active;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: dragging ? 0.35 : 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
      className="relative"
    >
      {dropBefore && <div style={tintStyle(tint)} className="lib-dot absolute -top-1.5 left-2 right-2 h-0.5 rounded-full" />}
      <div
        role="button"
        tabIndex={0}
        draggable={!!onDragStart}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onClick={() => (selectionMode ? onToggleSelect() : onOpen())}
        onKeyDown={e => {
          if (e.key === 'Enter') onOpen();
          if (e.key === ' ') { e.preventDefault(); onLive(!live); }
        }}
        data-uc={entry.key}
        style={tintStyle(tint)}
        className={cx(
          'lib-card-edge group relative overflow-hidden rounded-xl p-3.5 cursor-pointer select-none',
          'transition-[box-shadow,transform,background-color] duration-200 hover:-translate-y-0.5',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
          live ? 'bg-card ring-1 ring-border/70 shadow-sm hover:shadow-lg' : 'bg-card/50 ring-1 ring-dashed ring-border/80 border border-dashed border-border/70',
          selected && 'ring-2 !ring-primary/70 bg-primary/[0.04]',
        )}
      >
        {!entry.isHome && home && (
          <div className="flex items-center gap-1 mb-2 text-ui-2xs text-muted-foreground">
            <CornerDownRight className="w-3 h-3" />
            From <CollectionGlyph collection={home} size="xs" /> <span className="font-medium text-foreground/80 truncate">{home.label}</span>
          </div>
        )}
        <div className={cx('flex items-start gap-2.5', !live && 'opacity-70')}>
          <span className="lib-tile w-8 h-8 rounded-lg inline-flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4" />
          </span>
          <div className="flex-1 min-w-0 pr-5">
            <div className="flex items-center gap-1">
              <h4 className="text-ui-sm font-semibold text-foreground leading-snug line-clamp-2" title={uc.use_case_label}>{uc.use_case_label}</h4>
              {uc.is_certified && <BadgeCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-label="Certified" />}
            </div>
            <p className="mt-1 text-ui-xs text-muted-foreground leading-relaxed line-clamp-2">{deriveValueProp(uc.prompt_template, '')}</p>
          </div>
        </div>

        <button
          type="button"
          aria-label={selected ? 'Deselect' : 'Select'}
          onClick={e => { e.stopPropagation(); onToggleSelect(); }}
          className={cx(
            'absolute top-3 right-3 w-4 h-4 rounded-[5px] ring-1 inline-flex items-center justify-center transition',
            selected ? 'bg-primary ring-primary text-primary-foreground opacity-100' : 'ring-border bg-background/80 opacity-0 group-hover:opacity-100',
            selectionMode && 'opacity-100',
          )}
        >
          {selected && <Check className="w-3 h-3" strokeWidth={3} />}
        </button>

        <div className="mt-3 flex items-center gap-2">
          <Switch size="sm" checked={live} onChange={onLive} label={live ? 'Hide from attendees' : 'Show to attendees'} />
          <span className={cx('text-ui-2xs font-medium', live ? 'text-emerald-600 dark:text-emerald-300' : 'text-muted-foreground')}>{live ? 'Live' : 'Hidden'}</span>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onCertified(!uc.is_certified); }}
            aria-label={uc.is_certified ? 'Remove certification' : 'Certify'}
            title={uc.is_certified ? 'Certified: pinned to top with a badge' : 'Certify'}
            className={cx('p-0.5 rounded transition-colors', uc.is_certified ? 'text-amber-500' : 'text-muted-foreground/40 hover:text-amber-500')}
          >
            <Star className="w-3.5 h-3.5" fill={uc.is_certified ? 'currentColor' : 'none'} />
          </button>
          <span className="flex-1" />
          {others.length > 0 && (
            <span className="flex -space-x-1" title={`Also in ${others.map(o => o.collection!.label).join(', ')}`}>
              {others.slice(0, 3).map(o => <CollectionGlyph key={o.id} collection={o.collection!} size="xs" />)}
              {others.length > 3 && <span className="text-ui-3xs text-muted-foreground pl-1.5">+{others.length - 3}</span>}
            </span>
          )}
          <span className="text-ui-3xs text-muted-foreground tabular-nums" title={uc.updated_at ? `Updated ${relativeTime(uc.updated_at)}` : undefined}>v{uc.version}</span>
        </div>
      </div>
    </motion.div>
  );
}
