import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  BadgeCheck, Check, ChevronDown, Clock, Copy, Eye, FileDiff, GitCompare, History, Home, Layers, Link2, Maximize2,
  Minimize2, PencilLine, Plus, RotateCcw, Search, Trash2, Undo2, X,
} from 'lucide-react';
import { libraryApi, type LibraryCollection, type LibraryUseCase } from '../../api/library';
import { MARKDOWN_COMPONENTS, REMARK_PLUGINS } from '../MarkdownContent.utils';
import { DiffView } from '../DiffView';
import { OutcomeMapCard } from '../OutcomeMapCard';
import { getThemeForColumn } from '../outcomeMapTheme';
import { categoriesOf, columnsFor, keyOf, placementsOf, type LibraryModel } from './model';
import type { LibraryActions } from './useLibrary';
import { KINDS, collectionIcon, collectionTint, relativeTime, tintStyle, iconForUseCase } from './theme';
import { Avatar, CollectionGlyph, KindBadge, Modal, RowMenu, StatusPill, Switch } from './ui';
import { cx } from './cx';
import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY } from '../skills/uiStyles';

type Tab = 'overview' | 'edit' | 'placement' | 'history';

interface Props {
  model: LibraryModel;
  uc: LibraryUseCase | null;
  actions: LibraryActions;
  onClose: () => void;
  onNavigateCollection: (id: string) => void;
}

const draftKey = (uc: LibraryUseCase) => `library.draft.${keyOf(uc)}`;

