import { describe, expect, it } from 'vitest';
import type { AppRecord } from '@shared/blueprint/types';
import { composePack } from '@shared/blueprint/modules';
import { dealCommission, propertyHub } from './propertyHub';
import { needsReply, parseTranscript } from './conversations';

const bp = composePack('ambos', 'Agency');
const r = (id: string, entity: string, data: AppRecord['data'], extra: Partial<AppRecord> = {}) => ({ id, entity, data, created_at: '2026-10-01T10:00:00Z', ...extra } as AppRecord);
const now = new Date('2026-10-19T12:00:00Z');
const home = r('p', 'inmueble', { direccion: 'Calle Sol 1', operacion: 'venta', agente: 'a1' });

describe('property mini-CRM', () => {
 const records = [home,
  r('c1', 'contacto_inmo', { nombre: 'Ana', match_qualified: true }),
  r('c2', 'contacto_inmo', { nombre: 'Luis' }, { created_at: '2026-10-18T10:00:00Z' }),
  r('c3', 'contacto_inmo', { nombre: 'Old', temperatura: 'descartado' }),
  r('c4', 'contacto_inmo', { nombre: 'Elsewhere' }),
  r('v1', 'cita_inmo', { titulo: 'Visit', cuando: '2026-10-25T10:00', contacto: 'c1', inmueble: 'p', resultado: 'pendiente' }),
  r('v2', 'cita_inmo', { titulo: 'Past', cuando: '2026-10-02T10:00', contacto: 'c3', inmueble: 'p' }),
  r('d1', 'operacion', { titulo: 'Offer', etapa: 'negociacion', contacto: 'c2', inmueble: 'p', importe: 250000, comision: 3 }),
  r('i1', 'conversacion', { usuario: '@ana', contacto: 'c1', transcripcion: '[22:00] @ana: hola' }),
  r('i2', 'conversacion', { usuario: '@x', inmueble: 'other' }),
 ];
 const hub = propertyHub(home, records, bp, now);
 it('groups leads from the shared contacts without a separate store', () => {
  expect(hub.leads.qualified.map(c => c.id)).toEqual(['c1']);
  expect(hub.leads.potential.map(c => c.id)).toEqual(['c2']);
  expect(hub.leads.fresh.map(c => c.id)).toEqual(['c2']);
  expect(hub.leads.discarded.map(c => c.id)).toEqual(['c3']);
 });
 it('links viewings, deals and conversations through real relations', () => {
  expect(hub.viewings.upcoming.map(v => v.id)).toEqual(['v1']);
  expect(hub.viewings.past.map(v => v.id)).toEqual(['v2']);
  expect(hub.deals.open.map(d => d.id)).toEqual(['d1']);
  expect(hub.conversations.map(c => c.id)).toEqual(['i1']);
  expect(hub.next?.record.id).toBe('v1');
  expect(hub.agentId).toBe('a1');
 });
 it('computes commission only from recorded values', () => {
  expect(dealCommission(records[7])).toBe(7500);
  expect(dealCommission(r('d', 'operacion', { importe: 1000 }))).toBeNull();
 });
 it('keeps sample data apart from real data', () => {
  expect(propertyHub({ ...home, is_sample: true }, records, bp, now).leads.qualified).toEqual([]);
 });
});

describe('conversation transcript', () => {
 it('turns stored lines into incoming, automated and continued bubbles', () => {
  const b = parseTranscript('…\n[22:04] @marta: (comentario) PISO\n[22:04] Asistente: ¿Qué buscas?\nsegunda línea\n[22:05] @marta: Comprar');
  expect(b.map(x => [x.direction, x.automated, x.note])).toEqual([['in', false, true], ['out', true, false], ['in', false, false]]);
  expect(b[1].text).toBe('¿Qué buscas?\nsegunda línea');
 });
 it('flags conversations waiting on a person', () => {
  expect(needsReply(r('x', 'conversacion', { estado: 'humano' }))).toBe(true);
  expect(needsReply(r('x', 'conversacion', { estado: 'en_curso', transcripcion: '[1:00] Asistente: hola' }))).toBe(false);
  expect(needsReply(r('x', 'conversacion', { estado: 'en_curso', transcripcion: '[1:00] @a: hola' }))).toBe(true);
 });
});
