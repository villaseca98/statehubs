import type { AppRecord, Blueprint, Entity, Field, View } from '@shared/blueprint/types.ts';
import { outcomeOf } from '@shared/blueprint/analysis.ts';

// Notion-style filters for any section with records: rules (field → operator
// → value) joined with Y/O, a sort, free text over every field (related
// records by their title) and ready-made presets ("Casos cerrados" is how you
// look back at past cases). Pure functions so cards, timeline and any other
// view can reuse them; the UI lives in components/crm/FilterBar.tsx.

export type FilterOp =
  | 'contains' | 'not_contains' | 'is' | 'empty' | 'not_empty'
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between'
  | 'on' | 'before' | 'after' | 'last_days' | 'this_month' | 'last_month' | 'this_year'
  | 'any_of' | 'none_of'
  | 'true' | 'false';

export interface Filter { field: string; op: FilterOp; value?: unknown }
export interface Sort { field: string; dir: 'asc' | 'desc' }
export interface FilterState { filters: Filter[]; mode: 'and' | 'or'; sort: Sort | null; query: string }
export interface Preset { key: string; label: string; state: FilterState }
export interface SavedView { id: string; name: string; state: FilterState }
export type FieldKind = 'text' | 'number' | 'date' | 'select' | 'relation' | 'boolean';

export const EMPTY_STATE: FilterState = { filters: [], mode: 'and', sort: null, query: '' };

export function kindOf(f: Field): FieldKind {
  switch (f.type) {
    case 'number': case 'money': case 'percent': return 'number';
    case 'date': case 'datetime': return 'date';
    case 'select': return 'select';
    case 'relation': return 'relation';
    case 'boolean': return 'boolean';
    default: return 'text';
  }
}

const OPS: Record<FieldKind, { op: FilterOp; label: string }[]> = {
  text: [
    { op: 'contains', label: 'contiene' }, { op: 'not_contains', label: 'no contiene' }, { op: 'is', label: 'es' },
    { op: 'empty', label: 'está vacío' }, { op: 'not_empty', label: 'no está vacío' },
  ],
  number: [
    { op: 'eq', label: '=' }, { op: 'neq', label: '≠' }, { op: 'gt', label: '>' }, { op: 'gte', label: '≥' },
    { op: 'lt', label: '<' }, { op: 'lte', label: '≤' }, { op: 'between', label: 'entre' },
    { op: 'empty', label: 'está vacío' }, { op: 'not_empty', label: 'no está vacío' },
  ],
  date: [
    { op: 'on', label: 'es' }, { op: 'before', label: 'antes de' }, { op: 'after', label: 'después de' }, { op: 'between', label: 'entre' },
    { op: 'last_days', label: 'en los últimos N días' }, { op: 'this_month', label: 'este mes' }, { op: 'last_month', label: 'el mes pasado' },
    { op: 'this_year', label: 'este año' }, { op: 'empty', label: 'está vacío' }, { op: 'not_empty', label: 'no está vacío' },
  ],
  select: [
    { op: 'any_of', label: 'es cualquiera de' }, { op: 'none_of', label: 'no es ninguno de' },
    { op: 'empty', label: 'está vacío' }, { op: 'not_empty', label: 'no está vacío' },
  ],
  relation: [{ op: 'is', label: 'es' }, { op: 'empty', label: 'está vacío' }, { op: 'not_empty', label: 'no está vacío' }],
  boolean: [{ op: 'true', label: 'sí' }, { op: 'false', label: 'no' }],
};

export const opsFor = (f: Field) => OPS[kindOf(f)];
export const opLabel = (f: Field, op: FilterOp) => opsFor(f).find((o) => o.op === op)?.label ?? op;
// Operators that need no value typed in.
export const NO_VALUE: FilterOp[] = ['empty', 'not_empty', 'this_month', 'last_month', 'this_year', 'true', 'false'];

// A fresh rule for a field, with its most useful operator.
export function newFilter(f: Field): Filter {
  const op = opsFor(f)[0].op;
  return { field: f.key, op, value: op === 'any_of' ? [] : undefined };
}

export const norm = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const isBlank = (v: unknown) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
const day = (v: unknown) => (typeof v === 'string' && v.length >= 10 ? v.slice(0, 10) : '');
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const num = (v: unknown) => (v === '' || v === null || v === undefined ? NaN : Number(v));

