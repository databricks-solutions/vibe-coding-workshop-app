import type { Contribution } from '../../api/contrib';

export interface SupportingResource {
  url: string;
  label?: string | null;
}

export type ResourceKind = 'youtube' | 'google_doc' | 'google_sheet' | 'google_slide' | 'video' | 'web';

export interface ResourcePresentation {
  kind: ResourceKind;
  provider: string;
  title: string;
  hostname: string;
  thumbnailUrl: string | null;
}

export function featuredResourceOf(input: {
  resource_url?: string | null;
  resource_label?: string | null;
  contribution?: Contribution;
}): SupportingResource | null {
  if (input.resource_url) return { url: input.resource_url, label: input.resource_label };
  return input.contribution?.featured_resource ?? null;
}

function youtubeId(url: URL): string | null {
  if (url.hostname === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] ?? null;
  if (!/(^|\.)youtube\.com$/.test(url.hostname)) return null;
  if (url.pathname === '/watch') return url.searchParams.get('v');
  const [section, id] = url.pathname.split('/').filter(Boolean);
  return ['embed', 'shorts', 'live'].includes(section) ? id ?? null : null;
}

export function resourcePresentation(resource: SupportingResource): ResourcePresentation | null {
  let url: URL;
  try {
    url = new URL(resource.url);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;

  const yt = youtubeId(url);
  if (yt && /^[A-Za-z0-9_-]{6,20}$/.test(yt)) {
    return {
      kind: 'youtube',
      provider: 'YouTube video',
      title: resource.label?.trim() || 'Watch the recording',
      hostname: url.hostname,
      thumbnailUrl: `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
    };
  }

  const googleHost = /(^|\.)google\.com$/.test(url.hostname);
  const directVideo = /\.(mp4|webm|mov|m4v)(?:$|\?)/i.test(resource.url);
  let kind: ResourceKind = directVideo ? 'video' : 'web';
  let provider = directVideo ? 'Video' : url.hostname.replace(/^www\./, '');
  let fallback = directVideo ? 'Watch the recording' : 'Open supporting resource';

  if (googleHost && url.pathname.startsWith('/document/')) {
    kind = 'google_doc';
    provider = 'Google Doc';
    fallback = 'Open supporting document';
  } else if (googleHost && url.pathname.startsWith('/spreadsheets/')) {
    kind = 'google_sheet';
    provider = 'Google Sheet';
    fallback = 'Open supporting spreadsheet';
  } else if (googleHost && url.pathname.startsWith('/presentation/')) {
    kind = 'google_slide';
    provider = 'Google Slides';
    fallback = 'Open supporting presentation';
  }

  return {
    kind,
    provider,
    title: resource.label?.trim() || fallback,
    hostname: url.hostname.replace(/^www\./, ''),
    thumbnailUrl: null,
  };
}
