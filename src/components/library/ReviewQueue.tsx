import { AnimatePresence, motion } from 'framer-motion';
import { Check, Inbox, PencilLine, X } from 'lucide-react';
import type { LibraryUseCase } from '../../api/library';
import { deriveValueProp } from '../outcomeMapTheme';
import { keyOf, type LibraryModel } from './model';
import type { LibraryActions } from './useLibrary';
import { relativeTime } from './theme';
import { Avatar, CollectionGlyph, EmptyState } from './ui';
import { BTN_GHOST, BTN_SECONDARY } from '../skills/uiStyles';

interface Props {
  model: LibraryModel;
  actions: LibraryActions;
  canDismiss: boolean;
  onOpen: (uc: LibraryUseCase) => void;
}

export function ReviewQueue({ model, actions, canDismiss, onOpen }: Props) {
  const items = model.pendingReview;
  return (
    <div className="px-8 py-8 max-w-4xl mx-auto">
      <header className="flex items-center gap-3 mb-6">
        <span className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 inline-flex items-center justify-center"><Inbox className="w-5 h-5" /></span>
        <div>
          <h1 className="text-ui-2xl font-semibold text-foreground">Needs review</h1>
          <p className="text-ui-sm text-muted-foreground">Ideas attendees shaped in Ideate and submitted to the library. They stay hidden until you approve them.</p>
        </div>
      </header>

      {items.length === 0 ? (
        <EmptyState icon={<Check className="w-6 h-6" />} title="You’re all caught up" body="New submissions from Ideate will appear here." />
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {items.map(u => {
              const home = model.byId[u.industry];
              return (
                <motion.article
                  key={keyOf(u)}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
                  className="rounded-2xl ring-1 ring-border bg-card p-5"
                >
                  <div className="flex items-start gap-4">
                    <Avatar email={u.created_by} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-ui-xs text-muted-foreground mb-1">
                        <span className="font-medium text-foreground/80">{u.created_by || 'Someone'}</span>
                        <span>submitted {relativeTime(u.updated_at)}</span>
                        {home && <><span>to</span><span className="inline-flex items-center gap-1"><CollectionGlyph collection={home} size="xs" />{home.label}</span></>}
                        {u.category && <span>· {u.category}</span>}
                      </div>
                      <h3 className="text-ui-lg font-semibold text-foreground">{u.use_case_label}</h3>
                      <p className="text-ui-sm text-muted-foreground mt-1 line-clamp-3">{deriveValueProp(u.prompt_template, '')}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 pl-10">
                    <button
                      onClick={() => void actions.review(u, 'approve')}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-ui-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-500 transition-colors"
                    >
                      <Check className="w-4 h-4" />Approve and go live
                    </button>
                    <button className={BTN_SECONDARY} onClick={() => onOpen(u)}><PencilLine className="w-4 h-4" />Edit first</button>
                    <span className="flex-1" />
                    {canDismiss && <button className={BTN_GHOST} onClick={() => void actions.review(u, 'dismiss')}><X className="w-3.5 h-3.5" />Dismiss</button>}
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
