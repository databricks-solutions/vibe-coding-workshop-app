import { ChevronRight, GraduationCap, Route } from 'lucide-react';
import { SKILL_MAP, type NavSkill, type TourId } from '../../constants/skillsNavigatorData';
import { highlightCode } from './skillsNavUtils';
import {
  canCopyPrompt,
  descIsSummary,
  isNewSkill,
  moduleFor,
  placeOf,
  summaryOf,
  tint,
  toursForSkill,
  trackOf,
  typeInfo,
} from './navModel';
import { CopyButton, Disclosure, Html, NewBadge, TypeBadge } from './ui';
import { BTN_SECONDARY } from './uiStyles';

export interface SkillDetailProps {
  skill: NavSkill;
  onNavigate: (skillId: string) => void;
  onLearn: (moduleId: string) => void;
  onOpenTour?: (tour: TourId, step: number) => void;
}

function SkillChip({ id, onNavigate }: { id: string; onNavigate: (id: string) => void }) {
  const s = SKILL_MAP[id];
  if (!s) return null;
  return (
    <button
      type="button"
      onClick={() => onNavigate(id)}
      className="sn-tint-ring w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border bg-card text-left text-ui-sm hover:bg-secondary transition-colors"
      style={tint(typeInfo(s.type).color)}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: typeInfo(s.type).color }} />
      <span className="flex-1 font-medium text-foreground truncate">{s.name}</span>
      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
    </button>
  );
}

function Pills({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((k) => (
        <span key={k} className="px-2 py-1 rounded-md bg-secondary text-ui-xs text-muted-foreground">
          {k}
        </span>
      ))}
    </div>
  );
}

/**
 * Skill details, layered: a summary with the main actions is always visible;
 * everything heavier (how it works, steps, code, keywords) is collapsed.
 */
export function SkillDetail({ skill, onNavigate, onLearn, onOpenTour }: SkillDetailProps) {
  const track = trackOf(skill);
  const place = placeOf(skill);
  const module = moduleFor(skill);
  const copyable = canCopyPrompt(skill);
  const tours = toursForSkill(skill.id);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 text-ui-xs text-muted-foreground">
        {track && (
          <span className="sn-tint-text font-semibold" style={tint(track.color)}>
            {track.label}
          </span>
        )}
        {track && place && <ChevronRight className="w-3 h-3" />}
        {place && <span>{place}</span>}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <h2 className="text-ui-xl font-semibold text-foreground leading-tight">{skill.name}</h2>
        <TypeBadge type={skill.type} />
        {isNewSkill(skill.id) && <NewBadge />}
      </div>
      <p className="mt-2 text-ui-base text-muted-foreground leading-relaxed">{summaryOf(skill)}</p>

      {(copyable || module) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {copyable && <CopyButton text={skill.prompt!} />}
          {module && (
            <button type="button" className={BTN_SECONDARY} onClick={() => onLearn(module.id)}>
              <GraduationCap className="w-4 h-4" />
              Learn {module.title}
            </button>
          )}
        </div>
      )}

      <div className="mt-5">
        {skill.desc && !descIsSummary(skill) && (
          <Disclosure title="How it works" defaultOpen={!copyable}>
            <Html html={skill.desc} />
          </Disclosure>
        )}
        {skill.rationale && (
          <Disclosure title="Why this pattern">
            <Html html={skill.rationale} />
          </Disclosure>
        )}
        {!!skill.workers?.length && (
          <Disclosure title="Steps" count={skill.workers.length}>
            <div className="space-y-1.5">
              {skill.workers.map((id) => (
                <SkillChip key={id} id={id} onNavigate={onNavigate} />
              ))}
            </div>
          </Disclosure>
        )}
        {!!skill.commonDeps?.length && (
          <Disclosure title="Shared skills it uses" count={skill.commonDeps.length}>
            <div className="space-y-1.5">
              {skill.commonDeps.map((id) => (
                <SkillChip key={id} id={id} onNavigate={onNavigate} />
              ))}
            </div>
          </Disclosure>
        )}
        {!!skill.emits?.length && (
          <Disclosure title="What it produces" count={skill.emits.length}>
            <Pills items={skill.emits} />
          </Disclosure>
        )}
        {skill.code && (
          <Disclosure title="Code pattern">
            <div className="relative">
              <div className="sn-code" dangerouslySetInnerHTML={{ __html: highlightCode(skill.code) }} />
              <CopyButton text={skill.code} label="Copy code" variant="icon" className="absolute top-2 right-2 bg-card" />
            </div>
          </Disclosure>
        )}
        {copyable && (
          <Disclosure title="Prompt">
            <p className="whitespace-pre-wrap rounded-lg bg-secondary p-3 text-ui-sm text-foreground">{skill.prompt}</p>
          </Disclosure>
        )}
        {!!skill.keywords?.length && (
          <Disclosure title="Phrases that trigger it" count={skill.keywords.length}>
            <Pills items={skill.keywords} />
          </Disclosure>
        )}
        {onOpenTour && tours.length > 0 && (
          <Disclosure title="Seen in tours" count={tours.length}>
            <div className="space-y-1.5">
              {tours.map(({ tour, step }) => (
                <button
                  key={tour.id}
                  type="button"
                  onClick={() => onOpenTour(tour.id, Math.max(step, 0))}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border bg-card text-left text-ui-sm hover:bg-secondary transition-colors"
                >
                  <Route className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-foreground">
                    Tour {tour.id.toUpperCase()}: {tour.title}
                  </span>
                  {step >= 0 && <span className="text-ui-xs text-muted-foreground">Step {step + 1}</span>}
                </button>
              ))}
            </div>
          </Disclosure>
        )}
      </div>
    </div>
  );
}
