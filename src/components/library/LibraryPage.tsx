import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check, Info, Keyboard, LibraryBig, RefreshCw, Trash2, X } from 'lucide-react';
import { libraryApi, type CollectionKind, type LibraryCollection, type LibraryUseCase } from '../../api/library';
import { keyOf, type LibraryModel } from './model';
import { useLibrary, type Notice } from './useLibrary';
import { CollectionNavigator, type LibraryView } from './CollectionNavigator';
import { CollectionPage } from './CollectionPage';
import { UseCaseDrawer } from './UseCaseDrawer';
import { LibraryHome } from './LibraryHome';
import { AllUseCases } from './AllUseCases';
import { ReviewQueue } from './ReviewQueue';
import { CollectionDialog, type CollectionDraft } from './CollectionDialog';
import { NewUseCaseOverlay } from './NewUseCaseOverlay';
import { AttendeePreview } from './AttendeePreview';
import { LibrarySearch } from './LibrarySearch';
import { EmptyState, Kbd, Modal } from './ui';
import { cx } from './cx';
import { BTN_GHOST, BTN_PRIMARY } from '../skills/uiStyles';
import './library.css';

function parseView(pathname: string): LibraryView {
  const rest = pathname.replace(/^\/library\/?/, '');
  if (rest === 'all') return { name: 'all' };
  if (rest === 'review') return { name: 'review' };
  if (rest === 'skills') return { name: 'skills' };
  if (rest.startsWith('c/')) return { name: 'collection', id: decodeURIComponent(rest.slice(2)) };
  return { name: 'home' };
}

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
};