export interface MatchContext { now?: Date; titleOf?: (id: string) => string | undefined }

export function matches(field: Field, value: unknown, f: Filter, ctx: MatchContext = {}): boolean {
  if (f.op === 'empty') return isBlank(value);
  if (f.op === 'not_empty') return !isBlank(value);
  const now = ctx.now ?? new Date();
  switch (kindOf(field)) {
    case 'text': {
      const v = norm(value);
      const q = norm(f.value);
      if (f.op === 'contains') return v.includes(q);
      if (f.op === 'not_contains') return !q || !v.includes(q);
      if (f.op === 'is') return v === q;
      return true;
    }
    case 'number': {
      const v = num(value);
      if (f.op === 'between') {
        const [a, b] = Array.isArray(f.value) ? f.value.map(num) : [NaN, NaN];
        if (Number.isNaN(v)) return false;
        return (Number.isNaN(a) || v >= a) && (Number.isNaN(b) || v <= b);
      }
      const x = num(f.value);
      if (Number.isNaN(x)) return true; // rule not finished yet: do not hide anything
      if (Number.isNaN(v)) return f.op === 'neq';
      return f.op === 'eq' ? v === x : f.op === 'neq' ? v !== x : f.op === 'gt' ? v > x : f.op === 'gte' ? v >= x : f.op === 'lt' ? v < x : f.op === 'lte' ? v <= x : true;
    }
    case 'date': {
      const v = day(value);
      const y = now.getFullYear();
      const m = now.getMonth();
      if (f.op === 'this_month') return !!v && v.slice(0, 7) === isoDay(now).slice(0, 7);
      if (f.op === 'last_month') return !!v && v.slice(0, 7) === isoDay(new Date(y, m - 1, 1)).slice(0, 7);
      if (f.op === 'this_year') return !!v && v.slice(0, 4) === String(y);
      if (f.op === 'last_days') {
        const n = Number(f.value);
        if (!Number.isFinite(n) || n <= 0) return true;
        const from = isoDay(new Date(y, m, now.getDate() - n));
        return !!v && v >= from && v <= isoDay(now);
      }
      if (f.op === 'between') {
        const [a, b] = Array.isArray(f.value) ? f.value.map(day) : ['', ''];
        if (!v) return false;
        return (!a || v >= a) && (!b || v <= b);
      }
      const x = day(f.value);
      if (!x) return true;
      if (!v) return false;
      return f.op === 'on' ? v === x : f.op === 'before' ? v < x : f.op === 'after' ? v > x : true;
    }
    case 'select': {
      const list = Array.isArray(f.value) ? f.value.map(String) : [];
      if (!list.length) return true;
      const has = list.includes(String(value ?? ''));
      return f.op === 'any_of' ? has : f.op === 'none_of' ? !has : true;
    }
    case 'relation':
      return !f.value || String(value ?? '') === String(f.value);
    case 'boolean':
      return f.op === 'true' ? !!value : !value;
  }
}

// Everything a person might type to find a record: each field as shown, with
// related records by their title.
export function searchText(entity: Entity, r: AppRecord, titleOf?: (id: string) => string | undefined): string {
  const parts: string[] = [];
  for (const f of entity.fields) {
    const v = r.data[f.key];
    if (isBlank(v)) continue;
    if (f.type === 'relation') parts.push(titleOf?.(String(v)) ?? '');
    else if (f.type === 'select') parts.push(f.options?.find((o) => o.value === v)?.label ?? String(v), String(v));
    else if (f.type === 'boolean') parts.push(v ? f.label : '');
    else if (f.type === 'phone') parts.push(String(v), String(v).replace(/\D/g, ''));
    else parts.push(String(v));
  }
  return norm(parts.join(' \u0001 '));
}

export function matchesQuery(text: string, query: string): boolean {
  const words = norm(query).split(/\s+/).filter(Boolean);
  return words.every((w) => text.includes(w) || (/^[\d+\s]+$/.test(w) && text.includes(w.replace(/\D/g, ''))));
}

