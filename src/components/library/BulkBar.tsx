import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, EyeOff, FolderPlus, Star, StarOff, X } from 'lucide-react';
import type { LibraryUseCase } from '../../api/library';
import type { LibraryModel } from './model';
import { KINDS } from './theme';
import { CollectionGlyph, cx } from './ui';

interface Props {
  model: LibraryModel;
  selected: LibraryUseCase[];
  onClear: () => void;
  onFlags: (flags: { is_active?: boolean; is_certified?: boolean }) => void;
  onAddTo: (collectionId: string) => void;
  excludeCollection?: string;
}

const BTN = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-ui-sm font-medium text-background/90 hover:bg-background/15 transition-colors';

export function BulkBar({ model, selected, onClear, onFlags, onAddTo, excludeCollection }: Props) {
  const [picker, setPicker] = useState(false);
  return (
    <AnimatePresence>
      {selected.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 460, damping: 36 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40"
        >
          <div className="relative flex items-center gap-1 pl-4 pr-1.5 py-1.5 rounded-2xl bg-foreground text-background shadow-2xl shadow-black/40">
            <span className="text-ui-sm font-semibold tabular-nums pr-2 mr-1 border-r border-background/20">{selected.length} selected</span>
            <button className={BTN} onClick={() => onFlags({ is_active: true })}><Eye className="w-3.5 h-3.5" />Show</button>
            <button className={BTN} onClick={() => onFlags({ is_active: false })}><EyeOff className="w-3.5 h-3.5" />Hide</button>
            <button className={BTN} onClick={() => onFlags({ is_certified: true })}><Star className="w-3.5 h-3.5" />Certify</button>
            <button className={BTN} onClick={() => onFlags({ is_certified: false })}><StarOff className="w-3.5 h-3.5" />Uncertify</button>
            <div className="relative">
              <button className={cx(BTN, picker && 'bg-background/15')} onClick={() => setPicker(p => !p)}><FolderPlus className="w-3.5 h-3.5" />Add to…</button>
              {picker && (
                <div className="absolute bottom-full mb-2 left-0 w-64 max-h-80 overflow-y-auto rounded-xl bg-popover text-foreground p-1.5 shadow-2xl ring-1 ring-border">
                  {KINDS.map(k => {
                    const list = model.byKind[k.id].filter(c => c.collection_id !== excludeCollection);
                    if (!list.length) return null;
                    return (
                      <div key={k.id} className="mb-1">
                        <div className="px-2 pt-1.5 pb-1 text-ui-3xs font-semibold uppercase tracking-wider text-muted-foreground">{k.label}</div>
                        {list.map(c => (
                          <button
                            key={c.collection_id}
                            onClick={() => { setPicker(false); onAddTo(c.collection_id); }}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-ui-sm hover:bg-secondary text-left"
                          >
                            <CollectionGlyph collection={c} size="xs" off={!c.is_enabled} />
                            <span className="truncate">{c.label}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <button onClick={onClear} aria-label="Clear selection" className="ml-1 p-1.5 rounded-lg text-background/70 hover:text-background hover:bg-background/15"><X className="w-4 h-4" /></button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
