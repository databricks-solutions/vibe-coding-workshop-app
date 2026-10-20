import { BadgeCheck, Eye, EyeOff, Target } from 'lucide-react';
import type { Entry } from './model';
import type { FocusPlan } from './curation';
import { ContributedBadge } from './ContributedBadge';
import { Modal } from './ui';
import { BTN_GHOST, BTN_PRIMARY } from '../skills/uiStyles';

interface Props {
  open: boolean;
  plan: FocusPlan<Entry>;
  collectionLabel: string;
  onClose: () => void;
  onApply: () => void;
}

export function FocusDialog({ open, plan, collectionLabel, onClose, onApply }: Props) {
  const action = plan.hide.length ? `Hide ${plan.hide.length}` : `Show ${plan.show.length}`;
  return (
    <Modal
      open={open}
      onClose={onClose}
      width="max-w-2xl"
      icon={<span className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-500 inline-flex items-center justify-center"><Target className="w-4 h-4" /></span>}
      title={`Focus ${collectionLabel} on certified`}
      subtitle={`Keeps ${plan.keepCount} live: every certified use case, plus the first live one in any column with nothing certified. Nothing is deleted, and you can undo.`}
      footer={
        <>
          <button className={BTN_GHOST} onClick={onClose}>Cancel</button>
          <button className={BTN_PRIMARY} disabled={!plan.hide.length && !plan.show.length} onClick={onApply}>
            <EyeOff className="w-4 h-4" />{action}
          </button>
        </>
      }
    >
      <div className="space-y-2.5">
        {plan.columns.map(col => {
          const hiding = col.hide.filter(e => e.uc.is_active);
          const already = col.hide.length - hiding.length;
          if (!col.keep.length && !hiding.length) return null;
          return (
            <div key={col.title ?? '__none__'} className="rounded-xl ring-1 ring-border bg-background/40 p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex-1 text-ui-sm font-semibold text-foreground">{col.title || 'Uncategorized'}</span>
                {col.filled && <span className="text-ui-2xs text-muted-foreground">Nothing certified, keeps the first live one</span>}
              </div>
              <ul className="space-y-1">
                {col.keep.map(e => (
                  <li key={e.key} className="flex items-center gap-2 text-ui-sm text-foreground">
                    {e.uc.is_certified ? <BadgeCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" /> : <Eye className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                    <span className="truncate">{e.uc.use_case_label}</span>
                    <ContributedBadge uc={e.uc} compact />
                    {!e.uc.is_active && <span className="ml-auto text-ui-2xs font-medium text-emerald-600 dark:text-emerald-300">Goes live</span>}
                  </li>
                ))}
                {hiding.map(e => (
                  <li key={e.key} className="flex items-center gap-2 text-ui-sm text-muted-foreground">
                    <EyeOff className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate line-through decoration-muted-foreground/40">{e.uc.use_case_label}</span>
                    <ContributedBadge uc={e.uc} compact />
                  </li>
                ))}
                {already > 0 && <li className="text-ui-2xs text-muted-foreground pl-5">+{already} already hidden</li>}
              </ul>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
