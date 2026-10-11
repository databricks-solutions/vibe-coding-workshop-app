import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { libraryApi, type CollectionKind, type LayoutItem, type LibraryCollection, type LibraryPayload, type LibraryUseCase, type UseCaseFlags } from '../../api/library';
import { buildModel, keyOf, ucKey, type LibraryModel } from './model';

export interface Notice {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
  undo?: () => void;
}

type Notify = (n: Omit<Notice, 'id'>) => void;

export interface LibraryActions {
  reload: () => Promise<void>;
  setFlags: (ucs: LibraryUseCase[], flags: Pick<UseCaseFlags, 'is_active' | 'is_certified'>, opts?: { silent?: boolean }) => Promise<void>;
  renameUseCase: (uc: LibraryUseCase, label: string) => Promise<void>;
  updateCollection: (id: string, patch: Partial<Pick<LibraryCollection, 'label' | 'kind' | 'description' | 'icon' | 'color' | 'is_enabled'>>) => Promise<void>;
  createCollection: (body: { label: string; kind: CollectionKind; description?: string | null; icon?: string | null; color?: string | null }) => Promise<string | null>;
  deleteCollection: (id: string) => Promise<void>;
  reorderCollections: (kind: CollectionKind, ids: string[]) => Promise<void>;
  setPlacements: (uc: LibraryUseCase, placements: { collection_id: string; category?: string | null }[]) => Promise<void>;
  setLayout: (collectionId: string, items: LayoutItem[]) => Promise<void>;
  review: (uc: LibraryUseCase, action: 'approve' | 'dismiss') => Promise<void>;
  publish: (uc: LibraryUseCase, template: string) => Promise<number | null>;
  createUseCase: (body: { industry: string; use_case: string; use_case_label: string; prompt_template: string; category?: string | null; category_order?: number | null; alsoIn?: string[] }) => Promise<boolean>;
  deleteUseCase: (uc: LibraryUseCase) => Promise<void>;
}

const describe = (ucs: LibraryUseCase[]) => (ucs.length === 1 ? `“${ucs[0].use_case_label}”` : `${ucs.length} use cases`);

