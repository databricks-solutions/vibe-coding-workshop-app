import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { ChevronDown, Lightbulb, Pencil, Plus, X } from 'lucide-react';
import { useUseCaseBuilder } from '../../hooks/useUseCaseBuilder';
import { UseCaseBuilderPanel } from '../UseCaseBuilderPanel';
import { categoriesOf, columnsFor, type LibraryModel } from './model';
import type { LibraryActions } from './useLibrary';
import { KINDS } from './theme';
import { CollectionGlyph, Kbd, Modal } from './ui';
import { cx } from './cx';
import { BTN_GHOST, BTN_PRIMARY } from '../skills/uiStyles';

interface Props {
  open: boolean;
  model: LibraryModel;
  homeId: string;
  alsoIn: string[];
  actions: LibraryActions;
  onClose: () => void;
  onCreated: (industry: string, useCase: string) => void;
}

const toSlug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export function NewUseCaseOverlay({ open, model, homeId, alsoIn, actions, onClose, onCreated }: Props) {
  const builder = useUseCaseBuilder();
  const [home, setHome] = useState(homeId);
  const [category, setCategory] = useState<string>('');
  const [newCategory, setNewCategory] = useState(false);
  const [extra, setExtra] = useState<string[]>(alsoIn);
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [editingSlug, setEditingSlug] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [adding, setAdding] = useState(false);

  const homeCollection = model.byId[home];

  useEffect(() => {
    if (!open) return;
    setHome(homeId);
    setExtra(alsoIn);
    setCategory('');
    setNewCategory(false);
    setSlug('');
    setSlugEdited(false);
    setConfirmDiscard(false);
    builder.setUseCaseName('');
    builder.setHints('');
    builder.setAttachments([]);
    builder.setOutputText('');
    builder.setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, homeId, alsoIn.join(',')]);

  useEffect(() => {
    if (homeCollection) builder.setIndustry(homeCollection.label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeCollection?.label]);

  const derivedSlug = slugEdited ? slug : toSlug(builder.useCaseName);
  const description = builder.isEditing ? builder.editText : builder.outputText;
  const taken = useMemo(() => new Set(model.useCases.filter(u => u.industry === home).map(u => u.use_case)), [model, home]);
  const slugTaken = taken.has(derivedSlug);
  const canSave = !!(builder.useCaseName.trim() && description.trim() && derivedSlug && !slugTaken && !builder.isStreaming && !saving);
  const cats = categoriesOf(model, home);

  const close = () => {
    if (builder.outputText || builder.isStreaming) setConfirmDiscard(true);
    else onClose();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmDiscard) { e.preventDefault(); close(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const col = columnsFor(model.entriesByCollection[home] || []).find(c => c.title === category);
    const ok = await actions.createUseCase({
      industry: home,
      use_case: derivedSlug,
      use_case_label: builder.useCaseName.trim(),
      prompt_template: description.trim(),
      category: category || null,
      category_order: col && col.order < 900 ? col.order : category ? Math.max(0, ...columnsFor(model.entriesByCollection[home] || []).map(c => (c.order < 900 ? c.order : 0))) + 1 : null,
      alsoIn: extra.filter(id => id !== home),
    });
    setSaving(false);
    if (ok) {
      if (builder.isStreaming) builder.handleStopStreaming();
      onCreated(home, derivedSlug);
    }
  };

  if (!open) return null;

  return createPortal(
    <div className="lib-root fixed inset-0 z-[950] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
        className="relative w-[calc(100vw-48px)] h-[calc(100vh-48px)] bg-card rounded-2xl shadow-2xl ring-1 ring-border flex flex-col overflow-hidden"
      >
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-secondary/20">
          <span className="w-9 h-9 rounded-xl bg-amber-500/15 ring-1 ring-amber-500/30 text-amber-500 inline-flex items-center justify-center"><Lightbulb className="w-4 h-4" /></span>
          <div className="flex-1">
            <h3 className="text-ui-lg font-semibold text-foreground">New use case</h3>
            <p className="text-ui-xs text-muted-foreground">Describe the idea and let the builder draft the description. You can edit it before saving.</p>
          </div>
          <button onClick={close} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary" aria-label="Close"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-[20rem_1fr]">
          <aside className="border-r border-border p-5 space-y-5 overflow-y-auto">
            <div>
              <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Home collection</label>
              <div className="relative">
                <select
                  value={home}
                  onChange={e => { setHome(e.target.value); setCategory(''); }}
                  className="appearance-none w-full pl-3 pr-8 py-2 rounded-lg bg-background ring-1 ring-border text-ui-sm outline-none focus:ring-primary/50"
                >
                  {KINDS.map(k => (
                    <optgroup key={k.id} label={k.label}>
                      {model.byKind[k.id].map(c => <option key={c.collection_id} value={c.collection_id}>{c.label}</option>)}
                    </optgroup>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
              <p className="text-ui-2xs text-muted-foreground mt-1.5">Owns the description and its versions.</p>
            </div>

            <div>
              <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Category</label>
              {newCategory ? (
                <input autoFocus value={category} onChange={e => setCategory(e.target.value)} onBlur={() => !category && setNewCategory(false)} placeholder="New category name" className="w-full px-3 py-2 rounded-lg bg-background ring-1 ring-primary/50 text-ui-sm outline-none" />
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  <button onClick={() => setCategory('')} className={cx('px-2.5 py-1 rounded-full text-ui-xs ring-1', !category ? 'bg-primary/15 text-primary ring-primary/30' : 'ring-border text-muted-foreground hover:text-foreground')}>None</button>
                  {cats.map(c => (
                    <button key={c} onClick={() => setCategory(c)} className={cx('px-2.5 py-1 rounded-full text-ui-xs ring-1 max-w-full truncate', category === c ? 'bg-primary/15 text-primary ring-primary/30' : 'ring-border text-muted-foreground hover:text-foreground')}>{c}</button>
                  ))}
                  <button onClick={() => { setCategory(''); setNewCategory(true); }} className="px-2.5 py-1 rounded-full text-ui-xs ring-1 ring-dashed ring-border border border-dashed border-border text-muted-foreground hover:text-foreground">+ New</button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Also appears in</label>
              <div className="flex flex-wrap gap-1.5">
                {extra.filter(id => id !== home).map(id => {
                  const c = model.byId[id];
                  if (!c) return null;
                  return (
                    <span key={id} className="inline-flex items-center gap-1.5 pl-1 pr-1 py-0.5 rounded-full bg-secondary ring-1 ring-border text-ui-xs">
                      <CollectionGlyph collection={c} size="xs" />{c.label}
                      <button onClick={() => setExtra(x => x.filter(y => y !== id))} className="p-0.5 rounded-full hover:bg-background" aria-label={`Remove ${c.label}`}><X className="w-3 h-3" /></button>
                    </span>
                  );
                })}
                <div className="relative">
                  <button onClick={() => setAdding(a => !a)} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-ui-xs text-muted-foreground ring-1 ring-border hover:text-foreground"><Plus className="w-3 h-3" />Add</button>
                  {adding && (
                    <div className="absolute z-10 left-0 top-full mt-1 w-60 max-h-72 overflow-y-auto rounded-xl bg-popover p-1.5 shadow-xl ring-1 ring-border">
                      {KINDS.map(k => {
                        const opts = model.byKind[k.id].filter(c => c.collection_id !== home && !extra.includes(c.collection_id));
                        if (!opts.length) return null;
                        return (
                          <div key={k.id}>
                            <div className="px-2 pt-1.5 pb-1 text-ui-3xs font-semibold uppercase tracking-wider text-muted-foreground">{k.label}</div>
                            {opts.map(c => (
                              <button key={c.collection_id} onClick={() => { setExtra(x => [...x, c.collection_id]); setAdding(false); }} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary text-ui-sm text-left">
                                <CollectionGlyph collection={c} size="xs" />{c.label}
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-ui-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Use case ID</label>
              {editingSlug ? (
                <input
                  autoFocus
                  value={derivedSlug}
                  onChange={e => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')); setSlugEdited(true); }}
                  onBlur={() => { setEditingSlug(false); if (!slug) setSlugEdited(false); }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-background ring-1 ring-primary/50 font-mono text-ui-xs outline-none"
                />
              ) : (
                <button onClick={() => setEditingSlug(true)} className="inline-flex items-center gap-1.5 group">
                  <code className="px-2 py-1 rounded-md bg-secondary font-mono text-ui-xs text-foreground">{derivedSlug || 'auto_from_name'}</code>
                  <Pencil className="w-3 h-3 text-muted-foreground group-hover:text-primary" />
                </button>
              )}
              {slugTaken && <p className="text-ui-2xs text-red-500 mt-1">That ID is already used in {homeCollection?.label}.</p>}
            </div>
          </aside>

          <div className="min-h-0 overflow-y-auto px-6 py-5">
            <UseCaseBuilderPanel builder={builder} hideSave hideIndustry />
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 py-3 border-t border-border bg-secondary/20">
          <span className="text-ui-xs text-muted-foreground">Press <Kbd>Esc</Kbd> to close</span>
          <span className="flex-1" />
          <button className={BTN_GHOST} onClick={close}>Cancel</button>
          <button className={BTN_PRIMARY} disabled={!canSave} onClick={save}>{saving ? 'Creating…' : 'Create use case'}</button>
        </div>
      </motion.div>

      <Modal
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Discard this draft?"
        subtitle="The generated description hasn’t been saved."
        footer={<><button className={BTN_GHOST} onClick={() => setConfirmDiscard(false)}>Keep editing</button><button className="px-3.5 py-2 rounded-lg text-ui-sm font-semibold bg-red-500 text-white hover:bg-red-600" onClick={() => { if (builder.isStreaming) builder.handleStopStreaming(); setConfirmDiscard(false); onClose(); }}>Discard</button></>}
      >
        <span />
      </Modal>
    </div>,
    document.body,
  );
}
