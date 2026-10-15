import { motion } from 'framer-motion';
import { ArrowUpRight, Plus } from 'lucide-react';
import { useBlueprintDigest } from './blueprintApi';
import { blueprintForIndustry } from './industryMap';
import { MiniConstellation } from './MiniConstellation';

const asQuestion = (s: string) => `What is the ${s.charAt(0).toLowerCase()}${s.slice(1)}?`;

/** Questions the matching industry model answers out of the box. Renders nothing if it can't load. */
export function BlueprintSuggestions({ industryId, exclude, disabled, onAdd }: {
  industryId: string; exclude: string[]; disabled: boolean; onAdd: (q: string) => void;
}) {
  const { data } = useBlueprintDigest(blueprintForIndustry(industryId));
  if (!data) return null;
  const picks = data.starterQuestions.map(s => asQuestion(s.question)).filter(q => !exclude.includes(q)).slice(0, 3);
  if (!picks.length) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-2 border-t border-border/60 space-y-1.5">
      <p className="flex items-center gap-2 px-3 pt-1 text-ui-xs text-muted-foreground">
        <MiniConstellation nodes={7} size={16} />
        Ready-made in the{' '}
        <a href={data.source.galleryUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-foreground/80 hover:text-primary">
          {data.label} industry data model <ArrowUpRight className="w-3 h-3" />
        </a>
      </p>
      {picks.map(q => (
        <button
          key={q}
          disabled={disabled}
          onClick={() => onAdd(q)}
          className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-xl text-ui-md text-foreground/90 hover:bg-card transition-colors disabled:opacity-40"
        >
          <Plus className="w-4 h-4 text-primary shrink-0" /> {q}
        </button>
      ))}
    </motion.div>
  );
}
