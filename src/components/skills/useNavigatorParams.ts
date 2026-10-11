import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SKILL_MAP, TOURS, type TourId } from '../../constants/skillsNavigatorData';
import { MODULE_MAP, TRACK_MAP, type TrackId, type View } from './navModel';

const VIEWS: View[] = ['map', 'tours', 'skills', 'learn'];

export interface NavParams {
  view: View;
  track: TrackId | null;
  tour: TourId | null;
  step: number;
  skill: string | null;
  module: string | null;
  /** Skills library filter: a track id or "new". */
  filter: string | null;
}

type Patch = Partial<Record<keyof NavParams, string | number | null>>;

/** Navigator state that lives in the URL so links reopen exactly what was shared. */
export function useNavigatorParams() {
  const [params, setParams] = useSearchParams();

  const state = useMemo<NavParams>(() => {
    const v = params.get('view') as View | null;
    const track = params.get('track') as TrackId | null;
    const tour = params.get('tour') as TourId | null;
    const skill = params.get('skill');
    const module = params.get('module');
    const step = Number.parseInt(params.get('step') || '', 10);
    return {
      view: v && VIEWS.includes(v) ? v : 'map',
      track: track && TRACK_MAP[track] ? track : null,
      tour: tour && TOURS[tour] ? tour : null,
      step: Number.isFinite(step) && step > 0 ? step - 1 : 0,
      skill: skill && SKILL_MAP[skill] ? skill : null,
      module: module && MODULE_MAP[module] ? module : null,
      filter: params.get('filter'),
    };
  }, [params]);

  /** Merge a patch into the URL. `null` removes a key. Steps are 1-based in the URL. */
  const update = useCallback(
    (patch: Patch, opts?: { replace?: boolean }) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === undefined || v === '') next.delete(k);
            else next.set(k, k === 'step' ? String(Number(v) + 1) : String(v));
          }
          if (next.get('view') === 'map') next.delete('view');
          return next;
        },
        { replace: opts?.replace }
      );
    },
    [setParams]
  );

  return { ...state, update };
}
