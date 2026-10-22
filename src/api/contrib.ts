/** Use cases contributed through the repository's contrib/ folder (see contrib/README.md). */

export type Provenance = 'native' | 'partner' | 'third_party';

export type ContributorType = 'partner' | 'company' | 'individual' | 'group';

export interface ContributorBrief {
  id: string;
  type: ContributorType;
  display_name: string;
  website: string | null;
  avatar_url: string | null;
}

export interface ContributionCertification {
  by: ContributorBrief;
  version: string;
  date: string;
  notes: string;
  evidence_url: string | null;
}

export interface Contribution {
  key: string;
  provenance: Exclude<Provenance, 'native'>;
  sample: boolean;
  status: 'active' | 'deprecated' | 'withdrawn';
  version: string;
  summary: string;
  contributor: ContributorBrief;
  co_contributors: ContributorBrief[];
  authors: { name: string; github?: string | null; url?: string | null }[];
  tags: string[];
  featured_resource: { label: string; url: string } | null;
  links: { label: string; url: string }[];
  changelog: { version: string; date: string; notes: string }[];
  media: { cover_url: string | null; screenshot_urls: string[] };
  certifications: ContributionCertification[];
  source_path: string;
  source_url: string | null;
  guide_url: string | null;
}

export interface ContribStatus {
  enabled: boolean;
  root: string;
  contributors: number;
  use_cases: number;
  sample_present: boolean;
  loaded_at: string | null;
  guide_url: string | null;
  sample_url: string | null;
  errors: { path: string; message: string }[];
  warnings: { path: string; message: string }[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init);
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

export const contribApi = {
  status: () => request<ContribStatus>('/contrib/status'),
  reload: () => request<ContribStatus>('/contrib/reload', { method: 'POST' }),
};
