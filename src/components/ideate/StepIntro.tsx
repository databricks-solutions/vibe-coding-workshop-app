import { motion, useReducedMotion } from 'framer-motion';
import { STEP_ART } from './art';
import { STEPS, type StepKey } from './types';
import { stepIndex } from './ideaContext';

export function StepIntro({ step }: { step: StepKey }) {
  const reduce = useReducedMotion();
  const { image, promise } = STEP_ART[step];
  const { hint, optional } = STEPS[stepIndex(step)];

  return (
    <motion.div
      key={step}
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex items-center gap-4 mb-6"
    >
      <img
        src={image}
        alt=""
        width={72}
        height={72}
        className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-2xl object-cover ring-1 ring-border/60 flex-shrink-0"
      />
      <div className="min-w-0">
        <p className="text-ui-2xs uppercase tracking-wider font-semibold text-primary/80">
          Step {stepIndex(step) + 1} of {STEPS.length}{optional && ' · Optional'}
        </p>
        <h2 className="text-ui-xl sm:text-ui-2xl font-semibold text-foreground leading-tight">{hint}</h2>
        <p className="text-ui-sm text-muted-foreground mt-0.5">{promise}</p>
      </div>
    </motion.div>
  );
}
