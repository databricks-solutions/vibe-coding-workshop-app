import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../../../api/client';
import { refreshReviews, type ReviewChange } from './useIdeas';
import type { Idea } from './types';

interface Reviewer { canReview: boolean; email: string | null; everyone: boolean }

const NOBODY: Reviewer = { canReview: false, email: null, everyone: false };
let reviewer: Promise<Reviewer> | null = null;

/** Who is signed in and whether they may approve. Reports "not a reviewer" until the server answers. */
export function useReviewer(): Reviewer {
  const [me, setMe] = useState<Reviewer>(NOBODY);
  useEffect(() => {
    reviewer ??= apiClient.ideaReviewCapability()
      .then(r => ({ canReview: !!r.canReview, email: r.email?.toLowerCase() ?? null, everyone: r.reviewPolicy !== 'allowlist' }))
      .catch(() => { reviewer = null; return NOBODY; });
    let alive = true;
    void reviewer.then(v => alive && setMe(v));
    return () => { alive = false; };
  }, []);
  return me;
}

export const useCanReview = () => useReviewer().canReview;

/** "jane.doe@corp.com" reads as "Jane Doe". */
export function personName(email?: string | null) {
  if (!email) return 'A reviewer';
  return email.split('@')[0].split(/[._-]+/).filter(Boolean).map(p => p[0].toUpperCase() + p.slice(1)).join(' ');
}

/** Whoever submitted the current revision, from the review history. */
export function submitterOf(idea: Idea) {
  return [...(idea.review?.history ?? [])].reverse().find(h => h.action === 'submitted')?.by?.toLowerCase() ?? null;
}

export const isApproved = (idea: Idea) =>
  idea.review?.status === 'approved' && idea.review.approvedRevision === (idea.revision ?? 0);

/**
 * Keeps review decisions current while a page is open: on mount, when the tab regains focus,
 * and every 30s while something is waiting for review.
 */
export function useReviewRefresh(watching: boolean, onChange?: (changes: ReviewChange[]) => void) {
  const handler = useRef(onChange);
  useEffect(() => { handler.current = onChange; });
  useEffect(() => {
    let alive = true;
    const run = () => void refreshReviews().then(c => { if (alive && c.length) handler.current?.(c); });
    run();
    const onFocus = () => document.visibilityState === 'visible' && run();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    const timer = watching ? setInterval(run, 30_000) : undefined;
    return () => {
      alive = false;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      clearInterval(timer);
    };
  }, [watching]);
}
