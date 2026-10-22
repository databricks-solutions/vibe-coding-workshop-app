import { useEffect, useState } from 'react';
import { apiClient } from '../../../api/client';
import type { ValueProfile } from '../../journeykit';

export interface ApprovedIndustry {
  id: string;
  label: string;
  description: string;
  kind: 'industry' | 'function' | 'solution';
  icon: string | null;
}

export const SAMPLE_COLLECTION = 'sample';

export interface ApprovedUseCase {
  industry: string;
  industryLabel: string;
  useCase: string;
  label: string;
  certified: boolean;
  category: string;
  resourceUrl?: string | null;
  resourceLabel?: string | null;
}

export type QuestionSource = 'use_case_genie' | 'use_case_text' | 'suggested' | 'none';

export interface UseCasePreview {
  summary: string;
  personas: { name: string; role: string }[];
  entities: string[];
  capabilities: string[];
  questions: string[];
  questionSource: QuestionSource;
  valueProfile?: ValueProfile | null;
}

/** Workshop catalog industries map onto the Insights industry ideas where they overlap. */
const TO_INSIGHTS: Record<string, string> = {
  retail: 'retail',
  cpg: 'retail',
  travel: 'travel_hospitality',
  financial_services: 'financial_services',
  healthcare: 'healthcare',
  manufacturing: 'manufacturing',
};

export const insightsIndustryFor = (catalogIndustry: string) => TO_INSIGHTS[catalogIndustry] ?? '';

export function catalogIndustryFor(insightsIndustry: string, available: ApprovedIndustry[]): string {
  const match = Object.entries(TO_INSIGHTS).find(([cat, ins]) => ins === insightsIndustry && available.some(a => a.id === cat));
  return match?.[0] ?? '';
}

let industriesPromise: Promise<ApprovedIndustry[]> | null = null;
const useCasePromises = new Map<string, Promise<ApprovedUseCase[]>>();
const previewPromises = new Map<string, Promise<UseCasePreview>>();

function industries(): Promise<ApprovedIndustry[]> {
  if (!industriesPromise) {
    industriesPromise = apiClient.getIndustries()
      .then(list => list
        .filter(i => i.value)
        .map(i => ({
          id: i.value,
          label: i.value === SAMPLE_COLLECTION ? 'Samples' : i.label,
          description: i.description || (i.value === SAMPLE_COLLECTION ? 'Small end-to-end starters. A quick way to try the flow before picking an industry play.' : ''),
          kind: i.kind ?? 'industry',
          icon: i.icon ?? null,
        })))
      .catch(err => { industriesPromise = null; throw err; });
  }
  return industriesPromise;
}

function fetchUseCases(ind: ApprovedIndustry): Promise<ApprovedUseCase[]> {
  let p = useCasePromises.get(ind.id);
  if (!p) {
    p = apiClient.getUseCases(ind.id)
      .then(list => list
        .filter(u => u.value && u.path_type !== 'skill')
        .map(u => ({
          industry: u.home_industry || ind.id,
          industryLabel: u.home_label || ind.label,
          useCase: u.value,
          label: u.label,
          certified: !!u.is_certified,
          category: u.category ?? '',
          resourceUrl: u.resource_url,
          resourceLabel: u.resource_label,
        }))
        .sort((a, b) => Number(b.certified) - Number(a.certified)))
      .catch(err => { useCasePromises.delete(ind.id); throw err; });
    useCasePromises.set(ind.id, p);
  }
  return p;
}

async function preview(industry: string, useCase: string): Promise<UseCasePreview> {
  const res = await fetch(`/api/insights/use-case/${encodeURIComponent(industry)}/${encodeURIComponent(useCase)}`, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Preview failed (${res.status})`);
  return res.json();
}

function cachedPreview(industry: string, useCase: string): Promise<UseCasePreview> {
  const key = `${industry}/${useCase}`;
  let p = previewPromises.get(key);
  if (!p) {
    p = preview(industry, useCase).catch(err => { previewPromises.delete(key); throw err; });
    previewPromises.set(key, p);
  }
  return p;
}

export function prefetchPreview(uc: ApprovedUseCase): void {
  cachedPreview(uc.industry, uc.useCase).catch(() => {});
}

export function useApprovedIndustries(): { data: ApprovedIndustry[] | null; failed: boolean } {
  const [state, setState] = useState<{ data: ApprovedIndustry[] | null; failed: boolean }>({ data: null, failed: false });
  useEffect(() => {
    let alive = true;
    industries()
      .then(data => alive && setState({ data, failed: false }))
      .catch(() => alive && setState({ data: null, failed: true }));
    return () => { alive = false; };
  }, []);
  return state;
}

export function useApprovedUseCases(ind: ApprovedIndustry | null): ApprovedUseCase[] | null {
  const [result, setResult] = useState<{ id: string; list: ApprovedUseCase[] } | null>(null);
  useEffect(() => {
    if (!ind) return;
    let alive = true;
    fetchUseCases(ind).then(list => alive && setResult({ id: ind.id, list })).catch(() => alive && setResult({ id: ind.id, list: [] }));
    return () => { alive = false; };
  }, [ind]);
  return ind && result?.id === ind.id ? result.list : null;
}

export function useUseCaseCounts(list: ApprovedIndustry[] | null): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!list?.length) return;
    let alive = true;
    for (const ind of list) {
      fetchUseCases(ind)
        .then(ucs => alive && setCounts(prev => ({ ...prev, [ind.id]: ucs.length })))
        .catch(() => {});
    }
    return () => { alive = false; };
  }, [list]);
  return counts;
}

export function useUseCasePreview(uc: ApprovedUseCase | null): { data: UseCasePreview | null; failed: boolean } {
  const key = uc ? `${uc.industry}/${uc.useCase}` : '';
  const [result, setResult] = useState<{ key: string; data: UseCasePreview | null } | null>(null);
  useEffect(() => {
    if (!uc) return;
    let alive = true;
    cachedPreview(uc.industry, uc.useCase)
      .then(data => alive && setResult({ key, data }))
      .catch(() => alive && setResult({ key, data: null }));
    return () => { alive = false; };
  }, [uc, key]);
  if (!uc || result?.key !== key) return { data: null, failed: false };
  return { data: result.data, failed: result.data === null };
}