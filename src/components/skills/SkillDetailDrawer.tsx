import { useEffect, useRef } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { SKILL_MAP, type TourId } from '../../constants/skillsNavigatorData';
import { SkillDetail } from './SkillDetail';
import { cx } from './uiStyles';

interface SkillDetailDrawerProps {
  skillId: string | null;
  backTo: string | null;
  onBack: () => void;
  onClose: () => void;
  onNavigate: (skillId: string) => void;
  onLearn: (moduleId: string) => void;
  onOpenTour: (tour: TourId, step: number) => void;
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Slide-in skill panel. Traps focus while open and restores it on close. */
export function SkillDetailDrawer({ skillId, backTo, onBack, onClose, onNavigate, onLearn, onOpenTour }: SkillDetailDrawerProps) {
  const skill = skillId ? SKILL_MAP[skillId] : null;
  const open = !!skill;
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => panelRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus(), 30);
    return () => {
      clearTimeout(t);
      restoreRef.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 });
  }, [skillId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const back = backTo ? SKILL_MAP[backTo] : null;

  return (
    <>
      <div
        className={cx(
          'fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={skill?.name ?? 'Skill details'}
        aria-hidden={!open}
        className={cx(
          'fixed top-0 right-0 z-50 h-full w-full sm:w-[480px] overflow-y-auto border-l border-border bg-background shadow-2xl transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {skill && (
          <>
            <div className="sticky top-0 z-10 flex items-center gap-2 px-5 py-3 border-b border-border bg-background/95 backdrop-blur">
              {back ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="flex min-w-0 items-center gap-1.5 text-ui-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4 shrink-0" />
                  <span className="truncate">{back.name}</span>
                </button>
              ) : (
                <span className="text-ui-sm font-medium text-muted-foreground">Skill</span>
              )}
              <button
                type="button"
                data-autofocus
                onClick={onClose}
                aria-label="Close"
                className="ml-auto p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 pt-4 pb-10">
              <SkillDetail key={skill.id} skill={skill} onNavigate={onNavigate} onLearn={onLearn} onOpenTour={onOpenTour} />
            </div>
          </>
        )}
      </div>
    </>
  );
}
