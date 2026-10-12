import { describe, expect, it } from 'vitest';
import type { AppRecord, Blueprint } from '@shared/blueprint/types.ts';
import { dashboardMetrics } from './dashboard';

const bp = { entities: [
  { key: 'lead', label: 'Lead', labelPlural: 'Leads', titleField: 'nombre', fields: [] },
  { key: 'visita', label: 'Visita', labelPlural: 'Visitas', titleField: 'nombre', fields: [] },
  { key: 'operacion', label: 'Operación', labelPlural: 'Operaciones', titleField: 'nombre', fields: [] },
], views: [] } as unknown as Blueprint;
const record = (id: string, entity: string, date: string, data = {}, is_sample = false): AppRecord =>
  ({ id, entity, created_at: date, data, is_sample } as AppRecord);
describe('operations dashboard metrics', () => {
  const now = new Date(2026, 9, 12, 12);
  it('counts only real app records in the selected time window', () => {
    const records = [
      record('1', 'lead', '2026-10-12T09:00:00', { agente: 'Ana' }),
      record('2', 'lead', '2026-09-20T09:00:00', { agente: 'Ana' }),
      record('3', 'visita', '2026-10-10T09:00:00', { responsable: 'Ana' }),
      record('4', 'operacion', '2026-10-10T09:00:00', { agente: 'Luis' }),
      record('5', 'lead', '2026-10-11T09:00:00', {}, true),
      record('6', 'lead', '2026-05-11T09:00:00'),
    ];
    const week = dashboardMetrics(bp, records, 7, now);
    expect(week.metrics.slice(0, 3).map((m) => m.value)).toEqual([1, 1, 1]);
    expect(week.sampleCount).toBe(1);
    expect(week.series.reduce((sum, p) => sum + p.leads, 0)).toBe(1);
    expect(week.agents.find((a) => a.name === 'Ana')).toMatchObject({ leads: 1, visits: 1 });
    expect(dashboardMetrics(bp, records, 30, now).metrics[0].value).toBe(2);
  });
  it('marks unavailable modules and does not invent agent activity', () => {
    const empty = dashboardMetrics({ ...bp, entities: [] }, [], 30, now);
    expect(empty.metrics[0].available).toBe(false);
    expect(empty.agents).toEqual([]);
    expect(empty.series).toHaveLength(30);
  });
  it('ignores records without created_at for period totals', () => {
    const records = [{ id: 'x', entity: 'lead', data: {} }] as AppRecord[];
    const data = dashboardMetrics(bp, records, 7, now);
    expect(data.metrics[0].value).toBe(0);
    expect(data.undatedCount).toBe(1);
  });
});