export function UseCaseDrawer({ model, uc, actions, onClose, onNavigateCollection }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [wide, setWide] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const key = uc ? keyOf(uc) : '';

  const [prevKey, setPrevKey] = useState(key);
  if (prevKey !== key) {
    setPrevKey(key);
    setTab('overview'); setConfirmDelete(false); setDeleteText('');
  }

  useEffect(() => {
    if (!uc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"][aria-modal="true"]')) onClose();
    };
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus(), 40);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(t); };
  }, [uc, onClose]);

  const home = uc ? model.byId[uc.industry] : undefined;
  const tint = home ? collectionTint(home) : { h: 172, s: 66 };

  return createPortal(
    <AnimatePresence>
      {uc && (
        <motion.div
          key="use-case-drawer"
          className="lib-root fixed inset-0 z-[900] pointer-events-none"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.26 } }}
        >
          <motion.div
            initial={{ opacity: 0, pointerEvents: 'auto' }}
            animate={{ opacity: 1, pointerEvents: 'auto' }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-label={uc.use_case_label}
            initial={{ x: '100%', pointerEvents: 'auto' }}
            animate={{ x: 0, pointerEvents: 'auto' }}
            exit={{ x: '100%', pointerEvents: 'none' }}
            transition={{ type: 'tween', ease: [0.22, 1, 0.36, 1], duration: 0.26 }}
            className={cx('absolute right-0 top-0 bottom-0 bg-card shadow-2xl ring-1 ring-border flex flex-col', wide ? 'w-full' : 'w-[min(52rem,100vw)]')}
          >
            {/* Header */}
            <div style={tintStyle(tint)} className="lib-wash border-b border-border">
              <div className="flex items-center gap-2 px-6 pt-4 text-ui-xs text-muted-foreground">
                {home && (
                  <button onClick={() => onNavigateCollection(home.collection_id)} className="inline-flex items-center gap-1.5 hover:text-foreground">
                    <CollectionGlyph collection={home} size="xs" />{home.label}
                  </button>
                )}
                {uc.category && <><span>/</span><span>{uc.category}</span></>}
                <span className="flex-1" />
                <RowMenu
                  items={[
                    { label: 'Copy link', icon: <Link2 className="w-3.5 h-3.5" />, onSelect: () => void navigator.clipboard.writeText(window.location.href) },
                    { label: 'Copy description', icon: <Copy className="w-3.5 h-3.5" />, onSelect: () => void navigator.clipboard.writeText(uc.prompt_template) },
                    { label: 'Delete…', icon: <Trash2 className="w-3.5 h-3.5" />, danger: true, onSelect: () => setConfirmDelete(true) },
                  ]}
                />
                <button className="p-1 rounded-md hover:bg-secondary hover:text-foreground" onClick={() => setWide(w => !w)} aria-label={wide ? 'Collapse panel' : 'Expand panel'}>
                  {wide ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button data-autofocus className="p-1 rounded-md hover:bg-secondary hover:text-foreground" onClick={onClose} aria-label="Close"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex items-start gap-4 px-6 pt-3 pb-4">
                <span className="lib-tile w-12 h-12 rounded-2xl inline-flex items-center justify-center shrink-0"><UseCaseIcon uc={uc} home={home} className="w-6 h-6" /></span>
                <div className="flex-1 min-w-0">
                  <TitleEditor value={uc.use_case_label} onSave={v => void actions.renameUseCase(uc, v)} />
                  <div className="mt-1.5 flex items-center gap-3 text-ui-xs text-muted-foreground">
                    <code className="px-1.5 py-0.5 rounded bg-secondary/80 font-mono text-ui-2xs">{uc.use_case}</code>
                    <span className="inline-flex items-center gap-1"><History className="w-3 h-3" />v{uc.version} of {uc.version_count}</span>
                    {uc.updated_at && <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{relativeTime(uc.updated_at)}</span>}
                    {uc.source === 'ideate' && <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 text-ui-3xs font-semibold">FROM IDEATE</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 px-6 pb-4">
                <FlagPill
                  on={uc.is_active}
                  label={uc.is_active ? 'Live for attendees' : 'Hidden'}
                  icon={<Eye className="w-3.5 h-3.5" />}
                  tone="emerald"
                  onToggle={v => void actions.setFlags([uc], { is_active: v })}
                />
                <FlagPill
                  on={uc.is_certified}
                  label={uc.is_certified ? 'Certified' : 'Not certified'}
                  icon={<BadgeCheck className="w-3.5 h-3.5" />}
                  tone="amber"
                  onToggle={v => void actions.setFlags([uc], { is_certified: v })}
                />
              </div>
              <div className="flex items-center gap-1 px-4" role="tablist">
                {([
                  ['overview', 'Overview', <Eye key="o" className="w-3.5 h-3.5" />],
                  ['edit', 'Edit description', <PencilLine key="e" className="w-3.5 h-3.5" />],
                  ['placement', 'Placement', <Layers key="p" className="w-3.5 h-3.5" />],
                  ['history', 'History', <History key="h" className="w-3.5 h-3.5" />],
                ] as [Tab, string, React.ReactNode][]).map(([id, label, icon]) => (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={tab === id}
                    onClick={() => setTab(id)}
                    className={cx('relative inline-flex items-center gap-1.5 px-3 py-2.5 text-ui-sm font-medium transition-colors', tab === id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}
                  >
                    {icon}{label}
                    {tab === id && <span className="lib-dot absolute left-2 right-2 -bottom-px h-0.5 rounded-full animate-scale-in" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto lib-scroll">
              {tab === 'overview' && <OverviewTab model={model} uc={uc} />}
              {tab === 'edit' && <EditTab uc={uc} actions={actions} onDone={() => setTab('overview')} />}
              {tab === 'placement' && <PlacementTab model={model} uc={uc} actions={actions} />}
              {tab === 'history' && <HistoryTab uc={uc} actions={actions} />}
            </div>
          </motion.div>

          <Modal
            open={confirmDelete}
            onClose={() => setConfirmDelete(false)}
            title="Delete this use case?"
            subtitle="This removes every version and all cross-listings. Hiding it is usually the better choice."
            icon={<span className="w-9 h-9 rounded-xl bg-red-500/15 text-red-500 inline-flex items-center justify-center"><Trash2 className="w-4 h-4" /></span>}
            footer={
              <>
                <button className={BTN_GHOST} onClick={() => { void actions.setFlags([uc], { is_active: false }); setConfirmDelete(false); }}>Hide instead</button>
                <button
                  disabled={deleteText.trim() !== uc.use_case_label.trim()}
                  onClick={async () => { await actions.deleteUseCase(uc); setConfirmDelete(false); onClose(); }}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-ui-sm font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-40"
                >
                  Delete permanently
                </button>
              </>
            }
          >
            <label className="block text-ui-sm text-muted-foreground mb-2">Type <span className="font-semibold text-foreground">{uc.use_case_label}</span> to confirm</label>
            <input autoFocus value={deleteText} onChange={e => setDeleteText(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background ring-1 ring-border outline-none focus:ring-red-500/50 text-ui-sm" />
          </Modal>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function UseCaseIcon({ uc, home, className }: { uc: LibraryUseCase; home: LibraryCollection | undefined; className: string }) {
  return createElement(iconForUseCase(uc, home ? collectionIcon(home) : Layers), { className });
}

function TitleEditor({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setDraft(value);
  }
  return (
    <input
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => draft.trim() && draft !== value && onSave(draft)}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setDraft(value); }}
      aria-label="Use case name"
      className="w-full bg-transparent text-ui-2xl font-semibold tracking-tight text-foreground outline-none rounded-lg -mx-1 px-1 hover:bg-foreground/5 focus:bg-background/60 focus:ring-1 focus:ring-primary/40"
    />
  );
}

function FlagPill({ on, label, icon, tone, onToggle }: { on: boolean; label: string; icon: React.ReactNode; tone: 'emerald' | 'amber'; onToggle: (v: boolean) => void }) {
  const onCls = tone === 'emerald'
    ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-300 ring-emerald-500/30'
    : 'bg-amber-500/12 text-amber-600 dark:text-amber-300 ring-amber-500/30';
  const t = tone === 'emerald' ? { h: 158, s: 70 } : { h: 38, s: 92 };
  return (
    <div className={cx('inline-flex items-center gap-2 pl-3 pr-1.5 py-1 rounded-full ring-1 text-ui-sm font-medium transition-colors', on ? onCls : 'bg-secondary/60 text-muted-foreground ring-border')}>
      {icon}{label}
      <Switch size="sm" checked={on} tint={t} onChange={onToggle} label={label} />
    </div>
  );
}

function OverviewTab({ model, uc }: { model: LibraryModel; uc: LibraryUseCase }) {
  const places = placementsOf(model, uc).filter(p => p.collection);
  const visibleIn = places.filter(p => p.collection!.is_enabled && uc.is_active);
  const homeCols = columnsFor(model.entriesByCollection[uc.industry] || []);
  const colIndex = Math.max(0, homeCols.findIndex(c => c.entries.some(e => e.key === keyOf(uc))));
  return (
    <div className="px-6 py-6 space-y-7">
      <section>
        <h3 className="text-ui-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">As attendees see it</h3>
        <div className="grid grid-cols-[minmax(0,20rem)_1fr] gap-5 items-start">
          <div className={cx('pointer-events-none', !uc.is_active && 'opacity-50 grayscale')}>
            <OutcomeMapCard
              useCase={{ value: uc.use_case, label: uc.use_case_label, is_certified: uc.is_certified, category: uc.category || undefined }}
              theme={getThemeForColumn(colIndex)}
              isSelected={false}
              hasSelection={false}
              onSelect={() => {}}
              promptTemplate={uc.prompt_template}
              staggerIndex={0}
            />
          </div>
          <div className="rounded-xl ring-1 ring-border bg-secondary/20 p-4">
            <div className="text-ui-sm font-medium text-foreground mb-2">
              {visibleIn.length ? 'Attendees find it under' : 'Attendees can’t see this yet'}
            </div>
            {visibleIn.length ? (
              <div className="flex flex-wrap gap-1.5">
                {visibleIn.map(p => (
                  <span key={p.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-card ring-1 ring-border text-ui-xs">
                    <CollectionGlyph collection={p.collection!} size="xs" />{p.collection!.label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-ui-xs text-muted-foreground">
                {!uc.is_active ? 'Turn on “Live for attendees” above.' : 'None of its collections are switched on. Enable one in Placement or the navigator.'}
              </p>
            )}
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-ui-xs">
              <dt className="text-muted-foreground">Home</dt><dd className="text-foreground">{model.byId[uc.industry]?.label || uc.industry}</dd>
              <dt className="text-muted-foreground">Category</dt><dd className="text-foreground">{uc.category || '—'}</dd>
              <dt className="text-muted-foreground">Last edited by</dt><dd className="text-foreground inline-flex items-center gap-1.5"><Avatar email={uc.created_by} size="xs" />{uc.created_by || '—'}</dd>
              <dt className="text-muted-foreground">Status</dt><dd><StatusPill live={uc.is_active} compact /></dd>
            </dl>
          </div>
        </div>
      </section>
      <section>
        <h3 className="text-ui-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Description</h3>
        <article className="rounded-2xl ring-1 ring-border bg-background/40 px-6 py-5 text-ui-base">
          <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>{uc.prompt_template || '_No description yet._'}</ReactMarkdown>
        </article>
      </section>
    </div>
  );
}

function EditTab({ uc, actions, onDone }: { uc: LibraryUseCase; actions: LibraryActions; onDone: () => void }) {
  const [text, setText] = useState(() => localStorage.getItem(draftKey(uc)) ?? uc.prompt_template);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const dirty = text !== uc.prompt_template;
  const [restoredDraft] = useState(() => { const d = localStorage.getItem(draftKey(uc)); return d !== null && d !== uc.prompt_template; });

  useEffect(() => {
    if (dirty) localStorage.setItem(draftKey(uc), text);
    else localStorage.removeItem(draftKey(uc));
  }, [text, dirty, uc]);

  const publish = async () => {
    setBusy(true);
    const v = await actions.publish(uc, text);
    setBusy(false);
    if (v) { localStorage.removeItem(draftKey(uc)); setReview(false); onDone(); }
  };

  return (
    <div className="flex flex-col h-full">
      {restoredDraft && dirty && (
        <div className="mx-6 mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 ring-1 ring-primary/25 text-ui-xs text-foreground">
          <Undo2 className="w-3.5 h-3.5 text-primary" />Restored your unpublished draft.
        </div>
      )}
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-0 border-b border-border">
        <div className="flex flex-col min-h-0 border-r border-border">
          <div className="px-6 py-2 text-ui-2xs font-semibold uppercase tracking-wider text-muted-foreground">Markdown</div>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            spellCheck
            className="flex-1 min-h-[28rem] resize-none px-6 pb-6 bg-transparent font-mono text-ui-sm leading-relaxed text-foreground outline-none"
          />
        </div>
        <div className="flex flex-col min-h-0">
          <div className="px-6 py-2 text-ui-2xs font-semibold uppercase tracking-wider text-muted-foreground">Preview</div>
          <div className="flex-1 overflow-y-auto px-6 pb-6 text-ui-base">
            <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={MARKDOWN_COMPONENTS}>{text || '_Start writing…_'}</ReactMarkdown>
          </div>
        </div>
      </div>
      <div className="sticky bottom-0 flex items-center gap-2 px-6 py-3 bg-card/95 backdrop-blur">
        <span className="text-ui-xs text-muted-foreground">{dirty ? 'Unpublished changes are saved as a draft in this browser.' : 'No changes yet.'}</span>
        <span className="flex-1" />
        {dirty && <button className={BTN_GHOST} onClick={() => setText(uc.prompt_template)}><RotateCcw className="w-3.5 h-3.5" />Discard</button>}
        <button className={BTN_PRIMARY} disabled={!dirty} onClick={() => setReview(true)}><FileDiff className="w-4 h-4" />Review changes</button>
      </div>
      <Modal
        open={review}
        onClose={() => setReview(false)}
        width="max-w-3xl"
        title={`Publish version ${uc.version + 1}`}
        subtitle="Green is added, red is removed. Publishing makes this the version attendees get."
        icon={<span className="w-9 h-9 rounded-xl bg-primary/15 text-primary inline-flex items-center justify-center"><GitCompare className="w-4 h-4" /></span>}
        footer={<><button className={BTN_SECONDARY} onClick={() => setReview(false)}>Keep editing</button><button className={BTN_PRIMARY} disabled={busy} onClick={publish}><Check className="w-4 h-4" />{busy ? 'Publishing…' : `Publish v${uc.version + 1}`}</button></>}
      >
        <div className="rounded-xl ring-1 ring-border bg-background/50 p-4 max-h-[55vh] overflow-y-auto">
          <DiffView oldText={uc.prompt_template} newText={text} compact />
        </div>
      </Modal>
    </div>
  );
}

function PlacementTab({ model, uc, actions }: { model: LibraryModel; uc: LibraryUseCase; actions: LibraryActions }) {
  const initial = useMemo(
    () => placementsOf(model, uc).filter(p => !p.isHome).map(p => ({ collection_id: p.id, category: p.category })),
    [model, uc],
  );
  const [list, setList] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [saving, setSaving] = useState(false);
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setList(initial);
  }
  const home = model.byId[uc.industry];
  const dirty = JSON.stringify(list) !== JSON.stringify(initial);
  const taken = new Set([uc.industry, ...list.map(l => l.collection_id)]);

  return (
    <div className="px-6 py-6 space-y-6">
      <section>
        <h3 className="text-ui-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 inline-flex items-center gap-1.5"><Home className="w-3 h-3" />Home</h3>
        {home && (
          <div style={tintStyle(collectionTint(home))} className="lib-soft rounded-2xl p-4 flex items-center gap-3">
            <CollectionGlyph collection={home} size="lg" off={!home.is_enabled} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2"><span className="text-ui-md font-semibold text-foreground">{home.label}</span><KindBadge kind={home.kind} subtle /></div>
              <div className="text-ui-xs text-muted-foreground mt-0.5">Owns the description and version history{uc.category ? ` · ${uc.category}` : ''}</div>
            </div>
            {!home.is_enabled && <span className="text-ui-2xs px-2 py-0.5 rounded-full bg-muted-foreground/15 text-muted-foreground">Collection off</span>}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center mb-3">
          <h3 className="text-ui-2xs font-semibold uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1.5"><Link2 className="w-3 h-3" />Also appears in</h3>
          <span className="flex-1" />
          <button className={BTN_GHOST} onClick={() => setAdding(a => !a)}><Plus className="w-3.5 h-3.5" />Add to collection</button>
        </div>

        <AnimatePresence>
          {adding && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-3 rounded-2xl ring-1 ring-border bg-popover p-2 shadow-lg">
              <div className="relative mb-1.5">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Find a collection…" className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-background ring-1 ring-border text-ui-sm outline-none" />
              </div>
              <div className="max-h-64 overflow-y-auto">
                {KINDS.map(k => {
                  const opts = model.byKind[k.id].filter(c => !taken.has(c.collection_id) && c.label.toLowerCase().includes(q.toLowerCase()));
                  if (!opts.length) return null;
                  return (
                    <div key={k.id}>
                      <div className="px-2 pt-2 pb-1 text-ui-3xs font-semibold uppercase tracking-wider text-muted-foreground">{k.label}</div>
                      {opts.map(c => (
                        <button key={c.collection_id} onClick={() => { setList(l => [...l, { collection_id: c.collection_id, category: null }]); setAdding(false); setQ(''); }} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary text-left text-ui-sm">
                          <CollectionGlyph collection={c} size="xs" off={!c.is_enabled} />{c.label}
                          {!c.is_enabled && <span className="ml-auto text-ui-3xs text-muted-foreground">off</span>}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center">
            <p className="text-ui-sm text-foreground font-medium">Only in {home?.label}</p>
            <p className="text-ui-xs text-muted-foreground mt-1">Cross-list it into a business function or technical solution so it shows up there too.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map(p => {
              const c = model.byId[p.collection_id];
              if (!c) return null;
              const cats = categoriesOf(model, c.collection_id);
              return (
                <div key={p.collection_id} className="flex items-center gap-3 rounded-xl ring-1 ring-border bg-card px-3 py-2.5">
                  <CollectionGlyph collection={c} size="sm" off={!c.is_enabled} />
                  <div className="flex-1 min-w-0">
                    <div className="text-ui-sm font-medium text-foreground truncate">{c.label}</div>
                    <div className="text-ui-2xs text-muted-foreground">{c.is_enabled ? 'Visible collection' : 'Collection is off'}</div>
                  </div>
                  <CategoryPicker
                    value={p.category}
                    options={cats}
                    onChange={v => setList(l => l.map(x => (x.collection_id === p.collection_id ? { ...x, category: v } : x)))}
                  />
                  <button aria-label={`Remove from ${c.label}`} onClick={() => setList(l => l.filter(x => x.collection_id !== p.collection_id))} className="p-1 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10"><X className="w-4 h-4" /></button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <AnimatePresence>
        {dirty && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="sticky bottom-4 flex items-center gap-2 rounded-2xl bg-foreground text-background px-4 py-2.5 shadow-2xl">
            <span className="text-ui-sm flex-1">Unsaved placement changes</span>
            <button className="px-3 py-1.5 rounded-lg text-ui-sm text-background/80 hover:bg-background/15" onClick={() => setList(initial)}>Reset</button>
            <button
              disabled={saving}
              className="px-3 py-1.5 rounded-lg text-ui-sm font-semibold bg-background text-foreground hover:opacity-90"
              onClick={async () => { setSaving(true); await actions.setPlacements(uc, list); setSaving(false); }}
            >
              {saving ? 'Saving…' : 'Save placements'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CategoryPicker({ value, options, onChange }: { value: string | null; options: string[]; onChange: (v: string | null) => void }) {
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState('');
  if (custom) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => { setCustom(false); if (draft.trim()) onChange(draft.trim()); }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setCustom(false); }}
        placeholder="New category"
        className="w-44 px-2.5 py-1 rounded-lg bg-background ring-1 ring-primary/50 text-ui-xs outline-none"
      />
    );
  }
  return (
    <div className="relative">
      <select
        value={value ?? ''}
        onChange={e => { if (e.target.value === '__new__') { setDraft(''); setCustom(true); } else onChange(e.target.value || null); }}
        className="appearance-none w-44 pl-2.5 pr-7 py-1 rounded-lg bg-secondary/60 ring-1 ring-border text-ui-xs text-foreground outline-none cursor-pointer"
      >
        <option value="">Uncategorized</option>
        {value && !options.includes(value) && <option value={value}>{value}</option>}
        {options.map(o => <option key={o} value={o}>{o}</option>)}
        <option value="__new__">+ New category…</option>
      </select>
      <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
    </div>
  );
}

function HistoryTab({ uc, actions }: { uc: LibraryUseCase; actions: LibraryActions }) {
  const [versions, setVersions] = useState<{ version: number; inserted_at?: string; created_by?: string }[] | null>(null);
  const [compare, setCompare] = useState<{ version: number; text: string } | null>(null);
  const [loadingV, setLoadingV] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    libraryApi.versions(uc.industry, uc.use_case).then(v => alive && setVersions(v)).catch(() => alive && setVersions([]));
    return () => { alive = false; };
  }, [uc.industry, uc.use_case, uc.version]);

  const open = async (v: number) => {
    if (compare?.version === v) { setCompare(null); return; }
    setLoadingV(v);
    try {
      const res = await libraryApi.version(uc.industry, uc.use_case, v);
      setCompare({ version: v, text: res.prompt_template });
    } finally {
      setLoadingV(null);
    }
  };

  return (
    <div className="px-6 py-6">
      <h3 className="text-ui-2xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Recent versions</h3>
      {!versions ? (
        <div className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-14 rounded-xl bg-secondary/40 animate-pulse" />)}</div>
      ) : (
        <ol className="relative border-l border-border ml-3 space-y-4">
          {versions.map(v => {
            const current = v.version === uc.version;
            return (
              <li key={v.version} className="ml-5">
                <span className={cx('absolute -left-[7px] mt-3 w-3.5 h-3.5 rounded-full ring-4 ring-card', current ? 'bg-primary' : 'bg-muted-foreground/40')} />
                <div className={cx('rounded-xl ring-1 px-4 py-3', current ? 'ring-primary/40 bg-primary/[0.05]' : 'ring-border bg-card')}>
                  <div className="flex items-center gap-3">
                    <Avatar email={v.created_by} />
                    <div className="flex-1 min-w-0">
                      <div className="text-ui-sm font-medium text-foreground">
                        Version {v.version} {current && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-ui-3xs font-semibold">CURRENT</span>}
                      </div>
                      <div className="text-ui-xs text-muted-foreground truncate">{v.created_by || 'Unknown'} · {relativeTime(v.inserted_at) || v.inserted_at}</div>
                    </div>
                    {!current && (
                      <>
                        <button className={BTN_GHOST} onClick={() => void open(v.version)}>
                          <GitCompare className="w-3.5 h-3.5" />{loadingV === v.version ? 'Loading…' : compare?.version === v.version ? 'Hide' : 'Compare'}
                        </button>
                        <button
                          className={BTN_GHOST}
                          onClick={async () => {
                            const res = compare?.version === v.version ? compare.text : (await libraryApi.version(uc.industry, uc.use_case, v.version)).prompt_template;
                            await actions.publish(uc, res);
                          }}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />Restore
                        </button>
                      </>
                    )}
                  </div>
                  {compare?.version === v.version && (
                    <div className="mt-3 rounded-lg bg-background/60 ring-1 ring-border p-3 max-h-80 overflow-y-auto">
                      <p className="text-ui-2xs text-muted-foreground mb-2">Changes from v{v.version} to the current version</p>
                      <DiffView oldText={compare.text} newText={uc.prompt_template} compact />
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
