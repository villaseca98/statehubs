import { describe, expect, it, vi } from 'vitest';
import { runAutomations, sendFromBrowser } from './automations';
import { composeApp, sampleRecordsFor } from '@shared/blueprint/modules.ts';
import type { AppRecord } from '@shared/blueprint/types.ts';

const bp = composeApp('crm', 'Mi CRM', ['leads', 'automatizaciones']);

describe('automations from the browser (guest mode)', () => {
  it('posts JSON to public https only and reports the answer', async () => {
    const post = vi.fn(async () => new Response('ok', { status: 200 }));
    expect(await sendFromBrowser('https://n8n.example.com/webhook/a', { x: 1 }, post as unknown as typeof fetch)).toBe('Enviado (200)');
    expect(post).toHaveBeenCalledWith('https://n8n.example.com/webhook/a', expect.objectContaining({ method: 'POST', body: '{"x":1}' }));
    expect(await sendFromBrowser('http://192.168.1.2/x', {}, post as unknown as typeof fetch)).toMatch(/no permitida/);
    expect(post).toHaveBeenCalledTimes(1);
    const failing = vi.fn(async () => { throw new TypeError('cors'); });
    expect(await sendFromBrowser('https://n8n.example.com/x', {}, failing as unknown as typeof fetch)).toMatch(/no pudo enviarlo/);
  });

  it('runs the matching automations and saves their result', async () => {
    const records: AppRecord[] = [
      ...sampleRecordsFor(bp).filter((r) => r.entity !== 'automatizacion'),
      { id: 'a1', entity: 'automatizacion', data: { nombre: 'Aviso', seccion: 'Leads', evento: 'alta', estado: 'activa', url: 'https://n8n.example.com/webhook/lead' } },
    ];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 201 }));
    const saved: [string, string][] = [];
    const lead: AppRecord = { id: 'nuevo', entity: 'lead', data: { nombre: 'Rosa', estado: 'nuevo' } };
    const lines = await runAutomations({ appId: 'local-x', appName: 'Mi CRM', local: true, blueprint: bp, records, saveResult: (a, r) => { saved.push([a.id, r]); } }, lead, 'alta', null);
    expect(lines).toEqual(['Aviso: Enviado (201)']);
    expect(saved).toEqual([['a1', 'Enviado (201)']]);
    const body = JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body));
    expect(body).toMatchObject({ evento: 'alta', seccion: 'Leads', registro: { titulo: 'Rosa' } });
    // Nothing matches a change to another section.
    expect(await runAutomations({ appId: 'local-x', appName: 'Mi CRM', local: true, blueprint: bp, records, saveResult: () => undefined }, records[0], 'cambio', records[0].data)).toEqual([]);
    fetchSpy.mockRestore();
  });
});