export function useLibrary(notify: Notify) {
  const [payload, setPayload] = useState<LibraryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const payloadRef = useRef<LibraryPayload | null>(null);
  payloadRef.current = payload;

  const reload = useCallback(async () => {
    try {
      const data = await libraryApi.load();
      setPayload(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const model: LibraryModel | null = useMemo(() => (payload ? buildModel(payload) : null), [payload]);

  const patchUseCases = useCallback((keys: Set<string>, patch: (u: LibraryUseCase) => Partial<LibraryUseCase>) => {
    setPayload(p => p && { ...p, use_cases: p.use_cases.map(u => (keys.has(keyOf(u)) ? { ...u, ...patch(u) } : u)) });
  }, []);

  const fail = useCallback((e: unknown, fallback: string) => {
    notify({ tone: 'error', message: (e as Error)?.message || fallback });
    void reload();
  }, [notify, reload]);

  const setFlags: LibraryActions['setFlags'] = useCallback(async (ucs, flags, opts) => {
    if (!ucs.length) return;
    const keys = new Set(ucs.map(keyOf));
    const before = ucs.map(u => ({ uc: u, is_active: u.is_active, is_certified: u.is_certified }));
    patchUseCases(keys, () => flags);
    try {
      if (ucs.length === 1) await libraryApi.updateUseCase(ucs[0].industry, ucs[0].use_case, flags);
      else await libraryApi.bulkUpdate(ucs.map(u => ({ industry: u.industry, use_case: u.use_case })), flags);
      if (opts?.silent) return;
      const what = flags.is_active !== undefined
        ? (flags.is_active ? 'is live for attendees' : 'is hidden from attendees')
        : (flags.is_certified ? 'is certified' : 'is no longer certified');
      const plural = ucs.length > 1 ? what.replace(/^is /, 'are ') : what;
      notify({
        tone: 'success',
        message: `${describe(ucs)} ${plural}`,
        undo: async () => {
          const byKey = Object.fromEntries(before.map(b => [keyOf(b.uc), b]));
          patchUseCases(keys, u => ({ is_active: byKey[keyOf(u)].is_active, is_certified: byKey[keyOf(u)].is_certified }));
          await Promise.all(before.map(b => libraryApi.updateUseCase(b.uc.industry, b.uc.use_case, {
            ...(flags.is_active !== undefined ? { is_active: b.is_active } : {}),
            ...(flags.is_certified !== undefined ? { is_certified: b.is_certified } : {}),
          })));
        },
      });
    } catch (e) {
      fail(e, 'Couldn’t save that change');
    }
  }, [patchUseCases, notify, fail]);

  const renameUseCase: LibraryActions['renameUseCase'] = useCallback(async (uc, label) => {
    const clean = label.trim();
    if (!clean || clean === uc.use_case_label) return;
    patchUseCases(new Set([keyOf(uc)]), () => ({ use_case_label: clean }));
    try {
      await libraryApi.updateUseCase(uc.industry, uc.use_case, { use_case_label: clean });
    } catch (e) {
      fail(e, 'Couldn’t rename the use case');
    }
  }, [patchUseCases, fail]);

  const updateCollection: LibraryActions['updateCollection'] = useCallback(async (id, patch) => {
    const prev = payloadRef.current?.collections.find(c => c.collection_id === id);
    setPayload(p => p && { ...p, collections: p.collections.map(c => (c.collection_id === id ? { ...c, ...patch } : c)) });
    try {
      await libraryApi.updateCollection(id, patch);
      if (patch.is_enabled !== undefined && prev) {
        notify({
          tone: 'success',
          message: patch.is_enabled ? `${prev.label} is visible to attendees` : `${prev.label} is hidden from attendees`,
          undo: async () => {
            setPayload(p => p && { ...p, collections: p.collections.map(c => (c.collection_id === id ? { ...c, is_enabled: prev.is_enabled } : c)) });
            await libraryApi.updateCollection(id, { is_enabled: prev.is_enabled });
          },
        });
      }
      if (patch.label !== undefined) {
        setPayload(p => p && { ...p, use_cases: p.use_cases.map(u => (u.industry === id ? { ...u, industry_label: patch.label! } : u)) });
      }
    } catch (e) {
      fail(e, 'Couldn’t update the collection');
    }
  }, [notify, fail]);

  const createCollection: LibraryActions['createCollection'] = useCallback(async body => {
    try {
      const { collection_id } = await libraryApi.createCollection(body);
      await reload();
      notify({ tone: 'success', message: `Created ${body.label}` });
      return collection_id;
    } catch (e) {
      notify({ tone: 'error', message: (e as Error).message || 'Couldn’t create the collection' });
      return null;
    }
  }, [reload, notify]);

  const deleteCollection: LibraryActions['deleteCollection'] = useCallback(async id => {
    try {
      await libraryApi.deleteCollection(id);
      notify({ tone: 'success', message: 'Collection deleted' });
    } catch (e) {
      notify({ tone: 'error', message: (e as Error).message || 'Couldn’t delete the collection' });
    }
    await reload();
  }, [reload, notify]);

  const reorderCollections: LibraryActions['reorderCollections'] = useCallback(async (_kind, ids) => {
    const order = Object.fromEntries(ids.map((id, i) => [id, i + 1]));
    setPayload(p => p && { ...p, collections: p.collections.map(c => (order[c.collection_id] ? { ...c, display_order: order[c.collection_id] } : c)) });
    try {
      await libraryApi.reorderCollections(ids);
    } catch (e) {
      fail(e, 'Couldn’t save the new order');
    }
  }, [fail]);

  const setPlacements: LibraryActions['setPlacements'] = useCallback(async (uc, placements) => {
    try {
      await libraryApi.setPlacements(uc.industry, uc.use_case, placements);
      await reload();
      notify({ tone: 'success', message: `Updated where “${uc.use_case_label}” appears` });
    } catch (e) {
      fail(e, 'Couldn’t update placements');
    }
  }, [reload, notify, fail]);

  const setLayout: LibraryActions['setLayout'] = useCallback(async (collectionId, items) => {
    const byKey = Object.fromEntries(items.map(i => [ucKey(i.industry, i.use_case), i]));
    setPayload(p => p && {
      ...p,
      use_cases: p.use_cases.map(u => {
        const it = byKey[keyOf(u)];
        return it && u.industry === collectionId ? { ...u, category: it.category, category_order: it.category_order, display_order: it.display_order } : u;
      }),
      members: p.members.map(m => {
        const it = byKey[ucKey(m.home_industry, m.use_case)];
        return it && m.collection_id === collectionId ? { ...m, category: it.category, category_order: it.category_order, display_order: it.display_order } : m;
      }),
    });
    try {
      await libraryApi.setLayout(collectionId, items);
    } catch (e) {
      fail(e, 'Couldn’t save the layout');
    }
  }, [fail]);

  const review: LibraryActions['review'] = useCallback(async (uc, action) => {
    patchUseCases(new Set([keyOf(uc)]), () => (action === 'approve' ? { is_active: true, source: 'ideate_approved' } : { source: 'ideate_dismissed' }));
    try {
      await libraryApi.review(uc.industry, uc.use_case, action);
      notify({ tone: 'success', message: action === 'approve' ? `“${uc.use_case_label}” is approved and live` : `Dismissed “${uc.use_case_label}”` });
    } catch (e) {
      fail(e, 'Couldn’t update the submission');
    }
  }, [patchUseCases, notify, fail]);

  const publish: LibraryActions['publish'] = useCallback(async (uc, template) => {
    try {
      const res = await libraryApi.publishVersion({
        industry: uc.industry, industry_label: uc.industry_label, use_case: uc.use_case,
        use_case_label: uc.use_case_label, prompt_template: template,
      });
      patchUseCases(new Set([keyOf(uc)]), u => ({ prompt_template: template, version: res.version, version_count: u.version_count + 1, updated_at: new Date().toISOString() }));
      notify({ tone: 'success', message: `Published version ${res.version} of “${uc.use_case_label}”` });
      return res.version;
    } catch (e) {
      notify({ tone: 'error', message: (e as Error).message || 'Couldn’t publish' });
      return null;
    }
  }, [patchUseCases, notify]);

  const createUseCase: LibraryActions['createUseCase'] = useCallback(async body => {
    try {
      await libraryApi.createUseCase(body);
      if (body.category) {
        await libraryApi.setLayout(body.industry, [{
          industry: body.industry, use_case: body.use_case, category: body.category,
          category_order: body.category_order ?? null, display_order: 999,
        }]);
      }
      if (body.alsoIn?.length) {
        await libraryApi.setPlacements(body.industry, body.use_case, body.alsoIn.map(id => ({ collection_id: id })));
      }
      await reload();
      notify({ tone: 'success', message: `Created “${body.use_case_label}”` });
      return true;
    } catch (e) {
      notify({ tone: 'error', message: (e as Error).message || 'Couldn’t create the use case' });
      return false;
    }
  }, [reload, notify]);

  const deleteUseCase: LibraryActions['deleteUseCase'] = useCallback(async uc => {
    try {
      await libraryApi.deleteUseCase(uc.industry, uc.use_case);
      notify({ tone: 'success', message: `Deleted “${uc.use_case_label}”` });
    } catch (e) {
      notify({ tone: 'error', message: (e as Error).message || 'Couldn’t delete the use case' });
    }
    await reload();
  }, [reload, notify]);

  const actions: LibraryActions = {
    reload, setFlags, renameUseCase, updateCollection, createCollection, deleteCollection, reorderCollections,
    setPlacements, setLayout, review, publish, createUseCase, deleteUseCase,
  };

  return { model, loading, error, capabilities: payload?.capabilities, actions };
}
