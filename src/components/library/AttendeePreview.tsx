import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { SelectOption } from '../../api/client';
import { OutcomeMapGrid } from '../OutcomeMapGrid';
import { UseCaseCardGrid } from '../UseCaseCardGrid';
import type { LibraryModel } from './model';
import { KINDS, collectionTint, tintStyle } from './theme';
import { CollectionGlyph, EmptyState, Modal, SegmentedControl } from './ui';
import { cx } from './cx';

interface Props {
  open: boolean;
  model: LibraryModel;
  initialCollection: string | null;
  onClose: () => void;
}

/** What attendees see in the workshop's use case picker, built from live data only. */
export function AttendeePreview({ open, model, initialCollection, onClose }: Props) {
  const visible = model.attendeeCollections;
  const kinds = KINDS.filter(k => visible.some(c => c.kind === k.id));
  const startKind = (initialCollection && model.byId[initialCollection]?.kind) || kinds[0]?.id || 'industry';
  const [kind, setKind] = useState<string>(startKind);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setKind(startKind);
    setActive(initialCollection && visible.some(c => c.collection_id === initialCollection) ? initialCollection : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialCollection]);

  const tabs = visible.filter(c => c.kind === kind);
  const current = tabs.find(c => c.collection_id === active) || tabs[0];
  const requestedHidden = initialCollection && !visible.some(c => c.collection_id === initialCollection) ? model.byId[initialCollection] : null;

  const { options, templates } = useMemo(() => {
    if (!current) return { options: [] as SelectOption[], templates: {} as Record<string, string> };
    const entries = (model.entriesByCollection[current.collection_id] || []).filter(e => e.uc.is_active);
    const templates: Record<string, string> = {};
    const options = entries.map<SelectOption>(e => {
      templates[e.uc.use_case] = e.uc.prompt_template;
      return {
        value: e.uc.use_case,
        label: e.uc.use_case_label,
        category: e.category || undefined,
        category_order: e.categoryOrder ?? undefined,
        display_order: e.displayOrder ?? undefined,
        is_certified: e.uc.is_certified,
        home_industry: e.isHome ? undefined : e.uc.industry,
        home_label: e.isHome ? undefined : model.byId[e.uc.industry]?.label,
      };
    });
    return { options, templates };
  }, [current, model]);

  const hasCategories = options.some(o => o.category && o.category_order);

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-6xl"
      icon={<span className="w-9 h-9 rounded-xl bg-primary/15 text-primary inline-flex items-center justify-center"><Eye className="w-4 h-4" /></span>}
      title="Preview as attendee"
      subtitle="Exactly what participants can pick from right now. Hidden collections and use cases are left out."
    >
      {requestedHidden && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/30 text-ui-sm text-amber-600 dark:text-amber-300">
          <EyeOff className="w-4 h-4" />{requestedHidden.label} is hidden from attendees or has no live use cases.
        </div>
      )}
      {visible.length === 0 ? (
        <EmptyState icon={<EyeOff className="w-6 h-6" />} title="Attendees would see nothing" body="Turn on at least one collection with a live use case." />
      ) : (
        <>
          {kinds.length > 1 && (
            <div className="mb-3 flex items-center gap-2">
              <span className="text-ui-xs text-muted-foreground">Explore by</span>
              <SegmentedControl
                id="preview-kind"
                size="sm"
                value={kind}
                onChange={k => { setKind(k); setActive(null); }}
                options={kinds.map(k => ({ id: k.id, label: k.singular, icon: <k.icon className="w-3.5 h-3.5" /> }))}
              />
            </div>
          )}
          <div className="flex items-end gap-1 border-b border-border mb-4 overflow-x-auto lib-scroll">
            {tabs.map(c => {
              const on = c.collection_id === current?.collection_id;
              return (
                <button
                  key={c.collection_id}
                  onClick={() => setActive(c.collection_id)}
                  style={tintStyle(collectionTint(c))}
                  className={cx('relative inline-flex items-center gap-2 px-3 pb-2.5 pt-1.5 text-ui-sm whitespace-nowrap transition-colors', on ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground')}
                >
                  <CollectionGlyph collection={c} size="xs" off={!on} />{c.label}
                  {on && <span className="lib-bar absolute left-2 right-2 -bottom-px h-0.5 rounded-full" />}
                </button>
              );
            })}
          </div>
          {current?.description && <p className="text-ui-sm text-muted-foreground mb-4">{current.description}</p>}
          <div className="pointer-events-none select-none">
            {hasCategories
              ? <OutcomeMapGrid useCases={options} selectedUseCase="" onSelect={() => {}} promptTemplates={templates} />
              : <UseCaseCardGrid useCases={options} selectedUseCase="" onSelect={() => {}} />}
          </div>
        </>
      )}
    </Modal>
  );
}
