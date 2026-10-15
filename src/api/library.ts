/**
 * Use Case Library API: collections (industries, business functions,
 * technical solutions), their use cases and cross-listings.
 */

export type CollectionKind = 'industry' | 'function' | 'solution';

export interface LibraryCollection {
  collection_id: string;
  kind: CollectionKind;
  label: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  display_order: number;
  is_enabled: boolean;
  updated_at?: string | null;
  updated_by?: string | null;
}

export type UseCaseSource = 'seed' | 'admin' | 'ideate' | 'ideate_approved' | 'ideate_dismissed';

export interface LibraryUseCase {
  industry: string;
  industry_label: string;
  use_case: string;
  use_case_label: string;
  prompt_template: string;
  version: number;
  version_count: number;
  is_active: boolean;
  is_certified: boolean;
  path_type: 'use_case' | 'skill';
  category: string | null;
  category_order: number | null;
  display_order: number | null;
  created_by: string | null;
  source: UseCaseSource;
  updated_at: string | null;
}

export interface LibraryMember {
  collection_id: string;
  home_industry: string;
  use_case: string;
  category: string | null;
  category_order: number | null;
  display_order: number | null;
}

export interface LibraryPayload {
  collections: LibraryCollection[];
  use_cases: LibraryUseCase[];
  members: LibraryMember[];
  capabilities: { tables: boolean; source: boolean };
}

export interface UseCaseFlags {
  is_active?: boolean;
  is_certified?: boolean;
  use_case_label?: string;
  category?: string | null;
  category_order?: number | null;
  display_order?: number | null;
}

export interface LayoutItem {
  industry: string;
  use_case: string;
  category: string | null;
  category_order: number | null;
  display_order: number | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      detail = body?.detail || body?.error || detail;
    } catch {
      /* keep status text */
    }
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  return res.json();
}

const enc = encodeURIComponent;
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const libraryApi = {
  load: () => request<LibraryPayload>('/config/library'),

  createCollection: (body: { label: string; kind: CollectionKind; description?: string | null; icon?: string | null; color?: string | null }) =>
    request<{ collection_id: string }>('/config/collections', json('POST', body)),

  updateCollection: (id: string, body: Partial<Pick<LibraryCollection, 'label' | 'kind' | 'description' | 'icon' | 'color' | 'is_enabled'>>) =>
    request<{ success: boolean }>(`/config/collections/${enc(id)}`, json('PATCH', body)),

  reorderCollections: (ids: string[]) =>
    request<{ success: boolean }>('/config/collections/order', json('PUT', { ids })),

  deleteCollection: (id: string) =>
    request<{ success: boolean }>(`/config/collections/${enc(id)}`, { method: 'DELETE' }),

  updateUseCase: (industry: string, useCase: string, body: UseCaseFlags) =>
    request<{ success: boolean }>(`/config/use-cases/${enc(industry)}/${enc(useCase)}`, json('PATCH', body)),

  bulkUpdate: (items: { industry: string; use_case: string }[], flags: Pick<UseCaseFlags, 'is_active' | 'is_certified'>) =>
    request<{ success: boolean }>('/config/use-cases/bulk', json('PATCH', { items, ...flags })),

  setPlacements: (industry: string, useCase: string, placements: { collection_id: string; category?: string | null }[]) =>
    request<{ success: boolean }>(`/config/use-cases/${enc(industry)}/${enc(useCase)}/placements`, json('PUT', { placements })),

  setLayout: (collectionId: string, items: LayoutItem[]) =>
    request<{ success: boolean }>(`/config/collections/${enc(collectionId)}/layout`, json('PUT', { items })),

  review: (industry: string, useCase: string, action: 'approve' | 'dismiss') =>
    request<{ success: boolean }>(`/config/use-cases/${enc(industry)}/${enc(useCase)}/review`, json('POST', { action })),

  createUseCase: (body: { industry: string; use_case: string; use_case_label: string; prompt_template: string }) =>
    request<{ success: boolean }>('/config/use-cases', json('POST', body)),

  publishVersion: (body: { industry: string; industry_label: string; use_case: string; use_case_label: string; prompt_template: string }) =>
    request<{ version: number }>('/config/prompts', json('POST', body)),

  versions: (industry: string, useCase: string) =>
    request<{ version: number; inserted_at?: string; created_by?: string }[]>(
      `/config/prompts/versions?industry=${enc(industry)}&use_case=${enc(useCase)}`,
    ),

  version: (industry: string, useCase: string, version: number) =>
    request<{ prompt_template: string; version: number; created_by?: string; inserted_at?: string }>(
      `/config/prompts/version/${enc(industry)}/${enc(useCase)}/${version}`,
    ),

  deleteUseCase: (industry: string, useCase: string) =>
    request<{ success: boolean }>(`/config/prompts/${enc(industry)}/${enc(useCase)}`, { method: 'DELETE' }),
};
