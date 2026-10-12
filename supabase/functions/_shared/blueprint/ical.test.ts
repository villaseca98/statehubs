import { describe, expect, it } from 'vitest';
import { eventToReserva, isBlock, parseIcal, planSync, syncSummaryText } from './ical.ts';
import type { AppRecord } from './types.ts';

const AIRBNB = [
  'BEGIN:VCALENDAR',
  'PRODID;X-RICAL-TZSOURCE=TZINFO:-//Airbnb Inc//Hosting Calendar 0.8.8//EN',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'DTEND;VALUE=DATE:20261016',
  'DTSTART;VALUE=DATE:20261012',
  'UID:1418fb94e984-5c1bb7d3d2ec@airbnb.com',
  'DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMQ4ZK2\\nPhone',
  '  Number (Last 4 Digits): 4410',
  'SUMMARY:Reserved',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTEND;VALUE=DATE:20261025',
  'DTSTART;VALUE=DATE:20261020',
  'UID:7f0a1c2e-blocked@airbnb.com',
  'SUMMARY:Airbnb (Not available)',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20261030',
  'DTEND;VALUE=DATE:20261030',
  'UID:broken@airbnb.com',
  'SUMMARY:Reserved',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const BOOKING = 'BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nUID:b-1\nDTSTART;VALUE=DATE:20261101\nDTEND;VALUE=DATE:20261104\nSUMMARY:CLOSED - Not available\nEND:VEVENT\nEND:VCALENDAR\n';

const res = (id: string, data: Record<string, unknown>): AppRecord => ({ id, entity: 'reserva', data: { alojamiento: 'in1', origen_sync: 'ical', canal: 'airbnb', estado: 'confirmada', ...data } });

describe('iCal', () => {
  it('reads all-day events, unfolds long lines and skips broken ones', () => {
    const evs = parseIcal(AIRBNB);
    expect(evs).toHaveLength(2);
    expect(evs[0]).toMatchObject({ uid: '1418fb94e984-5c1bb7d3d2ec@airbnb.com', start: '2026-10-12', end: '2026-10-16', summary: 'Reserved' });
    expect(evs[0].description).toContain('Number (Last 4 Digits): 4410');
    expect(parseIcal(BOOKING)[0]).toMatchObject({ uid: 'b-1', start: '2026-11-01', end: '2026-11-04' });
  });

  it('accepts date-times and an event without end', () => {
    const evs = parseIcal('BEGIN:VEVENT\nUID:x\nDTSTART:20261012T140000Z\nSUMMARY:Ana López\nEND:VEVENT');
    expect(evs[0]).toMatchObject({ start: '2026-10-12', end: '2026-10-13', summary: 'Ana López' });
  });

  it('tells bookings from blocks', () => {
    expect(isBlock('airbnb', 'Reserved')).toBe(false);
    expect(isBlock('airbnb', 'Airbnb (Not available)')).toBe(true);
    // Booking doesn't say which closed dates are bookings: they are kept as bookings.
    expect(isBlock('booking', 'CLOSED - Not available')).toBe(false);
    const [reserved, blocked] = parseIcal(AIRBNB);
    expect(eventToReserva(reserved, 'airbnb', 'in1')).toMatchObject({ huesped: 'Reserva Airbnb', estado: 'confirmada', canal: 'airbnb', ref_externa: reserved.uid, origen_sync: 'ical', entrada: '2026-10-12', salida: '2026-10-16' });
    expect(eventToReserva(blocked, 'airbnb', 'in1')).toMatchObject({ estado: 'bloqueo', huesped: 'Bloqueo Airbnb' });
    expect(eventToReserva(parseIcal(BOOKING)[0], 'booking', 'in1')).toMatchObject({ huesped: 'Reserva Booking', estado: 'confirmada', canal: 'booking' });
  });

  it('plans creates, updates and cancellations without touching what was typed by hand', () => {
    const events = parseIcal(AIRBNB);
    const existing = [
      // Same UID, dates moved, the owner already wrote the guest's name and price.
      res('r1', { ref_externa: events[0].uid, huesped: 'Paolo Ricci', importe: 520, entrada: '2026-10-11', salida: '2026-10-16' }),
      // Gone from the feed and still to come: cancelled.
      res('r2', { ref_externa: 'gone@airbnb.com', huesped: 'Reserva Airbnb', entrada: '2026-11-02', salida: '2026-11-05' }),
      // Gone but already started: left alone.
      res('r3', { ref_externa: 'old@airbnb.com', entrada: '2026-10-01', salida: '2026-10-13' }),
      // Made by hand, other channel, other listing: never touched.
      res('r4', { ref_externa: undefined, origen_sync: 'manual', canal: 'directa', entrada: '2026-11-10', salida: '2026-11-12' }),
      res('r5', { ref_externa: 'gone@booking', canal: 'booking', entrada: '2026-11-10', salida: '2026-11-12' }),
      res('r6', { alojamiento: 'in2', ref_externa: 'x@airbnb.com', entrada: '2026-11-10', salida: '2026-11-12' }),
    ];
    const plan = planSync(existing, 'in1', 'airbnb', events, '2026-10-12');
    expect(plan.create).toHaveLength(1);
    expect(plan.create[0]).toMatchObject({ estado: 'bloqueo', entrada: '2026-10-20' });
    expect(plan.update).toEqual([{ id: 'r1', data: expect.objectContaining({ entrada: '2026-10-12', huesped: 'Paolo Ricci', importe: 520 }) }]);
    expect(plan.cancel.map((c) => c.id)).toEqual(['r2']);
    expect(plan.cancel[0].data.estado).toBe('cancelada');

    // Second run with the result applied: nothing to do.
    const after = [...existing.map((r) => ({ ...r, data: { ...r.data, ...(plan.update.find((u) => u.id === r.id)?.data ?? {}), ...(plan.cancel.find((c) => c.id === r.id)?.data ?? {}) } })),
      ...plan.create.map((data, i) => ({ id: `n${i}`, entity: 'reserva', data }))];
    expect(planSync(after, 'in1', 'airbnb', events, '2026-10-12')).toEqual({ create: [], update: [], cancel: [] });
  });

  it('brings back a cancelled one that reappears and ignores events already over', () => {
    const events = parseIcal(AIRBNB);
    const plan = planSync([res('r1', { ref_externa: events[0].uid, estado: 'cancelada', entrada: '2026-10-12', salida: '2026-10-16' })], 'in1', 'airbnb', events, '2026-10-12');
    expect(plan.update[0].data.estado).toBe('confirmada');
    expect(planSync([], 'in1', 'airbnb', events, '2026-12-01').create).toEqual([]);
  });

  it('marks Booking imports as possibly closed by hand', () => {
    const plan = planSync([], 'in1', 'booking', parseIcal(BOOKING), '2026-10-12');
    expect(plan.create[0].notas).toMatch(/no dice si es una reserva/);
  });

  it('summarises in one line', () => {
    expect(syncSummaryText({ nuevas: 2, actualizadas: 1, canceladas: 0, errores: [] })).toBe('2 nuevas, 1 actualizada, 0 canceladas.');
    expect(syncSummaryText({ nuevas: 0, actualizadas: 0, canceladas: 0, errores: ['Loft (Booking): no responde'] })).toMatch(/Todo al día.*Loft/);
  });
});