function Toasts({ notices, onDismiss }: { notices: Notice[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[1100] flex flex-col gap-2 items-end pointer-events-none" aria-live="polite">
      <AnimatePresence initial={false}>
        {notices.map(n => (
          <motion.div
            key={n.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, transition: { duration: 0.15 } }}
            className="pointer-events-auto flex items-center gap-3 pl-3 pr-2 py-2 rounded-xl bg-zinc-900 text-zinc-50 shadow-2xl ring-1 ring-white/10 max-w-md"
          >
            <span className={cx('w-6 h-6 rounded-full inline-flex items-center justify-center shrink-0', n.tone === 'error' ? 'bg-red-500/20 text-red-400' : n.tone === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-sky-500/20 text-sky-400')}>
              {n.tone === 'error' ? <AlertTriangle className="w-3.5 h-3.5" /> : n.tone === 'success' ? <Check className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
            </span>
            <span className="text-ui-sm flex-1">{n.message}</span>
            {n.undo && (
              <button onClick={() => { n.undo?.(); onDismiss(n.id); }} className="px-2 py-1 rounded-md text-ui-sm font-semibold text-sky-300 hover:bg-white/10">Undo</button>
            )}
            <button onClick={() => onDismiss(n.id)} aria-label="Dismiss" className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-white/10"><X className="w-3.5 h-3.5" /></button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

const SHORTCUTS: [string[], string][] = [
  [['⌘', 'K'], 'Search the library'],
  [['/'], 'Filter the current list'],
  [['N'], 'New use case'],
  [['Space'], 'Toggle Live on the focused card'],
  [['Enter'], 'Open the focused card'],
  [['Esc'], 'Close the drawer or dialog'],
  [['?'], 'Show this help'],
];

function LoadingSkeleton() {
  return (
    <div className="flex-1 flex">
      <div className="w-72 border-r border-border p-4 space-y-3">
        {Array.from({ length: 9 }).map((_, i) => <div key={i} className="h-8 rounded-lg bg-secondary/60 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />)}
      </div>
      <div className="flex-1 p-8 space-y-6">
        <div className="h-10 w-72 rounded-lg bg-secondary/60 animate-pulse" />
        <div className="grid grid-cols-4 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 rounded-2xl bg-secondary/50 animate-pulse" />)}</div>
        <div className="h-80 rounded-2xl bg-secondary/40 animate-pulse" />
      </div>
    </div>
  );
}

export function LibraryPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [notices, setNotices] = useState<Notice[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setNotices(ns => ns.filter(n => n.id !== id)), []);
  const notify = useCallback((n: Omit<Notice, 'id'>) => {
    const id = nextId.current++;
    setNotices(ns => [...ns.slice(-3), { ...n, id }]);
    window.setTimeout(() => dismiss(id), n.tone === 'error' ? 8000 : n.undo ? 6000 : 4000);
  }, [dismiss]);

  const { model, loading, error, capabilities, actions } = useLibrary(notify);

  const view = parseView(location.pathname);
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const ucParam = params.get('uc');
  const pair = (params.get('in') || '').split(',').filter(Boolean);

  const go = useCallback((path: string) => navigate(path), [navigate]);
  const setParam = useCallback((key: string, value: string | null) => {
    const next = new URLSearchParams(location.search);
    if (value) next.set(key, value); else next.delete(key);
    const qs = next.toString();
    navigate({ pathname: location.pathname, search: qs ? `?${qs}` : '' }, { replace: key === 'uc' && !value });
  }, [location.pathname, location.search, navigate]);

  const openUseCase = useCallback((uc: LibraryUseCase) => setParam('uc', keyOf(uc)), [setParam]);
  const drawerUc = model && ucParam ? model.ucByKey[ucParam] ?? null : null;

  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [preview, setPreview] = useState<{ open: boolean; collection: string | null }>({ open: false, collection: null });
  const [collectionDialog, setCollectionDialog] = useState<{ open: boolean; initial: LibraryCollection | null; kind: CollectionKind }>({ open: false, initial: null, kind: 'industry' });
  const [deleting, setDeleting] = useState<LibraryCollection | null>(null);
  const [deleteText, setDeleteText] = useState('');
  const [newUc, setNewUc] = useState<{ open: boolean; home: string; alsoIn: string[] }>({ open: false, home: '', alsoIn: [] });

  const currentCollection = model && view.name === 'collection' ? model.byId[view.id] : undefined;

  const startNewUseCase = useCallback((home?: string, alsoIn: string[] = []) => {
    if (!model) return;
    const fallback = currentCollection?.collection_id || model.byKind.industry.find(c => c.collection_id !== 'sample')?.collection_id || model.collections[0]?.collection_id;
    const h = home || fallback;
    if (!h) { notify({ tone: 'info', message: 'Create a collection first' }); return; }
    setNewUc({ open: true, home: h, alsoIn });
  }, [model, currentCollection, notify]);

  const createCollection = useCallback((kind: CollectionKind) => setCollectionDialog({ open: true, initial: null, kind }), []);
  const editCollection = useCallback((c: LibraryCollection) => setCollectionDialog({ open: true, initial: c, kind: c.kind }), []);

  const submitCollection = async (d: CollectionDraft) => {
    const init = collectionDialog.initial;
    if (init) {
      await actions.updateCollection(init.collection_id, { label: d.label, kind: d.kind, description: d.description || null, icon: d.icon, color: d.color });
      setCollectionDialog(s => ({ ...s, open: false }));
    } else {
      const id = await actions.createCollection({ label: d.label, kind: d.kind, description: d.description || null, icon: d.icon, color: d.color });
      if (id) {
        setCollectionDialog(s => ({ ...s, open: false }));
        go(`/library/c/${id}`);
      }
    }
  };

  const addTo = useCallback(async (ucs: LibraryUseCase[], collectionId: string, m: LibraryModel) => {
    const target = m.byId[collectionId];
    const todo = ucs.filter(u => u.industry !== collectionId && !(m.membersByKey[keyOf(u)] || []).some(x => x.collection_id === collectionId));
    if (!todo.length) { notify({ tone: 'info', message: `Already in ${target?.label || 'that collection'}` }); return; }
    try {
      await Promise.all(todo.map(u => libraryApi.setPlacements(u.industry, u.use_case, [
        ...(m.membersByKey[keyOf(u)] || []).filter(x => !x.locked).map(x => ({ collection_id: x.collection_id, category: x.category })),
        { collection_id: collectionId },
      ])));
      notify({ tone: 'success', message: `Added ${todo.length === 1 ? `“${todo[0].use_case_label}”` : `${todo.length} use cases`} to ${target?.label}` });
    } catch (e) {
      notify({ tone: 'error', message: (e as Error).message || 'Couldn’t add to collection' });
    }
    await actions.reload();
  }, [actions, notify]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(o => !o); return; }
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === '/') {
        const el = document.querySelector<HTMLInputElement>('[data-library-filter]');
        if (el) { e.preventDefault(); el.focus(); }
      } else if (e.key === '?') { e.preventDefault(); setHelpOpen(true); }
      else if (e.key.toLowerCase() === 'n' && !ucParam) { e.preventDefault(); startNewUseCase(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startNewUseCase, ucParam]);

  useEffect(() => {
    if (model && view.name === 'collection' && !model.byId[view.id]) go('/library');
  }, [model, view, go]);

  if (loading) return <div className="lib-root h-full flex"><LoadingSkeleton /></div>;
  if (error || !model) {
    return (
      <div className="lib-root h-full flex items-center justify-center">
        <EmptyState
          icon={<LibraryBig className="w-6 h-6" />}
          title="Couldn’t load the library"
          body={error || 'Something went wrong.'}
          action={<button className={BTN_PRIMARY} onClick={() => void actions.reload()}><RefreshCw className="w-4 h-4" />Try again</button>}
        />
      </div>
    );
  }

  const deleteCount = deleting ? model.useCases.filter(u => u.industry === deleting.collection_id).length : 0;

  return (
    <div className="lib-root h-full flex overflow-hidden bg-background">
      <CollectionNavigator
        model={model}
        view={view}
        actions={actions}
        onNavigate={go}
        onSearch={() => setSearchOpen(true)}
        onCreateCollection={createCollection}
        onEditCollection={editCollection}
        onDeleteCollection={c => { setDeleting(c); setDeleteText(''); }}
      />

      <main className="flex-1 min-w-0 overflow-y-auto lib-scroll">
        {capabilities && !capabilities.tables && (
          <div className="mx-8 mt-6 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/30 text-ui-sm text-amber-700 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            The collections tables aren’t set up in this database yet, so industries are read from use cases and horizontals can’t be saved. Run the Lakebase setup to enable them.
          </div>
        )}
        <motion.div
            key={view.name === 'collection' ? `c-${view.id}` : view.name}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {view.name === 'home' && (
              <LibraryHome
                model={model}
                onNavigate={go}
                onOpen={openUseCase}
                onPreview={() => setPreview({ open: true, collection: null })}
                onCreateCollection={createCollection}
                onCreateIn={(home, also) => startNewUseCase(home, [also])}
              />
            )}
            {(view.name === 'all' || view.name === 'skills') && (
              <AllUseCases
                model={model}
                actions={actions}
                mode={view.name}
                pair={view.name === 'all' ? pair : []}
                onClearPair={() => setParam('in', null)}
                onOpen={openUseCase}
                onAddTo={(ucs, cid) => void addTo(ucs, cid, model)}
              />
            )}
            {view.name === 'review' && (
              <ReviewQueue
                notify={notify}
                model={model}
                actions={actions}
                onOpenUseCase={openUseCase}
              />
            )}
            {currentCollection && (
              <CollectionPage
                model={model}
                collection={currentCollection}
                actions={actions}
                onOpen={openUseCase}
                onNewUseCase={id => startNewUseCase(id)}
                onPreview={id => setPreview({ open: true, collection: id })}
                onEditCollection={editCollection}
                onAddTo={(ucs, cid) => void addTo(ucs, cid, model)}
              />
            )}
          </motion.div>
      </main>

      <UseCaseDrawer
        model={model}
        uc={drawerUc}
        actions={actions}
        onClose={() => setParam('uc', null)}
        onNavigateCollection={id => go(`/library/c/${id}`)}
      />

      {searchOpen && (
        <LibrarySearch
          model={model}
          onClose={() => setSearchOpen(false)}
          onCollection={id => go(`/library/c/${id}`)}
          onUseCase={openUseCase}
          onNewUseCase={() => startNewUseCase()}
          onNewCollection={() => createCollection(view.name === 'collection' && currentCollection ? currentCollection.kind : 'industry')}
        />
      )}

      <CollectionDialog
        open={collectionDialog.open}
        initial={collectionDialog.initial}
        initialKind={collectionDialog.kind}
        onClose={() => setCollectionDialog(s => ({ ...s, open: false }))}
        onSubmit={submitCollection}
      />

      <NewUseCaseOverlay
        open={newUc.open}
        model={model}
        homeId={newUc.home}
        alsoIn={newUc.alsoIn}
        actions={actions}
        onClose={() => setNewUc(s => ({ ...s, open: false }))}
        onCreated={(industry, useCase) => {
          setNewUc(s => ({ ...s, open: false }));
          navigate({ pathname: `/library/c/${industry}`, search: `?uc=${encodeURIComponent(`${industry}.${useCase}`)}` });
        }}
      />

      <AttendeePreview
        open={preview.open}
        model={model}
        initialCollection={preview.collection}
        onClose={() => setPreview({ open: false, collection: null })}
      />

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        icon={<span className="w-9 h-9 rounded-xl bg-red-500/15 text-red-500 inline-flex items-center justify-center"><Trash2 className="w-4 h-4" /></span>}
        title={`Delete ${deleting?.label}?`}
        subtitle={deleteCount
          ? `This permanently deletes the ${deleteCount} use case${deleteCount === 1 ? '' : 's'} it owns, with every version, and removes its cross-listings. Hiding the collection keeps everything.`
          : 'Its cross-listings will be removed. No use cases are owned by it.'}
        footer={
          <>
            <button className={BTN_GHOST} onClick={() => setDeleting(null)}>Cancel</button>
            {deleting?.is_enabled && (
              <button className={BTN_GHOST} onClick={() => { void actions.updateCollection(deleting.collection_id, { is_enabled: false }); setDeleting(null); }}>Hide instead</button>
            )}
            <button
              disabled={deleteText.trim() !== deleting?.label}
              onClick={async () => {
                if (!deleting) return;
                const id = deleting.collection_id;
                setDeleting(null);
                if (view.name === 'collection' && view.id === id) go('/library');
                await actions.deleteCollection(id);
              }}
              className="px-3.5 py-2 rounded-lg text-ui-sm font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Delete collection
            </button>
          </>
        }
      >
        <label className="block text-ui-xs text-muted-foreground mb-1.5">Type <span className="font-semibold text-foreground">{deleting?.label}</span> to confirm</label>
        <input autoFocus value={deleteText} onChange={e => setDeleteText(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background ring-1 ring-border text-ui-sm outline-none focus:ring-red-500/50" />
      </Modal>

      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        icon={<span className="w-9 h-9 rounded-xl bg-primary/15 text-primary inline-flex items-center justify-center"><Keyboard className="w-4 h-4" /></span>}
        title="Keyboard shortcuts"
      >
        <dl className="divide-y divide-border">
          {SHORTCUTS.map(([keys, label]) => (
            <div key={label} className="flex items-center justify-between py-2">
              <dt className="text-ui-sm text-foreground">{label}</dt>
              <dd className="flex gap-1">{keys.map(k => <Kbd key={k}>{k}</Kbd>)}</dd>
            </div>
          ))}
        </dl>
      </Modal>

      <Toasts notices={notices} onDismiss={dismiss} />
    </div>
  );
}

export default LibraryPage;
