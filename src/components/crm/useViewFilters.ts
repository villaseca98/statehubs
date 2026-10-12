import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppRecord, Blueprint, Entity, View } from '@shared/blueprint/types.ts';
import { EMPTY_STATE, applyFilters, loadSaved, presetsFor, sameState, storeSaved } from '@/lib/crm/filters';
import type { FilterState, Preset, SavedView } from '@/lib/crm/filters';

// The filters of the section on screen: one state per section (so moving
// around keeps what you had), presets from its status, and the views the
// person saved in this browser. Any view with an entity can use it.

export const ALL_TAB = 'todo';

export interface ViewFilters {
  entity?: Entity;
  state: FilterState;
  setState: (s: FilterState) => void;
  /** Records of the view's entity that pass, in order. */
  filtered: AppRecord[];
  /** Every record, with the view's entity replaced by `filtered` (relations stay whole). */
  records: AppRecord[];
  total: number;
  presets: Preset[];
  saved: SavedView[];
  activeTab: string | null;
  selectTab: (key: string) => void;
  saveAs: (name: string) => void;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
}

export function useViewFilters(blueprint: Blueprint, view: View | null, records: AppRecord[], opts: { appId?: string; titleOf?: (id: string) => string | undefined; now?: Date } = {}): ViewFilters {
  const { titleOf, now } = opts;
  const appId = opts.appId || blueprint.name;
  const entity = view?.entity ? blueprint.entities.find((e) => e.key === view.entity) : undefined;
  const viewKey = view?.key ?? '';
  const [states, setStates] = useState<Record<string, FilterState>>({});
  const [saved, setSaved] = useState<SavedView[]>([]);

  useEffect(() => { setSaved(viewKey ? loadSaved(appId, viewKey) : []); }, [appId, viewKey]);

  const state = states[viewKey] ?? EMPTY_STATE;
  const setState = useCallback((s: FilterState) => setStates((m) => ({ ...m, [viewKey]: s })), [viewKey]);
  const presets = useMemo(() => (view && entity ? presetsFor(blueprint, view) : []), [blueprint, view, entity]);

  const filtered = useMemo(() => (entity ? applyFilters(entity, records, state, { titleOf, now }) : []), [entity, records, state, titleOf, now]);
  const all = useMemo(() => (entity ? [...records.filter((r) => r.entity !== entity.key), ...filtered] : records), [entity, records, filtered]);
  const total = useMemo(() => (entity ? records.filter((r) => r.entity === entity.key).length : records.length), [entity, records]);

  const activeTab = sameState(state, EMPTY_STATE) ? ALL_TAB
    : presets.find((p) => sameState(state, p.state))?.key ?? saved.find((s) => sameState(state, s.state))?.id ?? null;

  const persist = (list: SavedView[]) => { setSaved(list); storeSaved(appId, viewKey, list); };
  const selectTab = (key: string) => {
    const next = key === ALL_TAB ? EMPTY_STATE : presets.find((p) => p.key === key)?.state ?? saved.find((s) => s.id === key)?.state;
    if (next) setState({ ...next, query: state.query });
  };
  const saveAs = (name: string) => {
    const clean = name.trim().slice(0, 40);
    if (!clean) return;
    persist([...saved, { id: `v${Date.now().toString(36)}`, name: clean, state: { ...state, query: '' } }]);
  };
  const rename = (id: string, name: string) => { const clean = name.trim().slice(0, 40); if (clean) persist(saved.map((s) => (s.id === id ? { ...s, name: clean } : s))); };
  const remove = (id: string) => persist(saved.filter((s) => s.id !== id));

  return { entity, state, setState, filtered, records: all, total, presets, saved, activeTab, selectTab, saveAs, rename, remove };
}
