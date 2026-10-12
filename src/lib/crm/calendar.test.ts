import { describe, expect, it } from 'vitest';
import { composeApp, composePack } from '@shared/blueprint/modules.ts';
import { googleEventBody, googleEventId } from '@shared/blueprint/calendar.ts';
import type { AppRecord } from '@shared/blueprint/types.ts';
import { addMinutes, compactDate, eventFor, googleCalendarUrl, icsFileName, icsFor, localToUtc, patchMovesAppointment, slotMinutesFor, touchesCalendar, utcToLocal } from './calendar';

const bp = composeApp('crm', 'Mi CRM', ['leads', 'clientes', 'agenda', 'automatizaciones']);

describe('calendar helpers', () => {
  it('adds minutes on the wall clock, across days', () => {
    expect(addMinutes('2026-10-12T10:00', 60)).toBe('2026-10-12T11:00');
    expect(addMinutes('2026-12-31T23:30', 45)).toBe('2027-01-01T00:15');
    expect(compactDate('2026-10-12T09:05')).toBe('20261012T090500');
  });

  it('converts Spanish local time to UTC and back, summer and winter', () => {
    expect(localToUtc('2026-07-01T10:00')).toBe('2026-07-01T08:00:00.000Z');
    expect(localToUtc('2026-12-01T10:00')).toBe('2026-12-01T09:00:00.000Z');
    expect(localToUtc('2026-12-01')).toBe('2026-11-30T23:00:00.000Z');
    expect(utcToLocal('2026-07-01T08:00:00Z')).toBe('2026-07-01T10:00');
    expect(utcToLocal('2026-12-01T09:30:00.000Z')).toBe('2026-12-01T10:30');
    expect(utcToLocal('2026-10-25T01:30:00Z')).toBe('2026-10-25T02:30');
  });

  it('uses the worklist slot length, 60 minutes otherwise', () => {
    const custom = structuredClone(bp);
    custom.views.find((v) => v.entity === 'lead')!.availability!.slotMinutes = 30;
    expect(slotMinutesFor(custom, 'lead')).toBe(30);
    expect(slotMinutesFor(bp, 'cita')).toBe(60);
  });

  it('builds the event from the first datetime with a value, with useful details', () => {
    const lead: AppRecord = { id: 'l1', entity: 'lead', data: { nombre: 'Clara Vidal', telefono: '600 111 222', estado: 'cita', cita: '2026-10-14T10:00', notas: 'Quiere precio' } };
    const e = eventFor(bp, lead)!;
    expect(e).toMatchObject({ title: 'Clara Vidal', start: '2026-10-14T10:00', end: '2026-10-14T11:00' });
    expect(e.details).toContain('Teléfono: 600 111 222');
    expect(e.details).toContain('Estado: Cita agendada');
    expect(e.details).toContain('Quiere precio');
    expect(eventFor(bp, { ...lead, data: { nombre: 'Sin cita' } })).toBeNull();
  });

  it('adds the related client and how to reach them', () => {
    const client: AppRecord = { id: 'c1', entity: 'cliente', data: { nombre: 'Bar Pepe', telefono: '911 222 333' } };
    const cita: AppRecord = { id: 'a1', entity: 'cita', data: { asunto: 'Visita', cliente: 'c1', cuando: '2026-10-14T17:30' } };
    expect(eventFor(bp, cita, [client])!.details).toContain('Cliente: Bar Pepe · 911 222 333');
  });

  it('ignores the automation log and knows when a save touches the calendar', () => {
    const auto: AppRecord = { id: 'x', entity: 'automatizacion', data: { nombre: 'Hook', ultimo_envio: '2026-10-12T10:00' } };
    expect(eventFor(bp, auto)).toBeNull();
    expect(touchesCalendar(bp, auto, null)).toBe(false);
    const lead: AppRecord = { id: 'l1', entity: 'lead', data: { nombre: 'Ana' } };
    expect(touchesCalendar(bp, lead, null)).toBe(false);
    expect(touchesCalendar(bp, lead, { cita: '2026-10-12T10:00' })).toBe(true);
  });

  it('makes the Google Calendar link in Spanish time', () => {
    const url = new URL(googleCalendarUrl({ title: 'Clara Vidal', start: '2026-10-14T10:00', end: '2026-10-14T11:00', details: 'Teléfono: 600' }));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('dates')).toBe('20261014T100000/20261014T110000');
    expect(url.searchParams.get('ctz')).toBe('Europe/Madrid');
    expect(url.searchParams.get('text')).toBe('Clara Vidal');
  });

  it('knows which changes move an appointment (and sync it by themselves)', () => {
    expect(patchMovesAppointment(bp, 'lead', { cita: '2026-10-14T10:00' })).toBe(true);
    expect(patchMovesAppointment(bp, 'lead', { notas: 'x' })).toBe(false);
    expect(patchMovesAppointment(bp, 'automatizacion', { ultimo_envio: '2026-10-14T10:00' })).toBe(false);
  });
});