function compare(field: Field, a: unknown, b: unknown, titleOf?: (id: string) => string | undefined): number {
  const blankA = isBlank(a);
  const blankB = isBlank(b);
  if (blankA || blankB) return blankA === blankB ? 0 : blankA ? 1 : -1;
  const k = kindOf(field);
  if (k === 'number') return Number(a) - Number(b);
  if (k === 'boolean') return (a ? 1 : 0) - (b ? 1 : 0);
  if (k === 'select') {
    const idx = (v: unknown) => field.options?.findIndex((o) => o.value === v) ?? -1;
    return idx(a) - idx(b);
  }
  const show = (v: unknown) => (k === 'relation' ? titleOf?.(String(v)) ?? '' : String(v));
  return show(a).localeCompare(show(b), 'es', { numeric: true });
}

// The records of one entity that pass the rules, the search and in order.
export function applyFilters(entity: Entity, records: AppRecord[], state: FilterState, ctx: MatchContext = {}): AppRecord[] {
  const fieldOf = (k: string) => entity.fields.find((f) => f.key === k);
  const rules = state.filters.filter((f) => fieldOf(f.field));
  let list = records.filter((r) => r.entity === entity.key);
  if (rules.length) {
    const test = (r: AppRecord, f: Filter) => matches(fieldOf(f.field)!, r.data[f.field], f, ctx);
    list = list.filter((r) => (state.mode === 'or' ? rules.some((f) => test(r, f)) : rules.every((f) => test(r, f))));
  }
  if (state.query.trim()) list = list.filter((r) => matchesQuery(searchText(entity, r, ctx.titleOf), state.query));
  const sf = state.sort ? fieldOf(state.sort.field) : undefined;
  if (state.sort && sf) {
    const dir = state.sort.dir === 'desc' ? -1 : 1;
    const key = sf.key;
    list = [...list].sort((a, b) => {
      const blank = isBlank(a.data[key]) || isBlank(b.data[key]);
      const c = compare(sf, a.data[key], b.data[key], ctx.titleOf);
      return blank ? c : c * dir; // empty values always last
    });
  }
  return list;
}

// The select that says where a record is: the one the view groups by, else
// the first select with a clear end (won or lost).
export function statusField(entity: Entity, view?: View): Field | undefined {
  const g = entity.fields.find((f) => f.key === view?.groupBy && f.type === 'select');
  return g ?? entity.fields.find((f) => f.type === 'select' && f.options?.some((o) => outcomeOf(o) !== 'open'));
}

export function dateFieldOf(entity: Entity, view?: View): Field | undefined {
  const own = entity.fields.find((f) => f.key === view?.dateField || f.key === view?.startField);
  return own ?? entity.fields.find((f) => f.type === 'date' || f.type === 'datetime');
}

const preset = (key: string, label: string, filters: Filter[]): Preset => ({ key, label, state: { ...EMPTY_STATE, filters } });

// Ready-made tabs for a view, read from its status select.
export function presetsFor(bp: Blueprint, view: View): Preset[] {
  const entity = bp.entities.find((e) => e.key === view.entity);
  if (!entity) return [];
  const out: Preset[] = [];
  const stage = statusField(entity, view);
  if (stage) {
    const opts = stage.options ?? [];
    const won = opts.filter((o) => outcomeOf(o) === 'won').map((o) => o.value);
    const lost = opts.filter((o) => outcomeOf(o) === 'lost').map((o) => o.value);
    if (won.length || lost.length) {
      out.push(preset('abiertos', 'Abiertos', [{ field: stage.key, op: 'none_of', value: [...won, ...lost] }]));
      out.push(preset('cerrados', 'Casos cerrados', [{ field: stage.key, op: 'any_of', value: [...won, ...lost] }]));
      if (won.length) out.push(preset('ganados', 'Ganados', [{ field: stage.key, op: 'any_of', value: won }]));
      if (lost.length) out.push(preset('perdidos', 'Perdidos', [{ field: stage.key, op: 'any_of', value: lost }]));
    }
  }
  const date = dateFieldOf(entity, view);
  if (date) out.push(preset('mes', 'Este mes', [{ field: date.key, op: 'this_month' }]));
  return out;
}

// Two states are the same tab when rules, mode and sort match (the search box is apart).
export function sameState(a: FilterState, b: FilterState): boolean {
  return JSON.stringify([a.filters, a.filters.length > 1 ? a.mode : 'and', a.sort]) === JSON.stringify([b.filters, b.filters.length > 1 ? b.mode : 'and', b.sort]);
}

