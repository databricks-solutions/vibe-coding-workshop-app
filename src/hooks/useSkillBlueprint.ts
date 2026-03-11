import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../api/client';
import { getSkillBlueprint, type SkillBlueprintConfig } from '../constants/skillTreeMapping';

/**
 * Module-level cache: fetched once and shared across all WorkflowStep instances.
 * Maps section_tag → raw input_template string.
 */
const templateCache = new Map<string, string>();
let fetchPromise: Promise<void> | null = null;
let fetchDone = false;

function ensureTemplatesLoaded(): Promise<void> {
  if (fetchDone) return Promise.resolve();
  if (fetchPromise) return fetchPromise;

  fetchPromise = apiClient
    .getLatestSectionInputs()
    .then(inputs => {
      for (const input of inputs) {
        templateCache.set(input.section_tag, input.input_template);
      }
      fetchDone = true;
    })
    .catch(() => {
      fetchPromise = null;
    });

  return fetchPromise;
}

/**
 * Returns a SkillBlueprintConfig for the given sectionTag.
 *
 * Uses the static SKILL_BLUEPRINTS map first (full traversal with workers,
 * commons, references). Falls back to dynamic parsing of the input_template
 * for steps not in the static map.
 */
export function useSkillBlueprint(sectionTag: string): SkillBlueprintConfig | null {
  const [ready, setReady] = useState(fetchDone);

  useEffect(() => {
    if (fetchDone) {
      setReady(true);
      return;
    }
    let cancelled = false;
    ensureTemplatesLoaded().then(() => {
      if (!cancelled) setReady(true);
    });
    return () => { cancelled = true; };
  }, [sectionTag]);

  return useMemo(() => {
    const template = ready ? templateCache.get(sectionTag) : undefined;
    return getSkillBlueprint(sectionTag, template);
  }, [ready, sectionTag]);
}
