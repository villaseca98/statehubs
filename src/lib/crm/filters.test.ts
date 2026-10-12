import { beforeEach, describe, expect, it } from 'vitest';
import type { AppRecord, Blueprint, Entity, View } from '@shared/blueprint/types.ts';
import { EMPTY_STATE, applyFilters, describeFilter, globalSearch, loadSaved, matches, opsFor, presetsFor, sameState, storeSaved } from './filters';
import type { FilterState } from './filters';

const contacto: Entity = {
  key: 'contacto', label: 'Contacto', labelPlural: 'Contactos', titleField: 'nombre',
  fields: [
    { key: 'nombre', label: 'Nombre', type: 'text' },
    { key: 'telefono', label: 'Teléfono', type: 'phone' },
    { key: 'email', label: 'Email', type: 'email' },
  ],
};
const operacion: Entity = {
  key: 'operacion', label: 'Operación', labelPlural: 'Operaciones', titleField: 'titulo',
  fields: [
    { key: 'titulo', label: 'Operación', type: 'text' },
    { key: 'etapa', label: 'Etapa', type: 'select', options: [
      { value: 'visita', label: 'Visita' }, { value: 'oferta', label: 'Oferta' }, { value: 'cerrada', label: 'Cerrada' }, { value: 'perdida', label: 'Perdida' },
    ] },
    { key: 'importe', label: 'Importe', type: 'money' },
    { key: 'cierre', label: 'Cierre previsto', type: 'date' },
    { key: 'contacto', label: 'Contacto', type: 'relation', relation: 'contacto' },
    { key: 'exclusiva', label: 'En exclusiva', type: 'boolean' },
  ],
};
const view: View = { key: 'operaciones', label: 'Operaciones', type: 'kanban', entity: 'operacion', groupBy: 'etapa' };
const bp: Blueprint = { version: 1, name: 'Test', entities: [contacto, operacion], views: [view] };

const now = new Date(2026, 9, 12); // 12 oct 2026
const records: AppRecord[] = [
  { id: 'c1', entity: 'contacto', data: { nombre: 'Lucía Martínez', telefono: '+34 611 222 333', email: 'lucia@ejemplo.es' } },
  { id: 'c2', entity: 'contacto', data: { nombre: 'Pedro Ruiz' } },
  { id: 'o1', entity: 'operacion', data: { titulo: 'Piso en Ruzafa', etapa: 'visita', importe: 180000, cierre: '2026-10-20', contacto: 'c1' } },
  { id: 'o2', entity: 'operacion', data: { titulo: 'Ático Malvarrosa', etapa: 'cerrada', importe: 320000, cierre: '2026-09-15', contacto: 'c2', exclusiva: true } },
  { id: 'o3', entity: 'operacion', data: { titulo: 'Local Benimaclet', etapa: 'perdida', importe: 95000, cierre: '2026-03-01' } },
  { id: 'o4', entity: 'operacion', data: { titulo: 'Chalet Godella', etapa: 'oferta', importe: 450000 } },
];
const titleOf = (id: string) => records.find((r) => r.id === id)?.data.nombre as string | undefined;
const ids = (s: Partial<FilterState>) => applyFilters(operacion, records, { ...EMPTY_STATE, ...s }, { now, titleOf }).map((r) => r.id);
const field = (k: string) => operacion.fields.find((f) => f.key === k)!;

