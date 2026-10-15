import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { CornerDownLeft, FolderPlus, Lightbulb, Search } from 'lucide-react';
import type { LibraryCollection, LibraryUseCase } from '../../api/library';
import { keyOf, type LibraryModel } from './model';
import { KIND_BY_ID } from './theme';
import { CollectionGlyph, Kbd, StatusPill } from './ui';
import { cx } from './cx';

type Result =
  | { type: 'collection'; id: string; collection: LibraryCollection }
  | { type: 'usecase'; id: string; uc: LibraryUseCase }
  | { type: 'action'; id: string; label: string; icon: ReactNode; run: () => void };

function Highlight({ text, q }: { text: string; q: string }): ReactNode {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return <>{text.slice(0, i)}<mark className="bg-primary/20 text-foreground rounded-sm">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

interface Props {
  model: LibraryModel;
  onClose: () => void;
  onCollection: (id: string) => void;
  onUseCase: (uc: LibraryUseCase) => void;
  onNewUseCase: () => void;
  onNewCollection: () => void;
}

/** Mount only while open so each opening starts fresh. */
export function LibrarySearch({ model, onClose, onCollection, onUseCase, onNewUseCase, onNewCollection }: Props) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const restore = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => restore?.focus?.();
  }, []);

  const results = useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase();
    const score = (s: string) => {
      const v = s.toLowerCase();
      return v.startsWith(term) ? 3 : v.split(/\s+/).some(w => w.startsWith(term)) ? 2 : v.includes(term) ? 1 : 0;
    };
    const actions: Result[] = [
      { type: 'action', id: 'new-uc', label: 'New use case', icon: <Lightbulb className="w-4 h-4" />, run: onNewUseCase },
      { type: 'action', id: 'new-col', label: 'New collection', icon: <FolderPlus className="w-4 h-4" />, run: onNewCollection },
    ];
    if (!term) {
      const recent = [...model.useCases].filter(u => u.path_type !== 'skill').sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || '')).slice(0, 5);
      return [
        ...model.collections.slice(0, 6).map<Result>(c => ({ type: 'collection', id: c.collection_id, collection: c })),
        ...recent.map<Result>(uc => ({ type: 'usecase', id: keyOf(uc), uc })),
        ...actions,
      ];
    }
    const cols = model.collections
      .map(c => ({ c, s: score(c.label) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map<Result>(({ c }) => ({ type: 'collection', id: c.collection_id, collection: c }));
    const ucs = model.useCases
      .map(u => ({ u, s: score(u.use_case_label) * 2 || (u.category && score(u.category)) || (u.prompt_template.toLowerCase().includes(term) ? 0.5 : 0) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 12)
      .map<Result>(({ u }) => ({ type: 'usecase', id: keyOf(u), uc: u }));
    return [...cols, ...ucs, ...actions.filter(a => a.type === 'action' && a.label.toLowerCase().includes(term))];
  }, [q, model, onNewUseCase, onNewCollection]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (r: Result | undefined) => {
    if (!r) return;
    onClose();
    if (r.type === 'collection') onCollection(r.collection.collection_id);
    else if (r.type === 'usecase') onUseCase(r.uc);
    else r.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(results.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(results[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  const groupOf = (r: Result) => (r.type === 'collection' ? 'Collections' : r.type === 'usecase' ? (q ? 'Use cases' : 'Recently edited') : 'Actions');

  return createPortal(
    <div className="lib-root fixed inset-0 z-[1000] flex items-start justify-center pt-[12vh] px-4" onKeyDown={onKeyDown}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Search the library"
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 36 }}
        className="relative w-full max-w-xl rounded-2xl bg-popover shadow-2xl ring-1 ring-border overflow-hidden"
      >
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search collections, use cases, categories…" className="flex-1 py-3.5 bg-transparent text-ui-md outline-none placeholder:text-muted-foreground" />
          <Kbd>Esc</Kbd>
        </div>
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-1.5 lib-scroll">
          {results.length === 0 && <div className="py-10 text-center text-ui-sm text-muted-foreground">No matches for “{q}”</div>}
          {results.map((r, i) => {
            const showHeader = i === 0 || groupOf(results[i - 1]) !== groupOf(r);
            return (
              <div key={`${r.type}-${r.id}`}>
                {showHeader && <div className="px-2.5 pt-2.5 pb-1 text-ui-3xs font-semibold uppercase tracking-wider text-muted-foreground">{groupOf(r)}</div>}
                <button
                  data-idx={i}
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(r)}
                  className={cx('w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left', i === active ? 'bg-secondary' : '')}
                >
                  {r.type === 'collection' && (
                    <>
                      <CollectionGlyph collection={r.collection} size="sm" off={!r.collection.is_enabled} />
                      <span className="flex-1 min-w-0 truncate text-ui-sm text-foreground"><Highlight text={r.collection.label} q={q} /></span>
                      <span className="text-ui-2xs text-muted-foreground">{KIND_BY_ID[r.collection.kind].singular}</span>
                    </>
                  )}
                  {r.type === 'usecase' && (() => {
                    const home = model.byId[r.uc.industry];
                    return (
                      <>
                        {home ? <CollectionGlyph collection={home} size="sm" off={!r.uc.is_active} /> : <span className="w-7 h-7" />}
                        <span className="flex-1 min-w-0">
                          <span className="block truncate text-ui-sm text-foreground"><Highlight text={r.uc.use_case_label} q={q} /></span>
                          <span className="block truncate text-ui-2xs text-muted-foreground">{home?.label}{r.uc.category ? ` · ${r.uc.category}` : ''}</span>
                        </span>
                        <StatusPill live={r.uc.is_active} compact />
                      </>
                    );
                  })()}
                  {r.type === 'action' && (
                    <>
                      <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary inline-flex items-center justify-center">{r.icon}</span>
                      <span className="flex-1 text-ui-sm text-foreground">{r.label}</span>
                    </>
                  )}
                  {i === active && <CornerDownLeft className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
