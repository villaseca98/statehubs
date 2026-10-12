import { describe, expect, it } from 'vitest';
import { composeApp, composePack } from '@shared/blueprint/modules.ts';
import type { AppRecord } from '@shared/blueprint/types.ts';
import { computeOps, findOverlaps, monthIncome, netOf, occupancy } from './ops';
import { dayOf } from './today';

const now = new Date('2026-10-12T09:00:00');
const at = (days: number, time?: string) => { const d = new Date(now); d.setDate(d.getDate() + days); return time ? `${dayOf(d)}T${time}` : dayOf(d); };
const rec = (id: string, entity: string, data: AppRecord['data']): AppRecord => ({ id, entity, data });
const res = (id: string, flat: string, from: number, to: number, extra: AppRecord['data'] = {}) =>
  rec(id, 'reserva', { huesped: id, alojamiento: flat, entrada: at(from), salida: at(to), estado: 'confirmada', ...extra });

describe('Centro de operaciones: cálculos', () => {
  it('finds overlapping bookings in the same flat; cancelled ones out, blocks in, touching days are fine', () => {
    const rs = [
      res('a', 'f1', 0, 3),
      res('b', 'f1', 2, 5),               // overlaps a
      res('c', 'f1', 5, 7),               // starts the day b leaves: fine
      res('d', 'f1', 6, 8, { estado: 'cancelada' }),
      res('e', 'f2', 0, 3),
      res('f', 'f2', 1, 2, { estado: 'bloqueo' }), // a block overlaps e
      res('g', 'f3', 0, 3),
    ];
    const pairs = findOverlaps(rs).map(([x, y]) => `${x.id}-${y.id}`).sort();
    expect(pairs).toEqual(['a-b', 'e-f']);
    // Past overlaps don't matter any more.
    expect(findOverlaps([res('x', 'f1', -9, -5), res('y', 'f1', -7, -4)], at(0))).toEqual([]);
  });

  it('net income: amount minus channel fee minus costs, only bookings arriving this month and not cancelled', () => {
    expect(netOf(res('a', 'f1', 0, 2, { importe: 500, comision: 75, gastos: 45 }))).toBe(380);
    expect(netOf(res('b', 'f1', 0, 2, { importe: 300 }))).toBe(300);
    const rs = [
      res('a', 'f1', 0, 2, { importe: 500, comision: 75, gastos: 45 }),
      res('b', 'f2', 3, 4, { importe: 200, comision: 0, gastos: 20 }),
      res('c', 'f2', 5, 6, { importe: 900, estado: 'cancelada' }),
      rec('d', 'reserva', { alojamiento: 'f1', entrada: '2026-09-28', salida: '2026-10-02', estado: 'finalizada', importe: 400 }),
    ];
    expect(monthIncome(rs, '2026-10')).toEqual({ month: '2026-10', gross: 700, net: 560, bookings: 2 });
  });

  it('occupancy counts tourist flats with guests tonight (not the ones leaving today, not blocks)', () => {
    const flats = ['f1', 'f2', 'f3', 'f4'].map((id) => rec(id, 'inmueble', { direccion: id, operacion: 'turistico' }));
    const rs = [
      res('a', 'f1', -2, 0),                       // leaves today
      res('b', 'f1', 0, 3),                        // arrives today
      res('c', 'f2', -1, 2),
      res('d', 'f3', -1, 2, { estado: 'bloqueo' }),
      res('e', 'f4', -1, 2, { estado: 'cancelada' }),
      res('z', 'other', -1, 2),                    // not a tourist flat
    ];
    expect(occupancy(flats, rs, at(0))).toEqual({ busy: 2, total: 4 });
  });

  it('puts together today, the alerts, the funnel and the week from the records', () => {
    const bp = composePack('ambos', 'Agencia');
    const records = [
      rec('f1', 'inmueble', { direccion: 'Loft Carmen', operacion: 'turistico', estado: 'disponible' }),
      rec('f2', 'inmueble', { direccion: 'Ático Ruzafa', operacion: 'turistico', estado: 'disponible' }),
      rec('v1', 'inmueble', { direccion: 'C/ Sueca 41', operacion: 'venta', estado: 'disponible', exclusiva: true, precio: 215000 }),
      rec('v2', 'inmueble', { direccion: 'Vendido', operacion: 'venta', estado: 'vendido' }),
      res('r1', 'f1', -2, 0, { importe: 300, comision: 45, gastos: 35, pago: 'cobrado' }),
      res('r2', 'f1', 0, 3, { importe: 400, comision: 60, gastos: 35, pago: 'pendiente', llegada: '18:30' }),
      res('r3', 'f1', 2, 5, { importe: 300, pago: 'pendiente' }),
      rec('s1', 'servicio', { titulo: 'Limpieza salida r1', tipo: 'limpieza', alojamiento: 'f1', reserva: 'r1', fecha: at(0, '11:00'), estado: 'asignada' }),
      rec('i1', 'incidencia', { asunto: 'Sin agua caliente', alojamiento: 'f2', prioridad: 'alta', estado: 'abierta' }),
      rec('i2', 'incidencia', { asunto: 'Bombilla', alojamiento: 'f2', prioridad: 'alta', estado: 'resuelta' }),
      rec('c1', 'cita_inmo', { titulo: 'Visita C/ Sueca', cuando: at(0, '17:00'), inmueble: 'v1' }),
      rec('c2', 'cita_inmo', { titulo: 'Tasación', cuando: at(2, '10:00') }),
      rec('k1', 'contacto_inmo', { nombre: 'Clara', temperatura: 'caliente', seguimiento: at(-1, '10:00') }),
      rec('k2', 'contacto_inmo', { nombre: 'Hugo', temperatura: 'templado', seguimiento: at(0, '12:00') }),
      rec('k3', 'contacto_inmo', { nombre: 'Marc', temperatura: 'cerrado', seguimiento: at(-5, '10:00') }),
      rec('o1', 'operacion', { titulo: 'Clara · V-1043', etapa: 'visita', importe: 200000, comision: 3, probabilidad: 50 }),
      rec('o2', 'operacion', { titulo: 'Cerrada', etapa: 'cerrada', importe: 100000, comision: 3, probabilidad: 100 }),
    ];
    const ops = computeOps(bp, records, now);
    expect(ops.occupancy).toEqual({ busy: 1, total: 2 });
    expect(ops.income?.net).toBe(300 - 45 - 35 + 400 - 60 - 35 + 300);
    expect(ops.pipeline).toEqual({ open: 200000, count: 1, commission: 3000 });
    expect(ops.hot).toEqual({ hot: 1, active: 2 });
    expect(ops.today.map((l) => `${l.kind}:${l.record.id}`)).toEqual(['servicio:s1', 'cita:c1', 'llegada:r2', 'salida:r1']);
    expect(ops.today.find((l) => l.kind === 'llegada')?.place).toBe('Loft Carmen');
    const kinds = ops.alerts.map((a) => `${a.kind}:${a.record.id}`);
    expect(kinds).toContain('solape:r3');
    expect(kinds).toContain('sin_limpieza:r2');   // r2 leaves in 3 days, no cleaning
    expect(kinds).not.toContain('sin_limpieza:r1');
    expect(kinds).toContain('incidencia:i1');
    expect(kinds).not.toContain('incidencia:i2');
    expect(kinds).toContain('cobro:r2');
    expect(kinds).not.toContain('cobro:r3');      // hasn't started
    expect(kinds).toContain('seguimiento:k1');
    expect(kinds).not.toContain('seguimiento:k2'); // later today
    expect(kinds).not.toContain('seguimiento:k3'); // closed
    expect(ops.funnel?.active.map((r) => r.id)).toEqual(['o1']);
    expect(ops.funnel?.stages.find((s) => s.value === 'visita')).toMatchObject({ count: 1, amount: 200000 });
    expect(ops.week).toHaveLength(7);
    expect(ops.week[1].items.map((l) => l.record.id)).toEqual(['c2', 'r3']);
    expect(ops.featured.map((r) => r.id)[0]).toBe('v1');
    expect(ops.featured.some((r) => r.id === 'v2')).toBe(false);
  });

  it('leaves out what the blueprint does not have', () => {
    const bp = composeApp('crm', 'Mi CRM', ['leads', 'agenda']);
    const ops = computeOps(bp, [], now);
    expect(ops.occupancy).toBeUndefined();
    expect(ops.income).toBeUndefined();
    expect(ops.pipeline).toBeUndefined();
    expect(ops.funnel).toBeUndefined();
    expect(ops.hot).toBeUndefined();
    expect(ops.alerts).toEqual([]);
  });
});
