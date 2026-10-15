/** Dispatch from anywhere to open the path comparison next to the view toggle. */
export const COMPARE_PATHS_EVENT = 'v2v:compare-paths';

export const openPathComparison = () => window.dispatchEvent(new Event(COMPARE_PATHS_EVENT));
