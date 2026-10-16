import type { SkillType } from '../constants/skillTreeMapping';

/**
 * Returns true if the skill type supports content viewing.
 */
export function isSkillViewable(type: SkillType): boolean {
  return type !== 'input' && type !== 'manifest';
}
