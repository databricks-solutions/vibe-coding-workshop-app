import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

const LINES = [
  'Choosing Genie Code as your assistant',
  'Setting up the Genie path',
  'Saving your questions',
];

/** A short, deliberate beat between planning and building. */
export function LaunchScreen({ name, onDone }: { name: string; onDone: () => void }) {
  const [done, setDone] = useState(0);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  useEffect(() => {
    if (done >= LINES.length) {
      const t = setTimeout(() => onDoneRef.current(), 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setDone(d => d + 1), 450);
    return () => clearTimeout(t);
  }, [done]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm space-y-6 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <motion.div
            className="w-6 h-6 rounded-full border-[3px] border-primary/25 border-t-primary"
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
          />
        </div>
        <div>
          <p className="text-ui-xl font-semibold text-foreground">Getting {name || 'your Genie'} ready</p>
          <p className="text-ui-md text-muted-foreground mt-1">This only takes a second.</p>
        </div>
        <ul className="space-y-2.5 text-left inline-block">
          {LINES.map((line, i) => (
            <li key={line} className={`flex items-center gap-2.5 text-ui-md transition-colors ${i < done ? 'text-foreground' : 'text-muted-foreground/50'}`}>
              <span className={`flex items-center justify-center w-5 h-5 rounded-full transition-all ${i < done ? 'bg-emerald-500 text-white scale-100' : 'bg-secondary scale-90'}`}>
                {i < done && <Check className="w-3 h-3" strokeWidth={3} />}
              </span>
              {line}
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}
