import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { WorkflowViewMode } from '../../hooks/useWorkflowViewMode';
import { PathChooser } from './PathChooser';

export default function PathChooserModal({ mode, onChoose, onClose }: { mode: WorkflowViewMode; onChoose: (m: WorkflowViewMode) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start sm:items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Compare the two paths">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl border border-border bg-background p-5 sm:p-7 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-ui-sm font-semibold uppercase tracking-[0.14em] text-primary/90">Two ways to build</p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground mt-1">Pick the path that fits you</h2>
            <p className="text-ui-md text-muted-foreground mt-1 max-w-2xl">Same project, two views. Each stage below is what you will actually go through.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"><X className="w-5 h-5" /></button>
        </div>
        <PathChooser mode={mode} onChoose={m => { onChoose(m); onClose(); }} />
      </motion.div>
    </div>,
    document.body,
  );
}
