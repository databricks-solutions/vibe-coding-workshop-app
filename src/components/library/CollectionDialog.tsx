import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import type { CollectionKind, LibraryCollection } from '../../api/library';
import { COLLECTION_ICONS, KINDS, TINTS, collectionIconName, collectionTintKey, tintStyle } from './theme';
import { CollectionGlyph, KindBadge, Modal, cx } from './ui';
import { BTN_PRIMARY, BTN_SECONDARY } from '../skills/uiStyles';

export interface CollectionDraft {
  label: string;
  kind: CollectionKind;
  description: string;
  icon: string | null;
  color: string | null;
}

interface Props {
  open: boolean;
  initial: LibraryCollection | null;
  initialKind: CollectionKind;
  onClose: () => void;
  onSubmit: (draft: CollectionDraft) => Promise<void>;
}

const ICONS_BY_KIND: Record<CollectionKind, string[]> = {
  industry: ['ShoppingBasket', 'Store', 'Plane', 'Landmark', 'HeartPulse', 'Factory', 'Zap', 'Clapperboard', 'Building2', 'RadioTower', 'Umbrella', 'Car', 'GraduationCap', 'FlaskConical'],
  function: ['Calculator', 'Megaphone', 'UsersRound', 'Cog', 'ServerCog', 'Target', 'Truck', 'Handshake', 'Compass', 'PieChart'],
  solution: ['Workflow', 'Activity', 'ShieldCheck', 'Bot', 'ChartColumnBig', 'BrainCircuit', 'Layers', 'Sparkles'],
};

export function CollectionDialog({ open, initial, initialKind, onClose, onSubmit }: Props) {
  const [draft, setDraft] = useState<CollectionDraft>({ label: '', kind: initialKind, description: '', icon: null, color: null });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(initial
      ? { label: initial.label, kind: initial.kind, description: initial.description || '', icon: initial.icon, color: initial.color }
      : { label: '', kind: initialKind, description: '', icon: null, color: null });
  }, [open, initial, initialKind]);

  const preview = { collection_id: initial?.collection_id || draft.label.toLowerCase().replace(/[^a-z0-9]+/g, '_'), kind: draft.kind, icon: draft.icon, color: draft.color, label: draft.label || 'New collection' };
  const iconName = collectionIconName(preview);
  const tintKey = collectionTintKey(preview);
  const icons = [...new Set([...ICONS_BY_KIND[draft.kind], ...Object.keys(COLLECTION_ICONS)])].filter(n => COLLECTION_ICONS[n]);

  const submit = async () => {
    if (!draft.label.trim()) return;
    setBusy(true);
    await onSubmit({ ...draft, label: draft.label.trim(), description: draft.description.trim() });
    setBusy(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      title={initial ? `Edit ${initial.label}` : 'New collection'}
      subtitle="Collections group use cases. Attendees browse them as tabs in the workshop."
      footer={
        <>
          <button className={BTN_SECONDARY} onClick={onClose}>Cancel</button>
          <button className={BTN_PRIMARY} disabled={!draft.label.trim() || busy} onClick={submit}>
            <Check className="w-4 h-4" />{busy ? 'Saving…' : initial ? 'Save changes' : 'Create collection'}
          </button>
        </>
      }
    >
      <div style={tintStyle(TINTS[tintKey])} className="lib-wash rounded-2xl ring-1 ring-border p-4 mb-5 flex items-center gap-4">
        <CollectionGlyph collection={preview} size="xl" />
        <div className="min-w-0">
          <KindBadge kind={draft.kind} />
          <div className="text-ui-xl font-semibold text-foreground mt-1 truncate">{draft.label || 'New collection'}</div>
          <div className="text-ui-sm text-muted-foreground truncate">{draft.description || 'A one-line description attendees will see under the tab.'}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-5">
        {KINDS.map(k => {
          const Icon = k.icon;
          const on = draft.kind === k.id;
          return (
            <button
              key={k.id}
              onClick={() => setDraft(d => ({ ...d, kind: k.id }))}
              style={tintStyle(k.tint)}
              className={cx('text-left rounded-xl p-3 ring-1 transition', on ? 'lib-soft ring-2' : 'ring-border hover:bg-secondary/40')}
            >
              <span className="lib-tile w-8 h-8 rounded-lg inline-flex items-center justify-center mb-2"><Icon className="w-4 h-4" /></span>
              <div className="text-ui-sm font-semibold text-foreground">{k.singular}</div>
              <div className="text-ui-2xs text-muted-foreground leading-snug mt-0.5">{k.blurb}</div>
            </button>
          );
        })}
      </div>

      <label className="block text-ui-xs font-medium text-muted-foreground mb-1.5">Name</label>
      <input
        autoFocus
        value={draft.label}
        onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
        onKeyDown={e => { if (e.key === 'Enter') void submit(); }}
        placeholder={draft.kind === 'function' ? 'e.g. Office of the CFO' : draft.kind === 'solution' ? 'e.g. Observability' : 'e.g. Healthcare & Life Sciences'}
        className="w-full px-3 py-2 rounded-lg bg-background ring-1 ring-border text-ui-md outline-none focus:ring-primary/50 mb-4"
      />

      <label className="block text-ui-xs font-medium text-muted-foreground mb-1.5">Description</label>
      <textarea
        rows={2}
        value={draft.description}
        onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
        placeholder="What kinds of plays live here?"
        className="w-full px-3 py-2 rounded-lg bg-background ring-1 ring-border text-ui-sm outline-none focus:ring-primary/50 mb-4 resize-none"
      />

      <div className="grid grid-cols-[1fr_auto] gap-6">
        <div>
          <label className="block text-ui-xs font-medium text-muted-foreground mb-1.5">Icon</label>
          <div className="flex flex-wrap gap-1.5">
            {icons.map(name => {
              const Icon = COLLECTION_ICONS[name];
              const on = name === iconName;
              return (
                <button
                  key={name}
                  title={name}
                  onClick={() => setDraft(d => ({ ...d, icon: name }))}
                  style={on ? tintStyle(TINTS[tintKey]) : undefined}
                  className={cx('w-8 h-8 rounded-lg inline-flex items-center justify-center transition', on ? 'lib-tile' : 'text-muted-foreground hover:text-foreground hover:bg-secondary')}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="block text-ui-xs font-medium text-muted-foreground mb-1.5">Color</label>
          <div className="grid grid-cols-5 gap-1.5">
            {Object.entries(TINTS).map(([key, t]) => (
              <button
                key={key}
                title={t.label}
                onClick={() => setDraft(d => ({ ...d, color: key }))}
                style={tintStyle(t)}
                className={cx('lib-dot w-7 h-7 rounded-full inline-flex items-center justify-center ring-offset-2 ring-offset-card transition', key === tintKey && 'ring-2 ring-foreground/70')}
              >
                {key === tintKey && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
