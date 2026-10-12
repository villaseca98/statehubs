import { describe, expect, it } from 'vitest';
import { composeApp } from '@shared/blueprint/modules.ts';
import type { AppRecord } from '@shared/blueprint/types.ts';
import { addMinutes, compactDate, eventFor, googleCalendarUrl, localToUtc, slotMinutesFor, touchesCalendar, utcToLocal } from './calendar';

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
});
