import { describe, expect, it } from 'vitest';
import { hookPayload, isAllowedHookUrl, isPrivateAddress, matchAutomations, sectionEntity } from './automations.ts';
import { composeApp } from './modules.ts';
import type { AppRecord } from './types.ts';

const bp = composeApp('crm', 'Mi CRM', ['leads', 'facturas', 'automatizaciones']);
const auto = (id: string, data: Record<string, unknown>): AppRecord => ({ id, entity: 'automatizacion', data: { estado: 'activa', url: 'https://n8n.example.com/webhook/x', ...data } });

describe('automations', () => {
  it('finds the section by key, label or screen name, ignoring accents and case', () => {
    expect(sectionEntity(bp, 'leads')?.key).toBe('lead');
    expect(sectionEntity(bp, 'Lead')?.key).toBe('lead');
    expect(sectionEntity(bp, 'FACTURAS')?.key).toBe('factura');
    expect(sectionEntity(bp, 'Automatizacion')?.key).toBe('automatizacion');
    expect(sectionEntity(bp, 'nada')).toBeUndefined();
  });

  it('matches by section, event and target stage, and only active ones', () => {
    const autos = [
      auto('a1', { seccion: 'Leads', evento: 'alta' }),
      auto('a2', { seccion: 'Leads', evento: 'cambio', estado_destino: 'ganado' }),
      auto('a3', { seccion: 'Leads', evento: 'cualquiera' }),
      auto('a4', { seccion: 'Leads', evento: 'alta', estado: 'pausada' }),
      auto('a5', { seccion: 'Facturas', evento: 'cambio', estado_destino: 'Cobrada' }),
    ];
    const ids = (xs: AppRecord[]) => xs.map((x) => x.id);
    expect(ids(matchAutomations(bp, autos, 'lead', 'alta', null, { nombre: 'Ana' }))).toEqual(['a1', 'a3']);
    expect(ids(matchAutomations(bp, autos, 'lead', 'cambio', { estado: 'cita' }, { estado: 'ganado' }))).toEqual(['a2', 'a3']);
    // A change that doesn't touch a stage only fires "any change" automations.
    expect(ids(matchAutomations(bp, autos, 'lead', 'cambio', { estado: 'cita', telefono: '1' }, { estado: 'cita', telefono: '2' }))).toEqual(['a3']);
    // The stage can be written as its label.
    expect(ids(matchAutomations(bp, autos, 'factura', 'cambio', { cobro: 'pendiente' }, { cobro: 'cobrada' }))).toEqual(['a5']);
    expect(ids(matchAutomations(bp, autos, 'factura', 'cambio', { cobro: 'pendiente' }, { cobro: 'vencida' }))).toEqual([]);
    expect(matchAutomations(bp, autos, 'automatizacion', 'alta', null, {})).toEqual([]);
  });

  it('payload carries raw data and readable labels', () => {
    const r: AppRecord = { id: 'l1', entity: 'lead', data: { nombre: 'Ana', estado: 'ganado', valor: 1200 } };
    const p = hookPayload(bp, 'Mi CRM', 'lead', 'cambio', r, { estado: 'cita' });
    expect(p).toMatchObject({ evento: 'cambio', aplicacion: 'Mi CRM', seccion: 'Leads', antes: { estado: 'cita' } });
    expect(p.registro).toMatchObject({ id: 'l1', titulo: 'Ana', datos: r.data });
    expect(p.registro.legible.Estado).toBe('Ganado');
  });

  it('only allows public https webhooks', () => {
    expect(isAllowedHookUrl('https://n8n.miempresa.es/webhook/abc')).toBe(true);
    for (const bad of ['http://n8n.miempresa.es/x', 'https://localhost/x', 'https://127.0.0.1/x', 'https://10.0.0.5/x', 'https://192.168.1.10/x',
      'https://169.254.169.254/latest', 'https://[::1]/x', 'https://router/x', 'https://user:pw@example.com/x', 'https://srv.internal/x', 'no es url', 'javascript:alert(1)']) {
      expect(isAllowedHookUrl(bad), bad).toBe(false);
    }
    expect(isPrivateAddress('172.20.1.1')).toBe(true);
    expect(isPrivateAddress('172.32.1.1')).toBe(false);
    expect(isPrivateAddress('::ffff:10.0.0.1')).toBe(true);
    expect(isPrivateAddress('fd12::1')).toBe(true);
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
  });

  it.each([
    '::ffff:127.0.0.1', '::ffff:7f00:1', '0:0:0:0:0:ffff:a00:1',
    '::ffff:169.254.169.254', '::ffff:c0a8:101', '::ffff:ac10:1',
    '0:0:0:0:0:0:0:1', '0:0:0:0:0:0:0:0',
    'fe90::1', 'fea0::1', 'febf::1', 'fec0::1',
  ])('rejects non-public IPv6 address %s, including URL normalization', (address) => {
    expect(isPrivateAddress(address)).toBe(true);
    expect(isAllowedHookUrl(`https://[${address}]/hook`)).toBe(false);
  });

  it.each(['2606:4700:4700::1111', '2001:4860:4860::8888', '::ffff:8.8.8.8'])('preserves public IPv6 destination %s', (address) => {
    expect(isPrivateAddress(address)).toBe(false);
    expect(isAllowedHookUrl(`https://[${address}]/hook`)).toBe(true);
  });
});