describe('calendar for estate agencies and holiday lets', () => {
  const inmo = composePack('ambos', 'Inmobiliaria (prueba)');
  const loft: AppRecord = { id: 'i1', entity: 'inmueble', data: { referencia: 'T-02', direccion: 'Loft Carmen · C/ Quart 40' } };
  const ana: AppRecord = { id: 'c1', entity: 'contacto_inmo', data: { nombre: 'Ana López', telefono: '600 000 111' } };

  it('a visit carries the client and the property address', () => {
    const visita: AppRecord = { id: 'v1', entity: 'cita_inmo', data: { titulo: 'Visita piso', tipo: 'visita', cuando: '2026-10-15T17:00', contacto: 'c1', inmueble: 'i1' } };
    const e = eventFor(inmo, visita, [loft, ana])!;
    expect(e).toMatchObject({ title: 'Visita piso', start: '2026-10-15T17:00', end: '2026-10-15T18:00', location: 'Loft Carmen · C/ Quart 40' });
    expect(e.details).toContain('Contacto: Ana López · 600 000 111');
    expect(new URL(googleCalendarUrl(e)).searchParams.get('location')).toBe('Loft Carmen · C/ Quart 40');
  });

  it('a booking is an all-day event from check-in to check-out, gone once cancelled', () => {
    const reserva: AppRecord = { id: 'r1', entity: 'reserva', data: { huesped: 'Marta Ruiz', alojamiento: 'i1', canal: 'airbnb', entrada: '2026-10-20', salida: '2026-10-23', estado: 'confirmada' } };
    const e = eventFor(inmo, reserva, [loft])!;
    expect(e).toMatchObject({ title: 'Marta Ruiz · T-02', start: '2026-10-20', end: '2026-10-23', allDay: true });
    expect(e.details).toContain('Entrada: 20/10/2026');
    expect(e.details).toContain('Canal: Airbnb');
    expect(new URL(googleCalendarUrl(e)).searchParams.get('dates')).toBe('20261020/20261023');
    expect(eventFor(inmo, { ...reserva, data: { ...reserva.data, estado: 'cancelada' } }, [loft])).toBeNull();
    expect(patchMovesAppointment(inmo, 'reserva', { entrada: '2026-10-21' })).toBe(false);
  });

  it('cleanings and follow-ups have their event too', () => {
    const limpieza: AppRecord = { id: 's1', entity: 'servicio', data: { titulo: 'Limpieza salida', fecha: '2026-10-23T11:00', alojamiento: 'i1', estado: 'pendiente' } };
    expect(eventFor(inmo, limpieza, [loft])).toMatchObject({ start: '2026-10-23T11:00', location: 'Loft Carmen · C/ Quart 40' });
    expect(eventFor(inmo, { id: 'c2', entity: 'contacto_inmo', data: { nombre: 'Luis', temperatura: 'caliente', seguimiento: '2026-10-16T09:30' } })).toMatchObject({ title: 'Luis', start: '2026-10-16T09:30' });
  });

  it('writes a valid .ics: UTC times, all-day dates, escaped text, folded lines', () => {
    const ics = icsFor({ title: 'Visita; piso, 3.º', start: '2026-07-01T10:00', end: '2026-07-01T11:00', details: 'Línea 1\nLínea 2 ' + 'x'.repeat(120), location: 'C/ Mayor, 8' }, 'rec-1', new Date('2026-10-12T08:00:00Z'));
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20260701T080000Z\r\nDTEND:20260701T090000Z');
    expect(ics).toContain('SUMMARY:Visita\\; piso\\, 3.º');
    expect(ics).toContain('LOCATION:C/ Mayor\\, 8');
    expect(ics).toContain('DESCRIPTION:Línea 1\\nLínea 2');
    expect(ics).toContain('UID:rec-1@statehubs');
    for (const line of ics.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    const allDay = icsFor({ title: 'Marta', start: '2026-10-20', end: '2026-10-23', details: '', allDay: true }, 'r1');
    expect(allDay).toContain('DTSTART;VALUE=DATE:20261020\r\nDTEND;VALUE=DATE:20261023');
    expect(icsFileName({ title: 'Visita ático, Ruzafa', start: '2026-10-15T17:00', end: '', details: '' })).toBe('Visita-atico-Ruzafa-2026-10-15.ics');
  });

  it('sends Google the event in Madrid time, with an id derived from the record', async () => {
    expect(googleEventBody({ title: 'Visita', start: '2026-10-15T17:00', end: '2026-10-15T18:00', details: 'd' }, 'v1')).toMatchObject({
      summary: 'Visita', start: { dateTime: '2026-10-15T17:00:00', timeZone: 'Europe/Madrid' }, end: { dateTime: '2026-10-15T18:00:00', timeZone: 'Europe/Madrid' },
      extendedProperties: { private: { statehubs_record: 'v1' } },
    });
    expect(googleEventBody({ title: 'M', start: '2026-10-20', end: '2026-10-23', details: '', allDay: true }, 'r1')).toMatchObject({ start: { date: '2026-10-20' }, end: { date: '2026-10-23' } });
    const id = await googleEventId('user-1', 'v1');
    expect(id).toMatch(/^[a-v0-9]{5,1024}$/);
    expect(await googleEventId('user-1', 'v1')).toBe(id);
    expect(await googleEventId('user-2', 'v1')).not.toBe(id);
  });
});
