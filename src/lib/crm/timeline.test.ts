import { describe, expect, it } from 'vitest';
import type { AppRecord } from '@shared/blueprint/types.ts';
import { assignLanes, barGeometry, findConflicts, isWeekend, nightsIn, periodFor, periodLabel, rowStats, shiftAnchor, toStays, weekday } from './timeline';

const r = (id: string, data: Record<string, unknown>): AppRecord => ({ id, entity: 'reserva', data: { alojamiento: 'a', estado: 'confirmada', ...data } });
const F = { row: 'alojamiento', start: 'entrada', end: 'salida', status: 'estado' };

describe('timeline', () => {
  it('builds day, week and month periods and moves between them', () => {
    expect(weekday('2026-10-12')).toBe(0); // lunes
    expect(isWeekend('2026-10-17')).toBe(true);
    expect(periodFor('dia', '2026-10-14').days).toEqual(['2026-10-14']);
    const w = periodFor('semana', '2026-10-14');
    expect([w.start, w.end, w.days.length]).toEqual(['2026-10-12', '2026-10-19', 7]);
    const m = periodFor('mes', '2026-02-10');
    expect([m.start, m.end, m.days.length]).toEqual(['2026-02-01', '2026-03-01', 28]);
    expect(periodFor('mes', '2026-12-31').end).toBe('2027-01-01');
    expect(shiftAnchor('mes', '2026-12-15', 1)).toBe('2027-01-01');
    expect(shiftAnchor('mes', '2026-01-15', -1)).toBe('2025-12-01');
    expect(shiftAnchor('semana', '2026-10-14', -1)).toBe('2026-10-07');
    // Across the summer-time change the days stay whole.
    expect(periodFor('mes', '2026-03-05').days[28]).toBe('2026-03-29');
    expect(periodLabel('mes', m)).toBe('February 2026');
    expect(periodLabel('semana', w)).toMatch(/Oct 12.*Oct 18.*2026/);
  });

  it('draws a stay from the middle of check-in to the middle of check-out, clipped to the period', () => {
    const p = periodFor('semana', '2026-10-12');
    expect(barGeometry({ start: '2026-10-13', end: '2026-10-15' }, p)).toEqual({ left: 1.5, width: 2, clippedStart: false, clippedEnd: false });
    expect(barGeometry({ start: '2026-10-08', end: '2026-10-13' }, p)).toEqual({ left: 0, width: 1.5, clippedStart: true, clippedEnd: false });
    expect(barGeometry({ start: '2026-10-18', end: '2026-10-25' }, p)).toMatchObject({ left: 6.5, width: 0.5, clippedEnd: true });
    // Leaving on the first day: the morning half shows the departure.
    expect(barGeometry({ start: '2026-10-01', end: '2026-10-12' }, p)).toMatchObject({ left: 0, width: 0.5 });
    expect(barGeometry({ start: '2026-10-01', end: '2026-10-11' }, p)).toBeNull();
    expect(nightsIn({ start: '2026-10-10', end: '2026-10-14' }, p.start, p.end)).toBe(2);
  });

  it('flags overlapping stays of the same property, not back-to-back ones or cancelled ones', () => {
    const stays = toStays([
      r('a1', { entrada: '2026-10-12', salida: '2026-10-15' }),
      r('a2', { entrada: '2026-10-15', salida: '2026-10-18' }),        // same day as a1 leaves: fine
      r('a3', { entrada: '2026-10-17', salida: '2026-10-20' }),        // overlaps a2
      r('a4', { entrada: '2026-10-12', salida: '2026-10-14', estado: 'cancelada' }),
      r('b1', { alojamiento: 'b', entrada: '2026-10-12', salida: '2026-10-20' }),
      r('x', { entrada: 'mañana' }),                                    // no date: skipped
    ], 'reserva', F);
    expect(stays).toHaveLength(5);
    expect([...findConflicts(stays)].sort()).toEqual(['a2', 'a3']);
    const { lane, lanes } = assignLanes(stays.filter((s) => s.row === 'a' && !s.cancelled));
    expect(lanes).toBe(2);
    expect(lane.get('a1')).toBe(0);
    expect(lane.get('a2')).toBe(0);
    expect(lane.get('a3')).toBe(1);
  });

  it('works out occupancy and net for the period, prorating stays across the edge', () => {
    const p = periodFor('semana', '2026-10-12');
    const stays = toStays([
      r('1', { entrada: '2026-10-10', salida: '2026-10-14', importe: 400, comision: 60, gastos: 40 }), // 2 of 4 nights inside → 150
      r('2', { entrada: '2026-10-15', salida: '2026-10-17', importe: 300, comision: 0, gastos: 50 }),  // 2 nights → 250
      r('3', { entrada: '2026-10-17', salida: '2026-10-19', estado: 'bloqueo' }),
      r('4', { entrada: '2026-10-12', salida: '2026-10-19', estado: 'cancelada', importe: 999 }),
    ], 'reserva', F);
    expect(rowStats(stays, p)).toEqual({ nights: 4, occupancy: 4 / 7, net: 400 });
  });
});