// Short text for a rule's chip: «Etapa: Cerrada, Perdida».
export function describeFilter(field: Field, f: Filter, titleOf?: (id: string) => string | undefined): string {
  const op = opLabel(field, f.op);
  if (NO_VALUE.includes(f.op)) return `${field.label} ${kindOf(field) === 'boolean' ? `: ${op}` : op}`;
  const k = kindOf(field);
  if (k === 'select') {
    const labels = (Array.isArray(f.value) ? f.value : []).map((v) => field.options?.find((o) => o.value === v)?.label ?? String(v));
    return `${field.label} ${f.op === 'none_of' ? 'no es' : 'es'} ${labels.join(', ') || '…'}`;
  }
  if (k === 'relation') return `${field.label} es ${f.value ? titleOf?.(String(f.value)) ?? '…' : '…'}`;
  const show = (v: unknown) => {
    if (isBlank(v)) return '…';
    if (k === 'date') { const d = new Date(`${day(v)}T00:00:00`); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }); }
    return String(v);
  };
  if (f.op === 'between') { const [a, b] = Array.isArray(f.value) ? f.value : []; return `${field.label} entre ${show(a)} y ${show(b)}`; }
  if (f.op === 'last_days') return `${field.label} en los últimos ${show(f.value)} días`;
  return `${field.label} ${op} ${k === 'text' ? `«${show(f.value)}»` : show(f.value)}`;
}

// Saved views live in this browser only (per app and section).
const savedKey = (appId: string, viewKey: string) => `statehubs.vistas.${appId}.${viewKey}`;

export function loadSaved(appId: string, viewKey: string): SavedView[] {
  try {
    const raw = window.localStorage.getItem(savedKey(appId, viewKey));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((s) => s && typeof s.id === 'string' && typeof s.name === 'string' && s.state && Array.isArray(s.state.filters)) : [];
  } catch {
    return [];
  }
}

export function storeSaved(appId: string, viewKey: string, list: SavedView[]): void {
  try {
    window.localStorage.setItem(savedKey(appId, viewKey), JSON.stringify(list));
  } catch {
    // private window or storage blocked: saved views only last this visit
  }
}

// Global search (Cmd/Ctrl+K): records of every entity by title and contact
// fields, and the sections by name.
export interface SearchHit { kind: 'record' | 'section'; id: string; title: string; subtitle: string; score: number }

const SEARCHABLE = new Set(['text', 'email', 'phone', 'nif', 'url']);

export function globalSearch(bp: Blueprint, records: AppRecord[], sections: { key: string; label: string }[], query: string, limit = 30): SearchHit[] {
  const q = norm(query);
  if (!q) return [];
  const hits: SearchHit[] = [];
  for (const s of sections) {
    const t = norm(s.label);
    if (matchesQuery(t, q)) hits.push({ kind: 'section', id: s.key, title: s.label, subtitle: 'Sección', score: t.startsWith(q) ? 0 : 1 });
  }
  const byKey = new Map(bp.entities.map((e) => [e.key, e]));
  for (const r of records) {
    const e = byKey.get(r.entity);
    if (!e) continue;
    const title = String(r.data[e.titleField] ?? '') || `${e.label} sin nombre`;
    const fields = e.fields.filter((f) => SEARCHABLE.has(f.type) && f.key !== e.titleField);
    const extra = fields.map((f) => r.data[f.key]).filter((v) => !isBlank(v)).map(String);
    const text = norm([title, ...extra, ...extra.map((x) => x.replace(/\D/g, '')).filter((x) => x.length > 3)].join(' \u0001 '));
    if (!matchesQuery(text, q)) continue;
    const nt = norm(title);
    const match = fields.find((f) => !isBlank(r.data[f.key]) && matchesQuery(norm(r.data[f.key]) + ' ' + String(r.data[f.key]).replace(/\D/g, ''), q));
    hits.push({
      kind: 'record', id: r.id, title,
      subtitle: [e.label, !matchesQuery(nt, q) && match ? String(r.data[match.key]) : ''].filter(Boolean).join(' · '),
      score: nt.startsWith(q) ? 2 : matchesQuery(nt, q) ? 3 : 4,
    });
  }
  return hits.sort((a, b) => a.score - b.score || a.title.localeCompare(b.title, 'es')).slice(0, limit);
}