describe('filters', () => {
  it('offers operators by field type', () => {
    expect(opsFor(field('titulo')).map((o) => o.label)).toEqual(['contiene', 'no contiene', 'es', 'está vacío', 'no está vacío']);
    expect(opsFor(field('importe')).map((o) => o.op)).toContain('between');
    expect(opsFor(field('cierre')).map((o) => o.op)).toEqual(expect.arrayContaining(['before', 'after', 'last_days', 'this_month', 'last_month', 'this_year']));
    expect(opsFor(field('etapa')).map((o) => o.op)).toEqual(['any_of', 'none_of', 'empty', 'not_empty']);
    expect(opsFor(field('exclusiva')).map((o) => o.label)).toEqual(['sí', 'no']);
  });

  it('filters text ignoring case and accents', () => {
    expect(ids({ filters: [{ field: 'titulo', op: 'contains', value: 'ATICO' }] })).toEqual(['o2']);
    expect(ids({ filters: [{ field: 'titulo', op: 'not_contains', value: 'piso' }] })).toEqual(['o2', 'o3', 'o4']);
    expect(ids({ filters: [{ field: 'titulo', op: 'is', value: 'local benimaclet' }] })).toEqual(['o3']);
  });

  it('filters numbers, including between and unfinished rules', () => {
    expect(ids({ filters: [{ field: 'importe', op: 'gt', value: '300000' }] })).toEqual(['o2', 'o4']);
    expect(ids({ filters: [{ field: 'importe', op: 'lte', value: 180000 }] })).toEqual(['o1', 'o3']);
    expect(ids({ filters: [{ field: 'importe', op: 'between', value: ['100000', '350000'] }] })).toEqual(['o1', 'o2']);
    expect(ids({ filters: [{ field: 'importe', op: 'gt', value: '' }] })).toHaveLength(4);
  });

  it('filters dates by day, range and relative periods', () => {
    expect(ids({ filters: [{ field: 'cierre', op: 'this_month' }] })).toEqual(['o1']);
    expect(ids({ filters: [{ field: 'cierre', op: 'last_month' }] })).toEqual(['o2']);
    expect(ids({ filters: [{ field: 'cierre', op: 'this_year' }] })).toEqual(['o1', 'o2', 'o3']);
    expect(ids({ filters: [{ field: 'cierre', op: 'before', value: '2026-10-01' }] })).toEqual(['o2', 'o3']);
    expect(ids({ filters: [{ field: 'cierre', op: 'last_days', value: 30 }] })).toEqual(['o2']);
    expect(ids({ filters: [{ field: 'cierre', op: 'between', value: ['2026-01-01', '2026-09-30'] }] })).toEqual(['o2', 'o3']);
    expect(ids({ filters: [{ field: 'cierre', op: 'empty' }] })).toEqual(['o4']);
  });

  it('filters selects, relations and booleans', () => {
    expect(ids({ filters: [{ field: 'etapa', op: 'any_of', value: ['cerrada', 'perdida'] }] })).toEqual(['o2', 'o3']);
    expect(ids({ filters: [{ field: 'etapa', op: 'none_of', value: ['cerrada', 'perdida'] }] })).toEqual(['o1', 'o4']);
    expect(ids({ filters: [{ field: 'contacto', op: 'is', value: 'c1' }] })).toEqual(['o1']);
    expect(ids({ filters: [{ field: 'contacto', op: 'empty' }] })).toEqual(['o3', 'o4']);
    expect(ids({ filters: [{ field: 'exclusiva', op: 'true' }] })).toEqual(['o2']);
    expect(ids({ filters: [{ field: 'exclusiva', op: 'false' }] })).toEqual(['o1', 'o3', 'o4']);
  });

  it('joins rules with Y or O', () => {
    const filters = [{ field: 'etapa', op: 'any_of' as const, value: ['cerrada'] }, { field: 'importe', op: 'lt' as const, value: 100000 }];
    expect(ids({ filters, mode: 'and' })).toEqual([]);
    expect(ids({ filters, mode: 'or' })).toEqual(['o2', 'o3']);
  });

  it('searches every field, related records by title, and phones without spaces', () => {
    expect(ids({ query: 'lucia' })).toEqual(['o1']);
    expect(ids({ query: 'malvarrosa pedro' })).toEqual(['o2']);
    expect(ids({ query: 'perdida' })).toEqual(['o3']);
    const contacts = (q: string) => applyFilters(contacto, records, { ...EMPTY_STATE, query: q }).map((r) => r.id);
    expect(contacts('611222333')).toEqual(['c1']);
    expect(contacts('611 222')).toEqual(['c1']);
  });

  it('sorts by any field with empty values last', () => {
    expect(ids({ sort: { field: 'importe', dir: 'desc' } })).toEqual(['o4', 'o2', 'o1', 'o3']);
    expect(ids({ sort: { field: 'cierre', dir: 'asc' } })).toEqual(['o3', 'o2', 'o1', 'o4']);
    expect(ids({ sort: { field: 'cierre', dir: 'desc' } })).toEqual(['o1', 'o2', 'o3', 'o4']);
    expect(ids({ sort: { field: 'etapa', dir: 'asc' } })).toEqual(['o1', 'o4', 'o2', 'o3']);
  });

  it('builds presets from the status select: open, closed cases, won, lost and this month', () => {
    const presets = presetsFor(bp, view);
    expect(presets.map((p) => p.label)).toEqual(['Abiertos', 'Casos cerrados', 'Ganados', 'Perdidos', 'Este mes']);
    const run = (key: string) => applyFilters(operacion, records, presets.find((p) => p.key === key)!.state, { now }).map((r) => r.id);
    expect(run('abiertos')).toEqual(['o1', 'o4']);
    expect(run('cerrados')).toEqual(['o2', 'o3']);
    expect(run('ganados')).toEqual(['o2']);
    expect(run('perdidos')).toEqual(['o3']);
    expect(run('mes')).toEqual(['o1']);
    expect(presetsFor(bp, { key: 'c', label: 'C', type: 'table', entity: 'contacto' })).toEqual([]);
  });

  it('compares states ignoring the search box and describes rules', () => {
    const a: FilterState = { ...EMPTY_STATE, filters: [{ field: 'etapa', op: 'any_of', value: ['cerrada'] }] };
    expect(sameState(a, { ...a, query: 'x' })).toBe(true);
    expect(sameState(a, EMPTY_STATE)).toBe(false);
    expect(describeFilter(field('etapa'), a.filters[0])).toBe('Etapa es Cerrada');
    expect(describeFilter(field('importe'), { field: 'importe', op: 'between', value: [1, 2] })).toBe('Importe entre 1 y 2');
    expect(describeFilter(field('cierre'), { field: 'cierre', op: 'this_month' })).toBe('Cierre previsto este mes');
    expect(matches(field('titulo'), undefined, { field: 'titulo', op: 'empty' })).toBe(true);
  });

  describe('saved views', () => {
    beforeEach(() => window.localStorage.clear());
    it('keeps them per app and section, and survives bad data', () => {
      storeSaved('app1', 'ops', [{ id: 'v1', name: 'Grandes', state: { ...EMPTY_STATE, filters: [{ field: 'importe', op: 'gt', value: 300000 }] } }]);
      expect(loadSaved('app1', 'ops').map((s) => s.name)).toEqual(['Grandes']);
      expect(loadSaved('app2', 'ops')).toEqual([]);
      window.localStorage.setItem('statehubs.vistas.app1.x', '{nope');
      expect(loadSaved('app1', 'x')).toEqual([]);
    });
  });

  it('searches every entity and the sections at once', () => {
    const sections = [{ key: 'hoy', label: 'Hoy' }, { key: 'operaciones', label: 'Operaciones' }];
    const hits = globalSearch(bp, records, sections, 'ope');
    expect(hits[0]).toMatchObject({ kind: 'section', id: 'operaciones' });
    expect(globalSearch(bp, records, sections, '611222333').map((h) => h.id)).toEqual(['c1']);
    expect(globalSearch(bp, records, sections, 'lucia@')[0]).toMatchObject({ id: 'c1', subtitle: 'Contacto · lucia@ejemplo.es' });
    expect(globalSearch(bp, records, sections, 'godella').map((h) => h.title)).toEqual(['Chalet Godella']);
    expect(globalSearch(bp, records, sections, '   ')).toEqual([]);
  });
});
