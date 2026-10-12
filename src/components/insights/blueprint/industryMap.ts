/** Insights industry ideas (journey.ts) to their closest data model in the gallery. */
export const INDUSTRY_TO_BLUEPRINT: Record<string, string> = {
  retail: 'retail',
  financial_services: 'banking',
  healthcare: 'healthcare',
  manufacturing: 'manufacturing',
  media_telecom: 'telecommunication',
  travel_hospitality: 'travel_hospitality',
};

export const blueprintForIndustry = (industryId: string): string | null => INDUSTRY_TO_BLUEPRINT[industryId] ?? null;
