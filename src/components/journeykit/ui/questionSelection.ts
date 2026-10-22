/** Multi-select answers are persisted as one string with this separator. */
export const MULTI_SEPARATOR = '; ';

/** Internal value used to distinguish "not sure" from a real custom answer. */
export const NOT_SURE_PICK = '\u0000not-sure';

export interface QuestionSelection {
  picks: string[];
  custom: string[];
}

/**
 * Restores a persisted answer into the local selection model.
 *
 * Custom answers must remain selections even though they are absent from the
 * generated option list. This is especially important when reopening a
 * question through Edit.
 */
export function restoreQuestionSelection(
  selected: string | undefined,
  options: string[],
  multi: boolean,
  notSureValues: string[],
): QuestionSelection {
  if (!selected) return { picks: [], custom: [] };
  if (notSureValues.includes(selected)) return { picks: [NOT_SURE_PICK], custom: [] };

  const values = multi
    ? selected.split(MULTI_SEPARATOR).map(value => value.trim()).filter(Boolean)
    : [selected.trim()].filter(Boolean);
  const custom = values.filter(value => !options.includes(value));
  return { picks: values, custom };
}
