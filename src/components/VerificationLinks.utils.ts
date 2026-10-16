import { STEP_VERIFICATION_LINKS, type VerificationLink } from '../constants/verificationLinks';

export interface ResolvedVerificationLink extends VerificationLink {
  url: string;
}

export function resolveUrl(template: string, params: Record<string, string>): string | null {
  const workspaceUrl = (params.workspace_url || '').replace(/\/+$/, '');
  const resolvedParams: Record<string, string> = { ...params, workspace_url: workspaceUrl ? workspaceUrl + '/' : '' };

  let url = template;
  const placeholders = template.match(/\{(\w+)\}/g);
  if (!placeholders) return template;

  for (const ph of placeholders) {
    const key = ph.slice(1, -1);
    const val = resolvedParams[key];
    if (!val) return null;
    const isAbsoluteUrl = /^https?:\/\//i.test(val);
    url = url.replace(ph, isAbsoluteUrl ? val : encodeURIComponent(val));
  }
  return url;
}

export function hasVerificationLinks(sectionTag: string): boolean {
  const linkDefs = STEP_VERIFICATION_LINKS[sectionTag];
  return !!linkDefs && linkDefs.length > 0;
}

/** The step's links whose every placeholder resolves from `params`, in definition order. */
export function resolveVerificationLinks(
  sectionTag: string,
  params: Record<string, string>,
): ResolvedVerificationLink[] {
  const resolved: ResolvedVerificationLink[] = [];
  for (const link of STEP_VERIFICATION_LINKS[sectionTag] ?? []) {
    const url = resolveUrl(link.urlTemplate, params);
    if (url !== null) resolved.push({ ...link, url });
  }
  return resolved;
}
